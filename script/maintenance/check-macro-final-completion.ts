import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  type EvidenceReferenceOptions,
  evidenceReferenceDuplicateIdentity,
  isEvidenceLikeReference,
  isRepoArtifactPathReference,
} from "../../src/utils/evidence-reference"
import {
  ASTRA_AI_QUALITY_ABILITY_CATEGORIES,
  ASTRA_AI_QUALITY_ERROR_TAXONOMY,
  evaluateAiQualityHumanScoredReportEvidence,
} from "../../src/utils/ai-quality-system"
import type { AiQualityRunSummary } from "../../src/utils/ai-quality-system"
import type {
  AstraMacroOperationalEvidenceCompletionPacketRow,
  AstraMacroPlanCompletionEvidence,
} from "../../src/utils/macro-operational-evidence"
import {
  ASTRA_PRODUCTION_METRIC_EXPORT_REQUIREMENTS,
  evaluateAstraProductMetricsReadiness,
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

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

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
const PRODUCT_METRICS_READINESS_PACKET_PATH = "docs/reviews/macro-product-metrics-readiness-packet-2026-05-28.json"

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
  productionMetricsExportAttached: [PRODUCTION_METRICS_EXPORT_PACKET_PATH, PRODUCT_METRICS_READINESS_PACKET_PATH],
}

function fieldRequiresEvidenceLinkIdentity(field: FinalCompletionEvidenceKey, duplicateIdentity: string): boolean {
  return REQUIRED_EVIDENCE_LINK_PATHS[field].some((path) => evidenceReferenceDuplicateIdentity(path) === duplicateIdentity)
}

function fieldsCanShareEvidenceLinkIdentity(
  existingField: FinalCompletionEvidenceKey,
  currentField: FinalCompletionEvidenceKey,
  duplicateIdentity: string,
): boolean {
  return fieldRequiresEvidenceLinkIdentity(existingField, duplicateIdentity)
    && fieldRequiresEvidenceLinkIdentity(currentField, duplicateIdentity)
}

function fieldAllowsEvidenceLink(field: FinalCompletionEvidenceKey, link: string): boolean {
  return REQUIRED_EVIDENCE_LINK_PATHS[field].some((requiredPath) => evidenceLinkMatchesRequiredPath(link, requiredPath))
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

type ProductMetricsReadinessEvidence = Parameters<typeof evaluateAstraProductMetricsReadiness>[0]

type ProductMetricsReadinessPacket = {
  schema: "astra-macro-product-metrics-readiness-packet.v1"
  generatedAt: string
  label: string
  ownerDate: string
  evidenceLink: string
  evidence: ProductMetricsReadinessEvidence
}

const PRODUCT_METRICS_READINESS_EVIDENCE_KEYS = [
  "productQuestionsHaveMetricCoverage",
  "activationMetricsCovered",
  "understandingMetricsCovered",
  "learningMetricsCovered",
  "membershipMetricsCovered",
  "telemetryAvoidsSensitiveRawText",
  "telemetryPrefersEventsOverContent",
  "privacyModeReducesTelemetryDetail",
  "userDataControlsAreClear",
] as const satisfies ReadonlyArray<keyof ProductMetricsReadinessEvidence>

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
    || /\b(?:(?:fake|dummy|latest|dev|local)[-_ ]?(?:proof|evidence|artifact|report)|(?<!provider[-_ ])sample[-_ ]?(?:proof|evidence|artifact|report)|(?:proof|evidence|artifact|report)[-_ ]?(?:sample|fake|dummy|latest|dev|local))\b/.test(normalizedValue)
}

function digestOrVersionIdentity(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^(?:(?:sha(?:256|384|512)?|checksum|digest|version|build|artifact|run|rubric|fixture|manifest|export|query)[:=/ -]+)+/, "")
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
  if (/^[1-9]\d{5,}$/.test(normalizedValue)) return true
  if (/^20\d{2}-\d{2}-\d{2}$/.test(normalizedValue)) return includesIsoDate(normalizedValue)
  return /^[a-z][a-z0-9]*(?:[-_.][a-z0-9]+)+$/i.test(normalizedValue)
}

function isWeakDigestOrVersionReference(value: string): boolean {
  return isWeakDigestReference(value) && !isStableVersionReference(value)
}

function hasNonWeakIdentityCore(value: string): boolean {
  const compactValue = value.replace(/[^a-z0-9]/g, "")
  return /\d/.test(compactValue) && !/^0+$/.test(compactValue) && !/^([a-z0-9])\1+$/.test(compactValue)
}

function isUuidReference(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim())
}

function isPrefixedNumericIdentityReference(value: string): boolean {
  const normalizedValue = value.trim().toLowerCase()
  if (!/^[a-z][a-z0-9]*(?:[-_.:][a-z0-9]+)+$/.test(normalizedValue)) return false
  const numericParts = normalizedValue.match(/\d+/g) ?? []
  return numericParts.some((part) => part.length >= 4 && !/^0+$/.test(part))
}

function isDateStampedIdentityReference(value: string): boolean {
  const normalizedValue = value.trim().toLowerCase()
  return /[a-z]/.test(normalizedValue) && includesIsoDate(normalizedValue)
}

function isStableExportIdentityReference(value: string): boolean {
  const normalizedValue = value.trim().toLowerCase()
  if (isWeakContextEvidenceReference(normalizedValue)) return false

  const identityValue = digestOrVersionIdentity(value)
  const compactValue = identityValue.replace(/[^a-z0-9]/g, "")
  if (!hasNonWeakIdentityCore(identityValue)) return false
  return compactValue.length >= 12
    || isUuidReference(identityValue)
    || isPrefixedNumericIdentityReference(identityValue)
    || isDateStampedIdentityReference(identityValue)
}

function isStableQueryVersionReference(value: string): boolean {
  if (isStableExportIdentityReference(value)) return true
  const identityValue = digestOrVersionIdentity(value)
  if (isWeakContextEvidenceReference(identityValue)) return false
  return /^v?\d+\.\d+\.\d+(?:[-+][a-z0-9.-]+)?$/i.test(identityValue)
    || (/^20\d{2}-\d{2}-\d{2}$/.test(identityValue) && includesIsoDate(identityValue))
}

function isWeakContextEvidenceReference(value: string): boolean {
  const normalizedValue = value.trim().toLowerCase()
  return isPlaceholderEvidenceReference(normalizedValue) || hasWeakEvidenceKeyword(normalizedValue)
}

function currentUtcDateStart(): number {
  const now = new Date()
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
}

function includesIsoDate(value: string): boolean {
  const matches = [...value.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)]
  if (matches.length === 0) return false
  const today = currentUtcDateStart()
  return matches.every((match) => {
    const timestamp = parseIsoDate(match[1])
    return timestamp !== null && timestamp <= today
  })
}

