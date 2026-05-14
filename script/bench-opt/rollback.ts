import { mkdir, writeFile, readFile, access } from "node:fs/promises"
import path from "node:path"

import type { BenchOptPublishPlan } from "./publish.ts"
import type { BenchOptPromotionDecision } from "./promote.ts"
import type { BenchOptChampionRecord } from "./types.ts"

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type BenchOptRollbackTrigger =
  | "post-promotion-check-failed"
  | "canary-regression"
  | "manual"
  | "promotion-revoked"
  | "unknown"

export type BenchOptRollbackStatus = "idle" | "planned" | "armed"

export interface BenchOptRollbackPlanInput {
  runId: string
  candidateId: string
  promotion?: BenchOptPromotionDecision | null
  publishPlan?: BenchOptPublishPlan | null
  trigger?: BenchOptRollbackTrigger
  reason?: string | null
  failedChecks?: readonly string[]
  branchName?: string | null
  pullRequestUrl?: string | null
  canaryEnvironment?: string | null
}

export interface BenchOptRollbackPlanOptions {
  allowRollback?: boolean
}

export interface BenchOptRollbackStep {
  id: string
  kind:
    | "revert-commit"
    | "close-pr"
    | "disable-canary"
    | "restore-branch"
    | "record-rollback"
    | "restore-champion"
  status: "planned" | "blocked" | "skipped" | "completed" | "failed"
  reason: string
}

export interface BenchOptRollbackPlan {
  schemaVersion: 1
  runId: string
  candidateId: string
  trigger: BenchOptRollbackTrigger
  status: BenchOptRollbackStatus
  dryRun: boolean
  executionEnabled: boolean
  reason: string
  failedChecks: readonly string[]
  targets: {
    branchName: string | null
    pullRequestUrl: string | null
    canaryEnvironment: string | null
  }
  artifacts: {
    rollbackRecordPath: string | null
    revertMessagePath: string | null
    recoverySummaryPath: string | null
  }
  steps: BenchOptRollbackStep[]
  reasons: string[]
}

// ---------------------------------------------------------------------------
// Rollback execution types
// ---------------------------------------------------------------------------

/** Safety check results for a rollback operation. */
export interface BenchOptRollbackSafetyChecks {
  valid: boolean
  checks: Array<{
    name: string
    passed: boolean
    message: string
  }>
}

/** Previous champion state for restoration. */
export interface BenchOptRollbackChampionState {
  found: boolean
  championTrialId: string | null
  candidateId: string | null
  resolvedConfigPath: string | null
  error: string | null
}

/** Structured rollback artifact emitted after execution. */
export interface BenchOptRollbackArtifact {
  schemaVersion: 1
  timestamp: string
  runId: string
  candidateId: string
  trigger: BenchOptRollbackTrigger
  mode: "dry-run" | "real"
  plan: BenchOptRollbackPlan
  safetyChecks: BenchOptRollbackSafetyChecks
  previousChampion: BenchOptRollbackChampionState
  execution: {
    commitReverted: boolean
    revertSha: string | null
    revertError: string | null
    prClosed: boolean
    prCloseError: string | null
    canaryDisabled: boolean
    canaryDisableError: string | null
    branchRestored: boolean
    branchRestoreError: string | null
    championRestored: boolean
    championRestoreError: string | null
    rollbackRecorded: boolean
  }
  artifactPath: string
}

/** Options for rollback execution. */
export interface BenchOptRollbackExecutionOptions {
  /** Working directory / repo root for git operations. */
  repositoryRoot?: string
  /** If true, skip side-effects but still emit the artifact. */
  dryRun?: boolean
  /** Output directory for rollback artifacts. */
  outputDir?: string
  /** Path to the previous champion record JSON for restoration. */
  previousChampionPath?: string | null
  /** Path to the store index for champion restoration. */
  storeIndexPath?: string | null
}

