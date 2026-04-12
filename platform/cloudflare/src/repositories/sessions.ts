import type { D1Database } from "../bindings"
import { assertD1Changed, assertD1Success, selectAll } from "../lib/d1"
import type { ShadowSessionRow, ShadowSessionSnapshot } from "../types/shadow-state"

interface ShadowSessionDatabaseRow {
  session_id: string
  user_id: string
  device_id: string
  identity_mode: ShadowSessionRow["identityMode"]
  token_hash: string | null
  token_hash_alg: string | null
  issued_at: string
  expires_at: string | null
  created_at: string
  last_seen_at: string
  last_verified_at: string | null
  status: ShadowSessionRow["status"]
  revoked_at: string | null
  shadow_updated_at: string
}

const SHADOW_SESSION_SELECT = `
  SELECT
    session_id,
    user_id,
    device_id,
    identity_mode,
    token_hash,
    token_hash_alg,
    issued_at,
    expires_at,
    created_at,
    last_seen_at,
    last_verified_at,
    status,
    revoked_at,
    shadow_updated_at
  FROM shadow_auth_sessions
`

function normalizeShadowSession(snapshot: ShadowSessionSnapshot): ShadowSessionRow {
  return {
    ...snapshot,
    expiresAt: snapshot.expiresAt ?? null,
    lastVerifiedAt: snapshot.lastVerifiedAt ?? null,
    revokedAt: snapshot.revokedAt ?? null,
    tokenHash: snapshot.tokenHash ?? null,
    tokenHashAlg: snapshot.tokenHash ? (snapshot.tokenHashAlg ?? "sha256") : null,
    shadowUpdatedAt: snapshot.shadowUpdatedAt ?? new Date().toISOString(),
  }
}

function mapShadowSessionRow(row: ShadowSessionDatabaseRow): ShadowSessionRow {
  return {
    sessionId: row.session_id,
    userId: row.user_id,
    deviceId: row.device_id,
    identityMode: row.identity_mode,
    tokenHash: row.token_hash,
    tokenHashAlg: row.token_hash_alg,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    lastVerifiedAt: row.last_verified_at,
    status: row.status,
    revokedAt: row.revoked_at,
    shadowUpdatedAt: row.shadow_updated_at,
  }
}

export async function upsertShadowSession(
  db: D1Database,
  snapshot: ShadowSessionSnapshot,
): Promise<ShadowSessionRow> {
  const row = normalizeShadowSession(snapshot)

  const result = await db.prepare(`
    INSERT INTO shadow_auth_sessions (
      session_id,
      user_id,
      device_id,
      identity_mode,
      token_hash,
      token_hash_alg,
      issued_at,
      expires_at,
      created_at,
      last_seen_at,
      last_verified_at,
      status,
      revoked_at,
      shadow_updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      user_id = excluded.user_id,
      device_id = excluded.device_id,
      identity_mode = excluded.identity_mode,
      token_hash = excluded.token_hash,
      token_hash_alg = excluded.token_hash_alg,
      issued_at = excluded.issued_at,
      expires_at = excluded.expires_at,
      created_at = excluded.created_at,
      last_seen_at = excluded.last_seen_at,
      last_verified_at = excluded.last_verified_at,
      status = excluded.status,
      revoked_at = excluded.revoked_at,
      shadow_updated_at = excluded.shadow_updated_at
  `)
    .bind(
      row.sessionId,
      row.userId,
      row.deviceId,
      row.identityMode,
      row.tokenHash,
      row.tokenHashAlg,
      row.issuedAt,
      row.expiresAt,
      row.createdAt,
      row.lastSeenAt,
      row.lastVerifiedAt,
      row.status,
      row.revokedAt,
      row.shadowUpdatedAt,
    )
    .run()
  assertD1Success(result, "upsert shadow session")

  return row
}

export async function getShadowSessionById(
  db: D1Database,
  sessionId: string,
): Promise<ShadowSessionRow | null> {
  const row = await db.prepare<ShadowSessionDatabaseRow>(`
    ${SHADOW_SESSION_SELECT}
    WHERE session_id = ?
  `)
    .bind(sessionId)
    .first<ShadowSessionDatabaseRow>()

  return row ? mapShadowSessionRow(row) : null
}

