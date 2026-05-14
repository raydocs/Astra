ALTER TABLE article_import_jobs
  ADD COLUMN shadow_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE article_import_jobs
  ADD COLUMN artifact_retention_class TEXT NOT NULL DEFAULT 'import-shadow';

ALTER TABLE article_import_jobs
  ADD COLUMN artifact_retention_until_epoch_ms INTEGER;

ALTER TABLE article_import_jobs
  ADD COLUMN request_object_bytes INTEGER;

ALTER TABLE article_import_jobs
  ADD COLUMN response_object_bytes INTEGER;

ALTER TABLE article_import_jobs
  ADD COLUMN source_object_bytes INTEGER;

ALTER TABLE article_import_jobs
  ADD COLUMN request_object_sha256 TEXT;

ALTER TABLE article_import_jobs
  ADD COLUMN response_object_sha256 TEXT;

ALTER TABLE article_import_jobs
  ADD COLUMN source_object_sha256 TEXT;

ALTER TABLE article_import_jobs
  ADD COLUMN last_failure_error_code TEXT;

ALTER TABLE article_import_jobs
  ADD COLUMN dead_lettered_at_epoch_ms INTEGER;

ALTER TABLE article_import_jobs
  ADD COLUMN replay_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE article_import_jobs
  ADD COLUMN last_replayed_at_epoch_ms INTEGER;

ALTER TABLE article_import_jobs
  ADD COLUMN last_replay_reason TEXT;

ALTER TABLE article_import_jobs
  ADD COLUMN last_replayed_by TEXT;

CREATE INDEX IF NOT EXISTS idx_article_import_jobs_status_replayable
  ON article_import_jobs (status, updated_at_epoch_ms);

CREATE INDEX IF NOT EXISTS idx_article_import_jobs_dead_lettered_at
  ON article_import_jobs (dead_lettered_at_epoch_ms, updated_at_epoch_ms);
