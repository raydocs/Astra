import { readFile } from "node:fs/promises"

import {
  ASTRA_AI_QUALITY_ABILITY_CATEGORIES,
  ASTRA_AI_QUALITY_ERROR_TAXONOMY,
  evaluateAiQualityHumanScoredReportEvidence,
} from "../../src/utils/ai-quality-system"
import type { AiQualityRunSummary } from "../../src/utils/ai-quality-system"
import type {
  AstraMacroOperationalEvidenceAreaId,
  AstraMacroOperationalEvidenceCompletionPacketRow,
  AstraMacroPlanCompletionEvidence,
} from "../../src/utils/macro-operational-evidence"
import {
  ASTRA_PRODUCTION_METRIC_EXPORT_REQUIREMENTS,
  evaluateAstraProductionMetricsExportPacket,
} from "../../src/utils/product-metrics"
import {
  ASTRA_MACRO_CI_ARTIFACT_REQUIREMENTS,
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
  renderAstraMacroPlanCompletionGateNote,
} from "../../src/utils/macro-operational-evidence"

const FINAL_COMPLETION_EVIDENCE_PATH = "docs/reviews/macro-final-completion-evidence-2026-05-28.json"
const FINAL_COMPLETION_GATE_PATH = "docs/reviews/macro-final-completion-gate-2026-05-28.md"
const FINAL_EVIDENCE_INTAKE_PATH = "docs/reviews/macro-final-evidence-intake-2026-05-28.md"
const MANUAL_QA_CHECKLIST_PATH = "docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md"
const OPERATIONAL_COMPLETION_PACKET_PATH = "docs/reviews/macro-operational-evidence-completion-packet-2026-05-28.json"
const CI_ARTIFACT_PACKET_PATH = "docs/reviews/macro-ci-artifact-packet-2026-05-28.json"
const OWNER_RELEASE_APPROVAL_PACKET_PATH = "docs/reviews/macro-owner-release-approval-packet-2026-05-28.json"
const LAUNCH_ARTIFACT_PACKET_PATH = "docs/reviews/macro-launch-artifact-packet-2026-05-28.json"
const AI_QUALITY_HUMAN_SCORED_PACKET_PATH = "docs/reviews/macro-ai-quality-human-scored-packet-2026-05-28.json"
const PRODUCTION_METRICS_EXPORT_PACKET_PATH = "docs/reviews/macro-production-metrics-export-packet-2026-05-28.json"

const FINAL_COMPLETION_EVIDENCE_KEYS = [
  "ciQualityArtifactsAttached",
  "ciLiveBrowserArtifactsAttached",
  "ownerReleaseApprovalRecorded",
  "manualQaChecklistComplete",
  "humanScoredAiQualityReportAttached",
  "billingLegalStoreGtmArtifactsAttached",
  "productionMetricsExportAttached",
] as const satisfies ReadonlyArray<keyof AstraMacroPlanCompletionEvidence>

const ALLOWED_MANUAL_QA_VERDICTS = new Set(["pass", "pass-with-downgrade", "fail", "not-run"])
const PASSING_MANUAL_QA_VERDICTS = new Set(["pass", "pass-with-downgrade"])

type FinalCompletionEvidenceKey = (typeof FINAL_COMPLETION_EVIDENCE_KEYS)[number]

const REQUIRED_EVIDENCE_LINK_PATHS: Record<FinalCompletionEvidenceKey, string[]> = {
  ciQualityArtifactsAttached: [CI_ARTIFACT_PACKET_PATH],
  ciLiveBrowserArtifactsAttached: [CI_ARTIFACT_PACKET_PATH],
  ownerReleaseApprovalRecorded: [OWNER_RELEASE_APPROVAL_PACKET_PATH],
  manualQaChecklistComplete: [MANUAL_QA_CHECKLIST_PATH],
  humanScoredAiQualityReportAttached: [AI_QUALITY_HUMAN_SCORED_PACKET_PATH],
  billingLegalStoreGtmArtifactsAttached: [LAUNCH_ARTIFACT_PACKET_PATH],
  productionMetricsExportAttached: [PRODUCTION_METRICS_EXPORT_PACKET_PATH],
}

const REQUIRED_EVIDENCE_LINK_PATTERNS: Record<FinalCompletionEvidenceKey, RegExp[]> = {
  ciQualityArtifactsAttached: [
    /quality-gate-results/i,
    /quality/i,
    /run|workflow|job/i,
    /artifact/i,
    /commit|sha/i,
    /pnpm check:repo-knowledge/i,
    /pnpm check:zod-entrypoints/i,
    /pnpm check:macro-final-completion/i,
    /pnpm type-check/i,
    /pnpm lint:ci/i,
    /pnpm test/i,
    /pnpm bench/i,
  ],
  ciLiveBrowserArtifactsAttached: [
    /live-bench-results/i,
    /live-browser/i,
    /run|workflow|job/i,
    /artifact/i,
    /commit|sha/i,
    /source-core/i,
    /extension-core/i,
    /learning-loop/i,
    /document-proof/i,
    /youtube-proof/i,
    /youtube-holdout/i,
  ],
  ownerReleaseApprovalRecorded: [
    /macro-gate-4-claim-review/i,
    /macro-rc-evidence-packet/i,
    /macro-final-completion-gate/i,
    /approver|owner/i,
    /approval/i,
    /YYYY-MM-DD|date/i,
    /URL|repo artifact path|record link/i,
    /commit|sha/i,
    /remaining final blockers|complete:\s*no|blocker/i,
    /downgrade/i,
  ],
  manualQaChecklistComplete: [
    /macro-manual-qa-evidence-checklist/i,
    /manual QA|manual\/browser QA/i,
    /section 6/i,
    /section 7/i,
    /section 13/i,
    /section 14/i,
    /section 24/i,
    /section 32/i,
    /owner|date/i,
    /environment/i,
    /evidence/i,
    /pass-with-downgrade|pass/i,
  ],
  humanScoredAiQualityReportAttached: [
    /human-scored|human scored|human/i,
    /ai-quality|quality/i,
    /evaluateAiQualityHumanScoredReportEvidence/i,
    /reviewer|review date|reviewed/i,
    /run id|rubric version|run metadata/i,
    /fixture manifest/i,
    /live provider|provider sample/i,
    /scored|P0/i,
    /blocker triage/i,
    /trend/i,
    /release decision|approve_with_downgrade|approve|block/i,
    /threshold|release readiness/i,
  ],
  billingLegalStoreGtmArtifactsAttached: [
    /evaluateAstraMacroLaunchArtifactPacket/i,
    /billing/i,
    /checkout/i,
    /webhook/i,
    /entitlement|quota/i,
    /cancellation|refund/i,
    /legal|privacy|terms/i,
    /AI notice|AI limitation/i,
    /support\/contact|support contact|incident/i,
    /store/i,
    /zip hash|package hash|build provenance/i,
    /upload|submission/i,
    /reviewer/i,
    /screenshots/i,
    /gtm|demo/i,
    /storyboard/i,
    /copy claim review|claim review/i,
    /artifact type|artifact id|artifact identity/i,
    /digest|checksum|version/i,
    /claim boundary|billing.*legal.*store.*gtm/i,
    /owner|date/i,
    /environment|channel/i,
    /evidence/i,
  ],
  productionMetricsExportAttached: [
    /activation/i,
    /understanding/i,
    /learning/i,
    /membership/i,
    /date range|date-range/i,
    /cohort/i,
    /dashboard|query/i,
    /privacy/i,
    /owner/i,
    /export|analytics|metric/i,
  ],
}

