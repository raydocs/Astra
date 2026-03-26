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

export type IssueSeverity = "critical" | "high" | "medium" | "low"

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

export interface EvaluationResult {
  scores: ScoreBreakdown
  total: number
  pass: boolean
  issues: BenchmarkIssue[]
  artifacts: Record<string, unknown>
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

export interface BenchmarkReport {
  schemaVersion: 1
  runId: string
  generatedAt: string
  filter: {
    surface: BenchmarkSurface | null
  }
  summary: {
    totalScenarios: number
    passedScenarios: number
    failedScenarios: number
    averageTotal: number
    surfaces: SurfaceSummary[]
  }
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

export interface LoopPlan {
  schemaVersion: 1
  runId: string
  generatedAt: string
  sourceArtifacts: {
    latestHandoff: string
    latestFeedback: string
    latestJson: string
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
  }
  summary: {
    failedScenarios: number
    regressedScenarios: number
    imperfectPasses: number
  }
  selectedItems: GeneratorHandoffItem[]
}

export interface PatchTask {
  schemaVersion: 1
  runId: string
  generatedAt: string
  sourceArtifacts: {
    latestLoop: string
    latestHandoff: string
    latestFeedback: string
    latestJson: string
  }
  focus: {
    primaryScenarioId: string | null
    primarySurface: BenchmarkSurface | null
    scenarioIds: string[]
    scenarioCount: number
  }
  relevantFiles: string[]
  validationCommands: string[]
  instructions: string[]
  prompt: string
}

export interface PatchContextFile {
  path: string
  exists: boolean
  lineCount: number
  includedLines: number
  truncated: boolean
  content: string
}

export interface PatchContextPack {
  schemaVersion: 1
  runId: string
  generatedAt: string
  sourceArtifacts: {
    latestPatchTask: string
    latestLoop: string
    latestHandoff: string
    latestFeedback: string
    latestJson: string
  }
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
  }
  status: "ready" | "blocked"
  summary: {
    selectedScenarioCount: number
    actionableScenarioCount: number
    primaryScenarioId: string | null
    blockReason: string | null
  }
  actionableScenarios: ExecutorScenario[]
  writeScope: string[]
  prompt: string | null
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
  }
  prompt: string | null
  response: string | null
}
