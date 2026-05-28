# Minimal Retention Dashboard Checklist — 2026-05-27

Source plan: `docs/plans/astra-zero-config-saas-operating-model-2026-05-27.md`, Section 34 metrics dashboard requirement and M5 Digest + Retention OKRs.

## Scope

This slice makes a V0 local retention dashboard visible from Options Diagnostics without adding cohort tracking, remote analytics, notifications, email delivery, or a production staff console.

## Implemented

- `src/utils/learning-loop-events.ts`
  - Adds `LearningLoopRetentionEventName` and `LEARNING_LOOP_RETENTION_EVENT_NAMES` for review, source-return, Digest, reminder, win-back, Pro repeat-value, and cancellation value-risk signals.
  - Adds `aggregateLearningLoopRetentionDashboard()` for local metadata-only retention visibility:
    - active learning days in the latest 28-day retained local window;
    - active learning weeks in the latest four rolling 7-day buckets of the retained local window;
    - review opened/answered/completed counts and completion rate;
    - source-return / continue counts;
    - Digest viewed/opened counts and Digest-to-review/continue follow-through;
    - reminder dismiss/disable and win-back counts;
    - Pro repeat-value count;
    - cancellation value-risk reason count.
- `src/entrypoints/options/OptionsApp.tsx`
  - Adds a local `Retention dashboard` Diagnostics card below the activation dashboard.
  - Labels the card as local V0 metadata-only visibility, not a production cohort dashboard.
- Tests cover the helper aggregation and Options rendering.

## Privacy boundary

The dashboard uses event names, timestamps, normalized cancellation reasons, and aggregate counts only. It does **not** display page text, saved snippets, transcripts, prompts, model output, emails, or full URL paths.

## Operating-model coverage

- Section 34 `activation / learning / retention` dashboard progression: moves retention from policy-only/deferred dashboard state to local V0 dashboard visibility.
- M5 `Digest + Retention`: Digest view/open and Digest follow-through are visible locally.
- M5 `4-week retention`: represented as local active learning days plus active rolling 7-day buckets over the latest retained 28-day event window; production cohort retention remains deferred.
- M5 `Pro repeat feature usage`: Pro repeat-value signal count is visible locally.
- M5 cancellation reason trend: local value-risk cancellation reason count is visible; production trend/cohort analysis remains deferred.

## Deferred

- Cohort-level retention dashboard UI.
- Remote event pipeline / warehouse queries.
- Notification scheduler, email digest delivery, unsubscribe backend, win-back lifecycle automation.
- Production trend charts or user-level drilldowns.

## Validation

Planned command set for this slice:

```bash
pnpm test src/utils/learning-loop-events.test.ts src/entrypoints/options/OptionsApp.test.tsx
pnpm type-check
pnpm check:repo-knowledge
```
