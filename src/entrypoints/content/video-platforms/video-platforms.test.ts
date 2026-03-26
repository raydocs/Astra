import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../../../test/utils/mockBrowser"

const { runInlineActionMock, readConfigMock, translateTextsMock } = vi.hoisted(() => ({
  runInlineActionMock: vi.fn(),
  readConfigMock: vi.fn(),
  translateTextsMock: vi.fn(),
}))

vi.mock("../inline-actions", () => ({
  runInlineAction: runInlineActionMock,
}))

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
}))

vi.mock("@/utils/translate/translate", () => ({
  translateTexts: translateTextsMock,
}))

import { DEFAULT_ASTRA_CONFIG } from "@/types/config"

import {
  isVideoPage,
  startVideoSubtitleTranslation,
  stopVideoSubtitleTranslation,
  clearVideoSubtitleCache,
} from "./index"

function setLocation(hostname: string, pathname: string) {
  Object.defineProperty(window, "location", {
    value: {
      hostname,
      pathname,
      href: `https://${hostname}${pathname}`,
    },
    writable: true,
    configurable: true,
  })
}

describe("video platform subtitle translation", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setMockBrowser(createMockBrowser())
    readConfigMock.mockResolvedValue(DEFAULT_ASTRA_CONFIG)
    runInlineActionMock.mockResolvedValue({ ok: true, text: "翻译结果" })
    translateTextsMock.mockImplementation(async (req: { texts: string[] }) => ({
      ok: true,
      translations: req.texts.map((t: string) => `[translated] ${t}`),
    }))
    document.body.innerHTML = ""
  })

  afterEach(() => {
    stopVideoSubtitleTranslation()
    clearVideoSubtitleCache()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("detects YouTube video pages", () => {
    setLocation("www.youtube.com", "/watch")
    expect(isVideoPage()).toBe(true)
  })

  it("detects Bilibili video pages", () => {
    setLocation("www.bilibili.com", "/video/BV1234567")
    expect(isVideoPage()).toBe(true)
  })

  it("detects Netflix video pages", () => {
    setLocation("www.netflix.com", "/watch/12345")
    expect(isVideoPage()).toBe(true)
  })

  it("returns false for non-video pages", () => {
    setLocation("www.youtube.com", "/")
    expect(isVideoPage()).toBe(false)
  })

  it("returns false for unknown sites", () => {
    setLocation("www.example.com", "/video/1")
    expect(isVideoPage()).toBe(false)
  })

  it("does not start on non-video pages", async () => {
    setLocation("www.example.com", "/")
    await startVideoSubtitleTranslation()
    expect(document.getElementById("astra-video-subtitle-styles")).toBeNull()
  })

  it("injects styles and observes YouTube captions", async () => {
    setLocation("www.youtube.com", "/watch")
    document.body.innerHTML = `
      <div class="ytp-caption-window-container">
        <div class="ytp-caption-window-bottom">
          <span class="ytp-caption-segment">Hello world</span>
        </div>
      </div>
    `
    await startVideoSubtitleTranslation()
    expect(document.getElementById("astra-video-subtitle-styles")).not.toBeNull()
  })

  it("translates YouTube caption segments", async () => {
    setLocation("www.youtube.com", "/watch")
    document.body.innerHTML = `
      <div class="ytp-caption-window-container">
        <div class="ytp-caption-window-bottom">
          <span class="ytp-caption-segment">Hello world</span>
        </div>
      </div>
    `
    await startVideoSubtitleTranslation()
    await vi.advanceTimersByTimeAsync(100)
    await Promise.resolve()
    await Promise.resolve()

    expect(runInlineActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Hello world",
        task: "translate",
      }),
    )
  })

  it("translates Bilibili subtitle panels", async () => {
    setLocation("www.bilibili.com", "/video/BV1234567")
    document.body.innerHTML = `
      <div class="bpx-player-subtitle-panel">
        <span class="bpx-player-subtitle-panel-text">你好世界</span>
      </div>
    `
    await startVideoSubtitleTranslation()
    await vi.advanceTimersByTimeAsync(100)
    await Promise.resolve()
    await Promise.resolve()

    expect(runInlineActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "你好世界",
        task: "translate",
      }),
    )
  })

  it("translates Netflix timedtext containers", async () => {
    setLocation("www.netflix.com", "/watch/12345")
    document.body.innerHTML = `
      <div class="player-timedtext-text-container">
        <span>Good morning</span>
      </div>
    `
    await startVideoSubtitleTranslation()
    await vi.advanceTimersByTimeAsync(100)
    await Promise.resolve()
    await Promise.resolve()

    expect(runInlineActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Good morning",
        task: "translate",
      }),
    )
  })

  it("caches translations across caption changes", async () => {
    setLocation("www.youtube.com", "/watch")
    document.body.innerHTML = `
      <div class="ytp-caption-window-container">
        <div class="ytp-caption-window-bottom">
          <span class="ytp-caption-segment">Hello</span>
        </div>
      </div>
    `
    await startVideoSubtitleTranslation()
    await vi.advanceTimersByTimeAsync(100)
    await Promise.resolve()
    await Promise.resolve()

    const callCount = runInlineActionMock.mock.calls.length

    // Re-trigger same caption
    const container = document.querySelector(".ytp-caption-window-container")!
    container.innerHTML = `
      <div class="ytp-caption-window-bottom">
        <span class="ytp-caption-segment">Hello</span>
      </div>
    `
    await vi.advanceTimersByTimeAsync(100)
    await Promise.resolve()

    expect(runInlineActionMock.mock.calls.length).toBe(callCount)
  })

  it("cleans up on stop", async () => {
    setLocation("www.youtube.com", "/watch")
    document.body.innerHTML = `
      <div class="ytp-caption-window-container">
        <div class="ytp-caption-window-bottom">
          <span class="ytp-caption-segment">Test</span>
        </div>
      </div>
    `
    await startVideoSubtitleTranslation()
    await vi.advanceTimersByTimeAsync(100)

    stopVideoSubtitleTranslation()

    expect(document.getElementById("astra-video-subtitle-styles")).toBeNull()
    expect(document.querySelectorAll(".astra-video-subtitle").length).toBe(0)
  })

  describe("preload batch translation", () => {
    it("collects captions during preload window and batch-translates them", async () => {
      setLocation("www.youtube.com", "/watch")

      // Make per-cue handler never resolve so it does not cache results
      // before the preload window finishes
      runInlineActionMock.mockReturnValue(new Promise(() => {}))

      document.body.innerHTML = `
        <div class="ytp-caption-window-container">
          <div class="ytp-caption-window-bottom">
            <span class="ytp-caption-segment">First line</span>
          </div>
        </div>
      `
      await startVideoSubtitleTranslation()

      // Simulate new captions appearing during the collection window
      const container = document.querySelector(".ytp-caption-window-container")!
      container.innerHTML = `
        <div class="ytp-caption-window-bottom">
          <span class="ytp-caption-segment">Second line</span>
        </div>
      `
      await vi.advanceTimersByTimeAsync(2000)

      container.innerHTML = `
        <div class="ytp-caption-window-bottom">
          <span class="ytp-caption-segment">Third line</span>
        </div>
      `
      await vi.advanceTimersByTimeAsync(3100)

      // After 5s window, preload should have called translateTexts with collected captions
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()

      expect(translateTextsMock).toHaveBeenCalled()
      const callArgs = translateTextsMock.mock.calls[0][0]
      expect(callArgs.task).toBe("translate")
      // Should contain at least one of the caption texts
      expect(callArgs.texts.length).toBeGreaterThan(0)
    })

    it("does not batch-translate texts already in cache", async () => {
      setLocation("www.youtube.com", "/watch")
      document.body.innerHTML = `
        <div class="ytp-caption-window-container">
          <div class="ytp-caption-window-bottom">
            <span class="ytp-caption-segment">Cached line</span>
          </div>
        </div>
      `
      // Start and let the first per-cue translation cache the result
      await startVideoSubtitleTranslation()
      await vi.advanceTimersByTimeAsync(100)
      await Promise.resolve()
      await Promise.resolve()

      // The per-cue handler (runInlineAction) should have cached "Cached line"
      translateTextsMock.mockClear()

      // Advance past the 5s preload window
      await vi.advanceTimersByTimeAsync(5000)
      await Promise.resolve()
      await Promise.resolve()

      // translateTexts should not be called because the only caption was already cached
      expect(translateTextsMock).not.toHaveBeenCalled()
    })

    it("stops preload when translation is stopped", async () => {
      setLocation("www.youtube.com", "/watch")
      document.body.innerHTML = `
        <div class="ytp-caption-window-container">
          <div class="ytp-caption-window-bottom">
            <span class="ytp-caption-segment">Line A</span>
          </div>
        </div>
      `
      await startVideoSubtitleTranslation()

      // Stop before the 5s collection window completes
      await vi.advanceTimersByTimeAsync(1000)
      stopVideoSubtitleTranslation()

      translateTextsMock.mockClear()

      // Advance past when preload would have fired
      await vi.advanceTimersByTimeAsync(5000)
      await Promise.resolve()

      // translateTexts should not be called after stop
      expect(translateTextsMock).not.toHaveBeenCalled()
    })

    it("preloaded translations serve as cache hits for per-cue handler", async () => {
      setLocation("www.youtube.com", "/watch")
      document.body.innerHTML = `
        <div class="ytp-caption-window-container">
          <div class="ytp-caption-window-bottom">
            <span class="ytp-caption-segment">Preloaded text</span>
          </div>
        </div>
      `

      // Make per-cue handler slow so preload finishes first
      runInlineActionMock.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, text: "slow result" }), 10000)),
      )

      await startVideoSubtitleTranslation()

      // Advance past preload window
      await vi.advanceTimersByTimeAsync(5100)
      await Promise.resolve()
      await Promise.resolve()

      // Preload should have cached the text via translateTexts
      expect(translateTextsMock).toHaveBeenCalled()

      // Now trigger a new mutation with the same text — should use cache
      runInlineActionMock.mockClear()
      const container = document.querySelector(".ytp-caption-window-container")!
      container.innerHTML = `
        <div class="ytp-caption-window-bottom">
          <span class="ytp-caption-segment">Preloaded text</span>
        </div>
      `
      await vi.advanceTimersByTimeAsync(100)
      await Promise.resolve()
      await Promise.resolve()

      // The translation should be injected from cache, not via runInlineAction
      const subtitle = document.querySelector(".astra-video-subtitle")
      expect(subtitle).not.toBeNull()
      expect(subtitle?.textContent).toBe("[translated] Preloaded text")
    })
  })
})
