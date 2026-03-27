import { describe, expect, it } from "vitest"

import { buildExecutorAttempt, renderExecutorMarkdown } from "./executor"
import type { LoopPlan, PatchContextPack, PatchPass, PatchTask } from "../types"

const basePlan: LoopPlan = {
  schemaVersion: 1,
  runId: "run-7",
  generatedAt: "2026-03-26T00:00:00.000Z",
  sourceArtifacts: {
    latestHandoff: "bench-results/latest.handoff.json",
    latestFeedback: "bench-results/latest.feedback.md",
    latestJson: "bench-results/latest.json",
  },
  selection: {
    maxItems: 2,
    includeMedium: false,
    selectedCount: 1,
    mode: "critical-high",
  },
  drill: {
    enabled: false,
    scenarioId: null,
    reason: null,
  },
  summary: {
    failedScenarios: 1,
    regressedScenarios: 1,
    imperfectPasses: 0,
  },
  selectedItems: [
    {
      id: "hover/failing",
      title: "Hover failing",
      surface: "hover",
      status: "regressed",
      priority: "critical",
      total: 62,
      previousTotal: 91,
      delta: -29,
      pass: false,
      issueCount: 1,
      issues: [{ severity: "critical", message: "Hover suppression failed." }],
      nextActions: ["Restore hover suppression."],
      scoreDeltas: [],
      suggestedPrompt: "Fix hover.",
    },
  ],
}

const baseTask: PatchTask = {
  schemaVersion: 2,
  runId: "run-7",
  generatedAt: "2026-03-26T00:00:01.000Z",
  sourceArtifacts: {
    latestLoop: "bench-results/latest.loop.json",
    latestHandoff: "bench-results/latest.handoff.json",
    latestFeedback: "bench-results/latest.feedback.md",
    latestJson: "bench-results/latest.json",
  },
  focus: {
    primaryScenarioId: "hover/failing",
    primarySurface: "hover",
    scenarioIds: ["hover/failing"],
    scenarioCount: 1,
  },
  candidateFiles: [
    {
      path: "/tmp/HoverTranslate.tsx",
      reasons: ["repair hint"],
      symbols: ["mountHoverTranslate"],
      keywords: ["hoverSuppressed"],
      priority: 100,
    },
  ],
  relevantFiles: ["/tmp/HoverTranslate.tsx"],
  validationCommands: ["pnpm bench", "pnpm test"],
  instructions: ["Keep the patch focused."],
  prompt: "Fix hover.",
}

const baseContext: PatchContextPack = {
  schemaVersion: 2,
  runId: "run-7",
  generatedAt: "2026-03-26T00:00:02.000Z",
  sourceArtifacts: {
    latestPatchTask: "bench-results/latest.patch-task.json",
    latestLoop: "bench-results/latest.loop.json",
    latestHandoff: "bench-results/latest.handoff.json",
    latestFeedback: "bench-results/latest.feedback.md",
    latestJson: "bench-results/latest.json",
  },
  budget: {
    maxFiles: 1,
    maxLinesPerFile: 30,
    maxTotalLines: 30,
  },
  files: [
    {
      path: "/tmp/HoverTranslate.tsx",
      exists: true,
      lineCount: 30,
      includedLines: 30,
      truncated: false,
      slices: [
        {
          startLine: 1,
          endLine: 30,
          reason: "fallback: full file",
          strategy: "fallback-head",
        },
      ],
      content: "   1 | const x = 1",
    },
  ],
}

const basePass: PatchPass = {
  schemaVersion: 1,
  runId: "run-7",
  generatedAt: "2026-03-26T00:00:03.000Z",
  sourceArtifacts: {
    latestPatchTask: "bench-results/latest.patch-task.json",
    latestPatchContext: "bench-results/latest.patch-context.json",
    latestLoop: "bench-results/latest.loop.json",
    latestHandoff: "bench-results/latest.handoff.json",
    latestFeedback: "bench-results/latest.feedback.md",
    latestJson: "bench-results/latest.json",
  },
  summary: {
    primaryScenarioId: "hover/failing",
    primarySurface: "hover",
    scenarioCount: 1,
    relevantFileCount: 1,
    contextFileCount: 1,
  },
  execution: {
    writeScope: ["/tmp/HoverTranslate.tsx"],
    validationCommands: ["pnpm bench", "pnpm test"],
    stopConditions: ["Stop if the patch widens."],
  },
  prompt: "Execute the hover patch.",
}

