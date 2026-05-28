import { describe, expect, it } from "vitest"

import {
  ASTRA_FIRST_SUCCESS_EVENT_NAMES,
  ASTRA_FIRST_SUCCESS_FORBIDDEN_ONBOARDING_QUESTIONS,
  ASTRA_FIRST_SUCCESS_METRICS,
  ASTRA_FIRST_SUCCESS_ONBOARDING_QUESTIONS,
  ASTRA_FIRST_SUCCESS_SMOKE_EVIDENCE_ROWS,
  ASTRA_FIRST_SUCCESS_STEPS,
  ASTRA_SAMPLE_LESSON_STEPS,
  evaluateAstraFirstSuccessReadiness,
  evaluateAstraFirstSuccessSmokeReport,
  type AstraFirstSuccessReadinessEvidence,
} from "./first-success"
import {
  aggregateLearningLoopActivationDashboard,
  LEARNING_LOOP_ACTIVATION_EVENT_NAMES,
} from "./learning-loop-events"

const readyEvidence: AstraFirstSuccessReadinessEvidence = {
  installToFirstUnderstoodUnder60Seconds: true,
  onboardingUsesOnlyThreeCoreQuestions: true,
  onboardingAvoidsTechnicalQuestions: true,
  samplePageEntryAvailable: true,
  sampleArticleShowsUnderstandableContent: true,
  recommendedSentenceCanBeSaved: true,
  oneCardReviewReachable: true,
  firstReviewCardCopyShown: true,
  activationEventsRecorded: true,
  activationTelemetryAvoidsContent: true,
  firstUnderstandingSuccessRateTargetMet: true,
  firstSaveRateTargetMet: true,
  firstReviewReachTargetMet: true,
}

