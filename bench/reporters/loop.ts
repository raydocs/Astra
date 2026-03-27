import type { ExecutorAttempt, GeneratorHandoff, GeneratorHandoffItem, HistoryPromptSummary, LoopPlan, ResolvedOptimizerConfig } from "../types"

import { formatExecutorGateDecision } from "./executor"

function getSelectionMode(handoff: GeneratorHandoff, includeMedium: boolean): LoopPlan["selection"]["mode"] {
  const hasCriticalOrHigh = handoff.priorities.some((item) => item.priority !== "medium")
  if (hasCriticalOrHigh && !includeMedium) {
    return "critical-high"
  }

  return "polish"
}

function addSelectionScore(reasons: string[], label: string, amount: number) {
  if (amount <= 0) {
    return 0
  }

  reasons.push(`${label} (+${amount})`)
  return amount
}

function buildBaseSelectionScore(item: GeneratorHandoffItem, inputIndex: number) {
  const reasons: string[] = []
  let total = 0

  total += addSelectionScore(reasons, `priority=${item.priority}`,
    item.priority === "critical"
      ? 140
      : item.priority === "high"
        ? 90
        : 45)

  total += addSelectionScore(reasons, `status=${item.status}`,
    item.status === "regressed"
      ? 90
      : item.status === "new"
        ? 36
        : item.status === "improved"
          ? 12
          : 0)

  if (!item.pass) {
    total += addSelectionScore(reasons, "pass=false", 40)
  }

  if (item.delta !== null && item.delta < 0) {
    total += addSelectionScore(reasons, `delta=${item.delta}`, Math.min(30, Math.abs(item.delta)))
  }

  if (item.issueCount > 0) {
    total += addSelectionScore(reasons, `issueCount=${item.issueCount}`, Math.min(18, item.issueCount * 4))
  }

  const negativeScoreDeltas = item.scoreDeltas.filter((entry) => typeof entry.delta === "number" && entry.delta < 0).length
  if (negativeScoreDeltas > 0) {
    total += addSelectionScore(reasons, `negative score deltas=${negativeScoreDeltas}`, Math.min(15, negativeScoreDeltas * 5))
  }

  total += addSelectionScore(reasons, `handoff order=${inputIndex + 1}`, Math.max(1, 12 - inputIndex))

  return { total, reasons }
}

function buildSyntheticDrillHistory(
  base: GeneratorHandoffItem,
  drillReason?: string,
): HistoryPromptSummary {
  const latestTotal = Math.max(0, base.total - 6)
  const worstTotal = Math.max(0, base.total - 18)

  return {
    sourceJsonPath: null,
    sourceMarkdownPath: null,
    totalRuns: 1,
    notes: [
      "Synthetic drill history added to exercise a history-backed ready path.",
      ...(drillReason ? [drillReason] : []),
    ],
    weakestSurfaces: [{
      surface: base.surface,
      averageTotal: Math.max(0, base.total - 8),
      direction: "regressing",
      failureRuns: 1,
    }],
    recurringFailures: [{
      id: base.id,
      surface: base.surface,
      issueCount: 3,
      failureCount: 1,
      regressionCount: 1,
      averageTotal: Math.max(0, base.total - 10),
      latestTotal,
      worstTotal,
    }],
  }
}

function ensureDrillHistoryReady(
  base: GeneratorHandoffItem,
  history: HistoryPromptSummary | undefined,
  drillReason?: string,
): HistoryPromptSummary {
  const synthetic = buildSyntheticDrillHistory(base, drillReason)
  if (!history) {
    return synthetic
  }

  const hasRecurringSignal = history.recurringFailures.some((entry) => entry.id === base.id)
  const hasWeakSurfaceSignal = history.weakestSurfaces.some((entry) => entry.surface === base.surface)

  if (hasRecurringSignal || hasWeakSurfaceSignal) {
    return {
      ...history,
      notes: [
        ...history.notes,
        "Drill mode is using the existing history-backed ready path.",
      ],
    }
  }

  return {
    ...history,
    notes: [
      ...history.notes,
      "Drill mode appended a synthetic history-backed ready signal.",
    ],
    recurringFailures: [synthetic.recurringFailures[0], ...history.recurringFailures].slice(0, 4),
    weakestSurfaces: [synthetic.weakestSurfaces[0], ...history.weakestSurfaces].slice(0, 3),
  }
}

