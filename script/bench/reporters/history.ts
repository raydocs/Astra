import { readFile, readdir } from "node:fs/promises"
import path from "node:path"

import type { BenchmarkReport, BenchmarkSurface, SurfaceSummary } from "../types"

export interface HistoryRunSummary {
  runId: string
  generatedAt: string
  totalScenarios: number
  passedScenarios: number
  failedScenarios: number
  averageTotal: number
  regressions: number
  improvements: number
  weakestSurface: {
    surface: BenchmarkSurface
    averageTotal: number
  } | null
}

export interface HistorySurfaceSummary {
  surface: BenchmarkSurface
  runCount: number
  averageTotal: number
  earliestAverageTotal: number
  latestAverageTotal: number
  deltaFromFirst: number
  failureRuns: number
  direction: "improving" | "regressing" | "flat"
}

export interface HistoryFailureSummary {
  id: string
  title: string
  surface: BenchmarkSurface
  occurrenceCount: number
  failureCount: number
  regressionCount: number
  issueCount: number
  averageTotal: number
  worstTotal: number
  latestTotal: number
  lastSeenRunId: string
  lastSeenGeneratedAt: string
}

export interface HistoryReport {
  schemaVersion: 1
  generatedAt: string
  sourceDir: string
  totalRuns: number
  recentWindow: number
  trendWindow: number
  recentRuns: HistoryRunSummary[]
  weakestSurfaces: HistorySurfaceSummary[]
  surfaceTrends: HistorySurfaceSummary[]
  recurringFailures: HistoryFailureSummary[]
  notes: string[]
}

export interface HistoryCommandResult {
  report: HistoryReport
  text: string
}

interface SurfaceAggregate {
  surface: BenchmarkSurface
  runCount: number
  totalAverageSum: number
  earliestAverageTotal: number
  latestAverageTotal: number
  failureRuns: number
}

interface FailureAggregate {
  id: string
  title: string
  surface: BenchmarkSurface
  occurrenceCount: number
  failureCount: number
  regressionCount: number
  totalSum: number
  worstTotal: number
  latestTotal: number
  lastSeenRunId: string
  lastSeenGeneratedAt: string
}

const DEFAULT_HISTORY_DIR = path.join(path.resolve(process.env.ASTRA_BENCH_ARTIFACT_ROOT ?? path.join(process.cwd(), "data/bench-results")), "history")
const DEFAULT_RECENT_WINDOW = 5
const DEFAULT_TREND_WINDOW = 10
const DEFAULT_FAILURE_LIMIT = 10

