# Critique: UI-backed Product Gaps Plan

## 1. Top 3 under-specified seams
1. **Library Migration Strategy (Item 1)**: The plan mandates migrating single-slot workspace records (`web/src/lib/workspace-store.ts:223-256`, e.g., `LARGE_WORKSPACE_KEYS`) to account-scoped library items but lacks details on handling migration collisions, ID mappings, or how to rollback a corrupted IndexedDB migration for large blobs.
2. **Annotation Persistence (Item 5)**: Citing "New storage/rendering modules under `src/utils/storage`" is too vague. It fails to specify the underlying storage mechanism (IndexedDB vs. `chrome.storage.local`), how it interacts with the extension's sync pipeline, and the strategy for handling orphaned anchors in dynamic page environments.
3. **Session Diagnostics Storage (Item 6)**: The plan references persisting translation retry diagnostics across navigations (`src/entrypoints/content/page-translate.ts`) but fails to define the storage boundary (e.g., `chrome.storage.session` vs `local`). Without an explicit eviction policy, this risks unbound storage bloat for heavily translated pages.

## 2. Contradictions or missing dependencies in the plan
- **Contradiction on Sign-in Merge**: Item 2 (Phase 2A) aims to sync metadata and extracted text snapshots, but Item 1 specifies "Keep signed-out items local." The plan does not articulate the merge/conflict strategy when a signed-out user with heavily populated local workspaces signs in.
- **Missing State Broadcast Dependency**: Item 4 (Permission controls) implies changes in `src/entrypoints/onboarding/OnboardingApp.tsx` and the popup. However, it misses the dependency on how `browser.permissions` changes are broadcast to already-running content scripts to instantly enable/disable active translation features without a page reload.

## 3. Risk of over-planning — sections that should be cut or simplified
- **Cut Items 7 & 8**: The plan admits product policy for Billing, Pricing, and OAuth providers is not fully specified. Detailing their implementation and acceptance criteria now is premature and distracts from core foundations. Cut them from this document until policies are finalized.
- **Simplify Item 2**: Phase 2B (original-file byte storage) explicitly relies on an unapproved policy. Drop Phase 2B completely from the current plan to tighten focus solely on Phase 2A (metadata and extracted text sync).

## 4. Questions whose answers would change implementation order
- **Payload Limits**: How large are the extracted text snapshots in Item 2? If they exceed API payload or fast-storage limits (e.g., Cloudflare KV vs R2), Item 2 will require a major architectural pivot (e.g., chunking) and should be designed concurrently with Item 1.
- **SRS Event History vs Last-Write-Wins**: The "Open Questions" section asks if SRS schedule sync (Item 3) should include an event ledger. If an event ledger is required for accuracy, the data model drastically changes, and this design must be front-loaded before finalizing the config-sync mutations seen in `src/utils/storage/config-sync.ts`.
- **Sync Conflict Strategy**: Are we supporting offline modifications that queue mutations for later? If so, the simple last-write-wins model for library metadata (Item 1) is insufficient and a robust sync engine must be planned before migrating local data.