import { describe, expect, it } from "vitest"

import { buildDispatchArtifact, createDispatchPrompt, renderDispatchMarkdown } from "./dispatch"
import type { ExecutorAttempt } from "../types"

const readyExecutor: ExecutorAttempt = {
  schemaVersion: 1,
  runId: "run-8",
  generatedAt: "2026-03-26T00:00:00.000Z",
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
    primaryScenarioId: "hover/failing",
    blockReason: null,
    gateSummary: {
      decision: "ready",
      reason: "current signal(s) made this attempt ready.",
      error: null,
    },
  },
  actionableScenarios: [{
    id: "hover/failing",
    surface: "hover",
    priority: "critical",
    status: "regressed",
    pass: false,
    reasons: ["scenario is currently failing"],
  }],
  writeScope: ["/tmp/HoverTranslate.tsx"],
  prompt: "Fix hover.",
}

describe("dispatch reporter", () => {
  it("builds a ready prompt from the executor brief and patch context", () => {
    const prompt = createDispatchPrompt(readyExecutor, "# Context\nfile body")
    expect(prompt).toContain("Fix hover.")
    expect(prompt).toContain("Patch context bundle:")
  })

  it("renders blocked dispatches without a response", () => {
    const artifact = buildDispatchArtifact({
      executor: {
        ...readyExecutor,
        status: "blocked",
        summary: {
          ...readyExecutor.summary,
          actionableScenarioCount: 0,
          blockReason: "Blocked on purpose.",
        },
        prompt: null,
      },
      provider: {
        id: "openai",
        model: "gpt-4o-mini",
        baseURL: null,
      },
      sourceArtifacts: {
        latestExecutor: "bench-results/latest.executor.json",
        latestPatchPass: "bench-results/latest.patch-pass.json",
        latestPatchContext: "bench-results/latest.patch-context.md",
      },
      prompt: null,
    })

    const markdown = renderDispatchMarkdown(artifact)
    expect(artifact.status).toBe("blocked")
    expect(artifact.summary.gateSummary).toEqual({
      decision: "blocked",
      reason: "Blocked on purpose.",
      error: null,
    })
    expect(markdown).toContain("## Gate Decision")
    expect(markdown).toContain("Decision: `blocked`")
    expect(markdown).toContain("Blocked")
  })
})
