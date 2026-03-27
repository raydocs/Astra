import type { BenchOptOrchestrationArtifact } from "./orchestrator.ts"
import type { BenchOptPromotionDecision } from "./promote.ts"
import type { BenchOptPublishPlan } from "./publish.ts"
import type { BenchOptRollbackPlan } from "./rollback.ts"
import type { LiveEvaluationResult } from "../bench-live/index"
import type {
  BenchOptExecutionResult,
  BenchOptOrchestrationLoopResult,
  BenchOptResolvedOptimizerConfig,
  BenchOptRunReport,
  BenchOptSessionArtifactsResult,
  BenchOptStatusArtifact,
  BenchOptStoreIndex,
} from "./types.ts"

function deriveOverallState(input: {
  session: BenchOptSessionArtifactsResult | null
  promotion: BenchOptPromotionDecision | null
  execution: BenchOptExecutionResult | null
  orchestrationLoop: BenchOptOrchestrationLoopResult | null
  guardrailVerdict?: "pass" | "warn" | "block" | null
}): BenchOptStatusArtifact["overallState"] {
  if (input.promotion?.status === "promoted") {
    return "promoted"
  }

  if (input.execution?.keepReject?.decision === "reject") {
    return "rejected"
  }

  if (input.execution?.keepReject?.decision === "retain" || input.orchestrationLoop?.finalDecision?.action === "keep") {
    return "kept"
  }

  if (input.session?.state.phase === "handoff") {
    return "handoff"
  }

  if (input.session?.state.phase === "completed") {
    return "completed"
  }

  if (input.promotion?.status === "blocked") {
    return "blocked"
  }

  // Guardrail block: if verdict is "block" and not yet promoted, block the run
  if (input.guardrailVerdict === "block") {
    return "blocked"
  }

  if (input.session?.state.phase === "running" || input.orchestrationLoop) {
    return "running"
  }

  return "idle"
}

