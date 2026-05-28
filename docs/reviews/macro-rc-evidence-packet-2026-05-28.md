# Macro RC Evidence Packet — 2026-05-28

Source objective: complete the macro product upgrade plan from `/Users/ruirui/Downloads/astra-macro-product-upgrade-plan-2026-05-27 (1).md`.

This packet records current repository-side evidence for the macro plan. It is **not** a paid-launch, store-submission, legal, production-dashboard, or external-QA signoff. It narrows the gap between plan contracts and RC evidence by attaching the checks that were actually run on the current worktree.

## Decision

| Question | Current answer |
|---|---|
| Public-beta style claim with downgrade copy | Acceptable from repo evidence, subject to full release gates. |
| Stronger launch/product/compliance claims | Blocked. |
| Paid launch / Trial / Pro checkout claims | Blocked until billing, entitlement, cancellation/refund, and legal evidence are attached. |
| Store submission complete claim | Blocked until hosted URLs, screenshots, zip hash, upload/submission, and reviewer evidence are attached. |
| GTM launch packet complete claim | Blocked until final screenshots/storyboards and sub-60s demo captures are attached. |
| Production metric maturity claim | Blocked until production/cohort dashboard exports exist. |
| Broad accessibility compliance claim | Blocked until manual keyboard/contrast/scaled-text/screen-reader packet is filled. |
| Gate 4 claim alignment | Pass with downgrades in `docs/reviews/macro-gate-4-claim-review-2026-05-28.md`; final RC approval still needs CI uploaded artifacts and owner signoff. |

## Validation commands run on this worktree

