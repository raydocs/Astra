import type { ExecutorAttempt, ExecutorGateSummary, ExecutorScenario, HistoryPromptSummary, LoopPlan, PatchContextPack, PatchPass, PatchTask, ResolvedOptimizerConfig } from "../types"

function getScenarioReasons(item: LoopPlan["selectedItems"][number]): string[] {
  const reasons: string[] = []

  if (!item.pass) {
    reasons.push("scenario is currently failing")
  }

  if (item.status === "regressed") {
    reasons.push("scenario regressed versus the previous run")
  }

  if (item.issues.length > 0) {
    reasons.push(...item.issues.map((issue) => `issue: ${issue.message}`))
  }

  if (item.nextActions.length > 0) {
    reasons.push(...item.nextActions.map((action) => `next action: ${action}`))
  }

  return reasons
}

function getHistoryScenarioReasons(
  item: LoopPlan["selectedItems"][number],
  history?: HistoryPromptSummary,
): string[] {
  if (!history) {
    return []
  }

  const reasons: string[] = []
  const recurring = history.recurringFailures.find((entry) => entry.id === item.id)
  if (recurring) {
    reasons.push(`history recurrence: scenario recorded ${recurring.issueCount} issue hits across archived runs`)

    if ((recurring.regressionCount ?? 0) > 0) {
      reasons.push(`history recurrence: scenario regressed in ${recurring.regressionCount} archived run${recurring.regressionCount === 1 ? "" : "s"}`)
    }

    if ((recurring.failureCount ?? 0) > 0) {
      reasons.push(`history recurrence: scenario failed in ${recurring.failureCount} archived run${recurring.failureCount === 1 ? "" : "s"}`)
    }

    if (recurring.latestTotal < 100) {
      reasons.push(`history recurrence: latest archived total remained at ${recurring.latestTotal}`)
    }
  }

  const weakSurface = history.weakestSurfaces.find((entry) => entry.surface === item.surface)
  if (weakSurface && weakSurface.averageTotal < 100) {
    reasons.push(`history weak surface: ${weakSurface.surface} averaged ${weakSurface.averageTotal.toFixed(1)} across archived runs`)

    if (weakSurface.direction === "regressing") {
      reasons.push(`history weak surface: ${weakSurface.surface} is regressing across archived runs`)
    }

    if (weakSurface.failureRuns > 0) {
      reasons.push(`history weak surface: ${weakSurface.surface} failed in ${weakSurface.failureRuns} archived run${weakSurface.failureRuns === 1 ? "" : "s"}`)
    }
  }

  return reasons
}

function getHistoryBackedReasons(scenario: ExecutorScenario): string[] {
  return scenario.reasons.filter((reason) => reason.startsWith("history "))
}

function toHistoryReadinessLabel(reason: string): string {
  if (reason.startsWith("history recurrence:")) {
    return `recurring archived failure signal: ${reason.replace("history recurrence: ", "")}`
  }

  if (reason.startsWith("history weak surface:")) {
    return `weak archived surface signal: ${reason.replace("history weak surface: ", "")}`
  }

  return reason
}

function buildHistoryReadinessSummary(actionable: ExecutorScenario[]): string[] {
  const lines: string[] = []

  actionable.forEach((scenario) => {
    getHistoryBackedReasons(scenario).slice(0, 4).forEach((reason) => {
      lines.push(`- ${scenario.id}: ${toHistoryReadinessLabel(reason)}`)
    })
  })

  return lines
}

function buildActionableScenarios(plan: LoopPlan): ExecutorScenario[] {
  return plan.selectedItems
    .map((item) => ({
      id: item.id,
      surface: item.surface,
      priority: item.priority,
      status: item.status,
      pass: item.pass,
      reasons: [...getScenarioReasons(item), ...getHistoryScenarioReasons(item, plan.history)],
    }))
    .filter((item) => item.reasons.length > 0)
}

function buildExecutorGateSummary(
  status: ExecutorAttempt["status"],
  actionableScenarios: ExecutorScenario[],
  blockReason: string | null,
): ExecutorGateSummary {
  if (status === "blocked") {
    return {
      decision: "blocked",
      reason: blockReason ?? "Automatic patching is blocked.",
      error: null,
    }
  }

  const hasCurrentSignals = actionableScenarios.some((scenario) => scenario.reasons.some((reason) => !reason.startsWith("history ")))
  const hasHistorySignals = actionableScenarios.some((scenario) => scenario.reasons.some((reason) => reason.startsWith("history ")))

  return {
    decision: "ready",
    reason: hasHistorySignals
      ? hasCurrentSignals
        ? "current and history-backed signal(s) made this attempt ready."
        : "history-backed signal(s) made this attempt ready."
      : "current signal(s) made this attempt ready.",
    error: null,
  }
}

