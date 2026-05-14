import { AstraSessionSchema, type AstraSession } from "../../../../types/auth"
import {
  parseBearerToken,
  type AstraSessionClaims,
  verifyAstraSessionToken,
} from "../../../../utils/astra/session-token"
import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv } from "../env"
import { touchShadowDevice } from "../repositories/devices"
import { getShadowSessionById, touchShadowSession } from "../repositories/sessions"
import { getShadowUserUsageByUserId } from "../repositories/user-usage"
import { getShadowUserByEmail } from "../repositories/users"
import { getShadowDevice } from "../repositories/devices"
import type {
  ShadowDeviceRow,
  ShadowSessionRow,
  ShadowUserRow,
  ShadowUserUsageRow,
} from "../types/shadow-state"

export interface ValidatedShadowSession {
  token: string
  claims: AstraSessionClaims
  shadowUser: ShadowUserRow
  shadowSession: ShadowSessionRow
  currentDevice: ShadowDeviceRow
  shadowUserUsage: ShadowUserUsageRow | null
}

export interface ValidateShadowSessionOptions {
  requireDeviceHeader?: boolean
  requireAuthenticatedIdentity?: boolean
  requireUsage?: boolean
}

export interface TouchValidatedShadowSessionOptions {
  lastSeenAt?: string
  lastVerifiedAt?: string | null
  lastSyncAt?: string
}

export class ShadowSessionAuthError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "ShadowSessionAuthError"
  }
}

export class ShadowSessionUnavailableError extends Error {
  constructor(readonly reason: string, message: string) {
    super(message)
    this.name = "ShadowSessionUnavailableError"
  }
}

function isSessionExpired(expiresAt: string | null, nowIso: string): boolean {
  return Boolean(expiresAt && expiresAt <= nowIso)
}

export function buildAstraSessionFromShadow(
  validated: ValidatedShadowSession,
): AstraSession {
  const usage = validated.shadowUserUsage
  if (!usage) {
    throw new ShadowSessionUnavailableError(
      "missing_shadow_user_usage",
      `No D1 shadow usage snapshot was found for ${validated.shadowUser.id}.`,
    )
  }

  return AstraSessionSchema.parse({
    version: 1,
    sessionToken: validated.token,
    sessionId: validated.shadowSession.sessionId,
    deviceId: validated.shadowSession.deviceId,
    identityMode: validated.shadowSession.identityMode,
    relayBaseURL: validated.claims.relayBaseURL,
    email: validated.shadowUser.email,
    plan: validated.shadowUser.plan,
    subscriptionStatus: validated.shadowUser.subscriptionStatus,
    providerEntitlements: validated.shadowUser.providerEntitlements,
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
    issuedAt: validated.shadowSession.issuedAt,
    expiresAt: validated.shadowSession.expiresAt,
  })
}

