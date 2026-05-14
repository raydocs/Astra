import { evaluateFrameCoordination, type FrameCoordinationExecution } from "../../../bench/evaluators/frame-coordination"
import type { LiveEvaluationResult, LiveScenarioExecution } from "../../evaluator"

interface LiveFrameCoordinationExecution extends LiveScenarioExecution {
  frameCoordination?: FrameCoordinationExecution
}

/**
 * Build a live evaluation result from a frame-coordination execution payload.
 *
 * Delegates scoring to the deterministic `evaluateFrameCoordination()` evaluator
 * and wraps the result in the `LiveEvaluationResult` shape expected by the live
 * harness, following the same pattern as the page-translation and
 * interaction-priority helpers.
 */
export function buildLiveFrameCoordinationEvaluation(
  execution: LiveFrameCoordinationExecution,
  runId: string,
  scenario: LiveEvaluationResult["scenario"],
  runtime: LiveEvaluationResult["runtime"],
  options: {
    expectations?: {
      shouldMountFloatBall?: boolean
      shouldMountSiteUi?: boolean
      shouldMountInputUi?: boolean
      shouldAutoStart?: boolean
      expectedFramesTotal?: number
      expectedFramesTranslating?: number
      expectedAggregatePhase?: string
      expectedAggregateHostname?: string | null
      expectedAggregateTargetLang?: string | null
      expectedProgressTotalBlocks?: number
      expectedSendFrameIds?: number[]
    }
    successSummary: string
    failureSummary: string
  },
) {
  if (!execution.frameCoordination) {
    return {
      runId,
      scenario,
      status: execution.status === "skipped" ? "skipped" : "fail",
      pass: false,
      score: 0,
      summary: execution.summary ?? "The live frame-coordination scenario did not produce a structured execution payload.",
      issues: ["frameCoordination execution payload was missing"],
      nextActions: ["Inspect the live runtime bridge and rerun the scenario."],
      notes: execution.notes ?? [],
      rubrics: [],
      artifacts: {
        browserArtifacts: execution.artifacts ?? {},
      },
      runtime,
    } as unknown as Partial<LiveEvaluationResult>
  }

  const benchmark = evaluateFrameCoordination(execution.frameCoordination, options.expectations ?? {})
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
      frameCoordinationExecution: execution.frameCoordination,
      benchmarkEvaluation: benchmark,
    },
    runtime,
  } as unknown as Partial<LiveEvaluationResult>
}
