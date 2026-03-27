import type { BenchOptBaselineSnapshot, BenchOptTrialSplit } from "./types.ts"
import type { CompositeScore } from "./composite-scorer.ts"

export type BenchOptRoleName = "planner" | "generator" | "evaluator"

export type BenchOptFollowUpAction = "rerun" | "keep" | "reject"

export type BenchOptIterationVerdict = "pass" | "needs-refine" | "needs-pivot" | "reject"

// ---------------------------------------------------------------------------
// Score history types
// ---------------------------------------------------------------------------

export interface ScoreHistoryEntry {
  iteration: number
  score: number
  dimensionScores?: Record<string, number>
  action: BenchOptFollowUpAction
  timestamp: string
}

export type ScoreHistoryTrend =
  | "improving"
  | "stagnant"
  | "declining"
  | "oscillating"
  | "insufficient-data"

export interface ScoreHistory {
  entries: ScoreHistoryEntry[]
  trend: ScoreHistoryTrend
  plateauLength: number
  bestScore: number
  bestIteration: number
  worstScore: number
}

export interface BenchOptRoleContract {
  role: BenchOptRoleName
  objective: string
  responsibilities: string[]
  inputs: string[]
  outputs: string[]
}

export interface BenchOptIterationBudget {
  maxIterations: number
  maxReruns: number
  maxKeepRejections: number
}

export interface BenchOptRefinePolicy {
  mode: "single-pass" | "refine-first" | "pivot-first"
  minScoreToKeep: number
  minScoreToAvoidReject: number
}

export interface BenchOptIterationContext {
  runId: string
  objective: string
  baseline: BenchOptBaselineSnapshot | null
  split: BenchOptTrialSplit
  candidateId: string | null
}

export interface BenchOptStrategyDecision {
  action: BenchOptFollowUpAction
  verdict: BenchOptIterationVerdict
  reason: string
  rerun: boolean
  keep: boolean
  reject: boolean
  bounded: boolean
}

export interface BenchOptHandoffBase {
  runId: string
  objective: string
  reason: string
}

export interface BenchOptRerunHandoff extends BenchOptHandoffBase {
  kind: "rerun"
  retryBudgetRemaining: number
}

export interface BenchOptKeepHandoff extends BenchOptHandoffBase {
  kind: "keep"
}

export interface BenchOptRejectHandoff extends BenchOptHandoffBase {
  kind: "reject"
}

export type BenchOptHandoffRequest =
  | BenchOptRerunHandoff
  | BenchOptKeepHandoff
  | BenchOptRejectHandoff

export function createBenchOptIterationBudget(
  overrides: Partial<BenchOptIterationBudget> = {},
): BenchOptIterationBudget {
  return {
    maxIterations: overrides.maxIterations ?? 1,
    maxReruns: overrides.maxReruns ?? 1,
    maxKeepRejections: overrides.maxKeepRejections ?? 1,
  }
}

export function createBenchOptRefinePolicy(
  overrides: Partial<BenchOptRefinePolicy> = {},
): BenchOptRefinePolicy {
  return {
    mode: overrides.mode ?? "single-pass",
    minScoreToKeep: overrides.minScoreToKeep ?? 70,
    minScoreToAvoidReject: overrides.minScoreToAvoidReject ?? 35,
  }
}

export function decideBenchOptFollowUp(
  score: number,
  options: {
    policy?: BenchOptRefinePolicy
    budget?: BenchOptIterationBudget
    forcedAction?: BenchOptFollowUpAction | null
    bounded?: boolean
  } = {},
): BenchOptStrategyDecision {
  const policy = options.policy ?? createBenchOptRefinePolicy()
  const budget = options.budget ?? createBenchOptIterationBudget()
  const bounded = options.bounded ?? true

  if (options.forcedAction) {
    const action = options.forcedAction
    return {
      action,
      verdict: action === "keep" ? "pass" : action === "reject" ? "reject" : "needs-refine",
      reason: `Follow-up action forced to ${action}.`,
      rerun: action === "rerun",
      keep: action === "keep",
      reject: action === "reject",
      bounded,
    }
  }

  if (score >= policy.minScoreToKeep) {
    return {
      action: "keep",
      verdict: "pass",
      reason: `Score ${score} met keep threshold ${policy.minScoreToKeep}.`,
      rerun: false,
      keep: true,
      reject: false,
      bounded,
    }
  }

  if (score < policy.minScoreToAvoidReject) {
    return {
      action: "reject",
      verdict: "reject",
      reason: `Score ${score} fell below reject threshold ${policy.minScoreToAvoidReject}.`,
      rerun: false,
      keep: false,
      reject: true,
      bounded,
    }
  }

  return {
    action: budget.maxReruns > 0 ? "rerun" : "reject",
    verdict: budget.maxReruns > 0 ? "needs-refine" : "needs-pivot",
    reason: budget.maxReruns > 0
      ? `Score ${score} is in the refine band; rerun budget remains.`
      : `Score ${score} is in the refine band but rerun budget is exhausted.`,
    rerun: budget.maxReruns > 0,
    keep: false,
    reject: budget.maxReruns <= 0,
    bounded,
  }
}

