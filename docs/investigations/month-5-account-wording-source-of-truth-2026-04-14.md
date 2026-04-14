# Month 5 — Account / usage wording source-of-truth note

_Task **`M5-E-01`** alignment_

## Principle

One visible value should map to **one** origin and keep the same meaning everywhere:

- **Astra account summary** = account email, plan label, subscription status, daily quota, daily usage
- **Session snapshot fallback** = temporary copy shown only when the signed-in session exists but the fresh account summary has not loaded yet
- **Local device telemetry** = popup usage/routing activity for this browser only
- **Continuity status** = device registry, config bootstrap, and optional sync collections

No surface should present local telemetry as account quota, and settings should not redefine account/billing language.

## Canonical source-of-truth contract

| Visible value | Canonical source | Fallback | Surfaces |
|---|---|---|---|
| Account email | `GET /v1/account/summary` → `account.email` | signed-in session email | popup status, web account |
| Plan label | `GET /v1/account/summary` → `account.plan` | signed-in session `plan` | popup status, web overview, web account |
| Subscription status | `GET /v1/account/summary` → `account.subscriptionStatus` | signed-in session `subscriptionStatus` | web account |
| Daily request / character quota | `GET /v1/account/summary` → `usage.quota.*` | signed-in session quota snapshot | popup quota, web overview, web account |
| Daily usage counters | `GET /v1/account/summary` → `usage.usage.*` | signed-in session usage snapshot | popup quota summary, web overview, web account |
| Popup “Usage & routing” card | local `translation-usage` storage | none | popup only |
| Continuity devices / sync collections | continuity snapshot helpers | signed-out local device identity only | popup continuity, options continuity, web cloud console |

## Surface rules

### Popup

- Uses **Astra account summary** for plan + daily quota when available.
- Falls back to the signed-in session snapshot only until a fresh summary read succeeds.
- Shows **local guest** instead of implying a server-backed free plan when the device only has an anonymous session.
- The **Usage & routing** card is explicitly **local device activity only** and does **not** represent account quota.

### Options

- Owns **continuity + optional sync collection** language only.
- Must point users back to popup/web for **plan, quota, and billing** labels.
- Must not introduce a second meaning for usage, remaining quota, or plan tier.

### Web companion / narrow mobile-web layout

- Prefers a single `GET /v1/account/summary` read through the account workspace loader.
- Can backfill from legacy `/v1/account` + `/v1/account/usage` only as rollout fallback.
- Should render the same normalized labels as popup:
  - `Pro plan`
  - `Free plan`
  - `Active` / `Past due` / `Canceled`

## Implementation note

Normalized account wording now lives in `src/utils/astra/account-surface.ts`, which provides:

- shared plan/status labels
- shared summary-vs-session fallback semantics
- shared popup quota derivation from summary/session state

## Doc pointers

Relative to the **Node relay** (`server/` — auth, `/v1/account*`, billing, devices, sync, `/v1/translate`):

- **`docs/investigations/control-plane-surface-inventory-2026-04-15.md`** — route ownership + which surface should call summary vs continuity vs local telemetry.
- **`docs/investigations/lifecycle-operations-runbook-month5-2026-04-15.md`** — long-running lifecycle wording for export, delete, sync repair, and device revoke.

Together: this note defines **what each visible account/usage field means**, while the inventory/runbook docs define **which relay routes own that meaning**.
