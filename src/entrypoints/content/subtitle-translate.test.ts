import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  readConfigMock,
  readAstraSessionMock,
  translateTextsMock,
  getDocumentTranslationContextMock,
} = vi.hoisted(() => ({
  readConfigMock: vi.fn(),
  readAstraSessionMock: vi.fn(),
  translateTextsMock: vi.fn(),
  getDocumentTranslationContextMock: vi.fn(() => ({ pageTitle: "test" })),
}))

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
}))

vi.mock("@/utils/storage/auth", () => ({
  readAstraSession: readAstraSessionMock,
}))

vi.mock("@/utils/translate/translate", () => ({
  translateTexts: translateTextsMock,
}))

// translation-context is imported by subtitle-translate; stub it to avoid
// unrelated observer/config side-effects in tests.
vi.mock("./translation-context", () => ({
  getDocumentTranslationContext: getDocumentTranslationContextMock,
}))

import { translatePageSubtitles, removeTranslatedSubtitles } from "./subtitle-translate"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setLocation(hostname: string, pathname: string) {
  Object.defineProperty(window, "location", {
    value: {
      hostname,
      pathname,
      href: `https://${hostname}${pathname}`,
      protocol: "https:",
    },
    writable: true,
    configurable: true,
  })
}

const ENABLED_CONFIG = {
  version: 1 as const,
  targetLang: "zh-CN",
  hoverTrigger: "alt" as const,
  contentScope: "page" as const,
  inputTranslation: "enabled" as const,
  privacyMode: false,
  serviceMode: "automatic" as const,
  provider: {
    id: "openai" as const,
    accessToken: "astra-token",
    relayBaseURL: "https://astra.example/v1",
    model: "gpt-5.4-nano",
  },
  presentation: { mode: "bilingual" as const, theme: "default" as const },
  sites: {},
}

const DISABLED_SITE_CONFIG = {
  ...ENABLED_CONFIG,
  sites: {
    "localhost": { enabled: false, alwaysTranslate: false },
  },
}

const NO_API_KEY_CONFIG = {
  ...ENABLED_CONFIG,
  provider: { ...ENABLED_CONFIG.provider, accessToken: "   " },
}

/**
 * Build a minimal TextTrack-like object with the given cues array.
 * VTTCue is not available in jsdom, so we don't use VTTCue instances here;
 * instead we just verify the filtering / skip logic that runs before any
 * VTTCue construction.
 */
