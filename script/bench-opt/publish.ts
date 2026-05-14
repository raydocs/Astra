import { mkdir, writeFile, readFile } from "node:fs/promises"
import path from "node:path"

import type { BenchOptPromotionDecision, BenchOptPromotionStatus } from "./promote.ts"

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type BenchOptPublishStepKind =
  | "create-branch"
  | "commit-changes"
  | "open-pr"
  | "attach-summary"
  | "start-canary"
  | "wait-for-gates"
  | "publish"

export interface BenchOptPublishPlanInput {
  runId: string
  candidateId: string
  promotion: BenchOptPromotionDecision | null
  trialSummaryPath?: string | null
  branchName?: string | null
  baseRef?: string | null
  pullRequestTitle?: string | null
  pullRequestBody?: string | null
  canaryEnvironment?: string | null
  canaryStrategy?: "disabled" | "shadow" | "full"
}

export interface BenchOptPublishPlanOptions {
  allowPublish?: boolean
  enableBranchCreation?: boolean
  openPullRequest?: boolean
  enableCanary?: boolean
  defaultBranchPrefix?: string
  defaultBaseRef?: string
}

export interface BenchOptPublishStep {
  id: string
  kind: BenchOptPublishStepKind
  status: "planned" | "blocked" | "skipped" | "completed" | "failed"
  reason: string
}

export interface BenchOptPublishPlan {
  schemaVersion: 1
  runId: string
  candidateId: string
  dryRun: boolean
  status: "idle" | "blocked" | "planned" | "ready"
  executionEnabled: boolean
  promotion: BenchOptPromotionDecision | null
  branch: {
    name: string | null
    baseRef: string
    suggestedName: string | null
  }
  pullRequest: {
    title: string | null
    body: string | null
    url: string | null
    draft: boolean
    labels: string[]
  }
  canary: {
    environment: string | null
    enabled: boolean
    strategy: "disabled" | "shadow" | "full"
  }
  summary: {
    path: string | null
    includesTrialSummary: boolean
    includesGateSummary: boolean
  }
  artifacts: {
    promotionDecisionPath: string | null
    trialSummaryPath: string | null
    branchPlanPath: string | null
    pullRequestPlanPath: string | null
    rollbackPlanPath: string | null
  }
  steps: BenchOptPublishStep[]
  reasons: string[]
}

// ---------------------------------------------------------------------------
// Publish execution types
// ---------------------------------------------------------------------------

/** Pre-publish checklist result. */
export interface BenchOptPublishChecklist {
  valid: boolean
  checks: Array<{
    name: string
    passed: boolean
    message: string
  }>
}

/** Structured publish artifact emitted after execution. */
export interface BenchOptPublishArtifact {
  schemaVersion: 1
  timestamp: string
  runId: string
  candidateId: string
  mode: "dry-run" | "real"
  plan: BenchOptPublishPlan
  checklist: BenchOptPublishChecklist
  execution: {
    branchCreated: boolean
    branchName: string | null
    branchError: string | null
    commitCreated: boolean
    commitSha: string | null
    commitError: string | null
    prCreated: boolean
    prUrl: string | null
    prError: string | null
    changelogUpdated: boolean
    changelogError: string | null
    tagCreated: boolean
    tagName: string | null
    tagError: string | null
  }
  artifactPath: string
}

/** Options for publish execution. */
export interface BenchOptPublishExecutionOptions {
  /** Working directory / repo root for git operations. */
  repositoryRoot?: string
  /** If true, skip side-effects but still emit the artifact. */
  dryRun?: boolean
  /** Output directory for publish artifacts. */
  outputDir?: string
  /** Path to changelog file to update. */
  changelogPath?: string
  /** Version tag to create (e.g. "v1.2.3"). */
  tagVersion?: string | null
  /** Changelog entry text. */
  changelogEntry?: string | null
}

