import type { BenchmarkIssue, EvaluationResult, PatchHintArtifact } from "../types"
import type { PdfReaderModeSummary } from "../scenarios/helpers/pdf-reader"

export interface PdfTranslationExecution {
  fixtureName: string
  pageCount: number
  blockCount: number
  translationRequestCount: number
  bilingual: PdfReaderModeSummary
  translationOnly: PdfReaderModeSummary
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

function buildPatchHints(execution: PdfTranslationExecution, issues: BenchmarkIssue[]): PatchHintArtifact | undefined {
  if (issues.length === 0) {
    return undefined
  }

  const failingSignals: string[] = []
  const suspectedFiles = new Set<string>([
    "src/entrypoints/pdf-reader/PdfReaderApp.tsx",
    "src/entrypoints/pdf-reader/pdf-extractor.ts",
    "src/entrypoints/pdf-reader/pdf-translator.ts",
    "src/entrypoints/content/pdf-detect.ts",
  ])
  const suspectedSymbols = new Set<string>([
    "PdfReaderApp",
    "extractPdfPages",
    "translatePdfPage",
    "detectAndShowPdfBanner",
  ])
  const suspectedKeywords = new Set<string>([
    "pdf",
    "bilingual",
    "translation-only",
    "page-count",
  ])

  if (execution.pageCount <= 0) {
    failingSignals.push("no pages extracted")
  }

  if (execution.blockCount <= 0) {
    failingSignals.push("no text blocks extracted")
  }

  if (execution.translationRequestCount < 1) {
    failingSignals.push("no translation requests were issued")
  }

  if (execution.bilingual.sourceCount !== execution.blockCount || execution.bilingual.translationCount !== execution.blockCount) {
    failingSignals.push("bilingual rendering did not preserve source/translation parity")
  }

  if (execution.translationOnly.sourceCount !== 0 || execution.translationOnly.translationCount !== execution.blockCount) {
    failingSignals.push("translation-only rendering leaked source text")
  }

  return {
    suspectedFiles: [...suspectedFiles],
    suspectedSymbols: [...suspectedSymbols],
    suspectedKeywords: [...suspectedKeywords],
    failingSignals,
    confidence: "medium",
  }
}

function matchesExpectedPrefix(values: string[], prefix: string) {
  return values.length > 0 && values.every((value) => value.startsWith(prefix))
}

export function evaluatePdfTranslation(
  execution: PdfTranslationExecution,
): EvaluationResult {
  const issues: BenchmarkIssue[] = []
  const pageCountMatches = execution.pageCount === execution.bilingual.pageCount
    && execution.pageCount === execution.translationOnly.pageCount
    && execution.pageCount > 0
  const blockCountMatches = execution.blockCount === execution.bilingual.blockCount
    && execution.blockCount === execution.translationOnly.blockCount
    && execution.blockCount > 0
  const requestMatches = execution.translationRequestCount === execution.pageCount
  const bilingualMatches = execution.bilingual.sourceCount === execution.blockCount
    && execution.bilingual.translationCount === execution.blockCount
    && execution.bilingual.sectionCount === 1
  const translationOnlyMatches = execution.translationOnly.sourceCount === 0
    && execution.translationOnly.translationCount === execution.blockCount
    && execution.translationOnly.sectionCount === 1
  const translationPrefixMatches = matchesExpectedPrefix(execution.bilingual.translationTexts, "ZH:")
    && matchesExpectedPrefix(execution.translationOnly.translationTexts, "ZH:")

  if (!pageCountMatches) {
    addIssue(
      issues,
      "critical",
      "PDF page count did not match the bilingual/translation-only render summary.",
      `pageCount=${execution.pageCount}, bilingual=${execution.bilingual.pageCount}, translationOnly=${execution.translationOnly.pageCount}`,
    )
  }

  if (!blockCountMatches) {
    addIssue(
      issues,
      "critical",
      "PDF block count did not match the rendered reader summaries.",
      `blockCount=${execution.blockCount}, bilingual=${execution.bilingual.blockCount}, translationOnly=${execution.translationOnly.blockCount}`,
    )
  }

  if (!requestMatches) {
    addIssue(
      issues,
      "high",
      "PDF translation request count did not line up with page batching.",
      `requestCount=${execution.translationRequestCount}, pageCount=${execution.pageCount}`,
    )
  }

  if (!bilingualMatches) {
    addIssue(
      issues,
      "high",
      "Bilingual PDF rendering did not keep source and translation blocks aligned.",
      `sourceCount=${execution.bilingual.sourceCount}, translationCount=${execution.bilingual.translationCount}, sections=${execution.bilingual.sectionCount}`,
    )
  }

  if (!translationOnlyMatches) {
    addIssue(
      issues,
      "high",
      "Translation-only PDF rendering leaked source text or missing translations.",
      `sourceCount=${execution.translationOnly.sourceCount}, translationCount=${execution.translationOnly.translationCount}, sections=${execution.translationOnly.sectionCount}`,
    )
  }

  if (!translationPrefixMatches) {
    addIssue(
      issues,
      "medium",
      "Translated PDF text did not carry the expected translation prefix contract.",
      `bilingualTranslations=${execution.bilingual.translationTexts.join(" | ")}`,
    )
  }

  const scores = {
    correctness:
      pageCountMatches
      && blockCountMatches
      && bilingualMatches
      && translationOnlyMatches
        ? 10
        : 5,
    completeness:
      pageCountMatches
      && blockCountMatches
      && requestMatches
        ? 10
        : 5,
    stability:
      requestMatches && translationPrefixMatches ? 10 : 6,
    extraction: pageCountMatches && blockCountMatches ? 10 : 4,
    request_batching: requestMatches ? 10 : 5,
    bilingual_rendering: bilingualMatches ? 10 : 4,
    translation_only_rendering: translationOnlyMatches ? 10 : 4,
    translation_prefix: translationPrefixMatches ? 10 : 5,
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
      fixtureName: execution.fixtureName,
      pageCount: execution.pageCount,
      blockCount: execution.blockCount,
      translationRequestCount: execution.translationRequestCount,
      bilingual: execution.bilingual,
      translationOnly: execution.translationOnly,
      notes: execution.notes ?? [],
      patchHints: buildPatchHints(execution, issues),
    },
    nextActions: issues.map((issue) => issue.message),
  }
}
