import type {
  BenchArtifactScenarioLike,
  BenchOptBaselineSnapshot,
  BenchOptScoreBreakdown,
} from "../types.ts"
import type { BenchmarkSurface } from "../../bench/types.ts"
import type {
  ToolMutation,
  ToolMutationPlan,
  ToolRegistryConfig,
  ToolRegistryEntry,
} from "../mutate-tools.ts"
import {
  generateToolMutationCandidates,
  validateToolMutations,
} from "../mutate-tools.ts"

// ---------------------------------------------------------------------------
// Candidate types
// ---------------------------------------------------------------------------

/** Policy governing how the tool-config candidate should be applied. */
export interface ToolConfigPolicy {
  /** Whether to validate mutations before applying. */
  validateBeforeApply: boolean
  /** Maximum number of mutations in a single candidate. */
  maxMutations: number
  /** Whether disabling tools is allowed. */
  allowDisable: boolean
  /** Whether adding new tools is allowed. */
  allowAdd: boolean
}

/**
 * A tool configuration candidate following the OptimizerCandidateBase shape.
 *
 * Uses its own `kind` discriminator (`"tool-config"`) rather than extending
 * OptimizerCandidateBase, because the base type constrains `kind` to
 * `"prompt" | "context"`. This keeps the types compatible without modifying
 * the shared type file.
 */
export interface ToolConfigCandidate {
  id: string
  kind: "tool-config"
  label: string
  description: string
  surfaces?: readonly BenchmarkSurface[]
  tags?: readonly string[]
  /** The mutation plan this candidate proposes. */
  plan: ToolMutationPlan
  /** The policy governing this candidate. */
  policy: ToolConfigPolicy
}

// ---------------------------------------------------------------------------
// Input signals
// ---------------------------------------------------------------------------

/** Evaluation signals used to generate tool configuration candidates. */
export interface ToolConfigEvaluationInput {
  /** Current tool registry configuration. */
  currentConfig: ToolRegistryConfig
  /** Baseline snapshot from the most recent optimization run. */
  baseline: BenchOptBaselineSnapshot | null
  /** Score breakdown from the most recent candidate evaluation. */
  breakdown: BenchOptScoreBreakdown | null
  /** Scenarios that failed in the most recent evaluation. */
  failedScenarios: readonly BenchArtifactScenarioLike[]
  /** Scenarios that passed in the most recent evaluation. */
  passedScenarios: readonly BenchArtifactScenarioLike[]
}

// ---------------------------------------------------------------------------
// Default policy
// ---------------------------------------------------------------------------

/**
 * Create a default tool config policy, optionally overriding fields.
 */
export function createToolConfigPolicy(
  overrides: Partial<ToolConfigPolicy> = {},
): ToolConfigPolicy {
  return {
    validateBeforeApply: overrides.validateBeforeApply ?? true,
    maxMutations: overrides.maxMutations ?? 5,
    allowDisable: overrides.allowDisable ?? true,
    allowAdd: overrides.allowAdd ?? false,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Candidate generation
// ---------------------------------------------------------------------------

let candidateCounter = 0

function nextCandidateId(): string {
  candidateCounter += 1
  return `tool-config/${candidateCounter}`
}

/**
 * Reset the internal candidate counter.
 * Useful in tests to get deterministic ids.
 */
export function resetToolConfigCandidateCounter(): void {
  candidateCounter = 0
}

/**
 * Generate tool configuration candidates from evaluation signals.
 *
 * Delegates to `generateToolMutationCandidates` for heuristic plan generation,
 * then wraps each plan in a `ToolConfigCandidate` with validation and policy.
 *
 * @returns An array of candidates, each proposing a different tool mutation strategy.
 */
export function generateToolConfigCandidates(
  input: ToolConfigEvaluationInput,
  policy: ToolConfigPolicy = createToolConfigPolicy(),
): ToolConfigCandidate[] {
  const plans = generateToolMutationCandidates(input.currentConfig, {
    baseline: input.baseline,
    breakdown: input.breakdown,
    failedScenarios: input.failedScenarios,
    passedScenarios: input.passedScenarios,
  })

  const candidates: ToolConfigCandidate[] = []

  for (const plan of plans) {
    // Enforce policy constraints
    let mutations = plan.mutations

    if (!policy.allowDisable) {
      mutations = mutations.filter((m) => m.action !== "disable")
    }
    if (!policy.allowAdd) {
      mutations = mutations.filter((m) => m.action !== "add")
    }
    if (mutations.length > policy.maxMutations) {
      mutations = mutations.slice(0, policy.maxMutations)
    }

    // Skip empty plans after filtering unless it's a no-op plan
    if (mutations.length === 0 && plan.mutations.length > 0) {
      continue
    }

    // Validate if policy requires it
    if (policy.validateBeforeApply && mutations.length > 0) {
      const validation = validateToolMutations(mutations, input.currentConfig)
      if (!validation.valid) {
        // Skip invalid candidates but log the rationale
        continue
      }
    }

    const id = nextCandidateId()
    const mutationSummary = mutations.length > 0
      ? mutations.map((m) => `${m.action} ${m.toolId}`).join(", ")
      : "no changes"

    candidates.push({
      id,
      kind: "tool-config",
      label: `Tool config: ${mutationSummary}`,
      description: plan.rationale,
      tags: buildTags(mutations),
      plan: { mutations, rationale: plan.rationale },
      policy,
    })
  }

  return candidates
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildTags(mutations: readonly ToolMutation[]): string[] {
  const tags = new Set<string>(["phase-1", "tool-config"])

  for (const m of mutations) {
    tags.add(m.action)
  }

  if (mutations.length === 0) tags.add("noop")
  if (mutations.length >= 3) tags.add("broad")
  if (mutations.every((m) => m.action === "modify-params")) tags.add("tuning")

  return [...tags]
}

// ---------------------------------------------------------------------------
// Static candidates
// ---------------------------------------------------------------------------

/**
 * Pre-defined conservative candidate that disables all non-critical optional tools.
 * Useful as a baseline comparison to see if fewer tools improves scores.
 */
export function createMinimalToolConfigCandidate(
  config: ToolRegistryConfig,
): ToolConfigCandidate {
  const mutations: ToolMutation[] = config.tools
    .filter((t) => t.enabled && !t.critical)
    .map((t) => ({ toolId: t.id, action: "disable" as const }))

  return {
    id: "tool-config/minimal",
    kind: "tool-config",
    label: "Minimal tool set (critical only)",
    description: "Disable all non-critical tools to establish a minimal baseline.",
    tags: ["phase-1", "tool-config", "minimal", "baseline"],
    plan: {
      mutations,
      rationale: "Strip the tool set down to critical-only to measure baseline with minimal interference.",
    },
    policy: createToolConfigPolicy({ allowDisable: true }),
  }
}

/**
 * Pre-defined candidate that enables every tool in the registry.
 * Useful as a coverage ceiling measurement.
 */
export function createMaximalToolConfigCandidate(
  config: ToolRegistryConfig,
): ToolConfigCandidate {
  const mutations: ToolMutation[] = config.tools
    .filter((t) => !t.enabled)
    .map((t) => ({ toolId: t.id, action: "enable" as const }))

  return {
    id: "tool-config/maximal",
    kind: "tool-config",
    label: "Maximal tool set (all enabled)",
    description: "Enable every tool in the registry to measure coverage ceiling.",
    tags: ["phase-1", "tool-config", "maximal", "ceiling"],
    plan: {
      mutations,
      rationale: "Enable all tools to establish the upper bound of tool coverage.",
    },
    policy: createToolConfigPolicy({ allowAdd: false }),
  }
}
