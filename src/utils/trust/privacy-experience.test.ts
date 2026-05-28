import { describe, expect, it } from "vitest"

import {
  ASTRA_PRIVACY_CONTROLS,
  ASTRA_PRIVACY_MODE_ACCURATE_COPY,
  ASTRA_PRIVACY_OVERCLAIMS,
  ASTRA_PRIVACY_USER_CONCERNS,
  ASTRA_TRUST_CARD_MESSAGES,
  evaluateAstraTrustPrivacyReadiness,
  findPrivacyOverclaimCopy,
  type AstraTrustPrivacyReadinessEvidence,
} from "./privacy-experience"

const readyEvidence: AstraTrustPrivacyReadinessEvidence = {
  userConcernsAnswered: true,
  trustCardsShownInCoreSurfaces: true,
  trustCopyUsesOrdinaryLanguage: true,
  requiredPrivacyControlsVisible: true,
  overclaimCopyAbsent: true,
  privacyModeCopyAccurate: true,
  cancellationDataBoundaryClear: true,
}

describe("Astra trust and privacy experience contract", () => {
  it("answers ordinary user privacy concerns", () => {
    expect(ASTRA_PRIVACY_USER_CONCERNS.map((concern) => concern.id)).toEqual([
      "page_content_upload",
      "learning_record_visibility",
      "saved_content_deletion",
      "page_save_opt_out",
      "cancellation_data_access",
    ])
    expect(ASTRA_PRIVACY_USER_CONCERNS.find((concern) => concern.id === "page_content_upload")?.answerDirection).toContain("only text needed")
    expect(ASTRA_PRIVACY_USER_CONCERNS.find((concern) => concern.id === "cancellation_data_access")?.answerDirection).toContain("existing saved learning assets remain accessible")
  })

  it("defines ordinary-language trust card copy for onboarding, settings, and Library", () => {
    expect(ASTRA_TRUST_CARD_MESSAGES.map((message) => message.english)).toEqual([
      "Astra only sends the text needed to help you understand content.",
      "You choose what gets saved.",
      "Privacy Mode reduces page context.",
      "You can delete your saved learning data anytime.",
    ])
    expect(ASTRA_TRUST_CARD_MESSAGES.find((message) => message.id === "needed_text_only")?.surfaces).toEqual([
      "onboarding",
      "settings",
      "library",
    ])
    expect(ASTRA_TRUST_CARD_MESSAGES.every((message) => message.chineseDirection.length > 0)).toBe(true)
  })

  it("lists the required user privacy controls", () => {
    expect(ASTRA_PRIVACY_CONTROLS.map((control) => control.id)).toEqual([
      "privacy_mode",
      "do_not_save_current_page",
      "delete_current_page_learning_record",
      "delete_video_note",
      "delete_all_learning_data",
      "export_my_data",
      "disable_reading_history_sync",
      "delete_account_data",
    ])
    expect(ASTRA_PRIVACY_CONTROLS.every((control) => control.requiredForP0)).toBe(true)
  })

  it("detects privacy overclaims and preserves accurate Privacy Mode copy", () => {
    expect(ASTRA_PRIVACY_OVERCLAIMS.map((overclaim) => overclaim.forbiddenCopy)).toEqual([
      "fully local",
      "never uploads",
      "end-to-end encrypted",
      "absolutely no logs",
      "all pages are safe",
    ])
    expect(findPrivacyOverclaimCopy("Astra is fully local and never uploads anything." ).map((overclaim) => overclaim.id)).toEqual([
      "fully_local",
      "never_uploads",
    ])
    expect(findPrivacyOverclaimCopy("Astra only sends the text needed to help you understand content.")).toEqual([])
    expect(ASTRA_PRIVACY_MODE_ACCURATE_COPY).toContain("Translation text may still leave the device")
  })

  it("passes readiness when trust copy is accurate, visible, and controllable", () => {
    const decision = evaluateAstraTrustPrivacyReadiness(readyEvidence)
    expect(decision.ready).toBe(true)
    expect(decision.blockers).toEqual([])
    expect(decision.warnings).toEqual([])
  })

  it("blocks readiness when concerns, controls, overclaim, Privacy Mode, or cancellation boundaries fail", () => {
    const decision = evaluateAstraTrustPrivacyReadiness({
      ...readyEvidence,
      userConcernsAnswered: false,
      requiredPrivacyControlsVisible: false,
      overclaimCopyAbsent: false,
      privacyModeCopyAccurate: false,
      cancellationDataBoundaryClear: false,
    })

    expect(decision.ready).toBe(false)
    expect(decision.blockers.map((finding) => finding.code)).toEqual([
      "concerns_answered",
      "privacy_controls_visible",
      "overclaims_absent",
      "privacy_mode_copy_accurate",
      "cancellation_data_boundary",
    ])
  })

  it("warns when trust cards or ordinary-language copy are missing", () => {
    const decision = evaluateAstraTrustPrivacyReadiness({
      ...readyEvidence,
      trustCardsShownInCoreSurfaces: false,
      trustCopyUsesOrdinaryLanguage: false,
    })

    expect(decision.ready).toBe(true)
    expect(decision.warnings.map((finding) => finding.code)).toEqual([
      "trust_cards_present",
      "ordinary_language_copy",
    ])
  })
})
