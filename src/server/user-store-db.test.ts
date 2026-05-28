import { createHash } from "node:crypto"
import { mkdtemp, readFile, unlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { loadAuthoritativeUserDatabase } from "./user-store"
import type { RelayEnv } from "./types"

async function createEnv() {
  const dir = await mkdtemp(join(tmpdir(), "astra-user-store-db-"))
  const userDbPath = join(dir, "users.json")

  return {
    env: {
      port: 8787,
      host: "127.0.0.1",
      publicBaseURL: "http://127.0.0.1:8787/v1",
      sessionPublicBaseURL: "https://platform.astra.example/v1",
      sessionSecret: "test-secret",
      platformMirrorSecret: "mirror-secret",
      operatorPrincipals: [],
      userDbPath,
      videoNoteStorePath: join(dir, "video-notes.json"),
      supportReportInboxPath: join(dir, "support-reports.json"),
      supportKnownIssueStorePath: join(dir, "support-known-issues.json"),
      featureFlagRuntimePath: join(dir, "feature-flags.json"),
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
      emailSignInCodeDevelopmentEcho: false,
      oauthIdentityDevelopmentRedeem: false,
    } satisfies RelayEnv,
    userDbPath,
  }
}

describe("loadAuthoritativeUserDatabase", () => {
  it("migrates legacy data in memory without rewriting when persistNormalized is false", async () => {
    const { env, userDbPath } = await createEnv()
    await writeFile(userDbPath, JSON.stringify({
      version: 1,
      users: [{
        email: "demo@astra.local",
        billingEmail: "billing@astra.local",
        createdAt: "2026-03-01T00:00:00.000Z",
        passwordHash: createHash("sha256").update("astra-demo-pass").digest("hex"),
        plan: "pro",
        subscriptionStatus: "active",
        providerEntitlements: ["openai", "gemini"],
        limits: {
          dailyRequests: 2000,
          dailyCharacters: 500_000,
          requestsPerMinute: 120,
        },
        usage: {
          usageDay: "2026-04-10",
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
      }],
    }, null, 2))

    const parsed = await loadAuthoritativeUserDatabase(env, {
      seedIfMissing: false,
      persistNormalized: false,
    })

    expect(parsed.version).toBe(2)
    expect(parsed.devices).toEqual([])
    expect(JSON.parse(await readFile(userDbPath, "utf8"))).toEqual(expect.objectContaining({ version: 1 }))
  })

  it("fails fast when the authoritative user database is missing in read-only mode", async () => {
    const { env, userDbPath } = await createEnv()
    await unlink(userDbPath).catch(() => {})

    await expect(loadAuthoritativeUserDatabase(env, {
      seedIfMissing: false,
      persistNormalized: false,
    })).rejects.toThrow(/Unable to load authoritative user database/)
  })
})
