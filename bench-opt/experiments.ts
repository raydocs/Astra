import type {
  BenchOptCandidateScore,
  BenchOptExperimentRun,
  BenchOptExperimentTrial,
  BenchOptPromotionGate,
  BenchOptRunReport,
  BenchOptTrialSplit,
} from "./types.ts"

function buildTrialId(experimentId: string, rank: number) {
  return `${experimentId}:trial-${String(rank).padStart(3, "0")}`
}

function normalizeTrialSplit(value: BenchOptTrialSplit | null | undefined): BenchOptTrialSplit {
  return value === "validation" || value === "holdout" ? value : "train"
}

function chooseBenchOptTrialSplit(
  index: number,
  totalTrials: number,
  evaluatedSplit: BenchOptTrialSplit | null | undefined,
): BenchOptTrialSplit {
  const normalizedEvaluatedSplit = evaluatedSplit ? normalizeTrialSplit(evaluatedSplit) : null
  if (normalizedEvaluatedSplit) {
    return normalizedEvaluatedSplit
  }

  if (totalTrials <= 1) {
    return "train"
  }

  if (index === 0) {
    return "holdout"
  }

  if (index === 1) {
    return "validation"
  }

  return "train"
}

function buildPromotionGate(
  trials: readonly BenchOptExperimentTrial[],
  requiredSplits?: readonly BenchOptTrialSplit[],
): BenchOptPromotionGate {
  const observedSplits: BenchOptTrialSplit[] = [...new Set(trials.map((trial) => trial.split))]
  const normalizedRequired: BenchOptTrialSplit[] = requiredSplits && requiredSplits.length > 0
    ? [...new Set(requiredSplits.map((split) => normalizeTrialSplit(split)))]
    : observedSplits.includes("holdout") || observedSplits.includes("validation")
      ? ["validation", "holdout"]
      : ["train"]
  const missingSplits = normalizedRequired.filter((split) => !observedSplits.includes(split))

  return {
    requiredSplits: normalizedRequired,
    observedSplits,
    qualified: missingSplits.length === 0,
    missingSplits,
    reason: missingSplits.length === 0
      ? `Observed all required promotion splits: ${normalizedRequired.join(", ")}.`
      : `Observed ${observedSplits.join(", ")} but still missing promotion split coverage for ${missingSplits.join(", ")}.`,
  }
}

export function materializeBenchOptTrials(
  experimentId: string,
  scoredCandidates: readonly BenchOptCandidateScore[],
  options: {
    evaluatedSplit?: BenchOptTrialSplit | null
  } = {},
): BenchOptExperimentTrial[] {
  return scoredCandidates.map((entry, index) => {
    const trialId = buildTrialId(experimentId, index + 1)
    const split = chooseBenchOptTrialSplit(index, scoredCandidates.length, options.evaluatedSplit)

    return {
      trialId,
      candidateId: entry.candidate.id,
      promptCandidateId: entry.candidate.promptCandidateId ?? null,
      contextCandidateId: entry.candidate.contextCandidateId ?? null,
      split,
      status: split === "holdout" ? "promoted" : split === "validation" ? "retained" : "scored",
      lineage: {
        experimentId,
        trialId,
        parentTrialId: null,
        generation: 0,
      },
      candidate: entry.candidate,
      breakdown: entry.breakdown,
      alignmentMatches: [...entry.alignmentMatches],
      notes: [...entry.notes],
      artifacts: {
        resolvedConfigPath: null,
      },
    }
  })
}

export function createBenchOptExperimentRun(
  report: BenchOptRunReport,
  scoredCandidates: readonly BenchOptCandidateScore[],
  options: {
    evaluatedSplit?: BenchOptTrialSplit | null
    requiredPromotionSplits?: readonly BenchOptTrialSplit[]
  } = {},
): BenchOptExperimentRun {
  const experimentId = `exp-${report.runId}`
  const trials = materializeBenchOptTrials(experimentId, scoredCandidates, {
    evaluatedSplit: options.evaluatedSplit,
  })
  const promotionGate = buildPromotionGate(trials, options.requiredPromotionSplits ?? report.summary.promotionSplits)
  const championTrial = trials.find((trial) => trial.split === "holdout")
    ?? trials.find((trial) => trial.split === "validation")
    ?? trials[0]
    ?? null

  return {
    schemaVersion: 1,
    experimentId,
    runId: report.runId,
    generatedAt: report.generatedAt,
    sourceArtifacts: report.sourceArtifacts,
    baseline: report.baseline,
    budget: {
      maxTrials: trials.length,
    },
    trials,
    summary: {
      trialCount: trials.length,
      bestTrialId: championTrial?.trialId ?? null,
      bestScore: championTrial?.breakdown.total ?? null,
      evaluatedSplit: championTrial?.split ?? normalizeTrialSplit(options.evaluatedSplit ?? report.summary.evaluatedSplit),
      promotionGate,
    },
    championTrialId: championTrial?.trialId ?? null,
  }
}
