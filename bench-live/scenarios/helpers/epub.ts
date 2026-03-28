import { evaluateEpubTranslation, type EpubTranslationExecution } from "../../../bench/evaluators/epub"
import type { LiveEvaluationResult, LiveScenarioExecution } from "../../evaluator"

interface LiveEpubExecution extends LiveScenarioExecution {
  epubTranslation?: EpubTranslationExecution
}

export function buildLiveEpubEvaluation(
  execution: LiveEpubExecution,
  runId: string,
  scenario: LiveEvaluationResult["scenario"],
  runtime: LiveEvaluationResult["runtime"],
  options: {
    expected: {
      expectedChapterCount?: number
      expectedActiveChapterTitle?: string
      expectedTranslationRequestCount?: number
      requireReadingStateRestored?: boolean
    }
    successSummary: string
    failureSummary: string
  },
) {
  if (!execution.epubTranslation) {
    return {
      runId,
      scenario,
      status: execution.status === "skipped" ? "skipped" : "fail",
      pass: false,
      score: 0,
      summary: execution.summary ?? "The live EPUB scenario did not produce a structured execution payload.",
      issues: ["epubTranslation execution payload was missing"],
      nextActions: ["Inspect the EPUB live runtime bridge and rerun the scenario."],
      notes: execution.notes ?? [],
      rubrics: [],
      artifacts: {
        browserArtifacts: execution.artifacts ?? {},
      },
      runtime,
    } as unknown as Partial<LiveEvaluationResult>
  }

  const benchmark = evaluateEpubTranslation(execution.epubTranslation, options.expected)
  const issues = benchmark.issues.map((issue) => issue.evidence ? `${issue.message} (${issue.evidence})` : issue.message)

  return {
    runId,
    scenario,
    status: benchmark.pass ? "pass" : "fail",
    pass: benchmark.pass,
    score: benchmark.total,
    summary: benchmark.pass ? options.successSummary : options.failureSummary,
    issues,
    nextActions: benchmark.nextActions,
    notes: [...(execution.notes ?? []), ...(Array.isArray(benchmark.artifacts.notes) ? benchmark.artifacts.notes : [])],
    rubrics: [],
    artifacts: {
      browserArtifacts: execution.artifacts ?? {},
      epubTranslationExecution: execution.epubTranslation,
      benchmarkEvaluation: benchmark,
    },
    runtime,
  } as unknown as Partial<LiveEvaluationResult>
}