| Command | Result | Scope |
|---|---:|---|
| `pnpm check:repo-knowledge` | Pass — exit 0 | Repo structure guardrail; latest rerun after final-completion evidence artifact confirms no tracked files under legacy forbidden roots. |
| `pnpm check:zod-entrypoints` | Pass | Zod entrypoint guardrail for 15 bundles. |
| `pnpm type-check` | Pass — exit 0 | TypeScript project checks for extension/source and web companion; latest rerun after final-completion evidence artifact and Cloudflare shadow fixture alignment passed. |
| `pnpm lint:ci` | Pass — exit 0 | Release-critical lint path, including Zod entrypoint guardrail, strategic non-goals guardrail, final-completion evidence guardrail, and CI lint file set. Latest rerun completed without ESLint warnings after the support-triage follow-up hook dependency fix in `src/web/src/app.tsx`. |
| `pnpm test` | Pass — 222 files / 1970 tests | Full unit/integration test suite on this worktree after onboarding, extraction fixture, storage config, subtitle reader, inline action, page-translation site-rule title filtering, server fixture expectation updates, final-completion evidence artifact/gate coverage, and mobile retention fixture alignment. |
| `pnpm bench` | Pass — 63 / 63 scenarios, average score 99, exit 0 | Deterministic bench rerun on the current worktree at `2026-05-28T04:46:51.775Z`; latest JSON: `data/bench-results/latest.json`; history archive: `data/bench-results/history/2026-05-28T04-46-51-775Z.json`. |
| `pnpm build` | Pass — exit 0 | WXT Chrome MV3 production build completed on the current worktree; total output size 4.53 MB; `verify:content-bundles` passed for 1 content script bundle. |
| `pnpm check:macro-final-completion` | Pass — exit 0 | Final-completion evidence artifact, generated gate note, evidence-link token requirements, final-evidence intake document, and manual-QA row structure are internally consistent. Current decision remains `Complete: no` with 8 blockers. |
| `pnpm bench:live:lane:release-proof` | Pass — 33 / 33 scenarios, exit 0 | Source-core, extension-core, learning-loop, document-proof, youtube-proof, and youtube-holdout live lanes completed locally on this worktree. Current artifact range: `live-20260528T044754-odwwjv` through `live-20260528T044955-f07929` under `data/bench-live-results/`, covering source-core, extension-core, learning-loop, document-proof, youtube-proof, and youtube-holdout scenarios. |
| `pnpm test src/utils/release-stage-gate.test.ts` | Pass — 1 file / 10 tests | Focused release gate guardrail: validates release-stage decisions, required release-proof lane/script/CI/docs alignment, downloadable CI quality/live artifact configuration, required scenario inventories, and Gate 4 public-beta wording scope. |
| `pnpm test src/utils/ai-quality-system.test.ts src/utils/ai-safety.test.ts src/utils/accessibility-readiness.test.ts src/utils/release-stage-gate.test.ts src/utils/macro-operational-evidence.test.ts src/entrypoints/onboarding/OnboardingApp.test.tsx src/utils/storage/learning-assets.test.ts src/entrypoints/vocabulary/ReviewMode.test.tsx` | Pass — 8 files / 73 tests | Focused macro evidence: AI quality, prompt-injection safety, accessibility readiness, release stages, macro operational downgrade boundaries, final-completion gate, final-completion evidence artifact, generated final-completion note sync, completion-audit boundary coverage, completion-audit section inventory, manual-QA checklist schema, no-final-signoff claim boundary, strict onboarding first-success path, learning asset model, Review three-grade default plus legacy Hard compatibility, final-evidence intake rules. |
| `pnpm test src/utils/storage/learning-assets.test.ts src/entrypoints/vocabulary/VocabularyApp.test.tsx && pnpm type-check` | Pass — 2 files / 42 tests; type-check exit 0 | Focused Learning Digest regression: local digest view model and Library card cover aggregate counts, Review/continue CTAs, metadata-safe repeated vocabulary, coarse topic support, continue target labels, privacy-safe rendering, and metadata-only digest telemetry fields. |
| `pnpm test src/utils/support-experience.test.ts src/utils/macro-operational-evidence.test.ts && pnpm check:macro-final-completion` | Pass — focused support docs/evidence guardrail | Validates required help-center topic doc paths, repo help/status/known-limitations files, generated macro RC note sync, and final-completion gate consistency. |
| `pnpm test src/utils/data-retention-control.test.ts src/utils/macro-operational-evidence.test.ts src/server/auth.test.ts src/server/cloudflare-shadow-audit.test.ts && pnpm type-check` | Pass — focused data-retention evidence guardrail | Validates data-retention policy/readiness, generated macro RC note sync, relay/shadow usage fixtures, and TypeScript compatibility after account/cloud-delete evidence updates. |
| `pnpm test src/utils/product-metrics.test.ts src/utils/macro-operational-evidence.test.ts && pnpm check:macro-final-completion && pnpm type-check` | Pass — focused production metrics export packet guardrail | Validates current metric category contract, production export packet requirements for Activation/Understanding/Learning/Membership, generated macro RC note sync, final-evidence intake token requirements, final-completion gate consistency, and TypeScript compatibility. |
| `pnpm test src/utils/ops-console.test.ts src/server/config.test.ts src/server/index.test.ts src/utils/macro-operational-evidence.test.ts && pnpm check:macro-final-completion` | Pass — focused ops role evidence guardrail | Validates role/action/module matrix, operator-principal config validation, server route role enforcement/denied audit, generated macro RC note sync, and final-completion gate consistency. |
| `pnpm test src/utils/brand-experience.test.ts src/utils/macro-operational-evidence.test.ts && pnpm check:macro-final-completion && pnpm type-check` | Pass — focused brand/default-surface evidence guardrail | Validates Section 13 default-surface audit inventory, copy-screening helpers, generated macro RC note sync, final-completion gate consistency, and TypeScript compatibility. |
| `pnpm test src/utils/first-success.test.ts src/utils/macro-operational-evidence.test.ts && pnpm check:macro-final-completion && pnpm type-check` | Pass — focused first-success smoke/evidence guardrail | Validates Section 4 smoke-report evaluator, activation event/dashboard drift guard, generated macro RC note sync, final-completion gate consistency, and TypeScript compatibility. |
| `pnpm test src/utils/ai-quality-system.test.ts src/utils/macro-operational-evidence.test.ts && pnpm check:macro-final-completion && pnpm type-check` | Pass — focused AI-quality human-report evidence guardrail | Validates Section 24 human-scored report intake requirements, release-threshold protection, generated macro RC note sync, final-completion gate consistency, and TypeScript compatibility. |
| `pnpm test src/utils/accessibility-readiness.test.ts src/utils/macro-operational-evidence.test.ts && pnpm check:macro-final-completion && pnpm type-check` | Pass — focused accessibility manual-packet evidence guardrail | Validates Section 32 manual evidence packet requirements, generated macro RC note sync, final-completion gate consistency, and TypeScript compatibility. |
| `pnpm test src/utils/macro-operational-evidence.test.ts && pnpm check:macro-final-completion && pnpm type-check` | Pass — focused launch artifact packet evidence guardrail | Validates billing/legal/store/GTM launch artifact packet requirements, final-evidence intake token requirements, generated macro RC note sync, final-completion gate consistency, and TypeScript compatibility. |
| `pnpm test src/utils/macro-operational-evidence.test.ts && pnpm check:macro-final-completion && pnpm type-check` | Pass — focused CI artifact packet evidence guardrail | Validates `evaluateAstraMacroCiArtifactPacket()`, quality command coverage, live release-proof lane coverage, final-evidence intake token requirements, generated macro RC note sync, final-completion gate consistency, and TypeScript compatibility. |
| `pnpm test src/utils/macro-operational-evidence.test.ts && pnpm check:macro-final-completion && pnpm type-check` | Pass — focused owner release approval packet guardrail | Validates `evaluateAstraMacroReleaseApprovalPacket()`, reviewed Gate 4/RC/final-gate artifact requirements, remaining-blocker/downgrade acknowledgements, final-evidence intake token requirements, generated macro RC note sync, final-completion gate consistency, and TypeScript compatibility. |
| `pnpm test src/utils/macro-operational-evidence.test.ts && pnpm check:macro-final-completion && pnpm type-check` | Pass — focused manual QA packet guardrail | Validates `evaluateAstraMacroManualQaEvidencePacket()`, Section 6/7/13/14/24/32 row inventory, owner/date/environment/evidence requirements, rejection of `not-run`/`fail` rows, final-evidence intake token requirements, generated macro RC note sync, final-completion gate consistency, and TypeScript compatibility. |
| `pnpm test src/entrypoints/onboarding/OnboardingApp.test.tsx src/utils/product-strategy.test.ts src/utils/storage/learning-assets.test.ts` | Pass — 3 files / 24 tests | Focused regression after onboarding simplification and learning-asset object-model spec addition. |

## Latest local release-proof artifact inventory

Latest local `pnpm bench:live:lane:release-proof` rerun on this worktree completed with exit code 0 and produced these per-scenario artifacts:

| Lane | Scenario | Run ID |
|---|---|---|
| source-core | `bench-live/page-translation-article-basic-source-bilingual` | `live-20260528T044754-odwwjv` |
| source-core | `bench-live/page-translation-full-page-title-shadow-source` | `live-20260528T044800-pv6w5a` |
| source-core | `bench-live/article-extraction-proof` | `live-20260528T044804-qcub9u` |
| source-core | `bench-live/dynamic-content-append` | `live-20260528T044806-ton5s2` |
| source-core | `bench-live/frame-coordination-basic` | `live-20260528T044808-459a52` |
| source-core | `bench-live/frame-coordination-cross-origin-fallback` | `live-20260528T044809-sb86l9` |
| extension-core | `bench-live/site-automation-autostart` | `live-20260528T044811-hsr46t` |
| extension-core | `bench-live/onboarding-smoke` | `live-20260528T044844-2j1wsv` |
| extension-core | `bench-live/vocabulary-srs-smoke` | `live-20260528T044846-i0vrma` |
| learning-loop | `bench-live/popup-deep-read-proof` | `live-20260528T044849-c9mhlt` |
| learning-loop | `bench-live/vocabulary-srs-smoke` | `live-20260528T044856-qbespi` |
| learning-loop | `bench-live/selection-save-review-loop` | `live-20260528T044858-2dy24d` |
| learning-loop | `bench-live/learning-loop-revisit-smoke` | `live-20260528T044902-ijwnxa` |
| document-proof | `bench-live/document-intake-basic` | `live-20260528T044919-6mbwj6` |
| document-proof | `bench-live/document-intake-local-file-handoff` | `live-20260528T044921-bnu6vn` |
| document-proof | `bench-live/pdf-reader-basic` | `live-20260528T044924-u3qhms` |
| document-proof | `bench-live/epub-reader-basic` | `live-20260528T044927-9xphgd` |
| document-proof | `bench-live/subtitle-file-basic` | `live-20260528T044929-hl889n` |
| youtube-proof | `bench-live/youtube-subtitle-player-button` | `live-20260528T044931-qky7s7` |
| youtube-proof | `bench-live/youtube-subtitle-in-player-settings` | `live-20260528T044933-2y2e5b` |
| youtube-proof | `bench-live/youtube-subtitle-basic-bilingual` | `live-20260528T044935-ltwb9b` |
| youtube-proof | `bench-live/youtube-subtitle-seek-recovery` | `live-20260528T044937-op43b1` |
| youtube-proof | `bench-live/youtube-subtitle-track-switch` | `live-20260528T044938-a3sdnp` |
| youtube-proof | `bench-live/youtube-transcript-panel` | `live-20260528T044940-ng2ts0` |
| youtube-proof | `bench-live/youtube-transcript-search-jump` | `live-20260528T044942-13keft` |
| youtube-proof | `bench-live/youtube-save-sentence-review-loop` | `live-20260528T044943-j4c5dl` |
| youtube-proof | `bench-live/youtube-video-note-create` | `live-20260528T044945-jf9kww` |
| youtube-holdout | `bench-live/holdout/youtube-subtitle-race` | `live-20260528T044947-57h0rw` |
| youtube-holdout | `bench-live/holdout/youtube-no-captions` | `live-20260528T044949-w7nos8` |
| youtube-holdout | `bench-live/holdout/youtube-asr-only` | `live-20260528T044950-hgl72z` |
| youtube-holdout | `bench-live/holdout/youtube-long-video` | `live-20260528T044952-mdn1zs` |
| youtube-holdout | `bench-live/holdout/youtube-fullscreen` | `live-20260528T044953-ukkza5` |
| youtube-holdout | `bench-live/holdout/youtube-spa-navigation` | `live-20260528T044955-f07929` |

## Gate commands not completed in this packet

These remain required before a real RC signoff:

1. CI `quality` and `live-browser` jobs with uploaded `quality-gate-results` and `live-bench-results` artifacts
2. owner release approval for the same commit/worktree after reviewing `docs/reviews/macro-gate-4-claim-review-2026-05-28.md`

Do not use this packet as a substitute for CI-backed Gate 1–3 in `docs/release-readiness-checklist.md`.

## Current fixture coverage snapshot

| Fixture | Current evidence |
|---|---|
| `test/fixtures/quality/ai-quality-samples.json` | Schema `astra-ai-quality-samples.v1`; 102 samples; 102 P0 samples; 6 capability categories. |
| Capability distribution | `translation: 17`, `explanation: 17`, `summary: 17`, `review_card: 17`, `personalized_terms: 17`, `writing_correction: 17`. |
| `test/fixtures/quality/prompt-injection.json` | Schema `astra-prompt-injection-fixtures.v1`; 20 malicious/untrusted-content cases. |
| Prompt-injection source coverage | page, selection, video, file, input, support, title/summary, translation memory, terminology glossary, custom task. |

## Repo-side plan improvements attached in this slice

