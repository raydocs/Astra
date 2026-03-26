import { removeTranslatedSubtitles, translatePageSubtitles } from "@/entrypoints/content/subtitle-translate"

import { evaluateSubtitle, type SubtitleExecution } from "../evaluators/subtitle"
import { installBenchBrowser } from "../runtime/browser"
import { cleanupDomEnvironment, installDomEnvironment } from "../runtime/dom"
import { mountFixture } from "../runtime/fixtures"
import type { BenchmarkScenario } from "../types"

interface BenchCue {
  startTime: number
  endTime: number
  text: string
}

interface BenchTrack extends TextTrack {
  addedCues: BenchCue[]
}

function installVttCueMock() {
  const previous = (globalThis as Record<string, unknown>).VTTCue

  class BenchVTTCue {
    startTime: number
    endTime: number
    text: string

    constructor(startTime: number, endTime: number, text: string) {
      this.startTime = startTime
      this.endTime = endTime
      this.text = text
    }
  }

  Object.defineProperty(globalThis, "VTTCue", {
    configurable: true,
    writable: true,
    value: BenchVTTCue,
  })

  return {
    createCue(startTime: number, endTime: number, text: string) {
      return new BenchVTTCue(startTime, endTime, text) as unknown as VTTCue
    },
    restore() {
      if (previous === undefined) {
        delete (globalThis as Record<string, unknown>).VTTCue
        return
      }

      Object.defineProperty(globalThis, "VTTCue", {
        configurable: true,
        writable: true,
        value: previous,
      })
    },
  }
}

function createTrack(options: {
  kind?: string
  label?: string
  mode?: TextTrackMode
  cues?: VTTCue[]
}): BenchTrack {
  const cues = options.cues ?? []
  const cuesList = Object.assign([...cues], { length: cues.length })
  const addedCues: BenchCue[] = []

  return {
    kind: options.kind ?? "subtitles",
    label: options.label ?? "",
    mode: options.mode ?? "showing",
    cues: cuesList as unknown as TextTrackCueList,
    activeCues: null,
    inBandMetadataTrackDispatchType: "",
    language: "en",
    id: options.label ?? "",
    oncuechange: null,
    addCue(cue: TextTrackCue) {
      addedCues.push({
        startTime: cue.startTime,
        endTime: cue.endTime,
        text: (cue as VTTCue).text,
      })
    },
    removeCue() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true
    },
    addedCues,
  } as unknown as BenchTrack
}

function attachTracks(video: HTMLVideoElement, tracks: BenchTrack[]) {
  const trackList = [...tracks]
  const textTrackList = {
    item(index: number) {
      return trackList[index] ?? null
    },
    [Symbol.iterator]() {
      return trackList[Symbol.iterator]()
    },
  } as Record<string | symbol, unknown>

  function syncIndices() {
    Object.keys(textTrackList)
      .filter((key) => /^\d+$/.test(key))
      .forEach((key) => {
        delete textTrackList[key]
      })

    trackList.forEach((track, index) => {
      textTrackList[index] = track
    })

    Object.defineProperty(textTrackList, "length", {
      configurable: true,
      enumerable: false,
      get: () => trackList.length,
    })
  }

  syncIndices()

  Object.defineProperty(video, "textTracks", {
    configurable: true,
    get: () => textTrackList,
  })

  const originalAppendChild = video.appendChild.bind(video)
  video.appendChild = ((node: Node) => {
    const result = originalAppendChild(node)
    if (node instanceof HTMLTrackElement) {
      trackList.push(createTrack({
        kind: node.kind || "subtitles",
        label: node.label,
        mode: "disabled",
        cues: [],
      }))
      syncIndices()
    }
    return result
  }) as typeof video.appendChild

  return trackList
}

