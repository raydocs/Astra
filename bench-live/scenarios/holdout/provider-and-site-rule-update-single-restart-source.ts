import path from "node:path"
import { pathToFileURL } from "node:url"

import type { PageTranslationExecution } from "../../../bench/evaluators/page-translation"
import {
  materializeFixturePage,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../../driver"
import type { LiveScenarioDefinition, LiveScenarioExecution } from "../../evaluator"
import {
  runSourceBackedProviderAndSiteRuleUpdateAutomation,
} from "../../source-runtime"
import { buildLivePageTranslationEvaluation } from "../helpers/page-translation"

interface LiveProviderAndSiteRuleUpdateExecution extends LiveScenarioExecution {
  pageTranslation: PageTranslationExecution
  providerAndSiteRuleUpdate: {
    requestCountBeforeUpdate: number
    requestCountAfterUpdate: number
    restartSessionCount: number
    initialFinalTransport: "direct" | "relay" | null
    restartedFinalTransport: "direct" | "relay" | null
    restartedFallbackUsed: boolean
    restartedTargetLang: string | null
    restartedPresentationMode: "bilingual" | "translation-only" | null
    hiddenSourceCountAfterUpdate: number
    translationMarkerCountAfterUpdate: number
  }
}

const FIXTURE_NAME = "article-basic"

export const providerAndSiteRuleUpdateSingleRestartSourceHoldoutScenario: LiveScenarioDefinition<LiveProviderAndSiteRuleUpdateExecution> = {
  id: "bench-live/holdout/provider-and-site-rule-update-single-restart-source",
  title: "Holdout: provider and site rule update single restart source",
  surface: "site-automation",
  fixture: `page:${FIXTURE_NAME}`,
  description:
    "Runs the real content automation path against article-basic, applies a single storage write that changes both provider transport and translation-affecting site settings, and verifies that the active session restarts exactly once with the updated routing metadata and translation-only rendering.",
  tags: ["playwright", "site-automation", "provider-routing", "browser", "holdout", "source-backed"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting source-backed provider+site-rule update holdout.", {
      fixture: FIXTURE_NAME,
      initialTransport: "direct",
      restartedTransport: "relay",
      restartedTargetLang: "ja",
      restartedPresentationMode: "translation-only",
    })

    try {
      const fixturePage = await materializeFixturePage({
        runId: context.runId,
        fixtureName: FIXTURE_NAME,
        title: context.title,
      })
      const translatedHtmlPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.provider-site-update.source.snapshot.html`)

      const sourceResult = await runSourceBackedProviderAndSiteRuleUpdateAutomation({
        fixtureHtml: fixturePage.fixtureHtml,
        url: "https://example.com/bench-live/article-basic-provider-site-update",
        title: context.title,
        snapshotHtmlPath: translatedHtmlPath,
      })

      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        await page.goto(pathToFileURL(translatedHtmlPath).href, {
          waitUntil: "domcontentloaded",
        })
        await page.waitForSelector("[data-astra-translation='1']", {
          timeout: 10_000,
        })
        await page.waitForFunction(() => document.querySelectorAll("[data-astra-source-hidden]").length > 0, undefined, {
          timeout: 10_000,
        })

        const screenshotPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.provider-site-update.source.png`)
        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
        })

        return {
          browserExecutablePath,
          screenshotPath,
          hiddenSourceCount: await page.locator("[data-astra-source-hidden]").count(),
          translationMarkerCount: await page.locator("[data-astra-translation='1']").count(),
        }
      })

      runtime.attachArtifact("providerAndSiteRuleUpdateHoldout", {
        htmlPath: fixturePage.htmlPath,
        translatedHtmlPath,
        screenshotPath: capture.screenshotPath,
        requestCountBeforeUpdate: sourceResult.requestCountBeforeUpdate,
        requestCountAfterUpdate: sourceResult.requestCountAfterUpdate,
        restartSessionCount: sourceResult.restartSessionCount,
        initialFinalTransport: sourceResult.initialFinalTransport,
        restartedFinalTransport: sourceResult.restartedFinalTransport,
        restartedFallbackUsed: sourceResult.restartedFallbackUsed,
        restartedTargetLang: sourceResult.restartedTargetLang,
        restartedPresentationMode: sourceResult.restartedPresentationMode,
        hiddenSourceCountAfterUpdate: sourceResult.hiddenSourceCountAfterUpdate,
      })
      runtime.complete("Source-backed provider+site-rule update holdout completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary:
          "Executed a source-backed provider+site-rule update holdout and confirmed that the active session restarted exactly once with updated routing metadata and translation-only rendering.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Artifact directory: ${fixturePage.artifactDir}`,
          `Requests before update: ${sourceResult.requestCountBeforeUpdate}`,
          `Requests after update: ${sourceResult.requestCountAfterUpdate}`,
          `Restart session count: ${sourceResult.restartSessionCount}`,
          `Initial transport: ${sourceResult.initialFinalTransport}`,
          `Restarted transport: ${sourceResult.restartedFinalTransport}`,
          `Restarted fallback used: ${sourceResult.restartedFallbackUsed}`,
          `Restarted target language: ${sourceResult.restartedTargetLang}`,
          `Restarted presentation mode: ${sourceResult.restartedPresentationMode}`,
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
        providerAndSiteRuleUpdate: {
          requestCountBeforeUpdate: sourceResult.requestCountBeforeUpdate,
          requestCountAfterUpdate: sourceResult.requestCountAfterUpdate,
          restartSessionCount: sourceResult.restartSessionCount,
          initialFinalTransport: sourceResult.initialFinalTransport,
          restartedFinalTransport: sourceResult.restartedFinalTransport,
          restartedFallbackUsed: sourceResult.restartedFallbackUsed,
          restartedTargetLang: sourceResult.restartedTargetLang,
          restartedPresentationMode: sourceResult.restartedPresentationMode,
          hiddenSourceCountAfterUpdate: sourceResult.hiddenSourceCountAfterUpdate,
          translationMarkerCountAfterUpdate: sourceResult.translationMarkerCountAfterUpdate,
        },
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary:
            "The provider+site-rule update holdout ran, but no supported local browser executable was available for artifact capture.",
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
          providerAndSiteRuleUpdate: {
            requestCountBeforeUpdate: 0,
            requestCountAfterUpdate: 0,
            restartSessionCount: 0,
            initialFinalTransport: null,
            restartedFinalTransport: null,
            restartedFallbackUsed: false,
            restartedTargetLang: null,
            restartedPresentationMode: null,
            hiddenSourceCountAfterUpdate: 0,
            translationMarkerCountAfterUpdate: 0,
          },
        }
      }

      throw error
    }
  },
  async evaluate(execution, context) {
    const base = buildLivePageTranslationEvaluation(execution, context.runId, context.scenario, context.runtime, {
      requireTranslationOnly: true,
      successSummary: "Source-backed provider+site-rule update holdout preserved translation correctness after the combined restart.",
      failureSummary: "Source-backed provider+site-rule update holdout exposed a regression after the combined restart.",
    })

    const metrics = execution.providerAndSiteRuleUpdate ?? {
      requestCountBeforeUpdate: 0,
      requestCountAfterUpdate: 0,
      restartSessionCount: 0,
      initialFinalTransport: null,
      restartedFinalTransport: null,
      restartedFallbackUsed: false,
      restartedTargetLang: null,
      restartedPresentationMode: null,
      hiddenSourceCountAfterUpdate: 0,
      translationMarkerCountAfterUpdate: 0,
    }

    const extraIssues: string[] = []
    if (metrics.requestCountAfterUpdate !== metrics.requestCountBeforeUpdate + 1) {
      extraIssues.push(`The combined provider/site update should issue exactly one additional translation request, got before=${metrics.requestCountBeforeUpdate}, after=${metrics.requestCountAfterUpdate}.`)
    }
    if (metrics.restartSessionCount !== 1) {
      extraIssues.push(`The combined provider/site update should restart exactly one session, got restartSessionCount=${metrics.restartSessionCount}.`)
    }
    if (metrics.initialFinalTransport !== "direct") {
      extraIssues.push(`The initial request reported finalTransport=${metrics.initialFinalTransport ?? "null"} instead of direct.`)
    }
    if (metrics.restartedFinalTransport !== "relay") {
      extraIssues.push(`The restarted request reported finalTransport=${metrics.restartedFinalTransport ?? "null"} instead of relay.`)
    }
    if (metrics.restartedFallbackUsed !== false) {
      extraIssues.push("The restarted request unexpectedly reported fallbackUsed=true instead of a clean relay restart.")
    }
    if (metrics.restartedTargetLang !== "ja") {
      extraIssues.push(`The restarted request used targetLang=${metrics.restartedTargetLang ?? "null"} instead of ja.`)
    }
    if (metrics.restartedPresentationMode !== "translation-only") {
      extraIssues.push(`The restarted session used presentationMode=${metrics.restartedPresentationMode ?? "null"} instead of translation-only.`)
    }
    if (metrics.hiddenSourceCountAfterUpdate === 0) {
      extraIssues.push("The restarted session did not hide any source blocks after switching to translation-only mode.")
    }
    if (metrics.translationMarkerCountAfterUpdate === 0) {
      extraIssues.push("The restarted session did not render any translation markers.")
    }

    const baseIssues = Array.isArray(base.issues) ? base.issues : []
    const issues = [...baseIssues, ...extraIssues]
    const baseScore = typeof base.score === "number" ? base.score : 0
    const score = extraIssues.length === 0 ? baseScore : Math.max(0, baseScore - (extraIssues.length * 15))
    const pass = Boolean(base.pass) && extraIssues.length === 0

    return {
      ...base,
      status: pass ? "pass" : "fail",
      pass,
      score,
      summary: pass
        ? "Source-backed provider+site-rule update holdout confirmed that one combined storage write restarts the active session exactly once with updated routing metadata and translation-only rendering."
        : "Source-backed provider+site-rule update holdout detected a regression in combined restart behavior or updated-setting application.",
      issues,
      nextActions: pass ? (base.nextActions ?? []) : [...(base.nextActions ?? []), ...extraIssues],
      artifacts: {
        ...(base.artifacts as Record<string, unknown> | undefined ?? {}),
        providerAndSiteRuleUpdate: metrics,
      },
    } as unknown as Partial<import("../../evaluator").LiveEvaluationResult>
  },
}
