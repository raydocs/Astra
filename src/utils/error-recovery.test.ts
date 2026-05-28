import { describe, expect, it } from "vitest"

import {
  ASTRA_ERROR_COPY_EXAMPLES,
  ASTRA_ERROR_RECOVERY_ACTIONS,
  ASTRA_ERROR_SITUATIONS,
  ASTRA_ERROR_TECHNICAL_BLAME_TERMS,
  ASTRA_UNRECOVERABLE_SUPPORT_FALLBACKS,
  buildErrorRecoveryCardViewModel,
  evaluateAstraErrorRecoveryReadiness,
  findTechnicalBlameTerms,
  getErrorRecoveryAction,
  getErrorSituation,
  type AstraErrorRecoveryReadinessEvidence,
} from "./error-recovery"

const readyEvidence: AstraErrorRecoveryReadinessEvidence = {
  visibleErrorsExplainWhatHappened: true,
  visibleErrorsExplainNextAction: true,
  visibleErrorsExplainProgressState: true,
  visibleErrorCopyShortActionable: true,
  slowContentHasWaitRetry: true,
  slowAiHasFasterMode: true,
  protectedPageHasSelectionOrReader: true,
  noCaptionsHasExplanationOrAlternateVideo: true,
  notSignedInHasSignIn: true,
  membershipLimitHasUpgradeOrLimitedMode: true,
  partialFailureHasRetryFailedItems: true,
  largeContentHasVisiblePartFirst: true,
  networkOfflineHasOnlineRetry: true,
  unrecoverableErrorsHaveSupportFallbacks: true,
  userCopyAvoidsTechnicalBlame: true,
  failedTasksDoNotLoseProgressSilently: true,
}

describe("Astra error recovery contract", () => {
  it("records the Section 10 short actionable copy examples", () => {
    expect(ASTRA_ERROR_COPY_EXAMPLES).toEqual([
      "Astra is taking longer than usual.",
      "Try again.",
      "Use faster mode.",
      "This page is protected.",
      "Try selecting text instead.",
      "No captions found for this video.",
      "Sign in to continue.",
      "Your progress was saved.",
    ])
  })

  it("defines user-facing recovery actions and support fallbacks", () => {
    expect(ASTRA_ERROR_RECOVERY_ACTIONS.map((action) => action.id)).toEqual([
      "wait",
      "retry",
      "use_faster_mode",
      "try_selection",
      "open_reader",
      "explain_no_captions",
      "try_another_video",
      "sign_in",
      "upgrade",
      "continue_limited_mode",
      "retry_failed_items",
      "translate_visible_part_first",
      "retry_when_online",
      "report_this_page",
      "copy_support_info",
      "contact_support",
      "help_center",
      "try_sample_page",
    ])
    expect(ASTRA_ERROR_RECOVERY_ACTIONS.every((action) => action.userFacing)).toBe(true)
    expect(ASTRA_UNRECOVERABLE_SUPPORT_FALLBACKS).toEqual([
      "report_this_page",
      "copy_support_info",
      "contact_support",
      "help_center",
      "try_sample_page",
    ])
  })

  it("maps every macro error situation to copy, recovery action, and progress copy", () => {
    expect(ASTRA_ERROR_SITUATIONS.map((situation) => situation.id)).toEqual([
      "content_loading_slow",
      "ai_response_slow",
      "page_protected",
      "no_captions",
      "not_signed_in",
      "membership_limit",
      "partial_failure",
      "large_content",
      "network_offline",
    ])

    for (const situation of ASTRA_ERROR_SITUATIONS) {
      expect(situation.whatHappenedCopy.length).toBeGreaterThan(0)
      expect(situation.recoveryActions.length).toBeGreaterThan(0)
      expect(situation.progressCopy.length).toBeGreaterThan(0)
    }

    expect(getErrorSituation("content_loading_slow")?.recoveryActions).toEqual(["wait", "retry"])
    expect(getErrorSituation("ai_response_slow")?.recoveryActions).toEqual(expect.arrayContaining(["use_faster_mode"]))
    expect(getErrorSituation("page_protected")?.recoveryActions).toEqual(["try_selection", "open_reader"])
    expect(getErrorSituation("no_captions")?.recoveryActions).toEqual(["explain_no_captions", "try_another_video"])
    expect(getErrorSituation("partial_failure")?.progressCopy).toBe("Completed items were kept.")
  })

  it("builds a visible recovery card model with what happened, next action, and progress copy", () => {
    expect(getErrorRecoveryAction("retry_when_online")?.label).toBe("Retry when online")
    expect(buildErrorRecoveryCardViewModel("network_offline")).toEqual({
      whatHappenedCopy: "Astra could not connect right now.",
      nextActionLabels: ["Retry when online"],
      progressCopy: "Local progress was kept.",
    })
  })

  it("detects technical blame terms in user-facing error copy", () => {
    expect(ASTRA_ERROR_TECHNICAL_BLAME_TERMS).toEqual([
      "provider",
      "upstream",
      "route",
      "relay",
      "token",
      "stack trace",
      "exception",
      "cache key",
      "serviceMode",
    ])
    expect(findTechnicalBlameTerms("Provider route failed with upstream token exception.")).toEqual([
      "provider",
      "upstream",
      "route",
      "token",
      "exception",
    ])
    expect(findTechnicalBlameTerms("Astra is taking longer than usual. Try again.")).toEqual([])
  })

  it("passes readiness when every visible error answers what happened, next action, and progress state", () => {
    const decision = evaluateAstraErrorRecoveryReadiness(readyEvidence)

    expect(decision.ready).toBe(true)
    expect(decision.blockers).toEqual([])
    expect(decision.warnings).toEqual([])
  })

  it("blocks readiness when required situation-to-action mappings are missing", () => {
    const decision = evaluateAstraErrorRecoveryReadiness({
      ...readyEvidence,
      visibleErrorsExplainWhatHappened: false,
      visibleErrorsExplainNextAction: false,
      visibleErrorsExplainProgressState: false,
      slowContentHasWaitRetry: false,
      slowAiHasFasterMode: false,
      protectedPageHasSelectionOrReader: false,
      noCaptionsHasExplanationOrAlternateVideo: false,
      notSignedInHasSignIn: false,
      membershipLimitHasUpgradeOrLimitedMode: false,
      partialFailureHasRetryFailedItems: false,
      largeContentHasVisiblePartFirst: false,
      networkOfflineHasOnlineRetry: false,
      unrecoverableErrorsHaveSupportFallbacks: false,
      failedTasksDoNotLoseProgressSilently: false,
    })

    expect(decision.ready).toBe(false)
    expect(decision.blockers.map((finding) => finding.code)).toEqual([
      "answers_what_happened",
      "answers_user_next_action",
      "answers_progress_saved",
      "slow_content_mapping",
      "slow_ai_mapping",
      "protected_page_mapping",
      "no_captions_mapping",
      "not_signed_in_mapping",
      "membership_limit_mapping",
      "partial_failure_mapping",
      "large_content_mapping",
      "network_offline_mapping",
      "support_fallbacks",
      "progress_not_lost",
    ])
  })

  it("keeps copy style and technical-blame checks as warnings", () => {
    const decision = evaluateAstraErrorRecoveryReadiness({
      ...readyEvidence,
      visibleErrorCopyShortActionable: false,
      userCopyAvoidsTechnicalBlame: false,
    })

    expect(decision.ready).toBe(true)
    expect(decision.warnings.map((finding) => finding.code)).toEqual([
      "short_actionable_copy",
      "no_technical_blame",
    ])
  })
})
