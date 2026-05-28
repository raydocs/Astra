import { describe, expect, it } from "vitest"

import {
  ASTRA_EXPERIMENT_GUARDRAILS,
  ASTRA_OPERATING_REVIEW_CADENCE,
  buildAstraOpsCockpitSummary,
  buildMonthlyUnitEconomicsReview,
} from "./operating-review"

describe("operating review cadence", () => {
  it("defines the required privacy-safe operating review cadences", () => {
    expect(ASTRA_OPERATING_REVIEW_CADENCE.map((item) => item.cadence)).toEqual([
      "daily",
      "weekly",
      "monthly",
      "release",
      "quarterly",
    ])
    expect(ASTRA_OPERATING_REVIEW_CADENCE.find((item) => item.cadence === "weekly")?.requiredEvidence)
      .toEqual(expect.arrayContaining(["experiment_guardrails", "cost_usage_summary"]))
    expect(ASTRA_OPERATING_REVIEW_CADENCE.find((item) => item.cadence === "monthly")?.requiredEvidence)
      .toEqual(expect.arrayContaining(["monthly_unit_economics_review", "cancellation_reason_summary"]))
  })

  it("keeps experiment guardrails explicit and content-free", () => {
    expect(ASTRA_EXPERIMENT_GUARDRAILS.map((item) => item.area)).toEqual([
      "onboarding",
      "paywall",
      "review",
      "save_moment",
      "digest",
      "free_limits",
      "share_card",
      "referral",
      "support",
    ])
    const serialized = JSON.stringify(ASTRA_EXPERIMENT_GUARDRAILS).toLowerCase()
    expect(serialized).toContain("variant_assigned")
    expect(serialized).toContain("conversion_event")
    expect(serialized).toContain("guardrail_metric")
    expect(serialized).toContain("metadata only")
    const referral = ASTRA_EXPERIMENT_GUARDRAILS.find((item) => item.area === "referral")
    expect(referral).toMatchObject({
      allowedEvents: [
        "referral_sent",
        "referral_converted",
        "landing_visited",
        "landing_install_clicked",
        "variant_assigned",
        "conversion_event",
        "guardrail_metric",
      ],
      guardrailMetrics: expect.arrayContaining([
        "self_referral_block_rate",
        "duplicate_identity_block_rate",
        "invite_rate_limit_hit_rate",
        "reward_grant_count_must_remain_zero",
      ]),
    })
    expect(serialized).not.toContain("articleexcerpt")
    expect(serialized).not.toContain("contentsummary")
    expect(serialized).not.toContain("apikey")
  })
})

describe("ops cockpit summary", () => {
  it("consolidates existing aggregate operating signals without content or identifiers", () => {
    const summary = buildAstraOpsCockpitSummary({
      cost: {
        totalEvents: 3,
        totalRequests: 4,
        totalEstimatedSpendUsd: 0.21,
        cacheHitRate: 0.33,
        dailyEstimate: { riskLevel: "watch", spikeStatus: "watch", estimatedSpendUsd: 0.21 },
        buckets: [
          { taskClass: "deep_reading", costBucket: "high", eventCount: 1, estimatedSpendUsd: 0.2 },
          { taskClass: "paragraph_understanding", costBucket: "medium", eventCount: 2, estimatedSpendUsd: 0.01 },
        ],
      },
      support: {
        totalReports: 2,
        weeklyTopIssues: [{ key: "page" }],
        macroCoverage: { reportedCoverage: { coverageRate: 0.5, ready: false } },
        slaRisk: {
          unresolvedCount: 2,
          urgentUnresolvedCount: 1,
          followUpOverdueCount: 1,
          staleTriageByAgeBucket: { from24hTo72h: 1, from72hTo168h: 0, over168h: 0 },
          oldestUnresolvedAgeDays: 2,
        },
      },
      cancellation: {
        totalSubmissions: 2,
        reasonCoverage: { coverageRate: 0.5, unknownReasonCount: 1 },
        byReason: [{ label: "Too slow", count: 1 }],
      },
      analytics: { grain: "week", totalEvents: 5, byCategory: [{ category: "activation", count: 2 }] },
      mobileRetention: { grain: "week", totalEvents: 4, byEventName: [{ eventName: "app_opened", count: 4 }] },
      weeklyDigestDelivery: { totalRuns: 1, recentRuns: [{ dryRun: true }], byChannel: [{ channel: "email", runCount: 1, failedCount: 0 }] },
      providerHealth: { totalEvents: 3, buckets: [{ healthStatus: "incident" }, { healthStatus: "watch" }] },
    }, new Date("2026-05-28T00:00:00.000Z"))

    expect(summary).toMatchObject({
      schema: "astra-ops-cockpit-summary.v1",
      generatedAt: "2026-05-28T00:00:00.000Z",
      privacy: {
        metadataOnly: true,
        aggregateOnly: true,
        readOnly: true,
        contentIncluded: false,
        perUserRows: false,
        identifiersIncluded: false,
        providerBillingIncluded: false,
        crmRepliesIncluded: false,
      },
      metrics: {
        cost: { retainedEvents: 3, requests: 4, topCostTaskClass: "deep_reading" },
        support: { totalReports: 2, urgentUnresolvedCount: 1, staleTriageCount: 1, macroCoverageRate: 0.5 },
        retentionGrowth: { analyticsEvents: 5, mobileRetentionEvents: 4, weeklyDigestDeliveryRuns: 1, topCancellationReason: "Too slow" },
        providerHealth: { available: true, retainedEvents: 3, incidentBucketCount: 1, watchBucketCount: 1 },
      },
    })
    expect(summary.reviewCadence.find((item) => item.cadence === "weekly")?.availableEvidence).toEqual(expect.arrayContaining([
      "activation_funnel",
      "experiment_guardrails",
      "support_report_summary",
      "cost_usage_summary",
    ]))
    expect(summary.experimentGuardrails.map((guardrail) => guardrail.area)).toContain("support")
    expect(summary.riskFlags.map((flag) => flag.code)).toEqual(expect.arrayContaining([
      "cost_spike_or_high_risk",
      "support_sla_risk",
      "provider_health_incident",
      "cancellation_reason_coverage_gap",
      "support_macro_coverage_gap",
    ]))

    const serialized = JSON.stringify(summary).toLowerCase()
    expect(serialized).not.toContain("demo@astra.local")
    expect(serialized).not.toContain("usr_demo")
    expect(serialized).not.toContain("device-123")
    expect(serialized).not.toContain("https://private.example/page")
    expect(serialized).not.toContain("gpt-private-pro")
    expect(serialized).not.toContain("billing reconciliation")
    expect(serialized).not.toContain("crm reply")
  })
})

