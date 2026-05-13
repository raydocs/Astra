import { z } from "zod"

import {
  AstraAccountSchema,
  AstraDeviceIdentitySchema,
  AstraSessionSchema,
  type AstraAccount,
  type AstraAccountExportJob,
  type AstraAppKind,
  type AstraBrowserFamily,
  type AstraCloudDataDeleteJob,
  type AstraContinuityDeleteCollection,
  type AstraContinuityExportCollection,
  type AstraDeviceIdentity,
  type AstraDeviceListEntry,
  type AstraDevicePlatform,
  type AstraPlan,
  type AstraSession,
  type AstraSyncBootstrap,
  type AstraUsageSnapshot,
  type AstraSyncRepairRequest,
  type AstraSyncRepairResponse,
} from "@/types/auth"
import {
  DEFAULT_ASTRA_CONFIG,
  applyConfigSyncMutations,
  buildSyncSafeConfig,
  AstraConfigSchema,
  type AstraSyncedConfig,
  type AstraConfig,
  type AstraConfigInput,
  type ProviderId,
} from "@/types/config"
import {
  createTranslationError,
  toTranslationError,
  type TranslationError,
} from "@/types/translation"
import type {
  TranslationPlaceholderFormat,
  TranslationRequestContext,
  TranslationTask,
} from "@/types/messages"
import {
  VideoNoteArtifactResponseSchema,
  VideoNoteCreateResponseSchema,
  VideoNoteStatusResponseSchema,
  type VideoNoteArtifact,
  type VideoNoteCreateRequest,
  type VideoNoteCreateResponse,
  type VideoNoteStatusResponse,
} from "@/types/video-notes"
import {
  buildAstraAccountExportDownloadUrl,
  createAstraAccountExportJob,
  createAstraCheckoutLink,
  createAstraCloudDataDeleteJob,
  createAstraPortalLink,
  fetchAstraAccount,
  fetchAstraAccountExportJob,
  fetchAstraAccountSummary,
  fetchAstraCloudDataDeleteJob,
  fetchAstraContinuitySnapshot,
  repairAstraSyncState,
  fetchAstraDevices,
  fetchAstraUsageSnapshot,
  pushAstraSyncMutations,
  revokeAstraDevice,
  updateAstraSyncCollectionPreference,
} from "@/utils/astra/account"
import {
  applyReadingHistorySyncMutations,
  type SyncedReadingHistoryEntry,
} from "@/utils/storage/reading-history-core"
import {
  applyStudyProgressSyncMutations,
  type SyncedStudyPageProgress,
  type StudyStep,
} from "@/utils/storage/study-progress-core"
import {
  SyncedVocabularyEntrySchema,
  applySyncedVocabularyMutations,
  type SyncedVocabularyEntry,
} from "@/utils/storage/vocabulary-core"
import {
  getCachedTranslations,
  setCachedTranslation,
  type TranslationCacheContext,
} from "@/utils/cache/translation-cache"
import { translateWithRelay } from "@/utils/providers/relay"
import {
  buildLibraryDocumentSnapshotSyncPayloads,
  LibraryDocumentSnapshotSyncChunkSchema,
  LibraryDocumentSnapshotSyncManifestSchema,
  LibraryItemSchema,
  listLibraryDocumentSnapshots,
  toLibraryDocumentSnapshotChunkRecordId,
  toLibraryDocumentSnapshotManifestRecordId,
  type LibraryDocumentSnapshotSyncChunk,
  type LibraryDocumentSnapshotSyncManifest,
  type LibraryItem,
} from "./workspace-store"

const WEB_API_BASE_URL_STORAGE_KEY = "astra.web.api-base-url.v1"
const WEB_CONFIG_STORAGE_KEY = "astra.web.config.v1"
const WEB_SESSION_STORAGE_KEY = "astra.web.session.v1"
const WEB_DEVICE_STORAGE_KEY = "astra.web.device.v1"
const WEB_TEXT_TRANSFER_STORAGE_KEY = "astra.web.text-transfer.v1"
const WEB_AUTH_SIGN_IN_KEY_STORAGE_KEY = "astra.web.auth-sign-in-key.v1"
const WEB_AUTH_ANONYMOUS_KEY_STORAGE_KEY = "astra.web.auth-anonymous-key.v1"

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8787/v1"
const DEFAULT_OPENAI_MODEL = "gpt-5.4-nano"
const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite-preview"

const TextTransferDraftSchema = z.object({
  title: z.string().trim().min(1),
  source: z.enum(["article", "pdf", "epub", "subtitle"]),
  text: z.string().trim().min(1),
  createdAt: z.string().trim().min(1),
})

const PendingWebSignInSchema = z.object({
  email: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1),
})

export type WebDeviceEntry = AstraDeviceListEntry
export type TextTransferDraft = z.infer<typeof TextTransferDraftSchema>

interface WebCloudCollectionHealth {
  key: "config" | "vocabulary" | "reading_history" | "study_progress"
  enabled: boolean
  defaultEnabled: boolean
  cursor: string | null
  mutationCount: number
  activeCount: number
}

interface WebCloudStudyProgressCoverage {
  read: number
  guided_read: number
  explain: number
  vocab_save: number
  vocab_review: number
}

export interface WebCloudLibraryDocumentSnapshot {
  libraryItemId: string
  manifest: LibraryDocumentSnapshotSyncManifest
  chunks: LibraryDocumentSnapshotSyncChunk[]
  complete: boolean
}

const WebSyncedDeepReadSessionRecordSchema = z.object({
  pageUrl: z.string().trim().min(1),
  pageTitle: z.string().trim().min(1).optional(),
  hostname: z.string().trim().min(1).optional(),
  metaDescription: z.string().trim().min(1).optional(),
  contentSummary: z.string().trim().min(1).optional(),
  articleExcerpt: z.string().trim().min(1).optional(),
  sentences: z.array(z.string().trim().min(1)).max(20),
  selectedSentenceAnchor: z.object({
    sentenceText: z.string().trim().min(1).optional(),
    sentenceHash: z.string().trim().min(1).optional(),
    sentenceIndex: z.number().int().nonnegative().optional(),
  }).optional(),
  selectedSentenceIndex: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
})

export type WebSyncedDeepReadSessionRecord = z.infer<typeof WebSyncedDeepReadSessionRecordSchema>

interface WebArticleImportRecentFailure {
  jobId: string
  status: "failed" | "dead_lettered" | string
  route: string
  surface: string
  targetHostname: string | null
  traceId: string
  errorCode: string | null
  lastFailureErrorCode: string | null
  fallbackReason: string | null
  queueAttemptCount: number
  replayCount: number
  deadLetteredAtEpochMs: number | null
  lastReplayedAtEpochMs: number | null
  lastReplayReason: string | null
  updatedAtEpochMs: number
}

export interface WebImportQueueObservability {
  fetchedAt: string
  environment: string
  requestId: string
  articleImport: {
    defaultMode: string
    queuePolicy: {
      maxAttempts: number
      operatorReplayEnabled: boolean
    }
    backlog: {
      queued: number
      failed: number
      deadLettered: number
      oldestQueuedAgeMs: number | null
    }
    routeCounts: Record<string, number>
    statusCounts: Record<string, number>
    surfaceCounts: Record<string, number>
    recentFailures: WebArticleImportRecentFailure[]
  }
}

export interface WebImportReplayResult {
  dryRun: boolean
  requestId: string
  summary: {
    selected: number
    replayed: number
    skipped: number
  }
}

