# Cloudflare platform ops runbook

**Date:** 2026-04-12  
**Scope:** Cloudflare rollout, operator tooling, governance, and rollback for the current Astra platform seam  
**Boundary:** includes the scoped Worker-native public auth issuance seams (`POST /v1/auth/anonymous`, `POST /v1/auth/session`) but does **not** migrate adjacent account/billing/translate authority or native-mobile ownership.

## 1. What this runbook covers

This runbook is for the current Cloudflare-backed platform surface:

- `POST /v1/import/article`
- `POST /v1/auth/anonymous`
- `POST /v1/auth/session`
- `GET /v1/auth/session`
- `DELETE /v1/auth/session`
- `GET /v1/account/summary`
- `POST /v1/account/export`
- `GET /v1/account/export/:jobId`
- `GET /v1/account/export/:jobId/download`
- `POST /v1/account/cloud-data-delete`
- `GET /v1/account/cloud-data-delete/:jobId`
- `GET /v1/devices`
- `POST /v1/devices/:deviceId/revoke`
- `GET /v1/sync/bootstrap`
- `POST /v1/sync/pull`
- `POST /v1/sync/push`
- `POST /v1/sync/repair`
- `POST /__platform/sync/compaction`
- `GET /__platform/health`
- `GET /__platform/observability`
- `GET /__platform/article-import/observability`
- `POST /__platform/article-import/replay`

It covers:

- local / staging / production deployment model
- migration apply order
- canary and rollback controls
- consistency tooling and backfill workflow
- queue failure / replay workflow
- artifact governance and abuse/cost controls
- observability and operator checks

It does **not**:

- migrate adjacent account/billing/translate authority away from Node
- replace the Node relay for non-gated routes
- introduce Durable Objects as a default dependency

## 2. Deployment model

`platform/cloudflare/wrangler.jsonc` defines three environments:

- `local`
- `staging`
- `production`

Rollout model:

1. keep all gated domains at `proxy` by default
2. land schema/binding changes first
3. canary in `staging`
4. widen per route, not all at once
5. promote to `production` only after parity/ops checks are green
6. rollback by flipping the relevant route mode back to `proxy` and redeploying

### Route controls

- `ARTICLE_IMPORT_MODE`
- `ARTICLE_IMPORT_MODE_OVERRIDES`
- `AUTH_SESSION_READ_MODE`
- `AUTH_SESSION_REVOKE_WRITE_MODE`
- `AUTH_ANONYMOUS_ISSUE_MODE`
- `AUTH_SESSION_ISSUE_MODE`
- `ACCOUNT_SUMMARY_READ_MODE`
- `DEVICE_LIST_READ_MODE`
- `DEVICE_REVOKE_WRITE_MODE`
- `SYNC_BOOTSTRAP_READ_MODE`
- `SYNC_PULL_READ_MODE`
- `SYNC_PUSH_WRITE_MODE`
- `SYNC_TOMBSTONE_RETENTION_DAYS`
- `SYNC_COMPACTION_BATCH_SIZE`
- `SYNC_COMPACTION_DRY_RUN`

Recommended canary order:

1. import: `proxy -> shadow -> native`
2. auth anonymous issuance: `proxy -> shadow -> native`
3. auth authenticated issuance: `proxy -> shadow -> native`
4. auth/session read: `proxy -> shadow -> native`
5. account summary read: `proxy -> shadow -> native`
6. auth/session + device/sync writes: `proxy -> native`

## 3. Migration apply order

Apply D1 migrations in filename order before deploying Worker code that reads the new schema:

