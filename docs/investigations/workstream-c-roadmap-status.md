# Workstream C -- Roadmap Reality Check

_Generated: 2026-03-26_

---

## C1. Roadmap phase-by-phase status

The roadmap in `docs/anthropic-style-long-running-harness-roadmap.md` defines Phases 0-10. Below is the evidence-grounded status of each.

### Phase 0 -- Freeze the judge and define optimizer boundaries

**Status: COMPLETE**

Evidence:
- `bench/splits.ts` exists and implements `getScenarioSplit()`, `filterScenariosBySplit()`, `countScenariosBySplit()`.
- `bench/splits.json` exists with 36 scenarios explicitly assigned across train (19), validation (7), holdout (6).
- `bench/entry.ts` parses `--split train|validation|holdout` and passes it through to `selectBenchmarkScenarios()`.
- `bench/types.ts` exports `BenchmarkSplit` type.
- `bench/run.ts` CLI supports `--split` flag.
- `bench-opt/runner.ts` supports `--evaluated-split` and `--promotion-splits` flags.
- Judge harness (`bench/`) and optimizer (`bench-opt/`) are cleanly separated directories.

### Phase 1 -- Turn bench-opt from scorer into experiment manager

**Status: COMPLETE**

Evidence:
- `bench-opt/experiments.ts` exists (4.5 KB) -- experiment creation and trial materialization.
- `bench-opt/store.ts` exists (7.2 KB) -- experiment/champion/session index persistence.
- `bench-opt/champion.ts` exists (2.5 KB) -- champion selection scaffolding.
- `bench-opt/compare.ts` exists (11.5 KB) -- baseline vs trial structured comparison.
- `bench-opt/keep-reject.ts` exists (6.5 KB) -- retain/reject/promote decision logic.
- `bench-opt-results/store/index.json` exists with real experiment IDs, champion IDs, and session references.
- `bench-opt-results/store/` has subdirectories: experiments, champions, sessions, checkpoints, compactions, handoffs.
- `bench-opt/types.ts` defines trial splits (`BenchOptTrialSplit`), experiment types, and all related contracts.
- Runner supports multiple durable trials; champion/challenger comparison is explicit.

### Phase 2 -- Real materialization and apply loop

**Status: PARTIAL (~70%)**

Evidence of what exists:
- `bench-opt/materialize.ts` (2.7 KB) -- worktree materialization.
- `bench-opt/apply.ts` (1.7 KB) -- structured edit (rewrite/replace) application.
- `bench-opt/rerun.ts` (9.3 KB) -- bounded command execution in isolated worktree.
- `bench-opt/verify.ts` (5.6 KB) -- split-aware verification plan (type-check/test/bench).
- `bench-opt/worktree.ts` (1.8 KB) -- worktree plan generation.
- Runner supports `--materialize` and `--apply-edits` flags.
- `bench-opt/types.ts` defines `BenchOptEditInstruction` with rewrite/replace kinds.

What is still missing:
- Materialization and apply are **opt-in, not default**. The system does not automatically enter a rerun-compare-keep/reject loop.
- The `--verify` flag exists but verification is not automatically triggered.
- No automatic cycle of "apply, rerun bench, compare, keep/reject" without human invocation.

### Phase 3 -- Add explicit planner/generator/evaluator orchestration

**Status: PARTIAL (~60%)**

Evidence of what exists:
- `bench-opt/planner.ts` (3.8 KB) -- planner role contract and artifact builder.
- `bench-opt/generator.ts` (2.3 KB) -- generator role contract and artifact builder.
- `bench-opt/evaluator.ts` (3.6 KB) -- evaluator role contract and artifact builder.
- `bench-opt/orchestrator.ts` (3.4 KB) -- single bounded orchestration pass through planner -> generator -> evaluator.
- `bench-opt/strategy.ts` (4.7 KB) -- follow-up action and handoff request types.
- Runner supports `--orchestrate` and produces orchestration artifacts.
- Orchestration loop artifacts exist (`latest.orchestration-loop.json`).

What is still missing:
- Roles use **placeholder/scaffold implementations**, not real LLM backends. They build artifacts structurally but do not call external models.
- No real agent turn-taking runtime. The orchestrator runs a single bounded pass.
- `BenchOptRoleAdapters` interface exists for injecting real implementations, but no adapter connects to OpenAI/Anthropic/etc. today.

