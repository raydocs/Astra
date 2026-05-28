import { browser } from "#imports"
import type { TelemetryEvent } from "@/utils/telemetry"

export type LearningLoopEventName =
  | "copy_variant_assigned"
  | "extension_installed"
  | "onboarding_started"
  | "sample_started"
  | "first_value_seen"
  | "popup_primer_viewed"
  | "popup_primer_cta_clicked"
  | "first_content_understood"
  | "onboarding_closure_viewed"
  | "onboarding_closure_cta_clicked"
  | "onboarding_completed"
  | "deep_read_opened"
  | "sentence_explained"
  | "sentence_saved"
  | "saved_snippet_created"
  | "review_opened"
  | "review_answered"
  | "review_session_completed"
  | "library_opened"
  | "returned_to_source"
  | "return_to_source_clicked"
  | "continue_clicked"
  | "resumed_reading"
  | "digest_viewed"
  | "digest_opened"
  | "reminder_dismissed"
  | "reminder_disabled"
  | "winback_sent"
  | "paywall_viewed"
  | "trial_started"
  | "pro_value_seen"
  | "membership_activated"
  | "support_report_submitted"
  | "known_issue_viewed"
  | "cancellation_reason_submitted"
  | "share_card_created"
  | "referral_sent"
  | "referral_converted"
  | "landing_visited"
  | "landing_install_clicked"
  | "variant_assigned"
  | "conversion_event"
  | "guardrail_metric"

export type LearningLoopCopyVariant = "loop_first" | "outcome_first"
export type LearningLoopFunnelVariant = LearningLoopCopyVariant | "unknown"

export type LearningLoopFunnelEventName =
  | "popup_primer_viewed"
  | "popup_primer_cta_clicked"
  | "deep_read_opened"
  | "sentence_explained"
  | "sentence_saved"
  | "review_answered"

export type LearningLoopActivationEventName =
  | "extension_installed"
  | "onboarding_started"
  | "onboarding_completed"
  | "sample_started"
  | "first_content_understood"
  | "first_value_seen"
  | "saved_snippet_created"
  | "sentence_saved"
  | "review_opened"
  | "review_answered"
  | "review_session_completed"
  | "trial_started"
  | "pro_value_seen"

export type LearningLoopRetentionEventName =
  | "review_opened"
  | "review_answered"
  | "review_session_completed"
  | "return_to_source_clicked"
  | "returned_to_source"
  | "continue_clicked"
  | "resumed_reading"
  | "digest_viewed"
  | "digest_opened"
  | "reminder_dismissed"
  | "reminder_disabled"
  | "winback_sent"
  | "pro_value_seen"
  | "membership_activated"
  | "cancellation_reason_submitted"

export type LearningLoopLearningEventName =
  | "saved_snippet_created"
  | "sentence_saved"
  | "review_opened"
  | "review_answered"
  | "review_session_completed"
  | "library_opened"
  | "return_to_source_clicked"
  | "returned_to_source"
  | "continue_clicked"
  | "resumed_reading"

export interface LearningLoopFunnelVariantResult {
  variant: LearningLoopFunnelVariant
  label: string
  counts: Record<LearningLoopFunnelEventName, number>
  totalEvents: number
  latestTimestamp: number | null
  ctaRate: number | null
  deepReadRate: number | null
  explainRate: number | null
  saveRate: number | null
}

export interface LearningLoopFunnelAggregation {
  variants: LearningLoopFunnelVariantResult[]
  totals: LearningLoopFunnelVariantResult
}

export interface LearningLoopActivationDashboard {
  counts: Record<LearningLoopActivationEventName, number>
  totalEvents: number
  latestTimestamp: number | null
  activationStartCount: number
  firstValueCount: number
  firstSaveCount: number
  firstReviewCompletionCount: number
  firstValueP50Seconds: number | null
  firstValueDurationSamplesSeconds: number[]
  onboardingCompletionRate: number | null
  firstValueRate: number | null
  firstSaveRate: number | null
  firstReviewCompletionRate: number | null
  trialStartedCount: number
  proValueSeenCount: number
  privacyPolicy: string
}

export interface LearningLoopRetentionDashboard {
  counts: Record<LearningLoopRetentionEventName, number>
  totalEvents: number
  latestTimestamp: number | null
  activeLearningDaysLast28: number
  activeLearningWeeksLast4: number
  reviewOpenedCount: number
  reviewAnsweredCount: number
  reviewCompletedCount: number
  reviewCompletionRate: number | null
  sourceReturnCount: number
  continueCount: number
  digestViewedCount: number
  digestOpenedCount: number
  digestReviewFollowThroughCount: number
  digestReviewFollowThroughRate: number | null
  reminderControlledCount: number
  winbackSentCount: number
  proRepeatValueCount: number
  cancellationValueRiskCount: number
  privacyPolicy: string
}

export interface LearningLoopSourceTypeCount {
  sourceType: string
  count: number
}

export interface LearningLoopLearningDashboard {
  counts: Record<LearningLoopLearningEventName, number>
  totalEvents: number
  latestTimestamp: number | null
  activeLearningDaysLast28: number
  savedItemCount: number
  reviewableCardProxyCount: number
  reviewableCardProxyRate: number | null
  reviewOpenedCount: number
  reviewAnsweredCount: number
  reviewCompletedCount: number
  reviewCompletionRate: number | null
  libraryOpenedCount: number
  sourceReturnCount: number
  continueLearningCount: number
  savedBySourceType: LearningLoopSourceTypeCount[]
  privacyPolicy: string
}

export type LearningLoopCopyVariantAutoSelectionPhase = "collecting" | "guarded" | "cooldown" | "selected" | "unavailable"

export interface LearningLoopCopyVariantAutoSelectionCandidate {
  variant: LearningLoopCopyVariant
  label: string
  score: number
  views: number
  ready: boolean
  ctaRate: number | null
  deepReadRate: number | null
  explainRate: number | null
  saveRate: number | null
}

export interface LearningLoopCopyVariantAutoSelectionGuardrails {
  minViewsPerVariant: number
  minWinnerScore: number
  hysteresis: number
  cooldownMs: number
}

export interface LearningLoopCopyVariantAutoSelectionStatus {
  phase: LearningLoopCopyVariantAutoSelectionPhase
  currentVariant: LearningLoopCopyVariant
  winnerVariant: LearningLoopCopyVariant | null
  recommendedVariant: LearningLoopCopyVariant | null
  reason: string
  lastEvaluatedAt: number | null
  lastSelectedAt: number | null
  cooldownUntil: number | null
  candidates: LearningLoopCopyVariantAutoSelectionCandidate[]
  guardrails: LearningLoopCopyVariantAutoSelectionGuardrails
}

interface StoredLearningLoopCopyVariantAutoSelectionState {
  version: 1
  lastEvaluatedAt: number
  lastSelectedAt: number | null
  lastSelectedVariant: LearningLoopCopyVariant | null
  lastDecision: string
}

export const LEARNING_LOOP_EVENT_NAMES: LearningLoopEventName[] = [
  "copy_variant_assigned",
  "extension_installed",
  "onboarding_started",
  "sample_started",
  "first_value_seen",
  "popup_primer_viewed",
  "popup_primer_cta_clicked",
  "first_content_understood",
  "onboarding_closure_viewed",
  "onboarding_closure_cta_clicked",
  "onboarding_completed",
  "deep_read_opened",
  "sentence_explained",
  "sentence_saved",
  "saved_snippet_created",
  "review_opened",
  "review_answered",
  "review_session_completed",
  "library_opened",
  "returned_to_source",
  "return_to_source_clicked",
  "continue_clicked",
  "resumed_reading",
  "digest_viewed",
  "digest_opened",
  "reminder_dismissed",
  "reminder_disabled",
  "winback_sent",
  "paywall_viewed",
  "trial_started",
  "pro_value_seen",
  "membership_activated",
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
]

export const LEARNING_LOOP_COPY_VARIANTS: LearningLoopCopyVariant[] = ["loop_first", "outcome_first"]
export const LEARNING_LOOP_FUNNEL_EVENT_NAMES: LearningLoopFunnelEventName[] = [
  "popup_primer_viewed",
  "popup_primer_cta_clicked",
  "deep_read_opened",
  "sentence_explained",
  "sentence_saved",
  "review_answered",
]

export const LEARNING_LOOP_ACTIVATION_EVENT_NAMES: LearningLoopActivationEventName[] = [
  "extension_installed",
  "onboarding_started",
  "onboarding_completed",
  "sample_started",
  "first_content_understood",
  "first_value_seen",
  "saved_snippet_created",
  "sentence_saved",
  "review_opened",
  "review_answered",
  "review_session_completed",
  "trial_started",
  "pro_value_seen",
]

export const LEARNING_LOOP_RETENTION_EVENT_NAMES: LearningLoopRetentionEventName[] = [
  "review_opened",
  "review_answered",
  "review_session_completed",
  "return_to_source_clicked",
  "returned_to_source",
  "continue_clicked",
  "resumed_reading",
  "digest_viewed",
  "digest_opened",
  "reminder_dismissed",
  "reminder_disabled",
  "winback_sent",
  "pro_value_seen",
  "membership_activated",
  "cancellation_reason_submitted",
]

