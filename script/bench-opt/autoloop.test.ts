import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { runBenchOptAutoLoop } from "./autoloop.ts"

function createBaselineReport() {
  return {
    runId: "2026-03-26T00-00-00-000Z",
    generatedAt: "2026-03-26T00:00:00.000Z",
    summary: {
      totalScenarios: 1,
      passedScenarios: 1,
      failedScenarios: 0,
      averageTotal: 100,
      surfaces: [
        {
          surface: "page-translation",
          scenarioCount: 1,
          passed: 1,
          failed: 0,
          averageTotal: 100,
        },
      ],
    },
    comparison: {
      regressions: 0,
      improvements: 0,
      unchanged: 1,
      added: 0,
    },
    scenarios: [
      {
        id: "page-translation/example",
        title: "Example",
        task: "Example task",
        surface: "page-translation",
        evaluation: {
          total: 100,
          pass: true,
        },
      },
    ],
  }
}

describe("bench-opt autoloop", () => {
  it("starts, resumes, and reaches a terminal keep decision across two cycles", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "astra-bench-opt-autoloop-"))
    const baselineDir = path.join(tempRoot, "data/bench-results")
    const outputDir = path.join(tempRoot, "data/bench-opt-results")
    await mkdir(baselineDir, { recursive: true })

    const baselinePath = path.join(baselineDir, "latest.json")
    await writeFile(baselinePath, JSON.stringify(createBaselineReport(), null, 2))

    const result = await runBenchOptAutoLoop([
      "--output",
      outputDir,
      "--baseline",
      baselinePath,
      "--max-cycles",
      "2",
      "--orchestration-max-iterations",
      "1",
      "--orchestration-follow-up-sequence",
      "rerun,keep",
    ])

    expect(result).not.toBeNull()
    expect(result?.artifact.completedCycles).toBe(2)
    expect(result?.artifact.terminal).toBe(true)
    expect(result?.artifact.finalDecision).toBe("keep")
    expect(result?.artifact.cycles[0]?.mode).toBe("start")
    expect(result?.artifact.cycles[0]?.handoffTarget).toBe("same-session")
    expect(result?.artifact.cycles[1]?.mode).toBe("resume")
    expect(result?.artifact.cycles[1]?.decision).toBe("keep")
    await expect(readFile(result!.jsonPath, "utf8")).resolves.toContain("\"completedCycles\": 2")
    await expect(readFile(result!.markdownPath, "utf8")).resolves.toContain("# Astra Bench Opt Autoloop")
  })

  it("stops after a fresh-session handoff instead of pretending it can same-session resume", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "astra-bench-opt-autoloop-fresh-"))
    const baselineDir = path.join(tempRoot, "data/bench-results")
    const outputDir = path.join(tempRoot, "data/bench-opt-results")
    await mkdir(baselineDir, { recursive: true })

    const baselinePath = path.join(baselineDir, "latest.json")
    await writeFile(baselinePath, JSON.stringify(createBaselineReport(), null, 2))

    const result = await runBenchOptAutoLoop([
      "--output",
      outputDir,
      "--baseline",
      baselinePath,
      "--max-cycles",
      "2",
      "--orchestration-max-iterations",
      "1",
      "--orchestration-follow-up-sequence",
      "rerun",
      "--session-force-compaction",
    ])

    expect(result).not.toBeNull()
    expect(result?.artifact.completedCycles).toBe(1)
    expect(result?.artifact.terminal).toBe(false)
    expect(result?.artifact.cycles[0]?.handoffTarget).toBe("fresh-session")
    expect(result?.artifact.cycles[0]?.phase).toBe("handoff")
  })
})
