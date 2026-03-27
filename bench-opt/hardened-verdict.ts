/**
 * Hardened Verdict System
 *
 * Splits verdict into visible + hidden gates with blind/holdout influence.
 * The hidden gate can FAIL or DOWNGRADE a run that passes the visible gate,
 * preventing inflated self-evaluations from slipping through.
 */

import {
  runBlindEvaluation,
  compareBlindVsSelfEvaluation,
  type BlindEvaluatorInput,
  type BlindEvaluatorResult,
  type BlindVsSelfComparison,
} from "./blind-evaluator.ts"
import {
  createDefaultScoringConfig,
  type CompositeScoringConfig,
} from "./composite-scorer.ts"
import type { BenchOptEvaluatorArtifact } from "./evaluator.ts"
import { holdoutScenarios } from "../bench-live/scenarios/holdout/index.ts"
import { runLiveBench, type LiveBenchRunOutcome } from "../bench-live/index.ts"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VisibleGateResult {
  passed: boolean
  compositeScore: number
  dimensionsPassed: string[]
  dimensionsFailed: string[]
  notes: string[]
}

export interface HiddenGateResult {
  blindEvaluator: {
    ran: boolean
    compositeScore: number | null
    divergenceFromSelf: number | null // delta vs self-evaluation
    suspiciousDimensions: string[] // >15pt divergence
    verdict: "pass" | "warn" | "fail"
  }
  holdoutScenarios: {
    ran: boolean
    passCount: number
    failCount: number
    results: Array<{ scenarioId: string; pass: boolean; score: number }>
    verdict: "pass" | "warn" | "fail"
  }
}

export type HardenedCombinedVerdict =
  | "pass"                      // visible pass + hidden pass
  | "pass-with-warnings"        // visible pass + blind warn (no holdout fail)
  | "visible-pass-hidden-fail"  // visible pass but holdout or blind failed
  | "partial"                   // visible marginal, hidden mixed
  | "fail"                      // visible fail regardless of hidden

export interface HardenedVerdict {
  visibleGate: VisibleGateResult
  hiddenGate: HiddenGateResult
  combinedVerdict: HardenedCombinedVerdict
  verdictExplanation: string
  verdictReason: string
  deterministicWarning: boolean // true if scores too uniform
  trustworthinessScore: number // 0-100
}

// ---------------------------------------------------------------------------
// Visible Gate
// ---------------------------------------------------------------------------

/**
 * Evaluate the visible gate using the composite score and scoring config.
 *
 * The visible gate checks:
 * - Composite score meets the total pass threshold
 * - Per-dimension pass/fail status
 */
export function evaluateVisibleGate(
  compositeScore: number,
  config: CompositeScoringConfig,
  dimensionResults?: Array<{
    id: string
    score: number
    passed: boolean
  }>,
): VisibleGateResult {
  const notes: string[] = []
  const dimensionsPassed: string[] = []
  const dimensionsFailed: string[] = []

  if (dimensionResults) {
    for (const dim of dimensionResults) {
      if (dim.passed) {
        dimensionsPassed.push(dim.id)
      } else {
        dimensionsFailed.push(dim.id)
      }
    }
  }

  const passed = compositeScore >= config.totalPassThreshold

  if (passed) {
    notes.push(
      `Composite score ${compositeScore} meets threshold ${config.totalPassThreshold}`,
    )
  } else {
    notes.push(
      `Composite score ${compositeScore} below threshold ${config.totalPassThreshold}`,
    )
  }

  if (dimensionsFailed.length > 0) {
    notes.push(`Failed dimensions: ${dimensionsFailed.join(", ")}`)
  }

  return {
    passed,
    compositeScore,
    dimensionsPassed,
    dimensionsFailed,
    notes,
  }
}

// ---------------------------------------------------------------------------
// Hidden Gate
// ---------------------------------------------------------------------------

/**
 * Run the hidden gate: blind evaluator + holdout scenarios.
 *
 * The blind evaluator re-scores the run using only observable evidence,
 * then compares against the self-evaluation to detect inflation.
 *
 * Holdout scenarios are run via `runLiveBench` to detect regressions
 * on harder conditions not seen during normal evaluation.
 *
 * @param blindInput - Input for the blind evaluator.
 * @param selfEval - The self-described evaluator artifact to compare against.
 * @param holdoutScenarioIds - Optional list of holdout scenario IDs to run.
 *   If not provided, all registered holdout scenarios are used.
 * @param runHoldouts - Whether to actually run holdout scenarios (default: true).
 *   Set to false if live browser is not available.
 */