### Phase 4 -- Add real long-running session behavior

**Status: PARTIAL (~65%)**

Evidence of what exists:
- `bench-opt/session.ts` (12.4 KB) -- bounded session state management with budgets, progress, history.
- `bench-opt/checkpoints.ts` (4.2 KB) -- checkpoint artifact creation.
- `bench-opt/compaction.ts` (6.5 KB) -- compaction metadata and trigger logic.
- `bench-opt/handoff.ts` (4.7 KB) -- session handoff artifact builder.
- `bench-opt/autoloop.ts` (7.0 KB) -- multi-round auto-resume loop.
- `bench-opt/resume-latest.ts` (1.8 KB) -- reads latest session bundle from store.
- Runner supports `--session`, `--session-resume`, `--session-force-compaction`, `--session-force-handoff`, `--session-checkpoint`.
- `pnpm bench:opt:autoloop` and `pnpm bench:opt:resume-latest` are wired in package.json.

What is still missing:
- Sessions are **bounded artifacts**, not true long-running processes. The system can create and resume session state, but does not autonomously run for hours.
- Compaction and handoff only generate artifacts; they do not trigger automatic context reset and continuation.
- No real wall-clock budget enforcement (the session tracks `wallClockMs` but does not auto-terminate).

### Phase 5 -- Add live evaluator environment

**Status: PARTIAL (~70%)**

Evidence of what exists:
- `bench-live/` directory with 14 files including: `evaluator.ts` (14.3 KB), `driver.ts` (5.9 KB), `runtime.ts` (5.3 KB), `rubrics.ts`, `source-runtime.ts` (11.5 KB), `entry.ts`, `index.ts`, `results.ts`.
- `bench-live/scenarios/` with 4 real scenarios plus 1 placeholder:
  - `page-translation-article-basic-source.ts` -- source-backed live scenario using JSDOM + Playwright.
  - `page-translation-article-basic-source-translation-only.ts` -- translation-only mode validation.
  - `page-translation-article-basic.ts` -- contract-shaped browser fallback.
  - `fixture-playwright-smoke.ts` -- narrow browser bootstrap smoke test.
  - `placeholder.ts` -- contract fallback for headless environments.
- `bench-live-results/` has 12+ real run directories with screenshots and snapshots.
- `bench-opt-results/latest.live.json` exists and shows `"status": "pass"`, `"score": 100`.
- `pnpm bench:live` is wired in package.json and supports `--scenario` and `--list` flags.
- Runner's `--live` flag works and writes `latest.live.json` / `latest.live.md`.
- Live evaluator pass/fail is consumed by the promotion gate.

What is still missing:
- Only page-translation scenarios exist in live. No coverage for hover, subtitle, input, selection, etc.
- No multi-scenario live suite that runs automatically as a gate.
- Rubrics are minimal (`rubrics.ts` is 651 bytes).
- No evaluator trace storage (screenshots exist in results but no structured interaction log).

### Phase 6 -- Prompt/context/tool/graph as optimization targets

**Status: PARTIAL (~30%)**

Evidence of what exists:
- `bench-opt/candidates/prompt.ts` and `bench-opt/candidates/context.ts` -- built-in prompt and context candidates.
- `bench-opt/registry.ts` -- candidate registry API.
- `bench/types.ts` defines `ResolvedOptimizerPromptPolicy` and `ResolvedOptimizerContextPolicy`.
- Policies (`analysisMode`, `toolPolicy`, `writeScopeMode`, `rankingMode`, `maxFiles`, `preferHistory`) are wired through to `bench/reporters/patch-task.ts`, `patch-context.ts`, `executor.ts`.

What is still missing:
- **No `agent-config/` directory** exists. Prompts are still inline in candidate TS files, not versioned standalone files.
- No mutation operators for prompts (tighten/relax scope, add/remove planning steps).
- No `mutate-prompts.ts`, `mutate-context.ts`, `mutate-tools.ts`, `mutate-graph.ts` files exist anywhere.
- Tool policy and agent graph are not optimization targets -- only prompt and context are selectable.

### Phase 7 -- Refine vs pivot decisioning

**Status: PARTIAL (~40%)**

