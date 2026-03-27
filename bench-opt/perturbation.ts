/**
 * Controlled Perturbation Engine
 *
 * Provides deterministic, seed-based perturbations for benchmark configs:
 * - Threshold jitter on dimension pass thresholds
 * - Weight jitter on dimension weights (re-normalised)
 * - Prompt rephrasing (semantically equivalent variants)
 * - Scenario order shuffling
 *
 * All randomness flows through a seeded PRNG so results are reproducible
 * given the same seed.
 */

import type { LongRunConfig } from "./long-run.ts"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PerturbationConfig {
  enabled: boolean
  seed?: number
  promptVariants?: boolean // rephrase prompts
  thresholdJitter?: number // +/-N points on thresholds (default: 3)
  weightJitter?: number // +/-0.05 on dimension weights
  scenarioOrderShuffle?: boolean
}

export interface PerturbationResult {
  applied: string[] // what was perturbed
  originalValues: Record<string, unknown>
  perturbedValues: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Seeded PRNG — Mulberry32
// ---------------------------------------------------------------------------

/**
 * A simple, fast 32-bit PRNG (Mulberry32).
 *
 * Returns a function that produces a pseudo-random float in [0, 1) on each
 * call. Given the same seed the sequence is fully deterministic.
 */
export function createSeededRng(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------------------
// Threshold perturbation
// ---------------------------------------------------------------------------

/**
 * Add uniform jitter in the range `[-jitter, +jitter]` to every dimension
 * threshold in the config. Thresholds are clamped to [0, 100].
 *
 * Returns a shallow copy of the dimensions array with perturbed thresholds.
 */
export function perturbThresholds(
  dimensions: LongRunConfig["dimensions"],
  perturbConfig: PerturbationConfig,
  rng: () => number,
): {
  dimensions: LongRunConfig["dimensions"]
  deltas: Record<string, number>
} {
  const jitter = perturbConfig.thresholdJitter ?? 3
  const deltas: Record<string, number> = {}

  const perturbed = dimensions.map((d) => {
    // Uniform in [-jitter, +jitter]
    const delta = (rng() * 2 - 1) * jitter
    const rounded = Math.round(delta * 100) / 100
    deltas[d.id] = rounded
    return {
      ...d,
      threshold: Math.max(0, Math.min(100, d.threshold + rounded)),
    }
  })

  return { dimensions: perturbed, deltas }
}

// ---------------------------------------------------------------------------
// Weight perturbation
// ---------------------------------------------------------------------------

/**
 * Add uniform jitter in `[-jitter, +jitter]` to each weight, then
 * re-normalise so weights sum to 1.0. Individual weights are floored at
 * 0.01 before normalisation to avoid zeroes.
 */
export function perturbWeights(
  weights: Record<string, number>,
  jitter: number,
  rng: () => number,
): Record<string, number> {
  const raw: Record<string, number> = {}
  for (const [key, value] of Object.entries(weights)) {
    const delta = (rng() * 2 - 1) * jitter
    raw[key] = Math.max(0.01, value + delta)
  }

  // Re-normalise to sum = 1
  const total = Object.values(raw).reduce((sum, v) => sum + v, 0)
  const normalised: Record<string, number> = {}
  for (const [key, value] of Object.entries(raw)) {
    normalised[key] = Math.round((value / total) * 10000) / 10000
  }

  // Fix floating-point drift: adjust the largest weight so they sum exactly to 1
  const entries = Object.entries(normalised)
  const currentSum = entries.reduce((sum, [, v]) => sum + v, 0)
  if (entries.length > 0 && currentSum !== 1) {
    entries.sort((a, b) => b[1] - a[1])
    normalised[entries[0][0]] = Math.round((normalised[entries[0][0]] + (1 - currentSum)) * 10000) / 10000
  }

  return normalised
}

// ---------------------------------------------------------------------------
// Prompt variant generation
// ---------------------------------------------------------------------------

/** Synonym maps for common imperative verbs at the start of prompts. */
const VERB_SYNONYMS: Array<[RegExp, string[]]> = [
  [/\bbuild\b/i, ["Create", "Implement", "Develop", "Construct"]],
  [/\bcreate\b/i, ["Build", "Implement", "Develop", "Design"]],
  [/\bimplement\b/i, ["Build", "Create", "Develop", "Construct"]],
  [/\bdevelop\b/i, ["Build", "Create", "Implement", "Construct"]],
  [/\bdesign\b/i, ["Create", "Build", "Develop", "Craft"]],
  [/\bwrite\b/i, ["Create", "Build", "Author", "Develop"]],
  [/\badd\b/i, ["Include", "Introduce", "Incorporate", "Attach"]],
]

/** Filler phrases that can be inserted or removed without changing meaning. */
const FILLER_PHRASES = [
  "that is",
  "which is",
  "in order to",
  "that can",
  "capable of",
]

/**
 * Produce a semantically equivalent variant of the given prompt.
 *
 * Transformations (applied probabilistically via `rng`):
 * 1. Swap the leading imperative verb for a synonym.
 * 2. Insert or remove a filler phrase.
 * 3. Reorder comma-separated clauses within the prompt.
 */
export function generatePromptVariant(prompt: string, rng: () => number): string {
  let result = prompt

  // 1. Verb swap (60 % chance)
  if (rng() < 0.6) {
    for (const [pattern, synonyms] of VERB_SYNONYMS) {
      if (pattern.test(result)) {
        const chosen = synonyms[Math.floor(rng() * synonyms.length)]
        // Replace only the first occurrence, preserving surrounding case context
        result = result.replace(pattern, chosen)
        break
      }
    }
  }

  // 2. Filler phrase toggle (40 % chance)
  if (rng() < 0.4) {
    const fillerIdx = Math.floor(rng() * FILLER_PHRASES.length)
    const filler = FILLER_PHRASES[fillerIdx]
    if (result.toLowerCase().includes(filler)) {
      // Remove filler
      result = result.replace(new RegExp(`\\s*${escapeRegex(filler)}\\s*`, "i"), " ")
    } else {
      // Insert filler after the first comma, if one exists
      const commaPos = result.indexOf(",")
      if (commaPos !== -1) {
        result =
          result.slice(0, commaPos + 1) +
          ` ${filler}` +
          result.slice(commaPos + 1)
      }
    }
  }

  // 3. Clause reorder (30 % chance) — swap two comma-separated segments
  if (rng() < 0.3) {
    const segments = result.split(",").map((s) => s.trim())
    if (segments.length >= 3) {
      // Pick two non-first segments to swap (keep the first segment in place
      // so the sentence opener stays coherent)
      const i = 1 + Math.floor(rng() * (segments.length - 1))
      let j = 1 + Math.floor(rng() * (segments.length - 1))
      if (j === i) j = i === segments.length - 1 ? 1 : i + 1
      const tmp = segments[i]
      segments[i] = segments[j]
      segments[j] = tmp
      result = segments.join(", ")
    }
  }

  // Normalise whitespace
  return result.replace(/\s{2,}/g, " ").trim()
}

// ---------------------------------------------------------------------------
// Fisher-Yates shuffle
// ---------------------------------------------------------------------------

/**
 * Return a new array with elements in a deterministic random order
 * (Fisher-Yates shuffle using the supplied seeded RNG).
 */
export function shuffleArray<T>(arr: readonly T[], rng: () => number): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = copy[i]
    copy[i] = copy[j]
    copy[j] = tmp
  }
  return copy
}

