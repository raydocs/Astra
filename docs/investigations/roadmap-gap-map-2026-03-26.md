# Investigation: Astra roadmap gap map (2026-03-26)

## Summary
The roadmap in `docs/anthropic-style-long-running-harness-roadmap.md` is directionally right, but it is stale relative to the current working tree. Evidence in `bench/`, `bench-opt/`, `bench-live/`, and `bench-opt-results/` shows that Phase 0–2 are substantially implemented, Phase 3–5 are implemented in bounded form, Phase 6/7/8/10 are partially implemented, and Phase 9 remains the weakest gap.

Astra is therefore no longer just a judge + advisory stack. In the current local tree it is a **bounded optimizer harness** with split-aware judging, experiment/champion/store artifacts, optional worktree materialization, structured edit apply, verification + keep/reject, bounded orchestration, session resume/handoff, real browser-backed live evaluation for page translation, and dry-run promotion planning. It is **not yet** a full Anthropic-style long-running harness because the core loop is still bounded/opt-in, live coverage is narrow, tool/graph mutation is missing, promotion execution is still planning-only, and safety/telemetry layers are thin.

## Symptoms
- The roadmap still claims major gaps like “no real execute-apply-rerun-keep/reject loop”, “no real live evaluator”, “no experiment manager”, and “no real promotion pipeline” (`docs/anthropic-style-long-running-harness-roadmap.md:92-110`, `141-204`).
- Current code and artifacts show these subsystems now exist at least in bounded or dry-run form (`bench-opt/runner.ts:1910-2141`, `bench-live/scenarios/page-translation-article-basic-source.ts:1-156`, `bench-opt-results/latest.status.json:1-169`, `bench-opt-results/store/index.json:1-80`).
- The current repo state is also a **working-tree** assessment, not necessarily a fully merged mainline state: `git status` shows 47 modified and 22 untracked files, including `bench-opt/`, `bench-live/`, `bench-opt-results/`, `bench/splits.ts`, and the roadmap itself.

## Investigation Log

### Judge harness / split discipline
**Hypothesis:** Phase 0 is now complete.

**Findings:** The judge harness is split-aware end to end. `bench/splits.ts` loads `splits.json`, defines `train|validation|holdout`, and filters/counts scenarios by split. `bench/entry.ts` parses `--split`, validates it, and selects scenarios with the split filter. `bench/splits.json` assigns concrete scenarios to train/validation/holdout.

**Evidence:**
- `bench/splits.ts:11-46` — defines `benchmarkSplits`, `isBenchmarkSplit`, `getScenarioSplit`, `filterScenariosBySplit`, `countScenariosBySplit`
- `bench/entry.ts:25-40` — CLI parses and validates `--split`
- `bench/entry.ts:218-223` — `runBench()` selects scenarios with `{ surface, split }`
- `bench/splits.json:1-37` — concrete split manifest exists

**Conclusion:** Phase 0 / checklist item “Train / validation / holdout split exists” is complete.

### Experiment manager / champion / store
**Hypothesis:** Phase 1 is now real, not just scoring.

**Findings:** `bench-opt` persists trial objects, promotion gate metadata, champion selection, and store indexes. The store artifact also records latest experiment, champion, session, checkpoint, and handoff bundle.

**Evidence:**
- `bench-opt/experiments.ts:11-53` — trial split assignment + promotion gate construction
- `bench-opt/experiments.ts:55-137` — `materializeBenchOptTrials()` and `createBenchOptExperimentRun()` create durable experiment/trial objects
- `bench-opt/champion.ts:29-67` — explicit champion selection with validation/holdout references
- `bench-opt/store.ts:10-28` — store schema includes experiments/champions/sessions/checkpoints/compactions/handoffs
- `bench-opt/store.ts:64-119` — experiment/champion persistence
- `bench-opt/store.ts:121-189` — session/checkpoint/compaction/handoff persistence
- `bench-opt-results/store/index.json:1-24` — latest experiment/champion/session/checkpoint/handoff recorded
- `bench-opt-results/store/index.json:25-80` — multiple persisted experiments exist on disk

