PRAGMA foreign_keys = OFF;

CREATE TABLE article_import_jobs_v2 (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('received', 'queued', 'consumed', 'completed', 'failed', 'skipped', 'dead_lettered')),
  mode TEXT NOT NULL,
  route TEXT NOT NULL DEFAULT 'proxy',
  surface TEXT NOT NULL DEFAULT 'unspecified',
  target_hostname TEXT,
  decision_reason TEXT DEFAULT 'legacy_migration',
  fallback_reason TEXT,
  request_hash TEXT NOT NULL,
  request_object_key TEXT,
  response_object_key TEXT,
  source_object_key TEXT,
  idempotency_key TEXT,
  content_type TEXT,
  content_length INTEGER,
  proxy_status INTEGER,
  trace_id TEXT NOT NULL,
  error_code TEXT,
  queue_attempt_count INTEGER NOT NULL DEFAULT 0,
  last_queue_attempt_epoch_ms INTEGER,
  consumed_at_epoch_ms INTEGER,
  created_at_epoch_ms INTEGER NOT NULL,
  updated_at_epoch_ms INTEGER NOT NULL
);

INSERT INTO article_import_jobs_v2 (
  id,
  status,
  mode,
  route,
  surface,
  target_hostname,
  decision_reason,
  fallback_reason,
  request_hash,
  request_object_key,
  response_object_key,
  source_object_key,
  idempotency_key,
  content_type,
  content_length,
  proxy_status,
  trace_id,
  error_code,
  queue_attempt_count,
  last_queue_attempt_epoch_ms,
  consumed_at_epoch_ms,
  created_at_epoch_ms,
  updated_at_epoch_ms
)
SELECT
  id,
  status,
  mode,
  CASE
    WHEN mode = 'native' AND source_object_key IS NOT NULL THEN 'native'
    WHEN mode = 'native' THEN 'native-fallback-proxy'
    WHEN mode = 'shadow' THEN 'shadow-proxy'
    ELSE 'proxy'
  END AS route,
  'unspecified' AS surface,
  NULL AS target_hostname,
  'legacy_migration' AS decision_reason,
  NULL AS fallback_reason,
  request_hash,
  request_object_key,
  response_object_key,
  source_object_key,
  idempotency_key,
  content_type,
  content_length,
  proxy_status,
  trace_id,
  error_code,
  0 AS queue_attempt_count,
  NULL AS last_queue_attempt_epoch_ms,
  CASE WHEN status = 'consumed' THEN updated_at_epoch_ms ELSE NULL END AS consumed_at_epoch_ms,
  created_at_epoch_ms,
  updated_at_epoch_ms
FROM article_import_jobs;

DROP TABLE article_import_jobs;
ALTER TABLE article_import_jobs_v2 RENAME TO article_import_jobs;

CREATE INDEX idx_article_import_jobs_status_created
  ON article_import_jobs (status, created_at_epoch_ms);

CREATE INDEX idx_article_import_jobs_request_hash_created
  ON article_import_jobs (request_hash, created_at_epoch_ms);

CREATE INDEX idx_article_import_jobs_trace_id
  ON article_import_jobs (trace_id);

CREATE INDEX idx_article_import_jobs_route_created
  ON article_import_jobs (route, created_at_epoch_ms);

CREATE INDEX idx_article_import_jobs_surface_created
  ON article_import_jobs (surface, created_at_epoch_ms);

CREATE INDEX idx_article_import_jobs_target_host_created
  ON article_import_jobs (target_hostname, created_at_epoch_ms);

PRAGMA foreign_keys = ON;
