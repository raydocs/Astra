# Astra Accessibility Audit — 2026-05-27

This document converts macro-plan Section 32 into a release-readiness audit for the first accessibility implementation pass. It is paired with the executable contract in `src/utils/accessibility-readiness.ts`.

## Principles

Astra's launch-critical learning surfaces must be:

1. **Keyboard first** — P0 tasks can be completed without a mouse.
2. **Screen-reader readable** — controls, states, errors, and shortcuts expose meaningful labels and announcements.
3. **Contrast sufficient** — text and state indicators remain legible in the default light theme and supported dark/system contexts.
4. **Motion respectful** — non-essential animation honors `prefers-reduced-motion`.
5. **Text scalable** — main flows tolerate larger text without hiding required controls.
6. **Error explicit** — error states include text plus a recovery action.
7. **Touch friendly** — targets remain usable in popup, panel, and web-app layouts.

## First-pass surface audit

| Surface | Priority | Acceptance | Current evidence | Remaining release work |
| --- | --- | --- | --- | --- |
| Popup | P0 | Logical tab order and clear primary action label. | Shared focus-visible ring in `src/assets/astra-extension.css`; popup/account surfaces use labeled buttons/status primitives. | Record final no-mouse walkthrough against the built popup before store submission. |
| Onboarding | P0 | User can complete first-run setup with Tab/Enter. | `src/entrypoints/onboarding/OnboardingApp.test.tsx` exists; UI primitives expose labels and segmented-control semantics. | Keep keyboard test green and add manual evidence for final copy/layout. |
| Settings/Options | P0 | Inputs, toggles, segmented controls, and status copy are labeled. | Options now uses shared Toast/status primitives; form labels are covered by component tests and visible copy. | Audit every new settings control as it is added. |
| Selection toolbar/content overlays | P0/P1 | Controls have names, status is announced, reduced motion respected. | `FloatBall`, `HoverTranslate`, `InputTranslate`, and `SelectionToolbar` use labeled controls and live status regions; global reduced-motion CSS exists. | Finish adopting shared Toast/status semantics across any remaining overlay-only messages. |
| Review | P1 | Shortcuts are documented and controls are labeled. | `ReviewMode` tests cover existing review behavior; Section 32 contract records required 1/2/3, Space, Esc shortcuts. | Ensure visible/discoverable shortcut hints ship with final Review UI. |
| Library | P0 | Search, filters, list rows, and detail entry are keyboard reachable. | Library search/filter/list are included in the readiness contract and foundation completion boundary. | Record `/` search focus and Enter detail behavior in final keyboard walkthrough. |
| Paywall | P0 | Price, limits, cancellation boundary, and CTA are readable. | Paywall copy is included in the readiness blocker set. | Verify final billing/legal copy and CTA labels after production paywall wiring. |
| Support/report flow | P0 | Category, privacy preview, submit, success, and error states expose text labels/status. | Existing support/report foundation is metadata-only and has status/triage docs; Section 32 contract adds accessibility evidence gate. | Add final screen-reader smoke test for submission success/error. |
| Toast/status | P0 | Non-blocking, aria-live, action/dismiss labels. | `src/components/Toast.tsx` exposes live-region roles, action labels, and dismiss labels; `Toast.test.tsx` covers behavior. | Continue replacing ad-hoc status banners with shared Toast/status primitives. |
| Error cards | P0 | Error is not color-only and has a next action. | Readiness contract blocks release without text, non-color cue, and action evidence. | Inventory every P0 error card before release cut. |

## State-copy rule

The following states must never rely on color alone:

- success
- warning
- error
- loading
- Pro limit
- review due

Each state needs user-visible text and a non-color cue such as an icon, count, spinner, badge, or explicit status word. Error and Pro-limit states also need an action such as retry, change settings, view plan limits, dismiss, or contact support.

## Contrast and scaled-text notes

- New CSS should use `--accent-primary` rather than the legacy `--accent-blue` alias.
- The default web theme is light (`data-astra-theme="light"`); any dark/system UI changes must preserve contrast against the Astra token palette.
- Final release QA should verify popup, onboarding, Review, Library, paywall, and support/report flow with increased browser text size/zoom and record results in `keyboard-test.md`.

## Reduced-motion rule

The extension stylesheet already contains a global `@media (prefers-reduced-motion: reduce)` rule that disables transitions/animations broadly. New animations must either inherit that rule or add a local reduced-motion override.

## Readiness decision

Use `evaluateAstraAccessibilityReadiness()` with evidence from this audit, `component-labels.md`, and `keyboard-test.md`.

- P0 missing evidence blocks readiness.
- P1 missing evidence creates a warning and must be tracked before release-candidate signoff.

Use `evaluateAstraAccessibilityManualEvidencePacket()` before claiming broad accessibility compliance. It rejects missing rows, `not_run` rows, failed rows, and rows without owner/date, environment, or evidence links.
