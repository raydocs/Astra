# Astra Component Labels Checklist — 2026-05-27

This checklist records the component-label expectations that feed Section 32 accessibility readiness. The source of truth for machine-readable coverage is `ASTRA_ACCESSIBILITY_COMPONENT_LABELS` in `src/utils/accessibility-readiness.ts`.

## Required labels by component

| Component/surface | Required accessible names | State announcement expectation | Evidence path |
| --- | --- | --- | --- |
| Shared Toast | Toast region, message text, optional action label, dismiss label. | `role="status"`/`role="alert"`, polite/assertive `aria-live`, `aria-atomic`. | `src/components/Toast.tsx`, `src/components/Toast.test.tsx` |
| FloatBall | Open Astra menu, menu items, progress, cancel, report controls. | Translation/report progress uses status/progressbar semantics and live status text. | `src/entrypoints/content/FloatBall.tsx` and tests |
| SelectionToolbar | Translate/save/report/close controls include clear labels. | Selection and translation status is exposed as text, not only color/icon. | `src/entrypoints/content/SelectionToolbar.tsx` |
| HoverTranslate | Translation result, loading, error, save/report controls are named. | Loading/error/result status is announced. | `src/entrypoints/content/HoverTranslate.tsx` |
| InputTranslate | Input translation controls, provider/status copy, and actions are named. | Loading/error/result status is announced. | `src/entrypoints/content/InputTranslate.tsx` |
| ReviewMode | Reveal/continue, answer grading buttons, due/result status, and shortcut hints are named. | Review due/result changes use text status. | `src/entrypoints/vocabulary/ReviewMode.test.tsx` |
| Library search and filters | Search input, source filters, list rows, and detail-entry controls are named. | Empty/loading/error states include text and non-color cues. | Library tests/manual keyboard pass |
| OnboardingApp | Target language, level, primary-goal choices and next/finish controls are visible or aria-labeled. First-run onboarding must not expose provider/model/prompt/style setup. | Step progress and validation errors are text-readable. | `src/entrypoints/onboarding/OnboardingApp.test.tsx` |
| Paywall | Price, quota/limits, cancellation/trial boundary, and CTA button are readable. | Limit reached and billing errors include text plus action. | Paywall copy audit before billing launch |
| SupportReportFlow | Category, description, privacy preview, submit, success/error controls are named. | Submission success/error and privacy-copy status are live text. | Support/report manual pass and metadata-only support tests |
| ErrorCard pattern | Error title/body and recovery action label are visible or aria-labeled. | Error state has a non-color cue and action. | Error-card inventory before release |

## Labeling rules

- Prefer visible labels. Use `aria-label` only when the UI cannot show equivalent copy.
- Icon-only buttons must have an accessible name that describes the user outcome, not the icon shape.
- Status regions must include useful text; color and icons are supplemental only.
- Button labels should be task-specific: use `Translate selection`, `Save to Library`, `Retry translation`, `Open plan limits`, not generic `OK` or `Click here`.
- Shortcut hints must not be the only accessible name. A shortcut can supplement a descriptive label, for example `Reveal answer (Space)`.
- New components added to popup, onboarding, settings, Review, Library, paywall, support/report, or content overlays must be added to this checklist or represented by a shared primitive already listed here.

## Release review checklist

- [ ] Every P0 button/control has visible or programmatic text.
- [ ] Every P0 status has live/readable text and a non-color cue.
- [ ] Error and Pro-limit states include an action label.
- [ ] Shared Toast is used where non-blocking status is sufficient.
- [ ] Modal and overlay close controls are reachable by keyboard and have `Esc` behavior where applicable.
