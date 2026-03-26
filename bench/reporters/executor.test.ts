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
  schemaVersion: 1,
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
  relevantFiles: ["/tmp/HoverTranslate.tsx"],
  validationCommands: ["pnpm bench", "pnpm test"],
  instructions: ["Keep the patch focused."],
  prompt: "Fix hover.",
}

const baseContext: PatchContextPack = {
  schemaVersion: 1,
  runId: "run-7",
  generatedAt: "2026-03-26T00:00:02.000Z",
  sourceArtifacts: {
    latestPatchTask: "bench-results/latest.patch-task.json",
    latestLoop: "bench-results/latest.loop.json",
    latestHandoff: "bench-results/latest.handoff.json",
    latestFeedback: "bench-results/latest.feedback.md",
    latestJson: "bench-results/latest.json",
  },
  files: [
    {
      path: "/tmp/HoverTranslate.tsx",
      exists: true,
      lineCount: 30,
      includedLines: 30,
      truncated: false,
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
    expect(attempt.actionableScenarios[0]?.reasons.length).toBeGreaterThan(0)
    expect(attempt.prompt).toContain("restricted Astra auto-patch attempt")
    expect(markdown).toContain("Executor Prompt")
  })

  it("blocks when there is no explicit failure signal", () => {
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
    expect(attempt.summary.blockReason).toContain("No selected scenario has an explicit failure")
  })
})
