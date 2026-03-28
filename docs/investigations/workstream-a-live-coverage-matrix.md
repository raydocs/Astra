# Astra Live Coverage Matrix

## Summary

This document is the authoritative live-evaluation coverage plan for Astra. It catalogs all 10 product surfaces, classifies their current deterministic and live bench coverage, identifies concrete gaps, and provides minimal and stronger live scenario specifications that an implementation agent can build without guessing.

**Current state:**
- 10 product surfaces with 34 deterministic bench scenarios across train/validation/holdout splits
- Live coverage exists only for `page-translation` (3 Playwright-backed scenarios plus 1 browser smoke)
- The remaining 9 surfaces have zero live browser-backed evaluation
- No CI pipeline runs live scenarios today; all CI protection comes from the deterministic JSDOM bench

**Key finding:** The deterministic bench is thorough for functional correctness against mocked runtimes. The critical gap is that no surface besides page-translation has any live browser verification, meaning CSS rendering issues, Shadow DOM timing, real event dispatch failures, and extension bootstrap regressions are invisible to the harness.

---

## Surface Inventory

### page-translation
- Deterministic bench coverage: yes (6 scenarios: article-basic-bilingual, forms-and-nav-skip, article-translation-only, nested-blocks-coverage, feed-card-list, provider-error-graceful)
- Live coverage: strong (6 source-backed / browser-backed Playwright scenarios: bilingual, translation-only, contract fallback, forms-and-nav, nested-blocks, feed-card-list; plus fixture-playwright-smoke)
- CI protection: partial (deterministic runs in CI; live scenarios require local Chrome and are opt-in via `pnpm bench:live`)
- Current gaps:
  - The live suite now includes forms-and-nav, nested-blocks, and feed-card-list browser-backed coverage, but the deterministic holdout for provider-error-graceful still lacks a dedicated browser stress case
  - Live scenarios still do not validate visual rendering quality (font rendering, layout shifts, bilingual spacing)
  - No live scenario for provider-error-graceful (error UI rendering not browser-verified)
  - Live scenarios do not validate visual rendering quality (font rendering, layout shifts, bilingual spacing)
  - No real-extension-loaded live scenario (current source-backed path runs `startPageTranslation()` in JSDOM/Vite SSR, not through the actual content script bootstrap)
- Minimal live scenario:
  - user goal: Verify page translation produces visible bilingual output on a real web page
  - trigger: `pnpm bench:live -- --scenario bench-live/page-translation-article-basic-source-bilingual`
  - expected outcome: Screenshot shows bilingual markers, evaluator contract passes, snapshot HTML contains `data-astra-translation="1"` nodes
  - artifacts: screenshot PNG, snapshot HTML, result.json, result.md in `bench-live-results/<run-id>/`
  - pass/fail criteria: `evaluatePageTranslation()` returns `pass: true` with `total >= 80` and no critical issues
- Stronger follow-up scenario:
  - user goal: Load the Astra extension in a real Chrome instance via Playwright, navigate to a fixture page, trigger page translation through the float ball or popup, and verify the full extension lifecycle
  - trigger: New scenario `bench-live/page-translation-extension-loaded` that uses `chromium.launchPersistentContext()` with `--load-extension=dist/`
  - expected outcome: Extension injects content script, float ball appears, page translation runs end-to-end through the real message passing layer
  - artifacts: screenshot, snapshot HTML, console log capture, network request log
  - pass/fail criteria: Same evaluator contract plus: float ball visible in screenshot, no console errors matching `/Astra.*error/i`, at least 1 translation API request intercepted
- Priority: P0
- Notes:
  - This is the only surface with existing live coverage
  - The source-backed live path (`bench-live/source-runtime.ts`) runs the real `startPageTranslation()` source in JSDOM then opens the snapshot in Playwright -- this is a strong intermediate step but not a full extension-loaded test
  - `bench-live/scenarios/page-translation-article-basic.ts` (the contract-shaped fallback) injects markers via `page.evaluate()` rather than running the real translation module, making it a contract test rather than a true live test

