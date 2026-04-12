import { z } from "zod"

import {
  AstraSyncPullResponseSchema,
  type AstraSyncPullResponse,
} from "../../../../src/types/auth"
import type { AstraSyncCollection } from "../../../../src/types/config"
import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv, SyncPullReadMode } from "../env"
import { errorResponse, jsonResponse, withResponseHeaders } from "../lib/http"
import {
  ShadowSessionAuthError,
  ShadowSessionUnavailableError,
  touchValidatedShadowSessionLater,
  type ValidatedShadowSession,
  validateShadowSession,
} from "../lib/session-auth"
import { recordPlatformParityEventLater, recordPlatformRouteEventLater } from "../lib/platform-ops"
import {
  buildNodeRelayDownstreamHeaders,
  buildNodeRelayHeaders,
  fetchNodeRelay,
  proxyToNodeRelay,
  toNodeRelayUrl,
} from "../lib/proxy"
import { getShadowDevice } from "../repositories/devices"
import { getShadowSessionById } from "../repositories/sessions"
import {
  listShadowSyncCollectionRowsForUser,
  pullShadowSyncMutations,
} from "../repositories/sync"
import { SHADOW_SYNC_COLLECTIONS, type ShadowSyncMutationRow } from "../types/shadow-state"

const SyncPullRequestSchema = z.object({
  cursors: z.object({
    config: z.string().trim().min(1).nullable().optional(),
    vocabulary: z.string().trim().min(1).nullable().optional(),
    reading_history: z.string().trim().min(1).nullable().optional(),
    study_progress: z.string().trim().min(1).nullable().optional(),
  }).partial().default({}),
}).default({ cursors: {} })

type SyncPullCursors = Partial<Record<AstraSyncCollection, string | null>>

class ShadowSyncPullUnavailableError extends Error {
  constructor(readonly reason: string, message: string) {
    super(message)
    this.name = "ShadowSyncPullUnavailableError"
  }
}

class ShadowSyncCursorExpiredError extends Error {
  constructor(
    readonly collection: AstraSyncCollection,
    readonly requestedCursor: string | null,
    readonly compactionFloorCursor: string,
  ) {
    super(`Sync cursor for ${collection} is older than the compaction floor.`)
    this.name = "ShadowSyncCursorExpiredError"
  }
}

function tagSyncPullResponse(
  response: Response,
  ctx: AstraRequestContext,
  params: {
    route: string
    mode: SyncPullReadMode
    fallbackReason?: string | null
  },
): Response {
  const headers: Record<string, string> = {
    "x-astra-request-id": ctx.requestId,
    "x-astra-platform-route": params.route,
    "x-astra-platform-mode": params.mode,
    "x-astra-platform-default-mode": ctx.config.syncPullReadMode,
    "x-astra-platform-domain": "sync-pull",
  }

  if (params.fallbackReason) {
    headers["x-astra-platform-fallback-reason"] = params.fallbackReason
  }

  return withResponseHeaders(response, headers)
}

function logSyncPullRouteEvent(params: {
  requestId: string
  route: string
  mode: SyncPullReadMode
  responseStatus: number
  fallbackReason?: string | null
}) {
  console.log(JSON.stringify({
    message: "sync pull route handled",
    requestId: params.requestId,
    route: params.route,
    mode: params.mode,
    responseStatus: params.responseStatus,
    fallbackReason: params.fallbackReason ?? null,
  }))
}

function normalizeSyncPullMutation(mutation: AstraSyncPullResponse["deltas"]["config"][number]) {
  return {
    serverMutationId: mutation.serverMutationId,
    collection: mutation.collection,
    schemaVersion: mutation.schemaVersion,
    recordId: mutation.recordId,
    operation: mutation.operation,
    clientMutationId: mutation.clientMutationId,
    deviceId: mutation.deviceId,
    clientUpdatedAt: mutation.clientUpdatedAt,
    serverUpdatedAt: mutation.serverUpdatedAt,
    cursor: mutation.cursor,
    payload: mutation.payload ?? null,
  }
}

function normalizeSyncPull(pull: AstraSyncPullResponse) {
  return {
    deltas: {
      config: pull.deltas.config.map(normalizeSyncPullMutation),
      vocabulary: pull.deltas.vocabulary.map(normalizeSyncPullMutation),
      reading_history: pull.deltas.reading_history.map(normalizeSyncPullMutation),
      study_progress: pull.deltas.study_progress.map(normalizeSyncPullMutation),
    },
    nextCursors: pull.nextCursors,
  }
}

