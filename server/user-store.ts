import { createHash, randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import { z } from "zod"

import {
  AstraAccountSchema,
  AstraAccountSummarySchema,
  AstraPlanSchema,
  AstraQuotaSchema,
  AstraSessionSchema,
  AstraSubscriptionStatusSchema,
  AstraUsageEventSchema,
  AstraUsageSchema,
  AstraUsageSnapshotSchema,
  type AstraAccount,
  type AstraAccountSummary,
  type AstraQuota,
  type AstraUsage,
  type AstraUsageSnapshot,
} from "../src/types/auth"
import { ProviderIdSchema } from "../src/types/config"
import { AstraError } from "../src/types/translation"
import { isSyncCollectionEnabled, validateSyncMutationPayload } from "../src/utils/astra/sync-push"
import { buildAstraAnonymousIdentity } from "../src/utils/astra/anonymous-identity"
import {
  hashAstraCredentialSecret,
  verifyAstraCredentialSecret,
} from "../src/utils/astra/credential-hash"

import { buildRelaySession, issueSession, verifySessionToken } from "./auth"
import { createRelayCloudflareShadowBridge } from "./cloudflare-shadow"
import type {
  AuthenticatedSession,
  DeviceListEntry,
  DeviceMetadataInput,
  DeviceStatus,
  IdentityMode,
  MirroredAnonymousIssueInput,
  MirroredAuthenticatedIssueInput,
  RelayEnv,
  RelaySession,
  ServerDeviceRecord,
  ServerSessionRecord,
  ServerSyncMutationRecord,
  ServerUserLimits,
  ServerUserRecord,
  ServerUserSyncPreferences,
  ServerUserUsage,
  SyncBootstrapResponse,
  SyncCollection,
  SyncMutationAck,
  SyncMutationInput,
  SyncMutationRejection,
  SyncPullResponse,
  SyncPushResponse,
} from "./types"
import { SYNC_COLLECTIONS } from "./types"

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

const IdentityModeSchema = z.enum(["anonymous", "authenticated"]).default("authenticated")
const DeviceStatusSchema = z.enum(["active", "revoked"]).default("active")
const SessionStatusSchema = z.enum(["active", "revoked"]).default("active")
const SyncCollectionSchema = z.enum(SYNC_COLLECTIONS)
const SyncOperationSchema = z.enum(["upsert", "delete"])

const ServerUserSyncPreferencesSchema = z.object({
  reading_history: z.boolean().default(false),
  study_progress: z.boolean().default(false),
})

function createDefaultSyncPreferences(): ServerUserSyncPreferences {
  return {
    reading_history: false,
    study_progress: false,
  }
}

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
  identityMode: IdentityModeSchema,
  syncPreferences: ServerUserSyncPreferencesSchema.default(createDefaultSyncPreferences()),
  installId: z.string().trim().min(1).optional(),
}).transform((record) => ({
  ...record,
  id: record.id ?? buildUserId(record.email),
  billingEmail: record.billingEmail ?? record.email,
  createdAt: record.createdAt ?? new Date().toISOString(),
}))

const ServerDeviceRecordSchema = z.object({
  deviceId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  email: z.string().trim().min(1),
  identityMode: IdentityModeSchema,
  label: z.string().trim().min(1),
  platform: z.string().trim().min(1).nullable(),
  browserFamily: z.string().trim().min(1).nullable(),
  appKind: z.string().trim().min(1),
  appVersion: z.string().trim().min(1).nullable(),
  firstSeenAt: z.string().trim().min(1),
  lastSeenAt: z.string().trim().min(1),
  lastSyncAt: z.string().trim().min(1).nullable(),
  status: DeviceStatusSchema,
  updatedAt: z.string().trim().min(1),
  revokedAt: z.string().trim().min(1).nullable(),
})

const ServerSessionRecordSchema = z.object({
  sessionId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  email: z.string().trim().min(1),
  deviceId: z.string().trim().min(1),
  identityMode: IdentityModeSchema,
  issuedAt: z.string().trim().min(1),
  expiresAt: z.string().trim().min(1).nullable(),
  createdAt: z.string().trim().min(1),
  lastSeenAt: z.string().trim().min(1),
  lastVerifiedAt: z.string().trim().min(1).nullable(),
  status: SessionStatusSchema,
  revokedAt: z.string().trim().min(1).nullable(),
})

const ServerSyncMutationRecordSchema = z.object({
  ownerId: z.string().trim().min(1),
  email: z.string().trim().min(1),
  serverMutationId: z.string().trim().min(1),
  serverUpdatedAt: z.string().trim().min(1),
  cursor: z.string().trim().min(1),
  collection: SyncCollectionSchema,
  schemaVersion: z.number().int().positive(),
  recordId: z.string().trim().min(1),
  operation: SyncOperationSchema,
  clientMutationId: z.string().trim().min(1),
  deviceId: z.string().trim().min(1),
  clientUpdatedAt: z.string().trim().min(1),
  payload: z.record(z.string(), z.unknown()).nullable().optional(),
})

const LegacyServerUserDatabaseSchema = z.object({
  version: z.literal(1),
  users: z.array(ServerUserRecordSchema),
})

