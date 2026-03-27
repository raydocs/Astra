export type {
  BenchArtifactReportLike,
  BenchArtifactScenarioLike,
  BenchOptBaselineSnapshot,
  BenchOptCandidate,
  BenchOptCandidateInput,
  BenchOptCandidateScore,
  BenchOptChampionRecord,
  BenchOptExperimentLineage,
  BenchOptExperimentRun,
  BenchOptExperimentTrial,
  BenchOptEditInstruction,
  BenchOptExecutionResult,
  BenchOptMaterializationResult,
  BenchOptOrchestrationIterationResult,
  BenchOptOrchestrationLoopResult,
  BenchOptResolvedContextConfig,
  BenchOptResolvedOptimizerConfig,
  BenchOptResolvedPromptConfig,
  BenchOptRunnerPromotionOptions,
  BenchOptRunnerSessionOptions,
  BenchOptRunReport,
  BenchOptRunResult,
  BenchOptScoreBreakdown,
  BenchOptSessionArtifactsResult,
  BenchOptStatusArtifact,
  BenchOptStoreIndex,
  BenchOptTrialSplit,
  BenchOptTrialStatus,
  BenchOptWorktreePlan,
  ContextOptimizerCandidate,
  OptimizerCandidate,
  OptimizerCandidateBase,
  OptimizerCandidateKind,
  OptimizerContextSlot,
  OptimizerPhase,
  OptimizerRegistry,
  PromptOptimizerCandidate,
} from "./types"

export type {
  BenchOptAutoLoopArtifact,
  BenchOptAutoLoopCycle,
} from "./autoloop"

export {
  contextCandidates,
} from "./candidates/context"

export {
  promptCandidates,
} from "./candidates/prompt"

export {
  createOptimizerRegistry,
  getOptimizerCandidate,
  listOptimizerCandidates,
  phase1OptimizerCandidates,
  phase1OptimizerRegistry,
} from "./registry"

export {
  selectBenchOptChampion,
  compareBenchOptTrials,
  decideBenchOptTrialStatus,
  describeMutationLineage,
} from "./champion"

export type {
  BenchOptChampionMutationMeta,
  BenchOptChampionRecordWithMutation,
} from "./champion"

export {
  createBenchOptExperimentRun,
  materializeBenchOptTrials,
} from "./experiments"

export {
  runBenchOpt,
  printBenchOptHelp,
  describeBenchOptReport,
  runBenchOptOrchestrationLoop,
  renderOrchestrationLoopSummary,
  renderOrchestrationLoopMarkdown,
} from "./runner"

export {
  buildBenchOptStatusArtifact,
  renderBenchOptStatusMarkdown,
} from "./status"

export {
  runBenchOptAutoLoop,
} from "./autoloop"

export {
  applyPatchInstructions,
} from "./apply"

export {
  buildWorktreePlan,
  renderWorktreePlan,
} from "./worktree"

export {
  materializeCandidate,
  executeMaterializedCandidate,
  materializeWorktreePlan,
} from "./materialize"

export {
  loadBenchOptStore,
  saveBenchOptChampion,
  saveBenchOptExperiment,
} from "./store"

export {
  compareCandidateScores,
  normalizeBaseline,
  normalizeCandidate,
  scoreCandidate,
} from "./score"

export {
  compareBenchOptChampionAndChallenger,
  compareBenchOptReports,
  compareBenchOptReportsWithMutationContext,
  describeMutationDiff,
} from "./compare"

export type {
  BenchOptMutationContext,
} from "./compare"

export {
  compareAndDecideBenchOptKeepReject,
  compareAndDecideChampionAndChallenger,
  decideBenchOptKeepReject,
  describeMutationKindContext,
} from "./keep-reject"

export {
  buildBenchOptVerificationPlan,
  runBenchOptVerification,
  runBenchOptVerificationPlan,
} from "./verify"

export {
  runBoundedCommandSequence,
} from "./rerun"

export type {
  BenchOptRerunMutationContext,
} from "./rerun"

export {
  buildBenchOptPlannerArtifact,
} from "./planner"

export {
  buildBenchOptGeneratorArtifact,
} from "./generator"

export {
  buildBenchOptEvaluatorArtifact,
} from "./evaluator"

export {
  buildBenchOptHandoffRequest,
  createBenchOptIterationBudget,
  createBenchOptRefinePolicy,
  createScoreHistory,
  decideBenchOptFollowUp,
  decideBenchOptFollowUpWithHistory,
  recordScore,
  analyzeScoreTrend,
  shouldPivot,
} from "./strategy"

export type {
  ScoreHistory,
  ScoreHistoryEntry,
  ScoreHistoryTrend,
} from "./strategy"

export {
  runBenchOptOrchestration,
} from "./orchestrator"

export {
  createBenchOptSessionState,
  touchBenchOptSessionState,
  updateBenchOptSessionState,
  appendBenchOptSessionNote,
  appendBenchOptSessionArtifactPath,
  getBenchOptSessionElapsedMs,
  isBenchOptSessionOverBudget,
  resumeBenchOptSessionState,
} from "./session"

export {
  createBenchOptCheckpoint,
  recordBenchOptCheckpoint,
} from "./checkpoints"

export {
  shouldBenchOptCompactSession,
  createBenchOptCompactionMetadata,
  recordBenchOptCompaction,
} from "./compaction"

export {
  createBenchOptSessionHandoffArtifact,
  recordBenchOptSessionHandoff,
} from "./handoff"

export {
  decideBenchOptPromotion,
  validatePrePromotion,
  createPromotionBranch,
  executeBenchOptPromotion,
} from "./promote"

export type {
  BenchOptPromotionArtifact,
  BenchOptPromotionExecutionOptions,
  BenchOptPromotionExecutionResult,
  BenchOptPrePromotionValidation,
} from "./promote"

export {
  buildBenchOptPublishPlan,
  validatePublishChecklist,
  executeBenchOptPublish,
} from "./publish"

export type {
  BenchOptPublishArtifact,
  BenchOptPublishChecklist,
  BenchOptPublishExecutionOptions,
  BenchOptPublishExecutionResult,
} from "./publish"

export {
  buildBenchOptRollbackPlan,
  validateRollbackSafety,
  loadPreviousChampionForRollback,
  executeBenchOptRollback,
} from "./rollback"

export type {
  BenchOptRollbackArtifact,
  BenchOptRollbackSafetyChecks,
  BenchOptRollbackChampionState,
  BenchOptRollbackExecutionOptions,
  BenchOptRollbackExecutionResult,
} from "./rollback"
