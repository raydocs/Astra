import { startVideoSubtitleTranslation, stopVideoSubtitleTranslation, clearVideoSubtitleCache } from "@/entrypoints/content/video-platforms"

import { installBenchBrowser } from "../runtime/browser"
import { cleanupDomEnvironment, flushMicrotasks, installDomEnvironment } from "../runtime/dom"
import { mountFixture } from "../runtime/fixtures"
import { evaluateYouTubeSubtitle, type YouTubeSubtitleExecution } from "../evaluators/youtube-subtitle"
import type { BenchmarkScenario, ScenarioCodeHint } from "../types"
import {
  buildYouTubeSubtitleFixtureBody,
  extractYouTubeCaptionSnapshot,
  normalizeYouTubeCaptionText,
  updateYouTubeCaptionMarkup,
} from "./helpers/youtube-subtitle"

const YOUTUBE_SUBTITLE_HINT: ScenarioCodeHint = {
  suspectedFiles: [
    "src/entrypoints/content/video-platforms/youtube.ts",
    "src/entrypoints/content/video-platforms/index.ts",
    "src/entrypoints/content/video-platforms/types.ts",
    "src/entrypoints/content/inline-actions.ts",
    "src/utils/translate/translate.ts",
  ],
  suspectedSymbols: [
    "youtubePlatform",
    "extractCaptionText",
    "startVideoSubtitleTranslation",
    "handleCaptionMutation",
    "runInlineAction",
  ],
  suspectedKeywords: [
    "ytp-caption-segment",
    "dedupe",
    "pause",
    "seek",
    "subtitle window",
  ],
  fallbackSurfaceFiles: [
    "src/entrypoints/content/video-platforms/youtube.ts",
    "src/entrypoints/content/video-platforms/index.ts",
  ],
  risk: "cross-module",
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

function buildCaptionSequenceSnapshots(
  phase: string,
  container: HTMLElement,
  snapshots: YouTubeSubtitleExecution["captionSnapshots"],
) {
  const snapshot = extractYouTubeCaptionSnapshot(container)
  snapshots.push({
    phase,
    sourceText: snapshot.sourceText,
    translationText: snapshot.translationText,
    translationNodeCount: snapshot.translationNodeCount,
    stateLabel: snapshot.stateLabel,
  })
}

async function runYouTubeSubtitleScenario() {
  installDomEnvironment("https://www.youtube.com/watch?v=astra-youtube-subtitle")
  try {
    const browser = installBenchBrowser({
      translateBatch: async (payload) => {
        await new Promise((resolve) => window.setTimeout(resolve, 35))
        return {
          type: "runtime/translate-batch:success" as const,
          payload: {
            translations: payload.texts.map((text) => `ZH:${normalizeYouTubeCaptionText(text)}`),
          },
        }
      },
    })

    const fixtureBody = buildYouTubeSubtitleFixtureBody({
      url: "/watch?v=astra-youtube-subtitle",
      captionLines: ["Welcome to Astra", "Welcome to Astra", "subtitle mode"],
      initialState: "playing",
    })

    mountFixture(
      {
        kind: "inline",
        name: "youtube-subtitle",
        html: fixtureBody,
      },
      {
        title: "Astra Bench YouTube Subtitle",
        url: "/watch?v=astra-youtube-subtitle",
      },
    )

    const captionWindow = document.querySelector(".ytp-caption-window-container") as HTMLElement | null
    const video = document.getElementById("astra-youtube-video") as HTMLVideoElement | null
    if (!captionWindow || !video) {
      throw new Error("Missing YouTube subtitle fixture nodes.")
    }

    const snapshots: YouTubeSubtitleExecution["captionSnapshots"] = []
    const sourceTexts: string[] = []
    let duplicateCaptionUpdateCount = 0
    let rapidUpdateCount = 0
    let pauseEvents = 0
    let seekEvents = 0

    const recordSourceState = () => {
      const snapshot = extractYouTubeCaptionSnapshot(captionWindow)
      sourceTexts.push(snapshot.sourceText)
      buildCaptionSequenceSnapshots(`step-${snapshots.length}`, captionWindow, snapshots)
      return snapshot.sourceText
    }

    await startVideoSubtitleTranslation()
    await flushMicrotasks(4)

    // Capture the initial caption state after the translation observer starts.
    recordSourceState()

    // Rapid duplicate updates: same caption state is re-rendered twice before the first
    // translation request completes. This exercises pending-request dedupe.
    updateYouTubeCaptionMarkup(captionWindow, ["Welcome to Astra", "Welcome to Astra", "subtitle mode"], {
      stateLabel: "playing",
    })
    rapidUpdateCount += 1
    duplicateCaptionUpdateCount += 1
    recordSourceState()
    await flushMicrotasks(2)

    updateYouTubeCaptionMarkup(captionWindow, ["Welcome to Astra", "Welcome to Astra", "subtitle mode"], {
      stateLabel: "playing",
    })
    rapidUpdateCount += 1
    duplicateCaptionUpdateCount += 1
    recordSourceState()
    await flushMicrotasks(2)

    await wait(70)
    await flushMicrotasks(2)
    recordSourceState()

    // Pause-style stability: the same caption state is restored after a pause event.
    video.dispatchEvent(new Event("pause"))
    pauseEvents += 1
    updateYouTubeCaptionMarkup(captionWindow, ["Welcome to Astra", "Welcome to Astra", "subtitle mode"], {
      stateLabel: "paused",
    })
    recordSourceState()
    await wait(25)
    await flushMicrotasks(2)

    // Seek-style stability: a different caption state appears and should be translated once.
    video.dispatchEvent(new Event("seeked"))
    seekEvents += 1
    updateYouTubeCaptionMarkup(captionWindow, ["Seek to the next line", "Seek to the next line", "stability check"], {
      stateLabel: "seeking",
    })
    rapidUpdateCount += 1
    recordSourceState()
    await flushMicrotasks(2)
    await wait(80)
    await flushMicrotasks(2)
    recordSourceState()

    // Re-render the seeked caption once more to confirm the cache is used.
    updateYouTubeCaptionMarkup(captionWindow, ["Seek to the next line", "Seek to the next line", "stability check"], {
      stateLabel: "seeking",
    })
    duplicateCaptionUpdateCount += 1
    recordSourceState()
    await flushMicrotasks(2)

    const translateCalls = browser.getTranslateCalls()
    const translatedCaptionTexts = snapshots
      .map((snapshot) => snapshot.translationText)
      .filter((text): text is string => Boolean(text))

    const seekSnapshot = snapshots.find((snapshot) => snapshot.phase === "step-6") ?? null
    const seekPauseStable = Boolean(seekSnapshot?.translationText)
      && (seekSnapshot?.translationNodeCount ?? 0) === 1
      && (seekSnapshot?.sourceText ?? "") === "Seek to the next line stability check"

    const execution: YouTubeSubtitleExecution = {
      requestCount: translateCalls.length,
      uniqueCaptionTexts: [...new Set(sourceTexts.map((text) => normalizeYouTubeCaptionText(text)).filter(Boolean))],
      translatedCaptionTexts: [...new Set(translatedCaptionTexts)],
      duplicateCaptionUpdateCount,
      rapidUpdateCount,
      pauseEvents,
      seekEvents,
      seekPauseStable,
      captionSnapshots: snapshots,
      payloadContext: (translateCalls[0]?.payload.context ?? null) as Record<string, unknown> | null,
    }

    return execution
  } finally {
    stopVideoSubtitleTranslation()
    clearVideoSubtitleCache()
    cleanupDomEnvironment()
  }
}

export const youtubeSubtitleScenarios: BenchmarkScenario<YouTubeSubtitleExecution>[] = [
  {
    id: "subtitle/youtube-bilingual-segment-updates",
    title: "YouTube captions survive rapid segment updates, dedupe, and pause/seek churn",
    surface: "subtitle",
    fixture: "inline:youtube-subtitle",
    task: "Translate YouTube-style captions while preserving dedupe and seek/pause stability under rapid segment updates.",
    codeHint: YOUTUBE_SUBTITLE_HINT,
    run: runYouTubeSubtitleScenario,
    evaluate: (execution) => evaluateYouTubeSubtitle(execution),
  },
]
