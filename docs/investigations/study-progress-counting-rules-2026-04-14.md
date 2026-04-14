# Study progress — counting rules and ordering (Month 2)

_Task pack: **M2-BH-03** — single source of truth_

## Source of truth

Implementation: `src/utils/storage/study-progress.ts`  
Canonical step order: `STUDY_STEPS_ORDER` → `orderStudySteps()` for UI.

## Pipeline steps (`completedSteps`)

| Step | When it is recorded | Notes |
|------|---------------------|-------|
| `read` | User activity marks page read in the loop | Counts toward **pages studied** daily when first qualifying step fires |
| `guided_read` | Guided article read | Same “first step” family as `read` for daily **pages studied** |
| `explain` | At least one sentence explained | `count` increments **sentences explained** (daily + per-page) |
| `vocab_save` | Word saved to vocabulary from the page | `count` increments **words saved** (daily + per-page) |
| `vocab_review` | Review session graded cards linked to that page | Increments **reviews graded** daily |

## Ordering rule

`completedSteps` is stored as a set membership list; **UI must use** `orderStudySteps(steps)` so the bar / hints always show `read → guided_read → explain → vocab_save → vocab_review` regardless of arrival order.

## Daily stats reset

`dailyStats.date` is a local calendar `YYYY-MM-DD`. When the date changes, counters reset to zero for the new day (see `ensureDailyStats`).

## Cross-surface consistency (popup ↔ vocabulary ↔ review)

All three surfaces read the **same** `astra.study_progress.v1` store:

- Popup: `StudySection` today counts + progress bar (`deriveStudyLoopViewModel` / `getStudyProgress`).
- Vocabulary list: today counts banner (same four counters + same date hint).
- Review: today counts banner above the session (`getStudyProgress`).

If numbers disagree, treat it as a **bug** (duplicate store or missed refresh), not a second dialect.
