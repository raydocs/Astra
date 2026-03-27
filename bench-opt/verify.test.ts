import { mkdir, mkdtemp } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  buildBenchOptVerificationPlan,
  runBenchOptVerificationPlan,
} from "./verify.ts"

function nodeCommand(script: string) {
  return [process.execPath, "-e", script] as const
}

describe("bench-opt verify", () => {
  it("builds type-check, test, and split-aware bench commands for a worktree", () => {
    const plan = buildBenchOptVerificationPlan("/tmp/bench-opt-worktree", {
      packageManager: "pnpm",
      includeTypeCheck: true,
      includeTests: true,
      benchSplits: ["train", "holdout"],
      typeCheckArgs: ["--pretty"],
      testArgs: ["--runInBand"],
      benchArgs: ["--reporter", "dot"],
      commandTimeoutMs: {
        "type-check": 30_000,
        tests: 45_000,
        bench: 60_000,
      },
    })

    expect(plan.worktreePath).toBe("/tmp/bench-opt-worktree")
    expect(plan.benchSplits).toEqual(["train", "holdout"])
    expect(plan.commands.map((command) => command.id)).toEqual([
      "type-check",
      "tests",
      "bench-train",
      "bench-holdout",
    ])
    expect(plan.commands[0]?.command).toEqual(["pnpm", "type-check", "--pretty"])
    expect(plan.commands[1]?.command).toEqual(["pnpm", "test", "--runInBand"])
    expect(plan.commands[2]?.command).toEqual(["pnpm", "bench", "--", "--split", "train", "--reporter", "dot"])
    expect(plan.commands[2]?.split).toBe("train")
    expect(plan.commands[3]?.command).toEqual(["pnpm", "bench", "--", "--split", "holdout", "--reporter", "dot"])
    expect(plan.notes).toContain("bench splits=train, holdout")
  })

  it("runs a verification plan and preserves command metadata in structured results", async () => {
    const worktreePath = await mkdtemp(path.join(os.tmpdir(), "astra-bench-opt-verify-"))
    await mkdir(path.join(worktreePath, "subdir"), { recursive: true })

    const result = await runBenchOptVerificationPlan({
      worktreePath,
      benchSplits: ["train"],
      notes: ["manual verification plan"],
      commands: [
        {
          id: "type-check",
          kind: "type-check",
          command: nodeCommand("process.stdout.write('type-check')"),
        },
        {
          id: "tests",
          kind: "tests",
          command: nodeCommand("process.stdout.write('tests')"),
        },
        {
          id: "bench-train",
          kind: "bench",
          split: "train",
          cwd: "subdir",
          command: nodeCommand("process.stdout.write(process.cwd())"),
        },
      ],
    }, {
      stopOnFailure: true,
    })

    expect(result.status).toBe("passed")
    expect(result.failedCommandId).toBeNull()
    expect(result.plan.benchSplits).toEqual(["train"])
    expect(result.execution.commands[0]?.kind).toBe("type-check")
    expect(result.execution.commands[1]?.kind).toBe("tests")
    expect(result.execution.commands[2]?.kind).toBe("bench")
    expect(result.execution.commands[2]?.split).toBe("train")
    expect(result.execution.commands[2]?.stdout.endsWith(`${path.sep}subdir`)).toBe(true)
    expect(result.notes).toContain("manual verification plan")
    expect(result.notes).toContain("Sequence stops after the first failed, timed-out, or errored command.")
  })
})
