import { evidenceReferenceDuplicateIdentity, isEvidenceLikeReference, isPublicHttpsEvidenceUrl as isUrlReference } from "./evidence-reference"

export type AstraMacroOperationalEvidenceAreaId =
  | "first_success_activation_evidence"
  | "learning_library_surface_coverage"
  | "personalization_behavior_evidence"
  | "membership_value_surface_evidence"
  | "product_metrics"
  | "learning_digest"
  | "ai_quality_human_scored_report"
  | "brand_audit"
  | "support_help_center"
  | "pricing_beta_boundary"
  | "learning_science_review_compat"
  | "data_retention_controls"
  | "gtm_release_packet"
  | "store_submission_packet"
  | "ops_role_boundary"
  | "accessibility_manual_evidence"

export type AstraMacroOperationalEvidenceStatus = "proved" | "beta_boundary" | "blocked_until_external_evidence"

export interface AstraMacroOperationalEvidenceItem {
  id: AstraMacroOperationalEvidenceAreaId
  planSections: number[]
  label: string
  status: AstraMacroOperationalEvidenceStatus
  currentEvidence: string[]
  requiredBeforeStrongerClaim: string[]
  downgradeCopy: string
}

export interface AstraMacroOperationalEvidenceDecision {
  publicBetaReady: boolean
  strongerClaimBlocked: boolean
  missingEvidence: AstraMacroOperationalEvidenceItem[]
  downgradeRequired: AstraMacroOperationalEvidenceItem[]
}

export type AstraMacroOperationalEvidenceCompletionVerdict = "proved" | "not-proved"

export interface AstraMacroOperationalEvidenceCompletionPacketRow {
  areaId: AstraMacroOperationalEvidenceAreaId
  ownerDate: string
  environment: string
  evidenceLink: string
  requirementEvidence: string
  verdict: AstraMacroOperationalEvidenceCompletionVerdict
}

export interface AstraMacroOperationalEvidenceCompletionPacketFinding {
  areaId: AstraMacroOperationalEvidenceAreaId
  message: string
  nextStep: string
}

export interface AstraMacroOperationalEvidenceCompletionPacketDecision {
  complete: boolean
  findings: AstraMacroOperationalEvidenceCompletionPacketFinding[]
}

export interface AstraMacroOperationalEvidenceRcNoteOptions {
  generatedAt?: string
  validationEvidence?: string[]
  rcLabel?: string
}

export interface AstraMacroPlanCompletionGateNoteOptions {
  generatedAt?: string
  label?: string
}

export type AstraMacroPlanCompletionBlockerCode =
  | "operational_evidence"
  | "ci_quality_artifacts"
  | "ci_live_browser_artifacts"
  | "owner_release_approval"
  | "manual_qa_checklist"
  | "human_scored_ai_quality"
  | "billing_legal_store_gtm_artifacts"
  | "production_metrics_export"

export interface AstraMacroPlanCompletionEvidence {
  ciQualityArtifactsAttached: boolean
  ciLiveBrowserArtifactsAttached: boolean
  ownerReleaseApprovalRecorded: boolean
  manualQaChecklistComplete: boolean
  humanScoredAiQualityReportAttached: boolean
  billingLegalStoreGtmArtifactsAttached: boolean
  productionMetricsExportAttached: boolean
}

export interface AstraMacroPlanCompletionBlocker {
  code: AstraMacroPlanCompletionBlockerCode
  message: string
}

export interface AstraMacroPlanCompletionDecision {
  complete: boolean
  blockers: AstraMacroPlanCompletionBlocker[]
}

export type AstraMacroLaunchArtifactGroupId = "billing" | "legal_trust" | "store_submission" | "gtm"

export type AstraMacroLaunchArtifactRequirementId =
  | "billing_checkout"
  | "billing_webhook"
  | "billing_entitlement"
  | "billing_cancel_refund"
  | "legal_privacy_terms"
  | "legal_ai_notice"
  | "legal_support_contact"
  | "store_zip_hash"
  | "store_upload_submission"
  | "store_reviewer_notes"
  | "store_screenshots"
  | "gtm_demo_capture"
  | "gtm_storyboard_screenshots"
  | "gtm_copy_claim_review"

export interface AstraMacroLaunchArtifactRequirement {
  id: AstraMacroLaunchArtifactRequirementId
  group: AstraMacroLaunchArtifactGroupId
  label: string
  requiredEvidence: string
}

export interface AstraMacroLaunchArtifactPacketEvidence {
  requirementId: AstraMacroLaunchArtifactRequirementId
  artifactType: string
  artifactId: string
  artifactDigestOrVersion: string
  targetChannel: string
  claimBoundary: AstraMacroLaunchArtifactGroupId
  evidenceLink: string
  ownerDate: string
  environment: string
}

export interface AstraMacroLaunchArtifactPacketFinding {
  requirementId: AstraMacroLaunchArtifactRequirementId | string
  group: AstraMacroLaunchArtifactGroupId
  message: string
  nextStep: string
}

export interface AstraMacroLaunchArtifactPacketDecision {
  acceptable: boolean
  findings: AstraMacroLaunchArtifactPacketFinding[]
}

export type AstraMacroCiArtifactEvidenceField = "ciQualityArtifactsAttached" | "ciLiveBrowserArtifactsAttached"

export interface AstraMacroCiArtifactRequirement {
  evidenceField: AstraMacroCiArtifactEvidenceField
  artifactName: string
  workflowName: string
  label: string
  requiredCoverage: string[]
  requiredEvidence: string
}

export interface AstraMacroCiArtifactPacketEvidence {
  evidenceField: AstraMacroCiArtifactEvidenceField
  artifactName: string
  workflowName: string
  runId: string
  jobName: string
  workflowConclusion?: string
  jobConclusion?: string
  artifactId: string
  artifactDigest: string
  artifactManifestPath: string
  runUrl: string
  artifactUrl: string
  commitSha: string
  ownerDate: string
  coverage: string[]
}

export interface AstraMacroCiArtifactPacketFinding {
  evidenceField: AstraMacroCiArtifactEvidenceField | string
  message: string
  nextStep: string
}

export interface AstraMacroCiArtifactPacketDecision {
  acceptable: boolean
  findings: AstraMacroCiArtifactPacketFinding[]
}

export type AstraMacroReleaseApprovalDecision = "approved_with_downgrades" | "approved_final" | "rejected"

export interface AstraMacroReleaseApprovalRequirement {
  requiredReviewedArtifacts: string[]
  requiredEvidence: string
}

export interface AstraMacroReleaseApprovalPacketEvidence {
  approver: string
  approvalDate: string
  approvalRecordLink: string
  targetCommitSha: string
  decision: AstraMacroReleaseApprovalDecision
  reviewedArtifacts: string[]
  acknowledgesRemainingFinalBlockers: boolean
  acknowledgesDowngradeCopy: boolean
}

export interface AstraMacroReleaseApprovalPacketFinding {
  message: string
  nextStep: string
}

export interface AstraMacroReleaseApprovalPacketDecisionResult {
  acceptable: boolean
  findings: AstraMacroReleaseApprovalPacketFinding[]
}

export const ASTRA_MACRO_RELEASE_APPROVAL_REQUIREMENT: AstraMacroReleaseApprovalRequirement = {
  requiredReviewedArtifacts: [
    "docs/reviews/macro-gate-4-claim-review-2026-05-28.md",
    "docs/reviews/macro-rc-evidence-packet-2026-05-28.md",
    "docs/reviews/macro-final-completion-gate-2026-05-28.md",
    "docs/reviews/macro-final-evidence-intake-2026-05-28.md",
  ],
  requiredEvidence: "Record owner approval with approver/date, approval record link, target commit/SHA, reviewed Gate 4/RC/final gate artifacts, and explicit acknowledgement of remaining final blockers plus downgrade copy.",
}

export type AstraMacroManualQaSection = 6 | 7 | 13 | 14 | 24 | 32
export type AstraMacroManualQaVerdict = "pass" | "pass-with-downgrade" | "fail" | "not-run"

export interface AstraMacroManualQaRequirement {
  section: AstraMacroManualQaSection
  qaRows: string[]
}

export interface AstraMacroManualQaEvidenceRow {
  section: number
  qaRow: string
  ownerDate: string
  environment: string
  evidenceLink: string
  verdict: string
}

export interface AstraMacroManualQaFinding {
  section: number
  qaRow: string
  message: string
  nextStep: string
}

export interface AstraMacroManualQaEvidenceDecision {
  complete: boolean
  findings: AstraMacroManualQaFinding[]
}

export const ASTRA_MACRO_MANUAL_QA_REQUIREMENTS: AstraMacroManualQaRequirement[] = [
  {
    section: 6,
    qaRows: [
      "Article source return",
      "Remote PDF source return",
      "Local PDF unavailable/handoff state",
      "EPUB source return",
      "SRT/VTT subtitle-file source return",
      "Video/transcript-origin card return",
      "Source-only delete",
      "Source + linked-card cascade delete",
      "Theme-pack export/import recovery",
      "Empty/deferred macro asset rows",
    ],
  },
  {
    section: 7,
    qaRows: [
      "Review shaped by goal A",
      "Review shaped by goal B",
      "Personalization disabled fallback",
      "Privacy Mode memory suppression",
      "Excluded-site memory suppression",
      "Options reversibility",
    ],
  },
  {
    section: 13,
    qaRows: [
      "Default onboarding copy",
      "Popup / Deep Read copy",
      "Library / Review copy",
      "Error/boundary copy",
      "Store/landing copy claim freeze",
    ],
  },
  {
    section: 14,
    qaRows: [
      "Support report entrypoint",
      "Known limitations visibility",
      "Degraded-status/support path",
      "Support owner and incident path",
    ],
  },
  {
    section: 24,
    qaRows: ["P0 fixture scoring sample", "Live provider sample", "Blocker sample triage", "Trend/decision note"],
  },
  {
    section: 32,
    qaRows: [
      "No-mouse popup",
      "No-mouse onboarding",
      "No-mouse settings/options",
      "No-mouse selection toolbar",
      "No-mouse Library/Review",
      "Contrast/scaled text",
      "Reduced motion",
      "Screen reader spot check",
    ],
  },
]

export const ASTRA_MACRO_CI_ARTIFACT_REQUIREMENTS: AstraMacroCiArtifactRequirement[] = [
  {
    evidenceField: "ciQualityArtifactsAttached",
    artifactName: "quality-gate-results",
    workflowName: "quality",
    label: "CI quality gate artifact",
    requiredCoverage: [
      "pnpm check:repo-knowledge",
      "pnpm check:zod-entrypoints",
      "pnpm check:macro-final-completion",
      "pnpm type-check",
      "pnpm lint:ci",
      "pnpm test",
      "pnpm bench",
    ],
    requiredEvidence: "Attach a CI quality job/run URL, run/job/artifact identity, artifact digest or checksum, downloadable quality-gate-results artifact, and artifact manifest for the target commit/SHA covering the required quality commands."
  },
  {
    evidenceField: "ciLiveBrowserArtifactsAttached",
    artifactName: "live-bench-results",
    workflowName: "live-browser",
    label: "CI live-browser release-proof artifact",
    requiredCoverage: [
      "source-core",
      "extension-core",
      "learning-loop",
      "document-proof",
      "youtube-proof",
      "youtube-holdout",
    ],
    requiredEvidence: "Attach a CI live-browser job/run URL, run/job/artifact identity, artifact digest or checksum, downloadable live-bench-results artifact, and artifact manifest for the target commit/SHA covering every required release-proof lane."
  },
]

export const ASTRA_MACRO_LAUNCH_ARTIFACT_REQUIREMENTS: AstraMacroLaunchArtifactRequirement[] = [
  { id: "billing_checkout", group: "billing", label: "Billing checkout success/cancel", requiredEvidence: "Production checkout success and cancel-path evidence." },
  { id: "billing_webhook", group: "billing", label: "Billing webhook processing", requiredEvidence: "Webhook receipt, signature validation, retry/idempotency, and event persistence evidence." },
  { id: "billing_entitlement", group: "billing", label: "Entitlement and quota reconciliation", requiredEvidence: "Paid entitlement enforcement and quota reconciliation evidence." },
  { id: "billing_cancel_refund", group: "billing", label: "Cancellation and refund path", requiredEvidence: "Cancellation, refund, and post-cancel access behavior evidence." },
  { id: "legal_privacy_terms", group: "legal_trust", label: "Legal privacy and terms approval", requiredEvidence: "Approved privacy policy, terms, and data-processing review evidence." },
  { id: "legal_ai_notice", group: "legal_trust", label: "AI limitation notice", requiredEvidence: "Approved AI imperfection/learning guidance notice evidence." },
  { id: "legal_support_contact", group: "legal_trust", label: "Support/contact commitment", requiredEvidence: "Monitored support/contact owner and incident escalation evidence." },
  { id: "store_zip_hash", group: "store_submission", label: "Store package hash", requiredEvidence: "Final uploaded package hash and build provenance evidence." },
  { id: "store_upload_submission", group: "store_submission", label: "Store upload/submission status", requiredEvidence: "Target browser/mobile store channel upload, submission, or processing status evidence." },
  { id: "store_reviewer_notes", group: "store_submission", label: "Store reviewer notes", requiredEvidence: "Reviewer notes, privacy questionnaire, or approval/rejection evidence." },
  { id: "store_screenshots", group: "store_submission", label: "Store screenshots", requiredEvidence: "Final store screenshot set tied to the uploaded build." },
  { id: "gtm_demo_capture", group: "gtm", label: "GTM demo capture", requiredEvidence: "Current sub-60s demo capture evidence." },
  { id: "gtm_storyboard_screenshots", group: "gtm", label: "GTM storyboard/screenshots", requiredEvidence: "Final screenshots/storyboards for launch media." },
  { id: "gtm_copy_claim_review", group: "gtm", label: "GTM copy claim review", requiredEvidence: "Claim review showing demo/store/landing copy uses allowed downgrade wording." },
]

export const ASTRA_MACRO_LAUNCH_ARTIFACT_GROUPS: AstraMacroLaunchArtifactGroupId[] = [
  "billing",
  "legal_trust",
  "store_submission",
  "gtm",
]

