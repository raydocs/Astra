import { writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

import type { SubtitleFileExecution } from "../../../bench/evaluators/subtitle-file"
import { runSourceBackedSubtitleFileHarness } from "../../subtitle-file-runtime"
import {
  prepareLiveArtifactDir,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../../driver"
import type { LiveScenarioDefinition, LiveScenarioExecution } from "../../evaluator"
import { buildLiveSubtitleFileEvaluation } from "../helpers/subtitle-file"

interface LiveSubtitleFileHoldoutExecution extends LiveScenarioExecution {
  subtitleFile?: SubtitleFileExecution
}

const MALFORMED_VTT_FIXTURE = `WEBVTT

00:00:01.000 --> 00:00:03.000
First line

00:00:02.500 --> 00:00:04.000
Overlapping line

00:00:04.000 --> 00:00:03.500
Backwards timing`

export const subtitleFileMalformedHoldoutScenario: LiveScenarioDefinition<LiveSubtitleFileHoldoutExecution> = {
  id: "bench-live/holdout/subtitle-file-malformed",
  title: "Holdout: subtitle-file malformed timing and overlap",
  surface: "subtitle-file",
  fixture: "files:subtitle-file-malformed",
  description:
    "Uses a malformed VTT fixture with overlapping and reversed timings to verify subtitle-file parsing stays operator-visible and does not crash the preview/export pipeline.",
  tags: ["playwright", "subtitle-file", "browser", "holdout", "timing-noise"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting subtitle-file malformed holdout scenario.")

    try {
      const artifactDir = await prepareLiveArtifactDir(context.runId)
      const harnessResult = await runSourceBackedSubtitleFileHarness([
        { fileName: "malformed.vtt", content: MALFORMED_VTT_FIXTURE, previewMode: "translation-only" },
      ])

      const htmlPath = path.join(artifactDir, "subtitle-file-malformed.snapshot.html")
      await writeFile(htmlPath, harnessResult.renderedHtml, "utf8")

      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "domcontentloaded" })
        await page.waitForSelector("[data-astra-subtitle-file-reader] [data-role='subtitle-file-section']", { timeout: 10_000 })

        const screenshotPath = path.join(artifactDir, "subtitle-file-malformed.png")
        await page.screenshot({ path: screenshotPath, fullPage: true })

        const warningCount = await page.locator("[data-role='subtitle-file-warning']").count()
        const sectionCount = await page.locator("[data-role='subtitle-file-section']").count()
        const rowCount = await page.locator("[data-role='subtitle-row']").count()

        return {
          browserExecutablePath,
          screenshotPath,
          warningCount,
          sectionCount,
          rowCount,
        }
      })

      runtime.attachArtifact("subtitleFileHoldoutCapture", {
        htmlPath,
        screenshotPath: capture.screenshotPath,
        browserExecutablePath: capture.browserExecutablePath,
        warningCount: capture.warningCount,
        sectionCount: capture.sectionCount,
        rowCount: capture.rowCount,
        translateCalls: harnessResult.translateCalls.map((call) => ({
          payload: call.payload,
          durationMs: call.durationMs,
        })),
      })
      runtime.attachArtifact("browser", { executablePath: capture.browserExecutablePath })
      runtime.complete("Subtitle-file malformed holdout completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary: "Executed the subtitle-file malformed timing holdout in a real browser.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Artifact directory: ${artifactDir}`,
          `Warnings: ${capture.warningCount}`,
          `Rows: ${capture.rowCount}`,
        ],
        artifacts: {
          browserExecutablePath: capture.browserExecutablePath,
          htmlPath,
          screenshotPath: capture.screenshotPath,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        subtitleFile: harnessResult.execution,
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary: "The subtitle-file malformed holdout is wired, but no supported local browser executable was available for artifact capture.",
          notes: [error.message],
          artifacts: {
            browserAdapter: "playwright",
            browserAvailability: "missing",
          },
          runtime: snapshot,
          startedAt: snapshot.startedAt,
          finishedAt: snapshot.finishedAt,
        }
      }

      throw error
    }
  },
  async evaluate(execution, context) {
    return buildLiveSubtitleFileEvaluation(execution, context.runId, context.scenario, context.runtime, {
      expected: {
        expectedFileCount: 1,
        expectedCueCount: 3,
        expectedFormats: ["vtt"],
        expectedExportFormats: ["srt", "vtt"],
        expectedRequestCount: 1,
        expectedPreviewSections: 1,
        expectedWarningsAtLeast: 2,
        requireTimingPreserved: false,
        requirePrivacyIsolation: true,
      },
      successSummary: "Subtitle-file malformed holdout passed: the browser preview stayed stable and surfaced timing warnings for overlapping/reversed cues.",
      failureSummary: "Subtitle-file malformed holdout failed: malformed timing either crashed parsing or failed to surface the expected warnings.",
    })
  },
}
