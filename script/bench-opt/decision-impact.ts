/**
 * Decision Impact Analysis
 *
 * Analyzes the impact of refine/pivot/keep/reject decisions across sprints
 * within a long-run benchmark, providing aggregate statistics and
 * actionable insights about strategy effectiveness.
 */

import type { SprintResult } from "./long-run.ts"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DecisionImpact {
  sprintIndex: number
  decisionType: "refine" | "pivot" | "keep" | "reject"
  preScore: number
  postScore: number
  scoreDelta: number
  dimensionDeltas: Record<string, number>
  effective: boolean // did the decision improve things?
  reasoning: string
}

export interface DecisionImpactSummary {
  totalDecisions: number
  refineCount: number
  pivotCount: number
  keepCount: number
  rejectCount: number
  avgRefineImprovement: number
  avgPivotImprovement: number
  effectiveDecisionRate: number // % of decisions that improved score
  pivotEfficacy: "high" | "moderate" | "low" | "insufficient-data"
  refineEfficacy: "high" | "moderate" | "low" | "insufficient-data"
  negativeExamples: DecisionImpact[] // decisions that made things worse
  positiveExamples: DecisionImpact[] // best decisions
}

// ---------------------------------------------------------------------------
// Per-Sprint Impact Analysis
// ---------------------------------------------------------------------------

/**
 * Analyze per-sprint decision impact from an array of sprint results.
 *
 * For each sprint that has a `decision` field, we compute:
 * - The pre/post score delta
 * - Per-dimension deltas (when available)
 * - Whether the decision was effective (positive delta)
 * - A human-readable reasoning string
 */
export function analyzeDecisionImpact(sprints: SprintResult[]): DecisionImpact[] {
  const impacts: DecisionImpact[] = []

  for (let i = 0; i < sprints.length; i++) {
    const sprint = sprints[i]
    if (!sprint.decision) continue

    const decision = sprint.decision
    const decisionType = normalizeDecisionType(decision.type)
    const preScore = decision.preScore ?? 0
    const postScore = decision.postScore ?? (sprint.compositeScore?.total ?? 0)
    const scoreDelta = postScore - preScore

    // Compute dimension-level deltas if available
    const dimensionDeltas: Record<string, number> = {}
    if (decision.dimensionDeltas) {
      for (const [dimId, delta] of Object.entries(decision.dimensionDeltas)) {
        dimensionDeltas[dimId] = delta
      }
    }

    const effective = scoreDelta > 0
    const reasoning = buildImpactReasoning(
      decisionType,
      preScore,
      postScore,
      scoreDelta,
      decision.reason,
      decision.triggeredBy,
    )

    impacts.push({
      sprintIndex: sprint.sprintIndex,
      decisionType,
      preScore,
      postScore,
      scoreDelta,
      dimensionDeltas,
      effective,
      reasoning,
    })
  }

  return impacts
}

// ---------------------------------------------------------------------------
// Aggregate Summary
// ---------------------------------------------------------------------------

/**
 * Aggregate an array of {@link DecisionImpact} into a summary with
 * per-type statistics, efficacy ratings, and best/worst examples.
 */
