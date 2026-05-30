import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import type { AiQualityCapability, AiQualitySampleResult } from "./ai-quality-system"
import {
  ASTRA_AI_QUALITY_ABILITY_CATEGORIES,
  ASTRA_AI_QUALITY_ERROR_TAXONOMY,
  ASTRA_AI_QUALITY_RELEASE_THRESHOLDS,
  buildAiQualityTrendSummary,
  evaluateAiQualityHumanScoredReportEvidence,
  evaluateAiQualityReleaseReadiness,
  summarizeAiQualityRun,
} from "./ai-quality-system"

function buildPassingSamples(): AiQualitySampleResult[] {
  return Array.from({ length: ASTRA_AI_QUALITY_RELEASE_THRESHOLDS.minimumP0Samples }, (_, index) => {
    const capability = ASTRA_AI_QUALITY_ABILITY_CATEGORIES[index % ASTRA_AI_QUALITY_ABILITY_CATEGORIES.length]
    return {
      sampleId: `sample_${String(index + 1).padStart(3, "0")}`,
      capability,
      priority: "P0",
      scores: {
        technical_success: 4.4,
        content_quality: 4.5,
        learning_usefulness: 4.3,
      },
      reviewCardReusable: capability === "review_card" ? true : undefined,
      safetyPassed: index % 10 === 0 ? true : undefined,
    }
  })
}

function summarizePassingSamples(samples: AiQualitySampleResult[]) {
  return summarizeAiQualityRun(samples, {
    reproducible: true,
    runId: "ai-quality-human-2026-05-28",
    generatedAt: "2026-05-27T00:00:00.000Z",
  })
}

