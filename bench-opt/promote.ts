import { mkdir, writeFile, readFile } from "node:fs/promises"
import path from "node:path"

import type { BenchOptPromotionGate, BenchOptTrialSplit, BenchOptChampionRecord } from "./types.ts"

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type BenchOptPromotionChannel = "branch" | "pull-request" | "canary" | "publish"

export type BenchOptPromotionStatus = "blocked" | "qualified" | "promoted"

export interface BenchOptPromotionDecisionInput {
  runId: string
  candidateId: string
  gate: BenchOptPromotionGate
  liveEvaluatorPassed?: boolean
  requiredChecks?: readonly string[]
  passedChecks?: readonly string[]
  branchName?: string | null
  pullRequestUrl?: string | null
  canaryEnvironment?: string | null
  trialSummaryPath?: string | null
  allowPromotion?: boolean
}

export interface BenchOptPromotionDecisionOptions {
  defaultChannel?: BenchOptPromotionChannel
  requireCanary?: boolean
  requiredChecks?: readonly string[]
}

export interface BenchOptPromotionDecision {
  schemaVersion: 1
  runId: string
  candidateId: string
  status: BenchOptPromotionStatus
  promote: boolean
  channel: BenchOptPromotionChannel
  gate: BenchOptPromotionGate & {
    requiredSplits: BenchOptPromotionGate["requiredSplits"]
    observedSplits: BenchOptPromotionGate["observedSplits"]
    missingSplits: BenchOptPromotionGate["missingSplits"]
    requiredChecks: readonly string[]
    passedChecks: readonly string[]
    missingChecks: readonly string[]
    liveEvaluatorPassed: boolean
    canaryRequired: boolean
    canaryReady: boolean
  }
  artifacts: {
    branchName: string | null
    pullRequestUrl: string | null
    canaryEnvironment: string | null
    trialSummaryPath: string | null
    promotionDecisionPath: string
    publishPlanPath: string
    rollbackPlanPath: string
  }
  reasons: string[]
}

// ---------------------------------------------------------------------------
// Promotion execution artifact — written to disk after execution
// ---------------------------------------------------------------------------

/** Structured artifact emitted when a promotion is executed (or dry-run). */
export interface BenchOptPromotionArtifact {
  schemaVersion: 1
  timestamp: string
  runId: string
  candidateId: string
  decision: BenchOptPromotionDecision
  promotionReason: string
  gateResults: {
    splitGatePassed: boolean
    checksGatePassed: boolean
    liveGatePassed: boolean
    canaryGatePassed: boolean
    overallPassed: boolean
  }
  branch: {
    created: boolean
    name: string | null
    baseRef: string
    error: string | null
  }
  rollbackReference: {
    previousChampionId: string | null
    previousChampionConfigPath: string | null
    rollbackPlanPath: string
  }
  artifactPath: string
}

/** Options for running promotion execution. */
export interface BenchOptPromotionExecutionOptions {
  /** Working directory / repo root for git operations. */
  repositoryRoot?: string
  /** Base ref the promotion branch is created from. */
  baseRef?: string
  /** If true, skip actual git operations (branch creation) but still emit the artifact. */
  dryRun?: boolean
  /** Path to the previous champion record for rollback reference. */
  previousChampionPath?: string | null
  /** Output directory for promotion artifacts. */
  outputDir?: string
}

/** Result returned from promotion execution. */
export interface BenchOptPromotionExecutionResult {
  artifact: BenchOptPromotionArtifact
  artifactPath: string
  branchCreated: boolean
  notes: string[]
}

// ---------------------------------------------------------------------------
// Pre-promotion validation
// ---------------------------------------------------------------------------

/** Structured result of pre-promotion validation checks. */
export interface BenchOptPrePromotionValidation {
  valid: boolean
  checks: Array<{
    name: string
    passed: boolean
    message: string
  }>
}

/**
 * Run pre-promotion validation checks against a promotion decision.
 *
 * Verifies bench scores, live results, and safety gates before allowing
 * promotion to proceed. Returns a structured validation result so the
 * caller can inspect individual checks.
 *
 * @param decision - The promotion decision to validate.
 * @param opts - Optional thresholds and overrides.
 * @returns Structured validation result.
 */
