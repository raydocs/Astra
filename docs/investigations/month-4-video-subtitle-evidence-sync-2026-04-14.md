# Month 4 — Video / subtitle evidence sync

_Last updated: 2026-04-14 (`M4-F-04` evidence / claim sync)_

_Task line:_ keep docs aligned to actual proof depth before Month 4 hardening work narrows scope further.

## Authoritative inventories / claim docs

- Adapter table + failure modes: [`video-subtitle-adapter-inventory-2026-04-15.md`](./video-subtitle-adapter-inventory-2026-04-15.md)
- Claim addendum: [`support-matrix-video-addendum-2026-04-15.md`](./support-matrix-video-addendum-2026-04-15.md)
- Fresh replay pointers: [`month-4-video-smoke-replay-2026-04-16.md`](./month-4-video-smoke-replay-2026-04-16.md)
- Evidence registry: [`month-4-evidence-registry-2026-04-14.md`](./month-4-evidence-registry-2026-04-14.md)
- Closeout inputs: [`month-4-closeout-inputs-2026-04-14.md`](./month-4-closeout-inputs-2026-04-14.md)

## Hardened scope (plan lock)

- **YouTube** (`youtube.ts`): Month 4 **primary in-page adapter**. Proof today is fixture-backed live smoke `bench-live/youtube-subtitle-basic` plus unit coverage, including stale-track clearing after caption-track loss.
- **Bilibili** (`bilibili.ts`): Month 4 **secondary adapter**. Proof today is fixture-backed live smoke `bench-live/bilibili-subtitle-basic` plus unit coverage, covering DOM fallback, structured upgrade, alternate selector drift, and empty subtitle-state cleanup; production-site behavior remains best-effort.
- **Netflix / Prime Video / Disney+ / Udemy / Coursera**: remain **code-only** until stronger proof exists. They should not be used as support-breadth evidence.

## Exact current proof state

- `bench-live/youtube-subtitle-basic` → green replay `live-20260414T115407-2i2tzo` recorded in `month-4-video-smoke-replay-2026-04-16.md`
- `bench-live/bilibili-subtitle-basic` → green replay `live-20260414T115722-y40ya0` recorded in `month-4-video-smoke-replay-2026-04-16.md`
- `bench-live/subtitle-basic` → proves the generic HTML5 subtitle-track contract, not any specific commercial site

## Subtitle-file vs in-page video

Treat **subtitle reader / file import** (`OwnedReadingItem` with `sourceType: "subtitle-file"`) as a **separate controlled reader path** from **in-page** caption adapters.

- File path ingest / preview / export smoke: **`bench-live/subtitle-file-basic`**
  - fresh pass: `live-20260414T121705-ndf283`
- File path learning-loop / revisit smoke: **`bench-live/subtitle-learning-chain-smoke`**
  - fresh pass: `live-20260414T121845-xe3mlf`
- In-page generic HTML5 track contract: **`bench-live/subtitle-basic`**
- Site-specific Month 4 adapter smokes: **`bench-live/youtube-subtitle-basic`**, **`bench-live/bilibili-subtitle-basic`**

`subtitle-reader-learning-chain-2026-04-14.md` is now the authoritative contract for subtitle-file explain/save/review/revisit continuity. Keep this evidence separate from YouTube/Bilibili adapter claims.

## Honest release note

Do not collapse all of the above into a broad “supports video subtitles” statement. Current honest wording is:

- YouTube: supported (best-effort within supported tier)
- Bilibili: best-effort secondary adapter
- Other adapters: code-only
- Subtitle-file reader / learning chain: separate experimental controlled surface