const REQUIRED_EVIDENCE_INTAKE_TERMS = [
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
  "approval record link",
  "target commit/SHA",
  "remaining final blockers",
  "downgrade copy",
  "macro-manual-qa-evidence-checklist-2026-05-28.md",
  "evaluateAstraMacroManualQaEvidencePacket()",
  "pass-with-downgrade",
  "owner/date",
  "environment",
  "evidence link",
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
  "shared release date range",
  "shared release cohort",
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

type FinalCompletionEvidenceArtifact = {
  schema: "astra-macro-final-completion-evidence.v1"
  generatedAt: string
  label: string
  evidence: AstraMacroPlanCompletionEvidence
  evidenceLinks: Record<FinalCompletionEvidenceKey, string[]>
}

type OperationalEvidenceCompletionPacketRow = {
  areaId: string
  ownerDate: string
  environment: string
  evidenceLink: string
  requirementEvidence: string
  verdict: string
}

type OperationalEvidenceCompletionPacket = {
  schema: "astra-macro-operational-evidence-completion-packet.v1"
  generatedAt: string
  label: string
  rows: OperationalEvidenceCompletionPacketRow[]
}

type CiArtifactPacketRow = {
  evidenceField: string
  artifactName: string
  workflowName: string
  runId: string
  jobName: string
  workflowConclusion: string
  jobConclusion: string
  artifactId: string
  artifactDigest: string
  artifactManifestPath: string
  runUrl: string
  artifactUrl: string
  commitSha: string
  ownerDate: string
  coverage: string[]
}

type CiArtifactPacket = {
  schema: "astra-macro-ci-artifact-packet.v1"
  generatedAt: string
  label: string
  rows: CiArtifactPacketRow[]
}

type OwnerReleaseApprovalPacket = {
  schema: "astra-macro-owner-release-approval-packet.v1"
  generatedAt: string
  label: string
  approval: {
    approver: string
    approvalDate: string
    approvalRecordLink: string
    targetCommitSha: string
    decision: string
    reviewedArtifacts: string[]
    acknowledgesRemainingFinalBlockers: boolean
    acknowledgesDowngradeCopy: boolean
  }
}

type LaunchArtifactPacketRow = {
  requirementId: string
  artifactType: string
  artifactId: string
  artifactDigestOrVersion: string
  targetChannel: string
  claimBoundary: string
  evidenceLink: string
  ownerDate: string
  environment: string
}

type LaunchArtifactPacket = {
  schema: "astra-macro-launch-artifact-packet.v1"
  generatedAt: string
  label: string
  rows: LaunchArtifactPacketRow[]
}

type AiQualityHumanScoredPacket = {
  schema: "astra-macro-ai-quality-human-scored-packet.v1"
  generatedAt: string
  label: string
  evidence: Parameters<typeof evaluateAiQualityHumanScoredReportEvidence>[0]
}

const AI_QUALITY_SUMMARY_REQUIRED_KEYS = [
  "sampleCount",
  "p0SampleCount",
  "capabilityCount",
  "capabilityCounts",
  "capabilityAverages",
  "averageScore",
  "blockerSampleIds",
  "blockerErrorCounts",
  "reviewCardReusableRate",
  "reviewCardReusableCount",
  "reviewCardEvaluatedCount",
  "safetyPassRate",
  "safetyPassedCount",
  "safetyEvaluatedCount",
  "lowScoreBacklog",
  "reproducible",
] as const

const AI_QUALITY_SUMMARY_OPTIONAL_KEYS = ["runId", "generatedAt"] as const

type ProductionMetricsExportPacketRow = {
  category: string
  dateRange: string
  cohortDefinition: string
  dashboardOrQuerySource: string
  exportId: string
  exportedAt: string
  exportDigest: string
  queryVersion: string
  metricIds: string[]
  evidenceLink: string
  ownerDate: string
  privacyReviewLink: string
}

type ProductionMetricsExportPacket = {
  schema: "astra-macro-production-metrics-export-packet.v1"
  generatedAt: string
  label: string
  rows: ProductionMetricsExportPacketRow[]
}

type ManualQaChecklistRow = {
  section: number
  qaRow: string
  ownerDate: string
  environment: string
  evidenceLink: string
  verdict: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isPlaceholderEvidenceReference(value: string): boolean {
  const normalizedValue = value.toLowerCase()
  return normalizedValue.includes("example")
    || normalizedValue.includes("placeholder")
    || normalizedValue.includes("todo")
    || /\b(?:mock|draft|tbd|pending|temp|temporary)\b/.test(normalizedValue)
}

function digestOrVersionIdentity(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^(?:sha(?:256|384|512)?|checksum|digest|version|build|artifact|run|rubric|fixture|manifest|export|query)[:=/ -]+/, "")
}

function hasWeakEvidenceKeyword(value: string): boolean {
  return /\b(?:dummy|sample|fake|mock|draft|tbd|pending|temp|temporary|local|none|n\/a|na|latest|dev|test)\b/.test(value.trim().toLowerCase())
}

function isWeakDigestReference(value: string): boolean {
  const normalizedValue = value.trim().toLowerCase()
  const identityValue = digestOrVersionIdentity(value).replace(/[^a-z0-9]/g, "")

  return identityValue.length < 12
    || /^0+$/.test(identityValue)
    || /^([a-z0-9])\1+$/.test(identityValue)
    || hasWeakEvidenceKeyword(normalizedValue)
}

function isStableVersionReference(value: string): boolean {
  const normalizedValue = digestOrVersionIdentity(value)
  if (hasWeakEvidenceKeyword(normalizedValue) || isPlaceholderEvidenceReference(normalizedValue)) return false

  const compactValue = normalizedValue.replace(/[^a-z0-9]/g, "")
  if (!/\d/.test(compactValue) || /^0+$/.test(compactValue) || /^([a-z0-9])\1+$/.test(compactValue)) return false
  if (/^v?\d+\.\d+\.\d+(?:[-+][a-z0-9.-]+)?$/i.test(normalizedValue)) return true
  if (/^20\d{2}-\d{2}-\d{2}$/.test(normalizedValue)) return includesIsoDate(normalizedValue)
  return /^[a-z][a-z0-9]*(?:[-_.][a-z0-9]+)+$/i.test(normalizedValue)
}

function isWeakDigestOrVersionReference(value: string): boolean {
  return isWeakDigestReference(value) && !isStableVersionReference(value)
}

function isWeakContextEvidenceReference(value: string): boolean {
  const normalizedValue = value.trim().toLowerCase()
  return isPlaceholderEvidenceReference(normalizedValue) || hasWeakEvidenceKeyword(normalizedValue)
}

function includesIsoDate(value: string): boolean {
  const match = /\b(20\d{2}-\d{2}-\d{2})\b/.exec(value)
  return match ? parseIsoDate(match[1]) !== null : false
}

function parseIsoDate(value: string): number | null {
  const match = /^(20\d{2})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const timestamp = Date.UTC(year, month - 1, day)
  const date = new Date(timestamp)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null
  }
  return timestamp
}

function isIsoTimestamp(value: string): boolean {
  const trimmedValue = value.trim()
  if (!/^20\d{2}-\d{2}-\d{2}T/.test(trimmedValue) || Number.isNaN(Date.parse(trimmedValue))) {
    return false
  }
  return parseIsoDate(trimmedValue.slice(0, 10)) !== null
}

function validateIsoGeneratedAt(value: unknown, path: string, findings: string[]): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    findings.push(`${path}: expected an ISO timestamp string.`)
    return ""
  }
  if (!isIsoTimestamp(value)) {
    findings.push(`${path}: expected an ISO timestamp string.`)
  }
  return value
}

function isEvidenceLikeReference(value: string): boolean {
  const trimmedValue = value.trim()
  if (/^https?:\/\//.test(trimmedValue)) return /^https:\/\//.test(trimmedValue) && !isLocalUrlReference(trimmedValue)
  return isRepoArtifactPathReference(trimmedValue)
}

function isRepoArtifactPathReference(value: string): boolean {
  if (!/^(docs\/|data\/|artifacts\/|test-results\/|playwright-report\/)/.test(value)) return false
  if (value.startsWith("/") || value.includes("\\") || value.includes("?") || value.includes("#") || /%(?:2e|2f|5c)/i.test(value)) return false

  const segments = value.split("/")
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..")
}

function isLocalUrlReference(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname.length === 0
      || hostname === "localhost"
      || hostname.endsWith(".localhost")
      || hostname === "0.0.0.0"
      || /^127(?:\.\d{1,3}){3}$/.test(hostname)
      || /^10(?:\.\d{1,3}){3}$/.test(hostname)
      || /^192\.168(?:\.\d{1,3}){2}$/.test(hostname)
      || /^172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/.test(hostname)
      || /^169\.254(?:\.\d{1,3}){2}$/.test(hostname)
      || isPrivateIpv6Hostname(hostname)
  } catch {
    return true
  }
}

function isPrivateIpv6Hostname(hostname: string): boolean {
  const normalizedHostname = hostname.replace(/^\[|\]$/g, "")
  return normalizedHostname === "::1"
    || /^f[cd][0-9a-f]{2}:/i.test(normalizedHostname)
    || /^fe[89ab][0-9a-f]:/i.test(normalizedHostname)
}

function validateExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[], path: string, findings: string[]): void {
  const actualKeys = Object.keys(value).sort()
  const sortedExpectedKeys = [...expectedKeys].sort()

  for (const key of actualKeys) {
    if (!sortedExpectedKeys.includes(key)) {
      findings.push(`${path}.${key}: unknown field.`)
    }
  }

  for (const key of sortedExpectedKeys) {
    if (!actualKeys.includes(key)) {
      findings.push(`${path}.${key}: missing required field.`)
    }
  }
}

function validateEvidenceArtifact(value: unknown, findings: string[]): FinalCompletionEvidenceArtifact | null {
  if (!isRecord(value)) {
    findings.push(`${FINAL_COMPLETION_EVIDENCE_PATH}: expected top-level object.`)
    return null
  }

  validateExactKeys(value, ["schema", "generatedAt", "label", "evidence", "evidenceLinks"], "artifact", findings)

  if (value.schema !== "astra-macro-final-completion-evidence.v1") {
    findings.push("artifact.schema: expected astra-macro-final-completion-evidence.v1.")
  }
  validateIsoGeneratedAt(value.generatedAt, "artifact.generatedAt", findings)
  if (typeof value.label !== "string" || value.label.trim().length === 0) {
    findings.push("artifact.label: expected a non-empty string.")
  }
  if (!isRecord(value.evidence)) {
    findings.push("artifact.evidence: expected an object.")
    return null
  }
  if (!isRecord(value.evidenceLinks)) {
    findings.push("artifact.evidenceLinks: expected an object.")
    return null
  }

  validateExactKeys(value.evidence, FINAL_COMPLETION_EVIDENCE_KEYS, "artifact.evidence", findings)
  validateExactKeys(value.evidenceLinks, FINAL_COMPLETION_EVIDENCE_KEYS, "artifact.evidenceLinks", findings)

  const evidence = {} as AstraMacroPlanCompletionEvidence
  const evidenceLinks = {} as Record<FinalCompletionEvidenceKey, string[]>

  for (const key of FINAL_COMPLETION_EVIDENCE_KEYS) {
    const evidenceValue = value.evidence[key]
    const linkValue = value.evidenceLinks[key]

    if (typeof evidenceValue !== "boolean") {
      findings.push(`artifact.evidence.${key}: expected boolean.`)
      evidence[key] = false
    } else {
      evidence[key] = evidenceValue
    }

    if (!Array.isArray(linkValue)) {
      findings.push(`artifact.evidenceLinks.${key}: expected array.`)
      evidenceLinks[key] = []
      continue
    }

    const links = linkValue.filter((entry): entry is string => typeof entry === "string")
    if (links.length !== linkValue.length) {
      findings.push(`artifact.evidenceLinks.${key}: expected every link to be a string.`)
    }
    const seenLinks = new Set<string>()
    for (const [index, link] of links.entries()) {
      if (seenLinks.has(link)) {
        findings.push(`artifact.evidenceLinks.${key}[${index}]: duplicate evidence link.`)
      }
      seenLinks.add(link)
      if (link.trim().length === 0) {
        findings.push(`artifact.evidenceLinks.${key}[${index}]: expected non-empty link.`)
      } else if (isPlaceholderEvidenceReference(link)) {
        findings.push(`artifact.evidenceLinks.${key}[${index}]: placeholder evidence links are not allowed.`)
      } else if (!isEvidenceLikeReference(link)) {
        findings.push(`artifact.evidenceLinks.${key}[${index}]: expected URL or repo artifact path.`)
      }
    }
    if (!evidence[key] && links.length > 0) {
      findings.push(`artifact.evidenceLinks.${key}: false fields must keep evidenceLinks empty until the corresponding packet/checklist is acceptable.`)
    }
    if (evidence[key] && links.length === 0) {
      findings.push(`artifact.evidence.${key}: cannot be true without at least one evidence link.`)
    }
    if (evidence[key]) {
      for (const requiredPath of REQUIRED_EVIDENCE_LINK_PATHS[key]) {
        if (!links.some((link) => link.includes(requiredPath))) {
          findings.push(`artifact.evidenceLinks.${key}: expected a matching machine-readable packet path ${requiredPath}.`)
        }
      }
      for (const pattern of REQUIRED_EVIDENCE_LINK_PATTERNS[key]) {
        if (!links.some((link) => pattern.test(link))) {
          findings.push(`artifact.evidenceLinks.${key}: expected at least one link matching ${pattern}.`)
        }
      }
    }
    evidenceLinks[key] = links
  }

  return {
    schema: "astra-macro-final-completion-evidence.v1",
    generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : "",
    label: typeof value.label === "string" ? value.label : "",
    evidence,
    evidenceLinks,
  }
}

