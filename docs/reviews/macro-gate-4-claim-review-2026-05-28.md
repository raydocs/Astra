# Macro Gate 4 Claim Review — 2026-05-28

Source objective: complete the macro product upgrade plan from `/Users/ruirui/Downloads/astra-macro-product-upgrade-plan-2026-05-27 (1).md` without making claims beyond current proof.

This is a repository-side Gate 4 review for the current macro-plan worktree. It reviews claim wording against proof artifacts and documents required downgrades. It is **not** a final RC approval, CI artifact upload, legal review, store submission approval, paid-launch signoff, or human accessibility signoff.

## Decision

| Decision item | Verdict | Reason |
|---|---|---|
| Repo-side Gate 4 claim alignment | Pass with downgrades | Core docs and current RC evidence can support a public-beta / repo-evidence claim when downgrade copy is used for unproved surfaces. |
| Final RC signoff | Pending | CI `quality` / `live-browser` uploaded artifacts and owner release approval are still required for the same commit/worktree. |
| Paid launch / Trial / Pro claims | Blocked | Billing, entitlement, cancel/refund, legal, and production trust evidence are not attached. |
| Store submission complete claim | Blocked | Hosted URLs, final screenshots, package hash, upload/submission, and reviewer evidence are not attached. |
| GTM launch packet complete claim | Blocked | Final demo captures, screenshots, and launch media evidence are not attached. |
| Production metric maturity claim | Blocked | Production/cohort dashboard exports are not attached. |
| Broad accessibility compliance claim | Blocked | Browser-backed evidence exists, but human no-mouse, scaled text, contrast, and screen-reader evidence is still incomplete. |
| Platform parity claim | Blocked | Chromium is primary supported; Firefox/Safari are beta; iOS Safari shell remains experimental. |
| Broad privacy/local-only claim | Blocked | Privacy Mode is request-context sanitization, not local-only AI or end-to-end secrecy. |
| Universal file/video/platform support claim | Blocked | Proof-backed wording must name controlled PDF/EPUB/SRT/VTT reader flows and YouTube in-page subtitle support; Bilibili is beta/best-effort; other adapters/formats stay scoped. |

## Inputs reviewed

| Artifact | Gate 4 role |
|---|---|
| `docs/release-readiness-checklist.md` | Defines Gate 4A/4B blocking rules and surface-conditional review requirements. |
| `docs/reviews/macro-rc-evidence-packet-2026-05-28.md` | Current validation/evidence packet for this macro worktree. |
| `docs/reviews/macro-operational-evidence-rc-note-2026-05-28.md` | Downgrade copy and operational evidence gaps generated from the macro operational evidence model. |
| `docs/reviews/macro-plan-completion-audit-2026-05-27.md` | Section-by-section macro-plan status and remaining blockers. |
| `docs/investigations/workstream-a-live-coverage-matrix.md` | Live scenario / required-lane truth source. |
| `docs/investigations/workstream-f-live-lane-conventions.md` | Required release-proof lane names and scenario inventory. |
| `docs/investigations/workstream-f-live-flaky-inventory.md` | Known live flake boundary; currently keeps subtitle timing risk explicit for non-required lane. |
| `docs/investigations/support-matrix-2026-q2.md` | Canonical platform, reader, and support-claim boundaries. |
| `docs/capability-matrix-v2.md` | Capability progress matrix; explicitly not a release-claim override. |
| `docs/specs/strategic-non-goals.md` | Non-goals decision tree and public/support claim boundaries. |
| `README.md` | Public-facing repo copy checked for support/privacy/capability overclaim boundaries. |
| `docs/reviews/accessibility-browser-evidence-note-2026-05-28.md`, `docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md` | Browser-backed accessibility-relevant evidence note plus the owner/date/environment/evidence/verdict checklist for remaining manual QA rows. |
| `docs/investigations/month-3-evidence-registry-2026-04-14.md`, `docs/investigations/month-3-closeout-inputs-2026-04-14.md` | Reader / owned-reading conditional bundle; now read with current `document-proof` release-policy updates. |
| `docs/investigations/support-matrix-video-addendum-2026-04-15.md`, `docs/investigations/video-subtitle-adapter-inventory-2026-04-15.md`, `docs/investigations/month-4-video-smoke-replay-2026-04-16.md` | Video / subtitle conditional bundle and adapter claim boundaries. |
| `docs/investigations/control-plane-surface-inventory-2026-04-15.md`, `docs/investigations/lifecycle-operations-runbook-month5-2026-04-15.md`, `docs/investigations/month-5-lifecycle-proof-2026-04-14.md` | Account/control-plane lifecycle conditional bundle. |
| `ios/README.md`, `docs/ios-safari-smoke-test.md`, `docs/investigations/month-5-mobile-ios-smoke-notes-2026-04-16.md` | iOS shell / mobile web claim-boundary bundle. |
| `docs/investigations/month-6-release-claim-audit-2026-04-14.md`, `docs/investigations/month-6-final-evidence-pack-2026-04-14.md`, `docs/investigations/month-6-closeout-handoff-2026-04-14.md`, `docs/investigations/month-6-privacy-routing-failure-inventory-2026-04-14.md` | Privacy / routing / glossary conditional bundle and current partial-boundary language. |

## Gate 4A — core docs alignment

