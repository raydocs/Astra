import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { runLiveBench, liveScenarios, type LiveEvaluationResult } from "../bench-live/index.ts"
import { contextCandidates } from "./candidates/context.ts"
import { promptCandidates } from "./candidates/prompt.ts"
import { selectBenchOptChampion } from "./champion.ts"
import { createBenchOptCheckpoint, recordBenchOptCheckpoint, type BenchOptCheckpointArtifact } from "./checkpoints.ts"
import { createBenchOptCompactionMetadata, recordBenchOptCompaction, shouldBenchOptCompactSession, type BenchOptCompactionMetadata } from "./compaction.ts"
import { createBenchOptExperimentRun } from "./experiments.ts"
import { executeMaterializedCandidate } from "./materialize.ts"
import { compareAndDecideBenchOptKeepReject } from "./keep-reject.ts"
import { createBenchOptSessionHandoffArtifact, recordBenchOptSessionHandoff, type BenchOptSessionHandoffArtifact } from "./handoff.ts"
import { listOptimizerCandidates } from "./registry.ts"
import { runBenchOptOrchestration, type BenchOptOrchestrationArtifact } from "./orchestrator.ts"
import { buildBenchOptPublishPlan, type BenchOptPublishPlan } from "./publish.ts"
import { decideBenchOptPromotion, type BenchOptPromotionDecision } from "./promote.ts"
import { buildBenchOptRollbackPlan, type BenchOptRollbackPlan } from "./rollback.ts"
import { createBenchOptSessionState, isBenchOptSessionOverBudget, resumeBenchOptSessionState, updateBenchOptSessionState, type BenchOptSessionState } from "./session.ts"
import { buildBenchOptStatusArtifact, renderBenchOptStatusMarkdown } from "./status.ts"
import { createAstraCapabilityStatusCards, summarizeAstraCapabilityCards } from "./capabilities.ts"
import { buildCapabilityProofOverrides, type CapabilityProofResult } from "./capability-proof.ts"
import { loadBenchOptStore, saveBenchOptChampion, saveBenchOptExperiment, saveBenchOptSessionArtifacts } from "./store.ts"
import { createBenchOptIterationBudget } from "./strategy.ts"
import { runBenchOptVerification } from "./verify.ts"
import type { BenchOptVerificationCommandResult, BenchOptVerificationResult } from "./verify.ts"
import type {
  BenchArtifactReportLike,
  BenchOptBaselineSnapshot,
  BenchOptCandidate,
  BenchOptCandidateInput,
  BenchOptCandidateScore,
  BenchOptChampionRecord,
  BenchOptExperimentRun,
  BenchOptExecutionResult,
  BenchOptExecutionVerificationResult,
  BenchOptResolvedContextConfig,
  BenchOptResolvedOptimizerConfig,
  BenchOptResolvedPromptConfig,
  BenchOptOrchestrationLoopResult,
  BenchOptRunOptions,
  BenchOptRunReport,
  BenchOptRunResult,
  BenchOptRunnerLiveOptions,
  BenchOptRunnerOrchestrationOptions,
  BenchOptRunnerKeepRejectOptions,
  BenchOptRunnerPromotionOptions,
  BenchOptRunnerSessionOptions,
  BenchOptRunnerVerificationOptions,
  BenchOptSessionArtifactsResult,
  BenchOptTrialSplit,
  ContextOptimizerCandidate,
  PromptOptimizerCandidate,
} from "./types.ts"
import type { BenchOptStructuredReportLike } from "./compare.ts"
import { compareCandidateScores, normalizeBaseline, scoreCandidate } from "./score.ts"
import { checkGuardrails, extractScoreTrends, type BenchOptGuardrailResult } from "./guardrails.ts"
import { detectRedFlags, type BenchOptRedFlagReport } from "./red-flags.ts"
import { createTelemetryCollector, type BenchOptTelemetryCollector } from "./telemetry.ts"
import { createLogger } from "./logs.ts"

function normalizeTrialSplit(value: string | null | undefined): BenchOptTrialSplit {
  return value === "validation" || value === "holdout" ? value : "train"
}

function parsePromotionSplits(value: string | null | undefined): BenchOptTrialSplit[] {
  if (!value) {
    return ["validation", "holdout"]
  }

  const splits = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => normalizeTrialSplit(part))

  return splits.length > 0 ? [...new Set(splits)] : ["validation", "holdout"]
}

function parseVerificationSplits(value: string | null | undefined): BenchOptTrialSplit[] | null {
  if (!value) {
    return null
  }

  const splits = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => normalizeTrialSplit(part))

  return splits.length > 0 ? [...new Set(splits)] : null
}

function toStatusScoreTrends(
  trends: Array<{
    split: string
    averageTotal: number | null
  }>,
) {
  const grouped = new Map<string, number[]>()
  for (const trend of trends) {
    if (trend.averageTotal === null) continue
    const scores = grouped.get(trend.split) ?? []
    scores.push(trend.averageTotal)
    grouped.set(trend.split, scores)
  }

  return Array.from(grouped.entries()).map(([surface, scores]) => ({
    surface,
    scores,
  }))
}

function normalizeOrchestrationOptions(
  value: BenchOptRunOptions["orchestration"],
): BenchOptRunnerOrchestrationOptions | null {
  if (value === false || !value) {
    return null
  }

  return value
}

function parseArgs(argv: string[]) {
  const candidateFiles: string[] = []
  const promptIds: string[] = []
  const contextIds: string[] = []
  let candidateDir: string | null = null
  let baselineReportPath = path.join(path.resolve(process.env.ASTRA_BENCH_ARTIFACT_ROOT ?? path.join(process.cwd(), "data/bench-results")), "latest.json")
  let outputDir = path.resolve(process.env.ASTRA_BENCH_OPT_ARTIFACT_ROOT ?? path.join(process.cwd(), "data/bench-opt-results"))
  let worktreeRoot: string | undefined
  let evaluatedSplit: BenchOptTrialSplit | null = null
  let promotionSplits: BenchOptTrialSplit[] | null = null
  let verificationEnabled = false
  let verificationPackageManager: string | null = null
  let verificationIncludeTypeCheck = true
  let verificationIncludeTests = true
  let verificationBenchSplits: BenchOptTrialSplit[] | null = null
  let orchestrationEnabled = false
  let orchestrationObjective: string | null = null
  let orchestrationForcedFollowUp: "rerun" | "keep" | "reject" | null = null
  let orchestrationMaxIterations: number | null = null
  let orchestrationContinueOnRerun = true
  let orchestrationRecordCheckpoints = true
  let sessionEnabled = false
  let sessionForceCompaction = false
  let sessionForceHandoff = false
  let sessionResumePath: string | null = null
  let sessionCheckpointPath: string | null = null
  let sessionHandoffPath: string | null = null
  let promotionPlanEnabled = false
  let promotionLivePassed = false
  let liveEnabled = false
  let liveScenarioId: string | null = null
  let liveRunAll = false
  let promotionAllow = false
  let publishAllow = false
  let rollbackAllow = false
  let materializeExecution = false
  let applyStructuredEdits = false
  let writeOutput = false
  let listOnly = false

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    if (current === "--candidate") {
      const file = argv[index + 1]
      if (file) candidateFiles.push(file)
      index += 1
      continue
    }

    if (current === "--candidate-dir") {
      candidateDir = argv[index + 1] ?? null
      index += 1
      continue
    }

    if (current === "--prompt") {
      const promptId = argv[index + 1]
      if (promptId) promptIds.push(promptId)
      index += 1
      continue
    }

    if (current === "--context") {
      const contextId = argv[index + 1]
      if (contextId) contextIds.push(contextId)
      index += 1
      continue
    }

    if (current === "--baseline") {
      baselineReportPath = path.resolve(argv[index + 1] ?? baselineReportPath)
      index += 1
      continue
    }

    if (current === "--output") {
      outputDir = path.resolve(argv[index + 1] ?? outputDir)
      index += 1
      continue
    }

    if (current === "--worktree-root") {
      worktreeRoot = path.resolve(argv[index + 1] ?? ".bench-opt/worktrees")
      index += 1
      continue
    }

    if (current === "--evaluated-split") {
      evaluatedSplit = normalizeTrialSplit(argv[index + 1] ?? null)
      index += 1
      continue
    }

    if (current === "--promotion-splits") {
      promotionSplits = parsePromotionSplits(argv[index + 1] ?? null)
      index += 1
      continue
    }

    if (current === "--verify") {
      verificationEnabled = true
      continue
    }

    if (current === "--verification-package-manager") {
      verificationPackageManager = argv[index + 1] ?? null
      index += 1
      continue
    }

    if (current === "--verification-splits") {
      verificationBenchSplits = parseVerificationSplits(argv[index + 1] ?? null)
      index += 1
      continue
    }

    if (current === "--verification-no-type-check") {
      verificationIncludeTypeCheck = false
      continue
    }

    if (current === "--verification-no-tests") {
      verificationIncludeTests = false
      continue
    }

    if (current === "--orchestrate") {
      orchestrationEnabled = true
      continue
    }

    if (current === "--orchestration-objective") {
      orchestrationEnabled = true
      orchestrationObjective = argv[index + 1] ?? null
      index += 1
      continue
    }

    if (current === "--orchestration-follow-up") {
      orchestrationEnabled = true
      const next = argv[index + 1]
      orchestrationForcedFollowUp = next === "rerun" || next === "keep" || next === "reject" ? next : null
      index += 1
      continue
    }

    if (current === "--orchestration-max-iterations") {
      orchestrationEnabled = true
      const parsed = Number.parseInt(argv[index + 1] ?? "", 10)
      orchestrationMaxIterations = Number.isFinite(parsed) && parsed > 0 ? parsed : null
      index += 1
      continue
    }

    if (current === "--orchestration-no-rerun-continuation") {
      orchestrationEnabled = true
      orchestrationContinueOnRerun = false
      continue
    }

    if (current === "--orchestration-no-checkpoints") {
      orchestrationEnabled = true
      orchestrationRecordCheckpoints = false
      continue
    }

    if (current === "--session") {
      sessionEnabled = true
      continue
    }

    if (current === "--session-force-compaction") {
      sessionEnabled = true
      sessionForceCompaction = true
      continue
    }

    if (current === "--session-force-handoff") {
      sessionEnabled = true
      sessionForceHandoff = true
      continue
    }

    if (current === "--session-resume") {
      sessionEnabled = true
      sessionResumePath = path.resolve(argv[index + 1] ?? "")
      index += 1
      continue
    }

    if (current === "--session-checkpoint") {
      sessionEnabled = true
      sessionCheckpointPath = path.resolve(argv[index + 1] ?? "")
      index += 1
      continue
    }

    if (current === "--session-handoff") {
      sessionEnabled = true
      sessionHandoffPath = path.resolve(argv[index + 1] ?? "")
      index += 1
      continue
    }

    if (current === "--promotion-plan") {
      promotionPlanEnabled = true
      continue
    }

    if (current === "--promotion-live-passed") {
      promotionPlanEnabled = true
      promotionLivePassed = true
      continue
    }

    if (current === "--live") {
      liveEnabled = true
      continue
    }

    if (current === "--live-scenario") {
      liveEnabled = true
      liveScenarioId = argv[index + 1] ?? null
      index += 1
      continue
    }

    if (current === "--live-all") {
      liveEnabled = true
      liveRunAll = true
      continue
    }

    if (current === "--promotion-allow") {
      promotionPlanEnabled = true
      promotionAllow = true
      continue
    }

    if (current === "--publish-allow") {
      promotionPlanEnabled = true
      publishAllow = true
      continue
    }

    if (current === "--rollback-allow") {
      promotionPlanEnabled = true
      rollbackAllow = true
      continue
    }

    if (current === "--materialize") {
      materializeExecution = true
      continue
    }

    if (current === "--apply-edits") {
      applyStructuredEdits = true
      continue
    }

    if (current === "--write") {
      writeOutput = true
      continue
    }

    if (current === "--list") {
      listOnly = true
    }
  }

  return {
    candidateFiles,
    candidateDir,
    promptIds,
    contextIds,
    baselineReportPath,
    outputDir,
    worktreeRoot,
    evaluatedSplit,
    promotionSplits,
    verificationEnabled,
    verificationPackageManager,
    verificationIncludeTypeCheck,
    verificationIncludeTests,
    verificationBenchSplits,
    orchestrationEnabled,
    orchestrationObjective,
    orchestrationForcedFollowUp,
    orchestrationMaxIterations,
    orchestrationContinueOnRerun,
    orchestrationRecordCheckpoints,
    sessionEnabled,
    sessionForceCompaction,
    sessionForceHandoff,
    sessionResumePath,
    sessionCheckpointPath,
    sessionHandoffPath,
    promotionPlanEnabled,
    promotionLivePassed,
    liveEnabled,
    liveScenarioId,
    liveRunAll,
    promotionAllow,
    publishAllow,
    rollbackAllow,
    materializeExecution,
    applyStructuredEdits,
    writeOutput,
    listOnly,
  }
}

async function readJson<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf8")
  return JSON.parse(content) as T
}

async function tryReadJson<T>(filePath: string | null | undefined): Promise<T | null> {
  if (!filePath) {
    return null
  }

  try {
    return await readJson<T>(filePath)
  } catch {
    return null
  }
}

async function loadBenchOptResumeArtifacts(options: BenchOptRunnerSessionOptions | null) {
  const sessionState = await tryReadJson<BenchOptSessionState>(options?.resumeSessionPath)
  const checkpoint = await tryReadJson<BenchOptCheckpointArtifact>(options?.resumeCheckpointPath)
  const handoff = await tryReadJson<BenchOptSessionHandoffArtifact>(options?.resumeHandoffPath)

  return {
    sessionState,
    checkpoint,
    handoff,
  }
}

async function readCandidatePaths(candidateFiles: string[], candidateDir: string | null) {
  const resolved = new Set<string>()

  candidateFiles.forEach((candidateFile) => {
    resolved.add(path.resolve(candidateFile))
  })

  if (candidateDir) {
    const absoluteDir = path.resolve(candidateDir)
    const entries = await readdir(absoluteDir, { withFileTypes: true })
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .forEach((entry) => resolved.add(path.join(absoluteDir, entry.name)))
  }

  return [...resolved]
}

async function loadBaselineArtifacts(
  baselineReportPath: string,
): Promise<{
  report: BenchArtifactReportLike | null
  snapshot: BenchOptBaselineSnapshot
}> {
  try {
    const report = await readJson<BenchArtifactReportLike>(baselineReportPath)
    return {
      report,
      snapshot: normalizeBaseline(report, baselineReportPath),
    }
  } catch {
    return {
      report: null,
      snapshot: normalizeBaseline(null, path.resolve(baselineReportPath)),
    }
  }
}

