import {
  AstraBillingLinkSchema,
  AstraTrialLifecycleContractSchema,
  type AstraBillingLink,
  type AstraPlan,
  type AstraTrialLifecycleContract,
} from "../types/auth"

import type { RelayEnv, ServerUserRecord } from "./types"

function buildUrl(baseURL: string, params: Record<string, string>): string {
  const url = new URL(baseURL)
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })
  return url.toString()
}

export function createCheckoutLink(
  user: Pick<ServerUserRecord, "id" | "email" | "plan">,
  env: RelayEnv,
  plan: AstraPlan,
): AstraBillingLink {
  return AstraBillingLinkSchema.parse({
    kind: "checkout",
    url: buildUrl(env.billingCheckoutBaseURL, {
      accountId: user.id,
      email: user.email,
      currentPlan: user.plan,
      targetPlan: plan,
      source: "astra-relay",
    }),
    generatedAt: new Date().toISOString(),
    plan,
  })
}

export function createPortalLink(
  user: Pick<ServerUserRecord, "id" | "email" | "plan">,
  env: RelayEnv,
): AstraBillingLink {
  return AstraBillingLinkSchema.parse({
    kind: "portal",
    url: buildUrl(env.billingPortalBaseURL, {
      accountId: user.id,
      email: user.email,
      plan: user.plan,
      source: "astra-relay",
    }),
    generatedAt: new Date().toISOString(),
    plan: user.plan,
  })
}

export function createBetaTrialLifecycleContract(
  user: Pick<ServerUserRecord, "plan" | "subscriptionStatus">,
  options: { intentRecordedAt?: string | null; generatedAt?: string } = {},
): AstraTrialLifecycleContract {
  const generatedAt = options.generatedAt ?? new Date().toISOString()
  const intentRecorded = Boolean(options.intentRecordedAt)
  const trialStatus = user.plan === "trial" ? "started" : intentRecorded ? "intent_recorded" : "not_started"
  const eligibilityReason = user.plan === "pro"
    ? "already_pro"
    : user.plan === "trial"
      ? "already_trial"
      : "eligible_free_account"

  return AstraTrialLifecycleContractSchema.parse({
    schema: "astra-beta-trial-lifecycle.v1",
    generatedAt,
    account: {
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
    },
    explicitActionRequired: true,
    eligibility: {
      eligible: user.plan === "free",
      reason: eligibilityReason,
    },
    trial: {
      status: trialStatus,
      startedAt: user.plan === "trial" ? options.intentRecordedAt ?? null : null,
      expiresAt: null,
    },
    conversion: {
      nextStep: user.plan === "pro" || user.plan === "trial"
        ? "manage_existing_plan"
        : intentRecorded
          ? "wait_for_beta_billing"
          : "record_trial_interest",
      checkoutAvailable: false,
      portalAvailable: false,
    },
    betaBoundary: {
      billingUnavailable: true,
      betaBoundary: true,
      noPaymentCollected: true,
      paymentCollected: false,
      subscriptionMutation: false,
      proEntitlementGranted: false,
      trialEntitlementGranted: false,
    },
  })
}
