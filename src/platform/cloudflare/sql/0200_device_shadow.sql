CREATE TABLE IF NOT EXISTS shadow_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  identity_mode TEXT NOT NULL CHECK (identity_mode IN ('anonymous', 'authenticated')),
  label TEXT NOT NULL,
  platform TEXT,
  browser_family TEXT,
  app_kind TEXT NOT NULL,
  app_version TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_sync_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
  revoked_at TEXT,
  updated_at TEXT NOT NULL,
  shadow_updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES shadow_users (id) ON DELETE CASCADE,
  UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_shadow_devices_user_seen
  ON shadow_devices (user_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_shadow_devices_user_status_seen
  ON shadow_devices (user_id, status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_shadow_devices_user_device
  ON shadow_devices (user_id, device_id);