1. `platform/cloudflare/sql/0000_article_import_shadow.sql`
2. `platform/cloudflare/sql/0001_article_import_artifacts.sql`
3. `platform/cloudflare/sql/0002_article_import_rollout_safety.sql`
4. `platform/cloudflare/sql/0003_article_import_operations.sql`
5. `platform/cloudflare/sql/0100_auth_session_shadow.sql`
6. `platform/cloudflare/sql/0200_device_shadow.sql`
7. `platform/cloudflare/sql/0300_sync_shadow.sql`
8. `platform/cloudflare/sql/0400_platform_ops.sql`
9. `platform/cloudflare/sql/0500_account_usage_shadow.sql`
10. `platform/cloudflare/sql/0600_account_data_lifecycle.sql`
11. `platform/cloudflare/sql/0700_sync_lifecycle.sql`
12. `platform/cloudflare/sql/0800_auth_issuance_authority.sql`

Use the matching environment's D1 database when applying migrations.

Minimum pre-deploy check:

- `wrangler.jsonc` bindings resolve for the target env
- D1 schema is current
- R2 bucket exists
- KV namespace exists
- queue producer/consumer exist (article-import + continuity-lifecycle)
- `ASTRA_SESSION_SECRET` is configured and matches the relay session secret for the target environment
- `ASTRA_PLATFORM_MIRROR_SECRET` is configured consistently on both the Worker and the Node relay before any auth-issuance cutover work
- `SESSION_PUBLIC_BASE_URL` / `ASTRA_SESSION_PUBLIC_BASE_URL` are aligned to the intended front-door origin before issuance cutover
- first-party anonymous bootstrap callers preserve and reuse the same `Idempotency-Key` when a native anonymous issue attempt returns `503` with `x-astra-platform-fallback-reason: mirror_back_commit_unknown`
- first-party authenticated sign-in callers preserve and reuse the same `Idempotency-Key` when a native session issue attempt returns `503` with `x-astra-platform-fallback-reason: mirror_back_commit_unknown`
- `ARTICLE_IMPORT_OPERATOR_TOKEN` is configured for staging/prod

## 4. Consistency and backfill workflow

Use the shadow CLI before enabling native read/write seams broadly.

### Commands

```bash
pnpm relay:shadow:audit -- --format text
pnpm relay:shadow:verify -- --format json
pnpm relay:shadow:backfill:dry-run -- --email demo@astra.local
pnpm relay:shadow:backfill:apply -- --email demo@astra.local
```

`--max-actions` is not just output shaping: it is also an apply safety cap. If the plan is truncated, `backfill:apply` aborts until you raise the cap or narrow the target scope.

### Operator sequence

1. run `relay:shadow:audit`
2. if drift exists, run `relay:shadow:backfill:dry-run`
3. review planned additive actions
4. if the dry-run is truncated, re-run with a higher `--max-actions` cap or narrower filters before continuing
5. run `relay:shadow:backfill:apply`
6. confirm the post-apply inspection is clean or understand the remaining unresolved diffs
7. only then widen route ownership

### Current scope

The CLI currently audits/additively repairs only:

- `shadow_users`
- `shadow_user_credentials`
- `shadow_auth_sessions`
- `shadow_devices`
- `shadow_sync_collections`
- `shadow_sync_mutations`

It also reports auth-issuance prerequisites that must be clean before any Worker-native public `POST /v1/auth/anonymous` or `POST /v1/auth/session` rollout:

- duplicate anonymous `installId` ownership in the Node authority
- authenticated users missing mirrored credential rows in D1

### Current non-goals

- no automatic deletes for extra D1 rows
- no public repair endpoint for parity drift
- no native-mobile session ownership beyond the existing Web/PWA + iOS bridge-first validation scope

## 5. Queue failure and replay workflow

The article-import queue is validation-only and must never become request-path critical.
The continuity-lifecycle queue is control-plane critical for export/delete status progression, but still runs off the request path and must remain rollback-safe.

### Queue policy

- every queue delivery increments `queue_attempt_count`
- retry until `ARTICLE_IMPORT_MAX_QUEUE_ATTEMPTS`
- mark terminal failures as `dead_lettered`
- ack terminal failures to prevent poison-message loops
- replay only rows that still have a stored `request_object_key`

### Replay flow

