import {
  computeCompositeScore,
  createDefaultScoringConfig,
  deriveVerdictFromComposite,
  renderCompositeScoreMarkdown,
  scoreDimension,
  type CompositeScore,
  type CompositeScoringConfig,
  type DimensionScore,
} from "./composite-scorer.ts"
import type { BenchOptIterationVerdict } from "./strategy.ts"
import type { BenchOptEvaluatorArtifact } from "./evaluator.ts"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Observable evidence that the blind evaluator receives.
 *
 * This intentionally excludes planner/generator self-descriptions so the
 * evaluation is grounded only in verifiable artifacts.
 */
export interface BlindObservableEvidence {
  buildResult?: { passed: boolean; errors: string[] }
  testResult?: { passed: number; failed: number; total: number }
  liveResults?: Array<{ scenarioId: string; pass: boolean; score: number }>
  screenshotPaths?: string[]
  domSnapshotPaths?: string[]
  codeDiffSummary?: { filesChanged: number; linesAdded: number; linesRemoved: number }
  benchScore?: number
}

export interface BlindEvaluatorInput {
  runId: string
  sprintIndex: number
  /** ONLY observable evidence --- no planner/generator self-descriptions. */
  observableEvidence: BlindObservableEvidence
  scoringConfig: CompositeScoringConfig
}

export interface BlindEvaluatorResult {
  schemaVersion: 1
  runId: string
  sprintIndex: number
  mode: "blind"
  compositeScore: CompositeScore
  dimensionScores: DimensionScore[]
  verdict: BenchOptIterationVerdict
  confidence: "high" | "medium" | "low"
  /** 0-1, what percentage of dimensions had real evidence. */
  evidenceCoverage: number
  notes: string[]
}

export interface BlindVsSelfDivergence {
  dimensionId: string
  label: string
  blindScore: number
  selfScore: number
  delta: number
  suspicious: boolean
}

export interface BlindVsSelfComparison {
  blindComposite: number
  selfComposite: number
  compositeDelta: number
  compositeSuspicious: boolean
  divergences: BlindVsSelfDivergence[]
  suspiciousCount: number
  notes: string[]
}

// ---------------------------------------------------------------------------
// Score derivation from observable evidence
// ---------------------------------------------------------------------------

/**
 * Derive a raw 0-100 **functionality** score from observable evidence.
 *
 * Signals: build pass, test pass rate, live scenario pass rate, bench score.
 */
function scoreFunctionality(ev: BlindObservableEvidence): { score: number; evidence: string[]; critique: string[] } {
  const evidence: string[] = []
  const critique: string[] = []
  let total = 0
  let weight = 0

  if (ev.buildResult != null) {
    const buildScore = ev.buildResult.passed ? 100 : 0
    total += buildScore * 3
    weight += 3
    evidence.push(`Build ${ev.buildResult.passed ? "passed" : "FAILED"}`)
    if (!ev.buildResult.passed && ev.buildResult.errors.length > 0) {
      critique.push(`Build errors: ${ev.buildResult.errors.slice(0, 3).join("; ")}`)
    }
  }

  if (ev.testResult != null && ev.testResult.total > 0) {
    const passRate = ev.testResult.passed / ev.testResult.total
    const testScore = Math.round(passRate * 100)
    total += testScore * 2
    weight += 2
    evidence.push(`Tests: ${ev.testResult.passed}/${ev.testResult.total} passed (${Math.round(passRate * 100)}%)`)
    if (ev.testResult.failed > 0) {
      critique.push(`${ev.testResult.failed} test(s) failing`)
    }
  }

  if (ev.liveResults != null && ev.liveResults.length > 0) {
    const livePassRate = ev.liveResults.filter((r) => r.pass).length / ev.liveResults.length
    const avgLiveScore = ev.liveResults.reduce((s, r) => s + r.score, 0) / ev.liveResults.length
    const liveScore = Math.round((livePassRate * 50) + (avgLiveScore * 0.5))
    total += liveScore * 2
    weight += 2
    evidence.push(`Live scenarios: ${ev.liveResults.filter((r) => r.pass).length}/${ev.liveResults.length} passed, avg score ${Math.round(avgLiveScore)}`)
  }

  if (ev.benchScore != null) {
    total += ev.benchScore * 1
    weight += 1
    evidence.push(`Bench score: ${ev.benchScore}`)
  }

  const score = weight > 0 ? Math.round(total / weight) : 0
  if (weight === 0) {
    critique.push("No functionality evidence available")
  }
  return { score, evidence, critique }
}

