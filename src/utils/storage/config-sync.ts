import { browser } from "#imports"
import { z } from "zod"

import type {
  AstraDeviceIdentity,
  AstraDeviceListEntry,
  AstraSession,
  AstraSyncBootstrap,
  AstraSyncMutationInput,
  AstraSyncPullResponse,
} from "@/types/auth"
import {
  AstraConfigSchema,
  AstraConfigSyncRecordSchema,
  AstraSyncCollectionSchema,
  CONFIG_SYNC_GLOBAL_RECORD_ID,
  DEFAULT_ASTRA_CONFIG,
  applyConfigSyncMutations,
  buildConfigSyncRecordMap,
  buildSyncSafeConfig,
  mergeSyncSafeConfig,
  normalizeConfig,
  summarizeConfigContinuity,
  type AstraConfig,
  type AstraConfigContinuitySummary,
  type AstraConfigSyncRecord,
  type AstraSyncCollection,
  type AstraSyncedConfig,
} from "@/types/config"
import {
  AstraApiError,
  fetchAstraSyncBootstrap,
  pullAstraSyncDeltas,
  pushAstraSyncMutations,
  repairAstraSyncState,
} from "@/utils/astra/account"
import { ensureAstraDeviceIdentity, readAstraSession } from "./auth"
import { ASTRA_CONFIG_STORAGE_KEY, readConfig, replaceConfig } from "./config"
import {
  READING_HISTORY_STORAGE_KEY,
  SyncedReadingHistoryEntrySchema,
  applyReadingHistorySyncMutations,
  buildReadingHistorySyncRecordMap,
  getReadingHistory,
  readSyncSafeReadingHistory,
  replaceReadingHistory,
  type SyncedReadingHistoryEntry,
} from "./reading-history"
import {
  SyncedStudyPageProgressSchema,
  applyStudyProgressSyncMutations,
  buildStudyProgressSyncRecordMap,
  getStudyProgress,
  readSyncSafeStudyProgressPages,
  replaceStudyProgressPages,
  type SyncedStudyPageProgress,
} from "./study-progress"
import {
  SyncedVocabularyEntrySchema,
  VOCABULARY_STORAGE_KEY,
  applyVocabularySyncMutations,
  buildVocabularySyncRecordMap,
  getVocabularyEntries,
  readSyncSafeVocabularyEntries,
  replaceVocabularyEntries,
  type SyncedVocabularyEntry,
} from "./vocabulary"

interface AstraBackup {
  _astraBackup: true
  exportedAt: string
  config: AstraConfig
  vocabulary: unknown[]
  readingHistory: unknown[]
}

interface ContinuityCollectionStatus {
  enabled: boolean
  defaultEnabled: boolean
  bootstrapCursor: string | null
  nextCursor: string | null
  hasPull: boolean
  deltaCount: number
}

export interface AstraContinuityStatus {
  device: {
    ready: boolean
    deviceId: string | null
    label: string | null
  }
  session: {
    state: "signed-out" | "anonymous" | "authenticated"
    sessionId: string | null
    deviceBound: boolean
    issuedAt: string | null
    expiresAt: string | null
  }
  sync: {
    configReady: true
    vocabularyReady: true
    deferredCollections: AstraSyncCollection[]
    syncSafeConfig: AstraSyncedConfig
    localOnly: AstraConfigContinuitySummary
  }
  remote: {
    available: boolean
    error: string | null
    serverTime: string | null
    devices: AstraDeviceListEntry[]
    deviceCount: number
    activeDeviceCount: number
    currentDevice: AstraDeviceListEntry | null
    configCollection: ContinuityCollectionStatus | null
    vocabularyCollection: ContinuityCollectionStatus | null
    readingHistoryCollection: ContinuityCollectionStatus | null
    studyProgressCollection: ContinuityCollectionStatus | null
  }
}

export interface AstraContinuityRemoteSnapshot {
  devices?: AstraDeviceListEntry[]
  bootstrap?: AstraSyncBootstrap | null
  pull?: AstraSyncPullResponse | null
  error?: string | null
}

export interface AstraPhaseOneSyncResult {
  skipped: boolean
  reason:
    | "no-session"
    | "anonymous-session"
    | "missing-relay-base-url"
    | "synced"
  pushed: {
    config: number
    vocabulary: number
    reading_history: number
    study_progress: number
  }
  pulled: {
    config: number
    vocabulary: number
    reading_history: number
    study_progress: number
  }
  rejected: number
}

