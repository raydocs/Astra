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
    const entry = await server.ssrLoadModule("/bench/entry.ts")
    const result = await entry.runBench(process.argv.slice(2))
    console.log(result.text)
    console.log("")
    console.log(`JSON report: ${result.paths.latestPath}`)
    console.log(`Feedback prompt: ${result.paths.feedbackPath}`)
    console.log(`Generator handoff: ${result.paths.handoffPath}`)
    console.log(`Generator markdown: ${result.paths.generatorPath}`)
    console.log(`History report: ${result.paths.historyPath}`)

    if (result.report.summary.failedScenarios > 0) {
      process.exitCode = 1
    }
  } finally {
    console.error = originalConsoleError
    await server.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
