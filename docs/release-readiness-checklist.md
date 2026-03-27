# Astra Release Readiness Checklist

_Last updated: 2026-03-26 (E6 semantic sync)_

This checklist defines the gates that must pass before any bench-opt candidate or product change is considered release-ready. Each gate has an explicit check, a responsible artifact, and a current status.

---

## Gate 1: Deterministic Bench Health

The deterministic judge harness (`bench/`) must be green across all splits.

| Check | How to verify | Artifact | Current status |
|-------|---------------|----------|----------------|
| All train scenarios pass | `pnpm bench -- --split train` exits 0 | `bench-results/latest.json` | Verify per run |
| All validation scenarios pass | `pnpm bench -- --split validation` exits 0 | `bench-results/latest.json` | Verify per run |
| All holdout scenarios pass | `pnpm bench -- --split holdout` exits 0 | `bench-results/latest.json` | Verify per run |
| No regressions from previous run | `latest.json` -> `comparison.regressions === 0` | `bench-results/latest.json` | Verify per run |
| Average total >= 80 across all splits | `latest.json` -> `summary.averageTotal >= 80` | `bench-results/latest.json` | Verify per run |
| No critical issues in any scenario | All `scenarios[*].evaluation.issues` have no `critical` severity | `bench-results/latest.json` | Verify per run |
| CI bench step passes | GitHub Actions `quality` job, `Bench` step | `.github/workflows/ci.yml` | Active |
| Scenario count is stable | `pnpm bench:inventory` output matches expected total | `bench-results/latest.json` -> `inventory` | 36 scenarios |

**Block if:** Any holdout scenario fails, any regression exists, or CI bench step fails.

---

## Gate 2: Live Scenario Health

The live evaluator (`bench-live/`) must pass for covered surfaces.

| Check | How to verify | Artifact | Current status |
|-------|---------------|----------|----------------|
| Default live scenario passes | `pnpm bench:live` exits 0 | `bench-live-results/latest.result.json` | Active (page-translation only) |
| Source-backed bilingual scenario passes | `pnpm bench:live -- --scenario bench-live/page-translation-article-basic-source-bilingual` | `bench-live-results/<run-id>/result.json` | Active |
| Translation-only scenario passes | `pnpm bench:live -- --scenario bench-live/page-translation-article-basic-source-translation-only` | Same | Active |
| Playwright smoke passes | `pnpm bench:live -- --scenario bench-live/fixture-playwright-smoke` | Same | Active |
| interaction-priority-basic passes | `pnpm bench:live -- --scenario bench-live/scenarios/interaction-priority-basic` | Same | PASS (verified Wave 5.2) |
| input-translation-basic passes | `pnpm bench:live -- --scenario bench-live/scenarios/input-translation-basic` | Same | PASS (verified Wave 5.2, score 100) |
| subtitle-basic passes | `pnpm bench:live -- --scenario bench-live/scenarios/subtitle-basic` | Same | FAIL (B-class: VTTCue bridge timeout) |
| frame-coordination-basic passes | `pnpm bench:live -- --scenario bench-live/scenarios/frame-coordination-basic` | Same | PASS (verified Wave 5.2) |
| Live score >= 80 | `latest.result.json` -> `evaluation.score >= 80` | `bench-live-results/latest.result.json` | Score is 100 currently |
| Screenshots are produced | Run directory contains `.png` files | `bench-live-results/<run-id>/` | Active |

**Block if:** Default live scenario fails or live score drops below 80.

**Known limitation (updated):** 4 non-page-translation surfaces now have live scenarios: interaction-priority, input-translation, subtitle, frame-coordination. Of these, subtitle-basic has a known B-class bug (VTTCue bridge timing). Surfaces still without live coverage: hover, selection-explain, article-extraction, dynamic-content, site-automation.

---

## Gate 3: Keep/Reject Safety

The optimizer's keep/reject logic must be functioning and producing explicit decisions.

| Check | How to verify | Artifact | Current status |
|-------|---------------|----------|----------------|
| Keep/reject decision is present | `bench-opt-results/latest.status.json` -> `summary.keepRejectDecision` is not null | `latest.status.json` | Currently null (requires `--verify`) |
| Retained candidates have positive delta | `bench-opt/compare.ts` output shows improvement | Compare artifact | Available when `--verify` is used |
| Rejected candidates are logged | Store has reject records | `bench-opt-results/store/experiments/*.json` | Available |
| No silent failures in verification | `bench-opt/verify.ts` produces explicit pass/fail | Verify artifact | Available when `--verify` is used |
| Safety guardrails produce verdict | `latest.status.json` -> `safety.guardrailVerdict` is not null | `latest.status.json` | NOW WIRED: guardrails + red-flags flow into status artifact |
| Red-flag count is tracked | `latest.status.json` -> `safety.redFlagCount` is a number | `latest.status.json` | NOW WIRED: `redFlagCount: 0` in verified run |
| Guardrail block affects overallState | A `guardrailVerdict: "block"` prevents promotion | `latest.status.json` -> `overallState` | NOW WIRED: block verdict propagates to overallState |
| Telemetry is collected | `latest.status.json` -> `telemetry` has `durationMs` and `candidatesKept` | `latest.status.json` | NOW EXISTS: collector, flush, duration/candidates in status |

**Block if:** Keep/reject decision is unavailable and promotion is attempted, or guardrail verdict is "block".

**Known limitation:** Verification requires explicit `--verify` flag. It is not the default path. This means keep/reject is effectively opt-in, not automatic. Telemetry `scoreTrends` is not yet wired to real per-surface tracking.

---

## Gate 4: Promotion Gate Readiness

