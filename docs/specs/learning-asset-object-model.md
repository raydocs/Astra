# Learning Asset Object Model

Source plan: [`../plans/astra-macro-product-upgrade-plan-2026-05-27.md`](../plans/astra-macro-product-upgrade-plan-2026-05-27.md), section 23.

This spec is the section-23 contract for turning Astra's real-content learning loop into portable, deletable, source-backed assets. Runtime adapter evidence lives in [`src/utils/storage/learning-assets.ts`](../../src/utils/storage/learning-assets.ts) and tests in [`src/utils/storage/learning-assets.test.ts`](../../src/utils/storage/learning-assets.test.ts).

## Strategic decision

All first-version learning assets must be:

- **Traceable** — link back to a source when the source is known.
- **Reviewable** — eligible saved language units can become Review cards or remain snippets when card quality is weak.
- **Portable** — user-facing export fields must be understandable.
- **Deletable** — saved items, sources, and derived Review cards need explicit orphan/cascade behavior.
- **Privacy-aware** — support, telemetry, digest, and ops summaries must not require raw page/transcript/file text by default.
- **Sync-ready** — cloud/mobile sync is allowed only after delete/export/conflict behavior is defined.

## First-version objects

The first version intentionally keeps the object set small:

1. `SourceContent`
2. `SavedSnippet`
3. `VocabularyItem`
4. `ReviewCard`
5. `ReviewSession`

Video, file, sample lesson, selection, and input-writing flows map into `SourceContent.type` instead of creating separate top-level tables in v1.

## Object contracts

### SourceContent

| Field | Required | Notes |
|---|---:|---|
| `id` | Yes | Stable source id; current adapters use owned-reading ids or sanitized source URL ids. |
| `type` | Yes | `page`, `video`, `file`, `selection`, `input`, `sample`. |
| `title` | Yes | Source title shown in Library/Review; never use a full URL path as the default title. |
| `canonicalUrl` | No | Sanitized canonical URL when available. |
| `hostname` | No | Hostname-only context for privacy-safe grouping. |
| `language` | No | Source language when known. |
| `targetLanguage` | Yes | Learner target language for the captured source. |
| `createdAt` | Yes | Non-negative timestamp. |
| `lastOpenedAt` / `lastStudiedAt` | No | Used for continue-learning and digest summaries. |
| `progress` | Yes | `new`, `in_progress`, `saved`, `reviewed`, or `archived`; may include percent and last position. |
| `summary` | Yes | Optional short summary/topics/difficulty; do not store full source bodies here. |
| `userControl` | Yes | `syncEnabled`, `excludedFromDigest`, `privacyModeAtCapture`. |

### SavedSnippet

| Field | Required | Notes |
|---|---:|---|
| `id` | Yes | Stable snippet id. |
| `sourceContentId` | Nullable | Use `null` when source is unknown; do not invent false source links. |
| `text` | Yes | User-saved text or sentence; exportable because user explicitly saved it. |
| `translation` / `explanation` | No | Learning context created for the saved snippet. |
| `contextBefore` / `contextAfter` | No | Minimal context only; avoid full page capture. |
| `anchor` | Yes | Selector/text quote/timestamp/page number when available. |
| `createdAt` | Yes | Non-negative timestamp. |
| `createdBy` | Yes | `user` or `system_suggested`; automatic suggestions are not equal to user saves. |
| `tags` / `importance` | Yes | Lightweight organization without requiring folders. |
| `reviewCardIds` | Yes | Cards derived from this saved snippet. |

### VocabularyItem

| Field | Required | Notes |
|---|---:|---|
| `id` | Yes | Stable vocabulary id, often legacy vocabulary entry id. |
| `surfaceText` | Yes | User-visible word/phrase. |
| `normalizedText` / `lemma` | No | Optional matching fields. |
| `language` / `targetLanguage` | Yes | Source and learner target language. |
| `translation` / `explanation` / `partOfSpeech` | No | Learning context. |
| `examples` | Yes | Example sentences link to snippets when possible. |
| `sourceSnippetIds` | Yes | Explicit source snippet links. |
| `masteryState` | Yes | `new`, `learning`, `familiar`, `mastered`, `suspended`. |
| `createdAt` / `updatedAt` | Yes | Required for sync/export ordering. |

### ReviewCard

