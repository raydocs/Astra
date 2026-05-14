import { readFile } from "node:fs/promises"
import path from "node:path"

interface BenchOptStatusCliArtifact {
  runId: string
  generatedAt: string
  overallState: string
  summary: {
    bestCandidateId: string | null
    bestScore: number | null
    evaluatedSplit: string
    verificationStatus: string | null
    liveStatus: string | null
    livePass: boolean | null
    keepRejectDecision: string | null
    sessionPhase: string | null
    promotionStatus: string | null
    publishStatus: string | null
    rollbackStatus: string | null
  }
  paths: {
    latestStatusJsonPath: string | null
    latestStatusMarkdownPath: string | null
    latestLiveJsonPath?: string | null
    storeIndexPath: string | null
  }
}

function parseArgs(argv: string[]) {
  let outputDir = path.resolve(process.env.ASTRA_BENCH_OPT_ARTIFACT_ROOT ?? path.join(process.cwd(), "data/bench-opt-results"))
  let emitJson = false
  let help = false

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    if (current === "--output") {
      outputDir = path.resolve(argv[index + 1] ?? outputDir)
      index += 1
      continue
    }
    if (current === "--json") {
      emitJson = true
      continue
    }
    if (current === "--help" || current === "-h") {
      help = true
      continue
    }
  }

  return { outputDir, emitJson, help }
}

function renderStatusText(status: BenchOptStatusCliArtifact) {
  return [
    "Astra Bench Opt Status",
    `Run ID: ${status.runId}`,
    `Generated: ${status.generatedAt}`,
    `Overall state: ${status.overallState}`,
    `Best candidate: ${status.summary.bestCandidateId ?? "none"}`,
    `Best score: ${status.summary.bestScore ?? "n/a"}`,
    `Evaluated split: ${status.summary.evaluatedSplit}`,
    `Verification: ${status.summary.verificationStatus ?? "n/a"}`,
    `Live evaluator: ${status.summary.liveStatus ?? "n/a"}${status.summary.livePass === null ? "" : status.summary.livePass ? " (pass)" : " (not passed)"}`,
    `Keep/reject: ${status.summary.keepRejectDecision ?? "n/a"}`,
    `Session phase: ${status.summary.sessionPhase ?? "n/a"}`,
    `Promotion: ${status.summary.promotionStatus ?? "n/a"}`,
    `Publish: ${status.summary.publishStatus ?? "n/a"}`,
    `Rollback: ${status.summary.rollbackStatus ?? "n/a"}`,
    "",
    `Status JSON: ${status.paths.latestStatusJsonPath ?? "n/a"}`,
    `Status Markdown: ${status.paths.latestStatusMarkdownPath ?? "n/a"}`,
    `Live JSON: ${status.paths.latestLiveJsonPath ?? "n/a"}`,
    `Store index: ${status.paths.storeIndexPath ?? "n/a"}`,
  ].join("\n")
}

function printHelp() {
  console.log("Usage: tsx bench-opt/status-latest.ts [--output <dir>] [--json]")
  console.log("")
  console.log("Reads data/bench-opt-results/latest.status.json and prints the current operator summary.")
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2))
  if (parsed.help) {
    printHelp()
    return
  }

  const statusPath = path.join(parsed.outputDir, "latest.status.json")
  let status: BenchOptStatusCliArtifact

  try {
    status = JSON.parse(await readFile(statusPath, "utf8")) as BenchOptStatusCliArtifact
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Unable to read latest bench-opt status at ${statusPath}. Run pnpm bench:opt -- --write first. (${detail})`)
  }

  if (parsed.emitJson) {
    console.log(JSON.stringify(status, null, 2))
    return
  }

  console.log(renderStatusText(status))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
