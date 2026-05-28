import type { LearningProfile, LearningProfileGoal } from "@/utils/storage/learning-profile"
import type { VocabularyEntry } from "@/utils/storage/vocabulary"

export type AstraPersonalizationProfileFieldId =
  | "target_language"
  | "current_level"
  | "learning_purpose"
  | "explanation_preference"
  | "daily_learning_time"

export type AstraLearningPurposeId =
  | "understand_web_pages"
  | "understand_videos"
  | "work_study"
  | "exam_prep"
  | "interest_reading"
  | "build_vocabulary"

export type AstraPersonalizedBehaviorId =
  | "explanation_depth"
  | "grammar_visibility"
  | "save_recommendations"
  | "review_difficulty"
  | "summary_style"
  | "terminology_explanation"
  | "listening_shadowing_recommendations"
  | "daily_goal_size"

export type AstraGlossarySignalId =
  | "saved_terms"
  | "user_corrections"
  | "site_common_terms"
  | "proper_nouns"
  | "people_product_technical_terms"

export type AstraPersonalizationControlId =
  | "view_remembered_terms"
  | "delete_preference"
  | "disable_personalization"
  | "exclude_site"

export type AstraPersonalizationReadinessCode =
  | "lightweight_profile_only"
  | "reduces_configuration"
  | "behavior_influence_coverage"
  | "glossary_signal_coverage"
  | "simple_glossary_copy"
  | "view_memory_control"
  | "delete_preference_control"
  | "disable_personalization_control"
  | "exclude_site_control"
  | "write_policy_respects_privacy"

export interface AstraPersonalizationProfileFieldDefinition {
  id: AstraPersonalizationProfileFieldId
  label: string
  whyNeeded: string
  defaultUserBurden: "onboarding" | "settings" | "inferred_after_confirmation"
}

export interface AstraLearningPurposeDefinition {
  id: AstraLearningPurposeId
  label: string
  behaviorHint: string
}

export interface AstraPersonalizedBehaviorDefinition {
  id: AstraPersonalizedBehaviorId
  label: string
  exampleEffect: string
}

export interface AstraGlossarySignalDefinition {
  id: AstraGlossarySignalId
  label: string
  allowedWhen: string
  userVisibleCopy: string
}

export interface AstraPersonalizationControlDefinition {
  id: AstraPersonalizationControlId
  label: string
  requiredForP0: boolean
}

export interface AstraPersonalizationReadinessEvidence {
  collectsOnlyLightweightProfileFields: boolean
  defaultExperienceReducesExplicitSettings: boolean
  profileInfluencesRequiredBehaviors: boolean
  glossaryLearnsFromAllowedSignals: boolean
  glossaryUsesSimpleUserCopy: boolean
  usersCanViewRememberedTerms: boolean
  usersCanDeletePreferenceOrTerm: boolean
  usersCanDisablePersonalization: boolean
  usersCanExcludeSite: boolean
  writePolicyRespectsPrivacyModeAndSiteExclusions: boolean
}

export interface AstraPersonalizationReadinessFinding {
  code: AstraPersonalizationReadinessCode
  severity: "block" | "warn"
  message: string
  nextStep: string
}

export interface AstraPersonalizationReadinessDecision {
  ready: boolean
  blockers: AstraPersonalizationReadinessFinding[]
  warnings: AstraPersonalizationReadinessFinding[]
  findings: AstraPersonalizationReadinessFinding[]
}

export const ASTRA_PERSONALIZATION_PROFILE_FIELDS: AstraPersonalizationProfileFieldDefinition[] = [
  { id: "target_language", label: "Target language", whyNeeded: "Choose translation/explanation target language.", defaultUserBurden: "onboarding" },
  { id: "current_level", label: "Current level", whyNeeded: "Tune explanation depth and review difficulty.", defaultUserBurden: "onboarding" },
  { id: "learning_purpose", label: "Learning purpose", whyNeeded: "Adapt examples, summaries, and next-best actions.", defaultUserBurden: "onboarding" },
  { id: "explanation_preference", label: "Explanation preference", whyNeeded: "Choose concise, deep, exam, or bilingual explanation style.", defaultUserBurden: "settings" },
  { id: "daily_learning_time", label: "Daily learning time", whyNeeded: "Size Review and daily goals without making users plan sessions manually.", defaultUserBurden: "settings" },
]