| Area | Evidence |
|---|---|
| Section 4 / 19 onboarding boundary | `src/entrypoints/onboarding/OnboardingApp.tsx` now keeps first-run setup to the three activation questions: target language, level, primary goal. |
| Section 4 first-success smoke guard | `src/utils/first-success.ts` now defines a deterministic smoke-report evaluator for required events, <60s timing, save/review confirmation, and content-free telemetry field names; `src/utils/first-success.test.ts` also asserts first-success events remain consumed by the activation dashboard. |
| Section 24 AI-quality human-report guard | `src/utils/ai-quality-system.ts` now rejects incomplete human-scored report evidence unless reviewer/date, run metadata, fixture manifest version, live-provider sample evidence, scored P0 count, blocker triage, trend, release decision, and release-threshold readiness are present. `docs/reviews/macro-ai-quality-human-scored-packet-2026-05-28.json` records the machine-readable packet required by `pnpm check:macro-final-completion`, and `docs/reviews/macro-final-evidence-intake-2026-05-28.md` now requires any `humanScoredAiQualityReportAttached` evidence packet to satisfy `evaluateAiQualityHumanScoredReportEvidence()`. |
| Onboarding regression proof | `src/entrypoints/onboarding/OnboardingApp.test.tsx` asserts the flow is 4 steps and does not show style/display setup in first-run onboarding. |
| Section 23 object-model spec | `docs/specs/learning-asset-object-model.md` records field contracts, schema mapping, delete/orphan policy, export policy, acceptance checklist, and release boundary. |
| Section 12 Learning Digest local card | `src/utils/storage/learning-assets.ts` and `src/entrypoints/vocabulary/VocabularyApp.tsx` now add metadata-safe repeated vocabulary, common-topic support, recommended review count, Continue source CTA, and privacy-scoped telemetry to the local Weekly Digest card; focused tests cover rendering and raw-content exclusion. |
| Section 14 support/help docs | `docs/help/` now contains the required eight help-center topics plus `known-limitations.md`, and `docs/status.md` records the degraded-mode/status boundary; `src/utils/support-experience.test.ts` locks each topic to a concrete ordinary-language repo doc. |
| Sections 9 / 26 data retention evidence | `docs/reviews/data-retention-evidence-note-2026-05-28.md` now separates repo-side local export/delete controls, relay account-delete foundation, and Cloudflare collection-scoped lifecycle evidence from the remaining deployment/manual/legal/billing proof boundary. |
| Sections 11 / 34 product metrics evidence | `docs/reviews/product-metrics-evidence-note-2026-05-28.md` records local V0 Options Diagnostics, metadata-only dashboard aggregators, and the remaining production/release-cohort dashboard export boundary. `src/utils/product-metrics.ts` now defines `evaluateAstraProductionMetricsExportPacket()` with duplicate-category rejection, `docs/reviews/macro-production-metrics-export-packet-2026-05-28.json` records the machine-readable packet required by `pnpm check:macro-final-completion`, and `docs/reviews/production-metrics-export-evidence-note-2026-05-28.md` records the final `productionMetricsExportAttached` intake boundary: one owned row each for Activation, Understanding, Learning, and Membership with date range, cohort definition, dashboard/query source, evidence link, owner/date, and privacy-review link. |
| Section 30 ops role boundary evidence | `docs/reviews/ops-role-boundary-evidence-note-2026-05-28.md` now records env-backed operator roles, server-side route permission checks, denied-attempt audit logs, metadata-only audit output, and remaining production provisioning/legacy fallback/manual walkthrough boundaries. |
| Section 13 brand/default-surface evidence | `src/utils/brand-experience.ts` now maps the five Section 13 manual QA rows to default surfaces, repo evidence, copy/UI checks, and remaining proof boundaries; `docs/reviews/brand-default-surface-evidence-note-2026-05-28.md` records the repo-backed evidence without claiming visual polish completion. |
| Page translation site-rule filtering | `src/entrypoints/content/page-translate.ts` now keeps document-title translation out of explicit site-rule filtered requests; `src/entrypoints/content/page-translate.test.ts` covers the regression. |
| Section 32 browser evidence note | `docs/reviews/accessibility-browser-evidence-note-2026-05-28.md` maps local release-proof live artifacts to popup, onboarding, Library/Review, selection toolbar, document-reader, YouTube, and boundary-copy accessibility-relevant evidence without claiming full manual compliance. |
| Section 32 manual evidence guard | `src/utils/accessibility-readiness.ts` now defines `evaluateAstraAccessibilityManualEvidencePacket()` so broad accessibility claims require every no-mouse, contrast/scaled-text, reduced-motion, and screen-reader row to be run with owner/date/environment/evidence and no failing verdicts. |
| Billing/legal/store/GTM launch artifact guard | `src/utils/macro-operational-evidence.ts` now defines `evaluateAstraMacroLaunchArtifactPacket()`, `docs/reviews/macro-launch-artifact-packet-2026-05-28.json` records the machine-readable launch artifact packet required by `pnpm check:macro-final-completion`, and `docs/reviews/launch-artifact-packet-evidence-note-2026-05-28.md` ties the packet to the repo-side pricing, GTM, and store-submission boundary notes including `docs/reviews/store-submission-evidence-note-2026-05-28.md`; final launch evidence requires every billing checkout/webhook/entitlement/cancellation-refund, legal privacy-terms/AI-notice/support-contact, store zip/upload/reviewer/screenshot, and GTM demo/storyboard/copy-claim row to have artifact type/id, digest or version, target channel, claim boundary, owner/date, environment/channel, and URL or repo artifact-path evidence links. |
| CI quality/live-browser artifact guard | `src/utils/macro-operational-evidence.ts` now defines `evaluateAstraMacroCiArtifactPacket()`, `docs/reviews/macro-ci-artifact-packet-2026-05-28.json` records the machine-readable CI artifact packet required by `pnpm check:macro-final-completion`, `.github/workflows/ci.yml` writes `data/bench-results/quality-gate-manifest.json` and `data/bench-live-results/live-bench-manifest.json` before artifact upload, and `docs/reviews/ci-artifact-evidence-note-2026-05-28.md` records the final CI evidence boundary: quality/live-browser rows need artifact name, workflow/job, CI run URL, run/job/artifact identity, distinct artifact ids/URLs, artifact digest/checksum, URL or repo artifact-path manifest, downloadable artifact URL, 7–40 character hex target commit/SHA, owner/date containing a real calendar `YYYY-MM-DD`, and required command/lane coverage before CI evidence fields can be marked true. |
| Owner release approval packet guard | `src/utils/macro-operational-evidence.ts` now defines `evaluateAstraMacroReleaseApprovalPacket()`, `docs/reviews/macro-owner-release-approval-packet-2026-05-28.json` records the machine-readable owner approval packet required by `pnpm check:macro-final-completion`, and `docs/reviews/owner-release-approval-evidence-note-2026-05-28.md` records the final owner-approval boundary: approver/date containing a real calendar `YYYY-MM-DD`, URL or repo artifact-path approval record link, 7–40 character hex target commit/SHA, reviewed Gate 4/RC/final-gate artifacts, remaining-blocker acknowledgement, and downgrade-copy acknowledgement are required before `ownerReleaseApprovalRecorded` can be marked true. |
| Gate 4 claim review | `docs/reviews/macro-gate-4-claim-review-2026-05-28.md` records pass-with-downgrades claim alignment, scoped allowed public-beta wording, and blocked paid/store/GTM/metric/accessibility/platform/privacy overclaims. |
| Release-proof / Gate 4 drift guardrail | `src/utils/release-stage-gate.test.ts` now asserts the six required release-proof lanes stay aligned across `package.json`, `.github/workflows/ci.yml`, `docs/release-readiness-checklist.md`, `docs/investigations/workstream-f-live-lane-conventions.md`, `docs/investigations/workstream-a-live-coverage-matrix.md`, and the Gate 4 allowed public-beta wording; it also asserts CI keeps downloadable `quality-gate-results` and `live-bench-results` artifacts. |
| Completion-audit boundary guardrail | `src/utils/macro-operational-evidence.test.ts` now asserts every `Beta-boundary` / `External-blocked` section in `docs/reviews/macro-plan-completion-audit-2026-05-27.md` is tracked by `ASTRA_MACRO_OPERATIONAL_EVIDENCE` with required stronger-claim evidence and downgrade copy. |
| Operational evidence completion packet guard | `src/utils/macro-operational-evidence.ts` now defines `evaluateAstraMacroOperationalEvidenceCompletionPacket()` and `docs/reviews/macro-operational-evidence-completion-packet-note-2026-05-28.md` plus `docs/reviews/macro-operational-evidence-completion-packet-2026-05-28.json` record the final operational-evidence boundary: every operational evidence area needs owner/date, environment or target-release context, evidence link, verdict `proved`, and requirement-evidence notes before the `operational_evidence` blocker can be cleared. `pnpm check:macro-final-completion` validates the JSON packet and rejects an all-`proved` operational model without packet acceptance. |
| Completion-audit section inventory guardrail | `src/utils/macro-operational-evidence.test.ts` now asserts the mirrored source plan and completion audit cover every top-level section `0`–`34` exactly once, and that every audit row has a valid status plus non-empty evidence and remaining-proof-boundary cells. |
| Manual-QA checklist schema guardrail | `src/utils/macro-operational-evidence.test.ts` now locks the Section 6/7/13/14/24/32 manual QA row inventory, allowed verdicts, status taxonomy, and the rule that `not-run` rows must not contain owner/environment/evidence fields while non-`not-run` rows must contain all three. |
| Manual QA packet guard | `src/utils/macro-operational-evidence.ts` now defines `evaluateAstraMacroManualQaEvidencePacket()` and `docs/reviews/manual-qa-packet-evidence-note-2026-05-28.md` records the final manual-QA evidence boundary: every Section 6/7/13/14/24/32 row must be present, owner/date/environment/evidence-backed, and verdicted `pass` or `pass-with-downgrade` before `manualQaChecklistComplete` can be marked true. |
| No-final-signoff guardrail | `src/utils/macro-operational-evidence.test.ts` now asserts `docs/reviews/macro-rc-evidence-packet-2026-05-28.md` and `docs/reviews/macro-gate-4-claim-review-2026-05-28.md` keep repo evidence scoped, block final launch/signoff claims, and list the required CI, owner, manual QA, human-scored quality, billing/legal/store/GTM follow-up evidence. |
| Final completion gate | `evaluateAstraMacroPlanCompletion()` now requires operational evidence to be proved plus CI quality/live-browser artifacts, owner approval, completed manual QA, human-scored AI quality, billing/legal/store/GTM artifacts, and production metric exports before the macro plan can be marked complete. `pnpm check:macro-final-completion` additionally uses `evaluateAstraMacroOperationalEvidenceCompletionPacket()`, `evaluateAstraMacroCiArtifactPacket()`, `evaluateAstraMacroReleaseApprovalPacket()`, `evaluateAstraMacroLaunchArtifactPacket()`, `evaluateAiQualityHumanScoredReportEvidence()`, `evaluateAstraProductionMetricsExportPacket()`, and `evaluateAstraMacroManualQaEvidencePacket()` to reject incomplete machine-readable packets when the corresponding final evidence is marked true. |
| Learning science Review default | `src/entrypoints/vocabulary/ReviewMode.tsx` now exposes the macro three-grade learner-facing default (`Again`, `Good`, `Easy`) and keeps `Hard` only as legacy shortcut `4`; `src/entrypoints/vocabulary/ReviewMode.test.tsx` covers the default button row and legacy Hard compatibility path. |
| Final completion gate note | `docs/reviews/macro-final-completion-gate-2026-05-28.md` is generated by `renderAstraMacroPlanCompletionGateNote()` from `docs/reviews/macro-final-completion-evidence-2026-05-28.json` and currently records `Complete: no` with the eight remaining hard blockers. `docs/reviews/macro-final-evidence-intake-2026-05-28.md` defines the minimum acceptable evidence-link content before any final evidence field may be marked true. |
| Cloudflare shadow v2 fixture alignment | `src/server/cloudflare-shadow-audit.test.ts` now includes the required `mobileRetentionEvents: []` field in its `ServerUserDatabase` v2 fixture so `pnpm type-check` remains green after mobile retention persistence was added. |
| Manual/browser QA evidence checklist | `docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md` breaks remaining Section 6/7/13/14/24/32 manual evidence into owner/date/environment/evidence/verdict rows without marking them complete. |
| Foundation index update | `docs/specs/macro-product-upgrade-foundation-2026-05-27.md` now links the dedicated object-model spec and updates the onboarding accessibility bullet to the strict three-question path. |

