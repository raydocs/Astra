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
    expect(getScenarioSplit("page-translation/site-rules-advanced-filters")).toBe("train")
    expect(getScenarioSplit("page-translation/site-rules-invalid-selectors-ignored")).toBe("train")
    expect(getScenarioSplit("site-automation/site-rule-update-restarts-active-session")).toBe("validation")
    expect(getScenarioSplit("site-automation/provider-switch-restarts-active-session")).toBe("validation")
    expect(getScenarioSplit("site-automation/provider-and-site-rule-update-single-restart")).toBe("validation")
    expect(getScenarioSplit("page-translation/dense-inline-placeholder-fallback")).toBe("train")
    expect(getScenarioSplit("provider-routing/direct-failure-falls-back-to-relay")).toBe("validation")
    expect(getScenarioSplit("provider-routing/parse-failure-fails-fast")).toBe("validation")
    expect(getScenarioSplit("provider-routing/non-fallback-error-fails-fast")).toBe("holdout")
    expect(getScenarioSplit("provider-routing/config-error-fails-fast")).toBe("holdout")
    expect(getScenarioSplit("provider-routing/content-unavailable-fails-fast")).toBe("validation")
    expect(getScenarioSplit("provider-routing/invalid-response-fails-fast")).toBe("validation")
    expect(getScenarioSplit("provider-routing/site-disabled-fails-fast")).toBe("holdout")
    expect(getScenarioSplit("provider-routing/unknown-astra-error-fails-fast")).toBe("holdout")
    expect(getScenarioSplit("provider-routing/non-astra-error-fails-fast-as-provider-request-failed")).toBe("validation")
    expect(getScenarioSplit("provider-routing/fallback-exhaustion-surfaces-relay-terminal-error")).toBe("holdout")
  })

  it("selects scenarios by split and keeps current total coverage", () => {
    const counts = countScenariosBySplit(benchmarkScenarios)

    expect(counts).toEqual({
      train: 34,
      validation: 16,
      holdout: 12,
    })

    expect(selectBenchmarkScenarios({ split: "train" })).toHaveLength(34)
    expect(selectBenchmarkScenarios({ split: "validation" })).toHaveLength(16)
    expect(selectBenchmarkScenarios({ split: "holdout" })).toHaveLength(12)
    expect(selectBenchmarkScenarios({})).toHaveLength(benchmarkScenarios.length)
  })
})

