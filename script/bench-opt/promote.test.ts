import { describe, expect, it } from "vitest"

import { decideBenchOptPromotion } from "./promote.ts"

describe("bench-opt promote", () => {
  it("stays blocked by default when the promotion gate is incomplete", () => {
    const decision = decideBenchOptPromotion({
      runId: "run-1",
      candidateId: "candidate-1",
      gate: {
        requiredSplits: ["validation", "holdout"],
        observedSplits: ["validation"],
        qualified: false,
        missingSplits: ["holdout"],
        reason: "holdout split is missing",
      },
    })

    expect(decision.status).toBe("blocked")
    expect(decision.promote).toBe(false)
    expect(decision.gate.missingSplits).toEqual(["holdout"])
    expect(decision.gate.missingChecks).toEqual(["tests"])
    expect(decision.artifacts.branchName).toBeNull()
    expect(decision.artifacts.promotionDecisionPath).toBe("promotions/run-1-candidate-1.json")
    expect(decision.artifacts.rollbackPlanPath).toBe("rollbacks/run-1-candidate-1.json")
    expect(decision.reasons[0]).toBe("Promotion gate is blocked.")
  })

  it("describes a qualified promotion path without enabling promotion by default", () => {
    const decision = decideBenchOptPromotion({
      runId: "run-2",
      candidateId: "candidate-2",
      gate: {
        requiredSplits: ["validation", "holdout"],
        observedSplits: ["validation", "holdout"],
        qualified: true,
        missingSplits: [],
        reason: "validation and holdout passed",
      },
      liveEvaluatorPassed: true,
      requiredChecks: ["tests", "integration"],
      passedChecks: ["tests", "integration"],
      branchName: "bench-opt/candidate-2",
      pullRequestUrl: "https://example.test/pull/2",
      canaryEnvironment: "staging",
      trialSummaryPath: "data/bench-opt-results/latest.md",
    })

    expect(decision.status).toBe("qualified")
    expect(decision.promote).toBe(false)
    expect(decision.channel).toBe("canary")
    expect(decision.gate.missingChecks).toEqual([])
    expect(decision.gate.liveEvaluatorPassed).toBe(true)
    expect(decision.artifacts.trialSummaryPath).toBe("data/bench-opt-results/latest.md")
    expect(decision.artifacts.publishPlanPath).toBe("publish/run-2-candidate-2.json")
    expect(decision.reasons.some((reason) => reason.includes("Promotion gate is qualified."))).toBe(true)
    expect(decision.reasons.some((reason) => reason.includes("Promotion remains in safe default mode."))).toBe(true)
  })

  it("promotes only when all gates pass and promotion is explicitly allowed", () => {
    const decision = decideBenchOptPromotion({
      runId: "run-3",
      candidateId: "candidate-3",
      gate: {
        requiredSplits: ["validation", "holdout"],
        observedSplits: ["validation", "holdout"],
        qualified: true,
        missingSplits: [],
        reason: "all promotion gates passed",
      },
      liveEvaluatorPassed: true,
      requiredChecks: ["tests"],
      passedChecks: ["tests"],
      allowPromotion: true,
    })

    expect(decision.status).toBe("promoted")
    expect(decision.promote).toBe(true)
    expect(decision.channel).toBe("publish")
    expect(decision.reasons.some((reason) => reason.includes("Promotion is explicitly allowed."))).toBe(true)
  })

  it("stays blocked when live evaluator does not pass even if the other gates qualify", () => {
    const decision = decideBenchOptPromotion({
      runId: "run-4",
      candidateId: "candidate-4",
      gate: {
        requiredSplits: ["validation", "holdout"],
        observedSplits: ["validation", "holdout"],
        qualified: true,
        missingSplits: [],
        reason: "split and verification gates passed",
      },
      liveEvaluatorPassed: false,
      requiredChecks: ["tests"],
      passedChecks: ["tests"],
      allowPromotion: true,
    })

    expect(decision.status).toBe("blocked")
    expect(decision.promote).toBe(false)
    expect(decision.gate.liveEvaluatorPassed).toBe(false)
    expect(decision.reasons.some((reason) => reason.includes("Live evaluator is not marked as passed."))).toBe(true)
  })
})