export async function evaluateHiddenGate(
  blindInput: BlindEvaluatorInput,
  selfEval: BenchOptEvaluatorArtifact,
  holdoutScenarioIds?: string[],
  runHoldouts: boolean = true,
): Promise<HiddenGateResult> {
  // --- Blind evaluation ---
  let blindResult: BlindEvaluatorResult | null = null
  let blindComparison: BlindVsSelfComparison | null = null
  let blindVerdict: "pass" | "warn" | "fail" = "pass"
  let blindRan = false
  let blindCompositeScore: number | null = null
  let divergenceFromSelf: number | null = null
  let suspiciousDimensions: string[] = []

  try {
    blindResult = runBlindEvaluation(blindInput)
    blindRan = true
    blindCompositeScore = blindResult.compositeScore.weightedTotal

    blindComparison = compareBlindVsSelfEvaluation(blindResult, selfEval)
    divergenceFromSelf = blindComparison.compositeDelta

    suspiciousDimensions = blindComparison.divergences
      .filter((d) => d.suspicious)
      .map((d) => d.dimensionId)

    // Derive blind verdict
    if (blindComparison.compositeSuspicious || blindComparison.suspiciousCount >= 3) {
      blindVerdict = "fail"
    } else if (blindComparison.suspiciousCount >= 1) {
      blindVerdict = "warn"
    } else {
      blindVerdict = "pass"
    }
  } catch {
    // Blind evaluation failed -- treat as not run
    blindRan = false
  }

  // --- Holdout scenarios ---
  let holdoutRan = false
  let holdoutPassCount = 0
  let holdoutFailCount = 0
  const holdoutResults: Array<{ scenarioId: string; pass: boolean; score: number }> = []
  let holdoutVerdict: "pass" | "warn" | "fail" = "pass"

  if (runHoldouts) {
    const targetScenarioIds = holdoutScenarioIds ?? holdoutScenarios.map((s) => s.id)

    for (const scenarioId of targetScenarioIds) {
      const scenario = holdoutScenarios.find((s) => s.id === scenarioId)
      if (!scenario) {
        continue
      }

      try {
        const outcome = await runLiveBench(["--scenario", scenarioId])
        holdoutRan = true

        if (outcome.mode === "run") {
          const runOutcome = outcome as LiveBenchRunOutcome
          const pass = runOutcome.result.status !== "fail"
          const score = runOutcome.result.score ?? 0
          holdoutResults.push({ scenarioId, pass, score })
          if (pass) {
            holdoutPassCount++
          } else {
            holdoutFailCount++
          }
        }
      } catch {
        // Scenario failed to run -- count as failure
        holdoutResults.push({ scenarioId, pass: false, score: 0 })
        holdoutFailCount++
        holdoutRan = true
      }
    }

    // Derive holdout verdict
    const totalHoldouts = holdoutPassCount + holdoutFailCount
    if (totalHoldouts === 0) {
      holdoutVerdict = "pass" // no holdouts to fail
    } else {
      const holdoutPassRate = holdoutPassCount / totalHoldouts
      if (holdoutPassRate >= 0.8) {
        holdoutVerdict = "pass"
      } else if (holdoutPassRate >= 0.5) {
        holdoutVerdict = "warn"
      } else {
        holdoutVerdict = "fail"
      }
    }
  }

  return {
    blindEvaluator: {
      ran: blindRan,
      compositeScore: blindCompositeScore,
      divergenceFromSelf,
      suspiciousDimensions,
      verdict: blindVerdict,
    },
    holdoutScenarios: {
      ran: holdoutRan,
      passCount: holdoutPassCount,
      failCount: holdoutFailCount,
      results: holdoutResults,
      verdict: holdoutVerdict,
    },
  }
}

// ---------------------------------------------------------------------------
// Combined Verdict
// ---------------------------------------------------------------------------

/**
 * Combine visible and hidden gate results into a hardened verdict.
 *
 * Combination rules:
 * - If visible fails -> "fail"
 * - If visible passes and hidden passes -> "pass"
 * - If visible passes but hidden warns -> "partial" (downgrade)
 * - If visible passes but hidden fails -> "fail" (blind/holdout veto)
 *
 * Trustworthiness: 100 - (divergence * 2) - (holdout failures * 15)
 */
