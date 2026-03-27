/**
 * CLI entry point for the External Benchmark Pack.
 *
 * Usage:
 *   npx tsx bench-opt/external-benchmark-pack-entry.ts --export bench-opt-results/benchmark-pack/
 *   npx tsx bench-opt/external-benchmark-pack-entry.ts --validate bench-opt-results/proof-suite/latest.proof-suite.json
 *   npx tsx bench-opt/external-benchmark-pack-entry.ts --export bench-opt-results/benchmark-pack/ --validate bench-opt-results/proof-suite/latest.proof-suite.json
 */

import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

import {
  createOfficialBenchmarkPack,
  exportBenchmarkPack,
  renderBenchmarkPackSpec,
  validateBenchmarkPackResults,
  type BenchmarkPackConfig,
  type BenchmarkPackValidationResult,
} from "./external-benchmark-pack.ts"
import type { ProofSuiteResult } from "./proof-suite.ts"

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

interface ParsedArgs {
  help: boolean
  exportDir: string | null
  validatePath: string | null
}

function parseArgs(argv: string[]): ParsedArgs {
  let help = false
  let exportDir: string | null = null
  let validatePath: string | null = null

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    if (arg === "--help" || arg === "-h") {
      help = true
      continue
    }

    if (arg === "--export" || arg === "-e") {
      exportDir = path.resolve(argv[i + 1] ?? "bench-opt-results/benchmark-pack")
      i++
      continue
    }

    if (arg === "--validate" || arg === "-v") {
      validatePath = path.resolve(argv[i + 1] ?? "")
      i++
      continue
    }
  }

  return { help, exportDir, validatePath }
}

function printHelp(): void {
  console.log("Astra External Benchmark Pack CLI")
  console.log("")
  console.log("Usage: npx tsx bench-opt/external-benchmark-pack-entry.ts [options]")
  console.log("")
  console.log("Options:")
  console.log("  --export, -e <dir>        Export the benchmark pack spec to a directory")
  console.log("  --validate, -v <path>     Validate a proof suite result JSON against the pack")
  console.log("  --help, -h                Show this help message")
  console.log("")
  console.log("Examples:")
  console.log("  npx tsx bench-opt/external-benchmark-pack-entry.ts --export bench-opt-results/benchmark-pack/")
  console.log("  npx tsx bench-opt/external-benchmark-pack-entry.ts --validate bench-opt-results/proof-suite/latest.proof-suite.json")
  console.log("  npx tsx bench-opt/external-benchmark-pack-entry.ts --export bench-opt-results/benchmark-pack/ --validate bench-opt-results/proof-suite/latest.proof-suite.json")
}

// ---------------------------------------------------------------------------
// Validation rendering
// ---------------------------------------------------------------------------

function renderValidationMarkdown(result: BenchmarkPackValidationResult): string {
  const lines: string[] = []

  lines.push("# Benchmark Pack Validation Report")
  lines.push("")
  lines.push(`**Pack:** ${result.packName} v${result.packVersion}`)
  lines.push(`**Result:** ${result.passed ? "PASS" : "FAIL"}`)
  lines.push("")
  lines.push("## Conditions")
  lines.push("")
  lines.push("| Condition | Expected | Actual | Status |")
  lines.push("|-----------|----------|--------|--------|")
  for (const cond of result.conditions) {
    const status = cond.passed ? "PASS" : "**FAIL**"
    lines.push(`| ${cond.name} | ${cond.expected} | ${cond.actual} | ${status} |`)
  }
  lines.push("")

  lines.push("## Summary")
  lines.push("")
  lines.push(result.summary)
  lines.push("")

  if (result.notes.length > 0) {
    lines.push("## Notes")
    lines.push("")
    for (const note of result.notes) {
      lines.push(`- ${note}`)
    }
    lines.push("")
  }

  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function runBenchmarkPackEntry(
  argv: string[] = process.argv.slice(2),
): Promise<{
  pack: BenchmarkPackConfig
  exportPaths: { jsonPath: string; markdownPath: string } | null
  validation: BenchmarkPackValidationResult | null
} | null> {
  const parsed = parseArgs(argv)

  if (parsed.help) {
    printHelp()
    return null
  }

  if (!parsed.exportDir && !parsed.validatePath) {
    console.log("No action specified. Use --export and/or --validate. Use --help for usage.")
    return null
  }

  const pack = createOfficialBenchmarkPack()
  let exportPaths: { jsonPath: string; markdownPath: string } | null = null
  let validation: BenchmarkPackValidationResult | null = null

  // --- Export ---
  if (parsed.exportDir) {
    console.log(`Exporting benchmark pack to: ${parsed.exportDir}`)
    exportPaths = await exportBenchmarkPack(pack, parsed.exportDir)
    console.log(`  JSON: ${exportPaths.jsonPath}`)
    console.log(`  Markdown: ${exportPaths.markdownPath}`)
    console.log("")
  }

  // --- Validate ---
  if (parsed.validatePath) {
    console.log(`Validating against: ${parsed.validatePath}`)

    let suiteResult: ProofSuiteResult
    try {
      const raw = await readFile(parsed.validatePath, "utf-8")
      suiteResult = JSON.parse(raw) as ProofSuiteResult
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Failed to read or parse suite result: ${msg}`)
      process.exit(1)
    }

    validation = validateBenchmarkPackResults(pack, suiteResult)

    // Write validation result
    if (parsed.exportDir) {
      const validationJsonPath = path.join(parsed.exportDir, "validation-result.json")
      const validationMarkdownPath = path.join(parsed.exportDir, "validation-result.md")
      await mkdir(parsed.exportDir, { recursive: true })
      await Promise.all([
        writeFile(validationJsonPath, JSON.stringify(validation, null, 2)),
        writeFile(validationMarkdownPath, renderValidationMarkdown(validation)),
      ])
      console.log(`  Validation JSON: ${validationJsonPath}`)
      console.log(`  Validation Markdown: ${validationMarkdownPath}`)
    }

    // Print validation summary
    console.log("")
    console.log(renderValidationMarkdown(validation))
    console.log(`Overall: ${validation.passed ? "PASS" : "FAIL"}`)
  }

  return { pack, exportPaths, validation }
}

async function main(): Promise<void> {
  await runBenchmarkPackEntry(process.argv.slice(2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
