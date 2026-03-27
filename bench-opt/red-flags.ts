import type {
  BenchOptCandidate,
  BenchOptEditInstruction,
  BenchOptExperimentTrial,
  BenchOptScoreBreakdown,
  BenchOptTrialSplit,
} from "./types.ts"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Severity of a detected red flag. */
export type BenchOptRedFlagSeverity = "warning" | "critical"

/** A single red-flag alert. */
export interface BenchOptRedFlag {
  /** Machine-readable identifier (e.g. "identical-scores"). */
  id: string
  /** Severity level. */
  severity: BenchOptRedFlagSeverity
  /** Human-readable description of the issue. */
  description: string
  /** Structured evidence supporting the alert. */
  evidence: Record<string, unknown>
  /** Suggested action the operator should take. */
  recommendedAction: string
}

/** Aggregated result of the red-flag detection scan. */
export interface BenchOptRedFlagReport {
  /** Detected red flags (may be empty). */
  flags: BenchOptRedFlag[]
  /** Number of trials inspected. */
  trialsInspected: number
  /** ISO timestamp of the scan. */
  scannedAt: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function allEqual(values: readonly number[]): boolean {
  if (values.length <= 1) return false
  return values.every((v) => v === values[0])
}

function variance(values: readonly number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
}

function standardDeviation(values: readonly number[]): number {
  return Math.sqrt(variance(values))
}

function hashCandidate(candidate: BenchOptCandidate): string {
  const parts = [
    candidate.promptCandidateId ?? "",
    candidate.contextCandidateId ?? "",
    candidate.prompt,
    candidate.contextLines.join("\n"),
  ]
  return parts.join("|")
}

// ---------------------------------------------------------------------------
// Individual detectors
// ---------------------------------------------------------------------------

/**
 * Flag if all scenario scores within a trial are identical (including
 * perfect 1.0 across the board), which suggests evaluation is broken.
 */
function detectSuspiciousScorePatterns(
  trials: readonly BenchOptExperimentTrial[],
): BenchOptRedFlag[] {
  const flags: BenchOptRedFlag[] = []

  for (const trial of trials) {
    const { breakdown } = trial
    const scoreValues = [
      breakdown.baselineHealth,
      breakdown.promptClarity,
      breakdown.contextCoverage,
      breakdown.artifactAlignment,
      breakdown.structuralSignals,
    ]

    // All sub-scores identical
    if (allEqual(scoreValues)) {
      flags.push({
        id: "identical-scores",
        severity: "warning",
        description: `Trial ${trial.trialId} has all sub-scores identical (${scoreValues[0]}). The evaluator may not be differentiating across criteria.`,
        evidence: { trialId: trial.trialId, scores: scoreValues },
        recommendedAction: "Inspect the evaluator logic to confirm scores are being computed independently for each criterion.",
      })
    }

    // Perfect 1.0 on everything (suspiciously good)
    if (scoreValues.every((v) => v === 1)) {
      flags.push({
        id: "perfect-scores",
        severity: "critical",
        description: `Trial ${trial.trialId} achieved a perfect 1.0 on every sub-score. This is almost certainly an evaluator bug.`,
        evidence: { trialId: trial.trialId, scores: scoreValues },
        recommendedAction: "Verify the evaluator is not returning hard-coded scores. Rerun the trial with additional logging.",
      })
    }

    // All zeros
    if (scoreValues.every((v) => v === 0) && breakdown.total === 0) {
      flags.push({
        id: "all-zero-scores",
        severity: "critical",
        description: `Trial ${trial.trialId} scored zero on every dimension. The evaluator likely failed to run.`,
        evidence: { trialId: trial.trialId },
        recommendedAction: "Check evaluator logs for errors. Confirm the trial produced artifacts for the evaluator to score.",
      })
    }
  }

  return flags
}

/**
 * Scan edit instructions for dangerous patterns such as test-file deletions
 * or empty edits.
 */
function detectGenerationAnomalies(
  trials: readonly BenchOptExperimentTrial[],
): BenchOptRedFlag[] {
  const flags: BenchOptRedFlag[] = []

  for (const trial of trials) {
    const edits = trial.candidate.edits
    if (!edits || edits.length === 0) continue

    // Detect noop edits (replace with same content)
    const noops = edits.filter(
      (e) => e.kind === "replace" && e.search === e.replace,
    )

    if (noops.length > 0) {
      flags.push({
        id: "noop-edits",
        severity: "warning",
        description: `Trial ${trial.trialId} contains ${noops.length} no-op edit(s) where search === replace.`,
        evidence: {
          trialId: trial.trialId,
          noopPaths: noops.map((e) => e.path),
        },
        recommendedAction: "Filter out no-op edits in the candidate generator. These waste evaluation time without changing behavior.",
      })
    }

    // Detect suspicious file paths in edits (test deletions, config wipes)
    const dangerousPatterns = [
      /\.test\.(ts|js|tsx|jsx)$/,
      /\.spec\.(ts|js|tsx|jsx)$/,
      /__tests__\//,
      /\.env$/,
      /tsconfig\.json$/,
      /package\.json$/,
    ]

    for (const edit of edits) {
      if (edit.kind === "rewrite") {
        for (const pattern of dangerousPatterns) {
          if (pattern.test(edit.path) && edit.content.trim().length === 0) {
            flags.push({
              id: "dangerous-rewrite",
              severity: "critical",
              description: `Trial ${trial.trialId} rewrites "${edit.path}" with empty content. This looks like a test or config file deletion.`,
              evidence: { trialId: trial.trialId, path: edit.path, contentLength: edit.content.length },
              recommendedAction: "Block this candidate. Rewriting test/config files with empty content is destructive.",
            })
          }
        }
      }
    }
  }

  return flags
}

/**
 * Detect cases where the same candidate (by content hash) is submitted
 * multiple times across trials.
 */
function detectCandidateStaleness(
  trials: readonly BenchOptExperimentTrial[],
): BenchOptRedFlag[] {
  const flags: BenchOptRedFlag[] = []

  const hashCounts = new Map<string, string[]>()
  for (const trial of trials) {
    const hash = hashCandidate(trial.candidate)
    const existing = hashCounts.get(hash) ?? []
    existing.push(trial.trialId)
    hashCounts.set(hash, existing)
  }

  for (const [hash, trialIds] of hashCounts) {
    if (trialIds.length > 1) {
      flags.push({
        id: "stale-candidate",
        severity: "warning",
        description: `The same candidate content was submitted ${trialIds.length} times across trials: ${trialIds.join(", ")}. The generator may be stuck in a loop.`,
        evidence: { trialIds, duplicateCount: trialIds.length },
        recommendedAction: "Verify the candidate generator is producing diverse outputs. Consider adding a deduplication check.",
      })
    }
  }

  return flags
}

/**
 * Detect flaky scoring behavior: high variance in the total score for
 * trials that share the same candidate ID and split.
 */
function detectFlakyBehavior(
  trials: readonly BenchOptExperimentTrial[],
  maxAcceptableStdDev = 0.15,
): BenchOptRedFlag[] {
  const flags: BenchOptRedFlag[] = []

  // Group trials by (candidateId, split)
  const groups = new Map<string, { trialIds: string[]; totals: number[] }>()
  for (const trial of trials) {
    const key = `${trial.candidateId}:${trial.split}`
    const group = groups.get(key) ?? { trialIds: [], totals: [] }
    group.trialIds.push(trial.trialId)
    group.totals.push(trial.breakdown.total)
    groups.set(key, group)
  }

  for (const [key, group] of groups) {
    if (group.totals.length < 2) continue

    const stdDev = standardDeviation(group.totals)
    if (stdDev <= maxAcceptableStdDev) continue

    flags.push({
      id: "flaky-scores",
      severity: stdDev > maxAcceptableStdDev * 2 ? "critical" : "warning",
      description: `Candidate group "${key}" has high score variance (stddev ${stdDev.toFixed(3)}) across ${group.totals.length} trials. Scores may be flaky.`,
      evidence: {
        key,
        trialIds: group.trialIds,
        totals: group.totals,
        stdDev,
        threshold: maxAcceptableStdDev,
      },
      recommendedAction: "Re-evaluate the candidate with more reruns to confirm consistency, or inspect the evaluator for non-determinism.",
    })
  }

  return flags
}

/**
 * Detect unexpected score distribution: all trials score in a very narrow
 * band, suggesting the optimizer is not exploring effectively.
 */
function detectLowDiversity(
  trials: readonly BenchOptExperimentTrial[],
  minExpectedRange = 0.05,
): BenchOptRedFlag[] {
  if (trials.length < 3) return []

  const totals = trials.map((t) => t.breakdown.total)
  const range = Math.max(...totals) - Math.min(...totals)

  if (range >= minExpectedRange) return []

  return [
    {
      id: "low-diversity",
      severity: "warning",
      description: `All ${trials.length} trials scored within a ${range.toFixed(4)} range. The optimizer may not be exploring the search space effectively.`,
      evidence: {
        trialCount: trials.length,
        min: Math.min(...totals),
        max: Math.max(...totals),
        range,
        threshold: minExpectedRange,
      },
      recommendedAction: "Increase prompt/context diversity in the candidate pool, or broaden the optimization objectives.",
    },
  ]
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/** Configuration options for red-flag detection sensitivity. */
export interface BenchOptRedFlagDetectionOptions {
  /** Maximum acceptable standard deviation before flagging flaky scores. Default 0.15. */
  maxAcceptableStdDev?: number
  /** Minimum expected score range across all trials. Default 0.05. */
  minExpectedScoreRange?: number
}

/**
 * Scan the experiment history for red flags.
 *
 * Examines score patterns, generation anomalies, candidate staleness,
 * flaky behaviour, and diversity. Returns a structured report with all
 * detected issues.
 *
 * @param trials - The full list of experiment trials to inspect.
 * @param options - Optional sensitivity tuning.
 */
export function detectRedFlags(
  trials: readonly BenchOptExperimentTrial[],
  options: BenchOptRedFlagDetectionOptions = {},
): BenchOptRedFlagReport {
  const maxStdDev = options.maxAcceptableStdDev ?? 0.15
  const minRange = options.minExpectedScoreRange ?? 0.05

  const flags: BenchOptRedFlag[] = [
    ...detectSuspiciousScorePatterns(trials),
    ...detectGenerationAnomalies(trials),
    ...detectCandidateStaleness(trials),
    ...detectFlakyBehavior(trials, maxStdDev),
    ...detectLowDiversity(trials, minRange),
  ]

  return {
    flags,
    trialsInspected: trials.length,
    scannedAt: new Date().toISOString(),
  }
}