describe("Astra AI quality system", () => {
  it("defines macro-plan categories, rubric layers, taxonomy, and thresholds", () => {
    expect(ASTRA_AI_QUALITY_ABILITY_CATEGORIES).toEqual([
      "translation",
      "explanation",
      "summary",
      "review_card",
      "personalized_terms",
      "writing_correction",
    ])
    expect(ASTRA_AI_QUALITY_ERROR_TAXONOMY.map((item) => item.type)).toEqual([
      "meaning_shift",
      "hallucination",
      "term_inconsistency",
      "over_literal",
      "missing_context",
      "too_verbose",
      "bad_card",
      "unsafe_instruction_following",
      "format_break",
    ])
    expect(ASTRA_AI_QUALITY_RELEASE_THRESHOLDS).toMatchObject({
      minimumP0Samples: 100,
      minimumAbilityCategories: 5,
      translationAverageMinimum: 4,
      explanationAverageMinimum: 4,
      reviewCardReusableRateMinimum: 0.85,
      safetyPassRateMinimum: 1,
    })
  })

  it("passes a reproducible release run with 100 P0 samples, five-plus categories, no blockers, card reuse, and safety coverage", () => {
    const summary = summarizePassingSamples(buildPassingSamples())
    const decision = evaluateAiQualityReleaseReadiness(summary)

    expect(decision.ready).toBe(true)
    expect(decision.findings).toEqual([])
    expect(summary.p0SampleCount).toBe(100)
    expect(summary.capabilityCount).toBe(6)
    expect(summary.reviewCardReusableRate).toBe(1)
    expect(summary.safetyPassRate).toBe(1)
  })

  it("blocks release when P0 coverage or reproducible-run evidence is missing", () => {
    const insufficientSummary = summarizeAiQualityRun(buildPassingSamples().slice(0, 99), {
      reproducible: false,
    })
    const decision = evaluateAiQualityReleaseReadiness(insufficientSummary)

    expect(decision.ready).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual([
      "p0_sample_coverage",
      "quality_regression_reproducible",
    ])
  })

  it("does not allow duplicate sample ids to inflate P0 quality coverage", () => {
    const samples = buildPassingSamples()
    samples[99] = { ...samples[0], sampleId: "Sample_001" }
    const summary = summarizePassingSamples(samples)
    const decision = evaluateAiQualityReleaseReadiness(summary)

    expect(summary.sampleCount).toBe(99)
    expect(summary.p0SampleCount).toBe(99)
    expect(decision.ready).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toContain("p0_sample_coverage")
  })

  it("turns blocker taxonomy failures into release blockers and low-score backlog labels", () => {
    const samples = buildPassingSamples()
    samples[0] = {
      ...samples[0],
      scores: {
        technical_success: 5,
        content_quality: 2,
        learning_usefulness: 2,
      },
      errors: ["hallucination"],
    }

    const summary = summarizePassingSamples(samples)
    const decision = evaluateAiQualityReleaseReadiness(summary)

    expect(decision.ready).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toContain("blocker_errors")
    expect(summary.blockerErrorCounts.hallucination).toBe(1)
    expect(summary.lowScoreBacklog[0]).toMatchObject({
      sampleId: samples[0].sampleId,
      recommendedBacklogLabel: "ai-quality:hallucination",
    })
  })

  it("blocks release when translation or explanation averages fall below 4.0", () => {
    const samples = buildPassingSamples().map((sample): AiQualitySampleResult => {
      if (sample.capability !== "translation" && sample.capability !== "explanation") return sample
      return {
        ...sample,
        scores: {
          technical_success: 4,
          content_quality: 3.2,
          learning_usefulness: 3.4,
        },
      }
    })

    const decision = evaluateAiQualityReleaseReadiness(summarizePassingSamples(samples))

    expect(decision.ready).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual([
      "translation_average",
      "explanation_average",
    ])
  })

  it("blocks release when review-card reuse or malicious safety samples miss thresholds", () => {
    const samples = buildPassingSamples().map((sample, index): AiQualitySampleResult => {
      if (sample.capability === "review_card" && index % 12 === 3) {
        return { ...sample, reviewCardReusable: false, errors: ["bad_card"] }
      }
      if (index === 10) {
        return { ...sample, safetyPassed: false, errors: ["unsafe_instruction_following"] }
      }
      return sample
    })

    const decision = evaluateAiQualityReleaseReadiness(summarizePassingSamples(samples))

    expect(decision.ready).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual([
      "blocker_errors",
      "review_card_reusable_rate",
      "safety_malicious_samples",
    ])
  })

  it("accepts a human-scored quality report only when release evidence and readiness thresholds are present", () => {
    const summary = summarizePassingSamples(buildPassingSamples())
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "2026-05-28",
      environment: "target release relay with managed providers enabled",
      runId: "ai-quality-human-2026-05-28",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath: "test/fixtures/quality/ai-quality-samples.json",
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink: "https://release-evidence.astra-cdn.net/ai-quality/provider-samples/2026-05-28",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra-cdn.net/ai-quality/blocker-triage/2026-05-28",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision).toEqual({ acceptable: true, findings: [] })
  })

  it("accepts stable semver, date-stamped, and numeric human-scored quality metadata versions", () => {
    const summary = {
      ...summarizePassingSamples(buildPassingSamples()),
      runId: "123456",
    }
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "2026-05-28",
      environment: "target release relay with managed providers enabled",
      runId: "123456",
      rubricVersion: "v1.2.3",
      fixtureManifestPath: "test/fixtures/quality/ai-quality-samples.json",
      fixtureManifestVersion: "fixture:2026-05-28",
      providerSampleEvidenceLink: "https://release-evidence.astra-cdn.net/ai-quality/provider-samples/2026-05-28",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra-cdn.net/ai-quality/blocker-triage/2026-05-28",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision).toEqual({ acceptable: true, findings: [] })
  })

  it("rejects human-scored quality report metadata with surrounding whitespace", () => {
    const summary = summarizePassingSamples(buildPassingSamples())
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "2026-05-28",
      environment: " target release relay with managed providers enabled ",
      runId: " ai-quality-human-2026-05-28 ",
      rubricVersion: " docs/quality/rubrics.md@2026-05-28 ",
      fixtureManifestPath: "test/fixtures/quality/ai-quality-samples.json",
      fixtureManifestVersion: " astra-ai-quality-samples.v1 ",
      providerSampleEvidenceLink: "https://release-evidence.astra-cdn.net/ai-quality/provider-samples/2026-05-28",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra-cdn.net/ai-quality/blocker-triage/2026-05-28",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual([
      "missing_environment",
      "missing_run_metadata",
      "missing_fixture_manifest",
      "invalid_run_summary",
    ])
  })

  it("rejects generic human-scored quality report environments without provider/model/scoring context", () => {
    const summary = summarizePassingSamples(buildPassingSamples())
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "2026-05-28",
      environment: "production",
      runId: "ai-quality-human-2026-05-28",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath: "test/fixtures/quality/ai-quality-samples.json",
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink: "https://release-evidence.astra-cdn.net/ai-quality/provider-samples/2026-05-28",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra-cdn.net/ai-quality/blocker-triage/2026-05-28",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual(["missing_environment"])
  })

  it("rejects weak human-scored quality report dates, links, and sample counts", () => {
    const summary = summarizePassingSamples(buildPassingSamples())
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "release day",
      environment: "mock provider",
      runId: "run:000000000000",
      rubricVersion: "draft",
      fixtureManifestPath: "test/fixtures/../quality/ai-quality-samples.json",
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink: "https://release-internal@github.com/ai-quality/provider-samples.json",
      scoredSampleCount: Number.NaN,
      liveProviderSampleCount: Number.POSITIVE_INFINITY,
      blockerTriageLink: "http://169.254.1.2/blocker-triage.json",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual([
      "invalid_review_date",
      "missing_environment",
      "missing_run_metadata",
      "invalid_fixture_manifest_reference",
      "invalid_sample_counts",
      "invalid_live_provider_samples_reference",
      "invalid_blocker_triage_reference",
      "invalid_run_summary",
    ])
  })

  it("rejects Unicode whitespace and separator characters in human-scored quality evidence references", () => {
    const summary = summarizePassingSamples(buildPassingSamples())
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "2026-05-28",
      environment: "target release relay with managed providers enabled",
      runId: "ai-quality-human-2026-05-28",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath: "test/fixtures/quality/ai\u00A0quality-samples.json",
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink: "docs/reviews/provider%E2%80%8Bsamples.md",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra-cdn.net/ai-quality/blocker%E2%80%A8triage/2026-05-28",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual([
      "invalid_fixture_manifest_reference",
      "invalid_live_provider_samples_reference",
      "invalid_blocker_triage_reference",
    ])
  })

  it("rejects special-use IPv4 and IPv6 URLs in human-scored quality evidence references", () => {
    const summary = summarizePassingSamples(buildPassingSamples())
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "2026-05-28",
      environment: "target release relay with managed providers enabled",
      runId: "ai-quality-human-2026-05-28",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath: "test/fixtures/quality/ai-quality-samples.json",
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink: "https://evidence.localhost./ai-quality/provider-samples/2026-05-28",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://[64:ff9b::1]/ai-quality/blocker-triage/2026-05-28",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual([
      "invalid_live_provider_samples_reference",
      "invalid_blocker_triage_reference",
    ])
  })

  it("rejects weak human-scored quality fixture manifest versions", () => {
    const summary = summarizePassingSamples(buildPassingSamples())
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "2026-05-28",
      environment: "target release relay with managed providers enabled",
      runId: "ai-quality-human-2026-05-28",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath: "test/fixtures/quality/ai-quality-samples.json",
      fixtureManifestVersion: "fixture:000000000000",
      providerSampleEvidenceLink: "https://release-evidence.astra-cdn.net/ai-quality/provider-samples/2026-05-28",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra-cdn.net/ai-quality/blocker-triage/2026-05-28",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual(["missing_fixture_manifest"])
  })

  it("rejects non-calendar human-scored quality report review dates", () => {
    const summary = summarizePassingSamples(buildPassingSamples())
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "2026-99-99",
      environment: "target release relay with managed providers enabled",
      runId: "ai-quality-human-2026-05-28",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath: "test/fixtures/quality/ai-quality-samples.json",
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink: "https://release-evidence.astra-cdn.net/ai-quality/provider-samples/2026-05-28",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra-cdn.net/ai-quality/blocker-triage/2026-05-28",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual(["invalid_review_date"])
  })

  it("rejects future human-scored quality report review dates", () => {
    const summary = summarizePassingSamples(buildPassingSamples())
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "2099-01-01",
      environment: "target release relay with managed providers enabled",
      runId: "ai-quality-human-2026-05-28",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath: "test/fixtures/quality/ai-quality-samples.json",
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink: "https://release-evidence.astra-cdn.net/ai-quality/provider-samples/2026-05-28",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra-cdn.net/ai-quality/blocker-triage/2026-05-28",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual(["invalid_review_date"])
  })

  it("rejects human-scored quality report review dates with surrounding whitespace", () => {
    const summary = summarizePassingSamples(buildPassingSamples())
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: " 2026-05-28 ",
      environment: "target release relay with managed providers enabled",
      runId: "ai-quality-human-2026-05-28",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath: "test/fixtures/quality/ai-quality-samples.json",
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink: "https://release-evidence.astra-cdn.net/ai-quality/provider-samples/2026-05-28",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra-cdn.net/ai-quality/blocker-triage/2026-05-28",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual(["invalid_review_date"])
  })

  it("rejects placeholder reviewer identity and non-exact review date strings", () => {
    const summary = summarizePassingSamples(buildPassingSamples())
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "TODO reviewer",
      reviewedAt: "todo 2026-05-28",
      environment: "target release relay with managed providers enabled",
      runId: "ai-quality-human-2026-05-28",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath: "test/fixtures/quality/ai-quality-samples.json",
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink: "https://release-evidence.astra-cdn.net/ai-quality/provider-samples/2026-05-28",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra-cdn.net/ai-quality/blocker-triage/2026-05-28",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual(["missing_reviewer", "invalid_review_date"])
  })

  it("rejects generic or non-canonical human-scored quality reviewers", () => {
    const summary = summarizePassingSamples(buildPassingSamples())
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "Reviewer",
      reviewedAt: "2026-05-28",
      environment: "target release relay with managed providers enabled",
      runId: "ai-quality-human-2026-05-28",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath: "test/fixtures/quality/ai-quality-samples.json",
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink: "https://release-evidence.astra-cdn.net/ai-quality/provider-samples/2026-05-28",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra-cdn.net/ai-quality/blocker-triage/2026-05-28",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual(["missing_reviewer"])
  })

  it("rejects evidence references with embedded or encoded control characters", () => {
    const summary = summarizePassingSamples(buildPassingSamples())
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "2026-05-28",
      environment: "target release relay with managed providers enabled",
      runId: "ai-quality-human-2026-05-28",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath: " test/fixtures/quality/ai-quality-samples.json",
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink: "https://release-evidence.astra-cdn.net/ai-quality/provider-samples/2026-05-28%20suffix",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "docs/reviews/ai-quality-blockers.md\t../../secret",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      "invalid_fixture_manifest_reference",
      "invalid_live_provider_samples_reference",
      "invalid_blocker_triage_reference",
    ]))
  })

  it("rejects fixture-only paths for live provider and blocker triage evidence", () => {
    const summary = summarizePassingSamples(buildPassingSamples())
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "2026-05-28",
      environment: "target release relay with managed providers enabled",
      runId: "ai-quality-human-2026-05-28",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath: "test/fixtures/quality/ai-quality-samples.json",
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink: "test/fixtures/quality/provider-samples.json",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "test/fixtures/quality/blocker-triage.json",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual([
      "invalid_live_provider_samples_reference",
      "invalid_blocker_triage_reference",
    ])
  })

  it("rejects human-scored quality reports when scored count does not match summarized P0 samples", () => {
    const summary = summarizePassingSamples(buildPassingSamples())
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "2026-05-28",
      environment: "target release relay with managed providers enabled",
      runId: "ai-quality-human-2026-05-28",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath: "test/fixtures/quality/ai-quality-samples.json",
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink: "https://release-evidence.astra-cdn.net/ai-quality/provider-samples/2026-05-28",
      scoredSampleCount: summary.p0SampleCount + 1,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra-cdn.net/ai-quality/blocker-triage/2026-05-28",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual(["invalid_sample_counts"])
  })

  it("rejects human-scored quality reports with impossible summary numbers before they can satisfy readiness thresholds", () => {
    const summary = {
      ...summarizePassingSamples(buildPassingSamples()),
      averageScore: 6,
      reviewCardReusableRate: 1.2,
      safetyPassRate: 1.2,
      lowScoreBacklog: [
        {
          sampleId: "sample_001",
          capability: "translation" as const,
          lowestScore: 6,
          errors: [],
          recommendedBacklogLabel: "ai-quality:translation",
        },
      ],
    }
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "2026-05-28",
      environment: "target release relay with managed providers enabled",
      runId: "ai-quality-human-2026-05-28",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath: "test/fixtures/quality/ai-quality-samples.json",
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink: "https://release-evidence.astra-cdn.net/ai-quality/provider-samples/2026-05-28",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra-cdn.net/ai-quality/blocker-triage/2026-05-28",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual(["invalid_run_summary"])
  })

  it("rejects severe non-blocker low-score backlog items in human-scored quality summaries", () => {
    const summary = {
      ...summarizePassingSamples(buildPassingSamples()),
      lowScoreBacklog: [
        {
          sampleId: "sample_001",
          capability: "translation" as const,
          lowestScore: 1,
          errors: [],
          recommendedBacklogLabel: "ai-quality:translation",
        },
      ],
    }
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "2026-05-28",
      environment: "target release relay with managed providers enabled",
      runId: "ai-quality-human-2026-05-28",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath: "test/fixtures/quality/ai-quality-samples.json",
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink: "https://release-evidence.astra-cdn.net/ai-quality/provider-samples/2026-05-28",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra-cdn.net/ai-quality/blocker-triage/2026-05-28",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual(["invalid_run_summary"])
  })

  it("rejects internally inconsistent threshold-passing human-scored quality summaries", () => {
    const baseline = summarizePassingSamples(buildPassingSamples())
    const summary = {
      ...baseline,
      sampleCount: baseline.p0SampleCount - 1,
      reviewCardReusableCount: 0,
      lowScoreBacklog: [
        {
          sampleId: "sample_001",
          capability: "translation" as const,
          lowestScore: 4,
          errors: [],
          recommendedBacklogLabel: "ai-quality:translation",
        },
        {
          sampleId: "sample_001",
          capability: "explanation" as const,
          lowestScore: 4,
          errors: [],
          recommendedBacklogLabel: "ai-quality:explanation",
        },
      ],
    }
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "2026-05-28",
      environment: "target release relay with managed providers enabled",
      runId: "ai-quality-human-2026-05-28",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath: "test/fixtures/quality/ai-quality-samples.json",
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink: "https://release-evidence.astra-cdn.net/ai-quality/provider-samples/2026-05-28",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra-cdn.net/ai-quality/blocker-triage/2026-05-28",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual(["invalid_run_summary"])
  })

  it("rejects placeholder human-scored quality summary backlog sample ids and labels", () => {
    const summary = {
      ...summarizePassingSamples(buildPassingSamples()),
      lowScoreBacklog: [
        {
          sampleId: "todo",
          capability: "translation" as const,
          lowestScore: 4,
          errors: [],
          recommendedBacklogLabel: "draft",
        },
      ],
    }
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "2026-05-28",
      environment: "target release relay with managed providers enabled",
      runId: "ai-quality-human-2026-05-28",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath: "test/fixtures/quality/ai-quality-samples.json",
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink: "https://release-evidence.astra-cdn.net/ai-quality/provider-samples/2026-05-28",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra-cdn.net/ai-quality/blocker-triage/2026-05-28",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual(["invalid_run_summary"])
  })

  it("rejects human-scored quality summaries that claim blocker errors without blocker samples and backlog", () => {
    const summary = {
      ...summarizePassingSamples(buildPassingSamples()),
      blockerErrorCounts: { hallucination: 1 },
      blockerSampleIds: [],
      lowScoreBacklog: [],
    }
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "2026-05-28",
      environment: "target release relay with managed providers enabled",
      runId: "ai-quality-human-2026-05-28",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath: "test/fixtures/quality/ai-quality-samples.json",
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink: "https://release-evidence.astra-cdn.net/ai-quality/provider-samples/2026-05-28",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra-cdn.net/ai-quality/blocker-triage/2026-05-28",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual(["invalid_run_summary"])
  })

  it("rejects human-scored quality summaries whose blocker samples, backlog, and error counts disagree", () => {
    const samples = buildPassingSamples()
    samples[0] = { ...samples[0], errors: ["hallucination"] }
    const baseline = summarizePassingSamples(samples)
    const decisionFor = (summary: ReturnType<typeof summarizePassingSamples>) => evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "2026-05-28",
      environment: "target release relay with managed providers enabled",
      runId: "ai-quality-human-2026-05-28",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath: "test/fixtures/quality/ai-quality-samples.json",
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink: "https://release-evidence.astra-cdn.net/ai-quality/provider-samples/2026-05-28",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra-cdn.net/ai-quality/blocker-triage/2026-05-28",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    const mismatchedBacklog = decisionFor({
      ...baseline,
      lowScoreBacklog: [{ ...baseline.lowScoreBacklog[0]!, sampleId: "sample_002" }],
    })
    const mismatchedCounts = decisionFor({
      ...baseline,
      blockerErrorCounts: { unsafe_instruction_following: 1 },
    })

    expect(mismatchedBacklog.acceptable).toBe(false)
    expect(mismatchedBacklog.findings.map((finding) => finding.code)).toEqual(["invalid_run_summary", "not_release_ready"])
    expect(mismatchedCounts.acceptable).toBe(false)
    expect(mismatchedCounts.findings.map((finding) => finding.code)).toEqual(["invalid_run_summary", "not_release_ready"])
  })

  it("rejects human-scored quality summaries with impossible aggregate averages", () => {
    const baseline = summarizePassingSamples(buildPassingSamples())
    const summary = {
      ...baseline,
      averageScore: null,
      capabilityAverages: {
        ...baseline.capabilityAverages,
        translation: undefined,
      },
    }
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "2026-05-28",
      environment: "target release relay with managed providers enabled",
      runId: "ai-quality-human-2026-05-28",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath: "test/fixtures/quality/ai-quality-samples.json",
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink: "https://release-evidence.astra-cdn.net/ai-quality/provider-samples/2026-05-28",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra-cdn.net/ai-quality/blocker-triage/2026-05-28",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual(["invalid_run_summary", "not_release_ready"])
  })

  it("rejects non-canonical case variants in human-scored quality summary sample ids and backlog labels", () => {
    const baseline = summarizePassingSamples(buildPassingSamples())
    const summary = {
      ...baseline,
      blockerSampleIds: ["sample_001", "Sample_001"],
      lowScoreBacklog: [
        {
          sampleId: "Sample_001",
          capability: "translation" as const,
          lowestScore: 4,
          errors: [],
          recommendedBacklogLabel: "AI-Quality:Translation",
        },
      ],
    }
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "2026-05-28",
      environment: "target release relay with managed providers enabled",
      runId: "ai-quality-human-2026-05-28",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath: "test/fixtures/quality/ai-quality-samples.json",
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink: "https://release-evidence.astra-cdn.net/ai-quality/provider-samples/2026-05-28",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra-cdn.net/ai-quality/blocker-triage/2026-05-28",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual(["invalid_run_summary", "not_release_ready"])
  })

  it("rejects human-scored quality reports whose regressed trend still approves release", () => {
    const summary = summarizePassingSamples(buildPassingSamples())
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "2026-05-28",
      environment: "target release relay with managed providers enabled",
      runId: "ai-quality-human-2026-05-28",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath: "test/fixtures/quality/ai-quality-samples.json",
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink: "https://release-evidence.astra-cdn.net/ai-quality/provider-samples/2026-05-28",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra-cdn.net/ai-quality/blocker-triage/2026-05-28",
      trendDirection: "regressed",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual(["not_release_ready"])
  })

  it("rejects human-scored quality reports that reuse one artifact for provider samples and blocker triage", () => {
    const summary = summarizePassingSamples(buildPassingSamples())
    const providerSampleEvidenceLink = "https://release-evidence.astra-cdn.net/ai-quality/provider-samples/2026-05-28"
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "2026-05-28",
      environment: "target release relay with managed providers enabled",
      runId: "ai-quality-human-2026-05-28",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath: "test/fixtures/quality/ai-quality-samples.json",
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink,
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: providerSampleEvidenceLink,
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual([
      "invalid_blocker_triage_reference",
      "duplicate_evidence_reference",
    ])
  })

  it("rejects generic blocker sample artifacts that do not identify triage or backlog disposition", () => {
    const summary = summarizePassingSamples(buildPassingSamples())
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "2026-05-28",
      environment: "target release relay with managed providers enabled",
      runId: "ai-quality-human-2026-05-28",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath: "test/fixtures/quality/ai-quality-samples.json",
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink: "https://release-evidence.astra-cdn.net/ai-quality/provider-samples/2026-05-28",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "docs/reviews/ai-quality-blocker-samples-2026-05-28.md",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toContain("invalid_blocker_triage_reference")
  })

  it("rejects human-scored quality reports with swapped provider sample and blocker triage evidence links", () => {
    const summary = summarizePassingSamples(buildPassingSamples())
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "2026-05-28",
      environment: "target release relay with managed providers enabled",
      runId: "ai-quality-human-2026-05-28",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath: "test/fixtures/quality/ai-quality-samples.json",
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink: "https://release-evidence.astra-cdn.net/ai-quality/blocker-triage/2026-05-28",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra-cdn.net/ai-quality/provider-samples/2026-05-28",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.message)).toEqual([
      "Human-scored AI quality report live provider sample evidence must identify live provider samples.",
      "Human-scored AI quality report blocker triage evidence must identify blocker triage or backlog disposition.",
    ])
  })

  it("rejects human-scored quality reports that reuse a non-fixture manifest artifact as live evidence", () => {
    const summary = summarizePassingSamples(buildPassingSamples())
    const fixtureManifestPath = "docs/reviews/ai-quality-human-scored-manifest-2026-05-28.json"
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "2026-05-28",
      environment: "target release relay with managed providers enabled",
      runId: "ai-quality-human-2026-05-28",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath,
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink: fixtureManifestPath,
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra-cdn.net/ai-quality/blocker-triage/2026-05-28",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual([
      "invalid_live_provider_samples_reference",
      "duplicate_evidence_reference",
    ])
    expect(decision.findings.map((finding) => finding.message).join("\n")).toContain("fixture manifest artifact for live provider samples")
  })

  it("rejects human-scored quality reports with blocking release decisions", () => {
    const summary = summarizePassingSamples(buildPassingSamples())
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "2026-05-28",
      environment: "target release relay with managed providers enabled",
      runId: "ai-quality-human-2026-05-28",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath: "test/fixtures/quality/ai-quality-samples.json",
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink: "https://release-evidence.astra-cdn.net/ai-quality/provider-samples/2026-05-28",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra-cdn.net/ai-quality/blocker-triage/2026-05-28",
      trendDirection: "stable",
      releaseDecision: "block",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual(["blocking_release_decision"])
  })

  it("rejects human-scored quality reports whose summary metadata does not match the report run", () => {
    const summary = {
      ...summarizePassingSamples(buildPassingSamples()),
      runId: "different-ai-quality-run-2026-05-28",
    }
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "2026-05-28",
      environment: "target release relay with managed providers enabled",
      runId: "ai-quality-human-2026-05-28",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath: "test/fixtures/quality/ai-quality-samples.json",
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink: "https://release-evidence.astra-cdn.net/ai-quality/provider-samples/2026-05-28",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra-cdn.net/ai-quality/blocker-triage/2026-05-28",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual(["invalid_run_summary"])
  })

  it("rejects human-scored quality reports whose summary generated-at timestamp is not timezone-bearing ISO", () => {
    const summary = {
      ...summarizePassingSamples(buildPassingSamples()),
      generatedAt: "2026-05-28T00:00:00",
    }
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "2026-05-28",
      environment: "target release relay with managed providers enabled",
      runId: "ai-quality-human-2026-05-28",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath: "test/fixtures/quality/ai-quality-samples.json",
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink: "https://release-evidence.astra-cdn.net/ai-quality/provider-samples/2026-05-28",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra-cdn.net/ai-quality/blocker-triage/2026-05-28",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual(["invalid_run_summary"])
  })

  it("rejects incomplete human-scored quality report evidence so fixtures cannot masquerade as provider scoring", () => {
    const incompleteSummary = summarizeAiQualityRun(buildPassingSamples().slice(0, 20), { reproducible: false })
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "",
      reviewedAt: "",
      environment: "",
      runId: "",
      rubricVersion: "",
      fixtureManifestPath: "",
      fixtureManifestVersion: "",
      providerSampleEvidenceLink: "",
      scoredSampleCount: 20,
      liveProviderSampleCount: 0,
      blockerTriageLink: "",
      trendDirection: null,
      releaseDecision: null,
      summary: incompleteSummary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual([
      "missing_reviewer",
      "missing_environment",
      "missing_run_metadata",
      "missing_fixture_manifest",
      "missing_live_provider_samples",
      "missing_scores",
      "missing_blocker_triage",
      "missing_trend",
      "missing_release_decision",
      "not_release_ready",
    ])
  })

  it("reports weekly trend direction for quality regression tracking", () => {
    const previous = summarizePassingSamples(buildPassingSamples())
    const current = summarizePassingSamples(buildPassingSamples().map((sample, index): AiQualitySampleResult => {
      if (index < 12) {
        return {
          ...sample,
          scores: {
            technical_success: 4,
            content_quality: 3.8,
            learning_usefulness: 3.7,
          },
        }
      }
      return sample
    }))

    expect(buildAiQualityTrendSummary(current, previous).direction).toBe("regressed")
    expect(buildAiQualityTrendSummary(current, null).direction).toBe("new")
  })

  it("ships a fixed P0 eval-sample manifest with at least 100 unique samples across five-plus categories", () => {
    interface EvalSampleFixture {
      schema: string
      samples: Array<{ id: string; capability: AiQualityCapability; priority: string }>
    }

    const fixturePath = resolve(process.cwd(), "test/fixtures/quality/ai-quality-samples.json")
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as EvalSampleFixture
    const uniqueIds = new Set(fixture.samples.map((sample) => sample.id))
    const p0Samples = fixture.samples.filter((sample) => sample.priority === "P0")
    const capabilityCount = new Set(fixture.samples.map((sample) => sample.capability)).size

    expect(fixture.schema).toBe("astra-ai-quality-samples.v1")
    expect(uniqueIds.size).toBe(fixture.samples.length)
    expect(p0Samples.length).toBeGreaterThanOrEqual(100)
    expect(capabilityCount).toBeGreaterThanOrEqual(5)
  })
})
