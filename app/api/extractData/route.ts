import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { extractFinancialData, type ProgressCallback } from '@/utils/aiProcessor';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { detectYearConflicts, type ExtractionWithDocument } from '@/lib/extraction-utils';
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_LABEL } from '@/lib/constants';
import { checkRateLimit } from '@/lib/rate-limiter';

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

/**
 * Validate file content against magic bytes to prevent MIME type spoofing.
 * Browser-supplied Content-Type is trivially spoofable — check actual file content.
 */
function validateMagicBytes(buffer: Buffer, claimedMimeType: string): boolean {
  if (buffer.length < 4) return false;

  // PDF: starts with %PDF
  if (claimedMimeType === 'application/pdf') {
    return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }

  // XLSX/DOCX: ZIP archive starting with PK\x03\x04
  if (
    claimedMimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    claimedMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  }

  // XLS: OLE compound document starting with D0 CF 11 E0
  if (claimedMimeType === 'application/vnd.ms-excel' || claimedMimeType === 'application/msword') {
    return buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;
  }

  return false;
}

/**
 * Mark any document for this project that has been stuck in 'processing' status
 * for more than 15 minutes as 'failed'. Prevents orphaned records from blocking
 * the project view indefinitely.
 */
async function cleanupStaleProcessingRecords(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string
): Promise<void> {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data: staleDocuments, error: queryError } = await supabase
    .from('documents')
    .select('id')
    .eq('project_id', projectId)
    .eq('processing_status', 'processing')
    .lt('created_at', fifteenMinutesAgo);

  if (queryError) {
    console.warn('⚠️ Failed to query stale processing records:', queryError.message);
    return;
  }

  if (!staleDocuments || staleDocuments.length === 0) return;

  const staleIds = staleDocuments.map((d) => d.id);
  const { error: updateError } = await supabase
    .from('documents')
    .update({
      processing_status: 'failed',
      error_message: 'Processing timed out after 15 minutes',
    })
    .in('id', staleIds);

  if (updateError) {
    console.warn('⚠️ Failed to mark stale processing records as failed:', updateError.message);
  } else {
    console.log(`🧹 Marked ${staleIds.length} stale processing record(s) as failed for project ${projectId}`);
  }
}

export async function POST(req: NextRequest) {
  console.log('✅ API Hit: /api/extractData');

  const { userId } = await auth();

  if (!userId) {
    console.error('❗ Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { allowed, retryAfterSeconds } = checkRateLimit(userId);
  if (!allowed) {
    console.warn(`⚠️ Rate limit exceeded for user ${userId}`);
    return NextResponse.json(
      { error: 'Too many requests. Please wait before uploading again.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
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

  const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]);

  if (file.size > MAX_FILE_SIZE_BYTES) {
    console.error(`❗ File too large: ${file.size} bytes`);
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_FILE_SIZE_LABEL}.` },
      { status: 413 }
    );
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    console.error(`❗ Unsupported file type: ${file.type}`);
    return NextResponse.json(
      { error: `Unsupported file type "${file.type}". Accepted formats: PDF (.pdf), Excel (.xlsx, .xls), Word (.docx).` },
      { status: 415 }
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
  const sendProgress: ProgressCallback = async (data) => {
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

      // Clean up any stuck processing records for this project before adding a new one
      await cleanupStaleProcessingRecords(supabase, projectId!);

      // Generate document ID and storage path
      const documentId = crypto.randomUUID();
      const storagePath = `${userId}/${projectId}/${documentId}/${sanitizedFileName}`;

      console.log(`📤 Uploading to Supabase Storage: ${storagePath}`);

      // Read file buffer once — used for magic byte validation, storage upload, and temp file
      const fileBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(fileBuffer);

      // Validate magic bytes BEFORE uploading — reject spoofed MIME types early
      if (!validateMagicBytes(buffer, file.type)) {
        console.error(`❗ Magic byte validation failed: claimed ${file.type}, content mismatch`);
        await sendProgress({
          stage: 'error',
          progress: 0,
          message: 'File validation failed. The uploaded file does not appear to be a valid document.',
        });
        await closeWriter();
        return;
      }

      // ── Duplicate detection via SHA-256 content hash ─────────────────────────
      const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');

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

      await sendProgress({
        stage: 'uploading',
        progress: 8,
        message: 'Storing file...',
      });

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

      // Write to temp file for AI processor (buffer already validated above)
      const tempDir = os.tmpdir();
      const tempPath = path.join(tempDir, `${documentId}-${sanitizedFileName}`);
      await fs.promises.writeFile(tempPath, buffer);

      console.log(`📂 Temp file created: ${tempPath}`);
      console.log('🤖 Starting AI data extraction...');

      const startTime = Date.now();

      try {
        // Run AI extraction with progress callback and abort signal
        // req.signal fires when the client disconnects, stopping further API calls
        const extractedData = await extractFinancialData(tempPath, sendProgress, userId, req.signal);
        const processingTime = Date.now() - startTime;

        console.log(`✅ AI extraction completed in ${processingTime}ms`);

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
        // (AI extraction can take several minutes, original token may have expired)
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
          // Cast to ExtractionWithDocument: aiProcessor.ExtractionResult and
          // lib/supabase/types.ExtractionResult are structurally compatible at
          // runtime even though they have different TypeScript declarations.
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
        // Flag as 'partial' when both risk assessment and quantitative risk failed
        // (e.g., API billing error) so the UI doesn't present it as fully complete
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
      } catch (aiError: unknown) {
        // Distinguish client disconnect from actual errors
        const isAbort = aiError instanceof DOMException && aiError.name === 'AbortError';
        if (isAbort) {
          console.log('🛑 Client disconnected — extraction aborted, no further API credits consumed');
        } else {
          console.error('❗ AI extraction error:', aiError);
        }

        const errorMessage = isAbort
          ? 'Extraction cancelled — client disconnected'
          : (aiError instanceof Error ? aiError.message : 'AI extraction failed');

        // Get fresh client for error handling (original token may have expired)
        const errorSupabase = await createClient();
        await updateDocumentStatus(errorSupabase, documentId, 'failed', errorMessage);

        if (!isAbort) {
          await sendProgress({
            stage: 'error',
            progress: 0,
            message: errorMessage,
          });
        }
      } finally {
        // Always clean up the temp file regardless of success or failure
        try {
          await fs.promises.unlink(tempPath);
          console.log('Temp file cleaned up');
        } catch (cleanupError) {
          console.warn('Failed to clean up temp file:', cleanupError);
        }
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
  status: 'pending' | 'processing' | 'completed' | 'partial' | 'failed' | 'pending_conflict',
  errorMessage?: string
) {
  const updateData: { processing_status: string; error_message?: string } = {
    processing_status: status,
  };
  if (errorMessage) {
    updateData.error_message = errorMessage;
  }

  const { error } = await supabase.from('documents').update(updateData).eq('id', documentId);
  if (error) {
    console.error(`❗ Failed to update document ${documentId} status to '${status}':`, error.message);
  }
}

