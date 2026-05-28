export type AstraOperatingReviewCadence = "daily" | "weekly" | "monthly" | "release" | "quarterly"

export interface AstraOperatingReviewItem {
  cadence: AstraOperatingReviewCadence
  label: string
  focus: string
  requiredEvidence: string[]
}

export type AstraExperimentArea = "onboarding" | "paywall" | "review" | "save_moment" | "digest" | "free_limits" | "share_card" | "referral" | "support"

export interface AstraExperimentGuardrailDefinition {
  area: AstraExperimentArea
  successMetric: string
  guardrailMetrics: string[]
  allowedEvents: string[]
  privacyRule: string
}

export interface MonthlyUnitEconomicsInput {
  month: string
  netArpu: number
  activeUsers: number
  proUsers: number
  aiCost: number
  infraCost: number
  supportCost: number
  heavyUsers: number
  abuseUsers: number
  trialUsers: number
  convertedTrialUsers: number
  trialAiCost: number
}

export interface MonthlyUnitEconomicsReview {
  schema: "astra-monthly-unit-economics-review.v1"
  month: string
  generatedAt: string
  metrics: {
    netArpu: number
    aiCostPerActiveUser: number | null
    aiCostPerProUser: number | null
    infraCostPerActiveUser: number | null
    supportCostPerActiveUser: number | null
    grossMarginPerProUser: number | null
    heavyUserRatio: number | null
    abuseRate: number | null
    trialCostPerConvertedPro: number | null
    trialConversionRate: number | null
  }
  riskFlags: Array<{
    code: "negative_gross_margin" | "high_heavy_user_ratio" | "high_abuse_rate" | "trial_cost_unbounded" | "missing_volume"
    severity: "watch" | "pause_growth"
    message: string
  }>
  privacyBoundary: "aggregate_only_no_content"
}

export type AstraOpsCockpitRiskCode =
  | "cost_spike_or_high_risk"
  | "support_sla_risk"
  | "provider_health_incident"
  | "cancellation_reason_coverage_gap"
  | "support_macro_coverage_gap"
  | "analytics_events_missing"

export interface AstraOpsCockpitSignalInput {
  cost: {
    totalEvents: number
    totalRequests: number
    totalEstimatedSpendUsd: number
    cacheHitRate: number | null
    dailyEstimate: { riskLevel: string; spikeStatus: string; estimatedSpendUsd: number }
    buckets: Array<{ taskClass: string; costBucket: string; eventCount: number; estimatedSpendUsd: number }>
  }
  support: {
    totalReports: number
    weeklyTopIssues: unknown[]
    macroCoverage: { reportedCoverage: { coverageRate: number | null; ready: boolean | null } } | null
    slaRisk: {
      unresolvedCount: number
      urgentUnresolvedCount: number
      followUpOverdueCount: number
      staleTriageByAgeBucket: { from24hTo72h: number; from72hTo168h: number; over168h: number }
      oldestUnresolvedAgeDays: number | null
    }
  }
  cancellation: {
    totalSubmissions: number
    reasonCoverage: { coverageRate: number | null; unknownReasonCount: number }
    byReason: Array<{ label: string; count: number }>
  }
  analytics: { grain: string; totalEvents: number; byCategory: Array<{ category: string; count: number }> }
  mobileRetention: { grain: string; totalEvents: number; byEventName: Array<{ eventName: string; count: number }> }
  weeklyDigestDelivery: { totalRuns: number; recentRuns: unknown[]; byChannel: Array<{ channel: string; runCount: number; failedCount: number }> }
  providerHealth?: { totalEvents: number; buckets: Array<{ healthStatus: "healthy" | "watch" | "incident" | string }> } | null
}

