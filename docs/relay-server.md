# Astra Relay Server

This repo now includes a minimal Astra-managed backend for local development and contract validation.

## What it provides

- `POST /v1/auth/session`
- `GET /v1/auth/session`
- `DELETE /v1/auth/session`
- `GET /v1/account`
- `GET /v1/account/usage`
- `PATCH /v1/account/plan`
- `POST /v1/billing/checkout`
- `POST /v1/billing/portal`
- `POST /v1/translate`

The popup login flow and relay client in the extension are designed against these endpoints.

## Current Server Capabilities

- File-backed user store
- Session signing and verification
- Subscription status on the session payload
- Account profile endpoint for plan and billing metadata
- Plan mutation endpoint for local billing and entitlement drills
- Billing intent endpoints for checkout and subscription portal redirects
- Provider entitlement checks
- Daily request quota
- Daily character quota
- Per-minute rate limiting
- Usage summary and recent usage events
- Usage snapshot endpoint for popup refresh and future billing UI

## Run locally

```bash
export ASTRA_RELAY_EMAIL="demo@astra.local"
export ASTRA_RELAY_PASSWORD="astra-demo-pass"
export ASTRA_SESSION_SECRET="replace-me"
export OPENAI_API_KEY="sk-..."
export GOOGLE_GENERATIVE_AI_API_KEY="..."

pnpm relay:start
```

Default local base URL:

```text
http://127.0.0.1:8787/v1
```

For live reload during backend work:

```bash
pnpm relay:dev
```

## Environment Variables

- `ASTRA_RELAY_PORT`
- `ASTRA_RELAY_HOST`
- `ASTRA_PUBLIC_BASE_URL`
- `ASTRA_CORS_ALLOWED_ORIGINS`
- `ASTRA_SESSION_SECRET`
- `ASTRA_RELAY_EMAIL`
- `ASTRA_RELAY_PASSWORD`
- `ASTRA_RELAY_PLAN`
- `ASTRA_RELAY_SUBSCRIPTION_STATUS`
- `ASTRA_PROVIDER_ENTITLEMENTS`
- `ASTRA_RELAY_DATA_DIR`
- `ASTRA_DATA_DIR`
- `ASTRA_USER_DB_PATH`
- `ASTRA_VIDEO_NOTE_STORE_PATH`
- `ASTRA_BILLING_CHECKOUT_URL`
- `ASTRA_BILLING_PORTAL_URL`
- `OPENAI_API_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`

## Notes

- This is a minimal in-repo relay, not a production deployment target.
- `DELETE /v1/auth/session` currently revokes the token in-memory for the current process.
- The user store is file-backed and seeded from env vars only when the file does not exist yet.
- Relay data path precedence is explicit file paths (`ASTRA_USER_DB_PATH`, `ASTRA_VIDEO_NOTE_STORE_PATH`) > `ASTRA_RELAY_DATA_DIR` > `ASTRA_DATA_DIR` > `server/data`.
- Existing user DB files are migrated in-place with generated `id`, `billingEmail`, and `createdAt` fields when missing.
- Current local plan policy:
  - `free`: `openai` only, `100` daily requests, `50_000` daily characters, `10` requests/minute
  - `pro`: `openai` + `gemini`, `2000` daily requests, `500_000` daily characters, `120` requests/minute
- Billing endpoints currently return redirect URLs. By default they point at local mock routes derived from `ASTRA_PUBLIC_BASE_URL`, but you can override them with `ASTRA_BILLING_CHECKOUT_URL` and `ASTRA_BILLING_PORTAL_URL`.
- For production you will still want durable sessions, billing checks, rate limiting, audit logs, and proper user storage.
- Browser clients on a separate origin need `ASTRA_CORS_ALLOWED_ORIGINS` set to the deployed Pages origin, for example `https://astra.app,https://www.astra.app`.
