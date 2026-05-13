import type { D1Database } from "../bindings"
import {
  assertD1Success,
  fromSqlBoolean,
  parseJsonColumn,
  selectAll,
  serializeJsonColumn,
  toSqlBoolean,
} from "../lib/d1"
import type {
  ShadowSyncBootstrap,
  ShadowSyncCollection,
  ShadowSyncCollectionRow,
  ShadowSyncCollectionSnapshot,
  ShadowSyncCompactionRunRow,
  ShadowSyncCompactionRunSnapshot,
  ShadowSyncMutationRow,
  ShadowSyncMutationSnapshot,
  ShadowSyncMutationUpsertResult,
  ShadowSyncPullResult,
  ShadowSyncRecordStateRow,
  ShadowSyncRecordStateSnapshot,
  ShadowUserSyncPreferences,
} from "../types/shadow-state"
import { SHADOW_SYNC_COLLECTIONS } from "../types/shadow-state"

interface ShadowSyncCollectionDatabaseRow {
  user_id: string
  collection: ShadowSyncCollection
  enabled: number | boolean
  default_enabled: number | boolean
  last_issued_cursor: string | null
  last_issued_cursor_order?: number | null
  last_server_updated_at: string | null
  compaction_floor_cursor?: string | null
  compaction_floor_cursor_order?: number | null
  last_compacted_at?: string | null
  shadow_updated_at: string
}

interface ShadowSyncMutationDatabaseRow {
  server_mutation_id: string
  user_id: string
  collection: ShadowSyncCollection
  schema_version: number
  record_id: string
  operation: ShadowSyncMutationRow["operation"]
  client_mutation_id: string
  device_id: string
  client_updated_at: string
  server_updated_at: string
  cursor: string
  cursor_order: number
  payload_json: string | null
  shadow_updated_at: string
}

interface ShadowSyncRecordStateDatabaseRow {
  user_id: string
  collection: ShadowSyncCollection
  record_id: string
  is_deleted: number | boolean
  payload_json: string | null
  last_client_mutation_id: string
  last_device_id: string
  last_server_updated_at: string
  last_cursor: string
  last_cursor_order: number | string
  tombstone_retained_until: string | null
  shadow_updated_at: string
}

interface ShadowSyncCompactionRunDatabaseRow {
  run_id: string
  user_id: string
  collection: ShadowSyncCollection
  status: string
  cutoff_cursor_order: number | string
  floor_cursor: string | null
  floor_cursor_order: number | string | null
  mutations_scanned: number | string
  mutations_deleted: number | string
  records_materialized: number | string
  started_at: string | null
  completed_at: string | null
  error_code: string | null
  error_message: string | null
}

const SHADOW_SYNC_COLLECTION_SELECT = `
  SELECT
    user_id,
    collection,
    enabled,
    default_enabled,
    last_issued_cursor,
    last_issued_cursor_order,
    last_server_updated_at,
    compaction_floor_cursor,
    compaction_floor_cursor_order,
    last_compacted_at,
    shadow_updated_at
  FROM shadow_sync_collections
`

const SHADOW_SYNC_MUTATION_SELECT = `
  SELECT
    server_mutation_id,
    user_id,
    collection,
    schema_version,
    record_id,
    operation,
    client_mutation_id,
    device_id,
    client_updated_at,
    server_updated_at,
    cursor,
    cursor_order,
    payload_json,
    shadow_updated_at
  FROM shadow_sync_mutations
`

const SHADOW_SYNC_RECORD_STATE_SELECT = `
  SELECT
    user_id,
    collection,
    record_id,
    is_deleted,
    payload_json,
    last_client_mutation_id,
    last_device_id,
    last_server_updated_at,
    last_cursor,
    last_cursor_order,
    tombstone_retained_until,
    shadow_updated_at
  FROM shadow_sync_record_state
`

function toNullableNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function getDefaultEnabled(collection: ShadowSyncCollection): boolean {
  return collection === "config" || collection === "vocabulary" || collection === "review_schedule"
}

function createDefaultCollectionRow(
  userId: string,
  collection: ShadowSyncCollection,
): ShadowSyncCollectionRow {
  const defaultEnabled = getDefaultEnabled(collection)
  return {
    userId,
    collection,
    enabled: defaultEnabled,
    defaultEnabled,
    lastIssuedCursor: null,
    lastServerUpdatedAt: null,
    compactionFloorCursor: null,
    compactionFloorCursorOrder: null,
    lastCompactedAt: null,
    shadowUpdatedAt: new Date().toISOString(),
  }
}

function mapShadowSyncCollectionRow(
  row: ShadowSyncCollectionDatabaseRow,
): ShadowSyncCollectionRow {
  return {
    userId: row.user_id,
    collection: row.collection,
    enabled: fromSqlBoolean(row.enabled),
    defaultEnabled: fromSqlBoolean(row.default_enabled),
    lastIssuedCursor: row.last_issued_cursor,
    lastServerUpdatedAt: row.last_server_updated_at,
    compactionFloorCursor: row.compaction_floor_cursor ?? null,
    compactionFloorCursorOrder: toNullableNumber(row.compaction_floor_cursor_order),
    lastCompactedAt: row.last_compacted_at ?? null,
    shadowUpdatedAt: row.shadow_updated_at,
  }
}

