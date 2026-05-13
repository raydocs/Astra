import { act } from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AstraAccount, AstraSession } from "@/types/auth"
import type { LearningContinuitySyncStatus } from "@/types/messages"

const {
  readConfigMock,
  saveConfigInBackgroundMock,
  ensureAstraDeviceIdentityMock,
  readAstraSessionMock,
  saveAstraSessionMock,
  clearAstraSessionMock,
  createAstraSessionMock,
  refreshAstraSessionMock,
  revokeAstraSessionMock,
  fetchAstraAccountSummaryMock,
  fetchAstraContinuitySnapshotMock,
  commitLearningContinuitySyncMock,
  getActiveTabStudyContextMock,
  getActiveTabTranslationStateMock,
  getLearningContinuitySyncStatusMock,
  startActiveTabTranslationMock,
  stopActiveTabTranslationMock,
  getDueVocabularyCountMock,
  getVocabularyEntriesMock,
  saveVocabularyEntryMock,
  getReadingHistoryMock,
  getTranslationUsageSummaryMock,
  getStudyProgressMock,
  recordStudyEventMock,
  deriveStudyLoopViewModelMock,
  getPageDigestMock,
  isDigestStaleMock,
  generatePageDigestMock,
  savePageDigestMock,
  translateTextsMock,
  speakMock,
  stopSpeakingMock,
  isTtsSupportedMock,
} = vi.hoisted(() => ({
  readConfigMock: vi.fn(),
  saveConfigInBackgroundMock: vi.fn(),
  ensureAstraDeviceIdentityMock: vi.fn(),
  readAstraSessionMock: vi.fn(),
  saveAstraSessionMock: vi.fn(),
  clearAstraSessionMock: vi.fn(),
  createAstraSessionMock: vi.fn(),
  refreshAstraSessionMock: vi.fn(),
  revokeAstraSessionMock: vi.fn(),
  fetchAstraAccountSummaryMock: vi.fn(),
  fetchAstraContinuitySnapshotMock: vi.fn(),
  commitLearningContinuitySyncMock: vi.fn(),
  getActiveTabStudyContextMock: vi.fn(),
  getActiveTabTranslationStateMock: vi.fn(),
  getLearningContinuitySyncStatusMock: vi.fn(),
  startActiveTabTranslationMock: vi.fn(),
  stopActiveTabTranslationMock: vi.fn(),
  getDueVocabularyCountMock: vi.fn(),
  getVocabularyEntriesMock: vi.fn(),
  saveVocabularyEntryMock: vi.fn(),
  getReadingHistoryMock: vi.fn(),
  getTranslationUsageSummaryMock: vi.fn(),
  getStudyProgressMock: vi.fn(),
  recordStudyEventMock: vi.fn(),
  deriveStudyLoopViewModelMock: vi.fn(),
  getPageDigestMock: vi.fn(),
  isDigestStaleMock: vi.fn(),
  generatePageDigestMock: vi.fn(),
  savePageDigestMock: vi.fn(),
  translateTextsMock: vi.fn(),
  speakMock: vi.fn(),
  stopSpeakingMock: vi.fn(),
  isTtsSupportedMock: vi.fn(),
}))

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
}))

vi.mock("@/utils/storage/auth", () => ({
  ensureAstraDeviceIdentity: ensureAstraDeviceIdentityMock,
  readAstraSession: readAstraSessionMock,
  saveAstraSession: saveAstraSessionMock,
  clearAstraSession: clearAstraSessionMock,
}))

vi.mock("@/utils/astra/auth", () => ({
  createAstraSession: createAstraSessionMock,
  refreshAstraSession: refreshAstraSessionMock,
  revokeAstraSession: revokeAstraSessionMock,
}))

vi.mock("@/utils/astra/account", () => ({
  fetchAstraAccountSummary: fetchAstraAccountSummaryMock,
  fetchAstraContinuitySnapshot: fetchAstraContinuitySnapshotMock,
}))

vi.mock("@/utils/extension/messages", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/extension/messages")>()
  return {
    ...actual,
    commitLearningContinuitySync: commitLearningContinuitySyncMock,
    getActiveTabStudyContext: getActiveTabStudyContextMock,
    getActiveTabTranslationState: getActiveTabTranslationStateMock,
    getLearningContinuitySyncStatus: getLearningContinuitySyncStatusMock,
    saveConfigInBackground: saveConfigInBackgroundMock,
    startActiveTabTranslation: startActiveTabTranslationMock,
    stopActiveTabTranslation: stopActiveTabTranslationMock,
  }
})

vi.mock("@/utils/storage/reading-history", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/storage/reading-history")>()
  return {
    ...actual,
    getReadingHistory: getReadingHistoryMock,
  }
})

vi.mock("@/utils/storage/vocabulary", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/storage/vocabulary")>()
  return {
    ...actual,
    getDueVocabularyCount: getDueVocabularyCountMock,
    getVocabularyEntries: getVocabularyEntriesMock,
    saveVocabularyEntry: saveVocabularyEntryMock,
  }
})

vi.mock("@/utils/storage/translation-usage", () => ({
  getTranslationUsageSummary: getTranslationUsageSummaryMock,
}))

vi.mock("@/utils/storage/page-digests", () => ({
  getPageDigest: getPageDigestMock,
  savePageDigest: savePageDigestMock,
  computeFingerprint: vi.fn(() => "test-fingerprint"),
  isDigestStale: isDigestStaleMock,
}))

vi.mock("@/utils/reading/assist", () => ({
  generatePageDigest: generatePageDigestMock,
}))

vi.mock("@/utils/translate/translate", () => ({
  translateTexts: translateTextsMock,
  translateExplanationWithQualityRetry: async (request: {
    source: string
    requiredGlossaryTerms?: Array<{ sourceTerm: string; preferredTerm: string; enabled?: boolean }>
    [key: string]: unknown
  }) => {
    const {
      buildExplanationRepairInstruction,
      validateExplanationQuality,
    } = await import("@/utils/translate/explanation-quality")
    const { source, requiredGlossaryTerms = [], ...translateRequest } = request
    const baseRequest = { ...translateRequest, texts: [source], task: "explain" }
    const firstResult = await translateTextsMock(baseRequest)
    if (!firstResult.ok) return { ok: false, message: firstResult.error.message, retried: false }
    const firstText = firstResult.translations[0] ?? ""
    const firstQuality = validateExplanationQuality({ source, explanation: firstText, requiredGlossaryTerms })
    if (firstQuality.ok) return { ok: true, text: firstText, retried: false }
    const retryResult = await translateTextsMock({
      ...baseRequest,
      explanationRepairInstruction: buildExplanationRepairInstruction(firstQuality),
    })
    if (!retryResult.ok) return { ok: false, message: retryResult.error.message, retried: true, quality: firstQuality }
    const retryText = retryResult.translations[0] ?? ""
    const retryQuality = validateExplanationQuality({ source, explanation: retryText, requiredGlossaryTerms })
    if (!retryQuality.ok) return { ok: false, message: retryQuality.message, retried: true, quality: retryQuality }
    return { ok: true, text: retryText, retried: true }
  },
}))

vi.mock("@/utils/tts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/tts")>()
  return {
    ...actual,
    speak: speakMock,
    stopSpeaking: stopSpeakingMock,
    isTtsSupported: isTtsSupportedMock,
  }
})

vi.mock("@/utils/storage/study-progress", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/storage/study-progress")>()
  return {
    ...actual,
    getStudyProgress: getStudyProgressMock,
    recordStudyEvent: recordStudyEventMock,
    deriveStudyLoopViewModel: deriveStudyLoopViewModelMock,
  }
})

import type { AstraConfig } from "@/types/config"
import { DEFAULT_ASTRA_CONFIG, DEFAULT_SUBTITLE_QUALITY_CONTROLS } from "@/types/config"
import { t } from "@/utils/i18n"
import { getRecentEvents } from "@/utils/telemetry"
import { OWNED_READING_STORAGE_KEY } from "@/utils/storage/owned-reading"
import App from "./App"

function createConfig(patch: Partial<AstraConfig> = {}): AstraConfig {
  return {
    ...DEFAULT_ASTRA_CONFIG,
    ...patch,
    provider: {
      ...DEFAULT_ASTRA_CONFIG.provider,
      ...patch.provider,
    },
    presentation: {
      ...DEFAULT_ASTRA_CONFIG.presentation,
      ...patch.presentation,
    },
    subtitleQualityControls: {
      ...DEFAULT_SUBTITLE_QUALITY_CONTROLS,
      ...(patch.subtitleQualityControls ?? {}),
    },
    sites: {
      ...DEFAULT_ASTRA_CONFIG.sites,
      ...patch.sites,
    },
  }
}

function createIdleState() {
  return {
    ok: true as const,
    state: {
      phase: "idle" as const,
      sessionId: 1,
      targetLang: "zh-CN",
      lastError: null,
      progress: {
        totalBlocks: 0,
        queuedBlocks: 0,
        inFlightBlocks: 0,
        translatedBlocks: 0,
        failedBlocks: 0,
      },
      presentation: {
        mode: "bilingual" as const,
        theme: "default" as const,
      },
      site: {
        hostname: "example.com",
        enabled: true,
        alwaysTranslate: false,
      },
    },
  }
}

function createSession(patch: Partial<AstraSession> = {}): AstraSession {
  return {
    version: 1,
    sessionToken: "astra-session",
    sessionId: null,
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
    issuedAt: null,
    expiresAt: null,
    ...patch,
  }
}

function createAccount(patch: Partial<AstraAccount> = {}): AstraAccount {
  return {
    id: "usr_demo",
    relayBaseURL: "https://astra.example/v1",
    email: "user@example.com",
    billingEmail: "billing@example.com",
    createdAt: "2026-03-01T00:00:00.000Z",
    plan: "pro" as const,
    subscriptionStatus: "active" as const,
    providerEntitlements: ["openai", "gemini"] as const,
    ...patch,
  }
}

function createAccountSummary(overrides: Record<string, unknown> = {}) {
  return {
    serverTime: "2026-04-09T01:05:00.000Z",
    account: createAccount(),
    usage: {
      generatedAt: "2026-04-09T01:05:00.000Z",
      quota: {
        dailyRequestsLimit: 2000,
        dailyCharactersLimit: 200000,
        requestsPerMinuteLimit: 120,
        remainingDailyRequests: 1996,
        remainingDailyCharacters: 100000,
      },
      usage: {
        totalRequests: 4,
        totalCharacters: 100000,
        dailyRequestsUsed: 4,
        dailyCharactersUsed: 100000,
        lastRequestAt: "2026-04-09T01:00:00.000Z",
        recentEvents: [],
      },
    },
    session: {
      sessionId: "sess-123",
      deviceId: "device-123",
      issuedAt: "2026-04-09T00:00:00.000Z",
      expiresAt: null,
      identityMode: "authenticated",
      status: "active",
    },
    devices: {
      activeCount: 1,
      revokedCount: 0,
      current: null,
      entries: [],
    },
    sync: {
      maxMutationsPerRequest: 100,
      collections: {
        config: { enabled: true, defaultEnabled: true, cursor: "cfg-3", mutationCount: 3, activeCount: 1, lastSyncAt: null, compactionFloorCursor: null },
        vocabulary: { enabled: false, defaultEnabled: false, cursor: null, mutationCount: 0, activeCount: 0, lastSyncAt: null, compactionFloorCursor: null },
        review_schedule: { enabled: true, defaultEnabled: true, cursor: null, mutationCount: 0, activeCount: 0, lastSyncAt: null, compactionFloorCursor: null },
        reading_history: { enabled: false, defaultEnabled: false, cursor: null, mutationCount: 0, activeCount: 0, lastSyncAt: null, compactionFloorCursor: null },
        study_progress: { enabled: false, defaultEnabled: false, cursor: null, mutationCount: 0, activeCount: 0, lastSyncAt: null, compactionFloorCursor: null },
      },
    },
    ...overrides,
  }
}