function validateOperationalEvidenceCompletionPacket(value: unknown, findings: string[]): OperationalEvidenceCompletionPacket | null {
  if (!isRecord(value)) {
    findings.push(`${OPERATIONAL_COMPLETION_PACKET_PATH}: expected top-level object.`)
    return null
  }

  validateExactKeys(value, ["schema", "generatedAt", "label", "rows"], "operationalPacket", findings)

  if (value.schema !== "astra-macro-operational-evidence-completion-packet.v1") {
    findings.push("operationalPacket.schema: expected astra-macro-operational-evidence-completion-packet.v1.")
  }
  validateIsoGeneratedAt(value.generatedAt, "operationalPacket.generatedAt", findings)
  if (typeof value.label !== "string" || value.label.trim().length === 0) {
    findings.push("operationalPacket.label: expected a non-empty string.")
  }
  if (!Array.isArray(value.rows)) {
    findings.push("operationalPacket.rows: expected array.")
    return null
  }

  const rows: OperationalEvidenceCompletionPacketRow[] = []
  for (const [index, row] of value.rows.entries()) {
    if (!isRecord(row)) {
      findings.push(`operationalPacket.rows[${index}]: expected object.`)
      continue
    }
    validateExactKeys(row, ["areaId", "ownerDate", "environment", "evidenceLink", "requirementEvidence", "verdict"], `operationalPacket.rows[${index}]`, findings)
    for (const field of ["areaId", "ownerDate", "environment", "evidenceLink", "requirementEvidence", "verdict"] as const) {
      if (typeof row[field] !== "string") {
        findings.push(`operationalPacket.rows[${index}].${field}: expected string.`)
      }
    }
    const parsedRow = {
      areaId: typeof row.areaId === "string" ? row.areaId : "",
      ownerDate: typeof row.ownerDate === "string" ? row.ownerDate : "",
      environment: typeof row.environment === "string" ? row.environment : "",
      evidenceLink: typeof row.evidenceLink === "string" ? row.evidenceLink : "",
      requirementEvidence: typeof row.requirementEvidence === "string" ? row.requirementEvidence : "",
      verdict: typeof row.verdict === "string" ? row.verdict : "",
    }
    if (parsedRow.verdict !== "proved" && parsedRow.verdict !== "not-proved") {
      findings.push(`operationalPacket.rows[${index}].verdict: expected proved or not-proved.`)
    }
    rows.push(parsedRow)
  }

  return {
    schema: "astra-macro-operational-evidence-completion-packet.v1",
    generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : "",
    label: typeof value.label === "string" ? value.label : "",
    rows,
  }
}

function validateOperationalCompletionPacketPreclaimRows(packet: OperationalEvidenceCompletionPacket, findings: string[]): void {
  const expectedAreaIds = new Set<string>(ASTRA_MACRO_OPERATIONAL_EVIDENCE.map((item) => item.id))
  const seenAreaIds = new Set<string>()
  const trackedRows: AstraMacroOperationalEvidenceCompletionPacketRow[] = []

  for (const row of packet.rows) {
    if (!expectedAreaIds.has(row.areaId)) {
      findings.push(`operationalPacket.rows.${row.areaId}: untracked operational evidence area.`)
    } else if (row.verdict === "proved" || row.verdict === "not-proved") {
      trackedRows.push({
        ...row,
        areaId: row.areaId as AstraMacroOperationalEvidenceAreaId,
        verdict: row.verdict,
      })
    }
    if (seenAreaIds.has(row.areaId)) {
      findings.push(`operationalPacket.rows.${row.areaId}: duplicate operational evidence row.`)
    }
    seenAreaIds.add(row.areaId)

    if (row.evidenceLink && isPlaceholderEvidenceReference(row.evidenceLink)) {
      findings.push(`operationalPacket.rows.${row.areaId}: placeholder evidence links are not allowed.`)
    }
  }

  if (packet.rows.length > 0) {
    const packetDecision = evaluateAstraMacroOperationalEvidenceCompletionPacket(trackedRows)
    if (!packetDecision.complete) {
      findings.push(
        "operationalPacket.rows: attempted operational completion evidence must satisfy evaluateAstraMacroOperationalEvidenceCompletionPacket() before it can remain in the final evidence packet.",
      )
      for (const finding of packetDecision.findings) {
        findings.push(`operationalPacket.rows.${finding.areaId}: ${finding.message}`)
      }
    }
  }
}

function validateCiArtifactPacket(value: unknown, findings: string[]): CiArtifactPacket | null {
  if (!isRecord(value)) {
    findings.push(`${CI_ARTIFACT_PACKET_PATH}: expected top-level object.`)
    return null
  }

  validateExactKeys(value, ["schema", "generatedAt", "label", "rows"], "ciArtifactPacket", findings)
  if (value.schema !== "astra-macro-ci-artifact-packet.v1") {
    findings.push("ciArtifactPacket.schema: expected astra-macro-ci-artifact-packet.v1.")
  }
  validateIsoGeneratedAt(value.generatedAt, "ciArtifactPacket.generatedAt", findings)
  if (typeof value.label !== "string" || value.label.trim().length === 0) {
    findings.push("ciArtifactPacket.label: expected a non-empty string.")
  }
  if (!Array.isArray(value.rows)) {
    findings.push("ciArtifactPacket.rows: expected array.")
    return null
  }

  const rows: CiArtifactPacketRow[] = []
  for (const [index, row] of value.rows.entries()) {
    if (!isRecord(row)) {
      findings.push(`ciArtifactPacket.rows[${index}]: expected object.`)
      continue
    }
    validateExactKeys(row, ["evidenceField", "artifactName", "workflowName", "runId", "jobName", "workflowConclusion", "jobConclusion", "artifactId", "artifactDigest", "artifactManifestPath", "runUrl", "artifactUrl", "commitSha", "ownerDate", "coverage"], `ciArtifactPacket.rows[${index}]`, findings)
    for (const field of ["evidenceField", "artifactName", "workflowName", "runId", "jobName", "workflowConclusion", "jobConclusion", "artifactId", "artifactDigest", "artifactManifestPath", "runUrl", "artifactUrl", "commitSha", "ownerDate"] as const) {
      if (typeof row[field] !== "string") {
        findings.push(`ciArtifactPacket.rows[${index}].${field}: expected string.`)
      }
    }
    if (!Array.isArray(row.coverage)) {
      findings.push(`ciArtifactPacket.rows[${index}].coverage: expected array.`)
    }
    const coverage = Array.isArray(row.coverage) ? row.coverage.filter((entry): entry is string => typeof entry === "string") : []
    if (Array.isArray(row.coverage) && coverage.length !== row.coverage.length) {
      findings.push(`ciArtifactPacket.rows[${index}].coverage: expected every entry to be a string.`)
    }
    rows.push({
      evidenceField: typeof row.evidenceField === "string" ? row.evidenceField : "",
      artifactName: typeof row.artifactName === "string" ? row.artifactName : "",
      workflowName: typeof row.workflowName === "string" ? row.workflowName : "",
      runId: typeof row.runId === "string" ? row.runId : "",
      jobName: typeof row.jobName === "string" ? row.jobName : "",
      workflowConclusion: typeof row.workflowConclusion === "string" ? row.workflowConclusion : "",
      jobConclusion: typeof row.jobConclusion === "string" ? row.jobConclusion : "",
      artifactId: typeof row.artifactId === "string" ? row.artifactId : "",
      artifactDigest: typeof row.artifactDigest === "string" ? row.artifactDigest : "",
      artifactManifestPath: typeof row.artifactManifestPath === "string" ? row.artifactManifestPath : "",
      runUrl: typeof row.runUrl === "string" ? row.runUrl : "",
      artifactUrl: typeof row.artifactUrl === "string" ? row.artifactUrl : "",
      commitSha: typeof row.commitSha === "string" ? row.commitSha : "",
      ownerDate: typeof row.ownerDate === "string" ? row.ownerDate : "",
      coverage,
    })
  }

  return {
    schema: "astra-macro-ci-artifact-packet.v1",
    generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : "",
    label: typeof value.label === "string" ? value.label : "",
    rows,
  }
}

function validateCiArtifactPacketPreclaimRows(packet: CiArtifactPacket, findings: string[]): void {
  const expectedEvidenceFields = new Set<string>(ASTRA_MACRO_CI_ARTIFACT_REQUIREMENTS.map((requirement) => requirement.evidenceField))
  const seenEvidenceFields = new Set<string>()
  const commitShas = new Set<string>()

  for (const row of packet.rows) {
    if (!expectedEvidenceFields.has(row.evidenceField)) {
      findings.push(`ciArtifactPacket.rows.${row.evidenceField}: untracked CI artifact evidence field.`)
    }
    if (seenEvidenceFields.has(row.evidenceField)) {
      findings.push(`ciArtifactPacket.rows.${row.evidenceField}: duplicate CI artifact evidence row.`)
    }
    seenEvidenceFields.add(row.evidenceField)

    if (row.commitSha.trim().length > 0) {
      commitShas.add(row.commitSha.trim().toLowerCase())
    }

    for (const field of ["runId", "jobName", "artifactId", "artifactDigest", "artifactManifestPath", "runUrl", "artifactUrl"] as const) {
      if (row[field] && isPlaceholderEvidenceReference(row[field])) {
        findings.push(`ciArtifactPacket.rows.${row.evidenceField}.${field}: placeholder evidence links are not allowed.`)
      }
    }
    for (const field of ["runId", "artifactId"] as const) {
      if (row[field] && isWeakDigestOrVersionReference(row[field])) {
        findings.push(`ciArtifactPacket.rows.${row.evidenceField}.${field}: stable non-weak identity is required.`)
      }
    }
    if (row.jobName && isWeakContextEvidenceReference(row.jobName)) {
      findings.push(`ciArtifactPacket.rows.${row.evidenceField}.jobName: real CI job name is required.`)
    }
    if (row.artifactDigest && isWeakDigestReference(row.artifactDigest)) {
      findings.push(`ciArtifactPacket.rows.${row.evidenceField}.artifactDigest: stable non-weak digest/checksum is required.`)
    }
  }

  if (commitShas.size > 1) {
    findings.push("ciArtifactPacket.rows: CI artifact rows must all target the same target commit/SHA.")
  }

  if (packet.rows.length > 0) {
    const ciDecision = evaluateAstraMacroCiArtifactPacket(
      packet.rows as Parameters<typeof evaluateAstraMacroCiArtifactPacket>[0],
    )
    if (!ciDecision.acceptable) {
      findings.push("ciArtifactPacket: attempted CI artifact evidence must satisfy evaluateAstraMacroCiArtifactPacket() before it can remain in the final evidence packet.")
      for (const finding of ciDecision.findings) {
        findings.push(`ciArtifactPacket ${finding.message}`)
      }
    }
  }
}

