# Month 2 — Learning-loop evidence registry (supplement)

_Last updated: 2026-04-14_

This file **supplements** `docs/investigations/month-2-closeout-2026-04-14.md` per task **`M2-F-05`** in `claude-sequential-task-pack-2026-04-14.md`.

## What is proved vs implemented

| Area | Implemented | Proved (replay / CI) | Notes |
|------|-------------|----------------------|-------|
| Popup deep-read explain/save | Yes (`src/entrypoints/popup/App.tsx`, `StudySection`) | **Optional** `pnpm bench:live:lane:popup-proof` | Contract / states: `popup-deep-read-state-mapping.md`. Bench harness fixes 2026-04-14: relay-only seeding + safer popup DOM wait — rerun for fresh `run-id`. |
| Vocabulary / review surfaces | Yes | `extension-core` includes `bench-live/vocabulary-srs-smoke` | Required CI lane. |
| Chained learning-loop lane | Script exists | **Optional** full chain | `popup-proof` + `vocabulary-srs-smoke` + `learning-loop-revisit-smoke`; not Gate 2 until policy + green replay discipline. |
| Source metadata in vocab/review | Yes | Unit tests + manual | Selection/hover now persist `sourceContext`; subtitle reader adds `subtitle_reader` saves (see `vocabulary-core.ts`). |
| Study progress counters / ordering | Yes | Unit tests + docs | `study-progress-counting-rules-2026-04-14.md` |
| Revisit (open source) | Yes (Reading queue + list button) | **Optional** `bench-live/learning-loop-revisit-smoke` (also in `learning-loop` lane) | Matrix: `learning-loop-navigation-matrix-2026-04-14.md`. |

## Task pack traceability (Phase 1–2)

Sequential pack `claude-sequential-task-pack-2026-04-14.md` through **`M2-F-05`**: see the table in `month-2-closeout-2026-04-14.md` § **Task pack traceability**.

## Release policy pointer

`docs/release-readiness-checklist.md` — Month 2 subsection: optional `learning-loop` until flaky ownership matches `extension-core` and a green replay is attached per RC.
