/**
 * Enhanced Reporting Helpers
 *
 * Trustworthy proof-suite output with provenance, sensitivity analysis,
 * hidden check transparency, determinism warnings, and overall
 * trustworthiness assessment.
 */

import type { DimensionScore, CompositeScore } from "./composite-scorer.ts"
import type { HiddenGateResult, HardenedVerdict } from "./hardened-verdict.ts"
import { checkDeterministicWarning } from "./hardened-verdict.ts"
import type { ProofSuiteResult, ProofRunResult } from "./proof-suite.ts"
import { computeStdDev } from "./proof-suite.ts"

// ---------------------------------------------------------------------------
// 1. Provenance Section
// ---------------------------------------------------------------------------

/**
 * Render a provenance section for each dimension showing:
 * - Score value
 * - Sources (which evidence contributed)
 * - Confidence level
 * - Human-readable reasoning
 */
export function renderProvenanceSection(
  dimensionScores: DimensionScore[],
): string {
  const lines: string[] = []

  lines.push("## Score Provenance")
  lines.push("")

  if (dimensionScores.length === 0) {
    lines.push("No dimension scores available.")
    lines.push("")
    return lines.join("\n")
  }

  for (const dim of dimensionScores) {
    const status = dim.passed ? "PASS" : "FAIL"
    const confidence = deriveConfidence(dim)

    lines.push(`### ${dim.label} (${dim.dimensionId})`)
    lines.push("")
    lines.push(`- **Score:** ${dim.score} / 100 (threshold: ${dim.threshold}) -- ${status}`)
    lines.push(`- **Weight:** ${(dim.weight * 100).toFixed(0)}%`)
    lines.push(`- **Confidence:** ${confidence}`)
    lines.push("")

    // Sources / evidence
    if (dim.evidence.length > 0) {
      lines.push("**Sources:**")
      for (const ev of dim.evidence) {
        lines.push(`  - ${ev}`)
      }
      lines.push("")
    } else {
      lines.push("**Sources:** No evidence provided.")
      lines.push("")
    }

    // Reasoning / critique
    if (dim.critique.length > 0) {
      lines.push("**Reasoning / Issues:**")
      for (const c of dim.critique) {
        lines.push(`  - ${c}`)
      }
      lines.push("")
    }
  }

  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// 2. Prompt Sensitivity Section
// ---------------------------------------------------------------------------

/**
 * Show how different prompts produced different outcomes across a proof suite.
 *
 * Renders:
 * - Per-prompt score distribution
 * - Sprint plan differences
 * - Dimension weight differences
 */
export function renderPromptSensitivitySection(
  suiteResult: ProofSuiteResult,
): string {
  const lines: string[] = []

  lines.push("## Prompt Sensitivity Analysis")
  lines.push("")

  const perPrompt = suiteResult.statistics.perPrompt
  if (perPrompt.length === 0) {
    lines.push("No per-prompt data available.")
    lines.push("")
    return lines.join("\n")
  }

  // Per-prompt score distribution
  lines.push("### Score Distribution by Prompt")
  lines.push("")
  lines.push("| Prompt | Avg Score | Min | Max | Range | Std Dev | Pass Rate |")
  lines.push("|--------|----------:|----:|----:|------:|--------:|----------:|")

  for (const pp of perPrompt) {
    const range = pp.scoreRange[1] - pp.scoreRange[0]
    const promptRuns = suiteResult.runs.filter((r) => r.promptId === pp.promptId)
    const scores = promptRuns.map((r) => r.result.finalScore ?? 0)
    const stdDev = computeStdDev(scores)
    const passRate = (pp.successRate * 100).toFixed(0)

    lines.push(
      `| ${pp.promptId} | ${pp.avgScore} | ${pp.scoreRange[0]} | ${pp.scoreRange[1]} | ${range} | ${stdDev.toFixed(2)} | ${passRate}% |`,
    )
  }
  lines.push("")

  // Sprint plan differences
  lines.push("### Sprint Progression by Prompt")
  lines.push("")

  for (const pp of perPrompt) {
    const promptRuns = suiteResult.runs.filter((r) => r.promptId === pp.promptId)
    if (promptRuns.length === 0) continue

    lines.push(`**${pp.promptId}** (${pp.category}):`)

    for (const run of promptRuns) {
      const sprintScores = run.result.sprints
        .map((s) => s.compositeScore?.total ?? 0)
        .map((s) => Math.round(s))
      const trend = sprintScores.join(" -> ")
      lines.push(`  - Run ${run.runIndex + 1}: ${trend} (final: ${run.result.finalVerdict})`)
    }
    lines.push("")
  }

  // Cross-prompt variance analysis
  lines.push("### Cross-Prompt Variance")
  lines.push("")

  const avgScores = perPrompt.map((pp) => pp.avgScore)
  const crossPromptStdDev = computeStdDev(avgScores)
  const minAvg = Math.min(...avgScores)
  const maxAvg = Math.max(...avgScores)
  const crossRange = maxAvg - minAvg

  lines.push(`- **Cross-prompt std dev:** ${crossPromptStdDev.toFixed(2)}`)
  lines.push(`- **Score range across prompts:** ${minAvg} - ${maxAvg} (spread: ${crossRange.toFixed(1)})`)
  lines.push("")

  if (crossRange > 20) {
    lines.push(
      "NOTE: Large cross-prompt variance (>20 points) suggests the system " +
        "is sensitive to prompt phrasing. Results may not generalize.",
    )
    lines.push("")
  } else if (crossRange < 3) {
    lines.push(
      "NOTE: Very low cross-prompt variance (<3 points) may indicate " +
        "the scoring is not prompt-sensitive, or scores are template-driven.",
    )
    lines.push("")
  }

  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// 3. Hidden Check Section
// ---------------------------------------------------------------------------

/**
 * Render the hidden check section showing blind evaluator and holdout results.
 */
export function renderHiddenCheckSection(
  hiddenGate: HiddenGateResult,
): string {
  const lines: string[] = []

  lines.push("## Hidden Integrity Checks")
  lines.push("")

  // --- Blind evaluator ---
  lines.push("### Blind Evaluator")
  lines.push("")

  const blind = hiddenGate.blindEvaluator
  if (!blind.ran) {
    lines.push("Blind evaluator did not run.")
    lines.push("")
  } else {
    const verdictEmoji =
      blind.verdict === "pass" ? "[OK]" : blind.verdict === "warn" ? "[WARN]" : "[FAIL]"

    lines.push(`- **Status:** ${verdictEmoji} ${blind.verdict.toUpperCase()}`)
    lines.push(
      `- **Blind composite score:** ${blind.compositeScore ?? "N/A"}`,
    )
    lines.push(
      `- **Divergence from self-evaluation:** ${blind.divergenceFromSelf !== null ? blind.divergenceFromSelf.toFixed(2) + " points" : "N/A"}`,
    )

    if (blind.suspiciousDimensions.length > 0) {
      lines.push(
        `- **Suspicious dimensions (>15pt divergence):** ${blind.suspiciousDimensions.join(", ")}`,
      )
    } else {
      lines.push("- **Suspicious dimensions:** None")
    }
    lines.push("")

    if (blind.verdict === "fail") {
      lines.push(
        "WARNING: The blind evaluator detected significant divergence from the " +
          "self-evaluation. This run's self-reported scores may be inflated.",
      )
      lines.push("")
    } else if (blind.verdict === "warn") {
      lines.push(
        "NOTICE: Some dimensions show divergence between blind and self-evaluation. " +
          "Review the suspicious dimensions above.",
      )
      lines.push("")
    }
  }

  // --- Holdout scenarios ---
  lines.push("### Holdout Scenarios")
  lines.push("")

  const holdout = hiddenGate.holdoutScenarios
  if (!holdout.ran) {
    lines.push("Holdout scenarios did not run.")
    lines.push("")
  } else {
    const total = holdout.passCount + holdout.failCount
    const passRate = total > 0 ? ((holdout.passCount / total) * 100).toFixed(0) : "N/A"
    const verdictLabel =
      holdout.verdict === "pass" ? "[OK]" : holdout.verdict === "warn" ? "[WARN]" : "[FAIL]"

    lines.push(`- **Status:** ${verdictLabel} ${holdout.verdict.toUpperCase()}`)
    lines.push(`- **Pass rate:** ${holdout.passCount}/${total} (${passRate}%)`)
    lines.push("")

    if (holdout.results.length > 0) {
      lines.push("| Scenario | Pass | Score |")
      lines.push("|----------|:----:|------:|")
      for (const r of holdout.results) {
        const passStr = r.pass ? "Yes" : "**No**"
        lines.push(`| ${r.scenarioId} | ${passStr} | ${r.score} |`)
      }
      lines.push("")
    }

    if (holdout.verdict === "fail") {
      lines.push(
        "WARNING: Holdout scenarios failed at a rate that vetoes this run. " +
          "The extension may not handle edge cases reliably.",
      )
      lines.push("")
    }
  }

  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// 4. Determinism Warning Section
// ---------------------------------------------------------------------------

/**
 * If all scores are identical (or nearly so), render a prominent warning.
 *
 * This section is only rendered when a determinism warning triggers.
 */
export function renderDeterminismWarningSection(scores: number[]): string {
  const lines: string[] = []

  const isDeterministic = checkDeterministicWarning(scores)

  if (!isDeterministic) {
    return "" // no warning needed
  }

  lines.push("## Determinism Warning")
  lines.push("")

  const stddev = computeStdDev(scores)
  const allIdentical = stddev === 0

  if (allIdentical) {
    lines.push(
      `WARNING: All ${scores.length} runs produced identical scores (${scores[0]}). ` +
        "This may indicate template-driven scoring rather than genuine per-run evaluation.",
    )
  } else {
    lines.push(
      `WARNING: Score standard deviation is extremely low (${stddev.toFixed(4)}). ` +
        `Across ${scores.length} runs, scores ranged from ${Math.min(...scores)} to ${Math.max(...scores)}. ` +
        "This near-uniform distribution suggests possible template-driven scoring.",
    )
  }
  lines.push("")

  lines.push(
    "**Recommendation:** Verify that each run is being independently evaluated " +
      "and that the evaluator is not reusing cached or templated score patterns.",
  )
  lines.push("")

  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// 5. Trustworthiness Section
// ---------------------------------------------------------------------------

/**
 * Render an overall trustworthiness assessment for a hardened verdict.
 */
export function renderTrustworthinessSection(
  verdict: HardenedVerdict,
): string {
  const lines: string[] = []

  lines.push("## Trustworthiness Assessment")
  lines.push("")

  const score = verdict.trustworthinessScore
  const level = deriveTrustLevel(score)

  lines.push(`**Trustworthiness Score:** ${score} / 100 (${level})`)
  lines.push("")

  // Breakdown
  lines.push("### Factors")
  lines.push("")

  // Visible gate
  const visibleStatus = verdict.visibleGate.passed ? "Passed" : "Failed"
  lines.push(`- **Visible gate:** ${visibleStatus} (score: ${verdict.visibleGate.compositeScore})`)

  // Blind evaluator
  const blindGate = verdict.hiddenGate.blindEvaluator
  if (blindGate.ran) {
    const divergence = blindGate.divergenceFromSelf
    const divergenceStr = divergence !== null ? divergence.toFixed(2) : "N/A"
    const penalty = divergence !== null ? Math.round(divergence * 2) : 0
    lines.push(
      `- **Blind evaluator divergence:** ${divergenceStr} points (trust penalty: -${penalty})`,
    )
  } else {
    lines.push("- **Blind evaluator:** Not run (no penalty applied)")
  }

  // Holdout scenarios
  const holdoutGate = verdict.hiddenGate.holdoutScenarios
  if (holdoutGate.ran) {
    const penalty = holdoutGate.failCount * 15
    lines.push(
      `- **Holdout failures:** ${holdoutGate.failCount} (trust penalty: -${penalty})`,
    )
  } else {
    lines.push("- **Holdout scenarios:** Not run (no penalty applied)")
  }

  // Determinism
  if (verdict.deterministicWarning) {
    lines.push("- **Determinism warning:** ACTIVE (trust penalty: -20)")
  } else {
    lines.push("- **Determinism check:** OK (no penalty)")
  }
  lines.push("")

  // Combined verdict
  lines.push("### Combined Verdict")
  lines.push("")
  lines.push(`**${verdict.combinedVerdict.toUpperCase()}** -- ${verdict.verdictReason}`)
  lines.push("")

  // Trust level guidance
  lines.push("### Interpretation")
  lines.push("")
  if (score >= 80) {
    lines.push(
      "High trustworthiness: The run's scores are corroborated by blind evaluation " +
        "and holdout scenarios. Results are likely reliable.",
    )
  } else if (score >= 50) {
    lines.push(
      "Moderate trustworthiness: Some discrepancies were detected between " +
        "self-evaluation and independent checks. Review flagged dimensions carefully.",
    )
  } else {
    lines.push(
      "Low trustworthiness: Significant divergence or holdout failures detected. " +
        "Self-reported scores may not reflect actual quality. Manual review recommended.",
    )
  }
  lines.push("")

  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Derive a confidence level for a dimension based on evidence availability.
 */
function deriveConfidence(dim: DimensionScore): "high" | "medium" | "low" {
  const evidenceCount = dim.evidence.length
  const hasCritique = dim.critique.length > 0

  if (evidenceCount >= 3) return "high"
  if (evidenceCount >= 1 || hasCritique) return "medium"
  return "low"
}

/**
 * Map a trustworthiness score to a human-readable level.
 */
function deriveTrustLevel(score: number): string {
  if (score >= 80) return "High"
  if (score >= 60) return "Moderate"
  if (score >= 40) return "Low"
  return "Very Low"
}
