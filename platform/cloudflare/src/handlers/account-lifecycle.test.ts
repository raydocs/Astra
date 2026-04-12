import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  class TestShadowSessionAuthError extends Error {
    status: number
    code: string

    constructor(status: number, code: string, message: string) {
      super(message)
      this.name = "ShadowSessionAuthError"
      this.status = status
      this.code = code
    }
  }

  class TestShadowSessionUnavailableError extends Error {
    reason: string

    constructor(reason: string, message: string) {
      super(message)
      this.name = "ShadowSessionUnavailableError"
      this.reason = reason
    }
  }

  return {
    validateShadowSessionMock: vi.fn(),
    recordPlatformRouteEventLaterMock: vi.fn(),
    createContinuityExportJobMock: vi.fn(),
    getContinuityExportJobMock: vi.fn(),
    markContinuityExportJobExpiredMock: vi.fn(),
    createContinuityDeleteJobMock: vi.fn(),
    getContinuityDeleteJobMock: vi.fn(),
    markContinuityDeleteJobQueuedMock: vi.fn(),
    ShadowSessionAuthError: TestShadowSessionAuthError,
    ShadowSessionUnavailableError: TestShadowSessionUnavailableError,
  }
})

vi.mock("../lib/session-auth", () => ({
  validateShadowSession: mocks.validateShadowSessionMock,
  ShadowSessionAuthError: mocks.ShadowSessionAuthError,
  ShadowSessionUnavailableError: mocks.ShadowSessionUnavailableError,
}))

vi.mock("../lib/platform-ops", () => ({
  recordPlatformRouteEventLater: mocks.recordPlatformRouteEventLaterMock,
}))

vi.mock("../repositories/continuity-lifecycle", () => ({
  createContinuityExportJob: mocks.createContinuityExportJobMock,
  getContinuityExportJob: mocks.getContinuityExportJobMock,
  markContinuityExportJobExpired: mocks.markContinuityExportJobExpiredMock,
  createContinuityDeleteJob: mocks.createContinuityDeleteJobMock,
  getContinuityDeleteJob: mocks.getContinuityDeleteJobMock,
  markContinuityDeleteJobQueued: mocks.markContinuityDeleteJobQueuedMock,
  parseContinuityExportScope: (row: { scopeJson: string }) => JSON.parse(row.scopeJson),
  parseContinuityDeleteScope: (row: { scopeJson: string }) => JSON.parse(row.scopeJson),
  parseDeletedRecords: (row: { deletedRecordsJson: string | null }) => row.deletedRecordsJson ? JSON.parse(row.deletedRecordsJson) : {},
}))

import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv } from "../env"
import {
  handleAccountExportCreate,
  handleAccountExportDownload,
  handleCloudDataDeleteCreate,
  handleCloudDataDeleteStatus,
} from "./account-lifecycle"

function createValidatedSession() {
  return {
    shadowUser: { id: "usr_demo" },
    currentDevice: { deviceId: "device-current" },
  }
}

function createExportJob(overrides: Record<string, unknown> = {}) {
  return {
    jobId: "exp_job_1",
    userId: "usr_demo",
    requestedByDeviceId: "device-current",
    scopeJson: JSON.stringify({ collections: ["config", "vocabulary"] }),
    status: "queued",
    requestedAt: "2026-04-11T12:00:00.000Z",
    startedAt: null,
    completedAt: null,
    failedAt: null,
    expiresAt: null,
    artifactObjectKey: null,
    artifactSha256: null,
    artifactBytes: null,
    errorCode: null,
    errorMessage: null,
    shadowUpdatedAt: "2026-04-11T12:00:00.000Z",
    ...overrides,
  }
}

function createDeleteJob(overrides: Record<string, unknown> = {}) {
  return {
    jobId: "del_job_1",
    userId: "usr_demo",
    requestedByDeviceId: "device-current",
    scopeJson: JSON.stringify({ collections: ["vocabulary", "reading_history"] }),
    status: "scheduled",
    requestedAt: "2026-04-11T12:00:00.000Z",
    scheduledForAt: "2026-04-11T12:30:00.000Z",
    startedAt: null,
    completedAt: null,
    failedAt: null,
    canceledAt: null,
    gracePeriodSeconds: 1800,
    deletedRecordsJson: null,
    errorCode: null,
    errorMessage: null,
    shadowUpdatedAt: "2026-04-11T12:00:00.000Z",
    ...overrides,
  }
}

