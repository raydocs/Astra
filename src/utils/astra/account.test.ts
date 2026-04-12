import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createAstraCheckoutLink,
  createAstraPortalLink,
  createAstraAccountExportJob,
  createAstraCloudDataDeleteJob,
  fetchAstraAccount,
  fetchAstraAccountSummary,
  fetchAstraAccountExportJob,
  fetchAstraContinuitySnapshot,
  fetchAstraDevices,
  fetchAstraSyncBootstrap,
  fetchAstraCloudDataDeleteJob,
  revokeAstraDevice,
  fetchAstraUsageSnapshot,
  pullAstraSyncDeltas,
  pushAstraSyncMutations,
  repairAstraSyncState,
  updateAstraPlan,
  updateAstraSyncCollectionPreference,
} from "./account"

describe("Astra account client", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("fetches an account profile with bearer auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "usr_demo",
      relayBaseURL: "https://astra.example/v1",
      email: "user@example.com",
      billingEmail: "billing@example.com",
      createdAt: "2026-03-01T00:00:00.000Z",
      plan: "pro",
      subscriptionStatus: "active",
      providerEntitlements: ["openai", "gemini"],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))
    vi.stubGlobal("fetch", fetchMock)

    const account = await fetchAstraAccount({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
    })

    expect(account.id).toBe("usr_demo")
    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/account", expect.objectContaining({
      method: "GET",
      headers: {
        Authorization: "Bearer astra-session",
      },
    }))
  })

  it("fetches a usage snapshot with bearer auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      generatedAt: "2026-03-26T00:01:00.000Z",
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
        lastRequestAt: "2026-03-26T00:00:00.000Z",
        recentEvents: [{
          timestamp: "2026-03-26T00:00:00.000Z",
          provider: "openai",
          requestCount: 1,
          characterCount: 5,
        }],
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))
    vi.stubGlobal("fetch", fetchMock)

    const usage = await fetchAstraUsageSnapshot({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
    })

    expect(usage.usage.totalRequests).toBe(1)
    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/account/usage", expect.objectContaining({
      method: "GET",
      headers: {
        Authorization: "Bearer astra-session",
      },
    }))
  })

  it("fetches an account summary with device-aware auth headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      serverTime: "2026-04-11T12:00:00.000Z",
      account: {
        id: "usr_demo",
        relayBaseURL: "https://astra.example/v1",
        email: "user@example.com",
        billingEmail: "billing@example.com",
        createdAt: "2026-03-01T00:00:00.000Z",
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
          lastRequestAt: "2026-03-26T00:00:00.000Z",
          recentEvents: [],
        },
      },
      session: {
        sessionId: "sess_demo",
        deviceId: "device-123",
        issuedAt: "2026-04-10T00:00:00.000Z",
        expiresAt: "2026-04-12T00:00:00.000Z",
        identityMode: "authenticated",
        status: "active",
      },
      devices: {
        activeCount: 1,
        revokedCount: 0,
        current: {
          deviceId: "device-123",
          label: "Chrome on macOS",
          platform: "macos",
          browserFamily: "chrome",
          appKind: "extension",
          appVersion: "0.1.0-test",
          firstSeenAt: "2026-04-09T00:00:00.000Z",
          lastSeenAt: "2026-04-09T01:00:00.000Z",
          lastSyncAt: "2026-04-09T01:05:00.000Z",
          status: "active",
          isCurrentDevice: true,
        },
        entries: [{
          deviceId: "device-123",
          label: "Chrome on macOS",
          platform: "macos",
          browserFamily: "chrome",
          appKind: "extension",
          appVersion: "0.1.0-test",
          firstSeenAt: "2026-04-09T00:00:00.000Z",
          lastSeenAt: "2026-04-09T01:00:00.000Z",
          lastSyncAt: "2026-04-09T01:05:00.000Z",
          status: "active",
          isCurrentDevice: true,
        }],
      },
      sync: {
        maxMutationsPerRequest: 200,
        collections: {
          config: { enabled: true, defaultEnabled: true, cursor: "1", mutationCount: 1, activeCount: 1, lastSyncAt: "2026-04-09T01:05:00.000Z", compactionFloorCursor: null },
          vocabulary: { enabled: true, defaultEnabled: true, cursor: null, mutationCount: 0, activeCount: 0, lastSyncAt: null, compactionFloorCursor: null },
          reading_history: { enabled: false, defaultEnabled: false, cursor: null, mutationCount: 0, activeCount: 0, lastSyncAt: null, compactionFloorCursor: null },
          study_progress: { enabled: false, defaultEnabled: false, cursor: null, mutationCount: 0, activeCount: 0, lastSyncAt: null, compactionFloorCursor: null },
        },
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))
    vi.stubGlobal("fetch", fetchMock)

    const summary = await fetchAstraAccountSummary({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
      deviceId: "device-123",
    })

    expect(summary.session.sessionId).toBe("sess_demo")
    expect(summary.devices.entries).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/account/summary", expect.objectContaining({
      method: "GET",
      headers: {
        Authorization: "Bearer astra-session",
        "X-Astra-Device-Id": "device-123",
      },
    }))
  })

  it("creates a continuity export job with device-aware auth and idempotency", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
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
    }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    }))
    vi.stubGlobal("fetch", fetchMock)

    const job = await createAstraAccountExportJob({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
      deviceId: "device-123",
      request: { collections: ["config", "vocabulary"] },
      idempotencyKey: "export-key-1",
    })

    expect(job.jobId).toBe("exp_job_1")
    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/account/export", expect.objectContaining({
      method: "POST",
      headers: {
        Authorization: "Bearer astra-session",
        "X-Astra-Device-Id": "device-123",
        "Content-Type": "application/json",
        "Idempotency-Key": "export-key-1",
      },
      body: JSON.stringify({ collections: ["config", "vocabulary"] }),
    }))
  })

  it("creates and fetches a cloud data delete job with device-aware auth", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
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
      }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        jobId: "del_job_1",
        scope: { collections: ["vocabulary", "reading_history"] },
        status: "completed",
        requestedAt: "2026-04-11T12:00:00.000Z",
        scheduledForAt: "2026-04-18T12:00:00.000Z",
        startedAt: "2026-04-18T12:00:10.000Z",
        completedAt: "2026-04-18T12:00:20.000Z",
        failedAt: null,
        canceledAt: null,
        gracePeriodSeconds: 604800,
        deletedRecords: { vocabulary: 2, reading_history: 1 },
        error: null,
        policy: {
          exportArtifactRetentionDays: 7,
          deleteGracePeriodSeconds: 604800,
          jobHistoryRetentionDays: 90,
          tombstoneRetentionDays: 30,
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
    vi.stubGlobal("fetch", fetchMock)

    const created = await createAstraCloudDataDeleteJob({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
      deviceId: "device-123",
      request: { collections: ["vocabulary", "reading_history"] },
      idempotencyKey: "delete-key-1",
    })
    const fetched = await fetchAstraCloudDataDeleteJob({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
      deviceId: "device-123",
      jobId: "del_job_1",
    })

    expect(created.status).toBe("scheduled")
    expect(fetched.deletedRecords.vocabulary).toBe(2)
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://astra.example/v1/account/cloud-data-delete", expect.objectContaining({
      method: "POST",
      headers: {
        Authorization: "Bearer astra-session",
        "X-Astra-Device-Id": "device-123",
        "Content-Type": "application/json",
        "Idempotency-Key": "delete-key-1",
      },
    }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://astra.example/v1/account/cloud-data-delete/del_job_1", expect.objectContaining({
      method: "GET",
      headers: {
        Authorization: "Bearer astra-session",
        "X-Astra-Device-Id": "device-123",
      },
    }))
  })

  it("updates the current plan through the account endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "usr_demo",
      relayBaseURL: "https://astra.example/v1",
      email: "user@example.com",
      billingEmail: "billing@example.com",
      createdAt: "2026-03-01T00:00:00.000Z",
      plan: "free",
      subscriptionStatus: "active",
      providerEntitlements: ["openai"],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))
    vi.stubGlobal("fetch", fetchMock)

    const account = await updateAstraPlan({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
      plan: "free",
    })

    expect(account.plan).toBe("free")
    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/account/plan", expect.objectContaining({
      method: "PATCH",
      headers: {
        Authorization: "Bearer astra-session",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ plan: "free" }),
    }))
  })

  it("creates a checkout link for plan upgrades", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      kind: "checkout",
      url: "https://billing.example/checkout?targetPlan=pro",
      generatedAt: "2026-03-26T00:03:00.000Z",
      plan: "pro",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))
    vi.stubGlobal("fetch", fetchMock)

    const link = await createAstraCheckoutLink({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
      plan: "pro",
    })

    expect(link.kind).toBe("checkout")
    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/billing/checkout", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ plan: "pro" }),
    }))
  })

  it("creates a billing portal link", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      kind: "portal",
      url: "https://billing.example/portal",
      generatedAt: "2026-03-26T00:03:00.000Z",
      plan: "pro",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))
    vi.stubGlobal("fetch", fetchMock)

    const link = await createAstraPortalLink({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
    })

    expect(link.kind).toBe("portal")
    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/billing/portal", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({}),
    }))
  })

  it("fetches registered devices with the Astra device header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      devices: [{
        deviceId: "device-123",
        label: "Chrome on macOS",
        platform: "macos",
        browserFamily: "chrome",
        appKind: "extension",
        appVersion: "0.1.0-test",
        firstSeenAt: "2026-04-09T00:00:00.000Z",
        lastSeenAt: "2026-04-09T01:00:00.000Z",
        lastSyncAt: "2026-04-09T01:05:00.000Z",
        status: "active",
        isCurrentDevice: true,
      }],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))
    vi.stubGlobal("fetch", fetchMock)

    const devices = await fetchAstraDevices({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
      deviceId: "device-123",
    })

    expect(devices).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/devices", expect.objectContaining({
      method: "GET",
      headers: {
        Authorization: "Bearer astra-session",
        "X-Astra-Device-Id": "device-123",
      },
    }))
  })

  it("posts remote device revoke with device-aware auth headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      devices: [{
        deviceId: "device-123",
        label: "Chrome on macOS",
        platform: "macos",
        browserFamily: "chrome",
        appKind: "extension",
        appVersion: "0.1.0-test",
        firstSeenAt: "2026-04-09T00:00:00.000Z",
        lastSeenAt: "2026-04-09T01:00:00.000Z",
        lastSyncAt: "2026-04-09T01:05:00.000Z",
        status: "active",
        isCurrentDevice: true,
      }, {
        deviceId: "device-456",
        label: "Firefox on Windows",
        platform: "windows",
        browserFamily: "firefox",
        appKind: "web",
        appVersion: "0.1.0-web",
        firstSeenAt: "2026-04-09T00:10:00.000Z",
        lastSeenAt: "2026-04-09T01:10:00.000Z",
        lastSyncAt: null,
        status: "revoked",
        isCurrentDevice: false,
      }],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))
    vi.stubGlobal("fetch", fetchMock)

    const devices = await revokeAstraDevice({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
      deviceId: "device-123",
      targetDeviceId: "device-456",
    })

    expect(devices.find((device) => device.deviceId === "device-456")?.status).toBe("revoked")
    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/devices/device-456/revoke", expect.objectContaining({
      method: "POST",
      headers: {
        Authorization: "Bearer astra-session",
        "X-Astra-Device-Id": "device-123",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }))
  })

  it("fetches sync bootstrap state with the current device binding", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      serverTime: "2026-04-09T01:05:00.000Z",
      deviceId: "device-123",
      collections: {
        config: { enabled: true, defaultEnabled: true, cursor: "cfg-3" },
        vocabulary: { enabled: false, defaultEnabled: false, cursor: null },
        reading_history: { enabled: false, defaultEnabled: false, cursor: null },
        study_progress: { enabled: false, defaultEnabled: false, cursor: null },
      },
      limits: { maxMutationsPerRequest: 100 },
      transport: {
        deviceHeader: "X-Astra-Device-Id",
        idempotencyKey: "clientMutationId",
        cursorMode: "per-collection",
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))
    vi.stubGlobal("fetch", fetchMock)

    const bootstrap = await fetchAstraSyncBootstrap({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
      deviceId: "device-123",
    })

    expect(bootstrap.collections.config.cursor).toBe("cfg-3")
    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/sync/bootstrap", expect.objectContaining({
      method: "GET",
      headers: {
        Authorization: "Bearer astra-session",
        "X-Astra-Device-Id": "device-123",
      },
    }))
  })

  it("posts sync mutations with device-aware auth headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      serverTime: "2026-04-09T01:06:00.000Z",
      accepted: [{
        collection: "config",
        clientMutationId: "mut-1",
        recordId: "global",
        operation: "upsert",
        serverUpdatedAt: "2026-04-09T01:06:00.000Z",
        cursor: "cfg-4",
        deduped: false,
      }],
      rejected: [],
      nextCursors: {
        config: "cfg-4",
        vocabulary: null,
        reading_history: null,
        study_progress: null,
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))
    vi.stubGlobal("fetch", fetchMock)

    const push = await pushAstraSyncMutations({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
      deviceId: "device-123",
      mutations: [{
        collection: "config",
        schemaVersion: 1,
        recordId: "global",
        operation: "upsert",
        clientMutationId: "mut-1",
        deviceId: "device-123",
        clientUpdatedAt: "2026-04-09T01:05:30.000Z",
        payload: { kind: "global", config: { version: 1, targetLang: "ja", connectionMode: "astra", hoverTrigger: "alt", contentScope: "page", inputTranslation: "enabled", inputTranslationMode: "replace", languageLevel: "intermediate", privacyMode: false, provider: { id: "openai", model: "gpt-5.4-nano" }, tts: { enabled: true, engine: "browser", rate: 0.9, pitch: 1, highlightSentences: true }, presentation: { mode: "bilingual", theme: "default", fontSize: 0.92, translationColor: "#64748b" } } },
      }],
    })

    expect(push.accepted).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/sync/push", expect.objectContaining({
      method: "POST",
      headers: {
        Authorization: "Bearer astra-session",
        "X-Astra-Device-Id": "device-123",
        "Content-Type": "application/json",
      },
    }))
  })

  it("posts sync pull cursors with device-aware auth headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      serverTime: "2026-04-09T01:06:00.000Z",
      deltas: {
        config: [],
        vocabulary: [],
        reading_history: [],
        study_progress: [],
      },
      nextCursors: {
        config: "cfg-4",
        vocabulary: null,
        reading_history: null,
        study_progress: null,
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))
    vi.stubGlobal("fetch", fetchMock)

    const pull = await pullAstraSyncDeltas({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
      deviceId: "device-123",
      cursors: { config: null },
    })

    expect(pull.nextCursors.config).toBe("cfg-4")
    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/sync/pull", expect.objectContaining({
      method: "POST",
      headers: {
        Authorization: "Bearer astra-session",
        "X-Astra-Device-Id": "device-123",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cursors: { config: null } }),
    }))
  })

  it("posts sync repair with device-aware auth headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      serverTime: "2026-04-11T12:00:00.000Z",
      collections: {
        config: { enabled: true, defaultEnabled: true, latestCursor: "3", compactionFloorCursor: "2", records: [{ recordId: "global", payload: { kind: "global", config: { version: 1, targetLang: "ja", connectionMode: "astra", hoverTrigger: "alt", contentScope: "page", inputTranslation: "enabled", inputTranslationMode: "replace", languageLevel: "intermediate", privacyMode: false, provider: { id: "openai", model: "gpt-5.4-nano" }, tts: { enabled: true, engine: "browser", rate: 0.9, pitch: 1, highlightSentences: true }, presentation: { mode: "bilingual", theme: "default", fontSize: 0.92, translationColor: "#64748b" } } }, lastClientMutationId: "cfg-1", lastDeviceId: "device-123", lastServerUpdatedAt: "2026-04-11T11:59:00.000Z", cursor: "3" }] },
        vocabulary: { enabled: true, defaultEnabled: true, latestCursor: null, compactionFloorCursor: null, records: [] },
        reading_history: { enabled: false, defaultEnabled: false, latestCursor: null, compactionFloorCursor: null, records: [] },
        study_progress: { enabled: false, defaultEnabled: false, latestCursor: null, compactionFloorCursor: null, records: [] },
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))
    vi.stubGlobal("fetch", fetchMock)

    const repair = await repairAstraSyncState({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
      deviceId: "device-123",
      request: { collections: ["config", "vocabulary"] },
    })

    expect(repair.collections.config.records).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/sync/repair", expect.objectContaining({
      method: "POST",
      headers: {
        Authorization: "Bearer astra-session",
        "X-Astra-Device-Id": "device-123",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ collections: ["config", "vocabulary"] }),
    }))
  })

  it("falls back to repair when continuity snapshot pull cursors are expired", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        devices: [{
          deviceId: "device-123",
          label: "Chrome on macOS",
          platform: "macos",
          browserFamily: "chrome",
          appKind: "extension",
          appVersion: "0.1.0-test",
          firstSeenAt: "2026-04-09T00:00:00.000Z",
          lastSeenAt: "2026-04-09T01:00:00.000Z",
          lastSyncAt: "2026-04-09T01:05:00.000Z",
          status: "active",
          isCurrentDevice: true,
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        serverTime: "2026-04-09T01:05:00.000Z",
        deviceId: "device-123",
        collections: {
          config: { enabled: true, defaultEnabled: true, cursor: "cfg-3" },
          vocabulary: { enabled: true, defaultEnabled: true, cursor: "voc-3" },
          reading_history: { enabled: true, defaultEnabled: false, cursor: "hist-3" },
          study_progress: { enabled: false, defaultEnabled: false, cursor: null },
        },
        limits: { maxMutationsPerRequest: 100 },
        transport: {
          deviceHeader: "X-Astra-Device-Id",
          idempotencyKey: "clientMutationId",
          cursorMode: "per-collection",
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: {
          code: "CURSOR_EXPIRED",
          message: "Repair required.",
          details: {
            collection: "config",
            requestedCursor: null,
            compactionFloorCursor: "cfg-2",
          },
        },
      }), { status: 409, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        serverTime: "2026-04-09T01:06:30.000Z",
        collections: {
          config: { enabled: true, defaultEnabled: true, latestCursor: "cfg-4", compactionFloorCursor: "cfg-2", records: [{ recordId: "global", payload: { kind: "global", config: { version: 1, targetLang: "ja", connectionMode: "astra", hoverTrigger: "alt", contentScope: "page", inputTranslation: "enabled", inputTranslationMode: "replace", languageLevel: "intermediate", privacyMode: false, provider: { id: "openai", model: "gpt-5.4-nano" }, tts: { enabled: true, engine: "browser", rate: 0.9, pitch: 1, highlightSentences: true }, presentation: { mode: "bilingual", theme: "default", fontSize: 0.92, translationColor: "#64748b" } } }, lastClientMutationId: "cfg-4", lastDeviceId: "device-123", lastServerUpdatedAt: "2026-04-09T01:06:00.000Z", cursor: "cfg-4" }] },
          vocabulary: { enabled: true, defaultEnabled: true, latestCursor: "voc-4", compactionFloorCursor: null, records: [{ recordId: "word-1", payload: { id: "word-1", text: "hello", translation: "こんにちは", savedAt: 1000 }, lastClientMutationId: "voc-4", lastDeviceId: "device-123", lastServerUpdatedAt: "2026-04-09T01:06:00.000Z", cursor: "voc-4" }] },
          reading_history: { enabled: true, defaultEnabled: false, latestCursor: "hist-4", compactionFloorCursor: null, records: [] },
          study_progress: { enabled: false, defaultEnabled: false, latestCursor: null, compactionFloorCursor: null, records: [] },
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
    vi.stubGlobal("fetch", fetchMock)

    const snapshot = await fetchAstraContinuitySnapshot({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
      deviceId: "device-123",
      includePull: true,
    })

    expect(snapshot.pull?.nextCursors.config).toBe("cfg-4")
    expect(snapshot.pull?.deltas.vocabulary[0]?.recordId).toBe("word-1")
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(fetchMock.mock.calls[3]?.[0]).toBe("https://astra.example/v1/sync/repair")
  })

  it("updates the reading history sync preference with device-aware auth headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      serverTime: "2026-04-09T01:05:00.000Z",
      deviceId: "device-123",
      collections: {
        config: { enabled: true, defaultEnabled: true, cursor: "cfg-3" },
        vocabulary: { enabled: true, defaultEnabled: true, cursor: "voc-3" },
        reading_history: { enabled: true, defaultEnabled: false, cursor: "hist-3" },
        study_progress: { enabled: false, defaultEnabled: false, cursor: null },
      },
      limits: { maxMutationsPerRequest: 100 },
      transport: {
        deviceHeader: "X-Astra-Device-Id",
        idempotencyKey: "clientMutationId",
        cursorMode: "per-collection",
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))
    vi.stubGlobal("fetch", fetchMock)

    const bootstrap = await updateAstraSyncCollectionPreference({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
      deviceId: "device-123",
      collection: "reading_history",
      enabled: true,
    })

    expect(bootstrap.collections.reading_history.enabled).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/sync/collections/reading_history", expect.objectContaining({
      method: "PATCH",
      headers: {
        Authorization: "Bearer astra-session",
        "X-Astra-Device-Id": "device-123",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled: true }),
    }))
  })

  it("updates the study progress sync preference with device-aware auth headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      serverTime: "2026-04-09T01:05:00.000Z",
      deviceId: "device-123",
      collections: {
        config: { enabled: true, defaultEnabled: true, cursor: "cfg-3" },
        vocabulary: { enabled: true, defaultEnabled: true, cursor: "voc-3" },
        reading_history: { enabled: false, defaultEnabled: false, cursor: null },
        study_progress: { enabled: true, defaultEnabled: false, cursor: "progress-3" },
      },
      limits: { maxMutationsPerRequest: 100 },
      transport: {
        deviceHeader: "X-Astra-Device-Id",
        idempotencyKey: "clientMutationId",
        cursorMode: "per-collection",
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))
    vi.stubGlobal("fetch", fetchMock)

    const bootstrap = await updateAstraSyncCollectionPreference({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
      deviceId: "device-123",
      collection: "study_progress",
      enabled: true,
    })

    expect(bootstrap.collections.study_progress.enabled).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/sync/collections/study_progress", expect.objectContaining({
      method: "PATCH",
      headers: {
        Authorization: "Bearer astra-session",
        "X-Astra-Device-Id": "device-123",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled: true }),
    }))
  })

  it("fetches a combined continuity snapshot", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        devices: [{
          deviceId: "device-123",
          label: "Chrome on macOS",
          platform: "macos",
          browserFamily: "chrome",
          appKind: "extension",
          appVersion: "0.1.0-test",
          firstSeenAt: "2026-04-09T00:00:00.000Z",
          lastSeenAt: "2026-04-09T01:00:00.000Z",
          lastSyncAt: "2026-04-09T01:05:00.000Z",
          status: "active",
          isCurrentDevice: true,
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        serverTime: "2026-04-09T01:05:00.000Z",
        deviceId: "device-123",
        collections: {
          config: { enabled: true, defaultEnabled: true, cursor: "cfg-3" },
          vocabulary: { enabled: false, defaultEnabled: false, cursor: null },
          reading_history: { enabled: false, defaultEnabled: false, cursor: null },
          study_progress: { enabled: true, defaultEnabled: false, cursor: "progress-3" },
        },
        limits: { maxMutationsPerRequest: 100 },
        transport: {
          deviceHeader: "X-Astra-Device-Id",
          idempotencyKey: "clientMutationId",
          cursorMode: "per-collection",
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        serverTime: "2026-04-09T01:06:00.000Z",
        deltas: {
          config: [],
          vocabulary: [],
          reading_history: [],
          study_progress: [],
        },
        nextCursors: {
          config: "cfg-4",
          vocabulary: null,
          reading_history: null,
          study_progress: null,
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
    vi.stubGlobal("fetch", fetchMock)

    const snapshot = await fetchAstraContinuitySnapshot({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
      deviceId: "device-123",
      includePull: true,
    })

    expect(snapshot.devices).toHaveLength(1)
    expect(snapshot.bootstrap.deviceId).toBe("device-123")
    expect(snapshot.pull).not.toBeNull()
    expect(snapshot.pull?.nextCursors.config).toBe("cfg-4")
    expect(fetchMock.mock.calls[2]?.[1]).toEqual(expect.objectContaining({
      body: JSON.stringify({ cursors: { config: null, vocabulary: null, study_progress: null } }),
    }))
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
