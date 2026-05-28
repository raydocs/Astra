export type AstraComplianceChecklistArea =
  | "privacy_policy"
  | "terms_refund_ai_notice"
  | "store_permissions"
  | "copyright_export_boundary"
  | "data_deletion"
  | "support_consent"
  | "legal_review"

export interface AstraComplianceChecklistItem {
  area: AstraComplianceChecklistArea
  requirement: string
  evidence: string
  launchBlocker: boolean
}

export type AstraStorePermissionCapability =
  | "page_access"
  | "storage"
  | "tabs"
  | "notifications"
  | "identity_account"
  | "clipboard_export"
  | "downloads_export"

export interface AstraStorePermissionCopy {
  permission: AstraStorePermissionCapability
  userFacingCopy: string
  boundary: string
}

export interface AstraStorePermissionTrustRow extends AstraStorePermissionCopy {
  label: string
}

export interface AstraStorePermissionTrustViewModel {
  eyebrow: string
  title: string
  copy: string
  rows: AstraStorePermissionTrustRow[]
  privacyLinkLabel: string
  supportLinkLabel: string
}

export interface AstraExportBoundaryRule {
  contentType: "saved_short_sentence" | "source_context" | "full_page_body" | "video_transcript" | "share_card" | "learning_note_export" | "public_share"
  defaultPolicy: "allowed" | "minimal" | "blocked" | "user_initiated_only"
  userFacingBoundary: string
}

export interface AstraToneOfVoiceRule {
  trait: "quiet" | "capable" | "trustworthy" | "premium" | "helpful" | "learning_first" | "non_technical" | "respectful"
  doSay: string
  avoid: string
}

export interface ComplianceEvidenceInput {
  privacyPolicyChecklist: boolean
  termsRefundAiChecklist: boolean
  storePermissionCopy: boolean
  exportBoundary: boolean
  dataDeletionVisible: boolean
  supportConsentExplicit: boolean
  legalReviewBeforePaidLaunch: boolean
}

export const ASTRA_STORE_PERMISSION_COPY: AstraStorePermissionCopy[] = [
  {
    permission: "page_access",
    userFacingCopy: "Astra reads the page you choose so it can help you understand and translate the content in front of you.",
    boundary: "No default support report includes page text.",
  },
  {
    permission: "storage",
    userFacingCopy: "Astra saves your language preferences and the learning items you choose to keep.",
    boundary: "Saved learning data can be exported or deleted from account controls.",
  },
  {
    permission: "tabs",
    userFacingCopy: "Astra checks the current tab so it can offer the right reading, video, or review action.",
    boundary: "Tab context is used for product actions, not advertising profiles.",
  },
  {
    permission: "notifications",
    userFacingCopy: "Optional reminders can let you know when a review or longer task is ready.",
    boundary: "Reminders must be low frequency and user-controlled.",
  },
  {
    permission: "identity_account",
    userFacingCopy: "Your account keeps membership and learning continuity connected across your devices.",
    boundary: "Daily study details stay limited to the data needed for sync and support.",
  },
  {
    permission: "clipboard_export",
    userFacingCopy: "Copy actions happen only when you choose to copy a translation, rule, or learning note.",
    boundary: "Astra does not read your clipboard in the background.",
  },
  {
    permission: "downloads_export",
    userFacingCopy: "Download actions are used when you export a report, transcript, or learning file yourself.",
    boundary: "Exports are user-initiated and should not duplicate full third-party works.",
  },
]

const ASTRA_STORE_PERMISSION_LABELS: Record<AstraStorePermissionCapability, string> = {
  page_access: "Page access",
  storage: "Storage",
  tabs: "Current tab",
  notifications: "Optional reminders",
  identity_account: "Account continuity",
  clipboard_export: "Copy actions",
  downloads_export: "Downloads and exports",
}

export function buildAstraStorePermissionTrustViewModel(): AstraStorePermissionTrustViewModel {
  return {
    eyebrow: "Permission trust",
    title: "Why Astra asks for browser access",
    copy: "Astra explains permissions in the same language users see in the store: every access request is tied to reading, saving, review, or user-initiated export control.",
    rows: ASTRA_STORE_PERMISSION_COPY.map((item) => ({
      ...item,
      label: ASTRA_STORE_PERMISSION_LABELS[item.permission],
    })),
    privacyLinkLabel: "Read the privacy promise",
    supportLinkLabel: "Contact support",
  }
}

