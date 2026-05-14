import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { JSDOM } from "jsdom"

import { evaluatePageTranslation, type PageTranslationExecution } from "../../bench/evaluators/page-translation"
import {
  buildExpectedPageTranslationTexts,
  buildPageTranslationExecutionFromDocument,
} from "../../bench/scenarios/helpers/page-translation"
import {
  materializeFixturePage,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../driver"
import type { LiveEvaluationResult, LiveScenarioDefinition, LiveScenarioExecution } from "../evaluator"

interface LivePageTranslationExecution extends LiveScenarioExecution {
  pageTranslation: PageTranslationExecution
}

const FIXTURE_NAME = "article-basic"
const TARGET_LANG = "zh-CN"
const TRANSLATION_SELECTOR = "main p, article p, article li, article h1, article h2, blockquote"

function buildTranslatedText(text: string) {
  return `ZH:${text.slice(0, 48)}`
}

function createDocumentFromHtml(html: string, url: string) {
  return new JSDOM(
    [
      "<!doctype html>",
      "<html>",
      "<head><meta charset=\"utf-8\" /></head>",
      "<body>",
      html,
      "</body>",
      "</html>",
    ].join("\n"),
    { url },
  ).window.document
}

function buildLivePageTranslationEvaluation(
  execution: LivePageTranslationExecution,
  runId: string,
  scenario: LiveEvaluationResult["scenario"],
  runtime: LiveEvaluationResult["runtime"],
) {
  const benchmark = evaluatePageTranslation(execution.pageTranslation)
  const issues = benchmark.issues.map((issue) => issue.evidence ? `${issue.message} (${issue.evidence})` : issue.message)

  return {
    runId,
    scenario,
    status: benchmark.pass ? "pass" : "fail",
    pass: benchmark.pass,
    score: benchmark.total,
    summary: benchmark.pass
      ? "Browser-backed article-basic page translation matched the existing benchmark contract."
      : "Browser-backed article-basic page translation diverged from the existing benchmark contract.",
    issues,
    nextActions: benchmark.nextActions,
    notes: [...(execution.notes ?? []), ...(Array.isArray(benchmark.artifacts.notes) ? benchmark.artifacts.notes : [])],
    rubrics: [],
    artifacts: {
      browserArtifacts: execution.artifacts ?? {},
      pageTranslationExecution: execution.pageTranslation,
      benchmarkEvaluation: benchmark,
    },
    runtime,
  } as unknown as Partial<LiveEvaluationResult>
}

export const pageTranslationArticleBasicScenario: LiveScenarioDefinition<LivePageTranslationExecution> = {
  id: "bench-live/page-translation-article-basic-bilingual",
  title: "Live page translation article-basic bilingual",
  surface: "page-translation",
  fixture: `page:${FIXTURE_NAME}`,
  description:
    "Loads the article-basic fixture in a real browser, injects the benchmark bilingual translation markers, and scores the result with the existing page-translation evaluator contract.",
  tags: ["playwright", "page-translation", "browser", "contract"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting browser-backed page-translation contract scenario.", {
      fixture: FIXTURE_NAME,
      targetLang: TARGET_LANG,
    })

    try {
      const fixturePage = await materializeFixturePage({
        runId: context.runId,
        fixtureName: FIXTURE_NAME,
        title: context.title,
      })

      const expected = buildExpectedPageTranslationTexts(
        createDocumentFromHtml(fixturePage.fixtureHtml, fixturePage.url),
        "page",
      )

      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        await page.goto(fixturePage.url, {
          waitUntil: "domcontentloaded",
        })
        await page.waitForSelector("article h1", {
          timeout: 10_000,
        })

        await page.evaluate(({ selector, targetLang }) => {
          const elements = Array.from(document.querySelectorAll(selector))
            .filter((node): node is HTMLElement => node instanceof HTMLElement)

          for (const element of elements) {
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
        }, {
          selector: TRANSLATION_SELECTOR,
          targetLang: TARGET_LANG,
        })

        const snapshotHtml = await page.content()
        const screenshotPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.page-translation.png`)
        const snapshotHtmlPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.page-translation.snapshot.html`)

        await mkdir(path.dirname(snapshotHtmlPath), { recursive: true })
        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
        })
        await writeFile(snapshotHtmlPath, snapshotHtml, "utf8")

        return {
          browserExecutablePath,
          screenshotPath,
          snapshotHtmlPath,
          snapshotHtml,
        }
      })

      runtime.checkpoint("Live page-translation fixture page materialized.", {
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
        screenshotPath: capture.screenshotPath,
        snapshotHtmlPath: capture.snapshotHtmlPath,
      })

      const translatedDocument = new JSDOM(capture.snapshotHtml, { url: fixturePage.url }).window.document
      const pageTranslation = buildPageTranslationExecutionFromDocument({
        doc: translatedDocument,
        expectedTexts: expected.expectedTexts,
        requestCount: 1,
        snapshotPhase: "running",
        failedBlocks: 0,
        notes: [`effectiveScope=${expected.effectiveScope}`, "live-browser-page-translation-contract"],
      })

      runtime.complete("Browser-backed page-translation contract scenario completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary:
          "Executed the browser-backed article-basic page-translation contract and captured screenshot/snapshot artifacts.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Artifact directory: ${fixturePage.artifactDir}`,
        ],
        artifacts: {
          browserExecutablePath: capture.browserExecutablePath,
          htmlPath: fixturePage.htmlPath,
          screenshotPath: capture.screenshotPath,
          snapshotHtmlPath: capture.snapshotHtmlPath,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        pageTranslation,
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary:
            "The live page-translation contract is wired, but no supported local browser executable is available in this environment.",
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
    return buildLivePageTranslationEvaluation(execution, context.runId, context.scenario, context.runtime)
  },
}
