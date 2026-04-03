import type { BenchmarkIssue, EvaluationResult, PatchHintArtifact } from "../types"

export interface InputTranslationExecution {
  requestCount: number
  requestTask: string | null
  translatedValue: string
  initialValue: string
  overlayVisibleAfterFocus: boolean
  overlayVisibleAfterTyping: boolean
  buttonLabel: string
  writebackInputEventCount: number
  translationLatencyMs: number
  payloadHostname: string | null
  payloadPageUrl: string | null
  inputType: string
  editableKind: "input" | "textarea" | "contenteditable"
  selectionStartBefore: number | null
  selectionEndBefore: number | null
  selectionStartAfter: number | null
  selectionEndAfter: number | null
}

function addIssue(
  issues: BenchmarkIssue[],
  severity: BenchmarkIssue["severity"],
  message: string,
  evidence?: string,
) {
  issues.push({ severity, message, evidence })
}

function clampSelectionToTranslatedText(
  execution: InputTranslationExecution,
  before: number | null,
) {
  if (before === null) return null
  return Math.min(before, execution.translatedValue.length)
}

function cursorPreserved(
  execution: InputTranslationExecution,
) {
  if (
    execution.selectionStartBefore === null
    || execution.selectionEndBefore === null
    || execution.selectionStartAfter === null
    || execution.selectionEndAfter === null
  ) {
    return false
  }

  const expectedStart = clampSelectionToTranslatedText(execution, execution.selectionStartBefore)
  const expectedEnd = clampSelectionToTranslatedText(execution, execution.selectionEndBefore)

  return execution.selectionStartAfter === expectedStart
    && execution.selectionEndAfter === expectedEnd
}

function buildPatchHints(
  execution: InputTranslationExecution,
  expected: {
    shouldRequest: boolean
    shouldShowAfterFocus: boolean
    shouldShowAfterTyping?: boolean
    shouldWriteBack: boolean
    shouldPreserveCursor?: boolean
    expectedTask?: "translate"
    requireContext?: boolean
    maxLatencyMs?: number
  },
): PatchHintArtifact | undefined {
  const failingSignals: string[] = []

  if (execution.requestCount !== (expected.shouldRequest ? 1 : 0)) {
    failingSignals.push(`requestCount=${execution.requestCount}`)
  }

  if (execution.overlayVisibleAfterFocus !== expected.shouldShowAfterFocus) {
    failingSignals.push(`overlayVisibleAfterFocus=${execution.overlayVisibleAfterFocus}`)
  }

  const expectedOverlayAfterTyping = expected.shouldShowAfterTyping ?? expected.shouldShowAfterFocus
  if (execution.overlayVisibleAfterTyping !== expectedOverlayAfterTyping) {
    failingSignals.push(`overlayVisibleAfterTyping=${execution.overlayVisibleAfterTyping}`)
  }

  if (expected.shouldWriteBack
    ? execution.translatedValue === execution.initialValue || execution.writebackInputEventCount === 0
    : execution.translatedValue !== execution.initialValue || execution.writebackInputEventCount > 0) {
    failingSignals.push(`writeback=${execution.translatedValue === execution.initialValue ? "missing" : "mutated"}`)
  }

  if (expected.expectedTask && execution.requestTask !== expected.expectedTask) {
    failingSignals.push(`task=${execution.requestTask}`)
  }

  if (expected.shouldPreserveCursor) {
    if (!cursorPreserved(execution)) {
      failingSignals.push(`cursorPreserved=${cursorPreserved(execution)}`)
    }
  }

  if (expected.requireContext && (!execution.payloadHostname || !execution.payloadPageUrl)) {
    failingSignals.push("missing page context")
  }

  if (expected.shouldRequest && execution.translationLatencyMs > (expected.maxLatencyMs ?? 350)) {
    failingSignals.push(`latency=${execution.translationLatencyMs}ms`)
  }

  if (failingSignals.length === 0) {
    return undefined
  }

  const confidence: PatchHintArtifact["confidence"] =
    execution.requestCount !== (expected.shouldRequest ? 1 : 0)
    || expected.shouldWriteBack
    || (expected.requireContext && (!execution.payloadHostname || !execution.payloadPageUrl))
      ? "high"
      : "medium"

  return {
    suspectedFiles: [
      "src/entrypoints/content/components/InputTranslate.tsx",
      "src/entrypoints/content/inline-actions.ts",
      "src/utils/privacy.ts",
      "src/utils/storage/config.ts",
    ],
    suspectedSymbols: [
      "mountInputTranslate",
      "runInlineAction",
      "isSensitiveInput",
      "readConfig",
      "resolveSiteTranslationSettings",
    ],
    suspectedKeywords: [
      "password",
      "input",
      "overlay",
      "translation",
    ],
    failingSignals,
    confidence,
  }
}

