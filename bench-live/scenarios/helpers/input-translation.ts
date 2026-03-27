import { evaluateInputTranslation, type InputTranslationExecution } from "../../../bench/evaluators/input-translation"
import type { LiveEvaluationResult, LiveScenarioExecution } from "../../evaluator"

interface LiveInputTranslationExecution extends LiveScenarioExecution {
  inputTranslation?: InputTranslationExecution
}

export function buildLiveInputTranslationEvaluation(
  execution: LiveInputTranslationExecution,
  runId: string,
  scenario: LiveEvaluationResult["scenario"],
  runtime: LiveEvaluationResult["runtime"],
  options: {
    expected: {
      shouldRequest: boolean
      shouldShowAfterFocus: boolean
      shouldShowAfterTyping?: boolean
      shouldWriteBack: boolean
      expectedTask?: "translate"
      requireContext?: boolean
      maxLatencyMs?: number
    }
    successSummary: string
    failureSummary: string
  },
) {
  if (!execution.inputTranslation) {
    return {
      runId,
      scenario,
      status: execution.status === "skipped" ? "skipped" : "fail",
      pass: false,
      score: 0,
      summary: execution.summary ?? "The live input-translation scenario did not produce a structured execution payload.",
      issues: ["inputTranslation execution payload was missing"],
      nextActions: ["Inspect the live runtime bridge and rerun the scenario."],
      notes: execution.notes ?? [],
      rubrics: [],
      artifacts: {
        browserArtifacts: execution.artifacts ?? {},
      },
      runtime,
    } as unknown as Partial<LiveEvaluationResult>
  }

  const benchmark = evaluateInputTranslation(execution.inputTranslation, options.expected)
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
      inputTranslationExecution: execution.inputTranslation,
      benchmarkEvaluation: benchmark,
    },
    runtime,
  } as unknown as Partial<LiveEvaluationResult>
}
