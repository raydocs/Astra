import type { BenchmarkIssue, EvaluationResult, PatchHintArtifact } from "../types"
import type { EpubReaderModeSummary } from "../scenarios/helpers/epub-reader"

export interface EpubTranslationExecution {
  fixtureName: string
  chapterCount: number
  translationRequestCount: number
  activeChapterTitle: string
  resumedChapterTitle: string | null
  readingStateRestored: boolean
  bilingual: EpubReaderModeSummary
  translationOnly: EpubReaderModeSummary
  notes: string[]
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
  execution: EpubTranslationExecution,
  expected: {
    expectedChapterCount?: number
    expectedActiveChapterTitle?: string
    expectedTranslationRequestCount?: number
    requireReadingStateRestored?: boolean
  },
): PatchHintArtifact | undefined {
  const failingSignals: string[] = []
  if (expected.expectedChapterCount !== undefined && execution.chapterCount !== expected.expectedChapterCount) {
    failingSignals.push(`chapterCount=${execution.chapterCount}`)
  }
  if (expected.expectedActiveChapterTitle && execution.activeChapterTitle !== expected.expectedActiveChapterTitle) {
    failingSignals.push(`activeChapterTitle=${execution.activeChapterTitle}`)
  }
  if (expected.expectedTranslationRequestCount !== undefined && execution.translationRequestCount !== expected.expectedTranslationRequestCount) {
    failingSignals.push(`translationRequestCount=${execution.translationRequestCount}`)
  }
  if (expected.requireReadingStateRestored && !execution.readingStateRestored) {
    failingSignals.push("readingStateRestored=false")
  }
  if (failingSignals.length === 0) {
    return undefined
  }
  return {
    suspectedFiles: [
      "src/entrypoints/epub-reader/EpubReaderApp.tsx",
      "src/entrypoints/epub-reader/main.tsx",
    ],
    suspectedSymbols: [
      "EpubReaderApp",
      "openChapter",
      "loadBook",
      "chapterGenRef",
    ],
    suspectedKeywords: [
      "epub",
      "chapter",
      "translation-only",
      "bilingual",
      "resume",
    ],
    failingSignals,
    confidence: "high",
  }
}

export function evaluateEpubTranslation(
  execution: EpubTranslationExecution,
  expected: {
    expectedChapterCount?: number
    expectedActiveChapterTitle?: string
    expectedTranslationRequestCount?: number
    requireReadingStateRestored?: boolean
  },
): EvaluationResult {
  const issues: BenchmarkIssue[] = []
  const chapterCountMatches = expected.expectedChapterCount === undefined || execution.chapterCount === expected.expectedChapterCount
  const activeChapterMatches = expected.expectedActiveChapterTitle === undefined || execution.activeChapterTitle === expected.expectedActiveChapterTitle
  const requestMatches = expected.expectedTranslationRequestCount === undefined || execution.translationRequestCount === expected.expectedTranslationRequestCount
  const readingStateMatches = !expected.requireReadingStateRestored || execution.readingStateRestored
  const modeCoverageMatches = execution.bilingual.chapterCount > 0
    && execution.translationOnly.chapterCount > 0
    && execution.bilingual.translationCount > 0
    && execution.translationOnly.translationCount > 0

  if (!chapterCountMatches) {
    pushIssue(issues, "critical", "EPUB reader rendered an unexpected chapter count.", `chapterCount=${execution.chapterCount}`)
  }
  if (!activeChapterMatches) {
    pushIssue(issues, "high", "EPUB reader opened the wrong active chapter.", `activeChapterTitle=${execution.activeChapterTitle}`)
  }
  if (!requestMatches) {
    pushIssue(issues, "high", "EPUB reader translation batching did not match expectations.", `translationRequestCount=${execution.translationRequestCount}`)
  }
  if (!readingStateMatches) {
    pushIssue(issues, "high", "EPUB reader did not restore the expected reading state.", `resumedChapterTitle=${execution.resumedChapterTitle}`)
  }
  if (!modeCoverageMatches) {
    pushIssue(issues, "high", "EPUB reader did not render both bilingual and translation-only chapter views.")
  }

  const scores = {
    correctness: chapterCountMatches && activeChapterMatches ? 10 : 4,
    completeness: modeCoverageMatches ? 10 : 4,
    stability: readingStateMatches ? 10 : 4,
    chapter_navigation: activeChapterMatches ? 10 : 4,
    translation_batching: requestMatches ? 10 : 4,
  }

  const baseTotal = Math.round((Object.values(scores).reduce((sum, score) => sum + score, 0) / (Object.keys(scores).length * 10)) * 100)
  const penalty = issues.reduce((sum, issue) => {
    switch (issue.severity) {
      case "critical": return sum + 40
      case "high": return sum + 20
      case "medium": return sum + 10
      case "low": return sum + 5
      default: return sum
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
      activeChapterTitle: execution.activeChapterTitle,
      resumedChapterTitle: execution.resumedChapterTitle,
      chapterCount: execution.chapterCount,
      translationRequestCount: execution.translationRequestCount,
      notes: execution.notes,
      patchHints: buildPatchHints(execution, expected),
    },
    nextActions: issues.map((issue) => issue.message),
  }
}
