# UI-backed product gaps: Plan

## Goal
Turn the certified UI redesign into an implementation roadmap for the product behavior behind the UI. The current screenshots now have strong visual coverage, but several surfaces are backed by `astraCert=1` fixtures, local-only storage, disabled controls, or truthful “planned” copy rather than complete backend/runtime behavior.

## Background
- The certification report scopes `astraCert=1` routes as deterministic local fixtures, not shipped user data (`docs/reviews/ui-redesign-parity-screenshot-certification-2026-05-13.md:13-32`).
- Web certification paths bypass normal product routes for landing/workspace visuals (`web/src/app.tsx:1499-1505`). Normal document/media persistence is local and single-slot per workspace type (`web/src/lib/workspace-store.ts:223-256`, `web/src/lib/workspace-store.ts:437-465`).
- Auth/session and billing handoff APIs exist, but sign-in provider buttons and full commercial lifecycle are incomplete (`web/src/app.tsx:2119-2124`, `web/src/lib/astra-web.ts:678-805`).
- Extension UI hides or defers unimplemented capabilities: Mark/Highlight are hidden (`src/entrypoints/content/components/SelectionToolbar.tsx:42-44`), optional page/site permissions are planned but not shipped (`src/entrypoints/onboarding/OnboardingApp.tsx:681-717`), and page translation retry is bound to the current live session (`src/entrypoints/content/page-translate.ts:996-1012`).
- Four-grade SRS now works locally, but schedule fields remain excluded from cloud continuity (`src/utils/storage/config-sync.ts:528-532`).

## Truthfulness Contract
- Screenshot Pass means the UI matched the reference under documented capture conditions; it does not mean the normal route has complete product behavior.
- `astraCert=1` branches are certification/demo fixtures. They must remain explicit, tested for non-leakage, and excluded from product-completeness claims.
- A surface graduates from “visually certified” to “product-complete” only when the normal, non-cert route satisfies the acceptance criteria below.
- New product claims need normal-mode tests and, where user-visible, updated screenshots or report notes.

## Approach
Build the missing runtime foundations before expanding more UI. The first implementation wave should make workspace/library state account-aware and migration-safe, then add document/media durability, learning-state sync, permission controls, annotations, and translation diagnostics. Billing, OAuth provider buttons, and secondary public pages should be handled as a separate commercial-track plan unless the next milestone explicitly prioritizes launch monetization.

## Implementation Progress
- [x] Work Item 1 — Account-scoped workspace and library foundation. Implemented normalized web library items, copy-first migration/journal/mapping, local multi-item APIs, metadata-only account import, `/assets` real-record sourcing, and storage health coverage. Verified with `pnpm vitest run web/src/lib/workspace-store.test.ts`, `tsc -p web/tsconfig.json --noEmit`, and `pnpm type-check`.
- [x] Work Item 2 — Document/media metadata and extracted-text durability. Implemented library-item keyed document snapshots, extracted-text budget/chunk manifests, config-sync validation scaffolding, cloud materialization, and truthful re-import UI for original bytes. Verified with `pnpm vitest run web/src/lib/workspace-store.test.ts src/utils/astra/sync-push.test.ts` and `pnpm type-check`.
- [x] Work Item 3 — Cloud learning durability for review schedules and study stats. Implemented `review_schedule` sync validation/collection handling across extension, server, Cloudflare, and relay-lite paths; review completion now records schedule state; old entries receive safe defaults; daily study stats remain explicitly local-only. Verified with `pnpm type-check`, focused frontend/storage tests, backend/platform sync tests, and relay-lite tests.
- [x] Work Item 4 — Optional page/site permission controls. Implemented `src/utils/extension/page-permissions.ts` for page/current-origin/all-sites helpers, optional-host permission request/remove wrappers, runtime revoke policy, and broadcast reconciliation; wired background permission events, popup/onboarding controls, content-script stop/reconcile behavior, hover/selection/input no-op guards after revoke, cautious compatibility copy/docs, and focused tests. Verified with `pnpm vitest run src/utils/extension/page-permissions.test.ts src/entrypoints/content/index.test.ts src/entrypoints/onboarding/OnboardingApp.test.tsx src/entrypoints/popup/App.test.tsx` and `pnpm type-check`.
- [x] Work Item 5 — Persistent Mark/Highlight/sticky-note annotations.
- [x] Work Item 6 — Page translation retry/session diagnostics. Implemented session-scoped retry diagnostics in `browser.storage.session`, page/session/block fingerprint keys, TTL/per-page caps, clear-on-success/stop/revoke, historical-vs-recoverable FloatBall behavior, SPA race guards, and focused tests. Verified with focused diagnostics/content tests, root tsc, web tsc after `assetTiles` type fix, and prior Work Item 6 checks.

