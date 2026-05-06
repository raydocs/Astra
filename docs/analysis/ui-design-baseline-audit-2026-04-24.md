# Astra UI Design Baseline Audit

**Date:** 2026-04-24  
**Scope:** All user-facing surfaces — extension popup, options, onboarding, deep-read, vocabulary, subtitle-reader, pdf-reader, epub-reader, content overlays, and web companion  
**Overall Score: 3.5 / 10**

**Errata (2026-05):** The web companion now imports **`src/assets/astra-style1-tokens.css`** (same Style 1 palette as the extension CSS layer). UI **defaults to light** (`data-astra-theme="light"`). New web CSS should use **`--accent-primary`**; **`--accent-blue`** is a legacy alias only. Rows below remain an April 2026 snapshot except where the Web companion row was refreshed.

---

## Executive Summary

Astra's UI currently suffers from **three competing design languages** across its surfaces, **limited shared design tokens** (extension vs web historically diverged), and **severe accessibility gaps**. The extension side uses heavy inline `React.CSSProperties` with hardcoded hex values in many surfaces, making hover/focus states, theme switching, and responsive breakpoints harder without JS workarounds. The web companion uses CSS classes; as of **May 2026** its colors track **Style 1** alongside the extension, defaulting to **Quiet Reader (light)** rather than an isolated “Apple dark-only” palette.

---

## 1. Design System Fragmentation

### Three Distinct Visual Languages