function compareReports(left: BenchmarkReport, right: BenchmarkReport) {
  const leftTime = Date.parse(left.generatedAt) || 0
  const rightTime = Date.parse(right.generatedAt) || 0

  if (leftTime !== rightTime) {
    return leftTime - rightTime
  }

  return left.runId.localeCompare(right.runId)
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function formatDelta(value: number) {
  if (value === 0) {
    return "0"
  }

  return value > 0 ? `+${formatNumber(value)}` : formatNumber(value)
}

function summarizeWeakestSurface(surfaces: SurfaceSummary[]) {
  if (surfaces.length === 0) {
    return null
  }

  const weakest = surfaces.reduce((lowest, current) => (
    current.averageTotal < lowest.averageTotal
      ? current
      : lowest
  ))

  return {
    surface: weakest.surface,
    averageTotal: weakest.averageTotal,
  }
}

function buildRunSummary(report: BenchmarkReport): HistoryRunSummary {
  return {
    runId: report.runId,
    generatedAt: report.generatedAt,
    totalScenarios: report.summary.totalScenarios,
    passedScenarios: report.summary.passedScenarios,
    failedScenarios: report.summary.failedScenarios,
    averageTotal: report.summary.averageTotal,
    regressions: report.comparison.regressions,
    improvements: report.comparison.improvements,
    weakestSurface: summarizeWeakestSurface(report.summary.surfaces),
  }
}

function updateSurfaceAggregate(
  aggregates: Map<BenchmarkSurface, SurfaceAggregate>,
  report: BenchmarkReport,
) {
  report.summary.surfaces.forEach((surfaceSummary) => {
    const current = aggregates.get(surfaceSummary.surface)
    if (!current) {
      aggregates.set(surfaceSummary.surface, {
        surface: surfaceSummary.surface,
        runCount: 1,
        totalAverageSum: surfaceSummary.averageTotal,
        earliestAverageTotal: surfaceSummary.averageTotal,
        latestAverageTotal: surfaceSummary.averageTotal,
        failureRuns: surfaceSummary.failed > 0 ? 1 : 0,
      })
      return
    }

    current.runCount += 1
    current.totalAverageSum += surfaceSummary.averageTotal
    current.latestAverageTotal = surfaceSummary.averageTotal
    current.failureRuns += surfaceSummary.failed > 0 ? 1 : 0
  })
}

function updateFailureAggregate(
  aggregates: Map<string, FailureAggregate>,
  report: BenchmarkReport,
) {
  const comparisonByScenario = new Map(report.comparison.scenarioDeltas.map((delta) => [delta.id, delta]))

  report.scenarios.forEach((scenario) => {
    const previous = aggregates.get(scenario.id)
    const delta = comparisonByScenario.get(scenario.id)
    const total = scenario.evaluation.total
    const failureCount = scenario.evaluation.pass ? 0 : 1
    const regressionCount = delta?.status === "regressed" ? 1 : 0

    if (!previous) {
      aggregates.set(scenario.id, {
        id: scenario.id,
        title: scenario.title,
        surface: scenario.surface,
        occurrenceCount: 1,
        failureCount,
        regressionCount,
        totalSum: total,
        worstTotal: total,
        latestTotal: total,
        lastSeenRunId: report.runId,
        lastSeenGeneratedAt: report.generatedAt,
      })
      return
    }

    previous.occurrenceCount += 1
    previous.failureCount += failureCount
    previous.regressionCount += regressionCount
    previous.totalSum += total
    previous.worstTotal = Math.min(previous.worstTotal, total)
    previous.latestTotal = total
    previous.lastSeenRunId = report.runId
    previous.lastSeenGeneratedAt = report.generatedAt
  })
}

function buildSurfaceSummary(
  aggregate: SurfaceAggregate,
  directionOverride?: "improving" | "regressing" | "flat",
): HistorySurfaceSummary {
  const averageTotal = aggregate.totalAverageSum / aggregate.runCount
  const deltaFromFirst = aggregate.latestAverageTotal - aggregate.earliestAverageTotal
  const direction = directionOverride ?? (deltaFromFirst > 0 ? "improving" : deltaFromFirst < 0 ? "regressing" : "flat")

  return {
    surface: aggregate.surface,
    runCount: aggregate.runCount,
    averageTotal,
    earliestAverageTotal: aggregate.earliestAverageTotal,
    latestAverageTotal: aggregate.latestAverageTotal,
    deltaFromFirst,
    failureRuns: aggregate.failureRuns,
    direction,
  }
}

function buildSurfaceAggregates(reports: BenchmarkReport[]) {
  const aggregates = new Map<BenchmarkSurface, SurfaceAggregate>()

  reports.forEach((report) => {
    updateSurfaceAggregate(aggregates, report)
  })

  return [...aggregates.values()]
}

function buildFailureSummaries(reports: BenchmarkReport[]) {
  const aggregates = new Map<string, FailureAggregate>()

  reports.forEach((report) => {
    updateFailureAggregate(aggregates, report)
  })

  return [...aggregates.values()]
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      surface: entry.surface,
      occurrenceCount: entry.occurrenceCount,
      failureCount: entry.failureCount,
      regressionCount: entry.regressionCount,
      issueCount: entry.failureCount + entry.regressionCount,
      averageTotal: entry.totalSum / entry.occurrenceCount,
      worstTotal: entry.worstTotal,
      latestTotal: entry.latestTotal,
      lastSeenRunId: entry.lastSeenRunId,
      lastSeenGeneratedAt: entry.lastSeenGeneratedAt,
    }))
    .filter((entry) => entry.issueCount >= 2)
    .sort((left, right) => {
      if (right.issueCount !== left.issueCount) {
        return right.issueCount - left.issueCount
      }

      if (right.failureCount !== left.failureCount) {
        return right.failureCount - left.failureCount
      }

      return left.id.localeCompare(right.id)
    })
    .slice(0, DEFAULT_FAILURE_LIMIT)
}

export async function loadHistoryReports(historyDir = DEFAULT_HISTORY_DIR): Promise<BenchmarkReport[]> {
  let entries: string[] = []

  try {
    entries = await readdir(historyDir)
  } catch (error) {
    const failure = error as { code?: string } | null
    if (failure?.code === "ENOENT") {
      return []
    }

    throw error
  }

  const files = entries.filter((entry) => entry.endsWith(".json")).sort()
  const reports: BenchmarkReport[] = []

  for (const file of files) {
    const filePath = path.join(historyDir, file)
    const content = await readFile(filePath, "utf8")
    reports.push(JSON.parse(content) as BenchmarkReport)
  }

  return reports.sort(compareReports)
}