function validateOwnerReleaseApprovalPacket(value: unknown, findings: string[]): OwnerReleaseApprovalPacket | null {
  if (!isRecord(value)) {
    findings.push(`${OWNER_RELEASE_APPROVAL_PACKET_PATH}: expected top-level object.`)
    return null
  }

  validateExactKeys(value, ["schema", "generatedAt", "label", "approval"], "ownerReleaseApprovalPacket", findings)
  if (value.schema !== "astra-macro-owner-release-approval-packet.v1") {
    findings.push("ownerReleaseApprovalPacket.schema: expected astra-macro-owner-release-approval-packet.v1.")
  }
  validateIsoGeneratedAt(value.generatedAt, "ownerReleaseApprovalPacket.generatedAt", findings)
  if (typeof value.label !== "string" || value.label.trim().length === 0) {
    findings.push("ownerReleaseApprovalPacket.label: expected a non-empty string.")
  }
  if (!isRecord(value.approval)) {
    findings.push("ownerReleaseApprovalPacket.approval: expected object.")
    return null
  }

  validateExactKeys(value.approval, ["approver", "approvalDate", "approvalRecordLink", "targetCommitSha", "decision", "reviewedArtifacts", "acknowledgesRemainingFinalBlockers", "acknowledgesDowngradeCopy"], "ownerReleaseApprovalPacket.approval", findings)
  for (const field of ["approver", "approvalDate", "approvalRecordLink", "targetCommitSha", "decision"] as const) {
    if (typeof value.approval[field] !== "string") {
      findings.push(`ownerReleaseApprovalPacket.approval.${field}: expected string.`)
    }
  }
  if (!Array.isArray(value.approval.reviewedArtifacts)) {
    findings.push("ownerReleaseApprovalPacket.approval.reviewedArtifacts: expected array.")
  }
  const reviewedArtifacts = Array.isArray(value.approval.reviewedArtifacts)
    ? value.approval.reviewedArtifacts.filter((entry): entry is string => typeof entry === "string")
    : []
  if (Array.isArray(value.approval.reviewedArtifacts) && reviewedArtifacts.length !== value.approval.reviewedArtifacts.length) {
    findings.push("ownerReleaseApprovalPacket.approval.reviewedArtifacts: expected every entry to be a string.")
  }
  for (const field of ["acknowledgesRemainingFinalBlockers", "acknowledgesDowngradeCopy"] as const) {
    if (typeof value.approval[field] !== "boolean") {
      findings.push(`ownerReleaseApprovalPacket.approval.${field}: expected boolean.`)
    }
  }
  const decision = typeof value.approval.decision === "string" ? value.approval.decision : ""
  if (!["approved_with_downgrades", "approved_final", "rejected"].includes(decision)) {
    findings.push("ownerReleaseApprovalPacket.approval.decision: expected approved_with_downgrades, approved_final, or rejected.")
  }

  return {
    schema: "astra-macro-owner-release-approval-packet.v1",
    generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : "",
    label: typeof value.label === "string" ? value.label : "",
    approval: {
      approver: typeof value.approval.approver === "string" ? value.approval.approver : "",
      approvalDate: typeof value.approval.approvalDate === "string" ? value.approval.approvalDate : "",
      approvalRecordLink: typeof value.approval.approvalRecordLink === "string" ? value.approval.approvalRecordLink : "",
      targetCommitSha: typeof value.approval.targetCommitSha === "string" ? value.approval.targetCommitSha : "",
      decision,
      reviewedArtifacts,
      acknowledgesRemainingFinalBlockers: typeof value.approval.acknowledgesRemainingFinalBlockers === "boolean" ? value.approval.acknowledgesRemainingFinalBlockers : false,
      acknowledgesDowngradeCopy: typeof value.approval.acknowledgesDowngradeCopy === "boolean" ? value.approval.acknowledgesDowngradeCopy : false,
    },
  }
}

function ownerReleaseApprovalPacketAttempted(packet: OwnerReleaseApprovalPacket): boolean {
  const approval = packet.approval
  return (
    approval.approver.trim().length > 0 ||
    approval.approvalDate.trim().length > 0 ||
    approval.approvalRecordLink.trim().length > 0 ||
    approval.targetCommitSha.trim().length > 0 ||
    approval.decision !== "rejected" ||
    approval.reviewedArtifacts.length > 0 ||
    approval.acknowledgesRemainingFinalBlockers ||
    approval.acknowledgesDowngradeCopy
  )
}

function validateOwnerReleaseApprovalPacketPreclaim(packet: OwnerReleaseApprovalPacket, findings: string[]): void {
  if (!ownerReleaseApprovalPacketAttempted(packet)) {
    return
  }

  const expectedReviewedArtifacts = new Set<string>(ASTRA_MACRO_RELEASE_APPROVAL_REQUIREMENT.requiredReviewedArtifacts)
  const seenReviewedArtifacts = new Set<string>()

  for (const artifact of packet.approval.reviewedArtifacts) {
    if (!expectedReviewedArtifacts.has(artifact)) {
      findings.push(`ownerReleaseApprovalPacket.reviewedArtifacts.${artifact}: untracked reviewed artifact.`)
    }
    if (seenReviewedArtifacts.has(artifact)) {
      findings.push(`ownerReleaseApprovalPacket.reviewedArtifacts.${artifact}: duplicate reviewed artifact.`)
    }
    seenReviewedArtifacts.add(artifact)
    if (isPlaceholderEvidenceReference(artifact)) {
      findings.push(`ownerReleaseApprovalPacket.reviewedArtifacts.${artifact}: placeholder reviewed artifacts are not allowed.`)
    }
  }

  if (packet.approval.approvalRecordLink && isPlaceholderEvidenceReference(packet.approval.approvalRecordLink)) {
    findings.push("ownerReleaseApprovalPacket.approval.approvalRecordLink: placeholder evidence links are not allowed.")
  }

  const approvalDecision = evaluateAstraMacroReleaseApprovalPacket(
    packet.approval as Parameters<typeof evaluateAstraMacroReleaseApprovalPacket>[0],
  )
  if (!approvalDecision.acceptable) {
    findings.push("ownerReleaseApprovalPacket: attempted approval evidence must satisfy evaluateAstraMacroReleaseApprovalPacket() before it can remain in the final evidence packet.")
    for (const finding of approvalDecision.findings) {
      findings.push(`ownerReleaseApprovalPacket ${finding.message}`)
    }
  }
}

function validateCrossPacketTargetCommitConsistency(
  ciArtifactPacket: CiArtifactPacket | null,
  ownerReleaseApprovalPacket: OwnerReleaseApprovalPacket | null,
  findings: string[],
): void {
  if (!ciArtifactPacket || !ownerReleaseApprovalPacket || !ownerReleaseApprovalPacketAttempted(ownerReleaseApprovalPacket)) {
    return
  }

  const ciCommitShas = new Set(
    ciArtifactPacket.rows
      .map((row) => row.commitSha.trim().toLowerCase())
      .filter((commitSha) => commitSha.length > 0),
  )
  const approvalCommitSha = ownerReleaseApprovalPacket.approval.targetCommitSha.trim().toLowerCase()
  if (approvalCommitSha.length === 0 || ciCommitShas.size === 0) {
    return
  }
  if (!ciCommitShas.has(approvalCommitSha)) {
    findings.push("crossPacketTargetCommit: owner approval target commit/SHA must match the CI artifact packet commit/SHA.")
  }
}

function validateLaunchArtifactPacket(value: unknown, findings: string[]): LaunchArtifactPacket | null {
  if (!isRecord(value)) {
    findings.push(`${LAUNCH_ARTIFACT_PACKET_PATH}: expected top-level object.`)
    return null
  }

  validateExactKeys(value, ["schema", "generatedAt", "label", "rows"], "launchArtifactPacket", findings)
  if (value.schema !== "astra-macro-launch-artifact-packet.v1") {
    findings.push("launchArtifactPacket.schema: expected astra-macro-launch-artifact-packet.v1.")
  }
  validateIsoGeneratedAt(value.generatedAt, "launchArtifactPacket.generatedAt", findings)
  if (typeof value.label !== "string" || value.label.trim().length === 0) {
    findings.push("launchArtifactPacket.label: expected a non-empty string.")
  }
  if (!Array.isArray(value.rows)) {
    findings.push("launchArtifactPacket.rows: expected array.")
    return null
  }

  const rows: LaunchArtifactPacketRow[] = []
  for (const [index, row] of value.rows.entries()) {
    if (!isRecord(row)) {
      findings.push(`launchArtifactPacket.rows[${index}]: expected object.`)
      continue
    }
    validateExactKeys(row, ["requirementId", "artifactType", "artifactId", "artifactDigestOrVersion", "targetChannel", "claimBoundary", "evidenceLink", "ownerDate", "environment"], `launchArtifactPacket.rows[${index}]`, findings)
    for (const field of ["requirementId", "artifactType", "artifactId", "artifactDigestOrVersion", "targetChannel", "claimBoundary", "evidenceLink", "ownerDate", "environment"] as const) {
      if (typeof row[field] !== "string") {
        findings.push(`launchArtifactPacket.rows[${index}].${field}: expected string.`)
      }
    }
    rows.push({
      requirementId: typeof row.requirementId === "string" ? row.requirementId : "",
      artifactType: typeof row.artifactType === "string" ? row.artifactType : "",
      artifactId: typeof row.artifactId === "string" ? row.artifactId : "",
      artifactDigestOrVersion: typeof row.artifactDigestOrVersion === "string" ? row.artifactDigestOrVersion : "",
      targetChannel: typeof row.targetChannel === "string" ? row.targetChannel : "",
      claimBoundary: typeof row.claimBoundary === "string" ? row.claimBoundary : "",
      evidenceLink: typeof row.evidenceLink === "string" ? row.evidenceLink : "",
      ownerDate: typeof row.ownerDate === "string" ? row.ownerDate : "",
      environment: typeof row.environment === "string" ? row.environment : "",
    })
  }

  return {
    schema: "astra-macro-launch-artifact-packet.v1",
    generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : "",
    label: typeof value.label === "string" ? value.label : "",
    rows,
  }
}

