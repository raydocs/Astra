import {
  AstraDevicesResponseSchema,
  type AstraDeviceListEntry,
} from "../../../../types/auth"
import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv, DeviceRevokeWriteMode } from "../env"
import { errorResponse, jsonResponse, withResponseHeaders } from "../lib/http"
import {
  ShadowSessionAuthError,
  ShadowSessionUnavailableError,
  touchValidatedShadowSessionLater,
  type ValidatedShadowSession,
  validateShadowSession,
} from "../lib/session-auth"
import { recordPlatformParityEventLater, recordPlatformRouteEventLater } from "../lib/platform-ops"
import { buildNodeRelayDownstreamHeaders, fetchNodeRelay, proxyToNodeRelay } from "../lib/proxy"
import {
  getShadowDevice,
  listShadowDevicesForUser,
  revokeShadowDevice,
  upsertShadowDevice,
} from "../repositories/devices"
import {
  getShadowSessionById,
  listShadowSessionsForDevice,
  revokeShadowSession,
  upsertShadowSession,
} from "../repositories/sessions"
import type { ShadowDeviceRow, ShadowSessionRow, ShadowUserRow } from "../types/shadow-state"

interface AuthoritativeDeviceRevokeState {
  shadowUser: ShadowUserRow
  currentDevice: ShadowDeviceRow
  targetDevice: ShadowDeviceRow
  targetSessions: ShadowSessionRow[]
}

class ShadowDeviceRevokeUnavailableError extends Error {
  constructor(readonly reason: string, message: string) {
    super(message)
    this.name = "ShadowDeviceRevokeUnavailableError"
  }
}

function tagDeviceRevokeResponse(
  response: Response,
  ctx: AstraRequestContext,
  params: {
    route: string
    mode: DeviceRevokeWriteMode
    fallbackReason?: string | null
  },
): Response {
  const headers: Record<string, string> = {
    "x-astra-request-id": ctx.requestId,
    "x-astra-platform-route": params.route,
    "x-astra-platform-mode": params.mode,
    "x-astra-platform-default-mode": ctx.config.deviceRevokeWriteMode,
    "x-astra-platform-domain": "device-revoke",
  }

  if (params.fallbackReason) {
    headers["x-astra-platform-fallback-reason"] = params.fallbackReason
  }

  return withResponseHeaders(response, headers)
}

function logDeviceRevokeRouteEvent(params: {
  requestId: string
  route: string
  mode: DeviceRevokeWriteMode
  responseStatus: number
  fallbackReason?: string | null
}) {
  console.log(JSON.stringify({
    message: "device revoke route handled",
    requestId: params.requestId,
    route: params.route,
    mode: params.mode,
    responseStatus: params.responseStatus,
    fallbackReason: params.fallbackReason ?? null,
  }))
}

function normalizeDeviceList(devices: AstraDeviceListEntry[]) {
  return [...devices]
    .map((device) => ({
      deviceId: device.deviceId,
      label: device.label,
      platform: device.platform,
      browserFamily: device.browserFamily,
      appKind: device.appKind,
      appVersion: device.appVersion,
      firstSeenAt: device.firstSeenAt,
      lastSeenAt: device.lastSeenAt,
      lastSyncAt: device.lastSyncAt,
      status: device.status,
      isCurrentDevice: device.isCurrentDevice,
    }))
    .sort((a, b) => a.deviceId.localeCompare(b.deviceId))
}

function taggedPlatformError(
  ctx: AstraRequestContext,
  params: {
    status: number
    code: string
    message: string
    route: string
    mode: DeviceRevokeWriteMode
    fallbackReason?: string | null
  },
): Response {
  return tagDeviceRevokeResponse(
    errorResponse(params.status, params.code, params.message, ctx.requestId),
    ctx,
    {
      route: params.route,
      mode: params.mode,
      fallbackReason: params.fallbackReason,
    },
  )
}

