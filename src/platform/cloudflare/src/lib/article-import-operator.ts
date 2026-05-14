import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv } from "../env"
import type {
  ArticleImportQueueMessage,
  ArticleImportReplayableStatus,
  ArticleImportShadowJobRow,
} from "../types/article-import"
import {
  ARTICLE_IMPORT_DEFAULT_REPLAY_BATCH_LIMIT,
  ARTICLE_IMPORT_MAX_REPLAY_BATCH_LIMIT,
  ARTICLE_IMPORT_OPERATOR_ID_HEADER,
  ARTICLE_IMPORT_OPERATOR_TOKEN_HEADER,
  ARTICLE_IMPORT_SHADOW_VERSION,
} from "../types/article-import"

interface ReplaySelectionParams {
  jobIds?: string[]
  status?: ArticleImportReplayableStatus
  limit?: number
}

interface ReplayJobResult {
  jobId: string
  previousStatus: string | null
  previousErrorCode: string | null
  lastFailureErrorCode: string | null
  queueAttemptCount: number
  replayCount: number
  action: "requeued" | "would_requeue" | "skipped"
  reason: string | null
  traceId: string | null
  targetHostname: string | null
  artifactRetentionClass: string | null
  artifactRetentionUntilEpochMs: number | null
}

interface ReplaySummary {
  selected: number
  replayed: number
  skipped: number
}

export interface ReplayArticleImportJobsResult {
  selection: {
    jobIds?: string[]
    status?: ArticleImportReplayableStatus
    limit: number
  }
  summary: ReplaySummary
  jobs: ReplayJobResult[]
}

function normalizeReplayLimit(value: number | undefined): number {
  if (!Number.isFinite(value) || !value) {
    return ARTICLE_IMPORT_DEFAULT_REPLAY_BATCH_LIMIT
  }
  return Math.max(1, Math.min(Math.trunc(value), ARTICLE_IMPORT_MAX_REPLAY_BATCH_LIMIT))
}

function normalizeJobIds(jobIds: string[] | undefined): string[] {
  if (!jobIds?.length) return []
  return Array.from(new Set(jobIds.map((value) => value.trim()).filter(Boolean)))
}

function readOperatorToken(request: Request): string | null {
  const authorization = request.headers.get("authorization")?.trim()
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    const token = authorization.slice(7).trim()
    if (token) return token
  }

  return request.headers.get(ARTICLE_IMPORT_OPERATOR_TOKEN_HEADER)?.trim() || null
}

export function readArticleImportOperatorId(request: Request): string | null {
  return request.headers.get(ARTICLE_IMPORT_OPERATOR_ID_HEADER)?.trim() || null
}

export function isArticleImportReplayEnabled(env: AstraPlatformEnv): boolean {
  return Boolean(env.ARTICLE_IMPORT_OPERATOR_TOKEN?.trim())
}

export function isArticleImportOperatorAuthorized(request: Request, env: AstraPlatformEnv): boolean {
  const configuredToken = env.ARTICLE_IMPORT_OPERATOR_TOKEN?.trim()
  if (!configuredToken) return false

  const operatorToken = readOperatorToken(request)
  return Boolean(operatorToken && operatorToken === configuredToken)
}

function mapReplayableRow(row: ArticleImportShadowJobRow | null): ReplayJobResult {
  return {
    jobId: row?.id ?? "unknown",
    previousStatus: row?.status ?? null,
    previousErrorCode: row?.error_code ?? null,
    lastFailureErrorCode: row?.last_failure_error_code ?? null,
    queueAttemptCount: row?.queue_attempt_count ?? 0,
    replayCount: row?.replay_count ?? 0,
    action: "skipped",
    reason: null,
    traceId: row?.trace_id ?? null,
    targetHostname: row?.target_hostname ?? null,
    artifactRetentionClass: row?.artifact_retention_class ?? null,
    artifactRetentionUntilEpochMs: row?.artifact_retention_until_epoch_ms ?? null,
  }
}

