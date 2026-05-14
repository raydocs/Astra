import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { loadBenchOptStore } from "./store.ts"
import { printBenchOptHelp, runBenchOpt } from "./runner.ts"
import type { BenchOptRunResult } from "./types.ts"

export interface BenchOptAutoLoopCycle {
  index: number
  mode: "start" | "resume"
  runId: string
  sessionId: string | null
  phase: string | null
  decision: string | null
  terminationReason: string | null
  handoffId: string | null
  handoffTarget: string | null
}

export interface BenchOptAutoLoopArtifact {
  schemaVersion: 1
  generatedAt: string
  maxCycles: number
  completedCycles: number
  terminal: boolean
  finalRunId: string | null
  finalSessionId: string | null
  finalPhase: string | null
  finalDecision: string | null
  cycles: BenchOptAutoLoopCycle[]
}

function parseArgs(argv: string[]) {
  let maxCycles = 3
  let outputDir = path.resolve(process.env.ASTRA_BENCH_OPT_ARTIFACT_ROOT ?? path.join(process.cwd(), "data/bench-opt-results"))
  let followUpSequence: string[] = []
  const passthrough: string[] = []

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    if (current === "--help" || current === "-h") {
      return { help: true, maxCycles, outputDir, followUpSequence, passthrough }
    }
    if (current === "--max-cycles") {
      const parsed = Number.parseInt(argv[index + 1] ?? "", 10)
      if (Number.isFinite(parsed) && parsed > 0) {
        maxCycles = parsed
      }
      index += 1
      continue
    }
    if (current === "--output") {
      outputDir = path.resolve(argv[index + 1] ?? outputDir)
      passthrough.push(current, outputDir)
      index += 1
      continue
    }
    if (current === "--orchestration-follow-up-sequence") {
      followUpSequence = (argv[index + 1] ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
      index += 1
      continue
    }
    passthrough.push(current)
  }

  return { help: false, maxCycles, outputDir, followUpSequence, passthrough }
}

function renderAutoLoopMarkdown(artifact: BenchOptAutoLoopArtifact) {
  const lines: string[] = []
  lines.push("# Astra Bench Opt Autoloop")
  lines.push("")
  lines.push(`- Generated: ${artifact.generatedAt}`)
  lines.push(`- Max cycles: ${artifact.maxCycles}`)
  lines.push(`- Completed cycles: ${artifact.completedCycles}`)
  lines.push(`- Terminal: ${artifact.terminal ? "yes" : "no"}`)
  lines.push(`- Final run: ${artifact.finalRunId ?? "none"}`)
  lines.push(`- Final session: ${artifact.finalSessionId ?? "none"}`)
  lines.push(`- Final phase: ${artifact.finalPhase ?? "none"}`)
  lines.push(`- Final decision: ${artifact.finalDecision ?? "none"}`)
  lines.push("")
  lines.push("## Cycles")
  artifact.cycles.forEach((cycle) => {
    lines.push(`- #${cycle.index} ${cycle.mode}: run=${cycle.runId}, session=${cycle.sessionId ?? "none"}, phase=${cycle.phase ?? "none"}, decision=${cycle.decision ?? "none"}, termination=${cycle.terminationReason ?? "none"}, handoff=${cycle.handoffId ?? "none"}`)
  })
  return lines.join("\n")
}

export async function runBenchOptAutoLoop(argv: string[] = process.argv.slice(2)) {
  const parsed = parseArgs(argv)
  if (parsed.help) {
    printBenchOptHelp()
    console.log("")
    console.log("Autoloop wrapper:")
    console.log("  Repeatedly starts/resumes bench-opt orchestration sessions until terminal or max cycles.")
    console.log("  Options:")
    console.log("    --max-cycles <n>")
    console.log("    --orchestration-follow-up-sequence rerun,keep")
    return null
  }

  const cycles: BenchOptAutoLoopCycle[] = []
  let terminal = false
  let lastResult: BenchOptRunResult | null = null

  for (let index = 1; index <= parsed.maxCycles; index += 1) {
    const store = await loadBenchOptStore(parsed.outputDir)
    const latest = store.latestSessionArtifacts
    const isResume = Boolean(latest?.sessionPath && latest?.checkpointPath && latest?.handoffPath)
    const followUp = parsed.followUpSequence[index - 1] ?? null
    const cycleArgs = [
      "--write",
      "--orchestrate",
      "--session",
      "--output",
      parsed.outputDir,
      ...(isResume && latest?.sessionPath && latest?.checkpointPath
        ? [
            "--session-resume",
            latest.sessionPath,
            "--session-checkpoint",
            latest.checkpointPath,
            ...(latest.handoffPath ? ["--session-handoff", latest.handoffPath] : []),
          ]
        : []),
      ...(followUp ? ["--orchestration-follow-up", followUp] : []),
      ...parsed.passthrough,
    ]

    const result = await runBenchOpt(cycleArgs)
    lastResult = result
    cycles.push({
      index,
      mode: isResume ? "resume" : "start",
      runId: result.report.runId,
      sessionId: result.session?.state.sessionId ?? null,
      phase: result.session?.state.phase ?? null,
      decision: result.orchestrationLoop?.finalDecision?.action ?? result.orchestration?.decision.action ?? null,
      terminationReason: result.orchestrationLoop?.terminationReason ?? null,
      handoffId: result.session?.handoff?.handoffId ?? null,
      handoffTarget: result.session?.handoff?.target ?? null,
    })

    const completed = result.session?.state.phase === "completed"
    const blockedForResume = result.session?.state.phase === "handoff" && result.session?.handoff?.target === "same-session"
    if (completed) {
      terminal = true
      break
    }
    if (!blockedForResume) {
      break
    }
  }

  const artifact: BenchOptAutoLoopArtifact = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    maxCycles: parsed.maxCycles,
    completedCycles: cycles.length,
    terminal,
    finalRunId: lastResult?.report.runId ?? null,
    finalSessionId: lastResult?.session?.state.sessionId ?? null,
    finalPhase: lastResult?.session?.state.phase ?? null,
    finalDecision: lastResult?.orchestrationLoop?.finalDecision?.action ?? lastResult?.orchestration?.decision.action ?? null,
    cycles,
  }

  await mkdir(parsed.outputDir, { recursive: true })
  const jsonPath = path.join(parsed.outputDir, "latest.autoloop.json")
  const markdownPath = path.join(parsed.outputDir, "latest.autoloop.md")
  await writeFile(jsonPath, JSON.stringify(artifact, null, 2))
  await writeFile(markdownPath, renderAutoLoopMarkdown(artifact))

  if (lastResult) {
    console.log(lastResult.text)
    console.log("")
  }
  console.log(`Autoloop JSON: ${jsonPath}`)
  console.log(`Autoloop Markdown: ${markdownPath}`)
  console.log(`Autoloop cycles: ${artifact.completedCycles}/${artifact.maxCycles}`)
  console.log(`Autoloop terminal: ${artifact.terminal ? "yes" : "no"}`)

  return {
    artifact,
    jsonPath,
    markdownPath,
    lastResult,
  }
}

async function main() {
  await runBenchOptAutoLoop(process.argv.slice(2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
