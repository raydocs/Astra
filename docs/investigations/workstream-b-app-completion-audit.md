# Astra App Completion Audit

## Summary

Astra is a browser extension for real-time web page translation, supporting bilingual display, subtitle translation, hover translate, selection explain, input translation, and document readers (PDF, EPUB, subtitle files). The extension targets Chrome and Safari, with a relay-based provider architecture (OpenAI, Gemini) and an optional Astra-managed account system.

This audit enumerates every user-facing feature, maps each against six validation layers (code exists, bench-covered, live-covered, CI-protected, promotion-safe, operator-visible), and identifies the top blockers to claiming "app complete."

**Overall assessment:** Core page translation is well-implemented and deeply validated. However, several user-visible features (PDF reader, EPUB reader, vocabulary/SRS, onboarding, options panel, TTS) exist only as code with no bench or live coverage, and CI does not gate on live/browser-backed tests. The promotion pipeline (`bench-opt`) is structurally present but defaults to dry-run, meaning no automated path from passing benchmarks to a safe release.

---

## Validation Matrix

| # | Feature | Code Exists | Bench | Live | CI | Promotion-safe | Operator-visible | Status |
|---|---------|:-----------:|:-----:|:----:|:--:|:--------------:|:----------------:|--------|
| 1 | Page Translation (bilingual) | Yes | 6 scenarios | 3 live scenarios (source-backed) | Yes (pnpm bench in CI) | Dry-run promotion gate | bench-opt status artifact | Mostly Complete |
| 2 | Page Translation (translation-only) | Yes | 1 scenario | 1 live scenario | Yes | Dry-run | bench-opt status | Mostly Complete |
| 3 | Article Extraction | Yes | 3 scenarios | None | Yes | Dry-run | bench-opt status | Partially Validated |
| 4 | Dynamic Content (mutation observer) | Yes | 3 scenarios | None | Yes | Dry-run | bench-opt status | Partially Validated |
| 5 | Site Automation (always-translate) | Yes | 4 scenarios | None | Yes | Dry-run | bench-opt status | Partially Validated |
| 6 | Hover Translate | Yes | 3 scenarios | None | Yes | Dry-run | bench-opt status | Partially Validated |
| 7 | Selection Toolbar + Explain | Yes | 2 scenarios | None | Yes | Dry-run | bench-opt status | Partially Validated |
| 8 | Input Translation | Yes | 3 scenarios | None | Yes | Dry-run | bench-opt status | Partially Validated |
| 9 | Subtitle Translation (HTML5 tracks) | Yes | 3 scenarios | None | Yes | Dry-run | bench-opt status | Partially Validated |
| 10 | Video Platform Subtitles (YouTube/Bilibili/Netflix) | Yes | None | None | No | No | No | Under-tested |
| 11 | Frame Coordination | Yes | 4 scenarios | None | Yes | Dry-run | bench-opt status | Partially Validated |
| 12 | Interaction Priority | Yes | 4 scenarios | None | Yes | Dry-run | bench-opt status | Partially Validated |
| 13 | Float Ball | Yes | Tested via frame-coordination/interaction-priority | None | Indirect | No | No | Indirectly Tested |
| 14 | SPA Navigation | Yes | None | None | No | No | No | Under-tested |
| 15 | Provider Hot-Switch | Yes | None | None | No | No | No | Under-tested |
| 16 | PDF Reader | Yes | None | None | No | No | No | Not Validated |
| 17 | EPUB Reader | Yes | None | None | No | No | No | Not Validated |
| 18 | Subtitle File Reader (SRT/VTT/ASS) | Yes | None | None | No (parser unit-tested) | No | No | Minimally Tested |
| 19 | Popup UI | Yes | None | None | No (App.test.tsx exists) | No | No | Minimally Tested |
| 20 | Options Page | Yes | None | None | No (OptionsApp.test.tsx exists) | No | No | Minimally Tested |
| 21 | Onboarding Flow | Yes | None | None | No | No | No | Not Validated |
| 22 | Vocabulary / SRS | Yes | None | None | No (unit tests exist for leitner, vocabulary storage) | No | No | Not Validated |
| 23 | Reading History | Yes | None | None | No (unit test exists) | No | No | Minimally Tested |
| 24 | Auth / Account (sign in, anonymous registration) | Yes | None | None | No (unit tests for auth, account) | No | No | Minimally Tested |
| 25 | Quota System | Yes | None | None | No | No | No | Not Validated |
| 26 | Privacy Mode | Yes | 1 subtitle scenario | None | Yes (via bench) | No | No | Partially Validated |
| 27 | TTS (text-to-speech) | Yes | None | None | No (tts.test.ts exists) | No | No | Minimally Tested |
| 28 | Translation Cache | Yes | None | None | No (unit test exists) | No | No | Minimally Tested |
| 29 | Context Menu Actions | Yes | None | None | No | No | No | Not Validated |
| 30 | Keyboard Shortcuts | Yes | None | None | No | No | No | Not Validated |
| 31 | Badge Indicator (active translations, SRS due) | Yes | None | None | No | No | No | Not Validated |
| 32 | Custom Actions | Yes | None | None | No (actions.test.ts exists) | No | No | Minimally Tested |
| 33 | i18n (internationalization) | Yes | None | None | No | No | No | Not Validated |
| 34 | PDF Auto-detect Banner | Yes | None | None | No | No | No | Not Validated |
| 35 | Safari Build | Yes | None | None | Yes (build + verify script in CI) | No | No | Build-only |
| 36 | Provider Router (OpenAI/Gemini/Relay) | Yes | None | None | No (4 unit test files) | No | No | Minimally Tested |