async function selectReplayRows(
  env: AstraPlatformEnv,
  params: ReplaySelectionParams,
): Promise<ArticleImportShadowJobRow[]> {
  const limit = normalizeReplayLimit(params.limit)
  const jobIds = normalizeJobIds(params.jobIds)

  const selectedColumns = `
    SELECT
      id,
      status,
      shadow_version,
      mode,
      route,
      surface,
      target_hostname,
      decision_reason,
      fallback_reason,
      artifact_retention_class,
      artifact_retention_until_epoch_ms,
      request_hash,
      request_object_key,
      response_object_key,
      source_object_key,
      request_object_bytes,
      response_object_bytes,
      source_object_bytes,
      request_object_sha256,
      response_object_sha256,
      source_object_sha256,
      idempotency_key,
      content_type,
      content_length,
      proxy_status,
      trace_id,
      error_code,
      last_failure_error_code,
      queue_attempt_count,
      last_queue_attempt_epoch_ms,
      consumed_at_epoch_ms,
      dead_lettered_at_epoch_ms,
      replay_count,
      last_replayed_at_epoch_ms,
      last_replay_reason,
      last_replayed_by,
      created_at_epoch_ms,
      updated_at_epoch_ms
    FROM article_import_jobs
  `

  if (jobIds.length > 0) {
    const placeholders = jobIds.map(() => "?").join(", ")
    const rows = await env.ASTRA_PLATFORM_DB.prepare<ArticleImportShadowJobRow>(`
      ${selectedColumns}
      WHERE id IN (${placeholders})
    `)
      .bind(...jobIds)
      .all<ArticleImportShadowJobRow>()

    const rowById = new Map((rows.results ?? []).map((row) => [row.id, row]))
    return jobIds.map((jobId) => rowById.get(jobId)).filter(Boolean) as ArticleImportShadowJobRow[]
  }

  if (params.status) {
    const rows = await env.ASTRA_PLATFORM_DB.prepare<ArticleImportShadowJobRow>(`
      ${selectedColumns}
      WHERE status = ?
      ORDER BY updated_at_epoch_ms DESC, id ASC
      LIMIT ?
    `)
      .bind(params.status, limit)
      .all<ArticleImportShadowJobRow>()

    return rows.results ?? []
  }

  return []
}

function buildReplayMessage(row: ArticleImportShadowJobRow, nowEpochMs: number): ArticleImportQueueMessage {
  return {
    version: ARTICLE_IMPORT_SHADOW_VERSION,
    jobId: row.id,
    requestObjectKey: row.request_object_key!,
    requestHash: row.request_hash,
    traceId: row.trace_id,
    receivedAtEpochMs: nowEpochMs,
  }
}

async function markJobReplayed(params: {
  env: AstraPlatformEnv
  row: ArticleImportShadowJobRow
  nowEpochMs: number
  operatorId: string | null
  replayReason: string | null
}) {
  await params.env.ASTRA_PLATFORM_DB.prepare(`
    UPDATE article_import_jobs
    SET
      status = 'queued',
      error_code = NULL,
      queue_attempt_count = 0,
      last_queue_attempt_epoch_ms = NULL,
      consumed_at_epoch_ms = NULL,
      replay_count = ?,
      last_replayed_at_epoch_ms = ?,
      last_replay_reason = ?,
      last_replayed_by = ?,
      updated_at_epoch_ms = ?
    WHERE id = ?
  `)
    .bind(
      (params.row.replay_count ?? 0) + 1,
      params.nowEpochMs,
      params.replayReason,
      params.operatorId,
      params.nowEpochMs,
      params.row.id,
    )
    .run()
}