| Surface Group | Brand Color | Background | Approach |
|---|---|---|---|
| **Popup** (App.tsx, components/*) | Orange `#ea580c` / `#9a3412` | Warm gradient `#fff7ed → #fffaf3 → #f8fafc` | Inline CSSProperties |
| **Readers & Vocabulary** (deep-read, epub, pdf, subtitle, vocabulary, onboarding) | Indigo `#6366f1` | White/slate `#f8fafc → #fff` | Inline CSSProperties |
| **Web companion** (`web/src/app.tsx`) | **`--accent-primary`** → Style 1 `--astra-style-accent-primary` | Default **light** Quiet Reader paper **`#f4efe6`** (`--astra-style-bg-app`) | CSS classes via `styles.css` + shared **`astra-style1-tokens.css`** |
| **Content overlays** (SelectionToolbar, HoverTranslate, FloatBall) | Indigo `#6366f1` | White cards with indigo-tinted borders | Inline + `overlayScale.ts` helper |
| **Onboarding** | Indigo `#6366f1` but branded as standalone | Slate-to-indigo gradient `#f8fafc → #eef2ff` | Inline CSSProperties |
| **Deep-read** | Orange `#ea580c` (hero) + slate body | Orange-warm gradient shell with dark hero card | Inline CSSProperties, unique "magazine" style |

**Key file references:**
- `src/assets/astra-style1-tokens.css` — **shared** Style 1 palette (imported by `astra-extension.css` and `web/src/styles.css`)
- `src/entrypoints/popup/components/styles.ts` — 82 lines, 8 shared style objects (only used within popup)
- `web/src/styles.css` — web layout/components + aliases (`--bg-primary`, `--accent-primary`, …)
- `src/entrypoints/content/components/overlayScale.ts` — 41 lines, scaling utility (only used by content overlays)
- No shared `theme.ts` file — semantics live in CSS custom properties

### Brand Color Chaos

The brand color `#6366f1` (indigo) appears **30+ times** across reader files, but the popup uses a completely different orange family (`#ea580c`, `#c2410c`, `#9a3412`, `#7c2d12`, `#92400e`, `#78350f` — at least **5 distinct brown/orange variants**). Deep-read mixes both: orange hero card with indigo-style body content.

---

## 2. Styling Architecture

### Extension Surfaces: 100% Inline Styles

Every extension surface uses `React.CSSProperties` objects — no CSS files, no CSS modules, no Tailwind, no CSS-in-JS library.

**Consequences:**
- **No `:hover` states** — buttons have zero visual feedback on hover
- **No `:focus-visible` rings** — keyboard navigation is completely invisible
- **No `@media` queries** — responsive behavior limited to `flexWrap: "wrap"` and `repeat(auto-fit, ...)`
- **No dark mode** — light-only, no `prefers-color-scheme` support
- **No CSS transitions/animations** — everything is static (except onboarding dot-indicator which has `transition` in inline style, but this only works for width/bg changes, not for enter/exit)

**File-level inconsistencies:**
- `VocabularyApp.tsx` and `ReviewStats.tsx` define style objects *inside* the component function → new allocations every render
- Other files correctly use module-level `const` style objects
- `OptionsApp.tsx` defines `textareaStyle` at line 1182, after it's referenced earlier (works but confusing)

### Web Companion: CSS aligned with Style 1

`web/src/styles.css` imports **`src/assets/astra-style1-tokens.css`** (same Quiet Reader / Constellation palette as the extension). It defines web-local aliases (`--bg-primary`, **`--accent-primary`**, `--separator`, …). **`--accent-blue`** is a deprecated alias for `--accent-primary` only.

**Defaults:** **Light** theme (`data-astra-theme="light"` on `<html>`, `color-scheme: light`). Optional dark uses `[data-astra-theme="dark"]` against the same token file (Twilight palette).

Class-level layout (cards, sidebar glassmorphism, grids) remains web-specific; **semantic colors** track Style 1 so docs and marketing should not describe the web app as a separate “Apple-only blue” system.

---

## 3. Typography & Spacing

### No Type Scale

Font sizes across the codebase: **9, 10, 11, 12, 13, 14, 15, 16, 18, 24, 26, 28, 34px** — 13 distinct sizes with no defined scale or rationale.

| Surface | Title size | Body size | Caption size |
|---|---|---|---|
| Popup | 16px | 13-14px | 11-12px |
| Deep-read | 34px (h1), 26px (focus) | 14-15px | 11-12px |
| Options | 18px | 14px | 12-13px |
| Vocabulary | 18px | 14px | 12-13px |
| Onboarding | 28px | 15-16px | 12px |
| Web | 2rem (32px) | 0.9-1rem | 0.7-0.85rem |

### Border Radius Inconsistency

Values range ad-hoc: **4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 999px** across surfaces. No standardized scale.

### Container Width Inconsistency

| Surface | `maxWidth` |
|---|---|
| Popup | 400px |
| Vocabulary | 720px |
| Subtitle reader | 1000px |
| Epub reader | ~1100px (sidebar + content) |
| PDF reader | 800px |
| Deep-read | 1180px |
| Options | 720px (content area) |
| Onboarding | 500px |
| Web | 1200px |

---

## 4. Accessibility Audit

### Critical Issues

| Issue | Affected surfaces | File(s) |
|---|---|---|
| **No keyboard focus indicators** — `outline: "none"` or simply absent | All extension surfaces | Popup `inputStyle`, Options `inputStyle`, Vocabulary search input |
| **Labels not associated with form controls** — `<label>` without `htmlFor`, `<select>/<input>` without `id` | Options, Onboarding | `OptionsApp.tsx`, `OnboardingApp.tsx` |
| **Flashcard uses `<div>` with `onClick`** — not keyboard-accessible via native semantics | Vocabulary review | `ReviewMode.tsx` |
| **Drop zones lack proper file input labels** — `<input type="file">` hidden with no associated label | PDF, EPUB, Subtitle readers | `PdfReaderApp.tsx`, `EpubReaderApp.tsx`, `SubtitleReaderApp.tsx` |

### Moderate Issues

| Issue | Details |
|---|---|
| **Color contrast failures** | `#94a3b8` on white ≈ 3.4:1 ratio (WCAG AA requires 4.5:1). Used extensively for hints, metadata, muted text |
| **No `aria-live` regions** | Translation progress, status messages, error states not announced to screen readers |
| **Progress bars lack ARIA** | `QuotaBar` and study progress bars missing `role="progressbar"`, `aria-valuenow/max` |
| **`window.confirm()` for destructive actions** | Device revocation in Options uses native modal, blocks thread |
| **iOS debug panel exposed to users** | Onboarding shows raw bridge status, session IDs, and replay buttons to non-developer users |
| **Color-only status indicators** | Diagnostics connection status dot relies on color alone |

### What Works

- `<nav>` and `<main>` HTML5 semantics in Options
- `aria-expanded` on expandable sections
- `aria-label` on study loop cards
- Descriptive button text (no icon-only buttons without labels)

---

## 5. Component Architecture Issues

### Monolithic Files

| File | Lines | UI sections inside |
|---|---|---|
| `web/src/app.tsx` | 4,400 | 9 route pages + all state + all handlers |
| `src/entrypoints/options/OptionsApp.tsx` | ~2,412 | 8 settings sections + all styles |
| `src/entrypoints/popup/App.tsx` | 2,033 | Core popup + all handlers + inline styles |
| `src/entrypoints/deep-read/DeepReadApp.tsx` | 1,082 | Full deep-read page + 30+ style objects |
| `src/entrypoints/content/components/SelectionToolbar.tsx` | 928 | Toolbar + explain card + grammar guide |

### Shared Component Library: 1 File

`src/components/` contains only `ErrorBoundary.tsx` (52 lines). No shared Button, Card, Input, Modal, or Layout components exist. Every surface re-implements its own buttons, cards, inputs, and layout from scratch.

### Shared UI Utilities: 1 File

`src/utils/ui/` contains only `useViewportProfile.ts` (73 lines) — a viewport/pointer detection hook. It is available but **not actually imported** by any reader or popup surface that would benefit from it (no responsive breakpoints are implemented on extension surfaces anyway).

---

## 6. Interaction Design Issues

| Issue | Surface | Impact |
|---|---|---|
| **No hover feedback on buttons** | All extension | Users get no visual response when mousing over interactive elements |
| **Save flow ambiguity** — global save button with muted "Unsaved changes" indicator | Options | Users can navigate away from dirty sections without warning |
| **Deep-read toolbar overload** — 8 inline buttons in a single row | Deep-read | Cluttered, hard to scan on narrower viewports |
| **iOS debug panel in production** | Onboarding | Bridge status, session replay, raw event data shown to all users |
| **Drop zone placeholder text** — "PDF", "EPUB", "FILE" at fontSize 48 | Readers | Looks unfinished vs. proper empty-state illustration |
| **`details/summary` accordion** — used for progressive disclosure but unstyled | Popup | Browser default disclosure triangle, inconsistent with rest of UI |

---

## 7. i18n / Hardcoded English

Numerous strings bypass the `t()` i18n function:
- `"queued X · in-flight X · failed X"` — `TranslationStatusCard.tsx`
- `"More tools & diagnostics"` — `App.tsx`
- `"Open in Astra App"`, `"Replay last handoff"` — `App.tsx`
- `"Focus"`, `"Reading view"`, `"Reading workspace"` — `DeepReadApp.tsx`
- All `NAV_ITEMS` labels in web app — `app.tsx`
- Feature descriptions in onboarding — `OnboardingApp.tsx`

---

## 8. Scoring Rubric

| Criterion | Weight | Score | Rationale |
|---|---|---|---|
| **Visual Hierarchy** | 20% | 5/10 | Deep-read has strong hierarchy; popup/options are flat and dense |
| **Cross-Surface Consistency** | 25% | 2/10 | Three competing color systems, no shared tokens or components |
| **Spacing & Typography** | 15% | 4/10 | 13 font sizes, 12 border-radius values, no scale |
| **Interaction Clarity** | 15% | 4/10 | No hover/focus states, toolbar overload, ambiguous save flow |
| **Accessibility** | 15% | 2/10 | No focus rings, unlabeled controls, contrast failures, no ARIA |
| **Code Architecture** | 10% | 3/10 | 1 shared component, monolithic files, no design token system |

**Weighted Score: 3.15 → 3.5 / 10** (rounded up for functional completeness — everything works, it just doesn't look or feel cohesive)

---

## 9. Priority Recommendations (For Future Iterations)

1. **Create a shared design token file** (`src/utils/ui/theme.ts`) — single source for colors, spacing, radii, typography scale
2. **Unify brand color** — pick one (indigo `#6366f1` or orange `#ea580c`) and carry it consistently
3. **Extract shared components** — Button, Card, Input, Badge at minimum
4. **Add CSS file for extension surfaces** — even a minimal global CSS enables `:hover`, `:focus-visible`, media queries, and dark mode
5. **Fix accessibility critical path** — focus rings, label associations, ARIA roles on custom widgets
6. **Decompose monolithic files** — App.tsx (2033 lines) and OptionsApp.tsx (2412 lines) need breakdown into focused modules

---

## Appendix: Files Audited

```
src/entrypoints/popup/App.tsx                            (2,033 lines)
src/entrypoints/popup/components/styles.ts               (82 lines)
src/entrypoints/popup/components/AuthSection.tsx          (202 lines)
src/entrypoints/popup/components/GlobalSettingsSection.tsx (250 lines)
src/entrypoints/popup/components/QuotaBar.tsx             (51 lines)
src/entrypoints/popup/components/SimpleControls.tsx       (83 lines)
src/entrypoints/popup/components/SiteSettingsSection.tsx  (597 lines)
src/entrypoints/popup/components/StudySection.tsx         (892 lines)
src/entrypoints/popup/components/TranslationStatusCard.tsx (83 lines)
src/entrypoints/popup/components/UsageInsightsCard.tsx    (168 lines)
src/entrypoints/options/OptionsApp.tsx                    (~2,412 lines)
src/entrypoints/onboarding/OnboardingApp.tsx              (696 lines)
src/entrypoints/deep-read/DeepReadApp.tsx                 (1,082 lines)
src/entrypoints/vocabulary/VocabularyApp.tsx               (audited via probe)
src/entrypoints/vocabulary/ReviewMode.tsx                  (audited via probe)
src/entrypoints/vocabulary/ReviewStats.tsx                 (audited via probe)
src/entrypoints/subtitle-reader/SubtitleReaderApp.tsx      (audited via probe)
src/entrypoints/epub-reader/EpubReaderApp.tsx              (audited via probe)
src/entrypoints/pdf-reader/PdfReaderApp.tsx                (audited via probe)
src/entrypoints/content/components/SelectionToolbar.tsx   (928 lines)
src/entrypoints/content/components/overlayScale.ts        (41 lines)
src/components/ErrorBoundary.tsx                          (52 lines)
src/utils/ui/useViewportProfile.ts                        (73 lines)
web/src/app.tsx                                           (4,400 lines)
web/src/styles.css                                        (825 lines)
```