---

## Major Findings

### 1. Strong: Core translation engine is deeply bench-covered

The page translation pipeline (`page-translate.ts`, `page-translate-registry.ts`, `translation-context.ts`, `translation-state.ts`) has 36 bench scenarios across 10 surfaces, all exercising real source code paths in JSDOM. The bench harness runs in CI (`pnpm bench` step in `.github/workflows/ci.yml`), so regressions in deterministic evaluator logic are caught on every push and PR.

### 2. Strong: Bench infrastructure is production-grade

The harness includes split discipline (train/validation/holdout), structured feedback loops, patch-task generation, executor/dispatch gates, history tracking, and an optimizer foundation (`bench-opt`). This is far beyond typical extension test suites.

### 3. Weak: Live/browser-backed validation covers only page translation

Only 4 live scenarios exist in `bench-live/`, all for page translation. Hover, selection, input, subtitle, video platforms, PDF, EPUB, popup, options, onboarding, vocabulary -- none have browser-backed validation. The live harness requires a real Chrome + Playwright session and is not yet part of CI.

### 4. Weak: CI does not run live tests

The CI pipeline runs `pnpm type-check`, `pnpm test`, `pnpm bench`, and two build steps. There is no Playwright or browser-backed test step. This means:
- All 36 bench scenarios run in JSDOM (no real browser rendering)
- All 4 live scenarios are opt-in and manual
- There is no E2E test that loads the built extension in a browser

### 5. Weak: Promotion pipeline is dry-run only

`bench-opt` has promotion, publish, and rollback skeletons, but all default to dry-run. There is no automated path from "all benchmarks pass" to "safe to release." Promotion requires explicit `--promotion-allow`, `--publish-allow` flags, and VCS/rollout runtime is not connected.

### 6. Critical: Multiple user-facing features have zero validation

Features with code but no bench, no live, and no CI-protected tests:
- PDF Reader (`src/entrypoints/pdf-reader/`)
- EPUB Reader (`src/entrypoints/epub-reader/`)
- Onboarding Flow (`src/entrypoints/onboarding/`)
- Vocabulary / SRS Review (`src/entrypoints/vocabulary/`)
- Video Platform Subtitles (YouTube/Bilibili/Netflix DOM injection)
- Context Menu actions
- Keyboard shortcuts
- Badge indicator
- Quota enforcement at runtime

### 7. Moderate: Unit test coverage is good but not gated on coverage thresholds