export type WebContinuityExportJob = AstraAccountExportJob
export type WebCloudDataDeleteJob = AstraCloudDataDeleteJob
export type WebSyncRepairResult = AstraSyncRepairResponse
export type WebVideoNoteCreateResponse = VideoNoteCreateResponse
export type WebVideoNoteStatusResponse = VideoNoteStatusResponse
export type WebVideoNoteArtifact = VideoNoteArtifact

export interface WebCloudAssetsWorkspace {
  serverTime: string | null
  fetchedAt: string
  bootstrap: AstraSyncBootstrap["collections"] | null
  config: {
    enabled: boolean
    defaultEnabled: boolean
    cursor: string | null
    recordCount: number
    syncedConfig: AstraSyncedConfig
  }
  vocabulary: {
    enabled: boolean
    defaultEnabled: boolean
    cursor: string | null
    count: number
    entries: SyncedVocabularyEntry[]
  }
  readingHistory: {
    enabled: boolean
    defaultEnabled: boolean
    cursor: string | null
    count: number
    entries: SyncedReadingHistoryEntry[]
  }
  studyProgress: {
    enabled: boolean
    defaultEnabled: boolean
    cursor: string | null
    pageCount: number
    pages: SyncedStudyPageProgress[]
    stepCoverage: WebCloudStudyProgressCoverage
  }
  deepReadSessions: {
    count: number
    sessions: WebSyncedDeepReadSessionRecord[]
  }
  library: {
    count: number
    items: LibraryItem[]
    snapshotCount: number
    snapshots: WebCloudLibraryDocumentSnapshot[]
  }
  syncHealth: {
    activeDeviceCount: number
    totalDeviceCount: number
    currentDeviceLastSyncAt: string | null
    maxMutationsPerRequest: number | null
    collections: WebCloudCollectionHealth[]
  }
  deferredCollections: Array<"reading_history" | "study_progress">
}

export interface WebTranslateRequest {
  texts: string[]
  targetLang: string
  sourceLang?: string
  context?: TranslationRequestContext
  task?: TranslationTask
  customSystemPrompt?: string
  placeholderFormat?: TranslationPlaceholderFormat
}

export type WebTranslateResult =
  | { ok: true; translations: string[]; providerId: ProviderId }
  | { ok: false; error: TranslationError }

interface TranslateBatch {
  originalIndices: number[]
  texts: string[]
  charCount: number
}

interface TranslateSegment {
  originalIndex: number
  text: string
}

const MAX_BATCH_ITEMS = 12
const MAX_BATCH_CHARS = 8000
const MAX_CONCURRENCY = 4
const WEB_OWNED_READING_CONFIG_RECORD_PREFIX = "__owned_reading_metadata_v1__:"
const WEB_DEEP_READ_SESSION_CONFIG_RECORD_PREFIX = "__deep_read_session_v1__:"
const WEB_LIBRARY_CONFIG_RECORD_PREFIX = "__web_library_metadata_v1__:"
const WEB_LIBRARY_DOCUMENT_SNAPSHOT_RECORD_PREFIX = "__web_library_document_snapshot_v1__:"

function createEmptyStudyProgressCoverage(): WebCloudStudyProgressCoverage {
  return {
    read: 0,
    guided_read: 0,
    explain: 0,
    vocab_save: 0,
    vocab_review: 0,
  }
}

function summarizeStudyProgressCoverage(pages: SyncedStudyPageProgress[]): WebCloudStudyProgressCoverage {
  return pages.reduce<WebCloudStudyProgressCoverage>((coverage, page) => {
    page.completedSteps.forEach((step) => {
      coverage[step as StudyStep] += 1
    })
    return coverage
  }, createEmptyStudyProgressCoverage())
}

function isWebPrivateConfigRecordId(recordId: string): boolean {
  return recordId.startsWith(WEB_OWNED_READING_CONFIG_RECORD_PREFIX)
    || recordId.startsWith(WEB_DEEP_READ_SESSION_CONFIG_RECORD_PREFIX)
    || recordId.startsWith(WEB_LIBRARY_CONFIG_RECORD_PREFIX)
    || recordId.startsWith(WEB_LIBRARY_DOCUMENT_SNAPSHOT_RECORD_PREFIX)
}

function parseWebLibraryItems(
  mutations: Array<{ recordId: string; operation: "upsert" | "delete"; payload?: unknown; serverUpdatedAt?: string }>,
): LibraryItem[] {
  const byId = new Map<string, LibraryItem>()
  const deleted = new Set<string>()

  for (const mutation of mutations) {
    if (!mutation.recordId.startsWith(WEB_LIBRARY_CONFIG_RECORD_PREFIX)) continue
    const libraryItemId = mutation.recordId.slice(WEB_LIBRARY_CONFIG_RECORD_PREFIX.length)
    if (!libraryItemId) continue

    if (mutation.operation === "delete") {
      byId.delete(libraryItemId)
      deleted.add(libraryItemId)
      continue
    }

    if (deleted.has(libraryItemId)) {
      deleted.delete(libraryItemId)
    }

    const parsed = LibraryItemSchema.safeParse(mutation.payload)
    if (parsed.success && !parsed.data.removedAt) {
      byId.set(parsed.data.id, parsed.data)
    }
  }

  return Array.from(byId.values()).sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
}

function parseWebLibraryDocumentSnapshots(
  mutations: Array<{ recordId: string; operation: "upsert" | "delete"; payload?: unknown; serverUpdatedAt?: string }>,
): WebCloudLibraryDocumentSnapshot[] {
  const manifests = new Map<string, LibraryDocumentSnapshotSyncManifest>()
  const chunks = new Map<string, LibraryDocumentSnapshotSyncChunk[]>()
  const deleted = new Set<string>()

  for (const mutation of mutations) {
    if (!mutation.recordId.startsWith(WEB_LIBRARY_DOCUMENT_SNAPSHOT_RECORD_PREFIX)) continue
    const manifestMatch = /^__web_library_document_snapshot_v1__:(.+):manifest$/.exec(mutation.recordId)
    const chunkMatch = /^__web_library_document_snapshot_v1__:(.+):chunk:(\d+)$/.exec(mutation.recordId)
    const libraryItemId = manifestMatch?.[1] ?? chunkMatch?.[1] ?? null
    if (!libraryItemId) continue

    if (mutation.operation === "delete") {
      manifests.delete(libraryItemId)
      chunks.delete(libraryItemId)
      deleted.add(libraryItemId)
      continue
    }

    if (deleted.has(libraryItemId)) deleted.delete(libraryItemId)

    if (manifestMatch) {
      const parsed = LibraryDocumentSnapshotSyncManifestSchema.safeParse(mutation.payload)
      if (parsed.success && parsed.data.libraryItemId === libraryItemId) {
        manifests.set(libraryItemId, parsed.data)
      }
      continue
    }

    if (chunkMatch) {
      const parsed = LibraryDocumentSnapshotSyncChunkSchema.safeParse(mutation.payload)
      if (parsed.success && parsed.data.libraryItemId === libraryItemId) {
        const list = chunks.get(libraryItemId) ?? []
        list[parsed.data.chunkIndex] = parsed.data
        chunks.set(libraryItemId, list)
      }
    }
  }

  return Array.from(manifests.entries())
    .map(([libraryItemId, manifest]) => {
      const orderedChunks = (chunks.get(libraryItemId) ?? []).filter(Boolean).sort((left, right) => left.chunkIndex - right.chunkIndex)
      return {
        libraryItemId,
        manifest,
        chunks: orderedChunks,
        complete: manifest.extractedTextStatus !== "available" || (orderedChunks.length === manifest.chunkCount && orderedChunks.every((chunk, index) => chunk.chunkIndex === index)),
      }
    })
    .sort((left, right) => right.manifest.updatedAt - left.manifest.updatedAt)
}

