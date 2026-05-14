import type { BenchOptPlannerArtifact } from "./planner.ts"
import {
  negotiateSprintContract,
  type GeneratorConstraints,
  type SprintContractNegotiation,
} from "./sprint-contract.ts"
import type { BenchOptRoleContract } from "./strategy.ts"

export interface BenchOptGeneratorInput {
  runId: string
  planner: BenchOptPlannerArtifact
  worktreePath?: string | null
  branchName?: string | null
  preferredFiles?: string[]
  /** Optional constraints the generator applies during contract negotiation. */
  generatorConstraints?: GeneratorConstraints | null
}

export interface BenchOptGeneratorArtifact {
  schemaVersion: 1
  runId: string
  role: "generator"
  contract: BenchOptRoleContract
  plannerRunId: string
  objective: string
  proposedChange: string
  editScope: {
    worktreePath: string | null
    branchName: string | null
    files: string[]
  }
  implementationSteps: string[]
  keepRejectHooks: string[]
  /** Whether the generator accepts the sprint contract from the planner. */
  contractAcknowledged: boolean
  /** Notes about contract feasibility or negotiation outcomes. */
  contractNotes: string[]
  /** Full negotiation record when a sprint contract is present. */
  contractNegotiation: SprintContractNegotiation | null
}

/**
 * Build the generator artifact. When the planner supplies a sprint contract
 * the generator acknowledges (or negotiates) it before proceeding. The
 * negotiation record is stored on the artifact for downstream consumption by
 * the evaluator.
 *
 * @param input - Generator input parameters.
 * @returns A complete `BenchOptGeneratorArtifact`.
 */
export function buildBenchOptGeneratorArtifact(
  input: BenchOptGeneratorInput,
): BenchOptGeneratorArtifact {
  // --- Sprint contract negotiation ---
  const { contractAcknowledged, contractNotes, contractNegotiation } =
    acknowledgeSprintContract(input)

  return {
    schemaVersion: 1,
    runId: input.runId,
    role: "generator",
    contract: {
      role: "generator",
      objective: input.planner.objective,
      responsibilities: [
        "make the smallest coherent change that satisfies the planner",
        "stay inside the requested worktree scope",
        "prepare the candidate for evaluator review",
        "acknowledge the sprint contract before generating code",
      ],
      inputs: [
        "planner artifact",
        "sprint contract",
        "worktree path",
        "candidate file hints",
      ],
      outputs: [
        "candidate change proposal",
        "bounded edit scope",
        "implementation steps",
        "contract acknowledgement",
      ],
    },
    plannerRunId: input.planner.runId,
    objective: input.planner.objective,
    proposedChange: [
      "Generate a minimal candidate change from the planner's decomposition.",
      "Do not rerun the loop here; this role only prepares the edit candidate.",
    ].join(" "),
    editScope: {
      worktreePath: input.worktreePath ?? input.planner.candidateScope.worktreePath,
      branchName: input.branchName ?? null,
      files: [...new Set(input.preferredFiles ?? [])],
    },
    implementationSteps: [
      "identify the smallest relevant files",
      "draft the candidate change",
      "preserve enough evidence for the evaluator",
    ],
    keepRejectHooks: [
      "if the change is promising, hand the artifact to the evaluator for keep/reject",
      "if the plan looks fragile, let the evaluator recommend a rerun instead",
    ],
    contractAcknowledged,
    contractNotes,
    contractNegotiation,
  }
}

/**
 * Acknowledge (and optionally negotiate) the sprint contract attached to the
 * planner artifact. If no contract exists the generator records that fact and
 * proceeds without one.
 */
function acknowledgeSprintContract(
  input: BenchOptGeneratorInput,
): {
  contractAcknowledged: boolean
  contractNotes: string[]
  contractNegotiation: SprintContractNegotiation | null
} {
  const sprintContract = input.planner.sprintContract

  if (!sprintContract) {
    return {
      contractAcknowledged: false,
      contractNotes: [
        "No sprint contract was supplied by the planner. Proceeding without dimension-based acceptance criteria.",
      ],
      contractNegotiation: null,
    }
  }

  const negotiation = negotiateSprintContract(
    sprintContract,
    input.generatorConstraints ?? null,
  )

  const notes: string[] = []

  if (negotiation.generatorAccepted) {
    notes.push("Generator accepted the sprint contract without changes.")
  } else {
    notes.push(
      `Generator proposed ${negotiation.generatorCounterproposals.length} counterproposal(s).`,
    )
    for (const cp of negotiation.generatorCounterproposals) {
      notes.push(`  - ${cp.dimensionId}: threshold lowered to ${cp.proposedThreshold} (${cp.reason})`)
    }
  }

  const dimensionSummary = negotiation.finalContract.dimensions
    .map((d) => `${d.id} (w=${d.weight}, t=${d.threshold})`)
    .join(", ")
  notes.push(`Final contract dimensions: ${dimensionSummary}`)

  return {
    contractAcknowledged: true,
    contractNotes: notes,
    contractNegotiation: negotiation,
  }
}

