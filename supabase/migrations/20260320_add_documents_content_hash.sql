-- Add content_hash column for duplicate document detection.
-- SHA-256 hex digest (64 chars) computed from the raw file buffer before extraction.
-- Indexed per-project to enable fast duplicate lookups without full table scans.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Composite index: project-scoped duplicate lookups hit this index directly.
CREATE INDEX IF NOT EXISTS idx_documents_project_content_hash
  ON documents (project_id, content_hash)
  WHERE content_hash IS NOT NULL;
