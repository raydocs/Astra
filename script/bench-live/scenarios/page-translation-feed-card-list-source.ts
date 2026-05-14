import path from "node:path"
import { pathToFileURL } from "node:url"

import type { PageTranslationExecution } from "../../bench/evaluators/page-translation"
import {
  materializeFixturePage,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../driver"
import type { LiveScenarioDefinition, LiveScenarioExecution } from "../evaluator"
import { runSourceBackedPageTranslation } from "../source-runtime"
import { buildLivePageTranslationEvaluation } from "./helpers/page-translation"

interface LivePageTranslationExecution extends LiveScenarioExecution {
  pageTranslation: PageTranslationExecution
}

const FIXTURE_NAME = "feed-card-list"
const TARGET_LANG = "zh-CN"

export const pageTranslationFeedCardListSourceScenario: LiveScenarioDefinition<LivePageTranslationExecution> = {
  id: "bench-live/page-translation-feed-card-list-source-bilingual",
  title: "Live page translation feed-card-list source bilingual",
  surface: "page-translation",
  fixture: `page:${FIXTURE_NAME}`,
  description:
    "Runs the real page-translation source module against the feed-card-list fixture, then opens the translated snapshot in a real browser for artifacts and scoring.",
  tags: [ "playwright", "page-translation", "browser", "source-backed" ],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting source-backed browser page-translation scenario.", {
      fixture: FIXTURE_NAME,
      targetLang: TARGET_LANG,
    })

    try {
      const fixturePage = await materializeFixturePage({
        runId: context.runId,
        fixtureName: FIXTURE_NAME,
        title: context.title,
      })
      const translatedHtmlPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.page-translation.source.snapshot.html`)

      const sourceResult = await runSourceBackedPageTranslation({
        fixtureHtml: fixturePage.fixtureHtml,
        url: fixturePage.url,
        title: context.title,
        targetLang: TARGET_LANG,
        contentScope: "page",
        translationMode: "bilingual",
        snapshotHtmlPath: translatedHtmlPath,
      })

      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        await page.goto(pathToFileURL(translatedHtmlPath).href, {
          waitUntil: "domcontentloaded",
        })
        await page.waitForSelector("[data-astra-translation='1']", {
          timeout: 10_000,
        })

        const screenshotPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.page-translation.source.png`)
        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
        })

        return {
          browserExecutablePath,
          screenshotPath,
        }
      })

      runtime.checkpoint("Source-backed page translation completed.", {
        htmlPath: fixturePage.htmlPath,
        translatedHtmlPath,
      })
      runtime.attachArtifact("fixturePage", {
        htmlPath: fixturePage.htmlPath,
        url: fixturePage.url,
      })
      runtime.attachArtifact("browser", {
        executablePath: capture.browserExecutablePath,
      })
      runtime.attachArtifact("pageTranslationCapture", {
        screenshotPath: capture.screenshotPath,
        snapshotHtmlPath: translatedHtmlPath,
        requestCount: sourceResult.requestCount,
      })

      runtime.complete("Browser-backed source page-translation scenario completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary:
          "Executed the real page-translation source module on feed-card-list, then captured the translated result in a real browser.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Artifact directory: ${fixturePage.artifactDir}`,
          `Translate requests: ${sourceResult.requestCount}`,
        ],
        artifacts: {
          browserExecutablePath: capture.browserExecutablePath,
          htmlPath: fixturePage.htmlPath,
          screenshotPath: capture.screenshotPath,
          snapshotHtmlPath: translatedHtmlPath,
          translateCalls: sourceResult.translateCalls,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        pageTranslation: sourceResult.pageTranslation,
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary:
            "The source-backed page-translation live path ran, but no supported local browser executable was available for artifact capture.",
          notes: [error.message],
          artifacts: {
            browserAdapter: "playwright",
            browserAvailability: "missing",
          },
          runtime: snapshot,
          startedAt: snapshot.startedAt,
          finishedAt: snapshot.finishedAt,
          pageTranslation: {
            translatedNodeCount: 0,
            expectedNodeCount: 0,
            translationMarkerCount: 0,
            hiddenSourceCount: 0,
            requestCount: 0,
            skippedInteractiveTranslations: 0,
            translatedTexts: [],
            expectedTexts: [],
            snapshotPhase: "idle",
            failedBlocks: 0,
            notes: [ "browser-unavailable" ],
          },
        }
      }

      throw error
    }
  },
  async evaluate(execution, context) {
    return buildLivePageTranslationEvaluation(execution, context.runId, context.scenario, context.runtime, {
      successSummary: "Browser-backed feed-card-list source translation matched the existing page-translation benchmark contract.",
      failureSummary: "Browser-backed feed-card-list source translation diverged from the existing page-translation benchmark contract.",
    })
  },
}

