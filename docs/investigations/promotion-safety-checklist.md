# Promotion Safety Checklist

_Created: 2026-03-26_

This document defines the safety policy for promoting bench-opt candidates. It enumerates every condition that must be checked before a candidate is promoted, specifies which module and function detects each condition, describes what the operator should see, and prescribes the recovery action. It is intended to be the authoritative reference for the integration owner wiring guardrails into `runner.ts` and `status.ts`.

---

## 1. Promotion-Blocking Conditions

These conditions MUST block promotion. If any one is true, the candidate MUST NOT be promoted regardless of score improvements.

### 1.1 Promotion Gate Not Qualified

| Field | Value |
|-------|-------|
| **What it checks** | The composite gate flag `gate.qualified` is false, meaning one or more of: required splits are missing, required checks have not passed, live evaluator has not passed, or canary gate is not ready. |
| **Detection module** | `bench-opt/promote.ts` -- `decideBenchOptPromotion()`. The function computes `gateQualified` as the conjunction of `input.gate.qualified`, `missingSplits.length === 0`, `missingChecks.length === 0`, `liveEvaluatorPassed`, and `canaryReady`. |
| **What the operator sees** | `BenchOptPromotionDecision.status === "blocked"` and `reasons` array containing "Promotion gate is blocked." with specifics about which sub-gate failed. |
| **Recovery action** | Identify the failing sub-gate from `decision.gate` (check `missingSplits`, `missingChecks`, `liveEvaluatorPassed`, `canaryReady`). Re-run the missing splits or checks. Do not override. |

### 1.2 Critical Guardrail Violation

| Field | Value |
|-------|-------|
| **What it checks** | Any guardrail violation with `severity: "critical"` is present. Critical violations include: average score regression exceeding 2x the configured `maxAverageRegressionPercent` threshold, per-surface regression exceeding 2x `maxSurfaceRegressionPercent`, maximum iterations reached (`max-iterations`), severe overfitting (gap >= 2x `overfitDeltaThreshold`). |
| **Detection module** | `bench-opt/guardrails.ts` -- `checkGuardrails()`. Returns `BenchOptGuardrailResult` with `verdict: "block"` when any violation has `severity: "critical"`. Individual detectors: `detectAverageRegression()`, `detectSurfaceRegressions()`, `detectIterationOverrun()`, `detectOverfitting()`. |
| **What the operator sees** | `BenchOptGuardrailResult.verdict === "block"` and `violations[]` containing one or more entries with `severity: "critical"`. Each violation has a human-readable `description` and structured `evidence`. |
| **Recovery action** | For `average-regression` or `surface-regression:*`: the candidate is worse than the champion. Reject and generate a new candidate. For `max-iterations`: the optimization loop is exhausted; stop the loop and promote the best known champion or start a new experiment. For `overfitting`: the candidate is overfit to train data; reject and add validation diversity. |

### 1.3 Critical Red Flag

| Field | Value |
|-------|-------|
| **What it checks** | Red-flag detectors find critical anomalies in the experiment history: perfect 1.0 scores across all sub-dimensions (`perfect-scores`), all-zero scores (`all-zero-scores`), dangerous file rewrites (`dangerous-rewrite`), or extremely high score variance (`flaky-scores` with stddev > 2x threshold). |
| **Detection module** | `bench-opt/red-flags.ts` -- `detectRedFlags()`. Internally calls `detectSuspiciousScorePatterns()`, `detectGenerationAnomalies()`, `detectFlakyBehavior()`. Returns `BenchOptRedFlagReport` with `flags[]`. |
| **What the operator sees** | `BenchOptRedFlagReport.flags` contains entries with `severity: "critical"`. Each flag has `id`, `description`, `evidence`, and `recommendedAction`. |
| **Recovery action** | For `perfect-scores` / `all-zero-scores`: the evaluator is broken. Fix the evaluator, discard the trial, re-run. For `dangerous-rewrite`: the candidate attempted to delete test files or configuration. Block the candidate permanently. For `flaky-scores` (critical): re-run with additional trials to confirm consistency. Do not promote until variance is within threshold. |

