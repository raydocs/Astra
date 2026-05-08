import {
  AstraPlanSchema,
  AstraSessionSchema,
  AstraSubscriptionStatusSchema,
  AstraUsageEventSchema,
  type AstraSession,
} from "../../../../src/types/auth"
import { buildAstraAnonymousIdentity } from "../../../../src/utils/astra/anonymous-identity"
import {
  ASTRA_CREDENTIAL_HASH_ALGORITHM,
  hashAstraCredentialSecret,
} from "../../../../src/utils/astra/credential-hash"
import {
  buildAstraSessionClaims,
  issueAstraSessionToken,
} from "../../../../src/utils/astra/session-token"
import { z } from "zod"

import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv, AuthIssueMode } from "../env"
import { errorResponse, jsonResponse, withResponseHeaders } from "../lib/http"
import { postNodeMirrorJson, NodeMirrorConfigError } from "../lib/node-mirror"
import { recordPlatformParityEventLater, recordPlatformRouteEventLater } from "../lib/platform-ops"
import { proxyToNodeRelay } from "../lib/proxy"
import {
  createPendingAuthIssueRequest,
  getAuthIssueRequest,
  markAuthIssueRequestCompleted,
  markAuthIssueRequestFailed,
} from "../repositories/auth-issue-requests"
import { getShadowDevice, upsertShadowDevice } from "../repositories/devices"
import { getShadowSessionById, upsertShadowSession } from "../repositories/sessions"
import { getShadowUserUsageByUserId, upsertShadowUserUsage } from "../repositories/user-usage"
import {
  createShadowAnonymousUser,
  getShadowUserById,
  getShadowUserByInstallId,
} from "../repositories/users"
import type {
  ShadowDeviceSnapshot,
  ShadowSessionSnapshot,
  ShadowUserRow,
  ShadowUserSnapshot,
  ShadowUserUsageSnapshot,
} from "../types/shadow-state"

const DeviceDescriptorSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  platform: z.string().trim().min(1).max(40).optional(),
  browserFamily: z.string().trim().min(1).max(40).optional(),
  appKind: z.string().trim().min(1).max(20).optional(),
  appVersion: z.string().trim().min(1).max(40).optional(),
})

const AnonymousAuthSchema = DeviceDescriptorSchema.extend({
  deviceId: z.string().trim().min(1).optional(),
  installId: z.string().trim().min(1).optional(),
  device: DeviceDescriptorSchema.optional(),
}).refine(
  (value) => Boolean(value.deviceId ?? value.installId),
  { message: "deviceId or installId is required.", path: ["deviceId"] },
)

const ANONYMOUS_RATE_LIMIT = 3
const ANONYMOUS_RATE_WINDOW_MS = 60 * 60 * 1000
const anonymousIssuesByIp = new Map<string, number[]>()

type AnonymousAuthBody = z.infer<typeof AnonymousAuthSchema>

function tagAnonymousAuthResponse(
  response: Response,
  ctx: AstraRequestContext,
  params: {
    route: string
    mode: AuthIssueMode
    fallbackReason?: string | null
  },
): Response {
  const headers: Record<string, string> = {
    "x-astra-request-id": ctx.requestId,
    "x-astra-platform-route": params.route,
    "x-astra-platform-mode": params.mode,
    "x-astra-platform-default-mode": ctx.config.authAnonymousIssueMode ?? "proxy",
    "x-astra-platform-domain": "auth-anonymous",
  }

  if (params.fallbackReason) {
    headers["x-astra-platform-fallback-reason"] = params.fallbackReason
  }

  return withResponseHeaders(response, headers)
}

function logAnonymousRouteEvent(params: {
  requestId: string
  route: string
  mode: AuthIssueMode
  responseStatus: number
  fallbackReason?: string | null
}) {
  console.log(JSON.stringify({
    message: "auth anonymous route handled",
    requestId: params.requestId,
    route: params.route,
    mode: params.mode,
    responseStatus: params.responseStatus,
    fallbackReason: params.fallbackReason ?? null,
  }))
}

