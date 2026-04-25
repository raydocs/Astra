# Month 2 — Learning-loop evidence registry

_Last updated: 2026-04-15 (`M2-F-06` fresh required-lane replay + evidence sync)_

This file is the Month 2 evidence index for the learning-loop v1 work. It is the canonical answer to four separate questions:

1. **Implemented?** — is the behavior landed in-repo?
2. **Proved?** — do we have exact tests / live artifacts?
3. **Gate-ready?** — is it part of a required release gate today?
4. **Still partial / carry?** — what remains intentionally outside the gate?

## Month 2 status layers

| Layer | Status | Meaning |
|------|--------|---------|
| `implemented` | **Yes** | Popup deep-read, source-context persistence, study-progress surfacing, and revisit v1 are landed in repo. |
| `proved` | **Yes** | Unit tests + fresh browser-backed artifacts exist and are linked below. |
| `gate-ready` | **Yes** | The chained `learning-loop` lane now runs as a required live-browser gate in CI. |
| `closeout verdict` | **`pass`** | Month 2 is implemented, proved, and now release-gated in CI. |

## Fresh live evidence (exact commands + artifacts)

| Proof slice | Command | Latest green artifact(s) | Gate status today |
|---|---|---|---|
| Popup deep-read proof | `CI=true pnpm bench:live -- --scenario bench-live/popup-deep-read-proof` | `live-20260415T104021-y8rb0n` → `bench-live-results/live-20260415T104021-y8rb0n/` | **Required** via `learning-loop` |
| Vocabulary SRS smoke | `CI=true pnpm bench:live -- --scenario bench-live/vocabulary-srs-smoke` | `live-20260415T104027-zap15i` → `bench-live-results/live-20260415T104027-zap15i/` | **Required** via `extension-core` and `learning-loop` |
| Revisit v1 smoke | `CI=true pnpm bench:live -- --scenario bench-live/learning-loop-revisit-smoke` | `live-20260415T104030-y9lm8o` → `bench-live-results/live-20260415T104030-y9lm8o/` | **Required** via `learning-loop` |
| Full learning-loop chain | `CI=true pnpm bench:live:lane:learning-loop` | popup proof `live-20260415T104021-y8rb0n`, vocabulary smoke `live-20260415T104027-zap15i`, revisit smoke `live-20260415T104030-y9lm8o` | **Required** lane |

Archaeology / earlier replay note: `docs/investigations/m1-bf-01-popup-learning-loop-replay-2026-04-14.md`.

## Implementation / proof map

| Area | Implemented pointers | Proof pointers | Gate-ready today? | Notes |
|------|----------------------|----------------|-------------------|-------|
| Popup deep-read explain/save | `src/entrypoints/popup/App.tsx`, `src/entrypoints/popup/components/StudySection.tsx`, `docs/investigations/popup-deep-read-state-mapping.md` | `src/entrypoints/popup/App.test.tsx`, `bench-live/popup-deep-read-proof`, artifact `live-20260415T104021-y8rb0n` | **Yes** | Covered directly by the required `learning-loop` lane. |
| Vocabulary / review surfaces | `src/entrypoints/vocabulary/VocabularyApp.tsx`, `src/entrypoints/vocabulary/ReviewMode.tsx` | `src/entrypoints/vocabulary/VocabularyApp.test.tsx`, `src/entrypoints/vocabulary/ReviewMode.test.tsx`, `bench-live/vocabulary-srs-smoke`, artifact `live-20260415T104027-zap15i` | **Yes** | Vocabulary smoke stays required through `extension-core`, and the full chain is also required through `learning-loop`. |
| Source-context propagation | `src/utils/storage/vocabulary-core.ts`, popup save path, vocab/review renderers | `src/utils/storage/vocabulary.test.ts`, `VocabularyApp.test.tsx`, `ReviewMode.test.tsx` | **Yes** | Proved by focused tests and indirectly exercised through the required popup proof chain. |
| Study-progress rules / counters | `src/utils/storage/study-progress.ts` | `src/utils/storage/study-progress.test.ts`, `docs/investigations/study-progress-counting-rules-2026-04-14.md`, `docs/investigations/study-progress-ui-consistency-2026-04-14.md` | **Yes** | Shared model stays test-backed; next-step visibility is now part of the required revisit proof. |
| Revisit v1 path | `src/utils/storage/reading-history.ts`, `src/utils/storage/owned-reading.ts`, `src/entrypoints/vocabulary/VocabularyApp.tsx`, `docs/investigations/learning-loop-navigation-matrix-2026-04-14.md` | `src/utils/storage/owned-reading.test.ts`, `VocabularyApp.test.tsx`, `bench-live/learning-loop-revisit-smoke`, artifact `live-20260415T104030-y9lm8o` | **Yes** | Canonical Month 2 revisit path is required through the `learning-loop` lane. |
| Month 2 evidence / policy sync | `docs/investigations/month-2-closeout-2026-04-14.md`, this registry, `docs/release-readiness-checklist.md`, `plan.md` Month 2 scoreboard note | Linked docs + fresh run ids above | **Yes** | Docs and CI policy now agree on required-lane status. |

## What remains out of scope

No primary Month 2 release-policy carry remains for the learning-loop lane itself.

Future work can still extend the learning loop product surface, but the Week 2/3/4 baseline is now implemented, proved, and required in CI.

## Pointers

- Closeout summary: `docs/investigations/month-2-closeout-2026-04-14.md`
- Release policy: `docs/release-readiness-checklist.md`
- Status impact / over-claim boundary: `docs/investigations/learning-loop-claim-impact-2026-04-14.md`
- Supported revisit contract: `docs/investigations/learning-loop-navigation-matrix-2026-04-14.md`
- Month 1 replay note used as baseline / archaeology: `docs/investigations/m1-bf-01-popup-learning-loop-replay-2026-04-14.md`