export function buildBenchOptStatusArtifact(input: {
  report: BenchOptRunReport
  resolvedConfig: BenchOptResolvedOptimizerConfig | null
  execution: BenchOptExecutionResult | null
  live: LiveEvaluationResult | null
  orchestration: BenchOptOrchestrationArtifact | null
  orchestrationLoop: BenchOptOrchestrationLoopResult | null
  session: BenchOptSessionArtifactsResult | null
  promotion: BenchOptPromotionDecision | null
  publishPlan: BenchOptPublishPlan | null
  rollbackPlan: BenchOptRollbackPlan | null
  safety?: {
    guardrails: { verdict: "pass" | "warn" | "block"; violations: Array<{ id: string; severity: "warning" | "critical"; description: string }> }
    redFlags: { flagCount: number; criticalCount: number; flags: Array<{ id: string; severity: "warning" | "critical"; description: string }> }
  } | null
  telemetry?: {
    durationMs: number
    iterationCount: number
    candidatesKept: number
    candidatesRejected: number
    estimatedCostUsd: number | null
    scoreTrends: Array<{ surface: string; scores: number[] }>
  } | null
  store: BenchOptStoreIndex | null
  paths: BenchOptStatusArtifact["paths"]
}): BenchOptStatusArtifact {
  const { report, resolvedConfig, execution, live, orchestration, orchestrationLoop, session, promotion, publishPlan, rollbackPlan, safety, telemetry, store, paths } = input

  const notes = [
    ...report.summary.notes,
    resolvedConfig
      ? `Selected prompt/context pair: ${resolvedConfig.prompt.id} + ${resolvedConfig.context.id}.`
      : "No resolved optimizer config was materialized.",
    execution
      ? `Execution path ${execution.materialization.executed ? "materialized" : "remained dry-run"}.`
      : "Execution path was not requested.",
    live
      ? `Live evaluator status: ${live.status}.`
      : "Live evaluator was not requested.",
    orchestrationLoop
      ? `Orchestration loop completed ${orchestrationLoop.completedIterations}/${orchestrationLoop.maxIterations} iteration(s).`
      : "Orchestration loop was not requested.",
    session
      ? `Session phase: ${session.state.phase}.`
      : "Session lifecycle was not requested.",
    promotion
      ? `Promotion status: ${promotion.status}.`
      : "Promotion planning was not requested.",
    safety
      ? `Safety guardrails verdict: ${safety.guardrails.verdict} (${safety.guardrails.violations.length} violation(s)), red flags: ${safety.redFlags.flagCount} (${safety.redFlags.criticalCount} critical).`
      : "Safety checks were not requested.",
    telemetry
      ? `Telemetry: ${telemetry.iterationCount} iteration(s), ${telemetry.durationMs}ms, ${telemetry.candidatesKept} kept / ${telemetry.candidatesRejected} rejected.`
      : "Telemetry was not collected.",
  ]

  return {
    schemaVersion: 1,
    runId: report.runId,
    generatedAt: report.generatedAt,
    overallState: deriveOverallState({ session, promotion, execution, orchestrationLoop, guardrailVerdict: safety?.guardrails.verdict ?? null }),
    sourceArtifacts: report.sourceArtifacts,
    summary: {
      candidateCount: report.summary.candidateCount,
      bestCandidateId: report.summary.bestCandidateId,
      bestScore: report.summary.bestScore,
      averageScore: report.summary.averageScore,
      evaluatedSplit: report.summary.evaluatedSplit,
      promotionSplits: report.summary.promotionSplits,
      selectedPromptCandidateId: resolvedConfig?.selection.promptCandidateId ?? null,
      selectedContextCandidateId: resolvedConfig?.selection.contextCandidateId ?? null,
      orchestrationDecision: orchestration?.decision.action ?? orchestrationLoop?.finalDecision?.action ?? null,
      orchestrationTerminationReason: orchestrationLoop?.terminationReason ?? null,
      sessionPhase: session?.state.phase ?? null,
      verificationStatus: execution?.verification?.execution.status ?? null,
      liveStatus: live?.status ?? null,
      livePass: live?.pass ?? null,
      keepRejectDecision: execution?.keepReject?.decision ?? null,
      promotionStatus: promotion?.status ?? null,
      publishStatus: publishPlan?.status ?? null,
      rollbackStatus: rollbackPlan?.status ?? null,
      guardrailVerdict: safety?.guardrails.verdict ?? null,
      redFlagCount: safety?.redFlags.flagCount ?? null,
    },
    selection: resolvedConfig?.selection ?? null,
    execution: execution
      ? {
          materialized: execution.materialization.executed,
          worktreePath: execution.materialization.materializedPath,
          appliedEdits: execution.edits.applied,
          appliedFiles: execution.edits.files,
          verificationStatus: execution.verification?.execution.status ?? null,
          keepRejectDecision: execution.keepReject?.decision ?? null,
        }
      : null,
    live: live
      ? {
          scenarioId: live.scenario.id,
          status: live.status,
          pass: live.pass,
          score: live.score,
          summary: live.summary,
        }
      : null,
    orchestration: orchestration
      ? {
          decision: orchestration.decision,
          handoff: orchestration.handoff,
          objective: orchestration.objective,
        }
      : null,
    orchestrationLoop: orchestrationLoop
      ? {
          completedIterations: orchestrationLoop.completedIterations,
          maxIterations: orchestrationLoop.maxIterations,
          terminationReason: orchestrationLoop.terminationReason,
          finalDecision: orchestrationLoop.finalDecision,
          finalHandoff: orchestrationLoop.finalHandoff,
        }
      : null,
    session: session
      ? {
          sessionId: session.state.sessionId,
          phase: session.state.phase,
          iteration: session.state.progress.iteration,
          completedIterations: session.state.progress.completedIterations,
          checkpointId: session.checkpoint.checkpointId,
          handoffId: session.handoff?.handoffId ?? null,
          compactionId: session.compaction?.compactionId ?? null,
        }
      : null,
    promotion: promotion ?? null,
    publishPlan: publishPlan ?? null,
    rollbackPlan: rollbackPlan ?? null,
    safety: safety ?? null,
    telemetry: telemetry ?? null,
    store: store
      ? {
          latestExperimentId: store.latestExperimentId,
          latestChampionId: store.latestChampionId,
          latestSessionId: store.latestSessionId,
          latestCheckpointId: store.latestCheckpointId,
          latestCompactionId: store.latestCompactionId,
          latestHandoffId: store.latestHandoffId,
          latestSessionArtifacts: store.latestSessionArtifacts,
        }
      : null,
    paths,
    notes,
  }
}

