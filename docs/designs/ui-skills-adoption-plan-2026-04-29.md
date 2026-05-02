# UI Skills Adoption Plan for Astra

**Date:** 2026-04-29  
**Baseline Reference:** [docs/analysis/ui-design-baseline-audit-2026-04-24.md](../analysis/ui-design-baseline-audit-2026-04-24.md) (scored **3.5/10**)  
**Catalog Evaluated:** [UI Skills](https://www.ui-skills.com/skills/) by [ibelick/ui-skills](https://github.com/ibelick/ui-skills) + Anthropic registry  
**Architecture:** React (extension surfaces: inline CSSProperties → migrating to CSS classes) + CSS design system (web companion)

---

## Executive Summary

Since the baseline audit (April 24), Astra has already shipped a **773-line `astra-extension.css`** with design tokens, focus-visible rings, and 20+ interactive utility classes — addressing the #1 critical accessibility gap (keyboard focus indicators) and establishing a shared token system. The inline `styles.ts` now references CSS custom properties.

This plan selects **8 skills** from the UI Skills catalog, maps each to specific Astra files, and proposes a 3-phase rollout. The goal is to move the UI score from **3.5/10 → 7.0+/10** within 2 months.

---

## 1. Skills Selected

From the [UI Skills catalog](https://www.ui-skills.com/skills/) and its [GitHub source](https://github.com/ibelick/ui-skills), 8 skills are recommended. They are ordered by impact-to-effort ratio for Astra's specific situation.

| # | Skill | Source | Why Selected | Relevance to Astra |
|---|-------|--------|-------------|-------------------|
| 1 | **[fixing-accessibility](https://www.ui-skills.com/skills/fixing-accessibility/)** | Core | Astra has critical a11y gaps: unlabeled controls, keyboard-inaccessible flashcards, missing ARIA on progress bars, contrast failures | ★★★ Direct match |
| 2 | **[baseline-ui](https://www.ui-skills.com/skills/baseline-ui/)** | Core | Enforces typography scale, animation timing, z-index discipline, component accessibility patterns | ★★★ Needs adaptation (Tailwind → CSS tokens) |
| 3 | **[fixing-motion-performance](https://www.ui-skills.com/skills/fixing-motion-performance/)** | Core | Astra has zero CSS transitions today; when adding motion, this prevents jank from day one | ★★☆ Preventive |
| 4 | **[interaction-design](https://www.ui-skills.com/skills/interaction-design/)** | Registry | Astra has zero hover states, zero micro-interactions, zero transition feedback | ★★★ Direct match |
| 5 | **[frontend-design](https://www.ui-skills.com/skills/anthropics/frontend-design/)** | Anthropic | Anti-generic design guidance: typography pairing, bold color commitment, spatial composition | ★★☆ Strategic (web companion redesign) |
| 6 | **[interface-design](https://www.ui-skills.com/skills/interface-design/)** | Registry | Audit + upgrade path for premium visual quality: depth, spacing systems, elevation | ★★☆ Strategic |
| 7 | **[fixing-metadata](https://www.ui-skills.com/skills/fixing-metadata/)** | Core | Web companion + reader pages need proper `<title>`, OG tags, and structured data for sharing | ★☆☆ Quick win |
| 8 | **Design Tokens Unification** (custom, derived from baseline-ui + frontend-design) | Composite | Bridge extension tokens (`--astra-*`) and web tokens (`--bg-primary`, `--accent-blue`) | ★★★ Prerequisite |

### Skills Evaluated but Not Selected

| Skill | Reason Deferred |
|-------|----------------|
| Tailwind-specific rules in baseline-ui | Astra doesn't use Tailwind; CSS-token equivalents already exist in `astra-extension.css` |
| motion/react library rules | Extension surfaces use zero animation libraries today; adding one is out of scope for Phase 1 |
| Slidev / VitePress / Turborepo skills | Build/docs tooling — orthogonal to UI quality |

---

## 2. Current State Assessment (Post-Foundation)

Before mapping skills to files, here's what has changed since the baseline audit:

### Already Done ✅
| Item | Evidence |
|------|----------|
| Shared design tokens | `src/assets/astra-extension.css` — 90+ CSS custom properties for color, spacing, radii, shadows, type scale |
| Focus-visible ring | Global `:focus-visible { box-shadow: var(--astra-focus-ring) }` — fixes #1 critical a11y gap |
| Interactive utility classes | `.astra-btn-primary/secondary/danger/ghost/link/accent/info`, `.astra-input`, `.astra-card`, `.astra-tab`, `.astra-chip`, `.astra-nav-item`, `.astra-option-card`, etc. |
| Hover + active states | All utility classes include `:hover`, `:active`, `:disabled` states |
| Brand color unified | `--astra-brand: #6366f1` (indigo) as single source of truth |
| Type scale standardized | 7 stops: `--astra-text-xs` (11px) through `--astra-text-2xl` (28px) |
| Radius scale | 5 stops: `--astra-radius-sm` (6px) through `--astra-radius-pill` (999px) |
| Screen-reader utility | `.astra-sr-only` class available |

### Still Outstanding 🔴
| Gap | Severity | Related Skill |
|-----|----------|--------------|
| Inline styles still dominate actual component code | High | baseline-ui, interface-design |
| Web companion tokens (`--bg-*`, `--accent-*`) completely separate from extension tokens (`--astra-*`) | High | Design Tokens Unification |
| No dark mode in extension surfaces | Medium | frontend-design, interface-design |
| `<label>` not associated with form controls (`htmlFor`/`id`) | High | fixing-accessibility |
| Flashcard `<div onClick>` — not keyboard accessible | High | fixing-accessibility |
| Progress bars missing `role="progressbar"`, `aria-valuenow/max` | Medium | fixing-accessibility |
| `#94a3b8` contrast failures for non-decorative text | Medium | fixing-accessibility |
| No `aria-live` regions for status/translation updates | Medium | fixing-accessibility |
| Zero CSS transitions/animations on any extension surface | Medium | interaction-design, fixing-motion-performance |
| Monolithic files (App.tsx 2033 lines, OptionsApp.tsx 2412 lines, web app.tsx 4400 lines) | Medium | interface-design (architecture) |
| Metadata missing on web companion (no OG tags, no structured data) | Low | fixing-metadata |
| Hardcoded English strings bypass `t()` | Low | — (i18n, not covered by UI Skills) |

---

## 3. Skill → File Mapping

### Skill 1: fixing-accessibility

**Scope:** All extension surfaces + web companion

| Priority | Issue | File(s) | Fix |
|----------|-------|---------|-----|
| **Critical** | `<label>` without `htmlFor` | `OptionsApp.tsx`, `OnboardingApp.tsx`, `GlobalSettingsSection.tsx`, `SimpleControls.tsx` | Add unique `id` to each `<input>`/`<select>`, add matching `htmlFor` to `<label>` |
| **Critical** | Flashcard `<div onClick>` — no keyboard access | `ReviewMode.tsx` | Replace with `<button>` or add `role="button"` + `tabIndex={0}` + `onKeyDown` |
| **Critical** | Drop zones without labels | `PdfReaderApp.tsx`, `EpubReaderApp.tsx`, `SubtitleReaderApp.tsx` | Add `<label>` wrapping the hidden `<input type="file">` with `aria-label` |
| **High** | Progress bars missing ARIA | `QuotaBar.tsx`, `ReviewStats.tsx` | Add `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax` |
| **High** | No `aria-live` regions | `TranslationStatusCard.tsx`, `App.tsx` (status messages) | Wrap status areas with `aria-live="polite"` |
| **Medium** | Contrast: `#94a3b8` on white (3.4:1) | All surfaces using `color: "#94a3b8"` for non-decorative text | Replace with `var(--astra-text-hint)` (`#64748b`, 5.4:1) from token system |
| **Medium** | `window.confirm()` for destructive actions | `OptionsApp.tsx` (device revocation) | Replace with in-page `AlertDialog` pattern |

### Skill 2: baseline-ui (adapted for CSS tokens)

**Adaptation required:** Astra uses CSS custom properties, not Tailwind. Map baseline-ui rules to the existing `astra-extension.css` token system.

| Rule | Astra Equivalent | Files Affected |
|------|-----------------|---------------|
| "Typography: use `text-balance` for headings" | Add `text-wrap: balance` to `.astra-section-heading` | `astra-extension.css` |
| "Typography: use `text-pretty` for body" | Add `text-wrap: pretty` to `body` rule | `astra-extension.css` |
| "Typography: use `tabular-nums` for data" | Add `.astra-tabular { font-variant-numeric: tabular-nums }` | `astra-extension.css`, then apply to `ReviewStats.tsx`, `QuotaBar.tsx`, `UsageInsightsCard.tsx` |
| "Animation: NEVER exceed 200ms for interaction feedback" | Already partially covered (`--astra-transition-fast: 100ms`, `--astra-transition-normal: 180ms`) | Verify new additions comply |
| "Animation: respect `prefers-reduced-motion`" | Add `@media (prefers-reduced-motion: reduce)` block | `astra-extension.css` |
| "Layout: fixed z-index scale" | Define `--astra-z-dropdown: 100`, `--astra-z-modal: 200`, `--astra-z-tooltip: 300`, `--astra-z-toast: 400` | `astra-extension.css` |
| "Components: use accessible primitives" | Audit `<div onClick>` patterns → replace with `<button>` | `ReviewMode.tsx`, `SelectionToolbar.tsx`, `DeepReadApp.tsx` |
| "No gradients/glows as primary affordances" | Audit DeepRead hero card gradient usage | `DeepReadApp.tsx` |

### Skill 3: fixing-motion-performance

**Scope:** Preventive — apply when adding transitions/animations to extension surfaces.

| Rule | Implementation | Files |
|------|---------------|-------|
| "Only animate compositor props (transform, opacity)" | All `.astra-btn-*` transitions already use `background`, `border-color`, `box-shadow` (paint props) — these are acceptable for small UI elements per the skill's exception | `astra-extension.css` ✅ compliant |
| "Batch DOM measurements (FLIP pattern)" | Apply if adding entrance/exit animations to vocabulary cards or study panels | Future: `VocabularyApp.tsx`, `ReviewMode.tsx` |
| "Use scroll/view timelines for scroll-linked motion" | Apply if adding scroll-triggered effects to reader surfaces | Future: `DeepReadApp.tsx`, `EpubReaderApp.tsx` |
| "Keep blur under 8px, one-time duration" | Apply to web companion's `backdrop-filter: blur(40px)` — currently static (no animation), so compliant | `web/src/styles.css` ✅ compliant |

### Skill 4: interaction-design

**Scope:** Add micro-interactions to extension surfaces that currently have zero feedback.

| Interaction Type | Where | Implementation |
|-----------------|-------|---------------|
| **Hover feedback** | All extension buttons | ✅ Already covered by `.astra-btn-*` classes — but inline-style buttons not yet migrated need conversion |
| **State transitions** | Popup tab switching, options nav | Add `transition: all var(--astra-transition-normal)` to tab/nav items | 
| **Loading states** | Translation progress, study card loading | Add skeleton/pulse animation keyframe to `astra-extension.css` |
| **Save confirmation** | Options page — currently ambiguous | Add transient "Saved ✓" feedback with `aria-live` + fade-out |
| **Card flip** | Vocabulary flashcard reveal | Add `transform: rotateY(180deg)` with `perspective` for card-flip effect |
| **Toast/notification** | Error states, success messages | Add `.astra-toast` component class with slide-in animation |

**Timing guidelines from the skill:**
- Micro-feedback (hover, tap): 100–150ms → matches `--astra-transition-fast: 100ms`
- Small transitions (tab switch, save): 200–300ms → add `--astra-transition-medium: 250ms`
- Medium transitions (page/card): 300–500ms → add `--astra-transition-slow: 400ms`

### Skill 5: frontend-design

**Scope:** Strategic redesign guidance for web companion + unified visual identity.

| Principle | Current State | Recommendation |
|-----------|--------------|----------------|
| "Choose distinctive fonts" | Extension: `system-ui` stack; Web: `-apple-system` stack | Web companion is already intentionally Apple-native; extension should keep system font for performance. **No change needed** — system fonts are the right choice for a utility extension |
| "Commit to a cohesive color palette" | Extension: indigo `#6366f1`; Web: blue `#0A84FF`; Popup hero: orange `#ea580c` | Unify: **indigo is primary**, orange is **accent for learning/CTA**, blue is web-only variant. Document in brand guide |
| "Dominant colors with sharp accents" | Currently 5+ orange variants in popup alone | Reduce to: `--astra-accent-warm: #ea580c`, `--astra-accent-warm-hover: #c2410c` — two values only |
| "Use CSS variables for consistency" | ✅ Already implemented in `astra-extension.css` | Continue migration from inline hex → token references |
| "Empty states need clear next action" | Drop zones show `"PDF"` at fontSize 48 | Replace with illustration + descriptive text + file-select button |

### Skill 6: interface-design

**Scope:** Elevation system, depth, spacing rhythm.

| Recommendation | Implementation | Files |
|---------------|---------------|-------|
| Elevation/depth hierarchy | Define shadow scale (already exists as `--astra-shadow-sm/md/lg`) — ensure consistent usage | Audit all inline `boxShadow` values in popup/reader components |
| Spacing rhythm | Token system exists — enforce usage by linting inline `margin`/`padding` px values | All extension components |
| Container width rationalization | 7 different `maxWidth` values → standardize to 3: `--astra-width-narrow: 500px`, `--astra-width-medium: 720px`, `--astra-width-wide: 1100px` | `astra-extension.css` + reader/options/vocab surfaces |
| Section-level card decomposition | Monolithic files → extract visual sections into components | `OptionsApp.tsx` → `OptionsNav.tsx` + `OptionsSection.tsx`; `App.tsx` → further popup component extraction |

### Skill 7: fixing-metadata

**Scope:** Web companion only (extension pages are internal).

| Issue | File | Fix |
|-------|------|-----|
| No `<title>` per route | `web/src/app.tsx` | Add `document.title = ...` in route change handler |
| No OG tags | `web/public/index.html` (or equivalent) | Add `<meta property="og:title">`, `og:description`, `og:image` |
| No structured data | `web/src/app.tsx` | Add JSON-LD `WebApplication` schema |
| Favicon/manifest | `web/public/` | Verify presence of `manifest.json` + icon set |

### Skill 8: Design Tokens Unification (custom)

**Goal:** Bridge extension (`--astra-*`) and web (`--bg-*`, `--accent-*`) token namespaces.

| Step | Detail |
|------|--------|
| **Map tokens** | Create a crosswalk document: `--astra-bg-primary` ↔ `--bg-secondary` (web uses pure black `#000` as primary, extension uses slate `#f8fafc`) |
| **Shared semantic layer** | Define a shared set: `--astra-surface`, `--astra-on-surface`, `--astra-accent`, `--astra-accent-on` that both CSS files resolve differently |
| **Dark mode tokens** | Add `@media (prefers-color-scheme: dark)` block to `astra-extension.css` that remaps `--astra-bg-primary` → `#1C1C1E`, `--astra-text-primary` → `#FFFFFF`, etc. — **modeled after web companion's existing dark palette** |
| **Shared file** | Extract semantic token definitions into `src/assets/astra-tokens.css` imported by both `astra-extension.css` and `web/src/styles.css` |

---

## 4. Staged Rollout Plan

### Phase 1: Quick Wins (Week 1) 🟢

**Goal:** Fix critical accessibility + establish motion foundation. No visual changes.

| Task | Skill | Effort | Files |
|------|-------|--------|-------|
| **1.1** Add `htmlFor`/`id` to all label-input pairs | fixing-accessibility | 2h | `OptionsApp.tsx`, `OnboardingApp.tsx`, `GlobalSettingsSection.tsx`, `SimpleControls.tsx`, `SiteSettingsSection.tsx` |
| **1.2** Make flashcard keyboard-accessible | fixing-accessibility | 1h | `ReviewMode.tsx` |
| **1.3** Add ARIA to progress bars | fixing-accessibility | 1h | `QuotaBar.tsx`, `ReviewStats.tsx` |
| **1.4** Add `aria-live` to status regions | fixing-accessibility | 1h | `TranslationStatusCard.tsx`, `App.tsx` |
| **1.5** Replace `#94a3b8` non-decorative text with `var(--astra-text-hint)` | fixing-accessibility | 2h | All inline-style files with hardcoded `#94a3b8` |
| **1.6** Add `prefers-reduced-motion` block | baseline-ui | 30m | `astra-extension.css` |
| **1.7** Add `text-wrap: balance/pretty` | baseline-ui | 15m | `astra-extension.css` |
| **1.8** Add z-index scale tokens | baseline-ui | 30m | `astra-extension.css` |
| **1.9** Add web metadata (title, OG tags) | fixing-metadata | 1h | `web/public/index.html`, `web/src/app.tsx` |
| **1.10** Add `.astra-tabular` class for numeric data | baseline-ui | 30m | `astra-extension.css`, `QuotaBar.tsx`, `ReviewStats.tsx`, `UsageInsightsCard.tsx` |

**Estimated effort:** ~10 hours  
**Risk:** Very low — all changes are additive or attribute additions

### Phase 2: Interactive Polish (Weeks 2–4) 🟡

**Goal:** Add micro-interactions, migrate remaining inline styles to CSS classes, unify containers.

| Task | Skill | Effort | Files |
|------|-------|--------|-------|
| **2.1** Add transition timing tokens | interaction-design | 30m | `astra-extension.css` (`--astra-transition-medium`, `--astra-transition-slow`) |
| **2.2** Add skeleton/pulse animation keyframe | interaction-design | 1h | `astra-extension.css` |
| **2.3** Add `.astra-toast` slide-in component | interaction-design | 2h | `astra-extension.css` + new `Toast.tsx` in `src/components/` |
| **2.4** Replace `window.confirm()` with in-page dialog | fixing-accessibility + interaction-design | 3h | `OptionsApp.tsx` → new `ConfirmDialog.tsx` |
| **2.5** Save confirmation feedback for Options | interaction-design | 2h | `OptionsApp.tsx` |
| **2.6** Flashcard flip animation | interaction-design + fixing-motion-performance | 2h | `ReviewMode.tsx` |
| **2.7** Standardize container widths | interface-design | 2h | All reader/options/vocab surfaces |
| **2.8** Migrate remaining inline button/input styles to CSS classes | baseline-ui | 6h | All extension surfaces with inline `style={{...}}` on interactive elements |
| **2.9** Reduce orange variants to 2 tokens | frontend-design | 2h | `App.tsx`, `DeepReadApp.tsx`, `LearningClosurePrimerCard.tsx`, `StudySection.tsx` |
| **2.10** Empty state redesign for drop zones | frontend-design | 3h | `PdfReaderApp.tsx`, `EpubReaderApp.tsx`, `SubtitleReaderApp.tsx` |
| **2.11** Label file drop zones properly | fixing-accessibility | 1h | Same drop zone files |

**Estimated effort:** ~25 hours  
**Risk:** Medium — CSS class migration touches many files; needs visual regression check

### Phase 3: Deeper Redesign (Weeks 5–8) 🔴

**Goal:** Dark mode, token unification, component decomposition, web companion refresh.

| Task | Skill | Effort | Files |
|------|-------|--------|-------|
| **3.1** Extract shared token file | Design Tokens Unification | 4h | New `src/assets/astra-tokens.css`, update `astra-extension.css` + `web/src/styles.css` |
| **3.2** Dark mode for extension surfaces | Design Tokens Unification + frontend-design | 8h | `astra-extension.css` (`@media prefers-color-scheme: dark`), audit all inline colors |
| **3.3** Decompose `OptionsApp.tsx` (2412 lines) | interface-design | 6h | Split into `OptionsNav.tsx`, `OptionsGeneralSection.tsx`, `OptionsProviderSection.tsx`, `OptionsAdvancedSection.tsx` |
| **3.4** Decompose `web/src/app.tsx` (4400 lines) | interface-design | 8h | Extract page components into separate files under `web/src/pages/` |
| **3.5** Content overlay a11y (Shadow DOM surfaces) | fixing-accessibility | 4h | `SelectionToolbar.tsx`, overlay injection system |
| **3.6** Web companion visual refresh | frontend-design + interface-design | 12h | `web/src/styles.css`, `web/src/app.tsx` |
| **3.7** Responsive breakpoints for extension surfaces | baseline-ui | 4h | `astra-extension.css` + reader surfaces |
| **3.8** iOS debug panel gating | fixing-accessibility | 2h | `OnboardingApp.tsx` — hide behind `__DEV__` flag |

**Estimated effort:** ~48 hours  
**Risk:** High — dark mode requires full color audit; component decomposition is a refactor

---

## 5. Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **CSS class migration breaks existing layout** | Medium | High | Visual regression screenshots before/after; migrate one surface at a time; keep deprecated style objects as fallback |
| **Dark mode introduces contrast regressions** | Medium | Medium | Use WCAG contrast checker on every dark-mode token pair; test with automated a11y tools |
| **Component decomposition breaks state management** | Low | High | Extract UI components only (pure presentational); keep state in parent — lift state up pattern |
| **Shadow DOM overlays can't use shared CSS** | Certain | Low | Content overlays (SelectionToolbar, HoverTranslate) inject their own styles; they'll need separate dark-mode token injection — documented as known scope |
| **Web companion token unification disrupts existing web styles** | Medium | Medium | Use CSS custom property fallbacks: `color: var(--astra-text-primary, var(--label-primary))` during migration |
| **Performance: CSS file size increase** | Low | Low | `astra-extension.css` at 773 lines is ~15KB uncompressed; even doubling is negligible for a local extension |
| **Tailwind-specific baseline-ui rules don't translate** | Certain | Low | Already adapted: map Tailwind utilities to CSS token equivalents (done in this document) |

---

## 6. Success Metrics

### Primary Metrics

| Metric | Baseline (April 24) | Target (Phase 1) | Target (Phase 3) | How to Measure |
|--------|---------------------|-------------------|-------------------|----------------|
| **Accessibility Score** | 2/10 | 5/10 | 7/10 | Automated: `axe-core` audit on all extension surfaces; Manual: keyboard-only navigation test |
| **Design Consistency Score** | 2/10 | 4/10 | 7/10 | Count of hardcoded hex colors / px values in component files (target: <20 across all files) |
| **Interaction Clarity Score** | 4/10 | 5/10 | 7/10 | Checklist: every interactive element has hover + focus + active + disabled states |
| **Cross-Surface Token Coverage** | 0% | 60% | 90% | `grep -c 'var(--astra-' src/` ÷ total style declarations in extension code |

### Quantitative Indicators

| Indicator | How to Compute | Current | Target |
|-----------|---------------|---------|--------|
| **Inline hex color count** | `grep -rn '#[0-9a-fA-F]\{6\}' src/entrypoints/ --include='*.tsx' \| wc -l` | ~200+ | <30 |
| **Hardcoded px in inline styles** | Count `fontSize:`, `padding:`, `margin:`, `borderRadius:` with raw px values | ~150+ | <20 |
| **axe-core violations** | Run `npx axe-core` on rendered popup, options, vocabulary, readers | Unknown (estimate: 40+) | <5 critical, <10 total |
| **Components in `src/components/`** | Count files | 1 (`ErrorBoundary.tsx`) | 6+ (+ Toast, ConfirmDialog, ProgressBar, Button, Card, Input) |
| **Token usage rate** | CSS var references ÷ (CSS var references + hardcoded values) | ~30% (styles.ts migrated, components not) | >85% |

### Qualitative Checkpoints

- [ ] A keyboard-only user can complete: open popup → change settings → review flashcards → navigate vocabulary
- [ ] A screen reader announces: translation status changes, save confirmation, error states
- [ ] All extension surfaces render correctly in dark mode (OS-level toggle)
- [ ] Web companion and extension popup feel like the same product (shared color identity)
- [ ] No interactive element exists without hover + focus feedback

---

## 7. Recommended Skill Installation

For teams using Claude Code or similar AI-assisted development, install the skills as guardrails:

```bash
# Core skills (from ibelick/ui-skills)
claude skills add --url https://www.ui-skills.com/skills/fixing-accessibility/
claude skills add --url https://www.ui-skills.com/skills/baseline-ui/
claude skills add --url https://www.ui-skills.com/skills/fixing-motion-performance/
claude skills add --url https://www.ui-skills.com/skills/fixing-metadata/

# Registry skills
claude skills add --url https://www.ui-skills.com/skills/interaction-design/
claude skills add --url https://www.ui-skills.com/skills/frontend-design/
claude skills add --url https://www.ui-skills.com/skills/interface-design/

# Anthropic's official frontend-design (superset)
claude skills add --url https://github.com/anthropics/skills/blob/main/skills/frontend-design/
```

### Skill Activation Strategy

| Phase | Active Skills | Rationale |
|-------|--------------|-----------|
| Phase 1 | fixing-accessibility, baseline-ui (adapted), fixing-metadata | Focus on correctness, not aesthetics |
| Phase 2 | + interaction-design, fixing-motion-performance | Add motion safely with performance guardrails |
| Phase 3 | + frontend-design, interface-design | Strategic visual redesign with anti-generic guidance |

---

## 8. Decision Log

| Decision | Rationale | Alternative Considered |
|----------|-----------|----------------------|
| Keep `system-ui` font stack for extension | Extension is a utility tool; system fonts ensure native feel and fast rendering | Distinctive display font per frontend-design skill — rejected as inappropriate for this context |
| Indigo (`#6366f1`) as unified primary, not blue or orange | Already adopted in `astra-extension.css`; most reader surfaces already use it; web companion blue is intentionally Apple-native (different product surface) | Orange — rejected as it's used inconsistently and feels more like an accent |
| CSS custom properties over Tailwind migration | Astra is a browser extension with Shadow DOM constraints; Tailwind requires build pipeline changes and complicates content script injection | Tailwind — rejected as over-engineering for this architecture |
| Dark mode via `@media (prefers-color-scheme)` not class toggle | Extension surfaces have no settings UI for theme; OS-level detection is the right default | Manual toggle — could add later in Options |
| Decompose components before visual redesign | Monolithic files make targeted styling changes risky; decomposition de-risks Phase 3 | Style first, decompose later — rejected because 2400-line files are unmaintainable |

---

## Appendix: File Impact Summary

Files ranked by total touch count across all phases:

| File | Phase 1 | Phase 2 | Phase 3 | Total Touches |
|------|---------|---------|---------|---------------|
| `src/assets/astra-extension.css` | 5 | 4 | 2 | **11** |
| `src/entrypoints/options/OptionsApp.tsx` | 2 | 2 | 1 | **5** |
| `src/entrypoints/popup/App.tsx` | 2 | 1 | 0 | **3** |
| `src/entrypoints/vocabulary/ReviewMode.tsx` | 1 | 1 | 0 | **2** |
| `src/entrypoints/vocabulary/ReviewStats.tsx` | 1 | 0 | 0 | **1** |
| `src/entrypoints/popup/components/QuotaBar.tsx` | 2 | 0 | 0 | **2** |
| `src/entrypoints/popup/components/TranslationStatusCard.tsx` | 1 | 0 | 0 | **1** |
| `src/entrypoints/popup/components/UsageInsightsCard.tsx` | 1 | 0 | 0 | **1** |
| `src/entrypoints/onboarding/OnboardingApp.tsx` | 1 | 0 | 1 | **2** |
| `src/entrypoints/deep-read/DeepReadApp.tsx` | 0 | 1 | 0 | **1** |
| `src/entrypoints/popup/components/GlobalSettingsSection.tsx` | 1 | 0 | 0 | **1** |
| `src/entrypoints/popup/components/SimpleControls.tsx` | 1 | 0 | 0 | **1** |
| `src/entrypoints/popup/components/SiteSettingsSection.tsx` | 1 | 0 | 0 | **1** |
| `src/entrypoints/popup/components/LearningClosurePrimerCard.tsx` | 0 | 1 | 0 | **1** |
| `src/entrypoints/popup/components/StudySection.tsx` | 0 | 1 | 0 | **1** |
| `src/entrypoints/pdf-reader/PdfReaderApp.tsx` | 0 | 2 | 0 | **2** |
| `src/entrypoints/epub-reader/EpubReaderApp.tsx` | 0 | 2 | 0 | **2** |
| `src/entrypoints/subtitle-reader/SubtitleReaderApp.tsx` | 0 | 2 | 0 | **2** |
| `src/entrypoints/content/components/SelectionToolbar.tsx` | 0 | 0 | 1 | **1** |
| `web/src/app.tsx` | 1 | 0 | 1 | **2** |
| `web/src/styles.css` | 0 | 0 | 2 | **2** |
| New: `src/components/Toast.tsx` | 0 | 1 | 0 | **1** |
| New: `src/components/ConfirmDialog.tsx` | 0 | 1 | 0 | **1** |
| New: `src/assets/astra-tokens.css` | 0 | 0 | 1 | **1** |

---

*Report generated 2026-04-29. Next review checkpoint: end of Phase 1 (target: 2026-05-06).*
