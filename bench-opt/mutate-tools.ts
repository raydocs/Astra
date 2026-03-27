import type {
  BenchArtifactScenarioLike,
  BenchOptBaselineSnapshot,
  BenchOptScoreBreakdown,
} from "./types.ts"

// ---------------------------------------------------------------------------
// Tool registry types
// ---------------------------------------------------------------------------

/** Parameter metadata for a single tool parameter in the registry. */
export interface ToolParameterMeta {
  type: string
  required?: boolean
  default?: unknown
  values?: readonly string[]
  min?: number
  max?: number
}

/** A single tool entry as stored in `tool-registry.json`. */
export interface ToolRegistryEntry {
  id: string
  name: string
  description: string
  enabled: boolean
  critical: boolean
  category: string
  parameters: Record<string, ToolParameterMeta>
}

/** Top-level shape of `tool-registry.json`. */
export interface ToolRegistryConfig {
  schemaVersion: number
  tools: ToolRegistryEntry[]
}

// ---------------------------------------------------------------------------
// Mutation types
// ---------------------------------------------------------------------------

/** Describes a single atomic mutation to a tool in the registry. */
export interface ToolMutation {
  /** The `id` of the tool being mutated. */
  toolId: string
  /** What kind of change to apply. */
  action: "enable" | "disable" | "modify-params" | "add" | "remove"
  /** Parameter overrides (used with `modify-params` and `add`). */
  params?: Record<string, unknown>
  /** Full tool entry required when `action` is `add`. */
  toolEntry?: ToolRegistryEntry
}

/** An ordered list of mutations with a human-readable rationale. */
export interface ToolMutationPlan {
  mutations: ToolMutation[]
  rationale: string
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Result of validating a set of mutations. */
export interface ToolMutationValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate that a set of mutations is safe to apply.
 *
 * Rules:
 * - Cannot disable or remove a tool marked `critical`.
 * - `add` mutations must include a `toolEntry`.
 * - `modify-params` mutations must reference an existing tool.
 * - Duplicate tool ids across `add` mutations are rejected.
 */
export function validateToolMutations(
  mutations: readonly ToolMutation[],
  config?: ToolRegistryConfig,
): ToolMutationValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const toolIndex = new Map<string, ToolRegistryEntry>()

  if (config) {
    for (const tool of config.tools) {
      toolIndex.set(tool.id, tool)
    }
  }

  const seenAdds = new Set<string>()

