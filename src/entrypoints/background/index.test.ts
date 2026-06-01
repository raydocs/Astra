import { beforeEach, describe, expect, it, vi } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"
import { STUDY_PROGRESS_STORAGE_KEY } from "@/utils/storage/study-progress"
import { DEEP_READ_SESSION_STORAGE_KEY } from "@/utils/storage/deep-read-session"

const readConfigMock = vi.fn()
const saveConfigMock = vi.fn()
const ensureAstraDeviceIdentityMock = vi.fn()
const readAstraSessionMock = vi.fn()
const saveAstraSessionMock = vi.fn()
const translateWithProviderDetailedMock = vi.fn()
const executeTabCommandMock = vi.fn()
const initializeFrameCoordinatorMock = vi.fn()
const getProviderRoutingMetadataFromErrorMock = vi.fn()
const runPhaseOneCollectionSyncMock = vi.fn()
const readPhaseOneCollectionSyncStatusMock = vi.fn()
const cleanExpiredCacheMock = vi.fn()
const getCachedTranslationsMock = vi.fn()
const setCachedTranslationMock = vi.fn()
const initializeTranslationUsageSessionMock = vi.fn()
const recordTranslationUsageMock = vi.fn()
const createImageTranslateHandoffMock = vi.fn()
const lookupDictionaryMock = vi.fn()

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
  readPhaseOneCollectionSyncStatus: readPhaseOneCollectionSyncStatusMock,
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
  initializeFrameCoordinator: initializeFrameCoordinatorMock,
}))

vi.mock("@/entrypoints/image-translate/handoff", () => ({
  createImageTranslateHandoff: createImageTranslateHandoffMock,
  IMAGE_TRANSLATE_HANDOFF_QUERY_PARAM: "handoff",
}))

