import { describe, expect, it } from "vitest"

import { renderFeedbackReport } from "./feedback"
import type { BenchmarkReport } from "../types"

describe("feedback reporter", () => {
  it("prioritizes failures and includes generator instructions", () => {
    const report: BenchmarkReport = {
      schemaVersion: 1,
      runId: "run-1",
      generatedAt: "2026-03-26T00:00:00.000Z",
      filter: { surface: null },
      summary: {
        totalScenarios: 2,
        passedScenarios: 1,
        failedScenarios: 1,
        averageTotal: 72,
        surfaces: [],
      },
      comparison: {
        previousRunId: null,
        previousGeneratedAt: null,
        overallDelta: null,
        regressions: 0,
        improvements: 0,
        unchanged: 0,
        added: 2,
        scenarioDeltas: [
          {
            id: "hover/failing",
            previousTotal: null,
            currentTotal: 27,
            delta: null,
            status: "new",
            wasPassing: null,
            isPassing: false,
            scoreDeltas: [],
            regressedScores: [],
            improvedScores: [],
          },
          {
            id: "page/passing",
            previousTotal: null,
            currentTotal: 97,
            delta: null,
            status: "new",
            wasPassing: null,
            isPassing: true,
            scoreDeltas: [],
            regressedScores: [],
            improvedScores: [],
          },
        ],
      },
      scenarios: [
        {
          id: "hover/failing",
          title: "Failing hover case",
          surface: "hover",
          fixture: "inline:hover",
          task: "Fix hover suppression.",
          execution: {},
          evaluation: {
            scores: { correctness: 0, completeness: 0, stability: 0 },
            total: 27,
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
            total: 97,
            pass: true,
            issues: [{ severity: "low", message: "Minor improvement remains." }],
            artifacts: {},
            nextActions: ["Polish the remaining edge case."],
          },
        },
      ],
    }

    const text = renderFeedbackReport(report)
    expect(text).toContain("# Astra Bench Feedback")
    expect(text).toContain("## Generator Prompt Template")
    expect(text).toContain("bench-results/latest.handoff.json")
    expect(text.indexOf("hover/failing")).toBeLessThan(text.indexOf("page/passing"))
  })
})
