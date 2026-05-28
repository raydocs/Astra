# V1 Activation + Trial + Support Checklist — 2026-05-27

Source plan: [`docs/plans/astra-zero-config-saas-operating-model-2026-05-27.md`](../plans/astra-zero-config-saas-operating-model-2026-05-27.md)

## Scope

V1 turns the V0 SaaS foundation into an observable activation/support loop:

1. Keep first-run setup low-friction.
2. Make activation/trial/Pro-value/support/cancellation events canonical.
3. Keep support metadata-only by default while enabling server-side aggregation.
4. Establish cancellation/refund reason taxonomy for future billing flows.

## Current implementation status

| Area | Status | Notes |
|---|---:|---|
| Onboarding setup questions | ✅ Done | First-run setup now asks only target translation language, level, and primary goal. Source language and explanation style are deferred to Settings/defaults. |
| Sample first-value loop | ✅ Existing | `sample-lesson` covers first content understood → saved snippet → one-card review. |
| Activation telemetry names | ✅ Done | Canonical names include `onboarding_completed`, `first_content_understood`, `saved_snippet_created`, `review_session_completed`. |
| Trial/Pro-value telemetry names | ✅ Done | Added `trial_started` and `pro_value_seen` to the learning-loop event catalog and Options labels. |
| Pro-value impressions | ✅ Done | Popup and onboarding account-continuity value cards record `pro_value_seen` with `billingAvailable: false`; `trial_started` remains deferred until real trial semantics exist. |
| Pro-value trigger variants | ✅ Done | Added trigger-specific Pro-value copy and popup moments for long video, Deep Read, sync, digest, and near-limit contexts; telemetry records `pro_value_seen` by trigger without technical setup language. |
| Beta-safe paywall prompt observability | ✅ Done | Added local upgrade-prompt value-copy assignment (`upgrade_prompt_value_copy_v1`), popup `paywall_viewed` exposure, local `upgrade_intent_clicked` conversion metadata, and Options Diagnostics aggregate visibility. Billing, checkout, trial start, email capture, subscription mutation, and Pro entitlement activation remain deferred. |
| Beta-safe trial lifecycle contract | ✅ Done | Added authenticated `GET/POST /v1/account/trial-intent` with `astra-beta-trial-lifecycle.v1` metadata-only response. POST records `trial_intent_recorded` only after explicit non-anonymous user action; it does not collect payment, open checkout/portal, mutate subscription/plan, or grant trial/Pro entitlement. Astra Web account shows a `Beta trial interest` CTA/state with ordinary beta-boundary copy. |
| Support telemetry names | ✅ Done | Added `support_report_submitted` and `known_issue_viewed`. |
| Cancellation telemetry name | ✅ Done | Added `cancellation_reason_submitted`. |
| Cancellation/refund reasons | ✅ Done | Added normalized reason catalog in `src/utils/cancellation-reasons.ts`. |
| Cancellation/refund feedback collection | ✅ Done | Options Diagnostics now records normalized metadata-only `cancellation_reason_submitted` feedback from Settings without free-form content. |
| Support report intake | ✅ Existing/extended | Authenticated metadata-only `POST /v1/support/reports` remains in place. |
| Popup support submission | ✅ Done | Popup `Report this page` submits metadata-only reports when signed in, records `support_report_submitted`, and keeps local JSON fallback for unsigned-in or failed submissions. |
| Content-script support submission | ✅ Done | FloatBall failure quick action now exposes `Report this page`, submits metadata-only reports when signed in, records `support_report_submitted`, keeps local JSON fallback without page text/URL path, and uses generic DOM status text so page scripts cannot read report IDs/details. |
| Support report aggregation | ✅ Done | Added grouped metadata summary plus operator endpoint `GET /v1/ops/support/reports/summary`. |
| Known issues foundation | ✅ Existing/fixed | Known-issue store compile issue fixed; server has known-issue list/update routes in current worktree. |
| Known issues user UX/matcher | ✅ Done | Support report success now shows user-safe known-issue/workaround copy in Popup/Options when the server matcher links a report; content FloatBall records `known_issue_viewed` but keeps page-visible DOM generic. |
| Shadow audit fixture parity | ✅ Fixed | Cloudflare shadow audit fixtures now include `review_schedule` and the current demo plan. |
| Metrics dictionary | ✅ Done | V1 event names documented with no-content telemetry rules. |