/**
 * Derive a raw 0-100 **productDepth** score from observable evidence.
 *
 * Signals: files changed, lines added, test count.
 */
function scoreProductDepth(ev: BlindObservableEvidence): { score: number; evidence: string[]; critique: string[] } {
  const evidence: string[] = []
  const critique: string[] = []
  let total = 0
  let weight = 0

  if (ev.codeDiffSummary != null) {
    const { filesChanged, linesAdded } = ev.codeDiffSummary
    // More files/lines suggest deeper product changes, up to a point
    const fileScore = Math.min(100, filesChanged * 10)
    const lineScore = Math.min(100, linesAdded * 0.5)
    const diffScore = Math.round((fileScore + lineScore) / 2)
    total += diffScore * 2
    weight += 2
    evidence.push(`Code diff: ${filesChanged} files changed, +${linesAdded} lines`)
  }

  if (ev.testResult != null) {
    // Having more tests implies deeper coverage
    const testDepthScore = Math.min(100, ev.testResult.total * 5)
    total += testDepthScore * 1
    weight += 1
    evidence.push(`Test count: ${ev.testResult.total} total tests`)
  }

  if (ev.liveResults != null && ev.liveResults.length > 0) {
    // More live scenarios tested implies broader product coverage
    const scenarioDepthScore = Math.min(100, ev.liveResults.length * 15)
    total += scenarioDepthScore * 1
    weight += 1
    evidence.push(`Live scenario coverage: ${ev.liveResults.length} scenarios`)
  }

  const score = weight > 0 ? Math.round(total / weight) : 0
  if (weight === 0) {
    critique.push("No product depth evidence available")
  }
  return { score, evidence, critique }
}

/**
 * Derive a raw 0-100 **uxDesign** score from observable evidence.
 *
 * Signals: live scenario scores, screenshot existence.
 */
function scoreUxDesign(ev: BlindObservableEvidence): { score: number; evidence: string[]; critique: string[] } {
  const evidence: string[] = []
  const critique: string[] = []
  let total = 0
  let weight = 0

  if (ev.liveResults != null && ev.liveResults.length > 0) {
    const avgScore = ev.liveResults.reduce((s, r) => s + r.score, 0) / ev.liveResults.length
    total += avgScore * 3
    weight += 3
    evidence.push(`Average live scenario score: ${Math.round(avgScore)}`)
    if (avgScore < 50) {
      critique.push("Live scenario scores are below 50 average --- UX may be poor")
    }
  }

  if (ev.screenshotPaths != null && ev.screenshotPaths.length > 0) {
    // Screenshots exist means visual verification was possible
    const screenshotBonus = Math.min(80, ev.screenshotPaths.length * 20)
    total += screenshotBonus * 1
    weight += 1
    evidence.push(`Screenshots captured: ${ev.screenshotPaths.length}`)
  }

  if (ev.domSnapshotPaths != null && ev.domSnapshotPaths.length > 0) {
    const domBonus = Math.min(70, ev.domSnapshotPaths.length * 15)
    total += domBonus * 1
    weight += 1
    evidence.push(`DOM snapshots: ${ev.domSnapshotPaths.length}`)
  }

  const score = weight > 0 ? Math.round(total / weight) : 0
  if (weight === 0) {
    critique.push("No UX evidence available (no live results or screenshots)")
  }
  return { score, evidence, critique }
}

/**
 * Derive a raw 0-100 **codeQuality** score from observable evidence.
 *
 * Signals: build pass, test pass ratio, error count.
 */
function scoreCodeQuality(ev: BlindObservableEvidence): { score: number; evidence: string[]; critique: string[] } {
  const evidence: string[] = []
  const critique: string[] = []
  let total = 0
  let weight = 0

  if (ev.buildResult != null) {
    const buildScore = ev.buildResult.passed ? 100 : 0
    total += buildScore * 3
    weight += 3
    evidence.push(`Build: ${ev.buildResult.passed ? "clean" : "FAILED"}`)
    if (ev.buildResult.errors.length > 0) {
      const errorPenalty = Math.min(30, ev.buildResult.errors.length * 10)
      critique.push(`${ev.buildResult.errors.length} build error(s) detected (penalty: -${errorPenalty})`)
      total -= errorPenalty * weight // apply penalty proportionally
    }
  }

  if (ev.testResult != null && ev.testResult.total > 0) {
    const passRate = ev.testResult.passed / ev.testResult.total
    const testQualityScore = Math.round(passRate * 100)
    total += testQualityScore * 2
    weight += 2
    evidence.push(`Test pass rate: ${Math.round(passRate * 100)}%`)
    if (ev.testResult.failed > 0) {
      critique.push(`${ev.testResult.failed} failing test(s) indicate quality issues`)
    }
  }

  const score = weight > 0 ? Math.max(0, Math.min(100, Math.round(total / weight))) : 0
  if (weight === 0) {
    critique.push("No code quality evidence available")
  }
  return { score, evidence, critique }
}

