import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { selectBenchmarkScenarios } from "./scenarios"
import { countScenariosBySplit, isBenchmarkSplit } from "./splits"
import { renderTextReport } from "./reporters/text"
import { writeJsonReport } from "./reporters/json"
import { renderFeedbackReport } from "./reporters/feedback"
import { buildGeneratorHandoff, renderGeneratorMarkdown } from "./reporters/handoff"
import { buildHistoryReport, loadHistoryReports, renderHistoryMarkdown } from "./reporters/history"
import type {
  BenchmarkComparison,
  BenchmarkInventory,
  BenchmarkReport,
  BenchmarkScenario,
  BenchmarkSplit,
  BenchmarkSurface,
  PatchHintArtifact,
  RepairHintSummary,
  ScenarioCodeHint,
  ScenarioReport,
  SurfaceSummary,
} from "./types"

function parseArgs(argv: string[]) {
  let surface: BenchmarkSurface | null = null
  let split: BenchmarkSplit | null = null
  let inventoryOnly = false

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    if (current === "--surface") {
      surface = (argv[index + 1] ?? null) as BenchmarkSurface | null
      index += 1
      continue
    }

    if (current === "--split") {
      const rawSplit = argv[index + 1] ?? null
      if (!isBenchmarkSplit(rawSplit)) {
        throw new Error(`Invalid benchmark split: ${rawSplit}`)
      }
      split = rawSplit
      index += 1
      continue
    }

    if (current === "--inventory-only") {
      inventoryOnly = true
    }
  }

  return { surface, split, inventoryOnly }
}

async function readPreviousReport(): Promise<BenchmarkReport | null> {
  const latestPath = path.join(path.resolve(process.env.ASTRA_BENCH_ARTIFACT_ROOT ?? path.join(process.cwd(), "data/bench-results")), "latest.json")

  try {
    const content = await readFile(latestPath, "utf8")
    return JSON.parse(content) as BenchmarkReport
  } catch {
    return null
  }
}

function buildInventory(scenarios: BenchmarkScenario[]): BenchmarkInventory {
  const bySurface: Record<string, number> = {}

  scenarios.forEach((scenario) => {
    bySurface[scenario.surface] = (bySurface[scenario.surface] ?? 0) + 1
  })

  return {
    totalScenarios: scenarios.length,
    bySurface,
    bySplit: countScenariosBySplit(scenarios),
  }
}

function mergeRepairHints(
  codeHint?: ScenarioCodeHint,
  patchHints?: PatchHintArtifact,
): RepairHintSummary | undefined {
  const suspectedFiles = [...new Set([...(codeHint?.suspectedFiles ?? []), ...(patchHints?.suspectedFiles ?? [])])]
  const suspectedSymbols = [...new Set([...(codeHint?.suspectedSymbols ?? []), ...(patchHints?.suspectedSymbols ?? [])])]
  const suspectedKeywords = [...new Set([...(codeHint?.suspectedKeywords ?? []), ...(patchHints?.suspectedKeywords ?? [])])]
  const failingSignals = [...new Set(patchHints?.failingSignals ?? [])]
  const confidence = patchHints?.confidence ?? null
  const risk = codeHint?.risk ?? null

  if (suspectedFiles.length === 0 && suspectedSymbols.length === 0 && suspectedKeywords.length === 0 && failingSignals.length === 0 && !confidence && !risk) {
    return undefined
  }

  return {
    suspectedFiles,
    suspectedSymbols,
    suspectedKeywords,
    failingSignals,
    confidence,
    risk,
  }
}

function summarizeSurfaces(scenarios: ScenarioReport[]): SurfaceSummary[] {
  const grouped = new Map<BenchmarkSurface, ScenarioReport[]>()

  scenarios.forEach((scenario) => {
    const bucket = grouped.get(scenario.surface) ?? []
    bucket.push(scenario)
    grouped.set(scenario.surface, bucket)
  })

  return [...grouped.entries()].map(([surface, items]) => ({
    surface,
    scenarioCount: items.length,
    passed: items.filter((item) => item.evaluation.pass).length,
    failed: items.filter((item) => !item.evaluation.pass).length,
    averageTotal: Math.round(items.reduce((sum, item) => sum + item.evaluation.total, 0) / items.length),
  }))
}

