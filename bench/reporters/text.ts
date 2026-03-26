import type { BenchmarkReport } from "../types"

function formatDelta(value: number | null) {
  if (value === null) return "n/a"
  if (value === 0) return "0"
  return value > 0 ? `+${value}` : `${value}`
}

export function renderTextReport(report: BenchmarkReport) {
  const lines: string[] = []

  lines.push(`Astra Bench Run ${report.runId}`)
  lines.push(`Generated: ${report.generatedAt}`)
  lines.push(`Scenarios: ${report.summary.totalScenarios}`)
  lines.push(`Passed: ${report.summary.passedScenarios}`)
  lines.push(`Failed: ${report.summary.failedScenarios}`)
  lines.push(`Average score: ${report.summary.averageTotal}`)
  lines.push(`Overall delta vs previous: ${formatDelta(report.comparison.overallDelta)}`)
  lines.push("")
  lines.push("Surface summary:")

  report.summary.surfaces.forEach((surface) => {
    lines.push(
      `- ${surface.surface}: ${surface.passed}/${surface.scenarioCount} passed, avg ${surface.averageTotal}`,
    )
  })

  lines.push("")
  lines.push("Scenario results:")

  report.scenarios.forEach((scenario) => {
    const status = scenario.evaluation.pass ? "PASS" : "FAIL"
    const critical = scenario.evaluation.issues.find((issue) => issue.severity === "critical")
    lines.push(`- [${status}] ${scenario.id} (${scenario.evaluation.total})`)
    if (critical) {
      lines.push(`  critical: ${critical.message}`)
    } else if (scenario.evaluation.issues[0]) {
      lines.push(`  note: ${scenario.evaluation.issues[0].message}`)
    }
  })

  return lines.join("\n")
}
