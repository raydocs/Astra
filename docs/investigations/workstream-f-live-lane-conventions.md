# Workstream F Live Lane Conventions (Month 1 Baseline)

_Last updated: 2026-04-13 (Month 1 close-out docs/policy sync)_

This document defines the canonical lane naming used by release-proof checks.

## Lane names

| Lane | Purpose | Command | CI required |
|---|---|---|---|
| `source-core` | Browser-backed source-contract proof for core extraction/runtime behaviors | `pnpm bench:live:lane:source-core` | Yes (`CI / live-browser`) |
| `extension-core` | Extension-loaded smoke proof for bootstrap/owned surfaces | `pnpm bench:live:lane:extension-core` | Yes (`CI / live-browser`) |
| `release-proof` | Aggregate required release-proof gate | `pnpm bench:live:lane:release-proof` | Indirectly (runs both required lanes) |
| `hover-selection` | Optional browser-backed UX proof for hover + selection explain | `pnpm bench:live:lane:hover-selection` | No (manual/dispatch workflow) |
| `popup-proof` | Optional standalone browser-backed popup deep-read proof | `pnpm bench:live:lane:popup-proof` | No |
| `learning-loop` | Optional browser-backed popup-to-vocabulary learning-loop proof | `pnpm bench:live:lane:learning-loop` | No |

Compatibility aliases remain available:

- `bench:live:source` -> `bench:live:lane:source-core`
- `bench:live:extension` -> `bench:live:lane:extension-core`
- `bench:live:smoke` -> `bench:live:lane:release-proof`

## Required scenario inventory (Month 1 baseline)

### source-core

1. `bench-live/page-translation-article-basic-source-bilingual`
2. `bench-live/article-extraction-proof`
3. `bench-live/dynamic-content-append`

### extension-core

1. `bench-live/site-automation-autostart`
2. `bench-live/onboarding-smoke`
3. `bench-live/vocabulary-srs-smoke`

## Optional but credible scenario inventory (not release-blocking yet)

### hover-selection

1. `bench-live/hover-translation-basic` (browser-backed relay-stub flow)
2. `bench-live/selection-explain-basic` (dedicated standard browser-backed live scenario)

### popup-proof

1. `bench-live/popup-deep-read-proof` (standalone popup deep-read proof)

### learning-loop

1. `bench-live/popup-deep-read-proof` (popup proof anchor)
2. `bench-live/vocabulary-srs-smoke` (downstream vocabulary continuation)

## Month 1 gate policy decisions

- `hover-selection` remains **optional** for Month 1. The repo now has credible browser-backed proof, but the lane is still a combined UX lane rather than a dedicated required CI gate with separate ownership semantics.
- `popup-proof` and `learning-loop` remain **optional** for Month 1. They are credible evidence for popup deep-read and downstream learning continuity, but they are not part of the Month 1 required release-proof gate.

## Notes

- This is a **baseline credibility gate**, not full-surface completion.
- Surfaces outside required lanes can still have live scenarios and should be reported honestly as optional until promoted.
