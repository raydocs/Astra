import {
  AstraSyncBootstrapSchema,
  type AstraSyncBootstrap,
} from "../../../../src/types/auth"
import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv, SyncBootstrapReadMode } from "../env"
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
  fetchNodeRelay,
  proxyToNodeRelay,
} from "../lib/proxy"
import { getShadowDevice } from "../repositories/devices"
import { getShadowSessionById } from "../repositories/sessions"
import {
  getShadowSyncBootstrap,
  listShadowSyncCollectionRowsForUser,
} from "../repositories/sync"
import { SHADOW_SYNC_COLLECTIONS } from "../types/shadow-state"

class ShadowSyncBootstrapUnavailableError extends Error {
  constructor(readonly reason: string, message: string) {
    super(message)
    this.name = "ShadowSyncBootstrapUnavailableError"
  }
}

function tagSyncBootstrapResponse(
  response: Response,
  ctx: AstraRequestContext,
  params: {
    route: string
    mode: SyncBootstrapReadMode
    fallbackReason?: string | null
  },
): Response {
  const headers: Record<string, string> = {
    "x-astra-request-id": ctx.requestId,
    "x-astra-platform-route": params.route,
    "x-astra-platform-mode": params.mode,
    "x-astra-platform-default-mode": ctx.config.syncBootstrapReadMode,
    "x-astra-platform-domain": "sync-bootstrap",
  }

  if (params.fallbackReason) {
    headers["x-astra-platform-fallback-reason"] = params.fallbackReason
  }

  return withResponseHeaders(response, headers)
}

function logSyncBootstrapRouteEvent(params: {
  requestId: string
  route: string
  mode: SyncBootstrapReadMode
  responseStatus: number
  fallbackReason?: string | null
}) {
  console.log(JSON.stringify({
    message: "sync bootstrap route handled",
    requestId: params.requestId,
    route: params.route,
    mode: params.mode,
    responseStatus: params.responseStatus,
    fallbackReason: params.fallbackReason ?? null,
  }))
}

function normalizeSyncBootstrap(bootstrap: AstraSyncBootstrap) {
  return {
    deviceId: bootstrap.deviceId,
    collections: {
      config: {
        enabled: bootstrap.collections.config.enabled,
        defaultEnabled: bootstrap.collections.config.defaultEnabled,
        cursor: bootstrap.collections.config.cursor,
      },
      vocabulary: {
        enabled: bootstrap.collections.vocabulary.enabled,
        defaultEnabled: bootstrap.collections.vocabulary.defaultEnabled,
        cursor: bootstrap.collections.vocabulary.cursor,
      },
      review_schedule: {
        enabled: bootstrap.collections.review_schedule.enabled,
        defaultEnabled: bootstrap.collections.review_schedule.defaultEnabled,
        cursor: bootstrap.collections.review_schedule.cursor,
      },
      reading_history: {
        enabled: bootstrap.collections.reading_history.enabled,
        defaultEnabled: bootstrap.collections.reading_history.defaultEnabled,
        cursor: bootstrap.collections.reading_history.cursor,
      },
      study_progress: {
        enabled: bootstrap.collections.study_progress.enabled,
        defaultEnabled: bootstrap.collections.study_progress.defaultEnabled,
        cursor: bootstrap.collections.study_progress.cursor,
      },
    },
    limits: bootstrap.limits,
    transport: bootstrap.transport,
  }
}

