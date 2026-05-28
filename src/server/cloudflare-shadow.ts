import { createHash } from "node:crypto"

import type { D1Database, D1PreparedStatement, D1RunResult } from "../platform/cloudflare/src/bindings"
import { listShadowDevicesForUser, revokeShadowDevice, touchShadowDevice, upsertShadowDevice } from "../platform/cloudflare/src/repositories/devices"
import {
  getShadowSessionById,
  revokeShadowSession,
  touchShadowSession,
  upsertShadowSession,
} from "../platform/cloudflare/src/repositories/sessions"
import { upsertShadowUserUsage } from "../platform/cloudflare/src/repositories/user-usage"
import {
  appendShadowSyncMutation,
  getShadowSyncBootstrap,
  mirrorShadowSyncCollectionsFromUser,
  pullShadowSyncMutations,
} from "../platform/cloudflare/src/repositories/sync"
import {
  getShadowUserById,
  upsertShadowUser,
  upsertShadowUserCredential,
} from "../platform/cloudflare/src/repositories/users"
import type {
  ShadowSyncCollection,
  ShadowUserCredentialSnapshot,
} from "../platform/cloudflare/src/types/shadow-state"
import { ASTRA_CREDENTIAL_HASH_ALGORITHM } from "../utils/astra/credential-hash"

import type {
  DeviceListEntry,
  RelayCloudflareShadowConfig,
  RelayEnv,
  RelayShadowEvent,
  ServerDeviceRecord,
  ServerSessionRecord,
  ServerSyncMutationRecord,
  ServerUserRecord,
  SyncBootstrapResponse,
  SyncCollection,
  SyncPullResponse,
} from "./types"

const DEFAULT_CLOUDFLARE_API_BASE_URL = "https://api.cloudflare.com/client/v4"

type CloudflareD1QueryEnvelope<Row> = {
  success?: boolean
  errors?: Array<{ message?: string }>
  result?: Array<{
    success?: boolean
    results?: Row[]
    meta?: {
      changes?: number
    }
  }>
}

function coerceOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

function isMissingRowError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("matched no rows")
}

export function isSyncCollectionEnabled(user: ServerUserRecord, collection: SyncCollection): boolean {
  if (collection === "config" || collection === "vocabulary" || collection === "review_schedule") return true
  if (collection === "reading_history") return user.syncPreferences.reading_history
  return user.syncPreferences.study_progress
}

export function buildShadowUserSnapshot(user: ServerUserRecord, shadowUpdatedAt?: string) {
  return {
    id: user.id,
    email: user.email,
    billingEmail: user.billingEmail,
    createdAt: user.createdAt,
    plan: user.plan,
    subscriptionStatus: user.subscriptionStatus,
    identityMode: user.identityMode,
    installId: user.installId ?? null,
    providerEntitlements: user.providerEntitlements,
    syncPreferences: user.syncPreferences,
    shadowUpdatedAt: shadowUpdatedAt ?? new Date().toISOString(),
  }
}

export function buildShadowUserUsageSnapshot(user: ServerUserRecord, shadowUpdatedAt?: string) {
  return {
    userId: user.id,
    usageDay: user.usage.usageDay,
    dailyRequestsLimit: user.limits.dailyRequests,
    dailyCharactersLimit: user.limits.dailyCharacters,
    requestsPerMinuteLimit: user.limits.requestsPerMinute,
    requestsToday: user.usage.requestsToday,
    charactersToday: user.usage.charactersToday,
    totalRequests: user.usage.totalRequests,
    totalCharacters: user.usage.totalCharacters,
    lastRequestAt: user.usage.lastRequestAt ?? null,
    recentEvents: user.usage.recentEvents,
    shadowUpdatedAt: shadowUpdatedAt ?? user.usage.lastRequestAt ?? new Date().toISOString(),
  }
}

export function buildShadowUserCredentialSnapshot(
  user: ServerUserRecord,
  shadowUpdatedAt?: string,
): ShadowUserCredentialSnapshot {
  return {
    userId: user.id,
    credentialKind: "password",
    passwordHash: user.passwordHash,
    passwordHashAlg: ASTRA_CREDENTIAL_HASH_ALGORITHM,
    updatedAt: shadowUpdatedAt ?? user.createdAt,
    shadowUpdatedAt: shadowUpdatedAt ?? user.createdAt,
  }
}

