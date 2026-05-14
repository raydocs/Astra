import { writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { runSourceBackedPdfReaderHarness } from "../pdf-source-runtime"
import {
  prepareLiveArtifactDir,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../driver"
import type { LiveScenarioDefinition, LiveScenarioExecution } from "../evaluator"
import { buildLivePdfEvaluation } from "./helpers/pdf"
import type { PdfTranslationExecution } from "../../bench/evaluators/pdf"

interface LivePdfReaderExecution extends LiveScenarioExecution {
  pdfTranslation?: PdfTranslationExecution
}

const PDF_READER_FIRST_CUT_FIXTURE = "pdf-reader-first-cut"

export const pdfReaderBasicScenario: LiveScenarioDefinition<LivePdfReaderExecution> = {
  id: "bench-live/pdf-reader-basic",
  title: "Live PDF reader first cut",
  surface: "pdf",
  fixture: `pdf:${PDF_READER_FIRST_CUT_FIXTURE}`,
  description:
    "Runs the PDF reader harness on the first-cut fixture, then opens the rendered bilingual/translation-only snapshot in a real browser for artifact capture.",
  tags: ["playwright", "pdf", "browser", "reader"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting PDF reader live scenario.", {
      fixture: PDF_READER_FIRST_CUT_FIXTURE,
    })

    try {
      const artifactDir = await prepareLiveArtifactDir(context.runId)
      const harnessResult = await runSourceBackedPdfReaderHarness({
        fixtureName: PDF_READER_FIRST_CUT_FIXTURE,
      })
      const htmlPath = path.join(artifactDir, "pdf-reader-basic.snapshot.html")
      await writeFile(htmlPath, harnessResult.renderedHtml, "utf8")

      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        await page.goto(pathToFileURL(htmlPath).href, {
          waitUntil: "domcontentloaded",
        })
        await page.waitForSelector("[data-astra-pdf-reader] [data-role='translation']", {
          timeout: 10_000,
        })

        const screenshotPath = path.join(artifactDir, "pdf-reader-basic.png")
        await page.screenshot({ path: screenshotPath, fullPage: true })

        const bilingualPageCount = await page.locator("[data-mode='bilingual'] .pdf-page").count()
        const translationOnlyPageCount = await page.locator("[data-mode='translation-only'] .pdf-page").count()
        const translationCount = await page.locator("[data-astra-pdf-reader] [data-role='translation']").count()

        return {
          browserExecutablePath,
          screenshotPath,
          bilingualPageCount,
          translationOnlyPageCount,
          translationCount,
        }
      })

      runtime.attachArtifact("pdfReaderCapture", {
        htmlPath,
        screenshotPath: capture.screenshotPath,
        browserExecutablePath: capture.browserExecutablePath,
        bilingualPageCount: capture.bilingualPageCount,
        translationOnlyPageCount: capture.translationOnlyPageCount,
        translationCount: capture.translationCount,
        translateCalls: harnessResult.translateCalls.map((call) => ({
          payload: call.payload,
          durationMs: call.durationMs,
        })),
      })
      runtime.complete("PDF reader live scenario completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary:
          "Executed the PDF reader first-cut harness and captured the rendered bilingual/translation-only snapshot in a real browser.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Artifact directory: ${artifactDir}`,
          `Rendered pages: ${capture.bilingualPageCount}/${capture.translationOnlyPageCount}`,
          `Rendered translations: ${capture.translationCount}`,
        ],
        artifacts: {
          browserExecutablePath: capture.browserExecutablePath,
          htmlPath,
          screenshotPath: capture.screenshotPath,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        pdfTranslation: harnessResult.execution,
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary:
            "The PDF reader live path executed, but no supported local browser executable was available for artifact capture.",
          notes: [error.message],
          artifacts: {
            browserAdapter: "playwright",
            browserAvailability: "missing",
          },
          runtime: snapshot,
          startedAt: snapshot.startedAt,
          finishedAt: snapshot.finishedAt,
          pdfTranslation: undefined,
        }
      }

      throw error
    }
  },
  async evaluate(execution, context) {
    return buildLivePdfEvaluation(execution, context.runId, context.scenario, context.runtime, {
      successSummary: "Browser-backed PDF reader first cut matched the deterministic PDF harness contract.",
      failureSummary: "Browser-backed PDF reader first cut diverged from the deterministic PDF harness contract.",
      requirePrivacyIsolation: true,
    })
  },
}
