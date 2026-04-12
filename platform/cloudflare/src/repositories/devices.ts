import type { D1Database } from "../bindings"
import { assertD1Changed, assertD1Success, selectAll } from "../lib/d1"
import type {
  ShadowDeviceListEntry,
  ShadowDeviceRow,
  ShadowDeviceSnapshot,
} from "../types/shadow-state"

interface ShadowDeviceDatabaseRow {
  id: string
  user_id: string
  device_id: string
  identity_mode: ShadowDeviceRow["identityMode"]
  label: string
  platform: string | null
  browser_family: string | null
  app_kind: string
  app_version: string | null
  first_seen_at: string
  last_seen_at: string
  last_sync_at: string | null
  status: ShadowDeviceRow["status"]
  revoked_at: string | null
  updated_at: string
  shadow_updated_at: string
}

const SHADOW_DEVICE_SELECT = `
  SELECT
    id,
    user_id,
    device_id,
    identity_mode,
    label,
    platform,
    browser_family,
    app_kind,
    app_version,
    first_seen_at,
    last_seen_at,
    last_sync_at,
    status,
    revoked_at,
    updated_at,
    shadow_updated_at
  FROM shadow_devices
`

export function buildShadowDevicePrimaryKey(userId: string, deviceId: string): string {
  return `${userId}:${deviceId}`
}

function normalizeShadowDevice(snapshot: ShadowDeviceSnapshot): ShadowDeviceRow {
  return {
    ...snapshot,
    id: buildShadowDevicePrimaryKey(snapshot.userId, snapshot.deviceId),
    platform: snapshot.platform ?? null,
    browserFamily: snapshot.browserFamily ?? null,
    appVersion: snapshot.appVersion ?? null,
    lastSyncAt: snapshot.lastSyncAt ?? null,
    revokedAt: snapshot.revokedAt ?? null,
    shadowUpdatedAt: snapshot.shadowUpdatedAt ?? new Date().toISOString(),
  }
}

function mapShadowDeviceRow(row: ShadowDeviceDatabaseRow): ShadowDeviceRow {
  return {
    id: row.id,
    userId: row.user_id,
    deviceId: row.device_id,
    identityMode: row.identity_mode,
    label: row.label,
    platform: row.platform,
    browserFamily: row.browser_family,
    appKind: row.app_kind,
    appVersion: row.app_version,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    lastSyncAt: row.last_sync_at,
    status: row.status,
    revokedAt: row.revoked_at,
    updatedAt: row.updated_at,
    shadowUpdatedAt: row.shadow_updated_at,
  }
}

export async function upsertShadowDevice(
  db: D1Database,
  snapshot: ShadowDeviceSnapshot,
): Promise<ShadowDeviceRow> {
  const row = normalizeShadowDevice(snapshot)

  const result = await db.prepare(`
    INSERT INTO shadow_devices (
      id,
      user_id,
      device_id,
      identity_mode,
      label,
      platform,
      browser_family,
      app_kind,
      app_version,
      first_seen_at,
      last_seen_at,
      last_sync_at,
      status,
      revoked_at,
      updated_at,
      shadow_updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      user_id = excluded.user_id,
      device_id = excluded.device_id,
      identity_mode = excluded.identity_mode,
      label = excluded.label,
      platform = excluded.platform,
      browser_family = excluded.browser_family,
      app_kind = excluded.app_kind,
      app_version = excluded.app_version,
      first_seen_at = excluded.first_seen_at,
      last_seen_at = excluded.last_seen_at,
      last_sync_at = excluded.last_sync_at,
      status = excluded.status,
      revoked_at = excluded.revoked_at,
      updated_at = excluded.updated_at,
      shadow_updated_at = excluded.shadow_updated_at
  `)
    .bind(
      row.id,
      row.userId,
      row.deviceId,
      row.identityMode,
      row.label,
      row.platform,
      row.browserFamily,
      row.appKind,
      row.appVersion,
      row.firstSeenAt,
      row.lastSeenAt,
      row.lastSyncAt,
      row.status,
      row.revokedAt,
      row.updatedAt,
      row.shadowUpdatedAt,
    )
    .run()
  assertD1Success(result, "upsert shadow device")

  return row
}

