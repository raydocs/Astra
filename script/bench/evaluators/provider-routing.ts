import type { BenchmarkIssue, EvaluationResult, PatchHintArtifact } from "../types"

export interface ProviderRoutingExecution {
  directAttemptCount: number
  relayAttemptCount: number
  fallbackUsed: boolean
  finalTransport: "direct" | "relay" | null
  attemptedTransports: Array<"direct" | "relay">
  translations: string[]
  errorCode: string | null
  relayRequest: {
    texts: string[]
    targetLang: string
    task?: string
    context?: Record<string, unknown>
    placeholderFormat?: string
    languageLevel?: string
  } | null
}

function addIssue(
  issues: BenchmarkIssue[],
  severity: BenchmarkIssue["severity"],
  message: string,
  evidence?: string,
) {
  issues.push({ severity, message, evidence })
}

function buildPatchHints(execution: ProviderRoutingExecution): PatchHintArtifact | undefined {
  const failingSignals: string[] = []

  if (execution.directAttemptCount !== 1) {
    failingSignals.push(`directAttemptCount=${execution.directAttemptCount}`)
  }

  if (execution.errorCode && execution.relayAttemptCount > 0 && !execution.fallbackUsed) {
    failingSignals.push(`errorCode=${execution.errorCode}`)
  }

  if (execution.attemptedTransports.length === 0) {
    failingSignals.push("no attempted transport metadata")
  }

  if (failingSignals.length === 0) {
    return undefined
  }

  return {
    suspectedFiles: [
      "src/utils/providers/router.ts",
      "src/entrypoints/background/index.ts",
      "src/types/messages.ts",
      "src/types/config.ts",
    ],
    suspectedSymbols: [
      "translateWithProviderDetailed",
      "translateWithProvider",
      "getProviderRoutingMetadataFromError",
      "handleTranslate",
    ],
    suspectedKeywords: [
      "provider",
      "fallback",
      "relay",
      "apiKey",
      "transport",
      "metadata",
    ],
    failingSignals,
    confidence: "high",
  }
}

export function evaluateProviderRouting(
  execution: ProviderRoutingExecution,
  expected: {
    shouldFallback: boolean
    expectedFinalTransport: "direct" | "relay" | null
    expectedErrorCode?: string | null
    expectRelaySuccess?: boolean
  },
): EvaluationResult {
  const issues: BenchmarkIssue[] = []
  const expectedAttemptedTransports = expected.shouldFallback ? "direct,relay" : "direct"
  const actualAttemptedTransports = execution.attemptedTransports.join(",")
  const expectRelaySuccess = expected.expectRelaySuccess ?? expected.expectedErrorCode == null
  const requestFidelity = execution.relayRequest
    && execution.relayRequest.texts.length === 1
    && execution.relayRequest.texts[0] === "hello"
    && execution.relayRequest.targetLang === "zh-CN"
    && execution.relayRequest.task === "translate"
    && execution.relayRequest.context?.pageTitle === "Provider fallback bench"
    && execution.relayRequest.placeholderFormat === "astra-rich-text-v1"
    && execution.relayRequest.languageLevel === "advanced"
    ? 10
    : expected.shouldFallback
      ? 4
      : 10

  if (execution.directAttemptCount !== 1) {
    addIssue(issues, "critical", "Direct provider transport was not attempted exactly once.", `directAttemptCount=${execution.directAttemptCount}`)
  }

  if (expected.shouldFallback && execution.relayAttemptCount !== 1) {
    addIssue(issues, "high", "Relay transport was not attempted exactly once after direct failure.", `relayAttemptCount=${execution.relayAttemptCount}`)
  }

  if (!expected.shouldFallback && execution.relayAttemptCount !== 0) {
    addIssue(issues, "high", "Relay transport should not have been attempted for a non-fallback-eligible error.", `relayAttemptCount=${execution.relayAttemptCount}`)
  }

  if (execution.fallbackUsed !== expected.shouldFallback || execution.finalTransport !== expected.expectedFinalTransport) {
    addIssue(issues, "high", "Provider routing did not end on the expected transport path.", `fallbackUsed=${execution.fallbackUsed}, finalTransport=${execution.finalTransport}`)
  }

  if (actualAttemptedTransports !== expectedAttemptedTransports) {
    addIssue(issues, "high", "Provider routing metadata did not record the expected attempted transport chain.", actualAttemptedTransports)
  }

  if (expected.shouldFallback) {
    if (expectRelaySuccess) {
      if (execution.translations.length !== 1 || execution.translations[0] !== "RELAY:hello") {
        addIssue(issues, "high", "Provider fallback chain did not return the relay translation result.", JSON.stringify(execution.translations))
      }
    } else if (execution.translations.length > 0) {
      addIssue(issues, "medium", "Provider fallback exhaustion should not surface translated output after the terminal relay error.", JSON.stringify(execution.translations))
    }

    if (requestFidelity !== 10) {
      addIssue(issues, "high", "Provider fallback chain did not preserve request fields when dispatching to relay.")
    }
  }

  const expectedErrorCode = expected.expectedErrorCode ?? null
  if (execution.errorCode !== expectedErrorCode) {
    addIssue(issues, "high", "Provider routing returned the wrong terminal error classification.", `errorCode=${execution.errorCode}, expected=${expectedErrorCode}`)
  }

  const scores = {
    correctness: expected.shouldFallback
      ? expectRelaySuccess
        ? execution.translations[0] === "RELAY:hello" ? 10 : 4
        : execution.errorCode === expectedErrorCode && execution.translations.length === 0 ? 10 : 4
      : execution.errorCode === expectedErrorCode ? 10 : 4,
    completeness: execution.fallbackUsed === expected.shouldFallback ? 10 : 4,
    stability: issues.some((issue) => issue.severity === "critical") ? 4 : 10,
    fallback_trigger: actualAttemptedTransports === expectedAttemptedTransports ? 10 : 4,
    request_fidelity: requestFidelity,
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
      translations: execution.translations,
      errorCode: execution.errorCode,
      attemptedTransports: execution.attemptedTransports,
      relayRequest: execution.relayRequest,
      patchHints: buildPatchHints(execution),
    },
    nextActions: issues.map((issue) => issue.message),
  }
}
