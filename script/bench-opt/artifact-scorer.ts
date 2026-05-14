import { execSync } from "node:child_process"
import { readdirSync, statSync } from "node:fs"
import { join, resolve } from "node:path"

import type { CompositeScoringConfig } from "./composite-scorer.ts"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ArtifactEvidence {
  // Build/test evidence
  typeCheckPassed?: boolean
  testsPassed?: number
  testsFailed?: number
  testsTotal?: number
  benchScore?: number
  benchPassRate?: number // 0-1

  // Live evidence
  liveResults?: Array<{ scenarioId: string; pass: boolean; score: number }>
  livePassRate?: number

  // Code evidence
  filesChanged?: number
  linesAdded?: number
  linesRemoved?: number

  // Artifact evidence
  screenshotCount?: number
  domSnapshotCount?: number
  artifactCount?: number

  // Sprint context
  sprintIndex: number
  totalSprints: number
  previousSprintScore?: number
}

export interface ArtifactDimensionScore {
  dimensionId: string
  score: number // 0-100
  sources: string[] // provenance: which evidence contributed
  confidence: number // 0-1: how much evidence was available
  reasoning: string // human-readable explanation
}

export interface ArtifactScoringResult {
  dimensions: ArtifactDimensionScore[]
  weightedTotal: number
  overallConfidence: number // average confidence
  provenanceSummary: string[]
  deterministicWarning: boolean // true if scores look suspiciously template-like
}

// ---------------------------------------------------------------------------
// Dimension scorers
// ---------------------------------------------------------------------------

function scoreFunctionality(ev: ArtifactEvidence): ArtifactDimensionScore {
  let score = 0
  const sources: string[] = []
  const parts: string[] = []
  let evidenceCount = 0
  const maxEvidenceCount = 4

  // benchScore contribution (0-40 pts): benchScore * 0.4
  if (ev.benchScore != null) {
    const contrib = Math.min(40, ev.benchScore * 0.4)
    score += contrib
    sources.push("bench")
    parts.push(`bench=${ev.benchScore} -> ${contrib.toFixed(1)}pts`)
    evidenceCount++
  }

  // livePassRate contribution (0-30 pts): livePassRate * 30
  if (ev.livePassRate != null) {
    const contrib = Math.min(30, ev.livePassRate * 30)
    score += contrib
    sources.push("live")
    parts.push(`livePassRate=${(ev.livePassRate * 100).toFixed(0)}% -> ${contrib.toFixed(1)}pts`)
    evidenceCount++
  }

  // testPassRate contribution (0-20 pts): (passed/total) * 20
  if (ev.testsPassed != null && ev.testsTotal != null && ev.testsTotal > 0) {
    const passRate = ev.testsPassed / ev.testsTotal
    const contrib = Math.min(20, passRate * 20)
    score += contrib
    sources.push("tests")
    parts.push(`tests=${ev.testsPassed}/${ev.testsTotal} -> ${contrib.toFixed(1)}pts`)
    evidenceCount++
  }

  // typeCheck contribution (0-10 pts): 10 if passed
  if (ev.typeCheckPassed != null) {
    const contrib = ev.typeCheckPassed ? 10 : 0
    score += contrib
    sources.push("type-check")
    parts.push(`typeCheck=${ev.typeCheckPassed ? "pass" : "fail"} -> ${contrib}pts`)
    evidenceCount++
  }

  const confidence = evidenceCount / maxEvidenceCount
  const reasoning =
    parts.length > 0
      ? `Functionality: ${parts.join("; ")}`
      : "Functionality: no evidence available"

  return {
    dimensionId: "functionality",
    score: clamp(Math.round(score)),
    sources,
    confidence,
    reasoning,
  }
}

