import { writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { runSourceBackedEpubReaderHarness } from "../epub-source-runtime"
import {
  prepareLiveArtifactDir,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../driver"
import type { LiveScenarioDefinition, LiveScenarioExecution } from "../evaluator"
import { buildLiveEpubEvaluation } from "./helpers/epub"
import type { EpubTranslationExecution } from "../../bench/evaluators/epub"

interface LiveEpubReaderExecution extends LiveScenarioExecution {
  epubTranslation?: EpubTranslationExecution
}

const EPUB_READER_FIRST_CUT_FIXTURE = "epub-reader-first-cut"

export const epubReaderBasicScenario: LiveScenarioDefinition<LiveEpubReaderExecution> = {
  id: "bench-live/epub-reader-basic",
  title: "Live EPUB reader first cut",
  surface: "epub",
  fixture: `epub:${EPUB_READER_FIRST_CUT_FIXTURE}`,
  description:
    "Runs the EPUB reader harness on the first-cut fixture, then opens the rendered bilingual/translation-only reader snapshot in a real browser.",
  tags: ["playwright", "epub", "browser", "reader"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting EPUB reader live scenario.", {
      fixture: EPUB_READER_FIRST_CUT_FIXTURE,
    })

    try {
      const artifactDir = await prepareLiveArtifactDir(context.runId)
      const harnessResult = await runSourceBackedEpubReaderHarness({ fixtureName: EPUB_READER_FIRST_CUT_FIXTURE })
      const htmlPath = path.join(artifactDir, "epub-reader-basic.snapshot.html")
      await writeFile(htmlPath, harnessResult.renderedHtml, "utf8")

      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "domcontentloaded" })
        await page.waitForSelector("[data-astra-epub-reader] [data-role='epub-translation']", { timeout: 10_000 })

        const screenshotPath = path.join(artifactDir, "epub-reader-basic.png")
        await page.screenshot({ path: screenshotPath, fullPage: true })

        const tocCount = await page.locator("[data-role='epub-toc-item']").count()
        const bilingualCount = await page.locator("[data-mode='bilingual'] [data-role='epub-translation']").count()
        const translationOnlyCount = await page.locator("[data-mode='translation-only'] [data-role='epub-translation']").count()

        return {
          browserExecutablePath,
          screenshotPath,
          tocCount,
          bilingualCount,
          translationOnlyCount,
        }
      })

      runtime.attachArtifact("epubReaderCapture", {
        htmlPath,
        screenshotPath: capture.screenshotPath,
        browserExecutablePath: capture.browserExecutablePath,
        tocCount: capture.tocCount,
        bilingualCount: capture.bilingualCount,
        translationOnlyCount: capture.translationOnlyCount,
      })
      runtime.complete("EPUB reader live scenario completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary:
          "Executed the EPUB reader first-cut harness and captured the rendered bilingual/translation-only snapshot in a real browser.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Artifact directory: ${artifactDir}`,
          `TOC items: ${capture.tocCount}`,
          `Rendered translations: ${capture.bilingualCount}/${capture.translationOnlyCount}`,
        ],
        artifacts: {
          browserExecutablePath: capture.browserExecutablePath,
          htmlPath,
          screenshotPath: capture.screenshotPath,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        epubTranslation: harnessResult.execution,
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary:
            "The EPUB reader live path executed, but no supported local browser executable was available for artifact capture.",
          notes: [error.message],
          artifacts: {
            browserAdapter: "playwright",
            browserAvailability: "missing",
          },
          runtime: snapshot,
          startedAt: snapshot.startedAt,
          finishedAt: snapshot.finishedAt,
          epubTranslation: undefined,
        }
      }
      throw error
    }
  },
  async evaluate(execution, context) {
    return buildLiveEpubEvaluation(execution, context.runId, context.scenario, context.runtime, {
      expected: {
        expectedChapterCount: 3,
        expectedActiveChapterTitle: "Chapter 2 — Signals",
        expectedTranslationRequestCount: 2,
        requireReadingStateRestored: true,
        requirePrivacyIsolation: true,
      },
      successSummary: "Browser-backed EPUB reader first cut matched the deterministic EPUB harness contract.",
      failureSummary: "Browser-backed EPUB reader first cut diverged from the deterministic EPUB harness contract.",
    })
  },
}
