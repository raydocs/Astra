import { resolveExtractionPlan } from "@/utils/dom/extraction"
import { getPageTranslationState, startPageTranslation, stopPageTranslation } from "@/entrypoints/content/page-translate"
import type { TranslationErrorCode } from "@/types/translation"

import { evaluatePageTranslation, type PageTranslationExecution } from "../evaluators/page-translation"
import {
  buildExpectedPageTranslationTexts,
  buildPageTranslationExecutionFromDocument,
} from "./helpers/page-translation"
import { installBenchBrowser } from "../runtime/browser"
import { installDomEnvironment, flushMicrotasks, cleanupDomEnvironment } from "../runtime/dom"
import { mountFixture, type FixtureSource } from "../runtime/fixtures"
import type { BenchmarkIssue, BenchmarkScenario, ScenarioCodeHint } from "../types"

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
  privacyMode?: boolean
  overrides?: {
    targetLang?: string
    translationMode?: "bilingual" | "translation-only"
    contentScope?: "page" | "article"
  }
}) {
  installDomEnvironment(`https://example.com${options.url}`)
  try {
    const browser = installBenchBrowser({
      ...(options.privacyMode ? { config: { privacyMode: true } } : {}),
    })
    mountFixture(options.fixture, {
      title: "Astra Bench Page",
      metaDescription: options.metaDescription,
      url: options.url,
    })

    const expected = buildExpectedPageTranslationTexts(document, options.overrides?.contentScope ?? "page")

    const snapshot = await startPageTranslation({
      targetLang: options.overrides?.targetLang ?? "zh-CN",
      ...(options.overrides?.translationMode ? { translationMode: options.overrides.translationMode } : {}),
      ...(options.overrides?.contentScope ? { contentScope: options.overrides.contentScope } : {}),
      ...(options.privacyMode ? { privacyMode: true } : {}),
    })
    await flushMicrotasks(6)
    await waitForTranslationMarkers()

    const execution = buildPageTranslationExecutionFromDocument({
      doc: document,
      expectedTexts: expected.expectedTexts,
      requestCount: browser.getTranslateCalls().length,
      snapshotPhase: snapshot.phase,
      failedBlocks: snapshot.progress.failedBlocks,
      payloadContext: (browser.getTranslateCalls()[0]?.payload.context ?? null) as Record<string, unknown> | null,
      notes: [
        `effectiveScope=${expected.effectiveScope}`,
      ],
    })

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

    const expected = buildExpectedPageTranslationTexts(document, "page")

    await startPageTranslation({ targetLang: "zh-CN" })
    // Wait long enough for the drain loop to fire, hit the error, and call stopSession
    await flushMicrotasks(12)
    await new Promise((resolve) => setTimeout(resolve, 200))
    await flushMicrotasks(6)

    // Read the final state after error propagation
    const finalSnapshot = getPageTranslationState()

    const execution = buildPageTranslationExecutionFromDocument({
      doc: document,
      expectedTexts: expected.expectedTexts,
      requestCount: browser.getTranslateCalls().length,
      snapshotPhase: finalSnapshot?.phase ?? "idle",
      failedBlocks: finalSnapshot?.progress.failedBlocks ?? 0,
      notes: ["provider-error-scenario"],
    })

    stopPageTranslation()
    return execution
  } finally {
    cleanupDomEnvironment()
  }
}

