import { spawn } from "node:child_process"
import { stat } from "node:fs/promises"
import path from "node:path"

import type { OptimizerCandidateKind } from "./types.ts"

export interface BenchOptRerunCommandSpec {
  id: string
  command: readonly [string, ...string[]]
  cwd?: string
  env?: NodeJS.ProcessEnv
  timeoutMs?: number
  maxOutputBytes?: number
  label?: string
}

export interface BenchOptRerunCommandResult {
  id: string
  label: string | null
  command: string[]
  cwd: string
  startedAt: string
  endedAt: string
  durationMs: number
  exitCode: number | null
  signal: NodeJS.Signals | null
  status: "passed" | "failed" | "timed_out" | "errored" | "skipped"
  timedOut: boolean
  stdout: string
  stderr: string
  stdoutTruncated: boolean
  stderrTruncated: boolean
  error: string | null
}

export interface BenchOptRerunResult {
  worktreePath: string
  startedAt: string
  endedAt: string
  durationMs: number
  commandCount: number
  completedCount: number
  passedCount: number
  failedCount: number
  timedOutCount: number
  erroredCount: number
  skippedCount: number
  success: boolean
  failureCommandId: string | null
  commands: BenchOptRerunCommandResult[]
  notes: string[]
}

/** Mutation context attached to a rerun to track which candidate kind is being re-evaluated. */
export interface BenchOptRerunMutationContext {
  /** The candidate kind being re-evaluated. */
  candidateKind: OptimizerCandidateKind
  /** Human-readable description of mutation changes being re-evaluated. */
  mutationSummary: string | null
}

export interface BenchOptRerunOptions {
  stopOnFailure?: boolean
  defaultTimeoutMs?: number
  defaultMaxOutputBytes?: number
  timeoutKillMs?: number
  env?: NodeJS.ProcessEnv
  /** Optional mutation context for tool-config or agent-graph reruns. */
  mutationContext?: BenchOptRerunMutationContext
}

const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000
const DEFAULT_MAX_OUTPUT_BYTES = 1_048_576
const DEFAULT_TIMEOUT_KILL_MS = 2_000

function resolveInsideWorktree(worktreePath: string, targetPath?: string) {
  const resolvedWorktree = path.resolve(worktreePath)
  const resolvedPath = path.resolve(resolvedWorktree, targetPath ?? ".")

  if (!resolvedPath.startsWith(`${resolvedWorktree}${path.sep}`) && resolvedPath !== resolvedWorktree) {
    throw new Error(`Refusing to run outside the worktree: ${targetPath ?? "."}`)
  }

  return resolvedPath
}

function createLimitedBufferCapture(maxBytes: number) {
  const chunks: Buffer[] = []
  let storedBytes = 0
  let truncatedBytes = 0

  return {
    push(chunk: Buffer) {
      if (maxBytes <= 0) {
        truncatedBytes += chunk.length
        return
      }

      if (storedBytes >= maxBytes) {
        truncatedBytes += chunk.length
        return
      }

      const remaining = maxBytes - storedBytes
      if (chunk.length <= remaining) {
        chunks.push(chunk)
        storedBytes += chunk.length
        return
      }

      chunks.push(chunk.subarray(0, remaining))
      storedBytes += remaining
      truncatedBytes += chunk.length - remaining
    },
    finalize() {
      const text = Buffer.concat(chunks, storedBytes).toString("utf8")
      return {
        text: truncatedBytes > 0 ? `${text}\n...[truncated ${truncatedBytes} bytes]` : text,
        truncated: truncatedBytes > 0,
      }
    },
  }
}

async function ensureWorktreeExists(worktreePath: string) {
  const info = await stat(worktreePath)
  if (!info.isDirectory()) {
    throw new Error(`Expected a worktree directory at ${worktreePath}`)
  }
}

