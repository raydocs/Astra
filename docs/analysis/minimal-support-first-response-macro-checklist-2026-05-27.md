# Minimal Support First-Response Macro Checklist — 2026-05-27

Source strategy document: [`docs/plans/astra-zero-config-saas-operating-model-2026-05-27.md`](../plans/astra-zero-config-saas-operating-model-2026-05-27.md).

## Scope

Implement the First 30 support requirement that support first-response macros use ordinary user language and reach at least 80% coverage, without building a full support desk, reply workflow, SLA system, or notification queue.

## Current implementation status

| Area | Status | Notes |
|---|---:|---|
| Macro catalog | ✅ Done | `src/utils/support-response-macros.ts` defines first-response macros for all eight `SupportBundleIssueCategory` values. |
| Ordinary-language copy | ✅ Done | Macro titles, first responses, next steps, and privacy notes avoid provider/model/API/token/prompt/devtools/debug framing. |
| Metadata-only boundary | ✅ Done | Macro coverage uses issue category/count aggregates only; it does not use report message bodies, page text, transcripts, screenshots, prompts, model output, emails, device ids, or session ids. |
| Coverage metric | ✅ Done | `summarizeSupportFirstResponseMacroCoverage()` reports static catalog coverage and submitted-report coverage against the V0 80% threshold. |
| Operator visibility | ✅ Done | `GET /v1/ops/support/reports/summary` now includes `macroCoverage`, and Astra Web Account shows a compact `Macro coverage` metric in Support report triage. |
| Full support desk | Deferred | No customer replies, SLA clock, notifications, assignments beyond existing triage metadata, or hosted support-desk integration are introduced. |

## Endpoint

```text
GET /v1/ops/support/reports/summary
X-Astra-Operator-Token: <operator token>
```

Existing response fields remain, with added `macroCoverage`:

- `schema: "astra-support-first-response-macros.v1"`
- `threshold: 0.8`
- `catalogCoverage.coverageRate`
- `reportedCoverage.coveredReports`
- `reportedCoverage.totalReports`
- `reportedCoverage.unknownIssueReports`
- `reportedCoverage.coverageRate` (`null` when there are no submitted reports)
- `byIssueCategory[]` aggregate counts and macro ids
- `macros[]` static ordinary-language first-response templates

## Validation

Completed validation for this slice:

```text
pnpm test src/utils/support-response-macros.test.ts src/server/index.test.ts src/web/src/lib/astra-web.test.ts src/web/src/app.test.tsx
# 4 files / 104 tests passed (SUPPORT_MACRO_TEST_EXIT:0)

pnpm type-check
# TYPECHECK_EXIT:0

pnpm check:repo-knowledge
# REPO_KNOWLEDGE_EXIT:0
```

## Completion boundary

This slice does not claim support operations are complete. It only provides a metadata-safe first-response macro catalog, coverage summary, and compact operator visibility. Production support still needs reply handling, SLA policy, staffing workflow, help-center/status hosting, and any support-desk integration.
