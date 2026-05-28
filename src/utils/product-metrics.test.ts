import { describe, expect, it } from "vitest"

import {
  ASTRA_METRIC_ETHICS_RULES,
  ASTRA_METRIC_QUESTIONS,
  ASTRA_PRODUCTION_METRIC_EXPORT_REQUIREMENTS,
  ASTRA_PRODUCT_METRICS,
  evaluateAstraProductMetricsReadiness,
  evaluateAstraProductionMetricsExportPacket,
  getAstraProductMetricsByCategory,
  type AstraProductMetricsReadinessEvidence,
} from "./product-metrics"

const readyEvidence: AstraProductMetricsReadinessEvidence = {
  productQuestionsHaveMetricCoverage: true,
  activationMetricsCovered: true,
  understandingMetricsCovered: true,
  learningMetricsCovered: true,
  membershipMetricsCovered: true,
  telemetryAvoidsSensitiveRawText: true,
  telemetryPrefersEventsOverContent: true,
  privacyModeReducesTelemetryDetail: true,
  userDataControlsAreClear: true,
}

const completeProductionExportRows = ASTRA_PRODUCTION_METRIC_EXPORT_REQUIREMENTS.map((requirement) => ({
  category: requirement.category,
  dateRange: "2026-05-28..2026-05-28",
  cohortDefinition: "target RC cohort for current commit",
  dashboardOrQuerySource: `warehouse.${requirement.category}_metrics_v1`,
  exportId: `metrics-${requirement.category}-2026-05-28`,
  exportedAt: "2026-05-28T00:00:00.000Z",
  exportDigest: `sha256:${requirement.category.repeat(8).slice(0, 32)}`,
  queryVersion: "astra-production-metrics-query.v1",
  metricIds: getAstraProductMetricsByCategory(requirement.category).map((metric) => metric.id),
  evidenceLink: `https://release-evidence.astra.internal/metrics/${requirement.category}.csv`,
  ownerDate: "Metrics owner — 2026-05-28",
  privacyReviewLink: "https://release-evidence.astra.internal/metrics/privacy-review",
}))

