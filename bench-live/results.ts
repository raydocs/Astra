import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { DEFAULT_LIVE_ARTIFACT_ROOT } from "./driver"
import type { LiveBenchRunOutcome } from "./index"

export interface PersistedLiveBenchArtifacts {
  outputDir: string
  runJsonPath: string
  runMarkdownPath: string
  latestJsonPath: string
  latestMarkdownPath: string
}

export async function persistLiveBenchRunOutcome(
  outcome: LiveBenchRunOutcome,
  rootDir = DEFAULT_LIVE_ARTIFACT_ROOT,
): Promise<PersistedLiveBenchArtifacts> {
  const outputDir = path.resolve(rootDir, outcome.context.runId)
  const runJsonPath = path.join(outputDir, "result.json")
  const runMarkdownPath = path.join(outputDir, "result.md")
  const latestJsonPath = path.resolve(rootDir, "latest.result.json")
  const latestMarkdownPath = path.resolve(rootDir, "latest.result.md")

  await mkdir(outputDir, { recursive: true })
  await writeFile(runJsonPath, JSON.stringify(outcome.result, null, 2))
  await writeFile(runMarkdownPath, outcome.result.text)
  await writeFile(latestJsonPath, JSON.stringify(outcome.result, null, 2))
  await writeFile(latestMarkdownPath, outcome.result.text)

  return {
    outputDir,
    runJsonPath,
    runMarkdownPath,
    latestJsonPath,
    latestMarkdownPath,
  }
}
