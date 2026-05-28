export type AstraBrandFeelingId =
  | "quiet"
  | "automatic"
  | "reliable"
  | "refined"
  | "lightweight"
  | "clear"
  | "next_step_oriented"
  | "not_back_office"

export type AstraBrandUiPrincipleId =
  | "one_primary_action"
  | "low_frequency_collapsed"
  | "diagnostics_not_default"
  | "task_cards_not_setting_tables"
  | "status_pills"
  | "group_by_user_task"
  | "advanced_settings_secondary"
  | "error_cards_have_action"

export type AstraBrandReadinessCode =
  | "copy_avoids_back_office_terms"
  | "copy_uses_learning_tone"
  | "one_primary_action_per_screen"
  | "low_frequency_features_collapsed"
  | "diagnostics_hidden_by_default"
  | "task_card_layouts"
  | "status_pill_state_language"
  | "task_grouping_not_technical_modules"
  | "advanced_settings_secondary"
  | "error_cards_actionable"
  | "emotional_value_copy_present"
  | "token_based_visual_system"

export type AstraBrandDefaultSurfaceId =
  | "default_onboarding_copy"
  | "popup_deep_read_copy"
  | "library_review_copy"
  | "error_boundary_copy"
  | "store_landing_claim_freeze"

export interface AstraBrandFeelingDefinition {
  id: AstraBrandFeelingId
  label: string
  defaultSurfaceImplication: string
}

export interface AstraBrandUiPrincipleDefinition {
  id: AstraBrandUiPrincipleId
  rule: string
  defaultSurfaceImplication: string
}

export interface AstraBrandCopyRuleSet {
  sayLess: readonly string[]
  sayMore: readonly string[]
  emotionalCopy: readonly string[]
}

export interface AstraBrandDefaultSurfaceAuditItem {
  id: AstraBrandDefaultSurfaceId
  manualQaRow: string
  defaultSurface: string
  currentRepoEvidence: readonly string[]
  copyCheck: string
  uiCheck: string
  remainingReleaseProof: string
}

export interface AstraBrandDefaultSurfaceCopySample {
  surfaceId: AstraBrandDefaultSurfaceId
  copy: string
}

export interface AstraBrandDefaultSurfaceCopyFinding {
  surfaceId: AstraBrandDefaultSurfaceId
  discouragedTerms: string[]
  usesPreferredTone: boolean
  ready: boolean
}

export interface AstraBrandReadinessEvidence {
  copyAvoidsBackOfficeTerms: boolean
  copyUsesLearningTone: boolean
  onePrimaryActionPerScreen: boolean
  lowFrequencyFeaturesCollapsed: boolean
  diagnosticsHiddenByDefault: boolean
  taskCardLayoutsUsed: boolean
  statusPillStateLanguageUsed: boolean
  taskGroupingNotTechnicalModules: boolean
  advancedSettingsSecondary: boolean
  errorCardsHaveAction: boolean
  emotionalValueCopyPresent: boolean
  tokenBasedVisualSystemUsed: boolean
}

export interface AstraBrandReadinessFinding {
  code: AstraBrandReadinessCode
  severity: "block" | "warn"
  message: string
  nextStep: string
}

export interface AstraBrandReadinessDecision {
  ready: boolean
  blockers: AstraBrandReadinessFinding[]
  warnings: AstraBrandReadinessFinding[]
  findings: AstraBrandReadinessFinding[]
}

export const ASTRA_BRAND_FEELINGS: AstraBrandFeelingDefinition[] = [
  {
    id: "quiet",
    label: "Quiet",
    defaultSurfaceImplication: "Avoid noisy controls, competing CTAs, and infrastructure language on learning surfaces.",
  },
  {
    id: "automatic",
    label: "Automatic",
    defaultSurfaceImplication: "Astra should handle the AI path and present the user's next learning action.",
  },
  {
    id: "reliable",
    label: "Reliable",
    defaultSurfaceImplication: "Use explicit status, retry, fallback, and saved-state copy instead of vague failure text.",
  },
  {
    id: "refined",
    label: "Refined",
    defaultSurfaceImplication: "Use shared tokens, consistent spacing/radius, and focused cards instead of one-off control panels.",
  },
  {
    id: "lightweight",
    label: "Lightweight",
    defaultSurfaceImplication: "Collapse low-frequency controls and keep first-run/first-success surfaces short.",
  },
  {
    id: "clear",
    label: "Clear",
    defaultSurfaceImplication: "Use concrete user outcomes such as Saved for review, Keep reading, or Try again.",
  },
  {
    id: "next_step_oriented",
    label: "Has a next step",
    defaultSurfaceImplication: "Every success, empty, loading, and error state should point to a next user action.",
  },
  {
    id: "not_back_office",
    label: "Not like a back-office system",
    defaultSurfaceImplication: "Default UI should not look or read like diagnostics, routing, quota, or provider administration.",
  },
]

