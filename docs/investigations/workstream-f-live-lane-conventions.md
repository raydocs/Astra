# Workstream F Live Lane Conventions (Month 1 Baseline)

_Last updated: 2026-04-15 (learning-loop treated as a first-class live-browser gate)_

This document defines the canonical lane naming used by release-proof checks.

## Lane names

| Lane | Purpose | Command | CI required |
|---|---|---|---|
| `source-core` | Browser-backed source-contract proof for core extraction/runtime behaviors | `pnpm bench:live:lane:source-core` | Yes (`CI / live-browser`) |
| `extension-core` | Extension-loaded smoke proof for bootstrap/owned surfaces | `pnpm bench:live:lane:extension-core` | Yes (`CI / live-browser`) |
| `release-proof` | Aggregate required release-proof gate | `pnpm bench:live:lane:release-proof` | Indirectly (runs source-core + extension-core + learning-loop + document-proof + youtube-proof + youtube-holdout) |
| `hover-selection` | Optional browser-backed UX proof for hover + selection explain | `pnpm bench:live:lane:hover-selection` | No (manual/dispatch workflow) |
| `popup-proof` | Optional standalone browser-backed popup deep-read proof | `pnpm bench:live:lane:popup-proof` | No |
| `learning-loop` | Browser-backed popup → Deep Read → vocabulary/review → **reading revisit** proof | `pnpm bench:live:lane:learning-loop` | Yes (`CI / live-browser`) |
| `document-proof` | Browser-backed controlled document/file proof for intake and PDF/EPUB/SRT/VTT reader flows | `pnpm bench:live:lane:document-proof` | Yes (`CI / live-browser`) |
| `youtube-proof` | Browser-backed YouTube subtitle/transcript/save/note proof | `pnpm bench:live:lane:youtube-proof` | Yes (`CI / live-browser`) |
| `youtube-holdout` | Browser-backed YouTube subtitle robustness holdouts | `pnpm bench:live:lane:youtube-holdout` | Yes (`CI / live-browser`) |

Compatibility aliases remain available:

- `bench:live:source` -> `bench:live:lane:source-core`
- `bench:live:extension` -> `bench:live:lane:extension-core`
- `bench:live:smoke` -> `bench:live:lane:release-proof`

## Required scenario inventory (current release gate)

### source-core

1. `bench-live/page-translation-article-basic-source-bilingual`
2. `bench-live/page-translation-full-page-title-shadow-source`
3. `bench-live/article-extraction-proof`
4. `bench-live/dynamic-content-append`
5. `bench-live/frame-coordination-basic`
6. `bench-live/frame-coordination-cross-origin-fallback`

### extension-core

1. `bench-live/site-automation-autostart`
2. `bench-live/onboarding-smoke`
3. `bench-live/vocabulary-srs-smoke`

### learning-loop

1. `bench-live/popup-deep-read-proof` (popup proof anchor)
2. `bench-live/vocabulary-srs-smoke` (downstream vocabulary continuation)
3. `bench-live/selection-save-review-loop` (selection → save → review handoff)
4. `bench-live/learning-loop-revisit-smoke` (vocabulary Reading tab → Open → http article fixture)

### document-proof

1. `bench-live/document-intake-basic`
2. `bench-live/document-intake-local-file-handoff`
3. `bench-live/pdf-reader-basic`
4. `bench-live/epub-reader-basic`
5. `bench-live/subtitle-file-basic`

### youtube-proof

1. `bench-live/youtube-subtitle-player-button`
2. `bench-live/youtube-subtitle-in-player-settings`
3. `bench-live/youtube-subtitle-basic-bilingual`
4. `bench-live/youtube-subtitle-seek-recovery`
5. `bench-live/youtube-subtitle-track-switch`
6. `bench-live/youtube-transcript-panel`
7. `bench-live/youtube-transcript-search-jump`
8. `bench-live/youtube-save-sentence-review-loop`
9. `bench-live/youtube-video-note-create`

### youtube-holdout

1. `bench-live/holdout/youtube-subtitle-race`
2. `bench-live/holdout/youtube-no-captions`
3. `bench-live/holdout/youtube-asr-only`
4. `bench-live/holdout/youtube-long-video`
5. `bench-live/holdout/youtube-fullscreen`
6. `bench-live/holdout/youtube-spa-navigation`

## Optional but credible scenario inventory (not release-blocking yet)

### hover-selection

1. `bench-live/hover-translation-basic` (browser-backed relay-stub flow)
2. `bench-live/selection-explain-basic` (dedicated standard browser-backed live scenario)

### popup-proof

1. `bench-live/popup-deep-read-proof` (standalone popup deep-read proof)

## Month 1 gate policy decisions

- `hover-selection` remains **optional** for Month 1. The repo now has credible browser-backed proof, but the lane is still a combined UX lane rather than a dedicated required CI gate with separate ownership semantics.
- `popup-proof` remains **optional** as a standalone lane. Its proof is also exercised through the required `learning-loop` lane in CI.
- `learning-loop`, `document-proof`, `youtube-proof`, and `youtube-holdout` have first-class required status in the `CI / live-browser` workflow under the current release policy. Treat failures as release-facing until explicitly downgraded in the release checklist and CI in the same change set.
- Canonical artifact guidance for this lane is the same as other live-browser gates: local runs write `bench-live-results/<run-id>/`; CI uploads the `live-bench-results` artifact bundle.

## Notes

- This is a **baseline credibility gate**, not full-surface completion.
- Surfaces outside required lanes can still have live scenarios and should be reported honestly as optional until promoted.
