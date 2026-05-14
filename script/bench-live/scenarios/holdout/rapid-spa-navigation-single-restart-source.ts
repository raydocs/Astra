import path from "node:path"
import { pathToFileURL } from "node:url"

import type { PageTranslationExecution } from "../../../bench/evaluators/page-translation"
import {
  materializeFixturePage,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../../driver"
import type { LiveScenarioDefinition, LiveScenarioExecution } from "../../evaluator"
import { runSourceBackedRapidSpaNavigationAutomation } from "../../source-runtime"
import { buildLivePageTranslationEvaluation } from "../helpers/page-translation"

interface LiveRapidSpaNavigationExecution extends LiveScenarioExecution {
  pageTranslation: PageTranslationExecution
  rapidSpaNavigation: {
    requestCountBeforeNavigation: number
    requestCountAfterNavigation: number
    restartedTargetLang: string | null
    restartedPresentationMode: "bilingual" | "translation-only" | null
    hiddenSourceCountAfterNavigation: number
    translationMarkerCountAfterNavigation: number
    navigatedUrl: string
    navigationCount: number
  }
}

const FIXTURE_NAME = "article-basic"

export const rapidSpaNavigationSingleRestartSourceHoldoutScenario: LiveScenarioDefinition<LiveRapidSpaNavigationExecution> = {
  id: "bench-live/holdout/rapid-spa-navigation-single-restart-source",
  title: "Holdout: rapid SPA navigation single restart source",
  surface: "site-automation",
  fixture: `page:${FIXTURE_NAME}`,
  description:
    "Runs two rapid History API navigations after updating site settings and verifies that Astra performs only one effective restart with the latest settings.",
  tags: ["playwright", "site-automation", "browser", "holdout", "source-backed", "spa-navigation"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting rapid source-backed SPA navigation holdout.", {
      fixture: FIXTURE_NAME,
      navigationCount: 2,
    })

    try {
      const fixturePage = await materializeFixturePage({
        runId: context.runId,
        fixtureName: FIXTURE_NAME,
        title: context.title,
      })
      const translatedHtmlPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.rapid-spa-navigation.source.snapshot.html`)

      const sourceResult = await runSourceBackedRapidSpaNavigationAutomation({
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

        const screenshotPath = path.join(fixturePage.artifactDir, `${FIXTURE_NAME}.rapid-spa-navigation.source.png`)
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

      runtime.attachArtifact("rapidSpaNavigationHoldout", {
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
        navigationCount: sourceResult.navigationCount,
      })
      runtime.complete("Rapid source-backed SPA navigation holdout completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary:
          "Executed a rapid source-backed SPA navigation holdout and confirmed that Astra performed only one effective restart with the latest settings.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Artifact directory: ${fixturePage.artifactDir}`,
          `Requests before navigation: ${sourceResult.requestCountBeforeNavigation}`,
          `Requests after navigation: ${sourceResult.requestCountAfterNavigation}`,
          `Restarted target language: ${sourceResult.restartedTargetLang}`,
          `Restarted presentation mode: ${sourceResult.restartedPresentationMode}`,
          `Navigated URL: ${sourceResult.navigatedUrl}`,
          `Navigation count: ${sourceResult.navigationCount}`,
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
        rapidSpaNavigation: {
          requestCountBeforeNavigation: sourceResult.requestCountBeforeNavigation,
          requestCountAfterNavigation: sourceResult.requestCountAfterNavigation,
          restartedTargetLang: sourceResult.restartedTargetLang,
          restartedPresentationMode: sourceResult.restartedPresentationMode,
          hiddenSourceCountAfterNavigation: sourceResult.hiddenSourceCountAfterNavigation,
          translationMarkerCountAfterNavigation: sourceResult.translationMarkerCountAfterNavigation,
          navigatedUrl: sourceResult.navigatedUrl,
          navigationCount: sourceResult.navigationCount,
        },
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary:
            "The rapid SPA navigation holdout ran, but no supported local browser executable was available for artifact capture.",
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
          rapidSpaNavigation: {
            requestCountBeforeNavigation: 0,
            requestCountAfterNavigation: 0,
            restartedTargetLang: null,
            restartedPresentationMode: null,
            hiddenSourceCountAfterNavigation: 0,
            translationMarkerCountAfterNavigation: 0,
            navigatedUrl: "",
            navigationCount: 0,
          },
        }
      }

      throw error
    }
  },
  async evaluate(execution, context) {
    const base = buildLivePageTranslationEvaluation(execution, context.runId, context.scenario, context.runtime, {
      requireTranslationOnly: true,
      successSummary: "Rapid SPA navigation holdout preserved translation correctness after the single effective restart.",
      failureSummary: "Rapid SPA navigation holdout exposed a regression in repeated navigation handling.",
    })

    const metrics = execution.rapidSpaNavigation ?? {
      requestCountBeforeNavigation: 0,
      requestCountAfterNavigation: 0,
      restartedTargetLang: null,
      restartedPresentationMode: null,
      hiddenSourceCountAfterNavigation: 0,
      translationMarkerCountAfterNavigation: 0,
      navigatedUrl: "",
      navigationCount: 0,
    }

    const extraIssues: string[] = []
    if (metrics.requestCountAfterNavigation !== metrics.requestCountBeforeNavigation + 1) {
      extraIssues.push(`Rapid SPA navigation should have produced exactly one additional translation request, but saw before=${metrics.requestCountBeforeNavigation}, after=${metrics.requestCountAfterNavigation}.`)
    }
    if (metrics.restartedTargetLang !== "ja") {
      extraIssues.push(`The effective restart used targetLang=${metrics.restartedTargetLang ?? "null"} instead of ja.`)
    }
    if (metrics.restartedPresentationMode !== "translation-only") {
      extraIssues.push(`The effective restart used presentationMode=${metrics.restartedPresentationMode ?? "null"} instead of translation-only.`)
    }
    if (metrics.hiddenSourceCountAfterNavigation === 0) {
      extraIssues.push("The effective restart did not hide any source blocks after switching to translation-only mode.")
    }
    if (metrics.translationMarkerCountAfterNavigation === 0) {
      extraIssues.push("The effective restart did not render any translation markers.")
    }
    if (!metrics.navigatedUrl.endsWith("/article-basic-nav-2")) {
      extraIssues.push(`Rapid SPA navigation ended on an unexpected URL: ${metrics.navigatedUrl || "<empty>"}.`)
    }
    if (metrics.navigationCount !== 2) {
      extraIssues.push(`Rapid SPA navigation should have recorded 2 navigations, saw ${metrics.navigationCount}.`)
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
        ? "Rapid SPA navigation holdout confirmed that consecutive History API navigations result in a single effective restart with the latest site settings."
        : "Rapid SPA navigation holdout detected duplicate restarts or stale-setting application under repeated navigation.",
      issues,
      nextActions: pass ? (base.nextActions ?? []) : [...(base.nextActions ?? []), ...extraIssues],
      artifacts: {
        ...(base.artifacts as Record<string, unknown> | undefined ?? {}),
        rapidSpaNavigation: metrics,
      },
    } as unknown as Partial<import("../../evaluator").LiveEvaluationResult>
  },
}
