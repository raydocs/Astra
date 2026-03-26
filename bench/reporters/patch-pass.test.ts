import { describe, expect, it } from "vitest"

import { buildPatchPass, renderPatchPassMarkdown } from "./patch-pass"
import type { PatchContextPack, PatchTask } from "../types"

const patchTask: PatchTask = {
  schemaVersion: 1,
  runId: "run-6",
  generatedAt: "2026-03-26T00:00:00.000Z",
  sourceArtifacts: {
    latestLoop: "bench-results/latest.loop.json",
    latestHandoff: "bench-results/latest.handoff.json",
    latestFeedback: "bench-results/latest.feedback.md",
    latestJson: "bench-results/latest.json",
  },
  focus: {
    primaryScenarioId: "hover/alt-success",
    primarySurface: "hover",
    scenarioIds: ["hover/alt-success", "hover/disabled-suppressed"],
    scenarioCount: 2,
  },
  relevantFiles: ["/tmp/HoverTranslate.tsx"],
  validationCommands: ["pnpm bench", "pnpm test"],
  instructions: ["Keep the patch focused."],
  prompt: "Fix hover.",
}

const patchContext: PatchContextPack = {
  schemaVersion: 1,
  runId: "run-6",
  generatedAt: "2026-03-26T00:00:01.000Z",
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
      lineCount: 50,
      includedLines: 20,
      truncated: true,
      content: "   1 | const value = 1",
    },
  ],
}

describe("patch pass reporter", () => {
  it("combines task and context into a single executor brief", () => {
    const pass = buildPatchPass(patchTask, patchContext, {
      latestPatchTask: "bench-results/latest.patch-task.json",
      latestPatchContext: "bench-results/latest.patch-context.json",
      latestLoop: "bench-results/latest.loop.json",
      latestHandoff: "bench-results/latest.handoff.json",
      latestFeedback: "bench-results/latest.feedback.md",
      latestJson: "bench-results/latest.json",
    })

    const markdown = renderPatchPassMarkdown(pass)

    expect(pass.summary.primaryScenarioId).toBe("hover/alt-success")
    expect(pass.execution.writeScope).toEqual(["/tmp/HoverTranslate.tsx"])
    expect(pass.prompt).toContain("Context bundle:")
    expect(markdown).toContain("Astra Patch Pass")
    expect(markdown).toContain("Executor Prompt")
  })
})
