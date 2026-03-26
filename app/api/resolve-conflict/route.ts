import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { z } from 'zod';
import {
  mergeExtractions,
  type ExtractionWithDocument,
  type ConflictResolution,
} from '@/lib/extraction-utils';
import { logger } from '@/lib/logger';

// UUID v4 regex for validating IDs
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const resolveConflictSchema = z.object({
  extractionId: z.string().regex(uuidRegex, 'Invalid extraction ID format'),
  projectId: z.string().regex(uuidRegex, 'Invalid project ID format'),
  resolutions: z.record(z.string(), z.enum(['keep', 'overwrite'])),
});

const deleteConflictSchema = z.object({
  extractionId: z.string().regex(uuidRegex, 'Invalid extraction ID format').optional(),
  documentId: z.string().regex(uuidRegex, 'Invalid document ID format').optional(),
});

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

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = resolveConflictSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { extractionId, projectId, resolutions } = parsed.data as {
    extractionId: string;
    projectId: string;
    resolutions: ConflictResolution;
  };

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
      .eq('id', targetExtraction.document_id)
      .eq('user_id', userId);

    if (docUpdateError) {
      logger.error('Failed to update document status after conflict resolution', { error: docUpdateError.message, documentId: targetExtraction.document_id });
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
        .eq('id', projectId)
        .eq('user_id', userId);

      if (projectUpdateError) {
        logger.error('Failed to update project risk score after conflict resolution', { error: projectUpdateError.message, projectId });
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

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = deleteConflictSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { extractionId, documentId } = parsed.data;

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
        // Delete from storage (use admin client to bypass RLS UUID casting issues)
        const adminSupabase = createAdminClient();
        await adminSupabase.storage
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
