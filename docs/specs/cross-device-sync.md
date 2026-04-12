# Cross-Device Sync Execution Spec

**Status:** Draft  
**Date:** 2026-04-09  
**Plan source:** `docs/investigations/astra-cross-device-translation-strategy-pack-2026-04-09.md`

## 1. Scope and document boundary

This spec defines Astra's account-linked cross-device continuity contract for extension-first clients.

It covers:

- ownership of user assets
- sync collections and collection boundaries
- merge/conflict rules
- privacy boundaries
- API/transport expectations for sync
- rollout phases
- continuity export/delete and retention expectations for synced collections
- explicit out-of-scope items

It does **not** redefine:

- the platform/support matrix (owned by the concurrent support-matrix doc)
- Web/PWA product scope or UX (owned by `docs/specs/web-pwa-companion.md`)
- device/session registry UX beyond what is required for sync transport (owned by `docs/specs/device-management.md`)

## 2. Current baseline in code

The current implementation is local-first and only partially exportable:

- `src/utils/storage/config.ts` stores `astra.config.v1` in `browser.storage.local`
- `src/utils/storage/auth.ts` stores `astra.auth.v1` separately from config
- `src/utils/storage/config-sync.ts` provides **manual export/import only**, bundling:
  - config
  - vocabulary
  - reading history
- `src/utils/storage/reading-history.ts` stores a capped local list keyed by sanitized URL
- `src/utils/storage/vocabulary.ts` stores local vocabulary entries, including SRS/glossary fields
- `src/utils/storage/study-progress.ts` stores local page progress plus local-only daily aggregates
- `src/utils/storage/page-digests.ts` and `src/utils/storage/translation-usage.ts` store local-only derived data
- `server/index.ts` exposes auth/account/usage/billing/translate APIs, but no sync APIs
- `server/user-store.ts` persists users and usage only; it does not persist sync collections

Implication: Astra currently has account auth and quota continuity, but not user-asset continuity.

## 3. Product principles

1. **Sync is account-linked, not device-export masquerading as sync.**
2. **Local remains the immediate working copy.** Clients must remain usable offline and reconcile later.
3. **Server is merge authority, not editing authority.** The server validates, timestamps, deduplicates, and resolves conflicts.
4. **Session state is not a sync collection.** Auth/session continuity is handled separately.
5. **Sensitive material is excluded by default.** Raw provider secrets and ephemeral caches never enter cloud sync.
6. **Collections converge independently.** Config conflicts must not block vocabulary or history sync.
7. **Sync must be idempotent.** Every mutation must be safe to retry.

## 4. Ownership matrix

| Domain | Canonical owner | Local cache | Cloud sync policy | Notes |
|---|---|---:|---:|---|
| Account, plan, entitlements, billing state | Server | Yes | No | Derived from `/account`, `/account/usage`, billing APIs |
| Auth session token | Device + server session layer | Yes | No | Managed in `astra.auth.v1`; not replicated across devices |
| Device registry | Server | Read-only cache allowed | No | Defined in `device-management.md` |
| Global config prefs | Account sync service | Yes | Yes, default on | Main continuity surface |
| Site rules (`config.sites`) | Account sync service | Yes | Yes, default on | Merge per hostname |
| Custom actions | Account sync service | Yes | Yes, default on | Merge per action id |
| Provider selection/model | Account sync service | Yes | Yes, default on | Sync safe metadata only |
| Relay base URL | Mixed: account default or device override | Yes | Conditional | Astra-managed default may sync; custom/self-host override stays device-local in phase 1 |
| Provider secrets (`provider.apiKey`, `provider.accessToken`) | Local device only | Yes | Never | Never uploaded; manual local export only |
| Vocabulary entries | Account sync service | Yes | Yes, default on when sync enabled | Explicit user-saved asset |
| Reading history | Account sync service | Yes | Optional, off by default in phase 1 | Privacy-sensitive behavioral data |
| Study progress per page | Account sync service | Yes | Optional, phase 2 | Page-level progress only |
| Study daily aggregates | Local device only | Yes | Never | Derived/local UX cache; timezone-sensitive |
| Translation usage metrics | Local device only + server quota usage | Yes | Never | Local analytics and server quota are distinct |
| Translation cache | Local device only | Yes | Never | Ephemeral performance cache |
| Page digests | Local device only | Yes | Never | Regenerable derived content |

## 5. Sync collections

## 5.1 Common sync envelope