function mapShadowSyncMutationRow(row: ShadowSyncMutationDatabaseRow): ShadowSyncMutationRow {
  return {
    serverMutationId: row.server_mutation_id,
    userId: row.user_id,
    collection: row.collection,
    schemaVersion: row.schema_version,
    recordId: row.record_id,
    operation: row.operation,
    clientMutationId: row.client_mutation_id,
    deviceId: row.device_id,
    clientUpdatedAt: row.client_updated_at,
    serverUpdatedAt: row.server_updated_at,
    cursor: row.cursor,
    payload: parseJsonColumn(row.payload_json, null),
    shadowUpdatedAt: row.shadow_updated_at,
  }
}

function mapShadowSyncRecordStateRow(
  row: ShadowSyncRecordStateDatabaseRow,
): ShadowSyncRecordStateRow {
  return {
    userId: row.user_id,
    collection: row.collection,
    recordId: row.record_id,
    isDeleted: fromSqlBoolean(row.is_deleted),
    payload: parseJsonColumn(row.payload_json, null),
    lastClientMutationId: row.last_client_mutation_id,
    lastDeviceId: row.last_device_id,
    lastServerUpdatedAt: row.last_server_updated_at,
    lastCursor: row.last_cursor,
    lastCursorOrder: toNullableNumber(row.last_cursor_order) ?? 0,
    tombstoneRetainedUntil: row.tombstone_retained_until,
    shadowUpdatedAt: row.shadow_updated_at,
  }
}

function mapShadowSyncCompactionRunRow(
  row: ShadowSyncCompactionRunDatabaseRow,
): ShadowSyncCompactionRunRow {
  return {
    runId: row.run_id,
    userId: row.user_id,
    collection: row.collection,
    status: row.status,
    cutoffCursorOrder: toNullableNumber(row.cutoff_cursor_order) ?? 0,
    floorCursor: row.floor_cursor,
    floorCursorOrder: toNullableNumber(row.floor_cursor_order),
    mutationsScanned: toNullableNumber(row.mutations_scanned) ?? 0,
    mutationsDeleted: toNullableNumber(row.mutations_deleted) ?? 0,
    recordsMaterialized: toNullableNumber(row.records_materialized) ?? 0,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    errorCode: row.error_code,
    errorMessage: row.error_message,
  }
}

function normalizeShadowSyncCollection(
  snapshot: ShadowSyncCollectionSnapshot,
): ShadowSyncCollectionRow {
  return {
    ...snapshot,
    lastIssuedCursor: snapshot.lastIssuedCursor ?? null,
    lastServerUpdatedAt: snapshot.lastServerUpdatedAt ?? null,
    compactionFloorCursor: snapshot.compactionFloorCursor ?? null,
    compactionFloorCursorOrder: snapshot.compactionFloorCursorOrder ?? null,
    lastCompactedAt: snapshot.lastCompactedAt ?? null,
    shadowUpdatedAt: snapshot.shadowUpdatedAt ?? new Date().toISOString(),
  }
}

function normalizeShadowSyncMutation(
  snapshot: ShadowSyncMutationSnapshot,
): ShadowSyncMutationRow {
  return {
    ...snapshot,
    payload: snapshot.payload ?? null,
    serverMutationId: snapshot.serverMutationId ?? crypto.randomUUID(),
    shadowUpdatedAt: snapshot.shadowUpdatedAt ?? snapshot.serverUpdatedAt,
  }
}

function normalizeShadowSyncRecordState(
  snapshot: ShadowSyncRecordStateSnapshot,
): ShadowSyncRecordStateRow {
  return {
    ...snapshot,
    payload: snapshot.payload ?? null,
    tombstoneRetainedUntil: snapshot.tombstoneRetainedUntil ?? null,
    shadowUpdatedAt: snapshot.shadowUpdatedAt ?? snapshot.lastServerUpdatedAt,
  }
}

function buildCursorMap(
  rows: Record<ShadowSyncCollection, ShadowSyncCollectionRow>,
): Record<ShadowSyncCollection, string | null> {
  return {
    config: rows.config.lastIssuedCursor,
    vocabulary: rows.vocabulary.lastIssuedCursor,
    review_schedule: rows.review_schedule.lastIssuedCursor,
    reading_history: rows.reading_history.lastIssuedCursor,
    study_progress: rows.study_progress.lastIssuedCursor,
  }
}

function toCursorOrder(cursor: string): number {
  const parsed = Number.parseInt(cursor, 10)
  if (!Number.isFinite(parsed) || String(parsed) !== cursor) {
    throw new Error(`Shadow sync cursor must be a numeric string. Received: ${cursor}`)
  }
  return parsed
}

function computeTombstoneRetainedUntil(serverUpdatedAt: string, retentionDays: number): string {
  return new Date(Date.parse(serverUpdatedAt) + (retentionDays * 24 * 60 * 60 * 1000)).toISOString()
}

