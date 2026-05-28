export type AstraPrivacyConcernId =
  | "page_content_upload"
  | "learning_record_visibility"
  | "saved_content_deletion"
  | "page_save_opt_out"
  | "cancellation_data_access"

export type AstraTrustCardSurfaceId = "onboarding" | "settings" | "library"

export type AstraTrustCardMessageId =
  | "needed_text_only"
  | "user_chooses_saved"
  | "privacy_mode_reduces_context"
  | "delete_saved_learning_data"

export type AstraPrivacyControlId =
  | "privacy_mode"
  | "do_not_save_current_page"
  | "delete_current_page_learning_record"
  | "delete_video_note"
  | "delete_all_learning_data"
  | "export_my_data"
  | "disable_reading_history_sync"
  | "delete_account_data"

export type AstraPrivacyOverclaimId =
  | "fully_local"
  | "never_uploads"
  | "end_to_end_encrypted"
  | "absolutely_no_logs"
  | "all_pages_safe"

export type AstraTrustPrivacyReadinessCode =
  | "concerns_answered"
  | "trust_cards_present"
  | "ordinary_language_copy"
  | "privacy_controls_visible"
  | "overclaims_absent"
  | "privacy_mode_copy_accurate"
  | "cancellation_data_boundary"

export interface AstraPrivacyConcernDefinition {
  id: AstraPrivacyConcernId
  userQuestion: string
  answerDirection: string
}

export interface AstraTrustCardMessageDefinition {
  id: AstraTrustCardMessageId
  english: string
  chineseDirection: string
  surfaces: AstraTrustCardSurfaceId[]
}

export interface AstraPrivacyControlDefinition {
  id: AstraPrivacyControlId
  label: string
  requiredForP0: boolean
  userOutcome: string
}

export interface AstraPrivacyOverclaimDefinition {
  id: AstraPrivacyOverclaimId
  forbiddenCopy: string
  saferBoundary: string
}

export interface AstraTrustPrivacyReadinessEvidence {
  userConcernsAnswered: boolean
  trustCardsShownInCoreSurfaces: boolean
  trustCopyUsesOrdinaryLanguage: boolean
  requiredPrivacyControlsVisible: boolean
  overclaimCopyAbsent: boolean
  privacyModeCopyAccurate: boolean
  cancellationDataBoundaryClear: boolean
}

export interface AstraTrustPrivacyReadinessFinding {
  code: AstraTrustPrivacyReadinessCode
  severity: "block" | "warn"
  message: string
  nextStep: string
}

export interface AstraTrustPrivacyReadinessDecision {
  ready: boolean
  blockers: AstraTrustPrivacyReadinessFinding[]
  warnings: AstraTrustPrivacyReadinessFinding[]
  findings: AstraTrustPrivacyReadinessFinding[]
}

export const ASTRA_PRIVACY_USER_CONCERNS: AstraPrivacyConcernDefinition[] = [
  {
    id: "page_content_upload",
    userQuestion: "Will my page content be uploaded?",
    answerDirection: "Explain that Astra sends only text needed for the chosen understanding action and does not include page text in support reports by default.",
  },
  {
    id: "learning_record_visibility",
    userQuestion: "Can other people see my learning records?",
    answerDirection: "Explain that learning records are private account/local learning data, with support/operator views staying metadata-first.",
  },
  {
    id: "saved_content_deletion",
    userQuestion: "Can I delete what I saved?",
    answerDirection: "Expose delete controls for saved items, source learning records, and broader learning data.",
  },
  {
    id: "page_save_opt_out",
    userQuestion: "Can I avoid saving some pages?",
    answerDirection: "Provide Privacy Mode, per-source controls, site exclusion, or equivalent no-save paths.",
  },
  {
    id: "cancellation_data_access",
    userQuestion: "What happens to data after membership cancellation?",
    answerDirection: "State that existing saved learning assets remain accessible while paid-only generation/sync/export behavior follows plan boundaries.",
  },
]

export const ASTRA_TRUST_CARD_MESSAGES: AstraTrustCardMessageDefinition[] = [
  {
    id: "needed_text_only",
    english: "Astra only sends the text needed to help you understand content.",
    chineseDirection: "Astra 只处理帮你理解内容所需的文本。",
    surfaces: ["onboarding", "settings", "library"],
  },
  {
    id: "user_chooses_saved",
    english: "You choose what gets saved.",
    chineseDirection: "你可以决定哪些内容保存。",
    surfaces: ["onboarding", "settings", "library"],
  },
  {
    id: "privacy_mode_reduces_context",
    english: "Privacy Mode reduces page context.",
    chineseDirection: "隐私模式会减少上下文。",
    surfaces: ["settings", "library"],
  },
  {
    id: "delete_saved_learning_data",
    english: "You can delete your saved learning data anytime.",
    chineseDirection: "你可以随时删除学习数据。",
    surfaces: ["settings", "library"],
  },
]