### 1.4 Keep/Reject Decision is "Reject"

| Field | Value |
|-------|-------|
| **What it checks** | The structured comparison between baseline and trial results in a reject decision. This happens when: the trial has zero scenarios, the average delta is below the retain threshold, or regressions exceed `retainMaxRegressions`. |
| **Detection module** | `bench-opt/keep-reject.ts` -- `decideBenchOptKeepReject()` via `decideFromComparison()`. Uses `BenchOptKeepRejectThresholds` with defaults: `promoteMinAverageDelta: 0.5`, `retainMinAverageDelta: 0`, `retainMaxRegressions: 1`. |
| **What the operator sees** | `BenchOptKeepRejectResult.decision === "reject"` with `reasons[]` explaining the delta, regression count, and notable scenario changes. `signals.regressions` and `signals.averageDelta` provide the raw numbers. |
| **Recovery action** | Examine `comparison.scenarioDeltas` to identify which scenarios regressed. Generate a new candidate that addresses the regressions. Do not attempt to promote a rejected candidate. |

### 1.5 Pre-Promotion Validation Failure

| Field | Value |
|-------|-------|
| **What it checks** | The structured pre-promotion validation finds that one or more gates are not met: gate not qualified, insufficient observed splits, missing required checks, live evaluator not passed, canary gate not ready. |
| **Detection module** | `bench-opt/promote.ts` -- `validatePrePromotion()`. Called inside `executeBenchOptPromotion()` before any git operations. Returns `BenchOptPrePromotionValidation` with `valid: boolean` and `checks[]`. |
| **What the operator sees** | `BenchOptPrePromotionValidation.valid === false`. The `checks[]` array contains entries like `{ name: "gate-qualified", passed: false, message: "..." }`. The promotion artifact notes include "Pre-promotion validation failed: gate-qualified, observed-splits, ..." |
| **Recovery action** | Address each failing check individually. Re-run the promotion decision after all checks pass. The `checks[].message` field provides the specific failure reason. |

### 1.6 Pre-Publish Checklist Failure

| Field | Value |
|-------|-------|
| **What it checks** | The publish plan fails structural validity: plan is blocked or idle, branch name is unresolved, no promotion decision supplied, promotion is blocked, or PR metadata is missing. |
| **Detection module** | `bench-opt/publish.ts` -- `validatePublishChecklist()`. Called inside `executeBenchOptPublish()`. Returns `BenchOptPublishChecklist` with `valid: boolean` and `checks[]`. |
| **What the operator sees** | `BenchOptPublishChecklist.valid === false`. Individual checks: `plan-not-blocked`, `branch-resolved`, `promotion-supplied`, `promotion-not-blocked`, `pr-metadata`. |
| **Recovery action** | For `plan-not-blocked`: resolve the upstream promotion blocker. For `branch-resolved`: supply a branch name via `--branch-name` or ensure the publish plan input has one. For `promotion-supplied`: run the promotion decision step first. For `pr-metadata`: supply a PR title. |

### 1.7 Rollback Safety Check Failure (when rollback is needed)

| Field | Value |
|-------|-------|
| **What it checks** | Before executing a rollback, the system verifies: rollback is not idle, trigger is recognized, rollback target (branch or PR) exists, and optionally the branch exists on remote and promotion history is available. |
| **Detection module** | `bench-opt/rollback.ts` -- `validateRollbackSafety()`. Returns `BenchOptRollbackSafetyChecks` with `valid: boolean` and `checks[]`. |
| **What the operator sees** | `BenchOptRollbackSafetyChecks.valid === false`. Checks: `not-idle`, `recognized-trigger`, `rollback-target-exists`, optionally `branch-exists-on-remote`, `promotion-history`. |
| **Recovery action** | For `not-idle`: supply a trigger via `--rollback-trigger`. For `recognized-trigger`: use a valid trigger value (`post-promotion-check-failed`, `canary-regression`, `manual`, `promotion-revoked`). For `rollback-target-exists`: ensure the promotion created a branch or PR that can be rolled back. |

