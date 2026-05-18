# Learning metrics (Month 2 definition)

_Last updated: 2026-04-15 (`M2-F-06` fresh required-lane replay + evidence sync)_

Ledger item **Month 2 AI Task Ledger #33** — minimal operator-facing definitions. Counts are **best-effort client-side** unless synced via relay.

## Counters

| Metric | Definition | Primary storage |
|--------|------------|-----------------|
| `sentencesExplained` | Increment when sentence explain succeeds (`recordStudyEvent`) | `StudyPageProgress.sentencesExplained` + `dailyStats.sentencesExplained` in `study-progress.ts` |
| `vocabSaved` | Vocabulary save persisted from the page loop | `StudyPageProgress.vocabSaved` + `dailyStats.vocabSaved` |
| `vocabReviewed` | Review grading tied back to a page (`vocab_review`) | `StudyPageProgress.vocabReviewed` + `dailyStats.vocabReviewed` |
| `pagesStudied` | Distinct pages with at least one qualifying study event that day | `dailyStats.pagesStudied` |

## Progress model

- **Page-level loop** — canonical ordered steps: `read → guided_read → explain → vocab_save → vocab_review`.
- **Ordering rule** — UI must use `orderStudySteps()` / page-summary helpers so surfaces do not invent their own order.
- **Revisit next-step rule** — revisit should point **forward from the furthest durable completed step**, not force users backward to an earlier skipped step.
- **Daily aggregate** — useful for operator visibility, but not a substitute for page-level loop proof.

## Quality / gate metrics

| Metric | Target |
|--------|--------|
| Popup proof green | `bench-live/popup-deep-read-proof` green with artifact path |
| Vocabulary smoke green | `bench-live/vocabulary-srs-smoke` green with artifact path |
| Revisit smoke green | `bench-live/learning-loop-revisit-smoke` green with artifact path |
| Full `learning-loop` lane green | Fresh required chain proving popup → vocab → revisit continuity |
| Regression checklist | All **P0** rows in `learning-loop-regression-checklist-2026-04-13.md` |

## Current fresh evidence snapshot

- popup proof: `bench-live-results/live-20260415T104021-y8rb0n/`
- vocabulary smoke: `bench-live-results/live-20260415T104027-zap15i/`
- revisit smoke: `bench-live-results/live-20260415T104030-y9lm8o/`

## Gate interpretation

A green `learning-loop` lane is both **proof** and a required `CI / live-browser` gate.

Month 2 is now **proved and gate-ready** for the learning-loop lane, provided those three linked artifacts stay fresh for the RC / closeout window.

## Freshness rule

Re-run `CI=true pnpm bench:live:lane:learning-loop` before an RC or closeout refresh and attach the new run ids in:

- `month-2-evidence-registry-2026-04-14.md`
- `month-2-closeout-2026-04-14.md`