function toLibraryMetadataRecordId(itemId: string): string {
  return `${WEB_LIBRARY_CONFIG_RECORD_PREFIX}${itemId}`
}

function createWebClientMutationId(prefix: string): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi && "randomUUID" in cryptoApi) {
    return `${prefix}:${cryptoApi.randomUUID()}`
  }
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`
}

function chunkMutations<T>(mutations: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < mutations.length; index += size) {
    chunks.push(mutations.slice(index, index + size))
  }
  return chunks
}

function parseWebDeepReadSessions(
  mutations: Array<{ recordId: string; operation: "upsert" | "delete"; payload?: unknown }>,
): WebSyncedDeepReadSessionRecord[] {
  return mutations
    .filter((mutation) => mutation.recordId.startsWith(WEB_DEEP_READ_SESSION_CONFIG_RECORD_PREFIX))
    .filter((mutation) => mutation.operation === "upsert")
    .map((mutation) => WebSyncedDeepReadSessionRecordSchema.safeParse(mutation.payload))
    .filter((parsed): parsed is { success: true; data: WebSyncedDeepReadSessionRecord } => parsed.success)
    .map((parsed) => parsed.data)
    .sort((left, right) => right.updatedAt - left.updatedAt)
}

function readStringStorage(key: string): string | null {
  if (typeof window === "undefined") return null

  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStringStorage(key: string, value: string) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Ignore storage write failures so the web shell can still run in restricted contexts.
  }
}

function readJsonStorage<T>(key: string, schema: z.ZodType<T>): T | null {
  const raw = readStringStorage(key)
  if (!raw) return null

  try {
    return schema.parse(JSON.parse(raw))
  } catch {
    return null
  }
}

function writeJsonStorage(key: string, value: unknown) {
  writeStringStorage(key, JSON.stringify(value))
}

function removeStorage(key: string) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.removeItem(key)
  } catch {
    // Ignore storage removal failures for the same reason as writes above.
  }
}

export function normalizeApiBaseUrl(value: string | null | undefined): string {
  const raw = value?.trim()
  if (!raw) return DEFAULT_API_BASE_URL

  try {
    const url = new URL(raw)
    const normalizedPath = url.pathname.replace(/\/+$/, "")
    url.pathname = !normalizedPath || normalizedPath === "/"
      ? "/v1"
      : normalizedPath
    return url.toString().replace(/\/+$/, "")
  } catch {
    return raw.replace(/\/+$/, "")
  }
}

export function readApiBaseUrl(): string {
  return normalizeApiBaseUrl(readStringStorage(WEB_API_BASE_URL_STORAGE_KEY) ?? import.meta.env.VITE_ASTRA_API_BASE_URL)
}

export function readArticleImportBaseUrl(fallbackBaseUrl?: string | null): string {
  return normalizeApiBaseUrl(import.meta.env.VITE_ASTRA_PLATFORM_BASE_URL ?? fallbackBaseUrl ?? readApiBaseUrl())
}

export function saveApiBaseUrl(baseUrl: string): string {
  const normalized = normalizeApiBaseUrl(baseUrl)
  writeStringStorage(WEB_API_BASE_URL_STORAGE_KEY, normalized)
  return normalized
}

function generateOpaqueDeviceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `astra-web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function createOpaqueIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `astra-web-idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizeAccountEmail(email: string): string {
  return email.trim().toLowerCase()
}

function detectPlatform(): AstraDevicePlatform {
  const userAgent = globalThis.navigator?.userAgent ?? ""
  const platform = globalThis.navigator?.platform ?? ""
  const normalized = `${platform} ${userAgent}`.toLowerCase()

  if (normalized.includes("iphone") || normalized.includes("ipad") || normalized.includes("ios")) return "ios"
  if (normalized.includes("android")) return "android"
  if (normalized.includes("mac")) return "macos"
  if (normalized.includes("win")) return "windows"
  if (normalized.includes("linux")) return "linux"
  return "unknown"
}

function detectBrowserFamily(): AstraBrowserFamily {
  const userAgent = (globalThis.navigator?.userAgent ?? "").toLowerCase()

  if (userAgent.includes("edg/")) return "edge"
  if (userAgent.includes("firefox/")) return "firefox"
  if (userAgent.includes("safari/") && !userAgent.includes("chrome/") && !userAgent.includes("chromium/")) return "safari"
  if (userAgent.includes("chrome/") || userAgent.includes("chromium/") || userAgent.includes("crios/")) return "chrome"
  return "unknown"
}

function detectAppKind(): AstraAppKind {
  const standaloneMedia = typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(display-mode: standalone)").matches

  const legacyStandalone = typeof navigator !== "undefined"
    && "standalone" in navigator
    && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)

  return standaloneMedia || legacyStandalone ? "pwa" : "web"
}

function formatPlatformLabel(platform: AstraDevicePlatform): string {
  switch (platform) {
    case "macos":
      return "macOS"
    case "ios":
      return "iOS"
    default:
      return platform.charAt(0).toUpperCase() + platform.slice(1)
  }
}

function formatBrowserLabel(browserFamily: AstraBrowserFamily): string {
  switch (browserFamily) {
    case "edge":
      return "Edge"
    case "firefox":
      return "Firefox"
    case "safari":
      return "Safari"
    case "chrome":
      return "Chrome"
    default:
      return "Browser"
  }
}

function createDeviceIdentity(): AstraDeviceIdentity {
  const now = new Date().toISOString()
  const platform = detectPlatform()
  const browserFamily = detectBrowserFamily()
  const appKind = detectAppKind()

  return AstraDeviceIdentitySchema.parse({
    version: 1,
    deviceId: generateOpaqueDeviceId(),
    label: `${formatBrowserLabel(browserFamily)} on ${formatPlatformLabel(platform)}`,
    platform,
    browserFamily,
    appKind,
    appVersion: "0.1.0-web",
    createdAt: now,
    updatedAt: now,
  })
}

export function ensureWebDeviceIdentity(): AstraDeviceIdentity {
  const existing = readJsonStorage(WEB_DEVICE_STORAGE_KEY, AstraDeviceIdentitySchema)
  if (existing) {
    const refreshed = AstraDeviceIdentitySchema.parse({
      ...existing,
      appKind: detectAppKind(),
      updatedAt: new Date().toISOString(),
    })
    writeJsonStorage(WEB_DEVICE_STORAGE_KEY, refreshed)
    return refreshed
  }

  const created = createDeviceIdentity()
  writeJsonStorage(WEB_DEVICE_STORAGE_KEY, created)
  return created
}

function normalizeSessionPayload(
  payload: unknown,
  fallback: Pick<AstraSession, "deviceId" | "identityMode" | "relayBaseURL">,
): AstraSession {
  const candidate = typeof payload === "object" && payload !== null
    ? payload as Record<string, unknown>
    : {}

  return AstraSessionSchema.parse({
    ...candidate,
    deviceId: typeof candidate.deviceId === "string" ? candidate.deviceId : fallback.deviceId,
    identityMode:
      candidate.identityMode === "anonymous" || candidate.identityMode === "authenticated"
        ? candidate.identityMode
        : fallback.identityMode,
    relayBaseURL: typeof candidate.relayBaseURL === "string" && candidate.relayBaseURL.trim().length > 0
      ? candidate.relayBaseURL
      : fallback.relayBaseURL,
  })
}

async function readErrorMessage(response: Response, fallbackPrefix: string): Promise<string> {
  try {
    const payload = await response.json() as { error?: { message?: string }; message?: string }
    return payload.error?.message || payload.message || `${fallbackPrefix} (${response.status})`
  } catch {
    return `${fallbackPrefix} (${response.status})`
  }
}

async function readAuthRequestFailure(response: Response, fallbackPrefix: string): Promise<{
  message: string
  fallbackReason: string | null
}> {
  const fallbackReason = response.headers.get("x-astra-platform-fallback-reason")?.trim() || null
  return {
    message: await readErrorMessage(response, fallbackPrefix),
    fallbackReason,
  }
}

function readPendingWebSignInAttempt(): z.infer<typeof PendingWebSignInSchema> | null {
  const attempt = readJsonStorage(WEB_AUTH_SIGN_IN_KEY_STORAGE_KEY, PendingWebSignInSchema)
  if (!attempt) {
    removeStorage(WEB_AUTH_SIGN_IN_KEY_STORAGE_KEY)
    return null
  }

  return {
    email: normalizeAccountEmail(attempt.email),
    idempotencyKey: attempt.idempotencyKey.trim(),
  }
}

function savePendingWebSignInAttempt(email: string, idempotencyKey: string) {
  writeJsonStorage(WEB_AUTH_SIGN_IN_KEY_STORAGE_KEY, PendingWebSignInSchema.parse({
    email: normalizeAccountEmail(email),
    idempotencyKey: idempotencyKey.trim(),
  }))
}

function clearPendingWebSignInAttempt() {
  removeStorage(WEB_AUTH_SIGN_IN_KEY_STORAGE_KEY)
}

function readPendingAnonymousSessionKey(): string | null {
  const key = readStringStorage(WEB_AUTH_ANONYMOUS_KEY_STORAGE_KEY)?.trim()
  if (!key) {
    removeStorage(WEB_AUTH_ANONYMOUS_KEY_STORAGE_KEY)
    return null
  }
  return key
}

function savePendingAnonymousSessionKey(idempotencyKey: string) {
  writeStringStorage(WEB_AUTH_ANONYMOUS_KEY_STORAGE_KEY, idempotencyKey.trim())
}

function clearPendingAnonymousSessionKey() {
  removeStorage(WEB_AUTH_ANONYMOUS_KEY_STORAGE_KEY)
}

export function readWebSession(): AstraSession | null {
  return readJsonStorage(WEB_SESSION_STORAGE_KEY, AstraSessionSchema)
}

export function saveWebSession(session: AstraSession): AstraSession {
  const normalized = AstraSessionSchema.parse(session)
  writeJsonStorage(WEB_SESSION_STORAGE_KEY, normalized)
  return normalized
}

export function clearWebSession() {
  removeStorage(WEB_SESSION_STORAGE_KEY)
}

export function readWebConfig(): AstraConfig {
  const stored = readJsonStorage(WEB_CONFIG_STORAGE_KEY, AstraConfigSchema)
  return AstraConfigSchema.parse({
    ...DEFAULT_ASTRA_CONFIG,
    ...(stored ?? {}),
    connectionMode: "astra",
    provider: {
      ...DEFAULT_ASTRA_CONFIG.provider,
      ...(stored?.provider ?? {}),
      accessToken: "",
      apiKey: "",
    },
  })
}

export function saveWebConfig(config: AstraConfig): AstraConfig {
  const normalized = AstraConfigSchema.parse({
    ...config,
    connectionMode: "astra",
    provider: {
      ...config.provider,
      accessToken: "",
      apiKey: "",
    },
  })
  writeJsonStorage(WEB_CONFIG_STORAGE_KEY, normalized)
  return normalized
}

export function mergeWebConfig(current: AstraConfig, patch: AstraConfigInput): AstraConfig {
  const next = AstraConfigSchema.parse({
    ...current,
    ...patch,
    connectionMode: "astra",
    provider: {
      ...current.provider,
      ...(patch.provider ?? {}),
      accessToken: "",
      apiKey: "",
    },
    tts: {
      ...current.tts,
      ...(patch.tts ?? {}),
    },
    presentation: {
      ...current.presentation,
      ...(patch.presentation ?? {}),
    },
    sites: {
      ...current.sites,
      ...(patch.sites ?? {}),
    },
    customActions: patch.customActions ?? current.customActions,
  })

  return saveWebConfig(next)
}

export async function createWebSession(params: {
  baseURL: string
  device: AstraDeviceIdentity
  email: string
  password: string
}): Promise<AstraSession> {
  const baseURL = normalizeApiBaseUrl(params.baseURL)
  const normalizedEmail = normalizeAccountEmail(params.email)
  const pendingAttempt = readPendingWebSignInAttempt()
  const idempotencyKey = pendingAttempt?.email === normalizedEmail
    ? pendingAttempt.idempotencyKey
    : createOpaqueIdempotencyKey()

  if (pendingAttempt?.email !== normalizedEmail || pendingAttempt?.idempotencyKey !== idempotencyKey) {
    savePendingWebSignInAttempt(normalizedEmail, idempotencyKey)
  }

  try {
    const response = await fetch(`${baseURL}/auth/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
        "X-Astra-Device-Id": params.device.deviceId,
      },
      body: JSON.stringify({
        email: params.email.trim(),
        password: params.password,
        deviceId: params.device.deviceId,
        device: {
          label: params.device.label,
          platform: params.device.platform,
          browserFamily: params.device.browserFamily,
          appKind: params.device.appKind,
          appVersion: params.device.appVersion,
        },
      }),
    })

    if (!response.ok) {
      const error = await readAuthRequestFailure(response, "Astra sign-in failed")
      if (error.fallbackReason !== "mirror_back_commit_unknown") {
        clearPendingWebSignInAttempt()
      }
      throw new Error(error.message)
    }

    clearPendingWebSignInAttempt()
    return normalizeSessionPayload(await response.json(), {
      deviceId: params.device.deviceId,
      identityMode: "authenticated",
      relayBaseURL: baseURL,
    })
  } catch (error) {
    throw error
  }
}