---

### interaction-priority
- Deterministic bench coverage: yes (4 scenarios: selection-blocks-hover, dismissed-selection-restores-hover, input-focus-stays-isolated, float-ball-toggle-stays-independent)
- Live coverage: none
- CI protection: yes (deterministic bench runs against JSDOM with `act()` wrappers for React component mounting)
- Current gaps:
  - All interaction priority testing uses JSDOM Shadow DOM simulation; real Shadow DOM host isolation is not verified
  - Mouse event dispatch in JSDOM does not exercise real browser pointer capture, focus ring rendering, or z-index stacking
  - Float ball drag/click discrimination relies on `pointerdown`/`pointerup` events that behave differently in real Chromium
  - No visual verification that only the expected overlay is visible (JSDOM checks presence of Shadow DOM children, not visual rendering)
- Minimal live scenario:
  - user goal: Verify that selecting text shows only the selection toolbar and suppresses hover overlay in a real browser
  - trigger: New scenario `bench-live/interaction-priority-selection-blocks-hover`
  - expected outcome: After programmatic text selection via Playwright, selection toolbar Shadow DOM host contains visible buttons; hover overlay Shadow DOM host is empty or hidden
  - artifacts: screenshot before selection, screenshot after selection, DOM snapshot of both Shadow DOM hosts
  - pass/fail criteria:
    - `page.locator('#astra-selection-toolbar-host').evaluate(host => host.shadowRoot.querySelectorAll('button').length)` returns > 0
    - `page.locator('#astra-hover-translate-host').evaluate(host => !host.shadowRoot?.querySelector('button'))` returns true
    - No JavaScript errors in console during the interaction sequence
- Stronger follow-up scenario:
  - user goal: Full interaction priority matrix: select text -> verify toolbar -> scroll to dismiss -> hover -> verify hover overlay -> focus input -> verify input overlay -> click float ball -> verify page toggle
  - trigger: New scenario `bench-live/interaction-priority-full-matrix`
  - expected outcome: Sequential verification of each interaction state transition with screenshot at each step
  - artifacts: 5 screenshots (baseline, selection, hover-after-dismiss, input-focus, float-ball-click), console log, final DOM snapshot
  - pass/fail criteria: Each transition must show exactly the expected set of visible hosts and no forbidden hosts; `evaluateInteractionPriority()` contract must pass for each sub-step
- Priority: P1
- Notes:
  - Requires mounting the extension's React components in real Chrome Shadow DOM hosts
  - This surface is the most sensitive to browser-specific event timing differences between JSDOM and Chromium

---

### frame-coordination
- Deterministic bench coverage: yes (4 scenarios: top-frame-mounts-site-ui-and-float-ball, child-frame-skips-top-frame-chrome, background-aggregates-running-frames, background-falls-back-to-top-frame-metadata)
- Live coverage: none
- CI protection: yes (deterministic bench)
- Current gaps:
  - Content script frame detection (`isTopFrame()`) is tested against `__setTopFrameOverrideForTests` not real `window === window.top`
  - Background frame coordinator aggregation uses mock `sendFrameMessage` not real `chrome.tabs.sendMessage` with frame targeting
  - No test verifies that a real iframe receives the content script and correctly skips top-frame-only chrome
  - No test verifies cross-origin iframe isolation (CSP, sandbox)
- Minimal live scenario:
  - user goal: Verify that a page with a same-origin iframe correctly mounts float ball only in the top frame
  - trigger: New scenario `bench-live/frame-coordination-top-vs-child`
  - expected outcome: Top frame has `#astra-float-ball-host` with visible content; iframe does not have it
  - artifacts: screenshot of full page, DOM snapshots of top frame and iframe
  - pass/fail criteria:
    - Top frame: `document.getElementById('astra-float-ball-host')?.shadowRoot?.querySelector('div[title]')` exists
    - Iframe: same query returns null
    - Both frames have selection toolbar and hover translate hosts mounted
