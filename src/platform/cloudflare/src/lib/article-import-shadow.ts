import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv } from "../env"
import {
  ARTICLE_IMPORT_IDEMPOTENCY_TTL_SECONDS,
  ARTICLE_IMPORT_SHADOW_VERSION,
  type ArticleImportQueueMessage,
} from "../types/article-import"

interface ArticleImportArtifactDescriptor {
  objectKey: string | null
  bytes: number | null
  sha256: string | null
}

interface ArticleImportArtifactGovernance {
  shadowVersion: number
  retentionClass: string
  retentionUntilEpochMs: number
}

function parseContentLength(value: string | null): number | null {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function buildObjectKey(
  jobId: string,
  artifactName: "request.bin" | "response.bin" | "source.html",
): string {
  const date = new Date().toISOString().slice(0, 10)
  return `article-import/${date}/${jobId}/${artifactName}`
}

function buildIdempotencyKvKey(params: {
  key: string
  environment: string
  requestHash: string
}): string {
  return `article-import:${params.environment}:${params.requestHash}:${params.key}`
}

function buildArtifactGovernance(ctx: AstraRequestContext): ArticleImportArtifactGovernance {
  return {
    shadowVersion: ARTICLE_IMPORT_SHADOW_VERSION,
    retentionClass: ctx.config.articleImportArtifactRetentionClass,
    retentionUntilEpochMs: ctx.nowEpochMs + (ctx.config.articleImportArtifactRetentionDays * 24 * 60 * 60 * 1000),
  }
}

function buildR2CustomMetadata(params: {
  jobId: string
  requestHash: string
  traceId: string
  artifactType: "request" | "response" | "source"
  artifact: ArticleImportArtifactDescriptor
  mode: string
  route: string
  surface: string
  targetHostname: string
  governance: ArticleImportArtifactGovernance
  ctx: AstraRequestContext
  fallbackReason?: string | null
}): Record<string, string> {
  const metadata: Record<string, string> = {
    jobId: params.jobId,
    requestHash: params.requestHash,
    traceId: params.traceId,
    artifactType: params.artifactType,
    shadowVersion: String(params.governance.shadowVersion),
    environment: params.ctx.config.environment,
    mode: params.mode,
    route: params.route,
    surface: params.surface,
    targetHostname: params.targetHostname,
    retentionClass: params.governance.retentionClass,
    retentionUntilEpochMs: String(params.governance.retentionUntilEpochMs),
    artifactBytes: String(params.artifact.bytes ?? 0),
    artifactSha256: params.artifact.sha256 ?? "",
  }

  if (params.fallbackReason) {
    metadata.fallbackReason = params.fallbackReason
  }

  return metadata
}

class ArticleImportBodyTooLargeError extends Error {
  constructor() {
    super("Article import shadow body exceeded the configured cap.")
    this.name = "ArticleImportBodyTooLargeError"
  }
}

async function sha256Hex(parts: Array<ArrayBuffer | string>): Promise<string> {
  const encoder = new TextEncoder()
  const normalizedParts = parts.map((part) => typeof part === "string" ? encoder.encode(part) : new Uint8Array(part))
  const totalLength = normalizedParts.reduce((sum, value) => sum + value.byteLength, 0)
  const merged = new Uint8Array(totalLength)
  let offset = 0
  for (const value of normalizedParts) {
    merged.set(value, offset)
    offset += value.byteLength
  }
  const digest = await crypto.subtle.digest("SHA-256", merged)
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("")
}

async function readRequestBodyUpToLimit(
  request: Request,
  maxBytes: number,
): Promise<ArrayBuffer> {
  const declaredContentLength = parseContentLength(request.headers.get("content-length"))
  if (declaredContentLength !== null && declaredContentLength > maxBytes) {
    throw new ArticleImportBodyTooLargeError()
  }

  if (!request.body) {
    return new ArrayBuffer(0)
  }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    totalBytes += value.byteLength
    if (totalBytes > maxBytes) {
      throw new ArticleImportBodyTooLargeError()
    }
    chunks.push(value)
  }

  const merged = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged.buffer
}

function logArticleImportShadowWarning(params: {
  message: string
  requestId: string
  error: unknown
}) {
  console.error(JSON.stringify({
    message: params.message,
    requestId: params.requestId,
    error: params.error instanceof Error ? params.error.message : String(params.error),
  }))
}

