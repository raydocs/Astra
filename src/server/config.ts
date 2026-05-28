import { join } from "node:path"

import type { ProviderId } from "../types/config"
import type { AstraPlan, AstraSubscriptionStatus } from "../types/auth"
import { ASTRA_OPS_ROLES, type AstraOpsRoleId } from "../utils/ops-console"

import type { RelayEnv, RelayOperatorPrincipal } from "./types"

const ALL_PROVIDER_IDS: ProviderId[] = ["google_translate", "openai", "gemini"]

// ---------------------------------------------------------------------------
// Default OpenRouter model mapping — maps Astra provider+model to OpenRouter model IDs
// ---------------------------------------------------------------------------

const DEFAULT_OPENROUTER_MODEL_MAP: Record<string, string> = {
  "openai/gpt-5.4-nano": "openai/gpt-5.4-nano",
  "openai/gpt-4.1-mini": "openai/gpt-4.1-mini",
  "openai/gpt-4.1-nano": "openai/gpt-4.1-nano",
  "gemini/gemini-3.1-flash-lite-preview": "google/gemini-2.5-flash-preview-05-20",
  "gemini/gemini-3.0-flash": "google/gemini-2.5-flash-preview-05-20",
}

function parseOpenRouterModelMap(raw: string | undefined): Record<string, string> {
  if (!raw?.trim()) return { ...DEFAULT_OPENROUTER_MODEL_MAP }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, string>
    }
  } catch {
    // fall through to default
  }
  return { ...DEFAULT_OPENROUTER_MODEL_MAP }
}

function parseProviderEntitlements(raw: string | undefined): ProviderId[] {
  const values = (raw ?? ALL_PROVIDER_IDS.join(","))
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)

  return values.filter((item): item is ProviderId => ALL_PROVIDER_IDS.includes(item as ProviderId))
}

function parsePlan(raw: string | undefined): AstraPlan {
  if (raw === "pro" || raw === "trial") return raw
  return "free"
}

function parseSubscriptionStatus(raw: string | undefined): AstraSubscriptionStatus {
  if (raw === "past_due" || raw === "canceled") return raw
  return "active"
}

function parseBooleanFlag(raw: string | undefined): boolean {
  const normalized = raw?.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on"
}

function parseOptionalText(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim()
  return trimmed ? trimmed : undefined
}

function parseOptionalTextList(...values: Array<string | undefined>): string[] | undefined {
  const parsed = values
    .flatMap((value) => value?.split(",") ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
  return parsed.length > 0 ? Array.from(new Set(parsed)) : undefined
}

function parseCorsAllowedOrigins(raw: string | undefined): string[] {
  const values = (raw ?? "*")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
  return values.length > 0 ? values : ["*"]
}

function parseEmailDeliveryProvider(raw: string | undefined): RelayEnv["emailDeliveryProvider"] {
  const normalized = raw?.trim().toLowerCase()
  return normalized === "resend" ? "resend" : undefined
}

const ASTRA_OPS_ROLE_IDS = new Set<AstraOpsRoleId>(ASTRA_OPS_ROLES.map((role) => role.id))

function parseOperatorPrincipals(raw: string | undefined): RelayOperatorPrincipal[] {
  if (!raw?.trim()) return []

  let decoded: unknown
  try {
    decoded = JSON.parse(raw)
  } catch {
    throw new Error("ASTRA_OPERATOR_TOKENS must be valid JSON.")
  }

  if (!Array.isArray(decoded)) {
    throw new Error("ASTRA_OPERATOR_TOKENS must be a JSON array.")
  }

  const seenIds = new Set<string>()
  const seenTokens = new Set<string>()
  return decoded.map((item, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new Error(`ASTRA_OPERATOR_TOKENS[${index}] must be an object.`)
    }
    const candidate = item as Record<string, unknown>
    const id = typeof candidate.id === "string" ? candidate.id.trim() : ""
    const role = typeof candidate.role === "string" ? candidate.role.trim() : ""
    const token = typeof candidate.token === "string" ? candidate.token.trim() : ""

    if (!id) throw new Error(`ASTRA_OPERATOR_TOKENS[${index}].id must be a non-empty string.`)
    if (!token) throw new Error(`ASTRA_OPERATOR_TOKENS[${index}].token must be a non-empty string.`)
    if (!ASTRA_OPS_ROLE_IDS.has(role as AstraOpsRoleId)) {
      throw new Error(`ASTRA_OPERATOR_TOKENS[${index}].role is not a valid Astra ops role.`)
    }
    if (seenIds.has(id)) throw new Error(`ASTRA_OPERATOR_TOKENS contains duplicate operator id: ${id}`)
    if (seenTokens.has(token)) throw new Error("ASTRA_OPERATOR_TOKENS contains duplicate operator tokens.")
    seenIds.add(id)
    seenTokens.add(token)

    return { id, role: role as AstraOpsRoleId, token }
  })
}