const ServerUserDatabaseSchema = z.object({
  version: z.literal(2),
  users: z.array(ServerUserRecordSchema),
  devices: z.array(ServerDeviceRecordSchema).default([]),
  sessions: z.array(ServerSessionRecordSchema).default([]),
  syncMutations: z.array(ServerSyncMutationRecordSchema).default([]),
  nextSyncCursor: z.number().int().nonnegative().default(0),
})

export type ServerUserDatabase = z.infer<typeof ServerUserDatabaseSchema>

type SessionContext = {
  user: ServerUserRecord
  session: ServerSessionRecord
  device: ServerDeviceRecord | null
}

function buildUserId(email: string): string {
  return `usr_${createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 12)}`
}

function getCurrentUsageDay(now: Date): string {
  return now.toISOString().slice(0, 10)
}

function defaultLimits(plan: ServerUserRecord["plan"], env?: RelayEnv): ServerUserLimits {
  if (env) {
    return plan === "pro"
      ? { dailyRequests: env.proDailyRequests, dailyCharacters: env.proDailyCharacters, requestsPerMinute: env.proRpm }
      : { dailyRequests: env.freeDailyRequests, dailyCharacters: env.freeDailyCharacters, requestsPerMinute: env.freeRpm }
  }
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

async function createSeedDatabase(env: RelayEnv): Promise<ServerUserDatabase> {
  return {
    version: 2,
    users: [{
      id: buildUserId(env.loginEmail),
      email: env.loginEmail,
      billingEmail: env.loginEmail,
      createdAt: new Date().toISOString(),
      passwordHash: await hashAstraCredentialSecret(env.loginPassword),
      plan: env.plan,
      subscriptionStatus: env.subscriptionStatus,
      providerEntitlements: env.providerEntitlements.length ? env.providerEntitlements : defaultEntitlements(env.plan),
      limits: defaultLimits(env.plan, env),
      usage: createEmptyUsage(),
      identityMode: "authenticated",
      syncPreferences: createDefaultSyncPreferences(),
    }],
    devices: [],
    sessions: [],
    syncMutations: [],
    nextSyncCursor: 0,
  }
}

async function migrateDatabase(
  raw: unknown,
  env: RelayEnv,
  options: {
    seedOnInvalid?: boolean
  } = {},
): Promise<ServerUserDatabase> {
  const legacy = LegacyServerUserDatabaseSchema.safeParse(raw)
  if (legacy.success) {
    return {
      version: 2,
      users: legacy.data.users,
      devices: [],
      sessions: [],
      syncMutations: [],
      nextSyncCursor: 0,
    }
  }

  const current = ServerUserDatabaseSchema.safeParse(raw)
  if (current.success) {
    return current.data
  }

  if (options.seedOnInvalid ?? true) {
    return createSeedDatabase(env)
  }

  throw new Error("Authoritative user database has an invalid or unsupported shape.")
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

function buildUsageSnapshot(user: ServerUserRecord, generatedAt: string): AstraUsageSnapshot {
  return AstraUsageSnapshotSchema.parse({
    generatedAt,
    quota: buildQuota(user),
    usage: buildUsage(user),
  })
}

function buildDeviceListEntries(
  db: ServerUserDatabase,
  email: string,
  currentDeviceId?: string,
  identityMode?: IdentityMode,
): DeviceListEntry[] {
  return db.devices
    .filter((device) => device.email === email.trim() && (!identityMode || device.identityMode === identityMode))
    .sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt))
    .map((device) => ({
      deviceId: device.deviceId,
      label: device.label,
      platform: device.platform,
      browserFamily: device.browserFamily,
      appKind: device.appKind,
      appVersion: device.appVersion,
      firstSeenAt: device.firstSeenAt,
      lastSeenAt: device.lastSeenAt,
      lastSyncAt: device.lastSyncAt,
      status: device.status,
      isCurrentDevice: currentDeviceId === device.deviceId,
    }))
}

function countActiveSyncRecords(mutations: ServerSyncMutationRecord[]): number {
  const activeRecordIds = new Set<string>()
  for (const mutation of mutations) {
    if (mutation.operation === "delete") {
      activeRecordIds.delete(mutation.recordId)
      continue
    }
    activeRecordIds.add(mutation.recordId)
  }
  return activeRecordIds.size
}

function resolveSessionSummaryStatus(
  session: ServerSessionRecord,
  now: Date,
): "active" | "revoked" | "expired" {
  if (session.status === "revoked" || session.revokedAt) {
    return "revoked"
  }
  if (isSessionExpired(session.expiresAt, now)) {
    return "expired"
  }
  return "active"
}

function buildSyncCollectionSummaries(
  db: ServerUserDatabase,
  user: ServerUserRecord,
): AstraAccountSummary["sync"]["collections"] {
  return {
    config: buildSyncCollectionSummary(db, user, "config"),
    vocabulary: buildSyncCollectionSummary(db, user, "vocabulary"),
    reading_history: buildSyncCollectionSummary(db, user, "reading_history"),
    study_progress: buildSyncCollectionSummary(db, user, "study_progress"),
  }
}

