# Bench-Opt Operator Runbook

_Last updated: 2026-03-26 (E6 semantic sync)_

This document explains the bench-opt system from an operator's perspective: what artifacts exist, which ones matter, how to interpret system state, and how to perform common operations.

---

## System Overview

Astra's bench-opt system is a candidate optimizer that sits on top of the deterministic judge harness (`bench/`). It:

1. Reads the latest bench results as a baseline.
2. Scores prompt/context candidate combinations against that baseline.
3. Selects the best candidate pair.
4. Optionally runs verification, live evaluation, orchestration, and promotion planning.
5. Produces a unified status artifact that summarizes the entire state.

The system is **read-only by default**. It does not modify source code, create branches, or open PRs unless explicitly told to do so with specific flags.

---

## Artifact Map

### Primary artifacts (always produced)

| Artifact | Path | Purpose |
|----------|------|---------|
| Score report | `bench-opt-results/latest.json` | Machine-readable candidate scores |
| Score summary | `bench-opt-results/latest.md` | Human-readable score summary |
| Resolved config | `bench-opt-results/latest.resolved.json` | Concrete prompt/context config for downstream bench loop |
| Resolved config summary | `bench-opt-results/latest.resolved.md` | Human-readable resolved config |
| Status | `bench-opt-results/latest.status.json` | Unified operator-facing status |
| Status summary | `bench-opt-results/latest.status.md` | Human-readable status panel |
| Store index | `bench-opt-results/store/index.json` | Experiment/champion/session index |

### Optional artifacts (produced with flags)

| Artifact | Flag | Path | Purpose |
|----------|------|------|---------|
| Orchestration | `--orchestrate` | `latest.orchestration.json` / `.md` | Planner/generator/evaluator pass |
| Orchestration loop | `--orchestrate` (multi-iteration) | `latest.orchestration-loop.json` / `.md` | Multi-iteration loop result |
| Session state | `--session` | `latest.session.json` / `.md` | Session lifecycle state |
| Checkpoint | `--session` | `latest.checkpoint.json` / `.md` | Resumable checkpoint |
| Compaction | `--session-force-compaction` | `latest.compaction.json` / `.md` | Context compaction record |
| Handoff | `--session-force-handoff` | `latest.handoff.json` / `.md` | Session handoff for resume |
| Live evaluation | `--live` | `latest.live.json` / `.md` | Browser-backed live test result |
| Promotion decision | `--promotion-plan` | `latest.promotion.json` / `.md` | Promotion gate decision |
| Publish plan | `--promotion-plan` | `latest.publish.json` / `.md` | Publish dry-run plan |
| Rollback plan | `--promotion-plan` | `latest.rollback.json` / `.md` | Rollback dry-run plan |
| Autoloop summary | via `bench:opt:autoloop` | `latest.autoloop.json` / `.md` | Multi-cycle loop summary |

### Store directories

| Directory | Contents |
|-----------|----------|
| `bench-opt-results/store/experiments/` | Individual experiment JSON records |
| `bench-opt-results/store/champions/` | Champion candidate records |
| `bench-opt-results/store/sessions/` | Session state snapshots |
| `bench-opt-results/store/checkpoints/` | Checkpoint snapshots |
| `bench-opt-results/store/compactions/` | Compaction records |
| `bench-opt-results/store/handoffs/` | Handoff records |
| `bench-opt-results/orchestration-iterations/` | Per-iteration snapshots |

### Live evaluation artifacts

| Path | Contents |
|------|----------|
| `bench-live-results/latest.result.json` | Most recent live run result |
| `bench-live-results/latest.result.md` | Human-readable live summary |
| `bench-live-results/<run-id>/` | Per-run directory with screenshots, HTML snapshots, fixture HTML |

---

## Which Artifacts Matter Most

For day-to-day operation, focus on these three:

1. **`bench-opt-results/latest.status.json`** -- the single source of truth for system state.
2. **`bench-opt-results/latest.resolved.json`** -- the config that downstream bench loop will consume.
3. **`bench-opt-results/latest.promotion.json`** -- whether the current candidate can be promoted.

For debugging:
- **`bench-opt-results/latest.md`** -- see raw candidate scores.
- **`bench-opt-results/latest.status.md`** -- see human-readable status panel.
- **`bench-live-results/latest.result.json`** -- check if live scenarios pass.

---

## Interpreting Overall State

The status artifact's `overallState` field tells you where the system is. Here is what each value means and what to do:

### `idle`
**Meaning:** No active session or orchestration. The system has run and produced scores but nothing is in flight.
**Action:** This is the starting state. Run `pnpm bench:opt -- --write` to produce a fresh report. Add `--promotion-plan --live` for a full status.