Evidence of what exists:
- `bench-opt/strategy.ts` (4.7 KB) defines `BenchOptStrategyDecision`, `BenchOptFollowUpAction`, `BenchOptHandoffRequest`.
- `bench-opt/evaluator.ts` emits follow-up decisions.
- Orchestrator consumes strategy decisions.

What is still missing:
- No real trend analysis across multiple iterations. The strategy is computed per-pass, not across a history of trials.
- No plateau detection or diminishing-return detection.
- The system cannot autonomously choose between refining a candidate and pivoting to a new family.

### Phase 8 -- Promotion and publish pipeline

**Status: PARTIAL (~50%)**

Evidence of what exists:
- `bench-opt/promote.ts` (6.3 KB) -- promotion gate logic with split/check/live requirements.
- `bench-opt/publish.ts` (8.9 KB) -- structured publish plan with branch/PR/canary steps.
- `bench-opt/rollback.ts` (5.9 KB) -- structured rollback plan with revert/close-PR/restore steps.
- Runner supports `--promotion-plan`, `--promotion-live-passed`, `--promotion-allow`, `--publish-allow`, `--rollback-allow`.
- `bench-opt-results/latest.promotion.json`, `latest.publish.json`, `latest.rollback.json` all exist with real data.
- Promotion gate correctly blocks when verification is not passed.
- Live evaluator pass is threaded into the promotion gate.

What is still missing:
- Everything is **dry-run only**. No actual branch creation, PR opening, or publishing occurs.
- No `.github/workflows/bench-opt.yml` exists (the roadmap specifies this).
- `ci.yml` runs bench but has no bench-opt integration.

### Phase 9 -- Safety and anti-overfitting controls

**Status: MISSING**

Evidence:
- No `bench-opt/guardrails.ts` exists.
- No `bench-opt/red-flags.ts` exists.
- No overfitting penalties, cost penalties, or oscillation detection in the codebase.
- The `bench-opt/score.ts` (8.7 KB) does baseline-aware heuristic scoring but has no train/validation divergence tracking.

### Phase 10 -- Observability and operator controls

**Status: PARTIAL (~50%)**

Evidence of what exists:
- `bench-opt/status.ts` (10.8 KB) -- comprehensive unified status artifact builder.
- `bench-opt/status-latest.ts` (3.5 KB) -- CLI for reading status.
- `bench-opt-results/latest.status.json` and `latest.status.md` provide rich operator-facing summary.
- `pnpm bench:opt:status` is wired in package.json.
- Autoloop produces per-cycle summaries.

What is still missing:
- No `bench-opt/logs.ts` or `bench-opt/telemetry.ts`.
- No `bench-opt/dashboard.md`.
- No per-iteration cost/latency tracking.
- No operator stop-conditions (max budget, stop-after-N-regressions, plateau-stop).

---

## C2. Practical Definition of Done -- Item-by-item reality check

The roadmap defines 14 DoD items. Here is their status:

| # | DoD Item | Status | Evidence |
|---|----------|--------|----------|
| 1 | Planner, generator, evaluator are separate roles | **Partial** | Role contracts exist in `bench-opt/planner.ts`, `generator.ts`, `evaluator.ts`. They are structurally separate. But they use placeholder implementations, not real LLM backends. |
| 2 | Work is executed across multiple iterations | **Partial** | Orchestration loop exists and autoloop can run multi-cycle. But iterations are bounded scaffolds, not real autonomous work. |
| 3 | Candidates are materialized into real isolated worktrees | **Partial** | `bench-opt/materialize.ts` exists and `--materialize` flag works. But it is opt-in and not part of a default flow. |
| 4 | System can apply code changes automatically | **Partial** | `bench-opt/apply.ts` exists with rewrite/replace. `--apply-edits` flag works. But it is opt-in and bounded. |
| 5 | Deterministic judge bench re-runs automatically after each trial | **Partial** | `bench-opt/rerun.ts` and `bench-opt/verify.ts` exist. `--verify` triggers it. But it does not auto-trigger. |
| 6 | Live evaluator runs on real app/runtime | **Partial** | `bench-live/` exists with real Playwright-backed scenarios and live results. But only page-translation is covered. |
| 7 | Refine vs pivot decision exists | **Partial** | `bench-opt/strategy.ts` defines the types. But no real trend-based decision logic exists. |
| 8 | Train/validation/holdout split exists | **Complete** | `bench/splits.ts` + `bench/splits.json`. Fully implemented and consumed by runner. |
| 9 | Keep/reject decisions are automatic and logged | **Partial** | `bench-opt/keep-reject.ts` produces retain/reject/promote decisions. But they require `--verify` and are not the default path. |
| 10 | Prompt/context/tool/graph are first-class mutation targets | **Partial** | Prompt and context candidates exist with policies. Tool and graph are not optimization targets. No mutation operators. |
| 11 | Champion/challenger promotion exists | **Partial** | Promotion gate logic exists in `bench-opt/promote.ts`. Champion tracking in `bench-opt/champion.ts`. But promotion is dry-run only. |
| 12 | Promotion gated by validation + holdout + required checks | **Partial** | Gate checks all required splits and live pass. But verification is not auto-triggered, so gate stays blocked. |
| 13 | Long-running sessions survive context growth via compaction/reset | **Partial** | Session/checkpoint/compaction/handoff scaffolds exist. Autoloop can resume. But no real context management occurs. |
| 14 | Operator controls and telemetry exist | **Partial** | Status artifact and CLI exist. But no telemetry, cost tracking, or stop-conditions. |

