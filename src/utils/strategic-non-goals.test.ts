import { describe, expect, it } from "vitest"

import { ASTRA_PROPOSAL_GATE_QUESTIONS, evaluateAstraProposalGate } from "./strategic-non-goals"

describe("strategic non-goals proposal gate", () => {
  it("requires all six section-19 gate questions", () => {
    expect(ASTRA_PROPOSAL_GATE_QUESTIONS.map((item) => item.code)).toEqual([
      "supports_zero_config",
      "controls_cost",
      "ordinary_language",
      "privacy_by_default",
      "learning_loop_or_paid_value",
      "support_analytics_observable",
    ])

    const decision = evaluateAstraProposalGate({
      supportsZeroConfig: false,
      controlsCost: false,
      ordinaryLanguage: false,
      protectsPrivacyByDefault: false,
      advancesLearningLoopOrPaidValue: false,
      observableBySupportAndAnalytics: false,
      surfaceBoundary: "default",
    })

    expect(decision.decision).toBe("defer")
    expect(decision.findings.map((finding) => finding.code)).toEqual([
      "supports_zero_config",
      "controls_cost",
      "ordinary_language",
      "privacy_by_default",
      "learning_loop_or_paid_value",
      "support_analytics_observable",
    ])
    expect(decision.requiredNextSteps).toEqual(expect.arrayContaining([
      "Add a task cost class, tier/limit policy, and kill-switch or downgrade path.",
      "Add a metadata-only default and explicit user-consent flow for content.",
      "Rewrite the user-facing path in task/value language and keep provider/model details out of default UI.",
      "Add privacy-safe telemetry and support-report fields before release.",
    ]))
  })

  it("accepts a zero-config, bounded, observable learning proposal", () => {
    const decision = evaluateAstraProposalGate({
      supportsZeroConfig: true,
      controlsCost: true,
      ordinaryLanguage: true,
      protectsPrivacyByDefault: true,
      advancesLearningLoopOrPaidValue: true,
      observableBySupportAndAnalytics: true,
      surfaceBoundary: "default",
    })

    expect(decision).toEqual({
      decision: "accept_candidate",
      findings: [],
      requiredNextSteps: [],
    })
  })

  it("defers default UI that violates hard non-goals", () => {
    const decision = evaluateAstraProposalGate({
      supportsZeroConfig: true,
      controlsCost: true,
      ordinaryLanguage: true,
      protectsPrivacyByDefault: true,
      advancesLearningLoopOrPaidValue: true,
      observableBySupportAndAnalytics: true,
      surfaceBoundary: "default",
      introducesHighCostUnlimitedUse: true,
      introducesDefaultContentUpload: true,
      introducesProviderConsoleDefault: true,
      introducesSocialCommunityDefault: true,
      claimsUniversalSupport: true,
    })

    expect(decision.decision).toBe("defer")
    expect(decision.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      "high_cost_unlimited_use",
      "default_content_upload",
      "default_provider_console",
      "default_social_community",
      "universal_support_claim",
    ]))
    expect(decision.findings.every((finding) => finding.severity === "block")).toBe(true)
  })

  it("allows risky areas only as advanced or beta candidates with explicit next steps", () => {
    const decision = evaluateAstraProposalGate({
      supportsZeroConfig: true,
      controlsCost: true,
      ordinaryLanguage: true,
      protectsPrivacyByDefault: true,
      advancesLearningLoopOrPaidValue: true,
      observableBySupportAndAnalytics: true,
      surfaceBoundary: "beta",
      claimsUniversalSupport: true,
    })

    expect(decision.decision).toBe("advanced_or_beta_only")
    expect(decision.findings).toEqual([expect.objectContaining({
      code: "universal_support_claim",
      severity: "advanced_boundary_required",
    })])
    expect(decision.requiredNextSteps).toEqual([
      "Add an explicit Advanced/Beta/Experimental boundary plus support copy, proof depth, and rollback/kill-switch notes.",
    ])
  })
})
