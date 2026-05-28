# Macro Manual / Browser QA Evidence Checklist — 2026-05-28

Source objective: complete the macro product upgrade plan from `/Users/ruirui/Downloads/astra-macro-product-upgrade-plan-2026-05-27 (1).md` without over-claiming unrun manual QA.

This checklist is the evidence-collection companion for macro-plan Sections 6, 7, 13, 14, 24, and 32. It does **not** record pass/fail results by itself. Rows become release evidence only after a human or designated QA owner fills the owner/date, environment, evidence link, and verdict fields.

## How to use

1. Run the required automated gates from `docs/release-readiness-checklist.md` for the target commit/worktree.
2. Fill each applicable manual/browser row below with:
   - owner/date;
   - environment: browser, OS, extension build or web URL, relay/API base URL if used;
   - evidence link: screenshot, short recording, log excerpt, run folder, or written notes;
   - verdict: `pass`, `pass-with-downgrade`, `fail`, or `not-run`.
3. If a row is `not-run` or `fail`, keep the related public claim downgraded in `docs/reviews/macro-rc-evidence-packet-2026-05-28.md` and `docs/reviews/macro-gate-4-claim-review-2026-05-28.md`.
4. Do not use local deterministic tests as substitutes for rows that explicitly require rendered/browser/human evidence.

## Evidence status legend

| Status | Meaning |
|---|---|
| `repo-backed` | Existing tests/docs support beta-boundary wording only. |
| `browser-backed` | Local release-proof or scenario artifacts exist, but not full manual signoff. |
| `manual-required` | A human must walk the flow before stronger launch/compliance claims. |
| `external-required` | Evidence depends on CI, production, store, billing, legal, or owner approval outside the repo. |

## Section 6 — Learning Library manual/browser QA

Repo-side note: `docs/reviews/library-qa-evidence-note-2026-05-28.md`.

| QA row | Minimum walkthrough | Current status | Owner/date | Environment | Evidence link | Verdict |
|---|---|---|---|---|---|---|
| Article source return | Open Library/Reading, search or filter to an article source, open detail, return to source, confirm source metadata remains attached. | browser-backed only through release-proof learning-loop revisit; manual-required for full Library claim |  |  |  | not-run |
| Remote PDF source return | Open a remote PDF reading row, resume reader, confirm confidence/source copy and return path. | browser-backed for controlled PDF reader; manual-required for Library claim |  |  |  | not-run |
| Local PDF unavailable/handoff state | Open a local-file reading row where direct reopen is unavailable; confirm copy explains handoff/limitation. | repo-backed; manual-required |  |  |  | not-run |
| EPUB source return | Open EPUB reading row, resume reader, confirm title/progress/source identity. | browser-backed for controlled EPUB reader; manual-required for Library claim |  |  |  | not-run |
| SRT/VTT subtitle-file source return | Open subtitle-file reading row, resume reader, confirm cue/source identity and limitations. | browser-backed for controlled subtitle-file reader; manual-required for Library claim |  |  |  | not-run |
| Video/transcript-origin card return | Save from YouTube transcript/subtitle flow, open Review/Library card, return to source/workspace if exposed. | browser-backed for YouTube save/review loop; manual-required for Library claim |  |  |  | not-run |
| Source-only delete | Delete source while preserving linked saved cards; verify confirmation copy and post-delete state. | repo-backed; manual-required |  |  |  | not-run |
| Source + linked-card cascade delete | Delete source and linked cards; verify explicit destructive confirmation and recovery/export guidance. | repo-backed; manual-required |  |  |  | not-run |
| Theme-pack export/import recovery | Export representative Reading queue package and verify signed metadata/counts; if import is claimed, verify recovery path. | repo-backed for export; manual-required |  |  |  | not-run |
| Empty/deferred macro asset rows | Inspect ready/empty/planned rows for Saved Videos, Video Notes, Personal Glossary, and Learning Digest. | repo-backed; manual-required for rendered copy |  |  |  | not-run |

## Section 7 — Personalization manual/browser QA

Repo-side note: `docs/reviews/personalization-qa-evidence-note-2026-05-28.md`.

| QA row | Minimum walkthrough | Current status | Owner/date | Environment | Evidence link | Verdict |
|---|---|---|---|---|---|---|
| Review shaped by goal A | Set a learner goal and daily time, open Review, verify visible profile card and queue order/size. | repo-backed; manual-required |  |  |  | not-run |
| Review shaped by goal B | Switch to a different goal/daily time, verify Review plan changes and remains understandable. | repo-backed; manual-required |  |  |  | not-run |
| Personalization disabled fallback | Disable personalization, open Review, verify default due-card behavior and copy. | repo-backed; manual-required |  |  |  | not-run |
| Privacy Mode memory suppression | Enable Privacy Mode, perform a representative learning action, verify automatic memory write does not happen or is reduced per policy. | repo-backed; manual-required |  |  |  | not-run |
| Excluded-site memory suppression | Add current site to exclusions, perform representative action, verify memory write is blocked/reduced and copy is clear. | repo-backed; manual-required |  |  |  | not-run |
| Options reversibility | Change goal, daily time, personalization toggle, excluded site, and remembered term; restore each control. | repo-backed; manual-required |  |  |  | not-run |