export function validatePrePromotion(
  decision: BenchOptPromotionDecision,
  opts: {
    /** Minimum number of observed splits required. */
    minObservedSplits?: number
    /** If true, require live evaluator to have passed. */
    requireLiveEvaluator?: boolean
    /** If true, require canary gate to be ready. */
    requireCanary?: boolean
    /** Additional custom check functions. */
    customChecks?: Array<{
      name: string
      check: (d: BenchOptPromotionDecision) => boolean
      failMessage: string
    }>
  } = {},
): BenchOptPrePromotionValidation {
  const checks: BenchOptPrePromotionValidation["checks"] = []

  // 1. Gate qualification
  checks.push({
    name: "gate-qualified",
    passed: decision.gate.qualified,
    message: decision.gate.qualified
      ? "Promotion gate is qualified."
      : `Promotion gate is not qualified: ${decision.gate.reason}`,
  })

  // 2. Missing splits
  const minSplits = opts.minObservedSplits ?? decision.gate.requiredSplits.length
  checks.push({
    name: "observed-splits",
    passed: decision.gate.observedSplits.length >= minSplits,
    message:
      decision.gate.observedSplits.length >= minSplits
        ? `Observed ${decision.gate.observedSplits.length} splits (minimum ${minSplits}).`
        : `Only ${decision.gate.observedSplits.length} observed splits, need ${minSplits}.`,
  })

  // 3. Missing checks
  checks.push({
    name: "required-checks",
    passed: decision.gate.missingChecks.length === 0,
    message:
      decision.gate.missingChecks.length === 0
        ? "All required checks passed."
        : `Missing checks: ${decision.gate.missingChecks.join(", ")}.`,
  })

  // 4. Live evaluator
  const requireLive = opts.requireLiveEvaluator ?? true
  if (requireLive) {
    checks.push({
      name: "live-evaluator",
      passed: decision.gate.liveEvaluatorPassed,
      message: decision.gate.liveEvaluatorPassed
        ? "Live evaluator passed."
        : "Live evaluator has not passed.",
    })
  }

  // 5. Canary gate
  const requireCanary = opts.requireCanary ?? decision.gate.canaryRequired
  if (requireCanary) {
    checks.push({
      name: "canary-gate",
      passed: decision.gate.canaryReady,
      message: decision.gate.canaryReady
        ? "Canary gate is ready."
        : "Canary gate is required but not ready.",
    })
  }

  // 6. Custom checks
  for (const custom of opts.customChecks ?? []) {
    const passed = custom.check(decision)
    checks.push({
      name: custom.name,
      passed,
      message: passed ? `Custom check '${custom.name}' passed.` : custom.failMessage,
    })
  }

  return {
    valid: checks.every((c) => c.passed),
    checks,
  }
}

// ---------------------------------------------------------------------------
// Internal helpers (unchanged from original)
// ---------------------------------------------------------------------------

function normalizeStrings(values: readonly string[] | undefined) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))]
}

function normalizeSplits(values: readonly BenchOptTrialSplit[] | undefined) {
  return [...new Set((values ?? []).filter(Boolean))]
}

