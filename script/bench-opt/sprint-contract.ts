/**
 * Sprint Contract / Done Negotiation System
 *
 * Enables the planner, generator, and evaluator to agree on acceptance
 * criteria BEFORE each sprint begins. The planner proposes a contract with
 * weighted dimensions. The generator may acknowledge or counterpropose
 * thresholds. The evaluator consumes the finalised contract to score each
 * dimension independently rather than relying on a single score threshold.
 */

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

/** A single scoring dimension within a sprint contract. */
export interface SprintDimension {
  /** Machine-readable identifier, e.g. "functionality". */
  id: string
  /** Human-readable label shown in reports. */
  label: string
  /** Weight in [0, 1]. All dimension weights must sum to 1. */
  weight: number
  /** Minimum score (0-100) required to pass this dimension. */
  threshold: number
  /** Prose description of what this dimension measures. */
  description: string
  /** Specific, verifiable acceptance criteria for this sprint. */
  acceptanceCriteria: string[]
}

/** An agreed-upon contract for a single sprint iteration. */
export interface SprintContract {
  schemaVersion: 1
  /** Unique sprint identifier (typically matches the orchestration runId). */
  sprintId: string
  /** The high-level objective this sprint is trying to achieve. */
  objective: string
  /** Scored dimensions that compose the evaluation rubric. */
  dimensions: SprintDimension[]
  /** Weighted average of all dimensions must be >= this value to pass. */
  totalPassThreshold: number
  /** Dimension IDs that must individually pass regardless of the weighted average. */
  requiredDimensions: string[]
  /** ISO-8601 timestamp of when this contract was finalised. */
  negotiatedAt: string
  /** Free-form notes captured during negotiation. */
  negotiationNotes: string[]
}

/** A generator counterproposal targeting a single dimension's threshold. */
export interface SprintContractCounterproposal {
  dimensionId: string
  proposedThreshold: number
  reason: string
}

/** Full negotiation record including the original proposal and final outcome. */
export interface SprintContractNegotiation {
  proposedBy: "planner"
  contract: SprintContract
  generatorAccepted: boolean
  generatorCounterproposals: SprintContractCounterproposal[]
  finalContract: SprintContract
}

/** Optional constraints the generator may supply during negotiation. */
export interface GeneratorConstraints {
  /** Maximum threshold the generator is willing to accept per dimension. */
  maxThresholds?: Record<string, number>
  /** Dimension IDs the generator considers non-applicable. */
  excludeDimensions?: string[]
  /** Free-form feasibility notes. */
  notes?: string[]
}

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

export interface ContractValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// ---------------------------------------------------------------------------
// Default dimensions
// ---------------------------------------------------------------------------

/**
 * Create the five canonical sprint dimensions with sensible default weights
 * and thresholds. The `objective` is threaded into each dimension's acceptance
 * criteria so the contract is always grounded in the sprint goal.
 *
 * @param objective - The sprint's high-level objective.
 * @returns Five `SprintDimension` entries whose weights sum to 1.
 */
export function createDefaultSprintDimensions(
  objective: string,
): SprintDimension[] {
  return [
    {
      id: "functionality",
      label: "Functionality",
      weight: 0.30,
      threshold: 70,
      description:
        "Does the feature work as specified? All declared behaviours should be present and correct.",
      acceptanceCriteria: [
        `The implemented change fulfils the stated objective: "${objective}"`,
        "No regressions in existing functionality",
        "Edge cases identified in the plan are handled or explicitly deferred",
      ],
    },
    {
      id: "productDepth",
      label: "Product Depth",
      weight: 0.25,
      threshold: 60,
      description:
        "Is the implementation more than a shallow stub? The feature should be usable end-to-end.",
      acceptanceCriteria: [
        "The feature is functional beyond a minimal placeholder",
        "Core user-facing flows are wired up and exercisable",
        "Data flows from input to persistence (or equivalent) without manual gaps",
      ],
    },
    {
      id: "uxDesign",
      label: "UX Design",
      weight: 0.15,
      threshold: 50,
      description:
        "Is the user experience reasonable? Interactions should be intuitive and not jarring.",
      acceptanceCriteria: [
        "UI elements are labelled and accessible",
        "Error states surface meaningful feedback",
        "Loading and transition states are handled gracefully",
      ],
    },
    {
      id: "codeQuality",
      label: "Code Quality",
      weight: 0.20,
      threshold: 65,
      description:
        "Is the code clean, typed, and safe? The change should not introduce tech-debt traps.",
      acceptanceCriteria: [
        "TypeScript types are explicit — no untyped `any` leaks",
        "Functions are small and single-purpose",
        "No obvious security issues (XSS, injection, unvalidated input)",
      ],
    },
    {
      id: "maintainability",
      label: "Maintainability",
      weight: 0.10,
      threshold: 50,
      description:
        "Is the code maintainable long-term? Future contributors should be able to reason about it.",
      acceptanceCriteria: [
        "Public APIs have JSDoc or clear naming",
        "No deep coupling to unrelated modules",
        "Test hooks or seams exist for future testing",
      ],
    },
  ]
}