export const LEARNING_LOOP_LEARNING_EVENT_NAMES: LearningLoopLearningEventName[] = [
  "saved_snippet_created",
  "sentence_saved",
  "review_opened",
  "review_answered",
  "review_session_completed",
  "library_opened",
  "return_to_source_clicked",
  "returned_to_source",
  "continue_clicked",
  "resumed_reading",
]

export type LearningLoopStageOkrStage = "M1" | "M2" | "M3" | "M4" | "M5"
export type LearningLoopStageOkrSignal = "event" | "runtime_query" | "manual_review"

export interface LearningLoopStageOkrMetric {
  stage: LearningLoopStageOkrStage
  objective: string
  keyResult: string
  supportingSignals: Array<{
    kind: LearningLoopStageOkrSignal
    name: LearningLoopEventName | "weekly_reviewable_learning_moments" | "reviewable_card_rate" | "provider_api_model_default_ui_count" | "preference_undo_delete_available" | "prompt_injection_fixture_pass_rate"
  }>
  privacyPolicy: string
}

export const LEARNING_LOOP_STAGE_OKR_METRICS: LearningLoopStageOkrMetric[] = [
  {
    stage: "M1",
    objective: "First Success + Trust",
    keyResult: "80% onboarding completed",
    supportingSignals: [{ kind: "event", name: "onboarding_completed" }],
    privacyPolicy: "Event metadata only; no page text, selected text, or user input.",
  },
  {
    stage: "M1",
    objective: "First Success + Trust",
    keyResult: "60% new users complete first content understood",
    supportingSignals: [{ kind: "event", name: "first_content_understood" }],
    privacyPolicy: "Source type and coarse duration/success metadata only.",
  },
  {
    stage: "M1",
    objective: "First Success + Trust",
    keyResult: "25% new users save first snippet",
    supportingSignals: [{ kind: "event", name: "saved_snippet_created" }, { kind: "event", name: "sentence_saved" }],
    privacyPolicy: "No snippet text; use source type, creation path, and review-card presence only.",
  },
  {
    stage: "M1",
    objective: "First Success + Trust",
    keyResult: "ordinary UI provider/API/model exposure is 0",
    supportingSignals: [{ kind: "manual_review", name: "provider_api_model_default_ui_count" }],
    privacyPolicy: "Static UI/release review only.",
  },
  {
    stage: "M1",
    objective: "First Success + Trust",
    keyResult: "privacy/support entry visible and copy reviewed",
    supportingSignals: [{ kind: "event", name: "support_report_submitted" }, { kind: "event", name: "known_issue_viewed" }],
    privacyPolicy: "Metadata-only support categories, surfaces, report ids, and known-issue ids.",
  },
  {
    stage: "M2",
    objective: "Learning Loop Productization",
    keyResult: "90% of saves show next-step feedback",
    supportingSignals: [{ kind: "event", name: "saved_snippet_created" }, { kind: "event", name: "sentence_saved" }],
    privacyPolicy: "Counts and UI outcome metadata only.",
  },
  {
    stage: "M2",
    objective: "Learning Loop Productization",
    keyResult: "30% of saving users complete first review",
    supportingSignals: [{ kind: "event", name: "review_session_completed" }, { kind: "event", name: "review_answered" }],
    privacyPolicy: "Card counts, duration buckets, and feedback breakdown only.",
  },
  {
    stage: "M2",
    objective: "Learning Loop Productization",
    keyResult: "P50 review session under 3 minutes",
    supportingSignals: [{ kind: "event", name: "review_session_completed" }],
    privacyPolicy: "Duration bucket or aggregate duration only; no card text.",
  },
  {
    stage: "M2",
    objective: "Learning Loop Productization",
    keyResult: "ReviewCard reviewable rate >= 85%",
    supportingSignals: [{ kind: "runtime_query", name: "reviewable_card_rate" }],
    privacyPolicy: "Aggregate card status counts only.",
  },
  {
    stage: "M3",
    objective: "Learning Library",
    keyResult: "40% WAU open Library",
    supportingSignals: [{ kind: "event", name: "library_opened" }],
    privacyPolicy: "Filter/source type only.",
  },
  {
    stage: "M3",
    objective: "Learning Library",
    keyResult: "80% source-backed cards can return to source",
    supportingSignals: [{ kind: "event", name: "return_to_source_clicked" }, { kind: "event", name: "returned_to_source" }],
    privacyPolicy: "Source type and hostname only; no full URL path or content.",
  },
  {
    stage: "M3",
    objective: "Learning Library",
    keyResult: "20% Library users click continue learning",
    supportingSignals: [{ kind: "event", name: "return_to_source_clicked" }, { kind: "event", name: "resumed_reading" }],
    privacyPolicy: "Source type and action outcome only.",
  },
  {
    stage: "M3",
    objective: "Learning Library",
    keyResult: "P0 data control passes QA",
    supportingSignals: [{ kind: "event", name: "support_report_submitted" }],
    privacyPolicy: "Trust event metadata only; export/delete QA remains release evidence.",
  },
  {
    stage: "M4",
    objective: "Personalization",
    keyResult: "30% active users have valid preference/glossary signal",
    supportingSignals: [{ kind: "event", name: "guardrail_metric" }],
    privacyPolicy: "Preference/glossary presence counts only; no remembered term text.",
  },
  {
    stage: "M4",
    objective: "Personalization",
    keyResult: "preference undo/delete is available",
    supportingSignals: [{ kind: "manual_review", name: "preference_undo_delete_available" }],
    privacyPolicy: "Static UI/release review only.",
  },
  {
    stage: "M4",
    objective: "Personalization",
    keyResult: "explain quality score improves 10%",
    supportingSignals: [{ kind: "event", name: "guardrail_metric" }],
    privacyPolicy: "Quality score buckets only; no prompt, page text, or model output.",
  },
  {
    stage: "M4",
    objective: "Personalization",
    keyResult: "prompt injection tests pass 100%",
    supportingSignals: [{ kind: "manual_review", name: "prompt_injection_fixture_pass_rate" }],
    privacyPolicy: "Fixture pass/fail only.",
  },
  {
    stage: "M5",
    objective: "Digest + Retention",
    keyResult: "35% active users view Weekly Digest",
    supportingSignals: [{ kind: "event", name: "digest_viewed" }],
    privacyPolicy: "Week number and aggregate counts only.",
  },
  {
    stage: "M5",
    objective: "Digest + Retention",
    keyResult: "4-week retention improves 15%",
    supportingSignals: [{ kind: "runtime_query", name: "weekly_reviewable_learning_moments" }, { kind: "event", name: "review_session_completed" }],
    privacyPolicy: "Aggregate weekly counts only.",
  },
  {
    stage: "M5",
    objective: "Digest + Retention",
    keyResult: "Pro repeat feature usage >= 50%",
    supportingSignals: [{ kind: "event", name: "pro_value_seen" }, { kind: "event", name: "membership_activated" }],
    privacyPolicy: "Trigger/surface/plan category only.",
  },
  {
    stage: "M5",
    objective: "Digest + Retention",
    keyResult: "cancellation reason 'cannot see value' declines",
    supportingSignals: [{ kind: "event", name: "cancellation_reason_submitted" }],
    privacyPolicy: "Normalized reason category only.",
  },
]

export const DEFAULT_LEARNING_LOOP_COPY_VARIANT: LearningLoopCopyVariant = "loop_first"
export const LEARNING_LOOP_COPY_VARIANT_STORAGE_KEY = "astra.learningLoop.copyVariant.v1"
export const LEARNING_LOOP_COPY_VARIANT_AUTO_SELECTION_STORAGE_KEY = "astra.learningLoop.copyVariantAutoSelection.v1"
export const LEARNING_LOOP_COPY_VARIANT_AUTO_SELECTION_GUARDRAILS: LearningLoopCopyVariantAutoSelectionGuardrails = {
  minViewsPerVariant: 3,
  minWinnerScore: 0.35,
  hysteresis: 0.12,
  cooldownMs: 24 * 60 * 60 * 1000,
}

const ACTIVATION_FIRST_TEN_MINUTES_MS = 10 * 60 * 1000
const LEARNING_LOOKBACK_MS = 28 * 24 * 60 * 60 * 1000
const RETENTION_DIGEST_FOLLOW_THROUGH_MS = 7 * 24 * 60 * 60 * 1000
const RETENTION_WEEK_MS = 7 * 24 * 60 * 60 * 1000
const RETENTION_LOOKBACK_MS = 28 * 24 * 60 * 60 * 1000
const TELEMETRY_STORAGE_KEY = "astra.telemetry.v1"
const MAX_TELEMETRY_EVENTS = 200
const LEARNING_SOURCE_CATEGORY_ALLOWLIST = new Set([
  "article",
  "sample_article",
  "sample_lesson",
  "deep_read",
  "popup_deep_read",
  "vocabulary",
  "review",
  "digest",
  "library",
  "unknown",
])

let learningLoopTelemetryWriteQueue: Promise<void> = Promise.resolve()