**Conclusion:** Phase 1 is substantially complete.

### Materialize / apply / verify / keep-reject
**Hypothesis:** Phase 2 now exists, but may still be bounded/opt-in.

**Findings:** Astra can create a real worktree, apply structured edits inside that worktree, run bounded verification commands (`type-check`, `test`, `bench -- --split ...`), and compute automatic keep/reject/promote decisions. However, this path is opt-in and not the default lifecycle.

**Evidence:**
- `bench-opt/materialize.ts:14-42` — real worktree materialization via git worktree command when enabled
- `bench-opt/materialize.ts:44-81` — `executeMaterializedCandidate()` applies edits after materialization
- `bench-opt/apply.ts:10-54` — structured rewrite/replace edits with worktree-bound path enforcement
- `bench-opt/rerun.ts:41-311` — bounded command executor for worktree verification
- `bench-opt/verify.ts:58-111` — verification plan builds `type-check`, `tests`, and bench split commands
- `bench-opt/verify.ts:138-187` — executes verification plan and returns pass/fail
- `bench-opt/keep-reject.ts:83-138` — automatic `promote|retain|reject` decision logic from structured comparison
- `bench-opt/runner.ts:1910-2029` — runner wires live/verification/keep-reject/orchestration paths together
- `bench-opt/runner.ts:1912-1914` — verification requires executed materialized worktree, proving this is still gated/opt-in

**Conclusion:** Phase 2 is substantially complete in **bounded form**. The remaining gap is not missing plumbing; it is defaultness/autonomy.

### Planner / generator / evaluator orchestration
**Hypothesis:** Phase 3 exists structurally but is still scaffolded.

**Findings:** Separate planner, generator, and evaluator artifacts are implemented with distinct contracts and responsibilities. The orchestrator runs these roles in order, but the implementation remains explicitly bounded and largely deterministic/scaffolded rather than model-backed autonomous collaboration.

**Evidence:**
- `bench-opt/planner.ts:46-133` — planner artifact with decomposition, rubric, budget, refine policy, and role contract
- `bench-opt/generator.ts:21-75` — generator artifact with edit scope and implementation steps
- `bench-opt/evaluator.ts:28-108` — evaluator artifact with critique, evidence, follow-up recommendation, and handoff
- `bench-opt/orchestrator.ts:22-100` — explicit planner → generator → evaluator orchestration
- `bench-opt/orchestrator.ts:78-86` — returned artifact is explicitly `bounded: true`
- `bench-opt/strategy.ts:47-66` — iteration budget defaults are `maxIterations: 1`, `maxReruns: 1`
- `bench-opt/strategy.ts:77-127` — follow-up logic is threshold/budget based (`keep`, `reject`, `rerun`), not a richer pivot engine

**Conclusion:** Phase 3 and checklist item “Planner / generator / evaluator are separate roles” are partial-to-strong, but not full Anthropic-style runtime parity.

### Session / checkpoint / compaction / handoff / resume
**Hypothesis:** Phase 4 is substantially implemented.

**Findings:** The harness can persist bounded session state, checkpoint it, derive compaction metadata, create handoff artifacts, resume latest session bundles, and autoloop across resume cycles.

**Evidence:**
- `bench-opt/session.ts:1-47` — session schema includes bounded session phase, budgets, progress, history, resume state
- `bench-opt/session.ts:217-317` — create/resume/update session state helpers
- `bench-opt/session.ts:395-403` — over-budget detection for iteration/wall-clock budgets
- `bench-opt/checkpoints.ts:47-115` — checkpoint artifact creation with session/report/compaction/handoff references
- `bench-opt/compaction.ts:64-94` — compaction trigger logic for context growth / iteration / wall clock / manual
- `bench-opt/compaction.ts:96-188` — compaction metadata carries forward retained state and resume session id
- `bench-opt/handoff.ts:52-129` — handoff artifact supports `resume` vs `reset` and `same-session` vs `fresh-session`
- `bench-opt/resume-latest.ts:18-39` — wrapper loads latest session/checkpoint/handoff bundle from store and forwards it to runner
- `bench-opt/autoloop.ts:81-174` — autoloop repeatedly starts/resumes sessions until terminal or cycle cap
- `bench-opt-results/store/index.json:1-24` — latest session/checkpoint/handoff bundle persisted

