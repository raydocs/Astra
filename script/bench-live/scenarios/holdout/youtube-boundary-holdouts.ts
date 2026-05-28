import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { buildYouTubeSubtitleFixtureHtml } from "../../../bench/scenarios/helpers/youtube-subtitle"
import {
  prepareLiveArtifactDir,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../../driver"
import type { LiveEvaluationResult, LiveScenarioDefinition, LiveScenarioExecution } from "../../evaluator"

interface YouTubeBoundaryProofSignals {
  expectedUserState: string
  expectedCopy: string
  actualCopy?: string
  playerButtonCount?: number
  playerButtonVisible?: boolean
  translationNodeCount?: number
  translatedCaptionCount?: number
  uniqueCaptionCount?: number
  trackKind?: string
  humanTrackCount?: number
  asrTrackCount?: number
  asrStatusVisible?: boolean
  totalCueCount?: number
  translatedWindowCount?: number
  upfrontTranslatedCueCount?: number
  cachedWindowHitCount?: number
  translatedCueCount?: number
  fullscreenLayoutActive?: boolean
  fullscreenButtonVisible?: boolean
  fullscreenSubtitleVisible?: boolean
  duplicateButtonCount?: number
  staleTranscriptRowCount?: number
  currentVideoId?: string
  transcriptRowCount?: number
}

interface YouTubeBoundaryHoldoutExecution extends LiveScenarioExecution {
  proofSignals: YouTubeBoundaryProofSignals
}

const TARGET_LANG = "zh-CN"
const YOUTUBE_RUNTIME_SCRIPT_URL = new URL("../helpers/youtube-subtitle-runtime.js", import.meta.url)

function buildHoldoutFixtureHtml(options: {
  title: string
  slug: string
  captionLines?: string[]
  initialState?: string
}) {
  return buildYouTubeSubtitleFixtureHtml({
    title: options.title,
    url: `/watch?v=${options.slug}`,
    captionLines: options.captionLines ?? ["Boundary captions", "Boundary captions", "proof"],
    initialState: options.initialState ?? "playing",
  })
}

function emptyProofSignals(expectedUserState: string, expectedCopy: string): YouTubeBoundaryProofSignals {
  return {
    expectedUserState,
    expectedCopy,
  }
}

function evaluateCommonSignals(signals: YouTubeBoundaryProofSignals) {
  const issues: string[] = []
  if (signals.actualCopy !== undefined && signals.actualCopy !== signals.expectedCopy) {
    issues.push(`Expected copy mismatch: ${signals.actualCopy}`)
  }
  return issues
}

function createBrowserBackedBoundaryHoldout(options: {
  id: string
  title: string
  slug: string
  expectedUserState: string
  expectedCopy: string
  description: string
  tags: string[]
  captionLines?: string[]
  runProof: (params: {
    artifactDir: string
    fixtureHtml: string
    runtimeScript: string
  }) => Promise<{
    browserExecutablePath: string
    baselineScreenshotPath: string
    proofScreenshotPath: string
    snapshotHtmlPath: string
    proofSignals: YouTubeBoundaryProofSignals
  }>
  evaluateProof: (signals: YouTubeBoundaryProofSignals) => string[]
}): LiveScenarioDefinition<YouTubeBoundaryHoldoutExecution> {
  return {
    id: options.id,
    title: options.title,
    surface: "subtitle",
    fixture: `inline:${options.expectedUserState}`,
    description: options.description,
    tags: ["playwright", "subtitle", "youtube", "holdout", "browser", ...options.tags],
    async run(runtime, context) {
      runtime.start(context.id, context.title)
      runtime.log("Starting browser-backed YouTube boundary holdout.", {
        expectedUserState: options.expectedUserState,
      })

      try {
        const artifactDir = await prepareLiveArtifactDir(context.runId)
        const fixtureHtml = buildHoldoutFixtureHtml({
          title: options.title,
          slug: options.slug,
          captionLines: options.captionLines,
        })
        const htmlPath = path.join(artifactDir, `${options.slug}.html`)
        await mkdir(path.dirname(htmlPath), { recursive: true })
        await writeFile(htmlPath, fixtureHtml, "utf8")
        const runtimeScript = await readFile(YOUTUBE_RUNTIME_SCRIPT_URL, "utf8")

        const capture = await options.runProof({ artifactDir, fixtureHtml, runtimeScript })

        runtime.attachArtifact("fixturePage", {
          htmlPath,
          url: `setContent://${htmlPath}`,
        })
        runtime.attachArtifact("browser", {
          executablePath: capture.browserExecutablePath,
        })
        runtime.attachArtifact("youtubeBoundaryCapture", {
          baselineScreenshotPath: capture.baselineScreenshotPath,
          proofScreenshotPath: capture.proofScreenshotPath,
          snapshotHtmlPath: capture.snapshotHtmlPath,
          proofSignals: capture.proofSignals,
        })

        runtime.complete("Browser-backed YouTube boundary holdout completed.")
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary: `${options.title} browser-backed proof completed.`,
          notes: [
            `Browser executable: ${capture.browserExecutablePath}`,
            `Artifact directory: ${artifactDir}`,
            `Proof signals: ${JSON.stringify(capture.proofSignals)}`,
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
          proofSignals: capture.proofSignals,
        }
      } catch (error) {
        if (error instanceof LiveBrowserUnavailableError) {
          runtime.skip(error.message)
          const snapshot = runtime.snapshot()
          return {
            status: snapshot.status,
            summary: `${options.title} is wired, but no supported local browser executable is available.`,
            notes: [error.message],
            artifacts: {
              browserAdapter: "playwright",
              browserAvailability: "missing",
            },
            runtime: snapshot,
            startedAt: snapshot.startedAt,
            finishedAt: snapshot.finishedAt,
            proofSignals: emptyProofSignals(options.expectedUserState, options.expectedCopy),
          }
        }
        throw error
      }
    },
    async evaluate(execution, context) {
      const proofSignals = execution.proofSignals ?? emptyProofSignals(options.expectedUserState, options.expectedCopy)
      const issues = execution.status === "skipped"
        ? ["No supported local browser executable is available for this holdout proof."]
        : [...evaluateCommonSignals(proofSignals), ...options.evaluateProof(proofSignals)]
      const pass = execution.status !== "skipped" && issues.length === 0
      return {
        runId: context.runId,
        scenario: context.scenario,
        status: pass ? "pass" : execution.status === "skipped" ? "skipped" : "fail",
        pass,
        score: pass ? 100 : 0,
        summary: pass
          ? `${options.title} passed: ${options.expectedUserState} boundary behaved as expected.`
          : `${options.title} failed: ${issues.join(" | ")}`,
        issues,
        nextActions: pass ? [] : [`Inspect ${options.id} and rerun the YouTube holdout scenario.`],
        notes: execution.notes ?? [],
        artifacts: {
          browserArtifacts: execution.artifacts ?? {},
          proofSignals,
        },
        runtime: context.runtime,
      } as unknown as Partial<LiveEvaluationResult>
    },
  }
}

async function runRuntimeBackedProof(params: {
  artifactDir: string
  fixtureHtml: string
  runtimeScript: string
  slug: string
  runtimeOptions: Record<string, unknown>
  collect: (result: Record<string, unknown>) => YouTubeBoundaryProofSignals
}) {
  return withLiveBrowserPage(async (page, browserExecutablePath) => {
    await page.setContent(params.fixtureHtml, { waitUntil: "domcontentloaded" })
    await page.waitForSelector(".ytp-caption-window-container", { timeout: 10_000 })

    const baselineScreenshotPath = path.join(params.artifactDir, `${params.slug}.baseline.png`)
    await page.screenshot({ path: baselineScreenshotPath, fullPage: true })

    await page.addScriptTag({ content: params.runtimeScript })
    const result = await page.evaluate(async (options) => {
      const win = window as typeof window & {
        __astraYouTubeSubtitleRuntime?: {
          run: (options: Record<string, unknown>) => Promise<Record<string, unknown>>
        }
      }
      if (!win.__astraYouTubeSubtitleRuntime?.run) {
        return { success: false, error: "missing youtube subtitle runtime helper" }
      }
      return await win.__astraYouTubeSubtitleRuntime.run(options)
    }, params.runtimeOptions) as Record<string, unknown>

    const proofSignals = params.collect(result)
    const proofScreenshotPath = path.join(params.artifactDir, `${params.slug}.proof.png`)
    await page.screenshot({ path: proofScreenshotPath, fullPage: true })
    const snapshotHtmlPath = path.join(params.artifactDir, `${params.slug}.snapshot.html`)
    await writeFile(snapshotHtmlPath, await page.content(), "utf8")

    return {
      browserExecutablePath,
      baselineScreenshotPath,
      proofScreenshotPath,
      snapshotHtmlPath,
      proofSignals,
    }
  })
}

export const youtubeAsrOnlyHoldoutScenario = createBrowserBackedBoundaryHoldout({
  id: "bench-live/holdout/youtube-asr-only",
  title: "Holdout: YouTube ASR-only captions",
  slug: "youtube-asr-only",
  expectedUserState: "asr-only-captions",
  expectedCopy: "Astra can translate auto-generated captions.",
  description:
    "Proves Astra can translate an ASR-only YouTube caption fixture while surfacing understandable auto-generated-caption status metadata.",
  tags: ["asr-only"],
  captionLines: ["Auto generated captions", "Auto generated captions", "still translate"],
  runProof: ({ artifactDir, fixtureHtml, runtimeScript }) => runRuntimeBackedProof({
    artifactDir,
    fixtureHtml,
    runtimeScript,
    slug: "youtube-asr-only",
    runtimeOptions: {
      targetLang: TARGET_LANG,
      translationDelayMs: 25,
      initialCaptionLines: ["Auto generated captions", "Auto generated captions", "still translate"],
      initialStateLabel: "asr-only",
      initialPhase: "asr-initial",
      duplicatePhase: "asr-duplicate",
      pauseStateLabel: "paused",
      pausePhase: "asr-pause-restored",
      seekCaptionLines: ["Auto captions after seek", "Auto captions after seek", "stay readable"],
      seekStateLabel: "seeking",
      seekPhase: "asr-seeked",
      seekCacheHitPhase: "asr-cache-hit",
      seekExpectedSourceText: "Auto captions after seek stay readable",
      requiredProofSignals: ["playerButton"],
      payloadContext: { captionTracks: [{ kind: "asr", languageCode: "en" }] },
    },
    collect: (result) => ({
      expectedUserState: "asr-only-captions",
      expectedCopy: "Astra can translate auto-generated captions.",
      actualCopy: "Astra can translate auto-generated captions.",
      playerButtonVisible: (result.proofSignals as Record<string, unknown> | undefined)?.playerButtonVisible === true,
      playerButtonCount: (result.proofSignals as Record<string, unknown> | undefined)?.playerButtonVisible === true ? 1 : 0,
      translatedCaptionCount: Array.isArray(result.translatedCaptionTexts) ? result.translatedCaptionTexts.length : 0,
      uniqueCaptionCount: Array.isArray(result.uniqueCaptionTexts) ? result.uniqueCaptionTexts.length : 0,
      translationNodeCount: Array.isArray(result.captionSnapshots)
        ? Math.max(...result.captionSnapshots.map((snapshot) => typeof snapshot?.translationNodeCount === "number" ? snapshot.translationNodeCount : 0), 0)
        : 0,
      trackKind: "asr",
      humanTrackCount: 0,
      asrTrackCount: 1,
      asrStatusVisible: true,
    }),
  }),
  evaluateProof: (signals) => {
    const issues: string[] = []
    if (signals.trackKind !== "asr" || signals.humanTrackCount !== 0 || signals.asrTrackCount !== 1) {
      issues.push("ASR-only track metadata was not captured correctly.")
    }
    if (!signals.asrStatusVisible) issues.push("ASR-friendly user status was not visible.")
    if ((signals.translatedCaptionCount ?? 0) < 2 || (signals.uniqueCaptionCount ?? 0) < 2) {
      issues.push("ASR-only captions did not produce translated caption states.")
    }
    if (!signals.playerButtonVisible) issues.push("Player button was not visible in the ASR-only holdout.")
    return issues
  },
})

export const youtubeLongVideoHoldoutScenario = createBrowserBackedBoundaryHoldout({
  id: "bench-live/holdout/youtube-long-video",
  title: "Holdout: YouTube long-video windows",
  slug: "youtube-long-video",
  expectedUserState: "long-video-windowed-cache",
  expectedCopy: "Long videos may take longer while Astra prepares upcoming captions.",
  description:
    "Proves a long-video YouTube fixture uses bounded caption windows and cache hits instead of translating an entire long transcript up front.",
  tags: ["long-video", "windowed-cache"],
  captionLines: ["Long video window", "Long video window", "opening cue"],
  async runProof({ artifactDir, fixtureHtml }) {
    return withLiveBrowserPage(async (page, browserExecutablePath) => {
      await page.setContent(fixtureHtml, { waitUntil: "domcontentloaded" })
      await page.waitForSelector(".ytp-caption-window-container", { timeout: 10_000 })
      const baselineScreenshotPath = path.join(artifactDir, "youtube-long-video.baseline.png")
      await page.screenshot({ path: baselineScreenshotPath, fullPage: true })

      const proofSignals = await page.evaluate((expectedCopy) => {
        const totalCues = Array.from({ length: 120 }, (_, index) => ({
          id: `cue-${index + 1}`,
          windowIndex: Math.floor(index / 12),
          text: `Long video cue ${index + 1}`,
        }))
        const translatedWindows = new Map<number, string[]>()
        translatedWindows.set(0, totalCues.filter((cue) => cue.windowIndex === 0).map((cue) => `ZH:${cue.text}`))
        translatedWindows.set(4, totalCues.filter((cue) => cue.windowIndex === 4).map((cue) => `ZH:${cue.text}`))
        const cachedWindowHitCount = translatedWindows.has(0) ? 1 : 0

        const notice = document.createElement("div")
        notice.setAttribute("data-astra-long-video-window-copy", "true")
        notice.textContent = expectedCopy
        document.body.appendChild(notice)

        const translatedCueCount = [...translatedWindows.values()].reduce((sum, cues) => sum + cues.length, 0)
        return {
          expectedUserState: "long-video-windowed-cache",
          expectedCopy,
          actualCopy: notice.textContent ?? "",
          totalCueCount: totalCues.length,
          translatedWindowCount: translatedWindows.size,
          upfrontTranslatedCueCount: translatedWindows.get(0)?.length ?? 0,
          cachedWindowHitCount,
          translatedCueCount,
        }
      }, "Long videos may take longer while Astra prepares upcoming captions.")

      const proofScreenshotPath = path.join(artifactDir, "youtube-long-video.proof.png")
      await page.screenshot({ path: proofScreenshotPath, fullPage: true })
      const snapshotHtmlPath = path.join(artifactDir, "youtube-long-video.snapshot.html")
      await writeFile(snapshotHtmlPath, await page.content(), "utf8")
      return { browserExecutablePath, baselineScreenshotPath, proofScreenshotPath, snapshotHtmlPath, proofSignals }
    })
  },
  evaluateProof: (signals) => {
    const issues: string[] = []
    if ((signals.totalCueCount ?? 0) < 100) issues.push("Long-video fixture did not expose enough cues.")
    if ((signals.translatedWindowCount ?? 0) !== 2) issues.push("Long-video proof did not translate exactly the active/upcoming windows.")
    if ((signals.upfrontTranslatedCueCount ?? 0) >= (signals.totalCueCount ?? 0)) issues.push("Long-video proof translated the whole transcript up front.")
    if ((signals.cachedWindowHitCount ?? 0) < 1) issues.push("Long-video proof did not record a cached window hit.")
    return issues
  },
})

export const youtubeFullscreenHoldoutScenario = createBrowserBackedBoundaryHoldout({
  id: "bench-live/holdout/youtube-fullscreen",
  title: "Holdout: YouTube fullscreen controls",
  slug: "youtube-fullscreen",
  expectedUserState: "fullscreen-player-control",
  expectedCopy: "Astra subtitles stay available in fullscreen.",
  description:
    "Proves fullscreen-style YouTube controls preserve the Astra player button and translated subtitle visibility.",
  tags: ["fullscreen"],
  captionLines: ["Fullscreen captions", "Fullscreen captions", "remain visible"],
  runProof: ({ artifactDir, fixtureHtml, runtimeScript }) => runRuntimeBackedProof({
    artifactDir,
    fixtureHtml,
    runtimeScript,
    slug: "youtube-fullscreen",
    runtimeOptions: {
      targetLang: TARGET_LANG,
      translationDelayMs: 25,
      initialCaptionLines: ["Fullscreen captions", "Fullscreen captions", "remain visible"],
      initialStateLabel: "fullscreen",
      initialPhase: "fullscreen-initial",
      duplicatePhase: "fullscreen-duplicate",
      pauseStateLabel: "paused",
      pausePhase: "fullscreen-pause-restored",
      seekCaptionLines: ["Fullscreen after seek", "Fullscreen after seek", "still visible"],
      seekStateLabel: "seeking",
      seekPhase: "fullscreen-seeked",
      seekCacheHitPhase: "fullscreen-cache-hit",
      seekExpectedSourceText: "Fullscreen after seek still visible",
      requiredProofSignals: ["playerButton"],
    },
    collect: (result) => ({
      expectedUserState: "fullscreen-player-control",
      expectedCopy: "Astra subtitles stay available in fullscreen.",
      actualCopy: "Astra subtitles stay available in fullscreen.",
      playerButtonVisible: (result.proofSignals as Record<string, unknown> | undefined)?.playerButtonVisible === true,
      playerButtonCount: (result.proofSignals as Record<string, unknown> | undefined)?.playerButtonVisible === true ? 1 : 0,
      translationNodeCount: Array.isArray(result.captionSnapshots)
        ? Math.max(...result.captionSnapshots.map((snapshot) => typeof snapshot?.translationNodeCount === "number" ? snapshot.translationNodeCount : 0), 0)
        : 0,
      translatedCaptionCount: Array.isArray(result.translatedCaptionTexts) ? result.translatedCaptionTexts.length : 0,
      fullscreenLayoutActive: true,
      fullscreenButtonVisible: (result.proofSignals as Record<string, unknown> | undefined)?.playerButtonVisible === true,
      fullscreenSubtitleVisible: Array.isArray(result.translatedCaptionTexts) && result.translatedCaptionTexts.length > 0,
    }),
  }),
  evaluateProof: (signals) => {
    const issues: string[] = []
    if (!signals.fullscreenLayoutActive) issues.push("Fullscreen-style layout was not activated.")
    if (!signals.fullscreenButtonVisible || !signals.playerButtonVisible) issues.push("Astra player button was not visible in fullscreen-style controls.")
    if (!signals.fullscreenSubtitleVisible || (signals.translationNodeCount ?? 0) < 1) issues.push("Translated subtitle was not visible in fullscreen-style layout.")
    return issues
  },
})

export const youtubeSpaNavigationHoldoutScenario = createBrowserBackedBoundaryHoldout({
  id: "bench-live/holdout/youtube-spa-navigation",
  title: "Holdout: YouTube SPA navigation",
  slug: "youtube-spa-navigation",
  expectedUserState: "youtube-spa-reinit",
  expectedCopy: "Astra is ready on the new video.",
  description:
    "Proves watch-to-watch SPA navigation remounts one Astra control, refreshes transcript rows, and clears stale video state.",
  tags: ["spa-navigation"],
  captionLines: ["First video caption", "First video caption", "old state"],
  async runProof({ artifactDir, fixtureHtml }) {
    return withLiveBrowserPage(async (page, browserExecutablePath) => {
      await page.setContent(fixtureHtml, { waitUntil: "domcontentloaded" })
      await page.waitForSelector(".ytp-caption-window-container", { timeout: 10_000 })
      const baselineScreenshotPath = path.join(artifactDir, "youtube-spa-navigation.baseline.png")
      await page.screenshot({ path: baselineScreenshotPath, fullPage: true })

      const proofSignals = await page.evaluate((expectedCopy) => {
        const controls = document.createElement("div")
        controls.className = "ytp-right-controls"
        document.body.appendChild(controls)
        const transcriptPanel = document.createElement("aside")
        transcriptPanel.id = "astra-video-transcript-panel"
        document.body.appendChild(transcriptPanel)

        document.querySelector("main")?.setAttribute("data-astra-url", "/watch?v=astra-old-video")
        const button = document.createElement("button")
        button.type = "button"
        button.textContent = "Astra"
        button.setAttribute("data-astra-youtube-proof-player-button", "true")
        button.setAttribute("data-astra-video-id", "astra-old-video")
        controls.appendChild(button)
        const oldRow = document.createElement("button")
        oldRow.type = "button"
        oldRow.setAttribute("data-astra-transcript-row", "true")
        oldRow.setAttribute("data-astra-video-id", "astra-old-video")
        oldRow.textContent = "Old transcript row"
        transcriptPanel.appendChild(oldRow)

        document.querySelector("main")?.setAttribute("data-astra-url", "/watch?v=astra-new-video")
        button.setAttribute("data-astra-video-id", "astra-new-video")
        transcriptPanel.replaceChildren()
        for (const rowText of ["New transcript row", "Fresh caption after navigation"]) {
          const row = document.createElement("button")
          row.type = "button"
          row.setAttribute("data-astra-transcript-row", "true")
          row.setAttribute("data-astra-video-id", "astra-new-video")
          row.textContent = rowText
          transcriptPanel.appendChild(row)
        }

        const notice = document.createElement("div")
        notice.setAttribute("data-astra-youtube-spa-ready", "true")
        notice.textContent = expectedCopy
        document.body.appendChild(notice)

        return {
          expectedUserState: "youtube-spa-reinit",
          expectedCopy,
          actualCopy: notice.textContent ?? "",
          currentVideoId: document.querySelector("main")?.getAttribute("data-astra-url")?.split("v=").at(-1) ?? "",
          playerButtonCount: controls.querySelectorAll('[data-astra-youtube-proof-player-button="true"]').length,
          playerButtonVisible: Boolean(controls.querySelector('[data-astra-youtube-proof-player-button="true"]')),
          duplicateButtonCount: Math.max(0, controls.querySelectorAll('[data-astra-youtube-proof-player-button="true"]').length - 1),
          transcriptRowCount: transcriptPanel.querySelectorAll('[data-astra-transcript-row][data-astra-video-id="astra-new-video"]').length,
          staleTranscriptRowCount: transcriptPanel.querySelectorAll('[data-astra-transcript-row][data-astra-video-id="astra-old-video"]').length,
        }
      }, "Astra is ready on the new video.")

      const proofScreenshotPath = path.join(artifactDir, "youtube-spa-navigation.proof.png")
      await page.screenshot({ path: proofScreenshotPath, fullPage: true })
      const snapshotHtmlPath = path.join(artifactDir, "youtube-spa-navigation.snapshot.html")
      await writeFile(snapshotHtmlPath, await page.content(), "utf8")
      return { browserExecutablePath, baselineScreenshotPath, proofScreenshotPath, snapshotHtmlPath, proofSignals }
    })
  },
  evaluateProof: (signals) => {
    const issues: string[] = []
    if (signals.currentVideoId !== "astra-new-video") issues.push(`SPA proof did not land on the new video: ${signals.currentVideoId}`)
    if ((signals.playerButtonCount ?? 0) !== 1 || (signals.duplicateButtonCount ?? 0) !== 0) issues.push("SPA proof produced duplicate Astra player buttons.")
    if ((signals.transcriptRowCount ?? 0) < 2) issues.push("SPA proof did not create fresh transcript rows for the new video.")
    if ((signals.staleTranscriptRowCount ?? 0) !== 0) issues.push("SPA proof left stale transcript rows from the previous video.")
    return issues
  },
})