export const ASTRA_BRAND_COPY_RULES: AstraBrandCopyRuleSet = {
  sayLess: [
    "Configure",
    "Provider",
    "Route",
    "Relay",
    "Token",
    "Debug",
    "Advanced",
    "Error code",
  ],
  sayMore: [
    "Ready",
    "Done",
    "Keep reading",
    "Review later",
    "Saved for review",
    "Astra handled it",
    "Best for this content",
    "Try again",
  ],
  emotionalCopy: [
    "Nice — your first review card is ready.",
    "You are building a learning trail from real content.",
    "Done for today.",
    "You came back 3 days in a row.",
  ],
}

export const ASTRA_BRAND_DEFAULT_SURFACE_AUDIT: AstraBrandDefaultSurfaceAuditItem[] = [
  {
    id: "default_onboarding_copy",
    manualQaRow: "Default onboarding copy",
    defaultSurface: "First-run onboarding and sample/ready path",
    currentRepoEvidence: ["src/entrypoints/onboarding/OnboardingApp.tsx", "src/entrypoints/onboarding/OnboardingApp.test.tsx"],
    copyCheck: "First-run setup avoids provider/model/source-language/style setup and uses direct learning-outcome language.",
    uiCheck: "Onboarding keeps one primary step action and leaves advanced controls outside the default first-run path.",
    remainingReleaseProof: "Attach current Section 13 owner/date/environment/evidence rows and screenshot/browser walkthroughs before brand-quality completion claims.",
  },
  {
    id: "popup_deep_read_copy",
    manualQaRow: "Popup / Deep Read copy",
    defaultSurface: "Popup, Deep Read, and selection learning actions",
    currentRepoEvidence: ["src/entrypoints/popup/App.tsx", "src/entrypoints/content/components/FloatBall.tsx"],
    copyCheck: "Default CTAs should prefer Read, Keep reading, Save, Review, Ready, or Try again over routing/provider terms.",
    uiCheck: "Primary reading action stays dominant while diagnostics/support paths remain secondary.",
    remainingReleaseProof: "Attach current popup/content-overlay screenshots and Section 13 manual verdict rows before stronger aesthetic claims.",
  },
  {
    id: "library_review_copy",
    manualQaRow: "Library / Review copy",
    defaultSurface: "Library, Weekly Digest, and Review loop",
    currentRepoEvidence: ["src/entrypoints/vocabulary/VocabularyApp.tsx", "src/entrypoints/vocabulary/ReviewMode.tsx", "src/entrypoints/vocabulary/VocabularyApp.test.tsx", "src/entrypoints/vocabulary/ReviewMode.test.tsx"],
    copyCheck: "Library/Review copy should emphasize Saved, Due, Done, Review, Continue, and learning progress rather than technical storage modules.",
    uiCheck: "Learning assets and Review grades are grouped as learner tasks, not provider/cache/settings tables.",
    remainingReleaseProof: "Attach current Library/Review browser walkthroughs and Section 13 manual verdict rows before claiming broad polish.",
  },
  {
    id: "error_boundary_copy",
    manualQaRow: "Error/boundary copy",
    defaultSurface: "Errors, known limitations, degraded status, and support/report boundaries",
    currentRepoEvidence: ["docs/help/known-limitations.md", "docs/status.md", "src/utils/support-experience.ts", "src/utils/support-experience.test.ts"],
    copyCheck: "Boundary copy should explain what happened in user language and give Try again, Keep reading, Report, or Learn more actions.",
    uiCheck: "Diagnostics and incident detail are available only through support/operator paths, not the default learning moment.",
    remainingReleaseProof: "Attach current error-state screenshots plus support/degraded-path Section 13 manual QA before stronger reliability-tone claims.",
  },
  {
    id: "store_landing_claim_freeze",
    manualQaRow: "Store/landing copy claim freeze",
    defaultSurface: "Store listing, website, demos, and release-note copy",
    currentRepoEvidence: ["store/listing-copy.md", "docs/reviews/macro-gate-4-claim-review-2026-05-28.md", "docs/reviews/macro-rc-evidence-packet-2026-05-28.md"],
    copyCheck: "Public copy must keep paid, platform, privacy, quality, accessibility, and learning-outcome claims downgraded unless stronger evidence is attached.",
    uiCheck: "Launch surfaces must not convert repo implementation evidence into production, paid, compliance, or universal-support claims.",
    remainingReleaseProof: "Attach final hosted/store copy review, screenshots, owner approval, and external evidence before launch-quality brand claims.",
  },
]

