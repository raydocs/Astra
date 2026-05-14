import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import type { LiveBenchRunOutcome } from "./index"
import { resolveLiveArtifactRoot } from "./paths"

export interface PersistedLiveBenchArtifacts {
  outputDir: string
  runJsonPath: string
  runMarkdownPath: string
  latestJsonPath: string
  latestMarkdownPath: string
}

export async function persistLiveBenchRunOutcome(
  outcome: LiveBenchRunOutcome,
  rootDir?: string | null,
): Promise<PersistedLiveBenchArtifacts> {
  const resolvedRootDir = resolveLiveArtifactRoot(rootDir)
  const outputDir = path.resolve(resolvedRootDir, outcome.context.runId)
  const runJsonPath = path.join(outputDir, "result.json")
  const runMarkdownPath = path.join(outputDir, "result.md")
  const latestJsonPath = path.resolve(resolvedRootDir, "latest.result.json")
  const latestMarkdownPath = path.resolve(resolvedRootDir, "latest.result.md")

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
