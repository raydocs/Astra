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

interface LiveYouTubeProofExecution extends LiveScenarioExecution {
  youtubeSubtitle: YouTubeSubtitleExecution
  proofSignals: Record<string, unknown>
}

type YouTubeProofSignal =
  | "playerButton"
  | "inPlayerSettings"
  | "bilingualSubtitle"
  | "seekRecovery"
  | "trackSwitch"
  | "transcriptPanel"
  | "transcriptSearchJump"
  | "saveSentenceReviewLoop"
  | "videoNoteCreate"

interface YouTubeProofScenarioConfig {
  id: string
  title: string
  description: string
  artifactSlug: string
  captionLines: string[]
  seekCaptionLines: string[]
  seekExpectedSourceText: string
  requiredProofSignals: YouTubeProofSignal[]
  trackSwitchCaptionLines?: string[]
  transcriptSearchQuery?: string
}

const TARGET_LANG = "zh-CN"
const YOUTUBE_RUNTIME_SCRIPT_URL = new URL("./helpers/youtube-subtitle-runtime.js", import.meta.url)

function buildLiveFixtureHtml(config: YouTubeProofScenarioConfig) {
  return buildYouTubeSubtitleFixtureHtml({
    title: config.title,
    url: `/watch?v=${config.artifactSlug}`,
    captionLines: config.captionLines,
    initialState: "playing",
  })
}

async function waitForCaptionWindow(page: Page, selector: string) {
  await page.waitForSelector(selector, { timeout: 10_000 })
}

function toYouTubeSubtitleExecution(result: {
  success: boolean
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
}): YouTubeSubtitleExecution {
  return result.success
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
        payloadContext: result.payloadContext ?? null,
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
}

function numberSignal(proofSignals: Record<string, unknown>, key: string): number {
  const value = proofSignals[key]
  return typeof value === "number" ? value : 0
}

function stringSignal(proofSignals: Record<string, unknown>, key: string): string {
  const value = proofSignals[key]
  return typeof value === "string" ? value : ""
}

function evaluateProofSignals(
  execution: LiveYouTubeProofExecution,
  requiredSignals: YouTubeProofSignal[],
): string[] {
  const issues: string[] = []
  const proofSignals = execution.proofSignals

  for (const signal of requiredSignals) {
    switch (signal) {
      case "playerButton":
        if (proofSignals.playerButtonVisible !== true) {
          issues.push("YouTube player Astra button proof signal was missing.")
        }
        break
      case "inPlayerSettings":
        if (proofSignals.inPlayerSettingsPopoverVisible !== true
          || proofSignals.inPlayerSettingsModeControl !== "translation-only"
          || proofSignals.inPlayerSettingsPositionControl !== "top"
          || proofSignals.inPlayerSettingsRestoreNative !== true) {
          issues.push("YouTube in-player settings proof did not expose mode, position, and restore-native controls.")
        }
        break
      case "bilingualSubtitle":
        if (execution.youtubeSubtitle.uniqueCaptionTexts.length === 0 || execution.youtubeSubtitle.translatedCaptionTexts.length === 0) {
          issues.push("Bilingual subtitle proof did not capture both source and translated caption text.")
        }
        break
      case "seekRecovery":
        if (!execution.youtubeSubtitle.seekPauseStable || execution.youtubeSubtitle.seekEvents === 0) {
          issues.push("Seek recovery proof did not preserve a translated caption after seek.")
        }
        break
      case "trackSwitch":
        if (numberSignal(proofSignals, "trackSwitchTranslationCount") < 3 || !stringSignal(proofSignals, "trackSwitchSourceText")) {
          issues.push("Track-switch proof did not translate the switched caption track.")
        }
        break
      case "transcriptPanel":
        if (proofSignals.transcriptPanelVisible !== true || numberSignal(proofSignals, "transcriptRowCount") < 1) {
          issues.push("Transcript panel proof did not render transcript rows.")
        }
        break
      case "transcriptSearchJump":
        if (numberSignal(proofSignals, "transcriptSearchResultCount") < 1 || numberSignal(proofSignals, "transcriptJumpDeltaMs") > 500) {
          issues.push("Transcript search/jump proof did not find a transcript row and jump within 500ms of its timestamp.")
        }
        break
      case "saveSentenceReviewLoop":
        if (numberSignal(proofSignals, "savedSentenceCount") < 1 || !stringSignal(proofSignals, "reviewReturnUrl").includes("t=42s")) {
          issues.push("Save-sentence review loop proof did not create a timestamp return URL.")
        }
        break
      case "videoNoteCreate":
        if (proofSignals.videoNoteCreateVisible !== true || proofSignals.videoNoteCreated !== true) {
          issues.push("Video-note create proof did not expose and activate Create video note.")
        }
        break
    }
  }

  return issues
}

