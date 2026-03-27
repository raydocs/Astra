import type { BenchmarkIssue, EvaluationResult, PatchHintArtifact } from "../types"

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

function buildPatchHints(
  execution: DynamicContentExecution,
  expectations: {
    expectedNewRequests?: number
    expectedTranslatedNodeDelta?: number
    requireUpdatedText?: boolean
    requireOldTextCleared?: boolean
    expectedProgressTotalAfterMutation?: number
    shouldCleanupRemovedBlocks?: boolean
  },
  issues: BenchmarkIssue[],
): PatchHintArtifact | undefined {
  if (issues.length === 0) {
    return undefined
  }

  const suspectedFiles = new Set<string>([
    "src/entrypoints/content/page-translate.ts",
    "src/entrypoints/content/page-translate-registry.ts",
    "src/utils/dom/traversal.ts",
    "src/utils/dom/inject.ts",
  ])
  const suspectedSymbols = new Set<string>([
    "startPageTranslation",
    "stopPageTranslation",
  ])
  const suspectedKeywords = new Set<string>([
    "mutation",
    "registry",
    "dynamic",
    "progressTotalBlocks",
    "requestCountAfterMutation",
    "translatedNodeCountAfterMutation",
    "updatedTextRequested",
    "oldTextCleared",
    "removedElementStillTracked",
  ])
  const failingSignals: string[] = []
  const newRequests = execution.requestCountAfterMutation - execution.requestCountBeforeMutation
  const translatedNodeDelta = execution.translatedNodeCountAfterMutation - execution.translatedNodeCountBeforeMutation

  if (expectations.expectedNewRequests !== undefined && newRequests !== expectations.expectedNewRequests) {
    failingSignals.push("dynamic mutation triggered the wrong number of follow-up requests")
    suspectedKeywords.add("requestCountAfterMutation")
  }
  if (expectations.expectedTranslatedNodeDelta !== undefined && translatedNodeDelta !== expectations.expectedTranslatedNodeDelta) {
    failingSignals.push("translated node count did not track the mutation correctly")
    suspectedKeywords.add("translatedNodeCountAfterMutation")
  }
  if (expectations.requireUpdatedText && !execution.updatedTextRequested) {
    failingSignals.push("updated dynamic text was never re-requested")
    suspectedKeywords.add("updatedTextRequested")
  }
  if (expectations.requireOldTextCleared && !execution.oldTextCleared) {
    failingSignals.push("stale translated text remained after an in-place update")
    suspectedKeywords.add("oldTextCleared")
  }
  if (expectations.expectedProgressTotalAfterMutation !== undefined && execution.progressTotalBlocksAfterMutation !== expectations.expectedProgressTotalAfterMutation) {
    failingSignals.push("translation progress registry did not converge after mutation handling")
    suspectedKeywords.add("progressTotalBlocksAfterMutation")
  }
  if (expectations.shouldCleanupRemovedBlocks && execution.removedElementStillTracked) {
    failingSignals.push("removed dynamic block remained in registry tracking")
    suspectedKeywords.add("removedElementStillTracked")
  }

  const confidence = issues.some((issue) => issue.severity === "critical") ? "high" : "medium"

  return {
    suspectedFiles: [...suspectedFiles],
    suspectedSymbols: [...suspectedSymbols],
    suspectedKeywords: [...suspectedKeywords],
    failingSignals,
    confidence,
  }
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
      patchHints: buildPatchHints(execution, expectations, issues),
    },
    nextActions: issues.map((issue) => issue.message),
  }
}