| Check | Current finding | Verdict |
|---|---|---|
| Live coverage matrix reflects current reality | Matrix records source-core, extension-core, learning-loop, document-proof, YouTube proof, and YouTube holdout as required lanes. Required-vs-optional distinction remains explicit for hover/selection, standalone popup proof, Bilibili/generic video, and broader unsupported reader/video claims. | Pass with local evidence; CI uploaded artifacts pending. |
| Unsupported/unproven surfaces marked as gaps | Matrix/support docs keep hover/selection optional, broader video adapters code-only, iOS experimental, and non-article/local-file reopen limitations explicit. | Pass. |
| Platform support wording matches proof depth | README and support matrix align: Chromium supported primary, Firefox/Safari beta, iOS Safari shell experimental. | Pass. |
| Capability/status wording does not outrun proof | Capability matrix says it is not a release-claim override and scopes reader/file claims to PDF, EPUB, and SRT/VTT proof-backed flows; privacy remains partial. | Pass with downgrade boundary. |
| Strategic Non-Goals satisfied | Current macro changes strengthen onboarding, source-backed learning assets, proof packets, and accessibility evidence. They do not introduce a default provider console, all-platform promise, LMS, social community, full-content warehouse, autonomous action execution, or guaranteed outcomes. | Pass. |

## Gate 4B — surface-conditional review

| Conditional area | Does this macro worktree touch it? | Finding | Verdict |
|---|---:|---|---|
| Reader / owned-reading evidence | Yes | Reviewed Month 3 evidence registry/closeout inputs plus support matrix. Local release-proof artifacts include `document-proof` scenarios for document intake, local-file handoff, PDF, EPUB, and subtitle-file. Claims must still avoid universal reopen, OCR, DOCX layout, comic/image, and parser-convenience promises. | Pass with scoped claims. |
| Video / subtitle claims | Yes | Reviewed video addendum, adapter inventory, and replay doc. Local release-proof artifacts include YouTube proof and YouTube holdout scenarios. Support matrix keeps YouTube as supported best-effort, Bilibili beta/best-effort, subtitle-file separate, and other adapters code-only. | Pass with scoped claims. |
| Control-plane / account / billing wording | Yes, through macro paid-launch and ops boundaries | Reviewed control-plane inventory, lifecycle runbook, and lifecycle proof. Repo-side support/ops helpers exist, but paid billing, entitlements, cancellation/refund, legal, and production role enforcement evidence are not attached. | Downgrade/block stronger claims. |
| Mobile web / iOS wording | Indirectly, through platform/public claim boundaries | Reviewed iOS README, iOS smoke checklist, mobile/iOS smoke notes, and support matrix. iOS Safari shell remains experimental and mobile web stays limited to portable control-plane workflows. No support-tier promotion is made. | Pass only if wording stays downgraded. |
| Month 6 privacy / routing / glossary wording | Yes | Reviewed Month 6 claim audit/final pack/closeout/privacy inventory. README/support docs explicitly state requests can leave device; Privacy Mode is request-context sanitization, not local-only translation or end-to-end secrecy. Capability matrix keeps privacy partial. | Pass with scoped privacy wording. |
| Accessibility wording | Yes | Browser-backed evidence note maps current live artifacts to key flows, but manual no-mouse/screen-reader/contrast/scaled-text rows remain incomplete. | Downgrade/block broad compliance claims. |
| GTM/store/launch wording | Yes, through macro plan sections 27–28 | Repo contracts/runbooks exist, but external launch artifacts are missing. | Downgrade/block complete-launch claims. |

## Allowed public-beta wording

The current repo evidence can support wording in this shape:

> Astra has repo-side public-beta evidence for an extension-first language-learning loop: page translation, explanation, saving/review, controlled PDF, EPUB, and SRT/VTT subtitle-file workflows, and proof-backed YouTube subtitle workflows. Chromium is the primary supported desktop path; Firefox and desktop Safari remain beta, iOS Safari shell remains experimental, and DOCX/OCR/ASS/Markdown/TXT/HTML/comic/image, paid launch, store submission, production metric, and accessibility compliance claims require additional evidence.

## Required downgrade copy

Use or adapt the downgrade copy in `docs/reviews/macro-operational-evidence-rc-note-2026-05-28.md` whenever release notes, README copy, website copy, store listings, demos, support responses, or investor/customer claims touch:

- paid pricing, Trial, Pro, checkout, entitlement, cancellation, or refunds;
- store submission readiness;
- GTM launch completeness;
- production metric maturity;
- broad accessibility compliance;
- production AI quality or safety claims;
- data retention/account deletion guarantees;
- ops console role enforcement;
- platform parity, universal file/video support, local-only privacy, or guaranteed learning outcomes.

## Required next evidence before final RC approval

1. Attach CI `quality` and `live-browser` uploaded artifacts for the same commit/worktree.
2. Record owner release approval against this Gate 4 review and the evidence packet.
3. Fill remaining manual accessibility rows in `docs/accessibility/keyboard-test.md` and `docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md` before any broad accessibility claim.
4. Produce a dated human-scored AI quality report and fill the Section 24 rows in `docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md` before production quality claims.
5. Fill the Section 6/7/13/14 rows in `docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md` before stronger Library, personalization, brand, or support claims.
6. Attach billing/legal/store/GTM external artifacts before paid/public-launch-complete claims.

## Bottom line

Gate 4 claim alignment is acceptable **only as pass-with-downgrades**. The macro plan can be represented as repo-covered / beta-boundary / external-blocked, but it cannot be represented as fully launched, paid-ready, store-submitted, production-metric-proved, or accessibility-compliance-complete from repository evidence alone.
