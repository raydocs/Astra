export type BenchmarkSurface =
  | "page-translation"
  | "site-automation"
  | "interaction-priority"
  | "frame-coordination"
  | "dynamic-content"
  | "article-extraction"
  | "hover"
  | "selection-explain"
  | "input-translation"
  | "subtitle"

export type BenchmarkSplit = "train" | "validation" | "holdout"

export type IssueSeverity = "critical" | "high" | "medium" | "low"

export type OptimizerContextSlot =
  | "task"
  | "surface"
  | "fixture"
  | "codeHint"
  | "history"
  | "candidateFiles"
  | "reportSummary"
  | "patchHints"

export interface ResolvedOptimizerPromptPolicy {
  analysisMode: "minimal" | "analysis-first"
  toolPolicy: "default" | "read-before-edit"
  writeScopeMode: "strict" | "evidence-led"
}

export interface ResolvedOptimizerContextPolicy {
  rankingMode: "balanced" | "explicit-first"
  maxFiles: number
  maxLinesPerFile: number
  preferHistory: boolean
}

export interface ResolvedOptimizerPromptCandidate {
  id: string
  label: string
  description: string
  text: string
  policy: ResolvedOptimizerPromptPolicy
}

export interface ResolvedOptimizerContextCandidate {
  id: string
  label: string
  description: string
  slots: OptimizerContextSlot[]
  policy: ResolvedOptimizerContextPolicy
}

export interface ResolvedOptimizerConfig {
  sourcePath: string
  sourceKind: "bench-opt-report" | "direct-config"
  prompt: ResolvedOptimizerPromptCandidate | null
  context: ResolvedOptimizerContextCandidate | null
}

export interface BenchmarkIssue {
  severity: IssueSeverity
  message: string
  evidence?: string
}

export interface ScoreBreakdown {
  correctness: number
  completeness: number
  stability: number
  [key: string]: number
}

export interface ScenarioCodeHint {
  suspectedFiles?: string[]
  suspectedSymbols?: string[]
  suspectedKeywords?: string[]
  fallbackSurfaceFiles?: string[]
  risk?: "local" | "cross-module"
}

export interface PatchHintArtifact {
  suspectedFiles?: string[]
  suspectedSymbols?: string[]
  suspectedKeywords?: string[]
  failingSignals?: string[]
  confidence?: "low" | "medium" | "high"
}

export interface RepairHintSummary {
  suspectedFiles: string[]
  suspectedSymbols: string[]
  suspectedKeywords: string[]
  failingSignals: string[]
  confidence: "low" | "medium" | "high" | null
  risk: "local" | "cross-module" | null
}

export interface EvaluationResult {
  scores: ScoreBreakdown
  total: number
  pass: boolean
  issues: BenchmarkIssue[]
  artifacts: Record<string, unknown> & {
    patchHints?: PatchHintArtifact
  }
  nextActions: string[]
}

export interface ScenarioEvaluation<TExecution = unknown> {
  execution: TExecution
  evaluation: EvaluationResult
}

export interface BenchmarkScenario<TExecution = unknown> {
  id: string
  title: string
  surface: BenchmarkSurface
  fixture: string
  task: string
  run: () => Promise<TExecution>
  evaluate: (execution: TExecution) => EvaluationResult
  codeHint?: ScenarioCodeHint
}

export interface SurfaceSummary {
  surface: BenchmarkSurface
  scenarioCount: number
  passed: number
  failed: number
  averageTotal: number
}

export interface ScenarioReport<TExecution = unknown> {
  id: string
  title: string
  surface: BenchmarkSurface
  fixture: string
  task: string
  execution: TExecution
  evaluation: EvaluationResult
  codeHint?: ScenarioCodeHint
  repairHints?: RepairHintSummary
}

export interface ScenarioDelta {
  id: string
  previousTotal: number | null
  currentTotal: number
  delta: number | null
  status: "new" | "improved" | "regressed" | "unchanged"
  wasPassing: boolean | null
  isPassing: boolean
  scoreDeltas: Array<{
    key: string
    previous: number | null
    current: number
    delta: number | null
  }>
  regressedScores: string[]
  improvedScores: string[]
}

