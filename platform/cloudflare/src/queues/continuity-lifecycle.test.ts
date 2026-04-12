import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getContinuityExportJobMock: vi.fn(),
  getContinuityDeleteJobMock: vi.fn(),
  markContinuityExportJobRunningMock: vi.fn(),
  markContinuityExportJobCompletedMock: vi.fn(),
  markContinuityExportJobFailedMock: vi.fn(),
  markContinuityExportJobExpiredMock: vi.fn(),
  markContinuityDeleteJobRunningMock: vi.fn(),
  markContinuityDeleteJobCompletedMock: vi.fn(),
  markContinuityDeleteJobFailedMock: vi.fn(),
  getShadowUserByIdMock: vi.fn(),
  listShadowDeviceRowsForUserMock: vi.fn(),
  listShadowSyncCollectionsForUserMock: vi.fn(),
  ensureShadowSyncRecordStateForCollectionMock: vi.fn(),
  getShadowSyncMaxCursorOrderMock: vi.fn(),
  appendShadowSyncMutationMock: vi.fn(),
}))

vi.mock("../repositories/continuity-lifecycle", () => ({
  getContinuityExportJob: mocks.getContinuityExportJobMock,
  getContinuityDeleteJob: mocks.getContinuityDeleteJobMock,
  markContinuityExportJobRunning: mocks.markContinuityExportJobRunningMock,
  markContinuityExportJobCompleted: mocks.markContinuityExportJobCompletedMock,
  markContinuityExportJobFailed: mocks.markContinuityExportJobFailedMock,
  markContinuityExportJobExpired: mocks.markContinuityExportJobExpiredMock,
  markContinuityDeleteJobRunning: mocks.markContinuityDeleteJobRunningMock,
  markContinuityDeleteJobCompleted: mocks.markContinuityDeleteJobCompletedMock,
  markContinuityDeleteJobFailed: mocks.markContinuityDeleteJobFailedMock,
  parseContinuityExportScope: (row: { scopeJson: string }) => JSON.parse(row.scopeJson),
  parseContinuityDeleteScope: (row: { scopeJson: string }) => JSON.parse(row.scopeJson),
}))

vi.mock("../repositories/users", () => ({
  getShadowUserById: mocks.getShadowUserByIdMock,
}))

vi.mock("../repositories/devices", () => ({
  listShadowDeviceRowsForUser: mocks.listShadowDeviceRowsForUserMock,
}))

vi.mock("../repositories/sync", () => ({
  listShadowSyncCollectionsForUser: mocks.listShadowSyncCollectionsForUserMock,
  ensureShadowSyncRecordStateForCollection: mocks.ensureShadowSyncRecordStateForCollectionMock,
  getShadowSyncMaxCursorOrder: mocks.getShadowSyncMaxCursorOrderMock,
  appendShadowSyncMutation: mocks.appendShadowSyncMutationMock,
}))

import type { MessageBatch } from "../bindings"
import type { AstraPlatformEnv } from "../env"
import type { ContinuityLifecycleQueueMessage } from "../types/continuity-lifecycle"
import { consumeContinuityLifecycleQueue } from "./continuity-lifecycle"

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
    status: "queued",
    requestedAt: "2026-04-11T12:00:00.000Z",
    scheduledForAt: "2026-04-10T12:00:00.000Z",
    startedAt: null,
    completedAt: null,
    failedAt: null,
    canceledAt: null,
    gracePeriodSeconds: 604800,
    deletedRecordsJson: null,
    errorCode: null,
    errorMessage: null,
    shadowUpdatedAt: "2026-04-11T12:00:00.000Z",
    ...overrides,
  }
}