export async function createWebAnonymousSession(params: {
  baseURL: string
  device: AstraDeviceIdentity
}): Promise<AstraSession> {
  const baseURL = normalizeApiBaseUrl(params.baseURL)
  const pendingKey = readPendingAnonymousSessionKey()
  const idempotencyKey = pendingKey ?? createOpaqueIdempotencyKey()

  if (!pendingKey) {
    savePendingAnonymousSessionKey(idempotencyKey)
  }

  try {
    const response = await fetch(`${baseURL}/auth/anonymous`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
        "X-Astra-Device-Id": params.device.deviceId,
      },
      body: JSON.stringify({
        deviceId: params.device.deviceId,
        installId: params.device.deviceId,
        device: {
          label: params.device.label,
          platform: params.device.platform,
          browserFamily: params.device.browserFamily,
          appKind: params.device.appKind,
          appVersion: params.device.appVersion,
        },
      }),
    })

    if (!response.ok) {
      const error = await readAuthRequestFailure(response, "Astra free start failed")
      if (error.fallbackReason !== "mirror_back_commit_unknown") {
        clearPendingAnonymousSessionKey()
      }
      throw new Error(error.message)
    }

    clearPendingAnonymousSessionKey()
    return normalizeSessionPayload(await response.json(), {
      deviceId: params.device.deviceId,
      identityMode: "anonymous",
      relayBaseURL: baseURL,
    })
  } catch (error) {
    throw error
  }
}

