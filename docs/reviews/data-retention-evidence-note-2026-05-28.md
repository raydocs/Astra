# Data Retention / User-Control Evidence Note — 2026-05-28

Source objective: macro product upgrade plan Sections 9 and 26.

This note records repository-side evidence only. It does not prove production deployment, legal deletion processing, billing-provider erasure, or manual RC verification.

## Repo-side evidence now present

| Area | Evidence | Current interpretation |
|---|---|---|
| Policy/readiness contract | `src/utils/data-retention-control.ts`, `src/utils/data-retention-control.test.ts` | Defines conservative data categories, copyright boundaries, Privacy Mode copy accuracy, and user-control readiness. |
| Local learning-data export | `src/utils/storage/learning-data-export.ts`, `src/utils/storage/learning-data-export.test.ts` | Exports learning assets with copyright/privacy boundary copy instead of full third-party pages/transcripts by default. |
| Library source deletion controls | `src/entrypoints/vocabulary/VocabularyApp.tsx`, `src/entrypoints/vocabulary/VocabularyApp.test.tsx` | Provides source-only vs source-plus-linked-card deletion choice and digest/sync source controls. |
| Options privacy/data card | `src/entrypoints/options/OptionsApp.tsx` | Exposes export, saved-data management, and account-deletion help entrypoints. |
| Metadata-only support bundle | `src/utils/support-bundle.ts`, `src/utils/support-bundle.test.ts` | Keeps support bundle defaults to metadata and excludes raw content/full URL fields. |
| Node relay account-delete foundation | `src/server/index.ts`, `src/server/user-store.ts`, `src/server/index.test.ts` | Repo contains relay-side account deletion foundation for user/devices/sessions/sync records. |
| Cloudflare continuity lifecycle | `src/platform/cloudflare/src/handlers/account-lifecycle.ts`, `src/platform/cloudflare/src/queues/continuity-lifecycle.ts`, `src/platform/cloudflare/src/handlers/account-lifecycle.test.ts`, `src/platform/cloudflare/src/queues/continuity-lifecycle.test.ts` | Repo contains collection-scoped cloud export/delete scheduling, status semantics, queue processing, tombstone/delete-mutation flow, and tests. |
| Help path | `docs/help/delete-your-data.md`, `docs/specs/data-retention-user-control.md` | User-facing delete/export guidance exists in repo while target-release deployment evidence remains required. |

## Boundary that remains

Do not claim complete self-serve data lifecycle until all of the following are attached for the target release:

1. deployed route/queue/storage receipts for account deletion and Cloudflare continuity lifecycle;
2. manual RC walkthrough proving the user-visible export/delete/help paths for the target build;
3. complete account, billing, entitlement, support-ticket, and legal-retention deletion policy evidence;
4. cancellation/access behavior evidence for paid membership claims;
5. owner approval that public privacy/help copy matches the deployed behavior.

## Allowed downgrade copy

Local export/delete controls, metadata-only support bundles, relay account-delete foundation, Cloudflare collection-scoped cloud-delete lifecycle, and delete-data help copy exist in repo. Production deployment receipts, complete account/billing/legal deletion orchestration, cancellation/access evidence, and manual RC verification remain required before stronger data-lifecycle claims.
