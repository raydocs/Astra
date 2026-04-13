# Astra Live Coverage Matrix (Current Reality)

_Last updated: 2026-04-12 (Workstream B popup deep-read smoke sync)_

This matrix is the release-facing truth source for live coverage.

It separates:

1. **Live scenario exists**
2. **Lane is required in CI release-proof gate**
3. **Known gap still open**

## Lane legend

- **Required lane (CI):** included in `CI / live-browser`
- **Optional lane:** runnable manually or in non-required workflows
- Canonical lane naming: `docs/investigations/workstream-f-live-lane-conventions.md`

## Surface matrix

| Surface | Deterministic bench | Live scenario status | Required lane (CI) | Current reality notes |
|---|---|---|---|---|
| page-translation | Yes | Yes (multiple source-backed + contract + holdout scenarios) | **Yes** (`source-core`) | Required path currently anchored on `page-translation-article-basic-source-bilingual` |
| article-extraction | Yes | Yes (`bench-live/article-extraction-proof`) | **Yes** (`source-core`) | Source-contract browser proof is in required lane |
| dynamic-content | Yes | Yes (`bench-live/dynamic-content-append`) | **Yes** (`source-core`) | Source-contract browser proof exists; stress variants are not required yet |
| site-automation | Yes | Yes (`bench-live/site-automation-autostart`) | **Yes** (`extension-core`) | Extension-loaded bootstrap proof is in required lane |
| onboarding | No deterministic bench lane in `bench/` (live-only smoke today) | Yes (`bench-live/onboarding-smoke`) | **Yes** (`extension-core`) | Treated as extension-loaded smoke credibility check |
| vocabulary | Deterministic bench exists (learning-loop surfaces) | Yes (`bench-live/vocabulary-srs-smoke`) | **Yes** (`extension-core`) | Extension-loaded smoke in required lane |
| popup-deep-read | No deterministic bench lane yet | Yes (`bench-live/popup-deep-read-smoke`) | No | Optional browser-backed popup proof in `learning-loop` lane |
| interaction-priority | Yes | Yes (`bench-live/interaction-priority-basic` + holdout stress) | No | Live scenario exists but is not release-blocking today |
| frame-coordination | Yes | Yes (`bench-live/frame-coordination-basic`) | No | Live scenario exists but is not release-blocking today |
| hover | Yes | Yes (`bench-live/hover-translation-basic` + holdout moving-targets) | No | Standard browser-backed relay-stub proof exists; currently optional |
| selection-explain | Yes | Yes (`bench-live/selection-explain-basic`) | No | Dedicated standard browser-backed live scenario exists; currently optional |
| input-translation | Yes | Yes (`bench-live/input-translation-basic` + field-matrix) | No | Live scenario exists but is not release-blocking today |
| subtitle (web/video) | Yes | Yes (`subtitle-basic`, `youtube-subtitle-basic`) | No | **Risk:** known timing instability tracked in flaky inventory |
| subtitle-file | Yes | Yes (`subtitle-file-basic` + holdout malformed) | No | Optional lane only |
| PDF reader | Yes | Yes (`pdf-reader-basic` + holdout layout-noise) | No | Optional lane only |
| EPUB reader | Yes | Yes (`epub-reader-basic` + holdout long-chapter) | No | Optional lane only |

## Required Month 1 release-proof lanes (authoritative)

### `source-core`

1. `bench-live/page-translation-article-basic-source-bilingual`
2. `bench-live/article-extraction-proof`
3. `bench-live/dynamic-content-append`

### `extension-core`

1. `bench-live/site-automation-autostart`
2. `bench-live/onboarding-smoke`
3. `bench-live/vocabulary-srs-smoke`

## Optional-but-credible live proof (not release-blocking yet)

### `hover-selection`

1. `bench-live/hover-translation-basic`
2. `bench-live/selection-explain-basic`

### `learning-loop`

1. `bench-live/popup-deep-read-smoke`
2. `bench-live/vocabulary-srs-smoke`

## Open credibility gaps (must stay explicit)

1. **Hover/selection now have credible browser-backed proof, but are still optional** (not required release gates).
2. **Popup deep-read now has credible browser-backed proof, but is still optional** (not a required release gate).
3. Several other live-covered surfaces remain **optional** rather than release-blocking.
4. **Subtitle timing instability risk** remains open (`docs/investigations/workstream-f-live-flaky-inventory.md`).

## Update policy

When lanes or required scenarios change, update in this order:

1. `package.json` live lane scripts
2. `.github/workflows/ci.yml` live required steps
3. `docs/investigations/workstream-f-live-lane-conventions.md`
4. this matrix
5. `docs/release-readiness-checklist.md`
