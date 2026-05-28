export type AstraSaveFeedbackMessageId =
  | "saved_for_review_tonight"
  | "daily_card_progress"
  | "added_to_learning_queue"
  | "building_deck_from_page"
  | "review_later_one_minute"
  | "linked_to_source_page"

export type AstraLightGoalId = "save_1_to_3_expressions" | "review_3_to_5_cards" | "weekly_summary"

export type AstraReviewContextFieldId =
  | "original_sentence"
  | "translation"
  | "explanation"
  | "source_title"
  | "source_type"
  | "original_page_url"
  | "video_timestamp"
  | "saved_date"
  | "context_paragraph"

export type AstraLearningLoopReadinessCode =
  | "save_feedback_not_black_hole"
  | "save_feedback_next_review"
  | "save_feedback_queue"
  | "save_feedback_source_link"
  | "daily_save_goal_light"
  | "daily_review_goal_light"
  | "weekly_summary_goal"
  | "review_context_fields"
  | "review_returns_to_source"
  | "progress_visible"
  | "real_content_framing"

export interface AstraSaveFeedbackDefinition {
  id: AstraSaveFeedbackMessageId
  copy: string
  purpose: string
}

export interface AstraLightGoalDefinition {
  id: AstraLightGoalId
  label: string
  target: string
  userCopy: string
}

export interface AstraReviewContextFieldDefinition {
  id: AstraReviewContextFieldId
  label: string
  requiredForP0: boolean
  privacyBoundary: string
}

export interface AstraLearningLoopReadinessEvidence {
  saveFeedbackExplainsDestination: boolean
  saveFeedbackExplainsNextReview: boolean
  saveFeedbackExplainsQueueProgress: boolean
  saveFeedbackLinksToSource: boolean
  dailySaveGoalIsLight: boolean
  dailyReviewGoalIsLight: boolean
  weeklySummaryVisible: boolean
  reviewCardsCarryContextFields: boolean
  reviewCanReturnToSource: boolean
  learnerProgressVisible: boolean
  reviewFeelsLikeRealContent: boolean
}

export interface AstraLearningLoopFinding {
  code: AstraLearningLoopReadinessCode
  severity: "block" | "warn"
  message: string
  nextStep: string
}

export interface AstraLearningLoopDecision {
  ready: boolean
  blockers: AstraLearningLoopFinding[]
  warnings: AstraLearningLoopFinding[]
  findings: AstraLearningLoopFinding[]
}

export const ASTRA_SAVE_FEEDBACK_MESSAGES: AstraSaveFeedbackDefinition[] = [
  { id: "saved_for_review_tonight", copy: "Saved for review tonight", purpose: "Tell users the saved item has a review destination." },
  { id: "daily_card_progress", copy: "1 of 5 cards for today", purpose: "Make daily review progress visible." },
  { id: "added_to_learning_queue", copy: "Added to your learning queue", purpose: "Show that saving feeds a learning queue instead of a black hole." },
  { id: "building_deck_from_page", copy: "You are building a deck from this page", purpose: "Connect the saved item to the current source." },
  { id: "review_later_one_minute", copy: "Review this later in 1 minute", purpose: "Set an immediate lightweight review expectation." },
  { id: "linked_to_source_page", copy: "This sentence is now linked to the source page", purpose: "Confirm source context was preserved." },
]

export const ASTRA_LIGHT_LEARNING_GOALS: AstraLightGoalDefinition[] = [
  { id: "save_1_to_3_expressions", label: "Daily useful-expression save goal", target: "1–3 expressions per day", userCopy: "Save one useful expression" },
  { id: "review_3_to_5_cards", label: "Daily Review goal", target: "3–5 cards per day", userCopy: "Review 5 cards" },
  { id: "weekly_summary", label: "Weekly learning summary", target: "one summary per week", userCopy: "You learned 8 expressions this week" },
]

export const ASTRA_LIGHT_GOAL_COPY = [
  "3 minutes today",
  "Review 5 cards",
  "Done for today",
  "You learned 8 expressions this week",
] as const

