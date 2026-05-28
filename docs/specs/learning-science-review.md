# Learning Science Review Contract

Source plan: Section 22 from the macro product upgrade plan dated 2026-05-27.

Astra Review should be lightweight for ordinary users while remaining credible underneath. It is not a course system, not an expert SRS parameter UI, and not a guarantee of mastery.

## Executable source

See `src/utils/learning-science.ts`.

## Strategic decision

Default experience:

- simple card types;
- simple mastery states;
- simple feedback;
- real source context first;
- automatically generated but editable/reversible;
- no forced deck management.

## Card types

| Type | Priority | Use |
|---|---|---|
| Word Card | P0 | Word or short phrase saved from real content. |
| Sentence Card | P0 | Saved sentence/expression, or fallback when AI output is too long. |
| Cloze Card | P1 | Key collocation/expression after quality checks. |
| Video Moment Card | P1 | Saved video sentence/timestamp. |
| Correction Card | P2 | Writing correction saved by the user. |

## Feedback and states

Macro default learner-facing feedback:

- Again;
- Good;
- Easy.

Mastery states:

- New;
- Learning;
- Familiar;
- Mastered;
- Suspended.

Existing compatibility feedback, such as `Hard`, should stay secondary and should not force the default Review mental model to become an expert SRS interface.

## Scheduling defaults

First version should hide algorithm parameters but explain cards simply.

- Default daily limit: 5 cards.
- Default new-card cap: 3 cards.
- Ordinary goal copy: `3 minutes today` / `3–5 cards`.
- Again → short interval → Learning.
- Good → medium interval → Familiar.
- Easy → long interval → Familiar or Mastered.
- Mastered → low-frequency review.

Prioritization:

1. due again;
2. saved from recent sources;
3. repeated across sources;
4. user marked important.

## Product principles

- Context first: review real-source words/sentences, not isolated word lists.
- Low burden: default to about 3 minutes per day.
- Immediate feedback: after saving, tell the learner when review will happen.
- Explainable: users can understand why a card appears today.
- Reversible: users can delete, suspend, or mark cards mastered.
- No pseudoscience: promise help with review, not guaranteed mastery or exam outcomes.

## Readiness blockers

`evaluateAstraLearningScienceReadiness()` blocks readiness when:

- card types are too complex or course-like;
- mastery states are not simple;
- daily Review is not light;
- saves do not quickly produce a reviewable card or clear fallback;
- P0 cards lack source context;
- users cannot delete, pause/suspend, or mark cards mastered;
- low-quality cards cannot fall back to Snippet or Sentence Card;
- copy guarantees mastery, fluency, or exam outcomes.

It warns when feedback or scheduling explanation drifts away from the lightweight macro default.

## Current implementation relationship

The existing Review mode, Leitner/SRS helpers, source-backed vocabulary entries, daily-goal cap, and learning-asset projection provide the runtime foundation. This contract captures the Section 22 product-learning boundary so future Review work stays light, contextual, reversible, and honest.
