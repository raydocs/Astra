PRAGMA foreign_keys=off;

CREATE TABLE shadow_sync_collections_new (
  user_id TEXT NOT NULL,
  collection TEXT NOT NULL CHECK (collection IN ('config', 'vocabulary', 'review_schedule', 'reading_history', 'study_progress')),
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  default_enabled INTEGER NOT NULL CHECK (default_enabled IN (0, 1)),
  last_issued_cursor TEXT,
  last_issued_cursor_order INTEGER,
  last_server_updated_at TEXT,
  shadow_updated_at TEXT NOT NULL,
  compaction_floor_cursor TEXT,
  compaction_floor_cursor_order INTEGER,
  last_compacted_at TEXT,
  PRIMARY KEY (user_id, collection),
  FOREIGN KEY (user_id) REFERENCES shadow_users (id) ON DELETE CASCADE
);

INSERT INTO shadow_sync_collections_new (
  user_id,
  collection,
  enabled,
  default_enabled,
  last_issued_cursor,
  last_issued_cursor_order,
  last_server_updated_at,
  shadow_updated_at,
  compaction_floor_cursor,
  compaction_floor_cursor_order,
  last_compacted_at
)
SELECT
  user_id,
  collection,
  enabled,
  default_enabled,
  last_issued_cursor,
  last_issued_cursor_order,
  last_server_updated_at,
  shadow_updated_at,
  compaction_floor_cursor,
  compaction_floor_cursor_order,
  last_compacted_at
FROM shadow_sync_collections;

DROP TABLE shadow_sync_collections;
ALTER TABLE shadow_sync_collections_new RENAME TO shadow_sync_collections;

CREATE INDEX IF NOT EXISTS idx_shadow_sync_collections_user_enabled
  ON shadow_sync_collections (user_id, enabled, collection);

INSERT OR IGNORE INTO shadow_sync_collections (
  user_id,
  collection,
  enabled,
  default_enabled,
  last_issued_cursor,
  last_issued_cursor_order,
  last_server_updated_at,
  shadow_updated_at,
  compaction_floor_cursor,
  compaction_floor_cursor_order,
  last_compacted_at
)
SELECT
  id,
  'review_schedule',
  1,
  1,
  NULL,
  NULL,
  NULL,
  shadow_updated_at,
  NULL,
  NULL,
  NULL
FROM shadow_users;

CREATE TABLE shadow_sync_mutations_new (
  server_mutation_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  collection TEXT NOT NULL CHECK (collection IN ('config', 'vocabulary', 'review_schedule', 'reading_history', 'study_progress')),
  schema_version INTEGER NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('upsert', 'delete')),
  client_mutation_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  client_updated_at TEXT NOT NULL,
  server_updated_at TEXT NOT NULL,
  cursor TEXT NOT NULL,
  cursor_order INTEGER NOT NULL,
  payload_json TEXT,
  shadow_updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES shadow_users (id) ON DELETE CASCADE,
  UNIQUE (user_id, client_mutation_id)
);

INSERT INTO shadow_sync_mutations_new
SELECT * FROM shadow_sync_mutations;

DROP TABLE shadow_sync_mutations;
ALTER TABLE shadow_sync_mutations_new RENAME TO shadow_sync_mutations;

CREATE INDEX IF NOT EXISTS idx_shadow_sync_mutations_user_collection_cursor_order
  ON shadow_sync_mutations (user_id, collection, cursor_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shadow_sync_mutations_user_collection_cursor_order_unique
  ON shadow_sync_mutations (user_id, collection, cursor_order);
CREATE INDEX IF NOT EXISTS idx_shadow_sync_mutations_user_collection_record
  ON shadow_sync_mutations (user_id, collection, record_id);
CREATE INDEX IF NOT EXISTS idx_shadow_sync_mutations_user_device_cursor_order
  ON shadow_sync_mutations (user_id, device_id, cursor_order);

CREATE TABLE shadow_sync_record_state_new (
  user_id TEXT NOT NULL,
  collection TEXT NOT NULL CHECK (collection IN ('config', 'vocabulary', 'review_schedule', 'reading_history', 'study_progress')),
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

INSERT INTO shadow_sync_record_state_new
SELECT * FROM shadow_sync_record_state;

DROP TABLE shadow_sync_record_state;
ALTER TABLE shadow_sync_record_state_new RENAME TO shadow_sync_record_state;

CREATE INDEX IF NOT EXISTS idx_shadow_sync_record_state_user_collection
  ON shadow_sync_record_state (user_id, collection, is_deleted, last_cursor_order);
CREATE INDEX IF NOT EXISTS idx_shadow_sync_record_state_tombstones
  ON shadow_sync_record_state (user_id, collection, is_deleted, tombstone_retained_until);

CREATE TABLE sync_compaction_runs_new (
  run_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  collection TEXT NOT NULL CHECK (collection IN ('config', 'vocabulary', 'review_schedule', 'reading_history', 'study_progress')),
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

INSERT INTO sync_compaction_runs_new
SELECT * FROM sync_compaction_runs;

DROP TABLE sync_compaction_runs;
ALTER TABLE sync_compaction_runs_new RENAME TO sync_compaction_runs;

CREATE INDEX IF NOT EXISTS idx_sync_compaction_runs_user_collection_status
  ON sync_compaction_runs (user_id, collection, status, started_at);

PRAGMA foreign_keys=on;
