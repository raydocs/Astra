import type { BenchOptGeneratorArtifact } from "./generator.ts"
import type { BenchOptPlannerArtifact } from "./planner.ts"
import {
  buildBenchOptHandoffRequest,
  createBenchOptIterationBudget,
  createBenchOptRefinePolicy,
  decideBenchOptFollowUp,
  type BenchOptFollowUpAction,
  type BenchOptIterationContext,
  type BenchOptIterationVerdict,
  type BenchOptRoleContract,
  type BenchOptStrategyDecision,
} from "./strategy.ts"
import {
  computeCompositeScore,
  createDefaultScoringConfig,
  deriveVerdictFromComposite,
  renderCompositeScoreMarkdown,
  scoreDimension,
  type CompositeScore,
  type CompositeScoringConfig,
  type DimensionScore,
} from "./composite-scorer.ts"

export interface BenchOptEvaluatorInput {
  runId: string
  planner: BenchOptPlannerArtifact
  generator: BenchOptGeneratorArtifact
  observedScore?: number | null
  forcedAction?: BenchOptFollowUpAction | null
  /**
   * Optional per-dimension raw scores.
   *
   * When provided the evaluator uses the composite scorer to derive verdict
   * and recommendation instead of the single observed score.
   *
   * Keys must match dimension ids in the scoring config (e.g.
   * `"functionality"`, `"productDepth"`, etc.).
   */
  dimensionScores?: Record<string, number> | null
  /**
   * Optional per-dimension evidence strings.
   * Keys must match dimension ids.
   */
  dimensionEvidence?: Record<string, string[]> | null
  /**
   * Optional per-dimension critique strings.
   * Keys must match dimension ids.
   */
  dimensionCritique?: Record<string, string[]> | null
  /** Override the default composite scoring configuration. */
  scoringConfig?: CompositeScoringConfig | null
}

export interface BenchOptEvaluatorArtifact {
  schemaVersion: 1
  runId: string
  role: "evaluator"
  contract: BenchOptRoleContract
  plannerRunId: string
  generatorRunId: string
  score: number
  verdict: BenchOptIterationVerdict
  recommendation: BenchOptStrategyDecision
  critique: string[]
  evidence: string[]
  nextChecks: string[]
  handoff: ReturnType<typeof buildBenchOptHandoffRequest>
  /** Composite multi-dimension score — `null` when only a single score is used. */
  compositeScore: CompositeScore | null
  /** Individual dimension scores — empty when the composite path is not used. */
  dimensionScores: DimensionScore[]
}

/**
 * Build an evaluator artifact.
 *
 * When `input.dimensionScores` is provided the function uses the composite
 * scorer to compute a weighted multi-dimension total and derives the verdict
 * from that composite.  Otherwise it falls back to the original single-score
 * behaviour so existing callers are unaffected.
 */
