import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { JSDOM } from "jsdom"

import { evaluateArticleExtraction, type ArticleExtractionExecution } from "../../bench/evaluators/article-extraction"
import { buildArticleExtractionExecutionFromDocument } from "../../bench/scenarios/helpers/article-extraction"
import { articleExtractionCaseDefinitions } from "../../bench/scenarios/helpers/article-extraction-fixtures"
import {
  materializeFixturePage,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../driver"
import type { LiveEvaluationResult, LiveScenarioDefinition, LiveScenarioExecution } from "../evaluator"

interface LiveArticleExtractionCase {
  id: string
  fixtureName: string
  title: string
  expectedRootNote: string | null
  consoleErrors: string[]
  execution: ArticleExtractionExecution
  evaluation: ReturnType<typeof evaluateArticleExtraction>
  artifacts: {
    htmlPath: string
    url: string
    baselineScreenshotPath: string
    extractionScreenshotPath: string
    snapshotHtmlPath: string
  }
}

interface ArticleExtractionDocsExecution extends LiveScenarioExecution {
  articleExtractionCases: LiveArticleExtractionCase[]
}

function createDocumentFromHtml(html: string, url: string) {
  return new JSDOM(html, { url }).window.document
}

export const articleExtractionDocsScenario: LiveScenarioDefinition<ArticleExtractionDocsExecution> = {
  id: "bench-live/article-extraction-proof",
  title: "Live article-extraction proof matrix",
  surface: "article-extraction",
  fixture: `page:${articleExtractionCaseDefinitions.map((definition) => definition.fixtureName).join(",")}`,
  description:
    "Loads documentation, blog, forum, and landing fixtures in a real browser, captures rendered HTML/screenshots, and scores the shared article-extraction contract against each fixture.",
  tags: ["playwright", "article-extraction", "browser", "contract"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting browser-backed article-extraction proof matrix.", {
      fixtures: articleExtractionCaseDefinitions.map((definition) => definition.fixtureName),
    })

    const fixturePages = await Promise.all(articleExtractionCaseDefinitions.map(async (definition) => {
      const fixturePage = await materializeFixturePage({
        runId: context.runId,
        fixtureName: definition.fixtureName,
        title: `${context.title} — ${definition.fixtureName}`,
      })

      runtime.checkpoint("Live article-extraction fixture materialized.", {
        fixture: definition.fixtureName,
        url: fixturePage.url,
      })

      return {
        definition,
        fixturePage,
      }
    }))

    try {
      const artifactDir = path.join(process.cwd(), "bench-live-results", context.runId)
      await mkdir(artifactDir, { recursive: true })

      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        const cases: LiveArticleExtractionCase[] = []

        for (const { definition, fixturePage } of fixturePages) {
          const consoleErrors: string[] = []
          const handleConsole = (message: { type?: () => string; text?: () => string }) => {
            const type = typeof message.type === "function" ? message.type() : "log"
            if (type === "error") {
              consoleErrors.push(typeof message.text === "function" ? message.text() : "Unknown browser console error")
            }
          }

          if (typeof page.on === "function") {
            page.on("console", handleConsole)
          }

          try {
            await page.goto(fixturePage.url, { waitUntil: "domcontentloaded", timeout: 10_000 })
            await page.waitForSelector("body", { timeout: 10_000 })

            const baselineScreenshotPath = path.join(artifactDir, `${definition.fixtureName}.article-extraction.baseline.png`)
            await page.screenshot({ path: baselineScreenshotPath, fullPage: true })

            const snapshotHtml = await page.content()
            const snapshotHtmlPath = path.join(artifactDir, `${definition.fixtureName}.article-extraction.snapshot.html`)
            await writeFile(snapshotHtmlPath, snapshotHtml, "utf8")

            const execution = buildArticleExtractionExecutionFromDocument({
              doc: createDocumentFromHtml(snapshotHtml, fixturePage.url),
              contentScope: "article",
              shouldExcludeTexts: definition.expected.shouldExcludeTexts,
              notes: [
                `fixture=${definition.fixtureName}`,
                `expected-root=${definition.expected.scope}:${definition.expected.rootId ?? "BODY"}`,
                `expected-block-range=${definition.expected.minBlockCount ?? 0}-${definition.expected.maxBlockCount ?? "∞"}`,
                ...(definition.expected.expectedRootNote ? [definition.expected.expectedRootNote] : []),
              ],
            })
            const evaluation = evaluateArticleExtraction(execution, definition.expected)

            await page.evaluate(({ rootId, scope }) => {
              const root = rootId
                ? document.getElementById(rootId)
                : scope === "page"
                  ? document.body
                  : null

              if (root instanceof HTMLElement) {
                root.style.outline = "3px solid #6366f1"
                root.style.outlineOffset = "4px"
                root.setAttribute("data-astra-article-proof-root", "1")
              }
            }, {
              rootId: execution.rootId,
              scope: execution.scope,
            })

            const extractionScreenshotPath = path.join(artifactDir, `${definition.fixtureName}.article-extraction.highlighted.png`)
            await page.screenshot({ path: extractionScreenshotPath, fullPage: true })

            cases.push({
              id: definition.id,
              fixtureName: definition.fixtureName,
              title: definition.title,
              expectedRootNote: definition.expected.expectedRootNote ?? null,
              consoleErrors,
              execution,
              evaluation,
              artifacts: {
                htmlPath: fixturePage.htmlPath,
                url: fixturePage.url,
                baselineScreenshotPath,
                extractionScreenshotPath,
                snapshotHtmlPath,
              },
            })
          } finally {
            if (typeof page.off === "function") {
              page.off("console", handleConsole)
            }
          }
        }

        return {
          browserExecutablePath,
          cases,
        }
      })

      runtime.attachArtifact("browser", { executablePath: capture.browserExecutablePath })
      runtime.attachArtifact("articleExtractionCases", capture.cases.map((entry) => ({
        id: entry.id,
        fixtureName: entry.fixtureName,
        pass: entry.evaluation.pass,
        total: entry.evaluation.total,
        failureClasses: entry.evaluation.artifacts.failureClasses,
        root: {
          expected: entry.evaluation.artifacts.expectedRoot,
          actual: entry.evaluation.artifacts.actualRoot,
        },
        artifacts: entry.artifacts,
      })))

      runtime.complete("Browser-backed article-extraction proof matrix completed.")
      const runtimeSnapshot = runtime.snapshot()
      const passedCases = capture.cases.filter((entry) => entry.evaluation.pass).length

      return {
        status: runtimeSnapshot.status,
        summary: `Article extraction proof cases passed ${passedCases}/${capture.cases.length}.`,
        notes: capture.cases.flatMap((entry) => {
          const notes = [
            `${entry.fixtureName}: scope=${entry.execution.scope}, root=${entry.execution.rootId ?? "BODY"}, blocks=${entry.execution.blockCount}`,
          ]
          if (entry.expectedRootNote) {
            notes.push(`${entry.fixtureName}: ${entry.expectedRootNote}`)
          }
          return notes
        }),
        artifacts: {
          browserExecutablePath: capture.browserExecutablePath,
          cases: capture.cases.map((entry) => ({
            id: entry.id,
            fixtureName: entry.fixtureName,
            title: entry.title,
            pass: entry.evaluation.pass,
            total: entry.evaluation.total,
            failureClasses: entry.evaluation.artifacts.failureClasses,
            consoleErrors: entry.consoleErrors,
            artifacts: entry.artifacts,
          })),
        },
        runtime: runtimeSnapshot,
        startedAt: runtimeSnapshot.startedAt,
        finishedAt: runtimeSnapshot.finishedAt,
        articleExtractionCases: capture.cases,
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary: "No supported browser executable available.",
          notes: [error.message],
          artifacts: { browserAvailability: "missing" },
          runtime: snapshot,
          startedAt: snapshot.startedAt,
          finishedAt: snapshot.finishedAt,
          articleExtractionCases: [],
        }
      }

      throw error
    }
  },

  evaluate(execution, context) {
    if (execution.status === "skipped") {
      return {
        runId: context.runId,
        scenario: {
          id: context.scenario.id,
          title: context.scenario.title,
          surface: context.scenario.surface,
          fixture: context.scenario.fixture,
          description: context.scenario.description,
          tags: context.scenario.tags,
        },
        status: "skipped",
        pass: false,
        score: 0,
        summary: execution.summary ?? "Browser-backed article extraction proof is skipped in this environment.",
        issues: [],
        nextActions: execution.notes ?? [],
        notes: execution.notes ?? [],
        rubrics: [],
        artifacts: {
          browserArtifacts: execution.artifacts ?? {},
          caseExecutions: [],
        },
        runtime: context.runtime,
      } as unknown as Partial<LiveEvaluationResult>
    }

    const issues: string[] = []
    const nextActions: string[] = []

    if (execution.articleExtractionCases.length === 0) {
      issues.push("No browser-backed article extraction cases were executed.")
      nextActions.push("Verify the live browser harness can materialize and open the article extraction fixtures.")
    }

    for (const entry of execution.articleExtractionCases) {
      for (const issue of entry.evaluation.issues) {
        issues.push(
          `${entry.fixtureName}: ${issue.evidence ? `${issue.message} (${issue.evidence})` : issue.message}`,
        )
      }

      for (const consoleError of entry.consoleErrors) {
        issues.push(`${entry.fixtureName}: browser console error (${consoleError})`)
      }

      for (const action of entry.evaluation.nextActions) {
        nextActions.push(`${entry.fixtureName}: ${action}`)
      }
    }

    const score = execution.articleExtractionCases.length === 0
      ? 0
      : Math.max(
          0,
          Math.round(
            execution.articleExtractionCases.reduce((sum, entry) => sum + entry.evaluation.total, 0)
            / execution.articleExtractionCases.length,
          ) - execution.articleExtractionCases.reduce((sum, entry) => sum + (entry.consoleErrors.length > 0 ? 5 : 0), 0),
        )
    const pass = execution.articleExtractionCases.length > 0
      && execution.articleExtractionCases.every((entry) => entry.evaluation.pass && entry.consoleErrors.length === 0)

    return {
      runId: context.runId,
      scenario: {
        id: context.scenario.id,
        title: context.scenario.title,
        surface: context.scenario.surface,
        fixture: context.scenario.fixture,
        description: context.scenario.description,
        tags: context.scenario.tags,
      },
      status: pass ? "pass" : "fail",
      pass,
      score,
      summary: pass
        ? "Article extraction passed across docs, blog, forum, and landing fixtures with browser-backed artifacts."
        : "Article extraction proof found fixture failures or browser/runtime issues.",
      issues,
      nextActions,
      notes: execution.notes ?? [],
      rubrics: [],
      artifacts: {
        browserArtifacts: execution.artifacts ?? {},
        caseExecutions: execution.articleExtractionCases.map((entry) => ({
          id: entry.id,
          fixtureName: entry.fixtureName,
          execution: entry.execution,
          evaluation: entry.evaluation,
          consoleErrors: entry.consoleErrors,
          artifacts: entry.artifacts,
        })),
      },
      runtime: context.runtime,
    } as unknown as Partial<LiveEvaluationResult>
  },
}