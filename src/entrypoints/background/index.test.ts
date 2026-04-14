import { beforeEach, describe, expect, it, vi } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"
import { STUDY_PROGRESS_STORAGE_KEY } from "@/utils/storage/study-progress"

const readConfigMock = vi.fn()
const saveConfigMock = vi.fn()
const ensureAstraDeviceIdentityMock = vi.fn()
const readAstraSessionMock = vi.fn()
const saveAstraSessionMock = vi.fn()
const translateWithProviderDetailedMock = vi.fn()
const executeTabCommandMock = vi.fn()
const getProviderRoutingMetadataFromErrorMock = vi.fn()
const runPhaseOneCollectionSyncMock = vi.fn()
const cleanExpiredCacheMock = vi.fn()
const getCachedTranslationsMock = vi.fn()
const setCachedTranslationMock = vi.fn()
const initializeTranslationUsageSessionMock = vi.fn()
const recordTranslationUsageMock = vi.fn()

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
  saveConfig: saveConfigMock,
}))

vi.mock("@/utils/storage/auth", () => ({
  ensureAstraDeviceIdentity: ensureAstraDeviceIdentityMock,
  readAstraSession: readAstraSessionMock,
  saveAstraSession: saveAstraSessionMock,
}))

vi.mock("@/utils/providers/router", () => ({
  translateWithProviderDetailed: translateWithProviderDetailedMock,
  getProviderRoutingMetadataFromError: getProviderRoutingMetadataFromErrorMock,
}))

vi.mock("@/utils/storage/config-sync", () => ({
  runPhaseOneCollectionSync: runPhaseOneCollectionSyncMock,
}))

vi.mock("@/utils/cache/translation-cache", () => ({
  cleanExpiredCache: cleanExpiredCacheMock,
  getCachedTranslations: getCachedTranslationsMock,
  setCachedTranslation: setCachedTranslationMock,
}))

vi.mock("@/utils/storage/translation-usage", () => ({
  initializeTranslationUsageSession: initializeTranslationUsageSessionMock,
  recordTranslationUsage: recordTranslationUsageMock,
}))

vi.mock("./frame-coordinator", () => ({
  executeTabCommand: executeTabCommandMock,
}))

function getMockBrowser(): ReturnType<typeof createMockBrowser> {
  return (globalThis as unknown as { __ASTRA_TEST_BROWSER__: ReturnType<typeof createMockBrowser> })
    .__ASTRA_TEST_BROWSER__
}