## Work Items

### 1. Account-scoped workspace and library foundation
**Why first:** Web PDF/assets certification currently renders a combined fixture plate; normal routes still use single-slot local snapshots.

**Scope**
- Add a normalized library item model for article, PDF, EPUB, subtitle, video-note, and asset surfaces.
- Keep signed-out items local; make signed-in metadata account-scoped and sync-ready.
- Migrate existing single-slot workspace records into first library items without deleting legacy data until readback succeeds.
- Add an explicit sign-in merge path: local signed-out items remain local until the user chooses to import/sync them into the account.

**Migration and merge rules**
- Use copy-first migration: write new library records, validate readback, then mark legacy records as migrated; do not delete legacy records in the same release.
- Add a migration journal/version so failed migrations can retry idempotently.
- Preserve legacy-to-library id mapping so existing workspace routes and recent-import links can resolve after migration.
- Resolve metadata conflicts with deterministic `updatedAt`/source precedence for v1; do not auto-upload large local snapshots during sign-in merge.

**Key seams**
- `web/src/lib/workspace-store.ts`: Dexie/localStorage schema, migration, storage health.
- `web/src/app.tsx`: `/articles`, `/files/*`, `/video-notes`, `/assets` list/detail behavior.
- `web/src/lib/astra-web.ts` and `platform/cloudflare/src/*`: account-scoped library metadata API and repository.

**Acceptance criteria**
- Existing local PDF/article/EPUB/subtitle/video-note data survives migration and can be rolled back by reading legacy records.
- Multiple documents can be imported, listed, opened, renamed, removed, and recovered locally.
- Signed-in metadata syncs across sessions/devices after explicit account import or account-owned creation.
- `/assets` is built from real library/cloud records, not certification arrays.
- Storage health/repair covers the new tables, migration journal, and id mapping.

### 2. Document/media metadata and extracted-text durability
**Why second:** Library metadata is not enough; document screens need durable extracted state before they can truthfully claim cross-device continuity.

**Scope**
- Sync metadata and extracted text snapshots for imported documents/media by library item id.
- Define payload budgets before implementation: max extracted-text size, chunking threshold, retention policy, and failure UI for oversized imports.
- Keep original-file byte sync out of this plan until object storage, privacy, quota, and deletion policy are approved.

**Key seams**
- `web/src/lib/workspace-store.ts`: snapshot records keyed by library item id.
- `web/src/lib/astra-web.ts`: list/read/write/delete client methods when backend routes exist.
- `platform/cloudflare/src/handlers/*`, `repositories/*`, `sql/*`: metadata and extracted-text snapshot storage.

**Acceptance criteria**
- Refreshing or reopening restores multiple document workspaces.
- Signed-in users can recover metadata and extracted text on another browser.
- If original bytes are not synced, UI says re-import is required for binary viewer access.
- No UI claims cross-device file-byte availability in this milestone.

### 3. Cloud learning durability for review schedules and study stats
**Why third:** Review UI now has true four-grade SRS, but the schedule is still local-only.

**Scope**
- Add a review-schedule sync collection separate from vocabulary text records.
- Sync `srsBox`, `nextReviewAt`, `reviewCount`, `lastReviewedAt`, and last grade metadata.
- Start with last-write-wins schedule records using server/account timestamps; defer an event ledger unless analytics/audit requirements need it.
- Add daily study stats sync or keep it explicitly local-only in continuity status.

