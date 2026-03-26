import type { EvaluationResult, BenchmarkIssue } from "../types"

export interface PageTranslationExecution {
  translatedNodeCount: number
  expectedNodeCount: number
  translationMarkerCount: number
  hiddenSourceCount: number
  requestCount: number
  skippedInteractiveTranslations: number
  translatedTexts: string[]
  expectedTexts: string[]
  snapshotPhase: string
  failedBlocks: number
  notes?: string[]
}

function addIssue(
  issues: BenchmarkIssue[],
  severity: BenchmarkIssue["severity"],
  message: string,
  evidence?: string,
) {
  issues.push({ severity, message, evidence })
}

export function evaluatePageTranslation(
  execution: PageTranslationExecution,
  options: {
    requireTranslationOnly?: boolean
  } = {},
): EvaluationResult {
  const issues: BenchmarkIssue[] = []
  const correctness = execution.translatedNodeCount === execution.expectedNodeCount ? 10 : 5
  const coverage = execution.expectedNodeCount === 0
    ? 0
    : Math.round((execution.translatedNodeCount / execution.expectedNodeCount) * 10)
  const domPreservation = execution.skippedInteractiveTranslations === 0 ? 10 : 4
  const stability = execution.failedBlocks === 0 && execution.snapshotPhase === "running" ? 10 : 4
  const completeness = execution.requestCount > 0 && execution.translationMarkerCount >= execution.translatedNodeCount ? 10 : 5

  if (execution.translatedNodeCount !== execution.expectedNodeCount) {
    addIssue(
      issues,
      "high",
      "Translated block count did not match the expected extraction plan.",
      `expected=${execution.expectedNodeCount}, actual=${execution.translatedNodeCount}`,
    )
  }

  if (execution.skippedInteractiveTranslations > 0) {
    addIssue(
      issues,
      "critical",
      "Interactive elements received Astra translation markers.",
      `interactiveMarkers=${execution.skippedInteractiveTranslations}`,
    )
  }

  if (execution.failedBlocks > 0) {
    addIssue(
      issues,
      "critical",
      "Page translation session reported failed blocks.",
      `failedBlocks=${execution.failedBlocks}`,
    )
  }

  if (options.requireTranslationOnly && execution.hiddenSourceCount !== execution.translatedNodeCount) {
    addIssue(
      issues,
      "high",
      "Translation-only mode did not hide all source nodes behind Astra wrappers.",
      `hiddenSourceCount=${execution.hiddenSourceCount}, translatedNodeCount=${execution.translatedNodeCount}`,
    )
  }

  const scores = {
    correctness,
    completeness,
    stability,
    coverage: Math.min(10, coverage),
    dom_preservation: domPreservation,
  }

  const baseTotal = Math.round((Object.values(scores).reduce((sum, score) => sum + score, 0) / (Object.keys(scores).length * 10)) * 100)
  const penalty = issues.reduce((sum, issue) => {
    switch (issue.severity) {
      case "critical":
        return sum + 40
      case "high":
        return sum + 20
      case "medium":
        return sum + 10
      case "low":
        return sum + 5
      default:
        return sum
    }
  }, 0)
  const total = Math.max(0, baseTotal - penalty)
  const pass = total >= 80 && !issues.some((issue) => issue.severity === "critical")

  return {
    scores,
    total,
    pass,
    issues,
    artifacts: {
      translatedTexts: execution.translatedTexts,
      expectedTexts: execution.expectedTexts,
      requestCount: execution.requestCount,
      notes: execution.notes ?? [],
    },
    nextActions: issues.map((issue) => issue.message),
  }
}
