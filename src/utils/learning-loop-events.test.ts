import { beforeEach, describe, expect, it, vi } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../test/utils/mockBrowser"
import { findForbiddenUserCopyTerms } from "./copy-dictionary"
import { getRecentEvents, type TelemetryEvent } from "./telemetry"
import {
  buildLearningLoopAccountContinuityPopupSignInUrl,
  buildLearningLoopAccountContinuityProofMoment,
  buildLearningLoopProValueMoments,
  buildLearningLoopUpgradePrompt,
  aggregateLearningLoopActivationDashboard,
  aggregateLearningLoopFunnel,
  aggregateLearningLoopLearningDashboard,
  aggregateLearningLoopRetentionDashboard,
  aggregateLearningLoopUpgradePromptDashboard,
  DEFAULT_LEARNING_LOOP_COPY_VARIANT,
  deriveLearningLoopCopyVariantAutoSelectionStatus,
  getLearningLoopCopyVariant,
  getLearningLoopCopyVariantAutoSelectionStatus,
  getLearningLoopUpgradePromptVariant,
  LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY,
  LEARNING_LOOP_COMMERCIAL_PACKAGE_COPY,
  LEARNING_LOOP_COMMERCIAL_SURFACE_COPY,
  LEARNING_LOOP_COPY_VARIANT_AUTO_SELECTION_GUARDRAILS,
  LEARNING_LOOP_COPY_VARIANT_STORAGE_KEY,
  LEARNING_LOOP_EVENT_NAMES,
  LEARNING_LOOP_DIFFERENTIATION_COPY,
  LEARNING_LOOP_FIRST_WIN_ACTIVATION_COPY,
  LEARNING_LOOP_PRO_VALUE_MOMENTS,
  LEARNING_LOOP_STAGE_OKR_METRICS,
  LEARNING_LOOP_UPGRADE_PROMPT_EXPERIMENT_ID,
  LEARNING_LOOP_UPGRADE_PROMPT_VARIANT_STORAGE_KEY,
  recordLearningLoopEvent,
  setLearningLoopCopyVariant,
  type LearningLoopCopyVariant,
  type LearningLoopEventName,
  type LearningLoopFunnelEventName,
} from "./learning-loop-events"

