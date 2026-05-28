# Product Strategy Contract: Persona, JTBD, and Paywall

Date: 2026-05-27

Source: macro product upgrade plan sections 19–21.

Executable source of truth: `src/utils/product-strategy.ts`.

## Scope

This document turns three product-strategy chapters into a release-readable contract:

1. Section 19 — Beachhead persona.
2. Section 20 — Jobs-to-be-Done scenarios.
3. Section 21 — Pricing, trial, and paywall strategy.

It does not implement checkout, billing, provider routing, or new UI. It defines the default product direction that UI, copy, growth, onboarding, and agents should use when deciding what belongs in the first release surface.

## Beachhead persona

Astra's first-stage beachhead is:

> Chinese-native knowledge workers, students, and self-directed learners who encounter English web pages, videos, and documents every day and want understanding plus review without AI setup.

Default surfaces should include these ideas:

- Chinese-first explanation context.
- Real English pages, technical docs, news, papers, tutorials, and videos.
- Faster understanding of real content.
- Saving useful expressions into reviewable learning assets.
- No provider, API key, model, or prompt setup in the default path.

Default surfaces should not optimize for:

- all language learners;
- AI provider-console users;
- complete course/LMS buyers;
- generic translation-only users.

## Persona priority

| Persona | Priority | Product promise | Default boundary |
| --- | --- | --- | --- |
| Chinese knowledge worker | P0 | Understand real English content faster and save key expressions for review. | Do not expose complex model configuration. |
| English video learner | P0 | Understand video moments and save reusable sentences. | Do not promise every video platform. |
| Student/exam learner | P1 | Explain difficult passages and turn vocabulary into review cards. | Do not become a complete exam course. |
| Work communication user | P1 | Improve natural English expression and remember corrected patterns. | Do not become a team collaboration suite. |
| AI power user | P2 | Advanced mode may preserve control. | Do not shape default UX around this persona. |

## JTBD scenarios

Every default product entry should map to at least one scenario in `ASTRA_JTBD_SCENARIOS`.

| Scenario | Priority | Success moment | Next step | Fallback |
| --- | --- | --- | --- | --- |
| Read English article | P0 | First screen/selected passage becomes readable. | Save a sentence or continue Deep Read. | Translate selected passage, open Reader, retry later. |
| Read technical documentation | P0 | Term receives stable contextual explanation. | Add the term to personal glossary. | Simplified explanation, save term for later. |
| Watch English video | P0 | Current subtitle/video sentence becomes understandable. | Save sentence or generate note. | No-subtitle explanation, manual segment selection. |
| Explain word/phrase | P0 | Explanation matches the current sentence. | Save as review card. | Brief translation. |
| Write natural English | P1 | Input box receives usable expression. | Save correction card. | Copy suggestion. |
| Daily review | P0 | Three to five cards reviewed. | Return to source or continue a source. | Reduce today's goal. |
| Weekly learning recap | P1 | Digest summarizes progress clearly. | Continue unfinished source. | Local data only. |

## Default entry mapping

The contract maps these default entries to JTBD scenarios:

- landing hero;
- Chrome Web Store listing;
- onboarding goal;
- sample lesson;
- content selection toolbar;
- video transcript panel;
- Library home;
- Review queue;
- Weekly Digest;
- paywall;
- help center.

A new default feature should not ship in the default UI unless it can name its JTBD, success moment, next best action, learning asset, fallback, and metric. Advanced or P2-only entries should live in Advanced/Settings/backlog until they pass this test.

## Paywall strategy

Public tiers are Free, Trial, and Pro, but beta public surfaces must still respect the existing billing-disabled boundary until billing/legal readiness is signed off.

### Public promise

- **Free:** complete first success and a lightweight learning loop.
- **Trial:** experience Pro value through three aha moments.
- **Pro:** Astra handles the AI so the user can focus on reading and learning.

### Trial aha moments

1. Understand real content.
2. Save for review.
3. See long-term value through Library, Digest, or continue-source prompts.

### Trigger rules

- No hard paywall before first understanding.
- First-install/pre-value copy may explain value but must not block.
- Free-limit, long-content, sync, export, and priority-support paywalls may block after the user has seen value.
- Digest and after-first-understanding prompts should be soft unless a paid feature is explicitly requested.
- Cancellation must not make existing saved items disappear; existing assets should remain viewable/exportable according to the data-retention contract.

## Copy rules

Paywall copy should sell:

- peace of mind;
- stable long-content learning;
- deeper explanations;
- video/file learning;
- saved learning assets;
- Review/Library sync;
- Digest;
- support and maintenance.

Paywall copy must not sell infrastructure terms such as token, provider, model, batch, route, cache, relay, API key, OpenAI, Gemini, or OpenRouter. Use `findPaywallTechnicalTerms()` to screen candidate copy.

## Readiness

Use `evaluateAstraProductStrategyReadiness()` with evidence from copy review, onboarding review, store/GTM review, JTBD mapping, entitlement/billing review, and retention/data-control review.

Readiness blocks if any of the following evidence is missing:

- beachhead persona defined;
- persona copy unified across onboarding, landing, store, and paywall;
- onboarding has no more than three core questions before first success;
- sample content covers article, technical documentation, and video summary use cases;
- P0 growth channels align to the same persona;
- default entries map to JTBD;
- every JTBD has success moment, next step, source-returning asset path, and fallback;
- paywall copy has zero technical terms;
- no hard paywall before first value;
- trial aha moments are instrumented;
- cancellation keeps existing assets accessible;
- beta billing-disabled boundary is respected.
