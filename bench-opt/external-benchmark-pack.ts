/**
 * External Benchmark Pack
 *
 * A standardized, frozen benchmark specification for external reproducibility.
 * Defines the exact prompts, scoring rubric, gate thresholds, and pass
 * conditions so that any party can independently verify benchmark results.
 */

import type { ProofSuiteResult } from "./proof-suite.ts"
import type {
  BenchOptCapabilityStatusSummary,
  BenchOptStatusArtifact,
} from "./types.ts"
import type {
  AstraCapabilityId,
  AstraCapabilityLaneStatus,
  AstraCapabilityVerdict,
} from "./capabilities.ts"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BenchmarkPackCapabilityRequirement {
  id: AstraCapabilityId
  minimumVerdict: AstraCapabilityVerdict
  requiredCoverage?: Partial<Record<keyof Pick<BenchOptCapabilityStatusSummary["cards"][number]["currentCoverage"], "bench" | "live" | "holdout" | "proof">, AstraCapabilityLaneStatus>>
  reason: string
}

export interface BenchmarkPackConfig {
  version: string                    // "1.0.0"
  name: string                       // "astra-proof-benchmark-v1"
  description: string
  prompts: Array<{
    id: string
    prompt: string
    family: string
    difficulty: string
    expectedScoreRange: [number, number]  // [min, max] for this prompt
  }>
  scoring: {
    dimensions: Array<{ id: string; weight: number; threshold: number }>
    totalPassThreshold: number
    requiredDimensions: string[]
  }
  gates: {
    visiblePassThreshold: number
    blindDivergenceWarnThreshold: number
    blindDivergenceFailThreshold: number
    holdoutRequired: boolean
    holdoutMinPassRate: number
  }
  runbook: {
    setup: string[]              // steps to set up environment
    executeCommand: string       // the exact command to run
    verifyCommand: string        // how to verify results
    artifactDir: string          // where artifacts are stored
    reportPath: string           // where the final report is
  }
  artifactLayout: {
    root: string
    perRun: string[]             // relative paths expected per run
    perSuite: string[]           // relative paths expected for the suite
  }
  passConditions: {
    minSuccessRate: number       // e.g., 0.8
    maxScoreStdDev: number       // e.g., 5.0
    minAvgScore: number          // e.g., 70
    holdoutPassRate: number      // e.g., 0.9
  }
  requiredCapabilities?: BenchmarkPackCapabilityRequirement[]
}

export interface BenchmarkPackValidationResult {
  packName: string
  packVersion: string
  passed: boolean
  conditions: Array<{
    name: string
    expected: string
    actual: string
    passed: boolean
  }>
  summary: string
  notes: string[]
}

// ---------------------------------------------------------------------------
// Official Benchmark Pack (frozen)
// ---------------------------------------------------------------------------

/**
 * Create the official, frozen Astra proof benchmark pack.
 *
 * This pack is versioned and immutable. Any changes to the benchmark
 * specification must result in a new version number.
 *
 * Uses 12 prompts spanning 4 families at 3 difficulty levels.
 * Fixed 5-dimension scoring rubric with official weights.
 * Fixed gate thresholds for visible, blind, and holdout checks.
 */
