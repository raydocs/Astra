# Month 4 video smoke replay (bench-live)

**Date:** 2026-04-14 (agent VM, branch `cursor/sequential-task-pack-phase2-abbb`)

**Production www regression (manual):** `docs/investigations/month-4-video-production-regression-playbook-2026-04-17.md`

## Commands

Both runs used:

```bash
pnpm build
npx playwright install chromium
```

Then, with a 300000 ms outer `timeout` and `CI=true`:

```bash
timeout 300000 env CI=true xvfb-run -a pnpm bench:live -- --scenario bench-live/youtube-subtitle-basic
timeout 300000 env CI=true xvfb-run -a pnpm bench:live -- --scenario bench-live/bilibili-subtitle-basic
```

## Results

| Scenario | Pass | Run ID | Notes |
|----------|------|--------|-------|
| `bench-live/youtube-subtitle-basic` | **pass** | `live-20260414T081145-lidrj6` | Scenario uses **`inline:youtube-subtitle`** (fixture-equivalent page in Chrome), not production YouTube. Browser: `/usr/bin/google-chrome`. |
| `bench-live/bilibili-subtitle-basic` | **pass** | `live-20260414T081212-xj3i3f` | Scenario uses **`inline:bilibili-subtitle`** (Bilibili-shaped fixture), not www.bilibili.com. |

Artifacts on a successful machine live under:

- `bench-live-results/<run-id>/result.json`
- `bench-live-results/<run-id>/result.md`

That directory is **gitignored**; reproduce locally to obtain screenshots and HTML captures.

## Honest scope note

These lanes validate **adapter skeleton / wiring** in a controlled page. They do **not** substitute for production watch-page regression (geo, login, player experiments), which remains manual or future extended logging per plan ledger.
