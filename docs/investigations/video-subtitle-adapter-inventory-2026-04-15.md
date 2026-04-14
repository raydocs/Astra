# Video / subtitle adapter inventory (Month 4)

_Generated: 2026-04-15 · Source: `src/entrypoints/content/video-platforms/`_

## Legend (proof level)

| Level | Meaning |
|-------|---------|
| **L3** | CI / bench-live or deterministic harness touches adapter path |
| **L2** | Unit tests / code structure present, limited runtime proof |
| **L1** | Code-only / best-effort DOM selectors |

## Adapter table

| Adapter file | Primary site | Support tag (Month 4 plan) | Proof level (2026-04-15) | Main failure modes |
|--------------|--------------|----------------------------|--------------------------|---------------------|
| `youtube.ts` | YouTube | **supported** (primary video) | **L3** (bench + live scenarios exist) | No captions; delayed captions; language mismatch |
| `bilibili.ts` | Bilibili | **best-effort** (secondary for Month 4) | **L2→L3** (fixture smoke: `bench-live/bilibili-subtitle-basic`; real site still L2) | Region/geo; dynamic DOM; caption format drift |
| `netflix.ts` | Netflix | **code-only** | **L1** | DRM; shadow DOM; ToS-sensitive |
| `primevideo.ts` | Prime Video | **code-only** | **L1** | Same class as Netflix |
| `disneyplus.ts` | Disney+ | **code-only** | **L1** | Same |
| `coursera.ts` | Coursera | **code-only** | **L1** | Embedded players vary |
| `udemy.ts` | Udemy | **code-only** | **L1** | Course player churn |

## Month 4 scope lock

- **Harden**: YouTube + **Bilibili** as secondary adapter (smoke + failure notes).
- **Do not** expand new platforms until both pass Month 4 acceptance.

## Subtitle file path

- **Subtitle reader** extension entry + import flow: treat as **separate surface** from in-page video adapters; revisit via `OwnedReadingItem.sourceType === "subtitle-file"` (Month 3 schema).

## YouTube — failure classes (production vs fixture)

Bench-live `bench-live/youtube-subtitle-basic` uses **`inline:youtube-subtitle`** (fixture-equivalent HTML in a real browser), not navigation to **www.youtube.com**. Treat the following as **production-site** classes when debugging real watch pages (distinct from the fixture skeleton):

| Class | Symptom | Likely cause |
|-------|---------|--------------|
| `YT_CAPTION_TRACK_MISSING` | No active caption cues / `caption` mode empty | Video has no captions; auto-captions disabled; premium/offline UI |
| `YT_CAPTION_DOM_DELAY` | Player ready but cue text lags vs `currentTime` | Slow network; live DVR; heavy JS on page |
| `YT_LANGUAGE_MISMATCH` | Text present but wrong language vs learner target | Multi-track; auto-translate layer vs original |
| `YT_PLAYER_CHURN` | Selectors or shadow paths change between loads | YouTube A/B experiments; kids/embed vs watch UI |

**Mitigation**: keep the bench-live skeleton green for regression on adapter logic (dedupe, pause/seek); treat production issues as updates to `youtube.ts` plus a one-line note in this table when a new class is confirmed.

## Bilibili — failure classes (production vs fixture)

Fixture smoke (`bench-live/bilibili-subtitle-basic`) only proves **selector wiring** against a static HTML panel shaped like `bilibili.ts` (`.bpx-player-subtitle-panel`, `.bpx-player-subtitle-panel-text`). On **www.bilibili.com**, classify failures as:

| Class | Symptom | Likely cause |
|-------|-----------|--------------|
| `BILI_CAPTION_DOM_MISSING` | No `.bpx-player-subtitle-panel` within timeout | Player skin update; theater/fullscreen DOM; non-video page |
| `BILI_CAPTION_TEXT_EMPTY` | Panel exists but `extractCaptionText` returns empty | Nested text node change; shadow-like encapsulation |
| `BILI_REGION_OR_LOGIN` | Video plays but captions never appear | Geo restriction; login wall; auto-generated captions off |
| `BILI_LANGUAGE_MISMATCH` | Wrong language track | User track preference vs `preferTextTracks` heuristics |

**Mitigation**: keep fixture green in CI; treat production regressions as selector updates in `bilibili.ts` with a short note in this table’s “Main failure modes” column.