export const ASTRA_PRIVACY_CONTROLS: AstraPrivacyControlDefinition[] = [
  { id: "privacy_mode", label: "Privacy Mode", requiredForP0: true, userOutcome: "Reduce page context and automatic memory use for sensitive moments." },
  { id: "do_not_save_current_page", label: "Do not save this page", requiredForP0: true, userOutcome: "Avoid adding current source context to learning memory or Library." },
  { id: "delete_current_page_learning_record", label: "Delete this page's learning record", requiredForP0: true, userOutcome: "Remove source-level learning history and choose linked-card behavior." },
  { id: "delete_video_note", label: "Delete video note", requiredForP0: true, userOutcome: "Remove a saved video note or timestamp learning moment." },
  { id: "delete_all_learning_data", label: "Delete all learning data", requiredForP0: true, userOutcome: "Clear saved learning assets through a visible account/settings path." },
  { id: "export_my_data", label: "Export my data", requiredForP0: true, userOutcome: "Download user-initiated learning data with copyright boundaries." },
  { id: "disable_reading_history_sync", label: "Do not sync reading history", requiredForP0: true, userOutcome: "Keep reading/source continuity local for selected sources or settings." },
  { id: "delete_account_data", label: "Delete account data", requiredForP0: true, userOutcome: "Find a visible path for account-level deletion support." },
]

export const ASTRA_PRIVACY_OVERCLAIMS: AstraPrivacyOverclaimDefinition[] = [
  { id: "fully_local", forbiddenCopy: "fully local", saferBoundary: "Say what stays local and what may be sent for the chosen AI task." },
  { id: "never_uploads", forbiddenCopy: "never uploads", saferBoundary: "Say Astra sends only the text needed for the chosen action." },
  { id: "end_to_end_encrypted", forbiddenCopy: "end-to-end encrypted", saferBoundary: "Use only if the actual architecture and legal review support it." },
  { id: "absolutely_no_logs", forbiddenCopy: "absolutely no logs", saferBoundary: "Say telemetry avoids raw content and Privacy Mode reduces event detail." },
  { id: "all_pages_safe", forbiddenCopy: "all pages are safe", saferBoundary: "Say some pages are protected or unsupported and provide alternatives." },
]

export const ASTRA_PRIVACY_MODE_ACCURATE_COPY = "Privacy Mode reduces page context and automatic memory use. Translation text may still leave the device on direct provider or relay paths."

export function findPrivacyOverclaimCopy(copy: string): AstraPrivacyOverclaimDefinition[] {
  const normalized = copy.toLowerCase()
  return ASTRA_PRIVACY_OVERCLAIMS.filter((overclaim) => normalized.includes(overclaim.forbiddenCopy))
}

const READINESS_CHECKS: Array<{
  code: AstraTrustPrivacyReadinessCode
  evidenceKey: keyof AstraTrustPrivacyReadinessEvidence
  severity: "block" | "warn"
  message: string
  nextStep: string
}> = [
  { code: "concerns_answered", evidenceKey: "userConcernsAnswered", severity: "block", message: "Core user trust concerns are not answered.", nextStep: "Answer upload, visibility, deletion, no-save, and cancellation-data questions in ordinary product copy." },
  { code: "trust_cards_present", evidenceKey: "trustCardsShownInCoreSurfaces", severity: "warn", message: "Trust cards are not present across onboarding/settings/library surfaces.", nextStep: "Add trust-card copy in the core surfaces where users decide whether to trust saving and AI assistance." },
  { code: "ordinary_language_copy", evidenceKey: "trustCopyUsesOrdinaryLanguage", severity: "warn", message: "Trust copy is too technical for ordinary learners.", nextStep: "Use plain copy such as ‘You choose what gets saved’ and avoid provider/model/API/security jargon." },
  { code: "privacy_controls_visible", evidenceKey: "requiredPrivacyControlsVisible", severity: "block", message: "Required privacy controls are not visible enough.", nextStep: "Expose Privacy Mode, no-save, deletion, export, sync-off, and account-data deletion paths." },
  { code: "overclaims_absent", evidenceKey: "overclaimCopyAbsent", severity: "block", message: "Trust copy overclaims privacy or safety.", nextStep: "Remove fully local, never uploads, end-to-end encryption, no logs, or all-pages-safe claims unless strictly true and reviewed." },
  { code: "privacy_mode_copy_accurate", evidenceKey: "privacyModeCopyAccurate", severity: "block", message: "Privacy Mode copy is not accurate.", nextStep: "Use the approved boundary: Privacy Mode reduces page context and automatic memory use; translation text may still leave the device on provider/relay paths." },
  { code: "cancellation_data_boundary", evidenceKey: "cancellationDataBoundaryClear", severity: "block", message: "Cancellation data handling is unclear.", nextStep: "State that existing saved learning assets remain accessible after cancellation, while paid-only generation/sync/export follows plan boundaries." },
]

export function evaluateAstraTrustPrivacyReadiness(evidence: AstraTrustPrivacyReadinessEvidence): AstraTrustPrivacyReadinessDecision {
  const findings = READINESS_CHECKS
    .filter((check) => !evidence[check.evidenceKey])
    .map<AstraTrustPrivacyReadinessFinding>((check) => ({
      code: check.code,
      severity: check.severity,
      message: check.message,
      nextStep: check.nextStep,
    }))
  const blockers = findings.filter((finding) => finding.severity === "block")
  const warnings = findings.filter((finding) => finding.severity === "warn")
  return { ready: blockers.length === 0, blockers, warnings, findings }
}
