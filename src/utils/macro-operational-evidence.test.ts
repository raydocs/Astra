import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { resolve } from "node:path"

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
  "Semantic evidence requirements are enforced by parsing the machine-readable packet/checklist",
  "not by requiring descriptive words in the link string itself",
  "each be a URL or repo artifact path",
  "not a local-only, private-network, loopback, malformed, surrounding, embedded, or percent-encoded whitespace/control-character, or path-traversal reference",
  "placeholder evidence",
  "duplicate evidence link",
  "false fields must keep evidenceLinks empty",
  "URL or repo artifact-path evidence link",
  "repo artifact paths must exist in the worktree",
  "present exactly once",
  "checklist structure",
  "not inside fenced examples or blockquotes",
  "pre-claim packet structure",
  "timezone-bearing ISO `generatedAt` timestamps",
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
  "macro-product-metrics-readiness-packet-2026-05-28.json",
  "evaluateAstraProductMetricsReadiness()",
  "Activation",
  "Understanding",
  "Learning",
  "Membership",
  "date range",
  "YYYY-MM-DD..YYYY-MM-DD",
  "canonical shared date range and cohort definition without surrounding whitespace",
  "cohort definition",
  "dashboard/query source",
  "export id",
  "timezone-bearing ISO exported-at timestamp",
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

const ciArtifactDigestByEvidenceField = {
  ciQualityArtifactsAttached: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  ciLiveBrowserArtifactsAttached: "123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0",
} as const

const launchArtifactDigestByRequirement = Object.fromEntries(
  ASTRA_MACRO_LAUNCH_ARTIFACT_REQUIREMENTS.map((requirement, index) => [
    requirement.id,
    Array.from({ length: 64 }, (_, position) => ((index + position + 1) % 16).toString(16)).join(""),
  ]),
) as Record<(typeof ASTRA_MACRO_LAUNCH_ARTIFACT_REQUIREMENTS)[number]["id"], string>

const completeCiArtifactPacket = ASTRA_MACRO_CI_ARTIFACT_REQUIREMENTS.map((requirement, index) => {
  const runNumber = 123456 + index
  const artifactNumber = 654321 + index
  return {
    evidenceField: requirement.evidenceField,
    artifactName: requirement.artifactName,
    workflowName: requirement.workflowName,
    runId: `${runNumber}`,
    jobName: `${requirement.workflowName} / release gate`,
    workflowConclusion: "success",
    jobConclusion: "success",
    artifactId: `${artifactNumber}`,
    artifactDigest: `sha256:${ciArtifactDigestByEvidenceField[requirement.evidenceField]}`,
    artifactManifestPath: `data/release-artifacts/${requirement.artifactName}/manifest.json`,
    runUrl: `https://github.com/astra-release/astra/actions/runs/${runNumber}`,
    artifactUrl: `https://github.com/astra-release/astra/actions/runs/${runNumber}/artifacts/${artifactNumber}`,
    commitSha: "abc123def456",
    ownerDate: "release-owner@astra.ai — 2026-05-28",
    coverage: requirement.requiredCoverage,
  }
})

const completeReleaseApprovalPacket = {
  approver: "release-owner@astra.ai",
  approvalDate: "2026-05-28",
  approvalRecordLink: "https://release-evidence.astra-cdn.net/owner-approval/2026-05-28",
  targetCommitSha: "abc123def456",
  decision: "approved_with_downgrades" as const,
  reviewedArtifacts: ASTRA_MACRO_RELEASE_APPROVAL_REQUIREMENT.requiredReviewedArtifacts,
  acknowledgesRemainingFinalBlockers: true,
  acknowledgesDowngradeCopy: true,
}

function launchArtifactRequirementContext(requirementId: string): string {
  return requirementId.replace(/_/g, " ")
}

const completeLaunchArtifactRows = ASTRA_MACRO_LAUNCH_ARTIFACT_REQUIREMENTS.map((requirement) => {
  const requirementContext = launchArtifactRequirementContext(requirement.id)
  return {
    requirementId: requirement.id,
    artifactType: `${requirementContext} ${requirement.group} release artifact`,
    artifactId: `launch-${requirement.id}-2026-05-28`,
    artifactDigestOrVersion: `sha256:${launchArtifactDigestByRequirement[requirement.id]}`,
    targetChannel: `${requirementContext} ${requirement.group} target release channel`,
    claimBoundary: requirement.group,
    evidenceLink: `https://release-evidence.astra-cdn.net/launch-artifacts/${requirement.id}.md`,
    ownerDate: "release-owner@astra.ai — 2026-05-28",
    environment: `${requirementContext} ${requirement.group} target release channel`,
  }
})

const EXPECTED_MANUAL_QA_ROWS: Record<number, string[]> = Object.fromEntries(
  ASTRA_MACRO_MANUAL_QA_REQUIREMENTS.map((requirement) => [requirement.section, requirement.qaRows]),
)

function manualQaEnvironmentFor(section: number): string {
  const sectionContext = (() => {
    switch (section) {
      case 6:
        return "Library source-return/delete/export asset walkthrough"
      case 7:
        return "personalization Privacy Mode Options Review walkthrough"
      case 13:
        return "onboarding popup Deep Read Library error copy walkthrough"
      case 14:
        return "support help status incident report walkthrough"
      case 24:
        return "AI provider fixture scoring triage trend decision walkthrough"
      case 32:
        return "accessibility keyboard screen reader contrast scaled text reduced motion walkthrough"
      default:
        return "manual QA walkthrough"
    }
  })()
  return `Chrome extension target build on macOS — ${sectionContext}`
}

