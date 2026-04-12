# Device Management Execution Spec

**Status:** Draft  
**Date:** 2026-04-12  
**Plan source:** `docs/investigations/astra-cross-device-translation-strategy-pack-2026-04-09.md`

## 1. Scope and document boundary

This spec defines Astra's device identity and device/session management contract for supported signed-in clients.

It covers:

- device identity
- ownership matrix for device/session concerns
- session durability and revocation semantics
- device registry expectations
- privacy boundaries
- auth/device API expectations
- rollout phases
- explicit out-of-scope items

It does **not** redefine:

- sync collection scope and merge rules beyond device prerequisites (owned by `docs/specs/cross-device-sync.md`)
- support-level/platform claims (owned by the concurrent support-matrix doc)
- Web/PWA product surface or UX definition (owned by `docs/specs/web-pwa-companion.md`)

## 2. Current baseline in code

Current behavior is account-aware but not device-aware:

- `src/utils/storage/auth.ts` stores one local `AstraSession`
- `src/utils/astra/auth.ts` supports create/refresh/revoke against `/auth/session`
- `server/auth.ts` issues a signed bearer token containing only:
  - `email`
  - `relayBaseURL`
  - `issuedAt`
- `server/index.ts` revokes sessions using an in-memory `Set`, so revocation is not durable across server restarts
- `server/user-store.ts` persists users and usage, but not sessions or devices
- `server/types.ts` has `installId` only for anonymous users
- `POST /v1/auth/anonymous` can accept an `installId`, but `src/entrypoints/background/index.ts` currently does **not** send one

Implication: Astra can authenticate a user, but it cannot yet answer “which device is this?”, “what other devices are signed in?”, or “did a remote revoke survive a restart?”.

## 2.1 Explicit implementation gate

Device management v1 is blocked on a durable server-side session/device store. The current combination of stateless signed claims plus in-memory revoke tracking is insufficient for:

- current-device identification
- durable remote revoke
- multi-device listing
- device-bound session validation

No device-management UI or claim should ship before that storage layer exists.

## 3. Product principles

1. **Every installation/profile gets a stable device identity.**
2. **Sessions are device-bound and durably revocable.**
3. **Logging out this device and revoking another device are different actions.**
4. **Device management stores coarse product metadata, not browsing activity.**
5. **Device management v1 is for authenticated accounts only.** Anonymous bootstrap may reuse the same device id, but anonymous usage is not a full device-management product surface.

## 4. Ownership matrix

| Domain | Canonical owner | Local cache | Notes |
|---|---|---:|---|
| Device id generation | Client | Yes | Generated once per installation/profile |
| Default device label suggestion | Client | Yes | Example: `Chrome on macOS` |
| Device registry record | Server | Read-only cache allowed | Source of truth for list, status, timestamps |
| Session issuance/refresh/revoke | Server | Yes | Client stores current session snapshot only |
| Current-device indicator | Server | Optional | Determined from authenticated `deviceId` |
| Device rename | Server | Yes | Last-writer-wins on label |
| Remote sign-out / revoke | Server | No | Must be durable |
| Last seen / last sync timestamps | Server | Optional | Updated from authenticated traffic |
| Security/audit logs | Server | No | Separate from user-visible registry |

## 5. Device identity contract

## 5.1 Device id

Astra must introduce a stable client-generated device identity stored separately from auth/session data.

Requirements:

- generated on first run for each installation/profile
- stored locally under a dedicated key (for example `astra.device.v1`)
- survives sign-in/sign-out
- reset only when local Astra data is cleared or the installation/profile is replaced
- UUIDv7 preferred; any collision-resistant opaque identifier is acceptable

## 5.2 Device metadata

Each device registry record must contain only coarse product metadata:

- `deviceId`
- `label`
- `platform` (for example `macos`, `windows`, `ios`)
- `browserFamily` (for example `chrome`, `firefox`, `safari`)
- `appKind` (`extension`, later possibly `web`/`pwa`)
- `appVersion`
- `firstSeenAt`
- `lastSeenAt`
- `lastSyncAt` (nullable until sync ships)
- `status` (`active`, `revoked`)
- `isCurrentDevice` (derived in responses, not persisted)

## 5.3 Backward compatibility with current `installId`

For anonymous bootstrap, the same client-generated device id may be sent as the current server's `installId` field until the auth API is expanded.

Rule:

- `deviceId` is the long-term canonical concept
- `installId` is a temporary compatibility field for anonymous reuse only
- anonymous identities are not listed in device-management UI in v1
- device-management controls (`GET /devices`, rename, remote revoke) apply only to authenticated accounts in v1

## 6. Session model requirements

## 6.1 Session shape

The current `AstraSession` must evolve to become device-aware.

Minimum additions:

- `sessionId`
- `deviceId`
- `issuedAt`
- `expiresAt` *(nullable only if product explicitly chooses non-expiring sessions)*
- `identityMode` (`anonymous` | `authenticated`)

The client may keep storing a session snapshot locally, but the server must persist the authoritative session record.

## 6.2 Token model

The bearer token may remain signed or become opaque, but the server must be able to durably answer:

- whether the session still exists
- which device it belongs to
- whether the device is revoked
- whether the session is expired

Therefore, stateless signed claims alone are insufficient for the target model.

## 6.3 Revocation semantics

- `DELETE /auth/session` revokes the **current session on the current device only**
- remote revoke revokes **all live sessions** for the target device unless explicitly scoped otherwise later
- revoked sessions remain revoked across process restart
- remote revoke wins over concurrent local refresh
- a revoked device may sign in again only through a fresh explicit auth flow

## 7. Device registry behavior

## 7.1 Registry creation/update

The server must upsert a device registry record when:

- anonymous bootstrap occurs with a device id
- credential sign-in succeeds
- session refresh succeeds
- sync traffic arrives with a valid session and device id

## 7.2 Timestamps

- `firstSeenAt`: set once on initial registry creation
- `lastSeenAt`: updated on successful authenticated session or device-aware activity
- `lastSyncAt`: updated only after successful sync activity, not plain auth refresh

## 7.3 Label rules

- default label is client-suggested, server-stored
- users may rename a device
- label conflicts use last-writer-wins by server timestamp
- server may reject empty/overlong labels

## 8. Auth and device API expectations

All routes continue to live under the existing `/v1` Astra relay base URL convention.

## 8.1 Request requirements

Authenticated auth/device endpoints must require:

- bearer session token
- `X-Astra-Device-Id` header on refresh/revoke/device endpoints

## 8.2 Minimum API surface

### `POST /v1/auth/anonymous`

Accepts:

- `deviceId` or compatibility `installId`
- coarse client metadata

Behavior:

- reuses existing anonymous identity for the same device id when allowed
- creates a new anonymous identity otherwise
- does not expose anonymous identities through account device-management UI in v1

Cloudflare cutover note: `POST /v1/auth/anonymous` now rolls out behind `AUTH_ANONYMOUS_ISSUE_MODE=proxy|shadow|native`. In `shadow`, the Worker only does bootstrap preflight/parity checks and never mints a second anonymous session. In `native`, the Worker uses the D1 anonymous-identity + issuance-ledger foundation, requires a first-party `Idempotency-Key`, and does not return success until the mirrored device/session has been committed back to Node. Ambiguous mirror-back outcomes return a guarded `503` so the same key can be retried safely.

### `POST /v1/auth/session`

Accepts:

- credentials
- `deviceId`
- coarse client metadata

Returns a device-bound session.

Cloudflare cutover note: `POST /v1/auth/session` now rolls out behind `AUTH_SESSION_ISSUE_MODE=proxy|shadow|native`. In `shadow`, the Worker proxies the live Node response and only performs credential/parity preflight so it never mints a second session. In `native`, the Worker verifies credentials from D1 `shadow_user_credentials`, records the request in the issuance ledger, requires a first-party `Idempotency-Key`, and does not return success until the mirrored device/session has been committed back to Node. Ambiguous mirror-back outcomes return a guarded `503` so the same key can be retried safely, while the public request/response contract remains unchanged.

### `GET /v1/auth/session`

Validates/refreshes the current session for the provided `deviceId`.

Cloudflare cutover note: `AUTH_SESSION_READ_MODE` now allows `proxy -> shadow -> native` rollout for this read only. In `native`, the Worker validates the bearer token locally with the shared session-token helper plus `ASTRA_SESSION_SECRET`, reads the current session/account usage snapshot from D1 shadow state, and keeps Node as the compare/fallback path. Issuance now cuts over separately behind `AUTH_ANONYMOUS_ISSUE_MODE` and `AUTH_SESSION_ISSUE_MODE`, while preserving the existing public session contract.

Must fail distinctly when:

- session is revoked
- device is revoked
- session is expired
- device id does not match the bound session