function buildSyncCollectionSummary(
  db: ServerUserDatabase,
  user: ServerUserRecord,
  collection: SyncCollection,
): AstraAccountSummary["sync"]["collections"][SyncCollection] {
  const mutations = db.syncMutations
    .filter((mutation) => mutation.email === user.email && mutation.collection === collection)
    .sort((a, b) => parseCursor(a.cursor) - parseCursor(b.cursor))
  const latestMutation = mutations.at(-1) ?? null
  const defaultEnabled = collection === "config" || collection === "vocabulary"
  const enabled = collection === "reading_history"
    ? user.syncPreferences.reading_history
    : collection === "study_progress"
      ? user.syncPreferences.study_progress
      : true

  return {
    enabled,
    defaultEnabled,
    cursor: latestMutation?.cursor ?? null,
    mutationCount: mutations.length,
    activeCount: countActiveSyncRecords(mutations),
    lastSyncAt: latestMutation?.serverUpdatedAt ?? null,
    compactionFloorCursor: null,
  }
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

function coerceNullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function capitalize(value: string): string {
  return value.length ? `${value[0]!.toUpperCase()}${value.slice(1)}` : value
}

function buildDefaultDeviceLabel(device: DeviceMetadataInput): string {
  const browser = coerceNullableText(device.browserFamily)
  const platform = coerceNullableText(device.platform)
  if (browser && platform) {
    return `${capitalize(browser)} on ${capitalize(platform)}`
  }
  if (browser) return capitalize(browser)
  if (platform) return capitalize(platform)
  return device.appKind?.trim() === "web" ? "Astra web" : "Astra extension"
}

function buildCursorMap(value: string | null = null): Record<SyncCollection, string | null> {
  return {
    config: value,
    vocabulary: value,
    reading_history: value,
    study_progress: value,
  }
}

function parseCursor(cursor: string | null | undefined): number {
  if (!cursor) return 0
  const parsed = Number(cursor)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

export function isSessionExpired(expiresAt: string | null, now: Date = new Date()): boolean {
  if (!expiresAt) return false
  const time = Date.parse(expiresAt)
  return Number.isFinite(time) && time <= now.getTime()
}

export async function loadAuthoritativeUserDatabase(
  env: RelayEnv,
  options: {
    seedIfMissing?: boolean
    persistNormalized?: boolean
  } = {},
): Promise<ServerUserDatabase> {
  const seedIfMissing = options.seedIfMissing ?? true
  const persistNormalized = options.persistNormalized ?? true

  try {
    const raw = await readFile(env.userDbPath, "utf8")
    const parsedJson = JSON.parse(raw)
    const parsed = await migrateDatabase(parsedJson, env, {
      seedOnInvalid: seedIfMissing,
    })

    if (persistNormalized) {
      const rawNormalized = JSON.stringify(parsedJson)
      const parsedNormalized = JSON.stringify(parsed)
      if (parsedNormalized !== rawNormalized) {
        await saveAuthoritativeUserDatabase(env, parsed)
      }
    }

    return parsed
  } catch (error) {
    if (seedIfMissing) {
      const seed = await createSeedDatabase(env)
      await saveAuthoritativeUserDatabase(env, seed)
      return seed
    }

    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Unable to load authoritative user database at ${env.userDbPath}: ${detail}`)
  }
}

export async function saveAuthoritativeUserDatabase(
  env: RelayEnv,
  db: ServerUserDatabase,
): Promise<void> {
  await mkdir(dirname(env.userDbPath), { recursive: true })
  await writeFile(env.userDbPath, JSON.stringify(db, null, 2))
}

export class FileUserStore {
  private cache: ServerUserDatabase | null = null
  private readonly cloudflareShadow

  constructor(private readonly env: RelayEnv) {
    this.cloudflareShadow = createRelayCloudflareShadowBridge(env)
  }

  private async load(): Promise<ServerUserDatabase> {
    if (this.cache) return this.cache

    const parsed = await loadAuthoritativeUserDatabase(this.env)
    this.cache = parsed
    return parsed
  }

  private async save(db: ServerUserDatabase): Promise<void> {
    this.cache = db
    await saveAuthoritativeUserDatabase(this.env, db)
  }

  private refreshUserUsage(db: ServerUserDatabase, email: string, now: Date): { user: ServerUserRecord; changed: boolean } | null {
    const userIndex = db.users.findIndex((user) => user.email === email.trim())
    if (userIndex === -1) return null

    const user = db.users[userIndex]
    const nextUsage = pruneUsageWindow(user.usage, now)
    const changed = JSON.stringify(nextUsage) !== JSON.stringify(user.usage)
    if (changed) {
      db.users[userIndex] = { ...user, usage: nextUsage }
    }

    return { user: db.users[userIndex], changed }
  }

  private upsertDevice(
    db: ServerUserDatabase,
    user: ServerUserRecord,
    identityMode: IdentityMode,
    device: DeviceMetadataInput,
    now: Date,
    options: { reactivate?: boolean } = {},
  ): ServerDeviceRecord {
    const timestamp = now.toISOString()
    const existingIndex = db.devices.findIndex((record) =>
      record.email === user.email && record.deviceId === device.deviceId,
    )

    const label = coerceNullableText(device.label) ?? (existingIndex >= 0 ? db.devices[existingIndex]!.label : buildDefaultDeviceLabel(device))
    const platform = coerceNullableText(device.platform)
    const browserFamily = coerceNullableText(device.browserFamily)
    const appKind = coerceNullableText(device.appKind) ?? (existingIndex >= 0 ? db.devices[existingIndex]!.appKind : "extension")
    const appVersion = coerceNullableText(device.appVersion)

    if (existingIndex >= 0) {
      const existing = db.devices[existingIndex]!
      const status: DeviceStatus = options.reactivate ? "active" : existing.status
      const next: ServerDeviceRecord = {
        ...existing,
        identityMode,
        label,
        platform: platform ?? existing.platform,
        browserFamily: browserFamily ?? existing.browserFamily,
        appKind,
        appVersion: appVersion ?? existing.appVersion,
        lastSeenAt: timestamp,
        updatedAt: timestamp,
        status,
        revokedAt: status === "revoked" ? existing.revokedAt : null,
      }
      db.devices[existingIndex] = next
      return next
    }

    const record: ServerDeviceRecord = {
      deviceId: device.deviceId,
      userId: user.id,
      email: user.email,
      identityMode,
      label,
      platform,
      browserFamily,
      appKind,
      appVersion,
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      lastSyncAt: null,
      status: options.reactivate ? "active" : "active",
      updatedAt: timestamp,
      revokedAt: null,
    }
    db.devices.push(record)
    return record
  }

  private upsertMirroredDevice(
    db: ServerUserDatabase,
    device: ServerDeviceRecord,
  ): ServerDeviceRecord {
    const existingIndex = db.devices.findIndex((record) => record.deviceId === device.deviceId)
    const next = ServerDeviceRecordSchema.parse(device)
    if (existingIndex >= 0) {
      db.devices[existingIndex] = next
      return next
    }

    db.devices.push(next)
    return next
  }

  private upsertMirroredSession(
    db: ServerUserDatabase,
    session: ServerSessionRecord,
  ): ServerSessionRecord {
    const existingIndex = db.sessions.findIndex((record) => record.sessionId === session.sessionId)
    const next = ServerSessionRecordSchema.parse(session)
    if (existingIndex >= 0) {
      db.sessions[existingIndex] = next
      return next
    }

    db.sessions.push(next)
    return next
  }

  private nextSyncCursor(db: ServerUserDatabase): string {
    db.nextSyncCursor += 1
    return String(db.nextSyncCursor)
  }

  private getLatestCursor(db: ServerUserDatabase, email: string, collection: SyncCollection): string | null {
    const latest = db.syncMutations
      .filter((mutation) => mutation.email === email && mutation.collection === collection)
      .sort((a, b) => parseCursor(b.cursor) - parseCursor(a.cursor))[0]
    return latest?.cursor ?? null
  }

  async findUserByEmail(email: string): Promise<ServerUserRecord | null> {
    const db = await this.load()
    return db.users.find((user) => user.email === email.trim()) ?? null
  }

  async findAnonymousUserByInstallId(installId: string): Promise<ServerUserRecord | null> {
    const db = await this.load()
    return db.users.find(
      (user) => user.identityMode === "anonymous" && user.installId === installId,
    ) ?? null
  }

  async createAnonymousUser(installId?: string): Promise<ServerUserRecord> {
    if (installId) {
      const existing = await this.findAnonymousUserByInstallId(installId)
      if (existing) return existing
    }

    const db = await this.load()
    const identity = await buildAstraAnonymousIdentity({
      installId,
      entropy: installId ? undefined : randomUUID(),
    })

    const plan = "free" as const
    const record: ServerUserRecord = {
      id: identity.userId,
      email: identity.email,
      billingEmail: identity.email,
      createdAt: new Date().toISOString(),
      passwordHash: await hashAstraCredentialSecret(identity.placeholderPassword),
      plan,
      subscriptionStatus: "active",
      providerEntitlements: defaultEntitlements(plan),
      limits: defaultLimits(plan, this.env),
      usage: createEmptyUsage(),
      identityMode: "anonymous",
      syncPreferences: createDefaultSyncPreferences(),
      ...(installId ? { installId } : {}),
    }

    db.users.push(record)
    await this.save(db)
    return record
  }

  async validateCredentials(email: string, password: string): Promise<ServerUserRecord | null> {
    const user = await this.findUserByEmail(email)
    if (!user) return null
    const valid = await verifyAstraCredentialSecret(password, user.passwordHash)
    if (!valid) return null
    await this.cloudflareShadow?.mirrorUserCredential(user)
    return user
  }

  async issueBoundSession(params: {
    user: ServerUserRecord
    identityMode?: IdentityMode
    device: DeviceMetadataInput
    now?: Date
  }): Promise<AuthenticatedSession> {
    const db = await this.load()
    const now = params.now ?? new Date()
    const timestamp = now.toISOString()
    const identityMode = params.identityMode ?? params.user.identityMode
    const device = this.upsertDevice(db, params.user, identityMode, params.device, now, {
      reactivate: identityMode === "authenticated",
    })

    const sessionRecord: ServerSessionRecord = {
      sessionId: randomUUID(),
      userId: params.user.id,
      email: params.user.email,
      deviceId: device.deviceId,
      identityMode,
      issuedAt: timestamp,
      expiresAt: this.env.sessionTtlMs > 0 ? new Date(now.getTime() + this.env.sessionTtlMs).toISOString() : null,
      createdAt: timestamp,
      lastSeenAt: timestamp,
      lastVerifiedAt: timestamp,
      status: "active",
      revokedAt: null,
    }

    db.sessions.push(sessionRecord)
    await this.save(db)

    const issued = await issueSession(params.user, sessionRecord, this.env)
    await this.cloudflareShadow?.mirrorIssuedSession({
      user: params.user,
      device,
      session: sessionRecord,
      token: issued.token,
    })

    return issued
  }

  async getSessionContext(email: string, sessionId: string): Promise<SessionContext | null> {
    const db = await this.load()
    const refreshed = this.refreshUserUsage(db, email, new Date())
    if (!refreshed) return null

    const session = db.sessions.find((record) => record.email === email.trim() && record.sessionId === sessionId) ?? null
    if (!session) {
      if (refreshed.changed) await this.save(db)
      return null
    }

    const device = db.devices.find((record) => record.email === email.trim() && record.deviceId === session.deviceId) ?? null
    if (refreshed.changed) await this.save(db)

    const context = {
      user: refreshed.user,
      session,
      device,
    }
    if (refreshed.changed) {
      await this.cloudflareShadow?.mirrorUserUsage(refreshed.user, new Date().toISOString())
    }
    await this.cloudflareShadow?.compareSessionLookup(context)
    return context
  }

  async touchSession(
    sessionId: string,
    params: {
      seenAt?: Date
      syncAt?: Date
    } = {},
  ): Promise<void> {
    const db = await this.load()
    const sessionIndex = db.sessions.findIndex((record) => record.sessionId === sessionId)
    if (sessionIndex === -1) return

    const session = db.sessions[sessionIndex]!
    const seenAt = params.seenAt?.toISOString()
    const syncAt = params.syncAt?.toISOString()
    const nextSession: ServerSessionRecord = {
      ...session,
      lastSeenAt: seenAt ?? session.lastSeenAt,
      lastVerifiedAt: seenAt ?? session.lastVerifiedAt,
    }
    db.sessions[sessionIndex] = nextSession

    const deviceIndex = db.devices.findIndex((record) => record.email === session.email && record.deviceId === session.deviceId)
    if (deviceIndex >= 0) {
      const device = db.devices[deviceIndex]!
      db.devices[deviceIndex] = {
        ...device,
        lastSeenAt: seenAt ?? device.lastSeenAt,
        lastSyncAt: syncAt ?? device.lastSyncAt,
        updatedAt: seenAt ?? syncAt ?? device.updatedAt,
      }
    }

    await this.save(db)

    const user = db.users.find((record) => record.id === session.userId) ?? null
    const nextDevice = db.devices.find((record) => record.email === session.email && record.deviceId === session.deviceId) ?? null
    if (user) {
      await this.cloudflareShadow?.mirrorTouchedSession({
        user,
        device: nextDevice,
        session: nextSession,
      })
    }
  }

  async revokeSession(email: string, sessionId: string, now: Date = new Date()): Promise<boolean> {
    const db = await this.load()
    const sessionIndex = db.sessions.findIndex((record) =>
      record.email === email.trim() && record.sessionId === sessionId,
    )
    if (sessionIndex === -1) return false

    const timestamp = now.toISOString()
    db.sessions[sessionIndex] = {
      ...db.sessions[sessionIndex]!,
      status: "revoked",
      revokedAt: timestamp,
      lastVerifiedAt: timestamp,
    }
    await this.save(db)

    const user = db.users.find((record) => record.email === email.trim()) ?? null
    if (user) {
      await this.cloudflareShadow?.mirrorRevokedSession({
        user,
        session: db.sessions[sessionIndex]!,
      })
    }

    return true
  }

  async revokeDevice(
    email: string,
    deviceId: string,
    now: Date = new Date(),
  ): Promise<{ found: boolean; revokedSessionCount: number }> {
    const db = await this.load()
    const deviceIndex = db.devices.findIndex((record) =>
      record.email === email.trim()
      && record.deviceId === deviceId
      && record.identityMode === "authenticated",
    )

    if (deviceIndex === -1) {
      return { found: false, revokedSessionCount: 0 }
    }

    const timestamp = now.toISOString()
    const existingDevice = db.devices[deviceIndex]!
    db.devices[deviceIndex] = {
      ...existingDevice,
      status: "revoked",
      revokedAt: existingDevice.revokedAt ?? timestamp,
      updatedAt: timestamp,
    }

    let revokedSessionCount = 0
    db.sessions = db.sessions.map((record) => {
      if (record.email !== email.trim() || record.deviceId !== deviceId) {
        return record
      }

      if (record.status !== "revoked") {
        revokedSessionCount += 1
      }

      return {
        ...record,
        status: "revoked",
        revokedAt: record.revokedAt ?? timestamp,
        lastVerifiedAt: timestamp,
      }
    })

    await this.save(db)

    const user = db.users.find((record) => record.email === email.trim()) ?? null
    if (user) {
      const revokedDevice = db.devices[deviceIndex]!
      const revokedSessions = db.sessions.filter((record) =>
        record.email === email.trim() && record.deviceId === deviceId,
      )
      await this.cloudflareShadow?.mirrorRevokedDevice({
        user,
        device: revokedDevice,
        sessions: revokedSessions,
      })
    }

    return {
      found: true,
      revokedSessionCount,
    }
  }

  async listDevices(email: string, currentDeviceId?: string): Promise<DeviceListEntry[]> {
    const db = await this.load()
    const devices = buildDeviceListEntries(db, email, currentDeviceId, "authenticated")

    const user = db.users.find((record) => record.email === email.trim()) ?? null
    if (user) {
      await this.cloudflareShadow?.compareDeviceList({
        user,
        currentDeviceId,
        devices,
      })
    }

    return devices
  }

  async getSession(email: string, token: string): Promise<RelaySession | null> {
    const claims = await verifySessionToken(token, this.env)
    if (!claims || claims.email !== email.trim()) return null

    const context = await this.getSessionContext(email, claims.sessionId)
    if (!context || context.session.status !== "active" || !context.device || context.device.status !== "active") {
      return null
    }

    if (context.session.deviceId !== claims.deviceId || isSessionExpired(context.session.expiresAt)) {
      return null
    }

    return buildRelaySession(context.user, token, context.session, this.env.sessionPublicBaseURL)
  }

  async upsertMirroredAuthenticatedIssue(
    params: MirroredAuthenticatedIssueInput,
  ): Promise<{ user: ServerUserRecord; device: ServerDeviceRecord; session: ServerSessionRecord }> {
    const db = await this.load()
    const user = db.users.find((record) => record.id === params.userId) ?? null
    if (!user || user.email !== params.email.trim()) {
      throw new Error(`Authenticated mirror-back user was not found: ${params.userId}`)
    }
    if (params.device.userId !== user.id || params.device.email !== user.email) {
      throw new Error("Authenticated mirror-back device does not match the authoritative user.")
    }
    if (
      params.session.userId !== user.id
      || params.session.email !== user.email
      || params.session.deviceId !== params.device.deviceId
    ) {
      throw new Error("Authenticated mirror-back session does not match the authoritative user/device.")
    }

    const device = this.upsertMirroredDevice(db, params.device)
    const session = this.upsertMirroredSession(db, params.session)
    await this.save(db)

    return { user, device, session }
  }

  async upsertMirroredAnonymousIssue(
    params: MirroredAnonymousIssueInput,
  ): Promise<{ user: ServerUserRecord; device: ServerDeviceRecord; session: ServerSessionRecord }> {
    const db = await this.load()
    const parsedUser = ServerUserRecordSchema.parse(params.user)
    const existingById = db.users.find((record) => record.id === parsedUser.id) ?? null
    const conflictingInstallUser = parsedUser.installId
      ? db.users.find((record) =>
          record.identityMode === "anonymous"
          && record.installId === parsedUser.installId
          && record.id !== parsedUser.id,
        ) ?? null
      : null

    if (conflictingInstallUser) {
      throw new Error(
        `Anonymous mirror-back installId already belongs to ${conflictingInstallUser.id}: ${parsedUser.installId}`,
      )
    }

    const user = existingById ?? parsedUser
    if (!existingById) {
      db.users.push(user)
    }

    if (params.device.userId !== user.id || params.device.email !== user.email) {
      throw new Error("Anonymous mirror-back device does not match the mirrored user.")
    }
    if (
      params.session.userId !== user.id
      || params.session.email !== user.email
      || params.session.deviceId !== params.device.deviceId
    ) {
      throw new Error("Anonymous mirror-back session does not match the mirrored user/device.")
    }

    const device = this.upsertMirroredDevice(db, params.device)
    const session = this.upsertMirroredSession(db, params.session)
    await this.save(db)

    return { user, device, session }
  }

  async getAccount(email: string): Promise<AstraAccount | null> {
    const db = await this.load()
    const refreshed = this.refreshUserUsage(db, email, new Date())
    if (!refreshed) return null
    if (refreshed.changed) await this.save(db)
    if (refreshed.changed) {
      await this.cloudflareShadow?.mirrorUserUsage(refreshed.user, new Date().toISOString())
    }
    return buildAccount(refreshed.user, this.env.publicBaseURL)
  }

  async getUsageSnapshot(email: string): Promise<AstraUsageSnapshot | null> {
    const db = await this.load()
    const refreshed = this.refreshUserUsage(db, email, new Date())
    if (!refreshed) return null
    if (refreshed.changed) await this.save(db)
    if (refreshed.changed) {
      await this.cloudflareShadow?.mirrorUserUsage(refreshed.user, new Date().toISOString())
    }
    return buildUsageSnapshot(refreshed.user, new Date().toISOString())
  }

  async getAccountSummary(params: {
    email: string
    currentDeviceId?: string
    currentSessionId?: string
    serverTime?: string
  }): Promise<AstraAccountSummary | null> {
    const db = await this.load()
    const now = params.serverTime ? new Date(params.serverTime) : new Date()
    const refreshed = this.refreshUserUsage(db, params.email, now)
    if (!refreshed) return null
    if (refreshed.changed) await this.save(db)
    if (refreshed.changed) {
      await this.cloudflareShadow?.mirrorUserUsage(refreshed.user, now.toISOString())
    }

    const identityMode = db.sessions.find((session) =>
      session.email === params.email.trim() && session.sessionId === params.currentSessionId,
    )?.identityMode ?? refreshed.user.identityMode
    const devices = buildDeviceListEntries(db, params.email, params.currentDeviceId, identityMode)
    const currentSession = params.currentSessionId
      ? (db.sessions.find((session) =>
          session.email === params.email.trim() && session.sessionId === params.currentSessionId,
        ) ?? null)
      : null

    return AstraAccountSummarySchema.parse({
      serverTime: now.toISOString(),
      account: buildAccount(refreshed.user, this.env.publicBaseURL),
      usage: buildUsageSnapshot(refreshed.user, now.toISOString()),
      session: {
        sessionId: currentSession?.sessionId ?? null,
        deviceId: currentSession?.deviceId ?? params.currentDeviceId ?? null,
        issuedAt: currentSession?.issuedAt ?? null,
        expiresAt: currentSession?.expiresAt ?? null,
        identityMode,
        status: currentSession ? resolveSessionSummaryStatus(currentSession, now) : "revoked",
      },
      devices: {
        activeCount: devices.filter((device) => device.status === "active").length,
        revokedCount: devices.filter((device) => device.status === "revoked").length,
        current: devices.find((device) => device.isCurrentDevice) ?? null,
        entries: devices,
      },
      sync: {
        maxMutationsPerRequest: this.env.syncMaxMutationsPerRequest,
        collections: buildSyncCollectionSummaries(db, refreshed.user),
      },
    })
  }

  async updatePlan(email: string, plan: ServerUserRecord["plan"]): Promise<AstraAccount | null> {
    const db = await this.load()
    const userIndex = db.users.findIndex((user) => user.email === email.trim())
    if (userIndex === -1) return null

    const user = db.users[userIndex]!
    const nextUsage = pruneUsageWindow(user.usage, new Date())
    db.users[userIndex] = {
      ...user,
      plan,
      subscriptionStatus: "active",
      providerEntitlements: defaultEntitlements(plan),
      limits: defaultLimits(plan, this.env),
      usage: nextUsage,
    }
    await this.save(db)
    await this.cloudflareShadow?.mirrorUserUsage(db.users[userIndex]!, new Date().toISOString())
    await this.cloudflareShadow?.mirrorSyncPreferences(db.users[userIndex]!, new Date().toISOString())

    return buildAccount(db.users[userIndex]!, this.env.publicBaseURL)
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

    const user = db.users[userIndex]!
    const usage = pruneUsageWindow(user.usage, now)
    assertUsageCapacity(user, usage, params.characterCount)
  }

  async recordTranslationUsage(params: {
    email: string
    provider: "openai" | "gemini"
    characterCount: number
    timestamp?: Date
  }): Promise<RelaySession> {
    const db = await this.load()
    const now = params.timestamp ?? new Date()
    const userIndex = db.users.findIndex((user) => user.email === params.email)
    if (userIndex === -1) {
      throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
    }

    const user = db.users[userIndex]!
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
    await this.cloudflareShadow?.mirrorUserUsage(db.users[userIndex]!, timestamp)
    const syntheticSession: ServerSessionRecord = {
      sessionId: "session-updated",
      userId: db.users[userIndex]!.id,
      email: db.users[userIndex]!.email,
      deviceId: "unknown-device",
      identityMode: db.users[userIndex]!.identityMode,
      issuedAt: timestamp,
      expiresAt: null,
      createdAt: timestamp,
      lastSeenAt: timestamp,
      lastVerifiedAt: timestamp,
      status: "active",
      revokedAt: null,
    }
    return buildRelaySession(
      db.users[userIndex]!,
      "session-updated",
      syntheticSession,
      this.env.sessionPublicBaseURL,
    )
  }

  async updateSyncCollectionPreference(
    email: string,
    collection: "reading_history" | "study_progress",
    enabled: boolean,
  ): Promise<ServerUserSyncPreferences | null> {
    const db = await this.load()
    const userIndex = db.users.findIndex((record) => record.email === email.trim())
    if (userIndex === -1) return null

    const user = db.users[userIndex]!
    const syncPreferences = {
      ...createDefaultSyncPreferences(),
      ...user.syncPreferences,
      [collection]: enabled,
    }

    db.users[userIndex] = {
      ...user,
      syncPreferences,
    }
    await this.save(db)
    await this.cloudflareShadow?.mirrorSyncPreferences(db.users[userIndex]!, new Date().toISOString())
    return syncPreferences
  }

  async getSyncBootstrap(email: string, deviceId: string): Promise<SyncBootstrapResponse> {
    const db = await this.load()
    const user = db.users.find((record) => record.email === email.trim())
    if (!user) {
      throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
    }

    const bootstrap = {
      serverTime: new Date().toISOString(),
      deviceId,
      collections: {
        config: {
          enabled: true,
          defaultEnabled: true,
          cursor: this.getLatestCursor(db, email, "config"),
        },
        vocabulary: {
          enabled: true,
          defaultEnabled: true,
          cursor: this.getLatestCursor(db, email, "vocabulary"),
        },
        reading_history: {
          enabled: user.syncPreferences.reading_history,
          defaultEnabled: false,
          cursor: this.getLatestCursor(db, email, "reading_history"),
        },
        study_progress: {
          enabled: user.syncPreferences.study_progress,
          defaultEnabled: false,
          cursor: this.getLatestCursor(db, email, "study_progress"),
        },
      },
      limits: {
        maxMutationsPerRequest: this.env.syncMaxMutationsPerRequest,
      },
      transport: {
        deviceHeader: "X-Astra-Device-Id",
        idempotencyKey: "clientMutationId",
        cursorMode: "per-collection",
      },
    } satisfies SyncBootstrapResponse

    await this.cloudflareShadow?.compareSyncBootstrap({
      user,
      bootstrap,
      maxMutationsPerRequest: this.env.syncMaxMutationsPerRequest,
    })

    return bootstrap
  }

  async pushSyncMutations(
    email: string,
    deviceId: string,
    mutations: SyncMutationInput[],
    now: Date = new Date(),
  ): Promise<SyncPushResponse> {
    const db = await this.load()
    const user = db.users.find((record) => record.email === email.trim())
    if (!user) {
      throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
    }

    const accepted: SyncMutationAck[] = []
    const rejected: SyncMutationRejection[] = []
    const timestamp = now.toISOString()

    for (const mutation of mutations) {
      if (mutation.deviceId !== deviceId) {
        rejected.push({
          collection: mutation.collection,
          clientMutationId: mutation.clientMutationId,
          code: "DEVICE_MISMATCH",
          message: "Sync mutation deviceId must match the authenticated device.",
        })
        continue
      }

      if (mutation.schemaVersion !== 1) {
        rejected.push({
          collection: mutation.collection,
          clientMutationId: mutation.clientMutationId,
          code: "SCHEMA_VERSION_UNSUPPORTED",
          message: `Unsupported sync schemaVersion: ${mutation.schemaVersion}.`,
        })
        continue
      }

      const existing = db.syncMutations.find((record) =>
        record.email === email.trim() && record.clientMutationId === mutation.clientMutationId,
      )
      if (existing) {
        accepted.push({
          collection: existing.collection,
          clientMutationId: existing.clientMutationId,
          recordId: existing.recordId,
          operation: existing.operation,
          serverUpdatedAt: existing.serverUpdatedAt,
          cursor: existing.cursor,
          deduped: true,
        })
        continue
      }

      const validated = validateSyncMutationPayload(user.syncPreferences, mutation)
      if ("code" in validated) {
        rejected.push(validated)
        continue
      }

      const stored: ServerSyncMutationRecord = {
        ownerId: user.id,
        email: user.email,
        serverMutationId: randomUUID(),
        serverUpdatedAt: timestamp,
        cursor: this.nextSyncCursor(db),
        ...validated,
      }
      db.syncMutations.push(stored)
      accepted.push({
        collection: stored.collection,
        clientMutationId: stored.clientMutationId,
        recordId: stored.recordId,
        operation: stored.operation,
        serverUpdatedAt: stored.serverUpdatedAt,
        cursor: stored.cursor,
        deduped: false,
      })
    }

    await this.save(db)

    if (accepted.length > 0) {
      const acceptedMutationIds = new Set(accepted.map((entry) => entry.clientMutationId))
      const storedMutations = db.syncMutations.filter((record) =>
        record.email === email.trim() && acceptedMutationIds.has(record.clientMutationId),
      )
      await this.cloudflareShadow?.mirrorSyncMutations({
        user,
        mutations: storedMutations,
        shadowUpdatedAt: timestamp,
      })
    }

    return {
      serverTime: timestamp,
      accepted,
      rejected,
      nextCursors: {
        config: this.getLatestCursor(db, email, "config"),
        vocabulary: this.getLatestCursor(db, email, "vocabulary"),
        reading_history: this.getLatestCursor(db, email, "reading_history"),
        study_progress: this.getLatestCursor(db, email, "study_progress"),
      },
    }
  }

  async pullSyncMutations(
    email: string,
    cursors: Partial<Record<SyncCollection, string | null>> = {},
  ): Promise<SyncPullResponse> {
    const db = await this.load()
    const user = db.users.find((record) => record.email === email.trim())
    if (!user) {
      throw new AstraError("CONFIG_MISSING", "Unknown Astra user.")
    }
    const deltas = {
      config: [] as ServerSyncMutationRecord[],
      vocabulary: [] as ServerSyncMutationRecord[],
      reading_history: [] as ServerSyncMutationRecord[],
      study_progress: [] as ServerSyncMutationRecord[],
    }

    for (const collection of SYNC_COLLECTIONS) {
      const isOptionalCollection = collection === "reading_history" || collection === "study_progress"
      const explicitlyRequested = Object.prototype.hasOwnProperty.call(cursors, collection)
      if (isOptionalCollection && (!explicitlyRequested || !isSyncCollectionEnabled(user.syncPreferences, collection))) {
        deltas[collection] = []
        continue
      }

      const cursor = parseCursor(cursors[collection])
      deltas[collection] = db.syncMutations
        .filter((mutation) => mutation.email === email.trim() && mutation.collection === collection && parseCursor(mutation.cursor) > cursor)
        .sort((a, b) => parseCursor(a.cursor) - parseCursor(b.cursor))
    }

    const result = {
      serverTime: new Date().toISOString(),
      deltas,
      nextCursors: {
        config: deltas.config.at(-1)?.cursor ?? this.getLatestCursor(db, email, "config") ?? cursors.config ?? null,
        vocabulary: deltas.vocabulary.at(-1)?.cursor ?? this.getLatestCursor(db, email, "vocabulary") ?? cursors.vocabulary ?? null,
        reading_history: deltas.reading_history.at(-1)?.cursor ?? (Object.prototype.hasOwnProperty.call(cursors, "reading_history")
          ? (this.getLatestCursor(db, email, "reading_history") ?? cursors.reading_history ?? null)
          : null),
        study_progress: deltas.study_progress.at(-1)?.cursor ?? (Object.prototype.hasOwnProperty.call(cursors, "study_progress")
          ? (this.getLatestCursor(db, email, "study_progress") ?? cursors.study_progress ?? null)
          : null),
      },
    } satisfies SyncPullResponse

    await this.cloudflareShadow?.compareSyncPull({
      user,
      cursors,
      result,
    })

    return result
  }
}
