# Month 2 — Learning-loop evidence registry

_Last updated: 2026-04-14 (`M2-F-05` evidence sync)_

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
| `gate-ready` | **No** | The chained `learning-loop` lane is still **optional**, not a required Gate 2 lane in CI. |
| `closeout verdict` | **`pass-with-carry`** | Month 2 is real and documented, but still carries one release-policy / CI-discipline blocker. |

## Fresh live evidence (exact commands + artifacts)

| Proof slice | Command | Latest green artifact(s) | Gate status today |
|---|---|---|---|
| Popup deep-read proof | `CI=true pnpm bench:live -- --scenario bench-live/popup-deep-read-proof` | `live-20260414T105144-ub96nh` → `bench-live-results/live-20260414T105144-ub96nh/` | **Optional** proof |
| Vocabulary SRS smoke | `CI=true pnpm bench:live -- --scenario bench-live/vocabulary-srs-smoke` | `live-20260414T105149-vaksxe` → `bench-live-results/live-20260414T105149-vaksxe/` | **Required** via `extension-core` |
| Revisit v1 smoke | `CI=true pnpm bench:live -- --scenario bench-live/learning-loop-revisit-smoke` | `live-20260414T105152-9boxuy` → `bench-live-results/live-20260414T105152-9boxuy/` | **Optional** proof |
| Full learning-loop chain | `CI=true pnpm bench:live:lane:learning-loop` | popup proof `live-20260414T105144-ub96nh`, vocabulary smoke `live-20260414T105149-vaksxe`, revisit smoke `live-20260414T105152-9boxuy` | **Optional** lane |

Archaeology / earlier replay note: `docs/investigations/m1-bf-01-popup-learning-loop-replay-2026-04-14.md`.

## Implementation / proof map

| Area | Implemented pointers | Proof pointers | Gate-ready today? | Notes |
|------|----------------------|----------------|-------------------|-------|
| Popup deep-read explain/save | `src/entrypoints/popup/App.tsx`, `src/entrypoints/popup/components/StudySection.tsx`, `docs/investigations/popup-deep-read-state-mapping.md` | `src/entrypoints/popup/App.test.tsx`, `bench-live/popup-deep-read-proof`, artifact `live-20260414T105144-ub96nh` | **No** | Real and replayable, but still outside required live gates. |
| Vocabulary / review surfaces | `src/entrypoints/vocabulary/VocabularyApp.tsx`, `src/entrypoints/vocabulary/ReviewMode.tsx` | `src/entrypoints/vocabulary/VocabularyApp.test.tsx`, `src/entrypoints/vocabulary/ReviewMode.test.tsx`, `bench-live/vocabulary-srs-smoke`, artifact `live-20260414T105149-vaksxe` | **Partly** | Vocabulary smoke is already in required `extension-core`; the full learning-loop chain is not. |
| Source-context propagation | `src/utils/storage/vocabulary-core.ts`, popup save path, vocab/review renderers | `src/utils/storage/vocabulary.test.ts`, `VocabularyApp.test.tsx`, `ReviewMode.test.tsx` | **No** | Proved through tests and the popup proof artifact, but not separately gated. |
| Study-progress rules / counters | `src/utils/storage/study-progress.ts` | `src/utils/storage/study-progress.test.ts`, `docs/investigations/study-progress-counting-rules-2026-04-14.md`, `docs/investigations/study-progress-ui-consistency-2026-04-14.md` | **No** | Shared model is documented and tested; surface proof comes through popup/review/revisit artifacts. |
| Revisit v1 path | `src/utils/storage/reading-history.ts`, `src/utils/storage/owned-reading.ts`, `src/entrypoints/vocabulary/VocabularyApp.tsx`, `docs/investigations/learning-loop-navigation-matrix-2026-04-14.md` | `src/utils/storage/owned-reading.test.ts`, `VocabularyApp.test.tsx`, `bench-live/learning-loop-revisit-smoke`, artifact `live-20260414T105152-9boxuy` | **No** | Canonical Month 2 revisit path is **Vocabulary → Reading → Open** for article rows. |
| Month 2 evidence / policy sync | `docs/investigations/month-2-closeout-2026-04-14.md`, this registry, `docs/release-readiness-checklist.md`, `plan.md` Month 2 scoreboard note | Linked docs + fresh run ids above | **No** | This work makes the evidence honest; it does not promote the lane into Gate 2. |

## What remains carry, not product work

Only one primary carry remains for Month 2:

- **Release-gate promotion / CI discipline** for `pnpm bench:live:lane:learning-loop`.
  - The lane is credible and fresh.
  - It is **not yet** a required release gate.
  - Promotion requires the same flaky-ownership / CI discipline standard used for required live lanes.

## Pointers

- Closeout summary: `docs/investigations/month-2-closeout-2026-04-14.md`
- Release policy: `docs/release-readiness-checklist.md`
- Status impact / over-claim boundary: `docs/investigations/learning-loop-claim-impact-2026-04-14.md`
- Supported revisit contract: `docs/investigations/learning-loop-navigation-matrix-2026-04-14.md`
- Month 1 replay note used as baseline / archaeology: `docs/investigations/m1-bf-01-popup-learning-loop-replay-2026-04-14.md`