function taggedAnonymousError(
  ctx: AstraRequestContext,
  params: {
    status: number
    code: string
    message: string
    route: string
    mode: AuthIssueMode
    fallbackReason?: string | null
  },
): Response {
  return tagAnonymousAuthResponse(
    errorResponse(params.status, params.code, params.message, ctx.requestId),
    ctx,
    params,
  )
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.trim()
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown"
  }
  return request.headers.get("cf-connecting-ip")?.trim() || "unknown"
}

function checkAnonymousRateLimit(ip: string, nowEpochMs: number): boolean {
  const timestamps = anonymousIssuesByIp.get(ip)
  if (!timestamps) return true
  const windowStart = nowEpochMs - ANONYMOUS_RATE_WINDOW_MS
  const recent = timestamps.filter((value) => value >= windowStart)
  anonymousIssuesByIp.set(ip, recent)
  return recent.length < ANONYMOUS_RATE_LIMIT
}

function recordAnonymousIssue(ip: string, nowEpochMs: number): void {
  const timestamps = anonymousIssuesByIp.get(ip) ?? []
  timestamps.push(nowEpochMs)
  anonymousIssuesByIp.set(ip, timestamps)
}

export function resetAnonymousIssueRateLimits(): void {
  anonymousIssuesByIp.clear()
}

function normalizeSessionPublicBaseURL(ctx: AstraRequestContext): string {
  const configured = ctx.config.sessionPublicBaseURL?.trim()
  if (configured) {
    return configured.replace(/\/+$/, "")
  }
  return new URL("/v1", ctx.config.nodeRelayOrigin).toString().replace(/\/+$/, "")
}

function readIdempotencyKey(request: Request): string | null {
  const value = request.headers.get("idempotency-key")?.trim()
  return value || null
}

function buildAnonymousRequestKey(params: {
  installId: string
  deviceId: string
  idempotencyKey: string
}): string {
  return `anonymous:${params.installId}:${params.deviceId}:${params.idempotencyKey}`
}

function buildAnonymousIssueRouteResponse(
  response: Response,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
  params: {
    route: string
    mode: AuthIssueMode
    fallbackReason?: string | null
    metadata?: Record<string, unknown> | null
  },
): Response {
  const tagged = tagAnonymousAuthResponse(response, ctx, params)
  logAnonymousRouteEvent({
    requestId: ctx.requestId,
    route: params.route,
    mode: params.mode,
    responseStatus: tagged.status,
    fallbackReason: params.fallbackReason,
  })
  recordPlatformRouteEventLater({
    env,
    ctx,
    domain: "auth-anonymous",
    route: params.route,
    mode: params.mode,
    responseStatus: tagged.status,
    fallbackReason: params.fallbackReason,
    metadata: params.metadata ?? null,
  })
  return tagged
}

function normalizeAnonymousDevice(body: AnonymousAuthBody) {
  const descriptor = body.device ?? body
  return {
    deviceId: body.deviceId ?? body.installId!,
    installId: body.installId?.trim() || null,
    label: descriptor.label?.trim() || "Astra anonymous device",
    platform: descriptor.platform?.trim() || null,
    browserFamily: descriptor.browserFamily?.trim() || null,
    appKind: descriptor.appKind?.trim() || "extension",
    appVersion: descriptor.appVersion?.trim() || null,
  }
}

function readAnonymousQuotaConfig(env: AstraPlatformEnv) {
  const parseNumber = (value: string | undefined, fallback: number): number => {
    const parsed = Number(value?.trim())
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
  }

  return {
    dailyRequests: parseNumber(env.ASTRA_FREE_DAILY_REQUESTS, 200),
    dailyCharacters: parseNumber(env.ASTRA_FREE_DAILY_CHARACTERS, 200_000),
    requestsPerMinute: parseNumber(env.ASTRA_FREE_RPM, 20),
  }
}

function readSessionTtlMs(env: AstraPlatformEnv): number {
  const parsed = Number(env.ASTRA_SESSION_TTL_MS?.trim())
  return Number.isFinite(parsed) ? parsed : 30 * 24 * 60 * 60 * 1000
}