export function buildShadowDeviceSnapshot(device: ServerDeviceRecord, shadowUpdatedAt?: string) {
  return {
    userId: device.userId,
    deviceId: device.deviceId,
    identityMode: device.identityMode,
    label: device.label,
    platform: device.platform,
    browserFamily: device.browserFamily,
    appKind: device.appKind,
    appVersion: device.appVersion,
    firstSeenAt: device.firstSeenAt,
    lastSeenAt: device.lastSeenAt,
    lastSyncAt: device.lastSyncAt,
    status: device.status,
    revokedAt: device.revokedAt,
    updatedAt: device.updatedAt,
    shadowUpdatedAt: shadowUpdatedAt ?? device.updatedAt,
  }
}

export function buildShadowSessionSnapshot(
  session: ServerSessionRecord,
  options: { token?: string; shadowUpdatedAt?: string } = {},
) {
  return {
    sessionId: session.sessionId,
    userId: session.userId,
    deviceId: session.deviceId,
    identityMode: session.identityMode,
    tokenHash: options.token ? hashSessionToken(options.token) : null,
    tokenHashAlg: options.token ? "sha256" : null,
    issuedAt: session.issuedAt,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
    lastSeenAt: session.lastSeenAt,
    lastVerifiedAt: session.lastVerifiedAt,
    status: session.status,
    revokedAt: session.revokedAt,
    shadowUpdatedAt: options.shadowUpdatedAt ?? session.lastSeenAt,
  }
}

function normalizeSessionForParity(session: ServerSessionRecord | null) {
  if (!session) return null
  return {
    sessionId: session.sessionId,
    userId: session.userId,
    deviceId: session.deviceId,
    identityMode: session.identityMode,
    issuedAt: session.issuedAt,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
    lastSeenAt: session.lastSeenAt,
    lastVerifiedAt: session.lastVerifiedAt,
    status: session.status,
    revokedAt: session.revokedAt,
  }
}

function normalizeUserForParity(user: ServerUserRecord | null) {
  if (!user) return null
  return {
    id: user.id,
    email: user.email,
    billingEmail: user.billingEmail,
    createdAt: user.createdAt,
    plan: user.plan,
    subscriptionStatus: user.subscriptionStatus,
    identityMode: user.identityMode,
    installId: user.installId ?? null,
    providerEntitlements: [...user.providerEntitlements].sort(),
    syncPreferences: {
      reading_history: user.syncPreferences.reading_history,
      study_progress: user.syncPreferences.study_progress,
      weekly_digest: user.syncPreferences.weekly_digest,
    },
  }
}

function normalizeDeviceListForParity(devices: DeviceListEntry[]) {
  return devices.map((device) => ({
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
    isCurrentDevice: device.isCurrentDevice,
  }))
}

function normalizeBootstrapForParity(bootstrap: SyncBootstrapResponse) {
  return {
    deviceId: bootstrap.deviceId,
    collections: {
      config: {
        enabled: bootstrap.collections.config.enabled,
        defaultEnabled: bootstrap.collections.config.defaultEnabled,
        cursor: bootstrap.collections.config.cursor,
      },
      vocabulary: {
        enabled: bootstrap.collections.vocabulary.enabled,
        defaultEnabled: bootstrap.collections.vocabulary.defaultEnabled,
        cursor: bootstrap.collections.vocabulary.cursor,
      },
      review_schedule: {
        enabled: bootstrap.collections.review_schedule.enabled,
        defaultEnabled: bootstrap.collections.review_schedule.defaultEnabled,
        cursor: bootstrap.collections.review_schedule.cursor,
      },
      reading_history: {
        enabled: bootstrap.collections.reading_history.enabled,
        defaultEnabled: bootstrap.collections.reading_history.defaultEnabled,
        cursor: bootstrap.collections.reading_history.cursor,
      },
      study_progress: {
        enabled: bootstrap.collections.study_progress.enabled,
        defaultEnabled: bootstrap.collections.study_progress.defaultEnabled,
        cursor: bootstrap.collections.study_progress.cursor,
      },
    },
    limits: bootstrap.limits,
    transport: bootstrap.transport,
  }
}

function normalizeSyncMutationForParity(mutation: ServerSyncMutationRecord) {
  return {
    serverMutationId: mutation.serverMutationId,
    collection: mutation.collection,
    schemaVersion: mutation.schemaVersion,
    recordId: mutation.recordId,
    operation: mutation.operation,
    clientMutationId: mutation.clientMutationId,
    deviceId: mutation.deviceId,
    clientUpdatedAt: mutation.clientUpdatedAt,
    serverUpdatedAt: mutation.serverUpdatedAt,
    cursor: mutation.cursor,
    payload: mutation.payload ?? null,
  }
}

