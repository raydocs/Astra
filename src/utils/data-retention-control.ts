export type AstraDataCategory =
  | "account_data"
  | "settings"
  | "source_metadata"
  | "saved_snippets"
  | "review_cards"
  | "vocabulary"
  | "full_page_text"
  | "transcript_full_text"
  | "telemetry"
  | "support_bundle"

export type AstraDataDefaultSave = "yes" | "user_initiated" | "no" | "temporary_only"
export type AstraDataSyncPolicy = "yes" | "optional" | "no" | "service_only"
export type AstraDataDeletionPath =
  | "delete_account"
  | "reset_settings"
  | "delete_source"
  | "delete_snippet"
  | "delete_or_suspend_card"
  | "delete_vocabulary_entry"
  | "not_persisted"
  | "policy_or_opt_out"
  | "support_ticket_delete"

export interface AstraDataRetentionPolicy {
  category: AstraDataCategory
  label: string
  examples: string[]
  defaultSave: AstraDataDefaultSave
  sync: AstraDataSyncPolicy
  deletionPath: AstraDataDeletionPath
  retention: string
  defaultIncludesFullThirdPartyContent: boolean
}

export type AstraCopyrightContentType =
  | "web_article"
  | "youtube_transcript"
  | "pdf_epub"
  | "user_input"
  | "ai_summary"

export interface AstraCopyrightBoundary {
  contentType: AstraCopyrightContentType
  defaultAllowed: string
  cautiousOrLimited: string
  notDefault: string
}

export type AstraDataControlId =
  | "privacy_mode"
  | "delete_saved_item"
  | "delete_related_review_cards"
  | "export_learning_data"
  | "disable_sync_for_source"
  | "exclude_from_digest"
  | "delete_account_data_help"
  | "support_bundle_preview"

export type AstraDataControlPriority = "P0" | "P1"

export interface AstraDataControlRequirement {
  id: AstraDataControlId
  label: string
  location: string
  priority: AstraDataControlPriority
  acceptance: string
}

export type AstraDataControlReadinessCode =
  | AstraDataControlId
  | "support_metadata_only"
  | "export_copyright_boundary"
  | "canceled_member_asset_access"
  | "source_delete_cascade_choice"
  | "privacy_mode_copy_accuracy"

export interface AstraDataControlEvidence {
  privacyModeVisible: boolean
  deleteSavedItemAvailable: boolean
  deleteRelatedReviewCardsAvailable: boolean
  exportLearningDataAvailable: boolean
  disableSyncForSourceAvailable: boolean
  excludeFromDigestAvailable: boolean
  deleteAccountDataHelpPathVisible: boolean
  supportBundlePreviewVisible: boolean
  supportBundleMetadataOnlyByDefault: boolean
  exportExplainsCopyrightBoundary: boolean
  canceledMemberCanViewExistingAssets: boolean
  sourceDeleteCascadeChoiceExplicit: boolean
  privacyModeCopyAvoidsLocalOnlyClaim: boolean
}

export interface AstraDataControlReadinessFinding {
  code: AstraDataControlReadinessCode
  severity: "block" | "warn"
  message: string
  nextStep: string
}

export interface AstraDataControlReadinessDecision {
  ready: boolean
  findings: AstraDataControlReadinessFinding[]
  blockers: AstraDataControlReadinessFinding[]
  warnings: AstraDataControlReadinessFinding[]
}

