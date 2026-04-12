import type { D1Database } from "../platform/cloudflare/src/bindings"
import { listShadowDeviceRowsForUser, upsertShadowDevice } from "../platform/cloudflare/src/repositories/devices"
import { getShadowSessionById, listShadowSessionsForUser, upsertShadowSession } from "../platform/cloudflare/src/repositories/sessions"
import {
  appendShadowSyncMutation,
  listShadowSyncCollectionRowsForUser,
  listShadowSyncMutationsForUser,
  upsertShadowSyncCollection,
} from "../platform/cloudflare/src/repositories/sync"
import {
  getShadowUserCredential,
  listShadowUsers,
  upsertShadowUser,
  upsertShadowUserCredential,
} from "../platform/cloudflare/src/repositories/users"
import type {
  ShadowUserCredentialSnapshot,
  ShadowUserCredentialRow,
  ShadowDeviceSnapshot,
  ShadowSessionSnapshot,
  ShadowSyncCollectionSnapshot,
  ShadowSyncMutationSnapshot,
  ShadowUserSnapshot,
  ShadowDeviceRow,
  ShadowSessionRow,
  ShadowSyncCollection,
  ShadowSyncCollectionRow,
  ShadowSyncMutationRow,
  ShadowUserRow,
} from "../platform/cloudflare/src/types/shadow-state"
import { SHADOW_SYNC_COLLECTIONS } from "../platform/cloudflare/src/types/shadow-state"

import {
  buildShadowDeviceSnapshot,
  buildShadowSessionSnapshot,
  buildShadowUserCredentialSnapshot,
  buildShadowUserSnapshot,
} from "./cloudflare-shadow"
import { loadAuthoritativeUserDatabase } from "./user-store"
import type {
  RelayEnv,
  ServerDeviceRecord,
  ServerSessionRecord,
  ServerSyncMutationRecord,
  ServerUserRecord,
} from "./types"

export const SHADOW_AUDIT_SCOPES = [
  "users",
  "credentials",
  "devices",
  "sessions",
  "sync_collections",
  "sync_mutations",
] as const

export type ShadowAuditScope = (typeof SHADOW_AUDIT_SCOPES)[number]
export type ShadowDiffOutcome = "missing_in_shadow" | "extra_in_shadow" | "field_mismatch"
export type ShadowBackfillActionKind =
  | "upsert_user"
  | "upsert_user_credential"
  | "upsert_device"
  | "upsert_session"
  | "mirror_sync_collections"
  | "append_sync_mutation"

export interface ShadowAuditFilters {
  email?: string
  userId?: string
  scopes?: ShadowAuditScope[]
  maxDiffs?: number
}

export interface ShadowAuditDiff {
  scope: ShadowAuditScope
  outcome: ShadowDiffOutcome
  userId: string
  email: string | null
  key: string
  expected: Record<string, unknown> | null
  actual: Record<string, unknown> | null
  mismatchedFields?: string[]
  backfillable: boolean
}

export interface ShadowAuditSummary {
  authoritativeUsers: number
  shadowUsers: number
  diffCount: number
  countsByScope: Record<ShadowAuditScope, { authoritative: number; shadow: number }>
  diffCountByScope: Record<ShadowAuditScope, number>
  diffCountByOutcome: Record<ShadowDiffOutcome, number>
}

export interface ShadowAuditResult {
  generatedAt: string
  ok: boolean
  filters: {
    email?: string
    userId?: string
    scopes: ShadowAuditScope[]
    maxDiffs: number
  }
  ignoredFields: string[]
  excludedDomains: string[]
  summary: ShadowAuditSummary
  issuancePrerequisites: {
    duplicateAnonymousInstallIds: Array<{ installId: string; userIds: string[] }>
    authenticatedUsersMissingCredentials: Array<{ userId: string; email: string | null }>
  }
  diffs: ShadowAuditDiff[]
  truncated: boolean
}

export interface ShadowBackfillAction {
  kind: ShadowBackfillActionKind
  userId: string
  email: string | null
  key: string
  reason: "missing_in_shadow" | "field_mismatch"
  payload: Record<string, unknown>
  notes?: string[]
}

export interface ShadowBackfillPlan {
  generatedAt: string
  dryRun: true
  summary: {
    actionCount: number
    actionCountByKind: Record<ShadowBackfillActionKind, number>
    backfillableDiffCount: number
    unresolvedDiffCount: number
    wouldReachFullParity: boolean
  }
  actions: ShadowBackfillAction[]
  unresolvedDiffs: ShadowAuditDiff[]
  truncated: boolean
}

export interface ShadowConsistencyInspection {
  audit: ShadowAuditResult
  backfill: ShadowBackfillPlan | null
}