### 1.8 Missing Required Splits

| Field | Value |
|-------|-------|
| **What it checks** | The candidate has not been evaluated on all required splits (default: `["train", "validation"]`). This is checked both in the guardrail system and the promotion gate. |
| **Detection module** | `bench-opt/guardrails.ts` -- `detectSplitViolations()` (returns violation with `id: "split-discipline"`). Also `bench-opt/promote.ts` -- `decideBenchOptPromotion()` checks `missingSplits.length === 0`. |
| **What the operator sees** | Guardrail: `violation.id === "split-discipline"` with `evidence.missingSplits`. Promotion: `decision.gate.missingSplits` is non-empty. |
| **Recovery action** | Run the candidate on the missing splits. Typically: `pnpm bench:opt -- --split validation` and `pnpm bench:opt -- --split holdout`. |

---

## 2. Warning-Only Conditions

These conditions SHOULD warn the operator but SHOULD NOT automatically block promotion. The operator should review and decide.

### 2.1 Warning-Level Average Score Regression

| Field | Value |
|-------|-------|
| **What it checks** | The average total score dropped by more than `maxAverageRegressionPercent` (default 5%) but less than 2x that threshold (10%). |
| **Detection module** | `bench-opt/guardrails.ts` -- `detectAverageRegression()`. Returns a violation with `severity: "warning"` when the drop exceeds the threshold but is less than double. |
| **What the operator sees** | `BenchOptGuardrailResult.verdict === "warn"` with a violation `id: "average-regression"`, `severity: "warning"`. The `description` includes the exact percentage drop. |
| **Recovery action** | Evaluate whether the regression is acceptable given improvements in other areas. If the net effect is positive (per keep/reject signals), the operator may choose to proceed. If not, reject and iterate. |

### 2.2 Warning-Level Per-Surface Regression

| Field | Value |
|-------|-------|
| **What it checks** | A specific surface's average score dropped by more than `maxSurfaceRegressionPercent` (default 10%) but less than double that threshold. |
| **Detection module** | `bench-opt/guardrails.ts` -- `detectSurfaceRegressions()`. Returns violations with `id: "surface-regression:<surfaceName>"`, `severity: "warning"`. |
| **What the operator sees** | One or more violations identifying the affected surface, the old and new scores, and the percentage change. |
| **Recovery action** | Check whether the surface is critical to the user. If the regressing surface is high-priority (e.g., `page-translation`), treat as blocking. If low-priority (e.g., a surface with few users), the operator may accept with documentation. |

### 2.3 Warning-Level Overfitting

| Field | Value |
|-------|-------|
| **What it checks** | Train score is rising while validation score is dropping, with the gap exceeding `overfitDeltaThreshold` (default 0.15) but less than 2x that value. |
| **Detection module** | `bench-opt/guardrails.ts` -- `detectOverfitting()`. Uses `context.trainScoreTrend` and `context.validationScoreTrend`. Returns `severity: "warning"` when gap is between 1x and 2x threshold. |
| **What the operator sees** | Violation `id: "overfitting"` with `evidence.trainDelta`, `evidence.validationDelta`, `evidence.gap`, and the last 3 data points for each trend. |
| **Recovery action** | Add more validation diversity or reduce the training signal. Consider running a holdout split to confirm. If the trend reverses in the next iteration, the warning can be dismissed. |

### 2.4 Missing Split Discipline (Guardrail Warning)

