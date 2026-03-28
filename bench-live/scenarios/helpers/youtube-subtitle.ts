import { evaluateYouTubeSubtitle, type YouTubeSubtitleExecution } from "../../../bench/evaluators/youtube-subtitle"
import type { LiveEvaluationResult, LiveScenarioExecution } from "../../evaluator"
import { buildYouTubeSubtitleFixtureHtml } from "../../../bench/scenarios/helpers/youtube-subtitle"

interface LiveYouTubeSubtitleExecution extends LiveScenarioExecution {
  youtubeSubtitle?: YouTubeSubtitleExecution
}

export function buildLiveYouTubeSubtitleEvaluation(
  execution: LiveYouTubeSubtitleExecution,
  runId: string,
  scenario: LiveEvaluationResult["scenario"],
  runtime: LiveEvaluationResult["runtime"],
  options: {
    successSummary: string
    failureSummary: string
  },
) {
  if (!execution.youtubeSubtitle) {
    return {
      runId,
      scenario,
      status: execution.status === "skipped" ? "skipped" : "fail",
      pass: false,
      score: 0,
      summary: execution.summary ?? "The live YouTube subtitle scenario did not produce a structured execution payload.",
      issues: ["youtubeSubtitle execution payload was missing"],
      nextActions: ["Inspect the live runtime bridge and rerun the scenario."],
      notes: execution.notes ?? [],
      rubrics: [],
      artifacts: {
        browserArtifacts: execution.artifacts ?? {},
      },
      runtime,
    } as unknown as Partial<LiveEvaluationResult>
  }

  const benchmark = evaluateYouTubeSubtitle(execution.youtubeSubtitle)
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
    notes: [...(execution.notes ?? []), ...(Array.isArray(benchmark.artifacts.captionSnapshots) ? benchmark.artifacts.captionSnapshots.map((snapshot) => `${snapshot.phase}: ${snapshot.sourceText}`) : [])],
    rubrics: [],
    artifacts: {
      browserArtifacts: execution.artifacts ?? {},
      youtubeSubtitleExecution: execution.youtubeSubtitle,
      benchmarkEvaluation: benchmark,
    },
    runtime,
  } as unknown as Partial<LiveEvaluationResult>
}

export { buildYouTubeSubtitleFixtureHtml }
