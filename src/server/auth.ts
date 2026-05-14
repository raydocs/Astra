import { AstraSessionSchema } from "../types/auth"
import {
  buildAstraSessionClaims,
  issueAstraSessionToken,
  parseBearerToken,
  verifyAstraSessionToken,
} from "../utils/astra/session-token"

import type {
  AuthenticatedSession,
  RelayEnv,
  RelaySession,
  ServerSessionRecord,
  ServerUserRecord,
  SessionClaims,
} from "./types"

export function buildRelaySession(
  user: ServerUserRecord,
  token: string,
  sessionRecord: ServerSessionRecord,
  relayBaseURL: string,
): RelaySession {
  const baseSession = AstraSessionSchema.parse({
    version: 1,
    sessionToken: token,
    relayBaseURL,
    email: user.email,
    plan: user.plan,
    subscriptionStatus: user.subscriptionStatus,
    providerEntitlements: user.providerEntitlements,
    quota: {
      dailyRequestsLimit: user.limits.dailyRequests,
      dailyCharactersLimit: user.limits.dailyCharacters,
      requestsPerMinuteLimit: user.limits.requestsPerMinute,
      remainingDailyRequests: Math.max(0, user.limits.dailyRequests - user.usage.requestsToday),
      remainingDailyCharacters: Math.max(0, user.limits.dailyCharacters - user.usage.charactersToday),
    },
    usage: {
      totalRequests: user.usage.totalRequests,
      totalCharacters: user.usage.totalCharacters,
      dailyRequestsUsed: user.usage.requestsToday,
      dailyCharactersUsed: user.usage.charactersToday,
      lastRequestAt: user.usage.lastRequestAt,
      recentEvents: user.usage.recentEvents,
    },
    expiresAt: sessionRecord.expiresAt,
  })

  return {
    ...baseSession,
    sessionId: sessionRecord.sessionId,
    deviceId: sessionRecord.deviceId,
    issuedAt: sessionRecord.issuedAt,
    identityMode: sessionRecord.identityMode,
  }
}

export async function issueSession(
  user: ServerUserRecord,
  sessionRecord: ServerSessionRecord,
  env: RelayEnv,
): Promise<AuthenticatedSession> {
  const claims = buildAstraSessionClaims({
    email: user.email,
    relayBaseURL: env.sessionPublicBaseURL,
    issuedAt: sessionRecord.issuedAt,
    expiresAt: sessionRecord.expiresAt,
    sessionId: sessionRecord.sessionId,
    deviceId: sessionRecord.deviceId,
    identityMode: sessionRecord.identityMode,
  }) satisfies SessionClaims

  const token = await issueAstraSessionToken(claims, env.sessionSecret)

  return {
    token,
    claims,
    session: buildRelaySession(user, token, sessionRecord, env.sessionPublicBaseURL),
  }
}

export async function verifySessionToken(
  token: string | null | undefined,
  env: RelayEnv,
): Promise<SessionClaims | null> {
  return verifyAstraSessionToken(token, env.sessionSecret)
}

export { parseBearerToken }
