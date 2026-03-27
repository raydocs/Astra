import type { BenchmarkSplit, BenchmarkSurface } from "../bench/types"
import type { LiveEvaluationResult } from "../bench-live/index"
import type { BenchOptStructuredReportLike } from "./compare.ts"
import type { BenchOptOrchestrationArtifact, BenchOptRoleAdapters } from "./orchestrator.ts"
import type { BenchOptKeepRejectResult } from "./keep-reject.ts"
import type { BenchOptPromotionChannel, BenchOptPromotionDecision } from "./promote.ts"
import type { BenchOptPublishPlan } from "./publish.ts"
import type { BenchOptRollbackPlan, BenchOptRollbackTrigger } from "./rollback.ts"
import type { BenchOptFollowUpAction } from "./strategy.ts"
import type { BenchOptSessionCreateInput, BenchOptSessionState } from "./session.ts"
import type { BenchOptCheckpointArtifact } from "./checkpoints.ts"
import type { BenchOptCompactionTrigger, BenchOptCompactionMetadata } from "./compaction.ts"
import type { BenchOptSessionHandoffArtifact } from "./handoff.ts"
import type { BenchOptVerificationKind, BenchOptVerificationPlan, BenchOptVerificationResult } from "./verify.ts"

export type OptimizerPhase = 1

export type OptimizerCandidateKind = "prompt" | "context" | "tool-config" | "agent-graph"

export type BenchOptEditInstruction =
  | {
      path: string
      justification: string
      kind: "rewrite"
      content: string
    }
  | {
      path: string
      justification: string
      kind: "replace"
      search: string
      replace: string
    }

export type OptimizerContextSlot =
  | "task"
  | "surface"
  | "fixture"
  | "codeHint"
  | "history"
  | "candidateFiles"
  | "reportSummary"
  | "patchHints"

export interface OptimizerCandidateBase {
  id: string
  kind: OptimizerCandidateKind
  label: string
  description: string
  surfaces?: readonly BenchmarkSurface[]
  tags?: readonly string[]
}

export interface PromptOptimizerPolicy {
  analysisMode: "minimal" | "analysis-first"
  toolPolicy: "default" | "read-before-edit"
  writeScopeMode: "strict" | "evidence-led"
}

export interface ContextOptimizerPolicy {
  rankingMode: "balanced" | "explicit-first"
  maxFiles: number
  maxLinesPerFile: number
  preferHistory: boolean
}

export interface PromptOptimizerCandidate extends OptimizerCandidateBase {
  kind: "prompt"
  prompt: string
  policy: PromptOptimizerPolicy
}

export interface ContextOptimizerCandidate extends OptimizerCandidateBase {
  kind: "context"
  slots: readonly OptimizerContextSlot[]
  policy: ContextOptimizerPolicy
}

export type OptimizerCandidate = PromptOptimizerCandidate | ContextOptimizerCandidate

export interface OptimizerRegistry {
  phase: OptimizerPhase
  candidates: readonly OptimizerCandidate[]
  byId: ReadonlyMap<string, OptimizerCandidate>
}

export interface BenchOptCandidateInput {
  id: string
  prompt?: string
  context?: string | string[]
  notes?: string[]
  edits?: readonly BenchOptEditInstruction[]
  worktree?: {
    baseRef?: string
    branchPrefix?: string
    path?: string
    root?: string
  }
}

export interface BenchOptCandidate {
  id: string
  promptCandidateId?: string | null
  contextCandidateId?: string | null
  prompt: string
  contextLines: string[]
  notes: string[]
  edits: readonly BenchOptEditInstruction[]
  worktree: {
    baseRef: string
    branchPrefix: string
    path: string | null
    root: string | null
  }
}

export type BenchOptTrialSplit = "train" | "validation" | "holdout"

export type BenchOptTrialStatus = "proposed" | "scored" | "retained" | "rejected" | "promoted"

export interface BenchArtifactScenarioLike {
  id: string
  title?: string
  task?: string
  surface?: string
  fixture?: string
  evaluation?: {
    total?: number
    pass?: boolean
  }
}

export interface BenchArtifactReportLike {
  runId?: string
  generatedAt?: string
  filter?: {
    surface?: BenchmarkSurface | null
    split?: BenchmarkSplit | null
  }
  summary?: {
    totalScenarios?: number
    passedScenarios?: number
    failedScenarios?: number
    averageTotal?: number
    surfaces?: Array<{
      surface: string
      scenarioCount: number
      passed: number
      failed: number
      averageTotal: number
    }>
  }
  comparison?: {
    regressions?: number
    improvements?: number
    unchanged?: number
    added?: number
  }
  scenarios?: BenchArtifactScenarioLike[]
}

