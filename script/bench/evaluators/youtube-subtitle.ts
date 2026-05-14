import type { BenchmarkIssue, EvaluationResult, PatchHintArtifact } from "../types"

export interface YouTubeSubtitleSnapshot {
  phase: string
  sourceText: string
  translationText: string | null
  translationNodeCount: number
  stateLabel: string | null
}

export interface YouTubeSubtitleExecution {
  requestCount: number
  uniqueCaptionTexts: string[]
  translatedCaptionTexts: string[]
  duplicateCaptionUpdateCount: number
  rapidUpdateCount: number
  pauseEvents: number
  seekEvents: number
  seekPauseStable: boolean
  captionSnapshots: YouTubeSubtitleSnapshot[]
  payloadContext: Record<string, unknown> | null
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
  execution: YouTubeSubtitleExecution,
  issues: BenchmarkIssue[],
): PatchHintArtifact | undefined {
  if (issues.length === 0) return undefined

  const failingSignals: string[] = []
  const suspectedFiles = new Set<string>([
    "src/entrypoints/content/video-platforms/youtube.ts",
    "src/entrypoints/content/video-platforms/index.ts",
    "src/entrypoints/content/video-platforms/types.ts",
    "bench/scenarios/youtube-subtitle.ts",
    "bench-live/scenarios/youtube-subtitle-basic.ts",
    "bench-live/scenarios/holdout/youtube-subtitle-race.ts",
  ])
  const suspectedSymbols = new Set<string>([
    "youtubePlatform",
    "extractCaptionText",
    "startVideoSubtitleTranslation",
    "handleCaptionMutation",
    "waitForElement",
  ])
  const suspectedKeywords = new Set<string>([
    "ytp-caption-segment",
    "dedupe",
    "pause",
    "seek",
    "translation cache",
  ])

  if (execution.requestCount !== execution.uniqueCaptionTexts.length) {
    failingSignals.push(`requestCount=${execution.requestCount}`)
    suspectedKeywords.add("pendingTranslations")
  }

  if (!execution.seekPauseStable) {
    failingSignals.push("seekPauseStable=false")
    suspectedKeywords.add("seek")
    suspectedKeywords.add("pause")
  }

  if (execution.translatedCaptionTexts.length < execution.uniqueCaptionTexts.length) {
    failingSignals.push("missing translated captions")
    suspectedKeywords.add("subtitle injection")
  }

  return {
    suspectedFiles: [...suspectedFiles],
    suspectedSymbols: [...suspectedSymbols],
    suspectedKeywords: [...suspectedKeywords],
    failingSignals,
    confidence: issues.some((issue) => issue.severity === "critical") ? "high" : "medium",
  }
}

export function evaluateYouTubeSubtitle(
  execution: YouTubeSubtitleExecution,
): EvaluationResult {
  const issues: BenchmarkIssue[] = []

  if (execution.uniqueCaptionTexts.length === 0) {
    pushIssue(
      issues,
      "critical",
      "The scenario never observed a normalized YouTube caption string.",
      "uniqueCaptionTexts is empty",
    )
  }

  if (execution.requestCount !== execution.uniqueCaptionTexts.length) {
    pushIssue(
      issues,
      execution.requestCount > execution.uniqueCaptionTexts.length ? "high" : "critical",
      "YouTube subtitle translation request count did not match the number of unique caption states.",
      `requestCount=${execution.requestCount}, unique=${execution.uniqueCaptionTexts.length}`,
    )
  }

  if (execution.translatedCaptionTexts.length < execution.uniqueCaptionTexts.length) {
    pushIssue(
      issues,
      "critical",
      "Not every unique caption state produced a translated overlay.",
      `translated=${execution.translatedCaptionTexts.length}, unique=${execution.uniqueCaptionTexts.length}`,
    )
  }

  if (execution.duplicateCaptionUpdateCount === 0) {
    pushIssue(
      issues,
      "medium",
      "The scenario did not exercise duplicate caption updates, so dedupe pressure was not demonstrated.",
      "duplicateCaptionUpdateCount=0",
    )
  }

  if (execution.pauseEvents === 0 || execution.seekEvents === 0) {
    pushIssue(
      issues,
      "high",
      "The scenario did not exercise both pause and seek-style caption stability.",
      `pauseEvents=${execution.pauseEvents}, seekEvents=${execution.seekEvents}`,
    )
  }

  if (!execution.seekPauseStable) {
    pushIssue(
      issues,
      "critical",
      "YouTube subtitle overlays were not stable across the simulated pause/seek transitions.",
      "seekPauseStable=false",
    )
  }

  const sourceCoverage = execution.uniqueCaptionTexts.length > 0
    && execution.captionSnapshots.some((snapshot) => snapshot.sourceText.length > 0)
  const correctness = execution.requestCount === execution.uniqueCaptionTexts.length && sourceCoverage ? 10 : 4
  const dedupe = execution.requestCount === execution.uniqueCaptionTexts.length && execution.duplicateCaptionUpdateCount > 0 ? 10 : 5
  const stability = execution.seekPauseStable ? 10 : 4
  const coverage = execution.translatedCaptionTexts.length >= execution.uniqueCaptionTexts.length ? 10 : 5
  const interactionSafety = execution.pauseEvents > 0 && execution.seekEvents > 0 ? 10 : 4
  const captionManagement = execution.captionSnapshots.every((snapshot) => snapshot.translationNodeCount <= 1) ? 10 : 5
  const completeness = Math.min(10, Math.round((dedupe + coverage) / 2))

  const scores = {
    correctness,
    completeness,
    dedupe,
    stability,
    coverage,
    interaction_safety: interactionSafety,
    caption_management: captionManagement,
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
      requestCount: execution.requestCount,
      uniqueCaptionTexts: execution.uniqueCaptionTexts,
      translatedCaptionTexts: execution.translatedCaptionTexts,
      duplicateCaptionUpdateCount: execution.duplicateCaptionUpdateCount,
      rapidUpdateCount: execution.rapidUpdateCount,
      pauseEvents: execution.pauseEvents,
      seekEvents: execution.seekEvents,
      seekPauseStable: execution.seekPauseStable,
      payloadContext: execution.payloadContext,
      captionSnapshots: execution.captionSnapshots,
      patchHints: buildPatchHints(execution, issues),
    },
    nextActions: issues.map((issue) => issue.message),
  }
}
