/**
 * CLI entry point for the Sprint Contract A/B Test.
 *
 * Usage:
 *   npx tsx bench-opt/contract-ab-entry.ts --prompt "Build X" --runs 3 --sprints 5
 *   npx tsx bench-opt/contract-ab-entry.ts --prompt "Build X" --runs 2 --sprints 3 --output-dir ./results
 */

import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

import {
  renderContractABMarkdown,
  runContractABTest,
  type ContractABConfig,
  type ContractABResult,
} from "./contract-ab-test.ts"

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

interface ParsedArgs {
  help: boolean
  prompt: string
  runs: number
  sprints: number
  outputDir: string
}

function parseArgs(argv: string[]): ParsedArgs {
  let help = false
  let prompt = ""
  let runs = 3
  let sprints = 5
  let outputDir = path.resolve(
    process.cwd(),
    "bench-opt-results",
    "contract-ab",
  )

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    if (arg === "--help" || arg === "-h") {
      help = true
      continue
    }

    if (arg === "--prompt" || arg === "-p") {
      prompt = argv[i + 1] ?? ""
      i++
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

  return { help, prompt, runs, sprints, outputDir }
}

function printHelp(): void {
  console.log("Astra Sprint Contract A/B Test CLI")
  console.log("")
  console.log("Usage: npx tsx bench-opt/contract-ab-entry.ts [options]")
  console.log("")
  console.log("Options:")
  console.log("  --prompt, -p <text>        Product prompt (required)")
  console.log("  --runs, -r <n>             Runs per variant (default: 3)")
  console.log("  --sprints, -s <n>          Sprints per run (default: 5)")
  console.log(
    "  --output-dir, -o <path>    Output directory (default: bench-opt-results/contract-ab)",
  )
  console.log("  --help, -h                 Show this help message")
  console.log("")
  console.log("Examples:")
  console.log(
    '  npx tsx bench-opt/contract-ab-entry.ts --prompt "Build a todo app" --runs 3 --sprints 5',
  )
  console.log(
    '  npx tsx bench-opt/contract-ab-entry.ts -p "Translation extension" -r 2 -s 3',
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Run the contract A/B test from CLI arguments and write results to disk.
 */
export async function runContractABEntry(
  argv: string[] = process.argv.slice(2),
): Promise<{
  result: ContractABResult
  jsonPath: string
  markdownPath: string
} | null> {
  const parsed = parseArgs(argv)

  if (parsed.help) {
    printHelp()
    return null
  }

  if (!parsed.prompt.trim()) {
    console.error("Error: --prompt is required. Use --help for usage.")
    process.exit(1)
  }

  const config: ContractABConfig = {
    prompt: parsed.prompt,
    sprints: parsed.sprints,
    runsPerVariant: parsed.runs,
  }

  console.log("Starting Sprint Contract A/B Test")
  console.log(`  Prompt: ${parsed.prompt}`)
  console.log(`  Sprints per run: ${parsed.sprints}`)
  console.log(`  Runs per variant: ${parsed.runs}`)
  console.log(`  Total runs: ${parsed.runs * 2}`)
  console.log(`  Output: ${parsed.outputDir}`)
  console.log("")

  // Run
  const result = await runContractABTest(config)

  // Write outputs
  await mkdir(parsed.outputDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const jsonPath = path.join(
    parsed.outputDir,
    `contract-ab-${timestamp}.json`,
  )
  const markdownPath = path.join(
    parsed.outputDir,
    `contract-ab-${timestamp}.md`,
  )
  const latestJsonPath = path.join(
    parsed.outputDir,
    "latest.contract-ab.json",
  )
  const latestMarkdownPath = path.join(
    parsed.outputDir,
    "latest.contract-ab.md",
  )

  const jsonContent = JSON.stringify(result, null, 2)
  const markdownContent = renderContractABMarkdown(result)

  await Promise.all([
    writeFile(jsonPath, jsonContent),
    writeFile(markdownPath, markdownContent),
    writeFile(latestJsonPath, jsonContent),
    writeFile(latestMarkdownPath, markdownContent),
  ])

  // Print summary
  console.log(markdownContent)
  console.log("")
  console.log("---")
  console.log(`JSON: ${jsonPath}`)
  console.log(`Markdown: ${markdownPath}`)
  console.log(`Latest JSON: ${latestJsonPath}`)
  console.log(`Latest Markdown: ${latestMarkdownPath}`)
  console.log(`Impact: ${result.comparison.contractImpact.toUpperCase()}`)
  console.log(`Significance: ${result.comparison.significance}`)
  console.log(
    `Score delta: ${result.comparison.scoreDelta > 0 ? "+" : ""}${result.comparison.scoreDelta}`,
  )

  return { result, jsonPath, markdownPath }
}

async function main(): Promise<void> {
  await runContractABEntry(process.argv.slice(2))
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