function createYouTubeProofScenario(config: YouTubeProofScenarioConfig): LiveScenarioDefinition<LiveYouTubeProofExecution> {
  return {
    id: config.id,
    title: config.title,
    surface: "subtitle",
    fixture: "inline:youtube-proof",
    description: config.description,
    tags: ["playwright", "subtitle", "youtube", "browser", "p2.7-proof"],
    async run(runtime, context) {
      runtime.start(context.id, context.title)
      runtime.log("Starting YouTube proof live scenario.", {
        targetLang: TARGET_LANG,
        requiredProofSignals: config.requiredProofSignals,
      })

      try {
        const artifactDir = await prepareLiveArtifactDir(context.runId)
        const fixtureHtml = buildLiveFixtureHtml(config)
        const htmlPath = path.join(artifactDir, `${config.artifactSlug}.html`)
        await mkdir(path.dirname(htmlPath), { recursive: true })
        await writeFile(htmlPath, fixtureHtml, "utf8")

        const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
          await page.setContent(fixtureHtml, { waitUntil: "domcontentloaded" })
          await waitForCaptionWindow(page, ".ytp-caption-window-container")

          const baselineScreenshotPath = path.join(artifactDir, `${config.artifactSlug}.baseline.png`)
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
            initialCaptionLines: config.captionLines,
            initialStateLabel: "playing",
            initialPhase: "initial",
            duplicatePhase: "rapid-duplicate",
            pauseStateLabel: "paused",
            pausePhase: "pause-restored",
            seekCaptionLines: config.seekCaptionLines,
            seekStateLabel: "seeking",
            seekPhase: "seeked-new-caption",
            seekCacheHitPhase: "seeked-cache-hit",
            seekExpectedSourceText: config.seekExpectedSourceText,
            requiredProofSignals: config.requiredProofSignals,
            trackSwitchCaptionLines: config.trackSwitchCaptionLines,
            transcriptSearchQuery: config.transcriptSearchQuery,
            trackSwitchStateLabel: "track-switch",
            trackSwitchPhase: "track-switch",
            payloadContext: {
              scenarioId: config.id,
              requiredProofSignals: config.requiredProofSignals,
            },
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
            proofSignals?: Record<string, unknown>
          }

          const proofScreenshotPath = path.join(artifactDir, `${config.artifactSlug}.proof.png`)
          await page.screenshot({ path: proofScreenshotPath, fullPage: true })
          const snapshotHtml = await page.content()
          const snapshotHtmlPath = path.join(artifactDir, `${config.artifactSlug}.snapshot.html`)
          await writeFile(snapshotHtmlPath, snapshotHtml, "utf8")

          return {
            browserExecutablePath,
            baselineScreenshotPath,
            proofScreenshotPath,
            snapshotHtmlPath,
            result,
          }
        })

        runtime.checkpoint("YouTube proof fixture page materialized.", {
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
        runtime.attachArtifact("youtubeProofCapture", {
          baselineScreenshotPath: capture.baselineScreenshotPath,
          proofScreenshotPath: capture.proofScreenshotPath,
          snapshotHtmlPath: capture.snapshotHtmlPath,
        })

        const youtubeSubtitle = toYouTubeSubtitleExecution(capture.result)
        const proofSignals = capture.result.proofSignals ?? {}

        runtime.complete("YouTube proof scenario completed.")
        const snapshot = runtime.snapshot()

        return {
          status: snapshot.status,
          summary: `Executed ${config.title}: ${config.requiredProofSignals.join(", ")}.`,
          notes: [
            `Browser executable: ${capture.browserExecutablePath}`,
            `Artifact directory: ${artifactDir}`,
            `Required proof signals: ${config.requiredProofSignals.join(", ")}`,
            `Proof signals: ${JSON.stringify(proofSignals)}`,
          ],
          artifacts: {
            browserExecutablePath: capture.browserExecutablePath,
            htmlPath,
            baselineScreenshotPath: capture.baselineScreenshotPath,
            proofScreenshotPath: capture.proofScreenshotPath,
            snapshotHtmlPath: capture.snapshotHtmlPath,
          },
          runtime: snapshot,
          startedAt: snapshot.startedAt,
          finishedAt: snapshot.finishedAt,
          youtubeSubtitle,
          proofSignals,
        }
      } catch (error) {
        if (error instanceof LiveBrowserUnavailableError) {
          runtime.skip(error.message)
          const snapshot = runtime.snapshot()
          return {
            status: snapshot.status,
            summary: `${config.title} is wired, but no supported local browser executable is available in this environment.`,
            notes: [error.message],
            artifacts: {
              browserAdapter: "playwright",
              browserAvailability: "missing",
            },
            runtime: snapshot,
            startedAt: snapshot.startedAt,
            finishedAt: snapshot.finishedAt,
            youtubeSubtitle: toYouTubeSubtitleExecution({ success: false }),
            proofSignals: {},
          }
        }

        throw error
      }
    },
    async evaluate(execution, context) {
      const base = await buildLiveYouTubeSubtitleEvaluation(execution, context.runId, context.scenario, context.runtime, {
        successSummary: `${config.title} passed: subtitle stability and required YouTube proof signals were captured.`,
        failureSummary: `${config.title} failed: subtitle stability or required YouTube proof signals diverged.`,
      }) as Partial<LiveEvaluationResult>
      const proofIssues = evaluateProofSignals(execution, config.requiredProofSignals)
      const issues = [...(base.issues ?? []), ...proofIssues]
      const pass = Boolean(base.pass) && proofIssues.length === 0

      return {
        ...base,
        status: pass ? "pass" : base.status === "skipped" ? "skipped" : "fail",
        pass,
        score: proofIssues.length === 0 ? (base.score ?? 0) : Math.max(0, (base.score ?? 0) - 20 * proofIssues.length),
        summary: pass
          ? `${config.title} passed: ${config.requiredProofSignals.join(", ")}.`
          : `${config.title} failed: ${issues.join(" | ")}`,
        issues,
        nextActions: proofIssues.length > 0
          ? [...(base.nextActions ?? []), "Inspect YouTube live proof signals and rerun this scenario."]
          : (base.nextActions ?? []),
        notes: [
          ...(base.notes ?? []),
          `requiredProofSignals=${config.requiredProofSignals.join(",")}`,
          `proofSignals=${JSON.stringify(execution.proofSignals)}`,
        ],
        artifacts: {
          ...(base.artifacts as Record<string, unknown> | undefined),
          youtubeProofSignals: execution.proofSignals,
        } as unknown as LiveEvaluationResult["artifacts"],
      }
    },
  }
}

