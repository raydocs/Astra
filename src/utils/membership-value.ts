export type AstraMembershipValueReasonId =
  | "zero_ai_setup"
  | "automatic_capability_choice"
  | "stable_service"
  | "faster_understanding"
  | "higher_quality_understanding"
  | "unified_pages_videos_files"
  | "saveable_content"
  | "automatic_review"
  | "multi_device_continuity"
  | "support_and_maintenance"

export type AstraMembershipValueMomentId =
  | "first_high_quality_explanation"
  | "saved_multiple_sentences"
  | "long_content_summary"
  | "cross_device_sync"
  | "long_video_learning"
  | "learning_data_export"

export type AstraMembershipCopyPrincipleId = "preferred" | "forbidden"

export type AstraMembershipTierId = "free" | "pro" | "premium_family_classroom_later"

export type AstraMembershipReadinessCode =
  | "value_not_more_times_only"
  | "no_opening_hard_sell"
  | "value_moments_covered"
  | "preferred_copy_present"
  | "forbidden_technical_copy_absent"
  | "free_boundary_clear"
  | "pro_boundary_clear"
  | "later_tiers_deferred"
  | "existing_assets_accessible"

export interface AstraMembershipValueReasonDefinition {
  id: AstraMembershipValueReasonId
  label: string
  userBenefit: string
}

export interface AstraMembershipValueMomentDefinition {
  id: AstraMembershipValueMomentId
  label: string
  promptStyle: "near_value" | "soft_hint" | "hard_block_after_value"
  recommendedCopy: string
}

export interface AstraMembershipCopyExample {
  text: string
  principle: AstraMembershipCopyPrincipleId
  reason: string
}

export interface AstraMembershipTierDefinition {
  id: AstraMembershipTierId
  label: string
  launchTiming: "now" | "pro_launch" | "later"
  capabilities: string[]
  boundary: string
}

export interface AstraMembershipReadinessEvidence {
  valueFramedBeyondMoreUsage: boolean
  noHardSellBeforeValue: boolean
  valueMomentsCoveredNearFeature: boolean
  preferredCopyPresent: boolean
  forbiddenTechnicalCopyAbsent: boolean
  freeBoundaryClear: boolean
  proBoundaryClear: boolean
  premiumFamilyClassroomDeferred: boolean
  cancellationKeepsExistingAssetsAccessible: boolean
}

export interface AstraMembershipReadinessFinding {
  code: AstraMembershipReadinessCode
  severity: "block" | "warn"
  message: string
  nextStep: string
}

export interface AstraMembershipReadinessDecision {
  ready: boolean
  blockers: AstraMembershipReadinessFinding[]
  warnings: AstraMembershipReadinessFinding[]
  findings: AstraMembershipReadinessFinding[]
}

export const ASTRA_MEMBERSHIP_VALUE_REASONS: AstraMembershipValueReasonDefinition[] = [
  { id: "zero_ai_setup", label: "No AI setup", userBenefit: "Astra handles provider, key, and model complexity for ordinary learners." },
  { id: "automatic_capability_choice", label: "Automatic capability choice", userBenefit: "Astra chooses the right capability for page, video, file, or review tasks." },
  { id: "stable_service", label: "Stability", userBenefit: "Learning flows keep working without the user debugging infrastructure." },
  { id: "faster_understanding", label: "Faster understanding", userBenefit: "Long or difficult content becomes understandable sooner." },
  { id: "higher_quality_understanding", label: "Higher quality understanding", userBenefit: "Explanations, summaries, and review cards are more useful for learning." },
  { id: "unified_pages_videos_files", label: "Unified pages, videos, and files", userBenefit: "The same learning loop works across high-value content surfaces." },
  { id: "saveable_content", label: "Saveable content", userBenefit: "Useful sentences and words become durable learning assets." },
  { id: "automatic_review", label: "Automatic Review", userBenefit: "Saved learning moments turn into Review without manual deck building." },
  { id: "multi_device_continuity", label: "Multi-device continuity", userBenefit: "Learning can continue across extension, web companion, and future companion surfaces." },
  { id: "support_and_maintenance", label: "Support and maintenance", userBenefit: "Users get ongoing help, fixes, and maintained learning infrastructure." },
]

export const ASTRA_MEMBERSHIP_VALUE_MOMENTS: AstraMembershipValueMomentDefinition[] = [
  { id: "first_high_quality_explanation", label: "First high-quality explanation", promptStyle: "soft_hint", recommendedCopy: "Included with your membership: deeper explanations when the content gets difficult." },
  { id: "saved_multiple_sentences", label: "Saved multiple sentences", promptStyle: "near_value", recommendedCopy: "Your saved sentences become review cards." },
  { id: "long_content_summary", label: "Long content summary", promptStyle: "hard_block_after_value", recommendedCopy: "Best for long or technical content." },
  { id: "cross_device_sync", label: "Cross-device sync", promptStyle: "hard_block_after_value", recommendedCopy: "Keep learning across devices." },
  { id: "long_video_learning", label: "Long video learning", promptStyle: "hard_block_after_value", recommendedCopy: "Longer videos are included with Pro." },
  { id: "learning_data_export", label: "Learning data export", promptStyle: "hard_block_after_value", recommendedCopy: "Export your learning assets while existing saved items stay accessible." },
]

