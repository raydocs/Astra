# Astra Cloudflare platform scaffold

This directory contains Astra's **Cloudflare-first platform scaffold**.

It is intentionally additive:

- the current Node relay in `server/` remains authoritative for auth login/session issuance
- this Worker starts as a proxy/front door
- article import is the first native migration seam
- device/sync read and selected write routes now exist behind reversible Worker gates without forcing a full auth migration

## What is here

- `wrangler.jsonc` — bindings, local/staging/production vars, and deploy environments
- `src/index.ts` — Worker entrypoint
- `src/lib/proxy.ts` — transparent proxy helper to the current Node relay
- `src/handlers/article-import.ts` — proxy/shadow/native mode gate for `POST /v1/import/article`
- `src/handlers/article-import-observability.ts` — import-specific backlog/artifact visibility endpoint
- `src/handlers/article-import-replay.ts` — operator-only replay endpoint for failed/dead-lettered import jobs
- `src/handlers/platform-observability.ts` — unified operator visibility endpoint for rollout, route, parity, backlog, and governance state
- `src/lib/article-import-native.ts` — Worker-native article import fetch/extraction with relay fallback
- `src/lib/article-import-policy.ts` — rollout control helpers for surfaces, hostname policy, and abuse throttling
- `src/lib/article-import-shadow.ts` — D1 + R2 + KV + Queue mirroring for article import artifacts
- `src/lib/platform-ops.ts` — deferred D1 recording helpers for route/parity/operator events
- `src/lib/d1.ts` — small typed D1 helpers for Cloudflare repositories
- `src/types/shadow-state.ts` — additive auth/session/device/sync shadow types
- `src/repositories/*.ts` — D1 repositories for shadow user/session/device/sync state plus platform ops events
- `src/queues/article-import.ts` — queue consumer for shadow jobs
- `sql/0000_article_import_shadow.sql` — initial D1 schema for import shadow metadata
- `sql/0001_article_import_artifacts.sql` — additive response/source artifact references for import jobs
- `sql/0002_article_import_rollout_safety.sql` — rollout observability, queue-attempt visibility, and dead-letter metadata
- `sql/0003_article_import_operations.sql` — replay/dead-letter metadata plus artifact retention/lineage columns
- `sql/0100_auth_session_shadow.sql` — shadow user + session tables
- `sql/0200_device_shadow.sql` — shadow device registry table
- `sql/0300_sync_shadow.sql` — shadow sync collection + mutation tables
- `sql/0400_platform_ops.sql` — unified route/parity/operator event ledger used by platform observability

## Binding policy

| Binding | Product | Role in scaffold |
|---|---|---|
| `ASTRA_PLATFORM_DB` | D1 | relational metadata for article-import shadow/native jobs, shadow auth/device/sync state, and platform observability events |
| `ASTRA_IMPORT_PAYLOADS` | R2 | opaque mirrored request payloads plus import response/source artifacts |
| `ASTRA_IDEMPOTENCY_KV` | KV | best-effort idempotency hints and import abuse throttling windows |
| `ARTICLE_IMPORT_QUEUE` | Queues | async import artifact validation |
| `NODE_RELAY_ORIGIN` | Worker var | upstream Node relay origin |
| `ARTICLE_IMPORT_MODE` | Worker var | default route mode: `proxy`, `shadow`, or `native` |
| `ARTICLE_IMPORT_MODE_OVERRIDES` | Worker var | optional per-surface overrides like `web=shadow,extension=proxy` |
| `DEVICE_LIST_READ_MODE` | Worker var | device-list read gate: `proxy`, `shadow`, or `native` |
| `DEVICE_REVOKE_WRITE_MODE` | Worker var | remote-device revoke gate: `proxy` or `native` |
| `SYNC_BOOTSTRAP_READ_MODE` | Worker var | sync-bootstrap read gate: `proxy`, `shadow`, or `native` |
| `SYNC_PULL_READ_MODE` | Worker var | sync-pull read gate: `proxy`, `shadow`, or `native` |
| `SYNC_PUSH_WRITE_MODE` | Worker var | sync-push write gate: `proxy` or `native` |
| `ASTRA_SYNC_MAX_MUTATIONS_PER_REQUEST` | Worker var | sync-push request cap; keep aligned with the relay |
| `ARTICLE_IMPORT_ALLOWED_HOSTS` | Worker var | optional native/shadow allowlist suffixes; unmatched hosts downgrade to proxy |
| `ARTICLE_IMPORT_BLOCKED_HOSTS` | Worker var | denylist suffixes blocked before Node/native fetch |
| `ARTICLE_IMPORT_FORCE_PROXY_HOSTS` | Worker var | force listed hostnames back to proxy even when default mode is `native` |
| `ARTICLE_IMPORT_RATE_LIMIT_MAX` | Worker var | best-effort per-IP limit for the fixed window below |
| `ARTICLE_IMPORT_RATE_LIMIT_WINDOW_SECONDS` | Worker var | fixed-window length for import abuse protection |
| `ARTICLE_IMPORT_MAX_SHADOW_BYTES` | Worker var | hard request-body cap for shadow capture so giant imports do not explode request-path cost |
| `ARTICLE_IMPORT_MAX_NATIVE_BYTES` | Worker var | hard native fetch/extraction cap for article import cost governance |
| `ARTICLE_IMPORT_MAX_QUEUE_ATTEMPTS` | Worker var | max queue validation attempts before `dead_lettered` |
| `ARTICLE_IMPORT_ARTIFACT_RETENTION_DAYS` | Worker var | default artifact retention window stamped into D1/R2 metadata |
| `ARTICLE_IMPORT_ARTIFACT_RETENTION_CLASS` | Worker var | default governance/retention class for import artifacts |
| `ARTICLE_IMPORT_OPERATOR_TOKEN` | Worker secret | operator token for unified observability and import replay endpoints |

