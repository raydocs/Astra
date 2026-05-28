# First 90 Experiment Cadence + Unit Economics Checklist — 2026-05-27

Source strategy document: [`docs/plans/astra-zero-config-saas-operating-model-2026-05-27.md`](../plans/astra-zero-config-saas-operating-model-2026-05-27.md).

## Scope

Implement the smallest internal operating contract for two First 90 P1 deliverables:

- Experiment cadence: weekly review with explicit success metrics and guardrails.
- Monthly unit economics review: gross-margin risk visible from aggregate inputs.

This slice does not create a staff dashboard UI or exact provider spend ledger.

## Current implementation status

| Area | Status | Notes |
|---|---:|---|
| Review cadence registry | ✅ Done | `ASTRA_OPERATING_REVIEW_CADENCE` defines daily, weekly, monthly, release, and quarterly review evidence requirements. |
| Experiment guardrails | ✅ Done | `ASTRA_EXPERIMENT_GUARDRAILS` covers onboarding, paywall, review, save moment, digest, free limits, share card, and support experiments with no-content privacy rules. |
| Generic experiment events | ✅ Done | Added `variant_assigned`, `conversion_event`, and `guardrail_metric` to the learning-loop event catalog and Options event labels. |
| Beta-safe paywall prompt observability | ✅ Done | Local `upgrade_prompt_value_copy_v1` assignment, `paywall_viewed`, and `upgrade_intent_clicked` conversion metadata now feed an Options Diagnostics aggregate card by variant/trigger. Checkout, payment, trial start, subscription mutation, and Pro activation remain deferred. |
| Monthly unit economics helper | ✅ Done | `buildMonthlyUnitEconomicsReview()` computes aggregate AI/infra/support cost per user, Pro gross margin, heavy-user ratio, abuse rate, trial conversion, and trial cost per converted Pro. |
| Pause-growth risk flags | ✅ Done | Monthly review flags negative gross margin, elevated heavy-user ratio, abuse rate, unbounded trial cost, and missing volume. |
| Privacy boundary | ✅ Done | Review output is aggregate-only and tests assert no email/user/device/page/provider/model/prompt fields. Privacy-policy strings may name excluded content only as explicit exclusion language. |
| Oracle review fix | ✅ Done | Strengthened OKR privacy-policy tests so sensitive terms in policy text must be framed as `no`/`without`/`not`/`never` exclusions. |
| Staff UI | Deferred | Future ops console can render these contracts; this slice establishes the review schema and tests. |
| Exact dollar ledger | Deferred | Exact provider pricing/spend remains deferred until a durable internal pricing ledger exists. |

## Validation

```text
pnpm test src/utils/operating-review.test.ts src/utils/learning-loop-events.test.ts
# Initial run: 2 files / 17 tests passed
# Re-run after Oracle privacy-policy test fix: 2 files / 18 tests passed

pnpm type-check
# [type-check-exit] code=0

pnpm check:repo-knowledge
# [repo-knowledge-exit] code=0
```