- Stronger follow-up scenario:
  - user goal: Load the extension on a page with 2 iframes, trigger translation, verify aggregated progress via the background coordinator
  - trigger: New scenario `bench-live/frame-coordination-aggregate`
  - expected outcome: Background `executeTabCommand` returns correct `framesTotal`, `framesTranslating`, and aggregated `progressTotalBlocks`
  - artifacts: screenshot, aggregation state JSON dump, console logs from all frames
  - pass/fail criteria: Aggregated `framesTotal === 3` (top + 2 iframes), `aggregatePhase === "running"`, `aggregateHostname` matches top frame
- Priority: P1
- Notes:
  - Requires `chromium.launchPersistentContext()` with `--load-extension` to test real extension frame injection
  - This is architecturally the hardest live scenario to implement because it requires real cross-frame messaging through `chrome.runtime`

---

### dynamic-content
- Deterministic bench coverage: yes (3 scenarios: new-feed-item-translates-once, in-place-text-change-retranslates-cleanly, removed-feed-item-cleans-registry)
- Live coverage: none
- CI protection: yes (deterministic bench using JSDOM DOM mutations)
- Current gaps:
  - MutationObserver in JSDOM behaves synchronously unlike real browser async observation
  - No verification that dynamically appended content (infinite scroll, SPA navigation) triggers translation in a real browser
  - No verification of visual rendering: does the newly translated block appear inline or cause a layout shift?
  - Registry cleanup for removed elements only tested with JSDOM `element.remove()` not real browser-driven DOM recycling
- Minimal live scenario:
  - user goal: Verify that appending a new DOM node after initial page translation triggers exactly one additional translation request
  - trigger: New scenario `bench-live/dynamic-content-append`
  - expected outcome: After injecting a new `<article><p>New content</p></article>` via `page.evaluate()`, the translation system picks it up and creates a new `data-astra-translation="1"` marker
  - artifacts: screenshot before append, screenshot after append, request count log
  - pass/fail criteria:
    - `data-astra-translation="1"` count increases by exactly 1 after the append
    - Network/message intercept shows exactly 1 new translation request
    - No console errors during the mutation handling
- Stronger follow-up scenario:
  - user goal: Simulate an infinite-scroll feed that appends 10 items over 5 seconds, then removes 3 items, and verify registry convergence
  - trigger: New scenario `bench-live/dynamic-content-feed-lifecycle`
  - expected outcome: Progressive translation of all 10 items; after removal, progress total drops by 3
  - artifacts: screenshots at t=0, t=3s, t=6s; progress state dumps at each checkpoint
  - pass/fail criteria: Final `progressTotalBlocks === initial + 10 - 3`; no stale translation markers on removed items; no duplicate requests
- Priority: P1
- Notes:
  - This surface benefits most from real browser MutationObserver behavior
  - Testing requires the source-backed live runtime (similar to page-translation) with real `startPageTranslation()` running and responding to mutations

---

### article-extraction
- Deterministic bench coverage: yes (3 scenarios: docs-sidebar-root, blog-comments-rejected, forum-thread-fallback)
- Live coverage: none
- CI protection: yes (deterministic bench)
- Current gaps:
  - Extraction plan resolution tested against static JSDOM fixtures; real pages have dynamic stylesheets, lazy-loaded content, and script-generated layouts that affect `resolveArticleRoot()`
  - No verification against real-world page layouts (news sites, documentation sites, blog platforms)
  - No visual verification that the extracted article root matches what a human would consider "the article content"
  - Comment exclusion (`blog-comments-rejected`) tested against hand-crafted fixture HTML, not real comment section DOM structures
- Minimal live scenario:
  - user goal: Verify that `resolveExtractionPlan()` correctly identifies the article root on a rendered documentation page
  - trigger: New scenario `bench-live/article-extraction-docs-layout`
  - expected outcome: After loading a docs-sidebar-heavy fixture in a real browser (with CSS applied), extraction plan resolves `scope: "article"` and `rootId: "docs-article"`
  - artifacts: screenshot with article root highlighted (via injected border), extraction plan JSON dump
  - pass/fail criteria:
    - `plan.scope === "article"`
    - `plan.root.id === "docs-article"`
    - `plan.blocks.length > 0`
    - No sidebar text appears in `plan.blocks[*].text`
