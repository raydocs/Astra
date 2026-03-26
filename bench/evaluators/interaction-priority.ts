import type { BenchmarkIssue, EvaluationResult } from "../types"

export interface InteractionPriorityExecution {
  hoverSuppressed: boolean
  hoverRequestCount: number
  toggleCommandCount: number
  selectionToolbarVisible: boolean
  hoverOverlayVisible: boolean
  inputOverlayVisible: boolean
  floatBallMounted: boolean
  visibleHosts: string[]
  mountedHosts: string[]
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

export function evaluateInteractionPriority(
  execution: InteractionPriorityExecution,
  expectations: {
    shouldSuppressHover?: boolean
    shouldRequestHover?: boolean
    shouldToggleFloatBall?: boolean
    requiredVisibleHosts?: string[]
    forbiddenVisibleHosts?: string[]
    requireFloatBallMounted?: boolean
  } = {},
): EvaluationResult {
  const issues: BenchmarkIssue[] = []
  const requiredVisibleHosts = expectations.requiredVisibleHosts ?? []
  const forbiddenVisibleHosts = expectations.forbiddenVisibleHosts ?? []

  if (
    expectations.shouldSuppressHover !== undefined
    && execution.hoverSuppressed !== expectations.shouldSuppressHover
  ) {
    addIssue(
      issues,
      expectations.shouldSuppressHover ? "critical" : "high",
      expectations.shouldSuppressHover
        ? "Selection-driven interaction did not suppress hover translation."
        : "Hover translation remained suppressed after the blocking interaction cleared.",
      `hoverSuppressed=${execution.hoverSuppressed}`,
    )
  }

  if (expectations.shouldRequestHover === true && execution.hoverRequestCount < 1) {
    addIssue(
      issues,
      "critical",
      "Hover translation did not resume when it should have been allowed to run.",
      `hoverRequestCount=${execution.hoverRequestCount}`,
    )
  }

  if (expectations.shouldRequestHover === false && execution.hoverRequestCount > 0) {
    addIssue(
      issues,
      "high",
      "Hover translation sent a request while a higher-priority interaction was active.",
      `hoverRequestCount=${execution.hoverRequestCount}`,
    )
  }

  if (expectations.shouldToggleFloatBall && execution.toggleCommandCount < 1) {
    addIssue(
      issues,
      "high",
      "Float ball interaction did not dispatch a page toggle command.",
      `toggleCommandCount=${execution.toggleCommandCount}`,
    )
  }

  if (expectations.requireFloatBallMounted && !execution.floatBallMounted) {
    addIssue(issues, "medium", "Float ball host was not mounted.", execution.mountedHosts.join(", "))
  }

  const missingVisibleHosts = requiredVisibleHosts.filter((id) => !execution.visibleHosts.includes(id))
  if (missingVisibleHosts.length > 0) {
    addIssue(
      issues,
      "medium",
      "Expected interaction surfaces were not visible in the active flow.",
      missingVisibleHosts.join(", "),
    )
  }

  const unexpectedVisibleHosts = forbiddenVisibleHosts.filter((id) => execution.visibleHosts.includes(id))
  if (unexpectedVisibleHosts.length > 0) {
    addIssue(
      issues,
      "high",
      "Unexpected interaction surfaces became visible and would disturb the current flow.",
      unexpectedVisibleHosts.join(", "),
    )
  }

  const correctness = issues.some((issue) => issue.severity === "critical") ? 4 : 10
  const completeness = missingVisibleHosts.length === 0 ? 10 : 6
  const stability = issues.some((issue) => issue.severity === "critical") ? 4 : 10
  const priorityIsolation = unexpectedVisibleHosts.length === 0 ? 10 : 4
  const interactionSafety = [
    expectations.shouldSuppressHover === undefined || execution.hoverSuppressed === expectations.shouldSuppressHover,
    !expectations.shouldToggleFloatBall || execution.toggleCommandCount > 0,
    !expectations.requireFloatBallMounted || execution.floatBallMounted,
  ].every(Boolean) ? 10 : 5

  const scores = {
    correctness,
    completeness,
    stability,
    priority_isolation: priorityIsolation,
    interaction_safety: interactionSafety,
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
      hoverSuppressed: execution.hoverSuppressed,
      hoverRequestCount: execution.hoverRequestCount,
      toggleCommandCount: execution.toggleCommandCount,
      visibleHosts: execution.visibleHosts,
      mountedHosts: execution.mountedHosts,
      notes: execution.notes ?? [],
    },
    nextActions: issues.map((issue) => issue.message),
  }
}
