import { evidenceReferenceDuplicateIdentity, isEvidenceLikeReference } from "./evidence-reference"

export type AstraMetricQuestionId =
  | "where_users_drop_off"
  | "which_entry_used_most"
  | "which_errors_most_common"
  | "whether_users_save_content"
  | "whether_saved_users_review"
  | "whether_membership_value_seen"

export type AstraMetricCategoryId = "activation" | "understanding" | "learning" | "membership"

export type AstraMetricId =
  | "extension_installed"
  | "onboarding_started"
  | "onboarding_completed"
  | "signed_in"
  | "sample_started"
  | "first_content_understood"
  | "first_value_seen"
  | "first_item_saved"
  | "first_review_opened"
  | "first_review_completed"
  | "content_understanding_started"
  | "first_result_latency"
  | "completion_latency"
  | "failure_count"
  | "retry_count"
  | "user_stopped"
  | "deeper_explanation_opened"
  | "quality_speed_preference_switched"
  | "saved_words"
  | "saved_sentences"
  | "cards_due"
  | "cards_reviewed"
  | "review_completion_rate"
  | "return_to_source_clicks"
  | "weekly_active_learners"
  | "saved_content_by_source_type"
  | "paywall_viewed"
  | "conversion_event"
  | "trial_started"
  | "pro_value_seen"
  | "membership_activated"
  | "renewal_risk_signals"
  | "cancellation_reason_submitted"

export type AstraMetricEthicsRuleId =
  | "no_sensitive_raw_text"
  | "events_over_content"
  | "privacy_mode_reduces_telemetry"
  | "clear_user_data_control"

export type AstraProductionMetricExportFindingCode =
  | "missing_category"
  | "duplicate_category"
  | "unknown_category"
  | "duplicate_export_id"
  | "duplicate_export_digest"
  | "duplicate_evidence_link"
  | "duplicate_privacy_review_link"
  | "duplicate_evidence_role_link"
  | "missing_date_range"
  | "invalid_date_range"
  | "missing_cohort_definition"
  | "invalid_cohort_definition"
  | "missing_dashboard_or_query_source"
  | "invalid_dashboard_or_query_source"
  | "missing_export_id"
  | "invalid_export_id"
  | "missing_exported_at"
  | "invalid_exported_at"
  | "missing_export_digest"
  | "invalid_export_digest"
  | "missing_query_version"
  | "invalid_query_version"
  | "missing_metric_ids"
  | "duplicate_metric_id"
  | "unknown_metric_id"
  | "mismatched_metric_category"
  | "missing_evidence_link"
  | "invalid_evidence_link"
  | "missing_owner"
  | "invalid_owner_date"
  | "missing_privacy_review"
  | "invalid_privacy_review_link"
  | "mismatched_category_evidence"
  | "inconsistent_date_range"
  | "inconsistent_cohort_definition"

export type AstraProductMetricsReadinessCode =
  | "questions_answered"
  | "activation_metrics_covered"
  | "understanding_metrics_covered"
  | "learning_metrics_covered"
  | "membership_metrics_covered"
  | "no_sensitive_raw_text"
  | "events_over_content"
  | "privacy_mode_reduces_detail"
  | "user_data_controls_clear"

export interface AstraMetricQuestionDefinition {
  id: AstraMetricQuestionId
  question: string
  primaryCategory: AstraMetricCategoryId
}

export interface AstraProductMetricDefinition {
  id: AstraMetricId
  category: AstraMetricCategoryId
  label: string
  purpose: string
  contentPolicy: string
}

export interface AstraMetricEthicsRule {
  id: AstraMetricEthicsRuleId
  rule: string
  implementationBoundary: string
}

export interface AstraProductionMetricExportRequirement {
  category: AstraMetricCategoryId
  requiredEvidence: string
}

export interface AstraProductionMetricExportEvidenceRow {
  category: AstraMetricCategoryId
  dateRange: string
  cohortDefinition: string
  dashboardOrQuerySource: string
  exportId: string
  exportedAt: string
  exportDigest: string
  queryVersion: string
  metricIds: AstraMetricId[]
  evidenceLink: string
  ownerDate: string
  privacyReviewLink: string
}

export interface AstraProductionMetricExportFinding {
  code: AstraProductionMetricExportFindingCode
  category: AstraMetricCategoryId | string
  message: string
  nextStep: string
}

export interface AstraProductionMetricExportDecision {
  acceptable: boolean
  findings: AstraProductionMetricExportFinding[]
}

export interface AstraProductMetricsReadinessEvidence {
  productQuestionsHaveMetricCoverage: boolean
  activationMetricsCovered: boolean
  understandingMetricsCovered: boolean
  learningMetricsCovered: boolean
  membershipMetricsCovered: boolean
  telemetryAvoidsSensitiveRawText: boolean
  telemetryPrefersEventsOverContent: boolean
  privacyModeReducesTelemetryDetail: boolean
  userDataControlsAreClear: boolean
}

export interface AstraProductMetricsReadinessFinding {
  code: AstraProductMetricsReadinessCode
  severity: "block" | "warn"
  message: string
  nextStep: string
}

