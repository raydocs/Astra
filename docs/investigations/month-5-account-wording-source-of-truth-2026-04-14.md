# Month 5 — Account / usage wording source-of-truth note

_Task **`M5-E-01`** alignment_

## Principle

One visible metric should map to **one** origin: local extension storage, relay `/account` snapshot, or marketing copy — never two conflicting labels on different surfaces for the same field.

## Where values come from (high level)

| Surface | Primary sources | Source-of-truth vs relay |
|---------|-------------------|---------------------------|
| Extension popup | `readConfig`, `readAstraSession`, `getQuotaInfo` / continuity snapshot helpers in `App.tsx` | **Local + relay-shaped cache**: UI reads storage/session helpers first; any plan/quota/usage line that mirrors the web must match the same field semantics the relay exposes (see control-plane inventory), not ad hoc strings. |
| Options | Same storage + continuity collections as popup | **Same as popup** — one continuity model; options must not introduce a second definition for “remaining” / “limit” if popup already shows the same metric. |
| Web app | Relay-backed routes under `web/` (`fetchAstraAccount` / account workspace; see inventory doc) | **Relay JSON is canonical** for account surfaces: `plan`, `quota`, `usage` from `/v1/account*` family drive visible numbers and labels. |

## Doc pointers

Relative to the **Node relay** (`server/` — auth, `/v1/account*`, billing, devices, sync, `/v1/translate`):

- **`docs/investigations/control-plane-surface-inventory-2026-04-15.md`** — What the relay *owns* (route table), how extension + web should consume **one** JSON shape for account fields, operator buckets (401, 429, CORS in dev), and mobile/bridge **wording discipline** (experimental until evidence). Use this when deciding whether a string or number is “marketing”, “local-only”, or “API-backed”.

- **`docs/investigations/lifecycle-operations-runbook-month5-2026-04-15.md`** — **Human-run flows** that still hit the same relay APIs: export, cloud delete, sync repair, device revoke — expected states (`idle → running → success/failed`), copy rules (no false immediacy on delete), and **where to prove** each path (web continuity UI / tests, extension revoke). Use this when popup/options/web must describe **lifecycle** outcomes consistently with what `POST`/`GET` actually return.

Together: the **inventory** doc is the *surface + semantics* map against relay; the **runbook** is the *operator + UX state* map for long-running or destructive operations. Neither doc invents new product features — they constrain wording and evidence so every surface points at the same relay contract.