function validateLaunchArtifactPacketPreclaimRows(packet: LaunchArtifactPacket, findings: string[]): void {
  const expectedRequirementIds = new Set<string>(ASTRA_MACRO_LAUNCH_ARTIFACT_REQUIREMENTS.map((requirement) => requirement.id))
  const seenRequirementIds = new Set<string>()

  for (const row of packet.rows) {
    if (!expectedRequirementIds.has(row.requirementId)) {
      findings.push(`launchArtifactPacket.rows.${row.requirementId}: untracked launch artifact requirement.`)
    }
    if (seenRequirementIds.has(row.requirementId)) {
      findings.push(`launchArtifactPacket.rows.${row.requirementId}: duplicate launch artifact row.`)
    }
    seenRequirementIds.add(row.requirementId)

    if (row.evidenceLink && isPlaceholderEvidenceReference(row.evidenceLink)) {
      findings.push(`launchArtifactPacket.rows.${row.requirementId}: placeholder evidence links are not allowed.`)
    }
    for (const field of ["artifactType", "targetChannel", "environment"] as const) {
      if (row[field] && isWeakContextEvidenceReference(row[field])) {
        findings.push(`launchArtifactPacket.rows.${row.requirementId}.${field}: real launch context is required.`)
      }
    }
    if (row.artifactId && isWeakDigestOrVersionReference(row.artifactId)) {
      findings.push(`launchArtifactPacket.rows.${row.requirementId}.artifactId: stable non-weak artifact identity is required.`)
    }
    if (row.artifactDigestOrVersion && isWeakDigestOrVersionReference(row.artifactDigestOrVersion)) {
      findings.push(`launchArtifactPacket.rows.${row.requirementId}.artifactDigestOrVersion: stable non-weak digest or version is required.`)
    }
  }

  if (packet.rows.length > 0) {
    const launchDecision = evaluateAstraMacroLaunchArtifactPacket(
      packet.rows as Parameters<typeof evaluateAstraMacroLaunchArtifactPacket>[0],
    )
    if (!launchDecision.acceptable) {
      findings.push("launchArtifactPacket: attempted launch artifact evidence must satisfy evaluateAstraMacroLaunchArtifactPacket() before it can remain in the final evidence packet.")
      for (const finding of launchDecision.findings) {
        findings.push(`launchArtifactPacket ${finding.message}`)
      }
    }
  }
}

function validateAllowedRecordKeys(
  value: Record<string, unknown>,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[],
  path: string,
  findings: string[],
): void {
  const allowedKeys = new Set([...requiredKeys, ...optionalKeys])
  for (const key of Object.keys(value).sort()) {
    if (!allowedKeys.has(key)) {
      findings.push(`${path}.${key}: unknown field.`)
    }
  }
  for (const key of requiredKeys) {
    if (!(key in value)) {
      findings.push(`${path}.${key}: missing required field.`)
    }
  }
}

function validateNumberField(value: unknown, path: string, findings: string[]): value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    findings.push(`${path}: expected finite number.`)
    return false
  }
  return true
}

function validateNullableNumberField(value: unknown, path: string, findings: string[]): value is number | null {
  if (value !== null && (typeof value !== "number" || !Number.isFinite(value))) {
    findings.push(`${path}: expected finite number or null.`)
    return false
  }
  return true
}

type NumberConstraintOptions = {
  integer?: boolean
  min?: number
  max?: number
}

function validateNumberConstraints(value: number, path: string, findings: string[], options: NumberConstraintOptions): boolean {
  let valid = true
  if (options.integer && !Number.isInteger(value)) {
    findings.push(`${path}: expected integer.`)
    valid = false
  }
  if (options.min !== undefined && value < options.min) {
    findings.push(`${path}: expected number >= ${options.min}.`)
    valid = false
  }
  if (options.max !== undefined && value > options.max) {
    findings.push(`${path}: expected number <= ${options.max}.`)
    valid = false
  }
  return valid
}

function validateConstrainedNumberField(value: unknown, path: string, findings: string[], options: NumberConstraintOptions): value is number {
  return validateNumberField(value, path, findings) && validateNumberConstraints(value, path, findings, options)
}

function validateNullableConstrainedNumberField(value: unknown, path: string, findings: string[], options: NumberConstraintOptions): value is number | null {
  if (!validateNullableNumberField(value, path, findings)) {
    return false
  }
  return value === null || validateNumberConstraints(value, path, findings, options)
}

function validateStringArrayField(value: unknown, path: string, findings: string[]): value is string[] {
  if (!Array.isArray(value)) {
    findings.push(`${path}: expected string array.`)
    return false
  }
  value.forEach((item, index) => {
    if (typeof item !== "string") {
      findings.push(`${path}.${index}: expected string.`)
    }
  })
  return value.every((item) => typeof item === "string")
}

function validateNumberRecord(
  value: unknown,
  allowedKeys: readonly string[],
  path: string,
  findings: string[],
  options: { requireAllKeys?: boolean; integer?: boolean; min?: number; max?: number } = {},
): value is Record<string, number> {
  if (!isRecord(value)) {
    findings.push(`${path}: expected object.`)
    return false
  }

  const allowedKeySet = new Set(allowedKeys)
  for (const key of Object.keys(value).sort()) {
    if (!allowedKeySet.has(key)) {
      findings.push(`${path}.${key}: unknown field.`)
      continue
    }
    if (validateNumberField(value[key], `${path}.${key}`, findings)) {
      validateNumberConstraints(value[key], `${path}.${key}`, findings, options)
    }
  }
  if (options.requireAllKeys) {
    for (const key of allowedKeys) {
      if (!(key in value)) {
        findings.push(`${path}.${key}: missing required field.`)
      }
    }
  }

  return Object.keys(value).every((key) => {
    const item = value[key]
    return allowedKeySet.has(key) && typeof item === "number" && Number.isFinite(item)
      && (!options.integer || Number.isInteger(item))
      && (options.min === undefined || item >= options.min)
      && (options.max === undefined || item <= options.max)
  })
}

function validateAiQualityLowScoreBacklog(value: unknown, path: string, findings: string[]): value is AiQualityRunSummary["lowScoreBacklog"] {
  if (!Array.isArray(value)) {
    findings.push(`${path}: expected array.`)
    return false
  }

  const allowedCapabilities = new Set<string>(ASTRA_AI_QUALITY_ABILITY_CATEGORIES)
  const allowedErrorTypes = new Set<string>(ASTRA_AI_QUALITY_ERROR_TAXONOMY.map((item) => item.type))
  for (const [index, item] of value.entries()) {
    const itemPath = `${path}.${index}`
    if (!isRecord(item)) {
      findings.push(`${itemPath}: expected object.`)
      continue
    }

    validateExactKeys(item, ["sampleId", "capability", "lowestScore", "errors", "recommendedBacklogLabel"], itemPath, findings)
    if (typeof item.sampleId !== "string") {
      findings.push(`${itemPath}.sampleId: expected string.`)
    }
    if (typeof item.capability !== "string" || !allowedCapabilities.has(item.capability)) {
      findings.push(`${itemPath}.capability: expected known AI quality capability.`)
    }
    validateConstrainedNumberField(item.lowestScore, `${itemPath}.lowestScore`, findings, { min: 1, max: 5 })
    if (typeof item.recommendedBacklogLabel !== "string") {
      findings.push(`${itemPath}.recommendedBacklogLabel: expected string.`)
    }
    if (validateStringArrayField(item.errors, `${itemPath}.errors`, findings)) {
      item.errors.forEach((errorType, errorIndex) => {
        if (!allowedErrorTypes.has(errorType)) {
          findings.push(`${itemPath}.errors.${errorIndex}: expected known AI quality error type.`)
        }
      })
    }
  }

  return value.every((item) => isRecord(item))
}

function validateAiQualityRunSummary(value: unknown, findings: string[]): AiQualityRunSummary | null {
  const path = "aiQualityHumanScoredPacket.evidence.summary"
  if (!isRecord(value)) {
    findings.push(`${path}: expected object.`)
    return null
  }

  const initialFindingCount = findings.length
  validateAllowedRecordKeys(value, AI_QUALITY_SUMMARY_REQUIRED_KEYS, AI_QUALITY_SUMMARY_OPTIONAL_KEYS, path, findings)

  for (const field of ["sampleCount", "p0SampleCount", "capabilityCount", "reviewCardReusableCount", "reviewCardEvaluatedCount", "safetyPassedCount", "safetyEvaluatedCount"] as const) {
    validateConstrainedNumberField(value[field], `${path}.${field}`, findings, { integer: true, min: 0 })
  }
  validateNullableConstrainedNumberField(value.averageScore, `${path}.averageScore`, findings, { min: 1, max: 5 })
  for (const field of ["reviewCardReusableRate", "safetyPassRate"] as const) {
    validateNullableConstrainedNumberField(value[field], `${path}.${field}`, findings, { min: 0, max: 1 })
  }
  if (typeof value.reproducible !== "boolean") {
    findings.push(`${path}.reproducible: expected boolean.`)
  }
  for (const field of AI_QUALITY_SUMMARY_OPTIONAL_KEYS) {
    if (value[field] !== undefined && typeof value[field] !== "string") {
      findings.push(`${path}.${field}: expected string when present.`)
    }
  }
  if (typeof value.generatedAt === "string" && !isIsoTimestamp(value.generatedAt)) {
    findings.push(`${path}.generatedAt: expected ISO timestamp when present.`)
  }

  validateNumberRecord(value.capabilityCounts, ASTRA_AI_QUALITY_ABILITY_CATEGORIES, `${path}.capabilityCounts`, findings, { requireAllKeys: true, integer: true, min: 0 })
  validateNumberRecord(value.capabilityAverages, ASTRA_AI_QUALITY_ABILITY_CATEGORIES, `${path}.capabilityAverages`, findings, { min: 1, max: 5 })
  validateStringArrayField(value.blockerSampleIds, `${path}.blockerSampleIds`, findings)
  validateNumberRecord(value.blockerErrorCounts, ASTRA_AI_QUALITY_ERROR_TAXONOMY.map((item) => item.type), `${path}.blockerErrorCounts`, findings, { integer: true, min: 0 })
  validateAiQualityLowScoreBacklog(value.lowScoreBacklog, `${path}.lowScoreBacklog`, findings)

  if (findings.length > initialFindingCount) {
    return null
  }

  return value as unknown as AiQualityRunSummary
}

