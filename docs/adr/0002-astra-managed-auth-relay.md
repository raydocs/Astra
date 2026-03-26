# ADR 0002: Astra-Managed Auth and Relay

## Status

Accepted

## Context

Astra is moving away from a BYOK translation model. The browser extension should not require end users to paste raw OpenAI or Gemini provider keys into the popup.

That architecture is not safe for a consumer product:

- provider keys shipped to or stored in the extension can be extracted
- billing, rate limits, and provider access control cannot be enforced centrally
- subscription state cannot be tied cleanly to translation access

The extension still needs a configurable backend base URL for local development, staging, and self-hosted relay environments.

## Decision

Astra uses an **Astra-managed relay** architecture.

### Extension-side responsibilities

- Store product configuration:
  - provider id (`openai` or `gemini`)
  - selected model
  - Astra relay base URL
- Store Astra session state separately from product config:
  - session token
  - user email
  - plan snapshot
  - provider entitlements snapshot
  - expiry
- Inject the Astra session token into translation requests at runtime
- Refresh account profile and usage snapshots independently from session refresh

### Server-side responsibilities

- Authenticate users
- Issue Astra session tokens
- Expose account profile and usage snapshot endpoints
- Check subscription state and provider entitlement
- Enforce quotas and rate limits
- Record translation usage
- Route translation calls to OpenAI or Gemini
- Keep upstream provider credentials on the server only

## API Contract

### `POST /auth/session`

Create a session from user credentials.

Request:

```json
{
  "email": "user@example.com",
  "password": "secret-pass"
}
```

Response:

```json
{
  "version": 1,
  "sessionToken": "astra_session_token",
  "relayBaseURL": "https://api.astra.example/v1",
  "email": "user@example.com",
  "plan": "pro",
  "providerEntitlements": ["openai", "gemini"],
  "expiresAt": null
}
```

### `GET /auth/session`

Refresh or validate the current session.

Headers:

```text
Authorization: Bearer astra_session_token
```

Response body matches `POST /auth/session`.

### `DELETE /auth/session`

Revoke the current session.

Headers:

```text
Authorization: Bearer astra_session_token
```

Response:

- `204 No Content` on success

### `GET /account`

Return the current account profile.

Headers:

```text
Authorization: Bearer astra_session_token
```

Response:

```json
{
  "id": "usr_abcd1234",
  "relayBaseURL": "https://api.astra.example/v1",
  "email": "user@example.com",
  "billingEmail": "billing@example.com",
  "createdAt": "2026-03-01T00:00:00.000Z",
  "plan": "pro",
  "subscriptionStatus": "active",
  "providerEntitlements": ["openai", "gemini"]
}
```

### `GET /account/usage`

Return the latest usage and quota snapshot for the signed-in user.

Headers:

```text
Authorization: Bearer astra_session_token
```

Response:

```json
{
  "generatedAt": "2026-03-26T00:00:00.000Z",
  "quota": {
    "dailyRequestsLimit": 2000,
    "dailyCharactersLimit": 500000,
    "requestsPerMinuteLimit": 120,
    "remainingDailyRequests": 1999,
    "remainingDailyCharacters": 499995
  },
  "usage": {
    "totalRequests": 1,
    "totalCharacters": 5,
    "dailyRequestsUsed": 1,
    "dailyCharactersUsed": 5,
    "lastRequestAt": "2026-03-26T00:00:00.000Z",
    "recentEvents": []
  }
}
```

### `PATCH /account/plan`

Update the current account plan for local billing and entitlement drills.

Headers:

```text
Authorization: Bearer astra_session_token
Content-Type: application/json
```

Request:

```json
{
  "plan": "free"
}
```

Response body matches `GET /account`.

### `POST /billing/checkout`

Create a checkout redirect for a target plan.

Headers:

```text
Authorization: Bearer astra_session_token
Content-Type: application/json
```

Request:

```json
{
  "plan": "pro"
}
```

Response:

```json
{
  "kind": "checkout",
  "url": "https://billing.example/checkout?...",
  "generatedAt": "2026-03-26T00:00:00.000Z",
  "plan": "pro"
}
```

### `POST /billing/portal`

Create a billing portal redirect for the signed-in account.

Headers:

```text
Authorization: Bearer astra_session_token
Content-Type: application/json
```

Response:

```json
{
  "kind": "portal",
  "url": "https://billing.example/portal?...",
  "generatedAt": "2026-03-26T00:00:00.000Z",
  "plan": "pro"
}
```

### `POST /translate`

Translate or explain text through the Astra relay.

Headers:

```text
Authorization: Bearer astra_session_token
Content-Type: application/json
```

Request:

```json
{
  "provider": "openai",
  "model": "gpt-5.4-nano",
  "texts": ["Hello world"],
  "targetLang": "zh-CN",
  "task": "translate",
  "context": {
    "pageTitle": "Example"
  }
}
```

Response:

```json
{
  "translations": ["你好，世界"]
}
```

## Consequences

### Positive

- Users pay Astra directly instead of managing provider keys
- Provider credentials stay server-side
- Subscription and rate-limit enforcement become possible
- Provider switching stays a product decision, not a user ops task

### Tradeoffs

- Astra now requires a backend for production use
- Login and session refresh must be treated as first-class product flows
- Account refresh and usage refresh become first-class popup flows
- The extension cannot be fully “offline-configurable” with direct provider usage anymore

## Implementation Notes

- Session storage key: `astra.auth.v1`
- Product config storage key: `astra.config.v1`
- Runtime translation reads both config and session, then resolves a managed provider object before dispatch
- Popup account UI reads session, then hydrates `/account` and `/account/usage` for fresher billing and quota state
- Popup account UI can switch plans via `/account/plan`, then refresh session/account/usage snapshots
- Popup account UI can open checkout and billing portal flows via `/billing/checkout` and `/billing/portal`
- Bench and local tests may still inject provider access directly for isolated scenario execution
- The current in-repo relay uses a file-backed user database and is meant as a development baseline, not a production user system
