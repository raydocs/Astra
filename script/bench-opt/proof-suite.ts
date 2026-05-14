/**
 * Proof-Run Suite Infrastructure
 *
 * Runs multiple proof benchmarks with different prompts, multiple times each,
 * and collects statistics for stability assessment.
 */

import { randomUUID } from "node:crypto"

import {
  createLongRunConfig,
  runLongRunBenchmark,
  type LongRunConfig,
  type LongRunResult,
} from "./long-run.ts"
import type { PerturbationConfig } from "./perturbation.ts"
import {
  evaluateVisibleGate,
  evaluateHiddenGate,
  computeHardenedVerdict,
  type HardenedVerdict,
  type HiddenGateResult,
} from "./hardened-verdict.ts"
import { type BlindEvaluatorInput } from "./blind-evaluator.ts"
import { createDefaultScoringConfig } from "./composite-scorer.ts"
import type { BenchOptEvaluatorArtifact } from "./evaluator.ts"
import { holdoutScenarios } from "../bench-live/scenarios/holdout/index.ts"
import {
  renderPromptSensitivitySection,
  renderDeterminismWarningSection,
  renderTrustworthinessSection,
} from "./enhanced-reporting.ts"
import {
  summarizeDecisionImpacts,
  renderDecisionImpactMarkdown,
  type DecisionImpactSummary,
} from "./decision-impact.ts"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProofSuiteConfig {
  prompts: Array<{
    id: string
    prompt: string
    category: string // e.g. "browser-extension", "ui-tool", "reading-app"
    difficulty: "easy" | "medium" | "hard"
  }>
  runsPerPrompt: number // default: 3
  sprintsPerRun: number // default: 5
  longRunConfig?: Partial<LongRunConfig>
}

export interface ProofRunResult {
  promptId: string
  runIndex: number
  result: LongRunResult
  durationMs: number
  hiddenGateResult?: HardenedVerdict | null
}

export interface ProofSuiteResult {
  schemaVersion: 1
  suiteId: string
  generatedAt: string
  config: ProofSuiteConfig
  runs: ProofRunResult[]
  statistics: {
    totalRuns: number
    passCount: number
    failCount: number
    partialCount: number
    successRate: number // 0-1
    averageFinalScore: number
    scoreStdDev: number
    averageSprintScores: number[] // avg score per sprint position
    livePassRate: number // across all runs
    promotionReadyRate: number
    perPrompt: Array<{
      promptId: string
      category: string
      runs: number
      passCount: number
      successRate: number
      avgScore: number
      scoreRange: [number, number]
    }>
    perDifficulty: Array<{
      difficulty: string
      runs: number
      passCount: number
      successRate: number
      avgScore: number
    }>
    // Hardening statistics
    promptFamilies: Record<string, number> // count per prompt family
    deterministicWarning: boolean
    avgTrustworthiness: number
    // Hidden gate statistics
    hiddenGateRuns: number // how many runs had hidden gate executed
    hiddenGateDowngrades: number // how many runs were downgraded by hidden gate
    holdoutPassCount: number // total holdout scenario passes across all runs
    holdoutFailCount: number // total holdout scenario failures across all runs
    avgBlindDivergence: number // average blind evaluator divergence from self-eval
  }
  verdict: "stable-pass" | "unstable" | "fail"
  // stable-pass: >=80% success rate
  // unstable: 50-79% success rate
  // fail: <50% success rate
  notes: string[]
}

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

