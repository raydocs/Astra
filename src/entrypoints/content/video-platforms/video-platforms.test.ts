import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../../../test/utils/mockBrowser"

const { runInlineActionMock, readConfigMock } = vi.hoisted(() => ({
  runInlineActionMock: vi.fn(),
  readConfigMock: vi.fn(),
}))

vi.mock("../inline-actions", () => ({
  runInlineAction: runInlineActionMock,
}))

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
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
})
