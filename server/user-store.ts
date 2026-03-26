import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import { z } from "zod"

import {
  AstraAccountSchema,
  AstraPlanSchema,
  AstraQuotaSchema,
  AstraSessionSchema,
  AstraSubscriptionStatusSchema,
  AstraUsageEventSchema,
  AstraUsageSchema,
  AstraUsageSnapshotSchema,
  type AstraAccount,
  type AstraQuota,
  type AstraSession,
  type AstraUsage,
  type AstraUsageSnapshot,
} from "../src/types/auth"
import { ProviderIdSchema } from "../src/types/config"
import { AstraError } from "../src/types/translation"

import type {
  RelayEnv,
  ServerUserLimits,
  ServerUserRecord,
  ServerUserUsage,
} from "./types"

const ServerUserLimitsSchema = z.object({
  dailyRequests: z.number().int().nonnegative(),
  dailyCharacters: z.number().int().nonnegative(),
  requestsPerMinute: z.number().int().nonnegative(),
})

const ServerUsageSchema = z.object({
  usageDay: z.string().trim().min(1),
  requestsToday: z.number().int().nonnegative(),
  charactersToday: z.number().int().nonnegative(),
  totalRequests: z.number().int().nonnegative(),
  totalCharacters: z.number().int().nonnegative(),
  lastRequestAt: z.string().trim().min(1).nullable(),
  recentRequestTimestamps: z.array(z.string().trim().min(1)),
  recentEvents: z.array(AstraUsageEventSchema),
})

const ServerUserRecordSchema = z.object({
  id: z.string().trim().min(1).optional(),
  email: z.string().trim().min(1),
  billingEmail: z.string().trim().min(1).optional(),
  createdAt: z.string().trim().min(1).optional(),
  passwordHash: z.string().trim().min(1),
  plan: AstraPlanSchema,
  subscriptionStatus: AstraSubscriptionStatusSchema,
  providerEntitlements: z.array(ProviderIdSchema),
  limits: ServerUserLimitsSchema,
  usage: ServerUsageSchema,
}).transform((record) => ({
  ...record,
  id: record.id ?? buildUserId(record.email),
  billingEmail: record.billingEmail ?? record.email,
  createdAt: record.createdAt ?? new Date().toISOString(),
}))

const ServerUserDatabaseSchema = z.object({
  version: z.literal(1),
  users: z.array(ServerUserRecordSchema),
})

type ServerUserDatabase = z.infer<typeof ServerUserDatabaseSchema>

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex")
}

function buildUserId(email: string): string {
  return `usr_${createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 12)}`
}

function getCurrentUsageDay(now: Date): string {
  return now.toISOString().slice(0, 10)
}

function defaultLimits(plan: ServerUserRecord["plan"]): ServerUserLimits {
  return plan === "pro"
    ? { dailyRequests: 2000, dailyCharacters: 500_000, requestsPerMinute: 120 }
    : { dailyRequests: 100, dailyCharacters: 50_000, requestsPerMinute: 10 }
}

function defaultEntitlements(plan: ServerUserRecord["plan"]): ServerUserRecord["providerEntitlements"] {
  return plan === "pro" ? ["openai", "gemini"] : ["openai"]
}

function createEmptyUsage(now: Date = new Date()): ServerUserUsage {
  return {
    usageDay: getCurrentUsageDay(now),
    requestsToday: 0,
    charactersToday: 0,
    totalRequests: 0,
    totalCharacters: 0,
    lastRequestAt: null,
    recentRequestTimestamps: [],
    recentEvents: [],
  }
}

function createSeedDatabase(env: RelayEnv): ServerUserDatabase {
  return {
    version: 1,
    users: [{
      id: buildUserId(env.loginEmail),
      email: env.loginEmail,
      billingEmail: env.loginEmail,
      createdAt: new Date().toISOString(),
      passwordHash: hashPassword(env.loginPassword),
      plan: env.plan,
      subscriptionStatus: env.subscriptionStatus,
      providerEntitlements: env.providerEntitlements.length ? env.providerEntitlements : defaultEntitlements(env.plan),
      limits: defaultLimits(env.plan),
      usage: createEmptyUsage(),
    }],
  }
}

function buildAccount(user: ServerUserRecord, relayBaseURL: string): AstraAccount {
  return AstraAccountSchema.parse({
    id: user.id,
    relayBaseURL,
    email: user.email,
    billingEmail: user.billingEmail,
    createdAt: user.createdAt,
    plan: user.plan,
    subscriptionStatus: user.subscriptionStatus,
    providerEntitlements: user.providerEntitlements,
  })
}