function validateAiQualityHumanScoredPacket(value: unknown, findings: string[]): AiQualityHumanScoredPacket | null {
  const initialFindingCount = findings.length
  if (!isRecord(value)) {
    findings.push(`${AI_QUALITY_HUMAN_SCORED_PACKET_PATH}: expected top-level object.`)
    return null
  }

  validateExactKeys(value, ["schema", "generatedAt", "label", "evidence"], "aiQualityHumanScoredPacket", findings)
  if (value.schema !== "astra-macro-ai-quality-human-scored-packet.v1") {
    findings.push("aiQualityHumanScoredPacket.schema: expected astra-macro-ai-quality-human-scored-packet.v1.")
  }
  validateIsoGeneratedAt(value.generatedAt, "aiQualityHumanScoredPacket.generatedAt", findings)
  if (typeof value.label !== "string" || value.label.trim().length === 0) {
    findings.push("aiQualityHumanScoredPacket.label: expected a non-empty string.")
  }
  if (!isRecord(value.evidence)) {
    findings.push("aiQualityHumanScoredPacket.evidence: expected object.")
    return null
  }

  validateExactKeys(value.evidence, ["reviewer", "reviewedAt", "environment", "runId", "rubricVersion", "fixtureManifestPath", "fixtureManifestVersion", "providerSampleEvidenceLink", "scoredSampleCount", "liveProviderSampleCount", "blockerTriageLink", "trendDirection", "releaseDecision", "summary"], "aiQualityHumanScoredPacket.evidence", findings)
  for (const field of ["reviewer", "reviewedAt", "environment", "runId", "rubricVersion", "fixtureManifestPath", "fixtureManifestVersion", "providerSampleEvidenceLink", "blockerTriageLink"] as const) {
    if (typeof value.evidence[field] !== "string") {
      findings.push(`aiQualityHumanScoredPacket.evidence.${field}: expected string.`)
    }
  }
  for (const field of ["scoredSampleCount", "liveProviderSampleCount"] as const) {
    if (typeof value.evidence[field] !== "number") {
      findings.push(`aiQualityHumanScoredPacket.evidence.${field}: expected number.`)
    }
  }
  if (!["new", "improved", "stable", "regressed", null].includes(value.evidence.trendDirection as string | null)) {
    findings.push("aiQualityHumanScoredPacket.evidence.trendDirection: expected new, improved, stable, regressed, or null.")
  }
  if (!["approve", "approve_with_downgrade", "block", null].includes(value.evidence.releaseDecision as string | null)) {
    findings.push("aiQualityHumanScoredPacket.evidence.releaseDecision: expected approve, approve_with_downgrade, block, or null.")
  }
  const summary = validateAiQualityRunSummary(value.evidence.summary, findings)
  if (!summary) {
    return null
  }
  if (typeof value.evidence.runId === "string" && summary.runId !== undefined && summary.runId !== value.evidence.runId) {
    findings.push("aiQualityHumanScoredPacket.evidence.summary.runId: expected to match evidence.runId when present.")
  }

  if (findings.length > initialFindingCount) {
    return null
  }

  return {
    schema: "astra-macro-ai-quality-human-scored-packet.v1",
    generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : "",
    label: typeof value.label === "string" ? value.label : "",
    evidence: {
      reviewer: typeof value.evidence.reviewer === "string" ? value.evidence.reviewer : "",
      reviewedAt: typeof value.evidence.reviewedAt === "string" ? value.evidence.reviewedAt : "",
      environment: typeof value.evidence.environment === "string" ? value.evidence.environment : "",
      runId: typeof value.evidence.runId === "string" ? value.evidence.runId : "",
      rubricVersion: typeof value.evidence.rubricVersion === "string" ? value.evidence.rubricVersion : "",
      fixtureManifestPath: typeof value.evidence.fixtureManifestPath === "string" ? value.evidence.fixtureManifestPath : "",
      fixtureManifestVersion: typeof value.evidence.fixtureManifestVersion === "string" ? value.evidence.fixtureManifestVersion : "",
      providerSampleEvidenceLink: typeof value.evidence.providerSampleEvidenceLink === "string" ? value.evidence.providerSampleEvidenceLink : "",
      scoredSampleCount: typeof value.evidence.scoredSampleCount === "number" ? value.evidence.scoredSampleCount : 0,
      liveProviderSampleCount: typeof value.evidence.liveProviderSampleCount === "number" ? value.evidence.liveProviderSampleCount : 0,
      blockerTriageLink: typeof value.evidence.blockerTriageLink === "string" ? value.evidence.blockerTriageLink : "",
      trendDirection: ["new", "improved", "stable", "regressed"].includes(value.evidence.trendDirection as string)
        ? (value.evidence.trendDirection as "new" | "improved" | "stable" | "regressed")
        : null,
      releaseDecision: ["approve", "approve_with_downgrade", "block"].includes(value.evidence.releaseDecision as string)
        ? (value.evidence.releaseDecision as "approve" | "approve_with_downgrade" | "block")
        : null,
      summary,
    },
  }
}

function aiQualityHumanScoredPacketAttempted(packet: AiQualityHumanScoredPacket): boolean {
  const evidence = packet.evidence
  const summary = evidence.summary
  return (
    evidence.reviewer.trim().length > 0 ||
    evidence.reviewedAt.trim().length > 0 ||
    evidence.environment.trim().length > 0 ||
    evidence.runId.trim().length > 0 ||
    evidence.rubricVersion.trim().length > 0 ||
    evidence.fixtureManifestPath.trim().length > 0 ||
    evidence.fixtureManifestVersion.trim().length > 0 ||
    evidence.providerSampleEvidenceLink.trim().length > 0 ||
    evidence.scoredSampleCount > 0 ||
    evidence.liveProviderSampleCount > 0 ||
    evidence.blockerTriageLink.trim().length > 0 ||
    evidence.trendDirection !== null ||
    evidence.releaseDecision !== null ||
    summary.sampleCount > 0 ||
    summary.p0SampleCount > 0 ||
    summary.capabilityCount > 0 ||
    summary.blockerSampleIds.length > 0 ||
    summary.lowScoreBacklog.length > 0 ||
    summary.reproducible
  )
}

function validateAiQualityHumanScoredPacketPreclaim(packet: AiQualityHumanScoredPacket, findings: string[]): void {
  if (!aiQualityHumanScoredPacketAttempted(packet)) {
    return
  }

  for (const field of ["providerSampleEvidenceLink", "blockerTriageLink"] as const) {
    if (packet.evidence[field] && isPlaceholderEvidenceReference(packet.evidence[field])) {
      findings.push(`aiQualityHumanScoredPacket.evidence.${field}: placeholder evidence links are not allowed.`)
    }
  }
  if (packet.evidence.environment && isWeakContextEvidenceReference(packet.evidence.environment)) {
    findings.push("aiQualityHumanScoredPacket.evidence.environment: real target environment is required.")
  }
  for (const field of ["runId", "rubricVersion", "fixtureManifestVersion"] as const) {
    if (packet.evidence[field] && isWeakDigestOrVersionReference(packet.evidence[field])) {
      findings.push(`aiQualityHumanScoredPacket.evidence.${field}: stable non-weak identity/version is required.`)
    }
  }

  const aiQualityDecision = evaluateAiQualityHumanScoredReportEvidence(packet.evidence)
  if (!aiQualityDecision.acceptable) {
    findings.push("aiQualityHumanScoredPacket: attempted human-scored AI quality evidence must satisfy evaluateAiQualityHumanScoredReportEvidence() before it can remain in the final evidence packet.")
    for (const finding of aiQualityDecision.findings) {
      findings.push(`aiQualityHumanScoredPacket ${finding.message}`)
    }
  }
}

function validateProductionMetricsExportPacket(value: unknown, findings: string[]): ProductionMetricsExportPacket | null {
  if (!isRecord(value)) {
    findings.push(`${PRODUCTION_METRICS_EXPORT_PACKET_PATH}: expected top-level object.`)
    return null
  }

  validateExactKeys(value, ["schema", "generatedAt", "label", "rows"], "productionMetricsExportPacket", findings)
  if (value.schema !== "astra-macro-production-metrics-export-packet.v1") {
    findings.push("productionMetricsExportPacket.schema: expected astra-macro-production-metrics-export-packet.v1.")
  }
  validateIsoGeneratedAt(value.generatedAt, "productionMetricsExportPacket.generatedAt", findings)
  if (typeof value.label !== "string" || value.label.trim().length === 0) {
    findings.push("productionMetricsExportPacket.label: expected a non-empty string.")
  }
  if (!Array.isArray(value.rows)) {
    findings.push("productionMetricsExportPacket.rows: expected array.")
    return null
  }

  const rows: ProductionMetricsExportPacketRow[] = []
  for (const [index, row] of value.rows.entries()) {
    if (!isRecord(row)) {
      findings.push(`productionMetricsExportPacket.rows[${index}]: expected object.`)
      continue
    }
    validateExactKeys(row, ["category", "dateRange", "cohortDefinition", "dashboardOrQuerySource", "exportId", "exportedAt", "exportDigest", "queryVersion", "metricIds", "evidenceLink", "ownerDate", "privacyReviewLink"], `productionMetricsExportPacket.rows[${index}]`, findings)
    for (const field of ["category", "dateRange", "cohortDefinition", "dashboardOrQuerySource", "exportId", "exportedAt", "exportDigest", "queryVersion", "evidenceLink", "ownerDate", "privacyReviewLink"] as const) {
      if (typeof row[field] !== "string") {
        findings.push(`productionMetricsExportPacket.rows[${index}].${field}: expected string.`)
      }
    }
    if (!Array.isArray(row.metricIds) || !row.metricIds.every((metricId) => typeof metricId === "string")) {
      findings.push(`productionMetricsExportPacket.rows[${index}].metricIds: expected string array.`)
    }
    rows.push({
      category: typeof row.category === "string" ? row.category : "",
      dateRange: typeof row.dateRange === "string" ? row.dateRange : "",
      cohortDefinition: typeof row.cohortDefinition === "string" ? row.cohortDefinition : "",
      dashboardOrQuerySource: typeof row.dashboardOrQuerySource === "string" ? row.dashboardOrQuerySource : "",
      exportId: typeof row.exportId === "string" ? row.exportId : "",
      exportedAt: typeof row.exportedAt === "string" ? row.exportedAt : "",
      exportDigest: typeof row.exportDigest === "string" ? row.exportDigest : "",
      queryVersion: typeof row.queryVersion === "string" ? row.queryVersion : "",
      metricIds: Array.isArray(row.metricIds) ? row.metricIds.filter((metricId): metricId is string => typeof metricId === "string") : [],
      evidenceLink: typeof row.evidenceLink === "string" ? row.evidenceLink : "",
      ownerDate: typeof row.ownerDate === "string" ? row.ownerDate : "",
      privacyReviewLink: typeof row.privacyReviewLink === "string" ? row.privacyReviewLink : "",
    })
  }

  return {
    schema: "astra-macro-production-metrics-export-packet.v1",
    generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : "",
    label: typeof value.label === "string" ? value.label : "",
    rows,
  }
}

