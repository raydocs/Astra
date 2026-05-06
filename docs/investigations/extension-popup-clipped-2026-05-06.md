# Investigation: Extension popup clipped / not opening correctly

## Summary
The popup is rendering, but its top-level warm-paper shell is height-capped by viewport-relative CSS and made internally scrollable before Chrome expands the browser-action popup. The primary culprit is `.astra-popup-shell` in `src/assets/astra-extension.css:1722-1730`, especially `max-height: min(560px, calc(100vh - 24px))`, `overflow-y: auto`, and `min-height: 0` applied directly to `PopupShell`.

## Symptoms
- User-provided screenshot shows the Astra toolbar action popup is positioned under the browser toolbar but vertically clipped.
- Visible popup content includes a warm-paper rounded panel, partial `Astra` title, and top-right controls.
- Most of the popup content/body is not visible, making the extension effectively unusable from the toolbar popup.
- This appears distinct from the previous live-bench `popup-deep-read-proof` provider/config failure, because the visible problem is popup viewport/layout sizing rather than explain routing.

## Background / Prior Research

### Git archaeology (explore agent)
- Primary suspect commit: `b0a3c8d` (`2026-05-06 05:59`) `Add Astra UI redesign preview and tokens`.
- Suspect change: `src/assets/astra-extension.css`, `.astra-popup-shell` gained `min-height: 0`, `max-height: min(560px, calc(100vh - 24px))`, `overflow-x: hidden`, and `overflow-y: auto`.
- Proposed mechanism: Chrome extension popups initially measure `100vh` as the current small popup window height near the toolbar. `calc(100vh - 24px)` can therefore resolve to only a few pixels, and `overflow-y:auto` clips content rather than allowing the popup body to expand; Chrome never grows the popup to intrinsic content height.
- Supporting changes: `src/entrypoints/popup/index.html` gained `data-astra-theme="light" data-astra="quiet"`; `PopupShell` combines `astra-quiet-shell astra-popup-shell`; popup imports global `src/assets/astra-extension.css`.
- Fix direction from archaeology: remove shell-level viewport-relative `max-height`/scrolling, or move scrolling to an inner region after anchoring popup document dimensions.

## Investigator Findings
<!-- Pair investigator will append structured analysis here. -->

### 2026-05-06 - Render chain and sizing root cause check

**Scope / constraint:** Read-only source investigation; the only write in this pass is this appended report section.

#### Popup render chain verified
- `src/entrypoints/popup/index.html:2-11` is the WXT/browser-action popup document. It sets `data-astra-theme="light" data-astra="quiet"`, contains a bare `<div id="root"></div>`, and loads `./main.tsx`.
- `src/entrypoints/popup/main.tsx:1-7` imports `@/assets/astra-extension.css`, React, `ErrorBoundary`, and `App`; `src/entrypoints/popup/main.tsx:60-66` mounts `<App />` into `#root` inside `<React.StrictMode>` and `<ErrorBoundary>`.
- `src/entrypoints/popup/App.tsx:120` imports `PopupShell`; `src/entrypoints/popup/App.tsx:2109-2121` returns `<PopupShell>` with the visible `PopupHeader` title `Astra`; `src/entrypoints/popup/App.tsx:2735-2741` closes the full body/footer before `</PopupShell>`.
- `src/entrypoints/popup/components/PopupDesignPrimitives.tsx:5-15` defines `PopupShell` as the top-level rendered `<div className="astra-quiet-shell astra-popup-shell" data-astra="quiet" data-astra-theme="light">`.

#### CSS evidence
- The global popup stylesheet is imported at `src/entrypoints/popup/main.tsx:2`.
- `src/assets/astra-extension.css:157-166` only resets `body` margin/font/background/line-height; there are no popup-specific `html`, `body`, or `#root` height/overflow anchors in the entry document.
- `.astra-quiet-shell` at `src/assets/astra-extension.css:1708-1720` provides the warm-paper panel frame: `width: 100%`, `max-width: 400px`, `min-width: 280px`, padding, border, radius, shadow, and background.
- `.astra-popup-shell` at `src/assets/astra-extension.css:1722-1730` is applied directly to `PopupShell` and currently sets `display:flex`, `flex-direction:column`, `gap`, `min-height:0`, `max-height:min(560px, calc(100vh - 24px))`, `overflow-x:hidden`, and `overflow-y:auto`.
- This matches the screenshot symptom: the warm-paper shell and top header render, but the shell itself becomes the scroll/clipping container before Chrome has expanded the action popup to the intended intrinsic height.

