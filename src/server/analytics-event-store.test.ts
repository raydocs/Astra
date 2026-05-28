import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { FileAnalyticsEventStore } from "./analytics-event-store"
import type { RelayEnv } from "./types"

function createEnv(path: string): RelayEnv {
  return {
    port: 8787,
    host: "127.0.0.1",
    publicBaseURL: "http://127.0.0.1:8787/v1",
    sessionPublicBaseURL: "http://127.0.0.1:8787/v1",
    sessionSecret: "test-secret",
    operatorPrincipals: [],
    userDbPath: join(path, "users.json"),
    videoNoteStorePath: join(path, "video-notes.json"),
    supportReportInboxPath: join(path, "support-reports.json"),
    supportKnownIssueStorePath: join(path, "support-known-issues.json"),
    featureFlagRuntimePath: join(path, "feature-flags.json"),
    analyticsEventStorePath: join(path, "analytics-events.json"),
    loginEmail: "demo@astra.local",
    loginPassword: "astra-demo-pass",
    plan: "pro",
    subscriptionStatus: "active",
    providerEntitlements: ["openai"],
    billingCheckoutBaseURL: "https://billing.example/checkout",
    billingPortalBaseURL: "https://billing.example/portal",
    openaiApiKey: "",
    googleApiKey: "",
    openrouterApiKey: "",
    useOpenRouter: false,
    openrouterModelMap: {},
    freeDailyRequests: 1,
    freeDailyCharacters: 1,
    freeRpm: 1,
    trialDailyRequests: 1,
    trialDailyCharacters: 1,
    trialRpm: 1,
    proDailyRequests: 1,
    proDailyCharacters: 1,
    proRpm: 1,
    sessionTtlMs: 1000,
    syncMaxMutationsPerRequest: 10,
    videoNoteMaxConcurrentJobs: 1,
    emailSignInCodeDevelopmentEcho: true,
    oauthIdentityDevelopmentRedeem: false,
  }
}

describe("FileAnalyticsEventStore", () => {
  it("stores only canonical metadata and strips safe unknown properties", async () => {
    const dir = await mkdtemp(join(tmpdir(), "astra-analytics-store-"))
    const env = createEnv(dir)
    const store = new FileAnalyticsEventStore(env)

    const result = await store.ingestForUser({
      userId: "usr_demo",
      email: "demo@astra.local",
      now: new Date("2026-05-28T00:00:00.000Z"),
      events: [{
        eventId: "event-1",
        name: "ai_task_completed",
        timestamp: "2026-05-28T01:00:00.000Z",
        properties: {
          plan: "pro",
          cohort: "launch",
          sourceType: "extension",
          taskClass: "deep_reading",
          outcome: "success",
          ignored: "stripped",
        },
      }],
    })

    expect(result.acceptedCount).toBe(1)
    expect(result.events[0]?.properties).toEqual({
      plan: "pro",
      cohort: "launch",
      sourceType: "extension",
      taskClass: "deep_reading",
      outcome: "success",
    })

    const raw = await readFile(env.analyticsEventStorePath ?? "", "utf8")
    expect(raw).not.toContain("demo@astra.local")
    expect(raw).not.toContain("ignored")
  })

  it("rejects content-shaped fields and mismatched categories", async () => {
    const dir = await mkdtemp(join(tmpdir(), "astra-analytics-store-"))
    const store = new FileAnalyticsEventStore(createEnv(dir))

    await expect(store.ingestForUser({
      userId: "usr_demo",
      email: "demo@astra.local",
      events: [{ name: "translation_completed", properties: { pageText: "private text" } }],
    })).rejects.toThrow(/unsafe field/)

    await expect(store.ingestForUser({
      userId: "usr_demo",
      email: "demo@astra.local",
      events: [{ name: "review_completed", category: "cost", properties: {} }],
    })).rejects.toThrow(/category/)
  })

  it("summarizes aggregate cohorts without per-user rows", async () => {
    const dir = await mkdtemp(join(tmpdir(), "astra-analytics-store-"))
    const store = new FileAnalyticsEventStore(createEnv(dir))

    await store.ingestForUser({
      userId: "usr_demo",
      email: "demo@astra.local",
      events: [
        { name: "onboarding_completed", timestamp: "2026-05-28T01:00:00.000Z", properties: { plan: "pro", cohort: "launch" } },
        { name: "onboarding_completed", timestamp: "2026-05-29T01:00:00.000Z", properties: { plan: "pro", cohort: "launch" } },
      ],
    })

    const summary = await store.summarizeCohorts({ grain: "week" })
    expect(summary.totalEvents).toBe(2)
    expect(summary.buckets).toEqual([
      { bucket: "2026-05-25", category: "activation", eventName: "onboarding_completed", plan: "pro", cohort: "launch", count: 2 },
    ])
    expect(summary.privacy).toEqual({
      metadataOnly: true,
      perUserRows: false,
      rawContentIncluded: false,
      identifiersIncluded: false,
    })
  })
})
