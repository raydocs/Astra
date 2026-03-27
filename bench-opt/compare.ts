import type { BenchmarkSurface } from "../bench/types.ts"
import type { OptimizerCandidateKind } from "./types.ts"
import type { ToolRegistryConfig, ToolDiffEntry } from "./mutate-tools.ts"
import type { ExecutionGraph, GraphDiffEntry } from "./mutate-graph.ts"
import { diffToolConfigs } from "./mutate-tools.ts"
import { diffGraphs } from "./mutate-graph.ts"

export interface BenchOptStructuredScenarioLike {
  id: string
  title?: string
  task?: string
  surface?: BenchmarkSurface | string
  fixture?: string
  evaluation?: {
    total?: number
    pass?: boolean
    scores?: Record<string, number>
  }
}

export interface BenchOptStructuredReportLike {
  runId?: string
  generatedAt?: string
  summary?: {
    totalScenarios?: number
    passedScenarios?: number
    failedScenarios?: number
    averageTotal?: number
    surfaces?: Array<{
      surface: string
      scenarioCount: number
      passed: number
      failed: number
      averageTotal: number
    }>
  }
  comparison?: {
    previousRunId?: string | null
    previousGeneratedAt?: string | null
    overallDelta?: number | null
    regressions?: number
    improvements?: number
    unchanged?: number
    added?: number
  }
  scenarios?: BenchOptStructuredScenarioLike[]
}

export interface BenchOptScenarioScoreDelta {
  key: string
  previous: number | null
  current: number | null
  delta: number | null
}

export interface BenchOptScenarioComparison {
  id: string
  title: string | null
  surface: string | null
  fixture: string | null
  previousTotal: number | null
  currentTotal: number | null
  delta: number | null
  status: "new" | "removed" | "improved" | "regressed" | "unchanged"
  wasPassing: boolean | null
  isPassing: boolean | null
  scoreDeltas: BenchOptScenarioScoreDelta[]
}

export interface BenchOptReportSnapshot {
  runId: string | null
  generatedAt: string | null
  totalScenarios: number
  passedScenarios: number
  failedScenarios: number
  averageTotal: number | null
  available: boolean
}

export interface BenchOptComparisonSummary {
  baseline: BenchOptReportSnapshot
  trial: BenchOptReportSnapshot
  comparableScenarios: number
  addedScenarios: number
  removedScenarios: number
  unchangedScenarios: number
  improvedScenarios: number
  regressedScenarios: number
  improvements: number
  regressions: number
  netScenarioDelta: number
  averageDelta: number | null
  passDelta: number | null
}

export interface BenchOptStructuredComparison {
  baselineLabel: string
  trialLabel: string
  baseline: BenchOptReportSnapshot
  trial: BenchOptReportSnapshot
  summary: BenchOptComparisonSummary
  scenarioDeltas: BenchOptScenarioComparison[]
  highlights: {
    bestImprovement: BenchOptScenarioComparison | null
    worstRegression: BenchOptScenarioComparison | null
  }
  reasons: string[]
}

function normalizeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function countPassingScenarios(scenarios: BenchOptStructuredScenarioLike[]) {
  return scenarios.reduce((count, scenario) => count + (scenario.evaluation?.pass ? 1 : 0), 0)
}

function sumScenarioTotals(scenarios: BenchOptStructuredScenarioLike[]) {
  return scenarios.reduce((sum, scenario) => sum + (normalizeNumber(scenario.evaluation?.total) ?? 0), 0)
}

function buildSnapshot(report: BenchOptStructuredReportLike): BenchOptReportSnapshot {
  const scenarios = report.scenarios ?? []
  const totalScenarios = report.summary?.totalScenarios ?? scenarios.length
  const passedScenarios = report.summary?.passedScenarios ?? countPassingScenarios(scenarios)
  const failedScenarios = report.summary?.failedScenarios ?? Math.max(0, totalScenarios - passedScenarios)
  const averageTotal = normalizeNumber(report.summary?.averageTotal)
    ?? (scenarios.length > 0 ? sumScenarioTotals(scenarios) / scenarios.length : null)

  return {
    runId: report.runId ?? null,
    generatedAt: report.generatedAt ?? null,
    totalScenarios,
    passedScenarios,
    failedScenarios,
    averageTotal,
    available: scenarios.length > 0 || report.summary !== undefined || report.runId !== undefined || report.generatedAt !== undefined,
  }
}

function buildScenarioIndex(report: BenchOptStructuredReportLike) {
  const scenarios = report.scenarios ?? []
  const index = new Map<string, BenchOptStructuredScenarioLike>()
  scenarios.forEach((scenario) => {
    index.set(scenario.id, scenario)
  })
  return { scenarios, index }
}

