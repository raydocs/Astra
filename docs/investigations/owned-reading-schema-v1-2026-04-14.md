# Owned reading item schema v1

_Task pack: **`M3-C-01`** — owned reading item schema v1_

_Status: implemented contract for Month 3 queue/revisit work_

## Source of truth

Implementation lives in `src/utils/storage/owned-reading.ts`.

Canonical exports:

- `OwnedReadingItemSchema`
- `OwnedReadingProgressSchema`
- `OwnedReadingStoreSchema`
- `OWNED_READING_STORAGE_KEY`
- identity builders in the same module

Storage key: `astra.owned_reading.v1`

## Purpose

`OwnedReadingItem` is the shared persisted model for user-owned reading context across:

- `article`
- `pdf`
- `epub`
- `subtitle-file`

It gives queue/revisit surfaces one place to read:

- stable identity
- dedupe rules
- reopen metadata
- per-item progress hints
- joins into reading history and study progress

Downstream surfaces should reuse this model instead of inventing parallel item ids or reopen keys.

## Schema v1

| Field | Type | Rule |
|---|---|---|
| `id` | `string` | Stable row id. New v1 rows use deterministic `or_${sourceType}_${encodeURIComponent(dedupeKey)}`. |
| `sourceType` | `article \| pdf \| epub \| subtitle-file` | Supported source families in v1. |
| `title` | `string` | User-visible label. |
| `sourceUrl` | `string \| null` | Canonical remote URL for article/remote-PDF rows. Null for local-file rows. |
| `localUri` | `string \| null` | Synthetic local identity for imported files, e.g. `astra-local://epub/book.epub`. |
| `reopenHint` | `string \| undefined` | User-facing reopen instruction when a direct URL is not available. |
| `openedAt` | `number` | Last-open timestamp used for recency sorting. |
| `progress` | `{ fraction?: number; chapterId?: string; sentenceIndex?: number } \| undefined` | Optional surface-specific progress payload. |
| `status` | `in_progress \| saved \| archived` | Queue bucket status. |
| `readingHistoryRecordId` | `string \| null` | Join key for article rows only. |
| `studyProgressRecordId` | `string \| null` | Join key when the item can attach to the page-level study loop. |

### Progress payload semantics

| Field | Used by v1 mapping | Meaning |
|---|---|---|
| `fraction` | PDF | Fractional completion hint for page-based readers. Current PDF mapping uses `1` when page count is known. |
| `chapterId` | EPUB | Last known chapter href/id. |
| `sentenceIndex` | reserved | Kept in schema for sentence-based reopen flows; not written by the current four mapping helpers. |

## Identity and dedupe rules

### Canonical identity per source family

| Source family | Canonical identity | Dedupe key | Row id example |
|---|---|---|---|
| `article` | sanitized page URL via `buildReadingHistoryRecordId(url)` | canonical article URL | `or_article_https%3A%2F%2Fexample.com%2Fstory` |
| remote `pdf` | sanitized remote URL via `buildStudyProgressRecordId(url)` | canonical PDF URL | `or_pdf_https%3A%2F%2Fcdn.example%2Fdoc.pdf` |
| local `pdf` | `astra-local://pdf/<encoded file name>` | local URI | `or_pdf_astra-local%3A%2F%2Fpdf%2Fpaper.pdf` |
| `epub` | `astra-local://epub/<encoded file name>` | local URI | `or_epub_astra-local%3A%2F%2Fepub%2Fbook.epub` |
| `subtitle-file` | `astra-local://subtitle/<encoded file name>` | local URI | `or_subtitle-file_astra-local%3A%2F%2Fsubtitle%2Fclip.srt` |

### URL normalization

Article and remote-PDF identities remove query string and hash before persistence. This matches:

- `reading-history.ts` for article rows
- `study-progress.ts` for page/study joins

Result: `https://example.com/a?q=1#frag` and `https://example.com/a` map to the same owned-reading row.

### Legacy-row compatibility

New v1 writes are deterministic, but upsert helpers preserve an existing row id when a stored row already matches the canonical identity. This avoids churn for pre-v1 or manually-seeded rows.

In practice:

- matching article rows preserve legacy ids when `readingHistoryRecordId`/`sourceUrl`/`studyProgressRecordId` canonically match
- matching local-file rows preserve legacy ids when `localUri` matches

## Mapping rules by source type

| Source type | Entry point(s) | Identity source | Join fields | Reopen contract | Progress contract |
|---|---|---|---|---|---|
| `article` | `src/entrypoints/content/page-translate.ts` | canonical page URL | `readingHistoryRecordId` + `studyProgressRecordId` | reopen by canonical article URL | item progress stays empty; sentence/review progress lives in `study-progress.ts` |
| `pdf` (remote) | `src/entrypoints/pdf-reader/PdfReaderApp.tsx` when opened via `?url=` | canonical remote PDF URL | `studyProgressRecordId` | reopen through PDF reader URL path + stored remote source URL | optional `fraction` |
| `pdf` (local) | `src/entrypoints/pdf-reader/PdfReaderApp.tsx` when opened from file | `astra-local://pdf/...` | none | show `reopenHint`; user chooses same file again | optional `fraction` |
| `epub` | `src/entrypoints/epub-reader/EpubReaderApp.tsx` | `astra-local://epub/...` | none | show `reopenHint`; user chooses same file again | optional `chapterId` |
| `subtitle-file` | `src/entrypoints/subtitle-reader/SubtitleReaderApp.tsx` | `astra-local://subtitle/...` | none | show `reopenHint`; user chooses same file again | no current progress payload |

## Field invariants

- `sourceUrl` and `localUri` should not both be meaningful for the same item in v1.
- `readingHistoryRecordId` is article-only.
- `studyProgressRecordId` is currently used for article and remote-PDF joins.
- `title` is display metadata, not identity.
- File-name-based local identities are a v1 boundary: they are stable within the current device model, but they are not a cross-device file-ingest guarantee.

## Queue/revisit contract for downstream work

Current downstream consumer: `src/entrypoints/vocabulary/VocabularyApp.tsx` Reading tab.

Queue/revisit work should rely on:

- `id` for row identity
- `sourceType` to choose reopen surface
- `sourceUrl` or `localUri` for canonical reopen metadata
- `reopenHint` when the row is local-file-only
- `studyProgressRecordId` / `readingHistoryRecordId` for article/progress joins
- queue helpers in `owned-reading.ts` for view classification and resume-target generation

Do not add ad hoc per-surface identifiers outside `owned-reading.ts` unless schema v2 explicitly lands.

## Learning-asset backlinks (Month 3)

Vocabulary source context can now carry an owned-reading backlink snapshot:

- `ownedReadingItemId`
- `ownedReadingSourceType`
- `ownedReadingTitle`
- `studyProgressRecordId` when the learning asset should continue the page-level loop

Implemented save paths in this task:

- popup deep-read article saves → owned article row + study-progress id
- subtitle-reader saves → owned subtitle-file row

This lets vocabulary list and review surfaces resolve the current owned-reading row and offer a concrete **Resume reading asset** action instead of only showing loose page/source text.

## Validation

Focused coverage lives in `src/utils/storage/owned-reading.test.ts` and proves:

- stable identity generation for article / remote PDF / local file families
- query/hash-insensitive article and remote-PDF dedupe
- legacy-id preservation on canonical-match upserts
- mapping coverage for article / pdf / epub / subtitle-file helpers