/**
 * Derive a raw 0-100 **maintainability** score from observable evidence.
 *
 * Signals: code diff size (smaller is better for same functionality level),
 * test presence.
 */
function scoreMaintainability(ev: BlindObservableEvidence): { score: number; evidence: string[]; critique: string[] } {
  const evidence: string[] = []
  const critique: string[] = []
  let total = 0
  let weight = 0

  if (ev.codeDiffSummary != null) {
    const { linesAdded, linesRemoved, filesChanged } = ev.codeDiffSummary
    // Smaller diffs are more maintainable (less to review/maintain)
    // We use a decaying curve: 0 lines = 100, 500+ lines = ~30
    const netLines = linesAdded + linesRemoved
    const sizeScore = Math.max(20, Math.round(100 * Math.exp(-netLines / 400)))
    total += sizeScore * 2
    weight += 2
    evidence.push(`Diff size: +${linesAdded}/-${linesRemoved} across ${filesChanged} files (net ${netLines} lines)`)
    if (netLines > 500) {
      critique.push("Large diff may be harder to review and maintain")
    }
  }

  if (ev.testResult != null && ev.testResult.total > 0) {
    // Having tests improves maintainability
    const hasTests = ev.testResult.total > 0
    const testScore = hasTests ? Math.min(90, 50 + ev.testResult.total * 2) : 20
    total += testScore * 1
    weight += 1
    evidence.push(`Test suite: ${ev.testResult.total} tests present`)
  }

  if (ev.buildResult != null) {
    const buildScore = ev.buildResult.passed ? 80 : 30
    total += buildScore * 1
    weight += 1
    evidence.push(`Build health: ${ev.buildResult.passed ? "passing" : "failing"}`)
  }

  const score = weight > 0 ? Math.round(total / weight) : 0
  if (weight === 0) {
    critique.push("No maintainability evidence available")
  }
  return { score, evidence, critique }
}

// ---------------------------------------------------------------------------
// Confidence computation
// ---------------------------------------------------------------------------

/**
 * Compute how much evidence is actually available for the blind evaluation.
 *
 * Returns `"high"` when most evidence signals are present, `"medium"` when
 * some are, and `"low"` when very little evidence exists.
 */
export function computeBlindConfidence(
  input: BlindEvaluatorInput,
): { confidence: "high" | "medium" | "low"; coverage: number } {
  const ev = input.observableEvidence
  const signals = [
    ev.buildResult != null,
    ev.testResult != null && ev.testResult.total > 0,
    ev.liveResults != null && ev.liveResults.length > 0,
    ev.screenshotPaths != null && ev.screenshotPaths.length > 0,
    ev.domSnapshotPaths != null && ev.domSnapshotPaths.length > 0,
    ev.codeDiffSummary != null,
    ev.benchScore != null,
  ]

  const presentCount = signals.filter(Boolean).length
  const coverage = presentCount / signals.length

  let confidence: "high" | "medium" | "low"
  if (coverage >= 0.7) {
    confidence = "high"
  } else if (coverage >= 0.4) {
    confidence = "medium"
  } else {
    confidence = "low"
  }

  return { confidence, coverage: Math.round(coverage * 100) / 100 }
}

// ---------------------------------------------------------------------------
// Main blind evaluation
// ---------------------------------------------------------------------------

/**
 * Run a blind evaluation that scores each dimension ONLY from observable
 * evidence --- no planner or generator self-descriptions.
 */