| Field | Value |
|-------|-------|
| **What it checks** | Required splits have not all been observed yet, but the experiment is still in progress. This is a `severity: "warning"` guardrail violation. |
| **Detection module** | `bench-opt/guardrails.ts` -- `detectSplitViolations()`. Returns violation with `id: "split-discipline"`, `severity: "warning"`. |
| **What the operator sees** | Violation listing required vs. observed splits and the missing set. |
| **Recovery action** | If the experiment is still in progress, this is expected and can be ignored. If the experiment is complete and splits are still missing, this escalates to a blocking condition (see 1.8). |

### 2.5 Identical Sub-Scores

| Field | Value |
|-------|-------|
| **What it checks** | A trial has all five sub-scores (`baselineHealth`, `promptClarity`, `contextCoverage`, `artifactAlignment`, `structuralSignals`) identical, suggesting the evaluator is not differentiating. |
| **Detection module** | `bench-opt/red-flags.ts` -- `detectSuspiciousScorePatterns()`. Returns flag with `id: "identical-scores"`, `severity: "warning"`. |
| **What the operator sees** | Flag describing the trial ID and the identical score value. |
| **Recovery action** | Inspect the evaluator logic. Confirm scores are being computed independently. If confirmed as a false positive (e.g., a genuinely uniform candidate), dismiss. |

### 2.6 Stale/Duplicate Candidates

| Field | Value |
|-------|-------|
| **What it checks** | The same candidate content (by hash of prompt + context) was submitted multiple times across trials. The generator may be stuck. |
| **Detection module** | `bench-opt/red-flags.ts` -- `detectCandidateStaleness()`. Returns flag with `id: "stale-candidate"`, `severity: "warning"`. |
| **What the operator sees** | Flag listing the duplicate trial IDs and the count. |
| **Recovery action** | Verify the candidate generator is producing diverse outputs. Add deduplication. If the duplicates are intentional reruns for stability testing, dismiss. |

### 2.7 No-Op Edits

| Field | Value |
|-------|-------|
| **What it checks** | A trial contains edit instructions where `search === replace`, meaning the edit does nothing. |
| **Detection module** | `bench-opt/red-flags.ts` -- `detectGenerationAnomalies()`. Returns flag with `id: "noop-edits"`, `severity: "warning"`. |
| **What the operator sees** | Flag listing the trial ID and the file paths with no-op edits. |
| **Recovery action** | Filter no-op edits in the candidate generator. These waste evaluation time. Not blocking, but should be cleaned up. |

### 2.8 Low Score Diversity

| Field | Value |
|-------|-------|
| **What it checks** | All trials score within a very narrow range (less than `minExpectedScoreRange`, default 0.05), suggesting the optimizer is not exploring effectively. |
| **Detection module** | `bench-opt/red-flags.ts` -- `detectLowDiversity()`. Returns flag with `id: "low-diversity"`, `severity: "warning"`. Requires at least 3 trials. |
| **What the operator sees** | Flag with the min, max, range, and trial count. |
| **Recovery action** | Increase prompt/context diversity. Broaden optimization objectives. Not blocking, but indicates the optimizer is not making progress. |

### 2.9 Keep/Reject Decision is "Retain" (not "Promote")

| Field | Value |
|-------|-------|
| **What it checks** | The candidate meets retain thresholds but does not meet promote thresholds. Specifically: `averageDelta >= retainMinAverageDelta` (default 0) and `regressions <= retainMaxRegressions` (default 1), but `averageDelta < promoteMinAverageDelta` (default 0.5) or regressions > 0. |
| **Detection module** | `bench-opt/keep-reject.ts` -- `decideFromComparison()`. Returns `"retain"`. |
| **What the operator sees** | `BenchOptKeepRejectResult.decision === "retain"`. The `signals` show the delta and regression count. |
| **Recovery action** | The candidate is acceptable but not exceptional. The operator may choose to continue iterating for a better candidate, or accept the current one if the improvement is sufficient for the use case. |

---

## 3. Mapping to Candidate Behavior

This section maps each condition to actual candidate evaluation results and specifies which guardrail/red-flag signals trigger which policy.

### 3.1 Guardrail Signal Mapping