export const ASTRA_MACRO_OPERATIONAL_EVIDENCE: AstraMacroOperationalEvidenceItem[] = [
  {
    id: "first_success_activation_evidence",
    planSections: [4],
    label: "First-success activation evidence",
    status: "beta_boundary",
    currentEvidence: [
      "src/utils/first-success.ts",
      "src/utils/first-success.test.ts",
      "src/utils/learning-loop-events.ts",
      "src/entrypoints/onboarding/OnboardingApp.tsx",
      "src/entrypoints/onboarding/OnboardingApp.test.tsx",
      "src/entrypoints/sample-lesson/SampleLessonApp.tsx",
      "docs/specs/first-success.md",
      "docs/reviews/first-success-activation-evidence-note-2026-05-28.md",
    ],
    requiredBeforeStrongerClaim: ["Attach a dated target-build activation smoke report and/or cohort export proving the plan's <60 second timing and numeric conversion targets, not just the instrumented path or smoke-report evaluator."],
    downgradeCopy: "First-success path, onboarding boundary, sample-loop contracts, activation event dashboard drift checks, and a repo-side smoke-report evaluator/evidence note exist; numeric activation targets and current target-build timing still need dated smoke or cohort evidence before being claimed met.",
  },
  {
    id: "learning_library_surface_coverage",
    planSections: [6],
    label: "Learning Library surface coverage",
    status: "beta_boundary",
    currentEvidence: ["src/utils/learning-library-experience.ts", "src/utils/storage/learning-assets.ts", "src/entrypoints/vocabulary/VocabularyApp.tsx", "src/entrypoints/vocabulary/VocabularyApp.test.tsx", "docs/specs/learning-library-experience.md", "docs/reviews/library-qa-evidence-note-2026-05-28.md", "docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md"],
    requiredBeforeStrongerClaim: ["Fill the Section 6 rows in docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md and attach current manual/browser QA for richer per-asset flows and representative source return/delete/export walkthroughs across all macro asset types before stronger completion claims."],
    downgradeCopy: "Library home, source map, asset projection, visible ready/empty/planned rows for every macro asset type, and a repo-side Library QA note exist; richer first-class per-asset flows remain beta/deferred.",
  },
  {
    id: "personalization_behavior_evidence",
    planSections: [7],
    label: "Personalization behavior evidence",
    status: "beta_boundary",
    currentEvidence: ["src/utils/personalization-experience.ts", "src/utils/personalization-experience.test.ts", "src/utils/storage/learning-profile.ts", "src/utils/storage/learning-memory.ts", "src/entrypoints/options/OptionsApp.tsx", "src/entrypoints/vocabulary/ReviewMode.tsx", "src/entrypoints/vocabulary/ReviewMode.test.tsx", "docs/reviews/personalization-qa-evidence-note-2026-05-28.md", "docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md"],
    requiredBeforeStrongerClaim: ["Fill the Section 7 rows in docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md and attach current manual/browser QA for profile-shaped Review behavior, disabled personalization fallback, excluded-site/Privacy Mode boundaries, and Options reversibility before stronger personalization claims."],
    downgradeCopy: "Learning profile and memory controls are visible and reversible; Review visibly uses the profile to shape queue order and daily session size, and a repo-side personalization QA note exists while broader automatic adaptation remains conservative and beta-boundary.",
  },
  {
    id: "membership_value_surface_evidence",
    planSections: [8],
    label: "Membership value surface evidence",
    status: "beta_boundary",
    currentEvidence: [
      "src/utils/membership-value.ts",
      "src/utils/membership-value.test.ts",
      "apps/mobile/src/domain/mobileMembership.ts",
      "apps/mobile/src/domain/mobileMembership.test.ts",
      "apps/mobile/src/screens/MeScreen.tsx",
      "docs/specs/membership-value.md",
      "docs/help/membership-works.md",
      "docs/runbooks/billing-free-policy.md",
      "docs/reviews/membership-value-evidence-note-2026-05-28.md",
    ],
    requiredBeforeStrongerClaim: ["Attach production billing checkout/portal/webhook/cancellation/refund evidence, target-release entitlement evidence, owner/legal/store approval, target-build manual QA for Free/Trial/Pro/canceled/expired states, and final Free/Pro tier behavior before using paid value or launch-complete membership claims."],
    downgradeCopy: "Membership value, preferred/forbidden copy, Free/Pro/later boundaries, and mobile safe status display are covered by repo-side tests/evidence; public surfaces remain free-beta and paid value moments must stay disabled or explicitly not launched until production billing, entitlement, legal/store approval, and target-build QA evidence are attached.",
  },
  {
    id: "product_metrics",
    planSections: [11, 34],
    label: "Product metrics operational evidence",
    status: "beta_boundary",
    currentEvidence: [
      "src/utils/product-metrics.ts",
      "src/utils/product-metrics.test.ts",
      "src/utils/learning-loop-events.ts",
      "src/utils/learning-loop-events.test.ts",
      "src/entrypoints/options/OptionsApp.tsx",
      "src/entrypoints/options/OptionsApp.test.tsx",
      "docs/specs/product-metrics.md",
      "docs/specs/metrics-dictionary.md",
      "src/server/index.ts",
      "src/server/user-store.ts",
      "src/server/index.test.ts",
      "docs/analysis/minimal-mobile-retention-ops-summary-checklist-2026-05-28.md",
      "docs/reviews/product-metrics-evidence-note-2026-05-28.md",
      "docs/reviews/production-metrics-export-evidence-note-2026-05-28.md",
      "docs/reviews/macro-product-metrics-readiness-packet-2026-05-28.json",
    ],
    requiredBeforeStrongerClaim: ["Attach dated CI or production dashboard/export evidence showing Activation, Understanding, Learning, and Membership metrics are queryable for the target commit/worktree or release cohort, with date range, cohort definition, dashboard/query source, export id, timezone-bearing exported-at timestamp, digest/checksum, query version, category-aligned metric ids, evidence link, owner/date, privacy-review evidence that satisfies evaluateAstraProductionMetricsExportPacket(), and a product-metrics readiness packet that satisfies evaluateAstraProductMetricsReadiness(). The aggregate mobile retention ops summary is repo-side visibility only and does not satisfy production/cohort export evidence."],
    downgradeCopy: "Metrics contracts, local V0 Options diagnostics, metadata-only aggregators, an aggregate-only mobile retention ops summary, a production metrics export packet intake guard, and a product metrics readiness packet placeholder exist in repo; production/release-cohort dashboard exports with export identity, digest/checksum, query version, cohort definitions, privacy review, readiness evidence, and owner-approved query evidence remain required before claiming operational metric maturity.",
  },
  {
    id: "learning_digest",
    planSections: [12],
    label: "Learning Digest product evidence",
    status: "beta_boundary",
    currentEvidence: [
      "src/utils/learning-digest-experience.ts",
      "src/utils/storage/learning-assets.ts",
      "src/utils/storage/learning-assets.test.ts",
      "src/entrypoints/vocabulary/VocabularyApp.tsx",
      "src/entrypoints/vocabulary/VocabularyApp.test.tsx",
      "src/server/index.ts",
      "src/server/ops-audit-log-store.ts",
      "src/server/index.test.ts",
      "docs/specs/learning-digest-experience.md",
      "docs/reviews/learning-digest-qa-evidence-note-2026-05-28.md",
      "docs/analysis/minimal-weekly-digest-delivery-ops-checklist-2026-05-28.md",
    ],
    requiredBeforeStrongerClaim: ["Attach target-build Learning Digest QA evidence with owner/date/environment/verdict for rendered digest Review/continue behavior, repeated-vocabulary/common-topic display, optional outbound controls, and Privacy Mode outbound restrictions, plus production Resend/Expo/APNs/FCM delivery-monitoring evidence before stronger Learning Digest completion or delivery claims."],
    downgradeCopy: "A local Library digest shows aggregate counts, Review/continue actions, metadata-safe repeated vocabulary/topics, source exclusion, and local telemetry with a repo-side QA evidence note; the mobile relay has repo-side Weekly Digest email/push run foundations and an aggregate-only delivery summary, while production inbox/device deliverability, provider webhook receipts, alerting, and target-build walkthrough QA remain beta-boundary.",
  },
  {
    id: "ai_quality_human_scored_report",
    planSections: [24],
    label: "Human-scored AI quality report",
    status: "beta_boundary",
    currentEvidence: [
      "src/utils/ai-quality-system.ts",
      "src/utils/ai-quality-system.test.ts",
      "src/utils/ai-safety.ts",
      "src/utils/ai-safety.test.ts",
      "test/fixtures/quality/ai-quality-samples.json",
      "test/fixtures/quality/prompt-injection.json",
      "docs/quality/rubrics.md",
      "docs/reviews/ai-quality-human-scored-evidence-note-2026-05-28.md",
      "docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md",
    ],
    requiredBeforeStrongerClaim: ["Fill the Section 24 rows in docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md and attach a dated human-scored provider-quality report with reviewer/date, run metadata, fixture manifest version, live provider sample evidence, blocker triage, trend, and release decision before production AI-quality claims."],
    downgradeCopy: "Deterministic AI-quality utilities, rubric, fixture manifests, safety fixtures, release-threshold evaluation, trend logic, and a repo-side human-scored report intake guard exist; production quality claims still require a dated human-scored provider-quality report with Section 24 owner/evidence/verdict rows.",
  },
  {
    id: "brand_audit",
    planSections: [13],
    label: "Brand and aesthetic surface audit",
    status: "beta_boundary",
    currentEvidence: [
      "src/utils/brand-experience.ts",
      "src/utils/brand-experience.test.ts",
      "docs/specs/brand-experience.md",
      "src/assets/astra-style1-tokens.css",
      "docs/reviews/brand-default-surface-evidence-note-2026-05-28.md",
      "docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md",
    ],
    requiredBeforeStrongerClaim: ["Fill the Section 13 rows in docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md and attach current default-surface screenshots/browser walkthroughs, store/landing copy approval, and owner/date/environment/evidence/verdict rows using the brand discouraged-term and preferred-tone helpers."],
    downgradeCopy: "Brand principles, copy screening helpers, default-surface audit inventory, token references, and a repo-side Section 13 evidence note exist; broad aesthetic polish, screenshots/browser walkthroughs, store/landing copy approval, and owner-signed manual rows remain required before strengthening brand-quality claims.",
  },
  {
    id: "support_help_center",
    planSections: [14],
    label: "Support, help center, and status evidence",
    status: "beta_boundary",
    currentEvidence: [
      "src/utils/support-experience.ts",
      "src/utils/support-experience.test.ts",
      "src/utils/support-bundle.ts",
      "src/utils/support-bundle.test.ts",
      "src/utils/support-response-macros.ts",
      "src/utils/support-response-macros.test.ts",
      "src/entrypoints/options/OptionsApp.tsx",
      "src/entrypoints/popup/App.tsx",
      "src/entrypoints/content/components/FloatBall.tsx",
      "src/web/src/app.tsx",
      "src/server/index.ts",
      "docs/specs/support-experience.md",
      "docs/help/index.md",
      "docs/help/known-limitations.md",
      "docs/status.md",
      "docs/reviews/support-help-center-evidence-note-2026-05-28.md",
      "docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md",
    ],
    requiredBeforeStrongerClaim: ["Fill the Section 14 rows in docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md and attach evidence for hosted help/status URLs, monitored support owner/inbox, incident path, current support-entrypoint walkthroughs, and production metadata-only support-report operations before support maturity claims."],
    downgradeCopy: "Metadata-only reporting, first-response macros, repo help topics, known-limitations copy, a status boundary, and a repo-side support/help evidence note exist; hosted help/status URLs, monitored support ownership, incident operations, and manual support-entrypoint QA remain release-boundary evidence.",
  },
  {
    id: "pricing_beta_boundary",
    planSections: [8, 21],
    label: "Pricing, trial, and paywall launch boundary",
    status: "blocked_until_external_evidence",
    currentEvidence: [
      "src/utils/product-strategy.ts",
      "src/utils/product-strategy.test.ts",
      "docs/runbooks/billing-free-policy.md",
      "docs/specs/product-strategy-persona-jtbd-paywall.md",
      "docs/analysis/v1-activation-trial-support-checklist-2026-05-27.md",
      "docs/help/known-limitations.md",
      "docs/reviews/membership-value-evidence-note-2026-05-28.md",
      "docs/reviews/launch-artifact-packet-evidence-note-2026-05-28.md",
      "docs/reviews/pricing-beta-boundary-evidence-note-2026-05-28.md",
    ],
    requiredBeforeStrongerClaim: ["Do not launch paid claims until production billing checkout/portal, webhook, durable subscription persistence, entitlement enforcement, quota reconciliation, cancellation/refund, support, legal/privacy/terms, store-policy approval, owner signoff, and target-build manual QA evidence are recorded."],
    downgradeCopy: "Astra is a free public beta; Trial/Pro/paid checkout, subscription, entitlement, cancellation/refund, and pricing claims are explicitly not launched. Repo-side free-beta policy, paywall strategy, beta-safe trial-interest observability, membership copy guardrails, and a pricing boundary evidence note exist, but paid launch remains externally blocked.",
  },
  {
    id: "learning_science_review_compat",
    planSections: [22],
    label: "Learning science Review compatibility boundary",
    status: "proved",
    currentEvidence: ["src/utils/learning-science.ts", "src/entrypoints/vocabulary/ReviewMode.tsx", "src/entrypoints/vocabulary/ReviewMode.test.tsx", "docs/specs/learning-science-review.md"],
    requiredBeforeStrongerClaim: ["Keep the default Review button row to Again, Good, and Easy; if Hard remains available, keep it secondary and compatibility-scoped rather than part of the default learner-facing model."],
    downgradeCopy: "Review now defaults to the macro three-grade learner-facing model while retaining Hard only as a legacy keyboard compatibility path.",
  },
  {
    id: "data_retention_controls",
    planSections: [9, 26],
    label: "Data retention and user-control evidence",
    status: "beta_boundary",
    currentEvidence: [
      "src/utils/data-retention-control.ts",
      "src/utils/data-retention-control.test.ts",
      "src/entrypoints/options/OptionsApp.tsx",
      "src/entrypoints/vocabulary/VocabularyApp.tsx",
      "src/entrypoints/vocabulary/VocabularyApp.test.tsx",
      "src/utils/storage/learning-data-export.ts",
      "src/utils/storage/learning-data-export.test.ts",
      "src/utils/support-bundle.ts",
      "src/utils/support-bundle.test.ts",
      "src/server/index.ts",
      "src/server/user-store.ts",
      "src/server/index.test.ts",
      "src/platform/cloudflare/src/handlers/account-lifecycle.ts",
      "src/platform/cloudflare/src/queues/continuity-lifecycle.ts",
      "src/platform/cloudflare/src/handlers/account-lifecycle.test.ts",
      "src/platform/cloudflare/src/queues/continuity-lifecycle.test.ts",
      "docs/specs/data-retention-user-control.md",
      "docs/help/delete-your-data.md",
      "docs/reviews/data-retention-evidence-note-2026-05-28.md",
    ],
    requiredBeforeStrongerClaim: ["Attach target-release deployment receipts for relay account deletion and Cloudflare continuity lifecycle, complete account/billing/legal deletion orchestration evidence, cancellation/access behavior evidence, and manual RC walkthroughs before claiming complete self-serve data lifecycle."],
    downgradeCopy: "Local export/delete controls, metadata-only support bundles, relay account-delete foundation, Cloudflare collection-scoped cloud-delete lifecycle, and delete-data help copy exist in repo; production deployment receipts, complete account/billing/legal deletion orchestration, cancellation/access evidence, and manual RC verification remain required.",
  },
  {
    id: "gtm_release_packet",
    planSections: [27],
    label: "GTM release artifact packet",
    status: "blocked_until_external_evidence",
    currentEvidence: [
      "src/utils/gtm-campaign.ts",
      "src/utils/gtm-campaign.test.ts",
      "docs/gtm/demos.md",
      "store/listing-copy.md",
      "docs/reviews/launch-artifact-packet-evidence-note-2026-05-28.md",
      "docs/reviews/gtm-release-packet-evidence-note-2026-05-28.md",
    ],
    requiredBeforeStrongerClaim: ["Attach final target-build screenshots/storyboards, current sub-60-second demo captures, owner/date/environment verdict rows, claim-review evidence, and hosted/uploaded public launch artifact links before claiming GTM launch packet complete."],
    downgradeCopy: "GTM channel plan, sub-60-second demo scripts, launch-safe copy deck, store listing draft, technical-term guard, launch artifact packet intake, and a repo-side GTM evidence note exist; final target-build screenshots/storyboards, recorded demo captures, hosted/uploaded launch artifacts, and owner-approved claim review remain external launch work.",
  },
  {
    id: "store_submission_packet",
    planSections: [28],
    label: "Store listing and permission trust submission packet",
    status: "blocked_until_external_evidence",
    currentEvidence: [
      "store/listing-copy.md",
      "docs/runbooks/browser-store-submission.md",
      "src/utils/trust/compliance.ts",
      "apps/mobile/scripts/verify-mobile-scaffold.mjs",
      "apps/mobile/package.json",
      "apps/mobile/store/README.md",
      "apps/mobile/store/ios/app-store-connect.md",
      "apps/mobile/store/android/play-listing.md",
      "apps/mobile/store/privacy.md",
      "apps/mobile/store/screenshots/README.md",
      "apps/mobile/store/reviewer-notes.md",
      "apps/mobile/store/signed-build-qa.md",
      "apps/mobile/store/release-checklist.md",
      "docs/reviews/store-submission-evidence-note-2026-05-28.md",
    ],
    requiredBeforeStrongerClaim: ["Record final hosted privacy/support/marketing URLs, package/build identifiers and hashes, final signed-build screenshots, signed-build functional/accessibility QA rows, target browser/mobile store channel upload, submission, or processing status, console privacy forms, reviewer notes entered in store consoles, and approval/rejection evidence before claiming store submission complete."],
    downgradeCopy: "Store copy, permission trust, native mobile Store/TestFlight/Play draft release-pack materials, and a repo-side store-submission evidence note are prepared in repo; final signed-build capture, upload/submission, console form, URL approval, and reviewer-status evidence remain pending external store work.",
  },
  {
    id: "ops_role_boundary",
    planSections: [30],
    label: "Operations console role boundary",
    status: "beta_boundary",
    currentEvidence: [
      "src/utils/ops-console.ts",
      "src/utils/ops-console.test.ts",
      "src/server/config.ts",
      "src/server/config.test.ts",
      "src/server/index.ts",
      "src/server/index.test.ts",
      "src/server/ops-audit-log-store.ts",
      "src/utils/operating-review.ts",
      "src/utils/operating-review.test.ts",
      "src/web/src/lib/astra-web.ts",
      "src/web/src/lib/astra-web.test.ts",
      "src/web/src/app.tsx",
      "src/web/src/app.test.tsx",
      "docs/reviews/ops-role-boundary-evidence-note-2026-05-28.md",
    ],
    requiredBeforeStrongerClaim: ["Attach production operator-principal provisioning evidence, legacy admin-token fallback decision, deployed per-role walkthroughs including ops cockpit/provider-health visibility by role, staff-process owner approval, and target-release route/surface deployment evidence before production ops maturity claims."],
    downgradeCopy: "Env-backed operator roles, server-side route permission checks, denied-attempt audit logs, metadata-only operator audit output, and repo-side aggregate ops cockpit/operating-review surfaces exist in repo; production operator provisioning, legacy admin-token fallback retirement/approval, deployed role walkthroughs, and staff process evidence remain required before full ops-console role maturity claims.",
  },
  {
    id: "accessibility_manual_evidence",
    planSections: [32],
    label: "Accessibility manual evidence packet",
    status: "beta_boundary",
    currentEvidence: [
      "src/utils/accessibility-readiness.ts",
      "src/utils/accessibility-readiness.test.ts",
      "docs/accessibility/accessibility-audit.md",
      "docs/accessibility/keyboard-test.md",
      "docs/reviews/accessibility-browser-evidence-note-2026-05-28.md",
      "docs/reviews/accessibility-manual-evidence-note-2026-05-28.md",
      "docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md",
    ],
    requiredBeforeStrongerClaim: ["Fill the Section 32 rows in docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md and attach a current filled evidence row set for no-mouse popup/onboarding/settings/selection toolbar/Library Review, contrast/scaled text, reduced motion, and screen-reader spot check before final accessibility compliance claims."],
    downgradeCopy: "Critical-path accessibility foundations, browser-backed supporting artifacts, audit docs, keyboard plan, state-copy rules, and a repo-side manual evidence packet intake guard exist; broad accessibility compliance claims still require a filled Section 32 manual packet with owner/date/environment/evidence/verdict rows for the target build.",
  },
]

