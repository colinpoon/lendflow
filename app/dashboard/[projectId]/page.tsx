import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import ProjectDetail from '@/components/ProjectDetail';
import { mergeExtractions, getDocumentYearCoverage } from '@/lib/extraction-utils';

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectPage({ params }: PageProps) {
  const { projectId } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const supabase = await createClient();

  // Fetch project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();

  if (projectError || !project) {
    notFound();
  }

  // Fetch ALL extractions for this project (with document info)
  const { data: extractions } = await supabase
    .from('extractions')
    .select(`
      *,
      documents (
        id,
        file_name
      )
    `)
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  // Merge extractions (newest document wins for overlapping years)
  const mergedData = mergeExtractions(extractions || []);
  const documentCoverage = getDocumentYearCoverage(extractions || []);

  return (
    <ProjectDetail
      project={project}
      mergedData={mergedData}
      documentCoverage={documentCoverage}
      extractionCount={extractions?.length || 0}
    />
  );
}