function validateProductionMetricsExportPacketPreclaimRows(packet: ProductionMetricsExportPacket, findings: string[]): void {
  const expectedCategories = new Set<string>(ASTRA_PRODUCTION_METRIC_EXPORT_REQUIREMENTS.map((requirement) => requirement.category))
  const seenCategories = new Set<string>()

  for (const row of packet.rows) {
    if (!expectedCategories.has(row.category)) {
      findings.push(`productionMetricsExportPacket.rows.${row.category}: untracked production metrics export category.`)
    }
    if (seenCategories.has(row.category)) {
      findings.push(`productionMetricsExportPacket.rows.${row.category}: duplicate production metrics export row.`)
    }
    seenCategories.add(row.category)

    for (const field of ["evidenceLink", "privacyReviewLink"] as const) {
      if (row[field] && isPlaceholderEvidenceReference(row[field])) {
        findings.push(`productionMetricsExportPacket.rows.${row.category}.${field}: placeholder evidence links are not allowed.`)
      }
    }
    for (const field of ["cohortDefinition", "dashboardOrQuerySource"] as const) {
      if (row[field] && isWeakContextEvidenceReference(row[field])) {
        findings.push(`productionMetricsExportPacket.rows.${row.category}.${field}: real cohort/source evidence is required.`)
      }
    }
    for (const field of ["exportId", "queryVersion"] as const) {
      if (row[field] && isWeakDigestReference(row[field])) {
        findings.push(`productionMetricsExportPacket.rows.${row.category}.${field}: stable non-weak identity/version is required.`)
      }
    }
    if (row.exportDigest && isWeakDigestReference(row.exportDigest)) {
      findings.push(`productionMetricsExportPacket.rows.${row.category}.exportDigest: stable non-weak digest/checksum is required.`)
    }
  }

  if (packet.rows.length > 0) {
    const metricsDecision = evaluateAstraProductionMetricsExportPacket(
      packet.rows as Parameters<typeof evaluateAstraProductionMetricsExportPacket>[0],
    )
    if (!metricsDecision.acceptable) {
      findings.push("productionMetricsExportPacket: attempted production metrics export evidence must satisfy evaluateAstraProductionMetricsExportPacket() before it can remain in the final evidence packet.")
      for (const finding of metricsDecision.findings) {
        findings.push(`productionMetricsExportPacket ${finding.message}`)
      }
    }
  }
}

function parseManualQaChecklistRows(markdown: string, findings: string[]): ManualQaChecklistRow[] {
  return markdown
    .split("\n## Section ")
    .slice(1)
    .flatMap((block) => {
      const section = Number(block.match(/^(\d+)/)?.[1])
      if (!Number.isFinite(section)) {
        findings.push(`${MANUAL_QA_CHECKLIST_PATH}: could not parse section heading.`)
        return []
      }

      return block
        .split("\n")
        .filter((line) => line.startsWith("| ") && !line.startsWith("| QA row ") && !line.startsWith("|---"))
        .map((line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()))
        .map((cells) => {
          if (cells.length !== 7) {
            findings.push(`${MANUAL_QA_CHECKLIST_PATH} Section ${section}: expected 7 table cells, got ${cells.length}.`)
          }
          const [qaRow = "", , , ownerDate = "", environment = "", evidenceLink = "", verdict = ""] = cells
          return { section, qaRow, ownerDate, environment, evidenceLink, verdict }
        })
    })
}

function validateManualQaRows(rows: ManualQaChecklistRow[], findings: string[]): void {
  if (rows.length === 0) {
    findings.push(`${MANUAL_QA_CHECKLIST_PATH}: expected at least one QA row.`)
  }

  const expectedRows = new Set(
    ASTRA_MACRO_MANUAL_QA_REQUIREMENTS.flatMap((requirement) =>
      requirement.qaRows.map((qaRow) => `${requirement.section}\u0000${qaRow}`),
    ),
  )
  const seenRows = new Set<string>()

  for (const row of rows) {
    const rowKey = `${row.section}\u0000${row.qaRow}`
    if (!expectedRows.has(rowKey)) {
      findings.push(`Section ${row.section} / ${row.qaRow}: untracked manual QA row.`)
    }
    if (seenRows.has(rowKey)) {
      findings.push(`Section ${row.section} / ${row.qaRow}: duplicate manual QA row.`)
    }
    seenRows.add(rowKey)

    if (!ALLOWED_MANUAL_QA_VERDICTS.has(row.verdict)) {
      findings.push(`Section ${row.section} / ${row.qaRow}: unsupported verdict \`${row.verdict}\`.`)
    }

    if (row.verdict === "not-run") {
      if (row.ownerDate || row.environment || row.evidenceLink) {
        findings.push(`Section ${row.section} / ${row.qaRow}: not-run rows must not include owner, environment, or evidence link.`)
      }
      continue
    }

    if (!row.ownerDate) {
      findings.push(`Section ${row.section} / ${row.qaRow}: non-not-run row requires owner/date.`)
    } else if (!includesIsoDate(row.ownerDate)) {
      findings.push(`Section ${row.section} / ${row.qaRow}: non-not-run row owner/date must include a YYYY-MM-DD date.`)
    }
    if (!row.environment) {
      findings.push(`Section ${row.section} / ${row.qaRow}: non-not-run row requires environment.`)
    } else if (isWeakContextEvidenceReference(row.environment)) {
      findings.push(`Section ${row.section} / ${row.qaRow}: non-not-run row requires real browser/build environment.`)
    }
    if (!row.evidenceLink) {
      findings.push(`Section ${row.section} / ${row.qaRow}: non-not-run row requires evidence link.`)
    } else if (isPlaceholderEvidenceReference(row.evidenceLink)) {
      findings.push(`Section ${row.section} / ${row.qaRow}: non-not-run row uses placeholder evidence link.`)
    } else if (!isEvidenceLikeReference(row.evidenceLink)) {
      findings.push(`Section ${row.section} / ${row.qaRow}: non-not-run row evidence link must be a URL or repo artifact path.`)
    }
  }

  for (const requirement of ASTRA_MACRO_MANUAL_QA_REQUIREMENTS) {
    for (const qaRow of requirement.qaRows) {
      const rowKey = `${requirement.section}\u0000${qaRow}`
      if (!seenRows.has(rowKey)) {
        findings.push(`Section ${requirement.section} / ${qaRow}: required manual QA row is missing from checklist structure.`)
      }
    }
  }
}

function allManualQaRowsPassing(rows: ManualQaChecklistRow[]): boolean {
  return rows.length > 0 && rows.every((row) => PASSING_MANUAL_QA_VERDICTS.has(row.verdict))
}

function validateManualQaCompletionPacket(rows: ManualQaChecklistRow[], findings: string[]): void {
  const decision = evaluateAstraMacroManualQaEvidencePacket(rows)
  if (!decision.complete) {
    findings.push("artifact.evidence.manualQaChecklistComplete: cannot be true until evaluateAstraMacroManualQaEvidencePacket() accepts every required Section 6/7/13/14/24/32 row.")
    for (const finding of decision.findings) {
      findings.push(`manualQaChecklistComplete ${finding.message}`)
    }
  }
}

function validateFinalEvidenceIntakeDoc(markdown: string, findings: string[]): void {
  for (const key of FINAL_COMPLETION_EVIDENCE_KEYS) {
    if (!markdown.includes(`\`${key}\``)) {
      findings.push(`${FINAL_EVIDENCE_INTAKE_PATH}: missing final evidence field \`${key}\`.`)
    }
  }

  for (const term of REQUIRED_EVIDENCE_INTAKE_TERMS) {
    if (!markdown.includes(term)) {
      findings.push(`${FINAL_EVIDENCE_INTAKE_PATH}: missing required intake term \`${term}\`.`)
    }
  }
}

