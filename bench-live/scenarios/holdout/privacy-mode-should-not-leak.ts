import path from "node:path"
import { pathToFileURL } from "node:url"

import type { PageTranslationExecution } from "../../../bench/evaluators/page-translation"
import {
  materializeFixturePage,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../../driver"
import type { LiveEvaluationResult, LiveScenarioDefinition, LiveScenarioExecution } from "../../evaluator"
import { runSourceBackedPageTranslation } from "../../source-runtime"
import { buildLivePageTranslationEvaluation } from "../helpers/page-translation"
import { evaluateSanitizedTranslateCalls } from "../helpers/privacy"

interface LivePrivacyHoldoutExecution extends LiveScenarioExecution {
  pageTranslation: PageTranslationExecution
  translateCalls?: Array<{ payload: { context?: Record<string, unknown> } }>
}

const FIXTURE_NAME = "article-basic"
const TARGET_LANG = "zh-CN"
const SOURCE_URL = "https://privacy.example.test/account/billing?auth=topsecret&session=abc123#billing"

export const privacyModeShouldNotLeakHoldoutScenario: LiveScenarioDefinition<LivePrivacyHoldoutExecution> = {
  id: "bench-live/holdout/privacy-mode-should-not-leak",
  title: "Holdout: privacy mode should-not-leak page translation",
  surface: "privacy-mode",
  fixture: `page:${FIXTURE_NAME}`,
  description:
    "Runs page translation with privacy mode enabled against a richer URL and verifies that no query, hash, summary, or title metadata leaks into translation call context.",
  tags: ["playwright", "privacy", "holdout", "page-translation"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting privacy-mode should-not-leak holdout.", { fixture: FIXTURE_NAME, targetLang: TARGET_LANG })
    try {
      const fixturePage = await materializeFixturePage({ runId: context.runId, fixtureName: FIXTURE_NAME, title: context.title })
      const translatedHtmlPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.privacy-holdout.snapshot.html`)
      const sourceResult = await runSourceBackedPageTranslation({
        fixtureHtml: fixturePage.fixtureHtml,
        url: SOURCE_URL,
        title: `${context.title} — Private Notes`,
        targetLang: TARGET_LANG,
        contentScope: "article",
        translationMode: "translation-only",
        privacyMode: true,
        snapshotHtmlPath: translatedHtmlPath,
      })

      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        await page.goto(pathToFileURL(translatedHtmlPath).href, { waitUntil: "domcontentloaded" })
        await page.waitForSelector("article h1 [data-astra-translation='1']", { timeout: 10_000 })
        const screenshotPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.privacy-holdout.png`)
        await page.screenshot({ path: screenshotPath, fullPage: true })
        return { browserExecutablePath, screenshotPath }
      })

      runtime.attachArtifact("privacyHoldoutCapture", {
        browserExecutablePath: capture.browserExecutablePath,
        screenshotPath: capture.screenshotPath,
        snapshotHtmlPath: translatedHtmlPath,
        translateCalls: sourceResult.translateCalls,
      })
      runtime.complete("Privacy-mode should-not-leak holdout completed.")
      const snapshot = runtime.snapshot()
      return {
        status: snapshot.status,
        summary: "Executed a privacy-mode holdout with richer URL/title context and captured the translation request payloads for leak inspection.",
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
          summary: "The privacy-mode holdout is wired, but no supported local browser executable is available in this environment.",
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
      requireTranslationOnly: true,
      successSummary: "Privacy-mode holdout passed: translation-only rendering stayed correct and request context remained sanitized.",
      failureSummary: "Privacy-mode holdout failed: translation-only rendering diverged or request context leaked private metadata.",
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
      score: pass ? (base.score ?? 100) : Math.max(0, (base.score ?? 100) - 25),
      issues,
      nextActions: pass ? (base.nextActions ?? []) : [...(base.nextActions ?? []), "Inspect privacy sanitization and translation-only privacy-mode page rendering."],
      artifacts: {
        ...(base.artifacts ?? {}),
        privacyCheck: privacy,
      },
    } as Partial<LiveEvaluationResult>
  },
}
