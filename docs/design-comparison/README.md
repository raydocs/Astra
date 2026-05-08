# Astra UI Redesign — Design vs Implementation

Date: 2026-05-08
Bundle: `Lnqnf_YIgD1wAylKsrxD_Q` (byte-identical to `gYdl7o94nez3lC69JwJWWw` from 2026-05-06; only `.design-canvas.state.json` differs)

This folder holds canonical screenshots of the design's four primary surfaces in both directions, plus a written audit of remaining gaps after this session's pixel-fix pass.

## Screenshots

Design canonical (rendered via `viewer.html` against the bundle's React components at native artboard size):

| Surface | Quiet (light) | Constellation (dark) |
| --- | --- | --- |
| Popup (380×620) | `design-popup-quiet.png` | `design-popup-twilight.png` |
| Onboarding (1280×800) | `design-onboarding-quiet.png` | `design-onboarding-twilight.png` |
| Settings (1280×900) | `design-settings-quiet.png` | `design-settings-twilight.png` |
| Deep Read (1280×900) | `design-deepread-quiet.png` | `design-deepread-twilight.png` |

Implementation: `impl-popup-raw.png` shows the built popup served as a static page — it hits its error boundary because `browser.tabs` etc. aren't available outside an extension host. Capturing live extension surfaces requires loading the unpacked build at `.output/chrome-mv3-dev/` in `chrome://extensions/` and screenshotting from there, or building a 100+ line mock harness that stubs the `browser.*` APIs with sample state.

## What was fixed this session

CSS pixel fixes in `src/assets/astra-extension.css`:

- Popup hero title 22→26px, subtitle 13→14px, line-height 1.18→1.15.
- Popup `.astra-popup-toggle` redrawn to design's 36×20 spec: thumb 14×14, left 2px, ink-1 fill when on, bg-page thumb when on (replacing the 44×26 / 20×20 SwiftUI-flavored toggle).
- Popup `.astra-setting-row` padding 10×12 → 12×14, min-height 50→48 to match design.
- Popup `.astra-segmented__option` padding 6×10 → 4×10; removed `box-shadow` on `[aria-pressed="true"]` (design has no shadow on selected segment).
- Popup `.astra-group-card` background: removed the 6%-white tint that lifted card surface above design spec — now uses `--astra-style-bg-surface` directly.
- Onboarding headline clamp 52→56px max, line-height 1.06→1.05, added `letter-spacing: -0.025em`.
- Onboarding preview title 28→26px.
- Onboarding preview footer dot color: `--astra-brand` → `--astra-style-accent`.
- Settings `.astra-section-subheading`: now serif italic 18px (design uses italic serif for sub-headings).
- Settings sync status dot 8→6px.
- Settings search placeholder color: undefined `--astra-text-hint` → `--astra-style-text-hint`.
- Sticky note shadow stack: `8px 10px 22px -10px` → `6px 10px 18px -4px` (matches design).
- Sticky note title weight 600→500.

TSX fixes:

- Popup primary button icon: globe → `IconLanguages` (the design's `<IconLanguages>`) at `src/entrypoints/popup/App.tsx`.
- Popup Review CTA "Start" eyebrow → real accent pill (`.astra-popup-review-cta__pill`, accent-soft bg + accent text + arrow icon) at `PopupQuietReaderSections.tsx`.

Tests: 118/118 pass.

## Known remaining gaps (not addressed this turn)

These are all "L" (large) rewrites that materially change UX and need explicit go-ahead:

1. **Deep Read marginalia column layout** — design has a 3-column layout (article center + marginalia right + saved-words rail). Implementation currently has a 2-column grid; translation lives in vocabulary/review flows, not as marginalia inline with paragraphs. `DeepReadApp.tsx:760`.

2. **Sticky notes inline with paragraphs** — design renders sticky notes inside the marginalia column aligned to their referenced paragraph. Implementation renders them as a floating sidebar stack (`.astra-deep-read-sticky-stack`), decoupled from paragraph layout. `DeepReadApp.tsx:1021–1036`.

3. **Onboarding interactive style preview** — design's right pane re-renders when the user picks Plain/Underline/Highlight on the left. Implementation's preview is static. Adding this requires a `readingStyle` state prop wired to `OnboardingPreview` and conditional rendering. `OnboardingApp.tsx:193–250`.

4. **Onboarding reading-style step** — design has a dedicated step with 3 paper-card preview tiles for the style picker. Implementation's flow is Welcome → Languages → Workflow → Ready (no style step). Adding it changes the step count and copy.

5. **Deep Read topbar mode toggle + Save & finish** — design's topbar has a segmented Bilingual/Source/Translated toggle and a primary Save button. Implementation's topbar is minimal. `DeepReadApp.tsx:703–723`.

6. **Sticky note "Keep" button** — design's sticky footer has Keep + Dismiss; implementation only has Dismiss. Adding Keep requires a save-to-library handler. `DeepReadApp.tsx:160`.

If you want me to start on any of these, point me at one and I'll plan it out before touching code.

## How the design screenshots were produced

`viewer.html` (in the extracted bundle dir) imports the design's same React components and renders one frame at native size based on `?surface=…&direction=…`. Playwright navigates to each combination and captures full-page PNGs.

To regenerate:

```bash
cd /tmp/astra-design3/astra/project
python3 -m http.server 8765
# then drive Playwright (or your browser) at viewer.html?surface=popup&direction=quiet etc.
```
