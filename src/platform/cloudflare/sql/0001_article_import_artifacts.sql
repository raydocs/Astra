ALTER TABLE article_import_jobs
  ADD COLUMN response_object_key TEXT;

ALTER TABLE article_import_jobs
  ADD COLUMN source_object_key TEXT;
