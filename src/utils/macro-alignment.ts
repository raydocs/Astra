export type AstraCompetitiveRemediationResponsibilityId =
  | "trusted_page_translation"
  | "trusted_video_subtitles"
  | "zero_config_technical_chain"
  | "read_frog_immersive_parity"

export type AstraMacroUpgradeResponsibilityId =
  | "new_user_activation"
  | "payment_reason"
  | "learning_asset_accumulation"
  | "long_term_retention"
  | "user_trust"
  | "brand_differentiation"

export type AstraFinalConclusionPillarId =
  | "first_use_success"
  | "no_ai_configuration"
  | "saved_content_not_black_hole"
  | "daily_review_guidance"
  | "pages_videos_files_become_assets"
  | "astra_understands_learning_needs"
  | "paid_for_peace_of_mind_loop_assets"

export type AstraMacroAlignmentReadinessCode =
  | "competitive_responsibilities_clear"
  | "macro_upgrade_responsibilities_clear"
  | "remediation_feeds_product_upgrade"
  | "final_pillars_covered"
  | "not_more_translation_buttons"
  | "long_term_language_ability_promise"

export interface AstraCompetitiveRemediationResponsibility {
  id: AstraCompetitiveRemediationResponsibilityId
  label: string
  boundary: string
}

export interface AstraMacroUpgradeResponsibility {
  id: AstraMacroUpgradeResponsibilityId
  label: string
  evidenceDirection: string
}

export interface AstraFinalConclusionPillar {
  id: AstraFinalConclusionPillarId
  statement: string
  evidenceDirection: string
}

export interface AstraMacroAlignmentReadinessEvidence {
  competitiveRemediationResponsibilitiesClear: boolean
  macroUpgradeResponsibilitiesClear: boolean
  remediationFeedsProductUpgrade: boolean
  finalConclusionPillarsCovered: boolean
  defaultPositioningNotMoreTranslationButtons: boolean
  astraTurnsContentIntoLongTermAbility: boolean
}

export interface AstraMacroAlignmentReadinessFinding {
  code: AstraMacroAlignmentReadinessCode
  severity: "block" | "warn"
  message: string
  nextStep: string
}

export interface AstraMacroAlignmentReadinessDecision {
  ready: boolean
  blockers: AstraMacroAlignmentReadinessFinding[]
  warnings: AstraMacroAlignmentReadinessFinding[]
  findings: AstraMacroAlignmentReadinessFinding[]
}

export const ASTRA_COMPETITIVE_REMEDIATION_RESPONSIBILITIES: AstraCompetitiveRemediationResponsibility[] = [
  {
    id: "trusted_page_translation",
    label: "Trusted page translation",
    boundary: "Competitive remediation proves web/page translation reliability; macro product work should not re-open DOM strategy breakdowns.",
  },
  {
    id: "trusted_video_subtitles",
    label: "Trusted video and subtitle experience",
    boundary: "Competitive remediation proves video/subtitle capability; macro product work converts video moments into learning assets and retention.",
  },
  {
    id: "zero_config_technical_chain",
    label: "Zero-config technical chain",
    boundary: "Engineering proves managed routing, provider, relay, cache, and service-mode reliability; macro product work keeps those details invisible to default users.",
  },
  {
    id: "read_frog_immersive_parity",
    label: "Read Frog / Immersive core parity",
    boundary: "Competitive remediation reaches or exceeds core comprehension capability; macro product work differentiates through learning memory and paid retention.",
  },
]

export const ASTRA_MACRO_UPGRADE_RESPONSIBILITIES: AstraMacroUpgradeResponsibility[] = [
  { id: "new_user_activation", label: "New user activation", evidenceDirection: "First success path, sample lesson, onboarding scope, activation metrics." },
  { id: "payment_reason", label: "Reason to pay", evidenceDirection: "Membership value, no setup, stability, quality, learning loop, assets, support." },
  { id: "learning_asset_accumulation", label: "Learning asset accumulation", evidenceDirection: "Saved snippets/cards/sources, Library, Review, export/delete controls." },
  { id: "long_term_retention", label: "Long-term retention", evidenceDirection: "Daily Review, Digest, continue learning, win-back/retention guardrails." },
  { id: "user_trust", label: "User trust", evidenceDirection: "Privacy controls, support metadata, accurate claims, data retention boundaries." },
  { id: "brand_differentiation", label: "Brand differentiation", evidenceDirection: "Quiet, learning-first, non-technical, refined product tone." },
]