async function advanceShadowSyncCollectionCursor(
  db: D1Database,
  params: {
    userId: string
    collection: ShadowSyncCollection
    enabled: boolean
    defaultEnabled: boolean
    cursor: string
    serverUpdatedAt: string
    shadowUpdatedAt: string
  },
): Promise<void> {
  const cursorOrder = toCursorOrder(params.cursor)

  const result = await db.prepare(`
    INSERT INTO shadow_sync_collections (
      user_id,
      collection,
      enabled,
      default_enabled,
      last_issued_cursor,
      last_issued_cursor_order,
      last_server_updated_at,
      shadow_updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, collection) DO UPDATE SET
      last_issued_cursor = CASE
        WHEN excluded.last_issued_cursor_order > COALESCE(shadow_sync_collections.last_issued_cursor_order, -1)
          THEN excluded.last_issued_cursor
        ELSE shadow_sync_collections.last_issued_cursor
      END,
      last_issued_cursor_order = CASE
        WHEN excluded.last_issued_cursor_order > COALESCE(shadow_sync_collections.last_issued_cursor_order, -1)
          THEN excluded.last_issued_cursor_order
        ELSE shadow_sync_collections.last_issued_cursor_order
      END,
      last_server_updated_at = CASE
        WHEN excluded.last_issued_cursor_order > COALESCE(shadow_sync_collections.last_issued_cursor_order, -1)
          THEN excluded.last_server_updated_at
        ELSE shadow_sync_collections.last_server_updated_at
      END,
      shadow_updated_at = CASE
        WHEN excluded.last_issued_cursor_order > COALESCE(shadow_sync_collections.last_issued_cursor_order, -1)
          THEN excluded.shadow_updated_at
        ELSE shadow_sync_collections.shadow_updated_at
      END
  `)
    .bind(
      params.userId,
      params.collection,
      toSqlBoolean(params.enabled),
      toSqlBoolean(params.defaultEnabled),
      params.cursor,
      cursorOrder,
      params.serverUpdatedAt,
      params.shadowUpdatedAt,
    )
    .run()
  assertD1Success(result, "advance shadow sync collection cursor")
}

export async function upsertShadowSyncCollection(
  db: D1Database,
  snapshot: ShadowSyncCollectionSnapshot,
): Promise<ShadowSyncCollectionRow> {
  const row = normalizeShadowSyncCollection(snapshot)

  const lastIssuedCursorOrder = row.lastIssuedCursor ? toCursorOrder(row.lastIssuedCursor) : null

  const result = await db.prepare(`
    INSERT INTO shadow_sync_collections (
      user_id,
      collection,
      enabled,
      default_enabled,
      last_issued_cursor,
      last_issued_cursor_order,
      last_server_updated_at,
      compaction_floor_cursor,
      compaction_floor_cursor_order,
      last_compacted_at,
      shadow_updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, collection) DO UPDATE SET
      enabled = excluded.enabled,
      default_enabled = excluded.default_enabled,
      last_issued_cursor = excluded.last_issued_cursor,
      last_issued_cursor_order = excluded.last_issued_cursor_order,
      last_server_updated_at = excluded.last_server_updated_at,
      compaction_floor_cursor = excluded.compaction_floor_cursor,
      compaction_floor_cursor_order = excluded.compaction_floor_cursor_order,
      last_compacted_at = excluded.last_compacted_at,
      shadow_updated_at = excluded.shadow_updated_at
  `)
    .bind(
      row.userId,
      row.collection,
      toSqlBoolean(row.enabled),
      toSqlBoolean(row.defaultEnabled),
      row.lastIssuedCursor,
      lastIssuedCursorOrder,
      row.lastServerUpdatedAt,
      row.compactionFloorCursor,
      row.compactionFloorCursorOrder,
      row.lastCompactedAt,
      row.shadowUpdatedAt,
    )
    .run()
  assertD1Success(result, "upsert shadow sync collection")

  return row
}

export async function setShadowSyncCollectionCompactionFloor(
  db: D1Database,
  params: {
    userId: string
    collection: ShadowSyncCollection
    floorCursor: string | null
    floorCursorOrder: number | null
    lastCompactedAt: string | null
  },
): Promise<void> {
  const result = await db.prepare(`
    UPDATE shadow_sync_collections
    SET
      compaction_floor_cursor = ?,
      compaction_floor_cursor_order = ?,
      last_compacted_at = ?,
      shadow_updated_at = COALESCE(?, shadow_updated_at)
    WHERE user_id = ?
      AND collection = ?
  `)
    .bind(
      params.floorCursor,
      params.floorCursorOrder,
      params.lastCompactedAt,
      params.lastCompactedAt,
      params.userId,
      params.collection,
    )
    .run()
  assertD1Success(result, "set shadow sync collection compaction floor")
}