async function rollbackMarkedReplay(params: {
  env: AstraPlatformEnv
  row: ArticleImportShadowJobRow
}) {
  await params.env.ASTRA_PLATFORM_DB.prepare(`
    UPDATE article_import_jobs
    SET
      status = ?,
      error_code = ?,
      queue_attempt_count = ?,
      last_queue_attempt_epoch_ms = ?,
      consumed_at_epoch_ms = ?,
      replay_count = ?,
      last_replayed_at_epoch_ms = ?,
      last_replay_reason = ?,
      last_replayed_by = ?,
      updated_at_epoch_ms = ?
    WHERE id = ?
  `)
    .bind(
      params.row.status,
      params.row.error_code,
      params.row.queue_attempt_count,
      params.row.last_queue_attempt_epoch_ms,
      params.row.consumed_at_epoch_ms,
      params.row.replay_count,
      params.row.last_replayed_at_epoch_ms,
      params.row.last_replay_reason,
      params.row.last_replayed_by,
      params.row.updated_at_epoch_ms,
      params.row.id,
    )
    .run()
}

function logArticleImportReplayEvent(params: {
  requestId: string
  operatorId: string | null
  jobId: string
  previousStatus: string
  replayReason: string | null
  dryRun: boolean
  error?: unknown
}) {
  console.log(JSON.stringify({
    message: params.error
      ? "article import operator replay failed"
      : params.dryRun
        ? "article import operator replay dry-run"
        : "article import operator replay queued",
    requestId: params.requestId,
    operatorId: params.operatorId,
    jobId: params.jobId,
    previousStatus: params.previousStatus,
    replayReason: params.replayReason,
    error: params.error instanceof Error ? params.error.message : params.error ? String(params.error) : null,
  }))
}

export async function replayArticleImportJobs(params: {
  env: AstraPlatformEnv
  ctx: AstraRequestContext
  operatorId: string | null
  replayReason: string | null
  dryRun: boolean
  selection: ReplaySelectionParams
}): Promise<ReplayArticleImportJobsResult> {
  const selectedRows = await selectReplayRows(params.env, params.selection)
  const jobs: ReplayJobResult[] = []

  for (const row of selectedRows) {
    const base = mapReplayableRow(row)

    if (row.status !== "failed" && row.status !== "dead_lettered") {
      jobs.push({
        ...base,
        action: "skipped",
        reason: `status_${row.status}_not_replayable`,
      })
      continue
    }

    if (!row.request_object_key) {
      jobs.push({
        ...base,
        action: "skipped",
        reason: "missing_request_object",
      })
      continue
    }

    if (params.dryRun) {
      jobs.push({
        ...base,
        action: "would_requeue",
        reason: null,
      })
      logArticleImportReplayEvent({
        requestId: params.ctx.requestId,
        operatorId: params.operatorId,
        jobId: row.id,
        previousStatus: row.status,
        replayReason: params.replayReason,
        dryRun: true,
      })
      continue
    }

    await markJobReplayed({
      env: params.env,
      row,
      nowEpochMs: params.ctx.nowEpochMs,
      operatorId: params.operatorId,
      replayReason: params.replayReason,
    })

    try {
      await params.env.ARTICLE_IMPORT_QUEUE.send(buildReplayMessage(row, params.ctx.nowEpochMs))
    } catch (error) {
      await rollbackMarkedReplay({ env: params.env, row })
      jobs.push({
        ...base,
        action: "skipped",
        reason: "queue_send_failed",
      })
      logArticleImportReplayEvent({
        requestId: params.ctx.requestId,
        operatorId: params.operatorId,
        jobId: row.id,
        previousStatus: row.status,
        replayReason: params.replayReason,
        dryRun: false,
        error,
      })
      continue
    }

    jobs.push({
      ...base,
      action: "requeued",
      replayCount: (row.replay_count ?? 0) + 1,
      reason: null,
    })
    logArticleImportReplayEvent({
      requestId: params.ctx.requestId,
      operatorId: params.operatorId,
      jobId: row.id,
      previousStatus: row.status,
      replayReason: params.replayReason,
      dryRun: false,
    })
  }

  return {
    selection: {
      jobIds: normalizeJobIds(params.selection.jobIds),
      status: params.selection.status,
      limit: normalizeReplayLimit(params.selection.limit),
    },
    summary: {
      selected: selectedRows.length,
      replayed: jobs.filter((job) => job.action === "requeued").length,
      skipped: jobs.filter((job) => job.action === "skipped").length,
    },
    jobs,
  }
}