## Section evidence notes

### Sections 4, 19–21 — First success, persona, JTBD, paywall boundary

- Evidence: `src/utils/first-success.ts`, `src/utils/first-success.test.ts`, `src/utils/learning-loop-events.ts`, `docs/specs/first-success.md`, `docs/reviews/first-success-activation-evidence-note-2026-05-28.md`, `src/utils/product-strategy.ts`, `docs/specs/product-strategy-persona-jtbd-paywall.md`, `src/entrypoints/onboarding/OnboardingApp.tsx`, `src/entrypoints/onboarding/OnboardingApp.test.tsx`, `src/entrypoints/sample-lesson/SampleLessonApp.tsx`.
- Current proof: focused tests confirm the default onboarding path avoids provider/model/prompt/source-language/style setup and preserves a short path to the sample/ready step. The first-success contract now includes a deterministic smoke-report evaluator for required events, <60s timing, first save/review confirmation, and content-free telemetry field names; tests assert the first-success event set remains consumed by the activation dashboard.
- Boundary: numeric activation targets, current target-build smoke timing, cohort conversion rates, and paid trial/Pro claims remain unproven externally.

### Sections 9 and 26 — Data retention and user-control evidence

- Evidence: `src/utils/data-retention-control.ts`, `src/utils/data-retention-control.test.ts`, `src/utils/storage/learning-data-export.ts`, `src/utils/storage/learning-data-export.test.ts`, `src/entrypoints/options/OptionsApp.tsx`, `src/entrypoints/vocabulary/VocabularyApp.tsx`, `src/server/index.ts`, `src/server/user-store.ts`, `src/platform/cloudflare/src/handlers/account-lifecycle.ts`, `src/platform/cloudflare/src/queues/continuity-lifecycle.ts`, `docs/specs/data-retention-user-control.md`, `docs/help/delete-your-data.md`, `docs/reviews/data-retention-evidence-note-2026-05-28.md`.
- Current proof: repo now documents and tests conservative data categories, metadata-only support bundles, local learning-data export boundaries, explicit source-only vs source-plus-card deletion controls, relay account-delete foundation, and Cloudflare collection-scoped continuity export/delete lifecycle foundations.
- Boundary: complete self-serve data lifecycle claims still require target-release deployment receipts, manual RC walkthroughs, complete account/billing/legal deletion orchestration evidence, cancellation/access evidence, and owner-approved public privacy/help copy.

