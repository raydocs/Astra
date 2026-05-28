export type AstraErrorSituationId =
  | "content_loading_slow"
  | "ai_response_slow"
  | "page_protected"
  | "no_captions"
  | "not_signed_in"
  | "membership_limit"
  | "partial_failure"
  | "large_content"
  | "network_offline"

export type AstraErrorRecoveryActionId =
  | "wait"
  | "retry"
  | "use_faster_mode"
  | "try_selection"
  | "open_reader"
  | "explain_no_captions"
  | "try_another_video"
  | "sign_in"
  | "upgrade"
  | "continue_limited_mode"
  | "retry_failed_items"
  | "translate_visible_part_first"
  | "retry_when_online"
  | "report_this_page"
  | "copy_support_info"
  | "contact_support"
  | "help_center"
  | "try_sample_page"

export type AstraErrorRecoveryReadinessCode =
  | "answers_what_happened"
  | "answers_user_next_action"
  | "answers_progress_saved"
  | "short_actionable_copy"
  | "slow_content_mapping"
  | "slow_ai_mapping"
  | "protected_page_mapping"
  | "no_captions_mapping"
  | "not_signed_in_mapping"
  | "membership_limit_mapping"
  | "partial_failure_mapping"
  | "large_content_mapping"
  | "network_offline_mapping"
  | "support_fallbacks"
  | "no_technical_blame"
  | "progress_not_lost"

export interface AstraErrorRecoveryActionDefinition {
  id: AstraErrorRecoveryActionId
  label: string
  userFacing: boolean
}

export interface AstraErrorSituationDefinition {
  id: AstraErrorSituationId
  label: string
  whatHappenedCopy: string
  recoveryActions: AstraErrorRecoveryActionId[]
  progressCopy: string
}

export interface AstraErrorRecoveryReadinessEvidence {
  visibleErrorsExplainWhatHappened: boolean
  visibleErrorsExplainNextAction: boolean
  visibleErrorsExplainProgressState: boolean
  visibleErrorCopyShortActionable: boolean
  slowContentHasWaitRetry: boolean
  slowAiHasFasterMode: boolean
  protectedPageHasSelectionOrReader: boolean
  noCaptionsHasExplanationOrAlternateVideo: boolean
  notSignedInHasSignIn: boolean
  membershipLimitHasUpgradeOrLimitedMode: boolean
  partialFailureHasRetryFailedItems: boolean
  largeContentHasVisiblePartFirst: boolean
  networkOfflineHasOnlineRetry: boolean
  unrecoverableErrorsHaveSupportFallbacks: boolean
  userCopyAvoidsTechnicalBlame: boolean
  failedTasksDoNotLoseProgressSilently: boolean
}

export interface AstraErrorRecoveryFinding {
  code: AstraErrorRecoveryReadinessCode
  severity: "block" | "warn"
  message: string
  nextStep: string
}

export interface AstraErrorRecoveryDecision {
  ready: boolean
  blockers: AstraErrorRecoveryFinding[]
  warnings: AstraErrorRecoveryFinding[]
  findings: AstraErrorRecoveryFinding[]
}

export const ASTRA_ERROR_COPY_EXAMPLES = [
  "Astra is taking longer than usual.",
  "Try again.",
  "Use faster mode.",
  "This page is protected.",
  "Try selecting text instead.",
  "No captions found for this video.",
  "Sign in to continue.",
  "Your progress was saved.",
] as const

export const ASTRA_ERROR_RECOVERY_ACTIONS: AstraErrorRecoveryActionDefinition[] = [
  { id: "wait", label: "Wait", userFacing: true },
  { id: "retry", label: "Try again", userFacing: true },
  { id: "use_faster_mode", label: "Use faster mode", userFacing: true },
  { id: "try_selection", label: "Try selecting text instead", userFacing: true },
  { id: "open_reader", label: "Open reader", userFacing: true },
  { id: "explain_no_captions", label: "Why there are no captions", userFacing: true },
  { id: "try_another_video", label: "Try another video", userFacing: true },
  { id: "sign_in", label: "Sign in", userFacing: true },
  { id: "upgrade", label: "Upgrade", userFacing: true },
  { id: "continue_limited_mode", label: "Continue with limited mode", userFacing: true },
  { id: "retry_failed_items", label: "Retry failed items", userFacing: true },
  { id: "translate_visible_part_first", label: "Translate visible part first", userFacing: true },
  { id: "retry_when_online", label: "Retry when online", userFacing: true },
  { id: "report_this_page", label: "Report this page", userFacing: true },
  { id: "copy_support_info", label: "Copy support info", userFacing: true },
  { id: "contact_support", label: "Contact support", userFacing: true },
  { id: "help_center", label: "Help center", userFacing: true },
  { id: "try_sample_page", label: "Try sample page", userFacing: true },
]

