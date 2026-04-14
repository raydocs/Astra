# Learning loop overview (Month 2 baseline)

_Last updated: 2026-04-14 (`M2-F-05` evidence sync)_

This document satisfies **§11 Month 2** “learning-loop overview (or equivalent single page)” and anchors the Month 2 evidence pack.

## What “learning loop” means in-repo

1. **Read** — Page/article context in the extension; popup **Study** / deep-read uses page digest + sentence deck (`StudySection`, `App.tsx`).
2. **Explain** — Sentence explain paths via the managed relay.
3. **Save** — Vocabulary entries persist stable source context.
4. **Review** — SRS review in `ReviewMode` / `VocabularyApp` “review” tab.
5. **Revisit** — Reopen the same article with enough preserved source/progress context to continue intentionally.

## Current Month 2 status

| Layer | Status | Pointer |
|------|--------|---------|
| `implemented` | **Yes** | popup / vocab / review / progress / revisit code paths landed |
| `proved` | **Yes** | `month-2-evidence-registry-2026-04-14.md` |
| `gate-ready` | **No** | `learning-loop` lane is still optional in release policy |
| `closeout verdict` | **`pass-with-carry`** | `month-2-closeout-2026-04-14.md` |

## Proof surfaces (browser-backed)

| Layer | Command / artifact |
|--------|---------------------|
| Popup deep-read | `CI=true pnpm bench:live -- --scenario bench-live/popup-deep-read-proof` → `bench-live-results/live-20260414T105144-ub96nh/` |
| Vocabulary SRS | `CI=true pnpm bench:live -- --scenario bench-live/vocabulary-srs-smoke` → `bench-live-results/live-20260414T105149-vaksxe/` |
| Revisit v1 | `CI=true pnpm bench:live -- --scenario bench-live/learning-loop-revisit-smoke` → `bench-live-results/live-20260414T105152-9boxuy/` |
| Chained learning loop | `CI=true pnpm bench:live:lane:learning-loop` → same three run ids above |

Artifact root when running the live driver: `bench-live-results/<run-id>/`.

## Canonical revisit v1 path

The first supported revisit path for Month 2 is:

- **Vocabulary → Reading tab → article row → Open**

That row now shows:

- page identity (host + canonical page URL)
- reading-history translated count
- ordered study-progress steps
- explained/saved/reviewed counts
- next-step hint

Contract and boundaries: `learning-loop-navigation-matrix-2026-04-14.md`.

## Source-context and progress fields

- **Vocabulary**: stable source metadata via `sourceContext`, rendered in vocabulary and review surfaces.
- **Study progress**: `recordStudyEvent`, `getStudyProgress`, `deriveStudyLoopViewModel`, and page-summary helpers in `src/utils/storage/study-progress.ts`.
- **Review tab**: `ReviewMode` shows the same current progress store, but uses an SRS-session presentation layer; this is documented, not treated as a contradiction.

## Required vs optional gates

- **Required CI today**: `source-core`, `extension-core` (includes `bench-live/vocabulary-srs-smoke`); see `docs/release-readiness-checklist.md`.
- **Named `learning-loop` lane**: fresh and credible, but still **optional / manual** until CI ownership and gate policy are upgraded.

## Links

- `docs/investigations/month-2-evidence-registry-2026-04-14.md`
- `docs/investigations/month-2-closeout-2026-04-14.md`
- `docs/investigations/workstream-a-live-coverage-matrix.md`
- `docs/investigations/popup-deep-read-state-mapping.md`
- `docs/investigations/learning-loop-regression-checklist-2026-04-13.md`
- `docs/investigations/learning-metrics-2026-04-13.md`
- `docs/investigations/learning-loop-navigation-matrix-2026-04-14.md`
- `docs/investigations/learning-loop-claim-impact-2026-04-14.md`
- `docs/investigations/month-2-change-artifact-2026-04-14.md`
