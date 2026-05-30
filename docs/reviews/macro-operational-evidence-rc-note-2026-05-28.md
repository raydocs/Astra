# Macro plan RC evidence note — 2026-05-28

Generated: 2026-05-28T00:00:00.000Z

## Decision

- Public beta acceptable with downgrade copy: yes
- Stronger launch/product claims blocked: yes
- External-evidence blockers: 3
- Areas requiring downgrade copy: 15

This note is release evidence for claim boundaries only. It does not replace production dashboards, store uploads, billing/legal proof, live-browser artifacts, or manual QA packets. Use `docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md` to collect the owner/date/environment/evidence/verdict rows for the remaining manual/browser QA items.

## Validation evidence attached to this RC note

- LIBRARY_ASSET_COVERAGE_FOCUSED_EXIT:0
- LIBRARY_ASSET_COVERAGE_COMBINED_EXIT:0
- LIBRARY_QA_NOTE_FOCUSED_EXIT:0
- PERSONALIZATION_REVIEW_FOCUSED_EXIT:0
- PERSONALIZATION_REVIEW_COMBINED_EXIT:0
- PERSONALIZATION_QA_NOTE_FOCUSED_EXIT:0
- LEARNING_DIGEST_FOCUSED_EXIT:0
- SUPPORT_HELP_DOCS_FOCUSED_EXIT:0
- DATA_RETENTION_EVIDENCE_FOCUSED_EXIT:0
- PRODUCT_METRICS_EVIDENCE_FOCUSED_EXIT:0
- MOBILE_RETENTION_OPS_SUMMARY_FOCUSED_EXIT:0
- PRODUCTION_METRICS_EXPORT_PACKET_GUARD_FOCUSED_EXIT:0
- CI_ARTIFACT_PACKET_GUARD_FOCUSED_EXIT:0
- OWNER_RELEASE_APPROVAL_PACKET_GUARD_FOCUSED_EXIT:0
- MANUAL_QA_PACKET_GUARD_FOCUSED_EXIT:0
- OPS_ROLE_BOUNDARY_FOCUSED_EXIT:0
- BRAND_DEFAULT_SURFACE_FOCUSED_EXIT:0
- FIRST_SUCCESS_SMOKE_GUARD_FOCUSED_EXIT:0
- AI_QUALITY_HUMAN_REPORT_GUARD_FOCUSED_EXIT:0
- ACCESSIBILITY_MANUAL_PACKET_GUARD_FOCUSED_EXIT:0
- LAUNCH_ARTIFACT_PACKET_GUARD_FOCUSED_EXIT:0
- MACRO_COMPLETION_AUDIT_BOUNDARY_EXIT:0
- MANUAL_QA_CHECKLIST_SCHEMA_EXIT:0
- MACRO_PLAN_AUDIT_SECTION_INVENTORY_EXIT:0
- MACRO_RC_NO_FINAL_SIGNOFF_EXIT:0
- MACRO_PLAN_FINAL_COMPLETION_GATE_EXIT:0
- MACRO_FINAL_COMPLETION_EVIDENCE_ARTIFACT_EXIT:0
- MACRO_FINAL_COMPLETION_CLI_EXIT:0
- Previous macro-plan focused and combined validations remain recorded in the implementation audit; rerun full Gate 1/Gate 2 for any release candidate.

## External evidence blockers

### Pricing, trial, and paywall launch boundary
- ID: `pricing_beta_boundary`
- Plan sections: Section 8, Section 21
- Status: `blocked_until_external_evidence`
- Current repo evidence:
  - src/utils/product-strategy.ts
  - src/utils/product-strategy.test.ts
  - docs/runbooks/billing-free-policy.md
  - docs/specs/product-strategy-persona-jtbd-paywall.md
  - docs/analysis/v1-activation-trial-support-checklist-2026-05-27.md
  - docs/help/known-limitations.md
  - docs/reviews/membership-value-evidence-note-2026-05-28.md
  - docs/reviews/launch-artifact-packet-evidence-note-2026-05-28.md
  - docs/reviews/pricing-beta-boundary-evidence-note-2026-05-28.md