describe("learning loop events", () => {
  beforeEach(() => {
    vi.useRealTimers()
    setMockBrowser(createMockBrowser())
  })

  async function flushTelemetry() {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  }

  function createFunnelEvent(
    id: string,
    timestamp: number,
    event: LearningLoopFunnelEventName,
    variant?: LearningLoopCopyVariant,
  ): TelemetryEvent {
    return {
      id,
      type: "feature_usage",
      timestamp,
      data: {
        feature: "learning_loop",
        event,
        ...(variant ? { variant } : {}),
      },
    }
  }

  function createRepeatedFunnelEvents(
    prefix: string,
    startTimestamp: number,
    variant: LearningLoopCopyVariant,
    counts: Partial<Record<LearningLoopFunnelEventName, number>>,
  ): TelemetryEvent[] {
    const events: TelemetryEvent[] = []
    let timestamp = startTimestamp
    for (const [event, count] of Object.entries(counts) as Array<[LearningLoopFunnelEventName, number]>) {
      for (let index = 0; index < count; index += 1) {
        events.push(createFunnelEvent(`${prefix}-${event}-${index}`, timestamp, event, variant))
        timestamp += 1
      }
    }
    return events
  }

  function seedTelemetryEvents(events: TelemetryEvent[]) {
    const browser = (globalThis as unknown as { __ASTRA_TEST_BROWSER__: ReturnType<typeof createMockBrowser> }).__ASTRA_TEST_BROWSER__
    browser.__storage["astra.telemetry.v1"] = [...events].sort((a, b) => b.timestamp - a.timestamp)
  }

  it("keeps the shared differentiation comparison copy explicit", () => {
    expect(LEARNING_LOOP_DIFFERENTIATION_COPY.title).toContain("Generic tools stop at output")
    expect(LEARNING_LOOP_DIFFERENTIATION_COPY.genericTranslator).toContain("Generic translators")
    expect(LEARNING_LOOP_DIFFERENTIATION_COPY.genericReader).toContain("Generic readers")
    expect(LEARNING_LOOP_DIFFERENTIATION_COPY.astra).toContain("Astra links translation")
    expect(LEARNING_LOOP_DIFFERENTIATION_COPY.reinforcement).toContain("translator or reader alone")
  })

  it("keeps the canonical commercial package copy explicit and copy-only", () => {
    expect(LEARNING_LOOP_COMMERCIAL_PACKAGE_COPY.eyebrow).toBe("Start free -> Build assets -> Keep continuity")
    expect(LEARNING_LOOP_COMMERCIAL_PACKAGE_COPY.title).toContain("real-page moments")
    expect(LEARNING_LOOP_COMMERCIAL_PACKAGE_COPY.description).toContain("Free daily translations start the loop")
    expect(LEARNING_LOOP_COMMERCIAL_PACKAGE_COPY.description).toContain("without setup")
    expect(LEARNING_LOOP_COMMERCIAL_PACKAGE_COPY.description).toContain("context compounds")
    expect(LEARNING_LOOP_COMMERCIAL_PACKAGE_COPY.steps).toEqual([
      expect.stringContaining("Start free"),
      expect.stringContaining("Build learning assets"),
      expect.stringContaining("Keep continuity"),
    ])
    expect(LEARNING_LOOP_COMMERCIAL_PACKAGE_COPY.control).toContain("You stay in control")
    expect(LEARNING_LOOP_COMMERCIAL_PACKAGE_COPY.boundary).toContain("Local beta boundary")
    expect(LEARNING_LOOP_COMMERCIAL_PACKAGE_COPY.boundary).toContain("not unlimited bulk translation")
    expect(LEARNING_LOOP_COMMERCIAL_PACKAGE_COPY.boundary).toContain("billing commitment")
    expect(LEARNING_LOOP_COMMERCIAL_PACKAGE_COPY.outcome).toContain("reviewable learning outcomes")
  })

  it("keeps surface-specific commercial package copy concise", () => {
    expect(LEARNING_LOOP_COMMERCIAL_SURFACE_COPY.onboardingPackageCard).toBe(LEARNING_LOOP_COMMERCIAL_PACKAGE_COPY)
    expect(LEARNING_LOOP_COMMERCIAL_SURFACE_COPY.firstWinActivation).toBe(LEARNING_LOOP_FIRST_WIN_ACTIVATION_COPY)
    expect(LEARNING_LOOP_COMMERCIAL_SURFACE_COPY.accountContinuity).toBe(LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY)
    expect(LEARNING_LOOP_FIRST_WIN_ACTIVATION_COPY.eyebrow).toBe("First win activation")
    expect(LEARNING_LOOP_FIRST_WIN_ACTIVATION_COPY.title).toContain("Save one useful sentence")
    expect(LEARNING_LOOP_FIRST_WIN_ACTIVATION_COPY.summary).toContain("Translate a page, open Deep Read, explain one sentence, save it")
    expect(LEARNING_LOOP_FIRST_WIN_ACTIVATION_COPY.summary).toContain("same page context back")
    expect(LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.eyebrow).toBe("Account continuity")
    expect(LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.title).toContain("Keep your learning trail")
    expect(LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.summary).toContain("saved learning cards, reading queue, and study progress")
    expect(LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.connectedTitle).toContain("Continuity is connected")
    expect(LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.connectedSummary).toContain("saved learning cards")
    expect(LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.connectedSummary).toContain("attached to this Astra account")
    expect(LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.bullets).toEqual([
      expect.stringContaining("same source pages and saved card context"),
      expect.stringContaining("saved cards"),
      expect.stringContaining("review schedules synced safely"),
    ])
    expect(LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.cta).toBe("Sign in to keep continuity")
    expect(LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.ctaHelper).toContain("existing Astra sign-in panel")
    expect(LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.proofMoments.popup).toContain("Proof from this popup session")
    expect(LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.proofMoments.vocabularyReview).toContain("Proof in Review")
    expect(LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.proofCtaHelper).toContain("existing popup sign-in panel")
    expect(LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.connectedProofHelper).toContain("no sign-in action is needed")
    expect(buildLearningLoopAccountContinuityProofMoment("study", {
      dueReviewCount: 2,
      savedSentenceCount: 1,
      vocabSavedToday: 3,
      vocabReviewedToday: 4,
    })).toContain("Proof now: 2 due review cards · 1 saved learning card · 3 cards saved today.")
    expect(buildLearningLoopAccountContinuityProofMoment("study", {
      dueReviewCount: 1,
    }, { authState: "signed_in" })).toContain("no sign-in action is needed")
    expect(buildLearningLoopAccountContinuityProofMoment("vocabulary_reading")).toContain("Proof appears as soon as you translate, explain, save, review, or queue a reading item")
    expect(LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.popupFocusParam).toBe("focus=sign-in")
    expect(LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.popupDeepLinkPath).toBe("/popup.html?focus=sign-in")
    expect(LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.nextAction).toContain("popup sign-in panel")
    expect(buildLearningLoopAccountContinuityPopupSignInUrl((path) => `chrome-extension://test-id${path}`)).toBe("chrome-extension://test-id/popup.html?focus=sign-in")
    expect(LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.boundary).toContain("No billing change")
    expect(LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.boundary).toContain("daily study stats stay local-only")
    expect(LEARNING_LOOP_COMMERCIAL_SURFACE_COPY.popupPrimer.eyebrow).toBe("Free start · connected practice")
    expect(LEARNING_LOOP_COMMERCIAL_SURFACE_COPY.popupPrimer.summary).toContain("Generic translators/readers stop after the answer")
    expect(LEARNING_LOOP_COMMERCIAL_SURFACE_COPY.popupPrimer.summary).toContain("review path attached")
    expect(LEARNING_LOOP_COMMERCIAL_SURFACE_COPY.studyOutcome).toContain("saved review cards connected")
    expect(LEARNING_LOOP_COMMERCIAL_SURFACE_COPY.studyOutcome).toContain("repeat practice")
  })

  it("keeps shared user-facing commercial copy free of restricted technical language", () => {
    const userFacingCopy = [
      ...Object.values(LEARNING_LOOP_COMMERCIAL_PACKAGE_COPY).flatMap((value) => Array.isArray(value) ? value : [value]),
      ...Object.values(LEARNING_LOOP_FIRST_WIN_ACTIVATION_COPY),
      LEARNING_LOOP_COMMERCIAL_SURFACE_COPY.popupPrimer.eyebrow,
      LEARNING_LOOP_COMMERCIAL_SURFACE_COPY.popupPrimer.title,
      LEARNING_LOOP_COMMERCIAL_SURFACE_COPY.popupPrimer.summary,
      LEARNING_LOOP_COMMERCIAL_SURFACE_COPY.studyOutcome,
      ...Object.values(LEARNING_LOOP_DIFFERENTIATION_COPY),
    ]

    for (const copy of userFacingCopy) {
      expect(findForbiddenUserCopyTerms(copy)).toEqual([])
    }
  })

  it("keeps trigger-specific Pro-value moment copy user-facing and non-technical", () => {
    expect(Object.keys(LEARNING_LOOP_PRO_VALUE_MOMENTS)).toEqual([
      "long_video",
      "deep_read",
      "sync",
      "digest",
      "near_limit",
    ])
    const moments = buildLearningLoopProValueMoments({
      surface: "popup_pro_value",
      triggers: ["long_video", "deep_read", "sync", "digest", "near_limit", "sync"],
      maxMoments: 5,
    })

    expect(moments.map((moment) => moment.trigger)).toEqual([
      "long_video",
      "deep_read",
      "sync",
      "digest",
      "near_limit",
    ])
    expect(moments.every((moment) => moment.surface === "popup_pro_value")).toBe(true)
    const serialized = JSON.stringify(moments).toLowerCase()
    expect(serialized).toContain("longer videos")
    expect(serialized).toContain("deep read")
    expect(serialized).toContain("continuity")
    expect(serialized).toContain("digest")
    expect(serialized).toContain("near-limit")
    expect(serialized).not.toContain("provider")
    expect(serialized).not.toContain("token")
    expect(serialized).not.toContain("api key")
  })

  it("builds beta-safe upgrade-interest prompt copy without payment launch claims", () => {
    expect(buildLearningLoopUpgradePrompt({ variant: "continuity_first", triggers: [] })).toBeNull()
    const prompt = buildLearningLoopUpgradePrompt({ variant: "momentum_first", triggers: ["deep_read", "sync", "deep_read"] })
    expect(prompt).toMatchObject({
      experimentId: LEARNING_LOOP_UPGRADE_PROMPT_EXPERIMENT_ID,
      variant: "momentum_first",
      triggers: ["deep_read", "sync"],
      cta: "I'm interested in upgrades",
    })
    const serialized = JSON.stringify(prompt).toLowerCase()
    expect(serialized).toContain("paid upgrades are not available")
    expect(serialized).toContain("only records local interest")
    expect(serialized).toContain("does not start checkout")
    expect(serialized).toContain("trial")
    expect(serialized).toContain("email capture")
    expect(serialized).toContain("subscription change")
    expect(serialized).not.toContain("buy now")
    expect(serialized).not.toContain("start trial")
    expect(serialized).not.toContain("subscribe")
    expect(serialized).not.toContain("payment")
  })

  it("assigns and persists the local upgrade prompt variant with beta boundary telemetry", async () => {
    const browser = (globalThis as unknown as { __ASTRA_TEST_BROWSER__: ReturnType<typeof createMockBrowser> }).__ASTRA_TEST_BROWSER__
    vi.spyOn(Math, "random").mockReturnValueOnce(0.9)

    await expect(getLearningLoopUpgradePromptVariant()).resolves.toBe("momentum_first")
    expect(browser.__storage[LEARNING_LOOP_UPGRADE_PROMPT_VARIANT_STORAGE_KEY]).toBe("momentum_first")
    await expect(getLearningLoopUpgradePromptVariant()).resolves.toBe("momentum_first")

    await flushTelemetry()
    const events = await getRecentEvents(10)
    const assignments = events.filter((event) => event.data.event === "variant_assigned" && event.data.experimentId === LEARNING_LOOP_UPGRADE_PROMPT_EXPERIMENT_ID)
    expect(assignments).toHaveLength(1)
    expect(assignments[0]?.data).toMatchObject({
      variant: "momentum_first",
      assignment: "local_random",
      billingAvailable: false,
      hardBlock: false,
    })
    expect(assignments[0]?.data).not.toHaveProperty("pageUrl")
    expect(assignments[0]?.data).not.toHaveProperty("payment")
    expect(assignments[0]?.data).not.toHaveProperty("checkoutUrl")
  })

  it("aggregates upgrade prompt exposures and intents by variant and trigger only", () => {
    const dashboard = aggregateLearningLoopUpgradePromptDashboard([
      {
        id: "assign",
        type: "feature_usage",
        timestamp: 1000,
        data: { feature: "learning_loop", event: "variant_assigned", experimentId: LEARNING_LOOP_UPGRADE_PROMPT_EXPERIMENT_ID, variant: "continuity_first", billingAvailable: false, hardBlock: false, pageUrl: "https://example.test/private" },
      },
      {
        id: "view",
        type: "feature_usage",
        timestamp: 1001,
        data: { feature: "learning_loop", event: "paywall_viewed", experimentId: LEARNING_LOOP_UPGRADE_PROMPT_EXPERIMENT_ID, variant: "continuity_first", triggers: ["deep_read", "sync"], billingAvailable: false, hardBlock: false, pageUrl: "https://example.test/private" },
      },
      {
        id: "intent",
        type: "feature_usage",
        timestamp: 1002,
        data: { feature: "learning_loop", event: "conversion_event", experimentId: LEARNING_LOOP_UPGRADE_PROMPT_EXPERIMENT_ID, conversion: "upgrade_intent_clicked", variant: "continuity_first", triggers: ["deep_read"], checkoutUrl: "https://billing.test" },
      },
      {
        id: "other-conversion",
        type: "feature_usage",
        timestamp: 1003,
        data: { feature: "learning_loop", event: "conversion_event", experimentId: LEARNING_LOOP_UPGRADE_PROMPT_EXPERIMENT_ID, conversion: "trial_started", variant: "continuity_first", trigger: "deep_read" },
      },
      {
        id: "other-experiment",
        type: "feature_usage",
        timestamp: 1004,
        data: { feature: "learning_loop", event: "paywall_viewed", experimentId: "other", variant: "continuity_first", trigger: "deep_read" },
      },
      {
        id: "other-feature",
        type: "feature_usage",
        timestamp: 1005,
        data: { feature: "other", event: "paywall_viewed", experimentId: LEARNING_LOOP_UPGRADE_PROMPT_EXPERIMENT_ID, variant: "continuity_first", trigger: "deep_read" },
      },
    ])

    expect(dashboard.assignments).toBe(1)
    expect(dashboard.views).toBe(1)
    expect(dashboard.intents).toBe(1)
    expect(dashboard.intentRate).toBe(1)
    expect(dashboard.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ variant: "continuity_first", trigger: "deep_read", views: 1, intents: 1, intentRate: 1 }),
      expect.objectContaining({ variant: "continuity_first", trigger: "sync", views: 1, intents: 0, intentRate: 0 }),
      expect.objectContaining({ variant: "continuity_first", trigger: "unknown", assignments: 1 }),
    ]))
    const serializedRows = JSON.stringify(dashboard.rows).toLowerCase()
    expect(serializedRows).not.toContain("example.test")
    expect(serializedRows).not.toContain("billing.test")
    expect(serializedRows).not.toContain("checkouturl")
    expect(dashboard.privacyPolicy).toContain("does not include page URLs")
    expect(dashboard.privacyPolicy).toContain("payment")
    expect(dashboard.privacyPolicy).toContain("trial")
  })

  it("keeps V1 activation, trial, pro-value, support, and cancellation events canonical", () => {
    expect(LEARNING_LOOP_EVENT_NAMES).toEqual(expect.arrayContaining([
      "extension_installed",
      "onboarding_started",
      "sample_started",
      "first_value_seen",
      "onboarding_completed",
      "first_content_understood",
      "saved_snippet_created",
      "review_session_completed",
      "review_opened",
      "continue_clicked",
      "digest_opened",
      "reminder_dismissed",
      "reminder_disabled",
      "winback_sent",
      "trial_started",
      "pro_value_seen",
      "support_report_submitted",
      "known_issue_viewed",
      "cancellation_reason_submitted",
      "share_card_created",
      "referral_sent",
      "referral_converted",
      "landing_visited",
      "landing_install_clicked",
      "variant_assigned",
      "conversion_event",
      "guardrail_metric",
    ]))
  })

  it("aggregates a local activation dashboard without content fields", () => {
    const dashboard = aggregateLearningLoopActivationDashboard([
      {
        id: "install-1",
        type: "feature_usage",
        timestamp: 1_000,
        data: { feature: "learning_loop", event: "extension_installed", source: "background" },
      },
      {
        id: "onboarding-start-1",
        type: "feature_usage",
        timestamp: 2_000,
        data: { feature: "learning_loop", event: "onboarding_started", source: "onboarding" },
      },
      {
        id: "onboarding-complete-1",
        type: "feature_usage",
        timestamp: 20_000,
        data: { feature: "learning_loop", event: "onboarding_completed", source: "onboarding" },
      },
      {
        id: "first-value-1",
        type: "feature_usage",
        timestamp: 41_000,
        data: { feature: "learning_loop", event: "first_content_understood", source: "sample_lesson" },
      },
      {
        id: "save-1",
        type: "feature_usage",
        timestamp: 45_000,
        data: { feature: "learning_loop", event: "saved_snippet_created", source: "sample_lesson" },
      },
      {
        id: "repeat-save-1",
        type: "feature_usage",
        timestamp: 46_000,
        data: { feature: "learning_loop", event: "sentence_saved", source: "sample_lesson" },
      },
      {
        id: "review-1",
        type: "feature_usage",
        timestamp: 48_000,
        data: { feature: "learning_loop", event: "review_session_completed", source: "sample_lesson" },
      },
      {
        id: "trial-1",
        type: "feature_usage",
        timestamp: 49_000,
        data: { feature: "learning_loop", event: "trial_started", source: "account" },
      },
      {
        id: "pro-value-1",
        type: "feature_usage",
        timestamp: 50_000,
        data: { feature: "learning_loop", event: "pro_value_seen", trigger: "sync" },
      },
      {
        id: "ignore",
        type: "feature_usage",
        timestamp: 55_000,
        data: { feature: "unrelated", event: "first_content_understood" },
      },
      {
        id: "install-2",
        type: "feature_usage",
        timestamp: 101_000,
        data: { feature: "learning_loop", event: "extension_installed", source: "background" },
      },
      {
        id: "first-value-2",
        type: "feature_usage",
        timestamp: 151_000,
        data: { feature: "learning_loop", event: "first_value_seen", source: "sample_lesson" },
      },
    ])

    expect(dashboard.activationStartCount).toBe(2)
    expect(dashboard.firstValueCount).toBe(2)
    expect(dashboard.firstSaveCount).toBe(1)
    expect(dashboard.firstReviewCompletionCount).toBe(1)
    expect(dashboard.firstValueP50Seconds).toBe(45)
    expect(dashboard.firstValueDurationSamplesSeconds).toEqual([40, 50])
    expect(dashboard.onboardingCompletionRate).toBe(1)
    expect(dashboard.firstSaveRate).toBe(0.5)
    expect(dashboard.firstReviewCompletionRate).toBe(1)
    expect(dashboard.trialStartedCount).toBe(1)
    expect(dashboard.proValueSeenCount).toBe(1)
    expect(dashboard.privacyPolicy).toContain("does not display page text")
  })

  it("aggregates a local learning dashboard from metadata-only events", () => {
    const jan1 = Date.UTC(2026, 0, 1, 12, 0, 0)
    const jan2 = Date.UTC(2026, 0, 2, 12, 0, 0)
    const jan3 = Date.UTC(2026, 0, 3, 12, 0, 0)
    const jan4 = Date.UTC(2026, 0, 4, 12, 0, 0)

    const dashboard = aggregateLearningLoopLearningDashboard([
      {
        id: "save-sample",
        type: "feature_usage",
        timestamp: jan1,
        data: { feature: "learning_loop", event: "saved_snippet_created", source: "sample_lesson", sourceType: "sample_article", hasReviewCard: true },
      },
      {
        id: "save-popup",
        type: "feature_usage",
        timestamp: jan2,
        data: { feature: "learning_loop", event: "sentence_saved", source: "popup_deep_read", sourceType: "article", hasReviewCard: true, pageUrl: "https://example.test/article/with/path" },
      },
      {
        id: "save-malformed-source",
        type: "feature_usage",
        timestamp: jan2 + 60_000,
        data: { feature: "learning_loop", event: "sentence_saved", source: "https://example.test/private/path", pageUrl: "https://example.test/private/path" },
      },
      {
        id: "review-open-1",
        type: "feature_usage",
        timestamp: jan3,
        data: { feature: "learning_loop", event: "review_opened", source: "vocabulary" },
      },
      {
        id: "review-complete-1",
        type: "feature_usage",
        timestamp: jan3 + 60_000,
        data: { feature: "learning_loop", event: "review_session_completed", source: "vocabulary", cardCount: 2 },
      },
      {
        id: "review-open-2",
        type: "feature_usage",
        timestamp: jan3 + 120_000,
        data: { feature: "learning_loop", event: "review_opened", source: "vocabulary" },
      },
      {
        id: "review-answer-1",
        type: "feature_usage",
        timestamp: jan3 + 180_000,
        data: { feature: "learning_loop", event: "review_answered", source: "review", correct: true },
      },
      {
        id: "library-open",
        type: "feature_usage",
        timestamp: jan4,
        data: { feature: "learning_loop", event: "library_opened", source: "vocabulary" },
      },
      {
        id: "return-click",
        type: "feature_usage",
        timestamp: jan4 + 60_000,
        data: { feature: "learning_loop", event: "return_to_source_clicked", sourceType: "article" },
      },
      {
        id: "returned",
        type: "feature_usage",
        timestamp: jan4 + 120_000,
        data: { feature: "learning_loop", event: "returned_to_source", sourceType: "article" },
      },
      {
        id: "continue-click",
        type: "feature_usage",
        timestamp: jan4 + 180_000,
        data: { feature: "learning_loop", event: "continue_clicked", sourceType: "article" },
      },
      {
        id: "resumed",
        type: "feature_usage",
        timestamp: jan4 + 240_000,
        data: { feature: "learning_loop", event: "resumed_reading", sourceType: "article" },
      },
      {
        id: "ignore-content-feature",
        type: "feature_usage",
        timestamp: jan4 + 300_000,
        data: { feature: "other", event: "sentence_saved", source: "page_text" },
      },
    ])

    expect(dashboard.savedItemCount).toBe(3)
    expect(dashboard.reviewableCardProxyCount).toBe(2)
    expect(dashboard.reviewableCardProxyRate).toBe(2 / 3)
    expect(dashboard.reviewOpenedCount).toBe(2)
    expect(dashboard.reviewAnsweredCount).toBe(1)
    expect(dashboard.reviewCompletedCount).toBe(1)
    expect(dashboard.reviewCompletionRate).toBe(0.5)
    expect(dashboard.libraryOpenedCount).toBe(1)
    expect(dashboard.sourceReturnCount).toBe(2)
    expect(dashboard.continueLearningCount).toBe(2)
    expect(dashboard.activeLearningDaysLast28).toBe(4)
    expect(dashboard.savedBySourceType).toEqual([
      { sourceType: "article", count: 1 },
      { sourceType: "sample_article", count: 1 },
      { sourceType: "unknown", count: 1 },
    ])
    expect(JSON.stringify(dashboard.savedBySourceType)).not.toContain("private")
    expect(JSON.stringify(dashboard.savedBySourceType)).not.toContain("example")
    expect(dashboard.privacyPolicy).toContain("does not display page text")
  })

  it("aggregates a local retention dashboard from metadata-only events", () => {
    const jan1 = Date.UTC(2026, 0, 1, 12, 0, 0)
    const jan8 = Date.UTC(2026, 0, 8, 12, 0, 0)
    const jan9 = Date.UTC(2026, 0, 9, 12, 0, 0)
    const jan10 = Date.UTC(2026, 0, 10, 12, 0, 0)
    const jan15 = Date.UTC(2026, 0, 15, 12, 0, 0)
    const jan20 = Date.UTC(2026, 0, 20, 12, 0, 0)
    const jan21 = Date.UTC(2026, 0, 21, 12, 0, 0)

    const dashboard = aggregateLearningLoopRetentionDashboard([
      {
        id: "review-open-1",
        type: "feature_usage",
        timestamp: jan1,
        data: { feature: "learning_loop", event: "review_opened", source: "vocabulary" },
      },
      {
        id: "review-complete-1",
        type: "feature_usage",
        timestamp: jan1 + 60_000,
        data: { feature: "learning_loop", event: "review_session_completed", source: "vocabulary", cardCount: 3 },
      },
      {
        id: "digest-viewed-1",
        type: "feature_usage",
        timestamp: jan8,
        data: { feature: "learning_loop", event: "digest_viewed", weekNumber: "2026-W02" },
      },
      {
        id: "review-open-2",
        type: "feature_usage",
        timestamp: jan9,
        data: { feature: "learning_loop", event: "review_opened", source: "digest" },
      },
      {
        id: "digest-opened-1",
        type: "feature_usage",
        timestamp: jan10,
        data: { feature: "learning_loop", event: "digest_opened", weekNumber: "2026-W02" },
      },
      {
        id: "continue-1",
        type: "feature_usage",
        timestamp: jan15,
        data: { feature: "learning_loop", event: "continue_clicked", sourceType: "article" },
      },
      {
        id: "return-1",
        type: "feature_usage",
        timestamp: jan15 + 60_000,
        data: { feature: "learning_loop", event: "returned_to_source", sourceType: "article" },
      },
      {
        id: "reminder-dismissed",
        type: "feature_usage",
        timestamp: jan20,
        data: { feature: "learning_loop", event: "reminder_dismissed", reminderType: "review" },
      },
      {
        id: "reminder-disabled",
        type: "feature_usage",
        timestamp: jan20 + 60_000,
        data: { feature: "learning_loop", event: "reminder_disabled", reminderType: "digest" },
      },
      {
        id: "pro-value",
        type: "feature_usage",
        timestamp: jan20 + 120_000,
        data: { feature: "learning_loop", event: "pro_value_seen", trigger: "digest" },
      },
      {
        id: "cancel-value-risk",
        type: "feature_usage",
        timestamp: jan21,
        data: { feature: "learning_loop", event: "cancellation_reason_submitted", reason: "did_not_use_it" },
      },
      {
        id: "cancel-not-risk",
        type: "feature_usage",
        timestamp: jan21 + 60_000,
        data: { feature: "learning_loop", event: "cancellation_reason_submitted", reason: "temporary_break" },
      },
      {
        id: "ignore-content-feature",
        type: "feature_usage",
        timestamp: jan21 + 120_000,
        data: { feature: "other", event: "digest_viewed" },
      },
    ])

    expect(dashboard.reviewOpenedCount).toBe(2)
    expect(dashboard.reviewCompletedCount).toBe(1)
    expect(dashboard.reviewCompletionRate).toBe(0.5)
    expect(dashboard.sourceReturnCount).toBe(2)
    expect(dashboard.continueCount).toBe(1)
    expect(dashboard.digestViewedCount).toBe(2)
    expect(dashboard.digestOpenedCount).toBe(1)
    expect(dashboard.digestReviewFollowThroughCount).toBe(2)
    expect(dashboard.digestReviewFollowThroughRate).toBe(1)
    expect(dashboard.activeLearningDaysLast28).toBe(5)
    expect(dashboard.activeLearningWeeksLast4).toBe(3)
    expect(dashboard.reminderControlledCount).toBe(2)
    expect(dashboard.proRepeatValueCount).toBe(1)
    expect(dashboard.cancellationValueRiskCount).toBe(1)
    expect(dashboard.privacyPolicy).toContain("does not display page text")
  })

  it("maps every section-34 stage OKR to privacy-safe supporting signals", () => {
    expect(LEARNING_LOOP_STAGE_OKR_METRICS).toHaveLength(21)
    expect(new Set(LEARNING_LOOP_STAGE_OKR_METRICS.map((metric) => metric.stage))).toEqual(new Set(["M1", "M2", "M3", "M4", "M5"]))

    const canonicalEvents = new Set(LEARNING_LOOP_EVENT_NAMES)
    const nonEventSignals = new Set([
      "weekly_reviewable_learning_moments",
      "reviewable_card_rate",
      "provider_api_model_default_ui_count",
      "preference_undo_delete_available",
      "prompt_injection_fixture_pass_rate",
    ])

    for (const metric of LEARNING_LOOP_STAGE_OKR_METRICS) {
      expect(metric.objective).toBeTruthy()
      expect(metric.keyResult).toBeTruthy()
      expect(metric.supportingSignals.length).toBeGreaterThan(0)
      expect(metric.privacyPolicy).toMatch(/only|no |static|fixture|aggregate/i)
      const privacyPolicy = metric.privacyPolicy.toLowerCase()
      for (const excludedTerm of ["page text", "selected text", "snippet text", "card text", "prompt", "model output", "full url"] as const) {
        if (privacyPolicy.includes(excludedTerm)) {
          expect(privacyPolicy).toMatch(new RegExp(`(no|without|not|never)[^.]*${excludedTerm.replace(/ /g, "\\s+")}`))
        }
      }

      for (const signal of metric.supportingSignals) {
        expect(signal.kind === "event" ? canonicalEvents.has(signal.name as LearningLoopEventName) : nonEventSignals.has(signal.name)).toBe(true)
      }
    }
  })

  it("records learning loop events through the shared telemetry store", async () => {
    recordLearningLoopEvent("deep_read_opened", {
      pageUrl: "https://example.com/article",
      source: "popup",
    })

    await flushTelemetry()

    const events = await getRecentEvents(5)
    expect(events[0]).toMatchObject({
      type: "feature_usage",
      data: expect.objectContaining({
        feature: "learning_loop",
        event: "deep_read_opened",
        pageUrl: "https://example.com/article",
        source: "popup",
      }),
    })
  })

  it("defaults and persists the local learning-loop copy variant", async () => {
    const browser = (globalThis as unknown as { __ASTRA_TEST_BROWSER__: ReturnType<typeof createMockBrowser> }).__ASTRA_TEST_BROWSER__

    await expect(getLearningLoopCopyVariant()).resolves.toBe(DEFAULT_LEARNING_LOOP_COPY_VARIANT)
    expect(browser.__storage[LEARNING_LOOP_COPY_VARIANT_STORAGE_KEY]).toBe(DEFAULT_LEARNING_LOOP_COPY_VARIANT)

    await flushTelemetry()
    const events = await getRecentEvents(5)
    expect(events.some((event) => event.data.event === "copy_variant_assigned" && event.data.variant === DEFAULT_LEARNING_LOOP_COPY_VARIANT)).toBe(true)
  })

  it("supports a lightweight local A/B copy switch", async () => {
    await setLearningLoopCopyVariant("outcome_first")

    await expect(getLearningLoopCopyVariant()).resolves.toBe("outcome_first")
    await flushTelemetry()

    const events = await getRecentEvents(5)
    expect(events.some((event) => event.data.event === "copy_variant_assigned" && event.data.assignment === "local_switch" && event.data.variant === "outcome_first")).toBe(true)
  })

  it("reports auto-selection progress while local sample thresholds are still collecting", async () => {
    const status = deriveLearningLoopCopyVariantAutoSelectionStatus(
      aggregateLearningLoopFunnel([
        createFunnelEvent("loop-view", 1000, "popup_primer_viewed", "loop_first"),
        createFunnelEvent("outcome-view", 1001, "popup_primer_viewed", "outcome_first"),
      ]),
      "loop_first",
      null,
      2000,
    )

    expect(status.phase).toBe("collecting")
    expect(status.recommendedVariant).toBeNull()
    expect(status.reason).toContain("Collecting local samples")
    expect(status.candidates.find((candidate) => candidate.variant === "loop_first")?.views).toBe(1)
    expect(status.guardrails.minViewsPerVariant).toBe(LEARNING_LOOP_COPY_VARIANT_AUTO_SELECTION_GUARDRAILS.minViewsPerVariant)
  })

  it("uses score threshold and hysteresis guardrails before switching variants", () => {
    const lowScore = deriveLearningLoopCopyVariantAutoSelectionStatus(
      aggregateLearningLoopFunnel([
        ...createRepeatedFunnelEvents("loop-low", 1000, "loop_first", { popup_primer_viewed: 3 }),
        ...createRepeatedFunnelEvents("outcome-low", 2000, "outcome_first", { popup_primer_viewed: 3 }),
      ]),
      "loop_first",
      null,
      3000,
    )
    expect(lowScore.phase).toBe("guarded")
    expect(lowScore.reason).toContain("winning score must reach")
    expect(lowScore.recommendedVariant).toBeNull()

    const narrowLift = deriveLearningLoopCopyVariantAutoSelectionStatus(
      aggregateLearningLoopFunnel([
        ...createRepeatedFunnelEvents("loop", 4000, "loop_first", {
          popup_primer_viewed: 3,
          popup_primer_cta_clicked: 3,
          deep_read_opened: 3,
          sentence_explained: 3,
        }),
        ...createRepeatedFunnelEvents("outcome", 5000, "outcome_first", {
          popup_primer_viewed: 3,
          popup_primer_cta_clicked: 3,
          deep_read_opened: 3,
          sentence_explained: 3,
          sentence_saved: 1,
        }),
      ]),
      "loop_first",
      null,
      6000,
    )

    expect(narrowLift.phase).toBe("guarded")
    expect(narrowLift.winnerVariant).toBe("outcome_first")
    expect(narrowLift.recommendedVariant).toBeNull()
    expect(narrowLift.reason).toContain("hysteresis guardrail")
  })

  it("automatically selects a local winner when thresholds pass and records the assignment", async () => {
    seedTelemetryEvents([
      ...createRepeatedFunnelEvents("loop", 1000, "loop_first", { popup_primer_viewed: 3 }),
      ...createRepeatedFunnelEvents("outcome", 2000, "outcome_first", {
        popup_primer_viewed: 3,
        popup_primer_cta_clicked: 3,
        deep_read_opened: 3,
        sentence_explained: 3,
        sentence_saved: 3,
      }),
    ])

    const browser = (globalThis as unknown as { __ASTRA_TEST_BROWSER__: ReturnType<typeof createMockBrowser> }).__ASTRA_TEST_BROWSER__
    await expect(getLearningLoopCopyVariant()).resolves.toBe("outcome_first")
    expect(browser.__storage[LEARNING_LOOP_COPY_VARIANT_STORAGE_KEY]).toBe("outcome_first")

    await flushTelemetry()
    const events = await getRecentEvents(20)
    expect(events.some((event) => event.data.event === "copy_variant_assigned" && event.data.assignment === "auto_winner" && event.data.variant === "outcome_first")).toBe(true)

    const status = await getLearningLoopCopyVariantAutoSelectionStatus()
    expect(status.phase).toBe("selected")
    expect(status.currentVariant).toBe("outcome_first")
    expect(status.winnerVariant).toBe("outcome_first")
  })

  it("keeps manual switches stable during the auto-selection cooldown", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-28T12:00:00.000Z"))

    await setLearningLoopCopyVariant("loop_first")
    await flushTelemetry()

    seedTelemetryEvents([
      ...createRepeatedFunnelEvents("loop", 1000, "loop_first", { popup_primer_viewed: 3 }),
      ...createRepeatedFunnelEvents("outcome", 2000, "outcome_first", {
        popup_primer_viewed: 3,
        popup_primer_cta_clicked: 3,
        deep_read_opened: 3,
        sentence_explained: 3,
        sentence_saved: 3,
      }),
    ])

    await expect(getLearningLoopCopyVariant()).resolves.toBe("loop_first")
    let status = await getLearningLoopCopyVariantAutoSelectionStatus()
    expect(status.phase).toBe("cooldown")
    expect(status.winnerVariant).toBe("outcome_first")

    vi.setSystemTime(new Date("2026-04-29T12:00:01.000Z"))
    await expect(getLearningLoopCopyVariant()).resolves.toBe("outcome_first")
    status = await getLearningLoopCopyVariantAutoSelectionStatus()
    expect(status.currentVariant).toBe("outcome_first")
  })

  it("aggregates local learning-loop funnel counts and rates by copy variant", () => {
    const aggregation = aggregateLearningLoopFunnel([
      {
        id: "ignore-translation",
        type: "translation_error",
        timestamp: 900,
        data: { feature: "learning_loop", event: "popup_primer_viewed", variant: "loop_first" },
      },
      {
        id: "loop-view-1",
        type: "feature_usage",
        timestamp: 1000,
        data: { feature: "learning_loop", event: "popup_primer_viewed", variant: "loop_first" },
      },
      {
        id: "loop-view-2",
        type: "feature_usage",
        timestamp: 1100,
        data: { feature: "learning_loop", event: "popup_primer_viewed", variant: "loop_first" },
      },
      {
        id: "loop-cta",
        type: "feature_usage",
        timestamp: 1200,
        data: { feature: "learning_loop", event: "popup_primer_cta_clicked", variant: "loop_first" },
      },
      {
        id: "loop-deep-read",
        type: "feature_usage",
        timestamp: 1300,
        data: { feature: "learning_loop", event: "deep_read_opened", variant: "loop_first" },
      },
      {
        id: "loop-explain",
        type: "feature_usage",
        timestamp: 1400,
        data: { feature: "learning_loop", event: "sentence_explained", variant: "loop_first" },
      },
      {
        id: "loop-save",
        type: "feature_usage",
        timestamp: 1500,
        data: { feature: "learning_loop", event: "sentence_saved", variant: "loop_first" },
      },
      {
        id: "outcome-view",
        type: "feature_usage",
        timestamp: 1600,
        data: { feature: "learning_loop", event: "popup_primer_viewed", variant: "outcome_first" },
      },
      {
        id: "legacy-save",
        type: "feature_usage",
        timestamp: 1700,
        data: { feature: "learning_loop", event: "sentence_saved" },
      },
    ])

    const loopFirst = aggregation.variants.find((variant) => variant.variant === "loop_first")
    const outcomeFirst = aggregation.variants.find((variant) => variant.variant === "outcome_first")
    const unknown = aggregation.variants.find((variant) => variant.variant === "unknown")

    expect(loopFirst?.counts.popup_primer_viewed).toBe(2)
    expect(loopFirst?.counts.popup_primer_cta_clicked).toBe(1)
    expect(loopFirst?.counts.sentence_saved).toBe(1)
    expect(loopFirst?.ctaRate).toBe(0.5)
    expect(loopFirst?.deepReadRate).toBe(0.5)
    expect(loopFirst?.explainRate).toBe(1)
    expect(loopFirst?.saveRate).toBe(1)
    expect(loopFirst?.latestTimestamp).toBe(1500)
    expect(outcomeFirst?.counts.popup_primer_viewed).toBe(1)
    expect(outcomeFirst?.saveRate).toBeNull()
    expect(unknown?.counts.sentence_saved).toBe(1)
    expect(aggregation.totals.counts.popup_primer_viewed).toBe(3)
    expect(aggregation.totals.counts.sentence_saved).toBe(2)
    expect(aggregation.totals.latestTimestamp).toBe(1700)
  })
})
