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
    runId: "quality-2026-05-27-weekly",
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
      providerSampleEvidenceLink: "https://release-evidence.astra.internal/ai-quality/provider-samples/2026-05-28",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra.internal/ai-quality/blocker-triage/2026-05-28",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision).toEqual({ acceptable: true, findings: [] })
  })

  it("rejects weak human-scored quality report dates, links, and sample counts", () => {
    const summary = summarizePassingSamples(buildPassingSamples())
    const decision = evaluateAiQualityHumanScoredReportEvidence({
      reviewer: "quality-owner@example.test",
      reviewedAt: "release day",
      environment: "target release relay with managed providers enabled",
      runId: "todo-run",
      rubricVersion: "docs/quality/rubrics.md@2026-05-28",
      fixtureManifestPath: "test/fixtures/../quality/ai-quality-samples.json",
      fixtureManifestVersion: "astra-ai-quality-samples.v1",
      providerSampleEvidenceLink: "docs/reviews/ai-quality/provider-samples.json?local=true",
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
      "missing_run_metadata",
      "invalid_fixture_manifest_reference",
      "invalid_sample_counts",
      "invalid_live_provider_samples_reference",
      "invalid_blocker_triage_reference",
    ])
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
      providerSampleEvidenceLink: "https://release-evidence.astra.internal/ai-quality/provider-samples/2026-05-28",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra.internal/ai-quality/blocker-triage/2026-05-28",
      trendDirection: "stable",
      releaseDecision: "approve_with_downgrade",
      summary,
    })

    expect(decision.acceptable).toBe(false)
    expect(decision.findings.map((finding) => finding.code)).toEqual(["invalid_review_date"])
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
      providerSampleEvidenceLink: "https://release-evidence.astra.internal/ai-quality/provider-samples/2026-05-28",
      scoredSampleCount: summary.p0SampleCount + 1,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra.internal/ai-quality/blocker-triage/2026-05-28",
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
      providerSampleEvidenceLink: "https://release-evidence.astra.internal/ai-quality/provider-samples/2026-05-28",
      scoredSampleCount: summary.p0SampleCount,
      liveProviderSampleCount: 12,
      blockerTriageLink: "https://release-evidence.astra.internal/ai-quality/blocker-triage/2026-05-28",
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
