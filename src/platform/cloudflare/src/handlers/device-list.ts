import {
  AstraDevicesResponseSchema,
  type AstraDeviceListEntry,
} from "../../../../types/auth"
import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv, DeviceListReadMode } from "../env"
import { errorResponse, jsonResponse, withResponseHeaders } from "../lib/http"
import { recordPlatformParityEventLater, recordPlatformRouteEventLater } from "../lib/platform-ops"
import {
  ShadowSessionAuthError,
  ShadowSessionUnavailableError,
  touchValidatedShadowSessionLater,
  type ValidatedShadowSession,
  validateShadowSession,
} from "../lib/session-auth"
import { fetchNodeRelay, proxyToNodeRelay } from "../lib/proxy"
import { getShadowDevice, listShadowDevicesForUser } from "../repositories/devices"
import { getShadowSessionById } from "../repositories/sessions"

class ShadowDeviceListUnavailableError extends Error {
  constructor(readonly reason: string, message: string) {
    super(message)
    this.name = "ShadowDeviceListUnavailableError"
  }
}

function tagDeviceListResponse(
  response: Response,
  ctx: AstraRequestContext,
  params: {
    route: string
    mode: DeviceListReadMode
    fallbackReason?: string | null
  },
): Response {
  const headers: Record<string, string> = {
    "x-astra-request-id": ctx.requestId,
    "x-astra-platform-route": params.route,
    "x-astra-platform-mode": params.mode,
    "x-astra-platform-default-mode": ctx.config.deviceListReadMode,
    "x-astra-platform-domain": "device-list",
  }

  if (params.fallbackReason) {
    headers["x-astra-platform-fallback-reason"] = params.fallbackReason
  }

  return withResponseHeaders(response, headers)
}