export const LEARNING_LOOP_COMMERCIAL_PACKAGE_COPY = {
  eyebrow: "Start free -> Build assets -> Keep continuity",
  title: "Astra packages real-page moments into a learning trail",
  description: "Free daily translations start the loop without setup. Save useful sentences and Astra keeps the source page, explanation, and review timing connected so context compounds instead of becoming throwaway lookup.",
  steps: [
    "Start free: translate selected real-page moments without setup.",
    "Build learning assets: save useful sentences with source context, explanations, and review cards.",
    "Keep continuity: return to the same trail so Review compounds what you chose to learn.",
  ],
  control: "You stay in control: choose which pages to translate, which sentences to save, and when to review.",
  boundary: "Local beta boundary: built for selected real-page learning moments—not unlimited bulk translation, hands-off automation, or a billing commitment in this build.",
  outcome: "Compared with a translator or reader alone, Astra turns useful page moments into reviewable learning outcomes.",
} as const

export const LEARNING_LOOP_FIRST_WIN_ACTIVATION_COPY = {
  eyebrow: "First win activation",
  title: "Save one useful sentence from a real page.",
  summary: "Translate a page, open Deep Read, explain one sentence, save it, then Review brings that same page context back when it is time to practice.",
} as const

export const LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY = {
  eyebrow: "Account continuity",
  title: "Keep your learning trail when you switch devices.",
  summary: "Sign in to attach your saved learning cards, reading queue, and study progress to an Astra account so today's page work is ready in your next session.",
  connectedTitle: "Continuity is connected for this account.",
  connectedSummary: "Your saved learning cards, reading queue, and study progress are attached to this Astra account for future sessions.",
  bullets: [
    "Continue from the same source pages and saved card context.",
    "Keep saved cards, reading history, and study progress connected across sessions.",
    "Review stays grounded in what you chose to learn, with review schedules synced safely across sessions."
  ],
  proofMoments: {
    popup: "Proof from this popup session is worth keeping.",
    study: "Proof on this page is already forming.",
    vocabularyList: "Proof in your learning desk is worth carrying forward.",
    vocabularyReview: "Proof in Review shows the loop is working.",
    vocabularyReading: "Proof in Reading shows what you can resume later.",
  },
  proofFallback: "Proof appears as soon as you translate, explain, save, review, or queue a reading item.",
  proofCtaHelper: "Same CTA: use the existing popup sign-in panel to keep this proof across sessions.",
  connectedProofHelper: "Connected proof: your Astra account can keep this saved-card learning trail across sessions; no sign-in action is needed here.",
  cta: "Sign in to keep continuity",
  ctaHelper: "Opens the existing Astra sign-in panel—no billing or sync changes happen until you sign in.",
  popupFocusParam: "focus=sign-in",
  popupDeepLinkPath: "/popup.html?focus=sign-in",
  nextAction: "Next action: open the popup sign-in panel when you are ready to attach today’s learning trail to an account.",
  boundary: "No billing change here—sign-in only connects continuity, review schedules, and account status for this build; daily study stats stay local-only."
} as const

export type LearningLoopAccountContinuityProofSurface =
  | "popup"
  | "study"
  | "vocabulary_list"
  | "vocabulary_review"
  | "vocabulary_reading"

export type LearningLoopAccountContinuityAuthState = "signed_out" | "signed_in"

export interface LearningLoopAccountContinuityProofCounts {
  dueReviewCount?: number | null
  savedSentenceCount?: number | null
  inProgressReadingCount?: number | null
  pagesStudiedToday?: number | null
  sentencesExplainedToday?: number | null
  vocabSavedToday?: number | null
  vocabReviewedToday?: number | null
}

const ACCOUNT_CONTINUITY_PROOF_SURFACE_COPY: Record<LearningLoopAccountContinuityProofSurface, string> = {
  popup: LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.proofMoments.popup,
  study: LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.proofMoments.study,
  vocabulary_list: LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.proofMoments.vocabularyList,
  vocabulary_review: LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.proofMoments.vocabularyReview,
  vocabulary_reading: LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.proofMoments.vocabularyReading,
}

function formatProofCount(count: number | null | undefined, singular: string, plural = `${singular}s`): string | null {
  if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) return null
  const normalized = Math.floor(count)
  return `${normalized} ${normalized === 1 ? singular : plural}`
}

export function buildLearningLoopAccountContinuityProofMoment(
  surface: LearningLoopAccountContinuityProofSurface,
  counts: LearningLoopAccountContinuityProofCounts = {},
  options: { authState?: LearningLoopAccountContinuityAuthState } = {},
): string {
  const evidence = [
    formatProofCount(counts.dueReviewCount, "due review card"),
    formatProofCount(counts.savedSentenceCount, "saved learning card"),
    formatProofCount(counts.inProgressReadingCount, "reading item in progress", "reading items in progress"),
    formatProofCount(counts.pagesStudiedToday, "page studied today", "pages studied today"),
    formatProofCount(counts.sentencesExplainedToday, "sentence explained today", "sentences explained today"),
    formatProofCount(counts.vocabSavedToday, "card saved today", "cards saved today"),
    formatProofCount(counts.vocabReviewedToday, "card reviewed today", "cards reviewed today"),
  ].filter((entry): entry is string => Boolean(entry)).slice(0, 3)

  const proof = evidence.length > 0
    ? `Proof now: ${evidence.join(" · ")}.`
    : LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.proofFallback
  const helper = options.authState === "signed_in"
    ? LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.connectedProofHelper
    : LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.proofCtaHelper

  return `${ACCOUNT_CONTINUITY_PROOF_SURFACE_COPY[surface]} ${proof} ${helper}`
}

export function buildLearningLoopAccountContinuityPopupSignInUrl(
  resolveRuntimeUrl: (path: string) => string,
): string {
  const [path, query = LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.popupFocusParam] = LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY.popupDeepLinkPath.split("?")
  return `${resolveRuntimeUrl(path ?? "/popup.html")}?${query}`
}

export type LearningLoopProValueTrigger = "long_video" | "deep_read" | "sync" | "digest" | "near_limit"
export type LearningLoopUpgradePromptVariant = "continuity_first" | "momentum_first"

export interface LearningLoopProValueMoment {
  trigger: LearningLoopProValueTrigger
  surface: string
  eyebrow: string
  title: string
  summary: string
  cta: string
}

export interface LearningLoopUpgradePrompt {
  variant: LearningLoopUpgradePromptVariant
  experimentId: typeof LEARNING_LOOP_UPGRADE_PROMPT_EXPERIMENT_ID
  triggers: LearningLoopProValueTrigger[]
  eyebrow: string
  title: string
  summary: string
  cta: string
  boundary: string
}

export interface LearningLoopUpgradePromptDashboardRow {
  variant: LearningLoopUpgradePromptVariant | "unknown"
  trigger: LearningLoopProValueTrigger | "unknown"
  assignments: number
  views: number
  intents: number
  intentRate: number | null
}

export interface LearningLoopUpgradePromptDashboard {
  experimentId: typeof LEARNING_LOOP_UPGRADE_PROMPT_EXPERIMENT_ID
  assignments: number
  views: number
  intents: number
  intentRate: number | null
  rows: LearningLoopUpgradePromptDashboardRow[]
  privacyPolicy: string
}

export const LEARNING_LOOP_UPGRADE_PROMPT_VARIANTS: LearningLoopUpgradePromptVariant[] = ["continuity_first", "momentum_first"]
export const DEFAULT_LEARNING_LOOP_UPGRADE_PROMPT_VARIANT: LearningLoopUpgradePromptVariant = "continuity_first"
export const LEARNING_LOOP_UPGRADE_PROMPT_VARIANT_STORAGE_KEY = "astra.learningLoop.upgradePromptVariant.v1"
export const LEARNING_LOOP_UPGRADE_PROMPT_EXPERIMENT_ID = "upgrade_prompt_value_copy_v1"

export const LEARNING_LOOP_PRO_VALUE_MOMENTS: Record<LearningLoopProValueTrigger, Omit<LearningLoopProValueMoment, "trigger" | "surface">> = {
  long_video: {
    eyebrow: "Pro value · Long video",
    title: "Turn longer videos into study notes without babysitting captions.",
    summary: "Pro is designed for longer listening sessions: transcript capture, subtitle reliability, and reviewable notes stay connected.",
    cta: "Use video notes for long lessons",
  },
  deep_read: {
    eyebrow: "Pro value · Deep Read",
    title: "Go deeper than page translation when a sentence matters.",
    summary: "Deep Read keeps article context, explanations, saved sentences, and review together for focused learning sessions.",
    cta: "Open Deep Read",
  },
  sync: {
    eyebrow: "Pro value · Continuity",
    title: "Keep today’s trail ready on your next device.",
    summary: "Account continuity protects saved cards, reading history, and review schedules so learning does not stay trapped on one browser.",
    cta: "Connect continuity",
  },
  digest: {
    eyebrow: "Pro value · Digest",
    title: "Summarize what mattered and keep the next step visible.",
    summary: "Digest moments package page context, vocabulary focus, grammar focus, and suggested follow-up into a reusable study checkpoint.",
    cta: "Generate or refresh a digest",
  },
  near_limit: {
    eyebrow: "Pro value · More included reading",
    title: "When you approach today’s included reading, Pro protects momentum.",
    summary: "Near-limit moments explain value in plain language: more length, more stability, and fewer interruptions.",
    cta: "Keep reading with Pro",
  },
}

