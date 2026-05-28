# Astra Metrics Dictionary

Source plan: [`docs/plans/astra-macro-product-upgrade-plan-2026-05-27.md`](../plans/astra-macro-product-upgrade-plan-2026-05-27.md), sections 11 and 34.

## North Star

**Weekly Reviewable Learning Moments (WRLM)** counts user-saved real-content moments that become reviewable or library-backed learning assets during a week.

Initial local proxy:

```text
WRLM = count(SavedSnippet where createdAt within week and (has ReviewCard or is linked to SourceContent))
```

Weighted proxy:

```text
saved_snippet_count
+ reviewed_card_count * 1.5
+ return_to_source_count * 1.2
+ mastered_card_count * 2
```

Runtime helper: `deriveWeeklyReviewableLearningMoments()` in `src/utils/storage/learning-assets.ts`.

## Event names

| Event | Purpose | Content policy |
|---|---|---|
| `extension_installed` | Activation: extension installed and first-run clock can start | Event/source only |
| `onboarding_started` | Activation: first-run setup surface opened | Event/source/variant only |
| `onboarding_completed` | Activation: first-run setup completed | Event/settings categories only; no user input text |
| `sample_started` | Activation: sample first-value path opened | Sample id/source type only |
| `first_content_understood` / `first_value_seen` | Activation: first readable result appeared | No raw page text |
| `saved_snippet_created` | Learning: user saved a reviewable snippet | No snippet text in telemetry |
| `review_opened` | Retention: user opened a review surface | Count/source type only |
| `review_session_completed` | Learning: daily review completed | Counts/duration only |
| `library_opened` | Asset value: user opened Library | Filter/source type only |
| `return_to_source_clicked` | Asset value: user followed a card/source link | Source type/hostname only |
| `continue_clicked` | Retention: user clicked a continue learning target | Source type/action outcome only |
| `digest_viewed` | Retention: user saw weekly summary | Week window and aggregate saved/reviewed/source/reviewable/topic/repeated-vocabulary/recommended-review counts only; local Library card dedupes noisy rerenders per week/card |
| `digest_opened` | Retention: user clicked the weekly digest Review CTA | Week window, aggregate counts, surface, and continue source type only; no source title/id/URL/content |
| `reminder_dismissed` | Retention: user dismissed a reminder | Reminder type/surface only |
| `reminder_disabled` | Retention: user disabled reminders or digest delivery | Reminder/control scope, surface, source type/status only; no source id/title/URL/content |
| `winback_sent` | Retention: low-frequency win-back was sent or queued | Inactivity bucket/channel only |
| `paywall_viewed` | Membership: value surface shown | Trigger/plan only |
| `trial_started` | Membership: trial became active | Plan/source only |
| `pro_value_seen` | Membership: user saw an explicit Pro-value moment | Trigger/surface only |
| `membership_activated` | Membership: account became active | Plan/category only |
| `support_report_submitted` | Support: metadata-only report submitted | Report id/category/surface only; no content |
| `known_issue_viewed` | Support: user saw a known-issue status/workaround | Issue id/status/surface only |
| `cancellation_reason_submitted` | Membership: refund/cancel reason captured | Normalized reason/plan/source only |
| `server_translation_completed` | Cost: successful managed translation decision | Counts/classes/buckets only; no request text |
| `server_translation_failed` | Quality: failed managed translation decision after capacity checks | Counts/classes/buckets/reason only; no request text |

## V0 server usage metadata

Server usage events may include these metadata-only fields:

| Field | Purpose | Content policy |
|---|---|---|
| `task` / `taskClass` | Translate/explain/custom task class | Enum only |
| `costBucket` | Cost attribution | `low` / `medium` / `high` / `long_running` |
| `latencyBucket` | Performance attribution | Bucket only |
| `cacheStatus` | Cache behavior | Bucket only |
| `fallbackReason` | Failure/degradation attribution | Enum only |
| `tier` | Free / Trial / Pro attribution | Enum only |
| `contentLengthBucket` | Coarse size attribution | Bucket only; no body text |
| `textCount` / `characterCount` | Request size attribution | Counts only |
| `providerRoute` | Internal server route health | Internal metadata; not returned in ordinary responses |
| `success` / `errorCode` | Outcome attribution | Status code/category only |

Failed decision events recorded after capacity checks use `requestCount: 0` and must not increment quota counters, recent request timestamps, or `lastRequestAt`.

## Stage OKR coverage