## Durable Objects

Durable Objects are intentionally **not** bound in this scaffold.

They are reserved for a later phase where Astra may need **per-user sync coordination** with serialized writes or live fan-out. Until then:

- D1 is the primary relational store candidate
- proxying remains the compatibility layer
- sync keeps Node-auth gating and explicit mirror-back on the few native write seams

## Local development

Typical local flow:

1. Run the current Node relay on a port distinct from `wrangler dev`:

```bash
ASTRA_RELAY_PORT=8788 pnpm relay:start
```

2. Run the Worker scaffold:

```bash
pnpm dlx wrangler dev --config platform/cloudflare/wrangler.jsonc
```

3. Use `.dev.vars` copied from `.dev.vars.example` if you need to override:

- `NODE_RELAY_ORIGIN` (for example `http://127.0.0.1:8788`)
- `ARTICLE_IMPORT_MODE`
- `ARTICLE_IMPORT_MODE_OVERRIDES`
- `DEVICE_LIST_READ_MODE`
- `DEVICE_REVOKE_WRITE_MODE`
- `SYNC_BOOTSTRAP_READ_MODE`
- `SYNC_PULL_READ_MODE`
- `SYNC_PUSH_WRITE_MODE`
- `ASTRA_SYNC_MAX_MUTATIONS_PER_REQUEST`
- hostname policy vars (`*_HOSTS`)
- rate-limit, byte-cap, and queue safety vars
- artifact retention vars
- `ARTICLE_IMPORT_OPERATOR_TOKEN` (prefer `wrangler secret put ARTICLE_IMPORT_OPERATOR_TOKEN`)
- `ASTRA_ENV`

4. To point only the web article-import flow at Cloudflare while keeping auth/session/device/sync on Node, run the web shell with both URLs explicit:

```bash
VITE_ASTRA_API_BASE_URL=http://127.0.0.1:8788/v1 \
VITE_ASTRA_PLATFORM_BASE_URL=http://127.0.0.1:8787 \
pnpm dev:web
```

The web URL-import client tags requests with `x-astra-import-surface: web`, so the Worker can keep surface-specific overrides without changing non-import APIs.

## Reversible cutover seams

### `GET /v1/devices`

`GET /v1/devices` has its own reversible Worker gate:

- `proxy` — transparent relay passthrough
- `shadow` — live proxy response plus background Worker-vs-D1 comparison
- `native` — Node still authoritatively validates the session/touches session state, but the Worker returns the device list from D1 and background-checks it against the Node authoritative route

Rollback is a single config flip back to `DEVICE_LIST_READ_MODE=proxy`.

### `POST /v1/devices/:deviceId/revoke`

`POST /v1/devices/:deviceId/revoke` has a reversible authoritative-write gate behind `DEVICE_REVOKE_WRITE_MODE`:

- `proxy` — transparent relay passthrough
- `native` — the Worker first performs the Node `/v1/auth/session` gate, applies the remote-device revoke in D1 as the authoritative write, then explicitly mirror-backs the same revoke to Node so Node-served reads and adjacent writes stay compatible; if D1 prerequisites are incomplete or Node explicitly rejects the mirror-back, the Worker falls back to the Node route, and if the mirror-back transport outcome is ambiguous it returns a guarded `503` instead of guessing between rollback and retry

Rollback is a single config flip back to `DEVICE_REVOKE_WRITE_MODE=proxy`.

### `GET /v1/sync/bootstrap`

`GET /v1/sync/bootstrap` follows the same reversible read-path pattern behind `SYNC_BOOTSTRAP_READ_MODE`:

- `proxy` — transparent relay passthrough
- `shadow` — live proxy response plus background Worker-vs-D1 bootstrap comparison
- `native` — the Worker first performs the Node `/v1/auth/session` gate and an authoritative Node `/v1/sync/bootstrap` fetch (preserving relay-side sync-touch behavior plus authoritative `serverTime`/limits), then returns the D1 bootstrap payload and compares it against that Node response; if D1 cannot safely serve, the already-fetched Node bootstrap response becomes the immediate fallback

Rollback is a single config flip back to `SYNC_BOOTSTRAP_READ_MODE=proxy`.

### `POST /v1/sync/pull`

`POST /v1/sync/pull` follows the same reversible read-path pattern behind `SYNC_PULL_READ_MODE`:

- `proxy` — transparent relay passthrough
- `shadow` — live proxy response plus background Worker-vs-D1 pull comparison
- `native` — the Worker first performs the Node `/v1/auth/session` gate and an authoritative Node `/v1/sync/pull` fetch (preserving relay-side sync semantics like session/sync touch and authoritative `serverTime`), then returns the D1 pull payload and compares it against that Node response; if D1 cannot safely serve, the already-fetched Node pull response becomes the immediate fallback

Rollback is a single config flip back to `SYNC_PULL_READ_MODE=proxy`.

### `POST /v1/sync/push`

`POST /v1/sync/push` has a reversible authoritative-write gate behind `SYNC_PUSH_WRITE_MODE`:

- `proxy` — transparent relay passthrough
- `native` — the Worker first performs the Node `/v1/auth/session` gate, applies the mutation append in D1 as the authoritative write using the shared Node validation rules plus the configured `ASTRA_SYNC_MAX_MUTATIONS_PER_REQUEST`, then explicitly mirror-backs the same push to Node so Node-served reads/writes keep working; if D1 prerequisites are incomplete or Node explicitly rejects the mirror-back, the Worker falls back to the Node route, and if the mirror-back transport result is ambiguous it returns a guarded `503`

Rollback is a single config flip back to `SYNC_PUSH_WRITE_MODE=proxy`.

## Focused rollout checks

### sync-bootstrap read

1. send an authenticated `GET /v1/sync/bootstrap` request with `Authorization` and `X-Astra-Device-Id`
2. confirm `x-astra-platform-domain: sync-bootstrap`
3. confirm the route header matches the active mode:
   - `proxy` → `x-astra-platform-route: proxy`
   - `shadow` → `x-astra-platform-route: shadow-proxy`
   - `native` → `x-astra-platform-route: native`
4. in `native`, verify the bootstrap body still reflects authoritative relay semantics for `serverTime` and `limits`; if D1 cannot safely serve, expect `x-astra-platform-route: native-fallback-proxy` plus `x-astra-platform-fallback-reason`
5. rollback is immediate by flipping `SYNC_BOOTSTRAP_READ_MODE=proxy`

```bash
curl http://127.0.0.1:8787/v1/sync/bootstrap \
  -H "authorization: Bearer $ASTRA_SESSION_TOKEN" \
  -H "x-astra-device-id: $ASTRA_DEVICE_ID" -i
```

### remote device revoke write

1. send an authenticated `POST /v1/devices/:deviceId/revoke` request with `Authorization` and `X-Astra-Device-Id`, targeting a non-current device
2. confirm `x-astra-platform-domain: device-revoke`
3. confirm the route header matches the active mode:
   - `proxy` → `x-astra-platform-route: proxy`
   - `native` → `x-astra-platform-route: native`
   - invalid auth/session at the gate → `x-astra-platform-route: native-auth-gate`
