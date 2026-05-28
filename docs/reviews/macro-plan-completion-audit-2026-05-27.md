# Macro Product Upgrade Plan Completion Audit — 2026-05-27

Source plan: `/Users/ruirui/Downloads/astra-macro-product-upgrade-plan-2026-05-27 (1).md` and the mirrored repo plan at `docs/plans/astra-macro-product-upgrade-plan-2026-05-27.md`.

This audit records the current repository state after the macro-plan implementation slices. It does **not** convert missing external launch evidence into a pass. When a section depends on production, store, legal, billing, screenshots, cohort metrics, or manual QA evidence, the section is marked as a beta boundary or external blocker and routed through `src/utils/macro-operational-evidence.ts`.

## Status legend

- **Repo-covered** — executable code/spec/test evidence exists for the section's first-version repo responsibility.
- **Beta-boundary** — repo-side implementation or contract exists, but stronger product/launch claims require current operational evidence or explicit downgrade copy.
- **External-blocked** — cannot be truthfully marked complete from repository changes alone; requires external production/store/legal/billing/media evidence.

## Section-by-section audit

| Section | Current status | Evidence | Remaining proof boundary |
|---:|---|---|---|
| 0 | Repo-covered | `src/utils/product-model.ts`, `docs/specs/core-product-model.md` | Competitive remediation details stay outside macro scope. |
| 1 | Repo-covered | `src/utils/product-model.ts`, `src/utils/storage/learning-assets.ts` | None beyond operational proof for asset usage. |
| 2 | Repo-covered | `src/utils/product-model.ts`, onboarding/free-beta copy, `docs/specs/core-product-model.md` | Public copy must keep managed-learning positioning. |
| 3 | Repo-covered | `ASTRA_PRODUCT_LAYERS` in `src/utils/product-model.ts` | None for first-version model. |
| 4 | Beta-boundary | `src/utils/first-success.ts`, `src/entrypoints/onboarding/OnboardingApp.tsx`, `src/entrypoints/sample-lesson/SampleLessonApp.tsx` | Numeric activation/timing targets require current cohort/smoke evidence; tracked as `first_success_activation_evidence`. |
| 5 | Repo-covered | `src/utils/learning-loop-experience.ts`, shared save-success locale copy, `HoverTranslate.test.tsx` | Broader adoption across every save surface remains later polish. |
| 6 | Beta-boundary | `src/utils/learning-library-experience.ts`, `src/utils/storage/learning-assets.ts`, `src/entrypoints/vocabulary/VocabularyApp.tsx`, `VocabularyApp.test.tsx`, `docs/reviews/library-qa-evidence-note-2026-05-28.md` | Library now shows ready/empty/planned rows for every macro asset type and has repo-side QA evidence for source return/delete/export controls; richer per-asset flows and manual/browser QA remain tracked as `learning_library_surface_coverage`. |
| 7 | Beta-boundary | `src/utils/personalization-experience.ts`, `src/utils/storage/learning-profile.ts`, Options memory controls, `ReviewMode.tsx`, `ReviewMode.test.tsx`, `docs/reviews/personalization-qa-evidence-note-2026-05-28.md` | Review visibly shapes queue order and session size from the learner profile and has repo-side QA evidence for reversibility/disabled boundaries; broader manual/browser adaptation QA remains tracked as `personalization_behavior_evidence`. |
| 8 | Beta-boundary / External-blocked for paid launch | `src/utils/membership-value.ts`, `docs/runbooks/billing-free-policy.md` | Paid value moments and Pro/Trial claims remain disabled until billing/legal evidence; tracked as `membership_value_surface_evidence` and `pricing_beta_boundary`. |
| 9 | Beta-boundary | `src/utils/trust/privacy-experience.ts`, Options `privacy-data-controls-card`, `src/utils/data-retention-control.ts` | Account/cloud deletion orchestration and signed legal retention proof remain operational evidence. |
| 10 | Repo-covered | `src/utils/error-recovery.ts`, `buildErrorRecoveryCardViewModel()`, Hover error recovery card | Migrate remaining error surfaces over time. |
| 11 | Beta-boundary | `src/utils/product-metrics.ts`, `src/utils/learning-loop-events.ts`, `docs/specs/product-metrics.md` | Production/cohort dashboard evidence required before metric maturity claims; tracked as `product_metrics`. |
| 12 | Beta-boundary | `src/utils/learning-digest-experience.ts`, `buildLocalWeeklyDigestViewModel()`, Library digest card | Email/notification/richer Digest QA remains optional/deferred; tracked as `learning_digest`. |
| 13 | Beta-boundary | `src/utils/brand-experience.ts`, `docs/specs/brand-experience.md`, style tokens | Per-RC copy/UI audit required before stronger polish claims; tracked as `brand_audit`. |
| 14 | Beta-boundary | `src/utils/support-experience.ts`, `src/utils/support-bundle.ts`, support report routes/UI | Hosted help/status/known-limitations evidence remains needed; tracked as `support_help_center`. |
| 15 | Repo-covered | `src/utils/platform-roadmap.ts`, `docs/specs/platform-roadmap.md` | Safari/iOS claims must stay experimental unless external proof exists. |
| 16 | Repo-covered | `src/utils/platform-roadmap.ts`, `docs/specs/metrics-dictionary.md` | Attach phase exit evidence per RC if claiming roadmap phase done. |
| 17 | Repo-covered | `src/utils/macro-alignment.ts`, `docs/specs/macro-alignment.md` | Competitive remediation production proof remains in remediation tracks. |
| 18 | Repo-covered | `src/utils/macro-alignment.ts`, `docs/specs/macro-alignment.md` | Final conclusion depends on keeping weaker sections downgraded until evidence exists. |
| 19 | Repo-covered | `src/utils/product-strategy.ts`, `docs/specs/product-strategy-persona-jtbd-paywall.md` | None for persona contract. |
| 20 | Repo-covered | `src/utils/product-strategy.ts`, JTBD scenario table/tests | None for JTBD contract. |
| 21 | External-blocked for paid launch | `src/utils/product-strategy.ts`, `docs/runbooks/billing-free-policy.md` | Production billing/checkout/webhook/entitlement/cancel/refund/legal evidence required; tracked as `pricing_beta_boundary`. |
| 22 | Repo-covered | `src/utils/learning-science.ts`, `src/entrypoints/vocabulary/ReviewMode.tsx`, `src/entrypoints/vocabulary/ReviewMode.test.tsx`, `docs/specs/learning-science-review.md` | Default Review now exposes the macro three-grade Again/Good/Easy model; Hard remains secondary as legacy keyboard compatibility only. |
| 23 | Repo-covered | `src/utils/storage/learning-assets.ts` now projects `SourceContent`, `SavedSnippet`, `VocabularyItem`, `ReviewCard`, and `ReviewSession`; tests cover legacy projection; `docs/specs/learning-asset-object-model.md` records field contracts, schema mapping, delete/orphan policy, export policy, and release boundary | Deeper migration/save API/cascade jobs remain future work. |
| 24 | Beta-boundary | `src/utils/ai-quality-system.ts`, `test/fixtures/quality/ai-quality-samples.json`, `docs/quality/rubrics.md`, `docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md` | Deterministic quality utilities and P0 fixture manifest are repo-covered; dated human-scored live provider quality report remains required before production quality claims, tracked as `ai_quality_human_scored_report`. |
| 25 | Repo-covered | `src/utils/ai-safety.ts`, prompt-injection fixtures, provider prompt wrappers, threat-model doc | New AI surfaces still need safety review. |
| 26 | Beta-boundary | `src/utils/data-retention-control.ts`, Options privacy/data card, learning-data export | Account/cloud deletion orchestration and cancellation/access proof remain operational evidence; tracked as `data_retention_controls`. |
| 27 | External-blocked for GTM launch artifacts | `src/utils/gtm-campaign.ts`, `docs/gtm/demos.md`, share-card/landing foundations | Final screenshots/storyboards/demo captures required; tracked as `gtm_release_packet`. |
| 28 | External-blocked for store submission | `store/listing-copy.md`, `docs/runbooks/browser-store-submission.md`, permission trust helpers | Hosted URLs, screenshots, zip hash, upload/submission/reviewer evidence required; tracked as `store_submission_packet`. |
| 29 | Repo-covered | `src/utils/release-stage-gate.ts`, `docs/release-readiness-checklist.md` | Gate commands and live lanes must be rerun for each RC. |
| 30 | Beta-boundary | `src/utils/ops-console.ts`, relay ops routes, Astra Web operator cards | Role-claim enforcement vs operator-token beta boundary must be recorded; tracked as `ops_role_boundary`. |
| 31 | Repo-covered | `src/utils/feature-flags.ts`, remote runtime store, ops endpoints, feature flag docs | Rich approvals/notifications remain future ops. |
| 32 | Beta-boundary | `src/utils/accessibility-readiness.ts`, accessibility docs, critical-path UI tests, `docs/reviews/accessibility-browser-evidence-note-2026-05-28.md` | Browser-backed evidence is attached, but human no-mouse/manual evidence packet is still needed before broad accessibility compliance claims; tracked as `accessibility_manual_evidence`. |
| 33 | Repo-covered | `src/utils/strategic-non-goals.ts`, `docs/specs/strategic-non-goals.md`, `docs/analysis/strategic-non-goals-proposals.json`, `pnpm check:strategic-non-goals` | Minimal JSON/CI fixture enforcement exists; hosted bots/templates/support-desk integrations remain future improvement. |
| 34 | Beta-boundary | WRLM helpers in `src/utils/storage/learning-assets.ts`, `LEARNING_LOOP_STAGE_OKR_METRICS`, metrics dictionary | Production dashboard/stage evidence required before claiming operational OKR maturity; tracked through `product_metrics`. |