function mapShadowMutationToNodeShape(
  mutation: ShadowSyncMutationRow,
  params: {
    ownerId: string
    email: string
  },
) {
  return {
    ownerId: params.ownerId,
    email: params.email,
    serverMutationId: mutation.serverMutationId,
    serverUpdatedAt: mutation.serverUpdatedAt,
    cursor: mutation.cursor,
    collection: mutation.collection,
    schemaVersion: mutation.schemaVersion,
    recordId: mutation.recordId,
    operation: mutation.operation,
    clientMutationId: mutation.clientMutationId,
    deviceId: mutation.deviceId,
    clientUpdatedAt: mutation.clientUpdatedAt,
    payload: mutation.payload ?? null,
  }
}

function mapShadowPullToNodeShape(
  shadow: Awaited<ReturnType<typeof pullShadowSyncMutations>>,
  params: {
    ownerId: string
    email: string
  },
): AstraSyncPullResponse {
  return AstraSyncPullResponseSchema.parse({
    serverTime: shadow.serverTime,
    deltas: {
      config: shadow.deltas.config.map((mutation) => mapShadowMutationToNodeShape(mutation, params)),
      vocabulary: shadow.deltas.vocabulary.map((mutation) => mapShadowMutationToNodeShape(mutation, params)),
      reading_history: shadow.deltas.reading_history.map((mutation) => mapShadowMutationToNodeShape(mutation, params)),
      study_progress: shadow.deltas.study_progress.map((mutation) => mapShadowMutationToNodeShape(mutation, params)),
    },
    nextCursors: shadow.nextCursors,
  })
}

function computeLimitPerCollection(pull: AstraSyncPullResponse): number {
  return Math.max(
    500,
    pull.deltas.config.length,
    pull.deltas.vocabulary.length,
    pull.deltas.reading_history.length,
    pull.deltas.study_progress.length,
  )
}

async function fetchAuthoritativePullFromNode(
  request: Request,
  ctx: AstraRequestContext,
): Promise<{ response: Response; pull: AstraSyncPullResponse | null }> {
  const upstreamResponse = await fetchNodeRelay(request, ctx)
  const response = new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: buildNodeRelayDownstreamHeaders(upstreamResponse, ctx.requestId),
  })

  if (!response.ok) {
    return {
      response,
      pull: null,
    }
  }

  const pull = AstraSyncPullResponseSchema.parse(await response.clone().json())
  return {
    response,
    pull,
  }
}

async function readSyncPullRequest(request: Request): Promise<{ cursors: SyncPullCursors }> {
  const raw = (await request.text()).trim()
  return SyncPullRequestSchema.parse(raw ? JSON.parse(raw) : {})
}

async function readShadowSyncPull(
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
  validated: ValidatedShadowSession,
  params: {
    cursors: SyncPullCursors
    limitPerCollection: number
    serverTime: string
  },
): Promise<AstraSyncPullResponse> {
  const [shadowSession, currentDevice, collectionRows, shadowPull] = await Promise.all([
    getShadowSessionById(env.ASTRA_PLATFORM_DB, validated.shadowSession.sessionId),
    getShadowDevice(env.ASTRA_PLATFORM_DB, validated.shadowUser.id, validated.currentDevice.deviceId),
    listShadowSyncCollectionRowsForUser(env.ASTRA_PLATFORM_DB, validated.shadowUser.id),
    pullShadowSyncMutations(env.ASTRA_PLATFORM_DB, {
      userId: validated.shadowUser.id,
      cursors: params.cursors,
      limitPerCollection: params.limitPerCollection,
      serverTime: params.serverTime,
    }),
  ])

  if (!shadowSession) {
    throw new ShadowSyncPullUnavailableError(
      "missing_shadow_session",
      `No D1 shadow session was found for ${validated.shadowSession.sessionId}.`,
    )
  }
  if (shadowSession.userId !== validated.shadowUser.id || shadowSession.deviceId !== validated.currentDevice.deviceId) {
    throw new ShadowSyncPullUnavailableError("shadow_session_mismatch", "The D1 shadow session does not match the validated Astra session.")
  }
  if (shadowSession.status !== "active" || shadowSession.revokedAt) {
    throw new ShadowSyncPullUnavailableError("shadow_session_inactive", "The D1 shadow session is not active.")
  }
  if (shadowSession.expiresAt && shadowSession.expiresAt <= new Date(ctx.nowEpochMs).toISOString()) {
    throw new ShadowSyncPullUnavailableError("shadow_session_expired", "The D1 shadow session has expired.")
  }
  if (!currentDevice) {
    throw new ShadowSyncPullUnavailableError(
      "missing_shadow_device",
      `No D1 shadow device was found for ${validated.currentDevice.deviceId}.`,
    )
  }
  if (currentDevice.status !== "active" || currentDevice.revokedAt) {
    throw new ShadowSyncPullUnavailableError("shadow_device_inactive", "The D1 shadow device is not active.")
  }

  const collectionSet = new Set(collectionRows.map((row) => row.collection))
  if (!SHADOW_SYNC_COLLECTIONS.every((collection) => collectionSet.has(collection))) {
    throw new ShadowSyncPullUnavailableError("missing_shadow_sync_collections", "The D1 sync pull shadow state is incomplete.")
  }

  const readingHistoryCollection = collectionRows.find((row) => row.collection === "reading_history")
  const studyProgressCollection = collectionRows.find((row) => row.collection === "study_progress")
  if (!readingHistoryCollection || !studyProgressCollection) {
    throw new ShadowSyncPullUnavailableError("missing_shadow_sync_collections", "The D1 sync pull shadow state is incomplete.")
  }

  if (readingHistoryCollection.enabled !== validated.shadowUser.syncPreferences.reading_history
    || studyProgressCollection.enabled !== validated.shadowUser.syncPreferences.study_progress) {
    throw new ShadowSyncPullUnavailableError("shadow_sync_preferences_mismatch", "The D1 sync pull shadow state does not match the user sync preferences.")
  }

  if (shadowPull.cursorExpired) {
    throw new ShadowSyncCursorExpiredError(
      shadowPull.cursorExpired.collection,
      shadowPull.cursorExpired.requestedCursor,
      shadowPull.cursorExpired.compactionFloorCursor,
    )
  }

  return mapShadowPullToNodeShape(shadowPull, {
    ownerId: validated.shadowUser.id,
    email: validated.shadowUser.email,
  })
}