export async function mirrorShadowSyncCollectionsFromUser(
  db: D1Database,
  params: {
    userId: string
    syncPreferences: ShadowUserSyncPreferences
    shadowUpdatedAt?: string
  },
): Promise<Record<ShadowSyncCollection, ShadowSyncCollectionRow>> {
  const shadowUpdatedAt = params.shadowUpdatedAt ?? new Date().toISOString()

  const rows = {
    config: await upsertShadowSyncCollection(db, {
      userId: params.userId,
      collection: "config",
      enabled: true,
      defaultEnabled: true,
      shadowUpdatedAt,
    }),
    vocabulary: await upsertShadowSyncCollection(db, {
      userId: params.userId,
      collection: "vocabulary",
      enabled: true,
      defaultEnabled: true,
      shadowUpdatedAt,
    }),
    review_schedule: await upsertShadowSyncCollection(db, {
      userId: params.userId,
      collection: "review_schedule",
      enabled: true,
      defaultEnabled: true,
      shadowUpdatedAt,
    }),
    reading_history: await upsertShadowSyncCollection(db, {
      userId: params.userId,
      collection: "reading_history",
      enabled: params.syncPreferences.reading_history,
      defaultEnabled: false,
      shadowUpdatedAt,
    }),
    study_progress: await upsertShadowSyncCollection(db, {
      userId: params.userId,
      collection: "study_progress",
      enabled: params.syncPreferences.study_progress,
      defaultEnabled: false,
      shadowUpdatedAt,
    }),
  }

  return rows
}

export async function listShadowSyncCollectionsForUser(
  db: D1Database,
  userId: string,
): Promise<Record<ShadowSyncCollection, ShadowSyncCollectionRow>> {
  const rows = await listShadowSyncCollectionRowsForUser(db, userId)

  const mapped = Object.fromEntries(
    rows.map((row) => [row.collection, row]),
  ) as Partial<Record<ShadowSyncCollection, ShadowSyncCollectionRow>>

  return {
    config: mapped.config ?? createDefaultCollectionRow(userId, "config"),
    vocabulary: mapped.vocabulary ?? createDefaultCollectionRow(userId, "vocabulary"),
    review_schedule: mapped.review_schedule ?? createDefaultCollectionRow(userId, "review_schedule"),
    reading_history: mapped.reading_history ?? createDefaultCollectionRow(userId, "reading_history"),
    study_progress: mapped.study_progress ?? createDefaultCollectionRow(userId, "study_progress"),
  }
}

export async function listShadowSyncCollectionRowsForUser(
  db: D1Database,
  userId: string,
): Promise<ShadowSyncCollectionRow[]> {
  const rows = await selectAll<ShadowSyncCollectionDatabaseRow>(
    db,
    `
      ${SHADOW_SYNC_COLLECTION_SELECT}
      WHERE user_id = ?
      ORDER BY collection ASC
    `,
    [userId],
  )

  const mappedRows = rows.map(mapShadowSyncCollectionRow)
  const collections = new Set(mappedRows.map((row) => row.collection))
  const hasLegacyDefaultCollections = ["config", "vocabulary", "reading_history", "study_progress"]
    .every((collection) => collections.has(collection as ShadowSyncCollection))
  if (!collections.has("review_schedule") && hasLegacyDefaultCollections) {
    return [...mappedRows, createDefaultCollectionRow(userId, "review_schedule")]
  }
  return mappedRows
}

export async function listShadowSyncMutationRowsForUser(
  db: D1Database,
  userId: string,
): Promise<ShadowSyncMutationRow[]> {
  const rows = await selectAll<ShadowSyncMutationDatabaseRow>(
    db,
    `
      ${SHADOW_SYNC_MUTATION_SELECT}
      WHERE user_id = ?
      ORDER BY collection ASC, cursor_order ASC, server_mutation_id ASC
    `,
    [userId],
  )

  return rows.map(mapShadowSyncMutationRow)
}

export async function listShadowSyncMutationsForCollection(
  db: D1Database,
  params: {
    userId: string
    collection: ShadowSyncCollection
  },
): Promise<ShadowSyncMutationRow[]> {
  const rows = await selectAll<ShadowSyncMutationDatabaseRow>(
    db,
    `
      ${SHADOW_SYNC_MUTATION_SELECT}
      WHERE user_id = ?
        AND collection = ?
      ORDER BY cursor_order ASC, server_mutation_id ASC
    `,
    [params.userId, params.collection],
  )

  return rows.map(mapShadowSyncMutationRow)
}

export async function listShadowSyncMutationsUpToCursorOrder(
  db: D1Database,
  params: {
    userId: string
    collection: ShadowSyncCollection
    cutoffCursorOrder: number
    limit?: number
  },
): Promise<ShadowSyncMutationRow[]> {
  const rows = await selectAll<ShadowSyncMutationDatabaseRow>(
    db,
    `
      ${SHADOW_SYNC_MUTATION_SELECT}
      WHERE user_id = ?
        AND collection = ?
        AND cursor_order <= ?
      ORDER BY cursor_order ASC, server_mutation_id ASC
      LIMIT ?
    `,
    [params.userId, params.collection, params.cutoffCursorOrder, params.limit ?? 500],
  )

  return rows.map(mapShadowSyncMutationRow)
}

export async function listShadowSyncMutationsForUser(
  db: D1Database,
  userId: string,
): Promise<ShadowSyncMutationRow[]> {
  const rows = await selectAll<ShadowSyncMutationDatabaseRow>(
    db,
    `
      ${SHADOW_SYNC_MUTATION_SELECT}
      WHERE user_id = ?
      ORDER BY cursor_order ASC, server_updated_at ASC, server_mutation_id ASC
    `,
    [userId],
  )

  return rows.map(mapShadowSyncMutationRow)
}

