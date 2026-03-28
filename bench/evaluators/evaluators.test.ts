import { describe, expect, it } from "vitest"

import { evaluateArticleExtraction } from "./article-extraction"
import { evaluateDynamicContent } from "./dynamic-content"
import { evaluateHover } from "./hover"
import { evaluateFrameCoordination } from "./frame-coordination"
import { evaluateInputTranslation } from "./input-translation"
import { evaluateInteractionPriority } from "./interaction-priority"
import { evaluatePageTranslation } from "./page-translation"
import { evaluateSelectionExplain } from "./selection-explain"
import { evaluateSiteAutomation } from "./site-automation"
import { evaluateSubtitle } from "./subtitle"
import { articleExtractionScenarios } from "../scenarios/article-extraction"
import { dynamicContentScenarios } from "../scenarios/dynamic-content"
import { frameCoordinationScenarios } from "../scenarios/frame-coordination"
import { hoverScenarios } from "../scenarios/hover"
import { inputTranslationScenarios } from "../scenarios/input-translation"
import { interactionPriorityScenarios } from "../scenarios/interaction-priority"
import { pageTranslationScenarios } from "../scenarios/page-translation"
import { selectionExplainScenarios } from "../scenarios/selection-explain"
import { siteAutomationScenarios } from "../scenarios/site-automation"
import { subtitleScenarios } from "../scenarios/subtitle"

