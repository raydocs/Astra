import type { BenchmarkSurface } from "../bench/types.ts"
import type {
  BenchOptBaselineSnapshot,
  BenchOptExperimentTrial,
  BenchOptScoreBreakdown,
  BenchOptTrialSplit,
} from "./types.ts"

// ---------------------------------------------------------------------------
// Configuration types
// ---------------------------------------------------------------------------

/** Thresholds used by the guardrail checker to decide if a candidate is safe. */
export interface BenchOptGuardrailConfig {
  /** Maximum allowed percentage regression in average total score (0-100). */
  maxAverageRegressionPercent: number
  /** Maximum allowed percentage drop on any individual surface (0-100). */
  maxSurfaceRegressionPercent: number
  /** Maximum number of optimization iterations before the loop is halted. */
  maxIterations: number
  /** Minimum gap between train and validation score changes before overfitting is flagged. */
  overfitDeltaThreshold: number
  /** Require that these splits have been evaluated before promotion. */
  requiredSplits: readonly BenchOptTrialSplit[]
}

/** Default guardrail config used when the caller does not supply overrides. */
export const BENCH_OPT_GUARDRAIL_DEFAULTS: BenchOptGuardrailConfig = {
  maxAverageRegressionPercent: 5,
  maxSurfaceRegressionPercent: 10,
  maxIterations: 20,
  overfitDeltaThreshold: 0.15,
  requiredSplits: ["train", "validation"],
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/** Severity of a single guardrail violation. */
export type BenchOptGuardrailSeverity = "warning" | "critical"

/** One guardrail violation found during the check. */
export interface BenchOptGuardrailViolation {
  /** Machine-readable identifier for the violation kind. */
  id: string
  /** Human-readable title. */
  title: string
  /** Severity level. */
  severity: BenchOptGuardrailSeverity
  /** Explanation with numbers. */
  description: string
  /** Extra data that led to the violation. */
  evidence: Record<string, unknown>
}

/** Overall verdict returned by {@link checkGuardrails}. */
export type BenchOptGuardrailVerdict = "pass" | "warn" | "block"

/** Structured result of a guardrail check. */
export interface BenchOptGuardrailResult {
  /** Computed verdict: pass, warn, or block. */
  verdict: BenchOptGuardrailVerdict
  /** All detected violations (may be empty when the verdict is "pass"). */
  violations: BenchOptGuardrailViolation[]
  /** The config that was applied. */
  config: BenchOptGuardrailConfig
  /** ISO timestamp of the check. */
  checkedAt: string
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function pctChange(previous: number, current: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

function surfaceAverage(
  surfaces: ReadonlyArray<{ surface: string; averageTotal: number }>,
  name: string,
): number | null {
  const entry = surfaces.find((s) => s.surface === name)
  return entry?.averageTotal ?? null
}

// ---------------------------------------------------------------------------
// Detection functions
// ---------------------------------------------------------------------------

/**
 * Compare candidate average score against champion and flag regression.
 */
function detectAverageRegression(
  candidateAvg: number | null,
  championAvg: number | null,
  config: BenchOptGuardrailConfig,
): BenchOptGuardrailViolation | null {
  if (candidateAvg === null || championAvg === null) return null

  const pct = pctChange(championAvg, candidateAvg)
  if (pct === null) return null
  if (pct >= -config.maxAverageRegressionPercent) return null

  return {
    id: "average-regression",
    title: "Average score regression",
    severity: Math.abs(pct) > config.maxAverageRegressionPercent * 2 ? "critical" : "warning",
    description: `Average score dropped by ${Math.abs(pct).toFixed(1)}% (champion ${championAvg.toFixed(2)} -> candidate ${candidateAvg.toFixed(2)}), exceeding the ${config.maxAverageRegressionPercent}% threshold.`,
    evidence: { championAvg, candidateAvg, pctChange: pct },
  }
}

/**
 * Compare per-surface scores and flag any significant drops.
 */
function detectSurfaceRegressions(
  candidateSurfaces: ReadonlyArray<{ surface: string; averageTotal: number }>,
  championSurfaces: ReadonlyArray<{ surface: string; averageTotal: number }>,
  config: BenchOptGuardrailConfig,
): BenchOptGuardrailViolation[] {
  const violations: BenchOptGuardrailViolation[] = []
  const allSurfaceNames = new Set([
    ...championSurfaces.map((s) => s.surface),
    ...candidateSurfaces.map((s) => s.surface),
  ])

  for (const name of allSurfaceNames) {
    const champVal = surfaceAverage(championSurfaces, name)
    const candVal = surfaceAverage(candidateSurfaces, name)

    if (champVal === null || candVal === null) continue

    const pct = pctChange(champVal, candVal)
    if (pct === null || pct >= -config.maxSurfaceRegressionPercent) continue

    violations.push({
      id: `surface-regression:${name}`,
      title: `Surface regression on ${name}`,
      severity: Math.abs(pct) > config.maxSurfaceRegressionPercent * 2 ? "critical" : "warning",
      description: `Surface "${name}" dropped by ${Math.abs(pct).toFixed(1)}% (${champVal.toFixed(2)} -> ${candVal.toFixed(2)}), exceeding the ${config.maxSurfaceRegressionPercent}% threshold.`,
      evidence: { surface: name, championAvg: champVal, candidateAvg: candVal, pctChange: pct },
    })
  }

  return violations
}

/**
 * Verify that the required splits have been evaluated on the experiment so far.
 */
function detectSplitViolations(
  observedSplits: readonly BenchOptTrialSplit[],
  config: BenchOptGuardrailConfig,
): BenchOptGuardrailViolation | null {
  const observed = new Set(observedSplits)
  const missing = config.requiredSplits.filter((s) => !observed.has(s))

  if (missing.length === 0) return null

  return {
    id: "split-discipline",
    title: "Missing required splits",
    severity: "warning",
    description: `Required splits [${config.requiredSplits.join(", ")}] but only observed [${observedSplits.join(", ")}]. Missing: ${missing.join(", ")}.`,
    evidence: { requiredSplits: [...config.requiredSplits], observedSplits: [...observedSplits], missingSplits: missing },
  }
}

/**
 * Check whether the current iteration count has reached or exceeded the cap.
 */
function detectIterationOverrun(
  currentIteration: number,
  config: BenchOptGuardrailConfig,
): BenchOptGuardrailViolation | null {
  if (currentIteration < config.maxIterations) return null

  return {
    id: "max-iterations",
    title: "Maximum iterations reached",
    severity: "critical",
    description: `The optimization loop has reached ${currentIteration} iterations (limit: ${config.maxIterations}).`,
    evidence: { currentIteration, maxIterations: config.maxIterations },
  }
}

/**
 * Detect overfitting: train score rising while validation score drops.
 *
 * Requires at least two data points for both train and validation.
 */
function detectOverfitting(
  scoreTrends: {
    train: readonly number[]
    validation: readonly number[]
  },
  config: BenchOptGuardrailConfig,
): BenchOptGuardrailViolation | null {
  const { train, validation } = scoreTrends
  if (train.length < 2 || validation.length < 2) return null

  const trainDelta = train[train.length - 1] - train[train.length - 2]
  const validationDelta = validation[validation.length - 1] - validation[validation.length - 2]

  if (trainDelta <= 0 || validationDelta >= 0) return null

  const gap = trainDelta - validationDelta
  if (gap < config.overfitDeltaThreshold) return null

  return {
    id: "overfitting",
    title: "Possible overfitting detected",
    severity: gap >= config.overfitDeltaThreshold * 2 ? "critical" : "warning",
    description: `Train score increased by ${trainDelta.toFixed(3)} while validation score decreased by ${Math.abs(validationDelta).toFixed(3)} (gap ${gap.toFixed(3)} >= threshold ${config.overfitDeltaThreshold}).`,
    evidence: {
      trainDelta,
      validationDelta,
      gap,
      threshold: config.overfitDeltaThreshold,
      trainTail: train.slice(-3),
      validationTail: validation.slice(-3),
    },
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/** Input for the guardrail checker representing a candidate trial. */
export interface BenchOptGuardrailCandidateInput {
  /** Average total score for the candidate. */
  averageTotal: number | null
  /** Per-surface breakdowns for the candidate. */
  surfaces: ReadonlyArray<{ surface: string; averageTotal: number }>
}

/** Input for the guardrail checker representing the current champion. */
export interface BenchOptGuardrailChampionInput {
  /** Average total score for the champion. */
  averageTotal: number | null
  /** Per-surface breakdowns for the champion. */
  surfaces: ReadonlyArray<{ surface: string; averageTotal: number }>
}

/** Extra context that enriches guardrail checks beyond simple score comparison. */
export interface BenchOptGuardrailContext {
  /** Current iteration index (0-based). */
  currentIteration: number
  /** Splits that have already been evaluated in this experiment. */
  observedSplits: readonly BenchOptTrialSplit[]
  /** Historical train scores (ordered chronologically). */
  trainScoreTrend: readonly number[]
  /** Historical validation scores (ordered chronologically). */
  validationScoreTrend: readonly number[]
}

/**
 * Run all safety guardrails against a candidate compared to the current champion.
 *
 * Returns a structured result containing a verdict ("pass", "warn", "block")
 * and any violations found.
 *
 * @param candidate - Score data for the candidate being evaluated.
 * @param champion - Score data for the current champion (may be null for first run).
 * @param config - Guardrail thresholds (defaults to {@link BENCH_OPT_GUARDRAIL_DEFAULTS}).
 * @param context - Additional context (iteration count, splits, score trends).
 */
export function checkGuardrails(
  candidate: BenchOptGuardrailCandidateInput,
  champion: BenchOptGuardrailChampionInput | null,
  config: Partial<BenchOptGuardrailConfig> = {},
  context: Partial<BenchOptGuardrailContext> = {},
): BenchOptGuardrailResult {
  const resolved: BenchOptGuardrailConfig = {
    ...BENCH_OPT_GUARDRAIL_DEFAULTS,
    ...config,
  }

  const violations: BenchOptGuardrailViolation[] = []

  // 1. Average regression
  if (champion) {
    const avgViolation = detectAverageRegression(candidate.averageTotal, champion.averageTotal, resolved)
    if (avgViolation) violations.push(avgViolation)
  }

  // 2. Per-surface regression
  if (champion) {
    const surfaceViolations = detectSurfaceRegressions(candidate.surfaces, champion.surfaces, resolved)
    violations.push(...surfaceViolations)
  }

  // 3. Split discipline
  if (context.observedSplits) {
    const splitViolation = detectSplitViolations(context.observedSplits, resolved)
    if (splitViolation) violations.push(splitViolation)
  }

  // 4. Max iterations
  if (context.currentIteration !== undefined) {
    const iterViolation = detectIterationOverrun(context.currentIteration, resolved)
    if (iterViolation) violations.push(iterViolation)
  }

  // 5. Overfitting
  if (context.trainScoreTrend && context.validationScoreTrend) {
    const overfitViolation = detectOverfitting(
      { train: context.trainScoreTrend, validation: context.validationScoreTrend },
      resolved,
    )
    if (overfitViolation) violations.push(overfitViolation)
  }

  // Derive verdict
  const hasCritical = violations.some((v) => v.severity === "critical")
  const hasWarning = violations.some((v) => v.severity === "warning")

  let verdict: BenchOptGuardrailVerdict = "pass"
  if (hasCritical) verdict = "block"
  else if (hasWarning) verdict = "warn"

  return {
    verdict,
    violations,
    config: resolved,
    checkedAt: new Date().toISOString(),
  }
}

/**
 * Convenience: extract score trends from a list of experiment trials.
 *
 * Returns train and validation average-total arrays suitable for passing
 * to {@link checkGuardrails} via the context parameter.
 */
export function extractScoreTrends(
  trials: readonly BenchOptExperimentTrial[],
): { train: number[]; validation: number[] } {
  const train: number[] = []
  const validation: number[] = []

  for (const trial of trials) {
    if (trial.split === "train") {
      train.push(trial.breakdown.total)
    } else if (trial.split === "validation") {
      validation.push(trial.breakdown.total)
    }
  }

  return { train, validation }
}

/**
 * Convenience: extract a {@link BenchOptGuardrailCandidateInput} from a
 * baseline snapshot (used when comparing against the baseline rather than
 * another trial).
 */
export function baselineToGuardrailInput(
  baseline: BenchOptBaselineSnapshot,
): BenchOptGuardrailChampionInput {
  return {
    averageTotal: baseline.averageTotal,
    surfaces: baseline.surfaces.map((s) => ({ surface: s.surface, averageTotal: s.averageTotal })),
  }
}