export async function getShadowSyncMutationByClientMutationId(
  db: D1Database,
  userId: string,
  clientMutationId: string,
): Promise<ShadowSyncMutationRow | null> {
  const row = await db.prepare<ShadowSyncMutationDatabaseRow>(`
    ${SHADOW_SYNC_MUTATION_SELECT}
    WHERE user_id = ? AND client_mutation_id = ?
  `)
    .bind(userId, clientMutationId)
    .first<ShadowSyncMutationDatabaseRow>()

  return row ? mapShadowSyncMutationRow(row) : null
}

export async function getShadowSyncMaxCursorOrder(
  db: D1Database,
): Promise<number> {
  const row = await db.prepare<{ max_cursor_order: number | null }>(`
    SELECT MAX(cursor_order) AS max_cursor_order
    FROM shadow_sync_mutations
  `)
    .first<{ max_cursor_order: number | null }>()

  return Number.isFinite(row?.max_cursor_order)
    ? Number(row?.max_cursor_order)
    : 0
}

export async function deleteShadowSyncMutationByServerMutationId(
  db: D1Database,
  serverMutationId: string,
): Promise<void> {
  const result = await db.prepare(`
    DELETE FROM shadow_sync_mutations
    WHERE server_mutation_id = ?
  `)
    .bind(serverMutationId)
    .run()
  assertD1Success(result, "delete shadow sync mutation")
}

export async function getShadowSyncRecordState(
  db: D1Database,
  params: {
    userId: string
    collection: ShadowSyncCollection
    recordId: string
  },
): Promise<ShadowSyncRecordStateRow | null> {
  const row = await db.prepare<ShadowSyncRecordStateDatabaseRow>(`
    ${SHADOW_SYNC_RECORD_STATE_SELECT}
    WHERE user_id = ?
      AND collection = ?
      AND record_id = ?
  `)
    .bind(params.userId, params.collection, params.recordId)
    .first<ShadowSyncRecordStateDatabaseRow>()

  return row ? mapShadowSyncRecordStateRow(row) : null
}

export async function listShadowSyncRecordStateRowsForUser(
  db: D1Database,
  userId: string,
): Promise<ShadowSyncRecordStateRow[]> {
  const rows = await selectAll<ShadowSyncRecordStateDatabaseRow>(
    db,
    `
      ${SHADOW_SYNC_RECORD_STATE_SELECT}
      WHERE user_id = ?
      ORDER BY collection ASC, is_deleted ASC, last_cursor_order ASC, record_id ASC
    `,
    [userId],
  )

  return rows.map(mapShadowSyncRecordStateRow)
}

export async function listShadowSyncRecordStateRowsForCollection(
  db: D1Database,
  params: {
    userId: string
    collection: ShadowSyncCollection
  },
): Promise<ShadowSyncRecordStateRow[]> {
  const rows = await selectAll<ShadowSyncRecordStateDatabaseRow>(
    db,
    `
      ${SHADOW_SYNC_RECORD_STATE_SELECT}
      WHERE user_id = ?
        AND collection = ?
      ORDER BY is_deleted ASC, last_cursor_order ASC, record_id ASC
    `,
    [params.userId, params.collection],
  )

  return rows.map(mapShadowSyncRecordStateRow)
}

export async function listActiveShadowSyncRecordStateRowsForCollection(
  db: D1Database,
  params: {
    userId: string
    collection: ShadowSyncCollection
  },
): Promise<ShadowSyncRecordStateRow[]> {
  const rows = await selectAll<ShadowSyncRecordStateDatabaseRow>(
    db,
    `
      ${SHADOW_SYNC_RECORD_STATE_SELECT}
      WHERE user_id = ?
        AND collection = ?
        AND is_deleted = 0
      ORDER BY last_cursor_order ASC, record_id ASC
    `,
    [params.userId, params.collection],
  )

  return rows.map(mapShadowSyncRecordStateRow)
}

export async function upsertShadowSyncRecordState(
  db: D1Database,
  snapshot: ShadowSyncRecordStateSnapshot,
): Promise<ShadowSyncRecordStateRow> {
  const row = normalizeShadowSyncRecordState(snapshot)

  const result = await db.prepare(`
    INSERT INTO shadow_sync_record_state (
      user_id,
      collection,
      record_id,
      is_deleted,
      payload_json,
      last_client_mutation_id,
      last_device_id,
      last_server_updated_at,
      last_cursor,
      last_cursor_order,
      tombstone_retained_until,
      shadow_updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, collection, record_id) DO UPDATE SET
      is_deleted = excluded.is_deleted,
      payload_json = excluded.payload_json,
      last_client_mutation_id = excluded.last_client_mutation_id,
      last_device_id = excluded.last_device_id,
      last_server_updated_at = excluded.last_server_updated_at,
      last_cursor = excluded.last_cursor,
      last_cursor_order = excluded.last_cursor_order,
      tombstone_retained_until = excluded.tombstone_retained_until,
      shadow_updated_at = excluded.shadow_updated_at
  `)
    .bind(
      row.userId,
      row.collection,
      row.recordId,
      toSqlBoolean(row.isDeleted),
      row.payload ? serializeJsonColumn(row.payload) : null,
      row.lastClientMutationId,
      row.lastDeviceId,
      row.lastServerUpdatedAt,
      row.lastCursor,
      row.lastCursorOrder,
      row.tombstoneRetainedUntil,
      row.shadowUpdatedAt,
    )
    .run()
  assertD1Success(result, "upsert shadow sync record state")

  return row
}