async function runSubtitleTranslationScenario(options: {
  privacyMode?: boolean
  sourceMode?: TextTrackMode
  url?: string
}) {
  installDomEnvironment(`https://example.com${options.url ?? "/watch"}`)
  const vtt = installVttCueMock()
  try {
    const browser = installBenchBrowser({
      config: {
        privacyMode: options.privacyMode ?? false,
        provider: {
          id: "openai",
          accessToken: "bench-token",
          apiKey: "",
          relayBaseURL: "https://astra.example/v1",
          model: "gpt-5.4-nano",
        },
      },
    })

    mountFixture(
      {
        kind: "inline",
        name: "subtitle-video",
        html: `<main><video id="video"><track label="English" kind="subtitles" /></video></main>`,
      },
      {
        title: "Astra Bench Subtitle Translation",
        metaDescription: "Fixture for subtitle translation benchmark.",
        url: options.url ?? "/watch",
      },
    )

    const video = document.getElementById("video") as HTMLVideoElement | null
    if (!video) {
      throw new Error("Missing video fixture node.")
    }

    const sourceTrack = createTrack({
      kind: "subtitles",
      label: "English",
      mode: options.sourceMode ?? "showing",
      cues: [
        vtt.createCue(0, 1, "hello"),
        vtt.createCue(1, 2, "world"),
      ],
    })

    const tracks = attachTracks(video, [sourceTrack])
    const sourceModeBefore = sourceTrack.mode

    await translatePageSubtitles()

    const translateCalls = browser.getTranslateCalls()
    const translatedTrack = tracks.find((track) => track.label.startsWith("Astra: "))

    const execution: SubtitleExecution = {
      requestCount: translateCalls.length,
      translatedCueCount: translatedTrack?.addedCues.length ?? 0,
      translatedCueTexts: translatedTrack?.addedCues.map((cue) => cue.text) ?? [],
      astraTrackCount: tracks.filter((track) => track.label.startsWith("Astra: ")).length,
      astraTrackLabels: tracks.filter((track) => track.label.startsWith("Astra: ")).map((track) => track.label),
      sourceModeBefore,
      sourceModeAfter: sourceTrack.mode,
      payloadContext: (translateCalls[0]?.payload.context ?? null) as Record<string, unknown> | null,
      removedTrackCount: 0,
      requestBatchSizes: translateCalls.map((call) => call.payload.texts.length),
    }

    return execution
  } finally {
    vtt.restore()
    cleanupDomEnvironment()
  }
}

async function runSubtitleCleanupScenario() {
  installDomEnvironment("https://example.com/watch/cleanup")
  try {
    mountFixture(
      {
        kind: "inline",
        name: "subtitle-cleanup",
        html: `
          <main>
            <video id="video-a">
              <track label="English" kind="subtitles" />
              <track label="Astra: zh-CN" kind="subtitles" />
            </video>
            <video id="video-b">
              <track label="Astra: ja" kind="captions" />
              <track label="French" kind="captions" />
            </video>
          </main>
        `,
      },
      {
        title: "Astra Bench Subtitle Cleanup",
        metaDescription: "Fixture for subtitle cleanup benchmark.",
        url: "/watch/cleanup",
      },
    )

    const before = document.querySelectorAll("video track").length
    removeTranslatedSubtitles()
    const after = document.querySelectorAll("video track").length

    const execution: SubtitleExecution = {
      requestCount: 0,
      translatedCueCount: 0,
      translatedCueTexts: [],
      astraTrackCount: document.querySelectorAll('video track[label^="Astra: "]').length,
      astraTrackLabels: Array.from(document.querySelectorAll('video track[label^="Astra: "]'))
        .map((track) => track.getAttribute("label") ?? ""),
      sourceModeBefore: null,
      sourceModeAfter: null,
      payloadContext: null,
      removedTrackCount: before - after,
      requestBatchSizes: [],
    }

    return execution
  } finally {
    cleanupDomEnvironment()
  }
}

export const subtitleScenarios: BenchmarkScenario<SubtitleExecution>[] = [
  {
    id: "subtitle/translate-track-success",
    title: "Subtitle translation injects one Astra track and restores the original track mode",
    surface: "subtitle",
    fixture: "inline:subtitle-video",
    task: "Translate visible subtitle cues into a dedicated Astra track without leaving the source track stuck in hidden mode.",
    run: () => runSubtitleTranslationScenario({ sourceMode: "disabled", url: "/watch/subtitles" }),
    evaluate: (execution) => evaluateSubtitle(execution, {
      shouldTranslate: true,
      expectedCueCount: 2,
      expectSourceModeRestored: true,
    }),
  },
  {
    id: "subtitle/privacy-sanitized-context",
    title: "Privacy mode strips subtitle translation context down to hostname and canonical path",
    surface: "subtitle",
    fixture: "inline:subtitle-video",
    task: "Translate subtitle cues in privacy mode without leaking query strings, hashes, or page metadata.",
    run: () => runSubtitleTranslationScenario({
      privacyMode: true,
      sourceMode: "showing",
      url: "/watch/video?token=secret#frag",
    }),
    evaluate: (execution) => evaluateSubtitle(execution, {
      shouldTranslate: true,
      expectedCueCount: 2,
      requirePrivacySanitization: true,
    }),
  },
  {
    id: "subtitle/remove-astra-tracks",
    title: "Subtitle cleanup removes only Astra-labeled tracks from the page",
    surface: "subtitle",
    fixture: "inline:subtitle-cleanup",
    task: "Clean up translated subtitle tracks without deleting user or source subtitle tracks.",
    run: runSubtitleCleanupScenario,
    evaluate: (execution) => evaluateSubtitle(execution, {
      shouldTranslate: false,
      expectedRemovedTracks: 2,
    }),
  },
]
