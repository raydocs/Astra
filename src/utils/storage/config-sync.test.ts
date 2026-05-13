import { beforeEach, describe, expect, it, vi } from "vitest"

import { DEFAULT_ASTRA_CONFIG } from "@/types/config"
import { ASTRA_AUTH_STORAGE_KEY, ASTRA_DEVICE_STORAGE_KEY } from "./auth"
import { ASTRA_CONFIG_STORAGE_KEY } from "./config"
import { VOCABULARY_REVIEW_SCHEDULE_STORAGE_KEY, VOCABULARY_STORAGE_KEY } from "./vocabulary"
import { READING_HISTORY_STORAGE_KEY } from "./reading-history"
import { STUDY_PROGRESS_STORAGE_KEY } from "./study-progress"
import { OWNED_READING_STORAGE_KEY } from "./owned-reading"
import { DEEP_READ_SESSION_STORAGE_KEY } from "./deep-read-session"
import { buildContinuityStatus, exportConfig, importConfig, readPhaseOneCollectionSyncStatus, runPhaseOneCollectionSync } from "./config-sync"
import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"

const {
  fetchAstraSyncBootstrapMock,
  pushAstraSyncMutationsMock,
  pullAstraSyncDeltasMock,
  repairAstraSyncStateMock,
  AstraApiError,
} = vi.hoisted(() => {
  class TestAstraApiError extends Error {
    status: number
    code: string | null
    details: unknown

    constructor(params: { message: string; status: number; code?: string | null; details?: unknown }) {
      super(params.message)
      this.name = "AstraApiError"
      this.status = params.status
      this.code = params.code ?? null
      this.details = params.details ?? null
    }
  }

  return {
    fetchAstraSyncBootstrapMock: vi.fn(),
    pushAstraSyncMutationsMock: vi.fn(),
    pullAstraSyncDeltasMock: vi.fn(),
    repairAstraSyncStateMock: vi.fn(),
    AstraApiError: TestAstraApiError,
  }
})

vi.mock("@/utils/astra/account", () => ({
  AstraApiError,
  fetchAstraSyncBootstrap: fetchAstraSyncBootstrapMock,
  pushAstraSyncMutations: pushAstraSyncMutationsMock,
  pullAstraSyncDeltas: pullAstraSyncDeltasMock,
  repairAstraSyncState: repairAstraSyncStateMock,
}))

