export type AstraDigestContentItemId =
  | "pages_read_this_week"
  | "videos_watched_this_week"
  | "new_saved_words_sentences"
  | "reviewed_cards"
  | "common_topics"
  | "repeated_vocabulary"
  | "recommended_review"
  | "recommended_continue"

export type AstraDigestSurfaceId = "popup_card" | "web_companion_page" | "optional_email" | "optional_notification"

export type AstraDigestCopyExampleId =
  | "expressions_from_pages"
  | "quick_review_ready"
  | "repeated_word_across_sources"
  | "continue_video_timestamp"

export type AstraDigestReadinessCode =
  | "long_term_value_visible"
  | "weekly_content_coverage"
  | "review_and_continue_actions"
  | "low_interrupt_delivery"
  | "optional_email_notification_controls"
  | "example_copy_present"
  | "privacy_safe_summary"
  | "privacy_mode_channel_boundary"

export interface AstraDigestContentItemDefinition {
  id: AstraDigestContentItemId
  label: string
  purpose: string
  privacyBoundary: string
}

export interface AstraDigestSurfaceDefinition {
  id: AstraDigestSurfaceId
  label: string
  launchTiming: "now" | "later_optional"
  interruptionLevel: "low" | "medium"
  controlRequirement: string
}

export interface AstraDigestCopyExample {
  id: AstraDigestCopyExampleId
  copy: string
  purpose: string
  allowedData: string
}

export interface AstraDigestReadinessEvidence {
  showsLongTermLearningValue: boolean
  weeklyContentCoversRequiredItems: boolean
  includesReviewAndContinueActions: boolean
  deliveryIsLowInterruption: boolean
  emailAndNotificationAreOptionalAndControlled: boolean
  digestCopyExamplesRepresented: boolean
  summariesAvoidRawContentByDefault: boolean
  privacyModeRestrictsExternalDelivery: boolean
}

export interface AstraDigestReadinessFinding {
  code: AstraDigestReadinessCode
  severity: "block" | "warn"
  message: string
  nextStep: string
}

export interface AstraDigestReadinessDecision {
  ready: boolean
  blockers: AstraDigestReadinessFinding[]
  warnings: AstraDigestReadinessFinding[]
  findings: AstraDigestReadinessFinding[]
}

export const ASTRA_DIGEST_CONTENT_ITEMS: AstraDigestContentItemDefinition[] = [
  {
    id: "pages_read_this_week",
    label: "Pages read this week",
    purpose: "Show what the learner read from real content.",
    privacyBoundary: "Use counts, source titles/types, or hostnames; do not include page body text in telemetry.",
  },
  {
    id: "videos_watched_this_week",
    label: "Learning videos watched this week",
    purpose: "Show video learning activity and source continuity.",
    privacyBoundary: "Use counts, source titles/types, and timestamps only when user-visible; no full transcripts by default.",
  },
  {
    id: "new_saved_words_sentences",
    label: "New saved words and sentences",
    purpose: "Make saved learning assets visible.",
    privacyBoundary: "Counts by asset type are telemetry-safe; snippet text is user-visible content only, not event metadata.",
  },
  {
    id: "reviewed_cards",
    label: "Reviewed cards",
    purpose: "Show Review effort and progress.",
    privacyBoundary: "Counts and mastery state only; no card front/back in telemetry.",
  },
  {
    id: "common_topics",
    label: "Common topics",
    purpose: "Help learners see themes across real content.",
    privacyBoundary: "Use coarse topic labels only when derived under policy; avoid private inference in external delivery.",
  },
  {
    id: "repeated_vocabulary",
    label: "Repeated vocabulary",
    purpose: "Show terms worth reviewing because they recur.",
    privacyBoundary: "Use user-saved or confirmed terms; do not expose sensitive page text.",
  },
  {
    id: "recommended_review",
    label: "Recommended review",
    purpose: "Turn progress summary into a light next action.",
    privacyBoundary: "Use due-card counts and estimated time only.",
  },
  {
    id: "recommended_continue",
    label: "Recommended continue reading or watching",
    purpose: "Return users to source context for next week.",
    privacyBoundary: "Use source metadata and last position/timestamp; avoid full URL paths in telemetry.",
  },
]

