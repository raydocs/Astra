import path from "node:path"
import { execFileSync } from "node:child_process"

import type { BenchOptCandidate, BenchOptWorktreePlan } from "./types.ts"

function sanitizeSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return slug || "candidate"
}

function resolveRepositoryRoot(explicitRoot?: string) {
  if (explicitRoot) {
    return path.resolve(explicitRoot)
  }

  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: process.cwd(),
      encoding: "utf8",
    }).trim()
  } catch {
    return process.cwd()
  }
}

export function buildWorktreePlan(
  candidate: BenchOptCandidate,
  options: {
    repositoryRoot?: string
    worktreeRoot?: string
    dryRun?: boolean
  } = {},
): BenchOptWorktreePlan {
  const repositoryRoot = resolveRepositoryRoot(options.repositoryRoot)
  const worktreeRoot = path.resolve(options.worktreeRoot ?? path.join(repositoryRoot, ".bench-opt", "worktrees"))
  const branchName = `${candidate.worktree.branchPrefix}/${sanitizeSlug(candidate.id)}`
  const pathForWorktree = candidate.worktree.path ?? path.join(worktreeRoot, sanitizeSlug(candidate.id))

  return {
    repositoryRoot,
    baseRef: candidate.worktree.baseRef,
    branchName,
    path: pathForWorktree,
    command: ["git", "worktree", "add", "--detach", pathForWorktree, candidate.worktree.baseRef],
    dryRun: options.dryRun ?? true,
  }
}

export function renderWorktreePlan(plan: BenchOptWorktreePlan) {
  return [
    `- Repository root: \`${plan.repositoryRoot}\``,
    `- Base ref: \`${plan.baseRef}\``,
    `- Branch name: \`${plan.branchName}\``,
    `- Worktree path: \`${plan.path}\``,
    `- Materialization: ${plan.dryRun ? "dry-run" : "enabled"}`,
    `- Command: \`${plan.command.join(" ")}\``,
  ]
}
