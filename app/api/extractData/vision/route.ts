import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import crypto from 'crypto';
import path from 'path';
import { extractVisionData } from '@/utils/visionProcessor';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { detectYearConflicts, type ExtractionWithDocument } from '@/lib/extraction-utils';
import { checkRateLimit } from '@/lib/rate-limiter';
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_LABEL } from '@/lib/constants';

// SSE progress type for complete message with data
interface SSECompleteProgress {
  stage: 'complete';
  progress: 100;
  message: string;
  data: Record<string, unknown>;
}

// SSE helper to format messages
function sseMessage(data: Record<string, unknown> | SSECompleteProgress): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  console.log('✅ API Hit: /api/extractData/vision');

  const { userId } = await auth();

  if (!userId) {
    console.error('❗ Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { allowed, retryAfterSeconds } = checkRateLimit(userId, 'vision');
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait before submitting another extraction.' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSeconds) },
      }
    );
  }

  const supabase = await createClient();
  const adminSupabase = createAdminClient(); // For storage operations (bypasses RLS UUID issues)

  // Parse form data before creating stream
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  let projectId = formData.get('projectId') as string | null;

  // Validate projectId is a valid UUID if provided
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (projectId && !uuidRegex.test(projectId)) {
    console.error('❗ Invalid projectId format');
    return NextResponse.json({ error: 'Invalid projectId format' }, { status: 400 });
  }

  // Verify the authenticated user owns the target project
  if (projectId) {
    const { data: ownedProject, error: ownershipError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (ownershipError || !ownedProject) {
      console.error(`❗ Project ownership check failed: user ${userId} does not own project ${projectId}`);
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
  }

  if (!file) {
    console.error('❗ No file uploaded');
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  // PDF-only validation — must happen before opening the SSE stream
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    console.error('❗ Non-PDF file rejected:', file.type, file.name);
    return NextResponse.json(
      {
        error:
          'Vision extraction only supports PDF files. For Excel or Word documents, use /api/extractData.',
      },
      { status: 400 }
    );
  }

  // File size check — enforce the same shared limit as text extraction
  if (file.size > MAX_FILE_SIZE_BYTES) {
    console.error(`❗ File too large: ${file.size} bytes`);
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_FILE_SIZE_LABEL}.` },
      { status: 400 }
    );
  }

  // Sanitize file name to prevent path traversal — file.name is user-controlled
  const sanitizedFileName = path.basename(file.name).replace(/[^\w.\-() ]/g, '_');

  console.log(
    `📁 File received: ${sanitizedFileName}, size: ${file.size}, type: ${file.type}`
  );

  // Create a TransformStream for SSE
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  let writerClosed = false;

  // Helper to safely close the writer
  const closeWriter = async () => {
    if (!writerClosed) {
      writerClosed = true;
      await writer.close();
    }
  };

  // Helper to send SSE message
  const sendProgress = async (data: Record<string, unknown>) => {
    if (writerClosed) return;
    try {
      await writer.write(encoder.encode(sseMessage(data)));
    } catch {
      // Stream may be closed
    }
  };

  // Start async processing
  (async () => {
    try {
      // Send initial progress
      await sendProgress({
        stage: 'uploading',
        progress: 5,
        message: 'Uploading file...',
      });

      // If no projectId, create a new project
      if (!projectId) {
        console.log('📂 No projectId provided, creating new project...');
        const { data: project, error: projectError } = await supabase
          .from('projects')
          .insert({
            user_id: userId,
            name: sanitizedFileName.replace(/\.[^/.]+$/, ''),
            status: 'in_progress',
          })
          .select()
          .single();

        if (projectError) {
          console.error('❗ Error creating project:', projectError);
          await sendProgress({
            stage: 'error',
            progress: 0,
            message: 'Failed to create project',
          });
          await closeWriter();
          return;
        }
        projectId = project.id;
        console.log(`✅ Created new project: ${projectId}`);
      }

      // Generate document ID and storage path
      const documentId = crypto.randomUUID();
      const storagePath = `${userId}/${projectId}/${documentId}/${sanitizedFileName}`;

      console.log(`📤 Uploading to Supabase Storage: ${storagePath}`);

      await sendProgress({
        stage: 'uploading',
        progress: 8,
        message: 'Storing file...',
      });

      // Read file and validate magic bytes BEFORE uploading to storage
      const fileBuffer = await file.arrayBuffer();
      const magicBytes = new Uint8Array(fileBuffer, 0, 4);
      if (magicBytes.length < 4 || magicBytes[0] !== 0x25 || magicBytes[1] !== 0x50 || magicBytes[2] !== 0x44 || magicBytes[3] !== 0x46) {
        console.error('❗ Magic byte validation failed: file does not start with %PDF');
        await sendProgress({
          stage: 'error',
          progress: 0,
          message: 'File validation failed. The uploaded file does not appear to be a valid PDF.',
        });
        await closeWriter();
        return;
      }

      // ── Duplicate detection via SHA-256 content hash ─────────────────────────
      const contentHash = crypto.createHash('sha256').update(Buffer.from(fileBuffer)).digest('hex');

      const { data: existingDoc } = await supabase
        .from('documents')
        .select('file_name, created_at')
        .eq('project_id', projectId!)
        .eq('content_hash', contentHash)
        .limit(1)
        .single();

      if (existingDoc) {
        const uploadDate = new Date(existingDoc.created_at).toLocaleDateString();
        console.log(`🔁 Duplicate detected: "${existingDoc.file_name}" uploaded on ${uploadDate}`);
        await sendProgress({
          stage: 'error',
          progress: 0,
          message: `This file has already been uploaded to this project as "${existingDoc.file_name}" on ${uploadDate}. If this is an updated version, please ensure the file content has changed.`,
        });
        await closeWriter();
        return;
      }

      // Upload to Supabase Storage (use admin client to bypass RLS UUID casting issues)
      const { error: uploadError } = await adminSupabase.storage
        .from('financial-documents')
        .upload(storagePath, fileBuffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error('❗ Storage upload error:', uploadError);
        await sendProgress({
          stage: 'error',
          progress: 0,
          message: 'Failed to upload file',
        });
        await closeWriter();
        return;
      }

      console.log('✅ File uploaded to Supabase Storage');

      // Create document record
      const { error: docError } = await supabase.from('documents').insert({
        id: documentId,
        project_id: projectId,
        user_id: userId,
        file_name: sanitizedFileName,
        original_file_name: sanitizedFileName,
        file_type: file.type,
        file_size: file.size,
        storage_path: storagePath,
        content_hash: contentHash,
        processing_status: 'processing',
      });

      if (docError) {
        console.error('❗ Error creating document record:', docError);
        await adminSupabase.storage.from('financial-documents').remove([storagePath]);
        await sendProgress({
          stage: 'error',
          progress: 0,
          message: 'Failed to create document record',
        });
        await closeWriter();
        return;
      }

      console.log(`✅ Document record created: ${documentId}`);

      await sendProgress({
        stage: 'uploading',
        progress: 10,
        message: 'File uploaded successfully',
      });

      // Download file from Supabase Storage for vision processing (use admin client to bypass RLS)
      const { data: fileData, error: downloadError } = await adminSupabase.storage
        .from('financial-documents')
        .download(storagePath);

      if (downloadError || !fileData) {
        console.error('❗ Error downloading file for processing:', downloadError);
        await updateDocumentStatus(supabase, documentId, 'failed', 'Failed to download file for processing');
        await sendProgress({
          stage: 'error',
          progress: 0,
          message: 'Failed to download file for processing',
        });
        await closeWriter();
        return;
      }

      // Convert Blob to Buffer for vision processor (no temp file needed)
      const pdfBuffer = Buffer.from(await fileData.arrayBuffer());

      console.log('🤖 Starting vision-based extraction...');

      await sendProgress({
        stage: 'extracting',
        progress: 20,
        message: 'Converting PDF pages to images...',
      });

      const startTime = Date.now();

      try {
        // Run vision extraction — progress is handled internally (per-page console logging)
        const extractedData = await extractVisionData(pdfBuffer, userId);
        const processingTime = Date.now() - startTime;

        console.log(`✅ Vision extraction completed in ${processingTime}ms`);

        await sendProgress({
          stage: 'computing',
          progress: 75,
          message: 'Computing financial ratios...',
        });

        await sendProgress({
          stage: 'saving',
          progress: 90,
          message: 'Checking for conflicts...',
        });

        // Extract summary data for denormalized fields
        const years = Object.keys(extractedData.metrics_by_year || {}).sort();
        const latestYear = years[years.length - 1];
        const latestMetrics = latestYear
          ? extractedData.metrics_by_year?.[latestYear]
          : null;

        // Get a fresh Supabase client with a new JWT token
        // (vision extraction can take several minutes, original token may have expired)
        const freshSupabase = await createClient();

        // ── Conflict detection BEFORE insertion ────────────────────────────────
        // Query existing extractions for this project so we can detect year
        // overlaps before committing the new extraction to the database.
        const { data: existingExtractions, error: existingError } = await freshSupabase
          .from('extractions')
          .select('*, documents(id, file_name)')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false });

        if (existingError) {
          console.error('❗ Error querying existing extractions:', existingError);
          // Non-fatal: proceed without conflict detection
        }

        let hasConflicts = false;
        let detectedConflicts: ReturnType<typeof detectYearConflicts>['conflicts'] = [];

        if (existingExtractions && existingExtractions.length > 0) {
          // Build a phantom extraction object (not yet in DB) to run conflict detection
          const now = new Date().toISOString();
          const phantomExtraction = {
            id: documentId, // placeholder — extraction not yet persisted
            document_id: documentId,
            project_id: projectId!,
            user_id: userId,
            extraction_data: extractedData,
            fiscal_years: years,
            latest_fccr: latestMetrics?.fccr ?? null,
            latest_dscr: latestMetrics?.dscr ?? null,
            latest_senior_debt_to_ebitda: latestMetrics?.senior_debt_to_ebitda ?? null,
            latest_debt_to_capital: latestMetrics?.total_debt_to_capital ?? null,
            latest_adjusted_ebitda: latestMetrics?.adjusted_ebitda ?? null,
            quantitative_risk_score: extractedData.quantitativeRiskAssessment?.normalized_score ?? null,
            quantitative_risk_band: extractedData.quantitativeRiskAssessment?.risk_band ?? null,
            validation_issues: extractedData.validation_issues ?? null,
            processing_time_ms: processingTime,
            created_at: now,
            updated_at: now,
            documents: { id: documentId, file_name: sanitizedFileName },
          } as unknown as ExtractionWithDocument;

          const conflictResult = detectYearConflicts(
            phantomExtraction,
            existingExtractions as ExtractionWithDocument[]
          );

          hasConflicts = conflictResult.hasConflicts;
          detectedConflicts = conflictResult.conflicts;
        }

        if (hasConflicts) {
          console.log(`⚠️ Year conflicts detected: ${detectedConflicts.map(c => c.year).join(', ')}`);
        }

        // ── Insert extraction ──────────────────────────────────────────────────
        const { data: extraction, error: extractionError } = await freshSupabase
          .from('extractions')
          .insert({
            document_id: documentId,
            project_id: projectId,
            user_id: userId,
            extraction_data: extractedData,
            fiscal_years: years,
            latest_fccr: latestMetrics?.fccr ?? null,
            latest_dscr: latestMetrics?.dscr ?? null,
            latest_senior_debt_to_ebitda:
              latestMetrics?.senior_debt_to_ebitda ?? null,
            latest_debt_to_capital: latestMetrics?.total_debt_to_capital ?? null,
            latest_adjusted_ebitda: latestMetrics?.adjusted_ebitda ?? null,
            quantitative_risk_score:
              extractedData.quantitativeRiskAssessment?.normalized_score ?? null,
            quantitative_risk_band:
              extractedData.quantitativeRiskAssessment?.risk_band ?? null,
            validation_issues: extractedData.validation_issues ?? null,
            processing_time_ms: processingTime,
          })
          .select()
          .single();

        if (extractionError || !extraction) {
          console.error('❗ Error saving extraction:', extractionError);
          // Clean up orphaned storage object since extraction record was not created
          await adminSupabase.storage.from('financial-documents').remove([storagePath]);
          await updateDocumentStatus(freshSupabase, documentId, 'failed', 'Failed to save extraction results');
          await sendProgress({
            stage: 'error',
            progress: 0,
            message: 'Failed to save extraction results',
          });
          await closeWriter();
          return;
        }

        console.log(`✅ Extraction saved: ${extraction.id}`);

        // ── Branch: conflict vs. clean path ───────────────────────────────────
        if (hasConflicts) {
          // Mark document as pending_conflict and surface to the client
          await updateDocumentStatus(freshSupabase, documentId, 'pending_conflict');

          if (!writerClosed) {
            await writer.write(encoder.encode(sseMessage({
              stage: 'conflict_detected',
              progress: 95,
              message: `Conflicts detected for years: ${detectedConflicts.map(c => c.year).join(', ')}`,
              conflicts: detectedConflicts,
              extractionId: extraction.id,
              pendingDocumentId: documentId,
            })));
          }

          await closeWriter();
          return;
        }

        // No conflicts — finalize
        const isPartial = !extractedData.riskAssessment && !extractedData.quantitativeRiskAssessment;
        await updateDocumentStatus(freshSupabase, documentId, isPartial ? 'partial' : 'completed');

        // Update project with risk info
        if (extractedData.quantitativeRiskAssessment) {
          const { error: projectUpdateError } = await freshSupabase
            .from('projects')
            .update({
              status: 'completed',
              risk_score:
                (extractedData.quantitativeRiskAssessment.normalized_score ?? 0) / 10,
              risk_band: extractedData.quantitativeRiskAssessment.risk_band,
            })
            .eq('id', projectId)
            .eq('user_id', userId);

          if (projectUpdateError) {
            // Non-fatal: extraction is saved; project badge will be stale until next load
            console.error('❗ Failed to update project risk score:', projectUpdateError.message);
          } else {
            console.log('✅ Project risk score updated');
          }
        }

        // Send final complete message with data
        if (!writerClosed) {
          await writer.write(encoder.encode(sseMessage({
            stage: 'complete',
            progress: 100,
            message: 'Complete',
            data: {
              message: 'File processed successfully',
              filename: sanitizedFileName,
              projectId,
              documentId,
              extractionId: extraction.id,
              financialMetrics: extractedData,
            },
          })));
        }
      } catch (visionError: unknown) {
        const errorMessage = visionError instanceof Error ? visionError.message : 'Vision extraction failed';
        console.error('❗ Vision extraction error:', visionError);

        // Get fresh client for error handling (original token may have expired)
        const errorSupabase = await createClient();
        await updateDocumentStatus(errorSupabase, documentId, 'failed', errorMessage);

        await sendProgress({
          stage: 'error',
          progress: 0,
          message: errorMessage,
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❗ Error processing file:', errorMessage);

      await sendProgress({
        stage: 'error',
        progress: 0,
        message: errorMessage,
      });
    } finally {
      await closeWriter();
    }
  })();

  // Return SSE response
  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

async function updateDocumentStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'pending_conflict' | 'partial',
  errorMessage?: string
) {
  const updateData: { processing_status: string; error_message?: string } = {
    processing_status: status,
  };
  if (errorMessage) {
    updateData.error_message = errorMessage;
  }

  await supabase.from('documents').update(updateData).eq('id', documentId);
}
