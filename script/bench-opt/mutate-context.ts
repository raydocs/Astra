import type {
  BenchArtifactScenarioLike,
  BenchOptBaselineSnapshot,
  BenchOptResolvedContextConfig,
  BenchOptScoreBreakdown,
  OptimizerContextSlot,
} from "./types.ts"

// ---------------------------------------------------------------------------
// Context policy types
// ---------------------------------------------------------------------------

/** A collection of context policies keyed by id. */
export interface ContextPolicySet {
  schemaVersion: number
  policies: ContextPolicyEntry[]
}

/** A single context policy entry. */
export interface ContextPolicyEntry {
  id: string
  label: string
  description: string
  /** Whether this policy is the required base policy (cannot be removed). */
  required?: boolean
  /** Context slots this policy populates. */
  slots: readonly OptimizerContextSlot[]
  /** Strategy configuration for context assembly. */
  strategy: ContextPolicyStrategy
  /** Sources that feed into this policy. */
  sources: ContextPolicySource[]
  tags: readonly string[]
}

/** Strategy governs how the context window is assembled. */
export interface ContextPolicyStrategy {
  rankingMode: "balanced" | "explicit-first" | "recency-first"
  maxFiles: number
  maxLinesPerFile: number
  preferHistory: boolean
}

/** A single source that contributes context lines. */
export interface ContextPolicySource {
  kind: "file" | "fixture" | "history" | "report" | "patch-hint"
  path?: string
  weight: number
  maxLines?: number
}

// ---------------------------------------------------------------------------
// Mutation types
// ---------------------------------------------------------------------------

/** Describes a single atomic mutation to a context policy. */
export interface ContextMutation {
  /** The id of the policy being mutated. */
  policyId: string
  /** What kind of change to apply. */
  action: "replace" | "modify-window" | "modify-strategy" | "add-source" | "remove-source"
  /** Action-specific parameters. */
  params: Record<string, unknown>
}

/** An ordered list of context mutations with a human-readable rationale. */
export interface ContextMutationPlan {
  mutations: ContextMutation[]
  rationale: string
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Result of validating a set of context mutations. */
export interface ContextMutationValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate that a set of context mutations is safe to apply.
 *
 * Rules:
 * - Cannot remove a policy marked `required`.
 * - `replace` must include a full policy entry via `params.policyEntry`.
 * - `modify-window` must include at least one window parameter (maxFiles or maxLinesPerFile).
 * - `modify-strategy` must include at least one strategy parameter.
 * - `add-source` must include a valid source via `params.source`.
 * - `remove-source` must specify `params.sourceKind` or `params.sourcePath`.
 * - Removing all sources from a required policy is rejected.
 */
export function validateContextMutations(
  mutations: readonly ContextMutation[],
  config?: ContextPolicySet,
): ContextMutationValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const policyIndex = new Map<string, ContextPolicyEntry>()

  if (config) {
    for (const policy of config.policies) {
      policyIndex.set(policy.id, policy)
    }
  }

