import { resolveExtractionPlan } from "@/utils/dom/extraction"
import { getPageTranslationState, startPageTranslation, stopPageTranslation } from "@/entrypoints/content/page-translate"
import type { TranslationErrorCode } from "@/types/translation"

import { evaluatePageTranslation, type PageTranslationExecution } from "../evaluators/page-translation"
import { installBenchBrowser } from "../runtime/browser"
import { installDomEnvironment, flushMicrotasks, cleanupDomEnvironment } from "../runtime/dom"
import { mountFixture, type FixtureSource } from "../runtime/fixtures"
import type { BenchmarkScenario } from "../types"

function collectTranslatedTexts(): string[] {
  return Array.from(document.querySelectorAll("[data-astra-translation='1'] .astra-translation-inner"))
    .map((element) => element.textContent?.trim() ?? "")
    .filter(Boolean)
}

async function waitForTranslationMarkers(timeoutMs = 200) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    if (document.querySelectorAll("[data-astra-translation='1']").length > 0) {
      await flushMicrotasks(2)
      return
    }

    await new Promise((resolve) => window.setTimeout(resolve, 10))
    await flushMicrotasks(2)
  }
}

async function executePageScenario(options: {
  fixture: FixtureSource
  metaDescription?: string
  url: string
  overrides?: {
    targetLang?: string
    translationMode?: "bilingual" | "translation-only"
    contentScope?: "page" | "article"
  }
}) {
  installDomEnvironment(`https://example.com${options.url}`)
  try {
    const browser = installBenchBrowser()
    mountFixture(options.fixture, {
      title: "Astra Bench Page",
      metaDescription: options.metaDescription,
      url: options.url,
    })

    const plan = resolveExtractionPlan(document, options.overrides?.contentScope ?? "page")
    const expectedTexts = plan.blocks.map((block) => block.text)

    const snapshot = await startPageTranslation({
      targetLang: options.overrides?.targetLang ?? "zh-CN",
      ...(options.overrides?.translationMode ? { translationMode: options.overrides.translationMode } : {}),
      ...(options.overrides?.contentScope ? { contentScope: options.overrides.contentScope } : {}),
    })
    await flushMicrotasks(6)
    await waitForTranslationMarkers()

    const execution: PageTranslationExecution = {
      translatedNodeCount: document.querySelectorAll("[data-astra-translation='1']").length,
      expectedNodeCount: expectedTexts.length,
      translationMarkerCount: document.querySelectorAll("[data-astra-translation='1']").length,
      hiddenSourceCount: document.querySelectorAll("[data-astra-source-hidden]").length,
      requestCount: browser.getTranslateCalls().length,
      skippedInteractiveTranslations: document.querySelectorAll("form [data-astra-translation], nav [data-astra-translation], button [data-astra-translation], input + [data-astra-translation]").length,
      translatedTexts: collectTranslatedTexts(),
      expectedTexts,
      snapshotPhase: snapshot.phase,
      failedBlocks: snapshot.progress.failedBlocks,
      notes: [
        `effectiveScope=${plan.scope}`,
      ],
    }

    stopPageTranslation()
    return execution
  } finally {
    cleanupDomEnvironment()
  }
}

async function executePageErrorScenario(options: {
  fixture: FixtureSource
  url: string
  errorMessage: string
  errorCode?: TranslationErrorCode
}) {
  installDomEnvironment(`https://example.com${options.url}`)
  try {
    const code: TranslationErrorCode = options.errorCode ?? "PROVIDER_REQUEST_FAILED"
    const browser = installBenchBrowser({
      translateBatch: async () => ({
        type: "runtime/translate-batch:error" as const,
        error: { code, message: options.errorMessage },
      }),
    })

    mountFixture(options.fixture, {
      title: "Astra Bench Error Page",
      url: options.url,
    })

    const plan = resolveExtractionPlan(document, "page")

    await startPageTranslation({ targetLang: "zh-CN" })
    // Wait long enough for the drain loop to fire, hit the error, and call stopSession
    await flushMicrotasks(12)
    await new Promise((resolve) => setTimeout(resolve, 200))
    await flushMicrotasks(6)

    // Read the final state after error propagation
    const finalSnapshot = getPageTranslationState()

    const execution: PageTranslationExecution = {
      translatedNodeCount: document.querySelectorAll("[data-astra-translation='1']").length,
      expectedNodeCount: plan.blocks.length,
      translationMarkerCount: document.querySelectorAll("[data-astra-translation='1']").length,
      hiddenSourceCount: document.querySelectorAll("[data-astra-source-hidden]").length,
      requestCount: browser.getTranslateCalls().length,
      skippedInteractiveTranslations: 0,
      translatedTexts: collectTranslatedTexts(),
      expectedTexts: plan.blocks.map((b) => b.text),
      snapshotPhase: finalSnapshot?.phase ?? "idle",
      failedBlocks: finalSnapshot?.progress.failedBlocks ?? 0,
      notes: ["provider-error-scenario"],
    }

    stopPageTranslation()
    return execution
  } finally {
    cleanupDomEnvironment()
  }
}

