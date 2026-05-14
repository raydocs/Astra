import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import type { Page } from "playwright"

import type { YouTubeSubtitleExecution } from "../../bench/evaluators/youtube-subtitle"
import { buildYouTubeSubtitleFixtureHtml } from "../../bench/scenarios/helpers/youtube-subtitle"
import {
  prepareLiveArtifactDir,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../driver"
import type { LiveEvaluationResult, LiveScenarioDefinition, LiveScenarioExecution } from "../evaluator"
import { buildLiveYouTubeSubtitleEvaluation } from "./helpers/youtube-subtitle"

interface LiveYouTubeSubtitleBasicExecution extends LiveScenarioExecution {
  youtubeSubtitle: YouTubeSubtitleExecution
}

const TARGET_LANG = "zh-CN"
const YOUTUBE_RUNTIME_SCRIPT_URL = new URL("./helpers/youtube-subtitle-runtime.js", import.meta.url)

function buildLiveFixtureHtml() {
  return buildYouTubeSubtitleFixtureHtml({
    title: "Astra Live YouTube Subtitle",
    url: "/watch?v=astra-live-youtube-subtitle",
    captionLines: ["Welcome to Astra", "Welcome to Astra", "subtitle mode"],
    initialState: "playing",
  })
}

async function waitForCaptionWindow(page: Page, selector: string) {
  await page.waitForSelector(selector, { timeout: 10_000 })
}

export const youtubeSubtitleBasicScenario: LiveScenarioDefinition<LiveYouTubeSubtitleBasicExecution> = {
  id: "bench-live/youtube-subtitle-basic",
  title: "Live YouTube subtitle adapter skeleton",
  surface: "subtitle",
  fixture: "inline:youtube-subtitle",
  description:
    "Exercises a fixture-equivalent YouTube subtitle runtime skeleton in a real browser, with rapid caption updates, duplicate suppression, and pause/seek stability.",
  tags: ["playwright", "subtitle", "youtube", "browser", "adapter-skeleton"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting live YouTube subtitle skeleton scenario.", {
      targetLang: TARGET_LANG,
    })

    try {
      const artifactDir = await prepareLiveArtifactDir(context.runId)
      const fixtureHtml = buildLiveFixtureHtml()
      const htmlPath = path.join(artifactDir, "youtube-subtitle-basic.html")
      await mkdir(path.dirname(htmlPath), { recursive: true })
      await writeFile(htmlPath, fixtureHtml, "utf8")

      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        await page.setContent(fixtureHtml, { waitUntil: "domcontentloaded" })
        await waitForCaptionWindow(page, ".ytp-caption-window-container")

        const baselineScreenshotPath = path.join(artifactDir, "youtube-subtitle-basic.baseline.png")
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
          translationDelayMs: 30,
          initialCaptionLines: ["Welcome to Astra", "Welcome to Astra", "subtitle mode"],
          initialStateLabel: "playing",
          initialPhase: "initial",
          duplicatePhase: "rapid-duplicate",
          pauseStateLabel: "paused",
          pausePhase: "pause-restored",
          seekCaptionLines: ["Seek to the next line", "Seek to the next line", "stability check"],
          seekStateLabel: "seeking",
          seekPhase: "seeked-new-caption",
          seekCacheHitPhase: "seeked-cache-hit",
          seekExpectedSourceText: "Seek to the next line stability check",
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

        const translationScreenshotPath = path.join(artifactDir, "youtube-subtitle-basic.post-translation.png")
        await page.screenshot({ path: translationScreenshotPath, fullPage: true })
        const snapshotHtml = await page.content()
        const snapshotHtmlPath = path.join(artifactDir, "youtube-subtitle-basic.snapshot.html")
        await writeFile(snapshotHtmlPath, snapshotHtml, "utf8")

        return {
          browserExecutablePath,
          baselineScreenshotPath,
          translationScreenshotPath,
          snapshotHtmlPath,
          result,
        }
      })

      runtime.checkpoint("Live YouTube subtitle fixture page materialized.", {
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
      runtime.attachArtifact("youtubeSubtitleCapture", {
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

      runtime.complete("Live YouTube subtitle adapter skeleton scenario completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary:
          "Executed the live YouTube subtitle skeleton: translated rapidly-updated caption segments with dedupe and pause/seek stability.",
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
            "The live YouTube subtitle adapter skeleton is wired, but no supported local browser executable is available in this environment.",
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
      successSummary: "Live YouTube subtitle skeleton passed: rapid segment updates, dedupe, and seek/pause stability all held.",
      failureSummary: "Live YouTube subtitle skeleton failed: caption extraction, dedupe, or pause/seek stability diverged from expectations.",
    })
  },
}
