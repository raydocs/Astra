# Free Public Launch Backend + Web Deployment Runbook — 2026-05-22

## Scope and authority

This runbook covers **Work Item 2 only** from `docs/plans/commercial-public-launch-2026-05-22.md`: the free public production backend and web deployment path.

Authoritative free public beta API:

- **Cloudflare Workers relay-lite**: `src/platform/relay-lite`

Non-authoritative for paid launch:

- **Node relay**: `src/server/` remains useful for local/dev, compatibility checks, and non-public relay testing. Do not present it as production paid infrastructure.
- **Full Cloudflare platform scaffold**: `src/platform/cloudflare/` remains a migration scaffold for article import, auth/session, device, and sync cutovers. Do not present it as durable paid account/subscription infrastructure.

The free public beta may advertise managed translation only if the relay-lite Worker is deployed with real production secrets, constrained quotas, verified CORS, and a provider budget cap.

## Required external decisions before production deploy

Record these before marking the backend/web path launch-ready:

| Decision | Status on 2026-05-22 | Notes |
|---|---:|---|
| Final public web origin | **Blocker** | Needed for Cloudflare Pages, CORS, store/listing URLs, and smoke tests. Do not assume `astra.app` or any placeholder. |
| Final public relay-lite API base URL ending in `/v1` | **Blocker** | May be a `workers.dev` URL or custom API domain, but must be verified in Cloudflare and recorded here before launch. |
| Optional full platform Worker/API origin | **Blocker if article import is launched** | Needed only if `/v1/import/article` or other platform migration routes are in launch scope. |
| Cloudflare account/project access | **External dependency** | Worker and Pages deploy permissions required. |
| DNS/custom domains | **External dependency** | Needed if not using Cloudflare-generated `workers.dev` / `pages.dev` hosts. |
| OpenRouter production key and budget controls | **External dependency** | Required for relay-lite translation. Configure spend limits outside the repo. |
| Production `ASTRA_SESSION_SECRET` | **External dependency** | Generate a high-entropy secret; store only as a Cloudflare Worker secret. |
| Incident/support owner | **External dependency** | Needed for public launch monitoring and rollback decisions. |

## relay-lite production configuration

File: `src/platform/relay-lite/wrangler.jsonc`

Non-secret vars:

| Var | Purpose | Launch guidance |
|---|---|---|
| `ASTRA_CORS_ALLOWED_ORIGINS` | Comma-separated browser origins allowed to call relay-lite | Replace placeholder with the final verified web origin(s). Do not use `*` in production. |
| `ASTRA_OPENROUTER_MODEL` | OpenRouter model used for managed translation | Keep as the approved launch model only after provider availability and budget controls are confirmed. |
| `ASTRA_FREE_DAILY_REQUESTS` | Displayed free beta daily request quota | Keep conservative; relay-lite currently advertises/static-reports this quota rather than durable per-account enforcement. |
| `ASTRA_FREE_DAILY_CHARACTERS` | Displayed free beta daily character quota | Keep conservative; provider spend controls remain external. |
| `ASTRA_FREE_RPM` | Displayed requests-per-minute limit | Keep conservative. |
| `ASTRA_SESSION_TTL_SECONDS` | Anonymous session token TTL | Default is 30 days (`2592000`). |

Secrets, set per Worker environment and never commit:

```bash
pnpm dlx wrangler secret put OPENROUTER_API_KEY --config src/platform/relay-lite/wrangler.jsonc
pnpm dlx wrangler secret put ASTRA_SESSION_SECRET --config src/platform/relay-lite/wrangler.jsonc
```

## Web production configuration

File: `src/web/.env.production.example`

For a real build:

```bash
cp src/web/.env.production.example src/web/.env.production
# Edit src/web/.env.production before building:
# VITE_ASTRA_API_BASE_URL=https://<final-relay-lite-worker-or-api-domain>/v1
# VITE_ASTRA_PLATFORM_BASE_URL=https://<platform-worker-domain>/v1
```

Rules:

- `VITE_ASTRA_API_BASE_URL` must point to the public relay-lite API base and end in `/v1`.
- `VITE_ASTRA_PLATFORM_BASE_URL` should point to the full platform Worker only if article import is launched; otherwise set it intentionally to the same API base and record that article import is not launched.
- Do not build public web artifacts with placeholders.

## Deploy sequence

### 1. Prepare launch vars

```bash
export ASTRA_WEB_ORIGIN="https://<final-web-origin>"
export ASTRA_API_BASE_URL="https://<final-relay-lite-worker-or-api-domain>/v1"
```

Before continuing, replace `ASTRA_CORS_ALLOWED_ORIGINS` in `src/platform/relay-lite/wrangler.jsonc` with `$ASTRA_WEB_ORIGIN` or the exact comma-separated set of verified web origins.

### 2. Deploy relay-lite Worker

```bash
pnpm dlx wrangler secret put OPENROUTER_API_KEY --config src/platform/relay-lite/wrangler.jsonc
pnpm dlx wrangler secret put ASTRA_SESSION_SECRET --config src/platform/relay-lite/wrangler.jsonc
pnpm deploy:relay-lite:cloudflare
```

Record the deployed Worker URL/API base in `docs/reviews/commercial-launch-backend-smoke-2026-05-22.md`.

### 3. Smoke relay-lite before web deploy

Use the route smoke checks below. Do not proceed if CORS, auth/session, account summary, sync bootstrap, or translate fail for reasons other than an explicitly recorded external blocker.

### 4. Deploy web companion to Cloudflare Pages

```bash
cp src/web/.env.production.example src/web/.env.production
# Replace placeholders in src/web/.env.production.
pnpm deploy:web:cloudflare
```

