import { evaluateYouTubeSubtitle, type YouTubeSubtitleExecution } from "../../../bench/evaluators/youtube-subtitle"
import type { LiveEvaluationResult, LiveScenarioExecution } from "../../evaluator"
import { buildYouTubeSubtitleFixtureHtml } from "../../../bench/scenarios/helpers/youtube-subtitle"

interface LiveStressDiagnostics {
  label: string
  orderedLines: string[]
}

interface LiveYouTubeSubtitleExecution extends LiveScenarioExecution {
  youtubeSubtitle?: YouTubeSubtitleExecution
  stressDiagnostics?: LiveStressDiagnostics
}

const CANONICAL_YOUTUBE_PHASES = [
  "late-window-appear",
  "burst-duplicate-1",
  "pause-restored",
  "seeked-holdout-line",
  "seeked-cache-hit",
]

function phaseRank(phase: string) {
  const index = CANONICAL_YOUTUBE_PHASES.indexOf(phase)
  return index === -1 ? CANONICAL_YOUTUBE_PHASES.length : index
}

function compareSnapshots(
  a: YouTubeSubtitleExecution["captionSnapshots"][number],
  b: YouTubeSubtitleExecution["captionSnapshots"][number],
) {
  return phaseRank(a.phase) - phaseRank(b.phase) || a.phase.localeCompare(b.phase)
}

function stressDiagnosticNotes(execution: LiveYouTubeSubtitleExecution) {
  return execution.stressDiagnostics?.orderedLines ?? []
}

function captionSnapshotNotes(execution: YouTubeSubtitleExecution) {
  return [...execution.captionSnapshots]
    .sort(compareSnapshots)
    .map((snapshot) => `${snapshot.phase}: ${snapshot.sourceText}`)
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
      notes: [...stressDiagnosticNotes(execution), ...(execution.notes ?? [])],
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
    notes: [
      ...stressDiagnosticNotes(execution),
      ...(execution.notes ?? []),
      ...(Array.isArray(benchmark.artifacts.captionSnapshots) ? captionSnapshotNotes(execution.youtubeSubtitle) : []),
    ],
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
