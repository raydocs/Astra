import { AstraSessionSchema, type AstraSession } from "../../../../src/types/auth"
import {
  ASTRA_CREDENTIAL_HASH_ALGORITHM,
  hashAstraCredentialSecret,
  verifyAstraCredentialSecret,
} from "../../../../src/utils/astra/credential-hash"
import {
  buildAstraSessionClaims,
  issueAstraSessionToken,
} from "../../../../src/utils/astra/session-token"
import { z } from "zod"
import type { AstraRequestContext } from "../context"
import type {
  AstraPlatformEnv,
  AuthIssueMode,
  AuthSessionReadMode,
  AuthSessionRevokeWriteMode,
} from "../env"
import { errorResponse, jsonResponse, withResponseHeaders } from "../lib/http"
import { NodeMirrorConfigError, postNodeMirrorJson } from "../lib/node-mirror"
import {
  buildAstraSessionFromShadow,
  ShadowSessionAuthError,
  ShadowSessionUnavailableError,
  touchValidatedShadowSessionLater,
  validateShadowSession,
} from "../lib/session-auth"
import { recordPlatformParityEventLater, recordPlatformRouteEventLater } from "../lib/platform-ops"
import { buildNodeRelayDownstreamHeaders, fetchNodeRelay, proxyToNodeRelay } from "../lib/proxy"
import {
  createPendingAuthIssueRequest,
  getAuthIssueRequest,
  markAuthIssueRequestCompleted,
  markAuthIssueRequestFailed,
} from "../repositories/auth-issue-requests"
import { getShadowDevice, upsertShadowDevice } from "../repositories/devices"
import {
  getShadowSessionById,
  revokeShadowSession,
  upsertShadowSession,
} from "../repositories/sessions"
import { getShadowUserUsageByUserId } from "../repositories/user-usage"
import { getShadowUserByEmail, getShadowUserById, getShadowUserCredential } from "../repositories/users"

const DeviceDescriptorSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  platform: z.string().trim().min(1).max(40).optional(),
  browserFamily: z.string().trim().min(1).max(40).optional(),
  appKind: z.string().trim().min(1).max(20).optional(),
  appVersion: z.string().trim().min(1).max(40).optional(),
})

const LoginSchema = DeviceDescriptorSchema.extend({
  email: z.string().trim().min(1),
  password: z.string().min(1),
  deviceId: z.string().trim().min(1),
  device: DeviceDescriptorSchema.optional(),
})

type LoginBody = z.infer<typeof LoginSchema>

function tagAuthSessionResponse(
  response: Response,
  ctx: AstraRequestContext,
  params: {
    route: string
    mode: AuthIssueMode | AuthSessionReadMode | AuthSessionRevokeWriteMode
    method: string
    fallbackReason?: string | null
  },
): Response {
  const defaultMode = params.method === "GET"
    ? ctx.config.authSessionReadMode
    : params.method === "DELETE"
      ? ctx.config.authSessionRevokeWriteMode
      : (ctx.config.authSessionIssueMode ?? "proxy")
  const headers: Record<string, string> = {
    "x-astra-request-id": ctx.requestId,
    "x-astra-platform-route": params.route,
    "x-astra-platform-mode": params.mode,
    "x-astra-platform-default-mode": defaultMode,
    "x-astra-platform-domain": "auth-session",
  }

  if (params.fallbackReason) {
    headers["x-astra-platform-fallback-reason"] = params.fallbackReason
  }

  return withResponseHeaders(response, headers)
}

function logAuthSessionRouteEvent(params: {
  requestId: string
  route: string
  mode: AuthIssueMode | AuthSessionReadMode | AuthSessionRevokeWriteMode
  method: string
  responseStatus: number
  fallbackReason?: string | null
}) {
  console.log(JSON.stringify({
    message: "auth session route handled",
    requestId: params.requestId,
    route: params.route,
    mode: params.mode,
    method: params.method,
    responseStatus: params.responseStatus,
    fallbackReason: params.fallbackReason ?? null,
  }))
}

function normalizeSession(session: AstraSession) {
  return {
    version: session.version,
    sessionToken: session.sessionToken,
    sessionId: session.sessionId,
    deviceId: session.deviceId,
    identityMode: session.identityMode,
    relayBaseURL: session.relayBaseURL,
    email: session.email,
    plan: session.plan,
    subscriptionStatus: session.subscriptionStatus,
    providerEntitlements: [...session.providerEntitlements].sort(),
    quota: session.quota,
    usage: session.usage,
    issuedAt: session.issuedAt,
    expiresAt: session.expiresAt,
  }
}

function taggedPlatformError(
  ctx: AstraRequestContext,
  params: {
    status: number
    code: string
    message: string
    route: string
    mode: AuthIssueMode | AuthSessionReadMode | AuthSessionRevokeWriteMode
    method: string
    fallbackReason?: string | null
  },
): Response {
  return tagAuthSessionResponse(
    errorResponse(params.status, params.code, params.message, ctx.requestId),
    ctx,
    params,
  )
}

function normalizeSessionPublicBaseURL(ctx: AstraRequestContext): string {
  const configured = ctx.config.sessionPublicBaseURL?.trim()
  if (configured) {
    return configured.replace(/\/+$/, "")
  }
  return new URL("/v1", ctx.config.nodeRelayOrigin).toString().replace(/\/+$/, "")
}

function normalizeLoginEmail(email: string): string {
  return email.trim().toLowerCase()
}

function readIdempotencyKey(request: Request): string | null {
  return request.headers.get("idempotency-key")?.trim() || null
}

function buildAuthenticatedRequestKey(params: {
  email: string
  deviceId: string
  idempotencyKey: string
}): string {
  return `session:${normalizeLoginEmail(params.email)}:${params.deviceId}:${params.idempotencyKey}`
}

async function buildAuthenticatedSessionId(requestKey: string): Promise<string> {
  return `sess_${(await issueSessionIdDigest(requestKey)).slice(0, 24)}`
}

async function issueSessionIdDigest(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw new Error("Web Crypto subtle API is unavailable for Astra auth issuance.")
  }
  const bytes = new TextEncoder().encode(value)
  const digest = await subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest), (item) => item.toString(16).padStart(2, "0")).join("")
}

