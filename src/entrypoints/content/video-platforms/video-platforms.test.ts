import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../../../test/utils/mockBrowser"

const {
  runInlineActionMock,
  readConfigMock,
  saveConfigMock,
  translateTextsMock,
  fetchMock,
  copyTextToClipboardMock,
  saveVocabularyEntryMock,
  getDueVocabularyCountMock,
} = vi.hoisted(() => ({
  runInlineActionMock: vi.fn(),
  readConfigMock: vi.fn(),
  saveConfigMock: vi.fn(),
  translateTextsMock: vi.fn(),
  fetchMock: vi.fn(),
  copyTextToClipboardMock: vi.fn(),
  saveVocabularyEntryMock: vi.fn(),
  getDueVocabularyCountMock: vi.fn(),
}))

vi.mock("../inline-actions", () => ({
  runInlineAction: runInlineActionMock,
}))

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
  saveConfig: saveConfigMock,
}))

vi.mock("@/utils/translate/translate", () => ({
  translateTexts: translateTextsMock,
}))

vi.mock("@/utils/dom/clipboard", () => ({
  copyTextToClipboard: copyTextToClipboardMock,
}))

vi.mock("@/utils/storage/vocabulary", () => ({
  getDueVocabularyCount: getDueVocabularyCountMock,
  saveVocabularyEntry: saveVocabularyEntryMock,
}))

import { DEFAULT_ASTRA_CONFIG } from "@/types/config"
import {
  captureCurrentVideoNoteSource,
  clearVideoSubtitleCache,
  ensureVideoPlayerControlButton,
  getSupportedPlatformIds,
  getSupportedPlatformRenderingRules,
  isVideoPage,
  isVideoSubtitleTranslationActive,
  setupVideoNavigationHandler,
  startVideoSubtitleTranslation,
  stopVideoSubtitleTranslation,
} from "./index"
import { createTextTrackDomPlatform } from "./onboarding-template"
import { courseOverlayRenderingRule, playerCaptionWindowRenderingRule } from "./rendering-rules"

function getMockBrowser(): ReturnType<typeof createMockBrowser> {
  return (globalThis as unknown as { __ASTRA_TEST_BROWSER__: ReturnType<typeof createMockBrowser> })
    .__ASTRA_TEST_BROWSER__
}

const originalFetch = globalThis.fetch

const P0_PLATFORM_IDS = [
  "youtube",
  "bilibili",
  "netflix",
  "primevideo",
  "disneyplus",
  "udemy",
  "coursera",
  "vimeo",
  "ted",
  "khanacademy",
] as const

const EXPECTED_RENDERING_RULES = {
  youtube: {
    ruleId: "youtube-native-caption-line",
    surface: "player-overlay",
    insertionPoint: "native-caption-line",
    className: "astra-video-subtitle--youtube",
  },
  bilibili: {
    ruleId: "bilibili-native-caption-window",
    surface: "player-overlay",
    insertionPoint: "native-caption-window",
    className: "astra-video-subtitle--bilibili",
  },
  netflix: {
    ruleId: "netflix-native-caption-window",
    surface: "player-overlay",
    insertionPoint: "native-caption-window",
    className: "astra-video-subtitle--netflix",
  },
  primevideo: {
    ruleId: "primevideo-native-caption-window",
    surface: "player-overlay",
    insertionPoint: "native-caption-window",
    className: "astra-video-subtitle--primevideo",
  },
  disneyplus: {
    ruleId: "disneyplus-native-caption-window",
    surface: "player-overlay",
    insertionPoint: "native-caption-window",
    className: "astra-video-subtitle--disneyplus",
  },
  udemy: {
    ruleId: "udemy-course-overlay",
    surface: "course-overlay",
    insertionPoint: "native-caption-window",
    className: "astra-video-subtitle--udemy",
  },
  coursera: {
    ruleId: "coursera-course-overlay",
    surface: "course-overlay",
    insertionPoint: "native-caption-window",
    className: "astra-video-subtitle--coursera",
  },
  vimeo: {
    ruleId: "vimeo-native-caption-window",
    surface: "player-overlay",
    insertionPoint: "native-caption-window",
    className: "astra-video-subtitle--vimeo",
  },
  ted: {
    ruleId: "ted-native-caption-window",
    surface: "player-overlay",
    insertionPoint: "native-caption-window",
    className: "astra-video-subtitle--ted",
  },
  khanacademy: {
    ruleId: "khanacademy-course-overlay",
    surface: "course-overlay",
    insertionPoint: "native-caption-window",
    className: "astra-video-subtitle--khanacademy",
  },
} as const

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

function setYouTubePlayerResponse(
  trackOrBaseUrl:
    | string
    | Array<{
      baseUrl: string
      languageCode?: string
      kind?: string
      isTranslatable?: boolean
      vssId?: string
      name?: { simpleText?: string; runs?: Array<{ text?: string }> }
    }>
    = "https://www.youtube.com/api/timedtext?v=abc123&lang=en",
) {
  const captionTracks = Array.isArray(trackOrBaseUrl)
    ? trackOrBaseUrl
    : [{ baseUrl: trackOrBaseUrl, languageCode: "en" }]

  Object.assign(window as Window & { ytInitialPlayerResponse?: unknown }, {
    ytInitialPlayerResponse: {
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks,
        },
      },
    },
  })
}

function clearYouTubePlayerResponse() {
  delete (window as Window & { ytInitialPlayerResponse?: unknown }).ytInitialPlayerResponse
}

function appendYouTubeFixture(text = "Hello world", currentTime = 0.2) {
  document.body.innerHTML = `
    <video id="astra-video"></video>
    <div class="ytp-caption-window-container">
      <div class="ytp-caption-window-bottom">
        ${text ? `<span class="ytp-caption-segment">${text}</span>` : ""}
      </div>
    </div>
  `

  const video = document.querySelector("video") as HTMLVideoElement
  Object.defineProperty(video, "currentTime", {
    configurable: true,
    writable: true,
    value: currentTime,
  })

  return {
    video,
    container: document.querySelector(".ytp-caption-window-container") as HTMLElement,
  }
}

function makeTextTrack(options: {
  kind?: string
  label?: string
  language?: string
  mode?: TextTrackMode
  cues?: Array<{ startTime: number; endTime: number; text: string }>
}): TextTrack {
  const cues = (options.cues ?? []).map((cue) => ({
    startTime: cue.startTime,
    endTime: cue.endTime,
    text: cue.text,
  }))

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

function attachTextTracks(video: HTMLVideoElement, tracks: TextTrack[]) {
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
}

async function flushPromises(count = 4) {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve()
  }
}

function timedTextJson(events: Array<{ startMs: number; durationMs: number; text: string }>) {
  return JSON.stringify({
    events: events.map((event) => ({
      tStartMs: event.startMs,
      dDurationMs: event.durationMs,
      segs: [{ utf8: event.text }],
    })),
  })
}

