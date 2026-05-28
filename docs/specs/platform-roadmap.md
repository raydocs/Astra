# Platform and Macro Roadmap Contract

Date: 2026-05-27

Source: macro product upgrade plan sections 15–16.

Executable source of truth: `src/utils/platform-roadmap.ts`.

## Scope

This contract defines Astra's short-term platform focus, long-term platform shape, multi-device learning-continuity value, and M1–M5 macro roadmap phases.

It does not implement a native mobile app, email delivery, API platform, checkout, or new browser-store packaging. It prevents premature claims while keeping the long-term direction explicit.

## Short-term platform focus

Astra should first stand up the core experience on:

1. **Chrome/Chromium extension** — real-time understanding layer on pages, videos, and selected text.
2. **Web companion** — learning assets, Review, account continuity, digest/support companion surfaces.

The Safari/iOS shell is experimental unless separate runtime parity, store, and privacy evidence exists. Mobile companion, email digest delivery, and API/integrations remain future/deferred product directions.

## Long-term platform roles

| Surface | Status | Role | Public claim boundary |
| --- | --- | --- | --- |
| Chrome/Chromium extension | Core now | Real-time understanding layer. | Core launch target, still gated by release/store/live evidence. |
| Web companion | Companion now | Library, Review, account continuity, digest, support. | Companion, not a full replacement for extension learning surfaces. |
| Safari/iOS shell | Experimental | Later Safari/iOS packaging and validation path. | Do not claim Chrome parity or production iOS proof. |
| Mobile companion | Future | Review and reading continuation away from desktop. | Future until mobile/PWA/native evidence and privacy review exist. |
| Email digest | Future | Weekly summary and return path. | Local digest does not imply email/push infrastructure. |
| API/integrations | Deferred | Later export, classroom, or partner workflows. | Do not market API/LMS/classroom support by default. |

## Multi-device value

Multi-device sync is not just settings/config sync. The product value is learning continuity:

- save on desktop, review on mobile;
- organize in the web app, return to the browser source;
- receive a weekly summary and continue learning from it.

Continuity requires asset identity and context such as source IDs, source titles/types, review schedules, continue links/source references, digest aggregates, and due counts.

## Macro roadmap phases

| Phase | Goal | Includes | Exit evidence examples |
| --- | --- | --- | --- |
| M1 — First Success + Trust | New users quickly succeed and trust Astra. | Demo/sample path, minimal onboarding, first save, error recovery, trust card, support entry, activation metrics. | Sample lesson loop, metadata-only support/report, trust/privacy copy, activation metric coverage. |
| M2 — Learning Loop Productization | Saving and reviewing feel rewarding. | Save feedback, light daily goal, Review context, first review flow, saved-item source card, completion state. | Daily-goal Review sizing, review context labels, saved-to-review handoff, completion state. |
| M3 — Learning Library | Users start accumulating assets. | Saved content home, Reading queue, pages/videos/files, source filters, continue learning, saved-item search. | Library home, source filters/controls, search/focus/accessibility coverage. |
| M4 — Personalization | Astra understands the learner over time. | Lightweight profile, automatic organization, glossary, preference controls, adaptive review suggestions. | Learning profile, memory inventory, write policy, reversible controls. |
| M5 — Digest + Retention | Astra establishes long-term retention. | Weekly digest, soft progress, recommendations, renewal value, member learning summary. | Local digest, retention policy, OKR metrics, non-spam guardrails. |

## Readiness

Use `evaluateAstraPlatformRoadmapReadiness()` to evaluate evidence.

Readiness blocks when:

- Chrome/Chromium extension is not treated as the core first platform;
- web companion is not scoped around learning assets and Review;
- Safari/iOS shell exceeds experimental claims;
- copy markets Astra as a full multi-platform product before the core loop is proven;
- sync value is framed as settings/config sync rather than learning continuity;
- roadmap phase order is not preserved;
- M1 First Success + Trust evidence is missing.

Readiness warns when evidence is missing for:

- long-term surface roles;
- cross-device asset continuity plan;
- phase exit criteria;
- M2/M3/M4/M5 phase evidence.

## Boundary

This contract is a product-roadmap guardrail. It should be referenced by launch copy, planning docs, support claims, and agents before adding mobile, email, API, or integration work to the default product surface.