async function readAuthoritativeDeviceRevokeState(
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
  validated: ValidatedShadowSession,
  targetDeviceId: string,
): Promise<AuthoritativeDeviceRevokeState> {
  const normalizedTargetDeviceId = targetDeviceId.trim()

  const [shadowSession, currentDevice, targetDevice, targetSessions] = await Promise.all([
    getShadowSessionById(env.ASTRA_PLATFORM_DB, validated.shadowSession.sessionId),
    getShadowDevice(env.ASTRA_PLATFORM_DB, validated.shadowUser.id, validated.currentDevice.deviceId),
    getShadowDevice(env.ASTRA_PLATFORM_DB, validated.shadowUser.id, normalizedTargetDeviceId),
    listShadowSessionsForDevice(env.ASTRA_PLATFORM_DB, validated.shadowUser.id, normalizedTargetDeviceId),
  ])

  if (!shadowSession) {
    throw new ShadowDeviceRevokeUnavailableError(
      "missing_shadow_session",
      `No D1 shadow session was found for ${validated.shadowSession.sessionId}.`,
    )
  }
  if (shadowSession.userId !== validated.shadowUser.id || shadowSession.deviceId !== validated.currentDevice.deviceId) {
    throw new ShadowDeviceRevokeUnavailableError("shadow_session_mismatch", "The D1 shadow session does not match the validated Astra session.")
  }
  if (shadowSession.status !== "active" || shadowSession.revokedAt) {
    throw new ShadowDeviceRevokeUnavailableError("shadow_session_inactive", "The D1 shadow session is not active.")
  }
  if (shadowSession.expiresAt && shadowSession.expiresAt <= new Date(ctx.nowEpochMs).toISOString()) {
    throw new ShadowDeviceRevokeUnavailableError("shadow_session_expired", "The D1 shadow session has expired.")
  }
  if (!currentDevice) {
    throw new ShadowDeviceRevokeUnavailableError(
      "missing_shadow_device",
      `No D1 shadow current device was found for ${validated.currentDevice.deviceId}.`,
    )
  }
  if (currentDevice.status !== "active" || currentDevice.revokedAt) {
    throw new ShadowDeviceRevokeUnavailableError("shadow_device_inactive", "The D1 shadow current device is not active.")
  }
  if (!targetDevice) {
    throw new ShadowDeviceRevokeUnavailableError("missing_shadow_target_device", `No D1 shadow target device was found for ${normalizedTargetDeviceId}.`)
  }
  if (targetDevice.identityMode !== "authenticated") {
    throw new ShadowDeviceRevokeUnavailableError("unsupported_target_identity_mode", "The D1 shadow target device is not an authenticated device.")
  }

  return {
    shadowUser: validated.shadowUser,
    currentDevice,
    targetDevice,
    targetSessions,
  }
}

async function applyAuthoritativeDeviceRevoke(
  env: AstraPlatformEnv,
  state: AuthoritativeDeviceRevokeState,
  revokedAt: string,
): Promise<void> {
  await revokeShadowDevice(env.ASTRA_PLATFORM_DB, {
    userId: state.shadowUser.id,
    deviceId: state.targetDevice.deviceId,
    revokedAt,
    shadowUpdatedAt: revokedAt,
  })

  for (const session of state.targetSessions) {
    await revokeShadowSession(env.ASTRA_PLATFORM_DB, {
      sessionId: session.sessionId,
      revokedAt,
      lastVerifiedAt: revokedAt,
      shadowUpdatedAt: revokedAt,
    })
  }
}

async function rollbackAuthoritativeDeviceRevoke(
  env: AstraPlatformEnv,
  state: AuthoritativeDeviceRevokeState,
): Promise<void> {
  await upsertShadowDevice(env.ASTRA_PLATFORM_DB, state.targetDevice)
  for (const session of state.targetSessions) {
    await upsertShadowSession(env.ASTRA_PLATFORM_DB, session)
  }
}

async function readAuthoritativeDeviceList(
  env: AstraPlatformEnv,
  state: AuthoritativeDeviceRevokeState,
): Promise<AstraDeviceListEntry[]> {
  const devices = await listShadowDevicesForUser(
    env.ASTRA_PLATFORM_DB,
    state.shadowUser.id,
    state.currentDevice.deviceId,
    "authenticated",
  )
  return AstraDevicesResponseSchema.parse({ devices }).devices
}

