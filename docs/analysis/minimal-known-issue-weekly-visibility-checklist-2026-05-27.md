# Minimal Known-Issue Weekly Visibility Checklist — 2026-05-27

Source strategy document: [`docs/plans/astra-zero-config-saas-operating-model-2026-05-27.md`](../plans/astra-zero-config-saas-operating-model-2026-05-27.md).

## Scope

Implement the support metric that the top issue is visible weekly and that linked known-issue patterns can be tracked without building a full support desk, SLA workflow, notification queue, or report-body review system.

## Current implementation status

| Area | Status | Notes |
|---|---:|---|
| Weekly top issue aggregate | ✅ Done | `summarizeSupportReports()` now emits `weeklyTopIssues[]` with the top aggregate issue per UTC week. |
| Known-issue linkage | ✅ Done | Weekly buckets preserve linked `knownIssueId` / `knownIssueStatus` when report matching finds a known issue. |
| Operator visibility | ✅ Done | Astra Web Account support triage shows a `Weekly top issue` metric and aggregate-only helper copy. |
| Privacy boundary | ✅ Done | Weekly grouping uses report count, week start, hostname, feature surface, issue category, and known issue metadata only; it omits message bodies, page text, transcripts, screenshots, prompts, model output, emails, device ids, session ids, and per-user rows. |
| Inbox durability | ✅ Done | File-backed support report writes are serialized, saved atomically, and invalid retained inbox files are refused rather than overwritten. |
| Stale operator token guard | ✅ Done | Astra Web gates support report summaries/lists by the operator token that loaded them and discards stale refresh results after token changes. |
| Repeat-report decline analysis | Deferred | The weekly aggregate makes repeated patterns visible; causal decline after known-issue clicks still requires a later telemetry/cohort dashboard. |
| Full support desk/SLA | Deferred | No customer reply workflow, notification system, SLA clock, or hosted support vendor integration is introduced. |

## Endpoint

```text
GET /v1/ops/support/reports/summary
X-Astra-Operator-Token: <operator token>
```

Added response field:

- `weeklyTopIssues[]`
  - `weekStart` (UTC Monday date, `YYYY-MM-DD`)
  - `reportCount`
  - `latestSubmittedAt`
  - `hostname`
  - `featureSurface`
  - `issueCategory`
  - `knownIssueId`
  - `knownIssueStatus`

## Validation

Completed validation for this slice:

```text
pnpm test src/server/support-report-store.test.ts src/server/index.test.ts src/web/src/lib/astra-web.test.ts src/web/src/app.test.tsx
# 4 files / 103 tests passed (WEEKLY_ISSUE_TEST_EXIT:0)

pnpm type-check
# TYPECHECK_EXIT:0

pnpm check:repo-knowledge
# REPO_KNOWLEDGE_EXIT:0
```

## Completion boundary

This slice does not claim support operations are complete. It only makes weekly top issues and linked known-issue patterns visible in existing metadata-only support summaries. Production support still needs trend charts, SLA policy, support-desk integration, staff assignment workflow, and causal known-issue click → repeat-report decline analysis.