| Guardrail Signal | Violation ID | Trigger Condition | Policy |
|------------------|-------------|-------------------|--------|
| Average score regression | `average-regression` | `pctChange(championAvg, candidateAvg) < -maxAverageRegressionPercent` | Warning at 1x threshold, Block at 2x threshold |
| Per-surface regression | `surface-regression:<name>` | Any surface drops more than `maxSurfaceRegressionPercent` | Warning at 1x threshold, Block at 2x threshold |
| Missing required splits | `split-discipline` | `observedSplits` does not contain all entries in `config.requiredSplits` | Warning (escalates to Block at promotion gate) |
| Iteration cap reached | `max-iterations` | `currentIteration >= config.maxIterations` (default 20) | Block |
| Overfitting detected | `overfitting` | Train score rising AND validation score dropping, gap >= `overfitDeltaThreshold` | Warning at 1x threshold, Block at 2x threshold |

### 3.2 Red Flag Signal Mapping

| Red Flag Signal | Flag ID | Trigger Condition | Policy |
|-----------------|---------|-------------------|--------|
| All sub-scores identical | `identical-scores` | `baselineHealth === promptClarity === contextCoverage === artifactAlignment === structuralSignals` | Warning |
| Perfect 1.0 everywhere | `perfect-scores` | All five sub-scores are exactly 1.0 | Block (evaluator bug) |
| All zeros | `all-zero-scores` | All five sub-scores are 0 and `total === 0` | Block (evaluator failure) |
| Dangerous file rewrite | `dangerous-rewrite` | `kind === "rewrite"` on a test/config file with empty content | Block |
| No-op edits | `noop-edits` | `kind === "replace"` where `search === replace` | Warning |
| Stale candidate | `stale-candidate` | Same candidate hash submitted in multiple trials | Warning |
| Flaky scores | `flaky-scores` | `standardDeviation(totals) > maxAcceptableStdDev` for same candidate+split | Warning at 1x threshold, Block at 2x threshold |
| Low diversity | `low-diversity` | `max(totals) - min(totals) < minExpectedScoreRange` across 3+ trials | Warning |

### 3.3 Keep/Reject Signal Mapping

| Keep/Reject Signal | Decision | Trigger Condition | Policy |
|--------------------|----------|-------------------|--------|
| Strong improvement, no regressions | `promote` | `averageDelta >= 0.5` AND `regressions === 0` AND `improvements > 0` | Eligible for promotion |
| Marginal improvement, few regressions | `retain` | `averageDelta >= 0` AND `regressions <= 1` | Warning -- retained but needs operator review |
| Net negative or too many regressions | `reject` | `averageDelta < 0` OR `regressions > retainMaxRegressions` | Block |
| Trial has no scenarios | `reject` | `trial.totalScenarios === 0` | Block |
| No baseline available | `retain` or `reject` | Depends on `regressions === 0` | Conditional |

### 3.4 Promotion Gate Signal Mapping

| Gate Signal | Field | Trigger Condition | Policy |
|-------------|-------|-------------------|--------|
| Required splits missing | `gate.missingSplits` | Any of `["train", "validation"]` not in observed splits | Block |
| Required checks missing | `gate.missingChecks` | Any of `requiredChecks` (default `["tests"]`) not in `passedChecks` | Block |
| Live evaluator not passed | `gate.liveEvaluatorPassed` | `liveEvaluatorPassed === false` | Block |
| Canary not ready | `gate.canaryReady` | `canaryRequired === true` AND `canaryEnvironment` is null | Block |
| Promotion not allowed | `input.allowPromotion` | `allowPromotion === false` (default) | Block (safe default) |

---

## 4. Operator Decision Matrix

### 4.1 When Manual Override is Safe

An operator MAY override a blocking condition only when ALL of the following are true:

| Condition | Rationale |
|-----------|-----------|
| The blocking signal is from a **known limitation** in the current system, not a genuine regression. | Example: `liveEvaluatorPassed === false` because live coverage does not yet exist for the surface being promoted, but deterministic bench shows clear improvement. |
| The override is **documented in the PR description** with the specific condition being overridden. | Audit trail is required per `docs/release-readiness-checklist.md` Escalation section. |
| A **rollback plan exists and is valid** (`BenchOptRollbackPlan.status !== "idle"`, `validateRollbackSafety().valid === true`). | Cannot override without a tested escape hatch. |
| The override is scoped to **warning-level guardrail violations only**, not critical violations. | Critical violations (evaluator bugs, destructive edits, iteration cap) should never be overridden. |
| The candidate has been evaluated on **at least train and validation splits**. | Holdout may be waived with documentation, but train+validation are the absolute minimum. |

**Safe override scenarios:**

1. **Live evaluator not wired yet for the surface.** The audit (`workstream-b-app-completion-audit.md`) documents that only page-translation has live coverage. For other surfaces, overriding `liveEvaluatorPassed` is acceptable with documentation.

2. **Canary environment not configured.** If canary deployment is not yet wired (`requireCanary` was set but the infrastructure does not exist), overriding is acceptable as long as the rollback plan is armed.

3. **Warning-level surface regression on a low-priority surface.** If a minor surface (e.g., one scenario out of 36) shows a warning-level regression but all other surfaces improve, the operator may override after documenting the trade-off.

### 4.2 When Manual Override MUST Be Refused

An operator MUST NOT override when ANY of the following are true:

| Condition | Rationale |
|-----------|-----------|
| **Any critical guardrail violation** (`verdict === "block"` with a `"critical"` severity violation). | Critical violations indicate fundamental problems: evaluator bugs, destructive edits, or exhausted optimization budget. |
| **Any critical red flag** (`perfect-scores`, `all-zero-scores`, `dangerous-rewrite`, critical `flaky-scores`). | These indicate the trial data is unreliable. Promoting on unreliable data is never safe. |
| **Keep/reject decision is "reject"**. | The candidate is strictly worse than the baseline. No override can make a worse candidate better. |
| **No rollback plan exists or rollback safety checks fail.** | Without a tested rollback path, there is no recovery from a bad promotion. |
| **Holdout split shows regression** (if holdout was run). | Holdout is the final generalization check. Per `docs/release-readiness-checklist.md` Gate 1: "Never override holdout failures silently." |
| **The operator cannot explain WHY the override is safe** in concrete terms referencing specific signals and evidence. | "It looks fine" is not an acceptable justification. |

### 4.3 Decision Flowchart

```
Start: Candidate ready for promotion review
  |
  v
[1] checkGuardrails() -> verdict?
  |-- "block" -> STOP. Fix critical violations. No override.
  |-- "warn"  -> Note warnings, continue.
  |-- "pass"  -> Continue.
  |
  v
[2] detectRedFlags() -> any critical flags?
  |-- Yes -> STOP. Fix evaluator/generator issues. No override.
  |-- No  -> Continue (note any warnings).
  |
  v
[3] decideBenchOptKeepReject() -> decision?
  |-- "reject"  -> STOP. Candidate is worse. No override.
  |-- "retain"  -> Continue (warn: candidate is marginal).
  |-- "promote" -> Continue (candidate meets promote threshold).
  |
  v
[4] decideBenchOptPromotion() -> status?
  |-- "blocked"   -> Check: is the block from a known limitation?
  |     |-- Yes + documented + rollback valid -> Override allowed.
  |     |-- No  -> STOP. Fix the blocking condition.
  |-- "qualified" -> Operator must set allowPromotion=true to proceed.
  |-- "promoted"  -> Continue.
  |
  v
[5] validatePrePromotion() -> valid?
  |-- false -> STOP. Address failing checks.
  |-- true  -> Continue.
  |
  v
[6] validatePublishChecklist() -> valid?
  |-- false -> STOP. Fix plan issues.
  |-- true  -> Continue.
  |
  v
[7] Rollback plan exists? validateRollbackSafety().valid?
  |-- No -> STOP. Cannot promote without rollback readiness.
  |-- Yes -> PROCEED with promotion.
```

