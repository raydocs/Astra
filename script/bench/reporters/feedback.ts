import type { BenchmarkReport, ScenarioReport } from "../types"

function sortByPriority(scenarios: ScenarioReport[]) {
  return [...scenarios].sort((left, right) => {
    if (left.evaluation.pass !== right.evaluation.pass) {
      return left.evaluation.pass ? 1 : -1
    }

    return left.evaluation.total - right.evaluation.total
  })
}

function renderScenarioBlock(scenario: ScenarioReport) {
  const lines: string[] = []
  const status = scenario.evaluation.pass ? "PASS" : "FAIL"

  lines.push(`## ${scenario.id} (${status}, ${scenario.evaluation.total})`)
  lines.push(`- Surface: \`${scenario.surface}\``)
  lines.push(`- Fixture: \`${scenario.fixture}\``)
  lines.push(`- Task: ${scenario.task}`)

  if (scenario.evaluation.issues.length === 0) {
    lines.push("- Issues: none")
  } else {
    lines.push("- Issues:")
    scenario.evaluation.issues.forEach((issue) => {
      lines.push(`  - [${issue.severity}] ${issue.message}${issue.evidence ? ` (${issue.evidence})` : ""}`)
    })
  }

  if (scenario.evaluation.nextActions.length > 0) {
    lines.push("- Next actions:")
    scenario.evaluation.nextActions.forEach((action) => {
      lines.push(`  - ${action}`)
    })
  }

  lines.push("")
  return lines.join("\n")
}

function formatDelta(value: number | null) {
  if (value === null) return "new"
  if (value === 0) return "0"
  return value > 0 ? `+${value}` : `${value}`
}

export function renderFeedbackReport(report: BenchmarkReport) {
  const sorted = sortByPriority(report.scenarios)
  const failures = sorted.filter((scenario) => !scenario.evaluation.pass)
  const imperfectPasses = sorted.filter((scenario) => scenario.evaluation.pass && scenario.evaluation.total < 100)
  const regressions = report.comparison.scenarioDeltas
    .filter((delta) => delta.status === "regressed")
    .sort((left, right) => left.currentTotal - right.currentTotal)
  const improvements = report.comparison.scenarioDeltas
    .filter((delta) => delta.status === "improved")
    .sort((left, right) => right.currentTotal - left.currentTotal)

  const lines: string[] = []
  lines.push("# Astra Bench Feedback")
  lines.push("")
  lines.push(`- Run ID: \`${report.runId}\``)
  lines.push(`- Generated: ${report.generatedAt}`)
  lines.push(`- Average score: ${report.summary.averageTotal}`)
  lines.push(`- Passed: ${report.summary.passedScenarios}/${report.summary.totalScenarios}`)
  lines.push(`- Overall delta vs previous: ${formatDelta(report.comparison.overallDelta)}`)
  lines.push("")
  lines.push("## How To Use This")
  lines.push("")
  lines.push("Use this file as the handoff input for the next generator step.")
  lines.push("Fix regressions and failed scenarios first. Then improve passed scenarios that still score below 100.")
  lines.push("Do not change unrelated code paths.")
  lines.push("Use `data/bench-results/latest.handoff.json` when you want a machine-friendly priority list.")
  lines.push("")
  lines.push("## Regression Watch")
  lines.push("")

  if (regressions.length === 0) {
    lines.push("- No regressions versus the previous run.")
  } else {
    regressions.forEach((delta) => {
      const movedScores = delta.regressedScores.length ? ` regressed scores: ${delta.regressedScores.join(", ")}` : ""
      lines.push(`- ${delta.id} (${delta.previousTotal} -> ${delta.currentTotal}, ${formatDelta(delta.delta)})${movedScores}`)
    })
  }

  if (improvements.length > 0) {
    lines.push("")
    lines.push("## Improvements To Preserve")
    lines.push("")
    improvements.forEach((delta) => {
      const movedScores = delta.improvedScores.length ? ` improved scores: ${delta.improvedScores.join(", ")}` : ""
      lines.push(`- ${delta.id} (${delta.previousTotal} -> ${delta.currentTotal}, ${formatDelta(delta.delta)})${movedScores}`)
    })
  }

  lines.push("")
  lines.push("## Priority Order")
  lines.push("")

  if (failures.length === 0 && regressions.length === 0) {
    lines.push("- No failing or regressed scenarios in this run.")
  } else {
    regressions.forEach((delta) => {
      lines.push(`- ${delta.id} (regressed to ${delta.currentTotal})`)
    })
    failures.forEach((scenario) => {
      if (!regressions.some((delta) => delta.id === scenario.id)) {
        lines.push(`- ${scenario.id} (${scenario.evaluation.total})`)
      }
    })
  }

  if (imperfectPasses.length > 0) {
    lines.push("")
    lines.push("## Imperfect Passes")
    lines.push("")
    imperfectPasses.forEach((scenario) => {
      lines.push(`- ${scenario.id} (${scenario.evaluation.total})`)
    })
  }

  lines.push("")
  lines.push("## Generator Prompt Template")
  lines.push("")
  lines.push("```text")
  lines.push("Task: improve Astra against the latest bench feedback.")
  lines.push("Requirements:")
  lines.push("- Fix every failing scenario before improving partial passes.")
  lines.push("- Preserve existing passing behaviour.")
  lines.push("- Prefer the smallest defensible code change.")
  lines.push("- Re-run `pnpm bench` and `pnpm test` after changes.")
  lines.push("Source of truth:")
  lines.push(`- data/bench-results/latest.json`)
  lines.push(`- data/bench-results/latest.feedback.md`)
  lines.push(`- data/bench-results/latest.handoff.json`)
  lines.push("```")
  lines.push("")
  lines.push("## Scenario Details")
  lines.push("")

  sorted.forEach((scenario) => {
    const delta = report.comparison.scenarioDeltas.find((entry) => entry.id === scenario.id)
    if (delta) {
      lines.push(`### Comparison: ${scenario.id}`)
      lines.push(`- Status: \`${delta.status}\``)
      lines.push(`- Total delta: ${formatDelta(delta.delta)}`)
      const moved = delta.scoreDeltas.filter((entry) => entry.delta !== null && entry.delta !== 0)
      lines.push(`- Score deltas: ${moved.length ? moved.map((entry) => `${entry.key}:${formatDelta(entry.delta)}`).join(", ") : "none"}`)
      lines.push("")
    }
    lines.push(renderScenarioBlock(scenario))
  })

  return lines.join("\n").trimEnd() + "\n"
}
