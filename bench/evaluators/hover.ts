import type { EvaluationResult, BenchmarkIssue, PatchHintArtifact } from "../types"

export interface HoverExecution {
  requestCount: number
  overlayVisible: boolean
  overlayText: string
  overlayError: string
  triggerLabel: string
  translationLatencyMs: number
  selectionSuppressed: boolean
  payloadSelectionContext: string | null
  payloadTask: string | null
}

function pushIssue(
  issues: BenchmarkIssue[],
  severity: BenchmarkIssue["severity"],
  message: string,
  evidence?: string,
) {
  issues.push({ severity, message, evidence })
}

function buildPatchHints(
  execution: HoverExecution,
  expected: {
    shouldRequest: boolean
    shouldShowOverlay: boolean
    expectedTriggerLabel?: string
    maxLatencyMs?: number
    expectedTask?: "translate" | "explain"
    requireSelectionSuppression?: boolean
  },
): PatchHintArtifact | undefined {
  const failingSignals: string[] = []

  if (execution.requestCount !== (expected.shouldRequest ? 1 : 0)) {
    failingSignals.push(`requestCount=${execution.requestCount}`)
  }

  if (execution.overlayVisible !== expected.shouldShowOverlay) {
    failingSignals.push(`overlayVisible=${execution.overlayVisible}`)
  }

  if (expected.expectedTriggerLabel && execution.triggerLabel !== expected.expectedTriggerLabel) {
    failingSignals.push(`triggerLabel=${execution.triggerLabel}`)
  }

  if (expected.expectedTask && execution.payloadTask !== expected.expectedTask) {
    failingSignals.push(`task=${execution.payloadTask}`)
  }

  if (expected.shouldRequest && execution.translationLatencyMs > (expected.maxLatencyMs ?? 450)) {
    failingSignals.push(`latency=${execution.translationLatencyMs}ms`)
  }

  if (expected.requireSelectionSuppression && !execution.selectionSuppressed) {
    failingSignals.push("selectionSuppressed=false")
  }

  if (failingSignals.length === 0) {
    return undefined
  }

  const confidence: PatchHintArtifact["confidence"] =
    execution.requestCount !== (expected.shouldRequest ? 1 : 0)
    || (expected.requireSelectionSuppression && !execution.selectionSuppressed)
      ? "high"
      : "medium"

  return {
    suspectedFiles: [
      "src/entrypoints/content/components/HoverTranslate.tsx",
      "src/entrypoints/content/interaction-coordination.ts",
      "src/utils/dom/traversal.ts",
      "src/entrypoints/content/inline-actions.ts",
    ],
    suspectedSymbols: [
      "mountHoverTranslate",
      "getInteractionSuppressionState",
      "hasActiveTextSelection",
      "subscribeToInteractionSuppression",
      "findClosestTextBlock",
      "runInlineAction",
    ],
    suspectedKeywords: [
      "hover",
      "selection",
      "overlay",
      "suppression",
    ],
    failingSignals,
    confidence,
  }
}

export function evaluateHover(
  execution: HoverExecution,
  expected: {
    shouldRequest: boolean
    shouldShowOverlay: boolean
    expectedTriggerLabel?: string
    maxLatencyMs?: number
    expectedTask?: "translate" | "explain"
    requireSelectionSuppression?: boolean
  },
): EvaluationResult {
  const issues: BenchmarkIssue[] = []
  const triggerAccuracy = execution.requestCount === (expected.shouldRequest ? 1 : 0) ? 10 : 2
  const contextQuality = expected.shouldRequest
    ? execution.payloadSelectionContext?.trim().length ? 10 : 4
    : 10
  const suppressionMatches = !expected.requireSelectionSuppression || execution.selectionSuppressed
  const interactionSafety = suppressionMatches ? 10 : 4
  const latency = !expected.shouldRequest || execution.translationLatencyMs <= (expected.maxLatencyMs ?? 450) ? 10 : 4
  const correctness = execution.overlayVisible === expected.shouldShowOverlay ? 10 : 3

  if (execution.requestCount !== (expected.shouldRequest ? 1 : 0)) {
    pushIssue(
      issues,
      expected.shouldRequest ? "critical" : "high",
      "Hover translation request count did not match the trigger expectation.",
      `requestCount=${execution.requestCount}`,
    )
  }

  if (execution.overlayVisible !== expected.shouldShowOverlay) {
    pushIssue(
      issues,
      "high",
      "Hover overlay visibility did not match the scenario expectation.",
      `overlayVisible=${execution.overlayVisible}`,
    )
  }

  if (expected.expectedTriggerLabel && execution.triggerLabel !== expected.expectedTriggerLabel) {
    pushIssue(
      issues,
      "medium",
      "Hover overlay rendered the wrong trigger label.",
      `triggerLabel=${execution.triggerLabel}`,
    )
  }

  if (expected.expectedTask && execution.payloadTask !== expected.expectedTask) {
    pushIssue(
      issues,
      "high",
      "Hover action dispatched the wrong task type.",
      `task=${execution.payloadTask}`,
    )
  }

  if (expected.shouldRequest && execution.translationLatencyMs > (expected.maxLatencyMs ?? 450)) {
    pushIssue(
      issues,
      "medium",
      "Hover translation exceeded the latency budget.",
      `latency=${execution.translationLatencyMs}ms`,
    )
  }

  if (expected.requireSelectionSuppression && !execution.selectionSuppressed) {
    pushIssue(
      issues,
      "high",
      "Hover suppression scenario did not verify that an active selection blocked the interaction.",
      "selectionSuppressed=false",
    )
  }

  const scores = {
    correctness,
    completeness: triggerAccuracy,
    stability: 10,
    trigger_accuracy: triggerAccuracy,
    context_quality: contextQuality,
    interaction_safety: interactionSafety,
    latency,
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
      overlayText: execution.overlayText,
      overlayError: execution.overlayError,
      triggerLabel: execution.triggerLabel,
      translationLatencyMs: execution.translationLatencyMs,
      patchHints: buildPatchHints(execution, expected),
    },
    nextActions: issues.map((issue) => issue.message),
  }
}