export interface BenchmarkComparison {
  previousRunId: string | null
  previousGeneratedAt: string | null
  overallDelta: number | null
  scenarioDeltas: ScenarioDelta[]
  regressions: number
  improvements: number
  unchanged: number
  added: number
}

export interface BenchmarkInventory {
  totalScenarios: number
  bySurface: Record<string, number>
  bySplit: Record<BenchmarkSplit, number>
}

export interface BenchmarkReport {
  schemaVersion: 1
  runId: string
  generatedAt: string
  filter: {
    surface: BenchmarkSurface | null
    split: BenchmarkSplit | null
  }
  summary: {
    totalScenarios: number
    passedScenarios: number
    failedScenarios: number
    averageTotal: number
    surfaces: SurfaceSummary[]
  }
  inventory?: BenchmarkInventory
  comparison: BenchmarkComparison
  scenarios: ScenarioReport[]
}

export interface GeneratorHandoffItem {
  id: string
  title: string
  surface: BenchmarkSurface
  status: "new" | "improved" | "regressed" | "unchanged"
  priority: "critical" | "high" | "medium"
  total: number
  previousTotal: number | null
  delta: number | null
  pass: boolean
  issueCount: number
  issues: BenchmarkIssue[]
  nextActions: string[]
  scoreDeltas: Array<{
    key: string
    previous: number | null
    current: number
    delta: number | null
  }>
  suggestedPrompt: string
  repairHints?: RepairHintSummary
  selectionScore?: number
  selectionReasons?: string[]
}

export interface GeneratorHandoff {
  schemaVersion: 1
  runId: string
  generatedAt: string
  sourceArtifacts: {
    latestJson: string
    latestFeedback: string
  }
  summary: {
    totalScenarios: number
    failedScenarios: number
    regressedScenarios: number
    imperfectPasses: number
  }
  priorities: GeneratorHandoffItem[]
}

export interface HistoryWeakSurfaceSignal {
  surface: BenchmarkSurface
  averageTotal: number
  direction: "improving" | "regressing" | "flat"
  failureRuns: number
}

export interface HistoryRecurringFailureSignal {
  id: string
  surface: BenchmarkSurface
  occurrenceCount?: number
  failureCount?: number
  regressionCount?: number
  issueCount: number
  averageTotal?: number
  latestTotal: number
  worstTotal: number
}

export interface HistoryPromptSummary {
  sourceJsonPath: string | null
  sourceMarkdownPath: string | null
  totalRuns: number
  notes: string[]
  weakestSurfaces: HistoryWeakSurfaceSignal[]
  recurringFailures: HistoryRecurringFailureSignal[]
}

export interface LoopPlan {
  schemaVersion: 1
  runId: string
  generatedAt: string
  optimizer?: ResolvedOptimizerConfig
  sourceArtifacts: {
    latestHandoff: string
    latestFeedback: string
    latestJson: string
    latestHistoryJson?: string
    latestHistoryMarkdown?: string
  }
  selection: {
    maxItems: number
    includeMedium: boolean
    selectedCount: number
    mode: "critical-high" | "polish"
  }
  drill: {
    enabled: boolean
    scenarioId: string | null
    reason: string | null
    historyReady?: boolean
  }
  summary: {
    failedScenarios: number
    regressedScenarios: number
    imperfectPasses: number
  }
  history?: HistoryPromptSummary
  selectedItems: GeneratorHandoffItem[]
}

export interface PatchTaskCandidateFile {
  path: string
  reasons: string[]
  symbols: string[]
  keywords: string[]
  priority: number
}

