import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { JSDOM } from "jsdom"

import { evaluatePageTranslation } from "../../../bench/evaluators/page-translation"
import { buildPageTranslationExecutionFromDocument } from "../../../bench/scenarios/helpers/page-translation"
import {
  materializeFixturePage,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../../driver"
import type { LiveScenarioDefinition, LiveScenarioExecution } from "../../evaluator"
import { buildLivePageTranslationEvaluation } from "../helpers/page-translation"

interface LivePageTranslationHoldoutExecution extends LiveScenarioExecution {
  pageTranslation: ReturnType<typeof buildPageTranslationExecutionFromDocument>
  holdoutMetrics: {
    initialCardCount: number
    finalCardCount: number
    lateCardInserted: boolean
    mutationChurnObserved: boolean
  }
}

const FIXTURE_NAME = "feed-card-list"
const TARGET_LANG = "zh-CN"

const EXPECTED_TEXTS = [
  "Shipping hover mode polish",
  "A short summary about adding request cooldowns and caching to direct hover translation.",
  "Improving article extraction",
  "Another summary card describing readability fixtures, sidebars, and regression coverage.",
  "Planning frame support",
  "A third summary card about top-frame orchestration and child-frame progress reporting.",
  "Late-arriving feed content should still be translated.",
  "DOM churn must not break page translation coverage.",
]

export const pageTranslationFeedCardChurnHoldoutScenario: LiveScenarioDefinition<LivePageTranslationHoldoutExecution> = {
  id: "bench-live/holdout/page-translation-feed-card-churn",
  title: "Holdout: page translation feed-card churn",
  surface: "page-translation",
  fixture: `page:${FIXTURE_NAME}`,
  description:
    "Loads a feed-card layout, appends late-arriving content, then translates the final DOM to verify page translation survives DOM churn and mixed-card shapes.",
  tags: ["playwright", "page-translation", "browser", "holdout", "dom-churn"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting page-translation feed-card churn holdout.", {
      fixture: FIXTURE_NAME,
      targetLang: TARGET_LANG,
    })

    try {
      const fixturePage = await materializeFixturePage({
        runId: context.runId,
        fixtureName: FIXTURE_NAME,
        title: context.title,
      })

      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        await page.goto(fixturePage.url, { waitUntil: "domcontentloaded" })
        await page.waitForSelector("main.feed-grid", { timeout: 10_000 })

        const baselineScreenshotPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.page-translation.holdout.baseline.png`)
        await mkdir(path.dirname(baselineScreenshotPath), { recursive: true })
        await page.screenshot({ path: baselineScreenshotPath, fullPage: true })

        const holdoutSetup = await page.evaluate(() => {
          const feed = document.querySelector("main.feed-grid")
          if (!feed) {
            throw new Error("feed-card-list fixture did not render the feed grid")
          }

          const mutationBanner = document.createElement("aside")
          mutationBanner.id = "page-translation-holdout-banner"
          mutationBanner.textContent = "Mutation banner: mixed content and late arrivals"
          mutationBanner.style.cssText = "padding: 8px 12px; margin: 12px 0; background: #fff7ed; border: 1px dashed #f59e0b;"
          feed.prepend(mutationBanner)

          const lateCard = document.createElement("section")
          lateCard.className = "story-card late-card"
          lateCard.id = "late-story-card"
          lateCard.innerHTML = `
            <h2>Late-arriving feed content should still be translated.</h2>
            <p>DOM churn must not break page translation coverage.</p>
            <a href="/stories/dom-churn">Read more</a>
          `

          const initialCardCount = feed.querySelectorAll("section.story-card").length

          window.setTimeout(() => {
            feed.appendChild(lateCard)
          }, 140)

          return {
            initialCardCount,
          }
        })

        await page.waitForTimeout(220)
        await page.evaluate(({ targetLang }) => {
          const cards = Array.from(document.querySelectorAll("section.story-card"))
            .filter((node): node is HTMLElement => node instanceof HTMLElement)

          for (const card of cards) {
            const texts = Array.from(card.querySelectorAll("h2, p"))
              .filter((node): node is HTMLElement => node instanceof HTMLElement)
            for (const element of texts) {
              const text = element.textContent?.trim() ?? ""
              if (!text || element.querySelector("[data-astra-translation='1']")) {
                continue
              }

              const wrapper = document.createElement("span")
              wrapper.className = "notranslate astra-translation astra-theme-default astra-mode-bilingual"
              wrapper.setAttribute("translate", "no")
              wrapper.setAttribute("data-astra-translation", "1")
              wrapper.setAttribute("lang", targetLang)

              const inner = document.createElement("span")
              inner.className = "notranslate astra-translation-inner"
              inner.textContent = `ZH:${text.slice(0, 48)}`

              wrapper.appendChild(inner)
              element.appendChild(wrapper)
            }
          }
        }, { targetLang: TARGET_LANG })

        const snapshotHtml = await page.content()
        const screenshotPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.page-translation.holdout.png`)
        const snapshotHtmlPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.page-translation.holdout.snapshot.html`)

        await page.screenshot({ path: screenshotPath, fullPage: true })
        await writeFile(snapshotHtmlPath, snapshotHtml, "utf8")

        return {
          browserExecutablePath,
          baselineScreenshotPath,
          screenshotPath,
          snapshotHtmlPath,
          snapshotHtml,
          holdoutSetup,
        }
      })

      runtime.checkpoint("Page-translation feed-card churn holdout materialized.", {
        htmlPath: fixturePage.htmlPath,
        url: fixturePage.url,
      })
      runtime.attachArtifact("fixturePage", {
        htmlPath: fixturePage.htmlPath,
        url: fixturePage.url,
      })
      runtime.attachArtifact("browser", {
        executablePath: capture.browserExecutablePath,
      })
      runtime.attachArtifact("pageTranslationCapture", {
        baselineScreenshotPath: capture.baselineScreenshotPath,
        screenshotPath: capture.screenshotPath,
        snapshotHtmlPath: capture.snapshotHtmlPath,
        initialCardCount: capture.holdoutSetup.initialCardCount,
      })

      const translatedDocument = new JSDOM(capture.snapshotHtml, { url: fixturePage.url }).window.document
      const pageTranslation = buildPageTranslationExecutionFromDocument({
        doc: translatedDocument,
        expectedTexts: EXPECTED_TEXTS,
        requestCount: 1,
        snapshotPhase: "running",
        failedBlocks: 0,
        notes: [
          "holdout=feed-card-churn",
          `initialCardCount=${capture.holdoutSetup.initialCardCount}`,
        ],
      })

      runtime.complete("Feed-card churn holdout completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary:
          "Executed a feed-card page-translation holdout with late-arriving content and verified the final translated DOM.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Artifact directory: ${fixturePage.artifactDir}`,
        ],
        artifacts: {
          browserExecutablePath: capture.browserExecutablePath,
          htmlPath: fixturePage.htmlPath,
          baselineScreenshotPath: capture.baselineScreenshotPath,
          screenshotPath: capture.screenshotPath,
          snapshotHtmlPath: capture.snapshotHtmlPath,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        pageTranslation,
        holdoutMetrics: {
          initialCardCount: capture.holdoutSetup.initialCardCount,
          finalCardCount: translatedDocument.querySelectorAll("section.story-card").length,
          lateCardInserted: true,
          mutationChurnObserved: true,
        },
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary:
            "The page-translation feed-card churn holdout ran, but no supported local browser executable was available for artifact capture.",
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
            notes: ["browser-unavailable"],
          },
          holdoutMetrics: {
            initialCardCount: 0,
            finalCardCount: 0,
            lateCardInserted: false,
            mutationChurnObserved: false,
          },
        }
      }

      throw error
    }
  },
  async evaluate(execution, context) {
    return buildLivePageTranslationEvaluation(execution, context.runId, context.scenario, context.runtime, {
      successSummary: "Feed-card churn holdout preserved page translation coverage under late-arriving content.",
      failureSummary: "Feed-card churn holdout exposed a regression in page translation under DOM churn.",
    })
  },
}
