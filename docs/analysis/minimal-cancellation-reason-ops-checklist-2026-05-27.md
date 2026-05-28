# Minimal cancellation/refund reason ops checklist — 2026-05-27

## Scope

This slice adds a metadata-only cancellation/refund reason intake and aggregate operator summary. It does **not** implement production billing cancellation, refund issuance, win-back automation, or support-desk workflows.

## Implemented

- Authenticated device-bound users can submit normalized cancellation/refund feedback through `POST /v1/account/cancellation-reasons`.
- Reasons use the existing product taxonomy in `src/utils/cancellation-reasons.ts`; sources are normalized to `settings`, `billing_portal`, `refund_request`, `support`, or `unknown`.
- The relay persists retained metadata in `src/server/cancellation-reason-store.ts` using atomic writes, serialized concurrent writes, and invalid-file preservation.
- Operator-only `GET /v1/ops/cancellations/reasons/summary` returns aggregate counts by reason, plan, and source plus coverage metrics.
- The operator summary intentionally omits raw emails, device ids, session ids, tokens, hostnames, free-form notes, page text, prompts, and per-user recent rows.
- Ops audit records both user submissions and operator summary views as metadata-only actions.
- Options Diagnostics submits the metadata to the relay when signed in and falls back to the existing local learning-loop event when the relay is unavailable.
- Astra Web Account adds a token-gated `Cancellation / refund reasons` operator card with token-bound stale-state protection.

## Validation

- `pnpm test src/server/cancellation-reason-store.test.ts src/server/index.test.ts src/server/config.test.ts src/utils/cancellation-reasons.test.ts src/utils/astra/support.test.ts src/entrypoints/options/OptionsApp.test.tsx src/web/src/lib/astra-web.test.ts src/web/src/app.test.tsx` → `TARGETED_TEST_EXIT:0` (8 files / 151 tests).
- `pnpm type-check` → `TYPECHECK_EXIT:0`.
- `pnpm check:repo-knowledge` → `REPO_KNOWLEDGE_EXIT:0`.
- Oracle review after removing per-user recent rows from the operator summary: `LGTM`.

## Remaining outside this slice

- Billing-provider cancellation/refund webhooks and refund issuance.
- Customer-facing cancellation portal UX beyond metadata feedback in Diagnostics.
- Operator paging, SLA workflows, saved views, exports, and dashboard trend charts.
- Win-back campaigns or automated lifecycle messaging.