function sanitizeId(value: string) {
  return value.replace(/[^a-zA-Z0-9._/-]+/g, "-")
}

type MaterializedCandidateSource = {
  prompt: PromptOptimizerCandidate
  context: ContextOptimizerCandidate
} | null

interface MaterializedCandidateRecord {
  candidate: BenchOptCandidate
  source: MaterializedCandidateSource
}

interface ScoredMaterializedCandidate extends BenchOptCandidateScore {
  source: MaterializedCandidateSource
}

function resolvePromptCandidates(promptIds: string[]) {
  const available = listOptimizerCandidates("prompt") as readonly PromptOptimizerCandidate[]
  if (promptIds.length === 0) {
    return available
  }

  const byId = new Map(available.map((candidate) => [candidate.id, candidate] as const))
  return promptIds
    .map((id) => byId.get(id))
    .filter((candidate): candidate is PromptOptimizerCandidate => Boolean(candidate))
}

function resolveContextCandidates(contextIds: string[]) {
  const available = listOptimizerCandidates("context") as readonly ContextOptimizerCandidate[]
  if (contextIds.length === 0) {
    return available
  }

  const byId = new Map(available.map((candidate) => [candidate.id, candidate] as const))
  return contextIds
    .map((id) => byId.get(id))
    .filter((candidate): candidate is ContextOptimizerCandidate => Boolean(candidate))
}

function materializeRegistryCandidate(
  promptCandidate: PromptOptimizerCandidate,
  contextCandidate: ContextOptimizerCandidate,
): MaterializedCandidateRecord {
  return {
    candidate: {
      id: `${sanitizeId(promptCandidate.id)}+${sanitizeId(contextCandidate.id)}`,
      promptCandidateId: promptCandidate.id,
      contextCandidateId: contextCandidate.id,
      prompt: promptCandidate.prompt,
      contextLines: [
        `prompt candidate: ${promptCandidate.id}`,
        `prompt label: ${promptCandidate.label}`,
        `prompt description: ${promptCandidate.description}`,
        `context candidate: ${contextCandidate.id}`,
        `context label: ${contextCandidate.label}`,
        `context description: ${contextCandidate.description}`,
        `context slots: ${contextCandidate.slots.join(", ")}`,
        ...(promptCandidate.tags && promptCandidate.tags.length > 0 ? [`prompt tags: ${promptCandidate.tags.join(", ")}`] : []),
        ...(contextCandidate.tags && contextCandidate.tags.length > 0 ? [`context tags: ${contextCandidate.tags.join(", ")}`] : []),
        ...(promptCandidate.surfaces && promptCandidate.surfaces.length > 0 ? [`prompt surfaces: ${promptCandidate.surfaces.join(", ")}`] : []),
        ...(contextCandidate.surfaces && contextCandidate.surfaces.length > 0 ? [`context surfaces: ${contextCandidate.surfaces.join(", ")}`] : []),
      ],
      notes: [
        `phase-1 registry candidate pair`,
        `prompt=${promptCandidate.id}`,
        `context=${contextCandidate.id}`,
      ],
      edits: [],
      worktree: {
        baseRef: "HEAD",
        branchPrefix: "codex/bench-opt",
        path: null,
        root: null,
      },
    },
    source: {
      prompt: promptCandidate,
      context: contextCandidate,
    },
  }
}

function materializeRegistryCandidates(promptIds: string[], contextIds: string[]) {
  const prompts = resolvePromptCandidates(promptIds)
  const contexts = resolveContextCandidates(contextIds)

  const candidates: MaterializedCandidateRecord[] = []
  prompts.forEach((promptCandidate) => {
    contexts.forEach((contextCandidate) => {
      candidates.push(materializeRegistryCandidate(promptCandidate, contextCandidate))
    })
  })

  return candidates
}

async function materializeExplicitCandidates(candidatePaths: string[]) {
  return Promise.all(
    candidatePaths.map(async (candidatePath) => {
      const candidate = await readJson<BenchOptCandidateInput>(candidatePath)
      return {
        candidate: {
          id: candidate.id,
          promptCandidateId: null,
          contextCandidateId: null,
          prompt: candidate.prompt ?? "",
          contextLines: Array.isArray(candidate.context)
            ? candidate.context
            : typeof candidate.context === "string"
              ? candidate.context.split(/\r?\n/).filter(Boolean)
              : [],
          notes: candidate.notes ?? [],
          edits: candidate.edits ?? [],
          worktree: {
            baseRef: candidate.worktree?.baseRef ?? "HEAD",
            branchPrefix: candidate.worktree?.branchPrefix ?? "codex/bench-opt",
            path: candidate.worktree?.path ?? null,
            root: candidate.worktree?.root ?? null,
          },
        } satisfies BenchOptCandidate,
        source: null,
      } satisfies MaterializedCandidateRecord
    }),
  )
}

const defaultPromptPolicy = promptCandidates[0]!.policy
const defaultContextPolicy = contextCandidates[0]!.policy
const defaultContextSlots = [...contextCandidates[0]!.slots]

function createResolvedPromptConfig(
  source: PromptOptimizerCandidate | null,
  candidate: BenchOptCandidate,
): BenchOptResolvedPromptConfig {
  if (!source) {
    return {
      id: candidate.promptCandidateId ?? `prompt/explicit/${sanitizeId(candidate.id)}`,
      label: "Explicit prompt candidate",
      description: "Resolved from explicit bench-opt JSON input using the default runtime prompt policy.",
      prompt: candidate.prompt,
      policy: { ...defaultPromptPolicy },
      tags: ["phase-1", "explicit-input"],
      surfaces: [],
    }
  }

  return {
    id: source.id,
    label: source.label,
    description: source.description,
    prompt: candidate.prompt,
    policy: { ...source.policy },
    tags: [...(source.tags ?? [])],
    surfaces: [...(source.surfaces ?? [])],
  }
}

function createResolvedContextConfig(
  source: ContextOptimizerCandidate | null,
  candidate: BenchOptCandidate,
): BenchOptResolvedContextConfig {
  if (!source) {
    return {
      id: candidate.contextCandidateId ?? `context/explicit/${sanitizeId(candidate.id)}`,
      label: "Explicit context candidate",
      description: "Resolved from explicit bench-opt JSON input using the default runtime context policy.",
      slots: defaultContextSlots,
      policy: { ...defaultContextPolicy },
      tags: ["phase-1", "explicit-input"],
      surfaces: [],
      lines: [...candidate.contextLines],
    }
  }

  return {
    id: source.id,
    label: source.label,
    description: source.description,
    slots: [...source.slots],
    policy: { ...source.policy },
    tags: [...(source.tags ?? [])],
    surfaces: [...(source.surfaces ?? [])],
    lines: [...candidate.contextLines],
  }
}

function buildResolvedOptimizerConfig(
  report: BenchOptRunReport,
  scoredCandidate: ScoredMaterializedCandidate,
  materializedCandidate: MaterializedCandidateRecord,
  options: {
    experiment?: BenchOptExperimentRun | null
    champion?: BenchOptChampionRecord | null
    store?: {
      experimentPath: string | null
      championPath: string | null
      indexPath: string | null
    }
  } = {},
): BenchOptResolvedOptimizerConfig {
  const resolvedPrompt = createResolvedPromptConfig(materializedCandidate.source?.prompt ?? null, scoredCandidate.candidate)
  const resolvedContext = createResolvedContextConfig(materializedCandidate.source?.context ?? null, scoredCandidate.candidate)

  return {
    schemaVersion: 1,
    runId: report.runId,
    generatedAt: report.generatedAt,
    sourceArtifacts: report.sourceArtifacts,
    selection: {
      candidateId: scoredCandidate.candidate.id,
      promptCandidateId: resolvedPrompt.id,
      contextCandidateId: resolvedContext.id,
      rank: 1,
      score: scoredCandidate.breakdown.total,
      breakdown: scoredCandidate.breakdown,
      alignmentMatches: [...scoredCandidate.alignmentMatches],
    },
    prompt: resolvedPrompt,
    context: resolvedContext,
    worktree: scoredCandidate.worktree,
    downstream: {
      benchLoop: {
        candidateId: scoredCandidate.candidate.id,
        promptCandidateId: resolvedPrompt.id,
        contextCandidateId: resolvedContext.id,
        prompt: scoredCandidate.candidate.prompt,
        contextLines: [...scoredCandidate.candidate.contextLines],
        repositoryRoot: scoredCandidate.worktree.repositoryRoot,
        baseRef: scoredCandidate.worktree.baseRef,
        branchName: scoredCandidate.worktree.branchName,
        worktreePath: scoredCandidate.worktree.path,
        command: [...scoredCandidate.worktree.command],
      },
    },
    ...(options.experiment ? {
      experiment: {
        experimentId: options.experiment.experimentId,
        championTrialId: options.experiment.championTrialId,
      },
    } : {}),
    ...(options.champion ? {
      champion: {
        championTrialId: options.champion.championTrialId,
        candidateId: options.champion.candidateId,
        status: options.champion.status,
        resolvedConfigPath: options.champion.resolvedConfigPath,
      },
    } : {}),
    ...(options.store ? {
      store: options.store,
    } : {}),
    notes: [...scoredCandidate.notes],
  }
}

function emptyReport(
  notes: string[],
  options: {
    evaluatedSplit?: BenchOptTrialSplit
    promotionSplits?: BenchOptTrialSplit[]
  } = {},
): BenchOptRunReport {
  return {
    schemaVersion: 1,
    runId: new Date().toISOString().replace(/[:.]/g, "-"),
    generatedAt: new Date().toISOString(),
    sourceArtifacts: {
      baselineReport: null,
      candidateFiles: [],
    },
    summary: {
      candidateCount: 0,
      baselineAvailable: false,
      bestCandidateId: null,
      bestScore: null,
      averageScore: null,
      evaluatedSplit: options.evaluatedSplit ?? "train",
      promotionSplits: options.promotionSplits ?? ["validation", "holdout"],
      notes,
    },
    baseline: normalizeBaseline(null, null),
    candidates: [],
  }
}

function renderSplitSummaryLine(label: string, value: BenchOptTrialSplit | readonly BenchOptTrialSplit[]) {
  const rendered = Array.isArray(value) ? (value.length > 0 ? value.join(", ") : "none") : value
  return `- ${label}: ${rendered}`
}

function renderMarkdown(report: BenchOptRunReport) {
  const lines: string[] = []
  lines.push("# Astra Bench Opt")
  lines.push("")
  lines.push(`- Run ID: \`${report.runId}\``)
  lines.push(`- Generated: ${report.generatedAt}`)
  lines.push(`- Candidate count: ${report.summary.candidateCount}`)
  lines.push(`- Baseline available: ${report.summary.baselineAvailable ? "yes" : "no"}`)
  if (report.baseline.path) {
    lines.push(`- Baseline path: \`${report.baseline.path}\``)
  }
  lines.push(`- Best candidate: ${report.summary.bestCandidateId ? `\`${report.summary.bestCandidateId}\`` : "none"}`)
  lines.push(`- Best score: ${report.summary.bestScore ?? "n/a"}`)
  lines.push(`- Average score: ${report.summary.averageScore ?? "n/a"}`)
  lines.push(renderSplitSummaryLine("Evaluated split", report.summary.evaluatedSplit))
  lines.push(renderSplitSummaryLine("Promotion splits", report.summary.promotionSplits))
  if (report.summary.notes.length > 0) {
    lines.push("")
    lines.push("## Notes")
    report.summary.notes.forEach((note) => lines.push(`- ${note}`))
  }
  lines.push("")
  lines.push("## Candidates")

  report.candidates.forEach((entry) => {
    lines.push(`### ${entry.candidate.id}`)
    lines.push(`- Score: ${entry.breakdown.total}`)
    lines.push(`- Prompt clarity: ${entry.breakdown.promptClarity}`)
    lines.push(`- Context coverage: ${entry.breakdown.contextCoverage}`)
    lines.push(`- Artifact alignment: ${entry.breakdown.artifactAlignment}`)
    lines.push(`- Structural signals: ${entry.breakdown.structuralSignals}`)
    lines.push(`- Penalties: ${entry.breakdown.penalties}`)
    lines.push(`- Prompt chars: ${entry.candidate.prompt.length}`)
    lines.push(`- Context lines: ${entry.candidate.contextLines.length}`)
    if (entry.alignmentMatches.length > 0) {
      lines.push(`- Alignment matches: ${entry.alignmentMatches.join(", ")}`)
    }
    lines.push(`- Worktree path: \`${entry.worktree.path}\``)
    lines.push(`- Worktree command: \`${entry.worktree.command.join(" ")}\``)
    lines.push("")
    if (entry.notes.length > 0) {
      entry.notes.forEach((note) => lines.push(`- ${note}`))
      lines.push("")
    }
  })

  return lines.join("\n")
}

function renderText(report: BenchOptRunReport) {
  const lines: string[] = []
  lines.push("Astra Bench Opt")
  lines.push(`Run ID: ${report.runId}`)
  lines.push(`Generated: ${report.generatedAt}`)
  lines.push(`Candidates: ${report.summary.candidateCount}`)
  lines.push(`Baseline: ${report.summary.baselineAvailable ? "available" : "missing"}`)
  lines.push(`Best candidate: ${report.summary.bestCandidateId ?? "none"} (${report.summary.bestScore ?? "n/a"})`)
  lines.push(`Average score: ${report.summary.averageScore ?? "n/a"}`)
  lines.push(`Evaluated split: ${report.summary.evaluatedSplit}`)
  lines.push(`Promotion splits: ${report.summary.promotionSplits.join(", ")}`)
  lines.push("")
  lines.push("Candidate scores:")
  report.candidates.forEach((entry) => {
    lines.push(`- ${entry.candidate.id}: ${entry.breakdown.total}`)
    lines.push(`  worktree: ${entry.worktree.path}`)
    lines.push(`  prompt/context: ${entry.candidate.prompt.length}/${entry.candidate.contextLines.length}`)
  })
  if (report.summary.notes.length > 0) {
    lines.push("")
    report.summary.notes.forEach((note) => lines.push(`Note: ${note}`))
  }
  return lines.join("\n")
}

