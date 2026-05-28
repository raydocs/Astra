# Strategic Non-Goals

_Source: [`docs/plans/astra-macro-product-upgrade-plan-2026-05-27.md`](../plans/astra-macro-product-upgrade-plan-2026-05-27.md), section 33._

Astra's near-term product strategy is to strengthen the language-learning loop:

> real content input → understanding → save → review → long-term learning asset

This document is the canonical first-pass non-goals contract for product roadmap, issue triage, agent planning, release planning, public FAQ language, and support responses. A non-goal here is **stage-specific**, not a promise that Astra will never revisit the area.

## Product principles

| Principle | Decision rule |
|---|---|
| Focus the core loop | New default-surface work must strengthen understanding, saving, review, or the learning library. |
| Hide advanced paths | Power-user features can exist when they do not pollute the default experience. |
| Do not make unproved claims | Public copy must not claim capabilities without evidence in support matrices, release notes, or live/deterministic proof. |
| Do not clone competitors wholesale | Competitive parity is only useful when it serves Astra's P0 language-learning persona. |
| Do not treat settings as the product | More controls are not a substitute for a clearer learning flow. |

## Non-goals table

| Non-goal | Why it is out of current scope | Acceptable alternative |
|---|---|---|
| 100+ provider/model console | Makes ordinary users manage infrastructure instead of learning. | Keep managed Astra relay as default; hide BYOK/provider details in advanced settings. |
| Broad “all video platforms” promise | Adapter maintenance and live-site risk are too high. | Strong support for a small set of high-value platforms, with support matrix wording. |
| Full LMS/course platform | Pulls Astra away from real content users already read/watch. | Lightweight learning paths, source-backed Library, Review, and digest. |
| Social learning community | Adds moderation/governance cost before the core loop is proved. | Share cards, personal digest, exportable learning notes. |
| Full-text content warehouse | Copyright/privacy risk, especially for page text, transcripts, and imported files. | Save snippets, metadata, user notes, and explicit user-owned exports. |
| Expert SRS parameter console | Intimidates normal users and fragments Review UX. | Opinionated lightweight review defaults plus simple goals. |
| Perfect parsing for every file format | High engineering cost and unreliable promises. | Common formats first, explicit error states, metadata-only support reports. |
| Autonomous browser action execution | Security and trust risk. | User-confirmed actions only; no hidden page automation. |
| Default diagnostic/operator UI | Makes Astra feel like a tool for developers. | “More details” and support/report modes for troubleshooting. |
| Guaranteed learning outcomes | Education outcomes cannot be promised honestly. | Promise support for understanding, saving, reviewing, and returning to source. |

## Issue triage decision tree

Use this before accepting new product-surface work into the current release window:

```text
1. Does this help the P0 persona learn from real content?
   No → backlog / reject / research only.

2. Does this strengthen understanding, saving, review, or Library assets?
   No → backlog / reject unless it is a trust/safety/reliability blocker.

3. Would it add complexity to the default UI?
   Yes → can it be hidden in Advanced without weakening the main flow?
        No → reject or defer.

4. Does it introduce privacy, copyright, billing, or security risk?
   Yes → require threat model, feature flag/kill switch, support boundary, and claim boundary before release.

5. Is it testable, reversible, and explainable to users/support?
   No → do not include in the release candidate.
```

## Release-planning checklist

A release candidate should be blocked or downgraded when any touched feature violates these checks:

- The default UI adds a P2 technical control that does not help the core learning loop.
- Public copy claims support for a provider, platform, format, or outcome beyond current proof depth.
- A non-goal area is shipped without an explicit advanced/beta/experimental boundary.
- A risky feature lacks a feature flag, kill switch, support path, or rollback note.
- The release note cannot explain how the feature helps understanding, saving, review, Library assets, trust, or reliability.

## Agent planning checklist

When an AI agent proposes or implements a feature, it must answer:

1. Which part of the core loop does this improve?
2. Is this default UI or Advanced/beta/experimental?
3. What user-facing claim becomes true, and what proof supports it?
4. What data/content is stored, exported, reported, or sent to AI?
5. How does support explain a refusal, limitation, or fallback if users ask for more?

If those answers are missing, the agent should produce a plan or triage note before editing source.

## Public FAQ boundary

Use this language as a public-facing baseline:

- **Does Astra replace a full course platform?** No. Astra helps you learn from real content you already read or watch, then save useful moments for review.
- **Does Astra support every video site or file format?** No. Astra supports selected high-value surfaces first and labels other surfaces as beta, experimental, or unsupported.
- **Can Astra guarantee fluency or test results?** No. Astra can help with understanding, saving, reviewing, and returning to source context; outcomes depend on usage and practice.
- **Does Astra store entire pages or transcripts by default?** No. Astra's learning assets and support reports should prefer snippets, metadata, and explicit user-owned exports rather than full-content warehousing.
- **Is Astra a general AI automation agent?** No. Astra does not autonomously execute browser actions; user-confirmed learning actions stay in control.

## Support response macros

### Unsupported broad-provider/model console request

> Thanks for the request. Astra's default experience is intentionally focused on language learning rather than a large provider console. We keep advanced provider/BYOK options bounded so the main flow remains understandable. If your need is reliability or quality, tell us the surface and language pair so we can improve the managed default or document an advanced workaround.

### Unsupported platform/file-format request

> Astra does not currently promise universal support for every platform or file format. We prioritize surfaces where we can provide reliable learning context, privacy boundaries, and proof. If you share the platform/format and what you were trying to learn, we can track it for support-matrix review or suggest an import/export path.

### Learning-outcome guarantee request

> Astra can help you understand real content, save useful snippets, and review them later, but we cannot guarantee fluency, grades, or test outcomes. We can help you set a review routine and diagnose whether the learning loop is working for your content.

### Full-content storage/export request

> Astra is designed to avoid becoming a full-text warehouse by default. We focus on user-selected snippets, source metadata, notes, and explicit exports. This protects privacy and reduces copyright risk while keeping learning assets useful.

## Review cadence

Revisit this document at least quarterly or when a release intentionally promotes a non-goal area from deferred → advanced/beta/default. Any promotion needs updated support wording, claim proof, and release-gate coverage.
