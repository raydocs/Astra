import type { D1Database } from "../bindings"
import { assertD1Success, parseJsonColumn, serializeJsonColumn } from "../lib/d1"
import type { ShadowUserUsageRow, ShadowUserUsageSnapshot } from "../types/shadow-state"

interface ShadowUserUsageDatabaseRow {
  user_id: string
  usage_day: string
  daily_requests_limit: number
  daily_characters_limit: number
  requests_per_minute_limit: number
  requests_today: number
  characters_today: number
  total_requests: number
  total_characters: number
  last_request_at: string | null
  recent_events_json: string
  shadow_updated_at: string
}

const SHADOW_USER_USAGE_SELECT = `
  SELECT
    user_id,
    usage_day,
    daily_requests_limit,
    daily_characters_limit,
    requests_per_minute_limit,
    requests_today,
    characters_today,
    total_requests,
    total_characters,
    last_request_at,
    recent_events_json,
    shadow_updated_at
  FROM shadow_user_usage
`

function normalizeShadowUserUsage(snapshot: ShadowUserUsageSnapshot): ShadowUserUsageRow {
  return {
    ...snapshot,
    lastRequestAt: snapshot.lastRequestAt ?? null,
    recentEvents: [...snapshot.recentEvents],
    shadowUpdatedAt: snapshot.shadowUpdatedAt ?? new Date().toISOString(),
  }
}

function mapShadowUserUsageRow(row: ShadowUserUsageDatabaseRow): ShadowUserUsageRow {
  return {
    userId: row.user_id,
    usageDay: row.usage_day,
    dailyRequestsLimit: Number(row.daily_requests_limit),
    dailyCharactersLimit: Number(row.daily_characters_limit),
    requestsPerMinuteLimit: Number(row.requests_per_minute_limit),
    requestsToday: Number(row.requests_today),
    charactersToday: Number(row.characters_today),
    totalRequests: Number(row.total_requests),
    totalCharacters: Number(row.total_characters),
    lastRequestAt: row.last_request_at,
    recentEvents: parseJsonColumn(row.recent_events_json, []),
    shadowUpdatedAt: row.shadow_updated_at,
  }
}

export async function upsertShadowUserUsage(
  db: D1Database,
  snapshot: ShadowUserUsageSnapshot,
): Promise<ShadowUserUsageRow> {
  const row = normalizeShadowUserUsage(snapshot)

  const result = await db.prepare(`
    INSERT INTO shadow_user_usage (
      user_id,
      usage_day,
      daily_requests_limit,
      daily_characters_limit,
      requests_per_minute_limit,
      requests_today,
      characters_today,
      total_requests,
      total_characters,
      last_request_at,
      recent_events_json,
      shadow_updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      usage_day = excluded.usage_day,
      daily_requests_limit = excluded.daily_requests_limit,
      daily_characters_limit = excluded.daily_characters_limit,
      requests_per_minute_limit = excluded.requests_per_minute_limit,
      requests_today = excluded.requests_today,
      characters_today = excluded.characters_today,
      total_requests = excluded.total_requests,
      total_characters = excluded.total_characters,
      last_request_at = excluded.last_request_at,
      recent_events_json = excluded.recent_events_json,
      shadow_updated_at = excluded.shadow_updated_at
  `)
    .bind(
      row.userId,
      row.usageDay,
      row.dailyRequestsLimit,
      row.dailyCharactersLimit,
      row.requestsPerMinuteLimit,
      row.requestsToday,
      row.charactersToday,
      row.totalRequests,
      row.totalCharacters,
      row.lastRequestAt,
      serializeJsonColumn(row.recentEvents),
      row.shadowUpdatedAt,
    )
    .run()
  assertD1Success(result, "upsert shadow user usage")

  return row
}

export async function getShadowUserUsageByUserId(
  db: D1Database,
  userId: string,
): Promise<ShadowUserUsageRow | null> {
  const row = await db.prepare<ShadowUserUsageDatabaseRow>(`
    ${SHADOW_USER_USAGE_SELECT}
    WHERE user_id = ?
  `)
    .bind(userId)
    .first<ShadowUserUsageDatabaseRow>()

  return row ? mapShadowUserUsageRow(row) : null
}