function renderRegistryList() {
  const lines: string[] = []
  lines.push("Astra Bench Opt registry")
  lines.push("")
  lines.push("Prompt candidates:")
  promptCandidates.forEach((candidate) => {
    lines.push(`- ${candidate.id}: ${candidate.label}`)
  })
  lines.push("")
  lines.push("Context candidates:")
  contextCandidates.forEach((candidate) => {
    lines.push(`- ${candidate.id}: ${candidate.label} [${candidate.slots.join(", ")}]`)
  })
  return lines.join("\n")
}

function renderResolvedConfigMarkdown(resolved: BenchOptResolvedOptimizerConfig) {
  const lines: string[] = []
  lines.push("# Astra Bench Opt Resolved Config")
  lines.push("")
  lines.push(`- Run ID: \`${resolved.runId}\``)
  lines.push(`- Generated: ${resolved.generatedAt}`)
  lines.push(`- Candidate: \`${resolved.selection.candidateId}\``)
  lines.push(`- Prompt candidate: \`${resolved.selection.promptCandidateId}\``)
  lines.push(`- Context candidate: \`${resolved.selection.contextCandidateId}\``)
  lines.push(`- Score: ${resolved.selection.score}`)
  lines.push(`- Prompt policy: analysis=${resolved.prompt.policy.analysisMode}, tools=${resolved.prompt.policy.toolPolicy}, write-scope=${resolved.prompt.policy.writeScopeMode}`)
  lines.push(`- Context policy: ranking=${resolved.context.policy.rankingMode}, maxFiles=${resolved.context.policy.maxFiles}, maxLines=${resolved.context.policy.maxLinesPerFile}, history=${resolved.context.policy.preferHistory ? "preferred" : "trimmed"}`)
  lines.push(`- Worktree path: \`${resolved.worktree.path}\``)
  lines.push(`- Worktree command: \`${resolved.worktree.command.join(" ")}\``)
  lines.push("")
  lines.push("## Downstream bench loop input")
  lines.push(`- Prompt: ${resolved.downstream.benchLoop.prompt}`)
  lines.push(`- Context lines: ${resolved.downstream.benchLoop.contextLines.length}`)
  lines.push(`- Repository root: \`${resolved.downstream.benchLoop.repositoryRoot}\``)
  lines.push(`- Base ref: \`${resolved.downstream.benchLoop.baseRef}\``)
  lines.push(`- Branch name: \`${resolved.downstream.benchLoop.branchName}\``)
  lines.push(`- Worktree path: \`${resolved.downstream.benchLoop.worktreePath}\``)
  return lines.join("\n")
}

function renderExecutionSummary(execution: BenchOptExecutionResult) {
  const lines: string[] = []
  lines.push("## Opt-in candidate execution")
  lines.push(`- Candidate: \`${execution.candidateId}\``)
  lines.push(`- Worktree materialized: ${execution.materialization.executed ? "yes" : "no"}`)
  lines.push(`- Worktree path: \`${execution.materialization.materializedPath}\``)
  lines.push(`- Structured edits enabled: ${execution.edits.enabled ? "yes" : "no"}`)
  lines.push(`- Structured edits applied: ${execution.edits.applied ? "yes" : "no"}`)
  lines.push(`- Affected files: ${execution.edits.files.length > 0 ? execution.edits.files.map((file) => `\`${file}\``).join(", ") : "none"}`)
  if (execution.notes.length > 0) {
    lines.push("- Notes:")
    execution.notes.forEach((note) => lines.push(`  - ${note}`))
  }
  return lines.join("\n")
}

function renderOrchestrationSummary(orchestration: BenchOptOrchestrationArtifact) {
  const lines: string[] = []
  lines.push("## Opt-in orchestration")
  lines.push(`- Objective: ${orchestration.objective}`)
  lines.push(`- Candidate: \`${orchestration.planner.candidateScope.candidateId ?? "none"}\``)
  lines.push(`- Split: ${orchestration.planner.candidateScope.split}`)
  lines.push(`- Worktree path: \`${orchestration.generator.editScope.worktreePath ?? "none"}\``)
  lines.push(`- Planner/generator/evaluator: ${orchestration.planner.runId} / ${orchestration.generator.runId} / ${orchestration.evaluator.runId}`)
  lines.push(`- Decision: ${orchestration.decision.action} (${orchestration.decision.reason})`)
  lines.push(`- Handoff: ${orchestration.handoff.kind}`)
  return lines.join("\n")
}

function renderOrchestrationMarkdown(orchestration: BenchOptOrchestrationArtifact) {
  const lines: string[] = []
  lines.push("# Astra Bench Opt Orchestration")
  lines.push("")
  lines.push(`- Run ID: \`${orchestration.runId}\``)
  lines.push(`- Generated: ${orchestration.generatedAt}`)
  lines.push(`- Objective: ${orchestration.objective}`)
  lines.push(`- Bounded: ${orchestration.bounded ? "yes" : "no"}`)
  lines.push(`- Candidate: \`${orchestration.planner.candidateScope.candidateId ?? "none"}\``)
  lines.push(`- Split: ${orchestration.planner.candidateScope.split}`)
  lines.push(`- Worktree path: \`${orchestration.generator.editScope.worktreePath ?? "none"}\``)
  lines.push(`- Decision: ${orchestration.decision.action}`)
  lines.push(`- Handoff: ${orchestration.handoff.kind}`)
  lines.push("")
  lines.push("## Planner")
  lines.push(`- Objective: ${orchestration.planner.objective}`)
  lines.push(`- Candidate scope: ${orchestration.planner.candidateScope.candidateId ?? "none"}`)
  lines.push(`- Split: ${orchestration.planner.candidateScope.split}`)
  lines.push(`- Worktree path: ${orchestration.planner.candidateScope.worktreePath ?? "none"}`)
  lines.push("")
  lines.push("## Generator")
  lines.push(`- Proposed change: ${orchestration.generator.proposedChange}`)
  lines.push(`- Worktree path: ${orchestration.generator.editScope.worktreePath ?? "none"}`)
  lines.push(`- Branch name: ${orchestration.generator.editScope.branchName ?? "none"}`)
  lines.push(`- Preferred files: ${orchestration.generator.editScope.files.length > 0 ? orchestration.generator.editScope.files.join(", ") : "none"}`)
  lines.push("")
  lines.push("## Evaluator")
  lines.push(`- Score: ${orchestration.evaluator.score}`)
  lines.push(`- Verdict: ${orchestration.evaluator.verdict}`)
  lines.push(`- Recommendation: ${orchestration.evaluator.recommendation.action}`)
  lines.push(`- Handoff kind: ${orchestration.evaluator.handoff.kind}`)
  return lines.join("\n")
}

export function renderOrchestrationLoopSummary(loop: BenchOptOrchestrationLoopResult) {
  const lines: string[] = []
  lines.push("## Opt-in orchestration loop")
  lines.push(`- Max iterations: ${loop.maxIterations}`)
  lines.push(`- Completed iterations: ${loop.completedIterations}`)
  lines.push(`- Termination: ${loop.terminationReason}`)
  lines.push(`- Final decision: ${loop.finalDecision?.action ?? "none"}`)
  lines.push(`- Final handoff: ${loop.finalHandoff?.kind ?? "none"}`)
  loop.iterations.forEach((iteration) => {
    lines.push(`- Iteration ${iteration.index}: ${iteration.orchestration.decision.action} (${iteration.sessionPhase})`)
  })
  return lines.join("\n")
}

export function renderOrchestrationLoopMarkdown(loop: BenchOptOrchestrationLoopResult) {
  const lines: string[] = []
  lines.push("# Astra Bench Opt Orchestration Loop")
  lines.push("")
  lines.push(`- Run ID: \`${loop.runId}\``)
  lines.push(`- Generated: ${loop.generatedAt}`)
  lines.push(`- Objective: ${loop.objective}`)
  lines.push(`- Max iterations: ${loop.maxIterations}`)
  lines.push(`- Completed iterations: ${loop.completedIterations}`)
  lines.push(`- Termination: ${loop.terminationReason}`)
  lines.push(`- Final decision: ${loop.finalDecision?.action ?? "none"}`)
  lines.push(`- Final handoff: ${loop.finalHandoff?.kind ?? "none"}`)
  lines.push("")
  lines.push("## Iterations")
  loop.iterations.forEach((iteration) => {
    lines.push(`### Iteration ${iteration.index}`)
    lines.push(`- Decision: ${iteration.orchestration.decision.action}`)
    lines.push(`- Session phase: ${iteration.sessionPhase}`)
    lines.push(`- Checkpoint: ${iteration.checkpointId ?? "none"}`)
    lines.push(`- Compaction: ${iteration.compactionId ?? "none"}`)
    lines.push(`- Handoff: ${iteration.handoffId ?? "none"}`)
    lines.push("")
  })
  return lines.join("\n")
}

export async function runBenchOptOrchestrationLoop(
  report: BenchOptRunReport,
  baseline: BenchOptBaselineSnapshot,
  bestCandidate: ScoredMaterializedCandidate,
  execution: BenchOptExecutionResult | null,
  orchestrationOptions: BenchOptRunnerOrchestrationOptions,
  sessionOptions: BenchOptRunnerSessionOptions | null,
  artifactPaths: {
    sessionStatePath: string | null
    reportPath: string | null
    orchestrationPath: string | null
    orchestrationLoopPath: string | null
    promotionPath: string | null
    publishPlanPath: string | null
    rollbackPlanPath: string | null
  },
  resumeArtifacts: {
    sessionState: BenchOptSessionState | null
    checkpoint: BenchOptCheckpointArtifact | null
    handoff: BenchOptSessionHandoffArtifact | null
  },
  startedAtMs: number,
): Promise<{
  orchestration: BenchOptOrchestrationArtifact
  orchestrationLoop: BenchOptOrchestrationLoopResult
  orchestrationIterations: BenchOptOrchestrationArtifact[]
  session: BenchOptSessionArtifactsResult
}> {
  const sessionBudget = sessionOptions?.budgets?.maxIterations
  const defaultBudget = createBenchOptIterationBudget().maxIterations
  const maxIterations = Math.max(1, orchestrationOptions.maxIterations ?? sessionBudget ?? defaultBudget)
  const continueOnRerun = orchestrationOptions.continueOnRerun ?? true
  const recordCheckpoints = orchestrationOptions.recordCheckpoints ?? true
  const objective = orchestrationOptions.objective ?? `Bounded orchestration for selected candidate ${bestCandidate.candidate.id}.`
  const resumedFromSession = resumeArtifacts.sessionState
  let state = resumedFromSession
    ? resumeBenchOptSessionState(resumedFromSession, {
        runId: report.runId,
        objective: sessionOptions?.objective ?? resumeArtifacts.handoff?.nextSession.objective ?? objective,
        phase: "running",
        updatedAt: report.generatedAt,
        wallClockMs: Math.max(0, Date.now() - startedAtMs),
        notes: [
          `resumed from ${resumedFromSession.sessionId}`,
          ...(resumeArtifacts.handoff ? [`handoff ${resumeArtifacts.handoff.handoffId}`] : []),
          ...(resumeArtifacts.checkpoint ? [`checkpoint ${resumeArtifacts.checkpoint.checkpointId}`] : []),
        ],
        artifactPaths: [
          sessionOptions?.resumeSessionPath,
          sessionOptions?.resumeCheckpointPath,
          sessionOptions?.resumeHandoffPath,
        ].filter((value): value is string => Boolean(value)),
        resume: {
          checkpointId: resumeArtifacts.handoff?.checkpointId ?? resumeArtifacts.checkpoint?.checkpointId ?? resumedFromSession.resume.checkpointId,
          compactionId: resumeArtifacts.handoff?.compactionId ?? resumedFromSession.resume.compactionId,
          handoffId: resumeArtifacts.handoff?.handoffId ?? resumedFromSession.resume.handoffId,
        },
      })
    : createBenchOptSessionState({
        sessionId: `bench-opt-${report.runId}`,
        runId: report.runId,
        objective: sessionOptions?.objective ?? objective,
        createdAt: report.generatedAt,
        budgets: sessionOptions?.budgets,
        phase: "running",
        progress: {
          iteration: 0,
          completedIterations: 0,
          wallClockMs: Math.max(0, Date.now() - startedAtMs),
        },
      })

  const iterations: BenchOptOrchestrationLoopResult["iterations"] = []
  let latestOrchestration: BenchOptOrchestrationArtifact | null = null
  let latestCheckpoint: BenchOptCheckpointArtifact | null = null
  let latestCompaction: BenchOptCompactionMetadata | null = null
  let latestHandoff: BenchOptSessionHandoffArtifact | null = null
  let terminationReason = "bounded loop completed without iterations"

  const startingIteration = Math.max(1, state.progress.completedIterations + 1)
  for (let index = startingIteration; index < startingIteration + maxIterations; index += 1) {
    const wallClockMs = Math.max(0, Date.now() - startedAtMs)
    state = updateBenchOptSessionState(state, {
      phase: "running",
      iteration: index,
      completedIterations: index - 1,
      wallClockMs,
      notes: [`iteration ${index} candidate ${bestCandidate.candidate.id}`],
    })

    const orchestration = await runBenchOptOrchestration(
      {
        runId: report.runId,
        objective,
        baseline,
        split: orchestrationOptions.split ?? report.summary.evaluatedSplit,
        candidateId: orchestrationOptions.candidateId ?? bestCandidate.candidate.id,
        worktreePath: orchestrationOptions.worktreePath ?? execution?.materialization.materializedPath ?? bestCandidate.worktree.path,
        branchName: orchestrationOptions.branchName ?? bestCandidate.worktree.branchName,
        preferredFiles: orchestrationOptions.preferredFiles ?? [],
        constraints: orchestrationOptions.constraints ?? [],
        observedScore: orchestrationOptions.observedScore ?? bestCandidate.breakdown.total,
        forcedFollowUp: orchestrationOptions.forcedFollowUp ?? null,
      },
      orchestrationOptions.adapters,
    )
    latestOrchestration = orchestration

    let checkpointId: string | null = null
    let compactionId: string | null = null
    let handoffId: string | null = null

    if (recordCheckpoints) {
      latestCheckpoint = createBenchOptCheckpoint(state, {
        kind: orchestration.decision.action === "rerun" ? "handoff" : "snapshot",
        reason: `Iteration ${index} completed with ${orchestration.decision.action}.`,
        sessionStatePath: artifactPaths.sessionStatePath,
        reportPath: artifactPaths.reportPath,
        handoffPath: null,
        compactionPath: null,
        otherPaths: [
          artifactPaths.orchestrationPath,
          artifactPaths.orchestrationLoopPath,
          artifactPaths.promotionPath,
          artifactPaths.publishPlanPath,
          artifactPaths.rollbackPlanPath,
        ].filter((value): value is string => Boolean(value)),
        notes: [
          `iteration ${index}`,
          `candidate ${bestCandidate.candidate.id}`,
          `split ${orchestration.planner.candidateScope.split}`,
          `action ${orchestration.decision.action}`,
        ],
      })
      state = recordBenchOptCheckpoint(state, latestCheckpoint)
      checkpointId = latestCheckpoint.checkpointId
    }

    const budgetExhausted = index >= startingIteration + maxIterations - 1
    const sessionOverBudget = isBenchOptSessionOverBudget(state)
    const compactionRequested = orchestration.decision.action === "rerun" && (
      Boolean(sessionOptions?.forceCompaction)
      || Boolean(sessionOptions?.compactionTrigger && shouldBenchOptCompactSession(state, { trigger: sessionOptions.compactionTrigger }))
      || sessionOverBudget
    )

    let terminal = false

    if (compactionRequested) {
      latestCompaction = createBenchOptCompactionMetadata(state, {
        trigger: sessionOptions?.compactionTrigger ?? (sessionOverBudget ? "iteration-budget" : "manual"),
        strategy: sessionOptions?.forceCompaction ? "fresh-session" : "compact-context",
        retainedNotes: state.history.notes,
        carryForwardArtifactPaths: state.history.artifactPaths,
        retainedCheckpointId: checkpointId,
      })
      state = recordBenchOptCompaction(state, latestCompaction)
      state = updateBenchOptSessionState(state, {
        phase: "compacting",
        completedIterations: index,
        wallClockMs: Math.max(0, Date.now() - startedAtMs),
      })
      compactionId = latestCompaction.compactionId

      latestHandoff = createBenchOptSessionHandoffArtifact(state, {
        kind: sessionOptions?.forceCompaction ? "reset" : "resume",
        target: sessionOptions?.forceCompaction ? "fresh-session" : "same-session",
        checkpointId,
        compactionId,
        reason: latestOrchestration.handoff.reason,
        notes: state.history.notes,
        carryForwardArtifactPaths: state.history.artifactPaths,
      })
      state = recordBenchOptSessionHandoff(state, latestHandoff)
      state = updateBenchOptSessionState(state, {
        completedIterations: index,
        wallClockMs: Math.max(0, Date.now() - startedAtMs),
      })
      handoffId = latestHandoff.handoffId
      terminal = true
      terminationReason = sessionOptions?.forceCompaction
        ? "forced compaction requested during rerun path"
        : sessionOverBudget
          ? "session budget exhausted during rerun path"
          : "compaction trigger fired during rerun path"
    } else if (latestOrchestration.decision.action === "rerun" && (!continueOnRerun || budgetExhausted)) {
      state = updateBenchOptSessionState(state, {
        completedIterations: index,
        wallClockMs: Math.max(0, Date.now() - startedAtMs),
      })
      latestHandoff = createBenchOptSessionHandoffArtifact(state, {
        kind: "resume",
        target: "same-session",
        checkpointId,
        compactionId: state.resume.compactionId,
        reason: latestOrchestration.handoff.reason,
        notes: state.history.notes,
        carryForwardArtifactPaths: state.history.artifactPaths,
      })
      state = recordBenchOptSessionHandoff(state, latestHandoff)
      state = updateBenchOptSessionState(state, {
        completedIterations: index,
        wallClockMs: Math.max(0, Date.now() - startedAtMs),
      })
      handoffId = latestHandoff.handoffId
      terminal = true
      terminationReason = budgetExhausted
        ? "iteration cap reached with rerun recommendation"
        : "rerun continuation disabled"
    } else if (latestOrchestration.decision.action === "keep" || latestOrchestration.decision.action === "reject") {
      state = updateBenchOptSessionState(state, {
        phase: "completed",
        completedIterations: index,
        wallClockMs: Math.max(0, Date.now() - startedAtMs),
      })
      terminal = true
      terminationReason = `terminal evaluator decision: ${latestOrchestration.decision.action}`
    } else {
      state = updateBenchOptSessionState(state, {
        phase: "running",
        completedIterations: index,
        wallClockMs: Math.max(0, Date.now() - startedAtMs),
      })
      terminationReason = "rerun requested and budget remains"
    }

    iterations.push({
      index,
      orchestration,
      sessionPhase: state.phase,
      checkpointId,
      compactionId,
      handoffId,
      terminal,
    })

    if (terminal) {
      break
    }
  }

  if (!latestOrchestration) {
    throw new Error("Orchestration loop did not produce any iteration artifacts.")
  }

  if (state.phase !== "handoff" && state.phase !== "completed") {
    state = updateBenchOptSessionState(state, {
      phase: "completed",
      completedIterations: iterations.length,
      wallClockMs: Math.max(0, Date.now() - startedAtMs),
    })
  }

  const loop: BenchOptOrchestrationLoopResult = {
    schemaVersion: 1,
    runId: report.runId,
    generatedAt: new Date().toISOString(),
    bounded: true,
    objective,
    maxIterations,
    completedIterations: iterations.length,
    terminationReason,
    iterations,
    finalDecision: latestOrchestration.decision,
    finalHandoff: latestHandoff?.nextSession ? latestOrchestration.handoff : null,
  }

  return {
    orchestration: latestOrchestration,
    orchestrationLoop: loop,
    orchestrationIterations: iterations.map((iteration) => iteration.orchestration),
    session: {
      state,
      checkpoint: latestCheckpoint ?? createBenchOptCheckpoint(state),
      compaction: latestCompaction,
      handoff: latestHandoff,
    },
  }
}