  for (const mutation of mutations) {
    const existing = policyIndex.get(mutation.policyId)

    switch (mutation.action) {
      case "replace": {
        const entry = mutation.params.policyEntry as ContextPolicyEntry | undefined
        if (!entry) {
          errors.push(
            `Mutation "replace" for "${mutation.policyId}" requires a policyEntry in params.`,
          )
        }
        if (!existing && config) {
          warnings.push(
            `Policy "${mutation.policyId}" not found in config; replace will create a new entry.`,
          )
        }
        break
      }

      case "modify-window": {
        const hasMaxFiles = mutation.params.maxFiles !== undefined
        const hasMaxLines = mutation.params.maxLinesPerFile !== undefined
        if (!hasMaxFiles && !hasMaxLines) {
          errors.push(
            `modify-window for "${mutation.policyId}" requires at least one of maxFiles or maxLinesPerFile.`,
          )
        }
        if (hasMaxFiles && typeof mutation.params.maxFiles === "number" && mutation.params.maxFiles < 1) {
          errors.push(
            `modify-window for "${mutation.policyId}" cannot set maxFiles below 1.`,
          )
        }
        if (hasMaxLines && typeof mutation.params.maxLinesPerFile === "number" && mutation.params.maxLinesPerFile < 1) {
          errors.push(
            `modify-window for "${mutation.policyId}" cannot set maxLinesPerFile below 1.`,
          )
        }
        if (!existing && config) {
          warnings.push(
            `Policy "${mutation.policyId}" not found in config; modify-window will be a no-op.`,
          )
        }
        break
      }

      case "modify-strategy": {
        const hasRankingMode = mutation.params.rankingMode !== undefined
        const hasPreferHistory = mutation.params.preferHistory !== undefined
        if (!hasRankingMode && !hasPreferHistory) {
          errors.push(
            `modify-strategy for "${mutation.policyId}" requires at least one of rankingMode or preferHistory.`,
          )
        }
        if (hasRankingMode) {
          const valid = ["balanced", "explicit-first", "recency-first"]
          if (!valid.includes(mutation.params.rankingMode as string)) {
            errors.push(
              `modify-strategy for "${mutation.policyId}" has invalid rankingMode "${mutation.params.rankingMode}"; expected one of: ${valid.join(", ")}.`,
            )
          }
        }
        if (!existing && config) {
          warnings.push(
            `Policy "${mutation.policyId}" not found in config; modify-strategy will be a no-op.`,
          )
        }
        break
      }

      case "add-source": {
        const source = mutation.params.source as ContextPolicySource | undefined
        if (!source) {
          errors.push(
            `add-source for "${mutation.policyId}" requires a source in params.`,
          )
        } else {
          const validKinds = ["file", "fixture", "history", "report", "patch-hint"]
          if (!validKinds.includes(source.kind)) {
            errors.push(
              `add-source for "${mutation.policyId}" has invalid source kind "${source.kind}"; expected one of: ${validKinds.join(", ")}.`,
            )
          }
          if (source.weight < 0) {
            warnings.push(
              `add-source for "${mutation.policyId}" has a negative weight (${source.weight}); this may produce unexpected ranking.`,
            )
          }
        }
        if (!existing && config) {
          warnings.push(
            `Policy "${mutation.policyId}" not found in config; add-source will be a no-op.`,
          )
        }
        break
      }

      case "remove-source": {
        const sourceKind = mutation.params.sourceKind as string | undefined
        const sourcePath = mutation.params.sourcePath as string | undefined
        if (!sourceKind && !sourcePath) {
          errors.push(
            `remove-source for "${mutation.policyId}" requires sourceKind or sourcePath in params.`,
          )
        }
        if (existing?.required) {
          // Check if this would remove the last source
          const remainingAfterRemoval = existing.sources.filter((s) => {
            if (sourceKind && s.kind === sourceKind) return false
            if (sourcePath && s.path === sourcePath) return false
            return true
          })
          if (remainingAfterRemoval.length === 0) {
            errors.push(
              `Cannot remove all sources from required policy "${mutation.policyId}".`,
            )
          }
        }
        if (!existing && config) {
          warnings.push(
            `Policy "${mutation.policyId}" not found in config; remove-source will be a no-op.`,
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
 * Apply an ordered list of context mutations to a policy set.
 *
 * Returns a new config object; the original is never mutated.
 */
export function applyContextMutations(
  config: ContextPolicySet,
  mutations: readonly ContextMutation[],
): ContextPolicySet {
  let policies = config.policies.map((p) => ({
    ...p,
    slots: [...p.slots],
    strategy: { ...p.strategy },
    sources: p.sources.map((s) => ({ ...s })),
    tags: [...p.tags],
  }))

  for (const mutation of mutations) {
    switch (mutation.action) {
      case "replace": {
        const entry = mutation.params.policyEntry as ContextPolicyEntry | undefined
        if (entry) {
          const idx = policies.findIndex((p) => p.id === mutation.policyId)
          const newEntry = {
            ...entry,
            slots: [...entry.slots],
            strategy: { ...entry.strategy },
            sources: entry.sources.map((s) => ({ ...s })),
            tags: [...entry.tags],
          }
          if (idx >= 0) {
            policies[idx] = newEntry
          } else {
            policies.push(newEntry)
          }
        }
        break
      }

      case "modify-window": {
        policies = policies.map((p) => {
          if (p.id !== mutation.policyId) return p
          const updatedStrategy = { ...p.strategy }
          if (typeof mutation.params.maxFiles === "number") {
            updatedStrategy.maxFiles = mutation.params.maxFiles
          }
          if (typeof mutation.params.maxLinesPerFile === "number") {
            updatedStrategy.maxLinesPerFile = mutation.params.maxLinesPerFile
          }
          return { ...p, strategy: updatedStrategy }
        })
        break
      }

      case "modify-strategy": {
        policies = policies.map((p) => {
          if (p.id !== mutation.policyId) return p
          const updatedStrategy = { ...p.strategy }
          if (mutation.params.rankingMode !== undefined) {
            updatedStrategy.rankingMode = mutation.params.rankingMode as ContextPolicyStrategy["rankingMode"]
          }
          if (mutation.params.preferHistory !== undefined) {
            updatedStrategy.preferHistory = mutation.params.preferHistory as boolean
          }
          return { ...p, strategy: updatedStrategy }
        })
        break
      }

      case "add-source": {
        const source = mutation.params.source as ContextPolicySource | undefined
        if (source) {
          policies = policies.map((p) => {
            if (p.id !== mutation.policyId) return p
            // Avoid duplicate sources by kind+path
            const exists = p.sources.some(
              (s) => s.kind === source.kind && s.path === source.path,
            )
            if (exists) return p
            return { ...p, sources: [...p.sources, { ...source }] }
          })
        }
        break
      }

      case "remove-source": {
        const sourceKind = mutation.params.sourceKind as string | undefined
        const sourcePath = mutation.params.sourcePath as string | undefined
        policies = policies.map((p) => {
          if (p.id !== mutation.policyId) return p
          const filteredSources = p.sources.filter((s) => {
            if (sourceKind && s.kind === sourceKind) return false
            if (sourcePath && s.path === sourcePath) return false
            return true
          })
          return { ...p, sources: filteredSources }
        })
        break
      }
    }
  }

  return { schemaVersion: config.schemaVersion, policies }
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

/** A single entry in a human-readable context config diff. */
export interface ContextDiffEntry {
  policyId: string
  field: string
  before: unknown
  after: unknown
}

/**
 * Produce a human-readable diff between two context policy sets.
 *
 * Compares policy presence, strategy parameters, window parameters, and sources.
 */
export function diffContextConfigs(
  before: ContextPolicySet,
  after: ContextPolicySet,
): ContextDiffEntry[] {
  const entries: ContextDiffEntry[] = []
  const beforeMap = new Map(before.policies.map((p) => [p.id, p]))
  const afterMap = new Map(after.policies.map((p) => [p.id, p]))

  // Policies removed
  for (const [id] of beforeMap) {
    if (!afterMap.has(id)) {
      entries.push({ policyId: id, field: "presence", before: "present", after: "removed" })
    }
  }

  // Policies added
  for (const [id] of afterMap) {
    if (!beforeMap.has(id)) {
      entries.push({ policyId: id, field: "presence", before: "absent", after: "added" })
    }
  }

  // Policies modified
  for (const [id, beforePolicy] of beforeMap) {
    const afterPolicy = afterMap.get(id)
    if (!afterPolicy) continue

    // Strategy changes
    if (beforePolicy.strategy.rankingMode !== afterPolicy.strategy.rankingMode) {
      entries.push({
        policyId: id,
        field: "strategy.rankingMode",
        before: beforePolicy.strategy.rankingMode,
        after: afterPolicy.strategy.rankingMode,
      })
    }
    if (beforePolicy.strategy.maxFiles !== afterPolicy.strategy.maxFiles) {
      entries.push({
        policyId: id,
        field: "strategy.maxFiles",
        before: beforePolicy.strategy.maxFiles,
        after: afterPolicy.strategy.maxFiles,
      })
    }
    if (beforePolicy.strategy.maxLinesPerFile !== afterPolicy.strategy.maxLinesPerFile) {
      entries.push({
        policyId: id,
        field: "strategy.maxLinesPerFile",
        before: beforePolicy.strategy.maxLinesPerFile,
        after: afterPolicy.strategy.maxLinesPerFile,
      })
    }
    if (beforePolicy.strategy.preferHistory !== afterPolicy.strategy.preferHistory) {
      entries.push({
        policyId: id,
        field: "strategy.preferHistory",
        before: beforePolicy.strategy.preferHistory,
        after: afterPolicy.strategy.preferHistory,
      })
    }

    // Slot changes
    const beforeSlots = JSON.stringify([...beforePolicy.slots].sort())
    const afterSlots = JSON.stringify([...afterPolicy.slots].sort())
    if (beforeSlots !== afterSlots) {
      entries.push({
        policyId: id,
        field: "slots",
        before: beforePolicy.slots,
        after: afterPolicy.slots,
      })
    }

    // Source changes
    const beforeSourceKeys = beforePolicy.sources.map((s) => `${s.kind}:${s.path ?? ""}:${s.weight}`)
    const afterSourceKeys = afterPolicy.sources.map((s) => `${s.kind}:${s.path ?? ""}:${s.weight}`)
    const beforeSourceSet = new Set(beforeSourceKeys)
    const afterSourceSet = new Set(afterSourceKeys)

    for (const key of beforeSourceSet) {
      if (!afterSourceSet.has(key)) {
        entries.push({
          policyId: id,
          field: "source",
          before: key,
          after: "removed",
        })
      }
    }

    for (const key of afterSourceSet) {
      if (!beforeSourceSet.has(key)) {
        entries.push({
          policyId: id,
          field: "source",
          before: "absent",
          after: key,
        })
      }
    }

    // Label/description changes
    if (beforePolicy.label !== afterPolicy.label) {
      entries.push({ policyId: id, field: "label", before: beforePolicy.label, after: afterPolicy.label })
    }
    if (beforePolicy.description !== afterPolicy.description) {
      entries.push({ policyId: id, field: "description", before: beforePolicy.description, after: afterPolicy.description })
    }
  }

  return entries
}

// ---------------------------------------------------------------------------
// Candidate generation
// ---------------------------------------------------------------------------

/** Input signals the candidate generator uses to suggest context mutations. */
export interface ContextMutationEvaluationSignals {
  baseline: BenchOptBaselineSnapshot | null
  breakdown: BenchOptScoreBreakdown | null
  failedScenarios: readonly BenchArtifactScenarioLike[]
  passedScenarios: readonly BenchArtifactScenarioLike[]
}

/**
 * Suggest context mutations based on evaluation results.
 *
 * Heuristics:
 * 1. If context coverage is low, increase the context window (maxFiles and
 *    maxLinesPerFile) on the primary policy.
 * 2. If artifact alignment is weak, add a patch-hint source to provide
 *    evaluator-derived guidance.
 * 3. If prompt clarity is high but coverage is low, switch the ranking mode
 *    to "explicit-first" so that the most relevant files are prioritized.
 * 4. If the baseline has regressions and history is not preferred, enable
 *    history preference so past failures inform context assembly.
 * 5. If both scores are very low, broaden the policy by adding a report
 *    source for downstream synthesis.
 */
export function generateContextMutationCandidates(
  currentConfig: ContextPolicySet,
  signals: ContextMutationEvaluationSignals,
): ContextMutationPlan[] {
  const plans: ContextMutationPlan[] = []
  const policies = currentConfig.policies

  if (policies.length === 0) {
    plans.push({
      mutations: [],
      rationale: "No policies in the config set; nothing to mutate.",
    })
    return plans
  }

  const primaryPolicy = policies[0]

  // --- Heuristic 1: Expand context window when coverage is low ---
  if (signals.breakdown && signals.breakdown.contextCoverage < 10) {
    const newMaxFiles = Math.min(primaryPolicy.strategy.maxFiles + 2, 12)
    const newMaxLines = Math.min(primaryPolicy.strategy.maxLinesPerFile + 40, 200)

    if (newMaxFiles !== primaryPolicy.strategy.maxFiles || newMaxLines !== primaryPolicy.strategy.maxLinesPerFile) {
      plans.push({
        mutations: [
          {
            policyId: primaryPolicy.id,
            action: "modify-window",
            params: { maxFiles: newMaxFiles, maxLinesPerFile: newMaxLines },
          },
        ],
        rationale: `Context coverage is low (${signals.breakdown.contextCoverage}); expand context window from ${primaryPolicy.strategy.maxFiles} files / ${primaryPolicy.strategy.maxLinesPerFile} lines to ${newMaxFiles} files / ${newMaxLines} lines.`,
      })
    }
  }

  // --- Heuristic 2: Add patch-hint source when artifact alignment is weak ---
  if (signals.breakdown && signals.breakdown.artifactAlignment < 10) {
    const hasPatchHintSource = primaryPolicy.sources.some((s) => s.kind === "patch-hint")
    if (!hasPatchHintSource) {
      plans.push({
        mutations: [
          {
            policyId: primaryPolicy.id,
            action: "add-source",
            params: {
              source: {
                kind: "patch-hint",
                weight: 1.5,
                maxLines: 50,
              } satisfies ContextPolicySource,
            },
          },
        ],
        rationale: `Artifact alignment is weak (${signals.breakdown.artifactAlignment}); add a patch-hint source to provide evaluator-derived guidance.`,
      })
    }
  }

  // --- Heuristic 3: Switch to explicit-first ranking when clarity is high but coverage low ---
  if (signals.breakdown) {
    const clarityHigh = signals.breakdown.promptClarity > 20
    const coverageLow = signals.breakdown.contextCoverage < 10

    if (clarityHigh && coverageLow && primaryPolicy.strategy.rankingMode !== "explicit-first") {
      plans.push({
        mutations: [
          {
            policyId: primaryPolicy.id,
            action: "modify-strategy",
            params: { rankingMode: "explicit-first" },
          },
        ],
        rationale: `Prompt clarity (${signals.breakdown.promptClarity}) is high but context coverage (${signals.breakdown.contextCoverage}) is low; switch ranking mode to "explicit-first" to prioritize the most relevant files.`,
      })
    }
  }

  // --- Heuristic 4: Enable history when regressions exist ---
  if (
    signals.baseline
    && signals.baseline.regressions != null
    && signals.baseline.regressions > 0
    && !primaryPolicy.strategy.preferHistory
  ) {
    plans.push({
      mutations: [
        {
          policyId: primaryPolicy.id,
          action: "modify-strategy",
          params: { preferHistory: true },
        },
      ],
      rationale: `Baseline has ${signals.baseline.regressions} regression(s) and history is not preferred; enable history preference so past failures inform context assembly.`,
    })

    // Also add a history source if none exists
    const hasHistorySource = primaryPolicy.sources.some((s) => s.kind === "history")
    if (!hasHistorySource) {
      plans.push({
        mutations: [
          {
            policyId: primaryPolicy.id,
            action: "modify-strategy",
            params: { preferHistory: true },
          },
          {
            policyId: primaryPolicy.id,
            action: "add-source",
            params: {
              source: {
                kind: "history",
                weight: 1.2,
                maxLines: 60,
              } satisfies ContextPolicySource,
            },
          },
        ],
        rationale: `Baseline has ${signals.baseline.regressions} regression(s) and no history source exists; enable history preference and add a history source.`,
      })
    }
  }

  // --- Heuristic 5: Broaden with report source when both scores are very low ---
  if (signals.breakdown) {
    const bothLow = signals.breakdown.promptClarity < 10 && signals.breakdown.contextCoverage < 10
    if (bothLow) {
      const hasReportSource = primaryPolicy.sources.some((s) => s.kind === "report")
      if (!hasReportSource) {
        plans.push({
          mutations: [
            {
              policyId: primaryPolicy.id,
              action: "add-source",
              params: {
                source: {
                  kind: "report",
                  weight: 1.0,
                  maxLines: 80,
                } satisfies ContextPolicySource,
              },
            },
            {
              policyId: primaryPolicy.id,
              action: "modify-window",
              params: {
                maxFiles: Math.min(primaryPolicy.strategy.maxFiles + 3, 12),
                maxLinesPerFile: Math.min(primaryPolicy.strategy.maxLinesPerFile + 60, 200),
              },
            },
          ],
          rationale: `Both prompt clarity (${signals.breakdown.promptClarity}) and context coverage (${signals.breakdown.contextCoverage}) are very low; add a report source and expand the context window for a broad recovery attempt.`,
        })
      }
    }
  }

  // --- Fallback: if no heuristics matched, generate a no-op plan ---
  if (plans.length === 0) {
    plans.push({
      mutations: [],
      rationale: "No actionable context mutations identified from current evaluation signals.",
    })
  }

  return plans
}
