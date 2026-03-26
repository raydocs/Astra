import { createHash } from "node:crypto"

import { describe, expect, it } from "vitest"

import { issueSession, parseBearerToken, verifySessionToken } from "./auth"
import type { RelayEnv, ServerUserRecord } from "./types"

const env: RelayEnv = {
  port: 8787,
  host: "127.0.0.1",
  publicBaseURL: "http://127.0.0.1:8787/v1",
  sessionSecret: "test-secret",
  userDbPath: "/tmp/astra-users.json",
  loginEmail: "demo@astra.local",
  loginPassword: "astra-demo-pass",
  plan: "pro",
  subscriptionStatus: "active",
  providerEntitlements: ["openai", "gemini"],
  billingCheckoutBaseURL: "https://billing.example/checkout",
  billingPortalBaseURL: "https://billing.example/portal",
  openaiApiKey: "openai-key",
  googleApiKey: "google-key",
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
}

describe("relay auth", () => {
  it("issues and verifies signed session tokens", () => {
    const issued = issueSession(user, env)
    const verified = verifySessionToken(issued.token, env)

    expect(verified?.session.email).toBe(env.loginEmail)
    expect(issued.session.providerEntitlements).toEqual(["openai", "gemini"])
  })

  it("parses bearer auth headers", () => {
    expect(parseBearerToken("Bearer token-123")).toBe("token-123")
    expect(parseBearerToken(null)).toBeNull()
  })

  it("fails verification when the token is tampered with", () => {
    const issued = issueSession(user, env)
    expect(verifySessionToken(`${issued.token}tampered`, env)).toBeNull()
  })
})