function hasOwnerIdentityWithIsoDate(value: string): boolean {
  if (value.trim() !== value || !includesIsoDate(value) || isWeakContextEvidenceReference(value)) return false
  const ownerText = value
    .replace(/\b20\d{2}-\d{2}-\d{2}\b/g, " ")
    .replace(/[—–:|/(),._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  const ownerIdentity = ownerText.toLowerCase()
  if (/^(?:owner|release owner|qa owner|tester|metrics owner)$/.test(ownerIdentity)) return false
  return /[a-z][a-z0-9@.-]{1,}/i.test(ownerText)
}

function manualQaRowContextMatches(value: string, section: number, qaRow: string): boolean {
  const normalizedValue = value.toLowerCase()
  const normalizedRow = qaRow.toLowerCase()
  switch (section) {
    case 6:
      return /\b(?:source|library|asset|delete|export|pdf|epub|subtitle|video|theme|return)\b/.test(normalizedValue)
    case 7:
      return /\b(?:personalization|profile|privacy|memory|excluded|options|review|fallback)\b/.test(normalizedValue)
    case 13:
      return /\b(?:copy|onboarding|popup|deep read|library|review|error|boundary|store|landing)\b/.test(normalizedValue)
    case 14:
      return /\b(?:support|help|status|incident|owner|limitations|report)\b/.test(normalizedValue)
    case 24:
      return /\b(?:ai|provider|fixture|scoring|sample|triage|trend|decision|quality)\b/.test(normalizedValue)
    case 32:
      return /\b(?:accessibility|keyboard|screen reader|voiceover|nvda|jaws|contrast|scaled text|reduced motion|mouse)\b/.test(normalizedValue)
    default:
      return normalizedRow.length > 0 && normalizedRow.split(/[^a-z0-9]+/).filter((part) => part.length >= 5).some((part) => normalizedValue.includes(part))
  }
}

function isSpecificManualQaEnvironment(value: string, section: number, qaRow: string): boolean {
  const normalizedValue = value.toLowerCase()
  const hasBrowser = /\b(?:chrome|chromium|firefox|safari|edge)\b/.test(normalizedValue)
  const hasOs = /\b(?:macos|windows|linux|ubuntu|android|ios)\b/.test(normalizedValue)
  return hasBrowser
    && hasOs
    && /\b(?:build|extension|relay|api|web app|candidate|rc)\b/.test(normalizedValue)
    && manualQaRowContextMatches(value, section, qaRow)
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
  if (!/^20\d{2}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) || Number.isNaN(Date.parse(value))) {
    return false
  }
  return parseIsoDate(value.slice(0, 10)) !== null
}

function expectedGeneratedAtDateFromEvidencePath(value: string): string | null {
  return /-(20\d{2}-\d{2}-\d{2})\.(?:json|md)$/.exec(value)?.[1] ?? null
}

function validateIsoGeneratedAt(value: unknown, path: string, findings: string[], evidencePath?: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    findings.push(`${path}: expected an ISO timestamp string.`)
    return ""
  }
  const validIsoTimestamp = isIsoTimestamp(value)
  if (!validIsoTimestamp) {
    findings.push(`${path}: expected an ISO timestamp string.`)
  }
  const expectedDate = evidencePath ? expectedGeneratedAtDateFromEvidencePath(evidencePath) : null
  if (validIsoTimestamp && Date.parse(value) > Date.now()) {
    findings.push(`${path}: generatedAt timestamp must not be in the future.`)
  }
  if (validIsoTimestamp && expectedDate !== null && value.slice(0, 10) !== expectedDate) {
    findings.push(`${path}: expected generatedAt date ${expectedDate} to match ${evidencePath}.`)
  }
  return value
}

function validatePacketLabel(value: unknown, path: string, findings: string[], evidencePath?: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    findings.push(`${path}: expected a non-empty string.`)
    return ""
  }
  if (value.trim() !== value || isPlaceholderEvidenceReference(value)) {
    findings.push(`${path}: expected a canonical non-placeholder label.`)
  }
  const expectedDate = evidencePath ? expectedGeneratedAtDateFromEvidencePath(evidencePath) : null
  const labelDateResults = isoDateParseResults(value)
  if (labelDateResults.some((result) => result.timestamp === null)) {
    findings.push(`${path}: label date must use real calendar YYYY-MM-DD values.`)
  }
  if (expectedDate !== null && (labelDateResults.length === 0 || labelDateResults.some((result) => result.value !== expectedDate))) {
    findings.push(`${path}: expected label date ${expectedDate} to match ${evidencePath}.`)
  }
  return value
}

function validateDatedMarkdownTitle(markdown: string, evidencePath: string, findings: string[]): void {
  const titles = visibleMarkdownText(markdown).split("\n").map((line) => line.trim()).filter((line) => /^#\s+/.test(line))
  if (titles.length === 0) {
    findings.push(`${evidencePath}: missing H1 title.`)
    return
  }
  if (titles.length > 1) {
    findings.push(`${evidencePath}: expected exactly one visible H1 title.`)
  }
  const expectedDate = expectedGeneratedAtDateFromEvidencePath(evidencePath)
  const titleDateResults = titles.flatMap((title) => isoDateParseResults(title))
  if (titleDateResults.some((result) => result.timestamp === null)) {
    findings.push(`${evidencePath}: title date must use real calendar YYYY-MM-DD values.`)
  }
  if (expectedDate !== null && (titleDateResults.length === 0 || titleDateResults.some((result) => result.value !== expectedDate))) {
    findings.push(`${evidencePath}: expected title date ${expectedDate} to match filename.`)
  }
}

function isoDateParseResults(value: string): Array<{ value: string; timestamp: number | null }> {
  return [...value.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)]
    .map((match) => ({ value: match[1], timestamp: parseIsoDate(match[1]) }))
}

function packetGeneratedAtDateTimestamp(generatedAt: string): number | null {
  return isIsoTimestamp(generatedAt) ? parseIsoDate(generatedAt.slice(0, 10)) : null
}

function validateEvidenceDateNotAfterPacketGeneratedAt(value: string, path: string, generatedAt: string, findings: string[]): void {
  const dateResults = isoDateParseResults(value)
  if (dateResults.some((result) => result.timestamp === null)) {
    findings.push(`${path}: evidence date must use real calendar YYYY-MM-DD values.`)
  }
  const generatedAtTimestamp = packetGeneratedAtDateTimestamp(generatedAt)
  if (generatedAtTimestamp === null) return
  if (dateResults.some((result) => result.timestamp !== null && result.timestamp > generatedAtTimestamp)) {
    findings.push(`${path}: evidence date must not be after packet generatedAt date.`)
  }
}

function validateEvidenceTimestampNotAfterPacketGeneratedAt(value: string | undefined, path: string, generatedAt: string, findings: string[]): void {
  if (value === undefined || !isIsoTimestamp(value) || !isIsoTimestamp(generatedAt)) return
  if (Date.parse(value) > Date.parse(generatedAt)) {
    findings.push(`${path}: evidence timestamp must not be after packet generatedAt timestamp.`)
  }
}

function validateEvidenceDateNotAfterDatedArtifactPath(value: string, path: string, evidencePath: string, findings: string[]): void {
  const dateResults = isoDateParseResults(value)
  if (dateResults.some((result) => result.timestamp === null)) {
    findings.push(`${path}: evidence date must use real calendar YYYY-MM-DD values.`)
  }
  const expectedDate = expectedGeneratedAtDateFromEvidencePath(evidencePath)
  const expectedTimestamp = expectedDate === null ? null : parseIsoDate(expectedDate)
  if (expectedTimestamp === null) return
  if (dateResults.some((result) => result.timestamp !== null && result.timestamp > expectedTimestamp)) {
    findings.push(`${path}: evidence date must not be after ${evidencePath} date.`)
  }
}

function isUnattemptedIntakeLabel(value: string): boolean {
  return /\bintake$/i.test(value.trim())
}

function packetLabelIndicatesAttemptedEvidence(value: string): boolean {
  return value.trim().length > 0 && !isUnattemptedIntakeLabel(value)
}