interface AstraPhaseOneSyncState {
  version: 1
  accountEmail: string | null
  collections: {
    config: {
      cursor: string | null
      shadow: Record<string, AstraConfigSyncRecord>
    }
    vocabulary: {
      cursor: string | null
      shadow: Record<string, SyncedVocabularyEntry>
    }
    reading_history: {
      cursor: string | null
      shadow: Record<string, SyncedReadingHistoryEntry>
    }
    study_progress: {
      cursor: string | null
      shadow: Record<string, SyncedStudyPageProgress>
    }
  }
  lastRunAt: string | null
  lastSuccessAt: string | null
  lastError: string | null
}

const ASTRA_PHASE_ONE_SYNC_STATE_STORAGE_KEY = "astra.sync.phase1.v1"
const SYNC_SCHEMA_VERSION = 1
const CONFIG_SYNC_OPTIONS = { includeManagedRelayBaseURL: true } as const
const DEFAULT_CONFIG_RECORD_MAP = buildConfigSyncRecordMap(DEFAULT_ASTRA_CONFIG, CONFIG_SYNC_OPTIONS)
const DEFAULT_CONFIG_GLOBAL_RECORD = DEFAULT_CONFIG_RECORD_MAP[CONFIG_SYNC_GLOBAL_RECORD_ID]

const PhaseOneSyncStateSchema = z.object({
  version: z.literal(1).default(1),
  accountEmail: z.string().trim().min(1).nullable().default(null),
  collections: z.object({
    config: z.object({
      cursor: z.string().trim().min(1).nullable().default(null),
      shadow: z.record(z.string(), AstraConfigSyncRecordSchema).default({}),
    }).default({
      cursor: null,
      shadow: {},
    }),
    vocabulary: z.object({
      cursor: z.string().trim().min(1).nullable().default(null),
      shadow: z.record(z.string(), SyncedVocabularyEntrySchema).default({}),
    }).default({
      cursor: null,
      shadow: {},
    }),
    reading_history: z.object({
      cursor: z.string().trim().min(1).nullable().default(null),
      shadow: z.record(z.string(), SyncedReadingHistoryEntrySchema).default({}),
    }).default({
      cursor: null,
      shadow: {},
    }),
    study_progress: z.object({
      cursor: z.string().trim().min(1).nullable().default(null),
      shadow: z.record(z.string(), SyncedStudyPageProgressSchema).default({}),
    }).default({
      cursor: null,
      shadow: {},
    }),
  }).default({
    config: { cursor: null, shadow: {} },
    vocabulary: { cursor: null, shadow: {} },
    reading_history: { cursor: null, shadow: {} },
    study_progress: { cursor: null, shadow: {} },
  }),
  lastRunAt: z.string().trim().min(1).nullable().default(null),
  lastSuccessAt: z.string().trim().min(1).nullable().default(null),
  lastError: z.string().trim().min(1).nullable().default(null),
})

export const DEFERRED_CONTINUITY_COLLECTIONS = AstraSyncCollectionSchema.array().parse([
])

function createEmptySyncState(accountEmail: string | null = null): AstraPhaseOneSyncState {
  return {
    version: 1,
    accountEmail,
    collections: {
      config: {
        cursor: null,
        shadow: {},
      },
      vocabulary: {
        cursor: null,
        shadow: {},
      },
      reading_history: {
        cursor: null,
        shadow: {},
      },
      study_progress: {
        cursor: null,
        shadow: {},
      },
    },
    lastRunAt: null,
    lastSuccessAt: null,
    lastError: null,
  }
}

function normalizeSyncState(
  raw: unknown,
  accountEmail: string,
): AstraPhaseOneSyncState {
  const parsed = PhaseOneSyncStateSchema.safeParse(raw)
  if (!parsed.success || parsed.data.accountEmail !== accountEmail) {
    return createEmptySyncState(accountEmail)
  }
  return parsed.data
}

async function readPhaseOneSyncState(accountEmail: string): Promise<AstraPhaseOneSyncState> {
  const stored = await browser.storage.local.get(ASTRA_PHASE_ONE_SYNC_STATE_STORAGE_KEY)
  return normalizeSyncState(stored[ASTRA_PHASE_ONE_SYNC_STATE_STORAGE_KEY], accountEmail)
}

async function writePhaseOneSyncState(state: AstraPhaseOneSyncState): Promise<void> {
  const normalized = PhaseOneSyncStateSchema.parse(state)
  await browser.storage.local.set({
    [ASTRA_PHASE_ONE_SYNC_STATE_STORAGE_KEY]: normalized,
  })
}

function buildContinuityCollectionStatus(
  bootstrapState: AstraSyncBootstrap["collections"][AstraSyncCollection] | null,
  nextCursor: string | null | undefined,
  deltaCount: number,
  hasPull: boolean,
): ContinuityCollectionStatus | null {
  if (!bootstrapState) return null

  return {
    enabled: bootstrapState.enabled,
    defaultEnabled: bootstrapState.defaultEnabled,
    bootstrapCursor: bootstrapState.cursor,
    nextCursor: nextCursor ?? bootstrapState.cursor,
    hasPull,
    deltaCount,
  }
}

