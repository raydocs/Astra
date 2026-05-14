import { access, readdir, readFile } from "node:fs/promises"
import path from "node:path"

const DEFAULT_TARGETS = [
  path.join(".output", "chrome-mv3", "content-scripts"),
  path.join(".output", "firefox-mv3", "content-scripts"),
  path.join(".output", "safari-mv3", "content-scripts"),
]

const FORBIDDEN_SIGNATURES = [
  "astra-translation-cache",
  "Dexie",
] as const

type BundleIssue = {
  file: string
  reason: string
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

async function collectJavaScriptFiles(targetPath: string): Promise<string[]> {
  const entries = await readdir(targetPath, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(targetPath, entry.name)
    if (entry.isDirectory()) {
      return collectJavaScriptFiles(entryPath)
    }

    return entry.isFile() && entry.name.endsWith(".js") ? [entryPath] : []
  }))

  return files.flat().sort((left, right) => left.localeCompare(right))
}

function isUnicodeNoncharacter(codePoint: number): boolean {
  return (
    (codePoint >= 0xFDD0 && codePoint <= 0xFDEF)
    || (codePoint & 0xFFFF) === 0xFFFE
    || (codePoint & 0xFFFF) === 0xFFFF
  )
}

function formatCodePoint(codePoint: number): string {
  const hex = codePoint.toString(16).toUpperCase()
  return `U+${hex.padStart(Math.max(4, hex.length), "0")}`
}

function findForbiddenCodePoints(source: string): string[] {
  const matches = new Set<string>()
  for (const char of source) {
    const codePoint = char.codePointAt(0)
    if (codePoint !== undefined && isUnicodeNoncharacter(codePoint)) {
      matches.add(formatCodePoint(codePoint))
    }
  }

  return [...matches]
}

async function inspectBundle(filePath: string): Promise<BundleIssue[]> {
  const source = await readFile(filePath, "utf8")
  const issues: BundleIssue[] = []

  const forbiddenCodePoints = findForbiddenCodePoints(source)
  if (forbiddenCodePoints.length > 0) {
    issues.push({
      file: filePath,
      reason: `contains forbidden Unicode noncharacters: ${forbiddenCodePoints.join(", ")}`,
    })
  }

  for (const signature of FORBIDDEN_SIGNATURES) {
    if (source.includes(signature)) {
      issues.push({
        file: filePath,
        reason: `contains forbidden background-only signature '${signature}'`,
      })
    }
  }

  return issues
}

async function resolveTargets(args: string[]): Promise<string[]> {
  const normalizedArgs = args.filter((arg) => arg !== "--")
  if (normalizedArgs.length > 0) {
    return normalizedArgs
  }

  const existingTargets = await Promise.all(DEFAULT_TARGETS.map(async (targetPath) => (
    await pathExists(targetPath) ? targetPath : null
  )))

  return existingTargets.filter((targetPath): targetPath is string => targetPath !== null)
}

async function main(): Promise<void> {
  const targets = await resolveTargets(process.argv.slice(2))
  if (targets.length === 0) {
    console.error("Content script bundle guardrail failed: no target directories were found.")
    process.exitCode = 1
    return
  }

  const issues: BundleIssue[] = []
  let scannedFiles = 0

  for (const targetPath of targets) {
    if (!(await pathExists(targetPath))) {
      issues.push({
        file: targetPath,
        reason: "target path does not exist",
      })
      continue
    }

    const files = await collectJavaScriptFiles(targetPath)
    if (files.length === 0) {
      issues.push({
        file: targetPath,
        reason: "no JavaScript bundles found",
      })
      continue
    }

    scannedFiles += files.length
    const fileIssues = await Promise.all(files.map((filePath) => inspectBundle(filePath)))
    issues.push(...fileIssues.flat())
  }

  if (issues.length === 0) {
    console.log(`Content script bundle guardrail passed for ${scannedFiles} bundle(s).`)
    return
  }

  console.error("Content script bundle guardrail failed.")
  for (const issue of issues) {
    console.error(`- ${issue.file}: ${issue.reason}`)
  }
  process.exitCode = 1
}

await main()
