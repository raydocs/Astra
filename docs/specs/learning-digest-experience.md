# Learning Digest Experience Contract

Source plan: Section 12 from the macro product upgrade plan dated 2026-05-27.

Learning Digest exists to make long-term value visible: what the learner read or watched, what they saved, what they reviewed or mastered, and what they should do next.

## Executable source

See `src/utils/learning-digest-experience.ts`.

## Weekly digest content

The digest may contain:

- pages read this week;
- learning videos watched this week;
- new saved words and sentences;
- reviewed cards;
- common topics;
- repeated vocabulary;
- recommended review;
- recommended continue reading or watching.

The summary should use counts, source titles/types, due-card counts, timestamps, and user-visible saved items under explicit policy. Telemetry and external delivery must not include raw page text, transcripts, file text, card front/back text, or saved snippet text by default.

## Surfaces and interruption level

Default low-interruption surfaces:

- Popup small card;
- Web companion page.

Later optional surfaces:

- email, only with subscription/opt-in state and unsubscribe;
- notification, only with browser permission, low frequency, and easy disable controls.

Privacy Mode should prefer in-product summaries and suppress or reduce optional email/notification detail.

## Copy examples

- `You learned 12 expressions from 3 pages this week.`
- `5 cards are ready for a quick review.`
- `You kept seeing “resilience” across two articles.`
- `Continue your YouTube lesson from 08:32.`

## Readiness blockers

`evaluateAstraDigestReadiness()` blocks readiness when:

- long-term learning value is not visible;
- required weekly content coverage is incomplete;
- Review and continue-learning actions are missing;
- delivery is interruptive by default;
- optional email/notification digest lacks controls;
- summaries include raw content by default;
- Privacy Mode does not constrain external delivery.

It warns when digest copy does not represent the macro-plan examples.

## Current implementation relationship

The current local Library weekly digest card and retention loop policy are foundations. The Library card now renders aggregate saved/reviewed/source counts, due-review count, a Review CTA, a Continue source CTA when an eligible source exists, repeated confirmed vocabulary across sources, and coarse common topics when source metadata provides them. This contract still keeps email/notification delivery and production digest claims behind explicit opt-in, Privacy Mode, and QA evidence.

First-90 P0 observability is local-only: the Library weekly digest card records `digest_viewed` once per visible week/card in a component lifetime, the card's Review CTA records `digest_opened` before switching to Review, and the Continue source CTA records `continue_clicked` before opening the Reading queue. Source-level exclusion from existing Reading queue controls records `reminder_disabled` only when exclusion is newly enabled.

These events are metadata-only. Allowed fields are week window, aggregate saved/reviewed/source/reviewable/topic/repeated-vocabulary/recommended-review counts, reminder/control scope, UI surface, source type, source status, and privacy-mode boolean. They must not include source ids, titles, URLs, snippets, page/file/transcript text, prompts, or model output.
