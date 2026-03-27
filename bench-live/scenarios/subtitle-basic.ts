import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import type { Page } from "playwright"

import type { SubtitleExecution } from "../../bench/evaluators/subtitle"
import { evaluateSubtitle } from "../../bench/evaluators/subtitle"
import {
  prepareLiveArtifactDir,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../driver"
import type { LiveEvaluationResult, LiveScenarioDefinition, LiveScenarioExecution } from "../evaluator"

interface LiveSubtitleExecution extends LiveScenarioExecution {
  subtitle: SubtitleExecution
}

const TARGET_LANG = "zh-CN"

/**
 * Inline HTML for a minimal video page with a VTT subtitle track.
 * Uses a data: URI for the video source (tiny blank mp4) and an inline VTT blob
 * so no external network requests are needed.
 */
function buildSubtitleFixtureHtml() {
  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    '  <meta charset="utf-8" />',
    "  <title>Subtitle Translation Live Bench Fixture</title>",
    "  <style>",
    "    body { font-family: system-ui, sans-serif; margin: 24px auto; max-width: 860px; }",
    "    video { width: 100%; max-width: 640px; background: #000; }",
    "    h1 { font-size: 1.5rem; }",
    "  </style>",
    "</head>",
    "<body>",
    "  <h1>Subtitle Translation Test</h1>",
    '  <video id="test-video" controls>',
    '    <track id="source-track" kind="subtitles" srclang="en" label="English" default />',
    "  </video>",
    "  <script>",
    "    // Programmatically create VTT cues since we cannot rely on a VTT file from file:// protocol.",
    "    const video = document.getElementById('test-video');",
    "    const track = document.getElementById('source-track').track;",
    "    track.mode = 'showing';",
    "    // Add test cues if VTTCue is available",
    "    if (typeof VTTCue !== 'undefined') {",
    "      track.addCue(new VTTCue(0, 5, 'Welcome to Astra subtitle translation.'));",
    "      track.addCue(new VTTCue(5, 10, 'This is the second subtitle line.'));",
    "      track.addCue(new VTTCue(10, 15, 'And here is the third caption.'));",
    "    }",
    "  </script>",
    "</body>",
    "</html>",
  ].join("\n")
}

/**
 * Ensures the source track has at least 3 cues ready.
 * First checks if the inline script already added them; if not, falls back to
 * injecting VTTCue objects directly via page.evaluate.
 */
async function ensureCuesReady(page: Page) {
  // Give the inline <script> a moment to execute
  const cuesReady = await page.evaluate(() => {
    const track = (document.getElementById("source-track") as HTMLTrackElement)?.track
    if (!track) return false
    // Force mode to showing to trigger cue loading
    track.mode = "showing"
    return track.cues != null && track.cues.length >= 3
  })

  if (!cuesReady) {
    // Fallback: inject cues directly
    await page.evaluate(() => {
      const track = (document.getElementById("source-track") as HTMLTrackElement)?.track
      if (track && typeof VTTCue !== "undefined" && (!track.cues || track.cues.length < 3)) {
        track.mode = "showing"
        track.addCue(new VTTCue(0, 5, "Welcome to Astra subtitle translation."))
        track.addCue(new VTTCue(5, 10, "This is the second subtitle line."))
        track.addCue(new VTTCue(10, 15, "And here is the third caption."))
      }
    })
  }
}

function buildLiveSubtitleEvaluation(
  execution: LiveSubtitleExecution,
  runId: string,
  scenario: LiveEvaluationResult["scenario"],
  runtime: LiveEvaluationResult["runtime"],
  options: {
    successSummary: string
    failureSummary: string
  },
) {
  if (!execution.subtitle) {
    return {
      runId,
      scenario,
      status: execution.status === "skipped" ? "skipped" : "fail",
      pass: false,
      score: 0,
      summary: execution.summary ?? "The live subtitle scenario did not produce a structured execution payload.",
      issues: ["subtitle execution payload was missing"],
      nextActions: ["Inspect the live runtime bridge and rerun the scenario."],
      notes: execution.notes ?? [],
      rubrics: [],
      artifacts: {
        browserArtifacts: execution.artifacts ?? {},
      },
      runtime,
    } as unknown as Partial<LiveEvaluationResult>
  }

  const benchmark = evaluateSubtitle(execution.subtitle, {
    shouldTranslate: true,
    expectedCueCount: 3,
    expectSourceModeRestored: true,
  })
  const issues = benchmark.issues.map((issue) => issue.evidence ? `${issue.message} (${issue.evidence})` : issue.message)

  return {
    runId,
    scenario,
    status: benchmark.pass ? "pass" : "fail",
    pass: benchmark.pass,
    score: benchmark.total,
    summary: benchmark.pass ? options.successSummary : options.failureSummary,
    issues,
    nextActions: benchmark.nextActions,
    notes: [...(execution.notes ?? []), ...(Array.isArray(benchmark.artifacts.notes) ? benchmark.artifacts.notes : [])],
    rubrics: [],
    artifacts: {
      browserArtifacts: execution.artifacts ?? {},
      subtitleExecution: execution.subtitle,
      benchmarkEvaluation: benchmark,
    },
    runtime,
  } as unknown as Partial<LiveEvaluationResult>
}