function createClientMutationId(collection: "config" | "vocabulary" | "reading_history" | "study_progress", recordId: string, operation: "upsert" | "delete"): string {
  return `${collection}:${recordId}:${operation}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`
}

function diffRecordMaps<T>(params: {
  collection: "config" | "vocabulary" | "reading_history" | "study_progress"
  current: Record<string, T>
  shadow: Record<string, T>
  deviceId: string
  nowIso: string
}): AstraSyncMutationInput[] {
  const mutations: AstraSyncMutationInput[] = []

  for (const [recordId, value] of Object.entries(params.current)) {
    if (JSON.stringify(value) === JSON.stringify(params.shadow[recordId])) continue

    mutations.push({
      collection: params.collection,
      schemaVersion: SYNC_SCHEMA_VERSION,
      recordId,
      operation: "upsert",
      clientMutationId: createClientMutationId(params.collection, recordId, "upsert"),
      deviceId: params.deviceId,
      clientUpdatedAt: params.nowIso,
      payload: value as Record<string, unknown>,
    })
  }

  for (const recordId of Object.keys(params.shadow)) {
    if (recordId in params.current) continue

    mutations.push({
      collection: params.collection,
      schemaVersion: SYNC_SCHEMA_VERSION,
      recordId,
      operation: "delete",
      clientMutationId: createClientMutationId(params.collection, recordId, "delete"),
      deviceId: params.deviceId,
      clientUpdatedAt: params.nowIso,
      payload: null,
    })
  }

  return mutations
}

function buildContinuityLocalOnlySummary(config: AstraConfig): AstraConfigContinuitySummary {
  const configSummary = summarizeConfigContinuity(config)
  return {
    ...configSummary,
    localOnlyFields: [
      ...configSummary.localOnlyFields,
      "study_progress.dailyStats",
      "vocabulary.srsBox",
      "vocabulary.nextReviewAt",
      "vocabulary.reviewCount",
      "vocabulary.lastReviewedAt",
    ],
  }
}

function buildInitialConfigSeedRecordMap(config: AstraConfig): Record<string, AstraConfigSyncRecord> {
  const records = buildConfigSyncRecordMap(config, CONFIG_SYNC_OPTIONS)
  if (JSON.stringify(records[CONFIG_SYNC_GLOBAL_RECORD_ID]) === JSON.stringify(DEFAULT_CONFIG_GLOBAL_RECORD)) {
    const nextRecords = { ...records }
    delete nextRecords[CONFIG_SYNC_GLOBAL_RECORD_ID]
    return nextRecords
  }
  return records
}

function buildConfigPushMutations(params: {
  config: AstraConfig
  state: AstraPhaseOneSyncState
  bootstrap: AstraSyncBootstrap
  deviceId: string
  nowIso: string
}): AstraSyncMutationInput[] {
  const isInitialBootstrap = !params.state.collections.config.cursor
    && Object.keys(params.state.collections.config.shadow).length === 0

  if (isInitialBootstrap) {
    if (params.bootstrap.collections.config.cursor) {
      return []
    }

    return diffRecordMaps({
      collection: "config",
      current: buildInitialConfigSeedRecordMap(params.config),
      shadow: {},
      deviceId: params.deviceId,
      nowIso: params.nowIso,
    })
  }

  return diffRecordMaps({
    collection: "config",
    current: buildConfigSyncRecordMap(params.config, CONFIG_SYNC_OPTIONS),
    shadow: params.state.collections.config.shadow,
    deviceId: params.deviceId,
    nowIso: params.nowIso,
  })
}

function buildVocabularyPushMutations(params: {
  vocabularyShadow: Record<string, SyncedVocabularyEntry>
  vocabularyRecords: Record<string, SyncedVocabularyEntry>
  deviceId: string
  nowIso: string
}): AstraSyncMutationInput[] {
  return diffRecordMaps({
    collection: "vocabulary",
    current: params.vocabularyRecords,
    shadow: params.vocabularyShadow,
    deviceId: params.deviceId,
    nowIso: params.nowIso,
  })
}

function buildReadingHistoryPushMutations(params: {
  readingHistoryShadow: Record<string, SyncedReadingHistoryEntry>
  readingHistoryRecords: Record<string, SyncedReadingHistoryEntry>
  bootstrap: AstraSyncBootstrap
  state: AstraPhaseOneSyncState
  deviceId: string
  nowIso: string
}): AstraSyncMutationInput[] {
  const isInitialBootstrap = !params.state.collections.reading_history.cursor
    && Object.keys(params.state.collections.reading_history.shadow).length === 0

  if (isInitialBootstrap) {
    if (params.bootstrap.collections.reading_history.cursor) {
      return []
    }

    return diffRecordMaps({
      collection: "reading_history",
      current: params.readingHistoryRecords,
      shadow: {},
      deviceId: params.deviceId,
      nowIso: params.nowIso,
    })
  }

  return diffRecordMaps({
    collection: "reading_history",
    current: params.readingHistoryRecords,
    shadow: params.readingHistoryShadow,
    deviceId: params.deviceId,
    nowIso: params.nowIso,
  })
}

