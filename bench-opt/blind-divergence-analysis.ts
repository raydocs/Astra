/**
 * Blind Divergence Analysis Module
 *
 * Analyzes which scoring dimensions produce the most blind/visible divergence
 * and why, enabling targeted improvements to self-evaluation reliability.
 */

import type { BlindEvaluatorResult, BlindVsSelfComparison } from "./blind-evaluator.ts"
import type { BenchOptEvaluatorArtifact } from "./evaluator.ts"
import type { DimensionScore } from "./composite-scorer.ts"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DivergenceAnalysis {
  overallDivergence: number
  perDimension: Array<{
    dimensionId: string
    selfScore: number
    blindScore: number
    delta: number
    direction: "over-claiming" | "under-claiming" | "aligned"
    evidenceStrength: "strong" | "moderate" | "weak"
    recommendation: string
  }>
  mostDivergent: string   // dimension ID
  leastDivergent: string
  overClaimingDimensions: string[]
  underClaimingDimensions: string[]
  recommendations: string[]
}

export interface DivergenceReport {
  analyses: DivergenceAnalysis[]
  aggregate: {
    avgOverallDivergence: number
    dimensionRanking: Array<{ id: string; avgDelta: number; direction: string }>
    topRecommendations: string[]
    evidenceCoverageByDimension: Record<string, number>
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Delta below this value is considered "aligned". */
const ALIGNED_THRESHOLD = 5

/** Delta above this value is flagged as notable divergence. */
const NOTABLE_DIVERGENCE_THRESHOLD = 15

// ---------------------------------------------------------------------------
// Per-dimension recommendation templates
// ---------------------------------------------------------------------------

function recommendationForDimension(
  dimensionId: string,
  direction: "over-claiming" | "under-claiming" | "aligned",
  delta: number,
): string {
  if (direction === "aligned") {
    return `${dimensionId}: Self-evaluation aligns well with blind evaluation (delta: ${delta}). No action needed.`
  }

  const severity = delta > NOTABLE_DIVERGENCE_THRESHOLD ? "significant" : "moderate"

  const templates: Record<string, Record<"over-claiming" | "under-claiming", string>> = {
    functionality: {
      "over-claiming":
        `Functionality is ${severity}ly over-claimed (delta: ${delta}). ` +
        `The self-evaluator may be crediting partial implementations as complete. ` +
        `Tighten pass criteria for build/test checks.`,
      "under-claiming":
        `Functionality is ${severity}ly under-claimed (delta: ${delta}). ` +
        `The self-evaluator may be penalizing minor issues too harshly. ` +
        `Consider weighting live scenario results more heavily in self-eval.`,
    },
    productDepth: {
      "over-claiming":
        `Product Depth is ${severity}ly over-claimed (delta: ${delta}). ` +
        `The self-evaluator may be inflating depth from planning artifacts rather than actual implementation. ` +
        `Ground depth scoring in measurable code diff and test coverage signals.`,
      "under-claiming":
        `Product Depth is ${severity}ly under-claimed (delta: ${delta}). ` +
        `The self-evaluator may not be crediting incremental depth improvements. ` +
        `Ensure multi-file changes and broad test suites are recognized.`,
    },
    uxDesign: {
      "over-claiming":
        `UX Design is ${severity}ly over-claimed (delta: ${delta}). ` +
        `Self-descriptions of UX quality may not match observable user-facing evidence. ` +
        `Require screenshot or DOM snapshot evidence for UX claims.`,
      "under-claiming":
        `UX Design is ${severity}ly under-claimed (delta: ${delta}). ` +
        `Live scenario scores suggest better UX than the self-evaluator recognizes. ` +
        `Incorporate live scenario average scores into self-eval UX dimension.`,
    },
    codeQuality: {
      "over-claiming":
        `Code Quality is ${severity}ly over-claimed (delta: ${delta}). ` +
        `Self-eval may be assuming quality from planner intent rather than build/test evidence. ` +
        `Enforce build-pass and test-pass-rate checks as hard requirements.`,
      "under-claiming":
        `Code Quality is ${severity}ly under-claimed (delta: ${delta}). ` +
        `The self-evaluator may be too strict on minor style issues. ` +
        `Weight build-pass and test-pass-rate more heavily over subjective criteria.`,
    },
    maintainability: {
      "over-claiming":
        `Maintainability is ${severity}ly over-claimed (delta: ${delta}). ` +
        `Self-eval may be assuming maintainability from code structure descriptions. ` +
        `Ground maintainability in diff size, test presence, and build health signals.`,
      "under-claiming":
        `Maintainability is ${severity}ly under-claimed (delta: ${delta}). ` +
        `The self-evaluator may be penalizing large diffs that are actually well-tested. ` +
        `Consider test-to-code ratio as a positive maintainability signal.`,
    },
  }

  const dimTemplates = templates[dimensionId]
  if (dimTemplates) {
    return dimTemplates[direction]
  }

  return `${dimensionId}: ${severity} ${direction} detected (delta: ${delta}). Review scoring calibration for this dimension.`
}

// ---------------------------------------------------------------------------
// Evidence strength assessment
// ---------------------------------------------------------------------------

function assessEvidenceStrength(
  blindDimension: DimensionScore | undefined,
): "strong" | "moderate" | "weak" {
  if (!blindDimension) return "weak"

  const evidenceCount = blindDimension.evidence.length
  const hasCritique = blindDimension.critique.length > 0

  if (evidenceCount >= 3 && hasCritique) return "strong"
  if (evidenceCount >= 1) return "moderate"
  return "weak"
}

// ---------------------------------------------------------------------------
// Core analysis
// ---------------------------------------------------------------------------

/**
 * Analyze divergence between self-evaluation scores and blind evaluation
 * results on a per-dimension basis.
 *
 * @param selfScores - Map of dimension ID to self-reported score (0-100).
 * @param blindResult - The blind evaluator result containing per-dimension scores.
 * @returns A structured analysis of divergence patterns.
 */
export function analyzeDivergence(
  selfScores: Record<string, number>,
  blindResult: BlindEvaluatorResult,
): DivergenceAnalysis {
  const perDimension: DivergenceAnalysis["perDimension"] = []
  const overClaimingDimensions: string[] = []
  const underClaimingDimensions: string[] = []
  const recommendations: string[] = []

  // Build blind scores map
  const blindScoreMap = new Map<string, DimensionScore>()
  for (const dim of blindResult.dimensionScores) {
    blindScoreMap.set(dim.dimensionId, dim)
  }

  // Collect all dimension IDs from both sources
  const allDimensionIds = new Set<string>([
    ...Object.keys(selfScores),
    ...blindResult.dimensionScores.map((d) => d.dimensionId),
  ])

  let totalAbsDelta = 0
  let dimensionCount = 0

  for (const dimId of allDimensionIds) {
    const selfScore = selfScores[dimId] ?? 0
    const blindDim = blindScoreMap.get(dimId)
    const blindScore = blindDim?.score ?? 0
    const delta = selfScore - blindScore
    const absDelta = Math.abs(delta)

    totalAbsDelta += absDelta
    dimensionCount++

    let direction: "over-claiming" | "under-claiming" | "aligned"
    if (absDelta <= ALIGNED_THRESHOLD) {
      direction = "aligned"
    } else if (delta > 0) {
      direction = "over-claiming"
      overClaimingDimensions.push(dimId)
    } else {
      direction = "under-claiming"
      underClaimingDimensions.push(dimId)
    }

    const evidenceStrength = assessEvidenceStrength(blindDim)
    const recommendation = recommendationForDimension(dimId, direction, absDelta)

    perDimension.push({
      dimensionId: dimId,
      selfScore,
      blindScore,
      delta: Math.round(absDelta * 100) / 100,
      direction,
      evidenceStrength,
      recommendation,
    })

    if (direction !== "aligned") {
      recommendations.push(recommendation)
    }
  }

  // Sort by delta descending for easier consumption
  perDimension.sort((a, b) => b.delta - a.delta)

  const overallDivergence = dimensionCount > 0
    ? Math.round((totalAbsDelta / dimensionCount) * 100) / 100
    : 0

  const mostDivergent = perDimension.length > 0
    ? perDimension[0].dimensionId
    : ""

  const leastDivergent = perDimension.length > 0
    ? perDimension[perDimension.length - 1].dimensionId
    : ""

  // Add high-level recommendations
  if (overClaimingDimensions.length >= 3) {
    recommendations.push(
      "Systematic over-claiming detected across multiple dimensions. " +
      "Consider recalibrating the self-evaluator with stricter evidence requirements.",
    )
  }

  if (overallDivergence > NOTABLE_DIVERGENCE_THRESHOLD) {
    recommendations.push(
      `Overall divergence (${overallDivergence}) exceeds the notable threshold (${NOTABLE_DIVERGENCE_THRESHOLD}). ` +
      "Self-evaluation reliability is low. Prioritize blind evaluation results for decision-making.",
    )
  }

  return {
    overallDivergence,
    perDimension,
    mostDivergent,
    leastDivergent,
    overClaimingDimensions,
    underClaimingDimensions,
    recommendations,
  }
}

// ---------------------------------------------------------------------------
// Cross-run aggregation
// ---------------------------------------------------------------------------

/**
 * Aggregate multiple divergence analyses into a summary report with
 * per-dimension ranking and top recommendations.
 */
export function aggregateDivergences(
  analyses: DivergenceAnalysis[],
): DivergenceReport {
  if (analyses.length === 0) {
    return {
      analyses: [],
      aggregate: {
        avgOverallDivergence: 0,
        dimensionRanking: [],
        topRecommendations: [],
        evidenceCoverageByDimension: {},
      },
    }
  }

  // Average overall divergence
  const avgOverallDivergence = Math.round(
    (analyses.reduce((sum, a) => sum + a.overallDivergence, 0) / analyses.length) * 100,
  ) / 100

  // Per-dimension aggregation
  const dimensionStats = new Map<string, {
    deltas: number[]
    directions: Array<"over-claiming" | "under-claiming" | "aligned">
    evidenceStrengths: Array<"strong" | "moderate" | "weak">
  }>()

  for (const analysis of analyses) {
    for (const dim of analysis.perDimension) {
      let stats = dimensionStats.get(dim.dimensionId)
      if (!stats) {
        stats = { deltas: [], directions: [], evidenceStrengths: [] }
        dimensionStats.set(dim.dimensionId, stats)
      }
      stats.deltas.push(dim.delta)
      stats.directions.push(dim.direction)
      stats.evidenceStrengths.push(dim.evidenceStrength)
    }
  }

  // Build dimension ranking by average delta (descending)
  const dimensionRanking: DivergenceReport["aggregate"]["dimensionRanking"] = []
  const evidenceCoverageByDimension: Record<string, number> = {}

  for (const [dimId, stats] of dimensionStats) {
    const avgDelta = Math.round(
      (stats.deltas.reduce((sum, d) => sum + d, 0) / stats.deltas.length) * 100,
    ) / 100

    // Determine dominant direction
    const overCount = stats.directions.filter((d) => d === "over-claiming").length
    const underCount = stats.directions.filter((d) => d === "under-claiming").length
    const alignedCount = stats.directions.filter((d) => d === "aligned").length
    let dominantDirection: string
    if (alignedCount > overCount && alignedCount > underCount) {
      dominantDirection = "aligned"
    } else if (overCount >= underCount) {
      dominantDirection = "over-claiming"
    } else {
      dominantDirection = "under-claiming"
    }

    dimensionRanking.push({
      id: dimId,
      avgDelta,
      direction: dominantDirection,
    })

    // Evidence coverage: fraction of analyses with "strong" evidence for this dimension
    const strongCount = stats.evidenceStrengths.filter((e) => e === "strong").length
    const moderateCount = stats.evidenceStrengths.filter((e) => e === "moderate").length
    evidenceCoverageByDimension[dimId] = Math.round(
      ((strongCount + moderateCount * 0.5) / stats.evidenceStrengths.length) * 100,
    ) / 100
  }

  // Sort ranking by avgDelta descending (most divergent first)
  dimensionRanking.sort((a, b) => b.avgDelta - a.avgDelta)

  // Collect and deduplicate top recommendations
  const recommendationFreq = new Map<string, number>()
  for (const analysis of analyses) {
    for (const rec of analysis.recommendations) {
      recommendationFreq.set(rec, (recommendationFreq.get(rec) ?? 0) + 1)
    }
  }

  // Sort by frequency and take top 5
  const topRecommendations = [...recommendationFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([rec]) => rec)

  // Add aggregate-level recommendations
  if (avgOverallDivergence > NOTABLE_DIVERGENCE_THRESHOLD) {
    topRecommendations.unshift(
      `Cross-run average divergence is ${avgOverallDivergence}, exceeding the ${NOTABLE_DIVERGENCE_THRESHOLD}-point threshold. ` +
      "Self-evaluation calibration needs immediate attention.",
    )
  }

  const consistentlyOverClaimed = dimensionRanking.filter(
    (d) => d.direction === "over-claiming" && d.avgDelta > ALIGNED_THRESHOLD,
  )
  if (consistentlyOverClaimed.length > 0) {
    topRecommendations.push(
      `Consistently over-claimed dimensions: ${consistentlyOverClaimed.map((d) => d.id).join(", ")}. ` +
      "These dimensions need stronger observable evidence requirements in the self-evaluator.",
    )
  }

  return {
    analyses,
    aggregate: {
      avgOverallDivergence,
      dimensionRanking,
      topRecommendations,
      evidenceCoverageByDimension,
    },
  }
}

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------

/**
 * Render a divergence report as a Markdown document with tables showing
 * per-dimension divergence patterns and actionable recommendations.
 */
export function renderDivergenceReportMarkdown(report: DivergenceReport): string {
  const lines: string[] = []
  const agg = report.aggregate

  // Header
  lines.push("# Blind Divergence Analysis Report")
  lines.push("")
  lines.push(`**Analyses included:** ${report.analyses.length}`)
  lines.push(`**Average overall divergence:** ${agg.avgOverallDivergence}`)
  lines.push("")

  // Aggregate dimension ranking table
  lines.push("## Dimension Divergence Ranking")
  lines.push("")
  lines.push("Dimensions ordered by average blind/self delta (most divergent first):")
  lines.push("")
  lines.push("| Rank | Dimension | Avg Delta | Direction | Evidence Coverage |")
  lines.push("|-----:|-----------|----------:|-----------|------------------:|")
  for (let i = 0; i < agg.dimensionRanking.length; i++) {
    const dim = agg.dimensionRanking[i]
    const coverage = agg.evidenceCoverageByDimension[dim.id] ?? 0
    const coveragePct = `${(coverage * 100).toFixed(0)}%`
    lines.push(
      `| ${i + 1} | ${dim.id} | ${dim.avgDelta} | ${dim.direction} | ${coveragePct} |`,
    )
  }
  lines.push("")

  // Direction summary
  const overClaiming = agg.dimensionRanking.filter((d) => d.direction === "over-claiming")
  const underClaiming = agg.dimensionRanking.filter((d) => d.direction === "under-claiming")
  const aligned = agg.dimensionRanking.filter((d) => d.direction === "aligned")

  lines.push("## Direction Summary")
  lines.push("")
  if (overClaiming.length > 0) {
    lines.push(`**Over-claiming** (${overClaiming.length}): ${overClaiming.map((d) => d.id).join(", ")}`)
  }
  if (underClaiming.length > 0) {
    lines.push(`**Under-claiming** (${underClaiming.length}): ${underClaiming.map((d) => d.id).join(", ")}`)
  }
  if (aligned.length > 0) {
    lines.push(`**Aligned** (${aligned.length}): ${aligned.map((d) => d.id).join(", ")}`)
  }
  lines.push("")

  // Per-analysis detail tables (show up to 10 for readability)
  const maxDetailAnalyses = Math.min(report.analyses.length, 10)
  if (maxDetailAnalyses > 0) {
    lines.push("## Per-Run Divergence Details")
    lines.push("")
    for (let ai = 0; ai < maxDetailAnalyses; ai++) {
      const analysis = report.analyses[ai]
      lines.push(`### Run ${ai + 1} (Overall Divergence: ${analysis.overallDivergence})`)
      lines.push("")
      lines.push("| Dimension | Self | Blind | Delta | Direction | Evidence |")
      lines.push("|-----------|-----:|------:|------:|-----------|----------|")
      for (const dim of analysis.perDimension) {
        lines.push(
          `| ${dim.dimensionId} | ${dim.selfScore} | ${dim.blindScore} | ${dim.delta} | ${dim.direction} | ${dim.evidenceStrength} |`,
        )
      }
      lines.push("")
      lines.push(`- **Most divergent:** ${analysis.mostDivergent}`)
      lines.push(`- **Least divergent:** ${analysis.leastDivergent}`)
      if (analysis.overClaimingDimensions.length > 0) {
        lines.push(`- **Over-claiming:** ${analysis.overClaimingDimensions.join(", ")}`)
      }
      if (analysis.underClaimingDimensions.length > 0) {
        lines.push(`- **Under-claiming:** ${analysis.underClaimingDimensions.join(", ")}`)
      }
      lines.push("")
    }
    if (report.analyses.length > maxDetailAnalyses) {
      lines.push(`> ... and ${report.analyses.length - maxDetailAnalyses} more analyses (truncated for readability)`)
      lines.push("")
    }
  }

  // Recommendations
  if (agg.topRecommendations.length > 0) {
    lines.push("## Top Recommendations")
    lines.push("")
    for (let i = 0; i < agg.topRecommendations.length; i++) {
      lines.push(`${i + 1}. ${agg.topRecommendations[i]}`)
    }
    lines.push("")
  }

  // Evidence coverage heatmap
  if (Object.keys(agg.evidenceCoverageByDimension).length > 0) {
    lines.push("## Evidence Coverage by Dimension")
    lines.push("")
    lines.push("Shows what fraction of analyses had strong/moderate evidence for each dimension:")
    lines.push("")
    for (const [dimId, coverage] of Object.entries(agg.evidenceCoverageByDimension)) {
      const pct = (coverage * 100).toFixed(0)
      const barLen = Math.round(coverage * 30)
      const bar = "\u2588".repeat(barLen) + "\u2591".repeat(30 - barLen)
      lines.push(`  ${dimId.padEnd(18)} ${bar} ${pct}%`)
    }
    lines.push("")
  }

  return lines.join("\n")
}
