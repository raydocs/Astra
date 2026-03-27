import { describe, expect, it } from "vitest"

import { buildBenchOptStatusArtifact, renderBenchOptStatusMarkdown } from "./status.ts"

describe("bench-opt status", () => {
  it("includes live evaluator fields in the unified status artifact", () => {
    const status = buildBenchOptStatusArtifact({
      report: {
        schemaVersion: 1,
        runId: "run-1",
        generatedAt: "2026-03-27T00:00:00.000Z",
        sourceArtifacts: {
          baselineReport: "/tmp/baseline.json",
          candidateFiles: [],
        },
        summary: {
          candidateCount: 1,
          baselineAvailable: true,
          bestCandidateId: "prompt/a+context/b",
          bestScore: 51,
          averageScore: 51,
          evaluatedSplit: "holdout",
          promotionSplits: ["validation", "holdout"],
          notes: ["test note"],
        },
        baseline: {
          path: "/tmp/baseline.json",
          available: true,
          runId: "baseline-1",
          generatedAt: "2026-03-27T00:00:00.000Z",
          split: "holdout",
          totalScenarios: 1,
          passedScenarios: 1,
          failedScenarios: 0,
          averageTotal: 100,
          regressions: 0,
          improvements: 0,
          unchanged: 1,
          added: 0,
          terms: [],
          surfaces: [],
        },
        candidates: [],
      },
      resolvedConfig: null,
      execution: null,
      live: {
        runId: "live-1",
        scenario: {
          id: "bench-live/placeholder",
          title: "Placeholder live bench scenario",
          surface: "placeholder",
          fixture: "pre-playwright-contract",
          description: null,
          tags: ["placeholder"],
        },
        status: "skipped",
        pass: false,
        score: 0,
        summary: "Placeholder live run",
        issues: [],
        nextActions: [],
        notes: [],
        rubrics: [],
        artifacts: {
          scenario: {} as never,
          execution: {} as never,
          runtime: {} as never,
          evaluation: {} as never,
          rubrics: [],
          manifest: {} as never,
        },
        runtime: {
          scenarioId: "bench-live/placeholder",
          scenarioTitle: "Placeholder live bench scenario",
          status: "skipped",
          startedAt: null,
          finishedAt: null,
          events: [],
          artifacts: {},
        },
        manifest: {
          schema: "astra.bench-live.result",
          version: 1,
          runId: "live-1",
          scenario: {
            id: "bench-live/placeholder",
            title: "Placeholder live bench scenario",
            surface: "placeholder",
            fixture: null,
            description: null,
            tags: ["placeholder"],
          },
          execution: {
            status: "skipped",
            summary: "Placeholder live run",
            startedAt: null,
            finishedAt: null,
            noteCount: 0,
            artifactKeys: [],
          },
          evaluation: {
            status: "skipped",
            pass: false,
            score: 0,
            issueCount: 0,
            nextActionCount: 0,
            rubricCount: 0,
          },
          runtime: {
            status: "skipped",
            startedAt: null,
            finishedAt: null,
            eventCount: 0,
            artifactKeys: [],
          },
        },
        text: "Astra Bench Live",
      },
      orchestration: null,
      orchestrationLoop: null,
      session: null,
      promotion: null,
      publishPlan: null,
      rollbackPlan: null,
      store: null,
      paths: {
        latestJsonPath: "/tmp/latest.json",
        latestMarkdownPath: "/tmp/latest.md",
        latestResolvedJsonPath: null,
        latestResolvedMarkdownPath: null,
        latestOrchestrationJsonPath: null,
        latestOrchestrationLoopJsonPath: null,
        latestSessionJsonPath: null,
        latestCheckpointJsonPath: null,
        latestCompactionJsonPath: null,
        latestHandoffJsonPath: null,
        latestLiveJsonPath: "/tmp/latest.live.json",
        latestPromotionJsonPath: null,
        latestPublishJsonPath: null,
        latestRollbackJsonPath: null,
        latestStatusJsonPath: "/tmp/latest.status.json",
        latestStatusMarkdownPath: "/tmp/latest.status.md",
        storeIndexPath: "/tmp/store/index.json",
      },
    })

    expect(status.summary.liveStatus).toBe("skipped")
    expect(status.summary.livePass).toBe(false)
    expect(status.live?.scenarioId).toBe("bench-live/placeholder")
    expect(status.paths.latestLiveJsonPath).toBe("/tmp/latest.live.json")

    const markdown = renderBenchOptStatusMarkdown(status)
    expect(markdown).toContain("## Live Evaluator")
    expect(markdown).toContain("Status: skipped")
  })
})
