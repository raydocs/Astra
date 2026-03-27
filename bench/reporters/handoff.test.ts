import { describe, expect, it } from "vitest"

import { buildGeneratorHandoff, renderGeneratorMarkdown } from "./handoff"
import type { BenchmarkReport } from "../types"

describe("generator handoff reporter", () => {
  it("prioritizes regressions ahead of imperfect passes and renders machine-friendly prompts", () => {
    const report: BenchmarkReport = {
      schemaVersion: 1,
      runId: "run-2",
      generatedAt: "2026-03-26T00:00:00.000Z",
      filter: { surface: null, split: null },
      summary: {
        totalScenarios: 2,
        passedScenarios: 1,
        failedScenarios: 1,
        averageTotal: 84,
        surfaces: [],
      },
      comparison: {
        previousRunId: "run-1",
        previousGeneratedAt: "2026-03-25T00:00:00.000Z",
        overallDelta: -6,
        regressions: 1,
        improvements: 0,
        unchanged: 1,
        added: 0,
        scenarioDeltas: [
          {
            id: "hover/failing",
            previousTotal: 81,
            currentTotal: 65,
            delta: -16,
            status: "regressed",
            wasPassing: true,
            isPassing: false,
            scoreDeltas: [
              { key: "correctness", previous: 10, current: 4, delta: -6 },
            ],
            regressedScores: ["correctness"],
            improvedScores: [],
          },
          {
            id: "page/passing",
            previousTotal: 100,
            currentTotal: 100,
            delta: 0,
            status: "unchanged",
            wasPassing: true,
            isPassing: true,
            scoreDeltas: [
              { key: "correctness", previous: 10, current: 10, delta: 0 },
            ],
            regressedScores: [],
            improvedScores: [],
          },
        ],
      },
      scenarios: [
        {
          id: "hover/failing",
          title: "Hover regressed",
          surface: "hover",
          fixture: "inline:hover",
          task: "Fix hover suppression.",
          execution: {},
          evaluation: {
            scores: { correctness: 4, completeness: 8, stability: 10 },
            total: 65,
            pass: false,
            issues: [{ severity: "critical", message: "Hover suppression failed." }],
            artifacts: {},
            nextActions: ["Fix hover suppression logic."],
          },
        },
        {
          id: "page/passing",
          title: "Passing page case",
          surface: "page-translation",
          fixture: "article-basic",
          task: "Keep page translation stable.",
          execution: {},
          evaluation: {
            scores: { correctness: 10, completeness: 10, stability: 10 },
            total: 100,
            pass: true,
            issues: [],
            artifacts: {},
            nextActions: [],
          },
        },
      ],
    }

    const handoff = buildGeneratorHandoff(report, {
      latestJson: "bench-results/latest.json",
      latestFeedback: "bench-results/latest.feedback.md",
    })
    const markdown = renderGeneratorMarkdown(handoff)

    expect(handoff.priorities[0]?.id).toBe("hover/failing")
    expect(handoff.priorities[0]?.priority).toBe("critical")
    expect(handoff.priorities[0]?.suggestedPrompt).toContain("regressed from 81 to 65")
    expect(markdown).toContain("bench-results/latest.handoff.json")
    expect(markdown).toContain("hover/failing")
  })
})