export interface ShadowBackfillApplyResult {
  appliedAt: string
  actionCount: number
  actionCountByKind: Record<ShadowBackfillActionKind, number>
  inspectionBefore: ShadowConsistencyInspection
  inspectionAfter: ShadowConsistencyInspection
}

interface ProjectedShadowUserState {
  user: ShadowUserSnapshot
  credential: ShadowUserCredentialSnapshot | null
  devices: ShadowDeviceSnapshot[]
  sessions: ShadowSessionSnapshot[]
  syncCollections: ShadowSyncCollectionSnapshot[]
  syncMutations: ShadowSyncMutationSnapshot[]
}

interface ActualShadowUserState {
  user: ShadowUserRow | null
  credential: ShadowUserCredentialRow | null
  devices: ShadowDeviceRow[]
  sessions: ShadowSessionRow[]
  syncCollections: ShadowSyncCollectionRow[]
  syncMutations: ShadowSyncMutationRow[]
}

type ComparableRecord = Record<string, unknown>

const IGNORED_FIELDS = ["shadowUpdatedAt", "tokenHash", "tokenHashAlg", "id"] as const
const EXCLUDED_DOMAINS = ["article_import"] as const

function createScopeCounter(): Record<ShadowAuditScope, number> {
  return {
    users: 0,
    credentials: 0,
    devices: 0,
    sessions: 0,
    sync_collections: 0,
    sync_mutations: 0,
  }
}

function createScopeCounts(): Record<ShadowAuditScope, { authoritative: number; shadow: number }> {
  return {
    users: { authoritative: 0, shadow: 0 },
    credentials: { authoritative: 0, shadow: 0 },
    devices: { authoritative: 0, shadow: 0 },
    sessions: { authoritative: 0, shadow: 0 },
    sync_collections: { authoritative: 0, shadow: 0 },
    sync_mutations: { authoritative: 0, shadow: 0 },
  }
}

function normalizeEmail(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function normalizeScopes(scopes: ShadowAuditScope[] | undefined): ShadowAuditScope[] {
  if (!scopes || scopes.length === 0) {
    return [...SHADOW_AUDIT_SCOPES]
  }

  const selected = new Set(scopes)
  return SHADOW_AUDIT_SCOPES.filter((scope) => selected.has(scope))
}

function parseNumericCursor(cursor: string): number {
  const parsed = Number.parseInt(cursor, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function sortSyncMutations(a: ServerSyncMutationRecord, b: ServerSyncMutationRecord): number {
  return parseNumericCursor(a.cursor) - parseNumericCursor(b.cursor)
    || a.serverUpdatedAt.localeCompare(b.serverUpdatedAt)
    || a.clientMutationId.localeCompare(b.clientMutationId)
}

function keyForDevice(userId: string, deviceId: string): string {
  return `${userId}:${deviceId}`
}

function keyForSyncCollection(userId: string, collection: ShadowSyncCollection): string {
  return `${userId}:${collection}`
}

function keyForSyncMutation(userId: string, clientMutationId: string): string {
  return `${userId}:${clientMutationId}`
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue)
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = stableValue((value as Record<string, unknown>)[key])
        return result
      }, {})
  }

  return value
}

function stableSerialize(value: unknown): string {
  return JSON.stringify(stableValue(value))
}

function toPlainRecord(value: unknown): Record<string, unknown> {
  return stableValue(value) as Record<string, unknown>
}

function diffFields(expected: ComparableRecord, actual: ComparableRecord): string[] {
  const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort()
  return keys.filter((key) => stableSerialize(expected[key]) !== stableSerialize(actual[key]))
}

function compareUsers(value: ShadowUserSnapshot | ShadowUserRow): ComparableRecord {
  return {
    id: value.id,
    email: value.email,
    billingEmail: value.billingEmail,
    createdAt: value.createdAt,
    plan: value.plan,
    subscriptionStatus: value.subscriptionStatus,
    identityMode: value.identityMode,
    installId: value.installId ?? null,
    providerEntitlements: [...value.providerEntitlements].sort(),
    syncPreferences: {
      reading_history: value.syncPreferences.reading_history,
      study_progress: value.syncPreferences.study_progress,
    },
  }
}

function compareCredentials(
  value: ShadowUserCredentialSnapshot | ShadowUserCredentialRow,
): ComparableRecord {
  return {
    userId: value.userId,
    credentialKind: value.credentialKind,
    passwordHash: value.passwordHash,
    passwordHashAlg: value.passwordHashAlg,
    updatedAt: value.updatedAt,
  }
}

