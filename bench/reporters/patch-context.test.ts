import path from "node:path"

import { describe, expect, it } from "vitest"

import { buildPatchContextPack, renderPatchContextMarkdown } from "./patch-context"
import type { PatchTask } from "../types"

const patchTask: PatchTask = {
  schemaVersion: 1,
  runId: "run-5",
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
    scenarioIds: ["hover/alt-success"],
    scenarioCount: 1,
  },
  relevantFiles: [
    path.resolve(process.cwd(), "bench/reporters/patch-task.ts"),
  ],
  validationCommands: ["pnpm bench", "pnpm test"],
  instructions: ["Keep the patch focused."],
  prompt: "Fix hover.",
}

describe("patch context reporter", () => {
  it("captures numbered file context for relevant files", async () => {
    const pack = await buildPatchContextPack(patchTask, {
      latestPatchTask: "bench-results/latest.patch-task.json",
      latestLoop: "bench-results/latest.loop.json",
      latestHandoff: "bench-results/latest.handoff.json",
      latestFeedback: "bench-results/latest.feedback.md",
      latestJson: "bench-results/latest.json",
    }, {
      maxLinesPerFile: 20,
    })

    const markdown = renderPatchContextMarkdown(pack)

    expect(pack.files).toHaveLength(1)
    expect(pack.files[0]?.exists).toBe(true)
    expect(pack.files[0]?.content).toContain("   1 |")
    expect(markdown).toContain("Astra Patch Context")
    expect(markdown).toContain("Included lines:")
  })
})
