import type { BenchmarkSplit } from "../bench/types.ts"
import {
  runBoundedCommandSequence,
  type BenchOptRerunCommandResult,
  type BenchOptRerunCommandSpec,
  type BenchOptRerunOptions,
  type BenchOptRerunResult,
} from "./rerun.ts"

export type BenchOptVerificationKind = "type-check" | "tests" | "bench"

export interface BenchOptVerificationCommandSpec extends BenchOptRerunCommandSpec {
  kind: BenchOptVerificationKind
  split?: BenchmarkSplit | null
}

export interface BenchOptVerificationCommandResult extends BenchOptRerunCommandResult {
  kind: BenchOptVerificationKind
  split: BenchmarkSplit | null
}

export interface BenchOptVerificationPlan {
  worktreePath: string
  commands: BenchOptVerificationCommandSpec[]
  benchSplits: BenchmarkSplit[]
  notes: string[]
}

export interface BenchOptVerificationOptions {
  packageManager?: string
  includeTypeCheck?: boolean
  includeTests?: boolean
  benchSplits?: readonly BenchmarkSplit[]
  typeCheckArgs?: readonly string[]
  testArgs?: readonly string[]
  benchArgs?: readonly string[]
  commandTimeoutMs?: Partial<Record<BenchOptVerificationKind, number>>
  defaultTimeoutMs?: number
  defaultMaxOutputBytes?: number
  stopOnFailure?: boolean
  env?: NodeJS.ProcessEnv
}

export interface BenchOptVerificationResult {
  plan: BenchOptVerificationPlan
  execution: BenchOptRerunResult & {
    commands: BenchOptVerificationCommandResult[]
  }
  status: "passed" | "failed"
  failedCommandId: string | null
  notes: string[]
}

function normalizeBenchSplits(splits: readonly BenchmarkSplit[] | undefined) {
  const resolved: BenchmarkSplit[] = splits && splits.length > 0
    ? [...splits]
    : ["train", "validation", "holdout"]
  return [...new Set(resolved)] as BenchmarkSplit[]
}

function buildScriptCommand(
  packageManager: string,
  scriptName: string,
  extraArgs: readonly string[],
) {
  return [packageManager, scriptName, ...extraArgs] as const
}

export function buildBenchOptVerificationPlan(
  worktreePath: string,
  options: BenchOptVerificationOptions = {},
): BenchOptVerificationPlan {
  const packageManager = options.packageManager?.trim() || "pnpm"
  const includeTypeCheck = options.includeTypeCheck ?? true
  const includeTests = options.includeTests ?? true
  const benchSplits = normalizeBenchSplits(options.benchSplits)
  const commands: BenchOptVerificationCommandSpec[] = []

  const typeCheckTimeoutMs = options.commandTimeoutMs?.["type-check"] ?? options.defaultTimeoutMs
  const testsTimeoutMs = options.commandTimeoutMs?.tests ?? options.defaultTimeoutMs
  const benchTimeoutMs = options.commandTimeoutMs?.bench ?? options.defaultTimeoutMs

  if (includeTypeCheck) {
    commands.push({
      id: "type-check",
      kind: "type-check",
      command: buildScriptCommand(packageManager, "type-check", options.typeCheckArgs ?? []),
      timeoutMs: typeCheckTimeoutMs,
    })
  }

  if (includeTests) {
    commands.push({
      id: "tests",
      kind: "tests",
      command: buildScriptCommand(packageManager, "test", options.testArgs ?? []),
      timeoutMs: testsTimeoutMs,
    })
  }

  benchSplits.forEach((split) => {
    commands.push({
      id: `bench-${split}`,
      kind: "bench",
      split,
      command: buildScriptCommand(packageManager, "bench", ["--", "--split", split, ...(options.benchArgs ?? [])]),
      timeoutMs: benchTimeoutMs,
    })
  })

  if (commands.length === 0) {
    throw new Error("Verification plan is empty. Enable at least one of type-check, tests, or bench splits.")
  }

  return {
    worktreePath,
    commands,
    benchSplits,
    notes: [
      `packageManager=${packageManager}`,
      includeTypeCheck ? "type-check enabled" : "type-check disabled",
      includeTests ? "tests enabled" : "tests disabled",
      `bench splits=${benchSplits.join(", ")}`,
    ],
  }
}

function stripVerificationMetadata(command: BenchOptVerificationCommandSpec): BenchOptRerunCommandSpec {
  return {
    id: command.id,
    label: command.kind,
    command: command.command,
    cwd: command.cwd,
    env: command.env,
    timeoutMs: command.timeoutMs,
    maxOutputBytes: command.maxOutputBytes,
  }
}

function attachVerificationMetadata(
  command: BenchOptRerunCommandResult,
  source: BenchOptVerificationCommandSpec,
): BenchOptVerificationCommandResult {
  return {
    ...command,
    kind: source.kind,
    split: source.split ?? null,
  }
}

export async function runBenchOptVerificationPlan(
  plan: BenchOptVerificationPlan,
  options: Pick<BenchOptRerunOptions, "defaultTimeoutMs" | "defaultMaxOutputBytes" | "stopOnFailure" | "timeoutKillMs" | "env"> = {},
): Promise<BenchOptVerificationResult> {
  const execution = await runBoundedCommandSequence(
    plan.worktreePath,
    plan.commands.map((command) => stripVerificationMetadata(command)),
    options,
  )

  const verificationCommands = execution.commands.map((command, index) => attachVerificationMetadata(command, plan.commands[index]!))
  const failedCommandId = execution.failureCommandId

  return {
    plan,
    execution: {
      ...execution,
      commands: verificationCommands,
    },
    status: execution.success ? "passed" : "failed",
    failedCommandId,
    notes: [...plan.notes, ...execution.notes],
  }
}

export async function runBenchOptVerification(
  worktreePath: string,
  options: BenchOptVerificationOptions = {},
) {
  const plan = buildBenchOptVerificationPlan(worktreePath, options)
  return runBenchOptVerificationPlan(plan, {
    defaultTimeoutMs: options.defaultTimeoutMs,
    defaultMaxOutputBytes: options.defaultMaxOutputBytes,
    stopOnFailure: options.stopOnFailure,
    env: options.env,
  })
}
