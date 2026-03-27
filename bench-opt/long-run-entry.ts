/**
 * CLI entry point for the long-run benchmark orchestrator.
 *
 * Usage:
 *   tsx bench-opt/long-run-entry.ts --prompt "Build X" --sprints 5
 *   tsx bench-opt/long-run-entry.ts --prompt "Build X" --sprints 3 --output-dir ./results
 */

import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

import {
  createLongRunConfig,
  renderLongRunMarkdown,
  runLongRunBenchmark,
  type LongRunConfig,
  type LongRunResult,
} from "./long-run.ts"

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

interface ParsedArgs {
  help: boolean
  prompt: string
  sprints: number
  outputDir: string
  minSprintScore: number | null
  minFinalScore: number | null
}

function parseArgs(argv: string[]): ParsedArgs {
  let help = false
  let prompt = ""
  let sprints = 5
  let outputDir = path.resolve(process.cwd(), "bench-opt-results", "long-run")
  let minSprintScore: number | null = null
  let minFinalScore: number | null = null

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

    if (arg === "--min-sprint-score") {
      const parsed = Number.parseInt(argv[i + 1] ?? "", 10)
      if (Number.isFinite(parsed)) {
        minSprintScore = parsed
      }
      i++
      continue
    }

    if (arg === "--min-final-score") {
      const parsed = Number.parseInt(argv[i + 1] ?? "", 10)
      if (Number.isFinite(parsed)) {
        minFinalScore = parsed
      }
      i++
      continue
    }
  }

  return { help, prompt, sprints, outputDir, minSprintScore, minFinalScore }
}

function printHelp() {
  console.log("Astra Long-Run Benchmark CLI")
  console.log("")
  console.log("Usage: tsx bench-opt/long-run-entry.ts [options]")
  console.log("")
  console.log("Options:")
  console.log("  --prompt, -p <text>        Product prompt (required)")
  console.log("  --sprints, -s <n>          Number of sprints (default: 5)")
  console.log("  --output-dir, -o <path>    Output directory (default: bench-opt-results/long-run)")
  console.log("  --min-sprint-score <n>     Minimum sprint score gate (default: 60)")
  console.log("  --min-final-score <n>      Minimum final score gate (default: 70)")
  console.log("  --help, -h                 Show this help message")
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/** Run the long-run benchmark from CLI arguments and write results to disk. */
export async function runLongRunEntry(
  argv: string[] = process.argv.slice(2),
): Promise<{ result: LongRunResult; jsonPath: string; markdownPath: string } | null> {
  const parsed = parseArgs(argv)

  if (parsed.help) {
    printHelp()
    return null
  }

  if (!parsed.prompt.trim()) {
    console.error("Error: --prompt is required. Use --help for usage.")
    process.exit(1)
  }

  // Build config
  const config = createLongRunConfig(parsed.prompt, {
    maxSprints: parsed.sprints,
    qualityGates: {
      minSprintScore: parsed.minSprintScore ?? 60,
      minFinalScore: parsed.minFinalScore ?? 70,
      requiredLivePass: false,
      requiredPromotionQualified: false,
    },
  })

  console.log(`Starting long-run benchmark: ${parsed.sprints} sprints`)
  console.log(`Product prompt: ${parsed.prompt}`)
  console.log(`Output: ${parsed.outputDir}`)
  console.log("")

  // Run
  const result = await runLongRunBenchmark(config)

  // Write outputs
  await mkdir(parsed.outputDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const jsonPath = path.join(parsed.outputDir, `long-run-${timestamp}.json`)
  const markdownPath = path.join(parsed.outputDir, `long-run-${timestamp}.md`)
  const latestJsonPath = path.join(parsed.outputDir, "latest.long-run.json")
  const latestMarkdownPath = path.join(parsed.outputDir, "latest.long-run.md")

  const jsonContent = JSON.stringify(result, null, 2)
  const markdownContent = renderLongRunMarkdown(result)

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
  console.log(`Verdict: ${result.finalVerdict.toUpperCase()}`)
  console.log(`Completed: ${result.completedSprints}/${result.totalSprints} sprints`)
  console.log(`Final score: ${result.finalScore ?? "N/A"}`)
  console.log(`Promotion ready: ${result.promotionReady ? "Yes" : "No"}`)

  return { result, jsonPath, markdownPath }
}

async function main() {
  await runLongRunEntry(process.argv.slice(2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
