import { describe, expect, it } from "vitest"

import { buildBenchOptPublishPlan } from "./publish.ts"
import { buildBenchOptRollbackPlan } from "./rollback.ts"
import { decideBenchOptPromotion } from "./promote.ts"

describe("bench-opt rollback", () => {
  it("builds a safe rollback plan from the publish artifacts", () => {
    const promotion = decideBenchOptPromotion({
      runId: "run-5",
      candidateId: "candidate-5",
      gate: {
        requiredSplits: ["validation", "holdout"],
        observedSplits: ["validation", "holdout"],
        qualified: true,
        missingSplits: [],
        reason: "promotion gate passed",
      },
      liveEvaluatorPassed: true,
      requiredChecks: ["tests"],
      passedChecks: ["tests"],
      branchName: "bench-opt/candidate-5",
      pullRequestUrl: "https://example.test/pull/5",
      canaryEnvironment: "staging",
      trialSummaryPath: "bench-opt-results/latest.md",
    })

    const publishPlan = buildBenchOptPublishPlan({
      runId: "run-5",
      candidateId: "candidate-5",
      promotion,
      branchName: "bench-opt/candidate-5",
      pullRequestTitle: "Promote candidate-5",
      canaryEnvironment: "staging",
      trialSummaryPath: "bench-opt-results/latest.md",
    })

    const rollbackPlan = buildBenchOptRollbackPlan({
      runId: "run-5",
      candidateId: "candidate-5",
      promotion,
      publishPlan,
      trigger: "canary-regression",
      failedChecks: ["live-evaluator", "smoke-tests"],
      reason: "post-promotion checks regressed",
    })

    expect(rollbackPlan.dryRun).toBe(true)
    expect(rollbackPlan.status).toBe("planned")
    expect(rollbackPlan.executionEnabled).toBe(false)
    expect(rollbackPlan.targets.branchName).toBe("bench-opt/candidate-5")
    expect(rollbackPlan.targets.pullRequestUrl).toBe("https://example.test/pull/5")
    expect(rollbackPlan.targets.canaryEnvironment).toBe("staging")
    expect(rollbackPlan.steps.map((step) => step.kind)).toEqual([
      "revert-commit",
      "close-pr",
      "disable-canary",
      "restore-branch",
      "restore-champion",
      "record-rollback",
    ])
    expect(rollbackPlan.artifacts.rollbackRecordPath).toBe("rollbacks/run-5-candidate-5.json")
    expect(publishPlan.artifacts.rollbackPlanPath).toBe(rollbackPlan.artifacts.rollbackRecordPath)
    expect(rollbackPlan.reasons.some((reason) => reason.includes("Rollback trigger: canary-regression."))).toBe(true)
    expect(rollbackPlan.reasons.some((reason) => reason.includes("Rollback stays in safe planning mode by default."))).toBe(true)
  })

  it("stays idle when no rollback trigger is present", () => {
    const rollbackPlan = buildBenchOptRollbackPlan({
      runId: "run-6",
      candidateId: "candidate-6",
      reason: null,
    })

    expect(rollbackPlan.status).toBe("idle")
    expect(rollbackPlan.executionEnabled).toBe(false)
    expect(rollbackPlan.steps.every((step) => step.status === "skipped")).toBe(true)
  })
})
