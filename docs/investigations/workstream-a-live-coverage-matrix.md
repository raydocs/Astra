# Astra Live Coverage Matrix (Current Reality)

_Last updated: 2026-05-18 (learning-loop promoted to required CI release gate; historical Month 1–4 evidence retained)_

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
| page-translation | Yes | Yes (multiple source-backed + contract + holdout scenarios) | **Yes** (`source-core`) | Required path includes `page-translation-article-basic-source-bilingual` and `page-translation-full-page-title-shadow-source`. |
| article-extraction | Yes | Yes (`bench-live/article-extraction-proof`) | **Yes** (`source-core`) | Source-contract browser proof is in required lane |
| dynamic-content | Yes | Yes (`bench-live/dynamic-content-append`) | **Yes** (`source-core`) | Source-contract browser proof exists; stress variants are not required yet |
| site-automation | Yes | Yes (`bench-live/site-automation-autostart`) | **Yes** (`extension-core`) | Extension-loaded bootstrap proof is in required lane |
| onboarding | No deterministic bench lane in `bench/` (live-only smoke today) | Yes (`bench-live/onboarding-smoke`) | **Yes** (`extension-core`) | Treated as extension-loaded smoke credibility check |
| vocabulary | Deterministic bench exists (learning-loop surfaces) | Yes (`bench-live/vocabulary-srs-smoke`) | **Yes** (`extension-core`) | Extension-loaded smoke in required lane |
| popup-deep-read | No deterministic bench lane yet | Yes (`bench-live/popup-deep-read-proof`) | **Yes** (via `learning-loop`; standalone `popup-proof` remains optional) | Popup proof is required as part of the current `learning-loop` lane. **Replay doc:** `docs/investigations/m1-bf-01-popup-learning-loop-replay-2026-04-14.md` preserves fresh green standalone `popup-proof`, then-optional green `learning-loop` chain, and pre-harness failure baseline for archaeology. |
| learning-loop / revisit v1 | Yes | Yes (`bench-live/learning-loop-revisit-smoke`, chained by `bench:live:lane:learning-loop`) | **Yes** (`learning-loop`) | Current required lane proves popup → vocabulary/review → Vocabulary Reading tab → Open article revisit continuity. |
| interaction-priority | Yes | Yes (`bench-live/interaction-priority-basic` + holdout stress) | No | Live scenario exists but is not release-blocking today |
| frame-coordination | Yes | Yes (`bench-live/frame-coordination-basic`, `bench-live/frame-coordination-cross-origin-fallback`) | **Yes** (`source-core`) | Required source-core lane now covers basic and cross-origin fallback coordination. |
| hover | Yes | Yes (`bench-live/hover-translation-basic` + holdout moving-targets) | No | Standard browser-backed relay-stub proof exists; currently optional |
| selection-explain | Yes | Yes (`bench-live/selection-explain-basic`) | No | Dedicated standard browser-backed live scenario exists; currently optional |
| input-translation | Yes | Yes (`bench-live/input-translation-basic` + field-matrix) | No | Live scenario exists but is not release-blocking today |
| subtitle (web/video) | Yes | Yes (`subtitle-basic`, YouTube proof/holdout, `bilibili-subtitle-basic`) | **Yes for YouTube** (`youtube-proof`, `youtube-holdout`); No for generic/Bilibili | Required proof is scoped to YouTube subtitle/transcript/save/note paths and YouTube holdouts. Bilibili remains beta/best-effort; broader repo adapters remain code-only / non-release-blocking per the Month 4 inventory. |
| subtitle-file | Yes | Yes (`subtitle-file-basic`, `subtitle-learning-chain-smoke` + holdout malformed) | **Yes** (`document-proof`) | Required proof covers controlled SRT/VTT subtitle-file intake/reader flow; ASS/Markdown/TXT/HTML parser conveniences and automatic local-file reopen remain outside public support claims. |
| PDF reader | Yes | Yes (`pdf-reader-basic` + holdout layout-noise) | **Yes** (`document-proof`) | Required proof covers the fixture-backed controlled PDF reader path, not OCR, DOCX layout, image/comic translation, or universal reopen parity. |
| EPUB reader | Yes | Yes (`epub-reader-basic` + holdout long-chapter) | **Yes** (`document-proof`) | Required proof covers the fixture-backed controlled EPUB reader path, not universal queue reopen parity. |

