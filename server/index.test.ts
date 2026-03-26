import { createHash } from "node:crypto"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createAstraRelayServer } from "./index"
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
    }],
  }, null, 2))
  return path
}

describe("Astra relay server", () => {
  let server: ReturnType<typeof createAstraRelayServer>
  let baseURL = ""
  let env: RelayEnv

  async function startServer(userDbPath: string) {
    env = {
      port: 8787,
      host: "127.0.0.1",
      publicBaseURL: "http://127.0.0.1:8787/v1",
      sessionSecret: "test-secret",
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

  async function createSessionToken() {
    const authResponse = await fetch(`${baseURL}/v1/auth/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: env.loginEmail,
        password: env.loginPassword,
      }),
    })

    const session = await authResponse.json() as { sessionToken: string }
    return session.sessionToken
  }

  beforeEach(() => {
    translateViaManagedProviderMock.mockReset()
  })

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error)
          else resolve()
        })
      })
    }
  })

  it("creates a session from valid credentials and returns quota metadata", async () => {
    await startServer(await createUserDb())

    const response = await fetch(`${baseURL}/v1/auth/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: env.loginEmail,
        password: env.loginPassword,
      }),
    })

    const payload = await response.json() as { sessionToken: string; email: string; quota: { dailyRequestsLimit: number } }
    expect(response.status).toBe(200)
    expect(payload.email).toBe(env.loginEmail)
    expect(payload.sessionToken.length).toBeGreaterThan(10)
    expect(payload.quota.dailyRequestsLimit).toBe(2000)
  })

  it("translates text for an authenticated session and records usage", async () => {
    await startServer(await createUserDb())
    translateViaManagedProviderMock.mockResolvedValue(["你好"])

    const sessionToken = await createSessionToken()

    const translateResponse = await fetch(`${baseURL}/v1/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
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
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    })
    const refreshed = await refreshResponse.json() as { usage: { totalRequests: number; totalCharacters: number }; quota: { remainingDailyRequests: number } }

    expect(refreshed.usage.totalRequests).toBe(1)
    expect(refreshed.usage.totalCharacters).toBe(5)
    expect(refreshed.quota.remainingDailyRequests).toBe(1999)
  })

  it("returns account profile and usage snapshots for an authenticated user", async () => {
    await startServer(await createUserDb())
    const sessionToken = await createSessionToken()

    const [accountResponse, usageResponse] = await Promise.all([
      fetch(`${baseURL}/v1/account`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      }),
      fetch(`${baseURL}/v1/account/usage`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      }),
    ])

    const account = await accountResponse.json() as { id: string; billingEmail: string }
    const usage = await usageResponse.json() as { generatedAt: string; quota: { dailyRequestsLimit: number } }

    expect(accountResponse.status).toBe(200)
    expect(account.id).toBe("usr_demo")
    expect(account.billingEmail).toBe("billing@astra.local")
    expect(usageResponse.status).toBe(200)
    expect(usage.quota.dailyRequestsLimit).toBe(2000)
    expect(typeof usage.generatedAt).toBe("string")
  })

  it("updates the account plan and applies downgraded provider access", async () => {
    await startServer(await createUserDb())
    const sessionToken = await createSessionToken()

    const patchResponse = await fetch(`${baseURL}/v1/account/plan`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
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
        Authorization: `Bearer ${sessionToken}`,
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
    const sessionToken = await createSessionToken()

    const response = await fetch(`${baseURL}/v1/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
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

  it("creates checkout and portal billing links for the authenticated user", async () => {
    await startServer(await createUserDb())
    const sessionToken = await createSessionToken()

    const [checkoutResponse, portalResponse] = await Promise.all([
      fetch(`${baseURL}/v1/billing/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ plan: "pro" }),
      }),
      fetch(`${baseURL}/v1/billing/portal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({}),
      }),
    ])

    const checkout = await checkoutResponse.json() as { kind: string; url: string }
    const portal = await portalResponse.json() as { kind: string; url: string }

    expect(checkoutResponse.status).toBe(200)
    expect(checkout.kind).toBe("checkout")
    expect(checkout.url).toContain("https://billing.example/checkout")
    expect(checkout.url).toContain("targetPlan=pro")

    expect(portalResponse.status).toBe(200)
    expect(portal.kind).toBe("portal")
    expect(portal.url).toContain("https://billing.example/portal")
    expect(portal.url).toContain("accountId=usr_demo")
  })
})
