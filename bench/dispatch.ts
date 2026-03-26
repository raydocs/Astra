async function main() {
  const entry = await import("./dispatch-entry.ts")
  const result = await entry.runDispatch(process.argv.slice(2))
  console.log("Astra Executor Dispatch")
  console.log(`Status: ${result.dispatch.status}`)
  console.log(`Dispatch JSON: ${result.paths.dispatchJsonPath}`)
  console.log(`Dispatch Markdown: ${result.paths.dispatchMarkdownPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
