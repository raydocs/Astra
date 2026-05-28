export type AstraReviewCardTypeId = "word" | "sentence" | "cloze" | "video_moment" | "correction"

export type AstraReviewFeedbackId = "again" | "good" | "easy"

export type AstraReviewMasteryStateId = "new" | "learning" | "familiar" | "mastered" | "suspended"

export type AstraReviewSchedulingFeedbackId = "again" | "good" | "easy" | "mastered"

export type AstraReviewPrioritizationSignalId =
  | "due_again"
  | "saved_from_recent_sources"
  | "repeated_across_sources"
  | "user_marked_important"

export type AstraLearningScienceReadinessCode =
  | "simple_card_types"
  | "simple_mastery_states"
  | "simple_feedback"
  | "daily_light_goal"
  | "immediate_review_card_after_save"
  | "source_context_first"
  | "editable_or_deletable"
  | "scheduling_hidden_but_explainable"
  | "quality_fallbacks"
  | "no_pseudoscience_claims"

export interface AstraReviewCardTypeDefinition {
  id: AstraReviewCardTypeId
  label: string
  appliesTo: string
  front: string
  back: string
  generation: string
  priority: "P0" | "P1" | "P2"
}

export interface AstraReviewMasteryStateDefinition {
  id: AstraReviewMasteryStateId
  meaning: string
  queuesForDailyReview: boolean
}

export interface AstraReviewSchedulingRule {
  feedback: AstraReviewSchedulingFeedbackId
  nextInterval: "short" | "medium" | "long" | "low_frequency"
  userCopy: string
  nextState: AstraReviewMasteryStateId | "familiar_or_mastered"
}

export interface AstraLearningScienceReadinessEvidence {
  p0CardTypesAreSimple: boolean
  masteryStatesAreSimple: boolean
  feedbackIsSimple: boolean
  defaultDailyReviewIsLight: boolean
  saveCreatesReviewableCardQuickly: boolean
  reviewCardsPreserveSourceContext: boolean
  usersCanDeletePauseOrMasterCards: boolean
  schedulingIsHiddenButExplainable: boolean
  lowQualityCardsFallbackToSnippetOrSentence: boolean
  copyAvoidsGuaranteedMasteryClaims: boolean
}

export interface AstraLearningScienceReadinessFinding {
  code: AstraLearningScienceReadinessCode
  severity: "block" | "warn"
  message: string
  nextStep: string
}

export interface AstraLearningScienceReadinessDecision {
  ready: boolean
  blockers: AstraLearningScienceReadinessFinding[]
  warnings: AstraLearningScienceReadinessFinding[]
  findings: AstraLearningScienceReadinessFinding[]
}

export const ASTRA_REVIEW_CARD_TYPES: AstraReviewCardTypeDefinition[] = [
  {
    id: "word",
    label: "Word Card",
    appliesTo: "word or short phrase",
    front: "source word plus optional cloze sentence",
    back: "meaning, example, and source",
    generation: "created when a word is saved",
    priority: "P0",
  },
  {
    id: "sentence",
    label: "Sentence Card",
    appliesTo: "saved sentence or expression",
    front: "original sentence",
    back: "translation, explanation, and key expression",
    generation: "created when a sentence is saved or when AI card output is too long",
    priority: "P0",
  },
  {
    id: "cloze",
    label: "Cloze Card",
    appliesTo: "key collocation or expression",
    front: "sentence with blank",
    back: "answer and explanation",
    generation: "AI-suggested after quality checks",
    priority: "P1",
  },
  {
    id: "video_moment",
    label: "Video Moment Card",
    appliesTo: "saved video sentence or timestamp",
    front: "sentence plus timestamp",
    back: "translation, explanation, and jump link",
    generation: "created when a video moment is saved",
    priority: "P1",
  },
  {
    id: "correction",
    label: "Correction Card",
    appliesTo: "writing correction",
    front: "user sentence",
    back: "natural expression and why",
    generation: "created after input assistance when the user saves it",
    priority: "P2",
  },
]

export const ASTRA_REVIEW_FEEDBACK: AstraReviewFeedbackId[] = ["again", "good", "easy"]

export const ASTRA_REVIEW_MASTERY_STATES: AstraReviewMasteryStateDefinition[] = [
  { id: "new", meaning: "User just saved the item and has not reviewed it yet.", queuesForDailyReview: true },
  { id: "learning", meaning: "User missed it or has just started learning it.", queuesForDailyReview: true },
  { id: "familiar", meaning: "User has answered Good enough to be short-term familiar.", queuesForDailyReview: true },
  { id: "mastered", meaning: "User has answered Easy repeatedly or stayed stable long enough for low-frequency review.", queuesForDailyReview: false },
  { id: "suspended", meaning: "User manually paused the card and it no longer enters daily review.", queuesForDailyReview: false },
]

