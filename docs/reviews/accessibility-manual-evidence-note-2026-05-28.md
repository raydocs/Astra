# Accessibility manual evidence note — 2026-05-28

Source: macro product upgrade plan Section 32.

This note records repo-side accessibility manual-evidence guardrails. It is **not** a completed human no-mouse walkthrough, screen-reader audit, contrast/scaled-text signoff, or broad accessibility compliance approval.

## Current repo-backed evidence

| Area | Repo evidence | Current proof | Remaining boundary |
| --- | --- | --- | --- |
| Accessibility readiness contract | `src/utils/accessibility-readiness.ts`, `src/utils/accessibility-readiness.test.ts` | Defines P0/P1 requirements, state-copy rules, shortcut/label expectations, readiness decision, and manual evidence packet validation. | Needs actual filled manual evidence rows for target build. |
| Audit and keyboard plan | `docs/accessibility/accessibility-audit.md`, `docs/accessibility/keyboard-test.md` | Documents surfaces, shortcuts, no-mouse walkthroughs, contrast/scaled-text checks, reduced-motion checks, and recording rules. | Rows still need owner/date/environment/evidence/verdict fields. |
| Browser-backed supporting evidence | `docs/reviews/accessibility-browser-evidence-note-2026-05-28.md` | Maps local release-proof browser artifacts to accessibility-relevant popup, onboarding, Library/Review, selection toolbar, document-reader, YouTube, and boundary-copy coverage. | Browser artifacts support but do not replace human no-mouse/screen-reader evidence. |
| Manual packet intake | `evaluateAstraAccessibilityManualEvidencePacket()` | Rejects unknown rows, duplicate rows, missing rows, `not_run` rows, failed rows, placeholder evidence links, and rows without owner/date, environment, or evidence link. | This validates supplied evidence; it does not create the manual walkthrough evidence. |
| Manual QA checklist | `docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md` | Section 32 rows enumerate no-mouse popup/onboarding/settings/selection toolbar/Library Review, contrast/scaled text, reduced motion, and screen-reader spot check. | Rows remain not-run until filled for an RC. |

## Minimum acceptable Section 32 packet

A broad accessibility claim needs a target-build packet with all of these rows filled:

1. No-mouse popup;
2. No-mouse onboarding;
3. No-mouse settings/options;
4. No-mouse selection toolbar;
5. No-mouse Library/Review;
6. Contrast/scaled text;
7. Reduced motion;
8. Screen reader spot check.

Each row needs owner/date, environment, real evidence link, and a non-failing verdict; unknown row IDs, duplicate rows, and placeholder/example/todo evidence links are rejected. Automated tests and browser smoke artifacts can be linked as supporting evidence, but the human walkthrough must still be recorded.

## Downgrade copy

Critical-path accessibility foundations, browser-backed supporting artifacts, audit docs, keyboard plan, state-copy rules, and a manual evidence packet intake guard exist in repo. Broad accessibility compliance claims still require a filled Section 32 manual packet with owner/date/environment/evidence/verdict rows for the target build.