## Section 13 — Brand and default-surface copy/UI audit

| QA row | Minimum walkthrough | Current status | Owner/date | Environment | Evidence link | Verdict |
|---|---|---|---|---|---|---|
| Default onboarding copy | Verify first-run copy avoids provider/model/API jargon and explains the learning loop. | repo-backed; manual-required |  |  |  | not-run |
| Popup / Deep Read copy | Verify default copy emphasizes read/explain/save/review and avoids unsupported paid/platform/privacy claims. | browser-backed plus manual-required |  |  |  | not-run |
| Library / Review copy | Verify empty, success, and deferred rows use consistent learning-language tone. | repo-backed; manual-required |  |  |  | not-run |
| Error/boundary copy | Verify representative errors include title/body/action and do not rely on color alone. | browser-backed plus manual-required |  |  |  | not-run |
| Store/landing copy claim freeze | Compare public copy to Gate 4 downgrade categories before capture/upload. | external-required |  |  |  | not-run |

## Section 14 — Support / help / status evidence

| QA row | Minimum walkthrough | Current status | Owner/date | Environment | Evidence link | Verdict |
|---|---|---|---|---|---|---|
| Support report entrypoint | Open report flow, choose category, review privacy copy, submit/cancel. | repo-backed; manual-required |  |  |  | not-run |
| Known limitations visibility | Confirm known limitations for paid launch, store status, platform support, privacy, file/video breadth, and accessibility are linked in RC notes or public help. | repo-backed; manual/external-required |  |  |  | not-run |
| Degraded-status/support path | Verify degraded provider/relay/support state has user-facing copy and an operator path. | repo-backed; manual-required |  |  |  | not-run |
| Support owner and incident path | Record support/incident owner, inbox/status URL, and rollback escalation path for the RC. | external-required |  |  |  | not-run |

## Section 24 — Human-scored AI quality report

Repo-side rubric: `docs/quality/rubrics.md`.

| QA row | Minimum walkthrough | Current status | Owner/date | Environment | Evidence link | Verdict |
|---|---|---|---|---|---|---|
| P0 fixture scoring sample | Score the fixed fixture manifest with a human reviewer or approved evaluation process; record sample IDs and category scores. | repo-backed fixtures only; manual-required |  |  |  | not-run |
| Live provider sample | Run representative live provider outputs for translation/explanation/review-card/personalized terms/writing correction and score with rubric. | external-required |  |  |  | not-run |
| Blocker sample triage | Record blocker sample IDs, severity, decision, and whether release wording is downgraded. | manual-required |  |  |  | not-run |
| Trend/decision note | Compare against prior quality run if available and record release decision. | manual-required |  |  |  | not-run |

## Section 32 — Accessibility manual QA

Canonical detailed checklist: `docs/accessibility/keyboard-test.md`. Browser-backed note: `docs/reviews/accessibility-browser-evidence-note-2026-05-28.md`.

| QA row | Minimum walkthrough | Current status | Owner/date | Environment | Evidence link | Verdict |
|---|---|---|---|---|---|---|
| No-mouse popup | Complete popup first action using keyboard only. | browser-backed smoke; manual-required |  |  |  | not-run |
| No-mouse onboarding | Complete first-run flow using Tab/Enter only. | browser-backed smoke plus automated focus tests; manual-required |  |  |  | not-run |
| No-mouse settings/options | Change and restore representative setting with keyboard only. | repo-backed; manual-required |  |  |  | not-run |
| No-mouse selection toolbar | Select text and operate translate/save/report/close controls with keyboard path documented. | browser-backed smoke; manual-required |  |  |  | not-run |
| No-mouse Library/Review | Search/filter/open Review/Library flows with keyboard only. | browser-backed smoke; manual-required |  |  |  | not-run |
| Contrast/scaled text | Check default light theme and critical cards at scaled text sizes. | manual-required |  |  |  | not-run |
| Reduced motion | Verify no essential action depends on motion and `prefers-reduced-motion` remains acceptable. | manual-required |  |  |  | not-run |
| Screen reader spot check | Spot-check popup/onboarding/Review/Library headings, labels, live/status copy, and error cards. | manual-required |  |  |  | not-run |

## Release interpretation

- Acceptable now: repository tests, local release-proof browser artifacts, and scoped evidence notes support public-beta downgrade wording.
- Not acceptable now: broad claims that Library, personalization, support, brand polish, AI quality, or accessibility have completed manual/production release signoff.
- Stronger claims become acceptable only when the relevant rows above are filled with concrete evidence and linked from the RC evidence packet.
