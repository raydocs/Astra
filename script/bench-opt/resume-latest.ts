import path from "node:path"

import { loadBenchOptStore } from "./store.ts"
import { printBenchOptHelp, runBenchOpt } from "./runner.ts"

async function main() {
  const args = process.argv.slice(2)
  if (args.includes("--help") || args.includes("-h")) {
    printBenchOptHelp()
    console.log("")
    console.log("Resume-latest wrapper:")
    console.log("  Loads the latest session/checkpoint/handoff bundle from data/bench-opt-results/store/index.json")
    console.log("  and forwards it into bench-opt runner with --orchestrate --session enabled by default.")
    return
  }

  const outputDir = path.resolve(process.env.ASTRA_BENCH_OPT_ARTIFACT_ROOT ?? path.join(process.cwd(), "data/bench-opt-results"))
  const store = await loadBenchOptStore(outputDir)
  const latest = store.latestSessionArtifacts

  if (!latest?.sessionPath || !latest?.checkpointPath) {
    throw new Error(`No latest session artifact bundle found in ${path.join(outputDir, "store", "index.json")}. Run bench:opt with --session first.`)
  }

  const forwardedArgs = [
    "--write",
    "--orchestrate",
    "--session",
    "--output",
    outputDir,
    "--session-resume",
    latest.sessionPath,
    "--session-checkpoint",
    latest.checkpointPath,
    ...(latest.handoffPath ? ["--session-handoff", latest.handoffPath] : []),
    ...args,
  ]

  const result = await runBenchOpt(forwardedArgs)
  console.log(result.text)
  if (result.paths) {
    console.log("")
    console.log(`JSON report: ${result.paths.latestJsonPath}`)
    console.log(`Markdown report: ${result.paths.latestMarkdownPath}`)
    if (result.paths.latestSessionJsonPath) {
      console.log(`Session JSON: ${result.paths.latestSessionJsonPath}`)
    }
    if (result.paths.latestHandoffJsonPath) {
      console.log(`Handoff JSON: ${result.paths.latestHandoffJsonPath}`)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