function createLearningContinuitySyncStatus(
  patch: Partial<LearningContinuitySyncStatus> = {},
): LearningContinuitySyncStatus {
  return {
    inFlight: false,
    queued: false,
    lastReason: "popup-save",
    lastStartedAt: "2026-04-09T01:04:00.000Z",
    lastFinishedAt: "2026-04-09T01:05:00.000Z",
    lastResult: null,
    lastError: null,
    accountEmail: "user@example.com",
    stateLastRunAt: "2026-04-09T01:04:00.000Z",
    stateLastSuccessAt: "2026-04-09T01:05:00.000Z",
    stateLastError: null,
    cursors: { config: "cfg-3", vocabulary: "voc-7", review_schedule: null, reading_history: "hist-2", study_progress: "progress-4" },
    ...patch,
  }
}

describe("popup App", () => {
  let container: HTMLDivElement
  let root: ReactDOM.Root
  let rootUnmounted: boolean
  let browserMock: any

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.clearAllMocks()

    browserMock = (globalThis as { __ASTRA_TEST_BROWSER__?: any }).__ASTRA_TEST_BROWSER__
    browserMock.tabs.query.mockResolvedValue([{ id: 1, url: "https://example.com/article" }])

    ensureAstraDeviceIdentityMock.mockResolvedValue({
      version: 1,
      deviceId: "device-123",
      label: "Chrome on macOS",
      platform: "macos",
      browserFamily: "chrome",
      appKind: "extension",
      appVersion: "0.1.0-test",
      createdAt: "2026-04-09T00:00:00.000Z",
      updatedAt: "2026-04-09T00:00:00.000Z",
    })
    readConfigMock.mockResolvedValue(createConfig())
    saveConfigInBackgroundMock.mockImplementation(async (input: Partial<AstraConfig>) => ({
      ok: true,
      config: createConfig(input),
    }))
    const defaultContinuitySyncStatus = createLearningContinuitySyncStatus()
    getLearningContinuitySyncStatusMock.mockResolvedValue({
      ok: true,
      status: defaultContinuitySyncStatus,
    })
    commitLearningContinuitySyncMock.mockResolvedValue({ ok: true, status: defaultContinuitySyncStatus })
    readAstraSessionMock.mockResolvedValue(createSession())
    saveAstraSessionMock.mockImplementation(async (session: unknown) => session)
    clearAstraSessionMock.mockResolvedValue(undefined)
    createAstraSessionMock.mockResolvedValue(createSession())
    refreshAstraSessionMock.mockResolvedValue(createSession())
    revokeAstraSessionMock.mockResolvedValue(undefined)
    fetchAstraAccountSummaryMock.mockResolvedValue(createAccountSummary())
    fetchAstraContinuitySnapshotMock.mockImplementation(async (params: { includePull?: boolean }) => ({
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
      pull: params.includePull
        ? {
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
          }
        : null,
    }))
    getActiveTabTranslationStateMock.mockResolvedValue(createIdleState())
    getActiveTabStudyContextMock.mockResolvedValue({
      ok: true,
      context: {
        pageTitle: "Example article",
        pageUrl: "https://example.com/article",
        hostname: "example.com",
        contentSummary: "A concise summary of the current article for study mode.",
        articleExcerpt: "First article sentence. Second article sentence with more detail.",
      },
    })
    startActiveTabTranslationMock.mockResolvedValue(createIdleState())
    stopActiveTabTranslationMock.mockResolvedValue(createIdleState())
    getDueVocabularyCountMock.mockResolvedValue(3)
    getVocabularyEntriesMock.mockResolvedValue([])
    saveVocabularyEntryMock.mockImplementation(async (entry: unknown) => ({
      id: "vocab-1",
      savedAt: Date.now(),
      ...(entry as Record<string, unknown>),
    }))
    getReadingHistoryMock.mockResolvedValue([])
    getTranslationUsageSummaryMock.mockResolvedValue({
      sessionStartedAt: 1000,
      session: {
        requests: 2,
        texts: 3,
        chars: 48,
        estimatedInputTokens: 12,
        estimatedOutputTokens: 15,
        estimatedCostUsd: 0.001,
        directRequests: 1,
        relayRequests: 1,
        fallbackRequests: 1,
        failedRequests: 1,
        avgDurationMs: 200,
        bySource: {},
      },
      today: {
        requests: 4,
        texts: 7,
        chars: 96,
        estimatedInputTokens: 24,
        estimatedOutputTokens: 30,
        estimatedCostUsd: 0.002,
        directRequests: 2,
        relayRequests: 2,
        fallbackRequests: 1,
        failedRequests: 1,
        avgDurationMs: 180,
        bySource: { "page-translation": 3, "selection": 1 },
      },
      lastEvent: {
        id: "evt-1",
        timestamp: 1234,
        providerId: "openai",
        model: "gpt-5.4-nano",
        task: "translate",
        textCount: 1,
        charCount: 12,
        estimatedInputTokens: 3,
        attemptedTransports: ["direct", "relay"],
        finalTransport: "relay",
        fallbackUsed: true,
        route: "fallback",
        success: false,
        errorCode: "PROVIDER_REQUEST_FAILED",
      },
    })

    getPageDigestMock.mockResolvedValue(null)
    isDigestStaleMock.mockReturnValue(false)
    generatePageDigestMock.mockResolvedValue({
      headline: "Test headline",
      summary: "Test summary",
      keyPoints: ["Point 1", "Point 2"],
      vocabularyFocus: [
        { term: "signal", note: "Used to describe the article's key trend." },
      ],
      grammarFocus: ["Notice how the article uses contrast to frame the argument."],
      suggestedAction: "Explain one sentence that uses the key term in context.",
    })
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["Custom study action output"],
    })
    speakMock.mockReturnValue(true)
    stopSpeakingMock.mockReturnValue(undefined)
    isTtsSupportedMock.mockReturnValue(true)
    savePageDigestMock.mockImplementation(async (_params: unknown, digest: unknown) => ({
      ...(digest as Record<string, unknown>),
      url: "https://example.com/article",
      hostname: "example.com",
      title: "Example article",
      targetLang: "zh-CN",
      languageLevel: "beginner",
      generatedAt: Date.now(),
      sourceFingerprint: "test-fingerprint",
    }))

    getStudyProgressMock.mockResolvedValue({
      pages: [],
      dailyStats: { date: "2026-04-03", pagesStudied: 0, sentencesExplained: 0, vocabSaved: 0, vocabReviewed: 0 },
    })
    deriveStudyLoopViewModelMock.mockReturnValue({
      currentPage: null,
      completedSteps: [],
      currentCounts: { sentencesExplained: 0, vocabSaved: 0, vocabReviewed: 0 },
      nextStep: "read",
      completionPercent: 0,
      dailyStats: { date: "2026-04-03", pagesStudied: 0, sentencesExplained: 0, vocabSaved: 0, vocabReviewed: 0 },
      recentPages: [],
    })

    container = document.createElement("div")
    document.body.appendChild(container)
    root = ReactDOM.createRoot(container)
    rootUnmounted = false

    await act(async () => {
      root.render(<App />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
  })

  afterEach(async () => {
    if (!rootUnmounted) {
      await act(async () => {
        root.unmount()
        await Promise.resolve()
      })
    }
    container.remove()
    window.history.replaceState({}, "", "/popup.html")
    vi.useRealTimers()
  })

  function getButtons() {
    return Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
  }

  async function flushApp() {
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
  }

  async function getLearningLoopTelemetryEvents() {
    await flushApp()
    const events = await getRecentEvents(50)
    return events.filter((event) => event.type === "feature_usage" && event.data.feature === "learning_loop")
  }

  async function refreshPopupWithContinuityStatus(status: LearningContinuitySyncStatus | null) {
    getLearningContinuitySyncStatusMock.mockResolvedValueOnce(
      status ? { ok: true, status } : { ok: false, error: { code: "UNKNOWN", message: "No status" } },
    )
    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
  }

  async function setFormValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set

    await act(async () => {
      setter?.call(element, value)
      element.dispatchEvent(new Event("input", { bubbles: true }))
      element.dispatchEvent(new Event("change", { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })
  }

  it("renders the translate button and starts translation", async () => {
    const translateButton = getButtons().find((button) => button.textContent === t("popup_translateThisPage"))!
    expect(translateButton).toBeDefined()
    expect(translateButton.disabled).toBe(false)

    await act(async () => {
      translateButton.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(startActiveTabTranslationMock).toHaveBeenCalledWith({
      targetLang: "zh-CN",
      translationMode: "bilingual",
      translationTheme: "default",
      contentScope: "page",
    })
  })

  it("shows a quiet popup library empty state when there are no saved words or due reviews", async () => {
    getDueVocabularyCountMock.mockResolvedValueOnce(0)
    getVocabularyEntriesMock.mockResolvedValueOnce([])

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const emptyState = container.querySelector('[data-testid="popup-empty-library-state"]') as HTMLElement
    expect(emptyState).toBeTruthy()
    expect(emptyState.textContent).toContain("Your library starts empty.")
    expect(emptyState.textContent).toContain("0 saved · 0 due")
    expect(container.querySelector(".astra-quiet-header__status")).toBeTruthy()
    expect(container.querySelector(".astra-popup-today-head")).toBeTruthy()
    expect(container.querySelector(".astra-popup-shell--cert-empty")).toBeFalsy()
    expect(container.querySelector(".astra-popup-shell--empty-library")).toBeFalsy()
    expect(emptyState.textContent).toContain("Open library")
    expect(emptyState.textContent).not.toContain("How it works")
    expect(container.textContent).not.toContain("Why Solitude Is Important for Reading")
    expect(container.textContent).not.toContain("newyorker.com · 12 min read")
  })

  it("uses astraCert=1 to show a focused first-run popup empty state without normal-mode actions", async () => {
    await act(async () => {
      root.unmount()
      rootUnmounted = true
      await Promise.resolve()
    })
    container.innerHTML = ""
    window.history.pushState({}, "", "/popup.html?astraCert=1")
    getDueVocabularyCountMock.mockResolvedValue(0)
    getVocabularyEntriesMock.mockResolvedValue([])
    root = ReactDOM.createRoot(container)
    rootUnmounted = false

    await act(async () => {
      root.render(<App />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const emptyState = container.querySelector('[data-testid="popup-empty-library-state"]') as HTMLElement
    expect(emptyState).toBeTruthy()
    expect(emptyState.textContent).toContain("Your library starts empty.")
    expect(emptyState.textContent).toContain("Hover any word in a translated page and press ⌥S to keep it.")
    expect(emptyState.textContent).toContain("0 saved · 0 due")
    expect(emptyState.textContent).toContain("How it works")
    expect(container.textContent).toContain("Why Solitude Is Important for Reading")
    expect(container.textContent).toContain("newyorker.com · 12 min read")
    expect(container.querySelector(".astra-popup-shell--cert-empty")).toBeTruthy()
    expect(container.querySelector(".astra-quiet-header__status")).toBeFalsy()
    expect(container.querySelector(".astra-popup-today-head")).toBeFalsy()
    expect(container.querySelector('[aria-label="Library"]')).toBeFalsy()
    expect(emptyState.textContent).not.toContain("Open library")
    const translateButton = getButtons().find((button) => button.textContent === "Translate this page")
    expect(translateButton).toBeTruthy()
    expect(translateButton?.disabled).toBe(false)
    expect(translateButton?.getAttribute("aria-disabled")).toBe("true")
    await act(async () => {
      translateButton?.click()
      await Promise.resolve()
    })
    expect(startActiveTabTranslationMock).not.toHaveBeenCalled()
    const howItWorksButton = getButtons().find((button) => button.textContent === "How it works")
    expect(howItWorksButton?.getAttribute("aria-disabled")).toBe("true")
    const primaryGroup = container.querySelector(".astra-popup-primary-group") as HTMLElement
    expect(primaryGroup.textContent).not.toContain(t("popup_deepReadAction"))
    expect(primaryGroup.textContent).not.toContain(t("popup_contentAssetizationSaveAction"))
  })

  it("disables translation when active page URL is excluded by site path rules", async () => {
    browserMock.tabs.query.mockResolvedValue([{ id: 1, url: "https://example.com/blog/post" }])
    readConfigMock.mockResolvedValueOnce(createConfig({
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
          includePathPatterns: ["/docs/*"],
        },
      },
    }))

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const translateButton = getButtons().find((button) => button.textContent === t("popup_translateThisPage"))!
    expect(translateButton.disabled).toBe(true)
  })

  it("shows the learning closure primer above simple controls and reuses popup actions", async () => {
    await flushApp()

    const primer = container.querySelector('[data-testid="learning-closure-primer-card"]') as HTMLElement
    const languageLevelSelect = container.querySelector('[data-testid="popup-language-level-select"]') as HTMLSelectElement
    expect(primer).toBeTruthy()
    expect(primer.dataset.copyVariant).toBe("loop_first")
    expect(primer.dataset.recommendedAction).toBe("translate_page")
    expect((container.querySelector('[data-testid="learning-closure-primer-translate"]') as HTMLButtonElement).dataset.recommended).toBe("true")
    expect(container.querySelector('[data-testid="learning-closure-primer-recommended-marker"]')?.textContent).toContain("Recommended next")
    expect(primer.textContent).toContain("Reading-to-review workflow")
    expect(primer.textContent).toContain("not just translations")
    expect(primer.textContent).toContain("Free start · connected practice")
    expect(primer.textContent).toContain("Translate, Deep Read, save, and review stay in one trail")
    expect(primer.textContent).toContain("Generic translators/readers stop after the answer")
    expect(primer.textContent).toContain("First win activation")
    expect(primer.textContent).toContain("Save one useful sentence from a real page")
    expect(primer.textContent).toContain("Translate a page, open Deep Read, explain one sentence, save it")
    expect(primer.textContent).not.toContain("not unlimited bulk translation")
    expect(container.querySelector('[data-testid="learning-closure-value-stack-copy"]')).toBeFalsy()
    expect(container.querySelector('[data-testid="learning-closure-differentiation-copy"]')).toBeFalsy()
    expect(primer.compareDocumentPosition(languageLevelSelect) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    expect(await getLearningLoopTelemetryEvents()).toContainEqual(expect.objectContaining({
      data: expect.objectContaining({
        event: "popup_primer_viewed",
        source: "popup",
        variant: "loop_first",
        sentenceCount: 2,
        nextStep: "read",
        recommendedAction: "translate_page",
        recommendationReason: "next_step_read",
        actionableActionCount: 4,
        actionableActions: ["translate_page", "open_deep_read", "explain_sentence", "open_review"],
        hasActionableRecommendation: true,
      }),
    }))

    startActiveTabTranslationMock.mockClear()
    browserMock.tabs.create.mockClear()
    translateTextsMock.mockClear()

    await act(async () => {
      ;(container.querySelector('[data-testid="learning-closure-primer-translate"]') as HTMLButtonElement).click()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(startActiveTabTranslationMock).toHaveBeenCalledWith(expect.objectContaining({ contentScope: "page" }))

    await act(async () => {
      ;(container.querySelector('[data-testid="learning-closure-primer-deep-read"]') as HTMLButtonElement).click()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(browserMock.tabs.create).toHaveBeenCalledWith({ url: "/deep-read.html" })

    await act(async () => {
      ;(container.querySelector('[data-testid="learning-closure-primer-explain"]') as HTMLButtonElement).click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      task: "explain",
      texts: ["First article sentence."],
    }))

    browserMock.tabs.create.mockClear()
    await act(async () => {
      ;(container.querySelector('[data-testid="learning-closure-primer-review"]') as HTMLButtonElement).click()
      await Promise.resolve()
    })
    expect(browserMock.tabs.create).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringContaining("/vocabulary.html?tab=review"),
    }))

    const learningLoopTelemetry = await getLearningLoopTelemetryEvents()
    const primerClickActions = learningLoopTelemetry
      .filter((event) => event.data.event === "popup_primer_cta_clicked")
      .map((event) => event.data.action)
    expect(primerClickActions).toEqual(expect.arrayContaining([
      "translate_page",
      "open_deep_read",
      "explain_sentence",
      "open_review",
    ]))
    expect(learningLoopTelemetry).toContainEqual(expect.objectContaining({
      data: expect.objectContaining({
        event: "popup_primer_cta_clicked",
        action: "translate_page",
        recommendedAction: "translate_page",
        clickedRecommendedAction: true,
      }),
    }))
    expect(learningLoopTelemetry).toContainEqual(expect.objectContaining({
      data: expect.objectContaining({
        event: "popup_primer_cta_clicked",
        action: "open_deep_read",
        recommendedAction: "translate_page",
        clickedRecommendedAction: false,
      }),
    }))
    expect(learningLoopTelemetry).toContainEqual(expect.objectContaining({
      data: expect.objectContaining({
        event: "deep_read_opened",
        source: "popup",
        variant: "loop_first",
      }),
    }))
    expect(learningLoopTelemetry).toContainEqual(expect.objectContaining({
      data: expect.objectContaining({
        event: "sentence_explained",
        source: "popup_deep_read",
        variant: "loop_first",
      }),
    }))
  })

  it("renders idle subtitle QC state and polls for fresh snapshots", async () => {
    const baseState = createIdleState().state
    getActiveTabTranslationStateMock.mockResolvedValueOnce({
      ok: true,
      state: {
        ...baseState,
        subtitleQuality: {
          surface: "video",
          active: true,
          platform: "youtube",
          pipeline: "youtube-hybrid",
          source: "timedtext",
          status: "ready",
          anomalies: [],
          translatedNodeCount: 1,
          sourceTextLength: 12,
          pendingRequestCount: 0,
          cacheSize: 3,
          capturedAt: Date.now(),
        },
      },
    })

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="subtitle-qc-panel"]')?.textContent).toContain("video · youtube")
    expect(container.textContent).toContain("youtube-hybrid / timedtext")
    expect(container.textContent).toContain("ready · fresh")

    getActiveTabTranslationStateMock.mockResolvedValueOnce({
      ok: true,
      state: {
        ...baseState,
        subtitleQuality: {
          surface: "video",
          active: true,
          platform: "youtube",
          pipeline: "youtube-hybrid",
          source: null,
          status: "waiting-track",
          anomalies: ["delayed-track"],
          translatedNodeCount: 0,
          sourceTextLength: 0,
          pendingRequestCount: 1,
          cacheSize: 3,
          capturedAt: Date.now(),
        },
      },
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain("waiting-track")
    expect(container.textContent).toContain("Anomalies: delayed-track")
  })

  it("uses configured local subtitle QC poll interval and freshness threshold", async () => {
    const baseState = createIdleState().state
    readConfigMock.mockResolvedValueOnce(createConfig({
      subtitleQualityControls: {
        ...DEFAULT_SUBTITLE_QUALITY_CONTROLS,
        popupPollIntervalMs: 2200,
        freshnessThresholdMs: 7000,
      },
    }))
    getActiveTabTranslationStateMock.mockResolvedValueOnce({
      ok: true,
      state: {
        ...baseState,
        subtitleQuality: {
          surface: "video",
          active: true,
          platform: "youtube",
          pipeline: "youtube-hybrid",
          source: "timedtext",
          status: "ready",
          anomalies: [],
          translatedNodeCount: 1,
          sourceTextLength: 12,
          pendingRequestCount: 0,
          cacheSize: 3,
          capturedAt: Date.now() - 6000,
        },
      },
    })

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain("ready · fresh")
    expect((container.querySelector('input[aria-label="Subtitle QC poll interval"]') as HTMLInputElement | null)?.value).toBe("2200")
    expect((container.querySelector('input[aria-label="Subtitle QC freshness threshold"]') as HTMLInputElement | null)?.value).toBe("7000")

    const callsAfterFreshRender = getActiveTabTranslationStateMock.mock.calls.length
    getActiveTabTranslationStateMock.mockResolvedValueOnce({
      ok: true,
      state: {
        ...baseState,
        subtitleQuality: {
          surface: "video",
          active: true,
          platform: "youtube",
          pipeline: "youtube-hybrid",
          source: null,
          status: "waiting-track",
          anomalies: [],
          translatedNodeCount: 0,
          sourceTextLength: 0,
          pendingRequestCount: 1,
          cacheSize: 8,
          capturedAt: Date.now(),
        },
      },
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2199)
      await Promise.resolve()
    })
    expect(getActiveTabTranslationStateMock).toHaveBeenCalledTimes(callsAfterFreshRender)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain("waiting-track")
    expect(container.querySelector('[data-testid="subtitle-qc-trend-pending"]')?.textContent).toContain("1")
    expect(container.querySelector('[data-testid="subtitle-qc-trend-cache"]')?.textContent).toContain("8")
    expect(container.querySelector('[data-testid="subtitle-qc-preset-suggestion"]')?.textContent).toContain("live")

    const saveCallsBeforePreset = saveConfigInBackgroundMock.mock.calls.length
    await act(async () => {
      ;(container.querySelector('[data-testid="subtitle-qc-preset-apply"]') as HTMLButtonElement).click()
      await Promise.resolve()
    })
    expect(saveConfigInBackgroundMock).toHaveBeenCalledTimes(saveCallsBeforePreset + 1)
    const presetPatch = saveConfigInBackgroundMock.mock.calls.at(-1)?.[0] as Partial<AstraConfig>
    expect(Object.keys(presetPatch)).toEqual(["subtitleQualityControls"])
    expect(presetPatch.subtitleQualityControls).toEqual({
      popupPollIntervalMs: 750,
      freshnessThresholdMs: 2500,
      adaptivePresetName: "live",
      adaptivePresetManualOverrideLocked: true,
    })
  })

  it("auto-applies adaptive subtitle QC presets with a subtitleQualityControls-only patch", async () => {
    vi.setSystemTime(60_000)
    const baseState = createIdleState().state
    readConfigMock.mockResolvedValueOnce(createConfig({
      subtitleQualityControls: {
        ...DEFAULT_SUBTITLE_QUALITY_CONTROLS,
        adaptivePresetAutoSwitchEnabled: true,
        adaptivePresetCooldownMs: 30_000,
        adaptivePresetLastAppliedAt: 0,
        adaptivePresetName: "standard",
      },
    }))
    getActiveTabTranslationStateMock.mockResolvedValueOnce({
      ok: true,
      state: {
        ...baseState,
        subtitleQuality: {
          surface: "video",
          active: true,
          platform: "youtube",
          pipeline: "youtube-hybrid",
          source: "timedtext",
          status: "ready",
          anomalies: [],
          translatedNodeCount: 1,
          sourceTextLength: 12,
          pendingRequestCount: 0,
          cacheSize: 8,
          capturedAt: Date.now(),
        },
      },
    })

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    await flushApp()

    const autoPatch = saveConfigInBackgroundMock.mock.calls
      .map((call) => call[0] as Partial<AstraConfig>)
      .find((patch) => patch.subtitleQualityControls?.adaptivePresetName === "saver")
    expect(autoPatch).toBeDefined()
    expect(Object.keys(autoPatch ?? {})).toEqual(["subtitleQualityControls"])
    expect(autoPatch?.subtitleQualityControls).toEqual({
      popupPollIntervalMs: 5000,
      freshnessThresholdMs: 15000,
      adaptivePresetName: "saver",
      adaptivePresetLastAppliedAt: 60_000,
    })
  })

  it("exports local subtitle QC diagnostics JSON from the popup", async () => {
    let createdDiagnosticsBlob: Blob | null = null
    const createObjectURLMock = vi.fn((blob: Blob) => {
      createdDiagnosticsBlob = blob
      return "blob:astra-subtitle-qc"
    })
    const revokeObjectURLMock = vi.fn()
    const NativeBlob = globalThis.Blob
    let lastDownloadBlobParts: BlobPart[] = []
    let clickedDownloadAnchor: HTMLAnchorElement | null = null
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clickedDownloadAnchor = this
    })
    Object.defineProperty(globalThis, "Blob", {
      configurable: true,
      value: class TestDownloadBlob extends NativeBlob {
        constructor(blobParts?: BlobPart[], options?: BlobPropertyBag) {
          lastDownloadBlobParts = [...(blobParts ?? [])]
          super(blobParts, options)
        }
      },
    })
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURLMock,
    })
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURLMock,
    })

    const baseState = createIdleState().state
    getActiveTabTranslationStateMock.mockResolvedValueOnce({
      ok: true,
      state: {
        ...baseState,
        subtitleQuality: {
          surface: "video",
          active: true,
          platform: "youtube",
          pipeline: "youtube-hybrid",
          source: "dom",
          status: "fallback-ready",
          anomalies: ["missing-track"],
          translatedNodeCount: 1,
          sourceTextLength: 24,
          pendingRequestCount: 1,
          cacheSize: 2,
          capturedAt: Date.now(),
        },
        diagnostics: {
          contentScope: "page",
          effectiveContentScope: "page",
        },
      },
    })

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="subtitle-qc-alert-latency"]')?.textContent).toContain("1 pending request")
    expect(container.querySelector('[data-testid="subtitle-qc-alert-fallback"]')?.textContent).toContain("missing-track")
    expect(container.querySelector('[data-testid="subtitle-qc-alert-latency"]')?.textContent).toContain("Remediation:")
    expect(container.querySelector('[data-testid="subtitle-qc-alert-latency"]')?.textContent).toContain("Check QC faster")
    expect(container.querySelector('[data-testid="subtitle-qc-alert-fallback"]')?.textContent).toContain("Widen fresh window")

    await act(async () => {
      ;(container.querySelector('[data-testid="subtitle-qc-action-fallback-export"]') as HTMLButtonElement).click()
      await Promise.resolve()
    })

    expect(createObjectURLMock).toHaveBeenCalledTimes(1)
    const blob = createdDiagnosticsBlob as Blob | null
    expect(blob?.type).toBe("application/json;charset=utf-8")
    const payload = JSON.parse(String(lastDownloadBlobParts[0] ?? ""))
    expect(payload).toEqual(expect.objectContaining({
      schema: "astra.subtitle-qc.local-diagnostics.v1",
      localOnly: true,
      subtitleQuality: expect.objectContaining({
        source: "dom",
        status: "fallback-ready",
        anomalies: ["missing-track"],
      }),
      subtitleQualityControls: expect.objectContaining({
        popupPollIntervalMs: 1500,
        freshnessThresholdMs: 5000,
      }),
      runtimeDiagnostics: expect.objectContaining({
        contentScope: "page",
        effectiveContentScope: "page",
      }),
    }))
    expect(payload.popup).toEqual(expect.objectContaining({
      phase: "idle",
      hostname: "example.com",
      siteEnabled: true,
      contentAvailable: true,
    }))
    expect((clickedDownloadAnchor as HTMLAnchorElement | null)?.download).toMatch(/^astra-subtitle-qc-diagnostics-.*\.json$/)
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:astra-subtitle-qc")
    expect(container.textContent).toContain("Diagnostics JSON exported locally.")

    const saveCallsBeforeRemediation = saveConfigInBackgroundMock.mock.calls.length
    await act(async () => {
      ;(container.querySelector('[data-testid="subtitle-qc-action-fallback-control"]') as HTMLButtonElement).click()
      await Promise.resolve()
    })
    expect(saveConfigInBackgroundMock).toHaveBeenCalledTimes(saveCallsBeforeRemediation + 1)
    expect(saveConfigInBackgroundMock).toHaveBeenLastCalledWith({
      subtitleQualityControls: {
        freshnessThresholdMs: 10000,
        adaptivePresetManualOverrideLocked: true,
      },
    })
  })

  it("integrates site-rules explainability near current-site settings", async () => {
    readConfigMock.mockResolvedValue(createConfig({
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: true,
          selectors: [".article-body", "article["],
          excludeSelectors: [".ad"],
          paragraphMinLength: 30,
        },
      },
    }))
    getActiveTabTranslationStateMock.mockResolvedValue({
      ok: true,
      state: {
        ...createIdleState().state,
        phase: "running",
        site: {
          hostname: "example.com",
          enabled: true,
          alwaysTranslate: true,
        },
        diagnostics: {
          contentScope: "page",
          effectiveContentScope: "page",
          siteRules: {
            inputBlockCount: 3,
            afterIncludeCount: 0,
            afterExcludeCount: 0,
            afterParagraphCount: 0,
            filterStages: [
              { id: "collected-blocks", count: 3 },
              { id: "after-include-filters", count: 0 },
              { id: "after-exclude-filters", count: 0 },
              { id: "after-paragraph-filter", count: 0 },
            ],
            selectors: {
              configured: [".article-body", "article["],
              valid: [".article-body"],
              invalid: ["article["],
              matchedBlocks: 0,
            },
            excludeSelectors: {
              configured: [".ad"],
              valid: [".ad"],
              invalid: [],
              matchedBlocks: 0,
            },
            paragraphMinLength: 30,
          },
        },
      },
    })

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const panel = container.querySelector('[data-testid="site-rules-explainability-panel"]')
    const panelText = panel?.textContent ?? ""
    expect(panelText).toContain("Why this page?")
    expect(panelText).toContain("Saved site rule for example.com")
    expect(panelText).toContain("Include selectors invalid")
    expect(panelText).toContain("Runtime diagnostics")
    expect(panelText).toContain("available")
    expect(panelText).toContain("filters matched no translatable blocks")
    expect(panelText).toContain("Clear include selectors")
    const runtimeOrder = [
      "Runtime diagnostics",
      "Collected blocks",
      "After include filters",
      "After exclude filters",
      "After paragraph filter",
      "Scope",
    ].map((label) => panelText.indexOf(label))
    expect(runtimeOrder.every((index) => index >= 0)).toBe(true)
    expect(runtimeOrder).toEqual([...runtimeOrder].sort((a, b) => a - b))
    expect(panel?.parentElement?.textContent).toContain(t("popup_currentSite"))
  })

  it("clears include selectors from the explainability quick fix through the site-rule save path", async () => {
    readConfigMock.mockResolvedValue(createConfig({
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: true,
          selectors: ["article["],
          excludeSelectors: [".ad"],
          paragraphMinLength: 30,
        },
      },
    }))
    getActiveTabTranslationStateMock.mockResolvedValue({
      ok: true,
      state: {
        ...createIdleState().state,
        phase: "running",
        site: {
          hostname: "example.com",
          enabled: true,
          alwaysTranslate: true,
        },
        diagnostics: {
          contentScope: "page",
          effectiveContentScope: "page",
          siteRules: {
            inputBlockCount: 3,
            afterIncludeCount: 0,
            afterExcludeCount: 0,
            afterParagraphCount: 0,
            selectors: {
              configured: ["article["],
              valid: [],
              invalid: ["article["],
              matchedBlocks: 0,
            },
            excludeSelectors: {
              configured: [".ad"],
              valid: [".ad"],
              invalid: [],
              matchedBlocks: 0,
            },
            paragraphMinLength: 30,
          },
        },
      },
    })

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    saveConfigInBackgroundMock.mockClear()
    const quickFixButton = container.querySelector('[data-testid="site-rules-quick-fix-clear-include-selectors"]') as HTMLButtonElement
    expect(quickFixButton?.textContent).toBe("Clear include selectors")

    await act(async () => {
      quickFixButton.click()
      await vi.runAllTimersAsync()
    })
    await flushApp()

    expect(saveConfigInBackgroundMock).toHaveBeenCalledTimes(1)
    const calls = saveConfigInBackgroundMock.mock.calls
    const savedConfig = calls[calls.length - 1][0] as Partial<AstraConfig>
    expect(savedConfig.sites?.["example.com"]?.selectors).toBeUndefined()
    expect(savedConfig.sites?.["example.com"]?.excludeSelectors).toEqual([".ad"])
  })

  it("clears exclude selectors from the explainability quick fix through the site-rule save path", async () => {
    readConfigMock.mockResolvedValue(createConfig({
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: true,
          selectors: [".article-body"],
          excludeSelectors: ["aside["],
          paragraphMinLength: 30,
        },
      },
    }))
    getActiveTabTranslationStateMock.mockResolvedValue({
      ok: true,
      state: {
        ...createIdleState().state,
        phase: "running",
        site: {
          hostname: "example.com",
          enabled: true,
          alwaysTranslate: true,
        },
        diagnostics: {
          contentScope: "page",
          effectiveContentScope: "page",
          siteRules: {
            inputBlockCount: 3,
            afterIncludeCount: 2,
            afterExcludeCount: 2,
            afterParagraphCount: 2,
            selectors: {
              configured: [".article-body"],
              valid: [".article-body"],
              invalid: [],
              matchedBlocks: 2,
            },
            excludeSelectors: {
              configured: ["aside["],
              valid: [],
              invalid: ["aside["],
              matchedBlocks: 0,
            },
            paragraphMinLength: 30,
          },
        },
      },
    })

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    saveConfigInBackgroundMock.mockClear()
    const quickFixButton = container.querySelector('[data-testid="site-rules-quick-fix-clear-exclude-selectors"]') as HTMLButtonElement
    expect(quickFixButton?.textContent).toBe("Clear exclude selectors")

    await act(async () => {
      quickFixButton.click()
      await vi.runAllTimersAsync()
    })
    await flushApp()

    expect(saveConfigInBackgroundMock).toHaveBeenCalledTimes(1)
    const calls = saveConfigInBackgroundMock.mock.calls
    const savedConfig = calls[calls.length - 1][0] as Partial<AstraConfig>
    expect(savedConfig.sites?.["example.com"]?.selectors).toEqual([".article-body"])
    expect(savedConfig.sites?.["example.com"]?.excludeSelectors).toBeUndefined()
  })

  it("shows connection status and plan label", async () => {
    await flushApp()

    expect(container.textContent).toContain(t("popup_connected"))
    expect(container.textContent).toContain("Pro plan")
    const continuityCard = container.querySelector('[data-testid="learning-continuity-commit-card"]')
    expect(continuityCard?.textContent).toContain("Learning continuity commit")
    expect(continuityCard?.textContent).toContain("synced")
    expect(continuityCard?.textContent).toContain("Review schedule sync enabled")
    const accountContinuityCard = container.querySelector('[data-testid="popup-account-continuity-card"]') as HTMLElement
    expect(accountContinuityCard).toBeTruthy()
    expect(accountContinuityCard.textContent).toContain("Continuity is connected for this account")
    expect(accountContinuityCard.textContent).toContain("Connected proof")
    expect(accountContinuityCard.textContent).toContain("no sign-in action is needed")
    expect(accountContinuityCard.textContent).toContain("daily study stats stay local-only")
    expect(container.querySelector('[data-testid="popup-account-continuity-sign-in-cta"]')).toBeNull()
    expect(container.querySelector('[data-testid="study-account-continuity-nudge"]')?.textContent).toContain("Continuity is connected for this account")
    expect(container.querySelector('[data-testid="study-account-continuity-nudge"]')?.textContent).toContain("daily study stats stay local-only")
    expect(container.querySelector('[data-testid="study-account-continuity-sign-in-cta"]')).toBeNull()
    expect(container.textContent).toContain("Astra continuity · 1 device · 1 active")
    expect(container.textContent).toContain("Config bootstrap: enabled · Cursor cfg-3")
    expect(container.textContent).toContain("Reading history sync: off · Optional")
    expect(container.textContent).toContain("Study progress sync: off · Optional · Daily stats stay local")
    expect(container.textContent).toContain("Learning continuity commit: synced")
    expect(container.textContent).toContain("Config, vocabulary, review schedules, reading history, and study progress continuity ready · Daily study stats stay local")
    expect(container.textContent).toContain("Plan and daily quota mirror Astra account summary.")
  })

  const continuityCardStateCases: Array<[string, LearningContinuitySyncStatus, string, boolean]> = [
    ["syncing", createLearningContinuitySyncStatus({ inFlight: true, stateLastSuccessAt: null }), "Syncing…", true],
    ["queued", createLearningContinuitySyncStatus({ queued: true, stateLastSuccessAt: null }), "Sync now", true],
    ["error-retry", createLearningContinuitySyncStatus({ lastError: "Relay unavailable", stateLastError: "Relay unavailable", stateLastSuccessAt: null }), "Retry sync", false],
    ["synced", createLearningContinuitySyncStatus({ stateLastSuccessAt: "2026-04-09T01:10:00.000Z" }), "Sync now", false],
    ["ready-to-sync", createLearningContinuitySyncStatus({ stateLastSuccessAt: null, lastFinishedAt: null, stateLastRunAt: null }), "Sync now", false],
  ]

  it.each(continuityCardStateCases)("shows continuity card state %s", async (expectedState, status, expectedButtonLabel, expectDisabled) => {
    await refreshPopupWithContinuityStatus(status)

    const state = container.querySelector('[data-testid="learning-continuity-commit-state"]')
    const action = container.querySelector('[data-testid="learning-continuity-sync-now"]') as HTMLButtonElement | null

    expect(state?.textContent).toContain(expectedState)
    expect(action?.textContent).toContain(expectedButtonLabel)
    expect(action?.disabled).toBe(expectDisabled)
  })

  it("runs manual continuity sync from the popup card and updates state", async () => {
    await refreshPopupWithContinuityStatus(createLearningContinuitySyncStatus({
      lastError: "Relay unavailable",
      stateLastError: "Relay unavailable",
      stateLastSuccessAt: null,
    }))
    const nextStatus = createLearningContinuitySyncStatus({
      lastError: null,
      stateLastError: null,
      stateLastSuccessAt: "2026-04-09T01:12:00.000Z",
    })
    commitLearningContinuitySyncMock.mockResolvedValueOnce({ ok: true, status: nextStatus })

    const action = container.querySelector('[data-testid="learning-continuity-sync-now"]') as HTMLButtonElement
    await act(async () => {
      action.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(commitLearningContinuitySyncMock).toHaveBeenCalledWith("popup-continuity-card")
    expect(container.querySelector('[data-testid="learning-continuity-commit-state"]')?.textContent).toContain("synced")
  })

  it("shows quota bar with usage info", async () => {
    await flushApp()

    expect(container.textContent).toContain("50%")
    expect(container.textContent).toContain("100k / 200k tokens")
  })

  it("surfaces unauthenticated continuity copy and opens the existing sign-in panel from the CTA", async () => {
    readAstraSessionMock.mockResolvedValue(null)

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    await flushApp()

    const conversionCard = container.querySelector('[data-testid="popup-account-continuity-card"]') as HTMLElement
    expect(conversionCard).toBeTruthy()
    const primer = container.querySelector('[data-testid="learning-closure-primer-card"]') as HTMLElement
    expect(conversionCard.compareDocumentPosition(primer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(conversionCard.textContent).toContain("Account continuity")
    expect(conversionCard.textContent).toContain("Keep your learning trail when you switch devices")
    expect(conversionCard.textContent).toContain("saved learning cards, reading queue, and study progress")
    expect(conversionCard.textContent).toContain("Proof from this popup session")
    expect(conversionCard.textContent).toContain("Same CTA: use the existing popup sign-in panel")
    expect(conversionCard.textContent).toContain("No billing change")
    expect(conversionCard.textContent).toContain("existing Astra sign-in panel")
    const studyContinuityNudge = container.querySelector('[data-testid="study-account-continuity-nudge"]') as HTMLElement
    expect(studyContinuityNudge?.textContent).toContain("Keep your learning trail")
    expect(studyContinuityNudge?.textContent).toContain("Proof on this page is already forming")
    expect(studyContinuityNudge?.textContent).toContain("existing Astra sign-in panel")
    expect(container.querySelector('[data-testid="popup-account-continuity-proof-moment"]')?.textContent).toContain("Proof")
    expect(container.querySelector('[data-testid="study-account-continuity-proof-moment"]')?.textContent).toContain("Same CTA")
    expect(container.querySelector('[data-testid="study-account-continuity-sign-in-cta"]')?.textContent).toContain("Sign in to keep continuity")

    const signInPanel = container.querySelector('[data-testid="popup-sign-in-panel"]') as HTMLDetailsElement
    expect(signInPanel.open).toBe(false)

    await act(async () => {
      ;(container.querySelector('[data-testid="popup-account-continuity-sign-in-cta"]') as HTMLButtonElement).click()
      await Promise.resolve()
    })

    expect(signInPanel.open).toBe(true)
    expect(createAstraSessionMock).not.toHaveBeenCalled()
  })

  it("opens and focuses the existing sign-in panel from popup ?focus=sign-in", async () => {
    await act(async () => {
      root.unmount()
      rootUnmounted = true
      await Promise.resolve()
    })
    rootUnmounted = true
    window.history.replaceState({}, "", "/popup.html?focus=sign-in")
    readAstraSessionMock.mockResolvedValue(null)
    root = ReactDOM.createRoot(container)
    rootUnmounted = false

    await act(async () => {
      root.render(<App />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    await flushApp()

    const signInPanel = container.querySelector('[data-testid="popup-sign-in-panel"]') as HTMLDetailsElement
    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement
    expect(signInPanel.open).toBe(true)

    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })

    expect(document.activeElement).toBe(emailInput)
    expect(createAstraSessionMock).not.toHaveBeenCalled()
  })

  it("creates and stores an Astra session from the popup login flow", async () => {
    readConfigMock.mockResolvedValue(createConfig({
      provider: {
        ...DEFAULT_ASTRA_CONFIG.provider,
        relayBaseURL: "https://astra.example/v1",
      },
    }))
    readAstraSessionMock.mockResolvedValue(null)

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await vi.runAllTimersAsync()
    })
    await flushApp()

    // Expand the sign-in section
    const signInSummary = container.querySelector("summary")
    if (signInSummary?.textContent?.includes(t("popup_signInToAstra"))) {
      await act(async () => {
        signInSummary.click()
        await Promise.resolve()
      })
    }

    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement
    const passwordInputs = Array.from(container.querySelectorAll('input[type="password"]')) as HTMLInputElement[]
    const authPasswordInput = passwordInputs[0]
    const signInButton = getButtons().find((button) => button.textContent === t("popup_signIn"))!
    const inputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set

    await act(async () => {
      inputValueSetter?.call(emailInput, "user@example.com")
      emailInput.dispatchEvent(new Event("input", { bubbles: true }))
      emailInput.dispatchEvent(new Event("change", { bubbles: true }))
      inputValueSetter?.call(authPasswordInput, "secret-pass")
      authPasswordInput.dispatchEvent(new Event("input", { bubbles: true }))
      authPasswordInput.dispatchEvent(new Event("change", { bubbles: true }))
      await Promise.resolve()
    })

    await act(async () => {
      signInButton.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(createAstraSessionMock).toHaveBeenCalledWith({
      baseURL: "https://astra.example/v1",
      email: "user@example.com",
      password: "secret-pass",
    })
    expect(fetchAstraAccountSummaryMock).toHaveBeenCalled()
    expect(saveAstraSessionMock).toHaveBeenCalled()
  })

  it("shows sign out button when logged in and signs out", async () => {
    await flushApp()

    const signOutButton = getButtons().find((button) => button.textContent === t("popup_signOut"))!
    expect(signOutButton).toBeDefined()

    await act(async () => {
      signOutButton.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(revokeAstraSessionMock).toHaveBeenCalledWith({
      baseURL: "https://astra.example/v1",
      sessionToken: "astra-session",
    })
    expect(clearAstraSessionMock).toHaveBeenCalled()
  })

  it("renders the study hub with current-page summary and review count", async () => {
    getReadingHistoryMock.mockResolvedValue([
      {
        id: "history-1",
        url: "https://example.com/article",
        hostname: "example.com",
        title: "Example article",
        wordsTranslated: 120,
        visitedAt: 1000,
      },
    ])

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await Promise.resolve()
      await Promise.resolve()
    })
    await flushApp()

    expect(container.textContent).toContain("学习中心")
    expect(container.textContent).toContain("A concise summary of the current article for study mode.")
    expect(container.textContent).toContain("待复习 3 个")
    expect(container.textContent).toContain("120 词")
    expect(container.textContent).toContain("阅读文章")
  })

  it("renders the weekly ROI summary from local study and vocabulary activity", async () => {
    const now = new Date("2026-04-09T12:00:00.000Z").getTime()
    vi.setSystemTime(now)
    getStudyProgressMock.mockResolvedValue({
      pages: [{
        url: "https://example.com/article",
        hostname: "example.com",
        title: "Example article",
        completedSteps: ["read", "guided_read", "explain", "vocab_save", "vocab_review"],
        sentencesExplained: 5,
        vocabSaved: 3,
        vocabReviewed: 2,
        startedAt: now - 90 * 60_000,
        lastActivityAt: now,
      }],
      dailyStats: { date: "2026-04-09", pagesStudied: 1, sentencesExplained: 5, vocabSaved: 3, vocabReviewed: 2 },
    })
    getVocabularyEntriesMock.mockResolvedValue([
      {
        id: "roi-mastered",
        text: "retained",
        url: "https://example.com/article",
        hostname: "example.com",
        savedAt: now - 2 * 24 * 60 * 60_000,
        srsBox: 4,
        nextReviewAt: now + 2 * 24 * 60 * 60_000,
        reviewCount: 3,
        lastReviewedAt: now - 60_000,
      },
      {
        id: "roi-review-miss",
        text: "retry",
        url: "https://example.com/article",
        hostname: "example.com",
        savedAt: now - 3 * 24 * 60 * 60_000,
        srsBox: 1,
        nextReviewAt: now + 24 * 60 * 60_000,
        reviewCount: 1,
        lastReviewedAt: now - 2 * 60_000,
      },
    ])

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    await flushApp()

    const card = container.querySelector('[data-testid="weekly-roi-summary-card"]') as HTMLElement
    expect(card).toBeTruthy()
    expect(card.textContent).toContain("Weekly ROI")
    expect(card.textContent).toContain("7-day learning return")
    expect(card.textContent).toContain("45 min")
    expect(card.textContent).toContain("50%")
    expect(card.textContent).toContain("1 active page")
    expect(card.textContent).toContain("1 loop closed")
    expect(card.textContent).toContain("2 saved")
    expect(card.textContent).toContain("2 reviewed")
  })

  it("shows the same current-page progress counters and next-step hint in the popup", async () => {
    deriveStudyLoopViewModelMock.mockReturnValue({
      currentPage: {
        url: "https://example.com/article",
        hostname: "example.com",
        title: "Example article",
        completedSteps: ["read", "guided_read", "explain", "vocab_save"],
        sentencesExplained: 2,
        vocabSaved: 1,
        vocabReviewed: 0,
        startedAt: 1000,
        lastActivityAt: 2000,
      },
      completedSteps: ["read", "guided_read", "explain", "vocab_save"],
      currentCounts: { sentencesExplained: 2, vocabSaved: 1, vocabReviewed: 0 },
      nextStep: "vocab_review",
      completionPercent: 80,
      dailyStats: { date: "2026-04-03", pagesStudied: 1, sentencesExplained: 2, vocabSaved: 1, vocabReviewed: 0 },
      recentPages: [],
      personalizedStrategy: {
        id: "review_saved_context",
        label: "Review this page’s saved context",
        hint: "Finish the loop by reviewing at least one saved card from this page while the source context is still fresh.",
        focusStep: "vocab_review",
        trigger: "saved_more_than_reviewed",
        progressSignature: "read>guided_read>explain>vocab_save|next:vocab_review|e:2|s:1|r:0|pct:80",
        evidence: "1 saved · 0 reviewed",
      },
    })

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await Promise.resolve()
      await Promise.resolve()
    })
    await flushApp()

    expect(container.textContent).toContain("当前页面进度")
    expect(container.textContent).toContain("讲解 2 句")
    expect(container.textContent).toContain("保存 1 词")
    expect(container.textContent).toContain("复习 0 词")
    expect(container.textContent).toContain("下一步： 复习")
    expect(container.textContent).toContain("复习这篇页面里至少一张已保存卡片，闭合本页的学习回路。")
    expect(container.querySelector('[data-testid="study-personalized-strategy-card"]')?.textContent).toContain("Review this page’s saved context")
    expect(container.textContent).toContain("Finish the loop by reviewing at least one saved card from this page while the source context is still fresh.")

    expect(await getLearningLoopTelemetryEvents()).toContainEqual(expect.objectContaining({
      data: expect.objectContaining({
        event: "popup_primer_viewed",
        psarEligible: true,
        personalizedStrategyApplied: true,
        personalizedStrategyId: "review_saved_context",
        personalizedStrategyTrigger: "saved_more_than_reviewed",
        personalizedStrategyFocusStep: "vocab_review",
      }),
    }))
  })

  it("opens the standalone deep-read page from the study hub", async () => {
    await flushApp()

    const readArticleButton = getButtons().find((button) => button.textContent === "阅读文章")
    expect(readArticleButton).toBeDefined()

    await act(async () => {
      readArticleButton?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(browserMock.tabs.create).toHaveBeenCalledWith({
      url: "/deep-read.html",
    })
  })

  it("opens the reading queue from the study hub", async () => {
    await flushApp()

    const readingQueueButton = container.querySelector('[data-testid="study-open-reading-queue"]') as HTMLButtonElement
    expect(readingQueueButton).toBeTruthy()
    expect(readingQueueButton.textContent).toBe(t("vocabulary_actionOpenReadingQueue"))

    browserMock.tabs.create.mockClear()
    await act(async () => {
      readingQueueButton.click()
      await Promise.resolve()
    })

    expect(browserMock.tabs.create).toHaveBeenCalledWith({
      url: "/vocabulary.html?tab=reading",
    })
  })

  it("saves the current page as a content asset from the popup study hub", async () => {
    await flushApp()

    const card = container.querySelector('[data-testid="study-content-assetization-card"]') as HTMLElement
    const saveButton = container.querySelector('[data-testid="study-save-page-asset"]') as HTMLButtonElement
    expect(card).toBeTruthy()
    expect(card.textContent).toContain("内容资产")
    expect(card.textContent).toContain("把当前页面保存到阅读队列")
    expect(saveButton.disabled).toBe(false)

    commitLearningContinuitySyncMock.mockClear()
    await act(async () => {
      saveButton.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const ownedReadingStore = browserMock.__storage[OWNED_READING_STORAGE_KEY]
    expect(ownedReadingStore).toEqual(expect.objectContaining({ version: 1 }))
    expect(ownedReadingStore.items).toContainEqual(expect.objectContaining({
      sourceType: "article",
      title: "Example article",
      sourceUrl: "https://example.com/article",
      status: "saved",
      readingHistoryRecordId: "https://example.com/article",
      studyProgressRecordId: "https://example.com/article",
    }))
    expect(container.querySelector('[data-testid="study-content-assetization-message"]')?.textContent).toContain("已保存到阅读队列。")
    expect((container.querySelector('[data-testid="study-save-page-asset"]') as HTMLButtonElement).disabled).toBe(true)
    expect(commitLearningContinuitySyncMock).toHaveBeenCalledWith("popup-content-assetization")
  })

  it("shows usage and routing feedback in the popup", async () => {
    await flushApp()

    expect(container.textContent).toContain("用量与路由")
    // Grid layout renders i18n-ized metrics
    expect(container.textContent).toContain("4")
    expect(container.textContent).toContain("请求数")
    expect(container.textContent).toContain("24")
    expect(container.textContent).toContain("openai / gpt-5.4-nano")
    expect(container.textContent).toContain("direct → relay")
    expect(container.textContent).toContain("这里只显示当前设备上的翻译活动；它不会改变你的 Astra 账户配额，命中缓存的内容也不会出现在这里。")
  })

  it("opens the Image/OCR Translation Beta page from diagnostics", async () => {
    await flushApp()

    const betaButton = getButtons().find((button) => button.textContent === "Open Image/OCR Translation Beta")
    expect(betaButton).toBeDefined()
    expect(container.textContent).toContain("Overlay preview is approximate; compare rows remain available.")

    browserMock.tabs.create.mockClear()
    await act(async () => {
      betaButton?.click()
      await Promise.resolve()
    })

    expect(browserMock.tabs.create).toHaveBeenCalledWith({
      url: "/image-translate.html",
    })
  })

  it("opens the Document Intake Hub page from diagnostics", async () => {
    await flushApp()

    const intakeButton = getButtons().find((button) => button.textContent === "Open Document Intake Hub")
    expect(intakeButton).toBeDefined()
    expect(container.textContent).toContain("Route PDF, EPUB, SRT, or VTT files to existing readers")
    expect(container.textContent).toContain("short-lived local handoff can open the reader automatically")
    expect(container.textContent).toContain("File bytes stay local and are never synced")

    browserMock.tabs.create.mockClear()
    await act(async () => {
      intakeButton?.click()
      await Promise.resolve()
    })

    expect(browserMock.tabs.create).toHaveBeenCalledWith({
      url: "/document-intake.html",
    })
  })

  it("persists the popup explanation glossary editor", async () => {
    await flushApp()

    const glossaryInput = container.querySelector('[data-testid="popup-explanation-glossary-input"]') as HTMLTextAreaElement
    expect(glossaryInput).toBeTruthy()

    await setFormValue(glossaryInput, "Astra => 阿斯特拉\nrouter = 路由器")
    await flushApp()

    expect(saveConfigInBackgroundMock).toHaveBeenLastCalledWith(expect.objectContaining({
      explanationGlossary: [
        { sourceTerm: "Astra", preferredTerm: "阿斯特拉", enabled: true },
        { sourceTerm: "router", preferredTerm: "路由器", enabled: true },
      ],
    }))
  })

  it("persists global font scale from the popup", async () => {
    await flushApp()

    const globalFontInput = container.querySelector('[data-testid="popup-global-font-size-input"]') as HTMLInputElement
    expect(globalFontInput).toBeTruthy()

    await setFormValue(globalFontInput, "1.25")
    await flushApp()

    expect(saveConfigInBackgroundMock).toHaveBeenLastCalledWith(expect.objectContaining({
      presentation: expect.objectContaining({
        fontSize: 1.25,
      }),
    }))
  })

  it("persists site-level font scale override from the popup", async () => {
    await flushApp()

    const siteFontSizeInput = container.querySelector('[data-testid="site-font-size-input"]') as HTMLInputElement
    expect(siteFontSizeInput).toBeTruthy()

    await setFormValue(siteFontSizeInput, "1.35")
    await act(async () => {
      await vi.runAllTimersAsync()
    })
    await flushApp()

    expect(saveConfigInBackgroundMock).toHaveBeenLastCalledWith(expect.objectContaining({
      sites: expect.objectContaining({
        "example.com": expect.objectContaining({
          presentation: expect.objectContaining({
            fontSize: 1.35,
          }),
        }),
      }),
    }))
  })

  it("persists site advanced rules from the popup", async () => {
    await flushApp()

    const selectorsInput = container.querySelector('[data-testid="site-selectors-input"]') as HTMLTextAreaElement
    const excludeSelectorsInput = container.querySelector('[data-testid="site-exclude-selectors-input"]') as HTMLTextAreaElement
    const paragraphMinLengthInput = container.querySelector('[data-testid="site-paragraph-min-length-input"]') as HTMLInputElement

    expect(selectorsInput).toBeTruthy()
    expect(excludeSelectorsInput).toBeTruthy()
    expect(paragraphMinLengthInput).toBeTruthy()

    await setFormValue(selectorsInput, "article\n.content")
    await setFormValue(excludeSelectorsInput, ".comments\naside")
    await setFormValue(paragraphMinLengthInput, "42")
    await act(async () => {
      await vi.runAllTimersAsync()
    })
    await flushApp()

    expect(saveConfigInBackgroundMock).toHaveBeenCalled()
    expect(saveConfigInBackgroundMock).toHaveBeenLastCalledWith(expect.objectContaining({
      sites: expect.objectContaining({
        "example.com": expect.objectContaining({
          selectors: ["article", ".content"],
          excludeSelectors: [".comments", "aside"],
          paragraphMinLength: 42,
        }),
      }),
    }))
  })

  it("persists site path-pattern rules from the popup", async () => {
    await flushApp()

    const includePatternsInput = container.querySelector('[data-testid="site-include-path-patterns-input"]') as HTMLTextAreaElement
    const excludePatternsInput = container.querySelector('[data-testid="site-exclude-path-patterns-input"]') as HTMLTextAreaElement

    expect(includePatternsInput).toBeTruthy()
    expect(excludePatternsInput).toBeTruthy()

    await setFormValue(includePatternsInput, "/docs/*\n/blog/*")
    await setFormValue(excludePatternsInput, "/docs/private/*")
    await act(async () => {
      await vi.runAllTimersAsync()
    })
    await flushApp()

    expect(saveConfigInBackgroundMock).toHaveBeenLastCalledWith(expect.objectContaining({
      sites: expect.objectContaining({
        "example.com": expect.objectContaining({
          includePathPatterns: ["/docs/*", "/blog/*"],
          excludePathPatterns: ["/docs/private/*"],
        }),
      }),
    }))
  })

  it("shows an inline error for invalid CSS selectors and does not persist them", async () => {
    await flushApp()

    const selectorsInput = container.querySelector('[data-testid="site-selectors-input"]') as HTMLTextAreaElement
    expect(selectorsInput).toBeTruthy()

    await setFormValue(selectorsInput, "article[")
    await act(async () => {
      await vi.runAllTimersAsync()
    })
    await flushApp()

    const error = container.querySelector('[data-testid="site-selectors-error"]')
    expect(error?.textContent).toContain("article[")
    expect(saveConfigInBackgroundMock).not.toHaveBeenCalled()
  })

  it("flushes pending site rule saves on pagehide before popup teardown", async () => {
    await flushApp()

    const selectorsInput = container.querySelector('[data-testid="site-selectors-input"]') as HTMLTextAreaElement
    expect(selectorsInput).toBeTruthy()

    await setFormValue(selectorsInput, "article\n.content")
    expect(saveConfigInBackgroundMock).not.toHaveBeenCalled()

    await act(async () => {
      window.dispatchEvent(new Event("pagehide"))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(saveConfigInBackgroundMock).toHaveBeenCalledTimes(1)
    expect(saveConfigInBackgroundMock).toHaveBeenCalledWith(expect.objectContaining({
      sites: expect.objectContaining({
        "example.com": expect.objectContaining({
          selectors: ["article", ".content"],
        }),
      }),
    }))
  })

  it("flushes pending site rule saves when the popup unmounts", async () => {
    await flushApp()

    const selectorsInput = container.querySelector('[data-testid="site-selectors-input"]') as HTMLTextAreaElement
    expect(selectorsInput).toBeTruthy()

    await setFormValue(selectorsInput, "article\n.content")
    expect(saveConfigInBackgroundMock).not.toHaveBeenCalled()

    await act(async () => {
      root.unmount()
      rootUnmounted = true
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(saveConfigInBackgroundMock).toHaveBeenCalledTimes(1)
    expect(saveConfigInBackgroundMock).toHaveBeenCalledWith(expect.objectContaining({
      sites: expect.objectContaining({
        "example.com": expect.objectContaining({
          selectors: ["article", ".content"],
        }),
      }),
    }))
  })

  it("renders enriched study digest content and offers a stale refresh action", async () => {
    const generateButton = getButtons().find((button) => button.textContent === t("popup_generateDigest"))
    expect(generateButton).toBeDefined()

    await act(async () => {
      generateButton?.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain("Test headline")
    expect(container.textContent).toContain(t("popup_digestVocabularyFocus"))
    expect(container.textContent).toContain("signal")
    expect(container.textContent).toContain(t("popup_digestGrammarFocus"))
    expect(container.textContent).toContain(t("popup_digestNextStep"))
    expect(container.textContent).toContain("Explain one sentence that uses the key term in context.")

    getPageDigestMock.mockResolvedValue({
      url: "https://example.com/article",
      hostname: "example.com",
      title: "Example article",
      targetLang: "zh-CN",
      languageLevel: "beginner",
      generatedAt: Date.now(),
      sourceFingerprint: "stale-fingerprint",
      headline: "Cached headline",
      summary: "Cached summary",
      keyPoints: ["Cached point"],
      vocabularyFocus: [{ term: "register", note: "Highlights tone in the article." }],
      grammarFocus: ["Watch the tense shift in the supporting example."],
      suggestedAction: "Re-run the digest after changing your level.",
    })
    isDigestStaleMock.mockReturnValue(true)

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain(t("popup_digestStale"))
    expect(container.textContent).toContain(t("popup_digestStaleHint"))

    const regenerateButton = getButtons().find((button) => button.textContent === t("popup_regenerateDigest"))
    expect(regenerateButton).toBeDefined()

    await act(async () => {
      regenerateButton?.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(generatePageDigestMock).toHaveBeenCalledTimes(2)
  })

  it("surfaces custom study actions in the popup and runs them against article context", async () => {
    readConfigMock.mockResolvedValue(createConfig({
      customActions: [{
        id: "deep-read",
        label: "Deep Read",
        labelZh: "深读",
        systemPrompt: "Explain this article in {{targetLang}} with focus on: {{text}}",
        enabled: true,
      }],
    }))

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const actionButton = getButtons().find((button) => button.textContent === "深读")
    expect(actionButton).toBeDefined()

    await act(async () => {
      actionButton?.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      targetLang: "zh-CN",
      task: "custom",
      texts: ["First article sentence. Second article sentence with more detail."],
      context: expect.objectContaining({
        pageTitle: "Example article",
        hostname: "example.com",
        articleExcerpt: "First article sentence. Second article sentence with more detail.",
      }),
    }))
    expect(container.textContent).toContain("Custom study action output")
  })

  it("shows the article excerpt and sentence drills in the study hub when provided", () => {
    expect(container.textContent).toContain(t("popup_studyArticleExcerpt"))
    expect(container.textContent).toContain("First article sentence. Second article sentence with more detail.")
    expect(container.textContent).toContain(t("popup_studySentenceDeck"))
    const studyOutcomeCopy = container.querySelector('[data-testid="study-outcome-copy"]')
    expect(studyOutcomeCopy?.textContent).toContain("saved review cards connected")
    expect(studyOutcomeCopy?.textContent).toContain("repeat practice")
    expect(studyOutcomeCopy?.textContent).toContain("Translate a page, open Deep Read, explain one sentence, save it")
    expect(studyOutcomeCopy?.textContent).toContain("same page context back")
    expect(studyOutcomeCopy?.textContent).not.toContain("Start free -> Build assets -> Keep continuity")
    expect(studyOutcomeCopy?.textContent).not.toContain("Build learning assets: save useful sentences")
    expect(studyOutcomeCopy?.textContent).not.toContain("Local beta boundary")
    expect(studyOutcomeCopy?.textContent).not.toContain("billing commitment")
  })

  it("opens deep read instead of starting guided article translation from the popup button", async () => {
    const readArticleButton = getButtons().find((button) => button.textContent === t("popup_readArticle"))
    expect(readArticleButton).toBeDefined()

    await act(async () => {
      readArticleButton?.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(browserMock.tabs.create).toHaveBeenCalledWith({
      url: "/deep-read.html",
    })
  })

  it("explains a sentence from the article excerpt inside the popup", async () => {
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["Sentence explanation output"],
    })
    getStudyProgressMock.mockResolvedValue({
      pages: [{
        url: "https://example.com/article",
        hostname: "example.com",
        title: "Example article",
        completedSteps: ["read", "guided_read", "explain"],
        sentencesExplained: 1,
        vocabSaved: 0,
        startedAt: 1000,
        lastActivityAt: 2000,
        vocabReviewed: 0,
      }],
      dailyStats: { date: "2026-04-03", pagesStudied: 1, sentencesExplained: 1, vocabSaved: 0, vocabReviewed: 0 },
    })

    const explainButtons = getButtons().filter((button) => button.textContent === t("popup_studyExplainSentence"))
    expect(explainButtons.length).toBeGreaterThan(0)

    await act(async () => {
      explainButtons[0].click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      task: "explain",
      targetLang: "zh-CN",
      texts: ["First article sentence."],
      context: expect.objectContaining({
        pageTitle: "Example article",
        articleExcerpt: "First article sentence. Second article sentence with more detail.",
        selectionContext: "First article sentence.",
      }),
    }))
    expect(recordStudyEventMock).toHaveBeenCalledWith(expect.objectContaining({
      url: "https://example.com/article",
      step: "explain",
    }))
    expect(container.textContent).toContain("Sentence explanation output")
  })

  it("reuses cached sentence explanations instead of re-requesting the same sentence", async () => {
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["Sentence explanation output"],
    })

    const explainButtons = getButtons().filter((button) => button.textContent === t("popup_studyExplainSentence"))
    expect(explainButtons.length).toBeGreaterThan(0)

    await act(async () => {
      explainButtons[0].click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      explainButtons[0].click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(translateTextsMock).toHaveBeenCalledTimes(1)
  })

  it("allows retrying sentence explain after a transient failure", async () => {
    translateTextsMock
      .mockResolvedValueOnce({
        ok: false,
        error: { message: "Temporary relay outage" },
      })
      .mockResolvedValueOnce({
        ok: true,
        translations: ["Recovered explanation output"],
      })

    const explainButtons = getButtons().filter((button) => button.textContent === t("popup_studyExplainSentence"))
    expect(explainButtons.length).toBeGreaterThan(0)

    await act(async () => {
      explainButtons[0].click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain("Warning: Temporary relay outage")

    const retryButtons = getButtons().filter((button) => button.textContent === t("popup_studyExplainSentence"))
    await act(async () => {
      retryButtons[0].click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(translateTextsMock).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain("Recovered explanation output")
    expect(recordStudyEventMock).toHaveBeenCalledWith(expect.objectContaining({
      url: "https://example.com/article",
      step: "explain",
    }))
  })

  it("rejects source-echo popup sentence explanations before study credit or persistence", async () => {
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["First article sentence."],
    })
    recordStudyEventMock.mockClear()

    const explainButtons = getButtons().filter((button) => button.textContent === t("popup_studyExplainSentence"))
    expect(explainButtons.length).toBeGreaterThan(0)

    await act(async () => {
      explainButtons[0].click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain("Warning: Explanation output echoed the source text. Please retry.")
    expect(recordStudyEventMock).not.toHaveBeenCalledWith(expect.objectContaining({
      step: "explain",
    }))

    saveVocabularyEntryMock.mockClear()
    const firstSentenceCard = container.querySelector('[data-testid="study-sentence-card-0"]') as HTMLDivElement
    const saveButton = Array.from(firstSentenceCard.querySelectorAll("button")).find((button) => button.textContent === t("actionSave"))

    await act(async () => {
      saveButton?.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const [savedEntry] = saveVocabularyEntryMock.mock.calls.at(-1) ?? []
    expect(savedEntry).toBeDefined()
    expect(savedEntry.explanation).toBeUndefined()
  })

  it("supports sentence navigation and single-sentence speech from the popup", async () => {
    const nextButton = container.querySelector('[data-testid="study-sentence-next"]') as HTMLButtonElement
    const speakButton = container.querySelector('[data-testid="study-sentence-speak"]') as HTMLButtonElement
    const prevButton = container.querySelector('[data-testid="study-sentence-prev"]') as HTMLButtonElement

    expect(prevButton.disabled).toBe(true)
    expect(nextButton.disabled).toBe(false)

    await act(async () => {
      nextButton.click()
      await Promise.resolve()
    })

    await act(async () => {
      speakButton.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(speakMock).toHaveBeenCalledWith("Second article sentence with more detail.", expect.objectContaining({
      lang: "zh-CN",
    }))
    expect(prevButton.disabled).toBe(false)
  })

  it("locks sentence navigation and speech while an explain request is in flight", async () => {
    let resolveExplain: ((value: { ok: true; translations: string[] }) => void) | null = null
    translateTextsMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveExplain = resolve as (value: { ok: true; translations: string[] }) => void
    }))

    const explainButtons = getButtons().filter((button) => button.textContent === t("popup_studyExplainSentence"))
    const nextButton = container.querySelector('[data-testid="study-sentence-next"]') as HTMLButtonElement
    const speakButton = container.querySelector('[data-testid="study-sentence-speak"]') as HTMLButtonElement

    await act(async () => {
      explainButtons[0].click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(nextButton.disabled).toBe(true)
    expect(speakButton.disabled).toBe(true)

    await act(async () => {
      resolveExplain?.({ ok: true, translations: ["Resolved explanation output"] })
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(nextButton.disabled).toBe(false)
    expect(speakButton.disabled).toBe(false)
    expect(container.textContent).toContain("Resolved explanation output")
  })

  it("selects the saved sentence card before showing the saved CTA", async () => {
    const secondSentenceCard = container.querySelector('[data-testid="study-sentence-card-1"]') as HTMLDivElement
    const secondSentenceSaveButton = secondSentenceCard.querySelectorAll("button")[1] as HTMLButtonElement

    await act(async () => {
      secondSentenceSaveButton.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(saveVocabularyEntryMock).toHaveBeenCalledWith(expect.objectContaining({
      text: "Second article sentence with more detail.",
      sourceContext: expect.objectContaining({
        surface: "popup_deep_read",
        pageUrl: "https://example.com/article",
        hostname: "example.com",
        sentenceText: "Second article sentence with more detail.",
        sentenceIndex: 1,
      }),
    }))
    expect(container.querySelector('[data-testid="study-sentence-saved-cta-1"]')).toBeTruthy()
    expect(commitLearningContinuitySyncMock).toHaveBeenCalledWith("popup-save")
  })

  it("runs the popup deep-read chain from explain to save to review and speak", async () => {
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["Sentence explanation output"],
    })
    getStudyProgressMock.mockResolvedValue({
      pages: [{
        url: "https://example.com/article",
        hostname: "example.com",
        title: "Example article",
        completedSteps: ["read", "guided_read", "explain", "vocab_save"],
        sentencesExplained: 1,
        vocabSaved: 1,
        startedAt: 1000,
        lastActivityAt: 2000,
        vocabReviewed: 0,
      }],
      dailyStats: { date: "2026-04-03", pagesStudied: 1, sentencesExplained: 1, vocabSaved: 1, vocabReviewed: 0 },
    })
    getDueVocabularyCountMock.mockResolvedValueOnce(3).mockResolvedValueOnce(4)

    const languageSelect = container.querySelector('[data-testid="popup-language-level-select"]') as HTMLSelectElement
    const explainModeSelect = container.querySelector('[data-testid="popup-explain-mode-select"]') as HTMLSelectElement
    await act(async () => {
      languageSelect.value = "beginner"
      languageSelect.dispatchEvent(new Event("change", { bubbles: true }))
      explainModeSelect.value = "exam"
      explainModeSelect.dispatchEvent(new Event("change", { bubbles: true }))
      await Promise.resolve()
    })

    const explainButtons = getButtons().filter((button) => button.textContent === t("popup_studyExplainSentence"))
    await act(async () => {
      explainButtons[0].click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      task: "explain",
      languageLevel: "beginner",
      explainMode: "exam",
    }))
    expect(container.textContent).toContain("Explain profile: Exam · Beginner")

    const saveButtons = getButtons().filter((button) => button.textContent === t("actionSave"))
    expect(saveButtons.length).toBeGreaterThan(0)

    await act(async () => {
      saveButtons[0].click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(saveVocabularyEntryMock).toHaveBeenCalledWith(expect.objectContaining({
      text: "First article sentence.",
      explanation: "Sentence explanation output",
      hostname: "example.com",
      url: "https://example.com/article",
      sourceContext: expect.objectContaining({
        surface: "popup_deep_read",
        pageTitle: "Example article",
        pageUrl: "https://example.com/article",
        hostname: "example.com",
        sentenceText: "First article sentence.",
        sentenceIndex: 0,
        languageLevel: "beginner",
        explainMode: "exam",
      }),
    }))
    expect(recordStudyEventMock).toHaveBeenCalledWith(expect.objectContaining({
      url: "https://example.com/article",
      step: "vocab_save",
    }))
    expect(await getLearningLoopTelemetryEvents()).toContainEqual(expect.objectContaining({
      data: expect.objectContaining({
        event: "sentence_saved",
        source: "popup_deep_read",
        variant: "loop_first",
      }),
    }))
    expect(container.textContent).toContain(t("actionSaved"))

    const savedCta = container.querySelector('[data-testid="study-sentence-saved-cta-0"]')
    const reviewCta = container.querySelector('[data-testid="study-sentence-open-review-0"]') as HTMLButtonElement
    const speakButton = container.querySelector('[data-testid="study-sentence-speak"]') as HTMLButtonElement

    expect(savedCta).toBeTruthy()
    expect(reviewCta).toBeTruthy()

    await act(async () => {
      reviewCta.click()
      await Promise.resolve()
    })

    expect(browserMock.tabs.create).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringContaining("/vocabulary.html?tab=review"),
    }))
  })

  it("shows saved sentence state from existing vocabulary for the current article", async () => {
    getVocabularyEntriesMock.mockResolvedValue([{
      id: "saved-sentence-1",
      text: "First article sentence.",
      explanation: "Saved earlier",
      context: "First article sentence. Second article sentence with more detail.",
      url: "https://example.com/article",
      hostname: "example.com",
      savedAt: 1000,
      srsBox: 1,
      nextReviewAt: 1000,
      reviewCount: 0,
      lastReviewedAt: null,
      sourceContext: {
        surface: "popup_deep_read",
        pageTitle: "Example article",
        sentenceText: "First article sentence.",
        sentenceIndex: 0,
      },
    }])

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="study-sentence-saved-cta-0"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="study-page-saved-review-cta"]')).toBeTruthy()
    expect(container.textContent).toContain(t("popup_studyPageSavedReviewAction"))
    expect(container.textContent).toContain(t("actionSaved"))

    const pageReviewButton = container.querySelector('[data-testid="study-page-saved-review-button"]') as HTMLButtonElement
    await act(async () => {
      pageReviewButton.click()
      await Promise.resolve()
    })

    expect(browserMock.tabs.create).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringContaining("loop=page"),
    }))
    expect(browserMock.tabs.create).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringContaining("entryId=saved-sentence-1"),
    }))
  })

  it("routes the vocab review next-step action to current-page saved review when available", async () => {
    deriveStudyLoopViewModelMock.mockReturnValue({
      currentPage: {
        url: "https://example.com/article",
        hostname: "example.com",
        title: "Example article",
        completedSteps: ["read", "guided_read", "explain", "vocab_save"],
        sentencesExplained: 1,
        vocabSaved: 1,
        vocabReviewed: 0,
        startedAt: 1000,
        lastActivityAt: 2000,
      },
      completedSteps: ["read", "guided_read", "explain", "vocab_save"],
      currentCounts: { sentencesExplained: 1, vocabSaved: 1, vocabReviewed: 0 },
      nextStep: "vocab_review",
      completionPercent: 80,
      dailyStats: { date: "2026-04-03", pagesStudied: 1, sentencesExplained: 1, vocabSaved: 1, vocabReviewed: 0 },
      recentPages: [],
    })
    getVocabularyEntriesMock.mockResolvedValue([{
      id: "saved-sentence-next-step",
      text: "First article sentence.",
      explanation: "Saved earlier",
      context: "First article sentence. Second article sentence with more detail.",
      url: "https://example.com/article?utm=source",
      hostname: "example.com",
      savedAt: 1000,
      srsBox: 1,
      nextReviewAt: 1000,
      reviewCount: 0,
      lastReviewedAt: null,
      sourceContext: {
        surface: "popup_deep_read",
        pageUrl: "https://example.com/article?utm=source",
        studyProgressRecordId: "https://example.com/article",
        pageTitle: "Example article",
        sentenceText: "First article sentence.",
        sentenceIndex: 0,
      },
    }])

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const nextStepButton = container.querySelector('[data-testid="study-next-step-action"]') as HTMLButtonElement
    expect(nextStepButton).toBeTruthy()
    expect(nextStepButton.textContent).toBe(t("popup_studyPageSavedReviewAction"))

    browserMock.tabs.create.mockClear()
    await act(async () => {
      nextStepButton.click()
      await Promise.resolve()
    })

    expect(browserMock.tabs.create).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringContaining("loop=page"),
    }))
    expect(browserMock.tabs.create).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringContaining("studyUrl=https%3A%2F%2Fexample.com%2Farticle"),
    }))
    expect(browserMock.tabs.create).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringContaining("entryId=saved-sentence-next-step"),
    }))
  })

  it("builds the sentence deck from fallback summary text when no article excerpt is available", async () => {
    getActiveTabStudyContextMock.mockResolvedValue({
      ok: true,
      context: {
        pageTitle: "Summary-only page",
        pageUrl: "https://example.com/summary-only",
        hostname: "example.com",
        contentSummary: "Fallback summary sentence one. Fallback summary sentence two.",
        articleExcerpt: "",
      },
    })

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="study-sentence-deck-fallback"]')?.textContent).toContain(t("popup_studySentenceDeckFallback"))
    expect(container.textContent).toContain("Fallback summary sentence one.")
    expect(Array.from(container.querySelectorAll("div")).some((element) => element.textContent?.trim() === t("popup_studyArticleExcerpt"))).toBe(false)

    const explainButtons = getButtons().filter((button) => button.textContent === t("popup_studyExplainSentence"))
    await act(async () => {
      explainButtons[0].click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      task: "explain",
      texts: ["Fallback summary sentence one."],
      context: expect.objectContaining({
        pageTitle: "Summary-only page",
        selectionContext: "Fallback summary sentence one.",
      }),
    }))
  })

  it("shows the empty study fallback with no sentence deck when study context is blank", async () => {
    getActiveTabStudyContextMock.mockResolvedValue({
      ok: true,
      context: {
        pageTitle: "Blank page",
        pageUrl: "https://example.com/blank",
        hostname: "example.com",
        contentSummary: "   ",
        metaDescription: "",
        articleExcerpt: "",
      },
    })

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain(t("popup_studySummaryEmpty"))
    expect(container.textContent).not.toContain(t("popup_studySentenceDeck"))
    expect(container.querySelector('[data-testid="study-sentence-deck-fallback"]')).toBeFalsy()
    expect(container.querySelector('[data-testid="study-outcome-copy"]')).toBeFalsy()
    expect(getButtons().filter((button) => button.textContent === t("popup_studyExplainSentence"))).toHaveLength(0)
  })

  it("keeps duplicate sentence occurrences separate when only one popup sentence was saved", async () => {
    getActiveTabStudyContextMock.mockResolvedValue({
      ok: true,
      context: {
        pageTitle: "Example article",
        pageUrl: "https://example.com/article",
        hostname: "example.com",
        contentSummary: "A concise summary of the current article for study mode.",
        articleExcerpt: "Repeat me. Repeat me.",
      },
    })
    getVocabularyEntriesMock.mockResolvedValue([{
      id: "saved-sentence-duplicate-1",
      text: "Repeat me.",
      explanation: "Saved earlier",
      context: "Repeat me. Repeat me.",
      url: "https://example.com/article",
      hostname: "example.com",
      savedAt: 1000,
      srsBox: 1,
      nextReviewAt: 1000,
      reviewCount: 0,
      lastReviewedAt: null,
      sourceContext: {
        surface: "popup_deep_read",
        pageTitle: "Example article",
        sentenceText: "Repeat me.",
        sentenceIndex: 0,
      },
    }])

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="study-sentence-saved-cta-0"]')).toBeTruthy()

    const secondSentenceCard = container.querySelector('[data-testid="study-sentence-card-1"]') as HTMLDivElement
    expect(secondSentenceCard).toBeTruthy()

    await act(async () => {
      secondSentenceCard.click()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="study-sentence-saved-cta-1"]')).toBeFalsy()
  })

  it("shows the version footer", async () => {
    expect(container.textContent).toContain("Astra v0.1.0")
  })

  it("shows footer links for settings, vocabulary, and review", async () => {
    const settingsButton = getButtons().find((button) => button.textContent === t("popup_settings"))
    const vocabButton = getButtons().find((button) => button.textContent === t("popup_vocabulary"))
    const reviewButton = getButtons().find((button) => button.textContent === t("popup_review"))

    expect(settingsButton).toBeDefined()
    expect(vocabButton).toBeDefined()
    expect(reviewButton).toBeDefined()
  })

  it("opens review in the vocabulary page review tab", async () => {
    const reviewButtons = getButtons().filter((button) => button.textContent === t("popup_review") || button.textContent === `${t("popup_review")} (3)`)
    expect(reviewButtons.length).toBeGreaterThan(0)

    await act(async () => {
      reviewButtons[0].click()
      await Promise.resolve()
    })

    expect(browserMock.tabs.create).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringContaining("/vocabulary.html?tab=review"),
    }))
  })

  it("passes popup explanation glossary terms through sentence explain requests", async () => {
    await flushApp()

    const glossaryInput = container.querySelector('[data-testid="popup-explanation-glossary-input"]') as HTMLTextAreaElement
    await setFormValue(glossaryInput, "First article => 首篇文章")
    await flushApp()

    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["首篇文章 is the required term; the sentence introduces the first article sentence."],
    })

    const explainButtons = getButtons().filter((button) => button.textContent === t("popup_studyExplainSentence"))
    await act(async () => {
      explainButtons[0].click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      task: "explain",
      context: expect.objectContaining({
        explanationGlossary: "First article => 首篇文章",
      }),
    }))
    expect(container.textContent).toContain("首篇文章 is the required term")
    expect(container.querySelector('[data-testid="study-sentence-glossary-evidence-0"]')?.textContent).toBe("Glossary applied: First article → 首篇文章")

    saveVocabularyEntryMock.mockClear()
    const firstSentenceCard = container.querySelector('[data-testid="study-sentence-card-0"]') as HTMLDivElement
    const saveButton = Array.from(firstSentenceCard.querySelectorAll("button")).find((button) => button.textContent === t("actionSave"))

    await act(async () => {
      saveButton?.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(saveVocabularyEntryMock).toHaveBeenCalledWith(expect.objectContaining({
      sourceContext: expect.objectContaining({
        matchedGlossaryTerms: [{ sourceTerm: "First article", preferredTerm: "首篇文章" }],
      }),
    }))
  })

  it("retries popup sentence explanations that fail the glossary quality gate", async () => {
    await flushApp()

    const languageSelect = container.querySelector('[data-testid="popup-language-level-select"]') as HTMLSelectElement
    const explainModeSelect = container.querySelector('[data-testid="popup-explain-mode-select"]') as HTMLSelectElement
    await act(async () => {
      languageSelect.value = "beginner"
      languageSelect.dispatchEvent(new Event("change", { bubbles: true }))
      explainModeSelect.value = "exam"
      explainModeSelect.dispatchEvent(new Event("change", { bubbles: true }))
      await Promise.resolve()
    })

    const glossaryInput = container.querySelector('[data-testid="popup-explanation-glossary-input"]') as HTMLTextAreaElement
    await setFormValue(glossaryInput, "First article => 首篇文章")
    await flushApp()

    translateTextsMock
      .mockResolvedValueOnce({
        ok: true,
        translations: ["This explains that the sentence introduces the article."],
      })
      .mockResolvedValueOnce({
        ok: true,
        translations: ["首篇文章 is the required term; this explains that the sentence introduces the article."],
      })
    recordStudyEventMock.mockClear()

    const explainButtons = getButtons().filter((button) => button.textContent === t("popup_studyExplainSentence"))
    await act(async () => {
      explainButtons[0].click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(translateTextsMock).toHaveBeenCalledTimes(2)
    expect(translateTextsMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      task: "explain",
      languageLevel: "beginner",
      explainMode: "exam",
      context: expect.objectContaining({
        explanationGlossary: "First article => 首篇文章",
      }),
      explanationRepairInstruction: expect.stringContaining("include every matched preferred term exactly"),
    }))
    expect(container.textContent).toContain("首篇文章 is the required term")
    expect(recordStudyEventMock).toHaveBeenCalledWith(expect.objectContaining({
      step: "explain",
    }))
  })

  it("rejects popup sentence explanations missing required glossary terms after the recovery retry", async () => {
    await flushApp()

    const glossaryInput = container.querySelector('[data-testid="popup-explanation-glossary-input"]') as HTMLTextAreaElement
    await setFormValue(glossaryInput, "First article => 首篇文章")
    await flushApp()

    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["This explains that the sentence introduces the article."],
    })
    recordStudyEventMock.mockClear()

    const explainButtons = getButtons().filter((button) => button.textContent === t("popup_studyExplainSentence"))
    await act(async () => {
      explainButtons[0].click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(translateTextsMock).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain("Warning: Explanation output omitted required glossary term \"首篇文章\" for source term \"First article\". Please retry.")
    expect(recordStudyEventMock).not.toHaveBeenCalledWith(expect.objectContaining({
      step: "explain",
    }))
  })
})
