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

- **Single source of truth**: relay JSON fields (`plan`, `quota`, `usage`) → `fetchAstraAccount` / summary in `src/utils/astra/account.ts` and `web/src/lib/astra-web.ts`.
- **Wording rule**: never show “unlimited” unless API returns explicit sentinel; map `past_due` / `canceled` to the same copy tree in extension + web.

## Mobile web / iOS

- **Narrow viewport**: web `app.tsx` + `styles.css` — smoke checklist in Month 5 ledger.
- **iOS bridge**: `ios/README.md` + bridge checklist; claims stay **Experimental** per base matrix until device evidence.

## Operator notes

- **401 / CONFIG_MISSING**: usually session or relay env; see `AGENTS.md` for relay key restart.
- **429**: quota; link to usage panel.
