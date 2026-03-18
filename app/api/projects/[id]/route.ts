import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { z } from 'zod';

const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  company_name: z.string().max(255).nullable().optional(),
  status: z.enum(['draft', 'in_progress', 'completed', 'archived']).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id] - Get a single project with documents and extractions
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();

  const { data: project, error } = await supabase
    .from('projects')
    .select(
      `
      *,
      documents (
        id,
        file_name,
        original_file_name,
        file_type,
        file_size,
        storage_path,
        processing_status,
        error_message,
        created_at,
        updated_at
      ),
      extractions (
        id,
        document_id,
        extraction_data,
        fiscal_years,
        latest_fccr,
        latest_dscr,
        latest_senior_debt_to_ebitda,
        latest_debt_to_capital,
        latest_adjusted_ebitda,
        quantitative_risk_score,
        quantitative_risk_band,
        validation_issues,
        processing_time_ms,
        created_at,
        updated_at
      )
    `
    )
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    console.error('Failed to fetch project:', error);
    return NextResponse.json({ error: 'Failed to load project' }, { status: 500 });
  }

  return NextResponse.json(project);
}

// PATCH /api/projects/[id] - Update a project
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = updateProjectSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { data: project, error } = await supabase
    .from('projects')
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }
    console.error('Failed to update project:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }

  return NextResponse.json(project);
}

// DELETE /api/projects/[id] - Delete a project
export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();

  // First, get the project to find associated files in storage
  const { data: project, error: fetchError } = await supabase
    .from('projects')
    .select('id, documents(storage_path)')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    console.error('Failed to fetch project for deletion:', fetchError);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }

  // Delete files from storage — use admin client to bypass RLS UUID casting issue
  if (project?.documents && project.documents.length > 0) {
    const adminSupabase = createAdminClient();
    const storagePaths = project.documents.map(
      (doc: { storage_path: string }) => doc.storage_path
    );
    await adminSupabase.storage.from('financial-documents').remove(storagePaths);
  }

  // Delete the project (cascade will handle documents and extractions)
  const { error: deleteError } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (deleteError) {
    console.error('Failed to delete project:', deleteError);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Project deleted successfully' });
}
