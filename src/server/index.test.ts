import { createHash, generateKeyPairSync, sign as signJwtSignature } from "node:crypto"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

function toFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function encodeJwtSegment(value: unknown): string {
  const raw = typeof value === "string" ? value : JSON.stringify(value)
  return Buffer.from(raw).toString("base64url")
}

function createTestOAuthJwt(params: {
  issuer: string
  audience: string
  subject: string
  email?: string
  emailVerified?: boolean | string
  nonce?: string
  expiresInSeconds?: number
}) {
  const keyId = "test-oauth-key"
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
  const publicJwk = publicKey.export({ format: "jwk" }) as Record<string, unknown>
  publicJwk.kid = keyId
  publicJwk.kty = "RSA"
  publicJwk.alg = "RS256"
  publicJwk.use = "sig"
  const nowSeconds = Math.floor(Date.now() / 1000)
  const header = encodeJwtSegment({ alg: "RS256", kid: keyId, typ: "JWT" })
  const payload = encodeJwtSegment({
    iss: params.issuer,
    aud: params.audience,
    sub: params.subject,
    exp: nowSeconds + (params.expiresInSeconds ?? 600),
    iat: nowSeconds,
    ...(params.email ? { email: params.email } : {}),
    ...(params.emailVerified !== undefined ? { email_verified: params.emailVerified } : {}),
    ...(params.nonce ? { nonce: params.nonce } : {}),
  })
  const input = `${header}.${payload}`
  const signature = signJwtSignature("RSA-SHA256", Buffer.from(input), privateKey).toString("base64url")
  return { token: `${input}.${signature}`, publicJwk }
}

function timedTextJson(events: Array<{ startMs: number; durationMs: number; text: string }>) {
  return JSON.stringify({
    events: events.map((event) => ({
      tStartMs: event.startMs,
      dDurationMs: event.durationMs,
      segs: [{ utf8: event.text }],
    })),
  })
}

function getUtcWeekStartDate(value: Date = new Date()): string {
  const day = value.getUTCDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const weekStart = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
  weekStart.setUTCDate(weekStart.getUTCDate() + mondayOffset)
  return weekStart.toISOString().slice(0, 10)
}

function buildYouTubeWatchHtml(options: {
  title?: string
  lengthSeconds?: number
  captionTracks?: Array<Record<string, unknown>>
  streamingFormats?: Array<Record<string, unknown>>
}) {
  return `<!doctype html><html><head><title>${options.title ?? "Demo video"} - YouTube</title></head><body><script>var ytInitialPlayerResponse = ${JSON.stringify({
    videoDetails: {
      title: options.title ?? "Demo video",
      lengthSeconds: String(options.lengthSeconds ?? 120),
    },
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: options.captionTracks ?? [],
      },
    },
    streamingData: {
      adaptiveFormats: options.streamingFormats ?? [],
    },
  })};</script></body></html>`
}

import { buildSupportBundle } from "../utils/support-bundle"
import { checkAnonymousRateLimit, createAstraRelayServer, resetAnonymousRateLimits } from "./index"
import type { RelayEnv } from "./types"

const { translateViaManagedProviderMock } = vi.hoisted(() => ({
  translateViaManagedProviderMock: vi.fn(),
}))

vi.mock("./providers", async () => {
  const actual = await vi.importActual<typeof import("./providers")>("./providers")
  return {
    ...actual,
    translateViaManagedProviderDetailed: translateViaManagedProviderMock,
  }
})