function normalizeLoginDevice(body: LoginBody) {
  const descriptor = body.device ?? body
  return {
    deviceId: body.deviceId.trim(),
    label: descriptor.label?.trim() || "Astra device",
    platform: descriptor.platform?.trim() || null,
    browserFamily: descriptor.browserFamily?.trim() || null,
    appKind: descriptor.appKind?.trim() || "extension",
    appVersion: descriptor.appVersion?.trim() || null,
  }
}

function readSessionTtlMs(env: AstraPlatformEnv): number {
  const parsed = Number(env.ASTRA_SESSION_TTL_MS?.trim())
  return Number.isFinite(parsed) ? parsed : 30 * 24 * 60 * 60 * 1000
}

function buildAuthenticatedDeviceSnapshot(params: {
  userId: string
  email: string
  body: LoginBody
  nowIso: string
  existingFirstSeenAt?: string | null
}) {
  const device = normalizeLoginDevice(params.body)
  return {
    userId: params.userId,
    deviceId: device.deviceId,
    identityMode: "authenticated" as const,
    label: device.label,
    platform: device.platform,
    browserFamily: device.browserFamily,
    appKind: device.appKind,
    appVersion: device.appVersion,
    firstSeenAt: params.existingFirstSeenAt ?? params.nowIso,
    lastSeenAt: params.nowIso,
    lastSyncAt: null,
    status: "active" as const,
    revokedAt: null,
    updatedAt: params.nowIso,
    shadowUpdatedAt: params.nowIso,
    email: params.email,
  }
}

async function buildAuthenticatedSessionArtifacts(params: {
  env: AstraPlatformEnv
  ctx: AstraRequestContext
  user: Awaited<ReturnType<typeof getShadowUserByEmail>> extends infer T ? NonNullable<T> : never
  usage: Awaited<ReturnType<typeof getShadowUserUsageByUserId>> extends infer T ? NonNullable<T> : never
  deviceId: string
  sessionId: string
  issuedAt: string
}) {
  const relayBaseURL = normalizeSessionPublicBaseURL(params.ctx)
  const sessionTtlMs = readSessionTtlMs(params.env)
  const expiresAt = sessionTtlMs > 0
    ? new Date(Date.parse(params.issuedAt) + sessionTtlMs).toISOString()
    : null
  const claims = buildAstraSessionClaims({
    email: params.user.email,
    relayBaseURL,
    issuedAt: params.issuedAt,
    expiresAt,
    sessionId: params.sessionId,
    deviceId: params.deviceId,
    identityMode: "authenticated",
  })
  const token = await issueAstraSessionToken(claims, params.env.ASTRA_SESSION_SECRET?.trim() || "")
  const tokenHash = await hashAstraCredentialSecret(token)

  return {
    token,
    session: {
      sessionId: params.sessionId,
      userId: params.user.id,
      deviceId: params.deviceId,
      identityMode: "authenticated" as const,
      issuedAt: params.issuedAt,
      expiresAt,
      createdAt: params.issuedAt,
      lastSeenAt: params.issuedAt,
      lastVerifiedAt: params.issuedAt,
      status: "active" as const,
      revokedAt: null,
      tokenHash,
      tokenHashAlg: ASTRA_CREDENTIAL_HASH_ALGORITHM,
      shadowUpdatedAt: params.issuedAt,
    },
    response: AstraSessionSchema.parse({
      version: 1,
      sessionToken: token,
      sessionId: params.sessionId,
      deviceId: params.deviceId,
      identityMode: "authenticated",
      relayBaseURL,
      email: params.user.email,
      plan: params.user.plan,
      subscriptionStatus: params.user.subscriptionStatus,
      providerEntitlements: params.user.providerEntitlements,
      quota: {
        dailyRequestsLimit: params.usage.dailyRequestsLimit,
        dailyCharactersLimit: params.usage.dailyCharactersLimit,
        requestsPerMinuteLimit: params.usage.requestsPerMinuteLimit,
        remainingDailyRequests: Math.max(0, params.usage.dailyRequestsLimit - params.usage.requestsToday),
        remainingDailyCharacters: Math.max(0, params.usage.dailyCharactersLimit - params.usage.charactersToday),
      },
      usage: {
        totalRequests: params.usage.totalRequests,
        totalCharacters: params.usage.totalCharacters,
        dailyRequestsUsed: params.usage.requestsToday,
        dailyCharactersUsed: params.usage.charactersToday,
        lastRequestAt: params.usage.lastRequestAt,
        recentEvents: params.usage.recentEvents,
      },
      issuedAt: params.issuedAt,
      expiresAt,
    }),
  }
}

async function buildAuthenticatedMirrorPayload(params: {
  user: Awaited<ReturnType<typeof getShadowUserByEmail>> extends infer T ? NonNullable<T> : never
  device: {
    deviceId: string
    label: string
    platform: string | null
    browserFamily: string | null
    appKind: string
    appVersion: string | null
    firstSeenAt: string
    lastSeenAt: string
    lastSyncAt: string | null
    status: "active" | "revoked"
    updatedAt: string
    revokedAt: string | null
  }
  session: {
    sessionId: string
    deviceId: string
    issuedAt: string
    expiresAt: string | null
    createdAt: string
    lastSeenAt: string
    lastVerifiedAt: string | null
    status: "active" | "revoked"
    revokedAt: string | null
  }
}) {
  return {
    userId: params.user.id,
    email: params.user.email,
    device: {
      deviceId: params.device.deviceId,
      userId: params.user.id,
      email: params.user.email,
      identityMode: "authenticated",
      label: params.device.label,
      platform: params.device.platform,
      browserFamily: params.device.browserFamily,
      appKind: params.device.appKind,
      appVersion: params.device.appVersion,
      firstSeenAt: params.device.firstSeenAt,
      lastSeenAt: params.device.lastSeenAt,
      lastSyncAt: params.device.lastSyncAt,
      status: params.device.status,
      updatedAt: params.device.updatedAt,
      revokedAt: params.device.revokedAt,
    },
    session: {
      sessionId: params.session.sessionId,
      userId: params.user.id,
      email: params.user.email,
      deviceId: params.session.deviceId,
      identityMode: "authenticated",
      issuedAt: params.session.issuedAt,
      expiresAt: params.session.expiresAt,
      createdAt: params.session.createdAt,
      lastSeenAt: params.session.lastSeenAt,
      lastVerifiedAt: params.session.lastVerifiedAt,
      status: params.session.status,
      revokedAt: params.session.revokedAt,
    },
  }
}