async function main(): Promise<void> {
  const findings: string[] = []
  const artifactText = await readFile(FINAL_COMPLETION_EVIDENCE_PATH, "utf8")
  const gateText = await readFile(FINAL_COMPLETION_GATE_PATH, "utf8")
  const finalEvidenceIntakeText = await readFile(FINAL_EVIDENCE_INTAKE_PATH, "utf8")
  const checklistText = await readFile(MANUAL_QA_CHECKLIST_PATH, "utf8")
  const operationalCompletionPacketText = await readFile(OPERATIONAL_COMPLETION_PACKET_PATH, "utf8")
  const ciArtifactPacketText = await readFile(CI_ARTIFACT_PACKET_PATH, "utf8")
  const ownerReleaseApprovalPacketText = await readFile(OWNER_RELEASE_APPROVAL_PACKET_PATH, "utf8")
  const launchArtifactPacketText = await readFile(LAUNCH_ARTIFACT_PACKET_PATH, "utf8")
  const aiQualityHumanScoredPacketText = await readFile(AI_QUALITY_HUMAN_SCORED_PACKET_PATH, "utf8")
  const productionMetricsExportPacketText = await readFile(PRODUCTION_METRICS_EXPORT_PACKET_PATH, "utf8")

  let parsedArtifact: unknown
  try {
    parsedArtifact = JSON.parse(artifactText)
  } catch (error) {
    findings.push(`${FINAL_COMPLETION_EVIDENCE_PATH}: invalid JSON: ${(error as Error).message}`)
  }

  let parsedOperationalCompletionPacket: unknown
  try {
    parsedOperationalCompletionPacket = JSON.parse(operationalCompletionPacketText)
  } catch (error) {
    findings.push(`${OPERATIONAL_COMPLETION_PACKET_PATH}: invalid JSON: ${(error as Error).message}`)
  }

  let parsedCiArtifactPacket: unknown
  try {
    parsedCiArtifactPacket = JSON.parse(ciArtifactPacketText)
  } catch (error) {
    findings.push(`${CI_ARTIFACT_PACKET_PATH}: invalid JSON: ${(error as Error).message}`)
  }

  let parsedOwnerReleaseApprovalPacket: unknown
  try {
    parsedOwnerReleaseApprovalPacket = JSON.parse(ownerReleaseApprovalPacketText)
  } catch (error) {
    findings.push(`${OWNER_RELEASE_APPROVAL_PACKET_PATH}: invalid JSON: ${(error as Error).message}`)
  }

  let parsedLaunchArtifactPacket: unknown
  try {
    parsedLaunchArtifactPacket = JSON.parse(launchArtifactPacketText)
  } catch (error) {
    findings.push(`${LAUNCH_ARTIFACT_PACKET_PATH}: invalid JSON: ${(error as Error).message}`)
  }

  let parsedAiQualityHumanScoredPacket: unknown
  try {
    parsedAiQualityHumanScoredPacket = JSON.parse(aiQualityHumanScoredPacketText)
  } catch (error) {
    findings.push(`${AI_QUALITY_HUMAN_SCORED_PACKET_PATH}: invalid JSON: ${(error as Error).message}`)
  }

  let parsedProductionMetricsExportPacket: unknown
  try {
    parsedProductionMetricsExportPacket = JSON.parse(productionMetricsExportPacketText)
  } catch (error) {
    findings.push(`${PRODUCTION_METRICS_EXPORT_PACKET_PATH}: invalid JSON: ${(error as Error).message}`)
  }

  const artifact = validateEvidenceArtifact(parsedArtifact, findings)
  const operationalCompletionPacket = validateOperationalEvidenceCompletionPacket(parsedOperationalCompletionPacket, findings)
  const ciArtifactPacket = validateCiArtifactPacket(parsedCiArtifactPacket, findings)
  const ownerReleaseApprovalPacket = validateOwnerReleaseApprovalPacket(parsedOwnerReleaseApprovalPacket, findings)
  const launchArtifactPacket = validateLaunchArtifactPacket(parsedLaunchArtifactPacket, findings)
  const aiQualityHumanScoredPacket = validateAiQualityHumanScoredPacket(parsedAiQualityHumanScoredPacket, findings)
  const productionMetricsExportPacket = validateProductionMetricsExportPacket(parsedProductionMetricsExportPacket, findings)
  validateFinalEvidenceIntakeDoc(finalEvidenceIntakeText, findings)
  if (operationalCompletionPacket) {
    validateOperationalCompletionPacketPreclaimRows(operationalCompletionPacket, findings)
  }
  if (ciArtifactPacket) {
    validateCiArtifactPacketPreclaimRows(ciArtifactPacket, findings)
  }
  if (ownerReleaseApprovalPacket) {
    validateOwnerReleaseApprovalPacketPreclaim(ownerReleaseApprovalPacket, findings)
  }
  if (launchArtifactPacket) {
    validateLaunchArtifactPacketPreclaimRows(launchArtifactPacket, findings)
  }
  if (aiQualityHumanScoredPacket) {
    validateAiQualityHumanScoredPacketPreclaim(aiQualityHumanScoredPacket, findings)
  }
  if (productionMetricsExportPacket) {
    validateProductionMetricsExportPacketPreclaimRows(productionMetricsExportPacket, findings)
  }
  validateCrossPacketTargetCommitConsistency(ciArtifactPacket, ownerReleaseApprovalPacket, findings)
  const manualRows = parseManualQaChecklistRows(checklistText, findings)
  validateManualQaRows(manualRows, findings)

  if (artifact) {
    const renderedGate = renderAstraMacroPlanCompletionGateNote(artifact.evidence, ASTRA_MACRO_OPERATIONAL_EVIDENCE, {
      generatedAt: artifact.generatedAt,
      label: artifact.label,
    })
    if (gateText !== renderedGate) {
      findings.push(`${FINAL_COMPLETION_GATE_PATH}: generated gate note is out of sync with ${FINAL_COMPLETION_EVIDENCE_PATH}.`)
    }

    const manualRowsPassing = allManualQaRowsPassing(manualRows)
    if (artifact.evidence.manualQaChecklistComplete && !manualRowsPassing) {
      findings.push("artifact.evidence.manualQaChecklistComplete: cannot be true until every manual QA row is pass or pass-with-downgrade.")
    }
    if (artifact.evidence.manualQaChecklistComplete) {
      validateManualQaCompletionPacket(manualRows, findings)
    }
    if (artifact.evidence.ciQualityArtifactsAttached || artifact.evidence.ciLiveBrowserArtifactsAttached) {
      if (!ciArtifactPacket) {
        findings.push("artifact.evidence.ciQualityArtifactsAttached/ciLiveBrowserArtifactsAttached: cannot be true without a valid CI artifact packet.")
      } else {
        const ciDecision = evaluateAstraMacroCiArtifactPacket(
          ciArtifactPacket.rows as Parameters<typeof evaluateAstraMacroCiArtifactPacket>[0],
        )
        if (!ciDecision.acceptable) {
          findings.push("artifact.evidence.ciQualityArtifactsAttached/ciLiveBrowserArtifactsAttached: cannot be true until evaluateAstraMacroCiArtifactPacket() accepts the CI artifact packet.")
          for (const finding of ciDecision.findings) {
            findings.push(`ciArtifactPacket ${finding.message}`)
          }
        }
      }
    }
    if (artifact.evidence.ownerReleaseApprovalRecorded) {
      if (!ownerReleaseApprovalPacket) {
        findings.push("artifact.evidence.ownerReleaseApprovalRecorded: cannot be true without a valid owner release approval packet.")
      } else {
        const approvalDecision = evaluateAstraMacroReleaseApprovalPacket(
          ownerReleaseApprovalPacket.approval as Parameters<typeof evaluateAstraMacroReleaseApprovalPacket>[0],
        )
        if (!approvalDecision.acceptable) {
          findings.push("artifact.evidence.ownerReleaseApprovalRecorded: cannot be true until evaluateAstraMacroReleaseApprovalPacket() accepts the owner approval packet.")
          for (const finding of approvalDecision.findings) {
            findings.push(`ownerReleaseApprovalPacket ${finding.message}`)
          }
        }
      }
    }
    if (artifact.evidence.billingLegalStoreGtmArtifactsAttached) {
      if (!launchArtifactPacket) {
        findings.push("artifact.evidence.billingLegalStoreGtmArtifactsAttached: cannot be true without a valid launch artifact packet.")
      } else {
        const launchDecision = evaluateAstraMacroLaunchArtifactPacket(
          launchArtifactPacket.rows as Parameters<typeof evaluateAstraMacroLaunchArtifactPacket>[0],
        )
        if (!launchDecision.acceptable) {
          findings.push("artifact.evidence.billingLegalStoreGtmArtifactsAttached: cannot be true until evaluateAstraMacroLaunchArtifactPacket() accepts the launch artifact packet.")
          for (const finding of launchDecision.findings) {
            findings.push(`launchArtifactPacket ${finding.message}`)
          }
        }
      }
    }
    if (artifact.evidence.humanScoredAiQualityReportAttached) {
      if (!aiQualityHumanScoredPacket) {
        findings.push("artifact.evidence.humanScoredAiQualityReportAttached: cannot be true without a valid human-scored AI quality packet.")
      } else {
        const aiQualityDecision = evaluateAiQualityHumanScoredReportEvidence(aiQualityHumanScoredPacket.evidence)
        if (!aiQualityDecision.acceptable) {
          findings.push("artifact.evidence.humanScoredAiQualityReportAttached: cannot be true until evaluateAiQualityHumanScoredReportEvidence() accepts the AI quality packet.")
          for (const finding of aiQualityDecision.findings) {
            findings.push(`aiQualityHumanScoredPacket ${finding.message}`)
          }
        }
      }
    }
    if (artifact.evidence.productionMetricsExportAttached) {
      if (!productionMetricsExportPacket) {
        findings.push("artifact.evidence.productionMetricsExportAttached: cannot be true without a valid production metrics export packet.")
      } else {
        const metricsDecision = evaluateAstraProductionMetricsExportPacket(
          productionMetricsExportPacket.rows as Parameters<typeof evaluateAstraProductionMetricsExportPacket>[0],
        )
        if (!metricsDecision.acceptable) {
          findings.push("artifact.evidence.productionMetricsExportAttached: cannot be true until evaluateAstraProductionMetricsExportPacket() accepts the production metrics export packet.")
          for (const finding of metricsDecision.findings) {
            findings.push(`productionMetricsExportPacket ${finding.message}`)
          }
        }
      }
    }

    const operationalDecision = evaluateAstraMacroOperationalEvidence(ASTRA_MACRO_OPERATIONAL_EVIDENCE)
    if (!operationalDecision.strongerClaimBlocked) {
      if (!operationalCompletionPacket) {
        findings.push("operational_evidence: cannot clear without a valid operational evidence completion packet.")
      } else {
        const packetDecision = evaluateAstraMacroOperationalEvidenceCompletionPacket(
          operationalCompletionPacket.rows as Parameters<typeof evaluateAstraMacroOperationalEvidenceCompletionPacket>[0],
        )
        if (!packetDecision.complete) {
          findings.push("operational_evidence: cannot clear until evaluateAstraMacroOperationalEvidenceCompletionPacket() accepts every operational evidence area.")
          for (const finding of packetDecision.findings) {
            findings.push(`operational_evidence ${finding.message}`)
          }
        }
      }
    }

    const decision = evaluateAstraMacroPlanCompletion(artifact.evidence)
    console.log(`Macro final completion check: valid=${findings.length === 0 ? "yes" : "no"}`)
    console.log(`Complete: ${decision.complete ? "yes" : "no"}`)
    console.log(`Blocker count: ${decision.blockers.length}`)
    for (const blocker of decision.blockers) {
      console.log(`- ${blocker.code}: ${blocker.message}`)
    }
  }

  if (findings.length > 0) {
    console.error("\nMacro final completion check failed:")
    for (const finding of findings) {
      console.error(`- ${finding}`)
    }
    process.exitCode = 1
  }
}

await main()