export function createOfficialBenchmarkPack(): Readonly<BenchmarkPackConfig> {
  const pack: BenchmarkPackConfig = {
    version: "1.0.0",
    name: "astra-proof-benchmark-v1",
    description:
      "Standardized benchmark pack for Astra's proof-run evaluation system. " +
      "Contains 12 prompts across 4 families (browser-extension, ui-tool, " +
      "reading-app, automation) at 3 difficulty levels (easy, medium, hard). " +
      "Scoring uses a 5-dimension weighted rubric with visible and hidden gates.",

    prompts: [
      // --- browser-extension family ---
      {
        id: "reading-assistant",
        prompt:
          "Build a lightweight reading assistant browser extension that shows inline translations, " +
          "remembers learned vocabulary with spaced repetition, and offers a compact review panel",
        family: "browser-extension",
        difficulty: "medium",
        expectedScoreRange: [55, 85],
      },
      {
        id: "multi-tab-coordinator",
        prompt:
          "Build a multi-tab browser extension that coordinates cross-tab state, handles iframe " +
          "content, manages concurrent API calls with retry logic, and renders results in a floating panel",
        family: "browser-extension",
        difficulty: "hard",
        expectedScoreRange: [40, 75],
      },
      {
        id: "tab-manager",
        prompt:
          "Build a browser extension that groups tabs by domain, provides a search-as-you-type " +
          "omnibar, supports keyboard shortcuts, and persists tab groups across sessions",
        family: "browser-extension",
        difficulty: "easy",
        expectedScoreRange: [65, 90],
      },

      // --- ui-tool family ---
      {
        id: "todo-app",
        prompt:
          "Build a minimal todo app browser extension with categories, due dates, and a compact popup panel",
        family: "ui-tool",
        difficulty: "easy",
        expectedScoreRange: [70, 95],
      },
      {
        id: "perf-monitor",
        prompt:
          "Build a browser extension that monitors page performance, shows a real-time metrics " +
          "overlay, and logs historical data with charts",
        family: "ui-tool",
        difficulty: "medium",
        expectedScoreRange: [55, 80],
      },
      {
        id: "color-picker",
        prompt:
          "Build a browser extension that provides an eyedropper color picker tool, stores a " +
          "palette history, supports copy-to-clipboard in multiple formats (hex, rgb, hsl), " +
          "and includes an accessibility contrast checker",
        family: "ui-tool",
        difficulty: "hard",
        expectedScoreRange: [45, 75],
      },

      // --- reading-app family ---
      {
        id: "article-summarizer",
        prompt:
          "Build a browser extension that summarizes articles, saves highlights with tags, and " +
          "shows a reading history dashboard",
        family: "reading-app",
        difficulty: "medium",
        expectedScoreRange: [55, 85],
      },
      {
        id: "bookmark-organizer",
        prompt:
          "Build a browser extension that auto-categorizes bookmarks using page content analysis, " +
          "provides a tag-based search interface, and syncs across devices via local storage export/import",
        family: "reading-app",
        difficulty: "easy",
        expectedScoreRange: [60, 90],
      },
      {
        id: "research-clipper",
        prompt:
          "Build a browser extension that clips selected text with source URL, organizes clips " +
          "into projects, generates citation lists, and exports to markdown",
        family: "reading-app",
        difficulty: "hard",
        expectedScoreRange: [40, 75],
      },

      // --- automation family ---
      {
        id: "form-filler",
        prompt:
          "Build a browser extension that detects form fields on any page, auto-fills from saved " +
          "profiles, and supports multiple identity profiles with keyboard shortcuts",
        family: "automation",
        difficulty: "easy",
        expectedScoreRange: [65, 90],
      },
      {
        id: "site-automator",
        prompt:
          "Build a browser extension that records user actions on a page, replays them as automated " +
          "workflows, supports conditional logic, and provides a visual workflow editor",
        family: "automation",
        difficulty: "hard",
        expectedScoreRange: [35, 70],
      },
      {
        id: "notification-filter",
        prompt:
          "Build a browser extension that intercepts and filters page notifications, allows " +
          "custom rules per domain, batches notifications into a digest panel, and supports " +
          "do-not-disturb scheduling",
        family: "automation",
        difficulty: "medium",
        expectedScoreRange: [50, 80],
      },
    ],

    scoring: {
      dimensions: [
        { id: "functionality", weight: 0.30, threshold: 70 },
        { id: "productDepth", weight: 0.25, threshold: 60 },
        { id: "uxDesign", weight: 0.15, threshold: 50 },
        { id: "codeQuality", weight: 0.20, threshold: 65 },
        { id: "maintainability", weight: 0.10, threshold: 50 },
      ],
      totalPassThreshold: 65,
      requiredDimensions: ["functionality", "codeQuality"],
    },

    gates: {
      visiblePassThreshold: 65,
      blindDivergenceWarnThreshold: 8,
      blindDivergenceFailThreshold: 15,
      holdoutRequired: true,
      holdoutMinPassRate: 0.8,
    },

    runbook: {
      setup: [
        "git clone <repository-url> && cd Astra",
        "pnpm install",
        "npx playwright install chromium",
        "cp .env.example .env  # configure API keys if needed",
      ],
      executeCommand:
        "npx tsx bench-opt/proof-suite-entry.ts --runs 3 --sprints 5 --output-dir bench-opt-results/proof-suite",
      verifyCommand:
        "npx tsx bench-opt/external-benchmark-pack-entry.ts --validate bench-opt-results/proof-suite/latest.proof-suite.json",
      artifactDir: "bench-opt-results/proof-suite",
      reportPath: "bench-opt-results/proof-suite/latest.proof-suite.md",
    },

    artifactLayout: {
      root: "bench-opt-results/proof-suite",
      perRun: [
        "proof-suite-<timestamp>.json",
        "proof-suite-<timestamp>.md",
      ],
      perSuite: [
        "latest.proof-suite.json",
        "latest.proof-suite.md",
      ],
    },

    passConditions: {
      minSuccessRate: 0.8,
      maxScoreStdDev: 5.0,
      minAvgScore: 70,
      holdoutPassRate: 0.9,
    },
    requiredCapabilities: [],
  }

  return Object.freeze(pack)
}