function buildStudyProgressPushMutations(params: {
  studyProgressShadow: Record<string, SyncedStudyPageProgress>
  studyProgressRecords: Record<string, SyncedStudyPageProgress>
  bootstrap: AstraSyncBootstrap
  state: AstraPhaseOneSyncState
  deviceId: string
  nowIso: string
}): AstraSyncMutationInput[] {
  const isInitialBootstrap = !params.state.collections.study_progress.cursor
    && Object.keys(params.state.collections.study_progress.shadow).length === 0

  if (isInitialBootstrap) {
    if (params.bootstrap.collections.study_progress.cursor) {
      return []
    }

    return diffRecordMaps({
      collection: "study_progress",
      current: params.studyProgressRecords,
      shadow: {},
      deviceId: params.deviceId,
      nowIso: params.nowIso,
    })
  }

  return diffRecordMaps({
    collection: "study_progress",
    current: params.studyProgressRecords,
    shadow: params.studyProgressShadow,
    deviceId: params.deviceId,
    nowIso: params.nowIso,
  })
}

function applyConfigShadowMutation(
  shadow: Record<string, AstraConfigSyncRecord>,
  mutation: Pick<AstraSyncPullResponse["deltas"]["config"][number], "recordId" | "operation" | "payload">,
): Record<string, AstraConfigSyncRecord> {
  const nextShadow = { ...shadow }

  if (mutation.operation === "delete") {
    delete nextShadow[mutation.recordId]
    return nextShadow
  }

  nextShadow[mutation.recordId] = AstraConfigSyncRecordSchema.parse(mutation.payload)
  return nextShadow
}

function applyVocabularyShadowMutation(
  shadow: Record<string, SyncedVocabularyEntry>,
  mutation: Pick<AstraSyncPullResponse["deltas"]["vocabulary"][number], "recordId" | "operation" | "payload">,
): Record<string, SyncedVocabularyEntry> {
  const nextShadow = { ...shadow }

  if (mutation.operation === "delete") {
    delete nextShadow[mutation.recordId]
    return nextShadow
  }

  nextShadow[mutation.recordId] = SyncedVocabularyEntrySchema.parse(mutation.payload)
  return nextShadow
}

function applyReadingHistoryShadowMutation(
  shadow: Record<string, SyncedReadingHistoryEntry>,
  mutation: Pick<AstraSyncPullResponse["deltas"]["reading_history"][number], "recordId" | "operation" | "payload">,
): Record<string, SyncedReadingHistoryEntry> {
  const nextShadow = { ...shadow }

  if (mutation.operation === "delete") {
    delete nextShadow[mutation.recordId]
    return nextShadow
  }

  nextShadow[mutation.recordId] = SyncedReadingHistoryEntrySchema.parse(mutation.payload)
  return nextShadow
}

function applyStudyProgressShadowMutation(
  shadow: Record<string, SyncedStudyPageProgress>,
  mutation: Pick<AstraSyncPullResponse["deltas"]["study_progress"][number], "recordId" | "operation" | "payload">,
): Record<string, SyncedStudyPageProgress> {
  const nextShadow = { ...shadow }

  if (mutation.operation === "delete") {
    delete nextShadow[mutation.recordId]
    return nextShadow
  }

  nextShadow[mutation.recordId] = SyncedStudyPageProgressSchema.parse(mutation.payload)
  return nextShadow
}

function buildConfigShadowFromRepair(records: Array<{ recordId: string; payload: unknown }>): Record<string, AstraConfigSyncRecord> {
  return Object.fromEntries(records.map((record) => [
    record.recordId,
    AstraConfigSyncRecordSchema.parse(record.payload),
  ]))
}

function buildVocabularyShadowFromRepair(records: Array<{ recordId: string; payload: unknown }>): Record<string, SyncedVocabularyEntry> {
  return Object.fromEntries(records.map((record) => [
    record.recordId,
    SyncedVocabularyEntrySchema.parse(record.payload),
  ]))
}

function buildReadingHistoryShadowFromRepair(records: Array<{ recordId: string; payload: unknown }>): Record<string, SyncedReadingHistoryEntry> {
  return Object.fromEntries(records.map((record) => [
    record.recordId,
    SyncedReadingHistoryEntrySchema.parse(record.payload),
  ]))
}

