import path from "node:path"
import { pathToFileURL } from "node:url"

import type { PageTranslationExecution } from "../../../bench/evaluators/page-translation"
import {
  materializeFixturePage,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../../driver"
import type { LiveScenarioDefinition, LiveScenarioExecution } from "../../evaluator"
import { runSourceBackedPageTranslation } from "../../source-runtime"
import { buildLivePageTranslationEvaluation } from "../helpers/page-translation"

interface LiveInvalidSelectorExecution extends LiveScenarioExecution {
  pageTranslation: PageTranslationExecution
}

const FIXTURE_NAME = "article-basic"

export const pageTranslationInvalidSelectorsSourceHoldoutScenario: LiveScenarioDefinition<LiveInvalidSelectorExecution> = {
  id: "bench-live/holdout/page-translation-invalid-selectors-source",
  title: "Holdout: page translation invalid selectors source",
  surface: "page-translation",
  fixture: `page:${FIXTURE_NAME}`,
  description:
    "Runs the real page-translation source module with invalid site selectors configured and verifies that translation still succeeds instead of silently dropping all blocks.",
  tags: ["playwright", "page-translation", "browser", "holdout", "source-backed", "site-rules"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting source-backed invalid-selector holdout.", {
      fixture: FIXTURE_NAME,
      hostname: "example.com",
    })

    try {
      const fixturePage = await materializeFixturePage({
        runId: context.runId,
        fixtureName: FIXTURE_NAME,
        title: context.title,
      })
      const translatedHtmlPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.invalid-selectors.source.snapshot.html`)

      const sourceResult = await runSourceBackedPageTranslation({
        fixtureHtml: fixturePage.fixtureHtml,
        url: "https://example.com/bench-live/article-basic-invalid-selectors",
        title: context.title,
        targetLang: "zh-CN",
        contentScope: "page",
        translationMode: "bilingual",
        browserConfig: {
          sites: {
            "example.com": {
              enabled: true,
              alwaysTranslate: false,
              selectors: ["article[", "::not-a-real-pseudo("],
              excludeSelectors: [".sidebar["],
            },
          },
        },
        snapshotHtmlPath: translatedHtmlPath,
      })

      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        await page.goto(pathToFileURL(translatedHtmlPath).href, {
          waitUntil: "domcontentloaded",
        })
        await page.waitForSelector("[data-astra-translation='1']", {
          timeout: 10_000,
        })

        const screenshotPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.invalid-selectors.source.png`)
        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
        })

        return {
          browserExecutablePath,
          screenshotPath,
          translationMarkerCount: await page.locator("[data-astra-translation='1']").count(),
        }
      })

      runtime.attachArtifact("invalidSelectorHoldout", {
        htmlPath: fixturePage.htmlPath,
        translatedHtmlPath,
        screenshotPath: capture.screenshotPath,
        requestCount: sourceResult.requestCount,
        translationMarkerCount: capture.translationMarkerCount,
      })
      runtime.complete("Source-backed invalid-selector holdout completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary:
          "Executed a source-backed invalid-selector holdout and confirmed that invalid site selectors did not suppress page translation.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Artifact directory: ${fixturePage.artifactDir}`,
          `Translate requests: ${sourceResult.requestCount}`,
          `Translation markers: ${capture.translationMarkerCount}`,
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
            "The invalid-selector holdout ran, but no supported local browser executable was available for artifact capture.",
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
            payloadContext: null,
            requestTexts: [],
            requestPlaceholderCount: 0,
            translatedHtmlSnippets: [],
            placeholderLeakCount: 0,
            restoredRichTextTagCount: 0,
            notes: ["browser-unavailable"],
          },
        }
      }

      throw error
    }
  },
  async evaluate(execution, context) {
    return buildLivePageTranslationEvaluation(execution, context.runId, context.scenario, context.runtime, {
      successSummary: "Source-backed invalid-selector holdout confirmed that malformed selectors are ignored without suppressing translation.",
      failureSummary: "Source-backed invalid-selector holdout exposed a regression where malformed selectors suppressed page translation.",
    })
  },
}
