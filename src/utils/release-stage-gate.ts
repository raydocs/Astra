import type { ComplianceEvidenceInput } from "@/utils/trust/compliance"
import { evaluateAstraComplianceReadiness } from "@/utils/trust/compliance"
import { FEATURE_FLAGS, V0_KILL_SWITCHES } from "@/utils/feature-flags"
import type { AstraProposalGateInput } from "@/utils/strategic-non-goals"
import { evaluateAstraProposalGate } from "@/utils/strategic-non-goals"

export type AstraReleaseStage = "internal_alpha" | "private_beta" | "public_beta" | "paid_launch"

export type AstraReleaseGateCode =
  | "core_path"
  | "user_actionable_errors"
  | "data_deletion_export"
  | "support_entry"
  | "quality_samples"
  | "safety_samples"
  | "feature_flag_rollback"
  | "paywall_copy_review"
  | "privacy_notice"
  | "cancel_refund_path"
  | "known_limitations"
  | "beta_feedback"
  | "paid_billing_blockers"
  | "legal_trust_compliance"
  | "claim_boundary"

export interface AstraReleaseStageDefinition {
  stage: AstraReleaseStage
  label: string
  audience: string
  objective: string
  allowedIssues: string
  hardBoundary: string
}

export interface AstraReleaseStageGateEvidence {
  corePathComplete: boolean
  userActionableErrors: boolean
  dataDeletionExportVisible: boolean
  supportEntryReady: boolean
  qualitySamplesPassed: boolean
  safetySamplesPassed: boolean
  featureFlagRollbackReady: boolean
  paywallCopyReviewed: boolean
  privacyNoticeReady: boolean
  cancelRefundPathReady: boolean
  knownLimitationsPublished: boolean
  betaFeedbackReady: boolean
  paidBillingBlockersCleared: boolean
  complianceEvidence?: ComplianceEvidenceInput
  launchClaimProposal?: AstraProposalGateInput
  featureFlagCount?: number
  killSwitchCount?: number
}

export interface AstraReleaseStageGateFinding {
  code: AstraReleaseGateCode
  severity: "block" | "warn"
  message: string
  nextStep: string
}

export interface AstraReleaseStageGateDecision {
  stage: AstraReleaseStage
  ready: boolean
  findings: AstraReleaseStageGateFinding[]
  blockers: AstraReleaseStageGateFinding[]
  warnings: AstraReleaseStageGateFinding[]
  requiredGateCodes: AstraReleaseGateCode[]
}

export const ASTRA_RELEASE_STAGES: Record<AstraReleaseStage, AstraReleaseStageDefinition> = {
  internal_alpha: {
    stage: "internal_alpha",
    label: "Internal Alpha",
    audience: "team and agents",
    objective: "Find obvious issues without losing data or violating safety boundaries.",
    allowedIssues: "Rough UI and incomplete edge boundaries are acceptable.",
    hardBoundary: "Data loss, safety failures, and missing rollback paths block even internal alpha.",
  },
  private_beta: {
    stage: "private_beta",
    label: "Private Beta",
    audience: "20–50 target learners",
    objective: "Validate learning value with a monitored support and privacy path.",
    allowedIssues: "Some marked scenarios can fail.",
    hardBoundary: "No recovery action, no support entry, or no privacy notice blocks private beta.",
  },
  public_beta: {
    stage: "public_beta",
    label: "Public Beta",
    audience: "public install users",
    objective: "Collect broader feedback without overstating beta capabilities.",
    allowedIssues: "Beta-labeled limits are acceptable.",
    hardBoundary: "Overclaimed public copy, paid-launch implication, missing privacy/support, or missing rollback blocks public beta.",
  },
  paid_launch: {
    stage: "paid_launch",
    label: "Paid Launch",
    audience: "paying customers",
    objective: "Charge only when core paths, trust evidence, billing operations, and data controls are complete.",
    allowedIssues: "Small UX issues are acceptable when core learning and account paths are stable.",
    hardBoundary: "Core path failure, uncontrolled data, missing billing/cancel/refund support, or missing legal/privacy evidence blocks paid launch.",
  },
}

