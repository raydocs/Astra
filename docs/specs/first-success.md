# First Success Path Contract

Date: 2026-05-27

Source: macro product upgrade plan section 4.

Executable source of truth: `src/utils/first-success.ts`.

## Scope

This contract defines Astra's first-success path: a normal user should quickly see that they can understand foreign-language content without technical setup, save one useful item, and see the first Review.

## Standard path

1. Install Astra.
2. Choose target language.
3. Optionally sign in or start membership when appropriate.
4. Complete first understanding on a real page or sample page.
5. Save one word or sentence.
6. See first Review.

The first strong result should be:

> I do not need to understand the technology, and I really can read foreign-language content.

## Onboarding boundary

First-run onboarding should ask only:

1. target language;
2. approximate level;
3. primary goal.

It should not ask for:

- model;
- provider;
- prompt;
- technical configuration;
- advanced site rules;
- sync details.

## Sample lesson flow

The sample lesson exists so users can experience the whole loop even when they do not immediately have a suitable page.

Required sample flow:

1. Click `Try Astra on a sample page`.
2. Open a short article.
3. Astra shows understandable content.
4. Highlight a recommended sentence.
5. User saves the sentence.
6. User enters one-card Review.
7. UI shows `You just created your first review card` or equivalent first-win copy.

## Metrics

| Metric | Target | Privacy boundary |
| --- | --- | --- |
| Install to first understandable content | < 60 seconds | Duration/source type only; no content text. |
| First understanding success rate | > 95% | Success/failure and coarse source type only. |
| First saved word/sentence rate | > 25% | Save metadata only; no saved text. |
| First Review reach rate | > 15% | Review metadata only; no card text. |
| Day-after-first-use return | Optimize by cohort | Aggregate cohort retention only. |

Canonical event names:

- `onboarding_completed`
- `first_content_understood`
- `saved_snippet_created`
- `review_session_completed`

These names must remain part of the activation dashboard event catalog and be consumed by `aggregateLearningLoopActivationDashboard()`.

## Activation smoke report guardrail

Use `evaluateAstraFirstSuccessSmokeReport()` for a dated single-run smoke report before it is attached as RC evidence. A valid smoke report must include:

1. the completed onboarding/sample first-success path;
2. the required activation event sequence;
3. seconds to first understandable content, with values above 60 seconds flagged;
4. telemetry field names proving raw content fields are excluded;
5. first saved item and first Review completion evidence.

This smoke report can support path/timing evidence for one environment. It still does not prove cohort targets such as >95% first-understanding success, >25% first-save rate, or >15% first-review reach.

## Readiness

Use `evaluateAstraFirstSuccessReadiness()` with evidence from onboarding, sample lesson, activation telemetry, and metrics review.

Readiness blocks when:

- first understandable content is not proven within 60 seconds;
- onboarding asks more than the three core questions;
- onboarding exposes technical setup;
- sample-page entry is missing;
- sample article understanding is missing;
- recommended sentence save is missing;
- one-card Review is missing;
- activation events are missing;
- activation telemetry may include content text.

Readiness warns when:

- first-review achievement copy is missing;
- numeric success/save/review targets are not yet evidenced.

## Boundary

This contract does not claim that activation metrics already meet final launch targets. It makes the first-success route and evidence requirements explicit so release, GTM, onboarding, and sample-lesson work can be audited consistently.

The current repo-side Section 4 evidence note is `docs/reviews/first-success-activation-evidence-note-2026-05-28.md`. Stronger activation claims still require a dated smoke report and/or production/cohort dashboard exports for the target build.