function scoreProductDepth(ev: ArtifactEvidence): ArtifactDimensionScore {
  let score = 0
  const sources: string[] = []
  const parts: string[] = []
  let evidenceCount = 0
  const maxEvidenceCount = 4

  // filesChanged contribution (0-25 pts): min(filesChanged * 2.5, 25)
  if (ev.filesChanged != null) {
    const contrib = Math.min(25, ev.filesChanged * 2.5)
    score += contrib
    sources.push("code-diff")
    parts.push(`files=${ev.filesChanged} -> ${contrib.toFixed(1)}pts`)
    evidenceCount++
  }

  // linesAdded contribution (0-25 pts): min(linesAdded * 0.1, 25)
  if (ev.linesAdded != null) {
    const contrib = Math.min(25, ev.linesAdded * 0.1)
    score += contrib
    if (!sources.includes("code-diff")) sources.push("code-diff")
    parts.push(`+lines=${ev.linesAdded} -> ${contrib.toFixed(1)}pts`)
    evidenceCount++
  }

  // artifactCount contribution (0-25 pts): min(artifactCount * 5, 25)
  if (ev.artifactCount != null) {
    const contrib = Math.min(25, ev.artifactCount * 5)
    score += contrib
    sources.push("artifacts")
    parts.push(`artifacts=${ev.artifactCount} -> ${contrib.toFixed(1)}pts`)
    evidenceCount++
  }

  // testCount contribution (0-25 pts): min(testsTotal * 2.5, 25)
  if (ev.testsTotal != null) {
    const contrib = Math.min(25, ev.testsTotal * 2.5)
    score += contrib
    sources.push("test-count")
    parts.push(`totalTests=${ev.testsTotal} -> ${contrib.toFixed(1)}pts`)
    evidenceCount++
  }

  const confidence = evidenceCount / maxEvidenceCount
  const reasoning =
    parts.length > 0
      ? `Product depth: ${parts.join("; ")}`
      : "Product depth: no evidence available"

  return {
    dimensionId: "productDepth",
    score: clamp(Math.round(score)),
    sources,
    confidence,
    reasoning,
  }
}

function scoreUxDesign(ev: ArtifactEvidence): ArtifactDimensionScore {
  let score = 0
  const sources: string[] = []
  const parts: string[] = []
  let evidenceCount = 0
  const maxEvidenceCount = 4

  // livePassRate contribution (0-40 pts): livePassRate * 40
  if (ev.livePassRate != null) {
    const contrib = Math.min(40, ev.livePassRate * 40)
    score += contrib
    sources.push("live-scenarios")
    parts.push(`livePassRate=${(ev.livePassRate * 100).toFixed(0)}% -> ${contrib.toFixed(1)}pts`)
    evidenceCount++
  }

  // screenshotCount contribution (0-20 pts): min(screenshotCount * 5, 20)
  if (ev.screenshotCount != null) {
    const contrib = Math.min(20, ev.screenshotCount * 5)
    score += contrib
    sources.push("screenshots")
    parts.push(`screenshots=${ev.screenshotCount} -> ${contrib.toFixed(1)}pts`)
    evidenceCount++
  }

  // domSnapshotCount contribution (0-20 pts): min(domSnapshotCount * 5, 20)
  if (ev.domSnapshotCount != null) {
    const contrib = Math.min(20, ev.domSnapshotCount * 5)
    score += contrib
    sources.push("dom-snapshots")
    parts.push(`domSnapshots=${ev.domSnapshotCount} -> ${contrib.toFixed(1)}pts`)
    evidenceCount++
  }

  // sprintProgress contribution (0-20 pts): (sprintIndex / totalSprints) * 20
  if (ev.totalSprints > 0) {
    const contrib = (ev.sprintIndex / ev.totalSprints) * 20
    score += contrib
    sources.push("sprint-progress")
    parts.push(`sprint=${ev.sprintIndex + 1}/${ev.totalSprints} -> ${contrib.toFixed(1)}pts`)
    evidenceCount++
  }

  const confidence = evidenceCount / maxEvidenceCount
  const reasoning =
    parts.length > 0
      ? `UX design: ${parts.join("; ")}`
      : "UX design: no evidence available"

  return {
    dimensionId: "uxDesign",
    score: clamp(Math.round(score)),
    sources,
    confidence,
    reasoning,
  }
}

