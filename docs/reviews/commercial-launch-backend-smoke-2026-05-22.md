# Commercial Launch Backend Smoke — 2026-05-22

Status: **not executed — external launch blockers remain**

This evidence record belongs to Work Item 2 in `docs/plans/commercial-public-launch-2026-05-22.md` and should be filled during the first real free-public relay-lite + web deployment attempt.

## Scope

- Backend: `src/platform/relay-lite` Cloudflare Worker as the free public beta API front door.
- Web: `src/web` Cloudflare Pages deployment configured with `VITE_ASTRA_API_BASE_URL` and, if applicable, `VITE_ASTRA_PLATFORM_BASE_URL`.
- Explicitly out of scope: store copy/privacy/listing files, billing policy, paid subscriptions, durable paid entitlements, and full Cloudflare platform migration approval.

## Deployment metadata

| Field | Value |
|---|---|
| Git SHA | `TBD` |
| Relay-lite Worker URL | `TBD` |
| Relay-lite API base URL ending `/v1` | `TBD` |
| Web Pages URL/origin | `TBD` |
| Optional platform Worker API base URL | `TBD / not launched` |
| Deployer | `TBD` |
| Deployment time | `TBD` |
| Rollback owner | `TBD` |
| Last known-good deployment reference | `TBD` |

## Non-secret production vars

| Var | Value used |
|---|---|
| `ASTRA_CORS_ALLOWED_ORIGINS` | `TBD` |
| `ASTRA_OPENROUTER_MODEL` | `TBD` |
| `ASTRA_FREE_DAILY_REQUESTS` | `TBD` |
| `ASTRA_FREE_DAILY_CHARACTERS` | `TBD` |
| `ASTRA_FREE_RPM` | `TBD` |
| `ASTRA_SESSION_TTL_SECONDS` | `TBD` |

## Secret setup confirmation

Do not paste secret values.

| Secret | Confirmed in Cloudflare? | Notes |
|---|---:|---|
| `OPENROUTER_API_KEY` | `TBD` | Provider budget controls must be enabled outside the repo. |
| `ASTRA_SESSION_SECRET` | `TBD` | Production high-entropy secret, not shared with local/dev. |

## Smoke matrix

Run the exact commands from `docs/runbooks/free-public-launch-backend.md`.

| Smoke check | Status | Evidence / notes |
|---|---:|---|
| CORS preflight from final web origin | `TBD` | Must return final origin, not `*`. |
| `POST /v1/auth/anonymous` | `TBD` | Anonymous free session token issued. |
| `GET /v1/auth/session` | `TBD` | Session refresh works. |
| `GET /v1/account/summary` | `TBD` | Free active-account semantics only. |
| `GET /v1/sync/bootstrap` | `TBD` | Collections present and disabled/default-disabled. |
| `POST /v1/translate` | `TBD` | Requires real provider key and budget controls. |
| Web build with production env | `TBD` | `pnpm build:web` or `pnpm deploy:web:cloudflare`. |
| Web-to-relay browser-origin smoke | `TBD` | Re-run after final Pages/custom origin exists. |

## Current blockers

- Final public web origin is not recorded.
- Final relay-lite API base URL is not recorded.
- Cloudflare account/project/DNS access is external to the repo.
- Production OpenRouter key and provider budget controls are external to the repo.
- Production `ASTRA_SESSION_SECRET` must be generated and installed as a Worker secret.
- Optional platform Worker origin is unresolved if article import is intended for launch.

## Verdict

`blocked`

Do not mark Work Item 2 deployment evidence `ready` until the blockers above are resolved and the smoke matrix passes against the final public origins.
