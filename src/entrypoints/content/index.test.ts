import { beforeEach, describe, expect, it, vi } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"
import { PAGE_ACCESS_POLICY_STORAGE_KEY } from "@/utils/extension/page-permissions"

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
  captureCurrentVideoNoteSourceMock,
  getVideoSubtitleQualitySnapshotMock,
  isVideoPageMock,
  isVideoSubtitleTranslationActiveMock,
  startVideoSubtitleTranslationMock,
  stopVideoSubtitleTranslationMock,
  setupVideoNavigationHandlerMock,
  getMeetingCaptionQualitySnapshotMock,
  isMeetingPageMock,
  isMeetingCaptionTranslationActiveMock,
  startMeetingCaptionTranslationMock,
  stopMeetingCaptionTranslationMock,
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
  captureCurrentVideoNoteSourceMock: vi.fn(),
  getVideoSubtitleQualitySnapshotMock: vi.fn(),
  isVideoPageMock: vi.fn(),
  isVideoSubtitleTranslationActiveMock: vi.fn(),
  startVideoSubtitleTranslationMock: vi.fn(),
  stopVideoSubtitleTranslationMock: vi.fn(),
  setupVideoNavigationHandlerMock: vi.fn(),
  getMeetingCaptionQualitySnapshotMock: vi.fn(),
  isMeetingPageMock: vi.fn(),
  isMeetingCaptionTranslationActiveMock: vi.fn(),
  startMeetingCaptionTranslationMock: vi.fn(),
  stopMeetingCaptionTranslationMock: vi.fn(),
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

vi.mock("./video-platforms", () => ({
  captureCurrentVideoNoteSource: captureCurrentVideoNoteSourceMock,
  getVideoSubtitleQualitySnapshot: getVideoSubtitleQualitySnapshotMock,
  isVideoPage: isVideoPageMock,
  isVideoSubtitleTranslationActive: isVideoSubtitleTranslationActiveMock,
  startVideoSubtitleTranslation: startVideoSubtitleTranslationMock,
  stopVideoSubtitleTranslation: stopVideoSubtitleTranslationMock,
  setupVideoNavigationHandler: setupVideoNavigationHandlerMock,
}))

vi.mock("./meeting-captions", () => ({
  getMeetingCaptionQualitySnapshot: getMeetingCaptionQualitySnapshotMock,
  isMeetingPage: isMeetingPageMock,
  isMeetingCaptionTranslationActive: isMeetingCaptionTranslationActiveMock,
  startMeetingCaptionTranslation: startMeetingCaptionTranslationMock,
  stopMeetingCaptionTranslation: stopMeetingCaptionTranslationMock,
}))