export function renderBenchOptStatusMarkdown(status: BenchOptStatusArtifact) {
  const lines = [
    "# Astra Bench Opt Status",
    "",
    `- Run ID: \`${status.runId}\``,
    `- Generated: ${status.generatedAt}`,
    `- Overall state: ${status.overallState}`,
    `- Best candidate: ${status.summary.bestCandidateId ?? "none"}`,
    `- Evaluated split: ${status.summary.evaluatedSplit}`,
    `- Promotion splits: ${status.summary.promotionSplits.join(", ")}`,
    "",
    "## Summary",
    `- Candidate count: ${status.summary.candidateCount}`,
    `- Best score: ${status.summary.bestScore ?? "n/a"}`,
    `- Average score: ${status.summary.averageScore ?? "n/a"}`,
    `- Verification: ${status.summary.verificationStatus ?? "n/a"}`,
    `- Live evaluator: ${status.summary.liveStatus ?? "n/a"}${status.summary.livePass === null ? "" : status.summary.livePass ? " (pass)" : " (not passed)"}`,
    `- Keep/reject: ${status.summary.keepRejectDecision ?? "n/a"}`,
    `- Orchestration decision: ${status.summary.orchestrationDecision ?? "n/a"}`,
    `- Session phase: ${status.summary.sessionPhase ?? "n/a"}`,
    `- Promotion: ${status.summary.promotionStatus ?? "n/a"}`,
    `- Publish: ${status.summary.publishStatus ?? "n/a"}`,
    `- Rollback: ${status.summary.rollbackStatus ?? "n/a"}`,
    "",
    "## Selection",
    `- Prompt candidate: ${status.summary.selectedPromptCandidateId ?? "n/a"}`,
    `- Context candidate: ${status.summary.selectedContextCandidateId ?? "n/a"}`,
    `- Selection rank: ${status.selection?.rank ?? "n/a"}`,
    `- Selection score: ${status.selection?.score ?? "n/a"}`,
    "",
    "## Paths",
    `- Latest report: ${status.paths.latestJsonPath ?? "n/a"}`,
    `- Latest resolved: ${status.paths.latestResolvedJsonPath ?? "n/a"}`,
    `- Latest orchestration loop: ${status.paths.latestOrchestrationLoopJsonPath ?? "n/a"}`,
    `- Latest session: ${status.paths.latestSessionJsonPath ?? "n/a"}`,
    `- Latest live: ${status.paths.latestLiveJsonPath ?? "n/a"}`,
    `- Latest promotion: ${status.paths.latestPromotionJsonPath ?? "n/a"}`,
    `- Latest status JSON: ${status.paths.latestStatusJsonPath ?? "n/a"}`,
    `- Store index: ${status.paths.storeIndexPath ?? "n/a"}`,
    "",
  ]

  if (status.session) {
    lines.push(
      "## Session",
      `- Session ID: \`${status.session.sessionId}\``,
      `- Iteration: ${status.session.iteration}`,
      `- Completed iterations: ${status.session.completedIterations}`,
      `- Checkpoint ID: \`${status.session.checkpointId}\``,
      `- Handoff ID: ${status.session.handoffId ?? "none"}`,
      `- Compaction ID: ${status.session.compactionId ?? "none"}`,
      "",
    )
  }

  if (status.orchestrationLoop) {
    lines.push(
      "## Orchestration Loop",
      `- Completed iterations: ${status.orchestrationLoop.completedIterations}/${status.orchestrationLoop.maxIterations}`,
      `- Termination: ${status.orchestrationLoop.terminationReason}`,
      `- Final decision: ${status.orchestrationLoop.finalDecision ?? "n/a"}`,
      `- Final handoff: ${status.orchestrationLoop.finalHandoff ?? "n/a"}`,
      "",
    )
  }

  if (status.live) {
    lines.push(
      "## Live Evaluator",
      `- Scenario: ${status.live.scenarioId}`,
      `- Status: ${status.live.status}`,
      `- Pass: ${status.live.pass ? "yes" : "no"}`,
      `- Score: ${status.live.score}`,
      `- Summary: ${status.live.summary}`,
      "",
    )
  }

  if (status.promotion) {
    lines.push(
      "## Promotion",
      `- Status: ${status.promotion.status}`,
      `- Channel: ${status.promotion.channel}`,
      `- Promote: ${status.promotion.promote ? "yes" : "no"}`,
      `- Missing splits: ${status.promotion.gate.missingSplits.join(", ") || "none"}`,
      `- Missing checks: ${status.promotion.gate.missingChecks.join(", ") || "none"}`,
      "",
    )
  }

  if (status.safety) {
    lines.push(
      "## Safety",
      `- Guardrail verdict: ${status.safety.guardrails.verdict}`,
      `- Guardrail violations: ${status.safety.guardrails.violations.length}`,
      ...status.safety.guardrails.violations.map(
        (v) => `  - [${v.severity}] ${v.id}: ${v.description}`,
      ),
      `- Red flags: ${status.safety.redFlags.flagCount} (${status.safety.redFlags.criticalCount} critical)`,
      ...status.safety.redFlags.flags.map(
        (f) => `  - [${f.severity}] ${f.id}: ${f.description}`,
      ),
      "",
    )
  }

  if (status.telemetry) {
    lines.push(
      "## Telemetry",
      `- Duration: ${status.telemetry.durationMs}ms`,
      `- Iterations: ${status.telemetry.iterationCount}`,
      `- Candidates kept: ${status.telemetry.candidatesKept}`,
      `- Candidates rejected: ${status.telemetry.candidatesRejected}`,
      `- Estimated cost: ${status.telemetry.estimatedCostUsd !== null ? `$${status.telemetry.estimatedCostUsd.toFixed(4)}` : "n/a"}`,
      `- Score trends: ${status.telemetry.scoreTrends.length} surface(s)`,
      ...status.telemetry.scoreTrends.map(
        (t) => `  - ${t.surface}: [${t.scores.map((s) => s.toFixed(3)).join(", ")}]`,
      ),
      "",
    )
  }

  lines.push("## Notes", ...status.notes.map((note) => `- ${note}`), "")
  return lines.join("\n")
}