**Key seams**
- `src/utils/storage/vocabulary-core.ts`: schedule projection helpers.
- `src/utils/storage/config-sync.ts`: push/pull and local-only summary updates.
- `src/entrypoints/vocabulary/ReviewMode.tsx`: write schedule records after review.
- `web/src/lib/astra-web.ts`, `web/src/app.tsx`: cloud learning summary and account/assets readiness.

**Acceptance criteria**
- Reviewing a word on device A updates due counts on device B after sync.
- Again/Hard/Good/Easy remain distinct after sync.
- Old vocabulary entries without schedule records receive safe defaults.
- Continuity status no longer lists SRS fields as local-only after migration.

### 4. Optional page/site permission controls
**Why after sync foundations:** This is high-trust UX, but it does not unlock the web library backbone.

**Scope**
- Implement browser permission helpers for current page, current site, and all-sites behavior.
- Wire onboarding and popup controls only after browser compatibility is verified.
- Broadcast grant/revoke changes to active extension pages and content scripts so running UI reconciles immediately.
- Keep broad-access disclosure until optional grants are actually shipped.

**Key seams**
- WXT/manifest config.
- New permission utility wrapping `browser.permissions` and `activeTab` behavior.
- `src/entrypoints/onboarding/OnboardingApp.tsx`, `src/entrypoints/popup/App.tsx`, `src/entrypoints/content/index.tsx`.

**Acceptance criteria**
- “This site” grants only the current origin.
- “Page only” uses active-tab behavior and does not persist host grants.
- Revoking a site stops future automatic actions for that origin and tells active content scripts to stop/reconcile.
- Chrome/Firefox/Safari behavior is documented before copy changes claim support.

**Implementation summary (2026-05-13)**
- Changed files: `wxt.config.ts`; `src/utils/extension/page-permissions.ts`; background/content/onboarding/popup entrypoints; popup quiet-reader section; hover/selection/input content components; `test/utils/mockBrowser.ts`; focused tests; `docs/specs/optional-page-site-permissions.md`.
- Verification: `pnpm vitest run src/utils/extension/page-permissions.test.ts src/entrypoints/content/index.test.ts src/entrypoints/onboarding/OnboardingApp.test.tsx src/entrypoints/popup/App.test.tsx` → 4 files / 99 tests passed (`FOCUSED_TEST_EXIT:0`); `pnpm type-check` → `TYPECHECK_EXIT:0`.
- Deferred gaps: broad `host_permissions: ["*://*/*"]` remains intentionally disclosed; programmatic content-script injection for pages without an existing Astra script and Safari/iOS device-backed permission prompt parity are deferred.

### 5. Persistent Mark/Highlight/sticky-note annotations
**Why after permission controls:** Annotation persistence needs a stable page access and anchoring policy.

**Scope**
- Add a page annotation model with page URL/origin, quote text, text-position/selector anchors, created/updated timestamps, and unresolved-anchor state.
- Persist v1 annotations in extension-controlled local storage with a documented cap/eviction policy; project sync later through the account library after sync contracts exist.
- Add rendering, deletion, and unresolved-anchor handling.
- Unhide Mark/Highlight only after persistence and page rendering exist.
- Keep vocabulary Save distinct from page annotation actions.

**Key seams**
- `src/entrypoints/content/components/SelectionToolbar.tsx`: unhide actions after support exists.
- New storage/rendering modules under `src/utils/storage` and content entrypoints.
- Popup/assets/library surfaces for annotation lists.

**Acceptance criteria**
- Highlight created from a selection survives reload.
- Highlight can be deleted.
- Failed anchor resolution is shown without losing the saved annotation.
- Storage cap behavior is deterministic and user-visible when reached.
- Mark/Highlight do not create vocabulary entries unless the user chooses Save.