export function evaluateInputTranslation(
  execution: InputTranslationExecution,
  expected: {
    shouldRequest: boolean
    shouldShowAfterFocus: boolean
    shouldShowAfterTyping?: boolean
    shouldWriteBack: boolean
    shouldPreserveCursor?: boolean
    expectedTask?: "translate"
    requireContext?: boolean
    maxLatencyMs?: number
  },
): EvaluationResult {
  const issues: BenchmarkIssue[] = []
  const expectedRequestCount = expected.shouldRequest ? 1 : 0
  const expectedOverlayAfterTyping = expected.shouldShowAfterTyping ?? expected.shouldShowAfterFocus
  const requestMatches = execution.requestCount === expectedRequestCount
  const focusOverlayMatches = execution.overlayVisibleAfterFocus === expected.shouldShowAfterFocus
  const typingOverlayMatches = execution.overlayVisibleAfterTyping === expectedOverlayAfterTyping
  const writebackMatches = expected.shouldWriteBack
    ? execution.translatedValue !== execution.initialValue && execution.writebackInputEventCount > 0
    : execution.translatedValue === execution.initialValue && execution.writebackInputEventCount === 0
  const contextMatches = !expected.requireContext
    || !expected.shouldRequest
    || !!execution.payloadHostname?.trim() && !!execution.payloadPageUrl?.trim()
  const taskMatches = !expected.expectedTask || execution.requestTask === expected.expectedTask
  const latencyMatches = !expected.shouldRequest || execution.translationLatencyMs <= (expected.maxLatencyMs ?? 350)
  const cursorMatches = !expected.shouldPreserveCursor || cursorPreserved(execution)

  if (!requestMatches) {
    addIssue(
      issues,
      expected.shouldRequest ? "critical" : "high",
      "Input translation request count did not match the scenario expectation.",
      `requestCount=${execution.requestCount}`,
    )
  }

  if (!focusOverlayMatches) {
    addIssue(
      issues,
      "high",
      "Input translation overlay visibility after focus was incorrect.",
      `overlayVisibleAfterFocus=${execution.overlayVisibleAfterFocus}`,
    )
  }

  if (!typingOverlayMatches) {
    addIssue(
      issues,
      "high",
      "Input translation overlay visibility after typing was incorrect.",
      `overlayVisibleAfterTyping=${execution.overlayVisibleAfterTyping}`,
    )
  }

  if (!writebackMatches) {
    addIssue(
      issues,
      expected.shouldWriteBack ? "critical" : "high",
      expected.shouldWriteBack
        ? "Input translation did not write the translated text back into the active field."
        : "Input translation mutated the field when it should have stayed untouched.",
      `translatedValue=${execution.translatedValue}, inputEvents=${execution.writebackInputEventCount}`,
    )
  }

  if (!taskMatches) {
    addIssue(
      issues,
      "high",
      "Input translation dispatched the wrong inline task.",
      `task=${execution.requestTask}`,
    )
  }

  if (!contextMatches) {
    addIssue(
      issues,
      "medium",
      "Input translation request context was missing page metadata needed for downstream judging.",
      `hostname=${execution.payloadHostname}, pageUrl=${execution.payloadPageUrl}`,
    )
  }

  if (!latencyMatches) {
    addIssue(
      issues,
      "medium",
      "Input translation exceeded the latency budget.",
      `latency=${execution.translationLatencyMs}ms`,
    )
  }

  if (!cursorMatches) {
    addIssue(
      issues,
      "medium",
      "Input translation did not preserve the cursor or selection range.",
      `before=${execution.selectionStartBefore}-${execution.selectionEndBefore}, after=${execution.selectionStartAfter}-${execution.selectionEndAfter}`,
    )
  }

  const allowedButtonLabels = new Set(["译", "Tr", "Translate", "inputTranslateButton"])
  if ((expected.shouldShowAfterFocus || expectedOverlayAfterTyping) && !allowedButtonLabels.has(execution.buttonLabel)) {
    addIssue(
      issues,
      "low",
      "Input translation overlay rendered an unexpected button label.",
      `buttonLabel=${execution.buttonLabel}`,
    )
  }

  const triggerAccuracy = requestMatches && focusOverlayMatches && typingOverlayMatches ? 10 : 4
  const contextQuality = contextMatches && taskMatches ? 10 : 5
  const interactionSafety = !expected.shouldRequest
    ? writebackMatches && execution.inputType === "password" ? 10 : 8
    : 10
  const latency = latencyMatches ? 10 : 5
  const correctness = writebackMatches ? 10 : 3
  const completeness = requestMatches && taskMatches ? 10 : 5
  const stability = 10
  const cursor_preservation = cursorMatches ? 10 : 4

  const scores = {
    correctness,
    completeness,
    stability,
    trigger_accuracy: triggerAccuracy,
    context_quality: contextQuality,
    interaction_safety: interactionSafety,
    latency,
    cursor_preservation,
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
      translatedValue: execution.translatedValue,
      initialValue: execution.initialValue,
      inputType: execution.inputType,
      buttonLabel: execution.buttonLabel,
      translationLatencyMs: execution.translationLatencyMs,
      patchHints: buildPatchHints(execution, expected),
    },
    nextActions: issues.map((issue) => issue.message),
  }
}