// ---------------------------------------------------------------------------
// Contract creation helper
// ---------------------------------------------------------------------------

/**
 * Build a fresh `SprintContract` for the given sprint, using the default
 * dimension set. Callers may override individual dimensions afterwards.
 *
 * @param sprintId  - Unique sprint / run identifier.
 * @param objective - The sprint's high-level objective.
 * @returns A fully populated `SprintContract`.
 */
export function createSprintContract(
  sprintId: string,
  objective: string,
): SprintContract {
  return {
    schemaVersion: 1,
    sprintId,
    objective,
    dimensions: createDefaultSprintDimensions(objective),
    totalPassThreshold: 65,
    requiredDimensions: ["functionality"],
    negotiatedAt: new Date().toISOString(),
    negotiationNotes: ["Initial contract created from default dimensions."],
  }
}

// ---------------------------------------------------------------------------
// Negotiation
// ---------------------------------------------------------------------------

/**
 * Negotiate a final sprint contract by applying generator counterproposals to
 * the planner's initial proposal. Rules:
 *
 * 1. If no constraints are provided the planner contract is accepted as-is.
 * 2. `excludeDimensions` removes dimensions entirely (and redistributes
 *    weight proportionally).
 * 3. `maxThresholds` caps individual dimension thresholds — the generator
 *    cannot raise them, only lower.
 * 4. A `SprintContractNegotiation` record is returned so the full history is
 *    auditable.
 *
 * @param plannerProposal      - The contract proposed by the planner.
 * @param generatorConstraints - Optional constraints from the generator.
 * @returns The negotiation record containing the final contract.
 */