function normalizePullForParity(pull: SyncPullResponse) {
  return {
    deltas: {
      config: pull.deltas.config.map(normalizeSyncMutationForParity),
      vocabulary: pull.deltas.vocabulary.map(normalizeSyncMutationForParity),
      review_schedule: pull.deltas.review_schedule.map(normalizeSyncMutationForParity),
      reading_history: pull.deltas.reading_history.map(normalizeSyncMutationForParity),
      study_progress: pull.deltas.study_progress.map(normalizeSyncMutationForParity),
    },
    nextCursors: pull.nextCursors,
  }
}

function mapShadowBootstrapToNodeShape(shadow: Awaited<ReturnType<typeof getShadowSyncBootstrap>>): SyncBootstrapResponse {
  return {
    serverTime: shadow.serverTime,
    deviceId: shadow.deviceId,
    collections: {
      config: {
        enabled: shadow.collections.config.enabled,
        defaultEnabled: shadow.collections.config.defaultEnabled,
        cursor: shadow.collections.config.lastIssuedCursor,
      },
      vocabulary: {
        enabled: shadow.collections.vocabulary.enabled,
        defaultEnabled: shadow.collections.vocabulary.defaultEnabled,
        cursor: shadow.collections.vocabulary.lastIssuedCursor,
      },
      review_schedule: {
        enabled: shadow.collections.review_schedule.enabled,
        defaultEnabled: shadow.collections.review_schedule.defaultEnabled,
        cursor: shadow.collections.review_schedule.lastIssuedCursor,
      },
      reading_history: {
        enabled: shadow.collections.reading_history.enabled,
        defaultEnabled: shadow.collections.reading_history.defaultEnabled,
        cursor: shadow.collections.reading_history.lastIssuedCursor,
      },
      study_progress: {
        enabled: shadow.collections.study_progress.enabled,
        defaultEnabled: shadow.collections.study_progress.defaultEnabled,
        cursor: shadow.collections.study_progress.lastIssuedCursor,
      },
    },
    limits: shadow.limits,
    transport: shadow.transport,
  }
}

function mapShadowPullToNodeShape(shadow: Awaited<ReturnType<typeof pullShadowSyncMutations>>): SyncPullResponse {
  return {
    serverTime: shadow.serverTime,
    deltas: {
      config: shadow.deltas.config.map((mutation) => ({
        ownerId: "",
        email: "",
        serverMutationId: mutation.serverMutationId,
        serverUpdatedAt: mutation.serverUpdatedAt,
        cursor: mutation.cursor,
        collection: mutation.collection,
        schemaVersion: mutation.schemaVersion,
        recordId: mutation.recordId,
        operation: mutation.operation,
        clientMutationId: mutation.clientMutationId,
        deviceId: mutation.deviceId,
        clientUpdatedAt: mutation.clientUpdatedAt,
        payload: mutation.payload ?? null,
      })),
      vocabulary: shadow.deltas.vocabulary.map((mutation) => ({
        ownerId: "",
        email: "",
        serverMutationId: mutation.serverMutationId,
        serverUpdatedAt: mutation.serverUpdatedAt,
        cursor: mutation.cursor,
        collection: mutation.collection,
        schemaVersion: mutation.schemaVersion,
        recordId: mutation.recordId,
        operation: mutation.operation,
        clientMutationId: mutation.clientMutationId,
        deviceId: mutation.deviceId,
        clientUpdatedAt: mutation.clientUpdatedAt,
        payload: mutation.payload ?? null,
      })),
      review_schedule: shadow.deltas.review_schedule.map((mutation) => ({
        ownerId: "",
        email: "",
        serverMutationId: mutation.serverMutationId,
        serverUpdatedAt: mutation.serverUpdatedAt,
        cursor: mutation.cursor,
        collection: mutation.collection,
        schemaVersion: mutation.schemaVersion,
        recordId: mutation.recordId,
        operation: mutation.operation,
        clientMutationId: mutation.clientMutationId,
        deviceId: mutation.deviceId,
        clientUpdatedAt: mutation.clientUpdatedAt,
        payload: mutation.payload ?? null,
      })),
      reading_history: shadow.deltas.reading_history.map((mutation) => ({
        ownerId: "",
        email: "",
        serverMutationId: mutation.serverMutationId,
        serverUpdatedAt: mutation.serverUpdatedAt,
        cursor: mutation.cursor,
        collection: mutation.collection,
        schemaVersion: mutation.schemaVersion,
        recordId: mutation.recordId,
        operation: mutation.operation,
        clientMutationId: mutation.clientMutationId,
        deviceId: mutation.deviceId,
        clientUpdatedAt: mutation.clientUpdatedAt,
        payload: mutation.payload ?? null,
      })),
      study_progress: shadow.deltas.study_progress.map((mutation) => ({
        ownerId: "",
        email: "",
        serverMutationId: mutation.serverMutationId,
        serverUpdatedAt: mutation.serverUpdatedAt,
        cursor: mutation.cursor,
        collection: mutation.collection,
        schemaVersion: mutation.schemaVersion,
        recordId: mutation.recordId,
        operation: mutation.operation,
        clientMutationId: mutation.clientMutationId,
        deviceId: mutation.deviceId,
        clientUpdatedAt: mutation.clientUpdatedAt,
        payload: mutation.payload ?? null,
      })),
    },
    nextCursors: shadow.nextCursors,
  }
}

