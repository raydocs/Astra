export type AstraSupportEntryId =
  | "report_this_page"
  | "send_feedback"
  | "contact_support"
  | "copy_support_bundle"
  | "help_center"
  | "status_page"
  | "known_limitations"

export type AstraSupportBundleFieldId =
  | "extension_version"
  | "browser"
  | "os"
  | "page_hostname"
  | "feature_surface"
  | "last_action"
  | "error_category"
  | "membership_state_category"
  | "privacy_mode_state"
  | "timestamp"

export type AstraHelpCenterTopicId =
  | "translate_first_page"
  | "pages_cannot_be_translated"
  | "automatic_ai_handling"
  | "save_and_review_sentences"
  | "privacy_mode"
  | "delete_your_data"
  | "video_has_no_captions"
  | "membership_works"

export type AstraSupportExperienceReadinessCode =
  | "report_this_page_entry"
  | "send_feedback_entry"
  | "contact_support_entry"
  | "copy_support_bundle_entry"
  | "help_center_entry"
  | "status_page_entry"
  | "known_limitations_entry"
  | "metadata_only_bundle_fields"
  | "sensitive_content_excluded"
  | "bundle_preview_before_submit"
  | "help_center_topics"
  | "known_limitations_public"
  | "status_page_boundary"
  | "support_copy_non_devtools"
  | "authenticated_or_download_fallback"

export interface AstraSupportEntryDefinition {
  id: AstraSupportEntryId
  label: string
  purpose: string
  defaultSurface: "popup" | "options" | "content_error" | "web" | "docs"
  priority: "P0" | "P1"
}

export interface AstraSupportBundleFieldDefinition {
  id: AstraSupportBundleFieldId
  label: string
  source: string
  sensitiveBodyContent: false
}

export interface AstraHelpCenterTopicDefinition {
  id: AstraHelpCenterTopicId
  title: string
  purpose: string
  priority: "P0" | "P1"
  docPath: string
}

export interface AstraSupportExperienceReadinessEvidence {
  reportThisPageEntryAvailable: boolean
  sendFeedbackEntryAvailable: boolean
  contactSupportEntryAvailable: boolean
  copySupportBundleEntryAvailable: boolean
  helpCenterEntryAvailable: boolean
  statusPageEntryAvailable: boolean
  knownLimitationsEntryAvailable: boolean
  metadataOnlyBundleFieldsAvailable: boolean
  sensitiveContentExcludedByDefault: boolean
  bundlePreviewBeforeSubmit: boolean
  helpCenterTopicsCovered: boolean
  knownLimitationsPublished: boolean
  statusPageBoundaryDefined: boolean
  supportCopyDoesNotRequireDevtools: boolean
  authenticatedSubmitOrDownloadFallback: boolean
}

export interface AstraSupportExperienceFinding {
  code: AstraSupportExperienceReadinessCode
  severity: "block" | "warn"
  message: string
  nextStep: string
}

export interface AstraSupportExperienceDecision {
  ready: boolean
  blockers: AstraSupportExperienceFinding[]
  warnings: AstraSupportExperienceFinding[]
  findings: AstraSupportExperienceFinding[]
}

export const ASTRA_SUPPORT_ENTRIES: AstraSupportEntryDefinition[] = [
  {
    id: "report_this_page",
    label: "Report this page",
    purpose: "Let users report page/video/content failures without devtools and without sending page text by default.",
    defaultSurface: "popup",
    priority: "P0",
  },
  {
    id: "send_feedback",
    label: "Send feedback",
    purpose: "Capture confusion, quality feedback, and product friction with privacy-safe context.",
    defaultSurface: "web",
    priority: "P1",
  },
  {
    id: "contact_support",
    label: "Contact support",
    purpose: "Give paid or beta users a clear human-support path when self-serve recovery is insufficient.",
    defaultSurface: "web",
    priority: "P0",
  },
  {
    id: "copy_support_bundle",
    label: "Copy support bundle",
    purpose: "Allow local copy/download of metadata-only troubleshooting details before or instead of remote submission.",
    defaultSurface: "options",
    priority: "P0",
  },
  {
    id: "help_center",
    label: "Help center",
    purpose: "Route common user questions to ordinary-language help instead of diagnostics.",
    defaultSurface: "docs",
    priority: "P0",
  },
  {
    id: "status_page",
    label: "Status page",
    purpose: "Explain service incidents and degraded modes without exposing provider internals in ordinary UI.",
    defaultSurface: "web",
    priority: "P1",
  },
  {
    id: "known_limitations",
    label: "Known limitations",
    purpose: "Set public beta expectations for unsupported pages, missing captions, platform limits, and billing boundaries.",
    defaultSurface: "docs",
    priority: "P0",
  },
]