export function evaluateAstraMacroOperationalEvidence(items: AstraMacroOperationalEvidenceItem[] = ASTRA_MACRO_OPERATIONAL_EVIDENCE): AstraMacroOperationalEvidenceDecision {
  const missingEvidence = items.filter((item) => item.status === "blocked_until_external_evidence")
  const downgradeRequired = items.filter((item) => item.status !== "proved")

  return {
    publicBetaReady: missingEvidence.length === 0 || missingEvidence.every((item) => item.downgradeCopy.length > 0),
    strongerClaimBlocked: downgradeRequired.length > 0,
    missingEvidence,
    downgradeRequired,
  }
}

export function evaluateAstraMacroOperationalEvidenceCompletionPacket(
  rows: readonly AstraMacroOperationalEvidenceCompletionPacketRow[],
  items: readonly AstraMacroOperationalEvidenceItem[] = ASTRA_MACRO_OPERATIONAL_EVIDENCE,
): AstraMacroOperationalEvidenceCompletionPacketDecision {
  const findings: AstraMacroOperationalEvidenceCompletionPacketFinding[] = []
  const rowsByArea = new Map<AstraMacroOperationalEvidenceAreaId, AstraMacroOperationalEvidenceCompletionPacketRow>()
  const expectedAreaIds = new Set(items.map((item) => item.id))
  const seenEvidenceLinks = new Map<string, AstraMacroOperationalEvidenceAreaId>()

  for (const row of rows) {
    const normalizedAreaId = row.areaId.trim()
    const areaIdIdentity = normalizedAreaId.toLowerCase()
    const canonicalAreaId = items.find((item) => item.id.toLowerCase() === areaIdIdentity)?.id
    if (normalizedAreaId !== row.areaId || (canonicalAreaId !== undefined && canonicalAreaId !== row.areaId)) {
      findings.push({
        areaId: row.areaId,
        message: `${row.areaId} must use canonical operational evidence area casing without surrounding whitespace.`,
        nextStep: "Use the exact area id from ASTRA_MACRO_OPERATIONAL_EVIDENCE.",
      })
    }
    if (canonicalAreaId === undefined || !expectedAreaIds.has(canonicalAreaId)) {
      findings.push({
        areaId: row.areaId,
        message: `${row.areaId} is not a tracked macro operational evidence area.`,
        nextStep: "Use an area id from ASTRA_MACRO_OPERATIONAL_EVIDENCE.",
      })
      continue
    }
    if (rowsByArea.has(canonicalAreaId)) {
      findings.push({
        areaId: row.areaId,
        message: `${row.areaId} has duplicate operational completion evidence rows.`,
        nextStep: "Keep one owner/date/environment/evidence-backed row per operational evidence area.",
      })
      continue
    }
    const evidenceLink = row.evidenceLink.trim()
    const evidenceLinkIdentity = evidenceReferenceDuplicateIdentity(row.evidenceLink)
    if (evidenceLink.length > 0) {
      const existingAreaId = seenEvidenceLinks.get(evidenceLinkIdentity)
      if (existingAreaId && existingAreaId !== canonicalAreaId) {
        findings.push({
          areaId: row.areaId,
          message: `${row.areaId} reuses operational evidence link ${evidenceLink}.`,
          nextStep: "Attach area-specific target-release evidence so every operational claim can be audited independently.",
        })
      }
      seenEvidenceLinks.set(evidenceLinkIdentity, canonicalAreaId)
    }

    rowsByArea.set(canonicalAreaId, { ...row, areaId: canonicalAreaId })
  }

  for (const item of items) {
    const row = rowsByArea.get(item.id)
    if (!row) {
      findings.push({
        areaId: item.id,
        message: `${item.label} completion evidence is missing.`,
        nextStep: item.requiredBeforeStrongerClaim.join(" "),
      })
      continue
    }

    if (row.verdict !== "proved") {
      findings.push({
        areaId: item.id,
        message: `${item.label} is not proved in the operational completion packet.`,
        nextStep: item.requiredBeforeStrongerClaim.join(" "),
      })
    }
    if (isBlank(row.ownerDate)) {
      findings.push({
        areaId: item.id,
        message: `${item.label} is missing owner/date.`,
        nextStep: "Record who reviewed the operational evidence and when.",
      })
    } else if (!hasOwnerIdentityWithIsoDate(row.ownerDate)) {
      findings.push({
        areaId: item.id,
        message: `${item.label} owner/date must identify a real owner and include a YYYY-MM-DD date.`,
        nextStep: "Record the real operational evidence owner and review date using YYYY-MM-DD.",
      })
    }
    if (isBlank(row.environment)) {
      findings.push({
        areaId: item.id,
        message: `${item.label} is missing environment or target release context.`,
        nextStep: "Record target build, browser/OS, deployment, cohort, provider, or release-candidate context.",
      })
    } else if (row.environment.trim() !== row.environment) {
      findings.push({
        areaId: item.id,
        message: `${item.label} environment must be canonical without surrounding whitespace.`,
        nextStep: "Record the real target environment or release context for this proof without surrounding whitespace.",
      })
    } else if (isWeakContextEvidenceReference(row.environment)) {
      findings.push({
        areaId: item.id,
        message: `${item.label} environment is placeholder evidence.`,
        nextStep: "Record the real target environment or release context for this proof.",
      })
    } else if (!isSpecificOperationalEnvironment(row.environment)) {
      findings.push({
        areaId: item.id,
        message: `${item.label} environment must include target-release context plus concrete build/browser/deployment/cohort/provider evidence details.`,
        nextStep: "Record target build, browser/OS, deployment, cohort, provider, packet, dashboard, QA, approval, or artifact context.",
      })
    }
    if (isBlank(row.evidenceLink)) {
      findings.push({
        areaId: item.id,
        message: `${item.label} is missing an evidence link.`,
        nextStep: "Attach the target-build evidence packet, dashboard export, QA row, approval record, or external artifact link.",
      })
    } else if (isPlaceholderEvidenceReference(row.evidenceLink)) {
      findings.push({
        areaId: item.id,
        message: `${item.label} link is placeholder evidence.`,
        nextStep: "Attach the real target-build evidence packet, dashboard export, QA row, approval record, or external artifact link.",
      })
    } else if (!isEvidenceLikeReference(row.evidenceLink)) {
      findings.push({
        areaId: item.id,
        message: `${item.label} evidence link must be a URL or repo artifact path.`,
        nextStep: "Attach a URL or repo path under docs/, data/, artifacts/, test-results/, or playwright-report/.",
      })
    }
    if (isBlank(row.requirementEvidence)) {
      findings.push({
        areaId: item.id,
        message: `${item.label} is missing requirement-evidence notes.`,
        nextStep: item.requiredBeforeStrongerClaim.join(" "),
      })
    } else if (isPlaceholderEvidenceReference(row.requirementEvidence)) {
      findings.push({
        areaId: item.id,
        message: `${item.label} requirement-evidence notes are placeholder evidence.`,
        nextStep: item.requiredBeforeStrongerClaim.join(" "),
      })
    } else if (!includesRequiredEvidenceTerms(row.requirementEvidence, item)) {
      findings.push({
        areaId: item.id,
        message: `${item.label} requirement-evidence notes do not reference the required stronger-claim evidence.`,
        nextStep: item.requiredBeforeStrongerClaim.join(" "),
      })
    }
  }

  return { complete: findings.length === 0, findings }
}

export function macroOperationalEvidenceForSection(section: number): AstraMacroOperationalEvidenceItem[] {
  return ASTRA_MACRO_OPERATIONAL_EVIDENCE.filter((item) => item.planSections.includes(section))
}

function isBlank(value: string): boolean {
  return value.trim().length === 0
}

function isPlaceholderEvidenceReference(value: string): boolean {
  const normalizedValue = value.toLowerCase()
  return normalizedValue.includes("example")
    || normalizedValue.includes("placeholder")
    || normalizedValue.includes("todo")
    || /\b(?:mock|draft|tbd|pending|temp|temporary)\b/.test(normalizedValue)
    || /\b(?:(?:fake|dummy|latest|dev|local)[-_ ]?(?:proof|evidence|artifact|report)|(?<!provider[-_ ])sample[-_ ]?(?:proof|evidence|artifact|report)|(?:proof|evidence|artifact|report)[-_ ]?(?:sample|fake|dummy|latest|dev|local))\b/.test(normalizedValue)
}

