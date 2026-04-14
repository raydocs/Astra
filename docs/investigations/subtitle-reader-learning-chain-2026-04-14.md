# Subtitle reader → learning loop → revisit (file path)

_Task **`M4-CD-03`** — documentation of the supported chain_

## Supported chain (v1)

1. **Import** — User selects or drops SRT/VTT/ASS/Markdown/TXT/HTML in `subtitle-reader` (`SubtitleReaderApp.tsx`).
2. **Owned reading** — `upsertOwnedSubtitleFileFromImport` records `OwnedReadingItem` with `sourceType: "subtitle-file"` and a `localUri` key (`owned-reading.ts`).
3. **Batch translate** — Existing `runtime/translate-batch` path translates cues/paragraphs.
4. **Explain / save (post-translate)** — After `Translate All` completes, each row exposes **Explain** and **Save**:
   - Explain uses `translateTexts` with `task: "explain"`.
   - Save uses `saveVocabularyEntry` with `sourceContext.surface: "subtitle_reader"` and `pageTitle` = file name.
5. **Vocabulary / review** — List + review surfaces label the entry as **File translator** (`VocabularyApp.tsx`, `ReviewMode.tsx`).
6. **Revisit** — Reading queue in `VocabularyApp` opens `subtitle-reader.html` with `reopenHint` query param; owned item `reopenHint` documents user steps.

## Boundaries

- No automatic SRS from subtitle import alone; user must Save per row (intentional minimal v1).
- Remote video adapters (YouTube/Bilibili) remain separate; see video adapter inventory.