export const ASTRA_ERROR_SITUATIONS: AstraErrorSituationDefinition[] = [
  {
    id: "content_loading_slow",
    label: "Content loading is slow",
    whatHappenedCopy: "Astra is taking longer than usual.",
    recoveryActions: ["wait", "retry"],
    progressCopy: "Your progress was saved.",
  },
  {
    id: "ai_response_slow",
    label: "AI response is slow",
    whatHappenedCopy: "Astra is taking longer than usual.",
    recoveryActions: ["use_faster_mode", "retry"],
    progressCopy: "Your progress was saved.",
  },
  {
    id: "page_protected",
    label: "Page is protected",
    whatHappenedCopy: "This page is protected.",
    recoveryActions: ["try_selection", "open_reader"],
    progressCopy: "Nothing was changed on this page.",
  },
  {
    id: "no_captions",
    label: "No captions",
    whatHappenedCopy: "No captions found for this video.",
    recoveryActions: ["explain_no_captions", "try_another_video"],
    progressCopy: "Saved video notes stay available.",
  },
  {
    id: "not_signed_in",
    label: "Not signed in",
    whatHappenedCopy: "Sign in to continue.",
    recoveryActions: ["sign_in"],
    progressCopy: "Local learning data stays on this device.",
  },
  {
    id: "membership_limit",
    label: "Membership limit",
    whatHappenedCopy: "You have reached this plan's current limit.",
    recoveryActions: ["upgrade", "continue_limited_mode"],
    progressCopy: "Your saved learning assets stay available.",
  },
  {
    id: "partial_failure",
    label: "Partial failure",
    whatHappenedCopy: "Astra finished part of this task.",
    recoveryActions: ["retry_failed_items"],
    progressCopy: "Completed items were kept.",
  },
  {
    id: "large_content",
    label: "Large content",
    whatHappenedCopy: "This content is long.",
    recoveryActions: ["translate_visible_part_first"],
    progressCopy: "You can continue from the visible part first.",
  },
  {
    id: "network_offline",
    label: "Network offline",
    whatHappenedCopy: "Astra could not connect right now.",
    recoveryActions: ["retry_when_online"],
    progressCopy: "Local progress was kept.",
  },
]

export const ASTRA_UNRECOVERABLE_SUPPORT_FALLBACKS: AstraErrorRecoveryActionId[] = [
  "report_this_page",
  "copy_support_info",
  "contact_support",
  "help_center",
  "try_sample_page",
]

export const ASTRA_ERROR_TECHNICAL_BLAME_TERMS = [
  "provider",
  "upstream",
  "route",
  "relay",
  "token",
  "stack trace",
  "exception",
  "cache key",
  "serviceMode",
] as const