- Required before stronger claim:
  - Do not launch paid claims until production billing checkout/portal, webhook, durable subscription persistence, entitlement enforcement, quota reconciliation, cancellation/refund, support, legal/privacy/terms, store-policy approval, owner signoff, and target-build manual QA evidence are recorded.
- Downgrade copy: Astra is a free public beta; Trial/Pro/paid checkout, subscription, entitlement, cancellation/refund, and pricing claims are explicitly not launched. Repo-side free-beta policy, paywall strategy, beta-safe trial-interest observability, membership copy guardrails, and a pricing boundary evidence note exist, but paid launch remains externally blocked.
### GTM release artifact packet
- ID: `gtm_release_packet`
- Plan sections: Section 27
- Status: `blocked_until_external_evidence`
- Current repo evidence:
  - src/utils/gtm-campaign.ts
  - src/utils/gtm-campaign.test.ts
  - docs/gtm/demos.md
  - store/listing-copy.md
  - docs/reviews/launch-artifact-packet-evidence-note-2026-05-28.md
  - docs/reviews/gtm-release-packet-evidence-note-2026-05-28.md
- Required before stronger claim:
  - Attach final target-build screenshots/storyboards, current sub-60-second demo captures, owner/date/environment verdict rows, claim-review evidence, and hosted/uploaded public launch artifact links before claiming GTM launch packet complete.
- Downgrade copy: GTM channel plan, sub-60-second demo scripts, launch-safe copy deck, store listing draft, technical-term guard, launch artifact packet intake, and a repo-side GTM evidence note exist; final target-build screenshots/storyboards, recorded demo captures, hosted/uploaded launch artifacts, and owner-approved claim review remain external launch work.
### Store listing and permission trust submission packet
- ID: `store_submission_packet`
- Plan sections: Section 28
- Status: `blocked_until_external_evidence`
- Current repo evidence:
  - store/listing-copy.md
  - docs/runbooks/browser-store-submission.md
  - src/utils/trust/compliance.ts
  - apps/mobile/scripts/verify-mobile-scaffold.mjs
  - apps/mobile/package.json
  - apps/mobile/store/README.md
  - apps/mobile/store/ios/app-store-connect.md
  - apps/mobile/store/android/play-listing.md
  - apps/mobile/store/privacy.md
  - apps/mobile/store/screenshots/README.md
  - apps/mobile/store/reviewer-notes.md
  - apps/mobile/store/signed-build-qa.md
  - apps/mobile/store/release-checklist.md
  - docs/reviews/store-submission-evidence-note-2026-05-28.md
- Required before stronger claim:
  - Record final hosted privacy/support/marketing URLs, package/build identifiers and hashes, final signed-build screenshots, signed-build functional/accessibility QA rows, target browser/mobile store channel upload, submission, or processing status, console privacy forms, reviewer notes entered in store consoles, and approval/rejection evidence before claiming store submission complete.
- Downgrade copy: Store copy, permission trust, native mobile Store/TestFlight/Play draft release-pack materials, and a repo-side store-submission evidence note are prepared in repo; final signed-build capture, upload/submission, console form, URL approval, and reviewer-status evidence remain pending external store work.

## Downgrade-required beta boundaries

### First-success activation evidence
- ID: `first_success_activation_evidence`
- Plan sections: Section 4
- Status: `beta_boundary`
- Current repo evidence:
  - src/utils/first-success.ts
  - src/utils/first-success.test.ts
  - src/utils/learning-loop-events.ts
  - src/entrypoints/onboarding/OnboardingApp.tsx
  - src/entrypoints/onboarding/OnboardingApp.test.tsx
  - src/entrypoints/sample-lesson/SampleLessonApp.tsx
  - docs/specs/first-success.md
  - docs/reviews/first-success-activation-evidence-note-2026-05-28.md