export function negotiateSprintContract(
  plannerProposal: SprintContract,
  generatorConstraints?: GeneratorConstraints | null,
): SprintContractNegotiation {
  // No constraints → accept as-is
  if (!generatorConstraints) {
    return {
      proposedBy: "planner",
      contract: plannerProposal,
      generatorAccepted: true,
      generatorCounterproposals: [],
      finalContract: plannerProposal,
    }
  }

  const counterproposals: SprintContractCounterproposal[] = []
  const notes: string[] = [...(generatorConstraints.notes ?? [])]

  // Start with a mutable copy of dimensions
  let dimensions = plannerProposal.dimensions.map((d) => ({ ...d }))
  let requiredDimensions = [...plannerProposal.requiredDimensions]

  // 1. Exclude dimensions the generator deems non-applicable
  const excluded = new Set(generatorConstraints.excludeDimensions ?? [])
  if (excluded.size > 0) {
    const removedIds: string[] = []
    dimensions = dimensions.filter((d) => {
      if (excluded.has(d.id)) {
        removedIds.push(d.id)
        counterproposals.push({
          dimensionId: d.id,
          proposedThreshold: 0,
          reason: `Generator excluded dimension "${d.id}" as non-applicable.`,
        })
        return false
      }
      return true
    })
    requiredDimensions = requiredDimensions.filter((id) => !excluded.has(id))

    // Redistribute weight proportionally among remaining dimensions
    if (dimensions.length > 0) {
      const totalRemainingWeight = dimensions.reduce((s, d) => s + d.weight, 0)
      if (totalRemainingWeight > 0) {
        const scale = 1 / totalRemainingWeight
        for (const d of dimensions) {
          d.weight = roundWeight(d.weight * scale)
        }
        // Fix rounding drift on the last dimension
        normaliseWeights(dimensions)
      }
      notes.push(`Excluded dimensions: ${removedIds.join(", ")}. Weights redistributed.`)
    }
  }

  // 2. Apply maxThreshold caps
  const maxThresholds = generatorConstraints.maxThresholds ?? {}
  for (const d of dimensions) {
    const cap = maxThresholds[d.id]
    if (cap !== undefined && cap < d.threshold) {
      counterproposals.push({
        dimensionId: d.id,
        proposedThreshold: cap,
        reason: `Generator capped "${d.id}" threshold from ${d.threshold} to ${cap}.`,
      })
      d.threshold = cap
    }
  }

  const generatorAccepted = counterproposals.length === 0

  const finalContract: SprintContract = {
    ...plannerProposal,
    dimensions,
    requiredDimensions,
    negotiatedAt: new Date().toISOString(),
    negotiationNotes: [
      ...plannerProposal.negotiationNotes,
      ...(generatorAccepted
        ? ["Generator accepted the planner proposal without changes."]
        : counterproposals.map((cp) => cp.reason)),
      ...notes,
    ],
  }

  return {
    proposedBy: "planner",
    contract: plannerProposal,
    generatorAccepted,
    generatorCounterproposals: counterproposals,
    finalContract,
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate that a `SprintContract` is internally consistent:
 *
 * - `dimensions` is non-empty
 * - all weights are in [0, 1] and sum to ~1 (tolerance 0.01)
 * - all thresholds are in [0, 100]
 * - every dimension has at least one acceptance criterion
 * - `requiredDimensions` reference existing dimension IDs
 * - `totalPassThreshold` is in [0, 100]
 *
 * @param contract - The contract to validate.
 * @returns A result containing `valid`, `errors`, and `warnings`.
 */
export function validateContractCompleteness(
  contract: SprintContract,
): ContractValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Must have dimensions
  if (contract.dimensions.length === 0) {
    errors.push("Contract has no dimensions.")
  }

  // Weight validation
  const weightSum = contract.dimensions.reduce((s, d) => s + d.weight, 0)
  if (Math.abs(weightSum - 1) > 0.01) {
    errors.push(
      `Dimension weights sum to ${weightSum.toFixed(4)}, expected ~1.0 (tolerance 0.01).`,
    )
  }

  for (const d of contract.dimensions) {
    if (d.weight < 0 || d.weight > 1) {
      errors.push(`Dimension "${d.id}" has weight ${d.weight} outside [0, 1].`)
    }
    if (d.threshold < 0 || d.threshold > 100) {
      errors.push(
        `Dimension "${d.id}" has threshold ${d.threshold} outside [0, 100].`,
      )
    }
    if (d.acceptanceCriteria.length === 0) {
      errors.push(
        `Dimension "${d.id}" has no acceptance criteria.`,
      )
    }
  }

  // Required dimensions must exist
  const dimensionIds = new Set(contract.dimensions.map((d) => d.id))
  for (const reqId of contract.requiredDimensions) {
    if (!dimensionIds.has(reqId)) {
      errors.push(
        `Required dimension "${reqId}" does not exist in the contract dimensions.`,
      )
    }
  }

  // totalPassThreshold range
  if (contract.totalPassThreshold < 0 || contract.totalPassThreshold > 100) {
    errors.push(
      `totalPassThreshold ${contract.totalPassThreshold} is outside [0, 100].`,
    )
  }

  // Warnings (non-fatal)
  if (contract.requiredDimensions.length === 0) {
    warnings.push("No required dimensions specified — the weighted average alone determines pass/fail.")
  }

  if (contract.negotiationNotes.length === 0) {
    warnings.push("No negotiation notes recorded.")
  }

  for (const d of contract.dimensions) {
    if (d.weight < 0.05) {
      warnings.push(
        `Dimension "${d.id}" has very low weight (${d.weight}). Consider removing it.`,
      )
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Round a weight to 2 decimal places. */
function roundWeight(w: number): number {
  return Math.round(w * 100) / 100
}

/**
 * Fix floating-point drift so weights sum exactly to 1.
 * Adjusts the last dimension by the residual.
 */
function normaliseWeights(dimensions: SprintDimension[]): void {
  if (dimensions.length === 0) return
  const sum = dimensions.reduce((s, d) => s + d.weight, 0)
  const diff = roundWeight(1 - sum)
  if (diff !== 0) {
    dimensions[dimensions.length - 1].weight = roundWeight(
      dimensions[dimensions.length - 1].weight + diff,
    )
  }
}
