import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  isArticleImportOperatorAuthorizedMock: vi.fn(),
  recordPlatformRouteEventLaterMock: vi.fn(),
  createShadowSyncCompactionRunMock: vi.fn(),
  completeShadowSyncCompactionRunMock: vi.fn(),
  failShadowSyncCompactionRunMock: vi.fn(),
  ensureShadowSyncRecordStateForCollectionMock: vi.fn(),
  listShadowSyncCollectionsForUserMock: vi.fn(),
  listShadowSyncMutationsUpToCursorOrderMock: vi.fn(),
  deleteShadowSyncMutationByServerMutationIdMock: vi.fn(),
  setShadowSyncCollectionCompactionFloorMock: vi.fn(),
  pruneExpiredShadowSyncRecordStateTombstonesMock: vi.fn(),
}))

vi.mock("../lib/article-import-operator", () => ({
  isArticleImportOperatorAuthorized: mocks.isArticleImportOperatorAuthorizedMock,
}))

vi.mock("../lib/platform-ops", () => ({
  recordPlatformRouteEventLater: mocks.recordPlatformRouteEventLaterMock,
}))

vi.mock("../repositories/sync", () => ({
  createShadowSyncCompactionRun: mocks.createShadowSyncCompactionRunMock,
  completeShadowSyncCompactionRun: mocks.completeShadowSyncCompactionRunMock,
  failShadowSyncCompactionRun: mocks.failShadowSyncCompactionRunMock,
  ensureShadowSyncRecordStateForCollection: mocks.ensureShadowSyncRecordStateForCollectionMock,
  listShadowSyncCollectionsForUser: mocks.listShadowSyncCollectionsForUserMock,
  listShadowSyncMutationsUpToCursorOrder: mocks.listShadowSyncMutationsUpToCursorOrderMock,
  deleteShadowSyncMutationByServerMutationId: mocks.deleteShadowSyncMutationByServerMutationIdMock,
  setShadowSyncCollectionCompactionFloor: mocks.setShadowSyncCollectionCompactionFloorMock,
  pruneExpiredShadowSyncRecordStateTombstones: mocks.pruneExpiredShadowSyncRecordStateTombstonesMock,
}))

import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv } from "../env"
import { handleSyncCompaction } from "./sync-compaction"

function createEnv(): AstraPlatformEnv {
  return {
    ASTRA_PLATFORM_DB: {} as AstraPlatformEnv["ASTRA_PLATFORM_DB"],
    ASTRA_IMPORT_PAYLOADS: {
      put: vi.fn(async () => {}),
      head: vi.fn(async () => null),
    },
    ASTRA_IDEMPOTENCY_KV: {
      get: vi.fn(async () => null),
      put: vi.fn(async () => {}),
    },
    ARTICLE_IMPORT_QUEUE: {
      send: vi.fn(async () => {}),
    },
    NODE_RELAY_ORIGIN: "https://relay.astra.example",
    ARTICLE_IMPORT_OPERATOR_TOKEN: "op-token",
    ASTRA_ENV: "test",
  }
}

function createContext(dryRun = false): AstraRequestContext {
  return {
    requestId: "req_sync_compaction_test",
    nowEpochMs: Date.parse("2026-04-11T12:00:00.000Z"),
    config: {
      environment: "test",
      nodeRelayOrigin: new URL("https://relay.astra.example"),
      articleImportMode: "proxy",
      articleImportModeOverrides: {},
      authSessionReadMode: "native",
      authSessionRevokeWriteMode: "native",
      accountSummaryReadMode: "native",
      deviceListReadMode: "native",
      deviceRevokeWriteMode: "native",
      syncBootstrapReadMode: "native",
      syncPullReadMode: "native",
      syncPushWriteMode: "native",
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
      continuityDeleteGracePeriodSeconds: 604800,
      continuityJobHistoryRetentionDays: 90,
      continuityTombstoneRetentionDays: 30,
      syncTombstoneRetentionDays: 30,
      syncCompactionBatchSize: 500,
      syncCompactionDryRun: dryRun,
    },
    execution: {
      waitUntil: vi.fn(),
    },
  }
}

function createRequest(body: unknown = { userId: "usr_demo", collection: "reading_history", cutoffCursorOrder: 120 }) {
  return new Request("https://platform.astra.example/__platform/sync/compaction", {
    method: "POST",
    headers: {
      Authorization: "Bearer op-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

describe("handleSyncCompaction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isArticleImportOperatorAuthorizedMock.mockReturnValue(true)
    mocks.createShadowSyncCompactionRunMock.mockResolvedValue(undefined)
    mocks.completeShadowSyncCompactionRunMock.mockResolvedValue(undefined)
    mocks.failShadowSyncCompactionRunMock.mockResolvedValue(undefined)
    mocks.ensureShadowSyncRecordStateForCollectionMock.mockResolvedValue([
      { recordId: "history-1" },
      { recordId: "history-2" },
    ])
    mocks.listShadowSyncCollectionsForUserMock.mockResolvedValue({
      config: { compactionFloorCursor: null, compactionFloorCursorOrder: null },
      vocabulary: { compactionFloorCursor: null, compactionFloorCursorOrder: null },
      reading_history: { compactionFloorCursor: null, compactionFloorCursorOrder: null },
      study_progress: { compactionFloorCursor: null, compactionFloorCursorOrder: null },
    })
    mocks.listShadowSyncMutationsUpToCursorOrderMock.mockResolvedValue([
      { serverMutationId: "mut-119", cursor: "119" },
      { serverMutationId: "mut-120", cursor: "120" },
    ])
    mocks.deleteShadowSyncMutationByServerMutationIdMock.mockResolvedValue(undefined)
    mocks.setShadowSyncCollectionCompactionFloorMock.mockResolvedValue(undefined)
    mocks.pruneExpiredShadowSyncRecordStateTombstonesMock.mockResolvedValue(undefined)
  })

  it("rejects unauthorized operator requests when a token is configured", async () => {
    mocks.isArticleImportOperatorAuthorizedMock.mockReturnValue(false)

    const response = await handleSyncCompaction(createRequest(), createEnv(), createContext())
    const payload = await response.json() as { error: { code: string } }

    expect(response.status).toBe(401)
    expect(payload.error.code).toBe("OPERATOR_UNAUTHORIZED")
  })

  it("tracks and applies a compaction run with floor advancement metadata", async () => {
    const response = await handleSyncCompaction(createRequest(), createEnv(), createContext(false))
    const payload = await response.json() as {
      status: string
      floorCursor: string | null
      floorCursorOrder: number | null
      mutationsDeleted: number
      recordsMaterialized: number
    }

    expect(response.status).toBe(200)
    expect(payload.status).toBe("completed")
    expect(payload.floorCursor).toBe("120")
    expect(payload.floorCursorOrder).toBe(120)
    expect(payload.mutationsDeleted).toBe(2)
    expect(payload.recordsMaterialized).toBe(2)
    expect(mocks.createShadowSyncCompactionRunMock).toHaveBeenCalledTimes(1)
    expect(mocks.deleteShadowSyncMutationByServerMutationIdMock).toHaveBeenCalledTimes(2)
    expect(mocks.setShadowSyncCollectionCompactionFloorMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      collection: "reading_history",
      floorCursor: "120",
      floorCursorOrder: 120,
    }))
    expect(mocks.completeShadowSyncCompactionRunMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      status: "completed",
      mutationsDeleted: 2,
      recordsMaterialized: 2,
    }))
  })
})