function scoreCodeQuality(ev: ArtifactEvidence): ArtifactDimensionScore {
  let score = 0
  const sources: string[] = []
  const parts: string[] = []
  let evidenceCount = 0
  const maxEvidenceCount = 4

  // typeCheckPassed contribution (0-30 pts): 30 if passed
  if (ev.typeCheckPassed != null) {
    const contrib = ev.typeCheckPassed ? 30 : 0
    score += contrib
    sources.push("type-check")
    parts.push(`typeCheck=${ev.typeCheckPassed ? "pass" : "fail"} -> ${contrib}pts`)
    evidenceCount++
  }

  // testPassRate contribution (0-30 pts): (passed/total) * 30
  if (ev.testsPassed != null && ev.testsTotal != null && ev.testsTotal > 0) {
    const passRate = ev.testsPassed / ev.testsTotal
    const contrib = Math.min(30, passRate * 30)
    score += contrib
    sources.push("tests")
    parts.push(`tests=${ev.testsPassed}/${ev.testsTotal} -> ${contrib.toFixed(1)}pts`)
    evidenceCount++
  }

  // benchPassRate contribution (0-20 pts): benchPassRate * 20
  if (ev.benchPassRate != null) {
    const contrib = Math.min(20, ev.benchPassRate * 20)
    score += contrib
    sources.push("bench")
    parts.push(`benchPassRate=${(ev.benchPassRate * 100).toFixed(0)}% -> ${contrib.toFixed(1)}pts`)
    evidenceCount++
  }

  // noTestFailures bonus (0-20 pts): 20 if testsFailed === 0
  if (ev.testsFailed != null) {
    const contrib = ev.testsFailed === 0 ? 20 : 0
    score += contrib
    if (!sources.includes("tests")) sources.push("tests")
    parts.push(`noFailures=${ev.testsFailed === 0 ? "yes" : "no"} -> ${contrib}pts`)
    evidenceCount++
  }

  const confidence = evidenceCount / maxEvidenceCount
  const reasoning =
    parts.length > 0
      ? `Code quality: ${parts.join("; ")}`
      : "Code quality: no evidence available"

  return {
    dimensionId: "codeQuality",
    score: clamp(Math.round(score)),
    sources,
    confidence,
    reasoning,
  }
}

function scoreMaintainability(ev: ArtifactEvidence): ArtifactDimensionScore {
  let score = 0
  const sources: string[] = []
  const parts: string[] = []
  let evidenceCount = 0
  const maxEvidenceCount = 4

  // diffEfficiency (0-30 pts): max(0, 30 - linesAdded * 0.05)
  if (ev.linesAdded != null) {
    const contrib = Math.max(0, 30 - ev.linesAdded * 0.05)
    score += contrib
    sources.push("diff-efficiency")
    parts.push(`diffEfficiency: +${ev.linesAdded} lines -> ${contrib.toFixed(1)}pts`)
    evidenceCount++
  }

  // testPresence (0-30 pts): min(testsTotal * 3, 30)
  if (ev.testsTotal != null) {
    const contrib = Math.min(30, ev.testsTotal * 3)
    score += contrib
    sources.push("test-presence")
    parts.push(`testPresence=${ev.testsTotal} tests -> ${contrib.toFixed(1)}pts`)
    evidenceCount++
  }

  // typeCheckHealth (0-20 pts): 20 if typeCheckPassed
  if (ev.typeCheckPassed != null) {
    const contrib = ev.typeCheckPassed ? 20 : 0
    score += contrib
    sources.push("type-check")
    parts.push(`typeCheckHealth=${ev.typeCheckPassed ? "pass" : "fail"} -> ${contrib}pts`)
    evidenceCount++
  }

  // buildHealth (0-20 pts): 20 if benchPassRate > 0.9
  if (ev.benchPassRate != null) {
    const contrib = ev.benchPassRate > 0.9 ? 20 : 0
    score += contrib
    sources.push("build-health")
    parts.push(`buildHealth=${ev.benchPassRate > 0.9 ? "healthy" : "unhealthy"} -> ${contrib}pts`)
    evidenceCount++
  }

  const confidence = evidenceCount / maxEvidenceCount
  const reasoning =
    parts.length > 0
      ? `Maintainability: ${parts.join("; ")}`
      : "Maintainability: no evidence available"

  return {
    dimensionId: "maintainability",
    score: clamp(Math.round(score)),
    sources,
    confidence,
    reasoning,
  }
}