export const ASTRA_LEARNING_PURPOSES: AstraLearningPurposeDefinition[] = [
  { id: "understand_web_pages", label: "Understand web pages", behaviorHint: "Prioritize page explanations and save-worthy sentence suggestions." },
  { id: "understand_videos", label: "Understand videos", behaviorHint: "Prioritize transcript moments, listening hints, and timestamp return paths." },
  { id: "work_study", label: "Work and study", behaviorHint: "Favor precise terminology, concise summaries, and source-backed notes." },
  { id: "exam_prep", label: "Exam", behaviorHint: "Favor grammar visibility, reusable review cards, and difficulty cues." },
  { id: "interest_reading", label: "Interest reading", behaviorHint: "Favor lightweight explanations and continue-reading prompts." },
  { id: "build_vocabulary", label: "Build vocabulary", behaviorHint: "Favor term explanations, save prompts, and glossary visibility." },
]

export const ASTRA_PERSONALIZED_BEHAVIORS: AstraPersonalizedBehaviorDefinition[] = [
  { id: "explanation_depth", label: "Explanation depth", exampleEffect: "Beginner users see simpler explanations; advanced users can get nuance faster." },
  { id: "grammar_visibility", label: "Grammar visibility", exampleEffect: "Grammar appears when useful for exam/vocabulary goals instead of being always on." },
  { id: "save_recommendations", label: "Save recommendations", exampleEffect: "Astra recommends saving sentences or terms that match the learner's goal." },
  { id: "review_difficulty", label: "Review difficulty", exampleEffect: "Review cards and grading hints reflect level and prior performance." },
  { id: "summary_style", label: "Summary style", exampleEffect: "Work/study summaries are concise; interest-reading summaries can stay lighter." },
  { id: "terminology_explanation", label: "Terminology explanation", exampleEffect: "Technical terms and preferred translations are explained consistently." },
  { id: "listening_shadowing_recommendations", label: "Listening / shadowing recommendations", exampleEffect: "Video learners can receive listening or follow-along prompts when available." },
  { id: "daily_goal_size", label: "Daily goal size", exampleEffect: "Review and save prompts match the learner's daily time budget." },
]

export const ASTRA_GLOSSARY_SIGNALS: AstraGlossarySignalDefinition[] = [
  { id: "saved_terms", label: "Saved terms", allowedWhen: "User intentionally saves the term.", userVisibleCopy: "Astra remembered your preferred terms." },
  { id: "user_corrections", label: "Corrections and preferred translations", allowedWhen: "User corrects or confirms a preferred translation.", userVisibleCopy: "Astra remembered your preferred terms." },
  { id: "site_common_terms", label: "Site common terms", allowedWhen: "Personalization is enabled and the site is not excluded.", userVisibleCopy: "Astra remembered your preferred terms." },
  { id: "proper_nouns", label: "Proper nouns", allowedWhen: "The user confirms or saves the term in a learning context.", userVisibleCopy: "Astra remembered your preferred terms." },
  { id: "people_product_technical_terms", label: "People, product, and technical terms", allowedWhen: "The term is useful for learning and allowed by the write policy.", userVisibleCopy: "Astra remembered your preferred terms." },
]

export const ASTRA_PERSONALIZATION_CONTROLS: AstraPersonalizationControlDefinition[] = [
  { id: "view_remembered_terms", label: "See what Astra remembers", requiredForP0: true },
  { id: "delete_preference", label: "Delete a remembered term or preference", requiredForP0: true },
  { id: "disable_personalization", label: "Turn off personalization", requiredForP0: true },
  { id: "exclude_site", label: "Do not learn preferences on this site", requiredForP0: true },
]

export const ASTRA_PERSONALIZATION_DEFAULT_COPY = [
  "Astra remembered your preferred terms.",
  "What Astra remembers",
  "Forget this term",
  "Turn off personalization",
  "Do not learn from this site",
] as const

export interface AstraPersonalizedReviewPlan {
  cards: VocabularyEntry[]
  profileApplied: boolean
  goalLabel: string
  headline: string
  detail: string
  evidence: string
  reversibleCopy: string
  dailyLimit: number | null
}

