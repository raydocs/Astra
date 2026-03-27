import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { runBench } from "./entry"
import { loadResolvedOptimizerConfig } from "./optimizer-config"
import { buildPatchContextPack, renderPatchContextMarkdown } from "./reporters/patch-context"
import { buildLoopPlan, renderLoopMarkdown } from "./reporters/loop"
import { buildExecutorAttempt, renderExecutorMarkdown } from "./reporters/executor"
import { buildPatchPass, renderPatchPassMarkdown } from "./reporters/patch-pass"
import { buildPatchTask, renderPatchTaskMarkdown } from "./reporters/patch-task"
import type { GeneratorHandoff, HistoryPromptSummary } from "./types"
import type { HistoryReport } from "./reporters/history"

function parseArgs(argv: string[]) {
  let maxItems = 3
  let includeMedium = false
  let skipBench = false
  let drillScenarioId: string | null = null
  let drillReason: string | null = null
  let drillHistoryReady = false
  let optimizerConfigPath: string | null = null
  let useBenchOpt = false

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    if (current === "--max-items") {
      maxItems = Number.parseInt(argv[index + 1] ?? "3", 10) || 3
      index += 1
      continue
    }

    if (current === "--include-medium") {
      includeMedium = true
      continue
    }

    if (current === "--skip-bench") {
      skipBench = true
      continue
    }

    if (current === "--drill-scenario") {
      drillScenarioId = argv[index + 1] ?? null
      index += 1
      continue
    }

    if (current === "--drill-reason") {
      drillReason = argv[index + 1] ?? null
      index += 1
      continue
    }

    if (current === "--drill-history-ready") {
      drillHistoryReady = true
      continue
    }

    if (current === "--optimizer-config") {
      optimizerConfigPath = argv[index + 1] ?? null
      index += 1
      continue
    }

    if (current === "--use-bench-opt") {
      useBenchOpt = true
    }
  }

  return {
    maxItems,
    includeMedium,
    skipBench,
    drillScenarioId,
    drillReason,
    drillHistoryReady,
    optimizerConfigPath,
    useBenchOpt,
  }
}

async function readLatestHandoff() {
  const handoffPath = path.resolve(process.cwd(), "bench-results/latest.handoff.json")
  const content = await readFile(handoffPath, "utf8")
  return {
    handoffPath,
    handoff: JSON.parse(content) as GeneratorHandoff,
  }
}

function toHistoryPromptSummary(
  report: HistoryReport,
  jsonPath: string,
  markdownPath: string,
): HistoryPromptSummary {
  return {
    sourceJsonPath: jsonPath,
    sourceMarkdownPath: markdownPath,
    totalRuns: report.totalRuns,
    notes: report.notes.slice(0, 4),
    weakestSurfaces: report.weakestSurfaces.slice(0, 5).map((entry) => ({
      surface: entry.surface,
      averageTotal: entry.averageTotal,
      direction: entry.direction,
      failureRuns: entry.failureRuns,
    })),
    recurringFailures: report.recurringFailures.slice(0, 6).map((entry) => ({
      id: entry.id,
      surface: entry.surface,
      occurrenceCount: entry.occurrenceCount,
      failureCount: entry.failureCount,
      regressionCount: entry.regressionCount,
      issueCount: entry.issueCount,
      averageTotal: entry.averageTotal,
      latestTotal: entry.latestTotal,
      worstTotal: entry.worstTotal,
    })),
  }
}

async function readLatestHistory(outputDir: string): Promise<HistoryPromptSummary | undefined> {
  const jsonPath = path.join(outputDir, "latest.history.json")
  const markdownPath = path.join(outputDir, "latest.history.md")

  try {
    const content = await readFile(jsonPath, "utf8")
    return toHistoryPromptSummary(JSON.parse(content) as HistoryReport, jsonPath, markdownPath)
  } catch {
    return undefined
  }
}

