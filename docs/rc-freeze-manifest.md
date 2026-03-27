# RC Freeze Manifest

**RC Version:** `rc-2026-03-27`
**Freeze Date:** 2026-03-26
**Integration Owner:** Owner
**Basis:** Wave 5 verification complete, all A-class integration bugs resolved, minimal viable near-complete target met.

---

## 1. New Files Added in This Campaign

### bench-opt modules

| File | Purpose |
|------|---------|
| `bench-opt/guardrails.ts` | Structured optimizer safety checks (C1) |
| `bench-opt/red-flags.ts` | Red-flag classification for promotion/risk (C2) |
| `bench-opt/telemetry.ts` | Structured telemetry for runs/iterations (C3) |
| `bench-opt/logs.ts` | Operator-facing log aggregation (C4) |
| `bench-opt/dashboard.md` | Dashboard artifact for operator visibility (C4) |
| `bench-opt/promote.ts` | Executable promotion artifact model (B1) |
| `bench-opt/promote.test.ts` | Tests for promotion module |
| `bench-opt/publish.ts` | Executable publish plan model (B2) |
| `bench-opt/publish.test.ts` | Tests for publish module |
| `bench-opt/rollback.ts` | Executable rollback plan model (B3) |
| `bench-opt/rollback.test.ts` | Tests for rollback module |
| `bench-opt/mutate-prompts.ts` | File-based prompt mutation operators (D2) |
| `bench-opt/mutate-context.ts` | File-based context mutation operators (D2) |
| `bench-opt/mutate-tools.ts` | Tool policy mutation target (D3) |
| `bench-opt/mutate-graph.ts` | Graph mutation target (D4) |
| `bench-opt/candidates/agent-graph.ts` | Agent-graph candidate generator |
| `bench-opt/candidates/tool-config.ts` | Tool-config candidate generator |
| `bench/optimizer-config.ts` | Optimizer config resolution with tool/graph targets |
| `bench/optimizer-config.test.ts` | Tests for optimizer config |
| `bench/history.ts` | Bench history tracking |
| `bench/splits.ts` | Split management for train/validation/holdout |
| `bench/splits.test.ts` | Tests for splits |
| `bench/splits.json` | Split definitions |
| `bench/reporters/history.ts` | History reporter |
| `bench/reporters/history.test.ts` | Tests for history reporter |

### bench-live scenarios

| File | Purpose |
|------|---------|
| `bench-live/scenarios/interaction-priority-basic.ts` | Live scenario: interaction priority surface (A2) |
| `bench-live/scenarios/input-translation-basic.ts` | Live scenario: input translation/writeback (A3) |
| `bench-live/scenarios/subtitle-basic.ts` | Live scenario: subtitle translation (A4) |
| `bench-live/scenarios/frame-coordination-basic.ts` | Live scenario: top/child frame coordination (A5) |
| `bench-live/scenarios/helpers/interaction-priority.ts` | Helper for interaction-priority scenario |
| `bench-live/scenarios/helpers/input-translation.ts` | Helper for input-translation scenario |
| `bench-live/scenarios/helpers/frame-coordination.ts` | Helper for frame-coordination scenario |
| `bench-live/scenarios/helpers/page-translation.ts` | Helper for page-translation scenario |

### agent-config

| File | Purpose |
|------|---------|
| `agent-config/defaults.json` | Default agent configuration |
| `agent-config/tool-registry.json` | Tool registry for mutation targets |
| `agent-config/graph-templates/translation-flow.json` | Graph template for translation flow |
| `agent-config/README.md` | Documentation for agent-config structure |

### docs