function buildVerificationTrialReport(
  baselineReport: BenchArtifactReportLike | null,
  verification: BenchOptVerificationResult["execution"],
  runId: string,
): BenchOptStructuredReportLike {
  const baselineScenarios = baselineReport?.scenarios ?? []
  const scenarios = verification.commands.map((command: BenchOptVerificationCommandResult, index: number): NonNullable<BenchOptStructuredReportLike["scenarios"]>[number] => {
    const baselineScenario = baselineScenarios[index]
    const passed = command.status === "passed"
    return {
      id: baselineScenario?.id ?? `verification/${command.kind}/${command.id}`,
      title: baselineScenario?.title ?? command.label ?? command.id,
      task: baselineScenario?.task ?? `verification ${command.kind}`,
      surface: baselineScenario?.surface ?? "bench-opt-verification",
      fixture: baselineScenario?.fixture ?? command.split ?? command.cwd,
      evaluation: {
        total: passed ? 100 : 0,
        pass: passed,
        scores: {
          commandStatus: passed ? 1 : 0,
          durationMs: Math.max(0, 100 - Math.min(100, Math.round(command.durationMs / 10))),
        },
      },
    }
  })

  const totalScenarios = scenarios.length
  const passedScenarios = scenarios.reduce((count: number, scenario: NonNullable<BenchOptStructuredReportLike["scenarios"]>[number]) => count + (scenario.evaluation?.pass ? 1 : 0), 0)
  const failedScenarios = Math.max(0, totalScenarios - passedScenarios)
  const averageTotal = totalScenarios > 0
    ? scenarios.reduce((sum: number, scenario: NonNullable<BenchOptStructuredReportLike["scenarios"]>[number]) => sum + (scenario.evaluation?.total ?? 0), 0) / totalScenarios
    : null
  const baselineAverage = baselineReport?.summary?.averageTotal ?? null

  return {
    runId,
    generatedAt: verification.endedAt,
    summary: {
      totalScenarios,
      passedScenarios,
      failedScenarios,
      averageTotal: averageTotal ?? undefined,
    },
    comparison: {
      previousRunId: baselineReport?.runId ?? null,
      previousGeneratedAt: baselineReport?.generatedAt ?? null,
      overallDelta: baselineAverage !== null && averageTotal !== null ? averageTotal - baselineAverage : null,
      regressions: verification.failedCount,
      improvements: verification.passedCount,
      unchanged: verification.skippedCount,
      added: Math.max(0, scenarios.length - baselineScenarios.length),
    },
    scenarios,
  }
}

function renderVerificationSummary(
  verification: BenchOptExecutionVerificationResult,
  keepReject: BenchOptExecutionResult["keepReject"],
) {
  const lines: string[] = []
  lines.push("## Opt-in verification")
  lines.push(`- Status: ${verification.execution.status}`)
  lines.push(`- Worktree path: \`${verification.execution.execution.worktreePath}\``)
  lines.push(`- Commands scheduled: ${verification.execution.execution.commandCount}`)
  lines.push(`- Commands passed: ${verification.execution.execution.passedCount}`)
  lines.push(`- Commands failed: ${verification.execution.execution.failedCount}`)
  lines.push(`- Commands timed out: ${verification.execution.execution.timedOutCount}`)
  lines.push(`- Commands errored: ${verification.execution.execution.erroredCount}`)
  lines.push(`- Commands skipped: ${verification.execution.execution.skippedCount}`)
  if (verification.execution.execution.failureCommandId) {
    lines.push(`- Failure command: \`${verification.execution.execution.failureCommandId}\``)
  }
  lines.push(`- Trial scenarios: ${verification.trialReport.summary?.totalScenarios ?? 0}`)
  if (keepReject) {
    lines.push("## Keep/reject comparison")
    lines.push(`- Decision: ${keepReject.decision}`)
    lines.push(`- Average delta: ${keepReject.signals.averageDelta ?? "n/a"}`)
    lines.push(`- Comparable scenarios: ${keepReject.signals.comparableScenarios}`)
    lines.push(`- Regressions: ${keepReject.signals.regressions}`)
    lines.push(`- Improvements: ${keepReject.signals.improvements}`)
  }
  if (verification.notes.length > 0) {
    lines.push("- Notes:")
    verification.notes.forEach((note) => lines.push(`  - ${note}`))
  }
  if (keepReject?.reasons.length) {
    lines.push("- Comparison reasons:")
    keepReject.reasons.forEach((reason) => lines.push(`  - ${reason}`))
  }
  return lines.join("\n")
}

function collectVerificationChecks(verification: BenchOptExecutionVerificationResult | null | undefined) {
  const required = new Set<string>()
  const passed = new Set<string>()
  verification?.plan.commands.forEach((commandSpec, index) => {
    const command = verification.execution.execution.commands[index]

    if (commandSpec.kind === "type-check") {
      required.add("type-check")
      if (command?.status === "passed") {
        passed.add("type-check")
      }
      return
    }

    if (commandSpec.kind === "tests") {
      required.add("tests")
      if (command?.status === "passed") {
        passed.add("tests")
      }
      return
    }

    if (commandSpec.kind === "bench" && commandSpec.split) {
      const checkId = `bench:${commandSpec.split}`
      required.add(checkId)
      if (command?.status === "passed") {
        passed.add(checkId)
      }
    }
  })

  return {
    required: [...required],
    passed: [...passed],
  }
}

function renderSessionSummary(session: BenchOptSessionArtifactsResult) {
  const lines: string[] = []
  lines.push("## Opt-in session lifecycle")
  lines.push(`- Session: \`${session.state.sessionId}\``)
  lines.push(`- Phase: ${session.state.phase}`)
  lines.push(`- Iteration: ${session.state.progress.iteration}`)
  lines.push(`- Completed iterations: ${session.state.progress.completedIterations}`)
  lines.push(`- Wall clock ms: ${session.state.progress.wallClockMs}`)
  lines.push(`- Checkpoint: \`${session.checkpoint.checkpointId}\``)
  if (session.compaction) {
    lines.push(`- Compaction: \`${session.compaction.compactionId}\` (${session.compaction.trigger})`)
  }
  if (session.handoff) {
    lines.push(`- Handoff: \`${session.handoff.handoffId}\` (${session.handoff.kind}/${session.handoff.target})`)
  }
  return lines.join("\n")
}

function renderSessionMarkdown(session: BenchOptSessionArtifactsResult) {
  const lines: string[] = []
  lines.push("# Astra Bench Opt Session")
  lines.push("")
  lines.push(`- Session ID: \`${session.state.sessionId}\``)
  lines.push(`- Run ID: \`${session.state.runId}\``)
  lines.push(`- Phase: ${session.state.phase}`)
  lines.push(`- Objective: ${session.state.objective}`)
  lines.push(`- Iteration: ${session.state.progress.iteration}`)
  lines.push(`- Completed iterations: ${session.state.progress.completedIterations}`)
  lines.push(`- Wall clock ms: ${session.state.progress.wallClockMs}`)
  lines.push("")
  lines.push("## Checkpoint")
  lines.push(`- ID: \`${session.checkpoint.checkpointId}\``)
  lines.push(`- Kind: ${session.checkpoint.kind}`)
  lines.push(`- Reason: ${session.checkpoint.reason}`)
  if (session.compaction) {
    lines.push("")
    lines.push("## Compaction")
    lines.push(`- ID: \`${session.compaction.compactionId}\``)
    lines.push(`- Trigger: ${session.compaction.trigger}`)
    lines.push(`- Strategy: ${session.compaction.strategy}`)
    lines.push(`- Reason: ${session.compaction.reason}`)
  }
  if (session.handoff) {
    lines.push("")
    lines.push("## Handoff")
    lines.push(`- ID: \`${session.handoff.handoffId}\``)
    lines.push(`- Kind: ${session.handoff.kind}`)
    lines.push(`- Target: ${session.handoff.target}`)
    lines.push(`- Reason: ${session.handoff.reason}`)
  }
  return lines.join("\n")
}

function renderPromotionSummary(
  promotion: BenchOptPromotionDecision,
  publishPlan: BenchOptPublishPlan,
  rollbackPlan: BenchOptRollbackPlan,
) {
  const lines: string[] = []
  lines.push("## Opt-in promotion planning")
  lines.push(`- Promotion status: ${promotion.status}`)
  lines.push(`- Promotion channel: ${promotion.channel}`)
  lines.push(`- Publish status: ${publishPlan.status}`)
  lines.push(`- Rollback status: ${rollbackPlan.status}`)
  lines.push(`- Missing splits: ${promotion.gate.missingSplits.length > 0 ? promotion.gate.missingSplits.join(", ") : "none"}`)
  lines.push(`- Missing checks: ${promotion.gate.missingChecks.length > 0 ? promotion.gate.missingChecks.join(", ") : "none"}`)
  return lines.join("\n")
}

