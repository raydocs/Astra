# Cloudflare Platform Execution Spec

**Status:** Draft  
**Date:** 2026-04-12  
**Scope:** Platform scaffold plus reversible Worker-owned import/auth/device/sync seams, including scoped auth issuance cutover while keeping adjacent account/billing/translate authority on Node

## 1. Goal and document boundary

This spec defines Astra's Cloudflare-first platform layer as an additive scaffold in front of the current relay.

It covers:

- Cloudflare product mapping for Astra's current and near-term backend needs
- route ownership and migration boundaries
- an initial Worker + D1 + R2 + KV + Queues scaffold
- reversible Worker-owned seams for article import, device reads/writes, and sync reads/writes
- consistency/backfill, observability, governance, and deployment expectations for those seams
- a Durable Objects decision rubric
- a phased migration path that continues from those seams into later auth/session evolution

It does **not**:

- replace the current Node relay in `server/`
- redefine auth/session/device/sync product contracts already covered by:
  - `docs/adr/0002-astra-managed-auth-relay.md`
  - `docs/specs/device-management.md`
  - `docs/specs/cross-device-sync.md`
- commit Astra to full edge-native parity for every API surface in one step

## 2. Current baseline in code

Today, Astra's server authority is the in-repo Node relay:

- `server/index.ts` owns HTTP routing for auth, account, usage, billing, translate, article import, devices, and sync
- `server/user-store.ts` owns durable user, session, device, and sync state for the current implementation
- `src/utils/astra/auth.ts` and `src/utils/astra/account.ts` treat the relay as the canonical API boundary
- `web/src/lib/article-import.ts` already isolates article import behind `POST /v1/import/article` and falls back to browser-side import when the relay path is unavailable
- `platform/cloudflare/src/handlers/article-import.ts` now provides the reversible proxy/shadow/native seam for that route
- `platform/cloudflare/src/handlers/article-import-observability.ts` exposes import-only rollout/queue visibility without broadening route ownership
- `platform/cloudflare/src/handlers/platform-observability.ts` exposes unified route/parity/governance visibility across the currently gated domains
- `server/cloudflare-shadow-cli.ts` now provides audit, verify, dry-run backfill, and additive backfill-apply tooling for the shadow auth/session/device/sync state

Implication:

- article import is still the cleanest first migration seam
- device/sync now have reversible route-by-route Cloudflare seams for selected reads/writes
- adjacent account/billing/translate authority remain Node-owned while auth issuance moves route-by-route behind reversible Worker gates

## 3. Cloudflare product boundary mapping

This design uses official Cloudflare product boundaries as the reference:

- **Workers**: edge HTTP ingress, routing, proxying, and future route ownership  
  https://developers.cloudflare.com/workers/
- **D1**: relational metadata, cursors, and small authoritative tables  
  https://developers.cloudflare.com/d1/
- **R2**: large or opaque objects such as imported payload captures and future artifacts  
  https://developers.cloudflare.com/r2/
- **Workers KV**: global low-latency, non-authoritative cache/idempotency state  
  https://developers.cloudflare.com/kv/
- **Queues**: at-least-once retryable background processing with batching  
  https://developers.cloudflare.com/queues/
  - article-import validation/replay work
  - continuity export bundle generation and cloud-data-delete execution
- **Durable Objects**: per-entity coordination and strongly consistent serialized workflows when multiple clients need to coordinate around shared state  
  https://developers.cloudflare.com/durable-objects/

### 3.1 Astra-to-product mapping

| Astra need | Cloudflare product | Why |
|---|---|---|
| Edge entrypoint, route gating, proxying | Workers | Stateless ingress and gradual route ownership |
| Import shadow-job metadata, future session/device/sync tables | D1 | Relational state and cursor/query patterns fit D1 |
| Continuity export/delete job metadata and retention policy state | D1 | Queue/stateful control-plane jobs need pollable relational status |
| Raw import payloads, snapshots, future export artifacts | R2 | Large blobs should not live in D1 or Queue payloads |
| Best-effort idempotency keys and short-TTL edge hints | KV | Fast, non-authoritative lookup state |
| Background import processing and later compaction/rebuild work | Queues | Async retry-safe work off the request path |
| Per-user sync coordination only if concurrent native sync writes need serialization | Durable Objects | Strongly consistent coordination boundary, not default storage |

