import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import type { AstraReleaseStageGateEvidence } from "./release-stage-gate"
import { ASTRA_RELEASE_STAGES, evaluateAstraReleaseStageGate } from "./release-stage-gate"

const readRepoFile = (path: string) => readFileSync(path, "utf8")

const collectBenchLiveLaneScript = (
  scripts: Record<string, string>,
  lane: string,
  visited = new Set<string>(),
): string => {
  if (visited.has(lane)) {
    return ""
  }

  visited.add(lane)
  const script = scripts[`bench:live:lane:${lane}`] ?? ""
  const nestedLaneScripts = Array.from(script.matchAll(/pnpm bench:live:lane:([a-z-]+)/g))
    .map((match) => collectBenchLiveLaneScript(scripts, match[1] ?? "", visited))
    .join(" ")

  return `${script} ${nestedLaneScripts}`
}

const REQUIRED_RELEASE_PROOF_LANES = [
  "source-core",
  "extension-core",
  "learning-loop",
  "document-proof",
  "youtube-proof",
  "youtube-holdout",
] as const

const REQUIRED_RELEASE_PROOF_SCENARIOS: Record<(typeof REQUIRED_RELEASE_PROOF_LANES)[number], readonly string[]> = {
  "source-core": [
    "bench-live/page-translation-article-basic-source-bilingual",
    "bench-live/page-translation-full-page-title-shadow-source",
    "bench-live/article-extraction-proof",
    "bench-live/dynamic-content-append",
    "bench-live/frame-coordination-basic",
    "bench-live/frame-coordination-cross-origin-fallback",
  ],
  "extension-core": [
    "bench-live/site-automation-autostart",
    "bench-live/onboarding-smoke",
    "bench-live/vocabulary-srs-smoke",
  ],
  "learning-loop": [
    "bench-live/popup-deep-read-proof",
    "bench-live/vocabulary-srs-smoke",
    "bench-live/selection-save-review-loop",
    "bench-live/learning-loop-revisit-smoke",
  ],
  "document-proof": [
    "bench-live/document-intake-basic",
    "bench-live/document-intake-local-file-handoff",
    "bench-live/pdf-reader-basic",
    "bench-live/epub-reader-basic",
    "bench-live/subtitle-file-basic",
  ],
  "youtube-proof": [
    "bench-live/youtube-subtitle-player-button",
    "bench-live/youtube-subtitle-in-player-settings",
    "bench-live/youtube-subtitle-basic-bilingual",
    "bench-live/youtube-subtitle-seek-recovery",
    "bench-live/youtube-subtitle-track-switch",
    "bench-live/youtube-transcript-panel",
    "bench-live/youtube-transcript-search-jump",
    "bench-live/youtube-save-sentence-review-loop",
    "bench-live/youtube-video-note-create",
  ],
  "youtube-holdout": [
    "bench-live/holdout/youtube-subtitle-race",
    "bench-live/holdout/youtube-no-captions",
    "bench-live/holdout/youtube-asr-only",
    "bench-live/holdout/youtube-long-video",
    "bench-live/holdout/youtube-fullscreen",
    "bench-live/holdout/youtube-spa-navigation",
  ],
}

const baseEvidence: AstraReleaseStageGateEvidence = {
  corePathComplete: true,
  userActionableErrors: true,
  dataDeletionExportVisible: true,
  supportEntryReady: true,
  qualitySamplesPassed: true,
  safetySamplesPassed: true,
  featureFlagRollbackReady: true,
  paywallCopyReviewed: true,
  privacyNoticeReady: true,
  cancelRefundPathReady: true,
  knownLimitationsPublished: true,
  betaFeedbackReady: true,
  paidBillingBlockersCleared: true,
  complianceEvidence: {
    privacyPolicyChecklist: true,
    termsRefundAiChecklist: true,
    storePermissionCopy: true,
    exportBoundary: true,
    dataDeletionVisible: true,
    supportConsentExplicit: true,
    legalReviewBeforePaidLaunch: true,
  },
}

