# M1-BF-01 — Popup proof + learning-loop replay (2026-04-14)

_Task: `M1-BF-01` from `docs/investigations/claude-sequential-task-pack-2026-04-14.md`_

## Preconditions (this run)

- Extension build: `pnpm build` (output `.output/chrome-mv3`)
- Browser: `npx playwright install chromium` (Playwright Chromium used by bench-live driver)
- Environment: `CI=true` (matches CI live-browser semantics)
- Display: `xvfb-run -a` (headless Linux VM)

## Commands executed

1. `pnpm bench:live:lane:popup-proof`  
   → `pnpm bench:live -- --scenario bench-live/popup-deep-read-proof`

2. `pnpm bench:live:lane:learning-loop`  
   → same as (1), then `pnpm bench:live -- --scenario bench-live/vocabulary-srs-smoke`  
   **Note:** step (1) failed, so the chained lane **did not** reach `bench-live/vocabulary-srs-smoke` in this replay.

## Canonical scenario IDs (unchanged)

| Lane | `package.json` script | Scenarios |
|------|----------------------|-----------|
| `popup-proof` | `pnpm bench:live:lane:popup-proof` | `bench-live/popup-deep-read-proof` |
| `learning-loop` | `pnpm bench:live:lane:learning-loop` | `bench-live/popup-deep-read-proof`, then `bench-live/vocabulary-srs-smoke` |

## Run result (not green)

| Item | Value |
|------|--------|
| Run ID | `live-20260414T061146-0odzcd` |
| Scenario | `bench-live/popup-deep-read-proof` |
| Status | **fail** |
| Primary error | `page.waitForFunction: Timeout 25000ms exceeded.` (see `popup-deep-read-proof.ts` stack in `result.json`) |
| Wall clock (runtime) | started `2026-04-14T06:11:46.645Z`, finished `2026-04-14T06:12:14.545Z` |

### Artifact paths (local, after run)

Artifacts live under `bench-live-results/` (gitignored). For this run:

- Directory: `bench-live-results/live-20260414T061146-0odzcd/`
- Structured outputs: `result.json`, `result.md`
- Symlinks updated: `bench-live-results/latest.result.json`, `bench-live-results/latest.result.md`

Re-run the lane locally to regenerate files; this note is the in-repo anchor for **what** was run and **which** `run-id` produced the attached structured result on the machine that executed M1-BF-01.

## Interpretation

- This is a **fresh** replay summary with a **precise failure report**, not a skipped run and not a green pass.
- Month 1 optional popup / learning-loop narrative must treat this as **current negative evidence** until a subsequent green replay is recorded (see next task pack item: `M2-B-01`).
