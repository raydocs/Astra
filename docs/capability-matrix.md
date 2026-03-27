# Astra Capability Matrix

This page tracks the current product surface in the repo so feature work, docs, and validation stay aligned.

## Implemented now

### Core translation

- Full-page translation with progressive batching and viewport prioritisation
- Presentation modes:
  - bilingual
  - translation-only
- Presentation themes:
  - default
  - underline
  - highlight
- Per-site language and presentation overrides
- Article-mode extraction with readability-oriented heuristics
- Provider error feedback with error display in InputTranslate, HoverTranslate, FloatBall, and Popup

### Inline interaction

- Selection toolbar with translation, explanation, copy, and **save** actions
- Hover translation trigger modes:
  - `alt`
  - `always`
  - `disabled`
- Hover request dedupe, reuse of cached results, and short failure cooldown
- Input-box translation with in-place writeback for supported text fields
- Sensitive-field suppression for password and similar private inputs
- Generalized AI action system (translate, explain, summarize, rewrite, grammar)

### Media and context

- Page subtitle track translation for accessible `subtitles` / `captions`
- Privacy-mode context sanitisation for translation requests

### Platform and storage

- Astra-managed provider relay configuration for OpenAI and Gemini
- Astra account session storage and popup sign-in flow
- Versioned config stored in `browser.storage.local`
- Vocabulary storage for saved words and phrases (Phase 2 seed)
- Desktop browser build via WXT
- Safari/iOS shell project included in-repo
- Frame-aware content script injection and multi-frame coordination

### Test infrastructure

- DOM fixture harness for content-side regression tests
- Readability fixture catalog under `test/fixtures/pages` (14 fixtures)
- Provider prompt/parser contract tests including error paths (429, 500, network failure)
- Inline action contract tests
- Evaluator-first bench harness under `bench/`, with active scenario inventory tracked by `pnpm bench:inventory`, including interaction-priority, frame-coordination, and dynamic-content coverage
- Bench regression gate in CI (`pnpm bench` step)
- 373 unit tests, 55 test files

## Planned — Sprint 1 (daily-use gaps)

- YouTube bilingual subtitle translation (DOM mutation observer on `.ytp-caption-segment`)
- Gemini direct provider (non-relay `@ai-sdk/google` integration)
- Page translation retry mechanism (re-queue failed blocks instead of fail-fast)
- Extended keyboard shortcuts (Alt+W translate page, Alt+R article mode, Alt+H hover mode)

## Planned — Sprint 2 (video + site rules)

- Bilibili / Netflix subtitle translation adapters
- Enhanced site-specific rule system (selectors, excludes, paragraph min length)
- Right-click context menu "Translate with Astra"

## Planned — Sprint 3 (new surfaces)

- PDF bilingual translation (pdf.js client-side)
- ePub reader with inline translation

## Planned — Sprint 4 (learning loop, Phase 2)

- Vocabulary panel UI with export (CSV/Anki)
- Reading history tracking
- AI difficulty-graded explanations (beginner/intermediate/advanced)

## Planned — Sprint 5 (UX polish)

- TTS text-to-speech (Web Speech API or Edge TTS)
- Expanded presentation themes and customisation
- Smart Context terminology consistency (pre-translate glossary)
- i18n internationalisation (zh-CN + en)

## Known gaps

- iOS Safari runtime still needs a repeatable smoke-test pass on simulator and device
- Safari extension resources are committed snapshots and must stay in sync with generated WXT output