**Conclusion:** Phase 4 and checklist item “Long-running sessions survive compaction or reset/handoff” are substantially complete in bounded form.

### Live evaluator
**Hypothesis:** Phase 5 is more advanced than the roadmap claims, but coverage remains narrow.

**Findings:** `bench-live` is no longer just a placeholder. It has a Playwright-backed driver, standalone live CLI, result persistence, a source-backed page-translation runtime that loads the real `src/entrypoints/content/page-translate.ts` module through a Vite SSR harness, and real browser-backed page-translation scenarios with artifacts. But the registered scenario set is still small and almost entirely page-translation-centric.

**Evidence:**
- `bench-live/driver.ts:5-66` — Playwright/Chromium driver with local browser resolution and real browser launch
- `bench-live/driver.ts:100-197` — materialize fixture page + capture screenshot + snapshot HTML
- `bench-live/source-runtime.ts:176-208` — loads the real page-translation module via Vite SSR (`/src/entrypoints/content/page-translate.ts`)
- `bench-live/source-runtime.ts:285-393` — runs source-backed translation against fixture HTML and emits translated HTML + execution metrics
- `bench-live/scenarios/page-translation-article-basic-source.ts:18-118` — source-backed bilingual scenario runs real source path then opens translated snapshot in a real browser
- `bench-live/scenarios/page-translation-article-basic-source-translation-only.ts:18-119` — parallel source-backed translation-only scenario
- `bench-live/results.ts:13-36` — standalone live results persisted to `bench-live-results/<runId>/result.json|md` and `latest.result.*`
- `bench-live/entry.ts:4-17` — live CLI persists run outcomes
- `bench-live/scenarios/index.ts:13-19` — only five registered scenarios: two source-backed page-translation scenarios, one non-source page-translation scenario, one smoke scenario, one placeholder
- `bench-live/scenarios/placeholder.ts:3-57` — placeholder scenario still exists
- `bench-opt-results/latest.live.json:1-80` — latest live run passed with source-backed browser artifacts, screenshot paths, snapshot HTML, and benchmark evaluation
- `bench-opt-results/latest.status.json:1-54` — runner consumed live result and marked `liveStatus: pass`

**Conclusion:** Phase 5 is **partially complete but clearly beyond roadmap’s placeholder framing**. Remaining gap is breadth, not existence.

### First-class optimization targets
**Hypothesis:** Prompt/context are real first-class targets; tool/graph are not.

**Findings:** Prompt and context candidates exist and are consumed downstream by optimizer config, patch-task generation, patch-context slicing, and executor prompts. There is no `agent-config/` tree, no `mutate-tools.ts`, no `mutate-graph.ts`, and no graph candidate registry.

**Evidence:**
- `bench-opt/candidates/prompt.ts:3-37` — prompt candidates with policy fields
- `bench-opt/candidates/context.ts:3-45` — context candidates with slot/policy fields
- `bench/optimizer-config.ts:34-66` — resolves prompt/context policy
- `bench/optimizer-config.ts:68-112` — resolves prompt/context candidates from registry
- `bench/reporters/patch-task.ts:86-104` — optimizer prompt/context policies are consumed downstream
- `bench/reporters/patch-task.ts:623-677` — prompt/context policy changes task instructions and prompt content
- `bench/reporters/patch-context.ts:267-304` — context policy changes max files/max lines and file slicing
- `bench/reporters/executor.ts:75-132` — executor prompt reflects optimizer prompt/context policy
- Path search returned **no matches** for:
  - `agent-config/`
  - `bench-opt/mutate-tools.ts`
  - `bench-opt/mutate-graph.ts`
  - `bench-opt/mutate-prompts.ts`
  - `bench-opt/mutate-context.ts`

