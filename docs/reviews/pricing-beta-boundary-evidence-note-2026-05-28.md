# Pricing / Trial / Paywall Beta Boundary Evidence Note — 2026-05-28

## Scope

This note covers repo-side evidence that Astra is currently bounded to free public-beta wording and that Trial/Pro/paid checkout claims remain blocked. It does not claim paid launch readiness, production billing readiness, entitlement correctness, refund/cancellation readiness, legal approval, app-store payment policy approval, or final pricing approval.

## Current repo evidence

| Claim area | Current evidence | Verdict |
|---|---|---|
| Free public-beta decision | `docs/runbooks/billing-free-policy.md` states Astra may launch as a free public beta only and must not present paid subscriptions, Pro upgrades, checkout, billing portal access, or durable paid entitlements as available. | Repo-covered for launch-safe boundary. |
| Paid launch blocker list | `docs/runbooks/billing-free-policy.md` lists pricing/package, payment provider, checkout success/cancel, webhook receiver, subscription persistence, entitlement enforcement, quota reconciliation, billing portal, support/refund/cancel policy, account deletion/export, legal/privacy/terms review, and operational evidence as paid-launch blockers. | Repo-covered for blocker inventory. |
| Product/paywall strategy contract | `docs/specs/product-strategy-persona-jtbd-paywall.md` and `src/utils/product-strategy.ts` define Free/Trial/Pro public promise, trial aha moments, paywall trigger rules, cancellation asset-access boundary, non-technical paywall copy, and beta billing-disabled readiness. | Repo-covered for strategy/evaluator boundary. |
| Technical copy guard | `findPaywallTechnicalTerms()` in `src/utils/product-strategy.ts` screens paywall copy for token/provider/model/batch/route/cache/relay/API key/OpenAI/Gemini/OpenRouter language. | Repo-covered for copy safety. |
| Beta-safe trial interest | `docs/analysis/v1-activation-trial-support-checklist-2026-05-27.md` records the `trial_intent_recorded` / `Beta trial interest` flow as explicit, metadata-only, non-anonymous, and non-billing: no checkout, portal, plan/subscription mutation, trial entitlement, or Pro grant. | Repo-covered for beta-safe observability boundary. |
| Mobile membership safe display | `docs/reviews/membership-value-evidence-note-2026-05-28.md` records Free/Trial/Pro active/Sync paused mobile display safety while preserving no purchase/checkout/subscribe/upgrade CTA boundaries. | Repo-covered for mobile copy/status safety. |
| Public limitation copy | `docs/help/known-limitations.md` states current repo evidence supports free public-beta wording and that Trial/Pro/paid checkout/refund/entitlement claims require external artifacts. | Repo-covered for public beta caveat. |
| Launch packet intake | `docs/reviews/launch-artifact-packet-evidence-note-2026-05-28.md` records billing/legal/store/GTM artifact packet rows required before `billingLegalStoreGtmArtifactsAttached` can be considered true. | Repo-covered for intake guardrail. |
| Store copy boundary | `store/listing-copy.md` uses free/beta and no-setup wording while avoiding active paid checkout or subscription availability claims. | Repo-covered for draft copy; not store approval. |

## Explicit non-claims

This note does not prove:

- production checkout/portal availability;
- payment provider selection or live account readiness;
- webhook signature validation, persistence, replay handling, retry/idempotency, or alerting in production;
- durable subscription/customer records or entitlement enforcement;
- paid quota reconciliation, invoices, refunds, cancellation, or tax/VAT handling;
- legal/privacy/terms approval for paid membership;
- owner-approved pricing/package decision;
- App Store / Play / Chrome Web Store payment-policy approval.

## Required before stronger claim

Before paid launch, Trial/Pro availability, checkout, subscription, entitlement, or pricing claims, attach:

1. final pricing/package/trial policy and owner/legal approval;
2. production payment-provider account evidence and checkout success/cancel proof;
3. webhook signature, idempotency, replay, persistence, and alerting evidence;
4. durable subscription/customer record and entitlement enforcement evidence;
5. quota reconciliation and abuse/cost-control evidence tied to subscription state;
6. billing portal, cancellation, refund, invoice, support, and incident-owner evidence;
7. terms/privacy/store questionnaire approval and hosted public legal/support URLs;
8. target-build manual QA for Free/Trial/Pro/canceled/expired/past-due states and post-cancel saved-asset access.

## Suggested focused verification

```bash
pnpm vitest run src/utils/product-strategy.test.ts src/utils/membership-value.test.ts
pnpm vitest run src/utils/macro-operational-evidence.test.ts -t "external launch artifacts|Pricing|RC evidence note|repo evidence entry"
```