export async function getShadowSessionByTokenHash(
  db: D1Database,
  params: {
    userId: string
    tokenHash: string
    requireActive?: boolean
    now?: string
  },
): Promise<ShadowSessionRow | null> {
  const now = params.now ?? new Date().toISOString()

  const row = await db.prepare<ShadowSessionDatabaseRow>(`
    ${SHADOW_SESSION_SELECT}
    WHERE
      user_id = ?
      AND token_hash = ?
      AND (
        ? = 0
        OR (
          status = 'active'
          AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > ?)
        )
      )
    ORDER BY last_seen_at DESC
    LIMIT 1
  `)
    .bind(params.userId, params.tokenHash, params.requireActive === false ? 0 : 1, now)
    .first<ShadowSessionDatabaseRow>()

  return row ? mapShadowSessionRow(row) : null
}

export async function listShadowSessionsForUser(
  db: D1Database,
  userId: string,
): Promise<ShadowSessionRow[]> {
  const rows = await selectAll<ShadowSessionDatabaseRow>(
    db,
    `
      ${SHADOW_SESSION_SELECT}
      WHERE user_id = ?
      ORDER BY created_at ASC, session_id ASC
    `,
    [userId],
  )

  return rows.map(mapShadowSessionRow)
}

export async function listShadowSessionsForDevice(
  db: D1Database,
  userId: string,
  deviceId: string,
): Promise<ShadowSessionRow[]> {
  const rows = await selectAll<ShadowSessionDatabaseRow>(
    db,
    `
      ${SHADOW_SESSION_SELECT}
      WHERE user_id = ? AND device_id = ?
      ORDER BY created_at ASC, session_id ASC
    `,
    [userId, deviceId],
  )

  return rows.map(mapShadowSessionRow)
}

export async function touchShadowSession(
  db: D1Database,
  params: {
    sessionId: string
    lastSeenAt?: string
    lastVerifiedAt?: string | null
    shadowUpdatedAt?: string
  },
): Promise<void> {
  const shadowUpdatedAt = params.shadowUpdatedAt ?? params.lastSeenAt ?? new Date().toISOString()
  const hasLastVerifiedAt = Object.prototype.hasOwnProperty.call(params, "lastVerifiedAt")

  const result = await db.prepare(`
    UPDATE shadow_auth_sessions
    SET
      last_seen_at = CASE
        WHEN ? IS NOT NULL AND (? > last_seen_at)
          THEN ?
        ELSE last_seen_at
      END,
      last_verified_at = CASE
        WHEN ? AND ? IS NOT NULL AND (last_verified_at IS NULL OR ? > last_verified_at)
          THEN ?
        ELSE last_verified_at
      END,
      shadow_updated_at = ?
    WHERE session_id = ?
  `)
    .bind(
      params.lastSeenAt ?? null,
      params.lastSeenAt ?? null,
      params.lastSeenAt ?? null,
      hasLastVerifiedAt ? 1 : 0,
      params.lastVerifiedAt ?? null,
      params.lastVerifiedAt ?? null,
      params.lastVerifiedAt ?? null,
      shadowUpdatedAt,
      params.sessionId,
    )
    .run()
  assertD1Success(result, "touch shadow session")
  assertD1Changed(result, "touch shadow session")
}

export async function revokeShadowSession(
  db: D1Database,
  params: {
    sessionId: string
    revokedAt: string
    lastVerifiedAt?: string | null
    shadowUpdatedAt?: string
  },
): Promise<void> {
  const hasLastVerifiedAt = Object.prototype.hasOwnProperty.call(params, "lastVerifiedAt")

  const result = await db.prepare(`
    UPDATE shadow_auth_sessions
    SET
      status = 'revoked',
      revoked_at = COALESCE(revoked_at, ?),
      last_verified_at = CASE WHEN ? THEN ? ELSE last_verified_at END,
      shadow_updated_at = ?
    WHERE session_id = ?
  `)
    .bind(
      params.revokedAt,
      hasLastVerifiedAt ? 1 : 0,
      params.lastVerifiedAt ?? null,
      params.shadowUpdatedAt ?? params.revokedAt,
      params.sessionId,
    )
    .run()
  assertD1Success(result, "revoke shadow session")
  assertD1Changed(result, "revoke shadow session")
}
