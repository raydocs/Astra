import { runBenchOpt, printBenchOptHelp } from "./runner.ts"

async function main() {
  const args = process.argv.slice(2)
  if (args.includes("--help") || args.includes("-h")) {
    printBenchOptHelp()
    return
  }

  const result = await runBenchOpt(args)
  console.log(result.text)
  if (result.paths) {
    console.log("")
    console.log(`JSON report: ${result.paths.latestJsonPath}`)
    console.log(`Markdown report: ${result.paths.latestMarkdownPath}`)
    if (result.paths.latestResolvedJsonPath) {
      console.log(`Resolved config JSON: ${result.paths.latestResolvedJsonPath}`)
    }
    if (result.paths.latestResolvedMarkdownPath) {
      console.log(`Resolved config Markdown: ${result.paths.latestResolvedMarkdownPath}`)
    }
    if (result.paths.latestStatusJsonPath) {
      console.log(`Status JSON: ${result.paths.latestStatusJsonPath}`)
    }
    if (result.paths.latestStatusMarkdownPath) {
      console.log(`Status Markdown: ${result.paths.latestStatusMarkdownPath}`)
    }
    if (result.paths.latestOrchestrationJsonPath) {
      console.log(`Orchestration JSON: ${result.paths.latestOrchestrationJsonPath}`)
    }
    if (result.paths.latestOrchestrationLoopJsonPath) {
      console.log(`Orchestration loop JSON: ${result.paths.latestOrchestrationLoopJsonPath}`)
    }
    if (result.paths.latestOrchestrationLoopMarkdownPath) {
      console.log(`Orchestration loop Markdown: ${result.paths.latestOrchestrationLoopMarkdownPath}`)
    }
    if (result.paths.orchestrationIterationsDirPath) {
      console.log(`Orchestration iterations dir: ${result.paths.orchestrationIterationsDirPath}`)
    }
    if (result.paths.latestSessionJsonPath) {
      console.log(`Session JSON: ${result.paths.latestSessionJsonPath}`)
    }
    if (result.paths.latestLiveJsonPath) {
      console.log(`Live JSON: ${result.paths.latestLiveJsonPath}`)
    }
    if (result.paths.latestPromotionJsonPath) {
      console.log(`Promotion JSON: ${result.paths.latestPromotionJsonPath}`)
    }
  }
  if (result.execution) {
    console.log("")
    console.log(`Execution worktree: ${result.execution.materialization.materializedPath}`)
    console.log(`Execution materialized: ${result.execution.materialization.executed ? "yes" : "no"}`)
    console.log(`Structured edits applied: ${result.execution.edits.applied ? "yes" : "no"}`)
  }
  if (result.orchestrationLoop) {
    console.log(`Orchestration loop iterations: ${result.orchestrationLoop.completedIterations}/${result.orchestrationLoop.maxIterations}`)
    console.log(`Orchestration loop termination: ${result.orchestrationLoop.terminationReason}`)
  }
  if (result.session) {
    console.log(`Session phase: ${result.session.state.phase}`)
  }
  if (result.live) {
    console.log(`Live status: ${result.live.status}`)
  }
  if (result.promotion) {
    console.log(`Promotion status: ${result.promotion.status}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