export interface AstraOpsCockpitSummary {
  schema: "astra-ops-cockpit-summary.v1"
  generatedAt: string
  privacy: {
    metadataOnly: true
    aggregateOnly: true
    readOnly: true
    contentIncluded: false
    perUserRows: false
    identifiersIncluded: false
    providerBillingIncluded: false
    crmRepliesIncluded: false
  }
  sources: {
    costUsageSummary: true
    supportReportSummary: true
    cancellationReasonSummary: true
    analyticsCohortSummary: true
    mobileRetentionSummary: true
    weeklyDigestDeliverySummary: true
    providerHealthSummary: boolean
    operatingReviewHelpers: true
  }
  metrics: {
    cost: {
      retainedEvents: number
      requests: number
      estimatedSpendUsd: number
      dailyEstimatedSpendUsd: number
      dailyRiskLevel: string
      dailySpikeStatus: string
      cacheHitRate: number | null
      topCostTaskClass: string | null
    }
    support: {
      totalReports: number
      weeklyTopIssueCount: number
      unresolvedCount: number
      urgentUnresolvedCount: number
      staleTriageCount: number
      followUpOverdueCount: number
      oldestUnresolvedAgeDays: number | null
      macroCoverageRate: number | null
    }
    retentionGrowth: {
      analyticsGrain: string
      analyticsEvents: number
      mobileRetentionGrain: string
      mobileRetentionEvents: number
      weeklyDigestDeliveryRuns: number
      cancellationSubmissions: number
      cancellationReasonCoverageRate: number | null
      topCancellationReason: string | null
    }
    providerHealth: {
      available: boolean
      retainedEvents: number
      incidentBucketCount: number
      watchBucketCount: number
    }
  }
  reviewCadence: Array<{
    cadence: AstraOperatingReviewCadence
    label: string
    focus: string
    requiredEvidence: string[]
    availableEvidence: string[]
    missingEvidence: string[]
  }>
  experimentGuardrails: Array<Pick<AstraExperimentGuardrailDefinition, "area" | "successMetric" | "guardrailMetrics" | "privacyRule">>
  riskFlags: Array<{
    code: AstraOpsCockpitRiskCode
    severity: "watch" | "pause_growth"
    message: string
  }>
}

export const ASTRA_OPERATING_REVIEW_CADENCE: AstraOperatingReviewItem[] = [
  {
    cadence: "daily",
    label: "Outage, error spike, cost spike, support volume",
    focus: "Protect stability and margin before pushing growth.",
    requiredEvidence: ["support_report_summary", "cost_usage_summary", "feature_flag_runtime"],
  },
  {
    cadence: "weekly",
    label: "Activation, paywall, retention, top failures, heavy users",
    focus: "Decide experiment winners only when guardrails are healthy.",
    requiredEvidence: ["activation_funnel", "experiment_guardrails", "support_report_summary", "cost_usage_summary"],
  },
  {
    cadence: "monthly",
    label: "Pricing, gross margin, churn, trial conversion, refund reasons",
    focus: "Make gross-margin risk visible before changing trial, Pro, or growth promises.",
    requiredEvidence: ["monthly_unit_economics_review", "cancellation_reason_summary", "cost_usage_summary"],
  },
  {
    cadence: "release",
    label: "Feature adoption, regression, support load, privacy issues",
    focus: "Block release if privacy or support guardrails regress.",
    requiredEvidence: ["release_test_results", "support_report_summary", "privacy_boundary_check"],
  },
  {
    cadence: "quarterly",
    label: "Tier structure, roadmap priority, growth channel ROI",
    focus: "Rebalance plans and roadmap against observed learning value and margin.",
    requiredEvidence: ["unit_economics_trend", "growth_channel_summary", "retention_summary"],
  },
]

