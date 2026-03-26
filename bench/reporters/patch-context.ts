import { readFile } from "node:fs/promises"

import type { PatchContextFile, PatchContextPack, PatchTask } from "../types"

function withLineNumbers(content: string, maxLines: number): PatchContextFile["content"] {
  const lines = content.replace(/\r\n/g, "\n").split("\n")
  const sliced = lines.slice(0, maxLines)
  return sliced
    .map((line, index) => `${String(index + 1).padStart(4, " ")} | ${line}`)
    .join("\n")
}

async function readContextFile(filePath: string, maxLines: number): Promise<PatchContextFile> {
  try {
    const raw = await readFile(filePath, "utf8")
    const lines = raw.replace(/\r\n/g, "\n").split("\n")
    const lineCount = lines.length
    const includedLines = Math.min(lineCount, maxLines)

    return {
      path: filePath,
      exists: true,
      lineCount,
      includedLines,
      truncated: lineCount > maxLines,
      content: withLineNumbers(raw, maxLines),
    }
  } catch {
    return {
      path: filePath,
      exists: false,
      lineCount: 0,
      includedLines: 0,
      truncated: false,
      content: "",
    }
  }
}

export async function buildPatchContextPack(
  task: PatchTask,
  sourceArtifacts: PatchContextPack["sourceArtifacts"],
  options: {
    maxLinesPerFile?: number
  } = {},
): Promise<PatchContextPack> {
  const maxLinesPerFile = Math.max(20, options.maxLinesPerFile ?? 160)
  const files = await Promise.all(task.relevantFiles.map((file) => readContextFile(file, maxLinesPerFile)))

  return {
    schemaVersion: 1,
    runId: task.runId,
    generatedAt: new Date().toISOString(),
    sourceArtifacts,
    files,
  }
}

export function renderPatchContextMarkdown(pack: PatchContextPack) {
  const lines: string[] = []
  lines.push("# Astra Patch Context")
  lines.push("")
  lines.push(`- Run ID: \`${pack.runId}\``)
  lines.push(`- Generated: ${pack.generatedAt}`)
  lines.push(`- Latest patch task: \`${pack.sourceArtifacts.latestPatchTask}\``)
  lines.push(`- Files: ${pack.files.length}`)
  lines.push("")

  pack.files.forEach((file) => {
    lines.push(`## ${file.path}`)
    if (!file.exists) {
      lines.push("")
      lines.push("- Missing file")
      lines.push("")
      return
    }

    lines.push("")
    lines.push(`- Included lines: ${file.includedLines}/${file.lineCount}${file.truncated ? " (truncated)" : ""}`)
    lines.push("")
    lines.push("```ts")
    lines.push(file.content)
    lines.push("```")
    lines.push("")
  })

  return lines.join("\n").trimEnd() + "\n"
}