- Required before stronger claim:
  - Attach a dated target-build activation smoke report and/or cohort export proving the plan's <60 second timing and numeric conversion targets, not just the instrumented path or smoke-report evaluator.
- Downgrade copy: First-success path, onboarding boundary, sample-loop contracts, activation event dashboard drift checks, and a repo-side smoke-report evaluator/evidence note exist; numeric activation targets and current target-build timing still need dated smoke or cohort evidence before being claimed met.
### Learning Library surface coverage
- ID: `learning_library_surface_coverage`
- Plan sections: Section 6
- Status: `beta_boundary`
- Current repo evidence:
  - src/utils/learning-library-experience.ts
  - src/utils/storage/learning-assets.ts
  - src/entrypoints/vocabulary/VocabularyApp.tsx
  - src/entrypoints/vocabulary/VocabularyApp.test.tsx
  - docs/specs/learning-library-experience.md
  - docs/reviews/library-qa-evidence-note-2026-05-28.md
  - docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md
- Required before stronger claim:
  - Fill the Section 6 rows in docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md and attach current manual/browser QA for richer per-asset flows and representative source return/delete/export walkthroughs across all macro asset types before stronger completion claims.
- Downgrade copy: Library home, source map, asset projection, visible ready/empty/planned rows for every macro asset type, and a repo-side Library QA note exist; richer first-class per-asset flows remain beta/deferred.
### Personalization behavior evidence
- ID: `personalization_behavior_evidence`
- Plan sections: Section 7
- Status: `beta_boundary`
- Current repo evidence:
  - src/utils/personalization-experience.ts
  - src/utils/personalization-experience.test.ts
  - src/utils/storage/learning-profile.ts
  - src/utils/storage/learning-memory.ts
  - src/entrypoints/options/OptionsApp.tsx
  - src/entrypoints/vocabulary/ReviewMode.tsx
  - src/entrypoints/vocabulary/ReviewMode.test.tsx
  - docs/reviews/personalization-qa-evidence-note-2026-05-28.md
  - docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md
- Required before stronger claim:
  - Fill the Section 7 rows in docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md and attach current manual/browser QA for profile-shaped Review behavior, disabled personalization fallback, excluded-site/Privacy Mode boundaries, and Options reversibility before stronger personalization claims.
- Downgrade copy: Learning profile and memory controls are visible and reversible; Review visibly uses the profile to shape queue order and daily session size, and a repo-side personalization QA note exists while broader automatic adaptation remains conservative and beta-boundary.
### Membership value surface evidence
- ID: `membership_value_surface_evidence`
- Plan sections: Section 8
- Status: `beta_boundary`
- Current repo evidence:
  - src/utils/membership-value.ts
  - src/utils/membership-value.test.ts
  - apps/mobile/src/domain/mobileMembership.ts
  - apps/mobile/src/domain/mobileMembership.test.ts
  - apps/mobile/src/screens/MeScreen.tsx
  - docs/specs/membership-value.md
  - docs/help/membership-works.md
  - docs/runbooks/billing-free-policy.md
  - docs/reviews/membership-value-evidence-note-2026-05-28.md
- Required before stronger claim:
  - Attach production billing checkout/portal/webhook/cancellation/refund evidence, target-release entitlement evidence, owner/legal/store approval, target-build manual QA for Free/Trial/Pro/canceled/expired states, and final Free/Pro tier behavior before using paid value or launch-complete membership claims.
