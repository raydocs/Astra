# Saved reading queue — v1 contract (Month 3)

_Version: 2026-04-15 · Status: implemented minimum queue_

## Surface

Current queue surface: `src/entrypoints/vocabulary/VocabularyApp.tsx` → **Reading** tab.

This is the single queue entry surface for Month 3 v1.

## Queue views

| View | Rule | Purpose |
|---|---|---|
| **Recent** | all non-archived `OwnedReadingItem` rows, ordered by `openedAt` | last active reading items across supported source types |
| **Saved** | `OwnedReadingItem.status === "saved"` | items the user wants easy access to later |
| **In progress** | `OwnedReadingItem.status === "in_progress"` | items the user is actively working through |

`Archived` rows stay in storage but are hidden from these three queue views.

## Supported source types

| Source type | Queue support in v1 | Resume behavior |
|---|---|---|
| `article` | full | opens the canonical article URL directly |
| remote `pdf` | full | opens the PDF reader with the saved remote URL |
| local `pdf` | handoff | opens the PDF reader and shows a prompt to choose the same file again |
| `epub` | handoff | opens the EPUB reader and shows a prompt to choose the same file again |
| `subtitle-file` | handoff | opens the subtitle reader and shows a prompt to choose the same file again |

This means the queue can directly reopen at least two source families now:

- article
- remote PDF

## Resume contract

Queue rows rely on `src/utils/storage/owned-reading.ts` helpers for:

- queue-view classification
- source-type labels
- resume target generation
- user-facing resume guidance
- retained progress labels (`fraction`, `chapterId`, `sentenceIndex` when present)

UI surfaces should not invent separate reopen rules outside that module.

Current v1 continuity surfaced in the Reading tab:

- article: page identity + study-loop summary from `study-progress.ts`
- remote/local PDF: retained progress fraction when known
- EPUB: retained `chapterId`
- subtitle-file: reader handoff guidance

## Storage behavior

- article history is synced into the queue via `syncRecentReadingHistoryToOwnedQueue()`
- row recency comes from `openedAt`
- status changes use `setOwnedReadingStatus()`
- row removal uses `removeOwnedReadingItem()`
- queue resume updates recency through `markOwnedReadingOpened()`

## Boundaries

- This is not yet a generalized multi-surface resume center.
- Local-file resume is reader handoff, not automatic file restoration.
- Advanced sort/filter/search stays out of scope for v1.
- New source types stay out of scope for this task.

## Validation

Focused validation for v1:

- `src/utils/storage/owned-reading.test.ts`
- `src/utils/storage/vocabulary.test.ts`
- `src/utils/storage/study-progress.test.ts`
- `src/entrypoints/vocabulary/VocabularyApp.test.tsx`
- `src/entrypoints/vocabulary/ReviewMode.test.tsx`
- `bench-live/scenarios/learning-loop-revisit-smoke.ts`

Fresh replay artifact after the source-link/progress mapping pass:

- `bench-live-results/live-20260414T113019-89glbv/`

## Related docs

- `docs/investigations/owned-reading-schema-v1-2026-04-14.md`
- `docs/investigations/owned-reading-item-spec-2026-04-15.md`
