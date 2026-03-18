import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/utils/supabase/server';
import {
  mergeExtractions,
  type ExtractionWithDocument,
  type ConflictResolution,
} from '@/lib/extraction-utils';

/**
 * POST /api/resolve-conflict
 * Apply user's conflict resolutions and complete the merge
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();

  let body: {
    extractionId: string;
    projectId: string;
    resolutions: ConflictResolution;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { extractionId, projectId, resolutions } = body;

  if (!extractionId || !projectId || !resolutions) {
    return NextResponse.json(
      { error: 'Missing required fields: extractionId, projectId, resolutions' },
      { status: 400 }
    );
  }

  try {
    // Fetch all extractions for this project with their documents
    const { data: allExtractions, error: fetchError } = await supabase
      .from('extractions')
      .select('*, documents(id, file_name)')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching extractions:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch extractions' },
        { status: 500 }
      );
    }

    if (!allExtractions || allExtractions.length === 0) {
      return NextResponse.json(
        { error: 'No extractions found for this project' },
        { status: 404 }
      );
    }

    // Verify the extraction belongs to this user
    const targetExtraction = allExtractions.find((e) => e.id === extractionId);
    if (!targetExtraction) {
      return NextResponse.json(
        { error: 'Extraction not found or unauthorized' },
        { status: 404 }
      );
    }

    // Merge extractions with user resolutions
    const merged = mergeExtractions(
      allExtractions as ExtractionWithDocument[],
      resolutions
    );

    if (!merged) {
      return NextResponse.json(
        { error: 'Failed to merge extractions' },
        { status: 500 }
      );
    }

    // Update the document status to completed
    const { error: docUpdateError } = await supabase
      .from('documents')
      .update({ processing_status: 'completed' })
      .eq('id', targetExtraction.document_id);

    if (docUpdateError) {
      console.error('❗ Failed to update document status after conflict resolution:', docUpdateError.message);
    }

    // Update project status if we have risk assessment
    if (merged.quantitativeRiskAssessment) {
      const { error: projectUpdateError } = await supabase
        .from('projects')
        .update({
          status: 'completed',
          risk_score:
            (merged.quantitativeRiskAssessment.normalized_score ?? 0) / 10,
          risk_band: merged.quantitativeRiskAssessment.risk_band,
        })
        .eq('id', projectId);

      if (projectUpdateError) {
        console.error('❗ Failed to update project risk score after conflict resolution:', projectUpdateError.message);
      }
    }

    console.log(
      `Conflict resolved for extraction ${extractionId}. ` +
        `Years with resolutions: ${Object.keys(resolutions).join(', ')}`
    );

    return NextResponse.json({
      success: true,
      data: {
        message: 'Conflicts resolved successfully',
        projectId,
        extractionId,
        financialMetrics: merged,
        resolvedYears: Object.keys(resolutions),
      },
    });
  } catch (error) {
    console.error('Error resolving conflicts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/resolve-conflict
 * Cancel the conflict resolution and optionally delete the pending extraction
 */
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();

  let body: {
    extractionId?: string;
    documentId?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { extractionId, documentId } = body;

  try {
    // Delete the pending extraction if provided
    if (extractionId) {
      const { error: deleteExtractionError } = await supabase
        .from('extractions')
        .delete()
        .eq('id', extractionId)
        .eq('user_id', userId);

      if (deleteExtractionError) {
        console.error('Error deleting extraction:', deleteExtractionError);
      }
    }

    // Delete the pending document if provided
    if (documentId) {
      // Get the document to find storage path
      const { data: doc } = await supabase
        .from('documents')
        .select('storage_path')
        .eq('id', documentId)
        .eq('user_id', userId)
        .single();

      if (doc?.storage_path) {
        // Delete from storage
        await supabase.storage
          .from('financial-documents')
          .remove([doc.storage_path]);
      }

      // Delete document record
      const { error: deleteDocError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId)
        .eq('user_id', userId);

      if (deleteDocError) {
        console.error('Error deleting document:', deleteDocError);
      }
    }

    console.log(
      `Conflict resolution cancelled. Extraction: ${extractionId}, Document: ${documentId}`
    );

    return NextResponse.json({
      success: true,
      message: 'Upload cancelled and data cleaned up',
    });
  } catch (error) {
    console.error('Error cancelling conflict resolution:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