describe("executor reporter", () => {
  it("becomes ready when selected scenarios have explicit failure signals", () => {
    const attempt = buildExecutorAttempt(basePlan, baseTask, baseContext, basePass, {
      latestPatchPass: "bench-results/latest.patch-pass.json",
      latestPatchTask: "bench-results/latest.patch-task.json",
      latestPatchContext: "bench-results/latest.patch-context.json",
      latestLoop: "bench-results/latest.loop.json",
      latestHandoff: "bench-results/latest.handoff.json",
      latestFeedback: "bench-results/latest.feedback.md",
      latestJson: "bench-results/latest.json",
    })

    const markdown = renderExecutorMarkdown(attempt)

    expect(attempt.status).toBe("ready")
    expect(attempt.summary.gateSummary).toEqual({
      decision: "ready",
      reason: "current signal(s) made this attempt ready.",
      error: null,
    })
    expect(attempt.actionableScenarios[0]?.reasons.length).toBeGreaterThan(0)
    expect(attempt.prompt).toContain("restricted Astra auto-patch attempt")
    expect(markdown).toContain("Executor Prompt")
  })

  it("adds structured optimizer prompt policy guidance when analysis-first mode is active", () => {
    const attempt = buildExecutorAttempt(basePlan, baseTask, baseContext, basePass, {
      latestPatchPass: "bench-results/latest.patch-pass.json",
      latestPatchTask: "bench-results/latest.patch-task.json",
      latestPatchContext: "bench-results/latest.patch-context.json",
      latestLoop: "bench-results/latest.loop.json",
      latestHandoff: "bench-results/latest.handoff.json",
      latestFeedback: "bench-results/latest.feedback.md",
      latestJson: "bench-results/latest.json",
    }, {
      optimizer: {
        sourcePath: "bench-opt-results/latest.resolved.json",
        sourceKind: "direct-config",
        prompt: {
          id: "prompt/analysis-first",
          label: "Analysis-first instruction",
          description: "Prompt variant that asks the agent to identify the relevant surface before editing.",
          text: "First identify the relevant files, then edit.",
          policy: {
            analysisMode: "analysis-first",
            toolPolicy: "read-before-edit",
            writeScopeMode: "evidence-led",
          },
        },
        context: {
          id: "context/expanded-task",
          label: "Expanded task context",
          description: "Broader context pack that adds history and candidate file guidance.",
          slots: ["task", "surface", "fixture", "codeHint", "history", "candidateFiles", "patchHints"],
          policy: {
            rankingMode: "explicit-first",
            maxFiles: 6,
            maxLinesPerFile: 120,
            preferHistory: true,
          },
        },
      },
    })

    expect(attempt.prompt).toContain("prompt policy: analysis=analysis-first, tools=read-before-edit, write-scope=evidence-led")
    expect(attempt.prompt).toContain("Analysis-first policy:")
    expect(attempt.prompt).toContain("Tool policy: read the provided context bundle first")
    expect(attempt.prompt).toContain("Stay inside the write scope by default")
  })

  it("renders a history-backed gate decision when history made the executor ready", () => {
    const plan: LoopPlan = {
      ...basePlan,
      history: {
        sourceJsonPath: "bench-results/latest.history.json",
        sourceMarkdownPath: "bench-results/latest.history.md",
        totalRuns: 8,
        notes: [],
        weakestSurfaces: [],
        recurringFailures: [{
          id: "hover/polish",
          surface: "hover",
          issueCount: 4,
          failureCount: 3,
          regressionCount: 2,
          averageTotal: 88,
          latestTotal: 92,
          worstTotal: 61,
        }],
      },
      selectedItems: [{
        ...basePlan.selectedItems[0],
        id: "hover/polish",
        pass: true,
        status: "unchanged",
        issues: [],
        nextActions: [],
      }],
    }

    const attempt = buildExecutorAttempt(plan, baseTask, baseContext, basePass, {
      latestPatchPass: "bench-results/latest.patch-pass.json",
      latestPatchTask: "bench-results/latest.patch-task.json",
      latestPatchContext: "bench-results/latest.patch-context.json",
      latestLoop: "bench-results/latest.loop.json",
      latestHandoff: "bench-results/latest.handoff.json",
      latestFeedback: "bench-results/latest.feedback.md",
      latestJson: "bench-results/latest.json",
    })

    const markdown = renderExecutorMarkdown(attempt)

    expect(markdown).toContain("## Gate Decision")
    expect(markdown).toContain("Decision: `ready`")
    expect(attempt.summary.gateSummary).toEqual({
      decision: "ready",
      reason: "history-backed signal(s) made this attempt ready.",
      error: null,
    })
    expect(markdown).toContain("Why: history-backed signal(s) made this attempt ready.")
    expect(markdown).toContain("History-backed signals:")
    expect(markdown).toContain("history recurrence: scenario recorded 4 issue hits")
  })

  it("becomes ready from recurring history even without a current-loop failure signal", () => {
    const plan: LoopPlan = {
      ...basePlan,
      history: {
        sourceJsonPath: "bench-results/latest.history.json",
        sourceMarkdownPath: "bench-results/latest.history.md",
        totalRuns: 8,
        notes: [],
        weakestSurfaces: [],
        recurringFailures: [{
          id: "hover/polish",
          surface: "hover",
          issueCount: 4,
          failureCount: 3,
          regressionCount: 2,
          averageTotal: 88,
          latestTotal: 92,
          worstTotal: 61,
        }],
      },
      selectedItems: [{
        ...basePlan.selectedItems[0],
        id: "hover/polish",
        pass: true,
        status: "unchanged",
        issues: [],
        nextActions: [],
      }],
    }

    const attempt = buildExecutorAttempt(plan, baseTask, baseContext, basePass, {
      latestPatchPass: "bench-results/latest.patch-pass.json",
      latestPatchTask: "bench-results/latest.patch-task.json",
      latestPatchContext: "bench-results/latest.patch-context.json",
      latestLoop: "bench-results/latest.loop.json",
      latestHandoff: "bench-results/latest.handoff.json",
      latestFeedback: "bench-results/latest.feedback.md",
      latestJson: "bench-results/latest.json",
    })

    expect(attempt.status).toBe("ready")
    expect(attempt.summary.gateSummary).toEqual({
      decision: "ready",
      reason: "history-backed signal(s) made this attempt ready.",
      error: null,
    })
    expect(attempt.actionableScenarios[0]?.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("history recurrence: scenario recorded 4 issue hits"),
        expect.stringContaining("history recurrence: scenario regressed in 2 archived runs"),
      ]),
    )
    expect(renderExecutorMarkdown(attempt)).toContain("Why: history-backed signal(s) made this attempt ready.")
  })

  it("becomes ready from weak-surface history even without a current-loop failure signal", () => {
    const plan: LoopPlan = {
      ...basePlan,
      history: {
        sourceJsonPath: "bench-results/latest.history.json",
        sourceMarkdownPath: "bench-results/latest.history.md",
        totalRuns: 8,
        notes: [],
        weakestSurfaces: [{
          surface: "hover",
          averageTotal: 93,
          direction: "regressing",
          failureRuns: 3,
        }],
        recurringFailures: [],
      },
      selectedItems: [{
        ...basePlan.selectedItems[0],
        id: "hover/polish",
        pass: true,
        status: "unchanged",
        issues: [],
        nextActions: [],
      }],
    }

    const attempt = buildExecutorAttempt(plan, baseTask, baseContext, basePass, {
      latestPatchPass: "bench-results/latest.patch-pass.json",
      latestPatchTask: "bench-results/latest.patch-task.json",
      latestPatchContext: "bench-results/latest.patch-context.json",
      latestLoop: "bench-results/latest.loop.json",
      latestHandoff: "bench-results/latest.handoff.json",
      latestFeedback: "bench-results/latest.feedback.md",
      latestJson: "bench-results/latest.json",
    })

    expect(attempt.status).toBe("ready")
    expect(attempt.summary.gateSummary).toEqual({
      decision: "ready",
      reason: "history-backed signal(s) made this attempt ready.",
      error: null,
    })
    expect(attempt.actionableScenarios[0]?.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("history weak surface: hover averaged 93.0"),
        expect.stringContaining("history weak surface: hover is regressing"),
      ]),
    )
    expect(renderExecutorMarkdown(attempt)).toContain("Why: history-backed signal(s) made this attempt ready.")
    expect(renderExecutorMarkdown(attempt)).toContain("History-backed signals:")
  })

  it("stays ready on a history-backed drill path without requiring a current failure", () => {
    const plan: LoopPlan = {
      ...basePlan,
      drill: {
        ...basePlan.drill,
        enabled: true,
        scenarioId: "hover/polish",
        reason: "Synthetic history-backed ready path.",
        historyReady: true,
      },
      history: {
        sourceJsonPath: null,
        sourceMarkdownPath: null,
        totalRuns: 1,
        notes: ["Synthetic drill history added to exercise a history-backed ready path."],
        weakestSurfaces: [{
          surface: "hover",
          averageTotal: 92,
          direction: "regressing",
          failureRuns: 1,
        }],
        recurringFailures: [{
          id: "hover/polish",
          surface: "hover",
          issueCount: 3,
          failureCount: 1,
          regressionCount: 1,
          averageTotal: 90,
          latestTotal: 94,
          worstTotal: 75,
        }],
      },
      selectedItems: [{
        ...basePlan.selectedItems[0],
        id: "hover/polish",
        pass: true,
        status: "unchanged",
        issues: [],
        nextActions: [],
      }],
    }

    const attempt = buildExecutorAttempt(plan, baseTask, baseContext, basePass, {
      latestPatchPass: "bench-results/latest.patch-pass.json",
      latestPatchTask: "bench-results/latest.patch-task.json",
      latestPatchContext: "bench-results/latest.patch-context.json",
      latestLoop: "bench-results/latest.loop.json",
      latestHandoff: "bench-results/latest.handoff.json",
      latestFeedback: "bench-results/latest.feedback.md",
      latestJson: "bench-results/latest.json",
    })

    expect(attempt.status).toBe("ready")
    expect(attempt.summary.gateSummary).toEqual({
      decision: "ready",
      reason: "history-backed signal(s) made this attempt ready.",
      error: null,
    })
    expect(attempt.actionableScenarios[0]?.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("history recurrence: scenario recorded 3 issue hits"),
        expect.stringContaining("history weak surface: hover averaged 92.0"),
      ]),
    )
    expect(renderExecutorMarkdown(attempt)).toContain("Ready path: history-backed signals only; no current explicit failure was required.")
  })

  it("blocks when there is no current or history-backed failure signal", () => {
    const plan: LoopPlan = {
      ...basePlan,
      selectedItems: [{
        ...basePlan.selectedItems[0],
        id: "hover/polish",
        pass: true,
        status: "unchanged",
        issues: [],
        nextActions: [],
      }],
    }

    const attempt = buildExecutorAttempt(plan, baseTask, baseContext, basePass, {
      latestPatchPass: "bench-results/latest.patch-pass.json",
      latestPatchTask: "bench-results/latest.patch-task.json",
      latestPatchContext: "bench-results/latest.patch-context.json",
      latestLoop: "bench-results/latest.loop.json",
      latestHandoff: "bench-results/latest.handoff.json",
      latestFeedback: "bench-results/latest.feedback.md",
      latestJson: "bench-results/latest.json",
    })

    expect(attempt.status).toBe("blocked")
    expect(attempt.summary.gateSummary).toEqual({
      decision: "blocked",
      reason: "No selected scenario has a current failure/regression signal or a qualifying history recurrence/weak-surface signal. Automatic patching is blocked to avoid no-signal edits.",
      error: null,
    })
    expect(attempt.summary.blockReason).toContain("current failure/regression signal or a qualifying history recurrence/weak-surface signal")
  })
})