function buildQuota(user: ServerUserRecord): AstraQuota {
  return AstraQuotaSchema.parse({
    dailyRequestsLimit: user.limits.dailyRequests,
    dailyCharactersLimit: user.limits.dailyCharacters,
    requestsPerMinuteLimit: user.limits.requestsPerMinute,
    remainingDailyRequests: Math.max(0, user.limits.dailyRequests - user.usage.requestsToday),
    remainingDailyCharacters: Math.max(0, user.limits.dailyCharacters - user.usage.charactersToday),
  })
}

function buildUsage(user: ServerUserRecord): AstraUsage {
  return AstraUsageSchema.parse({
    totalRequests: user.usage.totalRequests,
    totalCharacters: user.usage.totalCharacters,
    dailyRequestsUsed: user.usage.requestsToday,
    dailyCharactersUsed: user.usage.charactersToday,
    lastRequestAt: user.usage.lastRequestAt,
    recentEvents: user.usage.recentEvents,
  })
}

function buildSession(user: ServerUserRecord, token: string, relayBaseURL: string): AstraSession {
  return AstraSessionSchema.parse({
    version: 1,
    sessionToken: token,
    relayBaseURL,
    email: user.email,
    plan: user.plan,
    subscriptionStatus: user.subscriptionStatus,
    providerEntitlements: user.providerEntitlements,
    quota: buildQuota(user),
    usage: buildUsage(user),
    expiresAt: null,
  })
}

function buildUsageSnapshot(user: ServerUserRecord, generatedAt: string): AstraUsageSnapshot {
  return AstraUsageSnapshotSchema.parse({
    generatedAt,
    quota: buildQuota(user),
    usage: buildUsage(user),
  })
}

function pruneUsageWindow(usage: ServerUserUsage, now: Date): ServerUserUsage {
  const currentDay = getCurrentUsageDay(now)
  const recentWindow = now.getTime() - 60_000
  const timestamps = usage.recentRequestTimestamps.filter((value) => {
    const time = Date.parse(value)
    return Number.isFinite(time) && time >= recentWindow
  })

  if (usage.usageDay !== currentDay) {
    return {
      ...usage,
      usageDay: currentDay,
      requestsToday: 0,
      charactersToday: 0,
      recentRequestTimestamps: timestamps,
    }
  }

  return {
    ...usage,
    recentRequestTimestamps: timestamps,
  }
}

function assertUsageCapacity(user: ServerUserRecord, usage: ServerUserUsage, characterCount: number) {
  if (user.subscriptionStatus !== "active") {
    throw new AstraError("CONFIG_MISSING", `Subscription is not active: ${user.subscriptionStatus}.`)
  }

  if (usage.recentRequestTimestamps.length >= user.limits.requestsPerMinute) {
    throw new AstraError("PROVIDER_REQUEST_FAILED", "Rate limit exceeded for the current minute.")
  }

  if (usage.requestsToday + 1 > user.limits.dailyRequests) {
    throw new AstraError("PROVIDER_REQUEST_FAILED", "Daily request quota exceeded.")
  }

  if (usage.charactersToday + characterCount > user.limits.dailyCharacters) {
    throw new AstraError("PROVIDER_REQUEST_FAILED", "Daily character quota exceeded.")
  }
}

export class FileUserStore {
  private cache: ServerUserDatabase | null = null

  constructor(private readonly env: RelayEnv) {}

  private async load(): Promise<ServerUserDatabase> {
    if (this.cache) return this.cache

    try {
      const raw = await readFile(this.env.userDbPath, "utf8")
      const parsed = ServerUserDatabaseSchema.parse(JSON.parse(raw))
      const rawNormalized = JSON.stringify(JSON.parse(raw))
      const parsedNormalized = JSON.stringify(parsed)
      if (parsedNormalized !== rawNormalized) {
        await this.save(parsed)
      } else {
        this.cache = parsed
      }
      this.cache = parsed
      return parsed
    } catch {
      const seed = createSeedDatabase(this.env)
      await this.save(seed)
      return seed
    }
  }

  private async save(db: ServerUserDatabase): Promise<void> {
    this.cache = db
    await mkdir(dirname(this.env.userDbPath), { recursive: true })
    await writeFile(this.env.userDbPath, JSON.stringify(db, null, 2))
  }

  async findUserByEmail(email: string): Promise<ServerUserRecord | null> {
    const db = await this.load()
    return db.users.find((user) => user.email === email.trim()) ?? null
  }