function getScoreKeys(previous: BenchOptStructuredScenarioLike | undefined, current: BenchOptStructuredScenarioLike | undefined) {
  const keys = new Set<string>()
  Object.keys(previous?.evaluation?.scores ?? {}).forEach((key) => keys.add(key))
  Object.keys(current?.evaluation?.scores ?? {}).forEach((key) => keys.add(key))
  return [...keys].sort((left, right) => left.localeCompare(right))
}

function compareScenarios(
  previous: BenchOptStructuredScenarioLike | undefined,
  current: BenchOptStructuredScenarioLike | undefined,
): BenchOptScenarioComparison {
  const previousTotal = normalizeNumber(previous?.evaluation?.total)
  const currentTotal = normalizeNumber(current?.evaluation?.total)
  const scoreKeys = getScoreKeys(previous, current)
  const scoreDeltas = scoreKeys.map((key) => {
    const previousScore = normalizeNumber(previous?.evaluation?.scores?.[key] ?? null)
    const currentScore = normalizeNumber(current?.evaluation?.scores?.[key] ?? null)

    return {
      key,
      previous: previousScore,
      current: currentScore,
      delta: previousScore !== null && currentScore !== null ? currentScore - previousScore : null,
    }
  })

  let status: BenchOptScenarioComparison["status"] = "unchanged"
  if (!previous && current) {
    status = "new"
  } else if (previous && !current) {
    status = "removed"
  } else if (previousTotal !== null && currentTotal !== null) {
    if (currentTotal > previousTotal) {
      status = "improved"
    } else if (currentTotal < previousTotal) {
      status = "regressed"
    }
  }

  return {
    id: current?.id ?? previous?.id ?? "",
    title: current?.title ?? previous?.title ?? null,
    surface: current?.surface ?? previous?.surface ?? null,
    fixture: current?.fixture ?? previous?.fixture ?? null,
    previousTotal,
    currentTotal,
    delta: previousTotal !== null && currentTotal !== null ? currentTotal - previousTotal : null,
    status,
    wasPassing: previous?.evaluation?.pass ?? null,
    isPassing: current?.evaluation?.pass ?? null,
    scoreDeltas,
  }
}

function formatSignedDelta(value: number | null, precision = 1) {
  if (value === null || !Number.isFinite(value)) {
    return "n/a"
  }

  const formatted = precision === 0 ? Math.round(value).toString() : value.toFixed(precision).replace(/\.0+$/, "")
  return value > 0 ? `+${formatted}` : formatted
}

function countStatus(deltas: BenchOptScenarioComparison[], status: BenchOptScenarioComparison["status"]) {
  return deltas.filter((delta) => delta.status === status).length
}

function chooseExtreme(
  deltas: BenchOptScenarioComparison[],
  comparator: (left: BenchOptScenarioComparison, right: BenchOptScenarioComparison) => number,
) {
  return deltas.reduce<BenchOptScenarioComparison | null>((best, current) => {
    if (!best) {
      return current
    }
    return comparator(current, best) < 0 ? current : best
  }, null)
}