### Sections 11 and 34 — Product metrics operational evidence

- Evidence: `src/utils/product-metrics.ts`, `src/utils/product-metrics.test.ts`, `src/utils/learning-loop-events.ts`, `src/utils/learning-loop-events.test.ts`, `src/entrypoints/options/OptionsApp.tsx`, `src/entrypoints/options/OptionsApp.test.tsx`, `docs/specs/product-metrics.md`, `docs/specs/metrics-dictionary.md`, `docs/reviews/product-metrics-evidence-note-2026-05-28.md`, `docs/reviews/production-metrics-export-evidence-note-2026-05-28.md`.
- Current proof: metric contracts, canonical stage signals, local V0 Options Diagnostics, metadata-only aggregators, and `evaluateAstraProductionMetricsExportPacket()` cover Activation, Understanding, Learning, and Membership evidence intake boundaries without raw page text, saved snippets, transcripts, prompts, model output, emails, device IDs, or full URL paths in dashboard rows.
- Boundary: operational metric maturity still requires dated CI/production dashboard exports or query results for the target commit/worktree or release cohort, with date range, cohort definition, dashboard/query source, export id, exported-at timestamp, digest/checksum, query version, category-aligned metric ids, evidence link, owner/date, and privacy-review link for every category before `productionMetricsExportAttached` can be set true.

### Section 12 — Learning Digest product evidence

- Evidence: `src/utils/learning-digest-experience.ts`, `src/utils/storage/learning-assets.ts`, `src/utils/storage/learning-assets.test.ts`, `src/entrypoints/vocabulary/VocabularyApp.tsx`, `src/entrypoints/vocabulary/VocabularyApp.test.tsx`, `docs/specs/learning-digest-experience.md`.
- Current proof: local Library digest now shows aggregate saved/reviewed/source counts, Review and Continue source actions, due-review count, metadata-safe repeated vocabulary, and coarse common topics when source metadata exists; focused tests verify raw sentence/explanation text is excluded from the card and telemetry remains aggregate/source-type scoped.
- Boundary: stronger digest claims still require current manual/browser QA for rendered Review/continue behavior, optional email/notification controls, and Privacy Mode outbound restrictions.

### Section 22 — Learning Science Review compatibility

- Evidence: `src/utils/learning-science.ts`, `docs/specs/learning-science-review.md`, `src/entrypoints/vocabulary/ReviewMode.tsx`, `src/entrypoints/vocabulary/ReviewMode.test.tsx`.
- Current proof: default Review now presents the macro three-grade learner-facing model (`Again`, `Good`, `Easy`); `Hard` is no longer a visible default button and remains available only through legacy shortcut `4` for compatibility.
- Boundary: broader learning-outcome claims remain blocked by product-quality and production metric evidence, not by the Review answer model.

### Section 23 — Learning Asset Object Model

- Evidence: `src/utils/storage/learning-assets.ts`, `src/utils/storage/learning-assets.test.ts`, `docs/specs/learning-asset-object-model.md`.
- Current proof: tests cover mapping owned reading/vocabulary into `SourceContent`, `SavedSnippet`, `VocabularyItem`, `ReviewCard`, weekly reviewable learning moments, and privacy-safe digest summaries.
- Boundary: full save API migration, cloud sync conflict handling, account-level deletion orchestration, and production export UX remain release-gated.

### Section 30 — Operations console role boundary

- Evidence: `src/utils/ops-console.ts`, `src/utils/ops-console.test.ts`, `src/server/config.ts`, `src/server/config.test.ts`, `src/server/index.ts`, `src/server/index.test.ts`, `src/server/ops-audit-log-store.ts`, `src/web/src/app.tsx`, `docs/reviews/ops-role-boundary-evidence-note-2026-05-28.md`.
- Current proof: env-backed operator principals validate against the role matrix; support, usage, provider-health, cancellation, user-lookup, audit, known-issue, and feature-flag ops routes enforce role/module/action permissions; denied recognized operators are audited with role/source/permission metadata; audit output hashes operator tokens and stays metadata-only.
- Boundary: production ops maturity still requires deployed operator-principal provisioning evidence, an explicit legacy admin-token fallback decision, per-role deployed walkthroughs, staff-process owner approval, and target-release route/surface deployment evidence.

