# Astra platform D1 migrations

This scaffold now creates the schema needed for:

- article-import shadow plumbing
- article-import rollout observability + retry visibility
- auth/session shadow snapshots
- device-registry shadow snapshots
- sync collection + mutation shadow snapshots
- unified platform route/parity/operator event visibility
- account usage shadow snapshots used by Worker-native session/account reads
- continuity export/delete lifecycle jobs and retention metadata
- sync lifecycle materialization, repair, and compaction tracking

## Included now

- `0000_article_import_shadow.sql`
- `0001_article_import_artifacts.sql`
- `0002_article_import_rollout_safety.sql`
- `0003_article_import_operations.sql`
- `0100_auth_session_shadow.sql`
- `0200_device_shadow.sql`
- `0300_sync_shadow.sql`
- `0400_platform_ops.sql`
- `0500_account_usage_shadow.sql`
- `0600_account_data_lifecycle.sql`
- `0700_sync_lifecycle.sql`
- `0800_auth_issuance_authority.sql`

Apply additive migrations before deploying Worker code that reads the new columns/tables so queue consumers, route handlers, and observability endpoints stay in sync.

The article-import table now stores:

- request metadata
- route + surface observability
- queue lifecycle status and retry attempt visibility
- replay/dead-letter timestamps plus last-failure metadata
- request hash, per-artifact hashes/sizes, and trace ID lineage
- optional idempotency linkage
- R2 request/response/source object references
- artifact retention/governance metadata for D1/R2 cleanup policy
- fallback/dead-letter reasons for rollout debugging

The auth/session/device/sync shadow tables store:

- normalized shadow copies of current Node-owned users, sessions, and devices
- explicit optional sync collection enablement/default flags
- append-only sync mutation rows and last-issued cursor metadata
- materialized sync record state for repair/export/delete and long-term pull correctness
- per-collection compaction floor metadata plus compaction run history
- enough relational structure to shadow-read bootstrap/pull parity without making D1 authoritative
- credential rows, anonymous-install lookup uniqueness, and issuance-ledger scaffolding for the later auth issuance cutover

`0400_platform_ops.sql` adds `platform_route_events`, which powers unified platform observability for:

- per-domain route counts (`article-import`, `device-list`, `device-revoke`, `sync-bootstrap`, `sync-pull`, `sync-push`)
- route mode / fallback / status-class aggregation
- parity mismatch and compare-failed visibility
- operator actions and other platform governance events

## Consistency tooling note

The first consistency-tooling wave now includes:

- `pnpm relay:shadow:audit`
- `pnpm relay:shadow:verify`
- `pnpm relay:shadow:backfill:dry-run`
- `pnpm relay:shadow:backfill:apply`

`0500_account_usage_shadow.sql` adds `shadow_user_usage` so Worker-native session/account reads can serve the same quota/usage envelope as Node.

`0600_account_data_lifecycle.sql` adds:

- `account_export_jobs`
- `account_data_delete_jobs`

These tables back queue-driven continuity export/download and cloud-data-delete status polling, grace windows, and retention policy metadata.

`0700_sync_lifecycle.sql` adds:

- `shadow_sync_record_state`
- collection compaction floor columns on `shadow_sync_collections`
- `sync_compaction_runs`

These tables/columns back Worker-native `POST /v1/sync/repair`, `CURSOR_EXPIRED` pull semantics, export/delete materialization, and operator compaction tracking.

These commands read and, in the `backfill:apply` case, additively repair the existing auth/session/device/sync shadow tables plus auth issuance credential prerequisites.

They still do **not**:

- migrate auth login or full session issuance to Cloudflare
- delete extra shadow-only rows automatically
- change route ownership by themselves

## Explicitly deferred

This scaffold still does **not** lock in final authoritative D1 schema yet for:

- billing/account state
- full auth login/session issuance

The `shadow_*` tables are intentionally reversible. If Astra later promotes these domains to Worker authority, it can either:

- rename/promote the shadow tables after validation, or
- backfill into authoritative tables with the same repository mapping contracts

## Migration bands

- `0000_*`–`0003_*` — article-import shadow capture, artifacts, queue safety, replay, governance
- `0100_*` — auth/session groundwork
- `0200_*` — device-management shadow tables
- `0300_*` — sync shadow metadata and mutation log
- `0400_*` — platform observability and route/parity/operator event ledger
- `0500_*` — account usage shadow for Worker-native session/account reads
- `0600_*` — continuity export/delete lifecycle jobs and retention metadata
- `0700_*` — sync record-state materialization, repair support, and compaction tracking
- `0800_*` — auth issuance authority prerequisites (credentials, install uniqueness, issuance ledger)
