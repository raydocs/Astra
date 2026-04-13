# Astra Release Readiness Checklist

_Last updated: 2026-04-12 (Workstream B popup deep-read smoke sync)_

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

## Current Month 1 reality notes (not a pass override)

- Required release-proof lanes now cover: page-translation (source-backed), article-extraction (`bench-live/article-extraction-proof`), dynamic-content (source-contract), site-automation (extension-loaded), onboarding (extension-loaded), vocabulary (extension-loaded).
- Hover and selection-explain now both have browser-backed standard live scenarios (`bench-live/hover-translation-basic`, `bench-live/selection-explain-basic`) but remain **optional** (not required release gates yet).
- Popup deep-read now has optional live proof via `bench-live/popup-deep-read-smoke` / `pnpm bench:live:lane:learning-loop`, but it is still outside required release-proof lanes and must remain explicit in matrix/RC notes.

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
9. Only then tag release candidate

## Escalation rule

If any required gate is overridden:

1. Document the exact override in the PR/RC note,
2. Get explicit owner approval,
3. Add a follow-up item with owner/date,
4. Do not silently override failing live lanes.