function getPromptAnalysisMode(optimizer: ResolvedOptimizerConfig | undefined) {
  return optimizer?.prompt?.policy.analysisMode ?? "minimal"
}

function getPromptToolPolicy(optimizer: ResolvedOptimizerConfig | undefined) {
  return optimizer?.prompt?.policy.toolPolicy ?? "default"
}

function getPromptWriteScopeMode(optimizer: ResolvedOptimizerConfig | undefined) {
  return optimizer?.prompt?.policy.writeScopeMode ?? "strict"
}

function buildReadyPrompt(
  pass: PatchPass,
  task: PatchTask,
  context: PatchContextPack,
  actionable: ExecutorScenario[],
  optimizer?: ResolvedOptimizerConfig,
): string {
  const lines: string[] = []
  const hasCurrentSignals = actionable.some((scenario) => scenario.reasons.some((reason) => !reason.startsWith("history ")))
  const hasHistorySignals = actionable.some((scenario) => scenario.reasons.some((reason) => reason.startsWith("history ")))
  lines.push("Task: execute one restricted Astra auto-patch attempt.")
  lines.push("Rules:")
  lines.push(getPromptWriteScopeMode(optimizer) === "evidence-led"
    ? "- Stay inside the write scope by default; widen it only when the inspected evidence shows the bug lives outside the current boundary."
    : "- Only edit files inside the write scope unless the evidence clearly requires a narrow expansion.")
  lines.push("- Fix only the actionable scenarios listed below.")
  lines.push("- Stop immediately if the fix becomes architectural instead of local.")
  lines.push("- Run `pnpm bench` and `pnpm test` after the attempt.")
  if (optimizer?.prompt || optimizer?.context) {
    lines.push("Optimizer configuration:")
    if (optimizer.prompt) {
      lines.push(`- prompt: ${optimizer.prompt.id} (${optimizer.prompt.label})`)
      lines.push(`- prompt policy: analysis=${optimizer.prompt.policy.analysisMode}, tools=${optimizer.prompt.policy.toolPolicy}, write-scope=${optimizer.prompt.policy.writeScopeMode}`)
    }
    if (optimizer.context) {
      lines.push(`- context: ${optimizer.context.id} (${optimizer.context.label}) [${optimizer.context.slots.join(", ")}]`)
      lines.push(`- context policy: ranking=${optimizer.context.policy.rankingMode}, maxFiles=${optimizer.context.policy.maxFiles}, maxLines=${optimizer.context.policy.maxLinesPerFile}, history=${optimizer.context.policy.preferHistory ? "preferred" : "trimmed"}`)
    }
  }
  if (getPromptAnalysisMode(optimizer) === "analysis-first") {
    lines.push("Analysis-first policy: inspect the actionable scenarios, candidate files, and write-scope boundary before proposing edits.")
  }
  if (getPromptToolPolicy(optimizer) === "read-before-edit") {
    lines.push("Tool policy: read the provided context bundle first and avoid speculative edits before those reads converge on a root cause.")
  }
  if (hasHistorySignals && !hasCurrentSignals) {
    lines.push("Ready path: history-backed signals only; no current explicit failure was required.")
  }

  const historySummary = buildHistoryReadinessSummary(actionable)
  if (historySummary.length > 0) {
    lines.push("History-backed readiness summary:")
    historySummary.forEach((line) => {
      lines.push(line)
    })
  }

  lines.push("Actionable scenarios:")
  actionable.forEach((scenario) => {
    lines.push(`- ${scenario.id}: ${scenario.reasons.join("; ")}`)
  })
  lines.push("Write scope:")
  pass.execution.writeScope.forEach((file) => {
    lines.push(`- ${file}`)
  })
  lines.push("Context bundle:")
  context.files.forEach((file) => {
    lines.push(`- ${file.path}`)
  })
  lines.push(`Patch pass brief: ${pass.prompt}`)
  lines.push(`Patch task brief: ${task.prompt}`)
  return lines.join("\n")
}

