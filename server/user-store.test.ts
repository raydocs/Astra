import { createHash } from "node:crypto"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { FileUserStore } from "./user-store"
import type { RelayEnv } from "./types"

async function createEnv() {
  const dir = await mkdtemp(join(tmpdir(), "astra-store-"))
  const userDbPath = join(dir, "users.json")

  const env: RelayEnv = {
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

  await writeFile(userDbPath, JSON.stringify({
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
        dailyRequests: 2,
        dailyCharacters: 10,
        requestsPerMinute: 2,
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

  return env
}

describe("file user store", () => {
  it("validates credentials from the file-backed user database", async () => {
    const store = new FileUserStore(await createEnv())
    const user = await store.validateCredentials("demo@astra.local", "astra-demo-pass")

    expect(user?.email).toBe("demo@astra.local")
  })

  it("records usage and updates quota snapshots", async () => {
    const env = await createEnv()
    const store = new FileUserStore(env)
    const now = new Date()

    await store.recordTranslationUsage({
      email: "demo@astra.local",
      provider: "openai",
      characterCount: 5,
      timestamp: now,
    })

    const session = await store.getSession("demo@astra.local", "token-1")
    expect(session?.usage.totalCharacters).toBe(5)
    expect(session?.quota.remainingDailyRequests).toBe(1)
  })

  it("returns account and usage snapshots independently from the session", async () => {
    const env = await createEnv()
    const store = new FileUserStore(env)

    const account = await store.getAccount("demo@astra.local")
    const usage = await store.getUsageSnapshot("demo@astra.local")

    expect(account?.id).toBe("usr_demo")
    expect(account?.billingEmail).toBe("billing@astra.local")
    expect(usage?.quota.dailyRequestsLimit).toBe(2)
    expect(typeof usage?.generatedAt).toBe("string")
  })

  it("updates plan policy and entitlements", async () => {
    const env = await createEnv()
    const store = new FileUserStore(env)

    const account = await store.updatePlan("demo@astra.local", "free")
    const session = await store.getSession("demo@astra.local", "token-1")

    expect(account?.plan).toBe("free")
    expect(account?.providerEntitlements).toEqual(["openai"])
    expect(session?.quota.dailyRequestsLimit).toBe(100)
    expect(session?.quota.requestsPerMinuteLimit).toBe(10)
  })

  it("persists usage events to disk", async () => {
    const env = await createEnv()
    const store = new FileUserStore(env)

    await store.recordTranslationUsage({
      email: "demo@astra.local",
      provider: "gemini",
      characterCount: 4,
      timestamp: new Date("2026-03-25T12:00:00.000Z"),
    })

    const db = JSON.parse(await readFile(env.userDbPath, "utf8")) as { users: Array<{ usage: { recentEvents: Array<{ provider: string }> } }> }
    expect(db.users[0]?.usage.recentEvents[0]?.provider).toBe("gemini")
  })
})
