import type { ExecutorAttempt, ExecutorScenario, LoopPlan, PatchContextPack, PatchPass, PatchTask } from "../types"

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

function buildActionableScenarios(plan: LoopPlan): ExecutorScenario[] {
  return plan.selectedItems
    .map((item) => ({
      id: item.id,
      surface: item.surface,
      priority: item.priority,
      status: item.status,
      pass: item.pass,
      reasons: getScenarioReasons(item),
    }))
    .filter((item) => item.reasons.length > 0)
}

function buildReadyPrompt(
  pass: PatchPass,
  task: PatchTask,
  context: PatchContextPack,
  actionable: ExecutorScenario[],
) {
  const lines: string[] = []
  lines.push("Task: execute one restricted Astra auto-patch attempt.")
  lines.push("Rules:")
  lines.push("- Only edit files inside the write scope unless the evidence clearly requires a narrow expansion.")
  lines.push("- Fix only the actionable scenarios listed below.")
  lines.push("- Stop immediately if the fix becomes architectural instead of local.")
  lines.push("- Run `pnpm bench` and `pnpm test` after the attempt.")
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

export function buildExecutorAttempt(
  plan: LoopPlan,
  task: PatchTask,
  context: PatchContextPack,
  pass: PatchPass,
  sourceArtifacts: ExecutorAttempt["sourceArtifacts"],
): ExecutorAttempt {
  const actionableScenarios = buildActionableScenarios(plan)
  const blockReason = actionableScenarios.length === 0
    ? "No selected scenario has an explicit failure, regression, issue, or next action. Automatic patching is blocked to avoid no-signal edits."
    : null

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
    },
    actionableScenarios,
    writeScope: pass.execution.writeScope,
    prompt: actionableScenarios.length > 0
      ? buildReadyPrompt(pass, task, context, actionableScenarios)
      : null,
  }
}

export function renderExecutorMarkdown(attempt: ExecutorAttempt) {
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

  if (attempt.status === "blocked") {
    lines.push("## Block Reason")
    lines.push("")
    lines.push(`- ${attempt.summary.blockReason}`)
    lines.push("")
    lines.push("## Guidance")
    lines.push("")
    lines.push("- Do not auto-edit from this pass.")
    lines.push("- Either accept the remaining imperfect score, or make a manual product/evaluator decision first.")
    return lines.join("\n").trimEnd() + "\n"
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
