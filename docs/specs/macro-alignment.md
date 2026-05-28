# Macro Alignment and Final Conclusion Contract

Source plan: [`docs/plans/astra-macro-product-upgrade-plan-2026-05-27.md`](../plans/astra-macro-product-upgrade-plan-2026-05-27.md), sections 17–18.

This contract keeps the competitor-remediation work connected to the macro product upgrade without letting the macro plan collapse back into “more translation buttons.”

## Executable contract

- Code: `src/utils/macro-alignment.ts`
- Tests: `src/utils/macro-alignment.test.ts`

The code exports three stable product lists plus a readiness helper:

1. `ASTRA_COMPETITIVE_REMEDIATION_RESPONSIBILITIES`
2. `ASTRA_MACRO_UPGRADE_RESPONSIBILITIES`
3. `ASTRA_FINAL_CONCLUSION_PILLARS`
4. `evaluateAstraMacroAlignmentReadiness()`

## Competitive remediation responsibilities

Competitive remediation is responsible for proving Astra has trustworthy core comprehension capability before the macro product upgrade asks users to rely on it.

The required responsibilities are:

1. **Trusted page translation** — prove web/page translation reliability; do not re-open DOM-strategy breakdowns inside macro product work.
2. **Trusted video and subtitle experience** — prove video/subtitle comprehension; macro product work should convert video moments into saved learning assets and retention.
3. **Zero-config technical chain** — prove managed routing, provider, relay, cache, and service-mode reliability; default users should not see those technical details.
4. **Read Frog / Immersive core parity** — reach or exceed core comprehension expectations; macro product differentiation comes from learning memory and retention.

## Macro upgrade responsibilities

The macro product upgrade is responsible for making Astra chargeable, retainable, and accumulative as a learning platform.

The required responsibility set is:

1. **New user activation** — first success path, sample lesson, onboarding scope, activation metrics.
2. **Payment reason** — membership value beyond usage: no setup, stability, quality, learning loop, assets, support.
3. **Learning asset accumulation** — saved snippets/cards/sources, Library, Review, export/delete controls.
4. **Long-term retention** — daily Review, Digest, continue learning, retention guardrails.
5. **User trust** — privacy controls, support metadata, accurate claims, data retention boundaries.
6. **Brand differentiation** — quiet, learning-first, non-technical, refined product tone.

## Final conclusion pillars

Astra’s final macro conclusion is not that it has more translation surfaces than competitors. The conclusion is:

> Read Frog and Immersive mainly help users understand current content; Astra should help users turn current content into long-term language ability.

The required pillars are:

1. Users succeed quickly the first time they use Astra.
2. Users do not configure AI before value.
3. Saved content does not disappear into a black hole.
4. Users know what to review each day.
5. Pages, videos, and files gradually become personal learning assets.
6. Astra understands the learner more over time.
7. Users pay for peace of mind, stability, learning loop, and asset accumulation.

## Readiness checks

`evaluateAstraMacroAlignmentReadiness()` blocks readiness when:

- competitive-remediation responsibilities are not clearly separated;
- macro-upgrade responsibilities are unclear;
- final-conclusion pillars are incomplete;
- default positioning still sounds like more translation buttons;
- the product promise does not reach long-term language ability.

It warns, but does not block, when engineering remediation is not yet tied to the macro product upgrade. That lets remediation continue independently while still requiring product surfaces to show how trusted comprehension feeds first success, saving, Review, Library, Digest, and membership value.

## Scope boundary

This file is a product-contract foundation, not a claim that every competitive capability is already production-complete. Production evidence still belongs in the relevant implementation tracks: page translation, video/subtitle, managed AI reliability, Library, Review, Digest, membership, support, trust, and release gating.
