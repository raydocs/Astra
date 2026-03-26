import { AstraBillingLinkSchema, type AstraBillingLink, type AstraPlan } from "../src/types/auth"

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
