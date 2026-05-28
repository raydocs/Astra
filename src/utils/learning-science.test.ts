import { describe, expect, it } from "vitest"

import {
  ASTRA_LEARNING_SCIENCE_PRINCIPLES,
  ASTRA_REVIEW_CARD_TYPES,
  ASTRA_REVIEW_DAILY_LIMITS,
  ASTRA_REVIEW_FEEDBACK,
  ASTRA_REVIEW_MASTERY_STATES,
  ASTRA_REVIEW_PRIORITIZATION_SIGNALS,
  ASTRA_REVIEW_SCHEDULING_RULES,
  evaluateAstraLearningScienceReadiness,
  type AstraLearningScienceReadinessEvidence,
} from "./learning-science"

const readyEvidence: AstraLearningScienceReadinessEvidence = {
  p0CardTypesAreSimple: true,
  masteryStatesAreSimple: true,
  feedbackIsSimple: true,
  defaultDailyReviewIsLight: true,
  saveCreatesReviewableCardQuickly: true,
  reviewCardsPreserveSourceContext: true,
  usersCanDeletePauseOrMasterCards: true,
  schedulingIsHiddenButExplainable: true,
  lowQualityCardsFallbackToSnippetOrSentence: true,
  copyAvoidsGuaranteedMasteryClaims: true,
}

describe("Astra learning science Review contract", () => {
  it("defines simple first-version card types with P0/P1/P2 priority", () => {
    expect(ASTRA_REVIEW_CARD_TYPES.map((cardType) => cardType.id)).toEqual([
      "word",
      "sentence",
      "cloze",
      "video_moment",
      "correction",
    ])
    expect(ASTRA_REVIEW_CARD_TYPES.filter((cardType) => cardType.priority === "P0").map((cardType) => cardType.id)).toEqual([
      "word",
      "sentence",
    ])
    expect(ASTRA_REVIEW_CARD_TYPES.find((cardType) => cardType.id === "sentence")?.generation).toContain("too long")
  })

  it("keeps macro default feedback and mastery states simple", () => {
    expect(ASTRA_REVIEW_FEEDBACK).toEqual(["again", "good", "easy"])
    expect(ASTRA_REVIEW_MASTERY_STATES.map((state) => state.id)).toEqual([
      "new",
      "learning",
      "familiar",
      "mastered",
      "suspended",
    ])
    expect(ASTRA_REVIEW_MASTERY_STATES.filter((state) => !state.queuesForDailyReview).map((state) => state.id)).toEqual([
      "mastered",
      "suspended",
    ])
  })

  it("defines hidden but explainable scheduling defaults", () => {
    expect(ASTRA_REVIEW_DAILY_LIMITS).toEqual({
      dailyLimitDefault: 5,
      maxNewCardsPerDayDefault: 3,
      ordinaryDailyGoalCopy: "3 minutes today",
      ordinaryCardRange: "3–5 cards",
    })
    expect(ASTRA_REVIEW_SCHEDULING_RULES.map((rule) => rule.feedback)).toEqual([
      "again",
      "good",
      "easy",
      "mastered",
    ])
    expect(ASTRA_REVIEW_SCHEDULING_RULES.find((rule) => rule.feedback === "again")?.nextInterval).toBe("short")
    expect(ASTRA_REVIEW_PRIORITIZATION_SIGNALS).toEqual([
      "due_again",
      "saved_from_recent_sources",
      "repeated_across_sources",
      "user_marked_important",
    ])
  })

  it("encodes learning principles without pseudoscience claims", () => {
    expect(ASTRA_LEARNING_SCIENCE_PRINCIPLES).toEqual([
      "Context first: review words and sentences from real sources, not isolated word lists.",
      "Low burden: default to about 3 minutes per day.",
      "Immediate feedback: after saving, tell the learner when review will happen.",
      "Explainable: users can understand why a card appears today.",
      "Reversible: users can delete, suspend, or mark cards mastered.",
      "No pseudoscience: promise help with review, not guaranteed mastery or exam outcomes.",
    ])
  })

  it("passes readiness when Review is light, source-backed, reversible, and honest", () => {
    const decision = evaluateAstraLearningScienceReadiness(readyEvidence)
    expect(decision.ready).toBe(true)
    expect(decision.blockers).toEqual([])
    expect(decision.warnings).toEqual([])
  })

  it("blocks readiness when Review loses simplicity, light goal, source, reversibility, fallbacks, or honesty", () => {
    const decision = evaluateAstraLearningScienceReadiness({
      ...readyEvidence,
      p0CardTypesAreSimple: false,
      masteryStatesAreSimple: false,
      defaultDailyReviewIsLight: false,
      saveCreatesReviewableCardQuickly: false,
      reviewCardsPreserveSourceContext: false,
      usersCanDeletePauseOrMasterCards: false,
      lowQualityCardsFallbackToSnippetOrSentence: false,
      copyAvoidsGuaranteedMasteryClaims: false,
    })

    expect(decision.ready).toBe(false)
    expect(decision.blockers.map((finding) => finding.code)).toEqual([
      "simple_card_types",
      "simple_mastery_states",
      "daily_light_goal",
      "immediate_review_card_after_save",
      "source_context_first",
      "editable_or_deletable",
      "quality_fallbacks",
      "no_pseudoscience_claims",
    ])
  })

  it("warns when feedback or scheduling explanation drifts from the macro default", () => {
    const decision = evaluateAstraLearningScienceReadiness({
      ...readyEvidence,
      feedbackIsSimple: false,
      schedulingIsHiddenButExplainable: false,
    })

    expect(decision.ready).toBe(true)
    expect(decision.warnings.map((finding) => finding.code)).toEqual([
      "simple_feedback",
      "scheduling_hidden_but_explainable",
    ])
  })
})
