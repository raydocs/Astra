ALTER TABLE shadow_users
  ADD COLUMN weekly_digest_sync_enabled INTEGER NOT NULL DEFAULT 1 CHECK (weekly_digest_sync_enabled IN (0, 1));
