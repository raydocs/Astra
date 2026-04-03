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
  runSourceBackedBackgroundDirectSuccessPageTranslation,
} from "../../source-runtime"
import { buildLivePageTranslationEvaluation } from "../helpers/page-translation"

interface LiveBackgroundDirectSuccessExecution extends LiveScenarioExecution {
  pageTranslation: PageTranslationExecution
  backgroundDirectSuccess: {
    requestCount: number
    relayRequestCount: number
    finalTransport: "direct" | "relay" | null
    fallbackUsed: boolean
  }
}

const FIXTURE_NAME = "article-basic"

export const backgroundRoutedDirectSuccessPageTranslationSourceHoldoutScenario: LiveScenarioDefinition<LiveBackgroundDirectSuccessExecution> = {
  id: "bench-live/holdout/background-routed-direct-success-page-translation-source",
  title: "Holdout: background-routed direct success page translation source",
  surface: "provider-routing",
  fixture: `page:${FIXTURE_NAME}`,
  description:
    "Runs source-backed page translation through the real background runtime listener with a stubbed direct transport success and verifies that runtime responses expose direct routing metadata without touching relay.",
  tags: ["playwright", "provider-routing", "browser", "holdout", "source-backed", "background-routed"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting background-routed direct-success source-backed holdout.", {
      fixture: FIXTURE_NAME,
      expectedTransport: "direct",
      expectedFallbackUsed: false,
    })

    try {
      const fixturePage = await materializeFixturePage({
        runId: context.runId,
        fixtureName: FIXTURE_NAME,
        title: context.title,
      })
      const translatedHtmlPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.background-direct-success.source.snapshot.html`)

      const sourceResult = await runSourceBackedBackgroundDirectSuccessPageTranslation({
        fixtureHtml: fixturePage.fixtureHtml,
        url: "https://example.com/bench-live/article-basic-background-direct-success",
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

        const screenshotPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.background-direct-success.source.png`)
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

      runtime.attachArtifact("backgroundDirectSuccessHoldout", {
        htmlPath: fixturePage.htmlPath,
        translatedHtmlPath,
        screenshotPath: capture.screenshotPath,
        requestCount: sourceResult.requestCount,
        relayRequestCount: sourceResult.relayRequestCount,
        finalTransport: sourceResult.finalTransport,
        fallbackUsed: sourceResult.fallbackUsed,
      })
      runtime.complete("Background-routed direct-success source-backed holdout completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary:
          "Executed a background-routed direct-success source-backed holdout and confirmed that runtime responses expose real direct routing metadata without touching relay.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Artifact directory: ${fixturePage.artifactDir}`,
          `Runtime translate requests: ${sourceResult.requestCount}`,
          `Relay fetch requests: ${sourceResult.relayRequestCount}`,
          `Final transport: ${sourceResult.finalTransport}`,
          `Fallback used: ${sourceResult.fallbackUsed}`,
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
        backgroundDirectSuccess: {
          requestCount: sourceResult.requestCount,
          relayRequestCount: sourceResult.relayRequestCount,
          finalTransport: sourceResult.finalTransport,
          fallbackUsed: sourceResult.fallbackUsed,
        },
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary:
            "The background-routed direct-success holdout ran, but no supported local browser executable was available for artifact capture.",
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
          backgroundDirectSuccess: {
            requestCount: 0,
            relayRequestCount: 0,
            finalTransport: null,
            fallbackUsed: false,
          },
        }
      }

      throw error
    }
  },
  async evaluate(execution, context) {
    const base = buildLivePageTranslationEvaluation(execution, context.runId, context.scenario, context.runtime, {
      successSummary: "Background-routed direct-success holdout preserved translation correctness while exposing real direct routing metadata.",
      failureSummary: "Background-routed direct-success holdout exposed a regression in background direct routing or metadata visibility.",
    })

    const metrics = execution.backgroundDirectSuccess ?? {
      requestCount: 0,
      relayRequestCount: 0,
      finalTransport: null,
      fallbackUsed: false,
    }

    const extraIssues: string[] = []
    if (metrics.requestCount === 0) {
      extraIssues.push("The background-routed direct-success run did not emit any runtime translate requests.")
    }
    if (metrics.relayRequestCount !== 0) {
      extraIssues.push(`The background-routed direct-success run unexpectedly hit relay ${metrics.relayRequestCount} times.`)
    }
    if (metrics.finalTransport !== "direct") {
      extraIssues.push(`The runtime response reported finalTransport=${metrics.finalTransport ?? "null"} instead of direct.`)
    }
    if (metrics.fallbackUsed !== false) {
      extraIssues.push("The runtime response unexpectedly reported fallbackUsed=true for the direct-success run.")
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
        ? "Background-routed direct-success source-backed holdout confirmed that the real background runtime bridge exposes direct routing metadata without touching relay."
        : "Background-routed direct-success source-backed holdout detected a regression in background direct routing or metadata exposure.",
      issues,
      nextActions: pass ? (base.nextActions ?? []) : [...(base.nextActions ?? []), ...extraIssues],
      artifacts: {
        ...(base.artifacts as Record<string, unknown> | undefined ?? {}),
        backgroundDirectSuccess: metrics,
      },
    } as unknown as Partial<import("../../evaluator").LiveEvaluationResult>
  },
}
