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
  runSourceBackedBackgroundRelayOnlyPageTranslation,
} from "../../source-runtime"
import { buildLivePageTranslationEvaluation } from "../helpers/page-translation"

interface LiveBackgroundRelayOnlyExecution extends LiveScenarioExecution {
  pageTranslation: PageTranslationExecution
  backgroundRelayOnly: {
    requestCount: number
    relayRequestCount: number
    finalTransport: "direct" | "relay" | null
    fallbackUsed: boolean
  }
}

const FIXTURE_NAME = "article-basic"

export const backgroundRoutedRelayOnlyPageTranslationSourceHoldoutScenario: LiveScenarioDefinition<LiveBackgroundRelayOnlyExecution> = {
  id: "bench-live/holdout/background-routed-relay-only-page-translation-source",
  title: "Holdout: background-routed relay-only page translation source",
  surface: "provider-routing",
  fixture: `page:${FIXTURE_NAME}`,
  description:
    "Runs source-backed page translation through the real background runtime listener with relay-only provider access and verifies that runtime responses expose relay routing metadata.",
  tags: ["playwright", "provider-routing", "browser", "holdout", "source-backed", "background-routed"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting background-routed relay-only source-backed holdout.", {
      fixture: FIXTURE_NAME,
      expectedTransport: "relay",
    })

    try {
      const fixturePage = await materializeFixturePage({
        runId: context.runId,
        fixtureName: FIXTURE_NAME,
        title: context.title,
      })
      const translatedHtmlPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.background-relay-only.source.snapshot.html`)

      const sourceResult = await runSourceBackedBackgroundRelayOnlyPageTranslation({
        fixtureHtml: fixturePage.fixtureHtml,
        url: "https://example.com/bench-live/article-basic-background-relay-only",
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

        const screenshotPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.background-relay-only.source.png`)
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

      runtime.attachArtifact("backgroundRelayOnlyHoldout", {
        htmlPath: fixturePage.htmlPath,
        translatedHtmlPath,
        screenshotPath: capture.screenshotPath,
        requestCount: sourceResult.requestCount,
        relayRequestCount: sourceResult.relayRequestCount,
        finalTransport: sourceResult.finalTransport,
        fallbackUsed: sourceResult.fallbackUsed,
      })
      runtime.complete("Background-routed relay-only source-backed holdout completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary:
          "Executed a background-routed relay-only source-backed holdout and confirmed that runtime responses expose relay routing metadata.",
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
        backgroundRelayOnly: {
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
            "The background-routed relay-only holdout ran, but no supported local browser executable was available for artifact capture.",
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
          backgroundRelayOnly: {
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
      successSummary: "Background-routed relay-only holdout preserved translation correctness while exposing relay routing metadata.",
      failureSummary: "Background-routed relay-only holdout exposed a regression in background routing or metadata visibility.",
    })

    const metrics = execution.backgroundRelayOnly ?? {
      requestCount: 0,
      relayRequestCount: 0,
      finalTransport: null,
      fallbackUsed: false,
    }

    const extraIssues: string[] = []
    if (metrics.requestCount === 0) {
      extraIssues.push("The background-routed relay-only run did not emit any runtime translate requests.")
    }
    if (metrics.relayRequestCount === 0) {
      extraIssues.push("The background-routed relay-only run did not hit the relay fetch path.")
    }
    if (metrics.finalTransport !== "relay") {
      extraIssues.push(`The runtime response reported finalTransport=${metrics.finalTransport ?? "null"} instead of relay.`)
    }
    if (metrics.fallbackUsed !== false) {
      extraIssues.push("The runtime response unexpectedly reported fallbackUsed=true for a relay-only run.")
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
        ? "Background-routed relay-only source-backed holdout confirmed that the real background runtime bridge exposes relay routing metadata."
        : "Background-routed relay-only source-backed holdout detected a regression in background routing or metadata exposure.",
      issues,
      nextActions: pass ? (base.nextActions ?? []) : [...(base.nextActions ?? []), ...extraIssues],
      artifacts: {
        ...(base.artifacts as Record<string, unknown> | undefined ?? {}),
        backgroundRelayOnly: metrics,
      },
    } as unknown as Partial<import("../../evaluator").LiveEvaluationResult>
  },
}
