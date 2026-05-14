# README Professional Refresh Plan

Last updated: 2026-05-14

## Goal

Refresh the root `README.md` into a professional, visual-first project landing page similar in quality to Read Frog, while staying truthful about Astra's current product maturity.

This is plan-only. Implementation should only edit documentation/README assets; it must not change product behavior, runtime code, commands, or build scripts unless a README link/path correction requires it.

## Background

- Current `README.md` is text-first and mostly Chinese: product framing, feature list, roadmap, Quick Start, install/build, privacy/provider notes, architecture/dev notes, contributing, and license (`README.md:1-222`).
- Astra's public truth boundaries are documented elsewhere and must govern README copy:
  - Chromium is primary; Firefox and Desktop Safari are beta; iOS Safari shell is experimental (`docs/investigations/support-matrix-2026-q2.md`).
  - Privacy mode sanitizes request context; translation content may still leave the device through direct provider or relay paths (`docs/investigations/month-6-privacy-routing-failure-inventory-2026-04-14.md`).
  - Capability matrices are evidence context, not release-claim overrides (`docs/capability-matrix-v2.md`).
- Current visual material is available but mixed by purpose:
  - design references: `docs/design-comparison/`
  - production/parity captures: `store/screenshots/ui-parity-2026-05-13/production/`
  - screenshot requirements: `store/screenshots/README.md`
  - icons: `public/`, `src/web/public/`, `ios/AstraShell/Assets.xcassets/`
- Read Frog prior art: visual-first hero, compact link/badge row, demo media, screenshot sections, table of contents, outcome-oriented feature blocks, and clear user/community/contributor paths: <https://github.com/mengxi-ream/read-frog>.

## Approach

Use the refresh to make README act as a product landing page first and a developer entrypoint second:

1. Lead with a polished hero, short bilingual positioning, and compact links/badges.
2. Show product proof through curated visuals, not long feature inventory.
3. Keep user-facing claims bounded by support/privacy/capability docs.
4. Preserve a concise developer path: install, dev, build, verify, architecture, contribute.

Recommended language strategy for v1: **one bilingual `README.md`**. Use English section headings, a short English summary line at the top of each major product section, and concise Chinese-first body copy where user positioning matters. Do not duplicate every paragraph bilingually; defer separate localized README files until the content model stabilizes.

## Work Items

### 1. Redesign README information architecture and claim-safe copy

**Goal**

Turn `README.md` into a skimmable visual landing page while preserving accurate developer information.

**Scope**

- Modify: `README.md`
- Reference only: `docs/product-roadmap.md`, `docs/investigations/support-matrix-2026-q2.md`, `docs/investigations/month-6-privacy-routing-failure-inventory-2026-04-14.md`, `docs/capability-matrix-v2.md`, `AGENTS.md`, `package.json`.

**Target structure**

1. Hero
   - `Astra`
   - One-line English promise: “AI-powered language learning layer for the web.”
   - One-line Chinese target-user frame: “为中文用户阅读英文网页而设计的浏览器学习层。”
   - Outcome verbs: read, understand, explain, save, review.
2. Link/badge row
   - Extension-first, Chromium supported, Firefox/Safari beta, MIT, TypeScript/React/WXT.
   - Links to roadmap, support matrix, capability matrix, docs index.
3. Demo / screenshots
   - One primary visual, then a small grid of supporting screenshots.
4. Why Astra
   - Position as daily reading → explanation → learning asset loop, not “just another translator.”
5. What works today
   - Prioritize mature surfaces: page translation, bilingual/translation-only reading, selection toolbar, hover/input translation, article mode, site rules, scoped subtitle support.
   - Phrase PDF/EPUB/subtitle-file/owned-reading as evolving surfaces unless implementation evidence supports stronger wording.
6. Platform support
   - Chrome/Chromium: primary supported.
   - Firefox: beta.
   - Desktop Safari: beta.
   - iOS Safari shell: experimental.
7. Privacy and provider boundary
   - Direct provider and Astra relay paths can send translation content off-device.
   - Privacy mode means request-context sanitization, not local-only processing.
   - Direct-to-relay fallback can change transport after provider failure.
