import { evaluateSelectionExplain, type SelectionExplainExecution } from "../../../bench/evaluators/selection-explain"
import type { LiveEvaluationResult, LiveScenarioExecution } from "../../evaluator"

interface LiveSelectionExplainExecution extends LiveScenarioExecution {
  selectionExplain?: SelectionExplainExecution
}

export function buildLiveSelectionExplainEvaluation(
  execution: LiveSelectionExplainExecution,
  runId: string,
  scenario: LiveEvaluationResult["scenario"],
  runtime: LiveEvaluationResult["runtime"],
  options: {
    expected: {
      shouldCopy?: boolean
      expectedTask?: "explain" | "translate"
      requireContext?: boolean
    }
    successSummary: string
    failureSummary: string
    extraIssues?: string[]
    extraNotes?: string[]
  },
) {
  if (execution.status === "skipped") {
    return {
      runId,
      scenario,
      status: "skipped",
      pass: false,
      score: 0,
      summary: execution.summary ?? "The live selection-explain scenario was skipped in this environment.",
      issues: [],
      nextActions: execution.notes ?? [],
      notes: execution.notes ?? [],
      rubrics: [],
      artifacts: {
        browserArtifacts: execution.artifacts ?? {},
      },
      runtime,
    } as unknown as Partial<LiveEvaluationResult>
  }

  if (!execution.selectionExplain) {
    return {
      runId,
      scenario,
      status: "fail",
      pass: false,
      score: 0,
      summary: execution.summary ?? "The live selection-explain scenario did not produce a structured execution payload.",
      issues: ["selection explain execution payload was missing"],
      nextActions: ["Inspect the live selection-explain runtime bridge and rerun the scenario."],
      notes: execution.notes ?? [],
      rubrics: [],
      artifacts: {
        browserArtifacts: execution.artifacts ?? {},
      },
      runtime,
    } as unknown as Partial<LiveEvaluationResult>
  }

  const benchmark = evaluateSelectionExplain(execution.selectionExplain, options.expected)
  const issues = benchmark.issues.map((issue) => issue.evidence ? `${issue.message} (${issue.evidence})` : issue.message)
  if (options.extraIssues?.length) {
    issues.push(...options.extraIssues)
  }

  const baseScore = benchmark.total
  const extraPenalty = (options.extraIssues?.length ?? 0) * 10
  const score = Math.max(0, baseScore - extraPenalty)
  const pass = benchmark.pass && (options.extraIssues?.length ?? 0) === 0

  return {
    runId,
    scenario,
    status: pass ? "pass" : "fail",
    pass,
    score,
    summary: pass ? options.successSummary : options.failureSummary,
    issues,
    nextActions: [...benchmark.nextActions],
    notes: [...(execution.notes ?? []), ...(options.extraNotes ?? [])],
    rubrics: [],
    artifacts: {
      browserArtifacts: execution.artifacts ?? {},
      selectionExplainExecution: execution.selectionExplain,
      benchmarkEvaluation: benchmark,
    },
    runtime,
  } as unknown as Partial<LiveEvaluationResult>
}