## Required release-proof lanes (authoritative current policy)

### `source-core`

1. `bench-live/page-translation-article-basic-source-bilingual`
2. `bench-live/page-translation-full-page-title-shadow-source`
3. `bench-live/article-extraction-proof`
4. `bench-live/dynamic-content-append`
5. `bench-live/frame-coordination-basic`
6. `bench-live/frame-coordination-cross-origin-fallback`

### `extension-core`

1. `bench-live/site-automation-autostart`
2. `bench-live/onboarding-smoke`
3. `bench-live/vocabulary-srs-smoke`

### `learning-loop`

1. `bench-live/popup-deep-read-proof`
2. `bench-live/vocabulary-srs-smoke`
3. `bench-live/selection-save-review-loop`
4. `bench-live/learning-loop-revisit-smoke`

### `document-proof`

1. `bench-live/document-intake-basic`
2. `bench-live/document-intake-local-file-handoff`
3. `bench-live/pdf-reader-basic`
4. `bench-live/epub-reader-basic`
5. `bench-live/subtitle-file-basic`

### `youtube-proof`

1. `bench-live/youtube-subtitle-player-button`
2. `bench-live/youtube-subtitle-in-player-settings`
3. `bench-live/youtube-subtitle-basic-bilingual`
4. `bench-live/youtube-subtitle-seek-recovery`
5. `bench-live/youtube-subtitle-track-switch`
6. `bench-live/youtube-transcript-panel`
7. `bench-live/youtube-transcript-search-jump`
8. `bench-live/youtube-save-sentence-review-loop`
9. `bench-live/youtube-video-note-create`

### `youtube-holdout`

1. `bench-live/holdout/youtube-subtitle-race`
2. `bench-live/holdout/youtube-no-captions`
3. `bench-live/holdout/youtube-asr-only`
4. `bench-live/holdout/youtube-long-video`
5. `bench-live/holdout/youtube-fullscreen`
6. `bench-live/holdout/youtube-spa-navigation`

## Optional-but-credible live proof (not release-blocking yet)

### `hover-selection`

1. `bench-live/hover-translation-basic`
2. `bench-live/selection-explain-basic`

### `popup-proof`

1. `bench-live/popup-deep-read-proof`

### `reader-revisit-baseline` (Month 3, optional/manual)

1. `bench-live/pdf-reader-basic`
2. `bench-live/epub-reader-basic`
3. `bench-live/subtitle-file-basic`
4. `bench-live/learning-loop-revisit-smoke`

## Open credibility gaps (must stay explicit)

1. **Hover/selection now have credible browser-backed proof, but remain optional by Month 1 policy**: the current lane is a combined UX lane, separate required-lane semantics/CI ownership are not yet defined, and Month 1 should avoid over-promoting non-core UX proof.
2. **Popup deep-read standalone proof remains optional, but popup proof is now required through `learning-loop`** (`bench-live/popup-deep-read-proof`, `popup-proof`, `learning-loop`). Treat older `ERR_BLOCKED_BY_CLIENT` / wrong-relay failures as **harness regressions** superseded by the 2026-04-14 driver + scenario fixes unless reproduced on current `main`; the replay note preserves fresh green standalone `popup-proof` and green `learning-loop` reruns on current code.
3. Several other live-covered surfaces remain **optional** rather than release-blocking.
4. **Subtitle timing instability risk** remains open (`docs/investigations/workstream-f-live-flaky-inventory.md`).
5. **Reader/file proof is required only for controlled flows**: `document-proof` is release-critical for document intake, local-file handoff, PDF, EPUB, and SRT/VTT subtitle-file flows, but non-article local-file reopen still depends on reader handoff rather than fully automatic resume.
6. **Month 4 video breadth must stay explicit**: YouTube has required proof/holdout lanes; Bilibili remains beta/best-effort; Netflix / Prime Video / Disney+ / Udemy / Coursera remain code-only in support docs until stronger proof exists.

## Update policy

When lanes or required scenarios change, update in this order:

1. `package.json` live lane scripts
2. `.github/workflows/ci.yml` live required steps
3. `docs/investigations/workstream-f-live-lane-conventions.md`
4. this matrix
5. `docs/release-readiness-checklist.md`