- Downgrade copy: Membership value, preferred/forbidden copy, Free/Pro/later boundaries, and mobile safe status display are covered by repo-side tests/evidence; public surfaces remain free-beta and paid value moments must stay disabled or explicitly not launched until production billing, entitlement, legal/store approval, and target-build QA evidence are attached.
### Product metrics operational evidence
- ID: `product_metrics`
- Plan sections: Section 11, Section 34
- Status: `beta_boundary`
- Current repo evidence:
  - src/utils/product-metrics.ts
  - src/utils/product-metrics.test.ts
  - src/utils/learning-loop-events.ts
  - src/utils/learning-loop-events.test.ts
  - src/entrypoints/options/OptionsApp.tsx
  - src/entrypoints/options/OptionsApp.test.tsx
  - docs/specs/product-metrics.md
  - docs/specs/metrics-dictionary.md
  - src/server/index.ts
  - src/server/user-store.ts
  - src/server/index.test.ts
  - docs/analysis/minimal-mobile-retention-ops-summary-checklist-2026-05-28.md
  - docs/reviews/product-metrics-evidence-note-2026-05-28.md
  - docs/reviews/production-metrics-export-evidence-note-2026-05-28.md
  - docs/reviews/macro-product-metrics-readiness-packet-2026-05-28.json
- Required before stronger claim:
  - Attach dated CI or production dashboard/export evidence showing Activation, Understanding, Learning, and Membership metrics are queryable for the target commit/worktree or release cohort, with date range, cohort definition, dashboard/query source, export id, timezone-bearing exported-at timestamp, digest/checksum, query version, category-aligned metric ids, evidence link, owner/date, privacy-review evidence that satisfies evaluateAstraProductionMetricsExportPacket(), and a product-metrics readiness packet that satisfies evaluateAstraProductMetricsReadiness(). The aggregate mobile retention ops summary is repo-side visibility only and does not satisfy production/cohort export evidence.
- Downgrade copy: Metrics contracts, local V0 Options diagnostics, metadata-only aggregators, an aggregate-only mobile retention ops summary, a production metrics export packet intake guard, and a product metrics readiness packet placeholder exist in repo; production/release-cohort dashboard exports with export identity, digest/checksum, query version, cohort definitions, privacy review, readiness evidence, and owner-approved query evidence remain required before claiming operational metric maturity.
### Learning Digest product evidence
- ID: `learning_digest`
- Plan sections: Section 12
- Status: `beta_boundary`
- Current repo evidence:
  - src/utils/learning-digest-experience.ts
  - src/utils/storage/learning-assets.ts
  - src/utils/storage/learning-assets.test.ts
  - src/entrypoints/vocabulary/VocabularyApp.tsx
  - src/entrypoints/vocabulary/VocabularyApp.test.tsx
  - src/server/index.ts
  - src/server/ops-audit-log-store.ts
  - src/server/index.test.ts
  - docs/specs/learning-digest-experience.md
  - docs/reviews/learning-digest-qa-evidence-note-2026-05-28.md
  - docs/analysis/minimal-weekly-digest-delivery-ops-checklist-2026-05-28.md
- Required before stronger claim:
  - Attach target-build Learning Digest QA evidence with owner/date/environment/verdict for rendered digest Review/continue behavior, repeated-vocabulary/common-topic display, optional outbound controls, and Privacy Mode outbound restrictions, plus production Resend/Expo/APNs/FCM delivery-monitoring evidence before stronger Learning Digest completion or delivery claims.
- Downgrade copy: A local Library digest shows aggregate counts, Review/continue actions, metadata-safe repeated vocabulary/topics, source exclusion, and local telemetry with a repo-side QA evidence note; the mobile relay has repo-side Weekly Digest email/push run foundations and an aggregate-only delivery summary, while production inbox/device deliverability, provider webhook receipts, alerting, and target-build walkthrough QA remain beta-boundary.
### Human-scored AI quality report
- ID: `ai_quality_human_scored_report`
- Plan sections: Section 24
- Status: `beta_boundary`
- Current repo evidence:
  - src/utils/ai-quality-system.ts
  - src/utils/ai-quality-system.test.ts
  - src/utils/ai-safety.ts
  - src/utils/ai-safety.test.ts
  - test/fixtures/quality/ai-quality-samples.json
  - test/fixtures/quality/prompt-injection.json
  - docs/quality/rubrics.md
  - docs/reviews/ai-quality-human-scored-evidence-note-2026-05-28.md
  - docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md
