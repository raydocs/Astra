/**
 * CLI entry point for the External Benchmark Pack.
 *
 * Usage:
 *   npx tsx script/bench-opt/external-benchmark-pack-entry.ts --export data/bench-opt-results/benchmark-pack/
 *   npx tsx script/bench-opt/external-benchmark-pack-entry.ts --validate data/bench-opt-results/proof-suite/latest.proof-suite.json
 *   npx tsx script/bench-opt/external-benchmark-pack-entry.ts --export data/bench-opt-results/benchmark-pack/ --validate data/bench-opt-results/proof-suite/latest.proof-suite.json
 */

import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

import {
  createDraftCapabilityBenchmarkPackV2,
  createOfficialBenchmarkPack,
  exportBenchmarkPack,
  renderBenchmarkPackSpec,
  validateBenchmarkPackResults,
  type BenchmarkPackConfig,
  type BenchmarkPackValidationResult,
} from "./external-benchmark-pack.ts"
import type { ProofSuiteResult } from "./proof-suite.ts"
import type { BenchOptStatusArtifact } from "./types.ts"

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

interface ParsedArgs {
  help: boolean
  exportDir: string | null
  validatePath: string | null
  statusPath: string | null
  packVersion: "v1" | "v2"
}

function parseArgs(argv: string[]): ParsedArgs {
  let help = false
  let exportDir: string | null = null
  let validatePath: string | null = null
  let statusPath: string | null = null
  let packVersion: "v1" | "v2" = "v1"

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    if (arg === "--help" || arg === "-h") {
      help = true
      continue
    }

    if (arg === "--export" || arg === "-e") {
      exportDir = path.resolve(argv[i + 1] ?? path.join(process.env.ASTRA_BENCH_OPT_ARTIFACT_ROOT ?? path.join(process.cwd(), "data/bench-opt-results"), "benchmark-pack"))
      i++
      continue
    }

    if (arg === "--validate" || arg === "-v") {
      validatePath = path.resolve(argv[i + 1] ?? "")
      i++
      continue
    }

    if (arg === "--status" || arg === "-s") {
      statusPath = path.resolve(argv[i + 1] ?? "")
      i++
      continue
    }

    if (arg === "--pack") {
      const value = argv[i + 1]
      if (value === "v2") {
        packVersion = "v2"
      }
      i++
      continue
    }
  }

  return { help, exportDir, validatePath, statusPath, packVersion }
}

function printHelp(): void {
  console.log("Astra External Benchmark Pack CLI")
  console.log("")
  console.log("Usage: npx tsx script/bench-opt/external-benchmark-pack-entry.ts [options]")
  console.log("")
  console.log("Options:")
  console.log("  --export, -e <dir>        Export the benchmark pack spec to a directory")
  console.log("  --validate, -v <path>     Validate a proof suite result JSON against the pack")
  console.log("  --status, -s <path>       Optional status artifact JSON for capability-gate validation")
  console.log("  --pack <v1|v2>            Choose the benchmark pack version (default: v1)")
  console.log("  --help, -h                Show this help message")
  console.log("")
  console.log("Examples:")
  console.log("  npx tsx script/bench-opt/external-benchmark-pack-entry.ts --export data/bench-opt-results/benchmark-pack/")
  console.log("  npx tsx script/bench-opt/external-benchmark-pack-entry.ts --validate data/bench-opt-results/proof-suite/latest.proof-suite.json")
  console.log("  npx tsx script/bench-opt/external-benchmark-pack-entry.ts --pack v2 --validate data/bench-opt-results/proof-suite/latest.proof-suite.json --status data/bench-opt-results/latest.status.json")
  console.log("  npx tsx script/bench-opt/external-benchmark-pack-entry.ts --export data/bench-opt-results/benchmark-pack/ --validate data/bench-opt-results/proof-suite/latest.proof-suite.json")
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

  const pack = parsed.packVersion === "v2"
    ? createDraftCapabilityBenchmarkPackV2()
    : createOfficialBenchmarkPack()
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
    let statusArtifact: BenchOptStatusArtifact | null = null
    try {
      const raw = await readFile(parsed.validatePath, "utf-8")
      suiteResult = JSON.parse(raw) as ProofSuiteResult
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Failed to read or parse suite result: ${msg}`)
      process.exit(1)
    }

    if (parsed.statusPath) {
      try {
        const rawStatus = await readFile(parsed.statusPath, "utf-8")
        statusArtifact = JSON.parse(rawStatus) as BenchOptStatusArtifact
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`Failed to read or parse status artifact: ${msg}`)
        process.exit(1)
      }
    }

    validation = validateBenchmarkPackResults(pack, suiteResult, statusArtifact)

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