4. in `native`, verify the response body still contains the revoked target device in the returned device list; if the Worker cannot safely own the write before or after a definitive Node response, expect `x-astra-platform-route: native-fallback-proxy` plus `x-astra-platform-fallback-reason`
5. if the mirror-back transport result is ambiguous, expect HTTP `503` with `x-astra-platform-route: native` and `x-astra-platform-fallback-reason: mirror_back_commit_unknown`
6. verify the revoked device now fails a later `GET /v1/auth/session` refresh with `DEVICE_REVOKED`
7. rollback is immediate by flipping `DEVICE_REVOKE_WRITE_MODE=proxy`

```bash
curl -X POST http://127.0.0.1:8787/v1/devices/$ASTRA_REMOTE_DEVICE_ID/revoke \
  -H "authorization: Bearer $ASTRA_SESSION_TOKEN" \
  -H "x-astra-device-id: $ASTRA_DEVICE_ID" -i
```

### sync-pull read

1. send an authenticated `POST /v1/sync/pull` request with `Authorization`, `X-Astra-Device-Id`, and the current cursor body
2. confirm `x-astra-platform-domain: sync-pull`
3. confirm the route header matches the active mode:
   - `proxy` → `x-astra-platform-route: proxy`
   - `shadow` → `x-astra-platform-route: shadow-proxy`
   - `native` → `x-astra-platform-route: native`
4. in `native`, verify the pull body still reflects authoritative relay semantics for `serverTime`; if D1 cannot safely serve, expect `x-astra-platform-route: native-fallback-proxy` plus `x-astra-platform-fallback-reason`
5. rollback is immediate by flipping `SYNC_PULL_READ_MODE=proxy`

```bash
curl http://127.0.0.1:8787/v1/sync/pull \
  -H "authorization: Bearer $ASTRA_SESSION_TOKEN" \
  -H "x-astra-device-id: $ASTRA_DEVICE_ID" \
  -H "content-type: application/json" \
  --data '{"cursors":{"config":"1","vocabulary":"2","reading_history":"0","study_progress":null}}' -i
```

### sync-push write

1. send an authenticated `POST /v1/sync/push` request with `Authorization`, `X-Astra-Device-Id`, and a mutation batch that stays within `ASTRA_SYNC_MAX_MUTATIONS_PER_REQUEST`
2. confirm `x-astra-platform-domain: sync-push`
3. confirm the route header matches the active mode:
   - `proxy` → `x-astra-platform-route: proxy`
   - `native` → `x-astra-platform-route: native`
   - invalid auth/session at the gate → `x-astra-platform-route: native-auth-gate`
4. in `native`, verify the response body still matches the relay push contract for `accepted`, `rejected`, and `nextCursors`; if D1 cannot safely own the write before or after a definitive Node response, expect `x-astra-platform-route: native-fallback-proxy` plus `x-astra-platform-fallback-reason`
5. if the mirror-back transport result is ambiguous, expect HTTP `503` with `x-astra-platform-route: native` and `x-astra-platform-fallback-reason: mirror_back_commit_unknown`
6. rollback is immediate by flipping `SYNC_PUSH_WRITE_MODE=proxy`

```bash
curl -X POST http://127.0.0.1:8787/v1/sync/push \
  -H "authorization: Bearer $ASTRA_SESSION_TOKEN" \
  -H "x-astra-device-id: $ASTRA_DEVICE_ID" \
  -H "content-type: application/json" \
  --data '{"mutations":[{"collection":"config","schemaVersion":1,"recordId":"global","operation":"upsert","clientMutationId":"mut-config-1","deviceId":"'$ASTRA_DEVICE_ID'","clientUpdatedAt":"2026-04-11T11:59:00.000Z","payload":{"kind":"global","config":{"version":1,"targetLang":"zh-CN","connectionMode":"astra","hoverTrigger":"alt","contentScope":"page","inputTranslation":"enabled","inputTranslationMode":"replace","languageLevel":"intermediate","privacyMode":false,"provider":{"id":"openai","model":"gpt-5.4-nano"},"tts":{"enabled":true,"engine":"browser","rate":0.9,"pitch":1,"highlightSentences":true},"presentation":{"mode":"bilingual","theme":"default","fontSize":0.92,"translationColor":"#64748b"}}}}]}' -i
```

## Route headers and rollout visibility

`POST /v1/import/article` returns import-only rollout headers:

- `x-astra-platform-route` — concrete serving path (`proxy`, `shadow-proxy`, `native`, `native-fallback-proxy`, etc.)
- `x-astra-platform-mode` — effective mode after surface/hostname overrides
- `x-astra-platform-default-mode` — environment default before overrides
- `x-astra-platform-surface` — request surface label (for example `web`)
- `x-astra-platform-decision-reason` — why the route was chosen (`default_mode`, `surface_override`, `forced_proxy_host`)
- `x-astra-platform-fallback-reason` — present when native fell back to proxy

Read/write cutover routes (`GET /v1/devices`, `POST /v1/devices/:deviceId/revoke`, `GET /v1/sync/bootstrap`, `POST /v1/sync/pull`, and `POST /v1/sync/push`) return the aligned subset below:

- `x-astra-platform-route`
- `x-astra-platform-mode`
- `x-astra-platform-default-mode`
- `x-astra-platform-domain`
- `x-astra-platform-fallback-reason` — present when native falls back to proxy

The Worker emits structured route logs with the same fields, and it now persists route/parity/operator events into D1 `platform_route_events` so fallback behavior is queryable even when the request does not enqueue import artifacts.

## Unified platform observability endpoint

Use the top-level operator endpoint for rollout, governance, parity, and backlog visibility across article import plus the current device/sync cutover domains:

```bash
curl http://127.0.0.1:8787/__platform/observability \
  -H "authorization: Bearer $ARTICLE_IMPORT_OPERATOR_TOKEN"
```

If `ARTICLE_IMPORT_OPERATOR_TOKEN` is unset, the endpoint stays open for local/dev use.

It returns:

- current rollout modes for article import, device list, device revoke, sync bootstrap, sync pull, and sync push
- governance settings for rate limits, byte caps, queue policy, and artifact retention
- per-domain route/mode/fallback/status-class counts from `platform_route_events`
- parity mismatch and compare-failed counts plus recent parity/operator events
- article-import backlog, oldest queued age, artifact completeness, and recent failures

## Import-specific observability and replay

The import-only operator endpoint remains the detailed backlog/artifact surface:

```bash
curl http://127.0.0.1:8787/__platform/article-import/observability \
  -H "authorization: Bearer $ARTICLE_IMPORT_OPERATOR_TOKEN"
```

It returns:

- default mode + per-surface overrides
- hostname-policy counts plus rate-limit/queue safety controls
- artifact governance defaults and whether operator replay is enabled
- route/status/surface counts from D1 metadata
- queued/failed/dead-lettered backlog summary
- missing request/response/source artifact counts
- recent failed/dead-lettered jobs with trace IDs, replay counts, and queue attempt counts

## Queue retry / dead-letter policy

The article-import queue remains **validation-only**. Request-path correctness does not depend on the queue consumer.

Current policy:

- `shadow` and `native` captures enqueue validation after D1 + R2 writes
- the consumer increments `queue_attempt_count` on every delivery attempt
- missing artifacts or consumer errors retry until `ARTICLE_IMPORT_MAX_QUEUE_ATTEMPTS`
- once the ceiling is reached, the row is marked `dead_lettered`, stamped with dead-letter metadata, and the message is acked
- operators inspect and requeue import jobs through `GET /__platform/observability`, `GET /__platform/article-import/observability`, and `POST /__platform/article-import/replay`
- if `ARTICLE_IMPORT_OPERATOR_TOKEN` is unset, observability remains open but replay stays disabled
- replay remains import-only and token-gated; there is still no public reprocess endpoint

## Safety controls in this wave

This rollout-safety wave keeps auth login/session issuance on Node while adding reversible platform controls:

- per-surface mode overrides without touching non-import auth/session ownership
- allow/deny/force-proxy hostname controls
- best-effort per-IP rate limiting at the Worker boundary
- hard byte caps for shadow capture and native import cost governance
- structured route/fallback logs plus persisted D1 route/parity/operator metadata
- queue-attempt visibility and `dead_lettered` terminal state
- operator-only replay for failed/dead-lettered jobs
- artifact lineage, retention metadata, and predictable R2 key layout (`article-import/<yyyy-mm-dd>/<job-id>/<artifact>`)
- unified platform observability plus import-specific backlog/artifact visibility

## D1 consistency tooling (auth/session/device/sync)

The consistency tooling remains scoped to the shadow auth/session/device/sync tables and does **not** migrate auth login/session issuance.

