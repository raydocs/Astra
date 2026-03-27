import { execFile } from "node:child_process"
import { mkdir, stat } from "node:fs/promises"
import { promisify } from "node:util"
import path from "node:path"

import { applyPatchInstructions } from "./apply.ts"
import { buildWorktreePlan } from "./worktree.ts"
import type {
  BenchOptCandidate,
  BenchOptExecutionResult,
  BenchOptMaterializationResult,
  BenchOptWorktreePlan,
} from "./types.ts"

const execFileAsync = promisify(execFile)

export async function materializeWorktreePlan(
  plan: BenchOptWorktreePlan,
  options: {
    enable?: boolean
  } = {},
): Promise<BenchOptMaterializationResult> {
  if (!options.enable || plan.dryRun) {
    return {
      plan,
      executed: false,
      materializedPath: plan.path,
    }
  }

  try {
    const existing = await stat(plan.path)
    if (existing.isDirectory()) {
      return {
        plan,
        executed: true,
        materializedPath: plan.path,
      }
    }
  } catch {
    // fall through and materialize a new worktree
  }

  await mkdir(path.dirname(plan.path), { recursive: true })
  const [, ...args] = plan.command
  await execFileAsync(plan.command[0]!, args, { cwd: plan.repositoryRoot })

  return {
    plan,
    executed: true,
    materializedPath: plan.path,
  }
}

export async function executeMaterializedCandidate(
  candidate: BenchOptCandidate,
  options: {
    repositoryRoot?: string
    worktreeRoot?: string
    enable?: boolean
    applyEdits?: boolean
    dryRun?: boolean
  } = {},
): Promise<BenchOptExecutionResult> {
  const materialization = await materializeCandidate(candidate, options)
  const editEnabled = Boolean(options.enable && options.applyEdits && materialization.executed)
  const editResult = await applyPatchInstructions(
    materialization.materializedPath,
    candidate.edits,
    {
      enable: editEnabled,
    },
  )

  return {
    candidateId: candidate.id,
    materialization,
    edits: {
      enabled: editEnabled,
      applied: editResult.applied,
      files: editResult.files,
    },
    notes: [
      ...(options.enable ? [] : ["Worktree materialization disabled; execution stayed in dry-run mode."]),
      ...(options.applyEdits ? [] : ["Structured edits were not requested; no file changes were applied."]),
      ...(candidate.edits.length > 0 ? [] : ["Candidate did not include any structured edits to apply."]),
    ],
  }
}

export async function materializeCandidate(
  candidate: BenchOptCandidate,
  options: {
    repositoryRoot?: string
    worktreeRoot?: string
    enable?: boolean
    dryRun?: boolean
  } = {},
) {
  const plan = buildWorktreePlan(candidate, options)
  return materializeWorktreePlan(plan, { enable: options.enable })
}