describe("benchmark evaluators", () => {
  it("flags page translation failures when interactive nodes are translated", () => {
    const result = evaluatePageTranslation({
      translatedNodeCount: 2,
      expectedNodeCount: 2,
      translationMarkerCount: 2,
      hiddenSourceCount: 0,
      requestCount: 1,
      skippedInteractiveTranslations: 1,
      translatedTexts: ["ZH:hello", "ZH:world"],
      expectedTexts: ["hello", "world"],
      snapshotPhase: "running",
      failedBlocks: 0,
    })

    expect(result.pass).toBe(false)
    expect(result.issues.some((issue) => issue.severity === "critical")).toBe(true)
  })

  it("flags article extraction failures when excluded text leaks", () => {
    const result = evaluateArticleExtraction({
      scope: "article",
      rootId: "blog-article",
      blockCount: 4,
      blockTexts: ["Main body", "@maya comment"],
      leakedTexts: ["@maya"],
    }, {
      scope: "article",
      rootId: "blog-article",
      shouldExcludeTexts: ["@maya"],
    })

    expect(result.pass).toBe(false)
    expect(result.issues.some((issue) => issue.message.includes("leaked"))).toBe(true)
  })

  it("flags hover failures when an unexpected request is sent", () => {
    const result = evaluateHover({
      requestCount: 1,
      overlayVisible: true,
      overlayText: "ZH:hello",
      overlayError: "",
      triggerLabel: "Alt + Hover",
      translationLatencyMs: 320,
      selectionSuppressed: false,
      payloadSelectionContext: "Hello world",
      payloadTask: "translate",
    }, {
      shouldRequest: false,
      shouldShowOverlay: false,
    })

    expect(result.pass).toBe(false)
    expect(result.issues.some((issue) => issue.message.includes("request count"))).toBe(true)
  })

  it("flags hover failures when a suppression scenario does not actually suppress via selection", () => {
    const result = evaluateHover({
      requestCount: 0,
      overlayVisible: false,
      overlayText: "",
      overlayError: "",
      triggerLabel: "",
      translationLatencyMs: 0,
      selectionSuppressed: false,
      payloadSelectionContext: null,
      payloadTask: null,
    }, {
      shouldRequest: false,
      shouldShowOverlay: false,
      requireSelectionSuppression: true,
    })

    expect(result.pass).toBe(false)
    expect(result.issues.some((issue) => issue.message.includes("active selection blocked"))).toBe(true)
  })

  it("flags selection explain failures when copy is required but missing", () => {
    const result = evaluateSelectionExplain({
      requestCount: 1,
      requestTask: "explain",
      requestSelectionContext: "Hello world",
      resultText: "EXPLAIN:Hello world",
      clipboardWrites: [],
      buttonLabels: ["翻译", "解释", "复制"],
    }, {
      expectedTask: "explain",
      requireContext: true,
      shouldCopy: true,
    })

    expect(result.pass).toBe(false)
    expect(result.issues.some((issue) => issue.message.includes("Copy action"))).toBe(true)
  })

  it("flags input translation failures when writeback is missing", () => {
    const result = evaluateInputTranslation({
      requestCount: 1,
      requestTask: "translate",
      translatedValue: "Hello",
      initialValue: "Hello",
      overlayVisibleAfterFocus: true,
      overlayVisibleAfterTyping: true,
      buttonLabel: "译",
      writebackInputEventCount: 0,
      translationLatencyMs: 120,
      payloadHostname: "example.com",
      payloadPageUrl: "https://example.com/fixtures/input",
      inputType: "text",
      editableKind: "input",
      selectionStartBefore: null,
      selectionEndBefore: null,
      selectionStartAfter: null,
      selectionEndAfter: null,
    }, {
      shouldRequest: true,
      shouldShowAfterFocus: true,
      shouldWriteBack: true,
      expectedTask: "translate",
      requireContext: true,
    })

    expect(result.pass).toBe(false)
    expect(result.issues.some((issue) => issue.message.includes("write the translated text back"))).toBe(true)
  })

  it("treats clamped cursor restoration as preserved after writeback", () => {
    const result = evaluateInputTranslation({
      requestCount: 1,
      requestTask: "translate",
      translatedValue: "你好",
      initialValue: "Some text",
      overlayVisibleAfterFocus: true,
      overlayVisibleAfterTyping: true,
      buttonLabel: "译",
      writebackInputEventCount: 1,
      translationLatencyMs: 110,
      payloadHostname: "example.com",
      payloadPageUrl: "https://example.com/fixtures/input",
      inputType: "textarea",
      editableKind: "textarea",
      selectionStartBefore: 5,
      selectionEndBefore: 9,
      selectionStartAfter: 2,
      selectionEndAfter: 2,
    }, {
      shouldRequest: true,
      shouldShowAfterFocus: true,
      shouldWriteBack: true,
      shouldPreserveCursor: true,
      expectedTask: "translate",
      requireContext: true,
    })

    expect(result.pass).toBe(true)
    expect(result.scores.cursor_preservation).toBe(10)
  })

  it("flags subtitle failures when privacy mode leaks page metadata", () => {
    const result = evaluateSubtitle({
      requestCount: 1,
      translatedCueCount: 1,
      translatedCueTexts: ["ZH:hello"],
      astraTrackCount: 1,
      astraTrackLabels: ["Astra: zh-CN"],
      sourceModeBefore: "showing",
      sourceModeAfter: "showing",
      payloadContext: {
        hostname: "example.com",
        pageUrl: "https://example.com/watch?token=secret",
        pageTitle: "Sensitive title",
      },
      removedTrackCount: 0,
      requestBatchSizes: [1],
    }, {
      shouldTranslate: true,
      expectedCueCount: 1,
      requirePrivacySanitization: true,
    })

    expect(result.pass).toBe(false)
    expect(result.issues.some((issue) => issue.message.includes("privacy"))).toBe(true)
  })

  it("flags site automation failures when manual stop suppression does not hold", () => {
    const result = evaluateSiteAutomation({
      autoStarted: true,
      stoppedAfterDisable: false,
      suppressedAfterManualStop: false,
      resumedAfterReenable: false,
      requestCountBeforeTransition: 1,
      requestCountAfterTransition: 2,
      phaseBeforeTransition: "running",
      phaseAfterTransition: "running",
      translationMarkersBeforeTransition: 3,
      translationMarkersAfterTransition: 3,
      uiHostsPresent: [
        "astra-selection-toolbar-host",
        "astra-hover-translate-host",
        "astra-input-translate-host",
        "astra-float-ball-host",
      ],
    }, {
      shouldAutoStart: true,
      shouldSuppressAfterManualStop: true,
      requireUiHosts: [
        "astra-selection-toolbar-host",
        "astra-hover-translate-host",
      ],
    })

    expect(result.pass).toBe(false)
    expect(result.issues.some((issue) => issue.message.includes("Manual stop"))).toBe(true)
  })

  it("exposes code hints for page translation, site automation, and dynamic content", () => {
    expect(pageTranslationScenarios[0].codeHint?.suspectedFiles).toContain(
      "src/entrypoints/content/page-translate.ts",
    )
    expect(siteAutomationScenarios[0].codeHint?.suspectedFiles).toContain(
      "src/entrypoints/content/index.tsx",
    )
    expect(dynamicContentScenarios[0].codeHint?.suspectedFiles).toContain(
      "src/entrypoints/content/page-translate.ts",
    )
  })

  it("exposes code hints for remaining surfaces", () => {
    expect(articleExtractionScenarios[0].codeHint?.suspectedFiles).toContain(
      "src/utils/dom/extraction.ts",
    )
    expect(hoverScenarios[0].codeHint?.suspectedFiles).toContain(
      "src/entrypoints/content/components/HoverTranslate.tsx",
    )
    expect(selectionExplainScenarios[0].codeHint?.suspectedFiles).toContain(
      "src/entrypoints/content/components/SelectionToolbar.tsx",
    )
    expect(inputTranslationScenarios[0].codeHint?.suspectedFiles).toContain(
      "src/entrypoints/content/components/InputTranslate.tsx",
    )
    expect(subtitleScenarios[0].codeHint?.suspectedFiles).toContain(
      "src/entrypoints/content/subtitle-translate.ts",
    )
  })

  it("flags article extraction failures with repair hints", () => {
    const result = evaluateArticleExtraction({
      scope: "article",
      rootId: "sidebar-root",
      blockCount: 0,
      blockTexts: [],
      leakedTexts: ["@maya"],
    }, {
      scope: "article",
      rootId: "docs-article",
      shouldExcludeTexts: ["@maya"],
    })

    expect(result.pass).toBe(false)
    expect(result.artifacts.patchHints).toMatchObject({
      confidence: "high",
      suspectedFiles: expect.arrayContaining([
        "src/utils/dom/extraction.ts",
        "src/utils/dom/traversal.ts",
      ]),
    })
  })

  it("flags hover failures with repair hints", () => {
    const result = evaluateHover({
      requestCount: 1,
      overlayVisible: true,
      overlayText: "ZH:hello",
      overlayError: "",
      triggerLabel: "Alt + Hover",
      translationLatencyMs: 500,
      selectionSuppressed: false,
      payloadSelectionContext: "Hello world",
      payloadTask: "translate",
    }, {
      shouldRequest: false,
      shouldShowOverlay: false,
      requireSelectionSuppression: true,
    })

    expect(result.pass).toBe(false)
    expect(result.artifacts.patchHints).toMatchObject({
      confidence: "high",
      suspectedFiles: expect.arrayContaining([
        "src/entrypoints/content/components/HoverTranslate.tsx",
        "src/entrypoints/content/interaction-coordination.ts",
      ]),
    })
  })

  it("flags selection explain failures with repair hints", () => {
    const result = evaluateSelectionExplain({
      requestCount: 0,
      requestTask: null,
      requestSelectionContext: null,
      resultText: "",
      clipboardWrites: [],
      buttonLabels: ["翻译", "解释"],
    }, {
      shouldCopy: true,
      expectedTask: "explain",
      requireContext: true,
    })

    expect(result.pass).toBe(false)
    expect(result.artifacts.patchHints).toMatchObject({
      confidence: "high",
      suspectedFiles: expect.arrayContaining([
        "src/entrypoints/content/components/SelectionToolbar.tsx",
        "src/entrypoints/content/inline-actions.ts",
      ]),
    })
  })

  it("flags input translation failures with repair hints", () => {
    const result = evaluateInputTranslation({
      requestCount: 0,
      requestTask: null,
      translatedValue: "Hello",
      initialValue: "Hello",
      overlayVisibleAfterFocus: false,
      overlayVisibleAfterTyping: false,
      buttonLabel: "译",
      writebackInputEventCount: 0,
      translationLatencyMs: 0,
      payloadHostname: null,
      payloadPageUrl: null,
      inputType: "text",
      editableKind: "input",
      selectionStartBefore: null,
      selectionEndBefore: null,
      selectionStartAfter: null,
      selectionEndAfter: null,
    }, {
      shouldRequest: true,
      shouldShowAfterFocus: true,
      shouldWriteBack: true,
      expectedTask: "translate",
      requireContext: true,
    })

    expect(result.pass).toBe(false)
    expect(result.artifacts.patchHints).toMatchObject({
      confidence: "high",
      suspectedFiles: expect.arrayContaining([
        "src/entrypoints/content/components/InputTranslate.tsx",
        "src/entrypoints/content/inline-actions.ts",
      ]),
    })
  })

  it("flags subtitle failures with repair hints", () => {
    const result = evaluateSubtitle({
      requestCount: 0,
      translatedCueCount: 0,
      translatedCueTexts: [],
      astraTrackCount: 0,
      astraTrackLabels: [],
      sourceModeBefore: "showing",
      sourceModeAfter: "showing",
      payloadContext: {
        hostname: "example.com",
        pageUrl: "https://example.com/watch?token=secret",
        pageTitle: "Sensitive title",
      },
      removedTrackCount: 0,
      requestBatchSizes: [],
    }, {
      shouldTranslate: true,
      expectedCueCount: 1,
      expectSourceModeRestored: true,
      requirePrivacySanitization: true,
    })

    expect(result.pass).toBe(false)
    expect(result.artifacts.patchHints).toMatchObject({
      confidence: "high",
      suspectedFiles: expect.arrayContaining([
        "src/entrypoints/content/subtitle-translate.ts",
        "src/utils/privacy.ts",
      ]),
    })
  })

  it("flags page translation failures with repair hints", () => {
    const result = evaluatePageTranslation({
      translatedNodeCount: 1,
      expectedNodeCount: 2,
      translationMarkerCount: 1,
      hiddenSourceCount: 0,
      requestCount: 0,
      skippedInteractiveTranslations: 1,
      translatedTexts: ["ZH:hello"],
      expectedTexts: ["hello", "world"],
      snapshotPhase: "idle",
      failedBlocks: 1,
    }, {
      requireTranslationOnly: true,
    })

    expect(result.pass).toBe(false)
    expect(result.artifacts.patchHints).toMatchObject({
      confidence: "high",
      suspectedFiles: expect.arrayContaining([
        "src/entrypoints/content/page-translate.ts",
        "src/entrypoints/content/translation-context.ts",
      ]),
      suspectedKeywords: expect.arrayContaining(["translation-only", "failedBlocks"]),
    })
  })

  it("flags site automation failures with repair hints", () => {
    const result = evaluateSiteAutomation({
      autoStarted: false,
      stoppedAfterDisable: false,
      suppressedAfterManualStop: false,
      resumedAfterReenable: false,
      requestCountBeforeTransition: 0,
      requestCountAfterTransition: 0,
      phaseBeforeTransition: "idle",
      phaseAfterTransition: "idle",
      translationMarkersBeforeTransition: 0,
      translationMarkersAfterTransition: 0,
      uiHostsPresent: [],
    }, {
      shouldAutoStart: true,
      shouldSuppressAfterManualStop: true,
      requireUiHosts: ["astra-selection-toolbar-host"],
    })

    expect(result.pass).toBe(false)
    expect(result.artifacts.patchHints).toMatchObject({
      confidence: "high",
      suspectedFiles: expect.arrayContaining([
        "src/entrypoints/content/index.tsx",
        "src/utils/storage/config.ts",
      ]),
      suspectedKeywords: expect.arrayContaining(["alwaysTranslate", "suppression"]),
    })
  })

  it("flags dynamic content failures with repair hints", () => {
    const result = evaluateDynamicContent({
      requestCountBeforeMutation: 1,
      requestCountAfterMutation: 3,
      latestRequestedSourceText: "Third story arrives from a live feed update.",
      translatedNodeCountBeforeMutation: 2,
      translatedNodeCountAfterMutation: 4,
      translatedTextsAfterMutation: ["ZH:First", "ZH:Second", "ZH:Third"],
      updatedTextRequested: false,
      oldTextCleared: false,
      progressTotalBlocksBeforeMutation: 2,
      progressTotalBlocksAfterMutation: 5,
      removedElementStillTracked: true,
      notes: ["dynamic test"],
    }, {
      expectedNewRequests: 1,
      expectedTranslatedNodeDelta: 1,
      requireUpdatedText: true,
      requireOldTextCleared: true,
      expectedProgressTotalAfterMutation: 3,
      shouldCleanupRemovedBlocks: true,
    })

    expect(result.pass).toBe(false)
    expect(result.artifacts.patchHints).toMatchObject({
      confidence: "high",
      suspectedFiles: expect.arrayContaining([
        "src/entrypoints/content/page-translate.ts",
        "src/entrypoints/content/page-translate-registry.ts",
      ]),
      suspectedKeywords: expect.arrayContaining(["requestCountAfterMutation", "removedElementStillTracked"]),
    })
  })

  it("flags interaction-priority failures when hover remains active during a blocking selection", () => {
    const result = evaluateInteractionPriority({
      hoverSuppressed: false,
      hoverRequestCount: 1,
      toggleCommandCount: 0,
      selectionToolbarVisible: true,
      hoverOverlayVisible: true,
      inputOverlayVisible: false,
      floatBallMounted: true,
      visibleHosts: [
        "astra-selection-toolbar-host",
        "astra-hover-translate-host",
        "astra-float-ball-host",
      ],
      mountedHosts: [
        "astra-selection-toolbar-host",
        "astra-hover-translate-host",
        "astra-input-translate-host",
        "astra-float-ball-host",
      ],
    }, {
      shouldSuppressHover: true,
      shouldRequestHover: false,
      requiredVisibleHosts: [
        "astra-selection-toolbar-host",
        "astra-float-ball-host",
      ],
      forbiddenVisibleHosts: ["astra-hover-translate-host"],
      requireFloatBallMounted: true,
    })

    expect(result.pass).toBe(false)
    expect(result.issues.some((issue) => issue.message.includes("suppress hover"))).toBe(true)
    expect(result.artifacts.patchHints).toMatchObject({
      confidence: "high",
      suspectedFiles: expect.arrayContaining([
        "src/entrypoints/content/interaction-coordination.ts",
      ]),
    })
  })

  it("flags frame-coordination failures when child-frame chrome leaks top-frame UI", () => {
    const result = evaluateFrameCoordination({
      floatBallMounted: true,
      siteUiMounted: true,
      inputUiMounted: true,
      autoStarted: true,
      translationMarkerCount: 3,
      framesTotal: null,
      framesTranslating: null,
      aggregatePhase: null,
      aggregateTargetLang: null,
      aggregateHostname: null,
      progressTotalBlocks: null,
      sendMessageFrameIds: [],
    }, {
      shouldMountFloatBall: false,
      shouldMountSiteUi: true,
      shouldMountInputUi: true,
      shouldAutoStart: true,
    })

    expect(result.pass).toBe(false)
    expect(result.issues.some((issue) => issue.message.includes("chrome leaked"))).toBe(true)
    expect(result.artifacts.patchHints).toMatchObject({
      confidence: "high",
      suspectedFiles: expect.arrayContaining([
        "src/entrypoints/background/frame-coordinator.ts",
      ]),
    })
  })

  it("flags page-translation failures with repair hints when provider errors surface", () => {
    const result = evaluatePageTranslation({
      translatedNodeCount: 0,
      expectedNodeCount: 2,
      translationMarkerCount: 0,
      hiddenSourceCount: 0,
      requestCount: 1,
      skippedInteractiveTranslations: 0,
      translatedTexts: [],
      expectedTexts: ["hello", "world"],
      snapshotPhase: "idle",
      failedBlocks: 1,
    })

    expect(result.pass).toBe(false)
    expect(result.artifacts.patchHints).toMatchObject({
      confidence: "high",
      suspectedFiles: expect.arrayContaining([
        "src/entrypoints/content/page-translate.ts",
      ]),
    })
  })

  it("flags site automation failures with repair hints when suppression breaks", () => {
    const result = evaluateSiteAutomation({
      autoStarted: true,
      stoppedAfterDisable: false,
      suppressedAfterManualStop: false,
      resumedAfterReenable: false,
      requestCountBeforeTransition: 1,
      requestCountAfterTransition: 2,
      phaseBeforeTransition: "running",
      phaseAfterTransition: "running",
      translationMarkersBeforeTransition: 3,
      translationMarkersAfterTransition: 3,
      uiHostsPresent: ["astra-selection-toolbar-host"],
    }, {
      shouldSuppressAfterManualStop: true,
      requireUiHosts: [
        "astra-selection-toolbar-host",
        "astra-hover-translate-host",
      ],
    })

    expect(result.pass).toBe(false)
    expect(result.artifacts.patchHints).toMatchObject({
      confidence: "medium",
      suspectedFiles: expect.arrayContaining([
        "src/entrypoints/content/index.tsx",
      ]),
    })
  })

  it("flags dynamic-content failures when a feed mutation double-fires translation requests", () => {
    const result = evaluateDynamicContent({
      requestCountBeforeMutation: 1,
      requestCountAfterMutation: 3,
      latestRequestedSourceText: "Third story arrives from a live feed update.",
      translatedNodeCountBeforeMutation: 2,
      translatedNodeCountAfterMutation: 3,
      translatedTextsAfterMutation: ["ZH:First", "ZH:Second", "ZH:Third"],
      updatedTextRequested: true,
      oldTextCleared: true,
      progressTotalBlocksBeforeMutation: 2,
      progressTotalBlocksAfterMutation: 3,
      removedElementStillTracked: false,
    }, {
      expectedNewRequests: 1,
      expectedTranslatedNodeDelta: 1,
      requireUpdatedText: true,
      expectedProgressTotalAfterMutation: 3,
    })

    expect(result.pass).toBe(false)
    expect(result.issues.some((issue) => issue.message.includes("follow-up translation requests"))).toBe(true)
    expect(result.artifacts.patchHints).toMatchObject({
      confidence: "high",
      suspectedFiles: expect.arrayContaining([
        "src/entrypoints/content/page-translate-registry.ts",
      ]),
    })
  })
})