### 3.2 Explicit non-mapping

This scaffold does **not** use:

- KV as a source of truth for auth/session/device/sync
- R2 as a primary relational store
- Durable Objects as a default replacement for D1

## 4. Route ownership model

The Cloudflare Worker starts as a front door and platform shell, not as the new authority for every route.

| Route family | Initial owner | Worker behavior in scaffold | Future target |
|---|---|---|---|
| `GET /__platform/health` | Worker | Worker-owned | Worker-owned |
| `GET /__platform/observability` | Worker | Worker-owned operator surface backed by D1 metrics/events | Worker-owned |
| `POST /v1/import/article` | Node by default, Worker in `native` mode | proxy/shadow/native, with relay fallback kept for rollout safety | first Worker-owned route |
| `GET /v1/auth/session` | Node by default, Worker in `shadow`/`native` mode | `proxy` / `shadow` / `native` read gate with local Worker session validation and Node compare/fallback | continuity auth/session read seam |
| `DELETE /v1/auth/session` | Node by default, Worker in `native` mode | reversible `proxy` / `native` current-session revoke with D1 authoritative revoke + explicit Node mirror-back | first auth/session revoke seam |
| `POST /v1/auth/anonymous` | Node by default, Worker in `shadow`/`native` mode | `proxy` / `shadow` / `native` anonymous issuance gate with D1 authority, issuance-ledger idempotency, and required Node mirror-back before success | first public auth issuance seam |
| `POST /v1/auth/session` | Node by default, Worker in `shadow`/`native` mode | `proxy` / `shadow` / `native` authenticated issuance gate with D1 credential authority, issuance-ledger idempotency, and required Node mirror-back before success | authenticated auth issuance seam |
| `/v1/auth/*` (other routes) | Node | proxy only for public traffic | later migration |
| `GET /v1/account/summary` | Node by default, Worker in `shadow`/`native` mode | `proxy` / `shadow` / `native` continuity/control-plane summary read with local Worker session validation and D1 compare/fallback | first account/control-plane read seam |
| `POST /v1/account/export` + `GET /v1/account/export/:jobId` + `GET /v1/account/export/:jobId/download` | Worker | Worker-owned queue-backed continuity export lifecycle over D1 job metadata + governed R2 artifacts | continuity export control-plane |
| `POST /v1/account/cloud-data-delete` + `GET /v1/account/cloud-data-delete/:jobId` | Worker | Worker-owned queue-backed collection-scoped delete lifecycle with grace scheduling and sync-aligned delete-mutation fanout | continuity delete control-plane |
| `/v1/account/*` (other routes) | Node | proxy only | later migration if needed |
| `/v1/billing/*` | Node | proxy only | later migration if needed |
| `/v1/translate` | Node | proxy only | later migration if needed |
| `/v1/devices` (`GET`) | Node-auth + Worker-gated D1 read | `proxy` / `shadow` / `native` gate with rollback-by-config | first auth/session/device read cutover |
| `POST /v1/devices/:deviceId/revoke` | Node by default, Worker in `native` mode | reversible `proxy` / `native` write gate with D1 authoritative revoke + explicit Node mirror-back for compatibility | first auth/session/device write cutover |
| `/v1/devices*` (other writes / other verbs) | Node | proxy only | later migration after D1 session/device schema |
| `/v1/sync/bootstrap` (`GET`) | Node-auth + Worker-gated D1 read | `proxy` / `shadow` / `native` gate with rollback-by-config | first sync read-path cutover |
| `/v1/sync/pull` (`POST`) | Node-auth + Worker-gated D1 read | `proxy` / `shadow` / `native` gate with rollback-by-config, compaction-floor awareness, and `CURSOR_EXPIRED` on stale cursors | reversible sync delta read cutover |
| `/v1/sync/push` (`POST`) | Node-auth + Worker-gated D1 write | reversible `proxy` / `native` write gate with D1 authoritative append + explicit Node mirror-back, while maintaining materialized record state | first sync mutation write cutover |
| `POST /v1/sync/repair` | Worker | Worker-owned repair snapshot over materialized sync record state | sync recovery/control seam |
| `POST /__platform/sync/compaction` | Worker operator surface | Worker-owned dry-run/apply compaction tracking over D1 metadata | sync lifecycle ops seam |
| `/v1/sync/collections/*` | Node | proxy only | later migration after sync write/conflict plan |

