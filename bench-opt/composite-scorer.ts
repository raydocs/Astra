import type { BenchOptIterationVerdict } from "./strategy.ts"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Score for a single evaluation dimension. */
export interface DimensionScore {
  dimensionId: string
  label: string
  /** 0-100 normalised score. */
  score: number
  /** 0-1 weight used when aggregating into the composite total. */
  weight: number
  /** Whether the score met or exceeded its threshold. */
  passed: boolean
  /** Minimum score required for this dimension to pass. */
  threshold: number
  /** Evidence strings that justify the awarded score. */
  evidence: string[]
  /** Critique strings noting what could be improved. */
  critique: string[]
}

/** Aggregated multi-dimension evaluation result. */
export interface CompositeScore {
  dimensions: DimensionScore[]
  /** Weighted average across all dimensions (0-100 scale). */
  weightedTotal: number
  /** True when every *required* dimension passed its threshold. */
  allRequiredPassed: boolean
  passedDimensionCount: number
  failedDimensionCount: number
  /**
   * Overall pass: `weightedTotal >= totalThreshold` **and** all required
   * dimensions passed.
   */
  overallPass: boolean
  totalThreshold: number
}

/** Configuration describing each dimension and overall pass criteria. */
export interface CompositeScoringConfig {
  dimensions: Array<{
    id: string
    label: string
    /** 0-1 weight — all weights should sum to 1. */
    weight: number
    /** Minimum per-dimension score to count as "passed". */
    threshold: number
  }>
  /** Minimum weighted total required for the overall composite to pass. */
  totalPassThreshold: number
  /** Dimension ids that *must* pass for the overall result to pass. */
  requiredDimensionIds: string[]
}

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

/**
 * Returns the default five-dimension scoring configuration.
 *
 * Dimensions:
 * - **functionality** (0.30, threshold 70) — does the output work?
 * - **productDepth** (0.25, threshold 60) — depth of product understanding
 * - **uxDesign** (0.15, threshold 50) — user-experience quality
 * - **codeQuality** (0.20, threshold 65) — code correctness & style
 * - **maintainability** (0.10, threshold 50) — ease of future maintenance
 */
export function createDefaultScoringConfig(): CompositeScoringConfig {
  return {
    dimensions: [
      { id: "functionality", label: "Functionality", weight: 0.30, threshold: 70 },
      { id: "productDepth", label: "Product Depth", weight: 0.25, threshold: 60 },
      { id: "uxDesign", label: "UX Design", weight: 0.15, threshold: 50 },
      { id: "codeQuality", label: "Code Quality", weight: 0.20, threshold: 65 },
      { id: "maintainability", label: "Maintainability", weight: 0.10, threshold: 50 },
    ],
    totalPassThreshold: 65,
    requiredDimensionIds: ["functionality", "codeQuality"],
  }
}

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

/**
 * Create a {@link DimensionScore} for a single dimension.
 *
 * @param dimensionId - Must match an `id` in the config's `dimensions` array.
 * @param rawScore    - The numeric score (0-100).
 * @param config      - The composite scoring configuration.
 * @param evidence    - Optional evidence strings.
 * @param critique    - Optional critique strings.
 * @returns A fully hydrated `DimensionScore`.
 * @throws If `dimensionId` is not found in the config.
 */
export function scoreDimension(
  dimensionId: string,
  rawScore: number,
  config: CompositeScoringConfig,
  evidence: string[] = [],
  critique: string[] = [],
): DimensionScore {
  const dimConfig = config.dimensions.find((d) => d.id === dimensionId)
  if (!dimConfig) {
    throw new Error(
      `Unknown dimension "${dimensionId}". ` +
        `Valid ids: ${config.dimensions.map((d) => d.id).join(", ")}`,
    )
  }

  const clamped = Math.max(0, Math.min(100, rawScore))

  return {
    dimensionId,
    label: dimConfig.label,
    score: clamped,
    weight: dimConfig.weight,
    passed: clamped >= dimConfig.threshold,
    threshold: dimConfig.threshold,
    evidence,
    critique,
  }
}

/**
 * Aggregate an array of {@link DimensionScore} values into a
 * {@link CompositeScore}.
 *
 * Missing dimensions (present in config but absent from `dimensionScores`) are
 * treated as score 0 — this keeps the weighted average honest even when a
 * caller only supplies a subset.
 */