function buildHistorySelectionScore(item: GeneratorHandoffItem, history?: HistoryPromptSummary) {
  const reasons: string[] = []
  let total = 0

  if (!history) {
    return { total, reasons }
  }

  const recurring = history.recurringFailures.find((entry) => entry.id === item.id)
  if (recurring) {
    total += addSelectionScore(reasons, `history recurring scenario issue hits=${recurring.issueCount}`, 90 + Math.min(36, recurring.issueCount * 6))

    if ((recurring.regressionCount ?? 0) > 0) {
      total += addSelectionScore(reasons, `history recurring regressions=${recurring.regressionCount}`, Math.min(30, (recurring.regressionCount ?? 0) * 10))
    }

    if ((recurring.failureCount ?? 0) > 0) {
      total += addSelectionScore(reasons, `history recurring failures=${recurring.failureCount}`, Math.min(24, (recurring.failureCount ?? 0) * 6))
    }

    if (typeof recurring.averageTotal === "number" && recurring.averageTotal < 100) {
      total += addSelectionScore(reasons, `history recurring avg=${recurring.averageTotal.toFixed(1)}`, Math.min(18, Math.ceil((100 - recurring.averageTotal) / 3)))
    }

    if (recurring.latestTotal < 100) {
      total += addSelectionScore(reasons, `history latest total=${recurring.latestTotal}`, Math.min(18, Math.ceil((100 - recurring.latestTotal) / 3)))
    }

    if (recurring.worstTotal < recurring.latestTotal) {
      total += addSelectionScore(reasons, `history relapse gap=${recurring.latestTotal - recurring.worstTotal}`, Math.min(12, Math.ceil((recurring.latestTotal - recurring.worstTotal) / 4)))
    }
  }

  const weakSurface = history.weakestSurfaces.find((entry) => entry.surface === item.surface)
  if (weakSurface) {
    if (weakSurface.direction === "regressing") {
      total += addSelectionScore(reasons, `history surface trend=${weakSurface.surface}:regressing`, 36)
    }

    if (weakSurface.failureRuns > 0) {
      total += addSelectionScore(reasons, `history surface failure runs=${weakSurface.failureRuns}`, Math.min(24, weakSurface.failureRuns * 4))
    }

    if (weakSurface.averageTotal < 100) {
      total += addSelectionScore(reasons, `history surface avg=${weakSurface.averageTotal.toFixed(1)}`, Math.min(24, Math.ceil((100 - weakSurface.averageTotal) / 2)))
    }
  }

  return { total, reasons }
}

function rankSelectedItems(
  candidates: GeneratorHandoffItem[],
  maxItems: number,
  history?: HistoryPromptSummary,
): GeneratorHandoffItem[] {
  return candidates
    .map((item, inputIndex) => {
      const base = buildBaseSelectionScore(item, inputIndex)
      const historyScore = buildHistorySelectionScore(item, history)
      return {
        item: {
          ...item,
          selectionScore: base.total + historyScore.total,
          selectionReasons: [...base.reasons, ...historyScore.reasons],
        },
        inputIndex,
      }
    })
    .sort((left, right) => {
      const scoreDelta = (right.item.selectionScore ?? 0) - (left.item.selectionScore ?? 0)
      if (scoreDelta !== 0) {
        return scoreDelta
      }

      return left.inputIndex - right.inputIndex
    })
    .slice(0, maxItems)
    .map((entry) => entry.item)
}

