import { describe, expect, it } from "vitest"

import {
  ASTRA_COMPETITIVE_REMEDIATION_RESPONSIBILITIES,
  ASTRA_FINAL_CONCLUSION_PILLARS,
  ASTRA_MACRO_ALIGNMENT_SUMMARY,
  ASTRA_MACRO_UPGRADE_RESPONSIBILITIES,
  evaluateAstraMacroAlignmentReadiness,
  type AstraMacroAlignmentReadinessEvidence,
} from "./macro-alignment"

const readyEvidence: AstraMacroAlignmentReadinessEvidence = {
  competitiveRemediationResponsibilitiesClear: true,
  macroUpgradeResponsibilitiesClear: true,
  remediationFeedsProductUpgrade: true,
  finalConclusionPillarsCovered: true,
  defaultPositioningNotMoreTranslationButtons: true,
  astraTurnsContentIntoLongTermAbility: true,
}

describe("Astra macro alignment contract", () => {
  it("separates competitive remediation responsibilities from macro product upgrade", () => {
    expect(ASTRA_COMPETITIVE_REMEDIATION_RESPONSIBILITIES.map((item) => item.id)).toEqual([
      "trusted_page_translation",
      "trusted_video_subtitles",
      "zero_config_technical_chain",
      "read_frog_immersive_parity",
    ])
    expect(ASTRA_COMPETITIVE_REMEDIATION_RESPONSIBILITIES.find((item) => item.id === "trusted_page_translation")?.boundary).toContain("should not re-open DOM strategy")
  })

  it("defines macro upgrade responsibilities", () => {
    expect(ASTRA_MACRO_UPGRADE_RESPONSIBILITIES.map((item) => item.id)).toEqual([
      "new_user_activation",
      "payment_reason",
      "learning_asset_accumulation",
      "long_term_retention",
      "user_trust",
      "brand_differentiation",
    ])
  })

  it("preserves the final conclusion pillars", () => {
    expect(ASTRA_FINAL_CONCLUSION_PILLARS.map((pillar) => pillar.id)).toEqual([
      "first_use_success",
      "no_ai_configuration",
      "saved_content_not_black_hole",
      "daily_review_guidance",
      "pages_videos_files_become_assets",
      "astra_understands_learning_needs",
      "paid_for_peace_of_mind_loop_assets",
    ])
    expect(ASTRA_FINAL_CONCLUSION_PILLARS.find((pillar) => pillar.id === "saved_content_not_black_hole")?.evidenceDirection).toContain("Review/Library destination")
  })

  it("states the alignment summary and one-line conclusion", () => {
    expect(ASTRA_MACRO_ALIGNMENT_SUMMARY.competitiveRemediationGoal).toContain("core comprehension")
    expect(ASTRA_MACRO_ALIGNMENT_SUMMARY.macroUpgradeGoal).toContain("chargeable")
    expect(ASTRA_MACRO_ALIGNMENT_SUMMARY.oneLineConclusion).toContain("long-term language ability")
  })

  it("passes readiness when remediation and macro product evidence are connected", () => {
    const decision = evaluateAstraMacroAlignmentReadiness(readyEvidence)
    expect(decision.ready).toBe(true)
    expect(decision.blockers).toEqual([])
    expect(decision.warnings).toEqual([])
  })

  it("blocks readiness when boundaries, final pillars, positioning, or long-term promise are missing", () => {
    const decision = evaluateAstraMacroAlignmentReadiness({
      ...readyEvidence,
      competitiveRemediationResponsibilitiesClear: false,
      macroUpgradeResponsibilitiesClear: false,
      finalConclusionPillarsCovered: false,
      defaultPositioningNotMoreTranslationButtons: false,
      astraTurnsContentIntoLongTermAbility: false,
    })

    expect(decision.ready).toBe(false)
    expect(decision.blockers.map((finding) => finding.code)).toEqual([
      "competitive_responsibilities_clear",
      "macro_upgrade_responsibilities_clear",
      "final_pillars_covered",
      "not_more_translation_buttons",
      "long_term_language_ability_promise",
    ])
  })

  it("warns when remediation is not tied to the product upgrade", () => {
    const decision = evaluateAstraMacroAlignmentReadiness({
      ...readyEvidence,
      remediationFeedsProductUpgrade: false,
    })

    expect(decision.ready).toBe(true)
    expect(decision.warnings.map((finding) => finding.code)).toEqual(["remediation_feeds_product_upgrade"])
  })
})
