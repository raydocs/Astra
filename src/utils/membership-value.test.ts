import { describe, expect, it } from "vitest"

import {
  ASTRA_MEMBERSHIP_COPY_EXAMPLES,
  ASTRA_MEMBERSHIP_TIERS,
  ASTRA_MEMBERSHIP_VALUE_MOMENTS,
  ASTRA_MEMBERSHIP_VALUE_REASONS,
  evaluateAstraMembershipValueReadiness,
  findMembershipForbiddenCopyTerms,
  type AstraMembershipReadinessEvidence,
} from "./membership-value"

const readyEvidence: AstraMembershipReadinessEvidence = {
  valueFramedBeyondMoreUsage: true,
  noHardSellBeforeValue: true,
  valueMomentsCoveredNearFeature: true,
  preferredCopyPresent: true,
  forbiddenTechnicalCopyAbsent: true,
  freeBoundaryClear: true,
  proBoundaryClear: true,
  premiumFamilyClassroomDeferred: true,
  cancellationKeepsExistingAssetsAccessible: true,
}

describe("Astra membership value contract", () => {
  it("frames paid value beyond more usage", () => {
    expect(ASTRA_MEMBERSHIP_VALUE_REASONS.map((reason) => reason.id)).toEqual([
      "zero_ai_setup",
      "automatic_capability_choice",
      "stable_service",
      "faster_understanding",
      "higher_quality_understanding",
      "unified_pages_videos_files",
      "saveable_content",
      "automatic_review",
      "multi_device_continuity",
      "support_and_maintenance",
    ])
  })

  it("places membership prompts near feature value moments", () => {
    expect(ASTRA_MEMBERSHIP_VALUE_MOMENTS.map((moment) => moment.id)).toEqual([
      "first_high_quality_explanation",
      "saved_multiple_sentences",
      "long_content_summary",
      "cross_device_sync",
      "long_video_learning",
      "learning_data_export",
    ])
    expect(ASTRA_MEMBERSHIP_VALUE_MOMENTS.find((moment) => moment.id === "first_high_quality_explanation")?.promptStyle).toBe("soft_hint")
    expect(ASTRA_MEMBERSHIP_VALUE_MOMENTS.filter((moment) => moment.promptStyle === "hard_block_after_value").map((moment) => moment.id)).toEqual([
      "long_content_summary",
      "cross_device_sync",
      "long_video_learning",
      "learning_data_export",
    ])
  })

  it("defines preferred and forbidden membership copy", () => {
    expect(ASTRA_MEMBERSHIP_COPY_EXAMPLES.filter((example) => example.principle === "preferred").map((example) => example.text)).toEqual([
      "Included with your membership",
      "Astra handles the AI for you",
      "Your saved sentences become review cards",
      "Keep learning across devices",
      "Best for long or technical content",
    ])
    expect(ASTRA_MEMBERSHIP_COPY_EXAMPLES.filter((example) => example.principle === "forbidden").map((example) => example.text)).toEqual([
      "Unlock provider routing",
      "Use premium model",
      "Increase token quota",
      "Relay usage exceeded",
    ])
  })

  it("defines Free, Pro, and later tiers with clear boundaries", () => {
    expect(ASTRA_MEMBERSHIP_TIERS.map((tier) => tier.id)).toEqual([
      "free",
      "pro",
      "premium_family_classroom_later",
    ])
    expect(ASTRA_MEMBERSHIP_TIERS.find((tier) => tier.id === "free")?.capabilities).toEqual([
      "small daily understanding allowance",
      "selection and short-text experience",
      "small saved-word/sentence set",
      "local basic Review",
      "sample content experience",
    ])
    expect(ASTRA_MEMBERSHIP_TIERS.find((tier) => tier.id === "pro")?.capabilities).toEqual(expect.arrayContaining([
      "managed AI",
      "video learning",
      "file learning",
      "learning asset library",
      "sync",
      "Learning Digest",
    ]))
    expect(ASTRA_MEMBERSHIP_TIERS.find((tier) => tier.id === "premium_family_classroom_later")?.launchTiming).toBe("later")
  })

  it("detects forbidden technical membership copy", () => {
    expect(findMembershipForbiddenCopyTerms("Astra handles the AI for you and keeps learning across devices.")).toEqual([])
    expect(findMembershipForbiddenCopyTerms("Unlock provider routing with premium model token quota after relay usage exceeded.")).toEqual([
      "provider",
      "routing",
      "premium model",
      "token quota",
      "relay usage",
    ])
  })

  it("passes readiness when membership value is feature-proximate and learning-first", () => {
    const decision = evaluateAstraMembershipValueReadiness(readyEvidence)
    expect(decision.ready).toBe(true)
    expect(decision.blockers).toEqual([])
    expect(decision.warnings).toEqual([])
  })

  it("blocks readiness when value, timing, technical-copy, tier, or cancellation boundaries are missing", () => {
    const decision = evaluateAstraMembershipValueReadiness({
      ...readyEvidence,
      valueFramedBeyondMoreUsage: false,
      noHardSellBeforeValue: false,
      valueMomentsCoveredNearFeature: false,
      forbiddenTechnicalCopyAbsent: false,
      freeBoundaryClear: false,
      proBoundaryClear: false,
      premiumFamilyClassroomDeferred: false,
      cancellationKeepsExistingAssetsAccessible: false,
    })

    expect(decision.ready).toBe(false)
    expect(decision.blockers.map((finding) => finding.code)).toEqual([
      "value_not_more_times_only",
      "no_opening_hard_sell",
      "value_moments_covered",
      "forbidden_technical_copy_absent",
      "free_boundary_clear",
      "pro_boundary_clear",
      "later_tiers_deferred",
      "existing_assets_accessible",
    ])
  })

  it("warns, without blocking, when preferred copy is not represented", () => {
    const decision = evaluateAstraMembershipValueReadiness({
      ...readyEvidence,
      preferredCopyPresent: false,
    })

    expect(decision.ready).toBe(true)
    expect(decision.warnings.map((finding) => finding.code)).toEqual(["preferred_copy_present"])
  })
})