async function compareNativeResultToNode(params: {
  env: AstraPlatformEnv
  ctx: AstraRequestContext
  nodeResponse: Response
  nativeDevices: AstraDeviceListEntry[]
}) {
  try {
    const nodePayload = AstraDevicesResponseSchema.parse(await params.nodeResponse.json())
    const nativeValue = normalizeDeviceList(params.nativeDevices)
    const nodeValue = normalizeDeviceList(nodePayload.devices)

    if (JSON.stringify(nativeValue) !== JSON.stringify(nodeValue)) {
      console.log(JSON.stringify({
        message: "device revoke native compare mismatch",
        requestId: params.ctx.requestId,
        nativeValue,
        nodeValue,
      }))
      recordPlatformParityEventLater({
        env: params.env,
        ctx: params.ctx,
        domain: "device-revoke",
        outcome: "parity_mismatch",
        scope: "native_compare",
        metadata: {
          nativeDeviceCount: params.nativeDevices.length,
          nodeDeviceCount: nodePayload.devices.length,
        },
      })
    }
  } catch (error) {
    console.log(JSON.stringify({
      message: "device revoke native compare failed",
      requestId: params.ctx.requestId,
      error: error instanceof Error ? error.message : String(error),
    }))
    recordPlatformParityEventLater({
      env: params.env,
      ctx: params.ctx,
      domain: "device-revoke",
      outcome: "compare_failed",
      scope: "native_compare",
      metadata: {
        error: error instanceof Error ? error.message : String(error),
      },
    })
  }
}

async function proxyDeviceRevoke(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
  params: {
    route: string
    mode: DeviceRevokeWriteMode
    fallbackReason?: string | null
  },
): Promise<Response> {
  const response = tagDeviceRevokeResponse(
    await proxyToNodeRelay(request, env, ctx),
    ctx,
    params,
  )
  logDeviceRevokeRouteEvent({
    requestId: ctx.requestId,
    route: params.route,
    mode: params.mode,
    responseStatus: response.status,
    fallbackReason: params.fallbackReason,
  })
  recordPlatformRouteEventLater({
    env,
    ctx,
    domain: "device-revoke",
    route: params.route,
    mode: params.mode,
    responseStatus: response.status,
    fallbackReason: params.fallbackReason,
  })
  return response
}

async function mirrorDeviceRevokeToNode(
  request: Request,
  ctx: AstraRequestContext,
): Promise<Response> {
  const upstreamResponse = await fetchNodeRelay(request, ctx)
  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: buildNodeRelayDownstreamHeaders(upstreamResponse, ctx.requestId),
  })
}