// ---------------------------------------------------------------------------
// Top-level apply
// ---------------------------------------------------------------------------

/**
 * Apply all enabled perturbations to a {@link LongRunConfig} and return:
 * - A new (shallow-copied) config with perturbations applied.
 * - A {@link PerturbationResult} recording what changed.
 *
 * The original config is **not** mutated.
 */
export function applyPerturbations(
  longRunConfig: LongRunConfig,
  perturbConfig: PerturbationConfig,
): {
  config: LongRunConfig
  result: PerturbationResult
} {
  if (!perturbConfig.enabled) {
    return {
      config: longRunConfig,
      result: { applied: [], originalValues: {}, perturbedValues: {} },
    }
  }

  const seed = perturbConfig.seed ?? Date.now()
  const rng = createSeededRng(seed)

  const applied: string[] = []
  const originalValues: Record<string, unknown> = {}
  const perturbedValues: Record<string, unknown> = {}

  let config: LongRunConfig = { ...longRunConfig }

  // --- Threshold jitter ---
  if ((perturbConfig.thresholdJitter ?? 3) > 0) {
    const origThresholds: Record<string, number> = {}
    for (const d of config.dimensions) {
      origThresholds[d.id] = d.threshold
    }

    const { dimensions, deltas } = perturbThresholds(
      config.dimensions,
      perturbConfig,
      rng,
    )
    config = { ...config, dimensions }

    const newThresholds: Record<string, number> = {}
    for (const d of dimensions) {
      newThresholds[d.id] = d.threshold
    }

    applied.push("thresholdJitter")
    originalValues["thresholds"] = origThresholds
    perturbedValues["thresholds"] = newThresholds
    perturbedValues["thresholdDeltas"] = deltas
  }

  // --- Weight jitter ---
  const weightJitter = perturbConfig.weightJitter ?? 0.05
  if (weightJitter > 0) {
    const origWeights: Record<string, number> = {}
    for (const d of config.dimensions) {
      origWeights[d.id] = d.weight
    }

    const weightMap: Record<string, number> = {}
    for (const d of config.dimensions) {
      weightMap[d.id] = d.weight
    }

    const newWeightMap = perturbWeights(weightMap, weightJitter, rng)

    config = {
      ...config,
      dimensions: config.dimensions.map((d) => ({
        ...d,
        weight: newWeightMap[d.id] ?? d.weight,
      })),
    }

    applied.push("weightJitter")
    originalValues["weights"] = origWeights
    perturbedValues["weights"] = newWeightMap
  }

  // --- Prompt variant ---
  if (perturbConfig.promptVariants) {
    const origPrompt = config.productPrompt
    const newPrompt = generatePromptVariant(origPrompt, rng)

    if (newPrompt !== origPrompt) {
      config = { ...config, productPrompt: newPrompt }
      applied.push("promptVariant")
      originalValues["productPrompt"] = origPrompt
      perturbedValues["productPrompt"] = newPrompt
    }
  }

  // --- Scenario order shuffle ---
  if (
    perturbConfig.scenarioOrderShuffle &&
    config.liveValidation?.scenarioIds &&
    config.liveValidation.scenarioIds.length > 1
  ) {
    const origOrder = [...config.liveValidation.scenarioIds]
    const shuffled = shuffleArray(origOrder, rng)

    config = {
      ...config,
      liveValidation: {
        ...config.liveValidation,
        scenarioIds: shuffled,
      },
    }

    applied.push("scenarioOrderShuffle")
    originalValues["scenarioOrder"] = origOrder
    perturbedValues["scenarioOrder"] = shuffled
  }

  return {
    config,
    result: { applied, originalValues, perturbedValues },
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Escape special regex characters in a string. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