export function buildLearningLoopProValueMoments(input: {
  surface: string
  triggers: LearningLoopProValueTrigger[]
  maxMoments?: number
}): LearningLoopProValueMoment[] {
  const seen = new Set<LearningLoopProValueTrigger>()
  const maxMoments = Math.max(1, input.maxMoments ?? 3)
  return input.triggers
    .filter((trigger) => {
      if (seen.has(trigger)) return false
      seen.add(trigger)
      return true
    })
    .slice(0, maxMoments)
    .map((trigger) => ({
      trigger,
      surface: input.surface,
      ...LEARNING_LOOP_PRO_VALUE_MOMENTS[trigger],
    }))
}

function normalizeLearningLoopUpgradePromptVariant(value: unknown): LearningLoopUpgradePromptVariant | null {
  return LEARNING_LOOP_UPGRADE_PROMPT_VARIANTS.includes(value as LearningLoopUpgradePromptVariant)
    ? value as LearningLoopUpgradePromptVariant
    : null
}

function normalizeLearningLoopProValueTrigger(value: unknown): LearningLoopProValueTrigger | null {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LEARNING_LOOP_PRO_VALUE_MOMENTS, value)
    ? value as LearningLoopProValueTrigger
    : null
}

export async function getLearningLoopUpgradePromptVariant(): Promise<LearningLoopUpgradePromptVariant> {
  try {
    const stored = await browser.storage.local.get(LEARNING_LOOP_UPGRADE_PROMPT_VARIANT_STORAGE_KEY)
    const existing = normalizeLearningLoopUpgradePromptVariant(stored[LEARNING_LOOP_UPGRADE_PROMPT_VARIANT_STORAGE_KEY])
    if (existing) return existing

    const variant = Math.random() < 0.5 ? "continuity_first" : "momentum_first"
    await browser.storage.local.set({ [LEARNING_LOOP_UPGRADE_PROMPT_VARIANT_STORAGE_KEY]: variant })
    recordLearningLoopEvent("variant_assigned", {
      experimentId: LEARNING_LOOP_UPGRADE_PROMPT_EXPERIMENT_ID,
      variant,
      assignment: "local_random",
      billingAvailable: false,
      hardBlock: false,
    })
    return variant
  } catch {
    return DEFAULT_LEARNING_LOOP_UPGRADE_PROMPT_VARIANT
  }
}

export function buildLearningLoopUpgradePrompt(input: {
  variant: LearningLoopUpgradePromptVariant
  triggers: LearningLoopProValueTrigger[]
}): LearningLoopUpgradePrompt | null {
  const triggers = Array.from(new Set(input.triggers)).filter((trigger) => normalizeLearningLoopProValueTrigger(trigger))
  if (triggers.length === 0) return null

  const primary = triggers[0] ?? "deep_read"
  const moment = LEARNING_LOOP_PRO_VALUE_MOMENTS[primary]
  const shared = {
    variant: input.variant,
    experimentId: LEARNING_LOOP_UPGRADE_PROMPT_EXPERIMENT_ID,
    triggers,
    cta: "I'm interested in upgrades",
    boundary: "Beta note: paid upgrades are not available in this build. This button only records local interest; it does not start checkout, a trial, email capture, or a subscription change.",
  } as const

  if (input.variant === "momentum_first") {
    return {
      ...shared,
      eyebrow: "Upgrade interest · learning momentum",
      title: "Would an upgrade help you keep this learning momentum?",
      summary: `Astra is exploring ways to support moments like ${moment.title.toLowerCase()} Tell us locally if this kind of upgrade would be useful when paid plans launch later.`,
    }
  }

  return {
    ...shared,
    eyebrow: "Upgrade interest · continuity",
    title: "Would an upgrade help keep this learning trail connected?",
    summary: `Astra is exploring upgrade value around continuity, deeper reading, and fewer interruptions. This moment is about ${moment.title.toLowerCase()} Tell us locally if that sounds useful when paid plans launch later.`,
  }
}

function createUpgradePromptRowKey(variant: LearningLoopUpgradePromptVariant | "unknown", trigger: LearningLoopProValueTrigger | "unknown"): string {
  return `${variant}:${trigger}`
}

export function aggregateLearningLoopUpgradePromptDashboard(events: TelemetryEvent[]): LearningLoopUpgradePromptDashboard {
  const rows = new Map<string, LearningLoopUpgradePromptDashboardRow>()
  let assignments = 0
  let views = 0
  let intents = 0

  const ensureRow = (variant: LearningLoopUpgradePromptVariant | "unknown", trigger: LearningLoopProValueTrigger | "unknown") => {
    const key = createUpgradePromptRowKey(variant, trigger)
    const existing = rows.get(key)
    if (existing) return existing
    const row: LearningLoopUpgradePromptDashboardRow = { variant, trigger, assignments: 0, views: 0, intents: 0, intentRate: null }
    rows.set(key, row)
    return row
  }

  for (const event of events) {
    if (event.type !== "feature_usage" || event.data.feature !== "learning_loop") continue
    if (event.data.experimentId !== LEARNING_LOOP_UPGRADE_PROMPT_EXPERIMENT_ID) continue

    const variant = normalizeLearningLoopUpgradePromptVariant(event.data.variant) ?? "unknown"
    const triggerValues = Array.isArray(event.data.triggers) ? event.data.triggers : [event.data.trigger]
    const triggers = triggerValues
      .map((trigger) => normalizeLearningLoopProValueTrigger(trigger))
      .filter((trigger): trigger is LearningLoopProValueTrigger => Boolean(trigger))
    const normalizedTriggers: Array<LearningLoopProValueTrigger | "unknown"> = triggers.length > 0 ? triggers : ["unknown"]

    if (event.data.event === "variant_assigned") {
      assignments += 1
      for (const trigger of normalizedTriggers) {
        ensureRow(variant, trigger).assignments += 1
      }
    } else if (event.data.event === "paywall_viewed") {
      views += 1
      for (const trigger of normalizedTriggers) {
        ensureRow(variant, trigger).views += 1
      }
    } else if (event.data.event === "conversion_event" && event.data.conversion === "upgrade_intent_clicked") {
      intents += 1
      for (const trigger of normalizedTriggers) {
        ensureRow(variant, trigger).intents += 1
      }
    }
  }

  const sortedRows = Array.from(rows.values())
    .map((row) => ({ ...row, intentRate: safeRate(row.intents, row.views) }))
    .sort((a, b) => {
      const variantOrder = [...LEARNING_LOOP_UPGRADE_PROMPT_VARIANTS, "unknown"].indexOf(a.variant) - [...LEARNING_LOOP_UPGRADE_PROMPT_VARIANTS, "unknown"].indexOf(b.variant)
      return variantOrder || String(a.trigger).localeCompare(String(b.trigger))
    })

  return {
    experimentId: LEARNING_LOOP_UPGRADE_PROMPT_EXPERIMENT_ID,
    assignments,
    views,
    intents,
    intentRate: safeRate(intents, views),
    rows: sortedRows,
    privacyPolicy: "Upgrade prompt observability is local metadata only: experiment id, variant, trigger category, auth state, surface, billingAvailable=false, hardBlock=false, and aggregate counts. It does not include page URLs, page text, saved snippets, transcripts, prompts, model output, email, payment, checkout, trial, or subscription fields.",
  }
}

export const LEARNING_LOOP_COMMERCIAL_SURFACE_COPY = {
  onboardingPackageCard: LEARNING_LOOP_COMMERCIAL_PACKAGE_COPY,
  firstWinActivation: LEARNING_LOOP_FIRST_WIN_ACTIVATION_COPY,
  accountContinuity: LEARNING_LOOP_ACCOUNT_CONTINUITY_COPY,
  popupPrimer: {
    eyebrow: "Free start · connected practice",
    title: "Translate, Deep Read, save, and review stay in one trail.",
    summary: "Generic translators/readers stop after the answer; Astra keeps the source page and review path attached so useful moments become practice.",
  },
  studyOutcome: "Astra keeps this page's sentences, explanations, and saved review cards connected so today's reading becomes repeat practice.",
  proValueMoments: LEARNING_LOOP_PRO_VALUE_MOMENTS,
} as const

export const LEARNING_LOOP_DIFFERENTIATION_COPY = {
  eyebrow: "Astra vs translator/reader",
  title: "Generic tools stop at output; Astra carries the sentence into practice",
  genericTranslator: "Generic translators answer this page now, then the learning trail disappears.",
  genericReader: "Generic readers make text easier to consume, but rarely create a reviewable memory from it.",
  astra: "Astra links translation, Deep Read, explanation, saved sentence, source context, and spaced review in one loop.",
  reinforcement: "Compared with a translator or reader alone, Astra turns useful page moments into reviewable learning outcomes.",
} as const