- Required before stronger claim:
  - Fill the Section 24 rows in docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md and attach a dated human-scored provider-quality report with reviewer/date, run metadata, fixture manifest version, live provider sample evidence, blocker triage, trend, and release decision before production AI-quality claims.
- Downgrade copy: Deterministic AI-quality utilities, rubric, fixture manifests, safety fixtures, release-threshold evaluation, trend logic, and a repo-side human-scored report intake guard exist; production quality claims still require a dated human-scored provider-quality report with Section 24 owner/evidence/verdict rows.
### Brand and aesthetic surface audit
- ID: `brand_audit`
- Plan sections: Section 13
- Status: `beta_boundary`
- Current repo evidence:
  - src/utils/brand-experience.ts
  - src/utils/brand-experience.test.ts
  - docs/specs/brand-experience.md
  - src/assets/astra-style1-tokens.css
  - docs/reviews/brand-default-surface-evidence-note-2026-05-28.md
  - docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md
- Required before stronger claim:
  - Fill the Section 13 rows in docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md and attach current default-surface screenshots/browser walkthroughs, store/landing copy approval, and owner/date/environment/evidence/verdict rows using the brand discouraged-term and preferred-tone helpers.
- Downgrade copy: Brand principles, copy screening helpers, default-surface audit inventory, token references, and a repo-side Section 13 evidence note exist; broad aesthetic polish, screenshots/browser walkthroughs, store/landing copy approval, and owner-signed manual rows remain required before strengthening brand-quality claims.
### Support, help center, and status evidence
- ID: `support_help_center`
- Plan sections: Section 14
- Status: `beta_boundary`
- Current repo evidence:
  - src/utils/support-experience.ts
  - src/utils/support-experience.test.ts
  - src/utils/support-bundle.ts
  - src/utils/support-bundle.test.ts
  - src/utils/support-response-macros.ts
  - src/utils/support-response-macros.test.ts
  - src/entrypoints/options/OptionsApp.tsx
  - src/entrypoints/popup/App.tsx
  - src/entrypoints/content/components/FloatBall.tsx
  - src/web/src/app.tsx
  - src/server/index.ts
  - docs/specs/support-experience.md
  - docs/help/index.md
  - docs/help/known-limitations.md
  - docs/status.md
  - docs/reviews/support-help-center-evidence-note-2026-05-28.md
  - docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md
- Required before stronger claim:
  - Fill the Section 14 rows in docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md and attach evidence for hosted help/status URLs, monitored support owner/inbox, incident path, current support-entrypoint walkthroughs, and production metadata-only support-report operations before support maturity claims.
- Downgrade copy: Metadata-only reporting, first-response macros, repo help topics, known-limitations copy, a status boundary, and a repo-side support/help evidence note exist; hosted help/status URLs, monitored support ownership, incident operations, and manual support-entrypoint QA remain release-boundary evidence.
### Pricing, trial, and paywall launch boundary
- ID: `pricing_beta_boundary`
- Plan sections: Section 8, Section 21
- Status: `blocked_until_external_evidence`
- Current repo evidence:
  - src/utils/product-strategy.ts
  - src/utils/product-strategy.test.ts
  - docs/runbooks/billing-free-policy.md
  - docs/specs/product-strategy-persona-jtbd-paywall.md
  - docs/analysis/v1-activation-trial-support-checklist-2026-05-27.md
  - docs/help/known-limitations.md
  - docs/reviews/membership-value-evidence-note-2026-05-28.md
  - docs/reviews/launch-artifact-packet-evidence-note-2026-05-28.md
  - docs/reviews/pricing-beta-boundary-evidence-note-2026-05-28.md