8. Quick Start / Development
   - Preserve public commands from `package.json`: `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm build:firefox`, `pnpm build:safari`, `pnpm ios:prepare`, `pnpm dev:web`, `pnpm relay:start`, `pnpm check:repo-knowledge`, `pnpm type-check`, `pnpm lint`, `pnpm test`.
9. Architecture
   - Short repo map aligned with the current four-bucket model: `src/`, `script/`, `docs/`, `data/` plus convention roots.
10. Roadmap / Contributing / License
   - Short links out to deeper docs instead of duplicating them.

**Claim boundary**

Use the cited support/privacy/capability docs as the source of truth. The implementation must avoid unsupported claims about local-only AI, full iOS/mobile support, equal cross-browser maturity, or completed learning-loop/ecosystem maturity.

**Done when**

- README is visual-first, shorter, and easier to scan.
- Public commands still match `package.json`.
- Product/platform/privacy claims match the referenced docs.

### 2. Select README visuals and define missing capture needs

**Goal**

Use existing images where they are genuinely product-facing, and avoid presenting design/reference/diagnostic captures as shipped UI.

**Candidate assets**

Prefer after audit:

- `store/screenshots/ui-parity-2026-05-13/production/popup-empty-state.png`
- `store/screenshots/ui-parity-2026-05-13/production/selection-toolbar.png`
- `store/screenshots/ui-parity-2026-05-13/production/review-card.png`
- `store/screenshots/ui-parity-2026-05-13/production/review-summary.png`
- `store/screenshots/ui-parity-2026-05-13/production/shared-primitives-gallery.png`
- `store/screenshots/ui-parity-2026-05-13/production/web-landing.png`

Use only as internal style references unless explicitly labeled:

- `docs/design-comparison/*.png`
- `store/screenshots/ui-parity-2026-05-13/reference/*`
- `store/screenshots/ui-parity-2026-05-13/compare-*`

**Asset rules**

- Primary hero must be normal user-facing UI, not a certification or compare frame.
- Include 3–4 screenshot cards at most: popup/control center, selection translation, review/learning loop, and web/reader surface if it is marketing-ready.
- Every image needs meaningful alt text and claim-safe captions before it is embedded.
- v1 should **not block on new captures**. If no existing screenshot is good enough for hero placement, ship a polished text/icon hero plus a smaller audited screenshot grid, then track new capture tasks as follow-up.
- Do not use mockups as product screenshots.

**Potential follow-up captures**

- `README-hero-page-translation.png`
- `README-selection-explain.png`
- `README-popup-study-hub.png`
- Optional short GIF/WebM for page translation.

Follow `store/screenshots/README.md` expectations: clean profile, representative content, no sensitive info, and stable viewport.

**Done when**

- README uses only appropriate assets.
- Design/reference/compare images are not mistaken for shipped product screenshots.
- Missing visual needs are explicit and actionable.

### 3. Final PR checklist

**Goal**

Keep verification lightweight and documentation-appropriate.

**Checklist**

- Links/images: repo-relative links resolve and images render in GitHub Markdown.
- Commands: Quick Start/dev commands match `package.json`; Node/pnpm requirements are preserved.
- Claims: platform/privacy/capability wording matches the cited source-of-truth docs.
- Readability: hero is understandable in under 10 seconds, feature blocks are outcome-oriented, and developer sections remain easy to find.

**Acceptance criteria**

- README looks like a professional project landing page.
- It serves three audiences: product evaluators, developers, and contributors.
- It contains no unsupported platform/privacy/capability claims.
- It does not present design references as shipped product UI.
- It keeps implementation scope to README/documentation work.

## Open Questions

Resolved for v1:

- Do not block the README refresh on new screenshot capture.
- Use one bilingual `README.md`; revisit separate localized files later.

Still to answer during implementation:

1. Which production screenshots are actually marketing-ready after visual audit?
2. Which exact alt text and captions are safe enough to ship with those screenshots?

## References

- Current README: `README.md`
- Read Frog reference: <https://github.com/mengxi-ream/read-frog>
- Plan conventions: `docs/plans/README.md`
- Visual references: `docs/design-comparison/README.md`, `store/screenshots/README.md`
- Claim boundaries: `docs/investigations/support-matrix-2026-q2.md`, `docs/capability-matrix-v2.md`, `docs/investigations/month-6-privacy-routing-failure-inventory-2026-04-14.md`
- Product direction: `docs/product-roadmap.md`
