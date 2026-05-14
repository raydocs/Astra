import type { BenchmarkIssue, EvaluationResult, PatchHintArtifact } from "../types"

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

function buildPatchHints(
  execution: InteractionPriorityExecution,
  expectations: {
    shouldSuppressHover?: boolean
    shouldRequestHover?: boolean
    shouldToggleFloatBall?: boolean
    requiredVisibleHosts?: string[]
    forbiddenVisibleHosts?: string[]
    requireFloatBallMounted?: boolean
  },
  issues: BenchmarkIssue[],
): PatchHintArtifact | undefined {
  if (issues.length === 0) {
    return undefined
  }

  const suspectedFiles = new Set<string>([
    "src/entrypoints/content/interaction-coordination.ts",
    "src/entrypoints/content/components/HoverTranslate.tsx",
    "src/entrypoints/content/components/SelectionToolbar.tsx",
    "src/entrypoints/content/components/InputTranslate.tsx",
    "src/entrypoints/content/components/FloatBall.tsx",
  ])
  const suspectedSymbols = new Set<string>([
    "getInteractionSuppressionState",
    "clearInteractionSuppression",
    "mountHoverTranslate",
    "mountSelectionToolbar",
    "mountInputTranslate",
    "mountFloatBall",
  ])
  const suspectedKeywords = new Set<string>([
    "hoverSuppressed",
    "selection",
    "focusin",
    "pointerdown",
    "toggleCommandCount",
  ])
  const failingSignals: string[] = []

  if (expectations.shouldSuppressHover !== undefined && execution.hoverSuppressed !== expectations.shouldSuppressHover) {
    failingSignals.push("hover suppression state did not match the selection priority flow")
  }

  if (expectations.shouldRequestHover === true && execution.hoverRequestCount < 1) {
    failingSignals.push("hover request never resumed after the blocking interaction cleared")
  }

  if (expectations.shouldRequestHover === false && execution.hoverRequestCount > 0) {
    failingSignals.push("hover request fired while a higher-priority interaction was active")
  }

  if (expectations.shouldToggleFloatBall && execution.toggleCommandCount < 1) {
    failingSignals.push("float ball did not dispatch a page toggle command")
  }

  if (expectations.requireFloatBallMounted && !execution.floatBallMounted) {
    failingSignals.push("float ball host was not mounted")
  }

  if (execution.hoverOverlayVisible) {
    suspectedFiles.add("src/entrypoints/content/components/HoverTranslate.tsx")
  }

  if (execution.selectionToolbarVisible) {
    suspectedFiles.add("src/entrypoints/content/components/SelectionToolbar.tsx")
  }

  if (execution.inputOverlayVisible) {
    suspectedFiles.add("src/entrypoints/content/components/InputTranslate.tsx")
  }

  if (execution.floatBallMounted) {
    suspectedFiles.add("src/entrypoints/content/components/FloatBall.tsx")
  }

  const confidence = issues.some((issue) => issue.severity === "critical") ? "high" : "medium"

  return {
    suspectedFiles: [...suspectedFiles],
    suspectedSymbols: [...suspectedSymbols],
    suspectedKeywords: [...suspectedKeywords],
    failingSignals,
    confidence,
  }
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
      patchHints: buildPatchHints(execution, expectations, issues),
    },
    nextActions: issues.map((issue) => issue.message),
  }
}
