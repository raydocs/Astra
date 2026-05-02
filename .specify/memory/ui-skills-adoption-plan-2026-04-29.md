# Session Checkpoint: UI Skills Adoption Plan

**Date:** 2026-04-29  
**Branch:** main  
**Task:** Evaluate UI Skills catalog (ui-skills.com) for Astra and produce staged adoption plan  
**Deliverable:** `docs/designs/ui-skills-adoption-plan-2026-04-29.md`

---

## Key Decisions

1. **8 skills selected** from UI Skills catalog (4 core + 3 registry + 1 composite):
   - fixing-accessibility, baseline-ui (adapted), fixing-motion-performance, interaction-design, frontend-design, interface-design, fixing-metadata, Design Tokens Unification (custom)

2. **Tailwind-specific rules adapted to CSS tokens** — Astra uses CSS custom properties, not Tailwind. baseline-ui rules mapped to `astra-extension.css` equivalents.

3. **System font kept for extension** — frontend-design skill recommends "distinctive fonts", but system-ui is the right choice for a utility browser extension. Web companion Apple font stack also stays.

4. **Indigo (#6366f1) confirmed as unified primary** — orange is accent for learning/CTA only, web blue (#0A84FF) is intentionally Apple-native for web companion.

5. **Dark mode via @media (prefers-color-scheme)** not class toggle — extension has no settings UI for theme; OS-level detection is the right default.

6. **Component decomposition before visual redesign** — monolithic files (OptionsApp 2412 lines, web app.tsx 4400 lines) must be split before Phase 3 styling.

---

## Current State (as of 2026-04-29)

### Already Shipped (since baseline audit 2026-04-24)
- `src/assets/astra-extension.css` — 773 lines, 90+ CSS custom properties
- Score progression: 3.5 → 9.3 (Iteration #7)
- Focus-visible ring: `:focus-visible { box-shadow: var(--astra-focus-ring) }`
- 20+ utility classes: `.astra-btn-primary/secondary/danger/ghost/link/accent/info`, `.astra-input`, `.astra-card`, `.astra-tab`, `.astra-chip`, `.astra-nav-item`, `.astra-option-card`, `.astra-sentence-btn`, `.astra-eyebrow`, `.astra-cta-primary/secondary`, etc.
- `styles.ts` now references CSS custom properties (deprecated inline style objects)

### Still Outstanding
- Inline styles still dominate actual component code (migration ongoing)
- Web companion tokens (`--bg-*`, `--accent-*`) completely separate from extension tokens (`--astra-*`)
- No dark mode in extension surfaces
- `<label>` not associated with form controls (htmlFor/id)
- Flashcard `<div onClick>` — not keyboard accessible
- Progress bars missing ARIA roles
- Zero CSS transitions/animations on extension surfaces
- Monolithic files not yet decomposed

---

## 3-Phase Rollout Plan

| Phase | Timeline | Effort | Focus |
|-------|----------|--------|-------|
| Phase 1: Quick Wins | Week 1 | ~10h | A11y fixes (labels, ARIA, contrast), prefers-reduced-motion, z-index scale, metadata |
| Phase 2: Interactive Polish | Weeks 2-4 | ~25h | Micro-interactions, inline→class migration, toast/dialog components, empty states |
| Phase 3: Deeper Redesign | Weeks 5-8 | ~48h | Dark mode, token unification, component decomposition, web companion refresh |

**Target:** 3.5/10 (baseline) → 7.0+/10 (design quality rubric from baseline audit)

---

## UI Skills Catalog Reference

### Core Skills (ibelick/ui-skills repo)
- `baseline-ui` — typography scale, animation timing ≤200ms, z-index discipline, prefers-reduced-motion, tabular-nums for data
- `fixing-accessibility` — "every interactive control must have an accessible name", native HTML over custom ARIA, aria-describedby for errors, focus trap in modals
- `fixing-metadata` — SEO: titles, descriptions, OG tags, canonical URLs, JSON-LD
- `fixing-motion-performance` — "only animate compositor props (transform, opacity)", batch DOM reads (FLIP), scroll/view timelines, blur under 8px

### Registry Skills  
- `interaction-design` — timing: 100-150ms micro-feedback, 200-300ms small transitions, 300-500ms medium; spring animations, prefers-reduced-motion
- `frontend-design` — "choose fonts that are beautiful, unique, and interesting", "dominant colors with sharp accents outperform timid, evenly-distributed palettes", anti-generic aesthetics
- `interface-design` — audit/upgrade to premium visual quality, elevation/depth, spacing systems

### Skills Deferred
- Tailwind-specific rules (Astra doesn't use Tailwind)
- motion/react library rules (no animation library in scope)
- Slidev/VitePress/Turborepo (build tooling, not UI)

---

## Key Files

| File | Role | Lines |
|------|------|-------|
| `src/assets/astra-extension.css` | Shared CSS foundation for all extension surfaces | 773 |
| `src/entrypoints/popup/components/styles.ts` | Deprecated inline style objects (now references CSS vars) | 81 |
| `web/src/styles.css` | Web companion CSS design system | 825 |
| `web/src/app.tsx` | Monolithic web companion | 4400 |
| `src/entrypoints/options/OptionsApp.tsx` | Monolithic options page | ~2412 |
| `src/entrypoints/popup/App.tsx` | Popup main | 2033 |
| `docs/designs/ui-skills-adoption-plan-2026-04-29.md` | This session's deliverable | ~400 |
| `docs/analysis/ui-design-baseline-audit-2026-04-24.md` | Baseline audit (scored 3.5/10) | 238 |

---

## Token Architecture

### Extension Tokens (astra-extension.css)
```css
--astra-brand: #6366f1;
--astra-text-primary: #0f172a;   /* 19.5:1 on white */
--astra-text-hint: #64748b;     /* 5.4:1 — replaces unsafe #94a3b8 */
--astra-transition-fast: 100ms ease;
--astra-transition-normal: 180ms ease;
--astra-focus-ring: 0 0 0 3px rgba(99, 102, 241, 0.30);
```

### Web Tokens (styles.css) — separate namespace
```css
--bg-primary: #000000;
--accent-blue: #0A84FF;
--label-primary: #FFFFFF;
--label-secondary: rgba(235, 235, 245, 0.6);
```

### Planned: Unified semantic layer
```css
/* src/assets/astra-tokens.css — shared by both */
--astra-surface, --astra-on-surface, --astra-accent, --astra-accent-on
```

---

## Success Metrics

| Metric | Baseline | Phase 1 Target | Phase 3 Target |
|--------|----------|----------------|----------------|
| Accessibility Score | 2/10 | 5/10 | 7/10 |
| Design Consistency | 2/10 | 4/10 | 7/10 |
| Inline hex color count | ~200+ | — | <30 |
| axe-core violations | ~40+ est. | — | <5 critical |
| Components in src/components/ | 1 | — | 6+ |
| Token usage rate | ~30% | — | >85% |
