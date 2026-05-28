# Minimal Ops Provider Health Snapshot Checklist — 2026-05-27

Source strategy document: [`docs/plans/astra-zero-config-saas-operating-model-2026-05-27.md`](../plans/astra-zero-config-saas-operating-model-2026-05-27.md).

## Scope

Implement the smallest useful **provider/model health dashboard** foundation from the operating model: an operator-only aggregate API plus a compact Astra Web account card for outage mitigation.

This is intentionally staff-only. Ordinary user surfaces should continue to hide provider/model/API-key/token/prompt details.

## Current implementation status

| Area | Status | Notes |
|---|---:|---|
| Operator auth boundary | ✅ Done | `GET /v1/ops/provider-health/summary` uses the relay operator-token boundary and is limited to `ops_engineer` and `admin` scoped operators. |
| Provider/model aggregation | ✅ Done | The endpoint groups retained recent usage events by `provider`, `model`, `serviceMode`, and `taskClass`. |
| Health signals | ✅ Done | Buckets expose event/request/character counts, success/failure/fallback counts, success/fallback rates, latency P50/P95, and `incident` / `watch` / `healthy` status. |
| Incident ordering | ✅ Done | Buckets sort incident first, then watch, then healthy, with event count and route fields as tie-breakers. |
| Privacy boundary | ✅ Done | Response and web card omit user ids, emails, device/session ids, hostnames, prompts, text, and per-user rows. Provider/model names are present only because this is an operator-only route-health view. |
| Minimal web snapshot | ✅ Done | Astra Web Account includes a token-gated `Provider health snapshot` card with aggregate totals and top route-health buckets. |
| Full ops console | Deferred | No alerts, paging, drill-down, exact spend, staff roles, or durable provider incident workflow yet. |

## Endpoint

```text
GET /v1/ops/provider-health/summary
X-Astra-Operator-Token: <operator token>
```

Response schema: `astra-provider-health-summary.v1`.

Primary fields:

- `generatedAt`
- `source: "recent_user_usage_events"`
- `recentEventsPerUserLimit`
- `totalEvents`
- `totalRequests`
- `totalCharacters`
- `buckets[]` grouped by:
  - `provider`
  - `model`
  - `serviceMode`
  - `taskClass`

## Validation

Completed in this slice:

- `pnpm test src/server/index.test.ts src/web/src/lib/astra-web.test.ts src/web/src/app.test.tsx` → 3 files / 88 tests passed.
- `pnpm type-check` → passed (`TYPECHECK_EXIT:0`).
- `pnpm check:repo-knowledge` → passed (`REPO_KNOWLEDGE_EXIT:0`).

## Review

Oracle review for the multi-file provider-health snapshot update: first pass found P1 fallback overcounting and pre-auth provider/model terminology. Follow-ups confirmed both were fixed, with no P0/P1 blockers remaining (LGTM).