function createAnonymousUsageSnapshot(
  env: AstraPlatformEnv,
  userId: string,
  nowIso: string,
): ShadowUserUsageSnapshot {
  const quota = readAnonymousQuotaConfig(env)
  return {
    userId,
    usageDay: nowIso.slice(0, 10),
    dailyRequestsLimit: quota.dailyRequests,
    dailyCharactersLimit: quota.dailyCharacters,
    requestsPerMinuteLimit: quota.requestsPerMinute,
    requestsToday: 0,
    charactersToday: 0,
    totalRequests: 0,
    totalCharacters: 0,
    lastRequestAt: null,
    recentEvents: [],
    shadowUpdatedAt: nowIso,
  }
}

async function buildAnonymousUserSnapshot(params: {
  env: AstraPlatformEnv
  installId: string
  nowIso: string
}): Promise<{
  user: ShadowUserSnapshot
  usage: ShadowUserUsageSnapshot
  passwordHash: string
}> {
  const identity = await buildAstraAnonymousIdentity({ installId: params.installId })
  const passwordHash = await hashAstraCredentialSecret(identity.placeholderPassword)
  const user: ShadowUserSnapshot = {
    id: identity.userId,
    email: identity.email,
    billingEmail: identity.email,
    createdAt: params.nowIso,
    plan: AstraPlanSchema.parse("free"),
    subscriptionStatus: AstraSubscriptionStatusSchema.parse("active"),
    identityMode: "anonymous",
    installId: params.installId,
    providerEntitlements: ["openai"],
    syncPreferences: {
      reading_history: false,
      study_progress: false,
    },
    shadowUpdatedAt: params.nowIso,
  }

  return {
    user,
    usage: createAnonymousUsageSnapshot(params.env, user.id, params.nowIso),
    passwordHash,
  }
}

function buildAnonymousDeviceSnapshot(params: {
  userId: string
  body: AnonymousAuthBody
  nowIso: string
  existingFirstSeenAt?: string | null
}): ShadowDeviceSnapshot {
  const device = normalizeAnonymousDevice(params.body)
  return {
    userId: params.userId,
    deviceId: device.deviceId,
    identityMode: "anonymous",
    label: device.label,
    platform: device.platform,
    browserFamily: device.browserFamily,
    appKind: device.appKind,
    appVersion: device.appVersion,
    firstSeenAt: params.existingFirstSeenAt ?? params.nowIso,
    lastSeenAt: params.nowIso,
    lastSyncAt: null,
    status: "active",
    revokedAt: null,
    updatedAt: params.nowIso,
    shadowUpdatedAt: params.nowIso,
  }
}

async function buildAnonymousSessionArtifacts(params: {
  env: AstraPlatformEnv
  ctx: AstraRequestContext
  user: ShadowUserRow
  usage: ShadowUserUsageSnapshot | { dailyRequestsLimit: number; dailyCharactersLimit: number; requestsPerMinuteLimit: number; requestsToday: number; charactersToday: number; totalRequests: number; totalCharacters: number; lastRequestAt: string | null; recentEvents: Array<z.infer<typeof AstraUsageEventSchema>> }
  deviceId: string
  sessionId: string
  issuedAt: string
}): Promise<{
  token: string
  session: ShadowSessionSnapshot
  response: AstraSession
}> {
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
    identityMode: "anonymous",
  })
  const token = await issueAstraSessionToken(claims, params.env.ASTRA_SESSION_SECRET?.trim() || "")
  const tokenHash = await hashAstraCredentialSecret(token)
  const session: ShadowSessionSnapshot = {
    sessionId: params.sessionId,
    userId: params.user.id,
    deviceId: params.deviceId,
    identityMode: "anonymous",
    issuedAt: params.issuedAt,
    expiresAt,
    createdAt: params.issuedAt,
    lastSeenAt: params.issuedAt,
    lastVerifiedAt: params.issuedAt,
    status: "active",
    revokedAt: null,
    tokenHash,
    tokenHashAlg: ASTRA_CREDENTIAL_HASH_ALGORITHM,
    shadowUpdatedAt: params.issuedAt,
  }

  const usage = params.usage

  return {
    token,
    session,
    response: AstraSessionSchema.parse({
      version: 1,
      sessionToken: token,
      sessionId: params.sessionId,
      deviceId: params.deviceId,
      identityMode: "anonymous",
      relayBaseURL,
      email: params.user.email,
      plan: params.user.plan,
      subscriptionStatus: params.user.subscriptionStatus,
      providerEntitlements: params.user.providerEntitlements,
      quota: {
        dailyRequestsLimit: usage.dailyRequestsLimit,
        dailyCharactersLimit: usage.dailyCharactersLimit,
        requestsPerMinuteLimit: usage.requestsPerMinuteLimit,
        remainingDailyRequests: Math.max(0, usage.dailyRequestsLimit - usage.requestsToday),
        remainingDailyCharacters: Math.max(0, usage.dailyCharactersLimit - usage.charactersToday),
      },
      usage: {
        totalRequests: usage.totalRequests,
        totalCharacters: usage.totalCharacters,
        dailyRequestsUsed: usage.requestsToday,
        dailyCharactersUsed: usage.charactersToday,
        lastRequestAt: usage.lastRequestAt,
        recentEvents: usage.recentEvents,
      },
      issuedAt: params.issuedAt,
      expiresAt,
    }),
  }
}