export async function getShadowDevice(
  db: D1Database,
  userId: string,
  deviceId: string,
): Promise<ShadowDeviceRow | null> {
  const row = await db.prepare<ShadowDeviceDatabaseRow>(`
    ${SHADOW_DEVICE_SELECT}
    WHERE user_id = ? AND device_id = ?
  `)
    .bind(userId, deviceId)
    .first<ShadowDeviceDatabaseRow>()

  return row ? mapShadowDeviceRow(row) : null
}

export async function listShadowDevicesForUser(
  db: D1Database,
  userId: string,
  currentDeviceId?: string,
  identityMode?: ShadowDeviceRow["identityMode"],
): Promise<ShadowDeviceListEntry[]> {
  const rows = await selectAll<ShadowDeviceDatabaseRow>(
    db,
    `
      ${SHADOW_DEVICE_SELECT}
      WHERE user_id = ?
        AND (? IS NULL OR identity_mode = ?)
      ORDER BY last_seen_at DESC
    `,
    [userId, identityMode ?? null, identityMode ?? null],
  )

  return rows.map((row) => ({
    deviceId: row.device_id,
    label: row.label,
    platform: row.platform,
    browserFamily: row.browser_family,
    appKind: row.app_kind,
    appVersion: row.app_version,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    lastSyncAt: row.last_sync_at,
    status: row.status,
    isCurrentDevice: row.device_id === currentDeviceId,
  }))
}

export async function listShadowDeviceRowsForUser(
  db: D1Database,
  userId: string,
): Promise<ShadowDeviceRow[]> {
  const rows = await selectAll<ShadowDeviceDatabaseRow>(
    db,
    `
      ${SHADOW_DEVICE_SELECT}
      WHERE user_id = ?
      ORDER BY device_id ASC
    `,
    [userId],
  )

  return rows.map(mapShadowDeviceRow)
}

export async function touchShadowDevice(
  db: D1Database,
  params: {
    userId: string
    deviceId: string
    lastSeenAt?: string
    lastSyncAt?: string
    reactivate?: boolean
    shadowUpdatedAt?: string
  },
): Promise<void> {
  const touchTimestamp = params.shadowUpdatedAt ?? params.lastSyncAt ?? params.lastSeenAt ?? new Date().toISOString()

  const result = await db.prepare(`
    UPDATE shadow_devices
    SET
      last_seen_at = CASE
        WHEN ? IS NOT NULL AND (? > last_seen_at)
          THEN ?
        ELSE last_seen_at
      END,
      last_sync_at = CASE
        WHEN ? IS NOT NULL AND (last_sync_at IS NULL OR ? > last_sync_at)
          THEN ?
        ELSE last_sync_at
      END,
      updated_at = CASE
        WHEN ? > updated_at
          THEN ?
        ELSE updated_at
      END,
      status = CASE WHEN ? THEN 'active' ELSE status END,
      revoked_at = CASE WHEN ? THEN NULL ELSE revoked_at END,
      shadow_updated_at = ?
    WHERE user_id = ? AND device_id = ?
  `)
    .bind(
      params.lastSeenAt ?? null,
      params.lastSeenAt ?? null,
      params.lastSeenAt ?? null,
      params.lastSyncAt ?? null,
      params.lastSyncAt ?? null,
      params.lastSyncAt ?? null,
      touchTimestamp,
      touchTimestamp,
      params.reactivate ? 1 : 0,
      params.reactivate ? 1 : 0,
      touchTimestamp,
      params.userId,
      params.deviceId,
    )
    .run()
  assertD1Success(result, "touch shadow device")
  assertD1Changed(result, "touch shadow device")
}

export async function revokeShadowDevice(
  db: D1Database,
  params: {
    userId: string
    deviceId: string
    revokedAt: string
    shadowUpdatedAt?: string
  },
): Promise<void> {
  const result = await db.prepare(`
    UPDATE shadow_devices
    SET
      status = 'revoked',
      revoked_at = COALESCE(revoked_at, ?),
      updated_at = ?,
      shadow_updated_at = ?
    WHERE user_id = ? AND device_id = ?
  `)
    .bind(
      params.revokedAt,
      params.revokedAt,
      params.shadowUpdatedAt ?? params.revokedAt,
      params.userId,
      params.deviceId,
    )
    .run()
  assertD1Success(result, "revoke shadow device")
  assertD1Changed(result, "revoke shadow device")
}