function evidenceLinkMatchesRequiredPath(link: string, requiredPath: string): boolean {
  return isRepoArtifactPathReference(link) && link === requiredPath
}

function repoPath(value: string): string {
  return resolve(REPO_ROOT, value)
}

interface JsonObjectScanFrame {
  keys: Set<string>
  expectKey: boolean
}

function readJsonStringToken(text: string, start: number): { value: string; end: number } | null {
  if (text[start] !== '"') return null
  let value = ""
  for (let index = start + 1; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"') return { value, end: index + 1 }
    if (char !== "\\") {
      value += char
      continue
    }
    const escaped = text[index + 1]
    if (escaped === undefined) return null
    if (escaped === "u") {
      const hex = text.slice(index + 2, index + 6)
      if (!/^[0-9a-f]{4}$/i.test(hex)) return null
      value += String.fromCharCode(Number.parseInt(hex, 16))
      index += 5
      continue
    }
    const escapeValues: Record<string, string> = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" }
    if (!(escaped in escapeValues)) return null
    value += escapeValues[escaped]
    index += 1
  }
  return null
}

function nextNonWhitespaceIndex(text: string, start: number): number {
  let index = start
  while (index < text.length && /\s/.test(text[index] ?? "")) index += 1
  return index
}

function duplicateJsonObjectKeyFindings(text: string, path: string): string[] {
  const findings: string[] = []
  const stack: Array<JsonObjectScanFrame | "array"> = []

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (/\s/.test(char ?? "")) continue

    if (char === '"') {
      const token = readJsonStringToken(text, index)
      if (!token) break
      const current = stack[stack.length - 1]
      if (current !== undefined && current !== "array" && current.expectKey && text[nextNonWhitespaceIndex(text, token.end)] === ":") {
        if (current.keys.has(token.value)) {
          findings.push(`${path}: duplicate JSON object key \`${token.value}\`.`)
        }
        current.keys.add(token.value)
        current.expectKey = false
      }
      index = token.end - 1
      continue
    }

    if (char === "{") {
      stack.push({ keys: new Set<string>(), expectKey: true })
      continue
    }
    if (char === "[") {
      stack.push("array")
      continue
    }
    if (char === "}" || char === "]") {
      stack.pop()
      continue
    }
    if (char === ",") {
      const current = stack[stack.length - 1]
      if (current !== undefined && current !== "array") current.expectKey = true
    }
  }

  return findings
}

function parseJsonEvidence(text: string, path: string, findings: string[]): unknown {
  findings.push(...duplicateJsonObjectKeyFindings(text, path))
  try {
    return JSON.parse(text) as unknown
  } catch (error) {
    findings.push(`${path}: invalid JSON: ${(error as Error).message}`)
    return undefined
  }
}

function repoArtifactPathExists(value: string): boolean {
  return existsSync(repoPath(value))
}