function renderPromotionMarkdown(
  promotion: BenchOptPromotionDecision,
  publishPlan: BenchOptPublishPlan,
  rollbackPlan: BenchOptRollbackPlan,
) {
  const lines: string[] = []
  lines.push("# Astra Bench Opt Promotion")
  lines.push("")
  lines.push(`- Run ID: \`${promotion.runId}\``)
  lines.push(`- Candidate: \`${promotion.candidateId}\``)
  lines.push(`- Status: ${promotion.status}`)
  lines.push(`- Channel: ${promotion.channel}`)
  lines.push(`- Promote: ${promotion.promote ? "yes" : "no"}`)
  lines.push(`- Missing splits: ${promotion.gate.missingSplits.length > 0 ? promotion.gate.missingSplits.join(", ") : "none"}`)
  lines.push(`- Missing checks: ${promotion.gate.missingChecks.length > 0 ? promotion.gate.missingChecks.join(", ") : "none"}`)
  lines.push("")
  lines.push("## Publish plan")
  lines.push(`- Status: ${publishPlan.status}`)
  lines.push(`- Branch: ${publishPlan.branch.name ?? "none"}`)
  lines.push(`- Canary: ${publishPlan.canary.environment ?? "none"}`)
  lines.push("")
  lines.push("## Rollback plan")
  lines.push(`- Status: ${rollbackPlan.status}`)
  lines.push(`- Trigger: ${rollbackPlan.trigger}`)
  lines.push(`- Target branch: ${rollbackPlan.targets.branchName ?? "none"}`)
  return lines.join("\n")
}

function buildSessionArtifacts(
  report: BenchOptRunReport,
  options: BenchOptRunnerSessionOptions,
  context: {
    bestCandidateId: string | null
    execution: BenchOptExecutionResult | null
    orchestration: BenchOptOrchestrationArtifact | null
    artifactPaths: {
      sessionStatePath: string | null
      reportPath: string | null
      orchestrationPath: string | null
      orchestrationLoopPath: string | null
      promotionPath: string | null
      publishPlanPath: string | null
      rollbackPlanPath: string | null
    }
    startedAtMs: number
  },
): BenchOptSessionArtifactsResult {
  const notePrefix = options.notePrefix?.trim()
  const notes = [
    context.bestCandidateId ? `selected candidate ${context.bestCandidateId}` : "no candidate selected",
    context.execution ? `execution materialized=${context.execution.materialization.executed}` : "execution not requested",
    context.orchestration ? `orchestration decision ${context.orchestration.decision.action}` : "orchestration not requested",
  ].map((note) => (notePrefix ? `${notePrefix}: ${note}` : note))
  const wallClockMs = Math.max(0, Date.now() - context.startedAtMs)

  let state = createBenchOptSessionState({
    sessionId: `bench-opt-${report.runId}`,
    runId: report.runId,
    objective: options.objective ?? context.orchestration?.objective ?? `Evaluate and verify optimizer candidate ${context.bestCandidateId ?? "none"}.`,
    createdAt: report.generatedAt,
    updatedAt: new Date().toISOString(),
    phase: context.orchestration ? "running" : "completed",
    budgets: options.budgets,
    progress: {
      iteration: 1,
      completedIterations: 1,
      wallClockMs,
    },
  })

  state = updateBenchOptSessionState(state, {
    phase: context.orchestration ? "running" : "completed",
    notes,
    artifactPaths: [
      context.artifactPaths.reportPath,
      context.artifactPaths.orchestrationPath,
      context.artifactPaths.orchestrationLoopPath,
      context.artifactPaths.promotionPath,
      context.artifactPaths.publishPlanPath,
      context.artifactPaths.rollbackPlanPath,
    ].filter((value): value is string => Boolean(value)),
    wallClockMs,
    completedIterations: 1,
  })

  const checkpoint = createBenchOptCheckpoint(state, {
    kind: context.orchestration ? "handoff" : "snapshot",
    reason: context.orchestration
      ? `Checkpoint before ${context.orchestration.decision.action} handoff.`
      : "Checkpoint after bounded bench-opt run completion.",
    sessionStatePath: context.artifactPaths.sessionStatePath,
    reportPath: context.artifactPaths.reportPath,
    handoffPath: null,
    compactionPath: null,
    otherPaths: [
      context.artifactPaths.orchestrationPath,
      context.artifactPaths.orchestrationLoopPath,
      context.artifactPaths.promotionPath,
      context.artifactPaths.publishPlanPath,
      context.artifactPaths.rollbackPlanPath,
    ].filter((value): value is string => Boolean(value)),
    notes,
  })
  state = recordBenchOptCheckpoint(state, checkpoint)

  let compaction: BenchOptCompactionMetadata | null = null
  const compactionRequested = options.forceCompaction
    || (options.compactionTrigger
      ? shouldBenchOptCompactSession(state, { trigger: options.compactionTrigger })
      : false)

  if (compactionRequested) {
    compaction = createBenchOptCompactionMetadata(state, {
      trigger: options.compactionTrigger,
      retainedNotes: state.history.notes,
      carryForwardArtifactPaths: state.history.artifactPaths,
      retainedCheckpointId: checkpoint.checkpointId,
    })
    state = recordBenchOptCompaction(state, compaction)
    state = updateBenchOptSessionState(state, { phase: "compacting" })
  }

  let handoff: BenchOptSessionHandoffArtifact | null = null
  const shouldHandoff = options.forceHandoff || context.orchestration?.handoff.kind === "rerun"
  if (shouldHandoff) {
    handoff = createBenchOptSessionHandoffArtifact(state, {
      kind: context.orchestration?.handoff.kind === "rerun" ? "resume" : "reset",
      target: context.orchestration?.handoff.kind === "rerun" ? "same-session" : "fresh-session",
      checkpointId: checkpoint.checkpointId,
      compactionId: compaction?.compactionId ?? state.resume.compactionId,
      reason: context.orchestration?.handoff.reason ?? "Runner requested bounded handoff.",
      notes: state.history.notes,
      carryForwardArtifactPaths: state.history.artifactPaths,
    })
    state = recordBenchOptSessionHandoff(state, handoff)
  } else {
    state = updateBenchOptSessionState(state, { phase: "completed" })
  }

  return {
    state,
    checkpoint,
    compaction,
    handoff,
  }
}

export function printBenchOptHelp() {
  console.log("Astra Bench Opt CLI")
  console.log("Usage: pnpm bench:opt -- [options]")
  console.log("")
  console.log("Options:")
  console.log("  --list                  List built-in phase-1 prompt/context candidates")
  console.log("  --prompt <id>           Select a built-in prompt candidate (repeatable)")
  console.log("  --context <id>          Select a built-in context candidate (repeatable)")
  console.log("  --candidate <file>      Candidate JSON file (repeatable)")
  console.log("  --candidate-dir <dir>   Load every .json file in a directory")
  console.log("  --baseline <file>       Existing bench artifact report (default: data/bench-results/latest.json)")
  console.log("  --output <dir>          Output directory for bench-opt artifacts (default: data/bench-opt-results)")
  console.log("  --worktree-root <dir>   Base directory for candidate worktrees")
  console.log("  --evaluated-split <s>   Treat the current run as train|validation|holdout (defaults to baseline split or train)")
  console.log("  --promotion-splits <s>  Comma-separated promotion gate splits (default: validation,holdout)")
  console.log("  --verify                Run bounded verification after materialization/apply")
  console.log("  --verification-package-manager <pm>  Package manager/executable for verification commands")
  console.log("  --verification-splits <s>  Comma-separated bench splits for verification")
  console.log("  --verification-no-type-check  Skip the type-check verification command")
  console.log("  --verification-no-tests  Skip the test verification command")
  console.log("  --orchestrate           Emit bounded orchestration artifacts for the selected candidate")
  console.log("  --orchestration-objective <text>  Override the orchestration objective")
  console.log("  --orchestration-follow-up <rerun|keep|reject>  Force evaluator follow-up for bounded loop testing")
  console.log("  --orchestration-max-iterations <n>  Bound the orchestration loop iteration count")
  console.log("  --orchestration-no-rerun-continuation  Stop after a rerun recommendation instead of continuing")
  console.log("  --orchestration-no-checkpoints  Disable per-iteration checkpoint recording")
  console.log("  --session               Emit bounded session/checkpoint artifacts for this run")
  console.log("  --session-force-compaction  Force a compaction artifact for the emitted session")
  console.log("  --session-force-handoff  Force a handoff artifact for the emitted session")
  console.log("  --session-resume <file>  Resume a prior session state JSON before running")
  console.log("  --session-checkpoint <file>  Load a prior checkpoint artifact for resume metadata")
  console.log("  --session-handoff <file>  Load a prior handoff artifact for resume metadata")
  console.log("  --live                  Run the opt-in bench-live evaluator and persist latest.live.*")
  console.log("  --live-scenario <id>    Run a specific bench-live scenario (default: first registered)")
  console.log("  --live-all              Run all registered non-placeholder live scenarios and aggregate")
  console.log("  --promotion-plan        Emit promotion/publish/rollback planning artifacts")
  console.log("  --promotion-live-passed Mark the live evaluator gate as passed for promotion planning")
  console.log("  --promotion-allow       Explicitly allow promotion when all gates pass")
  console.log("  --publish-allow         Mark downstream publish execution as allowed in the dry-run plan")
  console.log("  --rollback-allow        Mark downstream rollback execution as allowed in the dry-run plan")
  console.log("  --materialize           Create the winning worktree for the selected candidate")
  console.log("  --apply-edits           Apply structured candidate edits inside the materialized worktree")
  console.log("  --write                 Write latest.json, latest.md, and the resolved config artifact")
  console.log("  -h, --help              Show this help")
}

