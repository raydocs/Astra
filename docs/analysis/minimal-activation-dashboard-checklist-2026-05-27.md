# Minimal Activation Dashboard Checklist — 2026-05-27

Source plan: `docs/plans/astra-zero-config-saas-operating-model-2026-05-27.md`, V1 Activation + Trial + Support and Section 8/34 metrics requirements.

## Scope

This slice makes the V0 activation dashboard visible from local Diagnostics without adding remote analytics or content collection.

## Implemented

- `src/utils/learning-loop-events.ts`
  - Adds canonical local activation start/value events: `extension_installed`, `onboarding_started`, `sample_started`, and `first_value_seen`.
  - Adds `aggregateLearningLoopActivationDashboard()` for local activation counts/rates:
    - activation starts;
    - onboarding completion rate;
    - first value count and P50 seconds;
    - first save rate;
    - first review completion rate;
    - trial started and Pro-value-seen counts.
  - Counts at most one first value, first save, and first review completion per activation start within the first 10-minute window so repeat saves/reviews cannot inflate first-action rates above cohort bounds.
  - Keeps the dashboard aggregate metadata-only: event names, timestamps, counts, and categories.
- `src/entrypoints/background/index.ts`
  - Records `extension_installed` on first install.
- `src/entrypoints/onboarding/OnboardingApp.tsx`
  - Records `onboarding_started` once per onboarding surface mount.
- `src/entrypoints/sample-lesson/SampleLessonApp.tsx`
  - Records `sample_started` before the existing first-content-understood event.
- `src/entrypoints/options/OptionsApp.tsx`
  - Adds a local `Activation dashboard` Diagnostics card showing V0 targets for onboarding completion, first value P50, first save rate, first review completion, trial starts, and Pro-value visibility.

## Privacy boundary

The dashboard does **not** display page text, saved snippets, transcripts, prompts, model output, emails, or full URL paths. Existing telemetry rows may include legacy event metadata, but this dashboard consumes only event/category/timestamp/count fields.

## Operating-model coverage

- V1 `Metrics | activation dashboard`: covered locally in Options Diagnostics.
- Acceptance: `onboarding completion ≥80%`: visible as rate + target state.
- Acceptance: `first value P50 <60s`: visible as local P50 seconds + target state.
- Acceptance: `first save rate visible`: visible as first save / first value.
- Acceptance: `trial cost calculable`: not changed by this slice; existing cost-risk/operator usage summaries remain the cost source.
- Acceptance: `report aggregation usable`: covered by the support-report summary slices.

## Validation

Planned command set for this slice:

```bash
pnpm test src/utils/learning-loop-events.test.ts src/entrypoints/options/OptionsApp.test.tsx src/entrypoints/onboarding/OnboardingApp.test.tsx src/entrypoints/sample-lesson/SampleLessonApp.test.tsx
pnpm type-check
pnpm check:repo-knowledge
```
