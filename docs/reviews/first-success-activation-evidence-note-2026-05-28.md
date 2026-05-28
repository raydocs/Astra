# First-success activation evidence note — 2026-05-28

Source: macro product upgrade plan Section 4.

This note records repo-side first-success activation evidence. It is **not** a cohort report, production dashboard export, owner activation signoff, or proof that numeric activation targets have been met.

## Current repo-backed evidence

| Area | Repo evidence | Current proof | Remaining boundary |
| --- | --- | --- | --- |
| First-success contract | `src/utils/first-success.ts`, `src/utils/first-success.test.ts`, `docs/specs/first-success.md` | Defines the install → target language → first understanding → save → first Review path, the three-question onboarding boundary, metric targets, and privacy boundaries. | Needs dated smoke/cohort evidence for target build claims. |
| Onboarding boundary | `src/entrypoints/onboarding/OnboardingApp.tsx`, `src/entrypoints/onboarding/OnboardingApp.test.tsx` | First-run onboarding asks target language, level, and primary goal; technical setup remains outside first-run activation. | Needs current browser walkthrough or CI artifact tied to the RC environment. |
| Sample lesson loop | `src/entrypoints/sample-lesson/SampleLessonApp.tsx`, sample lesson tests referenced by release-proof lane | Sample path is designed to show understandable content, save a recommended sentence, and enter first Review. | Needs a dated activation smoke report with elapsed time and artifact links. |
| Activation telemetry guard | `src/utils/first-success.ts`, `src/utils/first-success.test.ts`, `src/utils/learning-loop-events.ts` | First-success events are asserted to remain in the activation dashboard catalog and `aggregateLearningLoopActivationDashboard()` consumes them. | Needs exported telemetry/dashboard evidence before metric maturity claims. |
| Smoke report evaluator | `evaluateAstraFirstSuccessSmokeReport()` | A single-run smoke report must include required events, <60s timing, save/review confirmation, and content-free telemetry field names. | This evaluates supplied evidence; it does not create or fake the evidence. |

## Acceptable smoke evidence fields

A target-build smoke report should include at least:

- owner/date/environment/build or commit;
- path used: onboarding, sample lesson, or real page;
- observed event sequence including `onboarding_completed`, `first_content_understood`, `saved_snippet_created`, and `review_session_completed`;
- seconds to `first_content_understood`;
- confirmation that the first saved learning item and one-card Review occurred;
- telemetry field inventory showing metadata-only fields such as event, source type, duration, success, and counts.

It must not include raw page text, selected text, saved snippet text, transcript text, prompts, or model output.

## Downgrade copy

First-success path, onboarding boundary, sample-loop contracts, activation event catalog checks, and a deterministic smoke-report evaluator exist in repo. Numeric activation targets and current path timing still require dated smoke evidence and/or production/cohort exports before being claimed met.