const READINESS_CHECKS: Array<{
  code: AstraErrorRecoveryReadinessCode
  evidenceKey: keyof AstraErrorRecoveryReadinessEvidence
  severity: "block" | "warn"
  message: string
  nextStep: string
}> = [
  {
    code: "answers_what_happened",
    evidenceKey: "visibleErrorsExplainWhatHappened",
    severity: "block",
    message: "Visible errors do not consistently explain what happened.",
    nextStep: "Add a short user-facing explanation for every P0 error state.",
  },
  {
    code: "answers_user_next_action",
    evidenceKey: "visibleErrorsExplainNextAction",
    severity: "block",
    message: "Visible errors do not consistently provide the next user action.",
    nextStep: "Add retry, faster mode, selection, reader, sign-in, limited mode, support, or sample-page actions.",
  },
  {
    code: "answers_progress_saved",
    evidenceKey: "visibleErrorsExplainProgressState",
    severity: "block",
    message: "Visible errors do not tell the user whether progress was saved or kept.",
    nextStep: "Add saved/kept/not-started progress copy to task-interrupting errors.",
  },
  {
    code: "short_actionable_copy",
    evidenceKey: "visibleErrorCopyShortActionable",
    severity: "warn",
    message: "Error copy is not consistently short and actionable.",
    nextStep: "Use concise copy such as Try again, Use faster mode, Try selecting text, or Your progress was saved.",
  },
  {
    code: "slow_content_mapping",
    evidenceKey: "slowContentHasWaitRetry",
    severity: "block",
    message: "Slow content loading lacks Wait/Retry recovery.",
    nextStep: "Offer Wait and Try again for content-loading delays.",
  },
  {
    code: "slow_ai_mapping",
    evidenceKey: "slowAiHasFasterMode",
    severity: "block",
    message: "Slow AI response lacks faster-mode recovery.",
    nextStep: "Offer Use faster mode or a simpler explanation mode for slow AI responses.",
  },
  {
    code: "protected_page_mapping",
    evidenceKey: "protectedPageHasSelectionOrReader",
    severity: "block",
    message: "Protected pages lack selection or reader fallback.",
    nextStep: "Offer Try selecting text instead or Open reader.",
  },
  {
    code: "no_captions_mapping",
    evidenceKey: "noCaptionsHasExplanationOrAlternateVideo",
    severity: "block",
    message: "No-caption videos lack explanation or alternate-video fallback.",
    nextStep: "Explain why captions are unavailable and suggest trying another video or manual selection.",
  },
  {
    code: "not_signed_in_mapping",
    evidenceKey: "notSignedInHasSignIn",
    severity: "block",
    message: "Signed-out states lack a sign-in action.",
    nextStep: "Add Sign in to continue where account state blocks the task.",
  },
  {
    code: "membership_limit_mapping",
    evidenceKey: "membershipLimitHasUpgradeOrLimitedMode",
    severity: "block",
    message: "Membership-limit states lack upgrade or limited-mode recovery.",
    nextStep: "Offer Upgrade and/or Continue with limited mode after value has been seen.",
  },
  {
    code: "partial_failure_mapping",
    evidenceKey: "partialFailureHasRetryFailedItems",
    severity: "block",
    message: "Partial failures lack retry-failed-items recovery.",
    nextStep: "Keep completed work and allow retrying failed items only.",
  },
  {
    code: "large_content_mapping",
    evidenceKey: "largeContentHasVisiblePartFirst",
    severity: "block",
    message: "Large-content states lack visible-part-first recovery.",
    nextStep: "Offer Translate visible part first or process in parts.",
  },
  {
    code: "network_offline_mapping",
    evidenceKey: "networkOfflineHasOnlineRetry",
    severity: "block",
    message: "Offline states lack retry-when-online recovery.",
    nextStep: "Preserve local progress and offer retry when online.",
  },
  {
    code: "support_fallbacks",
    evidenceKey: "unrecoverableErrorsHaveSupportFallbacks",
    severity: "block",
    message: "Unrecoverable errors lack support fallback paths.",
    nextStep: "Offer Report this page, Copy support info, Contact support, Help center, or Try sample page.",
  },
  {
    code: "no_technical_blame",
    evidenceKey: "userCopyAvoidsTechnicalBlame",
    severity: "warn",
    message: "User-facing error copy exposes technical blame.",
    nextStep: "Avoid provider/upstream/route/relay/token/stack/cache/serviceMode terms in ordinary error UI.",
  },
  {
    code: "progress_not_lost",
    evidenceKey: "failedTasksDoNotLoseProgressSilently",
    severity: "block",
    message: "Failed tasks may lose progress silently.",
    nextStep: "Persist completed parts or clearly state that nothing changed before asking the user to retry.",
  },
]

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function getErrorSituation(id: AstraErrorSituationId): AstraErrorSituationDefinition | undefined {
  return ASTRA_ERROR_SITUATIONS.find((situation) => situation.id === id)
}

export function getErrorRecoveryAction(id: AstraErrorRecoveryActionId): AstraErrorRecoveryActionDefinition | undefined {
  return ASTRA_ERROR_RECOVERY_ACTIONS.find((action) => action.id === id)
}

export function buildErrorRecoveryCardViewModel(id: AstraErrorSituationId): {
  whatHappenedCopy: string
  nextActionLabels: string[]
  progressCopy: string
} {
  const situation = getErrorSituation(id)
  if (!situation) {
    return {
      whatHappenedCopy: "Astra could not finish this task.",
      nextActionLabels: ["Try again"],
      progressCopy: "Local progress was kept.",
    }
  }

  return {
    whatHappenedCopy: situation.whatHappenedCopy,
    nextActionLabels: situation.recoveryActions
      .map((actionId) => getErrorRecoveryAction(actionId)?.label)
      .filter((label): label is string => Boolean(label)),
    progressCopy: situation.progressCopy,
  }
}

export function findTechnicalBlameTerms(copy: string): string[] {
  const normalized = copy.toLowerCase()
  return ASTRA_ERROR_TECHNICAL_BLAME_TERMS.filter((term) => {
    const escaped = escapeRegExp(term.toLowerCase())
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(normalized)
  })
}

export function evaluateAstraErrorRecoveryReadiness(
  evidence: AstraErrorRecoveryReadinessEvidence,
): AstraErrorRecoveryDecision {
  const findings = READINESS_CHECKS
    .filter((check) => !evidence[check.evidenceKey])
    .map<AstraErrorRecoveryFinding>((check) => ({
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
