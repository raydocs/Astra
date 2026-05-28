import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { AstraDeviceIdentity, AstraSession } from "@/types/auth"

import {
  createWebSession,
  createWebCloudDataDelete,
  createWebContinuityExport,
  downloadWebContinuityExport,
  fetchWebAccountWorkspace,
  fetchWebCostUsageSummary,
  fetchWebCancellationReasonSummary,
  fetchWebFeatureFlagRuntime,
  fetchWebOpsAuditSummary,
  fetchWebOpsCockpitSummary,
  fetchWebOpsUserLookup,
  fetchWebProviderHealthSummary,
  fetchWebSupportReportSummary,
  fetchWebSupportReports,
  repairWebCloudSync,
  updateWebFeatureFlagRuntime,
  updateWebSupportReportTriage,
} from "./astra-web"

function createLocalStorageMock() {
  const storage = new Map<string, string>()
  return {
    getItem(key: string) {
      return storage.has(key) ? storage.get(key) ?? null : null
    },
    setItem(key: string, value: string) {
      storage.set(key, value)
    },
    removeItem(key: string) {
      storage.delete(key)
    },
    clear() {
      storage.clear()
    },
  }
}

describe("astra-web continuity control-plane", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: createLocalStorageMock(),
      configurable: true,
    })
  })

  afterEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  function createSession(): AstraSession {
    return {
      version: 1,
      sessionToken: "astra-session",
      sessionId: "sess_demo",
      deviceId: "device-current",
      identityMode: "authenticated" as const,
      relayBaseURL: "https://platform.astra.example/v1",
      email: "demo@astra.local",
      plan: "pro" as const,
      subscriptionStatus: "active" as const,
      providerEntitlements: ["openai", "gemini"] as const,
      quota: {
        dailyRequestsLimit: 2000,
        dailyCharactersLimit: 500000,
        requestsPerMinuteLimit: 120,
        remainingDailyRequests: 1999,
        remainingDailyCharacters: 499995,
      },
      usage: {
        totalRequests: 1,
        totalCharacters: 5,
        dailyRequestsUsed: 1,
        dailyCharactersUsed: 5,
        lastRequestAt: null,
        recentEvents: [],
      },
      issuedAt: "2026-04-10T00:00:00.000Z",
      expiresAt: "2026-04-12T00:00:00.000Z",
    }
  }

  function createDevice(): AstraDeviceIdentity {
    return {
      version: 1,
      deviceId: "device-current",
      label: "Astra Chrome",
      platform: "macos" as const,
      browserFamily: "chrome" as const,
      appKind: "web" as const,
      appVersion: "0.1.0-web",
      createdAt: "2026-04-10T00:00:00.000Z",
      updatedAt: "2026-04-11T12:00:00.000Z",
    }
  }

  function createExportJobPayload() {
    return {
      jobId: "exp_job_1",
      scope: { collections: ["config", "vocabulary"] },
      status: "queued",
      requestedAt: "2026-04-11T12:00:00.000Z",
      startedAt: null,
      completedAt: null,
      failedAt: null,
      expiresAt: null,
      artifact: { objectKey: null, sha256: null, bytes: null, downloadPath: null },
      error: null,
      policy: {
        exportArtifactRetentionDays: 7,
        deleteGracePeriodSeconds: 604800,
        jobHistoryRetentionDays: 90,
        tombstoneRetentionDays: 30,
      },
    }
  }

  function createDeleteJobPayload() {
    return {
      jobId: "del_job_1",
      scope: { collections: ["vocabulary", "reading_history"] },
      status: "scheduled",
      requestedAt: "2026-04-11T12:00:00.000Z",
      scheduledForAt: "2026-04-18T12:00:00.000Z",
      startedAt: null,
      completedAt: null,
      failedAt: null,
      canceledAt: null,
      gracePeriodSeconds: 604800,
      deletedRecords: {},
      error: null,
      policy: {
        exportArtifactRetentionDays: 7,
        deleteGracePeriodSeconds: 604800,
        jobHistoryRetentionDays: 90,
        tombstoneRetentionDays: 30,
      },
    }
  }

  it("reuses a persisted web sign-in key until authenticated issuance succeeds", async () => {
    window.localStorage.setItem("astra.web.auth-sign-in-key.v1", JSON.stringify({
      email: "demo@astra.local",
      idempotencyKey: "web-sign-in-key-1",
    }))
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(createSession()), {
      status: 200,
      headers: { "content-type": "application/json" },
    }))

    const session = await createWebSession({
      baseURL: "https://platform.astra.example/v1",
      device: createDevice(),
      email: "Demo@Astra.Local",
      password: "secret-pass",
    })

    expect(session.sessionToken).toBe("astra-session")
    expect(fetchSpy).toHaveBeenCalledWith("https://platform.astra.example/v1/auth/session", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "Idempotency-Key": "web-sign-in-key-1",
        "X-Astra-Device-Id": "device-current",
      }),
    }))
    expect(window.localStorage.getItem("astra.web.auth-sign-in-key.v1")).toBeNull()
  })

  it("preserves the web sign-in key across ambiguous mirror-back retries", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: {
          code: "UPSTREAM_UNAVAILABLE",
          message: "Retry with the same Idempotency-Key.",
        },
      }), {
        status: 503,
        headers: {
          "content-type": "application/json",
          "x-astra-platform-fallback-reason": "mirror_back_commit_unknown",
        },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify(createSession()), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))

    await expect(createWebSession({
      baseURL: "https://platform.astra.example/v1",
      device: createDevice(),
      email: "demo@astra.local",
      password: "secret-pass",
    })).rejects.toThrow("Retry with the same Idempotency-Key.")

    const pending = JSON.parse(window.localStorage.getItem("astra.web.auth-sign-in-key.v1") ?? "{}") as {
      email?: string
      idempotencyKey?: string
    }
    expect(pending.email).toBe("demo@astra.local")
    expect(pending.idempotencyKey).toBeTruthy()

    await createWebSession({
      baseURL: "https://platform.astra.example/v1",
      device: createDevice(),
      email: "demo@astra.local",
      password: "secret-pass",
    })

    expect(fetchSpy).toHaveBeenNthCalledWith(1, "https://platform.astra.example/v1/auth/session", expect.objectContaining({
      headers: expect.objectContaining({
        "Idempotency-Key": pending.idempotencyKey,
      }),
    }))
    expect(fetchSpy).toHaveBeenNthCalledWith(2, "https://platform.astra.example/v1/auth/session", expect.objectContaining({
      headers: expect.objectContaining({
        "Idempotency-Key": pending.idempotencyKey,
      }),
    }))
    expect(window.localStorage.getItem("astra.web.auth-sign-in-key.v1")).toBeNull()
  })

  function createSummaryPayload() {
    return {
      serverTime: "2026-04-11T12:00:00.000Z",
      account: {
        id: "usr_demo",
        relayBaseURL: "https://platform.astra.example/v1",
        email: "demo@astra.local",
        billingEmail: "billing@astra.local",
        createdAt: "2026-04-01T00:00:00.000Z",
        plan: "pro",
        subscriptionStatus: "active",
        providerEntitlements: ["openai", "gemini"],
      },
      usage: {
        generatedAt: "2026-04-11T12:00:00.000Z",
        quota: {
          dailyRequestsLimit: 2000,
          dailyCharactersLimit: 500000,
          requestsPerMinuteLimit: 120,
          remainingDailyRequests: 1999,
          remainingDailyCharacters: 499995,
        },
        usage: {
          totalRequests: 1,
          totalCharacters: 5,
          dailyRequestsUsed: 1,
          dailyCharactersUsed: 5,
          lastRequestAt: null,
          recentEvents: [],
        },
      },
      session: {
        sessionId: "sess_demo",
        deviceId: "device-current",
        issuedAt: "2026-04-10T00:00:00.000Z",
        expiresAt: "2026-04-12T00:00:00.000Z",
        identityMode: "authenticated",
        status: "active",
      },
      devices: {
        activeCount: 1,
        revokedCount: 0,
        current: {
          deviceId: "device-current",
          label: "Astra Chrome",
          platform: "macos",
          browserFamily: "chrome",
          appKind: "web",
          appVersion: "0.1.0-web",
          firstSeenAt: "2026-04-10T00:00:00.000Z",
          lastSeenAt: "2026-04-11T12:00:00.000Z",
          lastSyncAt: "2026-04-11T12:00:00.000Z",
          status: "active",
          isCurrentDevice: true,
        },
        entries: [{
          deviceId: "device-current",
          label: "Astra Chrome",
          platform: "macos",
          browserFamily: "chrome",
          appKind: "web",
          appVersion: "0.1.0-web",
          firstSeenAt: "2026-04-10T00:00:00.000Z",
          lastSeenAt: "2026-04-11T12:00:00.000Z",
          lastSyncAt: "2026-04-11T12:00:00.000Z",
          status: "active",
          isCurrentDevice: true,
        }],
      },
      sync: {
        maxMutationsPerRequest: 200,
        collections: {
          config: { enabled: true, defaultEnabled: true, cursor: "1", mutationCount: 1, activeCount: 1, lastSyncAt: "2026-04-11T12:00:00.000Z", compactionFloorCursor: null },
          vocabulary: { enabled: true, defaultEnabled: true, cursor: null, mutationCount: 0, activeCount: 0, lastSyncAt: null, compactionFloorCursor: null },
          review_schedule: { enabled: true, defaultEnabled: true, cursor: null, mutationCount: 0, activeCount: 0, lastSyncAt: null, compactionFloorCursor: null },
          reading_history: { enabled: false, defaultEnabled: false, cursor: null, mutationCount: 0, activeCount: 0, lastSyncAt: null, compactionFloorCursor: null },
          study_progress: { enabled: false, defaultEnabled: false, cursor: null, mutationCount: 0, activeCount: 0, lastSyncAt: null, compactionFloorCursor: null },
        },
      },
    }
  }

  it("creates continuity export and delete jobs through the shared web control-plane helpers", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(createExportJobPayload()), {
        status: 202,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify(createDeleteJobPayload()), {
        status: 202,
        headers: { "content-type": "application/json" },
      }))

    const session = createSession()
    const device = createDevice()

    const exportJob = await createWebContinuityExport({
      session,
      device,
      collections: ["config", "vocabulary"],
      idempotencyKey: "export-key-1",
    })
    const deleteJob = await createWebCloudDataDelete({
      session,
      device,
      collections: ["vocabulary", "reading_history"],
      idempotencyKey: "delete-key-1",
    })

    expect(exportJob.jobId).toBe("exp_job_1")
    expect(deleteJob.jobId).toBe("del_job_1")
    expect(fetchSpy).toHaveBeenNthCalledWith(1, "https://platform.astra.example/v1/account/export", expect.objectContaining({
      method: "POST",
      headers: {
        Authorization: "Bearer astra-session",
        "X-Astra-Device-Id": "device-current",
        "Content-Type": "application/json",
        "Idempotency-Key": "export-key-1",
      },
    }))
    expect(fetchSpy).toHaveBeenNthCalledWith(2, "https://platform.astra.example/v1/account/cloud-data-delete", expect.objectContaining({
      method: "POST",
      headers: {
        Authorization: "Bearer astra-session",
        "X-Astra-Device-Id": "device-current",
        "Content-Type": "application/json",
        "Idempotency-Key": "delete-key-1",
      },
    }))
  })

  it("downloads a continuity export with device-aware auth headers", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json" },
    }))

    const blob = await downloadWebContinuityExport({
      session: createSession(),
      device: createDevice(),
      jobId: "exp_job_1",
    })

    // undici/fetch may return a Blob from a different realm than globalThis.Blob in jsdom.
    expect(blob.size).toBe(2)
    expect(blob.type).toBe("application/json")
    expect(fetchSpy).toHaveBeenCalledWith("https://platform.astra.example/v1/account/export/exp_job_1/download", expect.objectContaining({
      method: "GET",
      headers: {
        Authorization: "Bearer astra-session",
        "X-Astra-Device-Id": "device-current",
      },
    }))
  })

  it("posts manual sync repair with device-aware auth headers", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      serverTime: "2026-04-11T12:00:00.000Z",
      collections: {
        config: { enabled: true, defaultEnabled: true, latestCursor: "cfg-4", compactionFloorCursor: "cfg-2", records: [{ recordId: "global", payload: { kind: "global" }, lastClientMutationId: "cfg-4", lastDeviceId: "device-current", lastServerUpdatedAt: "2026-04-11T11:59:00.000Z", cursor: "cfg-4" }] },
        vocabulary: { enabled: true, defaultEnabled: true, latestCursor: "voc-1", compactionFloorCursor: null, records: [] },
        review_schedule: { enabled: true, defaultEnabled: true, latestCursor: null, compactionFloorCursor: null, records: [] },
        reading_history: { enabled: false, defaultEnabled: false, latestCursor: null, compactionFloorCursor: null, records: [] },
        study_progress: { enabled: false, defaultEnabled: false, latestCursor: null, compactionFloorCursor: null, records: [] },
      },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }))

    const repair = await repairWebCloudSync({
      session: createSession(),
      device: createDevice(),
      request: { collections: ["config", "vocabulary"] },
    })

    expect(repair.collections.config.records).toHaveLength(1)
    expect(fetchSpy).toHaveBeenCalledWith("https://platform.astra.example/v1/sync/repair", expect.objectContaining({
      method: "POST",
      headers: {
        Authorization: "Bearer astra-session",
        "X-Astra-Device-Id": "device-current",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ collections: ["config", "vocabulary"] }),
    }))
  })

  it("fetches aggregate cost usage summary with operator-token headers", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      schema: "astra-cost-usage-summary.v1",
      generatedAt: "2026-05-27T12:00:00.000Z",
      source: "recent_user_usage_events",
      recentEventsPerUserLimit: 10,
      totalEvents: "3",
      totalRequests: "7",
      totalCharacters: "3200",
      totalEstimatedSpendUsd: "0.0134",
      estimateRegistry: "internal_deterministic_v1",
      cacheHitRate: "0.5",
      dailyEstimate: {
        date: "2026-05-27",
        estimatedSpendUsd: "0.0134",
        previousDate: "2026-05-26",
        previousEstimatedSpendUsd: "0.004",
        spikeRatio: "3.35",
        spikeStatus: "spike",
        riskLevel: "high",
      },
      buckets: [{
        tier: "pro",
        taskClass: "deep_read",
        costBucket: "high",
        eventCount: "2",
        requestCount: "5",
        characterCount: "2600",
        successCount: "2",
        failureCount: "0",
        fallbackCount: "1",
        estimatedSpendUsd: "0.011",
      }],
      byServiceMode: [{
        serviceMode: "automatic",
        eventCount: "3",
        requestCount: "7",
        characterCount: "3200",
        successCount: "3",
        failureCount: "0",
        fallbackCount: "1",
        latencySampleCount: "2",
        latencyP50Ms: "500",
        latencyP95Ms: "1200",
        estimatedSpendUsd: "0.0134",
      }],
      byCacheStatus: [{ cacheStatus: "hit", eventCount: "1", requestCount: "2", characterCount: "600", share: "0.3333", estimatedSpendUsd: "0.0024" }, { cacheStatus: "miss", eventCount: "1", requestCount: "2", characterCount: "600", share: "0.3333", estimatedSpendUsd: "0.011" }],
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }))

    const summary = await fetchWebCostUsageSummary({
      baseURL: "https://platform.astra.example/v1/",
      operatorToken: " operator-secret ",
    })

    expect(summary).toMatchObject({
      schema: "astra-cost-usage-summary.v1",
      source: "recent_user_usage_events",
      totalEvents: 3,
      totalRequests: 7,
      totalCharacters: 3200,
      totalEstimatedSpendUsd: 0.0134,
      estimateRegistry: "internal_deterministic_v1",
      cacheHitRate: 0.5,
      dailyEstimate: expect.objectContaining({ estimatedSpendUsd: 0.0134, spikeRatio: 3.35, spikeStatus: "spike", riskLevel: "high" }),
      buckets: [expect.objectContaining({ tier: "pro", taskClass: "deep_read", costBucket: "high", fallbackCount: 1, estimatedSpendUsd: 0.011 })],
      byServiceMode: [expect.objectContaining({ serviceMode: "automatic", latencyP95Ms: 1200, estimatedSpendUsd: 0.0134 })],
    })
    expect(summary.byCacheStatus).toContainEqual(expect.objectContaining({ cacheStatus: "hit", eventCount: 1, share: 0.3333, estimatedSpendUsd: 0.0024 }))
    expect(JSON.stringify(summary)).not.toContain("user@example.com")
    expect(JSON.stringify(summary)).not.toContain("gpt-4.1")
    expect(fetchSpy).toHaveBeenCalledWith("https://platform.astra.example/v1/ops/cost/usage-summary", expect.objectContaining({
      method: "GET",
      headers: { "x-astra-operator-token": "operator-secret" },
    }))
  })

  it("keeps missing ops cockpit privacy and source fields conservative", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      schema: "astra-ops-cockpit-summary.v1",
      generatedAt: "2026-05-28T12:00:00.000Z",
      metrics: {
        cost: { retainedEvents: "2", requests: "5", dailyEstimatedSpendUsd: "0.013", dailyRiskLevel: "watch", dailySpikeStatus: "watch" },
        support: { totalReports: "1" },
        retentionGrowth: { analyticsEvents: "3", mobileRetentionEvents: "4" },
        providerHealth: { available: true, incidentBucketCount: "1", watchBucketCount: "2" },
      },
      riskFlags: [{ code: "provider_health_incident", severity: "pause_growth", message: "Route health incident." }],
      email: "demo@astra.local",
      text: "Hello, world.",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }))

    const summary = await fetchWebOpsCockpitSummary({
      baseURL: "https://platform.astra.example/v1/",
      operatorToken: " operator-secret ",
    })

    expect(summary.privacy).toMatchObject({
      metadataOnly: false,
      aggregateOnly: false,
      readOnly: false,
      contentIncluded: false,
      perUserRows: false,
      identifiersIncluded: false,
      providerBillingIncluded: false,
      crmRepliesIncluded: false,
    })
    expect(summary.sources).toMatchObject({
      costUsageSummary: false,
      supportReportSummary: false,
      cancellationReasonSummary: false,
      analyticsCohortSummary: false,
      mobileRetentionSummary: false,
      weeklyDigestDeliverySummary: false,
      providerHealthSummary: false,
      operatingReviewHelpers: false,
    })
    expect(summary.metrics.cost).toMatchObject({ retainedEvents: 2, requests: 5, dailyEstimatedSpendUsd: 0.013, dailyRiskLevel: "watch" })
    expect(summary.metrics.providerHealth).toMatchObject({ available: true, incidentBucketCount: 1, watchBucketCount: 2 })
    expect(summary.riskFlags).toContainEqual(expect.objectContaining({ code: "provider_health_incident", severity: "pause_growth" }))
    expect(JSON.stringify(summary)).not.toContain("demo@astra.local")
    expect(JSON.stringify(summary)).not.toContain("Hello, world")
    expect(fetchSpy).toHaveBeenCalledWith("https://platform.astra.example/v1/ops/cockpit/summary", expect.objectContaining({
      method: "GET",
      headers: { "x-astra-operator-token": "operator-secret" },
    }))
  })

  it("fetches operator audit summary with operator-token headers", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      schema: "astra-ops-audit-summary.v1",
      generatedAt: "2026-05-27T12:00:00.000Z",
      totalEvents: "2",
      retainedEventLimit: "500",
      byAction: [{ action: "ops_user_lookup", count: "1" }],
      byActor: [{ actor: "operator", count: "1" }],
      privacy: {
        userConsentTrueCount: "1",
        metadataOnlyCount: "2",
        contentIncludedCount: "0",
      },
      recent: [{
        id: "audit_1",
        timestamp: "2026-05-27T12:00:00.000Z",
        actor: "operator",
        action: "ops_user_lookup",
        outcome: "success",
        operatorTokenHash: "b".repeat(64),
        subjectUserId: "usr_demo",
        subjectEmailHash: "a".repeat(64),
        supportReportId: null,
        metadata: { queryType: "email" },
        privacy: { userConsent: null, contentIncluded: false, contentAccess: "metadata_only" },
      }],
      email: "demo@astra.local",
      text: "Hello, world.",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }))

    const summary = await fetchWebOpsAuditSummary({
      baseURL: "https://platform.astra.example/v1/",
      operatorToken: " operator-secret ",
    })

    expect(summary).toMatchObject({
      schema: "astra-ops-audit-summary.v1",
      totalEvents: 2,
      retainedEventLimit: 500,
      byAction: [expect.objectContaining({ action: "ops_user_lookup", count: 1 })],
      byActor: [expect.objectContaining({ actor: "operator", count: 1 })],
      privacy: { userConsentTrueCount: 1, metadataOnlyCount: 2, contentIncludedCount: 0 },
      recent: [expect.objectContaining({ action: "ops_user_lookup", subjectUserId: "usr_demo" })],
    })
    expect(JSON.stringify(summary)).not.toContain("demo@astra.local")
    expect(JSON.stringify(summary)).not.toContain("Hello, world")
    expect(fetchSpy).toHaveBeenCalledWith("https://platform.astra.example/v1/ops/audit/summary", expect.objectContaining({
      method: "GET",
      headers: { "x-astra-operator-token": "operator-secret" },
    }))
  })

  it("fetches cancellation reason summary with operator-token headers", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      schema: "astra-cancellation-reason-summary.v1",
      generatedAt: "2026-05-27T12:00:00.000Z",
      totalSubmissions: "2",
      retainedEventLimit: "500",
      reasonCoverage: { submittedCount: "2", unknownReasonCount: "0", coverageRate: "1" },
      byReason: [{ reason: "privacy_concerns", label: "Privacy concerns", productMeaning: "Trust work.", count: "2", share: "1" }],
      byPlan: [{ plan: "pro", count: "2" }],
      bySource: [{ source: "settings", count: "1" }, { source: "refund_request", count: "1" }],
      subjectUserId: "usr_demo",
      subjectEmailHash: "a".repeat(64),
      email: "demo@astra.local",
      deviceId: "device-current",
      text: "Hello, world.",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }))

    const summary = await fetchWebCancellationReasonSummary({
      baseURL: "https://platform.astra.example/v1/",
      operatorToken: " operator-secret ",
    })

    expect(summary).toMatchObject({
      schema: "astra-cancellation-reason-summary.v1",
      totalSubmissions: 2,
      retainedEventLimit: 500,
      reasonCoverage: { submittedCount: 2, unknownReasonCount: 0, coverageRate: 1 },
      byReason: [expect.objectContaining({ reason: "privacy_concerns", count: 2, share: 1 })],
      byPlan: [{ plan: "pro", count: 2 }],
      bySource: [{ source: "settings", count: 1 }, { source: "refund_request", count: 1 }],
    })
    expect(JSON.stringify(summary)).not.toContain("usr_demo")
    expect(JSON.stringify(summary)).not.toContain("aaaaaaaaaaaa")
    expect(JSON.stringify(summary)).not.toContain("demo@astra.local")
    expect(JSON.stringify(summary)).not.toContain("device-current")
    expect(JSON.stringify(summary)).not.toContain("Hello, world")
    expect(fetchSpy).toHaveBeenCalledWith("https://platform.astra.example/v1/ops/cancellations/reasons/summary", expect.objectContaining({
      method: "GET",
      headers: { "x-astra-operator-token": "operator-secret" },
    }))
  })

  it("fetches operator user lookup with operator-token headers", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      schema: "astra-ops-user-lookup.v1",
      generatedAt: "2026-05-27T12:00:00.000Z",
      queryType: "email",
      resultWindow: {
        mode: "exact_lookup",
        limit: "1",
        cursor: null,
        nextCursor: null,
        returnedCount: "1",
        totalMatched: "1",
        hasMore: false,
      },
      snapshotBoundary: {
        metadataOnly: true,
        contentIncluded: false,
        rawQueryIncluded: false,
        exportAvailable: false,
        recentTaskSummaryLimit: "6",
        excludedFields: ["email", "deviceId", "sessionId", "provider", "model", "rawQuery", "rawText"],
      },
      user: {
        userId: "usr_demo",
        emailHash: "a".repeat(64),
        createdAt: "2026-03-01T00:00:00.000Z",
        plan: "pro",
        subscriptionStatus: "active",
        identityMode: "authenticated",
        providerEntitlementCount: "2",
        limits: { dailyRequests: "2000", dailyCharacters: "500000", requestsPerMinute: "120" },
        usage: {
          usageDay: "2026-05-27",
          requestsToday: "120",
          charactersToday: "60000",
          totalRequests: "320",
          totalCharacters: "150000",
          lastRequestAt: "2026-05-27T00:02:00.000Z",
          recentEventCount: "3",
          usageCategory: "heavy",
        },
        devices: { activeCount: "1", revokedCount: "0" },
        sessions: { activeCount: "1", revokedCount: "0" },
        recentTaskSummary: [{
          taskClass: "paragraph_understanding",
          eventCount: "2",
          successCount: "1",
          failureCount: "1",
          fallbackCount: "1",
          latencySampleCount: "2",
          latencyP95Ms: "240",
        }],
      },
      email: "demo@astra.local",
      text: "Hello, world.",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }))

    const summary = await fetchWebOpsUserLookup({
      baseURL: "https://platform.astra.example/v1/",
      operatorToken: " operator-secret ",
      query: " demo@astra.local ",
    })

    expect(summary).toMatchObject({
      schema: "astra-ops-user-lookup.v1",
      queryType: "email",
      resultWindow: { mode: "exact_lookup", limit: 1, returnedCount: 1, totalMatched: 1, hasMore: false },
      snapshotBoundary: { metadataOnly: true, contentIncluded: false, rawQueryIncluded: false, exportAvailable: false, recentTaskSummaryLimit: 6 },
      user: {
        userId: "usr_demo",
        plan: "pro",
        providerEntitlementCount: 2,
        usage: { usageCategory: "heavy", requestsToday: 120, recentEventCount: 3 },
        recentTaskSummary: [expect.objectContaining({ taskClass: "paragraph_understanding", latencyP95Ms: 240 })],
      },
    })
    expect(JSON.stringify(summary)).not.toContain("demo@astra.local")
    expect(JSON.stringify(summary)).not.toContain("Hello, world")
    expect(summary.snapshotBoundary.excludedFields).toEqual(expect.arrayContaining(["rawQuery", "rawText", "provider", "model"]))
    expect(summary.snapshotBoundary.exportAvailable).toBe(false)
    expect(fetchSpy).toHaveBeenCalledWith("https://platform.astra.example/v1/ops/users/lookup?query=demo%40astra.local", expect.objectContaining({
      method: "GET",
      headers: { "x-astra-operator-token": "operator-secret" },
    }))
  })

  it("fetches provider health summary with operator-token headers", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      schema: "astra-provider-health-summary.v1",
      generatedAt: "2026-05-27T12:00:00.000Z",
      source: "recent_user_usage_events",
      recentEventsPerUserLimit: 10,
      totalEvents: "3",
      totalRequests: "7",
      totalCharacters: "3200",
      buckets: [{
        provider: "openai",
        model: "gpt-health-pro",
        serviceMode: "automatic",
        taskClass: "deep_read",
        eventCount: "2",
        requestCount: "5",
        characterCount: "2600",
        successCount: "1",
        failureCount: "1",
        fallbackCount: "1",
        successRate: "0.5",
        fallbackRate: "0.5",
        latencySampleCount: "2",
        latencyP50Ms: "500",
        latencyP95Ms: "1200",
        healthStatus: "incident",
      }],
      userEmail: "user@example.com",
      text: "Hello, world.",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }))

    const summary = await fetchWebProviderHealthSummary({
      baseURL: "https://platform.astra.example/v1/",
      operatorToken: " operator-secret ",
    })

    expect(summary).toMatchObject({
      schema: "astra-provider-health-summary.v1",
      source: "recent_user_usage_events",
      totalEvents: 3,
      totalRequests: 7,
      totalCharacters: 3200,
      buckets: [expect.objectContaining({
        provider: "openai",
        model: "gpt-health-pro",
        serviceMode: "automatic",
        taskClass: "deep_read",
        healthStatus: "incident",
        successRate: 0.5,
        fallbackRate: 0.5,
        latencyP95Ms: 1200,
      })],
    })
    expect(JSON.stringify(summary)).not.toContain("user@example.com")
    expect(JSON.stringify(summary)).not.toContain("Hello, world.")
    expect(fetchSpy).toHaveBeenCalledWith("https://platform.astra.example/v1/ops/provider-health/summary", expect.objectContaining({
      method: "GET",
      headers: { "x-astra-operator-token": "operator-secret" },
    }))
  })

  it("fetches support report summary and list with operator-token headers", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url === "https://platform.astra.example/v1/ops/support/reports/summary") {
        return new Response(JSON.stringify({
          totalReports: 1,
          generatedAt: "2026-05-27T12:00:00.000Z",
          buckets: [{
            key: "library|review_library",
            count: 1,
            latestSubmittedAt: "2026-05-27T11:00:00.000Z",
            hostname: "library.example",
            featureSurface: "library",
            issueCategory: "review_library",
            extensionVersion: "1.0.0",
            browser: "Chrome",
            membershipState: "free",
            privacyMode: true,
            knownIssueId: null,
            knownIssueStatus: null,
            triageStatus: "new",
          }],
          weeklyTopIssues: [{
            weekStart: "2026-05-25",
            key: "2026-05-25|library.example|library|review_library|no_known_issue",
            reportCount: "1",
            latestSubmittedAt: "2026-05-27T11:00:00.000Z",
            hostname: "library.example",
            featureSurface: "library",
            issueCategory: "review_library",
            knownIssueId: null,
            knownIssueStatus: null,
          }],
          handoffSummary: {
            byPath: [{ path: "email_follow_up", count: "1" }],
            byStatus: [{ status: "handed_off", count: "1" }],
          },
          slaRisk: {
            generatedAt: "2026-05-27T12:00:00.000Z",
            currentNow: "2026-05-27T12:00:00.000Z",
            unresolvedCount: "2",
            urgentUnresolvedCount: "1",
            staleTriageByAgeBucket: { under24h: "0", from24hTo72h: "1", from72hTo168h: "1", over168h: "0" },
            followUpOverdueCount: "1",
            oldestUnresolvedAgeHours: "72.5",
            oldestUnresolvedAgeDays: "3",
          },
          macroCoverage: {
            schema: "astra-support-first-response-macros.v1",
            generatedAt: "2026-05-27T12:00:00.000Z",
            threshold: 0.8,
            catalogCoverage: { coveredIssueCategories: 8, totalIssueCategories: 8, coverageRate: 1, ready: true },
            reportedCoverage: { coveredReports: 1, totalReports: 1, unknownIssueReports: 0, coverageRate: 1, ready: true },
            byIssueCategory: [{ issueCategory: "review_library", count: 1, macroId: "macro_review_library", title: "Saved item or review issue", covered: true }],
            macros: [{
              id: "macro_review_library",
              issueCategory: "review_library",
              title: "Saved item or review issue",
              firstResponse: "Thanks for flagging this.",
              nextStep: "Ask what happened.",
              privacyNote: "Do not include saved text.",
              surfaces: ["library", "review"],
            }],
          },
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      }
      if (url === "https://platform.astra.example/v1/ops/support/reports") {
        return new Response(JSON.stringify({
          schema: "astra-support-report-inbox.v1",
          reports: [{
            reportId: "rpt_1",
            featureSurface: "library",
            hostname: "library.example",
            triage: { status: "new", priority: "normal", assignedTo: null, resolution: null, updatedAt: null, updatedBy: null },
            recommendedMacro: {
              id: "macro_review_library",
              issueCategory: "review_library",
              title: "Saved item or review issue",
              firstResponse: "Thanks for flagging this.",
              nextStep: "Ask what happened.",
              privacyNote: "Do not include saved text.",
              surfaces: ["library", "review"],
            },
          }],
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      }
      throw new Error(`Unexpected fetch url: ${url}`)
    })

    const [summary, list] = await Promise.all([
      fetchWebSupportReportSummary({ baseURL: "https://platform.astra.example/v1", operatorToken: " operator-secret " }),
      fetchWebSupportReports({ baseURL: "https://platform.astra.example/v1", operatorToken: " operator-secret " }),
    ])

    expect(summary.totalReports).toBe(1)
    expect(summary.buckets[0]).toMatchObject({ count: 1, hostname: "library.example", triageStatus: "new" })
    expect(summary.weeklyTopIssues[0]).toMatchObject({
      weekStart: "2026-05-25",
      reportCount: 1,
      hostname: "library.example",
      issueCategory: "review_library",
    })
    expect(summary.macroCoverage?.reportedCoverage).toMatchObject({ coveredReports: 1, totalReports: 1, coverageRate: 1 })
    expect(summary.macroCoverage?.macros[0]).toMatchObject({ id: "macro_review_library", issueCategory: "review_library" })
    expect(summary.handoffSummary.byPath[0]).toEqual({ path: "email_follow_up", count: 1 })
    expect(summary.slaRisk).toMatchObject({
      unresolvedCount: 2,
      urgentUnresolvedCount: 1,
      staleTriageByAgeBucket: { under24h: 0, from24hTo72h: 1, from72hTo168h: 1, over168h: 0 },
      followUpOverdueCount: 1,
      oldestUnresolvedAgeHours: 72.5,
      oldestUnresolvedAgeDays: 3,
    })
    expect(list.reports[0].reportId).toBe("rpt_1")
    expect(list.reports[0].triage.followUp).toMatchObject({ path: "not_selected", status: "not_started", macroId: null })
    expect(list.reports[0].recommendedMacro?.id).toBe("macro_review_library")
    expect(fetchSpy).toHaveBeenNthCalledWith(1, "https://platform.astra.example/v1/ops/support/reports/summary", expect.objectContaining({
      method: "GET",
      headers: { "x-astra-operator-token": "operator-secret" },
    }))
    expect(fetchSpy).toHaveBeenNthCalledWith(2, "https://platform.astra.example/v1/ops/support/reports", expect.objectContaining({
      method: "GET",
      headers: { "x-astra-operator-token": "operator-secret" },
    }))
  })

  it("fetches and updates feature-flag runtime with public GET and operator PUT", async () => {
    const runtime = {
      schema: "astra-feature-flag-runtime.v1" as const,
      generatedAt: "2026-05-27T12:00:00.000Z",
      overrides: [{ key: "ui.library_home" as const, status: "on" as const, reason: "Enabled library", changedBy: "ops", changedAt: "2026-05-27T11:00:00.000Z" }],
      killSwitches: [{
        id: "incident-fallback-copy",
        category: "feature" as const,
        enabled: true,
        reason: "Managed AI incident",
        fallbackMessage: "Astra is temporarily using a simpler response. Please try again later.",
        safeMode: true,
      }],
      changeLog: [{
        id: "chg_1",
        changedAt: "2026-05-27T12:00:00.000Z",
        changedBy: "ops",
        reason: "Managed AI incident",
        overrideCount: 1,
        killSwitchCount: 1,
        previousGeneratedAt: null,
      }],
    }
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(runtime), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...runtime, generatedAt: "2026-05-27T12:05:00.000Z" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))

    const fetched = await fetchWebFeatureFlagRuntime({ baseURL: "https://platform.astra.example/v1/" })
    const updated = await updateWebFeatureFlagRuntime({
      baseURL: "https://platform.astra.example/v1/",
      operatorToken: " operator-secret ",
      runtime: fetched,
    })

    expect(fetched.killSwitches[0]).toMatchObject({ id: "incident-fallback-copy", safeMode: true })
    expect(updated.generatedAt).toBe("2026-05-27T12:05:00.000Z")
    expect(fetchSpy).toHaveBeenNthCalledWith(1, "https://platform.astra.example/v1/ops/feature-flags", {
      method: "GET",
    })
    expect(fetchSpy).toHaveBeenNthCalledWith(2, "https://platform.astra.example/v1/ops/feature-flags", expect.objectContaining({
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-astra-operator-token": "operator-secret",
      },
      body: JSON.stringify(runtime),
    }))
  })

  it("patches support report triage with the existing operator-token pattern", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      report: {
        reportId: "rpt/slash 1",
        triage: {
          status: "investigating",
          priority: "high",
          assignedTo: "support@astra.local",
          resolution: "Known import incident.",
          updatedAt: "2026-05-27T12:05:00.000Z",
          updatedBy: "ops-test",
          followUp: {
            path: "email_follow_up",
            status: "handed_off",
            macroId: "macro_page_not_working",
            reason: "needs_manual_email",
            updatedAt: "2026-05-27T12:05:00.000Z",
            updatedBy: "ops-test",
          },
        },
        recommendedMacro: null,
      },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }))

    const report = await updateWebSupportReportTriage({
      baseURL: "https://platform.astra.example/v1",
      operatorToken: " operator-secret ",
      reportId: "rpt/slash 1",
      patch: {
        status: "investigating",
        priority: "high",
        assignedTo: "support@astra.local",
        resolution: "Known import incident.",
        updatedBy: "ops-test",
        followUp: {
          path: "email_follow_up",
          status: "handed_off",
          macroId: "macro_page_not_working",
          reason: "needs_manual_email",
          updatedBy: "ops-test",
        },
      },
    })

    expect(report.triage.status).toBe("investigating")
    expect(report.triage.followUp).toMatchObject({ path: "email_follow_up", status: "handed_off", macroId: "macro_page_not_working" })
    expect(fetchSpy).toHaveBeenCalledWith("https://platform.astra.example/v1/ops/support/reports/rpt%2Fslash%201/triage", expect.objectContaining({
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-astra-operator-token": "operator-secret",
      },
      body: JSON.stringify({
        status: "investigating",
        priority: "high",
        assignedTo: "support@astra.local",
        resolution: "Known import incident.",
        updatedBy: "ops-test",
        followUp: {
          path: "email_follow_up",
          status: "handed_off",
          macroId: "macro_page_not_working",
          reason: "needs_manual_email",
          updatedBy: "ops-test",
        },
      }),
    }))
  })

  it("uses account-summary as the primary control-plane read", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url === "https://platform.astra.example/v1/account/summary") {
        return new Response(JSON.stringify(createSummaryPayload()), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      }
      throw new Error(`Unexpected fetch url: ${url}`)
    })

    const workspace = await fetchWebAccountWorkspace({
      session: createSession(),
      device: createDevice(),
    })

    expect(workspace.account?.id).toBe("usr_demo")
    expect(workspace.usage?.quota.dailyRequestsLimit).toBe(2000)
    expect(workspace.devices).toHaveLength(1)
    expect(workspace.deviceError).toBeNull()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("falls back to the legacy fanout when account-summary is unavailable", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url === "https://platform.astra.example/v1/account/summary") {
        return new Response(JSON.stringify({ error: { message: "Route not found." } }), {
          status: 404,
          headers: { "content-type": "application/json" },
        })
      }
      if (url === "https://platform.astra.example/v1/account") {
        return new Response(JSON.stringify(createSummaryPayload().account), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      }
      if (url === "https://platform.astra.example/v1/account/usage") {
        return new Response(JSON.stringify(createSummaryPayload().usage), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      }
      if (url === "https://platform.astra.example/v1/devices") {
        return new Response(JSON.stringify({ devices: createSummaryPayload().devices.entries }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      }
      throw new Error(`Unexpected fetch url: ${url}`)
    })

    const workspace = await fetchWebAccountWorkspace({
      session: createSession(),
      device: createDevice(),
    })

    expect(workspace.account?.id).toBe("usr_demo")
    expect(workspace.usage?.quota.dailyRequestsLimit).toBe(2000)
    expect(workspace.devices).toHaveLength(1)
    expect(workspace.deviceError).toBeNull()
    expect(fetchSpy).toHaveBeenCalledTimes(4)
  })
})
