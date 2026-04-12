# Cloudflare article import rollout runbook

**Date:** 2026-04-11
**Scope:** import-only rollout safety for `POST /v1/import/article`  
**Authority boundary:** Node remains authoritative for every non-import API and for auth login/session issuance.

## 1. What this runbook covers

This runbook is for the reversible Cloudflare article-import seam only.

It covers:

- default mode and per-surface overrides
- route/fallback visibility
- hostname safety controls
- queue retry/dead-letter behavior
- operator-only replay for failed/dead-lettered jobs
- artifact governance and cost controls
- fast rollback back to proxy

It does **not** move auth/session/device/sync ownership away from Node.

## 2. Rollout controls

### Base control

- `ARTICLE_IMPORT_MODE=proxy|shadow|native`

### Per-surface override

- `ARTICLE_IMPORT_MODE_OVERRIDES=web=shadow,extension=proxy`

Current web URL import sends `x-astra-import-surface: web`, so web canarying can happen without touching the relay base URL for other APIs.

### Hostname safety controls

- `ARTICLE_IMPORT_ALLOWED_HOSTS` *(native/shadow allowlist; unmatched hosts downgrade to proxy)*
- `ARTICLE_IMPORT_BLOCKED_HOSTS`
- `ARTICLE_IMPORT_FORCE_PROXY_HOSTS`

Use bare suffixes like `example.com`.

### Abuse, byte-cap, and queue safety controls

- `ARTICLE_IMPORT_RATE_LIMIT_MAX`
- `ARTICLE_IMPORT_RATE_LIMIT_WINDOW_SECONDS`
- `ARTICLE_IMPORT_MAX_SHADOW_BYTES`
- `ARTICLE_IMPORT_MAX_NATIVE_BYTES`
- `ARTICLE_IMPORT_MAX_QUEUE_ATTEMPTS`

### Artifact governance and operator replay controls

- `ARTICLE_IMPORT_ARTIFACT_RETENTION_DAYS`
- `ARTICLE_IMPORT_ARTIFACT_RETENTION_CLASS`
- `ARTICLE_IMPORT_OPERATOR_TOKEN` *(set as a Worker secret; do not commit it in `vars`)*

## 3. Recommended rollout sequence

### Stage A — pure proxy baseline

- `ARTICLE_IMPORT_MODE=proxy`
- `ARTICLE_IMPORT_MODE_OVERRIDES=web=proxy`
- confirm `/__platform/health`
- confirm `/__platform/observability` returns sane governance and zero/low parity noise
- confirm `/__platform/article-import/observability` returns sane config and zero/low backlog

### Stage B — shadow only for web

- keep env default at `proxy`
- set `ARTICLE_IMPORT_MODE_OVERRIDES=web=shadow`
- verify route mix starts showing `shadow-proxy`
- verify queued jobs move to `consumed`
- verify missing artifact counts stay near zero
- verify failed/dead-lettered jobs remain explainable and bounded

### Stage C — native canary for constrained hosts/surfaces

- move `web` to `native`
- keep `ARTICLE_IMPORT_FORCE_PROXY_HOSTS` populated for any domains not yet trusted
- optionally use `ARTICLE_IMPORT_ALLOWED_HOSTS` to keep native to a narrow hostname set first; unmatched hosts stay on proxy rather than fail closed
- watch `native`, `native-fallback-proxy`, `failed`, and `dead_lettered` counts together
- watch byte-cap rejects so cost controls are behaving as expected

### Stage D — wider native rollout

Only widen if:

- parity fixtures remain acceptable
- backlog is stable
- fallback rate is explainable
- missing artifact counts stay low
- dead-letter volume is low and understood
- byte-cap/rate-limit rejects look intentional rather than accidental breakage

## 4. Fast rollback

Fastest rollback path:

1. set `ARTICLE_IMPORT_MODE=proxy`
2. set `ARTICLE_IMPORT_MODE_OVERRIDES=web=proxy`
3. clear any experimental hostname allowlists
4. redeploy Worker

This preserves the same import route shape while pushing serving responsibility fully back to the Node relay.

## 5. What to monitor

### Response headers

- `x-astra-platform-route`
- `x-astra-platform-mode`
- `x-astra-platform-default-mode`
- `x-astra-platform-surface`
- `x-astra-platform-decision-reason`
- `x-astra-platform-fallback-reason` (when present)

### Unified platform observability

```bash
curl https://<worker-host>/__platform/observability \
  -H "authorization: Bearer $ARTICLE_IMPORT_OPERATOR_TOKEN"
```