const COMMON_SEEK_LINES = ["Seek to the next line", "Seek to the next line", "stability check"]
const COMMON_SEEK_TEXT = "Seek to the next line stability check"

export const youtubeSubtitlePlayerButtonScenario = createYouTubeProofScenario({
  id: "bench-live/youtube-subtitle-player-button",
  title: "YouTube player Astra button proof",
  description: "Proves that a YouTube watch fixture can expose an in-player Astra control while subtitles remain stable.",
  artifactSlug: "youtube-subtitle-player-button",
  captionLines: ["Player button", "Player button", "proof"],
  seekCaptionLines: COMMON_SEEK_LINES,
  seekExpectedSourceText: COMMON_SEEK_TEXT,
  requiredProofSignals: ["playerButton", "bilingualSubtitle"],
})

export const youtubeSubtitleInPlayerSettingsScenario = createYouTubeProofScenario({
  id: "bench-live/youtube-subtitle-in-player-settings",
  title: "YouTube in-player subtitle settings proof",
  description: "Proves the YouTube player fixture exposes Astra subtitle mode, size/background, position, retry, and native-caption restore controls.",
  artifactSlug: "youtube-subtitle-in-player-settings",
  captionLines: ["Player settings", "Player settings", "proof"],
  seekCaptionLines: COMMON_SEEK_LINES,
  seekExpectedSourceText: COMMON_SEEK_TEXT,
  requiredProofSignals: ["playerButton", "inPlayerSettings", "bilingualSubtitle"],
})

export const youtubeSubtitleBasicBilingualScenario = createYouTubeProofScenario({
  id: "bench-live/youtube-subtitle-basic-bilingual",
  title: "YouTube bilingual subtitle proof",
  description: "Proves YouTube-style captions produce a bilingual source/translation overlay in a live browser fixture.",
  artifactSlug: "youtube-subtitle-basic-bilingual",
  captionLines: ["Welcome to Astra", "Welcome to Astra", "bilingual mode"],
  seekCaptionLines: COMMON_SEEK_LINES,
  seekExpectedSourceText: COMMON_SEEK_TEXT,
  requiredProofSignals: ["bilingualSubtitle"],
})

