export const ASTRA_REFERRAL_READINESS_SCHEMA_ID = "astra-referral-readiness.v1" as const

export type AstraReferralReadinessSchemaId = typeof ASTRA_REFERRAL_READINESS_SCHEMA_ID

export type AstraReferralTrigger = "first_review_complete" | "sample_review_complete" | "manual_invite"

export interface AstraReferralInviteMetadata extends Record<string, unknown> {
  schema: AstraReferralReadinessSchemaId
  source: "sample_lesson"
  surface: "sample_lesson"
  landingSource: "referral"
  referralType: "non_rewarding"
  rewardAvailable: false
  sampleContentOnly: true
  trigger: string
  campaign?: string
}

export interface AstraReferralRateLimitPolicy {
  scope: "invite" | "conversion"
  subject: "referrer" | "invitee" | "device" | "ip"
  windowSeconds: number
  maxEvents: number
}

export const ASTRA_REFERRAL_INVITE_RATE_LIMIT_POLICY: readonly AstraReferralRateLimitPolicy[] = [
  { scope: "invite", subject: "referrer", windowSeconds: 60 * 60, maxEvents: 10 },
  { scope: "invite", subject: "referrer", windowSeconds: 24 * 60 * 60, maxEvents: 25 },
  { scope: "invite", subject: "device", windowSeconds: 24 * 60 * 60, maxEvents: 10 },
  { scope: "invite", subject: "ip", windowSeconds: 60 * 60, maxEvents: 20 },
]

export const ASTRA_REFERRAL_CONVERSION_RATE_LIMIT_POLICY: readonly AstraReferralRateLimitPolicy[] = [
  { scope: "conversion", subject: "invitee", windowSeconds: 24 * 60 * 60, maxEvents: 3 },
  { scope: "conversion", subject: "device", windowSeconds: 24 * 60 * 60, maxEvents: 3 },
  { scope: "conversion", subject: "ip", windowSeconds: 60 * 60, maxEvents: 10 },
]

const DEFAULT_REFERRAL_TRIGGER: AstraReferralTrigger = "first_review_complete"
const SAFE_CAMPAIGN_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/
const UNSAFE_METADATA_KEY_PATTERN = /(url|uri|href|content|text|sentence|excerpt|summary|email|payment|checkout|billing|subscription|trial|pro|entitlement|grant|rewardgrant|usercontent|prompt|apikey|api_key|provider|model)/i
const SAFE_REFERRAL_METADATA_KEYS = new Set([
  "schema",
  "source",
  "surface",
  "landingSource",
  "referralType",
  "rewardAvailable",
  "sampleContentOnly",
  "trigger",
  "campaign",
])

export function sanitizeAstraReferralCampaign(campaign: string | null | undefined): string | undefined {
  const normalized = campaign?.trim().toLowerCase().replace(/\s+/g, "_")
  if (!normalized) return undefined
  return SAFE_CAMPAIGN_PATTERN.test(normalized) ? normalized : undefined
}

export function buildAstraReferralInviteMetadata(input: {
  trigger?: string
  campaign?: string | null
} = {}): AstraReferralInviteMetadata {
  const campaign = sanitizeAstraReferralCampaign(input.campaign)
  return {
    schema: ASTRA_REFERRAL_READINESS_SCHEMA_ID,
    source: "sample_lesson",
    surface: "sample_lesson",
    landingSource: "referral",
    referralType: "non_rewarding",
    rewardAvailable: false,
    sampleContentOnly: true,
    trigger: input.trigger?.trim() || DEFAULT_REFERRAL_TRIGGER,
    ...(campaign ? { campaign } : {}),
  }
}

function hasUnsafeMetadataKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => hasUnsafeMetadataKey(item))
  if (!value || typeof value !== "object") return false
  return Object.entries(value as Record<string, unknown>).some(([key, child]) => (
    (!SAFE_REFERRAL_METADATA_KEYS.has(key) && UNSAFE_METADATA_KEY_PATTERN.test(key)) || hasUnsafeMetadataKey(child)
  ))
}

export function isAstraReferralMetadataSafe(metadata: Record<string, unknown>): boolean {
  if (hasUnsafeMetadataKey(metadata)) return false
  return metadata.schema === ASTRA_REFERRAL_READINESS_SCHEMA_ID
    && metadata.source === "sample_lesson"
    && metadata.surface === "sample_lesson"
    && metadata.landingSource === "referral"
    && metadata.referralType === "non_rewarding"
    && metadata.rewardAvailable === false
    && metadata.sampleContentOnly === true
}

export type AstraReferralReadinessControlCode =
  | "rewards_disabled"
  | "sample_content_first"
  | "metadata_only_events"
  | "invite_rate_limits_enforced"
  | "conversion_rate_limits_enforced"
  | "self_referral_blocked"
  | "duplicate_device_blocked"
  | "duplicate_install_blocked"
  | "duplicate_billing_identity_blocked"
  | "reward_ledger_idempotency_ready"
  | "operator_audit_ready"