export const ASTRA_MEMBERSHIP_COPY_EXAMPLES: AstraMembershipCopyExample[] = [
  { text: "Included with your membership", principle: "preferred", reason: "Frames value as included support near the feature." },
  { text: "Astra handles the AI for you", principle: "preferred", reason: "Explains managed AI without exposing infrastructure." },
  { text: "Your saved sentences become review cards", principle: "preferred", reason: "Links payment value to learning assets." },
  { text: "Keep learning across devices", principle: "preferred", reason: "Frames sync as continuity rather than configuration." },
  { text: "Best for long or technical content", principle: "preferred", reason: "Explains higher-value content moments in user language." },
  { text: "Unlock provider routing", principle: "forbidden", reason: "Provider routing is internal infrastructure language." },
  { text: "Use premium model", principle: "forbidden", reason: "Model tier language sells implementation details." },
  { text: "Increase token quota", principle: "forbidden", reason: "Token quota is not a user-facing learning value." },
  { text: "Relay usage exceeded", principle: "forbidden", reason: "Relay usage is diagnostic/backend language." },
]

export const ASTRA_MEMBERSHIP_TIERS: AstraMembershipTierDefinition[] = [
  {
    id: "free",
    label: "Free",
    launchTiming: "now",
    capabilities: [
      "small daily understanding allowance",
      "selection and short-text experience",
      "small saved-word/sentence set",
      "local basic Review",
      "sample content experience",
    ],
    boundary: "Free proves first value and the lightweight learning loop without opening a hard sell.",
  },
  {
    id: "pro",
    label: "Pro",
    launchTiming: "pro_launch",
    capabilities: [
      "managed AI",
      "higher fair-use limits",
      "high-quality understanding",
      "video learning",
      "file learning",
      "learning asset library",
      "sync",
      "Learning Digest",
    ],
    boundary: "Pro sells a reliable managed learning system, not just more calls or tokens.",
  },
  {
    id: "premium_family_classroom_later",
    label: "Premium / Family / Classroom later",
    launchTiming: "later",
    capabilities: [
      "longer videos",
      "higher-quality model class where legally and operationally ready",
      "multiple users",
      "export",
      "classroom or family management",
      "specialized learning plans",
    ],
    boundary: "Later tiers must stay deferred until billing, abuse, support, legal, and product evidence exist.",
  },
]

export const ASTRA_MEMBERSHIP_FORBIDDEN_TERMS = ["provider", "routing", "premium model", "token quota", "relay usage", "tokens"] as const

export function findMembershipForbiddenCopyTerms(copy: string): string[] {
  const normalized = copy.toLowerCase()
  return Array.from(new Set(ASTRA_MEMBERSHIP_FORBIDDEN_TERMS.filter((term) => normalized.includes(term))))
}

const READINESS_CHECKS: Array<{
  code: AstraMembershipReadinessCode
  evidenceKey: keyof AstraMembershipReadinessEvidence
  severity: "block" | "warn"
  message: string
  nextStep: string
}> = [
  { code: "value_not_more_times_only", evidenceKey: "valueFramedBeyondMoreUsage", severity: "block", message: "Membership value is framed as only more usage.", nextStep: "Frame value around zero setup, managed AI, quality, stability, unified surfaces, saving, Review, continuity, support, and maintenance." },
  { code: "no_opening_hard_sell", evidenceKey: "noHardSellBeforeValue", severity: "block", message: "Membership is hard-sold before the learner experiences value.", nextStep: "Move membership prompts near feature value and keep first success unblocked." },
  { code: "value_moments_covered", evidenceKey: "valueMomentsCoveredNearFeature", severity: "block", message: "Membership prompts are not tied to the required value moments.", nextStep: "Cover high-quality explanation, multiple saves, long summary, sync, long video, and export moments." },
  { code: "preferred_copy_present", evidenceKey: "preferredCopyPresent", severity: "warn", message: "Preferred user-facing membership copy is not represented.", nextStep: "Use copy such as Included with your membership, Astra handles the AI for you, saved sentences become review cards, and Keep learning across devices." },
  { code: "forbidden_technical_copy_absent", evidenceKey: "forbiddenTechnicalCopyAbsent", severity: "block", message: "Membership copy exposes provider/model/token/relay internals.", nextStep: "Rewrite payment value around learning outcomes and managed service benefits." },
  { code: "free_boundary_clear", evidenceKey: "freeBoundaryClear", severity: "block", message: "Free boundary is unclear.", nextStep: "Define light daily understanding, selection/short text, small saves, local Review, and sample content." },
  { code: "pro_boundary_clear", evidenceKey: "proBoundaryClear", severity: "block", message: "Pro boundary is unclear.", nextStep: "Define managed AI, higher fair-use limits, quality, video/file learning, Library, sync, and Digest." },
  { code: "later_tiers_deferred", evidenceKey: "premiumFamilyClassroomDeferred", severity: "block", message: "Premium/Family/Classroom claims are not deferred.", nextStep: "Keep longer video/model-class/multi-user/export/classroom/specialized-plan claims later until evidence exists." },
  { code: "existing_assets_accessible", evidenceKey: "cancellationKeepsExistingAssetsAccessible", severity: "block", message: "Membership copy does not protect existing saved learning assets after cancellation.", nextStep: "State that existing saved learning assets remain accessible even if paid membership ends." },
]

export function evaluateAstraMembershipValueReadiness(evidence: AstraMembershipReadinessEvidence): AstraMembershipReadinessDecision {
  const findings = READINESS_CHECKS
    .filter((check) => !evidence[check.evidenceKey])
    .map<AstraMembershipReadinessFinding>((check) => ({
      code: check.code,
      severity: check.severity,
      message: check.message,
      nextStep: check.nextStep,
    }))
  const blockers = findings.filter((finding) => finding.severity === "block")
  const warnings = findings.filter((finding) => finding.severity === "warn")
  return { ready: blockers.length === 0, blockers, warnings, findings }
}