export const ASTRA_DATA_RETENTION_POLICIES: AstraDataRetentionPolicy[] = [
  {
    category: "account_data",
    label: "Account data",
    examples: ["email", "membership"],
    defaultSave: "yes",
    sync: "yes",
    deletionPath: "delete_account",
    retention: "Retained according to account policy until account deletion or legal/operational retention ends.",
    defaultIncludesFullThirdPartyContent: false,
  },
  {
    category: "settings",
    label: "Settings",
    examples: ["target language", "level", "privacy mode"],
    defaultSave: "yes",
    sync: "optional",
    deletionPath: "reset_settings",
    retention: "Retained until reset or deletion by the user.",
    defaultIncludesFullThirdPartyContent: false,
  },
  {
    category: "source_metadata",
    label: "Source metadata",
    examples: ["title", "hostname", "source type"],
    defaultSave: "yes",
    sync: "optional",
    deletionPath: "delete_source",
    retention: "Retained until the learner deletes the source or disables related continuity.",
    defaultIncludesFullThirdPartyContent: false,
  },
  {
    category: "saved_snippets",
    label: "Saved snippets",
    examples: ["user-saved sentence", "short phrase"],
    defaultSave: "user_initiated",
    sync: "optional",
    deletionPath: "delete_snippet",
    retention: "Retained until the learner deletes the saved item.",
    defaultIncludesFullThirdPartyContent: false,
  },
  {
    category: "review_cards",
    label: "Review cards",
    examples: ["word card", "sentence card", "cloze card"],
    defaultSave: "user_initiated",
    sync: "optional",
    deletionPath: "delete_or_suspend_card",
    retention: "Retained until deleted, suspended, or the linked source/snippet cascade removes it.",
    defaultIncludesFullThirdPartyContent: false,
  },
  {
    category: "vocabulary",
    label: "Vocabulary",
    examples: ["term", "translation", "glossary target"],
    defaultSave: "user_initiated",
    sync: "optional",
    deletionPath: "delete_vocabulary_entry",
    retention: "Retained until the learner deletes the entry or forgets the remembered term.",
    defaultIncludesFullThirdPartyContent: false,
  },
  {
    category: "full_page_text",
    label: "Full page text",
    examples: ["article body", "page paragraphs"],
    defaultSave: "temporary_only",
    sync: "no",
    deletionPath: "not_persisted",
    retention: "Processed transiently for the task; not a default long-term learning asset.",
    defaultIncludesFullThirdPartyContent: true,
  },
  {
    category: "transcript_full_text",
    label: "Transcript full text",
    examples: ["video captions", "subtitle file body"],
    defaultSave: "temporary_only",
    sync: "optional",
    deletionPath: "delete_source",
    retention: "Handled cautiously; long-term/full transcript storage needs an explicit product boundary.",
    defaultIncludesFullThirdPartyContent: true,
  },
  {
    category: "telemetry",
    label: "Telemetry",
    examples: ["event", "latency bucket", "error category"],
    defaultSave: "yes",
    sync: "service_only",
    deletionPath: "policy_or_opt_out",
    retention: "Aggregated or time-limited according to analytics/support policy; content fields stay out by default.",
    defaultIncludesFullThirdPartyContent: false,
  },
  {
    category: "support_bundle",
    label: "Support bundle",
    examples: ["feature surface", "error category", "hostname"],
    defaultSave: "user_initiated",
    sync: "service_only",
    deletionPath: "support_ticket_delete",
    retention: "Submitted only by user action; metadata-only by default and deleted through support/ticket policy.",
    defaultIncludesFullThirdPartyContent: false,
  },
]

