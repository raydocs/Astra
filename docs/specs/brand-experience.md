# Brand and Aesthetic Experience Contract

Date: 2026-05-27

Source: macro product upgrade plan section 13.

Executable source of truth: `src/utils/brand-experience.ts`.

## Brand feeling

Astra's default user-facing experience should feel:

- quiet;
- automatic;
- reliable;
- refined;
- lightweight;
- clear;
- next-step oriented;
- not like a back-office system.

This contract is about product feel and default-surface decision-making. It does not replace the design-token system or component implementation details.

## Copy rules

Say less:

- Configure
- Provider
- Route
- Relay
- Token
- Debug
- Advanced
- Error code

Say more:

- Ready
- Done
- Keep reading
- Review later
- Saved for review
- Astra handled it
- Best for this content
- Try again

Use `findDiscouragedBrandTerms()` to screen default product copy before it appears in onboarding, popup, content overlays, Review, Library, paywall, support/report, store copy, or landing copy.

## UI principles

| Principle | Release implication |
| --- | --- |
| One screen, one primary action | Pick a dominant next learning action; demote peer actions. |
| Low-frequency features collapsed | Hide diagnostics, export, raw settings, and rare tools behind secondary paths. |
| Diagnostics not default | Support/operator/debug views may show diagnostics; learning surfaces should not. |
| Task cards over setting tables | Default screens should organize around read, save, review, continue, digest, and support tasks. |
| Status pills | Prefer concise state labels such as Ready, Saved, Due, Synced, Done, or Try again. |
| Group by user task | Avoid provider/route/model/cache grouping in default UI. |
| Advanced settings secondary | Advanced controls can exist, but should not shape first-run or default learning surfaces. |
| Error cards have action | Every error card needs Try again, Keep reading, Change settings, Report, or Learn more. |

## Default-surface audit inventory

`ASTRA_BRAND_DEFAULT_SURFACE_AUDIT` maps the Section 13 manual QA rows to repo-backed surfaces and the remaining proof boundary.

| Section 13 row | Default surface | Current repo evidence |
| --- | --- | --- |
| Default onboarding copy | First-run onboarding and sample/ready path | `src/entrypoints/onboarding/OnboardingApp.tsx`, `src/entrypoints/onboarding/OnboardingApp.test.tsx` |
| Popup / Deep Read copy | Popup, Deep Read, and selection learning actions | `src/entrypoints/popup/App.tsx`, `src/entrypoints/content/components/FloatBall.tsx` |
| Library / Review copy | Library, Weekly Digest, and Review loop | `src/entrypoints/vocabulary/VocabularyApp.tsx`, `src/entrypoints/vocabulary/ReviewMode.tsx` |
| Error/boundary copy | Errors, known limitations, degraded status, and support/report boundaries | `docs/help/known-limitations.md`, `docs/status.md`, `src/utils/support-experience.ts` |
| Store/landing copy claim freeze | Store listing, website, demos, and release-note copy | `store/listing-copy.md`, `docs/reviews/macro-gate-4-claim-review-2026-05-28.md`, `docs/reviews/macro-rc-evidence-packet-2026-05-28.md` |

Use `evaluateAstraBrandDefaultSurfaceCopyAudit()` with representative copy samples before changing default-surface text. A surface is copy-ready only when it has no discouraged terms and uses at least one preferred learning-tone phrase.

## Emotional value

Astra is not only an efficiency tool. Key loop moments should show learning achievement:

- `Nice — your first review card is ready.`
- `You are building a learning trail from real content.`
- `Done for today.`
- `You came back 3 days in a row.`

These messages should be used carefully: they should celebrate actual learning progress, not spam engagement.

## Readiness

Use `evaluateAstraBrandExperienceReadiness()` with evidence from UI/copy review.

Readiness blocks when default surfaces:

- use back-office terms;
- do not use quiet learning-oriented language;
- show competing primary actions;
- expose low-frequency features by default;
- show diagnostics by default;
- group default UI by technical modules;
- make advanced settings part of the default experience;
- show error cards without recovery actions.

Readiness warns when evidence is missing for:

- task-card layouts;
- status-pill/equivalent state language;
- emotional-value copy in the learning loop;
- shared token-based visual system usage.

## Boundary

This contract does not claim every existing screen is fully redesigned. It gives future implementation and review work a deterministic gate for deciding whether a default user-facing surface still feels too much like a provider console, diagnostics panel, or backend system.

The current repo-side Section 13 evidence note is `docs/reviews/brand-default-surface-evidence-note-2026-05-28.md`. Stronger brand-quality claims still require filled manual QA rows with owner/date/environment/evidence/verdict fields and current screenshots or browser walkthroughs.