async function buildAnonymousSessionId(requestKey: string): Promise<string> {
  const digest = await hashAstraCredentialSecret(requestKey)
  return `sess_${digest.slice(0, 24)}`
}

async function ensureAnonymousShadowUser(params: {
  env: AstraPlatformEnv
  installId: string
  nowIso: string
}): Promise<{
  user: ShadowUserRow
  usage: ReturnType<typeof createAnonymousUsageSnapshot>
  passwordHash: string
  createdNewUser: boolean
}> {
  const existing = await getShadowUserByInstallId(params.env.ASTRA_PLATFORM_DB, params.installId)
  const built = await buildAnonymousUserSnapshot({
    env: params.env,
    installId: params.installId,
    nowIso: params.nowIso,
  })

  if (existing) {
    return {
      user: existing,
      usage: createAnonymousUsageSnapshot(params.env, existing.id, params.nowIso),
      passwordHash: built.passwordHash,
      createdNewUser: false,
    }
  }

  try {
    const created = await createShadowAnonymousUser(params.env.ASTRA_PLATFORM_DB, built.user)
    return {
      user: created,
      usage: built.usage,
      passwordHash: built.passwordHash,
      createdNewUser: true,
    }
  } catch {
    const afterRace = await getShadowUserByInstallId(params.env.ASTRA_PLATFORM_DB, params.installId)
    if (!afterRace) throw new Error("Anonymous shadow user creation failed before install lookup converged.")
    return {
      user: afterRace,
      usage: createAnonymousUsageSnapshot(params.env, afterRace.id, params.nowIso),
      passwordHash: built.passwordHash,
      createdNewUser: false,
    }
  }
}

async function ensureAnonymousUsage(
  env: AstraPlatformEnv,
  user: ShadowUserRow,
  nowIso: string,
) {
  const existing = await getShadowUserUsageByUserId(env.ASTRA_PLATFORM_DB, user.id)
  if (existing) {
    return existing
  }
  return upsertShadowUserUsage(env.ASTRA_PLATFORM_DB, createAnonymousUsageSnapshot(env, user.id, nowIso))
}