function mapShadowBootstrapToNodeShape(
  shadow: Awaited<ReturnType<typeof getShadowSyncBootstrap>>,
): AstraSyncBootstrap {
  return AstraSyncBootstrapSchema.parse({
    serverTime: shadow.serverTime,
    deviceId: shadow.deviceId,
    collections: {
      config: {
        enabled: shadow.collections.config.enabled,
        defaultEnabled: shadow.collections.config.defaultEnabled,
        cursor: shadow.collections.config.lastIssuedCursor,
      },
      vocabulary: {
        enabled: shadow.collections.vocabulary.enabled,
        defaultEnabled: shadow.collections.vocabulary.defaultEnabled,
        cursor: shadow.collections.vocabulary.lastIssuedCursor,
      },
      review_schedule: {
        enabled: shadow.collections.review_schedule.enabled,
        defaultEnabled: shadow.collections.review_schedule.defaultEnabled,
        cursor: shadow.collections.review_schedule.lastIssuedCursor,
      },
      reading_history: {
        enabled: shadow.collections.reading_history.enabled,
        defaultEnabled: shadow.collections.reading_history.defaultEnabled,
        cursor: shadow.collections.reading_history.lastIssuedCursor,
      },
      study_progress: {
        enabled: shadow.collections.study_progress.enabled,
        defaultEnabled: shadow.collections.study_progress.defaultEnabled,
        cursor: shadow.collections.study_progress.lastIssuedCursor,
      },
    },
    limits: shadow.limits,
    transport: shadow.transport,
  })
}

async function fetchAuthoritativeBootstrapFromNode(
  request: Request,
  ctx: AstraRequestContext,
): Promise<{ response: Response; bootstrap: AstraSyncBootstrap | null }> {
  const upstreamResponse = await fetchNodeRelay(request, ctx)
  const response = new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: buildNodeRelayDownstreamHeaders(upstreamResponse, ctx.requestId),
  })

  if (!response.ok) {
    return {
      response,
      bootstrap: null,
    }
  }

  const bootstrap = AstraSyncBootstrapSchema.parse(await response.clone().json())
  return {
    response,
    bootstrap,
  }
}

async function readShadowSyncBootstrap(
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
  validated: ValidatedShadowSession,
  params: {
    maxMutationsPerRequest: number
    serverTime: string
  },
): Promise<AstraSyncBootstrap> {
  const [shadowSession, currentDevice, collectionRows, shadowBootstrap] = await Promise.all([
    getShadowSessionById(env.ASTRA_PLATFORM_DB, validated.shadowSession.sessionId),
    getShadowDevice(env.ASTRA_PLATFORM_DB, validated.shadowUser.id, validated.currentDevice.deviceId),
    listShadowSyncCollectionRowsForUser(env.ASTRA_PLATFORM_DB, validated.shadowUser.id),
    getShadowSyncBootstrap(env.ASTRA_PLATFORM_DB, {
      userId: validated.shadowUser.id,
      deviceId: validated.currentDevice.deviceId,
      maxMutationsPerRequest: params.maxMutationsPerRequest,
      serverTime: params.serverTime,
    }),
  ])

  if (!shadowSession) {
    throw new ShadowSyncBootstrapUnavailableError(
      "missing_shadow_session",
      `No D1 shadow session was found for ${validated.shadowSession.sessionId}.`,
    )
  }
  if (shadowSession.userId !== validated.shadowUser.id || shadowSession.deviceId !== validated.currentDevice.deviceId) {
    throw new ShadowSyncBootstrapUnavailableError("shadow_session_mismatch", "The D1 shadow session does not match the validated Astra session.")
  }
  if (shadowSession.status !== "active" || shadowSession.revokedAt) {
    throw new ShadowSyncBootstrapUnavailableError("shadow_session_inactive", "The D1 shadow session is not active.")
  }
  if (shadowSession.expiresAt && shadowSession.expiresAt <= new Date(ctx.nowEpochMs).toISOString()) {
    throw new ShadowSyncBootstrapUnavailableError("shadow_session_expired", "The D1 shadow session has expired.")
  }
  if (!currentDevice) {
    throw new ShadowSyncBootstrapUnavailableError(
      "missing_shadow_device",
      `No D1 shadow device was found for ${validated.currentDevice.deviceId}.`,
    )
  }
  if (currentDevice.status !== "active" || currentDevice.revokedAt) {
    throw new ShadowSyncBootstrapUnavailableError("shadow_device_inactive", "The D1 shadow device is not active.")
  }

  const collectionSet = new Set(collectionRows.map((row) => row.collection))
  if (!SHADOW_SYNC_COLLECTIONS.every((collection) => collectionSet.has(collection))) {
    throw new ShadowSyncBootstrapUnavailableError("missing_shadow_sync_collections", "The D1 sync bootstrap shadow state is incomplete.")
  }

  if (shadowBootstrap.collections.reading_history.enabled !== validated.shadowUser.syncPreferences.reading_history
    || shadowBootstrap.collections.study_progress.enabled !== validated.shadowUser.syncPreferences.study_progress) {
    throw new ShadowSyncBootstrapUnavailableError("shadow_sync_preferences_mismatch", "The D1 sync bootstrap shadow state does not match the user sync preferences.")
  }

  return mapShadowBootstrapToNodeShape(shadowBootstrap)
}

