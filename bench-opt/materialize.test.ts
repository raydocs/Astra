import { access, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { materializeWorktreePlan } from "./materialize.ts"
import type { BenchOptWorktreePlan } from "./types.ts"

const tempRoots: string[] = []

async function createTempRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "astra-materialize-"))
  tempRoots.push(root)
  return root
}

function initGitRepo(root: string) {
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" })
  execFileSync("git", ["config", "user.email", "astra@example.com"], { cwd: root, stdio: "ignore" })
  execFileSync("git", ["config", "user.name", "Astra Test"], { cwd: root, stdio: "ignore" })
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("bench-opt materialize", () => {
  it("keeps dry-run worktree plans side-effect free by default", async () => {
    const tempRoot = await createTempRoot()
    const worktreePath = path.join(tempRoot, ".bench-opt", "worktrees", "example")
    const plan: BenchOptWorktreePlan = {
      repositoryRoot: tempRoot,
      baseRef: "HEAD",
      branchName: "codex/bench-opt/example",
      path: worktreePath,
      command: ["git", "worktree", "add", "--detach", worktreePath, "HEAD"],
      dryRun: true,
    }

    const result = await materializeWorktreePlan(plan)

    expect(result).toEqual({
      plan,
      executed: false,
      materializedPath: worktreePath,
    })
    await expect(access(path.dirname(worktreePath))).rejects.toThrow()
  })

  it("reuses an existing worktree directory when explicitly enabled", async () => {
    const tempRoot = await createTempRoot()
    initGitRepo(tempRoot)
    const worktreePath = path.join(tempRoot, ".bench-opt", "worktrees", "existing")
    await mkdir(worktreePath, { recursive: true })

    const plan: BenchOptWorktreePlan = {
      repositoryRoot: tempRoot,
      baseRef: "HEAD",
      branchName: "codex/bench-opt/existing",
      path: worktreePath,
      command: ["git", "worktree", "add", "--detach", worktreePath, "HEAD"],
      dryRun: false,
    }

    const result = await materializeWorktreePlan(plan, {
      enable: true,
    })

    expect(result).toEqual({
      plan,
      executed: true,
      materializedPath: worktreePath,
    })
  })

  it("materializes a real git worktree when explicitly enabled", async () => {
    const tempRoot = await createTempRoot()
    initGitRepo(tempRoot)
    await writeFile(path.join(tempRoot, "file.txt"), "hello worktree\n", "utf8")
    execFileSync("git", ["add", "file.txt"], { cwd: tempRoot, stdio: "ignore" })
    execFileSync("git", ["commit", "-m", "initial"], { cwd: tempRoot, stdio: "ignore" })

    const worktreePath = path.join(tempRoot, ".bench-opt", "worktrees", "example")
    const plan: BenchOptWorktreePlan = {
      repositoryRoot: tempRoot,
      baseRef: "HEAD",
      branchName: "codex/bench-opt/example",
      path: worktreePath,
      command: ["git", "worktree", "add", "--detach", worktreePath, "HEAD"],
      dryRun: false,
    }

    const result = await materializeWorktreePlan(plan, {
      enable: true,
    })

    expect(result).toEqual({
      plan,
      executed: true,
      materializedPath: worktreePath,
    })
    await expect(access(worktreePath)).resolves.toBeUndefined()
    await expect(access(path.join(worktreePath, "file.txt"))).resolves.toBeUndefined()
  })
})