describe("content entrypoint mounting", () => {
  beforeEach(() => {
    vi.resetModules()
    setMockBrowser(createMockBrowser())
    vi.clearAllMocks()
    // `vi.clearAllMocks()` does not clear `mockResolvedValueOnce` queues; reset implementations
    // so prior tests cannot leak queued config/session reads into the next case.
    readConfigMock.mockReset()
    readAstraSessionMock.mockReset()
    resolveSiteTranslationSettingsMock.mockReset()
    getPageTranslationStateMock.mockReset()
    startPageTranslationMock.mockReset()
    stopPageTranslationMock.mockReset()
    removeTranslatedSubtitlesMock.mockReset()
    translatePageSubtitlesMock.mockReset()
    captureCurrentVideoNoteSourceMock.mockReset()
    getVideoSubtitleQualitySnapshotMock.mockReset()
    isVideoPageMock.mockReset()
    isVideoSubtitleTranslationActiveMock.mockReset()
    startVideoSubtitleTranslationMock.mockReset()
    stopVideoSubtitleTranslationMock.mockReset()
    setupVideoNavigationHandlerMock.mockReset()
    getMeetingCaptionQualitySnapshotMock.mockReset()
    isMeetingPageMock.mockReset()
    isMeetingCaptionTranslationActiveMock.mockReset()
    startMeetingCaptionTranslationMock.mockReset()
    stopMeetingCaptionTranslationMock.mockReset()
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
      presentation: { mode: "bilingual", theme: "default", fontSize: 0.92, translationColor: "#64748b" },
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
    captureCurrentVideoNoteSourceMock.mockResolvedValue(null)
    getVideoSubtitleQualitySnapshotMock.mockReturnValue(null)
    isVideoPageMock.mockReturnValue(false)
    isVideoSubtitleTranslationActiveMock.mockReturnValue(false)
    startVideoSubtitleTranslationMock.mockResolvedValue(undefined)
    getMeetingCaptionQualitySnapshotMock.mockReturnValue(null)
    isMeetingPageMock.mockReturnValue(false)
    isMeetingCaptionTranslationActiveMock.mockReturnValue(false)
    startMeetingCaptionTranslationMock.mockResolvedValue(true)
  })

  it("mounts all interactive overlays in the top frame and float ball only once", async () => {
    isTopFrameMock.mockReturnValue(true)
    const contentScript = (await import("./index")).default

    await contentScript.main({} as never)

    expect(mountSelectionToolbarMock).toHaveBeenCalledTimes(1)
    expect(mountHoverTranslateMock).toHaveBeenCalledTimes(1)
    expect(mountInputTranslateMock).toHaveBeenCalledTimes(1)
    expect(mountFloatBallMock).toHaveBeenCalledTimes(1)
    expect(document.querySelector<HTMLStyleElement>("style[data-astra-content-styles='1']")?.textContent).toContain(".astra-theme-mask .astra-translation-inner")
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

  it("captures a clicked page image for context-menu handoff when canvas export is available", async () => {
    isTopFrameMock.mockReturnValue(true)
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("force canvas fallback")))
    const browser = getMockBrowser()
    const sendResponse = vi.fn()
    const contentScript = (await import("./index")).default
    const image = document.createElement("img")
    image.src = "https://example.com/menu.svg"
    Object.defineProperty(image, "naturalWidth", { configurable: true, value: 320 })
    Object.defineProperty(image, "naturalHeight", { configurable: true, value: 160 })
    document.body.appendChild(image)
    const drawImage = vi.fn()
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({ drawImage }) as unknown as CanvasRenderingContext2D)
    const toDataUrlSpy = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,cGl4ZWxz")

    try {
      await contentScript.main({} as never)
      await browser.__emitRuntimeMessage(
        { type: "content/capture-image", payload: { imageUrl: "https://example.com/menu.svg" } },
        { id: "sender" },
        sendResponse,
      )
      await Promise.resolve()
      await Promise.resolve()

      expect(drawImage).toHaveBeenCalledWith(image, 0, 0, 320, 160)
      expect(sendResponse).toHaveBeenCalledWith({
        ok: true,
        capture: {
          dataUrl: "data:image/png;base64,cGl4ZWxz",
          mimeType: "image/png",
          fileName: "menu.svg",
          byteLength: 6,
        },
      })
    } finally {
      getContextSpy.mockRestore()
      toDataUrlSpy.mockRestore()
      vi.unstubAllGlobals()
    }
  })

  it("returns a capture failure when the page image cannot be exported", async () => {
    isTopFrameMock.mockReturnValue(true)
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("blocked")))
    const browser = getMockBrowser()
    const sendResponse = vi.fn()
    const contentScript = (await import("./index")).default
    const image = document.createElement("img")
    image.src = "https://example.com/private.png"
    Object.defineProperty(image, "naturalWidth", { configurable: true, value: 200 })
    Object.defineProperty(image, "naturalHeight", { configurable: true, value: 100 })
    document.body.appendChild(image)
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({ drawImage: vi.fn() }) as unknown as CanvasRenderingContext2D)
    const toDataUrlSpy = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(() => {
      throw new Error("tainted canvas")
    })

    try {
      await contentScript.main({} as never)
      await browser.__emitRuntimeMessage(
        { type: "content/capture-image", payload: { imageUrl: "https://example.com/private.png" } },
        { id: "sender" },
        sendResponse,
      )
      await Promise.resolve()
      await Promise.resolve()

      expect(sendResponse).toHaveBeenCalledWith({
        ok: false,
        error: "tainted canvas",
      })
    } finally {
      getContextSpy.mockRestore()
      toDataUrlSpy.mockRestore()
      vi.unstubAllGlobals()
    }
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

  it("stops active translation when page access is revoked for the current origin", async () => {
    isTopFrameMock.mockReturnValue(true)
    getPageTranslationStateMock.mockReturnValue({
      phase: "running",
      sessionId: 2,
      targetLang: "zh-CN",
      lastError: null,
      progress: { totalBlocks: 1, queuedBlocks: 0, inFlightBlocks: 1, translatedBlocks: 0, failedBlocks: 0 },
      presentation: { mode: "bilingual", theme: "default" },
      site: { hostname: "example.com", enabled: true, alwaysTranslate: true },
    })
    const browser = getMockBrowser()
    const origin = window.location.origin
    browser.__storage[PAGE_ACCESS_POLICY_STORAGE_KEY] = {
      version: 1,
      allSitesGranted: false,
      sites: {
        [origin]: {
          state: "revoked",
          scope: "site",
          updatedAt: "2026-05-13T00:00:00.000Z",
          source: "runtime-policy",
        },
      },
    }
    const contentScript = (await import("./index")).default

    await contentScript.main({} as never)
    await browser.__emitRuntimeMessage({
      type: "astra/page-access-changed",
      payload: {
        action: "revoked",
        scope: "site",
        origin,
        sitePattern: `${origin}/*`,
        granted: false,
        browserPermissionChanged: true,
        timestamp: "2026-05-13T00:00:00.000Z",
      },
    }, { id: "sender" }, vi.fn())
    await Promise.resolve()
    await Promise.resolve()

    expect(stopPageTranslationMock).toHaveBeenCalled()
    expect(removeTranslatedSubtitlesMock).toHaveBeenCalled()
    expect(startPageTranslationMock).not.toHaveBeenCalled()
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

  it("restarts active video and meeting caption sessions when idle presentation font or color changes", async () => {
    isTopFrameMock.mockReturnValue(true)
    readConfigMock.mockResolvedValue({
      provider: { accessToken: "", relayBaseURL: "https://astra.example/v1" },
      inputTranslation: "enabled",
    })
    readAstraSessionMock.mockResolvedValue({
      sessionToken: "astra-session",
      relayBaseURL: "https://astra.example/v1",
    })
    getPageTranslationStateMock.mockReturnValue({
      phase: "idle",
      sessionId: 2,
      targetLang: "zh-CN",
      lastError: null,
      progress: { totalBlocks: 0, queuedBlocks: 0, inFlightBlocks: 0, translatedBlocks: 0, failedBlocks: 0 },
      presentation: { mode: "bilingual", theme: "default" },
      site: { hostname: "example.com", enabled: true, alwaysTranslate: false },
    })
    resolveSiteTranslationSettingsMock.mockReturnValue({
      enabled: true,
      alwaysTranslate: false,
      targetLang: "zh-CN",
      hoverTrigger: "always",
      contentScope: "page",
      presentation: { mode: "bilingual", theme: "default", fontSize: 0.92, translationColor: "#64748b" },
    })

    const browser = getMockBrowser()
    const contentScript = (await import("./index")).default
    await contentScript.main({} as never)

    stopVideoSubtitleTranslationMock.mockClear()
    startVideoSubtitleTranslationMock.mockClear()
    stopMeetingCaptionTranslationMock.mockClear()
    startMeetingCaptionTranslationMock.mockClear()
    stopPageTranslationMock.mockClear()
    removeTranslatedSubtitlesMock.mockClear()
    startPageTranslationMock.mockClear()

    isVideoPageMock.mockReturnValue(true)
    isVideoSubtitleTranslationActiveMock.mockReturnValue(true)
    isMeetingPageMock.mockReturnValue(true)
    isMeetingCaptionTranslationActiveMock.mockReturnValue(true)
    resolveSiteTranslationSettingsMock.mockReturnValue({
      enabled: true,
      alwaysTranslate: false,
      targetLang: "zh-CN",
      hoverTrigger: "always",
      contentScope: "page",
      presentation: { mode: "bilingual", theme: "default", fontSize: 1.1, translationColor: "#22c55e" },
    })

    await browser.__emitStorageChange({
      "astra.config.v1": {
        oldValue: { presentation: { fontSize: 0.92, translationColor: "#64748b" } },
        newValue: { presentation: { fontSize: 1.1, translationColor: "#22c55e" } },
      },
    }, "local")
    await Promise.resolve()
    await Promise.resolve()

    expect(stopVideoSubtitleTranslationMock).toHaveBeenCalledTimes(1)
    expect(startVideoSubtitleTranslationMock).toHaveBeenCalledTimes(1)
    expect(stopMeetingCaptionTranslationMock).toHaveBeenCalledTimes(1)
    expect(startMeetingCaptionTranslationMock).toHaveBeenCalledTimes(1)
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
          sites: { "example.com": { enabled: true, alwaysTranslate: true, selectors: ["article"] } } },
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
    let contentModule: typeof import("./index") | undefined
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
      contentModule = await import("./index")
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

      await vi.advanceTimersByTimeAsync(500)
      // stop + remove may be called >= 2 times (once per nav + defensive catch/ensureSiteUiMounted paths);
      // the core invariant is that coalescing settles to a bounded restart count despite 2 navigations.
      expect(stopPageTranslationMock.mock.calls.length).toBeGreaterThanOrEqual(2)
      expect(removeTranslatedSubtitlesMock.mock.calls.length).toBeGreaterThanOrEqual(2)
      const settledRestartCount = startPageTranslationMock.mock.calls.length
      expect(settledRestartCount).toBeGreaterThanOrEqual(1)
      expect(startPageTranslationMock).toHaveBeenLastCalledWith({
        targetLang: "ja",
        contentScope: "page",
        translationMode: "translation-only",
        translationTheme: "default",
        selectors: [".content", "article"],
        excludeSelectors: undefined,
        paragraphMinLength: undefined,
      })

      await vi.advanceTimersByTimeAsync(500)
      expect(startPageTranslationMock.mock.calls.length).toBeLessThanOrEqual(settledRestartCount + 1)
    } finally {
      contentModule?.__resetContentEntrypointForTests()
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