describe("Astra product metrics contract", () => {
  it("maps product metrics to the core decision questions", () => {
    expect(ASTRA_METRIC_QUESTIONS.map((question) => question.id)).toEqual([
      "where_users_drop_off",
      "which_entry_used_most",
      "which_errors_most_common",
      "whether_users_save_content",
      "whether_saved_users_review",
      "whether_membership_value_seen",
    ])
  })

  it("defines Activation metrics", () => {
    expect(getAstraProductMetricsByCategory("activation").map((metric) => metric.id)).toEqual([
      "extension_installed",
      "onboarding_started",
      "onboarding_completed",
      "signed_in",
      "sample_started",
      "first_content_understood",
      "first_value_seen",
      "first_item_saved",
      "first_review_opened",
      "first_review_completed",
    ])
  })

  it("defines Understanding metrics", () => {
    expect(getAstraProductMetricsByCategory("understanding").map((metric) => metric.id)).toEqual([
      "content_understanding_started",
      "first_result_latency",
      "completion_latency",
      "failure_count",
      "retry_count",
      "user_stopped",
      "deeper_explanation_opened",
      "quality_speed_preference_switched",
    ])
  })

  it("defines Learning and Membership metrics", () => {
    expect(getAstraProductMetricsByCategory("learning").map((metric) => metric.id)).toEqual([
      "saved_words",
      "saved_sentences",
      "cards_due",
      "cards_reviewed",
      "review_completion_rate",
      "return_to_source_clicks",
      "weekly_active_learners",
      "saved_content_by_source_type",
    ])
    expect(getAstraProductMetricsByCategory("membership").map((metric) => metric.id)).toEqual([
      "paywall_viewed",
      "conversion_event",
      "trial_started",
      "pro_value_seen",
      "membership_activated",
      "renewal_risk_signals",
      "cancellation_reason_submitted",
    ])
  })

  it("defines production export requirements for every final metric category", () => {
    expect(ASTRA_PRODUCTION_METRIC_EXPORT_REQUIREMENTS.map((requirement) => requirement.category)).toEqual([
      "activation",
      "understanding",
      "learning",
      "membership",
    ])
  })

  it("accepts production metric export evidence only when every category has cohort, source, owner, evidence, and privacy review", () => {
    expect(evaluateAstraProductionMetricsExportPacket(completeProductionExportRows)).toEqual({
      acceptable: true,
      findings: [],
    })
  })

  it("rejects unknown production metric export rows so unrelated categories cannot satisfy final metric evidence", () => {
    const decision = evaluateAstraProductionMetricsExportPacket([
      {
        category: "billing" as never,
        dateRange: "2026-05-28..2026-05-28",
        cohortDefinition: "target RC cohort for current commit",
        dashboardOrQuerySource: "warehouse query export",
        exportId: "metrics-billing-2026-05-28",
        exportedAt: "2026-05-28T00:00:00.000Z",
        exportDigest: "sha256:billingbillingbillingbillingbilling",
        queryVersion: "astra-production-metrics-query.v1",
        metricIds: [],
        evidenceLink: "https://release-evidence.astra.internal/metrics/billing",
        ownerDate: "Metrics owner — 2026-05-28",
        privacyReviewLink: "https://release-evidence.astra.internal/privacy-review/billing",
      },
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings).toEqual(expect.arrayContaining([
      {
        code: "unknown_category",
        category: "billing",
        message: "billing is not a tracked production metric export category.",
        nextStep: "Use activation, understanding, learning, or membership.",
      },
    ]))
  })

  it("rejects duplicate production metric export rows so conflicting category evidence cannot overwrite each other", () => {
    const decision = evaluateAstraProductionMetricsExportPacket([
      ...completeProductionExportRows,
      completeProductionExportRows[0],
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings).toEqual([
      {
        code: "duplicate_category",
        category: "activation",
        message: "activation production metric export has duplicate evidence rows.",
        nextStep: "Keep one production metric export evidence row per category.",
      },
    ])
  })

  it("rejects duplicated production metric export identities and evidence links", () => {
    const decision = evaluateAstraProductionMetricsExportPacket([
      completeProductionExportRows[0],
      {
        ...completeProductionExportRows[1],
        exportId: completeProductionExportRows[0].exportId,
        evidenceLink: completeProductionExportRows[0].evidenceLink,
      },
      completeProductionExportRows[2],
      completeProductionExportRows[3],
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual([
      "duplicate_export_id",
      "duplicate_evidence_link",
    ])
  })

  it("rejects unknown or category-mismatched metric ids in production exports", () => {
    const decision = evaluateAstraProductionMetricsExportPacket([
      {
        ...completeProductionExportRows[0],
        metricIds: ["saved_words", "unknown_metric" as never],
      },
      ...completeProductionExportRows.slice(1),
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual([
      "mismatched_metric_category",
      "unknown_metric_id",
    ])
  })

  it("rejects duplicate metric ids within a production export row", () => {
    const decision = evaluateAstraProductionMetricsExportPacket([
      {
        ...completeProductionExportRows[0],
        metricIds: ["extension_installed", "extension_installed", "onboarding_started"],
      },
      ...completeProductionExportRows.slice(1),
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual(["duplicate_metric_id"])
  })

  it("rejects production metric exports that mix date ranges or cohort definitions", () => {
    const decision = evaluateAstraProductionMetricsExportPacket([
      completeProductionExportRows[0],
      {
        ...completeProductionExportRows[1],
        dateRange: "2026-05-29..2026-05-29",
      },
      {
        ...completeProductionExportRows[2],
        cohortDefinition: "different release cohort",
      },
      completeProductionExportRows[3],
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings).toEqual([
      {
        code: "inconsistent_date_range",
        category: "all",
        message: "Production metric export categories must use the same date range.",
        nextStep: "Export Activation, Understanding, Learning, and Membership metrics for one shared release date range.",
      },
      {
        code: "inconsistent_cohort_definition",
        category: "all",
        message: "Production metric export categories must use the same cohort definition.",
        nextStep: "Export Activation, Understanding, Learning, and Membership metrics for one shared release cohort.",
      },
    ])
  })

  it("accepts stable short production metric export ids and query versions", () => {
    const decision = evaluateAstraProductionMetricsExportPacket(completeProductionExportRows.map((row) => ({
      ...row,
      exportId: `${row.category}-v3`,
      queryVersion: "v1.0.0",
    })))

    expect(decision).toEqual({ acceptable: true, findings: [] })
  })

  it("rejects weak production metric export dates and non-link evidence references", () => {
    const decision = evaluateAstraProductionMetricsExportPacket([
      {
        ...completeProductionExportRows[0],
        dateRange: "release week",
        cohortDefinition: "pending cohort",
        dashboardOrQuerySource: "draft dashboard",
        exportId: "export:000000000000",
        exportedAt: "release day",
        exportDigest: "temp",
        queryVersion: "query:000000000000",
        evidenceLink: "http://[fe80::1]/metrics/activation.csv",
        ownerDate: "metrics owner / 2026-99-99",
        privacyReviewLink: "docs/reviews/privacy%2e%2e-review.md",
      },
      ...completeProductionExportRows.slice(1),
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      "invalid_date_range",
      "invalid_cohort_definition",
      "invalid_dashboard_or_query_source",
      "invalid_export_id",
      "invalid_exported_at",
      "invalid_export_digest",
      "invalid_query_version",
      "invalid_evidence_link",
      "invalid_owner_date",
      "invalid_privacy_review_link",
    ]))
  })

  it("rejects repeated-character production metric export digests", () => {
    const decision = evaluateAstraProductionMetricsExportPacket([
      {
        ...completeProductionExportRows[0],
        exportDigest: "aaaaaaaaaaaa",
      },
      ...completeProductionExportRows.slice(1),
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toContain("invalid_export_digest")
  })

  it("rejects impossible or reversed production metric export date ranges", () => {
    const decision = evaluateAstraProductionMetricsExportPacket([
      {
        ...completeProductionExportRows[0],
        dateRange: "2026-99-99..2026-05-28",
      },
      {
        ...completeProductionExportRows[1],
        dateRange: "2026-05-29..2026-05-28",
      },
      ...completeProductionExportRows.slice(2),
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code).filter((code) => code === "invalid_date_range")).toHaveLength(2)
  })

  it("rejects impossible production metric exported-at timestamps", () => {
    const decision = evaluateAstraProductionMetricsExportPacket([
      {
        ...completeProductionExportRows[0],
        exportedAt: "2026-02-31T00:00:00.000Z",
      },
      ...completeProductionExportRows.slice(1),
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toContain("invalid_exported_at")
  })

  it("rejects incomplete production metric export evidence so local diagnostics cannot masquerade as cohort exports", () => {
    const decision = evaluateAstraProductionMetricsExportPacket([
      {
        category: "activation",
        dateRange: "",
        cohortDefinition: "",
        dashboardOrQuerySource: "",
        exportId: "",
        exportedAt: "",
        exportDigest: "",
        queryVersion: "",
        metricIds: [],
        evidenceLink: "",
        ownerDate: "",
        privacyReviewLink: "",
      },
    ])

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual([
      "missing_date_range",
      "missing_cohort_definition",
      "missing_dashboard_or_query_source",
      "missing_export_id",
      "missing_exported_at",
      "missing_export_digest",
      "missing_query_version",
      "missing_metric_ids",
      "missing_evidence_link",
      "missing_owner",
      "missing_privacy_review",
      "missing_category",
      "missing_category",
      "missing_category",
    ])
    expect(decision.findings.filter((finding) => finding.code === "missing_category").map((finding) => finding.category)).toEqual([
      "understanding",
      "learning",
      "membership",
    ])
  })

  it("keeps telemetry content policies metadata-first", () => {
    expect(ASTRA_PRODUCT_METRICS.every((metric) => metric.contentPolicy.length > 10)).toBe(true)
    expect(ASTRA_PRODUCT_METRICS.find((metric) => metric.id === "saved_sentences")?.contentPolicy).toContain("no sentence text")
    expect(ASTRA_PRODUCT_METRICS.find((metric) => metric.id === "return_to_source_clicks")?.contentPolicy).toContain("no full URL paths")
  })

  it("defines telemetry ethics rules", () => {
    expect(ASTRA_METRIC_ETHICS_RULES.map((rule) => rule.id)).toEqual([
      "no_sensitive_raw_text",
      "events_over_content",
      "privacy_mode_reduces_telemetry",
      "clear_user_data_control",
    ])
    expect(ASTRA_METRIC_ETHICS_RULES.find((rule) => rule.id === "no_sensitive_raw_text")?.implementationBoundary).toContain("saved snippet text")
  })

  it("passes readiness when categories and ethics evidence are present", () => {
    const decision = evaluateAstraProductMetricsReadiness(readyEvidence)
    expect(decision.ready).toBe(true)
    expect(decision.blockers).toEqual([])
    expect(decision.warnings).toEqual([])
  })

  it("blocks readiness when metric categories or core telemetry ethics are missing", () => {
    const decision = evaluateAstraProductMetricsReadiness({
      ...readyEvidence,
      productQuestionsHaveMetricCoverage: false,
      activationMetricsCovered: false,
      understandingMetricsCovered: false,
      learningMetricsCovered: false,
      membershipMetricsCovered: false,
      telemetryAvoidsSensitiveRawText: false,
      telemetryPrefersEventsOverContent: false,
      privacyModeReducesTelemetryDetail: false,
    })

    expect(decision.ready).toBe(false)
    expect(decision.blockers.map((finding) => finding.code)).toEqual([
      "questions_answered",
      "activation_metrics_covered",
      "understanding_metrics_covered",
      "learning_metrics_covered",
      "membership_metrics_covered",
      "no_sensitive_raw_text",
      "events_over_content",
      "privacy_mode_reduces_detail",
    ])
  })

  it("warns when data controls are not clear", () => {
    const decision = evaluateAstraProductMetricsReadiness({
      ...readyEvidence,
      userDataControlsAreClear: false,
    })

    expect(decision.ready).toBe(true)
    expect(decision.warnings.map((finding) => finding.code)).toEqual(["user_data_controls_clear"])
  })
})