### `running`
**Meaning:** A session or orchestration loop is in progress.
**Action:** Let it complete, or check `latest.session.json` for progress. If it seems stuck, run `pnpm bench:opt:status` to review.

### `blocked`
**Meaning:** The promotion gate has determined that the current candidate cannot be promoted. This is the most common state.
**Action:** Read `latest.promotion.json` -> `reasons` to understand why. Common reasons:
- "verification not passed" -- run with `--verify --materialize --apply-edits` to trigger verification.
- "keep/reject decision unavailable" -- verification needs to complete first.
- "live evaluator not passed" -- run with `--live` to trigger the live gate.

### `kept`
**Meaning:** The verification/keep-reject cycle completed and the candidate was retained.
**Action:** This is positive. The candidate passed verification. Check if promotion can proceed by running `--promotion-plan`.

### `rejected`
**Meaning:** The verification/keep-reject cycle completed and the candidate was rejected.
**Action:** The candidate did not improve over baseline. Review `latest.status.json` -> `execution.keepReject` for details. Start a new optimizer run to try different candidates.

### `promoted`
**Meaning:** The candidate has been promoted through the promotion gate.
**Action:** Check `latest.publish.json` for the publish plan. Note that promotion is currently dry-run only -- no real branch/PR is created.

### `handoff`
**Meaning:** A session has reached its budget limit and produced a handoff artifact for the next session.
**Action:** Resume with `pnpm bench:opt:resume-latest` or `pnpm bench:opt:autoloop`.

### `completed`
**Meaning:** A session has completed its work.
**Action:** Review results. Start a new cycle if needed.

---

## Interpreting Promotion Status

The promotion decision (`latest.promotion.json`) has three possible statuses:

### `blocked`
The candidate cannot be promoted. The `gate.reason` field explains why. Common reasons:
- Missing verification pass
- Missing keep/reject decision
- Missing live evaluator pass
- Missing required splits

To unblock, address each reason listed. The promotion gate will automatically qualify when all conditions are met.

### `qualified`
The candidate has passed all gates and is eligible for promotion. The system will not auto-promote unless `--promotion-allow` is passed.

### `promoted`
The candidate has been promoted. In the current dry-run mode, this means the promotion plan has been marked as "promoted" but no VCS operation has occurred.

---

## Common Operations

### Run a basic optimizer cycle

```bash
pnpm bench:opt -- --write
```

This produces the score report, resolved config, and store entries. No verification, live, or promotion.

### Run a full status check

```bash
pnpm bench:opt -- --write --promotion-plan --live
```

This runs everything: scoring, live evaluation, and promotion planning. Review the result with:

```bash
pnpm bench:opt:status
```

### Check current status without running

```bash
pnpm bench:opt:status
```

Reads `bench-opt-results/latest.status.json` and prints the status panel.

### Run the live evaluator standalone

```bash
pnpm bench:live
```

Or target a specific scenario:

```bash
pnpm bench:live -- --scenario bench-live/page-translation-article-basic-source-bilingual
```

List available scenarios:

```bash
pnpm bench:live -- --list
```

### Resume the latest session

```bash
pnpm bench:opt:resume-latest
```

This reads the latest session/checkpoint/handoff bundle from the store and automatically passes the right resume flags to the runner.

### Run multi-cycle autoloop

```bash
pnpm bench:opt:autoloop
```

This automatically determines whether to start fresh or resume, then runs multiple bounded orchestration cycles until the session is terminal or the cycle cap is reached.

### Run with verification and materialization

```bash
pnpm bench:opt -- --write --verify --materialize --apply-edits
```

This will:
1. Score candidates
2. Materialize the best candidate into a real worktree
3. Apply any structured edits from the candidate
4. Run verification (type-check, test, bench split)
5. Produce a keep/reject decision

### Run orchestration

```bash
pnpm bench:opt -- --write --orchestrate --session
```

This runs a bounded planner -> generator -> evaluator pass and produces session artifacts.

### List available candidates

```bash
pnpm bench:opt:list
```

### View experiment history

```bash
pnpm bench:opt:history
```

---

## Understanding the Score

The optimizer scores candidates using a baseline-aware heuristic. The score breakdown in `latest.status.json` -> `selection.breakdown` contains:

| Component | What it measures |
|-----------|-----------------|
| `baselineHealth` | How well the current bench baseline performs |
| `promptClarity` | Quality signals from the prompt candidate |
| `contextCoverage` | Coverage signals from the context candidate |
| `artifactAlignment` | How well the candidate aligns with current artifacts |
| `structuralSignals` | Structural quality of the candidate configuration |
| `penalties` | Deductions for known issues |
| `total` | Sum of all components |

