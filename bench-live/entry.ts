import { runLiveBench } from "./index"
import { persistLiveBenchRunOutcome } from "./results"

async function main() {
  const outcome = await runLiveBench(process.argv.slice(2))
  console.log(outcome.text)

  if (outcome.mode === "run") {
    const artifacts = await persistLiveBenchRunOutcome(outcome)
    console.log("")
    console.log(`Result JSON: ${artifacts.runJsonPath}`)
    console.log(`Result Markdown: ${artifacts.runMarkdownPath}`)
    console.log(`Latest JSON: ${artifacts.latestJsonPath}`)
    console.log(`Latest Markdown: ${artifacts.latestMarkdownPath}`)
  }

  if (outcome.exitCode !== 0) {
    process.exitCode = outcome.exitCode
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
