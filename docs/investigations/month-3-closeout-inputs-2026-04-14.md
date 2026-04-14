# Month 3 — Reader / owned-reading closeout inputs

_Tasks **`M3-F-04`** alignment (docs sync, honest claims)_

## Replayable / semi-replayable artifacts (minimum set)

Scenario IDs below match `id` fields registered in `bench-live/scenarios/index.ts` (`liveScenarios`). Invocation shape is always `pnpm bench:live -- --scenario <id>` (see root `package.json` `bench:live`).

1. **`bench-live/pdf-reader-basic`** — PDF reader path.
2. **`bench-live/epub-reader-basic`** — EPUB reader path.
3. **`bench-live/subtitle-file-basic`** — Subtitle-file harness + owned-reading continuity for imported cues.
4. **`bench-live/learning-loop-revisit-smoke`** — Month 2 **revisit v1** contract (vocabulary Reading tab → Open → fixture article origin). Chained after popup + SRS in **`pnpm bench:live:lane:learning-loop`**, which runs `bench-live/popup-deep-read-proof`, then **`bench-live/vocabulary-srs-smoke`**, then this scenario (`package.json`).

Related learning-loop entrypoints (same registry): **`bench-live/popup-deep-read-proof`**, **`bench-live/vocabulary-srs-smoke`**.

Re-run locally: `pnpm build`, `npx playwright install chromium`, then the desired `pnpm bench:live -- --scenario …` with `CI=true xvfb-run -a` on Linux headless hosts.

## Product continuity (2026-04-14 code)

- **Subtitle reader → vocabulary**: per-row Explain/Save after batch translate completes; `sourceContext.surface === "subtitle_reader"` (`SubtitleReaderApp.tsx`).
- **Owned queue**: `VocabularyApp` Reading tab + `owned-reading` storage (see `owned-reading-schema-v1-2026-04-14.md`).

## Claim boundary

Owned reading is **real as a queue + schema**, not full multi-reader parity. Do not imply universal resume for every host without naming supported reopen mechanics (`reopenHint`, reader entrypoints).