export function summarizeDecisionImpacts(
  impacts: DecisionImpact[],
): DecisionImpactSummary {
  const totalDecisions = impacts.length

  const refineImpacts = impacts.filter((d) => d.decisionType === "refine")
  const pivotImpacts = impacts.filter((d) => d.decisionType === "pivot")
  const keepImpacts = impacts.filter((d) => d.decisionType === "keep")
  const rejectImpacts = impacts.filter((d) => d.decisionType === "reject")

  const refineCount = refineImpacts.length
  const pivotCount = pivotImpacts.length
  const keepCount = keepImpacts.length
  const rejectCount = rejectImpacts.length

  const avgRefineImprovement = computeAvgDelta(refineImpacts)
  const avgPivotImprovement = computeAvgDelta(pivotImpacts)

  const effectiveCount = impacts.filter((d) => d.effective).length
  const effectiveDecisionRate =
    totalDecisions > 0 ? effectiveCount / totalDecisions : 0

  const pivotEfficacy = rateEfficacy(pivotImpacts)
  const refineEfficacy = rateEfficacy(refineImpacts)

  // Collect negative examples (decisions that worsened score)
  const negativeExamples = impacts
    .filter((d) => d.scoreDelta < 0)
    .sort((a, b) => a.scoreDelta - b.scoreDelta) // worst first

  // Collect positive examples (best decisions)
  const positiveExamples = impacts
    .filter((d) => d.scoreDelta > 0)
    .sort((a, b) => b.scoreDelta - a.scoreDelta) // best first

  return {
    totalDecisions,
    refineCount,
    pivotCount,
    keepCount,
    rejectCount,
    avgRefineImprovement: round2(avgRefineImprovement),
    avgPivotImprovement: round2(avgPivotImprovement),
    effectiveDecisionRate: round2(effectiveDecisionRate),
    pivotEfficacy,
    refineEfficacy,
    negativeExamples,
    positiveExamples,
  }
}

// ---------------------------------------------------------------------------
// Markdown Renderer
// ---------------------------------------------------------------------------

/**
 * Render a full decision impact report in Markdown.
 *
 * Includes:
 * - Decision distribution
 * - Efficacy per type
 * - Best/worst examples
 * - Strategy usage summary
 */