export function computeCompositeScore(
  dimensionScores: DimensionScore[],
  config: CompositeScoringConfig,
): CompositeScore {
  const byId = new Map(dimensionScores.map((d) => [d.dimensionId, d]))

  // Fill in missing dimensions as 0-score entries so the weighted total is
  // correct even when the caller omits some.
  const allDimensions: DimensionScore[] = config.dimensions.map((dc) => {
    const existing = byId.get(dc.id)
    if (existing) return existing
    return {
      dimensionId: dc.id,
      label: dc.label,
      score: 0,
      weight: dc.weight,
      passed: false,
      threshold: dc.threshold,
      evidence: [],
      critique: ["Dimension was not evaluated — defaulted to 0."],
    }
  })

  const totalWeight = allDimensions.reduce((sum, d) => sum + d.weight, 0)
  const weightedTotal =
    totalWeight > 0
      ? allDimensions.reduce((sum, d) => sum + d.score * d.weight, 0) / totalWeight
      : 0

  const roundedTotal = Math.round(weightedTotal * 100) / 100

  const allRequiredPassed = config.requiredDimensionIds.every((reqId) => {
    const dim = allDimensions.find((d) => d.dimensionId === reqId)
    return dim ? dim.passed : false
  })

  const passedCount = allDimensions.filter((d) => d.passed).length
  const failedCount = allDimensions.length - passedCount

  return {
    dimensions: allDimensions,
    weightedTotal: roundedTotal,
    allRequiredPassed,
    passedDimensionCount: passedCount,
    failedDimensionCount: failedCount,
    overallPass: roundedTotal >= config.totalPassThreshold && allRequiredPassed,
    totalThreshold: config.totalPassThreshold,
  }
}

// ---------------------------------------------------------------------------
// Verdict derivation
// ---------------------------------------------------------------------------

/**
 * Map a {@link CompositeScore} to a {@link BenchOptIterationVerdict}.
 *
 * Rules:
 * 1. `overallPass` + `weightedTotal >= 80` → `"pass"`
 * 2. `overallPass` + `weightedTotal >= 65` → `"pass"` (with notes)
 * 3. `!overallPass` + any required dimension failed → `"reject"`
 * 4. `!overallPass` + only optional dimensions failed → `"needs-refine"`
 */
export function deriveVerdictFromComposite(
  composite: CompositeScore,
): BenchOptIterationVerdict {
  if (composite.overallPass) {
    // Both >= 80 and >= 65 map to "pass"; the distinction is informational.
    return "pass"
  }

  // Not an overall pass — check whether *required* dimensions failed.
  if (!composite.allRequiredPassed) {
    return "reject"
  }

  // Required dimensions passed but weighted total is below threshold or
  // optional dimensions dragged the composite down.
  return "needs-refine"
}

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------

/**
 * Render a human-readable Markdown score-card for the composite result.
 */
export function renderCompositeScoreMarkdown(composite: CompositeScore): string {
  const lines: string[] = []

  lines.push("## Composite Evaluation Score Card")
  lines.push("")
  lines.push(
    `**Weighted Total:** ${composite.weightedTotal} / 100` +
      `  (threshold: ${composite.totalThreshold})`,
  )
  lines.push(
    `**Overall:** ${composite.overallPass ? "PASS" : "FAIL"}` +
      `  |  Dimensions passed: ${composite.passedDimensionCount}/${composite.dimensions.length}`,
  )
  lines.push("")

  // Dimension table
  lines.push("| Dimension | Score | Threshold | Weight | Status |")
  lines.push("|-----------|------:|----------:|-------:|--------|")
  for (const d of composite.dimensions) {
    const status = d.passed ? "Pass" : "**FAIL**"
    lines.push(
      `| ${d.label} | ${d.score} | ${d.threshold} | ${(d.weight * 100).toFixed(0)}% | ${status} |`,
    )
  }
  lines.push("")

  // Evidence & critique per dimension
  for (const d of composite.dimensions) {
    if (d.evidence.length === 0 && d.critique.length === 0) continue
    lines.push(`### ${d.label}`)
    if (d.evidence.length > 0) {
      lines.push("**Evidence:**")
      for (const e of d.evidence) {
        lines.push(`- ${e}`)
      }
    }
    if (d.critique.length > 0) {
      lines.push("**Critique:**")
      for (const c of d.critique) {
        lines.push(`- ${c}`)
      }
    }
    lines.push("")
  }

  return lines.join("\n")
}
