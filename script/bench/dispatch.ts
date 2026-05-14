function printDispatchHelp() {
  console.log("Astra Executor Dispatch CLI")
  console.log("Usage: pnpm bench:dispatch -- [options]")
  console.log("")
  console.log("Options:")
  console.log("  --mock-response <text>  Skip the provider call and record a mock dispatch response")
  console.log("  -h, --help              Show this help")
  console.log("")
  console.log("Drill shortcuts:")
  console.log("  pnpm bench:drill:current-failure:dispatch  Current-failure drill plus mock dispatch")
  console.log("  pnpm bench:drill:dispatch                  History-backed drill plus mock dispatch")
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes("--help") || args.includes("-h")) {
    printDispatchHelp()
    return
  }

  const entry = await import("./dispatch-entry.ts")
  const result = await entry.runDispatch(args)
  console.log("Astra Executor Dispatch")
  console.log(`Status: ${result.dispatch.status}`)
  console.log(`Dispatch JSON: ${result.paths.dispatchJsonPath}`)
  console.log(`Dispatch Markdown: ${result.paths.dispatchMarkdownPath}`)
  console.log("Dispatch Gate")
  if (result.dispatch.status === "blocked") {
    console.log(`Decision: blocked`)
    console.log(`Why: ${result.dispatch.summary.blockReason ?? "Dispatch blocked."}`)
  } else if (result.dispatch.status === "failed") {
    console.log("Decision: failed")
    console.log(`Why: ${result.dispatch.summary.error ?? "Dispatch failed."}`)
  } else {
    console.log("Decision: executed")
    console.log(`Why: provider ${result.dispatch.provider.id} accepted the dispatch prompt.`)
    console.log(`Prompt chars: ${result.dispatch.summary.promptChars}`)
    console.log(`Response chars: ${result.dispatch.summary.responseChars}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