export const ASTRA_LEGAL_COMPLIANCE_CHECKLIST: AstraComplianceChecklistItem[] = [
  {
    area: "privacy_policy",
    requirement: "Explain what learning data is processed, why it is processed, service categories involved, Privacy Mode behavior, support report defaults, export, deletion, and cancellation data handling.",
    evidence: "Public privacy policy or launch checklist row reviewed by legal/privacy owner.",
    launchBlocker: true,
  },
  {
    area: "terms_refund_ai_notice",
    requirement: "Explain fair-use boundaries, cancellation/refund policy, minors boundary, and that AI translations/explanations can be imperfect.",
    evidence: "Terms/refund/AI notice checklist approved before paid launch.",
    launchBlocker: true,
  },
  {
    area: "store_permissions",
    requirement: "Use ordinary-language permission explanations for page access, storage, tabs, optional notifications, account continuity, copy actions, and user-initiated downloads/exports.",
    evidence: "Store listing permission copy reviewed against ASTRA_STORE_PERMISSION_COPY.",
    launchBlocker: true,
  },
  {
    area: "copyright_export_boundary",
    requirement: "Document that Astra saves short user-selected learning snippets, avoids default full-page saving, and does not encourage full third-party transcript/article redistribution.",
    evidence: "Export boundary rules present in product copy and support macros.",
    launchBlocker: true,
  },
  {
    area: "data_deletion",
    requirement: "Make learning data deletion/export paths visible and describe deletion timing before paid launch.",
    evidence: "Account or settings data-control surface plus runbook evidence.",
    launchBlocker: true,
  },
  {
    area: "support_consent",
    requirement: "Support bundles are metadata-only by default; content/screenshot upload requires explicit user action.",
    evidence: "Support bundle consent UI and metadata-only tests.",
    launchBlocker: true,
  },
  {
    area: "legal_review",
    requirement: "Formal legal/privacy review is required before public paid launch claims, refund promises, or production billing/trial flow.",
    evidence: "Signed launch review or blocker entry in release readiness checklist.",
    launchBlocker: true,
  },
]

export const ASTRA_EXPORT_BOUNDARY_RULES: AstraExportBoundaryRule[] = [
  {
    contentType: "saved_short_sentence",
    defaultPolicy: "allowed",
    userFacingBoundary: "You can save short sentences you choose for personal review.",
  },
  {
    contentType: "source_context",
    defaultPolicy: "minimal",
    userFacingBoundary: "Astra keeps only the context needed to make review useful.",
  },
  {
    contentType: "full_page_body",
    defaultPolicy: "blocked",
    userFacingBoundary: "Astra does not save complete page text by default.",
  },
  {
    contentType: "video_transcript",
    defaultPolicy: "minimal",
    userFacingBoundary: "Video notes focus on personal learning snippets and timestamps, not full transcript redistribution.",
  },
  {
    contentType: "share_card",
    defaultPolicy: "user_initiated_only",
    userFacingBoundary: "Share cards are created only when you choose to share a short learning moment.",
  },
  {
    contentType: "learning_note_export",
    defaultPolicy: "user_initiated_only",
    userFacingBoundary: "Exports are for your learning assets and should not duplicate full third-party works.",
  },
  {
    contentType: "public_share",
    defaultPolicy: "user_initiated_only",
    userFacingBoundary: "Astra never makes your learning history public by default.",
  },
]

export const ASTRA_TONE_OF_VOICE_RULES: AstraToneOfVoiceRule[] = [
  { trait: "quiet", doSay: "Done for today.", avoid: "You are falling behind." },
  { trait: "capable", doSay: "Astra handled it.", avoid: "Configure the pipeline first." },
  { trait: "trustworthy", doSay: "You choose what gets saved.", avoid: "Everything is captured automatically." },
  { trait: "premium", doSay: "Best for long or technical content.", avoid: "Unlock cheap processing." },
  { trait: "helpful", doSay: "Try again or report this page.", avoid: "Unknown internal failure." },
  { trait: "learning_first", doSay: "Saved for review.", avoid: "Translated and done." },
  { trait: "non_technical", doSay: "Astra AI is ready.", avoid: "Provider route connected." },
  { trait: "respectful", doSay: "You can cancel without losing local learning controls.", avoid: "Do not miss your last chance." },
]

const EVIDENCE_BY_AREA: Record<AstraComplianceChecklistArea, keyof ComplianceEvidenceInput> = {
  privacy_policy: "privacyPolicyChecklist",
  terms_refund_ai_notice: "termsRefundAiChecklist",
  store_permissions: "storePermissionCopy",
  copyright_export_boundary: "exportBoundary",
  data_deletion: "dataDeletionVisible",
  support_consent: "supportConsentExplicit",
  legal_review: "legalReviewBeforePaidLaunch",
}

export function evaluateAstraComplianceReadiness(input: ComplianceEvidenceInput): {
  readyForPaidLaunch: boolean
  missingLaunchBlockers: AstraComplianceChecklistItem[]
} {
  const missingLaunchBlockers = ASTRA_LEGAL_COMPLIANCE_CHECKLIST.filter((item) =>
    item.launchBlocker && !input[EVIDENCE_BY_AREA[item.area]],
  )
  return {
    readyForPaidLaunch: missingLaunchBlockers.length === 0,
    missingLaunchBlockers,
  }
}
