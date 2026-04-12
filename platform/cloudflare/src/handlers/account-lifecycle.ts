import {
  AstraAccountExportRequestSchema,
  AstraCloudDataDeleteRequestSchema,
} from "../../../../src/types/auth"
import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv } from "../env"
import { toAstraAccountExportJob, toAstraCloudDataDeleteJob } from "../lib/continuity-lifecycle"
import { errorResponse, jsonResponse, withResponseHeaders } from "../lib/http"
import {
  ShadowSessionAuthError,
  ShadowSessionUnavailableError,
  validateShadowSession,
} from "../lib/session-auth"
import { recordPlatformRouteEventLater } from "../lib/platform-ops"
import {
  createContinuityDeleteJob,
  createContinuityExportJob,
  getContinuityDeleteJob,
  getContinuityExportJob,
  markContinuityDeleteJobQueued,
  markContinuityExportJobExpired,
} from "../repositories/continuity-lifecycle"
import type { ContinuityDeleteCollection, ContinuityExportCollection } from "../types/continuity-lifecycle"

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60

function buildLifecycleResponseHeaders(ctx: AstraRequestContext, route: string): HeadersInit {
  return {
    "x-astra-request-id": ctx.requestId,
    "x-astra-platform-route": route,
    "x-astra-platform-mode": "native",
    "x-astra-platform-domain": "continuity-lifecycle",
  }
}

function tagLifecycleResponse(response: Response, ctx: AstraRequestContext, route: string): Response {
  return withResponseHeaders(response, buildLifecycleResponseHeaders(ctx, route))
}

function lifecycleKvKey(kind: "export" | "cloud-data-delete", userId: string, idempotencyKey: string): string {
  return `continuity-lifecycle:${kind}:${userId}:${idempotencyKey}`
}

function normalizeExportCollections(input: unknown): ContinuityExportCollection[] {
  const parsed = AstraAccountExportRequestSchema.parse(input)
  return [...new Set(parsed.collections)]
}

function normalizeDeleteCollections(input: unknown): ContinuityDeleteCollection[] {
  const parsed = AstraCloudDataDeleteRequestSchema.parse(input)
  return [...new Set(parsed.collections)]
}

async function readJsonBody(request: Request): Promise<unknown> {
  const raw = (await request.text()).trim()
  return raw ? JSON.parse(raw) : {}
}

async function requireValidatedSession(request: Request, env: AstraPlatformEnv, ctx: AstraRequestContext) {
  return validateShadowSession(request, env, ctx, {
    requireDeviceHeader: true,
    requireAuthenticatedIdentity: true,
  })
}

function handleSessionAuthError(error: unknown, ctx: AstraRequestContext, route: string): Response | null {
  if (error instanceof ShadowSessionAuthError) {
    return tagLifecycleResponse(
      errorResponse(error.status, error.code, error.message, ctx.requestId),
      ctx,
      route,
    )
  }
  if (error instanceof ShadowSessionUnavailableError) {
    return tagLifecycleResponse(
      errorResponse(503, "SHADOW_UNAVAILABLE", error.message, ctx.requestId),
      ctx,
      route,
    )
  }
  return null
}

function recordLifecycleRoute(
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
  route: string,
  responseStatus: number,
  metadata?: Record<string, unknown>,
) {
  recordPlatformRouteEventLater({
    env,
    ctx,
    domain: "continuity-lifecycle",
    route,
    mode: "native",
    responseStatus,
    metadata,
  })
}

export async function handleAccountExportCreate(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
): Promise<Response> {
  const route = "account-export-create"
  try {
    const validated = await requireValidatedSession(request, env, ctx)
    const collections = normalizeExportCollections(await readJsonBody(request))
    const nowIso = new Date(ctx.nowEpochMs).toISOString()
    const idempotencyKey = request.headers.get("idempotency-key")?.trim() || null

    if (idempotencyKey) {
      const existingJobId = await env.ASTRA_IDEMPOTENCY_KV.get(lifecycleKvKey("export", validated.shadowUser.id, idempotencyKey))
      if (existingJobId) {
        const existingJob = await getContinuityExportJob(env.ASTRA_PLATFORM_DB, existingJobId)
        if (existingJob && existingJob.userId === validated.shadowUser.id) {
          const response = tagLifecycleResponse(jsonResponse(toAstraAccountExportJob(existingJob, ctx.config), { status: 200 }), ctx, route)
          recordLifecycleRoute(env, ctx, route, 200, { idempotent: true, jobId: existingJob.jobId })
          return response
        }
      }
    }

    if (!env.CONTINUITY_LIFECYCLE_QUEUE) {
      const response = tagLifecycleResponse(errorResponse(503, "LIFECYCLE_QUEUE_UNAVAILABLE", "Continuity lifecycle queue is not configured.", ctx.requestId), ctx, route)
      recordLifecycleRoute(env, ctx, route, 503)
      return response
    }

    const job = await createContinuityExportJob(env.ASTRA_PLATFORM_DB, {
      jobId: crypto.randomUUID(),
      userId: validated.shadowUser.id,
      requestedByDeviceId: validated.currentDevice.deviceId,
      scope: { collections },
      requestedAt: nowIso,
    })

    await env.CONTINUITY_LIFECYCLE_QUEUE.send({
      version: 1,
      kind: "export",
      jobId: job.jobId,
      userId: job.userId,
      enqueuedAt: nowIso,
    })

    if (idempotencyKey) {
      await env.ASTRA_IDEMPOTENCY_KV.put(
        lifecycleKvKey("export", validated.shadowUser.id, idempotencyKey),
        job.jobId,
        { expirationTtl: IDEMPOTENCY_TTL_SECONDS },
      )
    }

    const response = tagLifecycleResponse(jsonResponse(toAstraAccountExportJob(job, ctx.config), { status: 202 }), ctx, route)
    recordLifecycleRoute(env, ctx, route, 202, { jobId: job.jobId, collections })
    return response
  } catch (error) {
    const authResponse = handleSessionAuthError(error, ctx, route)
    if (authResponse) {
      recordLifecycleRoute(env, ctx, route, authResponse.status)
      return authResponse
    }
    throw error
  }
}

