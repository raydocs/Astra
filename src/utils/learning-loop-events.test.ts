import { beforeEach, describe, expect, it, vi } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../test/utils/mockBrowser"
import { getRecentEvents, type TelemetryEvent } from "./telemetry"
import {
  buildLearningLoopAccountContinuityPopupSignInUrl,
  buildLearningLoopAccountContinuityProofMoment,
  aggregateLearningLoopFunnel,
  DEFAULT_LEARNING_LOOP_COPY_VARIANT,
  deriveLearningLoopCopyVariantAutoSelectionStatus,
  getLearningLoopCopyVariant,
  getLearningLoopCopyVariantAutoSelectionStatus,
  LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY,
  LEARNING_LOOP_COMMERCIAL_PACKAGE_COPY,
  LEARNING_LOOP_COMMERCIAL_SURFACE_COPY,
  LEARNING_LOOP_COPY_VARIANT_AUTO_SELECTION_GUARDRAILS,
  LEARNING_LOOP_COPY_VARIANT_STORAGE_KEY,
  LEARNING_LOOP_DIFFERENTIATION_COPY,
  LEARNING_LOOP_FIRST_WIN_ACTIVATION_COPY,
  recordLearningLoopEvent,
  setLearningLoopCopyVariant,
  type LearningLoopCopyVariant,
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
      expect.stringContaining("SRS schedule timing remains local-only"),
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
    expect(LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.boundary).toContain("SRS schedule timing stays local-only")
    expect(LEARNING_LOOP_COMMERCIAL_SURFACE_COPY.popupPrimer.eyebrow).toBe("Free start · connected practice")
    expect(LEARNING_LOOP_COMMERCIAL_SURFACE_COPY.popupPrimer.summary).toContain("Generic translators/readers stop after the answer")
    expect(LEARNING_LOOP_COMMERCIAL_SURFACE_COPY.popupPrimer.summary).toContain("review path attached")
    expect(LEARNING_LOOP_COMMERCIAL_SURFACE_COPY.studyOutcome).toContain("saved review cards connected")
    expect(LEARNING_LOOP_COMMERCIAL_SURFACE_COPY.studyOutcome).toContain("repeat practice")
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