Runtime catalog: `LEARNING_LOOP_STAGE_OKR_METRICS` in `src/utils/learning-loop-events.ts`.

Local V0 activation dashboard: `aggregateLearningLoopActivationDashboard()` in `src/utils/learning-loop-events.ts`, rendered in Options Diagnostics. It reports onboarding completion, first-value P50 seconds, first-save rate, first-review completion, trial starts, and Pro-value visibility from local event metadata only. First value/save/review rates count at most one matching event per activation start in the first 10-minute window.

Local V0 learning dashboard: `aggregateLearningLoopLearningDashboard()` in `src/utils/learning-loop-events.ts`, rendered in Options Diagnostics. It reports saves, explicit review-card proxy rate, review completion, Library opens, source return, continue actions, active learning days, and allowlisted saved source mix from local event metadata only. The reviewable-card proxy is intentionally conservative: it counts only save events that explicitly set `hasReviewCard: true`; production `reviewable_card_rate` remains a runtime aggregate query.

Local V0 retention dashboard: `aggregateLearningLoopRetentionDashboard()` in `src/utils/learning-loop-events.ts`, rendered in Options Diagnostics. It reports local active learning days and rolling 7-day active buckets, review completion, source return, Digest follow-through, reminder controls, Pro repeat-value, and cancellation value-risk counts from event metadata only. Production cohort retention remains deferred.

Current Weekly Digest MVP instrumentation is local-only in `src/entrypoints/vocabulary/VocabularyApp.tsx`: `digest_viewed` is emitted when the local Library digest card is visible and has digest value, `digest_opened` is emitted from the Open review CTA, and source-level `reminder_disabled` is emitted only when the existing Reading queue digest exclusion is newly enabled. These events must stay metadata-only and exclude source ids, titles, URLs, snippets, raw content, prompts, and model output.

| Stage | OKR signal | Supporting events / queries | Content policy |
|---|---|---|---|
| M1 First Success + Trust | onboarding completion, first understood content, first saved snippet, trust entry visibility | `extension_installed`, `onboarding_started`, `onboarding_completed`, `sample_started`, `first_content_understood`, `first_value_seen`, `saved_snippet_created`, `sentence_saved`, `support_report_submitted`, `known_issue_viewed`, `provider_api_model_default_ui_count` manual review | Metadata and static UI review only |
| M2 Learning Loop Productization | save feedback, first review, review duration, reviewable-card rate | `saved_snippet_created`, `sentence_saved`, `review_session_completed`, `review_answered`, `reviewable_card_rate` runtime query | Counts, duration buckets, feedback breakdown only |
| M3 Learning Library | Library opened, source return, continue learning, data-control trust | `library_opened`, `return_to_source_clicked`, `returned_to_source`, `continue_clicked`, `resumed_reading`, `support_report_submitted` | Source type/hostname/action outcome only |
| M4 Personalization | preference/glossary signal, undo/delete, explain quality, prompt-injection pass rate | `guardrail_metric`, `preference_undo_delete_available`, `prompt_injection_fixture_pass_rate` | Aggregate quality/preference presence and fixture pass/fail only |
| M5 Digest + Retention | digest viewed/opened, reminders controlled, 4-week retention, Pro repeat usage, cancellation reason trend | `digest_viewed`, `digest_opened`, `reminder_dismissed`, `reminder_disabled`, `winback_sent`, `weekly_reviewable_learning_moments`, `review_opened`, `review_answered`, `review_session_completed`, `continue_clicked`, `resumed_reading`, `return_to_source_clicked`, `returned_to_source`, `pro_value_seen`, `membership_activated`, `cancellation_reason_submitted` | Week/count/trigger/plan/reason/channel categories only |

Acceptance rule: every stage OKR must map to at least one canonical event, runtime query, or manual review signal before it can be used in a release dashboard. Signals must not require page text, saved snippet text, transcript text, prompt text, model output, or full URL paths.

Legacy local funnel names remain supported:

- `popup_primer_viewed`
- `popup_primer_cta_clicked`
- `deep_read_opened`
- `sentence_explained`
- `sentence_saved`
- `review_answered`
- `returned_to_source`
- `resumed_reading`

## Privacy rules

- Do not record page text, saved snippets, transcript text, file text, or user input as telemetry.
- Privacy Mode should reduce event detail to coarse source type and non-sensitive status.
- Support bundles are separate from telemetry and default to metadata-only (`src/utils/support-bundle.ts`).