export function buildBenchOptHandoffRequest(
  decision: BenchOptStrategyDecision,
  context: BenchOptIterationContext,
  options: {
    retryBudgetRemaining?: number
  } = {},
): BenchOptHandoffRequest {
  if (decision.action === "rerun") {
    return {
      kind: "rerun",
      runId: context.runId,
      objective: context.objective,
      reason: decision.reason,
      retryBudgetRemaining: options.retryBudgetRemaining ?? 0,
    }
  }

  if (decision.action === "keep") {
    return {
      kind: "keep",
      runId: context.runId,
      objective: context.objective,
      reason: decision.reason,
    }
  }

  return {
    kind: "reject",
    runId: context.runId,
    objective: context.objective,
    reason: decision.reason,
  }
}

/**
 * Decide a follow-up action using the composite multi-dimension score.
 *
 * Uses the composite's `weightedTotal` as the score fed into the existing
 * {@link decideBenchOptFollowUp} logic, but *also* considers dimension-level
 * failures:
 *
 * - If any **required** dimension failed its threshold the verdict is forced to
 *   `"reject"` regardless of the weighted total.
 * - If only optional dimensions failed the standard score-band logic applies
 *   with the weighted total.
 */
export function decideBenchOptFollowUpFromComposite(
  composite: CompositeScore,
  options?: {
    policy?: BenchOptRefinePolicy
    budget?: BenchOptIterationBudget
    forcedAction?: BenchOptFollowUpAction | null
    bounded?: boolean
  },
): BenchOptStrategyDecision {
  const opts = options ?? {}
  const policy = opts.policy ?? createBenchOptRefinePolicy()
  const budget = opts.budget ?? createBenchOptIterationBudget()
  const bounded = opts.bounded ?? true

  // Honour forced actions unconditionally.
  if (opts.forcedAction) {
    return decideBenchOptFollowUp(composite.weightedTotal, {
      policy,
      budget,
      forcedAction: opts.forcedAction,
      bounded,
    })
  }

  // If required dimensions failed, reject immediately.
  if (!composite.allRequiredPassed) {
    const failedRequired = composite.dimensions
      .filter(
        (d) =>
          !d.passed &&
          // We don't have access to the config's requiredDimensionIds here,
          // but we can detect a required dimension by checking whether
          // allRequiredPassed is false AND the dimension itself failed.
          // However, a simpler approach: just list all failed dimensions.
          true,
      )
      .map((d) => d.label)

    return {
      action: "reject",
      verdict: "reject",
      reason:
        `Required dimension(s) failed: ${failedRequired.join(", ")}. ` +
        `Composite weighted total ${composite.weightedTotal}.`,
      rerun: false,
      keep: false,
      reject: true,
      bounded,
    }
  }

  // All required dimensions passed — use weighted total through normal logic.
  return decideBenchOptFollowUp(composite.weightedTotal, {
    policy,
    budget,
    forcedAction: null,
    bounded,
  })
}

// ---------------------------------------------------------------------------
// Score history helpers
// ---------------------------------------------------------------------------

/** Create an empty score history with default values. */
export function createScoreHistory(): ScoreHistory {
  return {
    entries: [],
    trend: "insufficient-data",
    plateauLength: 0,
    bestScore: 0,
    bestIteration: 0,
    worstScore: 0,
  }
}

