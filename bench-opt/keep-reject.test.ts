import { describe, expect, it } from "vitest"

import {
  compareAndDecideBenchOptKeepReject,
  decideBenchOptKeepReject,
} from "./keep-reject.ts"

function createReport(total: number, passed: number, failed: number, scenarios: Array<{
  id: string
  total: number
  pass: boolean
}> ) {
  return {
    runId: `run-${total}-${passed}-${failed}`,
    generatedAt: "2026-03-26T00:00:00.000Z",
    summary: {
      totalScenarios: scenarios.length,
      passedScenarios: passed,
      failedScenarios: failed,
      averageTotal: total,
    },
    scenarios: scenarios.map((scenario) => ({
      id: scenario.id,
      title: scenario.id,
      task: scenario.id,
      surface: "page-translation",
      fixture: `${scenario.id}.md`,
      evaluation: {
        total: scenario.total,
        pass: scenario.pass,
        scores: {
          correctness: scenario.total / 10,
        },
      },
    })),
  }
}

describe("bench-opt keep/reject", () => {
  it("promotes clearly better trials", () => {
    const decision = compareAndDecideBenchOptKeepReject(
      createReport(70, 2, 1, [
        { id: "alpha", total: 80, pass: true },
        { id: "beta", total: 60, pass: false },
        { id: "gamma", total: 70, pass: true },
      ]),
      createReport(80, 3, 0, [
        { id: "alpha", total: 90, pass: true },
        { id: "beta", total: 70, pass: true },
        { id: "gamma", total: 80, pass: true },
      ]),
    )

    expect(decision.decision).toBe("promote")
    expect(decision.signals.averageDelta).toBe(10)
    expect(decision.reasons.some((reason) => reason.includes("Decision: promote"))).toBe(true)
    expect(decision.reasons.some((reason) => reason.includes("Average delta: +10"))).toBe(true)
  })

  it("retains marginal or evidence-light trials", () => {
    const decision = compareAndDecideBenchOptKeepReject(
      createReport(70, 2, 1, [
        { id: "alpha", total: 80, pass: true },
        { id: "beta", total: 60, pass: false },
        { id: "gamma", total: 70, pass: true },
      ]),
      createReport(70, 2, 1, [
        { id: "alpha", total: 80, pass: true },
        { id: "beta", total: 60, pass: false },
        { id: "gamma", total: 70, pass: true },
      ]),
      {
        retainMinAverageDelta: 0,
        retainMaxRegressions: 1,
      },
    )

    expect(decision.decision).toBe("retain")
    expect(decision.reasons.some((reason) => reason.includes("Decision: retain"))).toBe(true)
    expect(decision.reasons.some((reason) => reason.includes("Notable deltas"))).toBe(false)
  })

  it("rejects regressing trials and can work from a precomputed comparison", () => {
    const decision = compareAndDecideBenchOptKeepReject(
      createReport(70, 2, 1, [
        { id: "alpha", total: 80, pass: true },
        { id: "beta", total: 60, pass: false },
        { id: "gamma", total: 70, pass: true },
      ]),
      createReport(60, 1, 2, [
        { id: "alpha", total: 65, pass: true },
        { id: "beta", total: 55, pass: false },
        { id: "gamma", total: 60, pass: false },
      ]),
      {
        promoteMinAverageDelta: 5,
        retainMinAverageDelta: 0,
        retainMaxRegressions: 0,
      },
    )

    expect(decision.decision).toBe("reject")
    expect(decision.signals.regressions).toBe(3)
    expect(decision.reasons.some((reason) => reason.includes("Decision: reject"))).toBe(true)

    const precomputed = decideBenchOptKeepReject(decision.comparison, {
      promoteMinAverageDelta: 5,
      retainMinAverageDelta: 0,
      retainMaxRegressions: 0,
    })

    expect(precomputed.decision).toBe("reject")
    expect(precomputed.comparison.summary.averageDelta).toBe(-10)
  })
})