async function insertShadowRow(params: {
  env: AstraPlatformEnv
  jobId: string
  status: "received" | "completed" | "failed" | "skipped"
  shadowVersion: number
  mode: string
  route: string
  surface: string
  targetHostname: string | null
  decisionReason: string | null
  fallbackReason: string | null
  artifactRetentionClass: string
  artifactRetentionUntilEpochMs: number
  requestHash: string
  requestArtifact: ArticleImportArtifactDescriptor
  responseArtifact: ArticleImportArtifactDescriptor
  sourceArtifact: ArticleImportArtifactDescriptor
  idempotencyKey: string | null
  contentType: string | null
  contentLength: number | null
  proxyStatus: number | null
  traceId: string
  errorCode: string | null
  nowEpochMs: number
}) {
  await params.env.ASTRA_PLATFORM_DB.prepare(`
    INSERT INTO article_import_jobs (
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      params.jobId,
      params.status,
      params.shadowVersion,
      params.mode,
      params.route,
      params.surface,
      params.targetHostname,
      params.decisionReason,
      params.fallbackReason,
      params.artifactRetentionClass,
      params.artifactRetentionUntilEpochMs,
      params.requestHash,
      params.requestArtifact.objectKey,
      params.responseArtifact.objectKey,
      params.sourceArtifact.objectKey,
      params.requestArtifact.bytes,
      params.responseArtifact.bytes,
      params.sourceArtifact.bytes,
      params.requestArtifact.sha256,
      params.responseArtifact.sha256,
      params.sourceArtifact.sha256,
      params.idempotencyKey,
      params.contentType,
      params.contentLength,
      params.proxyStatus,
      params.traceId,
      params.errorCode,
      params.status === "failed" ? params.errorCode : null,
      0,
      null,
      null,
      null,
      0,
      null,
      null,
      null,
      params.nowEpochMs,
      params.nowEpochMs,
    )
    .run()
}

async function updateShadowRow(params: {
  env: AstraPlatformEnv
  jobId: string
  status: "queued" | "failed" | "dead_lettered"
  errorCode?: string | null
  nowEpochMs: number
}) {
  if (params.status === "queued") {
    await params.env.ASTRA_PLATFORM_DB.prepare(`
      UPDATE article_import_jobs
      SET
        status = ?,
        error_code = ?,
        updated_at_epoch_ms = ?
      WHERE id = ? AND status = 'received'
    `)
      .bind(
        params.status,
        null,
        params.nowEpochMs,
        params.jobId,
      )
      .run()
    return
  }

  if (params.status === "dead_lettered") {
    await params.env.ASTRA_PLATFORM_DB.prepare(`
      UPDATE article_import_jobs
      SET
        status = ?,
        error_code = ?,
        last_failure_error_code = ?,
        dead_lettered_at_epoch_ms = ?,
        updated_at_epoch_ms = ?
      WHERE id = ?
    `)
      .bind(
        params.status,
        params.errorCode ?? null,
        params.errorCode ?? null,
        params.nowEpochMs,
        params.nowEpochMs,
        params.jobId,
      )
      .run()
    return
  }

  await params.env.ASTRA_PLATFORM_DB.prepare(`
    UPDATE article_import_jobs
    SET
      status = ?,
      error_code = ?,
      last_failure_error_code = ?,
      updated_at_epoch_ms = ?
    WHERE id = ?
  `)
    .bind(
      params.status,
      params.errorCode ?? null,
      params.errorCode ?? null,
      params.nowEpochMs,
      params.jobId,
    )
    .run()
}

async function persistArticleImportArtifacts(params: {
  request: Request
  response: Response
  proxyStatus: number | null
  sourceHtml?: string | null
  mode: string
  route: string
  surface: string
  targetUrl: URL
  decisionReason: string
  fallbackReason?: string | null
  env: AstraPlatformEnv
  ctx: AstraRequestContext
}): Promise<void> {
  const {
    request,
    response,
    proxyStatus,
    mode,
    route,
    surface,
    targetUrl,
    decisionReason,
    env,
    ctx,
    sourceHtml = null,
    fallbackReason = null,
  } = params
  const governance = buildArtifactGovernance(ctx)
  const contentType = request.headers.get("content-type")
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() || null
  const declaredContentLength = parseContentLength(request.headers.get("content-length"))
  let bodyBuffer: ArrayBuffer

  try {
    bodyBuffer = await readRequestBodyUpToLimit(request, ctx.config.articleImportMaxShadowBytes)
  } catch (error) {
    if (error instanceof ArticleImportBodyTooLargeError) {
      const requestHash = await sha256Hex([
        request.method,
        new URL(request.url).pathname,
        contentType ?? "",
        idempotencyKey ?? "",
      ])
      await insertShadowRow({
        env,
        jobId: crypto.randomUUID(),
        status: "skipped",
        shadowVersion: governance.shadowVersion,
        mode,
        route,
        surface,
        targetHostname: targetUrl.hostname,
        decisionReason,
        fallbackReason,
        artifactRetentionClass: governance.retentionClass,
        artifactRetentionUntilEpochMs: governance.retentionUntilEpochMs,
        requestHash,
        requestArtifact: { objectKey: null, bytes: null, sha256: null },
        responseArtifact: { objectKey: null, bytes: null, sha256: null },
        sourceArtifact: { objectKey: null, bytes: null, sha256: null },
        idempotencyKey,
        contentType,
        contentLength: declaredContentLength,
        proxyStatus,
        traceId: ctx.requestId,
        errorCode: "body_too_large",
        nowEpochMs: ctx.nowEpochMs,
      })
      return
    }
    throw error
  }

  const contentLength = declaredContentLength ?? bodyBuffer.byteLength
  const requestHash = await sha256Hex([
    request.method,
    new URL(request.url).pathname,
    contentType ?? "",
    bodyBuffer,
  ])
  const responseContentType = response.headers.get("content-type") ?? "application/octet-stream"
  const responseBuffer = await response.arrayBuffer()
  const jobId = crypto.randomUUID()
  const requestArtifact: ArticleImportArtifactDescriptor = {
    objectKey: buildObjectKey(jobId, "request.bin"),
    bytes: bodyBuffer.byteLength,
    sha256: await sha256Hex([bodyBuffer]),
  }
  const responseArtifact: ArticleImportArtifactDescriptor = {
    objectKey: buildObjectKey(jobId, "response.bin"),
    bytes: responseBuffer.byteLength,
    sha256: await sha256Hex([responseBuffer]),
  }
  const sourceArtifact: ArticleImportArtifactDescriptor = sourceHtml
    ? {
        objectKey: buildObjectKey(jobId, "source.html"),
        bytes: new TextEncoder().encode(sourceHtml).byteLength,
        sha256: await sha256Hex([sourceHtml]),
      }
    : {
        objectKey: null,
        bytes: null,
        sha256: null,
      }
  let hasDuplicateIdempotencyKey = false

  if (idempotencyKey) {
    try {
      const existing = await env.ASTRA_IDEMPOTENCY_KV.get(buildIdempotencyKvKey({
        key: idempotencyKey,
        environment: ctx.config.environment,
        requestHash,
      }))
      hasDuplicateIdempotencyKey = Boolean(existing)
    } catch (error) {
      logArticleImportShadowWarning({
        message: "article import idempotency lookup failed",
        requestId: ctx.requestId,
        error,
      })
    }
  }

  if (hasDuplicateIdempotencyKey) {
    await insertShadowRow({
      env,
      jobId,
      status: "skipped",
      shadowVersion: governance.shadowVersion,
      mode,
      route,
      surface,
      targetHostname: targetUrl.hostname,
      decisionReason,
      fallbackReason,
      artifactRetentionClass: governance.retentionClass,
      artifactRetentionUntilEpochMs: governance.retentionUntilEpochMs,
      requestHash,
      requestArtifact: { objectKey: null, bytes: null, sha256: null },
      responseArtifact: { objectKey: null, bytes: null, sha256: null },
      sourceArtifact: { objectKey: null, bytes: null, sha256: null },
      idempotencyKey,
      contentType,
      contentLength,
      proxyStatus,
      traceId: ctx.requestId,
      errorCode: "duplicate_idempotency_key",
      nowEpochMs: ctx.nowEpochMs,
    })
    return
  }

  await insertShadowRow({
    env,
    jobId,
    status: "received",
    shadowVersion: governance.shadowVersion,
    mode,
    route,
    surface,
    targetHostname: targetUrl.hostname,
    decisionReason,
    fallbackReason,
    artifactRetentionClass: governance.retentionClass,
    artifactRetentionUntilEpochMs: governance.retentionUntilEpochMs,
    requestHash,
    requestArtifact,
    responseArtifact,
    sourceArtifact,
    idempotencyKey,
    contentType,
    contentLength,
    proxyStatus,
    traceId: ctx.requestId,
    errorCode: null,
    nowEpochMs: ctx.nowEpochMs,
  })

  try {
    await env.ASTRA_IMPORT_PAYLOADS.put(requestArtifact.objectKey!, bodyBuffer, {
      httpMetadata: {
        contentType: contentType ?? "application/octet-stream",
      },
      customMetadata: buildR2CustomMetadata({
        jobId,
        requestHash,
        traceId: ctx.requestId,
        artifactType: "request",
        artifact: requestArtifact,
        mode,
        route,
        surface,
        targetHostname: targetUrl.hostname,
        governance,
        ctx,
        fallbackReason,
      }),
    })

    await env.ASTRA_IMPORT_PAYLOADS.put(responseArtifact.objectKey!, responseBuffer, {
      httpMetadata: {
        contentType: responseContentType,
      },
      customMetadata: buildR2CustomMetadata({
        jobId,
        requestHash,
        traceId: ctx.requestId,
        artifactType: "response",
        artifact: responseArtifact,
        mode,
        route,
        surface,
        targetHostname: targetUrl.hostname,
        governance,
        ctx,
        fallbackReason,
      }),
    })

    if (sourceHtml && sourceArtifact.objectKey) {
      await env.ASTRA_IMPORT_PAYLOADS.put(sourceArtifact.objectKey, sourceHtml, {
        httpMetadata: {
          contentType: "text/html; charset=utf-8",
        },
        customMetadata: buildR2CustomMetadata({
          jobId,
          requestHash,
          traceId: ctx.requestId,
          artifactType: "source",
          artifact: sourceArtifact,
          mode,
          route,
          surface,
          targetHostname: targetUrl.hostname,
          governance,
          ctx,
          fallbackReason,
        }),
      })
    }

    const message: ArticleImportQueueMessage = {
      version: ARTICLE_IMPORT_SHADOW_VERSION,
      jobId,
      requestObjectKey: requestArtifact.objectKey!,
      requestHash,
      traceId: ctx.requestId,
      receivedAtEpochMs: ctx.nowEpochMs,
    }
    await env.ARTICLE_IMPORT_QUEUE.send(message)
    await updateShadowRow({
      env,
      jobId,
      status: "queued",
      nowEpochMs: Date.now(),
    })

    if (idempotencyKey) {
      try {
        await env.ASTRA_IDEMPOTENCY_KV.put(
          buildIdempotencyKvKey({
            key: idempotencyKey,
            environment: ctx.config.environment,
            requestHash,
          }),
          jobId,
          { expirationTtl: ARTICLE_IMPORT_IDEMPOTENCY_TTL_SECONDS },
        )
      } catch (error) {
        logArticleImportShadowWarning({
          message: "article import idempotency persist failed",
          requestId: ctx.requestId,
          error,
        })
      }
    }
  } catch (error) {
    logArticleImportShadowWarning({
      message: "article import shadow capture failed",
      requestId: ctx.requestId,
      error,
    })
    await updateShadowRow({
      env,
      jobId,
      status: "failed",
      errorCode: "shadow_capture_failed",
      nowEpochMs: Date.now(),
    })
  }
}

export async function recordArticleImportOutcome(params: {
  request: Request
  proxyStatus: number | null
  mode: string
  route: string
  surface: string
  targetUrl?: URL | null
  decisionReason: string | null
  fallbackReason?: string | null
  status: "completed" | "failed" | "skipped"
  errorCode?: string | null
  env: AstraPlatformEnv
  ctx: AstraRequestContext
}): Promise<void> {
  const governance = buildArtifactGovernance(params.ctx)
  const contentType = params.request.headers.get("content-type")
  const idempotencyKey = params.request.headers.get("idempotency-key")?.trim() || null
  const contentLength = parseContentLength(params.request.headers.get("content-length"))
  const requestHash = await sha256Hex([
    params.request.method,
    new URL(params.request.url).pathname,
    contentType ?? "",
    params.targetUrl?.toString() ?? "",
    idempotencyKey ?? "",
    params.ctx.requestId,
  ])

  await insertShadowRow({
    env: params.env,
    jobId: crypto.randomUUID(),
    status: params.status,
    shadowVersion: governance.shadowVersion,
    mode: params.mode,
    route: params.route,
    surface: params.surface,
    targetHostname: params.targetUrl?.hostname ?? null,
    decisionReason: params.decisionReason,
    fallbackReason: params.fallbackReason ?? null,
    artifactRetentionClass: governance.retentionClass,
    artifactRetentionUntilEpochMs: governance.retentionUntilEpochMs,
    requestHash,
    requestArtifact: { objectKey: null, bytes: null, sha256: null },
    responseArtifact: { objectKey: null, bytes: null, sha256: null },
    sourceArtifact: { objectKey: null, bytes: null, sha256: null },
    idempotencyKey,
    contentType,
    contentLength,
    proxyStatus: params.proxyStatus,
    traceId: params.ctx.requestId,
    errorCode: params.errorCode ?? null,
    nowEpochMs: params.ctx.nowEpochMs,
  })
}

export async function mirrorArticleImportShadow(params: {
  request: Request
  response: Response
  proxyStatus: number
  mode: string
  route: string
  surface: string
  targetUrl: URL
  decisionReason: string
  fallbackReason?: string | null
  env: AstraPlatformEnv
  ctx: AstraRequestContext
}): Promise<void> {
  await persistArticleImportArtifacts(params)
}

export async function captureArticleImportArtifacts(params: {
  request: Request
  response: Response
  proxyStatus: number | null
  sourceHtml?: string | null
  mode: string
  route: string
  surface: string
  targetUrl: URL
  decisionReason: string
  fallbackReason?: string | null
  env: AstraPlatformEnv
  ctx: AstraRequestContext
}): Promise<void> {
  await persistArticleImportArtifacts(params)
}
