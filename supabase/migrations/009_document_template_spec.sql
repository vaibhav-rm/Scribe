-- ---------------------------------------------------------------
-- 009: Preserve template formatting after document edits
-- ---------------------------------------------------------------
-- The generated DOCX is cached, but any edit invalidates that cache. When the
-- document is re-exported we must rebuild it with the same template spec, not
-- fall back to default margins/fonts. Store the applied spec with the document.

alter table public.generated_documents
  add column if not exists template_spec jsonb;
