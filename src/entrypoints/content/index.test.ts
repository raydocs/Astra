import { beforeEach, describe, expect, it, vi } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"

function getMockBrowser(): ReturnType<typeof createMockBrowser> {
  return (globalThis as unknown as { __ASTRA_TEST_BROWSER__: ReturnType<typeof createMockBrowser> })
    .__ASTRA_TEST_BROWSER__
}

const originalHistoryPushState = history.pushState.bind(history)
const originalHistoryReplaceState = history.replaceState.bind(history)

const {
  mountFloatBallMock,
  mountSelectionToolbarMock,
  mountHoverTranslateMock,
  mountInputTranslateMock,
  readConfigMock,
  readAstraSessionMock,
  resolveSiteTranslationSettingsMock,
  isTopFrameMock,
  getPageTranslationStateMock,
  startPageTranslationMock,
  stopPageTranslationMock,
  translatePageSubtitlesMock,
  removeTranslatedSubtitlesMock,
} = vi.hoisted(() => ({
  mountFloatBallMock: vi.fn(),
  mountSelectionToolbarMock: vi.fn(),
  mountHoverTranslateMock: vi.fn(),
  mountInputTranslateMock: vi.fn(),
  readConfigMock: vi.fn(),
  readAstraSessionMock: vi.fn(),
  resolveSiteTranslationSettingsMock: vi.fn(),
  isTopFrameMock: vi.fn(),
  getPageTranslationStateMock: vi.fn(),
  startPageTranslationMock: vi.fn(),
  stopPageTranslationMock: vi.fn(),
  translatePageSubtitlesMock: vi.fn(),
  removeTranslatedSubtitlesMock: vi.fn(),
}))

vi.mock("./components/FloatBall", () => ({
  mountFloatBall: mountFloatBallMock,
}))

vi.mock("./components/SelectionToolbar", () => ({
  mountSelectionToolbar: mountSelectionToolbarMock,
}))

vi.mock("./components/HoverTranslate", () => ({
  mountHoverTranslate: mountHoverTranslateMock,
}))

vi.mock("./components/InputTranslate", () => ({
  mountInputTranslate: mountInputTranslateMock,
}))

vi.mock("./frame-context", () => ({
  isTopFrame: isTopFrameMock,
}))

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
}))

vi.mock("@/utils/storage/auth", () => ({
  readAstraSession: readAstraSessionMock,
}))

vi.mock("@/types/config", async () => {
  const actual = await vi.importActual<typeof import("@/types/config")>("@/types/config")
  return {
    ...actual,
    resolveSiteTranslationSettings: resolveSiteTranslationSettingsMock,
  }
})

vi.mock("./page-translate", () => ({
  getPageTranslationState: getPageTranslationStateMock,
  startPageTranslation: startPageTranslationMock,
  stopPageTranslation: stopPageTranslationMock,
}))

vi.mock("./subtitle-translate", () => ({
  translatePageSubtitles: translatePageSubtitlesMock,
  removeTranslatedSubtitles: removeTranslatedSubtitlesMock,
}))

