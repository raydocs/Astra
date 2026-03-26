import type { BenchmarkIssue, EvaluationResult } from "../types"

export interface DynamicContentExecution {
  requestCountBeforeMutation: number
  requestCountAfterMutation: number
  latestRequestedSourceText: string | null
  translatedNodeCountBeforeMutation: number
  translatedNodeCountAfterMutation: number
  translatedTextsAfterMutation: string[]
  updatedTextRequested: boolean
  oldTextCleared: boolean
  progressTotalBlocksBeforeMutation: number
  progressTotalBlocksAfterMutation: number
  removedElementStillTracked: boolean
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

export function evaluateDynamicContent(
  execution: DynamicContentExecution,
  expectations: {
    expectedNewRequests?: number
    expectedTranslatedNodeDelta?: number
    requireUpdatedText?: boolean
    requireOldTextCleared?: boolean
    expectedProgressTotalAfterMutation?: number
    shouldCleanupRemovedBlocks?: boolean
  } = {},
): EvaluationResult {
  const issues: BenchmarkIssue[] = []
  const newRequests = execution.requestCountAfterMutation - execution.requestCountBeforeMutation
  const translatedNodeDelta = execution.translatedNodeCountAfterMutation - execution.translatedNodeCountBeforeMutation

  if (
    expectations.expectedNewRequests !== undefined
    && newRequests !== expectations.expectedNewRequests
  ) {
    addIssue(
      issues,
      "critical",
      "Dynamic content mutation did not trigger the expected number of follow-up translation requests.",
      `before=${execution.requestCountBeforeMutation}, after=${execution.requestCountAfterMutation}`,
    )
  }

  if (
    expectations.expectedTranslatedNodeDelta !== undefined
    && translatedNodeDelta !== expectations.expectedTranslatedNodeDelta
  ) {
    addIssue(
      issues,
      "high",
      "Dynamic mutation did not change the translated node count as expected.",
      `before=${execution.translatedNodeCountBeforeMutation}, after=${execution.translatedNodeCountAfterMutation}`,
    )
  }

  if (expectations.requireUpdatedText && !execution.updatedTextRequested) {
    addIssue(
      issues,
      "high",
      "Updated feed content was not re-translated with the new source text.",
      execution.latestRequestedSourceText ?? execution.translatedTextsAfterMutation.join(" | "),
    )
  }

  if (expectations.requireOldTextCleared && !execution.oldTextCleared) {
    addIssue(
      issues,
      "medium",
      "Stale translation content was still present after the source text changed.",
      execution.translatedTextsAfterMutation.join(" | "),
    )
  }

  if (
    expectations.expectedProgressTotalAfterMutation !== undefined
    && execution.progressTotalBlocksAfterMutation !== expectations.expectedProgressTotalAfterMutation
  ) {
    addIssue(
      issues,
      "high",
      "Registry progress totals did not converge to the expected value after mutation handling.",
      `before=${execution.progressTotalBlocksBeforeMutation}, after=${execution.progressTotalBlocksAfterMutation}`,
    )
  }

  if (expectations.shouldCleanupRemovedBlocks && execution.removedElementStillTracked) {
    addIssue(
      issues,
      "high",
      "Disconnected feed blocks remained tracked after removal.",
      `progressAfter=${execution.progressTotalBlocksAfterMutation}`,
    )
  }

  const correctness = issues.some((issue) => issue.severity === "critical") ? 4 : 10
  const completeness = issues.some((issue) => issue.severity === "high") ? 6 : 10
  const stability = issues.some((issue) => issue.severity === "critical") ? 4 : 10
  const mutationResponsiveness = (
    (expectations.expectedNewRequests === undefined || newRequests === expectations.expectedNewRequests)
    && (expectations.expectedTranslatedNodeDelta === undefined || translatedNodeDelta === expectations.expectedTranslatedNodeDelta)
    && (!expectations.requireUpdatedText || execution.updatedTextRequested)
  ) ? 10 : 4
  const registryHygiene = (
    (expectations.expectedProgressTotalAfterMutation === undefined
      || execution.progressTotalBlocksAfterMutation === expectations.expectedProgressTotalAfterMutation)
    && (!expectations.shouldCleanupRemovedBlocks || !execution.removedElementStillTracked)
  ) ? 10 : 4

  const scores = {
    correctness,
    completeness,
    stability,
    mutation_responsiveness: mutationResponsiveness,
    registry_hygiene: registryHygiene,
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
      requestCountBeforeMutation: execution.requestCountBeforeMutation,
      requestCountAfterMutation: execution.requestCountAfterMutation,
      latestRequestedSourceText: execution.latestRequestedSourceText,
      translatedNodeCountBeforeMutation: execution.translatedNodeCountBeforeMutation,
      translatedNodeCountAfterMutation: execution.translatedNodeCountAfterMutation,
      translatedTextsAfterMutation: execution.translatedTextsAfterMutation,
      progressTotalBlocksBeforeMutation: execution.progressTotalBlocksBeforeMutation,
      progressTotalBlocksAfterMutation: execution.progressTotalBlocksAfterMutation,
      notes: execution.notes ?? [],
    },
    nextActions: issues.map((issue) => issue.message),
  }
}
