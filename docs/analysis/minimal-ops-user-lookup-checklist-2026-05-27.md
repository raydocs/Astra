# Minimal Ops User Lookup Snapshot Checklist — 2026-05-27

Source strategy document: [`docs/plans/astra-zero-config-saas-operating-model-2026-05-27.md`](../plans/astra-zero-config-saas-operating-model-2026-05-27.md).

## Scope

Implement the section-14 minimal ops-console requirement for **user lookup + membership + usage category** as an operator-only support-triage snapshot, not a full CRM or billing console.

## Current implementation status

| Area | Status | Notes |
|---|---:|---|
| Operator auth boundary | ✅ Done | `GET /v1/ops/users/lookup?query=...` requires `X-Astra-Operator-Token` or operator bearer token and is limited to `support_lead` or `admin` scoped operators; the legacy platform mirror secret remains all-access for local/backward compatibility. |
| Lookup keys | ✅ Done | Operators can search by exact email, email hash, or user id. Responses do not echo the raw email. |
| Membership snapshot | ✅ Done | Response includes user id, email hash, created date, plan, subscription status, identity mode, entitlement count, and limits. |
| Usage category | ✅ Done | Response classifies the account as `light`, `normal`, `heavy`, or `extreme` from daily requests/characters and retained recent events. |
| Recent task summary | ✅ Done | Response includes task-class buckets with event/success/failure/fallback counts and P95 latency. |
| Privacy boundary | ✅ Done | Response and web card omit raw emails, billing emails, device ids, session ids, hostnames, prompts, text, provider names, model names, and per-content rows. |
| Minimal web snapshot | ✅ Done | Astra Web Account includes a token-gated `Staff account lookup` card for support triage. |
| Full staff console | Deferred | Locale/renewal/refund detail fields, staff login, role-management UI, free-form notes, user mutation, refund workflows, durable audit-log hardening, direct billing actions, and a full ops console are intentionally out of scope for this minimal support-triage slice. |

## Endpoint

```text
GET /v1/ops/users/lookup?query=<email|email-hash|user-id>
X-Astra-Operator-Token: <operator token>
```

Response schema: `astra-ops-user-lookup.v1`.

Primary fields:

- `queryType`
- `user.userId`
- `user.emailHash`
- `user.plan`
- `user.subscriptionStatus`
- `user.usage.usageCategory`
- `user.devices.activeCount`
- `user.sessions.activeCount`
- `user.recentTaskSummary[]`

## Validation

Completed in this slice:

- `pnpm test src/server/index.test.ts src/web/src/lib/astra-web.test.ts src/web/src/app.test.tsx` → 3 files / 92 tests passed (`OPS_USER_LOOKUP_TEST_EXIT:0`).
- `pnpm type-check` → passed after a narrow live-bench type cleanup in `script/bench-live/scenarios/frame-coordination-cross-origin-fallback.ts` (`TYPECHECK_EXIT:0`).
- `pnpm check:repo-knowledge` → passed (`REPO_KNOWLEDGE_EXIT:0`).

## Review

Oracle review for the multi-file ops user lookup snapshot update: first pass found a P1 stale-query visibility issue, fixed by token+query-bound rendering; second pass found a P1 `usr_*@...` email classification issue, fixed by classifying `@` queries as email before user-id detection. Follow-up review LGTM with no P0/P1 blockers remaining.