export async function validateShadowSession(
  request: Request,
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
  options: ValidateShadowSessionOptions = {},
): Promise<ValidatedShadowSession> {
  const token = parseBearerToken(request.headers.get("authorization"))
  const secret = env.ASTRA_SESSION_SECRET?.trim()
  if (!secret) {
    throw new ShadowSessionUnavailableError(
      "missing_session_secret",
      "ASTRA_SESSION_SECRET is required for Worker-native session validation.",
    )
  }

  const claims = await verifyAstraSessionToken(token, secret)
  if (!token || !claims) {
    throw new ShadowSessionAuthError(401, "SESSION_REQUIRED", "Invalid or missing Astra session.")
  }

  const deviceHeader = request.headers.get("x-astra-device-id")?.trim() ?? ""
  if (options.requireDeviceHeader && !deviceHeader) {
    throw new ShadowSessionAuthError(400, "DEVICE_REQUIRED", "Missing X-Astra-Device-Id header.")
  }

  if (options.requireAuthenticatedIdentity && claims.identityMode !== "authenticated") {
    throw new ShadowSessionUnavailableError(
      "unsupported_identity_mode",
      "This Cloudflare cutover only supports authenticated Astra sessions.",
    )
  }

  const nowIso = new Date(ctx.nowEpochMs).toISOString()
  const shadowUser = await getShadowUserByEmail(env.ASTRA_PLATFORM_DB, claims.email)
  if (!shadowUser) {
    throw new ShadowSessionUnavailableError(
      "missing_shadow_user",
      `No D1 shadow user was found for ${claims.email}.`,
    )
  }

  const [shadowSession, currentDevice, shadowUserUsage] = await Promise.all([
    getShadowSessionById(env.ASTRA_PLATFORM_DB, claims.sessionId),
    getShadowDevice(env.ASTRA_PLATFORM_DB, shadowUser.id, claims.deviceId),
    options.requireUsage ? getShadowUserUsageByUserId(env.ASTRA_PLATFORM_DB, shadowUser.id) : Promise.resolve(null),
  ])

  if (!shadowSession) {
    throw new ShadowSessionUnavailableError(
      "missing_shadow_session",
      `No D1 shadow session was found for ${claims.sessionId}.`,
    )
  }
  if (
    shadowSession.userId !== shadowUser.id
    || shadowSession.deviceId !== claims.deviceId
    || shadowSession.identityMode !== claims.identityMode
  ) {
    throw new ShadowSessionUnavailableError(
      "shadow_session_mismatch",
      "The D1 shadow session does not match the signed Astra session claims.",
    )
  }
  if (deviceHeader && deviceHeader !== shadowSession.deviceId) {
    throw new ShadowSessionAuthError(409, "DEVICE_MISMATCH", "Astra session is bound to a different device.")
  }
  if (!currentDevice) {
    throw new ShadowSessionUnavailableError(
      "missing_shadow_device",
      `No D1 shadow device was found for ${claims.deviceId}.`,
    )
  }
  if (currentDevice.userId !== shadowUser.id || currentDevice.identityMode !== shadowSession.identityMode) {
    throw new ShadowSessionUnavailableError(
      "shadow_device_mismatch",
      "The D1 shadow device does not match the signed Astra session claims.",
    )
  }
  if (currentDevice.status === "revoked" || currentDevice.revokedAt) {
    throw new ShadowSessionAuthError(401, "DEVICE_REVOKED", "Astra device has been revoked.")
  }
  if (shadowSession.status === "revoked" || shadowSession.revokedAt) {
    throw new ShadowSessionAuthError(401, "SESSION_REVOKED", "Astra session has been revoked.")
  }
  if (isSessionExpired(shadowSession.expiresAt, nowIso)) {
    throw new ShadowSessionAuthError(401, "SESSION_EXPIRED", "Astra session has expired.")
  }
  if (options.requireUsage && !shadowUserUsage) {
    throw new ShadowSessionUnavailableError(
      "missing_shadow_user_usage",
      `No D1 shadow usage snapshot was found for ${shadowUser.id}.`,
    )
  }

  return {
    token,
    claims,
    shadowUser,
    shadowSession,
    currentDevice,
    shadowUserUsage,
  }
}

export function touchValidatedShadowSessionLater(
  env: AstraPlatformEnv,
  ctx: AstraRequestContext,
  validated: ValidatedShadowSession,
  options: TouchValidatedShadowSessionOptions = {},
): void {
  const lastSeenAt = options.lastSeenAt ?? new Date(ctx.nowEpochMs).toISOString()
  const lastVerifiedAt = Object.prototype.hasOwnProperty.call(options, "lastVerifiedAt")
    ? (options.lastVerifiedAt ?? null)
    : lastSeenAt
  const lastSyncAt = options.lastSyncAt

  ctx.execution.waitUntil((async () => {
    try {
      await Promise.all([
        touchShadowSession(env.ASTRA_PLATFORM_DB, {
          sessionId: validated.shadowSession.sessionId,
          lastSeenAt,
          lastVerifiedAt,
          shadowUpdatedAt: lastSeenAt,
        }),
        touchShadowDevice(env.ASTRA_PLATFORM_DB, {
          userId: validated.shadowUser.id,
          deviceId: validated.currentDevice.deviceId,
          lastSeenAt,
          lastSyncAt,
          shadowUpdatedAt: lastSeenAt,
        }),
      ])
    } catch (error) {
      console.log(JSON.stringify({
        message: "shadow session touch failed",
        requestId: ctx.requestId,
        sessionId: validated.shadowSession.sessionId,
        deviceId: validated.currentDevice.deviceId,
        error: error instanceof Error ? error.message : String(error),
      }))
    }
  })())
}
