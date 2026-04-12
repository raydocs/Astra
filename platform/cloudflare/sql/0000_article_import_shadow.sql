CREATE TABLE IF NOT EXISTS article_import_jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('received', 'queued', 'consumed', 'failed', 'skipped')),
  mode TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  request_object_key TEXT,
  idempotency_key TEXT,
  content_type TEXT,
  content_length INTEGER,
  proxy_status INTEGER,
  trace_id TEXT NOT NULL,
  error_code TEXT,
  created_at_epoch_ms INTEGER NOT NULL,
  updated_at_epoch_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_article_import_jobs_status_created
  ON article_import_jobs (status, created_at_epoch_ms);

CREATE INDEX IF NOT EXISTS idx_article_import_jobs_request_hash_created
  ON article_import_jobs (request_hash, created_at_epoch_ms);

CREATE INDEX IF NOT EXISTS idx_article_import_jobs_trace_id
  ON article_import_jobs (trace_id);
