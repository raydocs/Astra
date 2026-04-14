# Control-plane surface inventory (Month 5)

_Node relay + web portable surfaces_

## Node-owned (`server/index.ts`)

| Route family | Purpose |
|--------------|---------|
| `/v1/auth/*` | Session / anonymous |
| `/v1/account`, `/v1/account/usage`, `/v1/account/plan`, `/v1/account/summary` | Account coherence |
| `/v1/billing/*` | Checkout / portal links |
| `/v1/devices`, `/v1/devices/:id/revoke` | Device revoke |
| `/v1/sync/*` | Push/pull/bootstrap/repair |
| `/v1/translate` | Managed translate (hot path) |

## Extension / web visible strings

- **Primary source of truth for visible account fields**: `GET /v1/account/summary`
  - `account.email`
  - `account.plan`
  - `account.subscriptionStatus`
  - `usage.quota.*`
  - `usage.usage.*`
- **Fallback only**: signed-in session snapshot, or legacy `GET /v1/account` + `GET /v1/account/usage` fanout during rollout/backfill.
- **Not account quota**: popup `translation-usage` storage. This is **local device activity telemetry** and must stay labeled that way.
- **Continuity-only surfaces**: device registry, config bootstrap, reading-history sync, and study-progress sync. These do not own plan/quota/billing copy.
- **Wording rule**: never show “unlimited” unless API returns explicit sentinel; map `past_due` / `canceled` to the same copy tree in extension + web.

## Mobile web / iOS

- **Narrow viewport / mobile web**: web `app.tsx` + `styles.css` — evidence belongs to the portable sign-in/session/account/control-plane bucket in `docs/investigations/month-5-mobile-ios-smoke-notes-2026-04-16.md`.
- **iOS bridge / shell**: `ios/README.md` + `docs/ios-safari-smoke-test.md`; claims stay **Experimental** per the base matrix until device-backed shell/runtime evidence exists.
- **Do not fork account semantics for mobile web**: the same plan/quota/status labels come from the same relay contract as desktop web.
- **Do not over-read portable web proof**: mobile web evidence can support Month 5 carry language, but it does not prove native launch/handoff ownership, extension runtime, or iOS shell parity.

## Operator notes

- **401 / CONFIG_MISSING**: usually session or relay env; see `AGENTS.md` for relay key restart.
- **429**: quota; link to the account quota panel, not popup local usage telemetry.

## Incident triage (Month 5 — quick buckets)

| Symptom bucket | First check | User-facing line |
|----------------|-------------|------------------|
| Auth / session | `POST /v1/auth/session`, device header on `/v1/account/summary` | “Sign in again” / refresh session |
| Quota | `GET /v1/account/summary` (or `/v1/account/usage` fallback), 429 on translate | “Daily limit reached” + link to plan |
| Sync repair | `POST /v1/sync/repair` vs local IndexedDB (web) | “Repair sync” in web account workspace |
| Billing handoff | `POST /v1/billing/checkout` returns URL vs empty | “Billing unavailable” if mock URLs misconfigured |
| CORS (web dev) | Browser console: relay origin vs web origin | Document-only: use same-site or proxy in dev |
