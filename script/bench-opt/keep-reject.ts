import type { BenchOptScenarioComparison, BenchOptStructuredComparison, BenchOptStructuredReportLike, BenchOptMutationContext } from "./compare.ts"
import {
  compareBenchOptChampionAndChallenger,
  compareBenchOptReports,
  describeMutationDiff,
} from "./compare.ts"
import type { OptimizerCandidateKind } from "./types.ts"

export type BenchOptKeepRejectDecision = "retain" | "reject" | "promote"

export interface BenchOptKeepRejectThresholds {
  promoteMinAverageDelta: number
  retainMinAverageDelta: number
  retainMaxRegressions: number
}

export interface BenchOptKeepRejectResult {
  decision: BenchOptKeepRejectDecision
  comparison: BenchOptStructuredComparison
  thresholds: BenchOptKeepRejectThresholds
  signals: {
    averageDelta: number | null
    passDelta: number | null
    regressions: number
    improvements: number
    netScenarioDelta: number
    addedScenarios: number
    removedScenarios: number
    comparableScenarios: number
  }
  /** Mutation-specific context notes (populated for tool-config / agent-graph candidates). */
  mutationNotes: string[]
  reasons: string[]
}

export interface BenchOptKeepRejectOptions {
  baselineLabel?: string
  trialLabel?: string
  promoteMinAverageDelta?: number
  retainMinAverageDelta?: number
  retainMaxRegressions?: number
  /** The kind of candidate being evaluated, used to add mutation-specific notes. */
  candidateKind?: OptimizerCandidateKind
  /** Before/after mutation artifacts for tool-config or agent-graph candidates. */
  mutationContext?: BenchOptMutationContext
}

function formatSignedDelta(value: number | null, precision = 1) {
  if (value === null || !Number.isFinite(value)) {
    return "n/a"
  }

  const formatted = precision === 0 ? Math.round(value).toString() : value.toFixed(precision).replace(/\.0+$/, "")
  return value > 0 ? `+${formatted}` : formatted
}

function summarizeScenario(delta: BenchOptScenarioComparison) {
  const direction = delta.status === "improved"
    ? "improved"
    : delta.status === "regressed"
      ? "regressed"
      : delta.status

  return `${delta.id} ${direction}${delta.delta === null ? "" : ` (${formatSignedDelta(delta.delta)})`}`
}

function collectReasons(comparison: BenchOptStructuredComparison, decision: BenchOptKeepRejectDecision) {
  const reasons: string[] = [...comparison.reasons]
  const { averageDelta, passDelta, regressions, improvements, netScenarioDelta, addedScenarios, removedScenarios } = comparison.summary

  reasons.push(`Decision: ${decision}.`)
  reasons.push(`Net scenario balance: ${improvements} improved vs ${regressions} regressed (${formatSignedDelta(netScenarioDelta, 0)}).`)

  if (averageDelta !== null) {
    reasons.push(`Average delta: ${formatSignedDelta(averageDelta)}.`)
  }

  if (passDelta !== null) {
    reasons.push(`Passing delta: ${formatSignedDelta(passDelta, 0)}.`)
  }

  if (addedScenarios > 0) {
    reasons.push(`${addedScenarios} scenario${addedScenarios === 1 ? "" : "s"} added in the trial.`)
  }

  if (removedScenarios > 0) {
    reasons.push(`${removedScenarios} scenario${removedScenarios === 1 ? "" : "s"} removed from the baseline set.`)
  }

  const notable = comparison.scenarioDeltas
    .filter((delta) => delta.status === "improved" || delta.status === "regressed" || delta.status === "new")
    .slice(0, 4)
    .map(summarizeScenario)

  if (notable.length > 0) {
    reasons.push(`Notable deltas: ${notable.join("; ")}.`)
  }

  return reasons
}

function decideFromComparison(
  comparison: BenchOptStructuredComparison,
  thresholds: BenchOptKeepRejectThresholds,
): BenchOptKeepRejectDecision {
  const { averageDelta, regressions, improvements, comparableScenarios } = comparison.summary
  const baselineAvailable = comparison.baseline.available
  const trialAvailable = comparison.trial.available

  if (!trialAvailable || comparison.summary.trial.totalScenarios === 0) {
    return "reject"
  }

  if (!baselineAvailable || comparableScenarios === 0) {
    return regressions === 0 ? "retain" : "reject"
  }

  if (averageDelta !== null && averageDelta >= thresholds.promoteMinAverageDelta && regressions === 0 && improvements > 0) {
    return "promote"
  }

  if (averageDelta !== null && averageDelta >= thresholds.retainMinAverageDelta && regressions <= thresholds.retainMaxRegressions) {
    return "retain"
  }

  if (averageDelta === null && regressions <= thresholds.retainMaxRegressions && improvements >= regressions) {
    return "retain"
  }

  return "reject"
}