export const ASTRA_EXPERIMENT_GUARDRAILS: AstraExperimentGuardrailDefinition[] = [
  {
    area: "onboarding",
    successMetric: "onboarding_completed_rate",
    guardrailMetrics: ["first_value_seen_rate", "support_complaint_rate", "privacy_mode_opt_out_rate"],
    allowedEvents: ["variant_assigned", "conversion_event", "guardrail_metric", "onboarding_completed", "first_content_understood"],
    privacyRule: "No page text, selected text, prompt, provider, model, API key, or full URL.",
  },
  {
    area: "paywall",
    successMetric: "pro_value_seen_to_trial_or_signup_rate",
    guardrailMetrics: ["refund_reason_rate", "cancellation_reason_rate", "support_report_rate"],
    allowedEvents: ["variant_assigned", "conversion_event", "guardrail_metric", "paywall_viewed", "pro_value_seen"],
    privacyRule: "Track trigger, surface, tier, and outcome only; do not store payment details or content.",
  },
  {
    area: "review",
    successMetric: "review_session_completed_rate",
    guardrailMetrics: ["review_abandon_rate", "reminder_disabled_rate"],
    allowedEvents: ["variant_assigned", "conversion_event", "guardrail_metric", "review_answered", "review_session_completed"],
    privacyRule: "Use card counts and source type buckets only; do not store saved sentence text.",
  },
  {
    area: "save_moment",
    successMetric: "saved_to_first_review_rate",
    guardrailMetrics: ["save_error_rate", "support_report_rate"],
    allowedEvents: ["variant_assigned", "conversion_event", "guardrail_metric", "sentence_saved", "saved_snippet_created"],
    privacyRule: "Do not store saved text, source excerpts, or full source URLs.",
  },
  {
    area: "digest",
    successMetric: "digest_viewed_rate",
    guardrailMetrics: ["digest_opt_out_rate", "privacy_complaint_rate"],
    allowedEvents: ["variant_assigned", "conversion_event", "guardrail_metric", "digest_viewed"],
    privacyRule: "Digest experiments use counts and source-type buckets; no page text or transcript content.",
  },
  {
    area: "free_limits",
    successMetric: "limit_prompt_to_signup_rate",
    guardrailMetrics: ["frustration_report_rate", "translation_failure_rate"],
    allowedEvents: ["variant_assigned", "conversion_event", "guardrail_metric", "paywall_viewed"],
    privacyRule: "Track limit bucket and tier only; never expose token/provider/model language to users.",
  },
  {
    area: "share_card",
    successMetric: "share_card_created_rate",
    guardrailMetrics: ["privacy_complaint_rate", "landing_bounce_rate"],
    allowedEvents: ["variant_assigned", "conversion_event", "guardrail_metric", "share_card_created", "landing_visited"],
    privacyRule: "User explicitly shares; telemetry stores metadata only and never hosts shared text by default.",
  },
  {
    area: "referral",
    successMetric: "sample_referral_install_or_landing_rate",
    guardrailMetrics: [
      "self_referral_block_rate",
      "duplicate_identity_block_rate",
      "invite_rate_limit_hit_rate",
      "reward_grant_count_must_remain_zero",
    ],
    allowedEvents: [
      "referral_sent",
      "referral_converted",
      "landing_visited",
      "landing_install_clicked",
      "variant_assigned",
      "conversion_event",
      "guardrail_metric",
    ],
    privacyRule: "Sample-content-first referral telemetry stores metadata only; no rewards, checkout, payment, subscription, email, user content, or raw URLs.",
  },
  {
    area: "support",
    successMetric: "useful_support_report_rate",
    guardrailMetrics: ["content_included_rate", "known_issue_repeat_rate"],
    allowedEvents: ["variant_assigned", "conversion_event", "guardrail_metric", "support_report_submitted", "known_issue_viewed"],
    privacyRule: "Support report experiments remain metadata-only unless the user explicitly opts into content.",
  },
]

function ratio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null
  return numerator / denominator
}

function roundCurrency(value: number | null): number | null {
  if (value == null) return null
  return Math.round(value * 100) / 100
}

function roundRatio(value: number | null): number | null {
  if (value == null) return null
  return Math.round(value * 10_000) / 10_000
}

function sumValues<T>(entries: T[], selector: (entry: T) => number): number {
  return entries.reduce((sum, entry) => sum + selector(entry), 0)
}