export interface BenchOptBaselineSnapshot {
  path: string | null
  available: boolean
  runId: string | null
  generatedAt: string | null
  split: BenchmarkSplit | null
  totalScenarios: number | null
  passedScenarios: number | null
  failedScenarios: number | null
  averageTotal: number | null
  regressions: number | null
  improvements: number | null
  unchanged: number | null
  added: number | null
  terms: string[]
  surfaces: Array<{
    surface: string
    scenarioCount: number
    passed: number
    failed: number
    averageTotal: number
  }>
}

export interface BenchOptWorktreePlan {
  repositoryRoot: string
  baseRef: string
  branchName: string
  path: string
  command: string[]
  dryRun: boolean
}

export interface BenchOptResolvedPromptConfig {
  id: string
  label: string
  description: string
  prompt: string
  policy: PromptOptimizerPolicy
  tags: readonly string[]
  surfaces: readonly string[]
}

export interface BenchOptResolvedContextConfig {
  id: string
  label: string
  description: string
  slots: readonly OptimizerContextSlot[]
  policy: ContextOptimizerPolicy
  tags: readonly string[]
  surfaces: readonly string[]
  lines: readonly string[]
}

export interface BenchOptResolvedOptimizerConfig {
  schemaVersion: 1
  runId: string
  generatedAt: string
  sourceArtifacts: {
    baselineReport: string | null
    candidateFiles: string[]
  }
  selection: {
    candidateId: string
    promptCandidateId: string
    contextCandidateId: string
    rank: number
    score: number
    breakdown: BenchOptScoreBreakdown
    alignmentMatches: string[]
  }
  prompt: BenchOptResolvedPromptConfig
  context: BenchOptResolvedContextConfig
  worktree: BenchOptWorktreePlan
  downstream: {
    benchLoop: {
      candidateId: string
      promptCandidateId: string
      contextCandidateId: string
      prompt: string
      contextLines: string[]
      repositoryRoot: string
      baseRef: string
      branchName: string
      worktreePath: string
      command: string[]
    }
  }
  experiment?: {
    experimentId: string
    championTrialId: string | null
  }
  champion?: {
    championTrialId: string | null
    candidateId: string
    status: "retained" | "promoted"
    resolvedConfigPath: string | null
  }
  store?: {
    experimentPath: string | null
    championPath: string | null
    indexPath: string | null
  }
  notes: string[]
}

export interface BenchOptScoreBreakdown {
  baselineHealth: number
  promptClarity: number
  contextCoverage: number
  artifactAlignment: number
  structuralSignals: number
  penalties: number
  total: number
}

export interface BenchOptCandidateScore {
  candidate: BenchOptCandidate
  worktree: BenchOptWorktreePlan
  breakdown: BenchOptScoreBreakdown
  notes: string[]
  alignmentMatches: string[]
}

export interface BenchOptExperimentLineage {
  experimentId: string
  trialId: string | null
  parentTrialId: string | null
  generation: number
}

export interface BenchOptPromotionGate {
  requiredSplits: BenchOptTrialSplit[]
  observedSplits: BenchOptTrialSplit[]
  qualified: boolean
  missingSplits: BenchOptTrialSplit[]
  reason: string
}

export interface BenchOptExecutionRecord {
  requested: {
    materialize: boolean
    applyEdits: boolean
  }
  materialized: boolean
  applied: boolean
  worktreePath: string | null
  appliedFiles: string[]
  error: string | null
}

export interface BenchOptRunnerVerificationOptions {
  packageManager?: string
  includeTypeCheck?: boolean
  includeTests?: boolean
  benchSplits?: readonly BenchOptTrialSplit[]
  typeCheckArgs?: readonly string[]
  testArgs?: readonly string[]
  benchArgs?: readonly string[]
  commandTimeoutMs?: Partial<Record<BenchOptVerificationKind, number>>
  defaultTimeoutMs?: number
  defaultMaxOutputBytes?: number
  stopOnFailure?: boolean
  env?: NodeJS.ProcessEnv
}

export interface BenchOptRunnerKeepRejectOptions {
  baselineLabel?: string
  trialLabel?: string
  promoteMinAverageDelta?: number
  retainMinAverageDelta?: number
  retainMaxRegressions?: number
}

