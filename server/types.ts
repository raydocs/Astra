import type { ProviderId } from "../src/types/config"
import type {
  AstraAccount,
  AstraPlan,
  AstraSession,
  AstraSubscriptionStatus,
  AstraUsageSnapshot,
} from "../src/types/auth"
import type { ProviderTranslationRequest } from "../src/utils/providers/types"

export interface RelayEnv {
  port: number
  host: string
  publicBaseURL: string
  sessionSecret: string
  userDbPath: string
  loginEmail: string
  loginPassword: string
  plan: AstraPlan
  subscriptionStatus: AstraSubscriptionStatus
  providerEntitlements: ProviderId[]
  billingCheckoutBaseURL: string
  billingPortalBaseURL: string
  openaiApiKey: string
  googleApiKey: string
}

export interface SessionClaims {
  email: string
  relayBaseURL: string
  issuedAt: string
}

export interface AuthenticatedSession {
  token: string
  session: AstraSession
  claims: SessionClaims
}

export interface AuthenticatedAccount {
  account: AstraAccount
  usage: AstraUsageSnapshot
}

export interface RelayTranslateRequest extends ProviderTranslationRequest {
  provider: ProviderId
  model: string
}

export interface ServerUserLimits {
  dailyRequests: number
  dailyCharacters: number
  requestsPerMinute: number
}

export interface ServerUsageEvent {
  timestamp: string
  provider: ProviderId
  requestCount: number
  characterCount: number
}

export interface ServerUserUsage {
  usageDay: string
  requestsToday: number
  charactersToday: number
  totalRequests: number
  totalCharacters: number
  lastRequestAt: string | null
  recentRequestTimestamps: string[]
  recentEvents: ServerUsageEvent[]
}

export interface ServerUserRecord {
  id: string
  email: string
  billingEmail: string
  createdAt: string
  passwordHash: string
  plan: AstraPlan
  subscriptionStatus: AstraSubscriptionStatus
  providerEntitlements: ProviderId[]
  limits: ServerUserLimits
  usage: ServerUserUsage
}