export async function runBenchOpt(
  argv: string[] = process.argv.slice(2),
  options: BenchOptRunOptions = {},
): Promise<BenchOptRunResult> {
  const startedAtMs = Date.now()
  const telemetry = createTelemetryCollector({ sessionId: `run-${Date.now()}` })
  telemetry.recordIterationStart(0)
  const logger = createLogger(`run-${Date.now()}`, { enableConsole: true })
  logger.info("Starting bench-opt run")
  const args = argv.slice()
  if (args.includes("--help") || args.includes("-h")) {
    printBenchOptHelp()
    return {
      report: emptyReport([]),
      session: null,
      promotion: null,
      publishPlan: null,
      rollbackPlan: null,
      text: "",
      paths: null,
    }
  }

  const {
    candidateFiles,
    candidateDir,
    promptIds,
    contextIds,
    baselineReportPath,
    outputDir,
    worktreeRoot,
    evaluatedSplit,
    promotionSplits,
    verificationEnabled,
    verificationPackageManager,
    verificationIncludeTypeCheck,
    verificationIncludeTests,
    verificationBenchSplits,
    orchestrationEnabled,
    orchestrationObjective,
    orchestrationForcedFollowUp,
    orchestrationMaxIterations,
    orchestrationContinueOnRerun,
    orchestrationRecordCheckpoints,
    sessionEnabled,
    sessionForceCompaction,
    sessionForceHandoff,
    sessionResumePath,
    sessionCheckpointPath,
    sessionHandoffPath,
    promotionPlanEnabled,
    promotionLivePassed,
    liveEnabled,
    liveScenarioId,
    liveRunAll,
    promotionAllow,
    publishAllow,
    rollbackAllow,
    materializeExecution,
    applyStructuredEdits,
    writeOutput,
    listOnly,
  } = parseArgs(args)

  if (listOnly) {
    return {
      report: emptyReport(["Listed phase-1 optimizer registry candidates."], {
        evaluatedSplit: evaluatedSplit ?? "train",
        promotionSplits: promotionSplits ?? ["validation", "holdout"],
      }),
      session: null,
      promotion: null,
      publishPlan: null,
      rollbackPlan: null,
      text: renderRegistryList(),
      paths: null,
    }
  }

  const candidatePaths = await readCandidatePaths(candidateFiles, candidateDir)
  const materializedCandidates = candidatePaths.length > 0
    ? await materializeExplicitCandidates(candidatePaths)
    : materializeRegistryCandidates(promptIds, contextIds)

  if (materializedCandidates.length === 0) {
    throw new Error("No optimizer candidates were resolved. Use --list to inspect built-in candidates or pass --candidate/--candidate-dir.")
  }

  const baselineArtifacts = await loadBaselineArtifacts(baselineReportPath)
  const baseline = baselineArtifacts.snapshot
  const resolvedEvaluatedSplit = evaluatedSplit ?? (materializedCandidates.length > 1 ? "holdout" : baseline.split ?? "train")
  const resolvedPromotionSplits = promotionSplits ?? (materializedCandidates.length > 1 ? ["validation", "holdout"] : ["train"])
  const configuredVerification = options.verification ? options.verification : null
  const configuredSession = options.session ? options.session : null
  const configuredPromotion = options.promotion ? options.promotion : null
  const configuredLive = options.live ? options.live : null
  const verificationRequested = options.verification === false ? false : verificationEnabled || configuredVerification !== null
  const sessionRequested = options.session === false ? false : sessionEnabled || configuredSession !== null
  const promotionRequested = options.promotion === false ? false : promotionPlanEnabled || configuredPromotion !== null
  const liveRequested = options.live === false ? false : liveEnabled || configuredLive !== null
  const resolvedVerificationOptions: BenchOptRunnerVerificationOptions | null = verificationRequested
    ? {
        packageManager: configuredVerification?.packageManager ?? verificationPackageManager ?? "pnpm",
        includeTypeCheck: configuredVerification?.includeTypeCheck ?? verificationIncludeTypeCheck,
        includeTests: configuredVerification?.includeTests ?? verificationIncludeTests,
        benchSplits: configuredVerification?.benchSplits ?? verificationBenchSplits ?? undefined,
        typeCheckArgs: configuredVerification?.typeCheckArgs,
        testArgs: configuredVerification?.testArgs,
        benchArgs: configuredVerification?.benchArgs,
        commandTimeoutMs: configuredVerification?.commandTimeoutMs,
        defaultTimeoutMs: configuredVerification?.defaultTimeoutMs,
        defaultMaxOutputBytes: configuredVerification?.defaultMaxOutputBytes,
        stopOnFailure: configuredVerification?.stopOnFailure,
        env: configuredVerification?.env,
      }
    : null
  const resolvedKeepRejectOptions: BenchOptRunnerKeepRejectOptions | null = verificationRequested
    ? (options.keepReject === false ? null : options.keepReject ?? {})
    : null
  const resolvedOrchestrationOptions = normalizeOrchestrationOptions(
    options.orchestration
      ?? (orchestrationEnabled
        ? {
            objective: orchestrationObjective ?? undefined,
            forcedFollowUp: orchestrationForcedFollowUp,
            maxIterations: orchestrationMaxIterations ?? undefined,
            continueOnRerun: orchestrationContinueOnRerun,
            recordCheckpoints: orchestrationRecordCheckpoints,
          }
        : undefined),
  )
  const resolvedSessionOptions: BenchOptRunnerSessionOptions | null = sessionRequested
    ? {
        objective: configuredSession?.objective,
        budgets: configuredSession?.budgets,
        forceCompaction: configuredSession?.forceCompaction ?? sessionForceCompaction,
        compactionTrigger: configuredSession?.compactionTrigger,
        forceHandoff: configuredSession?.forceHandoff ?? sessionForceHandoff,
        notePrefix: configuredSession?.notePrefix,
        resumeSessionPath: configuredSession?.resumeSessionPath ?? sessionResumePath,
        resumeCheckpointPath: configuredSession?.resumeCheckpointPath ?? sessionCheckpointPath,
        resumeHandoffPath: configuredSession?.resumeHandoffPath ?? sessionHandoffPath,
      }
    : null
  const resumeArtifacts = await loadBenchOptResumeArtifacts(resolvedSessionOptions)
  const resolvedLiveOptions: BenchOptRunnerLiveOptions | null = liveRequested
    ? {
        scenarioId: configuredLive?.scenarioId ?? liveScenarioId,
        runAll: configuredLive?.runAll ?? liveRunAll,
      }
    : null
  const resolvedPromotionOptions: BenchOptRunnerPromotionOptions | null = promotionRequested
    ? {
        allowPromotion: configuredPromotion?.allowPromotion ?? promotionAllow,
        liveEvaluatorPassed: configuredPromotion?.liveEvaluatorPassed ?? promotionLivePassed,
        requiredChecks: configuredPromotion?.requiredChecks,
        passedChecks: configuredPromotion?.passedChecks,
        requireCanary: configuredPromotion?.requireCanary,
        defaultChannel: configuredPromotion?.defaultChannel,
        branchName: configuredPromotion?.branchName,
        pullRequestUrl: configuredPromotion?.pullRequestUrl,
        canaryEnvironment: configuredPromotion?.canaryEnvironment,
        trialSummaryPath: configuredPromotion?.trialSummaryPath,
        allowPublish: configuredPromotion?.allowPublish ?? publishAllow,
        enableBranchCreation: configuredPromotion?.enableBranchCreation,
        openPullRequest: configuredPromotion?.openPullRequest,
        enableCanary: configuredPromotion?.enableCanary,
        defaultBranchPrefix: configuredPromotion?.defaultBranchPrefix,
        defaultBaseRef: configuredPromotion?.defaultBaseRef,
        pullRequestTitle: configuredPromotion?.pullRequestTitle,
        pullRequestBody: configuredPromotion?.pullRequestBody,
        canaryStrategy: configuredPromotion?.canaryStrategy,
        allowRollback: configuredPromotion?.allowRollback ?? rollbackAllow,
        rollbackTrigger: configuredPromotion?.rollbackTrigger,
        rollbackReason: configuredPromotion?.rollbackReason,
        failedChecks: configuredPromotion?.failedChecks,
      }
    : null
  const candidates: ScoredMaterializedCandidate[] = materializedCandidates.map((entry) => ({
    ...scoreCandidate(entry.candidate, baseline, {
      repositoryRoot: entry.candidate.worktree.root ?? undefined,
      worktreeRoot,
      dryRun: true,
    }),
    source: entry.source,
  }))

  candidates.sort((a, b) => compareCandidateScores(a, b))

  const bestCandidate = candidates[0] ?? null
  const bestMaterializedCandidate = bestCandidate
    ? materializedCandidates.find((entry) => entry.candidate.id === bestCandidate.candidate.id) ?? null
    : null
  const averageScore = candidates.length > 0
    ? Math.round(candidates.reduce((sum, candidate) => sum + candidate.breakdown.total, 0) / candidates.length)
    : null
  const report: BenchOptRunReport = {
    schemaVersion: 1,
    runId: new Date().toISOString().replace(/[:.]/g, "-"),
    generatedAt: new Date().toISOString(),
    sourceArtifacts: {
      baselineReport: baseline.available ? path.resolve(baselineReportPath) : null,
      candidateFiles: candidatePaths,
    },
    summary: {
      candidateCount: candidates.length,
      baselineAvailable: baseline.available,
      bestCandidateId: bestCandidate?.candidate.id ?? null,
      bestScore: bestCandidate?.breakdown.total ?? null,
      averageScore,
      evaluatedSplit: resolvedEvaluatedSplit,
      promotionSplits: resolvedPromotionSplits,
      notes: [
        ...(baseline.available ? [] : [`Baseline report not found at ${path.resolve(baselineReportPath)}.`]),
        ...(candidatePaths.length > 0 ? ["Loaded optimizer candidates from JSON inputs."] : ["Materialized optimizer candidates from the built-in phase-1 prompt/context registry."]),
        `Bench-opt run is scored against the ${resolvedEvaluatedSplit} split view.`,
        "Phase 2 optimizer runner is read-only by default; use --write to persist bench-opt artifacts.",
      ],
    },
    baseline,
    candidates: candidates.map(({ source, ...entry }) => entry),
  }

  const experiment = createBenchOptExperimentRun(report, candidates.map(({ source, ...entry }) => entry))
  let champion: BenchOptChampionRecord | null = null
  let resolvedConfig = bestCandidate && bestMaterializedCandidate
    ? buildResolvedOptimizerConfig(report, bestCandidate, bestMaterializedCandidate)
    : null
  let execution: BenchOptExecutionResult | null = null
  let live: LiveEvaluationResult | null = null
  let orchestration: BenchOptOrchestrationArtifact | null = null
  let orchestrationLoop: BenchOptOrchestrationLoopResult | null = null
  let orchestrationIterations: BenchOptOrchestrationArtifact[] | null = null
  let session: BenchOptSessionArtifactsResult | null = null
  let promotion: BenchOptPromotionDecision | null = null
  let publishPlan: BenchOptPublishPlan | null = null
  let rollbackPlan: BenchOptRollbackPlan | null = null

  if (applyStructuredEdits && !materializeExecution) {
    throw new Error("Structured edits require --materialize so they can be applied inside an isolated worktree.")
  }

  if (materializeExecution || applyStructuredEdits) {
    if (!bestCandidate || !bestMaterializedCandidate) {
      throw new Error("Cannot materialize candidate execution without a selected candidate.")
    }

    execution = await executeMaterializedCandidate(bestMaterializedCandidate.candidate, {
      repositoryRoot: bestMaterializedCandidate.candidate.worktree.root ?? undefined,
      worktreeRoot,
      enable: materializeExecution,
      applyEdits: applyStructuredEdits,
      dryRun: !materializeExecution,
    })

    report.summary.notes = [
      ...report.summary.notes,
      ...(execution.materialization.executed
        ? ["Opt-in worktree materialization was enabled for the selected candidate."]
        : ["Opt-in worktree materialization remained in dry-run mode."]),
      ...(execution.edits.enabled
        ? ["Structured edits were enabled for the selected candidate."]
        : ["Structured edits were not applied."]),
    ]
  }

  if (verificationRequested && !execution) {
    throw new Error("Verification requires an executed materialized worktree. Pass --materialize or enable structured edits.")
  }

  if (resolvedLiveOptions) {
    if (resolvedLiveOptions.scenarioId) {
      // Single scenario mode
      const liveOutcome = await runLiveBench(["--scenario", resolvedLiveOptions.scenarioId])
      if (liveOutcome.mode === "run") {
        live = liveOutcome.result
        report.summary.notes = [
          ...report.summary.notes,
          `Live evaluator status: ${live.status}.`,
        ]
      } else {
        throw new Error("Live evaluator must resolve to a runnable live scenario.")
      }
    } else if (resolvedLiveOptions.runAll) {
      // Multi-scenario mode: run all real scenarios
      const liveResults: LiveEvaluationResult[] = []
      const scenariosToRun = liveScenarios.filter(
        (s) => !s.id.includes("placeholder") && !s.id.includes("smoke"),
      )
      for (const scenario of scenariosToRun) {
        try {
          const outcome = await runLiveBench(["--scenario", scenario.id])
          if (outcome.mode === "run") {
            liveResults.push(outcome.result)
            logger.info(`Live scenario ${scenario.id}: ${outcome.result.status} (score: ${outcome.result.score})`)
          }
        } catch (err) {
          logger.warn(`Live scenario ${scenario.id} threw: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
      if (liveResults.length > 0) {
        const allPass = liveResults.every((r) => r.pass)
        const avgScore = Math.round(liveResults.reduce((sum, r) => sum + r.score, 0) / liveResults.length)
        const passCount = liveResults.filter((r) => r.pass).length
        const scenarioSummaries = liveResults.map((r) => `${r.scenario.id}: ${r.status}(${r.score})`).join(", ")
        live = {
          ...liveResults[0],
          pass: allPass,
          score: avgScore,
          summary: `Multi-scenario live: ${liveResults.length} ran, ${passCount} passed. ${scenarioSummaries}`,
        }
        report.summary.notes = [
          ...report.summary.notes,
          `Live evaluator: ${liveResults.length} scenarios, ${passCount} passed, avg score ${avgScore}.`,
        ]
      }
    } else {
      // Default: run first scenario (backward compat)
      const liveOutcome = await runLiveBench([])
      if (liveOutcome.mode === "run") {
        live = liveOutcome.result
        report.summary.notes = [
          ...report.summary.notes,
          `Live evaluator status: ${live.status}.`,
        ]
      } else {
        throw new Error("Live evaluator must resolve to a runnable live scenario.")
      }
    }
  }

  const resolvedOutputDir = path.resolve(outputDir)
  const latestCapabilityProofPath = path.join(resolvedOutputDir, "capability-proof", "latest.capability-proof.json")
  const capabilityProofResult = await tryReadJson<CapabilityProofResult>(latestCapabilityProofPath)
  const capabilityProofOverrides = capabilityProofResult ? buildCapabilityProofOverrides(capabilityProofResult) : null
  const capabilitySummary = summarizeAstraCapabilityCards(
    createAstraCapabilityStatusCards(capabilityProofOverrides ?? undefined),
  )
  report.summary.notes = [
    ...report.summary.notes,
    capabilityProofResult
      ? `Capability proof loaded from ${latestCapabilityProofPath}.`
      : `Capability proof artifact not found at ${latestCapabilityProofPath}; using registry defaults.`,
  ]
  const plannedArtifactPaths = {
    latestJsonPath: writeOutput ? path.join(resolvedOutputDir, "latest.json") : null,
    latestMarkdownPath: writeOutput ? path.join(resolvedOutputDir, "latest.md") : null,
    latestResolvedJsonPath: writeOutput && resolvedConfig ? path.join(resolvedOutputDir, "latest.resolved.json") : null,
    latestResolvedMarkdownPath: writeOutput && resolvedConfig ? path.join(resolvedOutputDir, "latest.resolved.md") : null,
    latestOrchestrationJsonPath: writeOutput && resolvedOrchestrationOptions && bestCandidate ? path.join(resolvedOutputDir, "latest.orchestration.json") : null,
    latestOrchestrationMarkdownPath: writeOutput && resolvedOrchestrationOptions && bestCandidate ? path.join(resolvedOutputDir, "latest.orchestration.md") : null,
    latestOrchestrationLoopJsonPath: writeOutput && resolvedOrchestrationOptions && bestCandidate ? path.join(resolvedOutputDir, "latest.orchestration-loop.json") : null,
    latestOrchestrationLoopMarkdownPath: writeOutput && resolvedOrchestrationOptions && bestCandidate ? path.join(resolvedOutputDir, "latest.orchestration-loop.md") : null,
    orchestrationIterationsDirPath: writeOutput && resolvedOrchestrationOptions && bestCandidate ? path.join(resolvedOutputDir, "orchestration-iterations") : null,
    latestSessionJsonPath: writeOutput && resolvedSessionOptions ? path.join(resolvedOutputDir, "latest.session.json") : null,
    latestSessionMarkdownPath: writeOutput && resolvedSessionOptions ? path.join(resolvedOutputDir, "latest.session.md") : null,
    latestCheckpointJsonPath: writeOutput && resolvedSessionOptions ? path.join(resolvedOutputDir, "latest.checkpoint.json") : null,
    latestCheckpointMarkdownPath: writeOutput && resolvedSessionOptions ? path.join(resolvedOutputDir, "latest.checkpoint.md") : null,
    latestCompactionJsonPath: writeOutput && resolvedSessionOptions ? path.join(resolvedOutputDir, "latest.compaction.json") : null,
    latestCompactionMarkdownPath: writeOutput && resolvedSessionOptions ? path.join(resolvedOutputDir, "latest.compaction.md") : null,
    latestHandoffJsonPath: writeOutput && resolvedSessionOptions ? path.join(resolvedOutputDir, "latest.handoff.json") : null,
    latestHandoffMarkdownPath: writeOutput && resolvedSessionOptions ? path.join(resolvedOutputDir, "latest.handoff.md") : null,
    latestLiveJsonPath: writeOutput && resolvedLiveOptions ? path.join(resolvedOutputDir, "latest.live.json") : null,
    latestLiveMarkdownPath: writeOutput && resolvedLiveOptions ? path.join(resolvedOutputDir, "latest.live.md") : null,
    latestPromotionJsonPath: writeOutput && resolvedPromotionOptions ? path.join(resolvedOutputDir, "latest.promotion.json") : null,
    latestPromotionMarkdownPath: writeOutput && resolvedPromotionOptions ? path.join(resolvedOutputDir, "latest.promotion.md") : null,
    latestPublishJsonPath: writeOutput && resolvedPromotionOptions ? path.join(resolvedOutputDir, "latest.publish.json") : null,
    latestPublishMarkdownPath: writeOutput && resolvedPromotionOptions ? path.join(resolvedOutputDir, "latest.publish.md") : null,
    latestRollbackJsonPath: writeOutput && resolvedPromotionOptions ? path.join(resolvedOutputDir, "latest.rollback.json") : null,
    latestRollbackMarkdownPath: writeOutput && resolvedPromotionOptions ? path.join(resolvedOutputDir, "latest.rollback.md") : null,
    latestStatusJsonPath: writeOutput ? path.join(resolvedOutputDir, "latest.status.json") : null,
    latestStatusMarkdownPath: writeOutput ? path.join(resolvedOutputDir, "latest.status.md") : null,
  }

  if (execution && resolvedVerificationOptions) {
    const verification = await runBenchOptVerification(execution.materialization.materializedPath, resolvedVerificationOptions)
    const baselineComparisonReport: BenchOptStructuredReportLike = baselineArtifacts.report ?? {
      runId: baseline.runId ?? undefined,
      generatedAt: baseline.generatedAt ?? undefined,
      summary: {
        totalScenarios: baseline.totalScenarios ?? 0,
        passedScenarios: baseline.passedScenarios ?? 0,
        failedScenarios: baseline.failedScenarios ?? 0,
        averageTotal: baseline.averageTotal ?? undefined,
      },
      scenarios: [],
    }
    const trialReport = buildVerificationTrialReport(baselineArtifacts.report, verification.execution, report.runId)
    const keepReject = resolvedKeepRejectOptions === null
      ? null
      : compareAndDecideBenchOptKeepReject(baselineComparisonReport, trialReport, resolvedKeepRejectOptions)

    execution = {
      ...execution,
      verification: {
        plan: verification.plan,
        execution: verification,
        trialReport,
        notes: [
          ...verification.notes,
          `Derived trial report from ${verification.execution.commandCount} verification command(s).`,
        ],
      },
      keepReject,
      notes: [
        ...execution.notes,
        `Verification ${verification.status} with ${verification.execution.commandCount} command(s).`,
        ...(keepReject ? [`Keep/reject decision: ${keepReject.decision}.`] : []),
      ],
    }

    report.summary.notes = [
      ...report.summary.notes,
      `Verification ${verification.status} for the selected materialized candidate.`,
      ...(keepReject ? [`Keep/reject decision: ${keepReject.decision}.`] : []),
    ]
  }

  if (experiment) {
    const scoreTrends = extractScoreTrends(experiment.trials)
    scoreTrends.train.forEach((score, iteration) => {
      telemetry.recordScoreTrend({
        iteration,
        split: "train",
        averageTotal: score,
        surfaces: [{ surface: "train", averageTotal: score }],
        recordedAt: new Date().toISOString(),
      })
    })
    scoreTrends.validation.forEach((score, iteration) => {
      telemetry.recordScoreTrend({
        iteration,
        split: "validation",
        averageTotal: score,
        surfaces: [{ surface: "validation", averageTotal: score }],
        recordedAt: new Date().toISOString(),
      })
    })

    for (const trial of experiment.trials) {
      if (trial.status === "retained" || trial.status === "promoted") {
        telemetry.recordCandidateDecision(trial.trialId, "kept")
      } else if (trial.status === "rejected") {
        telemetry.recordCandidateDecision(trial.trialId, "rejected")
      }
    }
  }

  // --- Safety: guardrails + red flags ---
  let guardrailResult: BenchOptGuardrailResult | null = null
  let redFlagReport: BenchOptRedFlagReport | null = null
  if (experiment) {
    const bestTrial = experiment.trials.find(t => t.trialId === experiment.summary.bestTrialId) ?? null
    guardrailResult = bestTrial
      ? checkGuardrails(
          { averageTotal: bestTrial.breakdown.total, surfaces: [] },
          champion ? { averageTotal: baseline.averageTotal ?? 0, surfaces: baseline.surfaces.map(s => ({ surface: s.surface, averageTotal: s.averageTotal })) } : null,
          {},
          { currentIteration: 1, observedSplits: [bestTrial.split] },
        )
      : null
    redFlagReport = detectRedFlags(experiment.trials)
    const criticalCount = redFlagReport.flags.filter(f => f.severity === "critical").length
    if (guardrailResult?.verdict === "block") {
      logger.warn(`Guardrails blocked: ${guardrailResult.violations.map(v => v.description).join("; ")}`)
    }
    if (criticalCount > 0) {
      logger.warn(`Red flags detected: ${criticalCount} critical`)
    }
  }

  if (resolvedOrchestrationOptions && bestCandidate) {
    const orchestrationResult = await runBenchOptOrchestrationLoop(
      report,
      baseline,
      bestCandidate,
      execution,
      {
        ...resolvedOrchestrationOptions,
        split: resolvedOrchestrationOptions.split ?? resolvedEvaluatedSplit,
      },
      resolvedSessionOptions,
      {
        sessionStatePath: plannedArtifactPaths.latestSessionJsonPath,
        reportPath: plannedArtifactPaths.latestJsonPath,
        orchestrationPath: plannedArtifactPaths.latestOrchestrationJsonPath,
        orchestrationLoopPath: plannedArtifactPaths.latestOrchestrationLoopJsonPath,
        promotionPath: plannedArtifactPaths.latestPromotionJsonPath,
        publishPlanPath: plannedArtifactPaths.latestPublishJsonPath,
        rollbackPlanPath: plannedArtifactPaths.latestRollbackJsonPath,
      },
      resumeArtifacts,
      startedAtMs,
    )
    orchestration = orchestrationResult.orchestration
    orchestrationLoop = orchestrationResult.orchestrationLoop
    orchestrationIterations = orchestrationResult.orchestrationIterations
    session = resolvedSessionOptions ? orchestrationResult.session : null

    report.summary.notes = [
      ...report.summary.notes,
      `Opt-in orchestration loop completed ${orchestrationResult.orchestrationLoop.completedIterations}/${orchestrationResult.orchestrationLoop.maxIterations} iteration(s).`,
      `Orchestration termination: ${orchestrationResult.orchestrationLoop.terminationReason}.`,
      ...(resumeArtifacts.sessionState ? [`Resumed session: ${resumeArtifacts.sessionState.sessionId}.`] : []),
      ...(session ? [
        `Session lifecycle phase: ${session.state.phase}.`,
        ...(session.compaction ? [`Session compaction prepared: ${session.compaction.compactionId}.`] : []),
        ...(session.handoff ? [`Session handoff prepared: ${session.handoff.handoffId}.`] : []),
      ] : []),
    ]
  }

  if (resolvedSessionOptions && !session) {
    session = buildSessionArtifacts(report, resolvedSessionOptions, {
      bestCandidateId: bestCandidate?.candidate.id ?? null,
      execution,
      orchestration,
      artifactPaths: {
        sessionStatePath: plannedArtifactPaths.latestSessionJsonPath,
        reportPath: plannedArtifactPaths.latestJsonPath,
        orchestrationPath: plannedArtifactPaths.latestOrchestrationJsonPath,
        orchestrationLoopPath: plannedArtifactPaths.latestOrchestrationLoopJsonPath,
        promotionPath: plannedArtifactPaths.latestPromotionJsonPath,
        publishPlanPath: plannedArtifactPaths.latestPublishJsonPath,
        rollbackPlanPath: plannedArtifactPaths.latestRollbackJsonPath,
      },
      startedAtMs,
    })

    report.summary.notes = [
      ...report.summary.notes,
      `Session lifecycle phase: ${session.state.phase}.`,
      ...(session.compaction ? [`Session compaction prepared: ${session.compaction.compactionId}.`] : []),
      ...(session.handoff ? [`Session handoff prepared: ${session.handoff.handoffId}.`] : []),
    ]
  }

  if (resolvedPromotionOptions) {
    const verificationChecks = collectVerificationChecks(execution?.verification)
    const keepRejectPromotable = execution?.keepReject ? execution.keepReject.decision !== "reject" : false
    const verificationPassed = execution?.verification?.execution.status === "passed"
    const guardrailSafe = !guardrailResult || guardrailResult.verdict !== "block"
    const experimentGate = experiment.summary.promotionGate
    promotion = decideBenchOptPromotion({
      runId: report.runId,
      candidateId: bestCandidate?.candidate.id ?? "none",
      gate: {
        ...experimentGate,
        qualified: experimentGate.qualified && verificationPassed && keepRejectPromotable && guardrailSafe,
        reason: [
          experimentGate.reason,
          verificationPassed ? "verification passed" : "verification not passed",
          execution?.keepReject ? `keep/reject decision ${execution.keepReject.decision}` : "keep/reject decision unavailable",
          live ? `live evaluator ${live.status}` : "live evaluator not run",
          guardrailSafe ? "guardrails passed" : `guardrails BLOCKED: ${guardrailResult?.violations.map(v => v.description).join("; ")}`,
        ].join("; "),
      },
      liveEvaluatorPassed: (resolvedPromotionOptions.liveEvaluatorPassed ?? false) || Boolean(live?.pass && live.status === "pass"),
      requiredChecks: resolvedPromotionOptions.requiredChecks ?? verificationChecks.required,
      passedChecks: [
        ...verificationChecks.passed,
        ...(resolvedPromotionOptions.passedChecks ?? []),
      ],
      branchName: resolvedPromotionOptions.branchName ?? execution?.materialization.plan.branchName ?? bestCandidate?.worktree.branchName ?? null,
      pullRequestUrl: resolvedPromotionOptions.pullRequestUrl ?? null,
      canaryEnvironment: resolvedPromotionOptions.canaryEnvironment ?? null,
      trialSummaryPath: resolvedPromotionOptions.trialSummaryPath ?? plannedArtifactPaths.latestMarkdownPath,
      allowPromotion: resolvedPromotionOptions.allowPromotion,
    }, {
      requireCanary: resolvedPromotionOptions.requireCanary,
      defaultChannel: resolvedPromotionOptions.defaultChannel,
      requiredChecks: resolvedPromotionOptions.requiredChecks,
    })

    publishPlan = buildBenchOptPublishPlan({
      runId: report.runId,
      candidateId: promotion.candidateId,
      promotion,
      trialSummaryPath: resolvedPromotionOptions.trialSummaryPath ?? plannedArtifactPaths.latestMarkdownPath,
      branchName: resolvedPromotionOptions.branchName ?? promotion.artifacts.branchName,
      baseRef: bestCandidate?.worktree.baseRef ?? "HEAD",
      pullRequestTitle: resolvedPromotionOptions.pullRequestTitle ?? `Promote ${promotion.candidateId}`,
      pullRequestBody: resolvedPromotionOptions.pullRequestBody ?? `Bench-opt promotion plan for ${promotion.candidateId}.`,
      canaryEnvironment: resolvedPromotionOptions.canaryEnvironment ?? promotion.artifacts.canaryEnvironment,
      canaryStrategy: resolvedPromotionOptions.canaryStrategy,
    }, {
      allowPublish: resolvedPromotionOptions.allowPublish,
      enableBranchCreation: resolvedPromotionOptions.enableBranchCreation,
      openPullRequest: resolvedPromotionOptions.openPullRequest,
      enableCanary: resolvedPromotionOptions.enableCanary,
      defaultBranchPrefix: resolvedPromotionOptions.defaultBranchPrefix,
      defaultBaseRef: resolvedPromotionOptions.defaultBaseRef,
    })

    rollbackPlan = buildBenchOptRollbackPlan({
      runId: report.runId,
      candidateId: promotion.candidateId,
      promotion,
      publishPlan,
      trigger: resolvedPromotionOptions.rollbackTrigger,
      reason: resolvedPromotionOptions.rollbackReason,
      failedChecks: resolvedPromotionOptions.failedChecks,
    }, {
      allowRollback: resolvedPromotionOptions.allowRollback,
    })

    report.summary.notes = [
      ...report.summary.notes,
      `Promotion plan status: ${promotion.status}.`,
      `Publish plan status: ${publishPlan.status}.`,
      `Rollback plan status: ${rollbackPlan.status}.`,
    ]
  }

  telemetry.recordIterationEnd(Math.max(0, (orchestrationLoop?.completedIterations ?? 1) - 1))
  const telemetrySnapshot = telemetry.snapshot()

  let text = renderText(report)
  if (execution) {
    text = `${text}\n\n${renderExecutionSummary(execution)}`
    if (execution.verification) {
      text = `${text}\n\n${renderVerificationSummary(execution.verification, execution.keepReject)}`
    }
  }
  if (live) {
    text = `${text}\n\n## Opt-in live evaluator\n- Scenario: ${live.scenario.id}\n- Status: ${live.status}\n- Pass: ${live.pass ? "yes" : "no"}\n- Score: ${live.score}\n- Summary: ${live.summary}`
  }
  if (orchestration) {
    text = `${text}\n\n${renderOrchestrationSummary(orchestration)}`
  }
  if (orchestrationLoop) {
    text = `${text}\n\n${renderOrchestrationLoopSummary(orchestrationLoop)}`
  }
  if (session) {
    text = `${text}\n\n${renderSessionSummary(session)}`
  }
  if (promotion && publishPlan && rollbackPlan) {
    text = `${text}\n\n${renderPromotionSummary(promotion, publishPlan, rollbackPlan)}`
  }
  let paths: BenchOptRunResult["paths"] = null

  if (writeOutput) {
    await mkdir(resolvedOutputDir, { recursive: true })
    const {
      latestJsonPath,
      latestMarkdownPath,
      latestResolvedJsonPath,
      latestResolvedMarkdownPath,
      latestOrchestrationJsonPath,
      latestOrchestrationMarkdownPath,
      latestOrchestrationLoopJsonPath,
      latestOrchestrationLoopMarkdownPath,
      orchestrationIterationsDirPath,
      latestSessionJsonPath,
      latestSessionMarkdownPath,
      latestCheckpointJsonPath,
      latestCheckpointMarkdownPath,
      latestCompactionJsonPath,
      latestCompactionMarkdownPath,
      latestHandoffJsonPath,
      latestHandoffMarkdownPath,
      latestLiveJsonPath,
      latestLiveMarkdownPath,
      latestPromotionJsonPath,
      latestPromotionMarkdownPath,
      latestPublishJsonPath,
      latestPublishMarkdownPath,
      latestRollbackJsonPath,
      latestRollbackMarkdownPath,
      latestStatusJsonPath,
      latestStatusMarkdownPath,
    } = plannedArtifactPaths
    await writeFile(latestJsonPath!, JSON.stringify(report, null, 2))
    await writeFile(latestMarkdownPath!, renderMarkdown(report))
    champion = selectBenchOptChampion(experiment, {
      resolvedConfigPath: latestResolvedJsonPath,
    })
    if (bestCandidate && latestResolvedJsonPath) {
      const championTrialId = experiment.championTrialId
      experiment.trials = experiment.trials.map((trial) => trial.trialId === championTrialId || trial.candidateId === bestCandidate.candidate.id
        ? {
            ...trial,
            artifacts: {
              ...trial.artifacts,
              resolvedConfigPath: latestResolvedJsonPath,
            },
          }
        : trial)
    }
    const experimentStore = await saveBenchOptExperiment(experiment, resolvedOutputDir)
    const championStore = champion
      ? await saveBenchOptChampion(champion, resolvedOutputDir)
      : null
    if (resolvedConfig && bestCandidate && bestMaterializedCandidate) {
      resolvedConfig = buildResolvedOptimizerConfig(report, bestCandidate, bestMaterializedCandidate, {
        experiment,
        champion,
        store: {
          experimentPath: experimentStore.experimentPath,
          championPath: championStore?.championPath ?? null,
          indexPath: championStore?.indexPath ?? experimentStore.indexPath,
        },
      })
    }
    if (resolvedConfig && latestResolvedJsonPath && latestResolvedMarkdownPath) {
      await writeFile(latestResolvedJsonPath, JSON.stringify(resolvedConfig, null, 2))
      await writeFile(latestResolvedMarkdownPath, renderResolvedConfigMarkdown(resolvedConfig))
    }
    if (orchestration && latestOrchestrationJsonPath && latestOrchestrationMarkdownPath) {
      await writeFile(latestOrchestrationJsonPath, JSON.stringify(orchestration, null, 2))
      await writeFile(latestOrchestrationMarkdownPath, renderOrchestrationMarkdown(orchestration))
    }
    if (orchestrationLoop && latestOrchestrationLoopJsonPath && latestOrchestrationLoopMarkdownPath) {
      await writeFile(latestOrchestrationLoopJsonPath, JSON.stringify(orchestrationLoop, null, 2))
      await writeFile(latestOrchestrationLoopMarkdownPath, renderOrchestrationLoopMarkdown(orchestrationLoop))
      if (orchestrationIterations && orchestrationIterationsDirPath) {
        await mkdir(orchestrationIterationsDirPath, { recursive: true })
        await Promise.all(orchestrationIterations.flatMap((iteration, index) => [
          writeFile(
            path.join(orchestrationIterationsDirPath, `iteration-${index + 1}.json`),
            JSON.stringify(iteration, null, 2),
          ),
          writeFile(
            path.join(orchestrationIterationsDirPath, `iteration-${index + 1}.md`),
            renderOrchestrationMarkdown(iteration),
          ),
        ]))
      }
    }
    if (session && latestSessionJsonPath && latestSessionMarkdownPath) {
      await writeFile(latestSessionJsonPath, JSON.stringify(session.state, null, 2))
      await writeFile(latestSessionMarkdownPath, renderSessionMarkdown(session))
      if (latestCheckpointJsonPath && latestCheckpointMarkdownPath) {
        await writeFile(latestCheckpointJsonPath, JSON.stringify(session.checkpoint, null, 2))
        await writeFile(latestCheckpointMarkdownPath, `# Astra Bench Opt Checkpoint\n\n- Checkpoint ID: \`${session.checkpoint.checkpointId}\`\n- Kind: ${session.checkpoint.kind}\n- Reason: ${session.checkpoint.reason}\n`)
      }
      if (session.compaction && latestCompactionJsonPath && latestCompactionMarkdownPath) {
        await writeFile(latestCompactionJsonPath, JSON.stringify(session.compaction, null, 2))
        await writeFile(latestCompactionMarkdownPath, `# Astra Bench Opt Compaction\n\n- Compaction ID: \`${session.compaction.compactionId}\`\n- Trigger: ${session.compaction.trigger}\n- Strategy: ${session.compaction.strategy}\n- Reason: ${session.compaction.reason}\n`)
      }
      if (session.handoff && latestHandoffJsonPath && latestHandoffMarkdownPath) {
        await writeFile(latestHandoffJsonPath, JSON.stringify(session.handoff, null, 2))
        await writeFile(latestHandoffMarkdownPath, `# Astra Bench Opt Handoff\n\n- Handoff ID: \`${session.handoff.handoffId}\`\n- Kind: ${session.handoff.kind}\n- Target: ${session.handoff.target}\n- Reason: ${session.handoff.reason}\n`)
      }
      await saveBenchOptSessionArtifacts(session, resolvedOutputDir)
    }
    if (live && latestLiveJsonPath && latestLiveMarkdownPath) {
      await writeFile(latestLiveJsonPath, JSON.stringify(live, null, 2))
      await writeFile(latestLiveMarkdownPath, live.text)
    }
    if (promotion && publishPlan && rollbackPlan) {
      if (latestPromotionJsonPath && latestPromotionMarkdownPath) {
        await writeFile(latestPromotionJsonPath, JSON.stringify(promotion, null, 2))
        await writeFile(latestPromotionMarkdownPath, renderPromotionMarkdown(promotion, publishPlan, rollbackPlan))
      }
      if (latestPublishJsonPath && latestPublishMarkdownPath) {
        await writeFile(latestPublishJsonPath, JSON.stringify(publishPlan, null, 2))
        await writeFile(latestPublishMarkdownPath, `# Astra Bench Opt Publish Plan\n\n- Status: ${publishPlan.status}\n- Branch: ${publishPlan.branch.name ?? "none"}\n- Canary: ${publishPlan.canary.environment ?? "none"}\n- Trial summary: ${publishPlan.summary.path ?? "none"}\n`)
      }
      if (latestRollbackJsonPath && latestRollbackMarkdownPath) {
        await writeFile(latestRollbackJsonPath, JSON.stringify(rollbackPlan, null, 2))
        await writeFile(latestRollbackMarkdownPath, `# Astra Bench Opt Rollback Plan\n\n- Status: ${rollbackPlan.status}\n- Trigger: ${rollbackPlan.trigger}\n- Reason: ${rollbackPlan.reason}\n- Branch target: ${rollbackPlan.targets.branchName ?? "none"}\n`)
      }
    }
    const store = await loadBenchOptStore(resolvedOutputDir)
      const status = buildBenchOptStatusArtifact({
        report,
      resolvedConfig,
      execution,
      live,
      orchestration,
      orchestrationLoop,
      session,
      promotion,
      publishPlan,
      rollbackPlan,
      store,
      safety: guardrailResult && redFlagReport ? {
        guardrails: { verdict: guardrailResult.verdict, violations: guardrailResult.violations.map(v => ({ id: v.id, severity: v.severity, description: v.description })) },
        redFlags: { flagCount: redFlagReport.flags.length, criticalCount: redFlagReport.flags.filter(f => f.severity === "critical").length, flags: redFlagReport.flags.map(f => ({ id: f.id, severity: f.severity, description: f.description })) },
      } : null,
      telemetry: {
        durationMs: telemetrySnapshot.durationMs,
        iterationCount: telemetrySnapshot.iterations || (orchestrationLoop?.completedIterations ?? 1),
        candidatesKept: telemetrySnapshot.candidatesKept,
        candidatesRejected: telemetrySnapshot.candidatesRejected,
        estimatedCostUsd: telemetrySnapshot.cost.estimatedCostUsd,
        scoreTrends: toStatusScoreTrends(telemetrySnapshot.scoreTrends),
      },
      capabilities: capabilitySummary,
      paths: {
        latestJsonPath,
        latestMarkdownPath,
        latestResolvedJsonPath,
        latestResolvedMarkdownPath,
        latestOrchestrationJsonPath,
        latestOrchestrationLoopJsonPath,
        latestSessionJsonPath,
        latestCheckpointJsonPath: session ? latestCheckpointJsonPath : null,
        latestCompactionJsonPath: session?.compaction ? latestCompactionJsonPath : null,
        latestHandoffJsonPath: session?.handoff ? latestHandoffJsonPath : null,
        latestLiveJsonPath,
        latestPromotionJsonPath,
        latestPublishJsonPath,
        latestRollbackJsonPath,
        latestStatusJsonPath,
        latestStatusMarkdownPath,
        storeIndexPath: championStore?.indexPath ?? experimentStore.indexPath,
      },
    })
    if (latestStatusJsonPath && latestStatusMarkdownPath) {
      await writeFile(latestStatusJsonPath, JSON.stringify(status, null, 2))
      await writeFile(latestStatusMarkdownPath, renderBenchOptStatusMarkdown(status))
    }
    paths = {
      outputDir: resolvedOutputDir,
      latestJsonPath: latestJsonPath!,
      latestMarkdownPath: latestMarkdownPath!,
      latestResolvedJsonPath,
      latestResolvedMarkdownPath,
      latestOrchestrationJsonPath,
      latestOrchestrationMarkdownPath,
      latestOrchestrationLoopJsonPath,
      latestOrchestrationLoopMarkdownPath,
      orchestrationIterationsDirPath,
      latestSessionJsonPath,
      latestSessionMarkdownPath,
      latestCheckpointJsonPath: session ? latestCheckpointJsonPath : null,
      latestCheckpointMarkdownPath: session ? latestCheckpointMarkdownPath : null,
      latestCompactionJsonPath: session?.compaction ? latestCompactionJsonPath : null,
      latestCompactionMarkdownPath: session?.compaction ? latestCompactionMarkdownPath : null,
      latestHandoffJsonPath: session?.handoff ? latestHandoffJsonPath : null,
      latestHandoffMarkdownPath: session?.handoff ? latestHandoffMarkdownPath : null,
      latestLiveJsonPath,
      latestLiveMarkdownPath,
      latestPromotionJsonPath,
      latestPromotionMarkdownPath,
      latestPublishJsonPath,
      latestPublishMarkdownPath,
      latestRollbackJsonPath,
      latestRollbackMarkdownPath,
      latestStatusJsonPath,
      latestStatusMarkdownPath,
      experimentPath: experimentStore.experimentPath,
      championPath: championStore?.championPath ?? null,
      storeIndexPath: championStore?.indexPath ?? experimentStore.indexPath,
    }
  }

  if (orchestration && paths) {
    text = [
      text,
      "",
      "## Opt-in orchestration artifacts",
      `- JSON: ${paths.latestOrchestrationJsonPath ?? "n/a"}`,
      `- Markdown: ${paths.latestOrchestrationMarkdownPath ?? "n/a"}`,
      `- Loop JSON: ${paths.latestOrchestrationLoopJsonPath ?? "n/a"}`,
      `- Loop Markdown: ${paths.latestOrchestrationLoopMarkdownPath ?? "n/a"}`,
      `- Iterations dir: ${paths.orchestrationIterationsDirPath ?? "n/a"}`,
    ].join("\n")
  }

  if (session && paths) {
    text = [
      text,
      "",
      "## Opt-in session artifacts",
      `- Session JSON: ${paths.latestSessionJsonPath ?? "n/a"}`,
      `- Session Markdown: ${paths.latestSessionMarkdownPath ?? "n/a"}`,
      `- Checkpoint JSON: ${paths.latestCheckpointJsonPath ?? "n/a"}`,
      `- Handoff JSON: ${paths.latestHandoffJsonPath ?? "n/a"}`,
    ].join("\n")
  }

  if (live && paths) {
    text = [
      text,
      "",
      "## Opt-in live artifacts",
      `- Live JSON: ${paths.latestLiveJsonPath ?? "n/a"}`,
      `- Live Markdown: ${paths.latestLiveMarkdownPath ?? "n/a"}`,
    ].join("\n")
  }

  if (promotion && publishPlan && rollbackPlan && paths) {
    text = [
      text,
      "",
      "## Opt-in promotion artifacts",
      `- Promotion JSON: ${paths.latestPromotionJsonPath ?? "n/a"}`,
      `- Publish JSON: ${paths.latestPublishJsonPath ?? "n/a"}`,
      `- Rollback JSON: ${paths.latestRollbackJsonPath ?? "n/a"}`,
    ].join("\n")
  }

  if (paths?.latestStatusJsonPath) {
    text = [
      text,
      "",
      "## Operator status artifact",
      `- Status JSON: ${paths.latestStatusJsonPath}`,
      `- Status Markdown: ${paths.latestStatusMarkdownPath ?? "n/a"}`,
    ].join("\n")
  }

  await telemetry.flush()
  logger.info("Bench-opt run complete")

  return {
    report,
    experiment,
    champion,
    execution,
    orchestration,
    orchestrationLoop,
    orchestrationIterations,
    session,
    live,
    promotion,
    publishPlan,
    rollbackPlan,
    status: paths?.latestStatusJsonPath
      ? buildBenchOptStatusArtifact({
          report,
          resolvedConfig,
          execution,
          live,
          orchestration,
          orchestrationLoop,
          session,
          promotion,
          publishPlan,
          rollbackPlan,
          store: null,
          safety: guardrailResult && redFlagReport ? {
            guardrails: { verdict: guardrailResult.verdict, violations: guardrailResult.violations.map(v => ({ id: v.id, severity: v.severity, description: v.description })) },
            redFlags: { flagCount: redFlagReport.flags.length, criticalCount: redFlagReport.flags.filter(f => f.severity === "critical").length, flags: redFlagReport.flags.map(f => ({ id: f.id, severity: f.severity, description: f.description })) },
          } : null,
          telemetry: {
            durationMs: telemetrySnapshot.durationMs,
            iterationCount: telemetrySnapshot.iterations || (orchestrationLoop?.completedIterations ?? 1),
            candidatesKept: telemetrySnapshot.candidatesKept,
            candidatesRejected: telemetrySnapshot.candidatesRejected,
            estimatedCostUsd: telemetrySnapshot.cost.estimatedCostUsd,
            scoreTrends: toStatusScoreTrends(telemetrySnapshot.scoreTrends),
          },
          capabilities: capabilitySummary,
          paths: {
            latestJsonPath: paths.latestJsonPath,
            latestMarkdownPath: paths.latestMarkdownPath,
            latestResolvedJsonPath: paths.latestResolvedJsonPath,
            latestResolvedMarkdownPath: paths.latestResolvedMarkdownPath,
            latestOrchestrationJsonPath: paths.latestOrchestrationJsonPath,
            latestOrchestrationLoopJsonPath: paths.latestOrchestrationLoopJsonPath,
            latestSessionJsonPath: paths.latestSessionJsonPath,
            latestCheckpointJsonPath: paths.latestCheckpointJsonPath,
            latestCompactionJsonPath: paths.latestCompactionJsonPath,
            latestHandoffJsonPath: paths.latestHandoffJsonPath,
            latestLiveJsonPath: paths.latestLiveJsonPath,
            latestPromotionJsonPath: paths.latestPromotionJsonPath,
            latestPublishJsonPath: paths.latestPublishJsonPath,
            latestRollbackJsonPath: paths.latestRollbackJsonPath,
            latestStatusJsonPath: paths.latestStatusJsonPath,
            latestStatusMarkdownPath: paths.latestStatusMarkdownPath,
            storeIndexPath: paths.storeIndexPath,
          },
        })
      : null,
    text,
    paths,
  }
}

export function describeBenchOptReport(report: BenchOptRunReport) {
  return renderMarkdown(report)
}
