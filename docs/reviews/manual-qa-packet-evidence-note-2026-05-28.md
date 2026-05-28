# Manual QA packet evidence note — 2026-05-28

Source: macro final-completion blocker `manualQaChecklistComplete`.

This note records repo-side manual QA packet guardrails. It is **not** a completed manual/browser QA run, screenshot packet, recording packet, human-scored AI report, or accessibility signoff.

## Current repo-backed evidence

| Area | Repo evidence | Current proof | Remaining boundary |
| --- | --- | --- | --- |
| Manual QA checklist | `docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md` | Enumerates Section 6, 7, 13, 14, 24, and 32 manual/browser QA rows with owner/date, environment, evidence link, and verdict columns. | Rows remain unfilled / `not-run`; this is not complete QA evidence. |
| Area-specific evidence notes | `docs/reviews/library-qa-evidence-note-2026-05-28.md`, `docs/reviews/personalization-qa-evidence-note-2026-05-28.md`, `docs/reviews/brand-default-surface-evidence-note-2026-05-28.md`, `docs/reviews/ai-quality-human-scored-evidence-note-2026-05-28.md`, `docs/reviews/accessibility-manual-evidence-note-2026-05-28.md` | Separate notes define remaining QA boundaries for Library, personalization, brand/default surfaces, AI quality, and accessibility. | Each area still needs filled owner/date/environment/evidence/verdict rows before stronger claims. |
| Manual QA packet intake | `evaluateAstraMacroManualQaEvidencePacket()` | Requires every Section 6/7/13/14/24/32 row to be present, run, real-environment, evidence-backed, and verdicted `pass` or `pass-with-downgrade`; placeholder/local/sample/dev/test environment text is rejected. | This validates supplied evidence; it does not perform manual/browser QA. |

## Required packet rows

`manualQaChecklistComplete` may only be marked true when the packet satisfies `evaluateAstraMacroManualQaEvidencePacket()` and includes every required row:

- **Section 6** — Library source return/delete/export/deferred-row walkthroughs.
- **Section 7** — personalization goal changes, disabled fallback, Privacy Mode/excluded-site suppression, Options reversibility.
- **Section 13** — default onboarding, popup/Deep Read, Library/Review, error/boundary, and store/landing claim-freeze copy/UI audit.
- **Section 14** — support report entrypoint, known limitations, degraded-status/support path, support owner and incident path.
- **Section 24** — P0 fixture scoring, live provider sample, blocker sample triage, trend/decision note.
- **Section 32** — no-mouse popup/onboarding/settings/selection-toolbar/Library-Review, contrast/scaled text, reduced motion, and screen-reader spot check.

Every row needs owner/date, real browser/build environment, evidence link, and verdict `pass` or `pass-with-downgrade`. A row with `not-run`, `fail`, blank owner/date, blank or placeholder/local/sample environment, or blank evidence link keeps `manualQaChecklistComplete` false.

## Downgrade copy

Manual QA checklist structure and a manual QA packet intake guard exist in repo. Final completion still requires filled Section 6/7/13/14/24/32 manual/browser QA evidence rows before `manualQaChecklistComplete` can be marked true.