## Remaining V1 follow-ups

- Add real trial-start UI/API trigger only after billing/trial start semantics are finalized; do not emit `trial_started` from free-beta sign-in, beta-safe upgrade-interest clicks, or the beta trial-intent contract.
- Add checkout/payment/subscription/Pro entitlement flows only after billing semantics and support policy are finalized; current upgrade prompt records local interest and the trial lifecycle contract records server-side trial intent only.
- Define the authoritative trial expiration/subscription truth source before any `trial` plan mutation or trial entitlement grant.

## Validation

Completed on 2026-05-28 for beta-safe trial lifecycle:

```text
pnpm test src/server/index.test.ts src/web/src/app.test.tsx
# Focused server/web trial lifecycle coverage: explicit authenticated action, anonymous denial, no billing/subscription/Pro mutation, metadata-only event, beta copy/secret-leak guards.

pnpm type-check
# Re-run requested for this slice; result recorded in implementation summary.
```

Completed on 2026-05-27:

```text
pnpm test src/entrypoints/onboarding/OnboardingApp.test.tsx src/utils/learning-loop-events.test.ts src/utils/cancellation-reasons.test.ts src/server/index.test.ts src/server/user-store.test.ts src/server/user-store-db.test.ts src/server/cloudflare-shadow-audit.test.ts
# 7 files / 90 tests passed

pnpm test src/entrypoints/popup/App.test.tsx src/utils/astra/support.ts src/server/index.test.ts
# 2 files / 109 tests passed

pnpm test src/entrypoints/popup/App.test.tsx src/entrypoints/onboarding/OnboardingApp.test.tsx src/utils/learning-loop-events.test.ts
# 3 files / 90 tests passed

pnpm test src/entrypoints/content/components/FloatBall.test.ts
# 1 file / 21 tests passed

pnpm test src/entrypoints/options/OptionsApp.test.tsx src/utils/cancellation-reasons.test.ts
# 2 files / 34 tests passed

pnpm test src/utils/support-bundle.test.ts src/utils/astra/support.test.ts src/entrypoints/popup/App.test.tsx src/entrypoints/options/OptionsApp.test.tsx src/entrypoints/content/components/FloatBall.test.ts
# 5 files / 128 tests passed

pnpm test src/utils/learning-loop-events.test.ts src/entrypoints/popup/App.test.tsx
# 2 files / 83 tests passed

pnpm type-check
# [type-check-exit] code=0 elapsed=9.1s
# Re-run after popup support wiring: [type-check-exit] code=0 elapsed=9.1s
# Re-run after pro-value instrumentation: [type-check-exit] code=0 elapsed=10.1s
# Re-run after content-script support wiring: [type-check-exit] code=0
# Re-run after settings cancellation feedback: [type-check-exit] code=0
# Re-run after known-issues UX/matcher: [type-check-exit] code=0
# Re-run after Pro-value trigger variants: [type-check-exit] code=0

pnpm check:repo-knowledge
# [repo-knowledge-exit] code=0 elapsed=0.4s
# Re-run after popup support wiring: [repo-knowledge-exit] code=0 elapsed=0.4s
# Re-run after pro-value instrumentation: [repo-knowledge-exit] code=0 elapsed=0.4s
# Re-run after content-script support wiring: [repo-knowledge-exit] code=0
# Re-run after settings cancellation feedback: [repo-knowledge-exit] code=0
# Re-run after known-issues UX/matcher: [repo-knowledge-exit] code=0
# Re-run after Pro-value trigger variants: [repo-knowledge-exit] code=0
```
