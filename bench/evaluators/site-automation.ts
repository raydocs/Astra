import type { BenchmarkIssue, EvaluationResult } from "../types"

export interface SiteAutomationExecution {
  autoStarted: boolean
  stoppedAfterDisable: boolean
  suppressedAfterManualStop: boolean
  resumedAfterReenable: boolean
  requestCountBeforeTransition: number
  requestCountAfterTransition: number
  phaseBeforeTransition: string
  phaseAfterTransition: string
  translationMarkersBeforeTransition: number
  translationMarkersAfterTransition: number
  uiHostsPresent: string[]
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

export function evaluateSiteAutomation(
  execution: SiteAutomationExecution,
  expectations: {
    shouldAutoStart?: boolean
    shouldStopAfterDisable?: boolean
    shouldSuppressAfterManualStop?: boolean
    shouldResumeAfterReenable?: boolean
    requireUiHosts?: string[]
  } = {},
): EvaluationResult {
  const issues: BenchmarkIssue[] = []
  const requireUiHosts = expectations.requireUiHosts ?? []

  if (expectations.shouldAutoStart && !execution.autoStarted) {
    addIssue(issues, "critical", "Always Translate did not auto-start when the site was eligible.", `phase=${execution.phaseBeforeTransition}, requests=${execution.requestCountBeforeTransition}`)
  }

  if (expectations.shouldStopAfterDisable && !execution.stoppedAfterDisable) {
    addIssue(issues, "critical", "Active translation did not stop after the site was disabled.", `phase=${execution.phaseAfterTransition}, markers=${execution.translationMarkersAfterTransition}`)
  }

  if (expectations.shouldSuppressAfterManualStop && !execution.suppressedAfterManualStop) {
    addIssue(issues, "high", "Manual stop did not suppress automatic restart on the current page.", `beforeRequests=${execution.requestCountBeforeTransition}, afterRequests=${execution.requestCountAfterTransition}`)
  }

  if (expectations.shouldResumeAfterReenable && !execution.resumedAfterReenable) {
    addIssue(issues, "high", "Automatic translation did not resume after the site became eligible again.", `phase=${execution.phaseAfterTransition}, requests=${execution.requestCountAfterTransition}`)
  }

  const missingUiHosts = requireUiHosts.filter((id) => !execution.uiHostsPresent.includes(id))
  if (missingUiHosts.length > 0) {
    addIssue(issues, "medium", "Expected site-level UI hosts were not mounted.", missingUiHosts.join(", "))
  }

  const correctnessChecks = [
    expectations.shouldAutoStart ? execution.autoStarted : true,
    expectations.shouldStopAfterDisable ? execution.stoppedAfterDisable : true,
    expectations.shouldResumeAfterReenable ? execution.resumedAfterReenable : true,
  ]
  const correctness = correctnessChecks.every(Boolean) ? 10 : 4
  const completeness = missingUiHosts.length === 0 ? 10 : 6
  const stability = issues.some((issue) => issue.severity === "critical") ? 4 : 10
  const ruleResponsiveness = [
    expectations.shouldStopAfterDisable ? execution.stoppedAfterDisable : true,
    expectations.shouldResumeAfterReenable ? execution.resumedAfterReenable : true,
  ].every(Boolean) ? 10 : 4
  const interactionSafety = expectations.shouldSuppressAfterManualStop
    ? (execution.suppressedAfterManualStop ? 10 : 4)
    : 10

  const scores = {
    correctness,
    completeness,
    stability,
    rule_responsiveness: ruleResponsiveness,
    interaction_safety: interactionSafety,
  }

  const baseTotal = Math.round((Object.values(scores).reduce((sum, score) => sum + score, 0) / (Object.keys(scores).length * 10)) * 100)
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
      phaseBeforeTransition: execution.phaseBeforeTransition,
      phaseAfterTransition: execution.phaseAfterTransition,
      requestCountBeforeTransition: execution.requestCountBeforeTransition,
      requestCountAfterTransition: execution.requestCountAfterTransition,
      translationMarkersBeforeTransition: execution.translationMarkersBeforeTransition,
      translationMarkersAfterTransition: execution.translationMarkersAfterTransition,
      uiHostsPresent: execution.uiHostsPresent,
      notes: execution.notes ?? [],
    },
    nextActions: issues.map((issue) => issue.message),
  }
}
