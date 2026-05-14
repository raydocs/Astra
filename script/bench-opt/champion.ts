import type { BenchOptChampionRecord, BenchOptExperimentRun, BenchOptExperimentTrial, OptimizerCandidateKind } from "./types.ts"
import type { ToolDiffEntry } from "./mutate-tools.ts"
import type { GraphDiffEntry } from "./mutate-graph.ts"

export function decideBenchOptTrialStatus(
  trial: BenchOptExperimentTrial,
  championTrialId: string | null,
  promoted: boolean,
): BenchOptExperimentTrial["status"] {
  if (trial.trialId === championTrialId) {
    return promoted ? "promoted" : "retained"
  }

  if (trial.split === "validation") {
    return "retained"
  }

  return "rejected"
}

export function compareBenchOptTrials(champion: BenchOptExperimentTrial, challenger: BenchOptExperimentTrial) {
  const delta = champion.breakdown.total - challenger.breakdown.total

  return {
    winnerTrialId: delta >= 0 ? champion.trialId : challenger.trialId,
    delta,
    reasons: [
      `champion split=${champion.split} score=${champion.breakdown.total}`,
      `challenger split=${challenger.split} score=${challenger.breakdown.total}`,
    ],
  }
}

/** Mutation metadata attached to champion records for tool-config or agent-graph candidates. */
export interface BenchOptChampionMutationMeta {
  /** The candidate kind that produced this champion. */
  candidateKind: OptimizerCandidateKind
  /** Tool diff entries (present when candidateKind is "tool-config"). */
  toolDiffs: ToolDiffEntry[]
  /** Graph diff entries (present when candidateKind is "agent-graph"). */
  graphDiffs: GraphDiffEntry[]
}

/**
 * Extended champion record that carries optional mutation metadata.
 *
 * This extends the base `BenchOptChampionRecord` without modifying the shared
 * type file, so existing consumers see a strict superset.
 */
export interface BenchOptChampionRecordWithMutation extends BenchOptChampionRecord {
  /** Mutation metadata (present when the champion originated from a tool-config or agent-graph candidate). */
  mutationMeta: BenchOptChampionMutationMeta | null
}

export function selectBenchOptChampion(
  run: BenchOptExperimentRun,
  options: {
    resolvedConfigPath?: string | null
    /** Optional mutation metadata for tool-config or agent-graph candidates. */
    mutationMeta?: BenchOptChampionMutationMeta | null
  } = {},
): BenchOptChampionRecordWithMutation | null {
  const championTrial = run.trials.find((trial) => trial.trialId === run.championTrialId) ?? null
  if (!championTrial) {
    return null
  }

  const validationTrial = run.trials.find((trial) => trial.split === "validation") ?? null
  const holdoutTrial = run.trials.find((trial) => trial.split === "holdout") ?? null
  const promoted = run.summary.promotionGate.qualified && championTrial.split !== "train"

  const decisionReason = [
    `selected ${championTrial.split} trial by score=${championTrial.breakdown.total}`,
    run.summary.promotionGate.reason,
    validationTrial
      ? `validation trial ${validationTrial.trialId} scored ${validationTrial.breakdown.total}`
      : "validation trial unavailable",
    holdoutTrial
      ? `holdout trial ${holdoutTrial.trialId} scored ${holdoutTrial.breakdown.total}`
      : "holdout trial unavailable",
  ]

  if (options.mutationMeta) {
    decisionReason.push(`candidate kind: ${options.mutationMeta.candidateKind}`)

    if (options.mutationMeta.candidateKind === "tool-config" && options.mutationMeta.toolDiffs.length > 0) {
      const toolIds = [...new Set(options.mutationMeta.toolDiffs.map((d) => d.toolId))]
      decisionReason.push(`tool changes: ${toolIds.join(", ")} (${options.mutationMeta.toolDiffs.length} diff entries)`)
    }

    if (options.mutationMeta.candidateKind === "agent-graph" && options.mutationMeta.graphDiffs.length > 0) {
      const targets = options.mutationMeta.graphDiffs.map((d) => `${d.kind}:${d.target}`)
      decisionReason.push(`graph changes: ${targets.join(", ")}`)
    }
  }

  return {
    schemaVersion: 1,
    championTrialId: championTrial.trialId,
    candidateId: championTrial.candidateId,
    promptCandidateId: championTrial.promptCandidateId,
    contextCandidateId: championTrial.contextCandidateId,
    validationTrialId: validationTrial?.trialId ?? null,
    holdoutTrialId: holdoutTrial?.trialId ?? null,
    promotionSplit: championTrial.split,
    status: promoted ? "promoted" : "retained",
    decisionReason,
    selectedAt: run.generatedAt,
    resolvedConfigPath: options.resolvedConfigPath ?? null,
    mutationMeta: options.mutationMeta ?? null,
  }
}

/**
 * Describe the mutation lineage of a champion record in human-readable form.
 *
 * Returns an array of strings summarizing what mutations led to this champion
 * being selected. Returns an empty array for prompt/context champions or
 * champions without mutation metadata.
 *
 * @param champion - The champion record to describe (may or may not carry mutationMeta).
 * @returns An array of human-readable lineage notes.
 */
export function describeMutationLineage(champion: BenchOptChampionRecord): string[] {
  const meta = (champion as BenchOptChampionRecordWithMutation).mutationMeta
  if (!meta) {
    return []
  }

  const notes: string[] = []
  notes.push(`Champion produced by ${meta.candidateKind} candidate.`)

  if (meta.candidateKind === "tool-config" && meta.toolDiffs.length > 0) {
    const toolIds = [...new Set(meta.toolDiffs.map((d) => d.toolId))]
    notes.push(`Tools affected: ${toolIds.join(", ")}.`)
    for (const diff of meta.toolDiffs) {
      notes.push(`  ${diff.toolId}.${diff.field}: ${JSON.stringify(diff.before)} -> ${JSON.stringify(diff.after)}`)
    }
  }

  if (meta.candidateKind === "agent-graph" && meta.graphDiffs.length > 0) {
    notes.push(`Graph changes: ${meta.graphDiffs.length} entries.`)
    for (const diff of meta.graphDiffs) {
      notes.push(`  ${diff.details}`)
    }
  }

  return notes
}