function createEnv(): AstraPlatformEnv {
  return {
    ASTRA_PLATFORM_DB: {} as AstraPlatformEnv["ASTRA_PLATFORM_DB"],
    ASTRA_IMPORT_PAYLOADS: {
      put: vi.fn(async () => {}),
      head: vi.fn(async () => null),
      get: vi.fn(async () => null),
      delete: vi.fn(async () => {}),
    },
    ASTRA_IDEMPOTENCY_KV: {
      get: vi.fn(async () => null),
      put: vi.fn(async () => {}),
    },
    ARTICLE_IMPORT_QUEUE: {
      send: vi.fn(async () => {}),
    },
    CONTINUITY_LIFECYCLE_QUEUE: {
      send: vi.fn(async () => {}),
    },
    NODE_RELAY_ORIGIN: "https://relay.astra.example",
    ASTRA_SESSION_SECRET: "test-secret",
    ASTRA_ENV: "test",
  }
}

function createContext(nowIso = "2026-04-11T13:00:00.000Z"): AstraRequestContext {
  return {
    requestId: "req_lifecycle_test",
    nowEpochMs: Date.parse(nowIso),
    config: {
      environment: "test",
      nodeRelayOrigin: new URL("https://relay.astra.example"),
      articleImportMode: "proxy",
      articleImportModeOverrides: {},
      authSessionReadMode: "native",
      authSessionRevokeWriteMode: "native",
      accountSummaryReadMode: "native",
      deviceListReadMode: "proxy",
      deviceRevokeWriteMode: "proxy",
      syncBootstrapReadMode: "proxy",
      syncPullReadMode: "proxy",
      syncPushWriteMode: "proxy",
      syncMaxMutationsPerRequest: 200,
      articleImportAllowedHosts: [],
      articleImportBlockedHosts: [],
      articleImportForceProxyHosts: [],
      articleImportRateLimitMax: null,
      articleImportRateLimitWindowSeconds: 60,
      articleImportMaxQueueAttempts: 3,
      articleImportMaxShadowBytes: 262_144,
      articleImportMaxNativeBytes: 2_097_152,
      articleImportArtifactRetentionDays: 7,
      articleImportArtifactRetentionClass: "import-shadow",
      continuityExportArtifactRetentionDays: 7,
      continuityDeleteGracePeriodSeconds: 1_800,
      continuityJobHistoryRetentionDays: 90,
      continuityTombstoneRetentionDays: 30,
      syncTombstoneRetentionDays: 30,
      syncCompactionBatchSize: 500,
      syncCompactionDryRun: true,
    },
    execution: {
      waitUntil: vi.fn(),
    },
  }
}

function createRequest(url: string, init?: RequestInit) {
  return new Request(url, {
    headers: {
      Authorization: "Bearer session-token",
      "X-Astra-Device-Id": "device-current",
      ...(init?.headers ?? {}),
    },
    ...init,
  })
}