export function buildBenchOptEvaluatorArtifact(
  input: BenchOptEvaluatorInput,
): BenchOptEvaluatorArtifact {
  const policy = createBenchOptRefinePolicy(input.planner.refinePolicy)
  const budget = createBenchOptIterationBudget(input.planner.iterationBudget)

  // -----------------------------------------------------------------------
  // Composite path — multi-dimension scoring
  // -----------------------------------------------------------------------
  const useComposite =
    input.dimensionScores != null &&
    Object.keys(input.dimensionScores).length > 0

  let compositeResult: CompositeScore | null = null
  let dimensionResults: DimensionScore[] = []
  let score: number
  let recommendation: BenchOptStrategyDecision

  if (useComposite) {
    const config = input.scoringConfig ?? createDefaultScoringConfig()
    const rawScores = input.dimensionScores!

    dimensionResults = Object.entries(rawScores).map(([dimId, rawScore]) =>
      scoreDimension(
        dimId,
        rawScore,
        config,
        input.dimensionEvidence?.[dimId] ?? [],
        input.dimensionCritique?.[dimId] ?? [],
      ),
    )

    compositeResult = computeCompositeScore(dimensionResults, config)
    score = compositeResult.weightedTotal

    const compositeVerdict = deriveVerdictFromComposite(compositeResult)

    // Map the composite verdict to a strategy decision while still
    // respecting forced actions and budget constraints.
    if (input.forcedAction) {
      recommendation = decideBenchOptFollowUp(score, {
        policy,
        budget,
        forcedAction: input.forcedAction,
        bounded: true,
      })
    } else {
      // Derive a decision that honours the composite verdict
      recommendation = mapCompositeVerdictToDecision(compositeVerdict, score, policy, budget)
    }
  } else {
    // -------------------------------------------------------------------
    // Legacy path — single observed score
    // -------------------------------------------------------------------
    score = input.observedScore ?? 0
    recommendation = decideBenchOptFollowUp(score, {
      policy,
      budget,
      forcedAction: input.forcedAction ?? null,
      bounded: true,
    })
  }

  const context: BenchOptIterationContext = {
    runId: input.runId,
    objective: input.planner.objective,
    baseline: null,
    split: input.planner.candidateScope.split,
    candidateId: input.planner.candidateScope.candidateId,
  }

  const critique: string[] = buildCritique(score, policy, compositeResult)
  const evidence: string[] = buildEvidence(input, score, compositeResult)

  return {
    schemaVersion: 1,
    runId: input.runId,
    role: "evaluator",
    contract: {
      role: "evaluator",
      objective: input.planner.objective,
      responsibilities: [
        "judge the generator output independently",
        "emit a skeptical critique with evidence",
        "recommend rerun, keep, or reject",
      ],
      inputs: [
        "planner artifact",
        "generator artifact",
        "observed score",
      ],
      outputs: [
        "evaluation verdict",
        "follow-up recommendation",
        "handoff request",
      ],
    },
    plannerRunId: input.planner.runId,
    generatorRunId: input.generator.runId,
    score,
    verdict: recommendation.verdict,
    recommendation,
    critique,
    evidence,
    nextChecks: [
      "validate whether the next action should rerun the same scope or keep the candidate",
      "reject if the generator evidence is too thin or the score is below the floor",
    ],
    handoff: buildBenchOptHandoffRequest(recommendation, context, {
      retryBudgetRemaining: Math.max(budget.maxReruns - 1, 0),
    }),
    compositeScore: compositeResult,
    dimensionScores: dimensionResults,
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

import type { BenchOptIterationBudget, BenchOptRefinePolicy } from "./strategy.ts"

/** Map a composite-derived verdict to a full strategy decision. */
function mapCompositeVerdictToDecision(
  verdict: BenchOptIterationVerdict,
  score: number,
  policy: BenchOptRefinePolicy,
  budget: BenchOptIterationBudget,
): BenchOptStrategyDecision {
  switch (verdict) {
    case "pass":
      return {
        action: "keep",
        verdict: "pass",
        reason: `Composite weighted score ${score} passed all required dimensions and total threshold.`,
        rerun: false,
        keep: true,
        reject: false,
        bounded: true,
      }
    case "reject":
      return {
        action: "reject",
        verdict: "reject",
        reason: `One or more required dimensions failed their threshold (composite score ${score}).`,
        rerun: false,
        keep: false,
        reject: true,
        bounded: true,
      }
    case "needs-refine":
      return {
        action: budget.maxReruns > 0 ? "rerun" : "reject",
        verdict: budget.maxReruns > 0 ? "needs-refine" : "needs-pivot",
        reason:
          budget.maxReruns > 0
            ? `Composite score ${score} is below the total threshold but required dims passed; rerun budget remains.`
            : `Composite score ${score} is below the total threshold and rerun budget is exhausted.`,
        rerun: budget.maxReruns > 0,
        keep: false,
        reject: budget.maxReruns <= 0,
        bounded: true,
      }
    case "needs-pivot":
      return {
        action: "reject",
        verdict: "needs-pivot",
        reason: `Composite score ${score} suggests a pivot is needed.`,
        rerun: false,
        keep: false,
        reject: true,
        bounded: true,
      }
  }
}

/** Build critique strings — composite-aware when available. */
function buildCritique(
  score: number,
  policy: BenchOptRefinePolicy,
  composite: CompositeScore | null,
): string[] {
  const lines: string[] = []

  if (composite) {
    lines.push(
      composite.overallPass
        ? "The candidate passes the composite evaluation, but the evaluator should still confirm that the evidence is sufficient."
        : "The candidate does not pass the composite evaluation; the evaluator remains skeptical.",
    )

    const failed = composite.dimensions.filter((d) => !d.passed)
    if (failed.length > 0) {
      lines.push(
        `Failed dimensions: ${failed.map((d) => `${d.label} (${d.score}/${d.threshold})`).join(", ")}.`,
      )
    }

    // Include the rendered score card as a critique entry
    lines.push(renderCompositeScoreMarkdown(composite))
  } else {
    // Legacy single-score critique
    lines.push(
      score >= policy.minScoreToKeep
        ? "The candidate clears the keep threshold, but the evaluator should still confirm that the evidence is sufficient."
        : "The candidate does not clearly clear the keep threshold, so the evaluator remains skeptical.",
    )
    lines.push(
      score < policy.minScoreToAvoidReject
        ? "The result looks weak enough to reject unless later rerun evidence improves it."
        : "The result remains plausible enough for another bounded iteration if budget allows.",
    )
  }

  return lines
}

/** Build evidence strings — composite-aware when available. */
function buildEvidence(
  input: BenchOptEvaluatorInput,
  score: number,
  composite: CompositeScore | null,
): string[] {
  const lines: string[] = [
    `observed score ${score}`,
    `planner split ${input.planner.candidateScope.split}`,
    input.generator.editScope.worktreePath
      ? `worktree ${input.generator.editScope.worktreePath}`
      : "worktree path not yet materialized",
  ]

  if (composite) {
    lines.push(
      `composite: ${composite.passedDimensionCount}/${composite.dimensions.length} dimensions passed`,
    )
    lines.push(
      `required dimensions ${composite.allRequiredPassed ? "all passed" : "NOT all passed"}`,
    )
  }

  return lines
}