export interface BenchOptRunnerOrchestrationOptions {
  objective?: string
  split?: BenchOptTrialSplit
  candidateId?: string | null
  worktreePath?: string | null
  branchName?: string | null
  maxIterations?: number
  continueOnRerun?: boolean
  recordCheckpoints?: boolean
  preferredFiles?: string[]
  constraints?: string[]
  observedScore?: number | null
  forcedFollowUp?: BenchOptFollowUpAction | null
  adapters?: BenchOptRoleAdapters
}

export interface BenchOptRunnerSessionOptions {
  objective?: string
  budgets?: BenchOptSessionCreateInput["budgets"]
  forceCompaction?: boolean
  compactionTrigger?: BenchOptCompactionTrigger
  forceHandoff?: boolean
  notePrefix?: string
  resumeSessionPath?: string | null
  resumeCheckpointPath?: string | null
  resumeHandoffPath?: string | null
}

export interface BenchOptRunnerPromotionOptions {
  allowPromotion?: boolean
  liveEvaluatorPassed?: boolean
  requiredChecks?: readonly string[]
  passedChecks?: readonly string[]
  requireCanary?: boolean
  defaultChannel?: BenchOptPromotionChannel
  branchName?: string | null
  pullRequestUrl?: string | null
  canaryEnvironment?: string | null
  trialSummaryPath?: string | null
  allowPublish?: boolean
  enableBranchCreation?: boolean
  openPullRequest?: boolean
  enableCanary?: boolean
  defaultBranchPrefix?: string
  defaultBaseRef?: string
  pullRequestTitle?: string | null
  pullRequestBody?: string | null
  canaryStrategy?: "disabled" | "shadow" | "full"
  allowRollback?: boolean
  rollbackTrigger?: BenchOptRollbackTrigger
  rollbackReason?: string | null
  failedChecks?: readonly string[]
}

export interface BenchOptRunnerLiveOptions {
  scenarioId?: string | null
  /** Run all registered non-placeholder live scenarios and aggregate results. */
  runAll?: boolean
}

export interface BenchOptRunOptions {
  verification?: false | BenchOptRunnerVerificationOptions
  keepReject?: false | BenchOptRunnerKeepRejectOptions
  orchestration?: false | BenchOptRunnerOrchestrationOptions
  session?: false | BenchOptRunnerSessionOptions
  promotion?: false | BenchOptRunnerPromotionOptions
  live?: false | BenchOptRunnerLiveOptions
}

export interface BenchOptExecutionVerificationResult {
  plan: BenchOptVerificationPlan
  execution: BenchOptVerificationResult
  trialReport: BenchOptStructuredReportLike
  notes: string[]
}

export interface BenchOptExperimentTrial {
  trialId: string
  candidateId: string
  promptCandidateId: string | null
  contextCandidateId: string | null
  split: BenchOptTrialSplit
  status: BenchOptTrialStatus
  lineage: BenchOptExperimentLineage
  candidate: BenchOptCandidate
  breakdown: BenchOptScoreBreakdown
  alignmentMatches: string[]
  notes: string[]
  artifacts: {
    resolvedConfigPath: string | null
  }
}

export interface BenchOptExperimentRun {
  schemaVersion: 1
  experimentId: string
  runId: string
  generatedAt: string
  sourceArtifacts: {
    baselineReport: string | null
    candidateFiles: string[]
  }
  baseline: BenchOptBaselineSnapshot
  budget: {
    maxTrials: number
  }
  trials: BenchOptExperimentTrial[]
  summary: {
    trialCount: number
    bestTrialId: string | null
    bestScore: number | null
    evaluatedSplit: BenchOptTrialSplit
    promotionGate: BenchOptPromotionGate
  }
  championTrialId: string | null
}

export interface BenchOptChampionRecord {
  schemaVersion: 1
  championTrialId: string
  candidateId: string
  promptCandidateId: string | null
  contextCandidateId: string | null
  validationTrialId: string | null
  holdoutTrialId: string | null
  promotionSplit: BenchOptTrialSplit
  status: "retained" | "promoted"
  decisionReason: string[]
  selectedAt: string
  resolvedConfigPath: string | null
}

