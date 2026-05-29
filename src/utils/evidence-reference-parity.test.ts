import { describe, expect, it } from "vitest"

import { evidenceReferenceDuplicateIdentity, isPublicHttpsEvidenceUrl, isRepoArtifactPathReference } from "./evidence-reference"
import type { AiQualityCapability, AiQualitySampleResult } from "./ai-quality-system"
import {
  ASTRA_AI_QUALITY_ABILITY_CATEGORIES,
  ASTRA_AI_QUALITY_RELEASE_THRESHOLDS,
  evaluateAiQualityHumanScoredReportEvidence,
  summarizeAiQualityRun,
} from "./ai-quality-system"
import type { AstraMacroOperationalEvidenceCompletionPacketRow } from "./macro-operational-evidence"
import {
  ASTRA_MACRO_OPERATIONAL_EVIDENCE,
  evaluateAstraMacroOperationalEvidenceCompletionPacket,
} from "./macro-operational-evidence"
import type { AstraProductionMetricExportEvidenceRow } from "./product-metrics"
import {
  ASTRA_PRODUCTION_METRIC_EXPORT_REQUIREMENTS,
  evaluateAstraProductionMetricsExportPacket,
  getAstraProductMetricsByCategory,
} from "./product-metrics"

function buildPassingSamples(): AiQualitySampleResult[] {
  return Array.from({ length: ASTRA_AI_QUALITY_RELEASE_THRESHOLDS.minimumP0Samples }, (_, index) => {
    const capability = ASTRA_AI_QUALITY_ABILITY_CATEGORIES[index % ASTRA_AI_QUALITY_ABILITY_CATEGORIES.length] as AiQualityCapability
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

function passingAiSummary() {
  return summarizeAiQualityRun(buildPassingSamples(), {
    reproducible: true,
    runId: "ai-quality-human-2026-05-28",
    generatedAt: "2026-05-27T00:00:00.000Z",
  })
}

function macroRowsWithEvidenceLink(evidenceLink: string): AstraMacroOperationalEvidenceCompletionPacketRow[] {
  return ASTRA_MACRO_OPERATIONAL_EVIDENCE.map((item, index) => ({
    areaId: item.id,
    ownerDate: "release-owner@astra.ai — 2026-05-28",
    environment: "target release candidate / production evidence packet",
    evidenceLink: index === 0 ? evidenceLink : `https://release-evidence.astra-cdn.net/operational-evidence/${item.id}.md`,
    requirementEvidence: item.requiredBeforeStrongerClaim.join(" "),
    verdict: "proved",
  }))
}

const productionMetricDigestByCategory = {
  activation: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  understanding: "123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0",
  learning: "23456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01",
  membership: "3456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef012",
} as const

function productionMetricRowsWithEvidenceLink(evidenceLink: string): AstraProductionMetricExportEvidenceRow[] {
  return ASTRA_PRODUCTION_METRIC_EXPORT_REQUIREMENTS.map((requirement, index) => ({
    category: requirement.category,
    dateRange: "2026-05-28..2026-05-28",
    cohortDefinition: "target RC cohort for current commit",
    dashboardOrQuerySource: `warehouse.${requirement.category}_metrics_v1`,
    exportId: `metrics-${requirement.category}-2026-05-28`,
    exportedAt: "2026-05-28T00:00:00.000Z",
    exportDigest: `sha256:${productionMetricDigestByCategory[requirement.category]}`,
    queryVersion: "astra-production-metrics-query.v1",
    metricIds: getAstraProductMetricsByCategory(requirement.category).map((metric) => metric.id),
    evidenceLink: index === 0 ? evidenceLink : `https://release-evidence.astra-cdn.net/metrics/${requirement.category}.csv`,
    ownerDate: "metrics-owner@astra.ai — 2026-05-28",
    privacyReviewLink: `https://release-evidence.astra-cdn.net/metrics/${requirement.category}-privacy-review`,
  }))
}

function evaluateAiEvidenceReference(providerSampleEvidenceLink: string) {
  const summary = passingAiSummary()
  return evaluateAiQualityHumanScoredReportEvidence({
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
    blockerTriageLink: "https://release-evidence.astra-cdn.net/ai-quality/blocker-triage/2026-05-28",
    trendDirection: "stable",
    releaseDecision: "approve_with_downgrade",
    summary,
  })
}

const acceptedRepoArtifactPaths = [
  "docs/reviews/release-evidence.md",
  "data/release-artifacts/quality-gate-results/manifest.json",
  "artifacts/release/evidence.json",
  "test-results/release/proof.json",
  "playwright-report/release/index.html",
]

const acceptedFixtureRepoArtifactPaths = [
  ...acceptedRepoArtifactPaths,
  "test/fixtures/quality/ai-quality-samples.json",
]

const rejectedRepoArtifactPaths = [
  "docs/reviews/sample-evidence.md",
  "docs/reviews/%73ample-evidence.md",
  "docs/reviews/sample-proof.md",
  "docs/reviews/fake-report.md",
  "docs/reviews/dummy-artifact.md",
  "docs/reviews/mock-evidence.md",
  "docs/reviews/draft-report.md",
  "docs/reviews/todo.md",
  "docs/reviews/pending-artifact.md",
  "docs/reviews/latest-evidence.md",
  "docs/reviews/dev-proof.md",
  "docs/reviews/local-report.md",
  "test/fixtures/quality/ai-quality-samples.json",
  "/docs/reviews/release-evidence.md",
  "docs//reviews/release-evidence.md",
  "docs/reviews/",
  "docs/reviews/../release-evidence.md",
  "docs/.hidden/release-evidence.md",
  "docs/reviews/.release-evidence.md",
  "docs/reviews/release evidence.md",
  "docs/reviews/release\u00A0evidence.md",
  "docs/reviews/reléase-evidence.md",
  "docs/reviews/release%2Devidence.md",
  "docs/reviews/release%2eevidence.md",
  "docs/reviews/release%2520evidence.md",
  "docs/reviews/%252e%252e/release-evidence.md",
  "docs/reviews/release%2fevidence.md",
  "docs/reviews/release%3fevidence.md",
  "docs/reviews/release%23evidence.md",
  "docs\\reviews\\release-evidence.md",
  "docs/reviews/release-evidence.md?download=1",
  "docs/reviews/release-evidence.md#section",
  "src/utils/evidence-reference.ts",
]

const acceptedEvidenceReferences = [
  "docs/reviews/activation-provider-samples-release-evidence.md",
  "https://release-evidence.astra-cdn.net/activation-provider-samples-evidence.md",
  "HTTPS://release-evidence.astra-cdn.net/activation-provider-samples-evidence.md",
  "https://[100:1::1]/activation-provider-samples-evidence.md",
  "https://[64:ff9b:2::1]/activation-provider-samples-evidence.md",
]

const acceptedPublicHttpsUrls = [
  "https://github.com/astra-release/evidence.md",
  "https://release-evidence.astra-cdn.net/evidence.md?X-Amz-Credential=release%2F20260529%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Signature=abcdef123456",
  "HTTPS://github.com/astra-release/evidence.md",
  "https://8.8.8.8/evidence.md",
  "https://[::ffff:8.8.8.8]/evidence.md",
  "https://[::ffff:808:808]/evidence.md",
  "https://[100:1::1]/evidence.md",
  "https://[64:ff9b:2::1]/evidence.md",
]

const rejectedPublicHttpsUrls = [
  "https://release-evidence.astra-cdn.net/artifacts%2frelease-evidence.md",
  "https://release-evidence.astra-cdn.net/sample-evidence.md",
  "https://release-evidence.astra-cdn.net/%73ample-evidence.md",
  "https://release-evidence.astra-cdn.net/sample-proof.md",
  "https://release-evidence.astra-cdn.net/fake-report.md",
  "https://release-evidence.astra-cdn.net/dummy-artifact.md",
  "https://release-evidence.astra-cdn.net/mock-evidence.md",
  "https://release-evidence.astra-cdn.net/draft-report.md",
  "https://release-evidence.astra-cdn.net/todo.md",
  "https://release-evidence.astra-cdn.net/pending-artifact.md",
  "https://release-evidence.astra-cdn.net/latest-evidence.md",
  "https://release-evidence.astra-cdn.net/dev-proof.md",
  "https://release-evidence.astra-cdn.net/local-report.md",
  "https://release-évidence.astra-cdn.net/evidence.md",
  "https://release-evidence.astra-cdn.net/évidence.md",
  "https://release-evidence.astra-cdn.net/a/../evidence.md",
  "https://release-evidence.astra-cdn.net/./evidence.md",
  "https://release-evidence.astra-cdn.net/a/%2e%2e/evidence.md",
  "https://release-evidence.astra-cdn.net/%2e%2e/evidence.md",
  "https://release-evidence.astra-cdn.net/a/%252e%252e/evidence.md",
  "https://release-evidence.astra-cdn.net/a\\..\\evidence.md",
  "https://release-evidence.astra-cdn.net/a\\evidence.md",
  "https://release-evidence.astra-cdn.net/release%2520evidence.md",
  "https://0.1.2.3/evidence.md",
  "https://10.0.0.1/evidence.md",
  "https://127.0.0.1/evidence.md",
  "https://169.254.1.1/evidence.md",
  "https://172.16.0.1/evidence.md",
  "https://172.31.255.255/evidence.md",
  "https://192.0.0.9/evidence.md",
  "https://192.168.1.1/evidence.md",
  "https://198.51.100.1/evidence.md",
  "https://203.0.113.1/evidence.md",
  "https://224.0.0.1/evidence.md",
  "https://240.0.0.1/evidence.md",
  "https://255.255.255.255/evidence.md",
  "https://LOCALHOST../evidence.md",
  "https://evidence.LOCALHOST../evidence.md",
  "https://release-evidence..astra-cdn.net/evidence.md",
  "https://-release-evidence.astra-cdn.net/evidence.md",
  "https://release-evidence-.astra-cdn.net/evidence.md",
  "https://release_evidence.astra-cdn.net/evidence.md",
  "https://intranet/evidence.md",
  "https://local/evidence.md",
  "https://printer.local/evidence.md",
  "https://test/evidence.md",
  "https://release.test/evidence.md",
  "https://invalid/evidence.md",
  "https://release.invalid/evidence.md",
  "https://internal/evidence.md",
  "https://release-evidence.astra.internal/evidence.md",
  "https://release-evidence.onion/evidence.md",
  "https://release.home.arpa/evidence.md",
  "https://example.com/evidence.md",
  "https://sub.example.com/evidence.md",
  "https://example.net/evidence.md",
  "https://example.org/evidence.md",
  "https://release.example/evidence.md",
  "https://[::ffff:127.0.0.1]/evidence.md",
  "https://[::ffff:7f00:1]/evidence.md",
  "https://[0:0:0:0:0:ffff:7f00:1]/evidence.md",
  "https://[::ffff:192.168.0.1]/evidence.md",
  "https://[::ffff:c0a8:1]/evidence.md",
  "https://[::ffff:198.51.100.1]/evidence.md",
  "https://[::ffff:c633:6401]/evidence.md",
  "https://2130706433/evidence.md",
  "https://0177.0.0.1/evidence.md",
  "https://0x7f.0.0.1/evidence.md",
  "https://127.1/evidence.md",
  "https://0300.0250.0001.0001/evidence.md",
  "https://0xc0.0xa8.0x1.0x1/evidence.md",
  "https://134744072/evidence.md",
  "https://000010.000010.000010.000010/evidence.md",
  "https://0x8.0x8.0x8.0x8/evidence.md",
]

const rejectedEvidenceReferences = [
  "docs/reviews/sample-evidence.md",
  "docs/reviews/fake-report.md",
  "docs/reviews/release%2Devidence.md",
  "https://release-evidence.astra-cdn.net/sample-evidence.md",
  "https://release-evidence.astra-cdn.net/latest-evidence.md",
  "https://release-evidence.astra-cdn.net/mock-evidence.md",
  "https://release-evidence.astra-cdn.net/draft-report.md",
  "https://release-evidence.astra-cdn.net/todo.md",
  "https://release-evidence.astra-cdn.net/a/../evidence.md",
  "https://release-evidence.astra-cdn.net/./evidence.md",
  "https://release-evidence.astra-cdn.net/a/%2e%2e/evidence.md",
  "https://release-evidence.astra-cdn.net/%2e%2e/evidence.md",
  "https://release-evidence.astra-cdn.net/a\\..\\evidence.md",
  "https://release-evidence.astra-cdn.net/a\\evidence.md",
  "https://release-évidence.astra-cdn.net/evidence.md",
  "https://release-evidence.astra-cdn.net/évidence.md",
  "https://release-evidence.astra-cdn.net/a/%252e%252e/evidence.md",
  "https://release-evidence.astra-cdn.net/release%2520evidence.md",
  "test/fixtures/quality/provider-samples.json",
  "test/fixtures/quality/blocker-triage.json",
  " docs/reviews/release-evidence.md",
  "docs/reviews/release%C2%A0evidence.md",
  "docs/reviews/release%2fevidence.md",
  "http://release-evidence.astra-cdn.net/evidence.md",
  "https://localhost./evidence.md",
  "https://100.64.0.1/evidence.md",
  "https://192.88.99.1/evidence.md",
  "https://release-evidence.onion/evidence.md",
  "https://release.home.arpa/evidence.md",
  "https://[64:ff9b::1]/evidence.md",
  "https://[64:ff9b:1::1]/evidence.md",
  "https://[2001:db8::1]/evidence.md",
  "https://[::ffff:100.64.0.1]/evidence.md",
]

describe("Astra evidence reference validator parity", () => {
  it.each(acceptedRepoArtifactPaths)("accepts canonical repo artifact path %s", (path) => {
    expect(isRepoArtifactPathReference(path)).toBe(true)
  })

  it.each(acceptedFixtureRepoArtifactPaths)("accepts fixture repo artifact path only when enabled %s", (path) => {
    expect(isRepoArtifactPathReference(path, { allowTestFixtures: true })).toBe(true)
  })

  it.each(rejectedRepoArtifactPaths)("rejects unsafe or out-of-scope repo artifact path %s", (path) => {
    expect(isRepoArtifactPathReference(path)).toBe(false)
  })

  it.each(acceptedPublicHttpsUrls)("accepts public HTTPS evidence URL host %s", (url) => {
    expect(isPublicHttpsEvidenceUrl(url)).toBe(true)
  })

  it.each(rejectedPublicHttpsUrls)("rejects non-public HTTPS evidence URL host %s", (url) => {
    expect(isPublicHttpsEvidenceUrl(url)).toBe(false)
  })

  it("normalizes URL scheme and host casing for duplicate evidence identity checks while ignoring query and fragment variants", () => {
    expect(evidenceReferenceDuplicateIdentity("HTTPS://RELEASE-EVIDENCE.ASTRA-CDN.NET/evidence.md?run=1#summary")).toBe(
      "https://release-evidence.astra-cdn.net/evidence.md",
    )
    expect(evidenceReferenceDuplicateIdentity("https://release-evidence.astra-cdn.net/%65vidence%2Dpack?run=%31#%73ummary")).toBe(
      "https://release-evidence.astra-cdn.net/evidence-pack",
    )
    expect(evidenceReferenceDuplicateIdentity("https://release-evidence.astra-cdn.net/evidence%3Apack?signature=abc")).toBe(
      "https://release-evidence.astra-cdn.net/evidence%3Apack",
    )
    expect(evidenceReferenceDuplicateIdentity("https://release-evidence.astra-cdn.net:443/evidence.md?signature=abc")).toBe(
      "https://release-evidence.astra-cdn.net/evidence.md",
    )
    expect(evidenceReferenceDuplicateIdentity("https://release-evidence.astra-cdn.net:8443/evidence.md?signature=abc")).toBe(
      "https://release-evidence.astra-cdn.net:8443/evidence.md",
    )
    expect(evidenceReferenceDuplicateIdentity("docs/reviews/Release-Evidence.md")).toBe("docs/reviews/Release-Evidence.md")
  })

  it("collapses current-repo GitHub blob and raw evidence URLs to repo artifact path duplicate identities", () => {
    const repoArtifactPath = "docs/reviews/release-evidence.md"

    expect(evidenceReferenceDuplicateIdentity(repoArtifactPath)).toBe(repoArtifactPath)
    expect(evidenceReferenceDuplicateIdentity("https://github.com/astra-release/Astra/blob/main/docs/reviews/release-evidence.md?plain=1#L10")).toBe(repoArtifactPath)
    expect(evidenceReferenceDuplicateIdentity("https://github.com/astra-release/Astra/raw/main/docs/reviews/release-evidence.md")).toBe(repoArtifactPath)
    expect(evidenceReferenceDuplicateIdentity("https://raw.githubusercontent.com/astra-release/Astra/main/docs/reviews/release-evidence.md")).toBe(repoArtifactPath)
    expect(evidenceReferenceDuplicateIdentity("https://github.com/astra-release/other/blob/main/docs/reviews/release-evidence.md")).toBe(
      "https://github.com/astra-release/other/blob/main/docs/reviews/release-evidence.md",
    )
  })

  it.each(acceptedEvidenceReferences)("accepts public/canonical evidence reference %s across release evidence evaluators", (evidenceReference) => {
    expect(evaluateAstraMacroOperationalEvidenceCompletionPacket(macroRowsWithEvidenceLink(evidenceReference))).toEqual({ complete: true, findings: [] })
    expect(evaluateAiEvidenceReference(evidenceReference)).toEqual({ acceptable: true, findings: [] })
    expect(evaluateAstraProductionMetricsExportPacket(productionMetricRowsWithEvidenceLink(evidenceReference))).toEqual({ acceptable: true, findings: [] })
  })

  it.each(rejectedEvidenceReferences)("rejects unsafe evidence reference %s across release evidence evaluators", (evidenceReference) => {
    expect(evaluateAstraMacroOperationalEvidenceCompletionPacket(macroRowsWithEvidenceLink(evidenceReference)).complete).toBe(false)
    expect(evaluateAiEvidenceReference(evidenceReference).acceptable).toBe(false)
    expect(evaluateAstraProductionMetricsExportPacket(productionMetricRowsWithEvidenceLink(evidenceReference)).acceptable).toBe(false)
  })
})
