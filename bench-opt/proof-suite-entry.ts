/**
 * CLI entry point for the proof-run suite.
 *
 * Usage:
 *   npx tsx bench-opt/proof-suite-entry.ts [--runs 3] [--sprints 5] [--output-dir bench-opt-results/proof-suite]
 */

import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

import {
  createDefaultProofSuiteConfig,
  renderProofSuiteMarkdown,
  runProofSuite,
  type ProofSuiteConfig,
  type ProofSuiteResult,
} from "./proof-suite.ts"

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

interface ParsedArgs {
  help: boolean
  runs: number
  sprints: number
  outputDir: string
}

function parseArgs(argv: string[]): ParsedArgs {
  let help = false
  let runs = 3
  let sprints = 5
  let outputDir = path.resolve(process.cwd(), "bench-opt-results", "proof-suite")

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    if (arg === "--help" || arg === "-h") {
      help = true
      continue
    }

    if (arg === "--runs" || arg === "-r") {
      const parsed = Number.parseInt(argv[i + 1] ?? "", 10)
      if (Number.isFinite(parsed) && parsed > 0) {
        runs = parsed
      }
      i++
      continue
    }

    if (arg === "--sprints" || arg === "-s") {
      const parsed = Number.parseInt(argv[i + 1] ?? "", 10)
      if (Number.isFinite(parsed) && parsed > 0) {
        sprints = parsed
      }
      i++
      continue
    }

    if (arg === "--output-dir" || arg === "--output" || arg === "-o") {
      outputDir = path.resolve(argv[i + 1] ?? outputDir)
      i++
      continue
    }
  }

  return { help, runs, sprints, outputDir }
}

function printHelp() {
  console.log("Astra Proof Suite CLI")
  console.log("")
  console.log("Usage: npx tsx bench-opt/proof-suite-entry.ts [options]")
  console.log("")
  console.log("Options:")
  console.log("  --runs, -r <n>             Runs per prompt (default: 3)")
  console.log("  --sprints, -s <n>          Sprints per run (default: 5)")
  console.log("  --output-dir, -o <path>    Output directory (default: bench-opt-results/proof-suite)")
  console.log("  --help, -h                 Show this help message")
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/** Run the proof suite from CLI arguments and write results to disk. */
export async function runProofSuiteEntry(
  argv: string[] = process.argv.slice(2),
): Promise<{ result: ProofSuiteResult; jsonPath: string; markdownPath: string } | null> {
  const parsed = parseArgs(argv)

  if (parsed.help) {
    printHelp()
    return null
  }

  // Build config
  const config = createDefaultProofSuiteConfig({
    runsPerPrompt: parsed.runs,
    sprintsPerRun: parsed.sprints,
  })

  const totalRuns = config.prompts.length * config.runsPerPrompt
  console.log("Starting proof suite")
  console.log(`  Prompts: ${config.prompts.length}`)
  console.log(`  Runs per prompt: ${config.runsPerPrompt}`)
  console.log(`  Sprints per run: ${config.sprintsPerRun}`)
  console.log(`  Total runs: ${totalRuns}`)
  console.log(`  Output: ${parsed.outputDir}`)
  console.log("")

  // Run
  const result = await runProofSuite(config)

  // Write outputs
  await mkdir(parsed.outputDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const jsonPath = path.join(parsed.outputDir, `proof-suite-${timestamp}.json`)
  const markdownPath = path.join(parsed.outputDir, `proof-suite-${timestamp}.md`)
  const latestJsonPath = path.join(parsed.outputDir, "latest.proof-suite.json")
  const latestMarkdownPath = path.join(parsed.outputDir, "latest.proof-suite.md")

  const jsonContent = JSON.stringify(result, null, 2)
  const markdownContent = renderProofSuiteMarkdown(result)

  await Promise.all([
    writeFile(jsonPath, jsonContent),
    writeFile(markdownPath, markdownContent),
    writeFile(latestJsonPath, jsonContent),
    writeFile(latestMarkdownPath, markdownContent),
  ])

  // Print summary
  console.log("")
  console.log(markdownContent)
  console.log("")
  console.log("---")
  console.log(`JSON: ${jsonPath}`)
  console.log(`Markdown: ${markdownPath}`)
  console.log(`Latest JSON: ${latestJsonPath}`)
  console.log(`Latest Markdown: ${latestMarkdownPath}`)
  console.log(`Verdict: ${result.verdict.toUpperCase()}`)
  console.log(
    `Success rate: ${(result.statistics.successRate * 100).toFixed(1)}% ` +
      `(${result.statistics.passCount}/${result.statistics.totalRuns} passed)`,
  )
  console.log(`Average final score: ${result.statistics.averageFinalScore}`)
  console.log(`Score std dev: ${result.statistics.scoreStdDev}`)

  return { result, jsonPath, markdownPath }
}

async function main() {
  await runProofSuiteEntry(process.argv.slice(2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