export const ASTRA_SUPPORT_BUNDLE_FIELDS: AstraSupportBundleFieldDefinition[] = [
  { id: "extension_version", label: "Extension version", source: "extension runtime", sensitiveBodyContent: false },
  { id: "browser", label: "Browser", source: "runtime/browser metadata", sensitiveBodyContent: false },
  { id: "os", label: "Operating system", source: "runtime metadata", sensitiveBodyContent: false },
  { id: "page_hostname", label: "Page hostname", source: "hostname only, no path/query/full URL", sensitiveBodyContent: false },
  { id: "feature_surface", label: "Feature surface", source: "support bundle feature surface", sensitiveBodyContent: false },
  { id: "last_action", label: "Last action", source: "user-triggered support action", sensitiveBodyContent: false },
  { id: "error_category", label: "Error category", source: "coarse error/status category", sensitiveBodyContent: false },
  { id: "membership_state_category", label: "Membership state category", source: "free/trial/pro/expired/unknown category", sensitiveBodyContent: false },
  { id: "privacy_mode_state", label: "Privacy Mode state", source: "boolean privacy-mode state", sensitiveBodyContent: false },
  { id: "timestamp", label: "Timestamp", source: "ISO event/report timestamp", sensitiveBodyContent: false },
]

export const ASTRA_SUPPORT_HELP_TOPICS: AstraHelpCenterTopicDefinition[] = [
  {
    id: "translate_first_page",
    title: "How to translate your first page",
    purpose: "Help new users reach first success without configuration or devtools.",
    priority: "P0",
    docPath: "docs/help/translate-first-page.md",
  },
  {
    id: "pages_cannot_be_translated",
    title: "Why some pages cannot be translated",
    purpose: "Explain site restrictions, dynamic pages, permissions, and fallbacks in ordinary language.",
    priority: "P0",
    docPath: "docs/help/pages-cannot-be-translated.md",
  },
  {
    id: "automatic_ai_handling",
    title: "How Astra handles AI automatically",
    purpose: "Explain managed AI without provider/API/model setup framing.",
    priority: "P0",
    docPath: "docs/help/automatic-ai-handling.md",
  },
  {
    id: "save_and_review_sentences",
    title: "How to save and review sentences",
    purpose: "Teach the understanding → save → review loop.",
    priority: "P0",
    docPath: "docs/help/save-and-review-sentences.md",
  },
  {
    id: "privacy_mode",
    title: "How Privacy Mode works",
    purpose: "Explain what is reduced, disabled, or kept local when Privacy Mode is on.",
    priority: "P0",
    docPath: "docs/help/privacy-mode.md",
  },
  {
    id: "delete_your_data",
    title: "How to delete your data",
    purpose: "Give users a clear data deletion and export/control path.",
    priority: "P0",
    docPath: "docs/help/delete-your-data.md",
  },
  {
    id: "video_has_no_captions",
    title: "Why a video has no captions",
    purpose: "Explain video caption availability and fallback actions.",
    priority: "P1",
    docPath: "docs/help/video-has-no-captions.md",
  },
  {
    id: "membership_works",
    title: "How membership works",
    purpose: "Explain Free/Trial/Pro boundaries without token/provider/model language.",
    priority: "P1",
    docPath: "docs/help/membership-works.md",
  },
]

export const ASTRA_SUPPORT_FORBIDDEN_DEFAULT_CONTENT_FIELDS = [
  "pageText",
  "selectedText",
  "savedSnippetText",
  "videoTranscriptText",
  "screenshot",
  "userInputText",
  "promptText",
  "modelOutputText",
  "fullUrl",
  "urlPath",
  "queryString",
] as const

