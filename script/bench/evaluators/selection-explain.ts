import type { EvaluationResult, BenchmarkIssue, PatchHintArtifact } from "../types"

export interface SelectionExplainExecution {
  requestCount: number
  requestTask: string | null
  requestSelectionContext: string | null
  requestLanguageLevel?: string | null
  requestExplainMode?: string | null
  resultText: string
  clipboardWrites: string[]
  buttonLabels: string[]
}

function addIssue(
  issues: BenchmarkIssue[],
  severity: BenchmarkIssue["severity"],
  message: string,
  evidence?: string,
) {
  issues.push({ severity, message, evidence })
}

function hasAnyLabel(buttonLabels: string[], candidates: string[]) {
  return candidates.some((candidate) => buttonLabels.includes(candidate))
}

function buildPatchHints(
  execution: SelectionExplainExecution,
  expected: {
    shouldCopy?: boolean
    expectedTask?: "explain" | "translate"
    requireContext?: boolean
    requireExplainProfile?: boolean
  } = {},
): PatchHintArtifact | undefined {
  const failingSignals: string[] = []

  if (execution.requestCount !== 1) {
    failingSignals.push(`requestCount=${execution.requestCount}`)
  }

  if (expected.expectedTask && execution.requestTask !== expected.expectedTask) {
    failingSignals.push(`task=${execution.requestTask}`)
  }

  if (expected.requireContext !== false && !execution.requestSelectionContext) {
    failingSignals.push("missing selection context")
  }

  if (expected.requireExplainProfile && (!execution.requestLanguageLevel || !execution.requestExplainMode)) {
    failingSignals.push("missing explain profile")
  }

  if (expected.shouldCopy && execution.clipboardWrites.length === 0) {
    failingSignals.push("missing clipboard write")
  }

  if (failingSignals.length === 0) {
    return undefined
  }

  const confidence: PatchHintArtifact["confidence"] =
    execution.requestCount !== 1 || (expected.shouldCopy && execution.clipboardWrites.length === 0)
      ? "high"
      : "medium"

  return {
    suspectedFiles: [
      "src/entrypoints/content/components/SelectionToolbar.tsx",
      "src/entrypoints/content/interaction-coordination.ts",
      "src/entrypoints/content/inline-actions.ts",
      "src/utils/dom/clipboard.ts",
    ],
    suspectedSymbols: [
      "mountSelectionToolbar",
      "getSelectionContext",
      "setInteractionSuppressionReason",
      "clearInteractionSuppression",
      "runActionById",
      "copyTextToClipboard",
    ],
    suspectedKeywords: [
      "解释",
      "复制",
      "selection",
      "toolbar",
    ],
    failingSignals,
    confidence,
  }
}

export function evaluateSelectionExplain(
  execution: SelectionExplainExecution,
  expected: {
    shouldCopy?: boolean
    expectedTask?: "explain" | "translate"
    requireContext?: boolean
    requireExplainProfile?: boolean
  } = {},
): EvaluationResult {
  const issues: BenchmarkIssue[] = []
  const correctness = execution.requestCount === 1 && execution.resultText.trim().length > 0 ? 10 : 3
  const contextQuality = expected.requireContext === false || execution.requestSelectionContext?.trim().length ? 10 : 4
  const hasExplainButton = hasAnyLabel(execution.buttonLabels, ["Explain", "解释"])
  const hasCopyButton = hasAnyLabel(execution.buttonLabels, ["Copy", "复制"])
  const interactionSafety = hasExplainButton && hasCopyButton ? 10 : 5
  const completeness = expected.shouldCopy ? (execution.clipboardWrites.length > 0 ? 10 : 3) : 10

  if (execution.requestCount !== 1) {
    addIssue(
      issues,
      "critical",
      "Selection toolbar did not issue exactly one action request.",
      `requestCount=${execution.requestCount}`,
    )
  }

  if (expected.expectedTask && execution.requestTask !== expected.expectedTask) {
    addIssue(
      issues,
      "high",
      "Selection toolbar dispatched the wrong action task.",
      `task=${execution.requestTask}`,
    )
  }

  if (expected.requireContext !== false && !execution.requestSelectionContext) {
    addIssue(
      issues,
      "high",
      "Selection toolbar did not pass contextual text into the action request.",
    )
  }

  if (expected.requireExplainProfile && (!execution.requestLanguageLevel || !execution.requestExplainMode)) {
    addIssue(
      issues,
      "high",
      "Selection toolbar did not pass the explain profile into the action request.",
      `languageLevel=${execution.requestLanguageLevel ?? "missing"}, explainMode=${execution.requestExplainMode ?? "missing"}`,
    )
  }

  if (expected.shouldCopy && execution.clipboardWrites.length === 0) {
    addIssue(
      issues,
      "high",
      "Copy action did not write the generated result to the clipboard.",
    )
  }

  const scores = {
    correctness,
    completeness,
    stability: 10,
    trigger_accuracy: 10,
    context_quality: contextQuality,
    interaction_safety: interactionSafety,
    latency: 10,
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
      resultText: execution.resultText,
      requestLanguageLevel: execution.requestLanguageLevel ?? null,
      requestExplainMode: execution.requestExplainMode ?? null,
      clipboardWrites: execution.clipboardWrites,
      buttonLabels: execution.buttonLabels,
      patchHints: buildPatchHints(execution, expected),
    },
    nextActions: issues.map((issue) => issue.message),
  }
}