export const ASTRA_COPYRIGHT_BOUNDARIES: AstraCopyrightBoundary[] = [
  {
    contentType: "web_article",
    defaultAllowed: "Translate/display for the user's reading session, save short learning snippets, and keep source links/metadata.",
    cautiousOrLimited: "Long summaries and exports should stay bounded to learning notes/snippets.",
    notDefault: "Do not save or export complete third-party articles as Astra assets by default.",
  },
  {
    contentType: "youtube_transcript",
    defaultAllowed: "Show learning view, save chosen sentence/timecode snippets, and keep source metadata.",
    cautiousOrLimited: "Full bilingual transcript export needs an explicit user action and copyright/product boundary.",
    notDefault: "Do not bypass platform restrictions or bulk-export full transcripts by default.",
  },
  {
    contentType: "pdf_epub",
    defaultAllowed: "Let the user read a local file and save selected learning snippets/cards.",
    cautiousOrLimited: "Cloud sync of file-derived full text should be opt-in and bounded.",
    notDefault: "Do not redistribute unauthorized full documents.",
  },
  {
    contentType: "user_input",
    defaultAllowed: "Rewrite, correct, and save corrections when the user chooses.",
    cautiousOrLimited: "Use in telemetry/support only as explicit content attachment.",
    notDefault: "Do not share or train on user input without authorization.",
  },
  {
    contentType: "ai_summary",
    defaultAllowed: "Save personal learning notes and short summaries for review.",
    cautiousOrLimited: "Sharing externally should avoid substituting for the source work.",
    notDefault: "Do not market AI summaries as a replacement distribution of the original content.",
  },
]

export const ASTRA_DATA_CONTROL_REQUIREMENTS: AstraDataControlRequirement[] = [
  {
    id: "privacy_mode",
    label: "Privacy Mode",
    location: "Settings / onboarding hint",
    priority: "P0",
    acceptance: "Visible and described accurately without promising local-only translation.",
  },
  {
    id: "delete_saved_item",
    label: "Delete saved item",
    location: "Saved item menu",
    priority: "P0",
    acceptance: "Any saved learning item can be deleted by the learner.",
  },
  {
    id: "delete_related_review_cards",
    label: "Delete related review cards",
    location: "Delete confirmation",
    priority: "P0",
    acceptance: "Source/snippet deletion makes derived-card handling explicit.",
  },
  {
    id: "export_learning_data",
    label: "Export learning data",
    location: "Settings / account",
    priority: "P1",
    acceptance: "Export explains included content and copyright boundary.",
  },
  {
    id: "disable_sync_for_source",
    label: "Disable sync for source",
    location: "Source menu",
    priority: "P1",
    acceptance: "Learner can keep a source local by disabling sync.",
  },
  {
    id: "exclude_from_digest",
    label: "Exclude from digest",
    location: "Source menu",
    priority: "P1",
    acceptance: "Learner can suppress a source from local/weekly digest summaries.",
  },
  {
    id: "delete_account_data_help",
    label: "Delete account data help path",
    location: "Account / help",
    priority: "P0",
    acceptance: "A visible help path explains account-data deletion before paid launch.",
  },
  {
    id: "support_bundle_preview",
    label: "Support bundle preview",
    location: "Report flow",
    priority: "P0",
    acceptance: "Support flow previews metadata-only report contents before submission.",
  },
]

const EVIDENCE_BY_CONTROL: Record<AstraDataControlId, keyof AstraDataControlEvidence> = {
  privacy_mode: "privacyModeVisible",
  delete_saved_item: "deleteSavedItemAvailable",
  delete_related_review_cards: "deleteRelatedReviewCardsAvailable",
  export_learning_data: "exportLearningDataAvailable",
  disable_sync_for_source: "disableSyncForSourceAvailable",
  exclude_from_digest: "excludeFromDigestAvailable",
  delete_account_data_help: "deleteAccountDataHelpPathVisible",
  support_bundle_preview: "supportBundlePreviewVisible",
}

