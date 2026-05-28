import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { parseBilibiliSubtitleJson, bilibiliApiSubtitleSource } from "./bilibili-subtitles"
import { genericTextTrackSubtitleSource } from "./generic-text-track-subtitles"
import {
  extractYouTubeCaptionTracks,
  parseYouTubeJson3TimedText,
  parseYouTubeXmlTimedText,
  youtubeTimedTextSubtitleSource,
} from "./youtube-subtitles"
import {
  BILIBILI_JSON_FIXTURE,
  YOUTUBE_JSON3_FIXTURE,
  YOUTUBE_XML_FIXTURE,
} from "./subtitle-source-fixtures"

const originalFetch = globalThis.fetch

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

function makeTextTrack(options: {
  kind?: string
  label?: string
  language?: string
  mode?: TextTrackMode
  cues?: Array<{ startTime: number; endTime: number; text: string }>
}): TextTrack {
  const cues = options.cues ?? []
  const cueList = Object.assign(cues, {
    length: cues.length,
    item: (index: number) => cues[index] ?? null,
  })

  return {
    kind: options.kind ?? "subtitles",
    label: options.label ?? "English",
    language: options.language ?? "en",
    mode: options.mode ?? "showing",
    cues: cueList as unknown as TextTrackCueList,
    activeCues: null,
    addCue: vi.fn(),
    removeCue: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    oncuechange: null,
    inBandMetadataTrackDispatchType: "",
  } as unknown as TextTrack
}

function appendVideoWithTracks(tracks: TextTrack[]): HTMLVideoElement {
  const video = document.createElement("video")
  document.body.appendChild(video)

  const textTrackList = {
    length: tracks.length,
    [Symbol.iterator]: () => tracks[Symbol.iterator](),
    item: (index: number) => tracks[index] ?? null,
  }
  tracks.forEach((track, index) => {
    ;(textTrackList as Record<string | number, unknown>)[index] = track
  })

  Object.defineProperty(video, "textTracks", {
    configurable: true,
    get: () => textTrackList,
  })

  return video
}