function validateExistingEvidenceReference(
  value: string,
  path: string,
  findings: string[],
  options: EvidenceReferenceOptions = {},
): void {
  if (value.trim().length === 0 || !isEvidenceLikeReference(value, options)) return
  if (isRepoArtifactPathReference(value, options) && !repoArtifactPathExists(value)) {
    findings.push(`${path}: repo artifact path does not exist.`)
  }
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
  validateIsoGeneratedAt(value.generatedAt, "artifact.generatedAt", findings, FINAL_COMPLETION_EVIDENCE_PATH)
  validatePacketLabel(value.label, "artifact.label", findings, FINAL_COMPLETION_EVIDENCE_PATH)
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
  const crossFieldEvidenceLinks = new Map<string, FinalCompletionEvidenceKey>()

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
      const normalizedLink = link.trim()
      const duplicateIdentity = evidenceReferenceDuplicateIdentity(link)
      if (seenLinks.has(duplicateIdentity)) {
        findings.push(`artifact.evidenceLinks.${key}[${index}]: duplicate evidence link.`)
      }
      seenLinks.add(duplicateIdentity)
      const existingField = crossFieldEvidenceLinks.get(duplicateIdentity)
      if (existingField !== undefined && existingField !== key && !fieldsCanShareEvidenceLinkIdentity(existingField, key, duplicateIdentity)) {
        findings.push(`artifact.evidenceLinks.${key}[${index}]: duplicate evidence link already used by ${existingField}.`)
      } else if (existingField === undefined) {
        crossFieldEvidenceLinks.set(duplicateIdentity, key)
      }
      if (normalizedLink.length === 0) {
        findings.push(`artifact.evidenceLinks.${key}[${index}]: expected non-empty link.`)
      } else if (isPlaceholderEvidenceReference(normalizedLink)) {
        findings.push(`artifact.evidenceLinks.${key}[${index}]: placeholder evidence links are not allowed.`)
      } else if (!isEvidenceLikeReference(link)) {
        findings.push(`artifact.evidenceLinks.${key}[${index}]: expected URL or repo artifact path.`)
      } else {
        validateExistingEvidenceReference(link, `artifact.evidenceLinks.${key}[${index}]`, findings)
      }
    }
    if (!evidence[key] && links.length > 0) {
      findings.push(`artifact.evidenceLinks.${key}: false fields must keep evidenceLinks empty until the corresponding packet/checklist is acceptable.`)
    }
    if (evidence[key] && links.length === 0) {
      findings.push(`artifact.evidence.${key}: cannot be true without at least one evidence link.`)
    }
    if (evidence[key]) {
      for (const [index, link] of links.entries()) {
        if (!fieldAllowsEvidenceLink(key, link)) {
          findings.push(`artifact.evidenceLinks.${key}[${index}]: unexpected evidence link for ${key}; top-level links must be the required machine-readable packet paths.`)
        }
      }
      for (const requiredPath of REQUIRED_EVIDENCE_LINK_PATHS[key]) {
        if (!links.some((link) => evidenceLinkMatchesRequiredPath(link, requiredPath))) {
          findings.push(`artifact.evidenceLinks.${key}: expected a matching machine-readable packet path ${requiredPath}.`)
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
  validateIsoGeneratedAt(value.generatedAt, "operationalPacket.generatedAt", findings, OPERATIONAL_COMPLETION_PACKET_PATH)
  validatePacketLabel(value.label, "operationalPacket.label", findings, OPERATIONAL_COMPLETION_PACKET_PATH)
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
    const normalizedAreaId = row.areaId.trim()
    const areaIdIdentity = normalizedAreaId.toLowerCase()
    const canonicalAreaId = ASTRA_MACRO_OPERATIONAL_EVIDENCE.find((item) => item.id.toLowerCase() === areaIdIdentity)?.id
    if (normalizedAreaId !== row.areaId || (canonicalAreaId !== undefined && canonicalAreaId !== row.areaId)) {
      findings.push(`operationalPacket.rows.${row.areaId}: area id must use canonical casing without surrounding whitespace.`)
    }
    if (canonicalAreaId === undefined || !expectedAreaIds.has(canonicalAreaId)) {
      findings.push(`operationalPacket.rows.${row.areaId}: untracked operational evidence area.`)
    } else if (row.verdict === "proved" || row.verdict === "not-proved") {
      trackedRows.push({
        ...row,
        areaId: canonicalAreaId,
        verdict: row.verdict,
      })
    }
    if (seenAreaIds.has(areaIdIdentity)) {
      findings.push(`operationalPacket.rows.${row.areaId}: duplicate operational evidence row.`)
    }
    seenAreaIds.add(areaIdIdentity)

    validateEvidenceDateNotAfterPacketGeneratedAt(row.ownerDate, `operationalPacket.rows.${row.areaId}.ownerDate`, packet.generatedAt, findings)

    validateEvidenceDateNotAfterPacketGeneratedAt(row.evidenceLink, `operationalPacket.rows.${row.areaId}.evidenceLink`, packet.generatedAt, findings)
    if (row.evidenceLink && isPlaceholderEvidenceReference(row.evidenceLink)) {
      findings.push(`operationalPacket.rows.${row.areaId}: placeholder evidence links are not allowed.`)
    } else {
      validateExistingEvidenceReference(row.evidenceLink, `operationalPacket.rows.${row.areaId}.evidenceLink`, findings)
    }
  }

  if (packet.rows.length > 0 || packetLabelIndicatesAttemptedEvidence(packet.label)) {
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
  validateIsoGeneratedAt(value.generatedAt, "ciArtifactPacket.generatedAt", findings, CI_ARTIFACT_PACKET_PATH)
  validatePacketLabel(value.label, "ciArtifactPacket.label", findings, CI_ARTIFACT_PACKET_PATH)
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
    const normalizedEvidenceField = row.evidenceField.trim()
    const evidenceFieldIdentity = normalizedEvidenceField.toLowerCase()
    const canonicalEvidenceField = ASTRA_MACRO_CI_ARTIFACT_REQUIREMENTS.find(
      (requirement) => requirement.evidenceField.toLowerCase() === evidenceFieldIdentity,
    )?.evidenceField
    if (normalizedEvidenceField !== row.evidenceField || (canonicalEvidenceField !== undefined && canonicalEvidenceField !== row.evidenceField)) {
      findings.push(`ciArtifactPacket.rows.${row.evidenceField}: evidence field must use canonical casing without surrounding whitespace.`)
    }
    if (canonicalEvidenceField === undefined || !expectedEvidenceFields.has(canonicalEvidenceField)) {
      findings.push(`ciArtifactPacket.rows.${row.evidenceField}: untracked CI artifact evidence field.`)
    }
    if (seenEvidenceFields.has(evidenceFieldIdentity)) {
      findings.push(`ciArtifactPacket.rows.${row.evidenceField}: duplicate CI artifact evidence row.`)
    }
    seenEvidenceFields.add(evidenceFieldIdentity)

    if (row.commitSha.trim().length > 0) {
      commitShas.add(row.commitSha.trim().toLowerCase())
    }
    validateEvidenceDateNotAfterPacketGeneratedAt(row.ownerDate, `ciArtifactPacket.rows.${row.evidenceField}.ownerDate`, packet.generatedAt, findings)

    for (const field of ["runId", "jobName", "artifactId", "artifactDigest", "artifactManifestPath", "runUrl", "artifactUrl"] as const) {
      if (row[field] && isPlaceholderEvidenceReference(row[field])) {
        findings.push(`ciArtifactPacket.rows.${row.evidenceField}.${field}: placeholder evidence links are not allowed.`)
      }
    }
    validateEvidenceDateNotAfterPacketGeneratedAt(row.artifactManifestPath, `ciArtifactPacket.rows.${row.evidenceField}.artifactManifestPath`, packet.generatedAt, findings)
    validateEvidenceDateNotAfterPacketGeneratedAt(row.runUrl, `ciArtifactPacket.rows.${row.evidenceField}.runUrl`, packet.generatedAt, findings)
    validateEvidenceDateNotAfterPacketGeneratedAt(row.artifactUrl, `ciArtifactPacket.rows.${row.evidenceField}.artifactUrl`, packet.generatedAt, findings)
    validateExistingEvidenceReference(row.artifactManifestPath, `ciArtifactPacket.rows.${row.evidenceField}.artifactManifestPath`, findings)
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

  if (packet.rows.length > 0 || packetLabelIndicatesAttemptedEvidence(packet.label)) {
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
  validateIsoGeneratedAt(value.generatedAt, "ownerReleaseApprovalPacket.generatedAt", findings, OWNER_RELEASE_APPROVAL_PACKET_PATH)
  validatePacketLabel(value.label, "ownerReleaseApprovalPacket.label", findings, OWNER_RELEASE_APPROVAL_PACKET_PATH)
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
    packetLabelIndicatesAttemptedEvidence(packet.label) ||
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

  validateEvidenceDateNotAfterPacketGeneratedAt(
    packet.approval.approvalDate,
    "ownerReleaseApprovalPacket.approval.approvalDate",
    packet.generatedAt,
    findings,
  )

  const expectedReviewedArtifactsByIdentity = new Map(
    ASTRA_MACRO_RELEASE_APPROVAL_REQUIREMENT.requiredReviewedArtifacts.map((artifact) => [evidenceReferenceDuplicateIdentity(artifact), artifact]),
  )
  const seenReviewedArtifacts = new Set<string>()

  for (const artifact of packet.approval.reviewedArtifacts) {
    const artifactIdentity = evidenceReferenceDuplicateIdentity(artifact)
    const canonicalArtifact = expectedReviewedArtifactsByIdentity.get(artifactIdentity)
    if (artifact.trim() !== artifact || (canonicalArtifact !== undefined && canonicalArtifact !== artifact)) {
      findings.push(`ownerReleaseApprovalPacket.reviewedArtifacts.${artifact}: reviewed artifact must use canonical path without surrounding whitespace.`)
    }
    if (canonicalArtifact === undefined) {
      findings.push(`ownerReleaseApprovalPacket.reviewedArtifacts.${artifact}: untracked reviewed artifact.`)
    }
    if (seenReviewedArtifacts.has(artifactIdentity)) {
      findings.push(`ownerReleaseApprovalPacket.reviewedArtifacts.${artifact}: duplicate reviewed artifact.`)
    }
    seenReviewedArtifacts.add(artifactIdentity)
    validateEvidenceDateNotAfterPacketGeneratedAt(artifact, `ownerReleaseApprovalPacket.reviewedArtifacts.${artifact}`, packet.generatedAt, findings)
    if (isPlaceholderEvidenceReference(artifact)) {
      findings.push(`ownerReleaseApprovalPacket.reviewedArtifacts.${artifact}: placeholder reviewed artifacts are not allowed.`)
    } else {
      validateExistingEvidenceReference(artifact, `ownerReleaseApprovalPacket.reviewedArtifacts.${artifact}`, findings)
    }
  }

  validateEvidenceDateNotAfterPacketGeneratedAt(
    packet.approval.approvalRecordLink,
    "ownerReleaseApprovalPacket.approval.approvalRecordLink",
    packet.generatedAt,
    findings,
  )
  if (packet.approval.approvalRecordLink && isPlaceholderEvidenceReference(packet.approval.approvalRecordLink)) {
    findings.push("ownerReleaseApprovalPacket.approval.approvalRecordLink: placeholder evidence links are not allowed.")
  } else {
    validateExistingEvidenceReference(packet.approval.approvalRecordLink, "ownerReleaseApprovalPacket.approval.approvalRecordLink", findings)
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
  validateIsoGeneratedAt(value.generatedAt, "launchArtifactPacket.generatedAt", findings, LAUNCH_ARTIFACT_PACKET_PATH)
  validatePacketLabel(value.label, "launchArtifactPacket.label", findings, LAUNCH_ARTIFACT_PACKET_PATH)
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
    const normalizedRequirementId = row.requirementId.trim()
    const requirementIdIdentity = normalizedRequirementId.toLowerCase()
    const canonicalRequirementId = ASTRA_MACRO_LAUNCH_ARTIFACT_REQUIREMENTS.find(
      (requirement) => requirement.id.toLowerCase() === requirementIdIdentity,
    )?.id
    if (normalizedRequirementId !== row.requirementId || (canonicalRequirementId !== undefined && canonicalRequirementId !== row.requirementId)) {
      findings.push(`launchArtifactPacket.rows.${row.requirementId}: requirement id must use canonical casing without surrounding whitespace.`)
    }
    if (canonicalRequirementId === undefined || !expectedRequirementIds.has(canonicalRequirementId)) {
      findings.push(`launchArtifactPacket.rows.${row.requirementId}: untracked launch artifact requirement.`)
    }
    if (seenRequirementIds.has(requirementIdIdentity)) {
      findings.push(`launchArtifactPacket.rows.${row.requirementId}: duplicate launch artifact row.`)
    }
    seenRequirementIds.add(requirementIdIdentity)

    validateEvidenceDateNotAfterPacketGeneratedAt(row.ownerDate, `launchArtifactPacket.rows.${row.requirementId}.ownerDate`, packet.generatedAt, findings)

    validateEvidenceDateNotAfterPacketGeneratedAt(row.evidenceLink, `launchArtifactPacket.rows.${row.requirementId}.evidenceLink`, packet.generatedAt, findings)
    if (row.evidenceLink && isPlaceholderEvidenceReference(row.evidenceLink)) {
      findings.push(`launchArtifactPacket.rows.${row.requirementId}: placeholder evidence links are not allowed.`)
    } else {
      validateExistingEvidenceReference(row.evidenceLink, `launchArtifactPacket.rows.${row.requirementId}.evidenceLink`, findings)
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

  if (packet.rows.length > 0 || packetLabelIndicatesAttemptedEvidence(packet.label)) {
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

function isCanonicalAiQualityEvidenceId(value: string): boolean {
  return value.trim() === value
    && value.length > 0
    && !isWeakContextEvidenceReference(value)
    && /^[a-z0-9][a-z0-9:_-]*$/i.test(value)
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
    } else if (!isCanonicalAiQualityEvidenceId(item.sampleId)) {
      findings.push(`${itemPath}.sampleId: expected canonical non-placeholder sample id.`)
    }
    if (typeof item.capability !== "string" || !allowedCapabilities.has(item.capability)) {
      findings.push(`${itemPath}.capability: expected known AI quality capability.`)
    }
    validateConstrainedNumberField(item.lowestScore, `${itemPath}.lowestScore`, findings, { min: 1, max: 5 })
    if (typeof item.recommendedBacklogLabel !== "string") {
      findings.push(`${itemPath}.recommendedBacklogLabel: expected string.`)
    } else if (!isCanonicalAiQualityEvidenceId(item.recommendedBacklogLabel)) {
      findings.push(`${itemPath}.recommendedBacklogLabel: expected canonical non-placeholder backlog label.`)
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
  if (validateStringArrayField(value.blockerSampleIds, `${path}.blockerSampleIds`, findings)) {
    value.blockerSampleIds.forEach((sampleId, index) => {
      if (!isCanonicalAiQualityEvidenceId(sampleId)) {
        findings.push(`${path}.blockerSampleIds.${index}: expected canonical non-placeholder sample id.`)
      }
    })
  }
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
  validateIsoGeneratedAt(value.generatedAt, "aiQualityHumanScoredPacket.generatedAt", findings, AI_QUALITY_HUMAN_SCORED_PACKET_PATH)
  validatePacketLabel(value.label, "aiQualityHumanScoredPacket.label", findings, AI_QUALITY_HUMAN_SCORED_PACKET_PATH)
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
    packetLabelIndicatesAttemptedEvidence(packet.label) ||
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

  validateEvidenceDateNotAfterPacketGeneratedAt(
    packet.evidence.reviewedAt,
    "aiQualityHumanScoredPacket.evidence.reviewedAt",
    packet.generatedAt,
    findings,
  )
  validateEvidenceTimestampNotAfterPacketGeneratedAt(
    packet.evidence.summary.generatedAt,
    "aiQualityHumanScoredPacket.evidence.summary.generatedAt",
    packet.generatedAt,
    findings,
  )

  for (const field of ["fixtureManifestPath", "providerSampleEvidenceLink", "blockerTriageLink"] as const) {
    validateEvidenceDateNotAfterPacketGeneratedAt(packet.evidence[field], `aiQualityHumanScoredPacket.evidence.${field}`, packet.generatedAt, findings)
  }

  for (const field of ["providerSampleEvidenceLink", "blockerTriageLink"] as const) {
    if (packet.evidence[field] && isPlaceholderEvidenceReference(packet.evidence[field])) {
      findings.push(`aiQualityHumanScoredPacket.evidence.${field}: placeholder evidence links are not allowed.`)
    } else {
      validateExistingEvidenceReference(packet.evidence[field], `aiQualityHumanScoredPacket.evidence.${field}`, findings)
    }
  }
  validateExistingEvidenceReference(
    packet.evidence.fixtureManifestPath,
    "aiQualityHumanScoredPacket.evidence.fixtureManifestPath",
    findings,
    { allowTestFixtures: true },
  )
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
  validateIsoGeneratedAt(value.generatedAt, "productionMetricsExportPacket.generatedAt", findings, PRODUCTION_METRICS_EXPORT_PACKET_PATH)
  validatePacketLabel(value.label, "productionMetricsExportPacket.label", findings, PRODUCTION_METRICS_EXPORT_PACKET_PATH)
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

function validateProductMetricsReadinessPacket(value: unknown, findings: string[]): ProductMetricsReadinessPacket | null {
  if (!isRecord(value)) {
    findings.push(`${PRODUCT_METRICS_READINESS_PACKET_PATH}: expected top-level object.`)
    return null
  }

  validateExactKeys(value, ["schema", "generatedAt", "label", "ownerDate", "evidenceLink", "evidence"], "productMetricsReadinessPacket", findings)
  if (value.schema !== "astra-macro-product-metrics-readiness-packet.v1") {
    findings.push("productMetricsReadinessPacket.schema: expected astra-macro-product-metrics-readiness-packet.v1.")
  }
  validateIsoGeneratedAt(value.generatedAt, "productMetricsReadinessPacket.generatedAt", findings, PRODUCT_METRICS_READINESS_PACKET_PATH)
  validatePacketLabel(value.label, "productMetricsReadinessPacket.label", findings, PRODUCT_METRICS_READINESS_PACKET_PATH)
  if (typeof value.ownerDate !== "string") {
    findings.push("productMetricsReadinessPacket.ownerDate: expected string.")
  }
  if (typeof value.evidenceLink !== "string") {
    findings.push("productMetricsReadinessPacket.evidenceLink: expected string.")
  }
  if (!isRecord(value.evidence)) {
    findings.push("productMetricsReadinessPacket.evidence: expected object.")
    return null
  }

  const evidenceRecord = value.evidence
  validateExactKeys(evidenceRecord, PRODUCT_METRICS_READINESS_EVIDENCE_KEYS, "productMetricsReadinessPacket.evidence", findings)
  const evidence = Object.fromEntries(
    PRODUCT_METRICS_READINESS_EVIDENCE_KEYS.map((key) => {
      if (typeof evidenceRecord[key] !== "boolean") {
        findings.push(`productMetricsReadinessPacket.evidence.${key}: expected boolean.`)
      }
      return [key, evidenceRecord[key] === true]
    }),
  ) as unknown as ProductMetricsReadinessEvidence

  return {
    schema: "astra-macro-product-metrics-readiness-packet.v1",
    generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : "",
    label: typeof value.label === "string" ? value.label : "",
    ownerDate: typeof value.ownerDate === "string" ? value.ownerDate : "",
    evidenceLink: typeof value.evidenceLink === "string" ? value.evidenceLink : "",
    evidence,
  }
}

function productMetricsReadinessPacketAttempted(packet: ProductMetricsReadinessPacket): boolean {
  return packetLabelIndicatesAttemptedEvidence(packet.label)
    || packet.ownerDate.trim().length > 0
    || packet.evidenceLink.trim().length > 0
    || PRODUCT_METRICS_READINESS_EVIDENCE_KEYS.some((key) => packet.evidence[key])
}

function productMetricsReadinessSemanticCandidates(value: string): string[] {
  const candidates = [value]
  try {
    candidates.push(decodeURIComponent(value))
  } catch {
    // Malformed percent-encoding is rejected by evidence reference validation.
  }
  return candidates.map((candidate) => candidate
    .toLowerCase()
    .replace(/[_./:-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim())
}

function hasProductMetricsReadinessContext(value: string): boolean {
  return productMetricsReadinessSemanticCandidates(value).some((candidate) => {
    const namesProductMetricsReadiness = /\b(?:product metrics|metrics readiness|metric readiness|telemetry readiness|telemetry evidence|readiness evidence)\b/.test(candidate)
    const namesTargetReleaseContext = /\b(?:target|release|rc|final gate|production|cohort)\b/.test(candidate)
    return namesProductMetricsReadiness && namesTargetReleaseContext
  })
}

function isSpecificProductMetricsReadinessLabel(value: string): boolean {
  if (value.trim() !== value || isPlaceholderEvidenceReference(value)) return false
  return hasProductMetricsReadinessContext(value)
}

function validateProductMetricsReadinessPacketPreclaim(packet: ProductMetricsReadinessPacket, findings: string[]): void {
  if (!productMetricsReadinessPacketAttempted(packet)) {
    return
  }

  if (isPlaceholderEvidenceReference(packet.label)) {
    findings.push("productMetricsReadinessPacket.label: placeholder readiness labels are not allowed once readiness evidence is attempted.")
  } else if (!isSpecificProductMetricsReadinessLabel(packet.label)) {
    findings.push("productMetricsReadinessPacket.label: attempted readiness evidence label must identify product metrics readiness and target release context.")
  }
  validateEvidenceDateNotAfterPacketGeneratedAt(packet.ownerDate, "productMetricsReadinessPacket.ownerDate", packet.generatedAt, findings)
  if (!hasOwnerIdentityWithIsoDate(packet.ownerDate)) {
    findings.push("productMetricsReadinessPacket.ownerDate: attempted readiness evidence must identify a real owner and include YYYY-MM-DD.")
  }
  validateEvidenceDateNotAfterPacketGeneratedAt(packet.evidenceLink, "productMetricsReadinessPacket.evidenceLink", packet.generatedAt, findings)
  if (packet.evidenceLink && isPlaceholderEvidenceReference(packet.evidenceLink)) {
    findings.push("productMetricsReadinessPacket.evidenceLink: placeholder evidence links are not allowed.")
  } else if (!isEvidenceLikeReference(packet.evidenceLink)) {
    findings.push("productMetricsReadinessPacket.evidenceLink: attempted readiness evidence must be a URL or repo artifact path.")
  } else {
    validateExistingEvidenceReference(packet.evidenceLink, "productMetricsReadinessPacket.evidenceLink", findings)
    if (!hasProductMetricsReadinessContext(packet.evidenceLink)) {
      findings.push("productMetricsReadinessPacket.evidenceLink: attempted readiness evidence link must identify product metrics readiness evidence and target release context.")
    }
  }

  const readinessDecision = evaluateAstraProductMetricsReadiness(packet.evidence)
  if (!readinessDecision.ready) {
    findings.push("productMetricsReadinessPacket: attempted product metrics readiness evidence must satisfy evaluateAstraProductMetricsReadiness() before it can remain in the final evidence packet.")
    for (const finding of readinessDecision.findings) {
      findings.push(`productMetricsReadinessPacket ${finding.message}`)
    }
  }
}

function validateProductMetricsReadinessExportEvidenceDistinct(
  productionMetricsExportPacket: ProductionMetricsExportPacket,
  productMetricsReadinessPacket: ProductMetricsReadinessPacket,
  findings: string[],
): void {
  if (productionMetricsExportPacket.rows.length === 0 || !productMetricsReadinessPacketAttempted(productMetricsReadinessPacket)) {
    return
  }
  if (!isEvidenceLikeReference(productMetricsReadinessPacket.evidenceLink)) {
    return
  }

  const readinessEvidenceIdentity = evidenceReferenceDuplicateIdentity(productMetricsReadinessPacket.evidenceLink)
  for (const row of productionMetricsExportPacket.rows) {
    for (const field of ["evidenceLink", "privacyReviewLink"] as const) {
      if (isEvidenceLikeReference(row[field]) && evidenceReferenceDuplicateIdentity(row[field]) === readinessEvidenceIdentity) {
        findings.push(`productMetricsReadinessPacket.evidenceLink: readiness evidence must be distinct from productionMetricsExportPacket.rows.${row.category}.${field}.`)
      }
    }
  }
}

function validateProductionMetricsExportPacketPreclaimRows(packet: ProductionMetricsExportPacket, findings: string[]): void {
  const expectedCategories = new Set<string>(ASTRA_PRODUCTION_METRIC_EXPORT_REQUIREMENTS.map((requirement) => requirement.category))
  const seenCategories = new Set<string>()

  for (const row of packet.rows) {
    const normalizedCategory = row.category.trim()
    const categoryIdentity = normalizedCategory.toLowerCase()
    const canonicalCategory = ASTRA_PRODUCTION_METRIC_EXPORT_REQUIREMENTS.find(
      (requirement) => requirement.category.toLowerCase() === categoryIdentity,
    )?.category
    if (normalizedCategory !== row.category || (canonicalCategory !== undefined && canonicalCategory !== row.category)) {
      findings.push(`productionMetricsExportPacket.rows.${row.category}: category must use canonical casing without surrounding whitespace.`)
    }
    if (canonicalCategory === undefined || !expectedCategories.has(canonicalCategory)) {
      findings.push(`productionMetricsExportPacket.rows.${row.category}: untracked production metrics export category.`)
    }
    if (seenCategories.has(categoryIdentity)) {
      findings.push(`productionMetricsExportPacket.rows.${row.category}: duplicate production metrics export row.`)
    }
    seenCategories.add(categoryIdentity)
    validateEvidenceDateNotAfterPacketGeneratedAt(row.ownerDate, `productionMetricsExportPacket.rows.${row.category}.ownerDate`, packet.generatedAt, findings)
    validateEvidenceTimestampNotAfterPacketGeneratedAt(row.exportedAt, `productionMetricsExportPacket.rows.${row.category}.exportedAt`, packet.generatedAt, findings)

    for (const field of ["evidenceLink", "privacyReviewLink"] as const) {
      validateEvidenceDateNotAfterPacketGeneratedAt(row[field], `productionMetricsExportPacket.rows.${row.category}.${field}`, packet.generatedAt, findings)
      if (row[field] && isPlaceholderEvidenceReference(row[field])) {
        findings.push(`productionMetricsExportPacket.rows.${row.category}.${field}: placeholder evidence links are not allowed.`)
      } else {
        validateExistingEvidenceReference(row[field], `productionMetricsExportPacket.rows.${row.category}.${field}`, findings)
      }
    }
    for (const field of ["cohortDefinition", "dashboardOrQuerySource"] as const) {
      if (row[field] && isWeakContextEvidenceReference(row[field])) {
        findings.push(`productionMetricsExportPacket.rows.${row.category}.${field}: real cohort/source evidence is required.`)
      }
    }
    if (row.exportId && !isStableExportIdentityReference(row.exportId)) {
      findings.push(`productionMetricsExportPacket.rows.${row.category}.exportId: stable non-weak export identity is required.`)
    }
    if (row.queryVersion && !isStableQueryVersionReference(row.queryVersion)) {
      findings.push(`productionMetricsExportPacket.rows.${row.category}.queryVersion: stable non-weak query version is required.`)
    }
    if (row.exportDigest && isWeakDigestReference(row.exportDigest)) {
      findings.push(`productionMetricsExportPacket.rows.${row.category}.exportDigest: stable non-weak digest/checksum is required.`)
    }
  }

  if (packet.rows.length > 0 || packetLabelIndicatesAttemptedEvidence(packet.label)) {
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

function manualQaChecklistDataLines(markdown: string): Array<{ section: number; line: string }> {
  const dataLines: Array<{ section: number; line: string }> = []
  let activeFenceMarker: string | null = null
  let activeSection: number | null = null
  let activeHtmlComment = false

  for (const line of markdown.split("\n")) {
    const trimmedLine = line.trim()
    if (activeHtmlComment) {
      if (trimmedLine.includes("-->")) activeHtmlComment = false
      continue
    }
    if (trimmedLine.startsWith("<!--")) {
      if (!trimmedLine.includes("-->")) activeHtmlComment = true
      continue
    }
    const fenceMatch = /^(?<marker>`{3,}|~{3,})/.exec(trimmedLine)
    if (fenceMatch?.groups?.marker) {
      const marker = fenceMatch.groups.marker
      if (activeFenceMarker === null) {
        activeFenceMarker = marker
        continue
      }
      if (marker[0] === activeFenceMarker[0] && marker.length >= activeFenceMarker.length) {
        activeFenceMarker = null
      }
      continue
    }
    if (activeFenceMarker !== null || trimmedLine.startsWith(">") || /^(?: {4,}|\t)/.test(line)) {
      continue
    }

    const sectionMatch = /^## Section (?<section>\d+)\b/.exec(trimmedLine)
    if (sectionMatch?.groups?.section) {
      activeSection = Number(sectionMatch.groups.section)
      continue
    }

    if (activeSection !== null && line.startsWith("| ") && !line.startsWith("| QA row ") && !line.startsWith("|---")) {
      dataLines.push({ section: activeSection, line })
    }
  }

  return dataLines
}

function parseManualQaChecklistRows(markdown: string, findings: string[]): ManualQaChecklistRow[] {
  return manualQaChecklistDataLines(markdown)
    .map(({ section, line }) => {
      const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim())
      if (cells.length !== 7) {
        findings.push(`${MANUAL_QA_CHECKLIST_PATH} Section ${section}: expected 7 table cells, got ${cells.length}.`)
      }
      const [qaRow = "", , , ownerDate = "", environment = "", evidenceLink = "", verdict = ""] = cells
      return { section, qaRow, ownerDate, environment, evidenceLink, verdict }
    })
}

function validateManualQaRows(rows: ManualQaChecklistRow[], findings: string[]): void {
  if (rows.length === 0) {
    findings.push(`${MANUAL_QA_CHECKLIST_PATH}: expected at least one QA row.`)
  }

  const expectedRowsByIdentity = new Map<string, { section: number; qaRow: string }>(
    ASTRA_MACRO_MANUAL_QA_REQUIREMENTS.flatMap((requirement) =>
      requirement.qaRows.map((qaRow) => [`${requirement.section}\u0000${qaRow.trim().toLowerCase()}`, { section: requirement.section, qaRow }] as const),
    ),
  )
  const seenRows = new Set<string>()

  for (const row of rows) {
    const normalizedQaRow = row.qaRow.trim()
    const rowIdentity = `${row.section}\u0000${normalizedQaRow.toLowerCase()}`
    const canonicalRow = expectedRowsByIdentity.get(rowIdentity)
    if (normalizedQaRow !== row.qaRow || (canonicalRow !== undefined && canonicalRow.qaRow !== row.qaRow)) {
      findings.push(`Section ${row.section} / ${row.qaRow}: manual QA row text must use canonical casing without surrounding whitespace.`)
    }
    if (!canonicalRow) {
      findings.push(`Section ${row.section} / ${row.qaRow}: untracked manual QA row.`)
    }
    if (seenRows.has(rowIdentity)) {
      findings.push(`Section ${row.section} / ${row.qaRow}: duplicate manual QA row.`)
    }
    seenRows.add(rowIdentity)

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
    } else {
      validateEvidenceDateNotAfterDatedArtifactPath(row.ownerDate, `Section ${row.section} / ${row.qaRow} owner/date`, MANUAL_QA_CHECKLIST_PATH, findings)
      if (!hasOwnerIdentityWithIsoDate(row.ownerDate)) {
        findings.push(`Section ${row.section} / ${row.qaRow}: non-not-run row owner/date must identify a real owner and include a YYYY-MM-DD date.`)
      }
    }
    if (!row.environment) {
      findings.push(`Section ${row.section} / ${row.qaRow}: non-not-run row requires environment.`)
    } else if (isWeakContextEvidenceReference(row.environment) || !isSpecificManualQaEnvironment(row.environment, row.section, row.qaRow)) {
      findings.push(`Section ${row.section} / ${row.qaRow}: non-not-run row requires real browser, OS, build/runtime, and row-specific QA context.`)
    }
    if (!row.evidenceLink) {
      findings.push(`Section ${row.section} / ${row.qaRow}: non-not-run row requires evidence link.`)
    } else {
      validateEvidenceDateNotAfterDatedArtifactPath(row.evidenceLink, `Section ${row.section} / ${row.qaRow} evidence link`, MANUAL_QA_CHECKLIST_PATH, findings)
      if (isPlaceholderEvidenceReference(row.evidenceLink)) {
        findings.push(`Section ${row.section} / ${row.qaRow}: non-not-run row uses placeholder evidence link.`)
      } else if (!isEvidenceLikeReference(row.evidenceLink)) {
        findings.push(`Section ${row.section} / ${row.qaRow}: non-not-run row evidence link must be a URL or repo artifact path.`)
      } else {
        validateExistingEvidenceReference(row.evidenceLink, `Section ${row.section} / ${row.qaRow} evidence link`, findings)
      }
    }
  }

  for (const requirement of ASTRA_MACRO_MANUAL_QA_REQUIREMENTS) {
    for (const qaRow of requirement.qaRows) {
      const rowKey = `${requirement.section}\u0000${qaRow.trim().toLowerCase()}`
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

function renderedMarkdownLineText(line: string): string {
  if (/^\s{0,3}\[[^\]]+\]:\s+\S+/.test(line)) {
    return ""
  }

  return line
    .replace(/!\[([^\]]*)\]\((?:\\.|[^\\)])*\)/g, "$1")
    .replace(/\[([^\]]+)\]\((?:\\.|[^\\)])*\)/g, "$1")
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1")
}

function visibleMarkdownText(markdown: string): string {
  const visibleLines: string[] = []
  let activeFenceMarker: string | null = null
  let activeHtmlComment = false

  for (const line of markdown.split("\n")) {
    const trimmedLine = line.trim()
    if (activeHtmlComment) {
      if (trimmedLine.includes("-->")) activeHtmlComment = false
      continue
    }
    if (trimmedLine.startsWith("<!--")) {
      if (!trimmedLine.includes("-->")) activeHtmlComment = true
      continue
    }
    const fenceMatch = /^(?<marker>`{3,}|~{3,})/.exec(trimmedLine)
    if (fenceMatch?.groups?.marker) {
      const marker = fenceMatch.groups.marker
      if (activeFenceMarker === null) {
        activeFenceMarker = marker
        continue
      }
      if (marker[0] === activeFenceMarker[0] && marker.length >= activeFenceMarker.length) {
        activeFenceMarker = null
      }
      continue
    }
    if (activeFenceMarker !== null || trimmedLine.startsWith(">") || /^(?: {4,}|\t)/.test(line)) {
      continue
    }
    const renderedLine = renderedMarkdownLineText(line)
    if (renderedLine.trim().length > 0) {
      visibleLines.push(renderedLine)
    }
  }

  return visibleLines.join("\n")
}

function validateFinalEvidenceIntakeDoc(markdown: string, findings: string[]): void {
  validateDatedMarkdownTitle(markdown, FINAL_EVIDENCE_INTAKE_PATH, findings)
  const visibleText = visibleMarkdownText(markdown)
  for (const key of FINAL_COMPLETION_EVIDENCE_KEYS) {
    if (!visibleText.includes(`\`${key}\``)) {
      findings.push(`${FINAL_EVIDENCE_INTAKE_PATH}: missing final evidence field \`${key}\`.`)
    }
  }

  for (const term of REQUIRED_EVIDENCE_INTAKE_TERMS) {
    if (!visibleText.includes(term)) {
      findings.push(`${FINAL_EVIDENCE_INTAKE_PATH}: missing required intake term \`${term}\`.`)
    }
  }
}

async function main(): Promise<void> {
  const findings: string[] = []
  const artifactText = await readFile(repoPath(FINAL_COMPLETION_EVIDENCE_PATH), "utf8")
  const gateText = await readFile(repoPath(FINAL_COMPLETION_GATE_PATH), "utf8")
  const finalEvidenceIntakeText = await readFile(repoPath(FINAL_EVIDENCE_INTAKE_PATH), "utf8")
  const checklistText = await readFile(repoPath(MANUAL_QA_CHECKLIST_PATH), "utf8")
  const operationalCompletionPacketText = await readFile(repoPath(OPERATIONAL_COMPLETION_PACKET_PATH), "utf8")
  const ciArtifactPacketText = await readFile(repoPath(CI_ARTIFACT_PACKET_PATH), "utf8")
  const ownerReleaseApprovalPacketText = await readFile(repoPath(OWNER_RELEASE_APPROVAL_PACKET_PATH), "utf8")
  const launchArtifactPacketText = await readFile(repoPath(LAUNCH_ARTIFACT_PACKET_PATH), "utf8")
  const aiQualityHumanScoredPacketText = await readFile(repoPath(AI_QUALITY_HUMAN_SCORED_PACKET_PATH), "utf8")
  const productionMetricsExportPacketText = await readFile(repoPath(PRODUCTION_METRICS_EXPORT_PACKET_PATH), "utf8")
  const productMetricsReadinessPacketText = await readFile(repoPath(PRODUCT_METRICS_READINESS_PACKET_PATH), "utf8")

  const parsedArtifact = parseJsonEvidence(artifactText, FINAL_COMPLETION_EVIDENCE_PATH, findings)
  const parsedOperationalCompletionPacket = parseJsonEvidence(operationalCompletionPacketText, OPERATIONAL_COMPLETION_PACKET_PATH, findings)
  const parsedCiArtifactPacket = parseJsonEvidence(ciArtifactPacketText, CI_ARTIFACT_PACKET_PATH, findings)
  const parsedOwnerReleaseApprovalPacket = parseJsonEvidence(ownerReleaseApprovalPacketText, OWNER_RELEASE_APPROVAL_PACKET_PATH, findings)
  const parsedLaunchArtifactPacket = parseJsonEvidence(launchArtifactPacketText, LAUNCH_ARTIFACT_PACKET_PATH, findings)
  const parsedAiQualityHumanScoredPacket = parseJsonEvidence(aiQualityHumanScoredPacketText, AI_QUALITY_HUMAN_SCORED_PACKET_PATH, findings)
  const parsedProductionMetricsExportPacket = parseJsonEvidence(productionMetricsExportPacketText, PRODUCTION_METRICS_EXPORT_PACKET_PATH, findings)
  const parsedProductMetricsReadinessPacket = parseJsonEvidence(productMetricsReadinessPacketText, PRODUCT_METRICS_READINESS_PACKET_PATH, findings)

  const artifact = validateEvidenceArtifact(parsedArtifact, findings)
  const operationalCompletionPacket = validateOperationalEvidenceCompletionPacket(parsedOperationalCompletionPacket, findings)
  const ciArtifactPacket = validateCiArtifactPacket(parsedCiArtifactPacket, findings)
  const ownerReleaseApprovalPacket = validateOwnerReleaseApprovalPacket(parsedOwnerReleaseApprovalPacket, findings)
  const launchArtifactPacket = validateLaunchArtifactPacket(parsedLaunchArtifactPacket, findings)
  const aiQualityHumanScoredPacket = validateAiQualityHumanScoredPacket(parsedAiQualityHumanScoredPacket, findings)
  const productionMetricsExportPacket = validateProductionMetricsExportPacket(parsedProductionMetricsExportPacket, findings)
  const productMetricsReadinessPacket = validateProductMetricsReadinessPacket(parsedProductMetricsReadinessPacket, findings)
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
  if (productMetricsReadinessPacket) {
    validateProductMetricsReadinessPacketPreclaim(productMetricsReadinessPacket, findings)
  }
  if (productionMetricsExportPacket && productMetricsReadinessPacket) {
    validateProductMetricsReadinessExportEvidenceDistinct(productionMetricsExportPacket, productMetricsReadinessPacket, findings)
  }
  validateCrossPacketTargetCommitConsistency(ciArtifactPacket, ownerReleaseApprovalPacket, findings)
  validateDatedMarkdownTitle(checklistText, MANUAL_QA_CHECKLIST_PATH, findings)
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
      if (!productMetricsReadinessPacket) {
        findings.push("artifact.evidence.productionMetricsExportAttached: cannot be true without a valid product metrics readiness packet.")
      } else {
        const readinessDecision = evaluateAstraProductMetricsReadiness(productMetricsReadinessPacket.evidence)
        if (!readinessDecision.ready) {
          findings.push("artifact.evidence.productionMetricsExportAttached: cannot be true until evaluateAstraProductMetricsReadiness() accepts the product metrics readiness packet.")
          for (const finding of readinessDecision.findings) {
            findings.push(`productMetricsReadinessPacket ${finding.message}`)
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
    const valid = findings.length === 0
    console.log(`Macro final completion check: valid=${valid ? "yes" : "no"}`)
    console.log(`Complete: ${valid && decision.complete ? "yes" : "no"}`)
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