export interface AstraProductMetricsReadinessDecision {
  ready: boolean
  blockers: AstraProductMetricsReadinessFinding[]
  warnings: AstraProductMetricsReadinessFinding[]
  findings: AstraProductMetricsReadinessFinding[]
}

export const ASTRA_METRIC_QUESTIONS: AstraMetricQuestionDefinition[] = [
  { id: "where_users_drop_off", question: "Where do users drop off?", primaryCategory: "activation" },
  { id: "which_entry_used_most", question: "Which product entry is used most often?", primaryCategory: "understanding" },
  { id: "which_errors_most_common", question: "Which error categories happen most often?", primaryCategory: "understanding" },
  { id: "whether_users_save_content", question: "Do users actually save content?", primaryCategory: "learning" },
  { id: "whether_saved_users_review", question: "Do users come back to review after saving?", primaryCategory: "learning" },
  { id: "whether_membership_value_seen", question: "Is membership value being seen?", primaryCategory: "membership" },
]

export const ASTRA_PRODUCT_METRICS: AstraProductMetricDefinition[] = [
  { id: "extension_installed", category: "activation", label: "Extension installed", purpose: "Start the install-to-first-value clock.", contentPolicy: "Event/source only; no user input." },
  { id: "onboarding_started", category: "activation", label: "Onboarding started", purpose: "Start of first-success setup funnel.", contentPolicy: "Event/source/variant only; no user input." },
  { id: "onboarding_completed", category: "activation", label: "Onboarding completed", purpose: "First setup completion.", contentPolicy: "Event only; profile choices are stored as settings, not raw telemetry." },
  { id: "signed_in", category: "activation", label: "Signed in", purpose: "Account continuity activation.", contentPolicy: "Account/session category only; no raw email in analytics." },
  { id: "sample_started", category: "activation", label: "Sample started", purpose: "User entered the sample first-value path.", contentPolicy: "Sample id/source type only; no page text." },
  { id: "first_content_understood", category: "activation", label: "First content understood", purpose: "First successful understanding result.", contentPolicy: "Source type and coarse latency only; no page text." },
  { id: "first_value_seen", category: "activation", label: "First value seen", purpose: "First user-visible value moment for activation P50.", contentPolicy: "Event/source type only; no page text." },
  { id: "first_item_saved", category: "activation", label: "First item saved", purpose: "First save into learning loop.", contentPolicy: "Asset type only; no saved text." },
  { id: "first_review_opened", category: "activation", label: "First review opened", purpose: "Review loop entry after saving.", contentPolicy: "Count/source type only." },
  { id: "first_review_completed", category: "activation", label: "First review completed", purpose: "First completed review loop.", contentPolicy: "Counts and duration bucket only." },
  { id: "content_understanding_started", category: "understanding", label: "Content understanding started", purpose: "Demand for reading/video/file/selection understanding.", contentPolicy: "Surface and source type only." },
  { id: "first_result_latency", category: "understanding", label: "First result latency", purpose: "Time to first useful output.", contentPolicy: "Latency bucket only." },
  { id: "completion_latency", category: "understanding", label: "Completion latency", purpose: "End-to-end task completion speed.", contentPolicy: "Latency bucket and task class only." },
  { id: "failure_count", category: "understanding", label: "Failure count", purpose: "Error volume by category.", contentPolicy: "Error category only; no request text." },
  { id: "retry_count", category: "understanding", label: "Retry count", purpose: "Recovery friction.", contentPolicy: "Retry count and category only." },
  { id: "user_stopped", category: "understanding", label: "User stopped", purpose: "User abandoned or stopped an understanding task.", contentPolicy: "Task/surface category only." },
  { id: "deeper_explanation_opened", category: "understanding", label: "Opened deeper explanation", purpose: "Need for richer learning detail.", contentPolicy: "Action event only." },
  { id: "quality_speed_preference_switched", category: "understanding", label: "Quality/speed preference switched", purpose: "Learner preference signal for routing UX.", contentPolicy: "Preference category only." },
  { id: "saved_words", category: "learning", label: "Saved words", purpose: "Vocabulary asset creation.", contentPolicy: "Count only; no word text in telemetry." },
  { id: "saved_sentences", category: "learning", label: "Saved sentences", purpose: "Sentence asset creation.", contentPolicy: "Count only; no sentence text in telemetry." },
  { id: "cards_due", category: "learning", label: "Cards due", purpose: "Review queue readiness.", contentPolicy: "Count only." },
  { id: "cards_reviewed", category: "learning", label: "Cards reviewed", purpose: "Review effort.", contentPolicy: "Count and feedback breakdown only." },
  { id: "review_completion_rate", category: "learning", label: "Review completion rate", purpose: "Whether short sessions finish.", contentPolicy: "Aggregate rate only." },
  { id: "return_to_source_clicks", category: "learning", label: "Return-to-source clicks", purpose: "Source-backed learning value.", contentPolicy: "Source type/hostname only; no full URL paths." },
  { id: "weekly_active_learners", category: "learning", label: "Weekly active learners", purpose: "Weekly learning habit.", contentPolicy: "Aggregate active count only." },
  { id: "saved_content_by_source_type", category: "learning", label: "Saved content by source type", purpose: "Which surfaces create learning assets.", contentPolicy: "Source type counts only." },
  { id: "paywall_viewed", category: "membership", label: "Paywall viewed", purpose: "Membership value surface exposure.", contentPolicy: "Trigger and plan only." },
  { id: "conversion_event", category: "membership", label: "Conversion event", purpose: "Purchase or upgrade intent without recording raw copy or checkout details.", contentPolicy: "Event category, trigger, and plan only." },
  { id: "trial_started", category: "membership", label: "Trial started", purpose: "Trial activation before paid conversion.", contentPolicy: "Plan/source category only." },
  { id: "pro_value_seen", category: "membership", label: "Pro value seen", purpose: "Whether paid value is visible and repeated.", contentPolicy: "Trigger/surface only." },
  { id: "membership_activated", category: "membership", label: "Membership activated", purpose: "Paid/trial activation.", contentPolicy: "Plan category only." },
  { id: "renewal_risk_signals", category: "membership", label: "Renewal risk signals", purpose: "Detect churn risk without content surveillance.", contentPolicy: "Aggregate low-usage/error/support categories only." },
  { id: "cancellation_reason_submitted", category: "membership", label: "Cancellation reason submitted", purpose: "Learn why users cancel or refund.", contentPolicy: "Normalized reason/plan/source only." },
]

