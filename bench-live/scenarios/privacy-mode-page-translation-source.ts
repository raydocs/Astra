import path from "node:path"
import { pathToFileURL } from "node:url"

import type { PageTranslationExecution } from "../../bench/evaluators/page-translation"
import {
  materializeFixturePage,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../driver"
import type { LiveEvaluationResult, LiveScenarioDefinition, LiveScenarioExecution } from "../evaluator"
import { runSourceBackedPageTranslation } from "../source-runtime"
import { buildLivePageTranslationEvaluation } from "./helpers/page-translation"
import { evaluateSanitizedTranslateCalls } from "./helpers/privacy"

interface LivePrivacyPageExecution extends LiveScenarioExecution {
  pageTranslation: PageTranslationExecution
  translateCalls?: Array<{ payload: { context?: Record<string, unknown> } }>
}

const FIXTURE_NAME = "article-basic"
const TARGET_LANG = "zh-CN"
const SOURCE_URL = "https://privacy.example.test/article-basic?token=secret#private"

export const privacyModePageTranslationSourceScenario: LiveScenarioDefinition<LivePrivacyPageExecution> = {
  id: "bench-live/privacy-mode-page-translation-source",
  title: "Live privacy-mode page translation source",
  surface: "privacy-mode",
  fixture: `page:${FIXTURE_NAME}`,
  description:
    "Runs the real page-translation source module with privacy mode enabled, then verifies that translation call context is sanitized in a real browser-backed run.",
  tags: ["playwright", "page-translation", "privacy", "source-backed"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting privacy-mode page-translation live scenario.", { fixture: FIXTURE_NAME, targetLang: TARGET_LANG })
    try {
      const fixturePage = await materializeFixturePage({ runId: context.runId, fixtureName: FIXTURE_NAME, title: context.title })
      const translatedHtmlPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.privacy-mode.snapshot.html`)
      const sourceResult = await runSourceBackedPageTranslation({
        fixtureHtml: fixturePage.fixtureHtml,
        url: SOURCE_URL,
        title: context.title,
        targetLang: TARGET_LANG,
        contentScope: "page",
        translationMode: "bilingual",
        privacyMode: true,
        snapshotHtmlPath: translatedHtmlPath,
      })

      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        await page.goto(pathToFileURL(translatedHtmlPath).href, { waitUntil: "domcontentloaded" })
        await page.waitForSelector("article h1 [data-astra-translation='1']", { timeout: 10_000 })
        const screenshotPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.privacy-mode.png`)
        await page.screenshot({ path: screenshotPath, fullPage: true })
        return { browserExecutablePath, screenshotPath }
      })

      runtime.attachArtifact("privacyPageTranslationCapture", {
        browserExecutablePath: capture.browserExecutablePath,
        screenshotPath: capture.screenshotPath,
        snapshotHtmlPath: translatedHtmlPath,
        translateCalls: sourceResult.translateCalls,
      })
      runtime.complete("Privacy-mode page translation live scenario completed.")
      const snapshot = runtime.snapshot()
      return {
        status: snapshot.status,
        summary: "Executed the source-backed page translation module with privacy mode enabled and captured the sanitized request context.",
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
        translateCalls: sourceResult.translateCalls,
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary: "The privacy-mode page translation path ran, but no supported local browser executable was available for artifact capture.",
          notes: [error.message],
          artifacts: { browserAdapter: "playwright", browserAvailability: "missing" },
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
          translateCalls: [],
        }
      }
      throw error
    }
  },
  async evaluate(execution, context) {
    const base = buildLivePageTranslationEvaluation(execution, context.runId, context.scenario, context.runtime, {
      successSummary: "Privacy-mode source page translation matched the page-translation contract and kept request context sanitized.",
      failureSummary: "Privacy-mode source page translation diverged from the page-translation contract or leaked request context.",
    }) as Partial<LiveEvaluationResult>

    const privacy = evaluateSanitizedTranslateCalls(execution.translateCalls ?? [], {
      requireHostname: true,
      allowPageUrl: true,
    })
    const issues = [...(base.issues ?? []), ...privacy.issues.map((issue) => issue.evidence ? `${issue.message} (${issue.evidence})` : issue.message)]
    const pass = Boolean(base.pass) && privacy.pass
    return {
      ...base,
      status: pass ? "pass" : "fail",
      pass,
      score: pass ? (base.score ?? 100) : Math.max(0, (base.score ?? 100) - 20),
      issues,
      nextActions: pass ? (base.nextActions ?? []) : [...(base.nextActions ?? []), "Inspect privacy sanitization for page translation requests."],
      artifacts: {
        ...(base.artifacts ?? {}),
        privacyCheck: privacy,
      },
    } as Partial<LiveEvaluationResult>
  },
}