function isPlaceholderIdentityReference(value: string): boolean {
  if (value.trim() !== value) return true
  const [localIdentityText = "", domainIdentityText = ""] = value.split("@")
  const identityText = value.includes("@") ? `${localIdentityText} ${domainIdentityText}` : value
  const normalizedIdentityText = identityText
    .replace(/[—–_/.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
  if (/\b(?:example|placeholder|todo|mock|draft|tbd|pending|temp|temporary|none|n\/a|na)\b/i.test(normalizedIdentityText)) return true
  if (!value.includes("@") && /^(?:owner|release owner|approver|release approver|qa|tester)$/i.test(normalizedIdentityText)) return true
  return false
}

function digestOrVersionIdentity(value: string): string {
  return value
    .trim()
    .toLowerCase()
      .replace(/^(?:(?:sha(?:256|384|512)?|checksum|digest|version|build|artifact|run|rubric|fixture|manifest|export|query)[:=/ -]+)+/, "")
}

function launchArtifactIdDuplicateIdentity(value: string): string {
  const trimmedValue = value.trim()
  return /^https?:\/\//i.test(trimmedValue)
    ? evidenceReferenceDuplicateIdentity(trimmedValue)
    : digestOrVersionIdentity(value)
}

function hasWeakEvidenceKeyword(value: string): boolean {
  return /\b(?:dummy|sample|fake|mock|draft|tbd|pending|temp|temporary|local|none|n\/a|na|latest|dev|test)\b/.test(value.trim().toLowerCase())
}

function isWeakDigestReference(value: string): boolean {
  const normalizedValue = value.trim().toLowerCase()
  const identityValue = digestOrVersionIdentity(value).replace(/[^a-z0-9]/g, "")

  return identityValue.length < 12
    || /^0+$/.test(identityValue)
    || /^([a-z0-9])\1+$/.test(identityValue)
    || hasWeakEvidenceKeyword(normalizedValue)
}

function isCanonicalDigestReference(value: string): boolean {
  if (value.trim() !== value || isWeakDigestReference(value)) return false
  const normalizedValue = value.trim().toLowerCase()
  const identityValue = digestOrVersionIdentity(value)
  const compactValue = identityValue.replace(/[^a-f0-9]/g, "")
  const compactAlnumValue = identityValue.replace(/[^a-z0-9]/g, "")
  return /^(?:sha(?:256|384|512)?|checksum|digest)[:=/ -]+/.test(normalizedValue)
    && compactValue === compactAlnumValue
    && /^(?:[a-f0-9]{32}|[a-f0-9]{40}|[a-f0-9]{64}|[a-f0-9]{96}|[a-f0-9]{128})$/.test(compactValue)
}

function isWeakContextEvidenceReference(value: string): boolean {
  const normalizedValue = value.trim().toLowerCase()
  return isPlaceholderEvidenceReference(normalizedValue) || hasWeakEvidenceKeyword(normalizedValue)
}

function isSpecificOperationalEnvironment(value: string): boolean {
  const normalizedValue = value.toLowerCase()
  const hasReleaseContext = /\b(?:target|release|rc|candidate|production)\b/.test(normalizedValue)
  const hasConcreteEvidenceContext = /\b(?:build|browser|os|deployment|cohort|provider|packet|dashboard|qa|approval|artifact|chrome|chromium|firefox|safari|edge|macos|windows|linux|relay|extension|web app|store|billing|gtm|metrics|ci)\b/.test(normalizedValue)
  return hasReleaseContext && hasConcreteEvidenceContext
}

function hasLaunchArtifactGroupContext(value: string, group: AstraMacroLaunchArtifactGroupId): boolean {
  const normalizedValue = value.toLowerCase().replace(/[_-]+/g, " ")
  const normalizedGroup = group.toLowerCase().replace(/[_-]+/g, " ")
  if (normalizedValue.includes(normalizedGroup)) return true
  switch (group) {
    case "billing":
      return /\b(?:billing|stripe|checkout|webhook|entitlement|quota|refund|subscription|portal)\b/.test(normalizedValue)
    case "legal_trust":
      return /\b(?:legal|trust|privacy|terms|policy|support|contact|notice|ai limitation)\b/.test(normalizedValue)
    case "store_submission":
      return /\b(?:store|submission|reviewer|screenshot|package|zip|chrome web store|app store|play listing|signed build)\b/.test(normalizedValue)
    case "gtm":
      return /\b(?:gtm|demo|storyboard|launch media|copy|claim review|campaign|marketing)\b/.test(normalizedValue)
  }
}

function hasLaunchArtifactRequirementContext(value: string, requirementId: AstraMacroLaunchArtifactRequirementId): boolean {
  const normalizedValue = value.toLowerCase().replace(/[_-]+/g, " ")
  switch (requirementId) {
    case "billing_checkout":
      return /\b(?:checkout|payment|portal|checkout success)\b/.test(normalizedValue)
    case "billing_webhook":
      return /\bwebhook\b/.test(normalizedValue)
    case "billing_entitlement":
      return /\b(?:entitlement|quota)\b/.test(normalizedValue)
    case "billing_cancel_refund":
      return /\b(?:cancel|cancellation|refund)\b/.test(normalizedValue)
    case "legal_privacy_terms":
      return /\b(?:privacy|terms|policy)\b/.test(normalizedValue)
    case "legal_ai_notice":
      return /\b(?:ai notice|ai limitation|limitation notice)\b/.test(normalizedValue)
    case "legal_support_contact":
      return /\b(?:support|contact|incident)\b/.test(normalizedValue)
    case "store_zip_hash":
      return /\b(?:zip|package|hash|signed build)\b/.test(normalizedValue)
    case "store_upload_submission":
      return /\b(?:upload|submission|submitted)\b/.test(normalizedValue)
    case "store_reviewer_notes":
      return /\b(?:reviewer|notes|questionnaire|approval)\b/.test(normalizedValue)
    case "store_screenshots":
      return /\bscreenshots?\b/.test(normalizedValue)
    case "gtm_demo_capture":
      return /\b(?:demo|capture)\b/.test(normalizedValue)
    case "gtm_storyboard_screenshots":
      return /\b(?:storyboard|screenshots?)\b/.test(normalizedValue)
    case "gtm_copy_claim_review":
      return /\b(?:copy|claim review|claim)\b/.test(normalizedValue)
  }
}

function isSpecificLaunchArtifactType(value: string, requirement: AstraMacroLaunchArtifactRequirement): boolean {
  const normalizedValue = value.toLowerCase().replace(/[_-]+/g, " ")
  const namesArtifactSurface = /\b(?:artifact|record|approval|upload|submission|screenshot|capture|package|hash|policy|media|copy|review|provider|build|receipt|portal|webhook|entitlement|quota|refund|notice|notes)\b/.test(normalizedValue)
  return namesArtifactSurface && hasLaunchArtifactGroupContext(value, requirement.group) && hasLaunchArtifactRequirementContext(value, requirement.id)
}

function isSpecificLaunchTargetChannel(value: string, requirement: AstraMacroLaunchArtifactRequirement): boolean {
  const normalizedValue = value.toLowerCase().replace(/[_-]+/g, " ")
  const namesTargetChannel = /\b(?:target|release|production|channel|provider|store|console|public|browser|mobile|web|gtm|billing|legal|privacy|terms|checkout|webhook|entitlement|quota|refund|notice|support|package|upload|submission|reviewer|screenshots?|demo|storyboard|copy|claim)\b/.test(normalizedValue)
  return namesTargetChannel && hasLaunchArtifactGroupContext(value, requirement.group) && hasLaunchArtifactRequirementContext(value, requirement.id)
}

function isSpecificLaunchArtifactEnvironment(value: string, requirement: AstraMacroLaunchArtifactRequirement): boolean {
  const normalizedValue = value.toLowerCase().replace(/[_-]+/g, " ")
  const hasReleaseContext = /\b(?:target|release|rc|candidate|production)\b/.test(normalizedValue)
  const hasChannelOrRuntimeContext = /\b(?:channel|environment|provider|store|submission|billing|stripe|checkout|webhook|entitlement|quota|refund|legal|privacy|terms|support|gtm|demo|storyboard|copy|screenshots|artifact|package|upload|reviewer|claim|notice)\b/.test(normalizedValue)
  return hasReleaseContext && hasChannelOrRuntimeContext && hasLaunchArtifactGroupContext(value, requirement.group) && hasLaunchArtifactRequirementContext(value, requirement.id)
}

function normalizeLaunchArtifactEvidenceSemanticText(value: string): string {
  let decodedValue = value
  try {
    decodedValue = decodeURIComponent(value)
  } catch {
    decodedValue = value
  }
  return decodedValue
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function launchArtifactEvidenceLinkMatchesRequirement(
  evidenceLink: string,
  requirement: AstraMacroLaunchArtifactRequirement,
): boolean {
  const normalizedLink = normalizeLaunchArtifactEvidenceSemanticText(evidenceLink)
  return hasLaunchArtifactGroupContext(normalizedLink, requirement.group)
    && hasLaunchArtifactRequirementContext(normalizedLink, requirement.id)
}

function isStableVersionReference(value: string): boolean {
  const normalizedValue = digestOrVersionIdentity(value)
  if (hasWeakEvidenceKeyword(normalizedValue) || isPlaceholderEvidenceReference(normalizedValue)) return false

  const compactValue = normalizedValue.replace(/[^a-z0-9]/g, "")
  if (!/\d/.test(compactValue) || /^0+$/.test(compactValue) || /^([a-z0-9])\1+$/.test(compactValue)) return false
  if (/^v?\d+\.\d+\.\d+(?:[-+][a-z0-9.-]+)?$/i.test(normalizedValue)) return true
  if (/^[1-9]\d{5,}$/.test(normalizedValue)) return true
  if (/^20\d{2}-\d{2}-\d{2}$/.test(normalizedValue)) return includesIsoDate(normalizedValue)
  return /^[a-z][a-z0-9]*(?:[-_.][a-z0-9]+)+$/i.test(normalizedValue)
}

function isWeakDigestOrVersionReference(value: string): boolean {
  return isWeakDigestReference(value) && !isStableVersionReference(value)
}

function isDigestOrChecksumReference(value: string): boolean {
  return /^(?:sha(?:256|384|512)?|checksum|digest)[:=/ -]+/i.test(value.trim())
}

function isSemverOnlyReference(value: string): boolean {
  return /^v?\d+\.\d+\.\d+(?:[-+][a-z0-9.-]+)?$/i.test(digestOrVersionIdentity(value))
}

function isDateOnlyIdentityReference(value: string): boolean {
  const identityValue = digestOrVersionIdentity(value)
  return /^20\d{2}-\d{2}-\d{2}$/.test(identityValue) && includesIsoDate(identityValue)
}

function isCiIdentityReference(value: string): boolean {
  const identityValue = digestOrVersionIdentity(value)
  if (isWeakDigestOrVersionReference(value) || isSemverOnlyReference(value) || isDateOnlyIdentityReference(value)) return false
  return /^[1-9]\d{5,}$/.test(identityValue)
    || /^[a-z][a-z0-9]*(?:[-_:][a-z0-9]+)+$/i.test(identityValue) && /\d/.test(identityValue)
}

function currentUtcDateStart(): number {
  const now = new Date()
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
}

function includesIsoDate(value: string): boolean {
  const matches = [...value.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)]
  if (matches.length === 0) return false

  const today = currentUtcDateStart()
  return matches.every((match) => {
    const [, yearText, monthText, dayText] = match
    const year = Number(yearText)
    const month = Number(monthText)
    const day = Number(dayText)
    const timestamp = Date.UTC(year, month - 1, day)
    const date = new Date(timestamp)

    return date.getUTCFullYear() === year
      && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day
      && timestamp <= today
  })
}

function isExactIsoDate(value: string): boolean {
  return /^20\d{2}-\d{2}-\d{2}$/.test(value) && includesIsoDate(value)
}

function hasOwnerIdentityWithIsoDate(value: string): boolean {
  if (value.trim() !== value || !includesIsoDate(value) || isWeakContextEvidenceReference(value)) return false
  const ownerText = value
    .replace(/\b20\d{2}-\d{2}-\d{2}\b/g, " ")
    .replace(/[—–:|/(),._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  const ownerIdentity = ownerText.toLowerCase()
  if (/^(?:owner|release owner|qa owner|tester|metrics owner)$/.test(ownerIdentity)) return false
  return /[a-z][a-z0-9@.-]{1,}/i.test(ownerText)
}

function isSpecificReleaseApproverIdentity(value: string): boolean {
  const normalizedValue = value.trim()
  if (normalizedValue !== value || isPlaceholderIdentityReference(value)) return false
  if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalizedValue)) return true
  const identityTokens = normalizedValue
    .replace(/[—–:|/(),._-]+/g, " ")
    .split(/\s+/)
    .filter((token) => /[a-z0-9]/i.test(token))
  return identityTokens.length >= 2 && identityTokens.join("").length >= 6
}

function normalizeReleaseApprovalRecordReference(value: string): string {
  let decodedValue = value
  try {
    decodedValue = decodeURIComponent(value)
  } catch {
    decodedValue = value
  }
  return decodedValue
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function isSpecificReleaseApprovalRecordReference(value: string): boolean {
  const normalizedValue = normalizeReleaseApprovalRecordReference(value)
  if (/\bevidence note\b/.test(normalizedValue)) return false
  const namesApproval = /\b(?:approval|approved|approver|signoff|signed|decision)\b/.test(normalizedValue)
  const namesOwnerOrRelease = /\b(?:owner|release|approver|approval)\b/.test(normalizedValue)
  return namesApproval && namesOwnerOrRelease
}

function manualQaRowContextMatches(value: string, section: number, qaRow: string): boolean {
  const normalizedValue = value.toLowerCase()
  const normalizedRow = qaRow.toLowerCase()
  switch (section) {
    case 6:
      return /\b(?:source|library|asset|delete|export|pdf|epub|subtitle|video|theme|return)\b/.test(normalizedValue)
    case 7:
      return /\b(?:personalization|profile|privacy|memory|excluded|options|review|fallback)\b/.test(normalizedValue)
    case 13:
      return /\b(?:copy|onboarding|popup|deep read|library|review|error|boundary|store|landing)\b/.test(normalizedValue)
    case 14:
      return /\b(?:support|help|status|incident|owner|limitations|report)\b/.test(normalizedValue)
    case 24:
      return /\b(?:ai|provider|fixture|scoring|sample|triage|trend|decision|quality)\b/.test(normalizedValue)
    case 32:
      return /\b(?:accessibility|keyboard|screen reader|voiceover|nvda|jaws|contrast|scaled text|reduced motion|mouse)\b/.test(normalizedValue)
    default:
      return normalizedRow.length > 0 && normalizedRow.split(/[^a-z0-9]+/).filter((part) => part.length >= 5).some((part) => normalizedValue.includes(part))
  }
}

function normalizeManualQaEvidenceSemanticText(value: string): string {
  let decodedValue = value
  try {
    decodedValue = decodeURIComponent(value)
  } catch {
    decodedValue = value
  }
  return decodedValue
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function manualQaEvidenceLinkMatchesRow(evidenceLink: string, section: number, qaRow: string): boolean {
  const normalizedLink = normalizeManualQaEvidenceSemanticText(evidenceLink)
  const normalizedRow = normalizeManualQaEvidenceSemanticText(qaRow)
  return normalizedLink.includes(`section ${section}`) && normalizedRow.length > 0 && normalizedLink.includes(normalizedRow)
}

function isSpecificManualQaEnvironment(value: string, section: number, qaRow: string): boolean {
  const normalizedValue = value.toLowerCase()
  const hasBrowser = /\b(?:chrome|chromium|firefox|safari|edge)\b/.test(normalizedValue)
  const hasOs = /\b(?:macos|windows|linux|ubuntu|android|ios)\b/.test(normalizedValue)
  return hasBrowser
    && hasOs
    && /\b(?:build|extension|relay|api|web app|candidate|rc)\b/.test(normalizedValue)
    && manualQaRowContextMatches(value, section, qaRow)
}

function isSuccessfulCiConclusion(value: string | undefined): boolean {
  return value === "success"
}

function isCommitShaLike(value: string): boolean {
  return /^[a-f0-9]{7,40}$/i.test(value) && !/^0+$/.test(value)
}

function ciUrl(value: string): URL | null {
  try {
    return isUrlReference(value) ? new URL(value) : null
  } catch {
    return null
  }
}

function ciPathSegments(url: URL): string[] {
  try {
    return decodeURIComponent(url.pathname).split("/").filter(Boolean)
  } catch {
    return []
  }
}

function isCiRunUrlReference(value: string): boolean {
  const url = ciUrl(value)
  if (!url) return false
  const pathSegments = ciPathSegments(url)
  return url.hostname.toLowerCase() === "github.com"
    && pathSegments.length === 5
    && pathSegments[2] === "actions"
    && pathSegments[3] === "runs"
    && /^[1-9]\d+$/.test(pathSegments[4] ?? "")
}

function isCiArtifactUrlReference(value: string): boolean {
  const url = ciUrl(value)
  if (!url) return false
  const pathSegments = ciPathSegments(url)
  return url.hostname.toLowerCase() === "github.com"
    && pathSegments.length === 7
    && pathSegments[2] === "actions"
    && pathSegments[3] === "runs"
    && /^[1-9]\d+$/.test(pathSegments[4] ?? "")
    && pathSegments[5] === "artifacts"
    && /^[1-9]\d+$/.test(pathSegments[6] ?? "")
}

interface CiRunUrlParts {
  repo: string
  runId: string
}

interface CiArtifactUrlParts {
  repo: string
  runId?: string
  artifactId: string
}

const ASTRA_CI_GITHUB_REPOSITORIES = new Set(["astra-release/astra", "raydocs/astra"])

function isAllowedAstraCiRepository(repo: string | undefined): boolean {
  return repo !== undefined && ASTRA_CI_GITHUB_REPOSITORIES.has(repo.toLowerCase())
}

function ciRunUrlParts(value: string): CiRunUrlParts | null {
  if (!isCiRunUrlReference(value)) return null
  const url = ciUrl(value)
  if (!url) return null
  const pathSegments = ciPathSegments(url)
  return { repo: `${pathSegments[0]?.toLowerCase()}/${pathSegments[1]?.toLowerCase()}`, runId: pathSegments[4] ?? "" }
}

function ciArtifactUrlParts(value: string): CiArtifactUrlParts | null {
  if (!isCiArtifactUrlReference(value)) return null
  const url = ciUrl(value)
  if (!url) return null
  const pathSegments = ciPathSegments(url)
  const repo = `${pathSegments[0]?.toLowerCase()}/${pathSegments[1]?.toLowerCase()}`
  return { repo, runId: pathSegments[4], artifactId: pathSegments[6] ?? "" }
}

function ciIdentityMatchesUrlSegment(identity: string, urlSegment: string | undefined): boolean {
  return urlSegment !== undefined && digestOrVersionIdentity(identity) === urlSegment.toLowerCase()
}

function isCiArtifactManifestReference(value: string, artifactName: string): boolean {
  if (!isEvidenceLikeReference(value)) return false
  const normalizedValue = value.toLowerCase()
  return normalizedValue.includes(artifactName.toLowerCase())
    && /(?:^|[/-])manifest\.json(?:$|[?#])/.test(normalizedValue)
}

function includesRequiredEvidenceTerms(value: string, item: AstraMacroOperationalEvidenceItem): boolean {
  const normalizedValue = value.toLowerCase()
  const requiredTerms = item.requiredBeforeStrongerClaim
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9/.-]+/)
    .filter((term) => term.length >= 6)
  const uniqueRequiredTerms = Array.from(new Set(requiredTerms))
  return uniqueRequiredTerms.filter((term) => normalizedValue.includes(term)).length >= 3
}

function isNegatedCoverageEntry(value: string): boolean {
  return /\b(?:did\s+not\s+run|not[-\s]?run|not\s+covered|missing|skipped?|failed|failure|without)\b/i.test(value)
}

function includesCoverageToken(coverage: readonly string[], token: string): boolean {
  const normalizedToken = token.toLowerCase()
  return coverage.some((entry) => {
    const normalizedEntry = entry.toLowerCase()
    return normalizedEntry.includes(normalizedToken) && !isNegatedCoverageEntry(normalizedEntry)
  })
}

export function evaluateAstraMacroCiArtifactPacket(
  evidence: readonly AstraMacroCiArtifactPacketEvidence[],
): AstraMacroCiArtifactPacketDecision {
  const findings: AstraMacroCiArtifactPacketFinding[] = []
  const evidenceByField = new Map<AstraMacroCiArtifactEvidenceField, AstraMacroCiArtifactPacketEvidence>()
  const expectedEvidenceFields = new Set(ASTRA_MACRO_CI_ARTIFACT_REQUIREMENTS.map((requirement) => requirement.evidenceField))
  const seenArtifactIds = new Map<string, AstraMacroCiArtifactEvidenceField>()
  const seenArtifactDigests = new Map<string, AstraMacroCiArtifactEvidenceField>()
  const seenArtifactManifestPaths = new Map<string, AstraMacroCiArtifactEvidenceField>()
  const seenArtifactUrls = new Map<string, AstraMacroCiArtifactEvidenceField>()

  for (const item of evidence) {
    const normalizedEvidenceField = item.evidenceField.trim()
    const evidenceFieldIdentity = normalizedEvidenceField.toLowerCase()
    const canonicalEvidenceField = ASTRA_MACRO_CI_ARTIFACT_REQUIREMENTS.find(
      (requirement) => requirement.evidenceField.toLowerCase() === evidenceFieldIdentity,
    )?.evidenceField
    if (normalizedEvidenceField !== item.evidenceField || (canonicalEvidenceField !== undefined && canonicalEvidenceField !== item.evidenceField)) {
      findings.push({
        evidenceField: item.evidenceField,
        message: `${item.evidenceField} must use canonical CI artifact evidence field casing without surrounding whitespace.`,
        nextStep: "Use ciQualityArtifactsAttached or ciLiveBrowserArtifactsAttached exactly as defined.",
      })
    }
    if (canonicalEvidenceField === undefined || !expectedEvidenceFields.has(canonicalEvidenceField)) {
      findings.push({
        evidenceField: item.evidenceField,
        message: `${item.evidenceField} is not a tracked final CI artifact evidence field.`,
        nextStep: "Use ciQualityArtifactsAttached or ciLiveBrowserArtifactsAttached.",
      })
      continue
    }
    if (evidenceByField.has(canonicalEvidenceField)) {
      findings.push({
        evidenceField: item.evidenceField,
        message: `${item.evidenceField} has duplicate CI artifact evidence rows.`,
        nextStep: "Keep one CI artifact evidence row per final evidence field.",
      })
      continue
    }

    const artifactId = item.artifactId.trim()
    const artifactIdIdentity = digestOrVersionIdentity(item.artifactId)
    if (artifactId.length > 0) {
      const existingEvidenceField = seenArtifactIds.get(artifactIdIdentity)
      if (existingEvidenceField && existingEvidenceField !== canonicalEvidenceField) {
        findings.push({
          evidenceField: canonicalEvidenceField,
          message: `${canonicalEvidenceField} reuses CI artifact id ${artifactId}.`,
          nextStep: "Attach distinct uploaded artifact ids for quality-gate-results and live-bench-results.",
        })
      }
      seenArtifactIds.set(artifactIdIdentity, canonicalEvidenceField)
    }

    const artifactDigest = item.artifactDigest.trim()
    const artifactDigestIdentity = digestOrVersionIdentity(item.artifactDigest)
    if (artifactDigest.length > 0) {
      const existingEvidenceField = seenArtifactDigests.get(artifactDigestIdentity)
      if (existingEvidenceField && existingEvidenceField !== canonicalEvidenceField) {
        findings.push({
          evidenceField: canonicalEvidenceField,
          message: `${canonicalEvidenceField} reuses CI artifact digest ${artifactDigest}.`,
          nextStep: "Attach distinct checksum values for quality-gate-results and live-bench-results uploaded artifacts.",
        })
      }
      seenArtifactDigests.set(artifactDigestIdentity, canonicalEvidenceField)
    }

    const artifactManifestPath = item.artifactManifestPath.trim()
    const artifactManifestPathIdentity = evidenceReferenceDuplicateIdentity(item.artifactManifestPath)
    if (artifactManifestPath.length > 0) {
      const existingEvidenceField = seenArtifactManifestPaths.get(artifactManifestPathIdentity)
      if (existingEvidenceField && existingEvidenceField !== canonicalEvidenceField) {
        findings.push({
          evidenceField: canonicalEvidenceField,
          message: `${canonicalEvidenceField} reuses CI artifact manifest path ${artifactManifestPath}.`,
          nextStep: "Attach distinct manifest paths for quality-gate-results and live-bench-results uploaded artifacts.",
        })
      }
      seenArtifactManifestPaths.set(artifactManifestPathIdentity, canonicalEvidenceField)
    }

    const artifactUrl = item.artifactUrl.trim()
    const artifactUrlIdentity = evidenceReferenceDuplicateIdentity(item.artifactUrl)
    if (artifactUrl.length > 0) {
      const existingEvidenceField = seenArtifactUrls.get(artifactUrlIdentity)
      if (existingEvidenceField && existingEvidenceField !== canonicalEvidenceField) {
        findings.push({
          evidenceField: canonicalEvidenceField,
          message: `${canonicalEvidenceField} reuses CI artifact URL ${artifactUrl}.`,
          nextStep: "Attach distinct downloadable artifact URLs for quality-gate-results and live-bench-results.",
        })
      }
      seenArtifactUrls.set(artifactUrlIdentity, canonicalEvidenceField)
    }

    evidenceByField.set(canonicalEvidenceField, { ...item, evidenceField: canonicalEvidenceField })
  }

  const ciCommitShas = Array.from(evidenceByField.values())
    .map((item) => item.commitSha.trim().toLowerCase())
    .filter((commitSha) => commitSha.length > 0)
  if (new Set(ciCommitShas).size > 1) {
    findings.push({
      evidenceField: "ciQualityArtifactsAttached/ciLiveBrowserArtifactsAttached",
      message: "CI quality and live-browser artifacts must target the same commit/SHA.",
      nextStep: "Attach quality-gate-results and live-bench-results artifacts from the same target commit/worktree or release candidate.",
    })
  }

  const ciRepositoryIdentities = Array.from(evidenceByField.values())
    .flatMap((item) => [ciRunUrlParts(item.runUrl)?.repo, ciArtifactUrlParts(item.artifactUrl)?.repo])
    .filter((repo): repo is string => typeof repo === "string" && repo.length > 0)
  if (new Set(ciRepositoryIdentities).size > 1) {
    findings.push({
      evidenceField: "ciQualityArtifactsAttached/ciLiveBrowserArtifactsAttached",
      message: "CI quality and live-browser artifact URLs must point to the same GitHub repository.",
      nextStep: "Attach quality-gate-results and live-bench-results artifacts from the same target GitHub repository.",
    })
  }

  for (const requirement of ASTRA_MACRO_CI_ARTIFACT_REQUIREMENTS) {
    const item = evidenceByField.get(requirement.evidenceField)
    if (!item) {
      findings.push({
        evidenceField: requirement.evidenceField,
        message: `${requirement.label} evidence is missing.`,
        nextStep: requirement.requiredEvidence,
      })
      continue
    }

    if (item.artifactName.trim() !== requirement.artifactName) {
      findings.push({
        evidenceField: requirement.evidenceField,
        message: `${requirement.label} must name the ${requirement.artifactName} artifact.`,
        nextStep: requirement.requiredEvidence,
      })
    }
    if (isBlank(item.workflowName)) {
      findings.push({
        evidenceField: requirement.evidenceField,
        message: `${requirement.label} is missing the CI workflow name.`,
        nextStep: "Record the CI workflow name from the target run.",
      })
    } else if (item.workflowName.trim() !== item.workflowName || isWeakContextEvidenceReference(item.workflowName)) {
      findings.push({
        evidenceField: requirement.evidenceField,
        message: `${requirement.label} CI workflow name is placeholder evidence or not canonical.`,
        nextStep: "Record the real CI workflow name from the target run without surrounding whitespace.",
      })
    } else if (!item.workflowName.toLowerCase().includes(requirement.workflowName)) {
      findings.push({
        evidenceField: requirement.evidenceField,
        message: `${requirement.label} must identify the ${requirement.workflowName} workflow/job.`,
        nextStep: "Record the CI workflow/job name from the target run.",
      })
    }
    if (isBlank(item.runId)) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} is missing the CI run id.`, nextStep: "Record the immutable CI run id for the target run." })
    } else if (item.runId.trim() !== item.runId) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} CI run id must be canonical without surrounding whitespace.`, nextStep: "Record the real immutable CI run id for the target run without surrounding whitespace." })
    } else if (isPlaceholderEvidenceReference(item.runId)) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} CI run id is placeholder evidence.`, nextStep: "Record the real immutable CI run id for the target run." })
    } else if (!isCiIdentityReference(item.runId)) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} CI run id must be an immutable CI run identity, not a generic version or date.`, nextStep: "Record the real immutable CI run id for the target run." })
    }
    if (isBlank(item.jobName)) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} is missing the CI job name.`, nextStep: "Record the CI job name that produced the artifact." })
    } else if (item.jobName.trim() !== item.jobName) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} CI job name must be canonical without surrounding whitespace.`, nextStep: "Record the real CI job name that produced the artifact without surrounding whitespace." })
    } else if (isWeakContextEvidenceReference(item.jobName)) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} CI job name is placeholder evidence.`, nextStep: "Record the real CI job name that produced the artifact." })
    }
    if (!isSuccessfulCiConclusion(item.workflowConclusion)) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} workflow conclusion must be success.`, nextStep: "Attach artifact evidence only from a completed successful CI workflow run, not an always-uploaded artifact from a failed run." })
    }
    if (!isSuccessfulCiConclusion(item.jobConclusion)) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} job conclusion must be success.`, nextStep: "Attach artifact evidence only from a successful CI job that produced the required artifact." })
    }
    if (isBlank(item.artifactId)) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} is missing the artifact id.`, nextStep: "Record the uploaded artifact id from the target CI run." })
    } else if (item.artifactId.trim() !== item.artifactId) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} artifact id must be canonical without surrounding whitespace.`, nextStep: "Record the real uploaded artifact id from the target CI run without surrounding whitespace." })
    } else if (isPlaceholderEvidenceReference(item.artifactId)) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} artifact id is placeholder evidence.`, nextStep: "Record the real uploaded artifact id from the target CI run." })
    } else if (!isCiIdentityReference(item.artifactId)) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} artifact id must be an immutable uploaded artifact identity, not a generic version or date.`, nextStep: "Record the real uploaded artifact id from the target CI run." })
    }
    if (isBlank(item.artifactDigest)) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} is missing the artifact digest/checksum.`, nextStep: "Record the artifact digest or checksum so the downloaded artifact can be verified." })
    } else if (item.artifactDigest.trim() !== item.artifactDigest) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} artifact digest/checksum must be canonical without surrounding whitespace.`, nextStep: "Record the real artifact digest or checksum without surrounding whitespace so the downloaded artifact can be verified." })
    } else if (isPlaceholderEvidenceReference(item.artifactDigest)) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} artifact digest/checksum is placeholder evidence.`, nextStep: "Record the real artifact digest or checksum so the downloaded artifact can be verified." })
    } else if (!isCanonicalDigestReference(item.artifactDigest)) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} artifact digest/checksum must be a canonical sha/checksum/digest-prefixed hex value.`, nextStep: "Record a canonical sha/checksum/digest-prefixed hex digest so the downloaded artifact can be verified." })
    }
    if (isBlank(item.artifactManifestPath)) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} is missing the artifact manifest path.`, nextStep: "Attach or point to the manifest inside the uploaded artifact that lists command/lane results." })
    } else if (isPlaceholderEvidenceReference(item.artifactManifestPath)) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} artifact manifest path is placeholder evidence.`, nextStep: "Attach the real artifact manifest path for the target CI artifact." })
    } else if (!isCiArtifactManifestReference(item.artifactManifestPath, requirement.artifactName)) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} artifact manifest path must point to a ${requirement.artifactName} manifest.json artifact.`, nextStep: "Attach a URL or repo path under docs/, data/, artifacts/, test-results/, or playwright-report/ that names the uploaded artifact manifest." })
    }
    const runUrlParts = ciRunUrlParts(item.runUrl)
    const artifactUrlParts = ciArtifactUrlParts(item.artifactUrl)
    if (isBlank(item.runUrl)) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} is missing the CI run URL.`, nextStep: "Attach the CI run URL for the target commit/SHA." })
    } else if (isPlaceholderEvidenceReference(item.runUrl)) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} CI run URL is placeholder evidence.`, nextStep: "Attach the real CI run URL for the target commit/SHA." })
    } else if (!isCiRunUrlReference(item.runUrl)) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} CI run URL must be a GitHub Actions run URL.`, nextStep: "Attach the https://github.com/<owner>/<repo>/actions/runs/<run-id> URL for the target commit/SHA." })
    } else if (!ciIdentityMatchesUrlSegment(item.runId, runUrlParts?.runId)) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} CI run id must match the GitHub Actions run URL.`, nextStep: "Use the immutable run id from the same https://github.com/<owner>/<repo>/actions/runs/<run-id> URL." })
    } else if (!isAllowedAstraCiRepository(runUrlParts?.repo)) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} CI run URL must point to an allowed Astra GitHub repository.`, nextStep: "Attach the GitHub Actions run URL from astra-release/astra or raydocs/Astra for the target commit/SHA." })
    }
    if (isBlank(item.artifactUrl)) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} is missing the downloadable artifact URL.`, nextStep: "Attach the downloadable artifact URL, not only local terminal output." })
    } else if (isPlaceholderEvidenceReference(item.artifactUrl)) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} downloadable artifact URL is placeholder evidence.`, nextStep: "Attach the real downloadable artifact URL, not sample or placeholder evidence." })
    } else if (!isCiArtifactUrlReference(item.artifactUrl)) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} downloadable artifact URL must be a GitHub Actions artifact URL.`, nextStep: "Attach the https://github.com/<owner>/<repo>/actions/.../artifacts/<artifact-id> URL, not only local terminal output." })
    } else {
      if (!ciIdentityMatchesUrlSegment(item.artifactId, artifactUrlParts?.artifactId)) {
        findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} artifact id must match the GitHub Actions artifact URL.`, nextStep: "Use the uploaded artifact id from the same https://github.com/<owner>/<repo>/actions/.../artifacts/<artifact-id> URL." })
      }
      if (runUrlParts && artifactUrlParts && runUrlParts.repo !== artifactUrlParts.repo) {
        findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} CI run URL and artifact URL must point to the same GitHub repository.`, nextStep: "Attach the run URL and artifact URL from the same target repository." })
      }
      if (artifactUrlParts?.runId !== undefined && !ciIdentityMatchesUrlSegment(item.runId, artifactUrlParts.runId)) {
        findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} CI run id must match the run segment in the artifact URL.`, nextStep: "Attach an artifact URL from the same GitHub Actions run as the recorded run id." })
      }
      if (!isAllowedAstraCiRepository(artifactUrlParts?.repo)) {
        findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} downloadable artifact URL must point to an allowed Astra GitHub repository.`, nextStep: "Attach the GitHub Actions artifact URL from astra-release/astra or raydocs/Astra for the target commit/SHA." })
      }
    }
    if (isBlank(item.commitSha)) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} is missing the target commit/SHA.`, nextStep: "Record the commit/SHA covered by the CI run." })
    } else if (isPlaceholderEvidenceReference(item.commitSha)) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} target commit/SHA is placeholder evidence.`, nextStep: "Record the exact commit/SHA covered by the CI run." })
    } else if (!isCommitShaLike(item.commitSha)) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} target commit/SHA must be a 7-40 character non-zero hex SHA.`, nextStep: "Record the exact git commit SHA covered by the CI run." })
    }
    if (isBlank(item.ownerDate)) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} is missing owner/date.`, nextStep: "Record who attached/reviewed the artifact and when." })
    } else if (!hasOwnerIdentityWithIsoDate(item.ownerDate)) {
      findings.push({ evidenceField: requirement.evidenceField, message: `${requirement.label} owner/date must identify a real owner and include a YYYY-MM-DD date.`, nextStep: "Record the real CI artifact owner and review date using YYYY-MM-DD." })
    }

    const missingCoverage = requirement.requiredCoverage.filter((token) => !includesCoverageToken(item.coverage, token))
    if (missingCoverage.length > 0) {
      findings.push({
        evidenceField: requirement.evidenceField,
        message: `${requirement.label} is missing required coverage: ${missingCoverage.join(", ")}.`,
        nextStep: requirement.requiredEvidence,
      })
    }
  }

  return { acceptable: findings.length === 0, findings }
}

