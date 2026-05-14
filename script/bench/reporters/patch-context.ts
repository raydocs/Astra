import path from "node:path"
import { readFile } from "node:fs/promises"

import type { PatchContextFile, PatchContextPack, PatchContextSlice, PatchTask, ResolvedOptimizerConfig } from "../types"

interface PatchContextCandidateFile {
  path: string
  symbols?: string[]
  keywords?: string[]
}

type PatchTaskWithCandidates = PatchTask & {
  candidateFiles?: PatchContextCandidateFile[]
}

type PatchContextFileWithSlices = PatchContextFile

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function splitLines(content: string) {
  return content.replace(/\r\n/g, "\n").split("\n")
}

function clampRange(startLine: number, endLine: number, lineCount: number) {
  const start = Math.max(1, Math.min(startLine, lineCount))
  const end = Math.max(start, Math.min(endLine, lineCount))
  return { startLine: start, endLine: end }
}

function mergeSlices(slices: PatchContextSlice[]) {
  const sorted = [...slices].sort((left, right) => {
    if (left.startLine !== right.startLine) {
      return left.startLine - right.startLine
    }
    return left.endLine - right.endLine
  })

  const merged: PatchContextSlice[] = []
  sorted.forEach((slice) => {
    const previous = merged[merged.length - 1]
    if (!previous || slice.startLine > previous.endLine + 1) {
      merged.push({ ...slice })
      return
    }

    previous.endLine = Math.max(previous.endLine, slice.endLine)
    previous.reason = `${previous.reason}; ${slice.reason}`
    if (previous.strategy !== slice.strategy) {
      previous.strategy = previous.strategy === "symbol" || slice.strategy === "symbol"
        ? "symbol"
        : "keyword"
    }
  })

  return merged
}

function sliceLineCount(slices: PatchContextSlice[]) {
  return slices.reduce((sum, slice) => sum + (slice.endLine - slice.startLine + 1), 0)
}

function trimSlicesToBudget(
  slices: PatchContextSlice[],
  maxLinesPerFile: number,
  lineCount: number,
) {
  if (slices.length === 0) {
    return slices
  }

  const trimmed: PatchContextSlice[] = []
  let usedLines = 0

  for (const slice of slices) {
    const remainingBudget = Math.max(0, maxLinesPerFile - usedLines)
    if (remainingBudget <= 0) {
      break
    }

    const sliceLength = slice.endLine - slice.startLine + 1
    if (sliceLength <= remainingBudget) {
      trimmed.push({ ...slice })
      usedLines += sliceLength
      continue
    }

    trimmed.push({
      ...slice,
      endLine: Math.min(lineCount, slice.startLine + remainingBudget - 1),
      reason: `${slice.reason}; trimmed to budget`,
    })
    usedLines = maxLinesPerFile
  }

  return trimmed
}

function collectSlicesFromPattern(
  lines: string[],
  pattern: RegExp,
  strategy: PatchContextSlice["strategy"],
  reasonLabel: string,
  contextBefore: number,
  contextAfter: number,
  maxMatches: number,
) {
  const slices: PatchContextSlice[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ""
    if (!pattern.test(line)) {
      continue
    }

    const { startLine, endLine } = clampRange(
      index + 1 - contextBefore,
      index + 1 + contextAfter,
      lines.length,
    )
    slices.push({
      startLine,
      endLine,
      reason: reasonLabel,
      strategy,
    })

    if (slices.length >= maxMatches) {
      break
    }
  }

  return slices
}

function collectSymbolSlices(lines: string[], symbols: string[]) {
  const slices: PatchContextSlice[] = []

  symbols.forEach((symbol) => {
    const pattern = new RegExp(`\\b${escapeRegExp(symbol)}\\b`)
    slices.push(
      ...collectSlicesFromPattern(
        lines,
        pattern,
        "symbol",
        `matched symbol: ${symbol}`,
        8,
        28,
        2,
      ),
    )
  })

  return slices
}

function collectKeywordSlices(lines: string[], keywords: string[]) {
  const slices: PatchContextSlice[] = []

  keywords.forEach((keyword) => {
    const pattern = new RegExp(escapeRegExp(keyword))
    slices.push(
      ...collectSlicesFromPattern(
        lines,
        pattern,
        "keyword",
        `matched keyword: ${keyword}`,
        5,
        12,
        2,
      ),
    )
  })

  return slices
}

function buildFallbackSlices(lineCount: number, maxLinesPerFile: number) {
  if (lineCount <= maxLinesPerFile) {
    return [
      {
        startLine: 1,
        endLine: lineCount,
        reason: "fallback: full file",
        strategy: "fallback-head" as const,
      },
    ]
  }

  const headLines = Math.max(20, Math.floor(maxLinesPerFile / 2))
  const tailLines = Math.max(0, maxLinesPerFile - headLines)
  const headEnd = Math.min(lineCount, headLines)
  const tailStart = Math.max(headEnd + 1, lineCount - tailLines + 1)

  const slices: PatchContextSlice[] = [
    {
      startLine: 1,
      endLine: headEnd,
      reason: "fallback: file head",
      strategy: "fallback-head",
    },
  ]

  if (tailStart <= lineCount && tailStart > headEnd) {
    slices.push({
      startLine: tailStart,
      endLine: lineCount,
      reason: "fallback: file tail",
      strategy: "fallback-tail",
    })
  }

  return slices
}

