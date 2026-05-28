# Personalization Experience Contract

Source plan: Section 7 from the macro product upgrade plan dated 2026-05-27.

Astra personalization should reduce setup. Users should feel understood without maintaining a complex configuration panel or glossary database.

## Executable source

See `src/utils/personalization-experience.ts`.

## Lightweight profile

Default personalization is limited to:

- target language;
- current level;
- learning purpose;
- explanation preference;
- daily learning time.

Default onboarding should ask only the first-success-safe subset: target language, approximate level, and primary learning purpose. Explanation preference and daily time may live in settings or later tuning.

Learning purposes:

- understand web pages;
- understand videos;
- work and study;
- exam prep;
- interest reading;
- build vocabulary.

## Behavior influence

Profile and preferences should influence product behavior, not just sit in storage:

- explanation depth;
- grammar visibility;
- save recommendations;
- Review difficulty;
- summary style;
- terminology explanation;
- listening / shadowing recommendations;
- daily goal size.

The default direction is automatic adaptation with ordinary-language controls, not a visible rules engine.

Current Review behavior uses this contract directly: the primary learning goal can reorder due cards toward matching sources, daily learning time sizes the session, and the Review plan card explains the applied level/explanation preference plus the Options path to change or turn off personalization.

## Personal Glossary

Do not ask users to manually maintain a complex glossary. Allowed signals are:

- user-saved terms;
- corrections or preferred translations the user confirms;
- common terms from allowed sites;
- proper nouns;
- people, product, and technical terms that are useful for learning and allowed by the write policy.

User-facing copy should stay simple:

> Astra remembered your preferred terms.

## Reversibility controls

P0 controls:

- see what Astra remembers;
- delete a remembered term or preference;
- turn off personalization;
- do not learn from this site.

The local Library memory tab satisfies the first three controls for local state: it shows `What Astra remembers`, lets users forget individual remembered terms or clear local remembered terms, and exposes a turn-off-personalization action. Per-source controls also support local digest exclusion and sync disablement. Server/cloud memory inventory, cloud deletion proof, automated topic/glossary suggestion review, and a full Privacy Mode enforcement audit remain deferred.

Automatic writes must respect Privacy Mode, personalization-off, and excluded-host states.

## Readiness blockers

`evaluateAstraPersonalizationReadiness()` blocks readiness when:

- default profile collection is not lightweight;
- preferences do not influence the required behaviors;
- glossary signals are missing or unbounded;
- users cannot view, delete, disable, or site-exclude personalization;
- memory writes ignore Privacy Mode, personalization-off, or excluded-site policy.

It warns when personalization technically exists but adds visible configuration burden, or when glossary copy asks users to understand a technical glossary system.

## Current implementation relationship

The current local learning profile, Options personalization memory card, remembered-term controls, and learning-memory write policy already provide a foundation. This contract makes Section 7's product rules explicit for future UI and AI behavior changes.
