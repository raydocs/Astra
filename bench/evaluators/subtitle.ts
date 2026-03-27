import type { BenchmarkIssue, EvaluationResult, PatchHintArtifact } from "../types"

export interface SubtitleExecution {
  requestCount: number
  translatedCueCount: number
  translatedCueTexts: string[]
  astraTrackCount: number
  astraTrackLabels: string[]
  sourceModeBefore: string | null
  sourceModeAfter: string | null
  payloadContext: Record<string, unknown> | null
  removedTrackCount: number
  requestBatchSizes: number[]
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
  execution: SubtitleExecution,
  expected: {
    shouldTranslate: boolean
    expectedCueCount?: number
    expectedRemovedTracks?: number
    expectSourceModeRestored?: boolean
    requirePrivacySanitization?: boolean
  },
): PatchHintArtifact | undefined {
  const failingSignals: string[] = []

  if (execution.requestCount !== (expected.shouldTranslate ? 1 : 0)) {
    failingSignals.push(`requestCount=${execution.requestCount}`)
  }

  if (expected.shouldTranslate && execution.translatedCueCount !== (expected.expectedCueCount ?? execution.translatedCueCount)) {
    failingSignals.push(`translatedCueCount=${execution.translatedCueCount}`)
  }

  if (expected.shouldTranslate
    ? execution.astraTrackCount !== 1 || !execution.astraTrackLabels.every((label) => label.startsWith("Astra: "))
    : execution.astraTrackCount !== 0) {
    failingSignals.push(`astraTrackCount=${execution.astraTrackCount}`)
  }

  if (expected.expectSourceModeRestored && execution.sourceModeBefore !== execution.sourceModeAfter) {
    failingSignals.push(`sourceMode=${execution.sourceModeBefore}->${execution.sourceModeAfter}`)
  }

  if (expected.requirePrivacySanitization && !isSanitizedPrivacyContext(execution.payloadContext)) {
    failingSignals.push("privacy context leaked")
  }

  if (expected.expectedRemovedTracks !== undefined && execution.removedTrackCount !== expected.expectedRemovedTracks) {
    failingSignals.push(`removedTrackCount=${execution.removedTrackCount}`)
  }

  if (failingSignals.length === 0) {
    return undefined
  }

  const confidence: PatchHintArtifact["confidence"] =
    expected.requirePrivacySanitization || expected.expectedCueCount !== undefined || expected.expectSourceModeRestored
      ? "high"
      : "medium"

  return {
    suspectedFiles: [
      "src/entrypoints/content/subtitle-translate.ts",
      "src/entrypoints/content/translation-context.ts",
      "src/utils/translate/translate.ts",
      "src/utils/privacy.ts",
      "src/utils/storage/config.ts",
    ],
    suspectedSymbols: [
      "translatePageSubtitles",
      "removeTranslatedSubtitles",
      "getDocumentTranslationContext",
      "sanitizeTranslationContext",
      "translateTexts",
    ],
    suspectedKeywords: [
      "Astra:",
      "privacy",
      "track",
      "cue",
    ],
    failingSignals,
    confidence,
  }
}

function isSanitizedPrivacyContext(context: Record<string, unknown> | null) {
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

export function evaluateSubtitle(
  execution: SubtitleExecution,
  expected: {
    shouldTranslate: boolean
    expectedCueCount?: number
    expectedRemovedTracks?: number
    expectSourceModeRestored?: boolean
    requirePrivacySanitization?: boolean
  },
): EvaluationResult {
  const issues: BenchmarkIssue[] = []
  const cueCountMatches = !expected.shouldTranslate
    || execution.translatedCueCount === (expected.expectedCueCount ?? execution.translatedCueCount)
  const requestMatches = execution.requestCount === (expected.shouldTranslate ? 1 : 0)
  const trackCountMatches = expected.shouldTranslate
    ? execution.astraTrackCount === 1 && execution.astraTrackLabels.every((label) => label.startsWith("Astra: "))
    : execution.astraTrackCount === 0
  const removalMatches = expected.expectedRemovedTracks === undefined
    || execution.removedTrackCount === expected.expectedRemovedTracks
  const sourceModeMatches = !expected.expectSourceModeRestored
    || execution.sourceModeBefore === execution.sourceModeAfter
  const privacyMatches = !expected.requirePrivacySanitization || isSanitizedPrivacyContext(execution.payloadContext)

  if (!requestMatches) {
    addIssue(
      issues,
      expected.shouldTranslate ? "critical" : "high",
      "Subtitle translation request count did not match the scenario expectation.",
      `requestCount=${execution.requestCount}`,
    )
  }

  if (!cueCountMatches) {
    addIssue(
      issues,
      "critical",
      "Subtitle translation did not produce the expected cue count.",
      `translatedCueCount=${execution.translatedCueCount}`,
    )
  }

  if (!trackCountMatches) {
    addIssue(
      issues,
      "high",
      "Subtitle track management did not leave the expected Astra track footprint.",
      `astraTrackCount=${execution.astraTrackCount}, labels=${execution.astraTrackLabels.join(", ")}`,
    )
  }

  if (!sourceModeMatches) {
    addIssue(
      issues,
      "high",
      "Subtitle translation did not restore the source track mode after translation.",
      `before=${execution.sourceModeBefore}, after=${execution.sourceModeAfter}`,
    )
  }

  if (!privacyMatches) {
    addIssue(
      issues,
      "high",
      "Subtitle privacy mode leaked more context than the sanitized contract allows.",
      JSON.stringify(execution.payloadContext),
    )
  }

  if (!removalMatches) {
    addIssue(
      issues,
      "high",
      "Subtitle cleanup removed an unexpected number of Astra tracks.",
      `removedTrackCount=${execution.removedTrackCount}`,
    )
  }

  const correctness = requestMatches && cueCountMatches ? 10 : 3
  const completeness = trackCountMatches && removalMatches ? 10 : 5
  const stability = 10
  const trackManagement = trackCountMatches && sourceModeMatches ? 10 : 4
  const contextSafety = privacyMatches ? 10 : 4

  const scores = {
    correctness,
    completeness,
    stability,
    track_management: trackManagement,
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
      translatedCueTexts: execution.translatedCueTexts,
      astraTrackLabels: execution.astraTrackLabels,
      requestBatchSizes: execution.requestBatchSizes,
      payloadContext: execution.payloadContext,
      patchHints: buildPatchHints(execution, expected),
    },
    nextActions: issues.map((issue) => issue.message),
  }
}
