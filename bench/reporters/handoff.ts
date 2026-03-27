import type {
  BenchmarkReport,
  GeneratorHandoff,
  GeneratorHandoffItem,
  ScenarioDelta,
  ScenarioReport,
} from "../types"

function getScenarioDelta(report: BenchmarkReport, scenarioId: string): ScenarioDelta | undefined {
  return report.comparison.scenarioDeltas.find((entry) => entry.id === scenarioId)
}

function getPriority(
  scenario: ScenarioReport,
  delta: ScenarioDelta | undefined,
): GeneratorHandoffItem["priority"] {
  if (!scenario.evaluation.pass || delta?.status === "regressed") {
    return "critical"
  }

  if (scenario.evaluation.total < 100 || delta?.status === "new") {
    return "high"
  }

  return "medium"
}

function comparePriority(left: GeneratorHandoffItem, right: GeneratorHandoffItem) {
  const priorityRank = {
    critical: 0,
    high: 1,
    medium: 2,
  } as const

  if (priorityRank[left.priority] !== priorityRank[right.priority]) {
    return priorityRank[left.priority] - priorityRank[right.priority]
  }

  if (left.pass !== right.pass) {
    return left.pass ? 1 : -1
  }

  return left.total - right.total
}

function renderSuggestedPrompt(
  scenario: ScenarioReport,
  delta: ScenarioDelta | undefined,
) {
  const lines: string[] = []
  lines.push(`Focus on scenario \`${scenario.id}\` (${scenario.surface}).`)
  lines.push("Keep existing passing behavior stable while improving this scored path.")

  if (delta?.status === "regressed") {
    lines.push(`This scenario regressed from ${delta.previousTotal} to ${delta.currentTotal}.`)
  } else if (delta?.status === "improved") {
    lines.push(`This scenario improved from ${delta.previousTotal} to ${delta.currentTotal}; preserve the gain while finishing the remaining issues.`)
  } else if (delta?.status === "new") {
    lines.push("This is a newly added benchmark scenario; treat it as a fresh contract.")
  }

  if (delta?.regressedScores.length) {
    lines.push(`Score regressions: ${delta.regressedScores.join(", ")}.`)
  }

  if (scenario.evaluation.issues.length) {
    lines.push(`Issues to address: ${scenario.evaluation.issues.map((issue) => issue.message).join(" ")}`)
  }

  if (scenario.evaluation.nextActions.length) {
    lines.push(`Next actions: ${scenario.evaluation.nextActions.join(" ")}`)
  }

  lines.push("Re-run `pnpm bench` and `pnpm test` after the change.")
  return lines.join(" ")
}

export function buildGeneratorHandoff(
  report: BenchmarkReport,
  sourceArtifacts: {
    latestJson: string
    latestFeedback: string
  },
): GeneratorHandoff {
  const priorities = report.scenarios
    .map((scenario) => {
      const delta = getScenarioDelta(report, scenario.id)
      return {
        id: scenario.id,
        title: scenario.title,
        surface: scenario.surface,
        status: delta?.status ?? "new",
        priority: getPriority(scenario, delta),
        total: scenario.evaluation.total,
        previousTotal: delta?.previousTotal ?? null,
        delta: delta?.delta ?? null,
        pass: scenario.evaluation.pass,
        issueCount: scenario.evaluation.issues.length,
        issues: scenario.evaluation.issues,
        nextActions: scenario.evaluation.nextActions,
        scoreDeltas: delta?.scoreDeltas ?? [],
        suggestedPrompt: renderSuggestedPrompt(scenario, delta),
        repairHints: scenario.repairHints,
      } satisfies GeneratorHandoffItem
    })
    .sort(comparePriority)

  return {
    schemaVersion: 1,
    runId: report.runId,
    generatedAt: report.generatedAt,
    sourceArtifacts,
    summary: {
      totalScenarios: report.summary.totalScenarios,
      failedScenarios: report.summary.failedScenarios,
      regressedScenarios: report.comparison.regressions,
      imperfectPasses: report.scenarios.filter((scenario) => scenario.evaluation.pass && scenario.evaluation.total < 100).length,
    },
    priorities,
  }
}

export function renderGeneratorMarkdown(handoff: GeneratorHandoff) {
  const lines: string[] = []
  lines.push("# Astra Generator Handoff")
  lines.push("")
  lines.push(`- Run ID: \`${handoff.runId}\``)
  lines.push(`- Failed scenarios: ${handoff.summary.failedScenarios}`)
  lines.push(`- Regressed scenarios: ${handoff.summary.regressedScenarios}`)
  lines.push(`- Imperfect passes: ${handoff.summary.imperfectPasses}`)
  lines.push(`- Latest JSON: \`${handoff.sourceArtifacts.latestJson}\``)
  lines.push(`- Latest feedback: \`${handoff.sourceArtifacts.latestFeedback}\``)
  lines.push("")
  lines.push("## Execution Order")
  lines.push("")

  const actionable = handoff.priorities.filter((item) => item.priority !== "medium")
  if (actionable.length === 0) {
    lines.push("- No failing or regressed scenarios. Preserve current behavior and only polish if needed.")
  } else {
    actionable.forEach((item) => {
      const delta = item.delta === null ? "new" : item.delta > 0 ? `+${item.delta}` : `${item.delta}`
      lines.push(`- [${item.priority}] ${item.id} (${item.total}, ${item.status}, delta ${delta})`)
    })
  }

  lines.push("")
  lines.push("## Generator Instructions")
  lines.push("")
  lines.push("```text")
  lines.push("Task: improve Astra against the latest bench handoff.")
  lines.push("Requirements:")
  lines.push("- Fix regressions and failing scenarios first.")
  lines.push("- Preserve existing passing behavior outside the target scenarios.")
  lines.push("- Prefer the smallest defensible change.")
  lines.push("- Use bench-results/latest.handoff.json and bench-results/latest.feedback.md as the evaluator truth.")
  lines.push("- Re-run `pnpm bench` and `pnpm test` after edits.")
  lines.push("```")
  lines.push("")
  lines.push("## Scenario Handoffs")
  lines.push("")

  handoff.priorities.forEach((item) => {
    lines.push(`### ${item.id}`)
    lines.push(`- Priority: \`${item.priority}\``)
    lines.push(`- Status: \`${item.status}\``)
    lines.push(`- Total: ${item.total}`)
    if (item.previousTotal !== null) {
      lines.push(`- Previous total: ${item.previousTotal}`)
    }
    const moved = item.scoreDeltas.filter((entry) => entry.delta !== null && entry.delta !== 0)
    lines.push(`- Score deltas: ${moved.length ? moved.map((entry) => `${entry.key}:${entry.delta! > 0 ? `+${entry.delta}` : entry.delta}`).join(", ") : "none"}`)
    lines.push(`- Issues: ${item.issues.length ? item.issues.map((issue) => `[${issue.severity}] ${issue.message}`).join(" | ") : "none"}`)
    if (item.repairHints) {
      lines.push(`- Repair hints: files=${item.repairHints.suspectedFiles.length}, symbols=${item.repairHints.suspectedSymbols.length}, keywords=${item.repairHints.suspectedKeywords.length}${item.repairHints.confidence ? `, confidence=${item.repairHints.confidence}` : ""}`)
    }
    lines.push(`- Prompt: ${item.suggestedPrompt}`)
    lines.push("")
  })

  return lines.join("\n").trimEnd() + "\n"
}