async function readMirrorError(response: Response): Promise<{ code: string | null; message: string | null }> {
  try {
    const payload = await response.clone().json() as { error?: { code?: string; message?: string } }
    return {
      code: payload.error?.code ?? null,
      message: payload.error?.message ?? null,
    }
  } catch {
    return { code: null, message: null }
  }
}

async function preflightSessionShadow(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
  nodeSession: AstraSession | null,
): Promise<void> {
  try {
    const body = LoginSchema.parse(await request.json())
    const normalizedEmail = normalizeLoginEmail(body.email)
    const shadowUser = await getShadowUserByEmail(env.ASTRA_PLATFORM_DB, normalizedEmail)
    const issues: string[] = []

    if (!shadowUser) {
      issues.push("missing_shadow_user")
    } else {
      const [credential, usage] = await Promise.all([
        getShadowUserCredential(env.ASTRA_PLATFORM_DB, shadowUser.id),
        getShadowUserUsageByUserId(env.ASTRA_PLATFORM_DB, shadowUser.id),
      ])
      if (!credential) {
        issues.push("missing_shadow_user_credential")
      } else if (
        credential.credentialKind !== "password"
        || credential.passwordHashAlg !== ASTRA_CREDENTIAL_HASH_ALGORITHM
      ) {
        issues.push("unsupported_shadow_user_credential")
      } else {
        const validPassword = await verifyAstraCredentialSecret(body.password, credential.passwordHash)
        if (!validPassword) {
          issues.push("invalid_credentials")
        }
      }
      if (!usage) {
        issues.push("missing_shadow_user_usage")
      }
    }

    if (!ctx.config.platformMirrorSecret) {
      issues.push("missing_platform_mirror_secret")
    }
    if (nodeSession && nodeSession.relayBaseURL !== normalizeSessionPublicBaseURL(ctx)) {
      issues.push("relay_base_url_mismatch")
    }

    if (issues.length > 0) {
      recordPlatformParityEventLater({
        env,
        ctx,
        domain: "auth-session",
        outcome: "parity_mismatch",
        scope: "shadow_preflight",
        metadata: {
          method: "POST",
          email: normalizedEmail,
          deviceId: body.deviceId,
          issues,
        },
      })
    }
  } catch (error) {
    recordPlatformParityEventLater({
      env,
      ctx,
      domain: "auth-session",
      outcome: "compare_failed",
      scope: "shadow_preflight",
      metadata: {
        method: "POST",
        error: error instanceof Error ? error.message : String(error),
      },
    })
  }
}

async function compareShadowReadToNode(params: {
  request: Request
  env: AstraPlatformEnv
  ctx: AstraRequestContext
  nodeSession: AstraSession
}) {
  try {
    const validated = await validateShadowSession(params.request, params.env, params.ctx, {
      requireDeviceHeader: true,
      requireUsage: true,
    })
    const shadowSession = buildAstraSessionFromShadow(validated)
    const nodeValue = normalizeSession(params.nodeSession)
    const shadowValue = normalizeSession(shadowSession)

    if (JSON.stringify(nodeValue) !== JSON.stringify(shadowValue)) {
      console.log(JSON.stringify({
        message: "auth session shadow compare mismatch",
        requestId: params.ctx.requestId,
        nodeValue,
        shadowValue,
      }))
      recordPlatformParityEventLater({
        env: params.env,
        ctx: params.ctx,
        domain: "auth-session",
        outcome: "parity_mismatch",
        scope: "shadow_compare",
        metadata: {
          method: "GET",
        },
      })
    }
  } catch (error) {
    console.log(JSON.stringify({
      message: "auth session shadow compare failed",
      requestId: params.ctx.requestId,
      error: error instanceof Error ? error.message : String(error),
    }))
    recordPlatformParityEventLater({
      env: params.env,
      ctx: params.ctx,
      domain: "auth-session",
      outcome: "compare_failed",
      scope: "shadow_compare",
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        method: "GET",
      },
    })
  }
}

async function compareNativeReadToNode(params: {
  request: Request
  env: AstraPlatformEnv
  ctx: AstraRequestContext
  nativeSession: AstraSession
}) {
  try {
    const upstreamResponse = await fetchNodeRelay(params.request, params.ctx)
    if (!upstreamResponse.ok) {
      console.log(JSON.stringify({
        message: "auth session native compare skipped",
        requestId: params.ctx.requestId,
        reason: "authoritative_request_failed",
        responseStatus: upstreamResponse.status,
      }))
      return
    }

    const nodeSession = AstraSessionSchema.parse(await upstreamResponse.json())
    const nativeValue = normalizeSession(params.nativeSession)
    const nodeValue = normalizeSession(nodeSession)

    if (JSON.stringify(nativeValue) !== JSON.stringify(nodeValue)) {
      console.log(JSON.stringify({
        message: "auth session native compare mismatch",
        requestId: params.ctx.requestId,
        nativeValue,
        nodeValue,
      }))
      recordPlatformParityEventLater({
        env: params.env,
        ctx: params.ctx,
        domain: "auth-session",
        outcome: "parity_mismatch",
        scope: "native_compare",
        metadata: {
          method: "GET",
        },
      })
    }
  } catch (error) {
    console.log(JSON.stringify({
      message: "auth session native compare failed",
      requestId: params.ctx.requestId,
      error: error instanceof Error ? error.message : String(error),
    }))
    recordPlatformParityEventLater({
      env: params.env,
      ctx: params.ctx,
      domain: "auth-session",
      outcome: "compare_failed",
      scope: "native_compare",
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        method: "GET",
      },
    })
  }
}