function stableSerialize(value: unknown): string {
  return JSON.stringify(value)
}

function buildMismatchDetails(nodeValue: unknown, shadowValue: unknown) {
  return {
    node: nodeValue,
    shadow: shadowValue,
  }
}

class CloudflareD1HttpDatabase implements D1Database {
  constructor(
    private readonly config: {
      accountId: string
      databaseId: string
      apiToken: string
      apiBaseUrl?: string
      fetchImpl?: typeof fetch
    },
  ) {}

  prepare<Row = Record<string, unknown>>(query: string): D1PreparedStatement<Row> {
    const database = this
    let bindings: unknown[] = []

    return {
      bind(...values: unknown[]) {
        bindings = values
        return this
      },
      async run<T = Row>(): Promise<D1RunResult<T>> {
        return database.execute<T>(query, bindings)
      },
      async all<T = Row>(): Promise<D1RunResult<T>> {
        return database.execute<T>(query, bindings)
      },
      async first<T = Row>(): Promise<T | null> {
        const result = await database.execute<T>(query, bindings)
        return result.results?.[0] ?? null
      },
    }
  }

  private async execute<Row>(query: string, bindings: unknown[]): Promise<D1RunResult<Row>> {
    const fetchImpl = this.config.fetchImpl ?? globalThis.fetch
    const baseUrl = coerceOptionalText(this.config.apiBaseUrl) ?? DEFAULT_CLOUDFLARE_API_BASE_URL
    const response = await fetchImpl(
      `${baseUrl}/accounts/${this.config.accountId}/d1/database/${this.config.databaseId}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sql: query,
          params: bindings,
        }),
      },
    )

    const rawBody = await response.text()
    let payload: CloudflareD1QueryEnvelope<Row>
    try {
      payload = rawBody ? JSON.parse(rawBody) as CloudflareD1QueryEnvelope<Row> : {}
    } catch {
      const snippet = rawBody.slice(0, 200)
      throw new Error(
        `Cloudflare D1 query failed with status ${response.status} and a non-JSON body${snippet ? `: ${snippet}` : "."}`,
      )
    }

    if (!response.ok || !payload.success) {
      const message = payload.errors?.map((error) => error.message).filter(Boolean).join("; ")
        || `Cloudflare D1 query failed with status ${response.status}.`
      throw new Error(message)
    }

    const result = payload.result?.[0]
    if (!result?.success) {
      throw new Error("Cloudflare D1 query returned an unsuccessful result.")
    }

    return {
      success: true,
      results: result.results ?? [],
      meta: {
        changes: result.meta?.changes,
      },
    }
  }
}

export function createCloudflareD1Database(config: {
  accountId: string
  databaseId: string
  apiToken: string
  apiBaseUrl?: string
  fetchImpl?: typeof fetch
}): D1Database {
  return new CloudflareD1HttpDatabase(config)
}

export function resolveCloudflareShadowDatabase(
  config: RelayCloudflareShadowConfig | undefined,
): D1Database {
  if (!config) {
    throw new Error("Cloudflare shadow configuration is missing.")
  }

  if (config.db) {
    return config.db
  }

  const accountId = coerceOptionalText(config.accountId)
  const databaseId = coerceOptionalText(config.databaseId)
  const apiToken = coerceOptionalText(config.apiToken)
  if (!accountId || !databaseId || !apiToken) {
    throw new Error(
      "Cloudflare shadow tooling requires a configured D1 database or ASTRA_CF_ACCOUNT_ID, ASTRA_CF_D1_DATABASE_ID, and ASTRA_CF_API_TOKEN.",
    )
  }

  return createCloudflareD1Database({
    accountId,
    databaseId,
    apiToken,
    apiBaseUrl: config.apiBaseUrl,
  })
}

type ConfiguredRelayCloudflareShadowConfig = RelayCloudflareShadowConfig & {
  db: D1Database
}

export class RelayCloudflareShadowBridge {
  private readonly config: ConfiguredRelayCloudflareShadowConfig

  constructor(config: ConfiguredRelayCloudflareShadowConfig) {
    this.config = config
  }

  private emit(event: RelayShadowEvent) {
    if (this.config.onEvent) {
      this.config.onEvent(event)
      return
    }

    const renderedDetails = event.details ? ` ${JSON.stringify(event.details)}` : ""
    console.warn(`[relay-cloudflare-shadow] ${event.kind}:${event.scope}:${event.outcome} ${event.message}${renderedDetails}`)
  }

  private async runShadowWrite(scope: string, action: () => Promise<void>) {
    if (!this.config.writeEnabled) return
    try {
      await action()
    } catch (error) {
      this.emit({
        kind: "shadow-write",
        scope,
        outcome: "failed",
        message: error instanceof Error ? error.message : "Unknown Cloudflare shadow write failure.",
      })
    }
  }

  private async runReadParity(scope: string, action: () => Promise<void>) {
    if (!this.config.readParityEnabled) return
    try {
      await action()
    } catch (error) {
      this.emit({
        kind: "read-parity",
        scope,
        outcome: "failed",
        message: error instanceof Error ? error.message : "Unknown Cloudflare parity read failure.",
      })
    }
  }

  private async ensureShadowUser(user: ServerUserRecord, shadowUpdatedAt?: string) {
    await upsertShadowUser(this.config.db, buildShadowUserSnapshot(user, shadowUpdatedAt))
  }

  private async ensureShadowCredential(user: ServerUserRecord, shadowUpdatedAt?: string) {
    if (user.identityMode !== "authenticated") return
    await upsertShadowUserCredential(
      this.config.db,
      buildShadowUserCredentialSnapshot(user, shadowUpdatedAt ?? new Date().toISOString()),
    )
  }

  async mirrorUserUsage(user: ServerUserRecord, shadowUpdatedAt?: string) {
    await this.runShadowWrite("user_usage", async () => {
      await upsertShadowUserUsage(this.config.db, buildShadowUserUsageSnapshot(user, shadowUpdatedAt))
    })
  }

  async mirrorUserCredential(user: ServerUserRecord, shadowUpdatedAt?: string) {
    await this.runShadowWrite("user_credentials", async () => {
      await this.ensureShadowUser(user, shadowUpdatedAt)
      await this.ensureShadowCredential(user, shadowUpdatedAt)
    })
  }

  async backfillUserCredentials(users: ServerUserRecord[], shadowUpdatedAt?: string) {
    await this.runShadowWrite("user_credentials_backfill", async () => {
      for (const user of users) {
        await this.ensureShadowUser(user, shadowUpdatedAt ?? user.createdAt)
        await this.ensureShadowCredential(user, shadowUpdatedAt ?? user.createdAt)
      }
    })
  }

  private async touchShadowSessionOrUpsert(session: ServerSessionRecord, shadowUpdatedAt?: string) {
    try {
      await touchShadowSession(this.config.db, {
        sessionId: session.sessionId,
        lastSeenAt: session.lastSeenAt,
        lastVerifiedAt: session.lastVerifiedAt,
        shadowUpdatedAt,
      })
    } catch (error) {
      if (!isMissingRowError(error)) throw error
      await upsertShadowSession(this.config.db, buildShadowSessionSnapshot(session, { shadowUpdatedAt }))
    }
  }

  private async touchShadowDeviceOrUpsert(device: ServerDeviceRecord, shadowUpdatedAt?: string) {
    try {
      await touchShadowDevice(this.config.db, {
        userId: device.userId,
        deviceId: device.deviceId,
        lastSeenAt: device.lastSeenAt,
        lastSyncAt: device.lastSyncAt ?? undefined,
        reactivate: device.status === "active" && !device.revokedAt,
        shadowUpdatedAt,
      })
    } catch (error) {
      if (!isMissingRowError(error)) throw error
      await upsertShadowDevice(this.config.db, buildShadowDeviceSnapshot(device, shadowUpdatedAt))
    }
  }

  private async revokeShadowSessionOrUpsert(session: ServerSessionRecord, shadowUpdatedAt?: string) {
    if (!session.revokedAt) {
      await upsertShadowSession(this.config.db, buildShadowSessionSnapshot(session, { shadowUpdatedAt }))
      return
    }

    try {
      await revokeShadowSession(this.config.db, {
        sessionId: session.sessionId,
        revokedAt: session.revokedAt,
        lastVerifiedAt: session.lastVerifiedAt,
        shadowUpdatedAt,
      })
    } catch (error) {
      if (!isMissingRowError(error)) throw error
      await upsertShadowSession(this.config.db, buildShadowSessionSnapshot(session, { shadowUpdatedAt }))
    }
  }

  private async revokeShadowDeviceOrUpsert(device: ServerDeviceRecord, shadowUpdatedAt?: string) {
    if (!device.revokedAt) {
      await upsertShadowDevice(this.config.db, buildShadowDeviceSnapshot(device, shadowUpdatedAt))
      return
    }

    try {
      await revokeShadowDevice(this.config.db, {
        userId: device.userId,
        deviceId: device.deviceId,
        revokedAt: device.revokedAt,
        shadowUpdatedAt,
      })
    } catch (error) {
      if (!isMissingRowError(error)) throw error
      await upsertShadowDevice(this.config.db, buildShadowDeviceSnapshot(device, shadowUpdatedAt))
    }
  }

  async mirrorIssuedSession(params: {
    user: ServerUserRecord
    device: ServerDeviceRecord
    session: ServerSessionRecord
    token: string
  }) {
    await this.runShadowWrite("auth_session_issue", async () => {
      await this.ensureShadowUser(params.user, params.session.createdAt)
      await this.ensureShadowCredential(params.user, params.session.createdAt)
      await upsertShadowUserUsage(this.config.db, buildShadowUserUsageSnapshot(params.user, params.session.createdAt))
      await mirrorShadowSyncCollectionsFromUser(this.config.db, {
        userId: params.user.id,
        syncPreferences: params.user.syncPreferences,
        shadowUpdatedAt: params.session.createdAt,
      })
      await upsertShadowDevice(this.config.db, buildShadowDeviceSnapshot(params.device, params.device.updatedAt))
      await upsertShadowSession(this.config.db, buildShadowSessionSnapshot(params.session, {
        token: params.token,
        shadowUpdatedAt: params.session.createdAt,
      }))
    })
  }

  async mirrorTouchedSession(params: {
    user: ServerUserRecord
    device: ServerDeviceRecord | null
    session: ServerSessionRecord
  }) {
    await this.runShadowWrite("session_touch", async () => {
      const shadowUpdatedAt = params.device?.updatedAt ?? params.session.lastSeenAt
      await this.ensureShadowUser(params.user, shadowUpdatedAt)
      if (params.device) {
        await this.touchShadowDeviceOrUpsert(params.device, shadowUpdatedAt)
      }
      await this.touchShadowSessionOrUpsert(params.session, shadowUpdatedAt)
    })
  }

  async mirrorRevokedSession(params: {
    user: ServerUserRecord
    session: ServerSessionRecord
  }) {
    await this.runShadowWrite("session_revoke", async () => {
      await this.ensureShadowUser(params.user, params.session.revokedAt ?? params.session.lastVerifiedAt ?? params.session.lastSeenAt)
      await this.revokeShadowSessionOrUpsert(
        params.session,
        params.session.revokedAt ?? params.session.lastVerifiedAt ?? params.session.lastSeenAt,
      )
    })
  }

  async mirrorRevokedDevice(params: {
    user: ServerUserRecord
    device: ServerDeviceRecord
    sessions: ServerSessionRecord[]
  }) {
    await this.runShadowWrite("device_revoke", async () => {
      const shadowUpdatedAt = params.device.revokedAt ?? params.device.updatedAt
      await this.ensureShadowUser(params.user, shadowUpdatedAt)
      await this.revokeShadowDeviceOrUpsert(params.device, shadowUpdatedAt)
      for (const session of params.sessions) {
        await this.revokeShadowSessionOrUpsert(
          session,
          session.revokedAt ?? session.lastVerifiedAt ?? shadowUpdatedAt,
        )
      }
    })
  }

  async mirrorSyncPreferences(user: ServerUserRecord, shadowUpdatedAt?: string) {
    await this.runShadowWrite("sync_preferences", async () => {
      await this.ensureShadowUser(user, shadowUpdatedAt)
      await mirrorShadowSyncCollectionsFromUser(this.config.db, {
        userId: user.id,
        syncPreferences: user.syncPreferences,
        shadowUpdatedAt,
      })
    })
  }

  async mirrorSyncMutations(params: {
    user: ServerUserRecord
    mutations: ServerSyncMutationRecord[]
    shadowUpdatedAt?: string
  }) {
    await this.runShadowWrite("sync_push", async () => {
      await this.ensureShadowUser(params.user, params.shadowUpdatedAt)
      await mirrorShadowSyncCollectionsFromUser(this.config.db, {
        userId: params.user.id,
        syncPreferences: params.user.syncPreferences,
        shadowUpdatedAt: params.shadowUpdatedAt,
      })

      for (const mutation of params.mutations) {
        await appendShadowSyncMutation(this.config.db, {
          userId: params.user.id,
          collection: mutation.collection as ShadowSyncCollection,
          collectionEnabled: isSyncCollectionEnabled(params.user, mutation.collection),
          collectionDefaultEnabled: mutation.collection === "config" || mutation.collection === "vocabulary" || mutation.collection === "review_schedule",
          schemaVersion: mutation.schemaVersion,
          recordId: mutation.recordId,
          operation: mutation.operation,
          clientMutationId: mutation.clientMutationId,
          deviceId: mutation.deviceId,
          clientUpdatedAt: mutation.clientUpdatedAt,
          serverUpdatedAt: mutation.serverUpdatedAt,
          cursor: mutation.cursor,
          payload: mutation.payload ?? null,
          serverMutationId: mutation.serverMutationId,
          shadowUpdatedAt: params.shadowUpdatedAt ?? mutation.serverUpdatedAt,
        })
      }
    })
  }

  async compareSessionLookup(params: {
    user: ServerUserRecord
    session: ServerSessionRecord
    device: ServerDeviceRecord | null
  }) {
    await this.runReadParity("session_lookup", async () => {
      const [shadowUser, shadowSession, shadowDevice] = await Promise.all([
        getShadowUserById(this.config.db, params.user.id),
        getShadowSessionById(this.config.db, params.session.sessionId),
        params.device ? listShadowDevicesForUser(this.config.db, params.user.id, params.device.deviceId, params.device.identityMode) : Promise.resolve([]),
      ])

      const nodeValue = {
        user: normalizeUserForParity(params.user),
        session: normalizeSessionForParity(params.session),
      }
      const shadowValue = {
        user: shadowUser ? {
          id: shadowUser.id,
          email: shadowUser.email,
          billingEmail: shadowUser.billingEmail,
          createdAt: shadowUser.createdAt,
          plan: shadowUser.plan,
          subscriptionStatus: shadowUser.subscriptionStatus,
          identityMode: shadowUser.identityMode,
          installId: shadowUser.installId ?? null,
          providerEntitlements: [...shadowUser.providerEntitlements].sort(),
          syncPreferences: shadowUser.syncPreferences,
        } : null,
        session: shadowSession ? {
          sessionId: shadowSession.sessionId,
          userId: shadowSession.userId,
          deviceId: shadowSession.deviceId,
          identityMode: shadowSession.identityMode,
          issuedAt: shadowSession.issuedAt,
          expiresAt: shadowSession.expiresAt,
          createdAt: shadowSession.createdAt,
          lastSeenAt: shadowSession.lastSeenAt,
          lastVerifiedAt: shadowSession.lastVerifiedAt,
          status: shadowSession.status,
          revokedAt: shadowSession.revokedAt,
        } : null,
        device: params.device
          ? normalizeDeviceListForParity(shadowDevice).find((device) => device.deviceId === params.device?.deviceId) ?? null
          : null,
      }

      const expectedDevice = params.device ? {
        deviceId: params.device.deviceId,
        label: params.device.label,
        platform: params.device.platform,
        browserFamily: params.device.browserFamily,
        appKind: params.device.appKind,
        appVersion: params.device.appVersion,
        firstSeenAt: params.device.firstSeenAt,
        lastSeenAt: params.device.lastSeenAt,
        lastSyncAt: params.device.lastSyncAt,
        status: params.device.status,
        isCurrentDevice: true,
      } : null

      if (stableSerialize({
        ...nodeValue,
        device: expectedDevice,
      }) !== stableSerialize(shadowValue)) {
        this.emit({
          kind: "read-parity",
          scope: "session_lookup",
          outcome: "mismatch",
          message: "Cloudflare shadow session lookup diverged from the Node authoritative state.",
          details: buildMismatchDetails({
            ...nodeValue,
            device: expectedDevice,
          }, shadowValue),
        })
      }
    })
  }

  async compareDeviceList(params: {
    user: ServerUserRecord
    currentDeviceId?: string
    devices: DeviceListEntry[]
  }) {
    await this.runReadParity("device_list", async () => {
      const shadowDevices = await listShadowDevicesForUser(
        this.config.db,
        params.user.id,
        params.currentDeviceId,
        "authenticated",
      )
      const nodeValue = normalizeDeviceListForParity(params.devices)
      const shadowValue = normalizeDeviceListForParity(shadowDevices)

      if (stableSerialize(nodeValue) !== stableSerialize(shadowValue)) {
        this.emit({
          kind: "read-parity",
          scope: "device_list",
          outcome: "mismatch",
          message: "Cloudflare shadow device list diverged from the Node authoritative state.",
          details: buildMismatchDetails(nodeValue, shadowValue),
        })
      }
    })
  }

  async compareSyncBootstrap(params: {
    user: ServerUserRecord
    bootstrap: SyncBootstrapResponse
    maxMutationsPerRequest: number
  }) {
    await this.runReadParity("sync_bootstrap", async () => {
      const shadowBootstrap = await getShadowSyncBootstrap(this.config.db, {
        userId: params.user.id,
        deviceId: params.bootstrap.deviceId,
        maxMutationsPerRequest: params.maxMutationsPerRequest,
      })
      const nodeValue = normalizeBootstrapForParity(params.bootstrap)
      const shadowValue = normalizeBootstrapForParity(mapShadowBootstrapToNodeShape(shadowBootstrap))

      if (stableSerialize(nodeValue) !== stableSerialize(shadowValue)) {
        this.emit({
          kind: "read-parity",
          scope: "sync_bootstrap",
          outcome: "mismatch",
          message: "Cloudflare shadow sync bootstrap diverged from the Node authoritative state.",
          details: buildMismatchDetails(nodeValue, shadowValue),
        })
      }
    })
  }

  async compareSyncPull(params: {
    user: ServerUserRecord
    cursors: Partial<Record<SyncCollection, string | null>>
    result: SyncPullResponse
  }) {
    await this.runReadParity("sync_pull", async () => {
      const limitPerCollection = Math.max(
        500,
        params.result.deltas.config.length,
        params.result.deltas.vocabulary.length,
        params.result.deltas.review_schedule.length,
        params.result.deltas.reading_history.length,
        params.result.deltas.study_progress.length,
      )
      const shadowPull = await pullShadowSyncMutations(this.config.db, {
        userId: params.user.id,
        cursors: params.cursors,
        limitPerCollection,
      })
      const nodeValue = normalizePullForParity(params.result)
      const shadowValue = normalizePullForParity(mapShadowPullToNodeShape(shadowPull))

      if (stableSerialize(nodeValue) !== stableSerialize(shadowValue)) {
        this.emit({
          kind: "read-parity",
          scope: "sync_pull",
          outcome: "mismatch",
          message: "Cloudflare shadow sync pull diverged from the Node authoritative state.",
          details: buildMismatchDetails(nodeValue, shadowValue),
        })
      }
    })
  }
}

export function createRelayCloudflareShadowBridge(env: RelayEnv): RelayCloudflareShadowBridge | null {
  const config = env.cloudflareShadow
  if (!config || (!config.writeEnabled && !config.readParityEnabled)) {
    return null
  }

  try {
    return new RelayCloudflareShadowBridge({
      ...config,
      db: resolveCloudflareShadowDatabase(config),
    })
  } catch (error) {
    config.onEvent?.({
      kind: "shadow-write",
      scope: "cloudflare_shadow_config",
      outcome: "failed",
      message: error instanceof Error
        ? error.message
        : "Cloudflare shadow flags were enabled without a usable D1 database configuration.",
    })
    return null
  }
}