export function createDraftCapabilityBenchmarkPackV2(): Readonly<BenchmarkPackConfig> {
  const base = createOfficialBenchmarkPack()
  const pack: BenchmarkPackConfig = {
    ...base,
    version: "2.0.0-draft",
    name: "astra-capability-conquest-benchmark-v2",
    description:
      "Draft capability benchmark pack for Astra v2. Extends the hardened proof pack with capability governance gates, " +
      "including privacy-mode as a required protocol-level capability.",
    runbook: {
      ...base.runbook,
      verifyCommand:
        "npx tsx bench-opt/external-benchmark-pack-entry.ts --pack v2 --validate bench-opt-results/proof-suite/latest.proof-suite.json --status bench-opt-results/latest.status.json",
      reportPath: "bench-opt-results/latest.status.md",
    },
    requiredCapabilities: [
      {
        id: "privacy-mode",
        minimumVerdict: "partial",
        requiredCoverage: {
          live: "green",
          holdout: "green",
          proof: "green",
        },
        reason:
          "Privacy regressions must fail the benchmark pack even before privacy-mode is globally conquered.",
      },
    ],
  }

  return Object.freeze(pack)
}

const CAPABILITY_VERDICT_RANK: Record<AstraCapabilityVerdict, number> = {
  "not-started": 0,
  partial: 1,
  "bench-pass": 2,
  "live-pass": 3,
  "holdout-pass": 4,
  conquered: 5,
}