1. inspect `GET /__platform/observability` and `GET /__platform/article-import/observability`
2. identify whether failures are storage, policy, or consumer issues
3. fix the root cause first
4. replay specific jobs or a bounded batch
5. confirm the queue/backlog returns to steady state

### Continuity lifecycle expectations

- export create returns a D1-backed job row immediately and enqueues bundle generation on `CONTINUITY_LIFECYCLE_QUEUE`
- export download availability is governed by `CONTINUITY_EXPORT_ARTIFACT_RETENTION_DAYS`
- cloud-data-delete create returns a scheduled job row immediately; deletion work is not allowed to run until `CONTINUITY_DELETE_GRACE_PERIOD_SECONDS` has elapsed
- delete execution must append sync tombstones/delete mutations rather than silently hard-deleting active records, so downstream devices reconcile through normal pull semantics
- keep `CONTINUITY_TOMBSTONE_RETENTION_DAYS` long enough for slow/offline devices to observe those deletes before any later compaction work
- keep `SYNC_TOMBSTONE_RETENTION_DAYS` long enough for repair/export/delete to serve materialized delete state before tombstone pruning
- start with `SYNC_COMPACTION_DRY_RUN=true`; switch to apply only after `POST /v1/sync/repair` and `CURSOR_EXPIRED` recovery are verified in staging
- use `SYNC_COMPACTION_BATCH_SIZE` to bound any single operator compaction run

### Replay examples

```bash
curl https://<worker-host>/__platform/article-import/replay \
  -X POST \
  -H "authorization: Bearer $ARTICLE_IMPORT_OPERATOR_TOKEN" \
  -H "x-astra-operator-id: your-name" \
  -H "content-type: application/json" \
  -d '{"jobId":"<job-id>","reason":"r2-restored"}'
```

```bash
curl https://<worker-host>/__platform/article-import/replay \
  -X POST \
  -H "authorization: Bearer $ARTICLE_IMPORT_OPERATOR_TOKEN" \
  -H "content-type: application/json" \
  -d '{"status":"dead_lettered","limit":10,"dryRun":true}'
```

## 6. Artifact governance

### Object naming

R2 object keys follow a predictable layout:

- `article-import/<yyyy-mm-dd>/<job-id>/request.bin`
- `article-import/<yyyy-mm-dd>/<job-id>/response.bin`
- `article-import/<yyyy-mm-dd>/<job-id>/source.html`

### Governance metadata

Each import artifact carries:

- retention class (`ARTICLE_IMPORT_ARTIFACT_RETENTION_CLASS`)
- retention-until timestamp (`ARTICLE_IMPORT_ARTIFACT_RETENTION_DAYS`)
- job id / request hash / trace id lineage
- route / mode / surface / hostname metadata
- artifact byte size and sha256

### Operator expectations

- keep R2 lifecycle rules aligned with the configured retention class/days
- treat replay as lineage-preserving reuse of stored request artifacts, not as a new object family
- use D1 metadata as the index of truth for cleanup/replay eligibility
- handle user-delete/retention workflows by removing both D1 metadata and governed R2 artifacts together
- keep continuity export artifacts under the same governed R2 posture as other platform artifacts, but scoped to continuity-job lineage and expiry metadata

## 7. Abuse and cost governance

Current controls:

- `ARTICLE_IMPORT_ALLOWED_HOSTS`
- `ARTICLE_IMPORT_BLOCKED_HOSTS`
- `ARTICLE_IMPORT_FORCE_PROXY_HOSTS`
- `ARTICLE_IMPORT_RATE_LIMIT_MAX`
- `ARTICLE_IMPORT_RATE_LIMIT_WINDOW_SECONDS`
- `ARTICLE_IMPORT_MAX_SHADOW_BYTES`
- `ARTICLE_IMPORT_MAX_NATIVE_BYTES`
- `ARTICLE_IMPORT_MAX_QUEUE_ATTEMPTS`

Recommended operating posture:

- start with tight allowlists or force-proxy lists for native import canaries
- bound giant body capture with `ARTICLE_IMPORT_MAX_SHADOW_BYTES`
- bound native fetch/extraction cost with `ARTICLE_IMPORT_MAX_NATIVE_BYTES`
- keep rate limits enabled in staging/prod
- investigate hot-host retry storms before widening rollout
- prefer rollback to `proxy` over absorbing uncontrolled queue growth

## 8. Observability surfaces

### Health

```bash
curl https://<worker-host>/__platform/health
```

Use for:

- current default modes
- cutover-domain mode snapshot
- byte-cap and queue-policy config
- path discovery for observability/replay endpoints
- binding presence

### Unified observability

```bash
curl https://<worker-host>/__platform/observability \
  -H "authorization: Bearer $ARTICLE_IMPORT_OPERATOR_TOKEN"
```

Use for:

- rollout state across import/device/sync domains
- route/mode/fallback/status-class counts from `platform_route_events`
- parity mismatch / compare-failed counts
- continuity export/delete backlog counts and lifecycle governance policy
- sync compaction status counts, recent runs, and sync lifecycle governance policy
- recent parity/operator events
- article-import backlog and recent failures
- artifact completeness
- governance config snapshot

### Import-specific observability

```bash
curl https://<worker-host>/__platform/article-import/observability \
  -H "authorization: Bearer $ARTICLE_IMPORT_OPERATOR_TOKEN"
```

Use for:

- import-only route/status/surface counts
- backlog age and failure detail
- replay enablement
- artifact completeness gaps

### What to alert on

- rising `dead_lettered` or `failed` backlog
- sustained `native-fallback-proxy` spikes
- parity mismatch or compare-failed events climbing in a specific domain
- unexpected 5xx status-class growth
- missing request/response/source artifacts

## 9. Rollback model

### Fast rollback

For any gated route:

1. flip the route control back to `proxy`
2. redeploy the Worker in the affected environment
3. confirm headers now show `x-astra-platform-route: proxy`
4. watch `/__platform/observability` until fallback/parity errors settle

### Examples

- import rollback: `ARTICLE_IMPORT_MODE=proxy`, `ARTICLE_IMPORT_MODE_OVERRIDES=web=proxy`
- auth anonymous issuance rollback: `AUTH_ANONYMOUS_ISSUE_MODE=proxy`
- auth session issuance rollback: `AUTH_SESSION_ISSUE_MODE=proxy`
- account-summary rollback: `ACCOUNT_SUMMARY_READ_MODE=proxy`
- device-list rollback: `DEVICE_LIST_READ_MODE=proxy`
- device-revoke rollback: `DEVICE_REVOKE_WRITE_MODE=proxy`
- sync-bootstrap rollback: `SYNC_BOOTSTRAP_READ_MODE=proxy`
- sync-pull rollback: `SYNC_PULL_READ_MODE=proxy`
- sync-push rollback: `SYNC_PUSH_WRITE_MODE=proxy`
- sync repair/control rollback: keep `/v1/sync/repair` available but set `SYNC_COMPACTION_DRY_RUN=true` and stop invoking `POST /__platform/sync/compaction` until parity/recovery issues are resolved

## 10. Done-when checklist for this phase

The current Cloudflare platform block is operationally complete when:

- D1 migrations through `0400_platform_ops.sql` are applied
- local/staging/prod vars are defined in `wrangler.jsonc`
- shadow audit/verify/backfill tooling is available
- additive backfill apply is available
- queue failure + replay handling exists
- artifact retention/governance metadata is recorded
- abuse/cost controls are configurable
- `/__platform/health` and `/__platform/observability` are live
- route/parity events persist outside transient logs
- sync lifecycle observability includes compaction status/runs plus repair coverage
- rollback remains one config flip per gated route
- public auth login/session issuance still stays on Node until a later dedicated migration, even though the issuance foundation, schema prerequisites, and Node internal mirror-back endpoints are now in place
