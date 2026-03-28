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

const FIXTURE_NAME = "forms-and-nav"
const TARGET_LANG = "zh-CN"

function buildLayoutNoiseFixtureHtml(baseHtml: string) {
  const layoutNoiseBlock = `
  <section class="layout-noise-grid" style="display:grid;grid-template-columns:1fr 280px;gap:20px;align-items:start;">
    <article>
      <h2>Release notes should remain readable under stacked callouts.</h2>
      <p>Dense release notes and sidebar hints should still preserve bilingual readability.</p>
      <blockquote>
        The holdout adds mixed content, code snippets, and auxiliary callouts without changing the reading task.
      </blockquote>
      <p>Retry affordances and fallback copy should remain visible after the translated layout settles.</p>
    </article>
    <aside aria-label="layout-noise-sidebar">
      <div class="callout">Sidebar reminder: shortcuts and glossary hints stay visible.</div>
      <pre data-noise="code-sample">const retryBudget = 2\nconst mode = \"bilingual\"</pre>
      <p>Mixed-content note: docs links, code snippets, and prose all coexist here.</p>
    </aside>
  </section>`

  return baseHtml.replace("</main>", `${layoutNoiseBlock}\n</main>`)
}

export const pageTranslationLayoutNoiseSourceHoldoutScenario: LiveScenarioDefinition<LivePageTranslationExecution> = {
  id: "bench-live/holdout/page-translation-layout-noise-source",
  title: "Holdout: page translation layout-noise source",
  surface: "page-translation",
  fixture: `page:${FIXTURE_NAME}`,
  description:
    "Runs the real page-translation source module against a noisier forms-and-nav layout with mixed-content sidebars, callouts, and code snippets to verify layout-preserving translation coverage.",
  tags: ["playwright", "page-translation", "browser", "holdout", "layout-noise", "source-backed"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting source-backed page-translation layout-noise holdout.", {
      fixture: FIXTURE_NAME,
      targetLang: TARGET_LANG,
    })

    try {
      const fixturePage = await materializeFixturePage({
        runId: context.runId,
        fixtureName: FIXTURE_NAME,
        title: context.title,
      })
      const noisyFixtureHtml = buildLayoutNoiseFixtureHtml(fixturePage.fixtureHtml)
      const noisyFixtureHtmlPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.layout-noise.fixture.html`)
      const translatedHtmlPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.layout-noise.snapshot.html`)
      await writeFile(noisyFixtureHtmlPath, noisyFixtureHtml, "utf8")

      const sourceResult = await runSourceBackedPageTranslation({
        fixtureHtml: noisyFixtureHtml,
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
        await page.waitForSelector(".layout-noise-grid", { timeout: 10_000 })

        const screenshotPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.layout-noise.png`)
        await page.screenshot({ path: screenshotPath, fullPage: true })

        return {
          browserExecutablePath,
          screenshotPath,
        }
      })

      runtime.attachArtifact("pageTranslationLayoutNoise", {
        htmlPath: fixturePage.htmlPath,
        noisyFixtureHtmlPath,
        translatedHtmlPath,
        screenshotPath: capture.screenshotPath,
        requestCount: sourceResult.requestCount,
      })
      runtime.complete("Source-backed page-translation layout-noise holdout completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary:
          "Executed a noisier source-backed page-translation holdout with mixed-content sidebars and preserved the translated layout in a real browser.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Artifact directory: ${fixturePage.artifactDir}`,
          `Translate requests: ${sourceResult.requestCount}`,
        ],
        artifacts: {
          browserExecutablePath: capture.browserExecutablePath,
          htmlPath: fixturePage.htmlPath,
          noisyFixtureHtmlPath,
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
            "The page-translation layout-noise holdout ran, but no supported local browser executable was available for artifact capture.",
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
            notes: ["browser-unavailable"],
          },
        }
      }

      throw error
    }
  },
  async evaluate(execution, context) {
    return buildLivePageTranslationEvaluation(execution, context.runId, context.scenario, context.runtime, {
      successSummary: "Layout-noise source holdout preserved page translation coverage under mixed-content sidebars and callouts.",
      failureSummary: "Layout-noise source holdout exposed a page translation regression under mixed-content layout noise.",
    })
  },
}
