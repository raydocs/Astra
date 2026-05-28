import { describe, expect, it } from "vitest"

import {
  ASTRA_MULTI_DEVICE_VALUE,
  ASTRA_PLATFORM_SURFACES,
  ASTRA_ROADMAP_PHASES,
  evaluateAstraPlatformRoadmapReadiness,
  getPlatformSurface,
  getRoadmapPhase,
  type AstraPlatformRoadmapReadinessEvidence,
} from "./platform-roadmap"

const readyEvidence: AstraPlatformRoadmapReadinessEvidence = {
  chromeExtensionCoreStable: true,
  webCompanionLearningAssetsAndReviewReady: true,
  safariIosShellClearlyExperimental: true,
  noFullPlatformMarketingBeforeCoreProof: true,
  longTermSurfaceRolesDefined: true,
  syncValueBeyondSettingsSyncDefined: true,
  crossDeviceLearningContinuityPlanned: true,
  roadmapPhasesOrdered: true,
  phaseExitCriteriaDefined: true,
  m1FirstSuccessTrustEvidence: true,
  m2LearningLoopEvidence: true,
  m3LearningLibraryEvidence: true,
  m4PersonalizationEvidence: true,
  m5DigestRetentionEvidence: true,
}

describe("Astra platform roadmap contract", () => {
  it("keeps Chrome/Chromium extension and web companion as the near-term platform focus", () => {
    expect(ASTRA_PLATFORM_SURFACES.map((surface) => surface.id)).toEqual([
      "chrome_chromium_extension",
      "web_companion",
      "safari_ios_shell",
      "mobile_companion",
      "email_digest",
      "api_integrations",
    ])

    expect(getPlatformSurface("chrome_chromium_extension")?.launchStatus).toBe("core_now")
    expect(getPlatformSurface("web_companion")?.launchStatus).toBe("companion_now")
    expect(getPlatformSurface("safari_ios_shell")?.launchStatus).toBe("experimental")
    expect(getPlatformSurface("safari_ios_shell")?.publicClaimBoundary).toContain("Experimental only")
    expect(getPlatformSurface("api_integrations")?.launchStatus).toBe("deferred")
  })

  it("defines long-term platform roles without making premature public claims", () => {
    expect(getPlatformSurface("mobile_companion")?.productRole).toContain("Review")
    expect(getPlatformSurface("email_digest")?.publicClaimBoundary).toContain("current local digest does not imply")
    expect(getPlatformSurface("api_integrations")?.publicClaimBoundary).toContain("Deferred")
  })

  it("frames multi-device sync as learning continuity, not just settings sync", () => {
    expect(ASTRA_MULTI_DEVICE_VALUE.map((value) => value.id)).toEqual([
      "desktop_save_mobile_review",
      "web_organize_browser_continue",
      "weekly_summary_return_path",
    ])

    for (const value of ASTRA_MULTI_DEVICE_VALUE) {
      expect(value.notJustConfigSync).toBe(true)
      expect(value.requiredAssetContinuity.length).toBeGreaterThan(0)
    }
    expect(ASTRA_MULTI_DEVICE_VALUE[0]?.requiredAssetContinuity).toEqual(expect.arrayContaining([
      "saved snippet identity",
      "review card schedule",
      "source title/context",
    ]))
  })

  it("codifies the M1-M5 macro roadmap phases and exit evidence", () => {
    expect(ASTRA_ROADMAP_PHASES.map((phase) => phase.id)).toEqual(["M1", "M2", "M3", "M4", "M5"])
    expect(getRoadmapPhase("M1")?.label).toBe("First Success + Trust")
    expect(getRoadmapPhase("M5")?.label).toBe("Digest + Retention")

    for (const phase of ASTRA_ROADMAP_PHASES) {
      expect(phase.goal.length).toBeGreaterThan(0)
      expect(phase.includes.length).toBeGreaterThan(0)
      expect(phase.exitEvidence.length).toBeGreaterThan(0)
    }

    expect(getRoadmapPhase("M3")?.includes).toEqual(expect.arrayContaining([
      "Saved content home",
      "Reading queue",
      "source filters",
      "search saved items",
    ]))
  })

  it("passes readiness when platform focus, sync value, and roadmap evidence are present", () => {
    const decision = evaluateAstraPlatformRoadmapReadiness(readyEvidence)

    expect(decision.ready).toBe(true)
    expect(decision.blockers).toEqual([])
    expect(decision.warnings).toEqual([])
  })

  it("blocks readiness for premature platform claims or missing core phase evidence", () => {
    const decision = evaluateAstraPlatformRoadmapReadiness({
      ...readyEvidence,
      chromeExtensionCoreStable: false,
      webCompanionLearningAssetsAndReviewReady: false,
      safariIosShellClearlyExperimental: false,
      noFullPlatformMarketingBeforeCoreProof: false,
      syncValueBeyondSettingsSyncDefined: false,
      roadmapPhasesOrdered: false,
      m1FirstSuccessTrustEvidence: false,
    })

    expect(decision.ready).toBe(false)
    expect(decision.blockers.map((finding) => finding.code)).toEqual([
      "extension_core_first",
      "web_companion_assets_review",
      "safari_ios_experimental_boundary",
      "no_full_platform_claim_before_core_proof",
      "sync_value_beyond_config",
      "roadmap_phase_order",
      "m1_first_success_trust",
    ])
  })

  it("warns for long-term surface, continuity, exit criteria, and later phase gaps", () => {
    const decision = evaluateAstraPlatformRoadmapReadiness({
      ...readyEvidence,
      longTermSurfaceRolesDefined: false,
      crossDeviceLearningContinuityPlanned: false,
      phaseExitCriteriaDefined: false,
      m2LearningLoopEvidence: false,
      m3LearningLibraryEvidence: false,
      m4PersonalizationEvidence: false,
      m5DigestRetentionEvidence: false,
    })

    expect(decision.ready).toBe(true)
    expect(decision.warnings.map((finding) => finding.code)).toEqual([
      "long_term_surface_roles",
      "cross_device_continuity_plan",
      "phase_exit_criteria",
      "m2_learning_loop",
      "m3_learning_library",
      "m4_personalization",
      "m5_digest_retention",
    ])
  })
})