## Current completion verdict

The repository now has coverage for every numbered macro-plan section as either:

1. an executable first-version implementation/contract,
2. an explicit beta-boundary with downgrade copy, or
3. an external-evidence blocker that cannot be resolved by repository edits alone.

Current RC downgrade artifact: `docs/reviews/macro-operational-evidence-rc-note-2026-05-28.md`, generated from `renderAstraMacroOperationalEvidenceRcNote()`.

Current focused evidence packet: `docs/reviews/macro-rc-evidence-packet-2026-05-28.md`. It records the latest repo-knowledge/zod guardrails, `pnpm type-check`, `pnpm lint:ci`, full `pnpm test`, `pnpm bench`, `pnpm build`, local `pnpm bench:live:lane:release-proof`, focused macro tests, quality fixture counts, onboarding first-run simplification, page-translation site-rule filtering repair, Section 23 object-model spec addition, Section 32 browser evidence note, Gate 4 pass-with-downgrades claim review in `docs/reviews/macro-gate-4-claim-review-2026-05-28.md`, and manual/browser QA evidence collection checklist in `docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md`. It does not replace CI uploaded artifacts, owner release approval, human no-mouse accessibility signoff, or external launch evidence.

The objective should **not** be marked fully complete while `evaluateAstraMacroOperationalEvidence().strongerClaimBlocked` remains true and while external/manual blockers for paid launch, GTM final artifacts, store submission evidence, human-scored AI quality, and accessibility/manual QA remain unresolved.

## Next action if continuing

The next repo-side improvements with the best completion impact are:

1. attach CI `quality` / `live-browser` uploaded artifacts and record owner approval against `docs/reviews/macro-gate-4-claim-review-2026-05-28.md` for the same commit/worktree;
2. fill the Section 6 rows in `docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md` and attach current manual/browser QA for richer Library per-asset flows and representative source return/delete/export walkthroughs;
3. fill the Section 7 rows in `docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md` and attach current manual/browser QA for profile-shaped Review behavior, disabled personalization fallback, excluded-site/Privacy Mode boundaries, and Options reversibility;
4. fill the Section 13/14/24/32 rows in `docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md`, including brand/support/manual QA, human-scored quality, and human no-mouse accessibility signoff beyond the browser evidence note;
5. attach paid billing/legal/store/GTM external artifacts or keep those claims downgraded.