export const LEARNING_LOOP_COPY = {
  loop_first: {
    popup: {
      eyebrow: "Reading-to-review workflow",
      title: "Astra turns real pages into saved review—not just translations",
      description: "Unlike a generic translator, Astra keeps the article, explanation, saved sentence, and due review connected so every page can become practice.",
      translateStep: "Translate the current page to create bilingual study context.",
      readStepPrefix: "Open Deep Read and focus on one high-value sentence",
      readStepFallback: " when article text is available",
      explainStep: "Ask why the sentence works, then save it from the sentence card.",
      reviewStep: "Review due cards so saved vocabulary comes back with page context.",
    },
    onboarding: {
      eyebrow: "Not a generic translator",
      title: "Translate → Understand → Save → Review",
      description: "Astra turns browsing into a learning loop: bilingual context, sentence-level explanations, saved vocabulary, and spaced review stay connected.",
      readyNote: "Your first outcome starts from the popup: translate a real page, open Deep Read, save one sentence, then review it with context.",
    },
  },
  outcome_first: {
    popup: {
      eyebrow: "Build a review card fast",
      title: "Leave this page with one saved sentence",
      description: "Astra is built for learners, not one-off lookup: pick a real sentence, understand it, save it, and let Review bring it back later.",
      translateStep: "Translate the page so the sentence keeps bilingual context.",
      readStepPrefix: "Open Deep Read and choose one sentence worth remembering",
      readStepFallback: " once article text is available",
      explainStep: "Get a learner-focused explanation, then save from the sentence card.",
      reviewStep: "Open Review to turn saved sentences into repeat practice.",
    },
    onboarding: {
      eyebrow: "Practice from real pages",
      title: "One useful sentence → one future review",
      description: "After setup, Astra helps you turn a page into a concrete learning outcome: explain one sentence, save it, and revisit it in Review.",
      readyNote: "Aim for one saved sentence today: translate, explain, save, then review when it comes due.",
    },
  },
} as const

function normalizeLearningLoopCopyVariant(value: unknown): LearningLoopCopyVariant | null {
  return LEARNING_LOOP_COPY_VARIANTS.includes(value as LearningLoopCopyVariant)
    ? value as LearningLoopCopyVariant
    : null
}

function createEmptyFunnelCounts(): Record<LearningLoopFunnelEventName, number> {
  return Object.fromEntries(LEARNING_LOOP_FUNNEL_EVENT_NAMES.map((event) => [event, 0])) as Record<LearningLoopFunnelEventName, number>
}

function safeRate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return numerator / denominator
}

function createFunnelResult(
  variant: LearningLoopFunnelVariant,
  counts: Record<LearningLoopFunnelEventName, number>,
  latestTimestamp: number | null,
): LearningLoopFunnelVariantResult {
  const views = counts.popup_primer_viewed
  const deepReads = counts.deep_read_opened
  const explained = counts.sentence_explained

  return {
    variant,
    label: variant === "loop_first"
      ? "Loop first"
      : variant === "outcome_first"
        ? "Outcome first"
        : "Unknown variant",
    counts,
    totalEvents: LEARNING_LOOP_FUNNEL_EVENT_NAMES.reduce((total, event) => total + counts[event], 0),
    latestTimestamp,
    ctaRate: safeRate(counts.popup_primer_cta_clicked, views),
    deepReadRate: safeRate(deepReads, views),
    explainRate: safeRate(explained, deepReads),
    saveRate: safeRate(counts.sentence_saved, explained),
  }
}

function isLearningLoopFunnelEventName(value: unknown): value is LearningLoopFunnelEventName {
  return LEARNING_LOOP_FUNNEL_EVENT_NAMES.includes(value as LearningLoopFunnelEventName)
}

function parseStoredAutoSelectionState(raw: unknown): StoredLearningLoopCopyVariantAutoSelectionState | null {
  if (raw == null || typeof raw !== "object") return null
  const value = raw as Partial<StoredLearningLoopCopyVariantAutoSelectionState>
  const lastSelectedVariant = normalizeLearningLoopCopyVariant(value.lastSelectedVariant)
  return {
    version: 1,
    lastEvaluatedAt: typeof value.lastEvaluatedAt === "number" ? value.lastEvaluatedAt : 0,
    lastSelectedAt: typeof value.lastSelectedAt === "number" ? value.lastSelectedAt : null,
    lastSelectedVariant,
    lastDecision: typeof value.lastDecision === "string" ? value.lastDecision : "No previous local auto-selection evaluation.",
  }
}

function scoreLearningLoopCopyVariant(result: LearningLoopFunnelVariantResult): number {
  const ctaRate = result.ctaRate ?? 0
  const deepReadRate = result.deepReadRate ?? 0
  const explainRate = result.explainRate ?? 0
  const saveRate = result.saveRate ?? 0

  return (ctaRate * 0.2) + (deepReadRate * 0.35) + (explainRate * 0.25) + (saveRate * 0.2)
}

function getVariantResult(
  aggregation: LearningLoopFunnelAggregation,
  variant: LearningLoopCopyVariant,
): LearningLoopFunnelVariantResult {
  return aggregation.variants.find((entry) => entry.variant === variant)
    ?? createFunnelResult(variant, createEmptyFunnelCounts(), null)
}

function createStoredAutoSelectionState(
  status: LearningLoopCopyVariantAutoSelectionStatus,
  selectedVariant: LearningLoopCopyVariant | null,
  selectedAt: number | null,
): StoredLearningLoopCopyVariantAutoSelectionState {
  return {
    version: 1,
    lastEvaluatedAt: status.lastEvaluatedAt ?? Date.now(),
    lastSelectedAt: selectedAt,
    lastSelectedVariant: selectedVariant,
    lastDecision: status.reason,
  }
}

export function aggregateLearningLoopFunnel(events: TelemetryEvent[]): LearningLoopFunnelAggregation {
  const countsByVariant = new Map<LearningLoopFunnelVariant, Record<LearningLoopFunnelEventName, number>>()
  const latestByVariant = new Map<LearningLoopFunnelVariant, number>()
  const totalCounts = createEmptyFunnelCounts()
  let totalLatest: number | null = null

  const ensureVariant = (variant: LearningLoopFunnelVariant) => {
    const existing = countsByVariant.get(variant)
    if (existing) return existing
    const next = createEmptyFunnelCounts()
    countsByVariant.set(variant, next)
    return next
  }

  for (const variant of LEARNING_LOOP_COPY_VARIANTS) {
    ensureVariant(variant)
  }

  for (const event of events) {
    if (event.type !== "feature_usage" || event.data.feature !== "learning_loop") continue
    if (!isLearningLoopFunnelEventName(event.data.event)) continue

    const variant = normalizeLearningLoopCopyVariant(event.data.variant) ?? "unknown"
    const counts = ensureVariant(variant)
    counts[event.data.event] += 1
    totalCounts[event.data.event] += 1

    const currentLatest = latestByVariant.get(variant)
    if (currentLatest === undefined || event.timestamp > currentLatest) {
      latestByVariant.set(variant, event.timestamp)
    }
    if (totalLatest === null || event.timestamp > totalLatest) {
      totalLatest = event.timestamp
    }
  }

  const variants = Array.from(countsByVariant.entries())
    .filter(([variant, counts]) => variant !== "unknown" || LEARNING_LOOP_FUNNEL_EVENT_NAMES.some((event) => counts[event] > 0))
    .map(([variant, counts]) => createFunnelResult(variant, counts, latestByVariant.get(variant) ?? null))
    .sort((a, b) => {
      const order = ["loop_first", "outcome_first", "unknown"]
      return order.indexOf(a.variant) - order.indexOf(b.variant)
    })

  return {
    variants,
    totals: createFunnelResult("unknown", totalCounts, totalLatest),
  }
}

function createEmptyActivationCounts(): Record<LearningLoopActivationEventName, number> {
  return Object.fromEntries(LEARNING_LOOP_ACTIVATION_EVENT_NAMES.map((event) => [event, 0])) as Record<LearningLoopActivationEventName, number>
}

function createEmptyRetentionCounts(): Record<LearningLoopRetentionEventName, number> {
  return Object.fromEntries(LEARNING_LOOP_RETENTION_EVENT_NAMES.map((event) => [event, 0])) as Record<LearningLoopRetentionEventName, number>
}

function createEmptyLearningCounts(): Record<LearningLoopLearningEventName, number> {
  return Object.fromEntries(LEARNING_LOOP_LEARNING_EVENT_NAMES.map((event) => [event, 0])) as Record<LearningLoopLearningEventName, number>
}

function normalizeActivationEventName(value: unknown): LearningLoopActivationEventName | null {
  if (LEARNING_LOOP_ACTIVATION_EVENT_NAMES.includes(value as LearningLoopActivationEventName)) {
    return value as LearningLoopActivationEventName
  }
  switch (value) {
    case "saved_item_created":
      return "saved_snippet_created"
    case "review_completed":
      return "review_session_completed"
    default:
      return null
  }
}

function normalizeRetentionEventName(value: unknown): LearningLoopRetentionEventName | null {
  if (LEARNING_LOOP_RETENTION_EVENT_NAMES.includes(value as LearningLoopRetentionEventName)) {
    return value as LearningLoopRetentionEventName
  }
  switch (value) {
    case "review_completed":
      return "review_session_completed"
    case "source_return_clicked":
      return "return_to_source_clicked"
    default:
      return null
  }
}

function normalizeLearningEventName(value: unknown): LearningLoopLearningEventName | null {
  if (LEARNING_LOOP_LEARNING_EVENT_NAMES.includes(value as LearningLoopLearningEventName)) {
    return value as LearningLoopLearningEventName
  }
  switch (value) {
    case "saved_item_created":
      return "saved_snippet_created"
    case "review_completed":
      return "review_session_completed"
    case "source_return_clicked":
      return "return_to_source_clicked"
    default:
      return null
  }
}

