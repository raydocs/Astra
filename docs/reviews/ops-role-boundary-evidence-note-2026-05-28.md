# Ops Role Boundary Evidence Note — 2026-05-28

Source objective: macro product upgrade plan Section 30.

This note records repository-side evidence for operations-console role boundaries. It does not prove production operator provisioning, monitored staff process, or a complete customer-support runbook.

## Repo-side evidence now present

| Area | Evidence | Current interpretation |
|---|---|---|
| Role/action/module matrix | `src/utils/ops-console.ts`, `src/utils/ops-console.test.ts` | Defines support agent, support lead, ops engineer, admin, and privacy reviewer roles, with module visibility and allowed actions. |
| Operator principal configuration | `src/server/config.ts`, `src/server/config.test.ts` | Parses `ASTRA_OPERATOR_TOKENS`, validates role IDs against the ops role matrix, and rejects duplicate IDs/tokens. |
| Server-side enforcement helper | `src/server/index.ts` (`requireOperatorPrincipal`) | Resolves env-backed operator principals, checks route permissions, records denied attempts with metadata-only audit logs, and rejects unauthorized or underprivileged operators. |
| Role-scoped ops routes | `src/server/index.ts` | Support reports, support summary, cost usage, provider health, cancellation reasons, user lookup, audit summary, known issues, feature-flag write paths, and the ops cockpit summary use role/module/action checks. |
| Enforcement regression | `src/server/index.test.ts` | Confirms a `support_agent` can read support summary, is denied cost usage, denial is audited with role/source/permission, unrecognized tokens return 401, raw operator tokens are not serialized, and ops cockpit access is role scoped. |
| Operator metadata privacy | `src/server/ops-audit-log-store.ts`, `src/server/index.test.ts` | Audit output hashes operator tokens and records metadata-only privacy state. Ops cockpit summary reads are audited as `ops_cockpit_summary_viewed` with provider-health inclusion recorded as metadata only. |
| Ops cockpit / operating review | `src/utils/operating-review.ts`, `src/utils/operating-review.test.ts`, `src/server/index.ts`, `src/server/index.test.ts`, `src/web/src/lib/astra-web.ts`, `src/web/src/lib/astra-web.test.ts`, `src/web/src/app.tsx`, `src/web/src/app.test.tsx` | Provides a role-gated, aggregate-only, read-only cockpit summary. `support_lead` can view the cockpit without provider health, while `ops_engineer`/admin paths include provider-health visibility. The web client parses missing privacy/source booleans conservatively and tests the visible ops cockpit card without exposing raw identifiers or content. |
| Web ops surface | `src/web/src/app.tsx` | Provides operator-facing support/ops views that consume role-protected server routes. |

## Boundary that remains

Do not claim production ops maturity until all of the following are attached for the target release:

1. production operator-principal provisioning evidence showing `ASTRA_OPERATOR_TOKENS` or successor identity claims are configured with least-privilege roles;
2. explicit decision on the legacy platform mirror secret fallback, which currently resolves as admin for backward compatibility;
3. manual RC walkthrough proving each role can access only intended modules/actions in the deployed environment, including ops cockpit/provider-health visibility by role;
4. owner-approved incident/support process for role changes, audit review, refunds, data requests, and support escalation;
5. evidence that hosted ops surfaces and relay routes are deployed to the same target commit/worktree.

## Allowed downgrade copy

Env-backed operator roles, server-side route permission checks, denied-attempt audit logs, metadata-only operator audit output, and repo-side aggregate ops cockpit/operating-review surfaces exist in repo. Production operator provisioning, legacy admin-token fallback retirement/approval, deployed role walkthroughs, and staff process evidence remain required before claiming full ops-console role maturity.