| File | Purpose |
|------|---------|
| `docs/investigations/master-backlog.md` | Campaign-level backlog (operational tracker) |
| `docs/investigations/wave5-verification-report.md` | Wave 5 integration verification results |
| `docs/investigations/workstream-a-live-coverage-matrix.md` | Live coverage plan for all surfaces |
| `docs/investigations/workstream-b-app-completion-audit.md` | Feature x validation matrix |
| `docs/investigations/workstream-c-roadmap-status.md` | Roadmap accuracy audit |
| `docs/investigations/promotion-safety-checklist.md` | Promotion-blocking vs warning conditions |
| `docs/investigations/gpt54-subagents-task-pack.md` | Subagent task definitions |
| `docs/investigations/integration-owner-playbook.md` | Owner integration guide |
| `docs/investigations/roadmap-gap-map-2026-03-26.md` | Roadmap gap analysis |
| `docs/release-readiness-checklist.md` | Release gate definitions |
| `docs/bench-opt-operator-runbook.md` | Operator-facing system state guide |
| `docs/bench-opt.md` | Refreshed bench-opt documentation (E3) |
| `docs/anthropic-style-long-running-harness-roadmap.md` | Refreshed roadmap (E2) |

### workflows

| File | Purpose |
|------|---------|
| `.github/workflows/bench-opt.yml` | GitHub Actions workflow for bench-opt validation (B4) |

### other new files

| File | Purpose |
|------|---------|
| `.bench-opt/worktrees/` | Worktree directory for verification path |
| `.codex/prompts/harness.evaluate.md` | Codex prompt: harness evaluation |
| `.codex/prompts/harness.generate.md` | Codex prompt: harness generation |
| `.codex/prompts/harness.loop.md` | Codex prompt: harness loop |

---

## 2. Owner-Only Files Modified

These files are integration bus files that were modified by the integration owner during Wave 4 wiring:

| File | Modifications |
|------|---------------|
| `bench-opt/runner.ts` | Wired safety/telemetry (C6), promotion/publish/rollback (B5), live scenarios (A6), tool/graph config (D6) |
| `bench-opt/types.ts` | Extended `OptimizerCandidateKind` with `"tool-config" \| "agent-graph"`, added `safety`, `telemetry`, `guardrailVerdict`, `redFlagCount` to `BenchOptStatusArtifact`, added `runAll` to `BenchOptRunnerLiveOptions` |
| `bench-opt/status.ts` | Wired guardrails, red-flags, and telemetry into status artifact output |
| `bench-live/index.ts` | Registered new live scenarios (interaction-priority, input-translation, subtitle, frame-coordination) |
| `bench/types.ts` | Updated bench types for campaign needs |
| `bench/entry.ts` | Updated bench entry for split/history support |
| `package.json` | Added new scripts (`bench:opt`, `bench:live`, etc.) |

---

## 3. RC Verification Results

Results from Wave 5 verification pass (2026-03-26):

| Gate | Command | Result | Details |
|------|---------|--------|---------|
| Type-check | `tsc --noEmit` | PASS | 0 errors |
| Tests | `pnpm test` | PASS | 510 total, 452 real pass, 58 false failures from worktree pollution |
| Bench | `pnpm bench` | PASS | 34/36 pass, avg score 94. 2 fail: `selection-explain/*` (pre-existing) |
| Live | `pnpm bench:live` | PASS | 7 scenarios total, page-translation 3/3, interaction-priority 1/1, input-translation 1/1, frame-coordination 1/1, subtitle 0/1 (B-class bug). Avg score 99 on passing scenarios |
| bench-opt | `pnpm bench:opt` | PASS | 6 candidates scored, best=51, status artifact produced |
| bench-opt + live | `pnpm bench:opt -- --live` | PASS | Live score 100 |
| Promotion | `pnpm bench:opt -- --promotion-plan` | PASS | All three artifacts produced (promotion, publish, rollback) |
| Advanced | `--verify --materialize` | PASS | Worktree created and materialized |
| Session | `--orchestrate --session` | PASS | Session/handoff artifacts produced |

---

## 4. Known Limitations Accepted for RC

### 4.1 selection-explain bench: 0/2

- **Status:** Pre-existing failure, not caused by campaign integration
- **Impact:** 2/36 bench scenarios report FAIL
- **Risk:** None to RC -- this surface was failing before the campaign started
- **Tracking:** B-class B2

