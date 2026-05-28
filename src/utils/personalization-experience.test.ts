import { describe, expect, it } from "vitest"

import {
  ASTRA_GLOSSARY_SIGNALS,
  ASTRA_LEARNING_PURPOSES,
  ASTRA_PERSONALIZATION_CONTROLS,
  ASTRA_PERSONALIZATION_DEFAULT_COPY,
  ASTRA_PERSONALIZATION_PROFILE_FIELDS,
  ASTRA_PERSONALIZED_BEHAVIORS,
  buildPersonalizedReviewPlan,
  derivePersonalizedReviewCardLimit,
  evaluateAstraPersonalizationReadiness,
  orderReviewQueueForLearningProfile,
  type AstraPersonalizationReadinessEvidence,
} from "./personalization-experience"

const readyEvidence: AstraPersonalizationReadinessEvidence = {
  collectsOnlyLightweightProfileFields: true,
  defaultExperienceReducesExplicitSettings: true,
  profileInfluencesRequiredBehaviors: true,
  glossaryLearnsFromAllowedSignals: true,
  glossaryUsesSimpleUserCopy: true,
  usersCanViewRememberedTerms: true,
  usersCanDeletePreferenceOrTerm: true,
  usersCanDisablePersonalization: true,
  usersCanExcludeSite: true,
  writePolicyRespectsPrivacyModeAndSiteExclusions: true,
}