async function runSingleCommand(
  worktreePath: string,
  spec: BenchOptRerunCommandSpec,
  options: Required<Pick<BenchOptRerunOptions, "defaultTimeoutMs" | "defaultMaxOutputBytes" | "timeoutKillMs">> & Pick<BenchOptRerunOptions, "env">,
): Promise<BenchOptRerunCommandResult> {
  const startedAt = new Date()
  const resolvedCwd = resolveInsideWorktree(worktreePath, spec.cwd)
  const timeoutMs = spec.timeoutMs ?? options.defaultTimeoutMs
  const maxOutputBytes = spec.maxOutputBytes ?? options.defaultMaxOutputBytes
  const stdoutCapture = createLimitedBufferCapture(maxOutputBytes)
  const stderrCapture = createLimitedBufferCapture(maxOutputBytes)

  return new Promise<BenchOptRerunCommandResult>((resolve) => {
    let settled = false
    let timedOut = false
    let errorMessage: string | null = null
    let exitCode: number | null = null
    let signal: NodeJS.Signals | null = null
    let timeoutHandle: NodeJS.Timeout | null = null
    let killHandle: NodeJS.Timeout | null = null

    const finish = (
      status: BenchOptRerunCommandResult["status"],
    ) => {
      if (settled) {
        return
      }
      settled = true
      if (timeoutHandle) {
        clearTimeout(timeoutHandle)
      }
      if (killHandle) {
        clearTimeout(killHandle)
      }
      const endedAt = new Date()
      const stdout = stdoutCapture.finalize()
      const stderr = stderrCapture.finalize()

      resolve({
        id: spec.id,
        label: spec.label ?? null,
        command: [...spec.command],
        cwd: resolvedCwd,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs: endedAt.getTime() - startedAt.getTime(),
        exitCode,
        signal,
        status,
        timedOut,
        stdout: stdout.text,
        stderr: stderr.text,
        stdoutTruncated: stdout.truncated,
        stderrTruncated: stderr.truncated,
        error: errorMessage,
      })
    }

    const child = spawn(spec.command[0], spec.command.slice(1), {
      cwd: resolvedCwd,
      env: {
        ...process.env,
        ...options.env,
        ...spec.env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    })

    child.stdout?.on("data", (chunk: Buffer) => stdoutCapture.push(chunk))
    child.stderr?.on("data", (chunk: Buffer) => stderrCapture.push(chunk))

    child.once("error", (error) => {
      errorMessage = error.message
      finish("errored")
    })

    child.once("close", (code, closeSignal) => {
      exitCode = code
      signal = closeSignal
      if (timedOut) {
        finish("timed_out")
        return
      }
      finish(code === 0 ? "passed" : "failed")
    })

    if (timeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        timedOut = true
        errorMessage = `Command timed out after ${timeoutMs}ms`
        child.kill("SIGTERM")
        killHandle = setTimeout(() => {
          if (!child.killed) {
            child.kill("SIGKILL")
          }
        }, options.timeoutKillMs)
      }, timeoutMs)
    }
  })
}

export async function runBoundedCommandSequence(
  worktreePath: string,
  commands: readonly BenchOptRerunCommandSpec[],
  options: BenchOptRerunOptions = {},
): Promise<BenchOptRerunResult> {
  const resolvedWorktree = path.resolve(worktreePath)
  await ensureWorktreeExists(resolvedWorktree)

  const startedAt = new Date()
  const results: BenchOptRerunCommandResult[] = []
  const stopOnFailure = options.stopOnFailure ?? true
  let failureCommandId: string | null = null
  let stopRequested = false

  for (const spec of commands) {
    if (stopRequested) {
      results.push({
        id: spec.id,
        label: spec.label ?? null,
        command: [...spec.command],
        cwd: resolveInsideWorktree(resolvedWorktree, spec.cwd),
        startedAt: startedAt.toISOString(),
        endedAt: startedAt.toISOString(),
        durationMs: 0,
        exitCode: null,
        signal: null,
        status: "skipped",
        timedOut: false,
        stdout: "",
        stderr: "",
        stdoutTruncated: false,
        stderrTruncated: false,
        error: null,
      })
      continue
    }

    const result = await runSingleCommand(resolvedWorktree, spec, {
      defaultTimeoutMs: options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS,
      defaultMaxOutputBytes: options.defaultMaxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES,
      timeoutKillMs: options.timeoutKillMs ?? DEFAULT_TIMEOUT_KILL_MS,
      env: options.env,
    })

    results.push(result)

    if (result.status !== "passed" && failureCommandId === null) {
      failureCommandId = spec.id
      if (stopOnFailure) {
        stopRequested = true
      }
    }
  }

  const endedAt = new Date()
  const completedCount = results.filter((result) => result.status !== "skipped").length
  const passedCount = results.filter((result) => result.status === "passed").length
  const failedCount = results.filter((result) => result.status === "failed").length
  const timedOutCount = results.filter((result) => result.status === "timed_out").length
  const erroredCount = results.filter((result) => result.status === "errored").length
  const skippedCount = results.filter((result) => result.status === "skipped").length

  const notes: string[] = [
    ...(stopOnFailure ? ["Sequence stops after the first failed, timed-out, or errored command."] : ["Sequence continues after failures because stopOnFailure=false."]),
    ...(commands.length === 0 ? ["No commands were scheduled for rerun."] : []),
  ]

  if (options.mutationContext) {
    const mc = options.mutationContext
    notes.push(`Rerun candidate kind: ${mc.candidateKind}.`)
    if (mc.mutationSummary) {
      notes.push(`Mutation under re-evaluation: ${mc.mutationSummary}.`)
    }
  }

  return {
    worktreePath: resolvedWorktree,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMs: endedAt.getTime() - startedAt.getTime(),
    commandCount: commands.length,
    completedCount,
    passedCount,
    failedCount,
    timedOutCount,
    erroredCount,
    skippedCount,
    success: completedCount === commands.length && failedCount === 0 && timedOutCount === 0 && erroredCount === 0,
    failureCommandId,
    commands: results,
    notes,
  }
}

export async function runBoundedCommandInWorktree(
  worktreePath: string,
  command: BenchOptRerunCommandSpec,
  options: BenchOptRerunOptions = {},
) {
  const result = await runBoundedCommandSequence(worktreePath, [command], options)
  return result.commands[0]!
}
