import { describe, expect, it } from "vitest"

import { createBenchOptExperimentRun, materializeBenchOptTrials } from "./experiments.ts"
import { selectBenchOptChampion } from "./champion.ts"
import type { BenchOptCandidateScore, BenchOptRunReport } from "./types.ts"

function createCandidateScore(id: string, total: number): BenchOptCandidateScore {
  return {
    candidate: {
      id,
      promptCandidateId: null,
      contextCandidateId: null,
      prompt: `prompt:${id}`,
      contextLines: [`context:${id}`],
      notes: [`note:${id}`],
      edits: [],
      worktree: {
        baseRef: "HEAD",
        branchPrefix: "codex/bench-opt",
        path: null,
        root: null,
      },
    },
    worktree: {
      repositoryRoot: "/tmp/astra",
      baseRef: "HEAD",
      branchName: `codex/bench-opt/${id}`,
      path: `/tmp/astra/.bench-opt/worktrees/${id}`,
      command: ["git", "worktree", "add", "--detach", `/tmp/astra/.bench-opt/worktrees/${id}`, "HEAD"],
      dryRun: true,
    },
    breakdown: {
      baselineHealth: 10,
      promptClarity: 10,
      contextCoverage: 10,
      artifactAlignment: 10,
      structuralSignals: 10,
      penalties: 0,
      total,
    },
    notes: [`score:${id}`],
    alignmentMatches: [`match:${id}`],
  }
}

function createReport(): BenchOptRunReport {
  return {
    schemaVersion: 1,
    runId: "run-001",
    generatedAt: "2026-03-26T00:00:00.000Z",
    sourceArtifacts: {
      baselineReport: null,
      candidateFiles: [],
    },
    summary: {
      candidateCount: 3,
      baselineAvailable: false,
      bestCandidateId: "candidate-a",
      bestScore: 30,
      averageScore: 20,
      evaluatedSplit: "holdout",
      promotionSplits: ["validation", "holdout"],
      notes: [],
    },
    baseline: {
      path: null,
      available: false,
      runId: null,
      generatedAt: null,
      split: null,
      totalScenarios: null,
      passedScenarios: null,
      failedScenarios: null,
      averageTotal: null,
      regressions: null,
      improvements: null,
      unchanged: null,
      added: null,
      terms: [],
      surfaces: [],
    },
    candidates: [
      createCandidateScore("candidate-a", 30),
      createCandidateScore("candidate-b", 20),
      createCandidateScore("candidate-c", 10),
    ],
  }
}

describe("bench-opt split-aware champion selection", () => {
  it("splits the top trials into holdout/validation and promotes the holdout champion", () => {
    const report = createReport()
    const experiment = createBenchOptExperimentRun(report, report.candidates)

    expect(materializeBenchOptTrials("exp-run-001", report.candidates).map((trial) => trial.split)).toEqual([
      "holdout",
      "validation",
      "train",
    ])
    expect(experiment.summary.evaluatedSplit).toBe("holdout")
    expect(experiment.summary.promotionGate.requiredSplits).toEqual(["validation", "holdout"])
    expect(experiment.summary.promotionGate.qualified).toBe(true)
    expect(experiment.championTrialId).toBe(experiment.trials[0]?.trialId ?? null)

    const champion = selectBenchOptChampion(experiment, {
      resolvedConfigPath: "/tmp/astra/data/bench-opt-results/latest.resolved.json",
    })

    expect(champion).not.toBeNull()
    expect(champion?.status).toBe("promoted")
    expect(champion?.promotionSplit).toBe("holdout")
    expect(champion?.validationTrialId).toBe(experiment.trials[1]?.trialId ?? null)
    expect(champion?.holdoutTrialId).toBe(experiment.trials[0]?.trialId ?? null)
  })

  it("keeps a single trial in train-only mode", () => {
    const report = createReport()
    const singleTrialExperiment = createBenchOptExperimentRun(
      {
        ...report,
        summary: {
          ...report.summary,
          candidateCount: 1,
          bestCandidateId: "candidate-a",
          bestScore: 30,
          averageScore: 30,
          evaluatedSplit: "train",
          promotionSplits: ["train"],
        },
        candidates: [report.candidates[0]],
      },
      [report.candidates[0]],
    )

    expect(singleTrialExperiment.trials[0]?.split).toBe("train")
    expect(singleTrialExperiment.summary.promotionGate.requiredSplits).toEqual(["train"])
    expect(singleTrialExperiment.summary.promotionGate.qualified).toBe(true)

    const champion = selectBenchOptChampion(singleTrialExperiment)
    expect(champion?.status).toBe("retained")
    expect(champion?.promotionSplit).toBe("train")
  })
})