**Conclusion:** Phase 6 / checklist item “Prompt/context/tool/graph are first-class mutation targets” is only partially implemented. Prompt/context: yes. Tool/graph: not yet.

### Refine vs pivot
**Hypothesis:** Refine exists; pivot remains weak.

**Findings:** Strategy logic supports `rerun`, `keep`, and `reject`, and the planner artifact includes “refine-vs-pivot thresholds”. In practice the decisioning is threshold/budget-based and bounded. There is no richer trend-aware pivot engine or candidate-family mutation loop.

**Evidence:**
- `bench-opt/planner.ts:79-128` — planner claims refine-vs-pivot thresholds as a responsibility
- `bench-opt/strategy.ts:77-127` — actual decision space is `keep|reject|rerun` based on score thresholds and rerun budget
- `bench-opt/evaluator.ts:44-108` — evaluator emits critique and handoff, but driven by thresholded recommendation

**Conclusion:** Phase 7 is partial, leaning weak.

### Promotion / publish / rollback
**Hypothesis:** Phase 8 exists as planning/gating, not execution.

**Findings:** The runner builds promotion, publish, and rollback artifacts; the promotion gate consumes split coverage, verification, keep/reject, and live pass state. But publish and rollback plans are explicitly dry-run/planning skeletons, and there is no `.github/workflows/bench-opt.yml` workflow.

**Evidence:**
- `bench-opt/runner.ts:2072-2141` — runner wires verification/live/keep-reject state into promotion, publish, and rollback plans
- `bench-opt/promote.ts:131-198` — promotion decision computes required splits/checks/live/canary gating
- `bench-opt/publish.ts:128-151` — `dryRun = true`; execution only modeled as plan status
- `bench-opt/publish.ts:159-214` — publish steps are planned/blocked/skipped; publish reason explicitly says execution remains out of scope / disabled by default
- `bench-opt/rollback.ts:96-108` — rollback computes `executionEnabled` but stays planning-oriented
- `bench-opt/rollback.ts:116-169` — rollback steps are revert/close-pr/disable-canary/restore-branch/record-rollback plans
- `bench-opt-results/latest.status.json:55-169` — promotion is blocked, publish plan has `dryRun: true` and `executionEnabled: false`
- Path search returned **no match** for `.github/workflows/bench-opt.yml`
- `.github/workflows/ci.yml:1-50` — CI only runs type-check, test, bench, and builds; it does not run bench-opt promotion/publish automation

**Conclusion:** Phase 8 is partial. Planning/gating exists; real VCS/PR/canary/publish execution does not.

### Safety / anti-overfitting
**Hypothesis:** Phase 9 is still the weakest gap.

**Findings:** Split discipline exists and promotion sees split coverage, but the specific roadmap safety modules are absent. There is no dedicated guardrail/red-flag layer for overfitting, instability, cost drift, or oscillation penalties.

**Evidence:**
- Positive evidence: `bench/splits.ts:11-46`, `bench/splits.json:1-37`, `bench-opt/experiments.ts:30-53`
- Negative evidence: path search returned **no matches** for `bench-opt/guardrails.ts` and `bench-opt/red-flags.ts`

**Conclusion:** Phase 9 remains the clearest shortfall.

### Observability / operator controls
**Hypothesis:** Operator controls exist; telemetry/dashboard do not.

**Findings:** There is a unified status artifact, autoloop artifacts, session store indexes, and operator-facing status summaries. But the specific telemetry/log/dashboard files in the roadmap are absent.