If `ARTICLE_IMPORT_OPERATOR_TOKEN` is unset in local/dev, observability can remain open while replay stays disabled.

Key fields:

- `rollout.articleImportMode`
- `rollout.articleImportModeOverrides`
- `governance.articleImport.rateLimit.*`
- `governance.articleImport.byteCaps.*`
- `governance.articleImport.queuePolicy.*`
- `governance.articleImport.artifactRetention.*`
- `observability.routeCounts.article-import`
- `observability.modeCounts.article-import`
- `observability.fallbackCounts.article-import`
- `observability.statusClassCounts.article-import`
- `observability.recentPlatformEvents[*]`

### Import-only observability endpoint

```bash
curl https://<worker-host>/__platform/article-import/observability \
  -H "authorization: Bearer $ARTICLE_IMPORT_OPERATOR_TOKEN"
```

Key fields:

- `routeCounts`
- `statusCounts`
- `surfaceCounts`
- `backlog.queued`
- `backlog.failed`
- `backlog.deadLettered`
- `backlog.oldestQueuedAgeMs`
- `queuePolicy.operatorReplayEnabled`
- `artifactGovernance.*`
- `artifactCompleteness.*`
- `recentFailures[*]`

### Logs and persisted events

Worker route logs emit structured JSON with:

- `route`
- `mode`
- `surface`
- `decisionReason`
- `fallbackReason`
- `targetHostname`
- `responseStatus`

Those route decisions now also persist into D1 `platform_route_events`, so per-domain route/fallback/parity behavior remains queryable even after transient logs rotate away.

## 6. Queue and reprocess policy

The queue validates captured artifacts after request completion.

- queue delivery increments `queue_attempt_count`
- missing artifacts or consumer failures retry until the configured ceiling
- once the ceiling is reached, the row becomes `dead_lettered`
- `dead_lettered` is terminal and acked to stop retry storms

Current reprocess approach:

- investigate `recentFailures` and `observability.recentPlatformEvents`
- fix the underlying config/storage issue first
- use the operator-only replay endpoint for `failed` or `dead_lettered` rows that still have a stored request artifact
- manually re-drive traffic only when the original import never captured replayable artifacts

Operator replay example:

```bash
curl https://<worker-host>/__platform/article-import/replay \
  -X POST \
  -H "authorization: Bearer $ARTICLE_IMPORT_OPERATOR_TOKEN" \
  -H "x-astra-operator-id: your-name" \
  -H "content-type: application/json" \
  -d '{"jobId":"<job-id>","reason":"r2-restored"}'
```

Batch dry-run example:

```bash
curl https://<worker-host>/__platform/article-import/replay \
  -X POST \
  -H "authorization: Bearer $ARTICLE_IMPORT_OPERATOR_TOKEN" \
  -H "content-type: application/json" \
  -d '{"status":"dead_lettered","limit":10,"dryRun":true}'
```

Replay notes:

- observability and replay are token-gated whenever `ARTICLE_IMPORT_OPERATOR_TOKEN` is configured
- replay is import-only
- replay resets queue delivery attempts for the selected job and increments `replay_count`
- rows without a stored `request_object_key` are not replayable and must be re-driven manually
- D1 keeps dead-letter timestamps, last failure codes, replay reason/operator metadata, and artifact retention fields for lineage/governance

There is intentionally **no public reprocess endpoint** in this wave.

## 7. Artifact governance expectations

R2 object naming stays predictable:

- `article-import/<yyyy-mm-dd>/<job-id>/request.bin`
- `article-import/<yyyy-mm-dd>/<job-id>/response.bin`
- `article-import/<yyyy-mm-dd>/<job-id>/source.html`

Operational expectations:

- keep R2 lifecycle rules aligned with `ARTICLE_IMPORT_ARTIFACT_RETENTION_CLASS` and `ARTICLE_IMPORT_ARTIFACT_RETENTION_DAYS`
- treat D1 `article_import_jobs` metadata as the cleanup/replay index
- preserve lineage fields (`traceId`, request hash, artifact hashes) when replaying

## 8. Safety expectations before widening traffic

Do **not** widen native traffic if any of these are true:

- `deadLettered` is climbing without a clear cause
- fallback volume is high on important hostnames
- missing response/source artifacts are non-trivial
- rate limiting or byte-cap rejects are masking a larger abuse or queue-flood pattern
- parity fixtures drift materially versus relay output

## 9. Node authority reminder

Even after this wave:

- auth/session/device/sync stay Node-owned except for the explicitly gated Cloudflare seams
- Cloudflare import controls must not be used as a reason to migrate auth login/session issuance
- rollback for non-import APIs is still simply “keep proxying to Node”
