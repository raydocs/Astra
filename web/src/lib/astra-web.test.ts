import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { AstraDeviceIdentity, AstraSession } from "@/types/auth"

import {
  createWebSession,
  createWebCloudDataDelete,
  createWebContinuityExport,
  downloadWebContinuityExport,
  fetchWebAccountWorkspace,
  repairWebCloudSync,
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
