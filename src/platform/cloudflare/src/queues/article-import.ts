import type { MessageBatch } from "../bindings"
import type { AstraPlatformEnv } from "../env"
import { parsePlatformConfig } from "../env"
import type { ArticleImportQueueMessage, ArticleImportShadowJobRow } from "../types/article-import"

async function markStatus(
  env: AstraPlatformEnv,
  jobId: string,
  params: {
    status: "consumed" | "failed" | "dead_lettered"
    errorCode: string | null
    queueAttemptCount: number
    consumedAtEpochMs?: number | null
  },
) {
  const nowEpochMs = Date.now()
  await env.ASTRA_PLATFORM_DB.prepare(`
    UPDATE article_import_jobs
    SET
      status = ?,
      error_code = ?,
      last_failure_error_code = CASE
        WHEN ? IN ('failed', 'dead_lettered') THEN ?
        ELSE last_failure_error_code
      END,
      queue_attempt_count = ?,
      last_queue_attempt_epoch_ms = ?,
      consumed_at_epoch_ms = ?,
      dead_lettered_at_epoch_ms = CASE
        WHEN ? = 'dead_lettered' THEN ?
        ELSE dead_lettered_at_epoch_ms
      END,
      updated_at_epoch_ms = ?
    WHERE id = ?
  `)
    .bind(
      params.status,
      params.errorCode,
      params.status,
      params.errorCode,
      params.queueAttemptCount,
      nowEpochMs,
      params.consumedAtEpochMs ?? null,
      params.status,
      params.status === "dead_lettered" ? nowEpochMs : null,
      nowEpochMs,
      jobId,
    )
    .run()
}

async function recordQueueAttempt(
  env: AstraPlatformEnv,
  jobId: string,
  queueAttemptCount: number,
) {
  await env.ASTRA_PLATFORM_DB.prepare(`
    UPDATE article_import_jobs
    SET
      queue_attempt_count = ?,
      last_queue_attempt_epoch_ms = ?,
      updated_at_epoch_ms = ?
    WHERE id = ?
  `)
    .bind(queueAttemptCount, Date.now(), Date.now(), jobId)
    .run()
}

export async function consumeArticleImportQueue(
  batch: MessageBatch<ArticleImportQueueMessage>,
  env: AstraPlatformEnv,
): Promise<void> {
  const config = parsePlatformConfig(env)

  await Promise.all(batch.messages.map(async (message) => {
    const payload = message.body
    let queueAttemptCount = 1

    try {
      const row = await env.ASTRA_PLATFORM_DB.prepare<ArticleImportShadowJobRow>(`
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
        WHERE id = ?
      `)
        .bind(payload.jobId)
        .first<ArticleImportShadowJobRow>()

      if (!row) {
        console.error(JSON.stringify({
          message: "article import queue row missing",
          jobId: payload.jobId,
          queue: batch.queue,
        }))
        message.ack()
        return
      }

      if (row.status === "consumed" || row.status === "completed" || row.status === "skipped" || row.status === "dead_lettered") {
        message.ack()
        return
      }

      queueAttemptCount = (row.queue_attempt_count ?? 0) + 1
      await recordQueueAttempt(env, payload.jobId, queueAttemptCount)

      const artifactChecks = [
        {
          objectKey: row.request_object_key ?? payload.requestObjectKey,
          errorCode: "missing_request_object",
        },
        {
          objectKey: row.response_object_key,
          errorCode: "missing_response_object",
        },
        {
          objectKey: row.source_object_key,
          errorCode: "missing_source_object",
        },
      ].filter((artifact) => Boolean(artifact.objectKey))

      for (const artifact of artifactChecks) {
        const object = await env.ASTRA_IMPORT_PAYLOADS.head(artifact.objectKey!)
        if (!object) {
          const terminalStatus = queueAttemptCount >= config.articleImportMaxQueueAttempts ? "dead_lettered" : "failed"
          await markStatus(env, payload.jobId, {
            status: terminalStatus,
            errorCode: artifact.errorCode,
            queueAttemptCount,
          })

          if (terminalStatus === "dead_lettered") {
            console.error(JSON.stringify({
              message: "article import queue dead-lettered after exhausted retries",
              jobId: payload.jobId,
              errorCode: artifact.errorCode,
              queueAttemptCount,
              queue: batch.queue,
            }))
            message.ack()
            return
          }

          message.retry()
          return
        }
      }

      await markStatus(env, payload.jobId, {
        status: "consumed",
        errorCode: null,
        queueAttemptCount,
        consumedAtEpochMs: Date.now(),
      })
      message.ack()
    } catch (error) {
      const terminalStatus = queueAttemptCount >= config.articleImportMaxQueueAttempts ? "dead_lettered" : "failed"
      await markStatus(env, payload.jobId, {
        status: terminalStatus,
        errorCode: "queue_consume_failed",
        queueAttemptCount,
      }).catch((markError) => {
        console.error(JSON.stringify({
          message: "article import queue status update failed",
          jobId: payload.jobId,
          error: markError instanceof Error ? markError.message : String(markError),
        }))
      })

      console.error(JSON.stringify({
        message: "article import queue consume failed",
        jobId: payload.jobId,
        error: error instanceof Error ? error.message : String(error),
        queueAttemptCount,
        terminalStatus,
      }))

      if (terminalStatus === "dead_lettered") {
        message.ack()
        return
      }

      message.retry()
    }
  }))
}