Every synced mutation and every server delta must carry:

- `collection`: `config` | `vocabulary` | `reading_history` | `study_progress`
- `schemaVersion`
- `recordId`
- `operation`: `upsert` | `delete`
- `clientMutationId` (idempotency key)
- `deviceId`
- `clientUpdatedAt`
- `serverUpdatedAt` (server-assigned on accept)

Deletion must use tombstones, not silent omission.
Collection-scoped cloud delete in the control-plane must therefore enqueue delete mutations/tombstones and let downstream devices observe them through normal pull/merge semantics.
Worker-native sync now also maintains a materialized per-record state table so repair/export/delete/compaction do not need to replay the full mutation log for long-lived accounts.

## 5.2 Config collection

### Scope

The config collection is a single account-scoped document derived from `AstraConfig`, but synced as mergeable subdomains.

### Synced fields

**Account-synced in phase 1**

- `targetLang`
- `connectionMode`
- `hoverTrigger`
- `contentScope`
- `inputTranslation`
- `inputTranslationMode`
- `languageLevel`
- `privacyMode`
- `provider.id`
- `provider.model`
- `presentation.*`
- `sites.*`
- `customActions[*]`
- `tts.enabled`
- `tts.engine`
- `tts.rate`
- `tts.pitch`
- `tts.highlightSentences`

**Conditionally synced**

- `provider.relayBaseURL` only when Astra-managed defaults are in use; custom/self-host relay overrides remain device-local in phase 1

### Device-local fields inside config

- `tts.voiceName`
- future capability-detected settings tied to a device/browser runtime
- custom/self-host relay overrides that may not be valid on every device

### Excluded fields

- `provider.apiKey`
- `provider.accessToken`
- any future raw credential or bearer secret

### Merge rules

- top-level scalar fields: **field-level last-writer-wins** by `serverUpdatedAt`
- `tts` and `presentation`: **nested field-level last-writer-wins**
- `sites`: merge by normalized hostname
  - update: last-writer-wins for that hostname
  - delete: hostname tombstone wins if newer than latest update
- `customActions`: merge by `id`
  - update: last-writer-wins for that action id
  - delete: action tombstone wins if newer

### Rationale

This preserves the existing local schema while preventing one stale full-document write from erasing unrelated site rules or custom actions.

## 5.3 Vocabulary collection

### Scope

Vocabulary is synced as one record per entry id from `src/utils/storage/vocabulary.ts`.

### Synced fields in phase 1

- `id`
- `text`
- `translation`
- `explanation`
- `context`
- `url` (sanitized form only)
- `hostname`
- `savedAt`
- `note`
- `tags`
- `glossaryEnabled`
- `glossaryScope`
- `glossaryTargetText`

### Deferred to phase 2

- `srsBox`
- `nextReviewAt`
- `reviewCount`
- `lastReviewedAt`

### Merge rules

- canonical key: `id`
- update: whole-record last-writer-wins in phase 1
- delete: tombstone wins if newer than latest upsert
- duplicate legacy records imported with different ids may be compacted server-side by `(normalizedText, sanitizedUrl)` during migration/import tooling, but the runtime sync contract uses `id`
- tombstones are retained for at least 30 days before compaction
- bootstrap rule: if a device has unsynced local-only vocabulary on first sign-in, the client uploads local entries as normal mutations and then pulls merged server state; bootstrap must not replace the local array wholesale

### Privacy rule

Vocabulary sync is treated as **explicit user-saved content**, not passive browsing telemetry. If a future privacy control disables vocabulary cloud sync, local save still works.

## 5.4 Reading history collection

### Scope

Reading history is synced as one record per sanitized page URL, matching current local semantics in `reading-history.ts`.

### Synced fields

- `recordId = sanitizedUrl`
- `url` (sanitized: no query/hash)
- `hostname`
- `title`
- `wordsTranslated`
- `visitedAt`

### Merge rules

- stable key: sanitized URL
- keep the record with the greatest `visitedAt`
- if `visitedAt` ties, use latest `serverUpdatedAt`
- delete uses tombstones retained for at least 30 days before compaction
- bootstrap rule: local history is normalized to sanitized URLs before first upload; server deltas merge by sanitized URL rather than replacing the local history array
- history remains capped server-side and client-side to the most recent 200 entries

### Privacy rule

Reading history is **optional sync** in phase 1 and must be presented as a separate user toggle because it represents behavioral history rather than explicit saved content.
When exported through the cloud control-plane, it should be clearly labeled as behavioral data; when deleted, it should follow the same grace/tombstone path as other synced collections rather than being hard-purged inline.