export function buildAstraOpsCockpitSummary(
  input: AstraOpsCockpitSignalInput,
  now: Date = new Date(),
): AstraOpsCockpitSummary {
  const availableEvidence = new Set<string>([
    "support_report_summary",
    "cost_usage_summary",
    "cancellation_reason_summary",
    "activation_funnel",
    "experiment_guardrails",
    "retention_summary",
    "weekly_digest_delivery_summary",
    ...(input.providerHealth ? ["provider_health_summary"] : []),
  ])
  const topCostBucket = [...input.cost.buckets].sort((left, right) =>
    right.estimatedSpendUsd - left.estimatedSpendUsd
    || right.eventCount - left.eventCount
    || left.taskClass.localeCompare(right.taskClass),
  )[0] ?? null
  const providerIncidentBucketCount = input.providerHealth?.buckets.filter((bucket) => bucket.healthStatus === "incident").length ?? 0
  const providerWatchBucketCount = input.providerHealth?.buckets.filter((bucket) => bucket.healthStatus === "watch").length ?? 0
  const staleTriageCount = sumValues(Object.values(input.support.slaRisk.staleTriageByAgeBucket), (count) => count)
  const topCancellationReason = input.cancellation.byReason.find((reason) => reason.count > 0)?.label ?? null
  const riskFlags: AstraOpsCockpitSummary["riskFlags"] = []

  if (input.cost.dailyEstimate.riskLevel === "high" || input.cost.dailyEstimate.spikeStatus === "spike") {
    riskFlags.push({
      code: "cost_spike_or_high_risk",
      severity: "pause_growth",
      message: "Aggregate daily cost signal is high or spiking; review high-cost task routing before expanding growth.",
    })
  } else if (input.cost.dailyEstimate.riskLevel === "watch" || input.cost.dailyEstimate.spikeStatus === "watch") {
    riskFlags.push({
      code: "cost_spike_or_high_risk",
      severity: "watch",
      message: "Aggregate daily cost signal is elevated; review task-class and cache buckets.",
    })
  }
  if (input.support.slaRisk.urgentUnresolvedCount > 0 || input.support.slaRisk.followUpOverdueCount > 0 || input.support.slaRisk.staleTriageByAgeBucket.over168h > 0) {
    riskFlags.push({
      code: "support_sla_risk",
      severity: "pause_growth",
      message: "Support has urgent, overdue, or over-7-day unresolved work; prioritize triage before launch expansion.",
    })
  } else if (input.support.slaRisk.unresolvedCount > 0 || staleTriageCount > 0) {
    riskFlags.push({
      code: "support_sla_risk",
      severity: "watch",
      message: "Support has unresolved or stale metadata-only reports to review.",
    })
  }
  if (providerIncidentBucketCount > 0) {
    riskFlags.push({
      code: "provider_health_incident",
      severity: "pause_growth",
      message: "Provider-health aggregates include incident buckets; keep outage mitigation and kill switches ready.",
    })
  } else if (providerWatchBucketCount > 0) {
    riskFlags.push({
      code: "provider_health_incident",
      severity: "watch",
      message: "Provider-health aggregates include watch buckets; monitor fallback and failure rates.",
    })
  }
  if (input.cancellation.totalSubmissions > 0 && (input.cancellation.reasonCoverage.coverageRate ?? 0) < 0.8) {
    riskFlags.push({
      code: "cancellation_reason_coverage_gap",
      severity: "watch",
      message: "Cancellation/refund feedback has low reason coverage; improve reason capture before pricing decisions.",
    })
  }
  if (input.support.macroCoverage && input.support.macroCoverage.reportedCoverage.ready === false) {
    riskFlags.push({
      code: "support_macro_coverage_gap",
      severity: "watch",
      message: "Support first-response macro coverage is below the operating threshold.",
    })
  }
  if (input.analytics.totalEvents === 0) {
    riskFlags.push({
      code: "analytics_events_missing",
      severity: "watch",
      message: "No privacy-safe analytics events are retained, so activation/cohort review is not yet decision-grade.",
    })
  }

  return {
    schema: "astra-ops-cockpit-summary.v1",
    generatedAt: now.toISOString(),
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
    sources: {
      costUsageSummary: true,
      supportReportSummary: true,
      cancellationReasonSummary: true,
      analyticsCohortSummary: true,
      mobileRetentionSummary: true,
      weeklyDigestDeliverySummary: true,
      providerHealthSummary: Boolean(input.providerHealth),
      operatingReviewHelpers: true,
    },
    metrics: {
      cost: {
        retainedEvents: input.cost.totalEvents,
        requests: input.cost.totalRequests,
        estimatedSpendUsd: input.cost.totalEstimatedSpendUsd,
        dailyEstimatedSpendUsd: input.cost.dailyEstimate.estimatedSpendUsd,
        dailyRiskLevel: input.cost.dailyEstimate.riskLevel,
        dailySpikeStatus: input.cost.dailyEstimate.spikeStatus,
        cacheHitRate: input.cost.cacheHitRate,
        topCostTaskClass: topCostBucket?.taskClass ?? null,
      },
      support: {
        totalReports: input.support.totalReports,
        weeklyTopIssueCount: input.support.weeklyTopIssues.length,
        unresolvedCount: input.support.slaRisk.unresolvedCount,
        urgentUnresolvedCount: input.support.slaRisk.urgentUnresolvedCount,
        staleTriageCount,
        followUpOverdueCount: input.support.slaRisk.followUpOverdueCount,
        oldestUnresolvedAgeDays: input.support.slaRisk.oldestUnresolvedAgeDays,
        macroCoverageRate: input.support.macroCoverage?.reportedCoverage.coverageRate ?? null,
      },
      retentionGrowth: {
        analyticsGrain: input.analytics.grain,
        analyticsEvents: input.analytics.totalEvents,
        mobileRetentionGrain: input.mobileRetention.grain,
        mobileRetentionEvents: input.mobileRetention.totalEvents,
        weeklyDigestDeliveryRuns: input.weeklyDigestDelivery.totalRuns,
        cancellationSubmissions: input.cancellation.totalSubmissions,
        cancellationReasonCoverageRate: input.cancellation.reasonCoverage.coverageRate,
        topCancellationReason,
      },
      providerHealth: {
        available: Boolean(input.providerHealth),
        retainedEvents: input.providerHealth?.totalEvents ?? 0,
        incidentBucketCount: providerIncidentBucketCount,
        watchBucketCount: providerWatchBucketCount,
      },
    },
    reviewCadence: ASTRA_OPERATING_REVIEW_CADENCE.map((item) => {
      const present = item.requiredEvidence.filter((evidence) => availableEvidence.has(evidence))
      return {
        ...item,
        availableEvidence: present,
        missingEvidence: item.requiredEvidence.filter((evidence) => !availableEvidence.has(evidence)),
      }
    }),
    experimentGuardrails: ASTRA_EXPERIMENT_GUARDRAILS.map(({ area, successMetric, guardrailMetrics, privacyRule }) => ({
      area,
      successMetric,
      guardrailMetrics,
      privacyRule,
    })),
    riskFlags,
  }
}