export async function importWebLibraryMetadataToAccount(params: {
  session: AstraSession
  device: AstraDeviceIdentity
  items: LibraryItem[]
}): Promise<{ accepted: number; rejected: number; metadataAccepted: number; snapshotAccepted: number; snapshotRejected: number; oversizedSnapshots: number }> {
  const now = new Date().toISOString()
  const activeItems = params.items.filter((item) => !item.removedAt)
  const documentSnapshots = new Map((await listLibraryDocumentSnapshots(activeItems.map((item) => item.id))).map((snapshot) => [snapshot.libraryItemId, snapshot]))
  const metadataMutations = activeItems.map((item) => {
    const payload = LibraryItemSchema.parse({
      ...item,
      ownerMode: "account",
      accountId: params.session.email,
      syncState: "synced",
      updatedAt: now,
      metadata: {
        ...item.metadata,
        originalFileBytesSynced: false,
        requiresReimportForBinaryView: true,
      },
    })
    return {
      collection: "config" as const,
      schemaVersion: 1,
      recordId: toLibraryMetadataRecordId(item.id),
      operation: "upsert" as const,
      clientMutationId: createWebClientMutationId(`web-library:${item.id}`),
      deviceId: params.device.deviceId,
      clientUpdatedAt: now,
      payload,
    }
  })

  const snapshotMutations = activeItems.flatMap((item) => {
    const snapshot = documentSnapshots.get(item.id)
    if (!snapshot) return []
    const payloads = buildLibraryDocumentSnapshotSyncPayloads(snapshot)
    return [
      {
        collection: "config" as const,
        schemaVersion: 1,
        recordId: toLibraryDocumentSnapshotManifestRecordId(item.id),
        operation: "upsert" as const,
        clientMutationId: createWebClientMutationId(`web-library-snapshot:${item.id}:manifest`),
        deviceId: params.device.deviceId,
        clientUpdatedAt: now,
        payload: payloads.manifest,
      },
      ...payloads.chunks.map((chunk) => ({
        collection: "config" as const,
        schemaVersion: 1,
        recordId: toLibraryDocumentSnapshotChunkRecordId(item.id, chunk.chunkIndex),
        operation: "upsert" as const,
        clientMutationId: createWebClientMutationId(`web-library-snapshot:${item.id}:chunk:${chunk.chunkIndex}`),
        deviceId: params.device.deviceId,
        clientUpdatedAt: now,
        payload: chunk,
      })),
    ]
  })

  const mutations = [...metadataMutations, ...snapshotMutations]
  if (mutations.length === 0) {
    return { accepted: 0, rejected: 0, metadataAccepted: 0, snapshotAccepted: 0, snapshotRejected: 0, oversizedSnapshots: 0 }
  }

  const accepted: Array<{ recordId: string }> = []
  const rejected: Array<{ clientMutationId: string }> = []
  for (const batch of chunkMutations(mutations, 40)) {
    const response = await pushAstraSyncMutations({
      baseURL: params.session.relayBaseURL,
      sessionToken: params.session.sessionToken,
      deviceId: params.device.deviceId,
      mutations: batch,
    })
    accepted.push(...response.accepted)
    rejected.push(...response.rejected)
  }

  const snapshotRecordPrefix = WEB_LIBRARY_DOCUMENT_SNAPSHOT_RECORD_PREFIX
  const metadataAccepted = accepted.filter((entry) => entry.recordId.startsWith(WEB_LIBRARY_CONFIG_RECORD_PREFIX)).length
  const snapshotAccepted = accepted.filter((entry) => entry.recordId.startsWith(snapshotRecordPrefix)).length
  const snapshotRejected = rejected.filter((entry) => entry.clientMutationId.includes("web-library-snapshot:")).length

  return {
    accepted: accepted.length,
    rejected: rejected.length,
    metadataAccepted,
    snapshotAccepted,
    snapshotRejected,
    oversizedSnapshots: Array.from(documentSnapshots.values()).filter((snapshot) => snapshot.extractedText.status === "oversized").length,
  }
}

export async function refreshWebSession(params: {
  baseURL: string
  device: AstraDeviceIdentity
  sessionToken: string
}): Promise<AstraSession> {
  const baseURL = normalizeApiBaseUrl(params.baseURL)
  const response = await fetch(`${baseURL}/auth/session`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.sessionToken}`,
      "X-Astra-Device-Id": params.device.deviceId,
    },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Astra session refresh failed"))
  }

  return normalizeSessionPayload(await response.json(), {
    deviceId: params.device.deviceId,
    identityMode: "authenticated",
    relayBaseURL: baseURL,
  })
}

export async function revokeWebSession(params: {
  baseURL: string
  device: AstraDeviceIdentity
  sessionToken: string
}) {
  const response = await fetch(`${normalizeApiBaseUrl(params.baseURL)}/auth/session`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${params.sessionToken}`,
      "X-Astra-Device-Id": params.device.deviceId,
    },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Astra sign-out failed"))
  }
}

export async function createWebContinuityExport(params: {
  session: AstraSession
  device: AstraDeviceIdentity
  collections?: AstraContinuityExportCollection[]
  idempotencyKey?: string
}): Promise<WebContinuityExportJob> {
  return createAstraAccountExportJob({
    baseURL: params.session.relayBaseURL,
    sessionToken: params.session.sessionToken,
    deviceId: params.device.deviceId,
    request: params.collections ? { collections: params.collections } : undefined,
    idempotencyKey: params.idempotencyKey,
  })
}

export async function fetchWebContinuityExportJob(params: {
  session: AstraSession
  device: AstraDeviceIdentity
  jobId: string
}): Promise<WebContinuityExportJob> {
  return fetchAstraAccountExportJob({
    baseURL: params.session.relayBaseURL,
    sessionToken: params.session.sessionToken,
    deviceId: params.device.deviceId,
    jobId: params.jobId,
  })
}