export const ASTRA_PRODUCTION_METRIC_EXPORT_REQUIREMENTS: AstraProductionMetricExportRequirement[] = [
  {
    category: "activation",
    requiredEvidence: "Activation export must show first-run/drop-off metrics for a date range and release cohort.",
  },
  {
    category: "understanding",
    requiredEvidence: "Understanding export must show usage, latency, failure/retry, and stop metrics for a date range and release cohort.",
  },
  {
    category: "learning",
    requiredEvidence: "Learning export must show saves, reviews, source-return, and active-learning metrics for a date range and release cohort.",
  },
  {
    category: "membership",
    requiredEvidence: "Membership export must show value exposure, trial/membership activation, renewal risk, and cancellation metrics for a date range and release cohort.",
  },
]

export const ASTRA_METRIC_ETHICS_RULES: AstraMetricEthicsRule[] = [
  {
    id: "no_sensitive_raw_text",
    rule: "Do not record sensitive original text unless an explicit, reviewed product policy requires it.",
    implementationBoundary: "Default telemetry excludes page text, selected text, transcript text, file text, prompt text, model output, saved snippet text, and full URL paths.",
  },
  {
    id: "events_over_content",
    rule: "Prefer events, counts, categories, and buckets over content.",
    implementationBoundary: "Use source type, task class, error category, latency bucket, and aggregate counts.",
  },
  {
    id: "privacy_mode_reduces_telemetry",
    rule: "Privacy Mode reduces telemetry detail.",
    implementationBoundary: "When Privacy Mode is enabled, prefer coarse source type, non-sensitive status, and local-only summaries where possible.",
  },
  {
    id: "clear_user_data_control",
    rule: "Users need clear data controls.",
    implementationBoundary: "Metrics surfaces must point to Privacy Mode, export/delete paths, reminder controls, and support-bundle previews where relevant.",
  },
]

export function getAstraProductMetricsByCategory(category: AstraMetricCategoryId): AstraProductMetricDefinition[] {
  return ASTRA_PRODUCT_METRICS.filter((metric) => metric.category === category)
}

function isBlank(value: string): boolean {
  return value.trim().length === 0
}

function isPlaceholderEvidenceReference(value: string): boolean {
  const normalizedValue = value.toLowerCase()
  return normalizedValue.includes("example")
    || normalizedValue.includes("placeholder")
    || normalizedValue.includes("todo")
    || /\b(?:mock|draft|tbd|pending|temp|temporary)\b/.test(normalizedValue)
    || /\b(?:(?:fake|dummy|latest|dev|local)[-_ ]?(?:proof|evidence|artifact|report)|(?<!provider[-_ ])sample[-_ ]?(?:proof|evidence|artifact|report)|(?:proof|evidence|artifact|report)[-_ ]?(?:sample|fake|dummy|latest|dev|local))\b/.test(normalizedValue)
}

function hasWeakEvidenceKeyword(value: string): boolean {
  return /\b(?:dummy|sample|fake|mock|draft|tbd|pending|temp|temporary|local|none|n\/a|na|latest|dev|test)\b/.test(value.trim().toLowerCase())
}

function isWeakContextEvidenceReference(value: string): boolean {
  const normalizedValue = value.trim().toLowerCase()
  return isPlaceholderEvidenceReference(normalizedValue) || hasWeakEvidenceKeyword(normalizedValue)
}

function isSpecificProductionMetricsCohort(value: string): boolean {
  if (value.trim() !== value || isWeakContextEvidenceReference(value)) return false
  const normalizedValue = value.toLowerCase()
  const namesCohortScope = /\b(?:cohort|segment|population|release|rc|production|rollout)\b/.test(normalizedValue)
  const hasAuditSpecificity = /\b(?:target|current commit|commit|sha|build|rc|release[-_ ]?(?:candidate|id|tag)|cohort[-_ ]?(?:id|v?\d)|segment[-_ ]?[a-z0-9]+|20\d{2}-\d{2}-\d{2}|v\d+(?:\.\d+){1,2})\b/.test(normalizedValue)
  return namesCohortScope && hasAuditSpecificity
}