const LANE_STATUS_RANK: Record<AstraCapabilityLaneStatus, number> = {
  missing: 0,
  partial: 1,
  green: 2,
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate whether a proof suite result satisfies the benchmark pack's pass
 * conditions. Returns a structured result with per-condition pass/fail.
 */
export function validateBenchmarkPackResults(
  pack: BenchmarkPackConfig,
  suiteResult: ProofSuiteResult,
  statusArtifact: BenchOptStatusArtifact | null = null,
): BenchmarkPackValidationResult {
  const conditions: BenchmarkPackValidationResult["conditions"] = []
  const notes: string[] = []

  // 1. Minimum success rate
  const successRate = suiteResult.statistics.successRate
  conditions.push({
    name: "Minimum success rate",
    expected: `>= ${(pack.passConditions.minSuccessRate * 100).toFixed(0)}%`,
    actual: `${(successRate * 100).toFixed(1)}%`,
    passed: successRate >= pack.passConditions.minSuccessRate,
  })

  // 2. Maximum score standard deviation
  const scoreStdDev = suiteResult.statistics.scoreStdDev
  conditions.push({
    name: "Maximum score std dev",
    expected: `<= ${pack.passConditions.maxScoreStdDev}`,
    actual: `${scoreStdDev}`,
    passed: scoreStdDev <= pack.passConditions.maxScoreStdDev,
  })

  // 3. Minimum average score
  const avgScore = suiteResult.statistics.averageFinalScore
  conditions.push({
    name: "Minimum average score",
    expected: `>= ${pack.passConditions.minAvgScore}`,
    actual: `${avgScore}`,
    passed: avgScore >= pack.passConditions.minAvgScore,
  })

  // 4. Holdout pass rate
  const holdoutTotal = suiteResult.statistics.holdoutPassCount + suiteResult.statistics.holdoutFailCount
  const holdoutPassRate = holdoutTotal > 0
    ? suiteResult.statistics.holdoutPassCount / holdoutTotal
    : 0
  const holdoutRan = holdoutTotal > 0

  if (pack.gates.holdoutRequired && !holdoutRan) {
    conditions.push({
      name: "Holdout pass rate",
      expected: `>= ${(pack.passConditions.holdoutPassRate * 100).toFixed(0)}% (holdout required)`,
      actual: "No holdout scenarios executed",
      passed: false,
    })
    notes.push("Holdout scenarios were not executed. This is required by the benchmark pack.")
  } else if (holdoutRan) {
    conditions.push({
      name: "Holdout pass rate",
      expected: `>= ${(pack.passConditions.holdoutPassRate * 100).toFixed(0)}%`,
      actual: `${(holdoutPassRate * 100).toFixed(1)}%`,
      passed: holdoutPassRate >= pack.passConditions.holdoutPassRate,
    })
  } else {
    conditions.push({
      name: "Holdout pass rate",
      expected: `>= ${(pack.passConditions.holdoutPassRate * 100).toFixed(0)}% (holdout not required)`,
      actual: "Not executed (skipped)",
      passed: true,
    })
    notes.push("Holdout scenarios were not executed but are not required by the pack.")
  }

  // 5. Blind divergence check
  const avgBlindDivergence = suiteResult.statistics.avgBlindDivergence
  if (suiteResult.statistics.hiddenGateRuns > 0) {
    const blindPassed = avgBlindDivergence <= pack.gates.blindDivergenceFailThreshold
    conditions.push({
      name: "Blind divergence within fail threshold",
      expected: `<= ${pack.gates.blindDivergenceFailThreshold}`,
      actual: `${avgBlindDivergence}`,
      passed: blindPassed,
    })
    if (avgBlindDivergence > pack.gates.blindDivergenceWarnThreshold) {
      notes.push(
        `Blind divergence (${avgBlindDivergence}) exceeds warn threshold (${pack.gates.blindDivergenceWarnThreshold}).`,
      )
    }
  } else {
    conditions.push({
      name: "Blind divergence within fail threshold",
      expected: `<= ${pack.gates.blindDivergenceFailThreshold}`,
      actual: "No blind evaluations executed",
      passed: false,
    })
    notes.push("Blind evaluations were not executed. Divergence check is required for benchmark-pack pass/fail.")
  }

  // 6. Visible pass threshold
  const visiblePassed = avgScore >= pack.gates.visiblePassThreshold
  conditions.push({
    name: "Visible gate threshold",
    expected: `>= ${pack.gates.visiblePassThreshold}`,
    actual: `${avgScore}`,
    passed: visiblePassed,
  })

  // 7. Required capability governance
  for (const requirement of pack.requiredCapabilities ?? []) {
    if (!statusArtifact?.capabilities) {
      conditions.push({
        name: `Capability gate: ${requirement.id}`,
        expected: `${requirement.minimumVerdict}+ with required coverage`,
        actual: "No status artifact/capability summary provided",
        passed: false,
      })
      notes.push(`Capability requirement ${requirement.id} could not be validated because no status artifact was provided.`)
      continue
    }

    const card = statusArtifact.capabilities.cards.find((entry) => entry.id === requirement.id)
    if (!card) {
      conditions.push({
        name: `Capability gate: ${requirement.id}`,
        expected: `${requirement.minimumVerdict}+ with required coverage`,
        actual: "Capability missing from status artifact",
        passed: false,
      })
      notes.push(`Capability requirement ${requirement.id} is missing from the status artifact.`)
      continue
    }

    const verdictPass = CAPABILITY_VERDICT_RANK[card.verdict] >= CAPABILITY_VERDICT_RANK[requirement.minimumVerdict]
    const coverageFailures = Object.entries(requirement.requiredCoverage ?? {}).filter(([lane, minStatus]) => {
      const actual = card.currentCoverage[lane as keyof typeof card.currentCoverage]
      return LANE_STATUS_RANK[actual] < LANE_STATUS_RANK[minStatus as AstraCapabilityLaneStatus]
    })
    const passed = verdictPass && coverageFailures.length === 0
    const actualCoverage = Object.entries(card.currentCoverage).map(([lane, status]) => `${lane}=${status}`).join(", ")

    conditions.push({
      name: `Capability gate: ${requirement.id}`,
      expected: `${requirement.minimumVerdict}+; ${Object.entries(requirement.requiredCoverage ?? {}).map(([lane, status]) => `${lane}=${status}`).join(", ") || "no lane minimums"}`,
      actual: `verdict=${card.verdict}; ${actualCoverage}`,
      passed,
    })

    if (!passed) {
      notes.push(`Capability requirement ${requirement.id} failed: ${requirement.reason}`)
    }
  }

  // Overall pass
  const allPassed = conditions.every((c) => c.passed)

  const passedCount = conditions.filter((c) => c.passed).length
  const totalConditions = conditions.length

  const summary = allPassed
    ? `PASS: All ${totalConditions} conditions met for ${pack.name} v${pack.version}.`
    : `FAIL: ${passedCount}/${totalConditions} conditions met for ${pack.name} v${pack.version}. ` +
      `Failed: ${conditions.filter((c) => !c.passed).map((c) => c.name).join(", ")}.`

  return {
    packName: pack.name,
    packVersion: pack.version,
    passed: allPassed,
    conditions,
    summary,
    notes,
  }
}

// ---------------------------------------------------------------------------
// Specification rendering
// ---------------------------------------------------------------------------

/**
 * Render the benchmark pack as a formal Markdown specification document.
 */
export function renderBenchmarkPackSpec(pack: BenchmarkPackConfig): string {
  const lines: string[] = []

  // Title
  lines.push(`# ${pack.name} v${pack.version}`)
  lines.push("")
  lines.push(pack.description)
  lines.push("")

  // Table of contents
  lines.push("## Table of Contents")
  lines.push("")
  lines.push("1. [Prompts](#prompts)")
  lines.push("2. [Scoring Rubric](#scoring-rubric)")
  lines.push("3. [Gate Thresholds](#gate-thresholds)")
  lines.push("4. [Pass Conditions](#pass-conditions)")
  lines.push("5. [Required Capabilities](#required-capabilities)")
  lines.push("6. [Runbook](#runbook)")
  lines.push("7. [Artifact Layout](#artifact-layout)")
  lines.push("")

  // Prompts
  lines.push("## Prompts")
  lines.push("")
  lines.push(`This benchmark uses ${pack.prompts.length} prompts across multiple families and difficulty levels.`)
  lines.push("")
  lines.push("| # | ID | Family | Difficulty | Expected Range |")
  lines.push("|--:|----|---------|-----------:|---------------:|")
  for (let i = 0; i < pack.prompts.length; i++) {
    const p = pack.prompts[i]
    lines.push(
      `| ${i + 1} | ${p.id} | ${p.family} | ${p.difficulty} | ${p.expectedScoreRange[0]}-${p.expectedScoreRange[1]} |`,
    )
  }
  lines.push("")

  // Full prompt text
  lines.push("### Prompt Details")
  lines.push("")
  for (const p of pack.prompts) {
    lines.push(`**${p.id}** (${p.family}, ${p.difficulty})`)
    lines.push("")
    lines.push(`> ${p.prompt}`)
    lines.push("")
  }

  // Scoring rubric
  lines.push("## Scoring Rubric")
  lines.push("")
  lines.push(`**Total pass threshold:** ${pack.scoring.totalPassThreshold}`)
  lines.push(`**Required dimensions:** ${pack.scoring.requiredDimensions.join(", ")}`)
  lines.push("")
  lines.push("| Dimension | Weight | Threshold |")
  lines.push("|-----------|-------:|----------:|")
  for (const dim of pack.scoring.dimensions) {
    lines.push(`| ${dim.id} | ${(dim.weight * 100).toFixed(0)}% | ${dim.threshold} |`)
  }
  lines.push("")
  lines.push("Weights must sum to 1.0. The weighted total is computed as:")
  lines.push("")
  lines.push("```")
  lines.push("weightedTotal = sum(dimension_score * dimension_weight) / sum(dimension_weight)")
  lines.push("```")
  lines.push("")

  // Gate thresholds
  lines.push("## Gate Thresholds")
  lines.push("")
  lines.push("| Gate | Threshold | Description |")
  lines.push("|------|----------:|-------------|")
  lines.push(`| Visible pass | ${pack.gates.visiblePassThreshold} | Minimum composite score for visible gate pass |`)
  lines.push(`| Blind divergence (warn) | ${pack.gates.blindDivergenceWarnThreshold} | Delta that triggers a warning |`)
  lines.push(`| Blind divergence (fail) | ${pack.gates.blindDivergenceFailThreshold} | Delta that triggers a failure |`)
  lines.push(`| Holdout required | ${pack.gates.holdoutRequired ? "Yes" : "No"} | Whether holdout scenarios must be executed |`)
  lines.push(`| Holdout min pass rate | ${(pack.gates.holdoutMinPassRate * 100).toFixed(0)}% | Minimum holdout scenario pass rate |`)
  lines.push("")

  // Pass conditions
  lines.push("## Pass Conditions")
  lines.push("")
  lines.push("All of the following conditions must be met for the benchmark to pass:")
  lines.push("")
  lines.push(`1. **Minimum success rate:** ${(pack.passConditions.minSuccessRate * 100).toFixed(0)}% of runs must pass`)
  lines.push(`2. **Maximum score std dev:** ${pack.passConditions.maxScoreStdDev} (scores must be stable)`)
  lines.push(`3. **Minimum average score:** ${pack.passConditions.minAvgScore}`)
  lines.push(`4. **Holdout pass rate:** ${(pack.passConditions.holdoutPassRate * 100).toFixed(0)}%`)
  lines.push("")

  // Required capabilities
  lines.push("## Required Capabilities")
  lines.push("")
  if (!pack.requiredCapabilities || pack.requiredCapabilities.length === 0) {
    lines.push("No additional capability governance requirements are enforced by this benchmark pack.")
    lines.push("")
  } else {
    lines.push("| Capability | Minimum verdict | Required coverage | Reason |")
    lines.push("|------------|-----------------|-------------------|--------|")
    for (const requirement of pack.requiredCapabilities) {
      const coverage = Object.entries(requirement.requiredCoverage ?? {}).map(([lane, status]) => `${lane}=${status}`).join(", ") || "none"
      lines.push(`| ${requirement.id} | ${requirement.minimumVerdict} | ${coverage} | ${requirement.reason} |`)
    }
    lines.push("")
  }

  // Runbook
  lines.push("## Runbook")
  lines.push("")
  lines.push("### Setup")
  lines.push("")
  for (let i = 0; i < pack.runbook.setup.length; i++) {
    lines.push(`${i + 1}. \`${pack.runbook.setup[i]}\``)
  }
  lines.push("")
  lines.push("### Execute")
  lines.push("")
  lines.push("```bash")
  lines.push(pack.runbook.executeCommand)
  lines.push("```")
  lines.push("")
  lines.push("### Verify")
  lines.push("")
  lines.push("```bash")
  lines.push(pack.runbook.verifyCommand)
  lines.push("```")
  lines.push("")
  lines.push(`**Artifact directory:** \`${pack.runbook.artifactDir}\``)
  lines.push(`**Report path:** \`${pack.runbook.reportPath}\``)
  lines.push("")

  // Artifact layout
  lines.push("## Artifact Layout")
  lines.push("")
  lines.push(`**Root:** \`${pack.artifactLayout.root}\``)
  lines.push("")
  lines.push("### Per-Run Artifacts")
  lines.push("")
  for (const artifact of pack.artifactLayout.perRun) {
    lines.push(`- \`${artifact}\``)
  }
  lines.push("")
  lines.push("### Per-Suite Artifacts")
  lines.push("")
  for (const artifact of pack.artifactLayout.perSuite) {
    lines.push(`- \`${artifact}\``)
  }
  lines.push("")

  // Footer
  lines.push("---")
  lines.push("")
  lines.push(`*This specification is frozen at version ${pack.version}. Any changes require a new version.*`)
  lines.push("")

  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Write the benchmark pack as both JSON and Markdown spec to the given
 * output directory.
 *
 * Creates:
 * - `<outputPath>/benchmark-pack.json` - The frozen pack config as JSON
 * - `<outputPath>/benchmark-pack-spec.md` - The formal specification document
 *
 * @returns Paths to the written files.
 */
export async function exportBenchmarkPack(
  pack: BenchmarkPackConfig,
  outputPath: string,
): Promise<{ jsonPath: string; markdownPath: string }> {
  const { mkdir, writeFile } = await import("node:fs/promises")
  const path = await import("node:path")

  await mkdir(outputPath, { recursive: true })

  const jsonPath = path.join(outputPath, "benchmark-pack.json")
  const markdownPath = path.join(outputPath, "benchmark-pack-spec.md")

  const jsonContent = JSON.stringify(pack, null, 2)
  const markdownContent = renderBenchmarkPackSpec(pack)

  await Promise.all([
    writeFile(jsonPath, jsonContent),
    writeFile(markdownPath, markdownContent),
  ])

  return { jsonPath, markdownPath }
}