function normalizeLearningSourceType(value: unknown): string {
  if (typeof value !== "string") return "unknown"
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_")
  if (!normalized) return "unknown"
  if (normalized.includes("__") || normalized.includes("http") || normalized.includes("www_")) return "unknown"
  if (value.includes("://") || value.includes("/") || value.includes("@") || value.length > 40) return "unknown"
  return LEARNING_SOURCE_CATEGORY_ALLOWLIST.has(normalized) ? normalized : "unknown"
}

function isFirstValueEvent(event: LearningLoopActivationEventName): boolean {
  return event === "first_content_understood" || event === "first_value_seen"
}

function isFirstSaveEvent(event: LearningLoopActivationEventName): boolean {
  return event === "saved_snippet_created" || event === "sentence_saved"
}

function isFirstReviewCompletionEvent(event: LearningLoopActivationEventName): boolean {
  return event === "review_session_completed"
}

function isRetentionLearningActivityEvent(event: LearningLoopRetentionEventName): boolean {
  return event === "review_opened"
    || event === "review_answered"
    || event === "review_session_completed"
    || event === "return_to_source_clicked"
    || event === "returned_to_source"
    || event === "continue_clicked"
    || event === "resumed_reading"
    || event === "digest_viewed"
    || event === "digest_opened"
}

function isLearningActivityEvent(event: LearningLoopLearningEventName): boolean {
  return event === "saved_snippet_created"
    || event === "sentence_saved"
    || event === "review_opened"
    || event === "review_answered"
    || event === "review_session_completed"
    || event === "library_opened"
    || event === "return_to_source_clicked"
    || event === "returned_to_source"
    || event === "continue_clicked"
    || event === "resumed_reading"
}

function isDigestEvent(event: LearningLoopRetentionEventName): boolean {
  return event === "digest_viewed" || event === "digest_opened"
}

function isDigestFollowThroughEvent(event: LearningLoopRetentionEventName): boolean {
  return event === "review_opened" || event === "review_session_completed" || event === "continue_clicked" || event === "resumed_reading"
}

function isCancellationValueRiskReason(value: unknown): boolean {
  return value === "did_not_use_it"
    || value === "too_expensive"
    || value === "expected_different_features"
    || value === "found_another_tool"
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const midpoint = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[midpoint] ?? null
  const lower = sorted[midpoint - 1]
  const upper = sorted[midpoint]
  return lower == null || upper == null ? null : (lower + upper) / 2
}

function selectActivationStartTimestamps(
  orderedEvents: Array<{ event: LearningLoopActivationEventName; timestamp: number }>,
  preferredEvent: LearningLoopActivationEventName,
): number[] {
  const timestamps = orderedEvents
    .filter((entry) => entry.event === preferredEvent)
    .map((entry) => entry.timestamp)
  return timestamps.length > 0 ? timestamps : []
}

function selectActivationDashboardStarts(
  orderedEvents: Array<{ event: LearningLoopActivationEventName; timestamp: number }>,
): number[] {
  const installStarts = selectActivationStartTimestamps(orderedEvents, "extension_installed")
  if (installStarts.length > 0) return installStarts
  const onboardingStarts = selectActivationStartTimestamps(orderedEvents, "onboarding_started")
  if (onboardingStarts.length > 0) return onboardingStarts
  return selectActivationStartTimestamps(orderedEvents, "sample_started")
}

function deriveActivationWindowOutcomes(
  orderedEvents: Array<{ event: LearningLoopActivationEventName; timestamp: number }>,
  starts: number[],
): Array<{
  firstValueAt: number | null
  firstSaveAt: number | null
  firstReviewCompletedAt: number | null
}> {
  return starts.map((start, index) => {
    const nextStart = starts[index + 1] ?? Number.POSITIVE_INFINITY
    const windowEnd = Math.min(nextStart, start + ACTIVATION_FIRST_TEN_MINUTES_MS)
    const firstValue = orderedEvents.find((entry) => entry.timestamp >= start && entry.timestamp < windowEnd && isFirstValueEvent(entry.event))?.timestamp ?? null
    const firstSave = firstValue == null
      ? null
      : orderedEvents.find((entry) => entry.timestamp >= firstValue && entry.timestamp < windowEnd && isFirstSaveEvent(entry.event))?.timestamp ?? null
    const firstReviewCompleted = firstSave == null
      ? null
      : orderedEvents.find((entry) => entry.timestamp >= firstSave && entry.timestamp < windowEnd && isFirstReviewCompletionEvent(entry.event))?.timestamp ?? null

    return {
      firstValueAt: firstValue,
      firstSaveAt: firstSave,
      firstReviewCompletedAt: firstReviewCompleted,
    }
  })
}

function utcDayKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10)
}

function retentionWeekBucketFromLatest(timestamp: number, latestTimestamp: number): number {
  return Math.min(3, Math.max(0, Math.floor((latestTimestamp - timestamp) / RETENTION_WEEK_MS)))
}

function deriveDigestFollowThroughCount(
  orderedEvents: Array<{ event: LearningLoopRetentionEventName; timestamp: number }>,
): number {
  const digestEvents = orderedEvents.filter((entry) => isDigestEvent(entry.event))
  return digestEvents.filter((digest, index) => {
    const nextDigestAt = digestEvents[index + 1]?.timestamp ?? Number.POSITIVE_INFINITY
    const windowEnd = Math.min(nextDigestAt, digest.timestamp + RETENTION_DIGEST_FOLLOW_THROUGH_MS)
    return orderedEvents.some((entry) => entry.timestamp > digest.timestamp && entry.timestamp < windowEnd && isDigestFollowThroughEvent(entry.event))
  }).length
}

export function aggregateLearningLoopActivationDashboard(events: TelemetryEvent[]): LearningLoopActivationDashboard {
  const counts = createEmptyActivationCounts()
  const orderedEvents: Array<{ event: LearningLoopActivationEventName; timestamp: number }> = []
  let latestTimestamp: number | null = null

  for (const event of events) {
    if (event.type !== "feature_usage" || event.data.feature !== "learning_loop") continue
    const activationEvent = normalizeActivationEventName(event.data.event)
    if (!activationEvent) continue

    counts[activationEvent] += 1
    orderedEvents.push({ event: activationEvent, timestamp: event.timestamp })
    if (latestTimestamp === null || event.timestamp > latestTimestamp) {
      latestTimestamp = event.timestamp
    }
  }

  orderedEvents.sort((a, b) => a.timestamp - b.timestamp)

  const rawFirstValueCount = counts.first_content_understood + counts.first_value_seen
  const rawFirstSaveCount = counts.saved_snippet_created + counts.sentence_saved
  const rawFirstReviewCompletionCount = counts.review_session_completed
  const starts = selectActivationDashboardStarts(orderedEvents)
  const activationWindowOutcomes = deriveActivationWindowOutcomes(orderedEvents, starts)
  const firstValueDurationSamplesSeconds = activationWindowOutcomes.flatMap((outcome, index) => {
    const start = starts[index]
    return start == null || outcome.firstValueAt == null ? [] : [Math.max(0, (outcome.firstValueAt - start) / 1000)]
  })
  const activationStartCount = starts.length > 0
    ? starts.length
    : Math.max(
        counts.onboarding_completed,
        rawFirstValueCount,
        rawFirstSaveCount,
      )
  const firstValueCount = starts.length > 0
    ? activationWindowOutcomes.filter((outcome) => outcome.firstValueAt != null).length
    : rawFirstValueCount
  const firstSaveCount = starts.length > 0
    ? activationWindowOutcomes.filter((outcome) => outcome.firstSaveAt != null).length
    : rawFirstValueCount > 0 ? Math.min(rawFirstSaveCount, rawFirstValueCount) : rawFirstSaveCount
  const firstReviewCompletionCount = starts.length > 0
    ? activationWindowOutcomes.filter((outcome) => outcome.firstReviewCompletedAt != null).length
    : firstSaveCount > 0 ? Math.min(rawFirstReviewCompletionCount, firstSaveCount) : rawFirstReviewCompletionCount

  return {
    counts,
    totalEvents: LEARNING_LOOP_ACTIVATION_EVENT_NAMES.reduce((total, event) => total + counts[event], 0),
    latestTimestamp,
    activationStartCount,
    firstValueCount,
    firstSaveCount,
    firstReviewCompletionCount,
    firstValueP50Seconds: median(firstValueDurationSamplesSeconds),
    firstValueDurationSamplesSeconds,
    onboardingCompletionRate: safeRate(counts.onboarding_completed, counts.onboarding_started),
    firstValueRate: safeRate(firstValueCount, activationStartCount),
    firstSaveRate: safeRate(firstSaveCount, firstValueCount),
    firstReviewCompletionRate: safeRate(firstReviewCompletionCount, firstSaveCount),
    trialStartedCount: counts.trial_started,
    proValueSeenCount: counts.pro_value_seen,
    privacyPolicy: "Local activation dashboard uses event names, timestamps, counts, and categories only; it does not display page text, saved snippets, transcripts, prompts, model output, emails, or full URL paths.",
  }
}