export async function deleteShadowSyncRecordState(
  db: D1Database,
  params: {
    userId: string
    collection: ShadowSyncCollection
    recordId: string
  },
): Promise<void> {
  const result = await db.prepare(`
    DELETE FROM shadow_sync_record_state
    WHERE user_id = ?
      AND collection = ?
      AND record_id = ?
  `)
    .bind(params.userId, params.collection, params.recordId)
    .run()
  assertD1Success(result, "delete shadow sync record state")
}

export async function deleteShadowSyncRecordStateForCollection(
  db: D1Database,
  params: {
    userId: string
    collection: ShadowSyncCollection
  },
): Promise<void> {
  const result = await db.prepare(`
    DELETE FROM shadow_sync_record_state
    WHERE user_id = ?
      AND collection = ?
  `)
    .bind(params.userId, params.collection)
    .run()
  assertD1Success(result, "delete shadow sync record state for collection")
}

export async function restoreShadowSyncRecordState(
  db: D1Database,
  snapshot: ShadowSyncRecordStateRow | null,
): Promise<void> {
  if (!snapshot) {
    return
  }
  await upsertShadowSyncRecordState(db, snapshot)
}

export function buildShadowSyncRecordStateSnapshotsFromMutations(
  mutations: ShadowSyncMutationRow[],
  retentionDays: number,
): ShadowSyncRecordStateSnapshot[] {
  const byRecord = new Map<string, ShadowSyncRecordStateSnapshot>()

  for (const mutation of [...mutations].sort((a, b) => Number(a.cursor) - Number(b.cursor))) {
    const lastCursorOrder = toCursorOrder(mutation.cursor)
    byRecord.set(mutation.recordId, {
      userId: mutation.userId,
      collection: mutation.collection,
      recordId: mutation.recordId,
      isDeleted: mutation.operation === "delete",
      payload: mutation.operation === "delete" ? null : mutation.payload,
      lastClientMutationId: mutation.clientMutationId,
      lastDeviceId: mutation.deviceId,
      lastServerUpdatedAt: mutation.serverUpdatedAt,
      lastCursor: mutation.cursor,
      lastCursorOrder,
      tombstoneRetainedUntil: mutation.operation === "delete"
        ? computeTombstoneRetainedUntil(mutation.serverUpdatedAt, retentionDays)
        : null,
      shadowUpdatedAt: mutation.shadowUpdatedAt,
    })
  }

  return [...byRecord.values()].sort((a, b) => a.recordId.localeCompare(b.recordId))
}

export async function replaceShadowSyncRecordStateForCollection(
  db: D1Database,
  params: {
    userId: string
    collection: ShadowSyncCollection
    states: ShadowSyncRecordStateSnapshot[]
  },
): Promise<ShadowSyncRecordStateRow[]> {
  await deleteShadowSyncRecordStateForCollection(db, {
    userId: params.userId,
    collection: params.collection,
  })

  const rows: ShadowSyncRecordStateRow[] = []
  for (const state of params.states) {
    rows.push(await upsertShadowSyncRecordState(db, state))
  }

  return rows
}

export async function ensureShadowSyncRecordStateForCollection(
  db: D1Database,
  params: {
    userId: string
    collection: ShadowSyncCollection
    tombstoneRetentionDays: number
  },
): Promise<ShadowSyncRecordStateRow[]> {
  const existing = await listShadowSyncRecordStateRowsForCollection(db, {
    userId: params.userId,
    collection: params.collection,
  })
  if (existing.length > 0) {
    return existing
  }

  const mutations = await listShadowSyncMutationsForCollection(db, {
    userId: params.userId,
    collection: params.collection,
  })
  if (mutations.length === 0) {
    return []
  }

  const states = buildShadowSyncRecordStateSnapshotsFromMutations(
    mutations,
    params.tombstoneRetentionDays,
  )

  return replaceShadowSyncRecordStateForCollection(db, {
    userId: params.userId,
    collection: params.collection,
    states,
  })
}

export async function pruneExpiredShadowSyncRecordStateTombstones(
  db: D1Database,
  params: {
    userId: string
    collection: ShadowSyncCollection
    cutoffCursorOrder: number
    nowIso: string
  },
): Promise<void> {
  const result = await db.prepare(`
    DELETE FROM shadow_sync_record_state
    WHERE user_id = ?
      AND collection = ?
      AND is_deleted = 1
      AND last_cursor_order <= ?
      AND tombstone_retained_until IS NOT NULL
      AND tombstone_retained_until <= ?
  `)
    .bind(params.userId, params.collection, params.cutoffCursorOrder, params.nowIso)
    .run()
  assertD1Success(result, "prune expired shadow sync tombstones")
}

