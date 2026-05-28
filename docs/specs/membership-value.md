# Membership Value Contract

Source plan: Section 8 from the macro product upgrade plan dated 2026-05-27.

Membership value should not be sold as “more usage” alone. It should explain why Astra is worth paying for as a managed language-learning system: no setup, appropriate AI capability, stability, quality, learning assets, Review, continuity, support, and maintenance.

## Executable source

See `src/utils/membership-value.ts`.

## Value reasons

Astra membership value is framed around:

- no AI setup;
- automatic capability choice;
- stable service;
- faster understanding;
- higher-quality understanding;
- unified pages, videos, and files;
- content that can be saved;
- automatic Review;
- multi-device continuity;
- support and continuous maintenance.

## Prompt timing

Do not hard-sell at app open or before first value. Membership prompts should appear near value moments:

| Moment | Style | Copy direction |
|---|---|---|
| First high-quality explanation | soft hint | Included with your membership: deeper explanations when the content gets difficult. |
| Saved multiple sentences | near value | Your saved sentences become review cards. |
| Long content summary | hard block after value | Best for long or technical content. |
| Cross-device sync | hard block after value | Keep learning across devices. |
| Long video learning | hard block after value | Longer videos are included with Pro. |
| Learning data export | hard block after value | Export your learning assets while existing saved items stay accessible. |

## Copy rules

Preferred:

- `Included with your membership`
- `Astra handles the AI for you`
- `Your saved sentences become review cards`
- `Keep learning across devices`
- `Best for long or technical content`

Forbidden:

- `Unlock provider routing`
- `Use premium model`
- `Increase token quota`
- `Relay usage exceeded`

Payment copy should not expose provider, routing, model, token, quota, or relay internals.

## Tier boundaries

### Free

- small daily understanding allowance;
- selection and short-text experience;
- small saved-word/sentence set;
- local basic Review;
- sample content experience.

### Pro

- managed AI;
- higher fair-use limits;
- high-quality understanding;
- video learning;
- file learning;
- learning asset library;
- sync;
- Learning Digest.

### Premium / Family / Classroom later

Deferred until billing, abuse, support, legal, and product evidence exist:

- longer videos;
- higher-quality model class where legally and operationally ready;
- multiple users;
- export;
- classroom or family management;
- specialized learning plans.

## Readiness blockers

`evaluateAstraMembershipValueReadiness()` blocks readiness when:

- membership value is only “more usage”;
- hard sells appear before first value;
- feature-proximate value moments are missing;
- technical provider/model/token/relay copy leaks into membership copy;
- Free / Pro / later boundaries are unclear;
- existing saved learning assets are not protected after cancellation.

It warns when preferred learning-first membership copy is not represented.

## Current implementation relationship

The existing product-strategy/paywall contract covers Free/Trial/Pro and no-technical-copy rules. This contract adds Section 8's dedicated value-expression layer: why people pay, when prompts should appear, and how Free/Pro/later claims should be bounded.