/**
 * Produce human-readable context for a mutation-aware candidate kind.
 *
 * For `"tool-config"` candidates, describes which tool changes were made.
 * For `"agent-graph"` candidates, describes which graph changes were made.
 * For `"prompt"` and `"context"` candidates, returns an empty array.
 *
 * @param candidateKind - The kind of candidate being evaluated.
 * @param mutationContext - Optional before/after mutation artifacts.
 * @returns An array of human-readable notes.
 */
export function describeMutationKindContext(
  candidateKind: OptimizerCandidateKind,
  mutationContext?: BenchOptMutationContext | null,
): string[] {
  const notes: string[] = []

  if (candidateKind !== "tool-config" && candidateKind !== "agent-graph") {
    return notes
  }

  notes.push(`Candidate kind: ${candidateKind}.`)

  if (mutationContext) {
    const diff = describeMutationDiff(mutationContext)
    if (diff) {
      notes.push(`Mutation detail: ${diff}.`)
    }
  }

  return notes
}

export function decideBenchOptKeepReject(
  comparison: BenchOptStructuredComparison,
  options: {
    promoteMinAverageDelta?: number
    retainMinAverageDelta?: number
    retainMaxRegressions?: number
    candidateKind?: OptimizerCandidateKind
    mutationContext?: BenchOptMutationContext
  } = {},
): BenchOptKeepRejectResult {
  const thresholds: BenchOptKeepRejectThresholds = {
    promoteMinAverageDelta: options.promoteMinAverageDelta ?? 0.5,
    retainMinAverageDelta: options.retainMinAverageDelta ?? 0,
    retainMaxRegressions: options.retainMaxRegressions ?? 1,
  }

  const decision = decideFromComparison(comparison, thresholds)
  const mutationNotes = describeMutationKindContext(
    options.candidateKind ?? "prompt",
    options.mutationContext,
  )

  const reasons = collectReasons(comparison, decision)
  if (mutationNotes.length > 0) {
    reasons.push(...mutationNotes)
  }

  return {
    decision,
    comparison,
    thresholds,
    signals: {
      averageDelta: comparison.summary.averageDelta,
      passDelta: comparison.summary.passDelta,
      regressions: comparison.summary.regressedScenarios,
      improvements: comparison.summary.improvedScenarios,
      netScenarioDelta: comparison.summary.netScenarioDelta,
      addedScenarios: comparison.summary.addedScenarios,
      removedScenarios: comparison.summary.removedScenarios,
      comparableScenarios: comparison.summary.comparableScenarios,
    },
    mutationNotes,
    reasons,
  }
}

export function compareAndDecideBenchOptKeepReject(
  baselineReport: BenchOptStructuredReportLike,
  trialReport: BenchOptStructuredReportLike,
  options: BenchOptKeepRejectOptions = {},
): BenchOptKeepRejectResult {
  const comparison = compareBenchOptReports(baselineReport, trialReport, {
    baselineLabel: options.baselineLabel,
    trialLabel: options.trialLabel,
  })

  return decideBenchOptKeepReject(comparison, {
    promoteMinAverageDelta: options.promoteMinAverageDelta,
    retainMinAverageDelta: options.retainMinAverageDelta,
    retainMaxRegressions: options.retainMaxRegressions,
    candidateKind: options.candidateKind,
    mutationContext: options.mutationContext,
  })
}

export function compareAndDecideChampionAndChallenger(
  championReport: BenchOptStructuredReportLike,
  challengerReport: BenchOptStructuredReportLike,
  options: Omit<BenchOptKeepRejectOptions, "baselineLabel" | "trialLabel"> & {
    championLabel?: string
    challengerLabel?: string
  } = {},
) {
  const comparison = compareBenchOptChampionAndChallenger(championReport, challengerReport, {
    championLabel: options.championLabel,
    challengerLabel: options.challengerLabel,
  })

  return decideBenchOptKeepReject(comparison, {
    promoteMinAverageDelta: options.promoteMinAverageDelta,
    retainMinAverageDelta: options.retainMinAverageDelta,
    retainMaxRegressions: options.retainMaxRegressions,
    candidateKind: options.candidateKind,
    mutationContext: options.mutationContext,
  })
}