---

## 5. Integration Recommendations

### 5.1 Wiring into `runner.ts`

The runner (`bench-opt/runner.ts`) currently calls `decideBenchOptPromotion()`, `buildBenchOptPublishPlan()`, and `buildBenchOptRollbackPlan()` but does not call `checkGuardrails()` or `detectRedFlags()`. The integration owner should add the following:

**Step 1: Add guardrail check after scoring and before promotion.**

In the runner's promotion path (where `BenchOptRunnerPromotionOptions` is consumed), add:

```typescript
import { checkGuardrails, extractScoreTrends, baselineToGuardrailInput } from "./guardrails.ts"
import { detectRedFlags } from "./red-flags.ts"

// After experiment trials are collected and before decideBenchOptPromotion():
const guardrailResult = checkGuardrails(
  { averageTotal: candidateScore.breakdown.total, surfaces: candidateSurfaces },
  champion ? baselineToGuardrailInput(baseline) : null,
  {}, // use defaults or expose via BenchOptRunOptions
  {
    currentIteration: session?.state.progress.iteration ?? 0,
    observedSplits: experiment?.summary.promotionGate.observedSplits ?? [],
    trainScoreTrend: extractScoreTrends(experiment?.trials ?? []).train,
    validationScoreTrend: extractScoreTrends(experiment?.trials ?? []).validation,
  },
)

const redFlagReport = detectRedFlags(experiment?.trials ?? [])
```

**Step 2: Block promotion if guardrails or red flags are critical.**

```typescript
const hasCriticalGuardrail = guardrailResult.verdict === "block"
const hasCriticalRedFlag = redFlagReport.flags.some(f => f.severity === "critical")

if (hasCriticalGuardrail || hasCriticalRedFlag) {
  // Force the promotion decision to blocked, regardless of other signals
  // Set allowPromotion = false in the promotion input
  promotionOptions.allowPromotion = false
}
```

**Step 3: Pass guardrail and red-flag results into the status artifact.**

The `buildBenchOptStatusArtifact()` in `status.ts` needs new fields (see 5.3 below).

### 5.2 Wiring into `status.ts`

The status builder (`bench-opt/status.ts` -- `buildBenchOptStatusArtifact()`) should expose guardrail and red-flag results so the operator can see them without reading logs.

Add to the `input` parameter:

```typescript
guardrails: BenchOptGuardrailResult | null
redFlags: BenchOptRedFlagReport | null
```

Add to the status artifact output:

```typescript
guardrails: input.guardrails ? {
  verdict: input.guardrails.verdict,
  violationCount: input.guardrails.violations.length,
  criticalCount: input.guardrails.violations.filter(v => v.severity === "critical").length,
  warningCount: input.guardrails.violations.filter(v => v.severity === "warning").length,
  violations: input.guardrails.violations,
} : null,

redFlags: input.redFlags ? {
  flagCount: input.redFlags.flags.length,
  criticalCount: input.redFlags.flags.filter(f => f.severity === "critical").length,
  warningCount: input.redFlags.flags.filter(f => f.severity === "warning").length,
  flags: input.redFlags.flags,
  trialsInspected: input.redFlags.trialsInspected,
} : null,
```

Add to `renderBenchOptStatusMarkdown()`:

```typescript
if (status.guardrails) {
  lines.push(
    "## Guardrails",
    `- Verdict: ${status.guardrails.verdict}`,
    `- Violations: ${status.guardrails.violationCount} (${status.guardrails.criticalCount} critical, ${status.guardrails.warningCount} warning)`,
    ...status.guardrails.violations.map(v => `  - [${v.severity}] ${v.title}: ${v.description}`),
    "",
  )
}

if (status.redFlags) {
  lines.push(
    "## Red Flags",
    `- Flags: ${status.redFlags.flagCount} (${status.redFlags.criticalCount} critical, ${status.redFlags.warningCount} warning)`,
    `- Trials inspected: ${status.redFlags.trialsInspected}`,
    ...status.redFlags.flags.map(f => `  - [${f.severity}] ${f.id}: ${f.description}`),
    "",
  )
}
```

