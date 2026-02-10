import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/utils/supabase/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// DELETE /api/documents/[id] - Delete a document and its extraction
export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();

  // Get the document to verify ownership and get storage path
  const { data: document, error: fetchError } = await supabase
    .from('documents')
    .select('id, storage_path, project_id, user_id')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  // Delete file from storage
  if (document.storage_path) {
    const { error: storageError } = await supabase.storage
      .from('financial-documents')
      .remove([document.storage_path]);

    if (storageError) {
      console.error('Failed to delete file from storage:', storageError);
      // Continue with database deletion even if storage deletion fails
    }
  }

  // Delete the document (cascade will handle the extraction)
  const { error: deleteError } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({
    message: 'Document deleted successfully',
    project_id: document.project_id,
  });
}
