import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv } from "../env"
import { isArticleImportOperatorAuthorized, isArticleImportReplayEnabled } from "../lib/article-import-operator"
import { errorResponse, jsonResponse } from "../lib/http"

interface CountRow {
  key: string | null
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
  target_hostname: string | null
  trace_id: string
  error_code: string | null
  last_failure_error_code: string | null
  fallback_reason: string | null
  queue_attempt_count: number | string
  replay_count: number | string
  dead_lettered_at_epoch_ms: number | string | null
  last_replayed_at_epoch_ms: number | string | null
  last_replay_reason: string | null
  updated_at_epoch_ms: number | string
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function toCountMap(rows: CountRow[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    if (!row.key) return acc
    acc[row.key] = toNumber(row.count)
    return acc
  }, {})
}

export async function handleArticleImportObservability(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
): Promise<Response> {
  if (isArticleImportReplayEnabled(env) && !isArticleImportOperatorAuthorized(request, env)) {
    return errorResponse(
      401,
      "OPERATOR_UNAUTHORIZED",
      "Article-import observability requires a valid operator token when operator replay is enabled.",
      ctx.requestId,
    )
  }

  const [routeRows, statusRows, surfaceRows, oldestQueuedRow, artifactRow, recentFailures] = await Promise.all([
    env.ASTRA_PLATFORM_DB.prepare<CountRow>(`
      SELECT route AS key, COUNT(*) AS count
      FROM article_import_jobs
      GROUP BY route
      ORDER BY count DESC, route ASC
    `).all<CountRow>(),
    env.ASTRA_PLATFORM_DB.prepare<CountRow>(`
      SELECT status AS key, COUNT(*) AS count
      FROM article_import_jobs
      GROUP BY status
      ORDER BY count DESC, status ASC
    `).all<CountRow>(),
    env.ASTRA_PLATFORM_DB.prepare<CountRow>(`
      SELECT surface AS key, COUNT(*) AS count
      FROM article_import_jobs
      GROUP BY surface
      ORDER BY count DESC, surface ASC
    `).all<CountRow>(),
    env.ASTRA_PLATFORM_DB.prepare<OldestQueuedRow>(`
      SELECT MIN(created_at_epoch_ms) AS oldest_created_at_epoch_ms
      FROM article_import_jobs
      WHERE status = 'queued'
    `).first<OldestQueuedRow>(),
    env.ASTRA_PLATFORM_DB.prepare<ArtifactCompletenessRow>(`
      SELECT
        SUM(CASE WHEN status != 'skipped' AND route IN ('shadow-proxy', 'native', 'native-fallback-proxy') AND request_object_key IS NULL THEN 1 ELSE 0 END) AS missing_request_count,
        SUM(CASE WHEN status != 'skipped' AND route IN ('shadow-proxy', 'native', 'native-fallback-proxy') AND response_object_key IS NULL THEN 1 ELSE 0 END) AS missing_response_count,
        SUM(CASE WHEN status != 'skipped' AND route = 'native' AND source_object_key IS NULL THEN 1 ELSE 0 END) AS missing_source_count
      FROM article_import_jobs
    `).first<ArtifactCompletenessRow>(),
    env.ASTRA_PLATFORM_DB.prepare<RecentFailureRow>(`
      SELECT
        id,
        status,
        route,
        surface,
        target_hostname,
        trace_id,
        error_code,
        last_failure_error_code,
        fallback_reason,
        queue_attempt_count,
        replay_count,
        dead_lettered_at_epoch_ms,
        last_replayed_at_epoch_ms,
        last_replay_reason,
        updated_at_epoch_ms
      FROM article_import_jobs
      WHERE status IN ('failed', 'dead_lettered')
      ORDER BY updated_at_epoch_ms DESC
      LIMIT 10
    `).all<RecentFailureRow>(),
  ])

  const oldestQueuedEpochMs = toNumber(oldestQueuedRow?.oldest_created_at_epoch_ms)
  const byStatus = toCountMap(statusRows.results ?? [])

  return jsonResponse({
    ok: true,
    service: "astra-platform",
    requestId: ctx.requestId,
    environment: ctx.config.environment,
    articleImport: {
      defaultMode: ctx.config.articleImportMode,
      modeOverrides: ctx.config.articleImportModeOverrides,
      hostPolicyCounts: {
        allowedHosts: ctx.config.articleImportAllowedHosts.length,
        blockedHosts: ctx.config.articleImportBlockedHosts.length,
        forceProxyHosts: ctx.config.articleImportForceProxyHosts.length,
      },
      rateLimit: {
        maxRequestsPerWindow: ctx.config.articleImportRateLimitMax,
        windowSeconds: ctx.config.articleImportRateLimitWindowSeconds,
      },
      queuePolicy: {
        maxAttempts: ctx.config.articleImportMaxQueueAttempts,
        operatorReplayEnabled: Boolean(env.ARTICLE_IMPORT_OPERATOR_TOKEN?.trim()),
      },
      artifactGovernance: {
        retentionClass: ctx.config.articleImportArtifactRetentionClass,
        retentionDays: ctx.config.articleImportArtifactRetentionDays,
      },
      routeCounts: toCountMap(routeRows.results ?? []),
      statusCounts: byStatus,
      surfaceCounts: toCountMap(surfaceRows.results ?? []),
      backlog: {
        queued: byStatus.queued ?? 0,
        failed: byStatus.failed ?? 0,
        deadLettered: byStatus.dead_lettered ?? 0,
        oldestQueuedAgeMs: oldestQueuedEpochMs > 0 ? Math.max(ctx.nowEpochMs - oldestQueuedEpochMs, 0) : null,
      },
      artifactCompleteness: {
        missingRequestCount: toNumber(artifactRow?.missing_request_count),
        missingResponseCount: toNumber(artifactRow?.missing_response_count),
        missingSourceCount: toNumber(artifactRow?.missing_source_count),
      },
      recentFailures: (recentFailures.results ?? []).map((row) => ({
        jobId: row.id,
        status: row.status,
        route: row.route,
        surface: row.surface,
        targetHostname: row.target_hostname,
        traceId: row.trace_id,
        errorCode: row.error_code,
        lastFailureErrorCode: row.last_failure_error_code,
        fallbackReason: row.fallback_reason,
        queueAttemptCount: toNumber(row.queue_attempt_count),
        replayCount: toNumber(row.replay_count),
        deadLetteredAtEpochMs: toNumber(row.dead_lettered_at_epoch_ms),
        lastReplayedAtEpochMs: toNumber(row.last_replayed_at_epoch_ms),
        lastReplayReason: row.last_replay_reason,
        updatedAtEpochMs: toNumber(row.updated_at_epoch_ms),
      })),
    },
  })
}