The score is **not a bench scenario score**. It is an optimizer-internal heuristic for ranking candidates. Do not confuse it with the evaluator `total` scores in `bench-results/latest.json`.

---

## Understanding the Safety Section in Status

The status artifact (`latest.status.json`) now includes a `safety` section that flows from the guardrails and red-flags modules. This section is critical for understanding whether the optimizer's output is trustworthy.

### `guardrailVerdict`

The guardrail verdict is one of three values:

| Verdict | Meaning | Effect on promotion |
|---------|---------|---------------------|
| `pass` | All guardrail checks passed. No split-discipline violations, no anomalous score patterns. | Promotion is not blocked by safety. |
| `warn` | One or more guardrail checks raised a warning but none are promotion-blocking. Common cause: missing train/validation split observation in the current run. | Promotion is not blocked, but the operator should investigate. The warning reason is in `safety.guardrailNotes`. |
| `block` | A guardrail check detected a promotion-blocking condition (e.g., suspected overfitting, holdout contamination). | Promotion is blocked. `overallState` will reflect "blocked" and the promotion gate will refuse to qualify. |

The verdict is computed by `bench-opt/guardrails.ts` and flows through `bench-opt/status.ts` into the status artifact. The promotion gate in `bench-opt/promote.ts` consumes the verdict.

### `redFlagCount`

The red-flag count is a numeric value representing the number of distinct red flags detected during the optimizer run. Red flags are more severe than guardrail warnings and represent conditions that should never be ignored.

| Count | Meaning | Action |
|-------|---------|--------|
| `0` | No red flags. | Normal operation. |
| `>= 1` | One or more red flags detected. | Review `safety.redFlags` array for details. Each entry has a `kind`, `message`, and `severity`. |