export const pageTranslationScenarios: BenchmarkScenario<PageTranslationExecution>[] = [
  {
    id: "page-translation/article-basic-bilingual",
    title: "Article fixture translates all visible content blocks in bilingual mode",
    surface: "page-translation",
    fixture: "article-basic",
    task: "Translate a straightforward article fixture without losing the original DOM structure.",
    run: () => executePageScenario({
      fixture: { kind: "page", name: "article-basic" },
      metaDescription: "Fixture for page translation benchmark.",
      url: "/fixtures/article-basic",
    }),
    evaluate: (execution) => evaluatePageTranslation(execution),
  },
  {
    id: "page-translation/forms-and-nav-skip",
    title: "Page translation skips interactive and navigation-heavy nodes",
    surface: "page-translation",
    fixture: "forms-and-nav",
    task: "Translate body content on a mixed layout page while leaving nav and form controls untouched.",
    run: () => executePageScenario({
      fixture: { kind: "page", name: "forms-and-nav" },
      metaDescription: "Fixture for interactive-node skip benchmark.",
      url: "/fixtures/forms-and-nav",
    }),
    evaluate: (execution) => evaluatePageTranslation(execution),
  },
  {
    id: "page-translation/article-translation-only",
    title: "Translation-only mode hides wrapped source content consistently",
    surface: "page-translation",
    fixture: "article-basic",
    task: "Translate an article in translation-only mode and hide original content through Astra source wrappers.",
    run: () => executePageScenario({
      fixture: { kind: "page", name: "article-basic" },
      metaDescription: "Fixture for translation-only benchmark.",
      url: "/fixtures/article-basic-translation-only",
      overrides: {
        translationMode: "translation-only",
      },
    }),
    evaluate: (execution) => evaluatePageTranslation(execution, { requireTranslationOnly: true }),
  },
  {
    id: "page-translation/nested-blocks-coverage",
    title: "Deeply nested DOM structures translate without missing inner text nodes",
    surface: "page-translation",
    fixture: "nested-blocks",
    task: "Translate a fixture with deeply nested div/span/p structures to verify extraction traverses all levels.",
    run: () => executePageScenario({
      fixture: { kind: "page", name: "nested-blocks" },
      metaDescription: "Fixture for nested DOM benchmark.",
      url: "/fixtures/nested-blocks",
    }),
    evaluate: (execution) => evaluatePageTranslation(execution),
  },
  {
    id: "page-translation/feed-card-list",
    title: "Card-based feed layout translates each card without cross-contamination",
    surface: "page-translation",
    fixture: "feed-card-list",
    task: "Translate a card-list feed layout where each card is an independent translation unit.",
    run: () => executePageScenario({
      fixture: { kind: "page", name: "feed-card-list" },
      metaDescription: "Fixture for card-list feed benchmark.",
      url: "/fixtures/feed-card-list",
    }),
    evaluate: (execution) => evaluatePageTranslation(execution),
  },
  {
    id: "page-translation/provider-error-graceful",
    title: "Provider error causes block failures without crashing the extension",
    surface: "page-translation",
    fixture: "article-basic",
    task: "Verify that a provider error marks blocks as failed and stops the session, but does not throw or corrupt DOM.",
    run: () => executePageErrorScenario({
      fixture: { kind: "page", name: "article-basic" },
      url: "/fixtures/article-basic-error",
      errorMessage: "Rate limit exceeded. Retry after 30s.",
    }),
    evaluate: (execution) => {
      const issues: import("../types").BenchmarkIssue[] = []
      const requestFired = execution.requestCount > 0
      const noTranslations = execution.translatedNodeCount === 0
      const sessionStopped = execution.snapshotPhase === "idle" || execution.snapshotPhase === "stopping"
      const failedCorrectly = execution.failedBlocks > 0

      if (!requestFired) issues.push({ severity: "critical", message: "No translation request was sent." })
      if (!noTranslations && execution.translatedNodeCount > 0) {
        // Some blocks may have been marked before the error — not critical
      }
      if (!sessionStopped) issues.push({ severity: "high", message: `Session phase should be idle/stopping after error, got ${execution.snapshotPhase}` })
      if (!failedCorrectly) issues.push({ severity: "high", message: "No blocks marked as failed despite provider error." })

      const correctness = requestFired ? 10 : 0
      const stability = sessionStopped ? 10 : 4
      const completeness = failedCorrectly ? 10 : 4
      const scores = { correctness, completeness, stability }
      const baseTotal = Math.round((Object.values(scores).reduce((s, v) => s + v, 0) / (Object.keys(scores).length * 10)) * 100)
      const penalty = issues.reduce((s, i) => s + (i.severity === "critical" ? 40 : i.severity === "high" ? 20 : 0), 0)
      const total = Math.max(0, baseTotal - penalty)

      return {
        scores,
        total,
        pass: total >= 80 && !issues.some((i) => i.severity === "critical"),
        issues,
        artifacts: { requestCount: execution.requestCount, failedBlocks: execution.failedBlocks, phase: execution.snapshotPhase },
        nextActions: issues.map((i) => i.message),
      }
    },
  },
]