#### Git / generated artifact evidence
- `git blame -L 1708,1730 -- src/assets/astra-extension.css` attributes `.astra-popup-shell` flex/gap to `cf7da7b` and the suspect `min-height`, viewport-relative `max-height`, and overflow declarations at `src/assets/astra-extension.css:1726-1729` to `b0a3c8d` (`2026-05-06 05:59`, `Add Astra UI redesign preview and tokens`).
- `git show b0a3c8d -- src/assets/astra-extension.css` confirms that commit added exactly these shell-level declarations: `min-height: 0`, `max-height: min(560px, calc(100vh - 24px))`, `overflow-x: hidden`, `overflow-y: auto`.
- `git show b0a3c8d -- src/entrypoints/popup/index.html` shows only the `<html>` data attributes were added there; no document height/overflow sizing was added.
- Built Chrome artifact `.output/chrome-mv3/manifest.json:1` contains `"action":{"default_title":"Astra","default_popup":"popup.html"}`, so WXT/manifest action wiring points to the expected popup.
- Built Chrome artifact `.output/chrome-mv3/popup.html:2,8,33` contains the same quiet/light `<html>` attributes, loads `/chunks/popup-B9XJVziK.js`, and contains `<div id="root"></div>`.
- Built Chrome CSS `.output/chrome-mv3/assets/ErrorBoundary-Bgf3Q6Gj.css` contains the compiled `.astra-popup-shell` rule with the same effective constraints: `min-height:0`, `max-height:min(560px,100vh - 24px)`, `display:flex`, and `overflow:hidden auto`. This confirms the current build ships the suspect shell-level viewport/overflow behavior.

#### Ruled out / less likely
- **Manifest/WXT wiring:** Less likely. `src/entrypoints/popup/index.html:7` declares `manifest.type` as `browser_action`, and built manifests point `action.default_popup` to `popup.html`.
- **React crash:** Less likely. The screenshot shows the normal `PopupHeader` title/controls from `App.tsx:2109-2119`, not the `PopupErrorFallback` from `main.tsx:9-57`.
- **Lower sections:** Less likely as root cause. `App.tsx:2179-2741` renders many lower sections, but the visible failure occurs at the top-level shell boundary before those sections matter; if a lower card were too tall, inner content should scroll only after the popup gets a normal viewport.
- **Auth/provider state:** Less likely. `refreshAll()` at `App.tsx:670-834` hydrates config/auth/provider/account state asynchronously and surfaces status text, but it does not gate rendering of `<PopupShell>`/`<PopupHeader>`. The header renders before or regardless of provider/auth readiness.

#### Conclusion
The working hypothesis is strongly supported: the root clipping trigger is the top-level `.astra-popup-shell` height/overflow rule applied directly to `PopupShell`. In a Chrome extension action popup, `100vh` can resolve against the initially tiny popup viewport under the toolbar; `max-height: calc(100vh - 24px)` plus `overflow-y:auto` can then make the top-level shell clamp to that tiny height, preventing Chrome from expanding the popup to the content's intrinsic height.

#### Recommended fix locations
1. Primary fix: `src/assets/astra-extension.css:1722-1730`. Remove top-level viewport-relative height/scroll from `.astra-popup-shell` (at minimum remove `max-height:min(560px, calc(100vh - 24px))`, `overflow-y:auto`, and likely `min-height:0`) so Chrome can size the action popup from intrinsic content.
2. If a max popup height is still required, move scrolling to an inner body region instead of the top-level shell. Candidate component boundary: `src/entrypoints/popup/components/PopupDesignPrimitives.tsx:5-15` could grow a shell/body split, and `src/entrypoints/popup/App.tsx:2109-2741` could wrap the post-header content in that inner scroll body.
3. Optional anchoring if needed after removing shell clamp: add explicit popup document sizing rules near the popup primitives in `src/assets/astra-extension.css` for `html[data-astra="quiet"] body` / `#root` or a popup-specific root class, but avoid viewport-relative `max-height` on the first measured popup container.
4. Verification target after fix: rebuild (`pnpm build`) and confirm `.output/chrome-mv3/assets/*.css` no longer contains top-level `.astra-popup-shell{...max-height...overflow...}` while `.output/chrome-mv3/manifest.json` still points `action.default_popup` at `popup.html`.

## Investigation Log