**Summary: 1 of 14 items is complete. 12 are partial. 1 is effectively missing (refine-vs-pivot has only type stubs, no real logic).**

---

## C3. Distance Estimates (Updated)

The roadmap's original estimates were:
- Repair advisory harness: ~75% complete
- Anthropic-style long-running harness: ~40% complete
- Self-optimizing agent platform: ~20% complete

**Updated estimates based on code inspection:**
- Repair advisory harness: **~90% complete** (bench + loop + patch-task + executor + dispatch + history + splits all work)
- Anthropic-style long-running harness: **~50% complete** (Phase 0-1 done, Phase 2-5 structurally scaffolded but not functional end-to-end)
- Self-optimizing agent platform: **~25% complete** (Phase 6-10 mostly missing or skeleton-only)

---

## Findings Summary

1. **Phase 0 (splits) and Phase 1 (experiment manager) are genuinely complete.** The split discipline and experiment/trial/champion store are functional.

2. **Phases 2-5 have extensive scaffolding** -- the types, contracts, and file structure exist -- but they are not wired into an automatic end-to-end flow. Every advanced feature requires explicit opt-in flags.

3. **Phases 6-10 are substantially incomplete.** No mutation operators, no guardrails, no real promotion execution, no telemetry.

4. **The live evaluator (Phase 5) is the most advanced of the "advanced" phases**, with real Playwright-backed scenarios producing real screenshots and scores.

5. **The roadmap's original 40% estimate for Anthropic-style parity was slightly pessimistic.** The actual number is closer to 50%, because the structural scaffolding is more complete than "advisory-only" suggests. However, the 50% gap is all in the hard parts: real LLM integration, autonomous iteration, and production promotion.

---

## Evidence (files inspected)

**Bench judge harness:**
- `/Users/ruirui/Downloads/GitHub/Astra/bench/types.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench/entry.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench/run.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench/loop-entry.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench/loop.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench/splits.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench/splits.json`
- `/Users/ruirui/Downloads/GitHub/Astra/bench/optimizer-config.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench/reporters/` (all 11 files)
- `/Users/ruirui/Downloads/GitHub/Astra/bench/scenarios/` (12 files)