export const ASTRA_REVIEW_CONTEXT_FIELDS: AstraReviewContextFieldDefinition[] = [
  { id: "original_sentence", label: "Original sentence", requiredForP0: true, privacyBoundary: "Stored only as the saved snippet/card text chosen by the user." },
  { id: "translation", label: "Translation", requiredForP0: true, privacyBoundary: "Card-level learning content, not telemetry." },
  { id: "explanation", label: "Explanation", requiredForP0: true, privacyBoundary: "Card-level learning content, not telemetry." },
  { id: "source_title", label: "Source title", requiredForP0: true, privacyBoundary: "Title/source metadata only." },
  { id: "source_type", label: "Source type", requiredForP0: true, privacyBoundary: "Coarse type such as page, video, pdf, epub, subtitle, or sample." },
  { id: "original_page_url", label: "Original page link", requiredForP0: false, privacyBoundary: "User-visible return link; telemetry should not store full URL by default." },
  { id: "video_timestamp", label: "Video timestamp", requiredForP0: false, privacyBoundary: "Timestamp/moment metadata only." },
  { id: "saved_date", label: "Saved date", requiredForP0: true, privacyBoundary: "Timestamp metadata." },
  { id: "context_paragraph", label: "Context paragraph", requiredForP0: false, privacyBoundary: "Optional user-visible learning context; not default telemetry." },
]

const READINESS_CHECKS: Array<{
  code: AstraLearningLoopReadinessCode
  evidenceKey: keyof AstraLearningLoopReadinessEvidence
  severity: "block" | "warn"
  message: string
  nextStep: string
}> = [
  { code: "save_feedback_not_black_hole", evidenceKey: "saveFeedbackExplainsDestination", severity: "block", message: "Save feedback does not explain where the item went.", nextStep: "Show that the item was added to Review/Library/learning queue." },
  { code: "save_feedback_next_review", evidenceKey: "saveFeedbackExplainsNextReview", severity: "block", message: "Save feedback does not explain when or how review happens.", nextStep: "Add review timing or next-card copy after save." },
  { code: "save_feedback_queue", evidenceKey: "saveFeedbackExplainsQueueProgress", severity: "warn", message: "Save feedback does not show queue or daily progress.", nextStep: "Show daily card progress such as 1 of 5 cards for today." },
  { code: "save_feedback_source_link", evidenceKey: "saveFeedbackLinksToSource", severity: "block", message: "Save feedback does not confirm source linkage.", nextStep: "Confirm saved sentence/source page linkage after save." },
  { code: "daily_save_goal_light", evidenceKey: "dailySaveGoalIsLight", severity: "warn", message: "Daily save goal is not kept light.", nextStep: "Default to 1–3 useful expressions per day." },
  { code: "daily_review_goal_light", evidenceKey: "dailyReviewGoalIsLight", severity: "block", message: "Daily Review goal is not kept light.", nextStep: "Default ordinary Review to roughly 3–5 cards or the learner's daily time budget." },
  { code: "weekly_summary_goal", evidenceKey: "weeklySummaryVisible", severity: "warn", message: "Weekly summary value is not visible.", nextStep: "Show a weekly learning summary or local digest entry point." },
  { code: "review_context_fields", evidenceKey: "reviewCardsCarryContextFields", severity: "block", message: "Review cards do not carry enough source context.", nextStep: "Preserve original sentence, translation, explanation, source title/type, saved date, and available return context." },
  { code: "review_returns_to_source", evidenceKey: "reviewCanReturnToSource", severity: "block", message: "Review does not support return-to-source behavior.", nextStep: "Preserve page/source/video moment references when available." },
  { code: "progress_visible", evidenceKey: "learnerProgressVisible", severity: "warn", message: "Learner progress is not visible.", nextStep: "Show Done for today, weekly learned count, or review progress copy." },
  { code: "real_content_framing", evidenceKey: "reviewFeelsLikeRealContent", severity: "block", message: "Review feels like isolated flashcards rather than real content the user read or watched.", nextStep: "Display source/context framing in Review and Library." },
]

export function evaluateAstraLearningLoopReadiness(evidence: AstraLearningLoopReadinessEvidence): AstraLearningLoopDecision {
  const findings = READINESS_CHECKS
    .filter((check) => !evidence[check.evidenceKey])
    .map<AstraLearningLoopFinding>((check) => ({
      code: check.code,
      severity: check.severity,
      message: check.message,
      nextStep: check.nextStep,
    }))
  const blockers = findings.filter((finding) => finding.severity === "block")
  const warnings = findings.filter((finding) => finding.severity === "warn")
  return { ready: blockers.length === 0, blockers, warnings, findings }
}