**Implementation summary (2026-05-13)**
- Changed files: `src/utils/storage/page-annotations.ts`; `src/entrypoints/content/page-annotations.ts`; selection toolbar/content entrypoint wiring and focused tests; `docs/specs/page-annotations-v1.md`.
- Verification: `pnpm vitest run src/utils/storage/page-annotations.test.ts src/entrypoints/content/page-annotations.test.ts src/entrypoints/content/components/SelectionToolbar.test.tsx src/entrypoints/content/index.test.ts` → 4 files / 54 tests passed (`FOCUSED_TEST_EXIT:0`); `pnpm type-check` → `TYPECHECK_EXIT:0`.
- Deferred gaps: v1 remains extension-local only with no account/cloud sync; sticky-note records are supported by the model/renderer but note-authoring UI is deferred; annotation list/library surfaces beyond the in-page panel are deferred.

### 6. Page translation retry/session diagnostics
**Why separate:** Current retry UI works for the live session but not across navigation or teardown.

**Scope**
- Persist lightweight retry diagnostics keyed by page/session/block fingerprint.
- Store active diagnostics in session-scoped extension storage, not durable account/local history, unless a later product requirement asks for history.
- Bound diagnostics by TTL and count per tab/page; clear on successful translation, explicit stop, or permission revoke.
- Avoid stale retry buttons when no live session can handle them.

**Key seams**
- `src/entrypoints/content/page-translate-registry.ts`: stable block fingerprint.
- `src/entrypoints/content/page-translate.ts`: issue writes/clears.
- `src/entrypoints/content/components/FloatBall.tsx`: recoverable vs historical failure display.

**Acceptance criteria**
- Active-session retry still works.
- Navigation does not leave retry UI pointing at a missing session.
- Returning to the same page in the same browser session can show previous failure diagnostics.
- Stop/clear/revoke removes active retry state predictably.

## Later Commercial Track
Keep these out of the core backend-gap implementation unless the product milestone explicitly shifts to commercial launch:

- Billing/pricing lifecycle: `/pricing`, checkout success/cancel states, subscription lifecycle states, entitlement enforcement, webhook persistence, and truthful inactive-plan degradation.
- OAuth provider buttons: either remove/label disabled Google/Apple buttons or implement real provider exchange/session creation.
- Secondary public pages: help/support, status, legal, changelog, and commercial support content.

## Dependencies and Sequencing
1. Account-scoped library metadata must land before cloud document/media UX can be truthful.
2. Extracted text sync can ship before original file-byte sync; byte sync needs separate storage/privacy policy.
3. Review schedule sync should use a separate collection to avoid old clients overwriting vocabulary records without SRS fields.
4. Permission UI copy must not change from “planned” to “available” until optional permission helpers, active-script broadcast, and browser compatibility are verified.
5. Mark/Highlight should stay hidden until annotations persist and render reliably.
6. Commercial/OAuth work should be planned separately unless the next milestone explicitly prioritizes monetization.

## Open Questions
- What exact extracted-text payload budget and chunking threshold should the web/backend accept for PDF/EPUB/subtitle imports?
- Do we approve object/blob storage for original file bytes, or keep cross-device document access limited to metadata and extracted text for the next milestone?
- Is last-write-wins acceptable for SRS schedule sync v1, or does the product need a review event ledger from day one?
- Should signed-out local workspaces auto-prompt for account import on sign-in, or stay local-only until opened from a dedicated merge queue?

## References
- `docs/reviews/ui-redesign-parity-screenshot-certification-2026-05-13.md`
- `docs/reviews/ui-backed-product-gaps-critique.md`
- `docs/plans/ui-redesign-parity-matrix-work-item-1-2026-05-12.md`
- `docs/plans/work-item-2-extension-chrome-deferred-2026-05-12.md`
- `docs/plans/work-item-4-reading-learning-deferred-2026-05-13.md`
- `docs/plans/work-item-5-web-document-media-deferred-2026-05-13.md`
- `docs/investigations/astra-web-landing-ui-plan-gap-review-2026-05-12.md`
- `docs/adr/0002-astra-managed-auth-relay.md`