const FINDING_COPY: Record<AstraDataControlReadinessCode, { message: string; nextStep: string }> = {
  privacy_mode: {
    message: "Privacy Mode is not visible enough for the first implementation.",
    nextStep: "Expose Privacy Mode in settings or onboarding and describe its actual request-context boundary.",
  },
  delete_saved_item: {
    message: "Saved-item deletion is missing.",
    nextStep: "Provide a delete action for each saved snippet/vocabulary item.",
  },
  delete_related_review_cards: {
    message: "Related review-card deletion handling is missing.",
    nextStep: "Make delete confirmation state whether derived cards are preserved, suspended, or deleted.",
  },
  export_learning_data: {
    message: "Learning-data export is missing from user controls.",
    nextStep: "Expose a user-initiated export path with clear included-content policy.",
  },
  disable_sync_for_source: {
    message: "Per-source sync disable control is missing.",
    nextStep: "Add or document a source-level sync toggle before relying on cloud continuity for that source.",
  },
  exclude_from_digest: {
    message: "Per-source digest exclusion is missing.",
    nextStep: "Add a source-level digest exclusion control for weekly/retention summaries.",
  },
  delete_account_data_help: {
    message: "Delete-account-data help path is missing.",
    nextStep: "Provide a visible account/help route that explains account-data deletion.",
  },
  support_bundle_preview: {
    message: "Support bundle preview is missing.",
    nextStep: "Show metadata-only report fields before submission or local download.",
  },
  support_metadata_only: {
    message: "Support bundle defaults are not metadata-only.",
    nextStep: "Keep support reports free of body text, transcripts, screenshots, prompts, model output, and saved content unless explicitly attached.",
  },
  export_copyright_boundary: {
    message: "Learning-data export does not explain the copyright/content boundary.",
    nextStep: "State that exports contain user-saved snippets/metadata/review data, not full third-party works by default.",
  },
  canceled_member_asset_access: {
    message: "Existing asset access after cancellation is not evidenced.",
    nextStep: "Keep read/export access to existing learning assets even when paid membership is canceled or expired.",
  },
  source_delete_cascade_choice: {
    message: "Source deletion does not make derived-card handling explicit.",
    nextStep: "Offer source-only delete and source-plus-linked-cards options or an equivalent visible cascade policy.",
  },
  privacy_mode_copy_accuracy: {
    message: "Privacy Mode copy risks overclaiming local-only or complete secrecy.",
    nextStep: "Use accurate copy: Privacy Mode reduces context and memory use; translation text may still leave the device on provider/relay paths.",
  },
}

function makeFinding(code: AstraDataControlReadinessCode, severity: "block" | "warn"): AstraDataControlReadinessFinding {
  const copy = FINDING_COPY[code]
  return {
    code,
    severity,
    message: copy.message,
    nextStep: copy.nextStep,
  }
}

export function getDataRetentionPolicy(category: AstraDataCategory): AstraDataRetentionPolicy {
  const policy = ASTRA_DATA_RETENTION_POLICIES.find((item) => item.category === category)
  if (!policy) throw new Error(`Unknown Astra data category: ${category}`)
  return policy
}

export function evaluateAstraDataControlReadiness(
  evidence: AstraDataControlEvidence,
): AstraDataControlReadinessDecision {
  const findings: AstraDataControlReadinessFinding[] = []

  for (const control of ASTRA_DATA_CONTROL_REQUIREMENTS) {
    if (!evidence[EVIDENCE_BY_CONTROL[control.id]]) {
      findings.push(makeFinding(control.id, control.priority === "P0" ? "block" : "warn"))
    }
  }

  if (!evidence.supportBundleMetadataOnlyByDefault) findings.push(makeFinding("support_metadata_only", "block"))
  if (!evidence.exportExplainsCopyrightBoundary) findings.push(makeFinding("export_copyright_boundary", "block"))
  if (!evidence.canceledMemberCanViewExistingAssets) findings.push(makeFinding("canceled_member_asset_access", "block"))
  if (!evidence.sourceDeleteCascadeChoiceExplicit) findings.push(makeFinding("source_delete_cascade_choice", "block"))
  if (!evidence.privacyModeCopyAvoidsLocalOnlyClaim) findings.push(makeFinding("privacy_mode_copy_accuracy", "block"))

  const blockers = findings.filter((finding) => finding.severity === "block")
  const warnings = findings.filter((finding) => finding.severity === "warn")
  return {
    ready: blockers.length === 0,
    findings,
    blockers,
    warnings,
  }
}