function compareToPrevious(
  current: ScenarioReport[],
  previous: BenchmarkReport | null,
): BenchmarkComparison {
  if (!previous) {
    const scenarioDeltas = current.map((scenario) => ({
      id: scenario.id,
      previousTotal: null,
      currentTotal: scenario.evaluation.total,
      delta: null,
      status: "new" as const,
      wasPassing: null,
      isPassing: scenario.evaluation.pass,
      scoreDeltas: Object.entries(scenario.evaluation.scores).map(([key, currentScore]) => ({
        key,
        previous: null,
        current: currentScore,
        delta: null,
      })),
      regressedScores: [],
      improvedScores: [],
    }))

    return {
      previousRunId: null,
      previousGeneratedAt: null,
      overallDelta: null,
      scenarioDeltas,
      regressions: 0,
      improvements: 0,
      unchanged: 0,
      added: scenarioDeltas.length,
    }
  }

  const currentAverage = Math.round(current.reduce((sum, scenario) => sum + scenario.evaluation.total, 0) / current.length)
  const previousAverage = previous.summary.averageTotal
  const previousMap = new Map(previous.scenarios.map((scenario) => [scenario.id, scenario]))
  const scenarioDeltas = current.map((scenario) => {
    const previousScenario = previousMap.get(scenario.id)
    const previousTotal = previousScenario?.evaluation.total ?? null
    const scoreKeys = new Set([
      ...Object.keys(previousScenario?.evaluation.scores ?? {}),
      ...Object.keys(scenario.evaluation.scores),
    ])
    const scoreDeltas = [...scoreKeys].map((key) => {
      const previousScore = previousScenario?.evaluation.scores[key] ?? null
      const currentScore = scenario.evaluation.scores[key] ?? 0
      return {
        key,
        previous: previousScore,
        current: currentScore,
        delta: previousScore === null ? null : currentScore - previousScore,
      }
    })
    const delta = previousTotal === null ? null : scenario.evaluation.total - previousTotal
    const status: "new" | "improved" | "regressed" | "unchanged" = previousTotal === null
      ? "new"
      : delta !== null && delta > 0
        ? "improved"
        : delta !== null && delta < 0
          ? "regressed"
          : "unchanged"

    return {
      id: scenario.id,
      previousTotal,
      currentTotal: scenario.evaluation.total,
      delta,
      status,
      wasPassing: previousScenario?.evaluation.pass ?? null,
      isPassing: scenario.evaluation.pass,
      scoreDeltas,
      regressedScores: scoreDeltas
        .filter((entry) => (entry.delta ?? 0) < 0)
        .map((entry) => entry.key),
      improvedScores: scoreDeltas
        .filter((entry) => (entry.delta ?? 0) > 0)
        .map((entry) => entry.key),
    }
  })

  return {
    previousRunId: previous.runId,
    previousGeneratedAt: previous.generatedAt,
    overallDelta: currentAverage - previousAverage,
    scenarioDeltas,
    regressions: scenarioDeltas.filter((scenario) => scenario.status === "regressed").length,
    improvements: scenarioDeltas.filter((scenario) => scenario.status === "improved").length,
    unchanged: scenarioDeltas.filter((scenario) => scenario.status === "unchanged").length,
    added: scenarioDeltas.filter((scenario) => scenario.status === "new").length,
  }
}