export function aggregateLearningLoopLearningDashboard(events: TelemetryEvent[]): LearningLoopLearningDashboard {
  const counts = createEmptyLearningCounts()
  const orderedEvents: Array<{
    event: LearningLoopLearningEventName
    timestamp: number
    sourceType: string
    hasReviewCard: boolean
  }> = []
  const savedBySourceType = new Map<string, number>()
  let latestTimestamp: number | null = null
  let reviewableCardProxyCount = 0

  for (const event of events) {
    if (event.type !== "feature_usage" || event.data.feature !== "learning_loop") continue
    const learningEvent = normalizeLearningEventName(event.data.event)
    if (!learningEvent) continue

    const sourceType = normalizeLearningSourceType(event.data.sourceType ?? event.data.source ?? event.data.surface)
    const hasReviewCard = event.data.hasReviewCard === true
    counts[learningEvent] += 1
    orderedEvents.push({
      event: learningEvent,
      timestamp: event.timestamp,
      sourceType,
      hasReviewCard,
    })
    if (learningEvent === "saved_snippet_created" || learningEvent === "sentence_saved") {
      savedBySourceType.set(sourceType, (savedBySourceType.get(sourceType) ?? 0) + 1)
      if (hasReviewCard) {
        reviewableCardProxyCount += 1
      }
    }
    if (latestTimestamp === null || event.timestamp > latestTimestamp) {
      latestTimestamp = event.timestamp
    }
  }

  orderedEvents.sort((a, b) => a.timestamp - b.timestamp)
  const lookbackStart = latestTimestamp == null ? null : latestTimestamp - LEARNING_LOOKBACK_MS
  const recentLearningEvents = lookbackStart == null
    ? []
    : orderedEvents.filter((entry) => entry.timestamp >= lookbackStart && isLearningActivityEvent(entry.event))
  const savedItemCount = counts.saved_snippet_created + counts.sentence_saved

  return {
    counts,
    totalEvents: LEARNING_LOOP_LEARNING_EVENT_NAMES.reduce((total, event) => total + counts[event], 0),
    latestTimestamp,
    activeLearningDaysLast28: new Set(recentLearningEvents.map((entry) => utcDayKey(entry.timestamp))).size,
    savedItemCount,
    reviewableCardProxyCount,
    reviewableCardProxyRate: safeRate(reviewableCardProxyCount, savedItemCount),
    reviewOpenedCount: counts.review_opened,
    reviewAnsweredCount: counts.review_answered,
    reviewCompletedCount: counts.review_session_completed,
    reviewCompletionRate: safeRate(Math.min(counts.review_session_completed, counts.review_opened), counts.review_opened),
    libraryOpenedCount: counts.library_opened,
    sourceReturnCount: counts.return_to_source_clicked + counts.returned_to_source,
    continueLearningCount: counts.continue_clicked + counts.resumed_reading,
    savedBySourceType: Array.from(savedBySourceType.entries())
      .map(([sourceType, count]) => ({ sourceType, count }))
      .sort((a, b) => b.count - a.count || a.sourceType.localeCompare(b.sourceType)),
    privacyPolicy: "Local learning dashboard uses event names, timestamps, coarse source categories, review-card presence, and aggregate counts only; it does not display page text, saved snippets, transcripts, prompts, model output, emails, or full URL paths.",
  }
}

export function aggregateLearningLoopRetentionDashboard(events: TelemetryEvent[]): LearningLoopRetentionDashboard {
  const counts = createEmptyRetentionCounts()
  const orderedEvents: Array<{ event: LearningLoopRetentionEventName; timestamp: number; reason?: unknown }> = []
  let latestTimestamp: number | null = null
  let cancellationValueRiskCount = 0

  for (const event of events) {
    if (event.type !== "feature_usage" || event.data.feature !== "learning_loop") continue
    const retentionEvent = normalizeRetentionEventName(event.data.event)
    if (!retentionEvent) continue

    counts[retentionEvent] += 1
    orderedEvents.push({ event: retentionEvent, timestamp: event.timestamp, reason: event.data.reason })
    if (retentionEvent === "cancellation_reason_submitted" && isCancellationValueRiskReason(event.data.reason)) {
      cancellationValueRiskCount += 1
    }
    if (latestTimestamp === null || event.timestamp > latestTimestamp) {
      latestTimestamp = event.timestamp
    }
  }

  orderedEvents.sort((a, b) => a.timestamp - b.timestamp)
  const lookbackStart = latestTimestamp == null ? null : latestTimestamp - RETENTION_LOOKBACK_MS
  const recentLearningEvents = lookbackStart == null
    ? []
    : orderedEvents.filter((entry) => entry.timestamp >= lookbackStart && isRetentionLearningActivityEvent(entry.event))
  const digestViewedCount = counts.digest_viewed + counts.digest_opened
  const digestReviewFollowThroughCount = deriveDigestFollowThroughCount(orderedEvents)

  return {
    counts,
    totalEvents: LEARNING_LOOP_RETENTION_EVENT_NAMES.reduce((total, event) => total + counts[event], 0),
    latestTimestamp,
    activeLearningDaysLast28: new Set(recentLearningEvents.map((entry) => utcDayKey(entry.timestamp))).size,
    activeLearningWeeksLast4: latestTimestamp == null
      ? 0
      : new Set(recentLearningEvents.map((entry) => retentionWeekBucketFromLatest(entry.timestamp, latestTimestamp))).size,
    reviewOpenedCount: counts.review_opened,
    reviewAnsweredCount: counts.review_answered,
    reviewCompletedCount: counts.review_session_completed,
    reviewCompletionRate: safeRate(Math.min(counts.review_session_completed, counts.review_opened), counts.review_opened),
    sourceReturnCount: counts.return_to_source_clicked + counts.returned_to_source + counts.continue_clicked + counts.resumed_reading,
    continueCount: counts.continue_clicked + counts.resumed_reading,
    digestViewedCount,
    digestOpenedCount: counts.digest_opened,
    digestReviewFollowThroughCount,
    digestReviewFollowThroughRate: safeRate(digestReviewFollowThroughCount, digestViewedCount),
    reminderControlledCount: counts.reminder_dismissed + counts.reminder_disabled,
    winbackSentCount: counts.winback_sent,
    proRepeatValueCount: counts.pro_value_seen + counts.membership_activated,
    cancellationValueRiskCount,
    privacyPolicy: "Local retention dashboard uses event names, timestamps, normalized reasons, and aggregate counts only; it does not display page text, saved snippets, transcripts, prompts, model output, emails, or full URL paths.",
  }
}

export function deriveLearningLoopCopyVariantAutoSelectionStatus(
  aggregation: LearningLoopFunnelAggregation,
  currentVariant: LearningLoopCopyVariant,
  storedState: StoredLearningLoopCopyVariantAutoSelectionState | null = null,
  now: number = Date.now(),
): LearningLoopCopyVariantAutoSelectionStatus {
  const guardrails = LEARNING_LOOP_COPY_VARIANT_AUTO_SELECTION_GUARDRAILS
  const candidates = LEARNING_LOOP_COPY_VARIANTS.map((variant) => {
    const result = getVariantResult(aggregation, variant)
    return {
      variant,
      label: result.label,
      score: scoreLearningLoopCopyVariant(result),
      views: result.counts.popup_primer_viewed,
      ready: result.counts.popup_primer_viewed >= guardrails.minViewsPerVariant,
      ctaRate: result.ctaRate,
      deepReadRate: result.deepReadRate,
      explainRate: result.explainRate,
      saveRate: result.saveRate,
    }
  })

  const lastSelectedAt = storedState?.lastSelectedAt ?? null
  const cooldownUntil = lastSelectedAt == null ? null : lastSelectedAt + guardrails.cooldownMs
  const readyCandidates = candidates.filter((candidate) => candidate.ready)
  const sortedCandidates = [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.variant === currentVariant) return -1
    if (b.variant === currentVariant) return 1
    return LEARNING_LOOP_COPY_VARIANTS.indexOf(a.variant) - LEARNING_LOOP_COPY_VARIANTS.indexOf(b.variant)
  })
  const winner = sortedCandidates[0] ?? null
  const current = candidates.find((candidate) => candidate.variant === currentVariant) ?? null

  if (readyCandidates.length < LEARNING_LOOP_COPY_VARIANTS.length) {
    const missing = candidates
      .filter((candidate) => !candidate.ready)
      .map((candidate) => `${candidate.label} ${candidate.views}/${guardrails.minViewsPerVariant} views`)
      .join("; ")
    return {
      phase: "collecting",
      currentVariant,
      winnerVariant: null,
      recommendedVariant: null,
      reason: `Collecting local samples before auto-selection: ${missing || "waiting for variant views"}.`,
      lastEvaluatedAt: now,
      lastSelectedAt,
      cooldownUntil,
      candidates,
      guardrails,
    }
  }

  if (!winner || !current || winner.score < guardrails.minWinnerScore) {
    return {
      phase: "guarded",
      currentVariant,
      winnerVariant: winner?.variant ?? null,
      recommendedVariant: null,
      reason: `No auto-selection yet: winning score must reach ${Math.round(guardrails.minWinnerScore * 100)}%.`,
      lastEvaluatedAt: now,
      lastSelectedAt,
      cooldownUntil,
      candidates,
      guardrails,
    }
  }

  if (winner.variant === currentVariant) {
    return {
      phase: "selected",
      currentVariant,
      winnerVariant: winner.variant,
      recommendedVariant: null,
      reason: `${winner.label} remains the local winner.`,
      lastEvaluatedAt: now,
      lastSelectedAt,
      cooldownUntil,
      candidates,
      guardrails,
    }
  }

  if (cooldownUntil != null && now < cooldownUntil) {
    return {
      phase: "cooldown",
      currentVariant,
      winnerVariant: winner.variant,
      recommendedVariant: null,
      reason: `Auto-selection cooldown is active until ${new Date(cooldownUntil).toISOString()}.`,
      lastEvaluatedAt: now,
      lastSelectedAt,
      cooldownUntil,
      candidates,
      guardrails,
    }
  }

  const lift = winner.score - current.score
  if (lift < guardrails.hysteresis) {
    return {
      phase: "guarded",
      currentVariant,
      winnerVariant: winner.variant,
      recommendedVariant: null,
      reason: `No switch yet: ${winner.label} leads by ${Math.round(lift * 100)}pp, below the ${Math.round(guardrails.hysteresis * 100)}pp hysteresis guardrail.`,
      lastEvaluatedAt: now,
      lastSelectedAt,
      cooldownUntil,
      candidates,
      guardrails,
    }
  }

  return {
    phase: "selected",
    currentVariant,
    winnerVariant: winner.variant,
    recommendedVariant: winner.variant,
    reason: `${winner.label} is the local winner by ${Math.round(lift * 100)}pp and passes guardrails.`,
    lastEvaluatedAt: now,
    lastSelectedAt,
    cooldownUntil,
    candidates,
    guardrails,
  }
}

