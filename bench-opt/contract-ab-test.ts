/**
 * Sprint Contract A/B Test Infrastructure
 *
 * Compares long-run benchmark results WITH and WITHOUT sprint contract
 * negotiation, proving contracts have measurable impact on quality,
 * convergence speed, and promotion readiness.
 */

import { randomUUID } from "node:crypto"

import {
  createLongRunConfig,
  runLongRunBenchmark,
  type LongRunConfig,
  type LongRunResult,
} from "./long-run.ts"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContractABConfig {
  prompt: string
  sprints: number
  runsPerVariant: number // how many times to run each variant
}

export interface ContractABVariantResult {
  variant: "with-contract" | "without-contract"
  runs: Array<{
    runIndex: number
    finalScore: number
    sprintScores: number[]
    verdict: string
    livePassRate: number
    rerunCount: number
    pivotCount: number
    promotionReady: boolean
    durationMs: number
  }>
  statistics: {
    avgFinalScore: number
    scoreStdDev: number
    successRate: number
    avgRerunCount: number
    avgPivotCount: number
    avgLivePassRate: number
    promotionReadyRate: number
  }
}

export interface ContractABResult {
  schemaVersion: 1
  testId: string
  generatedAt: string
  config: ContractABConfig
  withContract: ContractABVariantResult
  withoutContract: ContractABVariantResult
  comparison: {
    scoreDelta: number // with - without
    successRateDelta: number
    rerunDelta: number
    pivotDelta: number
    livePassDelta: number
    promotionDelta: number
    contractImpact: "positive" | "neutral" | "negative"
    significance: "strong" | "moderate" | "weak" | "insufficient-data"
    summary: string
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract per-run metrics from a single long-run result.
 */
function extractRunMetrics(
  result: LongRunResult,
  runIndex: number,
  durationMs: number,
): ContractABVariantResult["runs"][number] {
  const sprintScores = result.sprints.map(
    (s) => s.compositeScore?.total ?? 0,
  )

  // Count reruns: each sprint that has notes mentioning "retrying" indicates
  // additional attempts beyond the first.
  const rerunCount = result.notes.filter((n) => n.includes("retrying")).length

  // Count pivots: quality-gate-failed termination indicates a "pivot" was needed
  // (the run had to stop because a sprint couldn't pass).
  const pivotCount =
    result.terminationReason === "quality-gate-failed" ? 1 : 0

  // Live pass rate
  let livePassRate = 0
  if (result.liveValidation && result.liveValidation.scenarioCount > 0) {
    livePassRate =
      result.liveValidation.passCount / result.liveValidation.scenarioCount
  }

  return {
    runIndex,
    finalScore: result.finalScore ?? 0,
    sprintScores,
    verdict: result.finalVerdict,
    livePassRate,
    rerunCount,
    pivotCount,
    promotionReady: result.promotionReady,
    durationMs,
  }
}

/**
 * Compute aggregate statistics across multiple runs of the same variant.
 */
function computeStatistics(
  runs: ContractABVariantResult["runs"],
): ContractABVariantResult["statistics"] {
  const n = runs.length
  if (n === 0) {
    return {
      avgFinalScore: 0,
      scoreStdDev: 0,
      successRate: 0,
      avgRerunCount: 0,
      avgPivotCount: 0,
      avgLivePassRate: 0,
      promotionReadyRate: 0,
    }
  }

  const scores = runs.map((r) => r.finalScore)
  const avgFinalScore = scores.reduce((a, b) => a + b, 0) / n

  // Standard deviation
  const variance =
    scores.reduce((sum, s) => sum + (s - avgFinalScore) ** 2, 0) / n
  const scoreStdDev = Math.sqrt(variance)

  const successRate = runs.filter((r) => r.verdict === "pass").length / n
  const avgRerunCount = runs.reduce((a, r) => a + r.rerunCount, 0) / n
  const avgPivotCount = runs.reduce((a, r) => a + r.pivotCount, 0) / n
  const avgLivePassRate = runs.reduce((a, r) => a + r.livePassRate, 0) / n
  const promotionReadyRate =
    runs.filter((r) => r.promotionReady).length / n

  return {
    avgFinalScore: round2(avgFinalScore),
    scoreStdDev: round2(scoreStdDev),
    successRate: round2(successRate),
    avgRerunCount: round2(avgRerunCount),
    avgPivotCount: round2(avgPivotCount),
    avgLivePassRate: round2(avgLivePassRate),
    promotionReadyRate: round2(promotionReadyRate),
  }
}

/**
 * Determine significance level based on effect size and sample count.
 *
 * Uses a simplified Cohen's d approach:
 * - |d| >= 0.8 with n >= 3: strong
 * - |d| >= 0.5 with n >= 3: moderate
 * - |d| >= 0.2 with n >= 2: weak
 * - Otherwise: insufficient-data
 */
function determineSignificance(
  withStats: ContractABVariantResult["statistics"],
  withoutStats: ContractABVariantResult["statistics"],
  runsPerVariant: number,
): ContractABResult["comparison"]["significance"] {
  if (runsPerVariant < 2) return "insufficient-data"

  // Pooled standard deviation
  const pooledStdDev = Math.sqrt(
    (withStats.scoreStdDev ** 2 + withoutStats.scoreStdDev ** 2) / 2,
  )

  if (pooledStdDev === 0) {
    // No variance at all. If there is a score difference it is definitive.
    const delta = Math.abs(withStats.avgFinalScore - withoutStats.avgFinalScore)
    if (delta > 0 && runsPerVariant >= 3) return "strong"
    if (delta > 0) return "moderate"
    return "insufficient-data"
  }

  const effectSize =
    Math.abs(withStats.avgFinalScore - withoutStats.avgFinalScore) /
    pooledStdDev

  if (effectSize >= 0.8 && runsPerVariant >= 3) return "strong"
  if (effectSize >= 0.5 && runsPerVariant >= 3) return "moderate"
  if (effectSize >= 0.2 && runsPerVariant >= 2) return "weak"
  return "insufficient-data"
}

/** Round to 2 decimal places. */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

/**
 * Run the contract A/B test.
 *
 * For each variant ("with-contract" and "without-contract"), executes the
 * long-run benchmark `runsPerVariant` times, collects metrics, computes
 * statistics, and compares the two variants to determine contract impact.
 */
export async function runContractABTest(
  config: ContractABConfig,
): Promise<ContractABResult> {
  const testId = `contract-ab-${Date.now()}-${randomUUID().slice(0, 8)}`

  // --- Run "with-contract" variant ---
  const withContractRuns = await runVariant(config, false, testId)
  const withContractStats = computeStatistics(withContractRuns)
  const withContract: ContractABVariantResult = {
    variant: "with-contract",
    runs: withContractRuns,
    statistics: withContractStats,
  }

  // --- Run "without-contract" variant ---
  const withoutContractRuns = await runVariant(config, true, testId)
  const withoutContractStats = computeStatistics(withoutContractRuns)
  const withoutContract: ContractABVariantResult = {
    variant: "without-contract",
    runs: withoutContractRuns,
    statistics: withoutContractStats,
  }

  // --- Compare ---
  const scoreDelta = round2(
    withContractStats.avgFinalScore - withoutContractStats.avgFinalScore,
  )
  const successRateDelta = round2(
    withContractStats.successRate - withoutContractStats.successRate,
  )
  const rerunDelta = round2(
    withContractStats.avgRerunCount - withoutContractStats.avgRerunCount,
  )
  const pivotDelta = round2(
    withContractStats.avgPivotCount - withoutContractStats.avgPivotCount,
  )
  const livePassDelta = round2(
    withContractStats.avgLivePassRate - withoutContractStats.avgLivePassRate,
  )
  const promotionDelta = round2(
    withContractStats.promotionReadyRate -
      withoutContractStats.promotionReadyRate,
  )

  // Determine overall impact direction
  let contractImpact: ContractABResult["comparison"]["contractImpact"]
  if (scoreDelta > 1) {
    contractImpact = "positive"
  } else if (scoreDelta < -1) {
    contractImpact = "negative"
  } else {
    contractImpact = "neutral"
  }

  const significance = determineSignificance(
    withContractStats,
    withoutContractStats,
    config.runsPerVariant,
  )

  const summary = buildComparisonSummary(
    scoreDelta,
    successRateDelta,
    contractImpact,
    significance,
    config,
  )

  return {
    schemaVersion: 1,
    testId,
    generatedAt: new Date().toISOString(),
    config,
    withContract,
    withoutContract,
    comparison: {
      scoreDelta,
      successRateDelta,
      rerunDelta,
      pivotDelta,
      livePassDelta,
      promotionDelta,
      contractImpact,
      significance,
      summary,
    },
  }
}

/**
 * Execute one variant (with or without contracts) for the configured number
 * of runs. Each run is a full long-run benchmark.
 */
async function runVariant(
  config: ContractABConfig,
  disableContracts: boolean,
  testId: string,
): Promise<ContractABVariantResult["runs"]> {
  const variantLabel = disableContracts ? "without-contract" : "with-contract"
  const runs: ContractABVariantResult["runs"] = []

  for (let i = 0; i < config.runsPerVariant; i++) {
    console.log(
      `[${testId}] Running ${variantLabel} variant, run ${i + 1}/${config.runsPerVariant}...`,
    )

    const longRunConfig: LongRunConfig = createLongRunConfig(config.prompt, {
      maxSprints: config.sprints,
      disableSprintContracts: disableContracts,
    })

    const startMs = Date.now()
    let result: LongRunResult

    try {
      result = await runLongRunBenchmark(longRunConfig)
    } catch (error) {
      // Graceful failure: record a zero-score run
      const message = error instanceof Error ? error.message : String(error)
      console.error(
        `[${testId}] ${variantLabel} run ${i + 1} failed: ${message}`,
      )
      runs.push({
        runIndex: i,
        finalScore: 0,
        sprintScores: [],
        verdict: "fail",
        livePassRate: 0,
        rerunCount: 0,
        pivotCount: 0,
        promotionReady: false,
        durationMs: Date.now() - startMs,
      })
      continue
    }

    const durationMs = Date.now() - startMs
    const metrics = extractRunMetrics(result, i, durationMs)
    runs.push(metrics)

    console.log(
      `[${testId}] ${variantLabel} run ${i + 1} complete: ` +
        `score=${metrics.finalScore}, verdict=${metrics.verdict}, ` +
        `duration=${formatDuration(durationMs)}`,
    )
  }

  return runs
}

function buildComparisonSummary(
  scoreDelta: number,
  successRateDelta: number,
  impact: ContractABResult["comparison"]["contractImpact"],
  significance: ContractABResult["comparison"]["significance"],
  config: ContractABConfig,
): string {
  const parts: string[] = []

  parts.push(
    `Contract A/B test across ${config.runsPerVariant} runs per variant ` +
      `(${config.sprints} sprints each).`,
  )

  if (impact === "positive") {
    parts.push(
      `Sprint contracts improved average score by ${scoreDelta} points.`,
    )
  } else if (impact === "negative") {
    parts.push(
      `Sprint contracts decreased average score by ${Math.abs(scoreDelta)} points.`,
    )
  } else {
    parts.push(
      `Sprint contracts had neutral impact on average score (delta: ${scoreDelta}).`,
    )
  }

  if (successRateDelta !== 0) {
    const direction = successRateDelta > 0 ? "higher" : "lower"
    parts.push(
      `Success rate was ${Math.abs(successRateDelta * 100).toFixed(0)}% ${direction} with contracts.`,
    )
  }

  parts.push(`Statistical significance: ${significance}.`)

  return parts.join(" ")
}

// ---------------------------------------------------------------------------
// Markdown renderer
// ---------------------------------------------------------------------------

/**
 * Render a human-readable Markdown report from a {@link ContractABResult}.
 *
 * Includes side-by-side comparison, per-variant detail, statistical summary,
 * and impact assessment.
 */
export function renderContractABMarkdown(result: ContractABResult): string {
  const lines: string[] = []

  lines.push("# Sprint Contract A/B Test Report")
  lines.push("")
  lines.push(`**Test ID:** ${result.testId}`)
  lines.push(`**Generated:** ${result.generatedAt}`)
  lines.push(
    `**Impact:** ${result.comparison.contractImpact.toUpperCase()} (${result.comparison.significance})`,
  )
  lines.push("")

  // Configuration
  lines.push("## Configuration")
  lines.push("")
  lines.push(`- Prompt: ${result.config.prompt}`)
  lines.push(`- Sprints per run: ${result.config.sprints}`)
  lines.push(`- Runs per variant: ${result.config.runsPerVariant}`)
  lines.push("")

  // Side-by-side comparison table
  lines.push("## Side-by-Side Comparison")
  lines.push("")
  lines.push("| Metric | With Contract | Without Contract | Delta |")
  lines.push("|--------|---------------|------------------|-------|")
  lines.push(
    `| Avg Final Score | ${result.withContract.statistics.avgFinalScore} | ${result.withoutContract.statistics.avgFinalScore} | ${fmtDelta(result.comparison.scoreDelta)} |`,
  )
  lines.push(
    `| Score Std Dev | ${result.withContract.statistics.scoreStdDev} | ${result.withoutContract.statistics.scoreStdDev} | - |`,
  )
  lines.push(
    `| Success Rate | ${fmtPct(result.withContract.statistics.successRate)} | ${fmtPct(result.withoutContract.statistics.successRate)} | ${fmtDeltaPct(result.comparison.successRateDelta)} |`,
  )
  lines.push(
    `| Avg Reruns | ${result.withContract.statistics.avgRerunCount} | ${result.withoutContract.statistics.avgRerunCount} | ${fmtDelta(result.comparison.rerunDelta)} |`,
  )
  lines.push(
    `| Avg Pivots | ${result.withContract.statistics.avgPivotCount} | ${result.withoutContract.statistics.avgPivotCount} | ${fmtDelta(result.comparison.pivotDelta)} |`,
  )
  lines.push(
    `| Avg Live Pass Rate | ${fmtPct(result.withContract.statistics.avgLivePassRate)} | ${fmtPct(result.withoutContract.statistics.avgLivePassRate)} | ${fmtDeltaPct(result.comparison.livePassDelta)} |`,
  )
  lines.push(
    `| Promotion Ready Rate | ${fmtPct(result.withContract.statistics.promotionReadyRate)} | ${fmtPct(result.withoutContract.statistics.promotionReadyRate)} | ${fmtDeltaPct(result.comparison.promotionDelta)} |`,
  )
  lines.push("")

  // Per-variant details
  for (const variant of [result.withContract, result.withoutContract]) {
    const label =
      variant.variant === "with-contract"
        ? "With Contract"
        : "Without Contract"
    lines.push(`## ${label} Detail`)
    lines.push("")

    if (variant.runs.length === 0) {
      lines.push("No runs completed.")
      lines.push("")
      continue
    }

    lines.push(
      "| Run | Final Score | Sprint Scores | Verdict | Promotion | Duration |",
    )
    lines.push(
      "|-----|-------------|---------------|---------|-----------|----------|",
    )

    for (const run of variant.runs) {
      const sprintScoresStr =
        run.sprintScores.length > 0
          ? run.sprintScores.join(" -> ")
          : "-"
      const promo = run.promotionReady ? "Yes" : "No"
      lines.push(
        `| ${run.runIndex + 1} | ${run.finalScore} | ${sprintScoresStr} | ${run.verdict} | ${promo} | ${formatDuration(run.durationMs)} |`,
      )
    }
    lines.push("")

    // Score distribution visual
    if (variant.runs.length > 1) {
      lines.push(`### Score Distribution (${label})`)
      lines.push("")
      const maxScore = Math.max(...variant.runs.map((r) => r.finalScore), 1)
      for (const run of variant.runs) {
        const barLength = Math.round((run.finalScore / maxScore) * 30)
        const bar =
          "\u2588".repeat(barLength) + "\u2591".repeat(30 - barLength)
        lines.push(`  Run ${run.runIndex + 1}: ${bar} ${run.finalScore}`)
      }
      lines.push("")
    }
  }

  // Impact assessment
  lines.push("## Impact Assessment")
  lines.push("")
  lines.push(
    `- **Contract impact:** ${result.comparison.contractImpact.toUpperCase()}`,
  )
  lines.push(
    `- **Statistical significance:** ${result.comparison.significance}`,
  )
  lines.push(`- **Score delta:** ${fmtDelta(result.comparison.scoreDelta)}`)
  lines.push(
    `- **Success rate delta:** ${fmtDeltaPct(result.comparison.successRateDelta)}`,
  )
  lines.push("")

  // Summary
  lines.push("## Summary")
  lines.push("")
  lines.push(result.comparison.summary)
  lines.push("")

  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fmtDelta(n: number): string {
  if (n > 0) return `+${n}`
  return String(n)
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`
}

function fmtDeltaPct(n: number): string {
  const pct = (n * 100).toFixed(0)
  if (n > 0) return `+${pct}%`
  return `${pct}%`
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60_000).toFixed(1)}m`
}
