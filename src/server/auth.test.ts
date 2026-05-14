import { createHash } from "node:crypto"

import { describe, expect, it } from "vitest"

import { buildRelaySession, issueSession, parseBearerToken, verifySessionToken } from "./auth"
import { createAstraSessionTokenTestVector } from "../utils/astra/session-token"
import type { RelayEnv, ServerSessionRecord, ServerUserRecord } from "./types"

const env: RelayEnv = {
  port: 8787,
  host: "127.0.0.1",
  publicBaseURL: "http://127.0.0.1:8787/v1",
  sessionPublicBaseURL: "https://platform.astra.example/v1",
  sessionSecret: "test-secret",
  platformMirrorSecret: "mirror-secret",
  userDbPath: "/tmp/astra-users.json",
  videoNoteStorePath: "/tmp/astra-video-notes.json",
  loginEmail: "demo@astra.local",
  loginPassword: "astra-demo-pass",
  plan: "pro",
  subscriptionStatus: "active",
  providerEntitlements: ["openai", "gemini"],
  billingCheckoutBaseURL: "https://billing.example/checkout",
  billingPortalBaseURL: "https://billing.example/portal",
  openaiApiKey: "openai-key",
  googleApiKey: "google-key",
  openrouterApiKey: "",
  useOpenRouter: false,
  openrouterModelMap: {},
  freeDailyRequests: 200,
  freeDailyCharacters: 200_000,
  freeRpm: 20,
  proDailyRequests: 2000,
  proDailyCharacters: 500_000,
  proRpm: 120,
  sessionTtlMs: 30 * 24 * 60 * 60 * 1000,
  syncMaxMutationsPerRequest: 200,
  videoNoteMaxConcurrentJobs: 1,
}

const user: ServerUserRecord = {
  id: "usr_demo",
  email: env.loginEmail,
  billingEmail: env.loginEmail,
  createdAt: "2026-03-01T00:00:00.000Z",
  passwordHash: createHash("sha256").update(env.loginPassword).digest("hex"),
  plan: "pro",
  subscriptionStatus: "active",
  providerEntitlements: ["openai", "gemini"],
  limits: {
    dailyRequests: 2000,
    dailyCharacters: 500_000,
    requestsPerMinute: 120,
  },
  usage: {
    usageDay: "2026-03-25",
    requestsToday: 0,
    charactersToday: 0,
    totalRequests: 0,
    totalCharacters: 0,
    lastRequestAt: null,
    recentRequestTimestamps: [],
    recentEvents: [],
  },
  identityMode: "authenticated",
  syncPreferences: {
    reading_history: false,
    study_progress: false,
  },
}

const sessionRecord: ServerSessionRecord = {
  sessionId: "sess_demo",
  userId: user.id,
  email: user.email,
  deviceId: "device-123",
  identityMode: "authenticated",
  issuedAt: "2026-04-09T00:00:00.000Z",
  expiresAt: "2026-05-09T00:00:00.000Z",
  createdAt: "2026-04-09T00:00:00.000Z",
  lastSeenAt: "2026-04-09T00:00:00.000Z",
  lastVerifiedAt: "2026-04-09T00:00:00.000Z",
  status: "active",
  revokedAt: null,
}

describe("relay auth", () => {
  it("issues and verifies signed session tokens with device-bound claims", async () => {
    const issued = await issueSession(user, sessionRecord, env)
    const verified = await verifySessionToken(issued.token, env)

    expect(verified?.email).toBe(env.loginEmail)
    expect(verified?.sessionId).toBe("sess_demo")
    expect(verified?.deviceId).toBe("device-123")
    expect(verified?.relayBaseURL).toBe(env.sessionPublicBaseURL)
    expect(issued.session.providerEntitlements).toEqual(["openai", "gemini"])
  })

  it("builds a session snapshot with device/session metadata", () => {
    const session = buildRelaySession(user, "token-123", sessionRecord, env.sessionPublicBaseURL)

    expect(session.sessionId).toBe("sess_demo")
    expect(session.deviceId).toBe("device-123")
    expect(session.identityMode).toBe("authenticated")
    expect(session.expiresAt).toBe("2026-05-09T00:00:00.000Z")
    expect(session.relayBaseURL).toBe(env.sessionPublicBaseURL)
  })

  it("parses bearer auth headers", () => {
    expect(parseBearerToken("Bearer token-123")).toBe("token-123")
    expect(parseBearerToken(null)).toBeNull()
  })

  it("fails verification when the token is tampered with", async () => {
    const issued = await issueSession(user, sessionRecord, env)
    await expect(verifySessionToken(`${issued.token}tampered`, env)).resolves.toBeNull()
  })

  it("exposes a deterministic shared token test vector for Node/Worker parity", async () => {
    const issued = await issueSession(user, sessionRecord, env)
    const vector = await createAstraSessionTokenTestVector({
      secret: env.sessionSecret,
      claims: issued.claims,
    })

    expect(vector.token).toBe(issued.token)
    expect(vector.claims.relayBaseURL).toBe(env.sessionPublicBaseURL)
  })
})