/** Create a default proof suite configuration with 12 representative prompts across 3 difficulty tiers and all 5 prompt families. */
export function createDefaultProofSuiteConfig(
  overrides?: Partial<Pick<ProofSuiteConfig, "runsPerPrompt" | "sprintsPerRun" | "longRunConfig">>,
): ProofSuiteConfig {
  return {
    prompts: [
      // --- Easy (4 prompts) ---
      {
        id: "todo-app",
        prompt:
          "Build a minimal todo app browser extension with categories, due dates, and a compact popup panel",
        category: "data-crud",
        difficulty: "easy",
      },
      {
        id: "bookmark-tagger",
        prompt:
          "Build a browser extension that lets users tag and organize bookmarks with a searchable popup",
        category: "content-reading",
        difficulty: "easy",
      },
      {
        id: "color-picker",
        prompt:
          "Build a browser extension with a floating color picker overlay that copies hex/rgb values to clipboard",
        category: "ui-heavy",
        difficulty: "easy",
      },
      {
        id: "tab-counter",
        prompt:
          "Build a browser extension that shows open tab count per window with a badge and simple popup breakdown",
        category: "observability",
        difficulty: "easy",
      },
      // --- Medium (5 prompts) ---
      {
        id: "article-summarizer",
        prompt:
          "Build a browser extension that summarizes articles, saves highlights with tags, and shows a reading history dashboard",
        category: "content-reading",
        difficulty: "medium",
      },
      {
        id: "reading-assistant",
        prompt:
          "Build a lightweight reading assistant browser extension that shows inline translations, remembers learned vocabulary with spaced repetition, and offers a compact review panel",
        category: "content-reading",
        difficulty: "medium",
      },
      {
        id: "perf-monitor",
        prompt:
          "Build a browser extension that monitors page performance, shows a real-time metrics overlay, and logs historical data with charts",
        category: "observability",
        difficulty: "medium",
      },
      {
        id: "form-filler",
        prompt:
          "Build a browser extension that saves form field values, auto-fills matching forms on revisit, and manages multiple profiles",
        category: "data-crud",
        difficulty: "medium",
      },
      {
        id: "page-annotator",
        prompt:
          "Build a browser extension that lets users draw highlights, add sticky notes, and pin comments directly on any webpage with persistence",
        category: "ui-heavy",
        difficulty: "medium",
      },
      // --- Hard (3 prompts) ---
      {
        id: "multi-tab-coordinator",
        prompt:
          "Build a multi-tab browser extension that coordinates cross-tab state, handles iframe content, manages concurrent API calls with retry logic, and renders results in a floating panel",
        category: "coordination",
        difficulty: "hard",
      },
      {
        id: "collab-editor",
        prompt:
          "Build a browser extension for real-time collaborative annotation where multiple users can highlight, comment, and resolve threads on the same page with conflict resolution",
        category: "coordination",
        difficulty: "hard",
      },
      {
        id: "dashboard-builder",
        prompt:
          "Build a browser extension that lets users create custom dashboard layouts with draggable widget panels, persistent layouts, and real-time data feeds from multiple page sources",
        category: "ui-heavy",
        difficulty: "hard",
      },
    ],
    runsPerPrompt: overrides?.runsPerPrompt ?? 3,
    sprintsPerRun: overrides?.sprintsPerRun ?? 5,
    longRunConfig: overrides?.longRunConfig,
  }
}

// ---------------------------------------------------------------------------
// Statistics helpers
// ---------------------------------------------------------------------------