44 unit test files exist in `src/`, covering types, utils, providers, storage, DOM operations, and UI components. However, there is no coverage threshold enforcement in CI (no `--coverage` flag or coverage gate).

### 8. Moderate: Split discipline is mature but holdout gate is not automated

The 36 scenarios are distributed across train (20), validation (7), holdout (6) with explicit `splits.json`. However, holdout scenarios are only manually gated -- there is no CI step that blocks promotion based on holdout results.

---

## Top Blockers

1. **No browser-backed CI step.** All 36 bench scenarios run in JSDOM. Real rendering bugs, extension lifecycle issues, and platform-specific failures are invisible. Adding a Playwright-based CI step with the live scenarios would be the single highest-impact improvement.

2. **PDF/EPUB readers have zero validation.** These are fully implemented features (`PdfReaderApp.tsx`, `EpubReaderApp.tsx`, `pdf-extractor.ts`, `pdf-translator.ts`) that users will interact with, but no test of any kind exercises them beyond type-checking.

3. **Video platform subtitle injection is untested.** YouTube/Bilibili/Netflix subtitle translation uses platform-specific DOM selectors (`captionContainerSelector`, `captionSegmentSelector`) that break when platforms update their UI. There are no bench scenarios and no live tests for this feature.

4. **Onboarding and first-run experience are not validated.** The onboarding wizard (`OnboardingApp.tsx`) guides new users through setup. Any bug here means users never complete configuration. No tests exist.

5. **Vocabulary/SRS is a visible feature with no integration test.** The popup links to vocabulary and review pages. Storage and Leitner algorithm have unit tests, but the full flow (save word, schedule review, flash card session) has no integration or bench coverage.

6. **Promotion pipeline is not connected to release.** Even if all benchmarks pass, there is no automated mechanism to create a release branch, tag a version, or publish to the Chrome Web Store. The `bench-opt` promotion/publish/rollback skeletons are structural placeholders.

7. **Quota enforcement is not runtime-validated.** The type system defines quotas and limits (`AstraQuota`, `QuotaInfo`), and the popup displays quota bars, but there is no test verifying that translation requests are actually blocked when quota is exhausted.

8. **i18n has no automated validation.** The recent commit (`8505bf9`) swept hardcoded Chinese from priority files, but there is no test that ensures all user-facing strings go through `t()` or that locale files are complete.

---

## Recommended Next Actions

### Immediate (blocks "app complete" claim)

- **Add Playwright CI step** that loads the built extension in Chrome and runs at least the 4 existing live scenarios. This is the single most impactful change. Files: `.github/workflows/ci.yml`, `bench-live/`.

- **Add bench scenarios for video platform subtitles.** At minimum, a YouTube DOM mock scenario that verifies subtitle injection and cleanup. Files: `bench/scenarios/subtitle.ts` or a new `bench/scenarios/video-subtitle.ts`, `bench/evaluators/`.

- **Add basic smoke tests for PDF Reader and EPUB Reader.** Even a "renders without crashing" test using JSDOM or Playwright would be valuable. Files: `src/entrypoints/pdf-reader/`, `src/entrypoints/epub-reader/`.

- **Add onboarding flow test.** Verify the 3-step wizard renders, navigates, and persists configuration. Files: `src/entrypoints/onboarding/`.

### Short-term (next sprint)

- **Add vocabulary/SRS integration test.** Full flow from saving a word through scheduled review. Files: `src/entrypoints/vocabulary/`, `src/utils/srs/`, `src/utils/storage/vocabulary.ts`.

- **Add quota enforcement test.** Verify translation requests fail gracefully when daily quota is exhausted. Files: `src/utils/astra/quota.ts`, `src/entrypoints/background/index.ts`.

- **Gate CI on coverage thresholds.** Add `vitest --coverage` with a minimum line/branch threshold. Files: `vitest.config.ts`, `.github/workflows/ci.yml`.

- **Add SPA navigation bench scenario.** The `spa-navigation.ts` module monkey-patches `history.pushState` and `replaceState` -- this is fragile and should have dedicated bench coverage. Files: `bench/scenarios/`.