const completeManualQaRows = ASTRA_MACRO_MANUAL_QA_REQUIREMENTS.flatMap((requirement) =>
  requirement.qaRows.map((qaRow) => ({
    section: requirement.section,
    qaRow,
    ownerDate: "qa-owner@astra.ai — 2026-05-28",
    environment: manualQaEnvironmentFor(requirement.section),
    evidenceLink: `https://release-evidence.astra-cdn.net/manual-qa/section-${requirement.section}-${qaRow.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`,
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
    expect(rcPacket).toContain("evaluateAstraProductMetricsReadiness()")
    expect(rcPacket).toContain("docs/reviews/macro-production-metrics-export-packet-2026-05-28.json")
    expect(rcPacket).toContain("docs/reviews/macro-product-metrics-readiness-packet-2026-05-28.json")
    expect(rcPacket).toContain("docs/reviews/production-metrics-export-evidence-note-2026-05-28.md")
  })

  it("keeps the structured final evidence packet placeholders machine-readable and intentionally empty", () => {
    const ciPacket = JSON.parse(readFileSync("docs/reviews/macro-ci-artifact-packet-2026-05-28.json", "utf8")) as { schema: string; label: string; rows: unknown[] }
    const approvalPacket = JSON.parse(readFileSync("docs/reviews/macro-owner-release-approval-packet-2026-05-28.json", "utf8")) as {
      schema: string
      label: string
      approval: { decision: string; reviewedArtifacts: unknown[] }
    }
    const launchPacket = JSON.parse(readFileSync("docs/reviews/macro-launch-artifact-packet-2026-05-28.json", "utf8")) as { schema: string; label: string; rows: unknown[] }
    const aiQualityPacket = JSON.parse(readFileSync("docs/reviews/macro-ai-quality-human-scored-packet-2026-05-28.json", "utf8")) as {
      schema: string
      label: string
      evidence: { reviewer: string; environment: string; summary: { reproducible: boolean } }
    }
    const metricsPacket = JSON.parse(readFileSync("docs/reviews/macro-production-metrics-export-packet-2026-05-28.json", "utf8")) as { schema: string; label: string; rows: unknown[] }
    const metricsReadinessPacket = JSON.parse(readFileSync("docs/reviews/macro-product-metrics-readiness-packet-2026-05-28.json", "utf8")) as {
      schema: string
      label: string
      evidence: { telemetryAvoidsSensitiveRawText: boolean; userDataControlsAreClear: boolean }
    }

    for (const packet of [ciPacket, approvalPacket, launchPacket, aiQualityPacket, metricsPacket, metricsReadinessPacket]) {
      expect(packet.label).toMatch(/\bintake$/i)
    }

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
    expect(metricsReadinessPacket.schema).toBe("astra-macro-product-metrics-readiness-packet.v1")
    expect(metricsReadinessPacket.evidence.telemetryAvoidsSensitiveRawText).toBe(false)
    expect(metricsReadinessPacket.evidence.userDataControlsAreClear).toBe(false)
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
    const evidenceReferenceHelper = readFileSync("src/utils/evidence-reference.ts", "utf8")
    const macroOperationalEvidenceSource = readFileSync("src/utils/macro-operational-evidence.ts", "utf8")

    expect(checker).toContain("from \"../../src/utils/evidence-reference\"")
    expect(checker).toContain("evidenceReferenceDuplicateIdentity,")
    expect(checker).toContain("isEvidenceLikeReference,")
    expect(checker).toContain("isRepoArtifactPathReference,")
    expect(checker).not.toContain("function hasUnsafeReferenceCharacters")
    expect(checker).not.toContain("function hasUnsafeEncodedReferenceCharacters")
    expect(evidenceReferenceHelper).toContain("export function hasUnsafeReferenceCharacters")
    expect(evidenceReferenceHelper).toContain("export function hasUnsafeEncodedReferenceCharacters")
    expect(evidenceReferenceHelper).toContain("export function isEvidenceLikeReference")
    expect(evidenceReferenceHelper).toContain("export function evidenceReferenceDuplicateIdentity")
    expect(evidenceReferenceHelper).toContain("function normalizeUrlComponentForDuplicateIdentity")
    expect(evidenceReferenceHelper).toContain("encodedValue.toUpperCase()")
    expect(evidenceReferenceHelper).toContain("/^[a-z0-9_-]$/i.test(character) || character === \"~\"")
    expect(evidenceReferenceHelper).toContain("export function isRepoArtifactPathReference")
    expect(evidenceReferenceHelper).toContain("export function isPublicHttpsEvidenceUrl")
    expect(evidenceReferenceHelper).toContain("function isLocalUrlReference")
    expect(evidenceReferenceHelper).toContain("function parseIpv6Hextets")
    expect(evidenceReferenceHelper).toContain("function isIpv6Prefix")
    expect(evidenceReferenceHelper).toContain("isIpv6Prefix(hextets, [0x0064, 0xff9b, 0, 0, 0, 0])")
    expect(evidenceReferenceHelper).toContain("isIpv6Prefix(hextets, [0x0064, 0xff9b, 0x0001])")
    expect(evidenceReferenceHelper).toContain("isIpv6Prefix(hextets, [0x0100, 0, 0, 0])")
    expect(evidenceReferenceHelper).toContain("isIpv6Prefix(hextets, [0x2001, 0])")
    expect(evidenceReferenceHelper).toContain("isIpv6Prefix(hextets, [0x2001, 0x0002, 0])")
    expect(evidenceReferenceHelper).toContain("isIpv6Prefix(hextets, [0x2001, 0x0db8])")
    expect(evidenceReferenceHelper).toContain("hextets[0] === 0x2002")
    expect(evidenceReferenceHelper).not.toContain("/^(?:100:|2001(?:::|:0:)|2001:2:|2001:db8:|2002:)/i.test(normalizedHostname)")

    expect(checker).toContain("artifact.evidenceLinks.${key}[${index}]: expected URL or repo artifact path.")
    expect(checker).toContain("else if (!isEvidenceLikeReference(link))")
    expect(checker).toContain("validateExistingEvidenceReference(link, `artifact.evidenceLinks.${key}[${index}]`, findings)")
    expect(checker).toContain("validateExistingEvidenceReference(artifact, `ownerReleaseApprovalPacket.reviewedArtifacts.${artifact}`, findings)")
    expect(checker).toContain("const expectedReviewedArtifactsByIdentity = new Map")
    expect(checker).toContain("const artifactIdentity = evidenceReferenceDuplicateIdentity(artifact)")
    expect(checker).toContain("reviewed artifact must use canonical path without surrounding whitespace")
    expect(checker).toContain("seenReviewedArtifacts.has(artifactIdentity)")
    expect(checker).toContain("area id must use canonical casing without surrounding whitespace")
    expect(checker).toContain("const areaIdIdentity = normalizedAreaId.toLowerCase()")
    expect(checker).toContain("seenAreaIds.has(areaIdIdentity)")
    expect(checker).toContain("evidence field must use canonical casing without surrounding whitespace")
    expect(checker).toContain("const evidenceFieldIdentity = normalizedEvidenceField.toLowerCase()")
    expect(checker).toContain("seenEvidenceFields.has(evidenceFieldIdentity)")
    expect(checker).toContain("requirement id must use canonical casing without surrounding whitespace")
    expect(checker).toContain("const requirementIdIdentity = normalizedRequirementId.toLowerCase()")
    expect(checker).toContain("seenRequirementIds.has(requirementIdIdentity)")
    expect(checker).toContain("category must use canonical casing without surrounding whitespace")
    expect(checker).toContain("const categoryIdentity = normalizedCategory.toLowerCase()")
    expect(checker).toContain("seenCategories.has(categoryIdentity)")
    expect(checker).toContain("manual QA row text must use canonical casing without surrounding whitespace")
    expect(checker).toContain("const rowIdentity = `${row.section}\\u0000${normalizedQaRow.toLowerCase()}`")
    expect(checker).toContain("seenRows.has(rowIdentity)")
    expect(checker).toContain("expected a matching machine-readable packet path")
    expect(checker).toContain("function evidenceLinkMatchesRequiredPath")
    expect(checker).toContain("return isRepoArtifactPathReference(link) && link === requiredPath")
    expect(checker).toContain('import { existsSync } from "node:fs"')
    expect(checker).toContain("const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), \"../..\")")
    expect(checker).toContain("function repoArtifactPathExists")
    expect(checker).toContain("existsSync(repoPath(value))")
    expect(checker).toContain("readFile(repoPath(FINAL_COMPLETION_EVIDENCE_PATH), \"utf8\")")
    expect(checker).toContain("type EvidenceReferenceOptions")
    expect(checker).toContain("function validateExistingEvidenceReference")
    expect(checker).toContain("function validatePacketLabel")
    expect(checker).toContain("function isUnattemptedIntakeLabel")
    expect(checker).toContain("function packetLabelIndicatesAttemptedEvidence")
    expect(checker).toContain("packet.rows.length > 0 || packetLabelIndicatesAttemptedEvidence(packet.label)")
    expect(checker).toContain("expected a canonical non-placeholder label")
    expect(checker).toContain('validatePacketLabel(value.label, "artifact.label", findings, FINAL_COMPLETION_EVIDENCE_PATH)')
    expect(checker).toContain('validatePacketLabel(value.label, "ciArtifactPacket.label", findings, CI_ARTIFACT_PACKET_PATH)')
    expect(checker).toContain("options: EvidenceReferenceOptions = {}")
    expect(checker).toContain("if (value.trim().length === 0 || !isEvidenceLikeReference(value, options)) return")
    expect(checker).toContain("isRepoArtifactPathReference(value, options)")
    expect(checker).toContain(": repo artifact path does not exist.")
    expect(evidenceReferenceHelper).toContain("const encodedSequences = value.match(/(?:%[0-9a-f]{2})+/gi) ?? []")
    expect(evidenceReferenceHelper).toContain("const decodedSequence = decodeURIComponent(sequence)")
    expect(evidenceReferenceHelper).toContain("hasUnsafeReferenceCharacters(decodedSequence)")
    expect(evidenceReferenceHelper).toContain("hasUnsafeEncodedReferenceCharacters(decodedSequence, options)")
    expect(evidenceReferenceHelper).toContain("const code = character.codePointAt(0) ?? 0")
    expect(evidenceReferenceHelper).toContain("return code <= 32 || code >= 127 || /[\\p{Separator}\\p{Other}]/u.test(character)")
    expect(evidenceReferenceHelper).toContain("/%(?:0[0-9a-f]|1[0-9a-f]|20|7f|2e|2f|5c)/i")
    expect(evidenceReferenceHelper).toContain("allowEncodedStructuralUrlQueryChars")
    expect(evidenceReferenceHelper).toContain("hasUnsafeEncodedReferenceCharacters(url.pathname)")
    expect(evidenceReferenceHelper).toContain("function hasRawUrlPathDotSegments")
    expect(evidenceReferenceHelper).toContain("/^https?:\\/\\//i.test(trimmedValue)")
    expect(evidenceReferenceHelper).toContain("trimmedValue !== value")
    expect(evidenceReferenceHelper).toContain("function hasPlaceholderEvidenceReferenceKeyword")
    expect(evidenceReferenceHelper).toContain("sample|fake|dummy|latest|dev|local")
    expect(evidenceReferenceHelper).toContain("proof|evidence|artifact|report")
    expect(macroOperationalEvidenceSource).toContain("(?:fake|dummy|latest|dev|local)[-_ ]?(?:proof|evidence|artifact|report)")
    expect(macroOperationalEvidenceSource).toContain("(?<!provider[-_ ])sample[-_ ]?(?:proof|evidence|artifact|report)")
    expect(checker).toContain("(?:fake|dummy|latest|dev|local)[-_ ]?(?:proof|evidence|artifact|report)")
    expect(checker).toContain("(?<!provider[-_ ])sample[-_ ]?(?:proof|evidence|artifact|report)")
    expect(evidenceReferenceHelper).toContain('segment !== ".."')
    expect(evidenceReferenceHelper).toContain('!segment.startsWith(".")')
    expect(evidenceReferenceHelper).toContain('value.includes("#")')
    expect(evidenceReferenceHelper).toContain('value.includes("%")')
    expect(evidenceReferenceHelper).toContain('url.protocol === "https:"')
    expect(evidenceReferenceHelper).toContain('url.username.length === 0')
    expect(evidenceReferenceHelper).toContain('url.password.length === 0')
    expect(evidenceReferenceHelper).toContain("!isNonCanonicalIpv4Hostname(trimmedValue, url.hostname)")
    expect(evidenceReferenceHelper).toContain("function isNonCanonicalIpv4Hostname")
    expect(evidenceReferenceHelper).toContain("function extractRawUrlHostname")
    expect(evidenceReferenceHelper).toContain('new URL(value).hostname.toLowerCase().replace(/\\.+$/, "")')
    expect(evidenceReferenceHelper).toContain('const protocol = url.protocol.toLowerCase()')
    expect(evidenceReferenceHelper).toContain('!(protocol === "https:" && url.port === "443")')
    expect(evidenceReferenceHelper).toContain('hostname === "localhost"')
    expect(evidenceReferenceHelper).toContain("function isMalformedDnsHostname")
    expect(evidenceReferenceHelper).toContain("!isMalformedDnsHostname(url.hostname)")
    expect(evidenceReferenceHelper).toContain('label.length > 63')
    expect(evidenceReferenceHelper).toContain("/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)")
    expect(evidenceReferenceHelper).toContain("function isNonPublicDnsHostname")
    expect(evidenceReferenceHelper).toContain('parseIpv6Hextets(hostnameWithoutBrackets)')
    expect(evidenceReferenceHelper).toContain('!hostname.includes(".")')
    expect(evidenceReferenceHelper).toContain('hostname === "local"')
    expect(evidenceReferenceHelper).toContain('hostname.endsWith(".local")')
    expect(evidenceReferenceHelper).toContain('hostname === "test"')
    expect(evidenceReferenceHelper).toContain('hostname.endsWith(".test")')
    expect(evidenceReferenceHelper).toContain('hostname === "invalid"')
    expect(evidenceReferenceHelper).toContain('hostname.endsWith(".invalid")')
    expect(evidenceReferenceHelper).toContain('hostname === "internal"')
    expect(evidenceReferenceHelper).toContain('hostname.endsWith(".internal")')
    expect(evidenceReferenceHelper).toContain('hostname === "onion"')
    expect(evidenceReferenceHelper).toContain('hostname.endsWith(".onion")')
    expect(evidenceReferenceHelper).toContain('hostname === "home.arpa"')
    expect(evidenceReferenceHelper).toContain('hostname.endsWith(".home.arpa")')
    expect(evidenceReferenceHelper).toContain("function isReservedDocumentationDnsHostname")
    expect(macroOperationalEvidenceSource).toContain("return value === \"success\"")
    expect(macroOperationalEvidenceSource).toContain("CI workflow name is placeholder evidence or not canonical")
    expect(macroOperationalEvidenceSource).toContain("evidence.approver.trim() !== evidence.approver")
    expect(checker).toContain("value.trim() !== value || !includesIsoDate(value)")
    expect(checker).toContain("target commit/SHA")
    expect(checker).not.toContain("const trimmedValue = value.trim()\n  return /^[a-f0-9]{7,40}$/i.test(trimmedValue)")
    expect(evidenceReferenceHelper).toContain('hostname === "example.com"')
    expect(evidenceReferenceHelper).toContain('hostname.endsWith(".example.com")')
    expect(evidenceReferenceHelper).toContain('hostname === "example.net"')
    expect(evidenceReferenceHelper).toContain('hostname === "example.org"')
    expect(evidenceReferenceHelper).toContain('hostname.endsWith(".example")')
    expect(evidenceReferenceHelper).toContain("const ipv4Octets = parseIpv4Hostname(hostname)")
    expect(evidenceReferenceHelper).toContain("function isNonPublicIpv4Octets")
    expect(evidenceReferenceHelper).toContain("first === 100 && second >= 64 && second <= 127")
    expect(evidenceReferenceHelper).toContain("first === 198 && (second === 18 || second === 19 || (second === 51 && third === 100))")
    expect(evidenceReferenceHelper).toContain("first === 192 && (second === 168 || (second === 0 && (third === 0 || third === 2)) || (second === 88 && third === 99))")
    expect(evidenceReferenceHelper).toContain("first === 203 && second === 0 && third === 113")
    expect(evidenceReferenceHelper).toContain("first >= 224")
    expect(evidenceReferenceHelper).toContain("function isPrivateIpv4MappedIpv6Hostname")
    expect(evidenceReferenceHelper).toContain("/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i")
    expect(checker).not.toContain("pathname.endsWith")
    expect(checker).toContain("const normalizedLink = link.trim()")
    expect(checker).toContain("const duplicateIdentity = evidenceReferenceDuplicateIdentity(link)")
    expect(checker).toContain("seenLinks.has(duplicateIdentity)")
    expect(checker).toContain("seenLinks.add(duplicateIdentity)")
    expect(checker).toContain("crossFieldEvidenceLinks.get(duplicateIdentity)")
    expect(checker).toContain("fieldsCanShareEvidenceLinkIdentity(existingField, key, duplicateIdentity)")
    expect(checker).toContain("function fieldRequiresEvidenceLinkIdentity")
    expect(checker).toContain("function fieldAllowsEvidenceLink")
    expect(checker).toContain("unexpected evidence link for ${key}; top-level links must be the required machine-readable packet paths")
    expect(checker).toContain('console.log(`Complete: ${valid && decision.complete ? "yes" : "no"}`)')
    expect(checker).not.toContain('console.log(`Complete: ${decision.complete ? "yes" : "no"}`)')
    expect(checker).not.toContain("else if (!isEvidenceLikeReference(normalizedLink))")
    expect(checker).not.toContain("return isRepoArtifactPathReference(trimmedLink) && trimmedLink === requiredPath")
    expect(checker).not.toContain("existsSync(trimmedValue)")
    expect(checker).not.toContain("link.includes(requiredPath)")
    expect(checker).not.toContain("REQUIRED_EVIDENCE_LINK_PATTERNS")
    expect(checker).not.toContain("expected at least one link matching")
    expect(checker).not.toContain("function isRepoArtifactPathReference")
    expect(checker).not.toContain("function isPublicHttpsEvidenceUrl")
    expect(checker).not.toContain("function isLocalUrlReference")
    expect(checker).not.toContain("function parseIpv6Hextets")
    expect(checker).not.toContain("function isIpv6Prefix")
    expect(checker).toContain("validateExistingEvidenceReference(\n    packet.evidence.fixtureManifestPath,")
    expect(checker).toContain("\"aiQualityHumanScoredPacket.evidence.fixtureManifestPath\",\n    findings,\n    { allowTestFixtures: true },")
  })

  it("runs the final completion checker from a non-root working directory", () => {
    const tempCwd = mkdtempSync(`${tmpdir()}/astra-final-check-`)
    const output = execFileSync(
      resolve("node_modules/.bin/tsx"),
      [resolve("script/maintenance/check-macro-final-completion.ts")],
      { cwd: tempCwd, encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } },
    )

    expect(output).toContain("Macro final completion check: valid=yes")
    expect(output).toContain("Complete: no")
    expect(output).toContain("Blocker count: 8")
    expect(output).not.toContain("repo artifact path does not exist")
  })

  it("rejects duplicate JSON object keys before final evidence packet coercion", () => {
    const packetPath = "docs/reviews/macro-ai-quality-human-scored-packet-2026-05-28.json"
    const originalPacket = readFileSync(packetPath, "utf8")
    const duplicateKeyPackets = [
      originalPacket.replace(
        '    "releaseDecision": null,',
        '    "releaseDecision": "block",\n    "releaseDecision": null,',
      ),
      originalPacket.replace(
        '    "releaseDecision": null,',
        '    "release\\u0044ecision": "block",\n    "releaseDecision": null,',
      ),
    ]

    try {
      for (const duplicateKeyPacket of duplicateKeyPackets) {
        writeFileSync(packetPath, duplicateKeyPacket)
        let output = ""
        try {
          execFileSync(
            resolve("node_modules/.bin/tsx"),
            [resolve("script/maintenance/check-macro-final-completion.ts")],
            { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } },
          )
        } catch (error) {
          const result = error as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number }
          output = `${result.stdout ?? ""}${result.stderr ?? ""}`
          expect(result.status).toBe(1)
        }

        expect(output).toContain("macro-ai-quality-human-scored-packet-2026-05-28.json: duplicate JSON object key `releaseDecision`.")
      }
    } finally {
      writeFileSync(packetPath, originalPacket)
    }
  })

  it("rejects unrelated extra links on true top-level final evidence fields", () => {
    const artifactPath = "docs/reviews/macro-final-completion-evidence-2026-05-28.json"
    const originalArtifact = readFileSync(artifactPath, "utf8")
    const artifact = JSON.parse(originalArtifact) as MacroFinalCompletionEvidenceArtifact
    artifact.evidence = {
      ...emptyFinalCompletionEvidence,
      ciQualityArtifactsAttached: true,
    }
    artifact.evidenceLinks = FINAL_COMPLETION_EVIDENCE_KEYS.reduce((evidenceLinks, key) => {
      evidenceLinks[key] = []
      return evidenceLinks
    }, {} as MacroFinalCompletionEvidenceArtifact["evidenceLinks"])
    artifact.evidenceLinks.ciQualityArtifactsAttached = [
      "docs/reviews/macro-ci-artifact-packet-2026-05-28.json",
      "https://release-evidence.astra-cdn.net/final-evidence/ci-quality-extra-proof.md",
    ]

    try {
      writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
      let output = ""
      try {
        execFileSync(
          resolve("node_modules/.bin/tsx"),
          [resolve("script/maintenance/check-macro-final-completion.ts")],
          { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } },
        )
      } catch (error) {
        const result = error as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number }
        output = `${result.stdout ?? ""}${result.stderr ?? ""}`
        expect(result.status).toBe(1)
      }

      expect(output).toContain("artifact.evidenceLinks.ciQualityArtifactsAttached[1]: unexpected evidence link for ciQualityArtifactsAttached; top-level links must be the required machine-readable packet paths.")
    } finally {
      writeFileSync(artifactPath, originalArtifact)
    }
  })

  it("rejects top-level final evidence links reused across unrelated final evidence fields", () => {
    const artifactPath = "docs/reviews/macro-final-completion-evidence-2026-05-28.json"
    const originalArtifact = readFileSync(artifactPath, "utf8")
    const artifact = JSON.parse(originalArtifact) as MacroFinalCompletionEvidenceArtifact
    const sharedEvidenceLink = "https://release-evidence.astra-cdn.net/final-evidence/shared-manual-launch-proof.md"
    artifact.evidence = {
      ...emptyFinalCompletionEvidence,
      manualQaChecklistComplete: true,
      billingLegalStoreGtmArtifactsAttached: true,
    }
    artifact.evidenceLinks = FINAL_COMPLETION_EVIDENCE_KEYS.reduce((evidenceLinks, key) => {
      evidenceLinks[key] = []
      return evidenceLinks
    }, {} as MacroFinalCompletionEvidenceArtifact["evidenceLinks"])
    artifact.evidenceLinks.manualQaChecklistComplete = [
      "docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md",
      sharedEvidenceLink,
    ]
    artifact.evidenceLinks.billingLegalStoreGtmArtifactsAttached = [
      "docs/reviews/macro-launch-artifact-packet-2026-05-28.json",
      sharedEvidenceLink,
    ]

    try {
      writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
      let output = ""
      try {
        execFileSync(
          resolve("node_modules/.bin/tsx"),
          [resolve("script/maintenance/check-macro-final-completion.ts")],
          { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } },
        )
      } catch (error) {
        const result = error as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number }
        output = `${result.stdout ?? ""}${result.stderr ?? ""}`
        expect(result.status).toBe(1)
      }

      expect(output).toContain("artifact.evidenceLinks.billingLegalStoreGtmArtifactsAttached[1]: duplicate evidence link already used by manualQaChecklistComplete.")
    } finally {
      writeFileSync(artifactPath, originalArtifact)
    }
  })

  it("rejects globally shared required packet links when reused by fields that do not require them", () => {
    const artifactPath = "docs/reviews/macro-final-completion-evidence-2026-05-28.json"
    const originalArtifact = readFileSync(artifactPath, "utf8")
    const artifact = JSON.parse(originalArtifact) as MacroFinalCompletionEvidenceArtifact
    const sharedCiPacketLink = "docs/reviews/macro-ci-artifact-packet-2026-05-28.json"
    artifact.evidence = {
      ...emptyFinalCompletionEvidence,
      ciQualityArtifactsAttached: true,
      manualQaChecklistComplete: true,
    }
    artifact.evidenceLinks = FINAL_COMPLETION_EVIDENCE_KEYS.reduce((evidenceLinks, key) => {
      evidenceLinks[key] = []
      return evidenceLinks
    }, {} as MacroFinalCompletionEvidenceArtifact["evidenceLinks"])
    artifact.evidenceLinks.ciQualityArtifactsAttached = [sharedCiPacketLink]
    artifact.evidenceLinks.manualQaChecklistComplete = [
      "docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md",
      sharedCiPacketLink,
    ]

    try {
      writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
      let output = ""
      try {
        execFileSync(
          resolve("node_modules/.bin/tsx"),
          [resolve("script/maintenance/check-macro-final-completion.ts")],
          { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } },
        )
      } catch (error) {
        const result = error as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number }
        output = `${result.stdout ?? ""}${result.stderr ?? ""}`
        expect(result.status).toBe(1)
      }

      expect(output).toContain("artifact.evidenceLinks.manualQaChecklistComplete[1]: duplicate evidence link already used by ciQualityArtifactsAttached.")
    } finally {
      writeFileSync(artifactPath, originalArtifact)
    }
  })

  it("keeps the final checker strict for manual QA checklist operative table rows", () => {
    const checker = readFileSync("script/maintenance/check-macro-final-completion.ts", "utf8")

    expect(checker).toContain("function manualQaChecklistDataLines")
    expect(checker).toContain("let activeFenceMarker: string | null = null")
    expect(checker).toContain("const fenceMatch = /^(?<marker>`{3,}|~{3,})/.exec(trimmedLine)")
    expect(checker).toContain("activeFenceMarker = marker")
    expect(checker).toContain("marker[0] === activeFenceMarker[0] && marker.length >= activeFenceMarker.length")
    expect(checker).toContain("activeFenceMarker !== null")
    expect(checker).toContain('trimmedLine.startsWith(\">")')
    expect(checker).toContain("let activeSection: number | null = null")
    expect(checker).toContain("const sectionMatch = /^## Section (?<section>\\d+)\\b/.exec(trimmedLine)")
    expect(checker).toContain("activeSection = Number(sectionMatch.groups.section)")
    expect(checker).toContain("activeSection !== null && line.startsWith(\"| \")")
    expect(checker).toContain("return manualQaChecklistDataLines(markdown)")
    expect(checker).toContain("function manualQaRowContextMatches")
    expect(checker).toContain("isSpecificManualQaEnvironment(row.environment, row.section, row.qaRow)")
    expect(checker).not.toContain('.split("\\n## Section ")')
    expect(checker).not.toContain('.split("\\n")\n        .filter((line) => line.startsWith("| ")')
  })

  it("rejects final evidence intake requirements hidden only in comments", () => {
    const intakePath = "docs/reviews/macro-final-evidence-intake-2026-05-28.md"
    const originalIntake = readFileSync(intakePath, "utf8")
    const requiredTerm = "Semantic evidence requirements are enforced by parsing the machine-readable packet/checklist"
    const replacement = "Semantic evidence requirements are enforced by visible packet evaluator requirements"

    try {
      writeFileSync(intakePath, `${originalIntake.replace(requiredTerm, replacement)}\n<!-- ${requiredTerm} -->\n`)
      let output = ""
      try {
        execFileSync(
          resolve("node_modules/.bin/tsx"),
          [resolve("script/maintenance/check-macro-final-completion.ts")],
          { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } },
        )
      } catch (error) {
        const result = error as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number }
        output = `${result.stdout ?? ""}${result.stderr ?? ""}`
        expect(result.status).toBe(1)
      }

      expect(output).toContain(`docs/reviews/macro-final-evidence-intake-2026-05-28.md: missing required intake term \`${requiredTerm}\`.`)
    } finally {
      writeFileSync(intakePath, originalIntake)
    }
  })

  it("rejects final evidence intake requirements hidden only in link metadata", () => {
    const intakePath = "docs/reviews/macro-final-evidence-intake-2026-05-28.md"
    const originalIntake = readFileSync(intakePath, "utf8")
    const requiredTerm = "Semantic evidence requirements are enforced by parsing the machine-readable packet/checklist"
    const replacement = "Semantic evidence requirements are enforced by visible packet evaluator requirements"

    try {
      writeFileSync(
        intakePath,
        `${originalIntake.replace(requiredTerm, replacement)}\n[release evidence](https://release-evidence.astra-cdn.net/intake \"${requiredTerm}\")\n`,
      )
      let output = ""
      try {
        execFileSync(
          resolve("node_modules/.bin/tsx"),
          [resolve("script/maintenance/check-macro-final-completion.ts")],
          { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } },
        )
      } catch (error) {
        const result = error as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number }
        output = `${result.stdout ?? ""}${result.stderr ?? ""}`
        expect(result.status).toBe(1)
      }

      expect(output).toContain(`docs/reviews/macro-final-evidence-intake-2026-05-28.md: missing required intake term \`${requiredTerm}\`.`)
    } finally {
      writeFileSync(intakePath, originalIntake)
    }
  })

  it("keeps the final checker strict for final evidence intake visible text", () => {
    const checker = readFileSync("script/maintenance/check-macro-final-completion.ts", "utf8")

    expect(checker).toContain("function renderedMarkdownLineText")
    expect(checker).toContain("function visibleMarkdownText")
    expect(checker).toContain("const visibleText = visibleMarkdownText(markdown)")
    expect(checker).toContain("!visibleText.includes(`\\`${key}\\``)")
    expect(checker).toContain("!visibleText.includes(term)")
    expect(checker).toContain("/^\\s{0,3}\\[[^\\]]+\\]:\\s+\\S+/")
    expect(checker).toContain(".replace(/!\\[([^\\]]*)\\]\\((?:\\\\.|[^\\\\)])*\\)/g, \"$1\")")
    expect(checker).toContain(".replace(/\\[([^\\]]+)\\]\\((?:\\\\.|[^\\\\)])*\\)/g, \"$1\")")
    expect(checker).toContain('trimmedLine.startsWith("<!--")')
    expect(checker).toContain('trimmedLine.startsWith(\">")')
    expect(checker).toContain("activeFenceMarker !== null")
  })

  it("rejects product metrics readiness evidence that reuses production export or privacy artifacts", () => {
    const exportPacketPath = "docs/reviews/macro-production-metrics-export-packet-2026-05-28.json"
    const readinessPacketPath = "docs/reviews/macro-product-metrics-readiness-packet-2026-05-28.json"
    const originalExportPacket = readFileSync(exportPacketPath, "utf8")
    const originalReadinessPacket = readFileSync(readinessPacketPath, "utf8")
    const sharedEvidenceLink = "https://release-evidence.astra-cdn.net/metrics/activation.csv"

    try {
      writeFileSync(exportPacketPath, `${JSON.stringify({
        schema: "astra-macro-production-metrics-export-packet.v1",
        generatedAt: "2026-05-28T00:00:00.000Z",
        label: "Macro production metrics export packet — 2026-05-28 final production evidence",
        rows: [
          {
            category: "activation",
            dateRange: "2026-05-28..2026-05-28",
            cohortDefinition: "target RC cohort for current commit",
            dashboardOrQuerySource: "warehouse.activation_metrics_v1",
            exportId: "metrics-activation-2026-05-28",
            exportedAt: "2026-05-28T00:00:00.000Z",
            exportDigest: "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            queryVersion: "astra-production-metrics-query.v1",
            metricIds: [],
            evidenceLink: sharedEvidenceLink,
            ownerDate: "metrics-owner@astra.ai — 2026-05-28",
            privacyReviewLink: "https://release-evidence.astra-cdn.net/metrics/activation-privacy-review",
          },
        ],
      }, null, 2)}\n`)
      writeFileSync(readinessPacketPath, `${JSON.stringify({
        schema: "astra-macro-product-metrics-readiness-packet.v1",
        generatedAt: "2026-05-28T00:00:00.000Z",
        label: "Macro product metrics readiness packet — 2026-05-28 final production readiness",
        ownerDate: "metrics-owner@astra.ai — 2026-05-28",
        evidenceLink: sharedEvidenceLink,
        evidence: {
          productQuestionsHaveMetricCoverage: true,
          activationMetricsCovered: true,
          understandingMetricsCovered: true,
          learningMetricsCovered: true,
          membershipMetricsCovered: true,
          telemetryAvoidsSensitiveRawText: true,
          telemetryPrefersEventsOverContent: true,
          privacyModeReducesTelemetryDetail: true,
          userDataControlsAreClear: true,
        },
      }, null, 2)}\n`)

      let output = ""
      try {
        execFileSync(
          resolve("node_modules/.bin/tsx"),
          [resolve("script/maintenance/check-macro-final-completion.ts")],
          { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } },
        )
      } catch (error) {
        const result = error as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number }
        output = `${result.stdout ?? ""}${result.stderr ?? ""}`
        expect(result.status).toBe(1)
      }

      expect(output).toContain("productMetricsReadinessPacket.evidenceLink: readiness evidence must be distinct from productionMetricsExportPacket.rows.activation.evidenceLink.")
    } finally {
      writeFileSync(exportPacketPath, originalExportPacket)
      writeFileSync(readinessPacketPath, originalReadinessPacket)
    }
  })

  it("rejects generic product metrics readiness evidence links even when readiness booleans are all true", () => {
    const readinessPacketPath = "docs/reviews/macro-product-metrics-readiness-packet-2026-05-28.json"
    const originalReadinessPacket = readFileSync(readinessPacketPath, "utf8")

    try {
      writeFileSync(readinessPacketPath, `${JSON.stringify({
        schema: "astra-macro-product-metrics-readiness-packet.v1",
        generatedAt: "2026-05-28T00:00:00.000Z",
        label: "Macro product metrics readiness packet — 2026-05-28 final production readiness",
        ownerDate: "metrics-owner@astra.ai — 2026-05-28",
        evidenceLink: "docs/reviews/macro-final-evidence-intake-2026-05-28.md",
        evidence: {
          productQuestionsHaveMetricCoverage: true,
          activationMetricsCovered: true,
          understandingMetricsCovered: true,
          learningMetricsCovered: true,
          membershipMetricsCovered: true,
          telemetryAvoidsSensitiveRawText: true,
          telemetryPrefersEventsOverContent: true,
          privacyModeReducesTelemetryDetail: true,
          userDataControlsAreClear: true,
        },
      }, null, 2)}\n`)

      let output = ""
      try {
        execFileSync(
          resolve("node_modules/.bin/tsx"),
          [resolve("script/maintenance/check-macro-final-completion.ts")],
          { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } },
        )
      } catch (error) {
        const result = error as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number }
        output = `${result.stdout ?? ""}${result.stderr ?? ""}`
        expect(result.status).toBe(1)
      }

      expect(output).toContain("productMetricsReadinessPacket.evidenceLink: attempted readiness evidence link must identify product metrics readiness evidence and target release context.")
    } finally {
      writeFileSync(readinessPacketPath, originalReadinessPacket)
    }
  })

  it("keeps the final checker strict for product metrics readiness before final metric claims", () => {
    const checker = readFileSync("script/maintenance/check-macro-final-completion.ts", "utf8")

    expect(checker).toContain("const productMetricsReadinessPacket = validateProductMetricsReadinessPacket")
    expect(checker).toContain("validateProductMetricsReadinessPacketPreclaim(productMetricsReadinessPacket, findings)")
    expect(checker).toContain("validateProductMetricsReadinessExportEvidenceDistinct(productionMetricsExportPacket, productMetricsReadinessPacket, findings)")
    expect(checker).toContain("readiness evidence must be distinct from productionMetricsExportPacket.rows")
    expect(checker).toContain("evaluateAstraProductMetricsReadiness(productMetricsReadinessPacket.evidence)")
    expect(checker).toContain("cannot be true until evaluateAstraProductMetricsReadiness() accepts the product metrics readiness packet")
    expect(checker).toContain("productMetricsReadinessPacket: attempted product metrics readiness evidence must satisfy evaluateAstraProductMetricsReadiness()")
    expect(checker).toContain('validateExactKeys(value, ["schema", "generatedAt", "label", "ownerDate", "evidenceLink", "evidence"], "productMetricsReadinessPacket", findings)')
    expect(checker).toContain("packetLabelIndicatesAttemptedEvidence(packet.label)")
    expect(checker).toContain("packet.ownerDate.trim().length > 0")
    expect(checker).toContain("productMetricsReadinessPacket.ownerDate: attempted readiness evidence must identify a real owner and include YYYY-MM-DD.")
    expect(checker).toContain("function isSpecificProductMetricsReadinessLabel")
    expect(checker).toContain("function hasProductMetricsReadinessContext")
    expect(checker).toContain("function productMetricsReadinessSemanticCandidates")
    expect(checker).toContain("namesProductMetricsReadiness")
    expect(checker).toContain("namesTargetReleaseContext")
    expect(checker).toContain("productMetricsReadinessPacket.label: attempted readiness evidence label must identify product metrics readiness and target release context.")
    expect(checker).toContain("productMetricsReadinessPacket.evidenceLink: attempted readiness evidence link must identify product metrics readiness evidence and target release context.")
    expect(checker).toContain("validateExistingEvidenceReference(packet.evidenceLink, \"productMetricsReadinessPacket.evidenceLink\", findings)")
    expect(checker).toContain("function isUuidReference")
    expect(checker).toContain("function isPrefixedNumericIdentityReference")
    expect(checker).toContain("/^[1-9]\\d{5,}$/.test(normalizedValue)")
    expect(checker).toContain("function isDateStampedIdentityReference")
    expect(checker).toContain("/^20\\d{2}-\\d{2}-\\d{2}$/.test(identityValue) && includesIsoDate(identityValue)")
  })

  it("rejects dated final evidence artifacts whose generatedAt date does not match the packet filename", () => {
    const artifactPath = "docs/reviews/macro-final-completion-evidence-2026-05-28.json"
    const originalArtifact = readFileSync(artifactPath, "utf8")
    const artifact = JSON.parse(originalArtifact) as MacroFinalCompletionEvidenceArtifact
    artifact.generatedAt = "2026-01-01T00:00:00.000Z"

    try {
      writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
      let output = ""
      try {
        execFileSync(
          resolve("node_modules/.bin/tsx"),
          [resolve("script/maintenance/check-macro-final-completion.ts")],
          { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } },
        )
      } catch (error) {
        const result = error as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number }
        output = `${result.stdout ?? ""}${result.stderr ?? ""}`
        expect(result.status).toBe(1)
      }

      expect(output).toContain("artifact.generatedAt: expected generatedAt date 2026-05-28 to match docs/reviews/macro-final-completion-evidence-2026-05-28.json.")
    } finally {
      writeFileSync(artifactPath, originalArtifact)
    }
  })

  it("rejects dated final evidence artifacts whose generatedAt timestamp is in the future", () => {
    const artifactPath = "docs/reviews/macro-final-completion-evidence-2026-05-28.json"
    const originalArtifact = readFileSync(artifactPath, "utf8")
    const artifact = JSON.parse(originalArtifact) as MacroFinalCompletionEvidenceArtifact
    artifact.generatedAt = "2099-01-01T00:00:00.000Z"

    try {
      writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
      let output = ""
      try {
        execFileSync(
          resolve("node_modules/.bin/tsx"),
          [resolve("script/maintenance/check-macro-final-completion.ts")],
          { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } },
        )
      } catch (error) {
        const result = error as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number }
        output = `${result.stdout ?? ""}${result.stderr ?? ""}`
        expect(result.status).toBe(1)
      }

      expect(output).toContain("artifact.generatedAt: generatedAt timestamp must not be in the future.")
    } finally {
      writeFileSync(artifactPath, originalArtifact)
    }
  })

  it("rejects dated subordinate evidence packets whose generatedAt date does not match the packet filename", () => {
    const packetPath = "docs/reviews/macro-product-metrics-readiness-packet-2026-05-28.json"
    const originalPacket = readFileSync(packetPath, "utf8")
    const packet = JSON.parse(originalPacket) as { generatedAt: string }
    packet.generatedAt = "2026-05-29T00:00:00.000Z"

    try {
      writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`)
      let output = ""
      try {
        execFileSync(
          resolve("node_modules/.bin/tsx"),
          [resolve("script/maintenance/check-macro-final-completion.ts")],
          { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } },
        )
      } catch (error) {
        const result = error as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number }
        output = `${result.stdout ?? ""}${result.stderr ?? ""}`
        expect(result.status).toBe(1)
      }

      expect(output).toContain("productMetricsReadinessPacket.generatedAt: expected generatedAt date 2026-05-28 to match docs/reviews/macro-product-metrics-readiness-packet-2026-05-28.json.")
    } finally {
      writeFileSync(packetPath, originalPacket)
    }
  })

  it("rejects dated subordinate evidence packets whose generatedAt timestamp is in the future", () => {
    const packetPath = "docs/reviews/macro-product-metrics-readiness-packet-2026-05-28.json"
    const originalPacket = readFileSync(packetPath, "utf8")
    const packet = JSON.parse(originalPacket) as { generatedAt: string }
    packet.generatedAt = "2099-01-01T00:00:00.000Z"

    try {
      writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`)
      let output = ""
      try {
        execFileSync(
          resolve("node_modules/.bin/tsx"),
          [resolve("script/maintenance/check-macro-final-completion.ts")],
          { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } },
        )
      } catch (error) {
        const result = error as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number }
        output = `${result.stdout ?? ""}${result.stderr ?? ""}`
        expect(result.status).toBe(1)
      }

      expect(output).toContain("productMetricsReadinessPacket.generatedAt: generatedAt timestamp must not be in the future.")
      expect(output).toContain("productMetricsReadinessPacket.generatedAt: expected generatedAt date 2026-05-28 to match docs/reviews/macro-product-metrics-readiness-packet-2026-05-28.json.")
    } finally {
      writeFileSync(packetPath, originalPacket)
    }
  })

  it("rejects evidence packet row dates after the packet generatedAt date", () => {
    const packetPath = "docs/reviews/macro-operational-evidence-completion-packet-2026-05-28.json"
    const originalPacket = readFileSync(packetPath, "utf8")
    const packet = JSON.parse(originalPacket) as {
      schema: string
      generatedAt: string
      label: string
      rows: Array<Record<string, unknown>>
    }
    packet.rows = [
      {
        areaId: "first_success_activation_evidence",
        ownerDate: "release-owner@astra.ai — 2026-05-29",
        environment: "target release candidate / production evidence packet",
        evidenceLink: "https://release-evidence.astra-cdn.net/operational-evidence/first-success.md",
        requirementEvidence: ASTRA_MACRO_OPERATIONAL_EVIDENCE[0].requiredBeforeStrongerClaim.join(" "),
        verdict: "proved",
      },
    ]

    try {
      writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`)
      let output = ""
      try {
        execFileSync(
          resolve("node_modules/.bin/tsx"),
          [resolve("script/maintenance/check-macro-final-completion.ts")],
          { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } },
        )
      } catch (error) {
        const result = error as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number }
        output = `${result.stdout ?? ""}${result.stderr ?? ""}`
        expect(result.status).toBe(1)
      }

      expect(output).toContain("operationalPacket.rows.first_success_activation_evidence.ownerDate: evidence date must not be after packet generatedAt date.")
    } finally {
      writeFileSync(packetPath, originalPacket)
    }
  })

  it("rejects evidence packet references with impossible ISO-like dates", () => {
    const packetPath = "docs/reviews/macro-operational-evidence-completion-packet-2026-05-28.json"
    const originalPacket = readFileSync(packetPath, "utf8")
    const packet = JSON.parse(originalPacket) as {
      schema: string
      generatedAt: string
      label: string
      rows: Array<Record<string, unknown>>
    }
    packet.rows = [
      {
        areaId: "first_success_activation_evidence",
        ownerDate: "release-owner@astra.ai — 2026-05-28",
        environment: "target release candidate / production evidence packet",
        evidenceLink: "https://release-evidence.astra-cdn.net/operational-evidence/first-success-2026-99-99.md",
        requirementEvidence: ASTRA_MACRO_OPERATIONAL_EVIDENCE[0].requiredBeforeStrongerClaim.join(" "),
        verdict: "proved",
      },
    ]

    try {
      writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`)
      let output = ""
      try {
        execFileSync(
          resolve("node_modules/.bin/tsx"),
          [resolve("script/maintenance/check-macro-final-completion.ts")],
          { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } },
        )
      } catch (error) {
        const result = error as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number }
        output = `${result.stdout ?? ""}${result.stderr ?? ""}`
        expect(result.status).toBe(1)
      }

      expect(output).toContain("operationalPacket.rows.first_success_activation_evidence.evidenceLink: evidence date must use real calendar YYYY-MM-DD values.")
    } finally {
      writeFileSync(packetPath, originalPacket)
    }
  })

  it("rejects evidence packet reference dates after the packet generatedAt date", () => {
    const packetPath = "docs/reviews/macro-operational-evidence-completion-packet-2026-05-28.json"
    const originalPacket = readFileSync(packetPath, "utf8")
    const packet = JSON.parse(originalPacket) as {
      schema: string
      generatedAt: string
      label: string
      rows: Array<Record<string, unknown>>
    }
    packet.rows = [
      {
        areaId: "first_success_activation_evidence",
        ownerDate: "release-owner@astra.ai — 2026-05-28",
        environment: "target release candidate / production evidence packet",
        evidenceLink: "https://release-evidence.astra-cdn.net/operational-evidence/2026-05-28/first-success-2026-05-29.md",
        requirementEvidence: ASTRA_MACRO_OPERATIONAL_EVIDENCE[0].requiredBeforeStrongerClaim.join(" "),
        verdict: "proved",
      },
    ]

    try {
      writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`)
      let output = ""
      try {
        execFileSync(
          resolve("node_modules/.bin/tsx"),
          [resolve("script/maintenance/check-macro-final-completion.ts")],
          { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } },
        )
      } catch (error) {
        const result = error as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number }
        output = `${result.stdout ?? ""}${result.stderr ?? ""}`
        expect(result.status).toBe(1)
      }

      expect(output).toContain("operationalPacket.rows.first_success_activation_evidence.evidenceLink: evidence date must not be after packet generatedAt date.")
    } finally {
      writeFileSync(packetPath, originalPacket)
    }
  })

  it("rejects dated final evidence artifacts whose label contains any stale date", () => {
    const artifactPath = "docs/reviews/macro-final-completion-evidence-2026-05-28.json"
    const originalArtifact = readFileSync(artifactPath, "utf8")
    const artifact = JSON.parse(originalArtifact) as MacroFinalCompletionEvidenceArtifact
    artifact.label = "Macro plan final completion gate — 2026-05-28 / stale 2099-01-01"

    try {
      writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
      let output = ""
      try {
        execFileSync(
          resolve("node_modules/.bin/tsx"),
          [resolve("script/maintenance/check-macro-final-completion.ts")],
          { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } },
        )
      } catch (error) {
        const result = error as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number }
        output = `${result.stdout ?? ""}${result.stderr ?? ""}`
        expect(result.status).toBe(1)
      }

      expect(output).toContain("artifact.label: expected label date 2026-05-28 to match docs/reviews/macro-final-completion-evidence-2026-05-28.json.")
    } finally {
      writeFileSync(artifactPath, originalArtifact)
    }
  })

  it("rejects dated final evidence artifacts whose label date does not match the packet filename", () => {
    const artifactPath = "docs/reviews/macro-final-completion-evidence-2026-05-28.json"
    const originalArtifact = readFileSync(artifactPath, "utf8")
    const artifact = JSON.parse(originalArtifact) as MacroFinalCompletionEvidenceArtifact
    artifact.label = "Macro plan final completion gate — 2026-01-01"

    try {
      writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`)
      let output = ""
      try {
        execFileSync(
          resolve("node_modules/.bin/tsx"),
          [resolve("script/maintenance/check-macro-final-completion.ts")],
          { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } },
        )
      } catch (error) {
        const result = error as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number }
        output = `${result.stdout ?? ""}${result.stderr ?? ""}`
        expect(result.status).toBe(1)
      }

      expect(output).toContain("artifact.label: expected label date 2026-05-28 to match docs/reviews/macro-final-completion-evidence-2026-05-28.json.")
    } finally {
      writeFileSync(artifactPath, originalArtifact)
    }
  })

  it("rejects filled manual QA rows with evidence dates after the checklist artifact date", () => {
    const checklistPath = "docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md"
    const originalChecklist = readFileSync(checklistPath, "utf8")
    const originalRow = "| Article source return | Open Library/Reading, search or filter to an article source, open detail, return to source, confirm source metadata remains attached. | browser-backed only through release-proof learning-loop revisit; manual-required for full Library claim |  |  |  | not-run |"
    const datedRow = "| Article source return | Open Library/Reading, search or filter to an article source, open detail, return to source, confirm source metadata remains attached. | browser-backed only through release-proof learning-loop revisit; manual-required for full Library claim | human.qa@astra.ai — 2026-05-29 | Chrome 125 on macOS 14, extension build astra-rc-2026-05-28, Library article source return manual QA | https://release-evidence.astra-cdn.net/manual-qa/section-6/article-source-return-2026-05-29.md | pass |"

    try {
      writeFileSync(checklistPath, originalChecklist.replace(originalRow, datedRow))
      let output = ""
      try {
        execFileSync(
          resolve("node_modules/.bin/tsx"),
          [resolve("script/maintenance/check-macro-final-completion.ts")],
          { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } },
        )
      } catch (error) {
        const result = error as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number }
        output = `${result.stdout ?? ""}${result.stderr ?? ""}`
        expect(result.status).toBe(1)
      }

      expect(output).toContain("Section 6 / Article source return owner/date: evidence date must not be after docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md date.")
      expect(output).toContain("Section 6 / Article source return evidence link: evidence date must not be after docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md date.")
    } finally {
      writeFileSync(checklistPath, originalChecklist)
    }
  })

  it("rejects dated markdown evidence docs whose H1 title date does not match the filename", () => {
    const intakePath = "docs/reviews/macro-final-evidence-intake-2026-05-28.md"
    const checklistPath = "docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md"
    const originalIntake = readFileSync(intakePath, "utf8")
    const originalChecklist = readFileSync(checklistPath, "utf8")

    try {
      writeFileSync(intakePath, originalIntake.replace("# Macro Final Evidence Intake — 2026-05-28", "# Macro Final Evidence Intake — 2026-05-27 / stale 2099-01-01"))
      writeFileSync(checklistPath, originalChecklist.replace("# Macro Manual / Browser QA Evidence Checklist — 2026-05-28", "# Macro Manual / Browser QA Evidence Checklist — 2026-05-27 / stale 2099-01-01"))
      let output = ""
      try {
        execFileSync(
          resolve("node_modules/.bin/tsx"),
          [resolve("script/maintenance/check-macro-final-completion.ts")],
          { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } },
        )
      } catch (error) {
        const result = error as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number }
        output = `${result.stdout ?? ""}${result.stderr ?? ""}`
        expect(result.status).toBe(1)
      }

      expect(output).toContain("docs/reviews/macro-final-evidence-intake-2026-05-28.md: expected title date 2026-05-28 to match filename.")
      expect(output).toContain("docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md: expected title date 2026-05-28 to match filename.")
    } finally {
      writeFileSync(intakePath, originalIntake)
      writeFileSync(checklistPath, originalChecklist)
    }
  })

  it("rejects hidden dated markdown titles before a stale visible H1", () => {
    const intakePath = "docs/reviews/macro-final-evidence-intake-2026-05-28.md"
    const originalIntake = readFileSync(intakePath, "utf8")
    const staleVisibleTitle = "# Macro Final Evidence Intake — 2026-05-27"
    const hiddenValidTitle = "```md\n# Macro Final Evidence Intake — 2026-05-28\n```"

    try {
      writeFileSync(intakePath, `${hiddenValidTitle}\n\n${originalIntake.replace("# Macro Final Evidence Intake — 2026-05-28", staleVisibleTitle)}`)
      let output = ""
      try {
        execFileSync(
          resolve("node_modules/.bin/tsx"),
          [resolve("script/maintenance/check-macro-final-completion.ts")],
          { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } },
        )
      } catch (error) {
        const result = error as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number }
        output = `${result.stdout ?? ""}${result.stderr ?? ""}`
        expect(result.status).toBe(1)
      }

      expect(output).toContain("docs/reviews/macro-final-evidence-intake-2026-05-28.md: expected title date 2026-05-28 to match filename.")
    } finally {
      writeFileSync(intakePath, originalIntake)
    }
  })

  it("rejects dated markdown titles whose only matching date is in link metadata", () => {
    const intakePath = "docs/reviews/macro-final-evidence-intake-2026-05-28.md"
    const originalIntake = readFileSync(intakePath, "utf8")
    const hiddenDateTitle = "# Macro Final Evidence Intake — [release packet](https://release-evidence.astra-cdn.net/intake/2026-05-28 \"2026-05-28\")"

    try {
      writeFileSync(intakePath, originalIntake.replace("# Macro Final Evidence Intake — 2026-05-28", hiddenDateTitle))
      let output = ""
      try {
        execFileSync(
          resolve("node_modules/.bin/tsx"),
          [resolve("script/maintenance/check-macro-final-completion.ts")],
          { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } },
        )
      } catch (error) {
        const result = error as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number }
        output = `${result.stdout ?? ""}${result.stderr ?? ""}`
        expect(result.status).toBe(1)
      }

      expect(output).toContain("docs/reviews/macro-final-evidence-intake-2026-05-28.md: expected title date 2026-05-28 to match filename.")
    } finally {
      writeFileSync(intakePath, originalIntake)
    }
  })

  it("rejects duplicate visible H1 titles in dated markdown evidence docs", () => {
    const intakePath = "docs/reviews/macro-final-evidence-intake-2026-05-28.md"
    const originalIntake = readFileSync(intakePath, "utf8")

    try {
      writeFileSync(intakePath, `${originalIntake}\n# Duplicate stale final evidence intake title — 2026-05-27\n`)
      let output = ""
      try {
        execFileSync(
          resolve("node_modules/.bin/tsx"),
          [resolve("script/maintenance/check-macro-final-completion.ts")],
          { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } },
        )
      } catch (error) {
        const result = error as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number }
        output = `${result.stdout ?? ""}${result.stderr ?? ""}`
        expect(result.status).toBe(1)
      }

      expect(output).toContain("docs/reviews/macro-final-evidence-intake-2026-05-28.md: expected exactly one visible H1 title.")
      expect(output).toContain("docs/reviews/macro-final-evidence-intake-2026-05-28.md: expected title date 2026-05-28 to match filename.")
    } finally {
      writeFileSync(intakePath, originalIntake)
    }
  })

  it("keeps the final checker strict for packet generatedAt timestamps", () => {
    const checker = readFileSync("script/maintenance/check-macro-final-completion.ts", "utf8")

    expect(checker).toContain("function validateIsoGeneratedAt")
    expect(checker).toContain("function expectedGeneratedAtDateFromEvidencePath")
    expect(checker).toContain("function validateEvidenceDateNotAfterPacketGeneratedAt")
    expect(checker).toContain("function isoDateParseResults")
    expect(checker).toContain("evidence date must use real calendar YYYY-MM-DD values")
    expect(checker).toContain("matchAll(/\\b(20\\d{2}-\\d{2}-\\d{2})\\b/g)")
    expect(checker).toContain("function validateEvidenceTimestampNotAfterPacketGeneratedAt")
    expect(checker).toContain("function validateEvidenceDateNotAfterDatedArtifactPath")
    expect(checker).toContain("function validateDatedMarkdownTitle")
    expect(checker).toContain('const titles = visibleMarkdownText(markdown).split("\\n").map((line) => line.trim()).filter((line) => /^#\\s+/.test(line))')
    expect(checker).toContain("expected exactly one visible H1 title")
    expect(checker).toContain("titles.flatMap((title) => isoDateParseResults(title))")
    expect(checker).toContain("expected title date ${expectedDate} to match filename")
    expect(checker).toContain("title date must use real calendar YYYY-MM-DD values")
    expect(checker).toContain("generatedAt timestamp must not be in the future")
    expect(checker).toContain("evidence date must not be after packet generatedAt date")
    expect(checker).toContain("evidence date must not be after ${evidencePath} date")
    expect(checker).toContain("expected generatedAt date ${expectedDate} to match ${evidencePath}")
    expect(checker).toContain("expected label date ${expectedDate} to match ${evidencePath}")
    expect(checker).toContain("labelDateResults.some((result) => result.value !== expectedDate)")
    expect(checker).toContain("label date must use real calendar YYYY-MM-DD values")
    expect(checker).toContain("validatePacketLabel(value.label, \"artifact.label\", findings, FINAL_COMPLETION_EVIDENCE_PATH)")
    expect(checker).toContain("function parseIsoDate")
    expect(checker).toContain("parseIsoDate(value.slice(0, 10)) !== null")
    expect(checker).toContain("(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d")
    expect(checker).toContain("(?:Z|[+-](?:[01]\\d|2[0-3]):[0-5]\\d)")
    expect(checker).toContain("expected an ISO timestamp string")
    expect(checker).toContain("validateIsoGeneratedAt(value.generatedAt, \"artifact.generatedAt\", findings, FINAL_COMPLETION_EVIDENCE_PATH)")
    expect(checker).toContain("validateIsoGeneratedAt(value.generatedAt, \"operationalPacket.generatedAt\", findings, OPERATIONAL_COMPLETION_PACKET_PATH)")
    expect(checker).toContain("validateIsoGeneratedAt(value.generatedAt, \"productionMetricsExportPacket.generatedAt\", findings, PRODUCTION_METRICS_EXPORT_PACKET_PATH)")
    expect(checker).toContain("validateIsoGeneratedAt(value.generatedAt, \"productMetricsReadinessPacket.generatedAt\", findings, PRODUCT_METRICS_READINESS_PACKET_PATH)")
    expect(checker).toContain("validateEvidenceDateNotAfterPacketGeneratedAt(row.ownerDate, `ciArtifactPacket.rows.${row.evidenceField}.ownerDate`, packet.generatedAt, findings)")
    expect(checker).toContain("validateEvidenceDateNotAfterPacketGeneratedAt(row.evidenceLink, `operationalPacket.rows.${row.areaId}.evidenceLink`, packet.generatedAt, findings)")
    expect(checker).toContain("validateEvidenceDateNotAfterPacketGeneratedAt(row.artifactManifestPath, `ciArtifactPacket.rows.${row.evidenceField}.artifactManifestPath`, packet.generatedAt, findings)")
    expect(checker).toContain("validateEvidenceTimestampNotAfterPacketGeneratedAt(row.exportedAt, `productionMetricsExportPacket.rows.${row.category}.exportedAt`, packet.generatedAt, findings)")
    expect(checker).toContain("validateEvidenceDateNotAfterDatedArtifactPath(row.ownerDate, `Section ${row.section} / ${row.qaRow} owner/date`, MANUAL_QA_CHECKLIST_PATH, findings)")
    expect(checker).toContain("validateEvidenceDateNotAfterDatedArtifactPath(row.evidenceLink, `Section ${row.section} / ${row.qaRow} evidence link`, MANUAL_QA_CHECKLIST_PATH, findings)")
    expect(checker).toContain("validateDatedMarkdownTitle(markdown, FINAL_EVIDENCE_INTAKE_PATH, findings)")
    expect(checker).toContain("validateDatedMarkdownTitle(checklistText, MANUAL_QA_CHECKLIST_PATH, findings)")
  })

  it("keeps the final checker strict for human-scored AI quality summary packet shape", () => {
    const checker = readFileSync("script/maintenance/check-macro-final-completion.ts", "utf8")

    expect(checker).toContain("function validateAiQualityRunSummary")
    expect(checker).toContain("artifact|run|rubric|fixture|manifest|export|query")
    expect(checker).toContain("mock|draft|tbd|pending|temp|temporary")
    expect(checker).toContain("normalizedValue.includes(\"placeholder\")")
    expect(checker).toContain("AI_QUALITY_SUMMARY_REQUIRED_KEYS")
    expect(checker).toContain("validateConstrainedNumberField(value[field]")
    expect(checker).toContain("validateNullableConstrainedNumberField(value.averageScore")
    expect(checker).toContain("validateNumberRecord(value.capabilityCounts")
    expect(checker).toContain("integer: true, min: 0")
    expect(checker).toContain("validateNumberRecord(value.capabilityAverages")
    expect(checker).toContain("min: 1, max: 5")
    expect(checker).toContain("validateStringArrayField(value.blockerSampleIds")
    expect(checker).toContain("function isCanonicalAiQualityEvidenceId")
    expect(checker).toContain("expected canonical non-placeholder sample id")
    expect(checker).toContain("expected canonical non-placeholder backlog label")
    expect(checker).toContain("validateAiQualityLowScoreBacklog(value.lowScoreBacklog")
    expect(checker).toContain("summary.runId !== value.evidence.runId")
    expect(checker).toContain("expected ISO timestamp when present")
    expect(checker).toContain("findings.length > initialFindingCount")
  })

  it("keeps the final checker strict for launch artifact packet identity fields", () => {
    const checker = readFileSync("script/maintenance/check-macro-final-completion.ts", "utf8")
    const macroOperationalEvidenceSource = readFileSync("src/utils/macro-operational-evidence.ts", "utf8")

    expect(checker).toContain("artifactType")
    expect(checker).toContain("artifactId")
    expect(checker).toContain("artifactDigestOrVersion")
    expect(checker).toContain("targetChannel")
    expect(checker).toContain("claimBoundary")
    expect(checker).toContain("evaluateAstraMacroLaunchArtifactPacket")
    expect(macroOperationalEvidenceSource).toContain("function hasLaunchArtifactGroupContext")
    expect(macroOperationalEvidenceSource).toContain("function isSpecificLaunchArtifactType")
    expect(macroOperationalEvidenceSource).toContain("function isSpecificLaunchTargetChannel")
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
      ownerDate: "release-owner@astra.ai — 2026-05-28",
      environment: "target release candidate / production evidence packet",
      evidenceLink: index === 0 ? "docs/reviews/example-operational-evidence.md" : `https://release-evidence.astra-cdn.net/operational-evidence/${item.id}.md`,
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

  it("rejects contextual sample/fake requirement-evidence notes so placeholder proof text cannot clear operational evidence", () => {
    const sampleEvidenceText = `${ASTRA_MACRO_OPERATIONAL_EVIDENCE[0].requiredBeforeStrongerClaim.join(" ")} sample evidence`
    const rows = ASTRA_MACRO_OPERATIONAL_EVIDENCE.map((item, index) => ({
      areaId: item.id,
      ownerDate: "release-owner@astra.ai — 2026-05-28",
      environment: "target release candidate / production evidence packet",
      evidenceLink: `https://release-evidence.astra-cdn.net/operational-evidence/${item.id}.md`,
      requirementEvidence: index === 0 ? sampleEvidenceText : item.requiredBeforeStrongerClaim.join(" "),
      verdict: "proved" as const,
    }))

    const decision = evaluateAstraMacroOperationalEvidenceCompletionPacket(rows)

    expect(decision.complete).toBe(false)
    expect(decision.findings).toEqual([
      {
        areaId: "first_success_activation_evidence",
        message: "First-success activation evidence requirement-evidence notes are placeholder evidence.",
        nextStep: ASTRA_MACRO_OPERATIONAL_EVIDENCE[0].requiredBeforeStrongerClaim.join(" "),
      },
    ])
  })

  it("rejects unknown operational evidence rows so unrelated proof cannot satisfy macro areas", () => {
    const decision = evaluateAstraMacroOperationalEvidenceCompletionPacket([
      ...ASTRA_MACRO_OPERATIONAL_EVIDENCE.map((item) => ({
        areaId: item.id,
        ownerDate: "release-owner@astra.ai — 2026-05-28",
        environment: "target release candidate / production evidence packet",
        evidenceLink: `https://release-evidence.astra-cdn.net/operational-evidence/${item.id}.md`,
        requirementEvidence: item.requiredBeforeStrongerClaim.join(" "),
        verdict: "proved" as const,
      })),
      {
        areaId: "untracked_operational_area" as never,
        ownerDate: "release-owner@astra.ai — 2026-05-28",
        environment: "target release candidate / production evidence packet",
        evidenceLink: "https://release-evidence.astra-cdn.net/operational-evidence/untracked.md",
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
        environment: "pending target-release evidence packet",
        evidenceLink: "https://release-internal@github.com/private-evidence.md",
        requirementEvidence: "generic proof exists",
        verdict: "proved",
      },
      ...ASTRA_MACRO_OPERATIONAL_EVIDENCE.slice(1).map((item) => ({
        areaId: item.id,
        ownerDate: "release-owner@astra.ai — 2026-05-28",
        environment: "target release candidate / production evidence packet",
        evidenceLink: `https://release-evidence.astra-cdn.net/operational-evidence/${item.id}.md`,
        requirementEvidence: item.requiredBeforeStrongerClaim.join(" "),
        verdict: "proved" as const,
      })),
    ])

    expect(decision.complete).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "First-success activation evidence owner/date must identify a real owner and include a YYYY-MM-DD date.",
      "First-success activation evidence environment is placeholder evidence.",
      "First-success activation evidence evidence link must be a URL or repo artifact path.",
      "First-success activation evidence requirement-evidence notes do not reference the required stronger-claim evidence.",
    ])
  })

  it("rejects generic operational evidence environments without concrete target-release details", () => {
    const rows = ASTRA_MACRO_OPERATIONAL_EVIDENCE.map((item) => ({
      areaId: item.id,
      ownerDate: "release-owner@astra.ai — 2026-05-28",
      environment: "target release candidate / production evidence packet",
      evidenceLink: `https://release-evidence.astra-cdn.net/operational-evidence/${item.id}.md`,
      requirementEvidence: item.requiredBeforeStrongerClaim.join(" "),
      verdict: "proved" as const,
    }))
    const decision = evaluateAstraMacroOperationalEvidenceCompletionPacket([
      {
        ...rows[0],
        environment: "production",
      },
      ...rows.slice(1),
    ])

    expect(decision.complete).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "First-success activation evidence environment must include target-release context plus concrete build/browser/deployment/cohort/provider evidence details.",
    ])
  })

  it("rejects operational evidence environment values with surrounding whitespace", () => {
    const rows = ASTRA_MACRO_OPERATIONAL_EVIDENCE.map((item) => ({
      areaId: item.id,
      ownerDate: "release-owner@astra.ai — 2026-05-28",
      environment: "target release candidate / production evidence packet",
      evidenceLink: `https://release-evidence.astra-cdn.net/operational-evidence/${item.id}.md`,
      requirementEvidence: item.requiredBeforeStrongerClaim.join(" "),
      verdict: "proved" as const,
    }))
    const decision = evaluateAstraMacroOperationalEvidenceCompletionPacket([
      {
        ...rows[0],
        environment: ` ${rows[0].environment} `,
      },
      ...rows.slice(1),
    ])

    expect(decision.complete).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "First-success activation evidence environment must be canonical without surrounding whitespace.",
    ])
  })

  it("rejects Unicode whitespace and separator characters in operational evidence references", () => {
    const rows = ASTRA_MACRO_OPERATIONAL_EVIDENCE.map((item) => ({
      areaId: item.id,
      ownerDate: "release-owner@astra.ai — 2026-05-28",
      environment: "target release candidate / production evidence packet",
      evidenceLink: `https://release-evidence.astra-cdn.net/operational-evidence/${item.id}.md`,
      requirementEvidence: item.requiredBeforeStrongerClaim.join(" "),
      verdict: "proved" as const,
    }))

    for (const evidenceLink of [
      "docs/reviews/operational\u00A0evidence.md",
      "https://release-evidence.astra-cdn.net/operational%C2%A0evidence.md",
      "https://release-evidence.astra-cdn.net/operational%E2%80%8Bevidence.md",
      "https://release-evidence.astra-cdn.net/operational%E2%80%A8evidence.md",
    ]) {
      const decision = evaluateAstraMacroOperationalEvidenceCompletionPacket([
        {
          ...rows[0],
          evidenceLink,
        },
        ...rows.slice(1),
      ])

      expect(decision.complete).toBe(false)
      expect(decision.findings.map((finding) => finding.message)).toEqual([
        "First-success activation evidence evidence link must be a URL or repo artifact path.",
      ])
    }
  })

  it("rejects special-use IPv4 and IPv6 URLs in operational evidence references", () => {
    const baseRows = ASTRA_MACRO_OPERATIONAL_EVIDENCE.map((item) => ({
      areaId: item.id,
      ownerDate: "release-owner@astra.ai — 2026-05-28",
      environment: "target release candidate / production evidence packet",
      evidenceLink: `https://release-evidence.astra-cdn.net/operational-evidence/${item.id}.md`,
      requirementEvidence: item.requiredBeforeStrongerClaim.join(" "),
      verdict: "proved" as const,
    }))

    for (const evidenceLink of [
      "https://localhost./operational-evidence.md",
      "https://evidence.localhost./operational-evidence.md",
      "https://100.64.0.1/operational-evidence.md",
      "https://198.18.0.1/operational-evidence.md",
      "https://192.0.2.1/operational-evidence.md",
      "https://192.88.99.1/operational-evidence.md",
      "https://[::]/operational-evidence.md",
      "https://[64:ff9b::1]/operational-evidence.md",
      "https://[64:ff9b:1::1]/operational-evidence.md",
      "https://[100::1]/operational-evidence.md",
      "https://[2001:2::1]/operational-evidence.md",
      "https://[2001:db8::1]/operational-evidence.md",
      "https://[2002::1]/operational-evidence.md",
      "https://[ff02::1]/operational-evidence.md",
      "https://[::ffff:100.64.0.1]/operational-evidence.md",
    ]) {
      const decision = evaluateAstraMacroOperationalEvidenceCompletionPacket([
        {
          ...baseRows[0],
          evidenceLink,
        },
        ...baseRows.slice(1),
      ])

      expect(decision.complete).toBe(false)
      expect(decision.findings.map((finding) => finding.message)).toEqual([
        "First-success activation evidence evidence link must be a URL or repo artifact path.",
      ])
    }
  })

  it("does not overblock adjacent public-looking IPv6 evidence URL ranges", () => {
    const baseRows = ASTRA_MACRO_OPERATIONAL_EVIDENCE.map((item) => ({
      areaId: item.id,
      ownerDate: "release-owner@astra.ai — 2026-05-28",
      environment: "target release candidate / production evidence packet",
      evidenceLink: `https://release-evidence.astra-cdn.net/operational-evidence/${item.id}.md`,
      requirementEvidence: item.requiredBeforeStrongerClaim.join(" "),
      verdict: "proved" as const,
    }))

    for (const evidenceLink of [
      "https://[100:1::1]/operational-evidence.md",
      "https://[64:ff9b:2::1]/operational-evidence.md",
      "https://[2001:3::1]/operational-evidence.md",
    ]) {
      expect(evaluateAstraMacroOperationalEvidenceCompletionPacket([
        {
          ...baseRows[0],
          evidenceLink,
        },
        ...baseRows.slice(1),
      ])).toEqual({ complete: true, findings: [] })
    }
  })

  it("rejects duplicate operational evidence rows so conflicting proof cannot overwrite tracked areas", () => {
    const rows = ASTRA_MACRO_OPERATIONAL_EVIDENCE.map((item) => ({
      areaId: item.id,
      ownerDate: "release-owner@astra.ai — 2026-05-28",
      environment: "target release candidate / production evidence packet",
      evidenceLink: `https://release-evidence.astra-cdn.net/operational-evidence/${item.id}.md`,
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

  it("rejects reused operational evidence links so one generic artifact cannot prove multiple areas", () => {
    const rows = ASTRA_MACRO_OPERATIONAL_EVIDENCE.map((item, index) => ({
      areaId: item.id,
      ownerDate: "release-owner@astra.ai — 2026-05-28",
      environment: "target release candidate / production evidence packet",
      evidenceLink: index < 2 ? "https://release-evidence.astra-cdn.net/operational-evidence/shared-proof.md" : `https://release-evidence.astra-cdn.net/operational-evidence/${item.id}.md`,
      requirementEvidence: item.requiredBeforeStrongerClaim.join(" "),
      verdict: "proved" as const,
    }))

    const decision = evaluateAstraMacroOperationalEvidenceCompletionPacket(rows)

    expect(decision.complete).toBe(false)
    expect(decision.findings).toEqual([
      {
        areaId: "learning_library_surface_coverage",
        message: "learning_library_surface_coverage reuses operational evidence link https://release-evidence.astra-cdn.net/operational-evidence/shared-proof.md.",
        nextStep: "Attach area-specific target-release evidence so every operational claim can be audited independently.",
      },
    ])
  })

  it("rejects reused operational evidence URL paths even when query or fragment differs", () => {
    const rows = ASTRA_MACRO_OPERATIONAL_EVIDENCE.map((item, index) => ({
      areaId: item.id,
      ownerDate: "release-owner@astra.ai — 2026-05-28",
      environment: "target release candidate / production evidence packet",
      evidenceLink: index === 0
        ? "https://release-evidence.astra-cdn.net/operational-evidence/shared-proof.md?area=activation"
        : index === 1
          ? "https://release-evidence.astra-cdn.net/operational-evidence/shared-proof.md#learning"
          : `https://release-evidence.astra-cdn.net/operational-evidence/${item.id}.md`,
      requirementEvidence: item.requiredBeforeStrongerClaim.join(" "),
      verdict: "proved" as const,
    }))

    const decision = evaluateAstraMacroOperationalEvidenceCompletionPacket(rows)

    expect(decision.complete).toBe(false)
    expect(decision.findings).toEqual([
      {
        areaId: "learning_library_surface_coverage",
        message: "learning_library_surface_coverage reuses operational evidence link https://release-evidence.astra-cdn.net/operational-evidence/shared-proof.md#learning.",
        nextStep: "Attach area-specific target-release evidence so every operational claim can be audited independently.",
      },
    ])
  })

  it("rejects non-canonical operational evidence area ids before duplicate variants can bypass row identity", () => {
    const rows = ASTRA_MACRO_OPERATIONAL_EVIDENCE.map((item) => ({
      areaId: item.id,
      ownerDate: "release-owner@astra.ai — 2026-05-28",
      environment: "target release candidate / production evidence packet",
      evidenceLink: `https://release-evidence.astra-cdn.net/operational-evidence/${item.id}.md`,
      requirementEvidence: item.requiredBeforeStrongerClaim.join(" "),
      verdict: "proved" as const,
    }))

    const decision = evaluateAstraMacroOperationalEvidenceCompletionPacket([
      ...rows,
      {
        ...rows[0],
        areaId: " FIRST_SUCCESS_ACTIVATION_EVIDENCE " as never,
      },
    ])

    expect(decision.complete).toBe(false)
    expect(decision.findings).toEqual([
      {
        areaId: " FIRST_SUCCESS_ACTIVATION_EVIDENCE ",
        message: " FIRST_SUCCESS_ACTIVATION_EVIDENCE  must use canonical operational evidence area casing without surrounding whitespace.",
        nextStep: "Use the exact area id from ASTRA_MACRO_OPERATIONAL_EVIDENCE.",
      },
      {
        areaId: " FIRST_SUCCESS_ACTIVATION_EVIDENCE ",
        message: " FIRST_SUCCESS_ACTIVATION_EVIDENCE  has duplicate operational completion evidence rows.",
        nextStep: "Keep one owner/date/environment/evidence-backed row per operational evidence area.",
      },
    ])
  })

  it("accepts operational evidence completion packets only when every tracked area has owned target-release proof", () => {
    const rows = ASTRA_MACRO_OPERATIONAL_EVIDENCE.map((item) => ({
      areaId: item.id,
      ownerDate: "release-owner@astra.ai — 2026-05-28",
      environment: "target release candidate / production evidence packet",
      evidenceLink: `https://release-evidence.astra-cdn.net/operational-evidence/${item.id}.md`,
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
      targetCommitSha: "0000000",
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "Release approval date must be an exact valid YYYY-MM-DD date.",
      "Release approval record link must be a URL or repo artifact path.",
      "Release approval target commit/SHA must be a 7-40 character non-zero hex SHA.",
    ])
  })

  it("rejects owner release approval target SHAs with surrounding whitespace", () => {
    const decision = evaluateAstraMacroReleaseApprovalPacket({
      ...completeReleaseApprovalPacket,
      targetCommitSha: " abc123def456 ",
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "Release approval target commit/SHA must be a 7-40 character non-zero hex SHA.",
    ])
  })

  it("rejects owner release approval dates with surrounding whitespace", () => {
    const decision = evaluateAstraMacroReleaseApprovalPacket({
      ...completeReleaseApprovalPacket,
      approvalDate: " 2026-05-28 ",
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "Release approval date must be an exact valid YYYY-MM-DD date.",
    ])
  })

  it("rejects owner release approvers with surrounding whitespace", () => {
    const decision = evaluateAstraMacroReleaseApprovalPacket({
      ...completeReleaseApprovalPacket,
      approver: " Release owner ",
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "Release approval approver must be canonical without surrounding whitespace.",
    ])
  })

  it("rejects generic owner release approvers without a concrete identity", () => {
    const decision = evaluateAstraMacroReleaseApprovalPacket({
      ...completeReleaseApprovalPacket,
      approver: "Release owner",
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "Release approval approver is placeholder evidence.",
    ])
  })

  it("rejects placeholder owner release approvers and non-exact approval dates", () => {
    const decision = evaluateAstraMacroReleaseApprovalPacket({
      ...completeReleaseApprovalPacket,
      approver: "Example Owner",
      approvalDate: "todo 2026-05-28",
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "Release approval approver is placeholder evidence.",
      "Release approval date must be an exact valid YYYY-MM-DD date.",
    ])
  })

  it("rejects ambiguous short owner release approver labels", () => {
    const decision = evaluateAstraMacroReleaseApprovalPacket({
      ...completeReleaseApprovalPacket,
      approver: "J",
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "Release approval approver must identify an accountable owner, not an ambiguous short label.",
    ])
  })

  it("rejects non-enum owner release approval decisions from JSON packets", () => {
    const decision = evaluateAstraMacroReleaseApprovalPacket({
      ...completeReleaseApprovalPacket,
      decision: "approved" as never,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "Release approval decision must be approved_with_downgrades, approved_final, or rejected.",
    ])
  })

  it("rejects owner release approval links with embedded control or whitespace characters", () => {
    const decision = evaluateAstraMacroReleaseApprovalPacket({
      ...completeReleaseApprovalPacket,
      approvalRecordLink: " docs/reviews/owner-approval.md",
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toContain("Release approval record link must be a URL or repo artifact path.")
  })

  it("rejects generic evidence notes as owner release approval records", () => {
    const decision = evaluateAstraMacroReleaseApprovalPacket({
      ...completeReleaseApprovalPacket,
      approvalRecordLink: "docs/reviews/owner-release-approval-evidence-note-2026-05-28.md",
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "Release approval record link must identify a signed owner/release approval record, not a generic evidence note.",
    ])
  })

  it("rejects non-canonical or duplicate owner release reviewed artifacts before variants can satisfy required artifact checks", () => {
    const reviewedArtifacts = [...ASTRA_MACRO_RELEASE_APPROVAL_REQUIREMENT.requiredReviewedArtifacts]
    reviewedArtifacts[0] = ` ${ASTRA_MACRO_RELEASE_APPROVAL_REQUIREMENT.requiredReviewedArtifacts[0]} `
    reviewedArtifacts.push(ASTRA_MACRO_RELEASE_APPROVAL_REQUIREMENT.requiredReviewedArtifacts[1])

    const decision = evaluateAstraMacroReleaseApprovalPacket({
      ...completeReleaseApprovalPacket,
      reviewedArtifacts,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "Release approval reviewed artifact  docs/reviews/macro-gate-4-claim-review-2026-05-28.md  must use canonical artifact path without surrounding whitespace.",
      "Release approval reviewed artifact docs/reviews/macro-rc-evidence-packet-2026-05-28.md is duplicated.",
    ])
  })

  it("rejects owner release approval records that reuse a reviewed artifact", () => {
    const reviewedArtifact = ASTRA_MACRO_RELEASE_APPROVAL_REQUIREMENT.requiredReviewedArtifacts[1]
    const decision = evaluateAstraMacroReleaseApprovalPacket({
      ...completeReleaseApprovalPacket,
      approvalRecordLink: reviewedArtifact,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "Release approval record link must identify a signed owner/release approval record, not a generic evidence note.",
      `Release approval record link reuses reviewed artifact ${reviewedArtifact}.`,
    ])
  })

  it("rejects extra owner release reviewed artifacts outside the required final gate packet set", () => {
    const unexpectedArtifact = "docs/reviews/untracked-owner-approval-draft.md"
    const decision = evaluateAstraMacroReleaseApprovalPacket({
      ...completeReleaseApprovalPacket,
      reviewedArtifacts: [...completeReleaseApprovalPacket.reviewedArtifacts, unexpectedArtifact],
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      `Release approval reviewed artifact ${unexpectedArtifact} is not one of the required Gate 4/RC/final evidence artifacts.`,
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
        evidenceLink: "https://release-evidence.astra-cdn.net/manual-qa/draft-section-6.md",
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

  it("rejects date-only owner/date values across final evidence packets", () => {
    const operationalDecision = evaluateAstraMacroOperationalEvidenceCompletionPacket([
      {
        areaId: "first_success_activation_evidence",
        ownerDate: "2026-05-28",
        environment: "target release candidate / production evidence packet",
        evidenceLink: "https://release-evidence.astra-cdn.net/operational-evidence/first-success.md",
        requirementEvidence: ASTRA_MACRO_OPERATIONAL_EVIDENCE[0].requiredBeforeStrongerClaim.join(" "),
        verdict: "proved" as const,
      },
      ...ASTRA_MACRO_OPERATIONAL_EVIDENCE.slice(1).map((item) => ({
        areaId: item.id,
        ownerDate: "release-owner@astra.ai — 2026-05-28",
        environment: "target release candidate / production evidence packet",
        evidenceLink: `https://release-evidence.astra-cdn.net/operational-evidence/${item.id}.md`,
        requirementEvidence: item.requiredBeforeStrongerClaim.join(" "),
        verdict: "proved" as const,
      })),
    ])
    const manualDecision = evaluateAstraMacroManualQaEvidencePacket([
      { ...completeManualQaRows[0], ownerDate: "2026-05-28" },
      ...completeManualQaRows.slice(1),
    ])
    const ciDecision = evaluateAstraMacroCiArtifactPacket([
      { ...completeCiArtifactPacket[0], ownerDate: "2026-05-28" },
      completeCiArtifactPacket[1],
    ])
    const launchDecision = evaluateAstraMacroLaunchArtifactPacket([
      { ...completeLaunchArtifactRows[0], ownerDate: "2026-05-28" },
      ...completeLaunchArtifactRows.slice(1),
    ])

    expect(operationalDecision.findings.map((finding) => finding.message)).toContain("First-success activation evidence owner/date must identify a real owner and include a YYYY-MM-DD date.")
    expect(manualDecision.findings.map((finding) => finding.message)).toContain("Section 6 / Article source return owner/date must identify a real owner and include a YYYY-MM-DD date.")
    expect(ciDecision.findings.map((finding) => finding.message)).toContain("CI quality gate artifact owner/date must identify a real owner and include a YYYY-MM-DD date.")
    expect(launchDecision.findings.map((finding) => finding.message)).toContain("Billing checkout success/cancel owner/date must identify a real owner and include a YYYY-MM-DD date.")
  })

  it("rejects future owner/date values across final evidence packets", () => {
    const operationalDecision = evaluateAstraMacroOperationalEvidenceCompletionPacket([
      {
        areaId: "first_success_activation_evidence",
        ownerDate: "release-owner@astra.ai — 2026-05-28 / rechecked 2099-01-01",
        environment: "target release candidate / production evidence packet",
        evidenceLink: "https://release-evidence.astra-cdn.net/operational-evidence/first-success.md",
        requirementEvidence: ASTRA_MACRO_OPERATIONAL_EVIDENCE[0].requiredBeforeStrongerClaim.join(" "),
        verdict: "proved" as const,
      },
      ...ASTRA_MACRO_OPERATIONAL_EVIDENCE.slice(1).map((item) => ({
        areaId: item.id,
        ownerDate: "release-owner@astra.ai — 2026-05-28",
        environment: "target release candidate / production evidence packet",
        evidenceLink: `https://release-evidence.astra-cdn.net/operational-evidence/${item.id}.md`,
        requirementEvidence: item.requiredBeforeStrongerClaim.join(" "),
        verdict: "proved" as const,
      })),
    ])
    const manualDecision = evaluateAstraMacroManualQaEvidencePacket([
      { ...completeManualQaRows[0], ownerDate: "qa-owner@astra.ai — 2026-05-28 / rechecked 2099-01-01" },
      ...completeManualQaRows.slice(1),
    ])
    const ciDecision = evaluateAstraMacroCiArtifactPacket([
      { ...completeCiArtifactPacket[0], ownerDate: "ci-owner@astra.ai — 2026-05-28 / rechecked 2099-01-01" },
      completeCiArtifactPacket[1],
    ])
    const launchDecision = evaluateAstraMacroLaunchArtifactPacket([
      { ...completeLaunchArtifactRows[0], ownerDate: "launch-owner@astra.ai — 2026-05-28 / rechecked 2099-01-01" },
      ...completeLaunchArtifactRows.slice(1),
    ])

    expect(operationalDecision.findings.map((finding) => finding.message)).toContain("First-success activation evidence owner/date must identify a real owner and include a YYYY-MM-DD date.")
    expect(manualDecision.findings.map((finding) => finding.message)).toContain("Section 6 / Article source return owner/date must identify a real owner and include a YYYY-MM-DD date.")
    expect(ciDecision.findings.map((finding) => finding.message)).toContain("CI quality gate artifact owner/date must identify a real owner and include a YYYY-MM-DD date.")
    expect(launchDecision.findings.map((finding) => finding.message)).toContain("Billing checkout success/cancel owner/date must identify a real owner and include a YYYY-MM-DD date.")
  })

  it("rejects generic owner/date identities and weak manual QA environments", () => {
    const manualDecision = evaluateAstraMacroManualQaEvidencePacket([
      { ...completeManualQaRows[0], ownerDate: "QA owner — 2026-05-28", environment: "Chrome" },
      ...completeManualQaRows.slice(1),
    ])
    const ciDecision = evaluateAstraMacroCiArtifactPacket([
      { ...completeCiArtifactPacket[0], ownerDate: "Owner 2026-05-28" },
      completeCiArtifactPacket[1],
    ])
    const launchDecision = evaluateAstraMacroLaunchArtifactPacket([
      { ...completeLaunchArtifactRows[0], ownerDate: "Release owner — 2026-05-28" },
      ...completeLaunchArtifactRows.slice(1),
    ])

    expect(manualDecision.findings.map((finding) => finding.message)).toEqual([
      "Section 6 / Article source return owner/date must identify a real owner and include a YYYY-MM-DD date.",
      "Section 6 / Article source return environment must include real browser, OS, build/runtime, and row-specific QA context.",
    ])
    expect(ciDecision.findings.map((finding) => finding.message)).toContain("CI quality gate artifact owner/date must identify a real owner and include a YYYY-MM-DD date.")
    expect(launchDecision.findings.map((finding) => finding.message)).toContain("Billing checkout success/cancel owner/date must identify a real owner and include a YYYY-MM-DD date.")
  })

  it("rejects generic manual QA environments that omit section-specific QA context", () => {
    const decision = evaluateAstraMacroManualQaEvidencePacket([
      {
        ...completeManualQaRows[0],
        environment: "Chrome extension target build on macOS",
      },
      ...completeManualQaRows.slice(1),
    ])

    expect(decision.complete).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "Section 6 / Article source return environment must include real browser, OS, build/runtime, and row-specific QA context.",
    ])
  })

  it("rejects manual QA owner/date values with surrounding whitespace", () => {
    const decision = evaluateAstraMacroManualQaEvidencePacket([
      {
        ...completeManualQaRows[0],
        ownerDate: ` ${completeManualQaRows[0].ownerDate} `,
      },
      ...completeManualQaRows.slice(1),
    ])

    expect(decision.complete).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "Section 6 / Article source return owner/date must identify a real owner and include a YYYY-MM-DD date.",
    ])
  })

  it("rejects manual QA environment values with surrounding whitespace", () => {
    const decision = evaluateAstraMacroManualQaEvidencePacket([
      {
        ...completeManualQaRows[0],
        environment: ` ${completeManualQaRows[0].environment} `,
      },
      ...completeManualQaRows.slice(1),
    ])

    expect(decision.complete).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "Section 6 / Article source return environment must be canonical without surrounding whitespace.",
    ])
  })

  it("rejects weak manual QA owner/date and evidence references", () => {
    const decision = evaluateAstraMacroManualQaEvidencePacket([
      {
        ...completeManualQaRows[0],
        ownerDate: "QA owner",
        environment: "draft browser evidence",
        evidenceLink: "done",
      },
      ...completeManualQaRows.slice(1),
    ])

    expect(decision.complete).toBe(false)
    expect(decision.findings).toEqual([
      {
        section: 6,
        qaRow: "Article source return",
        message: "Section 6 / Article source return owner/date must identify a real owner and include a YYYY-MM-DD date.",
        nextStep: "Record a real QA owner/date using YYYY-MM-DD.",
      },
      {
        section: 6,
        qaRow: "Article source return",
        message: "Section 6 / Article source return environment must include real browser, OS, build/runtime, and row-specific QA context.",
        nextStep: "Record the real browser, OS, build, and section/row-specific manual QA context.",
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
        ownerDate: "qa-owner@astra.ai — 2026-05-28",
        environment: "Chrome extension target build on macOS",
        evidenceLink: "https://release-evidence.astra-cdn.net/manual-qa/untracked-walkthrough.md",
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

  it("rejects reused manual QA evidence links so one walkthrough cannot prove multiple rows", () => {
    const sharedEvidenceLink = "https://release-evidence.astra-cdn.net/manual-qa/section-6-article-source-return-remote-pdf-source-return.md"
    const decision = evaluateAstraMacroManualQaEvidencePacket([
      {
        ...completeManualQaRows[0],
        evidenceLink: sharedEvidenceLink,
      },
      {
        ...completeManualQaRows[1],
        evidenceLink: sharedEvidenceLink,
      },
      ...completeManualQaRows.slice(2),
    ])

    expect(decision.complete).toBe(false)
    expect(decision.findings).toEqual([
      {
        section: completeManualQaRows[1].section,
        qaRow: completeManualQaRows[1].qaRow,
        message: `Section ${completeManualQaRows[1].section} / ${completeManualQaRows[1].qaRow} reuses manual QA evidence link ${sharedEvidenceLink}.`,
        nextStep: "Attach row-specific manual QA evidence so every checklist row can be audited independently.",
      },
    ])
  })

  it("rejects manual QA evidence links that point at a different checklist row", () => {
    const decision = evaluateAstraMacroManualQaEvidencePacket([
      {
        ...completeManualQaRows[0],
        evidenceLink: "https://release-evidence.astra-cdn.net/manual-qa/section-6-remote-pdf-source-return.md",
      },
      ...completeManualQaRows.slice(1),
    ])

    expect(decision.complete).toBe(false)
    expect(decision.findings).toEqual([
      {
        section: 6,
        qaRow: "Article source return",
        message: "Section 6 / Article source return evidence link must identify Section 6 and row-specific manual QA evidence.",
        nextStep: "Attach evidence whose URL or repo artifact path names the manual QA section and exact checklist row.",
      },
    ])
  })

  it("rejects non-canonical manual QA row text before duplicate variants can bypass row identity", () => {
    const decision = evaluateAstraMacroManualQaEvidencePacket([
      ...completeManualQaRows,
      {
        ...completeManualQaRows[0],
        qaRow: " article source return ",
      },
    ])

    expect(decision.complete).toBe(false)
    expect(decision.findings).toEqual([
      {
        section: 6,
        qaRow: " article source return ",
        message: "Section 6 /  article source return  must use canonical manual QA row text without surrounding whitespace.",
        nextStep: "Use the exact section/row pair from ASTRA_MACRO_MANUAL_QA_REQUIREMENTS.",
      },
      {
        section: 6,
        qaRow: " article source return ",
        message: "Section 6 /  article source return  has duplicate manual QA evidence rows.",
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
      "CI quality gate artifact CI workflow name is placeholder evidence or not canonical.",
      "CI quality gate artifact is missing the CI run id.",
      "CI quality gate artifact is missing the CI job name.",
      "CI quality gate artifact workflow conclusion must be success.",
      "CI quality gate artifact job conclusion must be success.",
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
        artifactDigest: "sha256:456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123",
        artifactManifestPath: "data/release-artifacts/quality-gate-results/manifest.json",
          runUrl: "https://github.com/astra-release/astra/actions/runs/123456",
          artifactUrl: "https://github.com/astra-release/astra/actions/runs/123456/artifacts/654321",
        commitSha: "abc123def456",
        ownerDate: "qa-owner@astra.ai — 2026-05-28",
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

  it("rejects non-canonical CI artifact evidence fields before duplicate variants can bypass row identity", () => {
    const decision = evaluateAstraMacroCiArtifactPacket([
      ...completeCiArtifactPacket,
      {
        ...completeCiArtifactPacket[0],
        evidenceField: " CIQUALITYARTIFACTSATTACHED " as never,
      },
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings).toEqual([
      {
        evidenceField: " CIQUALITYARTIFACTSATTACHED ",
        message: " CIQUALITYARTIFACTSATTACHED  must use canonical CI artifact evidence field casing without surrounding whitespace.",
        nextStep: "Use ciQualityArtifactsAttached or ciLiveBrowserArtifactsAttached exactly as defined.",
      },
      {
        evidenceField: " CIQUALITYARTIFACTSATTACHED ",
        message: " CIQUALITYARTIFACTSATTACHED  has duplicate CI artifact evidence rows.",
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

  it("rejects CI artifact packets whose quality and live-browser rows point to different GitHub repositories", () => {
    const decision = evaluateAstraMacroCiArtifactPacket([
      completeCiArtifactPacket[0],
      {
        ...completeCiArtifactPacket[1],
        runUrl: "https://github.com/astra-release/astra-fork/actions/runs/123457",
        artifactUrl: "https://github.com/astra-release/astra-fork/actions/runs/123457/artifacts/654322",
      },
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings).toEqual([
      {
        evidenceField: "ciQualityArtifactsAttached/ciLiveBrowserArtifactsAttached",
        message: "CI quality and live-browser artifact URLs must point to the same GitHub repository.",
        nextStep: "Attach quality-gate-results and live-bench-results artifacts from the same target GitHub repository.",
      },
      {
        evidenceField: "ciLiveBrowserArtifactsAttached",
        message: "CI live-browser release-proof artifact CI run URL must point to an allowed Astra GitHub repository.",
        nextStep: "Attach the GitHub Actions run URL from astra-release/astra or raydocs/Astra for the target commit/SHA.",
      },
      {
        evidenceField: "ciLiveBrowserArtifactsAttached",
        message: "CI live-browser release-proof artifact downloadable artifact URL must point to an allowed Astra GitHub repository.",
        nextStep: "Attach the GitHub Actions artifact URL from astra-release/astra or raydocs/Astra for the target commit/SHA.",
      },
    ])
  })

  it("rejects CI artifact packets from a same-named non-Astra GitHub repository", () => {
    const decision = evaluateAstraMacroCiArtifactPacket(completeCiArtifactPacket.map((row) => ({
      ...row,
      runUrl: row.runUrl.replace("github.com/astra-release/astra", "github.com/evil-org/astra"),
      artifactUrl: row.artifactUrl.replace("github.com/astra-release/astra", "github.com/evil-org/astra"),
    })))

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "CI quality gate artifact CI run URL must point to an allowed Astra GitHub repository.",
      "CI quality gate artifact downloadable artifact URL must point to an allowed Astra GitHub repository.",
      "CI live-browser release-proof artifact CI run URL must point to an allowed Astra GitHub repository.",
      "CI live-browser release-proof artifact downloadable artifact URL must point to an allowed Astra GitHub repository.",
    ])
  })

  it("rejects CI artifact target commits with surrounding whitespace", () => {
    const decision = evaluateAstraMacroCiArtifactPacket([
      {
        ...completeCiArtifactPacket[0],
        commitSha: " abc123def456 ",
      },
      completeCiArtifactPacket[1],
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "CI quality gate artifact target commit/SHA must be a 7-40 character non-zero hex SHA.",
    ])
  })

  it("rejects weak or non-canonical CI workflow names", () => {
    const decision = evaluateAstraMacroCiArtifactPacket([
      {
        ...completeCiArtifactPacket[0],
        workflowName: " latest quality ",
      },
      completeCiArtifactPacket[1],
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "CI quality gate artifact CI workflow name is placeholder evidence or not canonical.",
    ])
  })

  it("rejects CI artifact identity fields with surrounding whitespace before trim-normalized helpers can accept them", () => {
    const decision = evaluateAstraMacroCiArtifactPacket([
      {
        ...completeCiArtifactPacket[0],
        runId: ` ${completeCiArtifactPacket[0].runId} `,
        jobName: ` ${completeCiArtifactPacket[0].jobName} `,
        artifactId: ` ${completeCiArtifactPacket[0].artifactId} `,
        artifactDigest: ` ${completeCiArtifactPacket[0].artifactDigest} `,
      },
      completeCiArtifactPacket[1],
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "CI quality gate artifact CI run id must be canonical without surrounding whitespace.",
      "CI quality gate artifact CI job name must be canonical without surrounding whitespace.",
      "CI quality gate artifact artifact id must be canonical without surrounding whitespace.",
      "CI quality gate artifact artifact digest/checksum must be canonical without surrounding whitespace.",
    ])
  })

  it("rejects failed or missing CI conclusions so always-uploaded artifacts cannot prove final CI evidence", () => {
    const decision = evaluateAstraMacroCiArtifactPacket([
      {
        ...completeCiArtifactPacket[0],
        workflowConclusion: "failure",
        jobConclusion: "cancelled",
      },
      completeCiArtifactPacket[1],
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "CI quality gate artifact workflow conclusion must be success.",
      "CI quality gate artifact job conclusion must be success.",
    ])
  })

  it("rejects non-canonical CI conclusion casing and surrounding whitespace", () => {
    const decision = evaluateAstraMacroCiArtifactPacket([
      {
        ...completeCiArtifactPacket[0],
        workflowConclusion: " Success ",
        jobConclusion: "SUCCESS",
      },
      completeCiArtifactPacket[1],
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "CI quality gate artifact workflow conclusion must be success.",
      "CI quality gate artifact job conclusion must be success.",
    ])
  })

  it("rejects weak CI artifact URL, SHA, date, and manifest references", () => {
    const decision = evaluateAstraMacroCiArtifactPacket([
      {
        ...completeCiArtifactPacket[0],
        runId: "run:000000000000",
        jobName: "mock release job",
        artifactId: "aaaaaaaaaaaa",
        artifactDigest: "000000000000",
        artifactManifestPath: "docs/release%2e%2e-artifacts/quality-gate-manifest.json",
        runUrl: "http://github.com/astra-release/actions/runs/123",
        artifactUrl: "https://[::ffff:a00:1]/artifacts/quality-gate-results.zip",
        commitSha: "0000000",
        ownerDate: "Release owner",
      },
      completeCiArtifactPacket[1],
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "CI quality and live-browser artifacts must target the same commit/SHA.",
      "CI quality gate artifact CI run id must be an immutable CI run identity, not a generic version or date.",
      "CI quality gate artifact CI job name is placeholder evidence.",
      "CI quality gate artifact artifact id must be an immutable uploaded artifact identity, not a generic version or date.",
      "CI quality gate artifact artifact digest/checksum must be a canonical sha/checksum/digest-prefixed hex value.",
      "CI quality gate artifact artifact manifest path must point to a quality-gate-results manifest.json artifact.",
      "CI quality gate artifact CI run URL must be a GitHub Actions run URL.",
      "CI quality gate artifact downloadable artifact URL must be a GitHub Actions artifact URL.",
      "CI quality gate artifact target commit/SHA must be a 7-40 character non-zero hex SHA.",
      "CI quality gate artifact owner/date must identify a real owner and include a YYYY-MM-DD date.",
    ])
  })

  it("rejects prose-like CI artifact digest tokens with checksum prefixes", () => {
    const decision = evaluateAstraMacroCiArtifactPacket([
      {
        ...completeCiArtifactPacket[0],
        artifactDigest: "sha256:release-quality-artifact-20260528",
      },
      completeCiArtifactPacket[1],
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "CI quality gate artifact artifact digest/checksum must be a canonical sha/checksum/digest-prefixed hex value.",
    ])
  })

  it("rejects generic CI identities, generic public URLs, and unrelated manifest paths", () => {
    const decision = evaluateAstraMacroCiArtifactPacket([
      {
        ...completeCiArtifactPacket[0],
        runId: "v1.2.3",
        artifactId: "2026-05-28",
        artifactManifestPath: "docs/reviews/macro-final-completion-gate-2026-05-28.md",
        runUrl: "https://release-evidence.astra-cdn.net/actions/runs/123456",
        artifactUrl: "https://release-evidence.astra-cdn.net/actions/artifacts/654321",
      },
      completeCiArtifactPacket[1],
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "CI quality gate artifact CI run id must be an immutable CI run identity, not a generic version or date.",
      "CI quality gate artifact artifact id must be an immutable uploaded artifact identity, not a generic version or date.",
      "CI quality gate artifact artifact manifest path must point to a quality-gate-results manifest.json artifact.",
      "CI quality gate artifact CI run URL must be a GitHub Actions run URL.",
      "CI quality gate artifact downloadable artifact URL must be a GitHub Actions artifact URL.",
    ])
  })

  it.each([
    [
      "surrounding whitespace",
      " https://github.com/astra-release/astra/actions/runs/1234567890",
      "https://github.com/astra-release/astra/actions/runs/1234567890/artifacts/987654321 ",
    ],
    [
      "encoded whitespace",
      "https://github.com/astra-release/astra/actions/runs/%201234567890",
      "https://github.com/astra-release/astra/actions/runs/1234567890/artifacts/%20987654321",
    ],
    [
      "encoded zero-width separator",
      "https://github.com/astra-release/astra/actions/runs/%E2%80%8B1234567890",
      "https://github.com/astra-release/astra/actions/runs/1234567890/artifacts/%E2%80%8B987654321",
    ],
  ])("rejects CI artifact URLs with %s", (_label, runUrl, artifactUrl) => {
    const decision = evaluateAstraMacroCiArtifactPacket([
      {
        ...completeCiArtifactPacket[0],
        runUrl,
        artifactUrl,
      },
      completeCiArtifactPacket[1],
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "CI quality gate artifact CI run URL must be a GitHub Actions run URL.",
      "CI quality gate artifact downloadable artifact URL must be a GitHub Actions artifact URL.",
    ])
  })

  it("rejects duplicate uploaded CI artifact ids, digests, and artifact URLs across final CI rows", () => {
    const decision = evaluateAstraMacroCiArtifactPacket([
      completeCiArtifactPacket[0],
      {
        ...completeCiArtifactPacket[1],
        runId: completeCiArtifactPacket[0].runId,
        artifactId: completeCiArtifactPacket[0].artifactId,
        artifactDigest: completeCiArtifactPacket[0].artifactDigest,
        runUrl: completeCiArtifactPacket[0].runUrl,
        artifactUrl: completeCiArtifactPacket[0].artifactUrl,
      },
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      `ciLiveBrowserArtifactsAttached reuses CI artifact id ${completeCiArtifactPacket[0].artifactId}.`,
      `ciLiveBrowserArtifactsAttached reuses CI artifact digest ${completeCiArtifactPacket[0].artifactDigest}.`,
      `ciLiveBrowserArtifactsAttached reuses CI artifact URL ${completeCiArtifactPacket[0].artifactUrl}.`,
    ])
  })

  it("rejects duplicate CI artifact manifest paths across final CI rows", () => {
    const sharedManifestPath = "data/release-artifacts/quality-gate-results-live-bench-results/manifest.json"
    const decision = evaluateAstraMacroCiArtifactPacket([
      {
        ...completeCiArtifactPacket[0],
        artifactManifestPath: sharedManifestPath,
      },
      {
        ...completeCiArtifactPacket[1],
        artifactManifestPath: sharedManifestPath,
      },
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      `ciLiveBrowserArtifactsAttached reuses CI artifact manifest path ${sharedManifestPath}.`,
    ])
  })

  it("rejects duplicate CI artifact ids that differ only by case or stable identity prefix", () => {
    const duplicateArtifactId = `artifact:${completeCiArtifactPacket[0].artifactId.toUpperCase()}`
    const decision = evaluateAstraMacroCiArtifactPacket([
      completeCiArtifactPacket[0],
      {
        ...completeCiArtifactPacket[1],
        artifactId: duplicateArtifactId,
        artifactUrl: "https://github.com/astra-release/astra/actions/runs/123457/artifacts/654321",
      },
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      `ciLiveBrowserArtifactsAttached reuses CI artifact id ${duplicateArtifactId}.`,
    ])
  })

  it("rejects duplicate CI artifact URLs that differ only by URL scheme, host casing, or unreserved URL encoding", () => {
    const duplicateArtifactUrl = completeCiArtifactPacket[0].artifactUrl
      .replace("https://github.com", "HTTPS://GITHUB.COM")
      .replace("artifacts", "%61rtifacts")
    const decision = evaluateAstraMacroCiArtifactPacket([
      completeCiArtifactPacket[0],
      {
        ...completeCiArtifactPacket[1],
        runId: completeCiArtifactPacket[0].runId,
        artifactId: completeCiArtifactPacket[0].artifactId,
        artifactUrl: duplicateArtifactUrl,
      },
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual(expect.arrayContaining([
      `ciLiveBrowserArtifactsAttached reuses CI artifact id ${completeCiArtifactPacket[0].artifactId}.`,
      `ciLiveBrowserArtifactsAttached reuses CI artifact URL ${duplicateArtifactUrl}.`,
    ]))
  })

  it("rejects CI artifact ids and URLs that do not describe the same GitHub Actions run artifact", () => {
    const decision = evaluateAstraMacroCiArtifactPacket([
      {
        ...completeCiArtifactPacket[0],
        runId: "123999",
        artifactId: "654999",
        runUrl: "https://github.com/astra-release/astra/actions/runs/123456",
        artifactUrl: "https://github.com/astra-release/other/actions/runs/123888/artifacts/654321",
      },
      completeCiArtifactPacket[1],
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual(expect.arrayContaining([
      "CI quality gate artifact CI run id must match the GitHub Actions run URL.",
      "CI quality gate artifact artifact id must match the GitHub Actions artifact URL.",
      "CI quality gate artifact CI run URL and artifact URL must point to the same GitHub repository.",
      "CI quality gate artifact CI run id must match the run segment in the artifact URL.",
    ]))
  })

  it("rejects CI artifact URLs that omit the GitHub Actions run segment", () => {
    const decision = evaluateAstraMacroCiArtifactPacket([
      {
        ...completeCiArtifactPacket[0],
        runId: "123456",
        artifactId: "654321",
        runUrl: "https://github.com/astra-release/astra/actions/runs/123456",
        artifactUrl: "https://github.com/astra-release/astra/actions/artifacts/654321",
      },
      completeCiArtifactPacket[1],
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toContain(
      "CI quality gate artifact downloadable artifact URL must be a GitHub Actions artifact URL.",
    )
  })

  it("accepts CI artifact packets only when quality commands and live release-proof lanes are covered", () => {
    expect(evaluateAstraMacroCiArtifactPacket(completeCiArtifactPacket)).toEqual({ acceptable: true, findings: [] })
  })

  it("rejects negated CI coverage entries so missing commands or lanes cannot satisfy required coverage", () => {
    const decision = evaluateAstraMacroCiArtifactPacket([
      {
        ...completeCiArtifactPacket[0],
        coverage: completeCiArtifactPacket[0].coverage.map((entry) => entry === "pnpm test" ? "NOT RUN: pnpm test" : entry),
      },
      {
        ...completeCiArtifactPacket[1],
        coverage: completeCiArtifactPacket[1].coverage.map((entry) => entry === "source-core" ? "missing source-core" : entry),
      },
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "CI quality gate artifact is missing required coverage: pnpm test.",
      "CI live-browser release-proof artifact is missing required coverage: source-core.",
    ])
  })

  it("accepts stable numeric GitHub Actions run and artifact ids", () => {
    const decision = evaluateAstraMacroCiArtifactPacket([
      {
        ...completeCiArtifactPacket[0],
        runId: "123456",
        artifactId: "654321",
      },
      {
        ...completeCiArtifactPacket[1],
        runId: "123457",
        artifactId: "654322",
      },
    ])

    expect(decision).toEqual({ acceptable: true, findings: [] })
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
        evidenceLink: "https://release-evidence.astra-cdn.net/billing-checkout/2026-05-28",
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
        artifactDigestOrVersion: "sha256:56789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01234",
        targetChannel: "gtm target release channel",
        claimBoundary: "gtm",
        evidenceLink: "https://release-evidence.astra-cdn.net/launch-artifacts/press-kit",
        ownerDate: "qa-owner@astra.ai — 2026-05-28",
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

  it("rejects non-canonical launch artifact requirement ids before duplicate variants can bypass row identity", () => {
    const decision = evaluateAstraMacroLaunchArtifactPacket([
      ...completeLaunchArtifactRows,
      {
        ...completeLaunchArtifactRows[0],
        requirementId: " BILLING_CHECKOUT " as never,
      },
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings).toEqual([
      {
        requirementId: " BILLING_CHECKOUT ",
        group: "billing",
        message: " BILLING_CHECKOUT  must use canonical launch artifact requirement id casing without surrounding whitespace.",
        nextStep: "Use the exact requirement id from ASTRA_MACRO_LAUNCH_ARTIFACT_REQUIREMENTS.",
      },
      {
        requirementId: " BILLING_CHECKOUT ",
        group: "billing",
        message: " BILLING_CHECKOUT  has duplicate launch artifact evidence rows.",
        nextStep: "Keep one launch artifact evidence row per billing/legal/store/GTM requirement.",
      },
    ])
  })

  it("rejects duplicate launch artifact ids and evidence links across requirements", () => {
    const sharedEvidenceLink = "https://release-evidence.astra-cdn.net/launch-artifacts/billing-checkout-billing-webhook.md"
    const decision = evaluateAstraMacroLaunchArtifactPacket([
      {
        ...completeLaunchArtifactRows[0],
        evidenceLink: sharedEvidenceLink,
      },
      {
        ...completeLaunchArtifactRows[1],
        artifactId: completeLaunchArtifactRows[0].artifactId,
        evidenceLink: sharedEvidenceLink,
      },
      ...completeLaunchArtifactRows.slice(2),
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      `billing_webhook reuses launch artifact id ${completeLaunchArtifactRows[0].artifactId}.`,
      `billing_webhook reuses launch artifact evidence link ${sharedEvidenceLink}.`,
    ])
  })

  it("rejects launch artifact evidence links that point at a different launch requirement", () => {
    const decision = evaluateAstraMacroLaunchArtifactPacket([
      {
        ...completeLaunchArtifactRows[0],
        evidenceLink: "https://release-evidence.astra-cdn.net/launch-artifacts/gtm-copy-claim-review.md",
      },
      ...completeLaunchArtifactRows.slice(1),
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "Billing checkout success/cancel evidence link must identify billing and billing_checkout launch evidence.",
    ])
  })

  it("rejects duplicate launch artifact ids that differ only by case or stable identity prefix", () => {
    const duplicateArtifactId = `artifact:${completeLaunchArtifactRows[0].artifactId.toUpperCase()}`
    const decision = evaluateAstraMacroLaunchArtifactPacket([
      completeLaunchArtifactRows[0],
      {
        ...completeLaunchArtifactRows[1],
        artifactId: duplicateArtifactId,
      },
      ...completeLaunchArtifactRows.slice(2),
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      `billing_webhook reuses launch artifact id ${duplicateArtifactId}.`,
    ])
  })

  it("rejects duplicate URL-like launch artifact ids that differ only by URL casing or unreserved encoding", () => {
    const artifactId = "https://release-evidence.astra-cdn.net/launch-artifacts/billing-checkout-artifact-123"
    const duplicateArtifactId = "HTTPS://RELEASE-EVIDENCE.ASTRA-CDN.NET/launch-%61rtifacts/billing-checkout-artifact-123"
    const decision = evaluateAstraMacroLaunchArtifactPacket([
      {
        ...completeLaunchArtifactRows[0],
        artifactId,
      },
      {
        ...completeLaunchArtifactRows[1],
        artifactId: duplicateArtifactId,
      },
      ...completeLaunchArtifactRows.slice(2),
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      `billing_webhook reuses launch artifact id ${duplicateArtifactId}.`,
    ])
  })

  it("rejects duplicate launch artifact digest/checksum values across requirements", () => {
    const decision = evaluateAstraMacroLaunchArtifactPacket([
      completeLaunchArtifactRows[0],
      {
        ...completeLaunchArtifactRows[1],
        artifactDigestOrVersion: completeLaunchArtifactRows[0].artifactDigestOrVersion,
      },
      ...completeLaunchArtifactRows.slice(2),
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      `billing_webhook reuses launch artifact digest/version ${completeLaunchArtifactRows[0].artifactDigestOrVersion}.`,
    ])
  })

  it("rejects duplicate non-digest launch artifact versions across independent requirements", () => {
    const sharedVersion = "release-artifact-v2026.05.28-rc1"
    const decision = evaluateAstraMacroLaunchArtifactPacket([
      {
        ...completeLaunchArtifactRows[0],
        artifactDigestOrVersion: sharedVersion,
      },
      {
        ...completeLaunchArtifactRows[1],
        artifactDigestOrVersion: sharedVersion,
      },
      ...completeLaunchArtifactRows.slice(2),
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      `billing_webhook reuses launch artifact digest/version ${sharedVersion}.`,
    ])
  })

  it("rejects duplicate launch evidence links that differ only by URL scheme, host casing, or unreserved URL encoding", () => {
    const sharedEvidenceLink = "https://release-evidence.astra-cdn.net/launch-artifacts/billing-checkout-billing-webhook.md"
    const duplicateEvidenceLink = sharedEvidenceLink
      .replace("https://release-evidence.astra-cdn.net", "HTTPS://RELEASE-EVIDENCE.ASTRA-CDN.NET")
      .replace("launch-artifacts", "launch-%61rtifacts")
    const decision = evaluateAstraMacroLaunchArtifactPacket([
      {
        ...completeLaunchArtifactRows[0],
        evidenceLink: sharedEvidenceLink,
      },
      {
        ...completeLaunchArtifactRows[1],
        evidenceLink: duplicateEvidenceLink,
      },
      ...completeLaunchArtifactRows.slice(2),
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      `billing_webhook reuses launch artifact evidence link ${duplicateEvidenceLink}.`,
    ])
  })

  it("rejects launch artifact identity and context fields with surrounding whitespace", () => {
    const decision = evaluateAstraMacroLaunchArtifactPacket([
      {
        ...completeLaunchArtifactRows[0],
        artifactType: ` ${completeLaunchArtifactRows[0].artifactType} `,
        artifactId: ` ${completeLaunchArtifactRows[0].artifactId} `,
        artifactDigestOrVersion: ` ${completeLaunchArtifactRows[0].artifactDigestOrVersion} `,
        targetChannel: ` ${completeLaunchArtifactRows[0].targetChannel} `,
        environment: ` ${completeLaunchArtifactRows[0].environment} `,
      },
      ...completeLaunchArtifactRows.slice(1),
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "Billing checkout success/cancel artifact type must be canonical without surrounding whitespace.",
      "Billing checkout success/cancel artifact id must be canonical without surrounding whitespace.",
      "Billing checkout success/cancel artifact digest or version must be canonical without surrounding whitespace.",
      "Billing checkout success/cancel target channel must be canonical without surrounding whitespace.",
      "Billing checkout success/cancel environment or target channel context must be canonical without surrounding whitespace.",
    ])
  })

  it("rejects weak launch artifact identity, boundary, owner date, and evidence reference", () => {
    const decision = evaluateAstraMacroLaunchArtifactPacket([
      {
        ...completeLaunchArtifactRows[0],
        artifactType: "draft billing artifact",
        artifactId: "000000000000",
        artifactDigestOrVersion: "000000000000",
        targetChannel: "pending channel",
        claimBoundary: "gtm",
        evidenceLink: "not-a-link",
        ownerDate: "Release owner — 2026-05-28",
        environment: "placeholder environment",
      },
      ...completeLaunchArtifactRows.slice(1),
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "Billing checkout success/cancel claim boundary is gtm, expected billing.",
      "Billing checkout success/cancel artifact type is placeholder evidence.",
      "Billing checkout success/cancel artifact id must be a stable artifact identity.",
      "Billing checkout success/cancel artifact digest or version must be a stable digest, checksum, build hash, policy version, store version, or media version.",
      "Billing checkout success/cancel target channel is placeholder evidence.",
      "Billing checkout success/cancel evidence link must be a URL or repo artifact path.",
      "Billing checkout success/cancel owner/date must identify a real owner and include a YYYY-MM-DD date.",
      "Billing checkout success/cancel environment or target channel context is placeholder evidence.",
    ])
  })

  it("rejects generic launch artifact environments without group-specific target channel context", () => {
    const decision = evaluateAstraMacroLaunchArtifactPacket([
      {
        ...completeLaunchArtifactRows[0],
        environment: "production channel",
      },
      ...completeLaunchArtifactRows.slice(1),
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "Billing checkout success/cancel environment or target channel context must include target-release channel plus billing_checkout context.",
    ])
  })

  it("rejects generic launch artifact type and target channel values without requirement-specific context", () => {
    const decision = evaluateAstraMacroLaunchArtifactPacket([
      {
        ...completeLaunchArtifactRows[0],
        artifactType: "release artifact",
        targetChannel: "target release channel",
      },
      ...completeLaunchArtifactRows.slice(1),
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "Billing checkout success/cancel artifact type must identify a concrete billing launch artifact surface for billing_checkout.",
      "Billing checkout success/cancel target channel must identify a concrete billing launch channel for billing_checkout.",
    ])
  })

  it("rejects same-group launch artifacts that describe the wrong requirement", () => {
    const decision = evaluateAstraMacroLaunchArtifactPacket([
      {
        ...completeLaunchArtifactRows[0],
        artifactType: "billing webhook receipt artifact",
        targetChannel: "billing webhook production channel",
        environment: "billing webhook production channel",
      },
      ...completeLaunchArtifactRows.slice(1),
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "Billing checkout success/cancel artifact type must identify a concrete billing launch artifact surface for billing_checkout.",
      "Billing checkout success/cancel target channel must identify a concrete billing launch channel for billing_checkout.",
      "Billing checkout success/cancel environment or target channel context must include target-release channel plus billing_checkout context.",
    ])
  })

  it("rejects prose-like launch artifact checksum tokens while still allowing stable versions", () => {
    const decision = evaluateAstraMacroLaunchArtifactPacket([
      {
        ...completeLaunchArtifactRows[0],
        artifactDigestOrVersion: "sha256:billing-checkout-artifact-20260528",
      },
      ...completeLaunchArtifactRows.slice(1),
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "Billing checkout success/cancel artifact digest or version checksum must be a canonical sha/checksum/digest-prefixed hex value.",
    ])
  })

  it("accepts stable launch artifact version formats without requiring checksum-length identities", () => {
    const stableVersions = completeLaunchArtifactRows.map((_, index) => {
      if (index % 3 === 0) return `v1.0.${index + 1}`
      if (index % 3 === 1) return `terms-v${index + 3}`
      return `release-artifact-2026-05-${String(index + 10).padStart(2, "0")}`
    })
    const decision = evaluateAstraMacroLaunchArtifactPacket(completeLaunchArtifactRows.map((row, index) => ({
      ...row,
      artifactDigestOrVersion: stableVersions[index]!,
    })))

    expect(decision).toEqual({ acceptable: true, findings: [] })
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
    expect(committedNote).toContain("7-40 character non-zero hex target commit/SHA")
    expect(committedNote).toContain("ci_live_browser_artifacts")
    expect(committedNote).toContain("owner_release_approval")
    expect(committedNote).toContain("approver/date containing a real calendar YYYY-MM-DD")
    expect(committedNote).toContain("7-40 character non-zero hex target commit/SHA")
    expect(committedNote).toContain("manual_qa_checklist")
    expect(committedNote).toContain("Section 6/7/13/14/24/32")
    expect(committedNote).toContain("owner/date")
    expect(committedNote).toContain("`pass` or `pass-with-downgrade`")
    expect(committedNote).toContain("human_scored_ai_quality")
    expect(committedNote).toContain("reviewer/date containing a real calendar YYYY-MM-DD")
    expect(committedNote).toContain("real target environment")
    expect(committedNote).toContain("stable non-weak run metadata and fixture manifest version")
    expect(committedNote).toContain("URL or repo artifact-path live provider samples and blocker triage")
    expect(committedNote).toContain("finite sample counts matching summarized P0 samples")
    expect(committedNote).toContain("billing_legal_store_gtm_artifacts")
    expect(committedNote).toContain("owner/date containing a real calendar YYYY-MM-DD, real environment/channel context")
    expect(committedNote).toContain("URL or repo artifact-path evidence link before launch-complete claims")
    expect(committedNote).toContain("production_metrics_export")
    expect(committedNote).toContain("valid non-reversed canonical shared YYYY-MM-DD..YYYY-MM-DD date range")
    expect(committedNote).toContain("real cohort/source/export id without surrounding whitespace")
    expect(committedNote).toContain("stable non-weak query version")
    expect(committedNote).toContain("category-aligned non-duplicated metric ids")
    expect(committedNote).toContain("URL or repo artifact-path evidence/privacy links")
    expect(committedNote).toContain("product-metrics readiness evidence accepted by evaluateAstraProductMetricsReadiness()")
    expect(committedNote).toContain("with non-placeholder label, owner/date, and URL or repo artifact-path evidence link")
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