async function compareShadowReadToNode(params: {
  request: Request
  env: AstraPlatformEnv
  ctx: AstraRequestContext
  nodePull: AstraSyncPullResponse
}) {
  try {
    const payload = await readSyncPullRequest(params.request)
    const validated = await validateShadowSession(params.request, params.env, params.ctx, {
      requireDeviceHeader: true,
      requireAuthenticatedIdentity: true,
    })
    const shadowPull = await readShadowSyncPull(params.env, params.ctx, validated, {
      cursors: payload.cursors,
      limitPerCollection: computeLimitPerCollection(params.nodePull),
      serverTime: params.nodePull.serverTime,
    })
    const nodeValue = normalizeSyncPull(params.nodePull)
    const shadowValue = normalizeSyncPull(shadowPull)

    if (JSON.stringify(nodeValue) !== JSON.stringify(shadowValue)) {
      console.log(JSON.stringify({
        message: "sync pull shadow compare mismatch",
        requestId: params.ctx.requestId,
        nodeValue,
        shadowValue,
      }))
      recordPlatformParityEventLater({
        env: params.env,
        ctx: params.ctx,
        domain: "sync-pull",
        outcome: "parity_mismatch",
        scope: "shadow_compare",
        metadata: {
          requestCursorKeys: Object.keys(payload.cursors),
        },
      })
    }
  } catch (error) {
    console.log(JSON.stringify({
      message: "sync pull shadow compare failed",
      requestId: params.ctx.requestId,
      error: error instanceof Error ? error.message : String(error),
    }))
    recordPlatformParityEventLater({
      env: params.env,
      ctx: params.ctx,
      domain: "sync-pull",
      outcome: "compare_failed",
      scope: "shadow_compare",
      metadata: {
        error: error instanceof Error ? error.message : String(error),
      },
    })
  }
}

async function compareNativeReadToNode(params: {
  env: AstraPlatformEnv
  ctx: AstraRequestContext
  nativePull: AstraSyncPullResponse
  nodePull: AstraSyncPullResponse
}) {
  try {
    const nativeValue = normalizeSyncPull(params.nativePull)
    const nodeValue = normalizeSyncPull(params.nodePull)

    if (JSON.stringify(nativeValue) !== JSON.stringify(nodeValue)) {
      console.log(JSON.stringify({
        message: "sync pull native compare mismatch",
        requestId: params.ctx.requestId,
        nativeValue,
        nodeValue,
      }))
      recordPlatformParityEventLater({
        env: params.env,
        ctx: params.ctx,
        domain: "sync-pull",
        outcome: "parity_mismatch",
        scope: "native_compare",
        metadata: {
          nativeConfigDeltaCount: params.nativePull.deltas.config.length,
          nodeConfigDeltaCount: params.nodePull.deltas.config.length,
        },
      })
    }
  } catch (error) {
    console.log(JSON.stringify({
      message: "sync pull native compare failed",
      requestId: params.ctx.requestId,
      error: error instanceof Error ? error.message : String(error),
    }))
    recordPlatformParityEventLater({
      env: params.env,
      ctx: params.ctx,
      domain: "sync-pull",
      outcome: "compare_failed",
      scope: "native_compare",
      metadata: {
        error: error instanceof Error ? error.message : String(error),
      },
    })
  }
}