### `DELETE /v1/auth/session`

Revokes the current session for the current device.

Cloudflare cutover note: `AUTH_SESSION_REVOKE_WRITE_MODE` now allows `proxy -> native` rollout for current-session revoke only. In `native`, the Worker locally validates the bound session/device, marks the D1 shadow session revoked, mirror-backs the delete to Node, rolls back on definitive mirror-back rejection, and returns a guarded `503` if the mirror-back transport outcome is ambiguous. Rollback remains a config flip back to `proxy`.

### `GET /v1/devices`

Returns the current account's device registry list, including:

- device metadata
- current-device marker
- last seen/sync timestamps
- status

### `PATCH /v1/devices/:deviceId`

Supports device label updates.

### `POST /v1/devices/:deviceId/revoke`

Revokes the target device's active sessions and marks the device revoked.

Cloudflare cutover note: the first authoritative Worker-owned write seam for this endpoint is guarded by `DEVICE_REVOKE_WRITE_MODE`. In `native`, the Worker performs the authenticated remote revoke in D1 first, then mirror-backs the same revoke to the Node relay so adjacent Node-served device/session reads and writes remain compatible. If the Worker cannot safely proceed before or after a definitive Node response, it falls back to Node; if the mirror-back transport result is ambiguous, it returns a guarded `503` rather than guessing between rollback and retry. Rollback remains a single config flip back to `proxy`.

### `POST /v1/devices/revoke-others` *(phase 2+ optional)*

Revokes every other device except the current one.

## 8.3 Error semantics

Device-aware auth must distinguish at least:

- `SESSION_REVOKED`
- `DEVICE_REVOKED`
- `SESSION_EXPIRED`
- `DEVICE_MISMATCH`
- `DEVICE_LIMIT_EXCEEDED` *(if a cap is introduced later)*
- `REAUTH_REQUIRED`

## 9. Conflict and edge-case rules

- **Label update vs label update:** last-writer-wins
- **Remote revoke vs local refresh:** revoke wins
- **Session refresh with wrong device id:** reject as `DEVICE_MISMATCH`
- **Server restart after revoke:** revoked state must remain effective
- **Reinstall/new browser profile:** treated as a new device unless local device state is migrated
- **Anonymous to authenticated transition:** the device id persists; account-link/identity-merge details are separate product work

## 10. Privacy boundaries

## 10.1 Allowed device data

Device management may store:

- opaque device id
- coarse platform/browser/app metadata
- user-visible label
- last seen/sync timestamps
- status flags

## 10.2 Disallowed device data

Device management must not store in the device registry:

- reading history
- page URLs
- vocabulary content
- translation requests/responses
- page titles from browsing activity
- fine-grained fingerprint material

IP address, user agent, or abuse-defense logs may exist in separate server security logs, but they are not part of the product-facing device registry contract.

## 11. Rollout phases

### Phase 0 — Identity prerequisite

- generate/store local `deviceId`
- send it on anonymous bootstrap and session auth flows
- extend session schema with device-bound fields

### Phase 1 — Durable session registry

- persist sessions server-side
- persist revocation state server-side
- add `GET /devices`
- show current device + recent devices in account surfaces
- authenticated accounts only; anonymous installs remain out of scope for device-management UI

Success bar:

- user can see which supported clients are signed in, and revocation survives restart

### Phase 2 — Active device controls

- rename device
- revoke another device
- revoke others flow
- clearer session-expired/device-revoked UX in popup/options

Success bar:

- user can remove stale access without touching local files or reinstalling the extension

### Phase 3 — Hardening

- device/session limits if needed
- suspicious-session signals
- auditability and support tooling
- cross-surface reuse for future Web/PWA clients

## 12. Out of scope

This spec explicitly does not define:

- browser/platform support tiers
- Web/PWA companion UX or navigation
- sync collection payloads beyond device prerequisites
- SSO, passkeys, MFA, or broader auth modernization
- geo-based device trust scoring
- push/email security notifications
- anonymous-to-authenticated account merge UX
- family/shared account device policies

## 13. Execution checkpoints

Before implementation starts, the team should be able to answer “yes” to all of the following:

- a stable device identity exists outside session state
- session revocation is durable, not in-memory only
- current-device logout and remote-device revoke are separate semantics
- device registry fields are coarse and privacy-bounded
- anonymous `installId` compatibility does not replace the long-term `deviceId` model
- support-matrix and Web/PWA scope remain delegated to their parallel docs
