import type { BenchmarkIssue, EvaluationResult, PatchHintArtifact } from "../types"
import type { SubtitleFormat } from "../../../src/entrypoints/subtitle-reader/subtitle-parser"

export interface SubtitleFileExecution {
  fileCount: number
  fileNames: string[]
  formatsSeen: SubtitleFormat[]
  cueCount: number
  translationRequestCount: number
  translatedCueCount: number
  previewSectionCount: number
  previewRowCount: number
  exportFormats: Array<"srt" | "vtt">
  sourceTimingPreserved: boolean
  exportTimingPreserved: boolean
  warnings: string[]
  previewWarnings: string[]
  translateCallContexts: Array<Record<string, unknown> | null>
  privacyContextLeakCount: number
  fileSummaries: Array<{
    fileName: string
    format: SubtitleFormat
    cueCount: number
    warnings: string[]
    previewMode: "bilingual" | "translation-only"
  }>
}

function pushIssue(
  issues: BenchmarkIssue[],
  severity: BenchmarkIssue["severity"],
  message: string,
  evidence?: string,
) {
  issues.push({ severity, message, evidence })
}

function hasIsolatedSubtitleFilePrivacyContext(execution: SubtitleFileExecution) {
  return execution.privacyContextLeakCount === 0
    && execution.translateCallContexts.every((context) => context === null)
}

function buildPatchHints(
  execution: SubtitleFileExecution,
  expected: {
    expectedFileCount?: number
    expectedCueCount?: number
    expectedFormats?: SubtitleFormat[]
    expectedExportFormats?: Array<"srt" | "vtt">
    expectedRequestCount?: number
    expectedPreviewSections?: number
    expectedWarningsAtLeast?: number
    requireTimingPreserved?: boolean
    requirePrivacyIsolation?: boolean
  },
): PatchHintArtifact | undefined {
  const failingSignals: string[] = []

  if (expected.expectedFileCount !== undefined && execution.fileCount !== expected.expectedFileCount) {
    failingSignals.push(`fileCount=${execution.fileCount}`)
  }
  if (expected.expectedCueCount !== undefined && execution.cueCount !== expected.expectedCueCount) {
    failingSignals.push(`cueCount=${execution.cueCount}`)
  }
  if (expected.expectedFormats && expected.expectedFormats.some((format) => !execution.formatsSeen.includes(format))) {
    failingSignals.push(`formatsSeen=${execution.formatsSeen.join(",")}`)
  }
  if (expected.expectedExportFormats && expected.expectedExportFormats.some((format) => !execution.exportFormats.includes(format))) {
    failingSignals.push(`exportFormats=${execution.exportFormats.join(",")}`)
  }
  if (expected.expectedRequestCount !== undefined && execution.translationRequestCount !== expected.expectedRequestCount) {
    failingSignals.push(`translationRequestCount=${execution.translationRequestCount}`)
  }
  if (expected.expectedPreviewSections !== undefined && execution.previewSectionCount !== expected.expectedPreviewSections) {
    failingSignals.push(`previewSectionCount=${execution.previewSectionCount}`)
  }
  if (expected.expectedWarningsAtLeast !== undefined && execution.warnings.length < expected.expectedWarningsAtLeast) {
    failingSignals.push(`warnings=${execution.warnings.length}`)
  }
  if (expected.requireTimingPreserved && (!execution.sourceTimingPreserved || !execution.exportTimingPreserved)) {
    failingSignals.push(`timingPreserved=${execution.sourceTimingPreserved}/${execution.exportTimingPreserved}`)
  }
  if (expected.requirePrivacyIsolation && !hasIsolatedSubtitleFilePrivacyContext(execution)) {
    failingSignals.push(`privacyContextLeakCount=${execution.privacyContextLeakCount}`)
  }

  if (failingSignals.length === 0) {
    return undefined
  }

  return {
    suspectedFiles: [
      "src/entrypoints/subtitle-reader/subtitle-parser.ts",
      "src/entrypoints/subtitle-reader/SubtitleReaderApp.tsx",
      "src/entrypoints/subtitle-reader/main.tsx",
      "src/entrypoints/subtitle-reader/index.html",
      "src/utils/privacy.ts",
    ],
    suspectedSymbols: [
      "parseSubtitles",
      "exportBilingualSrt",
      "exportBilingualVtt",
      "SubtitleReaderApp",
      "sanitizeTranslationContext",
    ],
    suspectedKeywords: [
      "subtitle",
      "SRT",
      "VTT",
      "bilingual",
      "preview",
      "export",
      "privacy",
      "context",
    ],
    failingSignals,
    confidence: "high",
  }
}

