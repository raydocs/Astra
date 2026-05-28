import { describe, expect, it } from "vitest"

import {
  ASTRA_BRAND_COPY_RULES,
  ASTRA_BRAND_DEFAULT_SURFACE_AUDIT,
  ASTRA_BRAND_FEELINGS,
  ASTRA_BRAND_UI_PRINCIPLES,
  copyUsesPreferredBrandTone,
  evaluateAstraBrandDefaultSurfaceCopyAudit,
  evaluateAstraBrandExperienceReadiness,
  findDiscouragedBrandTerms,
  type AstraBrandReadinessEvidence,
} from "./brand-experience"

const readyEvidence: AstraBrandReadinessEvidence = {
  copyAvoidsBackOfficeTerms: true,
  copyUsesLearningTone: true,
  onePrimaryActionPerScreen: true,
  lowFrequencyFeaturesCollapsed: true,
  diagnosticsHiddenByDefault: true,
  taskCardLayoutsUsed: true,
  statusPillStateLanguageUsed: true,
  taskGroupingNotTechnicalModules: true,
  advancedSettingsSecondary: true,
  errorCardsHaveAction: true,
  emotionalValueCopyPresent: true,
  tokenBasedVisualSystemUsed: true,
}

describe("Astra brand experience contract", () => {
  it("defines the intended brand feelings from section 13", () => {
    expect(ASTRA_BRAND_FEELINGS.map((feeling) => feeling.id)).toEqual([
      "quiet",
      "automatic",
      "reliable",
      "refined",
      "lightweight",
      "clear",
      "next_step_oriented",
      "not_back_office",
    ])
    expect(ASTRA_BRAND_FEELINGS.find((feeling) => feeling.id === "not_back_office")?.defaultSurfaceImplication)
      .toContain("diagnostics")
  })

  it("codifies discouraged and preferred copy language", () => {
    expect(ASTRA_BRAND_COPY_RULES.sayLess).toEqual([
      "Configure",
      "Provider",
      "Route",
      "Relay",
      "Token",
      "Debug",
      "Advanced",
      "Error code",
    ])
    expect(ASTRA_BRAND_COPY_RULES.sayMore).toEqual([
      "Ready",
      "Done",
      "Keep reading",
      "Review later",
      "Saved for review",
      "Astra handled it",
      "Best for this content",
      "Try again",
    ])
    expect(ASTRA_BRAND_COPY_RULES.emotionalCopy).toEqual(expect.arrayContaining([
      "Nice — your first review card is ready.",
      "You are building a learning trail from real content.",
      "Done for today.",
      "You came back 3 days in a row.",
    ]))
  })

  it("detects back-office copy while allowing quiet learning copy", () => {
    expect(findDiscouragedBrandTerms("Provider route debug: token relay error code")).toEqual([
      "Provider",
      "Route",
      "Relay",
      "Token",
      "Debug",
      "Error code",
    ])
    expect(findDiscouragedBrandTerms("Ready. Saved for review. Keep reading or try again.")).toEqual([])
    expect(copyUsesPreferredBrandTone("Astra handled it — best for this content.")).toBe(true)
    expect(copyUsesPreferredBrandTone("Provider route fallback completed.")).toBe(false)
  })

  it("records the default-surface audit rows that still need Section 13 manual evidence", () => {
    expect(ASTRA_BRAND_DEFAULT_SURFACE_AUDIT.map((surface) => surface.id)).toEqual([
      "default_onboarding_copy",
      "popup_deep_read_copy",
      "library_review_copy",
      "error_boundary_copy",
      "store_landing_claim_freeze",
    ])
    expect(ASTRA_BRAND_DEFAULT_SURFACE_AUDIT.map((surface) => surface.manualQaRow)).toEqual([
      "Default onboarding copy",
      "Popup / Deep Read copy",
      "Library / Review copy",
      "Error/boundary copy",
      "Store/landing copy claim freeze",
    ])
    expect(ASTRA_BRAND_DEFAULT_SURFACE_AUDIT.every((surface) => surface.currentRepoEvidence.length > 0)).toBe(true)
    expect(ASTRA_BRAND_DEFAULT_SURFACE_AUDIT.every((surface) => surface.remainingReleaseProof.includes("Section 13") || surface.remainingReleaseProof.includes("owner approval"))).toBe(true)
  })

  it("evaluates default-surface copy samples with the same discouraged-term and preferred-tone contract", () => {
    const findings = evaluateAstraBrandDefaultSurfaceCopyAudit([
      { surfaceId: "default_onboarding_copy", copy: "Ready. Keep reading. Saved for review." },
      { surfaceId: "popup_deep_read_copy", copy: "Astra handled it — best for this content. Try again if needed." },
      { surfaceId: "error_boundary_copy", copy: "Provider route debug token error code." },
    ])

    expect(findings).toEqual([
      {
        surfaceId: "default_onboarding_copy",
        discouragedTerms: [],
        usesPreferredTone: true,
        ready: true,
      },
      {
        surfaceId: "popup_deep_read_copy",
        discouragedTerms: [],
        usesPreferredTone: true,
        ready: true,
      },
      {
        surfaceId: "error_boundary_copy",
        discouragedTerms: ["Provider", "Route", "Token", "Debug", "Error code"],
        usesPreferredTone: false,
        ready: false,
      },
    ])
  })

  it("records the UI principles for default user-facing surfaces", () => {
    expect(ASTRA_BRAND_UI_PRINCIPLES.map((principle) => principle.id)).toEqual([
      "one_primary_action",
      "low_frequency_collapsed",
      "diagnostics_not_default",
      "task_cards_not_setting_tables",
      "status_pills",
      "group_by_user_task",
      "advanced_settings_secondary",
      "error_cards_have_action",
    ])
    expect(ASTRA_BRAND_UI_PRINCIPLES.find((principle) => principle.id === "group_by_user_task")?.defaultSurfaceImplication)
      .toContain("provider/route/model/cache")
  })

  it("passes readiness when copy, layout, diagnostics, error, emotional, and token evidence exist", () => {
    const decision = evaluateAstraBrandExperienceReadiness(readyEvidence)

    expect(decision.ready).toBe(true)
    expect(decision.blockers).toEqual([])
    expect(decision.warnings).toEqual([])
  })

  it("blocks readiness when default UI still feels like a backend system", () => {
    const decision = evaluateAstraBrandExperienceReadiness({
      ...readyEvidence,
      copyAvoidsBackOfficeTerms: false,
      copyUsesLearningTone: false,
      onePrimaryActionPerScreen: false,
      lowFrequencyFeaturesCollapsed: false,
      diagnosticsHiddenByDefault: false,
      taskGroupingNotTechnicalModules: false,
      advancedSettingsSecondary: false,
      errorCardsHaveAction: false,
    })

    expect(decision.ready).toBe(false)
    expect(decision.blockers.map((finding) => finding.code)).toEqual([
      "copy_avoids_back_office_terms",
      "copy_uses_learning_tone",
      "one_primary_action_per_screen",
      "low_frequency_features_collapsed",
      "diagnostics_hidden_by_default",
      "task_grouping_not_technical_modules",
      "advanced_settings_secondary",
      "error_cards_actionable",
    ])
  })

  it("keeps task-card, status-pill, emotional-copy, and visual-token evidence as warnings", () => {
    const decision = evaluateAstraBrandExperienceReadiness({
      ...readyEvidence,
      taskCardLayoutsUsed: false,
      statusPillStateLanguageUsed: false,
      emotionalValueCopyPresent: false,
      tokenBasedVisualSystemUsed: false,
    })

    expect(decision.ready).toBe(true)
    expect(decision.warnings.map((finding) => finding.code)).toEqual([
      "task_card_layouts",
      "status_pill_state_language",
      "emotional_value_copy_present",
      "token_based_visual_system",
    ])
  })
})
