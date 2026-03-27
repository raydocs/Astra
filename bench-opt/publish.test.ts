import { describe, expect, it } from "vitest"

import { buildBenchOptPublishPlan } from "./publish.ts"
import { decideBenchOptPromotion } from "./promote.ts"

describe("bench-opt publish", () => {
  it("builds a dry-run publish plan with branch, PR, and canary artifacts", () => {
    const promotion = decideBenchOptPromotion({
      runId: "run-3",
      candidateId: "candidate-3",
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
      branchName: "bench-opt/candidate-3",
      pullRequestUrl: "https://example.test/pull/3",
      canaryEnvironment: "staging",
      trialSummaryPath: "bench-opt-results/latest.md",
    })

    const plan = buildBenchOptPublishPlan(
      {
        runId: "run-3",
        candidateId: "candidate-3",
        promotion,
        trialSummaryPath: "bench-opt-results/latest.md",
        branchName: "bench-opt/candidate-3",
        pullRequestTitle: "Promote candidate-3",
        pullRequestBody: "trial summary attached",
        canaryEnvironment: "staging",
      },
      {
        allowPublish: false,
        enableBranchCreation: true,
        openPullRequest: true,
        enableCanary: true,
      },
    )

    expect(plan.dryRun).toBe(true)
    expect(plan.status).toBe("planned")
    expect(plan.executionEnabled).toBe(false)
    expect(plan.branch.name).toBe("bench-opt/candidate-3")
    expect(plan.pullRequest.title).toBe("Promote candidate-3")
    expect(plan.canary.enabled).toBe(true)
    expect(plan.summary.includesTrialSummary).toBe(true)
    expect(plan.artifacts.promotionDecisionPath).toBe("promotions/run-3-candidate-3.json")
    expect(plan.steps.map((step) => step.kind)).toEqual([
      "create-branch",
      "commit-changes",
      "open-pr",
      "attach-summary",
      "start-canary",
      "wait-for-gates",
      "publish",
    ])
    expect(plan.artifacts.rollbackPlanPath).toBe("rollbacks/run-3-candidate-3.json")
    expect(plan.reasons.some((reason) => reason.includes("Publish execution remains disabled by default."))).toBe(true)
  })

  it("marks publish as blocked when promotion itself is blocked", () => {
    const plan = buildBenchOptPublishPlan({
      runId: "run-4",
      candidateId: "candidate-4",
      promotion: {
        schemaVersion: 1,
        runId: "run-4",
        candidateId: "candidate-4",
        status: "blocked",
        promote: false,
        channel: "publish",
        gate: {
          requiredSplits: ["validation", "holdout"],
          observedSplits: ["validation"],
          missingSplits: ["holdout"],
          qualified: false,
          reason: "holdout is missing",
          requiredChecks: ["tests"],
          passedChecks: [],
          missingChecks: ["tests"],
          liveEvaluatorPassed: false,
          canaryRequired: false,
          canaryReady: false,
        },
        artifacts: {
          branchName: null,
          pullRequestUrl: null,
          canaryEnvironment: null,
          trialSummaryPath: null,
          promotionDecisionPath: "promotions/run-4-candidate-4.json",
          publishPlanPath: "publish/run-4-candidate-4.json",
          rollbackPlanPath: "rollbacks/run-4-candidate-4.json",
        },
        reasons: ["blocked"],
      },
    })

    expect(plan.status).toBe("blocked")
    expect(plan.steps[0]?.status).toBe("blocked")
    expect(plan.steps[6]?.status).toBe("blocked")
    expect(plan.branch.suggestedName).toBe("bench-opt/promotion/candidate-4")
  })

  it("derives downstream planning fields from the promotion decision when explicit inputs are omitted", () => {
    const promotion = decideBenchOptPromotion({
      runId: "run-7",
      candidateId: "candidate-7",
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
      branchName: "bench-opt/candidate-7",
      pullRequestUrl: "https://example.test/pull/7",
      canaryEnvironment: "staging",
      trialSummaryPath: "bench-opt-results/run-7.md",
    })

    const plan = buildBenchOptPublishPlan(
      {
        runId: "run-7",
        candidateId: "candidate-7",
        promotion,
      },
      {
        allowPublish: false,
        enableBranchCreation: true,
        openPullRequest: true,
        enableCanary: true,
      },
    )

    expect(plan.branch.name).toBe("bench-opt/candidate-7")
    expect(plan.pullRequest.url).toBe("https://example.test/pull/7")
    expect(plan.canary.environment).toBe("staging")
    expect(plan.summary.path).toBe("bench-opt-results/run-7.md")
    expect(plan.artifacts.rollbackPlanPath).toBe("rollbacks/run-7-candidate-7.json")
  })
})
