import { describe, expect, it } from "vitest"

import { buildLoopPlan, renderLoopMarkdown } from "./loop"
import type { ExecutorAttempt, GeneratorHandoff } from "../types"

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

  it("includes the downstream executor gate result and reason when provided", () => {
    const plan = buildLoopPlan(baseHandoff, {
      latestHandoff: "bench-results/latest.handoff.json",
      latestFeedback: "bench-results/latest.feedback.md",
      latestJson: "bench-results/latest.json",
    }, {
      maxItems: 1,
    })

    const executorAttempt = {
      schemaVersion: 1,
      runId: plan.runId,
      generatedAt: "2026-03-26T00:00:03.000Z",
      sourceArtifacts: {
        latestPatchPass: "bench-results/latest.patch-pass.json",
        latestPatchTask: "bench-results/latest.patch-task.json",
        latestPatchContext: "bench-results/latest.patch-context.json",
        latestLoop: "bench-results/latest.loop.json",
        latestHandoff: "bench-results/latest.handoff.json",
        latestFeedback: "bench-results/latest.feedback.md",
        latestJson: "bench-results/latest.json",
      },
      status: "ready",
      summary: {
        selectedScenarioCount: 1,
        actionableScenarioCount: 1,
        primaryScenarioId: "hover/regressed",
        blockReason: null,
        gateSummary: {
          decision: "ready",
          reason: "current signal(s) made this attempt ready.",
          error: null,
        },
      },
      actionableScenarios: [{
        id: "hover/regressed",
        surface: "hover",
        priority: "critical",
        status: "regressed",
        pass: false,
        reasons: ["scenario is currently failing"],
      }],
      writeScope: [],
      prompt: null,
    } satisfies ExecutorAttempt

    const markdown = renderLoopMarkdown(plan, executorAttempt)

    expect(markdown).toContain("## Executor Gate")
    expect(markdown).toContain("Decision: `ready`")
    expect(markdown).toContain("Why: current signal(s) made this attempt ready.")
  })

  it("can include medium-priority items for polish runs", () => {
    const plan = buildLoopPlan(baseHandoff, {
      latestHandoff: "bench-results/latest.handoff.json",
      latestFeedback: "bench-results/latest.feedback.md",
      latestJson: "bench-results/latest.json",
      latestHistoryJson: "bench-results/latest.history.json",
      latestHistoryMarkdown: "bench-results/latest.history.md",
    }, {
      maxItems: 3,
      includeMedium: true,
      history: {
        sourceJsonPath: "bench-results/latest.history.json",
        sourceMarkdownPath: "bench-results/latest.history.md",
        totalRuns: 12,
        notes: ["Loaded 12 historical benchmark runs."],
        weakestSurfaces: [
          { surface: "hover", averageTotal: 94, direction: "improving", failureRuns: 2 },
        ],
        recurringFailures: [
          { id: "hover/regressed", surface: "hover", issueCount: 3, latestTotal: 61, worstTotal: 40 },
        ],
      },
    })

    const markdown = renderLoopMarkdown(plan)

    expect(plan.selection.mode).toBe("polish")
    expect(plan.selectedItems).toHaveLength(3)
    expect(markdown).toContain("hover/regressed")
    expect(markdown).toContain("page/stable")
    expect(markdown).toContain("## History Signals")
    expect(markdown).toContain("History runs analyzed: 12")
    expect(markdown).toContain("Latest history JSON")
    expect(markdown).toContain("Selection score")
    expect(markdown).toContain("Selection reasons")
    expect(markdown).toContain("history recurring scenario issue hits=3")
  })

  it("uses recurring history to pull a weaker recurring scenario ahead of a stronger peer", () => {
    const handoff: GeneratorHandoff = {
      ...baseHandoff,
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
          id: "page/recurring",
          title: "Page recurring",
          surface: "page-translation",
          status: "unchanged",
          priority: "high",
          total: 96,
          previousTotal: 96,
          delta: 0,
          pass: true,
          issueCount: 0,
          issues: [],
          nextActions: [],
          scoreDeltas: [{ key: "correctness", previous: 10, current: 10, delta: 0 }],
          suggestedPrompt: "Investigate recurring page issue.",
        },
      ],
    }

    const withoutHistory = buildLoopPlan(handoff, {
      latestHandoff: "bench-results/latest.handoff.json",
      latestFeedback: "bench-results/latest.feedback.md",
      latestJson: "bench-results/latest.json",
    }, {
      maxItems: 1,
      includeMedium: true,
    })

    const withHistory = buildLoopPlan(handoff, {
      latestHandoff: "bench-results/latest.handoff.json",
      latestFeedback: "bench-results/latest.feedback.md",
      latestJson: "bench-results/latest.json",
      latestHistoryJson: "bench-results/latest.history.json",
      latestHistoryMarkdown: "bench-results/latest.history.md",
    }, {
      maxItems: 1,
      includeMedium: true,
      history: {
        sourceJsonPath: "bench-results/latest.history.json",
        sourceMarkdownPath: "bench-results/latest.history.md",
        totalRuns: 8,
        notes: [],
        weakestSurfaces: [
          { surface: "page-translation", averageTotal: 89, direction: "regressing", failureRuns: 3 },
        ],
        recurringFailures: [
          {
            id: "page/recurring",
            surface: "page-translation",
            issueCount: 5,
            failureCount: 4,
            regressionCount: 3,
            averageTotal: 86,
            latestTotal: 88,
            worstTotal: 64,
          },
        ],
      },
    })

    expect(withoutHistory.selectedItems[0]?.id).toBe("hover/regressed")
    expect(withHistory.selectedItems[0]?.id).toBe("page/recurring")
    expect(withHistory.selectedItems[0]?.selectionReasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("history recurring scenario issue hits=5"),
        expect.stringContaining("history surface trend=page-translation:regressing"),
      ]),
    )
  })

  it("uses weak regressing surface history to pull the same-surface item into selection earlier", () => {
    const handoff: GeneratorHandoff = {
      ...baseHandoff,
      priorities: [
        {
          id: "selection/stuck",
          title: "Selection stuck",
          surface: "selection-explain",
          status: "unchanged",
          priority: "high",
          total: 99,
          previousTotal: 99,
          delta: 0,
          pass: true,
          issueCount: 0,
          issues: [],
          nextActions: [],
          scoreDeltas: [{ key: "correctness", previous: 10, current: 10, delta: 0 }],
          suggestedPrompt: "Inspect the selection explanation path.",
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
      ],
    }

    const plan = buildLoopPlan(handoff, {
      latestHandoff: "bench-results/latest.handoff.json",
      latestFeedback: "bench-results/latest.feedback.md",
      latestJson: "bench-results/latest.json",
      latestHistoryJson: "bench-results/latest.history.json",
      latestHistoryMarkdown: "bench-results/latest.history.md",
    }, {
      maxItems: 1,
      includeMedium: true,
      history: {
        sourceJsonPath: "bench-results/latest.history.json",
        sourceMarkdownPath: "bench-results/latest.history.md",
        totalRuns: 8,
        notes: [],
        weakestSurfaces: [
          { surface: "selection-explain", averageTotal: 83, direction: "regressing", failureRuns: 4 },
        ],
        recurringFailures: [],
      },
    })

    expect(plan.selectedItems[0]?.id).toBe("selection/stuck")
    expect(plan.selectedItems[0]?.selectionReasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("history surface trend=selection-explain:regressing"),
        expect.stringContaining("history surface failure runs=4"),
      ]),
    )
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

  it("can drill a history-backed ready path without synthesizing an explicit regression", () => {
    const plan = buildLoopPlan(baseHandoff, {
      latestHandoff: "bench-results/latest.handoff.json",
      latestFeedback: "bench-results/latest.feedback.md",
      latestJson: "bench-results/latest.json",
      latestHistoryJson: "bench-results/latest.history.json",
      latestHistoryMarkdown: "bench-results/latest.history.md",
    }, {
      drillScenarioId: "page/stable",
      drillReason: "Synthetic history-backed ready path for executor drill.",
      drillHistoryReady: true,
    })

    expect(plan.drill.enabled).toBe(true)
    expect(plan.drill.historyReady).toBe(true)
    expect(plan.drill.reason).toContain("history-backed ready path")
    expect(plan.selectedItems).toHaveLength(1)
    expect(plan.selectedItems[0]?.id).toBe("page/stable")
    expect(plan.selectedItems[0]?.pass).toBe(true)
    expect(plan.selectedItems[0]?.status).toBe("unchanged")
    expect(plan.selectedItems[0]?.selectionReasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("drill mode history-backed ready path"),
      ]),
    )
    expect(plan.history?.recurringFailures[0]?.id).toBe("page/stable")
    expect(plan.history?.weakestSurfaces[0]?.surface).toBe("page-translation")
  })
})
