# Astra Release Readiness Checklist

_Last updated: 2026-04-14 (Month 2 learning-loop policy)_

This checklist defines **release-blocking gates** and the minimum evidence required for a credible release decision.

## Gate 1 — Deterministic quality gate (required)

| Check | How to verify | Artifact | Required |
|---|---|---|---|
| Lint is green | `pnpm lint:ci` | `CI / quality` job logs | Yes |
| Type check is green | `pnpm type-check` | `CI / quality` job logs | Yes |
| Unit/integration tests are green | `pnpm test` | `CI / quality` job logs | Yes |
| Deterministic bench is green | `pnpm bench` | `bench-results/latest.json` + CI logs | Yes |

**Block if:** any check fails.

## Gate 2 — Required live release-proof lanes (required)

Canonical lane names are defined in `docs/investigations/workstream-f-live-lane-conventions.md`.

| Lane | Command | Artifact | Required |
|---|---|---|---|
| `source-core` | `pnpm bench:live:lane:source-core` | `bench-live-results/<run-id>/` | Yes |
| `extension-core` | `pnpm bench:live:lane:extension-core` | `bench-live-results/<run-id>/` | Yes |

CI enforces these in `.github/workflows/ci.yml` (`live-browser` job).

**Block if:** either required lane fails.

## Gate 3 — Release-proof evidence clarity (required)

| Check | How to verify | Artifact | Required |
|---|---|---|---|
| Live artifacts uploaded by CI | `CI / live-browser` uploads `live-bench-results` | GitHub Actions artifact | Yes |
| Required lane inventory is documented | Confirm lane names and required scenarios | `docs/investigations/workstream-f-live-lane-conventions.md` | Yes |
| Flaky inventory exists and is current | Confirm open items or explicit `None` | `docs/investigations/workstream-f-live-flaky-inventory.md` | Yes |

**Block if:** evidence docs are missing or stale for the current RC.

## Gate 4 — Claims vs proof alignment (required)

| Check | How to verify | Artifact | Required |
|---|---|---|---|
| Live coverage matrix reflects current reality | Manual review against scenario registry + CI lanes | `docs/investigations/workstream-a-live-coverage-matrix.md` | Yes |
| Unsupported/unproven surfaces are marked as gaps | Manual review | Same matrix + RC notes | Yes |

**Block if:** docs claim coverage that is not currently implemented or gated.

## Month 2 — Learning-loop policy (2026-04-14)

- **Required gates unchanged**: `source-core` + `extension-core` only. `extension-core` already runs `bench-live/vocabulary-srs-smoke`.
- **Chained `learning-loop` lane** (`pnpm bench:live:lane:learning-loop` = `popup-proof` + `vocabulary-srs-smoke`) remains **optional** for Month 2: credible for product narrative and regression discipline, but **not** promoted to Gate 2 until (a) flaky ownership matches `extension-core` rigor and (b) at least one green run summary is attached per RC / closeout (`docs/investigations/month-2-closeout-2026-04-14.md`).
- **Evidence bundle**: `learning-loop-overview-2026-04-13.md`, `learning-metrics-2026-04-13.md`, `learning-loop-regression-checklist-2026-04-13.md`, `learning-loop-navigation-matrix-2026-04-14.md`, `learning-loop-claim-impact-2026-04-14.md`, `month-2-closeout-2026-04-14.md`.

## Current Month 1 reality notes (not a pass override)

- Required release-proof lanes now cover: page-translation (source-backed), article-extraction (`bench-live/article-extraction-proof`), dynamic-content (source-contract), site-automation (extension-loaded), onboarding (extension-loaded), vocabulary (extension-loaded).
- Month 1 policy decision: hover and selection-explain remain **optional** (`pnpm bench:live:lane:hover-selection`) rather than required release gates. Rationale: current evidence is credible, but the lane is still modeled as a combined UX proof lane, does not yet have separate required-lane semantics in CI, and Month 1 release discipline should not over-promote non-core UX proof before that structure exists.
- Popup deep-read now has credible optional live proof via `bench-live/popup-deep-read-proof`, `pnpm bench:live:lane:popup-proof`, and `pnpm bench:live:lane:learning-loop`, but it remains outside required release-proof lanes for Month 1 and must stay explicit in matrix/close-out notes.
- Month 1 gate close-out is recorded in `docs/investigations/month-1-closeout-2026-04-13.md`; the close-out verdict does not by itself override required lane failures.

## Pre-release execution order

1. `pnpm lint:ci`
2. `pnpm type-check`
3. `pnpm test`
4. `pnpm bench`
5. `pnpm bench:live:lane:release-proof`
6. Confirm CI `quality` + `live-browser` jobs are green
7. Review:
   - `docs/investigations/workstream-a-live-coverage-matrix.md`
   - `docs/investigations/workstream-f-live-lane-conventions.md`
   - `docs/investigations/workstream-f-live-flaky-inventory.md`
8. (Optional confidence boost) Run `pnpm bench:live:lane:hover-selection`
9. (Optional confidence boost) Run `pnpm bench:live:lane:popup-proof` or `pnpm bench:live:lane:learning-loop`
10. Review `docs/investigations/month-1-closeout-2026-04-13.md`
11. Only then tag release candidate

## Escalation rule

If any required gate is overridden:

1. Document the exact override in the PR/RC note,
2. Get explicit owner approval,
3. Add a follow-up item with owner/date,
4. Do not silently override failing live lanes.
