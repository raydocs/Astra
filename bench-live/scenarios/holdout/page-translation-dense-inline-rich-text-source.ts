import { writeFile } from "node:fs/promises"
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

interface LivePageTranslationExecution extends LiveScenarioExecution {
  pageTranslation: PageTranslationExecution
}

const FIXTURE_NAME = "dense-inline"
const TARGET_LANG = "zh-CN"

function buildDenseInlineRichTextFixtureHtml(baseHtml: string) {
  const richTextAppend = `
    <p class="holdout-rich-text">
      Release <strong>notes with <em>nested emphasis</em></strong>, adjacent <strong>bold</strong><em>emphasis</em><code>code</code>, and <mark>highlighted warnings</mark> should preserve ordering.
    </p>
    <p class="holdout-rich-text">
      Mixed inline <small>annotations</small>, <sub>subscripts</sub>, <sup>superscripts</sup>, unsupported <a href="/docs/rich-text">links</a>, and <span>plain spans</span> should still translate safely.
    </p>
  `

  return baseHtml.replace("</article>", `${richTextAppend}\n  </article>`)
}

export const pageTranslationDenseInlineRichTextSourceHoldoutScenario: LiveScenarioDefinition<LivePageTranslationExecution> = {
  id: "bench-live/holdout/page-translation-dense-inline-rich-text-source",
  title: "Holdout: page translation dense-inline rich-text source",
  surface: "page-translation",
  fixture: `page:${FIXTURE_NAME}`,
  description:
    "Runs the real page-translation source module against a denser inline-rich fixture with nested formatting, adjacent preserved tags, and unsupported inline elements to verify placeholder preservation in a real browser-backed holdout.",
  tags: ["playwright", "page-translation", "browser", "holdout", "rich-text", "source-backed"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting source-backed page-translation dense-inline rich-text holdout.", {
      fixture: FIXTURE_NAME,
      targetLang: TARGET_LANG,
    })

    try {
      const fixturePage = await materializeFixturePage({
        runId: context.runId,
        fixtureName: FIXTURE_NAME,
        title: context.title,
      })
      const richTextFixtureHtml = buildDenseInlineRichTextFixtureHtml(fixturePage.fixtureHtml)
      const richTextFixtureHtmlPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.rich-text.fixture.html`)
      const translatedHtmlPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.rich-text.snapshot.html`)
      await writeFile(richTextFixtureHtmlPath, richTextFixtureHtml, "utf8")

      const sourceResult = await runSourceBackedPageTranslation({
        fixtureHtml: richTextFixtureHtml,
        url: fixturePage.url,
        title: context.title,
        targetLang: TARGET_LANG,
        contentScope: "page",
        translationMode: "bilingual",
        snapshotHtmlPath: translatedHtmlPath,
      })

      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        await page.goto(pathToFileURL(translatedHtmlPath).href, { waitUntil: "domcontentloaded" })
        await page.waitForSelector("[data-astra-translation='1']", { timeout: 10_000 })

        const screenshotPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.rich-text.png`)
        await page.screenshot({ path: screenshotPath, fullPage: true })

        return {
          browserExecutablePath,
          screenshotPath,
          restoredTagCount: await page.locator("[data-astra-translation='1'] .astra-translation-inner strong, [data-astra-translation='1'] .astra-translation-inner em, [data-astra-translation='1'] .astra-translation-inner code, [data-astra-translation='1'] .astra-translation-inner mark, [data-astra-translation='1'] .astra-translation-inner small, [data-astra-translation='1'] .astra-translation-inner sub, [data-astra-translation='1'] .astra-translation-inner sup").count(),
          placeholderLeakCount: await page.locator("text=/__ASTRA_RT_\\d+_/i").count(),
        }
      })

      runtime.attachArtifact("pageTranslationRichTextHoldout", {
        htmlPath: fixturePage.htmlPath,
        richTextFixtureHtmlPath,
        translatedHtmlPath,
        screenshotPath: capture.screenshotPath,
        requestCount: sourceResult.requestCount,
        restoredTagCount: capture.restoredTagCount,
        placeholderLeakCount: capture.placeholderLeakCount,
      })
      runtime.complete("Source-backed page-translation dense-inline rich-text holdout completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary:
          "Executed a source-backed dense-inline rich-text holdout and preserved inline formatting without leaking Astra placeholder tokens.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Artifact directory: ${fixturePage.artifactDir}`,
          `Translate requests: ${sourceResult.requestCount}`,
          `Restored rich-text tags: ${capture.restoredTagCount}`,
        ],
        artifacts: {
          browserExecutablePath: capture.browserExecutablePath,
          htmlPath: fixturePage.htmlPath,
          richTextFixtureHtmlPath,
          translatedHtmlPath,
          screenshotPath: capture.screenshotPath,
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
            "The dense-inline rich-text holdout ran, but no supported local browser executable was available for artifact capture.",
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
      requireRichTextPlaceholderPreservation: true,
      successSummary: "Dense-inline rich-text holdout preserved Astra placeholder-backed formatting in the browser-backed source path.",
      failureSummary: "Dense-inline rich-text holdout exposed a placeholder preservation regression in the browser-backed source path.",
    })
  },
}
