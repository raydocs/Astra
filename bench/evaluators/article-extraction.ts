import type { EvaluationResult, BenchmarkIssue, PatchHintArtifact } from "../types"

export interface ArticleExtractionExecution {
  scope: "page" | "article"
  rootId: string | null
  blockCount: number
  blockTexts: string[]
  leakedTexts: string[]
  notes?: string[]
}

function issue(
  issues: BenchmarkIssue[],
  severity: BenchmarkIssue["severity"],
  message: string,
  evidence?: string,
) {
  issues.push({ severity, message, evidence })
}

function buildPatchHints(
  execution: ArticleExtractionExecution,
  expected: {
    scope: "page" | "article"
    rootId: string | null
    shouldExcludeTexts?: string[]
  },
): PatchHintArtifact | undefined {
  const failingSignals: string[] = []

  if (execution.scope !== expected.scope || execution.rootId !== expected.rootId) {
    failingSignals.push(
      `resolved ${execution.scope}:${execution.rootId ?? "BODY"} instead of ${expected.scope}:${expected.rootId ?? "BODY"}`,
    )
  }

  if (execution.leakedTexts.length > 0) {
    failingSignals.push(`leaked texts: ${execution.leakedTexts.join(" | ")}`)
  }

  if (execution.blockCount === 0) {
    failingSignals.push("no extracted blocks")
  }

  if (failingSignals.length === 0) {
    return undefined
  }

  return {
    suspectedFiles: [
      "src/utils/dom/extraction.ts",
      "src/utils/dom/traversal.ts",
    ],
    suspectedSymbols: [
      "resolveArticleRoot",
      "resolveExtractionPlan",
      "collectTextBlocks",
      "buildContentSummary",
      "findContentRoot",
    ],
    suspectedKeywords: [
      "article",
      "sidebar",
      "root",
      "leaked",
    ],
    failingSignals,
    confidence: "high",
  }
}

export function evaluateArticleExtraction(
  execution: ArticleExtractionExecution,
  expected: {
    scope: "page" | "article"
    rootId: string | null
    shouldExcludeTexts?: string[]
  },
): EvaluationResult {
  const issues: BenchmarkIssue[] = []
  const rootSelection = execution.scope === expected.scope && execution.rootId === expected.rootId ? 10 : 3
  const noiseRejection = execution.leakedTexts.length === 0 ? 10 : 3
  const coverage = execution.blockCount > 0 ? 10 : 0

  if (execution.scope !== expected.scope || execution.rootId !== expected.rootId) {
    issue(
      issues,
      "critical",
      "Extraction plan resolved the wrong root or scope.",
      `expected=${expected.scope}:${expected.rootId ?? "BODY"}, actual=${execution.scope}:${execution.rootId ?? "BODY"}`,
    )
  }

  if (execution.leakedTexts.length > 0) {
    issue(
      issues,
      "high",
      "Extraction plan leaked text that should have been excluded.",
      execution.leakedTexts.join(" | "),
    )
  }

  const scores = {
    correctness: rootSelection,
    completeness: coverage,
    stability: 10,
    root_selection: rootSelection,
    noise_rejection: noiseRejection,
    coverage,
  }

  const baseTotal = Math.round((Object.values(scores).reduce((sum, score) => sum + score, 0) / (Object.keys(scores).length * 10)) * 100)
  const penalty = issues.reduce((sum, item) => {
    switch (item.severity) {
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
  const pass = total >= 80 && !issues.some((item) => item.severity === "critical")

  return {
    scores,
    total,
    pass,
    issues,
    artifacts: {
      blockCount: execution.blockCount,
      blockTexts: execution.blockTexts.slice(0, 8),
      expectedExclusions: expected.shouldExcludeTexts ?? [],
      notes: execution.notes ?? [],
      patchHints: buildPatchHints(execution, expected),
    },
    nextActions: issues.map((item) => item.message),
  }
}