export async function appendShadowSyncMutation(
  db: D1Database,
  snapshot: ShadowSyncMutationSnapshot,
): Promise<ShadowSyncMutationUpsertResult> {
  const row = normalizeShadowSyncMutation(snapshot)
  const cursorOrder = toCursorOrder(row.cursor)
  const collectionDefaultEnabled = snapshot.collectionDefaultEnabled ?? getDefaultEnabled(row.collection)
  const collectionEnabled = snapshot.collectionEnabled ?? collectionDefaultEnabled

  const insertResult = await db.prepare(`
    INSERT INTO shadow_sync_mutations (
      server_mutation_id,
      user_id,
      collection,
      schema_version,
      record_id,
      operation,
      client_mutation_id,
      device_id,
      client_updated_at,
      server_updated_at,
      cursor,
      cursor_order,
      payload_json,
      shadow_updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, client_mutation_id) DO NOTHING
  `)
    .bind(
      row.serverMutationId,
      row.userId,
      row.collection,
      row.schemaVersion,
      row.recordId,
      row.operation,
      row.clientMutationId,
      row.deviceId,
      row.clientUpdatedAt,
      row.serverUpdatedAt,
      row.cursor,
      cursorOrder,
      row.payload ? serializeJsonColumn(row.payload) : null,
      row.shadowUpdatedAt,
    )
    .run()
  assertD1Success(insertResult, "append shadow sync mutation")

  const stored = await getShadowSyncMutationByClientMutationId(db, row.userId, row.clientMutationId)
  if (!stored) {
    throw new Error(`Shadow sync mutation upsert failed for clientMutationId=${row.clientMutationId}`)
  }

  const deduped = insertResult.meta?.changes === 0
    ? true
    : stored.serverMutationId !== row.serverMutationId

  let previousRecordState: ShadowSyncRecordStateRow | null = null
  if (!deduped) {
    previousRecordState = await getShadowSyncRecordState(db, {
      userId: row.userId,
      collection: row.collection,
      recordId: row.recordId,
    })

    await upsertShadowSyncRecordState(db, {
      userId: stored.userId,
      collection: stored.collection,
      recordId: stored.recordId,
      isDeleted: stored.operation === "delete",
      payload: stored.operation === "delete" ? null : stored.payload,
      lastClientMutationId: stored.clientMutationId,
      lastDeviceId: stored.deviceId,
      lastServerUpdatedAt: stored.serverUpdatedAt,
      lastCursor: stored.cursor,
      lastCursorOrder: toCursorOrder(stored.cursor),
      tombstoneRetainedUntil: stored.operation === "delete"
        ? (snapshot.tombstoneRetainedUntil ?? null)
        : null,
      shadowUpdatedAt: stored.shadowUpdatedAt,
    })
  }

  await advanceShadowSyncCollectionCursor(db, {
    userId: stored.userId,
    collection: stored.collection,
    enabled: collectionEnabled,
    defaultEnabled: collectionDefaultEnabled,
    cursor: stored.cursor,
    serverUpdatedAt: stored.serverUpdatedAt,
    shadowUpdatedAt: stored.shadowUpdatedAt,
  })

  return {
    row: stored,
    deduped,
    previousRecordState,
  }
}

export async function listShadowSyncMutationsAfterCursor(
  db: D1Database,
  params: {
    userId: string
    collection: ShadowSyncCollection
    afterCursor?: string | null
    limit?: number
  },
): Promise<ShadowSyncMutationRow[]> {
  const afterCursor = params.afterCursor ?? "0"
  const limit = params.limit ?? 500
  const afterCursorOrder = toCursorOrder(afterCursor)

  const rows = await selectAll<ShadowSyncMutationDatabaseRow>(
    db,
    `
      ${SHADOW_SYNC_MUTATION_SELECT}
      WHERE
        user_id = ?
        AND collection = ?
        AND cursor_order > ?
      ORDER BY cursor_order ASC
      LIMIT ?
    `,
    [params.userId, params.collection, afterCursorOrder, limit],
  )

  return rows.map(mapShadowSyncMutationRow)
}

export async function getShadowSyncBootstrap(
  db: D1Database,
  params: {
    userId: string
    deviceId: string
    maxMutationsPerRequest: number
    serverTime?: string
  },
): Promise<ShadowSyncBootstrap> {
  const collections = await listShadowSyncCollectionsForUser(db, params.userId)

  return {
    serverTime: params.serverTime ?? new Date().toISOString(),
    deviceId: params.deviceId,
    collections,
    limits: {
      maxMutationsPerRequest: params.maxMutationsPerRequest,
    },
    transport: {
      deviceHeader: "X-Astra-Device-Id",
      idempotencyKey: "clientMutationId",
      cursorMode: "per-collection",
    },
  }
}

