import { describe, expect, it } from "vitest"

import { benchmarkScenarios, selectBenchmarkScenarios } from "./scenarios"
import { countScenariosBySplit, getScenarioSplit, isBenchmarkSplit } from "./splits"

describe("benchmark splits", () => {
  it("recognizes the supported split labels", () => {
    expect(isBenchmarkSplit("train")).toBe(true)
    expect(isBenchmarkSplit("validation")).toBe(true)
    expect(isBenchmarkSplit("holdout")).toBe(true)
    expect(isBenchmarkSplit("unknown")).toBe(false)
  })

  it("maps known scenario ids to configured splits", () => {
    expect(getScenarioSplit("page-translation/forms-and-nav-skip")).toBe("validation")
    expect(getScenarioSplit("page-translation/provider-error-graceful")).toBe("holdout")
    expect(getScenarioSplit("page-translation/article-basic-bilingual")).toBe("train")
  })

  it("selects scenarios by split and keeps current total coverage", () => {
    const counts = countScenariosBySplit(benchmarkScenarios)

    expect(counts).toEqual({
      train: 21,
      validation: 7,
      holdout: 7,
    })

    expect(selectBenchmarkScenarios({ split: "train" })).toHaveLength(21)
    expect(selectBenchmarkScenarios({ split: "validation" })).toHaveLength(7)
    expect(selectBenchmarkScenarios({ split: "holdout" })).toHaveLength(7)
    expect(selectBenchmarkScenarios({})).toHaveLength(benchmarkScenarios.length)
  })
})

