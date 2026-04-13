import type { EvaluationResult, BenchmarkIssue, PatchHintArtifact } from "../types"

export type ArticleExtractionFailureClass = "empty" | "under-extracted" | "over-extracted" | "wrong-root"

export interface ArticleExtractionExecution {
  scope: "page" | "article"
  rootId: string | null
  blockCount: number
  blockTexts: string[]
  leakedTexts: string[]
  notes?: string[]
}

export interface ArticleExtractionExpectation {
  scope: "page" | "article"
  rootId: string | null
  shouldExcludeTexts?: string[]
  minBlockCount?: number
  maxBlockCount?: number
  expectedRootNote?: string
}

function issue(
  issues: BenchmarkIssue[],
  severity: BenchmarkIssue["severity"],
  message: string,
  evidence?: string,
) {
  issues.push({ severity, message, evidence })
}

function classifyArticleExtractionFailure(
  execution: ArticleExtractionExecution,
  expected: ArticleExtractionExpectation,
): ArticleExtractionFailureClass[] {
  const failureClasses: ArticleExtractionFailureClass[] = []

  if (execution.scope !== expected.scope || execution.rootId !== expected.rootId) {
    failureClasses.push("wrong-root")
  }

  if (execution.blockCount === 0) {
    failureClasses.push("empty")
  } else if (typeof expected.minBlockCount === "number" && execution.blockCount < expected.minBlockCount) {
    failureClasses.push("under-extracted")
  }

  if (
    execution.leakedTexts.length > 0
    || (typeof expected.maxBlockCount === "number" && execution.blockCount > expected.maxBlockCount)
  ) {
    failureClasses.push("over-extracted")
  }

  return failureClasses
}

function buildPatchHints(
  execution: ArticleExtractionExecution,
  expected: ArticleExtractionExpectation,
  failureClasses: ArticleExtractionFailureClass[],
): PatchHintArtifact | undefined {
  const failingSignals: string[] = []

  if (failureClasses.length > 0) {
    failingSignals.push(`failure classes: ${failureClasses.join(", ")}`)
  }

  if (execution.scope !== expected.scope || execution.rootId !== expected.rootId) {
    failingSignals.push(
      `resolved ${execution.scope}:${execution.rootId ?? "BODY"} instead of ${expected.scope}:${expected.rootId ?? "BODY"}`,
    )
  }

  if (typeof expected.minBlockCount === "number" && execution.blockCount < expected.minBlockCount) {
    failingSignals.push(`extracted ${execution.blockCount} blocks, expected at least ${expected.minBlockCount}`)
  }

  if (typeof expected.maxBlockCount === "number" && execution.blockCount > expected.maxBlockCount) {
    failingSignals.push(`extracted ${execution.blockCount} blocks, expected at most ${expected.maxBlockCount}`)
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
      "empty",
      "under-extracted",
      "over-extracted",
      "wrong-root",
    ],
    failingSignals,
    confidence: "high",
  }
}

export function evaluateArticleExtraction(
  execution: ArticleExtractionExecution,
  expected: ArticleExtractionExpectation,
): EvaluationResult {
  const issues: BenchmarkIssue[] = []
  const failureClasses = classifyArticleExtractionFailure(execution, expected)
  const rootSelection = failureClasses.includes("wrong-root") ? 3 : 10
  const noiseRejection = failureClasses.includes("over-extracted") ? 3 : 10
  const coverage = failureClasses.includes("empty")
    ? 0
    : failureClasses.includes("under-extracted")
      ? 4
      : 10
  const taxonomy = failureClasses.length === 0 ? 10 : 4

  if (failureClasses.includes("wrong-root")) {
    issue(
      issues,
      "critical",
      "Extraction plan resolved the wrong root or scope.",
      `expected=${expected.scope}:${expected.rootId ?? "BODY"}, actual=${execution.scope}:${execution.rootId ?? "BODY"}`,
    )
  }

  if (failureClasses.includes("empty")) {
    issue(
      issues,
      "critical",
      "Extraction plan produced no readable blocks.",
      `resolved=${execution.scope}:${execution.rootId ?? "BODY"}`,
    )
  }

  if (failureClasses.includes("under-extracted") && typeof expected.minBlockCount === "number") {
    issue(
      issues,
      "high",
      "Extraction plan under-extracted the readable surface.",
      `expected_at_least=${expected.minBlockCount}, actual=${execution.blockCount}`,
    )
  }

  if (failureClasses.includes("over-extracted")) {
    const evidence: string[] = []
    if (typeof expected.maxBlockCount === "number" && execution.blockCount > expected.maxBlockCount) {
      evidence.push(`expected_at_most=${expected.maxBlockCount}, actual=${execution.blockCount}`)
    }
    if (execution.leakedTexts.length > 0) {
      evidence.push(`leaked=${execution.leakedTexts.join(" | ")}`)
    }

    issue(
      issues,
      "high",
      "Extraction plan over-extracted page chrome or low-value text.",
      evidence.join("; ") || undefined,
    )
  }

  const scores = {
    correctness: rootSelection,
    completeness: coverage,
    stability: 10,
    noise_rejection: noiseRejection,
    failure_taxonomy: taxonomy,
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
  const pass = failureClasses.length === 0 && total >= 80 && !issues.some((item) => item.severity === "critical")

  return {
    scores,
    total,
    pass,
    issues,
    artifacts: {
      failureClasses,
      blockCount: execution.blockCount,
      blockTexts: execution.blockTexts.slice(0, 8),
      expectedBlockCountRange: {
        min: expected.minBlockCount ?? null,
        max: expected.maxBlockCount ?? null,
      },
      expectedRoot: {
        scope: expected.scope,
        rootId: expected.rootId,
        note: expected.expectedRootNote ?? null,
      },
      actualRoot: {
        scope: execution.scope,
        rootId: execution.rootId,
      },
      expectedExclusions: expected.shouldExcludeTexts ?? [],
      notes: execution.notes ?? [],
      patchHints: buildPatchHints(execution, expected, failureClasses),
    },
    nextActions: issues.map((item) => item.message),
  }
}