## 5. Source-of-truth policy

### 5.1 Phase-0 and phase-1 rule

Until a route is explicitly migrated, the current Node relay remains authoritative.

That means:

- `server/index.ts` remains the canonical runtime behavior
- `server/user-store.ts` remains the canonical persistence layer for today's auth/session/device/sync state
- Cloudflare storage written by the scaffold is additive and non-authoritative

The first exception is the remote-device revoke seam on `POST /v1/devices/:deviceId/revoke`: when `DEVICE_REVOKE_WRITE_MODE=native`, D1 becomes the authoritative write path for that route, but the Worker still mirror-backs the completed revoke to Node so Node-served reads and adjacent routes remain compatible during the migration window. If prerequisite shadow state is incomplete or Node definitively rejects the mirror-back, the Worker falls back to the Node route; if the mirror-back transport outcome is ambiguous, the Worker returns a guarded `503` instead of guessing between rollback and retry.

The next exception is sync mutation append on `POST /v1/sync/push`: when `SYNC_PUSH_WRITE_MODE=native`, the Worker uses the same pattern — local Worker session validation first, D1 authoritative append second, explicit Node mirror-back third, with rollback to the Node route on definitive mirror-back rejection and a guarded `503` when the mirror-back transport outcome is ambiguous. During rollout, `ASTRA_SYNC_MAX_MUTATIONS_PER_REQUEST` must stay aligned between Worker and relay so request-cap behavior remains identical. Accepted writes also maintain materialized record state so repair/export/delete/compaction do not need to replay unbounded mutation history.

The auth/session seam is still narrower than full platform migration: `GET /v1/auth/session` can move through `AUTH_SESSION_READ_MODE=proxy|shadow|native`, `DELETE /v1/auth/session` can move through `AUTH_SESSION_REVOKE_WRITE_MODE=proxy|native`, `POST /v1/auth/anonymous` can move through `AUTH_ANONYMOUS_ISSUE_MODE=proxy|shadow|native`, and `POST /v1/auth/session` can now move through `AUTH_SESSION_ISSUE_MODE=proxy|shadow|native`. In anonymous/authenticated `shadow`, the Worker proxies the live Node response and only performs preflight/parity checks so it never mints a second session. In anonymous/authenticated `native`, the Worker validates the request locally, uses D1 issuance prerequisites plus `auth_issue_requests` for idempotent replay, mirror-backs the exact device/session to Node, and only returns success after that mirror-back completes; ambiguous mirror outcomes return a guarded `503` so first-party clients can retry with the same `Idempotency-Key`. Worker-native authenticated issuance additionally verifies credentials from `shadow_user_credentials` with the shared credential helper before minting the D1-backed session. Worker-native auth still relies on the shared token helper and a matching `ASTRA_SESSION_SECRET`, plus D1 shadow rows for `shadow_users`, `shadow_user_credentials`, `shadow_auth_sessions`, `shadow_devices`, `shadow_user_usage`, and `auth_issue_requests`.

The current foundation block also introduces the prerequisites for later public auth issuance cutover without widening route ownership yet:

- `0800_auth_issuance_authority.sql` adds `shadow_user_credentials`, an anonymous `install_id` uniqueness prerequisite, and the `auth_issue_requests` ledger
- the shared auth helpers now cover token-claims parity, credential hashing, and anonymous identity generation
- Node now exposes internal mirror-back endpoints guarded by `ASTRA_PLATFORM_MIRROR_SECRET`
- `sessionPublicBaseURL` / `SESSION_PUBLIC_BASE_URL` can decouple issued session front-door claims from the Node origin

