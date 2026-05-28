# Astra Keyboard, Contrast, and Motion Test Plan — 2026-05-27

This file is the manual QA companion for Section 32. Automated tests should cover what they can, but final release signoff still needs a no-mouse walkthrough on the built extension/web surfaces.

## Required shortcuts

| Surface | Shortcut | Expected behavior | Priority |
| --- | --- | --- | --- |
| Review | `1`, `2`, `3` | Grade the current card response. | P1 |
| Review | `Space` | Reveal, continue, or advance the active review card. | P1 |
| Review | `Esc` | Exit the active review interaction or close a nested panel. | P1 |
| Library | `/` | Focus Library search. | P0 |
| Card/source detail | `Enter` | Open focused card or source detail. | P0 |
| Modal | `Esc` | Close the modal and return focus to the opener. | P0 |
| Onboarding | `Tab`, `Enter` | Move through choices and complete setup. | P0 |

## Current automated and browser-backed evidence

| Flow / contract | Evidence | Result |
| --- | --- | --- |
| Onboarding first-run keyboard semantics | `pnpm test src/entrypoints/onboarding/OnboardingApp.test.tsx` | Pass on 2026-05-28; covers active-step focus, radio keyboard selection, and strict target-language / level / primary-goal setup. |
| Accessibility readiness contract | `pnpm test src/utils/accessibility-readiness.test.ts` | Pass on 2026-05-28; validates Section 32 requirement definitions, readiness decisions, state-copy rules, and component-label contract. |
| Built-surface browser smoke/proof coverage | `pnpm bench:live:lane:release-proof`; `docs/reviews/accessibility-browser-evidence-note-2026-05-28.md` | Pass on 2026-05-28; records popup, onboarding, Library/Review, selection toolbar, document-reader, YouTube, and boundary-copy browser evidence. |

Automated/browser-backed evidence does not replace the built-surface manual walkthrough below.

## P0 no-mouse walkthrough

| Flow | Steps | Pass criteria | Evidence owner/date |
| --- | --- | --- | --- |
| Popup first action | Open popup, Tab through controls, activate the main action, dismiss/return. | Focus order is logical; visible focus ring appears; main button label describes outcome. | Browser proof attached (`live-20260528T034300-t1bknt`); human no-mouse signoff TODO before RC. |
| Onboarding | Complete first-run flow using only Tab/Enter. | Every required choice is reachable; validation/errors are textual; finish action is clear. | Automated keyboard test + browser proof attached (`live-20260528T034254-v7p2ij`); human no-mouse signoff TODO before RC. |
| Settings | Change a representative setting, trigger a status message, restore original value. | Inputs/toggles have labels; status is readable/live; no keyboard trap. | Human no-mouse signoff TODO before RC. |
| Selection toolbar | Select text, open Astra controls, translate/save/report/close by keyboard. | Controls are labeled; loading/error/result states include text; close restores page context. | Browser proof attached (`live-20260528T034309-cqwblh`); human no-mouse signoff TODO before RC. |
| Library | Press `/`, search, change filters, move through source rows, press Enter for detail. | Search/filter/list/detail controls are reachable and have visible focus. | Browser proof attached (`live-20260528T034257-ppbt4l`, `live-20260528T034307-utmspm`, `live-20260528T034313-je0yb5`); human no-mouse signoff TODO before RC. |
| Paywall | Navigate plan copy, limit copy, cancellation/trial copy, and CTA. | Price/limits/CTA are readable and not color-only. | Billing/paywall RC external-blocked; human no-mouse signoff TODO before billing RC. |
| Support/report | Open report flow, choose category, review privacy copy, submit/cancel. | Category/description/privacy/submit controls are labeled; success/error status is text. | Human no-mouse signoff TODO before RC. |
| Error card | Trigger or inspect representative error cards. | Each has title/body, non-color cue, and action such as retry/settings/dismiss/contact support. | Browser boundary-copy proof attached (`live-20260528T034218-thpyt9`, `live-20260528T034401-ubq2k1`, `live-20260528T034403-uutfso`, `live-20260528T034405-d4hedp`, `live-20260528T034406-8bdy2x`, `live-20260528T034408-l87620`); human no-mouse signoff TODO before RC. |

## Contrast check

Minimum manual checks before release candidate:

- Default light theme text on primary surfaces.
- Accent buttons using `--accent-primary` against their background.
- Success/warning/error badges and banners with text plus non-color cue.
- Disabled/loading states remain identifiable by text, not opacity alone.
- Focus ring remains visible on popup, toolbar, Library, Review, paywall, and support/report controls.

## Reduced-motion check

1. Enable OS/browser `prefers-reduced-motion`.
2. Open popup, onboarding, content overlays, Review, Library, and any progress UI.
3. Confirm non-essential transitions are disabled or shortened.
4. Confirm essential loading/progress information remains visible as text/progress semantics.

Known baseline: `src/assets/astra-extension.css` includes a global `@media (prefers-reduced-motion: reduce)` rule, and UI primitives include reduced-motion handling for progress animation. New animations must preserve this behavior.

## Scaled-text check

Run popup, onboarding, Review, Library, paywall, and support/report at increased browser zoom/text size. Pass criteria:

- Required controls remain visible or scrollable.
- Labels do not collapse into ambiguous icon-only controls.
- Error/status text remains readable.
- Focus order still follows visual order.

## Manual evidence packet guardrail

Use `evaluateAstraAccessibilityManualEvidencePacket()` before treating this file or the Section 32 rows in `docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md` as broad accessibility evidence.

The packet is acceptable only when every required row has:

- a non-`not_run` verdict;
- no `fail` verdicts;
- owner/date;
- environment, including browser/build and assistive-technology context where relevant;
- an evidence link to notes, screenshots, logs, video, or a filled checklist.

Browser smoke artifacts and automated tests can support the evidence link, but they do not replace the human no-mouse, contrast/scaled-text, reduced-motion, and screen-reader spot-check rows.

## Recording readiness

After QA, convert results into an `AstraAccessibilityReadinessEvidence` object and evaluate it with `evaluateAstraAccessibilityReadiness()`.
