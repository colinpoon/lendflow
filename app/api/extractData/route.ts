import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { extractFinancialData, type ProgressCallback } from '@/utils/aiProcessor';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { detectYearConflicts, type ExtractionWithDocument } from '@/lib/extraction-utils';

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
  console.log('✅ API Hit: /api/extractData');

  const { userId } = await auth();

  if (!userId) {
    console.error('❗ Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  if (!file) {
    console.error('❗ No file uploaded');
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  console.log(
    `📁 File received: ${file.name}, size: ${file.size}, type: ${file.type}`
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
            name: file.name.replace(/\.[^/.]+$/, ''),
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
      const storagePath = `${userId}/${projectId}/${documentId}/${file.name}`;

      console.log(`📤 Uploading to Supabase Storage: ${storagePath}`);

      await sendProgress({
        stage: 'uploading',
        progress: 8,
        message: 'Storing file...',
      });

      // Upload to Supabase Storage (use admin client to bypass RLS UUID casting issues)
      const fileBuffer = await file.arrayBuffer();
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
        file_name: file.name,
        original_file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: storagePath,
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

      // Download file to temp for AI processing (use admin client to bypass RLS)
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

      // Write to temp file for AI processor
      const tempDir = os.tmpdir();
      const tempPath = path.join(tempDir, `${documentId}-${file.name}`);
      const buffer = Buffer.from(await fileData.arrayBuffer());
      fs.writeFileSync(tempPath, buffer);

      console.log(`📂 Temp file created: ${tempPath}`);
      console.log('🤖 Starting AI data extraction...');

      const startTime = Date.now();

      try {
        // Run AI extraction with progress callback
        const extractedData = await extractFinancialData(tempPath, sendProgress);
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

        // Save extraction to database (with pending_conflict status if conflicts exist)
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

        if (extractionError) {
          console.error('❗ Error saving extraction:', extractionError);
          await updateDocumentStatus(freshSupabase, documentId, 'failed', 'Failed to save extraction results');
        } else {
          console.log(`✅ Extraction saved: ${extraction?.id}`);

          // Check for year conflicts with existing extractions
          const { data: existingExtractions } = await freshSupabase
            .from('extractions')
            .select('*, documents(id, file_name)')
            .eq('project_id', projectId)
            .neq('document_id', documentId) // Exclude the one we just inserted
            .order('created_at', { ascending: false });

          if (existingExtractions && existingExtractions.length > 0) {
            // Build the new extraction object for conflict detection
            const newExtractionForConflict: ExtractionWithDocument = {
              ...extraction,
              documents: { id: documentId, file_name: file.name },
            };

            const conflictResult = detectYearConflicts(
              newExtractionForConflict,
              existingExtractions as ExtractionWithDocument[]
            );

            if (conflictResult.hasConflicts) {
              console.log(`⚠️ Year conflicts detected: ${conflictResult.conflicts.map(c => c.year).join(', ')}`);

              // Update document status to pending_conflict
              await updateDocumentStatus(freshSupabase, documentId, 'processing');

              // Clean up temp file before returning
              try {
                fs.unlinkSync(tempPath);
              } catch {
                // Ignore cleanup errors
              }

              // Send conflict detected message and stop processing
              if (!writerClosed) {
                await writer.write(encoder.encode(sseMessage({
                  stage: 'conflict_detected',
                  progress: 95,
                  message: `Conflicts detected for years: ${conflictResult.conflicts.map(c => c.year).join(', ')}`,
                  conflicts: conflictResult.conflicts,
                  extractionId: extraction.id,
                  pendingDocumentId: documentId,
                })));
              }

              await closeWriter();
              return;
            }
          }

          // No conflicts - update document status to completed
          await updateDocumentStatus(freshSupabase, documentId, 'completed');

          // Update project with risk info
          if (extractedData.quantitativeRiskAssessment) {
            await freshSupabase
              .from('projects')
              .update({
                status: 'completed',
                risk_score:
                  (extractedData.quantitativeRiskAssessment.normalized_score ?? 0) / 10,
                risk_band: extractedData.quantitativeRiskAssessment.risk_band,
              })
              .eq('id', projectId);
            console.log('✅ Project risk score updated');
          }
        }

        // Clean up temp file
        try {
          fs.unlinkSync(tempPath);
          console.log('🧹 Temp file cleaned up');
        } catch (cleanupError) {
          console.warn('⚠️ Failed to clean up temp file:', cleanupError);
        }

        // Send final complete message with data
        if (!writerClosed) {
          await writer.write(encoder.encode(sseMessage({
            stage: 'complete',
            progress: 100,
            message: 'Complete',
            data: {
              message: 'File processed successfully',
              filename: file.name,
              projectId,
              documentId,
              extractionId: extraction?.id,
              financialMetrics: extractedData,
            },
          })));
        }
      } catch (aiError: unknown) {
        const errorMessage = aiError instanceof Error ? aiError.message : 'AI extraction failed';
        console.error('❗ AI extraction error:', aiError);

        // Get fresh client for error handling (original token may have expired)
        const errorSupabase = await createClient();
        await updateDocumentStatus(errorSupabase, documentId, 'failed', errorMessage);

        try {
          fs.unlinkSync(tempPath);
        } catch {
          // Ignore cleanup errors
        }

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
  status: 'pending' | 'processing' | 'completed' | 'failed',
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