const READINESS_CHECKS: Array<{
  code: AstraSupportExperienceReadinessCode
  evidenceKey: keyof AstraSupportExperienceReadinessEvidence
  severity: "block" | "warn"
  message: string
  nextStep: string
}> = [
  {
    code: "report_this_page_entry",
    evidenceKey: "reportThisPageEntryAvailable",
    severity: "block",
    message: "Report this page is not available from a day-to-day failure surface.",
    nextStep: "Expose Report this page from popup/content error surfaces with metadata-only context.",
  },
  {
    code: "send_feedback_entry",
    evidenceKey: "sendFeedbackEntryAvailable",
    severity: "warn",
    message: "Send feedback is not available for confusion or quality feedback.",
    nextStep: "Add a feedback route that uses privacy-safe context and avoids sensitive content by default.",
  },
  {
    code: "contact_support_entry",
    evidenceKey: "contactSupportEntryAvailable",
    severity: "block",
    message: "Contact support is not clearly available for users who cannot self-recover.",
    nextStep: "Add a clear support contact path for beta/paid users or document the current support channel.",
  },
  {
    code: "copy_support_bundle_entry",
    evidenceKey: "copySupportBundleEntryAvailable",
    severity: "block",
    message: "Users cannot copy/download a metadata-only support bundle.",
    nextStep: "Expose support bundle preview plus copy/download fallback in Options or report flow.",
  },
  {
    code: "help_center_entry",
    evidenceKey: "helpCenterEntryAvailable",
    severity: "block",
    message: "Help center entry is missing.",
    nextStep: "Link to ordinary-language help from support/report, web, or options surfaces.",
  },
  {
    code: "status_page_entry",
    evidenceKey: "statusPageEntryAvailable",
    severity: "warn",
    message: "Status page entry is missing.",
    nextStep: "Provide a status/degraded-mode page or release-note substitute before paid launch.",
  },
  {
    code: "known_limitations_entry",
    evidenceKey: "knownLimitationsEntryAvailable",
    severity: "block",
    message: "Known limitations entry is missing from public beta support surfaces.",
    nextStep: "Publish beta known limitations near help, store, release notes, or support flows.",
  },
  {
    code: "metadata_only_bundle_fields",
    evidenceKey: "metadataOnlyBundleFieldsAvailable",
    severity: "block",
    message: "Support bundle metadata fields do not cover the Section 14 troubleshooting set.",
    nextStep: "Include extension version, browser, OS, hostname, surface, action, error category, membership category, Privacy Mode, and timestamp.",
  },
  {
    code: "sensitive_content_excluded",
    evidenceKey: "sensitiveContentExcludedByDefault",
    severity: "block",
    message: "Support flow may include sensitive content by default.",
    nextStep: "Exclude page text, selection text, saved snippets, transcripts, screenshots, user input, prompts, model output, full URLs, paths, and query strings by default.",
  },
  {
    code: "bundle_preview_before_submit",
    evidenceKey: "bundlePreviewBeforeSubmit",
    severity: "block",
    message: "Users cannot preview support bundle metadata before submission.",
    nextStep: "Show metadata fields before remote submission or local download.",
  },
  {
    code: "help_center_topics",
    evidenceKey: "helpCenterTopicsCovered",
    severity: "block",
    message: "Required help center topics are not covered.",
    nextStep: "Cover first page translation, untranslatable pages, automatic AI handling, save/review, Privacy Mode, data deletion, no captions, and membership.",
  },
  {
    code: "known_limitations_public",
    evidenceKey: "knownLimitationsPublished",
    severity: "block",
    message: "Known limitations are not published with public/beta claims.",
    nextStep: "Publish unsupported page/video/platform/billing boundaries in beta notes or help docs.",
  },
  {
    code: "status_page_boundary",
    evidenceKey: "statusPageBoundaryDefined",
    severity: "warn",
    message: "Status page/degraded-mode boundary is not defined.",
    nextStep: "Define what incidents appear on a status page and what stays in operator-only diagnostics.",
  },
  {
    code: "support_copy_non_devtools",
    evidenceKey: "supportCopyDoesNotRequireDevtools",
    severity: "block",
    message: "Support copy assumes users can inspect devtools or technical internals.",
    nextStep: "Use ordinary-language support copy and metadata bundle collection instead of devtools instructions.",
  },
  {
    code: "authenticated_or_download_fallback",
    evidenceKey: "authenticatedSubmitOrDownloadFallback",
    severity: "block",
    message: "Support reporting lacks authenticated remote submission or local download fallback.",
    nextStep: "Support authenticated submission when signed in and local JSON copy/download when offline or unauthenticated.",
  },
]

export function supportBundleFieldIds(): AstraSupportBundleFieldId[] {
  return ASTRA_SUPPORT_BUNDLE_FIELDS.map((field) => field.id)
}

export function helpCenterTopicIds(): AstraHelpCenterTopicId[] {
  return ASTRA_SUPPORT_HELP_TOPICS.map((topic) => topic.id)
}

export function findForbiddenSupportContentFields(fieldNames: string[]): string[] {
  const normalizedForbidden = new Map(ASTRA_SUPPORT_FORBIDDEN_DEFAULT_CONTENT_FIELDS.map((field) => [field.toLowerCase(), field]))
  return fieldNames
    .filter((field) => normalizedForbidden.has(field.toLowerCase()))
    .map((field) => normalizedForbidden.get(field.toLowerCase()) ?? field)
}

export function evaluateAstraSupportExperienceReadiness(
  evidence: AstraSupportExperienceReadinessEvidence,
): AstraSupportExperienceDecision {
  const findings = READINESS_CHECKS
    .filter((check) => !evidence[check.evidenceKey])
    .map<AstraSupportExperienceFinding>((check) => ({
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