export async function pullShadowSyncMutations(
  db: D1Database,
  params: {
    userId: string
    cursors?: Partial<Record<ShadowSyncCollection, string | null>>
    limitPerCollection?: number
    serverTime?: string
  },
): Promise<ShadowSyncPullResult> {
  const cursors = params.cursors ?? {}
  const collections = await listShadowSyncCollectionsForUser(db, params.userId)
  const nextCursors = buildCursorMap(collections)
  const deltas = {
    config: [] as ShadowSyncMutationRow[],
    vocabulary: [] as ShadowSyncMutationRow[],
    review_schedule: [] as ShadowSyncMutationRow[],
    reading_history: [] as ShadowSyncMutationRow[],
    study_progress: [] as ShadowSyncMutationRow[],
  }

  for (const collection of SHADOW_SYNC_COLLECTIONS) {
    const explicitlyRequested = Object.prototype.hasOwnProperty.call(cursors, collection)
    const isOptionalCollection = collection === "reading_history" || collection === "study_progress"

    if (isOptionalCollection && (!explicitlyRequested || !collections[collection].enabled)) {
      nextCursors[collection] = explicitlyRequested
        ? (collections[collection].lastIssuedCursor ?? cursors[collection] ?? null)
        : null
      continue
    }

    const requestedCursor = cursors[collection] ?? null
    const floorOrder = collections[collection].compactionFloorCursorOrder
    if (floorOrder != null) {
      const requestedOrder = requestedCursor ? toCursorOrder(requestedCursor) : 0
      if (requestedOrder < floorOrder) {
        return {
          serverTime: params.serverTime ?? new Date().toISOString(),
          deltas,
          nextCursors,
          cursorExpired: {
            collection,
            requestedCursor,
            compactionFloorCursor: collections[collection].compactionFloorCursor ?? String(floorOrder),
          },
        }
      }
    }

    const rows = await listShadowSyncMutationsAfterCursor(db, {
      userId: params.userId,
      collection,
      afterCursor: requestedCursor,
      limit: params.limitPerCollection,
    })

    deltas[collection] = rows
    nextCursors[collection] = rows.at(-1)?.cursor ?? collections[collection].lastIssuedCursor ?? requestedCursor
  }

  return {
    serverTime: params.serverTime ?? new Date().toISOString(),
    deltas,
    nextCursors,
    cursorExpired: null,
  }
}

export async function createShadowSyncCompactionRun(
  db: D1Database,
  snapshot: ShadowSyncCompactionRunSnapshot,
): Promise<ShadowSyncCompactionRunRow> {
  const row = mapShadowSyncCompactionRunRow({
    run_id: snapshot.runId,
    user_id: snapshot.userId,
    collection: snapshot.collection,
    status: snapshot.status,
    cutoff_cursor_order: snapshot.cutoffCursorOrder,
    floor_cursor: snapshot.floorCursor ?? null,
    floor_cursor_order: snapshot.floorCursorOrder ?? null,
    mutations_scanned: snapshot.mutationsScanned,
    mutations_deleted: snapshot.mutationsDeleted,
    records_materialized: snapshot.recordsMaterialized,
    started_at: snapshot.startedAt ?? null,
    completed_at: snapshot.completedAt ?? null,
    error_code: snapshot.errorCode ?? null,
    error_message: snapshot.errorMessage ?? null,
  })

  const result = await db.prepare(`
    INSERT INTO sync_compaction_runs (
      run_id,
      user_id,
      collection,
      status,
      cutoff_cursor_order,
      floor_cursor,
      floor_cursor_order,
      mutations_scanned,
      mutations_deleted,
      records_materialized,
      started_at,
      completed_at,
      error_code,
      error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      row.runId,
      row.userId,
      row.collection,
      row.status,
      row.cutoffCursorOrder,
      row.floorCursor,
      row.floorCursorOrder,
      row.mutationsScanned,
      row.mutationsDeleted,
      row.recordsMaterialized,
      row.startedAt,
      row.completedAt,
      row.errorCode,
      row.errorMessage,
    )
    .run()
  assertD1Success(result, "create shadow sync compaction run")

  return row
}

export async function completeShadowSyncCompactionRun(
  db: D1Database,
  params: {
    runId: string
    status: string
    floorCursor: string | null
    floorCursorOrder: number | null
    mutationsScanned: number
    mutationsDeleted: number
    recordsMaterialized: number
    completedAt: string
  },
): Promise<void> {
  const result = await db.prepare(`
    UPDATE sync_compaction_runs
    SET
      status = ?,
      floor_cursor = ?,
      floor_cursor_order = ?,
      mutations_scanned = ?,
      mutations_deleted = ?,
      records_materialized = ?,
      completed_at = ?,
      error_code = NULL,
      error_message = NULL
    WHERE run_id = ?
  `)
    .bind(
      params.status,
      params.floorCursor,
      params.floorCursorOrder,
      params.mutationsScanned,
      params.mutationsDeleted,
      params.recordsMaterialized,
      params.completedAt,
      params.runId,
    )
    .run()
  assertD1Success(result, "complete shadow sync compaction run")
}

export async function failShadowSyncCompactionRun(
  db: D1Database,
  params: {
    runId: string
    errorCode: string
    errorMessage: string
    completedAt: string
  },
): Promise<void> {
  const result = await db.prepare(`
    UPDATE sync_compaction_runs
    SET
      status = 'failed',
      completed_at = ?,
      error_code = ?,
      error_message = ?
    WHERE run_id = ?
  `)
    .bind(params.completedAt, params.errorCode, params.errorMessage, params.runId)
    .run()
  assertD1Success(result, "fail shadow sync compaction run")
}
