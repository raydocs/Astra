# First 30 Ops Cost Dashboard MVP Checklist — 2026-05-27

Source strategy document: [`docs/plans/astra-zero-config-saas-operating-model-2026-05-27.md`](../plans/astra-zero-config-saas-operating-model-2026-05-27.md).

## Scope

Implement the First 30 days P0 **Cost dashboard MVP** as a privacy-safe operator API plus a minimal read-only web operator snapshot, not a full staff console.

Acceptance from the strategy plan: cost visibility must be available by tier/task, with no user content exposure.

## Current implementation status

| Area | Status | Notes |
|---|---:|---|
| Operator auth boundary | ✅ Done | `GET /v1/ops/cost/usage-summary` uses the operator token boundary and is limited to `support_lead`, `ops_engineer`, and `admin` scoped operators. |
| Tier/task aggregation | ✅ Done | The endpoint aggregates retained server usage events by `tier`, `taskClass`, and `costBucket`, including event/request/character/success/failure/fallback counts. |
| Cache status visibility | ✅ Done | The endpoint exposes aggregate `cacheHitRate` and `byCacheStatus[]` counts for `hit`, `partial`, `miss`, `disabled`, and `unknown` states without per-user rows. |
| Privacy boundary | ✅ Done | Response omits user ids, emails, device/session ids, hostnames, provider names, model names, text, prompt, and per-user rows. |
| Source limitation | ✅ Documented | Response labels its source as `recent_user_usage_events` and exposes `recentEventsPerUserLimit: 10`; this is an MVP risk dashboard, not a durable spend ledger. |
| Minimal web snapshot | ✅ Initial card | Astra Web account ops area includes a token-gated read-only `Cost risk snapshot` card backed by `GET /v1/ops/cost/usage-summary`. |
| Full staff UI | Deferred | This is not a full operations console: no drill-down users, no exact spend ledger, no alerts, and no role-based staff workflow. |
| Exact dollar costs | Deferred | Current ledger supports bucketed cost risk only; exact provider spend requires a separate internal pricing ledger. |

## Endpoint

```text
GET /v1/ops/cost/usage-summary
X-Astra-Operator-Token: <operator token>
```

Response schema: `astra-cost-usage-summary.v1`.

Primary fields:

- `generatedAt`
- `source: "recent_user_usage_events"`
- `recentEventsPerUserLimit`
- `totalEvents`
- `totalRequests`
- `totalCharacters`
- `cacheHitRate` (`hit / (hit + partial + miss)` events, or `null` when cache attempts are not observed)
- `byCacheStatus[]` grouped by aggregate cache state with event/request/character counts and share
- `buckets[]` grouped by:
  - `tier`
  - `taskClass`
  - `costBucket`

## Validation

Previous API validation:

```text
pnpm test src/server/index.test.ts
# 1 file / 42 tests passed

pnpm type-check
# [type-check-exit] code=0

pnpm check:repo-knowledge
# [repo-knowledge-exit] code=0
```

Current web snapshot validation completed in this slice:

- Cache-status follow-up: `pnpm test src/server/index.test.ts src/web/src/lib/astra-web.test.ts src/web/src/app.test.tsx` → 3 files / 99 tests passed (`CACHE_TEST_EXIT:0`).
- `pnpm test src/web/src/lib/astra-web.test.ts src/web/src/app.test.tsx` → 2 files / 43 tests passed (`WEB_COST_TEST_EXIT:0`).
- After Oracle blocker fix: `pnpm test src/web/src/app.test.tsx -t "loads the aggregate cost-risk snapshot"` → focused test passed (`WEB_COST_FOCUSED_TEST_EXIT:0`).
- After Oracle blocker fix: `pnpm test src/web/src/lib/astra-web.test.ts src/web/src/app.test.tsx` → 2 files / 43 tests passed (`WEB_COST_TEST_EXIT:0`).
- `pnpm type-check` → passed (`TYPECHECK_EXIT:0`).
- `pnpm check:repo-knowledge` → passed (`REPO_KNOWLEDGE_EXIT:0`).

- Oracle review for the multi-file web cost snapshot update: first pass found a P1 stale-token visibility issue; fixed by clearing operator-scoped cost/support state on operator-token changes and only passing/rendering the cost summary when the loaded token matches the current token. Follow-up review LGTM.
