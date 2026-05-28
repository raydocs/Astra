# Support matrix — video / subtitle addendum (Month 4)

_Last updated: 2026-05-27 (`P2.7` YouTube proof lane + claim-boundary sync)_

_Canonical base: `docs/investigations/support-matrix-2026-q2.md`_

This addendum is the release-facing claim boundary for in-page video/subtitle surfaces. It intentionally separates:

- fixture-backed browser proof,
- unit/shared-runtime proof, and
- unsupported breadth that should stay out of claims.

## In-page video adapters

| Adapter / surface | External claim today | Proof depth today | Exact evidence | Boundary |
|---|---|---|---|---|
| **YouTube** | **Supported, best-effort within desktop extension support** | **L3** fixture-backed live smoke + P2.7 proof lane + browser-backed holdout lane + unit coverage | `bench-live/youtube-subtitle-basic`, `bench:live:lane:youtube-proof` (`youtube-subtitle-player-button`, `youtube-subtitle-in-player-settings`, `youtube-subtitle-basic-bilingual`, `youtube-subtitle-seek-recovery`, `youtube-subtitle-track-switch`, `youtube-transcript-panel`, `youtube-transcript-search-jump`, `youtube-save-sentence-review-loop`, `youtube-video-note-create`), `bench:live:lane:youtube-holdout` (`youtube-subtitle-race`, `youtube-no-captions`, `youtube-asr-only`, `youtube-long-video`, `youtube-fullscreen`, `youtube-spa-navigation`), `video-platforms.test.ts`, `month-4-video-smoke-replay-2026-04-16.md` | Strong external claim may cover YouTube bilingual subtitles, in-player subtitle settings (mode/size/background/position/retry/native-caption restore), the YouTube transcript learning workspace, ASR/no-captions boundaries, fullscreen-style controls, and SPA reinit behavior in fixture-backed proof; do not describe this as production-watch-page proof for every YouTube state. Captions, experiments, and track availability still vary. |
| **Bilibili** | **Best-effort / beta secondary adapter** | **L3** fixture-backed fallback/upgrade/drift smoke + unit coverage | `bench-live/bilibili-subtitle-basic`, `video-platforms.test.ts`, `month-4-video-smoke-replay-2026-04-16.md` | Do not claim parity with YouTube or stable production-site behavior across region/login/player variants. |
| **Netflix** | **Code-only** | **L2** unit-only | `video-platforms.test.ts`, adapter inventory | Do not claim support externally; no live proof, DRM/policy risk remains explicit. |
| **Prime Video** | **Code-only** | **L1** config-only | adapter inventory | Do not claim support externally. |
| **Disney+** | **Code-only** | **L1** config-only | adapter inventory | Do not claim support externally. |
| **Udemy** | **Code-only** | **L1** config-only | adapter inventory | Do not claim support externally. |
| **Coursera** | **Code-only** | **L1** config-only | adapter inventory | Do not claim support externally. |
| **Generic HTML5 text-track contract** | **Internal proof only** | **L3** generic browser-backed contract | `bench-live/subtitle-basic` | This proves shared subtitle-track behavior, not any specific commercial video site. |

## Subtitle surfaces

| Path | External claim today | Evidence | Boundary |
|------|----------------------|----------|----------|
| In-page subtitles on YouTube | Same as YouTube row above | same as above | Best-effort, not universal site-state proof |
| YouTube transcript learning workspace | **Supported, best-effort within desktop extension support** | `bench-live/youtube-transcript-panel`, `bench-live/youtube-transcript-search-jump`, `bench-live/youtube-save-sentence-review-loop`, `bench-live/youtube-video-note-create`, `video-platforms.test.ts` | YouTube-specific learning workflow proof; do not generalize to other video platforms. |
| In-page subtitles on Bilibili | Same as Bilibili row above | same as above | Secondary/best-effort only |
| Subtitle file reader / learning chain | **Controlled supported file-reader surface** | `bench-live/subtitle-file-basic` (`live-20260414T121705-ndf283`), `bench-live/subtitle-learning-chain-smoke` (`live-20260414T121845-xe3mlf`), `subtitle-reader-learning-chain-2026-04-14.md`, Month 4 evidence registry | Separate product path from in-page video adapters; do not merge these claims |

## Safe external statement

> Astra has a supported best-effort YouTube bilingual subtitle path, in-player subtitle settings proof, YouTube transcript learning workspace, and fixture-backed holdout coverage for no-captions, ASR-only, fullscreen-style controls, long-video windowing, and SPA reinit; a narrower best-effort/beta Bilibili adapter; and additional in-repo video adapters that remain code-only until they gain stronger proof. SRT/VTT subtitle-file import is a separate controlled supported file-reader surface, not evidence of broad in-page video support.

## Statements out of bounds

- “Astra supports major video platforms broadly.”
- “Astra's YouTube transcript learning workspace works on Netflix / Prime Video / Disney+ / Udemy / Coursera.”
- “Netflix / Prime Video / Disney+ / Udemy / Coursera are supported.”
- “Fixture smokes equal production-site validation.”
- “Subtitle-file proof means in-page video adapter parity.”

## Release checklist hook

When an RC touches video/subtitle claims, review together:

- `docs/investigations/video-subtitle-adapter-inventory-2026-04-15.md`
- `docs/investigations/month-4-video-smoke-replay-2026-04-16.md`
- `docs/investigations/month-4-evidence-registry-2026-04-14.md`
- `docs/investigations/month-4-closeout-inputs-2026-04-14.md`
- this addendum