- Stronger follow-up scenario:
  - user goal: Run extraction against 5 different real-world-like layouts (docs, blog, news, forum, landing page) and verify correct root selection on each
  - trigger: New scenario `bench-live/article-extraction-layout-matrix`
  - expected outcome: Each layout produces the correct scope and root; no false article detection on the landing page
  - artifacts: screenshot per layout, extraction plan JSON per layout
  - pass/fail criteria: All 5 extractions match expected scope/root; forum and landing page correctly fall back to page scope
- Priority: P2
- Notes:
  - Pure DOM logic; does not require extension loading, only a browser for realistic CSS layout
  - Could use the simpler `materializeFixturePage()` + `withLiveBrowserPage()` pattern already in the codebase

---

### hover
- Deterministic bench coverage: yes (3 scenarios: alt-success, disabled-suppressed, selection-suppression)
- Live coverage: none
- CI protection: yes (deterministic bench)
- Current gaps:
  - Hover overlay positioning tested in JSDOM which does not compute real CSS positions; overlay could render off-screen or overlap other elements in a real browser
  - Alt+mousemove event simulation in JSDOM does not test real keyboard modifier state detection
  - Translation latency measurement in JSDOM is not representative of real browser rendering + API round-trip
  - Shadow DOM overlay rendering (the hover translate panel) never verified visually
- Minimal live scenario:
  - user goal: Verify that Alt+hovering over a text block shows the hover translate overlay in the correct position
  - trigger: New scenario `bench-live/hover-alt-success`
  - expected outcome: After `page.keyboard.down('Alt')` + `page.hover('#target')` + wait, the hover translate Shadow DOM host contains a visible panel with translated text
  - artifacts: screenshot with overlay visible, overlay bounding box coordinates, panel text content
  - pass/fail criteria:
    - `#astra-hover-translate-host` Shadow DOM contains a visible `<div>` with non-empty text
    - Overlay bounding box is within viewport (not clipped or off-screen)
    - At least 1 translation request was dispatched
    - Latency from hover to overlay appearance < 500ms
- Stronger follow-up scenario:
  - user goal: Test the full hover lifecycle: show overlay, dismiss on mouse-leave, re-show on new target, verify overlay follows cursor
  - trigger: New scenario `bench-live/hover-lifecycle`
  - expected outcome: Overlay appears on first target, disappears on mouse-leave, appears on second target at new position
  - artifacts: 3 screenshots (hover-target-1, mouse-leave, hover-target-2), position log
  - pass/fail criteria: Overlay position changes between targets; overlay is not visible during mouse-leave screenshot
- Priority: P1
- Notes:
  - Requires extension-loaded context since the hover component is mounted by `mountHoverTranslate()` in the content script
  - Position validation is the key gap that JSDOM cannot cover

---

### selection-explain
- Deterministic bench coverage: yes (2 scenarios: contextful-result, copy-result)
- Live coverage: none
- CI protection: yes (deterministic bench)
- Current gaps:
  - Selection toolbar buttons tested via JSDOM Shadow DOM queries; real button rendering, click targets, and z-index layering not verified
  - Clipboard write tested via mock `getClipboardWrites()`; real `navigator.clipboard.writeText()` not tested (requires secure context + permissions)
  - Selection context extraction depends on `window.getSelection()` which behaves differently in real Chromium (Range API, collapsed selections, cross-element selections)
  - No verification that the explain result panel renders readable text in the correct position relative to the selection
