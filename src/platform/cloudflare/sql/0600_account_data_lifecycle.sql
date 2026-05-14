CREATE TABLE IF NOT EXISTS account_export_jobs (
  job_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  requested_by_device_id TEXT NOT NULL,
  scope_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'expired')),
  requested_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  failed_at TEXT,
  expires_at TEXT,
  artifact_object_key TEXT,
  artifact_sha256 TEXT,
  artifact_bytes INTEGER,
  error_code TEXT,
  error_message TEXT,
  shadow_updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES shadow_users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_account_export_jobs_user_requested_at
  ON account_export_jobs (user_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_export_jobs_status_requested_at
  ON account_export_jobs (status, requested_at DESC);

CREATE TABLE IF NOT EXISTS account_data_delete_jobs (
  job_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  requested_by_device_id TEXT NOT NULL,
  scope_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'scheduled', 'running', 'completed', 'failed', 'canceled')),
  requested_at TEXT NOT NULL,
  scheduled_for_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  failed_at TEXT,
  canceled_at TEXT,
  grace_period_seconds INTEGER NOT NULL,
  deleted_records_json TEXT,
  error_code TEXT,
  error_message TEXT,
  shadow_updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES shadow_users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_account_data_delete_jobs_user_requested_at
  ON account_data_delete_jobs (user_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_data_delete_jobs_status_scheduled
  ON account_data_delete_jobs (status, scheduled_for_at ASC);