## 5.5 Study progress collection

### Scope

Study progress sync is page-scoped and intentionally excludes local-only day summaries.

### Synced fields

- `recordId = sanitizedUrl`
- `url` (sanitized)
- `hostname`
- `title`
- `completedSteps`
- `sentencesExplained`
- `vocabSaved`
- `startedAt`
- `lastActivityAt`

### Explicitly not synced

- `dailyStats`

### Merge rules

- `completedSteps`: **set union**
- `sentencesExplained`: **max**
- `vocabSaved`: **max**
- `startedAt`: **min**
- `lastActivityAt`: **max**
- `title`: latest non-empty value by `lastActivityAt`

### Rationale

The current local store mixes durable page progress with local daily rollups. Cross-device sync should preserve durable per-page progress while avoiding timezone-sensitive aggregate conflicts.

## 6. Continuity export/delete control-plane expectations

The continuity control-plane may expose:

- queue-backed export of current cloud continuity state for `config`, `vocabulary`, `reading_history`, and `study_progress`
- collection-scoped cloud delete scheduling for `vocabulary`, `reading_history`, and `study_progress`
- status polling for export/delete jobs, including grace/retention metadata

It must not, by default, include:

- provider secrets
- auth/session tokens
- local-only aggregates/caches
- raw import artifacts
- full account closure or billing identity deletion

Export artifacts may expire on a retention schedule, but delete tombstones must remain retained long enough for slow devices to reconcile before any later compaction phase.

## 7. Privacy boundaries

## 6.1 Never uploaded by sync

The sync service must never ingest:

- raw provider API keys
- Astra bearer/session tokens
- translation cache entries
- page digest cache
- translation usage event logs
- raw query strings or URL fragments from history/progress URLs
- hidden device fingerprint material

## 6.2 Explicitly user-saved vs passively observed

- **Explicitly user-saved:** config, site rules, custom actions, vocabulary
- **Passively observed / behavioral:** reading history, study progress

Policy:

- config sync defaults on once account sync is enabled
- vocabulary sync defaults on once account sync is enabled
- reading history sync requires an explicit toggle in phase 1
- study progress sync ships behind a later toggle/phase

### 6.3 Collection privacy/export/delete matrix

| Collection | Cloud uploaded | Default | Local export in phase 1 | Account delete requirement |
|---|---|---|---|---|
| Config | Yes | On | Yes | Remove synced copy and local cache on request |
| Vocabulary | Yes | On | Yes | Remove synced copy and preserve delete tombstones during retention window |
| Reading history | Optional | Off | Yes | Remove synced copy and preserve delete tombstones during retention window |
| Study progress | Optional, phase 2 | Off | No dedicated export in phase 1 | Remove synced copy when feature ships |
| Session/device data | No via sync | N/A | No | Managed by auth/device controls |
| Translation cache/page digests/usage | No | N/A | No | Local clear only unless future product work says otherwise |

### 6.4 Privacy mode interaction

`privacyMode` must sync as a user preference, but enabling privacy mode does **not** retroactively delete already-synced data.

Phase-1 requirement:

- privacy mode continues sanitizing translation request context as it does today
- sync respects collection boundaries above, regardless of runtime translation context

Future deletion/retroactive purge controls are separate product work.

## 8. API and transport expectations

Sync uses the existing Astra relay base URL convention (`.../v1`) and bearer auth.

### Required transport properties

- HTTPS only outside local development
- bearer session auth
- `X-Astra-Device-Id` header on every sync request
- idempotent writes using `clientMutationId`
- server-assigned timestamps/cursors
- per-collection cursors so one bad collection does not stall others
- event-driven eventual consistency, not always-on background sync as a protocol assumption

### Required trigger model

Phase-1 clients only need to guarantee sync attempts on:

- sign-in/sign-out boundary changes
- app/extension startup
- foreground resume
- local writes to synced collections (best-effort flush)
- manual refresh/retry

Periodic background sync on desktop may exist as an optimization, but it is not part of the contract and must not be required for correctness.

### Minimum API surface

#### `GET /v1/sync/bootstrap`
Returns:

- enabled collections and policy flags
- server time
- collection cursors
- collection limits
- account-level sync toggles

Cloudflare rollout note:

- the Worker may front this route behind `SYNC_BOOTSTRAP_READ_MODE=proxy|shadow|native`
- in `native`, the Worker performs both the Node auth/session gate and an authoritative Node bootstrap fetch before serving the D1 bootstrap read, so rollback can immediately reuse the Node bootstrap response

#### `POST /v1/sync/push`
Accepts batched mutations across collections.

Server responsibilities:

- validate schema version
- reject excluded fields
- assign `serverUpdatedAt`
- dedupe by `clientMutationId`
- return accepted/rejected mutations per collection

Cloudflare rollout note:

- the Worker may front this route behind `SYNC_PUSH_WRITE_MODE=proxy|native`
- in `native`, the Worker performs the Node auth/session gate, applies the D1 append as the authoritative write, and explicitly mirror-backs the same push to Node so Node-served reads/writes keep working during rollback windows; if the mirror-back transport outcome is ambiguous, the Worker returns a guarded `503` instead of guessing between retry and rollback
- keep `ASTRA_SYNC_MAX_MUTATIONS_PER_REQUEST` aligned between the Worker and relay during rollout so the request cap stays exact

#### `POST /v1/sync/pull`
Accepts per-collection cursors and returns deltas plus next cursors.

Cloudflare rollout note:

- the Worker may front this route behind `SYNC_PULL_READ_MODE=proxy|shadow|native`
- in `native`, the Worker performs the Node auth/session gate and an authoritative Node sync-pull fetch before serving the D1 pull read, so rollback can immediately reuse the Node pull response while preserving relay-side sync semantics first
- once compaction is active, cursors older than the collection compaction floor return `CURSOR_EXPIRED` instead of replaying pre-compaction history

#### `POST /v1/sync/repair`
Returns a materialized full snapshot for one or more collections so clients can recover from `CURSOR_EXPIRED` or other state drift without requiring a full account re-login.

Contract notes:

- the response is collection-scoped and includes `latestCursor` plus the current active records for each requested collection
- clients replace their local synced collection copy from the repair snapshot, then continue incremental pull from `latestCursor`
- local-only fields/caches remain local and are not sourced from repair payloads

#### `POST /v1/sync/export` *(optional later)*
Server-side account export is deferred; local export/import remains the only guaranteed export path in phase 1.

### Error semantics

Sync APIs should distinguish at least:

- `SYNC_DISABLED`
- `INVALID_SYNC_PAYLOAD`
- `SCHEMA_VERSION_UNSUPPORTED`
- `DEVICE_REQUIRED`
- `SESSION_REQUIRED`
- `CONFLICT_RETRY_REQUIRED` *(rare; most conflicts should be merged server-side)*
- `CURSOR_EXPIRED` when a client cursor is older than the collection compaction floor

## 9. Rollout plan

### Phase 0 — Contracts and migration framing

- finalize ownership matrix
- define sync envelopes and cursors
- add device identity prerequisite from `device-management.md`
- preserve current local export/import flow as fallback

### Phase 1 — Minimum continuity loop

- config sync
- site rule sync
- custom action sync
- vocabulary sync (without SRS review state)
- optional reading history sync
- sync status/errors surfaced in popup/options

Success bar:

- signed-in user can install Astra on a second supported client and recover settings plus vocabulary

### Phase 2 — Learning continuity

- study progress sync
- vocabulary SRS field sync
- better per-collection toggles
- delete/export account controls

Success bar:

- user can resume learning state across supported clients without duplicating or losing page progress

### Phase 3 — Hardening and scale-up

- large-account pagination/backfill
- materialized record-state maintenance
- `sync/repair` recovery path
- tombstone compaction and compaction floor management
- retention policies
- telemetry for recovery rate, sync success, conflict frequency, and compaction/repair health

## 10. Explicitly out of scope

This spec explicitly does not define:

- browser/platform support levels or claims
- Web/PWA companion information architecture or UX
- native mobile/offline background sync behavior
- syncing translation cache, page digests, or usage analytics
- real-time collaborative sync or multi-tab live presence
- cross-account sharing of vocabulary/history
- a server-side replacement for the current manual local backup/import flow in phase 1
- device/session registry UX details beyond transport prerequisites

## 11. Execution checkpoints

Before implementation starts, the team should be able to answer “yes” to all of the following:

- collection ownership is unambiguous
- excluded secret fields are explicit
- reading history and study progress privacy defaults are explicit
- merge rules are defined per collection
- sync transport is delta-based and idempotent
- support-matrix and Web/PWA scope remain owned by their separate docs
