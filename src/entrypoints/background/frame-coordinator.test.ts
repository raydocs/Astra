import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_TRANSLATION_PRESENTATION } from "@/types/translation"

const {
  getAllFramesMock,
  onCompletedAddListenerMock,
  onRemovedAddListenerMock,
  sendMessageMock,
} = vi.hoisted(() => ({
  getAllFramesMock: vi.fn(),
  onCompletedAddListenerMock: vi.fn(),
  onRemovedAddListenerMock: vi.fn(),
  sendMessageMock: vi.fn(),
}))

vi.mock("#imports", () => ({
  browser: {
    webNavigation: {
      getAllFrames: getAllFramesMock,
      onCompleted: {
        addListener: onCompletedAddListenerMock,
      },
    },
    tabs: {
      sendMessage: sendMessageMock,
      onRemoved: {
        addListener: onRemovedAddListenerMock,
      },
    },
  },
  defineBackground: vi.fn(),
}))

import { __resetFrameCoordinatorForTests, executeTabCommand, initializeFrameCoordinator } from "./frame-coordinator"

function createSnapshot(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  }
}

describe("frame-coordinator", () => {
  beforeEach(() => {
    __resetFrameCoordinatorForTests()
    vi.clearAllMocks()
  })

  afterEach(() => {
    __resetFrameCoordinatorForTests()
    vi.restoreAllMocks()
  })

  it("returns CONTENT_UNAVAILABLE when no translatable frames exist", async () => {
    getAllFramesMock.mockResolvedValue([
      { frameId: 0, parentFrameId: -1, url: "about:blank" },
    ])

    const result = await executeTabCommand(1, { type: "content/get-translation-state" })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("CONTENT_UNAVAILABLE")
    }
  })

  it("returns single frame response with frame count when only one frame", async () => {
    const snapshot = createSnapshot({ phase: "running", progress: { totalBlocks: 5, queuedBlocks: 2, inFlightBlocks: 1, translatedBlocks: 2, failedBlocks: 0 } })
    getAllFramesMock.mockResolvedValue([
      { frameId: 0, parentFrameId: -1, url: "https://example.com/page" },
    ])
    sendMessageMock.mockResolvedValue({ ok: true, state: snapshot })

    const result = await executeTabCommand(1, { type: "content/get-translation-state" })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.state.framesTotal).toBe(1)
      expect(result.state.framesTranslating).toBe(1)
      expect(result.state.progress.totalBlocks).toBe(5)
    }
  })

  it("aggregates progress from multiple frames", async () => {
    const topSnapshot = createSnapshot({
      phase: "running",
      progress: { totalBlocks: 10, queuedBlocks: 2, inFlightBlocks: 1, translatedBlocks: 7, failedBlocks: 0 },
    })
    const childSnapshot = createSnapshot({
      phase: "running",
      progress: { totalBlocks: 8, queuedBlocks: 1, inFlightBlocks: 0, translatedBlocks: 6, failedBlocks: 1 },
    })

    getAllFramesMock.mockResolvedValue([
      { frameId: 0, parentFrameId: -1, url: "https://example.com/page" },
      { frameId: 1, parentFrameId: 0, url: "https://example.com/iframe" },
    ])
    sendMessageMock
      .mockResolvedValueOnce({ ok: true, state: topSnapshot })
      .mockResolvedValueOnce({ ok: true, state: childSnapshot })

    const result = await executeTabCommand(1, { type: "content/start-translation" })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.state.framesTotal).toBe(2)
      expect(result.state.framesTranslating).toBe(2)
      expect(result.state.progress).toEqual({
        totalBlocks: 18,
        queuedBlocks: 3,
        inFlightBlocks: 1,
        translatedBlocks: 13,
        failedBlocks: 1,
      })
      expect(result.state.phase).toBe("running")
    }
  })

  it("aggregate phase is running if any frame is running", async () => {
    const topSnapshot = createSnapshot({ phase: "idle" })
    const childSnapshot = createSnapshot({ phase: "running" })

    getAllFramesMock.mockResolvedValue([
      { frameId: 0, parentFrameId: -1, url: "https://example.com/" },
      { frameId: 1, parentFrameId: 0, url: "https://example.com/embed" },
    ])
    sendMessageMock
      .mockResolvedValueOnce({ ok: true, state: topSnapshot })
      .mockResolvedValueOnce({ ok: true, state: childSnapshot })

    const result = await executeTabCommand(1, { type: "content/get-translation-state" })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.state.phase).toBe("running")
    }
  })

  it("handles frame communication failures gracefully", async () => {
    const topSnapshot = createSnapshot({ phase: "running" })

    getAllFramesMock.mockResolvedValue([
      { frameId: 0, parentFrameId: -1, url: "https://example.com/" },
      { frameId: 1, parentFrameId: 0, url: "https://other.com/frame" },
    ])
    sendMessageMock
      .mockResolvedValueOnce({ ok: true, state: topSnapshot })
      .mockRejectedValueOnce(new Error("Could not establish connection"))

    const result = await executeTabCommand(1, { type: "content/get-translation-state" })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.state.framesTotal).toBe(2)
      expect(result.state.framesTranslating).toBe(1)
      // Only top frame reported; unreachable child remains visible via frame boundary count.
      expect(result.state.phase).toBe("running")
    }
  })

  it("keeps cross-origin unreachable frames as visible boundaries without failing the tab", async () => {
    const topSnapshot = createSnapshot({
      phase: "running",
      progress: { totalBlocks: 4, queuedBlocks: 0, inFlightBlocks: 1, translatedBlocks: 3, failedBlocks: 0 },
    })

    getAllFramesMock.mockResolvedValue([
      { frameId: 0, parentFrameId: -1, url: "https://example.com/article" },
      { frameId: 7, parentFrameId: 0, url: "https://cross-origin.example/frame" },
    ])
    sendMessageMock
      .mockResolvedValueOnce({ ok: true, state: topSnapshot })
      .mockRejectedValueOnce(new Error("Frame is cross-origin or not injected"))

    const result = await executeTabCommand(99, { type: "content/start-translation" })

    expect(sendMessageMock).toHaveBeenCalledWith(99, { type: "content/start-translation" }, { frameId: 7 })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.state.framesTotal).toBe(2)
      expect(result.state.framesTranslating).toBe(1)
      expect(result.state.progress).toEqual(topSnapshot.progress)
      expect(result.state.site.hostname).toBe("example.com")
    }
  })

  it("filters out non-HTTP frames", async () => {
    getAllFramesMock.mockResolvedValue([
      { frameId: 0, parentFrameId: -1, url: "https://example.com/" },
      { frameId: 1, parentFrameId: 0, url: "about:blank" },
      { frameId: 2, parentFrameId: 0, url: "chrome-extension://abc/page.html" },
    ])
    sendMessageMock.mockResolvedValue({ ok: true, state: createSnapshot() })

    const result = await executeTabCommand(1, { type: "content/get-translation-state" })

    // Only one http frame, so sendMessage called once
    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    expect(sendMessageMock).toHaveBeenCalledWith(
      1,
      { type: "content/get-translation-state" },
      { frameId: 0 },
    )
  })

  it("sends command to each frame with its frameId", async () => {
    getAllFramesMock.mockResolvedValue([
      { frameId: 0, parentFrameId: -1, url: "https://a.com/" },
      { frameId: 3, parentFrameId: 0, url: "https://b.com/frame" },
    ])
    sendMessageMock.mockResolvedValue({ ok: true, state: createSnapshot() })

    await executeTabCommand(42, { type: "content/stop-translation" })

    expect(sendMessageMock).toHaveBeenCalledTimes(2)
    expect(sendMessageMock).toHaveBeenCalledWith(42, { type: "content/stop-translation" }, { frameId: 0 })
    expect(sendMessageMock).toHaveBeenCalledWith(42, { type: "content/stop-translation" }, { frameId: 3 })
  })

  it("prefers the top frame snapshot for metadata even when frames are returned out of order", async () => {
    const childSnapshot = createSnapshot({
      targetLang: "fr",
      site: { hostname: "embed.example.com", enabled: true, alwaysTranslate: false },
    })
    const topSnapshot = createSnapshot({
      targetLang: "zh-CN",
      site: { hostname: "example.com", enabled: true, alwaysTranslate: false },
    })

    getAllFramesMock.mockResolvedValue([
      { frameId: 5, parentFrameId: 0, url: "https://embed.example.com/frame" },
      { frameId: 0, parentFrameId: -1, url: "https://example.com/page" },
    ])
    sendMessageMock
      .mockResolvedValueOnce({ ok: true, state: childSnapshot })
      .mockResolvedValueOnce({ ok: true, state: topSnapshot })

    const result = await executeTabCommand(1, { type: "content/get-translation-state" })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.state.targetLang).toBe("zh-CN")
      expect(result.state.site.hostname).toBe("example.com")
    }
  })

  it("does not trust child-frame metadata when the top frame does not respond", async () => {
    const childSnapshot = createSnapshot({
      phase: "running",
      targetLang: "fr",
      site: { hostname: "embed.example.com", enabled: true, alwaysTranslate: false },
    })

    getAllFramesMock.mockResolvedValue([
      { frameId: 0, parentFrameId: -1, url: "https://example.com/page" },
      { frameId: 5, parentFrameId: 0, url: "https://embed.example.com/frame" },
    ])
    sendMessageMock
      .mockRejectedValueOnce(new Error("top frame unavailable"))
      .mockResolvedValueOnce({ ok: true, state: childSnapshot })

    const result = await executeTabCommand(1, { type: "content/get-translation-state" })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.state.targetLang).toBeNull()
      expect(result.state.site.hostname).toBe("example.com")
      expect(result.state.presentation).toEqual(DEFAULT_TRANSLATION_PRESENTATION)
      expect(result.state.progress.totalBlocks).toBe(0)
      expect(result.state.phase).toBe("running")
    }
  })

  it("starts late-arriving child frames while a tab translation is active", async () => {
    initializeFrameCoordinator()
    const command = { type: "content/start-translation", payload: { contentScope: "page" } } as const
    getAllFramesMock.mockResolvedValue([
      { frameId: 0, parentFrameId: -1, url: "https://example.com/page" },
    ])
    sendMessageMock.mockResolvedValue({ ok: true, state: createSnapshot({ phase: "running" }) })

    await executeTabCommand(12, command)
    expect(onCompletedAddListenerMock).toHaveBeenCalledTimes(1)

    sendMessageMock.mockClear()
    const [listener] = onCompletedAddListenerMock.mock.calls[0] as [
      (details: { tabId: number; frameId: number; parentFrameId: number; url?: string }) => void,
    ]
    listener({ tabId: 12, frameId: 4, parentFrameId: 0, url: "https://embed.example.com/late" })
    await Promise.resolve()

    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    expect(sendMessageMock).toHaveBeenCalledWith(12, command, { frameId: 4 })

    listener({ tabId: 12, frameId: 4, parentFrameId: 0, url: "https://embed.example.com/late" })
    await Promise.resolve()
    expect(sendMessageMock).toHaveBeenCalledTimes(1)
  })

  it("clears active tab translation tracking on stop, top-frame navigation, and tab removal", async () => {
    initializeFrameCoordinator()
    const startCommand = { type: "content/start-translation", payload: { contentScope: "page" } } as const
    getAllFramesMock.mockResolvedValue([
      { frameId: 0, parentFrameId: -1, url: "https://example.com/page" },
    ])
    sendMessageMock.mockResolvedValue({ ok: true, state: createSnapshot({ phase: "running" }) })

    await executeTabCommand(21, startCommand)
    const [navigationListener] = onCompletedAddListenerMock.mock.calls[0] as [
      (details: { tabId: number; frameId: number; parentFrameId: number; url?: string }) => void,
    ]
    const [tabRemovedListener] = onRemovedAddListenerMock.mock.calls[0] as [(tabId: number) => void]

    sendMessageMock.mockClear()
    await executeTabCommand(21, { type: "content/stop-translation" })
    navigationListener({ tabId: 21, frameId: 9, parentFrameId: 0, url: "https://embed.example.com/late" })
    await Promise.resolve()
    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    expect(sendMessageMock).toHaveBeenCalledWith(21, { type: "content/stop-translation" }, { frameId: 0 })

    await executeTabCommand(21, startCommand)
    sendMessageMock.mockClear()
    navigationListener({ tabId: 21, frameId: 0, parentFrameId: -1, url: "https://example.com/next" })
    navigationListener({ tabId: 21, frameId: 10, parentFrameId: 0, url: "https://embed.example.com/after-nav" })
    await Promise.resolve()
    expect(sendMessageMock).not.toHaveBeenCalled()

    await executeTabCommand(21, startCommand)
    sendMessageMock.mockClear()
    tabRemovedListener(21)
    navigationListener({ tabId: 21, frameId: 11, parentFrameId: 0, url: "https://embed.example.com/after-close" })
    await Promise.resolve()
    expect(sendMessageMock).not.toHaveBeenCalled()
  })
})
