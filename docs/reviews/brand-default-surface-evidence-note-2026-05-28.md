# Brand default-surface evidence note — 2026-05-28

Source: macro product upgrade plan Section 13.

This note records repo-side brand/copy evidence for default user-facing surfaces. It is **not** a completed visual polish audit, screenshot packet, store-copy approval, or owner signoff.

## Current repo-backed evidence

| Section 13 row | Repo evidence | Current proof | Remaining boundary |
| --- | --- | --- | --- |
| Default onboarding copy | `src/entrypoints/onboarding/OnboardingApp.tsx`, `src/entrypoints/onboarding/OnboardingApp.test.tsx`, `src/utils/brand-experience.ts` | First-run onboarding is reduced to target language, level, and primary goal; provider/model/source-language/style setup is not part of the default path. | Needs current owner/date/environment/evidence/verdict row and screenshot/browser walkthrough. |
| Popup / Deep Read copy | `src/entrypoints/popup/App.tsx`, `src/entrypoints/content/components/FloatBall.tsx`, `src/utils/brand-experience.ts` | Brand contract defines preferred learning CTAs and blocks provider/route/relay/token/debug/error-code copy on default surfaces. | Needs current popup/content-overlay copy and UI walkthrough evidence. |
| Library / Review copy | `src/entrypoints/vocabulary/VocabularyApp.tsx`, `src/entrypoints/vocabulary/ReviewMode.tsx`, `src/entrypoints/vocabulary/VocabularyApp.test.tsx`, `src/entrypoints/vocabulary/ReviewMode.test.tsx` | Library/Review work is anchored on learner tasks such as Review, Continue, Due, Done, and the three-grade learner-facing Review model. | Needs current Library/Review screenshots or browser walkthrough and manual Section 13 verdicts. |
| Error/boundary copy | `docs/help/known-limitations.md`, `docs/status.md`, `src/utils/support-experience.ts`, `src/utils/support-experience.test.ts` | Support/status docs and brand readiness checks require user-actionable boundary copy instead of diagnostics-first error copy. | Needs current rendered error/degraded-state examples and manual verdict rows. |
| Store/landing copy claim freeze | `store/listing-copy.md`, `docs/reviews/macro-gate-4-claim-review-2026-05-28.md`, `docs/reviews/macro-rc-evidence-packet-2026-05-28.md` | Gate 4 and RC packet keep paid, production, platform, privacy, quality, accessibility, and learning-outcome claims downgraded until stronger evidence is attached. | Needs final hosted/store copy review, screenshots, owner approval, and external evidence before launch-quality claims. |

## Executable guardrails

- `ASTRA_BRAND_DEFAULT_SURFACE_AUDIT` maps the five Section 13 manual QA rows to repo evidence and remaining proof boundaries.
- `evaluateAstraBrandDefaultSurfaceCopyAudit()` applies the same discouraged-term and preferred-tone checks to representative default-surface copy samples.
- `evaluateAstraBrandExperienceReadiness()` still blocks readiness when copy, default actions, diagnostics, task grouping, advanced settings, or error recovery remain backend-like.

## Downgrade copy

Brand principles, default-surface audit inventory, copy screening helpers, token references, and this repo evidence note exist. Broad aesthetic polish, default-surface screenshots/browser walkthroughs, store/landing copy approval, and Section 13 owner-signed manual rows remain required before stronger brand-quality claims.