const PAGE_TRANSLATION_HINTS: Record<string, ScenarioCodeHint> = {
  "page-translation/article-basic-bilingual": {
    suspectedFiles: [
      "src/entrypoints/content/page-translate.ts",
      "src/entrypoints/content/translation-context.ts",
      "src/utils/dom/extraction.ts",
    ],
    suspectedSymbols: ["startPageTranslation", "resolveExtractionPlan"],
    suspectedKeywords: ["expectedNodeCount", "bilingual", "coverage"],
    risk: "cross-module",
  },
  "page-translation/forms-and-nav-skip": {
    suspectedFiles: [
      "src/entrypoints/content/page-translate.ts",
      "src/utils/dom/traversal.ts",
      "src/utils/dom/extraction.ts",
    ],
    suspectedSymbols: ["startPageTranslation", "resolveExtractionPlan"],
    suspectedKeywords: ["interactive", "forms", "nav", "skip"],
    risk: "cross-module",
  },
  "page-translation/article-translation-only": {
    suspectedFiles: [
      "src/entrypoints/content/page-translate.ts",
      "src/entrypoints/content/translation-context.ts",
    ],
    suspectedSymbols: ["startPageTranslation"],
    suspectedKeywords: ["translation-only", "hiddenSourceCount"],
    risk: "local",
  },
  "page-translation/nested-blocks-coverage": {
    suspectedFiles: [
      "src/entrypoints/content/page-translate.ts",
      "src/utils/dom/extraction.ts",
      "src/utils/dom/traversal.ts",
    ],
    suspectedSymbols: ["resolveExtractionPlan"],
    suspectedKeywords: ["nested", "coverage"],
    risk: "cross-module",
  },
  "page-translation/feed-card-list": {
    suspectedFiles: [
      "src/entrypoints/content/page-translate.ts",
      "src/entrypoints/content/page-translate-registry.ts",
      "src/utils/dom/extraction.ts",
    ],
    suspectedSymbols: ["startPageTranslation", "resolveExtractionPlan"],
    suspectedKeywords: ["feed", "card", "registry"],
    risk: "cross-module",
  },
  "page-translation/provider-error-graceful": {
    suspectedFiles: [
      "src/entrypoints/content/page-translate.ts",
      "src/entrypoints/content/translation-context.ts",
      "src/entrypoints/content/page-translate-registry.ts",
    ],
    suspectedSymbols: ["startPageTranslation", "stopPageTranslation", "getPageTranslationState"],
    suspectedKeywords: ["provider error", "failedBlocks", "graceful"],
    risk: "cross-module",
  },
  "page-translation/privacy-sanitized-context": {
    suspectedFiles: [
      "src/entrypoints/content/page-translate.ts",
      "src/entrypoints/content/translation-context.ts",
      "src/utils/privacy.ts",
    ],
    suspectedSymbols: ["startPageTranslation", "buildPageContext", "sanitizeTranslationContext"],
    suspectedKeywords: ["privacy", "hostname", "pageUrl"],
    risk: "cross-module",
  },
}

export const pageTranslationScenarios: BenchmarkScenario<PageTranslationExecution>[] = [
  {
    id: "page-translation/article-basic-bilingual",
    title: "Article fixture translates all visible content blocks in bilingual mode",
    surface: "page-translation",
    fixture: "article-basic",
    task: "Translate a straightforward article fixture without losing the original DOM structure.",
    codeHint: PAGE_TRANSLATION_HINTS["page-translation/article-basic-bilingual"],
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
    codeHint: PAGE_TRANSLATION_HINTS["page-translation/forms-and-nav-skip"],
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
    codeHint: PAGE_TRANSLATION_HINTS["page-translation/article-translation-only"],
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
    codeHint: PAGE_TRANSLATION_HINTS["page-translation/nested-blocks-coverage"],
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
    codeHint: PAGE_TRANSLATION_HINTS["page-translation/feed-card-list"],
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
    codeHint: PAGE_TRANSLATION_HINTS["page-translation/provider-error-graceful"],
    run: () => executePageErrorScenario({
      fixture: { kind: "page", name: "article-basic" },
      url: "/fixtures/article-basic-error",
      errorMessage: "Rate limit exceeded. Retry after 30s.",
    }),
    evaluate: (execution) => {
      const issues: BenchmarkIssue[] = []
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
        artifacts: {
          requestCount: execution.requestCount,
          failedBlocks: execution.failedBlocks,
          phase: execution.snapshotPhase,
          patchHints: issues.length > 0
            ? {
                suspectedFiles: PAGE_TRANSLATION_HINTS["page-translation/provider-error-graceful"]?.suspectedFiles ?? [],
                suspectedSymbols: PAGE_TRANSLATION_HINTS["page-translation/provider-error-graceful"]?.suspectedSymbols ?? [],
                suspectedKeywords: [
                  ...(PAGE_TRANSLATION_HINTS["page-translation/provider-error-graceful"]?.suspectedKeywords ?? []),
                  "phase",
                ],
                failingSignals: issues.map((i) => i.message),
                confidence: issues.some((i) => i.severity === "critical") ? "high" : "medium",
              }
            : undefined,
        },
        nextActions: issues.map((i) => i.message),
      }
    },
  },
  {
    id: "page-translation/privacy-sanitized-context",
    title: "Privacy mode strips page translation context down to hostname and canonical page URL",
    surface: "page-translation",
    fixture: "article-basic",
    task: "Translate an article in privacy mode without leaking query strings, hashes, page title, or content summary in the request context.",
    codeHint: PAGE_TRANSLATION_HINTS["page-translation/privacy-sanitized-context"],
    run: () => executePageScenario({
      fixture: { kind: "page", name: "article-basic" },
      metaDescription: "Fixture for privacy mode page translation benchmark.",
      url: "/fixtures/article-basic?token=secret#frag",
      privacyMode: true,
    }),
    evaluate: (execution) => evaluatePageTranslation(execution, { requirePrivacySanitization: true }),
  },
]
