# Owned reading item schema v1 (implementation pointer)

_Task pack: **`M3-C-01`** — schema v1_

## Source of truth

The v1 Zod schema and storage live in:

- `src/utils/storage/owned-reading.ts`

## Fields (summary)

| Field | Role |
|-------|------|
| `id` | Stable row id (`or_…`) |
| `sourceType` | `article` \| `pdf` \| `epub` \| `subtitle-file` |
| `title` | User-visible label |
| `sourceUrl` | Canonical URL key for remote article/PDF when applicable; may duplicate reading-history id semantics |
| `localUri` | Stable synthetic key for local files (`astra-local://…`) |
| `reopenHint` | Human reopen instructions when URL is null |
| `openedAt` | Recency for queue ordering |
| `progress` | Optional `fraction`, `chapterId`, `sentenceIndex` |
| `status` | `in_progress` \| `saved` \| `archived` |
| `readingHistoryRecordId` / `studyProgressRecordId` | Join keys to history / study progress when present |

## Dedupe

Upsert helpers match on `readingHistoryRecordId`, `studyProgressRecordId`, `sourceUrl`, or `localUri` depending on source type (see `findExistingByStudyOrSource`).

## Downstream

Queue UI: `src/entrypoints/vocabulary/VocabularyApp.tsx` (Reading tab). Do not invent parallel identity rules outside `owned-reading.ts`.

## Bench-live scenario IDs (repo registry)

Canonical list: `bench-live/scenarios/index.ts` (`liveScenarios`). Run any scenario with:

`pnpm bench:live -- --scenario <id>`

Reader- and subtitle-file–adjacent IDs currently exported in that registry:

- `bench-live/pdf-reader-basic`
- `bench-live/epub-reader-basic`
- `bench-live/subtitle-file-basic` (`sourceType: "subtitle-file"` queue continuity)
- `bench-live/learning-loop-revisit-smoke` (vocabulary Reading queue → reopen; includes `pnpm bench:live:lane:learning-loop` per `package.json`)

Video adapter fixture smokes (separate from owned-reading file import): `bench-live/youtube-subtitle-basic`, `bench-live/bilibili-subtitle-basic`, `bench-live/subtitle-basic`.