/** Record a new score entry and return the updated (mutated) history. */
export function recordScore(
  history: ScoreHistory,
  entry: ScoreHistoryEntry,
): ScoreHistory {
  history.entries.push(entry)
  return analyzeScoreTrend(history)
}

/**
 * Re-compute trend, plateau, best/worst from the current entries.
 * Mutates and returns the same history object.
 */
export function analyzeScoreTrend(history: ScoreHistory): ScoreHistory {
  const entries = history.entries

  if (entries.length === 0) {
    history.trend = "insufficient-data"
    history.plateauLength = 0
    history.bestScore = 0
    history.bestIteration = 0
    history.worstScore = 0
    return history
  }

  // Best / worst
  let bestScore = -Infinity
  let bestIteration = 0
  let worstScore = Infinity

  for (const e of entries) {
    if (e.score > bestScore) {
      bestScore = e.score
      bestIteration = e.iteration
    }
    if (e.score < worstScore) {
      worstScore = e.score
    }
  }
  history.bestScore = bestScore
  history.bestIteration = bestIteration
  history.worstScore = worstScore

  if (entries.length < 2) {
    history.trend = "insufficient-data"
    history.plateauLength = 0
    return history
  }

  // Compute deltas between consecutive entries
  const deltas: number[] = []
  for (let i = 1; i < entries.length; i++) {
    deltas.push(entries[i].score - entries[i - 1].score)
  }

  // Plateau: count consecutive recent iterations with < 2% absolute improvement
  let plateauLength = 0
  for (let i = deltas.length - 1; i >= 0; i--) {
    if (Math.abs(deltas[i]) < 2) {
      plateauLength++
    } else {
      break
    }
  }
  history.plateauLength = plateauLength

  // Trend detection
  // Check for oscillating: alternating sign changes in the last 4+ deltas
  if (deltas.length >= 3) {
    let signChanges = 0
    for (let i = 1; i < deltas.length; i++) {
      if (
        (deltas[i] > 0 && deltas[i - 1] < 0) ||
        (deltas[i] < 0 && deltas[i - 1] > 0)
      ) {
        signChanges++
      }
    }
    // If more than half of consecutive pairs change sign, it's oscillating
    if (signChanges >= Math.floor(deltas.length / 2) && signChanges >= 2) {
      history.trend = "oscillating"
      return history
    }
  }

  // Check recent window (last 3 deltas or all if fewer)
  const recentWindow = deltas.slice(-Math.min(3, deltas.length))
  const recentPositive = recentWindow.filter((d) => d > 0).length
  const recentNegative = recentWindow.filter((d) => d < 0).length
  const recentFlat = recentWindow.filter((d) => Math.abs(d) < 2).length

  if (recentFlat === recentWindow.length) {
    history.trend = "stagnant"
  } else if (recentNegative > recentPositive && recentNegative >= 2) {
    history.trend = "declining"
  } else if (recentPositive > recentNegative) {
    history.trend = "improving"
  } else if (plateauLength >= 2) {
    history.trend = "stagnant"
  } else {
    // Mixed signals with no clear direction
    history.trend = "stagnant"
  }

  return history
}

/**
 * Decide whether the optimiser should pivot (change approach) or refine
 * (continue iterating) based on score history and optional composite scores.
 *
 * Rules (evaluated in order):
 * 1. Plateau >= 3 iterations (< 2% improvement each) -> pivot
 * 2. Declining for 2+ consecutive iterations -> pivot
 * 3. All required dimensions are failing (composite provided) -> pivot
 * 4. Score improving but slowly -> refine
 * 5. Any dimension dramatically improved recently -> refine
 * 6. Otherwise -> refine
 */