const LEARNING_PROFILE_GOAL_LABELS: Record<LearningProfileGoal, string> = {
  read_articles_docs: "Read articles and docs",
  watch_tutorials: "Watch videos",
  save_expressions: "Save useful expressions",
  work_study: "Work and study",
  exam_prep: "Exam prep",
  interest_reading: "Interest reading",
  build_vocabulary: "Build vocabulary",
}

const LANGUAGE_LEVEL_LABELS: Record<LearningProfile["languageLevel"], string> = {
  beginner: "beginner",
  intermediate: "intermediate",
  advanced: "advanced",
}

const EXPLAIN_MODE_LABELS: Record<LearningProfile["explainMode"], string> = {
  beginner: "plain explanations",
  exam: "exam-style explanations",
  deep: "deep-reading explanations",
}

const REVIEW_CARDS_PER_DAILY_GOAL_MINUTE = 1

export function derivePersonalizedReviewCardLimit(dailyGoalMinutes: number | null | undefined): number {
  const minutes = Number.isFinite(dailyGoalMinutes) ? Number(dailyGoalMinutes) : 5
  return Math.max(1, Math.min(60, Math.floor(minutes)) * REVIEW_CARDS_PER_DAILY_GOAL_MINUTE)
}

function reviewGoalAffinityScore(entry: VocabularyEntry, goal: LearningProfileGoal): number {
  const surface = entry.sourceContext?.surface
  const ownedType = entry.sourceContext?.ownedReadingSourceType
  const url = entry.sourceContext?.pageUrl ?? entry.url ?? ""
  const isArticleLike = surface === "popup_deep_read" || ownedType === "article" || /^https?:\/\//i.test(url)
  const isVideoLike = surface === "video_transcript" || surface === "subtitle_reader" || ownedType === "subtitle-file"
  const isFileLike = ownedType === "pdf" || ownedType === "epub" || ownedType === "subtitle-file" || /\.(pdf|epub|srt|vtt)(?:[?#]|$)/i.test(url)
  const hasSentence = Boolean(entry.sourceContext?.sentenceText?.trim() || entry.context?.trim())
  const hasGlossarySignal = Boolean(entry.glossaryEnabled || entry.glossaryTargetText?.trim() || (entry.sourceContext?.matchedGlossaryTerms?.length ?? 0) > 0)

  switch (goal) {
    case "watch_tutorials":
      return isVideoLike ? 4 : 0
    case "read_articles_docs":
      return isArticleLike || isFileLike ? 3 : 0
    case "save_expressions":
    case "build_vocabulary":
      return hasSentence ? 3 : 0
    case "work_study":
      return hasGlossarySignal ? 4 : isArticleLike || isFileLike ? 2 : 0
    case "exam_prep":
      return (entry.srsBox ?? 1) <= 2 ? 3 : 0
    case "interest_reading":
      return isArticleLike ? 3 : 0
  }
}

export function orderReviewQueueForLearningProfile(cards: VocabularyEntry[], profile: LearningProfile | null | undefined): VocabularyEntry[] {
  if (!profile?.personalizationEnabled) return [...cards]

  return cards
    .map((card, index) => ({ card, index, score: reviewGoalAffinityScore(card, profile.primaryGoal) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ card }) => card)
}

export function buildPersonalizedReviewPlan(cards: VocabularyEntry[], profile: LearningProfile | null | undefined): AstraPersonalizedReviewPlan {
  if (!profile?.personalizationEnabled) {
    return {
      cards: [...cards],
      profileApplied: false,
      goalLabel: "Default review",
      headline: "Default review queue",
      detail: "Personalization is off, so Review uses the normal due-card order and does not apply profile-based queue sizing.",
      evidence: `${cards.length} due ${cards.length === 1 ? "card" : "cards"} available`,
      reversibleCopy: "Turn personalization back on in Options → General → Learning profile.",
      dailyLimit: null,
    }
  }

  const orderedCards = orderReviewQueueForLearningProfile(cards, profile)
  const dailyLimit = derivePersonalizedReviewCardLimit(profile.dailyGoalMinutes)
  const queuedCards = orderedCards.slice(0, dailyLimit)
  const goalLabel = LEARNING_PROFILE_GOAL_LABELS[profile.primaryGoal]

  return {
    cards: queuedCards,
    profileApplied: true,
    goalLabel,
    headline: `Personalized review: ${goalLabel}`,
    detail: `${queuedCards.length}-card session shaped by ${profile.dailyGoalMinutes} min/day, ${LANGUAGE_LEVEL_LABELS[profile.languageLevel]} level, and ${EXPLAIN_MODE_LABELS[profile.explainMode]}.`,
    evidence: `${cards.length} due ${cards.length === 1 ? "card" : "cards"} → ${queuedCards.length} queued for this session`,
    reversibleCopy: "Change the goal, daily time, or turn personalization off in Options → General → Learning profile.",
    dailyLimit,
  }
}

const READINESS_CHECKS: Array<{
  code: AstraPersonalizationReadinessCode
  evidenceKey: keyof AstraPersonalizationReadinessEvidence
  severity: "block" | "warn"
  message: string
  nextStep: string
}> = [
  { code: "lightweight_profile_only", evidenceKey: "collectsOnlyLightweightProfileFields", severity: "block", message: "Personalization collects more than the lightweight profile required by the macro plan.", nextStep: "Limit default profile fields to target language, level, purpose, explanation preference, and daily learning time." },
  { code: "reduces_configuration", evidenceKey: "defaultExperienceReducesExplicitSettings", severity: "warn", message: "Personalization adds visible configuration instead of reducing setup.", nextStep: "Move defaults toward automatic adaptation and keep advanced choices secondary." },
  { code: "behavior_influence_coverage", evidenceKey: "profileInfluencesRequiredBehaviors", severity: "block", message: "Profile preferences do not influence the required product behaviors.", nextStep: "Apply preferences to explanation depth, grammar visibility, save recommendations, Review difficulty, summaries, terminology, listening prompts, and daily goal size." },
  { code: "glossary_signal_coverage", evidenceKey: "glossaryLearnsFromAllowedSignals", severity: "block", message: "Personal Glossary signals are missing or not bounded.", nextStep: "Support saved terms, corrections, site terms, proper nouns, and people/product/technical terms under explicit write policy." },
  { code: "simple_glossary_copy", evidenceKey: "glossaryUsesSimpleUserCopy", severity: "warn", message: "Glossary copy is too technical or asks users to manage a complex glossary.", nextStep: "Use ordinary copy such as ‘Astra remembered your preferred terms.’" },
  { code: "view_memory_control", evidenceKey: "usersCanViewRememberedTerms", severity: "block", message: "Users cannot see what Astra remembered.", nextStep: "Expose a memory inventory or remembered-terms list." },
  { code: "delete_preference_control", evidenceKey: "usersCanDeletePreferenceOrTerm", severity: "block", message: "Users cannot delete a remembered term or preference.", nextStep: "Add delete/forget controls for remembered terms and preferences." },
  { code: "disable_personalization_control", evidenceKey: "usersCanDisablePersonalization", severity: "block", message: "Users cannot turn off personalization.", nextStep: "Provide a top-level personalization enabled/disabled control." },
  { code: "exclude_site_control", evidenceKey: "usersCanExcludeSite", severity: "block", message: "Users cannot stop Astra from learning preferences on a site.", nextStep: "Add per-site exclusion controls and honor them during writes." },
  { code: "write_policy_respects_privacy", evidenceKey: "writePolicyRespectsPrivacyModeAndSiteExclusions", severity: "block", message: "Personalization writes do not respect Privacy Mode or site exclusions.", nextStep: "Block automatic memory writes in Privacy Mode, personalization-off, and excluded-host states." },
]

export function evaluateAstraPersonalizationReadiness(evidence: AstraPersonalizationReadinessEvidence): AstraPersonalizationReadinessDecision {
  const findings = READINESS_CHECKS
    .filter((check) => !evidence[check.evidenceKey])
    .map<AstraPersonalizationReadinessFinding>((check) => ({
      code: check.code,
      severity: check.severity,
      message: check.message,
      nextStep: check.nextStep,
    }))
  const blockers = findings.filter((finding) => finding.severity === "block")
  const warnings = findings.filter((finding) => finding.severity === "warn")
  return { ready: blockers.length === 0, blockers, warnings, findings }
}
