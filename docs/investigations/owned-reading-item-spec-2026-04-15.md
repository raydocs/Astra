# Owned reading item — canonical schema (Month 3)

_Version: 2026-04-15 · Status: specification (implementation tracks extension + web)_

## 1. Purpose

Unify **article / PDF / EPUB / subtitle-file** under one `OwnedReadingItem` so queue, revisit, and progress do not fork per surface.

## 2. `OwnedReadingItem` (logical schema)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | `string` (uuid or `or_${sha256(url|path)}`) | yes | Stable across sessions |
| `sourceType` | `"article" \| "pdf" \| "epub" \| "subtitle-file"` | yes | Extends with `web-video` in Month 4 only after matrix sign-off |
| `title` | `string` | yes | User-visible |
| `sourceUrl` | `string \| null` | no | HTTP(S) for article; `file://` or blob URL for local files |
| `localUri` | `string \| null` | no | Extension-internal path for imported files |
| `openedAt` | `number` (epoch ms) | yes | Last open |
| `progress` | `{ fraction?: number; chapterId?: string; sentenceIndex?: number }` | no | Surface-specific; must round-trip in UI |
| `status` | `"in_progress" \| "saved" \| "archived"` | yes | Queue tabs |
| `readingHistoryRecordId` | `string \| null` | no | Link to `astra.reading_history` record when same URL |
| `studyProgressRecordId` | `string \| null` | no | Sanitized URL key used by `study-progress.ts` |
| `vocabularySourceIds` | `string[]` | no | Optional back-links to vocab entry ids |

## 3. Relations

- **Reading history** (`reading-history.ts`): same canonical URL as `sourceUrl` (sanitized) → optional `readingHistoryRecordId`.
- **Study progress** (`study-progress.ts`): `studyProgressRecordId` = `buildStudyProgressRecordId(sourceUrl)`.
- **Vocabulary** (`vocabulary-core`): `sourceContext.surface` + URL/title already exist; future: `ownedReadingItemId` optional field (Month 3 P1).

## 4. Sync-safe boundary (Month 3 P2 preview)

- Do not sync raw `file://` paths across devices; sync **hash + title + sourceType** only until cloud file ingest exists.

## 5. Implementation pointer

- **v0 queue**: document-only mapping to **popup recent history** + vocabulary/review URLs until dedicated `OwnedReadingItem` store lands in `browser.storage.local`.
