# Operations Console

Source plan: Section 30, Operations Console, from the macro product upgrade plan dated 2026-05-27.

Astra's first ops console exists to support users, understand failures, and roll back risky features. It is not a content-viewing tool.

## Executable contract

- Contract module: `src/utils/ops-console.ts`
- Tests: `src/utils/ops-console.test.ts`
- Current supporting surfaces:
  - support report summary/list/triage ops routes;
  - feature-flag runtime and change log;
  - cost-risk aggregate summary;
  - provider-health aggregate summary;
  - metadata-only support bundle schema.

## First-version modules

`ASTRA_OPS_CONSOLE_MODULES` defines the information architecture:

| Module | Purpose | Content boundary |
|---|---|---|
| User Overview | Find account/device state needed for support. | user id/email hash/status only; no content. |
| Membership | Handle plan, renewal, cancellation, and refund questions. | no card/payment sensitive details. |
| Device / Version | Diagnose browser, extension version, OS, and device issues. | metadata only. |
| Recent Errors | Spot failure categories and surfaces. | error category and timestamp only. |
| Usage Summary | Understand quota, abuse, and cost-risk buckets. | aggregate buckets; no prompts/text/provider rows for public users. |
| Feature Flags | Roll back or degrade risky surfaces. | audited flag/kill-switch metadata. |
| Support Tickets | Triage metadata-only reports and known issues. | content attachments require explicit user consent. |
| Service Health | Monitor aggregate provider, relay, and route health. | aggregate health only; no per-user rows. |
| Audit Log | Explain sensitive staff actions. | actor/target/reason/timestamp only. |

Default prohibited fields include page text, saved sentence text, transcripts, PDF text, user input text, prompt text, model output text, and full URLs.

## Role matrix

`ASTRA_OPS_ROLES` defines least-privilege defaults:

| Role | Visible content | Actions |
|---|---|---|
| Support Agent | Metadata-only account/device/error/ticket views. | reply, refund request, escalation. |
| Support Lead | Metadata-only support plus membership/usage summaries. | refund request/issue, escalation. |
| Ops Engineer | Metadata-only health, usage, flags, and audit views. | toggle flags, activate kill switches. |
| Admin | Audit/admin views. | role management and data-request handling. |
| Privacy Reviewer | Consented content only. | view consented content and handle data requests. |

## Minimal operator access boundary

`ASTRA_OPERATOR_TOKENS` may define scoped local operator principals as JSON:

```json
[{ "id": "support-local", "role": "support_agent", "token": "support-secret" }]
```

Protected `/v1/ops/*` routes accept either `X-Astra-Operator-Token` or an operator bearer token. Env-backed principals are limited by the role matrix; the legacy `ASTRA_PLATFORM_MIRROR_SECRET` remains a backward-compatible all-access `legacy_platform_operator`. Internal Cloudflare mirror routes still require only `ASTRA_PLATFORM_MIRROR_SECRET` and do not accept scoped operator tokens.

Denied requests from recognized scoped operators are recorded as metadata-only audit entries with operator id/role/source and no raw token, query, email, or content values.

## Audit taxonomy

Sensitive actions require actor, target, reason, and timestamp:

- refund requested / issued;
- feature flag updated;
- kill switch changed;
- support content viewed;
- data request handled;
- role changed.

Support triage updates are also audited so status/priority/assignee/resolution edits remain inspectable.

## Readiness gate

`evaluateAstraOpsConsoleReadiness()` blocks if any of these are missing:

- metadata-only default;
- actionable support fields;
- feature flag / kill-switch rollback;
- sensitive action audit;
- least-privilege role matrix;
- consented-content marker;
- data request handling;
- service health visibility;
- support ticket triage.

## Current boundary

This contract does not claim a full CRM or production staff console. Remaining work includes staff login, role-management UI, notification workflows, support replies, data-request orchestration, production refund integration, paging/alerts, and richer dashboards.