export function compareBenchOptReports(
  baselineReport: BenchOptStructuredReportLike,
  trialReport: BenchOptStructuredReportLike,
  options: {
    baselineLabel?: string
    trialLabel?: string
  } = {},
): BenchOptStructuredComparison {
  const baseline = buildSnapshot(baselineReport)
  const trial = buildSnapshot(trialReport)
  const baselineData = buildScenarioIndex(baselineReport)
  const trialData = buildScenarioIndex(trialReport)

  const orderedIds = [
    ...baselineData.scenarios.map((scenario) => scenario.id),
    ...trialData.scenarios.map((scenario) => scenario.id).filter((id) => !baselineData.index.has(id)),
  ]

  const scenarioDeltas = orderedIds.map((id) => compareScenarios(baselineData.index.get(id), trialData.index.get(id)))
  const comparableScenarios = scenarioDeltas.filter((delta) => delta.status !== "new" && delta.status !== "removed").length
  const addedScenarios = countStatus(scenarioDeltas, "new")
  const removedScenarios = countStatus(scenarioDeltas, "removed")
  const unchangedScenarios = countStatus(scenarioDeltas, "unchanged")
  const improvedScenarios = countStatus(scenarioDeltas, "improved")
  const regressedScenarios = countStatus(scenarioDeltas, "regressed")
  const netScenarioDelta = improvedScenarios - regressedScenarios
  const averageDelta = baseline.averageTotal !== null && trial.averageTotal !== null
    ? trial.averageTotal - baseline.averageTotal
    : null
  const passDelta = trial.totalScenarios > 0 || baseline.totalScenarios > 0
    ? trial.passedScenarios - baseline.passedScenarios
    : null

  const bestImprovement = chooseExtreme(
    scenarioDeltas.filter((delta) => delta.status === "improved"),
    (left, right) => (left.delta ?? 0) - (right.delta ?? 0),
  )
  const worstRegression = chooseExtreme(
    scenarioDeltas.filter((delta) => delta.status === "regressed"),
    (left, right) => (left.delta ?? 0) - (right.delta ?? 0),
  )

  const reasons: string[] = []
  reasons.push(`Compared ${options.baselineLabel ?? "baseline"} to ${options.trialLabel ?? "trial"}.`)
  reasons.push(`Scenario totals: ${baseline.totalScenarios} → ${trial.totalScenarios} (${formatSignedDelta(trial.totalScenarios - baseline.totalScenarios, 0)}).`)

  if (averageDelta !== null) {
    reasons.push(`Average score: ${baseline.averageTotal === null ? "n/a" : baseline.averageTotal.toFixed(1)} → ${trial.averageTotal === null ? "n/a" : trial.averageTotal.toFixed(1)} (${formatSignedDelta(averageDelta)}).`)
  } else {
    reasons.push("Average score could not be computed for both reports.")
  }

  if (passDelta !== null) {
    reasons.push(`Passing scenarios: ${baseline.passedScenarios} → ${trial.passedScenarios} (${formatSignedDelta(passDelta, 0)}).`)
  }

  reasons.push(`${improvedScenarios} improved, ${regressedScenarios} regressed, ${unchangedScenarios} unchanged, ${addedScenarios} added, ${removedScenarios} removed.`)

  if (bestImprovement) {
    reasons.push(`Best gain: ${bestImprovement.id} (${formatSignedDelta(bestImprovement.delta)}).`)
  }

  if (worstRegression) {
    reasons.push(`Worst regression: ${worstRegression.id} (${formatSignedDelta(worstRegression.delta)}).`)
  }

  return {
    baselineLabel: options.baselineLabel ?? "baseline",
    trialLabel: options.trialLabel ?? "trial",
    baseline,
    trial,
    summary: {
      baseline,
      trial,
      comparableScenarios,
      addedScenarios,
      removedScenarios,
      unchangedScenarios,
      improvedScenarios,
      regressedScenarios,
      improvements: improvedScenarios,
      regressions: regressedScenarios,
      netScenarioDelta,
      averageDelta,
      passDelta,
    },
    scenarioDeltas,
    highlights: {
      bestImprovement,
      worstRegression,
    },
    reasons,
  }
}

export function compareBenchOptRuns(
  baselineReport: BenchOptStructuredReportLike,
  trialReport: BenchOptStructuredReportLike,
  options: {
    baselineLabel?: string
    trialLabel?: string
  } = {},
) {
  return compareBenchOptReports(baselineReport, trialReport, options)
}

export function compareBenchOptChampionAndChallenger(
  championReport: BenchOptStructuredReportLike,
  challengerReport: BenchOptStructuredReportLike,
  options: {
    championLabel?: string
    challengerLabel?: string
  } = {},
) {
  return compareBenchOptReports(championReport, challengerReport, {
    baselineLabel: options.championLabel ?? "champion",
    trialLabel: options.challengerLabel ?? "challenger",
  })
}

// ---------------------------------------------------------------------------
// Mutation-aware comparison helpers
// ---------------------------------------------------------------------------

/** Context describing tool-config or agent-graph mutations for comparison notes. */
export interface BenchOptMutationContext {
  kind: OptimizerCandidateKind
  toolConfigBefore?: ToolRegistryConfig
  toolConfigAfter?: ToolRegistryConfig
  graphBefore?: ExecutionGraph
  graphAfter?: ExecutionGraph
}

/**
 * Summarize a list of tool diff entries into a single human-readable string.
 *
 * Example output: `"tool-config: enabled 2 tools, disabled 1, modified params on 1"`
 */