### Medium-term (before promotion)

- **Connect promotion pipeline to VCS.** Wire `bench-opt/promote.ts` and `bench-opt/publish.ts` to create actual branches/PRs/tags. Files: `bench-opt/promote.ts`, `bench-opt/publish.ts`.

- **Add holdout gate to CI.** CI should run holdout scenarios and fail the pipeline if any holdout scenario regresses. Files: `.github/workflows/ci.yml`.

- **Add i18n completeness check.** A script that compares `t()` call sites against locale files and fails if strings are missing. Files: `src/utils/i18n.ts`, locale files.

---

## Handoff

### Findings summary

- 36 features enumerated; 2 fully validated (page translation bilingual/translation-only), 10 partially validated (bench-covered but no live/browser), 24 minimally tested or not validated at all.
- The bench harness is production-grade with 36 scenarios, split discipline, and optimizer infrastructure.
- The critical gap is the absence of browser-backed CI validation and the large number of user-facing features with zero test coverage.

### Evidence (files inspected)

**Content entrypoint (core translation engine):**
- `src/entrypoints/content/index.tsx` -- main content script, mounts UI, handles commands
- `src/entrypoints/content/page-translate.ts` -- viewport-first progressive translation
- `src/entrypoints/content/page-translate-registry.ts` -- block lifecycle state machine
- `src/entrypoints/content/translation-context.ts` -- page context extraction
- `src/entrypoints/content/translation-state.ts` -- reactive state store
- `src/entrypoints/content/subtitle-translate.ts` -- HTML5 text track translation
- `src/entrypoints/content/inline-actions.ts` -- translate/explain/custom actions
- `src/entrypoints/content/interaction-coordination.ts` -- suppression coordination
- `src/entrypoints/content/frame-context.ts` -- top/child frame detection
- `src/entrypoints/content/spa-navigation.ts` -- SPA URL change detection
- `src/entrypoints/content/pdf-detect.ts` -- PDF auto-detection banner
- `src/entrypoints/content/video-platforms/index.ts` -- multi-platform video subtitles
- `src/entrypoints/content/video-platforms/youtube.ts`, `bilibili.ts`, `netflix.ts`
- `src/entrypoints/content/components/FloatBall.tsx`, `HoverTranslate.tsx`, `InputTranslate.tsx`, `SelectionToolbar.tsx`

**Background entrypoint:**
- `src/entrypoints/background/index.ts` -- message routing, context menus, badges, keyboard shortcuts
- `src/entrypoints/background/frame-coordinator.ts` -- multi-frame aggregation

**Other entrypoints:**
- `src/entrypoints/popup/App.tsx` -- popup UI
- `src/entrypoints/options/OptionsApp.tsx` -- settings page
- `src/entrypoints/onboarding/OnboardingApp.tsx` -- first-run wizard
- `src/entrypoints/subtitle-reader/SubtitleReaderApp.tsx`, `subtitle-parser.ts`
- `src/entrypoints/pdf-reader/PdfReaderApp.tsx`, `pdf-extractor.ts`, `pdf-translator.ts`
- `src/entrypoints/epub-reader/EpubReaderApp.tsx`
- `src/entrypoints/vocabulary/VocabularyApp.tsx`, `ReviewMode.tsx`, `ReviewStats.tsx`

**Types:**
- `src/types/config.ts` -- config schema (Zod), site settings, provider config
- `src/types/messages.ts` -- runtime/content message protocol
- `src/types/translation.ts` -- translation state, error types, snapshots
- `src/types/auth.ts` -- session, account, quota, billing types
- `src/types/actions.ts` -- builtin and custom action definitions

**Utils:**
- `src/utils/storage/config.ts`, `auth.ts`, `reading-history.ts`, `vocabulary.ts`
- `src/utils/providers/openai.ts`, `gemini.ts`, `relay.ts`, `router.ts`
- `src/utils/dom/extraction.ts`, `inject.ts`, `traversal.ts`, `clipboard.ts`
- `src/utils/translate/translate.ts`
- `src/utils/privacy.ts` -- sensitive input detection, context sanitization
- `src/utils/tts.ts` -- text-to-speech
- `src/utils/astra/auth.ts`, `account.ts`, `quota.ts`
- `src/utils/srs/leitner.ts`
- `src/utils/cache/translation-cache.ts`
- `src/utils/i18n.ts`

