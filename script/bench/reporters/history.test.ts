import { mkdtemp, writeFile, rm } from "node:fs/promises"
import path from "node:path"
import { tmpdir } from "node:os"

import { describe, expect, it } from "vitest"

import type { BenchmarkReport } from "../types"
import { buildHistoryReport, loadHistoryReports, renderHistoryMarkdown } from "./history"

function makeReport(options: {
  runId: string
  generatedAt: string
  totalScenarios: number
  passedScenarios: number
  failedScenarios: number
  averageTotal: number
  surfaces: Array<{
    surface: "page-translation" | "hover"
    scenarioCount: number
    passed: number
    failed: number
    averageTotal: number
  }>
  scenarios: Array<{
    id: string
    title: string
    surface: "page-translation" | "hover"
    total: number
    pass: boolean
  }>
  comparison: BenchmarkReport["comparison"]
}): BenchmarkReport {
  return {
    schemaVersion: 1,
    runId: options.runId,
    generatedAt: options.generatedAt,
    filter: { surface: null, split: null },
    summary: {
      totalScenarios: options.totalScenarios,
      passedScenarios: options.passedScenarios,
      failedScenarios: options.failedScenarios,
      averageTotal: options.averageTotal,
      surfaces: options.surfaces.map((surface) => ({
        surface: surface.surface,
        scenarioCount: surface.scenarioCount,
        passed: surface.passed,
        failed: surface.failed,
        averageTotal: surface.averageTotal,
      })),
    },
    comparison: options.comparison,
    scenarios: options.scenarios.map((scenario) => ({
      id: scenario.id,
      title: scenario.title,
      surface: scenario.surface,
      fixture: `${scenario.surface}-fixture`,
      task: scenario.title,
      execution: {},
      evaluation: {
        scores: {
          correctness: scenario.total / 10,
          completeness: scenario.total / 10,
          stability: scenario.total / 10,
        },
        total: scenario.total,
        pass: scenario.pass,
        issues: scenario.pass ? [] : [{ severity: "high", message: "Needs attention" }],
        artifacts: {},
        nextActions: [],
      },
    })),
  }
}