export function evaluateAstraMacroManualQaEvidencePacket(
  rows: readonly AstraMacroManualQaEvidenceRow[],
): AstraMacroManualQaEvidenceDecision {
  const findings: AstraMacroManualQaFinding[] = []
  const allowedVerdicts = new Set<string>(["pass", "pass-with-downgrade", "fail", "not-run"])
  const expectedRowsByIdentity = new Map<string, { section: number; qaRow: string }>(
    ASTRA_MACRO_MANUAL_QA_REQUIREMENTS.flatMap((requirement) =>
      requirement.qaRows.map((qaRow) => [`${requirement.section}\u0000${qaRow.trim().toLowerCase()}`, { section: requirement.section, qaRow }] as const),
    ),
  )
  const rowsByKey = new Map<string, AstraMacroManualQaEvidenceRow>()
  const seenEvidenceLinks = new Map<string, string>()

  for (const row of rows) {
    const normalizedQaRow = row.qaRow.trim()
    const rowIdentity = `${row.section}\u0000${normalizedQaRow.toLowerCase()}`
    const canonicalRow = expectedRowsByIdentity.get(rowIdentity)
    if (normalizedQaRow !== row.qaRow || (canonicalRow !== undefined && canonicalRow.qaRow !== row.qaRow)) {
      findings.push({
        section: row.section,
        qaRow: row.qaRow,
        message: `Section ${row.section} / ${row.qaRow} must use canonical manual QA row text without surrounding whitespace.`,
        nextStep: "Use the exact section/row pair from ASTRA_MACRO_MANUAL_QA_REQUIREMENTS.",
      })
    }
    if (!canonicalRow) {
      findings.push({
        section: row.section,
        qaRow: row.qaRow,
        message: `Section ${row.section} / ${row.qaRow} is not a tracked manual QA row.`,
        nextStep: "Use a section/row pair from ASTRA_MACRO_MANUAL_QA_REQUIREMENTS.",
      })
      continue
    }
    const canonicalKey = `${canonicalRow.section}\u0000${canonicalRow.qaRow}`
    if (rowsByKey.has(canonicalKey)) {
      findings.push({
        section: row.section,
        qaRow: row.qaRow,
        message: `Section ${row.section} / ${row.qaRow} has duplicate manual QA evidence rows.`,
        nextStep: "Keep one manual QA evidence row per required section/row pair.",
      })
      continue
    }
    const evidenceLink = row.evidenceLink.trim()
    const evidenceLinkIdentity = evidenceReferenceDuplicateIdentity(row.evidenceLink)
    if (evidenceLink.length > 0 && manualQaEvidenceLinkMatchesRow(row.evidenceLink, canonicalRow.section, canonicalRow.qaRow)) {
      const existingRowKey = seenEvidenceLinks.get(evidenceLinkIdentity)
      if (existingRowKey && existingRowKey !== canonicalKey) {
        findings.push({
          section: row.section,
          qaRow: row.qaRow,
          message: `Section ${row.section} / ${row.qaRow} reuses manual QA evidence link ${evidenceLink}.`,
          nextStep: "Attach row-specific manual QA evidence so every checklist row can be audited independently.",
        })
      }
      seenEvidenceLinks.set(evidenceLinkIdentity, canonicalKey)
    }

    rowsByKey.set(canonicalKey, { ...row, section: canonicalRow.section, qaRow: canonicalRow.qaRow })
  }

  for (const requirement of ASTRA_MACRO_MANUAL_QA_REQUIREMENTS) {
    for (const qaRow of requirement.qaRows) {
      const row = rowsByKey.get(`${requirement.section}\u0000${qaRow}`)
      if (!row) {
        findings.push({
          section: requirement.section,
          qaRow,
          message: `Section ${requirement.section} / ${qaRow} manual QA row is missing.`,
          nextStep: "Add the required manual QA row with owner/date, environment, evidence link, and pass or pass-with-downgrade verdict.",
        })
        continue
      }

      if (!allowedVerdicts.has(row.verdict)) {
        findings.push({
          section: requirement.section,
          qaRow,
          message: `Section ${requirement.section} / ${qaRow} has unsupported verdict ${row.verdict}.`,
          nextStep: "Use pass, pass-with-downgrade, fail, or not-run.",
        })
        continue
      }

      if (row.verdict === "fail" || row.verdict === "not-run") {
        findings.push({
          section: requirement.section,
          qaRow,
          message: `Section ${requirement.section} / ${qaRow} is ${row.verdict}.`,
          nextStep: "Complete this manual QA walkthrough with a pass or pass-with-downgrade verdict before marking manualQaChecklistComplete true.",
        })
        continue
      }

      if (isBlank(row.ownerDate)) {
        findings.push({ section: requirement.section, qaRow, message: `Section ${requirement.section} / ${qaRow} is missing owner/date.`, nextStep: "Record owner/date for this manual QA row." })
      } else if (!hasOwnerIdentityWithIsoDate(row.ownerDate)) {
        findings.push({ section: requirement.section, qaRow, message: `Section ${requirement.section} / ${qaRow} owner/date must identify a real owner and include a YYYY-MM-DD date.`, nextStep: "Record a real QA owner/date using YYYY-MM-DD." })
      }
      if (isBlank(row.environment)) {
        findings.push({ section: requirement.section, qaRow, message: `Section ${requirement.section} / ${qaRow} is missing environment.`, nextStep: "Record browser, OS, build, and relevant relay/API environment." })
      } else if (row.environment.trim() !== row.environment) {
        findings.push({ section: requirement.section, qaRow, message: `Section ${requirement.section} / ${qaRow} environment must be canonical without surrounding whitespace.`, nextStep: "Record the real browser, OS, build, and relevant relay/API environment without surrounding whitespace." })
      } else if (isWeakContextEvidenceReference(row.environment) || !isSpecificManualQaEnvironment(row.environment, requirement.section, qaRow)) {
        findings.push({ section: requirement.section, qaRow, message: `Section ${requirement.section} / ${qaRow} environment must include real browser, OS, build/runtime, and row-specific QA context.`, nextStep: "Record the real browser, OS, build, and section/row-specific manual QA context." })
      }
      if (isBlank(row.evidenceLink)) {
        findings.push({ section: requirement.section, qaRow, message: `Section ${requirement.section} / ${qaRow} is missing evidence link.`, nextStep: "Attach screenshot, recording, run folder, log excerpt, or written QA note." })
      } else if (isPlaceholderEvidenceReference(row.evidenceLink)) {
        findings.push({ section: requirement.section, qaRow, message: `Section ${requirement.section} / ${qaRow} evidence link is placeholder evidence.`, nextStep: "Attach the real screenshot, recording, run folder, log excerpt, or written QA note." })
      } else if (!isEvidenceLikeReference(row.evidenceLink)) {
        findings.push({ section: requirement.section, qaRow, message: `Section ${requirement.section} / ${qaRow} evidence link must be a URL or repo artifact path.`, nextStep: "Attach a URL or repo path under docs/, data/, artifacts/, test-results/, or playwright-report/." })
      } else if (!manualQaEvidenceLinkMatchesRow(row.evidenceLink, requirement.section, qaRow)) {
        findings.push({ section: requirement.section, qaRow, message: `Section ${requirement.section} / ${qaRow} evidence link must identify Section ${requirement.section} and row-specific manual QA evidence.`, nextStep: "Attach evidence whose URL or repo artifact path names the manual QA section and exact checklist row." })
      }
    }
  }

  return { complete: findings.length === 0, findings }
}

