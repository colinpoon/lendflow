import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { extractFinancialData } from '@/utils/aiProcessor';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  console.log('✅ API Hit: /api/extractData');

  const { userId } = await auth();

  if (!userId) {
    console.error('❗ Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();

  try {
    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    let projectId = formData.get('projectId') as string | null;

    if (!file) {
      console.error('❗ No file uploaded');
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    console.log(
      `📁 File received: ${file.name}, size: ${file.size}, type: ${file.type}`
    );

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
        return NextResponse.json(
          { error: 'Failed to create project' },
          { status: 500 }
        );
      }
      projectId = project.id;
      console.log(`✅ Created new project: ${projectId}`);
    }

    // Generate document ID and storage path
    const documentId = crypto.randomUUID();
    const storagePath = `${userId}/${projectId}/${documentId}/${file.name}`;

    console.log(`📤 Uploading to Supabase Storage: ${storagePath}`);

    // Upload to Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('financial-documents')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('❗ Storage upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
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
      await supabase.storage.from('financial-documents').remove([storagePath]);
      return NextResponse.json(
        { error: 'Failed to create document record' },
        { status: 500 }
      );
    }

    console.log(`✅ Document record created: ${documentId}`);

    // Download file to temp for AI processing
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('financial-documents')
      .download(storagePath);

    if (downloadError || !fileData) {
      console.error('❗ Error downloading file for processing:', downloadError);
      await updateDocumentStatus(supabase, documentId, 'failed', 'Failed to download file for processing');
      return NextResponse.json(
        { error: 'Failed to download file for processing' },
        { status: 500 }
      );
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
      // Run AI extraction
      const extractedData = await extractFinancialData(tempPath);
      const processingTime = Date.now() - startTime;

      console.log(`✅ AI extraction completed in ${processingTime}ms`);

      // Extract summary data for denormalized fields
      const years = Object.keys(extractedData.metrics_by_year || {}).sort();
      const latestYear = years[years.length - 1];
      const latestMetrics = latestYear
        ? extractedData.metrics_by_year?.[latestYear]
        : null;

      // Save extraction to database
      const { data: extraction, error: extractionError } = await supabase
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
        await updateDocumentStatus(supabase, documentId, 'failed', 'Failed to save extraction results');
      } else {
        console.log(`✅ Extraction saved: ${extraction?.id}`);

        // Update document status to completed
        await updateDocumentStatus(supabase, documentId, 'completed');

        // Update project with risk info
        if (extractedData.quantitativeRiskAssessment) {
          await supabase
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

      return NextResponse.json({
        message: 'File processed successfully',
        filename: file.name,
        projectId,
        documentId,
        extractionId: extraction?.id,
        financialMetrics: extractedData,
      });
    } catch (aiError: unknown) {
      const errorMessage = aiError instanceof Error ? aiError.message : 'AI extraction failed';
      console.error('❗ AI extraction error:', aiError);

      await updateDocumentStatus(supabase, documentId, 'failed', errorMessage);

      try {
        fs.unlinkSync(tempPath);
      } catch {
        // Ignore cleanup errors
      }

      return NextResponse.json(
        { error: 'AI extraction failed', details: errorMessage },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❗ Error processing file:', errorMessage);

    return NextResponse.json(
      {
        error: 'Internal server error. Please try again.',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
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
