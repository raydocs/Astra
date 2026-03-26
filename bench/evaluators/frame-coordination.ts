import type { BenchmarkIssue, EvaluationResult } from "../types"

export interface FrameCoordinationExecution {
  floatBallMounted: boolean
  siteUiMounted: boolean
  inputUiMounted: boolean
  autoStarted: boolean
  translationMarkerCount: number
  framesTotal: number | null
  framesTranslating: number | null
  aggregatePhase: string | null
  aggregateTargetLang: string | null
  aggregateHostname: string | null
  progressTotalBlocks: number | null
  sendMessageFrameIds: number[]
  notes?: string[]
}

function addIssue(
  issues: BenchmarkIssue[],
  severity: BenchmarkIssue["severity"],
  message: string,
  evidence?: string,
) {
  issues.push({ severity, message, evidence })
}

export function evaluateFrameCoordination(
  execution: FrameCoordinationExecution,
  expectations: {
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
  } = {},
): EvaluationResult {
  const issues: BenchmarkIssue[] = []

  if (
    expectations.shouldMountFloatBall !== undefined
    && execution.floatBallMounted !== expectations.shouldMountFloatBall
  ) {
    addIssue(
      issues,
      expectations.shouldMountFloatBall ? "critical" : "high",
      expectations.shouldMountFloatBall
        ? "Top-frame chrome did not mount where expected."
        : "Top-frame-only chrome leaked into a child frame.",
      `floatBallMounted=${execution.floatBallMounted}`,
    )
  }

  if (
    expectations.shouldMountSiteUi !== undefined
    && execution.siteUiMounted !== expectations.shouldMountSiteUi
  ) {
    addIssue(
      issues,
      "critical",
      "Site-level inline UI did not mount as expected for the frame context.",
      `siteUiMounted=${execution.siteUiMounted}`,
    )
  }

  if (
    expectations.shouldMountInputUi !== undefined
    && execution.inputUiMounted !== expectations.shouldMountInputUi
  ) {
    addIssue(
      issues,
      "medium",
      "Input translation overlay mount state was not correct for the frame context.",
      `inputUiMounted=${execution.inputUiMounted}`,
    )
  }

  if (expectations.shouldAutoStart !== undefined && execution.autoStarted !== expectations.shouldAutoStart) {
    addIssue(
      issues,
      "critical",
      expectations.shouldAutoStart
        ? "Always Translate did not auto-start in the expected frame."
        : "Unexpected frame auto-started translation.",
      `autoStarted=${execution.autoStarted}, markers=${execution.translationMarkerCount}`,
    )
  }

  if (
    expectations.expectedFramesTotal !== undefined
    && execution.framesTotal !== expectations.expectedFramesTotal
  ) {
    addIssue(
      issues,
      "high",
      "Aggregated frame count did not match the discovered translatable frames.",
      `framesTotal=${execution.framesTotal}`,
    )
  }

  if (
    expectations.expectedFramesTranslating !== undefined
    && execution.framesTranslating !== expectations.expectedFramesTranslating
  ) {
    addIssue(
      issues,
      "high",
      "Aggregated translating-frame count was incorrect.",
      `framesTranslating=${execution.framesTranslating}`,
    )
  }

  if (
    expectations.expectedAggregatePhase !== undefined
    && execution.aggregatePhase !== expectations.expectedAggregatePhase
  ) {
    addIssue(
      issues,
      "high",
      "Aggregated phase did not reflect the expected frame state.",
      `aggregatePhase=${execution.aggregatePhase}`,
    )
  }

  if (
    expectations.expectedAggregateHostname !== undefined
    && execution.aggregateHostname !== expectations.expectedAggregateHostname
  ) {
    addIssue(
      issues,
      "medium",
      "Aggregated hostname metadata did not use the expected top-frame source.",
      `aggregateHostname=${execution.aggregateHostname}`,
    )
  }

  if (
    expectations.expectedAggregateTargetLang !== undefined
    && execution.aggregateTargetLang !== expectations.expectedAggregateTargetLang
  ) {
    addIssue(
      issues,
      "medium",
      "Aggregated target language metadata was incorrect.",
      `aggregateTargetLang=${execution.aggregateTargetLang}`,
    )
  }

  if (
    expectations.expectedProgressTotalBlocks !== undefined
    && execution.progressTotalBlocks !== expectations.expectedProgressTotalBlocks
  ) {
    addIssue(
      issues,
      "high",
      "Aggregated progress totals were incorrect.",
      `progressTotalBlocks=${execution.progressTotalBlocks}`,
    )
  }

  if (expectations.expectedSendFrameIds) {
    const actual = [...execution.sendMessageFrameIds].sort((a, b) => a - b)
    const expected = [...expectations.expectedSendFrameIds].sort((a, b) => a - b)
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      addIssue(
        issues,
        "high",
        "Background fan-out did not target the expected frame IDs.",
        `actual=${actual.join(",")}; expected=${expected.join(",")}`,
      )
    }
  }

  const correctness = issues.some((issue) => issue.severity === "critical") ? 4 : 10
  const completeness = issues.some((issue) => issue.severity === "high") ? 6 : 10
  const stability = issues.some((issue) => issue.severity === "critical") ? 4 : 10
  const frameIsolation = [
    expectations.shouldMountFloatBall === undefined || execution.floatBallMounted === expectations.shouldMountFloatBall,
    expectations.shouldMountSiteUi === undefined || execution.siteUiMounted === expectations.shouldMountSiteUi,
  ].every(Boolean) ? 10 : 4
  const frameAggregation = [
    expectations.expectedFramesTotal === undefined || execution.framesTotal === expectations.expectedFramesTotal,
    expectations.expectedFramesTranslating === undefined || execution.framesTranslating === expectations.expectedFramesTranslating,
    expectations.expectedAggregatePhase === undefined || execution.aggregatePhase === expectations.expectedAggregatePhase,
  ].every(Boolean) ? 10 : 5

  const scores = {
    correctness,
    completeness,
    stability,
    frame_isolation: frameIsolation,
    frame_aggregation: frameAggregation,
  }

  const baseTotal = Math.round(
    (Object.values(scores).reduce((sum, score) => sum + score, 0) / (Object.keys(scores).length * 10)) * 100,
  )
  const penalty = issues.reduce((sum, issue) => {
    switch (issue.severity) {
      case "critical":
        return sum + 40
      case "high":
        return sum + 20
      case "medium":
        return sum + 10
      case "low":
        return sum + 5
      default:
        return sum
    }
  }, 0)
  const total = Math.max(0, baseTotal - penalty)
  const pass = total >= 80 && !issues.some((issue) => issue.severity === "critical")

  return {
    scores,
    total,
    pass,
    issues,
    artifacts: {
      floatBallMounted: execution.floatBallMounted,
      siteUiMounted: execution.siteUiMounted,
      inputUiMounted: execution.inputUiMounted,
      autoStarted: execution.autoStarted,
      translationMarkerCount: execution.translationMarkerCount,
      framesTotal: execution.framesTotal,
      framesTranslating: execution.framesTranslating,
      aggregatePhase: execution.aggregatePhase,
      aggregateTargetLang: execution.aggregateTargetLang,
      aggregateHostname: execution.aggregateHostname,
      progressTotalBlocks: execution.progressTotalBlocks,
      sendMessageFrameIds: execution.sendMessageFrameIds,
      notes: execution.notes ?? [],
    },
    nextActions: issues.map((issue) => issue.message),
  }
}