The next control-plane read seam is `GET /v1/account/summary`, gated by `ACCOUNT_SUMMARY_READ_MODE=proxy|shadow|native`. In `native`, the Worker validates the current session locally, reads D1-backed account/usage/device/sync summary state, and preserves rollback-by-config with Node compare/fallback. Other `/v1/account/*` routes remain Node-owned.

For the reversible read seams (`GET /v1/auth/session`, `GET /v1/account/summary`, `GET /v1/devices`, `GET /v1/sync/bootstrap`, and `POST /v1/sync/pull`), `native` means the Worker serves the D1-backed result while preserving rollback-by-config, parity compare logging, and immediate fallback if D1 cannot safely answer. Native sync-pull now also enforces compaction floors: stale cursors return `CURSOR_EXPIRED`, and clients recover through `POST /v1/sync/repair` instead of replaying from pre-compaction history.

### 5.2 Proxy-first rule

The initial Worker must preserve current request semantics for proxied routes:

- path and query string preserved
- method preserved
- request body preserved
- bearer auth and cookie headers forwarded
- response status/body preserved apart from hop-by-hop header cleanup

## 6. Why article import is phase 1

Article import is the first migration candidate because:

1. the client boundary is already isolated in `web/src/lib/article-import.ts`
2. the route is operationally separable from auth/session/device/sync state authority
3. the client already has a browser fallback path when the relay import surface is unavailable
4. it lets Astra exercise Workers + D1 + R2 + KV + Queues without changing current session or sync semantics
5. native edge fetch/extraction can be rolled out independently while retaining a reversible relay fallback

## 7. Scaffold architecture

The Cloudflare platform layer keeps three modes for `POST /v1/import/article`:

- `proxy`: forward to Node only
- `shadow`: return the proxied Node response, but also mirror request metadata into Cloudflare storage asynchronously
- `native`: Worker-owned fetch/extraction on the same route, with relay fallback preserved when the edge path cannot safely complete

### 7.1 Shadow mode responsibilities

Shadow mode is intentionally non-authoritative:

- proxy the live request to Node
- capture request metadata in D1
- store the opaque request payload in R2
- store the proxied import response as an additive R2 artifact
- enqueue an async Queue message for later artifact validation
- optionally write a short-TTL KV idempotency marker when the client explicitly supplies an idempotency key

### 7.2 Why the shadow payload is opaque

The scaffold does not freeze a new article import contract yet. It treats the mirrored request body as opaque bytes so Astra can validate platform plumbing before reimplementing extraction logic at the edge.

### 7.3 Native mode responsibilities

Native mode is intentionally **reversible**:

- parse the existing `POST /v1/import/article` JSON contract at the Worker edge
- fetch the target article from the Worker when the URL is clearly public/safe
- extract the same response shape (`url`, `title`, `hostname`, `byline`, `scope`, `summary`, `blocks`)
- return Worker-native results when extraction succeeds
- persist request/response artifacts through the same D1 + R2 + Queue seam, plus the fetched HTML source on native success
- fall back to the Node relay on fetch/extraction/runtime compatibility failures
- reject clearly invalid or local/private targets directly at the Worker boundary

This means article import can become the first genuine Worker-owned route without forcing a full platform cutover or breaking the current safety net.

### 7.4 Platform ops and observability

The current scaffold also requires a Worker-owned operator plane:

- `GET /__platform/health` for config/binding/path discovery
- `GET /__platform/observability` for rollout, governance, route/fallback, parity, and backlog visibility
- `GET /__platform/article-import/observability` for import-specific backlog/artifact detail
- `POST /__platform/article-import/replay` for bounded operator replay of replayable import jobs

To support that plane, the Worker persists route/parity/operator events in D1 `platform_route_events` so observability survives beyond transient request logs.

## 8. Durable Objects decision rubric

Durable Objects are intentionally **not** part of the phase-0 scaffold.

They become justified only when all of the following are true:

1. Astra has native Worker-owned sync writes rather than simple proxying
2. multiple devices can concurrently mutate the same user-owned sync state
3. D1 transactions plus optimistic retries are insufficient to keep the contract simple
4. Astra needs serialized per-user coordination or live per-user fan-out

### 8.1 Expected Astra Durable Object shape when justified

If later introduced, the unit of coordination should be **one user account**, not a global singleton:

- one Durable Object per user/account
- used for per-user sync sequencing or live sync coordination
- D1 remains the durable relational store behind that coordination layer

## 9. Storage ownership by phase

| Domain | Phase 0/1 owner | Cloudflare role in scaffold |
|---|---|---|
| Article import live behavior | Node | proxy + optional shadow capture |
| Auth/session | Node | proxy on live traffic + non-authoritative D1 shadow mirror scaffolding |
| Device registry | Node | proxy on live traffic + non-authoritative D1 shadow mirror scaffolding |
| Sync mutations/cursors | Node plus gated Worker-native seams | proxy on live traffic + D1 shadow/mutation/materialized-state scaffolding |
| Import shadow metadata | Cloudflare D1 | additive only |
| Auth/session usage shadow (`shadow_user_usage`) | Cloudflare D1 | additive snapshot used by Worker-native `GET /v1/auth/session` and `GET /v1/account/summary` |
| Platform route/parity/operator events | Cloudflare D1 | operator visibility only |
| Import opaque payload captures | Cloudflare R2 | additive only |
| Import async validation/replay work | Cloudflare Queues | additive only |
| Continuity export/delete async lifecycle work | Cloudflare Queues | Worker-owned job execution |
| Import idempotency hints | Cloudflare KV | additive only |
| Continuity export/delete idempotency hints | Cloudflare KV | additive only |

### 9.1 Next D1 migration notes for auth/session/device/sync

These notes define the **next schema-planning step**, not an immediate cutover:

| Domain | Likely D1 table(s) | Notes for the next phase |
|---|---|---|
| Auth/account anchor | `accounts` or `users` | minimal account identity row keyed by Astra user ID/email; keep billing/account authority unchanged until explicitly migrated |
| Sessions | `auth_sessions` | store `session_id`, `user_id`, token hash, identity mode, issued/seen/expires timestamps, optional `revoked_at`, and current device link; never store bearer tokens in plaintext |
| Devices | `devices` | store one row per device/install with platform/browser/app metadata, first-seen/last-seen timestamps, and soft-revocation fields |
| Session-device joins / audit | `session_events` or inline revocation columns | decide whether revocation/history needs a dedicated append-only table or can remain embedded in `auth_sessions` + `devices` |
| Sync collection state | `sync_collections` | per-user/per-collection enablement, default state, and last-issued cursor metadata |
| Sync mutations | `sync_mutations` | append-only mutation log keyed by user, collection, cursor/order key, record ID, client mutation ID, device ID, operation, and JSON payload |
| Sync read models | collection-specific materialized tables | add only when query cost or cursor replay pressure justifies them; do not start with premature denormalization |

Design constraints for those tables:

- preserve the current Node relay contracts first, then migrate handlers route-by-route
- prefer token hashes, revocation timestamps, and explicit device ownership links over opaque blob columns
- keep sync writes D1-first; add Durable Objects only if real concurrent-write coordination proves necessary
- keep browser/web clients on the existing auth/session/device/sync API shapes during the transition

### 9.2 Initial shadow scaffolding shape

The first implementation step for this domain uses **shadow-prefixed** D1 tables inside `platform/cloudflare/sql/`:

- `shadow_users`
- `shadow_auth_sessions`
- `shadow_devices`
- `shadow_sync_collections`
- `shadow_sync_mutations`

Why shadow-prefixed first:

- they make non-authoritative intent obvious while Node still owns runtime behavior
- they keep rollback simple because request routing does not depend on them yet
- they let Astra rehearse parity checks and route-by-route cutover against concrete relational data, not abstract notes

The companion repository layer in `platform/cloudflare/src/repositories/` should be able to:

- shadow-write current `server/user-store.ts` users, sessions, devices, and sync mutation records into D1
- shadow-read the same families back in shapes close to today's device/bootstrap/pull flows
- stay storage-only until a later phase explicitly moves route authority to Cloudflare

