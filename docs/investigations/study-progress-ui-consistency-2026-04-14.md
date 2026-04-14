# Study Progress UI Consistency

_Last updated: 2026-04-14_

This note defines the Month 2 study-progress contract that popup and downstream study surfaces share.

## Canonical step order

The study loop uses one fixed step order:

1. `read`
2. `guided_read`
3. `explain`
4. `vocab_save`
5. `vocab_review`

All UI surfaces should render completed steps in that order, even if events were recorded out of order.

## Page-level counters

Each page progress record now tracks these counters:

- `sentencesExplained`
- `vocabSaved`
- `vocabReviewed`

These counters are page-scoped and are the source of truth for the popup current-page progress card and the review current-page loop card.

### Counting rules

- `read`
  - marks the page as entered into the learning loop
  - does not increment a page counter
- `guided_read`
  - marks guided reading complete for the page
  - does not increment a page counter
- `explain`
  - increments `sentencesExplained` by `count` (default `1`)
- `vocab_save`
  - increments `vocabSaved` by `count` (default `1`)
- `vocab_review`
  - increments `vocabReviewed` by `count` (default `1`)

## Daily stats vs page stats

Daily stats remain aggregate across all pages for the current local calendar day:

- `pagesStudied`
- `sentencesExplained`
- `vocabSaved`
- `vocabReviewed`

Important boundary:

- `pagesStudied` increases only when the first recorded step for a page is one of:
  - `read`
  - `guided_read`
  - `explain`
  - `vocab_save`
- a review-only first event does **not** increase `pagesStudied`

## Shared UI contract

### Popup

The popup study hub shows:

- current-page progress counters (`explained`, `saved`, `reviewed`)
- canonical completed-step ordering
- one next-step hint tied to the first incomplete step
- daily aggregate stats separately below

### Review

Review mode shows the same current-page loop summary for the current card's source page:

- canonical completed-step ordering
- current-page counters
- next-step status derived from the same study-progress model as the popup

## Scope boundaries

This contract does **not** define:

- revisit reopening behavior
- owned-reading queue semantics
- SRS scheduling redesign
- dashboard-style analytics beyond the existing daily stats