export const ASTRA_REVIEW_SCHEDULING_RULES: AstraReviewSchedulingRule[] = [
  { feedback: "again", nextInterval: "short", userCopy: "Review again soon because it was difficult.", nextState: "learning" },
  { feedback: "good", nextInterval: "medium", userCopy: "Review in a few days because you remembered it today.", nextState: "familiar" },
  { feedback: "easy", nextInterval: "long", userCopy: "Review later because this felt easy.", nextState: "familiar_or_mastered" },
  { feedback: "mastered", nextInterval: "low_frequency", userCopy: "Keep it for occasional review.", nextState: "mastered" },
]

export const ASTRA_REVIEW_DAILY_LIMITS = {
  dailyLimitDefault: 5,
  maxNewCardsPerDayDefault: 3,
  ordinaryDailyGoalCopy: "3 minutes today",
  ordinaryCardRange: "3–5 cards",
} as const

export const ASTRA_REVIEW_PRIORITIZATION_SIGNALS: AstraReviewPrioritizationSignalId[] = [
  "due_again",
  "saved_from_recent_sources",
  "repeated_across_sources",
  "user_marked_important",
]

export const ASTRA_LEARNING_SCIENCE_PRINCIPLES = [
  "Context first: review words and sentences from real sources, not isolated word lists.",
  "Low burden: default to about 3 minutes per day.",
  "Immediate feedback: after saving, tell the learner when review will happen.",
  "Explainable: users can understand why a card appears today.",
  "Reversible: users can delete, suspend, or mark cards mastered.",
  "No pseudoscience: promise help with review, not guaranteed mastery or exam outcomes.",
] as const

const READINESS_CHECKS: Array<{
  code: AstraLearningScienceReadinessCode
  evidenceKey: keyof AstraLearningScienceReadinessEvidence
  severity: "block" | "warn"
  message: string
  nextStep: string
}> = [
  { code: "simple_card_types", evidenceKey: "p0CardTypesAreSimple", severity: "block", message: "Review card types are not simple enough for the first implementation.", nextStep: "Keep Word and Sentence P0, Cloze/Video Moment P1, Correction P2; avoid a course/deck system." },
  { code: "simple_mastery_states", evidenceKey: "masteryStatesAreSimple", severity: "block", message: "Mastery states are not simple or visible enough.", nextStep: "Use New, Learning, Familiar, Mastered, and Suspended states." },
  { code: "simple_feedback", evidenceKey: "feedbackIsSimple", severity: "warn", message: "Review feedback is more complex than the macro default.", nextStep: "Keep the learner-facing default centered on Again, Good, and Easy; any compatibility feedback must stay secondary." },
  { code: "daily_light_goal", evidenceKey: "defaultDailyReviewIsLight", severity: "block", message: "Default Review is not light enough.", nextStep: "Default ordinary Review to about 3–5 cards / 3 minutes and cap overdue queues." },
  { code: "immediate_review_card_after_save", evidenceKey: "saveCreatesReviewableCardQuickly", severity: "block", message: "Saving does not quickly create a reviewable card or equivalent feedback.", nextStep: "Create a ReviewCard within the save flow or preserve as Snippet with clear fallback feedback." },
  { code: "source_context_first", evidenceKey: "reviewCardsPreserveSourceContext", severity: "block", message: "Review cards are not source-backed.", nextStep: "Preserve source title/type/link/timestamp or position for P0 cards." },
  { code: "editable_or_deletable", evidenceKey: "usersCanDeletePauseOrMasterCards", severity: "block", message: "Users cannot delete, suspend, or mark cards mastered.", nextStep: "Expose reversible card controls before claiming a trustworthy Review system." },
  { code: "scheduling_hidden_but_explainable", evidenceKey: "schedulingIsHiddenButExplainable", severity: "warn", message: "Scheduling is either too exposed or not explainable.", nextStep: "Hide algorithm parameters but explain cards with copy like ‘because you saved this recently’." },
  { code: "quality_fallbacks", evidenceKey: "lowQualityCardsFallbackToSnippetOrSentence", severity: "block", message: "Low-quality or overlong generated cards do not have safe fallbacks.", nextStep: "Save as Snippet instead of forcing Review, or downgrade overlong AI output to a Sentence Card." },
  { code: "no_pseudoscience_claims", evidenceKey: "copyAvoidsGuaranteedMasteryClaims", severity: "block", message: "Learning copy overpromises mastery or exam outcomes.", nextStep: "Promise help with review and source return, not guaranteed fluency, mastery, or test results." },
]

export function evaluateAstraLearningScienceReadiness(evidence: AstraLearningScienceReadinessEvidence): AstraLearningScienceReadinessDecision {
  const findings = READINESS_CHECKS
    .filter((check) => !evidence[check.evidenceKey])
    .map<AstraLearningScienceReadinessFinding>((check) => ({
      code: check.code,
      severity: check.severity,
      message: check.message,
      nextStep: check.nextStep,
    }))
  const blockers = findings.filter((finding) => finding.severity === "block")
  const warnings = findings.filter((finding) => finding.severity === "warn")
  return { ready: blockers.length === 0, blockers, warnings, findings }
}
