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
    touchValidatedShadowSessionLaterMock: vi.fn(),
    recordPlatformRouteEventLaterMock: vi.fn(),
    listShadowSyncCollectionsForUserMock: vi.fn(),
    ensureShadowSyncRecordStateForCollectionMock: vi.fn(),
    ShadowSessionAuthError: TestShadowSessionAuthError,
    ShadowSessionUnavailableError: TestShadowSessionUnavailableError,
  }
})

vi.mock("../lib/session-auth", () => ({
  validateShadowSession: mocks.validateShadowSessionMock,
  touchValidatedShadowSessionLater: mocks.touchValidatedShadowSessionLaterMock,
  ShadowSessionAuthError: mocks.ShadowSessionAuthError,
  ShadowSessionUnavailableError: mocks.ShadowSessionUnavailableError,
}))

vi.mock("../lib/platform-ops", () => ({
  recordPlatformRouteEventLater: mocks.recordPlatformRouteEventLaterMock,
}))

vi.mock("../repositories/sync", () => ({
  listShadowSyncCollectionsForUser: mocks.listShadowSyncCollectionsForUserMock,
  ensureShadowSyncRecordStateForCollection: mocks.ensureShadowSyncRecordStateForCollectionMock,
}))

import type { AstraRequestContext } from "../context"
import type { AstraPlatformEnv } from "../env"
import { handleSyncRepair } from "./sync-repair"

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
    ASTRA_SESSION_SECRET: "test-secret",
    ASTRA_ENV: "test",
  }
}

function createContext(): AstraRequestContext {
  return {
    requestId: "req_sync_repair_test",
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
      syncCompactionDryRun: true,
    },
    execution: {
      waitUntil: vi.fn(),
    },
  }
}

function createRequest(body: unknown = { collections: ["config", "reading_history"] }) {
  return new Request("https://platform.astra.example/v1/sync/repair", {
    method: "POST",
    headers: {
      Authorization: "Bearer session-token",
      "X-Astra-Device-Id": "device-current",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

describe("handleSyncRepair", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.validateShadowSessionMock.mockResolvedValue({
      shadowUser: { id: "usr_demo" },
      currentDevice: { deviceId: "device-current" },
    })
    mocks.listShadowSyncCollectionsForUserMock.mockResolvedValue({
      config: {
        enabled: true,
        defaultEnabled: true,
        lastIssuedCursor: "3",
        compactionFloorCursor: "2",
      },
      vocabulary: {
        enabled: true,
        defaultEnabled: true,
        lastIssuedCursor: null,
        compactionFloorCursor: null,
      },
      reading_history: {
        enabled: true,
        defaultEnabled: false,
        lastIssuedCursor: "7",
        compactionFloorCursor: null,
      },
      study_progress: {
        enabled: false,
        defaultEnabled: false,
        lastIssuedCursor: null,
        compactionFloorCursor: null,
      },
    })
    mocks.ensureShadowSyncRecordStateForCollectionMock.mockImplementation(async (_db: unknown, params: { collection: string }) => {
      if (params.collection === "config") {
        return [{
          collection: "config",
          recordId: "global",
          isDeleted: false,
          payload: { kind: "global", config: { version: 1, targetLang: "ja", connectionMode: "astra", hoverTrigger: "alt", contentScope: "page", inputTranslation: "enabled", inputTranslationMode: "replace", languageLevel: "intermediate", privacyMode: false, provider: { id: "openai", model: "gpt-5.4-nano" }, tts: { enabled: true, engine: "browser", rate: 0.9, pitch: 1, highlightSentences: true }, presentation: { mode: "bilingual", theme: "default", fontSize: 0.92, translationColor: "#64748b" } } },
          lastClientMutationId: "cfg-3",
          lastDeviceId: "device-current",
          lastServerUpdatedAt: "2026-04-11T11:59:00.000Z",
          lastCursor: "3",
        }]
      }
      if (params.collection === "reading_history") {
        return [{
          collection: "reading_history",
          recordId: "history-1",
          isDeleted: false,
          payload: { id: "history-1", url: "https://example.com/article", hostname: "example.com", title: "Article", wordsTranslated: 8, visitedAt: 1000 },
          lastClientMutationId: "hist-7",
          lastDeviceId: "device-current",
          lastServerUpdatedAt: "2026-04-11T11:58:00.000Z",
          lastCursor: "7",
        }]
      }
      return []
    })
  })

  it("returns materialized record-state for the requested collections", async () => {
    const response = await handleSyncRepair(createRequest(), createEnv(), createContext())
    const payload = await response.json() as {
      collections: {
        config: { latestCursor: string | null; records: Array<{ recordId: string }> }
        reading_history: { latestCursor: string | null; records: Array<{ recordId: string }> }
      }
    }

    expect(response.status).toBe(200)
    expect(response.headers.get("x-astra-platform-route")).toBe("native")
    expect(response.headers.get("x-astra-platform-domain")).toBe("sync-repair")
    expect(payload.collections.config.latestCursor).toBe("3")
    expect(payload.collections.config.records[0]?.recordId).toBe("global")
    expect(payload.collections.reading_history.records[0]?.recordId).toBe("history-1")
    expect(mocks.touchValidatedShadowSessionLaterMock).toHaveBeenCalledTimes(1)
  })

  it("returns the local auth error contract when validation fails", async () => {
    mocks.validateShadowSessionMock.mockRejectedValue(new mocks.ShadowSessionAuthError(401, "SESSION_REQUIRED", "Missing session."))

    const response = await handleSyncRepair(createRequest(), createEnv(), createContext())
    const payload = await response.json() as { error: { code: string } }

    expect(response.status).toBe(401)
    expect(response.headers.get("x-astra-platform-route")).toBe("native-auth-gate")
    expect(payload.error.code).toBe("SESSION_REQUIRED")
  })
})