export interface PatchTask {
  schemaVersion: 2
  runId: string
  generatedAt: string
  sourceArtifacts: {
    latestLoop: string
    latestHandoff: string
    latestFeedback: string
    latestJson: string
    latestHistoryJson?: string
    latestHistoryMarkdown?: string
    latestOptimizerConfig?: string
  }
  focus: {
    primaryScenarioId: string | null
    primarySurface: BenchmarkSurface | null
    scenarioIds: string[]
    scenarioCount: number
  }
  candidateFiles: PatchTaskCandidateFile[]
  relevantFiles: string[]
  validationCommands: string[]
  instructions: string[]
  history?: HistoryPromptSummary
  optimizer?: ResolvedOptimizerConfig
  prompt: string
}

export interface PatchContextSlice {
  startLine: number
  endLine: number
  reason: string
  strategy: "symbol" | "keyword" | "import-neighbor" | "fallback-head" | "fallback-tail"
}

export interface PatchContextFile {
  path: string
  exists: boolean
  lineCount: number
  includedLines: number
  truncated: boolean
  slices: PatchContextSlice[]
  content: string
}

export interface PatchContextPack {
  schemaVersion: 2
  runId: string
  generatedAt: string
  sourceArtifacts: {
    latestPatchTask: string
    latestLoop: string
    latestHandoff: string
    latestFeedback: string
    latestJson: string
    latestOptimizerConfig?: string
  }
  budget: {
    maxFiles: number
    maxLinesPerFile: number
    maxTotalLines: number
  }
  optimizer?: ResolvedOptimizerConfig
  files: PatchContextFile[]
}

export interface PatchPass {
  schemaVersion: 1
  runId: string
  generatedAt: string
  sourceArtifacts: {
    latestPatchTask: string
    latestPatchContext: string
    latestLoop: string
    latestHandoff: string
    latestFeedback: string
    latestJson: string
    latestHistoryJson?: string
    latestHistoryMarkdown?: string
    latestOptimizerConfig?: string
  }
  summary: {
    primaryScenarioId: string | null
    primarySurface: BenchmarkSurface | null
    scenarioCount: number
    relevantFileCount: number
    contextFileCount: number
  }
  execution: {
    writeScope: string[]
    validationCommands: string[]
    stopConditions: string[]
  }
  history?: HistoryPromptSummary
  optimizer?: ResolvedOptimizerConfig
  prompt: string
}

export interface ExecutorScenario {
  id: string
  surface: BenchmarkSurface
  priority: "critical" | "high" | "medium"
  status: "new" | "improved" | "regressed" | "unchanged"
  pass: boolean
  reasons: string[]
}

export interface ExecutorAttempt {
  schemaVersion: 1
  runId: string
  generatedAt: string
  sourceArtifacts: {
    latestPatchPass: string
    latestPatchTask: string
    latestPatchContext: string
    latestLoop: string
    latestHandoff: string
    latestFeedback: string
    latestJson: string
    latestOptimizerConfig?: string
  }
  status: "ready" | "blocked"
  summary: {
    selectedScenarioCount: number
    actionableScenarioCount: number
    primaryScenarioId: string | null
    blockReason: string | null
    gateSummary: ExecutorGateSummary
  }
  actionableScenarios: ExecutorScenario[]
  writeScope: string[]
  optimizer?: ResolvedOptimizerConfig
  prompt: string | null
}

export interface ExecutorGateSummary {
  decision: "ready" | "blocked"
  reason: string | null
  error: string | null
}

export interface ExecutorDispatchGateSummary {
  decision: "blocked" | "executed" | "failed"
  reason: string | null
  error: string | null
}

export interface ExecutorDispatch {
  schemaVersion: 1
  runId: string
  generatedAt: string
  sourceArtifacts: {
    latestExecutor: string
    latestPatchPass: string
    latestPatchContext: string
  }
  provider: {
    id: "openai"
    model: string
    baseURL: string | null
  }
  status: "blocked" | "executed" | "failed"
  summary: {
    attempted: boolean
    promptChars: number
    responseChars: number
    blockReason: string | null
    error: string | null
    gateSummary: ExecutorDispatchGateSummary
  }
  prompt: string | null
  response: string | null
}
