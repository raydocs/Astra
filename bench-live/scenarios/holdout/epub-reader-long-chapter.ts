import { writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { runSourceBackedEpubReaderHarness } from "../../epub-source-runtime"
import {
  prepareLiveArtifactDir,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../../driver"
import type { LiveScenarioDefinition, LiveScenarioExecution } from "../../evaluator"
import { buildLiveEpubEvaluation } from "../helpers/epub"
import type { EpubTranslationExecution } from "../../../bench/evaluators/epub"

interface LiveEpubReaderHoldoutExecution extends LiveScenarioExecution {
  epubTranslation?: EpubTranslationExecution
}

const EPUB_READER_LONG_CHAPTER_FIXTURE = "epub-reader-long-chapter"

export const epubReaderLongChapterHoldoutScenario: LiveScenarioDefinition<LiveEpubReaderHoldoutExecution> = {
  id: "bench-live/holdout/epub-reader-long-chapter",
  title: "Holdout: EPUB reader long-chapter resume stability",
  surface: "epub",
  fixture: `epub:${EPUB_READER_LONG_CHAPTER_FIXTURE}`,
  description:
    "Runs a longer EPUB chapter fixture, then validates the bilingual/translation-only reader snapshot in a real browser under resume-heavy conditions.",
  tags: ["playwright", "epub", "browser", "holdout", "long-chapter"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting holdout EPUB reader long-chapter scenario.", {
      fixture: EPUB_READER_LONG_CHAPTER_FIXTURE,
    })

    try {
      const artifactDir = await prepareLiveArtifactDir(context.runId)
      const harnessResult = await runSourceBackedEpubReaderHarness({ fixtureName: EPUB_READER_LONG_CHAPTER_FIXTURE })
      const htmlPath = path.join(artifactDir, "epub-reader-long-chapter.snapshot.html")
      await writeFile(htmlPath, harnessResult.renderedHtml, "utf8")

      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "domcontentloaded" })
        await page.waitForSelector("[data-astra-epub-reader] [data-role='epub-translation']", { timeout: 10_000 })

        const screenshotPath = path.join(artifactDir, "epub-reader-long-chapter.png")
        await page.screenshot({ path: screenshotPath, fullPage: true })

        const tocCount = await page.locator("[data-role='epub-toc-item']").count()
        const bilingualCount = await page.locator("[data-mode='bilingual'] [data-role='epub-translation']").count()
        const translationOnlyCount = await page.locator("[data-mode='translation-only'] [data-role='epub-translation']").count()
        const activeChapter = await page.locator("[data-astra-epub-reader]").getAttribute("data-active-chapter-title")
        const resumedChapter = await page.locator("[data-astra-epub-reader]").getAttribute("data-resumed-chapter-title")

        return {
          browserExecutablePath,
          screenshotPath,
          tocCount,
          bilingualCount,
          translationOnlyCount,
          activeChapter,
          resumedChapter,
        }
      })

      runtime.attachArtifact("epubReaderHoldoutCapture", {
        htmlPath,
        screenshotPath: capture.screenshotPath,
        browserExecutablePath: capture.browserExecutablePath,
        tocCount: capture.tocCount,
        bilingualCount: capture.bilingualCount,
        translationOnlyCount: capture.translationOnlyCount,
        activeChapter: capture.activeChapter,
        resumedChapter: capture.resumedChapter,
      })
      runtime.complete("EPUB reader holdout long-chapter scenario completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary:
          "Executed the longer EPUB reader holdout harness and validated that bilingual/translation-only rendering and resume state remained aligned in a real browser.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Artifact directory: ${artifactDir}`,
          `TOC items: ${capture.tocCount}`,
          `Rendered translations: ${capture.bilingualCount}/${capture.translationOnlyCount}`,
          `Resume: ${capture.activeChapter} -> ${capture.resumedChapter}`,
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
            "The EPUB reader long-chapter holdout is wired, but no supported local browser executable is available in this environment.",
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
        expectedActiveChapterTitle: "Chapter 3 — Resume",
        expectedTranslationRequestCount: 4,
        requireReadingStateRestored: true,
        requirePrivacyIsolation: true,
      },
      successSummary: "Holdout EPUB reader long-chapter scenario passed: bilingual and translation-only rendering stayed aligned under a longer resumed chapter.",
      failureSummary: "Holdout EPUB reader long-chapter scenario failed: bilingual or translation-only rendering diverged under a longer resumed chapter.",
    })
  },
}