export interface BenchOptStoreIndex {
  schemaVersion: 1 | 2
  latestExperimentId: string | null
  latestChampionId: string | null
  latestSessionId: string | null
  latestCheckpointId: string | null
  latestCompactionId: string | null
  latestHandoffId: string | null
  latestSessionArtifacts: {
    sessionId: string | null
    sessionPath: string | null
    checkpointId: string | null
    checkpointPath: string | null
    compactionId: string | null
    compactionPath: string | null
    handoffId: string | null
    handoffPath: string | null
    runId: string | null
    generatedAt: string | null
  } | null
  experiments: Array<{
    experimentId: string
    path: string
    generatedAt: string
  }>
  champions: Array<{
    championId: string
    path: string
    generatedAt: string
  }>
  sessions: Array<{
    sessionId: string
    path: string
    generatedAt: string
  }>
  checkpoints: Array<{
    checkpointId: string
    path: string
    generatedAt: string
  }>
  compactions: Array<{
    compactionId: string
    path: string
    generatedAt: string
  }>
  handoffs: Array<{
    handoffId: string
    path: string
    generatedAt: string
  }>
}

export interface BenchOptRunReport {
  schemaVersion: 1
  runId: string
  generatedAt: string
  sourceArtifacts: {
    baselineReport: string | null
    candidateFiles: string[]
  }
  summary: {
    candidateCount: number
    baselineAvailable: boolean
    bestCandidateId: string | null
    bestScore: number | null
    averageScore: number | null
    evaluatedSplit: BenchOptTrialSplit
    promotionSplits: BenchOptTrialSplit[]
    notes: string[]
  }
  baseline: BenchOptBaselineSnapshot
  candidates: BenchOptCandidateScore[]
}

export interface BenchOptSessionArtifactsResult {
  state: BenchOptSessionState
  checkpoint: BenchOptCheckpointArtifact
  compaction: BenchOptCompactionMetadata | null
  handoff: BenchOptSessionHandoffArtifact | null
}

export interface BenchOptOrchestrationIterationResult {
  index: number
  orchestration: BenchOptOrchestrationArtifact
  sessionPhase: BenchOptSessionState["phase"]
  checkpointId: string | null
  compactionId: string | null
  handoffId: string | null
  terminal: boolean
}

export interface BenchOptOrchestrationLoopResult {
  schemaVersion: 1
  runId: string
  generatedAt: string
  bounded: true
  objective: string
  maxIterations: number
  completedIterations: number
  terminationReason: string
  iterations: BenchOptOrchestrationIterationResult[]
  finalDecision: BenchOptOrchestrationArtifact["decision"] | null
  finalHandoff: BenchOptOrchestrationArtifact["handoff"] | null
}

export interface BenchOptStatusArtifact {
  schemaVersion: 1
  runId: string
  generatedAt: string
  overallState: "idle" | "running" | "handoff" | "completed" | "kept" | "rejected" | "promoted" | "blocked"
  sourceArtifacts: {
    baselineReport: string | null
    candidateFiles: string[]
  }
  summary: {
    candidateCount: number
    bestCandidateId: string | null
    bestScore: number | null
    averageScore: number | null
    evaluatedSplit: BenchOptTrialSplit
    promotionSplits: BenchOptTrialSplit[]
    selectedPromptCandidateId: string | null
    selectedContextCandidateId: string | null
    orchestrationDecision: string | null
    orchestrationTerminationReason: string | null
    sessionPhase: BenchOptSessionState["phase"] | null
    verificationStatus: BenchOptVerificationResult["status"] | null
    liveStatus: LiveEvaluationResult["status"] | null
    livePass: boolean | null
    keepRejectDecision: BenchOptKeepRejectResult["decision"] | null
    promotionStatus: BenchOptPromotionDecision["status"] | null
    publishStatus: BenchOptPublishPlan["status"] | null
    rollbackStatus: BenchOptRollbackPlan["status"] | null
    guardrailVerdict: "pass" | "warn" | "block" | null
    redFlagCount: number | null
  }
  selection: BenchOptResolvedOptimizerConfig["selection"] | null
  execution: {
    materialized: boolean
    worktreePath: string | null
    appliedEdits: boolean
    appliedFiles: string[]
    verificationStatus: BenchOptVerificationResult["status"] | null
    keepRejectDecision: BenchOptKeepRejectResult["decision"] | null
  } | null
  live: {
    scenarioId: string
    status: LiveEvaluationResult["status"]
    pass: boolean
    score: number
    summary: string
  } | null
  orchestration: {
    decision: BenchOptOrchestrationArtifact["decision"]
    handoff: BenchOptOrchestrationArtifact["handoff"]
    objective: string
  } | null
  orchestrationLoop: {
    completedIterations: number
    maxIterations: number
    terminationReason: string
    finalDecision: BenchOptOrchestrationLoopResult["finalDecision"]
    finalHandoff: BenchOptOrchestrationLoopResult["finalHandoff"]
  } | null
  session: {
    sessionId: string
    phase: BenchOptSessionState["phase"]
    iteration: number
    completedIterations: number
    checkpointId: string
    handoffId: string | null
    compactionId: string | null
  } | null
  promotion: BenchOptPromotionDecision | null
  publishPlan: BenchOptPublishPlan | null
  rollbackPlan: BenchOptRollbackPlan | null
  safety: {
    guardrails: {
      verdict: "pass" | "warn" | "block"
      violations: Array<{
        id: string
        severity: "warning" | "critical"
        description: string
      }>
    }
    redFlags: {
      flagCount: number
      criticalCount: number
      flags: Array<{
        id: string
        severity: "warning" | "critical"
        description: string
      }>
    }
  } | null
  telemetry: {
    durationMs: number
    iterationCount: number
    candidatesKept: number
    candidatesRejected: number
    estimatedCostUsd: number | null
    scoreTrends: Array<{
      surface: string
      scores: number[]
    }>
  } | null
  store: {
    latestExperimentId: string | null
    latestChampionId: string | null
    latestSessionId: string | null
    latestCheckpointId: string | null
    latestCompactionId: string | null
    latestHandoffId: string | null
    latestSessionArtifacts: BenchOptStoreIndex["latestSessionArtifacts"]
  } | null
  paths: {
    latestJsonPath: string | null
    latestMarkdownPath: string | null
    latestResolvedJsonPath: string | null
    latestResolvedMarkdownPath: string | null
    latestOrchestrationJsonPath: string | null
    latestOrchestrationLoopJsonPath: string | null
    latestSessionJsonPath: string | null
    latestCheckpointJsonPath: string | null
    latestCompactionJsonPath: string | null
    latestHandoffJsonPath: string | null
    latestLiveJsonPath: string | null
    latestPromotionJsonPath: string | null
    latestPublishJsonPath: string | null
    latestRollbackJsonPath: string | null
    latestStatusJsonPath: string | null
    latestStatusMarkdownPath: string | null
    storeIndexPath: string | null
  }
  notes: string[]
}

