# Library QA Evidence Note — 2026-05-28

Source plan: Section 6 of `docs/plans/astra-macro-product-upgrade-plan-2026-05-27.md`.

Purpose: attach current repo-side QA evidence for the Learning Library surface without converting repository tests into broader launch proof. This note supports public-beta downgrade copy only; it does not claim full first-class per-asset Library completion.

## Validation markers

- `LIBRARY_ASSET_COVERAGE_FOCUSED_EXIT:0`
- `LIBRARY_ASSET_COVERAGE_COMBINED_EXIT:0`
- Current focused coverage includes `src/entrypoints/vocabulary/VocabularyApp.test.tsx`, `src/utils/learning-library-experience.test.ts`, and `src/utils/macro-operational-evidence.test.ts`.
- Any release candidate must still rerun Gate 1 and applicable live-browser lanes from `docs/release-readiness-checklist.md`.

## Repo-side QA coverage

| Library claim area | Current evidence | Verdict |
|---|---|---|
| Macro asset visibility | `library-asset-coverage-card` renders Saved Pages, Saved Videos, Saved Files, Saved Sentences, Saved Words, Video Notes, Reading Queue, Review Queue, Personal Glossary, and Learning Digest as ready / not-yet-added / planned rows. Covered by `shows every macro Library asset type as ready, empty, or planned`. | Repo-covered for visibility and empty/deferred explanation. |
| Source organization | `library-source-map-card` groups saved items by source type and source filters update the saved-list state. Covered by `organizes saved learning by source type and filters the library list`. | Repo-covered for source-type browsing. |
| Return to source | Reading rows expose resume behavior for article URLs, remote PDFs, EPUB handoff, subtitle-file handoff, and unavailable local-file states. Covered by tests including article revisit, remote PDF resume, EPUB resume, document queue rows, and saved-card reading-asset resume. | Repo-covered for tested queue return paths; browser/device replays remain release evidence. |
| Delete controls | Source detail panels show linked saved cards and require explicit source-only vs source + linked-card cascade confirmation. Covered by `shows source details and offers explicit cascade delete for linked saved cards`. | Repo-covered for explicit delete choices. |
| Export controls | Reading queue theme packs export as signed local JSON packages with visible count. Covered by `exports Reading queue theme packs as a signed local JSON package`. | Repo-covered for local theme-pack export. |
| Digest/source exclusions | Reading source controls include sync inclusion and digest exclusion via `setOwnedReadingUserControl()`; source rows preserve saved cards by default unless cascade is chosen. | Repo-covered at component/storage-helper level; RC QA should still walk the controls manually. |

## Current beta boundary

The Library can be described as: Library home, source map, asset projection, and visible ready/empty/planned rows for every macro asset type exist; source return, delete, and export controls are covered by repository tests.

Do **not** claim yet:

- every macro asset type has a rich first-class detail page;
- every source return path has fresh browser/device replay evidence for this RC;
- delete/export controls have been manually walked across every asset type and browser target;
- saved videos, video notes, personal glossary, or Learning Digest delivery are complete production surfaces.

## Required before stronger claim

Before upgrading Section 6 beyond beta-boundary language, fill the Section 6 rows in `docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md` and attach a current manual/browser QA packet covering:

1. source return from articles, remote PDFs, local PDFs, EPUBs, subtitle files, and video/transcript-origin cards;
2. source-only delete and source + linked-card cascade delete with export backup guidance;
3. signed theme-pack export/import recovery for representative source types;
4. empty/deferred macro asset rows and their copy in the rendered Library UI;
5. richer per-asset flows for Saved Videos, Video Notes, Personal Glossary, and Learning Digest if those are claimed as first-class launch surfaces.
