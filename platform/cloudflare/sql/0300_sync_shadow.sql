CREATE TABLE IF NOT EXISTS shadow_sync_collections (
  user_id TEXT NOT NULL,
  collection TEXT NOT NULL CHECK (collection IN ('config', 'vocabulary', 'reading_history', 'study_progress')),
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  default_enabled INTEGER NOT NULL CHECK (default_enabled IN (0, 1)),
  last_issued_cursor TEXT,
  last_issued_cursor_order INTEGER,
  last_server_updated_at TEXT,
  shadow_updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, collection),
  FOREIGN KEY (user_id) REFERENCES shadow_users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_shadow_sync_collections_user_enabled
  ON shadow_sync_collections (user_id, enabled, collection);

CREATE TABLE IF NOT EXISTS shadow_sync_mutations (
  server_mutation_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  collection TEXT NOT NULL CHECK (collection IN ('config', 'vocabulary', 'reading_history', 'study_progress')),
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

CREATE INDEX IF NOT EXISTS idx_shadow_sync_mutations_user_collection_cursor_order
  ON shadow_sync_mutations (user_id, collection, cursor_order);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shadow_sync_mutations_user_collection_cursor_order_unique
  ON shadow_sync_mutations (user_id, collection, cursor_order);

CREATE INDEX IF NOT EXISTS idx_shadow_sync_mutations_user_collection_record
  ON shadow_sync_mutations (user_id, collection, record_id);

CREATE INDEX IF NOT EXISTS idx_shadow_sync_mutations_user_device_cursor_order
  ON shadow_sync_mutations (user_id, device_id, cursor_order);
