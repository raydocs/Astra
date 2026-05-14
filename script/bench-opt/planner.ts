import type { BenchOptBaselineSnapshot, BenchOptTrialSplit } from "./types.ts"
import {
  createSprintContract,
  validateContractCompleteness,
  type SprintContract,
} from "./sprint-contract.ts"
import {
  createBenchOptIterationBudget,
  createBenchOptRefinePolicy,
  type BenchOptIterationBudget,
  type BenchOptRefinePolicy,
  type BenchOptRoleContract,
} from "./strategy.ts"

export interface BenchOptPlannerInput {
  runId: string
  objective: string
  baseline: BenchOptBaselineSnapshot | null
  split: BenchOptTrialSplit
  candidateId?: string | null
  worktreePath?: string | null
  constraints?: string[]
  budget?: Partial<BenchOptIterationBudget>
  policy?: Partial<BenchOptRefinePolicy>
}

export interface BenchOptPlannerArtifact {
  schemaVersion: 1
  runId: string
  role: "planner"
  contract: BenchOptRoleContract
  objective: string
  baseline: {
    available: boolean
    path: string | null
    summary: string[]
  }
  decomposition: string[]
  rubric: string[]
  iterationBudget: BenchOptIterationBudget
  refinePolicy: BenchOptRefinePolicy
  candidateScope: {
    candidateId: string | null
    split: BenchOptTrialSplit
    worktreePath: string | null
  }
  handoffHints: string[]
  /** The proposed sprint contract for this iteration; null if contract generation failed. */
  sprintContract: SprintContract | null
}

function summarizeBaseline(baseline: BenchOptBaselineSnapshot | null) {
  if (!baseline) {
    return {
      available: false,
      path: null,
      summary: ["No baseline snapshot was supplied."],
    }
  }

  const summary = [
    baseline.runId ? `baseline run ${baseline.runId}` : "baseline run unavailable",
    baseline.generatedAt ? `generated ${baseline.generatedAt}` : "generation timestamp unavailable",
    baseline.totalScenarios !== null ? `${baseline.totalScenarios} scenarios` : "scenario count unavailable",
  ]

  if (baseline.averageTotal !== null) {
    summary.push(`average total ${baseline.averageTotal}`)
  }

  if (baseline.failedScenarios !== null) {
    summary.push(`${baseline.failedScenarios} failed scenarios`)
  }

  return {
    available: baseline.available,
    path: baseline.path,
    summary,
  }
}

/**
 * Build the planner artifact for a single sprint iteration. This now includes
 * a `sprintContract` that encodes weighted acceptance criteria the generator
 * and evaluator can consume.
 *
 * @param input - Planner input parameters.
 * @returns A complete `BenchOptPlannerArtifact` with an attached sprint contract.
 */
export function buildBenchOptPlannerArtifact(
  input: BenchOptPlannerInput,
): BenchOptPlannerArtifact {
  const iterationBudget = createBenchOptIterationBudget(input.budget)
  const refinePolicy = createBenchOptRefinePolicy(input.policy)

  // --- Sprint contract generation ---
  const sprintContract = buildSprintContractForObjective(input.runId, input.objective)

  return {
    schemaVersion: 1,
    runId: input.runId,
    role: "planner",
    contract: {
      role: "planner",
      objective: input.objective,
      responsibilities: [
        "decompose the objective into a bounded execution plan",
        "allocate the trial budget",
        "define the evaluation rubric",
        "define refine-vs-pivot thresholds",
        "propose a sprint contract with weighted dimensions",
      ],
      inputs: [
        "objective",
        "baseline",
        "trial split",
        "candidate scope",
        "constraints",
      ],
      outputs: [
        "planner artifact",
        "rubric",
        "iteration budget",
        "follow-up hints",
        "sprint contract",
      ],
    },
    objective: input.objective,
    baseline: summarizeBaseline(input.baseline),
    decomposition: [
      "clarify the target change",
      "bound the work to a single iteration",
      "pick the smallest useful candidate scope",
      "leave rerun / keep / reject as a downstream decision",
    ],
    rubric: [
      "is the proposed work small enough to finish in one bounded pass?",
      "is the scope aligned with the objective and baseline?",
      "does the plan leave enough evidence for the evaluator to judge independently?",
    ],
    iterationBudget,
    refinePolicy,
    candidateScope: {
      candidateId: input.candidateId ?? null,
      split: input.split,
      worktreePath: input.worktreePath ?? null,
    },
    handoffHints: [
      ...(input.constraints ?? []),
      "pass the generated plan and sprint contract to the generator",
      "generator must acknowledge the contract before proceeding",
      "stop after one evaluator pass and hand off a rerun/keep/reject recommendation",
    ],
    sprintContract,
  }
}

/**
 * Build and validate a sprint contract for the given objective. Returns `null`
 * if validation unexpectedly fails (should not happen with defaults, but we
 * guard defensively).
 */
function buildSprintContractForObjective(
  sprintId: string,
  objective: string,
): SprintContract | null {
  const contract = createSprintContract(sprintId, objective)
  const validation = validateContractCompleteness(contract)
  if (!validation.valid) {
    // This is a defensive path — default dimensions should always validate.
    // In production this would be logged to telemetry.
    return null
  }
  return contract
}