describe("history reporter", () => {
  it("aggregates recent runs, trends, weakest surfaces, and recurring failures", () => {
    const reports = [
      makeReport({
        runId: "2026-03-26T07-00-00-000Z",
        generatedAt: "2026-03-26T07:00:00.000Z",
        totalScenarios: 4,
        passedScenarios: 2,
        failedScenarios: 2,
        averageTotal: 60,
        surfaces: [
          { surface: "hover", scenarioCount: 2, passed: 1, failed: 1, averageTotal: 40 },
          { surface: "page-translation", scenarioCount: 2, passed: 1, failed: 1, averageTotal: 80 },
        ],
        scenarios: [
          { id: "hover/alt-success", title: "Hover works", surface: "hover", total: 40, pass: false },
          { id: "hover/steady", title: "Hover steady", surface: "hover", total: 40, pass: true },
          { id: "page-translation/provider-error-graceful", title: "Provider error graceful", surface: "page-translation", total: 80, pass: false },
          { id: "page-translation/article-basic-bilingual", title: "Article bilingual", surface: "page-translation", total: 80, pass: true },
        ],
        comparison: {
          previousRunId: null,
          previousGeneratedAt: null,
          overallDelta: null,
          regressions: 2,
          improvements: 0,
          unchanged: 2,
          added: 4,
          scenarioDeltas: [
            {
              id: "hover/alt-success",
              previousTotal: 80,
              currentTotal: 40,
              delta: -40,
              status: "regressed",
              wasPassing: true,
              isPassing: false,
              scoreDeltas: [],
              regressedScores: [],
              improvedScores: [],
            },
            {
              id: "page-translation/provider-error-graceful",
              previousTotal: 90,
              currentTotal: 80,
              delta: -10,
              status: "regressed",
              wasPassing: true,
              isPassing: false,
              scoreDeltas: [],
              regressedScores: [],
              improvedScores: [],
            },
            {
              id: "hover/steady",
              previousTotal: 40,
              currentTotal: 40,
              delta: 0,
              status: "unchanged",
              wasPassing: true,
              isPassing: true,
              scoreDeltas: [],
              regressedScores: [],
              improvedScores: [],
            },
            {
              id: "page-translation/article-basic-bilingual",
              previousTotal: 80,
              currentTotal: 80,
              delta: 0,
              status: "unchanged",
              wasPassing: true,
              isPassing: true,
              scoreDeltas: [],
              regressedScores: [],
              improvedScores: [],
            },
          ],
        },
      }),
      makeReport({
        runId: "2026-03-26T08-00-00-000Z",
        generatedAt: "2026-03-26T08:00:00.000Z",
        totalScenarios: 4,
        passedScenarios: 3,
        failedScenarios: 1,
        averageTotal: 75,
        surfaces: [
          { surface: "hover", scenarioCount: 2, passed: 2, failed: 0, averageTotal: 70 },
          { surface: "page-translation", scenarioCount: 2, passed: 1, failed: 1, averageTotal: 90 },
        ],
        scenarios: [
          { id: "hover/alt-success", title: "Hover works", surface: "hover", total: 70, pass: true },
          { id: "hover/steady", title: "Hover steady", surface: "hover", total: 70, pass: true },
          { id: "page-translation/provider-error-graceful", title: "Provider error graceful", surface: "page-translation", total: 90, pass: false },
          { id: "page-translation/article-basic-bilingual", title: "Article bilingual", surface: "page-translation", total: 90, pass: true },
        ],
        comparison: {
          previousRunId: "2026-03-26T07-00-00-000Z",
          previousGeneratedAt: "2026-03-26T07:00:00.000Z",
          overallDelta: 15,
          regressions: 1,
          improvements: 1,
          unchanged: 2,
          added: 0,
          scenarioDeltas: [
            {
              id: "hover/alt-success",
              previousTotal: 40,
              currentTotal: 70,
              delta: 30,
              status: "improved",
              wasPassing: false,
              isPassing: true,
              scoreDeltas: [],
              regressedScores: [],
              improvedScores: [],
            },
            {
              id: "page-translation/provider-error-graceful",
              previousTotal: 80,
              currentTotal: 90,
              delta: 10,
              status: "regressed",
              wasPassing: false,
              isPassing: false,
              scoreDeltas: [],
              regressedScores: [],
              improvedScores: [],
            },
            {
              id: "hover/steady",
              previousTotal: 40,
              currentTotal: 70,
              delta: 30,
              status: "improved",
              wasPassing: true,
              isPassing: true,
              scoreDeltas: [],
              regressedScores: [],
              improvedScores: [],
            },
            {
              id: "page-translation/article-basic-bilingual",
              previousTotal: 80,
              currentTotal: 90,
              delta: 10,
              status: "improved",
              wasPassing: true,
              isPassing: true,
              scoreDeltas: [],
              regressedScores: [],
              improvedScores: [],
            },
          ],
        },
      }),
    ]

    const report = buildHistoryReport(reports, { historyDir: "/tmp/history", recentWindow: 2, trendWindow: 2 })

    expect(report.totalRuns).toBe(2)
    expect(report.recentRuns).toHaveLength(2)
    expect(report.recentRuns[0]?.runId).toBe("2026-03-26T08-00-00-000Z")
    expect(report.recentRuns[1]?.runId).toBe("2026-03-26T07-00-00-000Z")

    expect(report.surfaceTrends.map((entry) => entry.surface)).toEqual(["hover", "page-translation"])
    expect(report.surfaceTrends[0]?.deltaFromFirst).toBe(30)
    expect(report.surfaceTrends[1]?.deltaFromFirst).toBe(10)

    expect(report.weakestSurfaces.map((entry) => entry.surface)).toEqual(["hover", "page-translation"])
    expect(report.weakestSurfaces[0]?.averageTotal).toBe(55)
    expect(report.weakestSurfaces[1]?.averageTotal).toBe(85)

    expect(report.recurringFailures.map((entry) => entry.id)).toEqual([
      "page-translation/provider-error-graceful",
      "hover/alt-success",
    ])
    expect(report.recurringFailures[0]?.issueCount).toBe(4)
    expect(report.recurringFailures[1]?.issueCount).toBe(2)

    const markdown = renderHistoryMarkdown(report)
    expect(markdown).toContain("# Astra Bench History")
    expect(markdown).toContain("## Recent Runs")
    expect(markdown).toContain("## Surface Trends")
    expect(markdown).toContain("## Weakest Surfaces")
    expect(markdown).toContain("## Recurring Failures / Regressions")
    expect(markdown).toContain("hover/alt-success")
    expect(markdown).toContain("provider-error-graceful")
  })

  it("loads history reports from disk in deterministic order", async () => {
    const historyDir = await mkdtemp(path.join(tmpdir(), "astra-history-"))
    const runA = makeReport({
      runId: "2026-03-26T01-00-00-000Z",
      generatedAt: "2026-03-26T01:00:00.000Z",
      totalScenarios: 1,
      passedScenarios: 1,
      failedScenarios: 0,
      averageTotal: 100,
      surfaces: [
        { surface: "hover", scenarioCount: 1, passed: 1, failed: 0, averageTotal: 100 },
      ],
      scenarios: [
        { id: "hover/steady", title: "Hover steady", surface: "hover", total: 100, pass: true },
      ],
      comparison: {
        previousRunId: null,
        previousGeneratedAt: null,
        overallDelta: null,
        regressions: 0,
        improvements: 0,
        unchanged: 1,
        added: 1,
        scenarioDeltas: [],
      },
    })
    const runB = makeReport({
      runId: "2026-03-26T02-00-00-000Z",
      generatedAt: "2026-03-26T02:00:00.000Z",
      totalScenarios: 1,
      passedScenarios: 1,
      failedScenarios: 0,
      averageTotal: 100,
      surfaces: [
        { surface: "page-translation", scenarioCount: 1, passed: 1, failed: 0, averageTotal: 100 },
      ],
      scenarios: [
        { id: "page-translation/article-basic-bilingual", title: "Article bilingual", surface: "page-translation", total: 100, pass: true },
      ],
      comparison: {
        previousRunId: "2026-03-26T01-00-00-000Z",
        previousGeneratedAt: "2026-03-26T01:00:00.000Z",
        overallDelta: 0,
        regressions: 0,
        improvements: 0,
        unchanged: 1,
        added: 0,
        scenarioDeltas: [],
      },
    })

    await writeFile(path.join(historyDir, `${runB.runId}.json`), JSON.stringify(runB, null, 2))
    await writeFile(path.join(historyDir, `${runA.runId}.json`), JSON.stringify(runA, null, 2))

    try {
      const loaded = await loadHistoryReports(historyDir)
      expect(loaded.map((report) => report.runId)).toEqual([runA.runId, runB.runId])
    } finally {
      await rm(historyDir, { recursive: true, force: true })
    }
  })
})