function buildStudyProgressShadowFromRepair(records: Array<{ recordId: string; payload: unknown }>): Record<string, SyncedStudyPageProgress> {
  return Object.fromEntries(records.map((record) => [
    record.recordId,
    SyncedStudyPageProgressSchema.parse(record.payload),
  ]))
}

async function applyRepairRecovery(params: {
  state: AstraPhaseOneSyncState
  config: AstraConfig
  accountEmail: string
  repair: Awaited<ReturnType<typeof repairAstraSyncState>>
}): Promise<AstraPhaseOneSyncState> {
  const repairedConfigRecordMap = buildConfigShadowFromRepair(params.repair.collections.config.records)
  const repairedConfig = applyConfigSyncMutations(
    DEFAULT_ASTRA_CONFIG,
    Object.entries(repairedConfigRecordMap).map(([recordId, payload]) => ({
      recordId,
      operation: "upsert" as const,
      payload,
    })),
  )
  const mergedConfig = mergeSyncSafeConfig(
    params.config,
    buildSyncSafeConfig(repairedConfig, CONFIG_SYNC_OPTIONS),
  )

  await Promise.all([
    replaceConfig(mergedConfig),
    replaceVocabularyEntries(params.repair.collections.vocabulary.records.map((record) =>
      SyncedVocabularyEntrySchema.parse(record.payload)
    )),
    replaceReadingHistory(params.repair.collections.reading_history.records.map((record) =>
      SyncedReadingHistoryEntrySchema.parse(record.payload)
    )),
    replaceStudyProgressPages(params.repair.collections.study_progress.records.map((record) =>
      SyncedStudyPageProgressSchema.parse(record.payload)
    )),
  ])

  return {
    version: 1,
    accountEmail: params.accountEmail,
    collections: {
      config: {
        cursor: params.repair.collections.config.latestCursor,
        shadow: repairedConfigRecordMap,
      },
      vocabulary: {
        cursor: params.repair.collections.vocabulary.latestCursor,
        shadow: buildVocabularyShadowFromRepair(params.repair.collections.vocabulary.records),
      },
      reading_history: {
        cursor: params.repair.collections.reading_history.latestCursor,
        shadow: buildReadingHistoryShadowFromRepair(params.repair.collections.reading_history.records),
      },
      study_progress: {
        cursor: params.repair.collections.study_progress.latestCursor,
        shadow: buildStudyProgressShadowFromRepair(params.repair.collections.study_progress.records),
      },
    },
    lastRunAt: params.state.lastRunAt,
    lastSuccessAt: params.repair.serverTime,
    lastError: null,
  }
}

export async function exportConfig(): Promise<string> {
  const stored = await browser.storage.local.get([
    ASTRA_CONFIG_STORAGE_KEY,
    VOCABULARY_STORAGE_KEY,
    READING_HISTORY_STORAGE_KEY,
  ])

  const configRaw = stored[ASTRA_CONFIG_STORAGE_KEY]
  const parsed = AstraConfigSchema.safeParse(configRaw)
  const config = parsed.success ? normalizeConfig(parsed.data) : normalizeConfig(AstraConfigSchema.parse({}))

  const vocabulary = Array.isArray(stored[VOCABULARY_STORAGE_KEY])
    ? (stored[VOCABULARY_STORAGE_KEY] as unknown[])
    : []

  const readingHistory = Array.isArray(stored[READING_HISTORY_STORAGE_KEY])
    ? (stored[READING_HISTORY_STORAGE_KEY] as unknown[])
    : []

  const backup: AstraBackup = {
    _astraBackup: true,
    exportedAt: new Date().toISOString(),
    config,
    vocabulary,
    readingHistory,
  }

  return JSON.stringify(backup, null, 2)
}

export async function importConfig(json: string): Promise<void> {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new Error("Invalid JSON")
  }

  if (
    typeof raw !== "object"
    || raw === null
    || (raw as Record<string, unknown>)._astraBackup !== true
  ) {
    throw new Error("Invalid config file")
  }

  const envelope = raw as Record<string, unknown>
  const parsedConfig = AstraConfigSchema.safeParse(envelope.config)
  if (!parsedConfig.success) {
    throw new Error("Invalid config file")
  }

  const config = normalizeConfig(parsedConfig.data)
  const vocabulary = Array.isArray(envelope.vocabulary) ? envelope.vocabulary : []
  const readingHistory = Array.isArray(envelope.readingHistory) ? envelope.readingHistory : []

  await browser.storage.local.set({
    [ASTRA_CONFIG_STORAGE_KEY]: config,
    [VOCABULARY_STORAGE_KEY]: vocabulary,
  })
  await replaceReadingHistory(readingHistory as SyncedReadingHistoryEntry[])
}