export function evaluateAstraMacroReleaseApprovalPacket(
  evidence: AstraMacroReleaseApprovalPacketEvidence,
): AstraMacroReleaseApprovalPacketDecisionResult {
  const findings: AstraMacroReleaseApprovalPacketFinding[] = []

  if (isBlank(evidence.approver)) {
    findings.push({ message: "Release approval is missing approver.", nextStep: "Record the accountable owner or release approver." })
  } else if (evidence.approver.trim() !== evidence.approver) {
    findings.push({ message: "Release approval approver must be canonical without surrounding whitespace.", nextStep: "Record the accountable owner or release approver without surrounding whitespace." })
  } else if (isPlaceholderIdentityReference(evidence.approver)) {
    findings.push({ message: "Release approval approver is placeholder evidence.", nextStep: "Record the accountable owner or release approver." })
  } else if (!isSpecificReleaseApproverIdentity(evidence.approver)) {
    findings.push({ message: "Release approval approver must identify an accountable owner, not an ambiguous short label.", nextStep: "Record an email-like approver or a concrete multi-token owner identity." })
  }
  if (isBlank(evidence.approvalDate)) {
    findings.push({ message: "Release approval is missing approval date.", nextStep: "Record the approval date." })
  } else if (isWeakContextEvidenceReference(evidence.approvalDate) || !isExactIsoDate(evidence.approvalDate)) {
    findings.push({ message: "Release approval date must be an exact valid YYYY-MM-DD date.", nextStep: "Record the owner approval date using YYYY-MM-DD." })
  }
  if (isBlank(evidence.approvalRecordLink)) {
    findings.push({ message: "Release approval is missing an approval record link.", nextStep: "Attach the signed issue/comment/document that records approval." })
  } else if (isPlaceholderEvidenceReference(evidence.approvalRecordLink)) {
    findings.push({ message: "Release approval record link is placeholder evidence.", nextStep: "Attach the real signed issue/comment/document that records approval." })
  } else if (!isEvidenceLikeReference(evidence.approvalRecordLink)) {
    findings.push({ message: "Release approval record link must be a URL or repo artifact path.", nextStep: "Attach a URL or repo path under docs/, data/, artifacts/, test-results/, or playwright-report/." })
  } else if (!isSpecificReleaseApprovalRecordReference(evidence.approvalRecordLink)) {
    findings.push({ message: "Release approval record link must identify a signed owner/release approval record, not a generic evidence note.", nextStep: "Attach the signed issue/comment/document or owner approval packet that records the release decision." })
  }
  if (isBlank(evidence.targetCommitSha)) {
    findings.push({ message: "Release approval is missing target commit/SHA.", nextStep: "Record the exact commit/SHA being approved." })
  } else if (isPlaceholderEvidenceReference(evidence.targetCommitSha)) {
    findings.push({ message: "Release approval target commit/SHA is placeholder evidence.", nextStep: "Record the exact commit/SHA being approved." })
  } else if (!isCommitShaLike(evidence.targetCommitSha)) {
    findings.push({ message: "Release approval target commit/SHA must be a 7-40 character non-zero hex SHA.", nextStep: "Record the exact git commit SHA being approved." })
  }
  if (!["approved_with_downgrades", "approved_final", "rejected"].includes(evidence.decision)) {
    findings.push({ message: "Release approval decision must be approved_with_downgrades, approved_final, or rejected.", nextStep: "Use an explicit owner release decision enum value from the approval packet schema." })
  } else if (evidence.decision === "rejected") {
    findings.push({ message: "Release approval decision is rejected.", nextStep: "Do not mark ownerReleaseApprovalRecorded true until the owner approves this target commit/worktree." })
  }
  if (evidence.decision === "approved_final" && evidence.acknowledgesRemainingFinalBlockers) {
    findings.push({ message: "Release approval cannot be final while remaining final blockers are acknowledged.", nextStep: "Use approved_with_downgrades for RC/public-beta boundaries, or clear every final blocker before final approval." })
  }
  if (evidence.decision !== "approved_final" && !evidence.acknowledgesRemainingFinalBlockers) {
    findings.push({ message: "Release approval does not acknowledge remaining final blockers.", nextStep: "Record that the owner reviewed the current Complete: no gate and remaining blockers." })
  }
  if (!evidence.acknowledgesDowngradeCopy) {
    findings.push({ message: "Release approval does not acknowledge required downgrade copy.", nextStep: "Record that public/release copy must reuse the downgrade boundaries until stronger evidence is attached." })
  }

  const requiredReviewedArtifactIdentities = new Map(
    ASTRA_MACRO_RELEASE_APPROVAL_REQUIREMENT.requiredReviewedArtifacts.map((artifact) => [evidenceReferenceDuplicateIdentity(artifact), artifact]),
  )
  const reviewedArtifactIdentities = new Set<string>()
  const approvalRecordIdentity = evidenceReferenceDuplicateIdentity(evidence.approvalRecordLink)
  for (const artifact of evidence.reviewedArtifacts) {
    const artifactIdentity = evidenceReferenceDuplicateIdentity(artifact)
    const canonicalArtifact = requiredReviewedArtifactIdentities.get(artifactIdentity)
    if (artifact.trim() !== artifact || (canonicalArtifact !== undefined && canonicalArtifact !== artifact)) {
      findings.push({
        message: `Release approval reviewed artifact ${artifact} must use canonical artifact path without surrounding whitespace.`,
        nextStep: ASTRA_MACRO_RELEASE_APPROVAL_REQUIREMENT.requiredEvidence,
      })
    }
    if (canonicalArtifact === undefined) {
      findings.push({
        message: `Release approval reviewed artifact ${artifact} is not one of the required Gate 4/RC/final evidence artifacts.`,
        nextStep: ASTRA_MACRO_RELEASE_APPROVAL_REQUIREMENT.requiredEvidence,
      })
    }
    if (reviewedArtifactIdentities.has(artifactIdentity)) {
      findings.push({
        message: `Release approval reviewed artifact ${artifact} is duplicated.`,
        nextStep: ASTRA_MACRO_RELEASE_APPROVAL_REQUIREMENT.requiredEvidence,
      })
    }
    if (
      isEvidenceLikeReference(evidence.approvalRecordLink)
      && approvalRecordIdentity === artifactIdentity
    ) {
      findings.push({
        message: `Release approval record link reuses reviewed artifact ${artifact}.`,
        nextStep: "Attach a distinct signed approval issue/comment/document separate from the artifacts being reviewed.",
      })
    }
    reviewedArtifactIdentities.add(artifactIdentity)
  }

  const missingReviewedArtifacts = ASTRA_MACRO_RELEASE_APPROVAL_REQUIREMENT.requiredReviewedArtifacts.filter(
    (artifact) => !reviewedArtifactIdentities.has(evidenceReferenceDuplicateIdentity(artifact)),
  )
  if (missingReviewedArtifacts.length > 0) {
    findings.push({
      message: `Release approval is missing reviewed artifacts: ${missingReviewedArtifacts.join(", ")}.`,
      nextStep: ASTRA_MACRO_RELEASE_APPROVAL_REQUIREMENT.requiredEvidence,
    })
  }

  return { acceptable: findings.length === 0, findings }
}