export interface BenchOptRunResult {
  report: BenchOptRunReport
  experiment?: BenchOptExperimentRun | null
  champion?: BenchOptChampionRecord | null
  execution?: BenchOptExecutionResult | null
  orchestration?: BenchOptOrchestrationArtifact | null
  orchestrationLoop?: BenchOptOrchestrationLoopResult | null
  orchestrationIterations?: BenchOptOrchestrationArtifact[] | null
  session?: BenchOptSessionArtifactsResult | null
  live?: LiveEvaluationResult | null
  promotion?: BenchOptPromotionDecision | null
  publishPlan?: BenchOptPublishPlan | null
  rollbackPlan?: BenchOptRollbackPlan | null
  status?: BenchOptStatusArtifact | null
  text: string
  paths: {
    outputDir: string
    latestJsonPath: string
    latestMarkdownPath: string
    latestResolvedJsonPath: string | null
    latestResolvedMarkdownPath: string | null
    latestOrchestrationJsonPath: string | null
    latestOrchestrationMarkdownPath: string | null
    latestOrchestrationLoopJsonPath: string | null
    latestOrchestrationLoopMarkdownPath: string | null
    orchestrationIterationsDirPath: string | null
    latestSessionJsonPath: string | null
    latestSessionMarkdownPath: string | null
    latestCheckpointJsonPath: string | null
    latestCheckpointMarkdownPath: string | null
    latestCompactionJsonPath: string | null
    latestCompactionMarkdownPath: string | null
    latestHandoffJsonPath: string | null
    latestHandoffMarkdownPath: string | null
    latestLiveJsonPath: string | null
    latestLiveMarkdownPath: string | null
    latestPromotionJsonPath: string | null
    latestPromotionMarkdownPath: string | null
    latestPublishJsonPath: string | null
    latestPublishMarkdownPath: string | null
    latestRollbackJsonPath: string | null
    latestRollbackMarkdownPath: string | null
    latestStatusJsonPath: string | null
    latestStatusMarkdownPath: string | null
    experimentPath: string | null
    championPath: string | null
    storeIndexPath: string | null
  } | null
}

export interface BenchOptExecutionResult {
  candidateId: string
  materialization: BenchOptMaterializationResult
  edits: {
    enabled: boolean
    applied: boolean
    files: string[]
  }
  verification?: BenchOptExecutionVerificationResult | null
  keepReject?: BenchOptKeepRejectResult | null
  notes: string[]
}

export interface BenchOptMaterializationResult {
  plan: BenchOptWorktreePlan
  executed: boolean
  materializedPath: string
}