export const ASTRA_BRAND_UI_PRINCIPLES: AstraBrandUiPrincipleDefinition[] = [
  {
    id: "one_primary_action",
    rule: "One screen should have one primary action.",
    defaultSurfaceImplication: "Show a dominant next learning action; demote peer actions to secondary controls.",
  },
  {
    id: "low_frequency_collapsed",
    rule: "Low-frequency features are collapsed.",
    defaultSurfaceImplication: "Keep diagnostics, export, raw settings, and rare tools out of the default view.",
  },
  {
    id: "diagnostics_not_default",
    rule: "Diagnostics do not appear by default.",
    defaultSurfaceImplication: "Diagnostics belong in support, options, or operator paths, not the first learning moment.",
  },
  {
    id: "task_cards_not_setting_tables",
    rule: "Use task cards rather than setting tables.",
    defaultSurfaceImplication: "Default UI should group around read, save, review, continue, and digest tasks.",
  },
  {
    id: "status_pills",
    rule: "Use status pills for meaningful state.",
    defaultSurfaceImplication: "Prefer small, readable status language such as Ready, Saved, Due, Synced, or Try again.",
  },
  {
    id: "group_by_user_task",
    rule: "Group by user task rather than technical module.",
    defaultSurfaceImplication: "Avoid provider/route/model/cache groupings in default user-facing surfaces.",
  },
  {
    id: "advanced_settings_secondary",
    rule: "Advanced settings live behind a secondary entry.",
    defaultSurfaceImplication: "Advanced controls may exist, but they should not shape onboarding, popup, Review, Library, or paywall defaults.",
  },
  {
    id: "error_cards_have_action",
    rule: "Error cards must have an action.",
    defaultSurfaceImplication: "Every error should offer Try again, Keep reading, Change settings, Report, or Learn more.",
  },
]