export async function downloadWebContinuityExport(params: {
  session: AstraSession
  device: AstraDeviceIdentity
  jobId: string
}): Promise<Blob> {
  const response = await fetch(buildAstraAccountExportDownloadUrl({
    baseURL: params.session.relayBaseURL,
    jobId: params.jobId,
  }), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.session.sessionToken}`,
      "X-Astra-Device-Id": params.device.deviceId,
    },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Astra continuity export download failed"))
  }

  return response.blob()
}

export async function createWebCloudDataDelete(params: {
  session: AstraSession
  device: AstraDeviceIdentity
  collections: AstraContinuityDeleteCollection[]
  idempotencyKey?: string
}): Promise<WebCloudDataDeleteJob> {
  return createAstraCloudDataDeleteJob({
    baseURL: params.session.relayBaseURL,
    sessionToken: params.session.sessionToken,
    deviceId: params.device.deviceId,
    request: { collections: params.collections },
    idempotencyKey: params.idempotencyKey,
  })
}

export async function repairWebCloudSync(params: {
  session: AstraSession
  device: AstraDeviceIdentity
  request?: AstraSyncRepairRequest
}): Promise<WebSyncRepairResult> {
  return repairAstraSyncState({
    baseURL: params.session.relayBaseURL,
    sessionToken: params.session.sessionToken,
    deviceId: params.device.deviceId,
    request: params.request,
  })
}

export async function fetchWebCloudDataDeleteJob(params: {
  session: AstraSession
  device: AstraDeviceIdentity
  jobId: string
}): Promise<WebCloudDataDeleteJob> {
  return fetchAstraCloudDataDeleteJob({
    baseURL: params.session.relayBaseURL,
    sessionToken: params.session.sessionToken,
    deviceId: params.device.deviceId,
    jobId: params.jobId,
  })
}

export async function fetchWebAccountWorkspace(params: {
  session: AstraSession
  device: AstraDeviceIdentity
}): Promise<{
  account: AstraAccount | null
  usage: AstraUsageSnapshot | null
  devices: WebDeviceEntry[] | null
  deviceError: string | null
}> {
  try {
    const summary = await fetchAstraAccountSummary({
      baseURL: params.session.relayBaseURL,
      sessionToken: params.session.sessionToken,
      deviceId: params.device.deviceId,
    })

    return {
      account: AstraAccountSchema.parse(summary.account),
      usage: summary.usage,
      devices: summary.devices.entries,
      deviceError: null,
    }
  } catch {
    const [account, usage, devices] = await Promise.allSettled([
      fetchAstraAccount({
        baseURL: params.session.relayBaseURL,
        sessionToken: params.session.sessionToken,
      }),
      fetchAstraUsageSnapshot({
        baseURL: params.session.relayBaseURL,
        sessionToken: params.session.sessionToken,
      }),
      fetchWebDevices({
        baseURL: params.session.relayBaseURL,
        sessionToken: params.session.sessionToken,
        deviceId: params.device.deviceId,
      }),
    ])

    return {
      account: account.status === "fulfilled" ? AstraAccountSchema.parse(account.value) : null,
      usage: usage.status === "fulfilled" ? usage.value : null,
      devices: devices.status === "fulfilled" ? devices.value : null,
      deviceError: devices.status === "rejected"
        ? (devices.reason instanceof Error ? devices.reason.message : "Astra device list request failed")
        : null,
    }
  }
}

function countActiveRecords<T extends { recordId: string; operation: "upsert" | "delete"; payload?: unknown | null }>(
  mutations: T[],
): number {
  const active = new Set<string>()
  mutations.forEach((mutation) => {
    if (mutation.operation === "delete") {
      active.delete(mutation.recordId)
      return
    }
    active.add(mutation.recordId)
  })
  return active.size
}

export async function fetchWebCloudAssets(params: {
  session: AstraSession
  device: AstraDeviceIdentity
}): Promise<WebCloudAssetsWorkspace> {
  const snapshot = await fetchAstraContinuitySnapshot({
    baseURL: params.session.relayBaseURL,
    sessionToken: params.session.sessionToken,
    deviceId: params.device.deviceId,
    includePull: true,
  })

  const configMutations = snapshot.pull?.deltas.config ?? []
  const appConfigMutations = configMutations.filter((mutation) => !isWebPrivateConfigRecordId(mutation.recordId))
  const deepReadSessions = parseWebDeepReadSessions(configMutations)
  const libraryItems = parseWebLibraryItems(configMutations)
  const librarySnapshots = parseWebLibraryDocumentSnapshots(configMutations)
  const vocabularyMutations = snapshot.pull?.deltas.vocabulary ?? []
  const readingHistoryMutations = snapshot.pull?.deltas.reading_history ?? []
  const studyProgressMutations = snapshot.pull?.deltas.study_progress ?? []
  const syncedConfig = buildSyncSafeConfig(
    applyConfigSyncMutations(DEFAULT_ASTRA_CONFIG, appConfigMutations),
    { includeManagedRelayBaseURL: true },
  )
  const syncedVocabulary = applySyncedVocabularyMutations([], vocabularyMutations)
    .map((entry) => SyncedVocabularyEntrySchema.parse(entry))
    .sort((a, b) => b.savedAt - a.savedAt)
  const readingHistoryEntries = applyReadingHistorySyncMutations([], readingHistoryMutations)
  const studyProgressPages = applyStudyProgressSyncMutations([], studyProgressMutations)
  const stepCoverage = summarizeStudyProgressCoverage(studyProgressPages)
  const currentDevice = snapshot.devices.find((entry) => entry.isCurrentDevice || entry.deviceId === params.device.deviceId) ?? null
  const collectionHealth: WebCloudCollectionHealth[] = [
    {
      key: "config",
      enabled: snapshot.bootstrap.collections.config.enabled,
      defaultEnabled: snapshot.bootstrap.collections.config.defaultEnabled,
      cursor: snapshot.pull?.nextCursors.config ?? snapshot.bootstrap.collections.config.cursor,
      mutationCount: configMutations.length,
      activeCount: countActiveRecords(appConfigMutations),
    },
    {
      key: "vocabulary",
      enabled: snapshot.bootstrap.collections.vocabulary.enabled,
      defaultEnabled: snapshot.bootstrap.collections.vocabulary.defaultEnabled,
      cursor: snapshot.pull?.nextCursors.vocabulary ?? snapshot.bootstrap.collections.vocabulary.cursor,
      mutationCount: vocabularyMutations.length,
      activeCount: syncedVocabulary.length,
    },
    {
      key: "reading_history",
      enabled: snapshot.bootstrap.collections.reading_history.enabled,
      defaultEnabled: snapshot.bootstrap.collections.reading_history.defaultEnabled,
      cursor: snapshot.pull?.nextCursors.reading_history ?? snapshot.bootstrap.collections.reading_history.cursor,
      mutationCount: readingHistoryMutations.length,
      activeCount: readingHistoryEntries.length,
    },
    {
      key: "study_progress",
      enabled: snapshot.bootstrap.collections.study_progress.enabled,
      defaultEnabled: snapshot.bootstrap.collections.study_progress.defaultEnabled,
      cursor: snapshot.pull?.nextCursors.study_progress ?? snapshot.bootstrap.collections.study_progress.cursor,
      mutationCount: studyProgressMutations.length,
      activeCount: studyProgressPages.length,
    },
  ]

  return {
    serverTime: snapshot.pull?.serverTime ?? snapshot.bootstrap.serverTime,
    fetchedAt: new Date().toISOString(),
    bootstrap: snapshot.bootstrap.collections,
    config: {
      enabled: snapshot.bootstrap.collections.config.enabled,
      defaultEnabled: snapshot.bootstrap.collections.config.defaultEnabled,
      cursor: snapshot.pull?.nextCursors.config ?? snapshot.bootstrap.collections.config.cursor,
      recordCount: countActiveRecords(appConfigMutations),
      syncedConfig,
    },
    vocabulary: {
      enabled: snapshot.bootstrap.collections.vocabulary.enabled,
      defaultEnabled: snapshot.bootstrap.collections.vocabulary.defaultEnabled,
      cursor: snapshot.pull?.nextCursors.vocabulary ?? snapshot.bootstrap.collections.vocabulary.cursor,
      count: countActiveRecords(vocabularyMutations),
      entries: syncedVocabulary,
    },
    readingHistory: {
      enabled: snapshot.bootstrap.collections.reading_history.enabled,
      defaultEnabled: snapshot.bootstrap.collections.reading_history.defaultEnabled,
      cursor: snapshot.pull?.nextCursors.reading_history ?? snapshot.bootstrap.collections.reading_history.cursor,
      count: readingHistoryEntries.length,
      entries: readingHistoryEntries,
    },
    studyProgress: {
      enabled: snapshot.bootstrap.collections.study_progress.enabled,
      defaultEnabled: snapshot.bootstrap.collections.study_progress.defaultEnabled,
      cursor: snapshot.pull?.nextCursors.study_progress ?? snapshot.bootstrap.collections.study_progress.cursor,
      pageCount: studyProgressPages.length,
      pages: studyProgressPages,
      stepCoverage,
    },
    deepReadSessions: {
      count: deepReadSessions.length,
      sessions: deepReadSessions,
    },
    library: {
      count: libraryItems.length,
      items: libraryItems,
      snapshotCount: librarySnapshots.length,
      snapshots: librarySnapshots,
    },
    syncHealth: {
      activeDeviceCount: snapshot.devices.filter((entry) => entry.status === "active").length,
      totalDeviceCount: snapshot.devices.length,
      currentDeviceLastSyncAt: currentDevice?.lastSyncAt ?? null,
      maxMutationsPerRequest: snapshot.bootstrap.limits.maxMutationsPerRequest,
      collections: collectionHealth,
    },
    deferredCollections: [
      ...(snapshot.bootstrap.collections.reading_history.enabled ? [] : ["reading_history" as const]),
      ...(snapshot.bootstrap.collections.study_progress.enabled ? [] : ["study_progress" as const]),
    ],
  }
}

function buildPlatformObservabilityUrl(baseURL: string): string {
  return new URL("/__platform/article-import/observability", normalizeApiBaseUrl(baseURL)).toString()
}

function buildPlatformReplayUrl(baseURL: string): string {
  return new URL("/__platform/article-import/replay", normalizeApiBaseUrl(baseURL)).toString()
}

export async function fetchWebImportQueueObservability(params: {
  baseURL: string
  operatorToken?: string | null
}): Promise<WebImportQueueObservability> {
  const response = await fetch(buildPlatformObservabilityUrl(params.baseURL), {
    method: "GET",
    headers: {
      ...(params.operatorToken?.trim()
        ? { "x-astra-operator-token": params.operatorToken.trim() }
        : {}),
    },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Astra import observability request failed"))
  }

  const payload = await response.json() as {
    requestId?: string
    environment?: string
    articleImport?: {
      defaultMode?: string
      queuePolicy?: { maxAttempts?: number; operatorReplayEnabled?: boolean }
      backlog?: { queued?: number; failed?: number; deadLettered?: number; oldestQueuedAgeMs?: number | null }
      routeCounts?: Record<string, number>
      statusCounts?: Record<string, number>
      surfaceCounts?: Record<string, number>
      recentFailures?: WebArticleImportRecentFailure[]
    }
  }

  return {
    fetchedAt: new Date().toISOString(),
    requestId: payload.requestId ?? "",
    environment: payload.environment ?? "unknown",
    articleImport: {
      defaultMode: payload.articleImport?.defaultMode ?? "unknown",
      queuePolicy: {
        maxAttempts: Number(payload.articleImport?.queuePolicy?.maxAttempts ?? 0),
        operatorReplayEnabled: Boolean(payload.articleImport?.queuePolicy?.operatorReplayEnabled),
      },
      backlog: {
        queued: Number(payload.articleImport?.backlog?.queued ?? 0),
        failed: Number(payload.articleImport?.backlog?.failed ?? 0),
        deadLettered: Number(payload.articleImport?.backlog?.deadLettered ?? 0),
        oldestQueuedAgeMs: payload.articleImport?.backlog?.oldestQueuedAgeMs ?? null,
      },
      routeCounts: payload.articleImport?.routeCounts ?? {},
      statusCounts: payload.articleImport?.statusCounts ?? {},
      surfaceCounts: payload.articleImport?.surfaceCounts ?? {},
      recentFailures: (payload.articleImport?.recentFailures ?? []).map((failure) => ({
        ...failure,
        queueAttemptCount: Number(failure.queueAttemptCount ?? 0),
        replayCount: Number(failure.replayCount ?? 0),
        updatedAtEpochMs: Number(failure.updatedAtEpochMs ?? 0),
        deadLetteredAtEpochMs: failure.deadLetteredAtEpochMs ?? null,
        lastReplayedAtEpochMs: failure.lastReplayedAtEpochMs ?? null,
      })),
    },
  }
}

export async function replayWebImportJobs(params: {
  baseURL: string
  operatorToken: string
  limit?: number
  dryRun?: boolean
  reason?: string | null
  status?: "failed" | "dead_lettered"
}): Promise<WebImportReplayResult> {
  const response = await fetch(buildPlatformReplayUrl(params.baseURL), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-astra-operator-token": params.operatorToken.trim(),
    },
    body: JSON.stringify({
      status: params.status ?? "dead_lettered",
      limit: params.limit ?? 20,
      dryRun: params.dryRun ?? false,
      reason: params.reason ?? null,
    }),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Astra import replay request failed"))
  }

  const payload = await response.json() as {
    requestId?: string
    dryRun?: boolean
    summary?: {
      selected?: number
      replayed?: number
      skipped?: number
    }
  }

  return {
    requestId: payload.requestId ?? "",
    dryRun: Boolean(payload.dryRun),
    summary: {
      selected: Number(payload.summary?.selected ?? 0),
      replayed: Number(payload.summary?.replayed ?? 0),
      skipped: Number(payload.summary?.skipped ?? 0),
    },
  }
}

export async function updateWebSyncCollectionPreference(params: {
  session: AstraSession
  device: AstraDeviceIdentity
  collection: "reading_history" | "study_progress"
  enabled: boolean
}): Promise<void> {
  await updateAstraSyncCollectionPreference({
    baseURL: params.session.relayBaseURL,
    sessionToken: params.session.sessionToken,
    deviceId: params.device.deviceId,
    collection: params.collection,
    enabled: params.enabled,
  })
}

export async function fetchWebDevices(params: {
  baseURL: string
  sessionToken: string
  deviceId: string
}): Promise<WebDeviceEntry[]> {
  return fetchAstraDevices(params)
}

export async function revokeWebDevice(params: {
  baseURL: string
  sessionToken: string
  currentDeviceId: string
  targetDeviceId: string
}): Promise<WebDeviceEntry[]> {
  return revokeAstraDevice({
    baseURL: params.baseURL,
    sessionToken: params.sessionToken,
    deviceId: params.currentDeviceId,
    targetDeviceId: params.targetDeviceId,
  })
}

export async function openBillingCheckout(params: {
  session: AstraSession
  plan: AstraPlan
}): Promise<string> {
  const link = await createAstraCheckoutLink({
    baseURL: params.session.relayBaseURL,
    sessionToken: params.session.sessionToken,
    plan: params.plan,
  })

  return link.url
}

export async function openBillingPortal(params: {
  session: AstraSession
}): Promise<string> {
  const link = await createAstraPortalLink({
    baseURL: params.session.relayBaseURL,
    sessionToken: params.session.sessionToken,
  })

  return link.url
}

export async function createWebVideoNoteJob(params: {
  session: AstraSession
  request: VideoNoteCreateRequest
}): Promise<WebVideoNoteCreateResponse> {
  const response = await fetch(`${params.session.relayBaseURL}/video-notes/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.session.sessionToken}`,
    },
    body: JSON.stringify(params.request),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Video-note job creation failed"))
  }

  return VideoNoteCreateResponseSchema.parse(await response.json())
}

export async function fetchWebVideoNoteJob(params: {
  session: AstraSession
  jobId: string
}): Promise<WebVideoNoteStatusResponse> {
  const response = await fetch(`${params.session.relayBaseURL}/video-notes/jobs/${encodeURIComponent(params.jobId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.session.sessionToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Video-note job fetch failed"))
  }

  return VideoNoteStatusResponseSchema.parse(await response.json())
}