describe("config-sync", () => {
  beforeEach(() => {
    setMockBrowser(createMockBrowser())
    fetchAstraSyncBootstrapMock.mockReset()
    pushAstraSyncMutationsMock.mockReset()
    pullAstraSyncDeltasMock.mockReset()
    repairAstraSyncStateMock.mockReset()
  })

  describe("exportConfig", () => {
    it("exports config, vocabulary and reading history as JSON", async () => {
      setMockBrowser(createMockBrowser({
        [ASTRA_CONFIG_STORAGE_KEY]: { ...DEFAULT_ASTRA_CONFIG },
        [VOCABULARY_STORAGE_KEY]: [{ id: "1", text: "hello", savedAt: 1000 }],
        [READING_HISTORY_STORAGE_KEY]: [{ id: "a", url: "https://example.com", hostname: "example.com", title: "Test", wordsTranslated: 5, visitedAt: 2000 }],
      }))

      const json = await exportConfig()
      const parsed = JSON.parse(json)

      expect(parsed._astraBackup).toBe(true)
      expect(parsed.exportedAt).toBeTruthy()
      expect(parsed.config.targetLang).toBe("zh-CN")
      expect(parsed.vocabulary).toHaveLength(1)
      expect(parsed.vocabulary[0].text).toBe("hello")
      expect(parsed.readingHistory).toHaveLength(1)
    })

    it("exports empty arrays when vocabulary and history are missing", async () => {
      setMockBrowser(createMockBrowser({
        [ASTRA_CONFIG_STORAGE_KEY]: { ...DEFAULT_ASTRA_CONFIG },
      }))

      const json = await exportConfig()
      const parsed = JSON.parse(json)

      expect(parsed.vocabulary).toEqual([])
      expect(parsed.readingHistory).toEqual([])
    })

    it("falls back to defaults when stored config is invalid", async () => {
      setMockBrowser(createMockBrowser({
        [ASTRA_CONFIG_STORAGE_KEY]: { version: 99 },
      }))

      const json = await exportConfig()
      const parsed = JSON.parse(json)

      expect(parsed.config.targetLang).toBe(DEFAULT_ASTRA_CONFIG.targetLang)
    })
  })

  it("builds a continuity status snapshot with deferred collections", () => {
    const status = buildContinuityStatus({
      config: DEFAULT_ASTRA_CONFIG,
      session: null,
      device: {
        version: 1,
        deviceId: "device-123",
        label: "Chrome on macOS",
        platform: "macos",
        browserFamily: "chrome",
        appKind: "extension",
        appVersion: "0.1.0-test",
        createdAt: "2026-04-09T00:00:00.000Z",
        updatedAt: "2026-04-09T00:00:00.000Z",
      },
    })

    expect(status.device.label).toBe("Chrome on macOS")
    expect(status.session.state).toBe("signed-out")
    expect(status.sync.deferredCollections).toEqual([])
    expect(status.sync.localOnly.localOnlyFields).toContain("study_progress.dailyStats")
    expect(status.sync.localOnly.localOnlyFields).not.toContain("vocabulary.srsBox")
    expect(status.sync.localOnly.localOnlyFields).not.toContain("vocabulary.nextReviewAt")
    expect(status.sync.phaseOne.stateLastSuccessAt).toBeNull()
    expect(status.remote.available).toBe(false)
  })

  it("reads persisted phase-one sync status for authenticated continuity", async () => {
    setMockBrowser(createMockBrowser({
      [ASTRA_AUTH_STORAGE_KEY]: {
        version: 1,
        sessionToken: "astra-session",
        sessionId: "sess-123",
        deviceId: "device-123",
        identityMode: "authenticated",
        relayBaseURL: "https://astra.example/v1",
        email: "user@example.com",
        plan: "pro",
        subscriptionStatus: "active",
        providerEntitlements: ["openai", "gemini"],
      },
      "astra.sync.phase1.v1": {
        version: 1,
        accountEmail: "user@example.com",
        collections: {
          config: { cursor: "cfg-1", shadow: {} },
          vocabulary: { cursor: "voc-2", shadow: {} },
          review_schedule: { cursor: null, shadow: {} },
          reading_history: { cursor: "hist-3", shadow: {} },
          study_progress: { cursor: "progress-4", shadow: {} },
        },
        lastRunAt: "2026-04-09T01:00:00.000Z",
        lastSuccessAt: "2026-04-09T01:00:10.000Z",
        lastError: null,
      },
    }))

    const status = await readPhaseOneCollectionSyncStatus()

    expect(status).toMatchObject({
      accountEmail: "user@example.com",
      stateLastRunAt: "2026-04-09T01:00:00.000Z",
      stateLastSuccessAt: "2026-04-09T01:00:10.000Z",
      cursors: { vocabulary: "voc-2", study_progress: "progress-4" },
    })
  })

  it("summarizes remote device and config continuity status", () => {
    const status = buildContinuityStatus({
      config: DEFAULT_ASTRA_CONFIG,
      session: {
        version: 1,
        sessionToken: "astra-session",
        sessionId: "sess-123",
        deviceId: "device-123",
        identityMode: "authenticated",
        relayBaseURL: "https://astra.example/v1",
        email: "user@example.com",
        plan: "pro",
        subscriptionStatus: "active",
        providerEntitlements: ["openai", "gemini"],
        quota: {
          dailyRequestsLimit: 2000,
          dailyCharactersLimit: 500000,
          requestsPerMinuteLimit: 120,
          remainingDailyRequests: 1999,
          remainingDailyCharacters: 499999,
        },
        usage: {
          totalRequests: 1,
          totalCharacters: 5,
          dailyRequestsUsed: 1,
          dailyCharactersUsed: 5,
          lastRequestAt: "2026-04-09T00:00:00.000Z",
          recentEvents: [],
        },
        issuedAt: "2026-04-09T00:00:00.000Z",
        expiresAt: null,
      },
      device: {
        version: 1,
        deviceId: "device-123",
        label: "Chrome on macOS",
        platform: "macos",
        browserFamily: "chrome",
        appKind: "extension",
        appVersion: "0.1.0-test",
        createdAt: "2026-04-09T00:00:00.000Z",
        updatedAt: "2026-04-09T00:00:00.000Z",
      },
      remote: {
        devices: [
          {
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
        ],
        bootstrap: {
          serverTime: "2026-04-09T01:05:00.000Z",
          deviceId: "device-123",
          collections: {
            config: { enabled: true, defaultEnabled: true, cursor: "cfg-3" },
            vocabulary: { enabled: false, defaultEnabled: false, cursor: null },
            review_schedule: { enabled: true, defaultEnabled: true, cursor: null },
            reading_history: { enabled: false, defaultEnabled: false, cursor: null },
            study_progress: { enabled: false, defaultEnabled: false, cursor: null },
          },
          limits: {
            maxMutationsPerRequest: 100,
          },
          transport: {
            deviceHeader: "X-Astra-Device-Id",
            idempotencyKey: "clientMutationId",
            cursorMode: "per-collection",
          },
        },
        pull: {
          serverTime: "2026-04-09T01:06:00.000Z",
          deltas: {
            config: [{
              collection: "config",
              schemaVersion: 1,
              recordId: "settings",
              operation: "upsert",
              clientMutationId: "mut-1",
              deviceId: "device-123",
              clientUpdatedAt: "2026-04-09T01:04:00.000Z",
              payload: { targetLang: "ja" },
              ownerId: "usr_demo",
              email: "user@example.com",
              serverMutationId: "srv-1",
              serverUpdatedAt: "2026-04-09T01:05:30.000Z",
              cursor: "cfg-4",
            }],
            vocabulary: [],
            review_schedule: [],
            reading_history: [],
            study_progress: [],
          },
          nextCursors: {
            config: "cfg-4",
            vocabulary: null,
            review_schedule: null,
            reading_history: null,
            study_progress: null,
          },
        },
      },
    })

    expect(status.remote.available).toBe(true)
    expect(status.remote.deviceCount).toBe(1)
    expect(status.remote.currentDevice?.deviceId).toBe("device-123")
    expect(status.remote.configCollection).toMatchObject({
      enabled: true,
      bootstrapCursor: "cfg-3",
      nextCursor: "cfg-4",
      deltaCount: 1,
    })
    expect(status.remote.readingHistoryCollection).toMatchObject({
      enabled: false,
      bootstrapCursor: null,
      nextCursor: null,
      deltaCount: 0,
    })
    expect(status.remote.studyProgressCollection).toMatchObject({
      enabled: false,
      bootstrapCursor: null,
      nextCursor: null,
      deltaCount: 0,
    })
  })

  describe("runPhaseOneCollectionSync", () => {
    it("pulls remote config and vocabulary onto a newly signed-in device", async () => {
      const browser = setMockBrowser(createMockBrowser({
        [ASTRA_CONFIG_STORAGE_KEY]: { ...DEFAULT_ASTRA_CONFIG },
        [ASTRA_AUTH_STORAGE_KEY]: {
          version: 1,
          sessionToken: "astra-session",
          sessionId: "sess-1",
          deviceId: "device-123",
          identityMode: "authenticated",
          relayBaseURL: "https://astra.example/v1",
          email: "user@example.com",
          plan: "pro",
          subscriptionStatus: "active",
          providerEntitlements: ["openai", "gemini"],
          quota: { dailyRequestsLimit: 0, dailyCharactersLimit: 0, requestsPerMinuteLimit: 0, remainingDailyRequests: 0, remainingDailyCharacters: 0 },
          usage: { totalRequests: 0, totalCharacters: 0, dailyRequestsUsed: 0, dailyCharactersUsed: 0, lastRequestAt: null, recentEvents: [] },
          issuedAt: null,
          expiresAt: null,
        },
        [ASTRA_DEVICE_STORAGE_KEY]: {
          version: 1,
          deviceId: "device-123",
          label: "Chrome on macOS",
          platform: "macos",
          browserFamily: "chrome",
          appKind: "extension",
          appVersion: "0.1.0-test",
          createdAt: "2026-04-09T00:00:00.000Z",
          updatedAt: "2026-04-09T00:00:00.000Z",
        },
      })) as ReturnType<typeof createMockBrowser>

      fetchAstraSyncBootstrapMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:00.000Z",
        deviceId: "device-123",
        collections: {
          config: { enabled: true, defaultEnabled: true, cursor: "cfg-1" },
          vocabulary: { enabled: true, defaultEnabled: true, cursor: "voc-1" },
          review_schedule: { enabled: true, defaultEnabled: true, cursor: null },
          reading_history: { enabled: false, defaultEnabled: false, cursor: null },
          study_progress: { enabled: false, defaultEnabled: false, cursor: null },
        },
        limits: { maxMutationsPerRequest: 200 },
        transport: { deviceHeader: "X-Astra-Device-Id", idempotencyKey: "clientMutationId", cursorMode: "per-collection" },
      })
      pullAstraSyncDeltasMock.mockResolvedValue({
        serverTime: "2026-04-09T01:01:00.000Z",
        deltas: {
          config: [{
            collection: "config",
            schemaVersion: 1,
            recordId: "global",
            operation: "upsert",
            clientMutationId: "mut-config-1",
            deviceId: "device-remote",
            clientUpdatedAt: "2026-04-09T01:00:30.000Z",
            payload: {
              kind: "global",
              config: {
                version: 1,
                targetLang: "ja",
                connectionMode: "astra",
                hoverTrigger: "alt",
                contentScope: "page",
                inputTranslation: "enabled",
                inputTranslationMode: "replace",
                languageLevel: "intermediate",
                privacyMode: false,
                provider: { id: "openai", model: "gpt-5.4-nano" },
                tts: { enabled: true, engine: "browser", rate: 0.9, pitch: 1, highlightSentences: true },
                presentation: { mode: "bilingual", theme: "default", fontSize: 0.92, translationColor: "#64748b" },
              },
            },
            ownerId: "usr_demo",
            email: "user@example.com",
            serverMutationId: "srv-1",
            serverUpdatedAt: "2026-04-09T01:00:40.000Z",
            cursor: "cfg-2",
          }],
          vocabulary: [{
            collection: "vocabulary",
            schemaVersion: 1,
            recordId: "word-1",
            operation: "upsert",
            clientMutationId: "mut-vocab-1",
            deviceId: "device-remote",
            clientUpdatedAt: "2026-04-09T01:00:30.000Z",
            payload: {
              id: "word-1",
              text: "hello",
              translation: "こんにちは",
              savedAt: 1000,
            },
            ownerId: "usr_demo",
            email: "user@example.com",
            serverMutationId: "srv-2",
            serverUpdatedAt: "2026-04-09T01:00:40.000Z",
            cursor: "voc-2",
          }],
          reading_history: [],
          study_progress: [],
        },
        nextCursors: {
          config: "cfg-2",
          vocabulary: "voc-2",
          review_schedule: null,
          reading_history: null,
          study_progress: null,
        },
      })
      pushAstraSyncMutationsMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:00.000Z",
        accepted: [],
        rejected: [],
        nextCursors: { config: "cfg-1", vocabulary: "voc-1", review_schedule: null, reading_history: null, study_progress: null },
      })

      const result = await runPhaseOneCollectionSync()

      expect(result.skipped).toBe(false)
      expect(pushAstraSyncMutationsMock).not.toHaveBeenCalled()
      expect(browser.__storage[ASTRA_CONFIG_STORAGE_KEY]).toMatchObject({ targetLang: "ja" })
      expect(browser.__storage[VOCABULARY_STORAGE_KEY]).toMatchObject([
        expect.objectContaining({ id: "word-1", text: "hello", translation: "こんにちは" }),
      ])
    })

    it("pushes local vocabulary during first bootstrap when the server collection is empty", async () => {
      setMockBrowser(createMockBrowser({
        [ASTRA_CONFIG_STORAGE_KEY]: { ...DEFAULT_ASTRA_CONFIG },
        [VOCABULARY_STORAGE_KEY]: [{
          id: "word-local",
          text: "offline",
          translation: "离线",
          savedAt: 1000,
          srsBox: 2,
          nextReviewAt: 2000,
          reviewCount: 1,
          lastReviewedAt: 1500,
        }],
        [ASTRA_AUTH_STORAGE_KEY]: {
          version: 1,
          sessionToken: "astra-session",
          sessionId: "sess-1",
          deviceId: "device-123",
          identityMode: "authenticated",
          relayBaseURL: "https://astra.example/v1",
          email: "user@example.com",
          plan: "pro",
          subscriptionStatus: "active",
          providerEntitlements: ["openai", "gemini"],
          quota: { dailyRequestsLimit: 0, dailyCharactersLimit: 0, requestsPerMinuteLimit: 0, remainingDailyRequests: 0, remainingDailyCharacters: 0 },
          usage: { totalRequests: 0, totalCharacters: 0, dailyRequestsUsed: 0, dailyCharactersUsed: 0, lastRequestAt: null, recentEvents: [] },
          issuedAt: null,
          expiresAt: null,
        },
        [ASTRA_DEVICE_STORAGE_KEY]: {
          version: 1,
          deviceId: "device-123",
          label: "Chrome on macOS",
          platform: "macos",
          browserFamily: "chrome",
          appKind: "extension",
          appVersion: "0.1.0-test",
          createdAt: "2026-04-09T00:00:00.000Z",
          updatedAt: "2026-04-09T00:00:00.000Z",
        },
      }))

      fetchAstraSyncBootstrapMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:00.000Z",
        deviceId: "device-123",
        collections: {
          config: { enabled: true, defaultEnabled: true, cursor: null },
          vocabulary: { enabled: true, defaultEnabled: true, cursor: null },
          review_schedule: { enabled: true, defaultEnabled: true, cursor: null },
          reading_history: { enabled: false, defaultEnabled: false, cursor: null },
          study_progress: { enabled: false, defaultEnabled: false, cursor: null },
        },
        limits: { maxMutationsPerRequest: 200 },
        transport: { deviceHeader: "X-Astra-Device-Id", idempotencyKey: "clientMutationId", cursorMode: "per-collection" },
      })
      pushAstraSyncMutationsMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:30.000Z",
        accepted: [],
        rejected: [],
        nextCursors: { config: null, vocabulary: "voc-1", review_schedule: null, reading_history: null, study_progress: null },
      })
      pullAstraSyncDeltasMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:40.000Z",
        deltas: { config: [], vocabulary: [], review_schedule: [], reading_history: [], study_progress: [] },
        nextCursors: { config: null, vocabulary: "voc-1", review_schedule: null, reading_history: null, study_progress: null },
      })

      const result = await runPhaseOneCollectionSync()

      expect(result.pushed.vocabulary).toBe(1)
      expect(result.pushed.review_schedule).toBe(1)
      expect(pushAstraSyncMutationsMock).toHaveBeenCalledWith(expect.objectContaining({
        deviceId: "device-123",
        mutations: expect.arrayContaining([
          expect.objectContaining({
            collection: "vocabulary",
            recordId: "word-local",
            operation: "upsert",
            payload: expect.not.objectContaining({ srsBox: expect.anything() }),
          }),
          expect.objectContaining({
            collection: "review_schedule",
            recordId: "word-local",
            operation: "upsert",
            payload: expect.objectContaining({
              vocabularyEntryId: "word-local",
              srsBox: 2,
              nextReviewAt: 2000,
              reviewCount: 1,
              lastReviewedAt: 1500,
            }),
          }),
        ]),
      }))
    })

    it("syncs reading history by sanitized URL when the collection is enabled", async () => {
      const browser = setMockBrowser(createMockBrowser({
        [READING_HISTORY_STORAGE_KEY]: [{
          id: "https://example.com/article",
          url: "https://example.com/article?utm=1",
          hostname: "example.com",
          title: "Article",
          wordsTranslated: 12,
          visitedAt: 1234,
        }],
        [ASTRA_AUTH_STORAGE_KEY]: {
          version: 1,
          sessionToken: "astra-session",
          sessionId: "sess-1",
          deviceId: "device-123",
          identityMode: "authenticated",
          relayBaseURL: "https://astra.example/v1",
          email: "user@example.com",
          plan: "pro",
          subscriptionStatus: "active",
          providerEntitlements: ["openai", "gemini"],
          quota: { dailyRequestsLimit: 0, dailyCharactersLimit: 0, requestsPerMinuteLimit: 0, remainingDailyRequests: 0, remainingDailyCharacters: 0 },
          usage: { totalRequests: 0, totalCharacters: 0, dailyRequestsUsed: 0, dailyCharactersUsed: 0, lastRequestAt: null, recentEvents: [] },
          issuedAt: null,
          expiresAt: null,
        },
        [ASTRA_DEVICE_STORAGE_KEY]: {
          version: 1,
          deviceId: "device-123",
          label: "Chrome on macOS",
          platform: "macos",
          browserFamily: "chrome",
          appKind: "extension",
          appVersion: "0.1.0-test",
          createdAt: "2026-04-09T00:00:00.000Z",
          updatedAt: "2026-04-09T00:00:00.000Z",
        },
      })) as ReturnType<typeof createMockBrowser>

      fetchAstraSyncBootstrapMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:00.000Z",
        deviceId: "device-123",
        collections: {
          config: { enabled: true, defaultEnabled: true, cursor: null },
          vocabulary: { enabled: true, defaultEnabled: true, cursor: null },
          review_schedule: { enabled: true, defaultEnabled: true, cursor: null },
          reading_history: { enabled: true, defaultEnabled: false, cursor: null },
          study_progress: { enabled: false, defaultEnabled: false, cursor: null },
        },
        limits: { maxMutationsPerRequest: 200 },
        transport: { deviceHeader: "X-Astra-Device-Id", idempotencyKey: "clientMutationId", cursorMode: "per-collection" },
      })
      pushAstraSyncMutationsMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:30.000Z",
        accepted: [],
        rejected: [],
        nextCursors: { config: null, vocabulary: null, review_schedule: null, reading_history: "hist-1", study_progress: null },
      })
      pullAstraSyncDeltasMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:40.000Z",
        deltas: {
          config: [],
          vocabulary: [],
          review_schedule: [],
          reading_history: [{
            collection: "reading_history",
            schemaVersion: 1,
            recordId: "https://example.com/article",
            operation: "upsert",
            clientMutationId: "mut-history-1",
            deviceId: "device-remote",
            clientUpdatedAt: "2026-04-09T01:00:30.000Z",
            payload: {
              id: "https://example.com/article",
              url: "https://example.com/article",
              hostname: "example.com",
              title: "Article updated",
              wordsTranslated: 18,
              visitedAt: 2234,
            },
            ownerId: "usr_demo",
            email: "user@example.com",
            serverMutationId: "srv-h1",
            serverUpdatedAt: "2026-04-09T01:00:35.000Z",
            cursor: "hist-2",
          }],
          study_progress: [],
        },
        nextCursors: { config: null, vocabulary: null, review_schedule: null, reading_history: "hist-2", study_progress: null },
      })

      const result = await runPhaseOneCollectionSync()

      expect(result.pushed.reading_history).toBe(1)
      expect(result.pulled.reading_history).toBe(1)
      expect(pushAstraSyncMutationsMock).toHaveBeenCalledWith(expect.objectContaining({
        mutations: expect.arrayContaining([
          expect.objectContaining({
            collection: "reading_history",
            recordId: "https://example.com/article",
            payload: expect.objectContaining({
              id: "https://example.com/article",
              url: "https://example.com/article",
            }),
          }),
        ]),
      }))
      expect(browser.__storage[READING_HISTORY_STORAGE_KEY]).toEqual([
        expect.objectContaining({
          id: "https://example.com/article",
          url: "https://example.com/article",
          title: "Article updated",
          visitedAt: 2234,
        }),
      ])
    })

    it("pushes owned-reading metadata through private config records without local file bytes", async () => {
      setMockBrowser(createMockBrowser({
        [OWNED_READING_STORAGE_KEY]: {
          version: 1,
          items: [{
            id: "or_pdf_astra-local%3A%2F%2Fpdf%2Flocal.pdf",
            sourceType: "pdf",
            title: "local.pdf",
            sourceUrl: null,
            localUri: "astra-local://pdf/local.pdf",
            reopenHint: "Choose the same file in the PDF reader: local.pdf",
            openedAt: 1000,
            updatedAt: 1000,
            status: "in_progress",
            readingHistoryRecordId: null,
            studyProgressRecordId: null,
          }],
        },
        [ASTRA_AUTH_STORAGE_KEY]: {
          version: 1,
          sessionToken: "astra-session",
          sessionId: "sess-1",
          deviceId: "device-123",
          identityMode: "authenticated",
          relayBaseURL: "https://astra.example/v1",
          email: "user@example.com",
          plan: "pro",
          subscriptionStatus: "active",
          providerEntitlements: ["openai", "gemini"],
          quota: { dailyRequestsLimit: 0, dailyCharactersLimit: 0, requestsPerMinuteLimit: 0, remainingDailyRequests: 0, remainingDailyCharacters: 0 },
          usage: { totalRequests: 0, totalCharacters: 0, dailyRequestsUsed: 0, dailyCharactersUsed: 0, lastRequestAt: null, recentEvents: [] },
          issuedAt: null,
          expiresAt: null,
        },
        [ASTRA_DEVICE_STORAGE_KEY]: {
          version: 1,
          deviceId: "device-123",
          label: "Chrome on macOS",
          platform: "macos",
          browserFamily: "chrome",
          appKind: "extension",
          appVersion: "0.1.0-test",
          createdAt: "2026-04-09T00:00:00.000Z",
          updatedAt: "2026-04-09T00:00:00.000Z",
        },
      }))

      fetchAstraSyncBootstrapMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:00.000Z",
        deviceId: "device-123",
        collections: {
          config: { enabled: true, defaultEnabled: true, cursor: null },
          vocabulary: { enabled: true, defaultEnabled: true, cursor: null },
          review_schedule: { enabled: true, defaultEnabled: true, cursor: null },
          reading_history: { enabled: false, defaultEnabled: false, cursor: null },
          study_progress: { enabled: false, defaultEnabled: false, cursor: null },
        },
        limits: { maxMutationsPerRequest: 200 },
        transport: { deviceHeader: "X-Astra-Device-Id", idempotencyKey: "clientMutationId", cursorMode: "per-collection" },
      })
      pushAstraSyncMutationsMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:30.000Z",
        accepted: [],
        rejected: [],
        nextCursors: { config: "cfg-1", vocabulary: null, review_schedule: null, reading_history: null, study_progress: null },
      })
      pullAstraSyncDeltasMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:40.000Z",
        deltas: { config: [], vocabulary: [], review_schedule: [], reading_history: [], study_progress: [] },
        nextCursors: { config: "cfg-1", vocabulary: null, review_schedule: null, reading_history: null, study_progress: null },
      })

      const result = await runPhaseOneCollectionSync()

      expect(result.pushed.config).toBe(1)
      expect(pushAstraSyncMutationsMock).toHaveBeenCalledWith(expect.objectContaining({
        mutations: [expect.objectContaining({
          collection: "config",
          recordId: expect.stringContaining("__owned_reading_metadata_v1__:or_pdf_"),
          operation: "upsert",
          payload: expect.objectContaining({
            id: "or_pdf_astra-local%3A%2F%2Fpdf%2Flocal.pdf",
            localUri: "astra-local://pdf/local.pdf",
            reopenHint: expect.stringContaining("local.pdf"),
            updatedAt: 1000,
          }),
        })],
      }))
      expect(JSON.stringify(pushAstraSyncMutationsMock.mock.calls[0]?.[0].mutations[0]?.payload)).not.toMatch(/bytes|blob|handle|arrayBuffer/i)
    })

    it("pulls owned-reading metadata from private config records while preserving normal config sync", async () => {
      const browser = setMockBrowser(createMockBrowser({
        [ASTRA_CONFIG_STORAGE_KEY]: { ...DEFAULT_ASTRA_CONFIG },
        [OWNED_READING_STORAGE_KEY]: {
          version: 1,
          items: [{
            id: "or_epub_astra-local%3A%2F%2Fepub%2Fbook.epub",
            sourceType: "epub",
            title: "Local stale",
            sourceUrl: null,
            localUri: "astra-local://epub/book.epub",
            reopenHint: "Choose the same file in the ePub reader: book.epub",
            openedAt: 1000,
            updatedAt: 1000,
            status: "saved",
            readingHistoryRecordId: null,
            studyProgressRecordId: null,
          }],
        },
        [ASTRA_AUTH_STORAGE_KEY]: {
          version: 1,
          sessionToken: "astra-session",
          sessionId: "sess-1",
          deviceId: "device-123",
          identityMode: "authenticated",
          relayBaseURL: "https://astra.example/v1",
          email: "user@example.com",
          plan: "pro",
          subscriptionStatus: "active",
          providerEntitlements: ["openai", "gemini"],
          quota: { dailyRequestsLimit: 0, dailyCharactersLimit: 0, requestsPerMinuteLimit: 0, remainingDailyRequests: 0, remainingDailyCharacters: 0 },
          usage: { totalRequests: 0, totalCharacters: 0, dailyRequestsUsed: 0, dailyCharactersUsed: 0, lastRequestAt: null, recentEvents: [] },
          issuedAt: null,
          expiresAt: null,
        },
        [ASTRA_DEVICE_STORAGE_KEY]: {
          version: 1,
          deviceId: "device-123",
          label: "Chrome on macOS",
          platform: "macos",
          browserFamily: "chrome",
          appKind: "extension",
          appVersion: "0.1.0-test",
          createdAt: "2026-04-09T00:00:00.000Z",
          updatedAt: "2026-04-09T00:00:00.000Z",
        },
      })) as ReturnType<typeof createMockBrowser>

      fetchAstraSyncBootstrapMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:00.000Z",
        deviceId: "device-123",
        collections: {
          config: { enabled: true, defaultEnabled: true, cursor: "cfg-1" },
          vocabulary: { enabled: true, defaultEnabled: true, cursor: null },
          review_schedule: { enabled: true, defaultEnabled: true, cursor: null },
          reading_history: { enabled: false, defaultEnabled: false, cursor: null },
          study_progress: { enabled: false, defaultEnabled: false, cursor: null },
        },
        limits: { maxMutationsPerRequest: 200 },
        transport: { deviceHeader: "X-Astra-Device-Id", idempotencyKey: "clientMutationId", cursorMode: "per-collection" },
      })
      pullAstraSyncDeltasMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:40.000Z",
        deltas: {
          config: [
            {
              collection: "config",
              schemaVersion: 1,
              recordId: "global",
              operation: "upsert",
              clientMutationId: "mut-config-1",
              deviceId: "device-remote",
              clientUpdatedAt: "2026-04-09T01:00:30.000Z",
              payload: { kind: "global", config: { targetLang: "ja" } },
              ownerId: "usr_demo",
              email: "user@example.com",
              serverMutationId: "srv-c1",
              serverUpdatedAt: "2026-04-09T01:00:35.000Z",
              cursor: "cfg-2",
            },
            {
              collection: "config",
              schemaVersion: 1,
              recordId: "__owned_reading_metadata_v1__:or_epub_astra-local%3A%2F%2Fepub%2Fbook.epub",
              operation: "upsert",
              clientMutationId: "mut-owned-1",
              deviceId: "device-remote",
              clientUpdatedAt: "2026-04-09T01:00:30.000Z",
              payload: {
                id: "or_epub_astra-local%3A%2F%2Fepub%2Fbook.epub",
                sourceType: "epub",
                title: "Remote fresh",
                sourceUrl: null,
                localUri: "astra-local://epub/book.epub",
                reopenHint: "Choose the same file in the ePub reader: book.epub",
                openedAt: 2000,
                updatedAt: 2000,
                status: "in_progress",
                readingHistoryRecordId: null,
                studyProgressRecordId: null,
              },
              ownerId: "usr_demo",
              email: "user@example.com",
              serverMutationId: "srv-o1",
              serverUpdatedAt: "2026-04-09T01:00:35.000Z",
              cursor: "cfg-3",
            },
          ],
          vocabulary: [],
          review_schedule: [],
          reading_history: [],
          study_progress: [],
        },
        nextCursors: { config: "cfg-3", vocabulary: null, review_schedule: null, reading_history: null, study_progress: null },
      })

      const result = await runPhaseOneCollectionSync()

      expect(result.pulled.config).toBe(2)
      expect(browser.__storage[ASTRA_CONFIG_STORAGE_KEY]).toMatchObject({ targetLang: "ja" })
      expect(browser.__storage[OWNED_READING_STORAGE_KEY]).toMatchObject({
        items: [expect.objectContaining({
          id: "or_epub_astra-local%3A%2F%2Fepub%2Fbook.epub",
          title: "Remote fresh",
          status: "in_progress",
          updatedAt: 2000,
        })],
      })
    })

    it("pushes deep-read sessions through private config records", async () => {
      setMockBrowser(createMockBrowser({
        [DEEP_READ_SESSION_STORAGE_KEY]: {
          sessions: [{
            pageUrl: "https://example.com/article?utm=1#top",
            pageTitle: "Example article",
            hostname: "example.com",
            sentences: ["Intro.", "Resume here."],
            selectedSentenceAnchor: {
              sentenceText: "Resume here.",
              sentenceHash: "fnv1a:resume",
              sentenceIndex: 1,
            },
            selectedSentenceIndex: 1,
            updatedAt: 2000,
          }],
        },
        [ASTRA_AUTH_STORAGE_KEY]: {
          version: 1,
          sessionToken: "astra-session",
          sessionId: "sess-1",
          deviceId: "device-123",
          identityMode: "authenticated",
          relayBaseURL: "https://astra.example/v1",
          email: "user@example.com",
          plan: "pro",
          subscriptionStatus: "active",
          providerEntitlements: ["openai", "gemini"],
          quota: { dailyRequestsLimit: 0, dailyCharactersLimit: 0, requestsPerMinuteLimit: 0, remainingDailyRequests: 0, remainingDailyCharacters: 0 },
          usage: { totalRequests: 0, totalCharacters: 0, dailyRequestsUsed: 0, dailyCharactersUsed: 0, lastRequestAt: null, recentEvents: [] },
          issuedAt: null,
          expiresAt: null,
        },
        [ASTRA_DEVICE_STORAGE_KEY]: {
          version: 1,
          deviceId: "device-123",
          label: "Chrome on macOS",
          platform: "macos",
          browserFamily: "chrome",
          appKind: "extension",
          appVersion: "0.1.0-test",
          createdAt: "2026-04-09T00:00:00.000Z",
          updatedAt: "2026-04-09T00:00:00.000Z",
        },
      }))

      fetchAstraSyncBootstrapMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:00.000Z",
        deviceId: "device-123",
        collections: {
          config: { enabled: true, defaultEnabled: true, cursor: null },
          vocabulary: { enabled: false, defaultEnabled: false, cursor: null },
          review_schedule: { enabled: true, defaultEnabled: true, cursor: null },
          reading_history: { enabled: false, defaultEnabled: false, cursor: null },
          study_progress: { enabled: false, defaultEnabled: false, cursor: null },
        },
        limits: { maxMutationsPerRequest: 200 },
        transport: { deviceHeader: "X-Astra-Device-Id", idempotencyKey: "clientMutationId", cursorMode: "per-collection" },
      })
      pushAstraSyncMutationsMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:30.000Z",
        accepted: [],
        rejected: [],
        nextCursors: { config: "cfg-1", vocabulary: null, review_schedule: null, reading_history: null, study_progress: null },
      })
      pullAstraSyncDeltasMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:40.000Z",
        deltas: { config: [], vocabulary: [], review_schedule: [], reading_history: [], study_progress: [] },
        nextCursors: { config: "cfg-1", vocabulary: null, review_schedule: null, reading_history: null, study_progress: null },
      })

      const result = await runPhaseOneCollectionSync()

      expect(result.pushed.config).toBe(1)
      expect(pushAstraSyncMutationsMock).toHaveBeenCalledWith(expect.objectContaining({
        mutations: [expect.objectContaining({
          collection: "config",
          recordId: "__deep_read_session_v1__:https%3A%2F%2Fexample.com%2Farticle",
          operation: "upsert",
          payload: expect.objectContaining({
            pageUrl: "https://example.com/article",
            selectedSentenceIndex: 1,
            selectedSentenceAnchor: expect.objectContaining({ sentenceHash: "fnv1a:resume" }),
            updatedAt: 2000,
          }),
        })],
      }))
    })

    it("pulls deep-read sessions from private config records", async () => {
      const browser = setMockBrowser(createMockBrowser({
        [ASTRA_AUTH_STORAGE_KEY]: {
          version: 1,
          sessionToken: "astra-session",
          sessionId: "sess-1",
          deviceId: "device-123",
          identityMode: "authenticated",
          relayBaseURL: "https://astra.example/v1",
          email: "user@example.com",
          plan: "pro",
          subscriptionStatus: "active",
          providerEntitlements: ["openai", "gemini"],
          quota: { dailyRequestsLimit: 0, dailyCharactersLimit: 0, requestsPerMinuteLimit: 0, remainingDailyRequests: 0, remainingDailyCharacters: 0 },
          usage: { totalRequests: 0, totalCharacters: 0, dailyRequestsUsed: 0, dailyCharactersUsed: 0, lastRequestAt: null, recentEvents: [] },
          issuedAt: null,
          expiresAt: null,
        },
        [ASTRA_DEVICE_STORAGE_KEY]: {
          version: 1,
          deviceId: "device-123",
          label: "Chrome on macOS",
          platform: "macos",
          browserFamily: "chrome",
          appKind: "extension",
          appVersion: "0.1.0-test",
          createdAt: "2026-04-09T00:00:00.000Z",
          updatedAt: "2026-04-09T00:00:00.000Z",
        },
      })) as ReturnType<typeof createMockBrowser>

      fetchAstraSyncBootstrapMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:00.000Z",
        deviceId: "device-123",
        collections: {
          config: { enabled: true, defaultEnabled: true, cursor: "cfg-1" },
          vocabulary: { enabled: false, defaultEnabled: false, cursor: null },
          review_schedule: { enabled: true, defaultEnabled: true, cursor: null },
          reading_history: { enabled: false, defaultEnabled: false, cursor: null },
          study_progress: { enabled: false, defaultEnabled: false, cursor: null },
        },
        limits: { maxMutationsPerRequest: 200 },
        transport: { deviceHeader: "X-Astra-Device-Id", idempotencyKey: "clientMutationId", cursorMode: "per-collection" },
      })
      pullAstraSyncDeltasMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:40.000Z",
        deltas: {
          config: [{
            collection: "config",
            schemaVersion: 1,
            recordId: "__deep_read_session_v1__:https%3A%2F%2Fexample.com%2Farticle",
            operation: "upsert",
            clientMutationId: "mut-deep-1",
            deviceId: "device-remote",
            clientUpdatedAt: "2026-04-09T01:00:30.000Z",
            payload: {
              pageUrl: "https://example.com/article",
              pageTitle: "Remote article",
              hostname: "example.com",
              sentences: ["Intro.", "Remote resume."],
              selectedSentenceAnchor: { sentenceText: "Remote resume.", sentenceHash: "fnv1a:remote", sentenceIndex: 1 },
              selectedSentenceIndex: 1,
              updatedAt: 3000,
            },
            ownerId: "usr_demo",
            email: "user@example.com",
            serverMutationId: "srv-deep-1",
            serverUpdatedAt: "2026-04-09T01:00:35.000Z",
            cursor: "cfg-2",
          }],
          vocabulary: [],
          review_schedule: [],
          reading_history: [],
          study_progress: [],
        },
        nextCursors: { config: "cfg-2", vocabulary: null, review_schedule: null, reading_history: null, study_progress: null },
      })

      const result = await runPhaseOneCollectionSync()

      expect(result.pulled.config).toBe(1)
      expect(browser.__storage[DEEP_READ_SESSION_STORAGE_KEY]).toMatchObject({
        sessions: [expect.objectContaining({
          pageUrl: "https://example.com/article",
          pageTitle: "Remote article",
          selectedSentenceIndex: 1,
          selectedSentenceAnchor: expect.objectContaining({ sentenceHash: "fnv1a:remote" }),
          updatedAt: 3000,
        })],
      })
    })

    it("emits private config deletes for owned-reading rows removed after a synced shadow", async () => {
      setMockBrowser(createMockBrowser({
        [OWNED_READING_STORAGE_KEY]: { version: 1, items: [] },
        "astra.sync.phase1.v1": {
          version: 1,
          accountEmail: "user@example.com",
          collections: {
            config: {
              cursor: "cfg-1",
              shadow: {
                "__owned_reading_metadata_v1__:or_article_deleted": {
                  id: "or_article_deleted",
                  sourceType: "article",
                  title: "Deleted",
                  sourceUrl: "https://example.com/deleted",
                  localUri: null,
                  openedAt: 1000,
                  updatedAt: 1000,
                  status: "saved",
                  readingHistoryRecordId: "https://example.com/deleted",
                  studyProgressRecordId: "https://example.com/deleted",
                },
              },
            },
            vocabulary: { cursor: null, shadow: {} },
            review_schedule: { cursor: null, shadow: {} },
            reading_history: { cursor: null, shadow: {} },
            study_progress: { cursor: null, shadow: {} },
          },
          lastRunAt: "2026-04-09T01:00:00.000Z",
          lastSuccessAt: "2026-04-09T01:00:00.000Z",
          lastError: null,
        },
        [ASTRA_AUTH_STORAGE_KEY]: {
          version: 1,
          sessionToken: "astra-session",
          sessionId: "sess-1",
          deviceId: "device-123",
          identityMode: "authenticated",
          relayBaseURL: "https://astra.example/v1",
          email: "user@example.com",
          plan: "pro",
          subscriptionStatus: "active",
          providerEntitlements: ["openai", "gemini"],
          quota: { dailyRequestsLimit: 0, dailyCharactersLimit: 0, requestsPerMinuteLimit: 0, remainingDailyRequests: 0, remainingDailyCharacters: 0 },
          usage: { totalRequests: 0, totalCharacters: 0, dailyRequestsUsed: 0, dailyCharactersUsed: 0, lastRequestAt: null, recentEvents: [] },
          issuedAt: null,
          expiresAt: null,
        },
        [ASTRA_DEVICE_STORAGE_KEY]: {
          version: 1,
          deviceId: "device-123",
          label: "Chrome on macOS",
          platform: "macos",
          browserFamily: "chrome",
          appKind: "extension",
          appVersion: "0.1.0-test",
          createdAt: "2026-04-09T00:00:00.000Z",
          updatedAt: "2026-04-09T00:00:00.000Z",
        },
      }))

      fetchAstraSyncBootstrapMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:00.000Z",
        deviceId: "device-123",
        collections: {
          config: { enabled: true, defaultEnabled: true, cursor: "cfg-1" },
          vocabulary: { enabled: true, defaultEnabled: true, cursor: null },
          review_schedule: { enabled: true, defaultEnabled: true, cursor: null },
          reading_history: { enabled: false, defaultEnabled: false, cursor: null },
          study_progress: { enabled: false, defaultEnabled: false, cursor: null },
        },
        limits: { maxMutationsPerRequest: 200 },
        transport: { deviceHeader: "X-Astra-Device-Id", idempotencyKey: "clientMutationId", cursorMode: "per-collection" },
      })
      pushAstraSyncMutationsMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:30.000Z",
        accepted: [],
        rejected: [],
        nextCursors: { config: "cfg-2", vocabulary: null, review_schedule: null, reading_history: null, study_progress: null },
      })
      pullAstraSyncDeltasMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:40.000Z",
        deltas: { config: [], vocabulary: [], review_schedule: [], reading_history: [], study_progress: [] },
        nextCursors: { config: "cfg-2", vocabulary: null, review_schedule: null, reading_history: null, study_progress: null },
      })

      await runPhaseOneCollectionSync()

      expect(pushAstraSyncMutationsMock).toHaveBeenCalledWith(expect.objectContaining({
        mutations: expect.arrayContaining([
          expect.objectContaining({
            collection: "config",
            recordId: "__owned_reading_metadata_v1__:or_article_deleted",
            operation: "delete",
            payload: null,
          }),
        ]),
      }))
    })

    it("ignores pulled study progress deltas when the optional collection is disabled", async () => {
      const browser = setMockBrowser(createMockBrowser({
        [STUDY_PROGRESS_STORAGE_KEY]: {
          pages: [],
          dailyStats: {
            date: "2026-04-09",
            pagesStudied: 0,
            sentencesExplained: 0,
            vocabSaved: 0,
            vocabReviewed: 0,
          },
        },
        [ASTRA_AUTH_STORAGE_KEY]: {
          version: 1,
          sessionToken: "astra-session",
          sessionId: "sess-1",
          deviceId: "device-123",
          identityMode: "authenticated",
          relayBaseURL: "https://astra.example/v1",
          email: "user@example.com",
          plan: "pro",
          subscriptionStatus: "active",
          providerEntitlements: ["openai", "gemini"],
          quota: { dailyRequestsLimit: 0, dailyCharactersLimit: 0, requestsPerMinuteLimit: 0, remainingDailyRequests: 0, remainingDailyCharacters: 0 },
          usage: { totalRequests: 0, totalCharacters: 0, dailyRequestsUsed: 0, dailyCharactersUsed: 0, lastRequestAt: null, recentEvents: [] },
          issuedAt: null,
          expiresAt: null,
        },
        [ASTRA_DEVICE_STORAGE_KEY]: {
          version: 1,
          deviceId: "device-123",
          label: "Chrome on macOS",
          platform: "macos",
          browserFamily: "chrome",
          appKind: "extension",
          appVersion: "0.1.0-test",
          createdAt: "2026-04-09T00:00:00.000Z",
          updatedAt: "2026-04-09T00:00:00.000Z",
        },
      })) as ReturnType<typeof createMockBrowser>

      fetchAstraSyncBootstrapMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:00.000Z",
        deviceId: "device-123",
        collections: {
          config: { enabled: true, defaultEnabled: true, cursor: null },
          vocabulary: { enabled: true, defaultEnabled: true, cursor: null },
          review_schedule: { enabled: true, defaultEnabled: true, cursor: null },
          reading_history: { enabled: false, defaultEnabled: false, cursor: null },
          study_progress: { enabled: false, defaultEnabled: false, cursor: null },
        },
        limits: { maxMutationsPerRequest: 200 },
        transport: { deviceHeader: "X-Astra-Device-Id", idempotencyKey: "clientMutationId", cursorMode: "per-collection" },
      })
      pushAstraSyncMutationsMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:30.000Z",
        accepted: [],
        rejected: [],
        nextCursors: { config: null, vocabulary: null, review_schedule: null, reading_history: null, study_progress: null },
      })
      pullAstraSyncDeltasMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:40.000Z",
        deltas: {
          config: [],
          vocabulary: [],
          review_schedule: [],
          reading_history: [],
          study_progress: [{
            collection: "study_progress",
            schemaVersion: 1,
            recordId: "https://example.com/article",
            operation: "upsert",
            clientMutationId: "mut-progress-1",
            deviceId: "device-remote",
            clientUpdatedAt: "2026-04-09T01:00:30.000Z",
            payload: {
              url: "https://example.com/article",
              hostname: "example.com",
              title: "Remote title",
              completedSteps: ["read"],
              sentencesExplained: 1,
              vocabSaved: 0,
              startedAt: 100,
              lastActivityAt: 200,
            },
            ownerId: "usr_demo",
            email: "user@example.com",
            serverMutationId: "srv-p1",
            serverUpdatedAt: "2026-04-09T01:00:35.000Z",
            cursor: "progress-2",
          }],
        },
        nextCursors: { config: null, vocabulary: null, review_schedule: null, reading_history: null, study_progress: "progress-2" },
      })

      const result = await runPhaseOneCollectionSync()

      expect(result.pulled.study_progress).toBe(0)
      expect(browser.__storage[STUDY_PROGRESS_STORAGE_KEY]).toEqual({
        pages: [],
        dailyStats: {
          date: "2026-04-09",
          pagesStudied: 0,
          sentencesExplained: 0,
          vocabSaved: 0,
          vocabReviewed: 0,
        },
      })
    })

    it("syncs per-page study progress while preserving local-only daily stats", async () => {
      const browser = setMockBrowser(createMockBrowser({
        [STUDY_PROGRESS_STORAGE_KEY]: {
          pages: [{
            url: "https://example.com/article?utm=1",
            hostname: "example.com",
            title: "Local title",
            completedSteps: ["read"],
            sentencesExplained: 1,
            vocabSaved: 0,
            startedAt: 100,
            lastActivityAt: 150,
          }],
          dailyStats: {
            date: "2026-04-09",
            pagesStudied: 1,
            sentencesExplained: 7,
            vocabSaved: 4,
            vocabReviewed: 2,
          },
        },
        [ASTRA_AUTH_STORAGE_KEY]: {
          version: 1,
          sessionToken: "astra-session",
          sessionId: "sess-1",
          deviceId: "device-123",
          identityMode: "authenticated",
          relayBaseURL: "https://astra.example/v1",
          email: "user@example.com",
          plan: "pro",
          subscriptionStatus: "active",
          providerEntitlements: ["openai", "gemini"],
          quota: { dailyRequestsLimit: 0, dailyCharactersLimit: 0, requestsPerMinuteLimit: 0, remainingDailyRequests: 0, remainingDailyCharacters: 0 },
          usage: { totalRequests: 0, totalCharacters: 0, dailyRequestsUsed: 0, dailyCharactersUsed: 0, lastRequestAt: null, recentEvents: [] },
          issuedAt: null,
          expiresAt: null,
        },
        [ASTRA_DEVICE_STORAGE_KEY]: {
          version: 1,
          deviceId: "device-123",
          label: "Chrome on macOS",
          platform: "macos",
          browserFamily: "chrome",
          appKind: "extension",
          appVersion: "0.1.0-test",
          createdAt: "2026-04-09T00:00:00.000Z",
          updatedAt: "2026-04-09T00:00:00.000Z",
        },
      })) as ReturnType<typeof createMockBrowser>

      fetchAstraSyncBootstrapMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:00.000Z",
        deviceId: "device-123",
        collections: {
          config: { enabled: true, defaultEnabled: true, cursor: null },
          vocabulary: { enabled: true, defaultEnabled: true, cursor: null },
          review_schedule: { enabled: true, defaultEnabled: true, cursor: null },
          reading_history: { enabled: false, defaultEnabled: false, cursor: null },
          study_progress: { enabled: true, defaultEnabled: false, cursor: null },
        },
        limits: { maxMutationsPerRequest: 200 },
        transport: { deviceHeader: "X-Astra-Device-Id", idempotencyKey: "clientMutationId", cursorMode: "per-collection" },
      })
      pushAstraSyncMutationsMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:30.000Z",
        accepted: [],
        rejected: [],
        nextCursors: { config: null, vocabulary: null, review_schedule: null, reading_history: null, study_progress: "progress-1" },
      })
      pullAstraSyncDeltasMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:40.000Z",
        deltas: {
          config: [],
          vocabulary: [],
          review_schedule: [],
          reading_history: [],
          study_progress: [{
            collection: "study_progress",
            schemaVersion: 1,
            recordId: "https://example.com/article",
            operation: "upsert",
            clientMutationId: "mut-progress-1",
            deviceId: "device-remote",
            clientUpdatedAt: "2026-04-09T01:00:30.000Z",
            payload: {
              url: "https://example.com/article",
              hostname: "example.com",
              title: "Remote title",
              completedSteps: ["read", "guided_read", "explain"],
              sentencesExplained: 3,
              vocabSaved: 2,
              startedAt: 90,
              lastActivityAt: 300,
            },
            ownerId: "usr_demo",
            email: "user@example.com",
            serverMutationId: "srv-p1",
            serverUpdatedAt: "2026-04-09T01:00:35.000Z",
            cursor: "progress-2",
          }],
        },
        nextCursors: { config: null, vocabulary: null, review_schedule: null, reading_history: null, study_progress: "progress-2" },
      })

      const result = await runPhaseOneCollectionSync()

      expect(result.pushed.study_progress).toBe(1)
      expect(result.pulled.study_progress).toBe(1)
      expect(pushAstraSyncMutationsMock).toHaveBeenCalledWith(expect.objectContaining({
        mutations: expect.arrayContaining([
          expect.objectContaining({
            collection: "study_progress",
            recordId: "https://example.com/article",
            payload: expect.objectContaining({
              url: "https://example.com/article",
              completedSteps: ["read"],
            }),
          }),
        ]),
      }))
      expect(browser.__storage[STUDY_PROGRESS_STORAGE_KEY]).toEqual(expect.objectContaining({
        pages: [expect.objectContaining({
          url: "https://example.com/article",
          title: "Remote title",
          completedSteps: ["read", "guided_read", "explain"],
          sentencesExplained: 3,
          vocabSaved: 2,
          startedAt: 90,
          lastActivityAt: 300,
        })],
        dailyStats: {
          date: "2026-04-09",
          pagesStudied: 1,
          sentencesExplained: 7,
          vocabSaved: 4,
          vocabReviewed: 2,
        },
      }))
    })

    it("repairs local sync state when pull cursors expire after compaction", async () => {
      const browser = setMockBrowser(createMockBrowser({
        [ASTRA_CONFIG_STORAGE_KEY]: {
          ...DEFAULT_ASTRA_CONFIG,
          targetLang: "ko",
          provider: {
            ...DEFAULT_ASTRA_CONFIG.provider,
            apiKey: "local-key",
          },
        },
        [VOCABULARY_STORAGE_KEY]: [{ id: "stale-word", text: "stale", savedAt: 1000 }],
        [VOCABULARY_REVIEW_SCHEDULE_STORAGE_KEY]: [{
          vocabularyEntryId: "stale-word",
          srsBox: 2,
          nextReviewAt: 3000,
          reviewCount: 1,
          lastReviewedAt: 2000,
          lastReviewGrade: "good",
          lastReviewGradeAt: 2000,
          updatedAt: 2000,
        }],
        [READING_HISTORY_STORAGE_KEY]: [{
          id: "https://example.com/stale",
          url: "https://example.com/stale",
          hostname: "example.com",
          title: "Stale",
          wordsTranslated: 1,
          visitedAt: 1000,
        }],
        [STUDY_PROGRESS_STORAGE_KEY]: {
          pages: [{
            url: "https://example.com/stale",
            hostname: "example.com",
            title: "Stale",
            completedSteps: ["read"],
            sentencesExplained: 1,
            vocabSaved: 0,
            startedAt: 100,
            lastActivityAt: 100,
          }],
          dailyStats: {
            date: "2026-04-09",
            pagesStudied: 1,
            sentencesExplained: 3,
            vocabSaved: 0,
            vocabReviewed: 0,
          },
        },
        [OWNED_READING_STORAGE_KEY]: {
          version: 1,
          items: [{
            id: "or_article_repair_deleted",
            sourceType: "article",
            title: "Repair deleted",
            sourceUrl: "https://example.com/repair-deleted",
            localUri: null,
            openedAt: 1000,
            updatedAt: 1000,
            status: "saved",
            readingHistoryRecordId: "https://example.com/repair-deleted",
            studyProgressRecordId: "https://example.com/repair-deleted",
          }],
        },
        [DEEP_READ_SESSION_STORAGE_KEY]: {
          sessions: [{
            pageUrl: "https://example.com/local-only",
            pageTitle: "Local only newer",
            hostname: "example.com",
            sentences: ["Local only."],
            selectedSentenceAnchor: { sentenceText: "Local only.", sentenceHash: "fnv1a:local", sentenceIndex: 0 },
            selectedSentenceIndex: 0,
            updatedAt: 3000,
          }],
        },
        "astra.sync.phase1.v1": {
          version: 1,
          accountEmail: "user@example.com",
          collections: {
            config: {
              cursor: "cfg-1",
              shadow: {
                "__owned_reading_metadata_v1__:or_article_repair_deleted": {
                  id: "or_article_repair_deleted",
                  sourceType: "article",
                  title: "Repair deleted",
                  sourceUrl: "https://example.com/repair-deleted",
                  localUri: null,
                  openedAt: 1000,
                  updatedAt: 1000,
                  status: "saved",
                  readingHistoryRecordId: "https://example.com/repair-deleted",
                  studyProgressRecordId: "https://example.com/repair-deleted",
                },
                "__deep_read_session_v1__:https%3A%2F%2Fexample.com%2Flocal-only": {
                  pageUrl: "https://example.com/local-only",
                  pageTitle: "Local only old shadow",
                  hostname: "example.com",
                  sentences: ["Local only."],
                  selectedSentenceAnchor: { sentenceText: "Local only.", sentenceHash: "fnv1a:local", sentenceIndex: 0 },
                  selectedSentenceIndex: 0,
                  updatedAt: 1000,
                },
              },
            },
            vocabulary: { cursor: "voc-1", shadow: {} },
            review_schedule: { cursor: null, shadow: {} },
            reading_history: { cursor: "hist-1", shadow: {} },
            study_progress: { cursor: "progress-1", shadow: {} },
          },
          lastRunAt: "2026-04-09T00:59:00.000Z",
          lastSuccessAt: "2026-04-09T00:59:00.000Z",
          lastError: null,
        },
        [ASTRA_AUTH_STORAGE_KEY]: {
          version: 1,
          sessionToken: "astra-session",
          sessionId: "sess-1",
          deviceId: "device-123",
          identityMode: "authenticated",
          relayBaseURL: "https://astra.example/v1",
          email: "user@example.com",
          plan: "pro",
          subscriptionStatus: "active",
          providerEntitlements: ["openai", "gemini"],
          quota: { dailyRequestsLimit: 0, dailyCharactersLimit: 0, requestsPerMinuteLimit: 0, remainingDailyRequests: 0, remainingDailyCharacters: 0 },
          usage: { totalRequests: 0, totalCharacters: 0, dailyRequestsUsed: 0, dailyCharactersUsed: 0, lastRequestAt: null, recentEvents: [] },
          issuedAt: null,
          expiresAt: null,
        },
        [ASTRA_DEVICE_STORAGE_KEY]: {
          version: 1,
          deviceId: "device-123",
          label: "Chrome on macOS",
          platform: "macos",
          browserFamily: "chrome",
          appKind: "extension",
          appVersion: "0.1.0-test",
          createdAt: "2026-04-09T00:00:00.000Z",
          updatedAt: "2026-04-09T00:00:00.000Z",
        },
      })) as ReturnType<typeof createMockBrowser>

      fetchAstraSyncBootstrapMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:00.000Z",
        deviceId: "device-123",
        collections: {
          config: { enabled: true, defaultEnabled: true, cursor: "cfg-2" },
          vocabulary: { enabled: true, defaultEnabled: true, cursor: "voc-2" },
          review_schedule: { enabled: true, defaultEnabled: true, cursor: null },
          reading_history: { enabled: true, defaultEnabled: false, cursor: "hist-2" },
          study_progress: { enabled: true, defaultEnabled: false, cursor: "progress-2" },
        },
        limits: { maxMutationsPerRequest: 200 },
        transport: { deviceHeader: "X-Astra-Device-Id", idempotencyKey: "clientMutationId", cursorMode: "per-collection" },
      })
      pushAstraSyncMutationsMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:30.000Z",
        accepted: [],
        rejected: [],
        nextCursors: { config: "cfg-2", vocabulary: "voc-2", review_schedule: "sched-2", reading_history: "hist-2", study_progress: "progress-2" },
      })
      pullAstraSyncDeltasMock.mockRejectedValue(new AstraApiError({
        status: 409,
        code: "CURSOR_EXPIRED",
        message: "Repair required.",
        details: { collection: "config", compactionFloorCursor: "cfg-2" },
      }))
      repairAstraSyncStateMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:40.000Z",
        collections: {
          config: {
            enabled: true,
            defaultEnabled: true,
            latestCursor: "cfg-4",
            compactionFloorCursor: "cfg-2",
            records: [{
              recordId: "global",
              payload: {
                kind: "global",
                config: {
                  version: 1,
                  targetLang: "ja",
                  connectionMode: "astra",
                  hoverTrigger: "alt",
                  contentScope: "page",
                  inputTranslation: "enabled",
                  inputTranslationMode: "replace",
                  languageLevel: "intermediate",
                  privacyMode: false,
                  provider: { id: "openai", model: "gpt-5.4-nano" },
                  tts: { enabled: true, engine: "browser", rate: 0.9, pitch: 1, highlightSentences: true },
                  presentation: { mode: "bilingual", theme: "default", fontSize: 0.92, translationColor: "#64748b" },
                },
              },
              lastClientMutationId: "cfg-4",
              lastDeviceId: "device-remote",
              lastServerUpdatedAt: "2026-04-09T01:00:35.000Z",
              cursor: "cfg-4",
            }, {
              recordId: "__deep_read_session_v1__:https%3A%2F%2Fexample.com%2Fremote",
              payload: {
                pageUrl: "https://example.com/remote",
                pageTitle: "Remote repaired",
                hostname: "example.com",
                sentences: ["Remote repaired."],
                selectedSentenceAnchor: { sentenceText: "Remote repaired.", sentenceHash: "fnv1a:remote-repair", sentenceIndex: 0 },
                selectedSentenceIndex: 0,
                updatedAt: 4000,
              },
              lastClientMutationId: "cfg-5",
              lastDeviceId: "device-remote",
              lastServerUpdatedAt: "2026-04-09T01:00:36.000Z",
              cursor: "cfg-5",
            }],
          },
          vocabulary: {
            enabled: true,
            defaultEnabled: true,
            latestCursor: "voc-4",
            compactionFloorCursor: null,
            records: [{
              recordId: "word-1",
              payload: { id: "word-1", text: "fresh", translation: "新鲜", savedAt: 2000 },
              lastClientMutationId: "voc-4",
              lastDeviceId: "device-remote",
              lastServerUpdatedAt: "2026-04-09T01:00:35.000Z",
              cursor: "voc-4",
            }],
          },
          reading_history: {
            enabled: true,
            defaultEnabled: false,
            latestCursor: "hist-4",
            compactionFloorCursor: null,
            records: [{
              recordId: "https://example.com/fresh",
              payload: {
                id: "https://example.com/fresh",
                url: "https://example.com/fresh",
                hostname: "example.com",
                title: "Fresh",
                wordsTranslated: 8,
                visitedAt: 2000,
              },
              lastClientMutationId: "hist-4",
              lastDeviceId: "device-remote",
              lastServerUpdatedAt: "2026-04-09T01:00:35.000Z",
              cursor: "hist-4",
            }],
          },
          study_progress: {
            enabled: true,
            defaultEnabled: false,
            latestCursor: "progress-4",
            compactionFloorCursor: null,
            records: [{
              recordId: "https://example.com/fresh",
              payload: {
                url: "https://example.com/fresh",
                hostname: "example.com",
                title: "Fresh",
                completedSteps: ["read", "guided_read"],
                sentencesExplained: 2,
                vocabSaved: 1,
                startedAt: 120,
                lastActivityAt: 250,
              },
              lastClientMutationId: "progress-4",
              lastDeviceId: "device-remote",
              lastServerUpdatedAt: "2026-04-09T01:00:35.000Z",
              cursor: "progress-4",
            }],
          },
        },
      })

      const result = await runPhaseOneCollectionSync()

      expect(result.skipped).toBe(false)
      expect(result.pulled).toEqual({ config: 2, vocabulary: 1, review_schedule: 0, reading_history: 1, study_progress: 1 })
      expect(repairAstraSyncStateMock).toHaveBeenCalledWith(expect.objectContaining({
        deviceId: "device-123",
        request: { collections: ["config", "vocabulary", "review_schedule", "reading_history", "study_progress"] },
      }))
      expect(browser.__storage[ASTRA_CONFIG_STORAGE_KEY]).toMatchObject({
        targetLang: "ja",
        provider: expect.objectContaining({ apiKey: "local-key", model: "gpt-5.4-nano" }),
      })
      expect(browser.__storage[VOCABULARY_STORAGE_KEY]).toEqual([
        expect.objectContaining({ id: "word-1", text: "fresh" }),
      ])
      expect(browser.__storage[VOCABULARY_REVIEW_SCHEDULE_STORAGE_KEY]).toEqual([
        expect.objectContaining({ vocabularyEntryId: "stale-word", updatedAt: 2000 }),
      ])
      expect(browser.__storage[READING_HISTORY_STORAGE_KEY]).toEqual([
        expect.objectContaining({ id: "https://example.com/fresh" }),
      ])
      expect(browser.__storage[STUDY_PROGRESS_STORAGE_KEY]).toEqual(expect.objectContaining({
        pages: [expect.objectContaining({ url: "https://example.com/fresh" })],
        dailyStats: expect.objectContaining({ pagesStudied: 1, sentencesExplained: 3 }),
      }))
      expect(browser.__storage[OWNED_READING_STORAGE_KEY]).toEqual(expect.objectContaining({
        items: [],
      }))
      expect(browser.__storage[DEEP_READ_SESSION_STORAGE_KEY]).toEqual({
        sessions: [
          expect.objectContaining({ pageUrl: "https://example.com/remote", pageTitle: "Remote repaired", updatedAt: 4000 }),
          expect.objectContaining({ pageUrl: "https://example.com/local-only", pageTitle: "Local only newer", updatedAt: 3000 }),
        ],
      })
    })

    it("chunks push batches to the server-advertised mutation limit", async () => {
      setMockBrowser(createMockBrowser({
        [ASTRA_CONFIG_STORAGE_KEY]: { ...DEFAULT_ASTRA_CONFIG },
        [VOCABULARY_STORAGE_KEY]: [
          { id: "word-1", text: "one", savedAt: 1000 },
          { id: "word-2", text: "two", savedAt: 2000 },
        ],
        [ASTRA_AUTH_STORAGE_KEY]: {
          version: 1,
          sessionToken: "astra-session",
          sessionId: "sess-1",
          deviceId: "device-123",
          identityMode: "authenticated",
          relayBaseURL: "https://astra.example/v1",
          email: "user@example.com",
          plan: "pro",
          subscriptionStatus: "active",
          providerEntitlements: ["openai", "gemini"],
          quota: { dailyRequestsLimit: 0, dailyCharactersLimit: 0, requestsPerMinuteLimit: 0, remainingDailyRequests: 0, remainingDailyCharacters: 0 },
          usage: { totalRequests: 0, totalCharacters: 0, dailyRequestsUsed: 0, dailyCharactersUsed: 0, lastRequestAt: null, recentEvents: [] },
          issuedAt: null,
          expiresAt: null,
        },
        [ASTRA_DEVICE_STORAGE_KEY]: {
          version: 1,
          deviceId: "device-123",
          label: "Chrome on macOS",
          platform: "macos",
          browserFamily: "chrome",
          appKind: "extension",
          appVersion: "0.1.0-test",
          createdAt: "2026-04-09T00:00:00.000Z",
          updatedAt: "2026-04-09T00:00:00.000Z",
        },
      }))

      fetchAstraSyncBootstrapMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:00.000Z",
        deviceId: "device-123",
        collections: {
          config: { enabled: true, defaultEnabled: true, cursor: null },
          vocabulary: { enabled: true, defaultEnabled: true, cursor: null },
          review_schedule: { enabled: true, defaultEnabled: true, cursor: null },
          reading_history: { enabled: false, defaultEnabled: false, cursor: null },
          study_progress: { enabled: false, defaultEnabled: false, cursor: null },
        },
        limits: { maxMutationsPerRequest: 1 },
        transport: { deviceHeader: "X-Astra-Device-Id", idempotencyKey: "clientMutationId", cursorMode: "per-collection" },
      })
      pushAstraSyncMutationsMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:30.000Z",
        accepted: [],
        rejected: [],
        nextCursors: { config: null, vocabulary: null, review_schedule: null, reading_history: null, study_progress: null },
      })
      pullAstraSyncDeltasMock.mockResolvedValue({
        serverTime: "2026-04-09T01:00:40.000Z",
        deltas: { config: [], vocabulary: [], review_schedule: [], reading_history: [], study_progress: [] },
        nextCursors: { config: null, vocabulary: null, review_schedule: null, reading_history: null, study_progress: null },
      })

      await runPhaseOneCollectionSync()

      expect(pushAstraSyncMutationsMock).toHaveBeenCalledTimes(4)
      expect(pushAstraSyncMutationsMock.mock.calls.map((call) => call[0].mutations[0])).toEqual([
        expect.objectContaining({ collection: "vocabulary", recordId: "word-1" }),
        expect.objectContaining({ collection: "vocabulary", recordId: "word-2" }),
        expect.objectContaining({ collection: "review_schedule", recordId: "word-1" }),
        expect.objectContaining({ collection: "review_schedule", recordId: "word-2" }),
      ])
    })
  })

  describe("importConfig", () => {
    it("writes validated config, vocabulary and reading history to storage", async () => {
      const browser = setMockBrowser(createMockBrowser()) as ReturnType<typeof createMockBrowser>

      const backup = {
        _astraBackup: true,
        exportedAt: new Date().toISOString(),
        config: { ...DEFAULT_ASTRA_CONFIG, targetLang: "ja" },
        vocabulary: [{ id: "1", text: "world" }],
        readingHistory: [{
          id: "https://example.com",
          url: "https://example.com?utm=1",
          hostname: "example.com",
          title: "Example",
          wordsTranslated: 5,
          visitedAt: 2000,
        }],
      }

      await importConfig(JSON.stringify(backup))

      expect(browser.__storage[ASTRA_CONFIG_STORAGE_KEY]).toMatchObject({
        targetLang: "ja",
      })
      expect(browser.__storage[VOCABULARY_STORAGE_KEY]).toHaveLength(1)
      expect(browser.__storage[READING_HISTORY_STORAGE_KEY]).toHaveLength(1)
    })

    it("rejects invalid JSON", async () => {
      await expect(importConfig("not json")).rejects.toThrow("Invalid JSON")
    })

    it("rejects JSON without _astraBackup marker", async () => {
      await expect(importConfig(JSON.stringify({ config: {} }))).rejects.toThrow("Invalid config file")
    })

    it("rejects backup with invalid config data", async () => {
      const backup = {
        _astraBackup: true,
        exportedAt: new Date().toISOString(),
        config: { version: 99, targetLang: "" },
        vocabulary: [],
        readingHistory: [],
      }
      await expect(importConfig(JSON.stringify(backup))).rejects.toThrow("Invalid config file")
    })

    it("treats missing vocabulary / readingHistory as empty arrays", async () => {
      const browser = setMockBrowser(createMockBrowser()) as ReturnType<typeof createMockBrowser>

      const backup = {
        _astraBackup: true,
        exportedAt: new Date().toISOString(),
        config: { ...DEFAULT_ASTRA_CONFIG },
      }

      await importConfig(JSON.stringify(backup))

      expect(browser.__storage[VOCABULARY_STORAGE_KEY]).toEqual([])
      expect(browser.__storage[READING_HISTORY_STORAGE_KEY]).toEqual([])
    })
  })
})