- Required before stronger claim:
  - Do not launch paid claims until production billing checkout/portal, webhook, durable subscription persistence, entitlement enforcement, quota reconciliation, cancellation/refund, support, legal/privacy/terms, store-policy approval, owner signoff, and target-build manual QA evidence are recorded.
- Downgrade copy: Astra is a free public beta; Trial/Pro/paid checkout, subscription, entitlement, cancellation/refund, and pricing claims are explicitly not launched. Repo-side free-beta policy, paywall strategy, beta-safe trial-interest observability, membership copy guardrails, and a pricing boundary evidence note exist, but paid launch remains externally blocked.
### Data retention and user-control evidence
- ID: `data_retention_controls`
- Plan sections: Section 9, Section 26
- Status: `beta_boundary`
- Current repo evidence:
  - src/utils/data-retention-control.ts
  - src/utils/data-retention-control.test.ts
  - src/entrypoints/options/OptionsApp.tsx
  - src/entrypoints/vocabulary/VocabularyApp.tsx
  - src/entrypoints/vocabulary/VocabularyApp.test.tsx
  - src/utils/storage/learning-data-export.ts
  - src/utils/storage/learning-data-export.test.ts
  - src/utils/support-bundle.ts
  - src/utils/support-bundle.test.ts
  - src/server/index.ts
  - src/server/user-store.ts
  - src/server/index.test.ts
  - src/platform/cloudflare/src/handlers/account-lifecycle.ts
  - src/platform/cloudflare/src/queues/continuity-lifecycle.ts
  - src/platform/cloudflare/src/handlers/account-lifecycle.test.ts
  - src/platform/cloudflare/src/queues/continuity-lifecycle.test.ts
  - docs/specs/data-retention-user-control.md
  - docs/help/delete-your-data.md
  - docs/reviews/data-retention-evidence-note-2026-05-28.md
- Required before stronger claim:
  - Attach target-release deployment receipts for relay account deletion and Cloudflare continuity lifecycle, complete account/billing/legal deletion orchestration evidence, cancellation/access behavior evidence, and manual RC walkthroughs before claiming complete self-serve data lifecycle.
- Downgrade copy: Local export/delete controls, metadata-only support bundles, relay account-delete foundation, Cloudflare collection-scoped cloud-delete lifecycle, and delete-data help copy exist in repo; production deployment receipts, complete account/billing/legal deletion orchestration, cancellation/access evidence, and manual RC verification remain required.
### GTM release artifact packet
- ID: `gtm_release_packet`
- Plan sections: Section 27
- Status: `blocked_until_external_evidence`
- Current repo evidence:
  - src/utils/gtm-campaign.ts
  - src/utils/gtm-campaign.test.ts
  - docs/gtm/demos.md
  - store/listing-copy.md
  - docs/reviews/launch-artifact-packet-evidence-note-2026-05-28.md
  - docs/reviews/gtm-release-packet-evidence-note-2026-05-28.md
- Required before stronger claim:
  - Attach final target-build screenshots/storyboards, current sub-60-second demo captures, owner/date/environment verdict rows, claim-review evidence, and hosted/uploaded public launch artifact links before claiming GTM launch packet complete.
- Downgrade copy: GTM channel plan, sub-60-second demo scripts, launch-safe copy deck, store listing draft, technical-term guard, launch artifact packet intake, and a repo-side GTM evidence note exist; final target-build screenshots/storyboards, recorded demo captures, hosted/uploaded launch artifacts, and owner-approved claim review remain external launch work.
### Store listing and permission trust submission packet
- ID: `store_submission_packet`
- Plan sections: Section 28
- Status: `blocked_until_external_evidence`
- Current repo evidence:
  - store/listing-copy.md
  - docs/runbooks/browser-store-submission.md
  - src/utils/trust/compliance.ts
  - apps/mobile/scripts/verify-mobile-scaffold.mjs
  - apps/mobile/package.json
  - apps/mobile/store/README.md
  - apps/mobile/store/ios/app-store-connect.md
  - apps/mobile/store/android/play-listing.md
  - apps/mobile/store/privacy.md
  - apps/mobile/store/screenshots/README.md
  - apps/mobile/store/reviewer-notes.md
  - apps/mobile/store/signed-build-qa.md
  - apps/mobile/store/release-checklist.md
  - docs/reviews/store-submission-evidence-note-2026-05-28.md