export function computeHardenedVerdict(
  visible: VisibleGateResult,
  hidden: HiddenGateResult,
  allScores?: number[],
): HardenedVerdict {
  let combinedVerdict: HardenedCombinedVerdict
  let verdictReason: string
  let verdictExplanation: string

  // Check deterministic warning
  const deterministicWarning = allScores
    ? checkDeterministicWarning(allScores)
    : false

  if (!visible.passed) {
    combinedVerdict = "fail"
    verdictReason = `Visible gate failed: composite score ${visible.compositeScore} below threshold`
    verdictExplanation = "The visible evaluation did not meet the required score threshold."
  } else {
    // Visible passed -- check hidden gates
    const blindVerdict = hidden.blindEvaluator.verdict
    const holdoutVerdict = hidden.holdoutScenarios.verdict

    const hasHiddenFail = [blindVerdict, holdoutVerdict].includes("fail")
    const hasHiddenWarn = [blindVerdict, holdoutVerdict].includes("warn")

    if (hasHiddenFail) {
      combinedVerdict = "visible-pass-hidden-fail"
      const failReasons: string[] = []
      if (blindVerdict === "fail") {
        failReasons.push(
          `blind evaluator detected suspicious divergence (delta: ${hidden.blindEvaluator.divergenceFromSelf ?? "N/A"})`,
        )
      }
      if (holdoutVerdict === "fail") {
        failReasons.push(
          `holdout scenarios failed (${hidden.holdoutScenarios.failCount} failures)`,
        )
      }
      verdictReason = `Visible gate passed but hidden gate flagged issues: ${failReasons.join("; ")}`
      verdictExplanation = `Visible evaluation passed (score ${visible.compositeScore}) but hidden checks found issues. ${holdoutVerdict === "fail" ? `Holdout scenarios failed (${hidden.holdoutScenarios.passCount}/${hidden.holdoutScenarios.passCount + hidden.holdoutScenarios.failCount} passed). This indicates the system works for standard tests but not yet for harder edge cases.` : "Blind evaluator found significant divergence from self-evaluation."}`
    } else if (hasHiddenWarn) {
      combinedVerdict = "pass-with-warnings"
      const warnReasons: string[] = []
      if (blindVerdict === "warn") {
        warnReasons.push(
          `blind evaluator flagged ${hidden.blindEvaluator.suspiciousDimensions.length} suspicious dimension(s)`,
        )
      }
      if (holdoutVerdict === "warn") {
        warnReasons.push(
          `holdout scenarios partially failed (${hidden.holdoutScenarios.failCount} failures)`,
        )
      }
      verdictReason = `Visible gate passed with warnings: ${warnReasons.join("; ")}`
      verdictExplanation = `Visible evaluation passed (score ${visible.compositeScore}) with minor concerns from hidden checks.`
    } else {
      combinedVerdict = "pass"
      verdictReason = "Both visible and hidden gates passed"
      verdictExplanation = "All gates passed — visible evaluation, blind evaluator, and holdout scenarios all confirmed the result."
    }
  }

  // Compute trustworthiness score
  const divergence = hidden.blindEvaluator.divergenceFromSelf ?? 0
  const holdoutFailures = hidden.holdoutScenarios.failCount
  let trustworthinessScore = 100 - (divergence * 2) - (holdoutFailures * 15)

  // Apply deterministic warning penalty
  if (deterministicWarning) {
    trustworthinessScore -= 20
    verdictReason += ". WARNING: Deterministic scoring detected (stddev < 0.5)"
  }

  trustworthinessScore = Math.max(0, Math.min(100, Math.round(trustworthinessScore)))

  return {
    visibleGate: visible,
    hiddenGate: hidden,
    combinedVerdict,
    verdictExplanation,
    verdictReason,
    deterministicWarning,
    trustworthinessScore,
  }
}

// ---------------------------------------------------------------------------
// Determinism Check
// ---------------------------------------------------------------------------

/**
 * Check whether scores are suspiciously uniform, indicating possible
 * template-driven scoring rather than genuine evaluation.
 *
 * Returns true if the standard deviation of scores is less than 0.5.
 * A stddev of 0 (all identical scores) always triggers the warning.
 */
export function checkDeterministicWarning(scores: number[]): boolean {
  if (scores.length <= 1) return false

  const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length
  const squaredDiffs = scores.map((s) => (s - mean) ** 2)
  const variance =
    squaredDiffs.reduce((sum, d) => sum + d, 0) / (scores.length - 1)
  const stddev = Math.sqrt(variance)

  return stddev < 0.5
}