/** Compute the standard deviation of an array of numbers. */
export function computeStdDev(scores: number[]): number {
  if (scores.length <= 1) return 0
  const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length
  const squaredDiffs = scores.map((s) => (s - mean) ** 2)
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / (scores.length - 1)
  return Math.sqrt(variance)
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

/**
 * Run the full proof suite: for each prompt x runsPerPrompt, call
 * `runLongRunBenchmark`, collect all results, compute statistics,
 * and determine the verdict.
 */
export async function runProofSuite(
  config: ProofSuiteConfig,
): Promise<ProofSuiteResult> {
  const suiteId = `proof-suite-${Date.now()}-${randomUUID().slice(0, 8)}`
  const notes: string[] = []
  const runs: ProofRunResult[] = []

  const totalExpected = config.prompts.length * config.runsPerPrompt
  let completedCount = 0

  const promptIndex0Map = new Map(config.prompts.map((p, i) => [p.id, i]))

  for (const promptSpec of config.prompts) {
    const promptIndex = promptIndex0Map.get(promptSpec.id) ?? 0

    for (let runIndex = 0; runIndex < config.runsPerPrompt; runIndex++) {
      completedCount++
      const label = `[${completedCount}/${totalExpected}] ${promptSpec.id} run ${runIndex + 1}/${config.runsPerPrompt}`
      console.log(`Starting: ${label}`)

      const startMs = Date.now()

      try {
        // Each run gets a unique perturbation seed for hardening
        const perturbSeed = Date.now() + runIndex * 1000 + promptIndex * 10000

        const longRunCfg = createLongRunConfig(promptSpec.prompt, {
          maxSprints: config.sprintsPerRun,
          ...config.longRunConfig,
          hardening: {
            useArtifactScoring: true,
            usePromptClassification: true,
            perturbation: {
              enabled: true,
              seed: perturbSeed,
              thresholdJitter: 3,
              weightJitter: 0.05,
              promptVariants: true,
              scenarioOrderShuffle: true,
            } satisfies PerturbationConfig,
            useHardenedVerdict: true,
            collectRealEvidence: false,
            ...(config.longRunConfig?.hardening ?? {}),
          },
        })

        const result = await runLongRunBenchmark(longRunCfg)
        const durationMs = Date.now() - startMs

        // --- Hidden gate evaluation ---
        let hiddenGateResult: HardenedVerdict | null = null
        const hardeningEnabled = longRunCfg.hardening?.useHardenedVerdict ?? false

        if (hardeningEnabled) {
          try {
            hiddenGateResult = await runHiddenGateForResult(result, config)
            // If hidden gate downgrades verdict, update the run's effective verdict
            if (
              hiddenGateResult &&
              hiddenGateResult.combinedVerdict !== "pass" &&
              result.finalVerdict === "pass"
            ) {
              const mapped = hiddenGateResult.combinedVerdict === "visible-pass-hidden-fail" ? "partial" as const
                : hiddenGateResult.combinedVerdict === "pass-with-warnings" ? "pass" as const
                : hiddenGateResult.combinedVerdict as "pass" | "fail" | "partial"
              result.finalVerdict = mapped
              result.notes.push(
                `Hidden gate downgraded verdict from "pass" to "${hiddenGateResult.combinedVerdict}": ${hiddenGateResult.verdictReason}`,
              )
              console.log(
                `  WARNING: Hidden gate downgraded verdict to ${hiddenGateResult.combinedVerdict.toUpperCase()}`,
              )
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            notes.push(`Hidden gate failed for ${label}: ${msg}`)
            console.warn(`  Hidden gate error: ${msg}`)
          }
        }

        runs.push({
          promptId: promptSpec.id,
          runIndex,
          result,
          durationMs,
          hiddenGateResult,
        })

        console.log(
          `  Completed: ${label} -> ${result.finalVerdict.toUpperCase()} ` +
            `(score: ${result.finalScore ?? "N/A"}, ${formatDuration(durationMs)})`,
        )
      } catch (error) {
        const durationMs = Date.now() - startMs
        const message = error instanceof Error ? error.message : String(error)
        notes.push(`Run failed: ${label} - ${message}`)
        console.error(`  Failed: ${label} - ${message}`)

        // Create a synthetic failed result so the run is accounted for
        const failedResult: LongRunResult = {
          schemaVersion: 1,
          runId: `${suiteId}-${promptSpec.id}-${runIndex}-failed`,
          generatedAt: new Date().toISOString(),
          productPrompt: promptSpec.prompt,
          config: createLongRunConfig(promptSpec.prompt, {
            maxSprints: config.sprintsPerRun,
            ...config.longRunConfig,
          }),
          sprints: [],
          completedSprints: 0,
          totalSprints: config.sprintsPerRun,
          terminationReason: "budget-exhausted",
          finalScore: null,
          finalVerdict: "fail",
          promotionReady: false,
          summary: `Run failed with error: ${message}`,
          notes: [message],
          liveValidation: null,
        }

        runs.push({
          promptId: promptSpec.id,
          runIndex,
          result: failedResult,
          durationMs,
        })
      }
    }
  }

  // Compute statistics
  const statistics = computeStatistics(runs, config)

  // Determine verdict
  const verdict = determineVerdict(statistics.successRate)

  return {
    schemaVersion: 1,
    suiteId,
    generatedAt: new Date().toISOString(),
    config,
    runs,
    statistics,
    verdict,
    notes,
  }
}

// ---------------------------------------------------------------------------
// Statistics computation
// ---------------------------------------------------------------------------

function computeStatistics(
  runs: ProofRunResult[],
  config: ProofSuiteConfig,
): ProofSuiteResult["statistics"] {
  const totalRuns = runs.length
  const passCount = runs.filter((r) => r.result.finalVerdict === "pass").length
  const failCount = runs.filter((r) => r.result.finalVerdict === "fail").length
  const partialCount = runs.filter((r) => r.result.finalVerdict === "partial").length
  const successRate = totalRuns > 0 ? passCount / totalRuns : 0

  // Final scores (use 0 for null scores)
  const finalScores = runs.map((r) => r.result.finalScore ?? 0)
  const averageFinalScore =
    finalScores.length > 0
      ? finalScores.reduce((sum, s) => sum + s, 0) / finalScores.length
      : 0
  const scoreStdDev = computeStdDev(finalScores)

  // Average sprint scores by position
  const maxSprintCount = config.sprintsPerRun
  const averageSprintScores: number[] = []
  for (let si = 0; si < maxSprintCount; si++) {
    const scoresAtPosition: number[] = []
    for (const run of runs) {
      const sprint = run.result.sprints[si]
      if (sprint) {
        scoresAtPosition.push(sprint.compositeScore?.total ?? 0)
      }
    }
    if (scoresAtPosition.length > 0) {
      averageSprintScores.push(
        Math.round(
          (scoresAtPosition.reduce((sum, s) => sum + s, 0) / scoresAtPosition.length) * 10,
        ) / 10,
      )
    } else {
      averageSprintScores.push(0)
    }
  }

  // Live pass rate
  const runsWithLive = runs.filter((r) => r.result.liveValidation?.ran)
  const livePassRate =
    runsWithLive.length > 0
      ? runsWithLive.filter((r) => r.result.liveValidation?.allPassed).length /
        runsWithLive.length
      : 0

  // Promotion ready rate
  const promotionReadyRate =
    totalRuns > 0
      ? runs.filter((r) => r.result.promotionReady).length / totalRuns
      : 0

  // Per-prompt breakdown
  const perPrompt: ProofSuiteResult["statistics"]["perPrompt"] = []
  for (const promptSpec of config.prompts) {
    const promptRuns = runs.filter((r) => r.promptId === promptSpec.id)
    const promptPassCount = promptRuns.filter(
      (r) => r.result.finalVerdict === "pass",
    ).length
    const promptScores = promptRuns.map((r) => r.result.finalScore ?? 0)
    const avgScore =
      promptScores.length > 0
        ? promptScores.reduce((sum, s) => sum + s, 0) / promptScores.length
        : 0
    const minScore = promptScores.length > 0 ? Math.min(...promptScores) : 0
    const maxScore = promptScores.length > 0 ? Math.max(...promptScores) : 0

    perPrompt.push({
      promptId: promptSpec.id,
      category: promptSpec.category,
      runs: promptRuns.length,
      passCount: promptPassCount,
      successRate: promptRuns.length > 0 ? promptPassCount / promptRuns.length : 0,
      avgScore: Math.round(avgScore * 10) / 10,
      scoreRange: [minScore, maxScore],
    })
  }

  // Per-difficulty breakdown
  const difficultyLevels = ["easy", "medium", "hard"] as const
  const perDifficulty: ProofSuiteResult["statistics"]["perDifficulty"] = []
  for (const difficulty of difficultyLevels) {
    const difficultyPromptIds = new Set(
      config.prompts.filter((p) => p.difficulty === difficulty).map((p) => p.id),
    )
    const difficultyRuns = runs.filter((r) => difficultyPromptIds.has(r.promptId))
    const diffPassCount = difficultyRuns.filter(
      (r) => r.result.finalVerdict === "pass",
    ).length
    const diffScores = difficultyRuns.map((r) => r.result.finalScore ?? 0)
    const diffAvgScore =
      diffScores.length > 0
        ? diffScores.reduce((sum, s) => sum + s, 0) / diffScores.length
        : 0

    perDifficulty.push({
      difficulty,
      runs: difficultyRuns.length,
      passCount: diffPassCount,
      successRate: difficultyRuns.length > 0 ? diffPassCount / difficultyRuns.length : 0,
      avgScore: Math.round(diffAvgScore * 10) / 10,
    })
  }

  // Hardening statistics: prompt families
  const promptFamilies: Record<string, number> = {}
  for (const run of runs) {
    const family = run.result.classification?.family ?? "unclassified"
    promptFamilies[family] = (promptFamilies[family] ?? 0) + 1
  }

  // Deterministic warning: check if all final scores are suspiciously identical
  const deterministicWarning = (() => {
    if (finalScores.length <= 1) return false
    const mean = finalScores.reduce((sum, s) => sum + s, 0) / finalScores.length
    const squaredDiffs = finalScores.map((s) => (s - mean) ** 2)
    const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / (finalScores.length - 1)
    return Math.sqrt(variance) < 0.5
  })()

  // Average trustworthiness
  const trustScores = runs
    .map((r) => r.result.hardenedVerdict?.trustworthinessScore)
    .filter((s): s is number => s != null)
  const avgTrustworthiness = trustScores.length > 0
    ? Math.round((trustScores.reduce((sum, s) => sum + s, 0) / trustScores.length) * 10) / 10
    : 0

  // Hidden gate statistics
  const runsWithHiddenGate = runs.filter((r) => r.hiddenGateResult != null)
  const hiddenGateRuns = runsWithHiddenGate.length
  const hiddenGateDowngrades = runsWithHiddenGate.filter(
    (r) => r.hiddenGateResult!.combinedVerdict !== "pass",
  ).length
  const holdoutPassCount = runsWithHiddenGate.reduce(
    (sum, r) => sum + (r.hiddenGateResult!.hiddenGate.holdoutScenarios.passCount),
    0,
  )
  const holdoutFailCount = runsWithHiddenGate.reduce(
    (sum, r) => sum + (r.hiddenGateResult!.hiddenGate.holdoutScenarios.failCount),
    0,
  )
  const divergenceValues = runsWithHiddenGate
    .map((r) => r.hiddenGateResult!.hiddenGate.blindEvaluator.divergenceFromSelf)
    .filter((d): d is number => d != null)
  const avgBlindDivergence = divergenceValues.length > 0
    ? Math.round((divergenceValues.reduce((sum, d) => sum + d, 0) / divergenceValues.length) * 100) / 100
    : 0

  return {
    totalRuns,
    passCount,
    failCount,
    partialCount,
    successRate,
    averageFinalScore: Math.round(averageFinalScore * 10) / 10,
    scoreStdDev: Math.round(scoreStdDev * 100) / 100,
    averageSprintScores,
    livePassRate,
    promotionReadyRate,
    perPrompt,
    perDifficulty,
    promptFamilies,
    deterministicWarning,
    avgTrustworthiness,
    hiddenGateRuns,
    hiddenGateDowngrades,
    holdoutPassCount,
    holdoutFailCount,
    avgBlindDivergence,
  }
}

function determineVerdict(
  successRate: number,
): ProofSuiteResult["verdict"] {
  if (successRate >= 0.8) return "stable-pass"
  if (successRate >= 0.5) return "unstable"
  return "fail"
}

// ---------------------------------------------------------------------------
// Markdown renderer
// ---------------------------------------------------------------------------

/**
 * Render a comprehensive Markdown report from a {@link ProofSuiteResult}.
 *
 * Includes:
 * - Summary table: prompt x runs x pass/fail x scores
 * - Per-prompt breakdown
 * - Score distribution
 * - Stability assessment
 * - Sprint-by-sprint average trend
 */
export function renderProofSuiteMarkdown(result: ProofSuiteResult): string {
  const lines: string[] = []
  const stats = result.statistics

  // Header
  lines.push("# Proof Suite Report")
  lines.push("")
  lines.push(`**Suite ID:** ${result.suiteId}`)
  lines.push(`**Generated:** ${result.generatedAt}`)
  lines.push(`**Verdict:** ${result.verdict.toUpperCase()}`)
  lines.push("")

  // Configuration
  lines.push("## Configuration")
  lines.push("")
  lines.push(`- Prompts: ${result.config.prompts.length}`)
  lines.push(`- Runs per prompt: ${result.config.runsPerPrompt}`)
  lines.push(`- Sprints per run: ${result.config.sprintsPerRun}`)
  lines.push(`- Total runs: ${stats.totalRuns}`)
  lines.push("")

  // Overall Statistics
  lines.push("## Overall Statistics")
  lines.push("")
  lines.push(`- **Success rate:** ${(stats.successRate * 100).toFixed(1)}%`)
  lines.push(`- **Pass / Fail / Partial:** ${stats.passCount} / ${stats.failCount} / ${stats.partialCount}`)
  lines.push(`- **Average final score:** ${stats.averageFinalScore}`)
  lines.push(`- **Score std dev:** ${stats.scoreStdDev}`)
  lines.push(`- **Live pass rate:** ${(stats.livePassRate * 100).toFixed(1)}%`)
  lines.push(`- **Promotion ready rate:** ${(stats.promotionReadyRate * 100).toFixed(1)}%`)
  lines.push("")

  // Summary Table
  lines.push("## Summary Table")
  lines.push("")
  lines.push("| Prompt | Category | Difficulty | Runs | Pass | Rate | Avg Score | Range |")
  lines.push("|--------|----------|------------|------|------|------|-----------|-------|")
  for (const pp of stats.perPrompt) {
    const promptSpec = result.config.prompts.find((p) => p.id === pp.promptId)
    const difficulty = promptSpec?.difficulty ?? "?"
    const rate = `${(pp.successRate * 100).toFixed(0)}%`
    const range = `${pp.scoreRange[0]}-${pp.scoreRange[1]}`
    lines.push(
      `| ${pp.promptId} | ${pp.category} | ${difficulty} | ${pp.runs} | ${pp.passCount} | ${rate} | ${pp.avgScore} | ${range} |`,
    )
  }
  lines.push("")

  // Difficulty Tier Breakdown
  if (stats.perDifficulty.length > 0) {
    lines.push("## Difficulty Tier Breakdown")
    lines.push("")
    lines.push("| Difficulty | Runs | Pass | Success Rate | Avg Score |")
    lines.push("|------------|------|------|-------------|-----------|")
    for (const tier of stats.perDifficulty) {
      const rate = `${(tier.successRate * 100).toFixed(1)}%`
      lines.push(
        `| ${tier.difficulty} | ${tier.runs} | ${tier.passCount} | ${rate} | ${tier.avgScore} |`,
      )
    }
    lines.push("")
  }

  // Per-Prompt Breakdown
  lines.push("## Per-Prompt Breakdown")
  lines.push("")
  for (const pp of stats.perPrompt) {
    const promptSpec = result.config.prompts.find((p) => p.id === pp.promptId)
    lines.push(`### ${pp.promptId} (${pp.category}, ${promptSpec?.difficulty ?? "?"})`)
    lines.push("")
    if (promptSpec) {
      lines.push(`> ${promptSpec.prompt}`)
      lines.push("")
    }
    lines.push(`- Runs: ${pp.runs}`)
    lines.push(`- Passed: ${pp.passCount}`)
    lines.push(`- Success rate: ${(pp.successRate * 100).toFixed(1)}%`)
    lines.push(`- Avg score: ${pp.avgScore}`)
    lines.push(`- Score range: ${pp.scoreRange[0]} - ${pp.scoreRange[1]}`)
    lines.push("")

    // Individual runs
    const promptRuns = result.runs.filter((r) => r.promptId === pp.promptId)
    if (promptRuns.length > 0) {
      lines.push("| Run | Verdict | Score | Sprints | Duration |")
      lines.push("|-----|---------|-------|---------|----------|")
      for (const run of promptRuns) {
        const score = run.result.finalScore ?? "-"
        const sprints = `${run.result.completedSprints}/${run.result.totalSprints}`
        const duration = formatDuration(run.durationMs)
        lines.push(
          `| ${run.runIndex + 1} | ${run.result.finalVerdict.toUpperCase()} | ${score} | ${sprints} | ${duration} |`,
        )
      }
      lines.push("")
    }
  }

  // Score Distribution
  lines.push("## Score Distribution")
  lines.push("")
  const allScores = result.runs.map((r) => r.result.finalScore ?? 0)
  if (allScores.length > 0) {
    const sorted = [...allScores].sort((a, b) => a - b)
    const median =
      sorted.length % 2 === 1
        ? sorted[Math.floor(sorted.length / 2)]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    const p25 = sorted[Math.floor(sorted.length * 0.25)]
    const p75 = sorted[Math.floor(sorted.length * 0.75)]

    lines.push(`- Min: ${sorted[0]}`)
    lines.push(`- P25: ${p25}`)
    lines.push(`- Median: ${median}`)
    lines.push(`- P75: ${p75}`)
    lines.push(`- Max: ${sorted[sorted.length - 1]}`)
    lines.push(`- Mean: ${stats.averageFinalScore}`)
    lines.push(`- Std Dev: ${stats.scoreStdDev}`)
    lines.push("")

    // Histogram-style visualization
    const buckets = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]
    const bucketCounts = buckets.map((low) => {
      const high = low + 10
      return allScores.filter((s) => s >= low && s < high).length
    })
    // Count scores of exactly 100 in the last bucket
    bucketCounts[bucketCounts.length - 1] += allScores.filter((s) => s >= 100).length

    const maxBucketCount = Math.max(...bucketCounts, 1)
    lines.push("```")
    for (let i = 0; i < buckets.length; i++) {
      const label = `${buckets[i].toString().padStart(2)}-${(buckets[i] + 9).toString().padStart(2)}`
      const barLen = Math.round((bucketCounts[i] / maxBucketCount) * 30)
      const bar = "\u2588".repeat(barLen) + " ".repeat(30 - barLen)
      lines.push(`  ${label}: ${bar} ${bucketCounts[i]}`)
    }
    lines.push("```")
    lines.push("")
  } else {
    lines.push("No scores available.")
    lines.push("")
  }

  // Sprint-by-Sprint Average Trend
  lines.push("## Sprint-by-Sprint Average Trend")
  lines.push("")
  if (stats.averageSprintScores.length > 0) {
    const trend = stats.averageSprintScores
      .map((s, i) => `Sprint ${i + 1}: ${s}`)
      .join(" -> ")
    lines.push(trend)
    lines.push("")

    const maxSprintScore = Math.max(...stats.averageSprintScores, 1)
    for (let i = 0; i < stats.averageSprintScores.length; i++) {
      const barLength = Math.round((stats.averageSprintScores[i] / maxSprintScore) * 30)
      const bar = "\u2588".repeat(barLength) + "\u2591".repeat(30 - barLength)
      lines.push(`  Sprint ${i + 1}: ${bar} ${stats.averageSprintScores[i]}`)
    }
    lines.push("")
  } else {
    lines.push("No sprint data available.")
    lines.push("")
  }

  // Stability Assessment
  lines.push("## Stability Assessment")
  lines.push("")
  if (result.verdict === "stable-pass") {
    lines.push(
      `The suite achieved a ${(stats.successRate * 100).toFixed(1)}% success rate ` +
        `across ${stats.totalRuns} runs, indicating **stable** performance. ` +
        `Score standard deviation is ${stats.scoreStdDev}, showing ` +
        `${stats.scoreStdDev <= 5 ? "very consistent" : stats.scoreStdDev <= 10 ? "consistent" : "moderate"} results.`,
    )
  } else if (result.verdict === "unstable") {
    lines.push(
      `The suite achieved a ${(stats.successRate * 100).toFixed(1)}% success rate ` +
        `across ${stats.totalRuns} runs, indicating **unstable** performance. ` +
        `Score standard deviation is ${stats.scoreStdDev}. ` +
        `Further investigation is recommended to identify flaky prompts or scoring inconsistencies.`,
    )
  } else {
    lines.push(
      `The suite achieved only a ${(stats.successRate * 100).toFixed(1)}% success rate ` +
        `across ${stats.totalRuns} runs, indicating **failure**. ` +
        `Score standard deviation is ${stats.scoreStdDev}. ` +
        `The system does not meet the minimum reliability threshold.`,
    )
  }
  lines.push("")

  // --- Hardening sections ---

  // Prompt family distribution
  if (Object.keys(stats.promptFamilies).length > 0) {
    lines.push("## Prompt Family Distribution")
    lines.push("")
    lines.push("| Family | Count | Percentage |")
    lines.push("|--------|------:|-----------:|")
    for (const [family, count] of Object.entries(stats.promptFamilies)) {
      const pct = stats.totalRuns > 0 ? ((count / stats.totalRuns) * 100).toFixed(1) : "0.0"
      lines.push(`| ${family} | ${count} | ${pct}% |`)
    }
    lines.push("")
  }

  // Determinism warning
  if (stats.deterministicWarning) {
    const allScores = result.runs.map((r) => r.result.finalScore ?? 0)
    const warning = renderDeterminismWarningSection(allScores)
    if (warning) {
      lines.push(warning)
    }
  }

  // Trustworthiness
  if (stats.avgTrustworthiness > 0) {
    lines.push("## Trustworthiness Summary")
    lines.push("")
    lines.push(`**Average trustworthiness score:** ${stats.avgTrustworthiness} / 100`)
    lines.push("")

    // Find a representative hardened verdict for detailed rendering
    const representativeVerdict = result.runs
      .map((r) => r.result.hardenedVerdict)
      .find((v): v is HardenedVerdict => v != null)
    if (representativeVerdict) {
      lines.push(renderTrustworthinessSection(representativeVerdict))
      lines.push("")
    }
  }

  // Hidden Gate Summary
  if (stats.hiddenGateRuns > 0) {
    lines.push("## Hidden Gate Summary")
    lines.push("")
    lines.push(`- **Runs with hidden gate:** ${stats.hiddenGateRuns} / ${stats.totalRuns}`)
    lines.push(`- **Runs downgraded by hidden gate:** ${stats.hiddenGateDowngrades}`)
    const downgradeRate = stats.hiddenGateRuns > 0
      ? ((stats.hiddenGateDowngrades / stats.hiddenGateRuns) * 100).toFixed(1)
      : "0.0"
    lines.push(`- **Downgrade rate:** ${downgradeRate}%`)
    lines.push("")

    // Holdout pass/fail rates
    const totalHoldoutRuns = stats.holdoutPassCount + stats.holdoutFailCount
    if (totalHoldoutRuns > 0) {
      const holdoutPassRate = ((stats.holdoutPassCount / totalHoldoutRuns) * 100).toFixed(1)
      lines.push("### Holdout Scenarios")
      lines.push("")
      lines.push(`- **Total holdout runs:** ${totalHoldoutRuns}`)
      lines.push(`- **Passed:** ${stats.holdoutPassCount}`)
      lines.push(`- **Failed:** ${stats.holdoutFailCount}`)
      lines.push(`- **Pass rate:** ${holdoutPassRate}%`)
      if (stats.holdoutFailCount > 0) {
        lines.push("")
        lines.push(`> WARNING: ${stats.holdoutFailCount} holdout scenario failure(s) detected. These harder conditions are not covered by the normal evaluation suite.`)
      }
      lines.push("")
    } else {
      lines.push("### Holdout Scenarios")
      lines.push("")
      lines.push("No holdout scenarios were executed (Playwright may not be available).")
      lines.push("")
    }

    // Blind evaluator divergence stats
    lines.push("### Blind Evaluator Divergence")
    lines.push("")
    lines.push(`- **Average divergence from self-eval:** ${stats.avgBlindDivergence}`)
    if (stats.avgBlindDivergence > 15) {
      lines.push(`- **Status:** HIGH divergence -- self-evaluations may be inflated`)
    } else if (stats.avgBlindDivergence > 8) {
      lines.push(`- **Status:** MODERATE divergence -- some inflation possible`)
    } else {
      lines.push(`- **Status:** LOW divergence -- self-evaluations appear trustworthy`)
    }
    lines.push("")

    // Per-run hidden gate details
    const runsWithGate = result.runs.filter((r) => r.hiddenGateResult != null)
    if (runsWithGate.length > 0) {
      lines.push("### Per-Run Hidden Gate Details")
      lines.push("")
      lines.push("| Prompt | Run | Combined Verdict | Blind Verdict | Holdout Verdict | Divergence | Trust |")
      lines.push("|--------|-----|------------------|---------------|-----------------|------------|-------|")
      for (const run of runsWithGate) {
        const hg = run.hiddenGateResult!
        const divergence = hg.hiddenGate.blindEvaluator.divergenceFromSelf ?? "-"
        lines.push(
          `| ${run.promptId} | ${run.runIndex + 1} | ${hg.combinedVerdict.toUpperCase()} | ${hg.hiddenGate.blindEvaluator.verdict} | ${hg.hiddenGate.holdoutScenarios.verdict} | ${divergence} | ${hg.trustworthinessScore} |`,
        )
      }
      lines.push("")
    }
  }

  // Decision impact summary across all runs
  const allDecisions = result.runs.flatMap((r) =>
    (r.result.sprints ?? [])
      .filter((s) => s.decision)
      .map((s) => ({
        sprintIndex: s.sprintIndex,
        decisionType: s.decision!.type,
        preScore: s.decision!.preScore ?? 0,
        postScore: s.decision!.postScore,
        scoreDelta: (s.decision!.postScore) - (s.decision!.preScore ?? 0),
        dimensionDeltas: s.decision!.dimensionDeltas ?? {},
        effective: (s.decision!.postScore) - (s.decision!.preScore ?? 0) > 0,
        reasoning: `${s.decision!.type}: ${s.decision!.reason}`,
      })),
  )

  if (allDecisions.length > 0) {
    const impactSummary = summarizeDecisionImpacts(allDecisions)
    lines.push(renderDecisionImpactMarkdown(impactSummary))
    lines.push("")
  }

  // Prompt sensitivity analysis
  lines.push(renderPromptSensitivitySection(result))
  lines.push("")

  // Notes
  if (result.notes.length > 0) {
    lines.push("## Notes")
    lines.push("")
    for (const note of result.notes) {
      lines.push(`- ${note}`)
    }
    lines.push("")
  }

  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60_000).toFixed(1)}m`
}

// ---------------------------------------------------------------------------
// Hidden gate runner
// ---------------------------------------------------------------------------

/**
 * Run the hidden gate (blind evaluation + holdout scenarios) for a completed
 * long-run result.
 *
 * Builds a BlindEvaluatorInput from the run's observable evidence, then calls
 * `evaluateHiddenGate` and `computeHardenedVerdict`.
 *
 * Holdout execution is wrapped in try/catch so Playwright unavailability
 * does not crash the suite.
 */
async function runHiddenGateForResult(
  result: LongRunResult,
  _suiteConfig: ProofSuiteConfig,
): Promise<HardenedVerdict> {
  const scoringConfig = createDefaultScoringConfig()

  // Build BlindEvaluatorInput from observable evidence
  const lastSprintIndex = result.completedSprints > 0
    ? result.completedSprints - 1
    : 0

  const blindInput: BlindEvaluatorInput = {
    runId: result.runId,
    sprintIndex: lastSprintIndex,
    observableEvidence: {
      // Intentionally only pass evidence actually observed in this run.
      // Do not fabricate successful build/test outcomes for hidden-gate scoring.
      liveResults: result.liveValidation?.results?.map((r) => ({
        scenarioId: r.scenarioId,
        pass: r.pass,
        score: r.score,
      })) ?? undefined,
      benchScore: result.finalScore ?? undefined,
    },
    scoringConfig,
  }

  // Build a synthetic self-eval artifact from the run's last sprint evaluator
  const lastSprint = result.sprints[lastSprintIndex]
  const selfEvalArtifact = lastSprint?.evaluatorArtifact ?? null

  // Evaluate visible gate from the run's composite score
  const compositeScore = result.finalScore ?? 0
  const visibleGate = evaluateVisibleGate(compositeScore, scoringConfig)

  // Run hidden gate with holdout scenarios
  // Wrap holdouts in try/catch for graceful degradation if Playwright is unavailable
  const holdoutIds = holdoutScenarios.map((s) => s.id)
  let hiddenGate: HiddenGateResult
  const runHoldouts = true

  if (selfEvalArtifact == null) {
    // No self-eval artifact available; build a minimal synthetic one so the
    // blind evaluator has something to compare against.
    const syntheticSelfEval: BenchOptEvaluatorArtifact = {
      schemaVersion: 1,
      runId: result.runId,
      role: "evaluator",
      contract: {
        role: "evaluator",
        objective: "synthetic for hidden gate",
        responsibilities: [],
        inputs: [],
        outputs: [],
      },
      plannerRunId: "",
      generatorRunId: "",
      score: compositeScore,
      verdict: result.finalVerdict === "pass" ? "pass" : "needs-refine",
      recommendation: {
        action: "keep",
        verdict: result.finalVerdict === "pass" ? "pass" : "needs-refine",
        reason: "synthetic for hidden gate",
        rerun: false,
        keep: true,
        reject: false,
        bounded: false,
      },
      critique: [],
      evidence: [],
      nextChecks: [],
      handoff: {
        kind: "keep",
        runId: result.runId,
        objective: "synthetic for hidden gate",
        reason: "synthetic for hidden gate",
      },
      compositeScore: null,
      dimensionScores: [],
    }
    hiddenGate = await evaluateHiddenGate(
      blindInput,
      syntheticSelfEval,
      holdoutIds,
      runHoldouts,
    )
  } else {
    try {
      hiddenGate = await evaluateHiddenGate(
        blindInput,
        selfEvalArtifact,
        holdoutIds,
        runHoldouts,
      )
    } catch {
      // Holdout execution failed (e.g. Playwright unavailable)
      // Retry without holdouts
      console.warn("  Holdout execution failed, retrying without holdouts")
      try {
        hiddenGate = await evaluateHiddenGate(
          blindInput,
          selfEvalArtifact,
          holdoutIds,
          false, // disable holdouts
        )
      } catch {
        // Even blind evaluation failed; construct a minimal result
        hiddenGate = {
          blindEvaluator: {
            ran: false,
            compositeScore: null,
            divergenceFromSelf: null,
            suspiciousDimensions: [],
            verdict: "warn",
          },
          holdoutScenarios: {
            ran: false,
            passCount: 0,
            failCount: 0,
            results: [],
            verdict: "warn",
          },
        }
      }
    }
  }

  // Compute hardened verdict using all collected scores
  const allScores = result.sprints
    .map((s) => s.compositeScore?.total ?? 0)
    .filter((s) => s > 0)
  if (result.finalScore != null) {
    allScores.push(result.finalScore)
  }

  return computeHardenedVerdict(visibleGate, hiddenGate, allScores)
}
