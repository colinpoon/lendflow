import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import crypto from 'crypto';
import path from 'path';
import { extractVisionData } from '@/utils/visionProcessor';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { detectYearConflicts, type ExtractionWithDocument } from '@/lib/extraction-utils';
import { checkRateLimit } from '@/lib/rate-limiter';
import { logAuditEvent } from '@/lib/audit-log';
import { logFairLendingRecord } from '@/lib/fair-lending';
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_LABEL } from '@/lib/constants';
import { logger } from '@/lib/logger';

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
  logger.info('API hit: /api/extractData/vision');

  const { userId } = await auth();

  if (!userId) {
    logger.warn('Unauthorized request to /api/extractData/vision');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { allowed, retryAfterSeconds } = await checkRateLimit(userId, 'vision');
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
    logger.warn('Invalid projectId format', { projectId });
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
      logger.warn('Project ownership check failed', { userId, projectId });
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
  }

  if (!file) {
    logger.warn('No file uploaded in request');
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  // PDF-only validation — must happen before opening the SSE stream
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    logger.warn('Non-PDF file rejected for vision extraction', { mimeType: file.type, fileName: file.name });
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
    logger.warn('File too large', { fileSize: file.size, maxBytes: MAX_FILE_SIZE_BYTES });
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_FILE_SIZE_LABEL}.` },
      { status: 400 }
    );
  }

  // Sanitize file name to prevent path traversal — file.name is user-controlled
  const sanitizedFileName = path.basename(file.name).replace(/[^\w.\-() ]/g, '_');

  logger.info('File received', { fileName: sanitizedFileName, fileSize: file.size, mimeType: file.type });

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
        logger.info('No projectId provided, creating new project', { fileName: sanitizedFileName });
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
          logger.error('Error creating project', { error: projectError.message });
          await sendProgress({
            stage: 'error',
            progress: 0,
            message: 'Failed to create project',
          });
          await closeWriter();
          return;
        }
        projectId = project.id;
        logger.info('Created new project', { projectId });
      }

      // Generate document ID and storage path
      const documentId = crypto.randomUUID();
      const storagePath = `${userId}/${projectId}/${documentId}/${sanitizedFileName}`;

      logger.info('Uploading to Supabase Storage', { storagePath });

      await sendProgress({
        stage: 'uploading',
        progress: 8,
        message: 'Storing file...',
      });

      // Read file and validate magic bytes BEFORE uploading to storage
      const fileBuffer = await file.arrayBuffer();
      const magicBytes = new Uint8Array(fileBuffer, 0, 4);
      if (magicBytes.length < 4 || magicBytes[0] !== 0x25 || magicBytes[1] !== 0x50 || magicBytes[2] !== 0x44 || magicBytes[3] !== 0x46) {
        logger.warn('Magic byte validation failed: file does not start with %PDF', { fileName: sanitizedFileName });
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
        logger.info('Duplicate file detected', { existingFileName: existingDoc.file_name, uploadDate });
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
        logger.error('Storage upload error', { error: uploadError.message, storagePath });
        await sendProgress({
          stage: 'error',
          progress: 0,
          message: 'Failed to upload file',
        });
        await closeWriter();
        return;
      }

      logger.info('File uploaded to Supabase Storage', { storagePath });

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
        logger.error('Error creating document record', { error: docError.message, documentId });
        await adminSupabase.storage.from('financial-documents').remove([storagePath]);
        await sendProgress({
          stage: 'error',
          progress: 0,
          message: 'Failed to create document record',
        });
        await closeWriter();
        return;
      }

      logger.info('Document record created', { documentId });

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
        logger.error('Error downloading file for processing', { error: downloadError?.message, storagePath });
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

      logger.info('Starting vision-based extraction', { documentId });

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

        logger.info('Vision extraction completed', { processingTimeMs: processingTime, documentId });

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
          logger.error('Error querying existing extractions', { error: existingError.message, projectId });
          // Non-fatal: proceed without conflict detection
        }

        let hasConflicts = false;
        let detectedConflicts: ReturnType<typeof detectYearConflicts>['conflicts'] = [];

        if (existingExtractions && existingExtractions.length > 0) {
          // Build a phantom extraction object (not yet in DB) to run conflict detection.
          // Typed explicitly as ExtractionWithDocument so the shape is verified at compile time.
          const now = new Date().toISOString();
          const phantomExtraction: ExtractionWithDocument = {
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
          };

          const conflictResult = detectYearConflicts(
            phantomExtraction,
            existingExtractions as ExtractionWithDocument[]
          );

          hasConflicts = conflictResult.hasConflicts;
          detectedConflicts = conflictResult.conflicts;
        }

        if (hasConflicts) {
          logger.warn('Year conflicts detected', { years: detectedConflicts.map(c => c.year), projectId });
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
          logger.error('Error saving extraction', { error: extractionError?.message, documentId });
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

        logger.info('Extraction saved', { extractionId: extraction.id, documentId });

        // ── Regulatory audit trail (non-blocking) ───────────────────────────
        logAuditEvent({
          userId,
          projectId: projectId!,
          documentId,
          extractionId: extraction.id,
          pipelineType: 'vision',
          documentHash: contentHash,
          documentName: sanitizedFileName,
          documentSize: file.size,
          processingTimeMs: processingTime,
          extractedData,
        });

        // ── Fair lending monitoring (non-blocking) ───────────────────────────
        logFairLendingRecord({
          userId,
          projectId: projectId!,
          extractionId: extraction.id,
          pipelineType: 'vision',
          extractedData,
        });

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
            logger.error('Failed to update project risk score', { error: projectUpdateError.message, projectId });
          } else {
            logger.info('Project risk score updated', { projectId });
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
        logger.error('Vision extraction error', { error: visionError instanceof Error ? visionError.message : String(visionError), documentId });

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
      logger.error('Error processing file', { error: errorMessage });

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
