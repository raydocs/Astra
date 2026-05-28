# Minimal Operator/Privacy Audit Snapshot Checklist — 2026-05-27

Source strategy document: [`docs/plans/astra-zero-config-saas-operating-model-2026-05-27.md`](../plans/astra-zero-config-saas-operating-model-2026-05-27.md).

## Scope

Implement the section-14 minimal ops-console requirement for **privacy audit + operator audit log** as a metadata-only operating snapshot with minimal env-backed role enforcement, not a full SOC console or staff-login system.

## Current implementation status

| Area | Status | Notes |
|---|---:|---|
| Retained audit store | ✅ Done | `src/server/ops-audit-log-store.ts` stores up to 500 recent audit entries at `ASTRA_OPS_AUDIT_LOG_PATH` / `ops-audit-log.json`, preserves invalid retained logs instead of overwriting them, uses atomic writes, and serializes concurrent record writes. |
| Operator auth boundary | ✅ Done | `GET /v1/ops/audit/summary` requires `X-Astra-Operator-Token` or operator bearer token and is limited to roles with `view_audit_log` permission (`ops_engineer`, `admin`, `privacy_reviewer`). |
| Support consent trail | ✅ Done | Successful metadata-only support submissions record user actor, report id, subject user id/email hash, consent flag, and metadata-only privacy class. |
| Operator action trail | ✅ Done | Audit-summary views, cost summary, provider health, user lookup, support inbox/summary/triage, known-issue updates, and feature-flag view/update actions record operator actor, hashed operator token, and operator id/role/source metadata. Recognized-but-denied scoped attempts are audited as `outcome: "denied"`. |
| Privacy boundary | ✅ Done | Audit summary omits raw emails, billing emails, operator tokens, device ids, session ids, hostnames, prompts, page text, saved content, transcripts, screenshots, provider/model rows, and message bodies. |
| Minimal web snapshot | ✅ Done | Astra Web Account includes a token-gated `Privacy / operator audit` card showing aggregate privacy counters and recent subject-id rows. |
| Full ops console | Deferred | Env-backed role-specific auth is present; paging/search, export workflow, staff login, role-management UI, data-request orchestration, alerting, immutable append-only backend, and production SOC controls remain deferred. |

## Endpoint

```text
GET /v1/ops/audit/summary
X-Astra-Operator-Token: <operator token>
```

Response schema: `astra-ops-audit-summary.v1`.

Primary fields:

- `totalEvents`
- `retainedEventLimit`
- `byAction[]`
- `byActor[]`
- `privacy.userConsentTrueCount`
- `privacy.metadataOnlyCount`
- `privacy.contentIncludedCount`
- `recent[]` with action, actor, outcome, subject ids, support report id, hashed operator token, and privacy class

## Validation

Completed in this slice:

- `pnpm test src/server/ops-audit-log-store.test.ts src/server/index.test.ts src/server/config.test.ts src/web/src/lib/astra-web.test.ts src/web/src/app.test.tsx` → 5 files / 108 tests passed (`OPS_AUDIT_TEST_EXIT:0`).

## Follow-ups

- Add staff login/role-management UI and immutable audit retention before exposing this beyond env-managed operator-token workflows.
- Route data-request/refund/cancel workflows through the audit log when those actions become live.
- Consider paging and date/action filters once retained events exceed the compact card use case.