async function buildAnonymousMirrorPayload(params: {
  env: AstraPlatformEnv
  shadowUser: ShadowUserRow
  shadowUsage: {
    usageDay: string
    requestsToday: number
    charactersToday: number
    totalRequests: number
    totalCharacters: number
    lastRequestAt: string | null
    recentEvents: Array<z.infer<typeof AstraUsageEventSchema>>
    dailyRequestsLimit: number
    dailyCharactersLimit: number
    requestsPerMinuteLimit: number
  }
  device: ShadowDeviceSnapshot
  session: ShadowSessionSnapshot
  installId: string
}): Promise<Record<string, unknown>> {
  const identity = await buildAstraAnonymousIdentity({ installId: params.installId })
  const passwordHash = await hashAstraCredentialSecret(identity.placeholderPassword)

  return {
    user: {
      id: params.shadowUser.id,
      email: params.shadowUser.email,
      billingEmail: params.shadowUser.billingEmail,
      createdAt: params.shadowUser.createdAt,
      passwordHash,
      plan: params.shadowUser.plan,
      subscriptionStatus: params.shadowUser.subscriptionStatus,
      providerEntitlements: params.shadowUser.providerEntitlements,
      limits: {
        dailyRequests: params.shadowUsage.dailyRequestsLimit,
        dailyCharacters: params.shadowUsage.dailyCharactersLimit,
        requestsPerMinute: params.shadowUsage.requestsPerMinuteLimit,
      },
      usage: {
        usageDay: params.shadowUsage.usageDay,
        requestsToday: params.shadowUsage.requestsToday,
        charactersToday: params.shadowUsage.charactersToday,
        totalRequests: params.shadowUsage.totalRequests,
        totalCharacters: params.shadowUsage.totalCharacters,
        lastRequestAt: params.shadowUsage.lastRequestAt,
        recentRequestTimestamps: [],
        recentEvents: params.shadowUsage.recentEvents,
      },
      identityMode: "anonymous",
      syncPreferences: params.shadowUser.syncPreferences,
      installId: params.installId,
    },
    device: {
      deviceId: params.device.deviceId,
      userId: params.shadowUser.id,
      email: params.shadowUser.email,
      identityMode: "anonymous",
      label: params.device.label,
      platform: params.device.platform,
      browserFamily: params.device.browserFamily,
      appKind: params.device.appKind,
      appVersion: params.device.appVersion,
      firstSeenAt: params.device.firstSeenAt,
      lastSeenAt: params.device.lastSeenAt,
      lastSyncAt: params.device.lastSyncAt ?? null,
      status: params.device.status,
      updatedAt: params.device.updatedAt,
      revokedAt: params.device.revokedAt ?? null,
    },
    session: {
      sessionId: params.session.sessionId,
      userId: params.shadowUser.id,
      email: params.shadowUser.email,
      deviceId: params.session.deviceId,
      identityMode: "anonymous",
      issuedAt: params.session.issuedAt,
      expiresAt: params.session.expiresAt ?? null,
      createdAt: params.session.createdAt,
      lastSeenAt: params.session.lastSeenAt,
      lastVerifiedAt: params.session.lastVerifiedAt ?? null,
      status: params.session.status,
      revokedAt: params.session.revokedAt ?? null,
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

async function preflightAnonymousShadow(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
  nodeSession: AstraSession | null,
): Promise<void> {
  try {
    const body = AnonymousAuthSchema.parse(await request.json())
    const device = normalizeAnonymousDevice(body)
    const installId = device.installId ?? device.deviceId
    const shadowUser = await getShadowUserByInstallId(env.ASTRA_PLATFORM_DB, installId)
    if (!shadowUser) {
      return
    }

    const issues: string[] = []
    if (shadowUser.identityMode !== "anonymous") {
      issues.push("install_lookup_not_anonymous")
    }
    const usage = await getShadowUserUsageByUserId(env.ASTRA_PLATFORM_DB, shadowUser.id)
    if (!usage) {
      issues.push("missing_shadow_user_usage")
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
        domain: "auth-anonymous",
        outcome: "parity_mismatch",
        scope: "shadow_preflight",
        metadata: {
          installId,
          deviceId: device.deviceId,
          issues,
        },
      })
    }
  } catch (error) {
    recordPlatformParityEventLater({
      env,
      ctx,
      domain: "auth-anonymous",
      outcome: "compare_failed",
      scope: "shadow_preflight",
      metadata: {
        error: error instanceof Error ? error.message : String(error),
      },
    })
  }
}

export async function handleAuthAnonymous(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
): Promise<Response> {
  const mode = ctx.config.authAnonymousIssueMode ?? "proxy"

  if (mode === "proxy") {
    return buildAnonymousIssueRouteResponse(
      await proxyToNodeRelay(request, env, ctx),
      env,
      ctx,
      { route: "proxy", mode },
    )
  }

  if (mode === "shadow") {
    const shadowRequest = request.clone()
    const proxyResponse = await proxyToNodeRelay(request, env, ctx)
    const tagged = buildAnonymousIssueRouteResponse(proxyResponse, env, ctx, {
      route: "shadow-proxy",
      mode,
    })
    if (tagged.ok) {
      ctx.execution.waitUntil((async () => {
        try {
          const nodeSession = AstraSessionSchema.parse(await tagged.clone().json())
          await preflightAnonymousShadow(shadowRequest, env, ctx, nodeSession)
        } catch (error) {
          console.log(JSON.stringify({
            message: "auth anonymous shadow issue preflight failed",
            requestId: ctx.requestId,
            error: error instanceof Error ? error.message : String(error),
          }))
        }
      })())
    }
    return tagged
  }

  const body = AnonymousAuthSchema.safeParse(await request.clone().json().catch(() => ({})))
  if (!body.success) {
    return buildAnonymousIssueRouteResponse(
      taggedAnonymousError(ctx, {
        status: 400,
        code: "DEVICE_REQUIRED",
        message: "deviceId or installId is required.",
        route: "native-validation",
        mode,
      }),
      env,
      ctx,
      {
        route: "native-validation",
        mode,
        metadata: { issues: body.error.issues.map((issue) => issue.path.join(".") || issue.message) },
      },
    )
  }

  const idempotencyKey = readIdempotencyKey(request)
  if (!idempotencyKey) {
    return buildAnonymousIssueRouteResponse(
      taggedAnonymousError(ctx, {
        status: 400,
        code: "INVALID_REQUEST",
        message: "Idempotency-Key is required for Worker-native anonymous issuance.",
        route: "native-validation",
        mode,
      }),
      env,
      ctx,
      { route: "native-validation", mode },
    )
  }

  if (!env.ASTRA_SESSION_SECRET?.trim()) {
    return buildAnonymousIssueRouteResponse(
      taggedAnonymousError(ctx, {
        status: 503,
        code: "CONFIG_MISSING",
        message: "ASTRA_SESSION_SECRET is required for Worker-native anonymous issuance.",
        route: "native-config-gate",
        mode,
      }),
      env,
      ctx,
      { route: "native-config-gate", mode },
    )
  }

  const device = normalizeAnonymousDevice(body.data)
  const installId = device.installId ?? device.deviceId
  const requestKey = buildAnonymousRequestKey({
    installId,
    deviceId: device.deviceId,
    idempotencyKey,
  })
  const nowIso = new Date(ctx.nowEpochMs).toISOString()
  const existingRequest = await getAuthIssueRequest(env.ASTRA_PLATFORM_DB, requestKey)

  if (existingRequest) {
    if (existingRequest.routeKind !== "anonymous" || existingRequest.installId !== installId || existingRequest.deviceId !== device.deviceId) {
      return buildAnonymousIssueRouteResponse(
        taggedAnonymousError(ctx, {
          status: 409,
          code: "INVALID_REQUEST",
          message: "Idempotency-Key is already bound to a different anonymous issuance payload.",
          route: "native-idempotency-conflict",
          mode,
        }),
        env,
        ctx,
        { route: "native-idempotency-conflict", mode },
      )
    }

    if (existingRequest.nodeMirrorStatus === "failed") {
      return buildAnonymousIssueRouteResponse(
        taggedAnonymousError(ctx, {
          status: 409,
          code: "INVALID_REQUEST",
          message: existingRequest.errorMessage
            ? `${existingRequest.errorMessage} Retry with a new Idempotency-Key.`
            : "Previous anonymous issuance failed. Retry with a new Idempotency-Key.",
          route: "native-idempotency-failed",
          mode,
        }),
        env,
        ctx,
        { route: "native-idempotency-failed", mode },
      )
    }

    const [shadowUser, shadowSession, shadowUsage] = await Promise.all([
      existingRequest.userId ? getShadowUserById(env.ASTRA_PLATFORM_DB, existingRequest.userId) : Promise.resolve(null),
      getShadowSessionById(env.ASTRA_PLATFORM_DB, existingRequest.sessionId),
      existingRequest.userId ? getShadowUserUsageByUserId(env.ASTRA_PLATFORM_DB, existingRequest.userId) : Promise.resolve(null),
    ])

    if (!shadowUser || !shadowSession || !shadowUsage) {
      return buildAnonymousIssueRouteResponse(
        taggedAnonymousError(ctx, {
          status: 503,
          code: "UPSTREAM_UNAVAILABLE",
          message: "Anonymous issuance state is incomplete; retry with a new Idempotency-Key after reconciliation.",
          route: "native-idempotency-incomplete",
          mode,
        }),
        env,
        ctx,
        { route: "native-idempotency-incomplete", mode },
      )
    }

    if (existingRequest.nodeMirrorStatus === "completed") {
      const { response } = await buildAnonymousSessionArtifacts({
        env,
        ctx,
        user: shadowUser,
        usage: shadowUsage,
        deviceId: shadowSession.deviceId,
        sessionId: shadowSession.sessionId,
        issuedAt: shadowSession.issuedAt,
      })
      return buildAnonymousIssueRouteResponse(jsonResponse(response), env, ctx, {
        route: "native-idempotent-replay",
        mode,
      })
    }

    const currentDevice = await getShadowDevice(env.ASTRA_PLATFORM_DB, shadowUser.id, shadowSession.deviceId)
    if (!currentDevice) {
      return buildAnonymousIssueRouteResponse(
        taggedAnonymousError(ctx, {
          status: 503,
          code: "UPSTREAM_UNAVAILABLE",
          message: "Anonymous issuance mirror-back is pending but the authoritative device snapshot is missing.",
          route: "native-idempotency-incomplete",
          mode,
        }),
        env,
        ctx,
        { route: "native-idempotency-incomplete", mode },
      )
    }

    try {
      const mirrorResponse = await postNodeMirrorJson(request, env, ctx, {
        path: "/_internal/cloudflare/auth/issue/anonymous",
        body: await buildAnonymousMirrorPayload({
          env,
          shadowUser,
          shadowUsage,
          device: currentDevice,
          session: shadowSession,
          installId,
        }),
      })

      if (!mirrorResponse.ok) {
        const mirrorError = await readMirrorError(mirrorResponse)
        await markAuthIssueRequestFailed(env.ASTRA_PLATFORM_DB, {
          requestKey,
          failedAt: nowIso,
          errorCode: mirrorError.code ?? "NODE_MIRROR_REJECTED",
          errorMessage: mirrorError.message ?? `Node mirror-back rejected anonymous issuance with status ${mirrorResponse.status}.`,
        })
        return buildAnonymousIssueRouteResponse(mirrorResponse, env, ctx, {
          route: "native-fallback-proxy",
          mode,
          fallbackReason: "mirror_back_rejected",
        })
      }

      await markAuthIssueRequestCompleted(env.ASTRA_PLATFORM_DB, {
        requestKey,
        completedAt: nowIso,
      })
      const { response } = await buildAnonymousSessionArtifacts({
        env,
        ctx,
        user: shadowUser,
        usage: shadowUsage,
        deviceId: shadowSession.deviceId,
        sessionId: shadowSession.sessionId,
        issuedAt: shadowSession.issuedAt,
      })
      return buildAnonymousIssueRouteResponse(jsonResponse(response), env, ctx, {
        route: "native-idempotent-replay",
        mode,
      })
    } catch (error) {
      if (error instanceof NodeMirrorConfigError) {
        await markAuthIssueRequestFailed(env.ASTRA_PLATFORM_DB, {
          requestKey,
          failedAt: nowIso,
          errorCode: "CONFIG_MISSING",
          errorMessage: error.message,
        })
        return buildAnonymousIssueRouteResponse(
          taggedAnonymousError(ctx, {
            status: 503,
            code: "CONFIG_MISSING",
            message: error.message,
            route: "native-config-gate",
            mode,
          }),
          env,
          ctx,
          { route: "native-config-gate", mode },
        )
      }

      return buildAnonymousIssueRouteResponse(
        taggedAnonymousError(ctx, {
          status: 503,
          code: "UPSTREAM_UNAVAILABLE",
          message: "The relay mirror-back did not complete after authoritative anonymous issuance. Retry with the same Idempotency-Key.",
          route: "native",
          mode,
          fallbackReason: "mirror_back_commit_unknown",
        }),
        env,
        ctx,
        {
          route: "native",
          mode,
          fallbackReason: "mirror_back_commit_unknown",
        },
      )
    }
  }

  const shadowUser = await getShadowUserByInstallId(env.ASTRA_PLATFORM_DB, installId)
  if (!shadowUser && !checkAnonymousRateLimit(getClientIp(request), ctx.nowEpochMs)) {
    return buildAnonymousIssueRouteResponse(
      taggedAnonymousError(ctx, {
        status: 429,
        code: "QUOTA_EXCEEDED",
        message: "Too many anonymous registrations",
        route: "native-rate-limit",
        mode,
      }),
      env,
      ctx,
      { route: "native-rate-limit", mode },
    )
  }

  try {
    const ensured = await ensureAnonymousShadowUser({
      env,
      installId,
      nowIso,
    })
    const usage = await ensureAnonymousUsage(env, ensured.user, nowIso)
    const existingDevice = await getShadowDevice(env.ASTRA_PLATFORM_DB, ensured.user.id, device.deviceId)
    const deviceSnapshot = buildAnonymousDeviceSnapshot({
      userId: ensured.user.id,
      body: body.data,
      nowIso,
      existingFirstSeenAt: existingDevice?.firstSeenAt ?? null,
    })
    const sessionId = await buildAnonymousSessionId(requestKey)
    const issued = await buildAnonymousSessionArtifacts({
      env,
      ctx,
      user: ensured.user,
      usage,
      deviceId: deviceSnapshot.deviceId,
      sessionId,
      issuedAt: nowIso,
    })

    await Promise.all([
      upsertShadowUserUsage(env.ASTRA_PLATFORM_DB, usage),
      upsertShadowDevice(env.ASTRA_PLATFORM_DB, deviceSnapshot),
      upsertShadowSession(env.ASTRA_PLATFORM_DB, issued.session),
      createPendingAuthIssueRequest(env.ASTRA_PLATFORM_DB, {
        requestKey,
        routeKind: "anonymous",
        userId: ensured.user.id,
        installId,
        deviceId: deviceSnapshot.deviceId,
        sessionId,
        nodeMirrorStatus: "pending",
        createdAt: nowIso,
        lastAttemptAt: nowIso,
        shadowUpdatedAt: nowIso,
      }),
    ])

    const mirrorResponse = await postNodeMirrorJson(request, env, ctx, {
      path: "/_internal/cloudflare/auth/issue/anonymous",
      body: await buildAnonymousMirrorPayload({
        env,
        shadowUser: ensured.user,
        shadowUsage: usage,
        device: deviceSnapshot,
        session: issued.session,
        installId,
      }),
    })

    if (!mirrorResponse.ok) {
      const mirrorError = await readMirrorError(mirrorResponse)
      await markAuthIssueRequestFailed(env.ASTRA_PLATFORM_DB, {
        requestKey,
        failedAt: nowIso,
        errorCode: mirrorError.code ?? "NODE_MIRROR_REJECTED",
        errorMessage: mirrorError.message ?? `Node mirror-back rejected anonymous issuance with status ${mirrorResponse.status}.`,
      })
      return buildAnonymousIssueRouteResponse(mirrorResponse, env, ctx, {
        route: "native-fallback-proxy",
        mode,
        fallbackReason: "mirror_back_rejected",
      })
    }

    await markAuthIssueRequestCompleted(env.ASTRA_PLATFORM_DB, {
      requestKey,
      completedAt: nowIso,
    })
    if (!shadowUser) {
      recordAnonymousIssue(getClientIp(request), ctx.nowEpochMs)
    }
    return buildAnonymousIssueRouteResponse(jsonResponse(issued.response), env, ctx, {
      route: "native",
      mode,
      metadata: {
        idempotent: false,
        createdNewUser: ensured.createdNewUser,
      },
    })
  } catch (error) {
    if (error instanceof NodeMirrorConfigError) {
      return buildAnonymousIssueRouteResponse(
        taggedAnonymousError(ctx, {
          status: 503,
          code: "CONFIG_MISSING",
          message: error.message,
          route: "native-config-gate",
          mode,
        }),
        env,
        ctx,
        { route: "native-config-gate", mode },
      )
    }

    return buildAnonymousIssueRouteResponse(
      taggedAnonymousError(ctx, {
        status: 503,
        code: "UPSTREAM_UNAVAILABLE",
        message: "The relay mirror-back did not complete after authoritative anonymous issuance. Retry with the same Idempotency-Key.",
        route: "native",
        mode,
        fallbackReason: "mirror_back_commit_unknown",
      }),
      env,
      ctx,
      {
        route: "native",
        mode,
        fallbackReason: "mirror_back_commit_unknown",
      },
    )
  }
}