async function compareShadowReadToNode(params: {
  request: Request
  env: AstraPlatformEnv
  ctx: AstraRequestContext
  nodeBootstrap: AstraSyncBootstrap
}) {
  try {
    const validated = await validateShadowSession(params.request, params.env, params.ctx, {
      requireDeviceHeader: true,
      requireAuthenticatedIdentity: true,
    })
    const shadowBootstrap = await readShadowSyncBootstrap(params.env, params.ctx, validated, {
      maxMutationsPerRequest: params.nodeBootstrap.limits.maxMutationsPerRequest,
      serverTime: params.nodeBootstrap.serverTime,
    })
    const nodeValue = normalizeSyncBootstrap(params.nodeBootstrap)
    const shadowValue = normalizeSyncBootstrap(shadowBootstrap)

    if (JSON.stringify(nodeValue) !== JSON.stringify(shadowValue)) {
      console.log(JSON.stringify({
        message: "sync bootstrap shadow compare mismatch",
        requestId: params.ctx.requestId,
        nodeValue,
        shadowValue,
      }))
      recordPlatformParityEventLater({
        env: params.env,
        ctx: params.ctx,
        domain: "sync-bootstrap",
        outcome: "parity_mismatch",
        scope: "shadow_compare",
        metadata: {
          nodeServerTime: params.nodeBootstrap.serverTime,
          shadowServerTime: shadowBootstrap.serverTime,
        },
      })
    }
  } catch (error) {
    console.log(JSON.stringify({
      message: "sync bootstrap shadow compare failed",
      requestId: params.ctx.requestId,
      error: error instanceof Error ? error.message : String(error),
    }))
    recordPlatformParityEventLater({
      env: params.env,
      ctx: params.ctx,
      domain: "sync-bootstrap",
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
  nativeBootstrap: AstraSyncBootstrap
  nodeBootstrap: AstraSyncBootstrap
}) {
  try {
    const nativeValue = normalizeSyncBootstrap(params.nativeBootstrap)
    const nodeValue = normalizeSyncBootstrap(params.nodeBootstrap)

    if (JSON.stringify(nativeValue) !== JSON.stringify(nodeValue)) {
      console.log(JSON.stringify({
        message: "sync bootstrap native compare mismatch",
        requestId: params.ctx.requestId,
        nativeValue,
        nodeValue,
      }))
      recordPlatformParityEventLater({
        env: params.env,
        ctx: params.ctx,
        domain: "sync-bootstrap",
        outcome: "parity_mismatch",
        scope: "native_compare",
        metadata: {
          nativeServerTime: params.nativeBootstrap.serverTime,
          nodeServerTime: params.nodeBootstrap.serverTime,
        },
      })
    }
  } catch (error) {
    console.log(JSON.stringify({
      message: "sync bootstrap native compare failed",
      requestId: params.ctx.requestId,
      error: error instanceof Error ? error.message : String(error),
    }))
    recordPlatformParityEventLater({
      env: params.env,
      ctx: params.ctx,
      domain: "sync-bootstrap",
      outcome: "compare_failed",
      scope: "native_compare",
      metadata: {
        error: error instanceof Error ? error.message : String(error),
      },
    })
  }
}

async function proxySyncBootstrap(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
  params: {
    route: string
    mode: SyncBootstrapReadMode
    fallbackReason?: string | null
  },
): Promise<Response> {
  const response = tagSyncBootstrapResponse(
    await proxyToNodeRelay(request, env, ctx),
    ctx,
    params,
  )
  logSyncBootstrapRouteEvent({
    requestId: ctx.requestId,
    route: params.route,
    mode: params.mode,
    responseStatus: response.status,
    fallbackReason: params.fallbackReason,
  })
  recordPlatformRouteEventLater({
    env,
    ctx,
    domain: "sync-bootstrap",
    route: params.route,
    mode: params.mode,
    responseStatus: response.status,
    fallbackReason: params.fallbackReason,
  })
  return response
}

export async function handleSyncBootstrap(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
): Promise<Response> {
  const mode = ctx.config.syncBootstrapReadMode

  if (mode === "proxy") {
    return proxySyncBootstrap(request, env, ctx, {
      route: "proxy",
      mode,
    })
  }

  if (mode === "shadow") {
    const proxyResponse = await proxyToNodeRelay(request, env, ctx)
    const tagged = tagSyncBootstrapResponse(proxyResponse, ctx, {
      route: "shadow-proxy",
      mode,
    })

    if (tagged.ok) {
      ctx.execution.waitUntil((async () => {
        try {
          const payload = AstraSyncBootstrapSchema.parse(await tagged.clone().json())
          await compareShadowReadToNode({
            request: request.clone(),
            env,
            ctx,
            nodeBootstrap: payload,
          })
        } catch (error) {
          console.log(JSON.stringify({
            message: "sync bootstrap shadow response compare failed",
            requestId: ctx.requestId,
            error: error instanceof Error ? error.message : String(error),
          }))
        }
      })())
    }

    logSyncBootstrapRouteEvent({
      requestId: ctx.requestId,
      route: "shadow-proxy",
      mode,
      responseStatus: tagged.status,
    })
    recordPlatformRouteEventLater({
      env,
      ctx,
      domain: "sync-bootstrap",
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
      const response = tagSyncBootstrapResponse(
        errorResponse(error.status, error.code, error.message, ctx.requestId),
        ctx,
        {
          route: "native-auth-gate",
          mode,
        },
      )
      logSyncBootstrapRouteEvent({
        requestId: ctx.requestId,
        route: "native-auth-gate",
        mode,
        responseStatus: response.status,
      })
      recordPlatformRouteEventLater({
        env,
        ctx,
        domain: "sync-bootstrap",
        route: "native-auth-gate",
        mode,
        responseStatus: response.status,
      })
      return response
    }

    if (error instanceof ShadowSessionUnavailableError) {
      return proxySyncBootstrap(request, env, ctx, {
        route: "native-fallback-proxy",
        mode,
        fallbackReason: error.reason,
      })
    }

    return proxySyncBootstrap(request, env, ctx, {
      route: "native-fallback-proxy",
      mode,
      fallbackReason: "shadow_read_failed",
    })
  }

  let authoritativeBootstrap: AstraSyncBootstrap | null = null
  let authoritativeBootstrapResponse: Response | null = null
  try {
    const authoritativeResult = await fetchAuthoritativeBootstrapFromNode(request.clone(), ctx)
    authoritativeBootstrapResponse = authoritativeResult.response
    if (!authoritativeResult.bootstrap) {
      const taggedGateError = tagSyncBootstrapResponse(authoritativeResult.response, ctx, {
        route: "native-authoritative-gate",
        mode,
      })
      logSyncBootstrapRouteEvent({
        requestId: ctx.requestId,
        route: "native-authoritative-gate",
        mode,
        responseStatus: taggedGateError.status,
      })
      recordPlatformRouteEventLater({
        env,
        ctx,
        domain: "sync-bootstrap",
        route: "native-authoritative-gate",
        mode,
        responseStatus: taggedGateError.status,
      })
      return taggedGateError
    }

    authoritativeBootstrap = authoritativeResult.bootstrap
  } catch {
    return proxySyncBootstrap(request, env, ctx, {
      route: "native-fallback-proxy",
      mode,
      fallbackReason: "authoritative_upstream_unavailable",
    })
  }

  const validatedSessionValue = validatedSession
  const authoritativeBootstrapValue = authoritativeBootstrap

  if (!validatedSessionValue || !authoritativeBootstrapValue) {
    return proxySyncBootstrap(request, env, ctx, {
      route: "native-fallback-proxy",
      mode,
      fallbackReason: "shadow_read_failed",
    })
  }

  try {
    const bootstrap = await readShadowSyncBootstrap(env, ctx, validatedSessionValue, {
      maxMutationsPerRequest: authoritativeBootstrapValue.limits.maxMutationsPerRequest,
      serverTime: authoritativeBootstrapValue.serverTime,
    })
    touchValidatedShadowSessionLater(env, ctx, validatedSessionValue)
    const response = tagSyncBootstrapResponse(
      jsonResponse(bootstrap),
      ctx,
      {
        route: "native",
        mode,
      },
    )

    ctx.execution.waitUntil(compareNativeReadToNode({
      env,
      ctx,
      nativeBootstrap: bootstrap,
      nodeBootstrap: authoritativeBootstrapValue,
    }))

    logSyncBootstrapRouteEvent({
      requestId: ctx.requestId,
      route: "native",
      mode,
      responseStatus: response.status,
    })
    recordPlatformRouteEventLater({
      env,
      ctx,
      domain: "sync-bootstrap",
      route: "native",
      mode,
      responseStatus: response.status,
    })
    return response
  } catch (error) {
    if (error instanceof ShadowSyncBootstrapUnavailableError && authoritativeBootstrapResponse) {
      const taggedFallback = tagSyncBootstrapResponse(authoritativeBootstrapResponse, ctx, {
        route: "native-fallback-proxy",
        mode,
        fallbackReason: error.reason,
      })
      logSyncBootstrapRouteEvent({
        requestId: ctx.requestId,
        route: "native-fallback-proxy",
        mode,
        responseStatus: taggedFallback.status,
        fallbackReason: error.reason,
      })
      recordPlatformRouteEventLater({
        env,
        ctx,
        domain: "sync-bootstrap",
        route: "native-fallback-proxy",
        mode,
        responseStatus: taggedFallback.status,
        fallbackReason: error.reason,
      })
      return taggedFallback
    }

    console.log(JSON.stringify({
      message: "sync bootstrap native read failed",
      requestId: ctx.requestId,
      error: error instanceof Error ? error.message : String(error),
    }))

    if (authoritativeBootstrapResponse) {
      const taggedFallback = tagSyncBootstrapResponse(authoritativeBootstrapResponse, ctx, {
        route: "native-fallback-proxy",
        mode,
        fallbackReason: "shadow_read_failed",
      })
      logSyncBootstrapRouteEvent({
        requestId: ctx.requestId,
        route: "native-fallback-proxy",
        mode,
        responseStatus: taggedFallback.status,
        fallbackReason: "shadow_read_failed",
      })
      recordPlatformRouteEventLater({
        env,
        ctx,
        domain: "sync-bootstrap",
        route: "native-fallback-proxy",
        mode,
        responseStatus: taggedFallback.status,
        fallbackReason: "shadow_read_failed",
      })
      return taggedFallback
    }

    return proxySyncBootstrap(request, env, ctx, {
      route: "native-fallback-proxy",
      mode,
      fallbackReason: "shadow_read_failed",
    })
  }
}
