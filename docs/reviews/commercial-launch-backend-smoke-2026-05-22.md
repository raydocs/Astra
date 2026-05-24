# Commercial Launch Backend Smoke — 2026-05-22

Status: **passed — Cloudflare relay-lite + Pages free-beta deployment smoke completed**

This evidence record belongs to Work Item 2 in `docs/plans/commercial-public-launch-2026-05-22.md`.

## Scope

- Backend: `src/platform/relay-lite` Cloudflare Worker as the free public beta API front door.
- Web: `src/web` Cloudflare Pages deployment configured with `VITE_ASTRA_API_BASE_URL` and `VITE_ASTRA_PLATFORM_BASE_URL`.
- Explicitly out of scope: browser-store submission/approval, legal/privacy approval, paid subscriptions, durable paid entitlements, and full Cloudflare platform migration approval.

## Deployment metadata

| Field | Value |
|---|---|
| Git SHA deployed from | `9b5d9f9` plus local CORS/env documentation update in this pass |
| Relay-lite Worker URL | `https://astra-relay-lite.courseshare.workers.dev` |
| Relay-lite API base URL ending `/v1` | `https://astra-relay-lite.courseshare.workers.dev/v1` |
| Web Pages production origin | `https://astra-web.pages.dev` |
| Web Pages deployment URL | `https://55846464.astra-web.pages.dev` |
| Optional platform Worker API base URL | Not launched; web points platform base to relay-lite `/v1` for this free-beta deployment. |
| Deployer | `ruiruiwan8@gmail.com` Cloudflare account via Wrangler OAuth |
| Deployment time | 2026-05-24 UTC |
| Relay-lite version ID | `35e5fd09-46fa-43a6-b188-ed9d1c0fe6b6` |
| Rollback owner | Not separately assigned; same Cloudflare account/deployer for this pass. |

## Non-secret production vars

| Var | Value used |
|---|---|
| `ASTRA_CORS_ALLOWED_ORIGINS` | `https://astra-web.pages.dev` |
| `ASTRA_OPENROUTER_MODEL` | `openai/gpt-4o-mini` |
| `ASTRA_FREE_DAILY_REQUESTS` | `200` |
| `ASTRA_FREE_DAILY_CHARACTERS` | `200000` |
| `ASTRA_FREE_RPM` | `20` |
| `ASTRA_SESSION_TTL_SECONDS` | `2592000` |

## Secret setup confirmation

Do not paste secret values.

| Secret | Confirmed in Cloudflare? | Notes |
|---|---:|---|
| `OPENROUTER_API_KEY` | Yes, functionally confirmed | `POST /v1/translate` returned a real translation. Provider budget controls remain an external account operation. |
| `ASTRA_SESSION_SECRET` | Yes, functionally confirmed | Anonymous auth/session endpoints issued and verified signed bearer sessions. |

## Smoke matrix

Commands were run from `/Users/ruirui/Downloads/GitHub/Astra` against the final public origins.

| Smoke check | Status | Evidence / notes |
|---|---:|---|
| Web production origin responds | Pass | `curl -I https://astra-web.pages.dev` returned `HTTP/2 200`. |
| Web bundle uses relay-lite API URL | Pass | Production JS contains `https://astra-relay-lite.courseshare.workers.dev/v1`. |
| CORS preflight from final web origin | Pass | `OPTIONS /v1/auth/anonymous` returned `204` and `access-control-allow-origin: https://astra-web.pages.dev`. |
| `POST /v1/auth/anonymous` | Pass | Returned `identityMode: anonymous`, `plan: free`, `relayBaseURL: https://astra-relay-lite.courseshare.workers.dev/v1`, and a session token. |
| `GET /v1/auth/session` | Pass | Bearer session refresh returned anonymous/free session semantics. |
| `GET /v1/account/summary` | Pass | Returned free quota: 200 daily requests, 200000 daily characters, 20 RPM. |
| `GET /v1/sync/bootstrap` | Pass | Endpoint returned successfully with default/empty bootstrap state. |
| `POST /v1/translate` | Pass | `Hello, world.` translated to `你好，世界。`. |
| Web build/deploy with production env | Pass | `pnpm deploy:web:cloudflare` ran `pnpm build:web` and deployed 12 files. Vite emitted chunk-size warning only. |
| Relay-lite deploy | Pass | `pnpm deploy:relay-lite:cloudflare` uploaded and deployed Worker version `35e5fd09-46fa-43a6-b188-ed9d1c0fe6b6`. |

## Remaining external launch blockers

- Browser-store submissions and approvals are not evidenced here.
- Legal/privacy review and support/incident ownership are not evidenced here.
- Provider spend/budget controls are not inspectable from this repo evidence and should be confirmed in the provider account before broad public traffic.
- Paid launch remains blocked by `docs/runbooks/billing-free-policy.md`.

## Verdict

`passed`

The free public beta backend and Astra Web Cloudflare deployment are live and smoke-tested. This does not by itself make Astra commercially launched through browser stores; store/legal/support gates remain separate.
