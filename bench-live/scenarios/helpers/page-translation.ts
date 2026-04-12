import { evaluatePageTranslation, type PageTranslationExecution } from "../../../bench/evaluators/page-translation"
import type { LiveEvaluationResult, LiveScenarioExecution } from "../../evaluator"

interface LivePageTranslationExecution extends LiveScenarioExecution {
  pageTranslation?: PageTranslationExecution
}

export function buildLivePageTranslationEvaluation(
  execution: LivePageTranslationExecution,
  runId: string,
  scenario: LiveEvaluationResult["scenario"],
  runtime: LiveEvaluationResult["runtime"],
  options: {
    requireTranslationOnly?: boolean
    requireRichTextPlaceholderPreservation?: boolean
    successSummary: string
    failureSummary: string
  },
) {
  if (!execution.pageTranslation) {
    return {
      runId,
      scenario,
      status: execution.status === "skipped" ? "skipped" : "fail",
      pass: false,
      score: 0,
      summary: execution.summary ?? "The live page translation scenario did not produce a structured execution payload.",
      issues: ["pageTranslation execution payload was missing"],
      nextActions: ["Inspect the live runtime bridge and rerun the scenario."],
      notes: execution.notes ?? [],
      rubrics: [],
      artifacts: {
        browserArtifacts: execution.artifacts ?? {},
      },
      runtime,
    } as unknown as Partial<LiveEvaluationResult>
  }

  const benchmark = evaluatePageTranslation(execution.pageTranslation, {
    requireTranslationOnly: options.requireTranslationOnly,
    requireRichTextPlaceholderPreservation: options.requireRichTextPlaceholderPreservation,
  })
  const issues = benchmark.issues.map((issue) => issue.evidence ? `${issue.message} (${issue.evidence})` : issue.message)
  const skipped = execution.status === "skipped"

  return {
    runId,
    scenario,
    status: skipped ? "skipped" : benchmark.pass ? "pass" : "fail",
    pass: skipped ? false : benchmark.pass,
    score: skipped ? 0 : benchmark.total,
    summary: benchmark.pass ? options.successSummary : options.failureSummary,
    issues: skipped ? [] : issues,
    nextActions: skipped ? [] : benchmark.nextActions,
    notes: [...(execution.notes ?? []), ...(Array.isArray(benchmark.artifacts.notes) ? benchmark.artifacts.notes : [])],
    rubrics: [],
    artifacts: {
      browserArtifacts: execution.artifacts ?? {},
      pageTranslationExecution: execution.pageTranslation,
      benchmarkEvaluation: benchmark,
    },
    runtime,
  } as unknown as Partial<LiveEvaluationResult>
}