describe("video platform subtitle translation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    setMockBrowser(createMockBrowser())
    readConfigMock.mockResolvedValue(DEFAULT_ASTRA_CONFIG)
    saveConfigMock.mockResolvedValue(DEFAULT_ASTRA_CONFIG)
    runInlineActionMock.mockResolvedValue({ ok: true, text: "翻译结果" })
    translateTextsMock.mockImplementation(async (req: { texts: string[] }) => ({
      ok: true,
      translations: req.texts.map((text: string) => `[translated] ${text}`),
    }))
    fetchMock.mockReset()
    copyTextToClipboardMock.mockResolvedValue(undefined)
    saveVocabularyEntryMock.mockResolvedValue(undefined)
    getDueVocabularyCountMock.mockResolvedValue(0)
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { cancel: vi.fn(), speak: vi.fn() },
    })
    Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
      configurable: true,
      value: class MockSpeechSynthesisUtterance {
        text: string
        constructor(text: string) {
          this.text = text
        }
      },
    })
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:astra-transcript-export"),
    })
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    })
    globalThis.fetch = fetchMock as typeof fetch
    document.body.innerHTML = ""
    clearYouTubePlayerResponse()
  })

  afterEach(() => {
    stopVideoSubtitleTranslation()
    clearVideoSubtitleCache()
    clearYouTubePlayerResponse()
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("detects YouTube video pages", () => {
    setLocation("www.youtube.com", "/watch")
    expect(isVideoPage()).toBe(true)

    setLocation("www.youtube.com", "/embed/abc123")
    expect(isVideoPage()).toBe(true)

    setLocation("www.youtube-nocookie.com", "/embed/abc123")
    expect(isVideoPage()).toBe(true)
  })

  it("mounts one YouTube player Astra control with Off status", () => {
    setLocation("www.youtube.com", "/watch")
    document.body.innerHTML = `
      <div class="html5-video-player">
        <div class="ytp-right-controls"></div>
      </div>
    `

    ensureVideoPlayerControlButton()
    ensureVideoPlayerControlButton()

    const buttons = document.querySelectorAll("#astra-youtube-player-button")
    expect(buttons).toHaveLength(1)
    expect(document.querySelector(".ytp-right-controls #astra-youtube-player-button")?.textContent).toContain("Off")
  })

  it("mounts the YouTube player Astra control on embed players", () => {
    setLocation("www.youtube-nocookie.com", "/embed/abc123")
    document.body.innerHTML = `
      <div id="movie_player" class="html5-video-player">
        <div class="ytp-right-controls"></div>
      </div>
    `

    ensureVideoPlayerControlButton()

    expect(document.querySelector("#movie_player #astra-youtube-player-button")?.textContent).toContain("Off")
  })

  it("keeps the YouTube player Astra control inside fullscreen and theater controls", () => {
    setLocation("www.youtube.com", "/watch")
    document.body.innerHTML = `
      <div id="movie_player" class="html5-video-player ytp-fullscreen ytp-big-mode">
        <div class="ytp-chrome-controls">
          <div class="ytp-right-controls"></div>
        </div>
      </div>
    `

    ensureVideoPlayerControlButton()

    expect(document.querySelector(".ytp-fullscreen.ytp-big-mode .ytp-right-controls #astra-youtube-player-button")?.textContent)
      .toContain("Off")
  })

  it("moves the YouTube player Astra control into miniplayer controls when the chrome is rebuilt", () => {
    setLocation("www.youtube.com", "/watch")
    document.body.innerHTML = `
      <div id="movie_player" class="html5-video-player">
        <div class="ytp-right-controls"></div>
      </div>
    `

    ensureVideoPlayerControlButton()
    expect(document.querySelector(".ytp-right-controls #astra-youtube-player-button")).not.toBeNull()

    document.body.innerHTML = `
      <div id="movie_player" class="html5-video-player ytp-miniplayer-active">
        <div class="ytp-miniplayer-controls"></div>
      </div>
    `
    ensureVideoPlayerControlButton()

    expect(document.querySelector(".ytp-miniplayer-controls #astra-youtube-player-button")?.textContent).toContain("Off")
    expect(document.querySelectorAll("#astra-youtube-player-button")).toHaveLength(1)
  })

  it("toggles YouTube subtitle translation from the player Astra control", async () => {
    setLocation("www.youtube.com", "/watch")
    setYouTubePlayerResponse()
    document.body.innerHTML = `
      <div class="html5-video-player">
        <div class="ytp-right-controls"></div>
        <video id="astra-video"></video>
        <div class="ytp-caption-window-container">
          <div class="ytp-caption-window-bottom"><span class="ytp-caption-segment">Hello world</span></div>
        </div>
      </div>
    `
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => timedTextJson([{ startMs: 0, durationMs: 1_000, text: "Hello world" }]),
    } as Response)

    ensureVideoPlayerControlButton()
    const button = document.getElementById("astra-youtube-player-button") as HTMLButtonElement
    button.click()
    await flushPromises(8)

    expect(isVideoSubtitleTranslationActive()).toBe(true)
    expect(button.textContent).toMatch(/Astra(Translating|On)/)

    button.click()
    await flushPromises(2)

    expect(isVideoSubtitleTranslationActive()).toBe(false)
    expect(button.textContent).toContain("Off")
  })

  it("opens YouTube in-player subtitle settings and persists mode/background/size controls", async () => {
    setLocation("www.youtube.com", "/watch")
    document.body.innerHTML = `
      <div class="html5-video-player">
        <div class="ytp-right-controls"></div>
        <div class="ytp-caption-window-container">
          <div class="ytp-caption-window-bottom">
            <span class="ytp-caption-segment">Hello world</span>
            <span class="astra-video-subtitle">你好世界</span>
          </div>
        </div>
      </div>
    `

    ensureVideoPlayerControlButton()
    const settingsButton = document.getElementById("astra-youtube-player-settings-button") as HTMLButtonElement
    expect(settingsButton).not.toBeNull()

    settingsButton.click()
    const popover = document.getElementById("astra-youtube-player-settings-popover") as HTMLElement
    expect(popover).not.toBeNull()
    expect(popover.hasAttribute("hidden")).toBe(false)

    popover.querySelector<HTMLButtonElement>('[data-astra-video-setting-mode="translation-only"]')?.click()
    await flushPromises(4)
    expect(saveConfigMock).toHaveBeenCalledWith(expect.objectContaining({
      presentation: expect.objectContaining({ mode: "translation-only" }),
    }))

    settingsButton.click()
    popover.querySelector<HTMLButtonElement>('[data-astra-video-setting-theme="mask"]')?.click()
    await flushPromises(4)
    expect(saveConfigMock).toHaveBeenCalledWith(expect.objectContaining({
      presentation: expect.objectContaining({ theme: "mask" }),
    }))

    popover.querySelector<HTMLButtonElement>('[data-astra-video-setting-size="larger"]')?.click()
    await flushPromises(4)
    expect(saveConfigMock).toHaveBeenCalledWith(expect.objectContaining({
      presentation: expect.objectContaining({ fontSize: 1.02 }),
    }))
  })

  it("supports in-player position and native-caption restore actions", async () => {
    setLocation("www.youtube.com", "/watch")
    const nativeCaptionClick = vi.fn()
    document.body.innerHTML = `
      <div class="html5-video-player">
        <div class="ytp-right-controls"></div>
        <button class="ytp-subtitles-button" aria-pressed="false">CC</button>
        <div class="ytp-caption-window-container">
          <div class="ytp-caption-window-bottom">
            <span class="ytp-caption-segment">Hello world</span>
            <span class="astra-video-subtitle">你好世界</span>
          </div>
        </div>
      </div>
    `
    document.querySelector<HTMLButtonElement>(".ytp-subtitles-button")?.addEventListener("click", nativeCaptionClick)

    ensureVideoPlayerControlButton()
    const settingsButton = document.getElementById("astra-youtube-player-settings-button") as HTMLButtonElement
    settingsButton.click()
    const popover = document.getElementById("astra-youtube-player-settings-popover") as HTMLElement

    popover.querySelector<HTMLButtonElement>('[data-astra-video-setting-position="top"]')?.click()
    expect(document.querySelector<HTMLElement>(".astra-video-subtitle")?.dataset.astraVideoCaptionPosition).toBe("top")

    popover.querySelector<HTMLButtonElement>('[data-astra-video-setting-mode="original-only"]')?.click()
    await flushPromises(2)

    expect(document.querySelector(".astra-video-subtitle")).toBeNull()
    expect(nativeCaptionClick).toHaveBeenCalledTimes(1)
    expect(popover.hasAttribute("hidden")).toBe(true)
  })

  it("remounts the YouTube player Astra control across SPA navigation without duplicates", () => {
    setLocation("www.youtube.com", "/watch")
    document.body.innerHTML = `
      <div class="html5-video-player">
        <div class="ytp-right-controls"></div>
      </div>
    `

    setupVideoNavigationHandler()
    expect(document.querySelectorAll("#astra-youtube-player-button")).toHaveLength(1)

    Object.defineProperty(window, "location", {
      value: {
        hostname: "www.youtube.com",
        pathname: "/watch",
        href: "https://www.youtube.com/watch?v=next",
      },
      writable: true,
      configurable: true,
    })
    window.dispatchEvent(new Event("yt-navigate-finish"))

    expect(document.querySelectorAll("#astra-youtube-player-button")).toHaveLength(1)
  })

  it("detects Bilibili video pages", () => {
    setLocation("www.bilibili.com", "/video/BV1234567")
    expect(isVideoPage()).toBe(true)
  })

  it("detects Netflix video pages", () => {
    setLocation("www.netflix.com", "/watch/12345")
    expect(isVideoPage()).toBe(true)
  })

  it("detects Vimeo video pages", () => {
    setLocation("vimeo.com", "/123456789")
    expect(isVideoPage()).toBe(true)

    setLocation("player.vimeo.com", "/video/123456789")
    expect(isVideoPage()).toBe(true)

    setLocation("vimeo.com", "/")
    expect(isVideoPage()).toBe(false)
  })

  it("detects TED video pages", () => {
    setLocation("www.ted.com", "/talks/sir_ken_robinson_do_schools_kill_creativity")
    expect(isVideoPage()).toBe(true)

    setLocation("embed.ted.com", "/talks/sir_ken_robinson_do_schools_kill_creativity")
    expect(isVideoPage()).toBe(true)

    setLocation("www.ted.com", "/")
    expect(isVideoPage()).toBe(false)
  })

  it("detects Khan Academy video pages", () => {
    setLocation("www.khanacademy.org", "/math/algebra/x2f8bb11595b61c86:foundation-algebra/v/introduction-to-algebra")
    expect(isVideoPage()).toBe(true)

    setLocation("khanacademy.org", "/computing/computer-programming/programming/video/programming-basics")
    expect(isVideoPage()).toBe(true)

    setLocation("www.khanacademy.org", "/math/algebra")
    expect(isVideoPage()).toBe(false)
  })

  it("reports the P0 supported-platform PCP set at 10/10", () => {
    const supportedP0 = P0_PLATFORM_IDS.filter((id) => getSupportedPlatformIds().includes(id))

    expect(supportedP0).toContain("vimeo")
    expect(supportedP0).toContain("ted")
    expect(supportedP0).toContain("khanacademy")
    expect(supportedP0).toHaveLength(10)
  })

  it("reports explicit P0 subtitle rendering-rule SRQP coverage at 10/10", () => {
    const renderingRules = new Map(
      getSupportedPlatformRenderingRules().map(({ id, subtitleRendering }) => [id, subtitleRendering]),
    )

    const coveredP0 = P0_PLATFORM_IDS.filter((id) => {
      const rule = renderingRules.get(id)
      return !!rule?.ruleId && !!rule.surface && !!rule.insertionPoint && !!rule.className
    })

    expect(coveredP0).toHaveLength(10)
    for (const id of P0_PLATFORM_IDS) {
      expect(renderingRules.get(id)).toEqual(expect.objectContaining({
        ...EXPECTED_RENDERING_RULES[id],
        nativeCuePolicy: "preserve-native",
      }))
    }
  })

  it("enforces onboarding-template subtitleRendering.ruleId coupling to platform id", () => {
    const baseOptions = {
      id: "templateprobe",
      hostnames: ["templateprobe.example"],
      captionContainerSelector: ".captions",
      isVideoPage: () => true,
    }

    expect(createTextTrackDomPlatform(baseOptions).subtitleRendering.ruleId).toBe(
      "templateprobe-native-caption-window",
    )
    expect(createTextTrackDomPlatform({
      ...baseOptions,
      subtitleRendering: courseOverlayRenderingRule("templateprobe"),
    }).subtitleRendering.ruleId).toBe("templateprobe-course-overlay")
    expect(() => createTextTrackDomPlatform({
      ...baseOptions,
      subtitleRendering: playerCaptionWindowRenderingRule("otherprobe"),
    })).toThrow(/templateprobe-.*otherprobe-native-caption-window/)
  })

  it.each([
    ["youtube", "www.youtube.com", "/watch", '<div class="ytp-caption-window-container"><div class="ytp-caption-window-bottom"><span class="ytp-caption-segment">Hello YouTube</span></div></div>'],
    ["bilibili", "www.bilibili.com", "/video/BV1234567", '<div class="bpx-player-subtitle-panel"><span class="bpx-player-subtitle-panel-text">Hello Bilibili</span></div>'],
    ["netflix", "www.netflix.com", "/watch/12345", '<div class="player-timedtext-text-container"><span>Hello Netflix</span></div>'],
    ["primevideo", "www.primevideo.com", "/detail/0ABC", '<div class="atvwebplayersdk-captions-text"><span>Hello Prime</span></div>'],
    ["disneyplus", "www.disneyplus.com", "/video/abc123", '<div class="player-timedtext-text-container"><span>Hello Disney</span></div>'],
    ["udemy", "www.udemy.com", "/course/demo/learn/lecture/123", '<div class="captions-display--captions-container"><span>Hello Udemy</span></div>'],
    ["coursera", "www.coursera.org", "/learn/demo/lecture/abc", '<div class="rc-VideoTranscript"><span>Hello Coursera</span></div>'],
    ["vimeo", "vimeo.com", "/123456789", '<div class="vp-captions"><span>Hello Vimeo</span></div>'],
    ["ted", "www.ted.com", "/talks/sir_ken_robinson_do_schools_kill_creativity", '<div class="ted-player__captions"><span>Hello TED</span></div>'],
    ["khanacademy", "www.khanacademy.org", "/math/algebra/x2f8bb11595b61c86:foundation-algebra/v/introduction-to-algebra", '<div class="khanacademy-video-captions"><span>Hello Khan</span></div>'],
  ] as const)("applies %s subtitle rendering metadata at runtime", async (id, hostname, pathname, html) => {
    setLocation(hostname, pathname)
    document.body.innerHTML = html

    await startVideoSubtitleTranslation()
    await flushPromises(6)

    const expected = EXPECTED_RENDERING_RULES[id]
    const subtitle = document.querySelector<HTMLElement>(".astra-video-subtitle")
    expect(subtitle?.textContent).toBe("翻译结果")
    expect(subtitle?.dataset.astraRenderRuleId).toBe(expected.ruleId)
    expect(subtitle?.dataset.astraRenderSurface).toBe(expected.surface)
    expect(subtitle?.dataset.astraRenderInsertionPoint).toBe(expected.insertionPoint)
    expect(subtitle?.dataset.astraNativeCuePolicy).toBe("preserve-native")
    expect(subtitle?.classList.contains(expected.className)).toBe(true)
    expect(subtitle?.style.getPropertyValue("--astra-caption-max-width")).not.toBe("")
    expect(subtitle?.style.getPropertyValue("--astra-caption-text-align")).toBe("center")
  })

  it("returns false for non-video pages", () => {
    setLocation("www.youtube.com", "/")
    expect(isVideoPage()).toBe(false)
  })

  it("does not start on non-video pages", async () => {
    setLocation("www.example.com", "/")
    await startVideoSubtitleTranslation()
    expect(document.getElementById("astra-video-subtitle-styles")).toBeNull()
  })

  it("uses YouTube timedtext prefetch + cue batch translate when player data is available", async () => {
    setLocation("www.youtube.com", "/watch")
    const { container } = appendYouTubeFixture("", 0.2)
    setYouTubePlayerResponse()
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => timedTextJson([
        { startMs: 0, durationMs: 1000, text: "Hello world" },
        { startMs: 1200, durationMs: 1000, text: "Second cue" },
      ]),
    } as Response)

    await startVideoSubtitleTranslation()
    await flushPromises(8)

    expect(document.getElementById("astra-video-subtitle-styles")).not.toBeNull()
    expect(String(fetchMock.mock.calls[0]?.[0] ?? "")).toContain("fmt=json3")
    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      texts: ["Hello world", "Second cue"],
      targetLang: DEFAULT_ASTRA_CONFIG.targetLang,
      task: "translate",
    }))
    expect(container.dataset.astraCaptionPipeline).toBe("youtube-hybrid")
    expect(container.dataset.astraCaptionSource).toBe("timedtext")
    expect(container.dataset.astraCaptionStatus).toBe("ready")
    const subtitle = document.querySelector<HTMLElement>(".astra-video-subtitle")
    expect(subtitle?.textContent).toBe("[translated] Hello world")
    expect(subtitle?.dataset.astraPresentationMode).toBe("bilingual")
    expect(subtitle?.dataset.astraPresentationTheme).toBe("default")
    expect(subtitle?.style.getPropertyValue("--astra-caption-font-size")).toBe("")
    expect(subtitle?.style.getPropertyValue("--astra-caption-color")).toBe("")
  })

  it("mounts a searchable bilingual YouTube transcript panel with click-to-seek", async () => {
    setLocation("www.youtube.com", "/watch")
    const { video } = appendYouTubeFixture("", 0.2)
    setYouTubePlayerResponse()
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => timedTextJson([
        { startMs: 0, durationMs: 1000, text: "Hello world" },
        { startMs: 1200, durationMs: 1000, text: "Second cue" },
      ]),
    } as Response)

    await startVideoSubtitleTranslation()
    await flushPromises(8)

    const panel = document.getElementById("astra-video-transcript-panel")
    expect(panel).not.toBeNull()
    expect(panel?.getAttribute("role")).toBe("complementary")
    expect(panel?.getAttribute("aria-label")).toBe("Astra Transcript Panel")
    expect(panel?.textContent).toContain("Summary")
    const panelStyles = document.getElementById("astra-video-transcript-panel-styles")
    expect(panelStyles?.textContent).toContain("background: rgba(255, 255, 255, 0.96)")
    expect(panelStyles?.textContent).toContain("color: #0f172a")

    const tabs = panel?.querySelector("[data-astra-transcript-tabs]") as HTMLElement | null
    expect(tabs?.getAttribute("role")).toBe("group")
    expect(tabs?.getAttribute("aria-label")).toBe("Transcript panel sections")
    const transcriptTab = Array.from(panel?.querySelectorAll("[data-astra-transcript-tabs] button") ?? [])
      .find((button) => button.textContent === "Transcript") as HTMLButtonElement
    expect(transcriptTab.getAttribute("aria-label")).toBe("Transcript section")
    transcriptTab.click()

    const activeTranscriptTab = Array.from(panel?.querySelectorAll("[data-astra-transcript-tabs] button") ?? [])
      .find((button) => button.textContent === "Transcript") as HTMLButtonElement
    expect(activeTranscriptTab.getAttribute("aria-pressed")).toBe("true")

    const status = panel?.querySelector("[data-astra-transcript-status]") as HTMLElement | null
    expect(status?.getAttribute("role")).toBe("status")
    expect(status?.getAttribute("aria-live")).toBe("polite")
    expect(status?.getAttribute("aria-atomic")).toBe("true")

    expect(panel?.textContent).toContain("[translated] Hello world")
    expect(panel?.querySelectorAll("[data-astra-transcript-row]")).toHaveLength(2)
    expect(panel?.querySelector("[data-astra-transcript-row]")?.getAttribute("data-active")).toBe("true")

    const search = panel?.querySelector("input[type='search']") as HTMLInputElement
    expect(search.getAttribute("aria-label")).toBe("Search transcript cues")
    search.value = "Second"
    search.dispatchEvent(new Event("input"))

    const filteredStatus = panel?.querySelector("[data-astra-transcript-status]") as HTMLElement | null
    expect(filteredStatus?.textContent).toBe("Search active for “Second”: 1 transcript row.")
    const filteredRows = panel?.querySelectorAll("[data-astra-transcript-row]")
    expect(filteredRows).toHaveLength(1)
    expect(filteredRows?.[0]?.textContent).toContain("Second cue")
    ;(filteredRows?.[0] as HTMLButtonElement).click()
    expect(video.currentTime).toBe(1.2)
  })

  it("generates video summary, chapters, words, notes, and review cards from the transcript", async () => {
    setLocation("www.youtube.com", "/watch")
    appendYouTubeFixture("", 0.2)
    setYouTubePlayerResponse()
    getMockBrowser().runtime.sendMessage.mockResolvedValue({
      type: "runtime/video-note:create-from-current-tab:success",
      payload: { jobId: "job-1", status: "queued" },
    })
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => timedTextJson([
        { startMs: 0, durationMs: 1000, text: "Learning phrases through daily practice" },
        { startMs: 60_000, durationMs: 1000, text: "Shadow native speakers and repeat useful chunks" },
        { startMs: 120_000, durationMs: 1000, text: "Review saved expressions before watching again" },
        { startMs: 180_000, durationMs: 1000, text: "Build confidence with short quizzes" },
      ]),
    } as Response)

    await startVideoSubtitleTranslation()
    await flushPromises(12)

    const panel = document.getElementById("astra-video-transcript-panel") as HTMLElement
    expect(runInlineActionMock).toHaveBeenCalledWith(expect.objectContaining({
      task: "custom",
      customSystemPrompt: expect.stringContaining("video summary"),
      text: expect.stringContaining("Learning phrases"),
    }))
    expect(panel.textContent).toContain("翻译结果")
    expect(panel.textContent).toContain("Chapters")
    expect(panel.textContent).toContain("Quiz")

    const wordsTab = Array.from(panel.querySelectorAll("[data-astra-transcript-tabs] button"))
      .find((button) => button.textContent === "Words") as HTMLButtonElement
    wordsTab.click()
    expect(panel.textContent).toContain("10 expressions worth mastering")
    const saveExpressions = Array.from(panel.querySelectorAll("button"))
      .find((button) => button.textContent === "Save 3 expressions to Review") as HTMLButtonElement
    saveExpressions.click()
    await flushPromises(4)
    expect(saveVocabularyEntryMock).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining("Learning phrases"),
      tags: ["video", "expression"],
    }))

    const notesTab = Array.from(panel.querySelectorAll("[data-astra-transcript-tabs] button"))
      .find((button) => button.textContent === "Notes") as HTMLButtonElement
    notesTab.click()
    const saveSummary = Array.from(panel.querySelectorAll("button"))
      .find((button) => button.textContent === "Save summary to Review") as HTMLButtonElement
    saveSummary.click()
    await flushPromises(4)
    expect(saveVocabularyEntryMock).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.any(String),
      explanation: "翻译结果",
      tags: ["video", "summary"],
    }))

    const source = await captureCurrentVideoNoteSource()
    expect(source?.capture?.learningContext).toEqual(expect.objectContaining({
      summary: "翻译结果",
      bilingualTranscriptSegments: expect.arrayContaining([
        expect.objectContaining({ text: "Learning phrases through daily practice", translation: "[translated] Learning phrases through daily practice" }),
      ]),
      savedWords: expect.arrayContaining([
        expect.objectContaining({ text: expect.stringContaining("Learning phrases") }),
      ]),
      savedSentences: expect.arrayContaining([
        expect.objectContaining({ explanation: "翻译结果" }),
      ]),
      watchProgress: expect.objectContaining({ currentTimeSec: 0.2 }),
      reviewStatus: expect.objectContaining({ reviewReady: true }),
    }))

    const saveVideoNote = Array.from(panel.querySelectorAll("button"))
      .find((button) => button.textContent === "Create video note") as HTMLButtonElement
    saveVideoNote.click()
    await flushPromises(4)
    expect(getMockBrowser().runtime.sendMessage).toHaveBeenCalledWith({
      type: "runtime/video-note:create-from-current-tab",
      payload: { forceRegenerate: false },
    })
  })

  it("supports transcript copy, explain, save sentence, and add word; export is removed for beta", async () => {
    setLocation("www.youtube.com", "/watch")
    appendYouTubeFixture("", 0.2)
    setYouTubePlayerResponse()
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => timedTextJson([
        { startMs: 0, durationMs: 1000, text: "Hello world" },
      ]),
    } as Response)

    await startVideoSubtitleTranslation()
    await flushPromises(8)

    const panel = document.getElementById("astra-video-transcript-panel") as HTMLElement
    const transcriptTab = Array.from(panel.querySelectorAll("[data-astra-transcript-tabs] button"))
      .find((button) => button.textContent === "Transcript") as HTMLButtonElement
    transcriptTab.click()
    const row = panel.querySelector("[data-astra-transcript-row]") as HTMLElement
    const getRowButton = (label: string) => Array.from(row.querySelectorAll("button"))
      .find((button) => button.textContent === label) as HTMLButtonElement

    getRowButton("Copy").click()
    await flushPromises(2)
    expect(copyTextToClipboardMock).toHaveBeenCalledWith(expect.stringContaining("Hello world"))

    getRowButton("Explain").click()
    await flushPromises(4)
    expect(runInlineActionMock).toHaveBeenCalledWith(expect.objectContaining({
      text: "Hello world",
      task: "explain",
      selectionContext: "YouTube transcript at 0:00",
    }))
    expect(panel.textContent).toContain("翻译结果")

    getRowButton("Save this line").click()
    await flushPromises(4)
    expect(saveVocabularyEntryMock).toHaveBeenCalledWith(expect.objectContaining({
      text: "Hello world",
      translation: "[translated] Hello world",
      url: "https://www.youtube.com/watch?t=0s",
      sourceContext: expect.objectContaining({
        surface: "video_transcript",
        sentenceText: "Hello world",
        pageUrl: "https://www.youtube.com/watch?t=0s",
        videoTimestampMs: 0,
      }),
    }))

    getRowButton("Add word").click()
    await flushPromises(4)
    expect(saveVocabularyEntryMock).toHaveBeenCalledWith(expect.objectContaining({
      text: "Hello",
      url: "https://www.youtube.com/watch?t=0s",
      sourceContext: expect.objectContaining({
        surface: "video_transcript",
        videoTimestampMs: 0,
      }),
    }))

    getRowButton("Speak").click()
    expect(window.speechSynthesis.speak).toHaveBeenCalledWith(expect.objectContaining({ text: "Hello world" }))

    const wordButton = row.querySelector('[data-astra-transcript-word="Hello"]') as HTMLButtonElement
    wordButton.click()
    await flushPromises(4)
    expect(runInlineActionMock).toHaveBeenCalledWith(expect.objectContaining({
      text: "Hello",
      task: "explain",
      selectionContext: "YouTube subtitle word in sentence: Hello world",
    }))
    expect(panel.textContent).toContain("English · pronunciation")
    const saveWord = Array.from(panel.querySelectorAll("button"))
      .find((button) => button.textContent === "Save word to Review") as HTMLButtonElement
    saveWord.click()
    await flushPromises(4)
    expect(saveVocabularyEntryMock).toHaveBeenCalledWith(expect.objectContaining({
      text: "Hello",
      explanation: "翻译结果",
      tags: ["video", "word"],
      url: "https://www.youtube.com/watch?t=0s",
      sourceContext: expect.objectContaining({
        contentSummary: expect.stringContaining("English"),
        videoTimestampMs: 0,
      }),
    }))

    // Transcript export (bilingual / SRT / learning-notes download) is intentionally
    // removed for the paid beta (YouTube ToS + source copyright); see transcript-panel.ts.
    expect(Array.from(panel.querySelectorAll("button")).some((button) => button.textContent === "Export bilingual transcript")).toBe(false)
    expect(Array.from(panel.querySelectorAll("button")).some((button) => button.textContent === "Export SRT")).toBe(false)
    expect(Array.from(panel.querySelectorAll("button")).some((button) => button.textContent === "Export learning notes")).toBe(false)
  })

  it("applies global presentation overrides to video subtitle spans", async () => {
    readConfigMock.mockResolvedValue({
      ...DEFAULT_ASTRA_CONFIG,
      presentation: {
        ...DEFAULT_ASTRA_CONFIG.presentation,
        mode: "translation-only",
        theme: "highlight",
        fontSize: 1.1,
        translationColor: "#22c55e",
      },
    })
    setLocation("www.youtube.com", "/watch")
    appendYouTubeFixture("Hello world")

    await startVideoSubtitleTranslation()
    await flushPromises(6)

    const subtitle = document.querySelector<HTMLElement>(".astra-video-subtitle")
    expect(subtitle?.textContent).toBe("翻译结果")
    expect(subtitle?.dataset.astraPresentationMode).toBe("translation-only")
    expect(subtitle?.dataset.astraPresentationTheme).toBe("highlight")
    expect(subtitle?.style.getPropertyValue("--astra-caption-font-size")).toBe("1.1em")
    expect(subtitle?.style.getPropertyValue("--astra-caption-color")).toBe("#22c55e")
  })

  it("lets site-specific presentation override global video subtitle styling", async () => {
    readConfigMock.mockResolvedValue({
      ...DEFAULT_ASTRA_CONFIG,
      presentation: {
        ...DEFAULT_ASTRA_CONFIG.presentation,
        theme: "underline",
        fontSize: 1.05,
        translationColor: "#111827",
      },
      sites: {
        "www.youtube.com": {
          enabled: true,
          alwaysTranslate: false,
          presentation: {
            mode: "translation-only",
            theme: "highlight",
            fontSize: 1.25,
            translationColor: "#f97316",
          },
        },
      },
    })
    setLocation("www.youtube.com", "/watch")
    appendYouTubeFixture("Hello world")

    await startVideoSubtitleTranslation()
    await flushPromises(6)

    const subtitle = document.querySelector<HTMLElement>(".astra-video-subtitle")
    expect(subtitle?.dataset.astraPresentationMode).toBe("translation-only")
    expect(subtitle?.dataset.astraPresentationTheme).toBe("highlight")
    expect(subtitle?.style.getPropertyValue("--astra-caption-font-size")).toBe("1.25em")
    expect(subtitle?.style.getPropertyValue("--astra-caption-color")).toBe("#f97316")
  })

  it("prefers authored YouTube tracks over ASR and target-language tracks", async () => {
    setLocation("www.youtube.com", "/watch")
    appendYouTubeFixture("", 0.2)
    setYouTubePlayerResponse([
      { baseUrl: "https://www.youtube.com/api/timedtext?v=abc123&lang=zh-CN", languageCode: "zh-CN", kind: "standard", isTranslatable: true },
      { baseUrl: "https://www.youtube.com/api/timedtext?v=abc123&lang=en-asr", languageCode: "en", kind: "asr", isTranslatable: true },
      { baseUrl: "https://www.youtube.com/api/timedtext?v=abc123&lang=en-manual", languageCode: "en", kind: "standard", isTranslatable: true },
    ])
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => ({
      ok: true,
      text: async () => timedTextJson([
        {
          startMs: 0,
          durationMs: 900,
          text: String(input).includes("en-manual") ? "Manual caption" : "Wrong caption",
        },
      ]),
    } as Response))

    await startVideoSubtitleTranslation()
    await flushPromises(8)

    expect(String(fetchMock.mock.calls[0]?.[0] ?? "")).toContain("en-manual")
    expect(document.querySelector(".astra-video-subtitle")?.textContent).toBe("[translated] Manual caption")
  })

  it("honors the currently selected YouTube caption track when the player menu exposes one", async () => {
    setLocation("www.youtube.com", "/watch")
    appendYouTubeFixture("", 0.2)
    document.body.insertAdjacentHTML("beforeend", `
      <div class="ytp-caption-menuitem" aria-checked="true">
        <span class="ytp-menuitem-label">English (auto-generated)</span>
      </div>
    `)
    setYouTubePlayerResponse([
      {
        baseUrl: "https://www.youtube.com/api/timedtext?v=abc123&lang=en-manual",
        languageCode: "en",
        kind: "standard",
        isTranslatable: true,
        name: { simpleText: "English" },
      },
      {
        baseUrl: "https://www.youtube.com/api/timedtext?v=abc123&lang=en-asr",
        languageCode: "en",
        kind: "asr",
        isTranslatable: true,
        name: { simpleText: "English (auto-generated)" },
      },
    ])
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => ({
      ok: true,
      text: async () => String(input).includes("en-asr")
        ? timedTextJson([{ startMs: 0, durationMs: 900, text: "Selected ASR caption" }])
        : timedTextJson([{ startMs: 0, durationMs: 900, text: "Manual caption" }]),
    } as Response))

    await startVideoSubtitleTranslation()
    await flushPromises(8)

    expect(String(fetchMock.mock.calls[0]?.[0] ?? "")).toContain("en-asr")
    expect(document.querySelector(".astra-video-subtitle")?.textContent).toBe("[translated] Selected ASR caption")
  })

  it("refreshes YouTube timedtext cues when the active caption track changes", async () => {
    setLocation("www.youtube.com", "/watch")
    const { container } = appendYouTubeFixture("", 0.2)
    setYouTubePlayerResponse("https://www.youtube.com/api/timedtext?v=abc123&lang=en-manual")
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => ({
      ok: true,
      text: async () => timedTextJson([
        {
          startMs: 0,
          durationMs: 900,
          text: String(input).includes("lang=ja") ? "切换后的字幕" : "Initial caption",
        },
      ]),
    } as Response))

    await startVideoSubtitleTranslation()
    await flushPromises(8)
    expect(document.querySelector(".astra-video-subtitle")?.textContent).toBe("[translated] Initial caption")

    setYouTubePlayerResponse("https://www.youtube.com/api/timedtext?v=abc123&lang=ja")
    container.innerHTML = '<div class="ytp-caption-window-bottom"><span class="ytp-caption-segment">切换后的字幕</span></div>'
    await flushPromises(10)

    expect(String(fetchMock.mock.calls.at(-1)?.[0] ?? "")).toContain("lang=ja")
    expect(document.querySelector(".astra-video-subtitle")?.textContent).toBe("[translated] 切换后的字幕")
  })

  it("keys YouTube timedtext cache by caption track fingerprint", async () => {
    setLocation("www.youtube.com", "/watch")
    const { container } = appendYouTubeFixture("", 0.2)
    setYouTubePlayerResponse("https://www.youtube.com/api/timedtext?v=abc123&lang=en-manual")
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => ({
      ok: true,
      text: async () => timedTextJson([
        {
          startMs: 0,
          durationMs: 900,
          text: "Shared caption",
        },
      ]),
    } as Response))

    await startVideoSubtitleTranslation()
    await flushPromises(8)
    expect(document.querySelector(".astra-video-subtitle")?.textContent).toBe("[translated] Shared caption")

    translateTextsMock.mockClear()
    setYouTubePlayerResponse("https://www.youtube.com/api/timedtext?v=abc123&lang=ja")
    container.innerHTML = '<div class="ytp-caption-window-bottom"><span class="ytp-caption-segment">Shared caption</span></div>'
    await flushPromises(10)

    expect(String(fetchMock.mock.calls.at(-1)?.[0] ?? "")).toContain("lang=ja")
    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      texts: ["Shared caption"],
      targetLang: DEFAULT_ASTRA_CONFIG.targetLang,
      task: "translate",
    }))
  })

  it("uses larger cue batches in fast subtitle mode", async () => {
    readConfigMock.mockResolvedValue({
      ...DEFAULT_ASTRA_CONFIG,
      serviceMode: "fast",
    })
    setLocation("www.youtube.com", "/watch")
    appendYouTubeFixture("", 0.2)
    setYouTubePlayerResponse()
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => timedTextJson(Array.from({ length: 25 }, (_, index) => ({
        startMs: index * 1_000,
        durationMs: 900,
        text: `Cue ${index + 1}`,
      }))),
    } as Response)

    await startVideoSubtitleTranslation()
    await flushPromises(8)

    expect(translateTextsMock).toHaveBeenCalledTimes(1)
    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      texts: Array.from({ length: 25 }, (_, index) => `Cue ${index + 1}`),
      serviceMode: "fast",
    }))
  })

  it("groups fragmented cues into sentence windows in best quality subtitle mode", async () => {
    readConfigMock.mockResolvedValue({
      ...DEFAULT_ASTRA_CONFIG,
      serviceMode: "best_quality",
    })
    setLocation("www.youtube.com", "/watch")
    appendYouTubeFixture("", 0.2)
    setYouTubePlayerResponse()
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => timedTextJson([
        { startMs: 0, durationMs: 600, text: "This is" },
        { startMs: 650, durationMs: 700, text: "a fragmented caption." },
        { startMs: 2_500, durationMs: 800, text: "Next sentence." },
      ]),
    } as Response)

    await startVideoSubtitleTranslation()
    await flushPromises(8)

    expect(translateTextsMock).toHaveBeenCalledTimes(1)
    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      texts: ["This is a fragmented caption.", "Next sentence."],
      serviceMode: "best_quality",
      customSystemPrompt: expect.stringContaining("Reconstruct fragmented captions"),
    }))
    expect(document.querySelector(".astra-video-subtitle")?.textContent).toBe("[translated] This is a fragmented caption.")
  })

  it("translates long YouTube transcripts by adaptive time windows and reuses cached windows", async () => {
    setLocation("www.youtube.com", "/watch")
    const { video, container } = appendYouTubeFixture("", 0.2)
    Object.defineProperty(video, "playbackRate", {
      configurable: true,
      writable: true,
      value: 2,
    })
    setYouTubePlayerResponse()
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => timedTextJson([
        { startMs: 0, durationMs: 900, text: "Window zero active" },
        { startMs: 60_000, durationMs: 900, text: "Window zero lookahead" },
        { startMs: 290_000, durationMs: 900, text: "Window zero tail" },
        { startMs: 360_000, durationMs: 900, text: "Window one first" },
        { startMs: 420_000, durationMs: 900, text: "Window one active" },
      ]),
    } as Response)

    await startVideoSubtitleTranslation()
    await flushPromises(8)

    expect(Number(container.dataset.astraCaptionLookaheadSeconds)).toBeGreaterThan(60)
    expect(container.dataset.astraCaptionWindowSeconds).toBe("300")
    expect(container.dataset.astraCaptionCachedWindows).toBe("1")
    expect(translateTextsMock).toHaveBeenCalledTimes(1)
    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      texts: ["Window zero active", "Window zero lookahead", "Window zero tail"],
    }))

    translateTextsMock.mockClear()
    video.currentTime = 420
    video.dispatchEvent(new Event("seeked"))
    await flushPromises(8)

    expect(container.dataset.astraCaptionCachedWindows).toBe("2")
    expect(translateTextsMock).toHaveBeenCalledTimes(1)
    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      texts: ["Window one first", "Window one active"],
    }))
    expect(document.querySelector(".astra-video-subtitle")?.textContent).toBe("[translated] Window one active")

    translateTextsMock.mockClear()
    video.currentTime = 0.2
    video.dispatchEvent(new Event("seeked"))
    await flushPromises(4)

    expect(translateTextsMock).not.toHaveBeenCalled()
    expect(document.querySelector(".astra-video-subtitle")?.textContent).toBe("[translated] Window zero active")
  })

  it("downgrades YouTube subtitle batch translation to fast mode after a quality-mode failure", async () => {
    readConfigMock.mockResolvedValue({
      ...DEFAULT_ASTRA_CONFIG,
      serviceMode: "best_quality",
    })
    setLocation("www.youtube.com", "/watch")
    const { container } = appendYouTubeFixture("", 0.2)
    setYouTubePlayerResponse()
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => timedTextJson([
        { startMs: 0, durationMs: 900, text: "Quality fallback caption" },
      ]),
    } as Response)
    translateTextsMock
      .mockResolvedValueOnce({ ok: false, error: "provider temporarily unavailable" })
      .mockResolvedValueOnce({ ok: true, translations: ["快速降级翻译"] })

    await startVideoSubtitleTranslation()
    await flushPromises(8)

    expect(translateTextsMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      serviceMode: "best_quality",
      context: expect.objectContaining({
        pageTitle: expect.any(String),
        pageUrl: expect.stringContaining("youtube.com"),
        contentSummary: expect.stringContaining("Quality fallback caption"),
      }),
      customSystemPrompt: expect.stringContaining("Reconstruct fragmented captions"),
    }))
    expect(translateTextsMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ serviceMode: "fast" }))
    expect(container.dataset.astraCaptionAnomalies).toContain("translation-downgraded")
    expect(document.querySelector(".astra-video-subtitle")?.textContent).toBe("快速降级翻译")
  })

  it("retries YouTube subtitle translations per cue when a batch response is incomplete", async () => {
    readConfigMock.mockResolvedValue({
      ...DEFAULT_ASTRA_CONFIG,
      serviceMode: "fast",
    })
    setLocation("www.youtube.com", "/watch")
    const { video } = appendYouTubeFixture("", 0.2)
    setYouTubePlayerResponse()
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => timedTextJson([
        { startMs: 0, durationMs: 900, text: "First retry cue" },
        { startMs: 1200, durationMs: 900, text: "Second retry cue" },
      ]),
    } as Response)
    translateTextsMock
      .mockResolvedValueOnce({ ok: true, translations: ["batch only returned one"] })
      .mockResolvedValueOnce({ ok: true, translations: ["逐句一"] })
      .mockResolvedValueOnce({ ok: true, translations: ["逐句二"] })

    await startVideoSubtitleTranslation()
    await flushPromises(10)

    expect(translateTextsMock).toHaveBeenCalledTimes(3)
    expect(translateTextsMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      texts: ["First retry cue"],
      serviceMode: "fast",
    }))
    expect(translateTextsMock).toHaveBeenNthCalledWith(3, expect.objectContaining({
      texts: ["Second retry cue"],
      serviceMode: "fast",
    }))
    expect(document.querySelector(".astra-video-subtitle")?.textContent).toBe("逐句一")

    video.currentTime = 1.4
    video.dispatchEvent(new Event("seeked"))
    await flushPromises(4)
    expect(document.querySelector(".astra-video-subtitle")?.textContent).toBe("逐句二")
  })

  it("shows Retry in the YouTube player control when subtitle batch translation fails", async () => {
    readConfigMock.mockResolvedValue({
      ...DEFAULT_ASTRA_CONFIG,
      serviceMode: "fast",
    })
    setLocation("www.youtube.com", "/watch")
    document.body.innerHTML = `
      <div class="html5-video-player">
        <div class="ytp-right-controls"></div>
      </div>
      <video id="astra-video"></video>
      <div class="ytp-caption-window-container">
        <div class="ytp-caption-window-bottom"></div>
      </div>
    `
    const video = document.querySelector("video") as HTMLVideoElement
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      writable: true,
      value: 0.2,
    })
    setYouTubePlayerResponse()
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => timedTextJson([
        { startMs: 0, durationMs: 900, text: "Retry caption" },
      ]),
    } as Response)
    translateTextsMock.mockResolvedValue({ ok: false, error: "provider unavailable" })

    await startVideoSubtitleTranslation()
    await flushPromises(8)

    const container = document.querySelector(".ytp-caption-window-container") as HTMLElement
    expect(container.dataset.astraCaptionStatus).toBe("translation-failed")
    expect(container.dataset.astraCaptionAnomalies).toContain("translation-failed")
    expect(document.querySelector("#astra-youtube-player-button")?.textContent).toContain("Retry")
  })

  it("reuses prefetched YouTube cues across seek/backtrack without retranslation", async () => {
    setLocation("www.youtube.com", "/watch")
    const { video } = appendYouTubeFixture("", 0.2)
    setYouTubePlayerResponse()
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => timedTextJson([
        { startMs: 0, durationMs: 900, text: "Hello world" },
        { startMs: 1200, durationMs: 900, text: "Second cue" },
      ]),
    } as Response)

    await startVideoSubtitleTranslation()
    await flushPromises(8)

    translateTextsMock.mockClear()
    runInlineActionMock.mockClear()

    video.currentTime = 1.4
    video.dispatchEvent(new Event("seeked"))
    await flushPromises()
    expect(document.querySelector(".astra-video-subtitle")?.textContent).toBe("[translated] Second cue")

    video.currentTime = 0.2
    video.dispatchEvent(new Event("seeked"))
    await flushPromises()
    expect(document.querySelector(".astra-video-subtitle")?.textContent).toBe("[translated] Hello world")

    expect(translateTextsMock).not.toHaveBeenCalled()
    expect(runInlineActionMock).not.toHaveBeenCalled()
  })

  it("does not let a late DOM fallback overwrite timedtext-backed translations", async () => {
    setLocation("www.youtube.com", "/watch")
    appendYouTubeFixture("Hello world", 0.2)
    setYouTubePlayerResponse()

    let resolveFallback: ((value: { ok: true; text: string }) => void) | undefined
    runInlineActionMock.mockImplementation(
      () => new Promise((resolve) => {
        resolveFallback = resolve as typeof resolveFallback
      }),
    )
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["批量翻译"],
    })
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => timedTextJson([
        { startMs: 0, durationMs: 900, text: "Hello world" },
      ]),
    } as Response)

    await startVideoSubtitleTranslation()
    await flushPromises(8)
    expect(document.querySelector(".astra-video-subtitle")?.textContent).toBe("批量翻译")

    resolveFallback?.({ ok: true, text: "晚到的 DOM 翻译" })
    await flushPromises(6)

    expect(document.querySelector(".astra-video-subtitle")?.textContent).toBe("批量翻译")
  })

  it("clears rendered subtitles when playback enters a gap with no cue and no DOM caption", async () => {
    setLocation("www.youtube.com", "/watch")
    const { video, container } = appendYouTubeFixture("", 0.2)
    setYouTubePlayerResponse()
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => timedTextJson([
        { startMs: 0, durationMs: 900, text: "Hello world" },
      ]),
    } as Response)

    await startVideoSubtitleTranslation()
    await flushPromises(8)
    expect(document.querySelector(".astra-video-subtitle")?.textContent).toBe("[translated] Hello world")

    container.innerHTML = '<div class="ytp-caption-window-bottom"></div>'
    video.currentTime = 2
    video.dispatchEvent(new Event("seeked"))
    await flushPromises(4)

    expect(document.querySelector(".astra-video-subtitle")).toBeNull()
  })

  it("clears stale YouTube timedtext overlays when caption tracks disappear", async () => {
    setLocation("www.youtube.com", "/watch")
    const { container } = appendYouTubeFixture("", 0.2)
    document.body.insertAdjacentHTML("afterbegin", '<div class="html5-video-player"><div class="ytp-right-controls"></div></div>')
    setYouTubePlayerResponse()
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => timedTextJson([
        { startMs: 0, durationMs: 900, text: "Hello world" },
      ]),
    } as Response)

    await startVideoSubtitleTranslation()
    await flushPromises(8)
    expect(document.querySelector(".astra-video-subtitle")?.textContent).toBe("[translated] Hello world")

    clearYouTubePlayerResponse()
    container.innerHTML = '<div class="ytp-caption-window-bottom"></div>'
    container.appendChild(document.createElement("span"))
    await flushPromises(6)

    expect(document.querySelector(".astra-video-subtitle")).toBeNull()
    expect(container.dataset.astraCaptionAnomalies).toContain("missing-track")
    expect(container.dataset.astraCaptionStatus).toBe("no-captions")
    const control = document.querySelector("#astra-youtube-player-button") as HTMLButtonElement | null
    expect(control?.textContent).toContain("No captions")
    expect(control?.title).toBe("No captions available for this video.")
  })

  it("binds the YouTube hybrid pipeline to the video in the same player subtree", async () => {
    setLocation("www.youtube.com", "/watch")
    document.body.innerHTML = `
      <video id="wrong-video"></video>
      <div class="html5-video-player">
        <video id="right-video"></video>
        <div class="ytp-caption-window-container">
          <div class="ytp-caption-window-bottom"></div>
        </div>
      </div>
    `

    const wrongVideo = document.getElementById("wrong-video") as HTMLVideoElement
    const rightVideo = document.getElementById("right-video") as HTMLVideoElement
    Object.defineProperty(wrongVideo, "currentTime", { configurable: true, writable: true, value: 1.4 })
    Object.defineProperty(rightVideo, "currentTime", { configurable: true, writable: true, value: 0.2 })

    setYouTubePlayerResponse()
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => timedTextJson([
        { startMs: 0, durationMs: 900, text: "First cue" },
        { startMs: 1200, durationMs: 900, text: "Second cue" },
      ]),
    } as Response)

    await startVideoSubtitleTranslation()
    await flushPromises(8)

    expect(document.querySelector(".astra-video-subtitle")?.textContent).toBe("[translated] First cue")
  })

  it("falls back to DOM translation and classifies missing tracks when player data is absent", async () => {
    setLocation("www.youtube.com", "/watch")
    const { container } = appendYouTubeFixture("Hello world")

    await startVideoSubtitleTranslation()
    await flushPromises(6)

    expect(runInlineActionMock).toHaveBeenCalledWith(expect.objectContaining({
      text: "Hello world",
      task: "translate",
    }))
    expect(container.dataset.astraCaptionAnomalies).toContain("missing-track")
    expect(container.dataset.astraCaptionSource).toBe("dom")
    expect(container.dataset.astraCaptionStatus).toBe("fallback-ready")
  })

  it("classifies delayed tracks when timedtext metadata exists but cues do not arrive promptly", async () => {
    setLocation("www.youtube.com", "/watch")
    const { container } = appendYouTubeFixture("Hello world")
    setYouTubePlayerResponse()

    let resolveFetch: ((value: Response) => void) | undefined
    fetchMock.mockImplementation(
      () => new Promise((resolve) => {
        resolveFetch = resolve as typeof resolveFetch
      }),
    )

    await startVideoSubtitleTranslation()
    await vi.advanceTimersByTimeAsync(1_600)
    await flushPromises(4)

    expect(container.dataset.astraCaptionAnomalies).toContain("delayed-track")
    expect(container.dataset.astraCaptionStatus).toBe("waiting-track")

    resolveFetch?.({
      ok: true,
      text: async () => "",
    } as Response)
    await flushPromises(4)
  })

  it("classifies duplicated cues when the same YouTube caption is replayed rapidly", async () => {
    setLocation("www.youtube.com", "/watch")
    const { container } = appendYouTubeFixture("Repeated line")

    await startVideoSubtitleTranslation()
    await flushPromises(6)

    container.innerHTML = `
      <div class="ytp-caption-window-bottom">
        <span class="ytp-caption-segment">Repeated line</span>
      </div>
    `
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises(4)

    expect(container.dataset.astraCaptionAnomalies).toContain("duplicated-cue")
  })

  it("classifies stale cue races when an old DOM fallback result resolves late", async () => {
    setLocation("www.youtube.com", "/watch")
    const { container } = appendYouTubeFixture("First line")

    let resolveFirst: ((value: { ok: true; text: string }) => void) | undefined
    let resolveSecond: ((value: { ok: true; text: string }) => void) | undefined
    runInlineActionMock.mockImplementation(({ text }: { text: string }) => {
      if (text === "First line") {
        return new Promise((resolve) => {
          resolveFirst = resolve as typeof resolveFirst
        })
      }
      return new Promise((resolve) => {
        resolveSecond = resolve as typeof resolveSecond
      })
    })

    await startVideoSubtitleTranslation()
    await flushPromises(4)

    container.innerHTML = `
      <div class="ytp-caption-window-bottom">
        <span class="ytp-caption-segment">Second line</span>
      </div>
    `
    await flushPromises(4)

    resolveFirst?.({ ok: true, text: "旧翻译" })
    await flushPromises(4)
    expect(container.dataset.astraCaptionAnomalies).toContain("stale-cue-race")

    resolveSecond?.({ ok: true, text: "新翻译" })
    await flushPromises(4)
    expect(document.querySelector(".astra-video-subtitle")?.textContent).toBe("新翻译")
  })

  it("uses layered textTrack pipeline for Vimeo before DOM fallback", async () => {
    setLocation("vimeo.com", "/123456789")
    document.body.innerHTML = `
      <div class="vp-video-wrapper">
        <video id="vimeo-video"></video>
        <div class="vp-captions"></div>
      </div>
    `
    const video = document.getElementById("vimeo-video") as HTMLVideoElement
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      writable: true,
      value: 0.2,
    })
    attachTextTracks(video, [makeTextTrack({
      language: "en",
      cues: [
        { startTime: 0, endTime: 1, text: "Hello Vimeo" },
        { startTime: 1.2, endTime: 2.2, text: "Second Vimeo cue" },
      ],
    })])

    await startVideoSubtitleTranslation()
    await flushPromises(8)

    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      texts: ["Hello Vimeo", "Second Vimeo cue"],
      targetLang: DEFAULT_ASTRA_CONFIG.targetLang,
      task: "translate",
    }))
    expect(document.querySelector(".vp-captions .astra-video-subtitle")?.textContent).toBe("[translated] Hello Vimeo")
    expect(document.querySelector(".vp-captions")?.getAttribute("data-astra-caption-source")).toBe("text-track")
  })

  it("uses layered textTrack pipeline for TED before DOM fallback", async () => {
    setLocation("www.ted.com", "/talks/sir_ken_robinson_do_schools_kill_creativity")
    document.body.innerHTML = `
      <div class="ted-player">
        <video id="ted-video"></video>
        <div class="ted-player__captions"></div>
      </div>
    `
    const video = document.getElementById("ted-video") as HTMLVideoElement
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      writable: true,
      value: 0.2,
    })
    attachTextTracks(video, [makeTextTrack({
      language: "en",
      cues: [
        { startTime: 0, endTime: 1, text: "Hello TED" },
        { startTime: 1.2, endTime: 2.2, text: "Second TED cue" },
      ],
    })])

    await startVideoSubtitleTranslation()
    await flushPromises(8)

    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      texts: ["Hello TED", "Second TED cue"],
      targetLang: DEFAULT_ASTRA_CONFIG.targetLang,
      task: "translate",
    }))
    expect(document.querySelector(".ted-player__captions .astra-video-subtitle")?.textContent).toBe("[translated] Hello TED")
    expect(document.querySelector(".ted-player__captions")?.getAttribute("data-astra-caption-source")).toBe("text-track")
  })

  it("uses layered textTrack pipeline for Khan Academy before DOM fallback", async () => {
    setLocation("www.khanacademy.org", "/math/algebra/x2f8bb11595b61c86:foundation-algebra/v/introduction-to-algebra")
    document.body.innerHTML = `
      <div class="ka-video-player">
        <video id="khan-video"></video>
        <div class="khanacademy-video-captions"></div>
      </div>
    `
    const video = document.getElementById("khan-video") as HTMLVideoElement
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      writable: true,
      value: 0.2,
    })
    attachTextTracks(video, [makeTextTrack({
      language: "en",
      cues: [
        { startTime: 0, endTime: 1, text: "Hello Khan" },
        { startTime: 1.2, endTime: 2.2, text: "Second Khan cue" },
      ],
    })])

    await startVideoSubtitleTranslation()
    await flushPromises(8)

    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      texts: ["Hello Khan", "Second Khan cue"],
      targetLang: DEFAULT_ASTRA_CONFIG.targetLang,
      task: "translate",
    }))
    expect(document.querySelector(".khanacademy-video-captions .astra-video-subtitle")?.textContent).toBe("[translated] Hello Khan")
    expect(document.querySelector(".khanacademy-video-captions")?.getAttribute("data-astra-caption-source")).toBe("text-track")
  })

  it("falls back to DOM translation for TED captions", async () => {
    setLocation("www.ted.com", "/talks/sir_ken_robinson_do_schools_kill_creativity")
    document.body.innerHTML = `
      <div class="ted-player__captions">
        <span>Hello TED</span>
        <span>Hello TED</span>
      </div>
    `

    await startVideoSubtitleTranslation()
    await flushPromises(4)

    expect(runInlineActionMock).toHaveBeenCalledWith(expect.objectContaining({
      text: "Hello TED",
      task: "translate",
    }))
    expect(document.querySelector(".ted-player__captions .astra-video-subtitle")?.textContent).toBe("翻译结果")
  })

  it("falls back to DOM translation for Vimeo captions", async () => {
    setLocation("vimeo.com", "/123456789")
    document.body.innerHTML = `
      <div class="vp-captions">
        <span>Hello Vimeo</span>
      </div>
    `

    await startVideoSubtitleTranslation()
    await flushPromises(4)

    expect(runInlineActionMock).toHaveBeenCalledWith(expect.objectContaining({
      text: "Hello Vimeo",
      task: "translate",
    }))
    expect(document.querySelector(".vp-captions .astra-video-subtitle")?.textContent).toBe("翻译结果")
  })

  it("falls back to DOM translation for Khan Academy captions", async () => {
    setLocation("www.khanacademy.org", "/math/algebra/x2f8bb11595b61c86:foundation-algebra/v/introduction-to-algebra")
    document.body.innerHTML = `
      <div class="khanacademy-video-captions">
        <span>Hello Khan</span>
        <span>Hello Khan</span>
      </div>
    `

    await startVideoSubtitleTranslation()
    await flushPromises(4)

    expect(runInlineActionMock).toHaveBeenCalledWith(expect.objectContaining({
      text: "Hello Khan",
      task: "translate",
    }))
    expect(document.querySelector(".khanacademy-video-captions .astra-video-subtitle")?.textContent).toBe("翻译结果")
  })

  it("uses layered textTrack pipeline for Bilibili before DOM fallback", async () => {
    setLocation("www.bilibili.com", "/video/BV1234567")
    document.body.innerHTML = `
      <div class="bpx-player-container">
        <video id="bili-video"></video>
        <div class="bpx-player-subtitle-panel"></div>
      </div>
    `
    const video = document.getElementById("bili-video") as HTMLVideoElement
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      writable: true,
      value: 0.2,
    })
    attachTextTracks(video, [makeTextTrack({
      language: "ja",
      cues: [
        { startTime: 0, endTime: 1, text: "第一句" },
        { startTime: 1.2, endTime: 2.2, text: "第二句" },
      ],
    })])

    await startVideoSubtitleTranslation()
    await flushPromises(8)

    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      texts: ["第一句", "第二句"],
      targetLang: DEFAULT_ASTRA_CONFIG.targetLang,
    }))
    expect(document.querySelector(".bpx-player-subtitle-panel .astra-video-subtitle")?.textContent).toBe("[translated] 第一句")
    expect(document.querySelector(".bpx-player-subtitle-panel")?.getAttribute("data-astra-caption-source")).toBe("text-track")
  })

  it("hydrates delayed Bilibili textTracks and upgrades from fallback to structured cues", async () => {
    setLocation("www.bilibili.com", "/video/BV1234567")
    document.body.innerHTML = `
      <div class="bpx-player-container">
        <video id="bili-video-delayed"></video>
        <div class="bpx-player-subtitle-panel"><span class="bpx-player-subtitle-panel-text">DOM 字幕</span></div>
      </div>
    `
    const video = document.getElementById("bili-video-delayed") as HTMLVideoElement
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      writable: true,
      value: 0.2,
    })

    const delayedTrack = makeTextTrack({ language: "ja", cues: [] }) as TextTrack & { cues: TextTrackCueList | null }
    attachTextTracks(video, [delayedTrack])

    await startVideoSubtitleTranslation()
    await flushPromises(6)
    expect(document.querySelector(".bpx-player-subtitle-panel .astra-video-subtitle")?.textContent).toBe("翻译结果")
    expect(document.querySelector(".bpx-player-subtitle-panel")?.getAttribute("data-astra-caption-source")).toBe("dom")

    delayedTrack.cues = Object.assign([
      { startTime: 0, endTime: 1, text: "结构化字幕" },
    ], {
      length: 1,
      item: (index: number) => index === 0 ? { startTime: 0, endTime: 1, text: "结构化字幕" } : null,
    }) as unknown as TextTrackCueList
    document.querySelector(".bpx-player-subtitle-panel")!.appendChild(document.createElement("span"))
    await flushPromises(10)

    expect(document.querySelector(".bpx-player-subtitle-panel .astra-video-subtitle")?.textContent).toBe("[translated] 结构化字幕")
    expect(document.querySelector(".bpx-player-subtitle-panel")?.getAttribute("data-astra-caption-source")).toBe("text-track")
  })

  it("does not re-inject structured subtitles after stop during delayed hydration", async () => {
    setLocation("www.netflix.com", "/watch/12345")
    document.body.innerHTML = `
      <div class="watch-video">
        <video id="netflix-stop-video"></video>
        <div class="player-timedtext-text-container"><span>Fallback line</span></div>
      </div>
    `
    const video = document.getElementById("netflix-stop-video") as HTMLVideoElement
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      writable: true,
      value: 0.2,
    })

    const delayedTrack = makeTextTrack({ language: "en", cues: [] }) as TextTrack & { cues: TextTrackCueList | null }
    attachTextTracks(video, [delayedTrack])

    await startVideoSubtitleTranslation()
    await flushPromises(6)
    expect(document.querySelector(".player-timedtext-text-container .astra-video-subtitle")?.textContent).toBe("翻译结果")

    stopVideoSubtitleTranslation()
    delayedTrack.cues = Object.assign([
      { startTime: 0, endTime: 1, text: "Late structured cue" },
    ], {
      length: 1,
      item: (index: number) => index === 0 ? { startTime: 0, endTime: 1, text: "Late structured cue" } : null,
    }) as unknown as TextTrackCueList
    document.querySelector(".player-timedtext-text-container")!.appendChild(document.createElement("span"))
    await flushPromises(10)

    expect(document.querySelector(".player-timedtext-text-container .astra-video-subtitle")).toBeNull()
  })

  it("uses layered textTrack pipeline for Netflix and reuses cues on seek", async () => {
    setLocation("www.netflix.com", "/watch/12345")
    document.body.innerHTML = `
      <div class="watch-video">
        <video id="netflix-video"></video>
        <div class="player-timedtext-text-container"></div>
      </div>
    `
    const video = document.getElementById("netflix-video") as HTMLVideoElement
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      writable: true,
      value: 0.2,
    })
    attachTextTracks(video, [makeTextTrack({
      language: "en",
      cues: [
        { startTime: 0, endTime: 1, text: "Good morning" },
        { startTime: 1.2, endTime: 2.2, text: "Good night" },
      ],
    })])

    await startVideoSubtitleTranslation()
    await flushPromises(8)

    translateTextsMock.mockClear()
    video.currentTime = 1.4
    video.dispatchEvent(new Event("seeked"))
    await flushPromises(4)

    expect(document.querySelector(".player-timedtext-text-container .astra-video-subtitle")?.textContent).toBe("[translated] Good night")
    expect(translateTextsMock).not.toHaveBeenCalled()
  })

  it("translates Bilibili subtitle panels", async () => {
    setLocation("www.bilibili.com", "/video/BV1234567")
    document.body.innerHTML = `
      <div class="bpx-player-subtitle-panel">
        <span class="bpx-player-subtitle-panel-text">你好世界</span>
      </div>
    `

    await startVideoSubtitleTranslation()
    await flushPromises(4)

    expect(runInlineActionMock).toHaveBeenCalledWith(expect.objectContaining({
      text: "你好世界",
      task: "translate",
    }))
  })

  it("translates Bilibili fallback captions when subtitle text uses alternate nested selectors", async () => {
    setLocation("www.bilibili.com", "/video/BV1234567")
    document.body.innerHTML = `
      <div class="bpx-player-subtitle-wrap">
        <div class="subtitle-panel-shell">
          <div class="subtitle-line-row">
            <span class="astra-bili-subtitle-text">变体字幕</span>
          </div>
          <div class="subtitle-line-row">
            <span class="astra-bili-subtitle-text">变体字幕</span>
          </div>
        </div>
      </div>
    `

    await startVideoSubtitleTranslation()
    await flushPromises(4)

    expect(runInlineActionMock).toHaveBeenCalledWith(expect.objectContaining({
      text: "变体字幕",
      task: "translate",
    }))
    expect(document.querySelector(".bpx-player-subtitle-wrap .astra-video-subtitle")?.textContent).toBe("翻译结果")
  })

  it("marks Bilibili as dom-fallback when subtitle surfaces are present but empty", async () => {
    setLocation("www.bilibili.com", "/video/BV1234567")
    document.body.innerHTML = `
      <div class="bpx-player-container">
        <video id="bili-empty-video"></video>
        <div class="bpx-player-subtitle-wrap">
          <div class="subtitle-panel-shell">
            <span class="astra-bili-subtitle-text"> </span>
          </div>
        </div>
      </div>
    `
    const video = document.getElementById("bili-empty-video") as HTMLVideoElement
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      writable: true,
      value: 0.2,
    })
    attachTextTracks(video, [])

    await startVideoSubtitleTranslation()
    await flushPromises(6)

    expect(runInlineActionMock).not.toHaveBeenCalled()
    expect(document.querySelector(".bpx-player-subtitle-wrap .astra-video-subtitle")).toBeNull()
    expect(document.querySelector(".bpx-player-subtitle-wrap")?.getAttribute("data-astra-caption-status")).toBe("dom-fallback")
  })

  it("translates Netflix timedtext containers", async () => {
    setLocation("www.netflix.com", "/watch/12345")
    document.body.innerHTML = `
      <div class="player-timedtext-text-container">
        <span>Good morning</span>
      </div>
    `

    await startVideoSubtitleTranslation()
    await flushPromises(4)

    expect(runInlineActionMock).toHaveBeenCalledWith(expect.objectContaining({
      text: "Good morning",
      task: "translate",
    }))
  })

  it("caches fallback translations across repeated YouTube caption changes", async () => {
    setLocation("www.youtube.com", "/watch")
    const { container } = appendYouTubeFixture("Hello")

    await startVideoSubtitleTranslation()
    await flushPromises(6)
    const callCount = runInlineActionMock.mock.calls.length

    container.innerHTML = `
      <div class="ytp-caption-window-bottom">
        <span class="ytp-caption-segment">Hello</span>
      </div>
    `
    await flushPromises(4)

    expect(runInlineActionMock.mock.calls.length).toBe(callCount)
  })

  it("cleans up on stop", async () => {
    setLocation("www.youtube.com", "/watch")
    appendYouTubeFixture("Hello world")

    await startVideoSubtitleTranslation()
    await flushPromises(6)

    stopVideoSubtitleTranslation()

    expect(document.getElementById("astra-video-subtitle-styles")).toBeNull()
    expect(document.querySelectorAll(".astra-video-subtitle")).toHaveLength(0)
  })
})
