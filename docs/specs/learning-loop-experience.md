# Learning Loop Experience Contract

Date: 2026-05-27

Source: macro product upgrade plan section 5.

Executable source of truth: `src/utils/learning-loop-experience.ts`.

## Scope

This contract ensures Astra avoids the common learning-tool failure where saving becomes a black hole. Saving should immediately explain destination, review timing, source linkage, and visible progress.

## Save feedback

Do not only say `Saved.` Preferred save feedback includes:

- `Saved for review tonight`
- `1 of 5 cards for today`
- `Added to your learning queue`
- `You are building a deck from this page`
- `Review this later in 1 minute`
- `This sentence is now linked to the source page`

## Lightweight goals

Astra should not expose ordinary users to a complex study system by default.

Default goal shape:

- save 1–3 useful expressions per day;
- review 3–5 cards per day;
- see one learning summary per week.

User-facing copy examples:

- `3 minutes today`
- `Review 5 cards`
- `Done for today`
- `You learned 8 expressions this week`

## Review context

Review cards should preserve as much of the real learning context as possible:

- original sentence;
- translation;
- explanation;
- source title;
- source type;
- original page link when available;
- video timestamp when available;
- saved date;
- context paragraph when appropriate.

The user should feel:

> This is not an isolated flashcard; it is something I really read or watched.

## Readiness

Use `evaluateAstraLearningLoopReadiness()` with evidence from save UI, Review, Library/source context, daily-goal sizing, and digest/progress surfaces.

Readiness blocks when:

- save feedback does not explain destination;
- save feedback does not explain the next review;
- save feedback does not confirm source linkage;
- daily Review goal is not lightweight;
- Review cards lack required context fields;
- Review cannot return to source when source context exists;
- Review feels like isolated flashcards rather than real content.

Readiness warns when:

- save feedback does not show queue/daily progress;
- daily save goal is not light;
- weekly summary is not visible;
- learner progress is not visible.

## Boundary

This contract does not replace the SRS algorithm or Library data model. It defines the user-facing learning-loop experience those systems must support.
