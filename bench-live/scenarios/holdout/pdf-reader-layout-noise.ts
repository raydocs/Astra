import { writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { runSourceBackedPdfReaderHarness } from "../../pdf-source-runtime"
import {
  prepareLiveArtifactDir,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../../driver"
import type { LiveScenarioDefinition, LiveScenarioExecution } from "../../evaluator"
import { buildLivePdfEvaluation } from "../helpers/pdf"
import type { PdfTranslationExecution } from "../../../bench/evaluators/pdf"

interface LivePdfReaderHoldoutExecution extends LiveScenarioExecution {
  pdfTranslation?: PdfTranslationExecution
}

const PDF_READER_LAYOUT_NOISE_FIXTURE = "pdf-reader-layout-noise"

export const pdfReaderLayoutNoiseHoldoutScenario: LiveScenarioDefinition<LivePdfReaderHoldoutExecution> = {
  id: "bench-live/holdout/pdf-reader-layout-noise",
  title: "Holdout: PDF reader layout-noise stability",
  surface: "pdf",
  fixture: `pdf:${PDF_READER_LAYOUT_NOISE_FIXTURE}`,
  description:
    "Runs a noisier PDF fixture with secondary note-like blocks, then validates the rendered bilingual/translation-only reader snapshot in a real browser.",
  tags: ["playwright", "pdf", "browser", "holdout", "layout-noise"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting holdout PDF reader layout-noise scenario.", {
      fixture: PDF_READER_LAYOUT_NOISE_FIXTURE,
    })

    try {
      const artifactDir = await prepareLiveArtifactDir(context.runId)
      const harnessResult = await runSourceBackedPdfReaderHarness({
        fixtureName: PDF_READER_LAYOUT_NOISE_FIXTURE,
      })
      const htmlPath = path.join(artifactDir, "pdf-reader-layout-noise.snapshot.html")
      await writeFile(htmlPath, harnessResult.renderedHtml, "utf8")

      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        await page.goto(pathToFileURL(htmlPath).href, {
          waitUntil: "domcontentloaded",
        })
        await page.waitForSelector("[data-astra-pdf-reader] [data-role='translation']", {
          timeout: 10_000,
        })

        const screenshotPath = path.join(artifactDir, "pdf-reader-layout-noise.png")
        await page.screenshot({ path: screenshotPath, fullPage: true })

        const bilingualBlocks = await page.locator("[data-mode='bilingual'] .pdf-block").count()
        const translationOnlyBlocks = await page.locator("[data-mode='translation-only'] .pdf-block").count()
        const sourceCount = await page.locator("[data-mode='bilingual'] [data-role='source']").count()
        const translationCount = await page.locator("[data-astra-pdf-reader] [data-role='translation']").count()

        return {
          browserExecutablePath,
          screenshotPath,
          bilingualBlocks,
          translationOnlyBlocks,
          sourceCount,
          translationCount,
        }
      })

      runtime.attachArtifact("pdfReaderHoldoutCapture", {
        htmlPath,
        screenshotPath: capture.screenshotPath,
        browserExecutablePath: capture.browserExecutablePath,
        bilingualBlocks: capture.bilingualBlocks,
        translationOnlyBlocks: capture.translationOnlyBlocks,
        sourceCount: capture.sourceCount,
        translationCount: capture.translationCount,
      })
      runtime.complete("PDF reader holdout layout-noise scenario completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary:
          "Executed the noisier PDF reader holdout harness and validated that bilingual/translation-only rendering remained aligned in a real browser.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Artifact directory: ${artifactDir}`,
          `Bilingual blocks: ${capture.bilingualBlocks}`,
          `Translation-only blocks: ${capture.translationOnlyBlocks}`,
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
            "The PDF reader layout-noise holdout is wired, but no supported local browser executable is available in this environment.",
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
      successSummary: "Holdout PDF reader layout-noise scenario passed: bilingual and translation-only rendering stayed aligned under noisier PDF content.",
      failureSummary: "Holdout PDF reader layout-noise scenario failed: bilingual or translation-only rendering diverged under noisier PDF content.",
    })
  },
}
