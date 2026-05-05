import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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
  clearVideoSubtitleCache,
  getVideoSubtitleQualitySnapshot,
  startVideoSubtitleTranslation,
  stopVideoSubtitleTranslation,
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

async function flushPromises(count = 6) {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve()
  }
}

describe("video subtitle QC snapshot", () => {
  beforeEach(() => {
    readConfigMock.mockResolvedValue(DEFAULT_ASTRA_CONFIG)
    runInlineActionMock.mockResolvedValue({ ok: true, text: "翻译结果" })
    translateTextsMock.mockResolvedValue({ ok: true, translations: [] })
    document.body.innerHTML = ""
    delete (window as Window & { ytInitialPlayerResponse?: unknown }).ytInitialPlayerResponse
  })

  afterEach(() => {
    stopVideoSubtitleTranslation()
    clearVideoSubtitleCache()
    vi.restoreAllMocks()
  })

  it("reports a fresh read-only snapshot for an active YouTube subtitle session", async () => {
    setLocation("www.youtube.com", "/watch")
    document.body.innerHTML = `
      <video></video>
      <div class="ytp-caption-window-container">
        <div class="ytp-caption-window-bottom">
          <span class="ytp-caption-segment">Hello world</span>
        </div>
      </div>
    `

    await startVideoSubtitleTranslation()
    await flushPromises(8)

    const snapshot = getVideoSubtitleQualitySnapshot()
    expect(snapshot).toEqual(expect.objectContaining({
      surface: "video",
      active: true,
      platform: "youtube",
      pipeline: "youtube-hybrid",
      source: "dom",
      status: "fallback-ready",
      translatedNodeCount: 1,
      sourceTextLength: "Hello world".length,
      pendingRequestCount: 0,
      cacheSize: 1,
    }))
    expect(snapshot?.anomalies).toContain("missing-track")
    expect(snapshot?.capturedAt).toBeGreaterThan(0)
  })

  it("returns null when no video subtitle session is active", () => {
    expect(getVideoSubtitleQualitySnapshot()).toBeNull()
  })
})