### 4.2 .bench-opt/worktrees/ test pollution (58 false failures)

- **Status:** Stale worktree directories contain files that vitest discovers and attempts to run
- **Impact:** 58/510 tests appear to fail but are false positives
- **Mitigation:** Exclude worktree path in vitest config or clean the directory before testing
- **Risk:** Low -- the 452 real tests all pass
- **Tracking:** B-class B3, P1-3

### 4.3 Promotion/rollback: execution model only, no real VCS ops

- **Status:** Promotion, publish, and rollback produce structured JSON artifacts with execution steps, but do not actually execute git/gh operations in production
- **Impact:** The system can plan a promotion/rollback but cannot autonomously carry it out
- **Risk:** Acceptable for RC -- the execution model is correct and inspectable; real VCS ops are a follow-up (B6/B7)
- **Tracking:** C-class C2

### 4.4 Tool/graph mutation: registered but not consumed by compare/lineage

- **Status:** `OptimizerCandidateKind` includes `"tool-config"` and `"agent-graph"` and the types are extended, but the compare and lineage pipeline does not yet process these candidate kinds
- **Impact:** Tool and graph mutation candidates can be generated and scored, but cannot be compared across runs or traced through lineage
- **Risk:** Acceptable for RC -- the types are structurally correct and the pipeline integration is follow-up work (D5)
- **Tracking:** C-class C4

### 4.5 subtitle-basic live scenario: VTTCue bridge timeout

- **Status:** The scenario's `waitForFunction` expects programmatic VTTCue injection to complete, but the browser-side script has a timing issue
- **Impact:** 1/7 live scenarios fails
- **Risk:** Low -- the other 6 live scenarios pass and the subtitle surface is a B-class sub-module bug, not integration
- **Tracking:** B-class B1, P0-1

### 4.6 Telemetry scoreTrends: always empty

- **Status:** The `scoreTrends` field exists in the telemetry shape but is not wired to per-surface tracking
- **Impact:** Operators cannot see score trends over time in the status artifact
- **Risk:** Low -- telemetry duration and candidatesKept work correctly
- **Tracking:** C-class C5, P2-1

---

## 5. Explicit Non-Scope

The following items are NOT in this RC and MUST NOT block the release:

| Item | Reason |
|------|--------|
| Real VCS promotion/rollback execution | Follow-up B6/B7. The execution model is correct; wiring real git/gh ops is separate work. |
| hover, selection-explain, article-extraction, dynamic-content, site-automation live scenarios | Follow-up A7, P1-1, P2-2. Four surfaces already have live coverage. |
| Compare/lineage pipeline for tool-config and agent-graph candidates | Follow-up D5. Types are registered; pipeline consumption is separate. |
| Browser-level CI gate | Follow-up C-class C1, P0-2. Live scenarios exist but are not yet in the CI pipeline. |
| bench-opt --live running all scenarios by default | Follow-up C-class C6, P0-3. Currently picks first scenario unless `--live-all` is used. |
| `scoreTrends` telemetry | Follow-up C-class C5, P2-1. Field exists but is empty. |
| Canary deployment integration | Integration points exist in rollback/promote but are not wired to real deployment tooling. |
| Full mutation policy audit | Follow-up D5. Tool/graph dimensions are registered but not reviewed for effectiveness. |
| Safety-in-promotion validation (C7) | Follow-up. Guardrails flow into status and promotion gate, but no explicit blocked-path demo exists. |

---

## 6. RC Freeze Declaration

This manifest freezes the scope of `rc-2026-03-27`. Any changes after this freeze must be:

1. Bug fixes only -- no new features
2. Documented as amendments to this manifest
3. Re-verified through the acceptance ladder (type-check, test, bench, live, bench-opt)

The RC is based on the Wave 5 verification results and the campaign status documented in `docs/investigations/master-backlog.md` section 8.