export async function runBench(argv: string[] = process.argv.slice(2)) {
  const { surface, split, inventoryOnly } = parseArgs(argv)
  const selectedScenarios = selectBenchmarkScenarios({ surface, split })

  if (selectedScenarios.length === 0) {
    throw new Error(`No benchmark scenarios matched filters: surface=${surface ?? "all"}, split=${split ?? "all"}`)
  }

  const inventory = buildInventory(selectedScenarios as BenchmarkScenario[])

  if (inventoryOnly) {
    return {
      inventory,
      text: JSON.stringify(inventory, null, 2),
      report: null,
      feedback: null,
      handoff: null,
      paths: null,
    }
  }

  const scenarioReports: ScenarioReport[] = []

  for (const scenario of selectedScenarios as BenchmarkScenario[]) {
    try {
      const execution = await scenario.run()
      const evaluation = scenario.evaluate(execution)
      scenarioReports.push({
        id: scenario.id,
        title: scenario.title,
        surface: scenario.surface,
        fixture: scenario.fixture,
        task: scenario.task,
        execution,
        evaluation,
        codeHint: scenario.codeHint,
        repairHints: mergeRepairHints(scenario.codeHint, evaluation.artifacts.patchHints),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected scenario error"
      scenarioReports.push({
        id: scenario.id,
        title: scenario.title,
        surface: scenario.surface,
        fixture: scenario.fixture,
        task: scenario.task,
        execution: { error: message },
        evaluation: {
          scores: {
            correctness: 0,
            completeness: 0,
            stability: 0,
          },
          total: 0,
          pass: false,
          issues: [
            {
              severity: "critical",
              message: "Scenario execution failed before evaluation completed.",
              evidence: message,
            },
          ],
          artifacts: {},
          nextActions: [message],
        },
        codeHint: scenario.codeHint,
        repairHints: mergeRepairHints(scenario.codeHint, undefined),
      })
    }
  }

  const previous = await readPreviousReport()
  const averageTotal = Math.round(
    scenarioReports.reduce((sum, scenario) => sum + scenario.evaluation.total, 0) / scenarioReports.length,
  )

  const report: BenchmarkReport = {
    schemaVersion: 1,
    runId: new Date().toISOString().replace(/[:.]/g, "-"),
    generatedAt: new Date().toISOString(),
    filter: { surface, split },
    summary: {
      totalScenarios: scenarioReports.length,
      passedScenarios: scenarioReports.filter((scenario) => scenario.evaluation.pass).length,
      failedScenarios: scenarioReports.filter((scenario) => !scenario.evaluation.pass).length,
      averageTotal,
      surfaces: summarizeSurfaces(scenarioReports),
    },
    inventory,
    comparison: compareToPrevious(scenarioReports, previous),
    scenarios: scenarioReports,
  }

  const paths = await writeJsonReport(report)
  const feedback = renderFeedbackReport(report)
  const feedbackPath = path.join(paths.outputDir, "latest.feedback.md")
  await writeFile(feedbackPath, feedback)
  const handoff = buildGeneratorHandoff(report, {
    latestJson: paths.latestPath,
    latestFeedback: feedbackPath,
  })
  const handoffPath = path.join(paths.outputDir, "latest.handoff.json")
  await writeFile(handoffPath, JSON.stringify(handoff, null, 2))
  const generatorPrompt = renderGeneratorMarkdown(handoff)
  const generatorPath = path.join(paths.outputDir, "latest.generator.md")
  await writeFile(generatorPath, generatorPrompt)

  const historyReports = await loadHistoryReports(path.join(paths.outputDir, "history"))
  const historyReport = buildHistoryReport(historyReports, {
    historyDir: path.join(paths.outputDir, "history"),
  })
  const historySummaryPath = path.join(paths.outputDir, "latest.history.json")
  await writeFile(historySummaryPath, JSON.stringify(historyReport, null, 2))
  const historyMarkdown = renderHistoryMarkdown(historyReport)
  const historyMarkdownPath = path.join(paths.outputDir, "latest.history.md")
  await writeFile(historyMarkdownPath, historyMarkdown)

  const text = renderTextReport(report)

  return {
    report,
    text,
    feedback,
    handoff,
    paths: {
      ...paths,
      feedbackPath,
      handoffPath,
      generatorPath,
      historySummaryPath,
      historyMarkdownPath,
    },
  }
}
