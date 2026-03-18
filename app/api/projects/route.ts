import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/utils/supabase/server';
import { z } from 'zod';

const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(255),
  description: z.string().max(2000).optional(),
  company_name: z.string().max(255).optional(),
});

// GET /api/projects - List all projects for the current user
export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();

  const { data: projects, error } = await supabase
    .from('projects')
    .select(
      `
      *,
      documents (
        id,
        file_name,
        processing_status,
        created_at
      ),
      extractions (
        id,
        fiscal_years,
        latest_fccr,
        latest_dscr,
        quantitative_risk_score,
        quantitative_risk_band,
        created_at
      )
    `
    )
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch projects:', error);
    return NextResponse.json({ error: 'Failed to load projects' }, { status: 500 });
  }

  return NextResponse.json(projects);
}

// POST /api/projects - Create a new project
export async function POST(request: Request) {
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

  const parsed = createProjectSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { name, description, company_name } = parsed.data;

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      name,
      description: description ?? null,
      company_name: company_name ?? null,
      status: 'draft',
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }

  return NextResponse.json(project, { status: 201 });
}
