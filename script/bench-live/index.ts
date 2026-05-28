export type {
  LiveEvaluationContext,
  LiveEvaluationResult,
  LiveEvaluationStatus,
  LiveResultArtifacts,
  LiveResultManifest,
  LiveScenarioContext,
  LiveScenarioDefinition,
  LiveScenarioExecution,
  LiveScenarioMetadata,
} from "./evaluator"
export {
  evaluateLiveScenario,
} from "./evaluator"

export type {
  LiveRuntimeEvent,
  LiveRuntimeEventKind,
  LiveRuntimeSnapshot,
  LiveRuntimeStatus,
} from "./runtime"
export {
  createLiveRuntime,
  LiveRuntime,
} from "./runtime"

export type { PersistedLiveBenchArtifacts } from "./results"
export { persistLiveBenchRunOutcome } from "./results"

export type {
  LiveRubric,
  LiveRubricInput,
  LiveRubricResult,
} from "./rubrics"
export {
  createLiveRubric,
  noopLiveRubrics,
} from "./rubrics"

export {
  liveScenarios,
  fixturePlaywrightSmokeScenario,
  pageTranslationArticleBasicScenario,
  pageTranslationArticleBasicSourceScenario,
  pageTranslationArticleBasicSourceTranslationOnlyScenario,
  documentIntakeBasicScenario,
  documentIntakeLocalFileHandoffScenario,
  placeholderScenario,
  interactionPriorityBasicScenario,
  hoverTranslationBasicScenario,
  selectionExplainBasicScenario,
  inputTranslationBasicScenario,
  subtitleBasicScenario,
  frameCoordinationBasicScenario,
  siteAutomationAutostartScenario,
  siteRulesExplainabilityBasicScenario,
  dynamicContentAppendScenario,
  articleExtractionDocsScenario,
  onboardingSmokeScenario,
  popupDeepReadProofScenario,
  popupDeepReadSmokeScenario,
  vocabularySrsSmokeScenario,
  learningLoopRevisitSmokeScenario,
  youtubeSubtitlePlayerButtonScenario,
  youtubeSubtitleInPlayerSettingsScenario,
  youtubeSubtitleBasicBilingualScenario,
  youtubeSubtitleSeekRecoveryScenario,
  youtubeSubtitleTrackSwitchScenario,
  youtubeTranscriptPanelScenario,
  youtubeSaveSentenceReviewLoopScenario,
  youtubeVideoNoteCreateScenario,
} from "./scenarios/index"
export { holdoutScenarios } from "./scenarios/holdout/index"

import { createLiveRuntime } from "./runtime"
import { evaluateLiveScenario, type LiveEvaluationResult, type LiveScenarioContext, type LiveScenarioDefinition, type LiveScenarioExecution } from "./evaluator"
import { liveScenarios } from "./scenarios/index"
import { holdoutScenarios } from "./scenarios/holdout/index"

type AnyLiveScenarioDefinition = LiveScenarioDefinition<any>
const liveScenarioAliases = new Map<string, string>([
  ["bench-live/popup-deep-read-smoke", "bench-live/popup-deep-read-proof"],
])

export interface LiveBenchArgs {
  help: boolean
  listOnly: boolean
  scenarioId: string | null
}

export interface LiveBenchHelpOutcome {
  mode: "help"
  text: string
  exitCode: 0
}

export interface LiveBenchListOutcome {
  mode: "list"
  text: string
  scenarios: AnyLiveScenarioDefinition[]
  exitCode: 0
}

export interface LiveBenchRunOutcome {
  mode: "run"
  text: string
  scenario: AnyLiveScenarioDefinition
  context: LiveScenarioContext
  execution: LiveScenarioExecution
  result: LiveEvaluationResult
  exitCode: number
}

export type LiveBenchOutcome = LiveBenchHelpOutcome | LiveBenchListOutcome | LiveBenchRunOutcome

function createRunId() {
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "")
  const random = Math.random().toString(36).slice(2, 8)
  return `live-${timestamp}-${random}`
}

