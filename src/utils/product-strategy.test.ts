import { describe, expect, it } from "vitest"

import {
  ASTRA_BEACHHEAD_PERSONA,
  ASTRA_DEFAULT_ENTRY_JTBD_MAPPINGS,
  ASTRA_JTBD_SCENARIOS,
  ASTRA_PAYWALL_TIERS,
  ASTRA_PAYWALL_TRIGGERS,
  ASTRA_PERSONAS,
  ASTRA_TRIAL_AHA_MOMENTS,
  evaluateAstraProductStrategyReadiness,
  findPaywallTechnicalTerms,
  getJtbdForDefaultEntry,
  type AstraProductStrategyReadinessEvidence,
} from "./product-strategy"

const readyEvidence: AstraProductStrategyReadinessEvidence = {
  beachheadPersonaDefined: true,
  personaCopyUnifiedAcrossOnboardingLandingStorePaywall: true,
  onboardingCoreQuestionsAtMostThree: true,
  sampleContentCoversArticleDocVideo: true,
  p0GrowthChannelsPersonaAligned: true,
  defaultEntriesMappedToJtbd: true,
  everyJtbdHasSuccessMoment: true,
  everyJtbdHasNextStep: true,
  p0AssetsCanReturnToSource: true,
  p0FailuresHaveFallback: true,
  paywallCopyHasZeroTechnicalTerms: true,
  noHardPaywallBeforeFirstValue: true,
  trialAhaMomentsInstrumented: true,
  cancellationKeepsExistingAssetsAccessible: true,
  betaBillingBoundaryRespected: true,
}

