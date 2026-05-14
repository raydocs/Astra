import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import type { Page } from "playwright"

import type { YouTubeSubtitleExecution } from "../../../bench/evaluators/youtube-subtitle"
import { buildYouTubeSubtitleFixtureHtml } from "../../../bench/scenarios/helpers/youtube-subtitle"
import {
  prepareLiveArtifactDir,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../../driver"
import type { LiveScenarioDefinition, LiveScenarioExecution } from "../../evaluator"
import { buildLiveYouTubeSubtitleEvaluation } from "../helpers/youtube-subtitle"

interface LiveStressDiagnostics {
  label: string
  orderedLines: string[]
}

interface LiveYouTubeSubtitleRaceExecution extends LiveScenarioExecution {
  youtubeSubtitle: YouTubeSubtitleExecution
  stressDiagnostics: LiveStressDiagnostics
}

const TARGET_LANG = "zh-CN"
const YOUTUBE_RUNTIME_SCRIPT_URL = new URL("../helpers/youtube-subtitle-runtime.js", import.meta.url)
const CANONICAL_YOUTUBE_PHASES = [
  "late-window-appear",
  "burst-duplicate-1",
  "pause-restored",
  "seeked-holdout-line",
  "seeked-cache-hit",
]

function formatBoolean(value: boolean) {
  return value ? "true" : "false"
}

function phaseRank(phase: string) {
  const index = CANONICAL_YOUTUBE_PHASES.indexOf(phase)
  return index === -1 ? CANONICAL_YOUTUBE_PHASES.length : index
}

function sortedUniqueCaptionSummary(values: string[]) {
  const captions = [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort()
  return captions.length > 0 ? captions.join("|") : "none"
}

function buildYouTubeSnapshotSummary(snapshots: YouTubeSubtitleExecution["captionSnapshots"]) {
  const lines = [...snapshots]
    .sort((a, b) => phaseRank(a.phase) - phaseRank(b.phase) || a.phase.localeCompare(b.phase))
    .map((snapshot) => `${snapshot.phase}:nodes=${snapshot.translationNodeCount}:state=${snapshot.stateLabel ?? "null"}`)

  return lines.length > 0 ? lines.join("|") : "none"
}

function buildYouTubeSubtitleRaceDiagnostics(youtubeSubtitle: YouTubeSubtitleExecution): LiveStressDiagnostics {
  const dedupeAligned = youtubeSubtitle.requestCount === youtubeSubtitle.uniqueCaptionTexts.length
  const allTranslated = youtubeSubtitle.uniqueCaptionTexts.length > 0
    && youtubeSubtitle.translatedCaptionTexts.length >= youtubeSubtitle.uniqueCaptionTexts.length
  const captionNodesStable = youtubeSubtitle.captionSnapshots.every((snapshot) => snapshot.translationNodeCount <= 1)

  return {
    label: "LSIR deterministic youtube-subtitle-race diagnostics",
    orderedLines: [
      "LSIR[01] scenario=bench-live/holdout/youtube-subtitle-race",
      "LSIR[02] target=youtube-subtitle",
      `LSIR[03] requests=requestCount:${youtubeSubtitle.requestCount},uniqueCaptionTexts:${youtubeSubtitle.uniqueCaptionTexts.length},translatedCaptionTexts:${youtubeSubtitle.translatedCaptionTexts.length}`,
      `LSIR[04] churn=duplicateCaptionUpdateCount:${youtubeSubtitle.duplicateCaptionUpdateCount},rapidUpdateCount:${youtubeSubtitle.rapidUpdateCount}`,
      `LSIR[05] transitions=pauseEvents:${youtubeSubtitle.pauseEvents},seekEvents:${youtubeSubtitle.seekEvents},seekPauseStable:${formatBoolean(youtubeSubtitle.seekPauseStable)}`,
      `LSIR[06] captions=${sortedUniqueCaptionSummary(youtubeSubtitle.uniqueCaptionTexts)}`,
      `LSIR[07] snapshots=${buildYouTubeSnapshotSummary(youtubeSubtitle.captionSnapshots)}`,
      `LSIR[08] verdict-signals=dedupeAligned:${formatBoolean(dedupeAligned)},allTranslated:${formatBoolean(allTranslated)},captionNodesStable:${formatBoolean(captionNodesStable)}`,
    ],
  }
}

function buildHoldoutFixtureHtml() {
  return buildYouTubeSubtitleFixtureHtml({
    title: "Astra Holdout YouTube Subtitle",
    url: "/watch?v=astra-youtube-holdout",
    captionLines: ["Holdout captions", "Holdout captions", "race mode"],
    initialState: "buffering",
  })
}

async function waitForCaptionWindow(page: Page, selector: string) {
  await page.waitForSelector(selector, { timeout: 10_000 })
}

export const youtubeSubtitleRaceHoldoutScenario: LiveScenarioDefinition<LiveYouTubeSubtitleRaceExecution> = {
  id: "bench-live/holdout/youtube-subtitle-race",
  title: "Holdout: YouTube subtitle race-condition",
  surface: "subtitle",
  fixture: "inline:youtube-subtitle-holdout",
  description:
    "Stresses YouTube-style subtitles with delayed caption window materialization, burst updates, duplicate lines, and pause/seek churn to validate that the runtime skeleton stays stable under harder timing conditions.",
  tags: ["playwright", "subtitle", "youtube", "browser", "holdout", "race-condition"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting YouTube subtitle race-condition holdout scenario.", {
      targetLang: TARGET_LANG,
    })

    try {
      const artifactDir = await prepareLiveArtifactDir(context.runId)
      const fixtureHtml = buildHoldoutFixtureHtml()
      const htmlPath = path.join(artifactDir, "youtube-subtitle-race.html")
      await mkdir(path.dirname(htmlPath), { recursive: true })
      await writeFile(htmlPath, fixtureHtml, "utf8")

      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        await page.setContent(fixtureHtml, { waitUntil: "domcontentloaded" })
        await waitForCaptionWindow(page, ".ytp-caption-window-container")

        const baselineScreenshotPath = path.join(artifactDir, "youtube-subtitle-race.baseline.png")
        await page.screenshot({ path: baselineScreenshotPath, fullPage: true })

        const runtimeScript = await readFile(YOUTUBE_RUNTIME_SCRIPT_URL, "utf8")
        await page.addScriptTag({ content: runtimeScript })

        const result = await page.evaluate(async (options) => {
          const runtime = (window as typeof window & {
            __astraYouTubeSubtitleRuntime?: {
              run: (options: Record<string, unknown>) => Promise<unknown>
            }
          }).__astraYouTubeSubtitleRuntime
          if (!runtime?.run) {
            return { success: false, error: "missing youtube subtitle runtime helper" }
          }
          return await runtime.run(options)
        }, {
          targetLang: TARGET_LANG,
          translationDelayMs: 45,
          initialCaptionLines: ["Holdout captions", "Holdout captions", "race mode"],
          initialStateLabel: "buffering",
          initialPhase: "late-window-appear",
          duplicatePhase: "burst-duplicate-1",
          pauseStateLabel: "paused",
          pausePhase: "pause-restored",
          seekCaptionLines: ["Seeked holdout line", "Seeked holdout line", "race mode"],
          seekStateLabel: "seeking",
          seekPhase: "seeked-holdout-line",
          seekCacheHitPhase: "seeked-cache-hit",
          seekExpectedSourceText: "Seeked holdout line race mode",
          finalWaitMs: 90,
        }) as {
          success: boolean
          error?: string
          requestCount?: number
          duplicateCaptionUpdateCount?: number
          rapidUpdateCount?: number
          pauseEvents?: number
          seekEvents?: number
          seekPauseStable?: boolean
          uniqueCaptionTexts?: string[]
          translatedCaptionTexts?: string[]
          captionSnapshots?: YouTubeSubtitleExecution["captionSnapshots"]
          payloadContext?: Record<string, unknown> | null
        }

        const translationScreenshotPath = path.join(artifactDir, "youtube-subtitle-race.post-translation.png")
        await page.screenshot({ path: translationScreenshotPath, fullPage: true })
        const snapshotHtml = await page.content()
        const snapshotHtmlPath = path.join(artifactDir, "youtube-subtitle-race.snapshot.html")
        await writeFile(snapshotHtmlPath, snapshotHtml, "utf8")

        return {
          browserExecutablePath,
          baselineScreenshotPath,
          translationScreenshotPath,
          snapshotHtmlPath,
          result,
        }
      })

      runtime.checkpoint("Holdout YouTube subtitle race page materialized.", {
        htmlPath,
        url: `setContent://${htmlPath}`,
      })
      runtime.attachArtifact("fixturePage", {
        htmlPath,
        url: `setContent://${htmlPath}`,
      })
      runtime.attachArtifact("browser", {
        executablePath: capture.browserExecutablePath,
      })
      runtime.attachArtifact("youtubeSubtitleHoldoutCapture", {
        baselineScreenshotPath: capture.baselineScreenshotPath,
        translationScreenshotPath: capture.translationScreenshotPath,
        snapshotHtmlPath: capture.snapshotHtmlPath,
      })

      const result = capture.result
      const youtubeSubtitle: YouTubeSubtitleExecution = result.success
        ? {
            requestCount: result.requestCount ?? 0,
            uniqueCaptionTexts: result.uniqueCaptionTexts ?? [],
            translatedCaptionTexts: result.translatedCaptionTexts ?? [],
            duplicateCaptionUpdateCount: result.duplicateCaptionUpdateCount ?? 0,
            rapidUpdateCount: result.rapidUpdateCount ?? 0,
            pauseEvents: result.pauseEvents ?? 0,
            seekEvents: result.seekEvents ?? 0,
            seekPauseStable: result.seekPauseStable ?? false,
            captionSnapshots: result.captionSnapshots ?? [],
            payloadContext: null,
          }
        : {
            requestCount: 0,
            uniqueCaptionTexts: [],
            translatedCaptionTexts: [],
            duplicateCaptionUpdateCount: 0,
            rapidUpdateCount: 0,
            pauseEvents: 0,
            seekEvents: 0,
            seekPauseStable: false,
            captionSnapshots: [],
            payloadContext: null,
          }

      const stressDiagnostics = buildYouTubeSubtitleRaceDiagnostics(youtubeSubtitle)

      runtime.complete("Holdout YouTube subtitle race scenario completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary:
          "Executed the holdout YouTube subtitle race condition: delayed caption window materialization, duplicate bursts, and pause/seek churn all remained stable.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Artifact directory: ${artifactDir}`,
          `Unique caption states: ${youtubeSubtitle.uniqueCaptionTexts.length}`,
          `Translation requests: ${youtubeSubtitle.requestCount}`,
          `Duplicate caption updates: ${youtubeSubtitle.duplicateCaptionUpdateCount}`,
        ],
        artifacts: {
          browserExecutablePath: capture.browserExecutablePath,
          htmlPath,
          baselineScreenshotPath: capture.baselineScreenshotPath,
          translationScreenshotPath: capture.translationScreenshotPath,
          snapshotHtmlPath: capture.snapshotHtmlPath,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        youtubeSubtitle,
        stressDiagnostics,
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        const youtubeSubtitle: YouTubeSubtitleExecution = {
          requestCount: 0,
          uniqueCaptionTexts: [],
          translatedCaptionTexts: [],
          duplicateCaptionUpdateCount: 0,
          rapidUpdateCount: 0,
          pauseEvents: 0,
          seekEvents: 0,
          seekPauseStable: false,
          captionSnapshots: [],
          payloadContext: null,
        }
        const stressDiagnostics = buildYouTubeSubtitleRaceDiagnostics(youtubeSubtitle)
        return {
          status: snapshot.status,
          summary:
            "The holdout YouTube subtitle race scenario is wired, but no supported local browser executable is available in this environment.",
          notes: [error.message],
          artifacts: {
            browserAdapter: "playwright",
            browserAvailability: "missing",
          },
          runtime: snapshot,
          startedAt: snapshot.startedAt,
          finishedAt: snapshot.finishedAt,
          youtubeSubtitle,
          stressDiagnostics,
        }
      }

      throw error
    }
  },
  async evaluate(execution, context) {
    return buildLiveYouTubeSubtitleEvaluation(execution, context.runId, context.scenario, context.runtime, {
      successSummary: "Holdout YouTube subtitle race passed: delayed window materialization and burst updates stayed stable.",
      failureSummary: "Holdout YouTube subtitle race failed: delayed window materialization, dedupe, or pause/seek handling diverged.",
    })
  },
}