**Bench harness:**
- `bench/scenarios/` -- 10 scenario files covering 10 surfaces, 36 total scenarios
- `bench/evaluators/` -- 10 evaluator files
- `bench/types.ts` -- full report/handoff/loop/patch/executor type system
- `bench/splits.json` -- train/validation/holdout assignments
- `bench-live/scenarios/` -- 4 Playwright-backed live scenarios

**CI:**
- `.github/workflows/ci.yml` -- type-check, test, bench, build (Chrome + Safari), Safari build verify

**Docs:**
- `docs/bench-harness.md` -- harness documentation
- `docs/bench-opt.md` -- optimizer documentation

### Decisions / Recommendations

1. **Prioritize browser-backed CI** over adding more JSDOM bench scenarios. The marginal value of the 37th JSDOM scenario is lower than the first Playwright CI scenario.
2. **Do not claim "app complete" until** PDF reader, EPUB reader, video platform subtitles, and onboarding each have at least one automated test.
3. **The promotion pipeline should be the next major infrastructure investment** after Playwright CI is added.

### Ready-for-implementation tasks

| Task | Files | Expected Output | Acceptance Criteria |
|------|-------|-----------------|---------------------|
| Add Playwright CI step | `.github/workflows/ci.yml` | CI job that loads built extension in Chrome via Playwright, runs `pnpm bench:live` | 4 existing live scenarios pass in CI on every push/PR |
| Add video subtitle bench scenario | `bench/scenarios/video-subtitle.ts`, `bench/evaluators/video-subtitle.ts`, `bench/scenarios/index.ts` | 2+ scenarios: YouTube caption inject, cleanup | Scenarios registered, pass in `pnpm bench` |
| Add PDF reader smoke test | `src/entrypoints/pdf-reader/PdfReaderApp.test.tsx` | Render test for PdfReaderApp | Component renders without error |
| Add EPUB reader smoke test | `src/entrypoints/epub-reader/EpubReaderApp.test.tsx` | Render test for EpubReaderApp | Component renders without error |
| Add onboarding flow test | `src/entrypoints/onboarding/OnboardingApp.test.tsx` | Wizard step navigation test | All 3 steps render and can be navigated |
| Add vocabulary integration test | `src/entrypoints/vocabulary/VocabularyApp.test.tsx` | Save + review cycle test | Word can be saved, appears in review, SRS scheduling works |
| Add quota enforcement test | `src/utils/astra/quota.test.ts` | Quota exhaustion test | Translation request returns QUOTA_EXCEEDED when limit hit |
| Gate CI on coverage | `vitest.config.ts`, `.github/workflows/ci.yml` | Coverage threshold enforcement | CI fails if coverage drops below threshold |

### Risks / Open Questions

1. **Video platform selector fragility.** YouTube, Bilibili, and Netflix frequently change their DOM structure. How will selector updates be detected before users report breakage?

2. **Safari build verification scope.** CI runs `verify-safari-build-sync.sh` but does not test the extension in Safari WebKit. Safari-specific bugs (e.g., `browser.*` API differences) are invisible.

3. **Anonymous registration reliability.** `tryAnonymousRegistration()` in the background script fires on first install, makes a POST to the relay, and silently ignores failures. If the relay is down at install time, the user gets no account and may not understand why features are limited.

4. **JSDOM fidelity.** The 36 bench scenarios run in JSDOM, which does not support `IntersectionObserver`, real CSS rendering, or shadow DOM scoping. Bugs in viewport-first progressive translation or shadow-DOM-based UI components may not surface.

5. **Holdout scenario count.** Only 6 of 36 scenarios are holdout-split. If holdout is meant to be the final promotion gate, this is a narrow sample that may miss regressions in unrepresented surfaces.