After Cloudflare Pages reports the production URL, re-run CORS and browser-origin smoke with that exact origin. If the final origin changes, update relay-lite CORS and redeploy relay-lite before launch.

## Smoke checks

Set the tested origins first:

```bash
export ASTRA_WEB_ORIGIN="https://<final-web-origin>"
export ASTRA_API_BASE_URL="https://<final-relay-lite-worker-or-api-domain>/v1"
export ASTRA_DEVICE_ID="public-launch-smoke-$(date +%s)"
```

### CORS preflight from final web origin

```bash
curl -i -X OPTIONS "$ASTRA_API_BASE_URL/auth/anonymous" \
  -H "Origin: $ASTRA_WEB_ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,x-astra-device-id"
```

Expected:

- HTTP `204`
- `access-control-allow-origin` exactly equals `$ASTRA_WEB_ORIGIN`
- `access-control-allow-headers` includes `content-type` and `x-astra-device-id`

### Anonymous auth

```bash
SESSION_JSON=$(curl -sS -X POST "$ASTRA_API_BASE_URL/auth/anonymous" \
  -H "Origin: $ASTRA_WEB_ORIGIN" \
  -H "Content-Type: application/json" \
  -H "X-Astra-Device-Id: $ASTRA_DEVICE_ID" \
  -d "{\"deviceId\":\"$ASTRA_DEVICE_ID\"}")

printf '%s\n' "$SESSION_JSON"
export ASTRA_SESSION_TOKEN=$(printf '%s' "$SESSION_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).sessionToken))")
```

Expected response fields:

- `identityMode: "anonymous"`
- `plan: "free"`
- `subscriptionStatus: "active"` as free-beta/account-active semantics only, not a paid subscription
- `relayBaseURL` equals the deployed relay-lite `/v1` base
- `sessionToken` is present

### Session refresh

```bash
curl -sS "$ASTRA_API_BASE_URL/auth/session" \
  -H "Origin: $ASTRA_WEB_ORIGIN" \
  -H "Authorization: Bearer $ASTRA_SESSION_TOKEN" \
  -H "X-Astra-Device-Id: $ASTRA_DEVICE_ID"
```

Expected: HTTP `200`, same free anonymous session semantics, and no paid entitlement claims.

### Account summary

```bash
curl -sS "$ASTRA_API_BASE_URL/account/summary" \
  -H "Origin: $ASTRA_WEB_ORIGIN" \
  -H "Authorization: Bearer $ASTRA_SESSION_TOKEN" \
  -H "X-Astra-Device-Id: $ASTRA_DEVICE_ID"
```

Expected:

- `account.plan: "free"`
- `account.subscriptionStatus: "active"` only as free-beta active-account state
- one current device entry
- sync collections are present but disabled/default-disabled unless a separate durable sync launch is approved

### Sync bootstrap

```bash
curl -sS "$ASTRA_API_BASE_URL/sync/bootstrap" \
  -H "Origin: $ASTRA_WEB_ORIGIN" \
  -H "Authorization: Bearer $ASTRA_SESSION_TOKEN" \
  -H "X-Astra-Device-Id: $ASTRA_DEVICE_ID"
```

Expected:

- `limits.maxMutationsPerRequest` is present
- collections include `config`, `vocabulary`, `review_schedule`, `reading_history`, and `study_progress`
- every collection reports `enabled: false` and `defaultEnabled: false` for the free public beta unless separately promoted

### Translate

```bash
curl -sS -X POST "$ASTRA_API_BASE_URL/translate" \
  -H "Origin: $ASTRA_WEB_ORIGIN" \
  -H "Authorization: Bearer $ASTRA_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"texts":["Hello, world."],"targetLang":"zh-CN","task":"translate"}'
```

Expected: HTTP `200` with `translations` containing one translated string. If this fails with provider configuration/budget errors, record it as an external blocker; do not substitute a mock response for launch evidence.

## Rollback

Relay-lite rollback options:

1. Cloudflare Dashboard → Workers & Pages → `astra-relay-lite` → Deployments → Rollback to the last known-good deployment.
2. If the failure is CORS/config only, restore the previous non-secret var values in `src/platform/relay-lite/wrangler.jsonc` and redeploy with `pnpm deploy:relay-lite:cloudflare`.
3. If provider spend or abuse is the issue, lower quotas/model, revoke or rotate `OPENROUTER_API_KEY`, and redeploy after confirming the incident owner approves.

Web rollback options:

1. Cloudflare Dashboard → Workers & Pages → Pages project `astra-web` → Deployments → Rollback to the last known-good deployment.
2. If env-only, correct `src/web/.env.production`, rebuild, and redeploy with `pnpm deploy:web:cloudflare`.

Rollback verification repeats CORS, anonymous auth, session refresh, account summary, sync bootstrap, and translate smoke where provider credentials remain enabled.

## Evidence record

Use `docs/reviews/commercial-launch-backend-smoke-2026-05-22.md` for the launch attempt. It must include:

- git SHA
- relay-lite Worker URL/API base
- web Pages URL/origin
- non-secret var values used
- confirmation that secrets were set in Cloudflare, without revealing values
- smoke command status/results
- known blockers
- rollback owner and last known-good deployment reference

## Paid-launch blockers intentionally not solved here

This runbook does not implement or approve:

- checkout, billing portal, webhook receiver, subscription persistence, entitlement enforcement, quota reconciliation, refund/cancel flows, or paid-plan support
- durable account state beyond relay-lite anonymous/session-token semantics
- durable per-account usage enforcement inside relay-lite
- broad sync enablement or cross-device continuity claims

Those remain blocked until Work Item 4 and later launch/legal/support work are complete.
