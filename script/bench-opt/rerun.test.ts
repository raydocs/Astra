import { mkdir, mkdtemp } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { runBoundedCommandSequence } from "./rerun.ts"

function nodeCommand(script: string) {
  return [process.execPath, "-e", script] as const
}

describe("bench-opt rerun", () => {
  it("captures stdout, stderr, exit codes, and skips later commands after a failure", async () => {
    const worktreePath = await mkdtemp(path.join(os.tmpdir(), "astra-bench-opt-rerun-"))
    const nestedPath = path.join(worktreePath, "nested")
    await mkdir(nestedPath, { recursive: true })

    const result = await runBoundedCommandSequence(worktreePath, [
      {
        id: "failing-command",
        label: "failing command",
        cwd: "nested",
        command: nodeCommand("process.stdout.write(process.cwd()); process.stderr.write('first-stderr'); process.exit(7)"),
      },
      {
        id: "skipped-command",
        label: "skipped command",
        command: nodeCommand("process.stdout.write('second-command')"),
      },
    ])

    expect(result.worktreePath).toBe(worktreePath)
    expect(result.commandCount).toBe(2)
    expect(result.completedCount).toBe(1)
    expect(result.passedCount).toBe(0)
    expect(result.failedCount).toBe(1)
    expect(result.skippedCount).toBe(1)
    expect(result.success).toBe(false)
    expect(result.failureCommandId).toBe("failing-command")
    expect(result.commands[0]?.status).toBe("failed")
    expect(result.commands[0]?.exitCode).toBe(7)
    expect(result.commands[0]?.stdout.endsWith(`${path.sep}nested`)).toBe(true)
    expect(result.commands[0]?.stderr).toBe("first-stderr")
    expect(result.commands[1]?.status).toBe("skipped")
    expect(result.commands[1]?.stdout).toBe("")
    expect(result.notes).toContain("Sequence stops after the first failed, timed-out, or errored command.")
  })

  it("continues past failures when requested and truncates large command output", async () => {
    const worktreePath = await mkdtemp(path.join(os.tmpdir(), "astra-bench-opt-rerun-truncate-"))

    const result = await runBoundedCommandSequence(worktreePath, [
      {
        id: "large-output",
        command: nodeCommand("process.stdout.write('x'.repeat(128)); process.stderr.write('y'.repeat(128))"),
        maxOutputBytes: 16,
      },
      {
        id: "after-failure",
        command: nodeCommand("process.stdout.write('still-runs')"),
      },
    ], {
      stopOnFailure: false,
      defaultMaxOutputBytes: 16,
    })

    expect(result.success).toBe(true)
    expect(result.passedCount).toBe(2)
    expect(result.commands[0]?.stdoutTruncated).toBe(true)
    expect(result.commands[0]?.stderrTruncated).toBe(true)
    expect(result.commands[0]?.stdout).toContain("truncated")
    expect(result.commands[0]?.stderr).toContain("truncated")
    expect(result.commands[1]?.status).toBe("passed")
    expect(result.notes).toContain("Sequence continues after failures because stopOnFailure=false.")
  })

  it("marks a command as timed out when it exceeds the bounded timeout", async () => {
    const worktreePath = await mkdtemp(path.join(os.tmpdir(), "astra-bench-opt-rerun-timeout-"))

    const result = await runBoundedCommandSequence(worktreePath, [
      {
        id: "slow-command",
        command: nodeCommand("setTimeout(() => {}, 10_000)"),
        timeoutMs: 50,
      },
    ], {
      defaultTimeoutMs: 50,
      timeoutKillMs: 10,
    })

    expect(result.success).toBe(false)
    expect(result.timedOutCount).toBe(1)
    expect(result.failureCommandId).toBe("slow-command")
    expect(result.commands[0]?.status).toBe("timed_out")
    expect(result.commands[0]?.timedOut).toBe(true)
    expect(result.commands[0]?.error).toContain("timed out")
  })
})