const REQUIRED_GATES: Record<AstraReleaseStage, AstraReleaseGateCode[]> = {
  internal_alpha: [
    "core_path",
    "user_actionable_errors",
    "data_deletion_export",
    "safety_samples",
    "feature_flag_rollback",
  ],
  private_beta: [
    "core_path",
    "user_actionable_errors",
    "data_deletion_export",
    "support_entry",
    "quality_samples",
    "safety_samples",
    "feature_flag_rollback",
    "privacy_notice",
    "beta_feedback",
  ],
  public_beta: [
    "core_path",
    "user_actionable_errors",
    "data_deletion_export",
    "support_entry",
    "quality_samples",
    "safety_samples",
    "feature_flag_rollback",
    "paywall_copy_review",
    "privacy_notice",
    "known_limitations",
    "beta_feedback",
  ],
  paid_launch: [
    "core_path",
    "user_actionable_errors",
    "data_deletion_export",
    "support_entry",
    "quality_samples",
    "safety_samples",
    "feature_flag_rollback",
    "paywall_copy_review",
    "privacy_notice",
    "cancel_refund_path",
    "known_limitations",
    "paid_billing_blockers",
    "legal_trust_compliance",
  ],
}

const EVIDENCE_BY_GATE: Partial<Record<AstraReleaseGateCode, keyof AstraReleaseStageGateEvidence>> = {
  core_path: "corePathComplete",
  user_actionable_errors: "userActionableErrors",
  data_deletion_export: "dataDeletionExportVisible",
  support_entry: "supportEntryReady",
  quality_samples: "qualitySamplesPassed",
  safety_samples: "safetySamplesPassed",
  feature_flag_rollback: "featureFlagRollbackReady",
  paywall_copy_review: "paywallCopyReviewed",
  privacy_notice: "privacyNoticeReady",
  cancel_refund_path: "cancelRefundPathReady",
  known_limitations: "knownLimitationsPublished",
  beta_feedback: "betaFeedbackReady",
  paid_billing_blockers: "paidBillingBlockersCleared",
}

const MESSAGES_BY_GATE: Record<AstraReleaseGateCode, { message: string; nextStep: string }> = {
  core_path: {
    message: "Core first-success and learning-loop paths are not evidenced as complete.",
    nextStep: "Attach current core-path proof or downgrade the release stage.",
  },
  user_actionable_errors: {
    message: "User-visible errors do not all provide ordinary-language recovery actions.",
    nextStep: "Add action-oriented copy or support/report paths for visible failures.",
  },
  data_deletion_export: {
    message: "Learning data deletion/export visibility is missing.",
    nextStep: "Expose or document deletion/export controls before external or paid release.",
  },
  support_entry: {
    message: "A monitored support or feedback entry is missing.",
    nextStep: "Provide Report/Support entry, owner, and metadata-only support boundary.",
  },
  quality_samples: {
    message: "Required quality samples are not green for this stage.",
    nextStep: "Run or attach current quality samples; internal alpha may proceed only with this as a warning.",
  },
  safety_samples: {
    message: "Safety samples are not green.",
    nextStep: "Do not enter external beta until safety samples pass.",
  },
  feature_flag_rollback: {
    message: "Feature flag or rollback evidence is missing.",
    nextStep: "Confirm high-risk features have rollback/kill-switch coverage and safe fallback copy.",
  },
  paywall_copy_review: {
    message: "Public paywall/pricing copy has not been reviewed for launch-stage truthfulness.",
    nextStep: "Review copy so beta/free/paid boundaries are explicit and no unavailable plan is promised.",
  },
  privacy_notice: {
    message: "Privacy notice is missing or not ready for this stage.",
    nextStep: "Publish or link the privacy boundary before Private/Public Beta or Paid Launch.",
  },
  cancel_refund_path: {
    message: "Cancel/refund/account-management path is not ready.",
    nextStep: "Do not enter Paid Launch until cancellation, refund, support, and account management are operational.",
  },
  known_limitations: {
    message: "Known limitations are not published alongside public claims.",
    nextStep: "Add public beta notes or release notes that mark beta/works-best-with boundaries.",
  },
  beta_feedback: {
    message: "Beta feedback collection path is missing.",
    nextStep: "Add one-click feedback/support path without collecting page content by default.",
  },
  paid_billing_blockers: {
    message: "Paid-launch billing blockers are not cleared.",
    nextStep: "Complete pricing, provider, checkout, webhook, entitlements, quota, portal, refund, deletion/export, legal, and ops evidence.",
  },
  legal_trust_compliance: {
    message: "Legal/trust compliance evidence is incomplete for Paid Launch.",
    nextStep: "Complete privacy, terms/refund/AI notice, store permissions, export boundary, deletion, support consent, and legal review evidence.",
  },
  claim_boundary: {
    message: "Launch claim violates the Strategic Non-Goals or proof-boundary decision tree.",
    nextStep: "Narrow the claim, mark it beta/experimental, or defer the capability before release.",
  },
}

