import { evaluateSubtitleFile, type SubtitleFileExecution } from "../../../bench/evaluators/subtitle-file"
import type { LiveEvaluationResult, LiveScenarioExecution } from "../../evaluator"

interface LiveSubtitleFileExecution extends LiveScenarioExecution {
  subtitleFile?: SubtitleFileExecution
}

export function buildLiveSubtitleFileEvaluation(
  execution: LiveSubtitleFileExecution,
  runId: string,
  scenario: LiveEvaluationResult["scenario"],
  runtime: LiveEvaluationResult["runtime"],
  options: {
    expected: {
      expectedFileCount?: number
      expectedCueCount?: number
      expectedFormats?: Array<"srt" | "vtt">
      expectedExportFormats?: Array<"srt" | "vtt">
      expectedRequestCount?: number
      expectedPreviewSections?: number
      expectedWarningsAtLeast?: number
      requireTimingPreserved?: boolean
      requirePrivacyIsolation?: boolean
    }
    successSummary: string
    failureSummary: string
  },
) {
  if (!execution.subtitleFile) {
    return {
      runId,
      scenario,
      status: execution.status === "skipped" ? "skipped" : "fail",
      pass: false,
      score: 0,
      summary: execution.summary ?? "The live subtitle-file scenario did not produce a structured execution payload.",
      issues: ["subtitleFile execution payload was missing"],
      nextActions: ["Inspect the live subtitle-file runtime bridge and rerun the scenario."],
      notes: execution.notes ?? [],
      rubrics: [],
      artifacts: {
        browserArtifacts: execution.artifacts ?? {},
      },
      runtime,
    } as unknown as Partial<LiveEvaluationResult>
  }

  const benchmark = evaluateSubtitleFile(execution.subtitleFile, options.expected)
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
    notes: [...(execution.notes ?? []), ...(Array.isArray(benchmark.artifacts.previewWarnings) ? benchmark.artifacts.previewWarnings : [])],
    rubrics: [],
    artifacts: {
      browserArtifacts: execution.artifacts ?? {},
      subtitleFileExecution: execution.subtitleFile,
      benchmarkEvaluation: benchmark,
    },
    runtime,
  } as unknown as Partial<LiveEvaluationResult>
}