Current cursor note:

- today's Node implementation emits **numeric string cursors** from `server/user-store.ts`
- the shadow read helpers currently mirror that contract directly
- if Astra later promotes cursors to an opaque format, the D1 schema/read model should split opaque API cursors from internal ordering keys before Worker cutover

## 10. Phased migration path

### Phase 0 — Platform shell

- add Worker scaffold
- add Wrangler config and typed bindings
- add `GET /__platform/health`
- proxy `/v1/*` to the current Node relay

Success bar:

- Cloudflare can front the current relay without changing behavior

### Phase 1 — Article import first

- keep `POST /v1/import/article` proxy-first
- enable optional `shadow` mode
- add per-surface mode overrides plus force-proxy hostname controls
- write import shadow metadata to D1, including route/fallback visibility
- store mirrored payloads in R2
- enqueue import shadow jobs to Queues with retry/dead-letter visibility
- keep KV limited to best-effort idempotency hints and import abuse throttling
- expose operator replay plus import/unified observability for backlog, artifacts, and governance

Success bar:

- Astra validates Cloudflare ingress/storage/background plumbing on a single isolated route while the Node relay stays authoritative
- operators can explain route/fallback behavior, backlog, artifacts, byte caps, and replay state without relying only on logs

### Phase 2 — Native article import

- extract the exact current import contract from `server/index.ts`
- implement a Worker-native import path behind the same route
- keep relay fallback available when the native edge path cannot safely complete
- let web article import target the Cloudflare route independently from the main relay base URL
- continue using browser fallback as the safety net for unsupported pages

Success bar:

- article import can be switched route-by-route, surface-by-surface, or environment-by-environment without touching auth/session/device/sync ownership, and can be rolled back to pure proxy behavior quickly
- operators can explain route/fallback behavior and queue backlog from Worker headers/logs plus the import observability endpoint

### Phase 3 — Auth/session/device groundwork

- design D1 schema for sessions, device registry, revocation, and account-linked continuity metadata
- map existing `server/user-store.ts` fields into normalized D1 rows before moving route authority
- keep session tokens hashed, device ownership explicit, and revocation timestamp-based
- migrate auth/session/device routes only after those contracts are fully specified
- keep proxy fallback available during rollout
- keep audit/verify/backfill tooling available so D1 shadow state is inspectable before route widening

Success bar:

- durable edge-native session and device state exists without regressions to the current product contract
- D1 drift can be detected and additively repaired before native route ownership widens

### Phase 4 — Sync transport migration

- move sync bootstrap/push/pull into Worker-owned handlers backed by D1
- maintain append-only mutation rows, per-collection cursors, and materialized record state together
- add repair snapshots plus compaction-floor semantics so long-lived accounts do not require infinite mutation replay
- introduce Durable Objects only if per-user write serialization is truly needed
- keep route/parity metrics, compare-failed events, and rollback-by-config for every promoted sync seam

Success bar:

- Astra owns sync transport at the edge with clear conflict semantics and without speculative global coordination primitives
- every promoted sync seam remains observable, reversible, and gated independently from auth login/session issuance

## 11. Out of scope for this scaffold

This task does **not**:

- move translation execution to Cloudflare
- replace the current account/billing implementation
- redefine the sync merge rules already specified elsewhere
- claim real-time or always-on cross-device coordination
- commit Astra to Durable Objects before sync contention proves the need

## 12. Execution checkpoints

Before any later migration beyond this scaffold, Astra should be able to answer “yes” to all of the following:

- the Worker can proxy the existing relay without client-visible behavior changes
- article import is isolated enough to migrate independently
- route/parity/operator events are queryable beyond transient logs
- D1 is only used for relational metadata, not large blobs
- R2 holds opaque payloads/artifacts rather than relational state
- KV is kept non-authoritative
- Queue consumers are idempotent and tolerate retries/duplicates
- Queues own async work, not request-path correctness
- rollback remains a config flip for each gated seam
- Durable Objects remain deferred until per-user sync coordination is concretely required