export const ASTRA_DIGEST_SURFACES: AstraDigestSurfaceDefinition[] = [
  {
    id: "popup_card",
    label: "Popup small card",
    launchTiming: "now",
    interruptionLevel: "low",
    controlRequirement: "Shown in product only when there is digest value; no external delivery consent needed.",
  },
  {
    id: "web_companion_page",
    label: "Web companion page",
    launchTiming: "now",
    interruptionLevel: "low",
    controlRequirement: "User-initiated account/Library surface with metadata-safe summary.",
  },
  {
    id: "optional_email",
    label: "Optional email",
    launchTiming: "later_optional",
    interruptionLevel: "medium",
    controlRequirement: "Requires explicit opt-in or clear subscription state, unsubscribe, and Privacy Mode channel boundary.",
  },
  {
    id: "optional_notification",
    label: "Optional notification",
    launchTiming: "later_optional",
    interruptionLevel: "medium",
    controlRequirement: "Requires browser permission, low frequency, and easy disable controls.",
  },
]

export const ASTRA_DIGEST_COPY_EXAMPLES: AstraDigestCopyExample[] = [
  {
    id: "expressions_from_pages",
    copy: "You learned 12 expressions from 3 pages this week.",
    purpose: "Show accumulated learning value.",
    allowedData: "Expression count and page count.",
  },
  {
    id: "quick_review_ready",
    copy: "5 cards are ready for a quick review.",
    purpose: "Offer the next Review action.",
    allowedData: "Due-card count and light time framing.",
  },
  {
    id: "repeated_word_across_sources",
    copy: "You kept seeing “resilience” across two articles.",
    purpose: "Show repeated vocabulary from real content.",
    allowedData: "User-saved or confirmed term plus source count.",
  },
  {
    id: "continue_video_timestamp",
    copy: "Continue your YouTube lesson from 08:32.",
    purpose: "Return to a source continuation point.",
    allowedData: "Source label/type and timestamp.",
  },
]

const READINESS_CHECKS: Array<{
  code: AstraDigestReadinessCode
  evidenceKey: keyof AstraDigestReadinessEvidence
  severity: "block" | "warn"
  message: string
  nextStep: string
}> = [
  { code: "long_term_value_visible", evidenceKey: "showsLongTermLearningValue", severity: "block", message: "Digest does not show long-term learning value.", nextStep: "Summarize what the learner read/watched/saved/reviewed/mastered and what to do next." },
  { code: "weekly_content_coverage", evidenceKey: "weeklyContentCoversRequiredItems", severity: "block", message: "Weekly digest content coverage is incomplete.", nextStep: "Cover pages, videos, new saved words/sentences, reviewed cards, common topics, repeated vocabulary, recommended review, and recommended continue targets." },
  { code: "review_and_continue_actions", evidenceKey: "includesReviewAndContinueActions", severity: "block", message: "Digest lacks actionable review or continue-learning paths.", nextStep: "Include Start review and Continue source actions when there is qualifying content." },
  { code: "low_interrupt_delivery", evidenceKey: "deliveryIsLowInterruption", severity: "block", message: "Digest delivery is too interruptive.", nextStep: "Default to popup/Web companion surfaces and keep outbound delivery optional, low frequency, and user-controlled." },
  { code: "optional_email_notification_controls", evidenceKey: "emailAndNotificationAreOptionalAndControlled", severity: "block", message: "Email or notification digest lacks opt-in/disable/unsubscribe controls.", nextStep: "Require explicit delivery controls before enabling email or notification digest." },
  { code: "example_copy_present", evidenceKey: "digestCopyExamplesRepresented", severity: "warn", message: "Digest copy does not reflect the macro-plan examples.", nextStep: "Use examples for learned expressions, quick review, repeated vocabulary, and source continuation." },
  { code: "privacy_safe_summary", evidenceKey: "summariesAvoidRawContentByDefault", severity: "block", message: "Digest summaries may include raw page, transcript, or saved-snippet content by default.", nextStep: "Use counts, source titles/types, timestamps, and user-visible saved items only under explicit content policy." },
  { code: "privacy_mode_channel_boundary", evidenceKey: "privacyModeRestrictsExternalDelivery", severity: "block", message: "Privacy Mode does not constrain external digest delivery.", nextStep: "Prefer in-product summaries and suppress or reduce optional email/notification detail when Privacy Mode is enabled." },
]

export function evaluateAstraDigestReadiness(evidence: AstraDigestReadinessEvidence): AstraDigestReadinessDecision {
  const findings = READINESS_CHECKS
    .filter((check) => !evidence[check.evidenceKey])
    .map<AstraDigestReadinessFinding>((check) => ({
      code: check.code,
      severity: check.severity,
      message: check.message,
      nextStep: check.nextStep,
    }))
  const blockers = findings.filter((finding) => finding.severity === "block")
  const warnings = findings.filter((finding) => finding.severity === "warn")
  return { ready: blockers.length === 0, blockers, warnings, findings }
}
