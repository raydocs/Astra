import type { D1Database } from "../bindings"
import { parseJsonColumn, selectAll, serializeJsonColumn } from "../lib/d1"

export type PlatformEventDomain =
  | "article-import"
  | "auth-anonymous"
  | "auth-session"
  | "account-summary"
  | "device-list"
  | "device-revoke"
  | "sync-bootstrap"
  | "sync-pull"
  | "sync-push"
  | "sync-repair"
  | "sync-compaction"
  | "continuity-lifecycle"
  | "shadow-consistency"

export type PlatformEventKind =
  | "route"
  | "parity_mismatch"
  | "compare_failed"
  | "operator_action"

export interface PlatformEventRecord {
  id: string
  occurredAtEpochMs: number
  environment: string
  domain: PlatformEventDomain
  eventKind: PlatformEventKind
  route: string | null
  mode: string | null
  fallbackReason: string | null
  responseStatus: number | null
  scope: string | null
  outcome: string | null
  requestId: string | null
  metadata: Record<string, unknown> | null
}

interface PlatformEventDatabaseRow {
  id: string
  occurred_at_epoch_ms: number | string
  environment: string
  domain: PlatformEventDomain
  event_kind: PlatformEventKind
  route: string | null
  mode: string | null
  fallback_reason: string | null
  response_status: number | string | null
  scope: string | null
  outcome: string | null
  request_id: string | null
  metadata_json: string | null
}

function toNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function mapPlatformEventRow(row: PlatformEventDatabaseRow): PlatformEventRecord {
  return {
    id: row.id,
    occurredAtEpochMs: toNumber(row.occurred_at_epoch_ms) ?? 0,
    environment: row.environment,
    domain: row.domain,
    eventKind: row.event_kind,
    route: row.route,
    mode: row.mode,
    fallbackReason: row.fallback_reason,
    responseStatus: toNumber(row.response_status),
    scope: row.scope,
    outcome: row.outcome,
    requestId: row.request_id,
    metadata: parseJsonColumn<Record<string, unknown> | null>(row.metadata_json, null),
  }
}

export async function recordPlatformEvent(
  db: D1Database,
  event: Omit<PlatformEventRecord, "id"> & { id?: string },
): Promise<PlatformEventRecord> {
  const record: PlatformEventRecord = {
    id: event.id ?? crypto.randomUUID(),
    occurredAtEpochMs: event.occurredAtEpochMs,
    environment: event.environment,
    domain: event.domain,
    eventKind: event.eventKind,
    route: event.route ?? null,
    mode: event.mode ?? null,
    fallbackReason: event.fallbackReason ?? null,
    responseStatus: event.responseStatus ?? null,
    scope: event.scope ?? null,
    outcome: event.outcome ?? null,
    requestId: event.requestId ?? null,
    metadata: event.metadata ?? null,
  }

  await db.prepare(`
    INSERT INTO platform_route_events (
      id,
      occurred_at_epoch_ms,
      environment,
      domain,
      event_kind,
      route,
      mode,
      fallback_reason,
      response_status,
      scope,
      outcome,
      request_id,
      metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      record.id,
      record.occurredAtEpochMs,
      record.environment,
      record.domain,
      record.eventKind,
      record.route,
      record.mode,
      record.fallbackReason,
      record.responseStatus,
      record.scope,
      record.outcome,
      record.requestId,
      serializeJsonColumn(record.metadata),
    )
    .run()

  return record
}

export async function listRecentPlatformEvents(
  db: D1Database,
  params: {
    sinceEpochMs: number
    limit?: number
    eventKinds?: PlatformEventKind[]
  },
): Promise<PlatformEventRecord[]> {
  const limit = Math.max(1, Math.min(params.limit ?? 20, 100))
  const eventKinds = params.eventKinds ?? []

  if (eventKinds.length === 0) {
    const rows = await selectAll<PlatformEventDatabaseRow>(
      db,
      `
        SELECT
          id,
          occurred_at_epoch_ms,
          environment,
          domain,
          event_kind,
          route,
          mode,
          fallback_reason,
          response_status,
          scope,
          outcome,
          request_id,
          metadata_json
        FROM platform_route_events
        WHERE occurred_at_epoch_ms >= ?
        ORDER BY occurred_at_epoch_ms DESC, id DESC
        LIMIT ?
      `,
      [params.sinceEpochMs, limit],
    )
    return rows.map(mapPlatformEventRow)
  }

  const placeholders = eventKinds.map(() => "?").join(", ")
  const rows = await selectAll<PlatformEventDatabaseRow>(
    db,
    `
      SELECT
        id,
        occurred_at_epoch_ms,
        environment,
        domain,
        event_kind,
        route,
        mode,
        fallback_reason,
        response_status,
        scope,
        outcome,
        request_id,
        metadata_json
      FROM platform_route_events
      WHERE occurred_at_epoch_ms >= ?
        AND event_kind IN (${placeholders})
      ORDER BY occurred_at_epoch_ms DESC, id DESC
      LIMIT ?
    `,
    [params.sinceEpochMs, ...eventKinds, limit],
  )
  return rows.map(mapPlatformEventRow)
}