export function renderDecisionImpactMarkdown(
  summary: DecisionImpactSummary,
): string {
  const lines: string[] = []

  lines.push("# Decision Impact Analysis")
  lines.push("")

  // --- Decision distribution ---
  lines.push("## Decision Distribution")
  lines.push("")
  if (summary.totalDecisions === 0) {
    lines.push("No decisions recorded.")
    lines.push("")
    return lines.join("\n")
  }

  lines.push("| Decision Type | Count | Percentage |")
  lines.push("|---------------|------:|-----------:|")
  const types: Array<{ label: string; count: number }> = [
    { label: "Refine", count: summary.refineCount },
    { label: "Pivot", count: summary.pivotCount },
    { label: "Keep", count: summary.keepCount },
    { label: "Reject", count: summary.rejectCount },
  ]
  for (const t of types) {
    const pct =
      summary.totalDecisions > 0
        ? ((t.count / summary.totalDecisions) * 100).toFixed(1)
        : "0.0"
    lines.push(`| ${t.label} | ${t.count} | ${pct}% |`)
  }
  lines.push(`| **Total** | **${summary.totalDecisions}** | **100%** |`)
  lines.push("")

  // ASCII pie chart
  lines.push("```")
  const barWidth = 40
  for (const t of types) {
    if (t.count === 0) continue
    const proportion = t.count / summary.totalDecisions
    const filled = Math.max(1, Math.round(proportion * barWidth))
    const bar = "\u2588".repeat(filled) + "\u2591".repeat(barWidth - filled)
    lines.push(
      `  ${t.label.padEnd(8)} ${bar} ${t.count} (${(proportion * 100).toFixed(0)}%)`,
    )
  }
  lines.push("```")
  lines.push("")

  // --- Efficacy per type ---
  lines.push("## Efficacy Per Decision Type")
  lines.push("")
  lines.push("| Type | Avg Improvement | Efficacy Rating |")
  lines.push("|------|----------------:|:----------------|")
  lines.push(
    `| Refine | ${summary.avgRefineImprovement >= 0 ? "+" : ""}${summary.avgRefineImprovement} | ${summary.refineEfficacy} |`,
  )
  lines.push(
    `| Pivot | ${summary.avgPivotImprovement >= 0 ? "+" : ""}${summary.avgPivotImprovement} | ${summary.pivotEfficacy} |`,
  )
  lines.push("")

  lines.push(
    `**Effective decision rate:** ${(summary.effectiveDecisionRate * 100).toFixed(1)}% ` +
      `(${Math.round(summary.effectiveDecisionRate * summary.totalDecisions)}/${summary.totalDecisions} decisions improved the score)`,
  )
  lines.push("")

  // --- Strategy usage summary ---
  lines.push("## Strategy Summary")
  lines.push("")
  lines.push(
    `Strategy used **refine** ${summary.refineCount} time(s) ` +
      `(avg improvement: ${summary.avgRefineImprovement >= 0 ? "+" : ""}${summary.avgRefineImprovement}), ` +
      `**pivot** ${summary.pivotCount} time(s) ` +
      `(avg improvement: ${summary.avgPivotImprovement >= 0 ? "+" : ""}${summary.avgPivotImprovement}).`,
  )
  lines.push("")

  if (summary.keepCount > 0) {
    lines.push(
      `**Keep** was chosen ${summary.keepCount} time(s), indicating the score was already satisfactory.`,
    )
    lines.push("")
  }

  if (summary.rejectCount > 0) {
    lines.push(
      `**Reject** was chosen ${summary.rejectCount} time(s), indicating fundamental quality issues.`,
    )
    lines.push("")
  }

  // --- Best examples ---
  if (summary.positiveExamples.length > 0) {
    lines.push("## Best Decisions")
    lines.push("")
    lines.push("| Sprint | Type | Pre | Post | Delta | Reasoning |")
    lines.push("|-------:|------|----:|-----:|------:|-----------|")
    const topExamples = summary.positiveExamples.slice(0, 5)
    for (const ex of topExamples) {
      lines.push(
        `| ${ex.sprintIndex} | ${ex.decisionType} | ${ex.preScore} | ${ex.postScore} | +${ex.scoreDelta} | ${truncate(ex.reasoning, 60)} |`,
      )
    }
    lines.push("")
  }

  // --- Worst examples ---
  if (summary.negativeExamples.length > 0) {
    lines.push("## Negative Decisions")
    lines.push("")
    lines.push(
      "The following decisions resulted in a score decrease:",
    )
    lines.push("")
    lines.push("| Sprint | Type | Pre | Post | Delta | Reasoning |")
    lines.push("|-------:|------|----:|-----:|------:|-----------|")
    const worstExamples = summary.negativeExamples.slice(0, 5)
    for (const ex of worstExamples) {
      lines.push(
        `| ${ex.sprintIndex} | ${ex.decisionType} | ${ex.preScore} | ${ex.postScore} | ${ex.scoreDelta} | ${truncate(ex.reasoning, 60)} |`,
      )
    }
    lines.push("")
  }

  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function normalizeDecisionType(
  raw: string,
): "refine" | "pivot" | "keep" | "reject" {
  const normalized = raw.toLowerCase().trim()
  if (normalized === "refine") return "refine"
  if (normalized === "pivot") return "pivot"
  if (normalized === "keep") return "keep"
  if (normalized === "reject") return "reject"
  // Fallback: treat unknown types as "keep"
  return "keep"
}

function computeAvgDelta(impacts: DecisionImpact[]): number {
  if (impacts.length === 0) return 0
  const totalDelta = impacts.reduce((sum, d) => sum + d.scoreDelta, 0)
  return totalDelta / impacts.length
}

function rateEfficacy(
  impacts: DecisionImpact[],
): "high" | "moderate" | "low" | "insufficient-data" {
  if (impacts.length < 2) return "insufficient-data"
  const effectiveCount = impacts.filter((d) => d.effective).length
  const rate = effectiveCount / impacts.length
  if (rate >= 0.7) return "high"
  if (rate >= 0.4) return "moderate"
  return "low"
}

function buildImpactReasoning(
  decisionType: string,
  preScore: number,
  postScore: number,
  scoreDelta: number,
  reason: string,
  triggeredBy: string,
): string {
  const direction = scoreDelta > 0 ? "improved" : scoreDelta < 0 ? "worsened" : "unchanged"
  const deltaStr = scoreDelta >= 0 ? `+${scoreDelta}` : `${scoreDelta}`
  return (
    `${decisionType} (${deltaStr}, ${direction}) triggered by ${triggeredBy}: ${reason}`
  )
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s
  return s.slice(0, maxLen - 3) + "..."
}
