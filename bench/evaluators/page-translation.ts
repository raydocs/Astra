import type { EvaluationResult, BenchmarkIssue, PatchHintArtifact } from "../types"

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
  payloadContext?: Record<string, unknown> | null
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

function isSanitizedPrivacyContext(context: Record<string, unknown> | null | undefined) {
  if (!context) return false
  const keys = Object.keys(context).sort()
  const allowedKeys = ["hostname", "pageUrl"]
  const onlyAllowedKeys = keys.every((key) => allowedKeys.includes(key))
  const pageUrl = typeof context.pageUrl === "string" ? context.pageUrl : ""

  return onlyAllowedKeys
    && typeof context.hostname === "string"
    && pageUrl.length > 0
    && !pageUrl.includes("?")
    && !pageUrl.includes("#")
}

function buildPatchHints(
  execution: PageTranslationExecution,
  options: {
    requireTranslationOnly?: boolean
    requirePrivacySanitization?: boolean
  },
  issues: BenchmarkIssue[],
): PatchHintArtifact | undefined {
  if (issues.length === 0) {
    return undefined
  }

  const suspectedFiles = new Set<string>([
    "src/entrypoints/content/page-translate.ts",
    "src/entrypoints/content/translation-context.ts",
    "src/entrypoints/content/page-translate-registry.ts",
    "src/utils/dom/extraction.ts",
    "src/utils/dom/traversal.ts",
  ])
  const suspectedSymbols = new Set<string>([
    "startPageTranslation",
    "stopPageTranslation",
    "resolveExtractionPlan",
  ])
  const suspectedKeywords = new Set<string>([
    "failedBlocks",
    "translation-only",
    "interactive",
    "expectedNodeCount",
  ])
  const failingSignals: string[] = []

  if (execution.translatedNodeCount !== execution.expectedNodeCount) {
    failingSignals.push("translated node count diverged from extraction plan")
    suspectedKeywords.add("coverage")
  }

  if (execution.skippedInteractiveTranslations > 0) {
    failingSignals.push("interactive nodes received translation markers")
    suspectedKeywords.add("interactive")
  }

  if (execution.failedBlocks > 0) {
    failingSignals.push("page translation session reported failed blocks")
    suspectedKeywords.add("provider error")
    suspectedKeywords.add("graceful")
  }

  if (options.requireTranslationOnly && execution.hiddenSourceCount !== execution.translatedNodeCount) {
    failingSignals.push("translation-only wrappers failed to hide all source nodes")
    suspectedKeywords.add("hiddenSourceCount")
  }

  if (options.requirePrivacySanitization && !isSanitizedPrivacyContext(execution.payloadContext)) {
    failingSignals.push("privacy context leaked")
    suspectedFiles.add("src/utils/privacy.ts")
    suspectedKeywords.add("privacy")
    suspectedKeywords.add("sanitizeTranslationContext")
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

export function evaluatePageTranslation(
  execution: PageTranslationExecution,
  options: {
    requireTranslationOnly?: boolean
    requirePrivacySanitization?: boolean
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

  if (options.requirePrivacySanitization && !isSanitizedPrivacyContext(execution.payloadContext)) {
    addIssue(
      issues,
      "high",
      "Page translation privacy mode leaked more context than the sanitized contract allows.",
      JSON.stringify(execution.payloadContext),
    )
  }

  const contextSafety = !options.requirePrivacySanitization || isSanitizedPrivacyContext(execution.payloadContext)
    ? 10
    : 4

  const scores = {
    correctness,
    completeness,
    stability,
    coverage: Math.min(10, coverage),
    dom_preservation: domPreservation,
    context_safety: contextSafety,
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
      patchHints: buildPatchHints(execution, options, issues),
    },
    nextActions: issues.map((issue) => issue.message),
  }
}