function isSpecificProductionMetricsSource(value: string): boolean {
  if (value.trim() !== value || isWeakContextEvidenceReference(value)) return false
  const normalizedValue = value.toLowerCase()
  const namesMetricSource = /\b(?:warehouse|query|dashboard|analytics|export|looker|mode|metabase|bigquery|snowflake|redash)\b/.test(normalizedValue)
  const hasStableSourceDetail = isEvidenceLikeReference(value)
    || /(?:^|[^a-z0-9])(?:v\d+(?:\.\d+){0,2}|\d{4,}|20\d{2}-\d{2}-\d{2}|query[-_. ]?[a-z0-9]*\d|dashboard[-_. ]?[a-z0-9]*\d|export[-_. ]?[a-z0-9]*\d|metrics[-_. ]?[a-z0-9]*\d)\b/.test(normalizedValue)
  return namesMetricSource && hasStableSourceDetail
}

function hasProductionMetricCategoryContext(value: string, category: AstraMetricCategoryId): boolean {
  const candidates = [value]
  try {
    candidates.push(decodeURIComponent(value))
  } catch {
    // Malformed percent-encoding is rejected by evidence-reference validation where applicable.
  }
  const normalizedCandidates = candidates.map((candidate) => candidate
    .toLowerCase()
    .replace(/[_./:-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim())
  return normalizedCandidates.some((normalizedValue) => {
    if (new RegExp(`\\b${category}\\b`).test(normalizedValue)) return true
    switch (category) {
      case "activation":
        return /\b(?:onboarding|first value|first run|drop off|funnel|install|installed|signed in)\b/.test(normalizedValue)
      case "understanding":
        return /\b(?:understanding|latency|failure|retry|stopped|deeper explanation|quality speed)\b/.test(normalizedValue)
      case "learning":
        return /\b(?:learning|saved|review|cards|source return|weekly active learner|srs)\b/.test(normalizedValue)
      case "membership":
        return /\b(?:membership|paywall|conversion|trial|pro value|renewal|cancellation)\b/.test(normalizedValue)
    }
  })
}

function evidenceIdentityValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
      .replace(/^(?:(?:sha(?:256|384|512)?|checksum|digest|version|build|artifact|export|query|id)[:=/ -]+)+/, "")
}

function isWeakDigestReference(value: string): boolean {
  const normalizedValue = value.trim().toLowerCase()
  const identityValue = evidenceIdentityValue(value).replace(/[^a-z0-9]/g, "")

  return identityValue.length < 12
    || /^0+$/.test(identityValue)
    || /^([a-z0-9])\1+$/.test(identityValue)
    || hasWeakEvidenceKeyword(normalizedValue)
}

function isStableDigestReference(value: string): boolean {
  if (value.trim() !== value || isWeakDigestReference(value)) return false
  const normalizedValue = value.trim().toLowerCase()
  const identityValue = evidenceIdentityValue(value)
  const compactValue = identityValue.replace(/[^a-f0-9]/g, "")
  const hasDigestPrefix = /^(?:sha(?:256|384|512)?|checksum|digest)[:=/ -]+/.test(normalizedValue)
  return hasDigestPrefix && compactValue === identityValue.replace(/[^a-z0-9]/g, "") && /^(?:[a-f0-9]{32}|[a-f0-9]{40}|[a-f0-9]{64}|[a-f0-9]{96}|[a-f0-9]{128})$/.test(compactValue)
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

  const identityValue = evidenceIdentityValue(value)
  const compactValue = identityValue.replace(/[^a-z0-9]/g, "")
  if (!hasNonWeakIdentityCore(identityValue)) return false
  return compactValue.length >= 12
    || isUuidReference(identityValue)
    || isPrefixedNumericIdentityReference(identityValue)
    || isDateStampedIdentityReference(identityValue)
}

function isStableQueryVersionReference(value: string): boolean {
  if (isStableExportIdentityReference(value)) return true
  const identityValue = evidenceIdentityValue(value)
  if (isWeakContextEvidenceReference(identityValue)) return false
  return /^v?\d+\.\d+\.\d+(?:[-+][a-z0-9.-]+)?$/i.test(identityValue)
    || (/^20\d{2}-\d{2}-\d{2}$/.test(identityValue) && includesIsoDate(identityValue))
}

function includesIsoDate(value: string): boolean {
  const match = /\b(20\d{2}-\d{2}-\d{2})\b/.exec(value)
  return match ? parseIsoDate(match[1]) !== null : false
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

function isIsoDateRange(value: string): boolean {
  if (value.trim() !== value) return false
  const [startText, endText] = value.split("..")
  if (!startText || !endText) return false
  const start = parseIsoDate(startText)
  const end = parseIsoDate(endText)
  return start !== null && end !== null && start <= end
}

function isIsoTimestamp(value: string): boolean {
  if (!/^20\d{2}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) || Number.isNaN(Date.parse(value))) {
    return false
  }
  return parseIsoDate(value.slice(0, 10)) !== null
}

export function evaluateAstraProductionMetricsExportPacket(
  rows: readonly AstraProductionMetricExportEvidenceRow[],
): AstraProductionMetricExportDecision {
  const findings: AstraProductionMetricExportFinding[] = []
  const rowsByCategory = new Map<AstraMetricCategoryId, AstraProductionMetricExportEvidenceRow>()
  const expectedCategories = new Set(ASTRA_PRODUCTION_METRIC_EXPORT_REQUIREMENTS.map((requirement) => requirement.category))
  const metricByIdentity = new Map(ASTRA_PRODUCT_METRICS.map((metric) => [metric.id.toLowerCase(), metric]))
  const seenExportIds = new Map<string, AstraMetricCategoryId>()
  const seenExportDigests = new Map<string, AstraMetricCategoryId>()
  const seenEvidenceLinks = new Map<string, AstraMetricCategoryId>()
  const seenPrivacyReviewLinks = new Map<string, AstraMetricCategoryId>()

  for (const row of rows) {
    const normalizedCategory = row.category.trim()
    const categoryIdentity = normalizedCategory.toLowerCase()
    const canonicalCategory = ASTRA_PRODUCTION_METRIC_EXPORT_REQUIREMENTS.find((requirement) => requirement.category.toLowerCase() === categoryIdentity)?.category
    if (normalizedCategory !== row.category || (canonicalCategory !== undefined && canonicalCategory !== row.category)) {
      findings.push({
        code: "unknown_category",
        category: row.category,
        message: `${row.category} must use canonical production metric export category casing without surrounding whitespace.`,
        nextStep: "Use activation, understanding, learning, or membership exactly as defined.",
      })
    }
    if (canonicalCategory === undefined || !expectedCategories.has(canonicalCategory)) {
      findings.push({
        code: "unknown_category",
        category: row.category,
        message: `${row.category} is not a tracked production metric export category.`,
        nextStep: "Use activation, understanding, learning, or membership.",
      })
      continue
    }
    if (rowsByCategory.has(canonicalCategory)) {
      findings.push({
        code: "duplicate_category",
        category: row.category,
        message: `${row.category} production metric export has duplicate evidence rows.`,
        nextStep: "Keep one production metric export evidence row per category.",
      })
      continue
    }
    const exportId = row.exportId.trim()
    const exportIdIdentity = evidenceIdentityValue(row.exportId)
    if (exportId.length > 0) {
      const existingCategory = seenExportIds.get(exportIdIdentity)
      if (existingCategory && existingCategory !== canonicalCategory) {
        findings.push({
          code: "duplicate_export_id",
          category: canonicalCategory,
          message: `${canonicalCategory} production metric export reuses export id ${exportId}.`,
          nextStep: "Attach one unique export id per category-specific dashboard/query export.",
        })
      }
      seenExportIds.set(exportIdIdentity, canonicalCategory)
    }

    const exportDigest = row.exportDigest.trim()
    const exportDigestIdentity = evidenceIdentityValue(row.exportDigest).replace(/[^a-z0-9]/g, "")
    if (exportDigest.length > 0) {
      const existingCategory = seenExportDigests.get(exportDigestIdentity)
      if (existingCategory && existingCategory !== canonicalCategory) {
        findings.push({
          code: "duplicate_export_digest",
          category: canonicalCategory,
          message: `${canonicalCategory} production metric export reuses export digest ${exportDigest}.`,
          nextStep: "Attach one unique checksum per category-specific dashboard/query export artifact.",
        })
      }
      seenExportDigests.set(exportDigestIdentity, canonicalCategory)
    }

    const evidenceLink = row.evidenceLink.trim()
    const evidenceLinkIdentity = evidenceReferenceDuplicateIdentity(row.evidenceLink)
    if (evidenceLink.length > 0) {
      const existingCategory = seenEvidenceLinks.get(evidenceLinkIdentity)
      if (existingCategory && existingCategory !== canonicalCategory) {
        findings.push({
          code: "duplicate_evidence_link",
          category: canonicalCategory,
          message: `${canonicalCategory} production metric export reuses evidence link ${evidenceLink}.`,
          nextStep: "Attach category-specific export evidence so Activation, Understanding, Learning, and Membership proof can be audited independently.",
        })
      }
      const existingPrivacyCategory = seenPrivacyReviewLinks.get(evidenceLinkIdentity)
      if (existingPrivacyCategory) {
        findings.push({
          code: "duplicate_evidence_role_link",
          category: canonicalCategory,
          message: `${canonicalCategory} production metric export reuses privacy-review evidence as export evidence ${evidenceLink}.`,
          nextStep: "Attach distinct export evidence and privacy-review evidence so metric values and privacy boundaries can be audited independently.",
        })
      }
      seenEvidenceLinks.set(evidenceLinkIdentity, canonicalCategory)
    }

    const privacyReviewLink = row.privacyReviewLink.trim()
    const privacyReviewLinkIdentity = evidenceReferenceDuplicateIdentity(row.privacyReviewLink)
    if (privacyReviewLink.length > 0) {
      const existingCategory = seenPrivacyReviewLinks.get(privacyReviewLinkIdentity)
      if (existingCategory && existingCategory !== canonicalCategory) {
        findings.push({
          code: "duplicate_privacy_review_link",
          category: canonicalCategory,
          message: `${canonicalCategory} production metric export reuses privacy review link ${privacyReviewLink}.`,
          nextStep: "Attach category-specific privacy review evidence so each production metrics export can be audited independently.",
        })
      }
      const existingEvidenceCategory = seenEvidenceLinks.get(privacyReviewLinkIdentity)
      if (existingEvidenceCategory) {
        findings.push({
          code: "duplicate_evidence_role_link",
          category: canonicalCategory,
          message: `${canonicalCategory} production metric export reuses export evidence as privacy review ${privacyReviewLink}.`,
          nextStep: "Attach distinct export evidence and privacy-review evidence so metric values and privacy boundaries can be audited independently.",
        })
      }
      seenPrivacyReviewLinks.set(privacyReviewLinkIdentity, canonicalCategory)
    }

    rowsByCategory.set(canonicalCategory, { ...row, category: canonicalCategory })
  }

  const dateRanges = new Set(Array.from(rowsByCategory.values()).map((row) => row.dateRange.trim()).filter((dateRange) => dateRange.length > 0))
  if (dateRanges.size > 1) {
    findings.push({
      code: "inconsistent_date_range",
      category: "all",
      message: "Production metric export categories must use the same date range.",
      nextStep: "Export Activation, Understanding, Learning, and Membership metrics for one shared release date range.",
    })
  }

  const cohortDefinitions = new Set(Array.from(rowsByCategory.values()).map((row) => row.cohortDefinition.trim()).filter((cohort) => cohort.length > 0))
  if (cohortDefinitions.size > 1) {
    findings.push({
      code: "inconsistent_cohort_definition",
      category: "all",
      message: "Production metric export categories must use the same cohort definition.",
      nextStep: "Export Activation, Understanding, Learning, and Membership metrics for one shared release cohort.",
    })
  }

  for (const requirement of ASTRA_PRODUCTION_METRIC_EXPORT_REQUIREMENTS) {
    const row = rowsByCategory.get(requirement.category)
    if (!row) {
      findings.push({
        code: "missing_category",
        category: requirement.category,
        message: `${requirement.category} production metric export is missing.`,
        nextStep: requirement.requiredEvidence,
      })
      continue
    }

    if (isBlank(row.dateRange)) {
      findings.push({ code: "missing_date_range", category: row.category, message: `${row.category} export is missing date range.`, nextStep: "Record the production/cohort export date range." })
    } else if (!isIsoDateRange(row.dateRange)) {
      findings.push({ code: "invalid_date_range", category: row.category, message: `${row.category} export date range must use YYYY-MM-DD..YYYY-MM-DD.`, nextStep: "Record an auditable ISO date range for the production/cohort export." })
    }
    if (isBlank(row.cohortDefinition)) {
      findings.push({ code: "missing_cohort_definition", category: row.category, message: `${row.category} export is missing cohort definition.`, nextStep: "Record the release cohort or query cohort definition." })
    } else if (!isSpecificProductionMetricsCohort(row.cohortDefinition)) {
      findings.push({ code: "invalid_cohort_definition", category: row.category, message: `${row.category} export cohort definition must identify the real release cohort with auditable scope.`, nextStep: "Record the real release cohort or query cohort definition with target, RC/build/commit/date, or equivalent stable cohort detail." })
    }
    if (isBlank(row.dashboardOrQuerySource)) {
      findings.push({ code: "missing_dashboard_or_query_source", category: row.category, message: `${row.category} export is missing dashboard or query source.`, nextStep: "Link or name the dashboard, warehouse query, or analytics export source." })
    } else if (!isSpecificProductionMetricsSource(row.dashboardOrQuerySource)) {
      findings.push({ code: "invalid_dashboard_or_query_source", category: row.category, message: `${row.category} export dashboard or query source must identify a real dashboard/query/export source.`, nextStep: "Link the real dashboard, warehouse query, or analytics export source with a stable source id, URL, version, or path." })
    } else if (!hasProductionMetricCategoryContext(row.dashboardOrQuerySource, row.category)) {
      findings.push({ code: "mismatched_category_evidence", category: row.category, message: `${row.category} export dashboard or query source must identify ${row.category} metrics evidence.`, nextStep: "Attach the category-specific dashboard, warehouse query, or analytics export source for this row." })
    }
    if (isBlank(row.exportId)) {
      findings.push({ code: "missing_export_id", category: row.category, message: `${row.category} export is missing export id.`, nextStep: "Record the dashboard/export/run id so the evidence can be traced." })
    } else if (row.exportId.trim() !== row.exportId || isPlaceholderEvidenceReference(row.exportId)) {
      findings.push({ code: "invalid_export_id", category: row.category, message: `${row.category} export id is placeholder evidence or not canonical.`, nextStep: "Record the real dashboard/export/run id without surrounding whitespace so the evidence can be traced." })
    } else if (!isStableExportIdentityReference(row.exportId)) {
      findings.push({ code: "invalid_export_id", category: row.category, message: `${row.category} export id must be a stable export identity.`, nextStep: "Record the real dashboard/export/run id so the evidence can be traced." })
    }
    if (isBlank(row.exportedAt)) {
      findings.push({ code: "missing_exported_at", category: row.category, message: `${row.category} export is missing exported-at timestamp.`, nextStep: "Record when the production/cohort export was generated." })
    } else if (!isIsoTimestamp(row.exportedAt)) {
      findings.push({ code: "invalid_exported_at", category: row.category, message: `${row.category} export exported-at value must be an ISO timestamp.`, nextStep: "Record the exported-at timestamp as an ISO date-time for the attached export artifact." })
    }
    if (isBlank(row.exportDigest)) {
      findings.push({ code: "missing_export_digest", category: row.category, message: `${row.category} export is missing digest/checksum.`, nextStep: "Record a digest or checksum for the attached dashboard/query export artifact." })
    } else if (!isStableDigestReference(row.exportDigest)) {
      findings.push({ code: "invalid_export_digest", category: row.category, message: `${row.category} export digest/checksum must be a canonical stable checksum value.`, nextStep: "Record a sha/checksum/digest-prefixed hex digest for the attached dashboard/query export artifact." })
    }
    if (isBlank(row.queryVersion)) {
      findings.push({ code: "missing_query_version", category: row.category, message: `${row.category} export is missing query version.`, nextStep: "Record the dashboard/query version used to generate the export." })
    } else if (row.queryVersion.trim() !== row.queryVersion || isPlaceholderEvidenceReference(row.queryVersion)) {
      findings.push({ code: "invalid_query_version", category: row.category, message: `${row.category} export query version is placeholder evidence or not canonical.`, nextStep: "Record the real dashboard/query version without surrounding whitespace used to generate the export." })
    } else if (!isStableQueryVersionReference(row.queryVersion)) {
      findings.push({ code: "invalid_query_version", category: row.category, message: `${row.category} export query version must be a stable query version.`, nextStep: "Record the real dashboard/query version used to generate the export." })
    }
    if (row.metricIds.length === 0) {
      findings.push({ code: "missing_metric_ids", category: row.category, message: `${row.category} export is missing metric ids.`, nextStep: "List the canonical metric ids included in the category export." })
    }
    const seenMetricIds = new Set<string>()
    let metricIdsStructurallyValid = row.metricIds.length > 0
    for (const metricId of row.metricIds) {
      const normalizedMetricId = metricId.trim()
      const metricIdIdentity = normalizedMetricId.toLowerCase()
      const metric = metricByIdentity.get(metricIdIdentity)
      if (metric && (normalizedMetricId !== metricId || metric.id !== metricId)) {
        metricIdsStructurallyValid = false
        findings.push({ code: "unknown_metric_id", category: row.category, message: `${row.category} export metric id ${metricId} must use canonical casing without surrounding whitespace.`, nextStep: "Use metric ids from ASTRA_PRODUCT_METRICS exactly as defined." })
      }
      if (seenMetricIds.has(metricIdIdentity)) {
        metricIdsStructurallyValid = false
        findings.push({ code: "duplicate_metric_id", category: row.category, message: `${row.category} export repeats metric id ${metricId}.`, nextStep: "List each canonical metric id at most once per category export." })
        continue
      }
      seenMetricIds.add(metricIdIdentity)
      if (!metric) {
        metricIdsStructurallyValid = false
        findings.push({ code: "unknown_metric_id", category: row.category, message: `${row.category} export includes unknown metric id ${metricId}.`, nextStep: "Use metric ids from ASTRA_PRODUCT_METRICS." })
      } else if (metric.category !== row.category) {
        metricIdsStructurallyValid = false
        findings.push({ code: "mismatched_metric_category", category: row.category, message: `${row.category} export includes ${metricId}, which belongs to ${metric.category}.`, nextStep: "Keep metric ids aligned to the row category." })
      }
    }
    if (metricIdsStructurallyValid) {
      const missingMetricIds = getAstraProductMetricsByCategory(row.category)
        .map((metric) => metric.id)
        .filter((metricId) => !seenMetricIds.has(metricId))
      if (missingMetricIds.length > 0) {
        findings.push({
          code: "missing_metric_ids",
          category: row.category,
          message: `${row.category} export is missing required metric ids: ${missingMetricIds.join(", ")}.`,
          nextStep: "List every canonical metric id for the category export so partial dashboards cannot satisfy production evidence.",
        })
      }
    }
    if (isBlank(row.evidenceLink)) {
      findings.push({ code: "missing_evidence_link", category: row.category, message: `${row.category} export is missing evidence link.`, nextStep: "Attach dashboard screenshot, analytics export, or query output evidence." })
    } else if (isPlaceholderEvidenceReference(row.evidenceLink)) {
      findings.push({ code: "missing_evidence_link", category: row.category, message: `${row.category} export evidence link is placeholder evidence.`, nextStep: "Attach the real dashboard screenshot, analytics export, or query output evidence." })
    } else if (!isEvidenceLikeReference(row.evidenceLink)) {
      findings.push({ code: "invalid_evidence_link", category: row.category, message: `${row.category} export evidence link must be a URL or repo artifact path.`, nextStep: "Attach dashboard screenshot, analytics export, or query output evidence as a URL or repo artifact path." })
    } else if (!hasProductionMetricCategoryContext(row.evidenceLink, row.category)) {
      findings.push({ code: "mismatched_category_evidence", category: row.category, message: `${row.category} export evidence link must identify ${row.category} metrics evidence.`, nextStep: "Attach category-specific dashboard screenshot, analytics export, or query output evidence for this row." })
    }
    if (isBlank(row.ownerDate)) {
      findings.push({ code: "missing_owner", category: row.category, message: `${row.category} export is missing owner/date.`, nextStep: "Record the metrics owner and export date." })
    } else if (!hasOwnerIdentityWithIsoDate(row.ownerDate)) {
      findings.push({ code: "invalid_owner_date", category: row.category, message: `${row.category} export owner/date must identify a real owner and include YYYY-MM-DD.`, nextStep: "Record the real metrics owner/date using YYYY-MM-DD." })
    }
    if (isBlank(row.privacyReviewLink)) {
      findings.push({ code: "missing_privacy_review", category: row.category, message: `${row.category} export is missing privacy review link.`, nextStep: "Attach privacy review showing production queries preserve metadata-only boundaries." })
    } else if (isPlaceholderEvidenceReference(row.privacyReviewLink)) {
      findings.push({ code: "missing_privacy_review", category: row.category, message: `${row.category} privacy review link is placeholder evidence.`, nextStep: "Attach the real privacy review showing production queries preserve metadata-only boundaries." })
    } else if (!isEvidenceLikeReference(row.privacyReviewLink)) {
      findings.push({ code: "invalid_privacy_review_link", category: row.category, message: `${row.category} privacy review link must be a URL or repo artifact path.`, nextStep: "Attach privacy review evidence as a URL or repo artifact path." })
    } else if (!hasProductionMetricCategoryContext(row.privacyReviewLink, row.category)) {
      findings.push({ code: "mismatched_category_evidence", category: row.category, message: `${row.category} privacy review link must identify ${row.category} metrics evidence.`, nextStep: "Attach category-specific privacy review evidence for this row." })
    }
  }

  return { acceptable: findings.length === 0, findings }
}

const READINESS_CHECKS: Array<{
  code: AstraProductMetricsReadinessCode
  evidenceKey: keyof AstraProductMetricsReadinessEvidence
  severity: "block" | "warn"
  message: string
  nextStep: string
}> = [
  { code: "questions_answered", evidenceKey: "productQuestionsHaveMetricCoverage", severity: "block", message: "Product metrics do not answer the core decision questions.", nextStep: "Map metrics to drop-off, entry usage, error categories, save behavior, review return, and membership value visibility." },
  { code: "activation_metrics_covered", evidenceKey: "activationMetricsCovered", severity: "block", message: "Activation metrics are incomplete.", nextStep: "Cover extension installed, onboarding started/completed, signed in, sample started, first value/understood, first saved, first review opened, and first review completed." },
  { code: "understanding_metrics_covered", evidenceKey: "understandingMetricsCovered", severity: "block", message: "Understanding metrics are incomplete.", nextStep: "Cover started, first-result latency, completion latency, failures, retries, stopped, deeper explanation, and quality/speed preference switches." },
  { code: "learning_metrics_covered", evidenceKey: "learningMetricsCovered", severity: "block", message: "Learning metrics are incomplete.", nextStep: "Cover saved words/sentences, due/reviewed cards, completion rate, return-to-source clicks, weekly active learners, and saved content by source type." },
  { code: "membership_metrics_covered", evidenceKey: "membershipMetricsCovered", severity: "block", message: "Membership metrics are incomplete.", nextStep: "Cover paywall viewed, conversion intent, trial started, Pro value seen, membership activated, renewal risk, and cancellation reasons." },
  { code: "no_sensitive_raw_text", evidenceKey: "telemetryAvoidsSensitiveRawText", severity: "block", message: "Telemetry may record sensitive raw text.", nextStep: "Default to metadata-only event fields and explicitly exclude raw page, transcript, file, prompt, output, saved snippet, and full URL path data." },
  { code: "events_over_content", evidenceKey: "telemetryPrefersEventsOverContent", severity: "block", message: "Telemetry relies on content instead of events/categories.", nextStep: "Use event names, counts, buckets, and categories for release dashboards." },
  { code: "privacy_mode_reduces_detail", evidenceKey: "privacyModeReducesTelemetryDetail", severity: "block", message: "Privacy Mode does not reduce telemetry detail.", nextStep: "Reduce Privacy Mode telemetry to coarse source type and non-sensitive status or local-only summaries." },
  { code: "user_data_controls_clear", evidenceKey: "userDataControlsAreClear", severity: "block", message: "Metrics surfaces do not point users to data controls.", nextStep: "Expose Privacy Mode, export/delete, reminder controls, and support-bundle preview paths around metric surfaces." },
]

export function evaluateAstraProductMetricsReadiness(evidence: AstraProductMetricsReadinessEvidence): AstraProductMetricsReadinessDecision {
  const findings = READINESS_CHECKS
    .filter((check) => !evidence[check.evidenceKey])
    .map<AstraProductMetricsReadinessFinding>((check) => ({
      code: check.code,
      severity: check.severity,
      message: check.message,
      nextStep: check.nextStep,
    }))
  const blockers = findings.filter((finding) => finding.severity === "block")
  const warnings = findings.filter((finding) => finding.severity === "warn")
  return { ready: blockers.length === 0, blockers, warnings, findings }
}