function renderSlices(lines: string[], slices: PatchContextSlice[]) {
  const rendered: string[] = []

  slices.forEach((slice, index) => {
    if (index > 0) {
      rendered.push("")
    }

    rendered.push(`// ${slice.strategy}: ${slice.reason}`)
    for (let lineNumber = slice.startLine; lineNumber <= slice.endLine; lineNumber += 1) {
      rendered.push(`${String(lineNumber).padStart(4, " ")} | ${lines[lineNumber - 1] ?? ""}`)
    }
  })

  return rendered.join("\n")
}

function getCandidateFiles(task: PatchTaskWithCandidates) {
  if (task.candidateFiles && task.candidateFiles.length > 0) {
    return task.candidateFiles
  }

  return task.relevantFiles.map((filePath) => ({ path: filePath }))
}

function readContextFileSyncShape(
  filePath: string,
  lineCount: number,
  slices: PatchContextSlice[],
  content: string,
): PatchContextFileWithSlices {
  return {
    path: filePath,
    exists: true,
    lineCount,
    includedLines: sliceLineCount(slices),
    truncated: sliceLineCount(slices) < lineCount,
    content,
    slices,
  }
}

async function readContextFile(
  candidate: PatchContextCandidateFile,
  maxLinesPerFile: number,
): Promise<PatchContextFileWithSlices> {
  const filePath = path.isAbsolute(candidate.path) ? candidate.path : path.resolve(candidate.path)

  try {
    const raw = await readFile(filePath, "utf8")
    const lines = splitLines(raw)
    const lineCount = lines.length

    const hintedSlices = mergeSlices([
      ...collectSymbolSlices(lines, candidate.symbols ?? []),
      ...collectKeywordSlices(lines, candidate.keywords ?? []),
    ])

    const slices = trimSlicesToBudget(
      hintedSlices.length > 0 ? hintedSlices : buildFallbackSlices(lineCount, maxLinesPerFile),
      maxLinesPerFile,
      lineCount,
    )

    return readContextFileSyncShape(
      filePath,
      lineCount,
      slices,
      renderSlices(lines, slices),
    )
  } catch {
    return {
      path: filePath,
      exists: false,
      lineCount: 0,
      includedLines: 0,
      truncated: false,
      content: "",
      slices: [],
    }
  }
}

export async function buildPatchContextPack(
  task: PatchTask,
  sourceArtifacts: PatchContextPack["sourceArtifacts"],
  options: {
    maxFiles?: number
    maxLinesPerFile?: number
    optimizer?: ResolvedOptimizerConfig
  } = {},
): Promise<PatchContextPack> {
  const optimizerSlots = options.optimizer?.context?.slots ?? []
  const contextPolicy = options.optimizer?.context?.policy
  const hasOptimizer = Boolean(options.optimizer)
  const maxFiles = Math.max(
    1,
    options.maxFiles ?? contextPolicy?.maxFiles ?? (hasOptimizer && !optimizerSlots.includes("candidateFiles") ? 4 : 6),
  )
  const maxLinesPerFile = Math.max(
    20,
    options.maxLinesPerFile ?? contextPolicy?.maxLinesPerFile ?? (hasOptimizer && !optimizerSlots.includes("history") ? 80 : 120),
  )
  const candidates = getCandidateFiles(task as PatchTaskWithCandidates).slice(0, maxFiles)
  const files = await Promise.all(candidates.map((candidate) => readContextFile(candidate, maxLinesPerFile)))

  return {
    schemaVersion: 2,
    runId: task.runId,
    generatedAt: new Date().toISOString(),
    sourceArtifacts,
    budget: {
      maxFiles,
      maxLinesPerFile,
      maxTotalLines: maxFiles * maxLinesPerFile,
    },
    files: files as PatchContextPack["files"],
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
  lines.push(`- Budget: ${pack.budget.maxFiles} files × ${pack.budget.maxLinesPerFile} lines`)
  lines.push("")

  pack.files.forEach((file) => {
    const slices = file.slices ?? []
    lines.push(`## ${file.path}`)
    if (!file.exists) {
      lines.push("")
      lines.push("- Missing file")
      lines.push("")
      return
    }

    lines.push("")
    lines.push(`- Included lines: ${file.includedLines}/${file.lineCount}${file.truncated ? " (truncated)" : ""}`)

    if (slices.length > 0) {
      lines.push(`- Slice count: ${slices.length}`)
      lines.push("")
      lines.push("### Slices")
      slices.forEach((slice) => {
        lines.push(`- ${slice.startLine}-${slice.endLine} [${slice.strategy}] ${slice.reason}`)
      })
      lines.push("")
    }

    lines.push("```ts")
    lines.push(file.content)
    lines.push("```")
    lines.push("")
  })

  return lines.join("\n").trimEnd() + "\n"
}