  async validateCredentials(email: string, password: string): Promise<ServerUserRecord | null> {
    const user = await this.findUserByEmail(email)
    if (!user) return null
    return user.passwordHash === hashPassword(password) ? user : null
  }

  async getSession(email: string, token: string): Promise<AstraSession | null> {
    const db = await this.load()
    const userIndex = db.users.findIndex((user) => user.email === email.trim())
    if (userIndex === -1) return null

    const user = db.users[userIndex]
    const nextUsage = pruneUsageWindow(user.usage, new Date())
    if (JSON.stringify(nextUsage) !== JSON.stringify(user.usage)) {
      db.users[userIndex] = { ...user, usage: nextUsage }
      await this.save(db)
    }

    return buildSession(db.users[userIndex], token, this.env.publicBaseURL)
  }

  async getAccount(email: string): Promise<AstraAccount | null> {
    const db = await this.load()
    const userIndex = db.users.findIndex((user) => user.email === email.trim())
    if (userIndex === -1) return null

    const user = db.users[userIndex]
    const nextUsage = pruneUsageWindow(user.usage, new Date())
    if (JSON.stringify(nextUsage) !== JSON.stringify(user.usage)) {
      db.users[userIndex] = { ...user, usage: nextUsage }
      await this.save(db)
    }

    return buildAccount(db.users[userIndex], this.env.publicBaseURL)
  }

  async getUsageSnapshot(email: string): Promise<AstraUsageSnapshot | null> {
    const db = await this.load()
    const userIndex = db.users.findIndex((user) => user.email === email.trim())
    if (userIndex === -1) return null

    const user = db.users[userIndex]
    const nextUsage = pruneUsageWindow(user.usage, new Date())
    if (JSON.stringify(nextUsage) !== JSON.stringify(user.usage)) {
      db.users[userIndex] = { ...user, usage: nextUsage }
      await this.save(db)
    }

    return buildUsageSnapshot(db.users[userIndex], new Date().toISOString())
  }

  async updatePlan(email: string, plan: ServerUserRecord["plan"]): Promise<AstraAccount | null> {
    const db = await this.load()
    const userIndex = db.users.findIndex((user) => user.email === email.trim())
    if (userIndex === -1) return null

    const user = db.users[userIndex]
    const nextUsage = pruneUsageWindow(user.usage, new Date())
    db.users[userIndex] = {
      ...user,
      plan,
      subscriptionStatus: "active",
      providerEntitlements: defaultEntitlements(plan),
      limits: defaultLimits(plan),
      usage: nextUsage,
    }
    await this.save(db)

    return buildAccount(db.users[userIndex], this.env.publicBaseURL)
  }

  async assertCanTranslate(params: {
    email: string
    characterCount: number
    timestamp?: Date
  }): Promise<void> {
    const db = await this.load()
    const now = params.timestamp ?? new Date()
    const userIndex = db.users.findIndex((user) => user.email === params.email)
    if (userIndex === -1) {
      throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
    }

    const user = db.users[userIndex]
    const usage = pruneUsageWindow(user.usage, now)
    assertUsageCapacity(user, usage, params.characterCount)
  }

  async recordTranslationUsage(params: {
    email: string
    provider: "openai" | "gemini"
    characterCount: number
    timestamp?: Date
  }): Promise<AstraSession> {
    const db = await this.load()
    const now = params.timestamp ?? new Date()
    const userIndex = db.users.findIndex((user) => user.email === params.email)
    if (userIndex === -1) {
      throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
    }

    const user = db.users[userIndex]
    const usage = pruneUsageWindow(user.usage, now)
    assertUsageCapacity(user, usage, params.characterCount)

    const timestamp = now.toISOString()
    const nextUsage: ServerUserUsage = {
      ...usage,
      requestsToday: usage.requestsToday + 1,
      charactersToday: usage.charactersToday + params.characterCount,
      totalRequests: usage.totalRequests + 1,
      totalCharacters: usage.totalCharacters + params.characterCount,
      lastRequestAt: timestamp,
      recentRequestTimestamps: [...usage.recentRequestTimestamps, timestamp],
      recentEvents: [
        {
          timestamp,
          provider: params.provider,
          requestCount: 1,
          characterCount: params.characterCount,
        },
        ...usage.recentEvents,
      ].slice(0, 10),
    }

    db.users[userIndex] = {
      ...user,
      usage: nextUsage,
    }

    await this.save(db)
    return buildSession(db.users[userIndex], "session-updated", this.env.publicBaseURL)
  }
}