export const youtubeSubtitleSeekRecoveryScenario = createYouTubeProofScenario({
  id: "bench-live/youtube-subtitle-seek-recovery",
  title: "YouTube subtitle seek recovery proof",
  description: "Proves translated YouTube captions recover after pause/seek churn without duplicate overlay nodes.",
  artifactSlug: "youtube-subtitle-seek-recovery",
  captionLines: ["Seek recovery", "Seek recovery", "before jump"],
  seekCaptionLines: ["Recovered after seek", "Recovered after seek", "stable caption"],
  seekExpectedSourceText: "Recovered after seek stable caption",
  requiredProofSignals: ["bilingualSubtitle", "seekRecovery"],
})

export const youtubeSubtitleTrackSwitchScenario = createYouTubeProofScenario({
  id: "bench-live/youtube-subtitle-track-switch",
  title: "YouTube subtitle track switch proof",
  description: "Proves a switched caption track receives a fresh bilingual translation after the initial track and seek cache pass.",
  artifactSlug: "youtube-subtitle-track-switch",
  captionLines: ["Original caption", "Original caption", "track"],
  seekCaptionLines: COMMON_SEEK_LINES,
  seekExpectedSourceText: COMMON_SEEK_TEXT,
  trackSwitchCaptionLines: ["Switched caption", "Switched caption", "new track"],
  requiredProofSignals: ["bilingualSubtitle", "trackSwitch"],
})

export const youtubeTranscriptPanelScenario = createYouTubeProofScenario({
  id: "bench-live/youtube-transcript-panel",
  title: "YouTube transcript panel proof",
  description: "Proves the YouTube learning workspace can expose transcript tabs and timestamped transcript rows in the live fixture.",
  artifactSlug: "youtube-transcript-panel",
  captionLines: ["Transcript panel", "Transcript panel", "row one"],
  seekCaptionLines: COMMON_SEEK_LINES,
  seekExpectedSourceText: COMMON_SEEK_TEXT,
  requiredProofSignals: ["bilingualSubtitle", "transcriptPanel"],
})

export const youtubeTranscriptSearchJumpScenario = createYouTubeProofScenario({
  id: "bench-live/youtube-transcript-search-jump",
  title: "YouTube transcript search jump proof",
  description: "Proves the YouTube transcript panel can search transcript rows and jump playback to the matched timestamp within the remediation tolerance.",
  artifactSlug: "youtube-transcript-search-jump",
  captionLines: ["Search panel", "Search panel", "initial row"],
  seekCaptionLines: ["Search jump target", "Search jump target", "timestamp row"],
  seekExpectedSourceText: "Search jump target timestamp row",
  transcriptSearchQuery: "Search jump target",
  requiredProofSignals: ["bilingualSubtitle", "transcriptPanel", "transcriptSearchJump"],
})

export const youtubeSaveSentenceReviewLoopScenario = createYouTubeProofScenario({
  id: "bench-live/youtube-save-sentence-review-loop",
  title: "YouTube save sentence review loop proof",
  description: "Proves a saved YouTube sentence can hand off to Review with a return-to-video timestamp URL.",
  artifactSlug: "youtube-save-sentence-review-loop",
  captionLines: ["Save this sentence", "Save this sentence", "for review"],
  seekCaptionLines: COMMON_SEEK_LINES,
  seekExpectedSourceText: COMMON_SEEK_TEXT,
  requiredProofSignals: ["bilingualSubtitle", "transcriptPanel", "saveSentenceReviewLoop"],
})

export const youtubeVideoNoteCreateScenario = createYouTubeProofScenario({
  id: "bench-live/youtube-video-note-create",
  title: "YouTube video-note create proof",
  description: "Proves the YouTube learning workspace exposes and activates Create video note from the live fixture.",
  artifactSlug: "youtube-video-note-create",
  captionLines: ["Create video note", "Create video note", "proof"],
  seekCaptionLines: COMMON_SEEK_LINES,
  seekExpectedSourceText: COMMON_SEEK_TEXT,
  requiredProofSignals: ["bilingualSubtitle", "transcriptPanel", "videoNoteCreate"],
})
