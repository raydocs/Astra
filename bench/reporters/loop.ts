import type { GeneratorHandoff, GeneratorHandoffItem, LoopPlan } from "../types"

function getSelectionMode(handoff: GeneratorHandoff, includeMedium: boolean): LoopPlan["selection"]["mode"] {
  const hasCriticalOrHigh = handoff.priorities.some((item) => item.priority !== "medium")
  if (hasCriticalOrHigh && !includeMedium) {
    return "critical-high"
  }

  return "polish"
}

export function buildLoopPlan(
  handoff: GeneratorHandoff,
  sourceArtifacts: LoopPlan["sourceArtifacts"],
  options: {
    maxItems?: number
    includeMedium?: boolean
    drillScenarioId?: string
    drillReason?: string
  } = {},
): LoopPlan {
  const maxItems = Math.max(1, options.maxItems ?? 3)
  const includeMedium = options.includeMedium ?? false
  const mode = getSelectionMode(handoff, includeMedium)
  const candidates = includeMedium
    ? handoff.priorities
    : handoff.priorities.filter((item) => item.priority !== "medium")
  const selectedItems = options.drillScenarioId
    ? (() => {
        const base = handoff.priorities.find((item) => item.id === options.drillScenarioId)
        if (!base) {
          throw new Error(`Drill scenario not found in handoff: ${options.drillScenarioId}`)
        }

        return [{
          ...base,
          priority: "critical" as const,
          status: "regressed" as const,
          pass: false,
          total: Math.min(base.total, 60),
          previousTotal: base.previousTotal ?? base.total,
          delta: base.previousTotal === null ? -40 : Math.min(-1, (base.delta ?? 0) - 40),
          issueCount: base.issueCount + 1,
          issues: [
            ...base.issues,
            {
              severity: "high" as const,
              message: `Drill mode injected an executor-ready failure for ${base.id}. ${options.drillReason ?? "Use this to exercise the full patch loop."}`,
            },
          ],
          nextActions: [
            ...base.nextActions,
            options.drillReason
              ? `Drill mode: ${options.drillReason}`
              : "Drill mode: exercise the full patch loop for this scenario.",
          ],
          suggestedPrompt: [
            `Drill mode is active for \`${base.id}\`.`,
            options.drillReason ?? "Exercise the full patch loop for this scenario.",
            base.suggestedPrompt,
          ].join(" "),
        }]
      })()
    : candidates.slice(0, maxItems)

  return {
    schemaVersion: 1,
    runId: handoff.runId,
    generatedAt: new Date().toISOString(),
    sourceArtifacts,
    selection: {
      maxItems,
      includeMedium,
      selectedCount: selectedItems.length,
      mode,
    },
    drill: {
      enabled: !!options.drillScenarioId,
      scenarioId: options.drillScenarioId ?? null,
      reason: options.drillScenarioId ? (options.drillReason ?? "Exercise the full patch loop for this scenario.") : null,
    },
    summary: {
      failedScenarios: options.drillScenarioId ? 1 : handoff.summary.failedScenarios,
      regressedScenarios: options.drillScenarioId ? 1 : handoff.summary.regressedScenarios,
      imperfectPasses: handoff.summary.imperfectPasses,
    },
    selectedItems,
  }
}

function renderScenarioLine(item: GeneratorHandoffItem) {
  const delta = item.delta === null ? "new" : item.delta > 0 ? `+${item.delta}` : `${item.delta}`
  return `- [${item.priority}] ${item.id} (${item.total}, ${item.status}, delta ${delta})`
}

export function renderLoopMarkdown(plan: LoopPlan) {
  const lines: string[] = []
  lines.push("# Astra Loop Task")
  lines.push("")
  lines.push(`- Run ID: \`${plan.runId}\``)
  lines.push(`- Generated: ${plan.generatedAt}`)
  lines.push(`- Mode: \`${plan.selection.mode}\``)
  lines.push(`- Selected items: ${plan.selection.selectedCount}/${plan.selection.maxItems}`)
  lines.push(`- Latest handoff: \`${plan.sourceArtifacts.latestHandoff}\``)
  lines.push(`- Latest feedback: \`${plan.sourceArtifacts.latestFeedback}\``)
  lines.push(`- Latest JSON: \`${plan.sourceArtifacts.latestJson}\``)
  if (plan.drill.enabled) {
    lines.push(`- Drill scenario: \`${plan.drill.scenarioId}\``)
    lines.push(`- Drill reason: ${plan.drill.reason}`)
  }
  lines.push("")
  lines.push("## Task Order")
  lines.push("")

  if (plan.selectedItems.length === 0) {
    lines.push("- No critical or high-priority scenarios selected. The current run is stable enough to stop or manually polish medium-priority items.")
  } else {
    plan.selectedItems.forEach((item) => {
      lines.push(renderScenarioLine(item))
    })
  }

  lines.push("")
  lines.push("## Execution Checklist")
  lines.push("")
  lines.push("1. Read the selected scenario prompts below.")
  lines.push("2. Implement the smallest change that improves those scenarios without regressing existing passes.")
  lines.push("3. Run `pnpm bench`.")
  lines.push("4. If regressions or failures remain, run `pnpm bench:loop` again and follow the new task order.")
  lines.push("5. When bench is clean enough, run `pnpm test`.")
  lines.push("")
  lines.push("## Selected Scenario Prompts")
  lines.push("")

  plan.selectedItems.forEach((item) => {
    const moved = item.scoreDeltas.filter((entry) => entry.delta !== null && entry.delta !== 0)
    lines.push(`### ${item.id}`)
    lines.push(`- Priority: \`${item.priority}\``)
    lines.push(`- Status: \`${item.status}\``)
    lines.push(`- Total: ${item.total}`)
    if (item.previousTotal !== null) {
      lines.push(`- Previous total: ${item.previousTotal}`)
    }
    lines.push(`- Score deltas: ${moved.length ? moved.map((entry) => `${entry.key}:${entry.delta! > 0 ? `+${entry.delta}` : entry.delta}`).join(", ") : "none"}`)
    lines.push(`- Issues: ${item.issues.length ? item.issues.map((issue) => `[${issue.severity}] ${issue.message}`).join(" | ") : "none"}`)
    lines.push(`- Suggested prompt: ${item.suggestedPrompt}`)
    lines.push("")
  })

  return lines.join("\n").trimEnd() + "\n"
}
