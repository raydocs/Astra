export type AstraProposalSurfaceBoundary = "default" | "advanced" | "beta" | "experimental" | "internal_only"

export interface AstraProposalGateInput {
  supportsZeroConfig: boolean
  controlsCost: boolean
  ordinaryLanguage: boolean
  protectsPrivacyByDefault: boolean
  advancesLearningLoopOrPaidValue: boolean
  observableBySupportAndAnalytics: boolean
  surfaceBoundary: AstraProposalSurfaceBoundary
  introducesHighCostUnlimitedUse?: boolean
  introducesDefaultContentUpload?: boolean
  introducesProviderConsoleDefault?: boolean
  introducesSocialCommunityDefault?: boolean
  claimsUniversalSupport?: boolean
}

export type AstraProposalGateQuestion =
  | "supports_zero_config"
  | "controls_cost"
  | "ordinary_language"
  | "privacy_by_default"
  | "learning_loop_or_paid_value"
  | "support_analytics_observable"

export type AstraProposalNonGoalRisk =
  | "high_cost_unlimited_use"
  | "default_content_upload"
  | "default_provider_console"
  | "default_social_community"
  | "universal_support_claim"

export interface AstraProposalGateFinding {
  code: AstraProposalGateQuestion | AstraProposalNonGoalRisk
  severity: "block" | "advanced_boundary_required" | "review"
  message: string
}

export interface AstraProposalGateDecision {
  decision: "accept_candidate" | "defer" | "advanced_or_beta_only"
  findings: AstraProposalGateFinding[]
  requiredNextSteps: string[]
}

export const ASTRA_PROPOSAL_GATE_QUESTIONS: Array<{
  code: AstraProposalGateQuestion
  field: keyof Pick<
    AstraProposalGateInput,
    "supportsZeroConfig" | "controlsCost" | "ordinaryLanguage" | "protectsPrivacyByDefault" | "advancesLearningLoopOrPaidValue" | "observableBySupportAndAnalytics"
  >
  question: string
  failureMessage: string
}> = [
  {
    code: "supports_zero_config",
    field: "supportsZeroConfig",
    question: "Does this support zero-config Astra?",
    failureMessage: "Proposal does not preserve the zero-config default experience.",
  },
  {
    code: "controls_cost",
    field: "controlsCost",
    question: "Can cost be controlled or bounded?",
    failureMessage: "Proposal does not describe a cost boundary, limit, downgrade, or kill switch.",
  },
  {
    code: "ordinary_language",
    field: "ordinaryLanguage",
    question: "Can this be explained in ordinary user language?",
    failureMessage: "Proposal cannot be explained without technical/provider/model language.",
  },
  {
    code: "privacy_by_default",
    field: "protectsPrivacyByDefault",
    question: "Does it protect privacy by default?",
    failureMessage: "Proposal lacks a default privacy boundary.",
  },
  {
    code: "learning_loop_or_paid_value",
    field: "advancesLearningLoopOrPaidValue",
    question: "Does it strengthen the learning loop or paid value?",
    failureMessage: "Proposal does not strengthen understanding, saving, review, Library assets, trust, reliability, or paid value.",
  },
  {
    code: "support_analytics_observable",
    field: "observableBySupportAndAnalytics",
    question: "Can support and privacy-safe analytics observe it?",
    failureMessage: "Proposal lacks a metadata-only support or analytics plan.",
  },
]

const NON_GOAL_RISK_MESSAGES: Record<AstraProposalNonGoalRisk, string> = {
  high_cost_unlimited_use: "Proposal appears to create unlimited high-cost use; require limits, tier boundary, queueing, or deferral.",
  default_content_upload: "Proposal uploads content by default; require explicit user action and metadata-only default behavior.",
  default_provider_console: "Proposal makes provider/model controls part of default UI; move to advanced/internal or defer.",
  default_social_community: "Proposal introduces a default social community surface; use user-initiated share/export alternatives instead.",
  universal_support_claim: "Proposal claims universal provider/platform/file support; narrow the claim to proven surfaces or mark beta/experimental.",
}

function addRisk(
  findings: AstraProposalGateFinding[],
  input: AstraProposalGateInput,
  flag: keyof Pick<
    AstraProposalGateInput,
    "introducesHighCostUnlimitedUse" | "introducesDefaultContentUpload" | "introducesProviderConsoleDefault" | "introducesSocialCommunityDefault" | "claimsUniversalSupport"
  >,
  code: AstraProposalNonGoalRisk,
) {
  if (!input[flag]) return
  const canBeBounded = input.surfaceBoundary !== "default"
  findings.push({
    code,
    severity: canBeBounded ? "advanced_boundary_required" : "block",
    message: NON_GOAL_RISK_MESSAGES[code],
  })
}

export function evaluateAstraProposalGate(input: AstraProposalGateInput): AstraProposalGateDecision {
  const findings: AstraProposalGateFinding[] = []

  for (const item of ASTRA_PROPOSAL_GATE_QUESTIONS) {
    if (!input[item.field]) {
      findings.push({
        code: item.code,
        severity: "block",
        message: item.failureMessage,
      })
    }
  }

  addRisk(findings, input, "introducesHighCostUnlimitedUse", "high_cost_unlimited_use")
  addRisk(findings, input, "introducesDefaultContentUpload", "default_content_upload")
  addRisk(findings, input, "introducesProviderConsoleDefault", "default_provider_console")
  addRisk(findings, input, "introducesSocialCommunityDefault", "default_social_community")
  addRisk(findings, input, "claimsUniversalSupport", "universal_support_claim")

  const hasBlocker = findings.some((finding) => finding.severity === "block")
  const needsAdvancedBoundary = findings.some((finding) => finding.severity === "advanced_boundary_required")
  const requiredNextSteps = findings.map((finding) => {
    if (finding.severity === "advanced_boundary_required") {
      return "Add an explicit Advanced/Beta/Experimental boundary plus support copy, proof depth, and rollback/kill-switch notes."
    }
    if (finding.code === "controls_cost") return "Add a task cost class, tier/limit policy, and kill-switch or downgrade path."
    if (finding.code === "privacy_by_default" || finding.code === "default_content_upload") return "Add a metadata-only default and explicit user-consent flow for content."
    if (finding.code === "ordinary_language" || finding.code === "default_provider_console") return "Rewrite the user-facing path in task/value language and keep provider/model details out of default UI."
    if (finding.code === "support_analytics_observable") return "Add privacy-safe telemetry and support-report fields before release."
    return "Revise the proposal against the Strategic Non-Goals decision tree before implementation."
  })

  return {
    decision: hasBlocker ? "defer" : needsAdvancedBoundary ? "advanced_or_beta_only" : "accept_candidate",
    findings,
    requiredNextSteps: [...new Set(requiredNextSteps)],
  }
}