// ---------------------------------------------------------------------------
// Main scorer
// ---------------------------------------------------------------------------

/**
 * Compute dimension scores from REAL artifact evidence, not templates.
 *
 * Each dimension derives its score from concrete build/test/live/code signals.
 * The result includes per-dimension provenance (which evidence contributed),
 * confidence (how much evidence was available), and reasoning.
 *
 * Usable as a drop-in replacement for template scoring in long-run.ts:
 * instead of reading `SPRINT_DIMENSION_PROFILES[sprintIndex]`, call
 * `scoreFromArtifacts(evidence, config)` and use the resulting
 * `weightedTotal` and per-dimension scores.
 */
export function scoreFromArtifacts(
  evidence: ArtifactEvidence,
  config: CompositeScoringConfig,
): ArtifactScoringResult {
  const dimensionScorers: Record<string, (ev: ArtifactEvidence) => ArtifactDimensionScore> = {
    functionality: scoreFunctionality,
    productDepth: scoreProductDepth,
    uxDesign: scoreUxDesign,
    codeQuality: scoreCodeQuality,
    maintainability: scoreMaintainability,
  }

  const dimensions: ArtifactDimensionScore[] = []
  const provenanceSummary: string[] = []

  for (const dimConfig of config.dimensions) {
    const scorer = dimensionScorers[dimConfig.id]
    if (scorer) {
      const result = scorer(evidence)
      dimensions.push(result)
      if (result.sources.length > 0) {
        provenanceSummary.push(`${dimConfig.id}: [${result.sources.join(", ")}]`)
      }
    } else {
      // Unknown dimension -- score 0 with no confidence
      dimensions.push({
        dimensionId: dimConfig.id,
        score: 0,
        sources: [],
        confidence: 0,
        reasoning: `Unknown dimension "${dimConfig.id}" -- no scorer available`,
      })
    }
  }

  // Compute weighted total using config weights
  const totalWeight = config.dimensions.reduce((sum, d) => sum + d.weight, 0)
  let weightedTotal = 0
  if (totalWeight > 0) {
    for (const dimConfig of config.dimensions) {
      const dimScore = dimensions.find((d) => d.dimensionId === dimConfig.id)
      if (dimScore) {
        weightedTotal += dimScore.score * (dimConfig.weight / totalWeight)
      }
    }
  }
  weightedTotal = Math.round(weightedTotal * 100) / 100

  // Compute overall confidence
  const overallConfidence =
    dimensions.length > 0
      ? Math.round(
          (dimensions.reduce((sum, d) => sum + d.confidence, 0) / dimensions.length) * 100,
        ) / 100
      : 0

  return {
    dimensions,
    weightedTotal,
    overallConfidence,
    provenanceSummary,
    deterministicWarning: false, // computed externally via checkDeterministicWarning
  }
}

// ---------------------------------------------------------------------------
// Evidence confidence
// ---------------------------------------------------------------------------

/**
 * Returns 0-1 based on how many evidence fields in the
 * {@link ArtifactEvidence} are populated.
 *
 * A score of 1.0 means every evidence field has a value; 0.0 means the
 * evidence struct is effectively empty (only sprintIndex/totalSprints are
 * always present so they are excluded from the count).
 */