describe("content entrypoint mounting", () => {
  beforeEach(() => {
    vi.resetModules()
    setMockBrowser(createMockBrowser())
    vi.clearAllMocks()
    document.head.innerHTML = ""
    document.body.innerHTML = ""
    history.pushState = originalHistoryPushState
    history.replaceState = originalHistoryReplaceState
    delete (window as Window & { __ASTRA_INJECTED__?: boolean }).__ASTRA_INJECTED__

    readConfigMock.mockResolvedValue({
      provider: { accessToken: "", relayBaseURL: "" },
      inputTranslation: "enabled",
    })
    readAstraSessionMock.mockResolvedValue(null)
    resolveSiteTranslationSettingsMock.mockReturnValue({
      enabled: true,
      alwaysTranslate: false,
      targetLang: "zh-CN",
      hoverTrigger: "always",
      contentScope: "page",
      presentation: { mode: "bilingual", theme: "default" },
    })
    getPageTranslationStateMock.mockReturnValue({
      phase: "idle",
      sessionId: 1,
      targetLang: null,
      lastError: null,
      progress: { totalBlocks: 0, queuedBlocks: 0, inFlightBlocks: 0, translatedBlocks: 0, failedBlocks: 0 },
      presentation: { mode: "bilingual", theme: "default" },
      site: { hostname: "example.com", enabled: true, alwaysTranslate: false },
    })
    startPageTranslationMock.mockResolvedValue({
      phase: "running",
      sessionId: 2,
      targetLang: "zh-CN",
      lastError: null,
      progress: { totalBlocks: 0, queuedBlocks: 0, inFlightBlocks: 0, translatedBlocks: 0, failedBlocks: 0 },
      presentation: { mode: "bilingual", theme: "default" },
      site: { hostname: "example.com", enabled: true, alwaysTranslate: false },
    })
    stopPageTranslationMock.mockReturnValue({
      phase: "idle",
      sessionId: 2,
      targetLang: "zh-CN",
      lastError: null,
      progress: { totalBlocks: 0, queuedBlocks: 0, inFlightBlocks: 0, translatedBlocks: 0, failedBlocks: 0 },
      presentation: { mode: "bilingual", theme: "default" },
      site: { hostname: "example.com", enabled: true, alwaysTranslate: false },
    })
  })

  it("mounts all interactive overlays in the top frame and float ball only once", async () => {
    isTopFrameMock.mockReturnValue(true)
    const contentScript = (await import("./index")).default

    await contentScript.main({} as never)

    expect(mountSelectionToolbarMock).toHaveBeenCalledTimes(1)
    expect(mountHoverTranslateMock).toHaveBeenCalledTimes(1)
    expect(mountInputTranslateMock).toHaveBeenCalledTimes(1)
    expect(mountFloatBallMock).toHaveBeenCalledTimes(1)
  })

  it("mounts hover, selection, and input overlays inside child frames without duplicating the float ball", async () => {
    isTopFrameMock.mockReturnValue(false)
    const contentScript = (await import("./index")).default

    await contentScript.main({} as never)

    expect(mountSelectionToolbarMock).toHaveBeenCalledTimes(1)
    expect(mountHoverTranslateMock).toHaveBeenCalledTimes(1)
    expect(mountInputTranslateMock).toHaveBeenCalledTimes(1)
    expect(mountFloatBallMock).not.toHaveBeenCalled()
  })

  it("toggle starts page translation and subtitles when currently idle", async () => {
    isTopFrameMock.mockReturnValue(true)
    setMockBrowser(createMockBrowser())
    const browser = getMockBrowser()
    const sendResponse = vi.fn()
    const contentScript = (await import("./index")).default

    await contentScript.main({} as never)
    await browser.__emitRuntimeMessage(
      { type: "content/toggle-translation" },
      { id: "sender" },
      sendResponse,
    )
    await Promise.resolve()
    await Promise.resolve()

    expect(startPageTranslationMock).toHaveBeenCalledTimes(1)
    expect(translatePageSubtitlesMock).toHaveBeenCalledTimes(1)
    expect(removeTranslatedSubtitlesMock).not.toHaveBeenCalled()
  })

  it("toggle stops page translation and removes subtitles when already active", async () => {
    isTopFrameMock.mockReturnValue(true)
    setMockBrowser(createMockBrowser())
    const browser = getMockBrowser()
    const sendResponse = vi.fn()
    readConfigMock.mockResolvedValue({
      provider: { accessToken: "", relayBaseURL: "https://astra.example/v1" },
      inputTranslation: "enabled",
    })
    readAstraSessionMock.mockResolvedValue({
      sessionToken: "astra-session",
      relayBaseURL: "https://astra.example/v1",
    })
    getPageTranslationStateMock.mockReturnValue({
      phase: "running",
      sessionId: 2,
      targetLang: "zh-CN",
      lastError: null,
      progress: { totalBlocks: 0, queuedBlocks: 0, inFlightBlocks: 0, translatedBlocks: 0, failedBlocks: 0 },
      presentation: { mode: "bilingual", theme: "default" },
      site: { hostname: "example.com", enabled: true, alwaysTranslate: false },
    })
    const contentScript = (await import("./index")).default

    await contentScript.main({} as never)
    stopPageTranslationMock.mockClear()
    removeTranslatedSubtitlesMock.mockClear()
    await browser.__emitRuntimeMessage(
      { type: "content/toggle-translation" },
      { id: "sender" },
      sendResponse,
    )
    await Promise.resolve()
    await Promise.resolve()

    expect(stopPageTranslationMock).toHaveBeenCalledTimes(1)
    expect(removeTranslatedSubtitlesMock).toHaveBeenCalledTimes(1)
    expect(startPageTranslationMock).not.toHaveBeenCalled()
  })

  it("auto-starts page translation when always translate is enabled and provider access is available", async () => {
    isTopFrameMock.mockReturnValue(true)
    readConfigMock.mockResolvedValue({
      provider: { accessToken: "", relayBaseURL: "https://astra.example/v1" },
      inputTranslation: "enabled",
    })
    readAstraSessionMock.mockResolvedValue({
      sessionToken: "astra-session",
      relayBaseURL: "https://astra.example/v1",
    })
    resolveSiteTranslationSettingsMock.mockReturnValue({
      enabled: true,
      alwaysTranslate: true,
      targetLang: "zh-CN",
      hoverTrigger: "always",
      contentScope: "page",
      presentation: { mode: "bilingual", theme: "default" },
    })
    const contentScript = (await import("./index")).default

    await contentScript.main({} as never)
    await Promise.resolve()

    expect(startPageTranslationMock).toHaveBeenCalledTimes(1)
  })

  it("starts translation when storage changes enable always translate for the current site", async () => {
    isTopFrameMock.mockReturnValue(true)
    const browser = getMockBrowser()
    const contentScript = (await import("./index")).default

    await contentScript.main({} as never)
    expect(startPageTranslationMock).not.toHaveBeenCalled()

    readConfigMock.mockResolvedValue({
      provider: { accessToken: "", relayBaseURL: "https://astra.example/v1" },
      inputTranslation: "enabled",
    })
    readAstraSessionMock.mockResolvedValue({
      sessionToken: "astra-session",
      relayBaseURL: "https://astra.example/v1",
    })
    resolveSiteTranslationSettingsMock.mockReturnValue({
      enabled: true,
      alwaysTranslate: true,
      targetLang: "zh-CN",
      hoverTrigger: "always",
      contentScope: "page",
      presentation: { mode: "bilingual", theme: "default" },
    })

    await browser.__emitStorageChange({
      "astra.config.v1": {
        oldValue: { sites: {} },
        newValue: { sites: { "example.com": { enabled: true, alwaysTranslate: true } } },
      },
    }, "local")
    await Promise.resolve()
    await Promise.resolve()

    expect(startPageTranslationMock).toHaveBeenCalledTimes(1)
    expect(mountSelectionToolbarMock).toHaveBeenCalledTimes(1)
  })

  it("stops active translation when storage changes disable the current site", async () => {
    isTopFrameMock.mockReturnValue(true)
    getPageTranslationStateMock.mockReturnValue({
      phase: "running",
      sessionId: 2,
      targetLang: "zh-CN",
      lastError: null,
      progress: { totalBlocks: 0, queuedBlocks: 0, inFlightBlocks: 0, translatedBlocks: 0, failedBlocks: 0 },
      presentation: { mode: "bilingual", theme: "default" },
      site: { hostname: "example.com", enabled: true, alwaysTranslate: true },
    })
    const browser = getMockBrowser()
    const contentScript = (await import("./index")).default

    await contentScript.main({} as never)
    stopPageTranslationMock.mockClear()
    removeTranslatedSubtitlesMock.mockClear()

    resolveSiteTranslationSettingsMock.mockReturnValue({
      enabled: false,
      alwaysTranslate: false,
      targetLang: "zh-CN",
      hoverTrigger: "always",
      contentScope: "page",
      presentation: { mode: "bilingual", theme: "default" },
    })

    await browser.__emitStorageChange({
      "astra.config.v1": {
        oldValue: { sites: { "example.com": { enabled: true, alwaysTranslate: true } } },
        newValue: { sites: { "example.com": { enabled: false, alwaysTranslate: false } } },
      },
    }, "local")
    await Promise.resolve()
    await Promise.resolve()

    expect(stopPageTranslationMock).toHaveBeenCalledTimes(1)
    expect(removeTranslatedSubtitlesMock).toHaveBeenCalledTimes(1)
  })

  it("restarts active translation when storage changes alter translation-affecting site settings", async () => {
    isTopFrameMock.mockReturnValue(true)
    readConfigMock.mockResolvedValue({
      provider: { accessToken: "", relayBaseURL: "https://astra.example/v1" },
      inputTranslation: "enabled",
    })
    readAstraSessionMock.mockResolvedValue({
      sessionToken: "astra-session",
      relayBaseURL: "https://astra.example/v1",
    })
    resolveSiteTranslationSettingsMock.mockReturnValue({
      enabled: true,
      alwaysTranslate: true,
      targetLang: "zh-CN",
      hoverTrigger: "always",
      contentScope: "page",
      presentation: { mode: "bilingual", theme: "default" },
      selectors: ["article"],
    })
    const browser = getMockBrowser()
    const contentScript = (await import("./index")).default

    await contentScript.main({} as never)
    expect(startPageTranslationMock).toHaveBeenCalledTimes(1)

    startPageTranslationMock.mockClear()
    stopPageTranslationMock.mockClear()
    removeTranslatedSubtitlesMock.mockClear()
    getPageTranslationStateMock.mockReturnValue({
      phase: "running",
      sessionId: 2,
      targetLang: "zh-CN",
      lastError: null,
      progress: { totalBlocks: 0, queuedBlocks: 0, inFlightBlocks: 0, translatedBlocks: 0, failedBlocks: 0 },
      presentation: { mode: "bilingual", theme: "default" },
      site: { hostname: "example.com", enabled: true, alwaysTranslate: true },
    })
    resolveSiteTranslationSettingsMock.mockReturnValue({
      enabled: true,
      alwaysTranslate: true,
      targetLang: "ja",
      hoverTrigger: "always",
      contentScope: "page",
      presentation: { mode: "translation-only", theme: "default" },
      selectors: ["article", ".content"],
    })

    await browser.__emitStorageChange({
      "astra.config.v1": {
        oldValue: { sites: { "example.com": { enabled: true, alwaysTranslate: true, selectors: ["article"] } } },
        newValue: { sites: { "example.com": { enabled: true, alwaysTranslate: true, selectors: ["article", ".content"], targetLang: "ja", presentation: { mode: "translation-only" } } } },
      },
    }, "local")
    await Promise.resolve()
    await Promise.resolve()

    expect(stopPageTranslationMock).toHaveBeenCalledTimes(1)
    expect(removeTranslatedSubtitlesMock).toHaveBeenCalledTimes(1)
    expect(startPageTranslationMock).toHaveBeenCalledTimes(1)
    expect(startPageTranslationMock).toHaveBeenCalledWith({
      targetLang: "ja",
      contentScope: "page",
      translationMode: "translation-only",
      translationTheme: "default",
      selectors: [".content", "article"],
      excludeSelectors: undefined,
      paragraphMinLength: undefined,
    })
  })

  it("does not restart active translation when selector lists only change order", async () => {
    isTopFrameMock.mockReturnValue(true)
    readConfigMock.mockResolvedValue({
      provider: { accessToken: "", relayBaseURL: "https://astra.example/v1" },
      inputTranslation: "enabled",
    })
    readAstraSessionMock.mockResolvedValue({
      sessionToken: "astra-session",
      relayBaseURL: "https://astra.example/v1",
    })
    resolveSiteTranslationSettingsMock.mockReturnValue({
      enabled: true,
      alwaysTranslate: true,
      targetLang: "zh-CN",
      hoverTrigger: "always",
      contentScope: "page",
      presentation: { mode: "bilingual", theme: "default" },
      selectors: ["article", ".content"],
      excludeSelectors: [".ads", ".aside"],
    })
    const browser = getMockBrowser()
    const contentScript = (await import("./index")).default

    await contentScript.main({} as never)
    expect(startPageTranslationMock).toHaveBeenCalledTimes(1)

    startPageTranslationMock.mockClear()
    stopPageTranslationMock.mockClear()
    removeTranslatedSubtitlesMock.mockClear()
    getPageTranslationStateMock.mockReturnValue({
      phase: "running",
      sessionId: 2,
      targetLang: "zh-CN",
      lastError: null,
      progress: { totalBlocks: 0, queuedBlocks: 0, inFlightBlocks: 0, translatedBlocks: 0, failedBlocks: 0 },
      presentation: { mode: "bilingual", theme: "default" },
      site: { hostname: "example.com", enabled: true, alwaysTranslate: true },
    })
    resolveSiteTranslationSettingsMock.mockReturnValue({
      enabled: true,
      alwaysTranslate: true,
      targetLang: "zh-CN",
      hoverTrigger: "always",
      contentScope: "page",
      presentation: { mode: "bilingual", theme: "default" },
      selectors: [".content", "article", "article"],
      excludeSelectors: [".aside", ".ads"],
    })

    await browser.__emitStorageChange({
      "astra.config.v1": {
        oldValue: { sites: { "example.com": { enabled: true, alwaysTranslate: true, selectors: ["article", ".content"], excludeSelectors: [".ads", ".aside"] } } },
        newValue: { sites: { "example.com": { enabled: true, alwaysTranslate: true, selectors: [".content", "article", "article"], excludeSelectors: [".aside", ".ads"] } } },
      },
    }, "local")
    await Promise.resolve()
    await Promise.resolve()

    expect(stopPageTranslationMock).not.toHaveBeenCalled()
    expect(removeTranslatedSubtitlesMock).not.toHaveBeenCalled()
    expect(startPageTranslationMock).not.toHaveBeenCalled()
  })

  it("does not auto-restart on unrelated storage changes after the user manually stops the page", async () => {
    isTopFrameMock.mockReturnValue(true)
    readConfigMock.mockResolvedValue({
      provider: { accessToken: "", relayBaseURL: "https://astra.example/v1" },
      inputTranslation: "enabled",
    })
    readAstraSessionMock.mockResolvedValue({
      sessionToken: "astra-session",
      relayBaseURL: "https://astra.example/v1",
    })
    resolveSiteTranslationSettingsMock.mockReturnValue({
      enabled: true,
      alwaysTranslate: true,
      targetLang: "zh-CN",
      hoverTrigger: "always",
      contentScope: "page",
      presentation: { mode: "bilingual", theme: "default" },
    })
    const browser = getMockBrowser()
    const contentScript = (await import("./index")).default

    await contentScript.main({} as never)
    expect(startPageTranslationMock).toHaveBeenCalledTimes(1)

    getPageTranslationStateMock.mockReturnValue({
      phase: "running",
      sessionId: 2,
      targetLang: "zh-CN",
      lastError: null,
      progress: { totalBlocks: 0, queuedBlocks: 0, inFlightBlocks: 0, translatedBlocks: 0, failedBlocks: 0 },
      presentation: { mode: "bilingual", theme: "default" },
      site: { hostname: "example.com", enabled: true, alwaysTranslate: true },
    })

    await browser.__emitRuntimeMessage(
      { type: "content/stop-translation" },
      { id: "sender" },
      vi.fn(),
    )
    await Promise.resolve()
    await Promise.resolve()

    startPageTranslationMock.mockClear()
    getPageTranslationStateMock.mockReturnValue({
      phase: "idle",
      sessionId: 2,
      targetLang: "zh-CN",
      lastError: null,
      progress: { totalBlocks: 0, queuedBlocks: 0, inFlightBlocks: 0, translatedBlocks: 0, failedBlocks: 0 },
      presentation: { mode: "bilingual", theme: "default" },
      site: { hostname: "example.com", enabled: true, alwaysTranslate: true },
    })

    await browser.__emitStorageChange({
      "astra.config.v1": {
        oldValue: { targetLang: "zh-CN" },
        newValue: { targetLang: "ja" },
      },
    }, "local")
    await Promise.resolve()
    await Promise.resolve()

    expect(startPageTranslationMock).not.toHaveBeenCalled()
  })

  it("clears page-level suppression when always translate becomes eligible again", async () => {
    isTopFrameMock.mockReturnValue(true)
    readConfigMock.mockResolvedValue({
      provider: { accessToken: "", relayBaseURL: "https://astra.example/v1" },
      inputTranslation: "enabled",
    })
    readAstraSessionMock.mockResolvedValue({
      sessionToken: "astra-session",
      relayBaseURL: "https://astra.example/v1",
    })
    resolveSiteTranslationSettingsMock.mockReturnValue({
      enabled: true,
      alwaysTranslate: true,
      targetLang: "zh-CN",
      hoverTrigger: "always",
      contentScope: "page",
      presentation: { mode: "bilingual", theme: "default" },
    })
    const browser = getMockBrowser()
    const contentScript = (await import("./index")).default

    await contentScript.main({} as never)

    getPageTranslationStateMock.mockReturnValue({
      phase: "running",
      sessionId: 2,
      targetLang: "zh-CN",
      lastError: null,
      progress: { totalBlocks: 0, queuedBlocks: 0, inFlightBlocks: 0, translatedBlocks: 0, failedBlocks: 0 },
      presentation: { mode: "bilingual", theme: "default" },
      site: { hostname: "example.com", enabled: true, alwaysTranslate: true },
    })

    await browser.__emitRuntimeMessage(
      { type: "content/stop-translation" },
      { id: "sender" },
      vi.fn(),
    )
    await Promise.resolve()
    await Promise.resolve()

    startPageTranslationMock.mockClear()
    getPageTranslationStateMock.mockReturnValue({
      phase: "idle",
      sessionId: 2,
      targetLang: "zh-CN",
      lastError: null,
      progress: { totalBlocks: 0, queuedBlocks: 0, inFlightBlocks: 0, translatedBlocks: 0, failedBlocks: 0 },
      presentation: { mode: "bilingual", theme: "default" },
      site: { hostname: "example.com", enabled: false, alwaysTranslate: false },
    })
    resolveSiteTranslationSettingsMock.mockReturnValueOnce({
      enabled: false,
      alwaysTranslate: false,
      targetLang: "zh-CN",
      hoverTrigger: "always",
      contentScope: "page",
      presentation: { mode: "bilingual", theme: "default" },
    })

    await browser.__emitStorageChange({
      "astra.config.v1": {
        oldValue: { sites: { "example.com": { enabled: true, alwaysTranslate: true } } },
        newValue: { sites: { "example.com": { enabled: false, alwaysTranslate: false } } },
      },
    }, "local")
    await Promise.resolve()
    await Promise.resolve()

    resolveSiteTranslationSettingsMock.mockReturnValue({
      enabled: true,
      alwaysTranslate: true,
      targetLang: "zh-CN",
      hoverTrigger: "always",
      contentScope: "page",
      presentation: { mode: "bilingual", theme: "default" },
    })
    await browser.__emitStorageChange({
      "astra.config.v1": {
        oldValue: { sites: { "example.com": { enabled: false, alwaysTranslate: false } } },
        newValue: { sites: { "example.com": { enabled: true, alwaysTranslate: true } } },
      },
    }, "local")
    await Promise.resolve()
    await Promise.resolve()

    expect(startPageTranslationMock).toHaveBeenCalledTimes(1)
  })

  it("restarts an active session when the effective provider changes", async () => {
    isTopFrameMock.mockReturnValue(true)
    readConfigMock.mockResolvedValueOnce({
      provider: {
        id: "openai",
        apiKey: "direct-openai-key",
        accessToken: "astra-session",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
      inputTranslation: "enabled",
    }).mockResolvedValueOnce({
      provider: {
        id: "openai",
        apiKey: "",
        accessToken: "astra-session",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
      inputTranslation: "enabled",
    }).mockResolvedValueOnce({
      provider: {
        id: "openai",
        apiKey: "",
        accessToken: "astra-session",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
      inputTranslation: "enabled",
    })
    readAstraSessionMock.mockResolvedValue({
      sessionToken: "astra-session",
      relayBaseURL: "https://astra.example/v1",
    })
    resolveSiteTranslationSettingsMock.mockReturnValue({
      enabled: true,
      alwaysTranslate: true,
      targetLang: "ja",
      hoverTrigger: "always",
      contentScope: "page",
      presentation: { mode: "translation-only", theme: "default" },
      selectors: ["article", ".content"],
    })
    const browser = getMockBrowser()
    const contentModule = await import("./index")

    await contentModule.default.main({} as never)

    startPageTranslationMock.mockClear()
    stopPageTranslationMock.mockClear()
    removeTranslatedSubtitlesMock.mockClear()
    getPageTranslationStateMock.mockReturnValue({
      phase: "running",
      sessionId: 2,
      targetLang: "zh-CN",
      lastError: null,
      progress: { totalBlocks: 0, queuedBlocks: 0, inFlightBlocks: 0, translatedBlocks: 0, failedBlocks: 0 },
      presentation: { mode: "bilingual", theme: "default" },
      site: { hostname: "example.com", enabled: true, alwaysTranslate: true },
    })

    await browser.__emitStorageChange({
      "astra.config.v1": {
        oldValue: { provider: { id: "openai", apiKey: "direct-openai-key" } },
        newValue: { provider: { id: "openai", apiKey: "" } },
      },
    }, "local")
    await Promise.resolve()
    await Promise.resolve()

    expect(stopPageTranslationMock).toHaveBeenCalledTimes(1)
    expect(removeTranslatedSubtitlesMock).toHaveBeenCalledTimes(1)
    expect(startPageTranslationMock).toHaveBeenCalledTimes(1)
    expect(startPageTranslationMock).toHaveBeenCalledWith({
      targetLang: "ja",
      contentScope: "page",
      translationMode: "translation-only",
      translationTheme: "default",
      selectors: [".content", "article"],
      excludeSelectors: undefined,
      paragraphMinLength: undefined,
    })

    contentModule.__resetContentEntrypointForTests()
  })

  it("restarts an active session exactly once when provider and translation-affecting site settings change together", async () => {
    isTopFrameMock.mockReturnValue(true)
    readConfigMock.mockResolvedValueOnce({
      provider: {
        id: "openai",
        apiKey: "direct-openai-key",
        accessToken: "astra-session",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
      inputTranslation: "enabled",
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: true,
          selectors: ["article"],
        },
      },
    }).mockResolvedValueOnce({
      provider: {
        id: "openai",
        apiKey: "",
        accessToken: "astra-session",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
      inputTranslation: "enabled",
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: true,
          targetLang: "ja",
          selectors: ["article", ".content"],
          presentation: { mode: "translation-only" },
        },
      },
    })
    readAstraSessionMock.mockResolvedValue({
      sessionToken: "astra-session",
      relayBaseURL: "https://astra.example/v1",
    })
    resolveSiteTranslationSettingsMock.mockReturnValueOnce({
      enabled: true,
      alwaysTranslate: true,
      targetLang: "zh-CN",
      hoverTrigger: "always",
      contentScope: "page",
      presentation: { mode: "bilingual", theme: "default" },
      selectors: ["article"],
    }).mockReturnValue({
      enabled: true,
      alwaysTranslate: true,
      targetLang: "ja",
      hoverTrigger: "always",
      contentScope: "page",
      presentation: { mode: "translation-only", theme: "default" },
      selectors: ["article", ".content"],
    })
    const browser = getMockBrowser()
    const contentModule = await import("./index")

    await contentModule.default.main({} as never)

    startPageTranslationMock.mockClear()
    stopPageTranslationMock.mockClear()
    removeTranslatedSubtitlesMock.mockClear()
    getPageTranslationStateMock.mockReturnValue({
      phase: "running",
      sessionId: 2,
      targetLang: "zh-CN",
      lastError: null,
      progress: { totalBlocks: 0, queuedBlocks: 0, inFlightBlocks: 0, translatedBlocks: 0, failedBlocks: 0 },
      presentation: { mode: "bilingual", theme: "default" },
      site: { hostname: "example.com", enabled: true, alwaysTranslate: true },
    })

    await browser.__emitStorageChange({
      "astra.config.v1": {
        oldValue: {
          provider: { id: "openai", apiKey: "direct-openai-key" },
          sites: { "example.com": { enabled: true, alwaysTranslate: true, selectors: ["article"] } },
        },
        newValue: {
          provider: { id: "openai", apiKey: "" },
          sites: {
            "example.com": {
              enabled: true,
              alwaysTranslate: true,
              targetLang: "ja",
              selectors: ["article", ".content"],
              presentation: { mode: "translation-only" },
            },
          },
        },
      },
    }, "local")
    await Promise.resolve()
    await Promise.resolve()

    expect(stopPageTranslationMock).toHaveBeenCalledTimes(1)
    expect(removeTranslatedSubtitlesMock).toHaveBeenCalledTimes(1)
    expect(startPageTranslationMock).toHaveBeenCalledTimes(1)
    expect(startPageTranslationMock).toHaveBeenCalledWith({
      targetLang: "ja",
      contentScope: "page",
      translationMode: "translation-only",
      translationTheme: "default",
      selectors: [".content", "article"],
      excludeSelectors: undefined,
      paragraphMinLength: undefined,
    })

    contentModule.__resetContentEntrypointForTests()
  })

  it("stops an active session when provider access becomes unavailable", async () => {
    isTopFrameMock.mockReturnValue(true)
    readConfigMock.mockResolvedValueOnce({
      provider: {
        id: "openai",
        apiKey: "direct-openai-key",
        accessToken: "astra-session",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
      inputTranslation: "enabled",
    }).mockResolvedValueOnce({
      provider: {
        id: "openai",
        apiKey: "",
        accessToken: "",
        relayBaseURL: undefined,
        model: "gpt-5.4-nano",
      },
      inputTranslation: "enabled",
    }).mockResolvedValueOnce({
      provider: {
        id: "openai",
        apiKey: "",
        accessToken: "",
        relayBaseURL: undefined,
        model: "gpt-5.4-nano",
      },
      inputTranslation: "enabled",
    })
    readAstraSessionMock.mockResolvedValueOnce({
      sessionToken: "astra-session",
      relayBaseURL: "https://astra.example/v1",
    }).mockResolvedValueOnce(null).mockResolvedValueOnce(null)
    resolveSiteTranslationSettingsMock.mockReturnValue({
      enabled: true,
      alwaysTranslate: true,
      targetLang: "zh-CN",
      hoverTrigger: "always",
      contentScope: "page",
      presentation: { mode: "bilingual", theme: "default" },
    })
    const browser = getMockBrowser()
    const contentModule = await import("./index")

    await contentModule.default.main({} as never)

    startPageTranslationMock.mockClear()
    stopPageTranslationMock.mockClear()
    removeTranslatedSubtitlesMock.mockClear()
    getPageTranslationStateMock.mockReturnValue({
      phase: "running",
      sessionId: 2,
      targetLang: "zh-CN",
      lastError: null,
      progress: { totalBlocks: 0, queuedBlocks: 0, inFlightBlocks: 0, translatedBlocks: 0, failedBlocks: 0 },
      presentation: { mode: "bilingual", theme: "default" },
      site: { hostname: "example.com", enabled: true, alwaysTranslate: true },
    })

    await browser.__emitStorageChange({
      "astra.auth.v1": {
        oldValue: { sessionToken: "astra-session", relayBaseURL: "https://astra.example/v1" },
        newValue: null,
      },
    }, "local")
    await Promise.resolve()
    await Promise.resolve()

    expect(stopPageTranslationMock).toHaveBeenCalledTimes(1)
    expect(removeTranslatedSubtitlesMock).toHaveBeenCalledTimes(1)
    expect(startPageTranslationMock).not.toHaveBeenCalled()

    contentModule.__resetContentEntrypointForTests()
  })

  it("coalesces rapid SPA navigations into a single delayed restart", async () => {
    vi.useFakeTimers()
    try {
      isTopFrameMock.mockReturnValue(true)
      readConfigMock.mockResolvedValue({
        provider: { accessToken: "", relayBaseURL: "https://astra.example/v1" },
        inputTranslation: "enabled",
      })
      readAstraSessionMock.mockResolvedValue({
        sessionToken: "astra-session",
        relayBaseURL: "https://astra.example/v1",
      })
      resolveSiteTranslationSettingsMock.mockReturnValue({
        enabled: true,
        alwaysTranslate: false,
        targetLang: "ja",
        hoverTrigger: "always",
        contentScope: "page",
        presentation: { mode: "translation-only", theme: "default" },
        selectors: ["article", ".content"],
      })

      window.history.replaceState({}, "", "/article-basic")
      const contentModule = await import("./index")
      await contentModule.default.main({} as never)

      startPageTranslationMock.mockClear()
      stopPageTranslationMock.mockClear()
      removeTranslatedSubtitlesMock.mockClear()
      getPageTranslationStateMock.mockReturnValue({
        phase: "running",
        sessionId: 2,
        targetLang: "zh-CN",
        lastError: null,
        progress: { totalBlocks: 0, queuedBlocks: 0, inFlightBlocks: 0, translatedBlocks: 0, failedBlocks: 0 },
        presentation: { mode: "bilingual", theme: "default" },
        site: { hostname: "example.com", enabled: true, alwaysTranslate: false },
      })

      window.history.pushState({}, "", "/spa-first")
      await vi.advanceTimersByTimeAsync(300)
      expect(startPageTranslationMock).not.toHaveBeenCalled()

      window.history.pushState({}, "", "/spa-second")
      await vi.advanceTimersByTimeAsync(299)
      expect(startPageTranslationMock).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1)
      expect(startPageTranslationMock).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(499)
      expect(startPageTranslationMock).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1)
      expect(stopPageTranslationMock).toHaveBeenCalledTimes(2)
      expect(removeTranslatedSubtitlesMock).toHaveBeenCalledTimes(2)
      expect(startPageTranslationMock).toHaveBeenCalledTimes(1)
      expect(startPageTranslationMock).toHaveBeenCalledWith({
        targetLang: "ja",
        contentScope: "page",
        translationMode: "translation-only",
        translationTheme: "default",
        selectors: [".content", "article"],
        excludeSelectors: undefined,
        paragraphMinLength: undefined,
      })

      await vi.advanceTimersByTimeAsync(500)
      expect(startPageTranslationMock).toHaveBeenCalledTimes(1)

      contentModule.__resetContentEntrypointForTests()
    } finally {
      vi.useRealTimers()
    }
  })

  it("ignores stale storage reconciles that resolve after a newer site update", async () => {
    const session = {
      sessionToken: "astra-session",
      relayBaseURL: "https://astra.example/v1",
    }
    const initialConfig = {
      provider: { accessToken: "", relayBaseURL: "https://astra.example/v1" },
      inputTranslation: "enabled",
      __siteSettings: {
        enabled: true,
        alwaysTranslate: true,
        targetLang: "zh-CN",
        hoverTrigger: "always",
        contentScope: "page",
        presentation: { mode: "bilingual", theme: "default" },
      },
    }
    const staleConfig = {
      provider: { accessToken: "", relayBaseURL: "https://astra.example/v1" },
      inputTranslation: "enabled",
      __siteSettings: {
        enabled: false,
        alwaysTranslate: false,
        targetLang: "zh-CN",
        hoverTrigger: "always",
        contentScope: "page",
        presentation: { mode: "bilingual", theme: "default" },
      },
    }
    const latestConfig = {
      provider: { accessToken: "", relayBaseURL: "https://astra.example/v1" },
      inputTranslation: "enabled",
      __siteSettings: {
        enabled: true,
        alwaysTranslate: true,
        targetLang: "ja",
        hoverTrigger: "always",
        contentScope: "page",
        presentation: { mode: "translation-only", theme: "default" },
        selectors: ["article", ".content"],
      },
    }
    let resolveSlowConfig: ((value: typeof staleConfig) => void) | undefined
    let resolveSlowSession: ((value: typeof session) => void) | undefined
    const slowConfigPromise = new Promise<typeof staleConfig>((resolve) => {
      resolveSlowConfig = resolve
    })
    const slowSessionPromise = new Promise<typeof session>((resolve) => {
      resolveSlowSession = resolve
    })

    isTopFrameMock.mockReturnValue(true)
    readConfigMock
      .mockImplementationOnce(() => Promise.resolve(initialConfig))
      .mockImplementationOnce(() => slowConfigPromise)
      .mockImplementation(() => Promise.resolve(latestConfig))
    readAstraSessionMock
      .mockImplementationOnce(() => Promise.resolve(session))
      .mockImplementationOnce(() => slowSessionPromise)
      .mockImplementation(() => Promise.resolve(session))
    resolveSiteTranslationSettingsMock.mockImplementation((config) => {
      const siteSettings = (config as typeof initialConfig).__siteSettings
      if (!siteSettings) {
        throw new Error("missing test site settings")
      }
      return siteSettings
    })

    const browser = getMockBrowser()
    const contentModule = await import("./index")

    await contentModule.default.main({} as never)
    expect(startPageTranslationMock).toHaveBeenCalledTimes(1)

    startPageTranslationMock.mockClear()
    stopPageTranslationMock.mockClear()
    removeTranslatedSubtitlesMock.mockClear()
    getPageTranslationStateMock.mockReturnValue({
      phase: "running",
      sessionId: 2,
      targetLang: "zh-CN",
      lastError: null,
      progress: { totalBlocks: 0, queuedBlocks: 0, inFlightBlocks: 0, translatedBlocks: 0, failedBlocks: 0 },
      presentation: { mode: "bilingual", theme: "default" },
      site: { hostname: "example.com", enabled: true, alwaysTranslate: true },
    })

    void browser.__emitStorageChange({
      "astra.config.v1": {
        oldValue: { sites: { "example.com": { enabled: true, alwaysTranslate: true } } },
        newValue: { sites: { "example.com": { enabled: false, alwaysTranslate: false } } },
      },
    }, "local")
    await Promise.resolve()
    await browser.__emitStorageChange({
      "astra.config.v1": {
        oldValue: { sites: { "example.com": { enabled: false, alwaysTranslate: false } } },
        newValue: { sites: { "example.com": { enabled: true, alwaysTranslate: true, targetLang: "ja", presentation: { mode: "translation-only" }, selectors: ["article", ".content"] } } },
      },
    }, "local")
    await Promise.resolve()
    await Promise.resolve()

    expect(stopPageTranslationMock).toHaveBeenCalledTimes(1)
    expect(removeTranslatedSubtitlesMock).toHaveBeenCalledTimes(1)
    expect(startPageTranslationMock).toHaveBeenCalledTimes(1)
    expect(startPageTranslationMock).toHaveBeenCalledWith({
      targetLang: "ja",
      contentScope: "page",
      translationMode: "translation-only",
      translationTheme: "default",
      selectors: [".content", "article"],
      excludeSelectors: undefined,
      paragraphMinLength: undefined,
    })

    resolveSlowConfig?.(staleConfig)
    resolveSlowSession?.(session)
    await Promise.resolve()
    await Promise.resolve()

    expect(stopPageTranslationMock).toHaveBeenCalledTimes(1)
    expect(removeTranslatedSubtitlesMock).toHaveBeenCalledTimes(1)
    expect(startPageTranslationMock).toHaveBeenCalledTimes(1)
    expect(resolveSiteTranslationSettingsMock).toHaveBeenCalledTimes(2)

    contentModule.__resetContentEntrypointForTests()
  })
})