| Field | Required | Notes |
|---|---:|---|
| `id` | Yes | Stable card id. |
| `cardType` | Yes | `word`, `sentence`, `cloze`, `video_moment`, `correction`. |
| `front` / `back` | Yes | Keep concise enough for review. |
| `hint` | No | Optional learner hint. |
| `linkedSnippetId` / `linkedVocabularyId` / `linkedSourceContentId` | Nullable | Preserve source linkage; allow null for source-less captures. |
| `dueAt` / `intervalDays` / `ease` | Yes | Internal scheduling fields; not exposed as complex SRS controls. |
| `state` | Yes | `new`, `learning`, `familiar`, `mastered`, `suspended`. |
| `lastReviewedAt` | No | Nullable for new cards. |
| `reviewCount` / `lapseCount` | Yes | Review history counters. |
| `createdAt` | Yes | Non-negative timestamp. |
| `generatedBy` | Yes | `user_save`, `ai_suggestion`, or `import`. |

### ReviewSession

| Field | Required | Notes |
|---|---:|---|
| `id` | Yes | Stable session id. |
| `startedAt` | Yes | Non-negative timestamp. |
| `completedAt` | No | Nullable until finished. |
| `cardIds` | Yes | Cards attempted in the session. |
| `results` | Yes | Per-card `again`, `good`, or `easy` feedback. |
| `sourceBreakdown` | Yes | Count-only page/video/file/input breakdown for privacy-safe metrics. |

## Relationships

```text
SourceContent
   ├── SavedSnippet
   │      ├── VocabularyItem
   │      └── ReviewCard
   └── ReviewSession references ReviewCard

Digest references counts/titles/types from:
   - SourceContent
   - SavedSnippet
   - ReviewSession
   - VocabularyItem
```

## Current schema mapping

| Current source | Object mapping | Evidence |
|---|---|---|
| `OwnedReadingItem` | `SourceContent` | `sourceContentFromOwnedReadingItem()` maps article/PDF/EPUB/subtitle-file into source types and user controls. |
| `VocabularyEntry.sourceContext` | `SourceContent` | `sourceContentFromVocabularyEntry()` creates page/video source projections from sanitized URL/hostname/source metadata. |
| `VocabularyEntry` sentence/context | `SavedSnippet` | `savedSnippetFromVocabularyEntry()` uses sentence text/context, source id, translation, anchor, and `createdBy: user`. |
| `VocabularyEntry` word/phrase | `VocabularyItem` | `vocabularyItemFromVocabularyEntry()` preserves surface text, normalized text, target language, examples, and mastery. |
| `VocabularyEntry` SRS fields | `ReviewCard` | `reviewCardFromVocabularyEntry()` derives card type, due date, interval, state, and source links. |
| Review events | `ReviewSession` | Current adapter defines the shape; full persisted session history remains a later sync/runtime expansion. |

## Delete and orphan policy

| User action | Required behavior |
|---|---|
| Delete `SavedSnippet` only | Remove or detach derived `ReviewCard` links; do not leave a visible card that appears source-backed when the snippet is gone. |
| Delete source only | Preserve user-saved snippets/cards by default, but set source linkage to `null` or mark the source as unavailable. |
| Delete source + linked cards | Cascade only after explicit user confirmation. |
| Delete vocabulary item | Remove or suspend associated word cards; preserve source/snippet history unless explicitly deleted. |
| Delete account data | Route through account/cloud deletion once cloud sync is enabled; local-only data must still support export/delete controls. |

## Export policy

- JSON export is the baseline; CSV/Markdown can be added for user-friendly subsets.
- Export may include user-saved snippets because they are intentional user assets.
- Export should not include complete third-party page bodies, full transcripts, or full file text by default.
- Export metadata must explain source title/type, timestamps, card state, and user-control flags in ordinary language.

## Acceptance checklist

| Plan requirement | Current status |
|---|---|
| P0 learning assets have `id` and `createdAt` | Covered by Zod schemas for source, snippet, vocabulary, card, and session timestamps. |
| P0 saved items can return to source | Adapter preserves `sourceContentId`, source title, sanitized URL, hostname, and anchors when present. |
| Delete SavedSnippet derived-card handling is explicit | Policy defined here; current Library source-delete UI preserves cards by default and offers explicit cascade choices. |
| ReviewCard can display source title | Covered when `linkedSourceContentId` resolves to a `SourceContent.title`; source-less cards must show neutral fallback copy. |
| Export fields are explainable | Field table and export policy defined here; learning-data export must keep this doc as the field contract. |
| Automatic vs user-saved assets are distinct | `SavedSnippet.createdBy` and `ReviewCard.generatedBy` encode provenance. |

## Release boundary

This spec proves the v1 object contract and adapter mapping. It does **not** by itself prove cloud-sync conflict resolution, account-level deletion orchestration, bulk asset management, or production export UX; those remain release-gated by the data-control, operations, and macro-operational-evidence contracts.
