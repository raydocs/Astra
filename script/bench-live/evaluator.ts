import type { LiveRuntime, LiveRuntimeSnapshot, LiveRuntimeStatus } from "./runtime"
import { noopLiveRubrics, type LiveRubric, type LiveRubricResult } from "./rubrics"

export interface LiveScenarioMetadata {
  id: string
  title: string
  surface: string
  fixture: string | null
  description: string | null
  tags: string[]
}

export interface LiveScenarioContext extends LiveScenarioMetadata {
  runId: string
}

export interface LiveScenarioExecution {
  status: LiveRuntimeStatus
  summary?: string
  notes?: string[]
  artifacts?: Record<string, unknown>
  runtime?: LiveRuntimeSnapshot
  startedAt?: string | null
  finishedAt?: string | null
}

export interface LiveEvaluationContext {
  runId: string
  scenario: LiveScenarioMetadata
  runtime: LiveRuntimeSnapshot
}

export interface LiveResultArtifacts {
  scenario: LiveScenarioMetadata
  execution: Record<string, unknown>
  runtime: LiveRuntimeSnapshot
  evaluation: Record<string, unknown>
  rubrics: LiveRubricResult[]
  manifest: LiveResultManifest
}

export interface LiveResultManifest {
  schema: "astra.bench-live.result"
  version: 1
  runId: string
  scenario: LiveScenarioMetadata
  execution: {
    status: LiveRuntimeStatus
    summary: string
    startedAt: string | null
    finishedAt: string | null
    noteCount: number
    artifactKeys: string[]
  }
  evaluation: {
    status: LiveEvaluationStatus
    pass: boolean
    score: number
    issueCount: number
    nextActionCount: number
    rubricCount: number
  }
  runtime: {
    status: LiveRuntimeStatus
    startedAt: string | null
    finishedAt: string | null
    eventCount: number
    artifactKeys: string[]
  }
}

export type LiveEvaluationStatus = "pass" | "fail" | "skipped"

export interface LiveEvaluationResult {
  runId: string
  scenario: LiveScenarioMetadata
  status: LiveEvaluationStatus
  pass: boolean
  score: number
  summary: string
  issues: string[]
  nextActions: string[]
  notes: string[]
  rubrics: LiveRubricResult[]
  artifacts: LiveResultArtifacts
  runtime: LiveRuntimeSnapshot
  manifest: LiveResultManifest
  text: string
}

export interface LiveScenarioDefinition<TExecution extends LiveScenarioExecution = LiveScenarioExecution> {
  id: string
  title: string
  surface: string
  fixture?: string
  description?: string
  tags?: string[]
  run: (runtime: LiveRuntime, context: LiveScenarioContext) => Promise<TExecution> | TExecution
  rubrics?: LiveRubric[]
  evaluate?: (execution: TExecution, context: LiveEvaluationContext) => Promise<Partial<LiveEvaluationResult>> | Partial<LiveEvaluationResult>
}

function createScenarioMetadata<TExecution extends LiveScenarioExecution>(
  scenario: LiveScenarioDefinition<TExecution>,
): LiveScenarioMetadata {
  return {
    id: scenario.id,
    title: scenario.title,
    surface: scenario.surface,
    fixture: scenario.fixture ?? null,
    description: scenario.description ?? null,
    tags: [...(scenario.tags ?? [])],
  }
}

function toRuntimeSnapshot(
  scenario: LiveScenarioMetadata,
  execution: LiveScenarioExecution,
): LiveRuntimeSnapshot {
  return execution.runtime ?? {
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    status: execution.status,
    startedAt: execution.startedAt ?? null,
    finishedAt: execution.finishedAt ?? null,
    events: [],
    artifacts: execution.artifacts ?? {},
  }
}

function aggregateRubrics(rubrics: LiveRubricResult[]) {
  if (rubrics.length === 0) {
    return {
      score: 0,
      pass: true,
      issues: [] as string[],
    }
  }

  const weighted = rubrics.reduce(
    (acc, rubric) => {
      const weight = 1
      acc.score += rubric.score * weight
      acc.weight += weight
      if (!rubric.pass) {
        acc.issues.push(rubric.message ? `${rubric.title}: ${rubric.message}` : rubric.title)
      }
      return acc
    },
    {
      score: 0,
      weight: 0,
      issues: [] as string[],
    },
  )

  return {
    score: weighted.weight === 0 ? 0 : Math.round(weighted.score / weighted.weight),
    pass: weighted.issues.length === 0,
    issues: weighted.issues,
  }
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function stableStringify(value: unknown): string {
  if (value === null) {
    return "null"
  }

  if (typeof value === "string") {
    return JSON.stringify(value)
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  if (typeof value === "bigint") {
    return JSON.stringify(value.toString())
  }

  if (typeof value === "undefined") {
    return "undefined"
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(", ")}]`
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString())
  }

  if (typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}: ${stableStringify((value as Record<string, unknown>)[key])}`)
    return `{${entries.join(", ")}}`
  }

  return JSON.stringify(String(value))
}

