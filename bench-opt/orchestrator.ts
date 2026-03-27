import type { BenchOptBaselineSnapshot, BenchOptTrialSplit } from "./types.ts"
import { buildBenchOptEvaluatorArtifact, type BenchOptEvaluatorArtifact, type BenchOptEvaluatorInput } from "./evaluator.ts"
import { buildBenchOptGeneratorArtifact, type BenchOptGeneratorArtifact, type BenchOptGeneratorInput } from "./generator.ts"
import { buildBenchOptPlannerArtifact, type BenchOptPlannerArtifact, type BenchOptPlannerInput } from "./planner.ts"
import type { GeneratorConstraints } from "./sprint-contract.ts"
import {
  createScoreHistory,
  decideBenchOptFollowUpWithHistory,
  recordScore,
  type BenchOptFollowUpAction,
  type BenchOptHandoffRequest,
  type BenchOptStrategyDecision,
  type ScoreHistory,
} from "./strategy.ts"

export interface BenchOptOrchestrationInput {
  runId: string
  objective: string
  baseline: BenchOptBaselineSnapshot | null
  split: BenchOptTrialSplit
  candidateId?: string | null
  worktreePath?: string | null
  branchName?: string | null
  preferredFiles?: string[]
  constraints?: string[]
  observedScore?: number | null
  forcedFollowUp?: BenchOptFollowUpAction | null
  /** Optional generator constraints for sprint contract negotiation. */
  generatorConstraints?: GeneratorConstraints | null
  /**
   * Optional score history carried forward from previous orchestration cycles.
   * When provided, the evaluator decision incorporates trend analysis and
   * pivot detection. Callers that run multiple orchestration cycles in a loop
   * should pass (and accumulate) the history across iterations.
   */
  scoreHistory?: ScoreHistory | null
}

export interface BenchOptRoleAdapters {
  planner?: (input: BenchOptPlannerInput) => Promise<BenchOptPlannerArtifact> | BenchOptPlannerArtifact
  generator?: (input: BenchOptGeneratorInput) => Promise<BenchOptGeneratorArtifact> | BenchOptGeneratorArtifact
  evaluator?: (input: BenchOptEvaluatorInput) => Promise<BenchOptEvaluatorArtifact> | BenchOptEvaluatorArtifact
}

export interface BenchOptOrchestrationArtifact {
  schemaVersion: 1
  runId: string
  generatedAt: string
  objective: string
  bounded: true
  iteration: {
    index: 1
    max: 1
    terminal: true
  }
  planner: BenchOptPlannerArtifact
  generator: BenchOptGeneratorArtifact
  evaluator: BenchOptEvaluatorArtifact
  decision: BenchOptStrategyDecision
  handoff: BenchOptHandoffRequest
  /** Score history accumulated through this orchestration cycle (if tracking is active). */
  scoreHistory: ScoreHistory | null
}

async function resolveRole<T>(value: T | Promise<T>) {
  return await value
}

/**
 * Run a single bounded orchestration cycle: planner -> generator -> evaluator.
 *
 * The flow now includes sprint contract negotiation:
 * 1. Planner produces a contract with weighted acceptance dimensions.
 * 2. Generator acknowledges the contract (or negotiates counterproposals).
 * 3. The finalised contract is available on the generator artifact for the
 *    evaluator to consume when scoring dimensions.
 *
 * @param input    - Orchestration parameters.
 * @param adapters - Optional role overrides for testing or custom pipelines.
 * @returns The complete orchestration artifact.
 */
export async function runBenchOptOrchestration(
  input: BenchOptOrchestrationInput,
  adapters: BenchOptRoleAdapters = {},
): Promise<BenchOptOrchestrationArtifact> {
  // --- Step 1: Planner produces plan + sprint contract ---
  const plannerInput: BenchOptPlannerInput = {
    runId: input.runId,
    objective: input.objective,
    baseline: input.baseline,
    split: input.split,
    candidateId: input.candidateId ?? null,
    worktreePath: input.worktreePath ?? null,
    constraints: input.constraints ?? [],
  }
  const planner = await resolveRole(adapters.planner?.(plannerInput) ?? buildBenchOptPlannerArtifact(plannerInput))

  // --- Step 2: Generator acknowledges / negotiates the contract ---
  const generatorInput: BenchOptGeneratorInput = {
    runId: input.runId,
    planner,
    worktreePath: input.worktreePath ?? planner.candidateScope.worktreePath,
    branchName: input.branchName ?? null,
    preferredFiles: input.preferredFiles ?? [],
    generatorConstraints: input.generatorConstraints ?? null,
  }
  const generator = await resolveRole(adapters.generator?.(generatorInput) ?? buildBenchOptGeneratorArtifact(generatorInput))

  // --- Step 3: Evaluator receives both artifacts (contract lives on generator.contractNegotiation) ---
  const evaluatorInput: BenchOptEvaluatorInput = {
    runId: input.runId,
    planner,
    generator,
    observedScore: input.observedScore ?? null,
    forcedAction: input.forcedFollowUp ?? null,
  }
  const evaluator = await resolveRole(adapters.evaluator?.(evaluatorInput) ?? buildBenchOptEvaluatorArtifact(evaluatorInput))

  // --- Step 4: Apply score history analysis for enhanced pivot/refine decision ---
  const history = input.scoreHistory
    ? { ...input.scoreHistory, entries: [...input.scoreHistory.entries] }
    : createScoreHistory()

  // Build dimension scores map from evaluator output
  const dimScoresMap: Record<string, number> | undefined =
    evaluator.dimensionScores.length > 0
      ? Object.fromEntries(evaluator.dimensionScores.map((d) => [d.dimensionId, d.score]))
      : undefined

  // Record the current score into history
  recordScore(history, {
    iteration: history.entries.length + 1,
    score: evaluator.score,
    dimensionScores: dimScoresMap,
    action: evaluator.recommendation.action,
    timestamp: new Date().toISOString(),
  })

  // Re-evaluate the decision using history-aware logic
  const decision = decideBenchOptFollowUpWithHistory(
    evaluator.score,
    history,
    {
      policy: undefined, // use defaults from evaluator's already-computed policy
      budget: undefined,
      forcedAction: input.forcedFollowUp ?? null,
      bounded: true,
      composite: evaluator.compositeScore ?? null,
    },
  )

  return {
    schemaVersion: 1,
    runId: input.runId,
    generatedAt: new Date().toISOString(),
    objective: input.objective,
    bounded: true,
    iteration: {
      index: 1,
      max: 1,
      terminal: true,
    },
    planner,
    generator,
    evaluator,
    decision,
    handoff: evaluator.handoff,
    scoreHistory: history,
  }
}
