CREATE TABLE IF NOT EXISTS shadow_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  billing_email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('free', 'pro')),
  subscription_status TEXT NOT NULL CHECK (subscription_status IN ('active', 'past_due', 'canceled')),
  identity_mode TEXT NOT NULL CHECK (identity_mode IN ('anonymous', 'authenticated')),
  install_id TEXT,
  provider_entitlements_json TEXT NOT NULL,
  reading_history_sync_enabled INTEGER NOT NULL DEFAULT 0 CHECK (reading_history_sync_enabled IN (0, 1)),
  study_progress_sync_enabled INTEGER NOT NULL DEFAULT 0 CHECK (study_progress_sync_enabled IN (0, 1)),
  shadow_updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shadow_users_email
  ON shadow_users (email);

CREATE INDEX IF NOT EXISTS idx_shadow_users_identity_mode
  ON shadow_users (identity_mode, created_at);

CREATE TABLE IF NOT EXISTS shadow_auth_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  identity_mode TEXT NOT NULL CHECK (identity_mode IN ('anonymous', 'authenticated')),
  token_hash TEXT,
  token_hash_alg TEXT,
  issued_at TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_verified_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
  revoked_at TEXT,
  shadow_updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES shadow_users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_shadow_auth_sessions_user_status
  ON shadow_auth_sessions (user_id, status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_shadow_auth_sessions_user_device_status
  ON shadow_auth_sessions (user_id, device_id, status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_shadow_auth_sessions_token_hash
  ON shadow_auth_sessions (token_hash);
