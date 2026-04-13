# Learning metrics (Month 2 definition)

_Last updated: 2026-04-13_

Ledger item **Month 2 AI Task Ledger #33** — minimal operator-facing definitions. Counts are **best-effort client-side** unless synced via relay.

## Counters

| Metric | Definition | Primary storage |
|--------|------------|-----------------|
| `sentencesExplained` | Increment when sentence explain succeeds (`recordStudyEvent`) | `StudyPageProgress.sentencesExplained` + `dailyStats.sentencesExplained` in `study-progress.ts` |
| `vocabSaved` | New vocabulary entry persisted from popup or content | `StudyPageProgress.vocabSaved` + `dailyStats.vocabSaved` |
| `vocabReviewed` | User completed vocabulary review tied to the loop (`vocab_review` step) | `dailyStats.vocabReviewed` + `completedSteps` |
| `pagesStudied` | Distinct pages with at least one study activity today | `dailyStats.pagesStudied` |

## Progress model

- **Page-level loop** — Ordered steps from `deriveStudyLoopViewModel` (read → explain → save → review); shown in popup `StudySection`.
- **Daily aggregate** — Optional future: not required for Month 2 gate; use existing `translation-usage` / quota surfaces for API-backed daily limits.

## Quality / gate metrics

| Metric | Target |
|--------|--------|
| `learning-loop` lane green | `popup-deep-read-proof` then `vocabulary-srs-smoke` complete without driver fatal |
| Regression checklist | All **P0** rows in `learning-loop-regression-checklist-2026-04-13.md` |

## Freshness

- Re-run `pnpm bench:live:lane:learning-loop` before release candidate; attach run id to closeout memo.