export function buildHistoryReport(
  reports: BenchmarkReport[],
  options: {
    historyDir?: string
    recentWindow?: number
    trendWindow?: number
  } = {},
): HistoryReport {
  const sortedReports = [...reports].sort(compareReports)
  const recentWindow = Math.max(1, options.recentWindow ?? DEFAULT_RECENT_WINDOW)
  const trendWindow = Math.max(2, options.trendWindow ?? DEFAULT_TREND_WINDOW)
  const recentSlice = sortedReports.slice(-recentWindow)
  const trendSlice = sortedReports.slice(-trendWindow)
  const trendSurfaces = buildSurfaceAggregates(trendSlice)
  const allSurfaces = buildSurfaceAggregates(sortedReports)
  const recurringFailures = buildFailureSummaries(sortedReports)

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceDir: options.historyDir ?? DEFAULT_HISTORY_DIR,
    totalRuns: sortedReports.length,
    recentWindow,
    trendWindow,
    recentRuns: recentSlice
      .reverse()
      .map(buildRunSummary),
    weakestSurfaces: allSurfaces
      .map((aggregate) => buildSurfaceSummary(aggregate))
      .sort((left, right) => {
        if (left.averageTotal !== right.averageTotal) {
          return left.averageTotal - right.averageTotal
        }

        if (left.failureRuns !== right.failureRuns) {
          return right.failureRuns - left.failureRuns
        }

        return left.surface.localeCompare(right.surface)
      }),
    surfaceTrends: trendSurfaces
    .map((aggregate) => buildSurfaceSummary(aggregate))
    .sort((left, right) => {
        const leftMagnitude = Math.abs(left.deltaFromFirst)
        const rightMagnitude = Math.abs(right.deltaFromFirst)

        if (leftMagnitude !== rightMagnitude) {
          return rightMagnitude - leftMagnitude
        }

        if (left.deltaFromFirst !== right.deltaFromFirst) {
          return right.deltaFromFirst - left.deltaFromFirst
        }

        if (left.averageTotal !== right.averageTotal) {
          return right.averageTotal - left.averageTotal
        }

        return left.surface.localeCompare(right.surface)
      }),
    recurringFailures,
    notes: [
      sortedReports.length === 0
        ? "No benchmark history files were found."
        : `Loaded ${sortedReports.length} historical benchmark run${sortedReports.length === 1 ? "" : "s"}.`,
      trendSlice.length === sortedReports.length
        ? `Trend window covers all available runs (${trendSlice.length}).`
        : `Trend window uses the latest ${trendSlice.length} runs.`,
      "Surface averages are aggregated per run; filtered runs only contribute the surfaces they recorded.",
      "Recurring failures count repeated non-passing or regressed scenarios across archived runs.",
    ],
  }
}

function renderSection(title: string, lines: string[]) {
  return [`## ${title}`, "", ...lines, ""]
}

function renderSurfaceLine(summary: HistorySurfaceSummary) {
  return `- \`${summary.surface}\`: avg ${formatNumber(summary.averageTotal)} (${summary.direction}, ${formatDelta(summary.deltaFromFirst)} over ${summary.runCount} run${summary.runCount === 1 ? "" : "s"}; failures ${summary.failureRuns})`
}

function renderFailureLine(summary: HistoryFailureSummary) {
  return `- \`${summary.id}\` [${summary.surface}] issue hits=${summary.issueCount} (failures ${summary.failureCount}, regressions ${summary.regressionCount}); latest ${summary.latestTotal}, worst ${summary.worstTotal}, avg ${formatNumber(summary.averageTotal)}`
}

export function renderHistoryMarkdown(report: HistoryReport) {
  const lines: string[] = []
  lines.push("# Astra Bench History")
  lines.push("")
  lines.push(`- Generated: ${report.generatedAt}`)
  lines.push(`- Source dir: \`${report.sourceDir}\``)
  lines.push(`- Runs analyzed: ${report.totalRuns}`)
  lines.push(`- Recent window: ${report.recentWindow}`)
  lines.push(`- Trend window: ${report.trendWindow}`)
  lines.push("")
  lines.push("## Notes")
  lines.push("")
  report.notes.forEach((note) => {
    lines.push(`- ${note}`)
  })
  lines.push("")

  lines.push(...renderSection("Recent Runs", report.recentRuns.map((run) => {
    const weakest = run.weakestSurface
      ? `; weakest surface ${run.weakestSurface.surface} (${formatNumber(run.weakestSurface.averageTotal)})`
      : ""
    return `- \`${run.runId}\` (${run.generatedAt}): total ${run.totalScenarios}, passed ${run.passedScenarios}, failed ${run.failedScenarios}, avg ${formatNumber(run.averageTotal)}, regressions ${run.regressions}, improvements ${run.improvements}${weakest}`
  })))

  if (report.surfaceTrends.length > 0) {
    lines.push(...renderSection("Surface Trends", report.surfaceTrends.map(renderSurfaceLine)))
  }

  if (report.weakestSurfaces.length > 0) {
    lines.push(...renderSection("Weakest Surfaces", report.weakestSurfaces.map(renderSurfaceLine)))
  }

  if (report.recurringFailures.length > 0) {
    lines.push(...renderSection("Recurring Failures / Regressions", report.recurringFailures.map(renderFailureLine)))
  } else {
    lines.push("## Recurring Failures / Regressions")
    lines.push("")
    lines.push("- No recurring failures or regressions were found in the archived history.")
    lines.push("")
  }

  return lines.join("\n").trimEnd() + "\n"
}

export async function runHistory(argv: string[] = process.argv.slice(2)): Promise<HistoryCommandResult> {
  void argv

  const historyDir = DEFAULT_HISTORY_DIR
  const reports = await loadHistoryReports(historyDir)
  const report = buildHistoryReport(reports, { historyDir })
  return {
    report,
    text: renderHistoryMarkdown(report),
  }
}
