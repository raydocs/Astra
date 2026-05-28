# Personalization QA Evidence Note — 2026-05-28

Source plan: Section 7 of `docs/plans/astra-macro-product-upgrade-plan-2026-05-27.md`.

Purpose: attach current repo-side QA evidence that the learning profile visibly affects a learner-facing behavior beyond settings/onboarding while remaining reversible and privacy-bounded. This note supports public-beta downgrade copy only; it does not claim broad automatic personalization maturity.

## Validation markers

- `PERSONALIZATION_REVIEW_FOCUSED_EXIT:0`
- `PERSONALIZATION_REVIEW_COMBINED_EXIT:0`
- Current focused coverage includes `src/utils/personalization-experience.test.ts`, `src/entrypoints/vocabulary/ReviewMode.test.tsx`, and `src/utils/macro-operational-evidence.test.ts`.
- Any release candidate must still rerun Gate 1 and applicable live-browser/manual QA gates from `docs/release-readiness-checklist.md`.

## Repo-side QA coverage

| Personalization claim area | Current evidence | Verdict |
|---|---|---|
| Visible learner-facing behavior | Review renders `review-personalized-profile-card` explaining the applied primary goal, daily time, level, explanation preference, evidence count, and Options reversal path. Covered by `surfaces the learner profile as a visible Review plan and prioritizes matching sources`. | Repo-covered for a learner-facing behavior beyond settings/onboarding. |
| Goal-shaped queue ordering | `orderReviewQueueForLearningProfile()` prioritizes sources matching the learner goal, e.g. `watch_tutorials` prioritizes subtitle/video-like cards. Covered by `orders and sizes Review from the reversible learning profile`. | Repo-covered for goal influence on Review order. |
| Daily time session sizing | `derivePersonalizedReviewCardLimit()` and `buildPersonalizedReviewPlan()` size the normal due-card session from `dailyGoalMinutes`; focused/page review flows are not capped. Covered by ReviewMode daily-goal and focused-review tests. | Repo-covered for conservative daily-goal sizing. |
| Disabled personalization fallback | `buildPersonalizedReviewPlan()` returns normal due-card order and no profile sizing when `personalizationEnabled` is false. Covered by personalization-experience tests. | Repo-covered at helper level; manual UI walkthrough should confirm disabled-state copy in a built extension. |
| Reversible controls | Options General exposes learning profile goal, daily time, personalization enabled toggle, remembered terms, excluded sites, and forget remembered-term controls. Covered by `OptionsApp.test.tsx` learning-profile controls assertions. | Repo-covered for controls and copy. |
| Memory write boundaries | `learning-memory.test.ts` covers Privacy Mode, personalization-off, user-initiated writes, and excluded-host suppression/reduction decisions. | Repo-covered for policy helper behavior. |

## Current beta boundary

Astra can be described as: Learning profile and memory controls are visible and reversible; Review visibly uses the profile to shape queue order and daily session size; memory writes respect privacy/personalization/excluded-site policy helpers.

Do **not** claim yet:

- personalization has been manually QAed across every learner surface;
- all eight macro personalized behavior categories are fully productized;
- every AI prompt/output automatically adapts to profile fields;
- disabled or excluded-site personalization has fresh browser/device replay evidence for this RC;
- personalization quality lift is proven by cohort metrics.

## Required before stronger claim

Before upgrading Section 7 beyond beta-boundary language, fill the Section 7 rows in `docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md` and attach a current QA/release packet covering:

1. built-extension walkthrough of Review with at least two different goals and daily time values;
2. disabled personalization walkthrough proving Review falls back to default queue behavior;
3. excluded-site and Privacy Mode walkthrough proving automatic memory writes do not happen;
4. Options reversal walkthrough for goal, daily time, global personalization off, excluded site, and forget remembered term;
5. product or cohort evidence before claiming personalization improves retention, comprehension, or paid conversion.
