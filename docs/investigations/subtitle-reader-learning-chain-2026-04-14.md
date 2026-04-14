# Subtitle reader → learning loop → revisit (file path)

_Last updated: 2026-04-14 (`M4-CD-03` subtitle learning-chain sync)_

Task `M4-CD-03` defines the first supported **subtitle-file** learning path. This is a controlled file-reader path, not evidence of broad in-page video adapter parity.

## Supported chain (v1)

1. **Import** — User selects or drops `SRT` / `VTT` / `ASS` / `Markdown` / `TXT` / `HTML` in `subtitle-reader` (`src/entrypoints/subtitle-reader/SubtitleReaderApp.tsx`).
2. **Owned reading identity** — `upsertOwnedSubtitleFileFromImport` creates or updates an `OwnedReadingItem` with:
   - `sourceType: "subtitle-file"`
   - stable `localUri` (`astra-local://subtitle/<file>`)
   - status `in_progress` during import/explain and `saved` after vocab save
   - row continuity in `progress.sentenceIndex`
3. **Explain / save** — after translation, each row can:
   - **Explain** via `translateTexts(... task: "explain")`
   - **Save** via `saveVocabularyEntry(...)` with `sourceContext.surface: "subtitle_reader"`
4. **Vocabulary / review continuity** — saved items render as **Subtitle reader** entries, with:
   - file identity (`File: astra-local://subtitle/...`)
   - summary (`SRT · N items`, etc.)
   - linked reading asset (`Subtitle file`)
   - retained row progress (`Last row: N` when present)
5. **Revisit / reopen** — `Resume reading asset` opens `subtitle-reader.html?reopenHint=...`, and the reader shows the reopen banner telling the user which file to pick and which row they last reached.
6. **Direct handoff from subtitle-reader** — after at least one row is saved, subtitle-reader exposes bounded learning-loop actions:
   - `Open Vocabulary`
   - `Start Review`
   - `Open Reading Queue`

## Source-context contract

Subtitle-reader saves now use the same structured vocab source-context model as popup/article saves, with subtitle-specific identity:

- `surface: "subtitle_reader"`
- `pageTitle`: source file name
- `pageUrl`: stable subtitle local URI
- `hostname: "subtitle-reader"`
- `contentSummary`: format + item count
- `sentenceText`
- `sentenceIndex`
- owned-reading backlink fields (`ownedReadingItemId`, `ownedReadingSourceType`, `ownedReadingTitle`)

This keeps subtitle-reader saves recoverable in both `VocabularyApp` and `ReviewMode` without guessing from generic extension URLs.

## Supported boundaries

- **Per-row save remains intentional**: import/translate alone does not create SRS cards.
- **Reopen is a reader handoff** for local files: the app can reopen subtitle-reader with continuity metadata, but the user still chooses the same local file again.
- **Subtitle-file is separate from in-page video adapters** (YouTube / Bilibili / code-only platforms). File-reader proof must not be reused as broad watch-page support evidence.

## Fresh proof (2026-04-14)

### Tests

- `pnpm exec vitest run src/entrypoints/subtitle-reader/SubtitleReaderApp.test.tsx src/entrypoints/vocabulary/VocabularyApp.test.tsx src/entrypoints/vocabulary/ReviewMode.test.tsx src/utils/storage/owned-reading.test.ts src/utils/storage/vocabulary.test.ts`

### Live artifacts

- `CI=true pnpm bench:live -- --scenario bench-live/subtitle-file-basic`
  - pass: `live-20260414T121705-ndf283`
  - artifacts: `bench-live-results/live-20260414T121705-ndf283/`
- `CI=true pnpm bench:live -- --scenario bench-live/subtitle-learning-chain-smoke`
  - final pass: `live-20260414T121845-xe3mlf`
  - artifacts: `bench-live-results/live-20260414T121845-xe3mlf/`
  - key captures:
    - `subtitle-learning-chain-vocabulary.png`
    - `subtitle-learning-chain-review.png`
    - `subtitle-learning-chain-reader.png`
    - `subtitle-learning-chain-review.snapshot.html`

### Narrow failure archaeology

Two earlier runs failed in the new smoke harness before the product path completed:

- `live-20260414T121729-vt4e8r` — ambiguous `getByText("subtitle-word")` locator
- `live-20260414T121817-082z8x` — ambiguous `getByRole("button", { name: "Resume reading asset" })` locator

Both were harness-only selector issues in the new smoke, fixed by explicit locators. They do not indicate a subtitle-reader product regression.