**Evidence:**
- `bench-opt/status.ts:33-118` — unified status artifact summarizes execution/live/orchestration/session/promotion/publish/rollback state
- `bench-opt/status.ts:174-274` — status markdown renders operator-facing dashboard text
- `bench-opt/autoloop.ts:81-174` — autoloop artifact tracks cycles, final phase, final decision
- `bench-opt-results/latest.status.json:1-169` — latest unified status artifact exists
- Negative evidence: path search returned **no matches** for `bench-opt/logs.ts`, `bench-opt/telemetry.ts`, `bench-opt/dashboard.md`

**Conclusion:** Phase 10 is partial.

## Root Cause
The main “root cause” of the mismatch is not a broken implementation; it is a **documentation drift problem**.

`docs/anthropic-style-long-running-harness-roadmap.md` still describes several capabilities as missing even though they now exist in the local working tree in bounded or dry-run form. The most obvious stale area is live evaluation: the roadmap still frames Phase 5 around placeholder/skeleton progress, but the codebase now includes a real `bench-live` CLI, Playwright-backed browser capture, source-backed execution of the real page-translation module, persisted live artifacts, and runner integration (`bench-live/driver.ts:35-66`, `bench-live/source-runtime.ts:285-393`, `bench-live/scenarios/page-translation-article-basic-source.ts:18-118`, `bench-opt/runner.ts:1916-1928`).

The remaining gap is therefore mostly **qualitative**, not foundational:
- the planner/generator/evaluator loop is scaffolded but not yet truly autonomous,
- execution/apply/verify exists but is still opt-in rather than default,
- live evaluation exists but is narrow,
- promotion exists as a dry-run gate/planner rather than an executor,
- tool/graph mutation and safety/telemetry layers remain underbuilt.

## Checklist Classification

### Complete
- Train / validation / holdout split exists
- Candidates are materialized into real isolated worktrees

### Partial
- Planner / generator / evaluator are separate roles
- Work is executed across multiple iterations
- The system can apply code changes automatically
- Deterministic judge bench re-runs automatically after each trial
- Live evaluator runs on the real app/runtime where needed
- Refine vs pivot decision exists
- Keep / reject decisions are automatic and logged
- Champion / challenger promotion exists
- Promotion is gated by validation + holdout + required checks
- Long-running sessions survive compaction or reset/handoff
- Operator controls and telemetry exist

### Missing / not yet first-class
- Prompt/context/tool/graph are first-class mutation targets (tool/graph still missing as first-class optimizer objects)

## Recommendations
1. **Update the roadmap status sections immediately.**
   - Reclassify Phase 0–2 as substantially complete.
   - Reclassify Phase 3–5 as bounded implementations rather than skeletons.
   - Reclassify Phase 8 as planning/gating implemented, execution missing.
   - Explicitly call out Phase 9 as the current weakest area.

2. **Make the next roadmap delta about qualitative completion, not foundational scaffolding.**
   Focus on:
   - model-backed planner/generator/evaluator runtime,
   - default closed-loop execution rather than opt-in verification,
   - broader live evaluator coverage beyond page-translation,
   - real VCS/PR/canary/publish/rollback execution,
   - tool/graph mutation targets,
   - guardrails/red-flags/telemetry.

3. **Add commit/CI hygiene around the harness itself.**
   The current state is a working-tree reality, not necessarily a merged/mainline reality. Commit the harness files and add dedicated automation for them; `.github/workflows/ci.yml` does not yet run a bench-opt workflow, and `.github/workflows/bench-opt.yml` is absent.

4. **Add a machine-readable status matrix to avoid future drift.**
   Example: a generated JSON/Markdown report that maps roadmap phases/checklist items to `complete|partial|missing` based on actual file/artifact presence.

## Preventive Measures
- Keep roadmap “Current progress” sections synchronized with code on every phase landing.
- Generate a roadmap status artifact from the repo rather than maintaining it manually.
- Treat “exists in local working tree” and “committed/mainline” as distinct states in future status reviews.
- Add dedicated safety/telemetry acceptance criteria before calling the harness “Anthropic-style parity”.