export function runBlindEvaluation(input: BlindEvaluatorInput): BlindEvaluatorResult {
  const ev = input.observableEvidence
  const config = input.scoringConfig

  // Score each dimension from observable evidence only
  const functionalityResult = scoreFunctionality(ev)
  const productDepthResult = scoreProductDepth(ev)
  const uxDesignResult = scoreUxDesign(ev)
  const codeQualityResult = scoreCodeQuality(ev)
  const maintainabilityResult = scoreMaintainability(ev)

  const dimensionResults: DimensionScore[] = [
    scoreDimension("functionality", functionalityResult.score, config, functionalityResult.evidence, functionalityResult.critique),
    scoreDimension("productDepth", productDepthResult.score, config, productDepthResult.evidence, productDepthResult.critique),
    scoreDimension("uxDesign", uxDesignResult.score, config, uxDesignResult.evidence, uxDesignResult.critique),
    scoreDimension("codeQuality", codeQualityResult.score, config, codeQualityResult.evidence, codeQualityResult.critique),
    scoreDimension("maintainability", maintainabilityResult.score, config, maintainabilityResult.evidence, maintainabilityResult.critique),
  ]

  const compositeScore = computeCompositeScore(dimensionResults, config)
  const verdict = deriveVerdictFromComposite(compositeScore)
  const { confidence, coverage } = computeBlindConfidence(input)

  const notes: string[] = [
    `Blind evaluation mode: no self-descriptions used`,
    `Evidence coverage: ${Math.round(coverage * 100)}% of possible signals present`,
    `Confidence: ${confidence}`,
  ]

  if (confidence === "low") {
    notes.push("WARNING: Very limited evidence available --- blind scores may be unreliable")
  }

  notes.push(renderCompositeScoreMarkdown(compositeScore))

  return {
    schemaVersion: 1,
    runId: input.runId,
    sprintIndex: input.sprintIndex,
    mode: "blind",
    compositeScore,
    dimensionScores: dimensionResults,
    verdict,
    confidence,
    evidenceCoverage: coverage,
    notes,
  }
}

// ---------------------------------------------------------------------------
// Blind vs Self comparison
// ---------------------------------------------------------------------------

/** Divergence threshold (0-100 scale) above which a gap is flagged. */
const SUSPICION_THRESHOLD = 15

/**
 * Compare blind evaluation results against the self-described evaluator
 * artifact. Flags any dimension where the delta exceeds 15 points as
 * suspicious.
 */
export function compareBlindVsSelfEvaluation(
  blind: BlindEvaluatorResult,
  selfEval: BenchOptEvaluatorArtifact,
): BlindVsSelfComparison {
  const notes: string[] = []
  const divergences: BlindVsSelfDivergence[] = []

  // Build a map of self-eval dimension scores
  const selfDimMap = new Map<string, DimensionScore>()
  for (const dim of selfEval.dimensionScores) {
    selfDimMap.set(dim.dimensionId, dim)
  }

  for (const blindDim of blind.dimensionScores) {
    const selfDim = selfDimMap.get(blindDim.dimensionId)
    const selfScore = selfDim?.score ?? 0
    const delta = Math.abs(blindDim.score - selfScore)
    const suspicious = delta > SUSPICION_THRESHOLD

    divergences.push({
      dimensionId: blindDim.dimensionId,
      label: blindDim.label,
      blindScore: blindDim.score,
      selfScore,
      delta,
      suspicious,
    })

    if (suspicious) {
      const direction = blindDim.score < selfScore ? "self-eval inflated" : "self-eval deflated"
      notes.push(
        `SUSPICIOUS: ${blindDim.label} diverges by ${delta} points (blind=${blindDim.score}, self=${selfScore}) --- ${direction}`,
      )
    }
  }

  const blindComposite = blind.compositeScore.weightedTotal
  const selfComposite = selfEval.compositeScore?.weightedTotal ?? selfEval.score
  const compositeDelta = Math.abs(blindComposite - selfComposite)
  const compositeSuspicious = compositeDelta > SUSPICION_THRESHOLD

  if (compositeSuspicious) {
    notes.push(
      `SUSPICIOUS: Composite totals diverge by ${Math.round(compositeDelta)} points (blind=${blindComposite}, self=${selfComposite})`,
    )
  }

  const suspiciousCount = divergences.filter((d) => d.suspicious).length

  if (suspiciousCount === 0) {
    notes.push("No suspicious divergences found between blind and self-evaluation")
  } else {
    notes.push(`${suspiciousCount} dimension(s) flagged as suspicious (delta > ${SUSPICION_THRESHOLD})`)
  }

  return {
    blindComposite,
    selfComposite,
    compositeDelta: Math.round(compositeDelta * 100) / 100,
    compositeSuspicious,
    divergences,
    suspiciousCount,
    notes,
  }
}