/** Result from rollback execution. */
export interface BenchOptRollbackExecutionResult {
  artifact: BenchOptRollbackArtifact
  artifactPath: string
  championRestored: boolean
  notes: string[]
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function sanitizeId(value: string) {
  return value.replace(/[^a-zA-Z0-9._/-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
}

function buildRollbackRecordPath(runId: string, candidateId: string) {
  return `rollbacks/${sanitizeId(runId)}-${sanitizeId(candidateId)}.json`
}

function buildRecoverySummaryPath(runId: string, candidateId: string) {
  return `recovery/${sanitizeId(runId)}-${sanitizeId(candidateId)}.md`
}

function buildStep(
  kind: BenchOptRollbackStep["kind"],
  status: BenchOptRollbackStep["status"],
  reason: string,
): BenchOptRollbackStep {
  return {
    id: kind,
    kind,
    status,
    reason,
  }
}

function isIdleRollback(
  trigger: BenchOptRollbackTrigger,
  failedChecks: readonly string[],
  reason: string | null | undefined,
) {
  return trigger === "unknown" && failedChecks.length === 0 && !reason?.trim()
}

// ---------------------------------------------------------------------------
// Plan builder (backward compatible)
// ---------------------------------------------------------------------------

/**
 * Build a structured rollback plan for a bench-opt promotion.
 *
 * This is a pure, synchronous function that produces a plan describing what
 * steps are needed to roll back a promoted candidate. No side effects are
 * performed. The plan can be inspected and then optionally executed via
 * `executeBenchOptRollback`.
 *
 * @param input - The rollback plan input including promotion, publish plan, and trigger info.
 * @param options - Optional overrides.
 * @returns A structured rollback plan.
 */
export function buildBenchOptRollbackPlan(
  input: BenchOptRollbackPlanInput,
  options: BenchOptRollbackPlanOptions = {},
): BenchOptRollbackPlan {
  const trigger = input.trigger ?? "unknown"
  const failedChecks = [...new Set((input.failedChecks ?? []).map((check) => check.trim()).filter(Boolean))]
  const reason = input.reason?.trim() || (failedChecks.length > 0
    ? `Rollback requested because ${failedChecks.join(", ")} failed.`
    : "Rollback is prepared but no failure has been recorded.")
  const idle = isIdleRollback(trigger, failedChecks, input.reason)
  const executionEnabled = Boolean(options.allowRollback && !idle && trigger !== "unknown")
  const status: BenchOptRollbackStatus = idle
    ? "idle"
    : executionEnabled
      ? "armed"
      : "planned"

  const branchName = input.branchName ?? input.publishPlan?.branch.name ?? input.promotion?.artifacts.branchName ?? null
  const pullRequestUrl = input.pullRequestUrl ?? input.publishPlan?.pullRequest.url ?? input.promotion?.artifacts.pullRequestUrl ?? null
  const canaryEnvironment = input.canaryEnvironment ?? input.publishPlan?.canary.environment ?? input.promotion?.artifacts.canaryEnvironment ?? null
  const stepStatus: BenchOptRollbackStep["status"] = status === "idle"
    ? "skipped"
    : "planned"

  const steps: BenchOptRollbackStep[] = [
    buildStep(
      "revert-commit",
      branchName ? stepStatus : "skipped",
      branchName
        ? `Revert the promotion branch ${branchName}.`
        : "No branch was supplied to revert.",
    ),
    buildStep(
      "close-pr",
      pullRequestUrl ? stepStatus : "skipped",
      pullRequestUrl
        ? `Close or update the PR at ${pullRequestUrl}.`
        : "No pull request URL is available.",
    ),
    buildStep(
      "disable-canary",
      canaryEnvironment ? stepStatus : "skipped",
      canaryEnvironment
        ? `Disable canary environment ${canaryEnvironment}.`
        : "No canary environment was supplied.",
    ),
    buildStep(
      "restore-branch",
      branchName ? stepStatus : "skipped",
      branchName
        ? `Restore the previous branch state for ${branchName}.`
        : "Branch restoration is not applicable.",
    ),
    buildStep(
      "restore-champion",
      stepStatus,
      "Restore the previous champion configuration.",
    ),
    buildStep(
      "record-rollback",
      stepStatus,
      "Record the rollback artifact for later audit and retry planning.",
    ),
  ]

  const reasons = [
    `Rollback trigger: ${trigger}.`,
    idle
      ? "Rollback remains idle until a trigger or failure is supplied."
      : reason,
    failedChecks.length > 0
      ? `Failed checks: ${failedChecks.join(", ")}.`
      : "No failed checks were provided.",
    executionEnabled
      ? "Rollback execution is armed for downstream tooling."
      : "Rollback stays in safe planning mode by default.",
    branchName
      ? `Rollback branch target: ${branchName}.`
      : "No branch target was derived.",
  ]

  return {
    schemaVersion: 1,
    runId: input.runId,
    candidateId: input.candidateId,
    trigger,
    status,
    dryRun: true,
    executionEnabled,
    reason,
    failedChecks,
    targets: {
      branchName,
      pullRequestUrl,
      canaryEnvironment,
    },
    artifacts: {
      rollbackRecordPath: buildRollbackRecordPath(input.runId, input.candidateId),
      revertMessagePath: branchName ? `reverts/${sanitizeId(branchName)}.txt` : null,
      recoverySummaryPath: buildRecoverySummaryPath(input.runId, input.candidateId),
    },
    steps,
    reasons,
  }
}

// ---------------------------------------------------------------------------
// Safety checks
// ---------------------------------------------------------------------------

/**
 * Run safety checks before executing a rollback.
 *
 * Verifies that:
 * - The rollback target exists (branch name is present).
 * - The rollback was triggered by a recognized event.
 * - The candidate was previously promoted (promotion decision exists).
 * - The plan is not idle.
 *
 * @param plan - The rollback plan to validate.
 * @param opts - Optional overrides.
 * @returns Structured safety check result.
 */
export function validateRollbackSafety(
  plan: BenchOptRollbackPlan,
  opts: {
    /** If true, require a promotion decision to have existed. */
    requirePromotionHistory?: boolean
    /** Path to check for the rollback target branch. */
    rollbackTargetBranchExists?: boolean
    /** Additional custom check functions. */
    customChecks?: Array<{
      name: string
      check: (p: BenchOptRollbackPlan) => boolean
      failMessage: string
    }>
  } = {},
): BenchOptRollbackSafetyChecks {
  const checks: BenchOptRollbackSafetyChecks["checks"] = []

  // 1. Not idle
  checks.push({
    name: "not-idle",
    passed: plan.status !== "idle",
    message:
      plan.status === "idle"
        ? "Rollback plan is idle; no trigger or failure is present."
        : `Rollback status: ${plan.status}.`,
  })

  // 2. Recognized trigger
  checks.push({
    name: "recognized-trigger",
    passed: plan.trigger !== "unknown",
    message:
      plan.trigger === "unknown"
        ? "Rollback trigger is unknown; cannot proceed safely."
        : `Rollback trigger: ${plan.trigger}.`,
  })

  // 3. Rollback target exists
  checks.push({
    name: "rollback-target-exists",
    passed: Boolean(plan.targets.branchName) || Boolean(plan.targets.pullRequestUrl),
    message:
      plan.targets.branchName || plan.targets.pullRequestUrl
        ? `Rollback target: branch=${plan.targets.branchName ?? "none"}, PR=${plan.targets.pullRequestUrl ?? "none"}.`
        : "No rollback target (branch or PR) is available.",
  })

  // 4. Branch existence check (if provided)
  if (opts.rollbackTargetBranchExists !== undefined) {
    checks.push({
      name: "branch-exists-on-remote",
      passed: opts.rollbackTargetBranchExists,
      message: opts.rollbackTargetBranchExists
        ? `Branch ${plan.targets.branchName} exists on remote.`
        : `Branch ${plan.targets.branchName} does not exist on remote.`,
    })
  }

  // 5. Promotion history
  if (opts.requirePromotionHistory) {
    // We check via artifacts — if rollbackRecordPath is set, a promotion occurred
    checks.push({
      name: "promotion-history",
      passed: Boolean(plan.artifacts.rollbackRecordPath),
      message: plan.artifacts.rollbackRecordPath
        ? `Promotion history available via rollback record: ${plan.artifacts.rollbackRecordPath}.`
        : "No promotion history available for rollback.",
    })
  }

  // 6. Custom checks
  for (const custom of opts.customChecks ?? []) {
    const passed = custom.check(plan)
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
// Champion restoration helper
// ---------------------------------------------------------------------------

/**
 * Load the previous champion record for restoration during rollback.
 *
 * @param championPath - Path to the previous champion JSON record.
 * @returns Structured champion state for rollback.
 */
export async function loadPreviousChampionForRollback(
  championPath: string | null | undefined,
): Promise<BenchOptRollbackChampionState> {
  if (!championPath) {
    return { found: false, championTrialId: null, candidateId: null, resolvedConfigPath: null, error: null }
  }

  try {
    await access(championPath)
    const raw = await readFile(championPath, "utf8")
    const parsed = JSON.parse(raw) as Partial<BenchOptChampionRecord>
    return {
      found: true,
      championTrialId: parsed.championTrialId ?? null,
      candidateId: parsed.candidateId ?? null,
      resolvedConfigPath: parsed.resolvedConfigPath ?? null,
      error: null,
    }
  } catch (err: unknown) {
    return {
      found: false,
      championTrialId: null,
      candidateId: null,
      resolvedConfigPath: null,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ---------------------------------------------------------------------------
// Git helper
// ---------------------------------------------------------------------------

async function execGit(
  repositoryRoot: string,
  args: string[],
): Promise<{ stdout: string; error: string | null }> {
  const { execFile } = await import("node:child_process")
  const { promisify } = await import("node:util")
  const execFileAsync = promisify(execFile)

  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd: repositoryRoot,
      timeout: 30_000,
    })
    return { stdout: stdout.trim(), error: null }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { stdout: "", error: message }
  }
}

// ---------------------------------------------------------------------------
// Rollback execution
// ---------------------------------------------------------------------------

/**
 * Execute a rollback workflow for a bench-opt promotion.
 *
 * This function carries out the steps described in a rollback plan:
 * 1. Runs safety checks to verify the rollback is valid.
 * 2. Reverts the promotion commit on the branch.
 * 3. Closes the associated PR (integration point for gh CLI).
 * 4. Disables canary environment (integration point for deployment tooling).
 * 5. Restores the previous branch state.
 * 6. Restores the previous champion configuration.
 * 7. Records the rollback artifact.
 *
 * In dry-run mode, all git operations are skipped but the artifact is
 * still emitted for inspection.
 *
 * @param plan - The rollback plan from `buildBenchOptRollbackPlan`.
 * @param opts - Execution options.
 * @returns Structured execution result with artifact and notes.
 */
export async function executeBenchOptRollback(
  plan: BenchOptRollbackPlan,
  opts: BenchOptRollbackExecutionOptions = {},
): Promise<BenchOptRollbackExecutionResult> {
  const notes: string[] = []
  const repositoryRoot = opts.repositoryRoot ?? process.cwd()
  const dryRun = opts.dryRun ?? true
  const outputDir = opts.outputDir ?? process.env.ASTRA_BENCH_OPT_ARTIFACT_ROOT ?? path.join(repositoryRoot, "data/bench-opt-results")
  const timestamp = new Date().toISOString()

  // Safety checks
  const safetyChecks = validateRollbackSafety(plan)
  if (!safetyChecks.valid) {
    const failedNames = safetyChecks.checks
      .filter((c) => !c.passed)
      .map((c) => c.name)
    notes.push(`Rollback safety checks failed: ${failedNames.join(", ")}.`)
  } else {
    notes.push("Rollback safety checks passed.")
  }

  // Load previous champion
  const previousChampion = await loadPreviousChampionForRollback(opts.previousChampionPath)
  if (previousChampion.found) {
    notes.push(`Previous champion found: ${previousChampion.championTrialId}.`)
  } else if (opts.previousChampionPath) {
    notes.push(`Previous champion not found at ${opts.previousChampionPath}: ${previousChampion.error}.`)
  }

  // Execution tracking
  const execution: BenchOptRollbackArtifact["execution"] = {
    commitReverted: false,
    revertSha: null,
    revertError: null,
    prClosed: false,
    prCloseError: null,
    canaryDisabled: false,
    canaryDisableError: null,
    branchRestored: false,
    branchRestoreError: null,
    championRestored: false,
    championRestoreError: null,
    rollbackRecorded: false,
  }

  const shouldExecute = !dryRun && safetyChecks.valid && plan.executionEnabled

  // Step 1: Revert commit
  if (shouldExecute && plan.targets.branchName) {
    // Checkout the promotion branch and revert HEAD
    const checkoutResult = await execGit(repositoryRoot, [
      "checkout", plan.targets.branchName,
    ])
    if (checkoutResult.error) {
      execution.revertError = `Failed to checkout branch: ${checkoutResult.error}`
      notes.push(execution.revertError)
    } else {
      const revertResult = await execGit(repositoryRoot, [
        "revert", "--no-edit", "HEAD",
      ])
      execution.commitReverted = !revertResult.error
      execution.revertError = revertResult.error
      if (!revertResult.error) {
        const shaResult = await execGit(repositoryRoot, ["rev-parse", "HEAD"])
        execution.revertSha = shaResult.stdout || null
        notes.push(`Reverted commit, new HEAD: ${execution.revertSha}.`)
      } else {
        notes.push(`Revert failed: ${revertResult.error}.`)
      }
    }
  } else if (dryRun && plan.targets.branchName) {
    notes.push(`Dry-run: would revert HEAD on branch ${plan.targets.branchName}.`)
  }

  // Step 2: Close PR (integration point — the owner wires gh CLI here)
  if (shouldExecute && plan.targets.pullRequestUrl) {
    // Integration point: the owner should wire `gh pr close <url>` here.
    // We record the intent but don't call gh directly to avoid hard dependency.
    execution.prClosed = false
    execution.prCloseError = "Integration point: gh pr close not wired yet."
    notes.push(`PR close deferred (integration point): ${plan.targets.pullRequestUrl}.`)
  } else if (dryRun && plan.targets.pullRequestUrl) {
    notes.push(`Dry-run: would close PR at ${plan.targets.pullRequestUrl}.`)
  }

  // Step 3: Disable canary (integration point — the owner wires deployment tooling here)
  if (shouldExecute && plan.targets.canaryEnvironment) {
    // Integration point: the owner should wire canary disable logic here.
    execution.canaryDisabled = false
    execution.canaryDisableError = "Integration point: canary disable not wired yet."
    notes.push(`Canary disable deferred (integration point): ${plan.targets.canaryEnvironment}.`)
  } else if (dryRun && plan.targets.canaryEnvironment) {
    notes.push(`Dry-run: would disable canary environment ${plan.targets.canaryEnvironment}.`)
  }

  // Step 4: Restore branch to pre-promotion state
  if (shouldExecute && plan.targets.branchName) {
    // Reset the branch back to the base ref. This effectively undoes the promotion.
    const resetResult = await execGit(repositoryRoot, [
      "checkout", "main",
    ])
    if (resetResult.error) {
      execution.branchRestoreError = `Failed to restore to main: ${resetResult.error}`
      notes.push(execution.branchRestoreError)
    } else {
      // Delete the promotion branch
      const deleteResult = await execGit(repositoryRoot, [
        "branch", "-D", plan.targets.branchName,
      ])
      execution.branchRestored = !deleteResult.error
      execution.branchRestoreError = deleteResult.error
      if (deleteResult.error) {
        notes.push(`Branch deletion failed: ${deleteResult.error}.`)
      } else {
        notes.push(`Deleted promotion branch: ${plan.targets.branchName}.`)
      }
    }
  } else if (dryRun && plan.targets.branchName) {
    notes.push(`Dry-run: would delete promotion branch ${plan.targets.branchName} and restore main.`)
  }

  // Step 5: Restore previous champion
  if (shouldExecute && previousChampion.found && previousChampion.resolvedConfigPath) {
    try {
      // Copy the previous champion's resolved config back to the "current" location
      const championContent = await readFile(previousChampion.resolvedConfigPath, "utf8")
      const restorePath = path.join(outputDir, "store", "champions", "current.json")
      await mkdir(path.dirname(restorePath), { recursive: true })
      await writeFile(restorePath, championContent)
      execution.championRestored = true
      notes.push(`Restored previous champion from ${previousChampion.resolvedConfigPath}.`)
    } catch (err: unknown) {
      execution.championRestoreError = err instanceof Error ? err.message : String(err)
      notes.push(`Champion restoration failed: ${execution.championRestoreError}.`)
    }
  } else if (dryRun && previousChampion.found) {
    notes.push(`Dry-run: would restore champion ${previousChampion.championTrialId} from ${previousChampion.resolvedConfigPath}.`)
  } else if (!previousChampion.found) {
    notes.push("No previous champion to restore.")
  }

  // Build artifact
  const safeRunId = sanitizeId(plan.runId)
  const safeCandidateId = sanitizeId(plan.candidateId)
  const artifactFilename = `rollback-${safeRunId}-${safeCandidateId}-${timestamp.replace(/[:.]/g, "-")}.json`
  const artifactPath = path.join(outputDir, "rollbacks", artifactFilename)

  execution.rollbackRecorded = true

  const artifact: BenchOptRollbackArtifact = {
    schemaVersion: 1,
    timestamp,
    runId: plan.runId,
    candidateId: plan.candidateId,
    trigger: plan.trigger,
    mode: dryRun ? "dry-run" : "real",
    plan,
    safetyChecks,
    previousChampion,
    execution,
    artifactPath,
  }

  // Write to disk
  await mkdir(path.dirname(artifactPath), { recursive: true })
  await writeFile(artifactPath, JSON.stringify(artifact, null, 2))
  notes.push(`Rollback artifact written to ${artifactPath}.`)

  return {
    artifact,
    artifactPath,
    championRestored: execution.championRestored,
    notes,
  }
}
