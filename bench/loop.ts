import path from "node:path"

import { createViteServer } from "vitest/node"
import { formatExecutorGateDecision } from "./reporters/executor.ts"

const REACT_ACT_WARNING = "not wrapped in act"

function printLoopHelp() {
  console.log("Astra Loop Task CLI")
  console.log("Usage: pnpm bench:loop -- [options]")
  console.log("")
  console.log("Options:")
  console.log("  --skip-bench            Reuse latest bench artifacts instead of running bench")
  console.log("  --max-items <n>         Limit the selected loop items (default: 3)")
  console.log("  --include-medium        Include medium-priority candidates")
  console.log("  --drill-scenario <id>   Force a scenario into drill mode")
  console.log("  --drill-reason <text>   Attach a drill explanation")
  console.log("  --drill-history-ready   Use the history-backed ready path")
  console.log("  --optimizer-config <f>  Optional bench-opt Phase 1 report/config path")
  console.log("  -h, --help              Show this help")
  console.log("")
  console.log("Drill shortcuts:")
  console.log("  pnpm bench:drill:current-failure           Synthetic current-failure drill")
  console.log("  pnpm bench:drill                           Synthetic history-backed ready path")
  console.log("  pnpm bench:drill:current-failure:dispatch  Current-failure drill plus mock dispatch")
  console.log("  pnpm bench:drill:dispatch                  History-backed drill plus mock dispatch")
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes("--help") || args.includes("-h")) {
    printLoopHelp()
    return
  }
  const root = process.cwd()
  const originalConsoleError = console.error
  console.error = (...args: unknown[]) => {
    const rendered = args.map((arg) => String(arg)).join(" ")
    if (rendered.includes(REACT_ACT_WARNING)) {
      return
    }
    originalConsoleError(...args)
  }

  const server = await createViteServer({
    root,
    mode: "test",
    appType: "custom",
    server: { middlewareMode: true },
    optimizeDeps: {
      noDiscovery: true,
      entries: [],
    },
    resolve: {
      alias: {
        "@": path.resolve(root, "src"),
        "#imports": path.resolve(root, "test/mocks/imports.ts"),
      },
    },
  })

  try {
    const entry = await server.ssrLoadModule("/bench/loop-entry.ts")
    const result = await entry.runLoop(args)
    console.log("Astra Loop Task")
    console.log(`Selected items: ${result.loopPlan.selection.selectedCount}`)
    console.log(`Mode: ${result.loopPlan.selection.mode}`)
    if (result.loopPlan.drill.enabled) {
      console.log(`Drill scenario: ${result.loopPlan.drill.scenarioId}`)
      if (result.loopPlan.drill.historyReady) {
        console.log("Drill mode: history-backed ready path")
      }
    }
    if (result.loopPlan.optimizer) {
      console.log(`Optimizer source: ${result.loopPlan.optimizer.sourcePath}`)
      if (result.loopPlan.optimizer.prompt) {
        console.log(`Optimizer prompt: ${result.loopPlan.optimizer.prompt.id}`)
      }
      if (result.loopPlan.optimizer.context) {
        console.log(`Optimizer context: ${result.loopPlan.optimizer.context.id}`)
      }
    }
    console.log(`Loop JSON: ${result.paths.loopJsonPath}`)
    console.log(`Loop Markdown: ${result.paths.loopMarkdownPath}`)
    console.log(`Patch Task JSON: ${result.paths.patchTaskJsonPath}`)
    console.log(`Patch Task Markdown: ${result.paths.patchTaskMarkdownPath}`)
    console.log(`Patch Context JSON: ${result.paths.patchContextJsonPath}`)
    console.log(`Patch Context Markdown: ${result.paths.patchContextMarkdownPath}`)
    console.log(`Patch Pass JSON: ${result.paths.patchPassJsonPath}`)
    console.log(`Patch Pass Markdown: ${result.paths.patchPassMarkdownPath}`)
    if (result.paths.latestHistoryJsonPath) {
      console.log(`History summary JSON: ${result.paths.latestHistoryJsonPath}`)
    }
    if (result.paths.latestHistoryMarkdownPath) {
      console.log(`History summary Markdown: ${result.paths.latestHistoryMarkdownPath}`)
    }
    console.log(`Executor JSON: ${result.paths.executorJsonPath}`)
    console.log(`Executor Markdown: ${result.paths.executorMarkdownPath}`)
    console.log("Executor Gate")
    formatExecutorGateDecision(result.executorAttempt).forEach((line) => {
      console.log(line)
    })
  } finally {
    console.error = originalConsoleError
    await server.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
