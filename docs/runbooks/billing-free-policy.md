# Billing and Free Beta Policy Runbook

**Date:** 2026-05-22  
**Scope:** Work Item 4 from `docs/plans/commercial-public-launch-2026-05-22.md`. This runbook defines the launch-safe free beta policy and the blockers that must remain closed before any paid launch claim.

## Decision

Astra may launch as a **free public beta** only.

Astra must not present paid subscriptions, Pro upgrades, checkout, billing portal access, or durable paid entitlements as available until the blockers in this runbook are completed and reviewed. Any public copy may say that paid subscriptions are **not launched** or **not available during beta**.

## Free beta policy

- **Access model:** managed translation may use an anonymous Astra session or an optional signed-in account/session. Direct-provider BYOK paths may still exist separately where configured.
- **Plan semantics:** launch-safe managed sessions are `plan: "free"` with `subscriptionStatus: "active"` only to mean the beta session is currently usable. This is not proof of a paid subscription.
- **Quota posture:** free beta usage is limited by configured free quota/rate controls and provider spend limits. Public copy must avoid promising unlimited usage, durable quota accounting, or paid-tier increases.
- **Paid upgrades:** no public paid upgrade, Pro checkout, subscription purchase, billing portal, or pricing claim is available for launch.
- **Support posture:** beta support must have a monitored inbox/owner before public distribution; refund/cancel workflows are paid-launch blockers, not free-beta requirements.

## Relay-lite account summary semantics

`src/platform/relay-lite/src/index.ts` is the launch free-beta front door when deployed for public use.

For `GET /v1/account/summary`, relay-lite returns a session-shaped account summary:

- `account.id` is the current session ID.
- `account.plan` is always `"free"`.
- `account.subscriptionStatus` is `"active"` to mean the free beta session is accepted.
- `usage.quota` is populated from free quota environment variables/fallbacks.
- `usage.usage` currently returns zeroed counters in relay-lite; it is a quota-shaped snapshot, not durable paid usage reconciliation.
- sync collections are reported as disabled/default-off placeholders unless a later production sync authority is deployed.

Do not describe relay-lite account summary as durable paid account state, entitlement enforcement, paid quota reconciliation, or production billing source of truth.

## Public copy rules

Allowed:

- “Free public beta.”
- “Paid subscriptions are not launched.”
- “Paid upgrades are unavailable during beta.”
- “Managed beta translation uses an anonymous Astra session or optional account.”
- “Free beta quotas/rate limits may apply.”

Disallowed unless explicitly disabled/unavailable and approved:

- “Pro” as an active plan users can buy.
- “Upgrade to Pro” as an enabled CTA.
- “Paid upgrade,” “subscription available,” “checkout,” “billing portal,” or “pricing” claims.
- “Durable paid entitlements,” “paid quota reconciliation,” or “production billing support.”

Current copy status:

- Store/privacy copy from Work Item 1 already states the free-public-beta boundary and paid-launch blocker posture.
- Web account UI must not expose active checkout/portal CTAs. If shown for future-product context, controls must be disabled and clearly marked unavailable during beta.
- Backend deploy docs/config are intentionally out of scope for this runbook; do not rewrite them for Work Item 4.

## Paid launch blockers

Paid launch remains blocked until all items below are complete, tested, and reviewed:

1. **Pricing/package decision** — final plans, limits, currency/tax assumptions, trial policy, and grandfathering rules.
2. **Payment provider selection** — Stripe, Paddle, LemonSqueezy, or equivalent chosen with production account, terms, tax/VAT handling, and data-processing review.
3. **Checkout success/cancel flows** — production checkout initiation, success redirect, cancel redirect, retry behavior, and user-visible receipt/status copy.
4. **Webhook receiver** — verified signatures, idempotency, replay handling, event logging, and alerting for payment/subscription lifecycle events.
5. **Subscription persistence** — durable subscription/customer records keyed to Astra account identity, including status transitions and historical audit fields.
6. **Entitlement enforcement** — translation/provider access, quota tier, and feature access derive from persisted entitlements, not client copy or mock plan toggles.
7. **Quota reconciliation** — usage accounting, rate limits, daily/monthly resets, provider cost controls, abuse controls, and reconciliation against subscription state.
8. **Billing portal/account management** — supported portal or equivalent flows for payment method update, invoice access, cancellation, and plan changes.
9. **Support/refund/cancel policy** — public support inbox/owner, SLA expectations, refund policy, cancellation behavior, incident escalation, and store-review contact details.
10. **Account deletion/export production workflow** — durable account data export/deletion workflows that cover managed sessions/accounts and billing identity implications.
11. **Legal/privacy/terms review** — privacy policy, terms of service, data-processing disclosures, app/store questionnaires, refund/cancel terms, and provider/subprocessor review.
12. **Operational evidence** — production smoke tests for checkout, webhook events, entitlement changes, quota enforcement, account deletion/export, rollback, and incident owner handoff.

## Engineering guardrails

- Treat `src/server/billing.ts` and Node relay `/v1/billing/*` as development/mock-link substrate until the paid blockers are complete.
- Do not route public users into a checkout or portal URL unless it is backed by the selected production billing provider and webhook/persistence path.
- Do not use `plan: "pro"` test fixtures or local plan drills as launch evidence.
- Do not rely on frontend labels to enforce paid access; enforcement must live in the authoritative backend/provider-control path.
- Keep free-beta quota/spend controls conservative and externally budgeted before launch.

## External dependencies

- Provider spend limits and abuse controls for the free beta.
- Monitored support inbox and incident owner.
- Legal/privacy review.
- Later billing provider account and implementation plan.

## Work Item 4 completion checklist

- [x] Free beta policy defines anonymous/session-backed managed translation, limited quotas, no paid upgrades, and no subscription claims.
- [x] Paid launch blockers are explicit.
- [x] Store/web copy rule avoids active `Pro`, paid, upgrade, or real billing claims unless disabled/marked unavailable.
- [x] Relay-lite `GET /v1/account/summary` free/active semantics are documented as free beta, not durable paid account quota.