function compareDevices(value: ShadowDeviceSnapshot | ShadowDeviceRow): ComparableRecord {
  return {
    userId: value.userId,
    deviceId: value.deviceId,
    identityMode: value.identityMode,
    label: value.label,
    platform: value.platform ?? null,
    browserFamily: value.browserFamily ?? null,
    appKind: value.appKind,
    appVersion: value.appVersion ?? null,
    firstSeenAt: value.firstSeenAt,
    lastSeenAt: value.lastSeenAt,
    lastSyncAt: value.lastSyncAt ?? null,
    status: value.status,
    revokedAt: value.revokedAt ?? null,
    updatedAt: value.updatedAt,
  }
}

function compareSessions(value: ShadowSessionSnapshot | ShadowSessionRow): ComparableRecord {
  return {
    sessionId: value.sessionId,
    userId: value.userId,
    deviceId: value.deviceId,
    identityMode: value.identityMode,
    issuedAt: value.issuedAt,
    expiresAt: value.expiresAt ?? null,
    createdAt: value.createdAt,
    lastSeenAt: value.lastSeenAt,
    lastVerifiedAt: value.lastVerifiedAt ?? null,
    status: value.status,
    revokedAt: value.revokedAt ?? null,
  }
}

function compareSyncCollections(value: ShadowSyncCollectionSnapshot | ShadowSyncCollectionRow): ComparableRecord {
  return {
    userId: value.userId,
    collection: value.collection,
    enabled: value.enabled,
    defaultEnabled: value.defaultEnabled,
    lastIssuedCursor: value.lastIssuedCursor ?? null,
    lastServerUpdatedAt: value.lastServerUpdatedAt ?? null,
  }
}

function compareSyncMutations(value: ShadowSyncMutationSnapshot | ShadowSyncMutationRow): ComparableRecord {
  return {
    serverMutationId: value.serverMutationId ?? null,
    userId: value.userId,
    collection: value.collection,
    schemaVersion: value.schemaVersion,
    recordId: value.recordId,
    operation: value.operation,
    clientMutationId: value.clientMutationId,
    deviceId: value.deviceId,
    clientUpdatedAt: value.clientUpdatedAt,
    serverUpdatedAt: value.serverUpdatedAt,
    cursor: value.cursor,
    payload: stableValue(value.payload ?? null),
  }
}

function projectExpectedShadowStateForUser(params: {
  user: ServerUserRecord
  devices: ServerDeviceRecord[]
  sessions: ServerSessionRecord[]
  syncMutations: ServerSyncMutationRecord[]
}): ProjectedShadowUserState {
  const syncCollections = new Map<ShadowSyncCollection, ShadowSyncCollectionSnapshot>(
    SHADOW_SYNC_COLLECTIONS.map((collection) => [
      collection,
      {
        userId: params.user.id,
        collection,
        enabled: collection === "config" || collection === "vocabulary"
          ? true
          : collection === "reading_history"
            ? params.user.syncPreferences.reading_history
            : params.user.syncPreferences.study_progress,
        defaultEnabled: collection === "config" || collection === "vocabulary",
        lastIssuedCursor: null,
        lastServerUpdatedAt: null,
      },
    ]),
  )

  const syncMutations = [...params.syncMutations]
    .sort(sortSyncMutations)
    .map((mutation) => {
      const collection = mutation.collection as ShadowSyncCollection
      const projected: ShadowSyncMutationSnapshot = {
        userId: params.user.id,
        collection,
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
      }

      const collectionState = syncCollections.get(collection)
      if (collectionState) {
        syncCollections.set(collection, {
          ...collectionState,
          lastIssuedCursor: mutation.cursor,
          lastServerUpdatedAt: mutation.serverUpdatedAt,
        })
      }

      return projected
    })

  return {
    user: buildShadowUserSnapshot(params.user, params.user.createdAt),
    credential: params.user.identityMode === "authenticated"
      ? buildShadowUserCredentialSnapshot(params.user, params.user.createdAt)
      : null,
    devices: [...params.devices]
      .sort((a, b) => a.deviceId.localeCompare(b.deviceId))
      .map((device) => buildShadowDeviceSnapshot(device)),
    sessions: [...params.sessions]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.sessionId.localeCompare(b.sessionId))
      .map((session) => buildShadowSessionSnapshot(session)),
    syncCollections: SHADOW_SYNC_COLLECTIONS.map((collection) => syncCollections.get(collection)!),
    syncMutations,
  }
}

function filterAuthoritativeUsers(
  users: ServerUserRecord[],
  filters: ShadowAuditFilters,
): ServerUserRecord[] {
  const email = normalizeEmail(filters.email)
  return users.filter((user) => {
    if (filters.userId && user.id !== filters.userId) {
      return false
    }

    if (email && user.email !== email) {
      return false
    }

    return true
  })
}