function parsePositiveInteger(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || String(parsed) !== raw.trim() || parsed <= 0) {
    throw new Error(`Invalid positive integer: ${raw}`)
  }
  return parsed
}

function resolveRelayDataFilePath(
  env: NodeJS.ProcessEnv,
  explicitPath: string | undefined,
  fileName: string,
): string {
  if (explicitPath !== undefined) return explicitPath

  const dataDir = parseOptionalText(env.ASTRA_RELAY_DATA_DIR)
    ?? parseOptionalText(env.ASTRA_DATA_DIR)
    ?? "data/server"

  return join(dataDir, fileName)
}

export function loadRelayEnv(env: NodeJS.ProcessEnv = process.env): RelayEnv {
  const port = Number(env.ASTRA_RELAY_PORT ?? "8787")
  const host = env.ASTRA_RELAY_HOST ?? "127.0.0.1"
  const publicBaseURL = env.ASTRA_PUBLIC_BASE_URL ?? `http://${host}:${port}/v1`
  const sessionPublicBaseURL = env.ASTRA_SESSION_PUBLIC_BASE_URL ?? publicBaseURL
  const origin = publicBaseURL.replace(/\/v1\/?$/, "")

  return {
    port: Number.isFinite(port) ? port : 8787,
    host,
    publicBaseURL,
    sessionPublicBaseURL,
    sessionSecret: env.ASTRA_SESSION_SECRET ?? "astra-dev-secret",
    platformMirrorSecret: parseOptionalText(env.ASTRA_PLATFORM_MIRROR_SECRET),
    operatorPrincipals: parseOperatorPrincipals(env.ASTRA_OPERATOR_TOKENS),
    userDbPath: resolveRelayDataFilePath(env, env.ASTRA_USER_DB_PATH, "users.json"),
    videoNoteStorePath: resolveRelayDataFilePath(env, env.ASTRA_VIDEO_NOTE_STORE_PATH, "video-notes.json"),
    longRunningTaskStorePath: resolveRelayDataFilePath(env, env.ASTRA_LONG_RUNNING_TASK_STORE_PATH, "long-tasks.json"),
    supportReportInboxPath: resolveRelayDataFilePath(
      env,
      env.ASTRA_SUPPORT_REPORT_INBOX_PATH,
      "support-reports.json",
    ),
    supportKnownIssueStorePath: resolveRelayDataFilePath(
      env,
      env.ASTRA_SUPPORT_KNOWN_ISSUE_STORE_PATH,
      "support-known-issues.json",
    ),
    featureFlagRuntimePath: resolveRelayDataFilePath(
      env,
      env.ASTRA_FEATURE_FLAG_RUNTIME_PATH,
      "feature-flags.json",
    ),
    opsAuditLogPath: resolveRelayDataFilePath(
      env,
      env.ASTRA_OPS_AUDIT_LOG_PATH,
      "ops-audit-log.json",
    ),
    cancellationReasonStorePath: resolveRelayDataFilePath(
      env,
      env.ASTRA_CANCELLATION_REASON_STORE_PATH,
      "cancellation-reasons.json",
    ),
    analyticsEventStorePath: resolveRelayDataFilePath(
      env,
      env.ASTRA_ANALYTICS_EVENT_STORE_PATH,
      "analytics-events.json",
    ),
    loginEmail: env.ASTRA_RELAY_EMAIL ?? "demo@astra.local",
    loginPassword: env.ASTRA_RELAY_PASSWORD ?? "astra-demo-pass",
    plan: parsePlan(env.ASTRA_RELAY_PLAN),
    subscriptionStatus: parseSubscriptionStatus(env.ASTRA_RELAY_SUBSCRIPTION_STATUS),
    providerEntitlements: parseProviderEntitlements(env.ASTRA_PROVIDER_ENTITLEMENTS),
    billingCheckoutBaseURL: env.ASTRA_BILLING_CHECKOUT_URL ?? `${origin}/billing/mock/checkout`,
    billingPortalBaseURL: env.ASTRA_BILLING_PORTAL_URL ?? `${origin}/billing/mock/portal`,
    corsAllowedOrigins: parseCorsAllowedOrigins(env.ASTRA_CORS_ALLOWED_ORIGINS),
    openaiApiKey: env.OPENAI_API_KEY?.trim() ?? "",
    googleApiKey: env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ?? "",
    googleTranslateApiKey: env.GOOGLE_TRANSLATE_API_KEY?.trim()
      ?? env.GOOGLE_CLOUD_TRANSLATE_API_KEY?.trim()
      ?? "",
    openrouterApiKey: env.OPENROUTER_API_KEY?.trim() ?? "",
    useOpenRouter: (env.ASTRA_USE_OPENROUTER ?? "").toLowerCase() === "true"
      || (env.OPENROUTER_API_KEY?.trim().length ?? 0) > 0,
    openrouterModelMap: parseOpenRouterModelMap(env.ASTRA_OPENROUTER_MODEL_MAP),
    freeDailyRequests: Number(env.ASTRA_FREE_DAILY_REQUESTS ?? "2000"),
    freeDailyCharacters: Number(env.ASTRA_FREE_DAILY_CHARACTERS ?? "500000"),
    freeRpm: Number(env.ASTRA_FREE_RPM ?? "120"),
    trialDailyRequests: Number(env.ASTRA_TRIAL_DAILY_REQUESTS ?? env.ASTRA_PRO_DAILY_REQUESTS ?? "2000"),
    trialDailyCharacters: Number(env.ASTRA_TRIAL_DAILY_CHARACTERS ?? env.ASTRA_PRO_DAILY_CHARACTERS ?? "500000"),
    trialRpm: Number(env.ASTRA_TRIAL_RPM ?? env.ASTRA_PRO_RPM ?? "120"),
    proDailyRequests: Number(env.ASTRA_PRO_DAILY_REQUESTS ?? "2000"),
    proDailyCharacters: Number(env.ASTRA_PRO_DAILY_CHARACTERS ?? "500000"),
    proRpm: Number(env.ASTRA_PRO_RPM ?? "120"),
    sessionTtlMs: Number(env.ASTRA_SESSION_TTL_MS ?? String(30 * 24 * 60 * 60 * 1000)),
    syncMaxMutationsPerRequest: parsePositiveInteger(env.ASTRA_SYNC_MAX_MUTATIONS_PER_REQUEST, 200),
    videoNoteMaxConcurrentJobs: parsePositiveInteger(env.ASTRA_VIDEO_NOTE_MAX_CONCURRENT_JOBS, 1),
    emailSignInCodeDevelopmentEcho: parseBooleanFlag(env.ASTRA_EMAIL_SIGN_IN_CODE_DEVELOPMENT_ECHO),
    emailDeliveryProvider: parseEmailDeliveryProvider(env.ASTRA_EMAIL_DELIVERY_PROVIDER),
    emailDeliveryResendApiKey: parseOptionalText(env.RESEND_API_KEY) ?? parseOptionalText(env.ASTRA_RESEND_API_KEY),
    emailDeliveryResendFrom: parseOptionalText(env.ASTRA_EMAIL_FROM),
    emailDeliveryResendApiBaseUrl: parseOptionalText(env.ASTRA_RESEND_API_BASE_URL),
    oauthGoogleClientIds: parseOptionalTextList(env.ASTRA_OAUTH_GOOGLE_CLIENT_IDS, env.GOOGLE_OAUTH_CLIENT_ID),
    oauthAppleClientIds: parseOptionalTextList(env.ASTRA_OAUTH_APPLE_CLIENT_IDS, env.APPLE_OAUTH_CLIENT_ID),
    oauthIdentityDevelopmentRedeem: parseBooleanFlag(env.ASTRA_OAUTH_IDENTITY_DEVELOPMENT_REDEEM),
    cloudflareShadow: {
      writeEnabled: parseBooleanFlag(env.ASTRA_CF_SHADOW_WRITE_ENABLED),
      readParityEnabled: parseBooleanFlag(env.ASTRA_CF_READ_PARITY_ENABLED),
      accountId: parseOptionalText(env.ASTRA_CF_ACCOUNT_ID),
      databaseId: parseOptionalText(env.ASTRA_CF_D1_DATABASE_ID),
      apiToken: parseOptionalText(env.ASTRA_CF_API_TOKEN),
      apiBaseUrl: parseOptionalText(env.ASTRA_CF_API_BASE_URL),
    },
  }
}
