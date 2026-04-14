# Month 2 Closeout — Learning Loop V1

_Last updated: 2026-04-14 (`M2-F-05` evidence registry + closeout sync)_

Month: **Month 2 — Finish Learning-Loop V1** (`plan.md` §11)  
Verdict: **`pass-with-carry`**

## Status layers (read this first)

| Layer | Status | Why |
|-----|--------|-----|
| `implemented` | **Yes** | Popup deep-read, source-context persistence, study-progress surfacing, and revisit v1 all landed in repo. |
| `proved` | **Yes** | Fresh green browser-backed artifacts exist for popup proof, vocabulary smoke, and revisit smoke. |
| `gate-ready` | **No** | The chained `learning-loop` lane is still **optional** in CI / release policy. |
| `carry` | **1 primary** | CI / release-gate promotion for `learning-loop` remains the only Month 2 carry item. |

This is why the verdict remains **`pass-with-carry`**, not full `pass` and not `partial`.

## Evidence registry (`13O` / §11)

| Row | Status | Pointer |
|-----|--------|---------|
| `live` | **Green (fresh 2026-04-14 M2 artifact set)** | `CI=true pnpm bench:live:lane:learning-loop` → popup proof `live-20260414T105144-ub96nh`, vocabulary smoke `live-20260414T105149-vaksxe`, revisit smoke `live-20260414T105152-9boxuy` under `bench-live-results/<run-id>/`. First same-session flake for archaeology: `live-20260414T105047-360uqz`. |
| `docs` | **Yes** | `learning-loop-overview-2026-04-13.md`, `learning-metrics-2026-04-13.md`, `learning-loop-regression-checklist-2026-04-13.md`, `learning-loop-navigation-matrix-2026-04-14.md`, `learning-loop-claim-impact-2026-04-14.md`, `popup-deep-read-state-mapping.md`, `study-progress-counting-rules-2026-04-14.md`, `study-progress-ui-consistency-2026-04-14.md`, `month-2-evidence-registry-2026-04-14.md` |
| `release-policy` | **Yes** | `docs/release-readiness-checklist.md` — Month 2 section explicitly keeps `learning-loop` **optional** even after fresh green replays. |
| `claim-impact` | **Yes** | `learning-loop-claim-impact-2026-04-14.md` — says what can be claimed, and what must remain optional / non-gated. |
| `tests` | **Yes** | `src/entrypoints/popup/App.test.tsx`, `src/entrypoints/vocabulary/VocabularyApp.test.tsx`, `src/entrypoints/vocabulary/ReviewMode.test.tsx`, `src/utils/storage/vocabulary.test.ts`, `src/utils/storage/study-progress.test.ts`, `src/utils/storage/owned-reading.test.ts` |

For the detailed matrix of implemented / proved / gate-ready / carry, use: `docs/investigations/month-2-evidence-registry-2026-04-14.md`.

## P0 ledger — completion notes

- **A (popup)**: popup deep-read state model is explicit and replayed via `bench-live/popup-deep-read-proof`.
- **B (vocab/review)**: vocab/review now render stable source metadata and shared progress semantics clearly enough to trace saved content without guessing.
- **C (progress)**: counting rules, ordering, and next-step semantics are documented; popup and downstream surfaces no longer contradict the core progress model.
- **D (revisit)**: the canonical Month 2 revisit path is now **Vocabulary → Reading tab → article row → Open** with visible page identity, translated count, ordered study steps, counts, and a next-step hint; popup recent-history reopen remains a convenience path, not the canonical replayed contract.
- **E (QA / evidence)**: Month 2 now has a real evidence registry, explicit claim boundaries, a regression checklist, and exact live artifact pointers.

## P1 ledger — minimum bar (≥10)

Counted toward the Month 2 bar: matrix / known issues / UX debt / resume hints / long-context handling / review source links / search by source context / step ordering / revisit contract docs / replay artifact linking. The closeout and registry now make those support items visible as evidence rather than implied background work.

## Carry-over (1 primary, explicit)

- **Primary carry**: promote `learning-loop` from **optional** proof lane to a required release gate only after it has the same CI ownership / flaky-tracking discipline as current required live lanes.
- This is a **release-policy / operational carry**, not a new Month 2 feature gap.

## Task pack traceability (Phase 1–2, sequential pack)

Maps task IDs from `claude-sequential-task-pack-2026-04-14.md` to primary in-repo evidence.

| Task ID | Primary pointers |
|---------|------------------|
| `M1-BF-01` | `m1-bf-01-popup-learning-loop-replay-2026-04-14.md`, `month-1-closeout-2026-04-13.md` |
| `M2-B-01` | `popup-deep-read-state-mapping.md`, popup proof artifact family (`bench-live/popup-deep-read-proof`) |
| `M2-B-02` | vocab / review `sourceContext` tests and renderers; `learning-loop-navigation-matrix-2026-04-14.md` |
| `M2-BH-03` | `study-progress-counting-rules-2026-04-14.md`, `study-progress-ui-consistency-2026-04-14.md`, `study-progress.test.ts` |
| `M2-B-04` | `learning-loop-navigation-matrix-2026-04-14.md`, `bench-live/learning-loop-revisit-smoke`, artifact `live-20260414T105152-9boxuy` |
| `M2-F-05` | `month-2-evidence-registry-2026-04-14.md`, this closeout, `docs/release-readiness-checklist.md`, and the Month 2 `plan.md` scoreboard note |

## Git change artifact (full path inventory)

- `docs/investigations/month-2-change-artifact-2026-04-14.md`

## Harness

- Deterministic harness: `pnpm bench` → **63/63**, avg **100** (`bench-results/latest.json`)
- Live learning-loop chain (fresh docs-attached run):
  - popup proof: `bench-live-results/live-20260414T105144-ub96nh/`
  - vocabulary smoke: `bench-live-results/live-20260414T105149-vaksxe/`
  - revisit smoke: `bench-live-results/live-20260414T105152-9boxuy/`

## Bottom line

Month 2 is now **implemented and proved with fresh evidence**, and the docs make that visible without over-claiming.
Month 2 is **not yet gate-ready as a required release lane**, so the official verdict remains **`pass-with-carry`**.