function filterAuthoritativeDevices(
  user: ServerUserRecord,
  devices: ServerDeviceRecord[],
): ServerDeviceRecord[] {
  return devices.filter((device) => device.userId === user.id || device.email === user.email)
}

function filterAuthoritativeSessions(
  user: ServerUserRecord,
  sessions: ServerSessionRecord[],
): ServerSessionRecord[] {
  return sessions.filter((session) => session.userId === user.id || session.email === user.email)
}

function filterAuthoritativeSyncMutations(
  user: ServerUserRecord,
  syncMutations: ServerSyncMutationRecord[],
): ServerSyncMutationRecord[] {
  return syncMutations.filter((mutation) => mutation.ownerId === user.id || mutation.email === user.email)
}

async function loadActualShadowStateForUser(
  db: D1Database,
  userId: string,
  shadowUser: ShadowUserRow | null,
): Promise<ActualShadowUserState> {
  const [credential, devices, sessions, syncCollections, syncMutations] = await Promise.all([
    getShadowUserCredential(db, userId),
    listShadowDeviceRowsForUser(db, userId),
    listShadowSessionsForUser(db, userId),
    listShadowSyncCollectionRowsForUser(db, userId),
    listShadowSyncMutationsForUser(db, userId),
  ])

  return {
    user: shadowUser,
    credential,
    devices,
    sessions,
    syncCollections,
    syncMutations,
  }
}

function collectDuplicateAnonymousInstallIds(
  users: ServerUserRecord[],
): Array<{ installId: string; userIds: string[] }> {
  const userIdsByInstallId = new Map<string, string[]>()

  for (const user of users) {
    if (user.identityMode !== "anonymous" || !user.installId) continue
    const existing = userIdsByInstallId.get(user.installId) ?? []
    existing.push(user.id)
    userIdsByInstallId.set(user.installId, existing)
  }

  return [...userIdsByInstallId.entries()]
    .filter(([, userIds]) => userIds.length > 1)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([installId, userIds]) => ({ installId, userIds: [...userIds].sort() }))
}

function compareEntities<ExpectedValue, ActualValue>(params: {
  scope: ShadowAuditScope
  expected: Array<{ key: string; userId: string; email: string | null; value: ExpectedValue }>
  actual: Array<{ key: string; userId: string; email: string | null; value: ActualValue }>
  compareExpected: (value: ExpectedValue) => ComparableRecord
  compareActual: (value: ActualValue) => ComparableRecord
}): ShadowAuditDiff[] {
  const expectedMap = new Map(params.expected.map((entry) => [entry.key, entry]))
  const actualMap = new Map(params.actual.map((entry) => [entry.key, entry]))
  const keys = [...new Set([...expectedMap.keys(), ...actualMap.keys()])].sort()
  const diffs: ShadowAuditDiff[] = []

  for (const key of keys) {
    const expected = expectedMap.get(key)
    const actual = actualMap.get(key)

    if (expected && !actual) {
      diffs.push({
        scope: params.scope,
        outcome: "missing_in_shadow",
        userId: expected.userId,
        email: expected.email,
        key,
        expected: params.compareExpected(expected.value),
        actual: null,
        backfillable: true,
      })
      continue
    }

    if (!expected && actual) {
      diffs.push({
        scope: params.scope,
        outcome: "extra_in_shadow",
        userId: actual.userId,
        email: actual.email,
        key,
        expected: null,
        actual: params.compareActual(actual.value),
        backfillable: false,
      })
      continue
    }

    if (!expected || !actual) {
      continue
    }

    const comparableExpected = params.compareExpected(expected.value)
    const comparableActual = params.compareActual(actual.value)
    const mismatchedFields = diffFields(comparableExpected, comparableActual)

    if (mismatchedFields.length > 0) {
      diffs.push({
        scope: params.scope,
        outcome: "field_mismatch",
        userId: expected.userId,
        email: expected.email ?? actual.email,
        key,
        expected: comparableExpected,
        actual: comparableActual,
        mismatchedFields,
        backfillable: true,
      })
    }
  }

  return diffs
}

function toBackfillReason(outcome: ShadowDiffOutcome): "missing_in_shadow" | "field_mismatch" {
  return outcome === "missing_in_shadow" ? "missing_in_shadow" : "field_mismatch"
}