async function proxySyncPull(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
  params: {
    route: string
    mode: SyncPullReadMode
    fallbackReason?: string | null
  },
): Promise<Response> {
  const response = tagSyncPullResponse(
    await proxyToNodeRelay(request, env, ctx),
    ctx,
    params,
  )
  logSyncPullRouteEvent({
    requestId: ctx.requestId,
    route: params.route,
    mode: params.mode,
    responseStatus: response.status,
    fallbackReason: params.fallbackReason,
  })
  recordPlatformRouteEventLater({
    env,
    ctx,
    domain: "sync-pull",
    route: params.route,
    mode: params.mode,
    responseStatus: response.status,
    fallbackReason: params.fallbackReason,
  })
  return response
}

function cursorExpiredResponse(
  ctx: AstraRequestContext,
  mode: SyncPullReadMode,
  error: ShadowSyncCursorExpiredError,
): Response {
  return tagSyncPullResponse(
    jsonResponse({
      error: {
        code: "CURSOR_EXPIRED",
        message: `Sync cursor for ${error.collection} is older than the compaction floor. Repair from cloud before retrying pull.`,
        requestId: ctx.requestId,
        details: {
          collection: error.collection,
          requestedCursor: error.requestedCursor,
          compactionFloorCursor: error.compactionFloorCursor,
        },
      },
    }, { status: 409 }),
    ctx,
    {
      route: "native",
      mode,
    },
  )
}

