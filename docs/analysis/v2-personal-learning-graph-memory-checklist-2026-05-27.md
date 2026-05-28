# V2 Personal Learning Graph Memory Checklist — 2026-05-27

Source: `/Users/ruirui/Downloads/astra-zero-config-saas-operating-model-2026-05-27.md`, section 13 and V2 roadmap.

## Scope

This slice turns the Personal Learning Graph trust boundary into an executable memory inventory, Privacy Mode write policy, a focused local-only Library "What Astra remembers" surface, and a small repo-side cloud/server metadata inventory + deletion-receipt foundation. It does not claim external provider deletion receipts, full cross-device UI polish, automated topic/glossary suggestions, notifications/email, or proactive memory digests are complete.

## Coverage

| Requirement | Status | Evidence |
|---|---:|---|
| User-visible "what Astra remembers" entry point | ✅ Options + Library local surface | Options General renders `data-testid="learning-memory-inventory"`; Vocabulary Library now has a `memory` / "What Astra remembers" tab with local-only trust copy, inventory sections, remembered terms, and per-source timelines. |
| Unified inventory across profile, terms, saved snippets, sources, review state, and controls | ✅ Contracted | `buildLearningMemoryInventoryFromState()` returns `learning_profile`, `remembered_terms`, `saved_snippets`, `source_history`, `review_state`, and `privacy_controls` sections. |
| No creepy personalization | ✅ Contracted | `evaluateLearningMemoryWritePolicy()` suppresses automatic topic/personalization memory when Privacy Mode is on, personalization is disabled, or a hostname is excluded. |
| Privacy Mode graph-update behavior is explicit | ✅ Contracted + audited | Privacy Mode reduces source/study/digest writes to coarse metadata and blocks automatic personalization memory. `LEARNING_MEMORY_WRITE_AUDIT_REGISTRY` enumerates current and future graph-writing surfaces and tests each registry expectation against `evaluateLearningMemoryWritePolicy()`. |
| Full Privacy Mode enforcement audit across graph-writing surfaces | ✅ Repo-side harness complete | Registry/test coverage includes automatic page translation source history, study progress, owned article capture, reading-history-to-owned-reading sync, explicit vocabulary saves, review scheduling, remembered terms, future topic signals, and future digest summaries. Tests assert expected Privacy Mode behavior and registry content boundaries. |
| Export/delete/control paths are visible as capabilities | ✅ Local controls implemented | Inventory sections expose controls including edit preferences, disable personalization, forget terms, delete saved items, remove source history, export learning data, and Privacy Mode. Library memory now wires local export, forget remembered term, clear terms, disable personalization, per-source digest/sync controls, and confirmation-gated local source deletion modes. |
| Local per-source timelines and bulk actions | ✅ Done | `buildLearningMemoryLibraryViewFromState()` derives privacy-safe rows from inventory plus vocabulary, owned reading, reading history, and study progress. `VocabularyApp` renders selectable per-source rows and bulk local actions for exclude from digest, disable sync, source-history-only deletion, and source + saved-card deletion. |
| No full page/transcript/prompt/model-output inventory | ✅ Tested | Inventory and Library rows hard-code false for full page text, transcript text, prompt text, model output, and full URL paths. Tests assert raw sentence content, model-output-like explanations, URL queries/hashes, and full source URLs are not rendered in the memory timeline. |
| Cross-device/server-side memory inventory and deletion proof | ✅ Repo-side API foundation complete | Authenticated `GET /v1/account/learning-memory/inventory` summarizes cloud sync collections and weekly digest archive counts/cursors/preferences using metadata only. Authenticated `DELETE /v1/account/learning-memory` clears server-side sync mutations + weekly digest archive rows and returns `astra-cloud-learning-memory-deletion-receipt.v1` with affected counts, timestamp, schema, and explicit cloud-only/privacy boundary. Tests assert no saved sentence text, raw URLs/hostnames, email, device/session ids, or sync payload bodies appear in inventory. |

## Deferred

- External/cloud-provider deletion receipts or proof beyond Astra relay storage.
- Full cross-device UI polish for the cloud inventory/receipt beyond the API foundation.
- Automated topic/glossary suggestion UI beyond current user-reversible remembered terms.
- Notifications/email or proactive memory digests beyond the local Library view.

## Validation

Completed in this slice:

- 2026-05-28 cloud/server foundation slice: `src/server/user-store.ts` and `src/server/index.ts` add authenticated metadata-only cloud learning-memory inventory plus deletion receipt endpoints; `src/server/index.test.ts` covers counts/cursors, no raw content/URL/email/device exposure, and cloud server-side clearing of sync mutations + weekly digest archive rows.
- 2026-05-28 audit-harness slice: `LEARNING_MEMORY_WRITE_AUDIT_REGISTRY` added in `src/utils/storage/learning-memory.ts`; `src/utils/storage/learning-memory.test.ts` asserts all registered surfaces, expected Privacy Mode policy decisions, and raw-content-free registry boundaries.

Earlier validation:

- `pnpm test src/utils/storage/learning-memory.test.ts src/utils/storage/learning-memory-library.test.ts src/utils/storage/learning-assets.test.ts` → 3 files / 12 tests passed.
- Additional bulk vocabulary deletion check: `pnpm test src/utils/storage/learning-memory.test.ts src/utils/storage/learning-memory-library.test.ts src/utils/storage/learning-assets.test.ts src/utils/storage/vocabulary.test.ts` → 4 files / 34 tests passed.
- `pnpm test src/entrypoints/vocabulary/VocabularyApp.test.tsx` → 1 file / 36 tests passed.

Earlier baseline validation:

- `pnpm test src/utils/storage/learning-memory.test.ts` → 1 file / 3 tests passed (`LEARNING_MEMORY_TEST_EXIT:0`).
- `pnpm test src/entrypoints/options/OptionsApp.test.tsx` → 1 file / 33 tests passed (`OPTIONS_TEST_EXIT:0`).
- After Oracle blocker fix: `pnpm test src/utils/storage/learning-memory.test.ts src/entrypoints/options/OptionsApp.test.tsx` → 2 files / 36 tests passed (`MEMORY_OPTIONS_TEST_EXIT:0`).
- `pnpm type-check` → passed (`TYPECHECK_EXIT:0`).
- `pnpm check:repo-knowledge` → passed (`REPO_KNOWLEDGE_EXIT:0`).

- Oracle review for the multi-file memory inventory/UI/docs update: first pass found a P1 because the Options summary hid `privacy_controls`; fixed by rendering all inventory sections and adding an Options test assertion for `Privacy controls`. Follow-up review LGTM.