export async function runLoop(argv: string[] = process.argv.slice(2)) {
  const {
    maxItems,
    includeMedium,
    skipBench,
    drillScenarioId,
    drillReason,
    drillHistoryReady,
    optimizerConfigPath,
    useBenchOpt,
  } = parseArgs(argv)

  let handoffPath: string
  let handoff: GeneratorHandoff

  if (skipBench) {
    const latest = await readLatestHandoff()
    handoffPath = latest.handoffPath
    handoff = latest.handoff
  } else {
    const benchResult = await runBench([])
    if (!benchResult.paths || !benchResult.handoff) {
      throw new Error("Bench run did not produce handoff artifacts.")
    }
    handoffPath = benchResult.paths.handoffPath
    handoff = benchResult.handoff as GeneratorHandoff
  }

  const outputDir = path.dirname(handoffPath)
  const latestFeedback = path.join(outputDir, "latest.feedback.md")
  const latestJson = path.join(outputDir, "latest.json")
  const latestHistory = await readLatestHistory(outputDir)
  const optimizer = await loadResolvedOptimizerConfig(
    optimizerConfigPath ?? (useBenchOpt ? path.join(process.cwd(), "bench-opt-results/latest.resolved.json") : null),
  )

  const loopPlan = buildLoopPlan(handoff, {
    latestHandoff: handoffPath,
    latestFeedback,
    latestJson,
    ...(latestHistory?.sourceJsonPath ? { latestHistoryJson: latestHistory.sourceJsonPath } : {}),
    ...(latestHistory?.sourceMarkdownPath ? { latestHistoryMarkdown: latestHistory.sourceMarkdownPath } : {}),
  }, {
    maxItems,
    includeMedium,
    ...(drillScenarioId ? { drillScenarioId } : {}),
    ...(drillReason ? { drillReason } : {}),
    ...(drillHistoryReady ? { drillHistoryReady } : {}),
    ...(latestHistory ? { history: latestHistory } : {}),
    ...(optimizer ? { optimizer } : {}),
  })

  const loopJsonPath = path.join(outputDir, "latest.loop.json")
  const loopMarkdownPath = path.join(outputDir, "latest.loop.md")
  await writeFile(loopJsonPath, JSON.stringify(loopPlan, null, 2))

  const patchTask = buildPatchTask(loopPlan, {
    latestLoop: loopJsonPath,
    latestHandoff: handoffPath,
    latestFeedback,
    latestJson,
    ...(latestHistory?.sourceJsonPath ? { latestHistoryJson: latestHistory.sourceJsonPath } : {}),
    ...(latestHistory?.sourceMarkdownPath ? { latestHistoryMarkdown: latestHistory.sourceMarkdownPath } : {}),
    ...(optimizer ? { latestOptimizerConfig: optimizer.sourcePath } : {}),
  }, {
    ...(optimizer ? { optimizer } : {}),
  })
  const patchTaskJsonPath = path.join(outputDir, "latest.patch-task.json")
  const patchTaskMarkdownPath = path.join(outputDir, "latest.patch-task.md")
  await writeFile(patchTaskJsonPath, JSON.stringify(patchTask, null, 2))
  await writeFile(patchTaskMarkdownPath, renderPatchTaskMarkdown(patchTask))

  const patchContext = await buildPatchContextPack(patchTask, {
    latestPatchTask: patchTaskJsonPath,
    latestLoop: loopJsonPath,
    latestHandoff: handoffPath,
    latestFeedback,
    latestJson,
    ...(optimizer ? { latestOptimizerConfig: optimizer.sourcePath } : {}),
  }, {
    ...(optimizer ? { optimizer } : {}),
  })
  const patchContextJsonPath = path.join(outputDir, "latest.patch-context.json")
  const patchContextMarkdownPath = path.join(outputDir, "latest.patch-context.md")
  await writeFile(patchContextJsonPath, JSON.stringify(patchContext, null, 2))
  await writeFile(patchContextMarkdownPath, renderPatchContextMarkdown(patchContext))

  const patchPass = buildPatchPass(patchTask, patchContext, {
    latestPatchTask: patchTaskJsonPath,
    latestPatchContext: patchContextJsonPath,
    latestLoop: loopJsonPath,
    latestHandoff: handoffPath,
    latestFeedback,
    latestJson,
    ...(latestHistory?.sourceJsonPath ? { latestHistoryJson: latestHistory.sourceJsonPath } : {}),
    ...(latestHistory?.sourceMarkdownPath ? { latestHistoryMarkdown: latestHistory.sourceMarkdownPath } : {}),
    ...(optimizer ? { latestOptimizerConfig: optimizer.sourcePath } : {}),
  })
  const patchPassJsonPath = path.join(outputDir, "latest.patch-pass.json")
  const patchPassMarkdownPath = path.join(outputDir, "latest.patch-pass.md")
  await writeFile(patchPassJsonPath, JSON.stringify(patchPass, null, 2))
  await writeFile(patchPassMarkdownPath, renderPatchPassMarkdown(patchPass))

  const executorAttempt = buildExecutorAttempt(loopPlan, patchTask, patchContext, patchPass, {
    latestPatchPass: patchPassJsonPath,
    latestPatchTask: patchTaskJsonPath,
    latestPatchContext: patchContextJsonPath,
    latestLoop: loopJsonPath,
    latestHandoff: handoffPath,
    latestFeedback,
    latestJson,
    ...(optimizer ? { latestOptimizerConfig: optimizer.sourcePath } : {}),
  }, {
    ...(optimizer ? { optimizer } : {}),
  })
  const executorJsonPath = path.join(outputDir, "latest.executor.json")
  const executorMarkdownPath = path.join(outputDir, "latest.executor.md")
  await writeFile(loopMarkdownPath, renderLoopMarkdown(loopPlan, executorAttempt))
  await writeFile(executorJsonPath, JSON.stringify(executorAttempt, null, 2))
  await writeFile(executorMarkdownPath, renderExecutorMarkdown(executorAttempt))

  return {
    loopPlan,
    patchTask,
    patchPass,
    executorAttempt,
    paths: {
      handoffPath,
      loopJsonPath,
      loopMarkdownPath,
      patchTaskJsonPath,
      patchTaskMarkdownPath,
      patchContextJsonPath,
      patchContextMarkdownPath,
      patchPassJsonPath,
      patchPassMarkdownPath,
      executorJsonPath,
      executorMarkdownPath,
      ...(latestHistory?.sourceJsonPath ? { latestHistoryJsonPath: latestHistory.sourceJsonPath } : {}),
      ...(latestHistory?.sourceMarkdownPath ? { latestHistoryMarkdownPath: latestHistory.sourceMarkdownPath } : {}),
      ...(optimizer ? { latestOptimizerConfigPath: optimizer.sourcePath } : {}),
    },
  }
}