describe("account lifecycle handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.validateShadowSessionMock.mockResolvedValue(createValidatedSession())
    mocks.createContinuityExportJobMock.mockResolvedValue(createExportJob())
    mocks.getContinuityExportJobMock.mockResolvedValue(createExportJob())
    mocks.createContinuityDeleteJobMock.mockResolvedValue(createDeleteJob())
    mocks.getContinuityDeleteJobMock.mockResolvedValue(createDeleteJob())
    mocks.markContinuityDeleteJobQueuedMock.mockResolvedValue(undefined)
    mocks.markContinuityExportJobExpiredMock.mockResolvedValue(undefined)
  })

  it("queues a continuity export job and records idempotency linkage", async () => {
    const env = createEnv()
    const response = await handleAccountExportCreate(
      createRequest("https://platform.astra.example/v1/account/export", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
          "X-Astra-Device-Id": "device-current",
          "Content-Type": "application/json",
          "Idempotency-Key": "export-key-1",
        },
        body: JSON.stringify({ collections: ["config", "vocabulary"] }),
      }),
      env,
      createContext(),
    )

    expect(response.status).toBe(202)
    const payload = await response.json() as { jobId: string; status: string; scope: { collections: string[] } }
    expect(payload.jobId).toBe("exp_job_1")
    expect(payload.status).toBe("queued")
    expect(payload.scope.collections).toEqual(["config", "vocabulary"])
    expect(env.CONTINUITY_LIFECYCLE_QUEUE?.send).toHaveBeenCalledWith(expect.objectContaining({
      kind: "export",
      jobId: "exp_job_1",
      userId: "usr_demo",
    }))
    expect(env.ASTRA_IDEMPOTENCY_KV.put).toHaveBeenCalledWith(
      "continuity-lifecycle:export:usr_demo:export-key-1",
      "exp_job_1",
      { expirationTtl: 86400 },
    )
  })

  it("downloads a completed continuity export artifact", async () => {
    const env = createEnv()
    mocks.getContinuityExportJobMock.mockResolvedValue(createExportJob({
      status: "completed",
      completedAt: "2026-04-11T12:05:00.000Z",
      expiresAt: "2026-04-18T12:05:00.000Z",
      artifactObjectKey: "continuity-exports/2026-04-11/exp_job_1.json",
      artifactSha256: "abc123",
      artifactBytes: 16,
    }))
    env.ASTRA_IMPORT_PAYLOADS.get = vi.fn(async () => ({
      key: "continuity-exports/2026-04-11/exp_job_1.json",
      size: 16,
      httpMetadata: { contentType: "application/json" },
      arrayBuffer: async () => new TextEncoder().encode('{"ok":true}').buffer,
    }))

    const response = await handleAccountExportDownload(
      createRequest("https://platform.astra.example/v1/account/export/exp_job_1/download", { method: "GET" }),
      env,
      createContext(),
      "exp_job_1",
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/json")
    expect(await response.text()).toContain("ok")
  })

  it("creates a scheduled cloud data delete job", async () => {
    const env = createEnv()
    const response = await handleCloudDataDeleteCreate(
      createRequest("https://platform.astra.example/v1/account/cloud-data-delete", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
          "X-Astra-Device-Id": "device-current",
          "Content-Type": "application/json",
          "Idempotency-Key": "delete-key-1",
        },
        body: JSON.stringify({ collections: ["vocabulary", "reading_history"] }),
      }),
      env,
      createContext(),
    )

    expect(response.status).toBe(202)
    const payload = await response.json() as { jobId: string; status: string; scope: { collections: string[] } }
    expect(payload.jobId).toBe("del_job_1")
    expect(payload.status).toBe("scheduled")
    expect(payload.scope.collections).toEqual(["vocabulary", "reading_history"])
    expect(env.ASTRA_IDEMPOTENCY_KV.put).toHaveBeenCalledWith(
      "continuity-lifecycle:cloud-data-delete:usr_demo:delete-key-1",
      "del_job_1",
      { expirationTtl: 86400 },
    )
  })

  it("queues a scheduled cloud delete job when its grace period has elapsed", async () => {
    const env = createEnv()
    mocks.getContinuityDeleteJobMock
      .mockResolvedValueOnce(createDeleteJob({ scheduledForAt: "2026-04-11T12:00:00.000Z" }))
      .mockResolvedValueOnce(createDeleteJob({ status: "queued", scheduledForAt: "2026-04-11T12:00:00.000Z" }))

    const response = await handleCloudDataDeleteStatus(
      createRequest("https://platform.astra.example/v1/account/cloud-data-delete/del_job_1", { method: "GET" }),
      env,
      createContext("2026-04-11T13:00:00.000Z"),
      "del_job_1",
    )

    expect(response.status).toBe(200)
    const payload = await response.json() as { status: string }
    expect(payload.status).toBe("queued")
    expect(mocks.markContinuityDeleteJobQueuedMock).toHaveBeenCalledWith(expect.anything(), {
      jobId: "del_job_1",
      queuedAt: "2026-04-11T13:00:00.000Z",
    })
    expect(env.CONTINUITY_LIFECYCLE_QUEUE?.send).toHaveBeenCalledWith(expect.objectContaining({
      kind: "cloud-data-delete",
      jobId: "del_job_1",
      userId: "usr_demo",
    }))
  })

  it("preserves the existing auth/device error contract", async () => {
    const env = createEnv()
    mocks.validateShadowSessionMock.mockRejectedValue(
      new mocks.ShadowSessionAuthError(409, "DEVICE_MISMATCH", "Astra session is bound to a different device."),
    )

    const response = await handleAccountExportCreate(
      createRequest("https://platform.astra.example/v1/account/export", { method: "POST" }),
      env,
      createContext(),
    )

    expect(response.status).toBe(409)
    const payload = await response.json() as { error: { code: string } }
    expect(payload.error.code).toBe("DEVICE_MISMATCH")
  })
})
