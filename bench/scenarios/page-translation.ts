import { resolveExtractionPlan } from "@/utils/dom/extraction"
import { getPageTranslationState, startPageTranslation, stopPageTranslation } from "@/entrypoints/content/page-translate"
import type { AstraConfig } from "@/types/config"
import type { TranslationErrorCode } from "@/types/translation"
import { stripRichTextPlaceholders } from "@/utils/dom/rich-text-placeholders"

import { evaluatePageTranslation, type PageTranslationExecution } from "../evaluators/page-translation"
import {
  buildExpectedPageTranslationTexts,
  buildPageTranslationExecutionFromDocument,
} from "./helpers/page-translation"
import { installBenchBrowser, type BenchBrowserOptions } from "../runtime/browser"
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
  browserConfig?: Partial<AstraConfig>
  overrides?: {
    targetLang?: string
    translationMode?: "bilingual" | "translation-only"
    contentScope?: "page" | "article"
  }
  translateBatch?: BenchBrowserOptions["translateBatch"]
}) {
  installDomEnvironment(`https://example.com${options.url}`)
  try {
    const browser = installBenchBrowser({
      ...((options.browserConfig || options.privacyMode)
        ? {
            config: {
              ...(options.browserConfig ?? {}),
              ...(options.privacyMode ? { privacyMode: true } : {}),
            },
          }
        : {}),
      ...(options.translateBatch ? { translateBatch: options.translateBatch } : {}),
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
      requestTexts: browser.getTranslateCalls().flatMap((call) => call.payload.texts),
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
  "page-translation/site-rules-advanced-filters": {
    suspectedFiles: [
      "src/entrypoints/content/page-translate.ts",
      "src/types/config.ts",
      "src/utils/storage/config.ts",
    ],
    suspectedSymbols: ["startPageTranslation", "applySiteRuleFilters", "resolveSiteTranslationSettings", "saveConfig"],
    suspectedKeywords: ["selectors", "excludeSelectors", "paragraphMinLength", "site rules"],
    risk: "cross-module",
  },
  "page-translation/site-rules-invalid-selectors-ignored": {
    suspectedFiles: [
      "src/entrypoints/content/page-translate.ts",
      "src/types/config.ts",
      "src/entrypoints/popup/components/SiteSettingsSection.tsx",
    ],
    suspectedSymbols: ["startPageTranslation", "applySiteRuleFilters", "resolveSiteTranslationSettings"],
    suspectedKeywords: ["invalid selector", "selectors", "excludeSelectors", "site rules"],
    risk: "cross-module",
  },
  "page-translation/dense-inline-placeholder-preservation": {
    suspectedFiles: [
      "src/entrypoints/content/page-translate.ts",
      "src/entrypoints/content/page-translate-registry.ts",
      "src/utils/dom/rich-text-placeholders.ts",
      "src/utils/dom/inject.ts",
    ],
    suspectedSymbols: ["startPageTranslation", "registerBlocks", "serializeRichTextForTranslation", "decodeRichTextTranslation"],
    suspectedKeywords: ["placeholder", "rich-text", "dense-inline", "inline formatting"],
    risk: "cross-module",
  },
  "page-translation/dense-inline-placeholder-fallback": {
    suspectedFiles: [
      "src/entrypoints/content/page-translate.ts",
      "src/utils/dom/rich-text-placeholders.ts",
      "src/utils/dom/inject.ts",
    ],
    suspectedSymbols: ["startPageTranslation", "decodeRichTextTranslation", "injectTranslation"],
    suspectedKeywords: ["placeholder", "fallback", "dense-inline", "malformed rich-text"],
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
  {
    id: "page-translation/site-rules-advanced-filters",
    title: "Site advanced rules restrict translation to intended long-form content blocks",
    surface: "page-translation",
    fixture: "comment-heavy",
    task: "Translate only long-form article paragraphs on a comment-heavy page using include selectors, exclude selectors, and paragraph length filters together.",
    codeHint: PAGE_TRANSLATION_HINTS["page-translation/site-rules-advanced-filters"],
    run: () => executePageScenario({
      fixture: { kind: "page", name: "comment-heavy" },
      metaDescription: "Fixture used to verify advanced site translation filters.",
      url: "/fixtures/comment-heavy",
      browserConfig: {
        sites: {
          "example.com": {
            enabled: true,
            alwaysTranslate: false,
            selectors: ["article", ".comments"],
            excludeSelectors: [".comments"],
            paragraphMinLength: 40,
          },
        },
      },
      translateBatch: async (payload) => ({
        type: "runtime/translate-batch:success",
        payload: {
          translations: payload.texts.map((text) => `ZH:${text}`),
        },
      }),
    }),
    evaluate: (execution) => {
      const expectedTexts = [
        "Browser extensions have evolved significantly over the past decade, transitioning from simple toolbar buttons to powerful applications that can transform how users interact with the entire web. Modern extension APIs provide capabilities ranging from content modification and network request interception to cross-tab communication and background processing, enabling developers to build sophisticated tools that deeply integrate with the browsing experience.",
        "The shift toward Manifest V3 represents a fundamental change in how extensions operate. Service workers replace persistent background pages, declarativeNetRequest replaces the webRequest blocking API for many use cases, and new permission models give users more granular control over what extensions can access. These changes aim to improve security, privacy, and performance, though they require developers to rethink architectural patterns they have relied on for years.",
        "Cross-browser compatibility remains a significant challenge for extension developers. While the WebExtensions API provides a common baseline shared by Chrome, Firefox, Edge, and Safari, each browser still has unique quirks, unsupported APIs, and platform-specific limitations that require careful abstraction layers and conditional logic to handle gracefully across all target environments.",
      ]
      const expectedTranslations = expectedTexts.map((text) => `ZH:${text}`)
      const issues: BenchmarkIssue[] = []
      const requestTexts = execution.requestTexts ?? []

      if (execution.requestCount === 0) {
        issues.push({ severity: "critical", message: "Advanced site rules scenario never issued a translation request." })
      }

      if (execution.failedBlocks > 0) {
        issues.push({ severity: "high", message: `Advanced site rules scenario recorded ${execution.failedBlocks} failed blocks.` })
      }

      if (execution.translatedNodeCount !== expectedTexts.length) {
        issues.push({
          severity: "high",
          message: `Expected ${expectedTexts.length} translated blocks after site-rule filtering, got ${execution.translatedNodeCount}.`,
          evidence: JSON.stringify(execution.translatedTexts),
        })
      }

      if (JSON.stringify(requestTexts) !== JSON.stringify(expectedTexts)) {
        issues.push({
          severity: "high",
          message: "Site-rule filtering did not send the expected source blocks to the provider.",
          evidence: JSON.stringify({ expectedTexts, requestTexts }),
        })
      }

      if (JSON.stringify(execution.translatedTexts) !== JSON.stringify(expectedTranslations)) {
        issues.push({
          severity: "high",
          message: "Translated DOM content does not match the expected filtered article paragraphs.",
          evidence: JSON.stringify({ expectedTranslations, translatedTexts: execution.translatedTexts }),
        })
      }

      const leakedText = ["@alice", "Comments", "The Future of Browser Extensions"].filter((text) =>
        requestTexts.some((value) => value.includes(text))
        || execution.translatedTexts.some((value) => value.includes(text)),
      )

      if (leakedText.length > 0) {
        issues.push({
          severity: "high",
          message: "Site advanced rules leaked filtered content into translation requests or DOM output.",
          evidence: JSON.stringify(leakedText),
        })
      }

      const scores = {
        correctness: execution.requestCount > 0 ? 10 : 0,
        completeness: issues.some((issue) => issue.message.includes("expected filtered article paragraphs") || issue.message.includes("Expected 3 translated blocks")) ? 4 : 10,
        filtering: leakedText.length === 0 && JSON.stringify(requestTexts) === JSON.stringify(expectedTexts) ? 10 : 4,
        stability: execution.failedBlocks === 0 ? 10 : 4,
      }
      const baseTotal = Math.round((Object.values(scores).reduce((sum, score) => sum + score, 0) / (Object.keys(scores).length * 10)) * 100)
      const penalty = issues.reduce((sum, issue) => {
        switch (issue.severity) {
          case "critical":
            return sum + 40
          case "high":
            return sum + 20
          case "medium":
            return sum + 10
          case "low":
            return sum + 5
          default:
            return sum
        }
      }, 0)
      const total = Math.max(0, baseTotal - penalty)

      return {
        scores,
        total,
        pass: total >= 80 && !issues.some((issue) => issue.severity === "critical"),
        issues,
        artifacts: {
          requestCount: execution.requestCount,
          requestTexts,
          translatedTexts: execution.translatedTexts,
          patchHints: issues.length > 0
            ? {
                suspectedFiles: PAGE_TRANSLATION_HINTS["page-translation/site-rules-advanced-filters"]?.suspectedFiles ?? [],
                suspectedSymbols: PAGE_TRANSLATION_HINTS["page-translation/site-rules-advanced-filters"]?.suspectedSymbols ?? [],
                suspectedKeywords: PAGE_TRANSLATION_HINTS["page-translation/site-rules-advanced-filters"]?.suspectedKeywords ?? [],
                failingSignals: issues.map((issue) => issue.message),
                confidence: issues.some((issue) => issue.severity === "critical") ? "high" : "medium",
              }
            : undefined,
        },
        nextActions: issues.map((issue) => issue.message),
      }
    },
  },
  {
    id: "page-translation/site-rules-invalid-selectors-ignored",
    title: "Invalid site selectors are ignored instead of suppressing all page translation",
    surface: "page-translation",
    fixture: "article-basic",
    task: "Translate a normal article even when stored site rules contain invalid CSS selectors, without silently dropping all translation blocks.",
    codeHint: PAGE_TRANSLATION_HINTS["page-translation/site-rules-invalid-selectors-ignored"],
    run: () => executePageScenario({
      fixture: { kind: "page", name: "article-basic" },
      metaDescription: "Fixture used to verify invalid site selector fallback.",
      url: "/fixtures/article-basic-invalid-selectors",
      browserConfig: {
        sites: {
          "example.com": {
            enabled: true,
            alwaysTranslate: false,
            selectors: ["article[", "::not-a-real-pseudo("],
            excludeSelectors: [".sidebar["],
          },
        },
      },
      translateBatch: async (payload) => ({
        type: "runtime/translate-batch:success",
        payload: {
          translations: payload.texts.map((text) => `ZH:${text}`),
        },
      }),
    }),
    evaluate: (execution) => evaluatePageTranslation(execution),
  },
  {
    id: "page-translation/dense-inline-placeholder-preservation",
    title: "Page translation preserves inline formatting via safe Astra placeholders",
    surface: "page-translation",
    fixture: "dense-inline",
    task: "Translate dense inline-rich paragraphs without leaking placeholder tokens or flattening all formatting.",
    codeHint: PAGE_TRANSLATION_HINTS["page-translation/dense-inline-placeholder-preservation"],
    run: () => executePageScenario({
      fixture: { kind: "page", name: "dense-inline" },
      metaDescription: "Fixture used to verify inline formatting placeholder preservation.",
      url: "/fixtures/dense-inline",
      translateBatch: async (payload) => ({
        type: "runtime/translate-batch:success",
        payload: {
          translations: payload.texts.map((text) => `ZH:${text}`),
        },
      }),
    }),
    evaluate: (execution) => evaluatePageTranslation(execution, {
      requireRichTextPlaceholderPreservation: true,
    }),
  },
  {
    id: "page-translation/dense-inline-placeholder-fallback",
    title: "Malformed rich-text placeholders fall back to plain text without leaking tokens",
    surface: "page-translation",
    fixture: "dense-inline",
    task: "Translate dense inline-rich paragraphs even when the provider returns malformed Astra placeholder tokens, and degrade safely to plain text.",
    codeHint: PAGE_TRANSLATION_HINTS["page-translation/dense-inline-placeholder-fallback"],
    run: () => executePageScenario({
      fixture: { kind: "page", name: "dense-inline" },
      metaDescription: "Fixture used to verify malformed placeholder fallback.",
      url: "/fixtures/dense-inline-fallback",
      translateBatch: async (payload) => ({
        type: "runtime/translate-batch:success",
        payload: {
          translations: payload.texts.map((text) => {
            if (!text.includes("__ASTRA_RT_")) {
              return `ZH:${text}`
            }

            return `ZH:${text.replace(/__ASTRA_RT_\d+_CLOSE__/g, "")}`
          }),
        },
      }),
    }),
    evaluate: (execution) => {
      const base = evaluatePageTranslation(execution)
      const issues: BenchmarkIssue[] = [...base.issues]

      if ((execution.requestPlaceholderCount ?? 0) === 0) {
        issues.push({
          severity: "high",
          message: "Malformed placeholder fallback scenario never exercised Astra rich-text placeholders.",
          evidence: JSON.stringify(execution.requestTexts ?? []),
        })
      }

      if ((execution.placeholderLeakCount ?? 0) > 0) {
        issues.push({
          severity: "high",
          message: "Malformed placeholder fallback leaked Astra placeholder tokens into rendered DOM.",
          evidence: `placeholderLeakCount=${execution.placeholderLeakCount}`,
        })
      }

      if ((execution.restoredRichTextTagCount ?? 0) > 0) {
        issues.push({
          severity: "high",
          message: "Malformed placeholder fallback should degrade to plain text instead of restoring inline rich-text tags.",
          evidence: JSON.stringify(execution.translatedHtmlSnippets ?? []),
        })
      }

      const expectedFallbackTexts = (execution.requestTexts ?? []).map((text) => `ZH:${stripRichTextPlaceholders(text)}`)
      const fallbackMismatches = execution.translatedTexts.flatMap((text, index) => {
        const expectedText = expectedFallbackTexts[index]
        return text === expectedText
          ? []
          : [`expected=${JSON.stringify(expectedText)} actual=${JSON.stringify(text)}`]
      })

      if (fallbackMismatches.length > 0 || execution.translatedTexts.length !== expectedFallbackTexts.length) {
        issues.push({
          severity: "high",
          message: "Malformed placeholder fallback did not preserve the expected translated plain-text content.",
          evidence: JSON.stringify({
            expectedFallbackTexts,
            translatedTexts: execution.translatedTexts,
            fallbackMismatches,
          }),
        })
      }

      const fallbackSafe = (execution.requestPlaceholderCount ?? 0) > 0
        && (execution.placeholderLeakCount ?? 0) === 0
        && (execution.restoredRichTextTagCount ?? 0) === 0

      const scores = {
        ...base.scores,
        rich_text_fallback: fallbackSafe ? 10 : 4,
      }

      const baseTotal = Math.round((Object.values(scores).reduce((sum, score) => sum + score, 0) / (Object.keys(scores).length * 10)) * 100)
      const penalty = issues.reduce((sum, issue) => {
        switch (issue.severity) {
          case "critical":
            return sum + 40
          case "high":
            return sum + 20
          case "medium":
            return sum + 10
          case "low":
            return sum + 5
          default:
            return sum
        }
      }, 0)
      const total = Math.max(0, baseTotal - penalty)
      const pass = total >= 80 && !issues.some((issue) => issue.severity === "critical")
      const existingPatchHints = base.artifacts.patchHints

      return {
        scores,
        total,
        pass,
        issues,
        artifacts: {
          ...base.artifacts,
          requestPlaceholderCount: execution.requestPlaceholderCount ?? 0,
          placeholderLeakCount: execution.placeholderLeakCount ?? 0,
          restoredRichTextTagCount: execution.restoredRichTextTagCount ?? 0,
          translatedHtmlSnippets: execution.translatedHtmlSnippets ?? [],
          patchHints: issues.length === 0
            ? undefined
            : {
                suspectedFiles: [...new Set([
                  ...(existingPatchHints?.suspectedFiles ?? []),
                  ...(PAGE_TRANSLATION_HINTS["page-translation/dense-inline-placeholder-fallback"]?.suspectedFiles ?? []),
                ])],
                suspectedSymbols: [...new Set([
                  ...(existingPatchHints?.suspectedSymbols ?? []),
                  ...(PAGE_TRANSLATION_HINTS["page-translation/dense-inline-placeholder-fallback"]?.suspectedSymbols ?? []),
                ])],
                suspectedKeywords: [...new Set([
                  ...(existingPatchHints?.suspectedKeywords ?? []),
                  ...(PAGE_TRANSLATION_HINTS["page-translation/dense-inline-placeholder-fallback"]?.suspectedKeywords ?? []),
                ])],
                failingSignals: [...new Set([
                  ...(existingPatchHints?.failingSignals ?? []),
                  ...issues.map((issue) => issue.message),
                ])],
                confidence: issues.some((issue) => issue.severity === "critical") ? "high" : "medium",
              },
        },
        nextActions: issues.map((issue) => issue.message),
      }
    },
  },
]