The promotion pipeline must produce a clear qualified/blocked/promoted decision.

| Check | How to verify | Artifact | Current status |
|-------|---------------|----------|----------------|
| Promotion decision is present | `pnpm bench:opt -- --promotion-plan` produces `latest.promotion.json` | `bench-opt-results/latest.promotion.json` | Active (currently "blocked") |
| Required splits are observed | `promotion.gate.missingSplits` is empty | `latest.promotion.json` | All splits present |
| Live evaluator is consumed | `promotion.gate.liveEvaluatorPassed` is true | `latest.promotion.json` | True |
| Verification is passed | `promotion.gate.reason` does not include "verification not passed" | `latest.promotion.json` | Currently not passed |
| Keep/reject is available | `promotion.gate.reason` does not include "keep/reject decision unavailable" | `latest.promotion.json` | Currently unavailable |
| Publish plan is produced | `latest.publish.json` exists | `bench-opt-results/latest.publish.json` | Active (dry-run) |
| Promotion artifacts are JSON files | `latest.promotion.json`, `latest.publish.json`, `latest.rollback.json` all produced | `bench-opt-results/` | Verified Wave 5.5 |
| Mutation targets registered | `OptimizerCandidateKind` includes `tool-config` and `agent-graph` | `bench-opt/types.ts` | NOW REGISTERED (types extended, not yet consumed by compare/lineage) |

**Block if:** Promotion status is "blocked" and no override is explicitly provided via `--promotion-allow`.

**Current state (Wave 5 verified):** Promotion execution model is upgraded -- all three artifacts (promotion, publish, rollback) are produced as structured JSON. `promotionStatus: blocked`, `publishStatus: blocked`, `rollbackStatus: idle`. Promotion/publish/rollback are still execution-model only, not yet real VCS operations.

---

## Gate 5: Rollback Readiness

A rollback plan must exist before any promotion can proceed.

| Check | How to verify | Artifact | Current status |
|-------|---------------|----------|----------------|
| Rollback plan exists | `latest.rollback.json` is present | `bench-opt-results/latest.rollback.json` | Active (dry-run, idle) |
| Rollback branch target is defined | `rollbackPlan.targets.branchName` is not null | `latest.rollback.json` | Has branch name |
| Rollback steps are defined | `rollbackPlan.steps` array is non-empty | `latest.rollback.json` | 5 steps defined |
| Rollback is tested | Rollback has been exercised at least once in dry-run | Manual verification | Not regularly tested |

**Block if:** No rollback plan exists. (Currently always present when `--promotion-plan` is used.)

**Known limitation:** All rollback steps are dry-run only. No real VCS rollback has been tested.

---

## Gate 6: Docs Sync

Documentation must reflect the current state of the system.

| Check | How to verify | Artifact | Current status |
|-------|---------------|----------|----------------|
| `bench-harness.md` matches current bench | Manual review | `docs/bench-harness.md` | Mostly current |
| `bench-opt.md` matches current bench-opt | Manual review | `docs/bench-opt.md` | Mostly current |
| `capability-matrix.md` is current | Manual review | `docs/capability-matrix.md` | Mostly current |
| Roadmap phases have accurate status | Manual review | `docs/anthropic-style-long-running-harness-roadmap.md` | Needs "Current Progress" sections for Phases 0-4 |
| Release checklist exists | This file exists | `docs/release-readiness-checklist.md` | This file |
| Operator runbook exists | `docs/bench-opt-operator-runbook.md` exists | `docs/bench-opt-operator-runbook.md` | Created alongside this file |

**Block if:** Roadmap claims phases are complete that are actually scaffolds.

---

## Gate 7: Operator Status Clarity

An operator must be able to determine system state without reading source code.

| Check | How to verify | Artifact | Current status |
|-------|---------------|----------|----------------|
| Status artifact is current | `pnpm bench:opt:status` produces readable output | `bench-opt-results/latest.status.json` | Active |
| Status includes all subsystems | `latest.status.json` has non-null entries for report, live, promotion, publish, rollback | `latest.status.json` | Active |
| Overall state is clear | `overallState` is one of: idle, running, kept, rejected, promoted, blocked, handoff, completed | `latest.status.json` | Currently "blocked" |
| Operator can resume | `pnpm bench:opt:resume-latest` works | CLI output | Active |
| Store index is maintained | `bench-opt-results/store/index.json` has current data | `store/index.json` | Active |

**Block if:** Status artifact cannot be produced or is missing key subsystem data.

---

## Pre-Release Checklist (ordered)

Before any release:

1. [ ] Run `pnpm test` -- all unit tests pass
2. [ ] Run `pnpm type-check` -- no type errors
3. [ ] Run `pnpm bench` -- all scenarios pass, no regressions
4. [ ] Run `pnpm bench -- --split holdout` -- holdout gate passes
5. [ ] Run `pnpm bench:live` -- live evaluator passes
6. [ ] Run `pnpm bench:opt -- --write --promotion-plan --live` -- status artifact is produced
7. [ ] Run `pnpm bench:opt:status` -- review overall state
8. [ ] Verify `pnpm build` produces valid Chrome extension
9. [ ] Verify `pnpm build:safari` produces valid Safari extension
10. [ ] Verify `bash ios/scripts/verify-safari-build-sync.sh` passes
11. [ ] Review this checklist -- all gates green or with documented exceptions
12. [ ] Tag release

---

## Escalation

If any gate is red and must be overridden:
1. Document the exception and reason in the PR description.
2. Get explicit approval from the project owner.
3. Create a follow-up issue for resolving the gate failure.
4. Never override holdout failures silently.
