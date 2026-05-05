# UI Redesign Sessions — Memory Checkpoint
**Saved:** 2026-04-25  **Branch:** main  **Project:** Astra

---

## Ongoing Optimization: UI Design Quality Score

| # | Score | Delta | Key Change |
|---|-------|-------|-----------|
| baseline | 3.5 | — | No shared tokens; 3 competing design languages |
| 1 | 4.8 | +1.3 | `src/assets/astra-extension.css` — 140-line foundation, 50+ tokens, global focus ring |
| 2 | 5.8 | +1.0 | Options + Onboarding interactive class migration (.astra-btn-*, .astra-input, .astra-card) |
| 3 | 6.5 | +0.7 | Reader surfaces + Vocabulary token pass (see details below) |
| 4 | 8.0 | +1.5 | Interactive-state + a11y + full class adoption (see details below) |
| 5 | 8.6 | +0.6 | Dead-const cleanup + heading/nav/select/chip class migration (see details below) |

**Target:** ≥ 8.5/10 ✅ **Reached 8.6.** Remaining potential: `learningActionButtonStyle` (#1d4ed8 blue — no token), `ctaPrimaryButtonStyle` in DeepRead CTA card, popup StudySection orange accent, `currentPageLoopStyle` blue (#eff6ff/#bfdbfe).

---

## Design System: `src/assets/astra-extension.css`

### Key Token Values (for future reference)
```css
--astra-brand:           #6366f1;
--astra-brand-hover:     #4f46e5;
--astra-brand-active:    #4338ca;
--astra-brand-muted:     rgba(99, 102, 241, 0.08);
--astra-brand-border:    rgba(99, 102, 241, 0.25);
--astra-danger:          #dc2626;
--astra-danger-bg:       #fef2f2;
--astra-success:         #16a34a;
--astra-warning:         #d97706;
--astra-bg-primary:      #f8fafc;
--astra-bg-card:         #ffffff;
--astra-bg-hover:        #f1f5f9;
--astra-border:          #e2e8f0;
--astra-border-strong:   #cbd5e1;
--astra-text-primary:    #0f172a;
--astra-text-secondary:  #475569;
--astra-text-muted:      #64748b;
--astra-text-decorative: #94a3b8;
--astra-text-on-brand:   #ffffff;
--astra-text-xs:   11px;   --astra-text-sm:   13px;
--astra-text-base: 14px;   --astra-text-md:   16px;
--astra-radius-sm: 6px;    --astra-radius-md: 10px;
--astra-radius-lg: 14px;   --astra-radius-pill: 999px;
--astra-space-2: 8px;      --astra-space-3: 12px;
--astra-space-4: 16px;
--astra-shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
--astra-focus-ring: 0 0 0 3px rgba(99,102,241,0.30);
--astra-transition-fast: 100ms ease;
```

### Utility Classes Available
- `.astra-btn-primary` — indigo fill, hover/active/disabled states
- `.astra-btn-secondary` — transparent + brand border/color
- `.astra-btn-danger` — red fill
- `.astra-input` — block, 100% width, focus ring, border transitions
- `.astra-card` — white bg, border, radius-lg, shadow-sm, padding-4
- `.astra-sr-only` — screen-reader only visually-hidden

**Added in Iteration #5:**
- `.astra-section-heading` — `font-size: var(--astra-text-xl)` (22px), weight 700, `margin: 0 0 24px 0`; replaces all `sectionTitle` inline objects
- `.astra-section-subheading` — `font-size: var(--astra-text-md)` (16px), weight 600, `margin: 0 0 12px 0`; replaces `h3` inline objects
- `.astra-nav-item-mobile` — pill-tab for horizontal sticky nav (mobile OptionsApp); `[aria-current="page"]` → brand fill
- `.astra-btn-info` — pill toggle for info/expand buttons (border-strong, radius-pill, 2px 8px, weight 700)

**Added in Iteration #4:**
- `.astra-tab` — underline-style tab button; `[aria-selected="true"]` activates brand underline
- `.astra-chip` — small filter/sort pill; `[aria-pressed="true"]` activates brand fill
- `.astra-btn-ghost-danger` — translucent red inline delete action (3px 10px padding)
- `.astra-btn-danger-sm` — solid small red confirm-delete button (3px 10px padding)
- `.astra-btn-ghost` — neutral ghost cancel/dismiss button (muted bg, secondary text)
- `.astra-nav-item` — sidebar nav button; `[aria-current="page"]` activates brand + inset shadow
- `.astra-option-card` — selectable card button; `[aria-pressed="true"]` activates brand border 2px
- `.astra-review-answer-wrong` — flex-1 max-w-200 danger-bg answer button
- `.astra-review-answer-right` — flex-1 max-w-200 success-bg answer button

---

## Architectural Decisions

### Popup Orange Accent — Intentional, Do Not Migrate
The popup (`src/entrypoints/popup/`) uses an orange/amber theme (#fff7ed background, #c2410c/#9a3412 text, #fed7aa borders). This is **explicitly preserved** as the popup accent. Decisions:
- Main translate/stop buttons: already use `.astra-btn-primary/secondary` (Iteration #2)
- Footer link buttons, sign-out button, header settings button: keep orange `#c2410c`
- `StudySection.tsx` `actionButtonStyle` (orange): keep as popup accent
- Popup container background gradient: `linear-gradient(180deg, #fff7ed 0%, #fffaf3 42%, #f8fafc 100%)` — keep

### Content Overlay Exclusion
Content overlays (SelectionToolbar / HoverTranslate / FloatBall / InputTranslate) mount into Shadow DOM / host pages. They are **excluded** from the shared CSS system and have their own injection. Do not touch.

### @deprecated Pattern for Style Objects
Style objects superseded by utility classes get `/** @deprecated Prefer className="..." */` JSDoc. See `src/entrypoints/popup/components/styles.ts`.

---

## Iteration #3 — Specific Changes Made (2026-04-25)

### Files Modified
| File | Changes |
|------|---------|
| `src/entrypoints/pdf-reader/PdfReaderApp.tsx` | `#6366f1`→`var(--astra-brand)` (h1, translating span, loading); `#cbd5e1`→`var(--astra-border-strong)` (dropzone); `#94a3b8`→`var(--astra-text-decorative)` (pageHeaderStyle); border-left on translationTextStyle |
| `src/entrypoints/epub-reader/EpubReaderApp.tsx` | `#6366f1`→`var(--astra-brand)` (h1, TOC header, TOC active item, loading, translating); `#cbd5e1`→`var(--astra-border-strong)` (dropzone) |
| `src/entrypoints/vocabulary/VocabularyApp.tsx` | `countBadgeStyle`: brand tokens; `tabStyle`: brand+border tokens; `tabBarStyle`: border token; tag filter buttons: full brand/border token pass; entry tag chips: brand tokens; daily stats info button: `var(--astra-border-strong/bg-card/text-secondary/radius-pill/text-xs)`; note textarea + tags input → `className="astra-input"`; linked reading item border → brand tokens; reading article summary card → `var(--astra-bg-primary/border)` |
| `src/entrypoints/vocabulary/ReviewMode.tsx` | `hostnameTagStyle.background`: `#f1f5f9`→`var(--astra-bg-hover)`; `dailyProgressRowStyle.color`: `#64748b`→`var(--astra-text-muted)`; resume-reading + open-deep-read inline buttons: `rgba(99,102,241,0.08)`→`var(--astra-brand-muted)`, `#4338ca`→`var(--astra-brand-active)`, border→`var(--astra-brand-border)` |
| `src/entrypoints/popup/components/TranslationStatusCard.tsx` | Progress text `#64748b`→`var(--astra-text-muted)` |
| `src/entrypoints/popup/components/GlobalSettingsSection.tsx` | Test-connection button border `#e2e8f0`→`var(--astra-border)`; font-size hint `#94a3b8`→`var(--astra-text-decorative)` |
| `src/entrypoints/popup/App.tsx` | Status indicator dot: `#16a34a`→`var(--astra-success)` |

### Already Migrated (Iterations #1 + #2, do not re-touch)
- `src/entrypoints/options/OptionsApp.tsx` — fully migrated
- `src/entrypoints/onboarding/OnboardingApp.tsx` — fully migrated
- `src/entrypoints/popup/components/AuthSection.tsx` — fully migrated
- `src/entrypoints/popup/components/SimpleControls.tsx` — all selects `.astra-input`
- `src/entrypoints/popup/components/SiteSettingsSection.tsx` — all inputs/selects/buttons migrated
- `src/entrypoints/deep-read/DeepReadApp.tsx` — primary buttons migrated (secondary/primary classes); CTA card buttons are contextual (on orange gradient), keep inline
- `src/entrypoints/subtitle-reader/SubtitleReaderApp.tsx` — all buttons migrated

### Partial / Not Yet Migrated (future iterations)
- `StudySection.tsx` `actionButtonStyle` — orange popup accent, intentional
- `DeepReadApp.tsx` `ctaPrimaryButtonStyle/ctaSecondaryButtonStyle` — on colored CTA card, intentional
- `VocabularyApp.tsx` `learningActionButtonStyle` — blue (#bfdbfe/#eff6ff/#1d4ed8), no direct token
- `ReviewMode.tsx` `currentPageLoopStyle` — blue (#eff6ff/#bfdbfe), no token
- Snippet "show/hide" links `#2563eb` — blue-600, no direct token
- VocabularyApp reading action chips (Resume / In progress / Saved / Archive / sortButtonStyle(false)) — still using `sortButtonStyle(false)`; left for next pass
- OptionsApp `tabBarStyle`/`learningActionButtonStyle` — no class yet

---

## Iteration #4 — Specific Changes Made (2026-04-25)

### Files Modified
| File | Changes |
|------|--------|
| `src/assets/astra-extension.css` | Added Section 6 with 9 new utility classes (astra-tab, astra-chip, astra-btn-ghost-danger, astra-btn-danger-sm, astra-btn-ghost, astra-nav-item, astra-option-card, astra-review-answer-wrong, astra-review-answer-right) |
| `src/entrypoints/vocabulary/ReviewMode.tsx` | Flashcard `div`: added `onKeyDown` Enter handler + `aria-label` with state text; answer buttons → `astra-review-answer-wrong/right`; resume/deep-read link buttons → `astra-btn-secondary` with size override |
| `src/entrypoints/vocabulary/VocabularyApp.tsx` | 3 tab buttons → `astra-tab` + `aria-selected`; 7 sort/filter chips → `astra-chip` + `aria-pressed`; delete → `astra-btn-ghost-danger`; confirm-delete → `astra-btn-danger-sm`; cancel → `astra-btn-ghost`; reading item Remove → `astra-btn-ghost-danger` |
| `src/entrypoints/options/OptionsApp.tsx` | Desktop nav buttons → `astra-nav-item` class + `aria-current="page"`; mobile nav: hardcoded colors replaced with CSS tokens (var(--astra-brand-muted), var(--astra-brand), var(--astra-text-secondary)); inline style object removed for desktop |
| `src/entrypoints/onboarding/OnboardingApp.tsx` | LEVEL_OPTIONS buttons → `astra-option-card` + `aria-pressed`; EXPLAIN_MODE_OPTIONS buttons → `astra-option-card` + `aria-pressed`; all 11-line inline style objects removed |

### A11y Changes Summary
- `ReviewMode.tsx`: flashcard `role="button" tabIndex={0}` now has `onKeyDown` Enter handler (ARIA pattern compliance) + `aria-label` describing flip state
- `VocabularyApp.tsx`: tab buttons now have `aria-selected` (screen readers announce selected state)
- `VocabularyApp.tsx`: sort/filter chips now have `aria-pressed` (screen readers announce pressed state)
- `OnboardingApp.tsx`: option cards now have `aria-pressed` (screen readers announce selected option)
- `OptionsApp.tsx`: nav buttons now have `aria-current="page"` (screen readers announce current section)

### Key Decision: sortButtonStyle(false) Action Buttons — Partial Migration
Reading item action buttons (Resume, In progress, Saved, Archive at ~lines 1386-1408) still use `style={sortButtonStyle(false)}`. These are action buttons, not filter chips, but visually identical. Left for next iteration to avoid oversizing this PR.

---

## Iteration #5 — Specific Changes Made (2026-04-25)

### CSS Added (4 new classes)
`.astra-section-heading`, `.astra-section-subheading`, `.astra-nav-item-mobile`, `.astra-btn-info` — see token values above.

### Dead Style Consts Removed
| File | Removed Consts |
|------|----------------|
| `OptionsApp.tsx` | `navBtnBase`, `navBtnActive`, `sectionTitle`, `inputStyle`, `selectStyle`, `btnPrimary`, `btnSecondary`, `btnDanger`, `cardStyle` (9 total) |
| `VocabularyApp.tsx` | `deleteBtnStyle`, `confirmBtnStyle`, `tabStyle`, `sortButtonStyle` function (4 total) |
| `ReviewMode.tsx` | `dontKnowButtonStyle`, `knowItButtonStyle`, `dailyStatsInfoButtonStyle` (3 total) |
| `OnboardingApp.tsx` | `selectStyle` (1 total) |

### Migrations
| File | Migration |
|------|----------|
| `OptionsApp.tsx` | 8× `<h2 style={sectionTitle}>` → `className="astra-section-heading"` |
| `OptionsApp.tsx` | 3× `<h3 style={{ fontSize: 16, fontWeight: 600...}}>` → `className="astra-section-subheading"` |
| `OptionsApp.tsx` | Mobile nav: `className={isMobile ? "astra-nav-item-mobile" : "astra-nav-item"}` + removed 13-line inline style conditional |
| `OptionsApp.tsx` | 6× `style={{ ...selectStyle, maxWidth: 220/none }}` → `className="astra-input"` + inline size override |
| `VocabularyApp.tsx` | 5× `style={sortButtonStyle(false)}` → `className="astra-chip"` |
| `VocabularyApp.tsx` | Tag-filter buttons: inline 10-line style → `className="astra-chip" aria-pressed={...}` |
| `VocabularyApp.tsx` | Daily-stats info button: 10-line inline → `className="astra-btn-info"` |
| `ReviewMode.tsx` | `style={dailyStatsInfoButtonStyle}` → `className="astra-btn-info"` |
| `OnboardingApp.tsx` | `style={selectStyle}` (target-lang select) → `className="astra-input"` |

### State After Iteration #5
- `sortButtonStyle(false)` fully retired — `astra-chip` covers all chip-pattern buttons
- `selectStyle` fully retired from all in-scope files
- `sectionTitle` fully retired — `astra-section-heading` is canonical
- All section `<h2>` and `<h3>` headings consistent via shared classes
- Mobile nav has proper hover + active states (was inline-only before)
- Tag filter buttons now have `aria-pressed` (a11y improvement)

### Remaining Intentional Non-migrations
- `learningActionButtonStyle` in VocabularyApp — blue (#eff6ff/#bfdbfe/#1d4ed8), no design token for this palette
- `learningDeskActionStyle` — intentional blue-on-gradient card palette
- `ctaPrimaryButtonStyle/ctaSecondaryButtonStyle` in DeepReadApp — on colored CTA card, contextual
- `StudySection.tsx` `actionButtonStyle` — popup orange accent, intentional
- `currentPageLoopStyle` in ReviewMode — blue (#eff6ff/#bfdbfe), intentional context card

---

## Key Pattern: Exact Token Mappings Found
```
#6366f1  → var(--astra-brand)          [primary brand indigo]
#4f46e5  → var(--astra-brand-hover)
#4338ca  → var(--astra-brand-active)   [exact]
rgba(99,102,241,0.08) → var(--astra-brand-muted)  [exact]
rgba(99,102,241,0.25) → var(--astra-brand-border) [exact]
#dc2626  → var(--astra-danger)
#16a34a  → var(--astra-success)        [exact]
#d97706  → var(--astra-warning)
#f8fafc  → var(--astra-bg-primary)     [exact]
#ffffff  → var(--astra-bg-card)
#f1f5f9  → var(--astra-bg-hover)       [exact]
#e2e8f0  → var(--astra-border)         [exact]
#cbd5e1  → var(--astra-border-strong)  [exact]
#0f172a  → var(--astra-text-primary)   [exact]
#475569  → var(--astra-text-secondary) [exact]
#64748b  → var(--astra-text-muted)     [exact]
#94a3b8  → var(--astra-text-decorative)[exact]
11px     → var(--astra-text-xs)        [exact]
13px     → var(--astra-text-sm)        [exact]
```

---

## Test Results
- `pnpm tsc --noEmit` → **exit 0** after every iteration
- `pnpm test --run` → 2 pre-existing config-migration failures only (confirmed identical on unmodified baseline; not regressions)

---

## Tracking File
`prompt-exports/optimize-ui-redesign-runs.md` — append a row after each iteration with score, delta, and notes.