describe("platform subtitle source parsers", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    globalThis.fetch = originalFetch
    document.body.innerHTML = ""
    delete (window as Window & { ytInitialPlayerResponse?: unknown; __playinfo__?: unknown }).ytInitialPlayerResponse
    delete (window as Window & { ytInitialPlayerResponse?: unknown; __playinfo__?: unknown }).__playinfo__
  })

  it("parses YouTube json3 timedtext fixtures", () => {
    expect(parseYouTubeJson3TimedText(YOUTUBE_JSON3_FIXTURE)).toEqual([
      { startTime: 0, endTime: 1.2, text: "Hello world" },
      { startTime: 1.2, endTime: 2.1, text: "Next cue" },
    ])
  })

  it("parses YouTube XML timedtext fixtures", () => {
    expect(parseYouTubeXmlTimedText(YOUTUBE_XML_FIXTURE)).toEqual([
      { startTime: 0, endTime: 1.2, text: "Hello & world" },
      { startTime: 1.2, endTime: 2.1, text: "Second cue" },
    ])
  })

  it("extracts YouTube caption metadata from player response", () => {
    expect(extractYouTubeCaptionTracks({
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [{ baseUrl: "https://example.test/timedtext", languageCode: "en" }],
        },
      },
    })).toEqual([{ baseUrl: "https://example.test/timedtext", languageCode: "en" }])
  })

  it("loads YouTube timedtext tracks before generic TextTrack fallback", async () => {
    setLocation("www.youtube.com", "/watch")
    ;(window as Window & { ytInitialPlayerResponse?: unknown }).ytInitialPlayerResponse = {
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [{ baseUrl: "https://www.youtube.com/api/timedtext?v=1&lang=en", languageCode: "en" }],
        },
      },
    }
    globalThis.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      text: () => Promise.resolve(YOUTUBE_JSON3_FIXTURE),
    })) as unknown as typeof fetch

    const video = appendVideoWithTracks([])
    const tracks = await youtubeTimedTextSubtitleSource.loadTracks(video, {
      targetLang: "zh-CN",
      astraTrackLabelPrefix: "Astra: ",
    })

    expect(tracks[0]).toEqual(expect.objectContaining({
      platform: "youtube",
      source: "youtube-timedtext",
      language: "en",
      cues: parseYouTubeJson3TimedText(YOUTUBE_JSON3_FIXTURE),
    }))
  })

  it("loads YouTube timedtext tracks from inline scripts when globals are isolated", async () => {
    setLocation("www.youtube.com", "/watch")
    const script = document.createElement("script")
    script.textContent = `var ytInitialPlayerResponse = {"captions":{"playerCaptionsTracklistRenderer":{"captionTracks":[{"baseUrl":"https://www.youtube.com/api/timedtext?v=2&lang=en","languageCode":"en"}]}}};`
    document.body.appendChild(script)

    globalThis.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      text: () => Promise.resolve(YOUTUBE_JSON3_FIXTURE),
    })) as unknown as typeof fetch

    const video = appendVideoWithTracks([])
    const tracks = await youtubeTimedTextSubtitleSource.loadTracks(video, {
      targetLang: "zh-CN",
      astraTrackLabelPrefix: "Astra: ",
    })

    expect(tracks[0]).toEqual(expect.objectContaining({
      platform: "youtube",
      source: "youtube-timedtext",
      language: "en",
      cues: parseYouTubeJson3TimedText(YOUTUBE_JSON3_FIXTURE),
    }))
  })

  it("loads YouTube timedtext tracks from ytcfg player_response payloads", async () => {
    setLocation("www.youtube.com", "/watch")
    const playerResponse = {
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [{ baseUrl: "https://www.youtube.com/api/timedtext?v=3&lang=en", languageCode: "en" }],
        },
      },
    }
    const script = document.createElement("script")
    script.textContent = `var ytcfg={set:function(){}}; ytcfg.set({"PLAYER_VARS":{"player_response":${JSON.stringify(JSON.stringify(playerResponse))}}});`
    document.body.appendChild(script)

    globalThis.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      text: () => Promise.resolve(YOUTUBE_JSON3_FIXTURE),
    })) as unknown as typeof fetch

    const video = appendVideoWithTracks([])
    const tracks = await youtubeTimedTextSubtitleSource.loadTracks(video, {
      targetLang: "zh-CN",
      astraTrackLabelPrefix: "Astra: ",
    })

    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining("v=3"), { credentials: "include" })
    expect(tracks[0]).toEqual(expect.objectContaining({
      platform: "youtube",
      source: "youtube-timedtext",
      language: "en",
      cues: parseYouTubeJson3TimedText(YOUTUBE_JSON3_FIXTURE),
    }))
  })

  it("supports YouTube host variants in canLoad", () => {
    expect(youtubeTimedTextSubtitleSource.canLoad(new URL("https://www.youtube.com/watch?v=1"), document)).toBe(true)
    expect(youtubeTimedTextSubtitleSource.canLoad(new URL("https://m.youtube.com/watch?v=1"), document)).toBe(true)
    expect(youtubeTimedTextSubtitleSource.canLoad(new URL("https://youtu.be/abc123"), document)).toBe(true)
    expect(youtubeTimedTextSubtitleSource.canLoad(new URL("https://www.youtube-nocookie.com/embed/abc123"), document)).toBe(true)
  })

  it("parses Bilibili subtitle JSON fixtures", () => {
    expect(parseBilibiliSubtitleJson(BILIBILI_JSON_FIXTURE)).toEqual([
      { startTime: 0, endTime: 1.5, text: "你好 世界" },
      { startTime: 1.5, endTime: 3, text: "第二句" },
    ])
  })

  it("loads Bilibili API subtitles from page state", async () => {
    setLocation("www.bilibili.com", "/video/BV123")
    ;(window as Window & { __playinfo__?: unknown }).__playinfo__ = {
      data: {
        subtitle: {
          subtitles: [{ id: 1, lan: "en-US", lan_doc: "English", subtitle_url: "//example.test/subtitle.json" }],
        },
      },
    }
    globalThis.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      text: () => Promise.resolve(BILIBILI_JSON_FIXTURE),
    })) as unknown as typeof fetch

    const video = appendVideoWithTracks([])
    const tracks = await bilibiliApiSubtitleSource.loadTracks(video, {
      targetLang: "zh-CN",
      astraTrackLabelPrefix: "Astra: ",
    })

    expect(globalThis.fetch).toHaveBeenCalledWith("https://example.test/subtitle.json", { credentials: "include" })
    expect(tracks[0]).toEqual(expect.objectContaining({
      platform: "bilibili",
      source: "bilibili-api",
      language: "en-us",
      label: "English",
      cues: parseBilibiliSubtitleJson(BILIBILI_JSON_FIXTURE),
    }))
  })
})

describe("generic TextTrack subtitle source", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ""
  })

  it("preserves disabled TextTrack fallback by hiding then restoring source tracks", async () => {
    const OriginalVTTCue = (globalThis as Record<string, unknown>).VTTCue
    ;(globalThis as Record<string, unknown>).VTTCue = class VTTCue {
      startTime: number; endTime: number; text: string
      constructor(start: number, end: number, text: string) {
        this.startTime = start; this.endTime = end; this.text = text
      }
    }

    try {
      const cue = new (globalThis as { VTTCue: typeof VTTCue }).VTTCue(0, 1, "<i>Hello</i>")
      const track = makeTextTrack({ mode: "disabled", cues: [cue] })
      const video = appendVideoWithTracks([track])

      const promise = genericTextTrackSubtitleSource.loadTracks(video, {
        targetLang: "zh-CN",
        astraTrackLabelPrefix: "Astra: ",
      })
      await vi.runAllTimersAsync()
      const tracks = await promise

      expect(track.mode).toBe("disabled")
      expect(tracks[0]).toEqual(expect.objectContaining({
        platform: "generic",
        source: "html-text-track",
        cues: [{ startTime: 0, endTime: 1, text: "Hello" }],
      }))
    } finally {
      if (OriginalVTTCue === undefined) {
        delete (globalThis as Record<string, unknown>).VTTCue
      } else {
        ;(globalThis as Record<string, unknown>).VTTCue = OriginalVTTCue
      }
    }
  })
})
