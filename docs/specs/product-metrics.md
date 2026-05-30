# Product Metrics Contract

Source plan: Section 11 from the macro product upgrade plan dated 2026-05-27.

Astra metrics should answer product decisions without turning learning into content surveillance.

## Executable source

See `src/utils/product-metrics.ts`.

## Questions metrics must answer

- Where do users drop off?
- Which product entry is used most often?
- Which error categories happen most often?
- Do users actually save content?
- Do users come back to review after saving?
- Is membership value being seen?

## Activation metrics

- extension installed;
- onboarding started;
- onboarding completed;
- signed in;
- sample started;
- first content understood / first value seen;
- first item saved;
- first review opened;
- first review completed.

Local V0 dashboard implementation: `aggregateLearningLoopActivationDashboard()` in `src/utils/learning-loop-events.ts`, rendered in Options Diagnostics. It makes onboarding completion, first-value P50 seconds, first-save rate, first-review completion, trial starts, and Pro-value visibility inspectable without collecting content.

Local retention dashboard implementation: `aggregateLearningLoopRetentionDashboard()` in `src/utils/learning-loop-events.ts`, rendered in Options Diagnostics. It makes active learning days/weeks, review completion, source return, Digest follow-through, reminder controls, Pro repeat-value, and cancellation value-risk signals visible from local metadata-only telemetry. Production cohort retention remains deferred.

## Understanding metrics

- content understanding started;
- first result latency;
- completion latency;
- failure count;
- retry count;
- user stopped;
- deeper explanation opened;
- quality/speed preference switched.

## Learning metrics

- saved words;
- saved sentences;
- cards due;
- cards reviewed;
- review completion rate;
- return-to-source clicks;
- weekly active learners;
- saved content by source type.

Local learning dashboard implementation: `aggregateLearningLoopLearningDashboard()` in `src/utils/learning-loop-events.ts`, rendered in Options Diagnostics. It makes saves, explicit review-card proxy rate, review completion, Library opens, source return, continue actions, active learning days, and allowlisted saved source mix visible from local metadata-only telemetry. The reviewable-card proxy deliberately counts only events with explicit `hasReviewCard: true`; production reviewable-card rate and WAU remain deferred aggregate queries.

## Membership metrics

- paywall viewed;
- conversion event;
- trial started;
- Pro value seen;
- membership activated;
- renewal risk signals;
- cancellation reason submitted.

## Telemetry ethics

Default telemetry rules:

- do not record sensitive original text unless an explicit, reviewed product policy requires it;
- prefer events, counts, categories, and buckets over content;
- Privacy Mode reduces telemetry detail;
- users need clear data controls.

Implementation boundary:

- exclude page text, selected text, transcript text, file text, prompt text, model output, saved snippet text, and full URL paths from default telemetry;
- use source type, task class, error category, latency bucket, plan category, and aggregate counts;
- in Privacy Mode, prefer coarse source type, non-sensitive status, or local-only summaries;
- point relevant metrics/digest/support surfaces to Privacy Mode, export/delete, reminder, and support-bundle controls.

## Readiness blockers

`evaluateAstraProductMetricsReadiness()` blocks readiness when:

- the six product decision questions lack metric coverage;
- activation, understanding, learning, or membership metrics are incomplete;
- telemetry records sensitive raw text by default;
- telemetry depends on content instead of events/categories;
- Privacy Mode does not reduce telemetry detail.

It warns when metrics surfaces do not make user data controls clear.

## Current implementation relationship

This contract complements `docs/specs/metrics-dictionary.md` and `LEARNING_LOOP_STAGE_OKR_METRICS` in `src/utils/learning-loop-events.ts`. The metrics dictionary maps canonical events and stage OKRs; this contract preserves Section 11's category-level product measurement and ethics requirements.

## Operational maturity boundary

Local V0 Options Diagnostics proves that metadata-safe activation, learning, retention, Digest, and membership-value signals can be aggregated and inspected in repo. It does not prove that release-cohort or production dashboards are queryable. Stronger operational metric maturity claims require dated dashboard/export evidence for Activation, Understanding, Learning, and Membership metrics from the target release environment.

Use both `evaluateAstraProductionMetricsExportPacket()` and `evaluateAstraProductMetricsReadiness()` before setting `productionMetricsExportAttached` true in the final macro evidence artifact. Each production/cohort export row must include category, valid non-reversed date range, cohort definition, dashboard/query source, export id, timezone-bearing ISO exported-at timestamp, stable digest/checksum, query version, category-aligned metric ids, evidence link, owner/date, and privacy-review link; `docs/reviews/macro-product-metrics-readiness-packet-2026-05-28.json` must also include a non-placeholder label, owner/date, URL or repo artifact-path evidence link, and booleans proving product-question coverage, Activation/Understanding/Learning/Membership coverage, privacy-safe telemetry defaults, event/category-based telemetry, Privacy Mode detail reduction, and clear user data controls.
