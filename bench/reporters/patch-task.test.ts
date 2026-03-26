import { describe, expect, it } from "vitest"

import { buildPatchTask, renderPatchTaskMarkdown } from "./patch-task"
import type { LoopPlan } from "../types"

const loopPlan: LoopPlan = {
  schemaVersion: 1,
  runId: "run-4",
  generatedAt: "2026-03-26T00:00:00.000Z",
  sourceArtifacts: {
    latestHandoff: "bench-results/latest.handoff.json",
    latestFeedback: "bench-results/latest.feedback.md",
    latestJson: "bench-results/latest.json",
  },
  selection: {
    maxItems: 3,
    includeMedium: false,
    selectedCount: 2,
    mode: "critical-high",
  },
  drill: {
    enabled: false,
    scenarioId: null,
    reason: null,
  },
  summary: {
    failedScenarios: 0,
    regressedScenarios: 0,
    imperfectPasses: 2,
  },
  selectedItems: [
    {
      id: "hover/alt-success",
      title: "Hover alt",
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
      scoreDeltas: [],
      suggestedPrompt: "Polish hover alt.",
    },
    {
      id: "hover/disabled-suppressed",
      title: "Hover disabled",
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
      scoreDeltas: [],
      suggestedPrompt: "Polish hover disabled.",
    },
  ],
}

describe("patch task reporter", () => {
  it("derives a focused file set from the selected loop scenarios", () => {
    const task = buildPatchTask(loopPlan, {
      latestLoop: "bench-results/latest.loop.json",
      latestHandoff: "bench-results/latest.handoff.json",
      latestFeedback: "bench-results/latest.feedback.md",
      latestJson: "bench-results/latest.json",
    })

    const markdown = renderPatchTaskMarkdown(task)

    expect(task.focus.primarySurface).toBe("hover")
    expect(task.relevantFiles.some((file) => file.endsWith("/src/entrypoints/content/components/HoverTranslate.tsx"))).toBe(true)
    expect(task.prompt).toContain("hover/alt-success")
    expect(markdown).toContain("Astra Patch Task")
  })
})
