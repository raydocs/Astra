import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv } from "../env"
import { isArticleImportOperatorAuthorized } from "../lib/article-import-operator"
import { parseJsonColumn, selectAll } from "../lib/d1"
import { errorResponse, jsonResponse } from "../lib/http"
import { listRecentPlatformEvents, type PlatformEventRecord } from "../repositories/platform-ops"
import { listContinuityLifecycleBacklog } from "../repositories/continuity-lifecycle"

interface CountRow {
  domain: string | null
  key: string | null
  count: number | string
}

interface StatusClassRow {
  domain: string | null
  status_class: string | null
  count: number | string
}

interface OldestQueuedRow {
  oldest_created_at_epoch_ms: number | string | null
}

interface ArtifactCompletenessRow {
  missing_request_count: number | string | null
  missing_response_count: number | string | null
  missing_source_count: number | string | null
}

interface RecentFailureRow {
  id: string
  status: string
  route: string
  surface: string
  trace_id: string
  error_code: string | null
  last_failure_error_code: string | null
  fallback_reason: string | null
  queue_attempt_count: number | string
  replay_count: number | string
  updated_at_epoch_ms: number | string
}

interface RecentCompactionRunRow {
  run_id: string
  user_id: string
  collection: string
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
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function toCountMap(rows: CountRow[]): Record<string, Record<string, number>> {
  return rows.reduce<Record<string, Record<string, number>>>((result, row) => {
    const domain = row.domain ?? "unknown"
    const key = row.key ?? "unknown"
    if (!result[domain]) {
      result[domain] = {}
    }
    result[domain]![key] = toNumber(row.count)
    return result
  }, {})
}

function toStatusClassMap(rows: StatusClassRow[]): Record<string, Record<string, number>> {
  return rows.reduce<Record<string, Record<string, number>>>((result, row) => {
    const domain = row.domain ?? "unknown"
    const key = row.status_class ?? "unknown"
    if (!result[domain]) {
      result[domain] = {}
    }
    result[domain]![key] = toNumber(row.count)
    return result
  }, {})
}

function parseWindowHours(request: Request): number {
  const url = new URL(request.url)
  const raw = url.searchParams.get("windowHours")
  if (!raw) return 24
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return 24
  return Math.max(1, Math.min(parsed, 24 * 7))
}

function mapRecentPlatformEvent(event: PlatformEventRecord) {
  return {
    occurredAtEpochMs: event.occurredAtEpochMs,
    domain: event.domain,
    eventKind: event.eventKind,
    scope: event.scope,
    requestId: event.requestId,
    outcome: event.outcome,
    metadata: event.metadata,
  }
}

export async function handlePlatformObservability(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
): Promise<Response> {
  const operatorConfigured = Boolean(env.ARTICLE_IMPORT_OPERATOR_TOKEN?.trim())
  if (operatorConfigured && !isArticleImportOperatorAuthorized(request, env)) {
    return errorResponse(401, "OPERATOR_UNAUTHORIZED", "A valid operator token is required.", ctx.requestId)
  }

  const windowHours = parseWindowHours(request)
  const sinceEpochMs = ctx.nowEpochMs - (windowHours * 60 * 60 * 1000)

  const [
    routeCountsRows,
    modeCountsRows,
    fallbackCountsRows,
    statusClassRows,
    parityCountsRows,
    oldestQueuedRow,
    backlogRows,
    artifactRow,
    recentFailuresRows,
    recentPlatformEvents,
    continuityLifecycleBacklog,
    syncCompactionCountsRows,
    recentSyncCompactionRuns,
  ] = await Promise.all([
    selectAll<CountRow>(
      env.ASTRA_PLATFORM_DB,
      `
        SELECT domain, route AS key, COUNT(*) AS count
        FROM platform_route_events
        WHERE event_kind = 'route'
          AND occurred_at_epoch_ms >= ?
        GROUP BY domain, route
      `,
      [sinceEpochMs],
    ),
    selectAll<CountRow>(
      env.ASTRA_PLATFORM_DB,
      `
        SELECT domain, mode AS key, COUNT(*) AS count
        FROM platform_route_events
        WHERE event_kind = 'route'
          AND occurred_at_epoch_ms >= ?
        GROUP BY domain, mode
      `,
      [sinceEpochMs],
    ),
    selectAll<CountRow>(
      env.ASTRA_PLATFORM_DB,
      `
        SELECT domain, fallback_reason AS key, COUNT(*) AS count
        FROM platform_route_events
        WHERE event_kind = 'route'
          AND occurred_at_epoch_ms >= ?
          AND fallback_reason IS NOT NULL
        GROUP BY domain, fallback_reason
      `,
      [sinceEpochMs],
    ),
    selectAll<StatusClassRow>(
      env.ASTRA_PLATFORM_DB,
      `
        SELECT
          domain,
          CAST((response_status / 100) AS TEXT) || 'xx' AS status_class,
          COUNT(*) AS count
        FROM platform_route_events
        WHERE event_kind = 'route'
          AND occurred_at_epoch_ms >= ?
          AND response_status IS NOT NULL
        GROUP BY domain, CAST((response_status / 100) AS TEXT) || 'xx'
      `,
      [sinceEpochMs],
    ),
    selectAll<CountRow>(
      env.ASTRA_PLATFORM_DB,
      `
        SELECT domain, event_kind AS key, COUNT(*) AS count
        FROM platform_route_events
        WHERE event_kind IN ('parity_mismatch', 'compare_failed')
          AND occurred_at_epoch_ms >= ?
        GROUP BY domain, event_kind
      `,
      [sinceEpochMs],
    ),
    env.ASTRA_PLATFORM_DB.prepare<OldestQueuedRow>(`
      SELECT MIN(created_at_epoch_ms) AS oldest_created_at_epoch_ms
      FROM article_import_jobs
      WHERE status = 'queued'
    `).first<OldestQueuedRow>(),
    selectAll<CountRow>(
      env.ASTRA_PLATFORM_DB,
      `
        SELECT status AS key, COUNT(*) AS count
        FROM article_import_jobs
        WHERE status IN ('queued', 'failed', 'dead_lettered')
        GROUP BY status
      `,
    ),
    env.ASTRA_PLATFORM_DB.prepare<ArtifactCompletenessRow>(`
      SELECT
        SUM(CASE WHEN status != 'skipped' AND route IN ('shadow-proxy', 'native', 'native-fallback-proxy') AND request_object_key IS NULL THEN 1 ELSE 0 END) AS missing_request_count,
        SUM(CASE WHEN status != 'skipped' AND route IN ('shadow-proxy', 'native', 'native-fallback-proxy') AND response_object_key IS NULL THEN 1 ELSE 0 END) AS missing_response_count,
        SUM(CASE WHEN status != 'skipped' AND route = 'native' AND source_object_key IS NULL THEN 1 ELSE 0 END) AS missing_source_count
      FROM article_import_jobs
    `).first<ArtifactCompletenessRow>(),
    selectAll<RecentFailureRow>(
      env.ASTRA_PLATFORM_DB,
      `
        SELECT
          id,
          status,
          route,
          surface,
          trace_id,
          error_code,
          last_failure_error_code,
          fallback_reason,
          queue_attempt_count,
          replay_count,
          updated_at_epoch_ms
        FROM article_import_jobs
        WHERE status IN ('failed', 'dead_lettered')
        ORDER BY updated_at_epoch_ms DESC, id ASC
        LIMIT 10
      `,
    ),
    listRecentPlatformEvents(env.ASTRA_PLATFORM_DB, {
      sinceEpochMs,
      eventKinds: ["parity_mismatch", "compare_failed", "operator_action"],
      limit: 20,
    }),
    listContinuityLifecycleBacklog(env.ASTRA_PLATFORM_DB),
    selectAll<CountRow>(
      env.ASTRA_PLATFORM_DB,
      `
        SELECT status AS key, COUNT(*) AS count
        FROM sync_compaction_runs
        GROUP BY status
      `,
    ),
    selectAll<RecentCompactionRunRow>(
      env.ASTRA_PLATFORM_DB,
      `
        SELECT
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
          error_code
        FROM sync_compaction_runs
        ORDER BY COALESCE(completed_at, started_at) DESC, run_id ASC
        LIMIT 10
      `,
    ),
  ])

  const backlogMap = backlogRows.reduce<Record<string, number>>((result, row) => {
    if (row.key) {
      result[row.key] = toNumber(row.count)
    }
    return result
  }, {})

  return jsonResponse({
    ok: true,
    service: "astra-platform",
    requestId: ctx.requestId,
    environment: ctx.config.environment,
    windowHours,
    rollout: {
      articleImportMode: ctx.config.articleImportMode,
      articleImportModeOverrides: ctx.config.articleImportModeOverrides,
      authSessionReadMode: ctx.config.authSessionReadMode,
      authSessionRevokeWriteMode: ctx.config.authSessionRevokeWriteMode,
      accountSummaryReadMode: ctx.config.accountSummaryReadMode,
      deviceListReadMode: ctx.config.deviceListReadMode,
      deviceRevokeWriteMode: ctx.config.deviceRevokeWriteMode,
      syncBootstrapReadMode: ctx.config.syncBootstrapReadMode,
      syncPullReadMode: ctx.config.syncPullReadMode,
      syncPushWriteMode: ctx.config.syncPushWriteMode,
    },
    governance: {
      articleImport: {
        rateLimit: {
          maxRequestsPerWindow: ctx.config.articleImportRateLimitMax,
          windowSeconds: ctx.config.articleImportRateLimitWindowSeconds,
        },
        byteCaps: {
          maxShadowBytes: ctx.config.articleImportMaxShadowBytes,
          maxNativeBytes: ctx.config.articleImportMaxNativeBytes,
        },
        queuePolicy: {
          maxAttempts: ctx.config.articleImportMaxQueueAttempts,
          operatorTokenConfigured: operatorConfigured,
        },
        artifactRetention: {
          retentionDays: ctx.config.articleImportArtifactRetentionDays,
          retentionClass: ctx.config.articleImportArtifactRetentionClass,
        },
      },
      continuityLifecycle: {
        exportArtifactRetentionDays: ctx.config.continuityExportArtifactRetentionDays,
        deleteGracePeriodSeconds: ctx.config.continuityDeleteGracePeriodSeconds,
        jobHistoryRetentionDays: ctx.config.continuityJobHistoryRetentionDays,
        tombstoneRetentionDays: ctx.config.continuityTombstoneRetentionDays,
      },
      syncLifecycle: {
        tombstoneRetentionDays: ctx.config.syncTombstoneRetentionDays,
        compactionBatchSize: ctx.config.syncCompactionBatchSize,
        compactionDryRun: ctx.config.syncCompactionDryRun,
      },
    },
    observability: {
      routeCounts: toCountMap(routeCountsRows),
      modeCounts: toCountMap(modeCountsRows),
      fallbackCounts: toCountMap(fallbackCountsRows),
      statusClassCounts: toStatusClassMap(statusClassRows),
      parityCounts: toCountMap(parityCountsRows),
      recentPlatformEvents: recentPlatformEvents.map(mapRecentPlatformEvent),
    },
    articleImport: {
      backlog: {
        queued: backlogMap.queued ?? 0,
        failed: backlogMap.failed ?? 0,
        deadLettered: backlogMap.dead_lettered ?? 0,
        oldestQueuedAgeMs: oldestQueuedRow?.oldest_created_at_epoch_ms
          ? Math.max(0, ctx.nowEpochMs - toNumber(oldestQueuedRow.oldest_created_at_epoch_ms))
          : null,
      },
      artifactCompleteness: {
        missingRequestCount: toNumber(artifactRow?.missing_request_count),
        missingResponseCount: toNumber(artifactRow?.missing_response_count),
        missingSourceCount: toNumber(artifactRow?.missing_source_count),
      },
      recentFailures: recentFailuresRows.map((row) => ({
        id: row.id,
        status: row.status,
        route: row.route,
        surface: row.surface,
        traceId: row.trace_id,
        errorCode: row.error_code,
        lastFailureErrorCode: row.last_failure_error_code,
        fallbackReason: row.fallback_reason,
        queueAttemptCount: toNumber(row.queue_attempt_count),
        replayCount: toNumber(row.replay_count),
        updatedAtEpochMs: toNumber(row.updated_at_epoch_ms),
      })),
    },
    continuityLifecycle: {
      exportStatusCounts: continuityLifecycleBacklog.exportStatusCounts,
      deleteStatusCounts: continuityLifecycleBacklog.deleteStatusCounts,
    },
    syncLifecycle: {
      compactionStatusCounts: syncCompactionCountsRows.reduce<Record<string, number>>((result, row) => {
        if (row.key) {
          result[row.key] = toNumber(row.count)
        }
        return result
      }, {}),
      recentCompactionRuns: recentSyncCompactionRuns.map((row) => ({
        runId: row.run_id,
        userId: row.user_id,
        collection: row.collection,
        status: row.status,
        cutoffCursorOrder: toNumber(row.cutoff_cursor_order),
        floorCursor: row.floor_cursor,
        floorCursorOrder: row.floor_cursor_order == null ? null : toNumber(row.floor_cursor_order),
        mutationsScanned: toNumber(row.mutations_scanned),
        mutationsDeleted: toNumber(row.mutations_deleted),
        recordsMaterialized: toNumber(row.records_materialized),
        startedAt: row.started_at,
        completedAt: row.completed_at,
        errorCode: row.error_code,
      })),
    },
  })
}