- Required before stronger claim:
  - Record final hosted privacy/support/marketing URLs, package/build identifiers and hashes, final signed-build screenshots, signed-build functional/accessibility QA rows, target browser/mobile store channel upload, submission, or processing status, console privacy forms, reviewer notes entered in store consoles, and approval/rejection evidence before claiming store submission complete.
- Downgrade copy: Store copy, permission trust, native mobile Store/TestFlight/Play draft release-pack materials, and a repo-side store-submission evidence note are prepared in repo; final signed-build capture, upload/submission, console form, URL approval, and reviewer-status evidence remain pending external store work.
### Operations console role boundary
- ID: `ops_role_boundary`
- Plan sections: Section 30
- Status: `beta_boundary`
- Current repo evidence:
  - src/utils/ops-console.ts
  - src/utils/ops-console.test.ts
  - src/server/config.ts
  - src/server/config.test.ts
  - src/server/index.ts
  - src/server/index.test.ts
  - src/server/ops-audit-log-store.ts
  - src/utils/operating-review.ts
  - src/utils/operating-review.test.ts
  - src/web/src/lib/astra-web.ts
  - src/web/src/lib/astra-web.test.ts
  - src/web/src/app.tsx
  - src/web/src/app.test.tsx
  - docs/reviews/ops-role-boundary-evidence-note-2026-05-28.md
- Required before stronger claim:
  - Attach production operator-principal provisioning evidence, legacy admin-token fallback decision, deployed per-role walkthroughs including ops cockpit/provider-health visibility by role, staff-process owner approval, and target-release route/surface deployment evidence before production ops maturity claims.
- Downgrade copy: Env-backed operator roles, server-side route permission checks, denied-attempt audit logs, metadata-only operator audit output, and repo-side aggregate ops cockpit/operating-review surfaces exist in repo; production operator provisioning, legacy admin-token fallback retirement/approval, deployed role walkthroughs, and staff process evidence remain required before full ops-console role maturity claims.
### Accessibility manual evidence packet
- ID: `accessibility_manual_evidence`
- Plan sections: Section 32
- Status: `beta_boundary`
- Current repo evidence:
  - src/utils/accessibility-readiness.ts
  - src/utils/accessibility-readiness.test.ts
  - docs/accessibility/accessibility-audit.md
  - docs/accessibility/keyboard-test.md
  - docs/reviews/accessibility-browser-evidence-note-2026-05-28.md
  - docs/reviews/accessibility-manual-evidence-note-2026-05-28.md
  - docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md
- Required before stronger claim:
  - Fill the Section 32 rows in docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md and attach a current filled evidence row set for no-mouse popup/onboarding/settings/selection toolbar/Library Review, contrast/scaled text, reduced motion, and screen-reader spot check before final accessibility compliance claims.
- Downgrade copy: Critical-path accessibility foundations, browser-backed supporting artifacts, audit docs, keyboard plan, state-copy rules, and a repo-side manual evidence packet intake guard exist; broad accessibility compliance claims still require a filled Section 32 manual packet with owner/date/environment/evidence/verdict rows for the target build.

## Release-note rule

If a release note, store listing, website, demo, or support reply touches any area above, it must either attach the listed stronger evidence or reuse the downgrade copy verbatim. Do not convert repository implementation into paid launch, production maturity, compliance, or store-submission claims.
