import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import type { BenchOptEditInstruction } from "./types.ts"

export interface BenchOptApplyResult {
  applied: boolean
  files: string[]
}

function resolveInsideWorktree(worktreePath: string, filePath: string) {
  const resolvedWorktree = path.resolve(worktreePath)
  const resolvedPath = path.resolve(resolvedWorktree, filePath)

  if (!resolvedPath.startsWith(`${resolvedWorktree}${path.sep}`) && resolvedPath !== resolvedWorktree) {
    throw new Error(`Refusing to apply edit outside worktree: ${filePath}`)
  }

  return resolvedPath
}

export async function applyPatchInstructions(
  worktreePath: string,
  instructions: readonly BenchOptEditInstruction[],
  options: {
    enable?: boolean
  } = {},
): Promise<BenchOptApplyResult> {
  const resolvedFiles = instructions.map((instruction) => resolveInsideWorktree(worktreePath, instruction.path))

  if (!options.enable) {
    return {
      applied: false,
      files: resolvedFiles,
    }
  }

  for (let index = 0; index < instructions.length; index += 1) {
    const instruction = instructions[index]!
    const resolvedPath = resolvedFiles[index]!
    await mkdir(path.dirname(resolvedPath), { recursive: true })

    if (instruction.kind === "rewrite") {
      await writeFile(resolvedPath, instruction.content, "utf8")
      continue
    }

    const current = await readFile(resolvedPath, "utf8")
    if (!current.includes(instruction.search)) {
      throw new Error(`Search text not found for ${instruction.path}`)
    }
    await writeFile(resolvedPath, current.replace(instruction.search, instruction.replace), "utf8")
  }

  return {
    applied: true,
    files: resolvedFiles,
  }
}