describe("Astra release-stage gate", () => {
  it("defines the four macro-plan release stages", () => {
    expect(Object.keys(ASTRA_RELEASE_STAGES)).toEqual([
      "internal_alpha",
      "private_beta",
      "public_beta",
      "paid_launch",
    ])
    expect(ASTRA_RELEASE_STAGES.public_beta.hardBoundary).toContain("Overclaimed public copy")
  })

  it("allows internal alpha with partial quality evidence but blocks missing safety or rollback", () => {
    const internal = evaluateAstraReleaseStageGate("internal_alpha", {
      ...baseEvidence,
      supportEntryReady: false,
      qualitySamplesPassed: false,
      paywallCopyReviewed: false,
      privacyNoticeReady: false,
      cancelRefundPathReady: false,
      knownLimitationsPublished: false,
      betaFeedbackReady: false,
    })

    expect(internal.ready).toBe(true)
    expect(internal.warnings.map((finding) => finding.code)).toEqual(["quality_samples"])

    const unsafe = evaluateAstraReleaseStageGate("internal_alpha", {
      ...baseEvidence,
      safetySamplesPassed: false,
      featureFlagRollbackReady: false,
    })
    expect(unsafe.ready).toBe(false)
    expect(unsafe.blockers.map((finding) => finding.code)).toEqual(["safety_samples", "feature_flag_rollback"])
  })

  it("blocks private beta without support, privacy, quality, and feedback evidence", () => {
    const decision = evaluateAstraReleaseStageGate("private_beta", {
      ...baseEvidence,
      supportEntryReady: false,
      qualitySamplesPassed: false,
      privacyNoticeReady: false,
      betaFeedbackReady: false,
    })

    expect(decision.ready).toBe(false)
    expect(decision.blockers.map((finding) => finding.code)).toEqual([
      "support_entry",
      "quality_samples",
      "privacy_notice",
      "beta_feedback",
    ])
  })

  it("blocks public beta overclaims and missing public claim boundaries", () => {
    const decision = evaluateAstraReleaseStageGate("public_beta", {
      ...baseEvidence,
      paywallCopyReviewed: false,
      knownLimitationsPublished: false,
      launchClaimProposal: {
        supportsZeroConfig: true,
        controlsCost: true,
        ordinaryLanguage: true,
        protectsPrivacyByDefault: true,
        advancesLearningLoopOrPaidValue: true,
        observableBySupportAndAnalytics: true,
        surfaceBoundary: "default",
        claimsUniversalSupport: true,
      },
    })

    expect(decision.ready).toBe(false)
    expect(decision.blockers.map((finding) => finding.code)).toEqual([
      "paywall_copy_review",
      "known_limitations",
      "claim_boundary",
    ])
    expect(decision.blockers.find((finding) => finding.code === "claim_boundary")?.message).toContain("universal")
  })

  it("keeps beta-boundary claims as warnings before paid launch but blocks them for paid launch", () => {
    const launchClaimProposal = {
      supportsZeroConfig: true,
      controlsCost: true,
      ordinaryLanguage: true,
      protectsPrivacyByDefault: true,
      advancesLearningLoopOrPaidValue: true,
      observableBySupportAndAnalytics: true,
      surfaceBoundary: "beta" as const,
      introducesHighCostUnlimitedUse: true,
    }

    const publicBeta = evaluateAstraReleaseStageGate("public_beta", {
      ...baseEvidence,
      launchClaimProposal,
    })
    expect(publicBeta.ready).toBe(true)
    expect(publicBeta.warnings.map((finding) => finding.code)).toEqual(["cancel_refund_path", "claim_boundary"])

    const paidLaunch = evaluateAstraReleaseStageGate("paid_launch", {
      ...baseEvidence,
      launchClaimProposal,
    })
    expect(paidLaunch.ready).toBe(false)
    expect(paidLaunch.blockers.map((finding) => finding.code)).toEqual(["claim_boundary"])
  })

  it("blocks paid launch until billing and legal/trust evidence are complete", () => {
    const decision = evaluateAstraReleaseStageGate("paid_launch", {
      ...baseEvidence,
      paidBillingBlockersCleared: false,
      cancelRefundPathReady: false,
      complianceEvidence: {
        privacyPolicyChecklist: true,
        termsRefundAiChecklist: false,
        storePermissionCopy: true,
        exportBoundary: true,
        dataDeletionVisible: false,
        supportConsentExplicit: true,
        legalReviewBeforePaidLaunch: false,
      },
    })

    expect(decision.ready).toBe(false)
    expect(decision.blockers.map((finding) => finding.code)).toEqual([
      "cancel_refund_path",
      "paid_billing_blockers",
      "legal_trust_compliance",
    ])
    expect(decision.blockers.find((finding) => finding.code === "legal_trust_compliance")?.message)
      .toContain("terms_refund_ai_notice")
  })

  it("requires actual feature-flag and kill-switch inventory for rollback readiness", () => {
    const decision = evaluateAstraReleaseStageGate("public_beta", {
      ...baseEvidence,
      featureFlagRollbackReady: true,
      featureFlagCount: 0,
      killSwitchCount: 0,
    })

    expect(decision.ready).toBe(false)
    expect(decision.blockers.map((finding) => finding.code)).toContain("feature_flag_rollback")
  })

  it("keeps CI quality and live-browser gates upload downloadable evidence artifacts", () => {
    const workflow = readRepoFile(".github/workflows/ci.yml")

    expect(workflow).toContain("Publish quality gate summary")
    expect(workflow).toContain("pnpm check:macro-final-completion")
    expect(workflow).toContain("Upload quality gate results")
    expect(workflow).toContain("name: quality-gate-results")
    expect(workflow).toContain("path: data/bench-results/")
    expect(workflow).toContain("Publish live gate summary")
    expect(workflow).toContain("Upload live bench results")
    expect(workflow).toContain("name: live-bench-results")
    expect(workflow).toContain("path: data/bench-live-results/")
  })

  it("keeps required release-proof lanes aligned across package scripts, CI, and release docs", () => {
    const packageJson = JSON.parse(readRepoFile("package.json")) as { scripts: Record<string, string> }
    const releaseProofScript = packageJson.scripts["bench:live:lane:release-proof"]
    const workflow = readRepoFile(".github/workflows/ci.yml")
    const readinessChecklist = readRepoFile("docs/release-readiness-checklist.md")
    const laneConventions = readRepoFile("docs/investigations/workstream-f-live-lane-conventions.md")
    const coverageMatrix = readRepoFile("docs/investigations/workstream-a-live-coverage-matrix.md")

    for (const lane of REQUIRED_RELEASE_PROOF_LANES) {
      expect(packageJson.scripts[`bench:live:lane:${lane}`]).toBeTruthy()
      expect(releaseProofScript).toContain(`pnpm bench:live:lane:${lane}`)
      expect(workflow).toContain(`Run required live lane (${lane})`)
      expect(workflow).toContain(`pnpm bench:live:lane:${lane}`)
      expect(readinessChecklist).toContain(`| \`${lane}\` |`)
      expect(laneConventions).toContain(`| \`${lane}\` |`)
      expect(coverageMatrix).toContain(`### \`${lane}\``)

      const expandedLaneScript = collectBenchLiveLaneScript(packageJson.scripts, lane)

      for (const scenario of REQUIRED_RELEASE_PROOF_SCENARIOS[lane]) {
        expect(expandedLaneScript).toContain(scenario)
        expect(workflow).toContain(scenario)
        expect(laneConventions).toContain(scenario)
        expect(coverageMatrix).toContain(scenario)
      }
    }
  })

  it("keeps Gate 4 public-beta wording scoped to proved reader and YouTube surfaces", () => {
    const gate4Review = readRepoFile("docs/reviews/macro-gate-4-claim-review-2026-05-28.md")

    expect(gate4Review).toContain(
      "controlled PDF, EPUB, and SRT/VTT subtitle-file workflows, and proof-backed YouTube subtitle workflows",
    )
    expect(gate4Review).toContain(
      "DOCX/OCR/ASS/Markdown/TXT/HTML/comic/image, paid launch, store submission, production metric, and accessibility compliance claims require additional evidence",
    )
    expect(gate4Review).toContain("Universal file/video/platform support claim")
    expect(gate4Review).toContain("Proof-backed wording must name controlled PDF/EPUB/SRT/VTT reader flows")
    expect(gate4Review).toContain("Bilibili is beta/best-effort; other adapters/formats stay scoped")
  })
})
