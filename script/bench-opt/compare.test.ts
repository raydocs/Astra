import { describe, expect, it } from "vitest"

import {
  compareBenchOptChampionAndChallenger,
  compareBenchOptReports,
} from "./compare.ts"

function createReport(overrides: Partial<ReturnType<typeof createReportBase>> = {}) {
  return {
    ...createReportBase(),
    ...overrides,
    summary: {
      ...createReportBase().summary,
      ...(overrides.summary ?? {}),
    },
    scenarios: overrides.scenarios ?? createReportBase().scenarios,
  }
}

function createReportBase() {
  return {
    runId: "run-base",
    generatedAt: "2026-03-26T00:00:00.000Z",
    summary: {
      totalScenarios: 3,
      passedScenarios: 2,
      failedScenarios: 1,
      averageTotal: 70,
    },
    scenarios: [
      {
        id: "alpha",
        title: "Alpha",
        task: "Alpha task",
        surface: "page-translation",
        fixture: "alpha.md",
        evaluation: {
          total: 80,
          pass: true,
          scores: {
            correctness: 8,
            completeness: 8,
          },
        },
      },
      {
        id: "beta",
        title: "Beta",
        task: "Beta task",
        surface: "hover",
        fixture: "beta.md",
        evaluation: {
          total: 60,
          pass: false,
          scores: {
            correctness: 5,
            completeness: 4,
          },
        },
      },
      {
        id: "gamma",
        title: "Gamma",
        task: "Gamma task",
        surface: "subtitle",
        fixture: "gamma.md",
        evaluation: {
          total: 70,
          pass: true,
          scores: {
            correctness: 7,
            completeness: 7,
          },
        },
      },
    ],
  }
}

describe("bench-opt compare", () => {
  it("compares structured rerun outputs and reports scenario deltas", () => {
    const baseline = createReportBase()
    const trial = createReport({
      runId: "run-trial",
      generatedAt: "2026-03-26T01:00:00.000Z",
      summary: {
        totalScenarios: 3,
        passedScenarios: 3,
        failedScenarios: 0,
        averageTotal: 78,
      },
      scenarios: [
        {
          id: "alpha",
          title: "Alpha",
          task: "Alpha task",
          surface: "page-translation",
          fixture: "alpha.md",
          evaluation: {
            total: 90,
            pass: true,
            scores: {
              correctness: 9,
              completeness: 9,
            },
          },
        },
        {
          id: "beta",
          title: "Beta",
          task: "Beta task",
          surface: "hover",
          fixture: "beta.md",
          evaluation: {
            total: 55,
            pass: false,
            scores: {
              correctness: 4,
              completeness: 4,
            },
          },
        },
        {
          id: "delta",
          title: "Delta",
          task: "Delta task",
          surface: "selection-explain",
          fixture: "delta.md",
          evaluation: {
            total: 89,
            pass: true,
            scores: {
              correctness: 9,
              completeness: 8,
            },
          },
        },
      ],
    })

    const comparison = compareBenchOptReports(baseline, trial, {
      baselineLabel: "baseline",
      trialLabel: "trial",
    })

    expect(comparison.baseline.runId).toBe("run-base")
    expect(comparison.trial.runId).toBe("run-trial")
    expect(comparison.summary.averageDelta).toBe(8)
    expect(comparison.summary.passDelta).toBe(1)
    expect(comparison.summary.improvedScenarios).toBe(1)
    expect(comparison.summary.regressedScenarios).toBe(1)
    expect(comparison.summary.addedScenarios).toBe(1)
    expect(comparison.summary.removedScenarios).toBe(1)
    expect(comparison.scenarioDeltas).toHaveLength(4)

    const alpha = comparison.scenarioDeltas.find((delta) => delta.id === "alpha")
    expect(alpha?.status).toBe("improved")
    expect(alpha?.delta).toBe(10)
    expect(alpha?.scoreDeltas).toEqual([
      { key: "completeness", previous: 8, current: 9, delta: 1 },
      { key: "correctness", previous: 8, current: 9, delta: 1 },
    ])

    const beta = comparison.scenarioDeltas.find((delta) => delta.id === "beta")
    expect(beta?.status).toBe("regressed")
    expect(beta?.delta).toBe(-5)

    const delta = comparison.scenarioDeltas.find((entry) => entry.id === "delta")
    expect(delta?.status).toBe("new")

    expect(comparison.highlights.bestImprovement?.id).toBe("alpha")
    expect(comparison.highlights.worstRegression?.id).toBe("beta")
    expect(comparison.reasons.some((reason) => reason.includes("Average score: 70.0 → 78.0 (+8)"))).toBe(true)
    expect(comparison.reasons.some((reason) => reason.includes("1 improved, 1 regressed, 0 unchanged, 1 added, 1 removed"))).toBe(true)
  })

  it("supports champion/challenger labels", () => {
    const comparison = compareBenchOptChampionAndChallenger(
      createReportBase(),
      createReport({
        runId: "run-trial",
        summary: {
          totalScenarios: 3,
          passedScenarios: 3,
          failedScenarios: 0,
          averageTotal: 78,
        },
      }),
    )

    expect(comparison.baselineLabel).toBe("champion")
    expect(comparison.trialLabel).toBe("challenger")
    expect(comparison.reasons[0]).toContain("champion")
    expect(comparison.reasons[0]).toContain("challenger")
  })
})
