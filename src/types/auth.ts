import { z } from "zod"

import { ProviderIdSchema } from "./config"

export const AstraPlanSchema = z.enum(["free", "pro"])
export const AstraSubscriptionStatusSchema = z.enum(["active", "past_due", "canceled"])

export const AstraQuotaSchema = z.object({
  dailyRequestsLimit: z.number().int().nonnegative().default(0),
  dailyCharactersLimit: z.number().int().nonnegative().default(0),
  requestsPerMinuteLimit: z.number().int().nonnegative().default(0),
  remainingDailyRequests: z.number().int().nonnegative().default(0),
  remainingDailyCharacters: z.number().int().nonnegative().default(0),
})

export const AstraUsageEventSchema = z.object({
  timestamp: z.string().trim().min(1),
  provider: ProviderIdSchema,
  requestCount: z.number().int().positive().default(1),
  characterCount: z.number().int().nonnegative().default(0),
})

export const AstraUsageSchema = z.object({
  totalRequests: z.number().int().nonnegative().default(0),
  totalCharacters: z.number().int().nonnegative().default(0),
  dailyRequestsUsed: z.number().int().nonnegative().default(0),
  dailyCharactersUsed: z.number().int().nonnegative().default(0),
  lastRequestAt: z.string().trim().min(1).nullable().default(null),
  recentEvents: z.array(AstraUsageEventSchema).default([]),
})

export const AstraAccountSchema = z.object({
  id: z.string().trim().min(1),
  relayBaseURL: z.string().trim().min(1),
  email: z.string().trim().min(1),
  billingEmail: z.string().trim().min(1),
  createdAt: z.string().trim().min(1),
  plan: AstraPlanSchema.default("free"),
  subscriptionStatus: AstraSubscriptionStatusSchema.default("active"),
  providerEntitlements: z.array(ProviderIdSchema).default(["openai", "gemini"]),
})

export const AstraUsageSnapshotSchema = z.object({
  generatedAt: z.string().trim().min(1),
  quota: AstraQuotaSchema,
  usage: AstraUsageSchema,
})

export const AstraBillingLinkSchema = z.object({
  kind: z.enum(["checkout", "portal"]),
  url: z.string().trim().min(1),
  generatedAt: z.string().trim().min(1),
  plan: AstraPlanSchema.nullable().default(null),
})

export const AstraSessionSchema = z.object({
  version: z.literal(1).default(1),
  sessionToken: z.string().trim().min(1),
  relayBaseURL: z.string().trim().min(1),
  email: z.string().trim().min(1),
  plan: AstraPlanSchema.default("free"),
  subscriptionStatus: AstraSubscriptionStatusSchema.default("active"),
  providerEntitlements: z.array(ProviderIdSchema).default(["openai", "gemini"]),
  quota: AstraQuotaSchema.default({
    dailyRequestsLimit: 0,
    dailyCharactersLimit: 0,
    requestsPerMinuteLimit: 0,
    remainingDailyRequests: 0,
    remainingDailyCharacters: 0,
  }),
  usage: AstraUsageSchema.default({
    totalRequests: 0,
    totalCharacters: 0,
    dailyRequestsUsed: 0,
    dailyCharactersUsed: 0,
    lastRequestAt: null,
    recentEvents: [],
  }),
  expiresAt: z.string().trim().min(1).nullable().default(null),
})

export type AstraPlan = z.infer<typeof AstraPlanSchema>
export type AstraSubscriptionStatus = z.infer<typeof AstraSubscriptionStatusSchema>
export type AstraQuota = z.infer<typeof AstraQuotaSchema>
export type AstraUsage = z.infer<typeof AstraUsageSchema>
export type AstraUsageEvent = z.infer<typeof AstraUsageEventSchema>
export type AstraAccount = z.infer<typeof AstraAccountSchema>
export type AstraUsageSnapshot = z.infer<typeof AstraUsageSnapshotSchema>
export type AstraBillingLink = z.infer<typeof AstraBillingLinkSchema>
export type AstraSession = z.infer<typeof AstraSessionSchema>