describe("Astra personalization experience contract", () => {
  it("orders and sizes Review from the reversible learning profile", () => {
    const articleCard = {
      id: "article-card",
      text: "article",
      savedAt: 1000,
      srsBox: 1,
      nextReviewAt: 0,
      reviewCount: 0,
      sourceContext: {
        surface: "popup_deep_read" as const,
        pageUrl: "https://example.com/article",
        sentenceText: "Article sentence",
      },
    }
    const subtitleCard = {
      ...articleCard,
      id: "subtitle-card",
      text: "subtitle",
      url: "astra-local://subtitle/sample.srt",
      sourceContext: {
        surface: "subtitle_reader" as const,
        pageUrl: "astra-local://subtitle/sample.srt",
        sentenceText: "Subtitle sentence",
        ownedReadingSourceType: "subtitle-file" as const,
      },
    }
    const profile = {
      version: 1 as const,
      targetLang: "zh-CN",
      languageLevel: "intermediate" as const,
      explainMode: "deep" as const,
      primaryGoal: "watch_tutorials" as const,
      dailyGoalMinutes: 1,
      personalizationEnabled: true,
      excludedHostnames: [],
      rememberedTerms: [],
      updatedAt: "2026-05-27T00:00:00.000Z",
    }

    expect(derivePersonalizedReviewCardLimit(0)).toBe(1)
    expect(orderReviewQueueForLearningProfile([articleCard, subtitleCard], profile).map((card) => card.id)).toEqual([
      "subtitle-card",
      "article-card",
    ])

    const plan = buildPersonalizedReviewPlan([articleCard, subtitleCard], profile)
    expect(plan.profileApplied).toBe(true)
    expect(plan.cards.map((card) => card.id)).toEqual(["subtitle-card"])
    expect(plan.headline).toBe("Personalized review: Watch videos")
    expect(plan.detail).toContain("1-card session")
    expect(plan.evidence).toContain("2 due cards → 1 queued")
    expect(plan.reversibleCopy).toContain("turn personalization off")

    const disabledPlan = buildPersonalizedReviewPlan([articleCard, subtitleCard], {
      ...profile,
      personalizationEnabled: false,
    })
    expect(disabledPlan.profileApplied).toBe(false)
    expect(disabledPlan.cards.map((card) => card.id)).toEqual(["article-card", "subtitle-card"])
    expect(disabledPlan.detail).toContain("normal due-card order")
  })

  it("keeps the learning profile lightweight", () => {
    expect(ASTRA_PERSONALIZATION_PROFILE_FIELDS.map((field) => field.id)).toEqual([
      "target_language",
      "current_level",
      "learning_purpose",
      "explanation_preference",
      "daily_learning_time",
    ])
    expect(ASTRA_PERSONALIZATION_PROFILE_FIELDS.filter((field) => field.defaultUserBurden === "onboarding").map((field) => field.id)).toEqual([
      "target_language",
      "current_level",
      "learning_purpose",
    ])
  })

  it("defines the macro-plan learning purposes", () => {
    expect(ASTRA_LEARNING_PURPOSES.map((purpose) => purpose.id)).toEqual([
      "understand_web_pages",
      "understand_videos",
      "work_study",
      "exam_prep",
      "interest_reading",
      "build_vocabulary",
    ])
  })

  it("maps preferences to product behavior instead of visible configuration", () => {
    expect(ASTRA_PERSONALIZED_BEHAVIORS.map((behavior) => behavior.id)).toEqual([
      "explanation_depth",
      "grammar_visibility",
      "save_recommendations",
      "review_difficulty",
      "summary_style",
      "terminology_explanation",
      "listening_shadowing_recommendations",
      "daily_goal_size",
    ])
  })

  it("bounds Personal Glossary signals and user controls", () => {
    expect(ASTRA_GLOSSARY_SIGNALS.map((signal) => signal.id)).toEqual([
      "saved_terms",
      "user_corrections",
      "site_common_terms",
      "proper_nouns",
      "people_product_technical_terms",
    ])
    expect(new Set(ASTRA_GLOSSARY_SIGNALS.map((signal) => signal.userVisibleCopy))).toEqual(new Set([
      "Astra remembered your preferred terms.",
    ]))
    expect(ASTRA_PERSONALIZATION_CONTROLS.map((control) => control.id)).toEqual([
      "view_remembered_terms",
      "delete_preference",
      "disable_personalization",
      "exclude_site",
    ])
    expect(ASTRA_PERSONALIZATION_CONTROLS.every((control) => control.requiredForP0)).toBe(true)
    expect(ASTRA_PERSONALIZATION_DEFAULT_COPY).toEqual([
      "Astra remembered your preferred terms.",
      "What Astra remembers",
      "Forget this term",
      "Turn off personalization",
      "Do not learn from this site",
    ])
  })

  it("passes readiness when personalization is lightweight, useful, visible, and reversible", () => {
    const decision = evaluateAstraPersonalizationReadiness(readyEvidence)
    expect(decision.ready).toBe(true)
    expect(decision.blockers).toEqual([])
    expect(decision.warnings).toEqual([])
  })

  it("blocks readiness when personalization loses field, behavior, glossary, control, or write-policy boundaries", () => {
    const decision = evaluateAstraPersonalizationReadiness({
      ...readyEvidence,
      collectsOnlyLightweightProfileFields: false,
      profileInfluencesRequiredBehaviors: false,
      glossaryLearnsFromAllowedSignals: false,
      usersCanViewRememberedTerms: false,
      usersCanDeletePreferenceOrTerm: false,
      usersCanDisablePersonalization: false,
      usersCanExcludeSite: false,
      writePolicyRespectsPrivacyModeAndSiteExclusions: false,
    })

    expect(decision.ready).toBe(false)
    expect(decision.blockers.map((finding) => finding.code)).toEqual([
      "lightweight_profile_only",
      "behavior_influence_coverage",
      "glossary_signal_coverage",
      "view_memory_control",
      "delete_preference_control",
      "disable_personalization_control",
      "exclude_site_control",
      "write_policy_respects_privacy",
    ])
  })

  it("warns when personalization adds configuration or glossary copy feels technical", () => {
    const decision = evaluateAstraPersonalizationReadiness({
      ...readyEvidence,
      defaultExperienceReducesExplicitSettings: false,
      glossaryUsesSimpleUserCopy: false,
    })

    expect(decision.ready).toBe(true)
    expect(decision.warnings.map((finding) => finding.code)).toEqual([
      "reduces_configuration",
      "simple_glossary_copy",
    ])
  })
})
