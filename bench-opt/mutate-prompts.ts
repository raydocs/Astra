import type {
  BenchArtifactScenarioLike,
  BenchOptBaselineSnapshot,
  BenchOptResolvedPromptConfig,
  BenchOptScoreBreakdown,
} from "./types.ts"

// ---------------------------------------------------------------------------
// Prompt config types
// ---------------------------------------------------------------------------

/** A collection of prompt configurations keyed by id. */
export interface PromptConfigSet {
  schemaVersion: number
  prompts: PromptConfigEntry[]
}

/** A single prompt configuration entry. */
export interface PromptConfigEntry {
  id: string
  label: string
  description: string
  prompt: string
  /** Whether this prompt is the system-level prompt (cannot be removed). */
  system?: boolean
  tags: readonly string[]
}

// ---------------------------------------------------------------------------
// Mutation types
// ---------------------------------------------------------------------------

/** Describes a single atomic mutation to a prompt configuration. */
export interface PromptMutation {
  /** The id of the prompt being mutated. */
  promptId: string
  /** What kind of change to apply. */
  action: "replace" | "append" | "prepend" | "modify-section" | "remove-section"
  /** The new content to use for the mutation. */
  content: string
  /** Optional section identifier for section-level mutations. */
  section?: string
}

/** An ordered list of prompt mutations with a human-readable rationale. */
export interface PromptMutationPlan {
  mutations: PromptMutation[]
  rationale: string
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Result of validating a set of prompt mutations. */
export interface PromptMutationValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate that a set of prompt mutations is safe to apply.
 *
 * Rules:
 * - Cannot remove the system prompt.
 * - `replace` with empty content is rejected (would produce an empty prompt).
 * - `modify-section` and `remove-section` require a `section` field.
 * - `remove-section` on a system prompt is rejected.
 * - Duplicate promptIds across replace mutations are warned.
 */
export function validatePromptMutations(
  mutations: readonly PromptMutation[],
  config?: PromptConfigSet,
): PromptMutationValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const promptIndex = new Map<string, PromptConfigEntry>()

  if (config) {
    for (const prompt of config.prompts) {
      promptIndex.set(prompt.id, prompt)
    }
  }

  const seenReplaces = new Set<string>()