function sanitizeId(value: string) {
  return value.replace(/[^a-zA-Z0-9._/-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
}

function buildArtifactPaths(runId: string, candidateId: string) {
  const safeRunId = sanitizeId(runId)
  const safeCandidateId = sanitizeId(candidateId)

  return {
    promotionDecisionPath: `promotions/${safeRunId}-${safeCandidateId}.json`,
    publishPlanPath: `publish/${safeRunId}-${safeCandidateId}.json`,
    rollbackPlanPath: `rollbacks/${safeRunId}-${safeCandidateId}.json`,
  }
}

function chooseChannel(
  input: BenchOptPromotionDecisionInput,
  options: BenchOptPromotionDecisionOptions,
): BenchOptPromotionChannel {
  if (input.canaryEnvironment) {
    return "canary"
  }

  if (input.pullRequestUrl) {
    return "pull-request"
  }

  if (input.branchName) {
    return "branch"
  }

  return options.defaultChannel ?? "publish"
}

function buildReasons(
  gateQualified: boolean,
  promote: boolean,
  gate: BenchOptPromotionDecision["gate"],
  channel: BenchOptPromotionChannel,
  artifacts: BenchOptPromotionDecision["artifacts"],
) {
  const reasons = [
    gateQualified
      ? "Promotion gate is qualified."
      : "Promotion gate is blocked.",
    gate.reason,
    gate.missingSplits.length > 0
      ? `Missing splits: ${gate.missingSplits.join(", ")}.`
      : "All required splits are present.",
    gate.missingChecks.length > 0
      ? `Missing checks: ${gate.missingChecks.join(", ")}.`
      : "All required checks are present.",
    gate.liveEvaluatorPassed
      ? "Live evaluator passed."
      : "Live evaluator is not marked as passed.",
    gate.canaryRequired
      ? gate.canaryReady
        ? "Canary gate is configured and ready."
        : "Canary gate is required but not ready."
      : "Canary gate is optional.",
    `Suggested promotion channel: ${channel}.`,
    promote
      ? "Promotion is explicitly allowed."
      : "Promotion remains in safe default mode.",
    `Promotion decision path: ${artifacts.promotionDecisionPath}.`,
    `Publish plan path: ${artifacts.publishPlanPath}.`,
    `Rollback plan path: ${artifacts.rollbackPlanPath}.`,
  ]

  return reasons.filter(Boolean)
}

// ---------------------------------------------------------------------------
// Core decision function (backward compatible)
// ---------------------------------------------------------------------------

/**
 * Build a promotion decision for a bench-opt candidate.
 *
 * This is a pure, synchronous decision function. It evaluates the promotion
 * gate, required checks, live evaluator, and canary readiness to produce a
 * structured decision artifact. No side effects are performed.
 *
 * @param input - The promotion decision input containing gate info, checks, and artifact references.
 * @param options - Optional overrides for channel selection, canary requirement, and required checks.
 * @returns A structured promotion decision.
 */
export function decideBenchOptPromotion(
  input: BenchOptPromotionDecisionInput,
  options: BenchOptPromotionDecisionOptions = {},
): BenchOptPromotionDecision {
  const requiredSplits = normalizeSplits(input.gate.requiredSplits)
  const observedSplits = normalizeSplits(input.gate.observedSplits)
  const missingSplits = requiredSplits.filter((split) => !observedSplits.includes(split))
  const requiredChecks = normalizeStrings(options.requiredChecks ?? input.requiredChecks ?? ["tests"])
  const passedChecks = normalizeStrings(input.passedChecks)
  const missingChecks = requiredChecks.filter((check) => !passedChecks.includes(check))
  const liveEvaluatorPassed = input.liveEvaluatorPassed ?? false
  const canaryRequired = options.requireCanary ?? false
  const canaryReady = !canaryRequired || Boolean(input.canaryEnvironment)
  const gateQualified = input.gate.qualified && missingSplits.length === 0 && missingChecks.length === 0 && liveEvaluatorPassed && canaryReady
  const promote = Boolean(input.allowPromotion) && gateQualified
  const channel = chooseChannel(input, options)
  const artifacts = {
    branchName: input.branchName ?? null,
    pullRequestUrl: input.pullRequestUrl ?? null,
    canaryEnvironment: input.canaryEnvironment ?? null,
    trialSummaryPath: input.trialSummaryPath ?? null,
    ...buildArtifactPaths(input.runId, input.candidateId),
  }
  const status: BenchOptPromotionStatus = !gateQualified
    ? "blocked"
    : promote
      ? "promoted"
      : "qualified"

  return {
    schemaVersion: 1,
    runId: input.runId,
    candidateId: input.candidateId,
    status,
    promote,
    channel,
    gate: {
      ...input.gate,
      requiredSplits,
      observedSplits,
      missingSplits,
      requiredChecks,
      passedChecks,
      missingChecks,
      liveEvaluatorPassed,
      canaryRequired,
      canaryReady,
    },
    artifacts,
    reasons: buildReasons(gateQualified, promote, {
      ...input.gate,
      requiredSplits,
      observedSplits,
      missingSplits,
      requiredChecks,
      passedChecks,
      missingChecks,
      liveEvaluatorPassed,
      canaryRequired,
      canaryReady,
    }, channel, artifacts),
  }
}

// ---------------------------------------------------------------------------
// Git branch creation helper
// ---------------------------------------------------------------------------

/**
 * Create a git branch for a promotion candidate.
 *
 * Runs `git checkout -b <branchName>` from the given base ref in the
 * specified repository root. Returns structured success/error info.
 *
 * @param repositoryRoot - Absolute path to the repository.
 * @param branchName - Name for the new branch.
 * @param baseRef - Base ref to branch from (default "HEAD").
 * @returns An object indicating success or failure with an error message.
 */
export async function createPromotionBranch(
  repositoryRoot: string,
  branchName: string,
  baseRef: string = "HEAD",
): Promise<{ created: boolean; name: string; baseRef: string; error: string | null }> {
  const { execFile } = await import("node:child_process")
  const { promisify } = await import("node:util")
  const execFileAsync = promisify(execFile)

  try {
    await execFileAsync("git", ["checkout", "-b", branchName, baseRef], {
      cwd: repositoryRoot,
      timeout: 30_000,
    })
    return { created: true, name: branchName, baseRef, error: null }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { created: false, name: branchName, baseRef, error: message }
  }
}

// ---------------------------------------------------------------------------
// Load previous champion for rollback reference
// ---------------------------------------------------------------------------

async function loadPreviousChampion(
  championPath: string | null | undefined,
): Promise<{ championId: string | null; configPath: string | null }> {
  if (!championPath) {
    return { championId: null, configPath: null }
  }

  try {
    const raw = await readFile(championPath, "utf8")
    const parsed = JSON.parse(raw) as Partial<BenchOptChampionRecord>
    return {
      championId: parsed.championTrialId ?? null,
      configPath: parsed.resolvedConfigPath ?? null,
    }
  } catch {
    return { championId: null, configPath: null }
  }
}

// ---------------------------------------------------------------------------
// Promotion execution
// ---------------------------------------------------------------------------

/**
 * Execute a promotion workflow for a bench-opt candidate.
 *
 * This function performs the full promotion execution:
 * 1. Runs pre-promotion validation checks.
 * 2. Creates a git branch (unless dry-run).
 * 3. Loads the previous champion for rollback reference.
 * 4. Writes a structured promotion artifact to disk.
 *
 * The promotion will only proceed if the decision status is "promoted".
 * In dry-run mode, git operations are skipped but the artifact is still
 * emitted for inspection.
 *
 * @param decision - The promotion decision from `decideBenchOptPromotion`.
 * @param opts - Execution options (repo root, base ref, dry-run, output dir).
 * @returns Structured execution result with artifact path and notes.
 */
export async function executeBenchOptPromotion(
  decision: BenchOptPromotionDecision,
  opts: BenchOptPromotionExecutionOptions = {},
): Promise<BenchOptPromotionExecutionResult> {
  const notes: string[] = []
  const repositoryRoot = opts.repositoryRoot ?? process.cwd()
  const baseRef = opts.baseRef ?? "HEAD"
  const dryRun = opts.dryRun ?? true
  const outputDir = opts.outputDir ?? path.join(repositoryRoot, "bench-opt-results")
  const timestamp = new Date().toISOString()

  // Pre-promotion validation
  const validation = validatePrePromotion(decision)
  if (!validation.valid) {
    const failedNames = validation.checks
      .filter((c) => !c.passed)
      .map((c) => c.name)
    notes.push(`Pre-promotion validation failed: ${failedNames.join(", ")}.`)
  } else {
    notes.push("Pre-promotion validation passed.")
  }

  // Gate results summary
  const gateResults = {
    splitGatePassed: decision.gate.missingSplits.length === 0,
    checksGatePassed: decision.gate.missingChecks.length === 0,
    liveGatePassed: decision.gate.liveEvaluatorPassed,
    canaryGatePassed: decision.gate.canaryReady,
    overallPassed: decision.gate.qualified && decision.gate.missingSplits.length === 0 && decision.gate.missingChecks.length === 0 && decision.gate.liveEvaluatorPassed && decision.gate.canaryReady,
  }

  // Branch creation
  let branchResult = {
    created: false,
    name: decision.artifacts.branchName,
    baseRef,
    error: null as string | null,
  }

  if (decision.promote && !dryRun && decision.artifacts.branchName) {
    branchResult = await createPromotionBranch(
      repositoryRoot,
      decision.artifacts.branchName,
      baseRef,
    )
    if (branchResult.created) {
      notes.push(`Created promotion branch: ${branchResult.name}.`)
    } else {
      notes.push(`Branch creation failed: ${branchResult.error}.`)
    }
  } else if (dryRun && decision.artifacts.branchName) {
    notes.push(`Dry-run: would create branch ${decision.artifacts.branchName} from ${baseRef}.`)
  } else if (!decision.promote) {
    notes.push("Promotion not approved; branch creation skipped.")
  }

  // Rollback reference
  const previousChampion = await loadPreviousChampion(opts.previousChampionPath)
  const rollbackReference = {
    previousChampionId: previousChampion.championId,
    previousChampionConfigPath: previousChampion.configPath,
    rollbackPlanPath: decision.artifacts.rollbackPlanPath,
  }

  // Build artifact
  const safeRunId = sanitizeId(decision.runId)
  const safeCandidateId = sanitizeId(decision.candidateId)
  const artifactFilename = `promotion-${safeRunId}-${safeCandidateId}-${timestamp.replace(/[:.]/g, "-")}.json`
  const artifactPath = path.join(outputDir, "promotions", artifactFilename)

  const artifact: BenchOptPromotionArtifact = {
    schemaVersion: 1,
    timestamp,
    runId: decision.runId,
    candidateId: decision.candidateId,
    decision,
    promotionReason: decision.reasons.join(" "),
    gateResults,
    branch: branchResult,
    rollbackReference,
    artifactPath,
  }

  // Write to disk
  await mkdir(path.dirname(artifactPath), { recursive: true })
  await writeFile(artifactPath, JSON.stringify(artifact, null, 2))
  notes.push(`Promotion artifact written to ${artifactPath}.`)

  return {
    artifact,
    artifactPath,
    branchCreated: branchResult.created,
    notes,
  }
}