const READINESS_CHECKS: Array<{
  code: AstraBrandReadinessCode
  evidenceKey: keyof AstraBrandReadinessEvidence
  severity: "block" | "warn"
  message: string
  nextStep: string
}> = [
  {
    code: "copy_avoids_back_office_terms",
    evidenceKey: "copyAvoidsBackOfficeTerms",
    severity: "block",
    message: "Default copy still contains back-office or infrastructure terms.",
    nextStep: "Replace Configure/Provider/Route/Relay/Token/Debug/Advanced/Error code copy with user-outcome language.",
  },
  {
    code: "copy_uses_learning_tone",
    evidenceKey: "copyUsesLearningTone",
    severity: "block",
    message: "Default copy does not use Astra's quiet learning tone.",
    nextStep: "Use Ready, Done, Keep reading, Review later, Saved for review, Astra handled it, Best for this content, or Try again where appropriate.",
  },
  {
    code: "one_primary_action_per_screen",
    evidenceKey: "onePrimaryActionPerScreen",
    severity: "block",
    message: "A default surface presents competing primary actions.",
    nextStep: "Choose one dominant user task and demote secondary actions.",
  },
  {
    code: "low_frequency_features_collapsed",
    evidenceKey: "lowFrequencyFeaturesCollapsed",
    severity: "block",
    message: "Low-frequency features are visible in a default learning surface.",
    nextStep: "Collapse diagnostics, export, raw settings, and rare tools behind secondary paths.",
  },
  {
    code: "diagnostics_hidden_by_default",
    evidenceKey: "diagnosticsHiddenByDefault",
    severity: "block",
    message: "Diagnostics appear by default on a learning surface.",
    nextStep: "Move diagnostics to support/options/operator paths and keep the learning task primary.",
  },
  {
    code: "task_card_layouts",
    evidenceKey: "taskCardLayoutsUsed",
    severity: "warn",
    message: "Default UI is not consistently organized as task cards.",
    nextStep: "Use task cards for read, save, review, continue, digest, and support flows before raw settings tables.",
  },
  {
    code: "status_pill_state_language",
    evidenceKey: "statusPillStateLanguageUsed",
    severity: "warn",
    message: "State language is not consistently expressed through clear status pills or equivalent labels.",
    nextStep: "Use concise status labels such as Ready, Saved, Due, Synced, Done, or Try again.",
  },
  {
    code: "task_grouping_not_technical_modules",
    evidenceKey: "taskGroupingNotTechnicalModules",
    severity: "block",
    message: "Default UI is grouped by technical modules rather than user tasks.",
    nextStep: "Group around user tasks and move provider/route/model/cache details out of default surfaces.",
  },
  {
    code: "advanced_settings_secondary",
    evidenceKey: "advancedSettingsSecondary",
    severity: "block",
    message: "Advanced settings shape the default user experience.",
    nextStep: "Place advanced controls behind secondary settings or expert paths.",
  },
  {
    code: "error_cards_actionable",
    evidenceKey: "errorCardsHaveAction",
    severity: "block",
    message: "Some error cards lack an explicit recovery action.",
    nextStep: "Add Try again, Keep reading, Change settings, Report, or Learn more actions.",
  },
  {
    code: "emotional_value_copy_present",
    evidenceKey: "emotionalValueCopyPresent",
    severity: "warn",
    message: "Learning-achievement copy is not present in the main loop.",
    nextStep: "Add achievement copy for first review card, learning trail, done-for-today, or streak moments.",
  },
  {
    code: "token_based_visual_system",
    evidenceKey: "tokenBasedVisualSystemUsed",
    severity: "warn",
    message: "Visual styling is not proven to use the shared Astra token system.",
    nextStep: "Prefer src/assets/astra-style1-tokens.css and shared UI primitives over one-off colors/spacing.",
  },
]

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function findDiscouragedBrandTerms(copy: string): string[] {
  return ASTRA_BRAND_COPY_RULES.sayLess.filter((term) => {
    const escaped = escapeRegExp(term.toLowerCase())
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(copy.toLowerCase())
  })
}

export function copyUsesPreferredBrandTone(copy: string): boolean {
  const normalized = copy.toLowerCase()
  return ASTRA_BRAND_COPY_RULES.sayMore.some((phrase) => normalized.includes(phrase.toLowerCase()))
}

export function evaluateAstraBrandDefaultSurfaceCopyAudit(
  samples: readonly AstraBrandDefaultSurfaceCopySample[],
): AstraBrandDefaultSurfaceCopyFinding[] {
  return samples.map((sample) => {
    const discouragedTerms = findDiscouragedBrandTerms(sample.copy)
    const usesPreferredTone = copyUsesPreferredBrandTone(sample.copy)

    return {
      surfaceId: sample.surfaceId,
      discouragedTerms,
      usesPreferredTone,
      ready: discouragedTerms.length === 0 && usesPreferredTone,
    }
  })
}

export function evaluateAstraBrandExperienceReadiness(
  evidence: AstraBrandReadinessEvidence,
): AstraBrandReadinessDecision {
  const findings = READINESS_CHECKS
    .filter((check) => !evidence[check.evidenceKey])
    .map<AstraBrandReadinessFinding>((check) => ({
      code: check.code,
      severity: check.severity,
      message: check.message,
      nextStep: check.nextStep,
    }))

  const blockers = findings.filter((finding) => finding.severity === "block")
  const warnings = findings.filter((finding) => finding.severity === "warn")

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
    findings,
  }
}
