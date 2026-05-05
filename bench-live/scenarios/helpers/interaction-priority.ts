import { evaluateInteractionPriority, type InteractionPriorityExecution } from "../../../bench/evaluators/interaction-priority"
import type { LiveEvaluationResult, LiveScenarioExecution } from "../../evaluator"

interface LiveStressDiagnostics {
  label: string
  orderedLines: string[]
}

interface LiveInteractionPriorityExecution extends LiveScenarioExecution {
  interactionPriority?: InteractionPriorityExecution
  stressDiagnostics?: LiveStressDiagnostics
}

function stressDiagnosticNotes(execution: LiveInteractionPriorityExecution) {
  return execution.stressDiagnostics?.orderedLines ?? []
}

export function buildLiveInteractionPriorityEvaluation(
  execution: LiveInteractionPriorityExecution,
  runId: string,
  scenario: LiveEvaluationResult["scenario"],
  runtime: LiveEvaluationResult["runtime"],
  options: {
    expectations?: {
      shouldSuppressHover?: boolean
      shouldRequestHover?: boolean
      shouldToggleFloatBall?: boolean
      requiredVisibleHosts?: string[]
      forbiddenVisibleHosts?: string[]
      requireFloatBallMounted?: boolean
    }
    successSummary: string
    failureSummary: string
  },
) {
  if (!execution.interactionPriority) {
    return {
      runId,
      scenario,
      status: execution.status === "skipped" ? "skipped" : "fail",
      pass: false,
      score: 0,
      summary: execution.summary ?? "The live interaction-priority scenario did not produce a structured execution payload.",
      issues: ["interactionPriority execution payload was missing"],
      nextActions: ["Inspect the live runtime bridge and rerun the scenario."],
      notes: [...stressDiagnosticNotes(execution), ...(execution.notes ?? [])],
      rubrics: [],
      artifacts: {
        browserArtifacts: execution.artifacts ?? {},
      },
      runtime,
    } as unknown as Partial<LiveEvaluationResult>
  }

  const benchmark = evaluateInteractionPriority(execution.interactionPriority, options.expectations ?? {})
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
    notes: [
      ...stressDiagnosticNotes(execution),
      ...(execution.notes ?? []),
      ...(Array.isArray(benchmark.artifacts.notes) ? benchmark.artifacts.notes : []),
    ],
    rubrics: [],
    artifacts: {
      browserArtifacts: execution.artifacts ?? {},
      interactionPriorityExecution: execution.interactionPriority,
      benchmarkEvaluation: benchmark,
    },
    runtime,
  } as unknown as Partial<LiveEvaluationResult>
}
