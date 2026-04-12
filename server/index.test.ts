import { createHash } from "node:crypto"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { checkAnonymousRateLimit, createAstraRelayServer, resetAnonymousRateLimits } from "./index"
import type { RelayEnv } from "./types"

const { translateViaManagedProviderMock } = vi.hoisted(() => ({
  translateViaManagedProviderMock: vi.fn(),
}))

vi.mock("./providers", () => ({
  translateViaManagedProvider: translateViaManagedProviderMock,
}))

async function createUserDb(limits?: Partial<{ dailyRequests: number; dailyCharacters: number; requestsPerMinute: number }>) {
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
    }],
  }, null, 2))
  return path
}

async function readUserDb(path: string): Promise<{
  version: number
  users: Array<{ id: string; email: string; installId?: string }>
  devices: Array<{ deviceId: string; userId: string; email: string }>
  sessions: Array<{ sessionId: string; deviceId: string; userId: string; email: string }>
}> {
  return JSON.parse(await readFile(path, "utf8")) as {
    version: number
    users: Array<{ id: string; email: string; installId?: string }>
    devices: Array<{ deviceId: string; userId: string; email: string }>
    sessions: Array<{ sessionId: string; deviceId: string; userId: string; email: string }>
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

  async function startServer(userDbPath: string) {
    env = {
      port: 8787,
      host: "127.0.0.1",
      publicBaseURL: "http://127.0.0.1:8787/v1",
      sessionPublicBaseURL: "https://platform.astra.example/v1",
      sessionSecret: "test-secret",
      platformMirrorSecret: "mirror-secret",
      userDbPath,
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

  beforeEach(() => {
    translateViaManagedProviderMock.mockReset()
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

  it("translates text for an authenticated session and records usage", async () => {
    await startServer(await createUserDb())
    translateViaManagedProviderMock.mockResolvedValue(["你好"])

    const { session, deviceId } = await createSession()

    const translateResponse = await fetch(`${baseURL}/v1/translate`, {
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
        task: "translate",
      }),
    })

    expect(translateResponse.status).toBe(200)
    expect(await translateResponse.json()).toEqual({ translations: ["你好"] })

    const refreshResponse = await fetch(`${baseURL}/v1/auth/session`, {
      headers: authHeaders(session.sessionToken, deviceId),
    })
    const refreshed = await refreshResponse.json() as { usage: { totalRequests: number; totalCharacters: number }; quota: { remainingDailyRequests: number } }

    expect(refreshed.usage.totalRequests).toBe(1)
    expect(refreshed.usage.totalCharacters).toBe(5)
    expect(refreshed.quota.remainingDailyRequests).toBe(1999)
  })

  it("returns account, usage, and account-summary snapshots for an authenticated user", async () => {
    await startServer(await createUserDb())
    const { session, deviceId } = await createSession()

    const [accountResponse, usageResponse, summaryResponse] = await Promise.all([
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
  })

  it("updates the account plan and applies downgraded provider access", async () => {
    await startServer(await createUserDb())
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
    expect(patched.providerEntitlements).toEqual(["openai"])

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

    const errorPayload = await translateResponse.json() as { error: { message: string } }
    expect(translateResponse.status).toBe(400)
    expect(errorPayload.error.message).toContain("does not allow provider: gemini")
    expect(translateViaManagedProviderMock).not.toHaveBeenCalled()
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

  it("tracks anonymous rate-limit windows by IP", () => {
    resetAnonymousRateLimits()
    const now = Date.now()
    expect(checkAnonymousRateLimit("127.0.0.1", now)).toBe(true)
    expect(checkAnonymousRateLimit("127.0.0.1", now + 10)).toBe(true)
  })
})