export async function fetchWebVideoNoteArtifact(params: {
  session: AstraSession
  jobId: string
}): Promise<WebVideoNoteArtifact> {
  const response = await fetch(`${params.session.relayBaseURL}/video-notes/jobs/${encodeURIComponent(params.jobId)}/artifact`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.session.sessionToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Video-note artifact fetch failed"))
  }

  const payload = VideoNoteArtifactResponseSchema.parse(await response.json())
  return payload.artifact
}

function serializeTranslationRequestContext(context?: TranslationRequestContext): string {
  return JSON.stringify({
    pageTitle: context?.pageTitle?.trim() || "",
    pageUrl: context?.pageUrl?.trim() || "",
    hostname: context?.hostname?.trim() || "",
    metaDescription: context?.metaDescription?.trim() || "",
    contentSummary: context?.contentSummary?.trim() || "",
    selectionContext: context?.selectionContext?.trim() || "",
    terminologyGlossary: context?.terminologyGlossary?.trim() || "",
  })
}

function buildTranslationCacheContext(
  config: AstraConfig,
  request: WebTranslateRequest,
): TranslationCacheContext {
  return {
    providerId: config.provider.id,
    model: config.provider.model,
    connectionMode: config.connectionMode,
    routingKey: "astra",
    languageLevel: config.languageLevel,
    sourceLang: request.sourceLang,
    requestContextKey: serializeTranslationRequestContext(request.context),
  }
}