function summarizeToolDiff(entries: ToolDiffEntry[]): string {
  let enabled = 0
  let disabled = 0
  let added = 0
  let removed = 0
  let paramChanges = 0

  for (const entry of entries) {
    if (entry.field === "enabled") {
      if (entry.after === true) enabled++
      else disabled++
    } else if (entry.field === "presence") {
      if (entry.after === "added") added++
      else if (entry.after === "removed") removed++
    } else {
      paramChanges++
    }
  }

  const parts: string[] = []
  if (enabled > 0) parts.push(`enabled ${enabled} tool${enabled === 1 ? "" : "s"}`)
  if (disabled > 0) parts.push(`disabled ${disabled} tool${disabled === 1 ? "" : "s"}`)
  if (added > 0) parts.push(`added ${added} tool${added === 1 ? "" : "s"}`)
  if (removed > 0) parts.push(`removed ${removed} tool${removed === 1 ? "" : "s"}`)
  if (paramChanges > 0) parts.push(`modified params on ${paramChanges} field${paramChanges === 1 ? "" : "s"}`)

  return parts.length > 0 ? `tool-config: ${parts.join(", ")}` : "tool-config: no changes"
}

/**
 * Summarize a list of graph diff entries into a single human-readable string.
 *
 * Example output: `"agent-graph: added evaluator node, removed 2 edges"`
 */
function summarizeGraphDiff(entries: GraphDiffEntry[]): string {
  let nodesAdded = 0
  let nodesRemoved = 0
  let nodesModified = 0
  let edgesAdded = 0
  let edgesRemoved = 0
  let entrypointChanged = false

  for (const entry of entries) {
    switch (entry.kind) {
      case "node-added": nodesAdded++; break
      case "node-removed": nodesRemoved++; break
      case "node-modified": nodesModified++; break
      case "edge-added": edgesAdded++; break
      case "edge-removed": edgesRemoved++; break
      case "entrypoint-changed": entrypointChanged = true; break
    }
  }

  const parts: string[] = []
  if (nodesAdded > 0) parts.push(`added ${nodesAdded} node${nodesAdded === 1 ? "" : "s"}`)
  if (nodesRemoved > 0) parts.push(`removed ${nodesRemoved} node${nodesRemoved === 1 ? "" : "s"}`)
  if (nodesModified > 0) parts.push(`modified ${nodesModified} node${nodesModified === 1 ? "" : "s"}`)
  if (edgesAdded > 0) parts.push(`added ${edgesAdded} edge${edgesAdded === 1 ? "" : "s"}`)
  if (edgesRemoved > 0) parts.push(`removed ${edgesRemoved} edge${edgesRemoved === 1 ? "" : "s"}`)
  if (entrypointChanged) parts.push("changed entrypoint")

  return parts.length > 0 ? `agent-graph: ${parts.join(", ")}` : "agent-graph: no changes"
}

/**
 * Produce a human-readable diff summary for a mutation-aware candidate.
 *
 * For `"tool-config"` candidates, diffs the before/after tool registry configs.
 * For `"agent-graph"` candidates, diffs the before/after execution graphs.
 * For `"prompt"` and `"context"` candidates, returns `null` (no mutation diff).
 *
 * @returns A summary string describing what changed, or `null` if not applicable.
 */
export function describeMutationDiff(ctx: BenchOptMutationContext): string | null {
  if (ctx.kind === "tool-config" && ctx.toolConfigBefore && ctx.toolConfigAfter) {
    const entries = diffToolConfigs(ctx.toolConfigBefore, ctx.toolConfigAfter)
    return entries.length > 0 ? summarizeToolDiff(entries) : null
  }

  if (ctx.kind === "agent-graph" && ctx.graphBefore && ctx.graphAfter) {
    const entries = diffGraphs(ctx.graphBefore, ctx.graphAfter)
    return entries.length > 0 ? summarizeGraphDiff(entries) : null
  }

  return null
}

/**
 * Compare two reports and append mutation-specific context to the comparison reasons.
 *
 * Delegates to {@link compareBenchOptReports} for the core comparison, then appends
 * a human-readable mutation diff line if the candidate kind is `"tool-config"` or
 * `"agent-graph"` and before/after artifacts are supplied.
 */
export function compareBenchOptReportsWithMutationContext(
  baselineReport: BenchOptStructuredReportLike,
  trialReport: BenchOptStructuredReportLike,
  options: {
    baselineLabel?: string
    trialLabel?: string
    mutationContext?: BenchOptMutationContext
  } = {},
): BenchOptStructuredComparison {
  const comparison = compareBenchOptReports(baselineReport, trialReport, {
    baselineLabel: options.baselineLabel,
    trialLabel: options.trialLabel,
  })

  if (options.mutationContext) {
    const diff = describeMutationDiff(options.mutationContext)
    if (diff) {
      comparison.reasons.push(`Mutation diff: ${diff}.`)
    }
  }

  return comparison
}
