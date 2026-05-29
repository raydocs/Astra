# Product Metrics Evidence Note — 2026-05-28

Source objective: macro product upgrade plan Sections 11 and 34.

This note records repository-side product-metrics evidence only. It does not prove production cohort analytics, a warehouse dashboard, CI-uploaded metrics exports, or launch metric maturity.

## Repo-side evidence now present

| Area | Evidence | Current interpretation |
|---|---|---|
| Metric contract | `src/utils/product-metrics.ts`, `src/utils/product-metrics.test.ts` | Defines Activation, Understanding, Learning, and Membership metric categories plus telemetry ethics/readiness checks. Membership metrics are aligned to current canonical events: `paywall_viewed`, `conversion_event`, `trial_started`, `pro_value_seen`, `membership_activated`, `cancellation_reason_submitted`, and renewal-risk aggregate signals. |
| Event aggregation | `src/utils/learning-loop-events.ts`, `src/utils/learning-loop-events.test.ts` | Provides local metadata-only activation, learning, and retention dashboard aggregators. |
| Options Diagnostics UI | `src/entrypoints/options/OptionsApp.tsx`, `src/entrypoints/options/OptionsApp.test.tsx` | Renders local V0 activation, learning, retention, and upgrade-prompt observability cards from local event metadata. |
| Mobile retention ops summary | `src/server/index.ts`, `src/server/user-store.ts`, `src/server/index.test.ts`, `docs/analysis/minimal-mobile-retention-ops-summary-checklist-2026-05-28.md` | Adds an operator-gated, aggregate-only `GET /v1/ops/mobile-retention/summary` over retained sanitized mobile retention events. It returns event names, UTC buckets, counts, and explicit privacy flags only; it is repo-side remote visibility, not production cohort export evidence. |
| Metrics dictionary | `docs/specs/metrics-dictionary.md` | Maps canonical events and stage OKR signals to content-policy boundaries. |
| Product metrics contract | `docs/specs/product-metrics.md` | Defines product questions, metric categories, local V0 dashboard implementations, and telemetry ethics. |

## What local V0 diagnostics prove

Local V0 diagnostics make the following inspectable on a development or target build that has local telemetry:

- onboarding completion and first-value timing;
- first save / first review completion proxy;
- learning saves, Library opens, source returns, continue actions, and review completion;
- Digest viewed/opened and reminder-control counts;
- Pro value exposure, trial/membership activation, and cancellation-risk signals;
- metadata-only event handling that excludes raw page text, saved snippets, transcripts, prompts, model output, emails, device ids, and full URL paths from dashboard rows;
- remote mobile retention smoke visibility through an operator-only aggregate endpoint that groups sanitized mobile retention events by UTC bucket and event name without raw metadata or identifiers.

## Boundary that remains

Do not claim operational metric maturity until all of the following are attached for the target release:

1. CI or production export showing Activation, Understanding, Learning, and Membership metrics are queryable for the target commit/worktree or release cohort;
2. dashboard screenshots or exported query results with valid non-reversed canonical `YYYY-MM-DD..YYYY-MM-DD` date range, environment, owner/date containing a real calendar `YYYY-MM-DD`, real cohort/source/export id, timezone-bearing ISO exported-at timestamp, stable non-weak digest/checksum, real query version, category-aligned metric ids, and URL or repo artifact-path evidence/privacy links with local-only/private-network/loopback URLs, malformed URLs, and path-traversal repo references rejected;
3. cohort definitions and dashboard/query source for every exported category;
4. privacy review confirming production queries preserve the same content-policy boundary;
5. release owner approval tying metric evidence to Gate 1–4 claims;
6. product-metrics readiness evidence in `docs/reviews/macro-product-metrics-readiness-packet-2026-05-28.json` with non-placeholder label, owner/date containing a real calendar `YYYY-MM-DD`, URL or repo artifact-path evidence link, and booleans proving product-question coverage, Activation/Understanding/Learning/Membership coverage, privacy-safe telemetry defaults, event/category-based telemetry, Privacy Mode detail reduction, and clear user data controls.

Use both `evaluateAstraProductionMetricsExportPacket()` and `evaluateAstraProductMetricsReadiness()` before setting `productionMetricsExportAttached` true. Local V0 diagnostics, metrics dictionaries, the aggregate mobile retention ops summary, and instrumentation tests do not satisfy these packets without production/cohort export rows plus readiness evidence.

## Allowed downgrade copy

Metrics contracts, local V0 Options diagnostics, metadata-only aggregators, an aggregate-only mobile retention ops summary, and a placeholder product-metrics readiness packet exist in repo for Activation, Learning, Retention, Digest, and Membership-value signals. Production/release-cohort dashboard exports with real cohort/source/export identity, stable non-weak checksum/digest, real query version, timezone-bearing ISO export timestamps, URL or repo artifact-path evidence/privacy links with local-only/private-network/loopback URLs, malformed URLs, and path-traversal repo references rejected, product-metrics readiness evidence accepted by `evaluateAstraProductMetricsReadiness()` with non-placeholder label, owner/date, and URL or repo artifact-path evidence link, and owner-approved dated query evidence remain required before claiming operational metric maturity.