Red flags are computed by `bench-opt/red-flags.ts`. A non-zero red-flag count does not automatically block promotion (that is the guardrail verdict's job), but it strongly signals that the operator should review before proceeding.

### Safety section structure

```json
{
  "safety": {
    "guardrailVerdict": "warn",
    "guardrailNotes": ["split-discipline warning: missing train/validation"],
    "redFlagCount": 0,
    "redFlags": []
  }
}
```

---

## Understanding the Telemetry Section in Status

The status artifact now includes a `telemetry` section that provides operational metrics for the optimizer run.

### Key fields

| Field | Type | Meaning |
|-------|------|---------|
| `durationMs` | number | Wall-clock duration of the optimizer scoring pass in milliseconds |
| `candidatesKept` | number | Number of candidates that survived the scoring/filtering pass |
| `candidatesTotal` | number | Total number of candidate combinations evaluated |
| `scoreTrends` | object | Per-surface score trends over time (currently empty -- not yet wired to real tracking) |

### Telemetry section structure

```json
{
  "telemetry": {
    "durationMs": 49,
    "candidatesKept": 2,
    "candidatesTotal": 6,
    "scoreTrends": {}
  }
}
```

### Interpreting telemetry

- **`durationMs`**: A typical scoring pass takes 30-100ms. If this value is significantly higher, check whether `--live` or `--verify --materialize` flags are enabled, as these add substantial latency (Playwright browser operations, worktree creation).
- **`candidatesKept`**: If this is 0, no candidates passed the scoring threshold. Review `latest.md` for the raw score breakdown.
- **`scoreTrends`**: This field is reserved for future per-surface trend tracking. It is currently always empty.

Telemetry is collected by `bench-opt/telemetry.ts` and flushed into the status artifact by `bench-opt/status.ts`.

---

## Understanding Split Discipline

Scenarios are divided into three splits:

| Split | Count | Purpose | When to run |
|-------|-------|---------|-------------|
| `train` | 19 | Daily iteration and optimizer candidate search | Every cycle |
| `validation` | 7 | Candidate selection and champion comparison | Before promotion |
| `holdout` | 6 | Final promotion gate | Only before release |

The split assignments live in `bench/splits.json`. The optimizer respects these splits:
- `--evaluated-split` controls which split view the optimizer scores against.
- `--promotion-splits` controls which splits the promotion gate requires.

**Rule:** Never use holdout results to tune prompts. Holdout is only for the final gate.

---

## Available Live Scenarios

As of Wave 5, the following live scenarios are available beyond the original page-translation scenarios:

| Scenario | Surface | Status | What it tests |
|----------|---------|--------|---------------|
| `interaction-priority-basic` | interaction-priority | PASS | Links clickable, input fields interactable, buttons clickable in correct priority order |
| `input-translation-basic` | input-translation | PASS | Input field translation/writeback produces correct `ZH:Hello world` result, score 100 |
| `subtitle-basic` | subtitle | FAIL (B-class) | Subtitle VTTCue injection and translation -- currently fails with `waitForFunction` 30s timeout due to VTTCue bridge timing bug |
| `frame-coordination-basic` | frame-coordination | PASS | Child frame correctly skips float-ball/selection-toolbar injection, top frame has 2 translation markers |

### Running specific live scenarios

```bash
# Run a specific new scenario
pnpm bench:live -- --scenario bench-live/scenarios/interaction-priority-basic
pnpm bench:live -- --scenario bench-live/scenarios/input-translation-basic
pnpm bench:live -- --scenario bench-live/scenarios/frame-coordination-basic

# List all available scenarios
pnpm bench:live -- --list
```

### Known live scenario issues

- **subtitle-basic**: The scenario's `waitForFunction` expects programmatic VTTCue injection to complete, but the browser-side bridge has a timing issue. This is a B-class sub-module bug, not an integration failure. Fix is tracked as P0-1 in the Wave 5 verification report.
- **bench-opt --live default**: The `--live` flag in bench-opt currently only runs the first registered scenario (page-translation). It does not yet run the new scenarios. Fix is tracked as P0-3.

---

## Troubleshooting

### Status shows "blocked" but everything looks green

Check `latest.promotion.json` -> `gate.reason`. The most common cause is that verification was not run. Add `--verify` to your next run.

### Live evaluator fails

1. Check if Chrome/Playwright is available in your environment.
2. Run `pnpm bench:live -- --scenario bench-live/fixture-playwright-smoke` to test browser availability.
3. If no browser is available, the live gate will show `skipped`, not `failed`. Promotion will remain blocked.

### Autoloop does not progress

Check `latest.autoloop.json` for the termination reason. Common causes:
- Session reached max iterations.
- All candidates scored the same (no improvement possible).
- A fatal error in one of the cycles.

### Store index is stale

The store index is updated every time `--write` is used. If it seems stale, run a fresh `pnpm bench:opt -- --write`.

### Runner is slow

`bench-opt/runner.ts` is large (103 KB). If the runner is slow, check:
- Whether `--live` is enabled (Playwright adds latency).
- Whether `--verify --materialize` is enabled (worktree operations add latency).
- The number of candidate combinations being scored.

---

## Architecture Quick Reference

```
bench/                  Judge harness (deterministic, split-aware)
  scenarios/            Scenario definitions (36 scenarios, 10 surfaces)
  evaluators/           Deterministic scoring logic
  reporters/            Artifact builders (loop, patch-task, patch-context, etc.)
  splits.json           Split assignments

bench-opt/              Optimizer layer
  candidates/           Built-in prompt/context candidates
  runner.ts             Main optimizer runner (orchestrates everything)
  score.ts              Candidate scoring heuristic
  experiments.ts        Experiment creation
  store.ts              Persistence layer
  champion.ts           Champion selection
  compare.ts            Baseline vs trial comparison
  keep-reject.ts        Retain/reject decision
  verify.ts             Verification plan and execution
  materialize.ts        Worktree materialization
  apply.ts              Structured edit application
  rerun.ts              Bounded command execution
  planner.ts            Planner role contract
  generator.ts          Generator role contract
  evaluator.ts          Evaluator role contract
  orchestrator.ts       Orchestration pass
  strategy.ts           Refine/pivot strategy
  session.ts            Session lifecycle
  checkpoints.ts        Checkpoint creation
  compaction.ts         Context compaction
  handoff.ts            Session handoff
  promote.ts            Promotion gate
  publish.ts            Publish plan
  rollback.ts           Rollback plan
  status.ts             Unified status builder
  autoloop.ts           Multi-cycle auto-resume

bench-live/             Live evaluator (browser-backed)
  scenarios/            Live scenario definitions
  evaluator.ts          Live evaluation engine
  driver.ts             Browser driver
  runtime.ts            Runtime abstraction
  source-runtime.ts     JSDOM/Vite SSR bridge

bench-results/          Judge harness output
bench-opt-results/      Optimizer output
  store/                Persistent experiment/session store
bench-live-results/     Live evaluator output
```

---

## Safety Notes

1. **The optimizer does not modify source code by default.** All write operations require explicit flags.
2. **Promotion is dry-run only.** No branches, PRs, or publishes happen automatically.
3. **Rollback plans are prepared but never executed.** Real rollback requires manual VCS operations.
4. **The holdout split should never be used for optimization.** It exists only as a final gate.
5. **Live evaluation requires a browser.** Without Chrome/Playwright, the live gate will be skipped, keeping promotion blocked.
