import { describe, expect, it } from "vitest"

import {
  ASTRA_LIGHT_GOAL_COPY,
  ASTRA_LIGHT_LEARNING_GOALS,
  ASTRA_REVIEW_CONTEXT_FIELDS,
  ASTRA_SAVE_FEEDBACK_MESSAGES,
  evaluateAstraLearningLoopReadiness,
  type AstraLearningLoopReadinessEvidence,
} from "./learning-loop-experience"

const readyEvidence: AstraLearningLoopReadinessEvidence = {
  saveFeedbackExplainsDestination: true,
  saveFeedbackExplainsNextReview: true,
  saveFeedbackExplainsQueueProgress: true,
  saveFeedbackLinksToSource: true,
  dailySaveGoalIsLight: true,
  dailyReviewGoalIsLight: true,
  weeklySummaryVisible: true,
  reviewCardsCarryContextFields: true,
  reviewCanReturnToSource: true,
  learnerProgressVisible: true,
  reviewFeelsLikeRealContent: true,
}

describe("Astra learning-loop experience contract", () => {
  it("defines productized save feedback so saving is not a black hole", () => {
    expect(ASTRA_SAVE_FEEDBACK_MESSAGES.map((message) => message.copy)).toEqual([
      "Saved for review tonight",
      "1 of 5 cards for today",
      "Added to your learning queue",
      "You are building a deck from this page",
      "Review this later in 1 minute",
      "This sentence is now linked to the source page",
    ])
  })

  it("keeps ordinary learning goals lightweight", () => {
    expect(ASTRA_LIGHT_LEARNING_GOALS.map((goal) => goal.target)).toEqual([
      "1–3 expressions per day",
      "3–5 cards per day",
      "one summary per week",
    ])
    expect(ASTRA_LIGHT_GOAL_COPY).toEqual([
      "3 minutes today",
      "Review 5 cards",
      "Done for today",
      "You learned 8 expressions this week",
    ])
  })

  it("defines the Review context fields that make cards feel like real content", () => {
    expect(ASTRA_REVIEW_CONTEXT_FIELDS.map((field) => field.id)).toEqual([
      "original_sentence",
      "translation",
      "explanation",
      "source_title",
      "source_type",
      "original_page_url",
      "video_timestamp",
      "saved_date",
      "context_paragraph",
    ])
    expect(ASTRA_REVIEW_CONTEXT_FIELDS.filter((field) => field.requiredForP0).map((field) => field.id)).toEqual([
      "original_sentence",
      "translation",
      "explanation",
      "source_title",
      "source_type",
      "saved_date",
    ])
  })

  it("passes readiness when save feedback, light goals, context, return, and progress evidence exist", () => {
    const decision = evaluateAstraLearningLoopReadiness(readyEvidence)
    expect(decision.ready).toBe(true)
    expect(decision.blockers).toEqual([])
    expect(decision.warnings).toEqual([])
  })

  it("blocks readiness when the loop loses destination, next review, source link, context, or return path", () => {
    const decision = evaluateAstraLearningLoopReadiness({
      ...readyEvidence,
      saveFeedbackExplainsDestination: false,
      saveFeedbackExplainsNextReview: false,
      saveFeedbackLinksToSource: false,
      dailyReviewGoalIsLight: false,
      reviewCardsCarryContextFields: false,
      reviewCanReturnToSource: false,
      reviewFeelsLikeRealContent: false,
    })

    expect(decision.ready).toBe(false)
    expect(decision.blockers.map((finding) => finding.code)).toEqual([
      "save_feedback_not_black_hole",
      "save_feedback_next_review",
      "save_feedback_source_link",
      "daily_review_goal_light",
      "review_context_fields",
      "review_returns_to_source",
      "real_content_framing",
    ])
  })

  it("keeps queue progress, daily save goal, weekly summary, and progress visibility as warnings", () => {
    const decision = evaluateAstraLearningLoopReadiness({
      ...readyEvidence,
      saveFeedbackExplainsQueueProgress: false,
      dailySaveGoalIsLight: false,
      weeklySummaryVisible: false,
      learnerProgressVisible: false,
    })

    expect(decision.ready).toBe(true)
    expect(decision.warnings.map((finding) => finding.code)).toEqual([
      "save_feedback_queue",
      "daily_save_goal_light",
      "weekly_summary_goal",
      "progress_visible",
    ])
  })
})