  for (const mutation of mutations) {
    const existing = toolIndex.get(mutation.toolId)

    switch (mutation.action) {
      case "disable":
      case "remove": {
        if (existing?.critical) {
          errors.push(
            `Cannot ${mutation.action} critical tool "${mutation.toolId}".`,
          )
        }
        if (!existing && config) {
          warnings.push(
            `Tool "${mutation.toolId}" not found in registry; ${mutation.action} will be a no-op.`,
          )
        }
        break
      }

      case "add": {
        if (!mutation.toolEntry) {
          errors.push(
            `Mutation "add" for "${mutation.toolId}" requires a toolEntry.`,
          )
        }
        if (existing) {
          warnings.push(
            `Tool "${mutation.toolId}" already exists; add will overwrite.`,
          )
        }
        if (seenAdds.has(mutation.toolId)) {
          errors.push(
            `Duplicate add mutation for tool "${mutation.toolId}".`,
          )
        }
        seenAdds.add(mutation.toolId)
        break
      }

      case "modify-params": {
        if (!existing && config) {
          errors.push(
            `Cannot modify-params for unknown tool "${mutation.toolId}".`,
          )
        }
        if (!mutation.params || Object.keys(mutation.params).length === 0) {
          warnings.push(
            `modify-params for "${mutation.toolId}" has no params; mutation is a no-op.`,
          )
        }
        if (existing && mutation.params) {
          for (const key of Object.keys(mutation.params)) {
            if (!(key in existing.parameters)) {
              warnings.push(
                `Parameter "${key}" does not exist on tool "${mutation.toolId}".`,
              )
            }
          }
        }
        break
      }

      case "enable": {
        if (!existing && config) {
          warnings.push(
            `Tool "${mutation.toolId}" not found in registry; enable will be a no-op.`,
          )
        }
        break
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

// ---------------------------------------------------------------------------
// Apply mutations
// ---------------------------------------------------------------------------

/**
 * Apply an ordered list of tool mutations to a registry config.
 *
 * Returns a new config object; the original is never mutated.
 */
export function applyToolMutations(
  config: ToolRegistryConfig,
  mutations: readonly ToolMutation[],
): ToolRegistryConfig {
  let tools = config.tools.map((t) => ({ ...t, parameters: { ...t.parameters } }))

  for (const mutation of mutations) {
    switch (mutation.action) {
      case "enable": {
        tools = tools.map((t) =>
          t.id === mutation.toolId ? { ...t, enabled: true } : t,
        )
        break
      }

      case "disable": {
        tools = tools.map((t) =>
          t.id === mutation.toolId ? { ...t, enabled: false } : t,
        )
        break
      }

      case "remove": {
        tools = tools.filter((t) => t.id !== mutation.toolId)
        break
      }

      case "add": {
        if (mutation.toolEntry) {
          const existing = tools.findIndex((t) => t.id === mutation.toolId)
          const entry = { ...mutation.toolEntry, parameters: { ...mutation.toolEntry.parameters } }
          if (existing >= 0) {
            tools[existing] = entry
          } else {
            tools.push(entry)
          }
        }
        break
      }

      case "modify-params": {
        if (mutation.params) {
          tools = tools.map((t) => {
            if (t.id !== mutation.toolId) return t
            const updatedParams = { ...t.parameters }
            for (const [key, value] of Object.entries(mutation.params!)) {
              if (key in updatedParams) {
                updatedParams[key] = { ...updatedParams[key], default: value }
              }
            }
            return { ...t, parameters: updatedParams }
          })
        }
        break
      }
    }
  }

  return { schemaVersion: config.schemaVersion, tools }
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

/** A single line in a human-readable tool config diff. */
export interface ToolDiffEntry {
  toolId: string
  field: string
  before: unknown
  after: unknown
}

/**
 * Produce a human-readable diff between two tool registry configs.
 *
 * Compares tool presence, enabled state, and parameter defaults.
 */
export function diffToolConfigs(
  before: ToolRegistryConfig,
  after: ToolRegistryConfig,
): ToolDiffEntry[] {
  const entries: ToolDiffEntry[] = []
  const beforeMap = new Map(before.tools.map((t) => [t.id, t]))
  const afterMap = new Map(after.tools.map((t) => [t.id, t]))

  // Tools removed
  for (const [id] of beforeMap) {
    if (!afterMap.has(id)) {
      entries.push({ toolId: id, field: "presence", before: "present", after: "removed" })
    }
  }

  // Tools added
  for (const [id] of afterMap) {
    if (!beforeMap.has(id)) {
      entries.push({ toolId: id, field: "presence", before: "absent", after: "added" })
    }
  }

  // Tools modified
  for (const [id, beforeTool] of beforeMap) {
    const afterTool = afterMap.get(id)
    if (!afterTool) continue

    if (beforeTool.enabled !== afterTool.enabled) {
      entries.push({ toolId: id, field: "enabled", before: beforeTool.enabled, after: afterTool.enabled })
    }

    // Compare parameter defaults
    const allParamKeys = new Set([
      ...Object.keys(beforeTool.parameters),
      ...Object.keys(afterTool.parameters),
    ])

    for (const key of allParamKeys) {
      const bParam = beforeTool.parameters[key]
      const aParam = afterTool.parameters[key]

      if (!bParam && aParam) {
        entries.push({ toolId: id, field: `param.${key}`, before: undefined, after: aParam.default })
      } else if (bParam && !aParam) {
        entries.push({ toolId: id, field: `param.${key}`, before: bParam.default, after: undefined })
      } else if (bParam && aParam) {
        const bDefault = JSON.stringify(bParam.default)
        const aDefault = JSON.stringify(aParam.default)
        if (bDefault !== aDefault) {
          entries.push({ toolId: id, field: `param.${key}.default`, before: bParam.default, after: aParam.default })
        }
      }
    }
  }

  return entries
}

// ---------------------------------------------------------------------------
// Candidate generation
// ---------------------------------------------------------------------------

/** Input signals the candidate generator uses to suggest tool mutations. */
export interface ToolMutationEvaluationSignals {
  baseline: BenchOptBaselineSnapshot | null
  breakdown: BenchOptScoreBreakdown | null
  failedScenarios: readonly BenchArtifactScenarioLike[]
  passedScenarios: readonly BenchArtifactScenarioLike[]
}

/**
 * Suggest tool mutations based on evaluation results.
 *
 * Heuristics:
 * 1. If many scenarios of a specific surface fail, try disabling non-critical
 *    tools in that surface's category to reduce noise.
 * 2. If the baseline shows low artifact alignment, try enabling disabled tools
 *    that might add coverage.
 * 3. If prompt clarity is low relative to context coverage, adjust tool
 *    parameters to produce more concise output.
 */
export function generateToolMutationCandidates(
  currentConfig: ToolRegistryConfig,
  signals: ToolMutationEvaluationSignals,
): ToolMutationPlan[] {
  const plans: ToolMutationPlan[] = []
  const enabledTools = currentConfig.tools.filter((t) => t.enabled)
  const disabledTools = currentConfig.tools.filter((t) => !t.enabled)

  // --- Heuristic 1: Disable noisy non-critical tools for failing surfaces ---
  const failedSurfaces = new Set<string>()
  for (const scenario of signals.failedScenarios) {
    if (scenario.surface) failedSurfaces.add(scenario.surface)
  }

  if (failedSurfaces.size > 0) {
    const disableMutations: ToolMutation[] = []
    for (const tool of enabledTools) {
      if (tool.critical) continue
      // If the tool's category overlaps with a failing surface name, consider
      // disabling it to reduce interference.
      const categoryLower = tool.category.toLowerCase()
      for (const surface of failedSurfaces) {
        if (categoryLower.includes(surface.toLowerCase()) || surface.toLowerCase().includes(categoryLower)) {
          continue // keep tools in the failing surface's category
        }
      }
      // Disable tools outside the failing surface categories to reduce noise
      const matchesFailing = [...failedSurfaces].some(
        (s) => categoryLower.includes(s.toLowerCase()) || s.toLowerCase().includes(categoryLower),
      )
      if (!matchesFailing && disableMutations.length < 2) {
        disableMutations.push({ toolId: tool.id, action: "disable" })
      }
    }

    if (disableMutations.length > 0) {
      plans.push({
        mutations: disableMutations,
        rationale: `Disable ${disableMutations.length} non-critical tool(s) outside the failing surface categories (${[...failedSurfaces].join(", ")}) to reduce interference.`,
      })
    }
  }

  // --- Heuristic 2: Enable disabled tools for better coverage ---
  if (disabledTools.length > 0 && signals.breakdown) {
    const alignmentWeak = signals.breakdown.artifactAlignment < 10
    if (alignmentWeak) {
      const enableMutations: ToolMutation[] = disabledTools
        .slice(0, 2)
        .map((t) => ({ toolId: t.id, action: "enable" as const }))

      if (enableMutations.length > 0) {
        plans.push({
          mutations: enableMutations,
          rationale: `Artifact alignment is weak (${signals.breakdown.artifactAlignment}); enable ${enableMutations.length} previously disabled tool(s) to improve coverage.`,
        })
      }
    }
  }

  // --- Heuristic 3: Tune parameters when prompt clarity is disproportionate ---
  if (signals.breakdown) {
    const clarityLow = signals.breakdown.promptClarity < 15
    const coverageHigh = signals.breakdown.contextCoverage > 20

    if (clarityLow && coverageHigh) {
      const tuningMutations: ToolMutation[] = []
      for (const tool of enabledTools) {
        // Find number-type params with tunable defaults
        for (const [key, meta] of Object.entries(tool.parameters)) {
          if (meta.type === "number" && typeof meta.default === "number" && meta.min != null && meta.max != null) {
            // Reduce towards minimum to produce tighter output
            const reducedValue = Math.round(meta.default * 0.7)
            const clamped = Math.max(meta.min, Math.min(meta.max, reducedValue))
            if (clamped !== meta.default) {
              tuningMutations.push({
                toolId: tool.id,
                action: "modify-params",
                params: { [key]: clamped },
              })
            }
          }
        }
        if (tuningMutations.length >= 3) break
      }

      if (tuningMutations.length > 0) {
        plans.push({
          mutations: tuningMutations,
          rationale: `Prompt clarity (${signals.breakdown.promptClarity}) is low relative to context coverage (${signals.breakdown.contextCoverage}); reduce numeric tool parameters to produce more concise output.`,
        })
      }
    }
  }

  // --- Heuristic 4: Broaden coverage when both scores are low ---
  if (signals.breakdown) {
    const bothLow = signals.breakdown.promptClarity < 10 && signals.breakdown.contextCoverage < 10
    if (bothLow && disabledTools.length > 0) {
      const broadenMutations: ToolMutation[] = disabledTools
        .slice(0, 3)
        .map((t) => ({ toolId: t.id, action: "enable" as const }))

      plans.push({
        mutations: broadenMutations,
        rationale: `Both prompt clarity (${signals.breakdown.promptClarity}) and context coverage (${signals.breakdown.contextCoverage}) are low; enable all available tools as a broad recovery attempt.`,
      })
    }
  }

  // --- Fallback: if no heuristics matched, generate a no-op plan ---
  if (plans.length === 0) {
    plans.push({
      mutations: [],
      rationale: "No actionable tool mutations identified from current evaluation signals.",
    })
  }

  return plans
}