describe("Astra first-success contract", () => {
  it("defines the standard first-success path", () => {
    expect(ASTRA_FIRST_SUCCESS_STEPS.map((step) => step.id)).toEqual([
      "install_astra",
      "choose_target_language",
      "optional_sign_in_or_membership_start",
      "first_content_understood",
      "save_word_or_sentence",
      "first_review_seen",
    ])
    expect(ASTRA_FIRST_SUCCESS_STEPS.filter((step) => step.required).map((step) => step.id)).toEqual([
      "install_astra",
      "choose_target_language",
      "first_content_understood",
      "save_word_or_sentence",
      "first_review_seen",
    ])
  })

  it("keeps onboarding to three core questions and forbids technical setup", () => {
    expect(Object.keys(ASTRA_FIRST_SUCCESS_ONBOARDING_QUESTIONS)).toEqual([
      "target_language",
      "language_level",
      "primary_goal",
    ])
    expect(Object.keys(ASTRA_FIRST_SUCCESS_FORBIDDEN_ONBOARDING_QUESTIONS)).toEqual([
      "model",
      "provider",
      "prompt",
      "technical_configuration",
      "advanced_site_rules",
      "sync_details",
    ])
  })

  it("codifies the sample lesson flow", () => {
    expect(ASTRA_SAMPLE_LESSON_STEPS.map((step) => step.label)).toEqual([
      "Try Astra on a sample page",
      "Open a short article",
      "Astra shows understandable content",
      "Highlight a recommended sentence",
      "Save the sentence",
      "Enter one-card Review",
      "Show first review card copy",
    ])
    expect(ASTRA_SAMPLE_LESSON_STEPS[6]?.acceptance).toContain("You just created your first review card")
  })

  it("records first-success targets and privacy boundaries", () => {
    expect(ASTRA_FIRST_SUCCESS_METRICS.map((metric) => metric.id)).toEqual([
      "install_to_first_understood_seconds",
      "first_understanding_success_rate",
      "first_save_rate",
      "first_review_reach_rate",
      "day_after_first_use_return_rate",
    ])
    expect(ASTRA_FIRST_SUCCESS_METRICS.map((metric) => metric.target)).toEqual([
      "< 60 seconds",
      "> 95%",
      "> 25%",
      "> 15%",
      "Optimize by cohort after launch",
    ])
    for (const metric of ASTRA_FIRST_SUCCESS_METRICS) {
      expect(metric.privacyBoundary.toLowerCase()).toMatch(/no |only|aggregate/)
    }
  })

  it("uses canonical activation event names", () => {
    expect(ASTRA_FIRST_SUCCESS_EVENT_NAMES).toEqual([
      "onboarding_completed",
      "first_content_understood",
      "saved_snippet_created",
      "review_session_completed",
    ])
  })

  it("keeps first-success events consumed by the activation dashboard", () => {
    expect(ASTRA_FIRST_SUCCESS_EVENT_NAMES.every((event) => LEARNING_LOOP_ACTIVATION_EVENT_NAMES.includes(event))).toBe(true)

    const dashboard = aggregateLearningLoopActivationDashboard(
      ASTRA_FIRST_SUCCESS_EVENT_NAMES.map((event, index) => ({
        id: `first-success-${event}`,
        type: "feature_usage" as const,
        timestamp: 1_000 + index * 10,
        data: { feature: "learning_loop", event },
      })),
    )

    expect(dashboard.counts.onboarding_completed).toBe(1)
    expect(dashboard.counts.first_content_understood).toBe(1)
    expect(dashboard.counts.saved_snippet_created).toBe(1)
    expect(dashboard.counts.review_session_completed).toBe(1)
    expect(dashboard.firstValueCount).toBe(1)
    expect(dashboard.firstSaveCount).toBe(1)
    expect(dashboard.firstReviewCompletionCount).toBe(1)
  })

  it("defines the activation smoke evidence rows required before a current smoke report can support RC claims", () => {
    expect(ASTRA_FIRST_SUCCESS_SMOKE_EVIDENCE_ROWS.map((row) => row.id)).toEqual([
      "path_completed",
      "event_sequence_observed",
      "time_to_first_value_recorded",
      "content_free_telemetry_checked",
      "first_save_and_review_observed",
    ])
    expect(ASTRA_FIRST_SUCCESS_SMOKE_EVIDENCE_ROWS.every((row) => row.remainingReleaseProof.length > 20)).toBe(true)
  })

  it("evaluates activation smoke reports without accepting content-bearing telemetry", () => {
    expect(evaluateAstraFirstSuccessSmokeReport({
      observedEventNames: [...ASTRA_FIRST_SUCCESS_EVENT_NAMES],
      secondsToFirstContentUnderstood: 42,
      telemetryFieldNames: ["event", "sourceType", "durationMs", "success", "count"],
      savedItemCreated: true,
      reviewCompleted: true,
    })).toEqual({ ready: true, findings: [] })

    const failed = evaluateAstraFirstSuccessSmokeReport({
      observedEventNames: ["onboarding_completed", "first_content_understood"],
      secondsToFirstContentUnderstood: 75,
      telemetryFieldNames: ["event", "selectedText", "sourceType"],
      savedItemCreated: false,
      reviewCompleted: false,
    })
    expect(failed.ready).toBe(false)
    expect(failed.findings.map((finding) => finding.code)).toEqual([
      "missing_required_event",
      "missing_required_event",
      "over_sixty_seconds",
      "missing_first_save",
      "missing_first_review",
      "content_text_field_present",
    ])
  })

  it("passes readiness when first-success evidence exists", () => {
    const decision = evaluateAstraFirstSuccessReadiness(readyEvidence)
    expect(decision.ready).toBe(true)
    expect(decision.blockers).toEqual([])
    expect(decision.warnings).toEqual([])
  })

  it("blocks readiness when the core first-success path is not proven", () => {
    const decision = evaluateAstraFirstSuccessReadiness({
      ...readyEvidence,
      installToFirstUnderstoodUnder60Seconds: false,
      onboardingUsesOnlyThreeCoreQuestions: false,
      onboardingAvoidsTechnicalQuestions: false,
      samplePageEntryAvailable: false,
      sampleArticleShowsUnderstandableContent: false,
      recommendedSentenceCanBeSaved: false,
      oneCardReviewReachable: false,
      activationEventsRecorded: false,
      activationTelemetryAvoidsContent: false,
    })

    expect(decision.ready).toBe(false)
    expect(decision.blockers.map((finding) => finding.code)).toEqual([
      "under_sixty_seconds",
      "three_question_onboarding",
      "no_technical_onboarding",
      "sample_page_entry",
      "sample_article_understanding",
      "recommended_sentence_save",
      "one_card_review",
      "activation_events",
      "no_content_telemetry",
    ])
  })

  it("keeps achievement copy and numeric target evidence as warnings", () => {
    const decision = evaluateAstraFirstSuccessReadiness({
      ...readyEvidence,
      firstReviewCardCopyShown: false,
      firstUnderstandingSuccessRateTargetMet: false,
      firstSaveRateTargetMet: false,
      firstReviewReachTargetMet: false,
    })

    expect(decision.ready).toBe(true)
    expect(decision.warnings.map((finding) => finding.code)).toEqual([
      "first_review_card_copy",
      "success_rate_target",
      "first_save_target",
      "first_review_target",
    ])
  })
})