async function flushRuntimeResponse(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve()
  }
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe("background runtime translation routing", () => {
  beforeEach(() => {
    setMockBrowser(createMockBrowser())
    vi.resetModules()
    ensureAstraDeviceIdentityMock.mockReset()
    readConfigMock.mockReset()
    saveConfigMock.mockReset()
    readAstraSessionMock.mockReset()
    saveAstraSessionMock.mockReset()
    translateWithProviderDetailedMock.mockReset()
    executeTabCommandMock.mockReset()
    getProviderRoutingMetadataFromErrorMock.mockReset()
    runPhaseOneCollectionSyncMock.mockReset()
    cleanExpiredCacheMock.mockReset()
    getCachedTranslationsMock.mockReset()
    setCachedTranslationMock.mockReset()
    initializeTranslationUsageSessionMock.mockReset()
    recordTranslationUsageMock.mockReset()
    runPhaseOneCollectionSyncMock.mockResolvedValue({
      skipped: true,
      reason: "no-session",
      pushed: { config: 0, vocabulary: 0, reading_history: 0, study_progress: 0 },
      pulled: { config: 0, vocabulary: 0, reading_history: 0, study_progress: 0 },
      rejected: 0,
    })
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
    readAstraSessionMock.mockResolvedValue(null)
    saveAstraSessionMock.mockResolvedValue(undefined)
    getProviderRoutingMetadataFromErrorMock.mockReturnValue(null)
    cleanExpiredCacheMock.mockResolvedValue(0)
    getCachedTranslationsMock.mockResolvedValue(new Map())
    setCachedTranslationMock.mockResolvedValue(undefined)
    initializeTranslationUsageSessionMock.mockResolvedValue(undefined)
    recordTranslationUsageMock.mockResolvedValue(undefined)
  })

  it("schedules a phase-1 collection sync on startup", async () => {
    const background = (await import("./index")).default
    background.main()

    await Promise.resolve()

    expect(runPhaseOneCollectionSyncMock).toHaveBeenCalledTimes(1)
  })

  it("schedules a collection sync when study progress changes locally", async () => {
    const browser = getMockBrowser()
    const background = (await import("./index")).default
    background.main()

    runPhaseOneCollectionSyncMock.mockClear()

    await browser.__emitStorageChange({
      [STUDY_PROGRESS_STORAGE_KEY]: {
        oldValue: undefined,
        newValue: { pages: [], dailyStats: { date: "2026-04-09", pagesStudied: 0, sentencesExplained: 0, vocabSaved: 0, vocabReviewed: 0 } },
      },
    }, "local")

    await Promise.resolve()

    expect(runPhaseOneCollectionSyncMock).toHaveBeenCalledTimes(1)
  })

  it("returns a success response for translate batch requests", async () => {
    const browser = getMockBrowser()
    const sendResponse = vi.fn()

    readConfigMock.mockResolvedValue({
      connectionMode: "astra",
      languageLevel: "intermediate",
      provider: {
        id: "openai",
        accessToken: "",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
    })
    readAstraSessionMock.mockResolvedValue({
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
        dailyRequestsLimit: 0,
        dailyCharactersLimit: 0,
        requestsPerMinuteLimit: 0,
        remainingDailyRequests: 0,
        remainingDailyCharacters: 0,
      },
      usage: {
        totalRequests: 0,
        totalCharacters: 0,
        dailyRequestsUsed: 0,
        dailyCharactersUsed: 0,
        lastRequestAt: null,
        recentEvents: [],
      },
      issuedAt: null,
      expiresAt: null,
    })
    translateWithProviderDetailedMock.mockResolvedValue({
      translations: ["你好"],
      metadata: {
        attemptedTransports: ["direct"],
        finalTransport: "direct",
        fallbackUsed: false,
      },
    })

    const background = (await import("./index")).default
    background.main()

    await browser.__emitRuntimeMessage(
      {
        type: "runtime/translate-batch",
        payload: {
          texts: ["hello"],
          targetLang: "zh-CN",
          context: { pageTitle: "Fixture" },
          task: "translate",
        },
      },
      { id: "sender" },
      sendResponse,
    )

    await flushRuntimeResponse()

    expect(translateWithProviderDetailedMock).toHaveBeenCalledWith(
      {
        id: "openai",
        accessToken: "astra-session",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
      {
        texts: ["hello"],
        targetLang: "zh-CN",
        context: { pageTitle: "Fixture" },
        task: "translate",
        sourceLang: undefined,
        customSystemPrompt: undefined,
        placeholderFormat: undefined,
        languageLevel: "intermediate",
      },
    )
    const cacheLookupCall = getCachedTranslationsMock.mock.calls[0] as [
      Array<{
        text: string
        targetLang: string
        cacheContext?: {
          providerId?: string
          model?: string
          connectionMode?: string
          routingKey?: string
          languageLevel?: string
        }
      }>,
    ]
    expect(cacheLookupCall[0]).toHaveLength(1)
    expect(cacheLookupCall[0][0]).toMatchObject({
      text: "hello",
      targetLang: "zh-CN",
      cacheContext: {
        providerId: "openai",
        model: "gpt-5.4-nano",
        connectionMode: "astra",
        routingKey: "astra",
        languageLevel: "intermediate",
      },
    })
    expect(setCachedTranslationMock).toHaveBeenCalledWith(
      "hello",
      "zh-CN",
      "你好",
      expect.objectContaining({
        providerId: "openai",
        model: "gpt-5.4-nano",
      }),
    )
    expect(sendResponse).toHaveBeenCalledWith({
      type: "runtime/translate-batch:success",
      payload: {
        translations: ["你好"],
        metadata: {
          attemptedTransports: ["direct"],
          finalTransport: "direct",
          fallbackUsed: false,
        },
      },
    })
    expect(recordTranslationUsageMock).toHaveBeenCalledWith(expect.objectContaining({
      providerId: "openai",
      model: "gpt-5.4-nano",
      attemptedTransports: ["direct"],
      finalTransport: "direct",
      fallbackUsed: false,
      route: "direct",
      success: true,
    }))
  })

  it("records relay-only route reporting for the popup usage path", async () => {
    const browser = getMockBrowser()
    const sendResponse = vi.fn()

    readConfigMock.mockResolvedValue({
      connectionMode: "astra",
      languageLevel: "intermediate",
      provider: {
        id: "openai",
        accessToken: "astra-session",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
    })
    translateWithProviderDetailedMock.mockResolvedValue({
      translations: ["你好"],
      metadata: {
        attemptedTransports: ["relay"],
        finalTransport: "relay",
        fallbackUsed: false,
        route: "relay",
      },
    })

    const background = (await import("./index")).default
    background.main()

    await browser.__emitRuntimeMessage(
      {
        type: "runtime/translate-batch",
        payload: {
          texts: ["hello"],
          targetLang: "zh-CN",
        },
      },
      { id: "sender" },
      sendResponse,
    )

    await flushRuntimeResponse()

    expect(recordTranslationUsageMock).toHaveBeenCalledWith(expect.objectContaining({
      attemptedTransports: ["relay"],
      finalTransport: "relay",
      fallbackUsed: false,
      route: "relay",
      success: true,
    }))
  })

  it("records fallback route reporting when direct requests fall back to relay", async () => {
    const browser = getMockBrowser()
    const sendResponse = vi.fn()

    readConfigMock.mockResolvedValue({
      connectionMode: "astra",
      languageLevel: "intermediate",
      provider: {
        id: "openai",
        accessToken: "astra-session",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
    })
    translateWithProviderDetailedMock.mockResolvedValue({
      translations: ["你好"],
      metadata: {
        attemptedTransports: ["direct", "relay"],
        finalTransport: "relay",
        fallbackUsed: true,
        route: "fallback",
      },
    })

    const background = (await import("./index")).default
    background.main()

    await browser.__emitRuntimeMessage(
      {
        type: "runtime/translate-batch",
        payload: {
          texts: ["hello"],
          targetLang: "zh-CN",
        },
      },
      { id: "sender" },
      sendResponse,
    )

    await flushRuntimeResponse()

    expect(recordTranslationUsageMock).toHaveBeenCalledWith(expect.objectContaining({
      attemptedTransports: ["direct", "relay"],
      finalTransport: "relay",
      fallbackUsed: true,
      route: "fallback",
      success: true,
    }))
  })

  it("wires the canonical vocabulary-backed terminology glossary into request-time context", async () => {
    const { saveVocabularyEntry } = await import("@/utils/storage/vocabulary")
    await saveVocabularyEntry({
      text: "Astra",
      translation: "阿斯特拉",
      hostname: "example.com",
      glossaryEnabled: true,
      glossaryScope: "hostname",
    })
    await saveVocabularyEntry({
      text: "router",
      glossaryTargetText: "路由器",
      glossaryEnabled: true,
      glossaryScope: "global",
    })

    const browser = getMockBrowser()
    const sendResponse = vi.fn()

    readConfigMock.mockResolvedValue({
      connectionMode: "astra",
      languageLevel: "intermediate",
      privacyMode: false,
      provider: {
        id: "openai",
        accessToken: "",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
    })
    translateWithProviderDetailedMock.mockResolvedValue({
      translations: ["你好"],
      metadata: {
        attemptedTransports: ["direct"],
        finalTransport: "direct",
        fallbackUsed: false,
      },
    })

    const background = (await import("./index")).default
    background.main()

    await browser.__emitRuntimeMessage(
      {
        type: "runtime/translate-batch",
        payload: {
          texts: ["hello"],
          targetLang: "zh-CN",
          context: {
            hostname: "example.com",
            terminologyGlossary: "Caller = Wrong",
          },
          task: "translate",
        },
      },
      { id: "sender" },
      sendResponse,
    )

    await flushRuntimeResponse()

    expect(translateWithProviderDetailedMock).toHaveBeenCalledWith(
      {
        id: "openai",
        accessToken: "",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
      {
        texts: ["hello"],
        targetLang: "zh-CN",
        context: {
          hostname: "example.com",
          terminologyGlossary: "Astra => 阿斯特拉\nrouter => 路由器",
        },
        task: "translate",
        sourceLang: undefined,
        customSystemPrompt: undefined,
        placeholderFormat: undefined,
        languageLevel: "intermediate",
      },
    )
    const cacheLookupCall = getCachedTranslationsMock.mock.calls[0] as [Array<{
      cacheContext?: {
        requestContextKey?: string
      }
    }>,]
    expect(cacheLookupCall[0][0]?.cacheContext?.requestContextKey).toBe(JSON.stringify({
      pageTitle: "",
      pageUrl: "",
      hostname: "example.com",
      metaDescription: "",
      contentSummary: "",
      selectionContext: "",
      terminologyGlossary: "Astra => 阿斯特拉\nrouter => 路由器",
    }))
    expect(sendResponse).toHaveBeenCalledWith({
      type: "runtime/translate-batch:success",
      payload: {
        translations: ["你好"],
        metadata: {
          attemptedTransports: ["direct"],
          finalTransport: "direct",
          fallbackUsed: false,
        },
      },
    })
  })

  it("strips ad hoc caller glossary strings when no vocabulary-backed glossary applies", async () => {
    const browser = getMockBrowser()
    const sendResponse = vi.fn()

    readConfigMock.mockResolvedValue({
      connectionMode: "astra",
      languageLevel: "intermediate",
      privacyMode: false,
      provider: {
        id: "openai",
        accessToken: "",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
    })
    translateWithProviderDetailedMock.mockResolvedValue({
      translations: ["你好"],
      metadata: {
        attemptedTransports: ["direct"],
        finalTransport: "direct",
        fallbackUsed: false,
      },
    })

    const background = (await import("./index")).default
    background.main()

    await browser.__emitRuntimeMessage(
      {
        type: "runtime/translate-batch",
        payload: {
          texts: ["hello"],
          targetLang: "zh-CN",
          context: {
            pageTitle: "Fixture",
            terminologyGlossary: "Caller = Wrong",
          },
          task: "translate",
        },
      },
      { id: "sender" },
      sendResponse,
    )

    await flushRuntimeResponse()

    expect(translateWithProviderDetailedMock).toHaveBeenCalledWith(
      {
        id: "openai",
        accessToken: "",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
      {
        texts: ["hello"],
        targetLang: "zh-CN",
        context: { pageTitle: "Fixture" },
        task: "translate",
        sourceLang: undefined,
        customSystemPrompt: undefined,
        placeholderFormat: undefined,
        languageLevel: "intermediate",
      },
    )
    const cacheLookupCall = getCachedTranslationsMock.mock.calls[0] as [Array<{
      cacheContext?: {
        requestContextKey?: string
      }
    }>,]
    expect(cacheLookupCall[0][0]?.cacheContext?.requestContextKey).toBe(JSON.stringify({
      pageTitle: "Fixture",
      pageUrl: "",
      hostname: "",
      metaDescription: "",
      contentSummary: "",
      selectionContext: "",
      terminologyGlossary: "",
    }))
  })

  it("authoritatively sanitizes translation request context at the background boundary when privacy mode is enabled", async () => {
    const browser = getMockBrowser()
    const sendResponse = vi.fn()

    readConfigMock.mockResolvedValue({
      connectionMode: "astra",
      languageLevel: "intermediate",
      privacyMode: true,
      provider: {
        id: "openai",
        accessToken: "",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
    })
    translateWithProviderDetailedMock.mockResolvedValue({
      translations: ["你好"],
      metadata: {
        attemptedTransports: ["direct"],
        finalTransport: "direct",
        fallbackUsed: false,
      },
    })

    const background = (await import("./index")).default
    background.main()

    await browser.__emitRuntimeMessage(
      {
        type: "runtime/translate-batch",
        payload: {
          texts: ["hello"],
          targetLang: "zh-CN",
          context: {
            hostname: "example.com",
            pageUrl: "https://example.com/article?token=secret#section",
            pageTitle: "Private title",
            metaDescription: "Private description",
            contentSummary: "Private summary",
            selectionContext: "Private selection",
          },
          task: "translate",
        },
      },
      { id: "sender" },
      sendResponse,
    )

    await flushRuntimeResponse()

    expect(translateWithProviderDetailedMock).toHaveBeenCalledWith(
      {
        id: "openai",
        accessToken: "",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
      {
        texts: ["hello"],
        targetLang: "zh-CN",
        context: {
          hostname: "example.com",
          pageUrl: "https://example.com/article",
        },
        task: "translate",
        sourceLang: undefined,
        customSystemPrompt: undefined,
        placeholderFormat: undefined,
        languageLevel: "intermediate",
      },
    )
    const cacheLookupCall = getCachedTranslationsMock.mock.calls[0] as [Array<{
      cacheContext?: {
        requestContextKey?: string
      }
    }>,]
    expect(cacheLookupCall[0][0]?.cacheContext?.requestContextKey).toBe(JSON.stringify({
      pageTitle: "",
      pageUrl: "https://example.com/article",
      hostname: "example.com",
      metaDescription: "",
      contentSummary: "",
      selectionContext: "",
      terminologyGlossary: "",
    }))
    expect(sendResponse).toHaveBeenCalledWith({
      type: "runtime/translate-batch:success",
      payload: {
        translations: ["你好"],
        metadata: {
          attemptedTransports: ["direct"],
          finalTransport: "direct",
          fallbackUsed: false,
        },
      },
    })
  })

  it("returns cached translations without invoking the provider", async () => {
    const browser = getMockBrowser()
    const sendResponse = vi.fn()

    readConfigMock.mockResolvedValue({
      connectionMode: "astra",
      languageLevel: "intermediate",
      provider: {
        id: "openai",
        accessToken: "",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
    })
    getCachedTranslationsMock.mockResolvedValue(new Map([[0, "你好"]]))

    const background = (await import("./index")).default
    background.main()

    await browser.__emitRuntimeMessage(
      {
        type: "runtime/translate-batch",
        payload: {
          texts: ["hello"],
          targetLang: "zh-CN",
        },
      },
      { id: "sender" },
      sendResponse,
    )

    await flushRuntimeResponse()

    expect(translateWithProviderDetailedMock).not.toHaveBeenCalled()
    expect(setCachedTranslationMock).not.toHaveBeenCalled()
    expect(sendResponse).toHaveBeenCalledWith({
      type: "runtime/translate-batch:success",
      payload: {
        translations: ["你好"],
      },
    })
  })

  it("merges cached and fresh translations in the original order", async () => {
    const browser = getMockBrowser()
    const sendResponse = vi.fn()

    readConfigMock.mockResolvedValue({
      connectionMode: "astra",
      languageLevel: "intermediate",
      provider: {
        id: "openai",
        accessToken: "",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
    })
    getCachedTranslationsMock.mockResolvedValue(new Map([[0, "已缓存"]]))
    translateWithProviderDetailedMock.mockResolvedValue({
      translations: ["新鲜"],
      metadata: {
        attemptedTransports: ["direct"],
        finalTransport: "direct",
        fallbackUsed: false,
      },
    })

    const background = (await import("./index")).default
    background.main()

    await browser.__emitRuntimeMessage(
      {
        type: "runtime/translate-batch",
        payload: {
          texts: ["cached", "fresh"],
          targetLang: "zh-CN",
        },
      },
      { id: "sender" },
      sendResponse,
    )

    await flushRuntimeResponse()

    expect(translateWithProviderDetailedMock).toHaveBeenCalledWith(
      {
        id: "openai",
        accessToken: "",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
      {
        texts: ["fresh"],
        targetLang: "zh-CN",
        sourceLang: undefined,
        context: undefined,
        task: undefined,
        customSystemPrompt: undefined,
        placeholderFormat: undefined,
        languageLevel: "intermediate",
      },
    )
    expect(setCachedTranslationMock).toHaveBeenCalledTimes(1)
    expect(setCachedTranslationMock).toHaveBeenCalledWith(
      "fresh",
      "zh-CN",
      "新鲜",
      expect.objectContaining({
        providerId: "openai",
      }),
    )
    expect(sendResponse).toHaveBeenCalledWith({
      type: "runtime/translate-batch:success",
      payload: {
        translations: ["已缓存", "新鲜"],
        metadata: {
          attemptedTransports: ["direct"],
          finalTransport: "direct",
          fallbackUsed: false,
        },
      },
    })
  })

  it("maps provider errors to runtime error responses", async () => {
    const browser = getMockBrowser()
    const sendResponse = vi.fn()

    readConfigMock.mockResolvedValue({
      provider: {
        id: "openai",
        accessToken: "",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
    })
    const background = (await import("./index")).default
    const { AstraError } = await import("@/types/translation")
    translateWithProviderDetailedMock.mockRejectedValue(
      new AstraError("CONFIG_MISSING", "No API key configured."),
    )
    background.main()

    await browser.__emitRuntimeMessage(
      {
        type: "runtime/translate-batch",
        payload: {
          texts: ["hello"],
          targetLang: "zh-CN",
        },
      },
      { id: "sender" },
      sendResponse,
    )

    await flushRuntimeResponse()

    expect(sendResponse).toHaveBeenCalledWith({
      type: "runtime/translate-batch:error",
      error: {
        code: "CONFIG_MISSING",
        message: "No API key configured.",
      },
    })
  })

  it("maps non-Astra provider failures to UNKNOWN runtime error responses", async () => {
    const browser = getMockBrowser()
    const sendResponse = vi.fn()

    readConfigMock.mockResolvedValue({
      provider: {
        id: "openai",
        accessToken: "",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
    })
    translateWithProviderDetailedMock.mockRejectedValue(new Error("socket hung up"))

    const background = (await import("./index")).default
    background.main()

    await browser.__emitRuntimeMessage(
      {
        type: "runtime/translate-batch",
        payload: {
          texts: ["hello"],
          targetLang: "zh-CN",
        },
      },
      { id: "sender" },
      sendResponse,
    )

    await flushRuntimeResponse()

    expect(sendResponse).toHaveBeenCalledWith({
      type: "runtime/translate-batch:error",
      error: {
        code: "UNKNOWN",
        message: "socket hung up",
      },
    })
  })

  it("includes provider routing metadata on runtime error responses when available", async () => {
    const browser = getMockBrowser()
    const sendResponse = vi.fn()

    readConfigMock.mockResolvedValue({
      provider: {
        id: "openai",
        accessToken: "",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
    })
    getProviderRoutingMetadataFromErrorMock.mockReturnValue({
      attemptedTransports: ["direct"],
      finalTransport: null,
      fallbackUsed: false,
    })

    const background = (await import("./index")).default
    const { AstraError } = await import("@/types/translation")
    translateWithProviderDetailedMock.mockRejectedValue(
      new AstraError("CONFIG_MISSING", "No API key configured."),
    )
    background.main()

    await browser.__emitRuntimeMessage(
      {
        type: "runtime/translate-batch",
        payload: {
          texts: ["hello"],
          targetLang: "zh-CN",
        },
      },
      { id: "sender" },
      sendResponse,
    )

    await flushRuntimeResponse()

    expect(sendResponse).toHaveBeenCalledWith({
      type: "runtime/translate-batch:error",
      error: {
        code: "CONFIG_MISSING",
        message: "No API key configured.",
      },
      metadata: {
        attemptedTransports: ["direct"],
        finalTransport: null,
        fallbackUsed: false,
      },
    })
  })

  it("routes current-tab commands through the sender tab id", async () => {
    const browser = getMockBrowser()
    const sendResponse = vi.fn()
    executeTabCommandMock.mockResolvedValue({
      ok: true,
      state: {
        phase: "idle",
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
        presentation: { mode: "bilingual", theme: "default" },
        site: { hostname: "example.com", enabled: true, alwaysTranslate: false },
      },
    })

    const background = (await import("./index")).default
    background.main()

    await browser.__emitRuntimeMessage(
      {
        type: "runtime/current-tab-command",
        command: { type: "content/toggle-translation" },
      },
      { tab: { id: 42 } },
      sendResponse,
    )

    await Promise.resolve()
    await Promise.resolve()

    expect(executeTabCommandMock).toHaveBeenCalledWith(42, { type: "content/toggle-translation" })
    expect(sendResponse).toHaveBeenCalled()
  })

  it("persists config updates through runtime save-config requests", async () => {
    const browser = getMockBrowser()
    const sendResponse = vi.fn()

    saveConfigMock.mockResolvedValue({
      version: 1,
      targetLang: "ja",
      connectionMode: "astra",
      hoverTrigger: "alt",
      contentScope: "page",
      inputTranslation: "enabled",
      languageLevel: "intermediate",
      privacyMode: false,
      provider: {
        id: "openai",
        accessToken: "",
        apiKey: "",
        model: "gpt-5.4-nano",
      },
      presentation: {
        mode: "bilingual",
        theme: "default",
        fontSize: 0.92,
        translationColor: "#64748b",
      },
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
          selectors: ["article"],
        },
      },
      customActions: [],
    })

    const background = (await import("./index")).default
    background.main()

    await browser.__emitRuntimeMessage(
      {
        type: "runtime/save-config",
        payload: {
          targetLang: "ja",
          sites: {
            "example.com": {
              selectors: ["article"],
            },
          },
        },
      },
      { id: "sender" },
      sendResponse,
    )

    await Promise.resolve()
    await Promise.resolve()

    expect(saveConfigMock).toHaveBeenCalledWith({
      targetLang: "ja",
      sites: {
        "example.com": {
          selectors: ["article"],
        },
      },
    })
    const saveConfigResponse = sendResponse.mock.calls.at(-1)?.[0] as {
      type: string
      payload: {
        config: {
          targetLang: string
          sites: Record<string, {
            selectors?: string[]
          }>
        }
      }
    }
    expect(saveConfigResponse.type).toBe("runtime/save-config:success")
    expect(saveConfigResponse.payload.config.targetLang).toBe("ja")
    expect(saveConfigResponse.payload.config.sites["example.com"]?.selectors).toEqual(["article"])
    expect(runPhaseOneCollectionSyncMock).toHaveBeenCalledTimes(2)
  })

  it("does not throw when browser.omnibox is undefined (compat guard)", async () => {
    const mockBrowser = createMockBrowser()
    // Remove omnibox to simulate environments where it is unavailable
    const browserWithoutOmnibox = { ...mockBrowser } as Record<string, unknown>
    delete browserWithoutOmnibox.omnibox
    setMockBrowser(browserWithoutOmnibox)

    const background = (await import("./index")).default
    expect(() => background.main()).not.toThrow()
  })
})
