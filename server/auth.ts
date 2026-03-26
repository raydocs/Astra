import { createHmac, timingSafeEqual } from "node:crypto"

import type { AstraSession } from "../src/types/auth"

import type { AuthenticatedSession, RelayEnv, ServerUserRecord, SessionClaims } from "./types"

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url")
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8")
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url")
}

export function issueSession(user: ServerUserRecord, env: RelayEnv): AuthenticatedSession {
  const claims: SessionClaims = {
    email: user.email,
    relayBaseURL: env.publicBaseURL,
    issuedAt: new Date().toISOString(),
  }

  const payload = base64UrlEncode(JSON.stringify(claims))
  const signature = signPayload(payload, env.sessionSecret)
  const token = `${payload}.${signature}`

  return {
    token,
    claims,
    session: {
      version: 1,
      sessionToken: token,
      relayBaseURL: env.publicBaseURL,
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
      expiresAt: null,
    },
  }
}

export function verifySessionToken(
  token: string | null | undefined,
  env: RelayEnv,
): AuthenticatedSession | null {
  if (!token) return null

  const [payload, signature] = token.split(".")
  if (!payload || !signature) return null

  const expected = signPayload(payload, env.sessionSecret)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null
  }

  try {
    const claims = JSON.parse(base64UrlDecode(payload)) as SessionClaims
    return {
      token,
      claims,
      session: {
        version: 1,
        sessionToken: token,
        relayBaseURL: claims.relayBaseURL,
        email: claims.email,
        plan: "free",
        subscriptionStatus: "active",
        providerEntitlements: [],
        quota: {
          dailyRequestsLimit: 0,
          dailyCharactersLimit: 0,
          requestsPerMinuteLimit: 0,
          remainingDailyRequests: 0,
          remainingDailyCharacters: 0,
        },
        usage: {
          totalRequests: 0,
          totalCharacters: 0,
          dailyRequestsUsed: 0,
          dailyCharactersUsed: 0,
          lastRequestAt: null,
          recentEvents: [],
        },
        expiresAt: null,
      },
    }
  } catch {
    return null
  }
}

export function parseBearerToken(header: string | null): string | null {
  if (!header) return null
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}