### Section 13 — Brand and aesthetic default-surface evidence

- Evidence: `src/utils/brand-experience.ts`, `src/utils/brand-experience.test.ts`, `docs/specs/brand-experience.md`, `src/assets/astra-style1-tokens.css`, `docs/reviews/brand-default-surface-evidence-note-2026-05-28.md`, `docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md`.
- Current proof: the executable brand contract defines discouraged back-office terms, preferred learning-tone copy, brand readiness blockers, and a default-surface audit inventory mapping the five Section 13 manual QA rows to onboarding, popup/Deep Read, Library/Review, error/boundary, and store/landing claim-freeze evidence. Focused tests cover copy screening and the manual-row inventory.
- Boundary: stronger brand-quality claims still require filled Section 13 owner/date/environment/evidence/verdict rows, current screenshots or browser walkthroughs, store/landing copy approval, and owner signoff.

### Section 14 — Support / help / status evidence

- Evidence: `src/utils/support-experience.ts`, `src/utils/support-experience.test.ts`, `src/utils/support-bundle.ts`, `src/utils/support-response-macros.ts`, `src/entrypoints/options/OptionsApp.tsx`, `src/entrypoints/popup/App.tsx`, `src/entrypoints/content/components/FloatBall.tsx`, `src/web/src/app.tsx`, `src/server/index.ts`, `docs/specs/support-experience.md`, `docs/help/index.md`, `docs/help/known-limitations.md`, `docs/status.md`.
- Current proof: metadata-only support bundle/reporting contracts, first-response macros, user report surfaces, operator triage surfaces, eight required help topics, known-limitations copy, and a user-safe degraded-status boundary are now represented in repo and guarded by focused tests.
- Boundary: stronger support maturity claims still require Section 14 manual walkthrough rows plus hosted help/status URLs, monitored owner/inbox, incident path, and target-release support operations evidence.

### Section 24 — AI Quality System

- Evidence: `src/utils/ai-quality-system.ts`, `src/utils/ai-quality-system.test.ts`, `src/utils/ai-safety.ts`, `src/utils/ai-safety.test.ts`, `test/fixtures/quality/ai-quality-samples.json`, `test/fixtures/quality/prompt-injection.json`, `docs/quality/rubrics.md`, `docs/reviews/ai-quality-human-scored-evidence-note-2026-05-28.md`, `docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md`, `src/utils/macro-operational-evidence.ts` (`ai_quality_human_scored_report`).
- Current proof: deterministic utility tests pass; fixture manifest exceeds 100 P0 samples across six categories; safety fixtures exist; the operational-evidence contract tracks the human-scored quality report as a beta-boundary item. `evaluateAiQualityHumanScoredReportEvidence()` rejects incomplete evidence unless reviewer/date, run metadata, fixture manifest version, live-provider sample evidence, scored P0 count, blocker triage, trend, release decision, and release-threshold readiness are present; final evidence intake now requires this evaluator before `humanScoredAiQualityReportAttached` can be marked true.
- Boundary: this is not a human-scored live provider quality run. A real release still needs the Section 24 checklist rows filled with scores, operator notes, blocker sample IDs, trend, decision, and release-threshold readiness.

### Section 25 — Web AI Safety / Prompt Injection

- Evidence: `src/utils/ai-safety.ts`, `src/utils/ai-safety.test.ts`, `test/fixtures/quality/prompt-injection.json`, `docs/specs/web-ai-safety-threat-model.md`.
- Current proof: focused safety tests pass; 20 malicious/untrusted-content cases are present.
- Boundary: every newly added AI surface still needs prompt/source audit before stronger safety claims.

### Section 29 — Release Gating and Beta Plan

- Evidence: `src/utils/release-stage-gate.ts`, `src/utils/release-stage-gate.test.ts`, `src/utils/macro-operational-evidence.ts` (`evaluateAstraMacroPlanCompletion()`, `evaluateAstraMacroOperationalEvidenceCompletionPacket()`, `evaluateAstraMacroCiArtifactPacket()`, `evaluateAstraMacroReleaseApprovalPacket()`, `evaluateAstraMacroLaunchArtifactPacket()`), `src/utils/ai-quality-system.ts` (`evaluateAiQualityHumanScoredReportEvidence()`), `src/utils/product-metrics.ts` (`evaluateAstraProductionMetricsExportPacket()`), `docs/release-readiness-checklist.md`, `.github/workflows/ci.yml`, `docs/investigations/workstream-f-live-lane-conventions.md`, `docs/investigations/workstream-a-live-coverage-matrix.md`, `docs/reviews/macro-final-completion-evidence-2026-05-28.json`, `docs/reviews/macro-final-completion-gate-2026-05-28.md`, `docs/reviews/macro-final-evidence-intake-2026-05-28.md`, `docs/reviews/macro-operational-evidence-completion-packet-note-2026-05-28.md`, `docs/reviews/macro-operational-evidence-completion-packet-2026-05-28.json`, `docs/reviews/macro-ai-quality-human-scored-packet-2026-05-28.json`, `docs/reviews/macro-production-metrics-export-packet-2026-05-28.json`, `docs/reviews/ci-artifact-evidence-note-2026-05-28.md`, `docs/reviews/owner-release-approval-evidence-note-2026-05-28.md`, `docs/reviews/launch-artifact-packet-evidence-note-2026-05-28.md`, this packet.
- Current proof: release-stage helper tests pass, including required release-proof lane alignment across package scripts, CI workflow, lane docs, coverage matrix, release checklist, downloadable CI quality/live artifact configuration, and Gate 4 allowed public-beta wording; the macro final gate also has an operational evidence completion packet guard requiring every `ASTRA_MACRO_OPERATIONAL_EVIDENCE` area to have owner/date, environment or target-release context, evidence link, verdict `proved`, and requirement-evidence notes before the `operational_evidence` blocker can clear. CI artifact packet intake requires quality command coverage and live release-proof lane coverage before `ciQualityArtifactsAttached` / `ciLiveBrowserArtifactsAttached` can support final claims, launch-artifact packet intake requires billing, legal/trust, store-submission, and GTM evidence before `billingLegalStoreGtmArtifactsAttached` can support final claims; AI quality and production metrics packet intake now require `evaluateAiQualityHumanScoredReportEvidence()` and `evaluateAstraProductionMetricsExportPacket()` acceptance before `humanScoredAiQualityReportAttached` or `productionMetricsExportAttached` can support final claims. `pnpm check:repo-knowledge`, `pnpm check:zod-entrypoints`, `pnpm check:macro-final-completion`, `pnpm type-check`, `pnpm lint:ci`, full `pnpm test`, `pnpm bench`, `pnpm build`, and local `pnpm bench:live:lane:release-proof` are green on this worktree. The latest local release-proof lane passed 33 / 33 scenarios with artifact IDs from `live-20260528T044754-odwwjv` through `live-20260528T044955-f07929`.
- Boundary: Gate 4 claim alignment is now recorded as pass-with-downgrades in `docs/reviews/macro-gate-4-claim-review-2026-05-28.md`; RC signoff remains incomplete until CI uploaded artifacts, owner approval, and external blockers are attached. Owner approval must satisfy `evaluateAstraMacroReleaseApprovalPacket()` and acknowledge the current `Complete: no` final gate plus required downgrade copy.

