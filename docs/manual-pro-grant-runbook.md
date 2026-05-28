# Manual Pro-Grant Runbook (paid beta)

**Scope:** How an operator grants/revokes a Pro entitlement during the invite-only paid beta. No payment gateway, no IAP — the subscription truth source is a manual operator action (per the master execution plan, `astra-master-execution-priority-map-2026-05-28.md`, §4.5/§11).

---

## ⚠️ Verification finding (T6) — read before relying on this route

The plan assumed `PATCH /v1/account/plan` is **operator-gated**. It is **not**. As of commit on branch `astra-paid-beta-foundation`:

- `handlePlanUpdate` (`src/server/index.ts:1727`) authenticates with **`requireAuthenticatedSession`**, not `requireOperatorPrincipal`.
- It sets the plan for **the caller's own account**: `users.updatePlan(authenticated.claims.email, payload.plan)` — and `PlanUpdateSchema` (`index.ts:125`) accepts `pro`/`trial`/`free` with no target-account field.
- The client helper `updateAstraPlan` (`src/utils/astra/account.ts:446`) is reachable from the popup via `onChangePlan` (`AuthSection.tsx`).

**Consequence:** any signed-in user can self-grant Pro by calling `PATCH /v1/account/plan {"plan":"pro"}`. This makes the paid entitlement trivially bypassable and must be closed before any real paid invite. The intended upgrade path (`onOpenCheckout` → `createAstraCheckoutLink` → `/v1/billing/checkout`) is a beta-safe stub (`billing.ts:91`, `checkoutAvailable:false`), so for beta the grant is manual — but the manual grant must be **operator-only**, which the route does not yet enforce. Tracked as a P0 follow-up (operator-gate paid grants + add a target-account field; keep self-downgrade-to-`free`). **Until that lands, do NOT expose this route/affordance to invited users**, and prefer the store-edit method below.

---

## Interim safe grant method (until the route is operator-gated)

The relay user store is a JSON file (`ASTRA_USER_DB_PATH`, default `data/server/users.json`). To grant Pro to an invited account:

1. Stop the relay (or ensure no concurrent writes).
2. In `data/server/users.json`, find the user object by `email`.
3. Set `"plan": "pro"`, `"subscriptionStatus": "active"`. (Provider entitlements + tier limits are re-derived on the next plan write; if editing by hand, also set `providerEntitlements` and `limits` to the Pro values, or restart and let the next `updatePlan` normalize them.)
4. Save and restart the relay.
5. Confirm: read `GET /v1/account/summary` (as that user) and check `plan: "pro"`; confirm `ENTITLEMENT_MATRIX` now returns Pro allowances for high/long-running task classes.
6. Record the grant date in the beta cohort spreadsheet so the weekly cost read (`GET /v1/ops/cost/usage-summary`) can be attributed per user.

**Revoke:** set `"plan": "free"` (or have the user self-downgrade — that path is legitimately self-serve) and restart.

---

## Target end-state (the P0 follow-up)

Operator-gate paid grants so the runbook can use the API safely:

- `handlePlanUpdate`: if `payload.plan === "free"` → keep self-serve (own session, supports user cancellation; matches the existing `index.test.ts` downgrade test). If `payload.plan` is `pro`/`trial` → require `requireOperatorPrincipal(...)` and read a **target email** from the payload (operator grants to a named account, not to themselves).
- Add an `OpsAuditAction` for plan grants + a role permission (which ops role may grant).
- Remove or hide the popup `onChangePlan`-to-paid affordance from the default path (it should route to checkout, not a self-set).
- Add a test asserting a plain user session **cannot** set `pro`/`trial` (403), and an operator **can** grant to a target account.

---

## Weekly cost-review (operator)

Once per week read `GET /v1/ops/cost/usage-summary` (aggregate, metadata-only; `user-store.ts`), compare total spend to the cohort budget, and scan for any account whose high/long-running usage is an outlier. If trending over budget, flip `emergency.limit_free_high_cost` or `force_fast_mode` (runtime kill switches, `index.ts:2473-2538`) — no redeploy — rather than editing limits live.