async function readLearningLoopCopyVariantAutoSelectionInputs(events?: TelemetryEvent[]): Promise<{
  currentVariant: LearningLoopCopyVariant
  storedState: StoredLearningLoopCopyVariantAutoSelectionState | null
  events: TelemetryEvent[]
}> {
  const keys = events
    ? [LEARNING_LOOP_COPY_VARIANT_STORAGE_KEY, LEARNING_LOOP_COPY_VARIANT_AUTO_SELECTION_STORAGE_KEY]
    : [LEARNING_LOOP_COPY_VARIANT_STORAGE_KEY, LEARNING_LOOP_COPY_VARIANT_AUTO_SELECTION_STORAGE_KEY, TELEMETRY_STORAGE_KEY]
  const stored = await browser.storage.local.get(keys)
  const currentVariant = normalizeLearningLoopCopyVariant(stored[LEARNING_LOOP_COPY_VARIANT_STORAGE_KEY]) ?? DEFAULT_LEARNING_LOOP_COPY_VARIANT
  return {
    currentVariant,
    storedState: parseStoredAutoSelectionState(stored[LEARNING_LOOP_COPY_VARIANT_AUTO_SELECTION_STORAGE_KEY]),
    events: events ?? parseStoredTelemetryEvents(stored[TELEMETRY_STORAGE_KEY]),
  }
}

export async function getLearningLoopCopyVariantAutoSelectionStatus(events?: TelemetryEvent[]): Promise<LearningLoopCopyVariantAutoSelectionStatus> {
  try {
    const inputs = await readLearningLoopCopyVariantAutoSelectionInputs(events)
    return deriveLearningLoopCopyVariantAutoSelectionStatus(
      aggregateLearningLoopFunnel(inputs.events),
      inputs.currentVariant,
      inputs.storedState,
    )
  } catch {
    return {
      phase: "unavailable",
      currentVariant: DEFAULT_LEARNING_LOOP_COPY_VARIANT,
      winnerVariant: null,
      recommendedVariant: null,
      reason: "Learning-loop auto-selection status is unavailable.",
      lastEvaluatedAt: null,
      lastSelectedAt: null,
      cooldownUntil: null,
      candidates: [],
      guardrails: LEARNING_LOOP_COPY_VARIANT_AUTO_SELECTION_GUARDRAILS,
    }
  }
}

export async function getLearningLoopCopyVariant(): Promise<LearningLoopCopyVariant> {
  try {
    const now = Date.now()
    const stored = await browser.storage.local.get([
      LEARNING_LOOP_COPY_VARIANT_STORAGE_KEY,
      LEARNING_LOOP_COPY_VARIANT_AUTO_SELECTION_STORAGE_KEY,
      TELEMETRY_STORAGE_KEY,
    ])
    const existing = normalizeLearningLoopCopyVariant(stored[LEARNING_LOOP_COPY_VARIANT_STORAGE_KEY])
    let currentVariant = existing ?? DEFAULT_LEARNING_LOOP_COPY_VARIANT
    const storedState = parseStoredAutoSelectionState(stored[LEARNING_LOOP_COPY_VARIANT_AUTO_SELECTION_STORAGE_KEY])
    const status = deriveLearningLoopCopyVariantAutoSelectionStatus(
      aggregateLearningLoopFunnel(parseStoredTelemetryEvents(stored[TELEMETRY_STORAGE_KEY])),
      currentVariant,
      storedState,
      now,
    )
    const nextVariant = status.recommendedVariant ?? currentVariant
    const selectedAt = status.recommendedVariant ? now : (storedState?.lastSelectedAt ?? null)
    const selectedVariant = status.recommendedVariant ?? storedState?.lastSelectedVariant ?? (existing ? currentVariant : null)

    await browser.storage.local.set({
      [LEARNING_LOOP_COPY_VARIANT_STORAGE_KEY]: nextVariant,
      [LEARNING_LOOP_COPY_VARIANT_AUTO_SELECTION_STORAGE_KEY]: createStoredAutoSelectionState(status, selectedVariant, selectedAt),
    })

    if (!existing) {
      recordLearningLoopEvent("copy_variant_assigned", {
        variant: DEFAULT_LEARNING_LOOP_COPY_VARIANT,
        assignment: "default_local",
      })
    }

    if (status.recommendedVariant && status.recommendedVariant !== currentVariant) {
      currentVariant = status.recommendedVariant
      const winner = status.candidates.find((candidate) => candidate.variant === status.recommendedVariant)
      const previous = status.candidates.find((candidate) => candidate.variant !== status.recommendedVariant)
      recordLearningLoopEvent("copy_variant_assigned", {
        variant: status.recommendedVariant,
        previousVariant: existing ?? DEFAULT_LEARNING_LOOP_COPY_VARIANT,
        assignment: "auto_winner",
        score: winner?.score,
        previousScore: previous?.score,
        minViewsPerVariant: status.guardrails.minViewsPerVariant,
        hysteresis: status.guardrails.hysteresis,
        cooldownMs: status.guardrails.cooldownMs,
      })
    }

    return currentVariant
  } catch {
    return DEFAULT_LEARNING_LOOP_COPY_VARIANT
  }
}

export async function setLearningLoopCopyVariant(variant: LearningLoopCopyVariant): Promise<void> {
  const now = Date.now()
  await browser.storage.local.set({
    [LEARNING_LOOP_COPY_VARIANT_STORAGE_KEY]: variant,
    [LEARNING_LOOP_COPY_VARIANT_AUTO_SELECTION_STORAGE_KEY]: {
      version: 1,
      lastEvaluatedAt: now,
      lastSelectedAt: now,
      lastSelectedVariant: variant,
      lastDecision: "Manual local switch; auto-selection cooldown is active.",
    } satisfies StoredLearningLoopCopyVariantAutoSelectionState,
  })
  recordLearningLoopEvent("copy_variant_assigned", {
    variant,
    assignment: "local_switch",
  })
}

function createLearningLoopTelemetryId(timestamp: number): string {
  return `${timestamp}-${Math.random().toString(36).slice(2, 8)}`
}

function parseStoredTelemetryEvents(raw: unknown): TelemetryEvent[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (event): event is TelemetryEvent =>
      event != null
      && typeof event === "object"
      && typeof (event as TelemetryEvent).id === "string"
      && typeof (event as TelemetryEvent).type === "string"
      && typeof (event as TelemetryEvent).timestamp === "number"
      && typeof (event as TelemetryEvent).data === "object",
  )
}

function enqueueLearningLoopTelemetryEvent(event: TelemetryEvent): void {
  learningLoopTelemetryWriteQueue = learningLoopTelemetryWriteQueue
    .catch(() => {
      // Keep later learning-loop telemetry writes from being blocked by an earlier storage failure.
    })
    .then(async () => {
      const stored = await browser.storage.local.get(TELEMETRY_STORAGE_KEY)
      const existing = parseStoredTelemetryEvents(stored[TELEMETRY_STORAGE_KEY])
      const updated = [event, ...existing]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_TELEMETRY_EVENTS)
      await browser.storage.local.set({ [TELEMETRY_STORAGE_KEY]: updated })
    })

  void learningLoopTelemetryWriteQueue.catch(() => {
    // Fire-and-forget — never surface telemetry storage errors.
  })
}

export function recordLearningLoopEvent(
  event: LearningLoopEventName,
  data: Record<string, unknown> = {},
): void {
  const now = Date.now()
  enqueueLearningLoopTelemetryEvent({
    id: createLearningLoopTelemetryId(now),
    timestamp: now,
    type: "feature_usage",
    data: {
      feature: "learning_loop",
      event,
      ...data,
    },
  })
}