export function buildLoopPlan(
  handoff: GeneratorHandoff,
  sourceArtifacts: LoopPlan["sourceArtifacts"],
  options: {
    maxItems?: number
    includeMedium?: boolean
    drillScenarioId?: string
    drillReason?: string
    drillHistoryReady?: boolean
    history?: HistoryPromptSummary
    optimizer?: ResolvedOptimizerConfig
  } = {},
): LoopPlan {
  const maxItems = Math.max(1, options.maxItems ?? 3)
  const includeMedium = options.includeMedium ?? false
  const mode = getSelectionMode(handoff, includeMedium)
  const candidates = includeMedium
    ? handoff.priorities
    : handoff.priorities.filter((item) => item.priority !== "medium")
  const drillHistoryReady = options.drillHistoryReady ?? false
  const selectedItems = options.drillScenarioId
    ? (() => {
        const base = handoff.priorities.find((item) => item.id === options.drillScenarioId)
        if (!base) {
          throw new Error(`Drill scenario not found in handoff: ${options.drillScenarioId}`)
        }

        if (drillHistoryReady) {
          return [{
            ...base,
            status: "unchanged" as const,
            pass: true,
            issueCount: 0,
            issues: [],
            nextActions: [],
            selectionScore: Number.MAX_SAFE_INTEGER,
            selectionReasons: [
              `drill mode scenario=${base.id}`,
              "drill mode history-backed ready path",
              options.drillReason
                ? `drill reason: ${options.drillReason}`
                : "drill reason: exercise the history-backed ready path.",
            ],
          }]
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
          selectionScore: Number.MAX_SAFE_INTEGER,
          selectionReasons: [
            `drill mode scenario=${base.id}`,
            options.drillReason
              ? `drill reason: ${options.drillReason}`
              : "drill reason: exercise the full patch loop for this scenario.",
          ],
        }]
      })()
    : rankSelectedItems(candidates, maxItems, options.history)

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
      reason: options.drillScenarioId
        ? (drillHistoryReady
            ? (options.drillReason ?? "Exercise the history-backed ready path for this scenario.")
            : (options.drillReason ?? "Exercise the full patch loop for this scenario."))
        : null,
      ...(options.drillScenarioId && drillHistoryReady ? { historyReady: true } : {}),
    },
    summary: drillHistoryReady
      ? handoff.summary
      : {
          failedScenarios: options.drillScenarioId ? 1 : handoff.summary.failedScenarios,
          regressedScenarios: options.drillScenarioId ? 1 : handoff.summary.regressedScenarios,
          imperfectPasses: handoff.summary.imperfectPasses,
        },
    ...(options.history || drillHistoryReady
      ? {
          history: drillHistoryReady
            ? ensureDrillHistoryReady(
                selectedItems[0]!,
                options.history,
                options.drillReason,
              )
            : options.history,
        }
      : {}),
    ...(options.optimizer ? { optimizer: options.optimizer } : {}),
    selectedItems,
  }
}

function renderHistoryLine(plan: LoopPlan, line: string) {
  return `- ${line}`
}

function buildHistoryHighlights(plan: LoopPlan): string[] {
  const history = plan.history
  if (!history) {
    return []
  }

  const selectedScenarioIds = new Set(plan.selectedItems.map((item) => item.id))
  const selectedSurfaces = new Set(plan.selectedItems.map((item) => item.surface))
  const lines: string[] = []
  lines.push(`History runs analyzed: ${history.totalRuns}`)

  const relevantRecurring = history.recurringFailures.filter((entry) => (
    selectedScenarioIds.has(entry.id) || selectedSurfaces.has(entry.surface)
  ))
  const recurring = (relevantRecurring.length > 0 ? relevantRecurring : history.recurringFailures).slice(0, 3)
  recurring.forEach((entry) => {
    lines.push(`Recurring: ${entry.id} (${entry.surface}) issue hits=${entry.issueCount}, latest=${entry.latestTotal}, worst=${entry.worstTotal}`)
  })

  const relevantWeakSurfaces = history.weakestSurfaces.filter((entry) => selectedSurfaces.has(entry.surface))
  const weakest = (relevantWeakSurfaces.length > 0 ? relevantWeakSurfaces : history.weakestSurfaces).slice(0, 3)
  weakest.forEach((entry) => {
    lines.push(`Surface trend: ${entry.surface} avg ${entry.averageTotal.toFixed(1)} (${entry.direction}, failures ${entry.failureRuns})`)
  })

  return lines
}

