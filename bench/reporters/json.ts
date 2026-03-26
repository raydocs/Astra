import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import type { BenchmarkReport } from "../types"

export async function writeJsonReport(report: BenchmarkReport) {
  const outputDir = path.resolve(process.cwd(), "bench-results")
  const historyDir = path.join(outputDir, "history")
  await mkdir(historyDir, { recursive: true })

  const latestPath = path.join(outputDir, "latest.json")
  const historyPath = path.join(historyDir, `${report.runId}.json`)

  const serialized = JSON.stringify(report, null, 2)
  await writeFile(latestPath, serialized)
  await writeFile(historyPath, serialized)

  return {
    outputDir,
    latestPath,
    historyPath,
  }
}