- Minimal live scenario:
  - user goal: Verify that selecting text and clicking the "explain" button shows a result panel with translated/explained content
  - trigger: New scenario `bench-live/selection-explain-basic`
  - expected outcome: After programmatic text selection + mouseup + button click, the selection toolbar Shadow DOM shows an explain result
  - artifacts: screenshot of toolbar visible, screenshot after explain, DOM snapshot of result panel
  - pass/fail criteria:
    - Selection toolbar Shadow DOM contains buttons with labels including "explain" equivalent
    - After clicking explain, result panel contains non-empty text
    - At least 1 translation request with `task: "explain"` was dispatched
    - Request payload includes `selectionContext` with surrounding text
- Stronger follow-up scenario:
  - user goal: Test explain + copy flow end-to-end with clipboard verification
  - trigger: New scenario `bench-live/selection-explain-copy`
  - expected outcome: After explain, clicking copy writes the result to clipboard
  - artifacts: screenshot after copy, clipboard content (read via `page.evaluate(() => navigator.clipboard.readText())`)
  - pass/fail criteria: Clipboard content matches the explain result text; no JavaScript errors
- Priority: P2
- Notes:
  - Clipboard testing in Playwright requires `--unsafely-disable-devtools-self-xss-warnings` or the `clipboard-read` permission
  - Selection creation in Playwright can use `page.evaluate()` to set a Range programmatically

---

### input-translation
- Deterministic bench coverage: yes (3 scenarios: writeback, empty-then-type, password-suppressed)
- Live coverage: none
- CI protection: yes (deterministic bench)
- Current gaps:
  - Input overlay positioning (the translate button near the input field) tested in JSDOM with `setElementRect()` mock; real CSS absolute/fixed positioning not verified
  - Writeback (`input.value = translatedText` + dispatch `InputEvent`) tested in JSDOM; real browser form autofill interaction, React controlled input conflicts, and SPA framework interference not tested
  - Password field suppression tested against JSDOM `input.type === "password"`; real browser autofill attribute detection (e.g., `autocomplete="new-password"`) not verified
  - No test verifies that the translate button does not overlap other page elements
- Minimal live scenario:
  - user goal: Verify that focusing a text input shows the translate overlay button, and clicking it replaces the input value
  - trigger: New scenario `bench-live/input-translation-writeback`
  - expected outcome: After focus + click translate, the input value changes to the translated text and an `input` event is fired
  - artifacts: screenshot with overlay button visible, input value before/after, DOM snapshot
  - pass/fail criteria:
    - `#astra-input-translate-host` Shadow DOM contains a visible button
    - After button click, `input.value !== initialValue`
    - At least 1 translation request with `task: "translate"` was dispatched
    - An `InputEvent` was dispatched on the input (verifiable via event listener)
- Stronger follow-up scenario:
  - user goal: Test input translation against a React-controlled input, a contenteditable div, and a password field
  - trigger: New scenario `bench-live/input-translation-field-matrix`
  - expected outcome: React input accepts the writeback; contenteditable updates; password field is suppressed
  - artifacts: screenshots for each field type, value snapshots
  - pass/fail criteria: React input shows translated value; contenteditable shows translated value; password field never shows the overlay
- Priority: P2
- Notes:
  - React-controlled input writeback is one of the highest-risk real-world failure modes that JSDOM cannot catch
  - Requires extension-loaded context for the InputTranslate component

---

### subtitle
- Deterministic bench coverage: yes (3 scenarios: translate-track-success, privacy-sanitized-context, remove-astra-tracks)
- Live coverage: none
- CI protection: yes (deterministic bench)
- Current gaps:
  - VTTCue mock (`installVttCueMock()`) does not exercise real browser TextTrack/VTTCue APIs
  - Track management (adding/removing `<track>` elements, setting track modes) tested against mock TextTrackList; real video player behavior with track switching not verified
  - Privacy sanitization tested against mock payload context; real browser URL exposure through various document properties not tested
  - No test against a real video player (YouTube, Bilibili, Netflix) where subtitle track discovery and injection must work with platform-specific DOM