export async function handleAccountExportStatus(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
  jobId: string,
): Promise<Response> {
  const route = "account-export-status"
  try {
    const validated = await requireValidatedSession(request, env, ctx)
    const job = await getContinuityExportJob(env.ASTRA_PLATFORM_DB, jobId)
    if (!job || job.userId !== validated.shadowUser.id) {
      const response = tagLifecycleResponse(errorResponse(404, "EXPORT_JOB_NOT_FOUND", "Export job not found.", ctx.requestId), ctx, route)
      recordLifecycleRoute(env, ctx, route, 404)
      return response
    }

    const nowIso = new Date(ctx.nowEpochMs).toISOString()
    if (job.status === "completed" && job.expiresAt && job.expiresAt <= nowIso) {
      await markContinuityExportJobExpired(env.ASTRA_PLATFORM_DB, {
        jobId: job.jobId,
        expiredAt: nowIso,
      })
    }

    const refreshed = await getContinuityExportJob(env.ASTRA_PLATFORM_DB, jobId)
    const response = tagLifecycleResponse(jsonResponse(toAstraAccountExportJob(refreshed ?? job, ctx.config), { status: 200 }), ctx, route)
    recordLifecycleRoute(env, ctx, route, 200, { jobId })
    return response
  } catch (error) {
    const authResponse = handleSessionAuthError(error, ctx, route)
    if (authResponse) {
      recordLifecycleRoute(env, ctx, route, authResponse.status)
      return authResponse
    }
    throw error
  }
}

export async function handleAccountExportDownload(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
  jobId: string,
): Promise<Response> {
  const route = "account-export-download"
  try {
    const validated = await requireValidatedSession(request, env, ctx)
    const job = await getContinuityExportJob(env.ASTRA_PLATFORM_DB, jobId)
    if (!job || job.userId !== validated.shadowUser.id) {
      const response = tagLifecycleResponse(errorResponse(404, "EXPORT_JOB_NOT_FOUND", "Export job not found.", ctx.requestId), ctx, route)
      recordLifecycleRoute(env, ctx, route, 404)
      return response
    }
    if (job.status !== "completed" || !job.artifactObjectKey) {
      const response = tagLifecycleResponse(errorResponse(409, "EXPORT_NOT_READY", "Export artifact is not ready.", ctx.requestId), ctx, route)
      recordLifecycleRoute(env, ctx, route, 409, { jobId })
      return response
    }
    if (job.expiresAt && job.expiresAt <= new Date(ctx.nowEpochMs).toISOString()) {
      const response = tagLifecycleResponse(errorResponse(410, "EXPORT_EXPIRED", "Export artifact has expired.", ctx.requestId), ctx, route)
      recordLifecycleRoute(env, ctx, route, 410, { jobId })
      return response
    }
    if (!env.ASTRA_IMPORT_PAYLOADS.get) {
      const response = tagLifecycleResponse(errorResponse(503, "EXPORT_DOWNLOAD_UNAVAILABLE", "R2 download support is not configured.", ctx.requestId), ctx, route)
      recordLifecycleRoute(env, ctx, route, 503, { jobId })
      return response
    }

    const object = await env.ASTRA_IMPORT_PAYLOADS.get(job.artifactObjectKey)
    if (!object) {
      const response = tagLifecycleResponse(errorResponse(404, "EXPORT_ARTIFACT_MISSING", "Export artifact is missing.", ctx.requestId), ctx, route)
      recordLifecycleRoute(env, ctx, route, 404, { jobId })
      return response
    }

    const response = tagLifecycleResponse(new Response(await object.arrayBuffer(), {
      status: 200,
      headers: {
        "content-type": object.httpMetadata?.contentType ?? "application/json",
        "content-disposition": `attachment; filename="astra-continuity-export-${job.jobId}.json"`,
      },
    }), ctx, route)
    recordLifecycleRoute(env, ctx, route, 200, { jobId })
    return response
  } catch (error) {
    const authResponse = handleSessionAuthError(error, ctx, route)
    if (authResponse) {
      recordLifecycleRoute(env, ctx, route, authResponse.status)
      return authResponse
    }
    throw error
  }
}