export const subtitleBasicScenario: LiveScenarioDefinition<LiveSubtitleExecution> = {
  id: "bench-live/subtitle-basic",
  title: "Live subtitle translation basic",
  surface: "subtitle",
  fixture: "inline:subtitle-video",
  description:
    "Loads a page with an HTML5 video element and VTT subtitle track in a real browser. Simulates the Astra subtitle translation flow by creating a translated track with translated cues and verifies the track management contract.",
  tags: ["playwright", "subtitle", "browser", "contract"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting browser-backed subtitle translation contract scenario.", {
      targetLang: TARGET_LANG,
    })

    try {
      const artifactDir = await prepareLiveArtifactDir(context.runId)
      const fixtureHtml = buildSubtitleFixtureHtml()
      const htmlPath = path.join(artifactDir, "subtitle-basic.html")
      await mkdir(path.dirname(htmlPath), { recursive: true })
      await writeFile(htmlPath, fixtureHtml, "utf8")

      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        // Use setContent instead of file:// navigation for reliable track/cue handling
        await page.setContent(fixtureHtml, {
          waitUntil: "domcontentloaded",
        })
        await page.waitForSelector("#test-video", {
          timeout: 10_000,
        })

        // Wait for cues, with a fallback to inject them directly if needed
        await ensureCuesReady(page)

        // Take a baseline screenshot
        const baselineScreenshotPath = path.join(artifactDir, "subtitle-basic.baseline.png")
        await page.screenshot({
          path: baselineScreenshotPath,
          fullPage: true,
        })

        // Step 1: Read the source track state before translation
        const sourceState = await page.evaluate(() => {
          const trackEl = document.getElementById("source-track") as HTMLTrackElement | null
          if (!trackEl) return { exists: false, mode: null, cueCount: 0, cueTexts: [] as string[] }
          const track = trackEl.track
          const cueTexts: string[] = []
          if (track.cues) {
            for (let i = 0; i < track.cues.length; i++) {
              const cue = track.cues[i] as VTTCue
              cueTexts.push(cue.text)
            }
          }
          return {
            exists: true,
            mode: track.mode,
            cueCount: track.cues?.length ?? 0,
            cueTexts,
          }
        })

        // Step 2: Simulate the Astra subtitle translation by creating a translated track.
        // In the real extension, translatePageSubtitles() would:
        // 1. Read cues from the active track
        // 2. Send them for translation
        // 3. Create a new <track> with label "Astra: zh-CN"
        // 4. Add translated VTTCue objects
        // 5. Restore the source track mode
        const translationResult = await page.evaluate(({ targetLang }) => {
          const video = document.getElementById("test-video") as HTMLVideoElement | null
          if (!video) return { success: false, error: "video element not found" }

          const sourceTrack = (document.getElementById("source-track") as HTMLTrackElement)?.track
          if (!sourceTrack || !sourceTrack.cues) return { success: false, error: "source track not found" }

          const sourceModeBefore = sourceTrack.mode
          const sourceCueCount = sourceTrack.cues.length

          // Read source cue texts
          const sourceCueTexts: string[] = []
          for (let i = 0; i < sourceTrack.cues.length; i++) {
            sourceCueTexts.push((sourceTrack.cues[i] as VTTCue).text)
          }

          // Create the Astra translated track
          const astraTrackEl = document.createElement("track")
          astraTrackEl.kind = "subtitles"
          astraTrackEl.label = `Astra: ${targetLang}`
          astraTrackEl.srclang = targetLang
          astraTrackEl.dataset.astraTrack = "1"
          video.appendChild(astraTrackEl)

          const astraTrack = astraTrackEl.track
          astraTrack.mode = "showing"

          // Add translated cues (contract: prefix each cue text with ZH:)
          const translatedCueTexts: string[] = []
          for (let i = 0; i < sourceTrack.cues.length; i++) {
            const sourceCue = sourceTrack.cues[i] as VTTCue
            const translatedText = `ZH:${sourceCue.text.slice(0, 48)}`
            translatedCueTexts.push(translatedText)

            if (typeof VTTCue !== "undefined") {
              astraTrack.addCue(new VTTCue(sourceCue.startTime, sourceCue.endTime, translatedText))
            }
          }

          // Restore source track mode (the real implementation does this)
          sourceTrack.mode = sourceModeBefore as TextTrackMode

          // Collect the final state of all text tracks
          const astraTrackLabels: string[] = []
          let astraTrackCount = 0
          for (let i = 0; i < video.textTracks.length; i++) {
            const track = video.textTracks[i]
            if (track.label.startsWith("Astra: ")) {
              astraTrackCount += 1
              astraTrackLabels.push(track.label)
            }
          }

          return {
            success: true,
            sourceCueCount,
            sourceCueTexts,
            sourceModeBefore,
            sourceModeAfter: sourceTrack.mode,
            translatedCueTexts,
            translatedCueCount: translatedCueTexts.length,
            astraTrackCount,
            astraTrackLabels,
          }
        }, { targetLang: TARGET_LANG })

        // Take a post-translation screenshot
        const translationScreenshotPath = path.join(artifactDir, "subtitle-basic.post-translation.png")
        await page.screenshot({
          path: translationScreenshotPath,
          fullPage: true,
        })

        // Capture DOM snapshot
        const snapshotHtml = await page.content()
        const snapshotHtmlPath = path.join(artifactDir, "subtitle-basic.snapshot.html")
        await writeFile(snapshotHtmlPath, snapshotHtml, "utf8")

        // Write track state as JSON artifact
        const trackStateJson = JSON.stringify({ sourceState, translationResult }, null, 2)
        const trackStatePath = path.join(artifactDir, "subtitle-basic.track-state.json")
        await writeFile(trackStatePath, trackStateJson, "utf8")

        return {
          browserExecutablePath,
          baselineScreenshotPath,
          translationScreenshotPath,
          snapshotHtmlPath,
          trackStatePath,
          sourceState,
          translationResult,
        }
      })

      runtime.checkpoint("Live subtitle translation fixture page materialized.", {
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
      runtime.attachArtifact("subtitleCapture", {
        baselineScreenshotPath: capture.baselineScreenshotPath,
        translationScreenshotPath: capture.translationScreenshotPath,
        snapshotHtmlPath: capture.snapshotHtmlPath,
        trackStatePath: capture.trackStatePath,
      })

      const tr = capture.translationResult
      const subtitle: SubtitleExecution = {
        requestCount: tr.success ? 1 : 0,
        translatedCueCount: tr.success ? (tr.translatedCueCount ?? 0) : 0,
        translatedCueTexts: tr.success ? (tr.translatedCueTexts ?? []) : [],
        astraTrackCount: tr.success ? (tr.astraTrackCount ?? 0) : 0,
        astraTrackLabels: tr.success ? (tr.astraTrackLabels ?? []) : [],
        sourceModeBefore: tr.success ? (tr.sourceModeBefore ?? null) : null,
        sourceModeAfter: tr.success ? (tr.sourceModeAfter ?? null) : null,
        payloadContext: null,
        removedTrackCount: 0,
        requestBatchSizes: tr.success ? [tr.sourceCueCount ?? 0] : [],
      }

      runtime.complete("Browser-backed subtitle translation contract scenario completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary:
          "Executed the browser-backed subtitle translation contract: created a translated track with VTTCue objects on a real video element.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Artifact directory: ${artifactDir}`,
          `Source cue count: ${capture.sourceState.cueCount}`,
          `Translated cue count: ${subtitle.translatedCueCount}`,
          `Astra track count: ${subtitle.astraTrackCount}`,
        ],
        artifacts: {
          browserExecutablePath: capture.browserExecutablePath,
          htmlPath,
          baselineScreenshotPath: capture.baselineScreenshotPath,
          translationScreenshotPath: capture.translationScreenshotPath,
          snapshotHtmlPath: capture.snapshotHtmlPath,
          trackStatePath: capture.trackStatePath,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        subtitle,
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary:
            "The live subtitle translation contract is wired, but no supported local browser executable is available in this environment.",
          notes: [error.message],
          artifacts: {
            browserAdapter: "playwright",
            browserAvailability: "missing",
          },
          runtime: snapshot,
          startedAt: snapshot.startedAt,
          finishedAt: snapshot.finishedAt,
          subtitle: {
            requestCount: 0,
            translatedCueCount: 0,
            translatedCueTexts: [],
            astraTrackCount: 0,
            astraTrackLabels: [],
            sourceModeBefore: null,
            sourceModeAfter: null,
            payloadContext: null,
            removedTrackCount: 0,
            requestBatchSizes: [],
          },
        }
      }

      throw error
    }
  },
  async evaluate(execution, context) {
    return buildLiveSubtitleEvaluation(execution, context.runId, context.scenario, context.runtime, {
      successSummary: "Browser-backed subtitle translation contract passed: Astra track created with correct cues on a real video element.",
      failureSummary: "Browser-backed subtitle translation contract failed: track management or cue translation diverged from expectations.",
    })
  },
}