function logDeviceListRouteEvent(params: {
  requestId: string
  route: string
  mode: DeviceListReadMode
  responseStatus: number
  fallbackReason?: string | null
}) {
  console.log(JSON.stringify({
    message: "device list route handled",
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

async function readShadowDeviceList(
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
  validated: ValidatedShadowSession,
): Promise<AstraDeviceListEntry[]> {
  const [shadowSession, currentDevice, devices] = await Promise.all([
    getShadowSessionById(env.ASTRA_PLATFORM_DB, validated.shadowSession.sessionId),
    getShadowDevice(env.ASTRA_PLATFORM_DB, validated.shadowUser.id, validated.currentDevice.deviceId),
    listShadowDevicesForUser(
      env.ASTRA_PLATFORM_DB,
      validated.shadowUser.id,
      validated.currentDevice.deviceId,
      "authenticated",
    ),
  ])

  if (!shadowSession) {
    throw new ShadowDeviceListUnavailableError(
      "missing_shadow_session",
      `No D1 shadow session was found for ${validated.shadowSession.sessionId}.`,
    )
  }
  if (shadowSession.userId !== validated.shadowUser.id || shadowSession.deviceId !== validated.currentDevice.deviceId) {
    throw new ShadowDeviceListUnavailableError("shadow_session_mismatch", "The D1 shadow session does not match the validated Astra session.")
  }
  if (shadowSession.status !== "active" || shadowSession.revokedAt) {
    throw new ShadowDeviceListUnavailableError("shadow_session_inactive", "The D1 shadow session is not active.")
  }
  if (shadowSession.expiresAt && shadowSession.expiresAt <= new Date(ctx.nowEpochMs).toISOString()) {
    throw new ShadowDeviceListUnavailableError("shadow_session_expired", "The D1 shadow session has expired.")
  }
  if (!currentDevice) {
    throw new ShadowDeviceListUnavailableError(
      "missing_shadow_device",
      `No D1 shadow device was found for ${validated.currentDevice.deviceId}.`,
    )
  }
  if (currentDevice.status !== "active" || currentDevice.revokedAt) {
    throw new ShadowDeviceListUnavailableError("shadow_device_inactive", "The D1 shadow device is not active.")
  }
  if (!devices.some((device) => device.deviceId === validated.currentDevice.deviceId && device.isCurrentDevice)) {
    throw new ShadowDeviceListUnavailableError("missing_current_device_in_list", "The D1 device list did not include the validated current device.")
  }

  return AstraDevicesResponseSchema.parse({ devices }).devices
}

async function compareShadowReadToNode(params: {
  request: Request
  env: AstraPlatformEnv
  ctx: AstraRequestContext
  nodeDevices: AstraDeviceListEntry[]
}) {
  try {
    const validated = await validateShadowSession(params.request, params.env, params.ctx, {
      requireDeviceHeader: true,
      requireAuthenticatedIdentity: true,
    })
    const shadowDevices = await readShadowDeviceList(params.env, params.ctx, validated)
    const nodeValue = normalizeDeviceList(params.nodeDevices)
    const shadowValue = normalizeDeviceList(shadowDevices)

    if (JSON.stringify(nodeValue) !== JSON.stringify(shadowValue)) {
      console.log(JSON.stringify({
        message: "device list shadow compare mismatch",
        requestId: params.ctx.requestId,
        nodeValue,
        shadowValue,
      }))
      recordPlatformParityEventLater({
        env: params.env,
        ctx: params.ctx,
        domain: "device-list",
        outcome: "parity_mismatch",
        scope: "shadow_compare",
        metadata: {
          nodeDeviceCount: params.nodeDevices.length,
          shadowDeviceCount: shadowDevices.length,
        },
      })
    }
  } catch (error) {
    console.log(JSON.stringify({
      message: "device list shadow compare failed",
      requestId: params.ctx.requestId,
      error: error instanceof Error ? error.message : String(error),
    }))
    recordPlatformParityEventLater({
      env: params.env,
      ctx: params.ctx,
      domain: "device-list",
      outcome: "compare_failed",
      scope: "shadow_compare",
      metadata: {
        error: error instanceof Error ? error.message : String(error),
      },
    })
  }
}

async function compareNativeReadToNode(params: {
  request: Request
  env: AstraPlatformEnv
  ctx: AstraRequestContext
  nativeDevices: AstraDeviceListEntry[]
}) {
  try {
    const upstreamResponse = await fetchNodeRelay(params.request, params.ctx)
    if (!upstreamResponse.ok) {
      console.log(JSON.stringify({
        message: "device list native compare skipped",
        requestId: params.ctx.requestId,
        reason: "authoritative_request_failed",
        responseStatus: upstreamResponse.status,
      }))
      return
    }

    const payload = AstraDevicesResponseSchema.parse(await upstreamResponse.json())
    const nativeValue = normalizeDeviceList(params.nativeDevices)
    const nodeValue = normalizeDeviceList(payload.devices)

    if (JSON.stringify(nativeValue) !== JSON.stringify(nodeValue)) {
      console.log(JSON.stringify({
        message: "device list native compare mismatch",
        requestId: params.ctx.requestId,
        nativeValue,
        nodeValue,
      }))
      recordPlatformParityEventLater({
        env: params.env,
        ctx: params.ctx,
        domain: "device-list",
        outcome: "parity_mismatch",
        scope: "native_compare",
        metadata: {
          nativeDeviceCount: params.nativeDevices.length,
          nodeDeviceCount: payload.devices.length,
        },
      })
    }
  } catch (error) {
    console.log(JSON.stringify({
      message: "device list native compare failed",
      requestId: params.ctx.requestId,
      error: error instanceof Error ? error.message : String(error),
    }))
    recordPlatformParityEventLater({
      env: params.env,
      ctx: params.ctx,
      domain: "device-list",
      outcome: "compare_failed",
      scope: "native_compare",
      metadata: {
        error: error instanceof Error ? error.message : String(error),
      },
    })
  }
}

async function proxyDeviceList(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
  params: {
    route: string
    mode: DeviceListReadMode
    fallbackReason?: string | null
  },
): Promise<Response> {
  const response = tagDeviceListResponse(
    await proxyToNodeRelay(request, env, ctx),
    ctx,
    params,
  )
  logDeviceListRouteEvent({
    requestId: ctx.requestId,
    route: params.route,
    mode: params.mode,
    responseStatus: response.status,
    fallbackReason: params.fallbackReason,
  })
  recordPlatformRouteEventLater({
    env,
    ctx,
    domain: "device-list",
    route: params.route,
    mode: params.mode,
    responseStatus: response.status,
    fallbackReason: params.fallbackReason,
  })
  return response
}

export async function handleDeviceList(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
): Promise<Response> {
  const mode = ctx.config.deviceListReadMode

  if (mode === "proxy") {
    return proxyDeviceList(request, env, ctx, {
      route: "proxy",
      mode,
    })
  }

  if (mode === "shadow") {
    const proxyResponse = await proxyToNodeRelay(request, env, ctx)
    const tagged = tagDeviceListResponse(proxyResponse, ctx, {
      route: "shadow-proxy",
      mode,
    })

    if (tagged.ok) {
      ctx.execution.waitUntil((async () => {
        try {
          const payload = AstraDevicesResponseSchema.parse(await tagged.clone().json())
          await compareShadowReadToNode({
            request: request.clone(),
            env,
            ctx,
            nodeDevices: payload.devices,
          })
        } catch (error) {
          console.log(JSON.stringify({
            message: "device list shadow response compare failed",
            requestId: ctx.requestId,
            error: error instanceof Error ? error.message : String(error),
          }))
        }
      })())
    }

    logDeviceListRouteEvent({
      requestId: ctx.requestId,
      route: "shadow-proxy",
      mode,
      responseStatus: tagged.status,
    })
    recordPlatformRouteEventLater({
      env,
      ctx,
      domain: "device-list",
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
      const response = tagDeviceListResponse(
        errorResponse(error.status, error.code, error.message, ctx.requestId),
        ctx,
        {
          route: "native-auth-gate",
          mode,
        },
      )
      logDeviceListRouteEvent({
        requestId: ctx.requestId,
        route: "native-auth-gate",
        mode,
        responseStatus: response.status,
      })
      recordPlatformRouteEventLater({
        env,
        ctx,
        domain: "device-list",
        route: "native-auth-gate",
        mode,
        responseStatus: response.status,
      })
      return response
    }

    if (error instanceof ShadowSessionUnavailableError) {
      return proxyDeviceList(request, env, ctx, {
        route: "native-fallback-proxy",
        mode,
        fallbackReason: error.reason,
      })
    }

    return proxyDeviceList(request, env, ctx, {
      route: "native-fallback-proxy",
      mode,
      fallbackReason: "shadow_read_failed",
    })
  }

  try {
    const devices = await readShadowDeviceList(env, ctx, validatedSession)
    touchValidatedShadowSessionLater(env, ctx, validatedSession)
    const response = tagDeviceListResponse(
      jsonResponse({ devices }),
      ctx,
      {
        route: "native",
        mode,
      },
    )

    ctx.execution.waitUntil(compareNativeReadToNode({
      request: request.clone(),
      env,
      ctx,
      nativeDevices: devices,
    }))

    logDeviceListRouteEvent({
      requestId: ctx.requestId,
      route: "native",
      mode,
      responseStatus: response.status,
    })
    recordPlatformRouteEventLater({
      env,
      ctx,
      domain: "device-list",
      route: "native",
      mode,
      responseStatus: response.status,
    })
    return response
  } catch (error) {
    if (error instanceof ShadowDeviceListUnavailableError) {
      return proxyDeviceList(request, env, ctx, {
        route: "native-fallback-proxy",
        mode,
        fallbackReason: error.reason,
      })
    }

    console.log(JSON.stringify({
      message: "device list native read failed",
      requestId: ctx.requestId,
      error: error instanceof Error ? error.message : String(error),
    }))

    return proxyDeviceList(request, env, ctx, {
      route: "native-fallback-proxy",
      mode,
      fallbackReason: "shadow_read_failed",
    })
  }
}
