import { existsSync, readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import type { AstraMacroPlanCompletionEvidence } from "./macro-operational-evidence"
import {
  ASTRA_MACRO_CI_ARTIFACT_REQUIREMENTS,
  ASTRA_MACRO_LAUNCH_ARTIFACT_GROUPS,
  ASTRA_MACRO_LAUNCH_ARTIFACT_REQUIREMENTS,
  ASTRA_MACRO_MANUAL_QA_REQUIREMENTS,
  ASTRA_MACRO_OPERATIONAL_EVIDENCE,
  ASTRA_MACRO_RELEASE_APPROVAL_REQUIREMENT,
  evaluateAstraMacroCiArtifactPacket,
  evaluateAstraMacroLaunchArtifactPacket,
  evaluateAstraMacroManualQaEvidencePacket,
  evaluateAstraMacroOperationalEvidence,
  evaluateAstraMacroOperationalEvidenceCompletionPacket,
  evaluateAstraMacroPlanCompletion,
  evaluateAstraMacroReleaseApprovalPacket,
  macroOperationalEvidenceForSection,
  renderAstraMacroOperationalEvidenceRcNote,
  renderAstraMacroPlanCompletionGateNote,
} from "./macro-operational-evidence"

const EXPECTED_MACRO_PLAN_SECTIONS = Array.from({ length: 35 }, (_, section) => section)

const MACRO_RC_NOTE_VALIDATION_EVIDENCE = [
  "LIBRARY_ASSET_COVERAGE_FOCUSED_EXIT:0",
  "LIBRARY_ASSET_COVERAGE_COMBINED_EXIT:0",
  "LIBRARY_QA_NOTE_FOCUSED_EXIT:0",
  "PERSONALIZATION_REVIEW_FOCUSED_EXIT:0",
  "PERSONALIZATION_REVIEW_COMBINED_EXIT:0",
  "PERSONALIZATION_QA_NOTE_FOCUSED_EXIT:0",
  "LEARNING_DIGEST_FOCUSED_EXIT:0",
  "SUPPORT_HELP_DOCS_FOCUSED_EXIT:0",
  "DATA_RETENTION_EVIDENCE_FOCUSED_EXIT:0",
  "PRODUCT_METRICS_EVIDENCE_FOCUSED_EXIT:0",
  "MOBILE_RETENTION_OPS_SUMMARY_FOCUSED_EXIT:0",
  "PRODUCTION_METRICS_EXPORT_PACKET_GUARD_FOCUSED_EXIT:0",
  "CI_ARTIFACT_PACKET_GUARD_FOCUSED_EXIT:0",
  "OWNER_RELEASE_APPROVAL_PACKET_GUARD_FOCUSED_EXIT:0",
  "MANUAL_QA_PACKET_GUARD_FOCUSED_EXIT:0",
  "OPS_ROLE_BOUNDARY_FOCUSED_EXIT:0",
  "BRAND_DEFAULT_SURFACE_FOCUSED_EXIT:0",
  "FIRST_SUCCESS_SMOKE_GUARD_FOCUSED_EXIT:0",
  "AI_QUALITY_HUMAN_REPORT_GUARD_FOCUSED_EXIT:0",
  "ACCESSIBILITY_MANUAL_PACKET_GUARD_FOCUSED_EXIT:0",
  "LAUNCH_ARTIFACT_PACKET_GUARD_FOCUSED_EXIT:0",
  "MACRO_COMPLETION_AUDIT_BOUNDARY_EXIT:0",
  "MANUAL_QA_CHECKLIST_SCHEMA_EXIT:0",
  "MACRO_PLAN_AUDIT_SECTION_INVENTORY_EXIT:0",
  "MACRO_RC_NO_FINAL_SIGNOFF_EXIT:0",
  "MACRO_PLAN_FINAL_COMPLETION_GATE_EXIT:0",
  "MACRO_FINAL_COMPLETION_EVIDENCE_ARTIFACT_EXIT:0",
  "MACRO_FINAL_COMPLETION_CLI_EXIT:0",
  "Previous macro-plan focused and combined validations remain recorded in the implementation audit; rerun full Gate 1/Gate 2 for any release candidate.",
]

function renderCurrentMacroRcNote(): string {
  return renderAstraMacroOperationalEvidenceRcNote(ASTRA_MACRO_OPERATIONAL_EVIDENCE, {
    generatedAt: "2026-05-28T00:00:00.000Z",
    rcLabel: "Macro plan RC evidence note — 2026-05-28",
    validationEvidence: MACRO_RC_NOTE_VALIDATION_EVIDENCE,
  })
}

interface MacroFinalCompletionEvidenceArtifact {
  schema: "astra-macro-final-completion-evidence.v1"
  generatedAt: string
  label: string
  evidence: AstraMacroPlanCompletionEvidence
  evidenceLinks: Record<keyof AstraMacroPlanCompletionEvidence, string[]>
}

const FINAL_COMPLETION_EVIDENCE_KEYS: Array<keyof AstraMacroPlanCompletionEvidence> = [
  "ciQualityArtifactsAttached",
  "ciLiveBrowserArtifactsAttached",
  "ownerReleaseApprovalRecorded",
  "manualQaChecklistComplete",
  "humanScoredAiQualityReportAttached",
  "billingLegalStoreGtmArtifactsAttached",
  "productionMetricsExportAttached",
]

const FINAL_EVIDENCE_INTAKE_REQUIRED_TERMS = [
  "evaluateAstraMacroOperationalEvidenceCompletionPacket()",
  "macro-operational-evidence-completion-packet-note-2026-05-28.md",
  "macro-operational-evidence-completion-packet-2026-05-28.json",
  "ASTRA_MACRO_OPERATIONAL_EVIDENCE",
  "operational evidence area",
  "requirement-evidence notes",
  "evidenceLinks",
  "matching machine-readable packet path",
  "each be a URL or repo artifact path",
  "not a local-only, private-network, loopback, malformed, or path-traversal reference",
  "placeholder evidence",
  "duplicate evidence link",
  "false fields must keep evidenceLinks empty",
  "URL or repo artifact-path evidence link",
  "present exactly once",
  "checklist structure",
  "pre-claim packet structure",
  "ISO `generatedAt` timestamps",
  "untracked row",
  "duplicate row",
  "placeholder/sample",
  "quality-gate-results",
  "live-bench-results",
  "macro-ci-artifact-packet-2026-05-28.json",
  "evaluateAstraMacroCiArtifactPacket()",
  "CI run URL",
  "run/job/artifact identity",
  "artifact digest",
  "artifact manifest",
  "downloadable artifact URL",
  "target commit/SHA",
  "same target commit/SHA",
  "pnpm check:repo-knowledge",
  "pnpm check:zod-entrypoints",
  "pnpm check:macro-final-completion",
  "pnpm type-check",
  "pnpm lint:ci",
  "pnpm test",
  "pnpm bench",
  "source-core",
  "extension-core",
  "learning-loop",
  "document-proof",
  "youtube-proof",
  "youtube-holdout",
  "macro-gate-4-claim-review-2026-05-28.md",
  "macro-rc-evidence-packet-2026-05-28.md",
  "macro-final-completion-gate-2026-05-28.md",
  "macro-owner-release-approval-packet-2026-05-28.json",
  "evaluateAstraMacroReleaseApprovalPacket()",
  "approver/date",
  "YYYY-MM-DD",
  "approval record link",
  "URL or repo artifact path",
  "target commit/SHA",
  "remaining final blockers",
  "downgrade copy",
  "macro-manual-qa-evidence-checklist-2026-05-28.md",
  "evaluateAstraMacroManualQaEvidencePacket()",
  "pass-with-downgrade",
  "owner/date",
  "YYYY-MM-DD",
  "environment",
  "URL or repo artifact-path evidence link",
  "not-run",
  "Section 6",
  "Section 7",
  "Section 13",
  "Section 14",
  "Section 24",
  "Section 32",
  "docs/quality/rubrics.md",
  "macro-ai-quality-human-scored-packet-2026-05-28.json",
  "evaluateAiQualityHumanScoredReportEvidence()",
  "reviewer/date",
  "YYYY-MM-DD",
  "target environment",
  "run metadata",
  "fixture manifest version",
  "URL or repo artifact-path fixture manifest/live provider sample/blocker triage evidence",
  "live provider sample evidence",
  "finite integer sample counts matching the summarized P0 sample count",
  "scored P0 count",
  "blocker triage",
  "trend",
  "release decision",
  "release-threshold readiness",
  "billing checkout",
  "billing webhook",
  "billing entitlement",
  "billing cancellation/refund",
  "legal privacy/terms approval",
  "AI notice",
  "support/contact commitment",
  "store zip hash",
  "store upload/submission",
  "reviewer notes",
  "store screenshots",
  "GTM demo capture",
  "GTM storyboard/screenshots",
  "GTM copy claim review",
  "artifact type",
  "artifact id",
  "artifact digest or version",
  "target channel",
  "claim boundary",
  "owner/date",
  "environment/channel",
  "evidence link",
  "evaluateAstraMacroLaunchArtifactPacket()",
  "macro-launch-artifact-packet-2026-05-28.json",
  "production/cohort dashboard exports",
  "macro-production-metrics-export-packet-2026-05-28.json",
  "Activation",
  "Understanding",
  "Learning",
  "Membership",
  "date range",
  "YYYY-MM-DD..YYYY-MM-DD",
  "cohort definition",
  "dashboard/query source",
  "export id",
  "ISO exported-at timestamp",
  "digest/checksum",
  "query version",
  "category-aligned non-duplicated metric ids",
  "URL or repo artifact-path evidence link",
  "owner/date containing a real calendar `YYYY-MM-DD`",
  "URL or repo artifact-path privacy-review link",
  "privacy-review",
  "evaluateAstraProductionMetricsExportPacket()",
]

function readFinalCompletionEvidenceArtifact(): MacroFinalCompletionEvidenceArtifact {
  return JSON.parse(readFileSync("docs/reviews/macro-final-completion-evidence-2026-05-28.json", "utf8")) as MacroFinalCompletionEvidenceArtifact
}

function renderCurrentMacroCompletionGateNote(): string {
  const artifact = readFinalCompletionEvidenceArtifact()
  return renderAstraMacroPlanCompletionGateNote(artifact.evidence, ASTRA_MACRO_OPERATIONAL_EVIDENCE, {
    generatedAt: artifact.generatedAt,
    label: artifact.label,
  })
}

const REQUIRED_MANUAL_CHECKLIST_SECTIONS = [6, 7, 13, 14, 24, 32]

const emptyFinalCompletionEvidence = {
  ciQualityArtifactsAttached: false,
  ciLiveBrowserArtifactsAttached: false,
  ownerReleaseApprovalRecorded: false,
  manualQaChecklistComplete: false,
  humanScoredAiQualityReportAttached: false,
  billingLegalStoreGtmArtifactsAttached: false,
  productionMetricsExportAttached: false,
}

const completeFinalCompletionEvidence = {
  ciQualityArtifactsAttached: true,
  ciLiveBrowserArtifactsAttached: true,
  ownerReleaseApprovalRecorded: true,
  manualQaChecklistComplete: true,
  humanScoredAiQualityReportAttached: true,
  billingLegalStoreGtmArtifactsAttached: true,
  productionMetricsExportAttached: true,
}

const completeCiArtifactPacket = ASTRA_MACRO_CI_ARTIFACT_REQUIREMENTS.map((requirement) => ({
  evidenceField: requirement.evidenceField,
  artifactName: requirement.artifactName,
  workflowName: requirement.workflowName,
  runId: `run-${requirement.evidenceField}`,
  jobName: `${requirement.workflowName} / release gate`,
  artifactId: `artifact-${requirement.artifactName}`,
  artifactDigest: `sha256:${requirement.evidenceField.repeat(2)}`,
  artifactManifestPath: `data/release-artifacts/${requirement.artifactName}/manifest.json`,
  runUrl: `https://github.com/astra-release/actions/runs/${requirement.evidenceField}`,
  artifactUrl: `https://github.com/astra-release/actions/artifacts/${requirement.artifactName}`,
  commitSha: "abc123def456",
  ownerDate: "Release owner — 2026-05-28",
  coverage: requirement.requiredCoverage,
}))

const completeReleaseApprovalPacket = {
  approver: "Release owner",
  approvalDate: "2026-05-28",
  approvalRecordLink: "https://release-evidence.astra.internal/owner-approval/2026-05-28",
  targetCommitSha: "abc123def456",
  decision: "approved_with_downgrades" as const,
  reviewedArtifacts: ASTRA_MACRO_RELEASE_APPROVAL_REQUIREMENT.requiredReviewedArtifacts,
  acknowledgesRemainingFinalBlockers: true,
  acknowledgesDowngradeCopy: true,
}

const completeLaunchArtifactRows = ASTRA_MACRO_LAUNCH_ARTIFACT_REQUIREMENTS.map((requirement) => ({
  requirementId: requirement.id,
  artifactType: `${requirement.group} release artifact`,
  artifactId: `launch-${requirement.id}-2026-05-28`,
  artifactDigestOrVersion: `sha256:${requirement.id.repeat(3)}`,
  targetChannel: `${requirement.group} target release channel`,
  claimBoundary: requirement.group,
  evidenceLink: `https://release-evidence.astra.internal/launch-artifacts/${requirement.id}.md`,
  ownerDate: "Release owner — 2026-05-28",
  environment: `${requirement.group} target release channel`,
}))

const EXPECTED_MANUAL_QA_ROWS: Record<number, string[]> = Object.fromEntries(
  ASTRA_MACRO_MANUAL_QA_REQUIREMENTS.map((requirement) => [requirement.section, requirement.qaRows]),
)

const completeManualQaRows = ASTRA_MACRO_MANUAL_QA_REQUIREMENTS.flatMap((requirement) =>
  requirement.qaRows.map((qaRow) => ({
    section: requirement.section,
    qaRow,
    ownerDate: "QA owner — 2026-05-28",
    environment: "Chrome extension target build on macOS",
    evidenceLink: `https://release-evidence.astra.internal/manual-qa/section-${requirement.section}-${qaRow.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`,
    verdict: "pass-with-downgrade",
  })),
)

const ALLOWED_MANUAL_QA_VERDICTS = new Set(["pass", "pass-with-downgrade", "fail", "not-run"])

interface MacroManualQaChecklistRow {
  section: number
  qaRow: string
  currentStatus: string
  ownerDate: string
  environment: string
  evidenceLink: string
  verdict: string
}

interface MacroCompletionAuditRow {
  section: number
  status: string
  evidence: string
  remainingProofBoundary: string
}

function macroPlanTopLevelSections(): number[] {
  const plan = readFileSync("docs/plans/astra-macro-product-upgrade-plan-2026-05-27.md", "utf8")
  return Array.from(plan.matchAll(/^## (\d+)\./gm)).map((match) => Number(match[1]))
}

function macroCompletionAuditRows(): MacroCompletionAuditRow[] {
  const audit = readFileSync("docs/reviews/macro-plan-completion-audit-2026-05-27.md", "utf8")
  return Array.from(audit.matchAll(/^\| (\d+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm))
    .map((match) => ({
      section: Number(match[1]),
      status: match[2]?.trim() ?? "",
      evidence: match[3]?.trim() ?? "",
      remainingProofBoundary: match[4]?.trim() ?? "",
    }))
}

function macroCompletionAuditBoundarySections(): number[] {
  return macroCompletionAuditRows()
    .filter((row) => /Beta-boundary|External-blocked/.test(row.status))
    .map((row) => row.section)
}

function uniqueSortedSections(sections: number[]): number[] {
  return Array.from(new Set(sections)).sort((a, b) => a - b)
}

function macroManualQaChecklistRows(): MacroManualQaChecklistRow[] {
  const checklist = readFileSync("docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md", "utf8")

  return checklist
    .split("\n## Section ")
    .slice(1)
    .flatMap((block) => {
      const section = Number(block.match(/^(\d+)/)?.[1])
      return block
        .split("\n")
        .filter((line) => line.startsWith("| ") && !line.startsWith("| QA row ") && !line.startsWith("|---"))
        .map((line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()))
        .map((cells) => {
          expect(cells.length).toBe(7)
          const [qaRow, , currentStatus, ownerDate, environment, evidenceLink, verdict] = cells
          return {
            section,
            qaRow: qaRow ?? "",
            currentStatus: currentStatus ?? "",
            ownerDate: ownerDate ?? "",
            environment: environment ?? "",
            evidenceLink: evidenceLink ?? "",
            verdict: verdict ?? "",
          }
        })
    })
}

function isRepoPathEvidence(entry: string): boolean {
  return /^(src|docs|test|store)\//.test(entry)
}

describe("Astra macro operational evidence", () => {
  it("keeps the completion audit aligned with every top-level source-plan section", () => {
    const sourcePlanSections = uniqueSortedSections(macroPlanTopLevelSections())
    const auditRows = macroCompletionAuditRows()

    expect(sourcePlanSections).toEqual(EXPECTED_MACRO_PLAN_SECTIONS)
    expect(auditRows.map((row) => row.section)).toEqual(EXPECTED_MACRO_PLAN_SECTIONS)

    for (const row of auditRows) {
      expect(row.status).toMatch(/Repo-covered|Beta-boundary|External-blocked/)
      expect(row.evidence.length).toBeGreaterThan(0)
      expect(row.remainingProofBoundary.length).toBeGreaterThan(0)
    }
  })

  it("tracks the remaining operational-evidence areas from the macro plan audit", () => {
    expect(ASTRA_MACRO_OPERATIONAL_EVIDENCE.map((item) => item.id)).toEqual([
      "first_success_activation_evidence",
      "learning_library_surface_coverage",
      "personalization_behavior_evidence",
      "membership_value_surface_evidence",
      "product_metrics",
      "learning_digest",
      "ai_quality_human_scored_report",
      "brand_audit",
      "support_help_center",
      "pricing_beta_boundary",
      "learning_science_review_compat",
      "data_retention_controls",
      "gtm_release_packet",
      "store_submission_packet",
      "ops_role_boundary",
      "accessibility_manual_evidence",
    ])

    const firstSuccess = macroOperationalEvidenceForSection(4)[0]
    expect(firstSuccess?.currentEvidence).toContain("src/utils/first-success.test.ts")
    expect(firstSuccess?.currentEvidence).toContain("src/utils/learning-loop-events.ts")
    expect(firstSuccess?.currentEvidence).toContain("docs/reviews/first-success-activation-evidence-note-2026-05-28.md")
    expect(firstSuccess?.requiredBeforeStrongerClaim.join(" ")).toContain("target-build activation smoke report")
    expect(firstSuccess?.downgradeCopy).toContain("smoke-report evaluator/evidence note")

    const library = macroOperationalEvidenceForSection(6)[0]
    expect(library?.currentEvidence).toContain("docs/reviews/library-qa-evidence-note-2026-05-28.md")
    expect(library?.currentEvidence).toContain("docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md")
    expect(library?.requiredBeforeStrongerClaim.join(" ")).toContain("Section 6 rows")
    expect(library?.downgradeCopy).toContain("repo-side Library QA note")
    const membership = macroOperationalEvidenceForSection(8).find((item) => item.id === "membership_value_surface_evidence")
    expect(membership?.currentEvidence).toContain("src/utils/membership-value.test.ts")
    expect(membership?.currentEvidence).toContain("apps/mobile/src/domain/mobileMembership.test.ts")
    expect(membership?.currentEvidence).toContain("docs/reviews/membership-value-evidence-note-2026-05-28.md")
    expect(membership?.requiredBeforeStrongerClaim.join(" ")).toContain("production billing checkout/portal/webhook/cancellation/refund evidence")
    expect(membership?.downgradeCopy).toContain("mobile safe status display")
    const personalization = macroOperationalEvidenceForSection(7)[0]
    expect(personalization?.currentEvidence).toContain("docs/reviews/personalization-qa-evidence-note-2026-05-28.md")
    expect(personalization?.currentEvidence).toContain("docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md")
    expect(personalization?.requiredBeforeStrongerClaim.join(" ")).toContain("Section 7 rows")
    expect(personalization?.downgradeCopy).toContain("repo-side personalization QA note")
    const productMetrics = macroOperationalEvidenceForSection(11)[0]
    expect(productMetrics?.id).toBe("product_metrics")
    expect(productMetrics?.currentEvidence).toContain("src/utils/product-metrics.test.ts")
    expect(productMetrics?.currentEvidence).toContain("docs/reviews/product-metrics-evidence-note-2026-05-28.md")
    expect(productMetrics?.currentEvidence).toContain("docs/reviews/production-metrics-export-evidence-note-2026-05-28.md")
    expect(productMetrics?.requiredBeforeStrongerClaim.join(" ")).toContain("evaluateAstraProductionMetricsExportPacket()")
    expect(productMetrics?.requiredBeforeStrongerClaim.join(" ")).toContain("dashboard/query source")
    expect(productMetrics?.requiredBeforeStrongerClaim.join(" ")).toContain("export id")
    expect(productMetrics?.requiredBeforeStrongerClaim.join(" ")).toContain("digest/checksum")
    expect(productMetrics?.requiredBeforeStrongerClaim.join(" ")).toContain("category-aligned metric ids")
    expect(productMetrics?.downgradeCopy).toContain("production metrics export packet intake guard")
    const learningDigest = macroOperationalEvidenceForSection(12)[0]
    expect(learningDigest?.id).toBe("learning_digest")
    expect(learningDigest?.currentEvidence).toContain("docs/reviews/learning-digest-qa-evidence-note-2026-05-28.md")
    expect(learningDigest?.currentEvidence).toContain("docs/analysis/minimal-weekly-digest-delivery-ops-checklist-2026-05-28.md")
    expect(learningDigest?.currentEvidence).toContain("src/server/ops-audit-log-store.ts")
    expect(learningDigest?.requiredBeforeStrongerClaim.join(" ")).toContain("target-build Learning Digest QA evidence")
    expect(learningDigest?.requiredBeforeStrongerClaim.join(" ")).toContain("production Resend/Expo/APNs/FCM delivery-monitoring evidence")
    expect(learningDigest?.downgradeCopy).toContain("repo-side QA evidence note")
    expect(learningDigest?.downgradeCopy).toContain("aggregate-only delivery summary")
    const support = macroOperationalEvidenceForSection(14)[0]
    expect(support?.id).toBe("support_help_center")
    expect(support?.currentEvidence).toContain("docs/reviews/support-help-center-evidence-note-2026-05-28.md")
    expect(support?.currentEvidence).toContain("src/utils/support-response-macros.test.ts")
    expect(support?.requiredBeforeStrongerClaim.join(" ")).toContain("production metadata-only support-report operations")
    expect(support?.downgradeCopy).toContain("repo-side support/help evidence note")

    const quality = macroOperationalEvidenceForSection(24)[0]
    expect(quality?.id).toBe("ai_quality_human_scored_report")
    expect(quality?.currentEvidence).toContain("src/utils/ai-safety.test.ts")
    expect(quality?.currentEvidence).toContain("test/fixtures/quality/prompt-injection.json")
    expect(quality?.currentEvidence).toContain("docs/reviews/ai-quality-human-scored-evidence-note-2026-05-28.md")
    expect(quality?.currentEvidence).toContain("docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md")
    expect(quality?.requiredBeforeStrongerClaim.join(" ")).toContain("Section 24 rows")
    expect(quality?.requiredBeforeStrongerClaim.join(" ")).toContain("live provider sample evidence")
    expect(quality?.downgradeCopy).toContain("human-scored report intake guard")
    const opsRoleBoundary = macroOperationalEvidenceForSection(30)[0]
    expect(opsRoleBoundary?.id).toBe("ops_role_boundary")
    expect(opsRoleBoundary?.currentEvidence).toContain("src/utils/operating-review.test.ts")
    expect(opsRoleBoundary?.currentEvidence).toContain("src/web/src/lib/astra-web.test.ts")
    expect(opsRoleBoundary?.currentEvidence).toContain("src/web/src/app.test.tsx")
    expect(opsRoleBoundary?.requiredBeforeStrongerClaim.join(" ")).toContain("ops cockpit/provider-health visibility by role")
    expect(opsRoleBoundary?.downgradeCopy).toContain("aggregate ops cockpit/operating-review surfaces")

    const accessibility = macroOperationalEvidenceForSection(32)[0]
    expect(accessibility?.id).toBe("accessibility_manual_evidence")
    expect(accessibility?.currentEvidence).toContain("src/utils/accessibility-readiness.test.ts")
    expect(accessibility?.currentEvidence).toContain("docs/reviews/accessibility-browser-evidence-note-2026-05-28.md")
    expect(accessibility?.currentEvidence).toContain("docs/reviews/accessibility-manual-evidence-note-2026-05-28.md")
    expect(accessibility?.requiredBeforeStrongerClaim.join(" ")).toContain("screen-reader spot check")
    expect(accessibility?.downgradeCopy).toContain("manual evidence packet intake guard")

    const brand = macroOperationalEvidenceForSection(13)[0]
    expect(brand?.id).toBe("brand_audit")
    expect(brand?.currentEvidence).toContain("src/utils/brand-experience.test.ts")
    expect(brand?.currentEvidence).toContain("docs/reviews/brand-default-surface-evidence-note-2026-05-28.md")
    expect(brand?.requiredBeforeStrongerClaim.join(" ")).toContain("Section 13 rows")
    expect(brand?.downgradeCopy).toContain("repo-side Section 13 evidence note")

    expect(macroOperationalEvidenceForSection(4).map((item) => item.id)).toEqual(["first_success_activation_evidence"])
    expect(macroOperationalEvidenceForSection(8).map((item) => item.id)).toEqual(["membership_value_surface_evidence", "pricing_beta_boundary"])
    expect(macroOperationalEvidenceForSection(11).map((item) => item.id)).toEqual(["product_metrics"])
    expect(macroOperationalEvidenceForSection(24).map((item) => item.id)).toEqual(["ai_quality_human_scored_report"])
    expect(macroOperationalEvidenceForSection(26).map((item) => item.id)).toEqual(["data_retention_controls"])
    const storeSubmission = macroOperationalEvidenceForSection(28)[0]
    expect(storeSubmission?.id).toBe("store_submission_packet")
    expect(storeSubmission?.currentEvidence).toEqual(expect.arrayContaining([
      "store/listing-copy.md",
      "apps/mobile/store/ios/app-store-connect.md",
      "apps/mobile/store/android/play-listing.md",
      "apps/mobile/store/privacy.md",
      "apps/mobile/store/signed-build-qa.md",
      "apps/mobile/store/release-checklist.md",
      "docs/reviews/store-submission-evidence-note-2026-05-28.md",
    ]))
    expect(storeSubmission?.requiredBeforeStrongerClaim.join(" ")).toContain("target browser/mobile store channel upload, submission, or processing status")
    expect(storeSubmission?.requiredBeforeStrongerClaim.join(" ")).toContain("signed-build functional/accessibility QA rows")
    expect(storeSubmission?.downgradeCopy).toContain("repo-side store-submission evidence note")
  })

  it("keeps the completion audit's beta/external sections tracked by the operational-evidence model", () => {
    const auditBoundarySections = uniqueSortedSections(macroCompletionAuditBoundarySections())
    const operationalEvidenceSections = uniqueSortedSections(
      ASTRA_MACRO_OPERATIONAL_EVIDENCE.flatMap((item) => item.planSections),
    )

    expect(auditBoundarySections).toEqual([
      4,
      6,
      7,
      8,
      9,
      11,
      12,
      13,
      14,
      21,
      24,
      26,
      27,
      28,
      30,
      32,
      34,
    ])
    expect(operationalEvidenceSections).toEqual(uniqueSortedSections([...auditBoundarySections, 22]))

    for (const section of auditBoundarySections) {
      const trackedItems = macroOperationalEvidenceForSection(section)
      expect(trackedItems.length).toBeGreaterThan(0)
      expect(trackedItems.every((item) => item.requiredBeforeStrongerClaim.length > 0)).toBe(true)
      expect(trackedItems.every((item) => item.downgradeCopy.length > 20)).toBe(true)
    }
  })

  it("keeps RC evidence packet and Gate 4 review explicit that repo evidence is not final launch signoff", () => {
    const rcPacket = readFileSync("docs/reviews/macro-rc-evidence-packet-2026-05-28.md", "utf8")
    const gate4Review = readFileSync("docs/reviews/macro-gate-4-claim-review-2026-05-28.md", "utf8")

    expect(rcPacket).toContain("It is **not** a paid-launch, store-submission, legal, production-dashboard, or external-QA signoff")
    expect(rcPacket).toContain("Gate commands not completed in this packet")
    expect(rcPacket).toContain("CI `quality` and `live-browser` jobs with uploaded `quality-gate-results` and `live-bench-results` artifacts")
    expect(rcPacket).toContain("data/bench-results/quality-gate-manifest.json")
    expect(rcPacket).toContain("data/bench-live-results/live-bench-manifest.json")
    expect(rcPacket).toContain("owner release approval")
    expect(rcPacket).toContain("Do not use this packet as a substitute for CI-backed Gate 1–3")
    expect(rcPacket).toContain("Produce a dated human-scored AI quality report")
    expect(rcPacket).toContain("evaluateAiQualityHumanScoredReportEvidence()")
    expect(rcPacket).toContain("release-threshold readiness")
    expect(rcPacket).toContain("Attach billing checkout, billing webhook, billing entitlement/quota")
    expect(rcPacket).toContain("GTM copy claim review evidence")
    expect(rcPacket).toContain("evaluateAstraMacroLaunchArtifactPacket()")

    expect(gate4Review).toContain("It is **not** a final RC approval, CI artifact upload, legal review, store submission approval, paid-launch signoff, or human accessibility signoff")
    expect(gate4Review).toContain("Gate 4 claim alignment is acceptable **only as pass-with-downgrades**")
    expect(gate4Review).toContain("cannot be represented as fully launched, paid-ready, store-submitted, production-metric-proved, or accessibility-compliance-complete")
    expect(gate4Review).toContain("Attach CI `quality` and `live-browser` uploaded artifacts")
    expect(gate4Review).toContain("Record owner release approval")
    expect(gate4Review).toContain("Produce a dated human-scored AI quality report")
    expect(gate4Review).toContain("Fill the Section 6/7/13/14 rows")
    expect(gate4Review).toContain("Attach billing/legal/store/GTM external artifacts")
  })

  it("keeps the final evidence intake rules explicit for every final-completion field", () => {
    const intake = readFileSync("docs/reviews/macro-final-evidence-intake-2026-05-28.md", "utf8")
    const rcPacket = readFileSync("docs/reviews/macro-rc-evidence-packet-2026-05-28.md", "utf8")

    for (const key of FINAL_COMPLETION_EVIDENCE_KEYS) {
      expect(intake).toContain(`\`${key}\``)
    }
    for (const term of FINAL_EVIDENCE_INTAKE_REQUIRED_TERMS) {
      expect(intake).toContain(term)
    }
    expect(rcPacket).toContain("docs/reviews/macro-final-evidence-intake-2026-05-28.md")
    expect(rcPacket).toContain("evaluateAstraMacroOperationalEvidenceCompletionPacket()")
    expect(rcPacket).toContain("docs/reviews/macro-operational-evidence-completion-packet-note-2026-05-28.md")
    expect(rcPacket).toContain("docs/reviews/macro-operational-evidence-completion-packet-2026-05-28.json")
    expect(rcPacket).toContain("requirement-evidence notes")
    expect(rcPacket).toContain("evaluateAstraMacroCiArtifactPacket()")
    expect(rcPacket).toContain("docs/reviews/macro-ci-artifact-packet-2026-05-28.json")
    expect(rcPacket).toContain("docs/reviews/ci-artifact-evidence-note-2026-05-28.md")
    expect(rcPacket).toContain("evaluateAstraMacroReleaseApprovalPacket()")
    expect(rcPacket).toContain("docs/reviews/macro-owner-release-approval-packet-2026-05-28.json")
    expect(rcPacket).toContain("docs/reviews/owner-release-approval-evidence-note-2026-05-28.md")
    expect(rcPacket).toContain("docs/reviews/macro-launch-artifact-packet-2026-05-28.json")
    expect(rcPacket).toContain("docs/reviews/launch-artifact-packet-evidence-note-2026-05-28.md")
    expect(rcPacket).toContain("docs/reviews/store-submission-evidence-note-2026-05-28.md")
    expect(intake).toContain("owner/date containing a real calendar `YYYY-MM-DD`")
    expect(intake).toContain("URL or repo artifact-path evidence link")
    expect(intake).toContain("non-placeholder requirement-evidence notes")
    expect(intake).toContain("repo-side pricing/GTM/store-submission evidence notes")
    expect(rcPacket).toContain("evaluateAstraMacroManualQaEvidencePacket()")
    expect(rcPacket).toContain("docs/reviews/manual-qa-packet-evidence-note-2026-05-28.md")
    expect(rcPacket).toContain("docs/reviews/macro-ai-quality-human-scored-packet-2026-05-28.json")
    expect(rcPacket).toContain("evaluateAiQualityHumanScoredReportEvidence()")
    expect(rcPacket).toContain("evaluateAstraProductionMetricsExportPacket()")
    expect(rcPacket).toContain("docs/reviews/macro-production-metrics-export-packet-2026-05-28.json")
    expect(rcPacket).toContain("docs/reviews/production-metrics-export-evidence-note-2026-05-28.md")
  })

  it("keeps the structured final evidence packet placeholders machine-readable and intentionally empty", () => {
    const ciPacket = JSON.parse(readFileSync("docs/reviews/macro-ci-artifact-packet-2026-05-28.json", "utf8")) as { schema: string; rows: unknown[] }
    const approvalPacket = JSON.parse(readFileSync("docs/reviews/macro-owner-release-approval-packet-2026-05-28.json", "utf8")) as {
      schema: string
      approval: { decision: string; reviewedArtifacts: unknown[] }
    }
    const launchPacket = JSON.parse(readFileSync("docs/reviews/macro-launch-artifact-packet-2026-05-28.json", "utf8")) as { schema: string; rows: unknown[] }
    const aiQualityPacket = JSON.parse(readFileSync("docs/reviews/macro-ai-quality-human-scored-packet-2026-05-28.json", "utf8")) as {
      schema: string
      evidence: { reviewer: string; environment: string; summary: { reproducible: boolean } }
    }
    const metricsPacket = JSON.parse(readFileSync("docs/reviews/macro-production-metrics-export-packet-2026-05-28.json", "utf8")) as { schema: string; rows: unknown[] }

    expect(ciPacket).toMatchObject({ schema: "astra-macro-ci-artifact-packet.v1", rows: [] })
    expect(approvalPacket.schema).toBe("astra-macro-owner-release-approval-packet.v1")
    expect(approvalPacket.approval.decision).toBe("rejected")
    expect(approvalPacket.approval.reviewedArtifacts).toEqual([])
    expect(launchPacket).toMatchObject({ schema: "astra-macro-launch-artifact-packet.v1", rows: [] })
    expect(aiQualityPacket.schema).toBe("astra-macro-ai-quality-human-scored-packet.v1")
    expect(aiQualityPacket.evidence.reviewer).toBe("")
    expect(aiQualityPacket.evidence.environment).toBe("")
    expect(aiQualityPacket.evidence.summary.reproducible).toBe(false)
    expect(metricsPacket).toMatchObject({ schema: "astra-macro-production-metrics-export-packet.v1", rows: [] })
  })

  it("keeps the operational evidence completion packet note aligned to every tracked area", () => {
    const note = readFileSync("docs/reviews/macro-operational-evidence-completion-packet-note-2026-05-28.md", "utf8")
    const packet = JSON.parse(readFileSync("docs/reviews/macro-operational-evidence-completion-packet-2026-05-28.json", "utf8")) as {
      schema: string
      rows: unknown[]
    }

    expect(packet.schema).toBe("astra-macro-operational-evidence-completion-packet.v1")
    expect(packet.rows).toEqual([])
    expect(note).toContain("evaluateAstraMacroOperationalEvidenceCompletionPacket()")
    expect(note).toContain("docs/reviews/macro-operational-evidence-completion-packet-2026-05-28.json")
    expect(note).toContain("pnpm check:macro-final-completion")
    expect(note).toContain("ASTRA_MACRO_OPERATIONAL_EVIDENCE")
    expect(note).toContain("owner/date containing a real calendar `YYYY-MM-DD`")
    expect(note).toContain("real environment or target-release context")
    expect(note).toContain("URL or repo artifact-path evidence link")
    expect(note).toContain("requirement-evidence notes")
    for (const item of ASTRA_MACRO_OPERATIONAL_EVIDENCE) {
      expect(note).toContain(`\`${item.id}\``)
      expect(note).toContain(item.status)
    }
    expect(note).toContain("ops cockpit/provider-health visibility by role")
  })

  it("keeps the final completion evidence artifact explicit and link-backed before any field is marked true", () => {
    const artifact = readFinalCompletionEvidenceArtifact()

    expect(artifact.schema).toBe("astra-macro-final-completion-evidence.v1")
    expect(artifact.generatedAt).toBe("2026-05-28T00:00:00.000Z")
    expect(artifact.label).toBe("Macro plan final completion gate — 2026-05-28")
    expect(Object.keys(artifact.evidence)).toEqual(FINAL_COMPLETION_EVIDENCE_KEYS)
    expect(Object.keys(artifact.evidenceLinks)).toEqual(FINAL_COMPLETION_EVIDENCE_KEYS)
    expect(artifact.evidence).toEqual(emptyFinalCompletionEvidence)

    for (const key of FINAL_COMPLETION_EVIDENCE_KEYS) {
      expect(Array.isArray(artifact.evidenceLinks[key])).toBe(true)
      if (artifact.evidence[key]) {
        expect(artifact.evidenceLinks[key].length).toBeGreaterThan(0)
      } else {
        expect(artifact.evidenceLinks[key]).toEqual([])
      }
    }
  })

  it("blocks final macro-plan completion until operational, CI, owner, manual, quality, launch, and metric evidence are attached", () => {
    const currentDecision = evaluateAstraMacroPlanCompletion(emptyFinalCompletionEvidence)

    expect(currentDecision.complete).toBe(false)
    expect(currentDecision.blockers.map((blocker) => blocker.code)).toEqual([
      "operational_evidence",
      "ci_quality_artifacts",
      "ci_live_browser_artifacts",
      "owner_release_approval",
      "manual_qa_checklist",
      "human_scored_ai_quality",
      "billing_legal_store_gtm_artifacts",
      "production_metrics_export",
    ])

    const externalOnlyDecision = evaluateAstraMacroPlanCompletion(completeFinalCompletionEvidence)
    expect(externalOnlyDecision.complete).toBe(false)
    expect(externalOnlyDecision.blockers.map((blocker) => blocker.code)).toEqual(["operational_evidence"])

    const provedOperationalItems = ASTRA_MACRO_OPERATIONAL_EVIDENCE.map((item) => ({
      ...item,
      status: "proved" as const,
    }))
    const completeDecision = evaluateAstraMacroPlanCompletion(completeFinalCompletionEvidence, provedOperationalItems)
    expect(completeDecision).toEqual({ complete: true, blockers: [] })
  })

  it("keeps the final checker strict for attempted operational completion packet rows", () => {
    const checker = readFileSync("script/maintenance/check-macro-final-completion.ts", "utf8")

    expect(checker).toContain("const packetDecision = evaluateAstraMacroOperationalEvidenceCompletionPacket(trackedRows)")
    expect(checker).toContain(
      "attempted operational completion evidence must satisfy evaluateAstraMacroOperationalEvidenceCompletionPacket() before it can remain in the final evidence packet",
    )
  })

  it("keeps the final checker strict for final evidenceLinks references", () => {
    const checker = readFileSync("script/maintenance/check-macro-final-completion.ts", "utf8")

    expect(checker).toContain("artifact.evidenceLinks.${key}[${index}]: expected URL or repo artifact path.")
    expect(checker).toContain("else if (!isEvidenceLikeReference(link))")
    expect(checker).toContain("function isRepoArtifactPathReference")
    expect(checker).toContain('segment !== ".."')
    expect(checker).toContain("function isLocalUrlReference")
    expect(checker).toContain('hostname === "localhost"')
    expect(checker).toContain('/^127(?:\\.\\d{1,3}){3}$/.test(hostname)')
    expect(checker).toContain('/^10(?:\\.\\d{1,3}){3}$/.test(hostname)')
    expect(checker).toContain('return true')
  })

  it("keeps the final checker strict for packet generatedAt timestamps", () => {
    const checker = readFileSync("script/maintenance/check-macro-final-completion.ts", "utf8")

    expect(checker).toContain("function validateIsoGeneratedAt")
    expect(checker).toContain("function parseIsoDate")
    expect(checker).toContain("parseIsoDate(trimmedValue.slice(0, 10)) !== null")
    expect(checker).toContain("expected an ISO timestamp string")
    expect(checker).toContain("validateIsoGeneratedAt(value.generatedAt, \"artifact.generatedAt\"")
    expect(checker).toContain("validateIsoGeneratedAt(value.generatedAt, \"productionMetricsExportPacket.generatedAt\"")
  })

  it("keeps the final checker strict for human-scored AI quality summary packet shape", () => {
    const checker = readFileSync("script/maintenance/check-macro-final-completion.ts", "utf8")

    expect(checker).toContain("function validateAiQualityRunSummary")
    expect(checker).toContain("AI_QUALITY_SUMMARY_REQUIRED_KEYS")
    expect(checker).toContain("validateConstrainedNumberField(value[field]")
    expect(checker).toContain("validateNullableConstrainedNumberField(value.averageScore")
    expect(checker).toContain("validateNumberRecord(value.capabilityCounts")
    expect(checker).toContain("integer: true, min: 0")
    expect(checker).toContain("validateNumberRecord(value.capabilityAverages")
    expect(checker).toContain("min: 1, max: 5")
    expect(checker).toContain("validateStringArrayField(value.blockerSampleIds")
    expect(checker).toContain("validateAiQualityLowScoreBacklog(value.lowScoreBacklog")
    expect(checker).toContain("summary.runId !== value.evidence.runId")
    expect(checker).toContain("expected ISO timestamp when present")
    expect(checker).toContain("findings.length > initialFindingCount")
  })

  it("keeps the final checker strict for launch artifact packet identity fields", () => {
    const checker = readFileSync("script/maintenance/check-macro-final-completion.ts", "utf8")

    expect(checker).toContain("artifactType")
    expect(checker).toContain("artifactId")
    expect(checker).toContain("artifactDigestOrVersion")
    expect(checker).toContain("targetChannel")
    expect(checker).toContain("claimBoundary")
    expect(checker).toContain("evaluateAstraMacroLaunchArtifactPacket")
  })

  it("rejects incomplete operational evidence completion packets so source-status changes cannot replace target-build proof", () => {
    const decision = evaluateAstraMacroOperationalEvidenceCompletionPacket([
      {
        areaId: "first_success_activation_evidence",
        ownerDate: "",
        environment: "",
        evidenceLink: "",
        requirementEvidence: "",
        verdict: "not-proved",
      },
    ])

    expect(decision.complete).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toContain("First-success activation evidence is not proved in the operational completion packet.")
    expect(decision.findings.map((finding) => finding.message)).toContain("First-success activation evidence is missing owner/date.")
    expect(decision.findings.map((finding) => finding.message)).toContain("Learning science Review compatibility boundary completion evidence is missing.")
    expect(decision.findings.map((finding) => finding.areaId)).toContain("pricing_beta_boundary")
    expect(decision.findings.map((finding) => finding.areaId)).toContain("accessibility_manual_evidence")
  })

  it("rejects placeholder operational evidence links so sample URLs cannot clear operational evidence", () => {
    const rows = ASTRA_MACRO_OPERATIONAL_EVIDENCE.map((item, index) => ({
      areaId: item.id,
      ownerDate: "release-owner / 2026-05-28",
      environment: "target release candidate / production evidence packet",
      evidenceLink: index === 0 ? "docs/reviews/example-operational-evidence.md" : `https://release-evidence.astra.internal/operational-evidence/${item.id}.md`,
      requirementEvidence: item.requiredBeforeStrongerClaim.join(" "),
      verdict: "proved" as const,
    }))

    const decision = evaluateAstraMacroOperationalEvidenceCompletionPacket(rows)

    expect(decision.complete).toBe(false)
    expect(decision.findings).toEqual([
      {
        areaId: "first_success_activation_evidence",
        message: "First-success activation evidence link is placeholder evidence.",
        nextStep: "Attach the real target-build evidence packet, dashboard export, QA row, approval record, or external artifact link.",
      },
    ])
  })

  it("rejects unknown operational evidence rows so unrelated proof cannot satisfy macro areas", () => {
    const decision = evaluateAstraMacroOperationalEvidenceCompletionPacket([
      ...ASTRA_MACRO_OPERATIONAL_EVIDENCE.map((item) => ({
        areaId: item.id,
        ownerDate: "release-owner / 2026-05-28",
        environment: "target release candidate / production evidence packet",
        evidenceLink: `https://release-evidence.astra.internal/operational-evidence/${item.id}.md`,
        requirementEvidence: item.requiredBeforeStrongerClaim.join(" "),
        verdict: "proved" as const,
      })),
      {
        areaId: "untracked_operational_area" as never,
        ownerDate: "release-owner / 2026-05-28",
        environment: "target release candidate / production evidence packet",
        evidenceLink: "https://release-evidence.astra.internal/operational-evidence/untracked.md",
        requirementEvidence: "Untracked proof is not part of the macro operational model.",
        verdict: "proved" as const,
      },
    ])

    expect(decision.complete).toBe(false)
    expect(decision.findings).toEqual([
      {
        areaId: "untracked_operational_area",
        message: "untracked_operational_area is not a tracked macro operational evidence area.",
        nextStep: "Use an area id from ASTRA_MACRO_OPERATIONAL_EVIDENCE.",
      },
    ])
  })

  it("rejects weak operational evidence owner/date, environment, links, and requirement notes", () => {
    const decision = evaluateAstraMacroOperationalEvidenceCompletionPacket([
      {
        areaId: "first_success_activation_evidence",
        ownerDate: "release-owner / 2026-99-99",
        environment: "placeholder target environment",
        evidenceLink: "docs/reviews/../private-evidence.md",
        requirementEvidence: "generic proof exists",
        verdict: "proved",
      },
      ...ASTRA_MACRO_OPERATIONAL_EVIDENCE.slice(1).map((item) => ({
        areaId: item.id,
        ownerDate: "release-owner / 2026-05-28",
        environment: "target release candidate / production evidence packet",
        evidenceLink: `https://release-evidence.astra.internal/operational-evidence/${item.id}.md`,
        requirementEvidence: item.requiredBeforeStrongerClaim.join(" "),
        verdict: "proved" as const,
      })),
    ])

    expect(decision.complete).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "First-success activation evidence owner/date must include a YYYY-MM-DD date.",
      "First-success activation evidence environment is placeholder evidence.",
      "First-success activation evidence evidence link must be a URL or repo artifact path.",
      "First-success activation evidence requirement-evidence notes do not reference the required stronger-claim evidence.",
    ])
  })

  it("rejects duplicate operational evidence rows so conflicting proof cannot overwrite tracked areas", () => {
    const rows = ASTRA_MACRO_OPERATIONAL_EVIDENCE.map((item) => ({
      areaId: item.id,
      ownerDate: "release-owner / 2026-05-28",
      environment: "target release candidate / production evidence packet",
      evidenceLink: `https://release-evidence.astra.internal/operational-evidence/${item.id}.md`,
      requirementEvidence: item.requiredBeforeStrongerClaim.join(" "),
      verdict: "proved" as const,
    }))

    const decision = evaluateAstraMacroOperationalEvidenceCompletionPacket([...rows, rows[0]])

    expect(decision.complete).toBe(false)
    expect(decision.findings).toEqual([
      {
        areaId: "first_success_activation_evidence",
        message: "first_success_activation_evidence has duplicate operational completion evidence rows.",
        nextStep: "Keep one owner/date/environment/evidence-backed row per operational evidence area.",
      },
    ])
  })

  it("accepts operational evidence completion packets only when every tracked area has owned target-release proof", () => {
    const rows = ASTRA_MACRO_OPERATIONAL_EVIDENCE.map((item) => ({
      areaId: item.id,
      ownerDate: "release-owner / 2026-05-28",
      environment: "target release candidate / production evidence packet",
      evidenceLink: `https://release-evidence.astra.internal/operational-evidence/${item.id}.md`,
      requirementEvidence: item.requiredBeforeStrongerClaim.join(" "),
      verdict: "proved" as const,
    }))

    expect(evaluateAstraMacroOperationalEvidenceCompletionPacket(rows)).toEqual({ complete: true, findings: [] })
  })

  it("defines the owner release approval packet required before approval evidence can be attached", () => {
    expect(ASTRA_MACRO_RELEASE_APPROVAL_REQUIREMENT.requiredReviewedArtifacts).toEqual([
      "docs/reviews/macro-gate-4-claim-review-2026-05-28.md",
      "docs/reviews/macro-rc-evidence-packet-2026-05-28.md",
      "docs/reviews/macro-final-completion-gate-2026-05-28.md",
      "docs/reviews/macro-final-evidence-intake-2026-05-28.md",
    ])
  })

  it("rejects incomplete owner release approval so a generic approval cannot masquerade as final evidence", () => {
    const decision = evaluateAstraMacroReleaseApprovalPacket({
      approver: "",
      approvalDate: "",
      approvalRecordLink: "",
      targetCommitSha: "",
      decision: "rejected",
      reviewedArtifacts: ["docs/reviews/macro-rc-evidence-packet-2026-05-28.md"],
      acknowledgesRemainingFinalBlockers: false,
      acknowledgesDowngradeCopy: false,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "Release approval is missing approver.",
      "Release approval is missing approval date.",
      "Release approval is missing an approval record link.",
      "Release approval is missing target commit/SHA.",
      "Release approval decision is rejected.",
      "Release approval does not acknowledge remaining final blockers.",
      "Release approval does not acknowledge required downgrade copy.",
      "Release approval is missing reviewed artifacts: docs/reviews/macro-gate-4-claim-review-2026-05-28.md, docs/reviews/macro-final-completion-gate-2026-05-28.md, docs/reviews/macro-final-evidence-intake-2026-05-28.md.",
    ])
  })

  it("rejects weak owner release approval date, record link, and target SHA", () => {
    const decision = evaluateAstraMacroReleaseApprovalPacket({
      ...completeReleaseApprovalPacket,
      approvalDate: "release day",
      approvalRecordLink: "owner-approved",
      targetCommitSha: "not-a-sha",
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "Release approval date must include a YYYY-MM-DD date.",
      "Release approval record link must be a URL or repo artifact path.",
      "Release approval target commit/SHA must be a 7-40 character hex SHA.",
    ])
  })

  it("accepts owner release approval only when it is commit-bound and acknowledges downgrade boundaries", () => {
    expect(evaluateAstraMacroReleaseApprovalPacket(completeReleaseApprovalPacket)).toEqual({ acceptable: true, findings: [] })
  })

  it("blocks final approval wording while the current final gate still has blockers", () => {
    const decision = evaluateAstraMacroReleaseApprovalPacket({
      ...completeReleaseApprovalPacket,
      decision: "approved_final",
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toContain("Release approval cannot be final while remaining final blockers are acknowledged.")
  })

  it("keeps final owner approval reachable once no remaining final blockers are acknowledged", () => {
    const decision = evaluateAstraMacroReleaseApprovalPacket({
      ...completeReleaseApprovalPacket,
      decision: "approved_final",
      acknowledgesRemainingFinalBlockers: false,
    })

    expect(decision).toEqual({ acceptable: true, findings: [] })
  })

  it("defines the manual QA packet required before manual QA evidence can be attached", () => {
    expect(ASTRA_MACRO_MANUAL_QA_REQUIREMENTS.map((requirement) => requirement.section)).toEqual([6, 7, 13, 14, 24, 32])
    expect(ASTRA_MACRO_MANUAL_QA_REQUIREMENTS.find((requirement) => requirement.section === 6)?.qaRows).toEqual(EXPECTED_MANUAL_QA_ROWS[6])
    expect(ASTRA_MACRO_MANUAL_QA_REQUIREMENTS.find((requirement) => requirement.section === 32)?.qaRows).toEqual(EXPECTED_MANUAL_QA_ROWS[32])
  })

  it("rejects incomplete manual QA packets so not-run rows cannot masquerade as release evidence", () => {
    const decision = evaluateAstraMacroManualQaEvidencePacket([
      {
        section: 6,
        qaRow: "Article source return",
        ownerDate: "",
        environment: "",
        evidenceLink: "",
        verdict: "not-run",
      },
    ])

    expect(decision.complete).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toContain("Section 6 / Article source return is not-run.")
    expect(decision.findings.map((finding) => finding.message)).toContain("Section 6 / Remote PDF source return manual QA row is missing.")
    expect(decision.findings.map((finding) => finding.message)).toContain("Section 32 / Screen reader spot check manual QA row is missing.")
  })

  it("rejects placeholder manual QA evidence links so sample walkthroughs cannot clear manual QA", () => {
    const decision = evaluateAstraMacroManualQaEvidencePacket([
      {
        ...completeManualQaRows[0],
        evidenceLink: "https://release-evidence.astra.internal/manual-qa/placeholder-section-6.md",
      },
      ...completeManualQaRows.slice(1),
    ])

    expect(decision.complete).toBe(false)
    expect(decision.findings).toEqual([
      {
        section: 6,
        qaRow: "Article source return",
        message: "Section 6 / Article source return evidence link is placeholder evidence.",
        nextStep: "Attach the real screenshot, recording, run folder, log excerpt, or written QA note.",
      },
    ])
  })

  it("rejects weak manual QA owner/date and evidence references", () => {
    const decision = evaluateAstraMacroManualQaEvidencePacket([
      {
        ...completeManualQaRows[0],
        ownerDate: "QA owner",
        evidenceLink: "done",
      },
      ...completeManualQaRows.slice(1),
    ])

    expect(decision.complete).toBe(false)
    expect(decision.findings).toEqual([
      {
        section: 6,
        qaRow: "Article source return",
        message: "Section 6 / Article source return owner/date must include a YYYY-MM-DD date.",
        nextStep: "Record owner/date with an ISO-style review date for this manual QA row.",
      },
      {
        section: 6,
        qaRow: "Article source return",
        message: "Section 6 / Article source return evidence link must be a URL or repo artifact path.",
        nextStep: "Attach a URL or repo path under docs/, data/, artifacts/, test-results/, or playwright-report/.",
      },
    ])
  })

  it("rejects unknown manual QA rows so unrelated walkthroughs cannot satisfy the release checklist", () => {
    const decision = evaluateAstraMacroManualQaEvidencePacket([
      ...completeManualQaRows,
      {
        section: 99,
        qaRow: "Untracked walkthrough",
        ownerDate: "QA owner — 2026-05-28",
        environment: "Chrome extension target build on macOS",
        evidenceLink: "https://release-evidence.astra.internal/manual-qa/untracked-walkthrough.md",
        verdict: "pass",
      },
    ])

    expect(decision.complete).toBe(false)
    expect(decision.findings).toEqual([
      {
        section: 99,
        qaRow: "Untracked walkthrough",
        message: "Section 99 / Untracked walkthrough is not a tracked manual QA row.",
        nextStep: "Use a section/row pair from ASTRA_MACRO_MANUAL_QA_REQUIREMENTS.",
      },
    ])
  })

  it("rejects duplicate manual QA rows so conflicting walkthrough evidence cannot overwrite each other", () => {
    const decision = evaluateAstraMacroManualQaEvidencePacket([
      ...completeManualQaRows,
      completeManualQaRows[0],
    ])

    expect(decision.complete).toBe(false)
    expect(decision.findings).toEqual([
      {
        section: 6,
        qaRow: "Article source return",
        message: "Section 6 / Article source return has duplicate manual QA evidence rows.",
        nextStep: "Keep one manual QA evidence row per required section/row pair.",
      },
    ])
  })

  it("accepts manual QA packets only when every required row is run and evidence-backed", () => {
    expect(evaluateAstraMacroManualQaEvidencePacket(completeManualQaRows)).toEqual({ complete: true, findings: [] })
  })

  it("defines the CI artifact packet required before final CI evidence can be attached", () => {
    expect(ASTRA_MACRO_CI_ARTIFACT_REQUIREMENTS.map((requirement) => requirement.evidenceField)).toEqual([
      "ciQualityArtifactsAttached",
      "ciLiveBrowserArtifactsAttached",
    ])
    expect(ASTRA_MACRO_CI_ARTIFACT_REQUIREMENTS.find((requirement) => requirement.evidenceField === "ciQualityArtifactsAttached")?.requiredCoverage).toEqual([
      "pnpm check:repo-knowledge",
      "pnpm check:zod-entrypoints",
      "pnpm check:macro-final-completion",
      "pnpm type-check",
      "pnpm lint:ci",
      "pnpm test",
      "pnpm bench",
    ])
    expect(ASTRA_MACRO_CI_ARTIFACT_REQUIREMENTS.find((requirement) => requirement.evidenceField === "ciLiveBrowserArtifactsAttached")?.requiredCoverage).toEqual([
      "source-core",
      "extension-core",
      "learning-loop",
      "document-proof",
      "youtube-proof",
      "youtube-holdout",
    ])
    expect(ASTRA_MACRO_CI_ARTIFACT_REQUIREMENTS.map((requirement) => requirement.requiredEvidence).join(" ")).toContain("run/job/artifact identity")
    expect(ASTRA_MACRO_CI_ARTIFACT_REQUIREMENTS.map((requirement) => requirement.requiredEvidence).join(" ")).toContain("artifact digest or checksum")
    expect(ASTRA_MACRO_CI_ARTIFACT_REQUIREMENTS.map((requirement) => requirement.requiredEvidence).join(" ")).toContain("artifact manifest")

    const ciWorkflow = readFileSync(".github/workflows/ci.yml", "utf8")
    expect(ciWorkflow).toContain("name: Check macro final completion evidence")
    expect(ciWorkflow).toContain("run: pnpm check:macro-final-completion")
    expect(ciWorkflow).toContain("data/bench-results/quality-gate-manifest.json")
    expect(ciWorkflow).toContain("astra.ci.quality-gate-results-manifest.v1")
    expect(ciWorkflow).toContain("data/bench-live-results/live-bench-manifest.json")
    expect(ciWorkflow).toContain("astra.ci.live-bench-results-manifest.v1")
  })

  it("rejects incomplete CI artifact packets so local logs cannot masquerade as uploaded CI evidence", () => {
    const decision = evaluateAstraMacroCiArtifactPacket([
      {
        evidenceField: "ciQualityArtifactsAttached",
        artifactName: "local-quality-log",
        workflowName: "local shell",
        runId: "",
        jobName: "",
        artifactId: "",
        artifactDigest: "",
        artifactManifestPath: "",
        runUrl: "",
        artifactUrl: "",
        commitSha: "",
        ownerDate: "",
        coverage: ["pnpm test"],
      },
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.evidenceField)).toContain("ciLiveBrowserArtifactsAttached")
    expect(decision.findings.filter((finding) => finding.evidenceField === "ciQualityArtifactsAttached").map((finding) => finding.message)).toEqual([
      "CI quality gate artifact must name the quality-gate-results artifact.",
      "CI quality gate artifact must identify the quality workflow/job.",
      "CI quality gate artifact is missing the CI run id.",
      "CI quality gate artifact is missing the CI job name.",
      "CI quality gate artifact is missing the artifact id.",
      "CI quality gate artifact is missing the artifact digest/checksum.",
      "CI quality gate artifact is missing the artifact manifest path.",
      "CI quality gate artifact is missing the CI run URL.",
      "CI quality gate artifact is missing the downloadable artifact URL.",
      "CI quality gate artifact is missing the target commit/SHA.",
      "CI quality gate artifact is missing owner/date.",
      "CI quality gate artifact is missing required coverage: pnpm check:repo-knowledge, pnpm check:zod-entrypoints, pnpm check:macro-final-completion, pnpm type-check, pnpm lint:ci, pnpm bench.",
    ])
  })

  it("rejects unknown CI artifact packet rows so unrelated evidence fields cannot satisfy final CI evidence", () => {
    const decision = evaluateAstraMacroCiArtifactPacket([
      {
        evidenceField: "localShellOnly" as never,
        artifactName: "quality-gate-results",
        workflowName: "quality",
        runId: "run-localShellOnly",
        jobName: "quality / release gate",
        artifactId: "artifact-quality-gate-results",
        artifactDigest: "sha256:localShellOnlylocalShellOnly",
        artifactManifestPath: "data/release-artifacts/quality-gate-results/manifest.json",
        runUrl: "https://github.com/astra-release/actions/runs/localShellOnly",
        artifactUrl: "https://github.com/astra-release/actions/artifacts/quality-gate-results",
        commitSha: "abc123def456",
        ownerDate: "Release owner — 2026-05-28",
        coverage: ["pnpm test"],
      },
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings).toEqual(expect.arrayContaining([
      {
        evidenceField: "localShellOnly",
        message: "localShellOnly is not a tracked final CI artifact evidence field.",
        nextStep: "Use ciQualityArtifactsAttached or ciLiveBrowserArtifactsAttached.",
      },
    ]))
  })

  it("rejects duplicate CI artifact packet rows so conflicting artifacts cannot overwrite each other", () => {
    const decision = evaluateAstraMacroCiArtifactPacket([
      ...completeCiArtifactPacket,
      completeCiArtifactPacket[0],
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings).toEqual([
      {
        evidenceField: "ciQualityArtifactsAttached",
        message: "ciQualityArtifactsAttached has duplicate CI artifact evidence rows.",
        nextStep: "Keep one CI artifact evidence row per final evidence field.",
      },
    ])
  })

  it("rejects CI artifact packets whose quality and live-browser rows target different commits", () => {
    const decision = evaluateAstraMacroCiArtifactPacket([
      completeCiArtifactPacket[0],
      {
        ...completeCiArtifactPacket[1],
        commitSha: "def456abc123",
      },
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings).toEqual([
      {
        evidenceField: "ciQualityArtifactsAttached/ciLiveBrowserArtifactsAttached",
        message: "CI quality and live-browser artifacts must target the same commit/SHA.",
        nextStep: "Attach quality-gate-results and live-bench-results artifacts from the same target commit/worktree or release candidate.",
      },
    ])
  })

  it("rejects weak CI artifact URL, SHA, date, and manifest references", () => {
    const decision = evaluateAstraMacroCiArtifactPacket([
      {
        ...completeCiArtifactPacket[0],
        artifactManifestPath: "docs/../release-artifacts/quality-gate-manifest.json",
        runUrl: "https://",
        artifactUrl: "http://10.0.0.5/artifacts/quality-gate-results.zip",
        commitSha: "not-a-sha",
        ownerDate: "Release owner",
      },
      completeCiArtifactPacket[1],
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "CI quality and live-browser artifacts must target the same commit/SHA.",
      "CI quality gate artifact artifact manifest path must be a URL or repo artifact path.",
      "CI quality gate artifact CI run URL must be a URL.",
      "CI quality gate artifact downloadable artifact URL must be a URL.",
      "CI quality gate artifact target commit/SHA must be a 7-40 character hex SHA.",
      "CI quality gate artifact owner/date must include a YYYY-MM-DD date.",
    ])
  })

  it("rejects duplicate uploaded CI artifact ids and artifact URLs across final CI rows", () => {
    const decision = evaluateAstraMacroCiArtifactPacket([
      completeCiArtifactPacket[0],
      {
        ...completeCiArtifactPacket[1],
        artifactId: completeCiArtifactPacket[0].artifactId,
        artifactUrl: completeCiArtifactPacket[0].artifactUrl,
      },
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      `ciLiveBrowserArtifactsAttached reuses CI artifact id ${completeCiArtifactPacket[0].artifactId}.`,
      `ciLiveBrowserArtifactsAttached reuses CI artifact URL ${completeCiArtifactPacket[0].artifactUrl}.`,
    ])
  })

  it("accepts CI artifact packets only when quality commands and live release-proof lanes are covered", () => {
    expect(evaluateAstraMacroCiArtifactPacket(completeCiArtifactPacket)).toEqual({ acceptable: true, findings: [] })
  })

  it("keeps the launch artifact evidence note explicit that repo-side notes do not clear final launch evidence", () => {
    const launchNote = readFileSync("docs/reviews/launch-artifact-packet-evidence-note-2026-05-28.md", "utf8")

    expect(launchNote).toContain("docs/reviews/pricing-beta-boundary-evidence-note-2026-05-28.md")
    expect(launchNote).toContain("docs/reviews/gtm-release-packet-evidence-note-2026-05-28.md")
    expect(launchNote).toContain("docs/reviews/store-submission-evidence-note-2026-05-28.md")
    expect(launchNote).toContain("repo-side pricing/GTM/store-submission evidence notes")
    expect(launchNote).toContain("external billing, legal, store-console, signed-build, owner-approved, and media artifacts")
  })

  it("defines the billing/legal/store/GTM launch artifact packet required before final launch evidence can be attached", () => {
    expect(ASTRA_MACRO_LAUNCH_ARTIFACT_GROUPS).toEqual([
      "billing",
      "legal_trust",
      "store_submission",
      "gtm",
    ])
    expect(ASTRA_MACRO_LAUNCH_ARTIFACT_REQUIREMENTS.map((requirement) => requirement.id)).toEqual([
      "billing_checkout",
      "billing_webhook",
      "billing_entitlement",
      "billing_cancel_refund",
      "legal_privacy_terms",
      "legal_ai_notice",
      "legal_support_contact",
      "store_zip_hash",
      "store_upload_submission",
      "store_reviewer_notes",
      "store_screenshots",
      "gtm_demo_capture",
      "gtm_storyboard_screenshots",
      "gtm_copy_claim_review",
    ])
  })

  it("rejects incomplete launch artifact packets so strategy docs cannot masquerade as billing/legal/store/GTM evidence", () => {
    const decision = evaluateAstraMacroLaunchArtifactPacket([
      {
        ...completeLaunchArtifactRows.find((row) => row.requirementId === "billing_checkout")!,
        evidenceLink: "https://release-evidence.astra.internal/billing-checkout/2026-05-28",
        artifactId: "billing-checkout-artifact-2026-05-28",
      },
      {
        requirementId: "legal_privacy_terms",
        artifactType: "",
        artifactId: "",
        artifactDigestOrVersion: "",
        targetChannel: "",
        claimBoundary: "legal_trust",
        evidenceLink: "",
        ownerDate: "",
        environment: "",
      },
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.requirementId)).toContain("billing_webhook")
    expect(decision.findings.map((finding) => finding.requirementId)).toContain("store_upload_submission")
    expect(decision.findings.map((finding) => finding.requirementId)).toContain("gtm_demo_capture")
    expect(decision.findings.filter((finding) => finding.requirementId === "legal_privacy_terms").map((finding) => finding.message)).toEqual([
      "Legal privacy and terms approval is missing artifact type.",
      "Legal privacy and terms approval is missing artifact id.",
      "Legal privacy and terms approval is missing artifact digest or version.",
      "Legal privacy and terms approval is missing target channel.",
      "Legal privacy and terms approval is missing an evidence link.",
      "Legal privacy and terms approval is missing owner/date.",
      "Legal privacy and terms approval is missing environment or target channel context.",
    ])
  })

  it("rejects unknown launch artifact rows so unrelated evidence cannot satisfy billing/legal/store/GTM requirements", () => {
    const decision = evaluateAstraMacroLaunchArtifactPacket([
      {
        requirementId: "press_kit" as never,
        artifactType: "gtm media artifact",
        artifactId: "launch-press-kit-2026-05-28",
        artifactDigestOrVersion: "sha256:presskitpresskitpresskit",
        targetChannel: "gtm target release channel",
        claimBoundary: "gtm",
        evidenceLink: "https://release-evidence.astra.internal/launch-artifacts/press-kit",
        ownerDate: "Release owner — 2026-05-28",
        environment: "gtm target release channel",
      },
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings).toEqual(expect.arrayContaining([
      {
        requirementId: "press_kit",
        group: "store_submission",
        message: "press_kit is not a tracked billing/legal/store/GTM launch artifact requirement.",
        nextStep: "Use a requirement id from ASTRA_MACRO_LAUNCH_ARTIFACT_REQUIREMENTS.",
      },
    ]))
  })

  it("rejects duplicate launch artifact rows so conflicting billing/legal/store/GTM evidence cannot overwrite each other", () => {
    const decision = evaluateAstraMacroLaunchArtifactPacket([
      ...completeLaunchArtifactRows,
      completeLaunchArtifactRows[0],
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings).toEqual([
      {
        requirementId: "billing_checkout",
        group: "billing",
        message: "billing_checkout has duplicate launch artifact evidence rows.",
        nextStep: "Keep one launch artifact evidence row per billing/legal/store/GTM requirement.",
      },
    ])
  })

  it("rejects duplicate launch artifact ids and evidence links across requirements", () => {
    const decision = evaluateAstraMacroLaunchArtifactPacket([
      completeLaunchArtifactRows[0],
      {
        ...completeLaunchArtifactRows[1],
        artifactId: completeLaunchArtifactRows[0].artifactId,
        evidenceLink: completeLaunchArtifactRows[0].evidenceLink,
      },
      ...completeLaunchArtifactRows.slice(2),
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      `billing_webhook reuses launch artifact id ${completeLaunchArtifactRows[0].artifactId}.`,
      `billing_webhook reuses launch artifact evidence link ${completeLaunchArtifactRows[0].evidenceLink}.`,
    ])
  })

  it("rejects weak launch artifact identity, boundary, owner date, and evidence reference", () => {
    const decision = evaluateAstraMacroLaunchArtifactPacket([
      {
        ...completeLaunchArtifactRows[0],
        artifactType: "placeholder billing artifact",
        artifactId: "example-billing-artifact",
        artifactDigestOrVersion: "todo-version",
        targetChannel: "placeholder channel",
        claimBoundary: "gtm",
        evidenceLink: "not-a-link",
        ownerDate: "Release owner",
      },
      ...completeLaunchArtifactRows.slice(1),
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "Billing checkout success/cancel claim boundary is gtm, expected billing.",
      "Billing checkout success/cancel artifact type is placeholder evidence.",
      "Billing checkout success/cancel artifact id is placeholder evidence.",
      "Billing checkout success/cancel artifact digest or version is placeholder evidence.",
      "Billing checkout success/cancel target channel is placeholder evidence.",
      "Billing checkout success/cancel evidence link must be a URL or repo artifact path.",
      "Billing checkout success/cancel owner/date must include a YYYY-MM-DD date.",
    ])
  })

  it("accepts a launch artifact packet only when every required billing/legal/store/GTM artifact is linked and owned", () => {
    const decision = evaluateAstraMacroLaunchArtifactPacket(completeLaunchArtifactRows)

    expect(decision).toEqual({ acceptable: true, findings: [] })
  })

  it("keeps external launch artifacts blocked until real evidence is attached", () => {
    const decision = evaluateAstraMacroOperationalEvidence()

    expect(decision.publicBetaReady).toBe(true)
    expect(decision.strongerClaimBlocked).toBe(true)
    expect(decision.missingEvidence.map((item) => item.id)).toEqual([
      "pricing_beta_boundary",
      "gtm_release_packet",
      "store_submission_packet",
    ])

    const pricing = decision.missingEvidence.find((item) => item.id === "pricing_beta_boundary")
    expect(pricing?.currentEvidence).toContain("docs/reviews/pricing-beta-boundary-evidence-note-2026-05-28.md")
    expect(pricing?.currentEvidence).toContain("docs/analysis/v1-activation-trial-support-checklist-2026-05-27.md")
    expect(pricing?.requiredBeforeStrongerClaim.join(" ")).toContain("production billing checkout/portal")
    expect(pricing?.downgradeCopy).toContain("paid launch remains externally blocked")

    const gtm = decision.missingEvidence.find((item) => item.id === "gtm_release_packet")
    expect(gtm?.currentEvidence).toContain("docs/reviews/gtm-release-packet-evidence-note-2026-05-28.md")
    expect(gtm?.currentEvidence).toContain("src/utils/gtm-campaign.test.ts")
    expect(gtm?.requiredBeforeStrongerClaim.join(" ")).toContain("current sub-60-second demo captures")
    expect(gtm?.downgradeCopy).toContain("repo-side GTM evidence note")

    const store = decision.missingEvidence.find((item) => item.id === "store_submission_packet")
    expect(store?.currentEvidence).toContain("docs/reviews/store-submission-evidence-note-2026-05-28.md")
    expect(store?.requiredBeforeStrongerClaim.join(" ")).toContain("target browser/mobile store channel upload, submission, or processing status")
    expect(store?.requiredBeforeStrongerClaim.join(" ")).toContain("console privacy forms")
    expect(store?.downgradeCopy).toContain("pending external store work")
    expect(store?.downgradeCopy).toContain("repo-side store-submission evidence note")
  })

  it("renders an RC evidence note that blocks stronger claims while preserving downgrade copy", () => {
    const note = renderAstraMacroOperationalEvidenceRcNote(ASTRA_MACRO_OPERATIONAL_EVIDENCE, {
      generatedAt: "2026-05-28T00:00:00.000Z",
      rcLabel: "Macro plan RC evidence note — 2026-05-28",
      validationEvidence: [
        "PERSONALIZATION_REVIEW_COMBINED_EXIT:0",
        "LIBRARY_ASSET_COVERAGE_COMBINED_EXIT:0",
      ],
    })

    expect(note).toContain("# Macro plan RC evidence note — 2026-05-28")
    expect(note).toContain("Public beta acceptable with downgrade copy: yes")
    expect(note).toContain("Stronger launch/product claims blocked: yes")
    expect(note).toContain("External-evidence blockers: 3")
    expect(note).toContain("Areas requiring downgrade copy: 15")
    expect(note).toContain("PERSONALIZATION_REVIEW_COMBINED_EXIT:0")
    expect(note).toContain("First-success activation evidence")
    expect(note).toContain("docs/reviews/first-success-activation-evidence-note-2026-05-28.md")
    expect(note).toContain("smoke-report evaluator/evidence note")
    expect(note).toContain("Pricing, trial, and paywall launch boundary")
    expect(note).toContain("docs/reviews/pricing-beta-boundary-evidence-note-2026-05-28.md")
    expect(note).toContain("paid launch remains externally blocked")
    expect(note).toContain("GTM release artifact packet")
    expect(note).toContain("docs/reviews/gtm-release-packet-evidence-note-2026-05-28.md")
    expect(note).toContain("repo-side GTM evidence note")
    expect(note).toContain("Store listing and permission trust submission packet")
    expect(note).toContain("apps/mobile/store/ios/app-store-connect.md")
    expect(note).toContain("apps/mobile/store/android/play-listing.md")
    expect(note).toContain("docs/reviews/store-submission-evidence-note-2026-05-28.md")
    expect(note).toContain("repo-side store-submission evidence note")
    expect(note).toContain("target browser/mobile store channel upload, submission, or processing status")
    expect(note).toContain("Astra is a free public beta")
    expect(note).toContain("docs/reviews/library-qa-evidence-note-2026-05-28.md")
    expect(note).toContain("docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md")
    expect(note).toContain("Section 6 rows")
    expect(note).toContain("repo-side Library QA note")
    expect(note).toContain("docs/reviews/personalization-qa-evidence-note-2026-05-28.md")
    expect(note).toContain("Section 7 rows")
    expect(note).toContain("repo-side personalization QA note")
    expect(note).toContain("Product metrics operational evidence")
    expect(note).toContain("docs/analysis/minimal-mobile-retention-ops-summary-checklist-2026-05-28.md")
    expect(note).toContain("aggregate-only mobile retention ops summary")
    expect(note).toContain("docs/reviews/production-metrics-export-evidence-note-2026-05-28.md")
    expect(note).toContain("evaluateAstraProductionMetricsExportPacket()")
    expect(note).toContain("production metrics export packet intake guard")
    expect(note).toContain("Human-scored AI quality report")
    expect(note).toContain("Section 24 rows")
    expect(note).toContain("docs/reviews/ai-quality-human-scored-evidence-note-2026-05-28.md")
    expect(note).toContain("human-scored report intake guard")
    expect(note).toContain("Brand and aesthetic surface audit")
    expect(note).toContain("docs/reviews/brand-default-surface-evidence-note-2026-05-28.md")
    expect(note).toContain("repo-side Section 13 evidence note")
    expect(note).toContain("Operations console role boundary")
    expect(note).toContain("src/utils/operating-review.test.ts")
    expect(note).toContain("aggregate ops cockpit/operating-review surfaces")
    expect(note).toContain("Accessibility manual evidence packet")
    expect(note).toContain("docs/reviews/accessibility-manual-evidence-note-2026-05-28.md")
    expect(note).toContain("manual evidence packet intake guard")
    expect(note).toContain("Review visibly uses the profile")
    expect(note).toContain("Do not convert repository implementation into paid launch")
  })

  it("keeps the generated RC evidence note in sync with the executable evidence model", () => {
    const committedNote = readFileSync("docs/reviews/macro-operational-evidence-rc-note-2026-05-28.md", "utf8")

    expect(committedNote).toBe(renderCurrentMacroRcNote())
  })

  it("keeps the final completion gate note in sync with the executable completion decision", () => {
    const committedNote = readFileSync("docs/reviews/macro-final-completion-gate-2026-05-28.md", "utf8")

    expect(committedNote).toBe(renderCurrentMacroCompletionGateNote())
    expect(committedNote).toContain("- Complete: no")
    expect(committedNote).toContain("- Blocker count: 8")
    expect(committedNote).toContain("operational_evidence")
    expect(committedNote).toContain("macro-operational-evidence-completion-packet-2026-05-28.json satisfies evaluateAstraMacroOperationalEvidenceCompletionPacket()")
    expect(committedNote).toContain("ci_quality_artifacts")
    expect(committedNote).toContain("run/job/artifact identity, distinct artifact id/URL")
    expect(committedNote).toContain("7-40 character hex target commit/SHA")
    expect(committedNote).toContain("ci_live_browser_artifacts")
    expect(committedNote).toContain("owner_release_approval")
    expect(committedNote).toContain("approver/date containing a real calendar YYYY-MM-DD")
    expect(committedNote).toContain("7-40 character hex target commit/SHA")
    expect(committedNote).toContain("manual_qa_checklist")
    expect(committedNote).toContain("Section 6/7/13/14/24/32")
    expect(committedNote).toContain("owner/date")
    expect(committedNote).toContain("`pass` or `pass-with-downgrade`")
    expect(committedNote).toContain("human_scored_ai_quality")
    expect(committedNote).toContain("reviewer/date containing a real calendar YYYY-MM-DD")
    expect(committedNote).toContain("URL or repo artifact-path live provider samples and blocker triage")
    expect(committedNote).toContain("finite sample counts matching summarized P0 samples")
    expect(committedNote).toContain("billing_legal_store_gtm_artifacts")
    expect(committedNote).toContain("owner/date containing a real calendar YYYY-MM-DD, environment/channel")
    expect(committedNote).toContain("URL or repo artifact-path evidence link before launch-complete claims")
    expect(committedNote).toContain("production_metrics_export")
    expect(committedNote).toContain("valid non-reversed shared YYYY-MM-DD..YYYY-MM-DD date range")
    expect(committedNote).toContain("category-aligned non-duplicated metric ids")
    expect(committedNote).toContain("URL or repo artifact-path evidence/privacy links")
  })

  it("points every repo evidence entry at an existing file", () => {
    const missing = ASTRA_MACRO_OPERATIONAL_EVIDENCE.flatMap((item) =>
      item.currentEvidence.filter((entry) => isRepoPathEvidence(entry) && !existsSync(entry)).map((entry) => `${item.id}: ${entry}`),
    )

    expect(missing).toEqual([])
  })

  it("keeps manual QA checklist coverage for every manually gated macro section", () => {
    const checklist = readFileSync("docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md", "utf8")

    for (const section of REQUIRED_MANUAL_CHECKLIST_SECTIONS) {
      expect(checklist).toContain(`## Section ${section}`)
    }
  })

  it("keeps manual QA checklist rows structured so unrun rows cannot masquerade as release evidence", () => {
    const rows = macroManualQaChecklistRows()

    for (const section of REQUIRED_MANUAL_CHECKLIST_SECTIONS) {
      expect(rows.filter((row) => row.section === section).map((row) => row.qaRow)).toEqual(
        EXPECTED_MANUAL_QA_ROWS[section],
      )
    }

    for (const row of rows) {
      expect(ALLOWED_MANUAL_QA_VERDICTS.has(row.verdict)).toBe(true)
      expect(row.currentStatus).toMatch(/repo-backed|browser-backed|manual-required|external-required/)

      if (row.verdict === "not-run") {
        expect(row.ownerDate).toBe("")
        expect(row.environment).toBe("")
        expect(row.evidenceLink).toBe("")
      } else {
        expect(row.ownerDate.length).toBeGreaterThan(0)
        expect(row.environment.length).toBeGreaterThan(0)
        expect(row.evidenceLink.length).toBeGreaterThan(0)
      }
    }
  })

  it("requires downgrade copy for every non-proved area so code is not mistaken for launch proof", () => {
    for (const item of ASTRA_MACRO_OPERATIONAL_EVIDENCE) {
      expect(item.currentEvidence.length).toBeGreaterThan(0)
      expect(item.requiredBeforeStrongerClaim.length).toBeGreaterThan(0)
      if (item.status !== "proved") {
        expect(item.downgradeCopy.length).toBeGreaterThan(20)
      }
    }
  })
})
