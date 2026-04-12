import { writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

import type { SubtitleFileExecution } from "../../bench/evaluators/subtitle-file"
import { runSourceBackedSubtitleFileHarness } from "../subtitle-file-runtime"
import {
  prepareLiveArtifactDir,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../driver"
import type { LiveScenarioDefinition, LiveScenarioExecution } from "../evaluator"
import { buildLiveSubtitleFileEvaluation } from "./helpers/subtitle-file"

interface LiveSubtitleFileExecution extends LiveScenarioExecution {
  subtitleFile?: SubtitleFileExecution
}

const SRT_FIXTURE = `1
00:00:01,000 --> 00:00:04,000
Hello Astra

2
00:00:05,000 --> 00:00:08,000
Subtitle files are now first-class.`

const VTT_FIXTURE = `WEBVTT

00:00:01.000 --> 00:00:04.000
Hello Astra

00:00:05.000 --> 00:00:08.000
Subtitle files are now first-class.`

export const subtitleFileBasicScenario: LiveScenarioDefinition<LiveSubtitleFileExecution> = {
  id: "bench-live/subtitle-file-basic",
  title: "Live subtitle-file basic",
  surface: "subtitle-file",
  fixture: "files:subtitle-file-roundtrip",
  description:
    "Renders a browser snapshot for subtitle-file ingest, bilingual preview, and export using both SRT and VTT fixtures.",
  tags: ["playwright", "subtitle-file", "browser", "reader"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting subtitle-file live scenario.")

    try {
      const artifactDir = await prepareLiveArtifactDir(context.runId)
      const harnessResult = await runSourceBackedSubtitleFileHarness([
        { fileName: "demo.srt", content: SRT_FIXTURE, previewMode: "bilingual" },
        { fileName: "demo.vtt", content: VTT_FIXTURE, previewMode: "translation-only" },
      ])

      const htmlPath = path.join(artifactDir, "subtitle-file-basic.snapshot.html")
      await writeFile(htmlPath, harnessResult.renderedHtml, "utf8")

      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "domcontentloaded" })
        await page.waitForSelector("[data-astra-subtitle-file-reader] [data-role='subtitle-file-section']", { timeout: 10_000 })

        const screenshotPath = path.join(artifactDir, "subtitle-file-basic.png")
        await page.screenshot({ path: screenshotPath, fullPage: true })

        const sectionCount = await page.locator("[data-role='subtitle-file-section']").count()
        const rowCount = await page.locator("[data-role='subtitle-row']").count()
        const exportCount = await page.locator("textarea[data-role^='subtitle-file-export']").count()

        return {
          browserExecutablePath,
          screenshotPath,
          sectionCount,
          rowCount,
          exportCount,
        }
      })

      runtime.attachArtifact("subtitleFileCapture", {
        htmlPath,
        screenshotPath: capture.screenshotPath,
        browserExecutablePath: capture.browserExecutablePath,
        sectionCount: capture.sectionCount,
        rowCount: capture.rowCount,
        exportCount: capture.exportCount,
        translateCalls: harnessResult.translateCalls.map((call) => ({
          payload: call.payload,
          durationMs: call.durationMs,
        })),
      })
      runtime.attachArtifact("browser", { executablePath: capture.browserExecutablePath })
      runtime.complete("Subtitle-file live scenario completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary: "Rendered the subtitle-file ingest/preview/export snapshot in a real browser.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Artifact directory: ${artifactDir}`,
          `Sections: ${capture.sectionCount}`,
          `Rows: ${capture.rowCount}`,
          `Exports: ${capture.exportCount}`,
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
          summary: "The subtitle-file live path is wired, but no supported local browser executable was available for artifact capture.",
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
        expectedFileCount: 2,
        expectedCueCount: 4,
        expectedFormats: ["srt", "vtt"],
        expectedExportFormats: ["srt", "vtt"],
        expectedRequestCount: 2,
        expectedPreviewSections: 2,
        requireTimingPreserved: true,
        requirePrivacyIsolation: true,
      },
      successSummary: "Live subtitle-file roundtrip passed: SRT and VTT ingests rendered bilingual/translation-only previews and exports.",
      failureSummary: "Live subtitle-file roundtrip failed: ingest, preview, or export behavior diverged from the Astra contract.",
    })
  },
}