function makeFinding(code: AstraReleaseGateCode, severity: "block" | "warn", messageOverride?: string): AstraReleaseStageGateFinding {
  const template = MESSAGES_BY_GATE[code]
  return {
    code,
    severity,
    message: messageOverride ?? template.message,
    nextStep: template.nextStep,
  }
}

function evaluateRollbackEvidence(input: AstraReleaseStageGateEvidence): boolean {
  const featureFlagCount = input.featureFlagCount ?? Object.keys(FEATURE_FLAGS).length
  const killSwitchCount = input.killSwitchCount ?? V0_KILL_SWITCHES.length
  return input.featureFlagRollbackReady && featureFlagCount > 0 && killSwitchCount > 0
}

export function evaluateAstraReleaseStageGate(
  stage: AstraReleaseStage,
  input: AstraReleaseStageGateEvidence,
): AstraReleaseStageGateDecision {
  const requiredGateCodes = REQUIRED_GATES[stage]
  const findings: AstraReleaseStageGateFinding[] = []

  for (const code of requiredGateCodes) {
    if (code === "feature_flag_rollback") {
      if (!evaluateRollbackEvidence(input)) findings.push(makeFinding(code, "block"))
      continue
    }
    if (code === "legal_trust_compliance") {
      if (!input.complianceEvidence) {
        findings.push(makeFinding(code, "block", "Paid Launch is missing legal/trust compliance evidence."))
        continue
      }
      const compliance = evaluateAstraComplianceReadiness(input.complianceEvidence)
      if (!compliance.readyForPaidLaunch) {
        findings.push(makeFinding(
          code,
          "block",
          `Paid Launch is missing compliance evidence for: ${compliance.missingLaunchBlockers.map((item) => item.area).join(", ")}.`,
        ))
      }
      continue
    }
    const evidenceKey = EVIDENCE_BY_GATE[code]
    if (evidenceKey && !input[evidenceKey]) findings.push(makeFinding(code, "block"))
  }

  if (stage === "internal_alpha" && !input.qualitySamplesPassed) {
    findings.push(makeFinding("quality_samples", "warn"))
  }

  if (stage === "public_beta" && input.cancelRefundPathReady) {
    findings.push(makeFinding(
      "cancel_refund_path",
      "warn",
      "Public Beta includes cancel/refund evidence, but the product must still avoid implying paid launch unless billing blockers are cleared.",
    ))
  }

  if (input.launchClaimProposal) {
    const proposal = evaluateAstraProposalGate(input.launchClaimProposal)
    if (proposal.decision === "defer") {
      findings.push(makeFinding("claim_boundary", "block", proposal.findings.map((finding) => finding.message).join(" ")))
    } else if (proposal.decision === "advanced_or_beta_only") {
      findings.push(makeFinding(
        "claim_boundary",
        stage === "paid_launch" ? "block" : "warn",
        "Launch claim requires an explicit Advanced/Beta/Experimental boundary plus support copy, proof depth, and rollback notes.",
      ))
    }
  }

  const blockers = findings.filter((finding) => finding.severity === "block")
  const warnings = findings.filter((finding) => finding.severity === "warn")
  return {
    stage,
    ready: blockers.length === 0,
    findings,
    blockers,
    warnings,
    requiredGateCodes,
  }
}