export function formatExecutorGateDecision(attempt: ExecutorAttempt): string[] {
  const lines: string[] = []
  const gateSummary = attempt.summary.gateSummary

  if (gateSummary.decision === "blocked") {
    lines.push("Decision: `blocked`")
    lines.push(`Why: ${gateSummary.reason ?? "Automatic patching is blocked."}`)
    return lines
  }

  const currentSignals: string[] = []
  const historySignals: string[] = []

  attempt.actionableScenarios.forEach((scenario) => {
    scenario.reasons.forEach((reason) => {
      const line = `- ${scenario.id}: ${reason}`
      if (reason.startsWith("history ")) {
        historySignals.push(line)
      } else {
        currentSignals.push(line)
      }
    })
  })

  lines.push("Decision: `ready`")
  lines.push(`Why: ${gateSummary.reason ?? "Current signal(s) made this attempt ready."}`)

  if (currentSignals.length > 0) {
    lines.push("Current signals:")
    lines.push(...currentSignals)
  }

  if (historySignals.length > 0) {
    lines.push("History-backed signals:")
    lines.push(...historySignals)
  }

  return lines
}

export function buildExecutorAttempt(
  plan: LoopPlan,
  task: PatchTask,
  context: PatchContextPack,
  pass: PatchPass,
  sourceArtifacts: ExecutorAttempt["sourceArtifacts"],
  options: {
    optimizer?: ResolvedOptimizerConfig
  } = {},
): ExecutorAttempt {
  const actionableScenarios = buildActionableScenarios(plan)
  const blockReason = actionableScenarios.length === 0
    ? "No selected scenario has a current failure/regression signal or a qualifying history recurrence/weak-surface signal. Automatic patching is blocked to avoid no-signal edits."
    : null
  const gateSummary = buildExecutorGateSummary(actionableScenarios.length > 0 ? "ready" : "blocked", actionableScenarios, blockReason)

  return {
    schemaVersion: 1,
    runId: plan.runId,
    generatedAt: new Date().toISOString(),
    sourceArtifacts,
    status: actionableScenarios.length > 0 ? "ready" : "blocked",
    summary: {
      selectedScenarioCount: plan.selectedItems.length,
      actionableScenarioCount: actionableScenarios.length,
      primaryScenarioId: task.focus.primaryScenarioId,
      blockReason,
      gateSummary,
    },
    actionableScenarios,
    writeScope: pass.execution.writeScope,
    prompt: actionableScenarios.length > 0
      ? buildReadyPrompt(pass, task, context, actionableScenarios, options.optimizer)
      : null,
  }
}

export function renderExecutorMarkdown(attempt: ExecutorAttempt): string {
  const lines: string[] = []
  lines.push("# Astra Executor Attempt")
  lines.push("")
  lines.push(`- Run ID: \`${attempt.runId}\``)
  lines.push(`- Generated: ${attempt.generatedAt}`)
  lines.push(`- Status: \`${attempt.status}\``)
  lines.push(`- Selected scenarios: ${attempt.summary.selectedScenarioCount}`)
  lines.push(`- Actionable scenarios: ${attempt.summary.actionableScenarioCount}`)
  lines.push(`- Primary scenario: \`${attempt.summary.primaryScenarioId ?? "none"}\``)
  lines.push("")

  lines.push("## Gate Decision")
  lines.push("")
  lines.push(...formatExecutorGateDecision(attempt))
  lines.push("")

  if (attempt.status === "blocked") {
    lines.push("## Guidance")
    lines.push("")
    lines.push("- Do not auto-edit from this pass.")
    lines.push("- Either accept the remaining imperfect score, or make a manual product/evaluator decision first.")
    return lines.join("\n").trimEnd() + "\n"
  }

  const historySummary = buildHistoryReadinessSummary(attempt.actionableScenarios)
  if (historySummary.length > 0) {
    lines.push("## History-backed readiness summary")
    lines.push("")
    historySummary.forEach((line) => {
      lines.push(line)
    })
    lines.push("")
  }

  lines.push("## Actionable Scenarios")
  lines.push("")
  attempt.actionableScenarios.forEach((scenario) => {
    lines.push(`- ${scenario.id} (${scenario.priority}, ${scenario.status})`)
    scenario.reasons.forEach((reason) => {
      lines.push(`  - ${reason}`)
    })
  })
  lines.push("")
  lines.push("## Write Scope")
  lines.push("")
  attempt.writeScope.forEach((file) => {
    lines.push(`- \`${file}\``)
  })
  lines.push("")
  lines.push("## Executor Prompt")
  lines.push("")
  lines.push("```text")
  lines.push(attempt.prompt ?? "")
  lines.push("```")

  return lines.join("\n").trimEnd() + "\n"
}
