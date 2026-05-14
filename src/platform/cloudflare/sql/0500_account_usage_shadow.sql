CREATE TABLE IF NOT EXISTS shadow_user_usage (
  user_id TEXT PRIMARY KEY,
  usage_day TEXT NOT NULL,
  daily_requests_limit INTEGER NOT NULL,
  daily_characters_limit INTEGER NOT NULL,
  requests_per_minute_limit INTEGER NOT NULL,
  requests_today INTEGER NOT NULL DEFAULT 0,
  characters_today INTEGER NOT NULL DEFAULT 0,
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_characters INTEGER NOT NULL DEFAULT 0,
  last_request_at TEXT,
  recent_events_json TEXT NOT NULL,
  shadow_updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES shadow_users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_shadow_user_usage_usage_day
  ON shadow_user_usage (usage_day, shadow_updated_at DESC);