function truncate(text: string, maxLength = 220) {
  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, Math.max(0, maxLength - 1))}…`
}

function previewArtifact(value: unknown) {
  return truncate(stableStringify(value))
}

function defaultSummary(
  scenario: LiveScenarioMetadata,
  execution: LiveScenarioExecution,
) {
  if (execution.summary && execution.summary.trim().length > 0) {
    return execution.summary.trim()
  }

  if (execution.status === "skipped") {
    return `${scenario.title} is intentionally skipped until the live browser adapter is available.`
  }

  if (execution.status === "failed") {
    return `${scenario.title} failed during the live harness bootstrap.`
  }

  return `${scenario.title} completed with the live bench contract.`
}

function defaultNextActions(
  scenario: LiveScenarioMetadata,
  execution: LiveScenarioExecution,
  issues: string[],
) {
  if (execution.status === "skipped") {
    return [
      "Wire in a browser adapter such as Playwright for the live evaluator step.",
      `Replace ${scenario.id} with a real end-to-end scenario once the browser layer exists.`,
    ]
  }

  if (issues.length > 0) {
    return [...issues]
  }

  return []
}

function buildManifest(params: {
  runId: string
  scenario: LiveScenarioMetadata
  execution: LiveScenarioExecution
  runtime: LiveRuntimeSnapshot
  evaluation: {
    status: LiveEvaluationStatus
    pass: boolean
    score: number
    issues: string[]
    nextActions: string[]
    rubrics: LiveRubricResult[]
  }
  artifactKeys: string[]
}): LiveResultManifest {
  return {
    schema: "astra.bench-live.result",
    version: 1,
    runId: params.runId,
    scenario: params.scenario,
    execution: {
      status: params.execution.status,
      summary: defaultSummary(params.scenario, params.execution),
      startedAt: params.execution.startedAt ?? params.runtime.startedAt,
      finishedAt: params.execution.finishedAt ?? params.runtime.finishedAt,
      noteCount: params.execution.notes?.length ?? 0,
      artifactKeys: params.artifactKeys,
    },
    evaluation: {
      status: params.evaluation.status,
      pass: params.evaluation.pass,
      score: params.evaluation.score,
      issueCount: params.evaluation.issues.length,
      nextActionCount: params.evaluation.nextActions.length,
      rubricCount: params.evaluation.rubrics.length,
    },
    runtime: {
      status: params.runtime.status,
      startedAt: params.runtime.startedAt,
      finishedAt: params.runtime.finishedAt,
      eventCount: params.runtime.events.length,
      artifactKeys: Object.keys(params.runtime.artifacts).sort(),
    },
  }
}

function renderLiveBenchResult(result: LiveEvaluationResult) {
  const lines: string[] = []
  const { scenario, runtime, manifest } = result

  lines.push("Astra Bench Live")
  lines.push(`Run ID: ${result.runId}`)
  lines.push(`Scenario: ${scenario.id}`)
  lines.push(`Title: ${scenario.title}`)
  lines.push(`Surface: ${scenario.surface}`)
  if (scenario.fixture) {
    lines.push(`Fixture: ${scenario.fixture}`)
  }
  if (scenario.description) {
    lines.push(`Description: ${scenario.description}`)
  }
  if (scenario.tags.length > 0) {
    lines.push(`Tags: ${scenario.tags.join(", ")}`)
  }
  lines.push(`Status: ${result.status}`)
  lines.push(`Pass: ${result.pass ? "yes" : "no"}`)
  lines.push(`Score: ${result.score}`)
  lines.push(`Summary: ${result.summary}`)
  lines.push(`Runtime status: ${runtime.status}`)
  lines.push(`Runtime started: ${runtime.startedAt ?? "n/a"}`)
  lines.push(`Runtime finished: ${runtime.finishedAt ?? "n/a"}`)
  lines.push(`Runtime events: ${runtime.events.length}`)
  lines.push(`Artifact keys: ${Object.keys(result.artifacts).sort().join(", ")}`)
  lines.push(`Manifest: ${previewArtifact(manifest)}`)

  lines.push("Artifacts:")
  lines.push(`- scenario: ${previewArtifact(result.artifacts.scenario)}`)
  lines.push(`- execution: ${previewArtifact(result.artifacts.execution)}`)
  lines.push(`- runtime: ${previewArtifact(result.artifacts.runtime)}`)
  lines.push(`- evaluation: ${previewArtifact(result.artifacts.evaluation)}`)
  lines.push(`- rubrics: ${previewArtifact(result.artifacts.rubrics)}`)
  lines.push(`- manifest: ${previewArtifact(result.artifacts.manifest)}`)

  if (result.notes.length > 0) {
    lines.push("Notes:")
    result.notes.forEach((note) => {
      lines.push(`- ${note}`)
    })
  }

  if (result.rubrics.length > 0) {
    lines.push("Rubrics:")
    result.rubrics.forEach((rubric) => {
      const verdict = rubric.pass ? "pass" : "fail"
      const suffix = rubric.message ? ` — ${rubric.message}` : ""
      lines.push(`- [${verdict}] ${rubric.title} (${rubric.score})${suffix}`)
    })
  }

  if (result.issues.length > 0) {
    lines.push("Issues:")
    result.issues.forEach((issue) => {
      lines.push(`- ${issue}`)
    })
  }

  if (result.nextActions.length > 0) {
    lines.push("Next actions:")
    result.nextActions.forEach((action) => {
      lines.push(`- ${action}`)
    })
  }

  return lines.join("\n")
}

function finalizeLiveResult<TExecution extends LiveScenarioExecution>(params: {
  scenario: LiveScenarioMetadata
  execution: TExecution
  runtime: LiveRuntimeSnapshot
  runId: string
  rubricResults: LiveRubricResult[]
  base?: Partial<LiveEvaluationResult>
}): LiveEvaluationResult {
  const aggregated = aggregateRubrics(params.rubricResults)
  const notes = uniqueStrings(params.base?.notes ?? params.execution.notes ?? [])
  const issues = uniqueStrings(params.base?.issues ?? aggregated.issues)
  const nextActions = uniqueStrings(
    params.base?.nextActions ?? defaultNextActions(params.scenario, params.execution, issues),
  )
  const status: LiveEvaluationStatus =
    params.base?.status ?? (params.execution.status === "failed" ? "fail" : params.execution.status === "skipped" ? "skipped" : aggregated.pass ? "pass" : "fail")
  const pass = params.base?.pass ?? (status === "pass")
  const score = params.base?.score ?? (params.rubricResults.length === 0 ? (status === "pass" ? 100 : 0) : aggregated.score)
  const executionSummary = defaultSummary(params.scenario, params.execution)
  const executionArtifacts = params.execution.artifacts ?? {}

  const evaluationArtifacts = {
    ...(params.base?.artifacts ?? {}),
    scenario: params.scenario,
    execution: {
      status: params.execution.status,
      summary: executionSummary,
      notes,
      startedAt: params.execution.startedAt ?? params.runtime.startedAt,
      finishedAt: params.execution.finishedAt ?? params.runtime.finishedAt,
      artifacts: executionArtifacts,
    },
    runtime: params.runtime,
    evaluation: {
      status,
      pass,
      score,
      summary: executionSummary,
      issues,
      nextActions,
      notes,
      rubricCount: params.rubricResults.length,
    },
    rubrics: params.rubricResults,
  } satisfies Record<string, unknown>

  const artifactKeys = Object.keys(evaluationArtifacts).sort()
  const manifest = buildManifest({
    runId: params.runId,
    scenario: params.scenario,
    execution: params.execution,
    runtime: params.runtime,
    evaluation: {
      status,
      pass,
      score,
      issues,
      nextActions,
      rubrics: params.rubricResults,
    },
    artifactKeys,
  })

  const artifacts: LiveResultArtifacts = {
    ...evaluationArtifacts,
    manifest,
  } as LiveResultArtifacts

  const result: LiveEvaluationResult = {
    runId: params.runId,
    scenario: params.scenario,
    status,
    pass,
    score,
    summary: executionSummary,
    issues,
    nextActions,
    notes,
    rubrics: params.rubricResults,
    artifacts,
    runtime: params.runtime,
    manifest,
    text: "",
  }

  result.text = params.base?.text ?? renderLiveBenchResult(result)
  return result
}

export async function evaluateLiveScenario<TExecution extends LiveScenarioExecution>(
  scenario: LiveScenarioDefinition<TExecution>,
  execution: TExecution,
  context?: Partial<LiveEvaluationContext> & { runId?: string },
): Promise<LiveEvaluationResult> {
  const metadata = createScenarioMetadata(scenario)
  const runtime = context?.runtime ?? toRuntimeSnapshot(metadata, execution)
  const runId = context?.runId ?? runtime.startedAt ?? new Date().toISOString()
  const evaluationContext: LiveEvaluationContext = {
    runId,
    scenario: metadata,
    runtime,
  }

  if (scenario.evaluate) {
    const custom = await scenario.evaluate(execution, evaluationContext)
    return finalizeLiveResult({
      scenario: metadata,
      execution,
      runtime,
      runId,
      rubricResults: custom.rubrics ?? [],
      base: custom,
    })
  }

  const rubrics = scenario.rubrics ?? noopLiveRubrics
  const rubricResults = await Promise.all(
    rubrics.map(async (rubric) => {
      return await rubric.evaluate({
        scenarioId: scenario.id,
        runtime,
        execution: {
          ...(execution.artifacts ?? {}),
          status: execution.status,
          summary: execution.summary ?? null,
          notes: execution.notes ?? [],
        },
      })
    }),
  )

  return finalizeLiveResult({
    scenario: metadata,
    execution,
    runtime,
    runId,
    rubricResults,
  })
}
