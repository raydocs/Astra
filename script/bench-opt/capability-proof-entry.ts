import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

import {
  createWaveBCapabilityProofConfig,
  renderCapabilityProofMarkdown,
  runCapabilityProof,
  type CapabilityProofResult,
} from "./capability-proof.ts"

interface ParsedArgs {
  help: boolean
  runs: number
  sprints: number
  outputDir: string
  includeHover: boolean
  includeSubtitleFile: boolean
  includeEpub: boolean
}

function parseArgs(argv: string[]): ParsedArgs {
  let help = false
  let runs = 2
  let sprints = 5
  let outputDir = path.resolve(process.env.ASTRA_BENCH_OPT_ARTIFACT_ROOT ?? path.join(process.cwd(), "data/bench-opt-results"), "capability-proof")
  let includeHover = false
  let includeSubtitleFile = false
  let includeEpub = false
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--help" || arg === "-h") {
      help = true
      continue
    }
    if (arg === "--runs" || arg === "-r") {
      const parsed = Number.parseInt(argv[i + 1] ?? "", 10)
      if (Number.isFinite(parsed) && parsed > 0) runs = parsed
      i += 1
      continue
    }
    if (arg === "--sprints" || arg === "-s") {
      const parsed = Number.parseInt(argv[i + 1] ?? "", 10)
      if (Number.isFinite(parsed) && parsed > 0) sprints = parsed
      i += 1
      continue
    }
    if (arg === "--output-dir" || arg === "--output" || arg === "-o") {
      outputDir = path.resolve(argv[i + 1] ?? outputDir)
      i += 1
      continue
    }
    if (arg === "--include-hover") {
      includeHover = true
      continue
    }
    if (arg === "--include-subtitle-file") {
      includeSubtitleFile = true
      continue
    }
    if (arg === "--include-epub") {
      includeEpub = true
      continue
    }
  }
  return { help, runs, sprints, outputDir, includeHover, includeSubtitleFile, includeEpub }
}

function printHelp() {
  console.log("Astra Capability Proof CLI")
  console.log("")
  console.log("Usage: npx tsx script/bench-opt/capability-proof-entry.ts [options]")
  console.log("")
  console.log("Options:")
  console.log("  --runs, -r <n>             Runs per prompt (default: 2)")
  console.log("  --sprints, -s <n>          Sprints per run (default: 5)")
  console.log("  --output-dir, -o <path>    Output directory (default: data/bench-opt-results/capability-proof)")
  console.log("  --include-hover            Include hover-translation in the proof prompt set")
  console.log("  --include-subtitle-file    Include subtitle-file-translation in the proof prompt set")
  console.log("  --include-epub             Include epub-bilingual-translation in the proof prompt set")
}

export async function runCapabilityProofEntry(argv: string[] = process.argv.slice(2)): Promise<{ result: CapabilityProofResult; jsonPath: string; markdownPath: string } | null> {
  const parsed = parseArgs(argv)
  if (parsed.help) {
    printHelp()
    return null
  }
  const config = createWaveBCapabilityProofConfig({ runsPerPrompt: parsed.runs, sprintsPerRun: parsed.sprints, includeHoverTranslation: parsed.includeHover, includeSubtitleFileTranslation: parsed.includeSubtitleFile, includeEpubTranslation: parsed.includeEpub })
  console.log(`Starting capability proof: ${config.prompts.length} prompts x ${config.runsPerPrompt} run(s)`)
  const result = await runCapabilityProof(config)
  await mkdir(parsed.outputDir, { recursive: true })
  const jsonPath = path.join(parsed.outputDir, `capability-proof-${new Date().toISOString().replace(/[:.]/g, "-")}.json`)
  const markdownPath = path.join(parsed.outputDir, `capability-proof-${new Date().toISOString().replace(/[:.]/g, "-")}.md`)
  const latestJsonPath = path.join(parsed.outputDir, "latest.capability-proof.json")
  const latestMarkdownPath = path.join(parsed.outputDir, "latest.capability-proof.md")
  const json = JSON.stringify(result, null, 2)
  const markdown = renderCapabilityProofMarkdown(result)
  await Promise.all([
    writeFile(jsonPath, json),
    writeFile(markdownPath, markdown),
    writeFile(latestJsonPath, json),
    writeFile(latestMarkdownPath, markdown),
  ])
  console.log(markdown)
  console.log(`JSON: ${jsonPath}`)
  console.log(`Markdown: ${markdownPath}`)
  console.log(`Latest JSON: ${latestJsonPath}`)
  console.log(`Latest Markdown: ${latestMarkdownPath}`)
  return { result, jsonPath, markdownPath }
}

async function main() {
  await runCapabilityProofEntry(process.argv.slice(2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