- Minimal live scenario:
  - user goal: Verify that subtitle translation creates an Astra-labeled track with translated cues on a simple HTML5 video
  - trigger: New scenario `bench-live/subtitle-translate-basic`
  - expected outcome: After loading a page with a `<video>` element with VTT tracks, `translatePageSubtitles()` creates an "Astra: zh-CN" track with translated cues
  - artifacts: screenshot of video with subtitle track list, track state JSON dump
  - pass/fail criteria:
    - `video.textTracks` contains exactly 1 track with label starting with "Astra: "
    - The Astra track has the expected number of cues (matching source track cue count)
    - Source track mode is restored to its pre-translation state
    - At least 1 translation request was dispatched
- Stronger follow-up scenario:
  - user goal: Test subtitle translation on a YouTube-like page with dynamically loaded tracks and ASR captions
  - trigger: New scenario `bench-live/subtitle-platform-integration`
  - expected outcome: The platform adapter correctly discovers the active subtitle track, translates it, and the Astra track appears in the player's track selector
  - artifacts: screenshot of video player with track menu open, cue content dump, console logs
  - pass/fail criteria: Astra track cues match source track cues in count and timing; no JavaScript errors from platform adapter
- Priority: P1
- Notes:
  - Video platform adapters exist at `src/entrypoints/content/video-platforms/` (YouTube, Bilibili, Netflix)
  - The minimal scenario can use a simple HTML5 video with a VTT file; the stronger scenario requires platform-specific fixture pages
  - Real VTTCue behavior is the most critical gap

---

### site-automation
- Deterministic bench coverage: yes (4 scenarios: always-translate-initial-autostart, site-disable-stops-active-session, manual-stop-suppresses-page-restart, eligibility-reset-clears-page-suppression)
- Live coverage: none
- CI protection: yes (deterministic bench)
- Current gaps:
  - Content script bootstrap (`contentScript.main()`) tested against mock `installBenchBrowser()` with synthetic config/session; real extension bootstrap through `chrome.runtime.onMessage` and `chrome.storage.local` not tested
  - Storage change propagation tested via `browser.emitStorageChange()`; real `chrome.storage.onChanged` listener behavior not verified
  - Config transitions (enable -> disable -> re-enable) may race with real async storage reads in ways not captured by synchronous JSDOM tests
  - Float ball and UI host mounting verified via `document.getElementById()` in JSDOM; real Shadow DOM host creation in a live extension context not tested
- Minimal live scenario:
  - user goal: Verify that a site with `alwaysTranslate: true` auto-starts translation when the extension is loaded
  - trigger: New scenario `bench-live/site-automation-autostart`
  - expected outcome: After navigating to a page where the site config has `alwaysTranslate: true`, translation markers appear within 2 seconds without user interaction
  - artifacts: screenshot before (blank page), screenshot after (translated), translation state JSON dump
  - pass/fail criteria:
    - `data-astra-translation="1"` markers are present on the page
    - Translation phase is "running"
    - Float ball is mounted and visible
    - At least 1 translation request was intercepted
- Stronger follow-up scenario:
  - user goal: Test the full site automation lifecycle: autostart -> manual stop -> config change -> verify no restart -> re-enable -> verify restart
  - trigger: New scenario `bench-live/site-automation-lifecycle`
  - expected outcome: Each state transition produces the expected phase and marker count
  - artifacts: screenshots at each state, config/state JSON dumps at each transition
  - pass/fail criteria: Autostart produces markers; stop clears markers; config change does not restart; re-enable produces markers again
- Priority: P0
- Notes:
  - Requires `chromium.launchPersistentContext()` with the built extension loaded
  - This surface is tightly coupled to the extension lifecycle and real storage APIs
  - Together with page-translation, this is the most important surface for live coverage because it validates the entire content script bootstrap path

---

## Handoff

### Findings summary

1. **34 deterministic bench scenarios** cover all 10 surfaces with train/validation/holdout split discipline
2. **Live coverage exists only for page-translation** (3 source-backed Playwright scenarios + 1 smoke)
3. **9 surfaces have zero live browser-backed evaluation**
4. **No CI pipeline runs live scenarios**; they are opt-in local-only via `pnpm bench:live`
5. The live harness infrastructure (`bench-live/`) is mature: driver, runtime, evaluator, rubrics, results persistence, and artifact management are all implemented
6. The biggest architectural gap for new live scenarios is **extension-loaded browser context** -- most surfaces require the real content script running in Chrome, not just fixture HTML loaded in Playwright