  for (const mutation of mutations) {
    const existing = promptIndex.get(mutation.promptId)

    switch (mutation.action) {
      case "replace": {
        if (!mutation.content || mutation.content.trim().length === 0) {
          errors.push(
            `Cannot replace prompt "${mutation.promptId}" with empty content.`,
          )
        }
        if (!existing && config) {
          warnings.push(
            `Prompt "${mutation.promptId}" not found in config; replace will create a new entry.`,
          )
        }
        if (seenReplaces.has(mutation.promptId)) {
          warnings.push(
            `Duplicate replace mutation for prompt "${mutation.promptId}"; later replace will overwrite earlier one.`,
          )
        }
        seenReplaces.add(mutation.promptId)
        break
      }

      case "append":
      case "prepend": {
        if (!mutation.content || mutation.content.trim().length === 0) {
          warnings.push(
            `${mutation.action} for "${mutation.promptId}" has empty content; mutation is a no-op.`,
          )
        }
        if (!existing && config) {
          warnings.push(
            `Prompt "${mutation.promptId}" not found in config; ${mutation.action} will be a no-op.`,
          )
        }
        break
      }

      case "modify-section": {
        if (!mutation.section) {
          errors.push(
            `modify-section for "${mutation.promptId}" requires a section identifier.`,
          )
        }
        if (!mutation.content || mutation.content.trim().length === 0) {
          warnings.push(
            `modify-section for "${mutation.promptId}" section "${mutation.section ?? ""}" has empty content.`,
          )
        }
        if (!existing && config) {
          warnings.push(
            `Prompt "${mutation.promptId}" not found in config; modify-section will be a no-op.`,
          )
        }
        break
      }

      case "remove-section": {
        if (!mutation.section) {
          errors.push(
            `remove-section for "${mutation.promptId}" requires a section identifier.`,
          )
        }
        if (existing?.system) {
          errors.push(
            `Cannot remove section from system prompt "${mutation.promptId}".`,
          )
        }
        if (!existing && config) {
          warnings.push(
            `Prompt "${mutation.promptId}" not found in config; remove-section will be a no-op.`,
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
 * Find and replace a named section in a prompt string.
 *
 * Sections are delimited by lines matching `## SectionName` (markdown heading).
 * The section extends until the next heading of the same or higher level, or EOF.
 */
function findSection(prompt: string, section: string): { start: number; end: number } | null {
  const pattern = new RegExp(`^##\\s+${escapeRegex(section)}\\s*$`, "m")
  const match = pattern.exec(prompt)
  if (!match) return null

  const start = match.index
  // Find the next heading at same or higher level, or end of string
  const rest = prompt.slice(start + match[0].length)
  const nextHeading = /^##\s+/m.exec(rest)
  const end = nextHeading
    ? start + match[0].length + nextHeading.index
    : prompt.length

  return { start, end }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Apply an ordered list of prompt mutations to a config set.
 *
 * Returns a new config object; the original is never mutated.
 */
export function applyPromptMutations(
  config: PromptConfigSet,
  mutations: readonly PromptMutation[],
): PromptConfigSet {
  let prompts = config.prompts.map((p) => ({ ...p, tags: [...p.tags] }))

  for (const mutation of mutations) {
    switch (mutation.action) {
      case "replace": {
        const idx = prompts.findIndex((p) => p.id === mutation.promptId)
        if (idx >= 0) {
          prompts[idx] = { ...prompts[idx], prompt: mutation.content }
        } else {
          // Create a new prompt entry
          prompts.push({
            id: mutation.promptId,
            label: mutation.promptId,
            description: `Auto-created by replace mutation`,
            prompt: mutation.content,
            tags: [],
          })
        }
        break
      }

      case "append": {
        prompts = prompts.map((p) => {
          if (p.id !== mutation.promptId) return p
          return { ...p, prompt: `${p.prompt}\n${mutation.content}` }
        })
        break
      }

      case "prepend": {
        prompts = prompts.map((p) => {
          if (p.id !== mutation.promptId) return p
          return { ...p, prompt: `${mutation.content}\n${p.prompt}` }
        })
        break
      }

      case "modify-section": {
        if (!mutation.section) break
        prompts = prompts.map((p) => {
          if (p.id !== mutation.promptId) return p
          const sectionRange = findSection(p.prompt, mutation.section!)
          if (!sectionRange) {
            // Section not found; append it
            return { ...p, prompt: `${p.prompt}\n\n## ${mutation.section}\n${mutation.content}` }
          }
          const before = p.prompt.slice(0, sectionRange.start)
          const after = p.prompt.slice(sectionRange.end)
          return { ...p, prompt: `${before}## ${mutation.section}\n${mutation.content}\n${after}` }
        })
        break
      }

      case "remove-section": {
        if (!mutation.section) break
        prompts = prompts.map((p) => {
          if (p.id !== mutation.promptId) return p
          const sectionRange = findSection(p.prompt, mutation.section!)
          if (!sectionRange) return p
          const before = p.prompt.slice(0, sectionRange.start)
          const after = p.prompt.slice(sectionRange.end)
          return { ...p, prompt: `${before}${after}`.replace(/\n{3,}/g, "\n\n").trim() }
        })
        break
      }
    }
  }

  return { schemaVersion: config.schemaVersion, prompts }
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

/** A single entry in a human-readable prompt config diff. */
export interface PromptDiffEntry {
  promptId: string
  field: string
  before: unknown
  after: unknown
}

/**
 * Produce a human-readable diff between two prompt config sets.
 *
 * Compares prompt presence and prompt text content.
 */
export function diffPromptConfigs(
  before: PromptConfigSet,
  after: PromptConfigSet,
): PromptDiffEntry[] {
  const entries: PromptDiffEntry[] = []
  const beforeMap = new Map(before.prompts.map((p) => [p.id, p]))
  const afterMap = new Map(after.prompts.map((p) => [p.id, p]))

  // Prompts removed
  for (const [id] of beforeMap) {
    if (!afterMap.has(id)) {
      entries.push({ promptId: id, field: "presence", before: "present", after: "removed" })
    }
  }

  // Prompts added
  for (const [id] of afterMap) {
    if (!beforeMap.has(id)) {
      entries.push({ promptId: id, field: "presence", before: "absent", after: "added" })
    }
  }

  // Prompts modified
  for (const [id, beforePrompt] of beforeMap) {
    const afterPrompt = afterMap.get(id)
    if (!afterPrompt) continue

    if (beforePrompt.prompt !== afterPrompt.prompt) {
      // Produce a line-level summary of the change
      const beforeLines = beforePrompt.prompt.split("\n").length
      const afterLines = afterPrompt.prompt.split("\n").length
      entries.push({
        promptId: id,
        field: "prompt",
        before: `${beforeLines} lines (${beforePrompt.prompt.length} chars)`,
        after: `${afterLines} lines (${afterPrompt.prompt.length} chars)`,
      })
    }

    if (beforePrompt.label !== afterPrompt.label) {
      entries.push({ promptId: id, field: "label", before: beforePrompt.label, after: afterPrompt.label })
    }

    if (beforePrompt.description !== afterPrompt.description) {
      entries.push({ promptId: id, field: "description", before: beforePrompt.description, after: afterPrompt.description })
    }
  }

  return entries
}

// ---------------------------------------------------------------------------
// Candidate generation
// ---------------------------------------------------------------------------

/** Input signals the candidate generator uses to suggest prompt mutations. */
export interface PromptMutationEvaluationSignals {
  baseline: BenchOptBaselineSnapshot | null
  breakdown: BenchOptScoreBreakdown | null
  failedScenarios: readonly BenchArtifactScenarioLike[]
  passedScenarios: readonly BenchArtifactScenarioLike[]
}

/**
 * Suggest prompt mutations based on evaluation results.
 *
 * Heuristics:
 * 1. If prompt clarity is low, suggest replacing the weakest prompt with a more
 *    structured variant that includes explicit section headings.
 * 2. If many scenarios of a specific surface fail, suggest appending
 *    surface-specific guidance to the active prompt.
 * 3. If context coverage is high but prompt clarity is low, suggest prepending
 *    a concise instruction preamble to tighten focus.
 * 4. If the baseline shows regressions, suggest modifying the "Constraints"
 *    section to add regression-avoidance instructions.
 */
export function generatePromptMutationCandidates(
  currentConfig: PromptConfigSet,
  signals: PromptMutationEvaluationSignals,
): PromptMutationPlan[] {
  const plans: PromptMutationPlan[] = []
  const prompts = currentConfig.prompts

  if (prompts.length === 0) {
    plans.push({
      mutations: [],
      rationale: "No prompts in the config set; nothing to mutate.",
    })
    return plans
  }

  // --- Heuristic 1: Replace weakest prompt when clarity is low ---
  if (signals.breakdown && signals.breakdown.promptClarity < 15) {
    // Find the shortest (likely weakest) non-system prompt
    const candidates = prompts
      .filter((p) => !p.system)
      .sort((a, b) => a.prompt.length - b.prompt.length)

    if (candidates.length > 0) {
      const weakest = candidates[0]
      plans.push({
        mutations: [
          {
            promptId: weakest.id,
            action: "replace",
            content: [
              "## Objective",
              "Solve the benchmark task with the smallest safe change.",
              "",
              "## Constraints",
              "- Use only the provided context.",
              "- Keep the implementation narrowly scoped.",
              "- Preserve existing behavior for unrelated surfaces.",
              "",
              "## Output",
              "Return the requested artifact without extra commentary unless the task asks for it.",
            ].join("\n"),
          },
        ],
        rationale: `Prompt clarity is low (${signals.breakdown.promptClarity}); replace the shortest prompt "${weakest.id}" with a structured variant using explicit section headings.`,
      })
    }
  }

  // --- Heuristic 2: Append surface guidance for failing surfaces ---
  const failedSurfaces = new Set<string>()
  for (const scenario of signals.failedScenarios) {
    if (scenario.surface) failedSurfaces.add(scenario.surface)
  }

  if (failedSurfaces.size > 0 && prompts.length > 0) {
    const targetPrompt = prompts[0]
    const surfaceList = [...failedSurfaces].join(", ")
    plans.push({
      mutations: [
        {
          promptId: targetPrompt.id,
          action: "append",
          content: `\nPay special attention to the following surfaces which have failing scenarios: ${surfaceList}. Review the evaluator expectations for these surfaces before making changes.`,
        },
      ],
      rationale: `${failedSurfaces.size} surface(s) have failing scenarios (${surfaceList}); append surface-specific guidance to the active prompt.`,
    })
  }

  // --- Heuristic 3: Prepend focus preamble when coverage is high but clarity low ---
  if (signals.breakdown) {
    const clarityLow = signals.breakdown.promptClarity < 15
    const coverageHigh = signals.breakdown.contextCoverage > 20

    if (clarityLow && coverageHigh && prompts.length > 0) {
      const targetPrompt = prompts[0]
      plans.push({
        mutations: [
          {
            promptId: targetPrompt.id,
            action: "prepend",
            content: "Focus on the specific task. Do not explore unrelated code. Apply only the minimum edit needed.",
          },
        ],
        rationale: `Prompt clarity (${signals.breakdown.promptClarity}) is low relative to context coverage (${signals.breakdown.contextCoverage}); prepend a concise instruction preamble to tighten focus.`,
      })
    }
  }

  // --- Heuristic 4: Modify Constraints section when regressions exist ---
  if (signals.baseline && signals.baseline.regressions != null && signals.baseline.regressions > 0) {
    const nonSystemPrompts = prompts.filter((p) => !p.system)
    if (nonSystemPrompts.length > 0) {
      const targetPrompt = nonSystemPrompts[0]
      plans.push({
        mutations: [
          {
            promptId: targetPrompt.id,
            action: "modify-section",
            content: [
              "- Preserve existing behavior for all passing scenarios.",
              `- The baseline shows ${signals.baseline.regressions} regression(s); avoid introducing new failures.`,
              "- Run the evaluator against the affected surfaces before finalizing.",
            ].join("\n"),
            section: "Constraints",
          },
        ],
        rationale: `Baseline has ${signals.baseline.regressions} regression(s); modify the Constraints section to add regression-avoidance instructions.`,
      })
    }
  }

  // --- Fallback: if no heuristics matched, generate a no-op plan ---
  if (plans.length === 0) {
    plans.push({
      mutations: [],
      rationale: "No actionable prompt mutations identified from current evaluation signals.",
    })
  }

  return plans
}