vi.mock("@/utils/reading/dictionary", () => ({
  lookupDictionary: lookupDictionaryMock,
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
    initializeFrameCoordinatorMock.mockReset()
    getProviderRoutingMetadataFromErrorMock.mockReset()
    runPhaseOneCollectionSyncMock.mockReset()
    readPhaseOneCollectionSyncStatusMock.mockReset()
    cleanExpiredCacheMock.mockReset()
    getCachedTranslationsMock.mockReset()
    setCachedTranslationMock.mockReset()
    initializeTranslationUsageSessionMock.mockReset()
    recordTranslationUsageMock.mockReset()
    createImageTranslateHandoffMock.mockReset()
    lookupDictionaryMock.mockReset()
    runPhaseOneCollectionSyncMock.mockResolvedValue({
      skipped: true,
      reason: "no-session",
      pushed: { config: 0, vocabulary: 0, reading_history: 0, study_progress: 0 },
      pulled: { config: 0, vocabulary: 0, reading_history: 0, study_progress: 0 },
      rejected: 0,
    })
    readPhaseOneCollectionSyncStatusMock.mockResolvedValue({
      accountEmail: "user@example.com",
      stateLastRunAt: "2026-04-09T01:00:00.000Z",
      stateLastSuccessAt: "2026-04-09T01:00:10.000Z",
      stateLastError: null,
      cursors: { config: null, vocabulary: "voc-1", reading_history: null, study_progress: "progress-1" },
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
    createImageTranslateHandoffMock.mockResolvedValue({
      token: "img_test-token",
      imageUrl: "https://example.com/menu.svg",
      source: "context-menu-image",
      createdAt: 1,
      expiresAt: 2,
    })
  })

  it("schedules a phase-1 collection sync on startup", async () => {
    const background = (await import("./index")).default
    background.main()

    await Promise.resolve()

    expect(runPhaseOneCollectionSyncMock).toHaveBeenCalledTimes(1)
  })

  it("registers the image translation context menu on install", async () => {
    const browser = getMockBrowser()
    const background = (await import("./index")).default
    background.main()

    await browser.__emitInstalled({ reason: "install" })

    expect(browser.contextMenus.create).toHaveBeenCalledWith({
      id: "astra-translate-image",
      title: "Translate image with Astra",
      contexts: ["image"],
    })
  })

  it("registers page and selection context menu shortcuts", async () => {
    const browser = getMockBrowser()
    const background = (await import("./index")).default
    background.main()

    await browser.__emitInstalled({ reason: "install" })

    expect(browser.contextMenus.create).toHaveBeenCalledWith({
      id: "astra-translate-page",
      title: "Translate page with Astra",
      contexts: ["page"],
    })
    expect(browser.contextMenus.create).toHaveBeenCalledWith({
      id: "astra-translate-selection",
      title: "Translate selection with Astra",
      contexts: ["selection"],
    })
    expect(browser.contextMenus.create).toHaveBeenCalledWith({
      id: "astra-explain-selection",
      title: "Explain selection with Astra",
      contexts: ["selection"],
    })
    expect(browser.contextMenus.create).toHaveBeenCalledWith({
      id: "astra-save-selection",
      title: "Save selection to Astra Review",
      contexts: ["selection"],
    })
  })

  it("routes page and selection context-menu clicks to content commands", async () => {
    const browser = getMockBrowser()
    const background = (await import("./index")).default
    background.main()

    await browser.__emitContextMenuClicked(
      { menuItemId: "astra-translate-page" },
      { id: 7, url: "https://example.com/article", title: "Example Article" },
    )
    await browser.__emitContextMenuClicked(
      { menuItemId: "astra-translate-selection", selectionText: "Hello world" },
      { id: 7, url: "https://example.com/article", title: "Example Article" },
    )
    await browser.__emitContextMenuClicked(
      { menuItemId: "astra-explain-selection", selectionText: "Hello world" },
      { id: 7, url: "https://example.com/article", title: "Example Article" },
    )
    await browser.__emitContextMenuClicked(
      { menuItemId: "astra-save-selection", selectionText: "Hello world" },
      { id: 7, url: "https://example.com/article", title: "Example Article" },
    )

    expect(executeTabCommandMock).toHaveBeenCalledWith(7, {
      type: "content/start-translation",
      payload: { contentScope: "page" },
    })
    expect(browser.tabs.sendMessage).toHaveBeenNthCalledWith(1, 7, {
      type: "content/run-selection-action",
      payload: { actionId: "translate", text: "Hello world" },
    })
    expect(browser.tabs.sendMessage).toHaveBeenNthCalledWith(2, 7, {
      type: "content/run-selection-action",
      payload: { actionId: "explain", text: "Hello world" },
    })
    expect(browser.tabs.sendMessage).toHaveBeenNthCalledWith(3, 7, {
      type: "content/save-selection",
      payload: { text: "Hello world" },
    })
  })

  it("routes selection context-menu clicks to the originating frame", async () => {
    const browser = getMockBrowser()
    const background = (await import("./index")).default
    background.main()

    await browser.__emitContextMenuClicked(
      { menuItemId: "astra-translate-selection", selectionText: "Frame text", frameId: 4 },
      { id: 7, url: "https://example.com/article", title: "Example Article" },
    )
    await browser.__emitContextMenuClicked(
      { menuItemId: "astra-save-selection", selectionText: "Frame text", frameId: 4 },
      { id: 7, url: "https://example.com/article", title: "Example Article" },
    )

    expect(browser.tabs.sendMessage).toHaveBeenNthCalledWith(1, 7, {
      type: "content/run-selection-action",
      payload: { actionId: "translate", text: "Frame text" },
    }, { frameId: 4 })
    expect(browser.tabs.sendMessage).toHaveBeenNthCalledWith(2, 7, {
      type: "content/save-selection",
      payload: { text: "Frame text" },
    }, { frameId: 4 })
  })

  it("routes translate-page keyboard shortcuts through the frame coordinator", async () => {
    const browser = getMockBrowser()
    browser.tabs.query.mockResolvedValue([{ id: 7, url: "https://example.com/article", active: true }])
    const background = (await import("./index")).default
    background.main()

    await browser.__emitCommand("translatePage")
    await flushRuntimeResponse()

    expect(executeTabCommandMock).toHaveBeenCalledWith(7, {
      type: "content/start-translation",
      payload: { contentScope: "page" },
    })
    expect(browser.tabs.sendMessage).not.toHaveBeenCalledWith(7, expect.objectContaining({
      type: "content/start-translation",
    }))
  })

  it("routes omnibox auto-translate through the frame coordinator after tab load", async () => {
    const baseBrowser = createMockBrowser()
    const inputListeners: Array<(text: string) => void> = []
    const browser = {
      ...baseBrowser,
      omnibox: {
        setDefaultSuggestion: vi.fn(),
        onInputEntered: {
          addListener: vi.fn((listener: (text: string) => void) => {
            inputListeners.push(listener)
          }),
          removeListener: vi.fn(),
        },
      },
    }
    setMockBrowser(browser)
    ;(browser.tabs.create as unknown as {
      mockResolvedValueOnce: (value: { id: number; url: string }) => void
    }).mockResolvedValueOnce({ id: 11, url: "https://example.com/article" })

    const background = (await import("./index")).default
    background.main()

    expect(inputListeners).toHaveLength(1)
    inputListeners[0]?.("example.com/article")
    await flushRuntimeResponse()
    await browser.__emitTabUpdated(11, { status: "complete" }, { id: 11 })
    await flushRuntimeResponse()

    expect(browser.tabs.create).toHaveBeenCalledWith({ url: "https://example.com/article" })
    expect(executeTabCommandMock).toHaveBeenCalledWith(11, {
      type: "content/start-translation",
      payload: { contentScope: "page" },
    })
    expect(browser.tabs.sendMessage).not.toHaveBeenCalledWith(11, expect.objectContaining({
      type: "content/start-translation",
    }))
  })

  it("continues registering new context-menu items when existing IDs already exist", async () => {
    const browser = getMockBrowser()
    browser.contextMenus.create
      .mockImplementationOnce(() => { throw new Error("Duplicate id") })
      .mockImplementationOnce(() => { throw new Error("Duplicate id") })
      .mockImplementation(() => undefined)
    const background = (await import("./index")).default
    background.main()

    await browser.__emitInstalled({ reason: "update" })

    expect(browser.contextMenus.create).toHaveBeenCalledWith({
      id: "astra-translate-image",
      title: "Translate image with Astra",
      contexts: ["image"],
    })
  })

  it("opens image translate page with a short-lived handoff token from image context menu clicks", async () => {
    const browser = getMockBrowser()
    browser.tabs.sendMessage.mockResolvedValueOnce({
      ok: true,
      capture: {
        dataUrl: "data:image/svg+xml;base64,PHN2Zz48dGV4dD5IZWxsbzwvdGV4dD48L3N2Zz4=",
        mimeType: "image/svg+xml",
        fileName: "menu.svg",
        byteLength: 23,
      },
    })
    const background = (await import("./index")).default
    background.main()

    await browser.__emitContextMenuClicked(
      { menuItemId: "astra-translate-image", srcUrl: "https://example.com/menu.svg", frameId: 3 },
      { id: 7, url: "https://example.com/article", title: "Example Article" },
    )
    await flushRuntimeResponse()

    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(7, {
      type: "content/capture-image",
      payload: { imageUrl: "https://example.com/menu.svg" },
    }, { frameId: 3 })
    expect(createImageTranslateHandoffMock).toHaveBeenCalledWith({
      imageUrl: "https://example.com/menu.svg",
      pageUrl: "https://example.com/article",
      pageTitle: "Example Article",
      captured: {
        dataUrl: "data:image/svg+xml;base64,PHN2Zz48dGV4dD5IZWxsbzwvdGV4dD48L3N2Zz4=",
        mimeType: "image/svg+xml",
        fileName: "menu.svg",
        byteLength: 23,
      },
    })
    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: "/image-translate.html?handoff=img_test-token",
    })
    expect(browser.tabs.sendMessage).not.toHaveBeenCalledWith(7, expect.objectContaining({
      type: "content/translate-image",
    }), expect.anything())
  })

  it("falls back to a URL-only handoff when page image capture fails", async () => {
    const browser = getMockBrowser()
    browser.tabs.sendMessage.mockRejectedValueOnce(new Error("content unavailable"))
    const background = (await import("./index")).default
    background.main()

    await browser.__emitContextMenuClicked(
      { menuItemId: "astra-translate-image", srcUrl: "https://example.com/private.png" },
      { id: 7, url: "https://example.com/article", title: "Example Article" },
    )
    await flushRuntimeResponse()

    expect(createImageTranslateHandoffMock).toHaveBeenCalledWith({
      imageUrl: "https://example.com/private.png",
      pageUrl: "https://example.com/article",
      pageTitle: "Example Article",
    })
    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: "/image-translate.html?handoff=img_test-token",
    })
  })

  it("retries URL-only handoff when captured payload storage fails", async () => {
    const browser = getMockBrowser()
    browser.tabs.sendMessage.mockResolvedValueOnce({
      ok: true,
      capture: {
        dataUrl: "data:image/png;base64,cGl4ZWxz",
        mimeType: "image/png",
        fileName: "private.png",
        byteLength: 6,
      },
    })
    createImageTranslateHandoffMock
      .mockRejectedValueOnce(new Error("storage quota exceeded"))
      .mockResolvedValueOnce({
        token: "img_url_only",
        imageUrl: "https://example.com/private.png",
        source: "context-menu-image",
        createdAt: 1,
        expiresAt: 2,
      })
    const background = (await import("./index")).default
    background.main()

    await browser.__emitContextMenuClicked(
      { menuItemId: "astra-translate-image", srcUrl: "https://example.com/private.png" },
      { id: 7, url: "https://example.com/article", title: "Example Article" },
    )
    await flushRuntimeResponse()

    expect(createImageTranslateHandoffMock).toHaveBeenNthCalledWith(1, {
      imageUrl: "https://example.com/private.png",
      pageUrl: "https://example.com/article",
      pageTitle: "Example Article",
      captured: {
        dataUrl: "data:image/png;base64,cGl4ZWxz",
        mimeType: "image/png",
        fileName: "private.png",
        byteLength: 6,
      },
    })
    expect(createImageTranslateHandoffMock).toHaveBeenNthCalledWith(2, {
      imageUrl: "https://example.com/private.png",
      pageUrl: "https://example.com/article",
      pageTitle: "Example Article",
    })
    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: "/image-translate.html?handoff=img_url_only",
    })
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

  it("schedules a collection sync when deep-read session anchors change locally", async () => {
    const browser = getMockBrowser()
    const background = (await import("./index")).default
    background.main()

    runPhaseOneCollectionSyncMock.mockClear()

    await browser.__emitStorageChange({
      [DEEP_READ_SESSION_STORAGE_KEY]: {
        oldValue: undefined,
        newValue: { sessions: [{ pageUrl: "https://example.com/article", sentences: ["One."], selectedSentenceIndex: 0, updatedAt: 1000 }] },
      },
    }, "local")

    await Promise.resolve()

    expect(runPhaseOneCollectionSyncMock).toHaveBeenCalledTimes(1)
  })

  it("commits learning continuity on demand and returns phase-one status", async () => {
    const browser = getMockBrowser()
    const sendResponse = vi.fn()
    const background = (await import("./index")).default
    background.main()
    await flushRuntimeResponse()
    runPhaseOneCollectionSyncMock.mockClear()
    runPhaseOneCollectionSyncMock.mockResolvedValueOnce({
      skipped: false,
      reason: "synced",
      pushed: { config: 0, vocabulary: 1, reading_history: 0, study_progress: 1 },
      pulled: { config: 0, vocabulary: 0, reading_history: 0, study_progress: 0 },
      rejected: 0,
    })

    await browser.__emitRuntimeMessage(
      { type: "runtime/learning-continuity-sync", reason: "popup-save" },
      { id: "sender" },
      sendResponse,
    )

    await flushRuntimeResponse()

    expect(runPhaseOneCollectionSyncMock).toHaveBeenCalledTimes(1)
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
      type: "runtime/learning-continuity-sync:success",
      payload: expect.objectContaining({
        result: expect.objectContaining({ pushed: expect.objectContaining({ vocabulary: 1, study_progress: 1 }) }),
        status: expect.objectContaining({ lastReason: "popup-save", stateLastSuccessAt: "2026-04-09T01:00:10.000Z" }),
      }),
    }))
  })

  it("coalesces concurrent learning continuity commits", async () => {
    const browser = getMockBrowser()
    const sendResponseA = vi.fn()
    const sendResponseB = vi.fn()
    let resolveSync: (value: {
      skipped: boolean
      reason: "synced"
      pushed: { config: number; vocabulary: number; reading_history: number; study_progress: number }
      pulled: { config: number; vocabulary: number; reading_history: number; study_progress: number }
      rejected: number
    }) => void = () => {}

    const background = (await import("./index")).default
    background.main()
    await flushRuntimeResponse()
    runPhaseOneCollectionSyncMock.mockClear()
    runPhaseOneCollectionSyncMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveSync = resolve
    }))

    void browser.__emitRuntimeMessage({ type: "runtime/learning-continuity-sync", reason: "popup-save" }, { id: "a" }, sendResponseA)
    void browser.__emitRuntimeMessage({ type: "runtime/learning-continuity-sync", reason: "review-answer" }, { id: "b" }, sendResponseB)
    await Promise.resolve()

    expect(runPhaseOneCollectionSyncMock).toHaveBeenCalledTimes(1)
    resolveSync({
      skipped: false,
      reason: "synced",
      pushed: { config: 0, vocabulary: 1, reading_history: 0, study_progress: 1 },
      pulled: { config: 0, vocabulary: 0, reading_history: 0, study_progress: 0 },
      rejected: 0,
    })
    await flushRuntimeResponse()

    expect(sendResponseA).toHaveBeenCalled()
    expect(sendResponseB).toHaveBeenCalled()
    expect(runPhaseOneCollectionSyncMock).toHaveBeenCalledTimes(2)
  })

  it("returns offline dictionary lookup results through runtime messaging", async () => {
    const browser = getMockBrowser()
    const sendResponse = vi.fn()
    lookupDictionaryMock.mockResolvedValueOnce({ ipa: "maus", gloss: "老鼠" })
    const background = (await import("./index")).default
    background.main()

    await browser.__emitRuntimeMessage(
      { type: "runtime/dictionary-lookup", word: "mice" },
      { id: "sender" },
      sendResponse,
    )
    await flushRuntimeResponse()

    expect(lookupDictionaryMock).toHaveBeenCalledWith("mice")
    expect(sendResponse).toHaveBeenCalledWith({
      type: "runtime/dictionary-lookup:result",
      entry: { ipa: "maus", gloss: "老鼠" },
    })
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
      cacheStatus: "miss",
      tier: "pro",
      success: true,
    }))
  })

  it("routes automatic short translation batches through the Fast service style", async () => {
    const browser = getMockBrowser()
    const sendResponse = vi.fn()

    readConfigMock.mockResolvedValue({
      connectionMode: "astra",
      languageLevel: "intermediate",
      serviceMode: "automatic",
      provider: {
        id: "openai",
        accessToken: "",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
    })
    translateWithProviderDetailedMock.mockResolvedValue({
      translations: ["短标题"],
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
          texts: ["Short headline"],
          targetLang: "zh-CN",
          context: { pageTitle: "Fixture" },
        },
      },
      { id: "sender" },
      sendResponse,
    )

    await flushRuntimeResponse()

    expect(translateWithProviderDetailedMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        texts: ["Short headline"],
        serviceMode: "fast",
      }),
    )
    const cacheLookupCall = getCachedTranslationsMock.mock.calls[0] as [Array<{
      cacheContext?: { serviceMode?: string }
    }>]
    expect(cacheLookupCall[0][0]?.cacheContext?.serviceMode).toBe("fast")
    expect(recordTranslationUsageMock).toHaveBeenCalledWith(expect.objectContaining({
      serviceMode: "fast",
    }))
  })

  it("routes medium automatic reading batches through Balanced service style", async () => {
    const browser = getMockBrowser()
    const sendResponse = vi.fn()
    const mediumParagraph = "This is a moderate reading passage with enough surrounding detail to favor stable quality over the shortest-latency path. ".repeat(4)

    readConfigMock.mockResolvedValue({
      connectionMode: "astra",
      languageLevel: "intermediate",
      serviceMode: "automatic",
      privacyMode: false,
      provider: {
        id: "openai",
        accessToken: "",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
    })
    translateWithProviderDetailedMock.mockResolvedValue({
      translations: ["平衡模式翻译"],
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
          texts: [mediumParagraph],
          targetLang: "zh-CN",
          context: { pageTitle: "Medium article" },
        },
      },
      { id: "sender" },
      sendResponse,
    )

    await flushRuntimeResponse()

    expect(translateWithProviderDetailedMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        texts: [mediumParagraph],
        serviceMode: "balanced",
      }),
    )
    expect(recordTranslationUsageMock).toHaveBeenCalledWith(expect.objectContaining({
      serviceMode: "balanced",
    }))
  })

  it("routes automatic learning tasks through Best quality", async () => {
    const browser = getMockBrowser()
    const sendResponse = vi.fn()

    readConfigMock.mockResolvedValue({
      connectionMode: "astra",
      languageLevel: "intermediate",
      serviceMode: "automatic",
      provider: {
        id: "openai",
        accessToken: "",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
    })
    translateWithProviderDetailedMock.mockResolvedValue({
      translations: ["解释输出"],
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
          texts: ["Explain this sentence."],
          targetLang: "zh-CN",
          task: "explain",
          context: { selectionContext: "Explain this sentence." },
        },
      },
      { id: "sender" },
      sendResponse,
    )

    await flushRuntimeResponse()

    expect(translateWithProviderDetailedMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        texts: ["Explain this sentence."],
        serviceMode: "best_quality",
      }),
    )
  })

  it("routes long or terminology-sensitive automatic batches through Best quality", async () => {
    const { saveVocabularyEntry } = await import("@/utils/storage/vocabulary")
    await saveVocabularyEntry({
      text: "Astra Router",
      glossaryTargetText: "阿斯特拉路由",
      hostname: "example.com",
      glossaryEnabled: true,
      glossaryScope: "hostname",
    })

    const browser = getMockBrowser()
    const sendResponse = vi.fn()
    const longParagraph = `${"Astra Router coordinates provider selection for long contextual passages. ".repeat(12)}End.`

    readConfigMock.mockResolvedValue({
      connectionMode: "astra",
      languageLevel: "intermediate",
      serviceMode: "balanced",
      privacyMode: false,
      provider: {
        id: "openai",
        accessToken: "",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
    })
    translateWithProviderDetailedMock.mockResolvedValue({
      translations: ["高质量长段翻译"],
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
          texts: [longParagraph],
          targetLang: "zh-CN",
          context: { hostname: "example.com", contentSummary: "Provider routing article" },
        },
      },
      { id: "sender" },
      sendResponse,
    )

    await flushRuntimeResponse()

    expect(translateWithProviderDetailedMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        texts: [longParagraph],
        serviceMode: "best_quality",
        context: expect.objectContaining({
          terminologyGlossary: "Astra Router => 阿斯特拉路由",
        }),
      }),
    )
    const cacheLookupCall = getCachedTranslationsMock.mock.calls[0] as [Array<{
      cacheContext?: { serviceMode?: string; requestContextKey?: string }
    }>]
    expect(cacheLookupCall[0][0]?.cacheContext?.serviceMode).toBe("best_quality")
    expect(cacheLookupCall[0][0]?.cacheContext?.requestContextKey).toContain("Astra Router => 阿斯特拉路由")
  })

  it("uses sender hostname, not caller payload hostname, for site provider routing", async () => {
    const browser = getMockBrowser()
    const sendResponse = vi.fn()

    readConfigMock.mockResolvedValue({
      connectionMode: "astra",
      languageLevel: "intermediate",
      privacyMode: false,
      provider: {
        id: "openai",
        apiKey: "sk-openai",
        accessToken: "astra-session",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
          provider: {
            id: "gemini",
            model: "gemini-3.1-pro",
          },
        },
      },
    })
    readAstraSessionMock.mockResolvedValue({
      sessionToken: "astra-session",
      relayBaseURL: "https://astra.example/v1",
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
          context: { hostname: "attacker.example" },
        },
      },
      { id: "sender", url: "https://example.com/article" },
      sendResponse,
    )

    await flushRuntimeResponse()

    expect(translateWithProviderDetailedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "gemini",
        apiKey: "",
        accessToken: "astra-session",
        relayBaseURL: "https://astra.example/v1",
        model: "gemini-3.1-pro",
      }),
      expect.objectContaining({ texts: ["hello"], targetLang: "zh-CN" }),
    )
    const cacheLookupCall = getCachedTranslationsMock.mock.calls[0] as [Array<{
      cacheContext?: { providerId?: string; model?: string }
    }>]
    expect(cacheLookupCall[0][0]?.cacheContext).toMatchObject({
      providerId: "gemini",
      model: "gemini-3.1-pro",
    })
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
        fallbackReason: "outage",
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
      fallbackReason: "outage",
      route: "fallback",
      cacheStatus: "miss",
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
      explanationGlossary: "",
      translationMemory: "",
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
      explanationGlossary: "",
      translationMemory: "",
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
      explanationGlossary: "",
      translationMemory: "",
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
    expect(recordTranslationUsageMock).toHaveBeenCalledWith(expect.objectContaining({
      texts: ["hello"],
      attemptedTransports: [],
      finalTransport: null,
      fallbackUsed: false,
      route: null,
      cacheStatus: "hit",
      tier: "unknown",
      success: true,
    }))
  })

  it("records disabled cache status for uncacheable translate requests", async () => {
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
    translateWithProviderDetailedMock.mockResolvedValue({
      translations: ["自定义"],
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
          texts: ["custom"],
          targetLang: "zh-CN",
          task: "custom",
          customSystemPrompt: "Return a short result.",
        },
      },
      { id: "sender" },
      sendResponse,
    )

    await flushRuntimeResponse()

    expect(getCachedTranslationsMock).not.toHaveBeenCalled()
    expect(recordTranslationUsageMock).toHaveBeenCalledWith(expect.objectContaining({
      cacheStatus: "disabled",
      success: true,
    }))
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
    expect(recordTranslationUsageMock).toHaveBeenCalledWith(expect.objectContaining({
      texts: ["fresh"],
      cacheStatus: "partial",
      success: true,
    }))
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