function buildBackfillPlan(params: {
  generatedAt: string
  auditDiffs: ShadowAuditDiff[]
  projectedByUserId: Map<string, ProjectedShadowUserState>
  emailByUserId: Map<string, string | null>
  maxActions: number
}): ShadowBackfillPlan {
  const actionableDiffs = params.auditDiffs.filter((diff) => diff.backfillable)
  const unresolvedDiffs = params.auditDiffs.filter((diff) => !diff.backfillable)
  const diffIndex = new Map(actionableDiffs.map((diff) => [`${diff.scope}:${diff.key}`, diff]))
  const actions: ShadowBackfillAction[] = []

  for (const userId of [...params.projectedByUserId.keys()].sort()) {
    const projected = params.projectedByUserId.get(userId)
    if (!projected) continue

    const email = params.emailByUserId.get(userId) ?? null
    const userDiff = diffIndex.get(`users:${projected.user.id}`)
    if (userDiff) {
      actions.push({
        kind: "upsert_user",
        userId,
        email,
        key: projected.user.id,
        reason: toBackfillReason(userDiff.outcome),
        payload: toPlainRecord(projected.user),
      })
    }

    if (projected.credential) {
      const credentialDiff = diffIndex.get(`credentials:${userId}`)
      if (credentialDiff) {
        actions.push({
          kind: "upsert_user_credential",
          userId,
          email,
          key: userId,
          reason: toBackfillReason(credentialDiff.outcome),
          payload: toPlainRecord(projected.credential),
        })
      }
    }

    const syncCollectionDiff = projected.syncCollections.some((collection) =>
      diffIndex.has(`sync_collections:${keyForSyncCollection(userId, collection.collection)}`),
    )
    if (syncCollectionDiff) {
      actions.push({
        kind: "mirror_sync_collections",
        userId,
        email,
        key: userId,
        reason: "field_mismatch",
        payload: {
          userId,
          syncPreferences: projected.user.syncPreferences,
          collections: projected.syncCollections,
        },
      })
    }

    for (const device of [...projected.devices].sort((a, b) => a.deviceId.localeCompare(b.deviceId))) {
      const key = keyForDevice(userId, device.deviceId)
      const diff = diffIndex.get(`devices:${key}`)
      if (!diff) continue

      actions.push({
        kind: "upsert_device",
        userId,
        email,
        key,
        reason: toBackfillReason(diff.outcome),
        payload: toPlainRecord(device),
      })
    }

    for (const session of [...projected.sessions].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.sessionId.localeCompare(b.sessionId),
    )) {
      const diff = diffIndex.get(`sessions:${session.sessionId}`)
      if (!diff) continue

      actions.push({
        kind: "upsert_session",
        userId,
        email,
        key: session.sessionId,
        reason: toBackfillReason(diff.outcome),
        payload: toPlainRecord(session),
        notes: [
          diff.outcome === "missing_in_shadow"
            ? "Session token hashes are not reconstructable from the authoritative Node store; this dry-run only backfills the audited session metadata shape."
            : "Preserve existing tokenHash/tokenHashAlg fields if an apply path is added later; the authoritative Node store does not retain raw session tokens.",
        ],
      })
    }

    for (const mutation of [...projected.syncMutations].sort((a, b) =>
      parseNumericCursor(a.cursor) - parseNumericCursor(b.cursor)
      || a.serverUpdatedAt.localeCompare(b.serverUpdatedAt)
      || a.clientMutationId.localeCompare(b.clientMutationId),
    )) {
      const key = keyForSyncMutation(userId, mutation.clientMutationId)
      const diff = diffIndex.get(`sync_mutations:${key}`)
      if (!diff) continue

      actions.push({
        kind: "append_sync_mutation",
        userId,
        email,
        key,
        reason: toBackfillReason(diff.outcome),
        payload: toPlainRecord(mutation),
      })
    }
  }

  const actionCountByKind: Record<ShadowBackfillActionKind, number> = {
    upsert_user: 0,
    upsert_user_credential: 0,
    upsert_device: 0,
    upsert_session: 0,
    mirror_sync_collections: 0,
    append_sync_mutation: 0,
  }

  for (const action of actions) {
    actionCountByKind[action.kind] += 1
  }

  return {
    generatedAt: params.generatedAt,
    dryRun: true,
    summary: {
      actionCount: actions.length,
      actionCountByKind,
      backfillableDiffCount: actionableDiffs.length,
      unresolvedDiffCount: unresolvedDiffs.length,
      wouldReachFullParity: unresolvedDiffs.length === 0,
    },
    actions: actions.slice(0, params.maxActions),
    unresolvedDiffs,
    truncated: actions.length > params.maxActions,
  }
}