export async function handleSyncPull(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
): Promise<Response> {
  const mode = ctx.config.syncPullReadMode

  if (mode === "proxy") {
    return proxySyncPull(request, env, ctx, {
      route: "proxy",
      mode,
    })
  }

  if (mode === "shadow") {
    const compareRequest = request.clone()
    const proxyResponse = await proxyToNodeRelay(request, env, ctx)
    const tagged = tagSyncPullResponse(proxyResponse, ctx, {
      route: "shadow-proxy",
      mode,
    })

    if (tagged.ok) {
      ctx.execution.waitUntil((async () => {
        try {
          const payload = AstraSyncPullResponseSchema.parse(await tagged.clone().json())
          await compareShadowReadToNode({
            request: compareRequest,
            env,
            ctx,
            nodePull: payload,
          })
        } catch (error) {
          console.log(JSON.stringify({
            message: "sync pull shadow response compare failed",
            requestId: ctx.requestId,
            error: error instanceof Error ? error.message : String(error),
          }))
        }
      })())
    }

    logSyncPullRouteEvent({
      requestId: ctx.requestId,
      route: "shadow-proxy",
      mode,
      responseStatus: tagged.status,
    })
    recordPlatformRouteEventLater({
      env,
      ctx,
      domain: "sync-pull",
      route: "shadow-proxy",
      mode,
      responseStatus: tagged.status,
    })
    return tagged
  }

  let validatedSession: ValidatedShadowSession
  try {
    validatedSession = await validateShadowSession(request.clone(), env, ctx, {
      requireDeviceHeader: true,
      requireAuthenticatedIdentity: true,
    })
  } catch (error) {
    if (error instanceof ShadowSessionAuthError) {
      const response = tagSyncPullResponse(
        errorResponse(error.status, error.code, error.message, ctx.requestId),
        ctx,
        {
          route: "native-auth-gate",
          mode,
        },
      )
      logSyncPullRouteEvent({
        requestId: ctx.requestId,
        route: "native-auth-gate",
        mode,
        responseStatus: response.status,
      })
      recordPlatformRouteEventLater({
        env,
        ctx,
        domain: "sync-pull",
        route: "native-auth-gate",
        mode,
        responseStatus: response.status,
      })
      return response
    }

    if (error instanceof ShadowSessionUnavailableError) {
      return proxySyncPull(request, env, ctx, {
        route: "native-fallback-proxy",
        mode,
        fallbackReason: error.reason,
      })
    }

    return proxySyncPull(request, env, ctx, {
      route: "native-fallback-proxy",
      mode,
      fallbackReason: "shadow_read_failed",
    })
  }

  let authoritativePull: AstraSyncPullResponse | null = null
  let authoritativePullResponse: Response | null = null
  try {
    const authoritativeResult = await fetchAuthoritativePullFromNode(request.clone(), ctx)
    authoritativePullResponse = authoritativeResult.response
    if (!authoritativeResult.pull) {
      const taggedGateError = tagSyncPullResponse(authoritativeResult.response, ctx, {
        route: "native-authoritative-gate",
        mode,
      })
      logSyncPullRouteEvent({
        requestId: ctx.requestId,
        route: "native-authoritative-gate",
        mode,
        responseStatus: taggedGateError.status,
      })
      recordPlatformRouteEventLater({
        env,
        ctx,
        domain: "sync-pull",
        route: "native-authoritative-gate",
        mode,
        responseStatus: taggedGateError.status,
      })
      return taggedGateError
    }

    authoritativePull = authoritativeResult.pull
  } catch {
    return proxySyncPull(request, env, ctx, {
      route: "native-fallback-proxy",
      mode,
      fallbackReason: "authoritative_upstream_unavailable",
    })
  }

  const validatedSessionValue = validatedSession
  const authoritativePullValue = authoritativePull

  if (!validatedSessionValue || !authoritativePullValue) {
    return proxySyncPull(request, env, ctx, {
      route: "native-fallback-proxy",
      mode,
      fallbackReason: "shadow_read_failed",
    })
  }

  try {
    const payload = await readSyncPullRequest(request.clone())
    const pull = await readShadowSyncPull(env, ctx, validatedSessionValue, {
      cursors: payload.cursors,
      limitPerCollection: computeLimitPerCollection(authoritativePullValue),
      serverTime: authoritativePullValue.serverTime,
    })
    touchValidatedShadowSessionLater(env, ctx, validatedSessionValue)
    const response = tagSyncPullResponse(
      jsonResponse(pull),
      ctx,
      {
        route: "native",
        mode,
      },
    )

    ctx.execution.waitUntil(compareNativeReadToNode({
      env,
      ctx,
      nativePull: pull,
      nodePull: authoritativePullValue,
    }))

    logSyncPullRouteEvent({
      requestId: ctx.requestId,
      route: "native",
      mode,
      responseStatus: response.status,
    })
    recordPlatformRouteEventLater({
      env,
      ctx,
      domain: "sync-pull",
      route: "native",
      mode,
      responseStatus: response.status,
    })
    return response
  } catch (error) {
    if (error instanceof ShadowSyncCursorExpiredError) {
      const response = cursorExpiredResponse(ctx, mode, error)
      logSyncPullRouteEvent({
        requestId: ctx.requestId,
        route: "native",
        mode,
        responseStatus: response.status,
      })
      recordPlatformRouteEventLater({
        env,
        ctx,
        domain: "sync-pull",
        route: "native",
        mode,
        responseStatus: response.status,
      })
      return response
    }

    if (error instanceof ShadowSyncPullUnavailableError && authoritativePullResponse) {
      const taggedFallback = tagSyncPullResponse(authoritativePullResponse, ctx, {
        route: "native-fallback-proxy",
        mode,
        fallbackReason: error.reason,
      })
      logSyncPullRouteEvent({
        requestId: ctx.requestId,
        route: "native-fallback-proxy",
        mode,
        responseStatus: taggedFallback.status,
        fallbackReason: error.reason,
      })
      recordPlatformRouteEventLater({
        env,
        ctx,
        domain: "sync-pull",
        route: "native-fallback-proxy",
        mode,
        responseStatus: taggedFallback.status,
        fallbackReason: error.reason,
      })
      return taggedFallback
    }

    console.log(JSON.stringify({
      message: "sync pull native read failed",
      requestId: ctx.requestId,
      error: error instanceof Error ? error.message : String(error),
    }))

    if (authoritativePullResponse) {
      const taggedFallback = tagSyncPullResponse(authoritativePullResponse, ctx, {
        route: "native-fallback-proxy",
        mode,
        fallbackReason: "shadow_read_failed",
      })
      logSyncPullRouteEvent({
        requestId: ctx.requestId,
        route: "native-fallback-proxy",
        mode,
        responseStatus: taggedFallback.status,
        fallbackReason: "shadow_read_failed",
      })
      recordPlatformRouteEventLater({
        env,
        ctx,
        domain: "sync-pull",
        route: "native-fallback-proxy",
        mode,
        responseStatus: taggedFallback.status,
        fallbackReason: "shadow_read_failed",
      })
      return taggedFallback
    }

    return proxySyncPull(request, env, ctx, {
      route: "native-fallback-proxy",
      mode,
      fallbackReason: "shadow_read_failed",
    })
  }
}