export function buildMonthlyUnitEconomicsReview(
  input: MonthlyUnitEconomicsInput,
  now: Date = new Date(),
): MonthlyUnitEconomicsReview {
  const aiCostPerActiveUser = roundCurrency(ratio(input.aiCost, input.activeUsers))
  const aiCostPerProUser = roundCurrency(ratio(input.aiCost, input.proUsers))
  const infraCostPerActiveUser = roundCurrency(ratio(input.infraCost, input.activeUsers))
  const supportCostPerActiveUser = roundCurrency(ratio(input.supportCost, input.activeUsers))
  const grossMarginPerProUser = input.proUsers > 0
    ? roundCurrency(input.netArpu - ((input.aiCost + input.infraCost + input.supportCost) / input.proUsers))
    : null
  const heavyUserRatio = roundRatio(ratio(input.heavyUsers, input.activeUsers))
  const abuseRate = roundRatio(ratio(input.abuseUsers, input.activeUsers))
  const trialCostPerConvertedPro = roundCurrency(ratio(input.trialAiCost, input.convertedTrialUsers))
  const trialConversionRate = roundRatio(ratio(input.convertedTrialUsers, input.trialUsers))
  const riskFlags: MonthlyUnitEconomicsReview["riskFlags"] = []

  if (input.activeUsers <= 0 || input.proUsers <= 0) {
    riskFlags.push({
      code: "missing_volume",
      severity: "watch",
      message: "Active/pro user volume is missing, so margin risk cannot be fully evaluated.",
    })
  }
  if (grossMarginPerProUser != null && grossMarginPerProUser < 0) {
    riskFlags.push({
      code: "negative_gross_margin",
      severity: "pause_growth",
      message: "Gross margin per Pro user is negative; pause high-cost growth until pricing, limits, or routing are adjusted.",
    })
  }
  if (heavyUserRatio != null && heavyUserRatio >= 0.15) {
    riskFlags.push({
      code: "high_heavy_user_ratio",
      severity: heavyUserRatio >= 0.25 ? "pause_growth" : "watch",
      message: "Heavy-user ratio is elevated; review long-content limits, async queues, and high-cost task routing.",
    })
  }
  if (abuseRate != null && abuseRate >= 0.02) {
    riskFlags.push({
      code: "high_abuse_rate",
      severity: "pause_growth",
      message: "Abuse-like usage exceeds the operating threshold; prioritize rate limits and referral/trial abuse checks.",
    })
  }
  if (input.trialUsers > 0 && input.convertedTrialUsers === 0 && input.trialAiCost > 0) {
    riskFlags.push({
      code: "trial_cost_unbounded",
      severity: "pause_growth",
      message: "Trial AI cost has no converted Pro users yet; do not expand trial benefits until conversion evidence exists.",
    })
  }

  return {
    schema: "astra-monthly-unit-economics-review.v1",
    month: input.month,
    generatedAt: now.toISOString(),
    metrics: {
      netArpu: roundCurrency(input.netArpu) ?? 0,
      aiCostPerActiveUser,
      aiCostPerProUser,
      infraCostPerActiveUser,
      supportCostPerActiveUser,
      grossMarginPerProUser,
      heavyUserRatio,
      abuseRate,
      trialCostPerConvertedPro,
      trialConversionRate,
    },
    riskFlags,
    privacyBoundary: "aggregate_only_no_content",
  }
}
