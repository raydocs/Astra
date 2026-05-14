import { evaluatePdfTranslation, type PdfTranslationExecution } from "../../../bench/evaluators/pdf"
import type { LiveEvaluationResult, LiveScenarioExecution } from "../../evaluator"

interface LivePdfExecution extends LiveScenarioExecution {
  pdfTranslation?: PdfTranslationExecution
}

export function buildLivePdfEvaluation(
  execution: LivePdfExecution,
  runId: string,
  scenario: LiveEvaluationResult["scenario"],
  runtime: LiveEvaluationResult["runtime"],
  options: {
    successSummary: string
    failureSummary: string
    requirePrivacyIsolation?: boolean
  },
) {
  if (!execution.pdfTranslation) {
    return {
      runId,
      scenario,
      status: execution.status === "skipped" ? "skipped" : "fail",
      pass: false,
      score: 0,
      summary: execution.summary ?? "The live PDF scenario did not produce a structured execution payload.",
      issues: ["pdfTranslation execution payload was missing"],
      nextActions: ["Inspect the PDF live runtime bridge and rerun the scenario."],
      notes: execution.notes ?? [],
      rubrics: [],
      artifacts: {
        browserArtifacts: execution.artifacts ?? {},
      },
      runtime,
    } as unknown as Partial<LiveEvaluationResult>
  }

  const benchmark = evaluatePdfTranslation(execution.pdfTranslation, {
    requirePrivacyIsolation: options.requirePrivacyIsolation,
  })
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
      pdfTranslationExecution: execution.pdfTranslation,
      benchmarkEvaluation: benchmark,
    },
    runtime,
  } as unknown as Partial<LiveEvaluationResult>
}