### Phase 1 - Initial assessment
**Hypothesis:** Recent warm-paper popup layout changes may have introduced viewport/height/min-height/overflow positioning that exceeds or collapses the browser action popup viewport, causing the popup body to be clipped.
**Findings:** Screenshot evidence points to a rendered popup document whose top-level container is visible but whose vertical viewport is too short or whose content is offset/clipped.
**Evidence:** User-provided screenshot in this conversation, showing only a narrow band of the popup under the toolbar.
**Conclusion:** Investigate popup entrypoint sizing/CSS, App/StudySection warm-paper layout, WXT popup HTML/CSS, and recent branch changes touching popup dimensions or body overflow.

## Root Cause
The browser action popup is clipped because the first rendered popup container is also the scroll/height-constrained container. The render chain is:

`src/entrypoints/popup/index.html:2-11` → `src/entrypoints/popup/main.tsx:1-7,60-66` → `src/entrypoints/popup/App.tsx:2109-2121` → `src/entrypoints/popup/components/PopupDesignPrimitives.tsx:5-15` → `src/assets/astra-extension.css:1708-1730`.

`PopupShell` applies `className="astra-quiet-shell astra-popup-shell"` directly to the top-level popup `<div>` (`src/entrypoints/popup/components/PopupDesignPrimitives.tsx:5-15`). `.astra-quiet-shell` draws the visible warm-paper frame (`src/assets/astra-extension.css:1708-1720`), while `.astra-popup-shell` caps the same element with `min-height: 0`, `max-height: min(560px, calc(100vh - 24px))`, and `overflow-y: auto` (`src/assets/astra-extension.css:1722-1730`).

In a Chrome extension action popup, `100vh` can initially resolve against the small toolbar-attached popup viewport before Chrome expands the window to intrinsic document height. Because the top-level shell says it is no taller than `100vh - 24px` and should scroll internally, Chrome sees a tiny scroll container rather than full intrinsic content, so the popup remains a thin clipped panel. This matches the screenshot: the shell frame and `Astra` header render, but the body is clipped.

Contributing factors: `index.html` has only a bare `#root` and no `html/body/#root` height or width anchors (`src/entrypoints/popup/index.html:2-11`), and `min-height: 0` removes lower-bound expansion pressure on the first measured shell. These are secondary; the root trigger is viewport-relative max-height plus vertical overflow on the top-level shell.

### Eliminated hypotheses
- **Manifest/WXT wiring:** unlikely. The built manifest points `action.default_popup` to `popup.html`, and source `index.html` declares the browser-action popup entrypoint.
- **React crash:** unlikely. The screenshot shows the real `PopupHeader` title and controls from `App.tsx`, not the `PopupErrorFallback` defined in `main.tsx`.
- **Lower popup sections:** not primary. Large sections such as `StudySection` increase content height, but they do not explain why the top-level panel is clipped before a normal popup viewport exists.
- **Auth/provider state:** not primary. Auth/provider state can change labels/buttons but does not control the top-level shell height; the header renders regardless.

## Recommendations
1. **Preferred minimal fix** in `src/assets/astra-extension.css:1722-1730`: remove `max-height: min(560px, calc(100vh - 24px))`, `overflow-y: auto`, and likely `min-height: 0` from `.astra-popup-shell`. Keep `display:flex`, `flex-direction:column`, `gap`, and optionally `overflow-x:hidden`.
2. If a popup height cap is still needed, move scrolling into an inner body region rather than the top-level shell. Candidate locations: split `PopupShell` in `src/entrypoints/popup/components/PopupDesignPrimitives.tsx:5-15` and add `.astra-popup-shell__body` CSS near `src/assets/astra-extension.css:1722-1730` with fixed `max-height: 560px` and `overflow-y:auto`.
3. Optionally add stable popup width/root anchoring near the popup primitive CSS, e.g. for `html[data-astra="quiet"] body` and `#root`, but avoid viewport-relative height on the first popup container.
4. Verification after fix: run `pnpm build`, inspect generated `.output/chrome-mv3/assets/*.css` to ensure top-level `.astra-popup-shell` no longer contains viewport-relative max-height/vertical scrolling, and manually open the toolbar popup in Chrome/Chromium.

## Preventive Measures
- Avoid `100vh`/viewport-relative vertical sizing on the top-level element of browser action popups.
- Put scroll behavior on an inner content region only after the outer popup frame has stable intrinsic dimensions.
- Add a live/manual visual smoke check for popup dimensions after warm-paper/token CSS changes.
- For future popup layout changes, verify both source CSS and generated `.output/chrome-mv3` CSS because extension popups are sensitive to compiled global styles.