export interface AstraReferralReadinessEvidence {
  rewardsDisabled: boolean
  rewardGrantsEnabled?: boolean
  sampleContentFirst: boolean
  metadataOnlyEvents: boolean
  inviteRateLimitsEnforced: boolean
  conversionRateLimitsEnforced: boolean
  selfReferralBlocked: boolean
  duplicateDeviceBlocked: boolean
  duplicateInstallBlocked: boolean
  duplicatePaymentIdentityBlocked: boolean
  rewardLedgerIdempotencyReady: boolean
  operatorAuditReady: boolean
}

export interface AstraReferralReadinessDecision {
  schema: AstraReferralReadinessSchemaId
  controlsReady: boolean
  rewardGrantsEnabled: false
  missingControls: AstraReferralReadinessControlCode[]
}

export function evaluateAstraReferralReadiness(evidence: AstraReferralReadinessEvidence): AstraReferralReadinessDecision {
  const missingControls: AstraReferralReadinessControlCode[] = []
  if (!evidence.rewardsDisabled || evidence.rewardGrantsEnabled === true) missingControls.push("rewards_disabled")
  if (!evidence.sampleContentFirst) missingControls.push("sample_content_first")
  if (!evidence.metadataOnlyEvents) missingControls.push("metadata_only_events")
  if (!evidence.inviteRateLimitsEnforced) missingControls.push("invite_rate_limits_enforced")
  if (!evidence.conversionRateLimitsEnforced) missingControls.push("conversion_rate_limits_enforced")
  if (!evidence.selfReferralBlocked) missingControls.push("self_referral_blocked")
  if (!evidence.duplicateDeviceBlocked) missingControls.push("duplicate_device_blocked")
  if (!evidence.duplicateInstallBlocked) missingControls.push("duplicate_install_blocked")
  if (!evidence.duplicatePaymentIdentityBlocked) missingControls.push("duplicate_billing_identity_blocked")
  if (!evidence.rewardLedgerIdempotencyReady) missingControls.push("reward_ledger_idempotency_ready")
  if (!evidence.operatorAuditReady) missingControls.push("operator_audit_ready")

  return {
    schema: ASTRA_REFERRAL_READINESS_SCHEMA_ID,
    controlsReady: missingControls.length === 0,
    rewardGrantsEnabled: false,
    missingControls,
  }
}

export interface AstraReferralIdentityRiskSignals {
  referrerAccountId?: string | null
  inviteeAccountId?: string | null
  sameAccount?: boolean
  duplicateDevice?: boolean
  duplicateInstall?: boolean
  duplicatePaymentOrBillingIdentity?: boolean
  selfReferralChecked: boolean
  duplicateDeviceChecked: boolean
  duplicateInstallChecked: boolean
  duplicatePaymentOrBillingChecked: boolean
}

export interface AstraReferralIdentityRiskDecision {
  schema: AstraReferralReadinessSchemaId
  blocked: boolean
  risks: Array<"self_referral" | "duplicate_device" | "duplicate_install" | "duplicate_billing_identity">
  evidenceGaps: Array<"self_referral_check" | "duplicate_device_check" | "duplicate_install_check" | "duplicate_billing_check">
}

export function evaluateAstraReferralIdentityRisk(signals: AstraReferralIdentityRiskSignals): AstraReferralIdentityRiskDecision {
  const risks: AstraReferralIdentityRiskDecision["risks"] = []
  const evidenceGaps: AstraReferralIdentityRiskDecision["evidenceGaps"] = []
  const sameAccount = signals.sameAccount === true
    || Boolean(signals.referrerAccountId && signals.inviteeAccountId && signals.referrerAccountId === signals.inviteeAccountId)

  if (!signals.selfReferralChecked) evidenceGaps.push("self_referral_check")
  if (!signals.duplicateDeviceChecked) evidenceGaps.push("duplicate_device_check")
  if (!signals.duplicateInstallChecked) evidenceGaps.push("duplicate_install_check")
  if (!signals.duplicatePaymentOrBillingChecked) evidenceGaps.push("duplicate_billing_check")
  if (sameAccount) risks.push("self_referral")
  if (signals.duplicateDevice === true) risks.push("duplicate_device")
  if (signals.duplicateInstall === true) risks.push("duplicate_install")
  if (signals.duplicatePaymentOrBillingIdentity === true) risks.push("duplicate_billing_identity")

  return {
    schema: ASTRA_REFERRAL_READINESS_SCHEMA_ID,
    blocked: risks.length > 0 || evidenceGaps.length > 0,
    risks,
    evidenceGaps,
  }
}