export function buildContinuityStatus(params: {
  config: AstraConfig
  session: AstraSession | null
  device: AstraDeviceIdentity | null
  remote?: AstraContinuityRemoteSnapshot | null
}): AstraContinuityStatus {
  const sessionState = !params.session
    ? "signed-out"
    : params.session.identityMode === "anonymous"
      ? "anonymous"
      : "authenticated"
  const remoteDevices = params.remote?.devices ?? []
  const bootstrapConfig = params.remote?.bootstrap?.collections.config ?? null
  const bootstrapVocabulary = params.remote?.bootstrap?.collections.vocabulary ?? null
  const bootstrapReadingHistory = params.remote?.bootstrap?.collections.reading_history ?? null
  const bootstrapStudyProgress = params.remote?.bootstrap?.collections.study_progress ?? null
  const pullConfigDeltas = params.remote?.pull?.deltas.config ?? []
  const pullVocabularyDeltas = params.remote?.pull?.deltas.vocabulary ?? []
  const pullReadingHistoryDeltas = params.remote?.pull?.deltas.reading_history ?? []
  const pullStudyProgressDeltas = params.remote?.pull?.deltas.study_progress ?? []
  const currentDevice = remoteDevices.find((entry) =>
    entry.isCurrentDevice || (!!params.device?.deviceId && entry.deviceId === params.device.deviceId)
  ) ?? null

  return {
    device: {
      ready: !!params.device,
      deviceId: params.device?.deviceId ?? null,
      label: params.device?.label ?? null,
    },
    session: {
      state: sessionState,
      sessionId: params.session?.sessionId ?? null,
      deviceBound: !!params.session?.deviceId && !!params.device?.deviceId && params.session.deviceId === params.device.deviceId,
      issuedAt: params.session?.issuedAt ?? null,
      expiresAt: params.session?.expiresAt ?? null,
    },
    sync: {
      configReady: true,
      vocabularyReady: true,
      deferredCollections: DEFERRED_CONTINUITY_COLLECTIONS,
      syncSafeConfig: buildSyncSafeConfig(params.config),
      localOnly: buildContinuityLocalOnlySummary(params.config),
    },
    remote: {
      available: remoteDevices.length > 0 || !!params.remote?.bootstrap || !!params.remote?.pull,
      error: params.remote?.error ?? null,
      serverTime: params.remote?.pull?.serverTime ?? params.remote?.bootstrap?.serverTime ?? null,
      devices: remoteDevices,
      deviceCount: remoteDevices.length,
      activeDeviceCount: remoteDevices.filter((entry) => entry.status === "active").length,
      currentDevice,
      configCollection: buildContinuityCollectionStatus(
        bootstrapConfig,
        params.remote?.pull?.nextCursors.config,
        pullConfigDeltas.length,
        !!params.remote?.pull,
      ),
      vocabularyCollection: buildContinuityCollectionStatus(
        bootstrapVocabulary,
        params.remote?.pull?.nextCursors.vocabulary,
        pullVocabularyDeltas.length,
        !!params.remote?.pull,
      ),
      readingHistoryCollection: buildContinuityCollectionStatus(
        bootstrapReadingHistory,
        params.remote?.pull?.nextCursors.reading_history,
        pullReadingHistoryDeltas.length,
        !!params.remote?.pull,
      ),
      studyProgressCollection: buildContinuityCollectionStatus(
        bootstrapStudyProgress,
        params.remote?.pull?.nextCursors.study_progress,
        pullStudyProgressDeltas.length,
        !!params.remote?.pull,
      ),
    },
  }
}