function splitIntoSegments(
  texts: string[],
  options: { preservePlaceholderTokens?: boolean } = {},
): TranslateSegment[] {
  return texts.flatMap((text, originalIndex) => {
    if (options.preservePlaceholderTokens) {
      return [{ originalIndex, text }]
    }

    const codePoints = Array.from(text)
    if (codePoints.length <= MAX_BATCH_CHARS) {
      return [{ originalIndex, text }]
    }

    const segments: TranslateSegment[] = []
    for (let start = 0; start < codePoints.length; start += MAX_BATCH_CHARS) {
      segments.push({
        originalIndex,
        text: codePoints.slice(start, start + MAX_BATCH_CHARS).join(""),
      })
    }

    return segments
  })
}

function createBatches(segments: TranslateSegment[]): TranslateBatch[] {
  const batches: TranslateBatch[] = []
  let currentBatch: TranslateBatch = { originalIndices: [], texts: [], charCount: 0 }

  segments.forEach(({ originalIndex, text }) => {
    const nextCharCount = currentBatch.charCount + text.length
    const shouldFlush = currentBatch.texts.length > 0
      && (currentBatch.texts.length >= MAX_BATCH_ITEMS || nextCharCount > MAX_BATCH_CHARS)

    if (shouldFlush) {
      batches.push(currentBatch)
      currentBatch = { originalIndices: [], texts: [], charCount: 0 }
    }

    currentBatch.originalIndices.push(originalIndex)
    currentBatch.texts.push(text)
    currentBatch.charCount += text.length
  })

  if (currentBatch.texts.length > 0) {
    batches.push(currentBatch)
  }

  return batches
}

async function withConcurrency<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results = new Array<T>(tasks.length)
  let nextIndex = 0

  async function worker() {
    while (true) {
      const taskIndex = nextIndex
      nextIndex += 1

      if (taskIndex >= tasks.length) return
      results[taskIndex] = await tasks[taskIndex]()
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()))
  return results
}

function isCacheable(
  task: TranslationTask,
  customSystemPrompt?: string,
  placeholderFormat?: TranslationPlaceholderFormat,
): boolean {
  return task === "translate" && !customSystemPrompt && !placeholderFormat
}

function resolveProviderSelection(
  session: AstraSession,
  config: AstraConfig,
): { providerId: ProviderId; model: string } {
  const requestedProvider = config.provider.id
  if (session.providerEntitlements.includes(requestedProvider)) {
    return {
      providerId: requestedProvider,
      model: config.provider.model,
    }
  }

  const fallbackProvider = (session.providerEntitlements[0] as ProviderId | undefined) ?? requestedProvider
  return {
    providerId: fallbackProvider,
    model: fallbackProvider === "gemini" ? DEFAULT_GEMINI_MODEL : DEFAULT_OPENAI_MODEL,
  }
}

export async function translateWithWebRelay(params: {
  session: AstraSession
  config: AstraConfig
  request: WebTranslateRequest
}): Promise<WebTranslateResult> {
  const { request, session, config } = params
  const {
    texts,
    targetLang,
    sourceLang,
    context,
    task = "translate",
    customSystemPrompt,
    placeholderFormat,
  } = request

  if (texts.length === 0) {
    return {
      ok: true,
      translations: [],
      providerId: config.provider.id,
    }
  }

  const cacheable = isCacheable(task, customSystemPrompt, placeholderFormat)
  const cacheContext = cacheable ? buildTranslationCacheContext(config, request) : null
  const shouldUseCache = cacheable && cacheContext !== null

  let cachedResults = new Map<number, string>()
  if (shouldUseCache && cacheContext) {
    try {
      cachedResults = await getCachedTranslations(
        texts.map((text) => ({
          text,
          targetLang,
          cacheContext,
        })),
      )
    } catch {
      cachedResults = new Map()
    }
  }

  const uncachedEntries: Array<{ originalIndex: number; text: string }> = []
  for (let index = 0; index < texts.length; index += 1) {
    if (!cachedResults.has(index)) {
      uncachedEntries.push({ originalIndex: index, text: texts[index] })
    }
  }

  if (uncachedEntries.length === 0) {
    return {
      ok: true,
      translations: texts.map((_, index) => cachedResults.get(index) ?? ""),
      providerId: config.provider.id,
    }
  }

  const uncachedTexts = uncachedEntries.map((entry) => entry.text)
  const segments = splitIntoSegments(uncachedTexts, {
    preservePlaceholderTokens: placeholderFormat === "astra-rich-text-v1",
  })
  const batches = createBatches(segments)
  const provider = resolveProviderSelection(session, config)

  const batchTasks = batches.map((batch) => async () => translateWithRelay({
    providerId: provider.providerId,
    accessToken: session.sessionToken,
    relayBaseURL: session.relayBaseURL,
    model: provider.model,
    texts: batch.texts,
    targetLang,
    ...(sourceLang ? { sourceLang } : {}),
    ...(context ? { context } : {}),
    ...(task ? { task } : {}),
    ...(customSystemPrompt ? { customSystemPrompt } : {}),
    ...(config.languageLevel ? { languageLevel: config.languageLevel } : {}),
    ...(placeholderFormat ? { placeholderFormat } : {}),
  }))

  let batchResults: string[][]
  try {
    batchResults = await withConcurrency(batchTasks, MAX_CONCURRENCY)
  } catch (error) {
    return { ok: false, error: toTranslationError(error, "PROVIDER_REQUEST_FAILED") }
  }

  const uncachedTranslations = Array.from({ length: uncachedTexts.length }, () => "")
  for (const [batchIndex, batchResult] of batchResults.entries()) {
    const batch = batches[batchIndex]

    if (batchResult.length !== batch.texts.length) {
      return {
        ok: false,
        error: createTranslationError(
          "INVALID_RESPONSE",
          "Translation batch response length did not match the request.",
        ),
      }
    }

    batch.originalIndices.forEach((originalIndex, translationIndex) => {
      uncachedTranslations[originalIndex] += batchResult[translationIndex]
    })
  }

  if (shouldUseCache && cacheContext) {
    for (let index = 0; index < uncachedEntries.length; index += 1) {
      void setCachedTranslation(
        uncachedEntries[index].text,
        targetLang,
        uncachedTranslations[index],
        cacheContext,
      ).catch(() => {})
    }
  }

  const translations = Array.from({ length: texts.length }, () => "")
  for (const [index, cachedTranslation] of cachedResults.entries()) {
    translations[index] = cachedTranslation
  }

  for (let index = 0; index < uncachedEntries.length; index += 1) {
    translations[uncachedEntries[index].originalIndex] = uncachedTranslations[index]
  }

  return {
    ok: true,
    translations,
    providerId: provider.providerId,
  }
}

export function saveTextTransferDraft(draft: Omit<TextTransferDraft, "createdAt">) {
  writeJsonStorage(WEB_TEXT_TRANSFER_STORAGE_KEY, {
    ...draft,
    createdAt: new Date().toISOString(),
  })
}

export function readTextTransferDraft(): TextTransferDraft | null {
  return readJsonStorage(WEB_TEXT_TRANSFER_STORAGE_KEY, TextTransferDraftSchema)
}

export function clearTextTransferDraft() {
  removeStorage(WEB_TEXT_TRANSFER_STORAGE_KEY)
}
