# Month 4 — Video / subtitle evidence sync

_Task **`M4-F-04`** — docs match proof depth_

## Authoritative inventories (already in repo)

- Adapter table: [`video-subtitle-adapter-inventory-2026-04-15.md`](./video-subtitle-adapter-inventory-2026-04-15.md)
- Claim addendum: [`support-matrix-video-addendum-2026-04-15.md`](./support-matrix-video-addendum-2026-04-15.md)

## Hardened scope (plan lock)

- **YouTube** (`youtube.ts`): Month 4 **hardened** in-page path; bench-live fixture smoke ID **`bench-live/youtube-subtitle-basic`** (registered in `bench-live/scenarios/index.ts`). Run: `pnpm bench:live -- --scenario bench-live/youtube-subtitle-basic`.
- **Bilibili** (`bilibili.ts`): Month 4 **secondary hardened** adapter — fixture smoke **`bench-live/bilibili-subtitle-basic`** proves selector wiring; production site remains higher drift (failure classes in inventory). Run: `pnpm bench:live -- --scenario bench-live/bilibili-subtitle-basic`.
- **Other adapters** in `src/entrypoints/content/video-platforms/`: inventory marks **code-only / experimental** unless promoted.

## Subtitle-file vs in-page video

Treat **subtitle reader / file import** (`OwnedReadingItem` with `sourceType: "subtitle-file"`) as a **separate** controlled product path from **in-page** caption adapters. File path live smoke: **`bench-live/subtitle-file-basic`**. HTML5 track fixture (not site-specific): **`bench-live/subtitle-basic`**.

Learning-chain continuity for the file path is documented in `subtitle-reader-learning-chain-2026-04-14.md` and Month 3 inputs; vocabulary surfaces use `sourceContext.surface === "subtitle_reader"`.