### Evidence (files inspected)

Documentation:
- `/Users/ruirui/Downloads/GitHub/Astra/docs/bench-harness.md`
- `/Users/ruirui/Downloads/GitHub/Astra/docs/bench-opt.md`
- `/Users/ruirui/Downloads/GitHub/Astra/docs/anthropic-style-long-running-harness-roadmap.md`

Bench scenarios (all):
- `/Users/ruirui/Downloads/GitHub/Astra/bench/scenarios/index.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench/scenarios/page-translation.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench/scenarios/interaction-priority.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench/scenarios/frame-coordination.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench/scenarios/dynamic-content.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench/scenarios/article-extraction.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench/scenarios/hover.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench/scenarios/selection-explain.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench/scenarios/input-translation.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench/scenarios/subtitle.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench/scenarios/site-automation.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench/scenarios/helpers/page-translation.ts`

Bench evaluators (all):
- `/Users/ruirui/Downloads/GitHub/Astra/bench/evaluators/page-translation.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench/evaluators/interaction-priority.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench/evaluators/frame-coordination.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench/evaluators/dynamic-content.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench/evaluators/article-extraction.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench/evaluators/hover.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench/evaluators/selection-explain.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench/evaluators/input-translation.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench/evaluators/subtitle.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench/evaluators/site-automation.ts`

Live harness (all):
- `/Users/ruirui/Downloads/GitHub/Astra/bench-live/evaluator.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-live/runtime.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-live/driver.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-live/rubrics.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-live/entry.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-live/source-runtime.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-live/scenarios/index.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-live/scenarios/page-translation-article-basic-source.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-live/scenarios/page-translation-article-basic-source-translation-only.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-live/scenarios/page-translation-article-basic.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-live/scenarios/fixture-playwright-smoke.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-live/scenarios/helpers/page-translation.ts`

Type definitions:
- `/Users/ruirui/Downloads/GitHub/Astra/bench/types.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench/splits.json`

Product source files scanned:
- `/Users/ruirui/Downloads/GitHub/Astra/src/entrypoints/content/` (35 files including index.tsx, page-translate.ts, subtitle-translate.ts, interaction-coordination.ts, frame-context.ts, all component files, video platform adapters)
- `/Users/ruirui/Downloads/GitHub/Astra/src/utils/dom/` (5 files: extraction.ts, traversal.ts, inject.ts, clipboard.ts)

### Decisions / Recommendations

1. **P0: Build an extension-loaded Playwright context helper.** Most live scenarios need `chromium.launchPersistentContext({ args: ['--load-extension=./dist'] })`. Create a shared `withExtensionBrowserPage()` helper in `bench-live/driver.ts` alongside the existing `withLiveBrowserPage()`. This is the single highest-leverage enabler.

2. **P0: Add live site-automation autostart scenario.** This validates the entire content script bootstrap and is the foundation for all other extension-loaded live scenarios.

3. **P1: Add live scenarios for hover, subtitle, dynamic-content, and interaction-priority.** These 4 surfaces have the highest risk of JSDOM-vs-real-browser behavioral divergence.

4. **P2: Add live scenarios for article-extraction, selection-explain, and input-translation.** These are lower risk because their core logic is more purely DOM-structural, but still benefit from real CSS layout verification.

5. **Wire live scenarios into CI as an optional gate.** Add a GitHub Actions job that runs `pnpm bench:live` with a headless Chrome, gated behind a `bench-live` label or manual trigger. Make it a required check for promotion.

6. **Reuse existing evaluator contracts in live scenarios.** The deterministic evaluators (`evaluatePageTranslation`, `evaluateInteractionPriority`, etc.) should be reused as the scoring layer for live scenarios, following the pattern established in `bench-live/scenarios/helpers/page-translation.ts`. This avoids duplicating scoring logic and ensures consistency.