export async function inspectCloudflareShadowConsistency(params: {
  env: RelayEnv
  db: D1Database
  filters?: ShadowAuditFilters
  includeBackfillPlan?: boolean
  maxActions?: number
}): Promise<ShadowConsistencyInspection> {
  const generatedAt = new Date().toISOString()
  const filters = params.filters ?? {}
  const scopes = normalizeScopes(filters.scopes)
  const maxDiffs = filters.maxDiffs ?? 200
  const maxActions = params.maxActions ?? 200

  const authoritativeDb = await loadAuthoritativeUserDatabase(params.env, {
    seedIfMissing: false,
    persistNormalized: false,
  })

  const authoritativeUsers = filterAuthoritativeUsers(authoritativeDb.users, filters)
  const shadowUsers = await listShadowUsers(params.db, {
    userId: filters.userId,
    email: normalizeEmail(filters.email),
  })

  const shadowUsersById = new Map(shadowUsers.map((user) => [user.id, user]))
  const emailByUserId = new Map<string, string | null>()
  const projectedByUserId = new Map<string, ProjectedShadowUserState>()
  const actualByUserId = new Map<string, ActualShadowUserState>()

  for (const user of authoritativeUsers) {
    emailByUserId.set(user.id, user.email)
    projectedByUserId.set(user.id, projectExpectedShadowStateForUser({
      user,
      devices: filterAuthoritativeDevices(user, authoritativeDb.devices),
      sessions: filterAuthoritativeSessions(user, authoritativeDb.sessions),
      syncMutations: filterAuthoritativeSyncMutations(user, authoritativeDb.syncMutations),
    }))
  }

  for (const shadowUser of shadowUsers) {
    emailByUserId.set(shadowUser.id, shadowUser.email)
  }

  const userIds = [...new Set([...projectedByUserId.keys(), ...shadowUsersById.keys()])].sort()
  for (const userId of userIds) {
    actualByUserId.set(userId, await loadActualShadowStateForUser(params.db, userId, shadowUsersById.get(userId) ?? null))
  }

  const countsByScope = createScopeCounts()
  countsByScope.users = {
    authoritative: authoritativeUsers.length,
    shadow: shadowUsers.length,
  }

  for (const userId of userIds) {
    const projected = projectedByUserId.get(userId)
    const actual = actualByUserId.get(userId)
    countsByScope.credentials.authoritative += projected?.credential ? 1 : 0
    countsByScope.credentials.shadow += actual?.credential ? 1 : 0
    countsByScope.devices.authoritative += projected?.devices.length ?? 0
    countsByScope.devices.shadow += actual?.devices.length ?? 0
    countsByScope.sessions.authoritative += projected?.sessions.length ?? 0
    countsByScope.sessions.shadow += actual?.sessions.length ?? 0
    countsByScope.sync_collections.authoritative += projected?.syncCollections.length ?? 0
    countsByScope.sync_collections.shadow += actual?.syncCollections.length ?? 0
    countsByScope.sync_mutations.authoritative += projected?.syncMutations.length ?? 0
    countsByScope.sync_mutations.shadow += actual?.syncMutations.length ?? 0
  }

  const allDiffs: ShadowAuditDiff[] = []

  if (scopes.includes("users")) {
    allDiffs.push(...compareEntities({
      scope: "users",
      expected: authoritativeUsers.map((user) => ({
        key: user.id,
        userId: user.id,
        email: user.email,
        value: projectedByUserId.get(user.id)!.user,
      })),
      actual: shadowUsers.map((user) => ({
        key: user.id,
        userId: user.id,
        email: user.email,
        value: user,
      })),
      compareExpected: compareUsers,
      compareActual: compareUsers,
    }))
  }

  if (scopes.includes("credentials")) {
    allDiffs.push(...compareEntities({
      scope: "credentials",
      expected: userIds.flatMap((userId) => {
        const credential = projectedByUserId.get(userId)?.credential
        if (!credential) return []

        return [{
          key: userId,
          userId,
          email: emailByUserId.get(userId) ?? null,
          value: credential,
        }]
      }),
      actual: userIds.flatMap((userId) => {
        const credential = actualByUserId.get(userId)?.credential
        if (!credential) return []

        return [{
          key: userId,
          userId,
          email: emailByUserId.get(userId) ?? null,
          value: credential,
        }]
      }),
      compareExpected: compareCredentials,
      compareActual: compareCredentials,
    }))
  }

  if (scopes.includes("devices")) {
    allDiffs.push(...compareEntities({
      scope: "devices",
      expected: userIds.flatMap((userId) =>
        (projectedByUserId.get(userId)?.devices ?? []).map((device) => ({
          key: keyForDevice(userId, device.deviceId),
          userId,
          email: emailByUserId.get(userId) ?? null,
          value: device,
        })),
      ),
      actual: userIds.flatMap((userId) =>
        (actualByUserId.get(userId)?.devices ?? []).map((device) => ({
          key: keyForDevice(userId, device.deviceId),
          userId,
          email: emailByUserId.get(userId) ?? null,
          value: device,
        })),
      ),
      compareExpected: compareDevices,
      compareActual: compareDevices,
    }))
  }

  if (scopes.includes("sessions")) {
    allDiffs.push(...compareEntities({
      scope: "sessions",
      expected: userIds.flatMap((userId) =>
        (projectedByUserId.get(userId)?.sessions ?? []).map((session) => ({
          key: session.sessionId,
          userId,
          email: emailByUserId.get(userId) ?? null,
          value: session,
        })),
      ),
      actual: userIds.flatMap((userId) =>
        (actualByUserId.get(userId)?.sessions ?? []).map((session) => ({
          key: session.sessionId,
          userId,
          email: emailByUserId.get(userId) ?? null,
          value: session,
        })),
      ),
      compareExpected: compareSessions,
      compareActual: compareSessions,
    }))
  }

  if (scopes.includes("sync_collections")) {
    allDiffs.push(...compareEntities({
      scope: "sync_collections",
      expected: userIds.flatMap((userId) =>
        (projectedByUserId.get(userId)?.syncCollections ?? []).map((collection) => ({
          key: keyForSyncCollection(userId, collection.collection),
          userId,
          email: emailByUserId.get(userId) ?? null,
          value: collection,
        })),
      ),
      actual: userIds.flatMap((userId) =>
        (actualByUserId.get(userId)?.syncCollections ?? []).map((collection) => ({
          key: keyForSyncCollection(userId, collection.collection),
          userId,
          email: emailByUserId.get(userId) ?? null,
          value: collection,
        })),
      ),
      compareExpected: compareSyncCollections,
      compareActual: compareSyncCollections,
    }))
  }

  if (scopes.includes("sync_mutations")) {
    allDiffs.push(...compareEntities({
      scope: "sync_mutations",
      expected: userIds.flatMap((userId) =>
        (projectedByUserId.get(userId)?.syncMutations ?? []).map((mutation) => ({
          key: keyForSyncMutation(userId, mutation.clientMutationId),
          userId,
          email: emailByUserId.get(userId) ?? null,
          value: mutation,
        })),
      ),
      actual: userIds.flatMap((userId) =>
        (actualByUserId.get(userId)?.syncMutations ?? []).map((mutation) => ({
          key: keyForSyncMutation(userId, mutation.clientMutationId),
          userId,
          email: emailByUserId.get(userId) ?? null,
          value: mutation,
        })),
      ),
      compareExpected: compareSyncMutations,
      compareActual: compareSyncMutations,
    }).map((diff) => (
      diff.outcome === "field_mismatch"
        ? { ...diff, backfillable: false }
        : diff
    )))
  }

  const diffCountByScope = createScopeCounter()
  const diffCountByOutcome: Record<ShadowDiffOutcome, number> = {
    missing_in_shadow: 0,
    extra_in_shadow: 0,
    field_mismatch: 0,
  }

  for (const diff of allDiffs) {
    diffCountByScope[diff.scope] += 1
    diffCountByOutcome[diff.outcome] += 1
  }

  const duplicateAnonymousInstallIds = collectDuplicateAnonymousInstallIds(authoritativeUsers)
  const authenticatedUsersMissingCredentials = authoritativeUsers
    .filter((user) => user.identityMode === "authenticated" && !actualByUserId.get(user.id)?.credential)
    .map((user) => ({ userId: user.id, email: user.email }))

  const audit: ShadowAuditResult = {
    generatedAt,
    ok: allDiffs.length === 0,
    filters: {
      ...(filters.email ? { email: normalizeEmail(filters.email) } : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
      scopes,
      maxDiffs,
    },
    ignoredFields: [...IGNORED_FIELDS],
    excludedDomains: [...EXCLUDED_DOMAINS],
    summary: {
      authoritativeUsers: authoritativeUsers.length,
      shadowUsers: shadowUsers.length,
      diffCount: allDiffs.length,
      countsByScope,
      diffCountByScope,
      diffCountByOutcome,
    },
    issuancePrerequisites: {
      duplicateAnonymousInstallIds,
      authenticatedUsersMissingCredentials,
    },
    diffs: allDiffs.slice(0, maxDiffs),
    truncated: allDiffs.length > maxDiffs,
  }

  return {
    audit,
    backfill: params.includeBackfillPlan
      ? buildBackfillPlan({
        generatedAt,
        auditDiffs: allDiffs,
        projectedByUserId,
        emailByUserId,
        maxActions,
      })
      : null,
  }
}

function createActionCountByKind(): Record<ShadowBackfillActionKind, number> {
  return {
    upsert_user: 0,
    upsert_user_credential: 0,
    upsert_device: 0,
    upsert_session: 0,
    mirror_sync_collections: 0,
    append_sync_mutation: 0,
  }
}

function isCollectionEnabled(
  syncPreferences: ShadowUserSnapshot["syncPreferences"],
  collection: ShadowSyncCollection,
): boolean {
  if (collection === "config" || collection === "vocabulary") return true
  if (collection === "reading_history") return syncPreferences.reading_history
  return syncPreferences.study_progress
}

export async function applyCloudflareShadowBackfill(params: {
  env: RelayEnv
  db: D1Database
  filters?: ShadowAuditFilters
  maxDiffs?: number
  maxActions?: number
}): Promise<ShadowBackfillApplyResult> {
  const inspectionBefore = await inspectCloudflareShadowConsistency({
    env: params.env,
    db: params.db,
    filters: {
      ...params.filters,
      maxDiffs: params.maxDiffs ?? params.filters?.maxDiffs,
    },
    includeBackfillPlan: true,
    maxActions: params.maxActions,
  })

  const plan = inspectionBefore.backfill
  if (plan?.truncated) {
    throw new Error(
      `Backfill apply aborted because the plan exceeds the current --max-actions cap (${plan.actions.length}/${plan.summary.actionCount} actions rendered). Re-run with a higher --max-actions value or narrower filters.`,
    )
  }

  const authoritativeDb = await loadAuthoritativeUserDatabase(params.env, {
    seedIfMissing: false,
    persistNormalized: false,
  })
  const actionCountByKind = createActionCountByKind()
  const syncPreferencesByUserId = new Map<string, ShadowUserSnapshot["syncPreferences"]>(
    authoritativeDb.users.map((user) => [user.id, user.syncPreferences]),
  )

  for (const action of plan?.actions ?? []) {
    actionCountByKind[action.kind] += 1

    if (action.kind === "upsert_user") {
      const snapshot = action.payload as unknown as ShadowUserSnapshot
      syncPreferencesByUserId.set(snapshot.id, snapshot.syncPreferences)
      await upsertShadowUser(params.db, snapshot)
      continue
    }

    if (action.kind === "upsert_user_credential") {
      await upsertShadowUserCredential(params.db, action.payload as unknown as ShadowUserCredentialSnapshot)
      continue
    }

    if (action.kind === "upsert_device") {
      await upsertShadowDevice(params.db, action.payload as unknown as ShadowDeviceSnapshot)
      continue
    }

    if (action.kind === "upsert_session") {
      const snapshot = action.payload as unknown as ShadowSessionSnapshot
      const existing = await getShadowSessionById(params.db, snapshot.sessionId)
      await upsertShadowSession(params.db, {
        ...snapshot,
        tokenHash: snapshot.tokenHash ?? existing?.tokenHash ?? null,
        tokenHashAlg: snapshot.tokenHashAlg ?? existing?.tokenHashAlg ?? null,
      })
      continue
    }

    if (action.kind === "mirror_sync_collections") {
      const payload = action.payload as unknown as {
        userId: string
        syncPreferences: ShadowUserSnapshot["syncPreferences"]
        collections: ShadowSyncCollectionSnapshot[]
      }
      syncPreferencesByUserId.set(payload.userId, payload.syncPreferences)
      for (const collection of payload.collections) {
        await upsertShadowSyncCollection(params.db, collection)
      }
      continue
    }

    const snapshot = action.payload as unknown as ShadowSyncMutationSnapshot
    const syncPreferences = syncPreferencesByUserId.get(snapshot.userId)
    await appendShadowSyncMutation(params.db, {
      ...snapshot,
      collectionEnabled: syncPreferences
        ? isCollectionEnabled(syncPreferences, snapshot.collection)
        : snapshot.collection === "config" || snapshot.collection === "vocabulary",
      collectionDefaultEnabled: snapshot.collection === "config" || snapshot.collection === "vocabulary",
    })
  }

  const inspectionAfter = await inspectCloudflareShadowConsistency({
    env: params.env,
    db: params.db,
    filters: {
      ...params.filters,
      maxDiffs: params.maxDiffs ?? params.filters?.maxDiffs,
    },
    includeBackfillPlan: true,
    maxActions: params.maxActions,
  })

  return {
    appliedAt: new Date().toISOString(),
    actionCount: plan?.actions.length ?? 0,
    actionCountByKind,
    inspectionBefore,
    inspectionAfter,
  }
}
