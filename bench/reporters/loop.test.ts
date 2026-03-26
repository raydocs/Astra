import { describe, expect, it } from "vitest"

import { buildLoopPlan, renderLoopMarkdown } from "./loop"
import type { GeneratorHandoff } from "../types"

const baseHandoff: GeneratorHandoff = {
  schemaVersion: 1,
  runId: "run-3",
  generatedAt: "2026-03-26T00:00:00.000Z",
  sourceArtifacts: {
    latestJson: "bench-results/latest.json",
    latestFeedback: "bench-results/latest.feedback.md",
  },
  summary: {
    totalScenarios: 3,
    failedScenarios: 1,
    regressedScenarios: 1,
    imperfectPasses: 1,
  },
  priorities: [
    {
      id: "hover/regressed",
      title: "Hover regressed",
      surface: "hover",
      status: "regressed",
      priority: "critical",
      total: 61,
      previousTotal: 88,
      delta: -27,
      pass: false,
      issueCount: 1,
      issues: [{ severity: "critical", message: "Hover suppression failed." }],
      nextActions: ["Fix hover suppression."],
      scoreDeltas: [{ key: "correctness", previous: 10, current: 4, delta: -6 }],
      suggestedPrompt: "Fix hover first.",
    },
    {
      id: "hover/polish",
      title: "Hover polish",
      surface: "hover",
      status: "unchanged",
      priority: "high",
      total: 97,
      previousTotal: 97,
      delta: 0,
      pass: true,
      issueCount: 0,
      issues: [],
      nextActions: [],
      scoreDeltas: [{ key: "interaction_safety", previous: 8, current: 8, delta: 0 }],
      suggestedPrompt: "Polish hover.",
    },
    {
      id: "page/stable",
      title: "Page stable",
      surface: "page-translation",
      status: "unchanged",
      priority: "medium",
      total: 100,
      previousTotal: 100,
      delta: 0,
      pass: true,
      issueCount: 0,
      issues: [],
      nextActions: [],
      scoreDeltas: [{ key: "correctness", previous: 10, current: 10, delta: 0 }],
      suggestedPrompt: "Leave it alone.",
    },
  ],
}

describe("loop reporter", () => {
  it("selects only critical and high priority items by default", () => {
    const plan = buildLoopPlan(baseHandoff, {
      latestHandoff: "bench-results/latest.handoff.json",
      latestFeedback: "bench-results/latest.feedback.md",
      latestJson: "bench-results/latest.json",
    }, {
      maxItems: 2,
    })

    expect(plan.selection.mode).toBe("critical-high")
    expect(plan.selectedItems).toHaveLength(2)
    expect(plan.selectedItems[0]?.id).toBe("hover/regressed")
    expect(plan.selectedItems[1]?.id).toBe("hover/polish")
    expect(plan.drill.enabled).toBe(false)
  })

  it("can include medium-priority items for polish runs", () => {
    const plan = buildLoopPlan(baseHandoff, {
      latestHandoff: "bench-results/latest.handoff.json",
      latestFeedback: "bench-results/latest.feedback.md",
      latestJson: "bench-results/latest.json",
    }, {
      maxItems: 3,
      includeMedium: true,
    })

    const markdown = renderLoopMarkdown(plan)

    expect(plan.selection.mode).toBe("polish")
    expect(plan.selectedItems).toHaveLength(3)
    expect(markdown).toContain("hover/regressed")
    expect(markdown).toContain("page/stable")
  })

  it("can force a drill scenario into an executor-ready state", () => {
    const plan = buildLoopPlan(baseHandoff, {
      latestHandoff: "bench-results/latest.handoff.json",
      latestFeedback: "bench-results/latest.feedback.md",
      latestJson: "bench-results/latest.json",
    }, {
      drillScenarioId: "page/stable",
      drillReason: "Synthetic regression for executor drill.",
    })

    expect(plan.drill.enabled).toBe(true)
    expect(plan.selectedItems).toHaveLength(1)
    expect(plan.selectedItems[0]?.id).toBe("page/stable")
    expect(plan.selectedItems[0]?.pass).toBe(false)
    expect(plan.selectedItems[0]?.status).toBe("regressed")
    expect(plan.selectedItems[0]?.issues.some((issue) => issue.message.includes("Drill mode injected"))).toBe(true)
  })
})
