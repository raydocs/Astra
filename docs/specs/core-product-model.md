# Core Product Model Contract

Date: 2026-05-27

Source: macro product upgrade plan sections 0–3.

Executable source of truth: `src/utils/product-model.ts`.

## Scope

This contract defines Astra's macro product model: the boundary between product strategy and competitive engineering remediation, the core judgment that Astra cannot win only on translation, the desired end-state mental model, and the three-layer product model.

It does not replace engineering plans for page translation, YouTube captions, Transcript Panel, FloatBall, serviceMode, bench/live proof, or provider/API/model UI cleanup.

## Macro plan boundary

This macro plan answers:

> How does Astra evolve from a useful translation extension into a managed AI language-learning platform that ordinary users trust, keep using, and may pay for?

It should not repeat:

- Read Frog / Immersive Translate feature parity work;
- page-translation DOM strategy;
- YouTube player-button engineering;
- Transcript Panel engineering breakdowns;
- FloatBall V2 implementation details;
- serviceMode schema/router/cache-key design;
- bench-live scenario catalogs;
- provider/API/model UI cleanup as user-facing value.

## Core judgment

Astra should not win only by translating better. Translation capability, providers, subtitles, and feature parity can be copied. The harder-to-copy moat is the user's learning memory:

- saved words and sentences;
- reviewed content;
- video learning notes;
- reading history and learning assets;
- user preferences and terminology understanding;
- daily habit of returning to learn.

Long-term goal:

> Turn the foreign-language content users read, watch, and save every day into personal language ability.

## Desired mental model

Risky mental model:

> A more complex AI translation plugin.

Desired mental model:

> A managed AI language-learning assistant: users read pages, watch videos, and open files while Astra automatically helps them understand, save what matters, and review later.

Users pay for:

- no setup;
- stable availability;
- better translation and explanation quality;
- content that compounds into learning assets;
- knowing what to review today;
- visible long-term learning progress.

Users should not be asked to value Astra as paying per translation.

## Slogan directions

English:

- `Read anything. Learn what matters.`
- `Just read. Astra handles the AI.`
- `Turn everyday reading into language memory.`
- `Your browser language teacher — no setup required.`
- `Understand now. Remember later.`

Chinese:

- 打开就能读，读过就能学。
- 不用配置 API，Astra 自动帮你理解和复习。
- 把网页和视频变成你的语言课。
- 你只管阅读，Astra 帮你沉淀。

## Three-layer product model

| Layer | Goal | Capabilities | Key principle |
| --- | --- | --- | --- |
| Capture Layer | Astra appears lightly wherever the user encounters foreign-language content. | Pages, videos, files, selected text, input boxes, reading queue. | Do not interrupt, dominate the page, require setup, or force users to understand content-source mechanics first. |
| Understanding Layer | Transform content into understandable material. | Translation, explanation, summary, grammar, hard-sentence breakdown, keywords, term consistency, learning suggestions. | Serve comprehension before controls and keep technical routing invisible. |
| Learning Memory | Turn understanding into remembering. | Saved words/sentences, review cards, review plan, Library, weekly digest, glossary, return to source. | Preserve learning assets, make progress visible, keep memory reversible, and return users to context. |

The product handoff should be:

> real content → understanding → saved/reviewable learning asset → return path / progress memory.

## Readiness

Use `evaluateAstraProductModelReadiness()` with evidence from copy, onboarding, GTM, Library/Review, trust, metrics, and platform contracts.

Readiness blocks when:

- the macro boundary is not respected;
- default positioning reads like a generic translation plugin;
- managed AI language-learning assistant promise is missing;
- the default path requires setup or AI-provider understanding;
- the learning-asset moat is not defined;
- any product layer is missing;
- payment value is framed as paying per translation.

Readiness warns when:

- layer handoff evidence is missing;
- slogans drift away from learning memory;
- the seven macro product questions do not have supporting evidence.

## Boundary

This contract is intentionally high-level. Implementation details belong in the specialized contracts and source modules referenced by the macro foundation document.