### Ready-for-implementation tasks

| # | Task | Files to create/modify | Expected output | Acceptance criteria |
|---|------|----------------------|----------------|-------------------|
| 1 | Extension-loaded browser helper | `bench-live/driver.ts` (modify) | New `withExtensionBrowserPage()` function | Can launch Chrome with the built extension, navigate to a page, and verify `window.__ASTRA_INJECTED__` is true |
| 2 | Live site-automation autostart | `bench-live/scenarios/site-automation-autostart.ts` (new), `bench-live/scenarios/index.ts` (modify) | Scenario that loads extension, navigates to fixture, verifies auto-start | `pnpm bench:live -- --scenario bench-live/site-automation-autostart` produces pass with screenshot + state dump |
| 3 | Live hover alt-success | `bench-live/scenarios/hover-alt-success.ts` (new) | Scenario with Alt+hover triggering overlay | Overlay Shadow DOM has visible content; position is within viewport; screenshot shows overlay |
| 4 | Live subtitle translate basic | `bench-live/scenarios/subtitle-translate-basic.ts` (new) | Scenario with HTML5 video + VTT track | Astra track created with correct cue count; source track mode restored |
| 5 | Live dynamic-content append | `bench-live/scenarios/dynamic-content-append.ts` (new) | Scenario with DOM append during active translation | New node gets translated; request count increments by 1 |
| 6 | Live interaction-priority selection | `bench-live/scenarios/interaction-priority-selection.ts` (new) | Scenario with text selection + hover suppression | Selection toolbar visible; hover overlay not visible; screenshot confirms |
| 7 | Live article-extraction docs | `bench-live/scenarios/article-extraction-docs.ts` (new) | Scenario with docs fixture in real browser | Extraction plan resolves correct root with CSS applied |
| 8 | Live input-translation writeback | `bench-live/scenarios/input-translation-writeback.ts` (new) | Scenario with input focus + translate button | Input value changes; InputEvent dispatched |
| 9 | Live selection-explain basic | `bench-live/scenarios/selection-explain-basic.ts` (new) | Scenario with selection + explain action | Explain request dispatched; result panel shows text |
| 10 | CI live gate | `.github/workflows/bench-live.yml` (new) | GitHub Actions workflow | Runs on `bench-live` label or manual dispatch; blocks promotion if any live scenario fails |

### Risks / Open Questions

1. **Extension build dependency.** Live scenarios that require `--load-extension` need a built `dist/` directory. The CI workflow must run `pnpm build` before `pnpm bench:live`. Build time adds ~30-60s to the live gate.

2. **Chrome availability in CI.** GitHub Actions ubuntu runners have Chrome installed, but the path differs from macOS. The `DEFAULT_BROWSER_CANDIDATES` in `bench-live/driver.ts` needs Linux paths added (`/usr/bin/google-chrome`, `/usr/bin/chromium-browser`).

3. **Extension context API mocking.** Live scenarios using `--load-extension` will exercise real `chrome.runtime` and `chrome.storage` APIs. The extension needs a valid config and session in storage for auto-start to trigger. Either the live harness must pre-populate storage, or the extension must handle the empty-storage bootstrap gracefully.

4. **Flakiness risk.** Browser-backed tests are inherently more flaky than JSDOM tests. The live gate should tolerate 1-2 retries and should not block deterministic bench green status.

5. **Video platform fixtures.** The stronger subtitle scenario requires platform-specific fixture pages (YouTube-like, Bilibili-like). These must be maintained separately and may break when platform DOM structures change. Consider snapshotting real platform pages as frozen fixtures.

6. **Privacy and network isolation.** Live scenarios that trigger translation requests must either mock the API at the network level (Playwright request interception) or use the bench browser mock. The source-backed approach already handles this, but extension-loaded scenarios will need a different strategy (e.g., intercepting `fetch` calls or providing a local relay mock).