export async function handleCloudDataDeleteCreate(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
): Promise<Response> {
  const route = "cloud-data-delete-create"
  try {
    const validated = await requireValidatedSession(request, env, ctx)
    const collections = normalizeDeleteCollections(await readJsonBody(request))
    const nowIso = new Date(ctx.nowEpochMs).toISOString()
    const scheduledForAt = new Date(ctx.nowEpochMs + (ctx.config.continuityDeleteGracePeriodSeconds * 1000)).toISOString()
    const idempotencyKey = request.headers.get("idempotency-key")?.trim() || null

    if (idempotencyKey) {
      const existingJobId = await env.ASTRA_IDEMPOTENCY_KV.get(lifecycleKvKey("cloud-data-delete", validated.shadowUser.id, idempotencyKey))
      if (existingJobId) {
        const existingJob = await getContinuityDeleteJob(env.ASTRA_PLATFORM_DB, existingJobId)
        if (existingJob && existingJob.userId === validated.shadowUser.id) {
          const response = tagLifecycleResponse(jsonResponse(toAstraCloudDataDeleteJob(existingJob, ctx.config), { status: 200 }), ctx, route)
          recordLifecycleRoute(env, ctx, route, 200, { idempotent: true, jobId: existingJob.jobId })
          return response
        }
      }
    }

    const job = await createContinuityDeleteJob(env.ASTRA_PLATFORM_DB, {
      jobId: crypto.randomUUID(),
      userId: validated.shadowUser.id,
      requestedByDeviceId: validated.currentDevice.deviceId,
      scope: { collections },
      requestedAt: nowIso,
      scheduledForAt,
      gracePeriodSeconds: ctx.config.continuityDeleteGracePeriodSeconds,
    })

    if (idempotencyKey) {
      await env.ASTRA_IDEMPOTENCY_KV.put(
        lifecycleKvKey("cloud-data-delete", validated.shadowUser.id, idempotencyKey),
        job.jobId,
        { expirationTtl: IDEMPOTENCY_TTL_SECONDS },
      )
    }

    const response = tagLifecycleResponse(jsonResponse(toAstraCloudDataDeleteJob(job, ctx.config), { status: 202 }), ctx, route)
    recordLifecycleRoute(env, ctx, route, 202, { jobId: job.jobId, collections })
    return response
  } catch (error) {
    const authResponse = handleSessionAuthError(error, ctx, route)
    if (authResponse) {
      recordLifecycleRoute(env, ctx, route, authResponse.status)
      return authResponse
    }
    throw error
  }
}

export async function handleCloudDataDeleteStatus(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
  jobId: string,
): Promise<Response> {
  const route = "cloud-data-delete-status"
  try {
    const validated = await requireValidatedSession(request, env, ctx)
    const job = await getContinuityDeleteJob(env.ASTRA_PLATFORM_DB, jobId)
    if (!job || job.userId !== validated.shadowUser.id) {
      const response = tagLifecycleResponse(errorResponse(404, "DELETE_JOB_NOT_FOUND", "Delete job not found.", ctx.requestId), ctx, route)
      recordLifecycleRoute(env, ctx, route, 404)
      return response
    }

    if (job.status === "scheduled" && Date.parse(job.scheduledForAt) <= ctx.nowEpochMs) {
      if (!env.CONTINUITY_LIFECYCLE_QUEUE) {
        const response = tagLifecycleResponse(errorResponse(503, "LIFECYCLE_QUEUE_UNAVAILABLE", "Continuity lifecycle queue is not configured.", ctx.requestId), ctx, route)
        recordLifecycleRoute(env, ctx, route, 503)
        return response
      }
      await markContinuityDeleteJobQueued(env.ASTRA_PLATFORM_DB, {
        jobId: job.jobId,
        queuedAt: new Date(ctx.nowEpochMs).toISOString(),
      })
      await env.CONTINUITY_LIFECYCLE_QUEUE.send({
        version: 1,
        kind: "cloud-data-delete",
        jobId: job.jobId,
        userId: job.userId,
        enqueuedAt: new Date(ctx.nowEpochMs).toISOString(),
      })
    }

    const refreshed = await getContinuityDeleteJob(env.ASTRA_PLATFORM_DB, jobId)
    const response = tagLifecycleResponse(jsonResponse(toAstraCloudDataDeleteJob(refreshed ?? job, ctx.config), { status: 200 }), ctx, route)
    recordLifecycleRoute(env, ctx, route, 200, { jobId })
    return response
  } catch (error) {
    const authResponse = handleSessionAuthError(error, ctx, route)
    if (authResponse) {
      recordLifecycleRoute(env, ctx, route, authResponse.status)
      return authResponse
    }
    throw error
  }
}
