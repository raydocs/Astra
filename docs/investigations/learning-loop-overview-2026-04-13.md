# Learning loop overview (Month 2 baseline)

_Last updated: 2026-04-13_

This document satisfies **§11 Month 2** “learning-loop overview (or equivalent single page)” and anchors the **Month 2 AI Task Ledger** evidence pack.

## What “learning loop” means in-repo

1. **Read** — Page/article context in the extension; popup **Study** / deep-read uses page digest + sentence deck (`StudySection`, `App.tsx`).
2. **Explain** — Sentence explain + selection explain paths; provider via managed relay.
3. **Save** — Vocabulary entries with source context (`vocabulary-core`, popup save flows).
4. **Review** — SRS review in `ReviewMode` / `VocabularyApp` “review” tab.
5. **Revisit** — Reading history + study progress events (`study-progress.ts`, reading history storage).

## Proof surfaces (browser-backed)

| Layer | Command / artifact |
|--------|---------------------|
| Popup deep-read | `pnpm bench:live:lane:popup-proof` → `bench-live/popup-deep-read-proof` |
| Vocabulary SRS | `bench-live/vocabulary-srs-smoke` (also in `extension-core` lane) |
| Chained learning loop | `pnpm bench:live:lane:learning-loop` (`package.json`) |

Artifact root when running live driver: `bench-live-results/<run-id>/` (see `workstream-f-live-lane-conventions.md`).

## Source-context and progress fields

- **Vocabulary**: `url`, title/snippet where stored — see `vocabulary-core` schema and `ReviewMode` display props.
- **Study progress**: `recordStudyEvent`, `getStudyProgress`, `deriveStudyLoopViewModel` in `src/utils/storage/study-progress.ts` — events drive popup study bar.
- **Review tab (Month 2)**: `ReviewMode` shows the same **today** `dailyStats` row as the popup (pages studied, sentences explained, vocab saved, vocab reviewed), so SRS review and the study loop share one visible progress surface.

## Required vs optional gates

- **Required CI today**: `source-core`, `extension-core` (includes `vocabulary-srs-smoke`); see `docs/release-readiness-checklist.md`.
- **Named `learning-loop` lane**: optional / manual unless CI is extended — see coverage matrix `### learning-loop`.

## Links

- `docs/investigations/workstream-a-live-coverage-matrix.md` — `learning-loop` section
- `docs/investigations/popup-deep-read-state-mapping.md`
- `docs/investigations/learning-loop-regression-checklist-2026-04-13.md`
- `docs/investigations/learning-metrics-2026-04-13.md`
- `docs/investigations/learning-loop-navigation-matrix-2026-04-14.md`
- `docs/investigations/learning-loop-claim-impact-2026-04-14.md`
- `docs/investigations/month-2-closeout-2026-04-14.md`
- `docs/investigations/sentence-pin-presearch-2026-04-14.md`
