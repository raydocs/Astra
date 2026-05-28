# Minimal Learning Dashboard Checklist — 2026-05-27

## Scope

Add a local-only M2/M3 learning dashboard slice so Astra can inspect whether the save → review → Library/source-return loop is producing measurable learning activity without introducing content telemetry.

## Implemented

- `aggregateLearningLoopLearningDashboard()` in `src/utils/learning-loop-events.ts` aggregates metadata-only learning events:
  - saves: `saved_snippet_created`, `sentence_saved`;
  - review activity: `review_opened`, `review_answered`, `review_session_completed`;
  - Library/source continuity: `library_opened`, `return_to_source_clicked`, `returned_to_source`, `continue_clicked`, `resumed_reading`.
- Options Diagnostics renders a compact `Learning dashboard` card with:
  - saved learning asset count;
  - explicit review-card proxy rate;
  - review completion rate;
  - Library opens, source returns, and continue actions;
  - active learning days over the local 28-day retained window;
  - saved source mix from coarse `sourceType` / `source` metadata.
- Tests cover both the pure aggregator and the Diagnostics rendering path.

## Privacy boundary

The dashboard uses event names, timestamps, coarse source categories, explicit review-card presence, and aggregate counts only. It must not display or require page text, selected text, saved snippets, transcript text, prompt text, model output, emails, screenshots, or full URL paths.

## Conservative metric choices

- `reviewableCardProxyRate` counts only save events with explicit `hasReviewCard: true`.
- `reviewCompletionRate` is bounded by review opens so repeated completion events cannot exceed 100%.
- `savedBySourceType` displays only allowlisted coarse source categories and treats missing, unknown, URL-like, email-like, long, or path-like values as `unknown`.

## Deferred

- Production `reviewable_card_rate` runtime query across persisted review cards.
- Weekly active learner cohorts and cross-device learning analytics.
- Per-user or server-side cohort dashboards.
- Rich source-management analytics beyond coarse source-type mix.
