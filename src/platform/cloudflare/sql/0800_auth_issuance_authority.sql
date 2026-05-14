CREATE TABLE IF NOT EXISTS shadow_user_credentials (
  user_id TEXT PRIMARY KEY,
  credential_kind TEXT NOT NULL CHECK (credential_kind IN ('password')),
  password_hash TEXT NOT NULL,
  password_hash_alg TEXT NOT NULL CHECK (password_hash_alg IN ('sha256_v1')),
  updated_at TEXT NOT NULL,
  shadow_updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES shadow_users (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shadow_users_install_id_unique
  ON shadow_users (install_id)
  WHERE install_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth_issue_requests (
  request_key TEXT PRIMARY KEY,
  route_kind TEXT NOT NULL CHECK (route_kind IN ('anonymous', 'session')),
  user_id TEXT,
  install_id TEXT,
  device_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  node_mirror_status TEXT NOT NULL CHECK (node_mirror_status IN ('pending', 'completed', 'failed')),
  created_at TEXT NOT NULL,
  last_attempt_at TEXT NOT NULL,
  completed_at TEXT,
  failed_at TEXT,
  error_code TEXT,
  error_message TEXT,
  shadow_updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES shadow_users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_issue_requests_status_created
  ON auth_issue_requests (node_mirror_status, created_at);

CREATE INDEX IF NOT EXISTS idx_auth_issue_requests_user_route
  ON auth_issue_requests (user_id, route_kind, created_at);

CREATE INDEX IF NOT EXISTS idx_auth_issue_requests_install_route
  ON auth_issue_requests (install_id, route_kind, created_at);