export async function runPhaseOneCollectionSync(): Promise<AstraPhaseOneSyncResult> {
  const [session, device] = await Promise.all([
    readAstraSession(),
    ensureAstraDeviceIdentity(),
  ])

  if (!session) {
    return {
      skipped: true,
      reason: "no-session",
      pushed: { config: 0, vocabulary: 0, reading_history: 0, study_progress: 0 },
      pulled: { config: 0, vocabulary: 0, reading_history: 0, study_progress: 0 },
      rejected: 0,
    }
  }

  if (session.identityMode !== "authenticated") {
    return {
      skipped: true,
      reason: "anonymous-session",
      pushed: { config: 0, vocabulary: 0, reading_history: 0, study_progress: 0 },
      pulled: { config: 0, vocabulary: 0, reading_history: 0, study_progress: 0 },
      rejected: 0,
    }
  }

  const baseURL = session.relayBaseURL?.trim()
  if (!baseURL) {
    return {
      skipped: true,
      reason: "missing-relay-base-url",
      pushed: { config: 0, vocabulary: 0, reading_history: 0, study_progress: 0 },
      pulled: { config: 0, vocabulary: 0, reading_history: 0, study_progress: 0 },
      rejected: 0,
    }
  }

  const [state, config, vocabularySyncEntries, readingHistorySyncEntries, studyProgressSyncEntries, bootstrap] = await Promise.all([
    readPhaseOneSyncState(session.email),
    readConfig(),
    readSyncSafeVocabularyEntries(),
    readSyncSafeReadingHistory(),
    readSyncSafeStudyProgressPages(),
    fetchAstraSyncBootstrap({
      baseURL,
      sessionToken: session.sessionToken,
      deviceId: device.deviceId,
    }),
  ])

  const nowIso = new Date().toISOString()
  await writePhaseOneSyncState({
    ...state,
    lastRunAt: nowIso,
    lastError: null,
  })

  const vocabularyRecords = buildVocabularySyncRecordMap(vocabularySyncEntries)
  const readingHistoryRecords = buildReadingHistorySyncRecordMap(readingHistorySyncEntries)
  const studyProgressRecords = buildStudyProgressSyncRecordMap(studyProgressSyncEntries)
  const configMutations = bootstrap.collections.config.enabled
    ? buildConfigPushMutations({
        config,
        state,
        bootstrap,
        deviceId: device.deviceId,
        nowIso,
      })
    : []
  const vocabularyMutations = bootstrap.collections.vocabulary.enabled
    ? buildVocabularyPushMutations({
        vocabularyShadow: state.collections.vocabulary.shadow,
        vocabularyRecords,
        deviceId: device.deviceId,
        nowIso,
      })
    : []
  const readingHistoryMutations = bootstrap.collections.reading_history.enabled
    ? buildReadingHistoryPushMutations({
        readingHistoryShadow: state.collections.reading_history.shadow,
        readingHistoryRecords,
        bootstrap,
        state,
        deviceId: device.deviceId,
        nowIso,
      })
    : []
  const studyProgressMutations = bootstrap.collections.study_progress.enabled
    ? buildStudyProgressPushMutations({
        studyProgressShadow: state.collections.study_progress.shadow,
        studyProgressRecords,
        bootstrap,
        state,
        deviceId: device.deviceId,
        nowIso,
      })
    : []
  const pushMutations = [...configMutations, ...vocabularyMutations, ...readingHistoryMutations, ...studyProgressMutations]

  let rejected = 0
  if (pushMutations.length > 0) {
    const maxMutationsPerRequest = Math.max(1, bootstrap.limits.maxMutationsPerRequest)
    for (let index = 0; index < pushMutations.length; index += maxMutationsPerRequest) {
      const push = await pushAstraSyncMutations({
        baseURL,
        sessionToken: session.sessionToken,
        deviceId: device.deviceId,
        mutations: pushMutations.slice(index, index + maxMutationsPerRequest),
      })
      rejected += push.rejected.length
    }
  }

  let pull: AstraSyncPullResponse
  try {
    pull = await pullAstraSyncDeltas({
      baseURL,
      sessionToken: session.sessionToken,
      deviceId: device.deviceId,
      cursors: {
        config: state.collections.config.cursor,
        vocabulary: state.collections.vocabulary.cursor,
        ...(bootstrap.collections.reading_history.enabled
          ? { reading_history: state.collections.reading_history.cursor }
          : {}),
        ...(bootstrap.collections.study_progress.enabled
          ? { study_progress: state.collections.study_progress.cursor }
          : {}),
      },
    })
  } catch (error) {
    if (!(error instanceof AstraApiError) || error.code !== "CURSOR_EXPIRED") {
      throw error
    }

    const repair = await repairAstraSyncState({
      baseURL,
      sessionToken: session.sessionToken,
      deviceId: device.deviceId,
      request: {
        collections: [
          "config",
          "vocabulary",
          ...(bootstrap.collections.reading_history.enabled ? ["reading_history" as const] : []),
          ...(bootstrap.collections.study_progress.enabled ? ["study_progress" as const] : []),
        ],
      },
    })

    const repairedState = await applyRepairRecovery({
      state,
      config,
      accountEmail: session.email,
      repair,
    })
    await writePhaseOneSyncState(repairedState)

    return {
      skipped: false,
      reason: "synced",
      pushed: {
        config: configMutations.length,
        vocabulary: vocabularyMutations.length,
        reading_history: readingHistoryMutations.length,
        study_progress: studyProgressMutations.length,
      },
      pulled: {
        config: repair.collections.config.records.length,
        vocabulary: repair.collections.vocabulary.records.length,
        reading_history: repair.collections.reading_history.records.length,
        study_progress: repair.collections.study_progress.records.length,
      },
      rejected,
    }
  }

  const configDeltas = pull.deltas.config
  const vocabularyDeltas = pull.deltas.vocabulary
  const readingHistoryDeltas = bootstrap.collections.reading_history.enabled
    ? pull.deltas.reading_history
    : []
  const studyProgressDeltas = bootstrap.collections.study_progress.enabled
    ? pull.deltas.study_progress
    : []

  const [latestConfig, latestVocabularyEntries, latestReadingHistoryEntries, latestStudyProgress] = await Promise.all([
    readConfig(),
    getVocabularyEntries(),
    getReadingHistory(),
    getStudyProgress(),
  ])

  if (configDeltas.length > 0) {
    const nextConfig = applyConfigSyncMutations(
      latestConfig,
      configDeltas.map((delta) => ({
        recordId: delta.recordId,
        operation: delta.operation,
        payload: delta.payload,
      })),
    )
    await replaceConfig(nextConfig)
  }

  if (vocabularyDeltas.length > 0) {
    const nextVocabularyEntries = applyVocabularySyncMutations(
      latestVocabularyEntries,
      vocabularyDeltas.map((delta) => ({
        recordId: delta.recordId,
        operation: delta.operation,
        payload: delta.payload,
      })),
    )
    await replaceVocabularyEntries(nextVocabularyEntries)
  }

  if (readingHistoryDeltas.length > 0) {
    const nextReadingHistoryEntries = applyReadingHistorySyncMutations(
      latestReadingHistoryEntries,
      readingHistoryDeltas.map((delta) => ({
        recordId: delta.recordId,
        operation: delta.operation,
        payload: delta.payload,
      })),
    )
    await replaceReadingHistory(nextReadingHistoryEntries)
  }

  let nextStudyProgressPages = latestStudyProgress.pages
  if (studyProgressDeltas.length > 0) {
    nextStudyProgressPages = applyStudyProgressSyncMutations(
      latestStudyProgress.pages,
      studyProgressDeltas.map((delta) => ({
        recordId: delta.recordId,
        operation: delta.operation,
        payload: delta.payload,
      })),
    )
    await replaceStudyProgressPages(nextStudyProgressPages)
  }

  let configShadow = state.collections.config.shadow
  for (const delta of configDeltas) {
    configShadow = applyConfigShadowMutation(configShadow, delta)
  }

  let vocabularyShadow = state.collections.vocabulary.shadow
  for (const delta of vocabularyDeltas) {
    vocabularyShadow = applyVocabularyShadowMutation(vocabularyShadow, delta)
  }

  let readingHistoryShadow = state.collections.reading_history.shadow
  for (const delta of readingHistoryDeltas) {
    readingHistoryShadow = applyReadingHistoryShadowMutation(readingHistoryShadow, delta)
  }
  let studyProgressShadow = state.collections.study_progress.shadow
  for (const delta of studyProgressDeltas) {
    studyProgressShadow = applyStudyProgressShadowMutation(studyProgressShadow, delta)
  }
  if (!bootstrap.collections.study_progress.enabled) {
    studyProgressShadow = state.collections.study_progress.shadow
  }

  const nextState: AstraPhaseOneSyncState = {
    version: 1,
    accountEmail: session.email,
    collections: {
      config: {
        cursor: pull.nextCursors.config,
        shadow: configShadow,
      },
      vocabulary: {
        cursor: pull.nextCursors.vocabulary,
        shadow: vocabularyShadow,
      },
      reading_history: {
        cursor: bootstrap.collections.reading_history.enabled
          ? pull.nextCursors.reading_history
          : state.collections.reading_history.cursor,
        shadow: readingHistoryShadow,
      },
      study_progress: {
        cursor: bootstrap.collections.study_progress.enabled
          ? pull.nextCursors.study_progress
          : state.collections.study_progress.cursor,
        shadow: studyProgressShadow,
      },
    },
    lastRunAt: nowIso,
    lastSuccessAt: nowIso,
    lastError: rejected > 0 ? `${rejected} sync mutation(s) rejected.` : null,
  }
  await writePhaseOneSyncState(nextState)

  return {
    skipped: false,
    reason: "synced",
    pushed: {
      config: configMutations.length,
      vocabulary: vocabularyMutations.length,
      reading_history: readingHistoryMutations.length,
      study_progress: studyProgressMutations.length,
    },
    pulled: {
      config: configDeltas.length,
      vocabulary: vocabularyDeltas.length,
      reading_history: readingHistoryDeltas.length,
      study_progress: studyProgressDeltas.length,
    },
    rejected,
  }
}

export function downloadConfigFile(json: string, filename?: string): void {
  const blob = new Blob([json], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename ?? `astra-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()

  setTimeout(() => {
    URL.revokeObjectURL(url)
    a.remove()
  }, 100)
}

export function readConfigFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsText(file)
  })
}