async function createUserDb(
  limits?: Partial<{ dailyRequests: number; dailyCharacters: number; requestsPerMinute: number }>,
  userOverrides: Record<string, unknown> = {},
) {
  const dir = await mkdtemp(join(tmpdir(), "astra-relay-"))
  const path = join(dir, "users.json")
  await writeFile(path, JSON.stringify({
    version: 1,
    users: [{
      id: "usr_demo",
      email: "demo@astra.local",
      billingEmail: "billing@astra.local",
      createdAt: "2026-03-01T00:00:00.000Z",
      passwordHash: createHash("sha256").update("astra-demo-pass").digest("hex"),
      plan: "pro",
      subscriptionStatus: "active",
      providerEntitlements: ["openai", "gemini"],
      limits: {
        dailyRequests: limits?.dailyRequests ?? 2000,
        dailyCharacters: limits?.dailyCharacters ?? 500_000,
        requestsPerMinute: limits?.requestsPerMinute ?? 120,
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
      ...userOverrides,
    }],
  }, null, 2))
  return path
}

async function readUserDb(path: string): Promise<{
  version: number
  users: Array<{ id: string; email: string; installId?: string; passwordHash?: string; syncPreferences?: { weekly_digest?: boolean } }>
  devices: Array<{ deviceId: string; userId: string; email: string; expoPushToken?: string | null; expoPushTokenUpdatedAt?: string | null }>
  sessions: Array<{ sessionId: string; deviceId: string; userId: string; email: string }>
  oauthIdentities: Array<{ provider: string; subject: string; userId: string; email: string | null; emailVerified: boolean }>
  syncMutations: Array<{ ownerId: string; email: string; clientMutationId: string }>
  weeklyDigests: Array<{ ownerId: string; email: string; digestId: string }>
  mobileRetentionEvents: Array<{ ownerId: string; email: string; deviceId: string; eventId: string; name: string; clientTimestamp: number; metadata: Record<string, unknown> }>
}> {
  return JSON.parse(await readFile(path, "utf8")) as {
    version: number
    users: Array<{ id: string; email: string; installId?: string; passwordHash?: string; syncPreferences?: { weekly_digest?: boolean } }>
    devices: Array<{ deviceId: string; userId: string; email: string; expoPushToken?: string | null; expoPushTokenUpdatedAt?: string | null }>
    sessions: Array<{ sessionId: string; deviceId: string; userId: string; email: string }>
    oauthIdentities: Array<{ provider: string; subject: string; userId: string; email: string | null; emailVerified: boolean }>
    syncMutations: Array<{ ownerId: string; email: string; clientMutationId: string }>
    weeklyDigests: Array<{ ownerId: string; email: string; digestId: string }>
    mobileRetentionEvents: Array<{ ownerId: string; email: string; deviceId: string; eventId: string; name: string; clientTimestamp: number; metadata: Record<string, unknown> }>
  }
}

describe("Astra relay server", () => {
  let server: ReturnType<typeof createAstraRelayServer>
  let baseURL = ""
  let env: RelayEnv

  async function closeServer() {
    if (!server) return
    const currentServer = server
    server = undefined as unknown as ReturnType<typeof createAstraRelayServer>
    await new Promise<void>((resolve, reject) => {
      currentServer.close((error) => {
        if (error) reject(error)
        else resolve()
      })
    })
  }

  async function startServer(userDbPath: string, overrides: Partial<RelayEnv> = {}) {
    env = {
      port: 8787,
      host: "127.0.0.1",
      publicBaseURL: "http://127.0.0.1:8787/v1",
      sessionPublicBaseURL: "https://platform.astra.example/v1",
      sessionSecret: "test-secret",
      platformMirrorSecret: "mirror-secret",
      userDbPath,
      videoNoteStorePath: join(dirname(userDbPath), "video-notes.json"),
      longRunningTaskStorePath: join(dirname(userDbPath), "long-tasks.json"),
      supportReportInboxPath: join(dirname(userDbPath), "support-reports.json"),
      supportKnownIssueStorePath: join(dirname(userDbPath), "support-known-issues.json"),
      featureFlagRuntimePath: join(dirname(userDbPath), "feature-flags.json"),
      opsAuditLogPath: join(dirname(userDbPath), "ops-audit-log.json"),
      cancellationReasonStorePath: join(dirname(userDbPath), "cancellation-reasons.json"),
      analyticsEventStorePath: join(dirname(userDbPath), "analytics-events.json"),
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
      trialDailyRequests: 2000,
      trialDailyCharacters: 500_000,
      trialRpm: 120,
      proDailyRequests: 2000,
      proDailyCharacters: 500_000,
      proRpm: 120,
      sessionTtlMs: 30 * 24 * 60 * 60 * 1000,
      syncMaxMutationsPerRequest: 200,
      videoNoteMaxConcurrentJobs: 1,
      emailSignInCodeDevelopmentEcho: true,
      ...overrides,
      operatorPrincipals: overrides.operatorPrincipals ?? [],
      oauthIdentityDevelopmentRedeem: overrides.oauthIdentityDevelopmentRedeem ?? false,
    }

    server = createAstraRelayServer(env)

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve())
    })

    const address = server.address()
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind relay test server.")
    }
    baseURL = `http://127.0.0.1:${address.port}`
  }

  async function writeFeatureFlagRuntime(killSwitches: Array<Record<string, unknown>>) {
    await writeFile(env.featureFlagRuntimePath, JSON.stringify({
      schema: "astra-feature-flag-runtime.v1",
      generatedAt: "2026-05-28T00:00:00.000Z",
      overrides: [],
      killSwitches,
      changeLog: [],
    }, null, 2))
  }

  async function createSession(deviceId = "device-main") {
    const authResponse = await fetch(`${baseURL}/v1/auth/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Astra-Device-Id": deviceId,
      },
      body: JSON.stringify({
        email: env.loginEmail,
        password: env.loginPassword,
        deviceId,
        device: {
          label: `Device ${deviceId}`,
          browserFamily: "chrome",
          platform: "macos",
          appKind: "extension",
          appVersion: "1.0.0",
        },
      }),
    })

    const session = await authResponse.json() as {
      sessionToken: string
      sessionId: string
      deviceId: string
      email: string
      identityMode: string
      relayBaseURL: string
      quota: { dailyRequestsLimit: number }
    }

    return { response: authResponse, session, deviceId }
  }

  function authHeaders(token: string, deviceId: string) {
    return {
      Authorization: `Bearer ${token}`,
      "X-Astra-Device-Id": deviceId,
    }
  }

  async function waitForVideoNoteJob(
    jobId: string,
    token: string,
    deviceId: string,
    predicate: (job: {
      status: string
      transcriptSource?: string | null
      error: { code: string; message: string } | null
    }) => boolean,
    timeoutMessage: string,
  ) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const response = await fetch(`${baseURL}/v1/video-notes/jobs/${jobId}`, {
        headers: authHeaders(token, deviceId),
      })
      expect(response.status).toBe(200)
      const payload = await response.json() as {
        job: {
          status: string
          transcriptSource?: string | null
          error: { code: string; message: string } | null
        }
      }
      if (predicate(payload.job)) {
        return payload.job
      }
      await new Promise((resolve) => setTimeout(resolve, 20))
    }

    throw new Error(timeoutMessage)
  }

  async function waitForVideoNoteTerminalStatus(jobId: string, token: string, deviceId: string) {
    return waitForVideoNoteJob(
      jobId,
      token,
      deviceId,
      (job) => job.status === "completed" || job.status === "failed",
      `Video-note job ${jobId} did not reach a terminal status in time.`,
    )
  }

  beforeEach(() => {
    translateViaManagedProviderMock.mockReset()
    resetAnonymousRateLimits()
  })

  afterEach(async () => {
    await closeServer()
  })

  it("creates a device-bound session from valid credentials and returns quota metadata", async () => {
    await startServer(await createUserDb())

    const { response, session } = await createSession("device-login")
    expect(response.status).toBe(200)
    expect(session.email).toBe(env.loginEmail)
    expect(session.sessionToken.length).toBeGreaterThan(10)
    expect(session.sessionId.length).toBeGreaterThan(10)
    expect(session.deviceId).toBe("device-login")
    expect(session.identityMode).toBe("authenticated")
    expect(session.relayBaseURL).toBe(env.sessionPublicBaseURL)
    expect(session.quota.dailyRequestsLimit).toBe(2000)
  })

  it("rejects OAuth identity redeem when development redeem is disabled", async () => {
    await startServer(await createUserDb())

    const response = await fetch(`${baseURL}/v1/auth/oauth/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Astra-Device-Id": "device-oauth-disabled" },
      body: JSON.stringify({
        provider: "google",
        subject: "google-user-123",
        email: "oauth-user@example.com",
        emailVerified: true,
        verified: true,
        deviceId: "device-oauth-disabled",
      }),
    })
    const payload = await response.json() as { error: { code: string } }
    expect(response.status).toBe(503)
    expect(payload.error.code).toBe("CONFIG_MISSING")
  })

  it("rejects development OAuth identity redeem on production Astra hosts", async () => {
    await startServer(await createUserDb(), {
      oauthIdentityDevelopmentRedeem: true,
      publicBaseURL: "https://relay.astra.app/v1",
      sessionPublicBaseURL: "https://platform.astra.app/v1",
    })

    const response = await fetch(`${baseURL}/v1/auth/oauth/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Astra-Device-Id": "device-oauth-prod" },
      body: JSON.stringify({
        provider: "google",
        subject: "google-user-123",
        email: "oauth-user@example.com",
        emailVerified: true,
        verified: true,
        deviceId: "device-oauth-prod",
      }),
    })
    const payload = await response.json() as { error: { code: string } }
    expect(response.status).toBe(503)
    expect(payload.error.code).toBe("CONFIG_MISSING")
  })

  it("redeems a verified Google OAuth ID token without enabling development identity redeem", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath, { oauthGoogleClientIds: ["google-mobile-client"] })
    const { token, publicJwk } = createTestOAuthJwt({
      issuer: "https://accounts.google.com",
      audience: "google-mobile-client",
      subject: "google-prod-user-123",
      email: "OAuth-Prod@Example.com",
      emailVerified: true,
      nonce: "nonce-1",
    })
    const realFetch = globalThis.fetch
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = toFetchUrl(input)
      if (url === "https://www.googleapis.com/oauth2/v3/certs") {
        return new Response(JSON.stringify({ keys: [publicJwk] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      return realFetch(input, init)
    })

    try {
      const response = await fetch(`${baseURL}/v1/auth/oauth/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Astra-Device-Id": "device-oauth-token" },
        body: JSON.stringify({
          provider: "google",
          idToken: token,
          nonce: "nonce-1",
          deviceId: "device-oauth-token",
          device: { label: "OAuth token phone", platform: "android", appKind: "mobile" },
        }),
      })
      expect(response.status).toBe(200)
      const session = await response.json() as { sessionToken: string; email: string; deviceId: string }
      expect(session.sessionToken).toBeTruthy()
      expect(session.email).toBe("oauth-prod@example.com")
      expect(session.deviceId).toBe("device-oauth-token")

      const db = await readUserDb(userDbPath)
      const oauthUser = db.users.find((record) => record.email === "oauth-prod@example.com")
      expect(oauthUser).toBeTruthy()
      expect(db.oauthIdentities).toEqual([expect.objectContaining({
        provider: "google",
        subject: "google-prod-user-123",
        userId: oauthUser?.id,
        email: "oauth-prod@example.com",
        emailVerified: true,
      })])
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it("rejects OAuth ID-token redeem without a request nonce", async () => {
    await startServer(await createUserDb(), { oauthGoogleClientIds: ["google-mobile-client"] })
    const { token, publicJwk } = createTestOAuthJwt({
      issuer: "https://accounts.google.com",
      audience: "google-mobile-client",
      subject: "google-prod-user-123",
      email: "oauth-prod@example.com",
      emailVerified: true,
      nonce: "nonce-required",
    })
    const realFetch = globalThis.fetch
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = toFetchUrl(input)
      if (url === "https://www.googleapis.com/oauth2/v3/certs") {
        return new Response(JSON.stringify({ keys: [publicJwk] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      return realFetch(input, init)
    })

    try {
      const response = await fetch(`${baseURL}/v1/auth/oauth/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Astra-Device-Id": "device-oauth-missing-nonce" },
        body: JSON.stringify({
          provider: "google",
          idToken: token,
          deviceId: "device-oauth-missing-nonce",
        }),
      })
      const payload = await response.json() as { error: { code: string } }
      expect(response.status).toBe(400)
      expect(payload.error.code).toBe("INVALID_REQUEST")
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it("rejects OAuth ID tokens with an unconfigured audience", async () => {
    await startServer(await createUserDb(), { oauthGoogleClientIds: ["google-mobile-client"] })
    const { token, publicJwk } = createTestOAuthJwt({
      issuer: "https://accounts.google.com",
      audience: "attacker-client",
      subject: "google-prod-user-123",
      email: "oauth-prod@example.com",
      emailVerified: true,
      nonce: "nonce-1",
    })
    const realFetch = globalThis.fetch
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = toFetchUrl(input)
      if (url === "https://www.googleapis.com/oauth2/v3/certs") {
        return new Response(JSON.stringify({ keys: [publicJwk] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      return realFetch(input, init)
    })

    try {
      const response = await fetch(`${baseURL}/v1/auth/oauth/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Astra-Device-Id": "device-oauth-bad-aud" },
        body: JSON.stringify({
          provider: "google",
          idToken: token,
          nonce: "nonce-1",
          deviceId: "device-oauth-bad-aud",
        }),
      })
      const payload = await response.json() as { error: { code: string } }
      expect(response.status).toBe(401)
      expect(payload.error.code).toBe("AUTH_REQUIRED")
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it("does not link development OAuth redeem to an existing user by caller-provided email", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath, { oauthIdentityDevelopmentRedeem: true })

    const response = await fetch(`${baseURL}/v1/auth/oauth/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Astra-Device-Id": "device-oauth-email-collision" },
      body: JSON.stringify({
        provider: "google",
        subject: "google-user-existing-email",
        email: env.loginEmail,
        emailVerified: true,
        verified: true,
        deviceId: "device-oauth-email-collision",
      }),
    })
    expect(response.status).toBe(200)
    const session = await response.json() as { email: string; sessionToken: string }
    expect(session.sessionToken).toBeTruthy()
    expect(session.email).not.toBe(env.loginEmail)
    expect(session.email).toMatch(/^oauth_google_[a-f0-9]{16}@astra\.oauth$/)

    const db = await readUserDb(userDbPath)
    const loginUser = db.users.find((record) => record.email === env.loginEmail)
    const oauthUser = db.users.find((record) => record.email === session.email)
    expect(loginUser).toBeTruthy()
    expect(oauthUser).toBeTruthy()
    expect(oauthUser?.id).not.toBe(loginUser?.id)
    expect(db.oauthIdentities).toEqual([expect.objectContaining({
      provider: "google",
      subject: "google-user-existing-email",
      userId: oauthUser?.id,
      email: env.loginEmail,
      emailVerified: true,
    })])
  })

  it("redeems verified OAuth identity into a device-bound session and reuses provider subject binding", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath, { oauthIdentityDevelopmentRedeem: true })

    const firstResponse = await fetch(`${baseURL}/v1/auth/oauth/redeem`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Astra-Device-Id": "device-oauth-1",
      },
      body: JSON.stringify({
        provider: "apple",
        subject: "apple-user-123",
        email: "oauth-user@example.com",
        emailVerified: true,
        verified: true,
        deviceId: "device-oauth-1",
        device: { label: "OAuth phone", platform: "ios", appKind: "mobile" },
      }),
    })
    expect(firstResponse.status).toBe(200)
    const first = await firstResponse.json() as { sessionToken: string; email: string; identityMode: string; deviceId: string }
    expect(first.sessionToken).toBeTruthy()
    expect(first.email).toBe("oauth-user@example.com")
    expect(first.identityMode).toBe("authenticated")
    expect(first.deviceId).toBe("device-oauth-1")

    const secondResponse = await fetch(`${baseURL}/v1/auth/oauth/redeem`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Astra-Device-Id": "device-oauth-2",
      },
      body: JSON.stringify({
        provider: "apple",
        subject: "apple-user-123",
        email: "changed@example.com",
        emailVerified: true,
        verified: true,
        deviceId: "device-oauth-2",
        device: { label: "OAuth phone 2", platform: "ios", appKind: "mobile" },
      }),
    })
    expect(secondResponse.status).toBe(200)
    const second = await secondResponse.json() as { sessionToken: string; email: string; deviceId: string }
    expect(second.sessionToken).toBeTruthy()
    expect(second.email).toBe("oauth-user@example.com")
    expect(second.deviceId).toBe("device-oauth-2")

    const db = await readUserDb(userDbPath)
    const user = db.users.find((record) => record.email === "oauth-user@example.com")
    expect(user?.passwordHash).toBeTruthy()
    expect(db.users.filter((record) => record.email === "oauth-user@example.com" || record.email === "changed@example.com")).toHaveLength(1)
    expect(db.oauthIdentities).toEqual([expect.objectContaining({
      provider: "apple",
      subject: "apple-user-123",
      userId: user?.id,
      email: "changed@example.com",
      emailVerified: true,
    })])
    expect(db.sessions.filter((session) => session.userId === user?.id)).toHaveLength(2)
  })

  it("accepts and stores sanitized mobile retention uploads for authenticated mobile sessions", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath)
    const { session, deviceId } = await createSession("device-mobile-retention")

    const response = await fetch(`${baseURL}/v1/account/mobile-retention-events`, {
      method: "POST",
      headers: {
        ...authHeaders(session.sessionToken, deviceId),
        "Content-Type": "application/json",
        "Idempotency-Key": "retention-upload-1",
      },
      body: JSON.stringify({
        schema: "astra-mobile-retention-events.v1",
        events: [{
          id: "event-1",
          name: "review_rated",
          timestamp: Date.now(),
          metadata: {
            rating: "good",
            sourceType: "page",
            dueCount: 3,
            text: "card text",
            sourceUrl: "https://example.com/private",
            email: "learner@example.com",
            token: "secret-token",
            reason: "secret-token",
          },
        }],
      }),
    })

    expect(response.status).toBe(200)
    const payload = await response.json() as { acceptedCount: number; serverTime: string }
    expect(payload.acceptedCount).toBe(1)
    expect(Date.parse(payload.serverTime)).toBeGreaterThan(0)

    const db = await readUserDb(userDbPath)
    expect(db.mobileRetentionEvents).toHaveLength(1)
    expect(db.mobileRetentionEvents[0]).toMatchObject({
      deviceId,
      eventId: "event-1",
      name: "review_rated",
      metadata: { rating: "good", sourceType: "page", dueCount: 3 },
    })
    expect(JSON.stringify(db.mobileRetentionEvents[0])).not.toContain("card text")
    expect(JSON.stringify(db.mobileRetentionEvents[0])).not.toContain("https://example.com")
    expect(JSON.stringify(db.mobileRetentionEvents[0])).not.toContain("learner@example.com")
    expect(JSON.stringify(db.mobileRetentionEvents[0])).not.toContain("secret-token")
  })

  it("returns operator-gated aggregate-only mobile retention summaries", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath)
    const { session, deviceId } = await createSession("device-mobile-retention-summary")

    const uploadResponse = await fetch(`${baseURL}/v1/account/mobile-retention-events`, {
      method: "POST",
      headers: { ...authHeaders(session.sessionToken, deviceId), "Content-Type": "application/json" },
      body: JSON.stringify({
        schema: "astra-mobile-retention-events.v1",
        events: [
          { id: "summary-event-1", name: "app_opened", timestamp: Date.parse("2026-05-26T12:00:00.000Z"), metadata: { surface: "mobile" } },
          { id: "summary-event-2", name: "review_rated", timestamp: Date.parse("2026-05-27T12:00:00.000Z"), metadata: { rating: "good", sourceType: "page", dueCount: 2, text: "hidden card text" } },
          { id: "summary-event-3", name: "sync_failed", timestamp: Date.parse("2026-05-28T12:00:00.000Z"), metadata: { status: "failed", reason: "offline" } },
        ],
      }),
    })
    expect(uploadResponse.status).toBe(200)

    const unauthorizedResponse = await fetch(`${baseURL}/v1/ops/mobile-retention/summary`)
    expect(unauthorizedResponse.status).toBe(401)

    const response = await fetch(`${baseURL}/v1/ops/mobile-retention/summary?grain=week`, {
      headers: { "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
    })
    expect(response.status).toBe(200)
    const payload = await response.json() as {
      schema: string
      source: string
      retainedEventsPerUserLimit: number
      grain: string
      totalEvents: number
      buckets: Array<{ bucket: string; eventName: string; count: number }>
      byEventName: Array<{ eventName: string; count: number }>
      privacy: { metadataOnly: boolean; aggregateOnly: boolean; perUserRows: boolean; rawContentIncluded: boolean; identifiersIncluded: boolean }
    }

    expect(payload).toMatchObject({
      schema: "astra-mobile-retention-summary.v1",
      source: "metadata_only_mobile_retention_events",
      retainedEventsPerUserLimit: 500,
      grain: "week",
      totalEvents: 3,
      privacy: { metadataOnly: true, aggregateOnly: true, perUserRows: false, rawContentIncluded: false, identifiersIncluded: false },
    })
    expect(payload.buckets).toEqual(expect.arrayContaining([
      { bucket: "2026-05-25", eventName: "app_opened", count: 1 },
      { bucket: "2026-05-25", eventName: "review_rated", count: 1 },
      { bucket: "2026-05-25", eventName: "sync_failed", count: 1 },
    ]))
    expect(payload.byEventName).toEqual(expect.arrayContaining([
      { eventName: "app_opened", count: 1 },
      { eventName: "review_rated", count: 1 },
      { eventName: "sync_failed", count: 1 },
    ]))

    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain("demo@astra.local")
    expect(serialized).not.toContain(deviceId)
    expect(serialized).not.toContain("summary-event")
    expect(serialized).not.toContain("hidden card text")
    expect(serialized).not.toContain("offline")

    const auditResponse = await fetch(`${baseURL}/v1/ops/audit/summary`, {
      headers: { "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
    })
    expect(auditResponse.status).toBe(200)
    const auditPayload = await auditResponse.json() as { recent: Array<{ action: string; outcome: string; privacy: { contentIncluded: boolean; contentAccess: string } }> }
    expect(auditPayload.recent).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: "ops_mobile_retention_summary_viewed",
        outcome: "success",
        privacy: { contentIncluded: false, contentAccess: "metadata_only", userConsent: null },
      }),
    ]))
  })

  it("ingests and lists privacy-safe analytics events for the current account", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath)
    const { session, deviceId } = await createSession("device-analytics")

    const response = await fetch(`${baseURL}/v1/account/analytics-events`, {
      method: "POST",
      headers: { ...authHeaders(session.sessionToken, deviceId), "Content-Type": "application/json" },
      body: JSON.stringify({
        schema: "astra-analytics-events-ingest.v1",
        events: [{
          eventId: "analytics-1",
          name: "first_translation_completed",
          category: "activation",
          timestamp: "2026-05-28T10:00:00.000Z",
          properties: {
            plan: "pro",
            tier: "pro",
            cohort: "launch-week-1",
            sourceType: "extension",
            taskClass: "instant_phrase",
            outcome: "success",
            flags: { sample: true },
            ignoredSafeExtra: "stripped",
          },
          ignoredTopLevel: "stripped",
        }],
      }),
    })

    expect(response.status).toBe(200)
    const payload = await response.json() as {
      acceptedCount: number
      events: Array<{ name: string; category: string; properties: Record<string, unknown>; ownerUserId?: string; ownerEmailHash?: string }>
      privacy: { metadataOnly: boolean; rawContentIncluded: boolean; identifiersIncluded: boolean }
    }
    expect(payload.acceptedCount).toBe(1)
    expect(payload.events[0]).toMatchObject({
      name: "first_translation_completed",
      category: "activation",
      properties: {
        plan: "pro",
        tier: "pro",
        cohort: "launch-week-1",
        sourceType: "extension",
        taskClass: "instant_phrase",
        outcome: "success",
        flags: { sample: true },
      },
    })
    expect(payload.events[0]?.properties).not.toHaveProperty("ignoredSafeExtra")
    expect(payload.events[0]).not.toHaveProperty("ownerUserId")
    expect(payload.events[0]).not.toHaveProperty("ownerEmailHash")
    expect(payload.privacy).toEqual({ metadataOnly: true, rawContentIncluded: false, identifiersIncluded: false })

    const listResponse = await fetch(`${baseURL}/v1/account/analytics-events`, {
      headers: authHeaders(session.sessionToken, deviceId),
    })
    expect(listResponse.status).toBe(200)
    const listPayload = await listResponse.json() as { events: Array<{ eventId: string; name: string }> }
    expect(listPayload.events).toEqual([expect.objectContaining({ eventId: "analytics-1", name: "first_translation_completed" })])
  })

  it("rejects content-shaped analytics event fields before storing", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-analytics-unsafe")

    const response = await fetch(`${baseURL}/v1/account/analytics-events`, {
      method: "POST",
      headers: { ...authHeaders(session.sessionToken, deviceId), "Content-Type": "application/json" },
      body: JSON.stringify({
        schema: "astra-analytics-events-ingest.v1",
        events: [{
          name: "translation_completed",
          properties: {
            plan: "pro",
            sourceType: "extension",
            rawUrl: "https://private.example/page",
          },
        }],
      }),
    })

    expect(response.status).toBe(400)
  })

  it("returns operator-gated metadata-only analytics cohort summaries", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath)
    const { session, deviceId } = await createSession("device-analytics-cohort")

    const ingestResponse = await fetch(`${baseURL}/v1/account/analytics-events`, {
      method: "POST",
      headers: { ...authHeaders(session.sessionToken, deviceId), "Content-Type": "application/json" },
      body: JSON.stringify({
        schema: "astra-analytics-events-ingest.v1",
        events: [
          { name: "onboarding_completed", timestamp: "2026-05-28T12:00:00.000Z", properties: { plan: "pro", cohort: "launch", sourceType: "extension", outcome: "success" } },
          { name: "review_completed", timestamp: "2026-05-29T12:00:00.000Z", properties: { plan: "pro", cohort: "launch", sourceType: "mobile", outcome: "success" } },
          { name: "support_report_created", timestamp: "2026-05-29T13:00:00.000Z", properties: { plan: "pro", cohort: "launch", sourceType: "extension", outcome: "success" } },
        ],
      }),
    })
    expect(ingestResponse.status).toBe(200)

    const unauthorizedResponse = await fetch(`${baseURL}/v1/ops/analytics/cohort-summary`)
    expect(unauthorizedResponse.status).toBe(401)

    const response = await fetch(`${baseURL}/v1/ops/analytics/cohort-summary?grain=week`, {
      headers: { "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
    })
    expect(response.status).toBe(200)
    const payload = await response.json() as {
      schema: string
      grain: string
      totalEvents: number
      buckets: Array<{ bucket: string; category: string; eventName: string; plan: string; cohort: string; count: number; ownerUserId?: string }>
      byCategory: Array<{ category: string; count: number }>
      privacy: { metadataOnly: boolean; perUserRows: boolean; rawContentIncluded: boolean; identifiersIncluded: boolean }
    }
    expect(payload).toMatchObject({
      schema: "astra-analytics-cohort-summary.v1",
      grain: "week",
      totalEvents: 3,
      privacy: { metadataOnly: true, perUserRows: false, rawContentIncluded: false, identifiersIncluded: false },
    })
    expect(payload.buckets).toEqual(expect.arrayContaining([
      expect.objectContaining({ bucket: "2026-05-25", category: "activation", eventName: "onboarding_completed", plan: "pro", cohort: "launch", count: 1 }),
      expect.objectContaining({ bucket: "2026-05-25", category: "learning", eventName: "review_completed", plan: "pro", cohort: "launch", count: 1 }),
      expect.objectContaining({ bucket: "2026-05-25", category: "support", eventName: "support_report_created", plan: "pro", cohort: "launch", count: 1 }),
    ]))
    expect(payload.byCategory).toEqual(expect.arrayContaining([
      { category: "activation", count: 1 },
      { category: "learning", count: 1 },
      { category: "support", count: 1 },
    ]))
    expect(JSON.stringify(payload)).not.toContain("demo@astra.local")
    expect(JSON.stringify(payload)).not.toContain(deviceId)
  })

  it("rejects unsafe mobile retention upload shape and out-of-bounds timestamps", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-mobile-retention-invalid")

    const invalidName = await fetch(`${baseURL}/v1/account/mobile-retention-events`, {
      method: "POST",
      headers: { ...authHeaders(session.sessionToken, deviceId), "Content-Type": "application/json" },
      body: JSON.stringify({
        schema: "astra-mobile-retention-events.v1",
        events: [{ id: "event-bad", name: "card_text_uploaded", timestamp: Date.now(), metadata: {} }],
      }),
    })
    expect(invalidName.status).toBe(400)

    const oldTimestamp = await fetch(`${baseURL}/v1/account/mobile-retention-events`, {
      method: "POST",
      headers: { ...authHeaders(session.sessionToken, deviceId), "Content-Type": "application/json" },
      body: JSON.stringify({
        schema: "astra-mobile-retention-events.v1",
        events: [{ id: "event-old", name: "app_opened", timestamp: 0, metadata: { surface: "mobile" } }],
      }),
    })
    expect(oldTimestamp.status).toBe(400)
  })

  it("bounds mobile retention uploads per user", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath)
    const { session, deviceId } = await createSession("device-mobile-retention-bounded")

    for (let batch = 0; batch < 11; batch += 1) {
      const response = await fetch(`${baseURL}/v1/account/mobile-retention-events`, {
        method: "POST",
        headers: { ...authHeaders(session.sessionToken, deviceId), "Content-Type": "application/json" },
        body: JSON.stringify({
          schema: "astra-mobile-retention-events.v1",
          events: Array.from({ length: 50 }, (_, index) => ({
            id: `event-${batch}-${index}`,
            name: "sync_attempted",
            timestamp: Date.now() - (batch * 50 + index),
            metadata: { pendingCount: index },
          })),
        }),
      })
      expect(response.status).toBe(200)
    }

    const db = await readUserDb(userDbPath)
    expect(db.mobileRetentionEvents).toHaveLength(500)
  })

  it("deletes an authenticated account foundation and invalidates existing sessions", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath)
    const primary = await createSession("device-account-delete")
    const secondary = await createSession("device-account-delete-secondary")

    const push = await fetch(`${baseURL}/v1/sync/push`, {
      method: "POST",
      headers: {
        ...authHeaders(primary.session.sessionToken, primary.deviceId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mutations: [{
          collection: "config",
          schemaVersion: 1,
          recordId: "global",
          operation: "upsert",
          clientMutationId: "mut-account-delete-1",
          deviceId: primary.deviceId,
          clientUpdatedAt: "2026-05-27T12:00:00.000Z",
          payload: {
            kind: "global",
            config: {
              version: 1,
              targetLang: "zh-CN",
              connectionMode: "astra",
              hoverTrigger: "alt",
              contentScope: "page",
              inputTranslation: "enabled",
              inputTranslationMode: "replace",
              languageLevel: "intermediate",
              privacyMode: false,
              provider: { id: "openai", model: "gpt-5.4-nano" },
              tts: { enabled: true, engine: "browser", rate: 0.9, pitch: 1, highlightSentences: true },
              presentation: { mode: "bilingual", theme: "default", fontSize: 0.92, translationColor: "#64748b" },
            },
          },
        }],
      }),
    })
    expect(push.status).toBe(200)

    const archivedDigest = await fetch(`${baseURL}/v1/account/weekly-digest?now=${encodeURIComponent("2026-05-29T12:00:00.000Z")}`, {
      headers: authHeaders(primary.session.sessionToken, primary.deviceId),
    })
    expect(archivedDigest.status).toBe(200)

    const retentionUpload = await fetch(`${baseURL}/v1/account/mobile-retention-events`, {
      method: "POST",
      headers: { ...authHeaders(primary.session.sessionToken, primary.deviceId), "Content-Type": "application/json" },
      body: JSON.stringify({
        schema: "astra-mobile-retention-events.v1",
        events: [{ id: "delete-retention-1", name: "app_opened", timestamp: Date.now(), metadata: { surface: "mobile" } }],
      }),
    })
    expect(retentionUpload.status).toBe(200)

    const deleted = await fetch(`${baseURL}/v1/account`, {
      method: "DELETE",
      headers: authHeaders(primary.session.sessionToken, primary.deviceId),
    })
    expect(deleted.status).toBe(204)

    const primaryRefresh = await fetch(`${baseURL}/v1/auth/session`, {
      headers: authHeaders(primary.session.sessionToken, primary.deviceId),
    })
    expect(primaryRefresh.status).toBe(401)
    const secondaryRefresh = await fetch(`${baseURL}/v1/auth/session`, {
      headers: authHeaders(secondary.session.sessionToken, secondary.deviceId),
    })
    expect(secondaryRefresh.status).toBe(401)

    const db = await readUserDb(userDbPath)
    expect(db.users.some((user) => user.email === env.loginEmail)).toBe(false)
    expect(db.devices.some((device) => device.email === env.loginEmail || device.userId === "usr_demo")).toBe(false)
    expect(db.sessions.some((session) => session.email === env.loginEmail || session.userId === "usr_demo")).toBe(false)
    expect(db.syncMutations.some((mutation) => mutation.email === env.loginEmail || mutation.ownerId === "usr_demo")).toBe(false)
    expect(db.weeklyDigests.some((digest) => digest.email === env.loginEmail || digest.ownerId === "usr_demo")).toBe(false)
    expect(db.mobileRetentionEvents.some((event) => event.email === env.loginEmail || event.ownerId === "usr_demo")).toBe(false)
  })

  it("rejects account deletion without a valid session", async () => {
    await startServer(await createUserDb())

    const deleted = await fetch(`${baseURL}/v1/account`, { method: "DELETE" })
    expect(deleted.status).toBe(401)
  })

  it("returns metadata-only cloud learning-memory inventory and deletion receipt", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath)
    const { session, deviceId } = await createSession("device-cloud-memory")

    const push = await fetch(`${baseURL}/v1/sync/push`, {
      method: "POST",
      headers: { ...authHeaders(session.sessionToken, deviceId), "Content-Type": "application/json" },
      body: JSON.stringify({
        mutations: [
          {
            collection: "vocabulary",
            schemaVersion: 1,
            recordId: "vocab-private",
            operation: "upsert",
            clientMutationId: "mut-cloud-memory-vocab",
            deviceId,
            clientUpdatedAt: "2026-05-27T12:00:00.000Z",
            payload: {
              id: "vocab-private",
              text: "Private saved sentence should not appear",
              translation: "不应出现",
              savedAt: Date.UTC(2026, 4, 27, 9, 0, 0),
              sourceContext: { surface: "hover_translate", pageUrl: "https://private.example/path?token=secret", hostname: "private.example" },
            },
          },
          {
            collection: "review_schedule",
            schemaVersion: 1,
            recordId: "vocab-private",
            operation: "upsert",
            clientMutationId: "mut-cloud-memory-review",
            deviceId,
            clientUpdatedAt: "2026-05-27T13:00:00.000Z",
            payload: {
              vocabularyEntryId: "vocab-private",
              srsBox: 2,
              nextReviewAt: Date.UTC(2026, 4, 30, 9, 0, 0),
              reviewCount: 1,
              lastReviewedAt: Date.UTC(2026, 4, 27, 13, 0, 0),
              lastReviewGrade: "good",
              lastReviewGradeAt: Date.UTC(2026, 4, 27, 13, 0, 0),
              updatedAt: Date.UTC(2026, 4, 27, 13, 0, 0),
            },
          },
        ],
      }),
    })
    const pushPayload = await push.json() as { rejected: unknown[] }
    expect(push.status).toBe(200)
    expect(pushPayload.rejected).toEqual([])

    const archivedDigest = await fetch(`${baseURL}/v1/account/weekly-digest?now=${encodeURIComponent("2026-05-29T12:00:00.000Z")}`, {
      headers: authHeaders(session.sessionToken, deviceId),
    })
    expect(archivedDigest.status).toBe(200)

    const inventory = await fetch(`${baseURL}/v1/account/learning-memory/inventory`, {
      headers: authHeaders(session.sessionToken, deviceId),
    })
    const inventoryPayload = await inventory.json() as {
      schema: string
      collections: Array<{ collection: string; mutationCount: number; activeCount: number; cursor: string | null }>
      privacy: { metadataOnly: boolean; rawContentIncluded: boolean; rawUrlsIncluded: boolean; emailsIncluded: boolean; syncPayloadBodiesIncluded: boolean }
    }
    expect(inventory.status).toBe(200)
    expect(inventoryPayload.schema).toBe("astra-cloud-learning-memory-inventory.v1")
    expect(inventoryPayload.collections.find((collection) => collection.collection === "vocabulary")).toMatchObject({ mutationCount: 1, activeCount: 1, cursor: "1" })
    expect(inventoryPayload.collections.find((collection) => collection.collection === "review_schedule")).toMatchObject({ mutationCount: 1, activeCount: 1, cursor: "2" })
    expect(inventoryPayload.collections.find((collection) => collection.collection === "weekly_digest_archive")).toMatchObject({ mutationCount: 1, activeCount: 1, cursor: null })
    expect(inventoryPayload.privacy).toMatchObject({ metadataOnly: true, rawContentIncluded: false, rawUrlsIncluded: false, emailsIncluded: false, syncPayloadBodiesIncluded: false })
    const inventoryJson = JSON.stringify(inventoryPayload)
    expect(inventoryJson).not.toContain("Private saved sentence")
    expect(inventoryJson).not.toContain("private.example")
    expect(inventoryJson).not.toContain(env.loginEmail)
    expect(inventoryJson).not.toContain(deviceId)

    const deleted = await fetch(`${baseURL}/v1/account/learning-memory`, {
      method: "DELETE",
      headers: authHeaders(session.sessionToken, deviceId),
    })
    const receipt = await deleted.json() as {
      schema: string
      collections: Array<{ collection: string; clearedMutationCount: number; clearedActiveCount: number; previousCursor: string | null }>
      totals: { clearedMutationCount: number; clearedActiveCount: number }
      boundary: { metadataOnly: boolean; cloudServerSideOnly: boolean; externalProviderDeletionIncluded: boolean; localBrowserDeletionIncluded: boolean }
    }
    expect(deleted.status).toBe(200)
    expect(receipt.schema).toBe("astra-cloud-learning-memory-deletion-receipt.v1")
    expect(receipt.collections.find((collection) => collection.collection === "vocabulary")).toMatchObject({ clearedMutationCount: 1, clearedActiveCount: 1, previousCursor: "1" })
    expect(receipt.collections.find((collection) => collection.collection === "review_schedule")).toMatchObject({ clearedMutationCount: 1, clearedActiveCount: 1, previousCursor: "2" })
    expect(receipt.collections.find((collection) => collection.collection === "weekly_digest_archive")).toMatchObject({ clearedMutationCount: 1, clearedActiveCount: 1, previousCursor: null })
    expect(receipt.totals).toEqual({ clearedMutationCount: 3, clearedActiveCount: 3 })
    expect(receipt.boundary).toMatchObject({ metadataOnly: true, cloudServerSideOnly: true, externalProviderDeletionIncluded: false, localBrowserDeletionIncluded: false })

    const db = await readUserDb(userDbPath)
    expect(db.users.some((user) => user.email === env.loginEmail)).toBe(true)
    expect(db.syncMutations.some((mutation) => mutation.email === env.loginEmail || mutation.ownerId === "usr_demo")).toBe(false)
    expect(db.weeklyDigests.some((digest) => digest.email === env.loginEmail || digest.ownerId === "usr_demo")).toBe(false)
  })

  it("issues and redeems an email sign-in code", async () => {
    await startServer(await createUserDb())

    const issueResponse = await fetch(`${baseURL}/v1/auth/email-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: env.loginEmail }),
    })
    expect(issueResponse.status).toBe(200)
    const issue = await issueResponse.json() as { code: string; expiresAt: string; delivery: string }
    expect(issue.code).toMatch(/^\d{8}$/)
    expect(issue.delivery).toBe("development_response")
    expect(Date.parse(issue.expiresAt)).toBeGreaterThan(Date.now())

    const redeemResponse = await fetch(`${baseURL}/v1/auth/email-code/redeem`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Astra-Device-Id": "device-email-code",
      },
      body: JSON.stringify({
        email: env.loginEmail,
        code: issue.code,
        deviceId: "device-email-code",
        device: { label: "Email code phone", platform: "ios", appKind: "mobile" },
      }),
    })
    expect(redeemResponse.status).toBe(200)
    const redeemed = await redeemResponse.json() as { sessionToken: string; email: string; identityMode: string; deviceId: string }
    expect(redeemed.sessionToken).toBeTruthy()
    expect(redeemed.email).toBe(env.loginEmail)
    expect(redeemed.identityMode).toBe("authenticated")
    expect(redeemed.deviceId).toBe("device-email-code")

    const replayResponse = await fetch(`${baseURL}/v1/auth/email-code/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: env.loginEmail, code: issue.code, deviceId: "device-email-code-replay" }),
    })
    expect(replayResponse.status).toBe(404)
  })

  it("does not echo email sign-in codes without the development flag", async () => {
    await startServer(await createUserDb(), { emailSignInCodeDevelopmentEcho: false })

    const issueResponse = await fetch(`${baseURL}/v1/auth/email-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: env.loginEmail }),
    })
    expect(issueResponse.status).toBe(200)
    const issue = await issueResponse.json() as { code?: string; expiresAt: string; delivery: string }
    expect(issue.code).toBeUndefined()
    expect(issue.delivery).toBe("unavailable")
    expect(Date.parse(issue.expiresAt)).toBeGreaterThan(Date.now())
  })

  it("sends production email sign-in codes through Resend without echoing codes", async () => {
    await startServer(await createUserDb(), {
      emailSignInCodeDevelopmentEcho: false,
      emailDeliveryProvider: "resend",
      emailDeliveryResendApiKey: "resend-test-key",
      emailDeliveryResendFrom: "Astra <login@example.com>",
      emailDeliveryResendApiBaseUrl: "http://unsafe-resend-proxy.test",
    })
    const nativeFetch = globalThis.fetch.bind(globalThis)
    const resendRequests: Array<{ url: string; init?: RequestInit; body: Record<string, unknown> }> = []
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = toFetchUrl(input)
      if (url.startsWith(baseURL)) return nativeFetch(input, init)
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>
      resendRequests.push({ url, init, body })
      return new Response(JSON.stringify({ id: "email_1" }), { status: 200, headers: { "Content-Type": "application/json" } })
    })

    try {
      const issueResponse = await fetch(`${baseURL}/v1/auth/email-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: env.loginEmail }),
      })
      expect(issueResponse.status).toBe(200)
      const issue = await issueResponse.json() as { code?: string; expiresAt: string; delivery: string }
      expect(issue.code).toBeUndefined()
      expect(issue.delivery).toBe("email")
      for (let attempt = 0; attempt < 5 && resendRequests.length === 0; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
      expect(resendRequests).toHaveLength(1)
      expect(resendRequests[0]).toMatchObject({ url: "https://api.resend.com/emails" })
      expect(resendRequests[0].init?.headers).toMatchObject({
        Authorization: "Bearer resend-test-key",
        "Content-Type": "application/json",
      })
      expect(resendRequests[0].body).toMatchObject({
        from: "Astra <login@example.com>",
        to: [env.loginEmail],
        subject: "Your Astra sign-in code",
      })
      const sentText = String(resendRequests[0].body.text)
      const sentCode = /code is (\d{8})\./.exec(sentText)?.[1]
      expect(sentCode).toMatch(/^\d{8}$/)
      await new Promise((resolve) => setTimeout(resolve, 0))

      const unknownResponse = await fetch(`${baseURL}/v1/auth/email-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "unknown@example.test" }),
      })
      const unknown = await unknownResponse.json() as { code?: string; delivery: string }
      expect(unknownResponse.status).toBe(200)
      expect(unknown.code).toBeUndefined()
      expect(unknown.delivery).toBe("email")
      expect(resendRequests).toHaveLength(1)

      const redeemResponse = await fetch(`${baseURL}/v1/auth/email-code/redeem`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Astra-Device-Id": "device-email-code-production",
        },
        body: JSON.stringify({
          email: env.loginEmail,
          code: sentCode,
          deviceId: "device-email-code-production",
          device: { label: "Production email phone", platform: "ios", appKind: "mobile" },
        }),
      })
      expect(redeemResponse.status).toBe(200)
    } finally {
      fetchMock.mockRestore()
    }
  })

  it("keeps email sign-in code requests generic for unknown addresses", async () => {
    await startServer(await createUserDb())

    const issueResponse = await fetch(`${baseURL}/v1/auth/email-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "unknown@example.test" }),
    })
    expect(issueResponse.status).toBe(200)
    const issue = await issueResponse.json() as { code?: string; expiresAt: string; delivery: string }
    expect(issue.code).toBeUndefined()
    expect(issue.delivery).toBe("unavailable")
    expect(Date.parse(issue.expiresAt)).toBeGreaterThan(Date.now())
  })

  it("throttles repeated email sign-in code redeem guesses", async () => {
    await startServer(await createUserDb())

    const issueResponse = await fetch(`${baseURL}/v1/auth/email-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: env.loginEmail }),
    })
    const issue = await issueResponse.json() as { code: string }

    for (let attempt = 0; attempt < 13; attempt += 1) {
      const guessResponse = await fetch(`${baseURL}/v1/auth/email-code/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.9" },
        body: JSON.stringify({ email: env.loginEmail, code: "NOPE", deviceId: `device-email-guess-${attempt}` }),
      })
      expect(guessResponse.status).toBe(404)
    }

    const redeemResponse = await fetch(`${baseURL}/v1/auth/email-code/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.9" },
      body: JSON.stringify({ email: env.loginEmail, code: issue.code, deviceId: "device-email-code-blocked" }),
    })
    expect(redeemResponse.status).toBe(404)
  })

  it("issues and redeems a desktop-to-mobile link code", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-desktop-link")

    const issueResponse = await fetch(`${baseURL}/v1/auth/mobile-link`, {
      method: "POST",
      headers: {
        ...authHeaders(session.sessionToken, deviceId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    })
    const issue = await issueResponse.json() as { code: string; expiresAt: string; link: string }

    expect(issueResponse.status).toBe(200)
    expect(issue.code).toMatch(/^\d{6}$/)
    expect(issue.link).toBe(`astra-review://link?code=${issue.code}`)
    expect(Date.parse(issue.expiresAt)).toBeGreaterThan(Date.now())

    const redeemResponse = await fetch(`${baseURL}/v1/auth/mobile-link/redeem`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Astra-Device-Id": "device-mobile-link",
      },
      body: JSON.stringify({
        code: `${issue.code.slice(0, 3)}-${issue.code.slice(3)}`,
        deviceId: "device-mobile-link",
        device: {
          label: "iPhone",
          platform: "ios",
          appKind: "mobile",
          appVersion: "0.1.0-test",
        },
      }),
    })
    const redeemed = await redeemResponse.json() as { sessionToken: string; deviceId: string; email: string; identityMode: string }

    expect(redeemResponse.status).toBe(200)
    expect(redeemed.sessionToken.length).toBeGreaterThan(10)
    expect(redeemed.deviceId).toBe("device-mobile-link")
    expect(redeemed.email).toBe(env.loginEmail)
    expect(redeemed.identityMode).toBe("authenticated")

    const replayResponse = await fetch(`${baseURL}/v1/auth/mobile-link/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: issue.code, deviceId: "device-mobile-link-replay" }),
    })
    expect(replayResponse.status).toBe(404)
  })

  it("stores authenticated metadata-only support reports in the relay inbox", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath)
    const { session, deviceId } = await createSession("device-support")
    const bundle = buildSupportBundle({
      reportId: "rpt_support_0001",
      extensionVersion: "1.0.0",
      browser: "Chrome",
      os: "macOS",
      locale: "en-US",
      featureSurface: "settings",
      action: "diagnostics_support_report",
      issueCategory: "page_not_working",
      runtimeSurface: "options",
      timestamp: "2026-05-27T00:00:00.000Z",
      privacyMode: true,
      membershipState: "free",
      userConsent: true,
    })

    const response = await fetch(`${baseURL}/v1/support/reports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(session.sessionToken, deviceId),
      },
      body: JSON.stringify({ bundle }),
    })

    const payload = await response.json() as {
      report: {
        reportId: string
        status: string
        issueCategory: string | null
        defaultContentIncluded: boolean
      }
    }
    expect(response.status).toBe(201)
    expect(payload.report).toMatchObject({
      reportId: "rpt_support_0001",
      status: "submitted",
      issueCategory: "page_not_working",
      defaultContentIncluded: false,
    })

    const rawInbox = JSON.parse(await readFile(env.supportReportInboxPath, "utf8")) as {
      version: number
      reports: Array<{
        reportId: string
        status: string
        ownerEmail: string
        deviceId: string
        sessionId: string
        bundle: { contentIncluded: { enabled: boolean; type: string } }
      }>
    }
    expect(rawInbox.version).toBe(1)
    expect(rawInbox.reports).toHaveLength(1)
    expect(rawInbox.reports[0]).toMatchObject({
      reportId: "rpt_support_0001",
      status: "submitted",
      ownerEmail: env.loginEmail,
      deviceId,
      sessionId: session.sessionId,
      bundle: { contentIncluded: { enabled: false, type: "none" } },
    })
  })

  it("serves operator-only metadata support report aggregation", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath)
    const { session, deviceId } = await createSession("device-support-summary")

    for (const reportId of ["rpt_support_summary_0001", "rpt_support_summary_0002"]) {
      const bundle = buildSupportBundle({
        reportId,
        extensionVersion: "1.0.0",
        browser: "Chrome",
        os: "macOS",
        locale: "en-US",
        featureSurface: "page",
        action: "report_this_page",
        issueCategory: "page_not_working",
        hostname: "https://news.example/article",
        timestamp: "2026-05-27T00:00:00.000Z",
        privacyMode: true,
        membershipState: "trial",
        userConsent: true,
      })
      const createResponse = await fetch(`${baseURL}/v1/support/reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(session.sessionToken, deviceId),
        },
        body: JSON.stringify({ bundle }),
      })
      expect(createResponse.status).toBe(201)
    }

    const response = await fetch(`${baseURL}/v1/ops/support/reports/summary`, {
      headers: { "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
    })
    const payload = await response.json() as {
      totalReports: number
      buckets: Array<{
        count: number
        hostname: string | null
        featureSurface: string
        issueCategory: string | null
        extensionVersion: string
        browser: string
        membershipState: string
        privacyMode: boolean
      }>
      weeklyTopIssues: Array<{
        weekStart: string
        reportCount: number
        hostname: string | null
        featureSurface: string
        issueCategory: string | null
        knownIssueId: string | null
        knownIssueStatus: string | null
      }>
      macroCoverage: {
        catalogCoverage: { coverageRate: number; ready: boolean }
        reportedCoverage: { coveredReports: number; totalReports: number; coverageRate: number | null; ready: boolean | null }
        byIssueCategory: Array<{ issueCategory: string; count: number; macroId: string | null; covered: boolean }>
        macros: Array<{ issueCategory: string; firstResponse: string; privacyNote: string }>
      }
      slaRisk: {
        generatedAt: string
        currentNow: string
        unresolvedCount: number
        urgentUnresolvedCount: number
        staleTriageByAgeBucket: { under24h: number; from24hTo72h: number; from72hTo168h: number; over168h: number }
        followUpOverdueCount: number
        oldestUnresolvedAgeHours: number | null
        oldestUnresolvedAgeDays: number | null
      }
    }

    expect(response.status).toBe(200)
    expect(payload.totalReports).toBe(2)
    expect(payload.buckets).toHaveLength(1)
    expect(payload.buckets[0]).toMatchObject({
      count: 2,
      hostname: "news.example",
      featureSurface: "page",
      issueCategory: "page_not_working",
      extensionVersion: "1.0.0",
      browser: "Chrome",
      membershipState: "trial",
      privacyMode: true,
    })
    expect(payload.weeklyTopIssues).toEqual([
      expect.objectContaining({
        weekStart: getUtcWeekStartDate(),
        reportCount: 2,
        hostname: "news.example",
        featureSurface: "page",
        issueCategory: "page_not_working",
        knownIssueId: null,
        knownIssueStatus: null,
      }),
    ])
    expect(payload.macroCoverage.catalogCoverage).toMatchObject({ coverageRate: 1, ready: true })
    expect(payload.macroCoverage.reportedCoverage).toMatchObject({
      coveredReports: 2,
      totalReports: 2,
      coverageRate: 1,
      ready: true,
    })
    expect(payload.macroCoverage.byIssueCategory).toEqual(expect.arrayContaining([
      expect.objectContaining({ issueCategory: "page_not_working", count: 2, macroId: "macro_page_not_working", covered: true }),
    ]))
    expect(payload.slaRisk).toMatchObject({
      generatedAt: payload.slaRisk.currentNow,
      unresolvedCount: 2,
      urgentUnresolvedCount: 0,
      followUpOverdueCount: 0,
    })
    expect(payload.slaRisk.oldestUnresolvedAgeHours).toEqual(expect.any(Number))
    expect(JSON.stringify(payload.macroCoverage)).not.toMatch(/user@example\.com|Hello, world\./i)
    expect(JSON.stringify(payload.slaRisk)).not.toMatch(/user@example\.com|device-support-summary|rpt_support_summary|news\.example|Hello, world\./i)
  })

  it("records metadata-only support follow-up handoff updates for operators", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath)
    const { session, deviceId } = await createSession("device-support-handoff")
    const bundle = buildSupportBundle({
      reportId: "rpt_support_handoff_0001",
      extensionVersion: "1.0.0",
      browser: "Chrome",
      os: "macOS",
      locale: "en-US",
      featureSurface: "page",
      action: "report_this_page",
      issueCategory: "page_not_working",
      hostname: "https://news.example/article",
      timestamp: "2026-05-27T00:00:00.000Z",
      privacyMode: true,
      membershipState: "trial",
      userConsent: true,
    })
    const createResponse = await fetch(`${baseURL}/v1/support/reports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(session.sessionToken, deviceId),
      },
      body: JSON.stringify({ bundle }),
    })
    expect(createResponse.status).toBe(201)

    const patchResponse = await fetch(`${baseURL}/v1/ops/support/reports/rpt_support_handoff_0001/triage`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Astra-Operator-Token": env.platformMirrorSecret ?? "",
      },
      body: JSON.stringify({
        followUp: {
          path: "email_follow_up",
          status: "handed_off",
          macroId: "macro_page_not_working",
          reason: "needs_manual_email",
          updatedBy: "ops-test",
        },
      }),
    })
    const patchPayload = await patchResponse.json() as {
      report: {
        recommendedMacro: { id: string } | null
        triage: { status: string; followUp: { path: string; status: string; macroId: string | null; reason: string | null } }
      }
    }
    expect(patchResponse.status).toBe(200)
    expect(patchPayload.report.recommendedMacro?.id).toBe("macro_page_not_working")
    expect(patchPayload.report.triage).toMatchObject({
      status: "new",
      followUp: {
        path: "email_follow_up",
        status: "handed_off",
        macroId: "macro_page_not_working",
        reason: "needs_manual_email",
      },
    })

    const summaryResponse = await fetch(`${baseURL}/v1/ops/support/reports/summary`, {
      headers: { "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
    })
    const summaryPayload = await summaryResponse.json() as {
      handoffSummary: { byPath: Array<{ path: string; count: number }>; byStatus: Array<{ status: string; count: number }> }
    }
    expect(summaryResponse.status).toBe(200)
    expect(summaryPayload.handoffSummary.byPath).toContainEqual({ path: "email_follow_up", count: 1 })
    expect(summaryPayload.handoffSummary.byStatus).toContainEqual({ status: "handed_off", count: 1 })

    const auditResponse = await fetch(`${baseURL}/v1/ops/audit/summary`, {
      headers: { "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
    })
    const auditPayload = await auditResponse.json() as { byAction: Array<{ action: string; count: number }>; recent: Array<{ action: string; metadata: Record<string, unknown> }> }
    expect(auditPayload.byAction).toContainEqual({ action: "ops_support_handoff_updated", count: 1 })
    expect(auditPayload.recent).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: "ops_support_handoff_updated",
        metadata: expect.objectContaining({ path: "email_follow_up", status: "handed_off", macroId: "macro_page_not_working" }),
      }),
    ]))
    const serialized = JSON.stringify(auditPayload)
    expect(serialized).not.toContain("demo@astra.local")
    expect(serialized).not.toContain(deviceId)
    expect(serialized).not.toContain(session.sessionToken)
    expect(serialized).not.toContain("news.example")
  })

  it("records authenticated cancellation reasons and serves privacy-safe operator aggregation", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath)
    const { session, deviceId } = await createSession("device-cancel-reason")

    const createResponse = await fetch(`${baseURL}/v1/account/cancellation-reasons`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(session.sessionToken, deviceId),
      },
      body: JSON.stringify({ reason: "privacy_concerns", source: "refund_request" }),
    })
    const createPayload = await createResponse.json() as {
      schema: string
      submission: { id: string; reason: string; plan: string; source: string; subscriptionStatus: string }
    }
    expect(createResponse.status).toBe(201)
    expect(createPayload).toMatchObject({
      schema: "astra-cancellation-reason-submission.v1",
      submission: {
        reason: "privacy_concerns",
        plan: "pro",
        source: "refund_request",
        subscriptionStatus: "active",
      },
    })

    const rawStore = JSON.parse(await readFile(env.cancellationReasonStorePath ?? "", "utf8")) as {
      records: Array<{ subjectUserId: string; subjectEmailHash: string; reason: string; plan: string; source: string }>
    }
    expect(rawStore.records).toHaveLength(1)
    expect(rawStore.records[0]).toMatchObject({
      subjectUserId: "usr_demo",
      subjectEmailHash: createHash("sha256").update("demo@astra.local").digest("hex"),
      reason: "privacy_concerns",
      plan: "pro",
      source: "refund_request",
    })
    expect(JSON.stringify(rawStore)).not.toContain("demo@astra.local")
    expect(JSON.stringify(rawStore)).not.toContain(deviceId)
    expect(JSON.stringify(rawStore)).not.toContain(session.sessionToken)

    const unauthorizedResponse = await fetch(`${baseURL}/v1/ops/cancellations/reasons/summary`)
    expect(unauthorizedResponse.status).toBe(401)

    const response = await fetch(`${baseURL}/v1/ops/cancellations/reasons/summary`, {
      headers: { "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
    })
    const payload = await response.json() as {
      schema: string
      totalSubmissions: number
      reasonCoverage: { coverageRate: number | null }
      byReason: Array<{ reason: string; label: string; productMeaning: string; count: number; share: number }>
      byPlan: Array<{ plan: string; count: number }>
      bySource: Array<{ source: string; count: number }>
    }

    expect(response.status).toBe(200)
    expect(payload.schema).toBe("astra-cancellation-reason-summary.v1")
    expect(payload.totalSubmissions).toBe(1)
    expect(payload.reasonCoverage.coverageRate).toBe(1)
    expect(payload.byReason).toContainEqual(expect.objectContaining({
      reason: "privacy_concerns",
      label: "Privacy concerns",
      count: 1,
      share: 1,
    }))
    expect(payload.byPlan).toContainEqual({ plan: "pro", count: 1 })
    expect(payload.bySource).toContainEqual({ source: "refund_request", count: 1 })
    expect(JSON.stringify(payload)).not.toContain("usr_demo")
    expect(JSON.stringify(payload)).not.toContain(rawStore.records[0]!.subjectEmailHash)
    expect(JSON.stringify(payload)).not.toContain("demo@astra.local")
    expect(JSON.stringify(payload)).not.toContain(deviceId)

    const auditResponse = await fetch(`${baseURL}/v1/ops/audit/summary`, {
      headers: { "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
    })
    const auditPayload = await auditResponse.json() as { byAction: Array<{ action: string; count: number }> }
    expect(auditPayload.byAction).toContainEqual({ action: "cancellation_reason_submitted", count: 1 })
    expect(auditPayload.byAction).toContainEqual({ action: "ops_cancellation_reasons_viewed", count: 1 })
  })

  it("returns operator-gated read-only ops cockpit summaries", async () => {
    const userDbPath = await createUserDb()
    const db = JSON.parse(await readFile(userDbPath, "utf8")) as { users: Array<{ usage: { recentEvents: unknown[] } }> }
    db.users[0]!.usage.recentEvents = [
      {
        timestamp: "2026-05-27T00:01:00.000Z",
        provider: "openai",
        model: "gpt-private-pro",
        serviceMode: "automatic",
        requestCount: 2,
        characterCount: 12000,
        task: "explain",
        durationMs: 900,
        taskClass: "deep_reading",
        costBucket: "high",
        tier: "pro",
        cacheStatus: "miss",
        fallbackReason: "timeout",
        fallbackUsed: true,
        success: false,
      },
    ]
    await writeFile(userDbPath, JSON.stringify(db, null, 2))
    await startServer(userDbPath, {
      operatorPrincipals: [{ id: "support-lead-local", role: "support_lead", token: "support-lead-secret" }],
    })
    const { session, deviceId } = await createSession("device-ops-cockpit")

    const supportBundle = buildSupportBundle({
      reportId: "rpt_ops_cockpit_0001",
      extensionVersion: "1.0.0",
      browser: "Chrome",
      os: "macOS",
      locale: "en-US",
      featureSurface: "page",
      action: "report_this_page",
      issueCategory: "page_not_working",
      hostname: "https://private.example/article?secret=1",
      timestamp: "2026-05-27T00:00:00.000Z",
      privacyMode: true,
      membershipState: "pro",
      userConsent: true,
    })
    expect((await fetch(`${baseURL}/v1/support/reports`, {
      method: "POST",
      headers: { ...authHeaders(session.sessionToken, deviceId), "Content-Type": "application/json" },
      body: JSON.stringify({ bundle: supportBundle }),
    })).status).toBe(201)
    expect((await fetch(`${baseURL}/v1/account/analytics-events`, {
      method: "POST",
      headers: { ...authHeaders(session.sessionToken, deviceId), "Content-Type": "application/json" },
      body: JSON.stringify({
        schema: "astra-analytics-events-ingest.v1",
        events: [{ name: "onboarding_completed", timestamp: "2026-05-28T12:00:00.000Z", properties: { plan: "pro", cohort: "launch", sourceType: "extension", outcome: "success" } }],
      }),
    })).status).toBe(200)
    expect((await fetch(`${baseURL}/v1/account/mobile-retention-events`, {
      method: "POST",
      headers: { ...authHeaders(session.sessionToken, deviceId), "Content-Type": "application/json" },
      body: JSON.stringify({
        schema: "astra-mobile-retention-events.v1",
        events: [{ id: "mobile-cockpit-1", name: "app_opened", timestamp: Date.now(), metadata: { surface: "mobile" } }],
      }),
    })).status).toBe(200)
    expect((await fetch(`${baseURL}/v1/account/cancellation-reasons`, {
      method: "POST",
      headers: { ...authHeaders(session.sessionToken, deviceId), "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "too_slow", source: "settings" }),
    })).status).toBe(201)

    const unauthorizedResponse = await fetch(`${baseURL}/v1/ops/cockpit/summary`)
    expect(unauthorizedResponse.status).toBe(401)

    const response = await fetch(`${baseURL}/v1/ops/cockpit/summary`, {
      headers: { "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
    })
    expect(response.status).toBe(200)
    const payload = await response.json() as {
      schema: string
      privacy: { metadataOnly: boolean; aggregateOnly: boolean; readOnly: boolean; contentIncluded: boolean; perUserRows: boolean; identifiersIncluded: boolean; providerBillingIncluded: boolean; crmRepliesIncluded: boolean }
      sources: { providerHealthSummary: boolean; operatingReviewHelpers: boolean }
      metrics: {
        cost: { retainedEvents: number; topCostTaskClass: string | null; dailyRiskLevel: string }
        support: { totalReports: number; unresolvedCount: number; urgentUnresolvedCount: number }
        retentionGrowth: { analyticsEvents: number; mobileRetentionEvents: number; cancellationSubmissions: number; topCancellationReason: string | null }
        providerHealth: { available: boolean; incidentBucketCount: number }
      }
      reviewCadence: Array<{ cadence: string; availableEvidence: string[] }>
      experimentGuardrails: Array<{ area: string; privacyRule: string }>
      riskFlags: Array<{ code: string; severity: string }>
    }

    expect(payload).toMatchObject({
      schema: "astra-ops-cockpit-summary.v1",
      privacy: {
        metadataOnly: true,
        aggregateOnly: true,
        readOnly: true,
        contentIncluded: false,
        perUserRows: false,
        identifiersIncluded: false,
        providerBillingIncluded: false,
        crmRepliesIncluded: false,
      },
      sources: { providerHealthSummary: true, operatingReviewHelpers: true },
      metrics: {
        cost: { retainedEvents: 1, topCostTaskClass: "deep_reading" },
        support: { totalReports: 1, unresolvedCount: 1 },
        retentionGrowth: { analyticsEvents: 1, mobileRetentionEvents: 1, cancellationSubmissions: 1, topCancellationReason: "Too slow" },
        providerHealth: { available: true, incidentBucketCount: 1 },
      },
    })
    expect(payload.reviewCadence.find((item) => item.cadence === "weekly")?.availableEvidence).toEqual(expect.arrayContaining(["experiment_guardrails", "support_report_summary", "cost_usage_summary"]))
    expect(payload.experimentGuardrails.map((guardrail) => guardrail.area)).toContain("support")
    expect(payload.riskFlags.map((flag) => flag.code)).toEqual(expect.arrayContaining(["cost_spike_or_high_risk", "support_sla_risk", "provider_health_incident"]))

    const supportLeadResponse = await fetch(`${baseURL}/v1/ops/cockpit/summary`, {
      headers: { "X-Astra-Operator-Token": "support-lead-secret" },
    })
    const supportLeadPayload = await supportLeadResponse.json() as {
      sources: { providerHealthSummary: boolean }
      metrics: { providerHealth: { available: boolean; incidentBucketCount: number; watchBucketCount: number } }
      riskFlags: Array<{ code: string }>
    }
    expect(supportLeadResponse.status).toBe(200)
    expect(supportLeadPayload.sources.providerHealthSummary).toBe(false)
    expect(supportLeadPayload.metrics.providerHealth).toMatchObject({ available: false, incidentBucketCount: 0, watchBucketCount: 0 })
    expect(supportLeadPayload.riskFlags.map((flag) => flag.code)).not.toContain("provider_health_incident")

    const auditResponse = await fetch(`${baseURL}/v1/ops/audit/summary`, {
      headers: { "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
    })
    const auditPayload = await auditResponse.json() as { byAction: Array<{ action: string; count: number }>; recent: Array<{ action: string; metadata: Record<string, string | number | boolean | null>; privacy: { contentIncluded: boolean; contentAccess: string } }> }
    expect(auditResponse.status).toBe(200)
    expect(auditPayload.byAction).toContainEqual({ action: "ops_cockpit_summary_viewed", count: 2 })
    expect(auditPayload.recent).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: "ops_cockpit_summary_viewed",
        metadata: expect.objectContaining({ providerHealthIncluded: true }),
        privacy: expect.objectContaining({ contentIncluded: false, contentAccess: "metadata_only" }),
      }),
      expect.objectContaining({
        action: "ops_cockpit_summary_viewed",
        metadata: expect.objectContaining({ providerHealthIncluded: false }),
        privacy: expect.objectContaining({ contentIncluded: false, contentAccess: "metadata_only" }),
      }),
    ]))

    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain("demo@astra.local")
    expect(serialized).not.toContain("usr_demo")
    expect(serialized).not.toContain(deviceId)
    expect(serialized).not.toContain("private.example")
    expect(serialized).not.toContain("gpt-private-pro")
    expect(serialized).not.toContain("secret=1")
    expect(serialized).not.toContain("Hello, world")
  })

  it("serves operator-only cost usage summary by tier and task class", async () => {
    const userDbPath = await createUserDb()
    const db = JSON.parse(await readFile(userDbPath, "utf8")) as {
      users: Array<{ usage: { recentEvents: Array<Record<string, unknown>> } }>
    }
    db.users[0]!.usage.recentEvents = [
      {
        timestamp: "2026-05-27T00:00:00.000Z",
        provider: "openai",
        model: "gpt-private-pro",
        serviceMode: "fast",
        requestCount: 2,
        characterCount: 150,
        task: "translate",
        durationMs: 120,
        taskClass: "paragraph_understanding",
        costBucket: "medium",
        tier: "pro",
        cacheStatus: "hit",
        fallbackReason: "none",
        fallbackUsed: false,
        success: true,
      },
      {
        timestamp: "2026-05-27T00:01:00.000Z",
        provider: "gemini",
        model: "gemini-private-free",
        serviceMode: "automatic",
        requestCount: 1,
        characterCount: 12000,
        task: "explain",
        durationMs: 900,
        taskClass: "deep_reading",
        costBucket: "high",
        tier: "free",
        cacheStatus: "miss",
        fallbackReason: "timeout",
        fallbackUsed: true,
        success: false,
      },
      {
        timestamp: "2026-05-27T00:02:00.000Z",
        provider: "openai",
        model: "gpt-private-pro",
        serviceMode: "fast",
        requestCount: 1,
        characterCount: 50,
        task: "translate",
        durationMs: 240,
        taskClass: "paragraph_understanding",
        costBucket: "medium",
        tier: "pro",
        cacheStatus: "disabled",
        fallbackReason: "none",
        fallbackUsed: false,
        success: true,
      },
    ]
    await writeFile(userDbPath, JSON.stringify(db, null, 2))
    await startServer(userDbPath)

    const unauthorizedResponse = await fetch(`${baseURL}/v1/ops/cost/usage-summary`)
    expect(unauthorizedResponse.status).toBe(401)

    const response = await fetch(`${baseURL}/v1/ops/cost/usage-summary`, {
      headers: { "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
    })
    const payload = await response.json() as {
      schema: string
      generatedAt: string
      source: string
      recentEventsPerUserLimit: number
      totalEvents: number
      totalRequests: number
      totalCharacters: number
      totalEstimatedSpendUsd: number
      estimateRegistry: string
      cacheHitRate: number | null
      dailyEstimate: {
        date: string | null
        estimatedSpendUsd: number
        previousDate: string | null
        previousEstimatedSpendUsd: number
        spikeRatio: number | null
        spikeStatus: string
        riskLevel: string
      }
      buckets: Array<{
        tier: string
        taskClass: string
        costBucket: string
        eventCount: number
        requestCount: number
        characterCount: number
        successCount: number
        failureCount: number
        fallbackCount: number
        estimatedSpendUsd: number
      }>
      byServiceMode: Array<{
        serviceMode: string
        eventCount: number
        requestCount: number
        characterCount: number
        successCount: number
        failureCount: number
        fallbackCount: number
        latencySampleCount: number
        latencyP50Ms: number | null
        latencyP95Ms: number | null
        estimatedSpendUsd: number
      }>
      byCacheStatus: Array<{
        cacheStatus: string
        eventCount: number
        requestCount: number
        characterCount: number
        share: number
        estimatedSpendUsd: number
      }>
    }

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      schema: "astra-cost-usage-summary.v1",
      source: "recent_user_usage_events",
      recentEventsPerUserLimit: 10,
      totalEvents: 3,
      totalRequests: 4,
      totalCharacters: 12200,
      totalEstimatedSpendUsd: 0.019487,
      estimateRegistry: "internal_deterministic_v1",
      cacheHitRate: 0.5,
      dailyEstimate: {
        date: "2026-05-27",
        estimatedSpendUsd: 0.019487,
        previousDate: "2026-05-26",
        previousEstimatedSpendUsd: 0,
        spikeRatio: null,
        spikeStatus: "watch",
        riskLevel: "watch",
      },
    })
    expect(payload.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(payload.buckets).toContainEqual(expect.objectContaining({
      tier: "pro",
      taskClass: "paragraph_understanding",
      costBucket: "medium",
      eventCount: 2,
      requestCount: 3,
      characterCount: 200,
      successCount: 2,
      failureCount: 0,
      fallbackCount: 0,
      estimatedSpendUsd: 0.000147,
    }))
    expect(payload.buckets).toContainEqual(expect.objectContaining({
      tier: "free",
      taskClass: "deep_reading",
      costBucket: "high",
      eventCount: 1,
      requestCount: 1,
      characterCount: 12000,
      successCount: 0,
      failureCount: 1,
      fallbackCount: 1,
      estimatedSpendUsd: 0.01934,
    }))
    expect(payload.byServiceMode).toContainEqual(expect.objectContaining({
      serviceMode: "fast",
      eventCount: 2,
      requestCount: 3,
      characterCount: 200,
      successCount: 2,
      failureCount: 0,
      fallbackCount: 0,
      latencySampleCount: 2,
      latencyP50Ms: 120,
      latencyP95Ms: 240,
      estimatedSpendUsd: 0.000147,
    }))
    expect(payload.byCacheStatus).toContainEqual({
      cacheStatus: "hit",
      eventCount: 1,
      requestCount: 2,
      characterCount: 150,
      share: 0.3333,
      estimatedSpendUsd: 0.000105,
    })
    expect(payload.byCacheStatus).toContainEqual({
      cacheStatus: "miss",
      eventCount: 1,
      requestCount: 1,
      characterCount: 12000,
      share: 0.3333,
      estimatedSpendUsd: 0.01934,
    })
    expect(payload.byCacheStatus).toContainEqual({
      cacheStatus: "disabled",
      eventCount: 1,
      requestCount: 1,
      characterCount: 50,
      share: 0.3333,
      estimatedSpendUsd: 0.000042,
    })
    expect(payload.byServiceMode).toContainEqual(expect.objectContaining({
      serviceMode: "automatic",
      eventCount: 1,
      requestCount: 1,
      characterCount: 12000,
      successCount: 0,
      failureCount: 1,
      fallbackCount: 1,
      latencySampleCount: 1,
      latencyP50Ms: 900,
      latencyP95Ms: 900,
      estimatedSpendUsd: 0.01934,
    }))
    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain("demo@astra.local")
    expect(serialized).not.toContain("billing@astra.local")
    expect(serialized).not.toContain("usr_demo")
    expect(serialized).not.toContain("openai")
    expect(serialized).not.toContain("gemini")
    expect(serialized).not.toContain("gpt-private-pro")
    expect(serialized).not.toContain("gemini-private-free")
  })

  it("serves operator-only provider health summary by provider model and task", async () => {
    const userDbPath = await createUserDb()
    const db = JSON.parse(await readFile(userDbPath, "utf8")) as {
      users: Array<{ usage: { recentEvents: Array<Record<string, unknown>> } }>
    }
    db.users[0]!.usage.recentEvents = [
      {
        timestamp: "2026-05-27T00:00:00.000Z",
        provider: "openai",
        model: "gpt-health-pro",
        serviceMode: "balanced",
        requestCount: 2,
        characterCount: 150,
        task: "translate",
        durationMs: 120,
        taskClass: "paragraph_understanding",
        costBucket: "medium",
        tier: "pro",
        fallbackReason: "none",
        fallbackUsed: false,
        success: true,
      },
      {
        timestamp: "2026-05-27T00:01:00.000Z",
        provider: "openai",
        model: "gpt-health-pro",
        serviceMode: "balanced",
        requestCount: 1,
        characterCount: 100,
        task: "translate",
        durationMs: 240,
        taskClass: "paragraph_understanding",
        costBucket: "medium",
        tier: "pro",
        fallbackReason: "timeout",
        fallbackUsed: false,
        success: false,
      },
      {
        timestamp: "2026-05-27T00:02:00.000Z",
        provider: "gemini",
        model: "gemini-health-free",
        serviceMode: "fast",
        requestCount: 1,
        characterCount: 50,
        task: "translate",
        durationMs: 90,
        taskClass: "instant_phrase",
        costBucket: "low",
        tier: "free",
        fallbackReason: "none",
        fallbackUsed: false,
        success: true,
      },
    ]
    await writeFile(userDbPath, JSON.stringify(db, null, 2))
    await startServer(userDbPath)

    const unauthorizedResponse = await fetch(`${baseURL}/v1/ops/provider-health/summary`)
    expect(unauthorizedResponse.status).toBe(401)

    const response = await fetch(`${baseURL}/v1/ops/provider-health/summary`, {
      headers: { "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
    })
    const payload = await response.json() as {
      schema: string
      source: string
      recentEventsPerUserLimit: number
      totalEvents: number
      totalRequests: number
      totalCharacters: number
      buckets: Array<{
        provider: string
        model: string
        serviceMode: string
        taskClass: string
        eventCount: number
        requestCount: number
        characterCount: number
        successCount: number
        failureCount: number
        fallbackCount: number
        successRate: number | null
        fallbackRate: number | null
        latencySampleCount: number
        latencyP50Ms: number | null
        latencyP95Ms: number | null
        healthStatus: string
      }>
    }

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      schema: "astra-provider-health-summary.v1",
      source: "recent_user_usage_events",
      recentEventsPerUserLimit: 10,
      totalEvents: 3,
      totalRequests: 4,
      totalCharacters: 300,
    })
    expect(payload.buckets).toContainEqual(expect.objectContaining({
      provider: "openai",
      model: "gpt-health-pro",
      serviceMode: "balanced",
      taskClass: "paragraph_understanding",
      eventCount: 2,
      successCount: 1,
      failureCount: 1,
      fallbackCount: 0,
      successRate: 0.5,
      fallbackRate: 0,
      latencySampleCount: 2,
      latencyP50Ms: 120,
      latencyP95Ms: 240,
      healthStatus: "incident",
    }))
    expect(payload.buckets).toContainEqual(expect.objectContaining({
      provider: "gemini",
      model: "gemini-health-free",
      healthStatus: "healthy",
    }))
    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain("demo@astra.local")
    expect(serialized).not.toContain("billing@astra.local")
    expect(serialized).not.toContain("usr_demo")
    expect(serialized).not.toContain("Hello, world")
  })

  it("serves operator-only user lookup with membership and usage category", async () => {
    const userDbPath = await createUserDb()
    const db = JSON.parse(await readFile(userDbPath, "utf8")) as {
      users: Array<{
        email: string
        usage: {
          usageDay: string
          requestsToday: number
          charactersToday: number
          totalRequests: number
          totalCharacters: number
          lastRequestAt: string | null
          recentEvents: Array<Record<string, unknown>>
        }
      }>
    }
    db.users[0]!.usage = {
      ...db.users[0]!.usage,
      usageDay: new Date().toISOString().slice(0, 10),
      requestsToday: 120,
      charactersToday: 60_000,
      totalRequests: 320,
      totalCharacters: 150_000,
      lastRequestAt: "2026-05-27T00:02:00.000Z",
      recentEvents: [
        {
          timestamp: "2026-05-27T00:00:00.000Z",
          provider: "openai",
          model: "gpt-private-pro",
          serviceMode: "balanced",
          requestCount: 1,
          characterCount: 150,
          task: "translate",
          durationMs: 120,
          taskClass: "paragraph_understanding",
          costBucket: "medium",
          tier: "pro",
          fallbackReason: "none",
          fallbackUsed: false,
          success: true,
        },
        {
          timestamp: "2026-05-27T00:01:00.000Z",
          provider: "gemini",
          model: "gemini-private-free",
          serviceMode: "fast",
          requestCount: 1,
          characterCount: 100,
          task: "explain",
          durationMs: 240,
          taskClass: "paragraph_understanding",
          costBucket: "medium",
          tier: "pro",
          fallbackReason: "timeout",
          fallbackUsed: true,
          success: false,
        },
        {
          timestamp: "2026-05-27T00:02:00.000Z",
          provider: "openai",
          model: "gpt-private-pro",
          serviceMode: "automatic",
          requestCount: 1,
          characterCount: 50,
          task: "translate",
          durationMs: 90,
          taskClass: "instant_phrase",
          costBucket: "low",
          tier: "pro",
          fallbackReason: "none",
          fallbackUsed: false,
          success: true,
        },
      ],
    }
    ;(db.users as Array<Record<string, unknown>>).push({
      ...(db.users[0] as unknown as Record<string, unknown>),
      id: "usr_prefixed",
      email: "usr_demo@astra.local",
      billingEmail: "billing-prefixed@astra.local",
      usage: {
        ...db.users[0]!.usage,
        requestsToday: 0,
        charactersToday: 0,
        totalRequests: 0,
        totalCharacters: 0,
        lastRequestAt: null,
        recentEvents: [],
      },
    })
    await writeFile(userDbPath, JSON.stringify(db, null, 2))
    await startServer(userDbPath)

    const unauthorizedResponse = await fetch(`${baseURL}/v1/ops/users/lookup?query=demo%40astra.local`)
    expect(unauthorizedResponse.status).toBe(401)

    const missingQueryResponse = await fetch(`${baseURL}/v1/ops/users/lookup`, {
      headers: { "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
    })
    expect(missingQueryResponse.status).toBe(400)

    const response = await fetch(`${baseURL}/v1/ops/users/lookup?query=demo%40astra.local`, {
      headers: { "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
    })
    const payload = await response.json() as {
      schema: string
      queryType: string
      resultWindow: {
        mode: string
        limit: number
        cursor: string | null
        nextCursor: string | null
        returnedCount: number
        totalMatched: number
        hasMore: boolean
      }
      snapshotBoundary: {
        metadataOnly: boolean
        contentIncluded: boolean
        rawQueryIncluded: boolean
        exportAvailable: boolean
        recentTaskSummaryLimit: number
        excludedFields: string[]
      }
      user: {
        userId: string
        emailHash: string
        plan: string
        subscriptionStatus: string
        identityMode: string
        providerEntitlementCount: number
        limits: { dailyRequests: number; dailyCharacters: number; requestsPerMinute: number }
        usage: { requestsToday: number; charactersToday: number; usageCategory: string; recentEventCount: number }
        devices: { activeCount: number; revokedCount: number }
        sessions: { activeCount: number; revokedCount: number }
        recentTaskSummary: Array<{
          taskClass: string
          eventCount: number
          successCount: number
          failureCount: number
          fallbackCount: number
          latencyP95Ms: number | null
        }>
      }
    }

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      schema: "astra-ops-user-lookup.v1",
      queryType: "email",
      user: {
        userId: "usr_demo",
        plan: "pro",
        subscriptionStatus: "active",
        identityMode: "authenticated",
        providerEntitlementCount: 2,
        usage: {
          requestsToday: 120,
          charactersToday: 60000,
          recentEventCount: 3,
          usageCategory: "heavy",
        },
      },
    })
    expect(payload.resultWindow).toEqual({
      mode: "exact_lookup",
      limit: 1,
      cursor: null,
      nextCursor: null,
      returnedCount: 1,
      totalMatched: 1,
      hasMore: false,
    })
    expect(payload.snapshotBoundary).toMatchObject({
      metadataOnly: true,
      contentIncluded: false,
      rawQueryIncluded: false,
      exportAvailable: false,
      recentTaskSummaryLimit: 6,
    })
    expect(payload.snapshotBoundary.excludedFields).toEqual(expect.arrayContaining(["email", "deviceId", "sessionId", "provider", "model", "rawQuery", "rawText"]))
    expect(payload.user.emailHash).toMatch(/^[a-f0-9]{64}$/)
    expect(payload.user.recentTaskSummary).toContainEqual(expect.objectContaining({
      taskClass: "paragraph_understanding",
      eventCount: 2,
      successCount: 1,
      failureCount: 1,
      fallbackCount: 1,
      latencyP95Ms: 240,
    }))
    expect(payload.user.recentTaskSummary).toContainEqual(expect.objectContaining({
      taskClass: "instant_phrase",
      eventCount: 1,
      successCount: 1,
      failureCount: 0,
      fallbackCount: 0,
      latencyP95Ms: 90,
    }))

    const emailHash = createHash("sha256").update("demo@astra.local").digest("hex")
    const hashLookupResponse = await fetch(`${baseURL}/v1/ops/users/lookup?query=${emailHash}`, {
      headers: { "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
    })
    const hashLookupPayload = await hashLookupResponse.json() as { queryType: string; user: { userId: string } }
    expect(hashLookupResponse.status).toBe(200)
    expect(hashLookupPayload).toMatchObject({ queryType: "email_hash", user: { userId: "usr_demo" } })

    const prefixedEmailLookupResponse = await fetch(`${baseURL}/v1/ops/users/lookup?query=usr_demo%40astra.local`, {
      headers: { "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
    })
    const prefixedEmailLookupPayload = await prefixedEmailLookupResponse.json() as { queryType: string; user: { userId: string } }
    expect(prefixedEmailLookupResponse.status).toBe(200)
    expect(prefixedEmailLookupPayload).toMatchObject({ queryType: "email", user: { userId: "usr_prefixed" } })

    const limitedResponse = await fetch(`${baseURL}/v1/ops/users/lookup?query=demo%40astra.local&limit=25`, {
      headers: { "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
    })
    const limitedPayload = await limitedResponse.json() as { resultWindow: { limit: number; returnedCount: number; hasMore: boolean } }
    expect(limitedResponse.status).toBe(200)
    expect(limitedPayload.resultWindow).toMatchObject({ limit: 1, returnedCount: 1, hasMore: false })

    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain("demo@astra.local")
    expect(serialized).not.toContain("billing@astra.local")
    expect(serialized).not.toContain("gpt-private-pro")
    expect(serialized).not.toContain("gemini-private-free")
    expect(serialized).not.toContain("Hello, world")
    expect(serialized).not.toContain("downloadUrl")
    expect(serialized).not.toContain("csv")
  })

  it("audits authorized no-match ops user lookups without raw query data", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath)

    const unauthorizedResponse = await fetch(`${baseURL}/v1/ops/users/lookup?query=missing%40astra.local`)
    expect(unauthorizedResponse.status).toBe(401)

    const noMatchResponse = await fetch(`${baseURL}/v1/ops/users/lookup?query=missing%40astra.local`, {
      headers: { "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
    })
    expect(noMatchResponse.status).toBe(404)

    const auditResponse = await fetch(`${baseURL}/v1/ops/audit/summary`, {
      headers: { "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
    })
    const payload = await auditResponse.json() as {
      totalEvents: number
      byAction: Array<{ action: string; count: number }>
      recent: Array<{
        action: string
        outcome: string
        subjectUserId: string | null
        subjectEmailHash: string | null
        metadata: Record<string, string | number | boolean | null>
        privacy: { contentIncluded: boolean; contentAccess: string }
      }>
    }

    expect(auditResponse.status).toBe(200)
    expect(payload.totalEvents).toBe(2)
    expect(payload.byAction).toEqual(expect.arrayContaining([
      { action: "ops_user_lookup", count: 1 },
      { action: "ops_audit_summary_viewed", count: 1 },
    ]))
    expect(payload.recent).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: "ops_user_lookup",
        outcome: "failure",
        subjectUserId: null,
        subjectEmailHash: null,
        metadata: expect.objectContaining({
          lookupMatched: false,
          queryLength: "missing@astra.local".length,
          queryContainsAt: true,
          queryLooksLikeEmailHash: false,
          queryLooksLikeUserId: false,
        }),
        privacy: expect.objectContaining({ contentIncluded: false, contentAccess: "metadata_only" }),
      }),
    ]))
    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain("missing@astra.local")
    expect(serialized).not.toContain("demo@astra.local")
    expect(serialized).not.toContain("mirror-secret")
  })

  it("serves privacy-safe operator audit summary for support and staff actions", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath)
    const { session, deviceId } = await createSession("device-audit")
    const bundle = buildSupportBundle({
      reportId: "rpt_audit_0001",
      extensionVersion: "1.0.0",
      browser: "Chrome",
      os: "macOS",
      locale: "en-US",
      featureSurface: "settings",
      action: "diagnostics_support_report",
      issueCategory: "page_not_working",
      runtimeSurface: "options",
      hostname: "https://private.example/secret",
      timestamp: "2026-05-27T00:00:00.000Z",
      privacyMode: true,
      membershipState: "pro",
      userConsent: true,
    })

    const createResponse = await fetch(`${baseURL}/v1/support/reports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(session.sessionToken, deviceId),
      },
      body: JSON.stringify({ bundle }),
    })
    expect(createResponse.status).toBe(201)

    const unauthorizedResponse = await fetch(`${baseURL}/v1/ops/audit/summary`)
    expect(unauthorizedResponse.status).toBe(401)

    const userLookupResponse = await fetch(`${baseURL}/v1/ops/users/lookup?query=demo%40astra.local`, {
      headers: { "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
    })
    expect(userLookupResponse.status).toBe(200)

    const supportSummaryResponse = await fetch(`${baseURL}/v1/ops/support/reports/summary`, {
      headers: { "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
    })
    expect(supportSummaryResponse.status).toBe(200)

    const response = await fetch(`${baseURL}/v1/ops/audit/summary`, {
      headers: { "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
    })
    const payload = await response.json() as {
      schema: string
      totalEvents: number
      retainedEventLimit: number
      byAction: Array<{ action: string; count: number }>
      byActor: Array<{ actor: string; count: number }>
      privacy: { userConsentTrueCount: number; metadataOnlyCount: number; contentIncludedCount: number }
      recent: Array<{
        actor: string
        action: string
        operatorTokenHash: string | null
        subjectUserId: string | null
        subjectEmailHash: string | null
        supportReportId: string | null
        privacy: { userConsent: boolean | null; contentIncluded: boolean; contentAccess: string }
      }>
    }

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      schema: "astra-ops-audit-summary.v1",
      totalEvents: 4,
      retainedEventLimit: 500,
      privacy: {
        userConsentTrueCount: 1,
        metadataOnlyCount: 4,
        contentIncludedCount: 0,
      },
    })
    expect(payload.byAction).toEqual(expect.arrayContaining([
      { action: "support_report_submitted", count: 1 },
      { action: "ops_user_lookup", count: 1 },
      { action: "ops_support_summary_viewed", count: 1 },
      { action: "ops_audit_summary_viewed", count: 1 },
    ]))
    expect(payload.byActor).toEqual(expect.arrayContaining([
      { actor: "operator", count: 3 },
      { actor: "user", count: 1 },
    ]))
    expect(payload.recent).toHaveLength(4)
    expect(payload.recent).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: "support_report_submitted",
        actor: "user",
        subjectUserId: "usr_demo",
        supportReportId: "rpt_audit_0001",
        operatorTokenHash: null,
        privacy: expect.objectContaining({ userConsent: true, contentIncluded: false, contentAccess: "metadata_only" }),
      }),
      expect.objectContaining({
        action: "ops_user_lookup",
        actor: "operator",
        subjectUserId: "usr_demo",
        operatorTokenHash: createHash("sha256").update("mirror-secret").digest("hex"),
        privacy: expect.objectContaining({ contentIncluded: false, contentAccess: "metadata_only" }),
      }),
    ]))

    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain("mirror-secret")
    expect(serialized).not.toContain("demo@astra.local")
    expect(serialized).not.toContain("billing@astra.local")
    expect(serialized).not.toContain("device-audit")
    expect(serialized).not.toContain("private.example")
    expect(serialized).not.toContain("secret")
  })

  it("enforces env-backed operator role permissions and audits recognized denied attempts", async () => {
    await startServer(await createUserDb(), {
      platformMirrorSecret: undefined,
      operatorPrincipals: [
        { id: "support-local", role: "support_agent", token: "support-secret" },
        { id: "privacy-local", role: "privacy_reviewer", token: "privacy-secret" },
      ],
    })

    const supportResponse = await fetch(`${baseURL}/v1/ops/support/reports/summary`, {
      headers: { "X-Astra-Operator-Token": "support-secret" },
    })
    expect(supportResponse.status).toBe(200)

    const deniedResponse = await fetch(`${baseURL}/v1/ops/cost/usage-summary`, {
      headers: { "X-Astra-Operator-Token": "support-secret" },
    })
    expect(deniedResponse.status).toBe(403)

    const unrecognizedResponse = await fetch(`${baseURL}/v1/ops/cost/usage-summary`, {
      headers: { "X-Astra-Operator-Token": "wrong-secret" },
    })
    expect(unrecognizedResponse.status).toBe(401)

    const auditResponse = await fetch(`${baseURL}/v1/ops/audit/summary`, {
      headers: { "X-Astra-Operator-Token": "privacy-secret" },
    })
    expect(auditResponse.status).toBe(200)
    const auditPayload = await auditResponse.json() as {
      totalEvents: number
      recent: Array<{ action: string; outcome: string; operatorTokenHash: string | null; metadata: Record<string, string> }>
    }
    expect(auditPayload.totalEvents).toBe(3)
    expect(auditPayload.recent).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: "ops_cost_summary_viewed",
        outcome: "denied",
        operatorTokenHash: createHash("sha256").update("support-secret").digest("hex"),
        metadata: expect.objectContaining({
          operatorId: "support-local",
          operatorRole: "support_agent",
          operatorSource: "env",
          permission: "usage_summary:view",
        }),
      }),
    ]))
    const serialized = JSON.stringify(auditPayload)
    expect(serialized).not.toContain("support-secret")
    expect(serialized).not.toContain("privacy-secret")
    expect(serialized).not.toContain("wrong-secret")
  })

  it("does not overwrite an invalid retained ops audit log", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath)
    await writeFile(env.opsAuditLogPath ?? "", "not-json")

    const response = await fetch(`${baseURL}/v1/ops/audit/summary`, {
      headers: { "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
    })

    expect(response.status).toBe(400)
    await expect(readFile(env.opsAuditLogPath ?? "", "utf8")).resolves.toBe("not-json")
  })

  it("lets operators list and triage metadata-only support reports", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath)
    const { session, deviceId } = await createSession("device-support-triage")
    const bundle = buildSupportBundle({
      reportId: "rpt_support_triage_0001",
      extensionVersion: "1.0.0",
      browser: "Chrome",
      os: "macOS",
      locale: "en-US",
      featureSurface: "library",
      action: "report_library_source",
      issueCategory: "review_library",
      hostname: "https://library.example/source",
      timestamp: "2026-05-27T00:00:00.000Z",
      privacyMode: true,
      membershipState: "free",
      userConsent: true,
    })

    const createResponse = await fetch(`${baseURL}/v1/support/reports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(session.sessionToken, deviceId),
      },
      body: JSON.stringify({ bundle }),
    })
    expect(createResponse.status).toBe(201)

    const operatorHeaders = {
      "Content-Type": "application/json",
      "X-Astra-Operator-Token": env.platformMirrorSecret ?? "",
    }
    const listResponse = await fetch(`${baseURL}/v1/ops/support/reports`, {
      headers: { "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
    })
    const listPayload = await listResponse.json() as {
      schema: string
      reports: Array<{
        reportId: string
        ownerEmail: string
        featureSurface: string
        hostname: string | null
        triage: { status: string; priority: string; assignedTo: string | null }
      }>
    }
    expect(listResponse.status).toBe(200)
    expect(listPayload).toMatchObject({
      schema: "astra-support-report-inbox.v1",
      reports: [expect.objectContaining({
        reportId: "rpt_support_triage_0001",
        ownerEmail: env.loginEmail,
        featureSurface: "library",
        hostname: "library.example",
        triage: expect.objectContaining({ status: "new", priority: "normal", assignedTo: null }),
      })],
    })

    const triageResponse = await fetch(`${baseURL}/v1/ops/support/reports/rpt_support_triage_0001/triage`, {
      method: "PATCH",
      headers: operatorHeaders,
      body: JSON.stringify({
        status: "investigating",
        priority: "high",
        assignedTo: "support@astra.local",
        updatedBy: "ops-test",
      }),
    })
    const triagePayload = await triageResponse.json() as {
      report: { triage: { status: string; priority: string; assignedTo: string | null; updatedBy: string | null; updatedAt: string | null } }
    }
    expect(triageResponse.status).toBe(200)
    expect(triagePayload.report.triage).toMatchObject({
      status: "investigating",
      priority: "high",
      assignedTo: "support@astra.local",
      updatedBy: "ops-test",
    })
    expect(triagePayload.report.triage.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    const summaryResponse = await fetch(`${baseURL}/v1/ops/support/reports/summary`, {
      headers: { "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
    })
    const summary = await summaryResponse.json() as { buckets: Array<{ triageStatus: string }> }
    expect(summary.buckets[0]).toMatchObject({ triageStatus: "investigating" })
  })

  it("links metadata support reports to matching known issues", async () => {
    await startServer(await createUserDb())
    const knownIssue = {
      issueId: "issue_youtube_subtitles_beta",
      status: "workaround" as const,
      featureSurface: "video" as const,
      issueCategory: "video_subtitles" as const,
      hostname: "youtube.com",
      affectedVersions: ["1.0.0"],
      firstSeenAt: "2026-05-27T00:00:00.000Z",
      updatedAt: "2026-05-27T01:00:00.000Z",
      workaroundKey: "try_transcript_panel",
    }

    const putResponse = await fetch(`${baseURL}/v1/ops/support/known-issues`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Astra-Operator-Token": env.platformMirrorSecret ?? "",
      },
      body: JSON.stringify({ issues: [knownIssue] }),
    })
    expect(putResponse.status).toBe(200)

    const listResponse = await fetch(`${baseURL}/v1/support/known-issues`)
    const listPayload = await listResponse.json() as { schema: string; issues: unknown[] }
    expect(listResponse.status).toBe(200)
    expect(listPayload).toMatchObject({ schema: "astra-known-issues.v1", issues: [knownIssue] })

    const { session, deviceId } = await createSession("device-known-issue")
    const bundle = buildSupportBundle({
      reportId: "rpt_known_issue_0001",
      extensionVersion: "1.0.0",
      browser: "Chrome",
      os: "macOS",
      locale: "en-US",
      featureSurface: "video",
      action: "report_this_video",
      issueCategory: "video_subtitles",
      hostname: "https://www.youtube.com/watch?v=demo",
      timestamp: "2026-05-27T02:00:00.000Z",
      privacyMode: true,
      membershipState: "free",
      userConsent: true,
    })
    const createResponse = await fetch(`${baseURL}/v1/support/reports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(session.sessionToken, deviceId),
      },
      body: JSON.stringify({ bundle }),
    })
    const createPayload = await createResponse.json() as { report: { knownIssue: typeof knownIssue | null } }
    expect(createResponse.status).toBe(201)
    expect(createPayload.report.knownIssue).toMatchObject({
      issueId: "issue_youtube_subtitles_beta",
      status: "workaround",
      workaroundKey: "try_transcript_panel",
    })

    const updatedKnownIssue = { ...knownIssue, status: "monitoring" as const, updatedAt: "2026-05-27T02:30:00.000Z" }
    const updateIssueResponse = await fetch(`${baseURL}/v1/ops/support/known-issues`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Astra-Operator-Token": env.platformMirrorSecret ?? "",
      },
      body: JSON.stringify({ issues: [updatedKnownIssue] }),
    })
    expect(updateIssueResponse.status).toBe(200)

    const laterBundle = buildSupportBundle({
      ...bundle,
      reportId: "rpt_known_issue_0002",
      timestamp: "2026-05-27T03:00:00.000Z",
    })
    const laterCreateResponse = await fetch(`${baseURL}/v1/support/reports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(session.sessionToken, deviceId),
      },
      body: JSON.stringify({ bundle: laterBundle }),
    })
    expect(laterCreateResponse.status).toBe(201)

    const summaryResponse = await fetch(`${baseURL}/v1/ops/support/reports/summary`, {
      headers: { "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
    })
    const summary = await summaryResponse.json() as {
      buckets: Array<{ count: number; knownIssueId: string | null; knownIssueStatus: string | null }>
      weeklyTopIssues: Array<{ weekStart: string; reportCount: number; knownIssueId: string | null; knownIssueStatus: string | null }>
    }
    expect(summary.buckets[0]).toMatchObject({
      count: 2,
      knownIssueId: "issue_youtube_subtitles_beta",
      knownIssueStatus: "monitoring",
    })
    expect(summary.weeklyTopIssues[0]).toMatchObject({
      weekStart: getUtcWeekStartDate(),
      reportCount: 2,
      knownIssueId: "issue_youtube_subtitles_beta",
      knownIssueStatus: "monitoring",
    })
  })

  it("serves and updates remote feature-flag runtime through operator-protected ops endpoint", async () => {
    await startServer(await createUserDb())

    const initialResponse = await fetch(`${baseURL}/v1/ops/feature-flags`)
    const initialPayload = await initialResponse.json() as {
      schema: string
      overrides: unknown[]
      killSwitches: unknown[]
      changeLog: unknown[]
    }
    expect(initialResponse.status).toBe(200)
    expect(initialPayload).toMatchObject({
      schema: "astra-feature-flag-runtime.v1",
      overrides: [],
      killSwitches: [],
      changeLog: [],
    })

    const unauthorizedResponse = await fetch(`${baseURL}/v1/ops/feature-flags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ overrides: [] }),
    })
    const unauthorizedPayload = await unauthorizedResponse.json() as { error: { code: string } }
    expect(unauthorizedResponse.status).toBe(401)
    expect(unauthorizedPayload.error.code).toBe("SESSION_REQUIRED")

    const runtime = {
      generatedAt: "2026-05-27T12:00:00.000Z",
      overrides: [{
        key: "emergency.disable_managed_ai",
        status: "kill",
        reason: "managed AI incident",
        changedBy: "ops",
        changedAt: "2026-05-27T12:00:00.000Z",
      }],
      killSwitches: [{
        id: "remote-managed-ai-off",
        category: "feature",
        enabled: true,
        featureKey: "emergency.disable_managed_ai",
        reason: "managed AI incident",
        fallbackMessage: "Astra is temporarily using a simpler mode.",
      }],
    }
    const updateResponse = await fetch(`${baseURL}/v1/ops/feature-flags`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Astra-Operator-Token": env.platformMirrorSecret ?? "",
      },
      body: JSON.stringify(runtime),
    })
    const updated = await updateResponse.json() as typeof runtime & {
      schema: string
      changeLog: Array<{
        id: string
        changedAt: string
        changedBy: string
        reason: string
        overrideCount: number
        killSwitchCount: number
        previousGeneratedAt: string | null
      }>
    }
    expect(updateResponse.status).toBe(200)
    expect(updated).toMatchObject({
      schema: "astra-feature-flag-runtime.v1",
      overrides: runtime.overrides,
      killSwitches: runtime.killSwitches,
      changeLog: [expect.objectContaining({
        changedBy: "ops",
        reason: "managed AI incident",
        overrideCount: 1,
        killSwitchCount: 1,
        previousGeneratedAt: new Date(0).toISOString(),
      })],
    })
    expect(updated.changeLog[0].id).toMatch(/^ffchg_/)
    expect(updated.changeLog[0].changedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    const saved = JSON.parse(await readFile(env.featureFlagRuntimePath, "utf8")) as typeof updated
    expect(saved.overrides[0]).toMatchObject({ key: "emergency.disable_managed_ai", status: "kill" })
    expect(saved.changeLog[0]).toMatchObject({ changedBy: "ops", reason: "managed AI incident" })

    const killSwitchOnlyRuntime = {
      generatedAt: "2026-05-27T12:05:00.000Z",
      overrides: updated.overrides,
      killSwitches: [{
        id: "site-learning-off",
        category: "site",
        enabled: true,
        hostname: "video.example",
        reason: "site adapter incident",
        fallbackMessage: "Astra is limited on this site for now.",
      }, ...updated.killSwitches],
      changeLog: [{
        id: "ffdraft_site_incident",
        changedAt: "2026-05-27T12:05:00.000Z",
        changedBy: "ops-lead",
        reason: "site adapter incident",
        overrideCount: updated.overrides.length,
        killSwitchCount: updated.killSwitches.length + 1,
        previousGeneratedAt: updated.generatedAt,
      }, ...updated.changeLog],
    }
    const killSwitchOnlyResponse = await fetch(`${baseURL}/v1/ops/feature-flags`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Astra-Operator-Token": env.platformMirrorSecret ?? "",
      },
      body: JSON.stringify(killSwitchOnlyRuntime),
    })
    const killSwitchOnlyUpdated = await killSwitchOnlyResponse.json() as typeof updated
    expect(killSwitchOnlyResponse.status).toBe(200)
    expect(killSwitchOnlyUpdated.changeLog[0]).toMatchObject({
      changedBy: "ops-lead",
      reason: "site adapter incident",
      overrideCount: 1,
      killSwitchCount: 2,
      previousGeneratedAt: updated.generatedAt,
    })
    expect(killSwitchOnlyUpdated.changeLog[0].id).toMatch(/^ffchg_/)
    expect(killSwitchOnlyUpdated.changeLog.some((entry) => entry.id === "ffdraft_site_incident")).toBe(false)
  })

  it("rejects support report submission without an authenticated device session", async () => {
    await startServer(await createUserDb())
    const bundle = buildSupportBundle({
      reportId: "rpt_support_0002",
      extensionVersion: "1.0.0",
      browser: "Chrome",
      os: "macOS",
      locale: "en-US",
      featureSurface: "settings",
      action: "diagnostics_support_report",
      timestamp: "2026-05-27T00:00:00.000Z",
      privacyMode: true,
    })

    const response = await fetch(`${baseURL}/v1/support/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bundle }),
    })

    const payload = await response.json() as { error: { code: string } }
    expect(response.status).toBe(401)
    expect(payload.error.code).toBe("SESSION_REQUIRED")
  })

  it("rejects remote support reports that include user content", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-support-content")
    const bundle = buildSupportBundle({
      reportId: "rpt_support_0003",
      extensionVersion: "1.0.0",
      browser: "Chrome",
      os: "macOS",
      locale: "en-US",
      featureSurface: "settings",
      action: "diagnostics_support_report",
      timestamp: "2026-05-27T00:00:00.000Z",
      privacyMode: true,
      userConsent: true,
      userMessageIncluded: true,
      contentIncluded: { enabled: true, type: "user_note" },
    })

    const response = await fetch(`${baseURL}/v1/support/reports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(session.sessionToken, deviceId),
      },
      body: JSON.stringify({ bundle }),
    })

    const payload = await response.json() as { error: { code: string } }
    expect(response.status).toBe(400)
    expect(payload.error.code).toBe("SUPPORT_METADATA_ONLY_REQUIRED")
  })

  it("rejects unauthorized internal authenticated mirror-back requests", async () => {
    await startServer(await createUserDb())

    const response = await fetch(`${baseURL}/_internal/cloudflare/auth/issue/authenticated`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: "usr_demo",
        email: "demo@astra.local",
        device: {
          deviceId: "device-mirror-auth",
          userId: "usr_demo",
          email: "demo@astra.local",
          identityMode: "authenticated",
          label: "Mirror device",
          platform: "macos",
          browserFamily: "chrome",
          appKind: "extension",
          appVersion: "1.0.0",
          firstSeenAt: "2026-04-12T00:00:00.000Z",
          lastSeenAt: "2026-04-12T00:00:00.000Z",
          lastSyncAt: null,
          status: "active",
          updatedAt: "2026-04-12T00:00:00.000Z",
          revokedAt: null,
        },
        session: {
          sessionId: "sess_mirror_auth_unauthorized",
          userId: "usr_demo",
          email: "demo@astra.local",
          deviceId: "device-mirror-auth",
          identityMode: "authenticated",
          issuedAt: "2026-04-12T00:00:00.000Z",
          expiresAt: null,
          createdAt: "2026-04-12T00:00:00.000Z",
          lastSeenAt: "2026-04-12T00:00:00.000Z",
          lastVerifiedAt: "2026-04-12T00:00:00.000Z",
          status: "active",
          revokedAt: null,
        },
      }),
    })

    const payload = await response.json() as { error: { code: string } }
    expect(response.status).toBe(401)
    expect(payload.error.code).toBe("SESSION_REQUIRED")
  })

  it("upserts authenticated mirror-back device/session records through the internal endpoint", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath)

    const payload = {
      userId: "usr_demo",
      email: "demo@astra.local",
      device: {
        deviceId: "device-mirror-auth",
        userId: "usr_demo",
        email: "demo@astra.local",
        identityMode: "authenticated" as const,
        label: "Mirror device",
        platform: "macos",
        browserFamily: "chrome",
        appKind: "extension",
        appVersion: "1.0.0",
        firstSeenAt: "2026-04-12T00:00:00.000Z",
        lastSeenAt: "2026-04-12T00:00:00.000Z",
        lastSyncAt: null,
        status: "active" as const,
        updatedAt: "2026-04-12T00:00:00.000Z",
        revokedAt: null,
      },
      session: {
        sessionId: "sess_mirror_auth",
        userId: "usr_demo",
        email: "demo@astra.local",
        deviceId: "device-mirror-auth",
        identityMode: "authenticated" as const,
        issuedAt: "2026-04-12T00:00:00.000Z",
        expiresAt: null,
        createdAt: "2026-04-12T00:00:00.000Z",
        lastSeenAt: "2026-04-12T00:00:00.000Z",
        lastVerifiedAt: "2026-04-12T00:00:00.000Z",
        status: "active" as const,
        revokedAt: null,
      },
    }

    const sendMirror = () => fetch(`${baseURL}/_internal/cloudflare/auth/issue/authenticated`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.platformMirrorSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    expect((await sendMirror()).status).toBe(204)
    expect((await sendMirror()).status).toBe(204)

    const db = await readUserDb(userDbPath)
    expect(db.devices.filter((device) => device.deviceId === payload.device.deviceId)).toHaveLength(1)
    expect(db.sessions.filter((session) => session.sessionId === payload.session.sessionId)).toHaveLength(1)
  })

  it("upserts anonymous mirror-back user/device/session records idempotently through the internal endpoint", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath)

    const payload = {
      user: {
        id: "usr_anonmirror",
        email: "anon_mirror@astra.anonymous",
        billingEmail: "anon_mirror@astra.anonymous",
        createdAt: "2026-04-12T00:00:00.000Z",
        passwordHash: createHash("sha256").update("anon-mirror-secret").digest("hex"),
        plan: "free" as const,
        subscriptionStatus: "active" as const,
        providerEntitlements: ["openai"],
        limits: {
          dailyRequests: 200,
          dailyCharacters: 200_000,
          requestsPerMinute: 20,
        },
        usage: {
          usageDay: "2026-04-12",
          requestsToday: 0,
          charactersToday: 0,
          totalRequests: 0,
          totalCharacters: 0,
          lastRequestAt: null,
          recentRequestTimestamps: [],
          recentEvents: [],
        },
        identityMode: "anonymous" as const,
        syncPreferences: {
          reading_history: false,
          study_progress: false,
          weekly_digest: false,
        },
        installId: "install-mirror-anon",
      },
      device: {
        deviceId: "device-mirror-anon",
        userId: "usr_anonmirror",
        email: "anon_mirror@astra.anonymous",
        identityMode: "anonymous" as const,
        label: "Anonymous mirror device",
        platform: "macos",
        browserFamily: "chrome",
        appKind: "extension",
        appVersion: "1.0.0",
        firstSeenAt: "2026-04-12T00:00:00.000Z",
        lastSeenAt: "2026-04-12T00:00:00.000Z",
        lastSyncAt: null,
        status: "active" as const,
        updatedAt: "2026-04-12T00:00:00.000Z",
        revokedAt: null,
      },
      session: {
        sessionId: "sess_mirror_anon",
        userId: "usr_anonmirror",
        email: "anon_mirror@astra.anonymous",
        deviceId: "device-mirror-anon",
        identityMode: "anonymous" as const,
        issuedAt: "2026-04-12T00:00:00.000Z",
        expiresAt: null,
        createdAt: "2026-04-12T00:00:00.000Z",
        lastSeenAt: "2026-04-12T00:00:00.000Z",
        lastVerifiedAt: "2026-04-12T00:00:00.000Z",
        status: "active" as const,
        revokedAt: null,
      },
    }

    const sendMirror = () => fetch(`${baseURL}/_internal/cloudflare/auth/issue/anonymous`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.platformMirrorSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    expect((await sendMirror()).status).toBe(204)
    expect((await sendMirror()).status).toBe(204)

    const db = await readUserDb(userDbPath)
    expect(db.users.filter((user) => user.id === payload.user.id)).toHaveLength(1)
    expect(db.devices.filter((device) => device.deviceId === payload.device.deviceId)).toHaveLength(1)
    expect(db.sessions.filter((session) => session.sessionId === payload.session.sessionId)).toHaveLength(1)
  })

  it("translates providerless service-mode requests for an authenticated session and records usage", async () => {
    await startServer(await createUserDb())
    translateViaManagedProviderMock.mockResolvedValue({
      translations: ["你好"],
      metadata: {
        provider: "openai",
        model: "gpt-4.1-nano",
        serviceMode: "fast",
        route: "direct",
        attemptedRoutes: ["direct"],
        finalRoute: "direct",
        fallbackUsed: false,
        fallbackReason: "none",
      },
    })

    const { session, deviceId } = await createSession()

    const translateResponse = await fetch(`${baseURL}/v1/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.sessionToken}`,
      },
      body: JSON.stringify({
        texts: ["hello"],
        targetLang: "zh-CN",
        task: "translate",
      }),
    })

    expect(translateResponse.status).toBe(200)
    expect(await translateResponse.json()).toEqual({ translations: ["你好"] })
    expect(translateViaManagedProviderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openai",
        model: "gpt-4.1-nano",
        serviceMode: "fast",
      }),
      expect.any(Object),
    )

    const refreshResponse = await fetch(`${baseURL}/v1/auth/session`, {
      headers: authHeaders(session.sessionToken, deviceId),
    })
    const refreshed = await refreshResponse.json() as { usage: { totalRequests: number; totalCharacters: number }; quota: { remainingDailyRequests: number } }

    expect(refreshed.usage.totalRequests).toBe(1)
    expect(refreshed.usage.totalCharacters).toBe(5)
    expect(refreshed.quota.remainingDailyRequests).toBe(1999)

    const db = JSON.parse(await readFile(env.userDbPath, "utf8")) as {
      users: Array<{ usage: { recentEvents: Array<Record<string, unknown>> } }>
    }
    expect(db.users[0]?.usage.recentEvents[0]).toMatchObject({
      provider: "openai",
      model: "gpt-4.1-nano",
      serviceMode: "fast",
      task: "translate",
      textCount: 1,
      durationMs: expect.any(Number),
      taskClass: "paragraph_understanding",
      costBucket: "medium",
      cacheStatus: "disabled",
      fallbackReason: "none",
      tier: "pro",
      providerRoute: "direct",
      success: true,
    })
    expect(JSON.stringify(db.users[0]?.usage.recentEvents[0])).not.toContain("hello")
  })

  it("reroutes providerless translate through provider-health stable fallback when recent health is incident", async () => {
    await startServer(await createUserDb(undefined, {
      usage: {
        usageDay: "2026-03-25",
        requestsToday: 2,
        charactersToday: 10,
        totalRequests: 2,
        totalCharacters: 10,
        lastRequestAt: "2026-03-25T00:00:00.000Z",
        recentRequestTimestamps: [],
        recentEvents: [
          {
            timestamp: "2026-03-25T00:00:00.000Z",
            provider: "openai",
            serviceMode: "balanced",
            requestCount: 1,
            characterCount: 5,
            model: "gpt-4.1-mini",
            task: "translate",
            textCount: 1,
            taskClass: "paragraph_understanding",
            fallbackReason: "outage",
            fallbackUsed: true,
            success: false,
          },
          {
            timestamp: "2026-03-25T00:00:01.000Z",
            provider: "openai",
            serviceMode: "balanced",
            requestCount: 1,
            characterCount: 5,
            model: "gpt-4.1-mini",
            task: "translate",
            textCount: 1,
            taskClass: "paragraph_understanding",
            fallbackReason: "none",
            fallbackUsed: false,
            success: true,
          },
        ],
        taskUsageMonth: "2026-03",
        monthlyTaskRequests: {},
      },
    }))
    translateViaManagedProviderMock.mockResolvedValue({
      translations: ["你好"],
      metadata: {
        provider: "gemini",
        model: "gemini-3.1-flash-lite-preview",
        serviceMode: "fast",
        route: "direct",
        attemptedRoutes: ["direct"],
        finalRoute: "direct",
        fallbackUsed: false,
        fallbackReason: "none",
      },
    })
    const { session } = await createSession("device-health-mitigation")

    const response = await fetch(`${baseURL}/v1/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.sessionToken}`,
      },
      body: JSON.stringify({
        texts: ["private source text ".repeat(20)],
        targetLang: "zh-CN",
        serviceMode: "balanced",
      }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ translations: ["你好"] })
    expect(translateViaManagedProviderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "gemini",
        model: "gemini-3.1-flash-lite-preview",
        serviceMode: "fast",
      }),
      expect.any(Object),
    )

    const db = JSON.parse(await readFile(env.userDbPath, "utf8")) as {
      users: Array<{ usage: { recentEvents: Array<Record<string, unknown>> } }>
    }
    const event = db.users[0]?.usage.recentEvents[0]
    expect(event).toMatchObject({
      provider: "gemini",
      model: "gemini-3.1-flash-lite-preview",
      serviceMode: "fast",
      fallbackReason: "outage",
      fallbackUsed: true,
      success: true,
    })
    expect(JSON.stringify(event)).not.toContain("private source text")
    expect(JSON.stringify(event)).not.toContain("demo@astra.local")
  })

  it("blocks managed translate when the runtime managed-AI kill switch is active", async () => {
    await startServer(await createUserDb(undefined, {
      usage: {
        usageDay: "2026-03-25",
        requestsToday: 1,
        charactersToday: 16,
        totalRequests: 1,
        totalCharacters: 16,
        lastRequestAt: "2026-03-25T00:00:00.000Z",
        recentRequestTimestamps: [],
        recentEvents: [{
          timestamp: "2026-03-25T00:00:00.000Z",
          provider: "openai",
          serviceMode: "fast",
          requestCount: 1,
          characterCount: 16,
          model: "gpt-4.1-nano",
          task: "translate",
          textCount: 1,
          taskClass: "paragraph_understanding",
          fallbackReason: "outage",
          fallbackUsed: true,
          success: false,
        }],
        taskUsageMonth: "2026-03",
        monthlyTaskRequests: {},
      },
    }))
    await writeFeatureFlagRuntime([{
      id: "ks-disable-managed-ai",
      category: "feature",
      enabled: true,
      featureKey: "emergency.disable_managed_ai",
      surface: "page",
      reason: "Emergency managed AI pause.",
      safeMode: true,
      fallbackMessage: "Astra AI is temporarily unavailable. Please try again later.",
    }])
    const { session } = await createSession("device-kill-managed")

    const response = await fetch(`${baseURL}/v1/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.sessionToken}`,
      },
      body: JSON.stringify({
        provider: "openai",
        model: "gpt-private-blocked",
        texts: ["secret page text"],
        targetLang: "zh-CN",
      }),
    })
    const payload = await response.json() as { error: { code: string; message: string } }

    expect(response.status).toBe(400)
    expect(payload.error).toEqual({
      code: "SITE_DISABLED",
      message: "Astra AI is temporarily unavailable. Please try again later.",
    })
    expect(translateViaManagedProviderMock).not.toHaveBeenCalled()

    const db = JSON.parse(await readFile(env.userDbPath, "utf8")) as {
      users: Array<{ usage: { recentEvents: Array<Record<string, unknown>> } }>
    }
    const event = db.users[0]?.usage.recentEvents[0]
    expect(event).toMatchObject({
      requestCount: 0,
      characterCount: 16,
      serviceMode: "fast",
      taskClass: "paragraph_understanding",
      costBucket: "medium",
      success: false,
      errorCode: "SITE_DISABLED",
    })
    expect(JSON.stringify(payload)).not.toContain("secret page text")
    expect(JSON.stringify(payload)).not.toContain("gpt-private-blocked")
    expect(JSON.stringify(event)).not.toContain("secret page text")
    expect(JSON.stringify(event)).not.toContain("gpt-private-blocked")
    expect(JSON.stringify(event)).not.toContain("usr_demo")
  })

  it("blocks managed translate by runtime task class before provider spend", async () => {
    await startServer(await createUserDb())
    await writeFeatureFlagRuntime([{
      id: "ks-disable-deep-reading",
      category: "task",
      enabled: true,
      featureKey: "emergency.disable_task_class",
      taskClass: "deep_reading",
      surface: "page",
      reason: "Pause long page analysis.",
      safeMode: true,
      fallbackMessage: "Long reading help is temporarily limited. Please try a shorter selection.",
    }])
    const { session } = await createSession("device-kill-task")

    const response = await fetch(`${baseURL}/v1/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.sessionToken}`,
      },
      body: JSON.stringify({ texts: ["a".repeat(12_000)], targetLang: "zh-CN" }),
    })
    const payload = await response.json() as { error: { code: string; message: string } }

    expect(response.status).toBe(400)
    expect(payload.error).toMatchObject({
      code: "SITE_DISABLED",
      message: "Long reading help is temporarily limited. Please try a shorter selection.",
    })
    expect(translateViaManagedProviderMock).not.toHaveBeenCalled()

    const db = JSON.parse(await readFile(env.userDbPath, "utf8")) as {
      users: Array<{ usage: { recentEvents: Array<Record<string, unknown>> } }>
    }
    expect(db.users[0]?.usage.recentEvents[0]).toMatchObject({
      requestCount: 0,
      characterCount: 12_000,
      taskClass: "deep_reading",
      success: false,
      errorCode: "SITE_DISABLED",
    })
  })

  it("limits free high-cost managed translate by runtime tier/task switch", async () => {
    await startServer(await createUserDb(undefined, { plan: "free" }))
    await writeFeatureFlagRuntime([{
      id: "ks-limit-free-high-cost",
      category: "tier",
      enabled: true,
      featureKey: "emergency.limit_free_high_cost",
      tier: "free",
      taskClass: "deep_reading",
      surface: "page",
      reason: "Free high-cost surge protection.",
      safeMode: true,
      fallbackMessage: "Long reading is temporarily limited for free accounts. Please try again later.",
    }])
    const { session } = await createSession("device-kill-free")

    const response = await fetch(`${baseURL}/v1/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.sessionToken}`,
      },
      body: JSON.stringify({ texts: ["b".repeat(12_000)], targetLang: "zh-CN" }),
    })
    const payload = await response.json() as { error: { code: string; message: string } }

    expect(response.status).toBe(400)
    expect(payload.error).toMatchObject({
      code: "SITE_DISABLED",
      message: "Long reading is temporarily limited for free accounts. Please try again later.",
    })
    expect(translateViaManagedProviderMock).not.toHaveBeenCalled()

    const db = JSON.parse(await readFile(env.userDbPath, "utf8")) as {
      users: Array<{ usage: { recentEvents: Array<Record<string, unknown>> } }>
    }
    expect(db.users[0]?.usage.recentEvents[0]).toMatchObject({
      requestCount: 0,
      characterCount: 12_000,
      taskClass: "deep_reading",
      tier: "free",
      success: false,
      errorCode: "SITE_DISABLED",
    })
  })

  it("degrades managed translate to fast mode when the runtime safe-mode switch is active", async () => {
    await startServer(await createUserDb())
    await writeFeatureFlagRuntime([{
      id: "ks-force-fast-mode",
      category: "task",
      enabled: true,
      featureKey: "emergency.force_fast_mode",
      surface: "page",
      reason: "Provider latency incident.",
      safeMode: true,
      fallbackMessage: "Astra is temporarily using a faster mode.",
    }])
    translateViaManagedProviderMock.mockResolvedValue({
      translations: ["你好"],
      metadata: {
        provider: "openai",
        model: "gpt-4.1-nano",
        serviceMode: "fast",
        route: "direct",
        attemptedRoutes: ["direct"],
        finalRoute: "direct",
        fallbackUsed: false,
        fallbackReason: "none",
      },
    })
    const { session } = await createSession("device-force-fast")

    const response = await fetch(`${baseURL}/v1/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.sessionToken}`,
      },
      body: JSON.stringify({
        texts: ["hello"],
        targetLang: "zh-CN",
        serviceMode: "best_quality",
      }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ translations: ["你好"] })
    expect(translateViaManagedProviderMock).toHaveBeenCalledWith(
      expect.objectContaining({ serviceMode: "fast" }),
      expect.any(Object),
    )

    const db = JSON.parse(await readFile(env.userDbPath, "utf8")) as {
      users: Array<{ usage: { recentEvents: Array<Record<string, unknown>> } }>
    }
    expect(db.users[0]?.usage.recentEvents[0]).toMatchObject({
      serviceMode: "fast",
      success: true,
    })
  })

  it("returns account, usage, account-summary, and data-export snapshots for an authenticated user", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession()

    const pushTokenResponse = await fetch(`${baseURL}/v1/account/devices/current/push-token`, {
      method: "PATCH",
      headers: { ...authHeaders(session.sessionToken, deviceId), "Content-Type": "application/json" },
      body: JSON.stringify({ expoPushToken: "ExponentPushToken[sensitive]", platform: "ios" }),
    })
    expect(pushTokenResponse.status).toBe(200)

    const [accountResponse, usageResponse, summaryResponse, exportResponse] = await Promise.all([
      fetch(`${baseURL}/v1/account`, {
        headers: {
          Authorization: `Bearer ${session.sessionToken}`,
        },
      }),
      fetch(`${baseURL}/v1/account/usage`, {
        headers: {
          Authorization: `Bearer ${session.sessionToken}`,
        },
      }),
      fetch(`${baseURL}/v1/account/summary`, {
        headers: authHeaders(session.sessionToken, deviceId),
      }),
      fetch(`${baseURL}/v1/account/export`, {
        headers: authHeaders(session.sessionToken, deviceId),
      }),
    ])

    const account = await accountResponse.json() as { id: string; billingEmail: string }
    const usage = await usageResponse.json() as { generatedAt: string; quota: { dailyRequestsLimit: number } }
    const summary = await summaryResponse.json() as {
      account: { id: string; billingEmail: string }
      usage: { quota: { dailyRequestsLimit: number } }
      session: { sessionId: string; deviceId: string; status: string }
      devices: { activeCount: number; current: { deviceId: string } | null; entries: Array<{ deviceId: string }> }
      sync: { maxMutationsPerRequest: number }
    }
    const exported = await exportResponse.json() as {
      schema: string
      account: { id: string; email: string; passwordHash?: string }
      currentSession: { sessionId: string; deviceId: string }
      devices: Array<{ deviceId: string; expoPushTokenStored: boolean; expoPushToken?: string }>
      sessions: Array<{ sessionId: string; isCurrentSession: boolean }>
      syncMutations: unknown[]
      weeklyDigests: unknown[]
      mobileRetentionEvents: unknown[]
    }

    expect(accountResponse.status).toBe(200)
    expect(account.id).toBe("usr_demo")
    expect(account.billingEmail).toBe("billing@astra.local")
    expect(usageResponse.status).toBe(200)
    expect(usage.quota.dailyRequestsLimit).toBe(2000)
    expect(typeof usage.generatedAt).toBe("string")
    expect(summaryResponse.status).toBe(200)
    expect(summary.account.id).toBe("usr_demo")
    expect(summary.account.billingEmail).toBe("billing@astra.local")
    expect(summary.usage.quota.dailyRequestsLimit).toBe(2000)
    expect(summary.session.sessionId).toBe(session.sessionId)
    expect(summary.session.deviceId).toBe(deviceId)
    expect(summary.session.status).toBe("active")
    expect(summary.devices.activeCount).toBe(1)
    expect(summary.devices.current?.deviceId).toBe(deviceId)
    expect(summary.devices.entries).toHaveLength(1)
    expect(summary.sync.maxMutationsPerRequest).toBe(200)
    expect(exportResponse.status).toBe(200)
    expect(exportResponse.headers.get("cache-control")).toBe("no-store")
    expect(exportResponse.headers.get("pragma")).toBe("no-cache")
    expect(exported.schema).toBe("astra-account-data-export.v1")
    expect(exported.account).toMatchObject({ id: "usr_demo", email: env.loginEmail })
    expect(exported.account.passwordHash).toBeUndefined()
    expect(exported.currentSession).toMatchObject({ sessionId: session.sessionId, deviceId })
    expect(exported.devices).toEqual([expect.objectContaining({ deviceId, expoPushTokenStored: true })])
    expect(exported.sessions).toEqual([expect.objectContaining({ sessionId: session.sessionId, isCurrentSession: true })])
    expect(exported.syncMutations).toEqual([])
    expect(exported.weeklyDigests).toEqual([])
    expect(exported.mobileRetentionEvents).toEqual([])
    expect(JSON.stringify(exported)).not.toContain("passwordHash")
    expect(JSON.stringify(exported)).not.toContain("ExponentPushToken")
  })

  it("updates the account plan while keeping temporary free provider access", async () => {
    await startServer(await createUserDb())
    translateViaManagedProviderMock.mockResolvedValue({
      translations: ["你好"],
      metadata: {
        provider: "openai",
        model: "gpt-5.4-nano",
        route: "direct",
        attemptedRoutes: ["direct"],
        finalRoute: "direct",
        fallbackUsed: false,
        fallbackReason: "none",
      },
    })
    const { session } = await createSession()

    const patchResponse = await fetch(`${baseURL}/v1/account/plan`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.sessionToken}`,
      },
      body: JSON.stringify({ plan: "free" }),
    })
    const patched = await patchResponse.json() as { plan: string; providerEntitlements: string[] }

    expect(patchResponse.status).toBe(200)
    expect(patched.plan).toBe("free")
    // Entitlements follow the deployment's configured provider allowlist
    // (env providerEntitlements = ["openai","gemini"]), not a hardcoded all-3.
    expect(patched.providerEntitlements).toEqual(["openai", "gemini"])

    const translateResponse = await fetch(`${baseURL}/v1/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.sessionToken}`,
      },
      body: JSON.stringify({
        provider: "gemini",
        model: "gemini-3.1-flash-lite-preview",
        texts: ["hello"],
        targetLang: "zh-CN",
      }),
    })

    const translatePayload = await translateResponse.json() as { translations: string[] }
    expect(translateResponse.status).toBe(200)
    expect(translatePayload.translations).toEqual(["你好"])
    expect(translateViaManagedProviderMock).toHaveBeenCalledTimes(1)
  })

  it("refuses a self-serve upgrade to a paid plan via a user session", async () => {
    await startServer(await createUserDb(undefined, { plan: "free" }))
    const { session } = await createSession()

    const response = await fetch(`${baseURL}/v1/account/plan`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.sessionToken}`,
      },
      body: JSON.stringify({ plan: "pro" }),
    })

    // A user session is not an operator principal — paid grants are refused, so
    // a signed-in user cannot self-grant Pro.
    expect(response.status).toBe(401)

    // The plan must remain free (no self-grant happened).
    const summaryResponse = await fetch(`${baseURL}/v1/account/summary`, {
      headers: {
        Authorization: `Bearer ${session.sessionToken}`,
        "X-Astra-Device-Id": "device-main",
      },
    })
    const summary = await summaryResponse.json() as { account: { plan: string } }
    expect(summary.account.plan).toBe("free")
  })

  it("lets an explicit operator principal grant a paid plan to a target account", async () => {
    await startServer(await createUserDb(undefined, { plan: "free" }), {
      operatorPrincipals: [{ id: "ops-grant", role: "ops_engineer", token: "ops-grant-secret" }],
    })
    await createSession()

    const response = await fetch(`${baseURL}/v1/account/plan`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Astra-Operator-Token": "ops-grant-secret",
      },
      body: JSON.stringify({ plan: "pro", email: env.loginEmail }),
    })

    expect(response.status).toBe(200)
    const account = await response.json() as { plan: string }
    expect(account.plan).toBe("pro")
  })

  it("records paid operator grants as metadata-only audit events without raw target email", async () => {
    await startServer(await createUserDb(undefined, { plan: "free" }), {
      operatorPrincipals: [{ id: "admin-grant", role: "admin", token: "admin-grant-secret" }],
    })
    await createSession()

    const targetEmail = env.loginEmail.toUpperCase()
    const response = await fetch(`${baseURL}/v1/account/plan`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Astra-Operator-Token": "admin-grant-secret",
      },
      body: JSON.stringify({ plan: "pro", email: targetEmail }),
    })
    expect(response.status).toBe(200)

    const auditResponse = await fetch(`${baseURL}/v1/ops/audit/summary`, {
      headers: { "X-Astra-Operator-Token": "admin-grant-secret" },
    })
    const auditPayload = await auditResponse.json() as {
      recent: Array<{
        action: string
        subjectUserId: string | null
        subjectEmailHash: string | null
        metadata: Record<string, string | number | boolean | null>
        privacy: { contentIncluded: boolean; contentAccess: string }
      }>
    }
    const targetHash = createHash("sha256").update(env.loginEmail.toLowerCase()).digest("hex")
    expect(auditResponse.status).toBe(200)
    expect(auditPayload.recent).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: "ops_account_plan_updated",
        subjectUserId: "usr_demo",
        subjectEmailHash: targetHash,
        metadata: expect.objectContaining({
          permission: "account_plan:grant",
          targetPlan: "pro",
          operatorId: "admin-grant",
          operatorRole: "admin",
          operatorSource: "env",
        }),
        privacy: expect.objectContaining({ contentIncluded: false, contentAccess: "metadata_only" }),
      }),
    ]))
    const serialized = JSON.stringify(auditPayload)
    expect(serialized).not.toContain(env.loginEmail)
    expect(serialized).not.toContain(targetEmail)
    expect(serialized).not.toContain("admin-grant-secret")
  })

  it("resolves a mixed-case target email for an operator grant", async () => {
    await startServer(await createUserDb(undefined, { plan: "free" }), {
      operatorPrincipals: [{ id: "ops-grant", role: "ops_engineer", token: "ops-grant-secret" }],
    })
    await createSession()

    const response = await fetch(`${baseURL}/v1/account/plan`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Astra-Operator-Token": "ops-grant-secret",
      },
      body: JSON.stringify({ plan: "pro", email: env.loginEmail.toUpperCase() }),
    })

    expect(response.status).toBe(200)
    const account = await response.json() as { plan: string }
    expect(account.plan).toBe("pro")
  })

  it("refuses a paid grant authenticated only by the legacy platform mirror secret", async () => {
    await startServer(await createUserDb(undefined, { plan: "free" }))
    await createSession()

    const response = await fetch(`${baseURL}/v1/account/plan`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Astra-Operator-Token": env.platformMirrorSecret ?? "",
      },
      body: JSON.stringify({ plan: "pro", email: env.loginEmail }),
    })

    // Legacy mirror secret may authorize other ops routes, but not paid grants.
    expect(response.status).toBe(403)
  })

  it("requires a target account email for an operator paid grant", async () => {
    await startServer(await createUserDb(), {
      operatorPrincipals: [{ id: "ops-grant", role: "ops_engineer", token: "ops-grant-secret" }],
    })
    await createSession()

    const response = await fetch(`${baseURL}/v1/account/plan`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Astra-Operator-Token": "ops-grant-secret",
      },
      body: JSON.stringify({ plan: "pro" }),
    })

    expect(response.status).toBe(400)
  })

  it("enforces monthly high-cost task allowances before provider spend", async () => {
    await startServer(await createUserDb(undefined, { plan: "free" }))
    translateViaManagedProviderMock.mockResolvedValue({
      translations: ["deep"],
      metadata: {
        provider: "openai",
        model: "gpt-4.1-nano",
        serviceMode: "fast",
        route: "direct",
        attemptedRoutes: ["direct"],
        finalRoute: "direct",
        fallbackUsed: false,
        fallbackReason: "none",
      },
    })
    const { session } = await createSession("device-high-cost-quota")
    const longText = "a".repeat(12_000)

    const first = await fetch(`${baseURL}/v1/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.sessionToken}`,
      },
      body: JSON.stringify({ texts: [longText], targetLang: "zh-CN" }),
    })
    expect(first.status).toBe(200)

    const second = await fetch(`${baseURL}/v1/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.sessionToken}`,
      },
      body: JSON.stringify({ texts: [longText], targetLang: "zh-CN" }),
    })
    const payload = await second.json() as { error: { code: string; message: string } }

    expect(second.status).toBe(429)
    expect(payload.error.code).toBe("QUOTA_EXCEEDED")
    expect(payload.error.message).toContain("monthly allowance exceeded")
    expect(translateViaManagedProviderMock).toHaveBeenCalledTimes(1)

    const db = JSON.parse(await readFile(env.userDbPath, "utf8")) as {
      users: Array<{ usage: { monthlyTaskRequests: Record<string, number>; recentEvents: Array<Record<string, unknown>> } }>
    }
    expect(db.users[0]?.usage.monthlyTaskRequests.deep_reading).toBe(1)
    expect(db.users[0]?.usage.recentEvents).toHaveLength(1)
  })

  it("records provider failures as metadata-only decision events without incrementing quota", async () => {
    await startServer(await createUserDb())
    const { AstraError } = await import("../types/translation")
    translateViaManagedProviderMock.mockRejectedValue(new AstraError("PROVIDER_REQUEST_FAILED", "provider timeout"))
    const { session } = await createSession()

    const response = await fetch(`${baseURL}/v1/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.sessionToken}`,
      },
      body: JSON.stringify({
        provider: "openai",
        model: "gpt-5.4-nano",
        texts: ["hello"],
        targetLang: "zh-CN",
      }),
    })

    expect(response.status).toBe(400)
    const db = JSON.parse(await readFile(env.userDbPath, "utf8")) as {
      users: Array<{ usage: {
        requestsToday: number
        charactersToday: number
        totalRequests: number
        totalCharacters: number
        lastRequestAt: string | null
        recentRequestTimestamps: string[]
        recentEvents: Array<Record<string, unknown>>
      } }>
    }
    expect(db.users[0]?.usage).toMatchObject({
      requestsToday: 0,
      charactersToday: 0,
      totalRequests: 0,
      totalCharacters: 0,
      lastRequestAt: null,
      recentRequestTimestamps: [],
    })
    expect(db.users[0]?.usage.recentEvents[0]).toMatchObject({
      requestCount: 0,
      characterCount: 5,
      model: "gpt-4.1-nano",
      serviceMode: "fast",
      taskClass: "paragraph_understanding",
      costBucket: "medium",
      providerRoute: "direct",
      fallbackReason: "timeout",
      fallbackUsed: true,
      success: false,
      errorCode: "PROVIDER_REQUEST_FAILED",
    })
    expect(JSON.stringify(db.users[0]?.usage.recentEvents[0])).not.toContain("hello")
  })

  it("sanitizes managed-provider configuration errors before returning them to clients", async () => {
    await startServer(await createUserDb())
    const { AstraError } = await import("../types/translation")
    translateViaManagedProviderMock.mockRejectedValue(new AstraError("CONFIG_MISSING", "OPENAI_API_KEY is not configured on the Astra relay."))
    const { session } = await createSession()

    const response = await fetch(`${baseURL}/v1/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.sessionToken}`,
      },
      body: JSON.stringify({
        provider: "openai",
        model: "gpt-5.4-nano",
        texts: ["hello"],
        targetLang: "zh-CN",
      }),
    })

    const payload = await response.json() as { error: { code: string; message: string } }
    expect(response.status).toBe(400)
    expect(payload.error).toEqual({
      code: "CONFIG_MISSING",
      message: "Sign in to use Astra AI, or try again after Astra reconnects.",
    })
    expect(JSON.stringify(payload)).not.toContain("OPENAI_API_KEY")
    expect(JSON.stringify(payload)).not.toContain("relay")
  })

  it("rejects translate requests when the per-minute limit is exhausted", async () => {
    await startServer(await createUserDb({ requestsPerMinute: 0 }))
    const { session } = await createSession()

    const response = await fetch(`${baseURL}/v1/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.sessionToken}`,
      },
      body: JSON.stringify({
        provider: "openai",
        model: "gpt-5.4-nano",
        texts: ["hello"],
        targetLang: "zh-CN",
      }),
    })

    const payload = await response.json() as { error: { message: string } }
    expect(response.status).toBe(400)
    expect(payload.error.message).toContain("Rate limit exceeded")
    expect(translateViaManagedProviderMock).not.toHaveBeenCalled()
  })

  it("creates, updates, lists, and cancels metadata-only long-running task lifecycle records", async () => {
    await startServer(await createUserDb(), {
      operatorPrincipals: [{ id: "ops-engineer", role: "ops_engineer", token: "ops-token" }],
    })
    const { session, deviceId } = await createSession("device-long-task")

    const create = await fetch(`${baseURL}/v1/long-tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(session.sessionToken, deviceId),
      },
      body: JSON.stringify({
        clientRequestId: "client-long-task-api-001",
        taskClass: "deep_reading",
        category: "long_pdf",
        surface: "file",
        source: {
          type: "pdf",
          sourceFingerprint: "sha256:api-pdf-001",
          hostname: null,
          lengthBucket: "very_long",
        },
        retryHints: {
          retryable: true,
          attempt: 0,
          maxAttempts: 3,
          fallbackReason: "none",
          degradePath: "background_finish",
          fallbackAllowed: true,
        },
      }),
    })
    expect(create.status).toBe(202)
    const createdPayload = await create.json() as {
      task: { taskId: string; status: string; privacy: { metadataOnly: boolean; contentIncluded: boolean; rawSourceIncluded: boolean } }
    }
    expect(createdPayload.task.status).toBe("queued")
    expect(createdPayload.task.privacy).toMatchObject({
      metadataOnly: true,
      contentIncluded: false,
      rawSourceIncluded: false,
    })

    const duplicateCreate = await fetch(`${baseURL}/v1/long-tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(session.sessionToken, deviceId),
      },
      body: JSON.stringify({
        clientRequestId: "client-long-task-api-001",
        taskClass: "deep_reading",
        category: "long_pdf",
        surface: "file",
        source: {
          type: "pdf",
          sourceFingerprint: "sha256:api-pdf-001",
          hostname: null,
          lengthBucket: "very_long",
        },
      }),
    })
    expect(duplicateCreate.status).toBe(202)
    const duplicateCreatePayload = await duplicateCreate.json() as { task: { taskId: string } }
    expect(duplicateCreatePayload.task.taskId).toBe(createdPayload.task.taskId)

    const opsPatch = await fetch(`${baseURL}/v1/ops/long-tasks/${createdPayload.task.taskId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Astra-Operator-Token": "ops-token",
      },
      body: JSON.stringify({
        status: "partial",
        progress: { stage: "summarizing", completedUnits: 2, totalUnits: 4, percent: 50 },
        partialResult: {
          available: true,
          kind: "chapter_summary",
          completedUnits: 2,
          totalUnits: 4,
          itemCount: 2,
          artifactRef: "partial:api-chapter-summary-001",
          cacheStatus: "partial",
        },
        retryHints: {
          retryable: true,
          attempt: 1,
          maxAttempts: 3,
          retryAfterSeconds: 60,
          fallbackReason: "timeout",
          degradePath: "partial_result",
          fallbackAllowed: true,
        },
      }),
    })
    expect(opsPatch.status).toBe(200)
    const patchedPayload = await opsPatch.json() as {
      task: {
        status: string
        progress: { percent: number | null }
        partialResult: { available: boolean; kind: string | null; itemCount: number; updatedAt: string | null }
        retryHints: { fallbackReason: string; degradePath: string }
      }
    }
    expect(patchedPayload.task.status).toBe("partial")
    expect(patchedPayload.task.progress.percent).toBe(50)
    expect(patchedPayload.task.partialResult).toMatchObject({
      available: true,
      kind: "chapter_summary",
      itemCount: 2,
    })
    expect(patchedPayload.task.partialResult.updatedAt).toBeTruthy()
    expect(patchedPayload.task.retryHints).toMatchObject({ fallbackReason: "timeout", degradePath: "partial_result" })

    const status = await fetch(`${baseURL}/v1/long-tasks/${createdPayload.task.taskId}`, {
      headers: authHeaders(session.sessionToken, deviceId),
    })
    expect(status.status).toBe(200)
    const statusPayload = await status.json() as { task: { taskId: string; status: string; partialResult: { available: boolean } } }
    expect(statusPayload.task).toMatchObject({
      taskId: createdPayload.task.taskId,
      status: "partial",
      partialResult: { available: true },
    })

    const list = await fetch(`${baseURL}/v1/long-tasks`, {
      headers: authHeaders(session.sessionToken, deviceId),
    })
    expect(list.status).toBe(200)
    const listPayload = await list.json() as { tasks: Array<{ taskId: string }> }
    expect(listPayload.tasks.map((task) => task.taskId)).toContain(createdPayload.task.taskId)

    const opsList = await fetch(`${baseURL}/v1/ops/long-tasks?limit=5`, {
      headers: { "X-Astra-Operator-Token": "ops-token" },
    })
    expect(opsList.status).toBe(200)
    const opsListPayload = await opsList.json() as { tasks: Array<Record<string, unknown>> }
    expect(opsListPayload.tasks[0]).toEqual(expect.objectContaining({
      ownerEmailHash: expect.any(String),
      deviceIdHash: expect.any(String),
      status: "partial",
    }))
    expect(JSON.stringify(opsListPayload)).not.toMatch(/demo@astra\.local|device-long-task(?!.*Hash)|https:\/\/|private\.example/i)

    const cancel = await fetch(`${baseURL}/v1/long-tasks/${createdPayload.task.taskId}/cancel`, {
      method: "POST",
      headers: authHeaders(session.sessionToken, deviceId),
    })
    expect(cancel.status).toBe(200)
    const canceledPayload = await cancel.json() as {
      task: {
        status: string
        canceledAt: string | null
        retryHints: { retryable: boolean; fallbackAllowed: boolean }
        error: { code: string; retryable: boolean } | null
      }
    }
    expect(canceledPayload.task.status).toBe("canceled")
    expect(canceledPayload.task.canceledAt).toBeTruthy()
    expect(canceledPayload.task.retryHints).toMatchObject({ retryable: false, fallbackAllowed: false })
    expect(canceledPayload.task.error).toMatchObject({ code: "USER_CANCELED", retryable: false })

    const deleteAccount = await fetch(`${baseURL}/v1/account`, {
      method: "DELETE",
      headers: authHeaders(session.sessionToken, deviceId),
    })
    expect(deleteAccount.status).toBe(204)
    const retainedLongTasks = JSON.parse(await readFile(env.longRunningTaskStorePath!, "utf8")) as { tasks: unknown[] }
    expect(retainedLongTasks.tasks).toHaveLength(0)
  })

  it("rejects unsafe long-running task payloads and anonymous lifecycle creation", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-long-task-unsafe")

    const unsafe = await fetch(`${baseURL}/v1/long-tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(session.sessionToken, deviceId),
      },
      body: JSON.stringify({
        taskClass: "deep_reading",
        category: "long_pdf",
        surface: "file",
        rawSourceUrl: "https://private.example/file.pdf?token=secret",
        source: {
          type: "pdf",
          sourceFingerprint: "sha256:unsafe-pdf-001",
          hostname: null,
          lengthBucket: "very_long",
        },
      }),
    })
    expect(unsafe.status).toBe(400)
    const unsafePayload = await unsafe.json() as { error: { code: string; message: string } }
    expect(unsafePayload.error.code).toBe("UNKNOWN")
    expect(unsafePayload.error.message).not.toContain("private.example")

    await writeFile(env.longRunningTaskStorePath!, "not-json")
    const unavailable = await fetch(`${baseURL}/v1/long-tasks`, {
      headers: authHeaders(session.sessionToken, deviceId),
    })
    expect(unavailable.status).toBe(503)
    const unavailablePayload = await unavailable.json() as { error: { message: string } }
    expect(unavailablePayload.error.message).toBe("Long-running task metadata is temporarily unavailable.")
    expect(unavailablePayload.error.message).not.toContain(env.longRunningTaskStorePath!)

    const anonymousAuth = await fetch(`${baseURL}/v1/auth/anonymous`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "anon-long-task" }),
    })
    expect(anonymousAuth.status).toBe(200)
    const anonymousSession = await anonymousAuth.json() as { sessionToken: string; deviceId: string }

    const anonymousCreate = await fetch(`${baseURL}/v1/long-tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(anonymousSession.sessionToken, anonymousSession.deviceId),
      },
      body: JSON.stringify({
        taskClass: "video_summary",
        category: "long_video",
        surface: "video",
        source: { type: "video", sourceFingerprint: "sha256:video-anon-001", hostname: "youtube.com", lengthBucket: "long" },
      }),
    })
    expect(anonymousCreate.status).toBe(403)
    const anonymousPayload = await anonymousCreate.json() as { error: { code: string } }
    expect(anonymousPayload.error.code).toBe("AUTH_REQUIRED")
  })

  it("creates, dedupes, and serves a structured video-note artifact when capture is provided", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-video-note")

    const requestBody = {
      sourceUrl: "https://www.youtube.com/watch?v=demo123",
      platformHint: "youtube",
      sourceTitle: "Demo video",
      capture: {
        language: "en",
        deepLinkTemplate: "https://www.youtube.com/watch?v=demo123&t={startSeconds}s",
        durationSec: 120,
        transcriptSegments: [
          { startMs: 0, endMs: 2500, text: "Hello and welcome to the demo video." },
          { startMs: 3000, endMs: 6200, text: "We are testing the relay video note scaffold." },
          { startMs: 7000, endMs: 11200, text: "The backend already has create, status, and artifact routes wired up." },
          { startMs: 14000, endMs: 18200, text: "Now we want transcript-backed notes to feel structured and useful instead of skeletal." },
          { startMs: 21000, endMs: 25200, text: "The next step after this will be URL-only subtitle acquisition for supported platforms." },
        ],
        learningContext: {
          videoMetadata: { title: "Demo video", sourceUrl: "https://www.youtube.com/watch?v=demo123", platform: "youtube", durationSec: 120 },
          bilingualTranscriptSegments: [
            { startMs: 0, endMs: 2500, text: "Hello and welcome to the demo video.", translation: "欢迎观看演示视频。" },
          ],
          summary: "A concise summary generated from the transcript.",
          savedSentences: [{ text: "Hello and welcome to the demo video.", translation: "欢迎观看演示视频。", timestampMs: 0, sourceSentence: "Hello and welcome to the demo video." }],
          savedWords: [{ text: "scaffold", explanation: "A temporary support structure.", timestampMs: 3000, sourceSentence: "We are testing the relay video note scaffold." }],
          watchProgress: { currentTimeSec: 42, durationSec: 120, percent: 35 },
          reviewStatus: { savedSentenceCount: 1, savedWordCount: 1, reviewReady: true },
        },
      },
    }

    const create = await fetch(`${baseURL}/v1/video-notes/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(session.sessionToken, deviceId),
      },
      body: JSON.stringify(requestBody),
    })
    expect(create.status).toBe(202)
    const createdPayload = await create.json() as {
      deduped: boolean
      job: { jobId: string; status: string }
    }
    expect(createdPayload.deduped).toBe(false)
    expect(createdPayload.job.status).toBe("queued")

    const duplicate = await fetch(`${baseURL}/v1/video-notes/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(session.sessionToken, deviceId),
      },
      body: JSON.stringify(requestBody),
    })
    expect(duplicate.status).toBe(202)
    const duplicatePayload = await duplicate.json() as {
      deduped: boolean
      job: { jobId: string }
    }
    expect(duplicatePayload.deduped).toBe(true)
    expect(duplicatePayload.job.jobId).toBe(createdPayload.job.jobId)

    const job = await waitForVideoNoteTerminalStatus(createdPayload.job.jobId, session.sessionToken, deviceId)
    expect(job.status).toBe("completed")

    const artifactResponse = await fetch(`${baseURL}/v1/video-notes/jobs/${createdPayload.job.jobId}/artifact`, {
      headers: authHeaders(session.sessionToken, deviceId),
    })
    expect(artifactResponse.status).toBe(200)
    const artifactPayload = await artifactResponse.json() as {
      job: { status: string }
      artifact: { title: string | null; transcriptSegments: Array<{ text: string }>; markdown: string; learningContext?: unknown }
    }
    expect(artifactPayload.job.status).toBe("completed")
    expect(artifactPayload.artifact.title).toBe("Demo video")
    expect(artifactPayload.artifact.transcriptSegments).toHaveLength(5)
    expect(artifactPayload.artifact.markdown).toContain("## Summary")
    expect(artifactPayload.artifact.markdown).toContain("## Key takeaways")
    expect(artifactPayload.artifact.markdown).toContain("## Section notes")
    expect(artifactPayload.artifact.markdown).toContain("## Key moments")
    expect(artifactPayload.artifact.markdown).toContain("## Video metadata")
    expect(artifactPayload.artifact.markdown).toContain("## Transcript")
    expect(artifactPayload.artifact.markdown).toContain("## Bilingual transcript")
    expect(artifactPayload.artifact.markdown).toContain("欢迎观看演示视频")
    expect(artifactPayload.artifact.markdown).toContain("## Saved sentences")
    expect(artifactPayload.artifact.markdown).toContain("## Saved words")
    expect(artifactPayload.artifact.markdown).toContain("## Watch progress")
    expect(artifactPayload.artifact.markdown).toContain("42s / 120s (35%)")
    expect(artifactPayload.artifact.markdown).toContain("## Review status")
    expect(artifactPayload.artifact.learningContext).toEqual(expect.objectContaining({
      summary: "A concise summary generated from the transcript.",
      reviewStatus: expect.objectContaining({ reviewReady: true }),
    }))
    expect(artifactPayload.artifact.markdown).toContain("[00:00](https://www.youtube.com/watch?v=demo123&t=0s)")
    expect(artifactPayload.artifact.markdown).not.toContain("Skeleton video-note artifact")
    expect(artifactPayload.artifact.markdown).toContain("Demo video")
  })

  it("creates, dedupes, and completes a YouTube URL-only video-note job via server-side subtitles", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-video-note-youtube-url")
    const nativeFetch = globalThis.fetch.bind(globalThis)
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = toFetchUrl(input)
      if (url === "https://www.youtube.com/watch?v=demo123") {
        expect(init?.signal).toBeInstanceOf(AbortSignal)
        return new Response(buildYouTubeWatchHtml({
          title: "Server-side YouTube note",
          lengthSeconds: 93,
          captionTracks: [
            {
              baseUrl: "https://www.youtube.com/api/timedtext?v=demo123&lang=en&fmt=srv3",
              languageCode: "en",
              kind: "standard",
              isTranslatable: true,
            },
          ],
        }), { status: 200, headers: { "Content-Type": "text/html" } })
      }
      if (url.startsWith("https://www.youtube.com/api/timedtext?v=demo123")) {
        expect(init?.signal).toBeInstanceOf(AbortSignal)
        return new Response(timedTextJson([
          { startMs: 0, durationMs: 2500, text: "Hello and welcome to the server-side note demo." },
          { startMs: 4000, durationMs: 3200, text: "The relay can fetch YouTube subtitles even without extension capture." },
          { startMs: 9000, durationMs: 3600, text: "Next we can build more URL-only subtitle acquisition on top of this path." },
        ]), { status: 200, headers: { "Content-Type": "application/json" } })
      }
      return nativeFetch(input, init)
    })

    try {
      const firstRequest = {
        sourceUrl: "https://youtu.be/demo123?si=share-token",
        platformHint: "bilibili",
      }

      const create = await fetch(`${baseURL}/v1/video-notes/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(session.sessionToken, deviceId),
        },
        body: JSON.stringify(firstRequest),
      })
      expect(create.status).toBe(202)
      const createdPayload = await create.json() as {
        deduped: boolean
        job: { jobId: string; status: string; platform: string; sourceUrl: string }
      }
      expect(createdPayload.deduped).toBe(false)
      expect(createdPayload.job.status).toBe("queued")
      expect(createdPayload.job.platform).toBe("youtube")
      expect(createdPayload.job.sourceUrl).toBe("https://www.youtube.com/watch?v=demo123")

      const duplicate = await fetch(`${baseURL}/v1/video-notes/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(session.sessionToken, deviceId),
        },
        body: JSON.stringify({
          sourceUrl: "https://www.youtube.com/watch?v=demo123&list=PL123&t=30s",
        }),
      })
      expect(duplicate.status).toBe(202)
      const duplicatePayload = await duplicate.json() as {
        deduped: boolean
        job: { jobId: string }
      }
      expect(duplicatePayload.deduped).toBe(true)
      expect(duplicatePayload.job.jobId).toBe(createdPayload.job.jobId)

      const job = await waitForVideoNoteTerminalStatus(createdPayload.job.jobId, session.sessionToken, deviceId)
      expect(job.status).toBe("completed")

      const artifactResponse = await fetch(`${baseURL}/v1/video-notes/jobs/${createdPayload.job.jobId}/artifact`, {
        headers: authHeaders(session.sessionToken, deviceId),
      })
      expect(artifactResponse.status).toBe(200)
      const artifactPayload = await artifactResponse.json() as {
        job: { status: string; platform: string; title: string | null; transcriptSource: string | null }
        artifact: {
          title: string | null
          transcriptSource: string | null
          transcriptLanguage: string | null
          transcriptSegments: Array<{ text: string }>
          markdown: string
          deepLinkTemplate: string | null
          durationSec: number | null
        }
      }
      expect(artifactPayload.job.status).toBe("completed")
      expect(artifactPayload.job.platform).toBe("youtube")
      expect(artifactPayload.job.title).toBe("Server-side YouTube note")
      expect(artifactPayload.job.transcriptSource).toBe("platform_subtitles")
      expect(artifactPayload.artifact.title).toBe("Server-side YouTube note")
      expect(artifactPayload.artifact.transcriptSource).toBe("platform_subtitles")
      expect(artifactPayload.artifact.transcriptLanguage).toBe("en")
      expect(artifactPayload.artifact.transcriptSegments).toHaveLength(3)
      expect(artifactPayload.artifact.deepLinkTemplate).toBe("https://www.youtube.com/watch?v=demo123&t={startSeconds}s")
      expect(artifactPayload.artifact.durationSec).toBe(93)
      expect(artifactPayload.artifact.markdown).toContain("## Summary")
      expect(artifactPayload.artifact.markdown).toContain("[00:00](https://www.youtube.com/watch?v=demo123&t=0s)")
      expect(artifactPayload.artifact.markdown).toContain("server-side note")
    } finally {
      fetchMock.mockRestore()
    }
  })

  it("completes a YouTube URL-only video-note job via backend transcription fallback when subtitles are unavailable", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-video-note-youtube-transcription")
    const nativeFetch = globalThis.fetch.bind(globalThis)
    let resolveTranscriptionResponse: ((value: Response) => void) | null = null
    const transcriptionResponse = new Promise<Response>((resolve) => {
      resolveTranscriptionResponse = resolve
    })
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = toFetchUrl(input)
      if (url === "https://www.youtube.com/watch?v=transcribe123") {
        expect(init?.signal).toBeInstanceOf(AbortSignal)
        return new Response(buildYouTubeWatchHtml({
          title: "Backend transcription note",
          lengthSeconds: 64,
          captionTracks: [],
          streamingFormats: [{
            url: "https://rr1---sn-demo.googlevideo.com/videoplayback?id=transcribe123",
            mimeType: 'audio/mp4; codecs="mp4a.40.2"',
            bitrate: 128000,
          }],
        }), { status: 200, headers: { "Content-Type": "text/html" } })
      }
      if (url === "https://rr1---sn-demo.googlevideo.com/videoplayback?id=transcribe123") {
        expect(init?.signal).toBeInstanceOf(AbortSignal)
        return new Response(new Uint8Array([0, 1, 2, 3]), {
          status: 200,
          headers: { "Content-Type": "audio/mp4" },
        })
      }
      if (url === "https://api.openai.com/v1/audio/transcriptions") {
        expect(init?.method).toBe("POST")
        expect(init?.signal).toBeInstanceOf(AbortSignal)
        expect(init?.body instanceof FormData).toBe(true)
        const formData = init?.body as FormData
        expect(formData.get("model")).toBe("whisper-1")
        expect(formData.get("response_format")).toBe("verbose_json")
        expect(formData.get("timestamp_granularities[]")).toBe("segment")
        return transcriptionResponse
      }
      return nativeFetch(input, init)
    })

    try {
      const create = await fetch(`${baseURL}/v1/video-notes/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(session.sessionToken, deviceId),
        },
        body: JSON.stringify({
          sourceUrl: "https://www.youtube.com/watch?v=transcribe123",
        }),
      })
      expect(create.status).toBe(202)
      const createdPayload = await create.json() as {
        job: { jobId: string }
      }

      const transcribingJob = await waitForVideoNoteJob(
        createdPayload.job.jobId,
        session.sessionToken,
        deviceId,
        (job) => job.status === "transcribing",
        `Video-note job ${createdPayload.job.jobId} did not reach transcribing status in time.`,
      )
      expect(transcribingJob.status).toBe("transcribing")
      expect(transcribingJob.transcriptSource).toBe("transcription")

      expect(resolveTranscriptionResponse).not.toBeNull()
      resolveTranscriptionResponse!(new Response(JSON.stringify({
        language: "en",
        segments: [
          { start: 0, end: 2.6, text: "Backend transcription fallback can still produce useful notes." },
          { start: 3.2, end: 6.5, text: "The relay keeps the existing subtitle-first behavior for YouTube." },
          { start: 7.1, end: 10.4, text: "When subtitles are missing, the job can continue through transcribing and finish with an artifact." },
        ],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))

      const job = await waitForVideoNoteTerminalStatus(createdPayload.job.jobId, session.sessionToken, deviceId)
      expect(job.status).toBe("completed")
      expect(job.transcriptSource).toBe("transcription")

      const artifactResponse = await fetch(`${baseURL}/v1/video-notes/jobs/${createdPayload.job.jobId}/artifact`, {
        headers: authHeaders(session.sessionToken, deviceId),
      })
      expect(artifactResponse.status).toBe(200)
      const artifactPayload = await artifactResponse.json() as {
        job: { status: string; title: string | null; transcriptSource: string | null }
        artifact: {
          title: string | null
          transcriptSource: string | null
          transcriptLanguage: string | null
          transcriptSegments: Array<{ text: string }>
          deepLinkTemplate: string | null
          durationSec: number | null
          markdown: string
        }
      }
      expect(artifactPayload.job.status).toBe("completed")
      expect(artifactPayload.job.title).toBe("Backend transcription note")
      expect(artifactPayload.job.transcriptSource).toBe("transcription")
      expect(artifactPayload.artifact.title).toBe("Backend transcription note")
      expect(artifactPayload.artifact.transcriptSource).toBe("transcription")
      expect(artifactPayload.artifact.transcriptLanguage).toBe("en")
      expect(artifactPayload.artifact.transcriptSegments).toHaveLength(3)
      expect(artifactPayload.artifact.deepLinkTemplate).toBe("https://www.youtube.com/watch?v=transcribe123&t={startSeconds}s")
      expect(artifactPayload.artifact.durationSec).toBe(64)
      expect(artifactPayload.artifact.markdown).toContain("## Summary")
      expect(artifactPayload.artifact.markdown).toContain("[00:00](https://www.youtube.com/watch?v=transcribe123&t=0s)")
    } finally {
      fetchMock.mockRestore()
    }
  })

  it("fails clearly when backend transcription fallback returns no transcript segments", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-video-note-youtube-transcription-empty")
    const nativeFetch = globalThis.fetch.bind(globalThis)
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = toFetchUrl(input)
      if (url === "https://www.youtube.com/watch?v=emptytranscript123") {
        expect(init?.signal).toBeInstanceOf(AbortSignal)
        return new Response(buildYouTubeWatchHtml({
          title: "Empty transcription demo",
          lengthSeconds: 52,
          captionTracks: [],
          streamingFormats: [{
            url: "https://rr2---sn-demo.googlevideo.com/videoplayback?id=emptytranscript123",
            mimeType: 'audio/mp4; codecs="mp4a.40.2"',
            bitrate: 96000,
          }],
        }), { status: 200, headers: { "Content-Type": "text/html" } })
      }
      if (url === "https://rr2---sn-demo.googlevideo.com/videoplayback?id=emptytranscript123") {
        return new Response(new Uint8Array([9, 8, 7, 6]), {
          status: 200,
          headers: { "Content-Type": "audio/mp4" },
        })
      }
      if (url === "https://api.openai.com/v1/audio/transcriptions") {
        return new Response(JSON.stringify({ language: "en", segments: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      return nativeFetch(input, init)
    })

    try {
      const create = await fetch(`${baseURL}/v1/video-notes/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(session.sessionToken, deviceId),
        },
        body: JSON.stringify({
          sourceUrl: "https://www.youtube.com/watch?v=emptytranscript123",
        }),
      })
      expect(create.status).toBe(202)
      const createdPayload = await create.json() as {
        job: { jobId: string }
      }

      const job = await waitForVideoNoteTerminalStatus(createdPayload.job.jobId, session.sessionToken, deviceId)
      expect(job.status).toBe("failed")
      expect(job.transcriptSource).toBe("transcription")
      expect(job.error?.code).toBe("SUBTITLE_UNAVAILABLE")
      expect(job.error?.message).toContain("backend transcription fallback could not produce transcript segments")
      expect(job.error?.message).toContain("did not return any usable transcript segments")
    } finally {
      fetchMock.mockRestore()
    }
  })

  it("fails clearly when backend transcription fallback resolves a blocked audio host", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-video-note-youtube-blocked-host")
    const nativeFetch = globalThis.fetch.bind(globalThis)
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = toFetchUrl(input)
      if (url === "https://www.youtube.com/watch?v=blockedhost123") {
        return new Response(buildYouTubeWatchHtml({
          title: "Blocked host demo",
          lengthSeconds: 38,
          captionTracks: [],
          streamingFormats: [{
            url: "https://rr-blocked---sn-demo.googlevideo.com/videoplayback?id=blockedhost123",
            mimeType: 'audio/mp4; codecs="mp4a.40.2"',
            bitrate: 128000,
          }],
        }), { status: 200, headers: { "Content-Type": "text/html" } })
      }
      if (url === "https://rr-blocked---sn-demo.googlevideo.com/videoplayback?id=blockedhost123") {
        return new Response(null, {
          status: 302,
          headers: {
            Location: "https://media.example/audio/blockedhost123.m4a",
          },
        })
      }
      return nativeFetch(input, init)
    })

    try {
      const create = await fetch(`${baseURL}/v1/video-notes/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(session.sessionToken, deviceId),
        },
        body: JSON.stringify({
          sourceUrl: "https://www.youtube.com/watch?v=blockedhost123",
        }),
      })
      expect(create.status).toBe(202)
      const createdPayload = await create.json() as {
        job: { jobId: string }
      }

      const job = await waitForVideoNoteTerminalStatus(createdPayload.job.jobId, session.sessionToken, deviceId)
      expect(job.status).toBe("failed")
      expect(job.transcriptSource).toBe("transcription")
      expect(job.error?.code).toBe("SUBTITLE_UNAVAILABLE")
      expect(job.error?.message).toContain("backend safety checks")
      expect(job.error?.message).not.toContain("media.example")
    } finally {
      fetchMock.mockRestore()
    }
  })

  it("fails clearly when backend transcription fallback audio exceeds backend size limits", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-video-note-youtube-audio-too-large")
    const nativeFetch = globalThis.fetch.bind(globalThis)
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = toFetchUrl(input)
      if (url === "https://www.youtube.com/watch?v=toolargeaudio123") {
        return new Response(buildYouTubeWatchHtml({
          title: "Large audio demo",
          lengthSeconds: 73,
          captionTracks: [],
          streamingFormats: [{
            url: "https://rr3---sn-demo.googlevideo.com/videoplayback?id=toolargeaudio123",
            mimeType: 'audio/mp4; codecs="mp4a.40.2"',
            bitrate: 128000,
          }],
        }), { status: 200, headers: { "Content-Type": "text/html" } })
      }
      if (url === "https://rr3---sn-demo.googlevideo.com/videoplayback?id=toolargeaudio123") {
        return new Response(new Uint8Array([1, 2, 3, 4]), {
          status: 200,
          headers: {
            "Content-Type": "audio/mp4",
            "Content-Length": String(500_000_000),
          },
        })
      }
      return nativeFetch(input, init)
    })

    try {
      const create = await fetch(`${baseURL}/v1/video-notes/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(session.sessionToken, deviceId),
        },
        body: JSON.stringify({
          sourceUrl: "https://www.youtube.com/watch?v=toolargeaudio123",
        }),
      })
      expect(create.status).toBe(202)
      const createdPayload = await create.json() as {
        job: { jobId: string }
      }

      const job = await waitForVideoNoteTerminalStatus(createdPayload.job.jobId, session.sessionToken, deviceId)
      expect(job.status).toBe("failed")
      expect(job.transcriptSource).toBe("transcription")
      expect(job.error?.code).toBe("SUBTITLE_UNAVAILABLE")
      expect(job.error?.message).toContain("size limits")
    } finally {
      fetchMock.mockRestore()
    }
  })

  it("sanitizes noisy upstream OpenAI transcription errors for backend transcription fallback", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-video-note-youtube-upstream-error")
    const nativeFetch = globalThis.fetch.bind(globalThis)
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = toFetchUrl(input)
      if (url === "https://www.youtube.com/watch?v=upstreamerror123") {
        return new Response(buildYouTubeWatchHtml({
          title: "Upstream error demo",
          lengthSeconds: 58,
          captionTracks: [],
          streamingFormats: [{
            url: "https://rr4---sn-demo.googlevideo.com/videoplayback?id=upstreamerror123",
            mimeType: 'audio/mp4; codecs="mp4a.40.2"',
            bitrate: 128000,
          }],
        }), { status: 200, headers: { "Content-Type": "text/html" } })
      }
      if (url === "https://rr4---sn-demo.googlevideo.com/videoplayback?id=upstreamerror123") {
        return new Response(new Uint8Array([4, 3, 2, 1]), {
          status: 200,
          headers: { "Content-Type": "audio/mp4" },
        })
      }
      if (url === "https://api.openai.com/v1/audio/transcriptions") {
        return new Response(JSON.stringify({
          error: {
            message: "Rate limit exceeded for org secret-org-123. Contact support@example.com.",
          },
        }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        })
      }
      return nativeFetch(input, init)
    })

    try {
      const create = await fetch(`${baseURL}/v1/video-notes/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(session.sessionToken, deviceId),
        },
        body: JSON.stringify({
          sourceUrl: "https://www.youtube.com/watch?v=upstreamerror123",
        }),
      })
      expect(create.status).toBe(202)
      const createdPayload = await create.json() as {
        job: { jobId: string }
      }

      const job = await waitForVideoNoteTerminalStatus(createdPayload.job.jobId, session.sessionToken, deviceId)
      expect(job.status).toBe("failed")
      expect(job.transcriptSource).toBe("transcription")
      expect(job.error?.code).toBe("SUBTITLE_UNAVAILABLE")
      expect(job.error?.message).toContain("temporarily rate limited")
      expect(job.error?.message).not.toContain("secret-org-123")
      expect(job.error?.message).not.toContain("support@example.com")
    } finally {
      fetchMock.mockRestore()
    }
  })

  it("fails a YouTube URL-only video-note job clearly when subtitles are unavailable", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-video-note-youtube-nosubs")
    const nativeFetch = globalThis.fetch.bind(globalThis)
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = toFetchUrl(input)
      if (url === "https://www.youtube.com/watch?v=nosubs123") {
        return new Response(buildYouTubeWatchHtml({
          title: "No subtitles demo",
          lengthSeconds: 41,
          captionTracks: [],
        }), { status: 200, headers: { "Content-Type": "text/html" } })
      }
      return nativeFetch(input, init)
    })

    try {
      const create = await fetch(`${baseURL}/v1/video-notes/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(session.sessionToken, deviceId),
        },
        body: JSON.stringify({
          sourceUrl: "https://www.youtube.com/watch?v=nosubs123",
        }),
      })
      expect(create.status).toBe(202)
      const createdPayload = await create.json() as {
        job: { jobId: string }
      }

      const job = await waitForVideoNoteTerminalStatus(createdPayload.job.jobId, session.sessionToken, deviceId)
      expect(job.status).toBe("failed")
      expect(job.transcriptSource).toBe("transcription")
      expect(job.error?.code).toBe("SUBTITLE_UNAVAILABLE")
      expect(job.error?.message).toContain("No usable YouTube subtitles were available")
      expect(job.error?.message).toContain("usable YouTube audio stream")
    } finally {
      fetchMock.mockRestore()
    }
  })

  it("rejects video-note job creation for anonymous sessions", async () => {
    await startServer(await createUserDb())

    const anonymousAuth = await fetch(`${baseURL}/v1/auth/anonymous`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "anon-video-note" }),
    })
    expect(anonymousAuth.status).toBe(200)
    const anonymousSession = await anonymousAuth.json() as {
      sessionToken: string
      deviceId: string
    }

    const create = await fetch(`${baseURL}/v1/video-notes/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(anonymousSession.sessionToken, anonymousSession.deviceId),
      },
      body: JSON.stringify({
        sourceUrl: "https://www.youtube.com/watch?v=anon123",
      }),
    })
    expect(create.status).toBe(403)
    const payload = await create.json() as { error: { code: string } }
    expect(payload.error.code).toBe("AUTH_REQUIRED")
  })

  it("marks stale non-terminal video-note jobs as failed on relay startup", async () => {
    const userDbPath = await createUserDb()
    const videoNoteStorePath = join(dirname(userDbPath), "video-notes.json")
    await writeFile(videoNoteStorePath, JSON.stringify({
      version: 1,
      jobs: [{
        id: "job-stale-1",
        ownerEmail: "demo@astra.local",
        sourceUrl: "https://www.youtube.com/watch?v=stale123",
        sourceKey: "https://www.youtube.com/watch?v=stale123",
        platform: "youtube",
        title: "Stale job",
        status: "generating_markdown",
        transcriptSource: null,
        errorCode: null,
        errorMessage: null,
        createdAt: "2026-04-12T00:00:00.000Z",
        updatedAt: "2026-04-12T00:00:00.000Z",
        startedAt: "2026-04-12T00:01:00.000Z",
        completedAt: null,
        artifactId: null,
        request: {
          sourceUrl: "https://www.youtube.com/watch?v=stale123",
          platformHint: "youtube",
          sourceTitle: "Stale job",
          forceRegenerate: false,
          capture: null,
        },
      }],
      artifacts: [],
    }, null, 2))

    await startServer(userDbPath)
    const { session, deviceId } = await createSession("device-stale-video-note")

    const response = await fetch(`${baseURL}/v1/video-notes/jobs/job-stale-1`, {
      headers: authHeaders(session.sessionToken, deviceId),
    })
    expect(response.status).toBe(200)
    const payload = await response.json() as {
      job: {
        status: string
        error: { code: string; message: string } | null
      }
    }
    expect(payload.job.status).toBe("failed")
    expect(payload.job.error?.code).toBe("RELAY_RESTARTED")
  })

  it("returns a valid anonymous device-bound session", async () => {
    await startServer(await createUserDb())

    const response = await fetch(`${baseURL}/v1/auth/anonymous`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: "anon-device-1",
        browserFamily: "chrome",
        platform: "macos",
      }),
    })

    expect(response.status).toBe(200)
    const payload = await response.json() as {
      sessionToken: string
      sessionId: string
      deviceId: string
      email: string
      plan: string
      identityMode: string
      providerEntitlements: string[]
    }
    expect(payload.sessionToken.length).toBeGreaterThan(10)
    expect(payload.sessionId.length).toBeGreaterThan(10)
    expect(payload.deviceId).toBe("anon-device-1")
    expect(typeof payload.email).toBe("string")
    expect(payload.plan).toBe("free")
    expect(payload.identityMode).toBe("anonymous")
    expect(Array.isArray(payload.providerEntitlements)).toBe(true)
  })

  it("creates anonymous session and reuses it with the same device id", async () => {
    await startServer(await createUserDb())

    const first = await fetch(`${baseURL}/v1/auth/anonymous`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "anon-reuse-1" }),
    })
    const firstPayload = await first.json() as { email: string }
    expect(first.status).toBe(200)

    const second = await fetch(`${baseURL}/v1/auth/anonymous`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "anon-reuse-1" }),
    })
    const secondPayload = await second.json() as { email: string }
    expect(second.status).toBe(200)

    expect(firstPayload.email).toBe(secondPayload.email)
  })

  it("returns 429 after too many anonymous registrations from the same IP", async () => {
    await startServer(await createUserDb())
    resetAnonymousRateLimits()

    for (let i = 0; i < 3; i++) {
      const response = await fetch(`${baseURL}/v1/auth/anonymous`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: `rate-limit-test-${i}` }),
      })
      expect(response.status).toBe(200)
    }

    const blocked = await fetch(`${baseURL}/v1/auth/anonymous`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "rate-limit-test-blocked" }),
    })
    expect(blocked.status).toBe(429)
    const payload = await blocked.json() as { error: { message: string } }
    expect(payload.error.message).toBe("Too many anonymous registrations")
  })

  it("allows reusing an existing device id even when anonymous rate limit is exceeded", async () => {
    await startServer(await createUserDb())
    resetAnonymousRateLimits()

    for (let i = 0; i < 3; i++) {
      await fetch(`${baseURL}/v1/auth/anonymous`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: `reuse-test-${i}` }),
      })
    }

    const reuse = await fetch(`${baseURL}/v1/auth/anonymous`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "reuse-test-0" }),
    })
    expect(reuse.status).toBe(200)
  })

  it("persists session revocation across server restart", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath)
    const { session, deviceId } = await createSession("device-revoke")

    const revoke = await fetch(`${baseURL}/v1/auth/session`, {
      method: "DELETE",
      headers: authHeaders(session.sessionToken, deviceId),
    })
    expect(revoke.status).toBe(204)

    await closeServer()
    await startServer(userDbPath)

    const refresh = await fetch(`${baseURL}/v1/auth/session`, {
      headers: authHeaders(session.sessionToken, deviceId),
    })
    const payload = await refresh.json() as { error: { code: string } }
    expect(refresh.status).toBe(401)
    expect(payload.error.code).toBe("SESSION_REVOKED")
  })

  it("lists current devices for the authenticated account", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-list-1")
    await createSession("device-list-2")

    const response = await fetch(`${baseURL}/v1/devices`, {
      headers: authHeaders(session.sessionToken, deviceId),
    })
    const payload = await response.json() as { devices: Array<{ deviceId: string; label: string; isCurrentDevice: boolean }> }

    expect(response.status).toBe(200)
    expect(payload.devices).toHaveLength(2)
    expect(payload.devices.some((device) => device.deviceId === "device-list-1" && device.label === "Device device-list-1" && device.isCurrentDevice)).toBe(true)
    expect(payload.devices.some((device) => device.deviceId === "device-list-2" && device.label === "Device device-list-2")).toBe(true)
  })

  it("revokes another device and blocks its future refreshes", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-current")
    const revokedTarget = await createSession("device-remote")

    const revoke = await fetch(`${baseURL}/v1/devices/device-remote/revoke`, {
      method: "POST",
      headers: authHeaders(session.sessionToken, deviceId),
    })
    const revokePayload = await revoke.json() as { devices: Array<{ deviceId: string; status: string }> }

    expect(revoke.status).toBe(200)
    expect(revokePayload.devices.find((device) => device.deviceId === "device-remote")?.status).toBe("revoked")

    const refresh = await fetch(`${baseURL}/v1/auth/session`, {
      headers: authHeaders(revokedTarget.session.sessionToken, revokedTarget.deviceId),
    })
    const refreshPayload = await refresh.json() as { error: { code: string } }
    expect(refresh.status).toBe(401)
    expect(refreshPayload.error.code).toBe("DEVICE_REVOKED")
  })

  it("rejects remote revoke requests for the current device", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-current-only")

    const revoke = await fetch(`${baseURL}/v1/devices/device-current-only/revoke`, {
      method: "POST",
      headers: authHeaders(session.sessionToken, deviceId),
    })
    const payload = await revoke.json() as { error: { code: string } }

    expect(revoke.status).toBe(409)
    expect(payload.error.code).toBe("CURRENT_DEVICE_REVOKE_FORBIDDEN")
  })

  it("supports initial sync bootstrap, push, and pull APIs", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-sync")

    const bootstrap = await fetch(`${baseURL}/v1/sync/bootstrap`, {
      headers: authHeaders(session.sessionToken, deviceId),
    })
    const bootstrapPayload = await bootstrap.json() as {
      deviceId: string
      collections: { config: { enabled: boolean; cursor: string | null } }
    }
    expect(bootstrap.status).toBe(200)
    expect(bootstrapPayload.deviceId).toBe(deviceId)
    expect(bootstrapPayload.collections.config.enabled).toBe(true)

    const push = await fetch(`${baseURL}/v1/sync/push`, {
      method: "POST",
      headers: {
        ...authHeaders(session.sessionToken, deviceId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mutations: [{
          collection: "config",
          schemaVersion: 1,
          recordId: "global",
          operation: "upsert",
          clientMutationId: "mut-1",
          deviceId,
          clientUpdatedAt: "2026-04-09T12:00:00.000Z",
          payload: {
            kind: "global",
            config: {
              version: 1,
              targetLang: "zh-CN",
              connectionMode: "astra",
              hoverTrigger: "alt",
              contentScope: "page",
              inputTranslation: "enabled",
              inputTranslationMode: "replace",
              languageLevel: "intermediate",
              privacyMode: false,
              provider: {
                id: "openai",
                model: "gpt-5.4-nano",
              },
              tts: {
                enabled: true,
                engine: "browser",
                rate: 0.9,
                pitch: 1,
                highlightSentences: true,
              },
              presentation: {
                mode: "bilingual",
                theme: "default",
                fontSize: 0.92,
                translationColor: "#64748b",
              },
            },
          },
        }],
      }),
    })
    const pushPayload = await push.json() as { accepted: Array<{ clientMutationId: string; deduped: boolean }> }
    expect(push.status).toBe(200)
    expect(pushPayload.accepted[0]?.clientMutationId).toBe("mut-1")
    expect(pushPayload.accepted[0]?.deduped).toBe(false)

    const pull = await fetch(`${baseURL}/v1/sync/pull`, {
      method: "POST",
      headers: {
        ...authHeaders(session.sessionToken, deviceId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cursors: { config: null } }),
    })
    const pullPayload = await pull.json() as { deltas: { config: Array<{ clientMutationId: string }> } }
    expect(pull.status).toBe(200)
    expect(pullPayload.deltas.config[0]?.clientMutationId).toBe("mut-1")

    const devices = await fetch(`${baseURL}/v1/devices`, {
      headers: authHeaders(session.sessionToken, deviceId),
    })
    const devicesPayload = await devices.json() as { devices: Array<{ deviceId: string; lastSyncAt: string | null }> }
    expect(devicesPayload.devices.find((device) => device.deviceId === deviceId)?.lastSyncAt).toBeTruthy()
  })

  it("updates authenticated weekly digest preference", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath)
    const { session, deviceId } = await createSession("device-weekly-digest-preference")

    const response = await fetch(`${baseURL}/v1/account/preferences/weekly-digest`, {
      method: "PATCH",
      headers: {
        ...authHeaders(session.sessionToken, deviceId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled: false }),
    })

    const payload = await response.json() as { preference: { weekly_digest: boolean }; serverTime: string }
    expect(response.status).toBe(200)
    expect(payload.preference.weekly_digest).toBe(false)
    expect(Date.parse(payload.serverTime)).toBeGreaterThan(0)

    const db = await readUserDb(userDbPath)
    expect(db.users[0]?.syncPreferences?.weekly_digest).toBe(false)
  })

  it("stores and clears authenticated current-device push tokens", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath)
    const { session, deviceId } = await createSession("device-push-token-route")

    const storeResponse = await fetch(`${baseURL}/v1/account/devices/current/push-token`, {
      method: "PATCH",
      headers: { ...authHeaders(session.sessionToken, deviceId), "Content-Type": "application/json" },
      body: JSON.stringify({ expoPushToken: "ExponentPushToken[route]", platform: "ios" }),
    })
    const storePayload = await storeResponse.json() as { deviceId: string; pushTokenStored: boolean; serverTime: string }
    expect(storeResponse.status).toBe(200)
    expect(storePayload).toMatchObject({ deviceId, pushTokenStored: true })
    expect(Date.parse(storePayload.serverTime)).toBeGreaterThan(0)
    expect((await readUserDb(userDbPath)).devices.find((device) => device.deviceId === deviceId)?.expoPushToken).toBe("ExponentPushToken[route]")

    const clearResponse = await fetch(`${baseURL}/v1/account/devices/current/push-token`, {
      method: "PATCH",
      headers: { ...authHeaders(session.sessionToken, deviceId), "Content-Type": "application/json" },
      body: JSON.stringify({ expoPushToken: null }),
    })
    const clearPayload = await clearResponse.json() as { pushTokenStored: boolean }
    expect(clearResponse.status).toBe(200)
    expect(clearPayload.pushTokenStored).toBe(false)
    expect((await readUserDb(userDbPath)).devices.find((device) => device.deviceId === deviceId)?.expoPushToken).toBeNull()
  })

  it("runs operator-triggered weekly digest delivery with dry-run and Resend modes", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath, {
      emailDeliveryProvider: "resend",
      emailDeliveryResendApiKey: "resend-test-key",
      emailDeliveryResendFrom: "Astra <digest@example.com>",
      emailDeliveryResendApiBaseUrl: "http://unsafe-resend-proxy.test",
    })
    const nativeFetch = globalThis.fetch.bind(globalThis)
    const resendRequests: Array<{ url: string; init?: RequestInit; body: Record<string, unknown> }> = []
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = toFetchUrl(input)
      if (url.startsWith(baseURL)) return nativeFetch(input, init)
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>
      resendRequests.push({ url, init, body })
      return new Response(JSON.stringify({ id: "email_digest_batch_1" }), { status: 200, headers: { "Content-Type": "application/json" } })
    })

    try {
      const dryRun = await fetch(`${baseURL}/v1/ops/weekly-digest/deliver`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Astra-Operator-Token": env.platformMirrorSecret ?? "",
        },
        body: JSON.stringify({ dryRun: true, limit: 10, now: "2026-05-29T12:00:00.000Z" }),
      })
      const dryRunPayload = await dryRun.json() as { dryRun: boolean; consideredCount: number; deliveredCount: number; results: Array<{ delivery: string; digestId: string | null; emailHash: string }> }
      expect(dryRun.status).toBe(200)
      expect(dryRunPayload).toMatchObject({ dryRun: true, consideredCount: 1, deliveredCount: 0 })
      expect(dryRunPayload.results[0]).toMatchObject({ delivery: "dry_run", digestId: "digest_2026-05-25" })
      expect(dryRunPayload.results[0]?.emailHash).toMatch(/^[a-f0-9]{64}$/)
      expect(resendRequests).toHaveLength(0)
      expect((await readUserDb(userDbPath)).weeklyDigests).toEqual([])

      const delivered = await fetch(`${baseURL}/v1/ops/weekly-digest/deliver`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Astra-Operator-Token": env.platformMirrorSecret ?? "",
        },
        body: JSON.stringify({ limit: 10, now: "2026-05-29T12:00:00.000Z" }),
      })
      const deliveredPayload = await delivered.json() as { dryRun: boolean; consideredCount: number; deliveredCount: number; results: Array<{ delivery: string; digestId: string | null }> }
      expect(delivered.status).toBe(200)
      expect(deliveredPayload).toMatchObject({ dryRun: false, consideredCount: 1, deliveredCount: 1 })
      expect(deliveredPayload.results[0]).toMatchObject({ delivery: "email", digestId: "digest_2026-05-25" })
      expect(resendRequests).toHaveLength(1)
      expect(resendRequests[0]).toMatchObject({ url: "https://api.resend.com/emails" })
      expect(resendRequests[0].body).toMatchObject({
        from: "Astra <digest@example.com>",
        to: [env.loginEmail],
        subject: "Your Astra weekly learning note",
      })
      expect((await readUserDb(userDbPath)).weeklyDigests).toEqual([
        expect.objectContaining({ email: env.loginEmail, digestId: "digest_2026-05-25" }),
      ])
    } finally {
      fetchMock.mockRestore()
    }
  })

  it("runs operator-triggered weekly digest push delivery without network on dry-run", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath)
    const { session, deviceId } = await createSession("device-weekly-digest-push")

    const storeResponse = await fetch(`${baseURL}/v1/account/devices/current/push-token`, {
      method: "PATCH",
      headers: { ...authHeaders(session.sessionToken, deviceId), "Content-Type": "application/json" },
      body: JSON.stringify({ expoPushToken: "ExponentPushToken[push]", platform: "ios" }),
    })
    expect(storeResponse.status).toBe(200)

    const nativeFetch = globalThis.fetch.bind(globalThis)
    const expoRequests: Array<{ url: string; body: Record<string, unknown> }> = []
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = toFetchUrl(input)
      if (url.startsWith(baseURL)) return nativeFetch(input, init)
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>
      expoRequests.push({ url, body })
      return new Response(JSON.stringify({ data: { status: "ok", id: "ticket-1" } }), { status: 200, headers: { "Content-Type": "application/json" } })
    })

    try {
      const dryRun = await fetch(`${baseURL}/v1/ops/weekly-digest/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
        body: JSON.stringify({ dryRun: true, limit: 10, now: "2026-05-29T12:00:00.000Z" }),
      })
      const dryRunPayload = await dryRun.json() as { dryRun: boolean; consideredCount: number; deliveredCount: number; results: Array<{ delivery: string; digestId: string | null; emailHash: string; deviceIdHash: string }> }
      expect(dryRun.status).toBe(200)
      expect(dryRunPayload).toMatchObject({ dryRun: true, consideredCount: 1, deliveredCount: 0 })
      expect(dryRunPayload.results[0]).toMatchObject({ delivery: "dry_run", digestId: null })
      expect(dryRunPayload.results[0]?.emailHash).toMatch(/^[a-f0-9]{64}$/)
      expect(dryRunPayload.results[0]?.deviceIdHash).toMatch(/^[a-f0-9]{64}$/)
      expect(expoRequests).toHaveLength(0)
      expect((await readUserDb(userDbPath)).weeklyDigests).toEqual([])

      const delivered = await fetch(`${baseURL}/v1/ops/weekly-digest/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
        body: JSON.stringify({ limit: 10, now: "2026-05-29T12:00:00.000Z" }),
      })
      const deliveredPayload = await delivered.json() as { dryRun: boolean; consideredCount: number; deliveredCount: number; results: Array<{ delivery: string; digestId: string | null }> }
      expect(delivered.status).toBe(200)
      expect(deliveredPayload).toMatchObject({ dryRun: false, consideredCount: 1, deliveredCount: 1 })
      expect(deliveredPayload.results[0]).toMatchObject({ delivery: "push", digestId: "digest_2026-05-25" })
      expect(expoRequests).toHaveLength(1)
      expect(expoRequests[0]).toMatchObject({ url: "https://exp.host/--/api/v2/push/send" })
      expect(expoRequests[0]?.body).toMatchObject({ to: "ExponentPushToken[push]", title: "Your Astra learning note is ready" })
      expect((await readUserDb(userDbPath)).weeklyDigests).toEqual([
        expect.objectContaining({ email: env.loginEmail, digestId: "digest_2026-05-25" }),
      ])
    } finally {
      fetchMock.mockRestore()
    }
  })

  it("summarizes weekly digest delivery runs as aggregate-only ops metadata", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath, {
      emailDeliveryProvider: "resend",
      emailDeliveryResendApiKey: "resend-test-key",
      emailDeliveryResendFrom: "Astra <digest@example.com>",
      emailDeliveryResendApiBaseUrl: "http://unsafe-resend-proxy.test",
    })
    const { session, deviceId } = await createSession("device-weekly-digest-summary")
    const pushToken = "ExponentPushToken[summary]"
    const storeResponse = await fetch(`${baseURL}/v1/account/devices/current/push-token`, {
      method: "PATCH",
      headers: { ...authHeaders(session.sessionToken, deviceId), "Content-Type": "application/json" },
      body: JSON.stringify({ expoPushToken: pushToken, platform: "ios" }),
    })
    expect(storeResponse.status).toBe(200)

    const nativeFetch = globalThis.fetch.bind(globalThis)
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = toFetchUrl(input)
      if (url.startsWith(baseURL)) return nativeFetch(input, init)
      if (url === "https://api.resend.com/emails") {
        return new Response(JSON.stringify({ id: "email_digest_summary" }), { status: 200, headers: { "Content-Type": "application/json" } })
      }
      if (url === "https://exp.host/--/api/v2/push/send") {
        return new Response(JSON.stringify({ data: { status: "ok", id: "ticket-summary" } }), { status: 200, headers: { "Content-Type": "application/json" } })
      }
      return nativeFetch(input, init)
    })

    try {
      for (const body of [
        { dryRun: true, limit: 10, now: "2026-05-29T12:00:00.000Z" },
        { limit: 10, now: "2026-05-29T12:00:00.000Z" },
      ]) {
        const run = await fetch(`${baseURL}/v1/ops/weekly-digest/deliver`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
          body: JSON.stringify(body),
        })
        expect(run.status).toBe(200)
      }

      const pushDryRun = await fetch(`${baseURL}/v1/ops/weekly-digest/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
        body: JSON.stringify({ dryRun: true, limit: 10, now: "2026-05-29T12:00:00.000Z" }),
      })
      expect(pushDryRun.status).toBe(200)

      const summaryResponse = await fetch(`${baseURL}/v1/ops/weekly-digest/delivery-summary`, {
        headers: { "X-Astra-Operator-Token": env.platformMirrorSecret ?? "" },
      })
      const summary = await summaryResponse.json() as {
        schema: string
        source: string
        totalRuns: number
        byChannel: Array<{ channel: string; runCount: number; dryRunCount: number; consideredCount: number; relayAcceptedCount: number; unavailableCount: number; failedCount: number; lastRunAt: string | null }>
        recentRuns: Array<{ channel: string; dryRun: boolean; relayAcceptedCount: number }>
        limitations: Record<string, boolean>
        privacy: Record<string, boolean>
      }
      expect(summaryResponse.status).toBe(200)
      expect(summary).toMatchObject({
        schema: "astra-weekly-digest-delivery-summary.v1",
        source: "ops_audit_log_weekly_digest_delivery_run_metadata",
        totalRuns: 3,
        limitations: {
          relayAcceptedOnly: true,
          providerWebhookReceiptsIncluded: false,
          inboxDeliveryConfirmed: false,
          deviceDeliveryConfirmed: false,
          apnsFcmReceiptsIncluded: false,
          resendEventIngestionIncluded: false,
        },
        privacy: {
          metadataOnly: true,
          aggregateOnly: true,
          perUserRows: false,
          rawEmailsIncluded: false,
          pushTokensIncluded: false,
          digestContentIncluded: false,
        },
      })
      expect(summary.byChannel).toEqual([
        expect.objectContaining({ channel: "email", runCount: 2, dryRunCount: 1, consideredCount: 2, relayAcceptedCount: 1, unavailableCount: 0, failedCount: 0 }),
        expect.objectContaining({ channel: "push", runCount: 1, dryRunCount: 1, consideredCount: 1, relayAcceptedCount: 0, unavailableCount: 0, failedCount: 0 }),
      ])
      expect(summary.recentRuns).toHaveLength(3)
      expect(summary.recentRuns.map((run) => run.channel).sort()).toEqual(["email", "email", "push"])
      const serializedSummary = JSON.stringify(summary)
      expect(serializedSummary).not.toContain(env.loginEmail)
      expect(serializedSummary).not.toContain(pushToken)
      expect(serializedSummary).not.toContain(deviceId)
      expect(serializedSummary).not.toContain("Your Astra learning note")
      expect(serializedSummary).not.toContain("digest_2026-05-25")
    } finally {
      fetchMock.mockRestore()
    }
  })

  it("builds and archives an authenticated weekly digest from synced review records", async () => {
    const userDbPath = await createUserDb()
    await startServer(userDbPath)
    const { session, deviceId } = await createSession("device-weekly-digest")
    const savedWordAt = Date.UTC(2026, 4, 27, 9, 0, 0)
    const savedSentenceAt = Date.UTC(2026, 4, 28, 9, 0, 0)
    const reviewedAt = Date.UTC(2026, 4, 27, 13, 0, 0)

    const push = await fetch(`${baseURL}/v1/sync/push`, {
      method: "POST",
      headers: {
        ...authHeaders(session.sessionToken, deviceId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mutations: [
          {
            collection: "vocabulary",
            schemaVersion: 1,
            recordId: "vocab-digest-1",
            operation: "upsert",
            clientMutationId: "mut-digest-vocab-1",
            deviceId,
            clientUpdatedAt: "2026-05-27T12:00:00.000Z",
            payload: {
              id: "vocab-digest-1",
              text: "resilient",
              translation: "有韧性的",
              savedAt: savedWordAt,
              sourceContext: {
                surface: "hover_translate",
                pageTitle: "Distributed Systems",
                pageUrl: "https://example.com/systems",
                hostname: "example.com",
              },
            },
          },
          {
            collection: "vocabulary",
            schemaVersion: 1,
            recordId: "vocab-digest-2",
            operation: "upsert",
            clientMutationId: "mut-digest-vocab-2",
            deviceId,
            clientUpdatedAt: "2026-05-28T12:00:00.000Z",
            payload: {
              id: "vocab-digest-2",
              text: "The catch is that consistency becomes a moving target.",
              translation: "难点在于一致性会变成一个移动目标。",
              savedAt: savedSentenceAt,
              sourceContext: {
                surface: "sample_lesson",
                ownedReadingSourceType: "pdf",
                ownedReadingTitle: "Design Notes",
              },
            },
          },
          {
            collection: "review_schedule",
            schemaVersion: 1,
            recordId: "vocab-digest-1",
            operation: "upsert",
            clientMutationId: "mut-digest-review-1",
            deviceId,
            clientUpdatedAt: "2026-05-27T13:00:00.000Z",
            payload: {
              vocabularyEntryId: "vocab-digest-1",
              srsBox: 2,
              nextReviewAt: Date.UTC(2026, 4, 30, 9, 0, 0),
              reviewCount: 1,
              lastReviewedAt: reviewedAt,
              lastReviewGrade: "good",
              lastReviewGradeAt: reviewedAt,
              updatedAt: reviewedAt,
            },
          },
          {
            collection: "review_schedule",
            schemaVersion: 1,
            recordId: "vocab-orphaned",
            operation: "upsert",
            clientMutationId: "mut-digest-review-orphaned",
            deviceId,
            clientUpdatedAt: "2026-05-27T14:00:00.000Z",
            payload: {
              vocabularyEntryId: "vocab-orphaned",
              srsBox: 2,
              nextReviewAt: Date.UTC(2026, 4, 30, 10, 0, 0),
              reviewCount: 1,
              lastReviewedAt: reviewedAt,
              lastReviewGrade: "good",
              lastReviewGradeAt: reviewedAt,
              updatedAt: reviewedAt,
            },
          },
        ],
      }),
    })
    const pushPayload = await push.json() as { accepted: Array<{ clientMutationId: string }>; rejected: unknown[] }
    expect(push.status).toBe(200)
    expect(pushPayload.rejected).toEqual([])
    expect(pushPayload.accepted.map((entry) => entry.clientMutationId)).toEqual([
      "mut-digest-vocab-1",
      "mut-digest-vocab-2",
      "mut-digest-review-1",
      "mut-digest-review-orphaned",
    ])

    const digest = await fetch(`${baseURL}/v1/account/weekly-digest?now=${encodeURIComponent("2026-05-29T12:00:00.000Z")}`, {
      headers: authHeaders(session.sessionToken, deviceId),
    })
    const payload = await digest.json() as {
      digestId: string
      periodStart: string
      periodEnd: string
      savedCount: number
      reviewedCount: number
      sourceBreakdown: Array<{ type: string; count: number }>
      highlightedWords: string[]
      highlightedSentences: string[]
      nextReviewCount: number
      generatedAt: string
    }

    expect(digest.status).toBe(200)
    expect(payload).toMatchObject({
      digestId: "digest_2026-05-25",
      periodStart: "2026-05-25T00:00:00.000Z",
      periodEnd: "2026-06-01T00:00:00.000Z",
      savedCount: 2,
      reviewedCount: 1,
      sourceBreakdown: [{ type: "page", count: 1 }, { type: "pdf", count: 1 }],
      highlightedWords: ["resilient"],
      highlightedSentences: ["The catch is that consistency becomes a moving target."],
      nextReviewCount: 1,
      generatedAt: "2026-05-29T12:00:00.000Z",
    })

    const emailUnavailable = await fetch(`${baseURL}/v1/account/weekly-digest/email?now=${encodeURIComponent("2026-05-29T12:00:00.000Z")}`, {
      method: "POST",
      headers: authHeaders(session.sessionToken, deviceId),
    })
    const emailUnavailablePayload = await emailUnavailable.json() as { delivery: string; digest: { digestId: string; savedCount: number } }
    expect(emailUnavailable.status).toBe(200)
    expect(emailUnavailablePayload).toMatchObject({ delivery: "unavailable", digest: { digestId: "digest_2026-05-25", savedCount: 2 } })

    const db = await readUserDb(userDbPath)
    expect(db.weeklyDigests).toEqual([
      expect.objectContaining({ ownerId: "usr_demo", email: env.loginEmail, digestId: "digest_2026-05-25" }),
    ])
  })

  it("sends authenticated weekly digest emails through Resend", async () => {
    await startServer(await createUserDb(), {
      emailDeliveryProvider: "resend",
      emailDeliveryResendApiKey: "resend-test-key",
      emailDeliveryResendFrom: "Astra <digest@example.com>",
      emailDeliveryResendApiBaseUrl: "http://unsafe-resend-proxy.test",
    })
    const { session, deviceId } = await createSession("device-weekly-digest-email")
    const nativeFetch = globalThis.fetch.bind(globalThis)
    const resendRequests: Array<{ url: string; init?: RequestInit; body: Record<string, unknown> }> = []
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = toFetchUrl(input)
      if (url.startsWith(baseURL)) return nativeFetch(input, init)
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>
      resendRequests.push({ url, init, body })
      return new Response(JSON.stringify({ id: "email_digest_1" }), { status: 200, headers: { "Content-Type": "application/json" } })
    })

    try {
      const emailResponse = await fetch(`${baseURL}/v1/account/weekly-digest/email?now=${encodeURIComponent("2026-05-29T12:00:00.000Z")}`, {
        method: "POST",
        headers: authHeaders(session.sessionToken, deviceId),
      })
      const payload = await emailResponse.json() as { delivery: string; digest: { digestId: string; savedCount: number; reviewedCount: number } }
      expect(emailResponse.status).toBe(200)
      expect(payload).toMatchObject({ delivery: "email", digest: { digestId: "digest_2026-05-25", savedCount: 0, reviewedCount: 0 } })
      expect(resendRequests).toHaveLength(1)
      expect(resendRequests[0]).toMatchObject({ url: "https://api.resend.com/emails" })
      expect(resendRequests[0].init?.headers).toMatchObject({
        Authorization: "Bearer resend-test-key",
        "Content-Type": "application/json",
      })
      expect(resendRequests[0].init?.headers).toMatchObject({
        "Idempotency-Key": expect.stringContaining("weekly-digest-"),
      })
      expect(resendRequests[0].body).toMatchObject({
        from: "Astra <digest@example.com>",
        to: [env.loginEmail],
        subject: "Your Astra weekly learning note",
      })
      expect(String(resendRequests[0].body.text)).toContain("Saved items: 0")
      expect(String(resendRequests[0].body.text)).toContain("Reviewed items: 0")
      expect(String(resendRequests[0].body.html)).toContain("Your Astra weekly learning note")
    } finally {
      fetchMock.mockRestore()
    }
  })

  it("updates the reading history sync preference and accepts history mutations", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-history")

    const toggle = await fetch(`${baseURL}/v1/sync/collections/reading_history`, {
      method: "PATCH",
      headers: {
        ...authHeaders(session.sessionToken, deviceId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled: true }),
    })
    const togglePayload = await toggle.json() as {
      collections: { reading_history: { enabled: boolean; defaultEnabled: boolean } }
    }

    expect(toggle.status).toBe(200)
    expect(togglePayload.collections.reading_history.enabled).toBe(true)
    expect(togglePayload.collections.reading_history.defaultEnabled).toBe(false)

    const push = await fetch(`${baseURL}/v1/sync/push`, {
      method: "POST",
      headers: {
        ...authHeaders(session.sessionToken, deviceId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mutations: [{
          collection: "reading_history",
          schemaVersion: 1,
          recordId: "https://example.com/article",
          operation: "upsert",
          clientMutationId: "mut-history-1",
          deviceId,
          clientUpdatedAt: "2026-04-09T12:00:00.000Z",
          payload: {
            id: "https://example.com/article",
            url: "https://example.com/article?utm=1",
            hostname: "example.com",
            title: "History entry",
            wordsTranslated: 12,
            visitedAt: 1234,
          },
        }],
      }),
    })
    const pushPayload = await push.json() as { accepted: Array<{ clientMutationId: string }> }

    expect(push.status).toBe(200)
    expect(pushPayload.accepted[0]?.clientMutationId).toBe("mut-history-1")

    const pull = await fetch(`${baseURL}/v1/sync/pull`, {
      method: "POST",
      headers: {
        ...authHeaders(session.sessionToken, deviceId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cursors: { reading_history: null } }),
    })
    const pullPayload = await pull.json() as { deltas: { reading_history: Array<{ recordId: string; payload: { url: string } }> } }

    expect(pull.status).toBe(200)
    expect(pullPayload.deltas.reading_history[0]?.recordId).toBe("https://example.com/article")
    expect(pullPayload.deltas.reading_history[0]?.payload.url).toBe("https://example.com/article")
  })

  it("updates the study progress sync preference and accepts durable page progress mutations", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession("device-progress")

    const toggle = await fetch(`${baseURL}/v1/sync/collections/study_progress`, {
      method: "PATCH",
      headers: {
        ...authHeaders(session.sessionToken, deviceId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled: true }),
    })
    const togglePayload = await toggle.json() as {
      collections: { study_progress: { enabled: boolean; defaultEnabled: boolean } }
    }

    expect(toggle.status).toBe(200)
    expect(togglePayload.collections.study_progress.enabled).toBe(true)
    expect(togglePayload.collections.study_progress.defaultEnabled).toBe(false)

    const push = await fetch(`${baseURL}/v1/sync/push`, {
      method: "POST",
      headers: {
        ...authHeaders(session.sessionToken, deviceId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mutations: [{
          collection: "study_progress",
          schemaVersion: 1,
          recordId: "https://example.com/article",
          operation: "upsert",
          clientMutationId: "mut-progress-1",
          deviceId,
          clientUpdatedAt: "2026-04-09T12:00:00.000Z",
          payload: {
            url: "https://example.com/article?utm=1",
            hostname: "example.com",
            title: "Study page",
            completedSteps: ["guided_read", "read", "read"],
            sentencesExplained: 2,
            vocabSaved: 1,
            startedAt: 1234,
            lastActivityAt: 2234,
          },
        }],
      }),
    })
    const pushPayload = await push.json() as { accepted: Array<{ clientMutationId: string }> }

    expect(push.status).toBe(200)
    expect(pushPayload.accepted[0]?.clientMutationId).toBe("mut-progress-1")

    const pull = await fetch(`${baseURL}/v1/sync/pull`, {
      method: "POST",
      headers: {
        ...authHeaders(session.sessionToken, deviceId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cursors: { study_progress: null } }),
    })
    const pullPayload = await pull.json() as { deltas: { study_progress: Array<{ recordId: string; payload: { url: string; completedSteps: string[] } }> } }

    expect(pull.status).toBe(200)
    expect(pullPayload.deltas.study_progress[0]?.recordId).toBe("https://example.com/article")
    expect(pullPayload.deltas.study_progress[0]?.payload.url).toBe("https://example.com/article")
    expect(pullPayload.deltas.study_progress[0]?.payload.completedSteps).toEqual(["read", "guided_read"])
  })

  it("imports readable article content through the relay fetch path", async () => {
    await startServer(await createUserDb())

    const originalFetch = globalThis.fetch
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url

      if (requestUrl.startsWith(baseURL)) {
        return originalFetch(input, init)
      }

      if (requestUrl === "https://example.com/readable") {
        return Promise.resolve(new Response(`
          <html>
            <head>
              <title>Fallback Title</title>
              <meta name="author" content="Relay Writer" />
            </head>
            <body>
              <article>
                <h1>Relay Imported Article</h1>
                <p>First paragraph extracted from the relay fetch path.</p>
                <p>Second paragraph confirms readable content extraction.</p>
                <p>Third paragraph keeps article-mode heuristics active.</p>
              </article>
            </body>
          </html>
        `, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        }))
      }

      return Promise.reject(new Error(`Unexpected fetch url: ${requestUrl}`))
    })

    const response = await fetch(`${baseURL}/v1/import/article`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: "https://example.com/readable" }),
    })
    const payload = await response.json() as {
      title: string
      hostname: string
      byline: string | null
      scope: string
      blocks: string[]
    }

    expect(response.status).toBe(200)
    expect(payload.title).toBe("Relay Imported Article")
    expect(payload.hostname).toBe("example.com")
    expect(payload.byline).toBe("Relay Writer")
    expect(payload.scope).toBe("article")
    expect(payload.blocks).toEqual(expect.arrayContaining([
      "First paragraph extracted from the relay fetch path.",
      "Second paragraph confirms readable content extraction.",
    ]))
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ href: "https://example.com/readable" }),
      expect.objectContaining({
        headers: { Accept: "text/html,application/xhtml+xml" },
        redirect: "manual",
      }),
    )
  })

  it("rejects local article import targets on the relay endpoint", async () => {
    await startServer(await createUserDb())

    const response = await fetch(`${baseURL}/v1/import/article`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: "http://127.0.0.1/private" }),
    })
    const payload = await response.json() as { error: { code: string; message: string } }

    expect(response.status).toBe(400)
    expect(payload.error.code).toBe("INVALID_REQUEST")
    expect(payload.error.message).toContain("Local or private network URLs are not allowed")
  })

  it("creates checkout and portal billing links for the authenticated user", async () => {
    await startServer(await createUserDb())
    const { session } = await createSession()

    const [checkout, portal] = await Promise.all([
      fetch(`${baseURL}/v1/billing/checkout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan: "pro" }),
      }),
      fetch(`${baseURL}/v1/billing/portal`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.sessionToken}`,
        },
      }),
    ])

    const checkoutPayload = await checkout.json() as { kind: string; url: string }
    const portalPayload = await portal.json() as { kind: string; url: string }
    expect(checkout.status).toBe(200)
    expect(checkoutPayload.kind).toBe("checkout")
    expect(checkoutPayload.url).toContain("billing.example")
    expect(portal.status).toBe(200)
    expect(portalPayload.kind).toBe("portal")
  })

  it("records beta trial intent only after explicit authenticated action without billing or entitlement mutation", async () => {
    const userDbPath = await createUserDb(undefined, { plan: "free", providerEntitlements: ["openai"], limits: { dailyRequests: 200, dailyCharacters: 200_000, requestsPerMinute: 20 } })
    await startServer(userDbPath)
    const { session, deviceId } = await createSession()

    const before = await fetch(`${baseURL}/v1/account/trial-intent`, {
      headers: authHeaders(session.sessionToken, deviceId),
    })
    const beforePayload = await before.json() as { trial: { status: string }; explicitActionRequired: boolean }
    expect(before.status).toBe(200)
    expect(beforePayload.explicitActionRequired).toBe(true)
    expect(beforePayload.trial.status).toBe("not_started")

    const anonymous = await fetch(`${baseURL}/v1/auth/anonymous`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Astra-Device-Id": "anon-trial-device" },
      body: JSON.stringify({ deviceId: "anon-trial-device" }),
    })
    const anonymousSession = await anonymous.json() as { sessionToken: string }
    const anonymousTrial = await fetch(`${baseURL}/v1/account/trial-intent`, {
      method: "POST",
      headers: authHeaders(anonymousSession.sessionToken, "anon-trial-device"),
    })
    expect(anonymousTrial.status).toBe(403)

    const response = await fetch(`${baseURL}/v1/account/trial-intent`, {
      method: "POST",
      headers: authHeaders(session.sessionToken, deviceId),
    })
    const payload = await response.json() as {
      schema: string
      eligibility: { eligible: boolean; reason: string }
      trial: { status: string; startedAt: string | null; expiresAt: string | null }
      conversion: { checkoutAvailable: boolean; portalAvailable: boolean; nextStep: string }
      betaBoundary: Record<string, boolean>
    }
    expect(response.status).toBe(200)
    expect(payload.schema).toBe("astra-beta-trial-lifecycle.v1")
    expect(payload.eligibility).toEqual({ eligible: true, reason: "eligible_free_account" })
    expect(payload.trial).toEqual({ status: "intent_recorded", startedAt: null, expiresAt: null })
    expect(payload.conversion).toMatchObject({ checkoutAvailable: false, portalAvailable: false, nextStep: "wait_for_beta_billing" })
    expect(payload.betaBoundary).toMatchObject({
      billingUnavailable: true,
      noPaymentCollected: true,
      paymentCollected: false,
      subscriptionMutation: false,
      proEntitlementGranted: false,
      trialEntitlementGranted: false,
    })

    const rawUsers = JSON.parse(await readFile(userDbPath, "utf8")) as { users: Array<{ plan: string; subscriptionStatus: string; providerEntitlements: string[]; limits: { dailyRequests: number } }> }
    expect(rawUsers.users[0]).toMatchObject({
      plan: "free",
      subscriptionStatus: "active",
      limits: { dailyRequests: 200 },
    })
    expect(rawUsers.users[0]?.providerEntitlements).not.toContain("pro")

    const rawAnalytics = JSON.parse(await readFile(env.analyticsEventStorePath ?? "", "utf8")) as { events: Array<{ name: string; properties: Record<string, unknown> }> }
    expect(rawAnalytics.events).toHaveLength(1)
    expect(rawAnalytics.events[0]).toMatchObject({
      name: "trial_intent_recorded",
      properties: {
        plan: "free",
        sourceType: "web",
        outcome: "success",
        flags: {
          billingUnavailable: true,
          paymentCollected: false,
          subscriptionMutation: false,
          proEntitlementGranted: false,
          trialEntitlementGranted: false,
        },
      },
    })
    const serialized = JSON.stringify({ payload, rawAnalytics })
    expect(serialized).not.toContain("billing.example")
    expect(serialized).not.toContain("https://billing.example/checkout")
    expect(serialized).not.toContain("portal_opened")
    expect(serialized).not.toContain("openai-key")
    expect(serialized).not.toContain("google-key")
    expect(serialized).not.toContain("sessionToken")
    expect(serialized).not.toContain("demo@astra.local")
  })

  it("tracks anonymous rate-limit windows by IP", () => {
    resetAnonymousRateLimits()
    const now = Date.now()
    expect(checkAnonymousRateLimit("127.0.0.1", now)).toBe(true)
    expect(checkAnonymousRateLimit("127.0.0.1", now + 10)).toBe(true)
  })
})
