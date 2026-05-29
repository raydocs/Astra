# Production metrics export evidence note — 2026-05-28

Source: macro product upgrade plan Sections 11 and 34 plus final-completion blocker `productionMetricsExportAttached`.

This note records repo-side production metrics export guardrails. It is **not** a production dashboard export, cohort analytics packet, privacy approval, or owner signoff.

## Current repo-backed evidence

| Area | Repo evidence | Current proof | Remaining boundary |
| --- | --- | --- | --- |
| Product metrics contract | `src/utils/product-metrics.ts`, `src/utils/product-metrics.test.ts`, `docs/specs/product-metrics.md` | Defines Activation, Understanding, Learning, and Membership metric categories plus telemetry ethics/readiness checks. | Needs production/cohort export evidence for the target release. |
| Local V0 dashboards | `src/utils/learning-loop-events.ts`, `src/utils/learning-loop-events.test.ts`, `src/entrypoints/options/OptionsApp.tsx` | Local metadata-only activation, learning, retention, Digest, and membership-value aggregators are inspectable in Options Diagnostics. | Local diagnostics are not production/cohort exports. |
| Metrics dictionary | `docs/specs/metrics-dictionary.md` | Maps canonical events and stage OKR signals to content-policy boundaries. | Needs dashboard/query source evidence and privacy review for production queries. |
| Export packet intake | `evaluateAstraProductionMetricsExportPacket()` | Requires Activation, Understanding, Learning, and Membership rows to include valid non-reversed canonical shared `YYYY-MM-DD..YYYY-MM-DD` date range and cohort definition without surrounding whitespace, dashboard/query source, export id, timezone-bearing ISO exported-at timestamp, stable digest/checksum, query version, category-aligned metric ids, URL or repo artifact-path evidence link, owner/date containing a real calendar `YYYY-MM-DD`, and URL or repo artifact-path privacy-review link with local-only/private-network/loopback URLs, malformed URLs, and path-traversal repo references rejected. Duplicate export ids/evidence links, placeholder cohort/source/export-id/query-version values, weak all-zero/repeated/local/sample/test digests, duplicate metric ids, vague non-link references, and mismatched metric ids are rejected. | This validates supplied evidence; it does not create production analytics exports. |
| Product metrics readiness intake | `evaluateAstraProductMetricsReadiness()`, `docs/reviews/macro-product-metrics-readiness-packet-2026-05-28.json` | Requires non-placeholder label, owner/date containing a real calendar `YYYY-MM-DD`, URL or repo artifact-path evidence link, product-question metric coverage, Activation/Understanding/Learning/Membership metric coverage, privacy-safe telemetry defaults, event/category-based telemetry, Privacy Mode detail reduction, and clear user data controls before production metric maturity claims. | The current readiness packet is an all-false placeholder with empty owner/date and evidence link; it does not clear the final blocker. |

## Required packet rows

`productionMetricsExportAttached` may only be marked true when every category has evidence:

1. **Activation** — install/onboarding/first-value/first-save/first-review metrics for the canonical target date range and release cohort.
2. **Understanding** — usage, latency, failure/retry, stop, deeper explanation, and preference-switch metrics.
3. **Learning** — saves, due/reviewed cards, review completion, source-return, active learning, and saved-source mix metrics.
4. **Membership** — paywall/value exposure, conversion/trial/membership activation, renewal-risk, and cancellation metrics.

Every row needs a valid non-reversed canonical shared `YYYY-MM-DD..YYYY-MM-DD` date range and cohort definition without surrounding whitespace, dashboard/query source, export id, timezone-bearing ISO exported-at timestamp, stable non-weak digest/checksum, query version, category-aligned metric ids, URL or repo artifact-path evidence link, owner/date containing a real calendar `YYYY-MM-DD`, and URL or repo artifact-path privacy review link. Cohort definitions, dashboard/query sources, export ids, digest/checksum values, query versions, and evidence links must be real and category-specific; export/query identities may use UUIDs, hashes, semver query versions, date-stamped query versions, or prefixed analytics numeric IDs, while `run1`, `latest`, placeholders, all-zero, and repeated-character identities are rejected. Metric ids must come from `ASTRA_PRODUCT_METRICS`, be listed once, and match the row category. `productionMetricsExportAttached` also requires `docs/reviews/macro-product-metrics-readiness-packet-2026-05-28.json` to satisfy `evaluateAstraProductMetricsReadiness()` with a non-placeholder label, owner/date, and URL or repo artifact-path evidence link.

## Downgrade copy

Metrics contracts, local V0 Options diagnostics, metadata-only aggregators, a production metrics export packet intake guard, and a placeholder readiness packet guard exist in repo. Production/release-cohort dashboard exports with export identity, stable non-weak digest/checksum, query version, timezone-bearing ISO export timestamps, cohort definitions, privacy review, URL or repo artifact-path evidence, product-metrics readiness evidence accepted by `evaluateAstraProductMetricsReadiness()` with non-placeholder label, owner/date, and URL or repo artifact-path evidence link, and owner-approved dated query evidence remain required before claiming operational metric maturity.
