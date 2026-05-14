import { evaluateHover, type HoverExecution } from "../../../bench/evaluators/hover"
import type { LiveEvaluationResult, LiveScenarioExecution } from "../../evaluator"

interface LiveHoverExecution extends LiveScenarioExecution {
  hover?: HoverExecution
}

export function buildLiveHoverEvaluation(
  execution: LiveHoverExecution,
  runId: string,
  scenario: LiveEvaluationResult["scenario"],
  runtime: LiveEvaluationResult["runtime"],
  options: {
    expected: {
      shouldRequest: boolean
      shouldShowOverlay: boolean
      expectedTriggerLabel?: string
      maxLatencyMs?: number
      expectedTask?: "translate" | "explain"
      requireSelectionSuppression?: boolean
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
      summary: execution.summary ?? "The live hover scenario was skipped in this environment.",
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

  if (!execution.hover) {
    return {
      runId,
      scenario,
      status: "fail",
      pass: false,
      score: 0,
      summary: execution.summary ?? "The live hover scenario did not produce a structured execution payload.",
      issues: ["hover execution payload was missing"],
      nextActions: ["Inspect the live hover runtime bridge and rerun the scenario."],
      notes: execution.notes ?? [],
      rubrics: [],
      artifacts: {
        browserArtifacts: execution.artifacts ?? {},
      },
      runtime,
    } as unknown as Partial<LiveEvaluationResult>
  }

  const benchmark = evaluateHover(execution.hover, options.expected)
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
      hoverExecution: execution.hover,
      benchmarkEvaluation: benchmark,
    },
    runtime,
  } as unknown as Partial<LiveEvaluationResult>
}