function makeTextTrack(options: {
  kind?: string
  label?: string
  mode?: TextTrackMode
  cues?: null | { length: number }
}): TextTrack {
  return {
    kind: options.kind ?? "subtitles",
    label: options.label ?? "",
    mode: options.mode ?? "showing",
    cues: options.cues === undefined ? { length: 0 } : options.cues,
    addCue: vi.fn(),
    removeCue: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as TextTrack
}

/**
 * Append a <video> element to the document body, optionally with a set of
 * mock TextTrack entries that are available via video.textTracks.
 * Returns the video element.
 */
function appendVideoWithTracks(tracks: TextTrack[]): HTMLVideoElement {
  const video = document.createElement("video")
  document.body.appendChild(video)

  // jsdom does not implement TextTrackList, so we replace video.textTracks
  // with a plain array-like object that satisfies the code under test.
  const textTrackList = {
    length: tracks.length,
    [Symbol.iterator]: () => tracks[Symbol.iterator](),
    item: (i: number) => tracks[i],
  }

  // Expose numeric indices for direct access
  tracks.forEach((t, i) => {
    ;(textTrackList as Record<string | number, unknown>)[i] = t
  })

  Object.defineProperty(video, "textTracks", {
    configurable: true,
    get: () => textTrackList,
  })

  return video
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("translatePageSubtitles", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readConfigMock.mockResolvedValue(ENABLED_CONFIG)
    readAstraSessionMock.mockResolvedValue(null)
    getDocumentTranslationContextMock.mockReturnValue({ pageTitle: "test" })
    translateTextsMock.mockResolvedValue({ ok: true, translations: [] })
    vi.useFakeTimers()
  })

  afterEach(() => {
    setLocation("localhost", "/")
    document.body.innerHTML = ""
    vi.useRealTimers()
  })

  it("skips when no video elements are on the page", async () => {
    document.body.innerHTML = ""

    const promise = translatePageSubtitles()
    await vi.runAllTimersAsync()
    await promise

    expect(translateTextsMock).not.toHaveBeenCalled()
  })

  it("skips a video that has no subtitle or caption tracks", async () => {
    const metadataTrack = makeTextTrack({ kind: "metadata", label: "chapters" })
    appendVideoWithTracks([metadataTrack])

    const promise = translatePageSubtitles()
    await vi.runAllTimersAsync()
    await promise

    expect(translateTextsMock).not.toHaveBeenCalled()
  })

  it("skips a video that has no tracks at all", async () => {
    appendVideoWithTracks([])

    const promise = translatePageSubtitles()
    await vi.runAllTimersAsync()
    await promise

    expect(translateTextsMock).not.toHaveBeenCalled()
  })

  it("skips a video whose only subtitle track has no cues", async () => {
    const emptyTrack = makeTextTrack({ kind: "subtitles", cues: { length: 0 } })
    appendVideoWithTracks([emptyTrack])

    const promise = translatePageSubtitles()
    await vi.runAllTimersAsync()
    await promise

    expect(translateTextsMock).not.toHaveBeenCalled()
  })

  it("skips a video whose source track has null cues", async () => {
    const nullCueTrack = makeTextTrack({ kind: "subtitles", cues: null })
    appendVideoWithTracks([nullCueTrack])

    const promise = translatePageSubtitles()
    await vi.runAllTimersAsync()
    await promise

    expect(translateTextsMock).not.toHaveBeenCalled()
  })

  it("skips a video that already has an Astra-labeled track", async () => {
    // A real subtitle track that has cues…
    const sourceTrack = makeTextTrack({ kind: "subtitles", cues: { length: 5 } })
    // …but there is already an Astra-generated track present
    const astraTrack = makeTextTrack({ kind: "subtitles", label: "Astra: zh-CN" })
    appendVideoWithTracks([sourceTrack, astraTrack])

    const promise = translatePageSubtitles()
    await vi.runAllTimersAsync()
    await promise

    expect(translateTextsMock).not.toHaveBeenCalled()
  })

  it("skips an existing Astra DOM track only when service mode also matches", async () => {
    const sourceTrack = makeTextTrack({ kind: "subtitles", cues: { length: 5 } })
    const video = appendVideoWithTracks([sourceTrack])
    const astraTrack = document.createElement("track")
    astraTrack.label = "Astra: zh-CN"
    astraTrack.dataset.astraServiceMode = "automatic"
    video.appendChild(astraTrack)

    const promise = translatePageSubtitles()
    await vi.runAllTimersAsync()
    await promise

    expect(translateTextsMock).not.toHaveBeenCalled()
    expect(video.querySelectorAll("track")).toHaveLength(1)
  })

  it("removes stale Astra subtitle tracks when service mode changes", async () => {
    const OriginalVTTCue = (globalThis as Record<string, unknown>).VTTCue
    ;(globalThis as Record<string, unknown>).VTTCue = class VTTCue {
      startTime: number; endTime: number; text: string
      constructor(start: number, end: number, text: string) {
        this.startTime = start; this.endTime = end; this.text = text
      }
    }

    try {
      readConfigMock.mockResolvedValue({
        ...ENABLED_CONFIG,
        serviceMode: "balanced",
      })
      translateTextsMock.mockResolvedValue({ ok: true, translations: ["你好"] })

      const sourceTrack = makeTextTrack({ kind: "subtitles", mode: "showing" })
      const cueList = Object.assign([
        new (globalThis as { VTTCue: typeof VTTCue }).VTTCue(0, 1, "hello"),
      ], { length: 1 })
      Object.assign(sourceTrack, { cues: cueList, addCue: vi.fn() })
      const video = appendVideoWithTracks([sourceTrack])
      const staleTrack = document.createElement("track")
      staleTrack.label = "Astra: zh-CN"
      staleTrack.dataset.astraServiceMode = "fast"
      video.appendChild(staleTrack)

      const promise = translatePageSubtitles()
      await vi.runAllTimersAsync()
      await promise

      expect(staleTrack.isConnected).toBe(false)
      expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
        texts: ["hello"],
        targetLang: "zh-CN",
        serviceMode: "balanced",
      }))
      const astraTracks = Array.from(video.querySelectorAll("track"))
        .filter((track) => track.label === "Astra: zh-CN")
      expect(astraTracks).toHaveLength(1)
      expect(astraTracks[0].dataset.astraServiceMode).toBe("balanced")
    } finally {
      if (OriginalVTTCue === undefined) {
        delete (globalThis as Record<string, unknown>).VTTCue
      } else {
        ;(globalThis as Record<string, unknown>).VTTCue = OriginalVTTCue
      }
    }
  })

  it("returns early when the site is disabled in config", async () => {
    readConfigMock.mockResolvedValue(DISABLED_SITE_CONFIG)

    const sourceTrack = makeTextTrack({ kind: "subtitles", cues: { length: 3 } })
    appendVideoWithTracks([sourceTrack])

    const promise = translatePageSubtitles()
    await vi.runAllTimersAsync()
    await promise

    expect(translateTextsMock).not.toHaveBeenCalled()
  })

  it("returns early when the API key is blank", async () => {
    readConfigMock.mockResolvedValue(NO_API_KEY_CONFIG)

    const sourceTrack = makeTextTrack({ kind: "subtitles", cues: { length: 3 } })
    appendVideoWithTracks([sourceTrack])

    const promise = translatePageSubtitles()
    await vi.runAllTimersAsync()
    await promise

    expect(translateTextsMock).not.toHaveBeenCalled()
  })

  it("skips YouTube because the video subtitle pipeline owns YouTube caption rendering", async () => {
    setLocation("www.youtube.com", "/watch")

    const sourceTrack = makeTextTrack({ kind: "captions", mode: "showing", cues: { length: 1 } })
    appendVideoWithTracks([sourceTrack])

    const promise = translatePageSubtitles()
    await vi.runAllTimersAsync()
    await promise

    expect(translateTextsMock).not.toHaveBeenCalled()
  })

  it("sanitizes subtitle translation context when privacy mode is enabled", async () => {
    const OriginalVTTCue = (globalThis as Record<string, unknown>).VTTCue
    ;(globalThis as Record<string, unknown>).VTTCue = class VTTCue {
      startTime: number; endTime: number; text: string
      constructor(start: number, end: number, text: string) {
        this.startTime = start; this.endTime = end; this.text = text
      }
    }

    try {
      readConfigMock.mockResolvedValue({
        ...ENABLED_CONFIG,
        privacyMode: true,
      })
      getDocumentTranslationContextMock.mockReturnValue({
        pageTitle: "Sensitive page",
        pageUrl: "https://example.com/watch?token=secret#frag",
        hostname: "example.com",
        metaDescription: "private",
      } as any)
      translateTextsMock.mockResolvedValue({ ok: true, translations: ["你好"] })

      const sourceTrack = makeTextTrack({ kind: "subtitles", mode: "showing" })
      const cueList = Object.assign([
        new (globalThis as { VTTCue: typeof VTTCue }).VTTCue(0, 1, "hello"),
      ], { length: 1 })
      Object.assign(sourceTrack, { cues: cueList, addCue: vi.fn() })
      appendVideoWithTracks([sourceTrack])

      const promise = translatePageSubtitles()
      await vi.runAllTimersAsync()
      await promise

      expect(translateTextsMock).toHaveBeenCalledWith({
        texts: ["hello"],
        targetLang: "zh-CN",
        serviceMode: "automatic",
        context: {
          hostname: "example.com",
          pageUrl: "https://example.com/watch",
        },
      })
    } finally {
      if (OriginalVTTCue === undefined) {
        delete (globalThis as Record<string, unknown>).VTTCue
      } else {
        ;(globalThis as Record<string, unknown>).VTTCue = OriginalVTTCue
      }
    }
  })

  it("sets source track mode to hidden when it is disabled, then restores it", async () => {
    // VTTCue is not defined in jsdom. We stub it as a class whose instances
    // will never be reached (collectCues finds zero cues), so translateTrack
    // exits early — the important observable is that mode is restored.
    const OriginalVTTCue = (globalThis as Record<string, unknown>).VTTCue
    ;(globalThis as Record<string, unknown>).VTTCue = class VTTCue {
      startTime: number; endTime: number; text: string
      constructor(start: number, end: number, text: string) {
        this.startTime = start; this.endTime = end; this.text = text
      }
    }

    try {
      const sourceTrack = makeTextTrack({ kind: "subtitles", mode: "disabled" })

      // Provide an iterable cues list with a non-VTTCue entry so the loop
      // runs (triggering the instanceof check) but produces zero parsed cues.
      const fakeCue = { startTime: 0, endTime: 1, text: "hello" } // plain object, not VTTCue
      const cueList = Object.assign([fakeCue], { length: 1 })
      Object.assign(sourceTrack, { cues: cueList })

      appendVideoWithTracks([sourceTrack])

      const promise = translatePageSubtitles()
      await vi.runAllTimersAsync()
      await promise

      // Mode must be restored to "disabled" after the async delay
      expect((sourceTrack as { mode: string }).mode).toBe("disabled")
    } finally {
      if (OriginalVTTCue === undefined) {
        delete (globalThis as Record<string, unknown>).VTTCue
      } else {
        ;(globalThis as Record<string, unknown>).VTTCue = OriginalVTTCue
      }
    }
  })
})