export function computeEvidenceConfidence(evidence: ArtifactEvidence): number {
  const fields: boolean[] = [
    evidence.typeCheckPassed != null,
    evidence.testsPassed != null,
    evidence.testsFailed != null,
    evidence.testsTotal != null,
    evidence.benchScore != null,
    evidence.benchPassRate != null,
    evidence.liveResults != null && evidence.liveResults.length > 0,
    evidence.livePassRate != null,
    evidence.filesChanged != null,
    evidence.linesAdded != null,
    evidence.linesRemoved != null,
    evidence.screenshotCount != null,
    evidence.domSnapshotCount != null,
    evidence.artifactCount != null,
    evidence.previousSprintScore != null,
  ]

  const populated = fields.filter(Boolean).length
  return Math.round((populated / fields.length) * 100) / 100
}

// ---------------------------------------------------------------------------
// Deterministic warning
// ---------------------------------------------------------------------------

/**
 * Returns true if more than 3 results have identical `weightedTotal` scores,
 * which signals that the scorer may be returning template-like (hardcoded)
 * values rather than deriving scores from real evidence.
 */
export function checkDeterministicWarning(results: ArtifactScoringResult[]): boolean {
  if (results.length <= 3) return false

  const scoreCounts = new Map<number, number>()
  for (const r of results) {
    // Round to 2 decimal places to catch near-identical scores
    const key = Math.round(r.weightedTotal * 100) / 100
    scoreCounts.set(key, (scoreCounts.get(key) ?? 0) + 1)
  }

  for (const count of scoreCounts.values()) {
    if (count > 3) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Real evidence collection
// ---------------------------------------------------------------------------

/**
 * Actually runs `tsc`, `pnpm test`, and `pnpm bench` and collects real
 * evidence from the current project state. This is the KEY function that
 * makes scores real rather than template-derived.
 *
 * Each tool invocation is wrapped in a try/catch so a single failure does
 * not prevent the rest of the evidence from being collected.
 *
 * @param sprintIndex  - 0-based index of the current sprint
 * @param totalSprints - total number of sprints in the run
 * @returns Populated {@link ArtifactEvidence} with as many fields filled as
 *          the environment allows.
 */
export function collectCurrentArtifactEvidence(
  sprintIndex: number,
  totalSprints: number,
): ArtifactEvidence {
  const evidence: ArtifactEvidence = {
    sprintIndex,
    totalSprints,
  }

  // --- 1. Type-check via `npx tsc --noEmit` ---
  try {
    execSync("npx tsc --noEmit", {
      cwd: projectRoot(),
      timeout: 120_000,
      stdio: "pipe",
    })
    evidence.typeCheckPassed = true
  } catch {
    evidence.typeCheckPassed = false
  }

  // --- 2. Test results via `pnpm test` ---
  try {
    const testOutput = execSync("pnpm test 2>&1 || true", {
      cwd: projectRoot(),
      timeout: 120_000,
      stdio: "pipe",
      shell: "/bin/sh",
    }).toString()

    const testCounts = parseTestOutput(testOutput)
    evidence.testsPassed = testCounts.passed
    evidence.testsFailed = testCounts.failed
    evidence.testsTotal = testCounts.total
  } catch {
    // Tests could not run at all -- leave fields undefined
  }

  // --- 3. Bench results via `pnpm bench` ---
  try {
    const benchOutput = execSync("pnpm bench 2>&1 || true", {
      cwd: projectRoot(),
      timeout: 180_000,
      stdio: "pipe",
      shell: "/bin/sh",
    }).toString()

    const benchResult = parseBenchOutput(benchOutput)
    evidence.benchScore = benchResult.score
    evidence.benchPassRate = benchResult.passRate
  } catch {
    // Bench could not run -- leave fields undefined
  }

  // --- 4. Count artifacts in data/bench-live-results ---
  try {
    const resultsDir = resolve(process.env.ASTRA_BENCH_LIVE_ARTIFACT_ROOT ?? resolve(projectRoot(), "data/bench-live-results"))
    const counts = countArtifactsInDirectory(resultsDir)
    evidence.screenshotCount = counts.screenshots
    evidence.domSnapshotCount = counts.domSnapshots
    evidence.artifactCount = counts.total
  } catch {
    // Directory may not exist
  }

  // --- 5. Git diff stats ---
  try {
    const diffOutput = execSync("git diff --stat HEAD~1 2>/dev/null || git diff --stat", {
      cwd: projectRoot(),
      timeout: 10_000,
      stdio: "pipe",
      shell: "/bin/sh",
    }).toString()

    const diffStats = parseDiffStat(diffOutput)
    evidence.filesChanged = diffStats.filesChanged
    evidence.linesAdded = diffStats.linesAdded
    evidence.linesRemoved = diffStats.linesRemoved
  } catch {
    // Git may not be available or no commits yet
  }

  // --- 6. Live results from data/bench-live-results ---
  try {
    const resultsDir = resolve(process.env.ASTRA_BENCH_LIVE_ARTIFACT_ROOT ?? resolve(projectRoot(), "data/bench-live-results"))
    const liveResults = collectLiveResults(resultsDir)
    if (liveResults.length > 0) {
      evidence.liveResults = liveResults
      const passCount = liveResults.filter((r) => r.pass).length
      evidence.livePassRate = passCount / liveResults.length
    }
  } catch {
    // Directory may not exist or no results
  }

  return evidence
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function clamp(score: number): number {
  return Math.max(0, Math.min(100, score))
}

function projectRoot(): string {
  return resolve(import.meta.dirname ?? process.cwd(), "../..")
}

/**
 * Parse Vitest / Jest-style test output for pass/fail/total counts.
 *
 * Handles formats like:
 * - "Tests  42 passed (42)"
 * - "Tests  10 passed | 2 failed (12)"
 * - "Test Suites: 5 passed, 0 failed, 5 total"
 * - "42 passing" / "2 failing"
 */
export function parseTestOutput(output: string): {
  passed: number
  failed: number
  total: number
} {
  let passed = 0
  let failed = 0
  let total = 0

  // Vitest format: "Tests  N passed | M failed (T)"
  // Also matches: "Tests  N passed (N)"
  const vitestMatch = output.match(
    /Tests\s+(\d+)\s+passed(?:\s*\|\s*(\d+)\s+failed)?\s*\((\d+)\)/i,
  )
  if (vitestMatch) {
    passed = parseInt(vitestMatch[1], 10)
    failed = vitestMatch[2] ? parseInt(vitestMatch[2], 10) : 0
    total = parseInt(vitestMatch[3], 10)
    return { passed, failed, total }
  }

  // Jest format: "Tests: N passed, M failed, T total"
  const jestMatch = output.match(
    /Tests?:\s*(\d+)\s+passed(?:\s*,\s*(\d+)\s+failed)?(?:\s*,\s*(\d+)\s+total)?/i,
  )
  if (jestMatch) {
    passed = parseInt(jestMatch[1], 10)
    failed = jestMatch[2] ? parseInt(jestMatch[2], 10) : 0
    total = jestMatch[3] ? parseInt(jestMatch[3], 10) : passed + failed
    return { passed, failed, total }
  }

  // Mocha-style: "N passing" / "N failing"
  const passingMatch = output.match(/(\d+)\s+passing/i)
  const failingMatch = output.match(/(\d+)\s+failing/i)
  if (passingMatch || failingMatch) {
    passed = passingMatch ? parseInt(passingMatch[1], 10) : 0
    failed = failingMatch ? parseInt(failingMatch[1], 10) : 0
    total = passed + failed
    return { passed, failed, total }
  }

  return { passed, failed, total }
}

/**
 * Parse bench output for a composite score and pass rate.
 *
 * Handles the project's bench format, looking for lines like:
 * - "score: 85" or "Score: 85"
 * - "pass rate: 0.9" or "passRate: 90%"
 * - "N/M passed"
 */
export function parseBenchOutput(output: string): {
  score: number
  passRate: number
} {
  let score = 0
  let passRate = 0

  // Look for score line
  const scoreMatch = output.match(/(?:score|Score):\s*(\d+(?:\.\d+)?)/i)
  if (scoreMatch) {
    score = parseFloat(scoreMatch[1])
  }

  // Look for pass rate
  const passRateMatch = output.match(
    /(?:pass\s*rate|passRate):\s*(\d+(?:\.\d+)?)\s*%?/i,
  )
  if (passRateMatch) {
    let raw = parseFloat(passRateMatch[1])
    // Normalize: if > 1, assume it's a percentage
    if (raw > 1) raw = raw / 100
    passRate = raw
  }

  // Fallback: look for "N/M passed"
  if (passRate === 0) {
    const fracMatch = output.match(/(\d+)\s*\/\s*(\d+)\s+passed/i)
    if (fracMatch) {
      const num = parseInt(fracMatch[1], 10)
      const den = parseInt(fracMatch[2], 10)
      if (den > 0) passRate = num / den
    }
  }

  return { score, passRate }
}

/**
 * Parse `git diff --stat` summary line for file/line counts.
 *
 * Example summary line:
 *   " 5 files changed, 120 insertions(+), 30 deletions(-)"
 */
export function parseDiffStat(output: string): {
  filesChanged: number
  linesAdded: number
  linesRemoved: number
} {
  let filesChanged = 0
  let linesAdded = 0
  let linesRemoved = 0

  const filesMatch = output.match(/(\d+)\s+files?\s+changed/i)
  if (filesMatch) filesChanged = parseInt(filesMatch[1], 10)

  const insertMatch = output.match(/(\d+)\s+insertions?\(\+\)/i)
  if (insertMatch) linesAdded = parseInt(insertMatch[1], 10)

  const deleteMatch = output.match(/(\d+)\s+deletions?\(-\)/i)
  if (deleteMatch) linesRemoved = parseInt(deleteMatch[1], 10)

  return { filesChanged, linesAdded, linesRemoved }
}

/**
 * Count screenshots (.png), DOM snapshots (.html), and total artifacts
 * inside a results directory (recursively).
 */
function countArtifactsInDirectory(dir: string): {
  screenshots: number
  domSnapshots: number
  total: number
} {
  let screenshots = 0
  let domSnapshots = 0
  let total = 0

  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return { screenshots: 0, domSnapshots: 0, total: 0 }
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    let stat
    try {
      stat = statSync(fullPath)
    } catch {
      continue
    }

    if (stat.isDirectory()) {
      const sub = countArtifactsInDirectory(fullPath)
      screenshots += sub.screenshots
      domSnapshots += sub.domSnapshots
      total += sub.total
    } else if (stat.isFile()) {
      total++
      if (entry.endsWith(".png") || entry.endsWith(".jpg") || entry.endsWith(".jpeg")) {
        screenshots++
      } else if (entry.endsWith(".html")) {
        domSnapshots++
      }
    }
  }

  return { screenshots, domSnapshots, total }
}

/**
 * Collect live scenario results from result.json files inside the
 * data/bench-live-results directory.
 */
function collectLiveResults(
  dir: string,
): Array<{ scenarioId: string; pass: boolean; score: number }> {
  const results: Array<{ scenarioId: string; pass: boolean; score: number }> = []

  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return results
  }

  for (const entry of entries) {
    const subDir = join(dir, entry)
    let stat
    try {
      stat = statSync(subDir)
    } catch {
      continue
    }
    if (!stat.isDirectory()) continue

    const resultPath = join(subDir, "result.json")
    try {
      // Use require-style read since we need sync
      const raw = execSync(`cat "${resultPath}"`, { stdio: "pipe" }).toString()
      const parsed = JSON.parse(raw) as {
        scenarioId?: string
        pass?: boolean
        score?: number
      }
      if (parsed.scenarioId != null) {
        results.push({
          scenarioId: parsed.scenarioId,
          pass: parsed.pass ?? false,
          score: parsed.score ?? 0,
        })
      }
    } catch {
      // result.json may not exist or may be malformed
    }
  }

  return results
}