### Section 32 — Accessibility and Inclusive Design

- Evidence: `src/utils/accessibility-readiness.ts`, `src/utils/accessibility-readiness.test.ts`, `docs/accessibility/accessibility-audit.md`, `docs/accessibility/keyboard-test.md`, `docs/accessibility/component-labels.md`, `docs/reviews/accessibility-browser-evidence-note-2026-05-28.md`, `docs/reviews/accessibility-manual-evidence-note-2026-05-28.md`, `docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md`.
- Current proof: accessibility readiness utility tests pass; onboarding automated tests cover keyboard radio selection and active-step focus after simplification; local release-proof browser artifacts cover popup, onboarding, Library/Review, selection toolbar, document-reader, YouTube, and boundary-copy smoke/proof paths. `evaluateAstraAccessibilityManualEvidencePacket()` now rejects missing rows, `not_run` rows, failed rows, and rows without owner/date, environment, or evidence links before broad accessibility claims.
- Boundary: human no-mouse walkthrough, contrast/scaled-text, reduced-motion, and screen-reader rows remain TODO in `keyboard-test.md` and `docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md` before broad accessibility compliance claims.

## Required downgrade copy for this RC

Use the downgrade copy from `docs/reviews/macro-operational-evidence-rc-note-2026-05-28.md` for any release note, website, store listing, demo, or support reply touching:

- pricing/trial/paywall;
- GTM launch packet;
- store submission;
- product metrics maturity;
- digest email/notification delivery, Privacy Mode outbound behavior, or stronger Learning Digest completion claims;
- broad brand/aesthetic polish, default-surface visual quality, store/landing copy approval, or completed Section 13 audit claims;
- accessibility compliance;
- hosted help center/status page, monitored support ownership, or support SLA maturity;
- complete self-serve data deletion, account/billing/legal erasure, or deployed cloud lifecycle claims;
- production ops-console role maturity, least-privilege provisioning, or staff-process enforcement claims;
- paid membership value;
- data retention/account deletion;
- ops console role enforcement;
- production quality or safety claims;
- platform parity, universal file/video/platform support, local-only privacy, or guaranteed learning outcomes.

## Next evidence actions

1. Attach CI `quality-gate-results` and `live-bench-results` uploaded artifacts for the same commit/worktree; the CI packet must satisfy `evaluateAstraMacroCiArtifactPacket()` before `ciQualityArtifactsAttached` or `ciLiveBrowserArtifactsAttached` is set true.
2. Record owner release approval against `docs/reviews/macro-gate-4-claim-review-2026-05-28.md` if this worktree is promoted to an RC; the approval packet must satisfy `evaluateAstraMacroReleaseApprovalPacket()` before `ownerReleaseApprovalRecorded` is set true.
3. Fill the remaining manual/browser QA rows in `docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md`; the packet must satisfy `evaluateAstraMacroManualQaEvidencePacket()` before `manualQaChecklistComplete` is set true. Section 32 also remains tied to the human no-mouse rows in `docs/accessibility/keyboard-test.md`.
4. Produce a dated human-scored AI quality report using `docs/quality/rubrics.md` and the Section 24 rows in `docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md`; the report must satisfy `evaluateAiQualityHumanScoredReportEvidence()` before `humanScoredAiQualityReportAttached` is set true.
5. Attach billing checkout, billing webhook, billing entitlement/quota, billing cancellation/refund, legal privacy/terms approval, AI notice, support/contact commitment, store zip hash, store upload/submission, reviewer notes, store screenshots, GTM demo capture, GTM storyboard/screenshots, and GTM copy claim review evidence before paid-launch, store-submission-complete, legal-approved, GTM-launch-complete, or other launch-complete claims; every row needs artifact type/id, digest or version, target channel, claim boundary, owner/date containing a real calendar `YYYY-MM-DD`, environment/channel, and URL or repo artifact-path evidence link, and the packet must satisfy `evaluateAstraMacroLaunchArtifactPacket()` before `billingLegalStoreGtmArtifactsAttached` is set true.
6. Attach production/cohort dashboard exports or query results for Activation, Understanding, Learning, and Membership; the metrics packet must satisfy `evaluateAstraProductionMetricsExportPacket()` before `productionMetricsExportAttached` is set true.
7. Attach store/GTM external artifacts or keep all public launch copy downgraded.
