ALTER TABLE shadow_sync_collections ADD COLUMN compaction_floor_cursor TEXT;
ALTER TABLE shadow_sync_collections ADD COLUMN compaction_floor_cursor_order INTEGER;
ALTER TABLE shadow_sync_collections ADD COLUMN last_compacted_at TEXT;

CREATE TABLE IF NOT EXISTS shadow_sync_record_state (
  user_id TEXT NOT NULL,
  collection TEXT NOT NULL CHECK (collection IN ('config', 'vocabulary', 'reading_history', 'study_progress')),
  record_id TEXT NOT NULL,
  is_deleted INTEGER NOT NULL CHECK (is_deleted IN (0, 1)),
  payload_json TEXT,
  last_client_mutation_id TEXT NOT NULL,
  last_device_id TEXT NOT NULL,
  last_server_updated_at TEXT NOT NULL,
  last_cursor TEXT NOT NULL,
  last_cursor_order INTEGER NOT NULL,
  tombstone_retained_until TEXT,
  shadow_updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, collection, record_id),
  FOREIGN KEY (user_id) REFERENCES shadow_users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_shadow_sync_record_state_user_collection
  ON shadow_sync_record_state (user_id, collection, is_deleted, last_cursor_order);

CREATE INDEX IF NOT EXISTS idx_shadow_sync_record_state_tombstones
  ON shadow_sync_record_state (user_id, collection, is_deleted, tombstone_retained_until);

CREATE TABLE IF NOT EXISTS sync_compaction_runs (
  run_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  collection TEXT NOT NULL CHECK (collection IN ('config', 'vocabulary', 'reading_history', 'study_progress')),
  status TEXT NOT NULL,
  cutoff_cursor_order INTEGER NOT NULL,
  floor_cursor TEXT,
  floor_cursor_order INTEGER,
  mutations_scanned INTEGER NOT NULL,
  mutations_deleted INTEGER NOT NULL,
  records_materialized INTEGER NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  error_code TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_compaction_runs_user_collection_status
  ON sync_compaction_runs (user_id, collection, status, started_at);
