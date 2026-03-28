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

interface LiveYouTubeSubtitleRaceExecution extends LiveScenarioExecution {
  youtubeSubtitle: YouTubeSubtitleExecution
}

const TARGET_LANG = "zh-CN"
const YOUTUBE_RUNTIME_SCRIPT_URL = new URL("../helpers/youtube-subtitle-runtime.js", import.meta.url)

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
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
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
          youtubeSubtitle: {
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
          },
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
