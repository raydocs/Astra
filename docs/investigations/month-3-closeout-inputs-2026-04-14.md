# Month 3 — Reader / owned-reading closeout inputs

_Tasks **`M3-F-04`** alignment (docs sync, honest claims)_

## Replayable / semi-replayable artifacts (minimum set)

1. **`bench-live/pdf-reader-basic`** — PDF reader path (optional lane; see `package.json` / scenario registry).
2. **`bench-live/epub-reader-basic`** — EPUB reader path (optional).
3. **`bench-live/subtitle-file-basic`** — Subtitle/file reader import path (optional).
4. **`bench-live/learning-loop-revisit-smoke`** — Month 2 **revisit v1** contract (vocabulary Reading queue → Open → HTTP article); also runs as part of `pnpm bench:live:lane:learning-loop`.

Re-run locally: `pnpm build`, `npx playwright install chromium`, then the desired `pnpm bench:live -- --scenario …` with `CI=true xvfb-run -a` on Linux headless hosts.

## Product continuity (2026-04-14 code)

- **Subtitle reader → vocabulary**: per-row Explain/Save after batch translate completes; `sourceContext.surface === "subtitle_reader"` (`SubtitleReaderApp.tsx`).
- **Owned queue**: `VocabularyApp` Reading tab + `owned-reading` storage (see `owned-reading-schema-v1-2026-04-14.md`).

## Claim boundary

Owned reading is **real as a queue + schema**, not full multi-reader parity. Do not imply universal resume for every host without naming supported reopen mechanics (`reopenHint`, reader entrypoints).