describe("removeTranslatedSubtitles", () => {
  it("removes only track elements whose label starts with 'Astra: '", () => {
    document.body.innerHTML = `
      <video>
        <track label="English" kind="subtitles" />
        <track label="Astra: zh-CN" kind="subtitles" />
        <track label="Astra: ja" kind="captions" />
      </video>
    `

    removeTranslatedSubtitles()

    const remaining = document.querySelectorAll("video track")
    expect(remaining).toHaveLength(1)
    expect(remaining[0].getAttribute("label")).toBe("English")
  })

  it("is a no-op when there are no videos on the page", () => {
    document.body.innerHTML = ""
    expect(() => removeTranslatedSubtitles()).not.toThrow()
  })

  it("is a no-op when no tracks carry an Astra label", () => {
    document.body.innerHTML = `
      <video>
        <track label="English" kind="subtitles" />
        <track label="French" kind="captions" />
      </video>
    `

    removeTranslatedSubtitles()

    expect(document.querySelectorAll("video track")).toHaveLength(2)
  })

  it("handles multiple videos independently", () => {
    document.body.innerHTML = `
      <video id="v1">
        <track label="Astra: zh-CN" kind="subtitles" />
        <track label="English" kind="subtitles" />
      </video>
      <video id="v2">
        <track label="Astra: ja" kind="subtitles" />
      </video>
    `

    removeTranslatedSubtitles()

    const v1Tracks = document.querySelector("#v1")!.querySelectorAll("track")
    const v2Tracks = document.querySelector("#v2")!.querySelectorAll("track")

    expect(v1Tracks).toHaveLength(1)
    expect(v1Tracks[0].getAttribute("label")).toBe("English")
    expect(v2Tracks).toHaveLength(0)
  })

  it("does not remove tracks that merely contain 'Astra' but don't start with 'Astra: '", () => {
    document.body.innerHTML = `
      <video>
        <track label="Not Astra: zh-CN" kind="subtitles" />
        <track label="Powered by Astra" kind="subtitles" />
      </video>
    `

    removeTranslatedSubtitles()

    expect(document.querySelectorAll("video track")).toHaveLength(2)
  })
})