export function evaluateSubtitleFile(
  execution: SubtitleFileExecution,
  expected: {
    expectedFileCount?: number
    expectedCueCount?: number
    expectedFormats?: SubtitleFormat[]
    expectedExportFormats?: Array<"srt" | "vtt">
    expectedRequestCount?: number
    expectedPreviewSections?: number
    expectedWarningsAtLeast?: number
    requireTimingPreserved?: boolean
    requirePrivacyIsolation?: boolean
  },
): EvaluationResult {
  const issues: BenchmarkIssue[] = []
  const fileCountMatches = expected.expectedFileCount === undefined || execution.fileCount === expected.expectedFileCount
  const cueCountMatches = expected.expectedCueCount === undefined || execution.cueCount === expected.expectedCueCount
  const formatMatches = !expected.expectedFormats || expected.expectedFormats.every((format) => execution.formatsSeen.includes(format))
  const exportMatches = !expected.expectedExportFormats || expected.expectedExportFormats.every((format) => execution.exportFormats.includes(format))
  const requestMatches = expected.expectedRequestCount === undefined || execution.translationRequestCount === expected.expectedRequestCount
  const sectionMatches = expected.expectedPreviewSections === undefined || execution.previewSectionCount === expected.expectedPreviewSections
  const warningsMatches = expected.expectedWarningsAtLeast === undefined || execution.warnings.length >= expected.expectedWarningsAtLeast
  const timingMatches = !expected.requireTimingPreserved || (execution.sourceTimingPreserved && execution.exportTimingPreserved)
  const privacyMatches = !expected.requirePrivacyIsolation || hasIsolatedSubtitleFilePrivacyContext(execution)

  if (!fileCountMatches) {
    pushIssue(issues, "critical", "Subtitle-file translation ingested an unexpected file count.", `fileCount=${execution.fileCount}`)
  }
  if (!cueCountMatches) {
    pushIssue(issues, "critical", "Subtitle-file translation parsed an unexpected cue count.", `cueCount=${execution.cueCount}`)
  }
  if (!formatMatches) {
    pushIssue(issues, "high", "Subtitle-file translation did not cover the expected subtitle formats.", `formatsSeen=${execution.formatsSeen.join(",")}`)
  }
  if (!exportMatches) {
    pushIssue(issues, "high", "Subtitle-file translation did not produce the expected export formats.", `exportFormats=${execution.exportFormats.join(",")}`)
  }
  if (!requestMatches) {
    pushIssue(issues, "high", "Subtitle-file translation did not issue the expected translation batch count.", `translationRequestCount=${execution.translationRequestCount}`)
  }
  if (!sectionMatches) {
    pushIssue(issues, "medium", "Subtitle-file preview rendered an unexpected number of sections.", `previewSectionCount=${execution.previewSectionCount}`)
  }
  if (!warningsMatches) {
    pushIssue(issues, "high", "Subtitle-file holdout did not surface the expected warnings.", `warnings=${execution.warnings.length}`)
  }
  if (!timingMatches) {
    pushIssue(issues, "high", "Subtitle-file translation did not preserve source/export timing.", `timingPreserved=${execution.sourceTimingPreserved}/${execution.exportTimingPreserved}`)
  }
  if (!privacyMatches) {
    pushIssue(issues, "high", "Subtitle-file privacy mode leaked page or selection context into local file translation requests.", `privacyContextLeakCount=${execution.privacyContextLeakCount}`)
  }

  const scores = {
    correctness: fileCountMatches && cueCountMatches && requestMatches ? 10 : 4,
    completeness: formatMatches && exportMatches && sectionMatches ? 10 : 5,
    stability: timingMatches ? 10 : 4,
    format_coverage: formatMatches ? 10 : 4,
    timing_safety: timingMatches ? 10 : 4,
    privacy_isolation: privacyMatches ? 10 : 4,
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
      fileNames: execution.fileNames,
      formatsSeen: execution.formatsSeen,
      warnings: execution.warnings,
      previewWarnings: execution.previewWarnings,
      translateCallContexts: execution.translateCallContexts,
      privacyContextLeakCount: execution.privacyContextLeakCount,
      fileSummaries: execution.fileSummaries,
      patchHints: buildPatchHints(execution, expected),
    },
    nextActions: issues.map((issue) => issue.message),
  }
}