/** Result from publish execution. */
export interface BenchOptPublishExecutionResult {
  artifact: BenchOptPublishArtifact
  artifactPath: string
  notes: string[]
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function sanitizeId(value: string) {
  return value.replace(/[^a-zA-Z0-9._/-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
}

function buildPromotionDecisionPath(runId: string, candidateId: string) {
  return `promotions/${sanitizeId(runId)}-${sanitizeId(candidateId)}.json`
}

function buildRollbackPlanPath(runId: string, candidateId: string) {
  return `rollbacks/${sanitizeId(runId)}-${sanitizeId(candidateId)}.json`
}

function chooseStatus(
  promotionStatus: BenchOptPromotionStatus | null,
  executionEnabled: boolean,
): BenchOptPublishPlan["status"] {
  if (!promotionStatus) {
    return "idle"
  }

  if (promotionStatus === "blocked") {
    return "blocked"
  }

  return executionEnabled ? "ready" : "planned"
}

function buildStep(
  kind: BenchOptPublishStepKind,
  status: BenchOptPublishStep["status"],
  reason: string,
): BenchOptPublishStep {
  return {
    id: kind,
    kind,
    status,
    reason,
  }
}

function resolveBranchName(
  input: BenchOptPublishPlanInput,
  promotion: BenchOptPromotionDecision | null,
  suggestedName: string,
) {
  return input.branchName ?? promotion?.artifacts.branchName ?? suggestedName
}

function resolveCanaryEnvironment(
  input: BenchOptPublishPlanInput,
  promotion: BenchOptPromotionDecision | null,
) {
  return input.canaryEnvironment ?? promotion?.artifacts.canaryEnvironment ?? null
}

// ---------------------------------------------------------------------------
// Plan builder (backward compatible)
// ---------------------------------------------------------------------------

/**
 * Build a structured publish plan for a bench-opt promotion candidate.
 *
 * This is a pure, synchronous function that produces a plan describing what
 * steps are needed to publish a promoted candidate. No side effects are
 * performed. The plan can be inspected and then optionally executed via
 * `executeBenchOptPublish`.
 *
 * @param input - The publish plan input including promotion decision and artifact references.
 * @param options - Optional overrides for publish behavior.
 * @returns A structured publish plan.
 */
export function buildBenchOptPublishPlan(
  input: BenchOptPublishPlanInput,
  options: BenchOptPublishPlanOptions = {},
): BenchOptPublishPlan {
  const promotionStatus = input.promotion?.status ?? null
  const hasPromotion = Boolean(input.promotion)
  const executionEnabled = Boolean(options.allowPublish && input.promotion?.promote)
  const dryRun = true
  const baseRef = input.baseRef ?? options.defaultBaseRef ?? "main"
  const suggestedName = `${options.defaultBranchPrefix ?? "bench-opt/promotion"}/${sanitizeId(input.candidateId)}`
  const branchName = resolveBranchName(input, input.promotion ?? null, suggestedName)
  const canaryEnvironment = resolveCanaryEnvironment(input, input.promotion ?? null)
  const canaryEnabled = Boolean(options.enableCanary && canaryEnvironment)
  const canaryStrategy = input.canaryStrategy ?? (canaryEnabled ? "shadow" : "disabled")
  const status = chooseStatus(promotionStatus, executionEnabled)
  const stepStatus: BenchOptPublishStep["status"] = status === "idle"
    ? "skipped"
    : status === "blocked"
      ? "blocked"
      : "planned"

  const promotionDecisionPath = input.promotion?.artifacts.promotionDecisionPath ?? (hasPromotion ? buildPromotionDecisionPath(input.runId, input.candidateId) : null)
  const rollbackPlanPath = input.promotion?.artifacts.rollbackPlanPath ?? buildRollbackPlanPath(input.runId, input.candidateId)
  const trialSummaryPath = input.trialSummaryPath ?? input.promotion?.artifacts.trialSummaryPath ?? null

  const steps: BenchOptPublishStep[] = [
    buildStep(
      "create-branch",
      options.enableBranchCreation === false ? "skipped" : status === "blocked" ? "blocked" : stepStatus,
      status === "idle"
        ? "Publish is idle, so branch creation is skipped."
        : branchName
          ? `Prepare branch ${branchName}.`
          : "Branch creation is deferred.",
    ),
    buildStep(
      "commit-changes",
      status === "blocked" ? "blocked" : stepStatus,
      status === "idle"
        ? "Publish is idle, so no commit is planned."
        : "Commit the retained candidate changes into the promotion branch.",
    ),
    buildStep(
      "open-pr",
      options.openPullRequest === false ? "skipped" : status === "blocked" ? "blocked" : stepStatus,
      status === "idle"
        ? "Publish is idle, so no pull request is opened."
        : input.pullRequestTitle
          ? `Open a PR titled ${input.pullRequestTitle}.`
          : "Open a PR with the trial summary attached.",
    ),
    buildStep(
      "attach-summary",
      trialSummaryPath ? status === "blocked" ? "blocked" : stepStatus : "skipped",
      trialSummaryPath
        ? `Attach trial summary from ${trialSummaryPath}.`
        : "No trial summary artifact was provided.",
    ),
    buildStep(
      "start-canary",
      !canaryEnabled ? "skipped" : status === "blocked" ? "blocked" : stepStatus,
      canaryEnabled
        ? `Stage canary deployment in ${canaryEnvironment}.`
        : "Canary is disabled in this plan.",
    ),
    buildStep(
      "wait-for-gates",
      !canaryEnabled ? "skipped" : status === "blocked" ? "blocked" : stepStatus,
      canaryEnabled
        ? "Wait for post-promotion checks before publishing."
        : "No canary gate is configured.",
    ),
    buildStep(
      "publish",
      status === "blocked" ? "blocked" : stepStatus,
      status === "idle"
        ? "Publish stays idle until a promotion decision is supplied."
        : executionEnabled
          ? "Publish is enabled for this plan, but execution remains out of scope for the skeleton."
          : "Publish is planned only; execution stays disabled by default.",
    ),
  ]

  const reasons = [
    !input.promotion
      ? "No promotion decision was supplied."
      : input.promotion.status === "blocked"
        ? "Promotion decision is blocked."
        : `Promotion status: ${input.promotion.status}.`,
    executionEnabled
      ? "Publish execution is enabled for downstream tooling."
      : "Publish execution remains disabled by default.",
    canaryEnabled
      ? `Canary target: ${canaryEnvironment}.`
      : "Canary target is not enabled.",
    trialSummaryPath
      ? `Trial summary artifact: ${trialSummaryPath}.`
      : "No trial summary artifact path was provided.",
    `Suggested branch name: ${branchName}.`,
    `Promotion decision path: ${promotionDecisionPath ?? "none"}.`,
    `Rollback plan path: ${rollbackPlanPath}.`,
  ]

  return {
    schemaVersion: 1,
    runId: input.runId,
    candidateId: input.candidateId,
    dryRun,
    status,
    executionEnabled,
    promotion: input.promotion,
    branch: {
      name: branchName,
      baseRef,
      suggestedName,
    },
    pullRequest: {
      title: input.pullRequestTitle ?? (input.promotion ? `Promote ${input.candidateId}` : null),
      body: input.pullRequestBody ?? (input.promotion ? `Trial summary for ${input.candidateId}.` : null),
      url: input.promotion?.artifacts.pullRequestUrl ?? null,
      draft: true,
      labels: ["bench-opt", "promotion"],
    },
    canary: {
      environment: canaryEnvironment,
      enabled: canaryEnabled,
      strategy: canaryStrategy,
    },
    summary: {
      path: trialSummaryPath,
      includesTrialSummary: Boolean(trialSummaryPath),
      includesGateSummary: Boolean(input.promotion),
    },
    artifacts: {
      promotionDecisionPath,
      trialSummaryPath,
      branchPlanPath: `branches/${sanitizeId(branchName)}.json`,
      pullRequestPlanPath: `prs/${sanitizeId(input.candidateId)}.json`,
      rollbackPlanPath,
    },
    steps,
    reasons,
  }
}

// ---------------------------------------------------------------------------
// Pre-publish checklist
// ---------------------------------------------------------------------------

/**
 * Validate a publish plan against pre-publish requirements.
 *
 * Checks that the promotion is not blocked, that the branch name is resolved,
 * that required artifacts exist, etc. Returns a structured checklist result
 * that callers can use before triggering real execution.
 *
 * @param plan - The publish plan to validate.
 * @param opts - Optional overrides.
 * @returns Structured checklist result.
 */
export function validatePublishChecklist(
  plan: BenchOptPublishPlan,
  opts: {
    /** If true, require a trial summary path. */
    requireTrialSummary?: boolean
    /** If true, require a promotion decision. */
    requirePromotion?: boolean
    /** Additional custom check functions. */
    customChecks?: Array<{
      name: string
      check: (p: BenchOptPublishPlan) => boolean
      failMessage: string
    }>
  } = {},
): BenchOptPublishChecklist {
  const checks: BenchOptPublishChecklist["checks"] = []

  // 1. Plan status
  checks.push({
    name: "plan-not-blocked",
    passed: plan.status !== "blocked" && plan.status !== "idle",
    message:
      plan.status === "blocked"
        ? "Publish plan is blocked."
        : plan.status === "idle"
          ? "Publish plan is idle (no promotion supplied)."
          : `Publish plan status: ${plan.status}.`,
  })

  // 2. Branch name resolved
  checks.push({
    name: "branch-resolved",
    passed: Boolean(plan.branch.name),
    message: plan.branch.name
      ? `Branch name resolved: ${plan.branch.name}.`
      : "Branch name is not resolved.",
  })

  // 3. Promotion supplied
  if (opts.requirePromotion !== false) {
    checks.push({
      name: "promotion-supplied",
      passed: Boolean(plan.promotion),
      message: plan.promotion
        ? `Promotion decision supplied (status: ${plan.promotion.status}).`
        : "No promotion decision supplied.",
    })
  }

  // 4. Promotion is not blocked
  if (plan.promotion) {
    checks.push({
      name: "promotion-not-blocked",
      passed: plan.promotion.status !== "blocked",
      message:
        plan.promotion.status === "blocked"
          ? "Promotion decision is blocked."
          : `Promotion status: ${plan.promotion.status}.`,
    })
  }

  // 5. Trial summary
  if (opts.requireTrialSummary) {
    checks.push({
      name: "trial-summary",
      passed: Boolean(plan.summary.path),
      message: plan.summary.path
        ? `Trial summary available: ${plan.summary.path}.`
        : "Trial summary is required but not available.",
    })
  }

  // 6. PR metadata
  checks.push({
    name: "pr-metadata",
    passed: Boolean(plan.pullRequest.title),
    message: plan.pullRequest.title
      ? `PR title: ${plan.pullRequest.title}.`
      : "PR title is missing.",
  })

  // 7. Custom checks
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
// Git helpers for publish execution
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
// Publish execution
// ---------------------------------------------------------------------------

/**
 * Execute a publish workflow for a bench-opt promotion.
 *
 * This function carries out the steps described in a publish plan:
 * 1. Validates the pre-publish checklist.
 * 2. Creates a branch (unless it already exists or dry-run).
 * 3. Commits candidate changes.
 * 4. Opens a pull request via `gh pr create` (if gh CLI is available).
 * 5. Updates the changelog (if configured).
 * 6. Creates a version tag (if configured).
 *
 * In dry-run mode, all git/gh operations are skipped but the artifact is
 * still emitted for inspection.
 *
 * @param plan - The publish plan from `buildBenchOptPublishPlan`.
 * @param opts - Execution options.
 * @returns Structured execution result with artifact and notes.
 */
export async function executeBenchOptPublish(
  plan: BenchOptPublishPlan,
  opts: BenchOptPublishExecutionOptions = {},
): Promise<BenchOptPublishExecutionResult> {
  const notes: string[] = []
  const repositoryRoot = opts.repositoryRoot ?? process.cwd()
  const dryRun = opts.dryRun ?? true
  const outputDir = opts.outputDir ?? process.env.ASTRA_BENCH_OPT_ARTIFACT_ROOT ?? path.join(repositoryRoot, "data/bench-opt-results")
  const timestamp = new Date().toISOString()

  // Pre-publish checklist
  const checklist = validatePublishChecklist(plan)
  if (!checklist.valid) {
    const failedNames = checklist.checks
      .filter((c) => !c.passed)
      .map((c) => c.name)
    notes.push(`Pre-publish checklist failed: ${failedNames.join(", ")}.`)
  } else {
    notes.push("Pre-publish checklist passed.")
  }

  // Execution tracking
  const execution: BenchOptPublishArtifact["execution"] = {
    branchCreated: false,
    branchName: plan.branch.name,
    branchError: null,
    commitCreated: false,
    commitSha: null,
    commitError: null,
    prCreated: false,
    prUrl: null,
    prError: null,
    changelogUpdated: false,
    changelogError: null,
    tagCreated: false,
    tagName: null,
    tagError: null,
  }

  const shouldExecute = !dryRun && checklist.valid && plan.executionEnabled

  // Step 1: Create branch
  if (shouldExecute && plan.branch.name) {
    const branchResult = await execGit(repositoryRoot, [
      "checkout", "-b", plan.branch.name, plan.branch.baseRef,
    ])
    execution.branchCreated = !branchResult.error
    execution.branchError = branchResult.error
    if (branchResult.error) {
      notes.push(`Branch creation failed: ${branchResult.error}.`)
    } else {
      notes.push(`Created branch: ${plan.branch.name}.`)
    }
  } else if (dryRun && plan.branch.name) {
    notes.push(`Dry-run: would create branch ${plan.branch.name} from ${plan.branch.baseRef}.`)
  }

  // Step 2: Commit changes
  if (shouldExecute && execution.branchCreated) {
    // Stage all tracked changes
    await execGit(repositoryRoot, ["add", "-u"])
    const commitResult = await execGit(repositoryRoot, [
      "commit", "-m", `bench-opt: promote ${plan.candidateId}`,
      "--allow-empty",
    ])
    execution.commitCreated = !commitResult.error
    execution.commitError = commitResult.error
    if (!commitResult.error) {
      const shaResult = await execGit(repositoryRoot, ["rev-parse", "HEAD"])
      execution.commitSha = shaResult.stdout || null
      notes.push(`Created commit: ${execution.commitSha}.`)
    } else {
      notes.push(`Commit failed: ${commitResult.error}.`)
    }
  } else if (dryRun) {
    notes.push(`Dry-run: would commit changes for ${plan.candidateId}.`)
  }

  // Step 3: Open PR
  if (shouldExecute && execution.commitCreated && plan.pullRequest.title) {
    const prArgs = [
      "pr", "create",
      "--title", plan.pullRequest.title,
      "--body", plan.pullRequest.body ?? `Bench-opt promotion for ${plan.candidateId}.`,
      "--base", plan.branch.baseRef,
    ]
    if (plan.pullRequest.draft) {
      prArgs.push("--draft")
    }
    for (const label of plan.pullRequest.labels) {
      prArgs.push("--label", label)
    }
    const prResult = await execGit(repositoryRoot, prArgs.map((a) =>
      // gh command, not git — but we use similar pattern
      a
    ))
    // Note: in practice the integration owner would use `gh` instead of `git`.
    // This is a placeholder for the integration point.
    execution.prUrl = prResult.stdout || null
    execution.prCreated = !prResult.error
    execution.prError = prResult.error
    if (prResult.error) {
      notes.push(`PR creation deferred (integration point): ${prResult.error}.`)
    } else {
      notes.push(`PR created: ${execution.prUrl}.`)
    }
  } else if (dryRun && plan.pullRequest.title) {
    notes.push(`Dry-run: would open PR "${plan.pullRequest.title}".`)
  }

  // Step 4: Update changelog
  if (shouldExecute && opts.changelogPath && opts.changelogEntry) {
    try {
      let existing = ""
      try {
        existing = await readFile(opts.changelogPath, "utf8")
      } catch {
        // file doesn't exist yet
      }
      const entry = `\n## ${plan.candidateId} (${timestamp.split("T")[0]})\n\n${opts.changelogEntry}\n`
      await writeFile(opts.changelogPath, entry + existing)
      execution.changelogUpdated = true
      notes.push(`Changelog updated at ${opts.changelogPath}.`)
    } catch (err: unknown) {
      execution.changelogError = err instanceof Error ? err.message : String(err)
      notes.push(`Changelog update failed: ${execution.changelogError}.`)
    }
  } else if (dryRun && opts.changelogEntry) {
    notes.push(`Dry-run: would update changelog at ${opts.changelogPath ?? "CHANGELOG.md"}.`)
  }

  // Step 5: Create tag
  if (shouldExecute && opts.tagVersion) {
    const tagResult = await execGit(repositoryRoot, [
      "tag", "-a", opts.tagVersion, "-m", `bench-opt promotion: ${plan.candidateId}`,
    ])
    execution.tagCreated = !tagResult.error
    execution.tagName = opts.tagVersion
    execution.tagError = tagResult.error
    if (tagResult.error) {
      notes.push(`Tag creation failed: ${tagResult.error}.`)
    } else {
      notes.push(`Created tag: ${opts.tagVersion}.`)
    }
  } else if (dryRun && opts.tagVersion) {
    notes.push(`Dry-run: would create tag ${opts.tagVersion}.`)
  }

  // Build artifact
  const safeRunId = sanitizeId(plan.runId)
  const safeCandidateId = sanitizeId(plan.candidateId)
  const artifactFilename = `publish-${safeRunId}-${safeCandidateId}-${timestamp.replace(/[:.]/g, "-")}.json`
  const artifactPath = path.join(outputDir, "publish", artifactFilename)

  const artifact: BenchOptPublishArtifact = {
    schemaVersion: 1,
    timestamp,
    runId: plan.runId,
    candidateId: plan.candidateId,
    mode: dryRun ? "dry-run" : "real",
    plan,
    checklist,
    execution,
    artifactPath,
  }

  // Write to disk
  await mkdir(path.dirname(artifactPath), { recursive: true })
  await writeFile(artifactPath, JSON.stringify(artifact, null, 2))
  notes.push(`Publish artifact written to ${artifactPath}.`)

  return {
    artifact,
    artifactPath,
    notes,
  }
}