export function evaluateAstraMacroLaunchArtifactPacket(
  evidence: readonly AstraMacroLaunchArtifactPacketEvidence[],
): AstraMacroLaunchArtifactPacketDecision {
  const findings: AstraMacroLaunchArtifactPacketFinding[] = []
  const evidenceByRequirement = new Map<AstraMacroLaunchArtifactRequirementId, AstraMacroLaunchArtifactPacketEvidence>()
  const requirementById = new Map(ASTRA_MACRO_LAUNCH_ARTIFACT_REQUIREMENTS.map((requirement) => [requirement.id.toLowerCase(), requirement]))
  const seenArtifactIds = new Map<string, AstraMacroLaunchArtifactRequirementId>()
  const seenArtifactDigestOrVersions = new Map<string, AstraMacroLaunchArtifactRequirementId>()
  const seenEvidenceLinks = new Map<string, AstraMacroLaunchArtifactRequirementId>()

  for (const item of evidence) {
    const normalizedRequirementId = item.requirementId.trim()
    const requirementIdIdentity = normalizedRequirementId.toLowerCase()
    const requirement = requirementById.get(requirementIdIdentity)
    if (normalizedRequirementId !== item.requirementId || (requirement !== undefined && requirement.id !== item.requirementId)) {
      findings.push({
        requirementId: item.requirementId,
        group: requirement?.group ?? "store_submission",
        message: `${item.requirementId} must use canonical launch artifact requirement id casing without surrounding whitespace.`,
        nextStep: "Use the exact requirement id from ASTRA_MACRO_LAUNCH_ARTIFACT_REQUIREMENTS.",
      })
    }
    if (!requirement) {
      findings.push({
        requirementId: item.requirementId,
        group: "store_submission",
        message: `${item.requirementId} is not a tracked billing/legal/store/GTM launch artifact requirement.`,
        nextStep: "Use a requirement id from ASTRA_MACRO_LAUNCH_ARTIFACT_REQUIREMENTS.",
      })
      continue
    }
    if (evidenceByRequirement.has(requirement.id)) {
      findings.push({
        requirementId: item.requirementId,
        group: requirement.group,
        message: `${item.requirementId} has duplicate launch artifact evidence rows.`,
        nextStep: "Keep one launch artifact evidence row per billing/legal/store/GTM requirement.",
      })
      continue
    }

    const artifactId = item.artifactId.trim()
    const artifactIdIdentity = launchArtifactIdDuplicateIdentity(item.artifactId)
    if (artifactId.length > 0) {
      const existingRequirementId = seenArtifactIds.get(artifactIdIdentity)
      if (existingRequirementId && existingRequirementId !== requirement.id) {
        findings.push({
          requirementId: requirement.id,
          group: requirement.group,
          message: `${requirement.id} reuses launch artifact id ${artifactId}.`,
          nextStep: "Attach one unique external artifact id, run id, upload id, approval record id, or media id per launch requirement.",
        })
      }
      seenArtifactIds.set(artifactIdIdentity, requirement.id)
    }

    const artifactDigestOrVersion = item.artifactDigestOrVersion.trim()
    const artifactDigestOrVersionIdentity = digestOrVersionIdentity(item.artifactDigestOrVersion)
    if (artifactDigestOrVersion.length > 0) {
      const existingRequirementId = seenArtifactDigestOrVersions.get(artifactDigestOrVersionIdentity)
      if (existingRequirementId && existingRequirementId !== requirement.id) {
        findings.push({
          requirementId: requirement.id,
          group: requirement.group,
          message: `${requirement.id} reuses launch artifact digest/version ${artifactDigestOrVersion}.`,
          nextStep: "Attach distinct digest/checksum or version values for independent billing, legal, store, and GTM launch artifacts.",
        })
      }
      seenArtifactDigestOrVersions.set(artifactDigestOrVersionIdentity, requirement.id)
    }

    const evidenceLink = item.evidenceLink.trim()
    const evidenceLinkIdentity = evidenceReferenceDuplicateIdentity(item.evidenceLink)
    if (evidenceLink.length > 0 && launchArtifactEvidenceLinkMatchesRequirement(item.evidenceLink, requirement)) {
      const existingRequirementId = seenEvidenceLinks.get(evidenceLinkIdentity)
      if (existingRequirementId && existingRequirementId !== requirement.id) {
        findings.push({
          requirementId: requirement.id,
          group: requirement.group,
          message: `${requirement.id} reuses launch artifact evidence link ${evidenceLink}.`,
          nextStep: "Attach requirement-specific billing, legal, store, or GTM evidence so every launch claim can be audited independently.",
        })
      }
      seenEvidenceLinks.set(evidenceLinkIdentity, requirement.id)
    }

    evidenceByRequirement.set(requirement.id, { ...item, requirementId: requirement.id })
  }

  for (const requirement of ASTRA_MACRO_LAUNCH_ARTIFACT_REQUIREMENTS) {
    const item = evidenceByRequirement.get(requirement.id)
    if (!item) {
      findings.push({
        requirementId: requirement.id,
        group: requirement.group,
        message: `${requirement.label} evidence is missing.`,
        nextStep: requirement.requiredEvidence,
      })
      continue
    }

    if (item.claimBoundary !== requirement.group) {
      findings.push({
        requirementId: requirement.id,
        group: requirement.group,
        message: `${requirement.label} claim boundary is ${item.claimBoundary}, expected ${requirement.group}.`,
        nextStep: "Bind each launch artifact row to its billing, legal/trust, store-submission, or GTM evidence boundary.",
      })
    }
    if (isBlank(item.artifactType)) {
      findings.push({
        requirementId: requirement.id,
        group: requirement.group,
        message: `${requirement.label} is missing artifact type.`,
        nextStep: "Record whether the proof is a billing provider record, legal approval, store-console record, signed build artifact, screenshot set, or GTM media artifact.",
      })
    } else if (item.artifactType.trim() !== item.artifactType) {
      findings.push({
        requirementId: requirement.id,
        group: requirement.group,
        message: `${requirement.label} artifact type must be canonical without surrounding whitespace.`,
        nextStep: "Record the real artifact type without surrounding whitespace.",
      })
    } else if (isWeakContextEvidenceReference(item.artifactType)) {
      findings.push({
        requirementId: requirement.id,
        group: requirement.group,
        message: `${requirement.label} artifact type is placeholder evidence.`,
        nextStep: requirement.requiredEvidence,
      })
    } else if (!isSpecificLaunchArtifactType(item.artifactType, requirement)) {
      findings.push({
        requirementId: requirement.id,
        group: requirement.group,
        message: `${requirement.label} artifact type must identify a concrete ${requirement.group} launch artifact surface for ${requirement.id}.`,
        nextStep: requirement.requiredEvidence,
      })
    }
    if (isBlank(item.artifactId)) {
      findings.push({
        requirementId: requirement.id,
        group: requirement.group,
        message: `${requirement.label} is missing artifact id.`,
        nextStep: "Record the external artifact id, run id, upload id, approval record id, or media id for this launch proof.",
      })
    } else if (item.artifactId.trim() !== item.artifactId) {
      findings.push({
        requirementId: requirement.id,
        group: requirement.group,
        message: `${requirement.label} artifact id must be canonical without surrounding whitespace.`,
        nextStep: "Record the real external artifact id, run id, upload id, approval record id, or media id without surrounding whitespace.",
      })
    } else if (isPlaceholderEvidenceReference(item.artifactId)) {
      findings.push({
        requirementId: requirement.id,
        group: requirement.group,
        message: `${requirement.label} artifact id is placeholder evidence.`,
        nextStep: requirement.requiredEvidence,
      })
    } else if (isWeakDigestOrVersionReference(item.artifactId)) {
      findings.push({
        requirementId: requirement.id,
        group: requirement.group,
        message: `${requirement.label} artifact id must be a stable artifact identity.`,
        nextStep: "Record the real external artifact id, run id, upload id, approval record id, or media id for this launch proof.",
      })
    }
    if (isBlank(item.artifactDigestOrVersion)) {
      findings.push({
        requirementId: requirement.id,
        group: requirement.group,
        message: `${requirement.label} is missing artifact digest or version.`,
        nextStep: "Record a digest, checksum, build hash, policy version, store version, or media version tying the artifact to the target release.",
      })
    } else if (item.artifactDigestOrVersion.trim() !== item.artifactDigestOrVersion) {
      findings.push({
        requirementId: requirement.id,
        group: requirement.group,
        message: `${requirement.label} artifact digest or version must be canonical without surrounding whitespace.`,
        nextStep: "Record a stable external artifact digest, checksum, build hash, policy version, store version, or media version without surrounding whitespace.",
      })
    } else if (isPlaceholderEvidenceReference(item.artifactDigestOrVersion)) {
      findings.push({
        requirementId: requirement.id,
        group: requirement.group,
        message: `${requirement.label} artifact digest or version is placeholder evidence.`,
        nextStep: requirement.requiredEvidence,
      })
    } else if (isDigestOrChecksumReference(item.artifactDigestOrVersion) && !isCanonicalDigestReference(item.artifactDigestOrVersion)) {
      findings.push({
        requirementId: requirement.id,
        group: requirement.group,
        message: `${requirement.label} artifact digest or version checksum must be a canonical sha/checksum/digest-prefixed hex value.`,
        nextStep: "Record a canonical sha/checksum/digest-prefixed hex digest or use a real stable version/build reference.",
      })
    } else if (isWeakDigestOrVersionReference(item.artifactDigestOrVersion)) {
      findings.push({
        requirementId: requirement.id,
        group: requirement.group,
        message: `${requirement.label} artifact digest or version must be a stable digest, checksum, build hash, policy version, store version, or media version.`,
        nextStep: "Record a stable external artifact digest, checksum, build hash, policy version, store version, or media version tying the artifact to the target release.",
      })
    }
    if (isBlank(item.targetChannel)) {
      findings.push({
        requirementId: requirement.id,
        group: requirement.group,
        message: `${requirement.label} is missing target channel.`,
        nextStep: "Record the billing provider mode, legal/public URL context, browser/mobile store channel, or GTM launch channel.",
      })
    } else if (item.targetChannel.trim() !== item.targetChannel) {
      findings.push({
        requirementId: requirement.id,
        group: requirement.group,
        message: `${requirement.label} target channel must be canonical without surrounding whitespace.`,
        nextStep: "Record the real target channel without surrounding whitespace.",
      })
    } else if (isWeakContextEvidenceReference(item.targetChannel)) {
      findings.push({
        requirementId: requirement.id,
        group: requirement.group,
        message: `${requirement.label} target channel is placeholder evidence.`,
        nextStep: requirement.requiredEvidence,
      })
    } else if (!isSpecificLaunchTargetChannel(item.targetChannel, requirement)) {
      findings.push({
        requirementId: requirement.id,
        group: requirement.group,
        message: `${requirement.label} target channel must identify a concrete ${requirement.group} launch channel for ${requirement.id}.`,
        nextStep: requirement.requiredEvidence,
      })
    }
    if (isBlank(item.evidenceLink)) {
      findings.push({
        requirementId: requirement.id,
        group: requirement.group,
        message: `${requirement.label} is missing an evidence link.`,
        nextStep: requirement.requiredEvidence,
      })
    } else if (isPlaceholderEvidenceReference(item.evidenceLink)) {
      findings.push({
        requirementId: requirement.id,
        group: requirement.group,
        message: `${requirement.label} evidence link is placeholder evidence.`,
        nextStep: requirement.requiredEvidence,
      })
    } else if (!isEvidenceLikeReference(item.evidenceLink)) {
      findings.push({
        requirementId: requirement.id,
        group: requirement.group,
        message: `${requirement.label} evidence link must be a URL or repo artifact path.`,
        nextStep: requirement.requiredEvidence,
      })
    } else if (!launchArtifactEvidenceLinkMatchesRequirement(item.evidenceLink, requirement)) {
      findings.push({
        requirementId: requirement.id,
        group: requirement.group,
        message: `${requirement.label} evidence link must identify ${requirement.group} and ${requirement.id} launch evidence.`,
        nextStep: "Attach evidence whose URL or repo artifact path names the launch artifact group and exact requirement.",
      })
    }
    if (isBlank(item.ownerDate)) {
      findings.push({
        requirementId: requirement.id,
        group: requirement.group,
        message: `${requirement.label} is missing owner/date.`,
        nextStep: "Record the owner and date for this launch artifact evidence.",
      })
    } else if (!hasOwnerIdentityWithIsoDate(item.ownerDate)) {
      findings.push({
        requirementId: requirement.id,
        group: requirement.group,
        message: `${requirement.label} owner/date must identify a real owner and include a YYYY-MM-DD date.`,
        nextStep: "Record the real launch artifact owner and review date using YYYY-MM-DD.",
      })
    }
    if (isBlank(item.environment)) {
      findings.push({
        requirementId: requirement.id,
        group: requirement.group,
        message: `${requirement.label} is missing environment or target channel context.`,
        nextStep: "Record target environment, billing provider, store channel, or GTM channel context.",
      })
    } else if (item.environment.trim() !== item.environment) {
      findings.push({
        requirementId: requirement.id,
        group: requirement.group,
        message: `${requirement.label} environment or target channel context must be canonical without surrounding whitespace.`,
        nextStep: "Record the real target environment, billing provider, store channel, or GTM channel context without surrounding whitespace.",
      })
    } else if (isWeakContextEvidenceReference(item.environment)) {
      findings.push({
        requirementId: requirement.id,
        group: requirement.group,
        message: `${requirement.label} environment or target channel context is placeholder evidence.`,
        nextStep: "Record the real target environment, billing provider, store channel, or GTM channel context.",
      })
    } else if (!isSpecificLaunchArtifactEnvironment(item.environment, requirement)) {
      findings.push({
        requirementId: requirement.id,
        group: requirement.group,
        message: `${requirement.label} environment or target channel context must include target-release channel plus ${requirement.id} context.`,
        nextStep: requirement.requiredEvidence,
      })
    }
  }

  return { acceptable: findings.length === 0, findings }
}

