CREATE TABLE IF NOT EXISTS platform_route_events (
  id TEXT PRIMARY KEY,
  occurred_at_epoch_ms INTEGER NOT NULL,
  environment TEXT NOT NULL,
  domain TEXT NOT NULL,
  event_kind TEXT NOT NULL CHECK (event_kind IN ('route', 'parity_mismatch', 'compare_failed', 'operator_action')),
  route TEXT,
  mode TEXT,
  fallback_reason TEXT,
  response_status INTEGER,
  scope TEXT,
  outcome TEXT,
  request_id TEXT,
  metadata_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_platform_route_events_occurred
  ON platform_route_events (occurred_at_epoch_ms DESC);

CREATE INDEX IF NOT EXISTS idx_platform_route_events_domain_kind
  ON platform_route_events (domain, event_kind, occurred_at_epoch_ms DESC);

CREATE INDEX IF NOT EXISTS idx_platform_route_events_request
  ON platform_route_events (request_id, occurred_at_epoch_ms DESC);