async function proxyAuthSession(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
  params: {
    route: string
    mode: AuthIssueMode | AuthSessionReadMode | AuthSessionRevokeWriteMode
    method: string
    fallbackReason?: string | null
  },
): Promise<Response> {
  const response = tagAuthSessionResponse(
    await proxyToNodeRelay(request, env, ctx),
    ctx,
    params,
  )
  logAuthSessionRouteEvent({
    requestId: ctx.requestId,
    route: params.route,
    mode: params.mode,
    method: params.method,
    responseStatus: response.status,
    fallbackReason: params.fallbackReason,
  })
  recordPlatformRouteEventLater({
    env,
    ctx,
    domain: "auth-session",
    route: params.route,
    mode: params.mode,
    responseStatus: response.status,
    fallbackReason: params.fallbackReason,
    metadata: { method: params.method },
  })
  return response
}

async function mirrorAuthSessionDeleteToNode(
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

export async function handleAuthSession(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
): Promise<Response> {
  if (request.method === "POST") {
    const mode = ctx.config.authSessionIssueMode ?? "proxy"

    if (mode === "proxy") {
      return proxyAuthSession(request, env, ctx, { route: "proxy", mode, method: "POST" })
    }

    if (mode === "shadow") {
      const shadowRequest = request.clone()
      const proxyResponse = await proxyToNodeRelay(request, env, ctx)
      const tagged = tagAuthSessionResponse(proxyResponse, ctx, {
        route: "shadow-proxy",
        mode,
        method: "POST",
      })

      if (tagged.ok) {
        ctx.execution.waitUntil((async () => {
          try {
            const nodeSession = AstraSessionSchema.parse(await tagged.clone().json())
            await preflightSessionShadow(shadowRequest, env, ctx, nodeSession)
          } catch (error) {
            console.log(JSON.stringify({
              message: "auth session shadow issue preflight failed",
              requestId: ctx.requestId,
              error: error instanceof Error ? error.message : String(error),
            }))
          }
        })())
      }

      logAuthSessionRouteEvent({
        requestId: ctx.requestId,
        route: "shadow-proxy",
        mode,
        method: "POST",
        responseStatus: tagged.status,
      })
      recordPlatformRouteEventLater({
        env,
        ctx,
        domain: "auth-session",
        route: "shadow-proxy",
        mode,
        responseStatus: tagged.status,
        metadata: { method: "POST" },
      })
      return tagged
    }

    const body = LoginSchema.safeParse(await request.clone().json().catch(() => ({})))
    if (!body.success) {
      return proxyAuthSession(request, env, ctx, {
        route: "native-fallback-proxy",
        mode,
        method: "POST",
        fallbackReason: "invalid_request_shape",
      })
    }

    const idempotencyKey = readIdempotencyKey(request)
    if (!idempotencyKey) {
      const response = taggedPlatformError(ctx, {
        status: 400,
        code: "INVALID_REQUEST",
        message: "Idempotency-Key is required for Worker-native auth/session issuance.",
        route: "native-validation",
        mode,
        method: "POST",
      })
      logAuthSessionRouteEvent({
        requestId: ctx.requestId,
        route: "native-validation",
        mode,
        method: "POST",
        responseStatus: response.status,
      })
      recordPlatformRouteEventLater({
        env,
        ctx,
        domain: "auth-session",
        route: "native-validation",
        mode,
        responseStatus: response.status,
        metadata: { method: "POST" },
      })
      return response
    }

    if (!env.ASTRA_SESSION_SECRET?.trim()) {
      const response = taggedPlatformError(ctx, {
        status: 503,
        code: "CONFIG_MISSING",
        message: "ASTRA_SESSION_SECRET is required for Worker-native auth/session issuance.",
        route: "native-config-gate",
        mode,
        method: "POST",
      })
      logAuthSessionRouteEvent({
        requestId: ctx.requestId,
        route: "native-config-gate",
        mode,
        method: "POST",
        responseStatus: response.status,
      })
      recordPlatformRouteEventLater({
        env,
        ctx,
        domain: "auth-session",
        route: "native-config-gate",
        mode,
        responseStatus: response.status,
        metadata: { method: "POST" },
      })
      return response
    }

    const normalizedEmail = normalizeLoginEmail(body.data.email)
    const requestKey = buildAuthenticatedRequestKey({
      email: normalizedEmail,
      deviceId: body.data.deviceId,
      idempotencyKey,
    })
    const nowIso = new Date(ctx.nowEpochMs).toISOString()
    const existingRequest = await getAuthIssueRequest(env.ASTRA_PLATFORM_DB, requestKey)

    if (existingRequest) {
      if (
        existingRequest.routeKind !== "session"
        || existingRequest.deviceId !== body.data.deviceId
      ) {
        const response = taggedPlatformError(ctx, {
          status: 409,
          code: "INVALID_REQUEST",
          message: "Idempotency-Key is already bound to a different auth/session issuance payload.",
          route: "native-idempotency-conflict",
          mode,
          method: "POST",
        })
        logAuthSessionRouteEvent({
          requestId: ctx.requestId,
          route: "native-idempotency-conflict",
          mode,
          method: "POST",
          responseStatus: response.status,
        })
        recordPlatformRouteEventLater({
          env,
          ctx,
          domain: "auth-session",
          route: "native-idempotency-conflict",
          mode,
          responseStatus: response.status,
          metadata: { method: "POST" },
        })
        return response
      }

      if (existingRequest.nodeMirrorStatus === "failed") {
        const response = taggedPlatformError(ctx, {
          status: 409,
          code: "INVALID_REQUEST",
          message: existingRequest.errorMessage
            ? `${existingRequest.errorMessage} Retry with a new Idempotency-Key.`
            : "Previous auth/session issuance failed. Retry with a new Idempotency-Key.",
          route: "native-idempotency-failed",
          mode,
          method: "POST",
        })
        logAuthSessionRouteEvent({
          requestId: ctx.requestId,
          route: "native-idempotency-failed",
          mode,
          method: "POST",
          responseStatus: response.status,
        })
        recordPlatformRouteEventLater({
          env,
          ctx,
          domain: "auth-session",
          route: "native-idempotency-failed",
          mode,
          responseStatus: response.status,
          metadata: { method: "POST" },
        })
        return response
      }

      const shadowUser = existingRequest.userId
        ? await getShadowUserById(env.ASTRA_PLATFORM_DB, existingRequest.userId)
        : null
      const [shadowSession, shadowUsage] = await Promise.all([
        getShadowSessionById(env.ASTRA_PLATFORM_DB, existingRequest.sessionId),
        existingRequest.userId ? getShadowUserUsageByUserId(env.ASTRA_PLATFORM_DB, existingRequest.userId) : Promise.resolve(null),
      ])

      if (!shadowUser || !shadowSession || !shadowUsage) {
        const response = taggedPlatformError(ctx, {
          status: 503,
          code: "UPSTREAM_UNAVAILABLE",
          message: "Auth/session issuance state is incomplete; retry with a new Idempotency-Key after reconciliation.",
          route: "native-idempotency-incomplete",
          mode,
          method: "POST",
        })
        logAuthSessionRouteEvent({
          requestId: ctx.requestId,
          route: "native-idempotency-incomplete",
          mode,
          method: "POST",
          responseStatus: response.status,
        })
        recordPlatformRouteEventLater({
          env,
          ctx,
          domain: "auth-session",
          route: "native-idempotency-incomplete",
          mode,
          responseStatus: response.status,
          metadata: { method: "POST" },
        })
        return response
      }

      if (existingRequest.nodeMirrorStatus === "completed") {
        const issued = await buildAuthenticatedSessionArtifacts({
          env,
          ctx,
          user: shadowUser,
          usage: shadowUsage,
          deviceId: shadowSession.deviceId,
          sessionId: shadowSession.sessionId,
          issuedAt: shadowSession.issuedAt,
        })
        const response = tagAuthSessionResponse(jsonResponse(issued.response), ctx, {
          route: "native-idempotent-replay",
          mode,
          method: "POST",
        })
        logAuthSessionRouteEvent({
          requestId: ctx.requestId,
          route: "native-idempotent-replay",
          mode,
          method: "POST",
          responseStatus: response.status,
        })
        recordPlatformRouteEventLater({
          env,
          ctx,
          domain: "auth-session",
          route: "native-idempotent-replay",
          mode,
          responseStatus: response.status,
          metadata: { method: "POST" },
        })
        return response
      }

      const currentDevice = await getShadowDevice(env.ASTRA_PLATFORM_DB, shadowUser.id, shadowSession.deviceId)
      if (!currentDevice) {
        const response = taggedPlatformError(ctx, {
          status: 503,
          code: "UPSTREAM_UNAVAILABLE",
          message: "Auth/session issuance mirror-back is pending but the authoritative device snapshot is missing.",
          route: "native-idempotency-incomplete",
          mode,
          method: "POST",
        })
        logAuthSessionRouteEvent({
          requestId: ctx.requestId,
          route: "native-idempotency-incomplete",
          mode,
          method: "POST",
          responseStatus: response.status,
        })
        recordPlatformRouteEventLater({
          env,
          ctx,
          domain: "auth-session",
          route: "native-idempotency-incomplete",
          mode,
          responseStatus: response.status,
          metadata: { method: "POST" },
        })
        return response
      }

      try {
        const mirrorResponse = await postNodeMirrorJson(request, env, ctx, {
          path: "/_internal/cloudflare/auth/issue/authenticated",
          body: await buildAuthenticatedMirrorPayload({
            user: shadowUser,
            device: currentDevice,
            session: shadowSession,
          }),
        })

        if (!mirrorResponse.ok) {
          const mirrorError = await readMirrorError(mirrorResponse)
          await markAuthIssueRequestFailed(env.ASTRA_PLATFORM_DB, {
            requestKey,
            failedAt: nowIso,
            errorCode: mirrorError.code ?? "NODE_MIRROR_REJECTED",
            errorMessage: mirrorError.message ?? `Node mirror-back rejected auth/session issuance with status ${mirrorResponse.status}.`,
          })
          const response = tagAuthSessionResponse(mirrorResponse, ctx, {
            route: "native-fallback-proxy",
            mode,
            method: "POST",
            fallbackReason: "mirror_back_rejected",
          })
          logAuthSessionRouteEvent({
            requestId: ctx.requestId,
            route: "native-fallback-proxy",
            mode,
            method: "POST",
            responseStatus: response.status,
            fallbackReason: "mirror_back_rejected",
          })
          recordPlatformRouteEventLater({
            env,
            ctx,
            domain: "auth-session",
            route: "native-fallback-proxy",
            mode,
            responseStatus: response.status,
            fallbackReason: "mirror_back_rejected",
            metadata: { method: "POST" },
          })
          return response
        }

        await markAuthIssueRequestCompleted(env.ASTRA_PLATFORM_DB, {
          requestKey,
          completedAt: nowIso,
        })
        const issued = await buildAuthenticatedSessionArtifacts({
          env,
          ctx,
          user: shadowUser,
          usage: shadowUsage,
          deviceId: shadowSession.deviceId,
          sessionId: shadowSession.sessionId,
          issuedAt: shadowSession.issuedAt,
        })
        const response = tagAuthSessionResponse(jsonResponse(issued.response), ctx, {
          route: "native-idempotent-replay",
          mode,
          method: "POST",
        })
        logAuthSessionRouteEvent({
          requestId: ctx.requestId,
          route: "native-idempotent-replay",
          mode,
          method: "POST",
          responseStatus: response.status,
        })
        recordPlatformRouteEventLater({
          env,
          ctx,
          domain: "auth-session",
          route: "native-idempotent-replay",
          mode,
          responseStatus: response.status,
          metadata: { method: "POST" },
        })
        return response
      } catch (error) {
        if (error instanceof NodeMirrorConfigError) {
          await markAuthIssueRequestFailed(env.ASTRA_PLATFORM_DB, {
            requestKey,
            failedAt: nowIso,
            errorCode: "CONFIG_MISSING",
            errorMessage: error.message,
          })
          const response = taggedPlatformError(ctx, {
            status: 503,
            code: "CONFIG_MISSING",
            message: error.message,
            route: "native-config-gate",
            mode,
            method: "POST",
          })
          logAuthSessionRouteEvent({
            requestId: ctx.requestId,
            route: "native-config-gate",
            mode,
            method: "POST",
            responseStatus: response.status,
          })
          recordPlatformRouteEventLater({
            env,
            ctx,
            domain: "auth-session",
            route: "native-config-gate",
            mode,
            responseStatus: response.status,
            metadata: { method: "POST" },
          })
          return response
        }

        const response = taggedPlatformError(ctx, {
          status: 503,
          code: "UPSTREAM_UNAVAILABLE",
          message: "The relay mirror-back did not complete after authoritative auth/session issuance. Retry with the same Idempotency-Key.",
          route: "native",
          mode,
          method: "POST",
          fallbackReason: "mirror_back_commit_unknown",
        })
        logAuthSessionRouteEvent({
          requestId: ctx.requestId,
          route: "native",
          mode,
          method: "POST",
          responseStatus: response.status,
          fallbackReason: "mirror_back_commit_unknown",
        })
        recordPlatformRouteEventLater({
          env,
          ctx,
          domain: "auth-session",
          route: "native",
          mode,
          responseStatus: response.status,
          fallbackReason: "mirror_back_commit_unknown",
          metadata: { method: "POST" },
        })
        return response
      }
    }

    const shadowUser = await getShadowUserByEmail(env.ASTRA_PLATFORM_DB, normalizedEmail)
    if (!shadowUser) {
      return proxyAuthSession(request, env, ctx, {
        route: "native-fallback-proxy",
        mode,
        method: "POST",
        fallbackReason: "missing_shadow_user",
      })
    }

    const [credential, shadowUsage] = await Promise.all([
      getShadowUserCredential(env.ASTRA_PLATFORM_DB, shadowUser.id),
      getShadowUserUsageByUserId(env.ASTRA_PLATFORM_DB, shadowUser.id),
    ])

    if (!credential) {
      return proxyAuthSession(request, env, ctx, {
        route: "native-fallback-proxy",
        mode,
        method: "POST",
        fallbackReason: "missing_shadow_user_credential",
      })
    }

    if (
      credential.credentialKind !== "password"
      || credential.passwordHashAlg !== ASTRA_CREDENTIAL_HASH_ALGORITHM
    ) {
      return proxyAuthSession(request, env, ctx, {
        route: "native-fallback-proxy",
        mode,
        method: "POST",
        fallbackReason: "unsupported_shadow_user_credential",
      })
    }

    if (!shadowUsage) {
      return proxyAuthSession(request, env, ctx, {
        route: "native-fallback-proxy",
        mode,
        method: "POST",
        fallbackReason: "missing_shadow_user_usage",
      })
    }

    const validPassword = await verifyAstraCredentialSecret(body.data.password, credential.passwordHash)
    if (!validPassword) {
      const response = taggedPlatformError(ctx, {
        status: 401,
        code: "INVALID_CREDENTIALS",
        message: "Invalid Astra credentials.",
        route: "native-auth-gate",
        mode,
        method: "POST",
      })
      logAuthSessionRouteEvent({
        requestId: ctx.requestId,
        route: "native-auth-gate",
        mode,
        method: "POST",
        responseStatus: response.status,
      })
      recordPlatformRouteEventLater({
        env,
        ctx,
        domain: "auth-session",
        route: "native-auth-gate",
        mode,
        responseStatus: response.status,
        metadata: { method: "POST" },
      })
      return response
    }

    const existingDevice = await getShadowDevice(env.ASTRA_PLATFORM_DB, shadowUser.id, body.data.deviceId)
    const deviceSnapshot = buildAuthenticatedDeviceSnapshot({
      userId: shadowUser.id,
      email: shadowUser.email,
      body: body.data,
      nowIso,
      existingFirstSeenAt: existingDevice?.firstSeenAt ?? null,
    })
    const sessionId = await buildAuthenticatedSessionId(requestKey)
    const issued = await buildAuthenticatedSessionArtifacts({
      env,
      ctx,
      user: shadowUser,
      usage: shadowUsage,
      deviceId: body.data.deviceId,
      sessionId,
      issuedAt: nowIso,
    })

    try {
      await Promise.all([
        upsertShadowDevice(env.ASTRA_PLATFORM_DB, deviceSnapshot),
        upsertShadowSession(env.ASTRA_PLATFORM_DB, issued.session),
        createPendingAuthIssueRequest(env.ASTRA_PLATFORM_DB, {
          requestKey,
          routeKind: "session",
          userId: shadowUser.id,
          installId: null,
          deviceId: body.data.deviceId,
          sessionId,
          nodeMirrorStatus: "pending",
          createdAt: nowIso,
          lastAttemptAt: nowIso,
          shadowUpdatedAt: nowIso,
        }),
      ])

      const mirrorResponse = await postNodeMirrorJson(request, env, ctx, {
        path: "/_internal/cloudflare/auth/issue/authenticated",
        body: await buildAuthenticatedMirrorPayload({
          user: shadowUser,
          device: deviceSnapshot,
          session: issued.session,
        }),
      })

      if (!mirrorResponse.ok) {
        const mirrorError = await readMirrorError(mirrorResponse)
        await markAuthIssueRequestFailed(env.ASTRA_PLATFORM_DB, {
          requestKey,
          failedAt: nowIso,
          errorCode: mirrorError.code ?? "NODE_MIRROR_REJECTED",
          errorMessage: mirrorError.message ?? `Node mirror-back rejected auth/session issuance with status ${mirrorResponse.status}.`,
        })
        const response = tagAuthSessionResponse(mirrorResponse, ctx, {
          route: "native-fallback-proxy",
          mode,
          method: "POST",
          fallbackReason: "mirror_back_rejected",
        })
        logAuthSessionRouteEvent({
          requestId: ctx.requestId,
          route: "native-fallback-proxy",
          mode,
          method: "POST",
          responseStatus: response.status,
          fallbackReason: "mirror_back_rejected",
        })
        recordPlatformRouteEventLater({
          env,
          ctx,
          domain: "auth-session",
          route: "native-fallback-proxy",
          mode,
          responseStatus: response.status,
          fallbackReason: "mirror_back_rejected",
          metadata: { method: "POST" },
        })
        return response
      }

      await markAuthIssueRequestCompleted(env.ASTRA_PLATFORM_DB, {
        requestKey,
        completedAt: nowIso,
      })
      const response = tagAuthSessionResponse(jsonResponse(issued.response), ctx, {
        route: "native",
        mode,
        method: "POST",
      })
      logAuthSessionRouteEvent({
        requestId: ctx.requestId,
        route: "native",
        mode,
        method: "POST",
        responseStatus: response.status,
      })
      recordPlatformRouteEventLater({
        env,
        ctx,
        domain: "auth-session",
        route: "native",
        mode,
        responseStatus: response.status,
        metadata: { method: "POST" },
      })
      return response
    } catch (error) {
      if (error instanceof NodeMirrorConfigError) {
        await markAuthIssueRequestFailed(env.ASTRA_PLATFORM_DB, {
          requestKey,
          failedAt: nowIso,
          errorCode: "CONFIG_MISSING",
          errorMessage: error.message,
        })
        const response = taggedPlatformError(ctx, {
          status: 503,
          code: "CONFIG_MISSING",
          message: error.message,
          route: "native-config-gate",
          mode,
          method: "POST",
        })
        logAuthSessionRouteEvent({
          requestId: ctx.requestId,
          route: "native-config-gate",
          mode,
          method: "POST",
          responseStatus: response.status,
        })
        recordPlatformRouteEventLater({
          env,
          ctx,
          domain: "auth-session",
          route: "native-config-gate",
          mode,
          responseStatus: response.status,
          metadata: { method: "POST" },
        })
        return response
      }

      const response = taggedPlatformError(ctx, {
        status: 503,
        code: "UPSTREAM_UNAVAILABLE",
        message: "The relay mirror-back did not complete after authoritative auth/session issuance. Retry with the same Idempotency-Key.",
        route: "native",
        mode,
        method: "POST",
        fallbackReason: "mirror_back_commit_unknown",
      })
      logAuthSessionRouteEvent({
        requestId: ctx.requestId,
        route: "native",
        mode,
        method: "POST",
        responseStatus: response.status,
        fallbackReason: "mirror_back_commit_unknown",
      })
      recordPlatformRouteEventLater({
        env,
        ctx,
        domain: "auth-session",
        route: "native",
        mode,
        responseStatus: response.status,
        fallbackReason: "mirror_back_commit_unknown",
        metadata: { method: "POST" },
      })
      return response
    }
  }

  if (request.method === "GET") {
    const mode = ctx.config.authSessionReadMode

    if (mode === "proxy") {
      return proxyAuthSession(request, env, ctx, { route: "proxy", mode, method: "GET" })
    }

    if (mode === "shadow") {
      const proxyResponse = await proxyToNodeRelay(request, env, ctx)
      const tagged = tagAuthSessionResponse(proxyResponse, ctx, {
        route: "shadow-proxy",
        mode,
        method: "GET",
      })

      if (tagged.ok) {
        ctx.execution.waitUntil((async () => {
          try {
            const nodeSession = AstraSessionSchema.parse(await tagged.clone().json())
            await compareShadowReadToNode({
              request: request.clone(),
              env,
              ctx,
              nodeSession,
            })
          } catch (error) {
            console.log(JSON.stringify({
              message: "auth session shadow response compare failed",
              requestId: ctx.requestId,
              error: error instanceof Error ? error.message : String(error),
            }))
          }
        })())
      }

      logAuthSessionRouteEvent({
        requestId: ctx.requestId,
        route: "shadow-proxy",
        mode,
        method: "GET",
        responseStatus: tagged.status,
      })
      recordPlatformRouteEventLater({
        env,
        ctx,
        domain: "auth-session",
        route: "shadow-proxy",
        mode,
        responseStatus: tagged.status,
        metadata: { method: "GET" },
      })
      return tagged
    }

    try {
      const validated = await validateShadowSession(request.clone(), env, ctx, {
        requireDeviceHeader: true,
        requireUsage: true,
      })
      const session = buildAstraSessionFromShadow(validated)
      touchValidatedShadowSessionLater(env, ctx, validated)

      const response = tagAuthSessionResponse(jsonResponse(session), ctx, {
        route: "native",
        mode,
        method: "GET",
      })

      ctx.execution.waitUntil(compareNativeReadToNode({
        request: request.clone(),
        env,
        ctx,
        nativeSession: session,
      }))

      logAuthSessionRouteEvent({
        requestId: ctx.requestId,
        route: "native",
        mode,
        method: "GET",
        responseStatus: response.status,
      })
      recordPlatformRouteEventLater({
        env,
        ctx,
        domain: "auth-session",
        route: "native",
        mode,
        responseStatus: response.status,
        metadata: { method: "GET" },
      })
      return response
    } catch (error) {
      if (error instanceof ShadowSessionAuthError) {
        const response = taggedPlatformError(ctx, {
          status: error.status,
          code: error.code,
          message: error.message,
          route: "native-auth-gate",
          mode,
          method: "GET",
        })
        logAuthSessionRouteEvent({
          requestId: ctx.requestId,
          route: "native-auth-gate",
          mode,
          method: "GET",
          responseStatus: response.status,
        })
        recordPlatformRouteEventLater({
          env,
          ctx,
          domain: "auth-session",
          route: "native-auth-gate",
          mode,
          responseStatus: response.status,
          metadata: { method: "GET" },
        })
        return response
      }

      if (error instanceof ShadowSessionUnavailableError) {
        return proxyAuthSession(request, env, ctx, {
          route: "native-fallback-proxy",
          mode,
          method: "GET",
          fallbackReason: error.reason,
        })
      }

      console.log(JSON.stringify({
        message: "auth session native read failed",
        requestId: ctx.requestId,
        error: error instanceof Error ? error.message : String(error),
      }))
      return proxyAuthSession(request, env, ctx, {
        route: "native-fallback-proxy",
        mode,
        method: "GET",
        fallbackReason: "shadow_read_failed",
      })
    }
  }

  if (request.method === "DELETE") {
    const mode = ctx.config.authSessionRevokeWriteMode

    if (mode === "proxy") {
      return proxyAuthSession(request, env, ctx, { route: "proxy", mode, method: "DELETE" })
    }

    let validated
    try {
      validated = await validateShadowSession(request.clone(), env, ctx, {
        requireDeviceHeader: true,
      })
    } catch (error) {
      if (error instanceof ShadowSessionAuthError) {
        const response = taggedPlatformError(ctx, {
          status: error.status,
          code: error.code,
          message: error.message,
          route: "native-auth-gate",
          mode,
          method: "DELETE",
        })
        logAuthSessionRouteEvent({
          requestId: ctx.requestId,
          route: "native-auth-gate",
          mode,
          method: "DELETE",
          responseStatus: response.status,
        })
        recordPlatformRouteEventLater({
          env,
          ctx,
          domain: "auth-session",
          route: "native-auth-gate",
          mode,
          responseStatus: response.status,
          metadata: { method: "DELETE" },
        })
        return response
      }

      if (error instanceof ShadowSessionUnavailableError) {
        return proxyAuthSession(request, env, ctx, {
          route: "native-fallback-proxy",
          mode,
          method: "DELETE",
          fallbackReason: error.reason,
        })
      }

      console.log(JSON.stringify({
        message: "auth session native validation failed",
        requestId: ctx.requestId,
        error: error instanceof Error ? error.message : String(error),
      }))
      return proxyAuthSession(request, env, ctx, {
        route: "native-fallback-proxy",
        mode,
        method: "DELETE",
        fallbackReason: "shadow_read_failed",
      })
    }

    const revokedAt = new Date(ctx.nowEpochMs).toISOString()
    try {
      await revokeShadowSession(env.ASTRA_PLATFORM_DB, {
        sessionId: validated.shadowSession.sessionId,
        revokedAt,
        lastVerifiedAt: revokedAt,
        shadowUpdatedAt: revokedAt,
      })
    } catch (error) {
      console.log(JSON.stringify({
        message: "auth session authoritative revoke failed",
        requestId: ctx.requestId,
        sessionId: validated.shadowSession.sessionId,
        error: error instanceof Error ? error.message : String(error),
      }))
      return proxyAuthSession(request, env, ctx, {
        route: "native-fallback-proxy",
        mode,
        method: "DELETE",
        fallbackReason: "authoritative_write_failed",
      })
    }

    let mirrorBackResponse: Response
    try {
      mirrorBackResponse = await mirrorAuthSessionDeleteToNode(request.clone(), ctx)
    } catch (error) {
      console.log(JSON.stringify({
        message: "auth session mirror-back request failed",
        requestId: ctx.requestId,
        sessionId: validated.shadowSession.sessionId,
        error: error instanceof Error ? error.message : String(error),
      }))
      const response = taggedPlatformError(ctx, {
        status: 503,
        code: "UPSTREAM_UNAVAILABLE",
        message: "The relay mirror-back did not complete after the authoritative auth/session revoke. Retry or reconcile before rollback.",
        route: "native",
        mode,
        method: "DELETE",
        fallbackReason: "mirror_back_commit_unknown",
      })
      logAuthSessionRouteEvent({
        requestId: ctx.requestId,
        route: "native",
        mode,
        method: "DELETE",
        responseStatus: response.status,
        fallbackReason: "mirror_back_commit_unknown",
      })
      recordPlatformRouteEventLater({
        env,
        ctx,
        domain: "auth-session",
        route: "native",
        mode,
        responseStatus: response.status,
        fallbackReason: "mirror_back_commit_unknown",
        metadata: { method: "DELETE" },
      })
      return response
    }

    if (!mirrorBackResponse.ok) {
      try {
        await upsertShadowSession(env.ASTRA_PLATFORM_DB, validated.shadowSession)
      } catch (rollbackError) {
        console.log(JSON.stringify({
          message: "auth session mirror-back rollback failed",
          requestId: ctx.requestId,
          sessionId: validated.shadowSession.sessionId,
          error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        }))
        const response = taggedPlatformError(ctx, {
          status: 503,
          code: "UPSTREAM_UNAVAILABLE",
          message: "The relay mirror-back rejected the authoritative auth/session revoke.",
          route: "native",
          mode,
          method: "DELETE",
          fallbackReason: "mirror_back_rollback_failed",
        })
        logAuthSessionRouteEvent({
          requestId: ctx.requestId,
          route: "native",
          mode,
          method: "DELETE",
          responseStatus: response.status,
          fallbackReason: "mirror_back_rollback_failed",
        })
        recordPlatformRouteEventLater({
          env,
          ctx,
          domain: "auth-session",
          route: "native",
          mode,
          responseStatus: response.status,
          fallbackReason: "mirror_back_rollback_failed",
          metadata: { method: "DELETE" },
        })
        return response
      }

      const taggedFallback = tagAuthSessionResponse(mirrorBackResponse, ctx, {
        route: "native-fallback-proxy",
        mode,
        method: "DELETE",
        fallbackReason: "mirror_back_rejected",
      })
      logAuthSessionRouteEvent({
        requestId: ctx.requestId,
        route: "native-fallback-proxy",
        mode,
        method: "DELETE",
        responseStatus: taggedFallback.status,
        fallbackReason: "mirror_back_rejected",
      })
      recordPlatformRouteEventLater({
        env,
        ctx,
        domain: "auth-session",
        route: "native-fallback-proxy",
        mode,
        responseStatus: taggedFallback.status,
        fallbackReason: "mirror_back_rejected",
        metadata: { method: "DELETE" },
      })
      return taggedFallback
    }

    const response = tagAuthSessionResponse(new Response(null, { status: 204 }), ctx, {
      route: "native",
      mode,
      method: "DELETE",
    })
    logAuthSessionRouteEvent({
      requestId: ctx.requestId,
      route: "native",
      mode,
      method: "DELETE",
      responseStatus: response.status,
    })
    recordPlatformRouteEventLater({
      env,
      ctx,
      domain: "auth-session",
      route: "native",
      mode,
      responseStatus: response.status,
      metadata: { method: "DELETE" },
    })
    return response
  }

  return taggedPlatformError(ctx, {
    status: 405,
    code: "INVALID_RESPONSE",
    message: "Method not allowed.",
    route: "unsupported_method",
    mode: request.method === "GET" ? ctx.config.authSessionReadMode : ctx.config.authSessionRevokeWriteMode,
    method: request.method,
  })
}