Operator commands:

```bash
pnpm relay:shadow:audit -- --format text
pnpm relay:shadow:verify -- --format json
pnpm relay:shadow:backfill:dry-run -- --email demo@astra.local
pnpm relay:shadow:backfill:apply -- --email demo@astra.local
```

What these do:

- `audit` — compares the file-backed Node authoritative store against D1 shadow rows and emits structured diffs
- `verify` — same audit path, but exits non-zero when any drift exists so it can gate rollout checks
- `backfill:dry-run` — computes the additive `upsert` / `mirror_sync_collections` / `append` actions needed to converge D1 without writing anything
- `backfill:apply` — executes the additive backfill plan, then immediately re-runs the inspection to show remaining drift (if any); if the dry-run plan exceeds `--max-actions`, apply aborts until you raise the cap or narrow the filters

Current scope is intentionally limited to:

- `shadow_users`
- `shadow_auth_sessions`
- `shadow_devices`
- `shadow_sync_collections`
- `shadow_sync_mutations`

Current non-goals for this wave:

- no auth login or full session issuance migration
- no shadow-row deletes for extra rows found in D1
- no public repair endpoint for device/sync parity drift

The CLI uses the same `ASTRA_CF_*` D1 credentials as the live Node shadow bridge. Treat `--max-actions` as both a dry-run render cap and an apply safety cap.

## Deployment model

`wrangler.jsonc` now carries explicit `local`, `staging`, and `production` bindings/vars. The intended rollout model is:

1. keep every route at `proxy` by default
2. canary by env (`staging` before `production`)
3. within an env, canary by route mode (`shadow` before `native`, or `proxy` before `native` for write seams)
4. rollback by flipping the relevant route mode back to `proxy` and redeploying

See `docs/cloudflare-platform-ops-runbook.md` for the full migration order, rollback steps, operator commands, and observability checklist.

## Parity fixtures (native vs relay)

Use the Cloudflare parity fixture test to compare Worker-native article import output against the current relay path on representative pages:

```bash
pnpm vitest run platform/cloudflare/src/handlers/article-import.parity.test.ts -u
```

The fixture set covers clean articles, sidebar-heavy docs pages, forum/thread-like pages, and nested layout wrappers. Snapshot output includes block-count delta, overlap ratio, and title/byline/scope/summary mismatch flags.

## Optional official type generation

This scaffold includes local binding interfaces so it stays self-contained.

If you want Wrangler-generated runtime types later, run:

```bash
pnpm dlx wrangler types --config platform/cloudflare/wrangler.jsonc
```

That is optional for this scaffold phase.

## Migration path

1. **Phase 0:** Worker front door + health route + transparent proxy
2. **Phase 1:** article import in `proxy` mode, then `shadow` mode
3. **Phase 2:** native article import behind the same route, with proxy fallback kept available during rollout
4. **Phase 3:** reversible device-list read cutover on `GET /v1/devices` via `DEVICE_LIST_READ_MODE`
5. **Phase 4:** reversible remote-device revoke write cutover on `POST /v1/devices/:deviceId/revoke` via `DEVICE_REVOKE_WRITE_MODE`
6. **Phase 5:** reversible sync-bootstrap read cutover on `GET /v1/sync/bootstrap` via `SYNC_BOOTSTRAP_READ_MODE`
7. **Phase 6:** reversible sync-pull read cutover on `POST /v1/sync/pull` via `SYNC_PULL_READ_MODE`
8. **Phase 7:** reversible sync-push write cutover on `POST /v1/sync/push` via `SYNC_PUSH_WRITE_MODE`
9. **Phase 8:** broader auth/session/device and remaining sync transport migration only after login/session issuance strategy is intentionally revisited

## Shadow state foundation

The auth/session/device/sync scaffolding is intentionally **shadow-prefixed** in D1:

- `shadow_users`
- `shadow_auth_sessions`
- `shadow_devices`
- `shadow_sync_collections`
- `shadow_sync_mutations`

That naming keeps the current Node relay authoritative while giving Cloudflare a concrete relational shape for:

- progressive shadow writes from the current Node store
- selective shadow reads for parity checks and migration rehearsals
- route-by-route promotion once the Worker becomes authoritative for chosen seams

The repository modules are intentionally storage-only in this phase. They do **not** replace auth login/session issuance or broaden request ownership beyond the explicitly gated routes above.
