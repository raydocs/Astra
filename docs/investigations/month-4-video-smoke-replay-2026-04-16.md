# Month 4 video smoke replay (bench-live)

**Date:** 2026-04-14 (`M4-D-02` hardening replay, local agent run)

**Production www regression (manual):** `docs/investigations/month-4-video-production-regression-playbook-2026-04-17.md`

## Commands

This replay used:

```bash
pnpm build
pnpm exec vitest run src/entrypoints/content/video-platforms/video-platforms.test.ts
CI=true pnpm bench:live -- --scenario bench-live/youtube-subtitle-basic
CI=true pnpm bench:live -- --scenario bench-live/bilibili-subtitle-basic
```

## Results

| Scenario | Pass | Run ID | Notes |
|----------|------|--------|-------|
| `bench-live/youtube-subtitle-basic` | **pass** | `live-20260414T115407-2i2tzo` | Scenario uses **`inline:youtube-subtitle`** in a real browser and now explicitly proves duplicate suppression, pause/seek stability, and stale-track clearing when caption tracks disappear. Browser: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. |
| `bench-live/bilibili-subtitle-basic` | **pass** | `live-20260414T115722-y40ya0` | Scenario uses **`inline:bilibili-subtitle`** in a real browser and now proves DOM fallback, structured subtitle upgrade, alternate selector drift handling, and empty subtitle-state cleanup. Browser: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. |

Artifacts on a successful machine live under:

- `bench-live-results/<run-id>/result.json`
- `bench-live-results/<run-id>/result.md`

That directory is **gitignored**; reproduce locally to obtain screenshots and HTML captures.

Transient replay archaeology for this task:

- `live-20260414T115423-zjyjlb` — first Bilibili rerun failed in the smoke harness itself (`page.evaluate: ReferenceError: __name is not defined`), not in adapter runtime logic; rerun after flattening the harness passed.

## Honest scope note

These lanes validate **controlled live adapter behavior** in a fixture-shaped page. They do **not** substitute for production watch-page regression (geo, login, player experiments), which remains manual or future extended logging per plan ledger.
