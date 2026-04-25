# Month 2 Closeout — Learning Loop V1

_Last updated: 2026-04-15 (`M2-F-06` fresh required-lane replay + closeout sync)_

Month: **Month 2 — Finish Learning-Loop V1** (`plan.md` §11)  
Verdict: **`pass`**

## Status layers (read this first)

| Layer | Status | Why |
|-----|--------|-----|
| `implemented` | **Yes** | Popup deep-read, source-context persistence, study-progress surfacing, and revisit v1 all landed in repo. |
| `proved` | **Yes** | Fresh green browser-backed artifacts exist for popup proof, vocabulary smoke, and revisit smoke. |
| `gate-ready` | **Yes** | The chained `learning-loop` lane now runs as a required live-browser gate in CI. |
| `carry` | **0 primary** | The earlier CI / release-gate promotion carry is now closed. |

This is why the verdict is now **`pass`** rather than `pass-with-carry`.

## Evidence registry (`13O` / §11)

| Row | Status | Pointer |
|-----|--------|---------|
| `live` | **Green (fresh 2026-04-15 required-lane artifact set)** | `CI=true pnpm bench:live:lane:learning-loop` → popup proof `live-20260415T104021-y8rb0n`, vocabulary smoke `live-20260415T104027-zap15i`, revisit smoke `live-20260415T104030-y9lm8o` under `bench-live-results/<run-id>/`. |
| `docs` | **Yes** | `learning-loop-overview-2026-04-13.md`, `learning-metrics-2026-04-13.md`, `learning-loop-regression-checklist-2026-04-13.md`, `learning-loop-navigation-matrix-2026-04-14.md`, `learning-loop-claim-impact-2026-04-14.md`, `popup-deep-read-state-mapping.md`, `study-progress-counting-rules-2026-04-14.md`, `study-progress-ui-consistency-2026-04-14.md`, `month-2-evidence-registry-2026-04-14.md` |
| `release-policy` | **Yes** | `docs/release-readiness-checklist.md` — Month 2 section now reflects `learning-loop` as a required live-browser gate. |
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

## Carry-over

- No primary Month 2 release-policy carry remains for the learning-loop lane.
- Further learning-loop work now falls into product expansion, not evidence/policy closure.

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
| `M2-F-06` | fresh required-lane rerun `live-20260415T104021-y8rb0n` / `live-20260415T104027-zap15i` / `live-20260415T104030-y9lm8o`, plus docs sync in the learning-loop overview / metrics / navigation / release-policy files |

## Git change artifact (full path inventory)

- `docs/investigations/month-2-change-artifact-2026-04-14.md`

## Harness

- Deterministic harness: `pnpm bench` → **63/63**, avg **100** (`bench-results/latest.json`)
- Live learning-loop chain (fresh required-lane run):
  - popup proof: `bench-live-results/live-20260415T104021-y8rb0n/`
  - vocabulary smoke: `bench-live-results/live-20260415T104027-zap15i/`
  - revisit smoke: `bench-live-results/live-20260415T104030-y9lm8o/`

## Bottom line

Month 2 is now **implemented, proved, and release-gated with fresh evidence**, and the docs now match that status without over-claiming.