describe("Astra product strategy contract", () => {
  it("defines the beachhead persona and keeps AI power users out of the default priority", () => {
    expect(ASTRA_BEACHHEAD_PERSONA.summary).toContain("Chinese-native")
    expect(ASTRA_BEACHHEAD_PERSONA.mustInclude).toEqual(expect.arrayContaining([
      "Reads English web pages, technical docs, news, papers, or watches English tutorials",
      "Does not want to configure providers, API keys, models, or prompts",
    ]))
    expect(ASTRA_BEACHHEAD_PERSONA.mustAvoidDefaultingTo).toEqual(expect.arrayContaining([
      "all language learners",
      "AI provider console users",
      "complete course or LMS buyers",
    ]))

    expect(ASTRA_PERSONAS.map((persona) => persona.id)).toEqual([
      "chinese_knowledge_worker",
      "english_video_learner",
      "student_exam_learner",
      "work_communication_user",
      "ai_power_user",
    ])
    expect(ASTRA_PERSONAS.filter((persona) => persona.priority === "P0").map((persona) => persona.id)).toEqual([
      "chinese_knowledge_worker",
      "english_video_learner",
    ])
    expect(ASTRA_PERSONAS.find((persona) => persona.id === "ai_power_user")?.priority).toBe("P2")
  })

  it("codifies the JTBD scenario table with success moments, next steps, assets, fallbacks, and metrics", () => {
    expect(ASTRA_JTBD_SCENARIOS.map((scenario) => scenario.id)).toEqual([
      "read_article_understand",
      "read_technical_documentation",
      "watch_english_video",
      "explain_word_or_phrase",
      "write_natural_english",
      "daily_review",
      "weekly_learning_recap",
    ])

    for (const scenario of ASTRA_JTBD_SCENARIOS) {
      expect(scenario.successMoment.length).toBeGreaterThan(0)
      expect(scenario.nextBestAction.length).toBeGreaterThan(0)
      expect(scenario.savedAssets.length).toBeGreaterThan(0)
      expect(scenario.fallbackActions.length).toBeGreaterThan(0)
      expect(scenario.metrics.length).toBeGreaterThan(0)
    }

    expect(ASTRA_JTBD_SCENARIOS.find((scenario) => scenario.id === "daily_review")?.savedAssets).toContain("ReviewSession")
    expect(ASTRA_JTBD_SCENARIOS.find((scenario) => scenario.id === "read_article_understand")?.fallbackActions)
      .toEqual(expect.arrayContaining(["translate selected passage", "open reader"]))
  })

  it("maps every default product entry to at least one JTBD scenario", () => {
    expect(ASTRA_DEFAULT_ENTRY_JTBD_MAPPINGS.map((mapping) => mapping.entry)).toEqual([
      "landing_hero",
      "chrome_store_listing",
      "onboarding_goal",
      "sample_lesson",
      "content_selection_toolbar",
      "video_transcript_panel",
      "library_home",
      "review_queue",
      "weekly_digest",
      "paywall",
      "help_center",
    ])

    const scenarioIds = new Set(ASTRA_JTBD_SCENARIOS.map((scenario) => scenario.id))
    for (const mapping of ASTRA_DEFAULT_ENTRY_JTBD_MAPPINGS) {
      expect(mapping.scenarioIds.length).toBeGreaterThan(0)
      expect(mapping.primaryAction.length).toBeGreaterThan(0)
      expect(mapping.defaultCopyDirection.length).toBeGreaterThan(0)
      for (const scenarioId of mapping.scenarioIds) {
        expect(scenarioIds.has(scenarioId)).toBe(true)
      }
    }

    expect(getJtbdForDefaultEntry("paywall")?.scenarioIds).toEqual(expect.arrayContaining([
      "read_article_understand",
      "watch_english_video",
      "weekly_learning_recap",
    ]))
  })

  it("defines Free, Trial, and Pro without using token/provider/model framing", () => {
    expect(ASTRA_PAYWALL_TIERS.map((tier) => tier.id)).toEqual(["free", "trial", "pro"])
    expect(ASTRA_PAYWALL_TIERS.find((tier) => tier.id === "free")?.publicPromise).toContain("first success")
    expect(ASTRA_PAYWALL_TIERS.find((tier) => tier.id === "pro")?.publicPromise).toContain("focus on reading and learning")

    const publicCopy = ASTRA_PAYWALL_TIERS.flatMap((tier) => [
      tier.publicLabel,
      tier.publicPromise,
      ...tier.capabilityBoundary,
    ]).join("\n")
    expect(findPaywallTechnicalTerms(publicCopy)).toEqual([])
  })

  it("keeps hard paywalls after first value and records the three trial aha moments", () => {
    expect(ASTRA_PAYWALL_TRIGGERS.find((trigger) => trigger.id === "before_first_value")).toEqual(expect.objectContaining({
      hardBlock: false,
      allowedBeforeFirstUnderstanding: true,
    }))
    expect(ASTRA_PAYWALL_TRIGGERS.filter((trigger) => trigger.hardBlock).every((trigger) => !trigger.allowedBeforeFirstUnderstanding)).toBe(true)

    expect(ASTRA_TRIAL_AHA_MOMENTS.map((moment) => moment.id)).toEqual([
      "understand_real_content",
      "save_for_review",
      "see_long_term_value",
    ])
  })

  it("detects technical paywall terms while allowing non-technical managed AI value copy", () => {
    expect(findPaywallTechnicalTerms("Astra Pro handles the AI for you, so you can focus on reading and learning.")).toEqual([])
    expect(findPaywallTechnicalTerms("Premium model quota exceeded. Provider fallback unavailable. Token limit reached.")).toEqual([
      "token",
      "provider",
      "model",
    ])
  })

  it("passes readiness when persona, JTBD, and paywall evidence are present", () => {
    const decision = evaluateAstraProductStrategyReadiness(readyEvidence)

    expect(decision.ready).toBe(true)
    expect(decision.findings).toEqual([])
  })

  it("blocks readiness for missing Section 19-21 evidence", () => {
    const decision = evaluateAstraProductStrategyReadiness({
      beachheadPersonaDefined: false,
      personaCopyUnifiedAcrossOnboardingLandingStorePaywall: false,
      onboardingCoreQuestionsAtMostThree: false,
      sampleContentCoversArticleDocVideo: false,
      p0GrowthChannelsPersonaAligned: false,
      defaultEntriesMappedToJtbd: false,
      everyJtbdHasSuccessMoment: false,
      everyJtbdHasNextStep: false,
      p0AssetsCanReturnToSource: false,
      p0FailuresHaveFallback: false,
      paywallCopyHasZeroTechnicalTerms: false,
      noHardPaywallBeforeFirstValue: false,
      trialAhaMomentsInstrumented: false,
      cancellationKeepsExistingAssetsAccessible: false,
      betaBillingBoundaryRespected: false,
    })

    expect(decision.ready).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual([
      "beachhead_persona_defined",
      "persona_copy_unified",
      "onboarding_questions_scoped",
      "sample_content_coverage",
      "growth_channels_persona_aligned",
      "default_entries_mapped_to_jtbd",
      "jtbd_success_moments",
      "jtbd_next_steps",
      "jtbd_assets_return_to_source",
      "jtbd_fallbacks",
      "paywall_non_technical_copy",
      "paywall_after_first_value",
      "trial_aha_moments",
      "cancellation_asset_access",
      "beta_billing_boundary",
    ])
  })
})
