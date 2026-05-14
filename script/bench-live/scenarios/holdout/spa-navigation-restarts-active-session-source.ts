import path from "node:path"
import { pathToFileURL } from "node:url"

import type { PageTranslationExecution } from "../../../bench/evaluators/page-translation"
import {
  materializeFixturePage,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../../driver"
import type { LiveScenarioDefinition, LiveScenarioExecution } from "../../evaluator"
import { runSourceBackedSpaNavigationAutomation } from "../../source-runtime"
import { buildLivePageTranslationEvaluation } from "../helpers/page-translation"

interface LiveSpaNavigationExecution extends LiveScenarioExecution {
  pageTranslation: PageTranslationExecution
  spaNavigation: {
    requestCountBeforeNavigation: number
    requestCountAfterNavigation: number
    restartedTargetLang: string | null
    restartedPresentationMode: "bilingual" | "translation-only" | null
    hiddenSourceCountAfterNavigation: number
    translationMarkerCountAfterNavigation: number
    navigatedUrl: string
  }
}

const FIXTURE_NAME = "article-basic"

export const spaNavigationRestartsActiveSessionSourceHoldoutScenario: LiveScenarioDefinition<LiveSpaNavigationExecution> = {
  id: "bench-live/holdout/spa-navigation-restarts-active-session-source",
  title: "Holdout: SPA navigation restarts active session source",
  surface: "site-automation",
  fixture: `page:${FIXTURE_NAME}`,
  description:
    "Runs the real content automation path, changes the URL via the History API, and verifies that the SPA restart path uses the latest site settings for the restarted session.",
  tags: ["playwright", "site-automation", "browser", "holdout", "source-backed", "spa-navigation"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting source-backed SPA navigation holdout.", {
      fixture: FIXTURE_NAME,
      updatedTargetLang: "ja",
      updatedPresentationMode: "translation-only",
    })

    try {
      const fixturePage = await materializeFixturePage({
        runId: context.runId,
        fixtureName: FIXTURE_NAME,
        title: context.title,
      })
      const translatedHtmlPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.spa-navigation.source.snapshot.html`)

      const sourceResult = await runSourceBackedSpaNavigationAutomation({
        fixtureHtml: fixturePage.fixtureHtml,
        url: "https://example.com/bench-live/article-basic",
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

        const screenshotPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.spa-navigation.source.png`)
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

      runtime.attachArtifact("spaNavigationHoldout", {
        htmlPath: fixturePage.htmlPath,
        translatedHtmlPath,
        screenshotPath: capture.screenshotPath,
        requestCountBeforeNavigation: sourceResult.requestCountBeforeNavigation,
        requestCountAfterNavigation: sourceResult.requestCountAfterNavigation,
        restartedTargetLang: sourceResult.restartedTargetLang,
        restartedPresentationMode: sourceResult.restartedPresentationMode,
        hiddenSourceCountAfterNavigation: sourceResult.hiddenSourceCountAfterNavigation,
        browserHiddenSourceCount: capture.hiddenSourceCount,
        navigatedUrl: sourceResult.navigatedUrl,
      })
      runtime.complete("Source-backed SPA navigation holdout completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary:
          "Executed a source-backed SPA navigation holdout and confirmed that the restart used the latest site settings after History API navigation.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Artifact directory: ${fixturePage.artifactDir}`,
          `Requests before navigation: ${sourceResult.requestCountBeforeNavigation}`,
          `Requests after navigation: ${sourceResult.requestCountAfterNavigation}`,
          `Restarted target language: ${sourceResult.restartedTargetLang}`,
          `Restarted presentation mode: ${sourceResult.restartedPresentationMode}`,
          `Navigated URL: ${sourceResult.navigatedUrl}`,
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
        spaNavigation: {
          requestCountBeforeNavigation: sourceResult.requestCountBeforeNavigation,
          requestCountAfterNavigation: sourceResult.requestCountAfterNavigation,
          restartedTargetLang: sourceResult.restartedTargetLang,
          restartedPresentationMode: sourceResult.restartedPresentationMode,
          hiddenSourceCountAfterNavigation: sourceResult.hiddenSourceCountAfterNavigation,
          translationMarkerCountAfterNavigation: sourceResult.translationMarkerCountAfterNavigation,
          navigatedUrl: sourceResult.navigatedUrl,
        },
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary:
            "The SPA navigation holdout ran, but no supported local browser executable was available for artifact capture.",
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
          spaNavigation: {
            requestCountBeforeNavigation: 0,
            requestCountAfterNavigation: 0,
            restartedTargetLang: null,
            restartedPresentationMode: null,
            hiddenSourceCountAfterNavigation: 0,
            translationMarkerCountAfterNavigation: 0,
            navigatedUrl: "",
          },
        }
      }

      throw error
    }
  },
  async evaluate(execution, context) {
    const base = buildLivePageTranslationEvaluation(execution, context.runId, context.scenario, context.runtime, {
      requireTranslationOnly: true,
      successSummary: "Source-backed SPA navigation holdout preserved translation correctness after the restart.",
      failureSummary: "Source-backed SPA navigation holdout exposed a regression after the restart.",
    })

    const metrics = execution.spaNavigation ?? {
      requestCountBeforeNavigation: 0,
      requestCountAfterNavigation: 0,
      restartedTargetLang: null,
      restartedPresentationMode: null,
      hiddenSourceCountAfterNavigation: 0,
      translationMarkerCountAfterNavigation: 0,
      navigatedUrl: "",
    }

    const extraIssues: string[] = []
    if (metrics.requestCountAfterNavigation <= metrics.requestCountBeforeNavigation) {
      extraIssues.push("The SPA navigation did not issue a second translation request.")
    }
    if (metrics.restartedTargetLang !== "ja") {
      extraIssues.push(`The SPA restart used targetLang=${metrics.restartedTargetLang ?? "null"} instead of ja.`)
    }
    if (metrics.restartedPresentationMode !== "translation-only") {
      extraIssues.push(`The SPA restart used presentationMode=${metrics.restartedPresentationMode ?? "null"} instead of translation-only.`)
    }
    if (metrics.hiddenSourceCountAfterNavigation === 0) {
      extraIssues.push("The SPA restart did not hide any source blocks after switching to translation-only mode.")
    }
    if (metrics.translationMarkerCountAfterNavigation === 0) {
      extraIssues.push("The SPA restart did not render any translation markers.")
    }
    if (!metrics.navigatedUrl.endsWith("/article-basic-next")) {
      extraIssues.push(`The SPA navigation ended on an unexpected URL: ${metrics.navigatedUrl || "<empty>"}.`)
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
        ? "Source-backed SPA navigation holdout confirmed that History API navigation restarts the active session with the latest site settings."
        : "Source-backed SPA navigation holdout detected a regression in restart behavior or updated-setting application.",
      issues,
      nextActions: pass ? (base.nextActions ?? []) : [...(base.nextActions ?? []), ...extraIssues],
      artifacts: {
        ...(base.artifacts as Record<string, unknown> | undefined ?? {}),
        spaNavigation: metrics,
      },
    } as unknown as Partial<import("../../evaluator").LiveEvaluationResult>
  },
}
