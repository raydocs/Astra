import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { applyPatchInstructions } from "./apply.ts"

const tempRoots: string[] = []

async function createWorktree() {
  const worktreePath = await mkdtemp(path.join(os.tmpdir(), "astra-apply-"))
  tempRoots.push(worktreePath)
  return worktreePath
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("bench-opt apply", () => {
  it("rejects edits that escape the worktree", async () => {
    const worktreePath = await createWorktree()
    await expect(applyPatchInstructions(worktreePath, [
      {
        path: "../escape.ts",
        justification: "security boundary",
        kind: "replace",
        search: "1",
        replace: "2",
      },
    ])).rejects.toThrow(/outside worktree/i)
  })

  it("keeps dry-run edits inert and applies replace/rewrite instructions when enabled", async () => {
    const worktreePath = await createWorktree()
    await mkdir(worktreePath, { recursive: true })
    const targetPath = path.join(worktreePath, "file.ts")
    await writeFile(targetPath, "export const value = 1\n", "utf8")

    const dryRun = await applyPatchInstructions(worktreePath, [
      {
        path: "file.ts",
        justification: "dry-run replace",
        kind: "replace",
        search: "1",
        replace: "2",
      },
    ])

    expect(dryRun).toEqual({
      applied: false,
      files: [targetPath],
    })
    await expect(readFile(targetPath, "utf8")).resolves.toBe("export const value = 1\n")

    const replaced = await applyPatchInstructions(worktreePath, [
      {
        path: "file.ts",
        justification: "enabled replace",
        kind: "replace",
        search: "1",
        replace: "2",
      },
    ], {
      enable: true,
    })

    expect(replaced).toEqual({
      applied: true,
      files: [targetPath],
    })
    await expect(readFile(targetPath, "utf8")).resolves.toBe("export const value = 2\n")

    const rewritten = await applyPatchInstructions(worktreePath, [
      {
        path: "file.ts",
        justification: "enabled rewrite",
        kind: "rewrite",
        content: "export const value = 3\n",
      },
    ], {
      enable: true,
    })

    expect(rewritten).toEqual({
      applied: true,
      files: [targetPath],
    })
    await expect(readFile(targetPath, "utf8")).resolves.toBe("export const value = 3\n")
  })
})