describe("monthly unit economics review", () => {
  it("computes aggregate margin metrics without user/content fields", () => {
    const review = buildMonthlyUnitEconomicsReview({
      month: "2026-05",
      netArpu: 12,
      activeUsers: 100,
      proUsers: 20,
      aiCost: 80,
      infraCost: 20,
      supportCost: 10,
      heavyUsers: 8,
      abuseUsers: 1,
      trialUsers: 10,
      convertedTrialUsers: 2,
      trialAiCost: 18,
    }, new Date("2026-05-27T00:00:00.000Z"))

    expect(review).toMatchObject({
      schema: "astra-monthly-unit-economics-review.v1",
      month: "2026-05",
      generatedAt: "2026-05-27T00:00:00.000Z",
      privacyBoundary: "aggregate_only_no_content",
      metrics: {
        netArpu: 12,
        aiCostPerActiveUser: 0.8,
        aiCostPerProUser: 4,
        infraCostPerActiveUser: 0.2,
        supportCostPerActiveUser: 0.1,
        grossMarginPerProUser: 6.5,
        heavyUserRatio: 0.08,
        abuseRate: 0.01,
        trialCostPerConvertedPro: 9,
        trialConversionRate: 0.2,
      },
      riskFlags: [],
    })

    const serialized = JSON.stringify(review).toLowerCase()
    expect(serialized).not.toContain("email")
    expect(serialized).not.toContain("userid")
    expect(serialized).not.toContain("deviceid")
    expect(serialized).not.toContain("pageurl")
    expect(serialized).not.toContain("provider")
    expect(serialized).not.toContain("model")
    expect(serialized).not.toContain("prompt")
  })

  it("flags margin, heavy-user, abuse, and trial risks", () => {
    const review = buildMonthlyUnitEconomicsReview({
      month: "2026-05",
      netArpu: 6,
      activeUsers: 100,
      proUsers: 10,
      aiCost: 80,
      infraCost: 20,
      supportCost: 20,
      heavyUsers: 26,
      abuseUsers: 3,
      trialUsers: 12,
      convertedTrialUsers: 0,
      trialAiCost: 30,
    }, new Date("2026-05-27T00:00:00.000Z"))

    expect(review.riskFlags.map((flag) => flag.code)).toEqual(expect.arrayContaining([
      "negative_gross_margin",
      "high_heavy_user_ratio",
      "high_abuse_rate",
      "trial_cost_unbounded",
    ]))
    expect(review.riskFlags.filter((flag) => flag.severity === "pause_growth").length).toBeGreaterThanOrEqual(3)
  })
})
