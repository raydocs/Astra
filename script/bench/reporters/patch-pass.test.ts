import { describe, expect, it } from "vitest"

import { buildPatchPass, renderPatchPassMarkdown } from "./patch-pass"
import type { PatchContextPack, PatchTask } from "../types"

const patchTask: PatchTask = {
  schemaVersion: 2,
  runId: "run-6",
  generatedAt: "2026-03-26T00:00:00.000Z",
  sourceArtifacts: {
    latestLoop: "data/bench-results/latest.loop.json",
    latestHandoff: "data/bench-results/latest.handoff.json",
    latestFeedback: "data/bench-results/latest.feedback.md",
    latestJson: "data/bench-results/latest.json",
    latestHistoryJson: "data/bench-results/latest.history.json",
    latestHistoryMarkdown: "data/bench-results/latest.history.md",
  },
  focus: {
    primaryScenarioId: "hover/alt-success",
    primarySurface: "hover",
    scenarioIds: ["hover/alt-success", "hover/disabled-suppressed"],
    scenarioCount: 2,
  },
  candidateFiles: [
    {
      path: "/tmp/HoverTranslate.tsx",
      reasons: ["surface fallback"],
      symbols: [],
      keywords: [],
      priority: 20,
    },
  ],
  relevantFiles: ["/tmp/HoverTranslate.tsx"],
  validationCommands: ["pnpm bench", "pnpm test"],
  instructions: ["Keep the patch focused."],
  history: {
    sourceJsonPath: "data/bench-results/latest.history.json",
    sourceMarkdownPath: "data/bench-results/latest.history.md",
    totalRuns: 8,
    notes: ["Loaded 8 historical runs."],
    weakestSurfaces: [
      { surface: "hover", averageTotal: 93, direction: "improving", failureRuns: 2 },
    ],
    recurringFailures: [
      { id: "hover/alt-success", surface: "hover", issueCount: 3, latestTotal: 82, worstTotal: 40 },
    ],
  },
  prompt: "Fix hover.",
}

const patchContext: PatchContextPack = {
  schemaVersion: 2,
  runId: "run-6",
  generatedAt: "2026-03-26T00:00:01.000Z",
  sourceArtifacts: {
    latestPatchTask: "data/bench-results/latest.patch-task.json",
    latestLoop: "data/bench-results/latest.loop.json",
    latestHandoff: "data/bench-results/latest.handoff.json",
    latestFeedback: "data/bench-results/latest.feedback.md",
    latestJson: "data/bench-results/latest.json",
  },
  budget: {
    maxFiles: 1,
    maxLinesPerFile: 20,
    maxTotalLines: 20,
  },
  files: [
    {
      path: "/tmp/HoverTranslate.tsx",
      exists: true,
      lineCount: 50,
      includedLines: 20,
      truncated: true,
      slices: [
        {
          startLine: 1,
          endLine: 20,
          reason: "fallback: file head",
          strategy: "fallback-head",
        },
      ],
      content: "   1 | const value = 1",
    },
  ],
}

describe("patch pass reporter", () => {
  it("combines task and context into a single executor brief", () => {
    const pass = buildPatchPass(patchTask, patchContext, {
      latestPatchTask: "data/bench-results/latest.patch-task.json",
      latestPatchContext: "data/bench-results/latest.patch-context.json",
      latestLoop: "data/bench-results/latest.loop.json",
      latestHandoff: "data/bench-results/latest.handoff.json",
      latestFeedback: "data/bench-results/latest.feedback.md",
      latestJson: "data/bench-results/latest.json",
      latestHistoryJson: "data/bench-results/latest.history.json",
      latestHistoryMarkdown: "data/bench-results/latest.history.md",
    })

    const markdown = renderPatchPassMarkdown(pass)

    expect(pass.summary.primaryScenarioId).toBe("hover/alt-success")
    expect(pass.execution.writeScope).toEqual(["/tmp/HoverTranslate.tsx"])
    expect(pass.prompt).toContain("Context bundle:")
    expect(pass.prompt).toContain("History signals:")
    expect(markdown).toContain("Astra Patch Pass")
    expect(markdown).toContain("Executor Prompt")
    expect(markdown).toContain("## History Signals")
    expect(markdown).toContain("Latest history JSON")
  })
})