export function shouldPivot(
  history: ScoreHistory,
  composite?: CompositeScore | null,
): { pivot: boolean; reason: string } {
  // Not enough data -> refine (keep trying)
  if (history.entries.length < 2) {
    return { pivot: false, reason: "Insufficient history to determine pivot; defaulting to refine." }
  }

  // Rule 1: plateau >= 3 iterations
  if (history.plateauLength >= 3) {
    return {
      pivot: true,
      reason: `Score has plateaued for ${history.plateauLength} consecutive iterations (< 2% change each).`,
    }
  }

  // Rule 2: declining for 2+ iterations
  if (history.trend === "declining") {
    const entries = history.entries
    let consecutiveDeclines = 0
    for (let i = entries.length - 1; i >= 1; i--) {
      if (entries[i].score < entries[i - 1].score) {
        consecutiveDeclines++
      } else {
        break
      }
    }
    if (consecutiveDeclines >= 2) {
      return {
        pivot: true,
        reason: `Score has declined for ${consecutiveDeclines} consecutive iterations.`,
      }
    }
  }

  // Rule 3: all required dimensions failing (when composite is available)
  if (composite && !composite.allRequiredPassed) {
    const failedRequired = composite.dimensions.filter((d) => !d.passed)
    if (failedRequired.length === composite.dimensions.length) {
      return {
        pivot: true,
        reason: `All ${failedRequired.length} dimensions are failing their thresholds.`,
      }
    }
    // Check if it's specifically all the dimensions that failed
    // (allRequiredPassed is false, meaning at least one required dim failed)
    // If we have history showing required dims have been failing consistently, pivot
    if (history.entries.length >= 3 && history.plateauLength >= 2) {
      return {
        pivot: true,
        reason: "Required dimensions failing combined with stagnant score history.",
      }
    }
  }

  // Rule 4 / 5: check for dimension-level dramatic improvement
  if (composite && history.entries.length >= 2) {
    const current = history.entries[history.entries.length - 1]
    const previous = history.entries[history.entries.length - 2]

    if (current.dimensionScores && previous.dimensionScores) {
      for (const [dimId, currentVal] of Object.entries(current.dimensionScores)) {
        const prevVal = previous.dimensionScores[dimId]
        if (prevVal !== undefined && currentVal - prevVal >= 15) {
          return {
            pivot: false,
            reason: `Dimension "${dimId}" improved dramatically (+${currentVal - prevVal}); continuing to refine.`,
          }
        }
      }
    }
  }

  // Rule 4: improving but slowly
  if (history.trend === "improving") {
    return { pivot: false, reason: "Score is still improving; continuing to refine." }
  }

  // Oscillating trend: pivot if oscillating for a while
  if (history.trend === "oscillating" && history.entries.length >= 4) {
    return {
      pivot: true,
      reason: "Score is oscillating without consistent improvement; consider a different approach.",
    }
  }

  // Default: refine
  return { pivot: false, reason: "No clear signal for pivoting; defaulting to refine." }
}

/**
 * Enhanced follow-up decision that considers score history and trend analysis
 * in addition to the current score.
 *
 * When the basic decision would be "needs-refine", this function checks the
 * score history to determine whether to upgrade the verdict to "needs-pivot"
 * if the history suggests refinement is unlikely to succeed.
 *
 * Backward compatible: if no history is provided, falls back to the standard
 * {@link decideBenchOptFollowUp} behavior.
 */
export function decideBenchOptFollowUpWithHistory(
  score: number,
  history: ScoreHistory | null,
  options: {
    policy?: BenchOptRefinePolicy
    budget?: BenchOptIterationBudget
    forcedAction?: BenchOptFollowUpAction | null
    bounded?: boolean
    composite?: CompositeScore | null
  } = {},
): BenchOptStrategyDecision {
  // Start with the standard decision
  const baseDecision = decideBenchOptFollowUp(score, {
    policy: options.policy,
    budget: options.budget,
    forcedAction: options.forcedAction ?? null,
    bounded: options.bounded,
  })

  // If no history provided or the base decision is already terminal (pass/reject),
  // return as-is for backward compatibility.
  if (!history || history.entries.length < 2) {
    return baseDecision
  }

  // Forced actions are never overridden by history analysis
  if (options.forcedAction) {
    return baseDecision
  }

  // Only upgrade "needs-refine" to "needs-pivot" — never downgrade pass/reject
  if (baseDecision.verdict !== "needs-refine") {
    return baseDecision
  }

  // Check if pivot is recommended by history analysis
  const pivotResult = shouldPivot(history, options.composite ?? null)

  if (pivotResult.pivot) {
    return {
      action: "rerun",
      verdict: "needs-pivot",
      reason: `${baseDecision.reason} History analysis: ${pivotResult.reason}`,
      rerun: baseDecision.rerun,
      keep: false,
      reject: false,
      bounded: baseDecision.bounded,
    }
  }

  return baseDecision
}