**Bench-opt optimizer:**
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/` (all 48 files)
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/candidates/prompt.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/candidates/context.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.status.json`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/store/index.json`

**Live evaluator:**
- `/Users/ruirui/Downloads/GitHub/Astra/bench-live/` (all 14 files)
- `/Users/ruirui/Downloads/GitHub/Astra/bench-live/scenarios/` (7 files)
- `/Users/ruirui/Downloads/GitHub/Astra/bench-live-results/` (12 run directories)

**CI and docs:**
- `/Users/ruirui/Downloads/GitHub/Astra/.github/workflows/ci.yml`
- `/Users/ruirui/Downloads/GitHub/Astra/docs/anthropic-style-long-running-harness-roadmap.md`
- `/Users/ruirui/Downloads/GitHub/Astra/docs/bench-opt.md`
- `/Users/ruirui/Downloads/GitHub/Astra/docs/bench-harness.md`
- `/Users/ruirui/Downloads/GitHub/Astra/docs/capability-matrix.md`
- `/Users/ruirui/Downloads/GitHub/Astra/package.json`

**Confirmed absent:**
- `/Users/ruirui/Downloads/GitHub/Astra/agent-config/` -- does not exist
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/guardrails.ts` -- does not exist
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/red-flags.ts` -- does not exist
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/logs.ts` -- does not exist
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/telemetry.ts` -- does not exist
- `/Users/ruirui/Downloads/GitHub/Astra/.github/workflows/bench-opt.yml` -- does not exist

---

## Decisions / Recommendations

1. **The roadmap document is not misleading in structure**, but its distance estimates need updating. Phase 0-1 are now done, and Phases 2-5 are further along than the original "advisory-only" framing suggests.

2. **The biggest risk is the "scaffold gap"**: extensive type definitions and file structures exist, but the gap between "artifact builder that runs" and "system that works end-to-end without human flags" is large. A reader of the roadmap might assume that the existence of `planner.ts`, `generator.ts`, `evaluator.ts` means these roles are functional. They are not -- they are type-level contracts with placeholder implementations.

3. **Recommended immediate updates to the roadmap:**
   - Add "Current Progress" sections to Phases 0-4 (Phase 5 and 8 already have them).
   - Update the distance estimates.
   - Be explicit about the "scaffold vs functional" distinction.

4. **Priority for functional completeness:** The highest-value next steps are (a) wiring `--verify` as default when `--materialize --apply-edits` is used, so the keep/reject loop can work without manual intervention, and (b) connecting the orchestrator roles to a real LLM.

---

## Ready-for-Implementation Tasks

### Task 1: Wire verification as default in materialize+apply flow
- **Files:** `bench-opt/runner.ts`
- **Expected output:** When `--materialize --apply-edits` is passed, `--verify` is automatically implied.
- **Acceptance criteria:** A single `pnpm bench:opt -- --materialize --apply-edits` invocation produces a keep/reject decision without needing `--verify`.

### Task 2: Add real LLM adapter for orchestrator roles
- **Files:** New file `bench-opt/adapters/openai.ts` or equivalent; modify `bench-opt/orchestrator.ts`.
- **Expected output:** `BenchOptRoleAdapters` with a real OpenAI/Anthropic backend for at least the evaluator role.
- **Acceptance criteria:** `--orchestrate` produces evaluator critique from a real model, not placeholder text.

### Task 3: Add guardrails skeleton
- **Files:** New file `bench-opt/guardrails.ts`.
- **Expected output:** Functions that detect: train/validation score divergence, rising cost without gain, oscillation.
- **Acceptance criteria:** Guardrail checks are called by the runner and can block promotion.

### Task 4: Add bench-opt CI workflow
- **Files:** New file `.github/workflows/bench-opt.yml`.
- **Expected output:** A CI job that runs `pnpm bench:opt` on PR and verifies the status artifact.
- **Acceptance criteria:** bench-opt runs in CI and fails if status is unexpected.

### Task 5: Expand live evaluator surface coverage
- **Files:** New files in `bench-live/scenarios/` for hover, input, subtitle.
- **Expected output:** At least 3 additional live scenarios beyond page-translation.
- **Acceptance criteria:** `pnpm bench:live --list` shows 5+ scenarios across 3+ surfaces.

---

## Risks / Open Questions

1. **Runner complexity risk:** `bench-opt/runner.ts` is 103 KB, making it the largest file in the project by far. This is a maintenance and comprehension risk. Consider splitting it.

2. **Scaffold vs functional ambiguity:** Many files exist with complete types but placeholder behavior. A new contributor may not easily distinguish "this works" from "this is a contract stub." Consider adding `@status scaffold` or `@status functional` JSDoc tags.

3. **No integration test for the full optimize cycle:** There is no single test that runs materialize -> apply -> rerun -> verify -> keep/reject. Without this, it is hard to know if the end-to-end path works.

4. **CI does not run bench-opt:** If bench-opt scaffolding regresses, CI will not catch it.

5. **Live evaluator requires Playwright + Chrome:** This creates a dependency that may not be available in all CI environments. The current fallback (placeholder scenario) means live gate can be "skipped" silently.
