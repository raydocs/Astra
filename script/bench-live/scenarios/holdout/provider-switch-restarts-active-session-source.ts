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
  runSourceBackedProviderSwitchAutomation,
} from "../../source-runtime"
import { buildLivePageTranslationEvaluation } from "../helpers/page-translation"

interface LiveProviderSwitchExecution extends LiveScenarioExecution {
  pageTranslation: PageTranslationExecution
  providerSwitch: {
    requestCountBeforeUpdate: number
    requestCountAfterUpdate: number
    restartSessionCount: number
    initialFinalTransport: "direct" | "relay" | null
    restartedFinalTransport: "direct" | "relay" | null
    restartedFallbackUsed: boolean
  }
}

const FIXTURE_NAME = "article-basic"

export const providerSwitchRestartsActiveSessionSourceHoldoutScenario: LiveScenarioDefinition<LiveProviderSwitchExecution> = {
  id: "bench-live/holdout/provider-switch-restarts-active-session-source",
  title: "Holdout: provider switch restarts active session source",
  surface: "site-automation",
  fixture: `page:${FIXTURE_NAME}`,
  description:
    "Runs the real content automation path against article-basic, updates provider settings during an active session, and verifies that the restarted request reports the new transport metadata.",
  tags: ["playwright", "site-automation", "provider-routing", "browser", "holdout", "source-backed"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting source-backed provider-switch holdout.", {
      fixture: FIXTURE_NAME,
      initialTransport: "direct",
      restartedTransport: "relay",
    })

    try {
      const fixturePage = await materializeFixturePage({
        runId: context.runId,
        fixtureName: FIXTURE_NAME,
        title: context.title,
      })
      const translatedHtmlPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.provider-switch.source.snapshot.html`)

      const sourceResult = await runSourceBackedProviderSwitchAutomation({
        fixtureHtml: fixturePage.fixtureHtml,
        url: "https://example.com/bench-live/article-basic-provider-switch",
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

        const screenshotPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.provider-switch.source.png`)
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

      runtime.attachArtifact("providerSwitchHoldout", {
        htmlPath: fixturePage.htmlPath,
        translatedHtmlPath,
        screenshotPath: capture.screenshotPath,
        requestCountBeforeUpdate: sourceResult.requestCountBeforeUpdate,
        requestCountAfterUpdate: sourceResult.requestCountAfterUpdate,
        restartSessionCount: sourceResult.restartSessionCount,
        initialFinalTransport: sourceResult.initialFinalTransport,
        restartedFinalTransport: sourceResult.restartedFinalTransport,
        restartedFallbackUsed: sourceResult.restartedFallbackUsed,
      })
      runtime.complete("Source-backed provider-switch holdout completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary:
          "Executed a source-backed provider-switch holdout and confirmed that the active session restarted with updated transport metadata.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Artifact directory: ${fixturePage.artifactDir}`,
          `Requests before update: ${sourceResult.requestCountBeforeUpdate}`,
          `Requests after update: ${sourceResult.requestCountAfterUpdate}`,
          `Restart session count: ${sourceResult.restartSessionCount}`,
          `Initial transport: ${sourceResult.initialFinalTransport}`,
          `Restarted transport: ${sourceResult.restartedFinalTransport}`,
          `Restarted fallback used: ${sourceResult.restartedFallbackUsed}`,
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
        providerSwitch: {
          requestCountBeforeUpdate: sourceResult.requestCountBeforeUpdate,
          requestCountAfterUpdate: sourceResult.requestCountAfterUpdate,
          restartSessionCount: sourceResult.restartSessionCount,
          initialFinalTransport: sourceResult.initialFinalTransport,
          restartedFinalTransport: sourceResult.restartedFinalTransport,
          restartedFallbackUsed: sourceResult.restartedFallbackUsed,
        },
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary:
            "The provider-switch holdout ran, but no supported local browser executable was available for artifact capture.",
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
          providerSwitch: {
            requestCountBeforeUpdate: 0,
            requestCountAfterUpdate: 0,
            restartSessionCount: 0,
            initialFinalTransport: null,
            restartedFinalTransport: null,
            restartedFallbackUsed: false,
          },
        }
      }

      throw error
    }
  },
  async evaluate(execution, context) {
    const base = buildLivePageTranslationEvaluation(execution, context.runId, context.scenario, context.runtime, {
      successSummary: "Source-backed provider-switch holdout preserved translation correctness after the active-session restart.",
      failureSummary: "Source-backed provider-switch holdout exposed a regression after the active-session restart.",
    })

    const metrics = execution.providerSwitch ?? {
      requestCountBeforeUpdate: 0,
      requestCountAfterUpdate: 0,
      restartSessionCount: 0,
      initialFinalTransport: null,
      restartedFinalTransport: null,
      restartedFallbackUsed: false,
    }

    const extraIssues: string[] = []
    if (metrics.requestCountAfterUpdate !== metrics.requestCountBeforeUpdate + 1) {
      extraIssues.push(`The provider update should issue exactly one additional translation request, got before=${metrics.requestCountBeforeUpdate}, after=${metrics.requestCountAfterUpdate}.`)
    }
    if (metrics.restartSessionCount !== 1) {
      extraIssues.push(`The provider update should restart exactly one session, got restartSessionCount=${metrics.restartSessionCount}.`)
    }
    if (metrics.initialFinalTransport !== "direct") {
      extraIssues.push(`The initial request reported finalTransport=${metrics.initialFinalTransport ?? "null"} instead of direct.`)
    }
    if (metrics.restartedFinalTransport !== "relay") {
      extraIssues.push(`The restarted request reported finalTransport=${metrics.restartedFinalTransport ?? "null"} instead of relay.`)
    }
    if (metrics.restartedFallbackUsed !== false) {
      extraIssues.push("The restarted request unexpectedly reported fallbackUsed=true instead of a clean transport switch.")
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
        ? "Source-backed provider-switch holdout confirmed that provider updates restart the active session and expose the updated routing metadata."
        : "Source-backed provider-switch holdout detected a regression in restart behavior or routing metadata visibility.",
      issues,
      nextActions: pass ? (base.nextActions ?? []) : [...(base.nextActions ?? []), ...extraIssues],
      artifacts: {
        ...(base.artifacts as Record<string, unknown> | undefined ?? {}),
        providerSwitch: metrics,
      },
    } as unknown as Partial<import("../../evaluator").LiveEvaluationResult>
  },
}