export function evaluateAstraMacroPlanCompletion(
  evidence: AstraMacroPlanCompletionEvidence,
  items: AstraMacroOperationalEvidenceItem[] = ASTRA_MACRO_OPERATIONAL_EVIDENCE,
): AstraMacroPlanCompletionDecision {
  const operationalDecision = evaluateAstraMacroOperationalEvidence(items)
  const blockers: AstraMacroPlanCompletionBlocker[] = []

  if (operationalDecision.strongerClaimBlocked) {
    blockers.push({
      code: "operational_evidence",
      message: "Operational evidence remains unproved for one or more macro areas; keep downgrade copy until every area is marked proved from target-release evidence and docs/reviews/macro-operational-evidence-completion-packet-2026-05-28.json satisfies evaluateAstraMacroOperationalEvidenceCompletionPacket().",
    })
  }

  if (!evidence.ciQualityArtifactsAttached) {
    blockers.push({
      code: "ci_quality_artifacts",
      message: "Attach CI `quality-gate-results` artifact packet rows with CI run URL, success workflow/job conclusions, stable non-weak run/job/artifact identity, distinct artifact id/URL, stable non-weak artifact digest/checksum, URL or repo artifact-path manifest, 7-40 character non-zero hex target commit/SHA, non-placeholder owner/date containing a real calendar YYYY-MM-DD, and required quality-command coverage.",
    })
  }

  if (!evidence.ciLiveBrowserArtifactsAttached) {
    blockers.push({
      code: "ci_live_browser_artifacts",
      message: "Attach CI `live-bench-results` uploaded artifact packet rows with CI run URL, success workflow/job conclusions, stable non-weak run/job/artifact identity, distinct artifact id/URL, stable non-weak artifact digest/checksum, URL or repo artifact-path manifest, 7-40 character non-zero hex target commit/SHA, non-placeholder owner/date containing a real calendar YYYY-MM-DD, and required release-proof lane coverage.",
    })
  }

  if (!evidence.ownerReleaseApprovalRecorded) {
    blockers.push({
      code: "owner_release_approval",
      message: "Record owner release approval with non-placeholder approver/date containing a real calendar YYYY-MM-DD, URL or repo artifact-path approval record, 7-40 character non-zero hex target commit/SHA, reviewed Gate 4/RC/final-gate artifacts, and remaining-blocker/downgrade acknowledgements.",
    })
  }

  if (!evidence.manualQaChecklistComplete) {
    blockers.push({
      code: "manual_qa_checklist",
      message: "Fill every Section 6/7/13/14/24/32 manual/browser QA row with non-placeholder owner/date containing a real calendar YYYY-MM-DD, real browser/build environment, URL or repo artifact-path evidence link, and `pass` or `pass-with-downgrade` verdict.",
    })
  }

  if (!evidence.humanScoredAiQualityReportAttached) {
    blockers.push({
      code: "human_scored_ai_quality",
      message: "Attach a dated human-scored AI quality report with non-placeholder reviewer/date containing a real calendar YYYY-MM-DD, real target environment, stable non-weak run metadata and fixture manifest version, URL or repo artifact-path live provider samples and blocker triage, finite sample counts matching summarized P0 samples, trend, and release decision before production quality claims.",
    })
  }

  if (!evidence.billingLegalStoreGtmArtifactsAttached) {
    blockers.push({ code: "billing_legal_store_gtm_artifacts", message: "Attach billing, legal, store submission, and GTM launch artifact rows with artifact type/id, stable non-weak digest or version, target channel, claim boundary, non-placeholder owner/date containing a real calendar YYYY-MM-DD, real environment/channel context, and URL or repo artifact-path evidence link before launch-complete claims." })
  }

  if (!evidence.productionMetricsExportAttached) {
    blockers.push({ code: "production_metrics_export", message: "Attach production/cohort metric dashboard exports with valid non-reversed canonical shared YYYY-MM-DD..YYYY-MM-DD date range, real cohort/source/export id without surrounding whitespace, timezone-bearing ISO exported-at timestamp, stable non-weak digest/checksum, stable non-weak query version, category-aligned non-duplicated metric ids, URL or repo artifact-path evidence/privacy links, non-placeholder owner/date containing a real calendar YYYY-MM-DD, and product-metrics readiness evidence accepted by evaluateAstraProductMetricsReadiness() with non-placeholder label, owner/date, and URL or repo artifact-path evidence link before metric maturity claims." })
  }

  return {
    complete: blockers.length === 0,
    blockers,
  }
}

function formatCompletionBlocker(blocker: AstraMacroPlanCompletionBlocker): string {
  return `- ${blocker.code}: ${blocker.message}`
}

export function renderAstraMacroPlanCompletionGateNote(
  evidence: AstraMacroPlanCompletionEvidence,
  items: AstraMacroOperationalEvidenceItem[] = ASTRA_MACRO_OPERATIONAL_EVIDENCE,
  options: AstraMacroPlanCompletionGateNoteOptions = {},
): string {
  const generatedAt = options.generatedAt ?? new Date().toISOString()
  const label = options.label ?? "Macro plan final completion gate"
  const decision = evaluateAstraMacroPlanCompletion(evidence, items)

  return [
    `# ${label}`,
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Decision",
    "",
    `- Complete: ${decision.complete ? "yes" : "no"}`,
    `- Blocker count: ${decision.blockers.length}`,
    "",
    "This gate is stricter than repo-side public-beta evidence. Do not mark the macro plan fully complete unless this note renders `Complete: yes` for the target commit/worktree and all blocker evidence is attached.",
    "",
    "## Blocking evidence",
    "",
    ...(decision.blockers.length > 0 ? decision.blockers.map(formatCompletionBlocker) : ["No blockers remain for this evidence set."]),
    "",
  ].join("\n")
}

function formatSectionList(sections: number[]): string {
  return sections.map((section) => `Section ${section}`).join(", ")
}

function formatMarkdownList(items: string[]): string {
  return items.map((item) => `  - ${item}`).join("\n")
}

function formatOperationalEvidenceItem(item: AstraMacroOperationalEvidenceItem): string {
  return [
    `### ${item.label}`,
    `- ID: \`${item.id}\``,
    `- Plan sections: ${formatSectionList(item.planSections)}`,
    `- Status: \`${item.status}\``,
    `- Current repo evidence:\n${formatMarkdownList(item.currentEvidence)}`,
    `- Required before stronger claim:\n${formatMarkdownList(item.requiredBeforeStrongerClaim)}`,
    `- Downgrade copy: ${item.downgradeCopy}`,
  ].join("\n")
}

export function renderAstraMacroOperationalEvidenceRcNote(
  items: AstraMacroOperationalEvidenceItem[] = ASTRA_MACRO_OPERATIONAL_EVIDENCE,
  options: AstraMacroOperationalEvidenceRcNoteOptions = {},
): string {
  const generatedAt = options.generatedAt ?? new Date().toISOString()
  const rcLabel = options.rcLabel ?? "Macro plan RC evidence note"
  const decision = evaluateAstraMacroOperationalEvidence(items)
  const validationEvidence = options.validationEvidence ?? [
    "Run `pnpm exec tsc --noEmit --pretty false && pnpm check:repo-knowledge && pnpm lint:ci` for this RC.",
    "Attach focused tests for any touched macro-plan slices.",
  ]

  return [
    `# ${rcLabel}`,
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Decision",
    "",
    `- Public beta acceptable with downgrade copy: ${decision.publicBetaReady ? "yes" : "no"}`,
    `- Stronger launch/product claims blocked: ${decision.strongerClaimBlocked ? "yes" : "no"}`,
    `- External-evidence blockers: ${decision.missingEvidence.length}`,
    `- Areas requiring downgrade copy: ${decision.downgradeRequired.length}`,
    "",
    "This note is release evidence for claim boundaries only. It does not replace production dashboards, store uploads, billing/legal proof, live-browser artifacts, or manual QA packets. Use `docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md` to collect the owner/date/environment/evidence/verdict rows for the remaining manual/browser QA items.",
    "",
    "## Validation evidence attached to this RC note",
    "",
    ...validationEvidence.map((entry) => `- ${entry}`),
    "",
    "## External evidence blockers",
    "",
    ...(decision.missingEvidence.length > 0
      ? decision.missingEvidence.map(formatOperationalEvidenceItem)
      : ["No external-evidence blockers are currently tracked."]),
    "",
    "## Downgrade-required beta boundaries",
    "",
    ...(decision.downgradeRequired.length > 0
      ? decision.downgradeRequired.map(formatOperationalEvidenceItem)
      : ["No downgrade-required beta boundaries are currently tracked."]),
    "",
    "## Release-note rule",
    "",
    "If a release note, store listing, website, demo, or support reply touches any area above, it must either attach the listed stronger evidence or reuse the downgrade copy verbatim. Do not convert repository implementation into paid launch, production maturity, compliance, or store-submission claims.",
    "",
  ].join("\n")
}