export async function handleDeviceRevoke(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
  targetDeviceId: string,
): Promise<Response> {
  const mode = ctx.config.deviceRevokeWriteMode

  if (mode === "proxy") {
    return proxyDeviceRevoke(request, env, ctx, {
      route: "proxy",
      mode,
    })
  }

  let validatedSession: ValidatedShadowSession
  try {
    validatedSession = await validateShadowSession(request.clone(), env, ctx, {
      requireDeviceHeader: true,
      requireAuthenticatedIdentity: true,
    })
  } catch (error) {
    if (error instanceof ShadowSessionAuthError) {
      const response = tagDeviceRevokeResponse(
        errorResponse(error.status, error.code, error.message, ctx.requestId),
        ctx,
        {
          route: "native-auth-gate",
          mode,
        },
      )
      logDeviceRevokeRouteEvent({
        requestId: ctx.requestId,
        route: "native-auth-gate",
        mode,
        responseStatus: response.status,
      })
      recordPlatformRouteEventLater({
        env,
        ctx,
        domain: "device-revoke",
        route: "native-auth-gate",
        mode,
        responseStatus: response.status,
      })
      return response
    }

    if (error instanceof ShadowSessionUnavailableError) {
      return proxyDeviceRevoke(request, env, ctx, {
        route: "native-fallback-proxy",
        mode,
        fallbackReason: error.reason,
      })
    }

    return proxyDeviceRevoke(request, env, ctx, {
      route: "native-fallback-proxy",
      mode,
      fallbackReason: "shadow_read_failed",
    })
  }

  const normalizedTargetDeviceId = targetDeviceId.trim()
  if (!normalizedTargetDeviceId) {
    const response = taggedPlatformError(ctx, {
      status: 400,
      code: "DEVICE_REQUIRED",
      message: "Target device id is required.",
      route: "native",
      mode,
    })
    logDeviceRevokeRouteEvent({
      requestId: ctx.requestId,
      route: "native",
      mode,
      responseStatus: response.status,
    })
    recordPlatformRouteEventLater({
      env,
      ctx,
      domain: "device-revoke",
      route: "native",
      mode,
      responseStatus: response.status,
    })
    return response
  }

  if (normalizedTargetDeviceId === validatedSession.currentDevice.deviceId) {
    const response = taggedPlatformError(ctx, {
      status: 409,
      code: "CURRENT_DEVICE_REVOKE_FORBIDDEN",
      message: "Use sign out for the current device instead of remote revoke.",
      route: "native",
      mode,
    })
    logDeviceRevokeRouteEvent({
      requestId: ctx.requestId,
      route: "native",
      mode,
      responseStatus: response.status,
    })
    recordPlatformRouteEventLater({
      env,
      ctx,
      domain: "device-revoke",
      route: "native",
      mode,
      responseStatus: response.status,
    })
    return response
  }

  let state: AuthoritativeDeviceRevokeState
  try {
    state = await readAuthoritativeDeviceRevokeState(
      env,
      ctx,
      validatedSession,
      normalizedTargetDeviceId,
    )
  } catch (error) {
    if (error instanceof ShadowDeviceRevokeUnavailableError) {
      return proxyDeviceRevoke(request, env, ctx, {
        route: "native-fallback-proxy",
        mode,
        fallbackReason: error.reason,
      })
    }

    console.log(JSON.stringify({
      message: "device revoke native shadow state load failed",
      requestId: ctx.requestId,
      error: error instanceof Error ? error.message : String(error),
    }))

    return proxyDeviceRevoke(request, env, ctx, {
      route: "native-fallback-proxy",
      mode,
      fallbackReason: "shadow_read_failed",
    })
  }

  const revokedAt = new Date(ctx.nowEpochMs).toISOString()

  try {
    await applyAuthoritativeDeviceRevoke(env, state, revokedAt)
  } catch (error) {
    try {
      await rollbackAuthoritativeDeviceRevoke(env, state)
    } catch (rollbackError) {
      console.log(JSON.stringify({
        message: "device revoke authoritative rollback failed",
        requestId: ctx.requestId,
        error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
      }))

      const response = taggedPlatformError(ctx, {
        status: 503,
        code: "UPSTREAM_UNAVAILABLE",
        message: "Authoritative device revoke failed and could not be rolled back safely.",
        route: "native",
        mode,
        fallbackReason: "authoritative_rollback_failed",
      })
      logDeviceRevokeRouteEvent({
        requestId: ctx.requestId,
        route: "native",
        mode,
        responseStatus: response.status,
        fallbackReason: "authoritative_rollback_failed",
      })
      recordPlatformRouteEventLater({
        env,
        ctx,
        domain: "device-revoke",
        route: "native",
        mode,
        responseStatus: response.status,
        fallbackReason: "authoritative_rollback_failed",
      })
      return response
    }

    console.log(JSON.stringify({
      message: "device revoke authoritative write failed",
      requestId: ctx.requestId,
      error: error instanceof Error ? error.message : String(error),
    }))

    return proxyDeviceRevoke(request, env, ctx, {
      route: "native-fallback-proxy",
      mode,
      fallbackReason: "authoritative_write_failed",
    })
  }

  let mirrorBackResponse: Response
  try {
    mirrorBackResponse = await mirrorDeviceRevokeToNode(request.clone(), ctx)
  } catch (error) {
    console.log(JSON.stringify({
      message: "device revoke mirror-back request failed",
      requestId: ctx.requestId,
      error: error instanceof Error ? error.message : String(error),
    }))

    const response = taggedPlatformError(ctx, {
      status: 503,
      code: "UPSTREAM_UNAVAILABLE",
      message: "The relay mirror-back did not complete after the authoritative device revoke write. Retry or reconcile before rollback.",
      route: "native",
      mode,
      fallbackReason: "mirror_back_commit_unknown",
    })
    logDeviceRevokeRouteEvent({
      requestId: ctx.requestId,
      route: "native",
      mode,
      responseStatus: response.status,
      fallbackReason: "mirror_back_commit_unknown",
    })
    recordPlatformRouteEventLater({
      env,
      ctx,
      domain: "device-revoke",
      route: "native",
      mode,
      responseStatus: response.status,
      fallbackReason: "mirror_back_commit_unknown",
    })
    return response
  }

  if (!mirrorBackResponse.ok) {
    try {
      await rollbackAuthoritativeDeviceRevoke(env, state)
    } catch (rollbackError) {
      console.log(JSON.stringify({
        message: "device revoke mirror-back response rollback failed",
        requestId: ctx.requestId,
        error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
      }))

      const response = taggedPlatformError(ctx, {
        status: 503,
        code: "UPSTREAM_UNAVAILABLE",
        message: "The relay mirror-back rejected the authoritative device revoke write.",
        route: "native",
        mode,
        fallbackReason: "mirror_back_rollback_failed",
      })
      logDeviceRevokeRouteEvent({
        requestId: ctx.requestId,
        route: "native",
        mode,
        responseStatus: response.status,
        fallbackReason: "mirror_back_rollback_failed",
      })
      recordPlatformRouteEventLater({
        env,
        ctx,
        domain: "device-revoke",
        route: "native",
        mode,
        responseStatus: response.status,
        fallbackReason: "mirror_back_rollback_failed",
      })
      return response
    }

    const taggedFallback = tagDeviceRevokeResponse(mirrorBackResponse, ctx, {
      route: "native-fallback-proxy",
      mode,
      fallbackReason: "mirror_back_rejected",
    })
    logDeviceRevokeRouteEvent({
      requestId: ctx.requestId,
      route: "native-fallback-proxy",
      mode,
      responseStatus: taggedFallback.status,
      fallbackReason: "mirror_back_rejected",
    })
    recordPlatformRouteEventLater({
      env,
      ctx,
      domain: "device-revoke",
      route: "native-fallback-proxy",
      mode,
      responseStatus: taggedFallback.status,
      fallbackReason: "mirror_back_rejected",
    })
    return taggedFallback
  }

  let devices: AstraDeviceListEntry[]
  try {
    devices = await readAuthoritativeDeviceList(env, state)
  } catch (error) {
    console.log(JSON.stringify({
      message: "device revoke post-mirror authoritative read failed",
      requestId: ctx.requestId,
      error: error instanceof Error ? error.message : String(error),
    }))

    const taggedFallback = tagDeviceRevokeResponse(mirrorBackResponse, ctx, {
      route: "native-fallback-proxy",
      mode,
      fallbackReason: "shadow_read_failed",
    })
    logDeviceRevokeRouteEvent({
      requestId: ctx.requestId,
      route: "native-fallback-proxy",
      mode,
      responseStatus: taggedFallback.status,
      fallbackReason: "shadow_read_failed",
    })
    recordPlatformRouteEventLater({
      env,
      ctx,
      domain: "device-revoke",
      route: "native-fallback-proxy",
      mode,
      responseStatus: taggedFallback.status,
      fallbackReason: "shadow_read_failed",
    })
    return taggedFallback
  }

  ctx.execution.waitUntil(compareNativeResultToNode({
    env,
    ctx,
    nodeResponse: mirrorBackResponse.clone(),
    nativeDevices: devices,
  }))
  touchValidatedShadowSessionLater(env, ctx, validatedSession)

  const response = tagDeviceRevokeResponse(
    jsonResponse({ devices }),
    ctx,
    {
      route: "native",
      mode,
    },
  )

  logDeviceRevokeRouteEvent({
    requestId: ctx.requestId,
    route: "native",
    mode,
    responseStatus: response.status,
  })
  recordPlatformRouteEventLater({
    env,
    ctx,
    domain: "device-revoke",
    route: "native",
    mode,
    responseStatus: response.status,
  })
  return response
}