function renderScenarioLine(item: GeneratorHandoffItem) {
  const delta = item.delta === null ? "new" : item.delta > 0 ? `+${item.delta}` : `${item.delta}`
  const reasons = item.selectionReasons?.length
    ? `; reasons: ${item.selectionReasons.slice(0, 3).join(" | ")}`
    : ""
  return `- [${item.priority}] ${item.id} (${item.total}, ${item.status}, delta ${delta}${item.selectionScore !== undefined ? `, score ${item.selectionScore}` : ""})${reasons}`
}

export function renderLoopMarkdown(plan: LoopPlan, executorAttempt?: ExecutorAttempt) {
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
  if (plan.sourceArtifacts.latestHistoryJson) {
    lines.push(`- Latest history JSON: \`${plan.sourceArtifacts.latestHistoryJson}\``)
  }
  if (plan.sourceArtifacts.latestHistoryMarkdown) {
    lines.push(`- Latest history Markdown: \`${plan.sourceArtifacts.latestHistoryMarkdown}\``)
  }
  if (plan.drill.enabled) {
    lines.push(`- Drill scenario: \`${plan.drill.scenarioId}\``)
    lines.push(`- Drill reason: ${plan.drill.reason}`)
    if (plan.drill.historyReady) {
      lines.push("- Drill mode: history-backed ready path")
    }
  }
  if (plan.optimizer) {
    lines.push(`- Optimizer source: \`${plan.optimizer.sourcePath}\``)
    lines.push(`- Optimizer mode: \`${plan.optimizer.sourceKind}\``)
    if (plan.optimizer.prompt) {
      lines.push(`- Optimizer prompt: \`${plan.optimizer.prompt.id}\` (${plan.optimizer.prompt.label})`)
    }
    if (plan.optimizer.context) {
      lines.push(`- Optimizer context: \`${plan.optimizer.context.id}\` (${plan.optimizer.context.label})`)
      lines.push(`- Optimizer slots: ${plan.optimizer.context.slots.join(", ")}`)
    }
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

  const historyHighlights = buildHistoryHighlights(plan)
  if (historyHighlights.length > 0) {
    lines.push("")
    lines.push("## History Signals")
    lines.push("")
    historyHighlights.forEach((line) => {
      lines.push(renderHistoryLine(plan, line))
    })
  }

  if (executorAttempt) {
    lines.push("")
    lines.push("## Executor Gate")
    lines.push("")
    lines.push(...formatExecutorGateDecision(executorAttempt))
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
    if (item.selectionScore !== undefined) {
      lines.push(`- Selection score: ${item.selectionScore}`)
    }
    if (item.selectionReasons && item.selectionReasons.length > 0) {
      lines.push(`- Selection reasons: ${item.selectionReasons.join(" | ")}`)
    }
    if (item.previousTotal !== null) {
      lines.push(`- Previous total: ${item.previousTotal}`)
    }
    lines.push(`- Score deltas: ${moved.length ? moved.map((entry) => `${entry.key}:${entry.delta! > 0 ? `+${entry.delta}` : entry.delta}`).join(", ") : "none"}`)
    lines.push(`- Issues: ${item.issues.length ? item.issues.map((issue) => `[${issue.severity}] ${issue.message}`).join(" | ") : "none"}`)
    if (item.repairHints) {
      lines.push(`- Repair hints: files=${item.repairHints.suspectedFiles.length}, symbols=${item.repairHints.suspectedSymbols.length}, keywords=${item.repairHints.suspectedKeywords.length}${item.repairHints.confidence ? `, confidence=${item.repairHints.confidence}` : ""}`)
    }
    lines.push(`- Suggested prompt: ${item.suggestedPrompt}`)
    lines.push("")
  })

  return lines.join("\n").trimEnd() + "\n"
}
