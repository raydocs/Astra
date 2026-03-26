import type { ProviderId } from "../src/types/config"
import type { AstraPlan, AstraSubscriptionStatus } from "../src/types/auth"

import type { RelayEnv } from "./types"

function parseProviderEntitlements(raw: string | undefined): ProviderId[] {
  const values = (raw ?? "openai,gemini")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)

  return values.filter((item): item is ProviderId => item === "openai" || item === "gemini")
}

function parsePlan(raw: string | undefined): AstraPlan {
  return raw === "free" ? "free" : "pro"
}

function parseSubscriptionStatus(raw: string | undefined): AstraSubscriptionStatus {
  if (raw === "past_due" || raw === "canceled") return raw
  return "active"
}

export function loadRelayEnv(env: NodeJS.ProcessEnv = process.env): RelayEnv {
  const port = Number(env.ASTRA_RELAY_PORT ?? "8787")
  const host = env.ASTRA_RELAY_HOST ?? "127.0.0.1"
  const publicBaseURL = env.ASTRA_PUBLIC_BASE_URL ?? `http://${host}:${port}/v1`
  const origin = publicBaseURL.replace(/\/v1\/?$/, "")

  return {
    port: Number.isFinite(port) ? port : 8787,
    host,
    publicBaseURL,
    sessionSecret: env.ASTRA_SESSION_SECRET ?? "astra-dev-secret",
    userDbPath: env.ASTRA_USER_DB_PATH ?? "server/data/users.json",
    loginEmail: env.ASTRA_RELAY_EMAIL ?? "demo@astra.local",
    loginPassword: env.ASTRA_RELAY_PASSWORD ?? "astra-demo-pass",
    plan: parsePlan(env.ASTRA_RELAY_PLAN),
    subscriptionStatus: parseSubscriptionStatus(env.ASTRA_RELAY_SUBSCRIPTION_STATUS),
    providerEntitlements: parseProviderEntitlements(env.ASTRA_PROVIDER_ENTITLEMENTS),
    billingCheckoutBaseURL: env.ASTRA_BILLING_CHECKOUT_URL ?? `${origin}/billing/mock/checkout`,
    billingPortalBaseURL: env.ASTRA_BILLING_PORTAL_URL ?? `${origin}/billing/mock/portal`,
    openaiApiKey: env.OPENAI_API_KEY?.trim() ?? "",
    googleApiKey: env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ?? "",
  }
}