export const ASTRA_FINAL_CONCLUSION_PILLARS: AstraFinalConclusionPillar[] = [
  {
    id: "first_use_success",
    statement: "Users succeed quickly the first time they use Astra.",
    evidenceDirection: "Install → language → optional sign-in → first understanding → save → first Review.",
  },
  {
    id: "no_ai_configuration",
    statement: "Users do not configure AI before value.",
    evidenceDirection: "Default path hides provider/API/model/prompt details and uses managed AI copy.",
  },
  {
    id: "saved_content_not_black_hole",
    statement: "Saved content does not disappear into a black hole.",
    evidenceDirection: "Save feedback explains Review/Library destination, queue progress, and source linkage.",
  },
  {
    id: "daily_review_guidance",
    statement: "Users know what to review each day.",
    evidenceDirection: "Light due-card Review, daily goal sizing, Done for today and Review today surfaces.",
  },
  {
    id: "pages_videos_files_become_assets",
    statement: "Pages, videos, and files gradually become personal learning assets.",
    evidenceDirection: "Source-backed Library, learning asset object model, source controls, digest, export/delete boundaries.",
  },
  {
    id: "astra_understands_learning_needs",
    statement: "Astra understands the learner more over time.",
    evidenceDirection: "Lightweight profile, personalization controls, glossary/memory inventory, reversible write policy.",
  },
  {
    id: "paid_for_peace_of_mind_loop_assets",
    statement: "Users pay for peace of mind, stability, learning loop, and asset accumulation.",
    evidenceDirection: "Membership value contract, paywall strategy, support, managed AI, continuity, Digest.",
  },
]

export const ASTRA_MACRO_ALIGNMENT_SUMMARY = {
  competitiveRemediationGoal: "Make Astra core comprehension capability trustworthy and competitive.",
  macroUpgradeGoal: "Make Astra chargeable, retainable, and accumulative as a learning platform.",
  oneLineConclusion: "Read Frog and Immersive mainly help users understand current content; Astra should help users turn current content into long-term language ability.",
} as const

const READINESS_CHECKS: Array<{
  code: AstraMacroAlignmentReadinessCode
  evidenceKey: keyof AstraMacroAlignmentReadinessEvidence
  severity: "block" | "warn"
  message: string
  nextStep: string
}> = [
  { code: "competitive_responsibilities_clear", evidenceKey: "competitiveRemediationResponsibilitiesClear", severity: "block", message: "Competitive remediation responsibilities are not clearly separated.", nextStep: "Keep page translation, video/subtitle, zero-config chain, and competitor parity engineering in remediation lanes." },
  { code: "macro_upgrade_responsibilities_clear", evidenceKey: "macroUpgradeResponsibilitiesClear", severity: "block", message: "Macro upgrade responsibilities are unclear.", nextStep: "Define activation, payment reason, learning assets, retention, trust, and brand differentiation evidence." },
  { code: "remediation_feeds_product_upgrade", evidenceKey: "remediationFeedsProductUpgrade", severity: "warn", message: "Engineering remediation is not tied to the macro product upgrade.", nextStep: "Show how trusted comprehension feeds first success, saving, Review, Library, Digest, and membership value." },
  { code: "final_pillars_covered", evidenceKey: "finalConclusionPillarsCovered", severity: "block", message: "The final conclusion pillars are not all covered.", nextStep: "Cover first success, no AI setup, save destination, daily review, asset accumulation, personalization, and paid value." },
  { code: "not_more_translation_buttons", evidenceKey: "defaultPositioningNotMoreTranslationButtons", severity: "block", message: "Astra positioning still sounds like more translation buttons.", nextStep: "Position Astra around learning memory and asset accumulation, not feature-count parity." },
  { code: "long_term_language_ability_promise", evidenceKey: "astraTurnsContentIntoLongTermAbility", severity: "block", message: "The product promise does not reach long-term language ability.", nextStep: "Show how current content becomes saved assets, Review, source return, Digest, and personalized learning memory." },
]

export function evaluateAstraMacroAlignmentReadiness(evidence: AstraMacroAlignmentReadinessEvidence): AstraMacroAlignmentReadinessDecision {
  const findings = READINESS_CHECKS
    .filter((check) => !evidence[check.evidenceKey])
    .map<AstraMacroAlignmentReadinessFinding>((check) => ({
      code: check.code,
      severity: check.severity,
      message: check.message,
      nextStep: check.nextStep,
    }))
  const blockers = findings.filter((finding) => finding.severity === "block")
  const warnings = findings.filter((finding) => finding.severity === "warn")
  return { ready: blockers.length === 0, blockers, warnings, findings }
}