### 5.3 Types/Fields Needed

The following type changes are required in `bench-opt/types.ts`:

**Add to `BenchOptStatusArtifact`:**

```typescript
guardrails: {
  verdict: BenchOptGuardrailVerdict
  violationCount: number
  criticalCount: number
  warningCount: number
  violations: BenchOptGuardrailViolation[]
} | null

redFlags: {
  flagCount: number
  criticalCount: number
  warningCount: number
  flags: BenchOptRedFlag[]
  trialsInspected: number
} | null
```

**Add to `BenchOptRunResult`:**

```typescript
guardrails?: BenchOptGuardrailResult | null
redFlags?: BenchOptRedFlagReport | null
```

**Add to `BenchOptRunOptions`:**

```typescript
guardrails?: false | Partial<BenchOptGuardrailConfig>
redFlags?: false | BenchOptRedFlagDetectionOptions
```

**Add new composite safety type (optional but recommended):**

```typescript
export interface BenchOptPromotionSafetyResult {
  safe: boolean
  guardrails: BenchOptGuardrailResult
  redFlags: BenchOptRedFlagReport
  keepReject: BenchOptKeepRejectResult | null
  prePromotion: BenchOptPrePromotionValidation | null
  blockingReasons: string[]
  warningReasons: string[]
}
```

This composite type would be returned by a new `evaluatePromotionSafety()` function that runs all checks in sequence and produces a single safe/unsafe verdict with full evidence. This simplifies the integration point in `runner.ts` to a single call.

### 5.4 Recommended Integration Sequence

1. **Phase 1: Read-only integration.** Wire `checkGuardrails()` and `detectRedFlags()` into the runner and status artifact but do not block promotion. Emit the results as notes in the status artifact. This allows operators to see the signals without changing behavior.

2. **Phase 2: Soft enforcement.** When guardrails return `"block"` or red flags have critical entries, add a warning to the promotion decision reasons but still allow `--promotion-allow` to override. Log the override.

3. **Phase 3: Hard enforcement.** When guardrails return `"block"` or red flags have critical entries, prevent promotion entirely. Remove the ability to override critical blocks. Warning-level conditions remain overridable.

### 5.5 Configuration Defaults Reference

For quick reference, these are the default thresholds from `bench-opt/guardrails.ts` (`BENCH_OPT_GUARDRAIL_DEFAULTS`):

| Parameter | Default | Used By |
|-----------|---------|---------|
| `maxAverageRegressionPercent` | 5 | `detectAverageRegression()` |
| `maxSurfaceRegressionPercent` | 10 | `detectSurfaceRegressions()` |
| `maxIterations` | 20 | `detectIterationOverrun()` |
| `overfitDeltaThreshold` | 0.15 | `detectOverfitting()` |
| `requiredSplits` | `["train", "validation"]` | `detectSplitViolations()` |

And from `bench-opt/keep-reject.ts` (defaults in `decideBenchOptKeepReject()`):

| Parameter | Default | Used By |
|-----------|---------|---------|
| `promoteMinAverageDelta` | 0.5 | `decideFromComparison()` |
| `retainMinAverageDelta` | 0 | `decideFromComparison()` |
| `retainMaxRegressions` | 1 | `decideFromComparison()` |

And from `bench-opt/red-flags.ts` (defaults in `detectRedFlags()`):

| Parameter | Default | Used By |
|-----------|---------|---------|
| `maxAcceptableStdDev` | 0.15 | `detectFlakyBehavior()` |
| `minExpectedScoreRange` | 0.05 | `detectLowDiversity()` |