export function parseLiveBenchArgs(argv: string[]): LiveBenchArgs {
  let scenarioId: string | null = null
  let listOnly = false
  let help = false

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]

    if (current === "--help" || current === "-h") {
      help = true
      continue
    }

    if (current === "--list") {
      listOnly = true
      continue
    }

    if (current === "--scenario") {
      scenarioId = argv[index + 1] ?? null
      index += 1
      continue
    }

    if (current.startsWith("--scenario=")) {
      scenarioId = current.slice("--scenario=".length) || null
    }
  }

  return {
    help,
    listOnly,
    scenarioId,
  }
}

export function formatLiveBenchHelp() {
  return [
    "Astra Bench Live CLI",
    "Usage: pnpm bench:live -- [options]",
    "",
    "Options:",
    "  --list                  List available live scenarios",
    "  --scenario <id>         Run a specific scenario (default: first available)",
    "  -h, --help              Show this help",
  ].join("\n")
}

export function formatLiveBenchScenarioList(scenarios: AnyLiveScenarioDefinition[]) {
  const lines = ["Astra Bench Live scenarios"]
  for (const scenario of scenarios) {
    lines.push(`- ${scenario.id}: ${scenario.title} [${scenario.surface}]`)
  }
  return lines.join("\n")
}

export function resolveLiveScenario(scenarioId: string | null): AnyLiveScenarioDefinition {
  const allScenarios = [...liveScenarios, ...holdoutScenarios]
  const canonicalScenarioId = scenarioId ? (liveScenarioAliases.get(scenarioId) ?? scenarioId) : null
  const scenario = scenarioId
    ? allScenarios.find((entry) => entry.id === canonicalScenarioId)
    : liveScenarios[0]

  if (!scenario) {
    throw new Error(scenarioId ? `Live scenario not found: ${scenarioId}` : "No live scenarios are registered.")
  }

  return scenario
}

export async function runLiveBench(argv: string[]): Promise<LiveBenchOutcome> {
  const args = parseLiveBenchArgs(argv)

  if (args.help) {
    return {
      mode: "help",
      text: formatLiveBenchHelp(),
      exitCode: 0,
    }
  }

  if (args.listOnly) {
    return {
      mode: "list",
      text: formatLiveBenchScenarioList(liveScenarios),
      scenarios: [...liveScenarios],
      exitCode: 0,
    }
  }

  const scenario = resolveLiveScenario(args.scenarioId)
  const context: LiveScenarioContext = {
    id: scenario.id,
    title: scenario.title,
    surface: scenario.surface,
    fixture: scenario.fixture ?? null,
    description: scenario.description ?? null,
    tags: [...(scenario.tags ?? [])],
    runId: createRunId(),
  }
  const runtime = createLiveRuntime()

  let execution: LiveScenarioExecution
  try {
    // The scenario registry mixes specialized execution payloads; normalize to the base contract here.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    execution = await scenario.run(runtime, context)
  } catch (error) {
    runtime.fail(error instanceof Error ? error : new Error(String(error)))
    const snapshot = runtime.snapshot()
    execution = {
      status: snapshot.status,
      summary: "The live scenario threw before it could produce a structured result.",
      notes: [error instanceof Error ? error.message : String(error)],
      artifacts: {
        error: error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : {
              message: String(error),
            },
      },
      runtime: snapshot,
      startedAt: snapshot.startedAt,
      finishedAt: snapshot.finishedAt,
    }
  }

  const result = await evaluateLiveScenario(scenario, execution, {
    runId: context.runId,
    scenario: {
      id: context.id,
      title: context.title,
      surface: context.surface,
      fixture: context.fixture,
      description: context.description,
      tags: context.tags,
    },
    runtime: runtime.snapshot(),
  })

  return {
    mode: "run",
    text: result.text,
    scenario,
    context,
    execution,
    result,
    exitCode: result.status === "fail" ? 1 : 0,
  }
}