function createCollections(userId = "usr_demo") {
  return {
    config: {
      userId,
      collection: "config",
      enabled: true,
      defaultEnabled: true,
      lastIssuedCursor: "10",
      lastServerUpdatedAt: "2026-04-11T12:00:00.000Z",
      shadowUpdatedAt: "2026-04-11T12:00:00.000Z",
    },
    vocabulary: {
      userId,
      collection: "vocabulary",
      enabled: true,
      defaultEnabled: true,
      lastIssuedCursor: "11",
      lastServerUpdatedAt: "2026-04-11T12:00:00.000Z",
      shadowUpdatedAt: "2026-04-11T12:00:00.000Z",
    },
    reading_history: {
      userId,
      collection: "reading_history",
      enabled: true,
      defaultEnabled: false,
      lastIssuedCursor: "12",
      lastServerUpdatedAt: "2026-04-11T12:00:00.000Z",
      shadowUpdatedAt: "2026-04-11T12:00:00.000Z",
    },
    study_progress: {
      userId,
      collection: "study_progress",
      enabled: true,
      defaultEnabled: false,
      lastIssuedCursor: "13",
      lastServerUpdatedAt: "2026-04-11T12:00:00.000Z",
      shadowUpdatedAt: "2026-04-11T12:00:00.000Z",
    },
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
    NODE_RELAY_ORIGIN: "https://relay.astra.example",
    ASTRA_ENV: "test",
  }
}

function createBatch(message: ContinuityLifecycleQueueMessage): MessageBatch<ContinuityLifecycleQueueMessage> & {
  ack: ReturnType<typeof vi.fn>
} {
  const ack = vi.fn()
  return {
    queue: "astra-continuity-lifecycle-local",
    messages: [{
      body: message,
      ack,
      retry: vi.fn(),
    }],
    ack,
  }
}

describe("consumeContinuityLifecycleQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getContinuityExportJobMock.mockResolvedValue(createExportJob())
    mocks.getContinuityDeleteJobMock.mockResolvedValue(createDeleteJob())
    mocks.markContinuityExportJobRunningMock.mockResolvedValue(undefined)
    mocks.markContinuityExportJobCompletedMock.mockResolvedValue(undefined)
    mocks.markContinuityExportJobFailedMock.mockResolvedValue(undefined)
    mocks.markContinuityExportJobExpiredMock.mockResolvedValue(undefined)
    mocks.markContinuityDeleteJobRunningMock.mockResolvedValue(undefined)
    mocks.markContinuityDeleteJobCompletedMock.mockResolvedValue(undefined)
    mocks.markContinuityDeleteJobFailedMock.mockResolvedValue(undefined)
    mocks.getShadowUserByIdMock.mockResolvedValue({
      id: "usr_demo",
      email: "demo@astra.local",
      billingEmail: "billing@astra.local",
      createdAt: "2026-04-01T00:00:00.000Z",
      plan: "pro",
      subscriptionStatus: "active",
      providerEntitlements: ["openai", "gemini"],
    })
    mocks.listShadowDeviceRowsForUserMock.mockResolvedValue([
      {
        deviceId: "device-current",
        label: "Astra Chrome",
        platform: "macos",
        browserFamily: "chrome",
        appKind: "extension",
        appVersion: "0.1.0",
        firstSeenAt: "2026-04-10T00:00:00.000Z",
        lastSeenAt: "2026-04-11T12:00:00.000Z",
        lastSyncAt: "2026-04-11T12:00:00.000Z",
        status: "active",
        revokedAt: null,
      },
    ])
    mocks.listShadowSyncCollectionsForUserMock.mockResolvedValue(createCollections())
    mocks.ensureShadowSyncRecordStateForCollectionMock.mockImplementation(async (_db: unknown, params: { collection: string }) => {
      if (params.collection === "config") {
        return [{
          userId: "usr_demo",
          collection: "config",
          recordId: "config/current",
          isDeleted: false,
          payload: { targetLang: "zh-CN" },
          lastClientMutationId: "cfg-1",
          lastDeviceId: "device-current",
          lastServerUpdatedAt: "2026-04-11T12:00:00.000Z",
          lastCursor: "10",
          tombstoneRetainedUntil: null,
          shadowUpdatedAt: "2026-04-11T12:00:00.000Z",
        }]
      }
      if (params.collection === "vocabulary") {
        return [{
          userId: "usr_demo",
          collection: "vocabulary",
          recordId: "vocab-1",
          isDeleted: false,
          payload: { text: "serendipity" },
          lastClientMutationId: "vocab-1",
          lastDeviceId: "device-current",
          lastServerUpdatedAt: "2026-04-11T12:01:00.000Z",
          lastCursor: "11",
          tombstoneRetainedUntil: null,
          shadowUpdatedAt: "2026-04-11T12:01:00.000Z",
        }]
      }
      if (params.collection === "reading_history") {
        return [{
          userId: "usr_demo",
          collection: "reading_history",
          recordId: "history-1",
          isDeleted: false,
          payload: { url: "https://example.com/article" },
          lastClientMutationId: "history-1",
          lastDeviceId: "device-current",
          lastServerUpdatedAt: "2026-04-11T12:02:00.000Z",
          lastCursor: "12",
          tombstoneRetainedUntil: null,
          shadowUpdatedAt: "2026-04-11T12:02:00.000Z",
        }]
      }
      return []
    })
    mocks.getShadowSyncMaxCursorOrderMock.mockResolvedValue(12)
    mocks.appendShadowSyncMutationMock.mockResolvedValue({ deduped: false })
  })

  it("materializes and stores a continuity export artifact", async () => {
    const env = createEnv()
    const batch = createBatch({
      version: 1,
      kind: "export",
      jobId: "exp_job_1",
      userId: "usr_demo",
      enqueuedAt: "2026-04-11T12:00:00.000Z",
    })

    await consumeContinuityLifecycleQueue(batch, env)

    expect(mocks.markContinuityExportJobRunningMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      jobId: "exp_job_1",
    }))
    expect(env.ASTRA_IMPORT_PAYLOADS.put).toHaveBeenCalledWith(
      expect.stringMatching(/^continuity-exports\/\d{4}-\d{2}-\d{2}\/exp_job_1\.json$/),
      expect.stringContaining("astra-continuity-cloud-export"),
      expect.objectContaining({
        httpMetadata: { contentType: "application/json" },
        customMetadata: expect.objectContaining({
          jobId: "exp_job_1",
          userId: "usr_demo",
          kind: "account-export",
        }),
      }),
    )
    expect(mocks.markContinuityExportJobCompletedMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      jobId: "exp_job_1",
      artifactObjectKey: expect.stringContaining("exp_job_1.json"),
      artifactBytes: expect.any(Number),
    }))
    expect(batch.ack).toHaveBeenCalledTimes(1)
  })

  it("appends delete mutations for the selected collections", async () => {
    const env = createEnv()
    const batch = createBatch({
      version: 1,
      kind: "cloud-data-delete",
      jobId: "del_job_1",
      userId: "usr_demo",
      enqueuedAt: "2026-04-11T12:00:00.000Z",
    })

    await consumeContinuityLifecycleQueue(batch, env)

    expect(mocks.markContinuityDeleteJobRunningMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      jobId: "del_job_1",
    }))
    expect(mocks.appendShadowSyncMutationMock).toHaveBeenCalledTimes(2)
    expect(mocks.appendShadowSyncMutationMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      collection: "vocabulary",
      operation: "delete",
      clientMutationId: "cloud-delete:del_job_1:vocabulary:vocab-1",
    }))
    expect(mocks.appendShadowSyncMutationMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      collection: "reading_history",
      operation: "delete",
      clientMutationId: "cloud-delete:del_job_1:reading_history:history-1",
    }))
    expect(mocks.markContinuityDeleteJobCompletedMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      jobId: "del_job_1",
      deletedRecords: {
        vocabulary: 1,
        reading_history: 1,
      },
    }))
    expect(batch.ack).toHaveBeenCalledTimes(1)
  })
})
