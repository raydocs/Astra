import { beforeEach, describe, expect, it, vi } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"

function getMockBrowser(): ReturnType<typeof createMockBrowser> {
  return (globalThis as unknown as { __ASTRA_TEST_BROWSER__: ReturnType<typeof createMockBrowser> })
    .__ASTRA_TEST_BROWSER__
}

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
})
