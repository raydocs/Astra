import path from "node:path"

import { createViteServer } from "vitest/node"

const REACT_ACT_WARNING = "not wrapped in act"

async function main() {
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
    const result = await entry.runLoop(process.argv.slice(2))
    console.log("Astra Loop Task")
    console.log(`Selected items: ${result.loopPlan.selection.selectedCount}`)
    console.log(`Mode: ${result.loopPlan.selection.mode}`)
    if (result.loopPlan.drill.enabled) {
      console.log(`Drill scenario: ${result.loopPlan.drill.scenarioId}`)
    }
    console.log(`Loop JSON: ${result.paths.loopJsonPath}`)
    console.log(`Loop Markdown: ${result.paths.loopMarkdownPath}`)
    console.log(`Patch Task JSON: ${result.paths.patchTaskJsonPath}`)
    console.log(`Patch Task Markdown: ${result.paths.patchTaskMarkdownPath}`)
    console.log(`Patch Context JSON: ${result.paths.patchContextJsonPath}`)
    console.log(`Patch Context Markdown: ${result.paths.patchContextMarkdownPath}`)
    console.log(`Patch Pass JSON: ${result.paths.patchPassJsonPath}`)
    console.log(`Patch Pass Markdown: ${result.paths.patchPassMarkdownPath}`)
    console.log(`Executor JSON: ${result.paths.executorJsonPath}`)
    console.log(`Executor Markdown: ${result.paths.executorMarkdownPath}`)
  } finally {
    console.error = originalConsoleError
    await server.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
