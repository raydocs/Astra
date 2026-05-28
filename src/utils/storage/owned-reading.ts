/**
 * Owned reading queue — Month 3 minimal persistence (extension vocabulary surface).
 */
import { browser } from "#imports"
import { z } from "zod"

import { buildReadingHistoryRecordId } from "./reading-history"
import type { ReadingHistoryEntry } from "./reading-history"
import { buildStudyProgressRecordId } from "./study-progress"
import { VocabularyEntrySchema, type VocabularyEntry } from "./vocabulary-core"

export const OwnedReadingSourceTypeSchema = z.enum(["article", "pdf", "epub", "subtitle-file"])
export type OwnedReadingSourceType = z.infer<typeof OwnedReadingSourceTypeSchema>

export const OwnedReadingStatusSchema = z.enum(["in_progress", "saved", "archived"])
export type OwnedReadingStatus = z.infer<typeof OwnedReadingStatusSchema>

export const OwnedReadingQueueViewSchema = z.enum(["recent", "saved", "in_progress"])
export type OwnedReadingQueueView = z.infer<typeof OwnedReadingQueueViewSchema>

export const OwnedReadingProgressSchema = z.object({
  fraction: z.number().min(0).max(1).optional(),
  chapterId: z.string().optional(),
  sentenceIndex: z.number().int().nonnegative().optional(),
}).optional()

export const DEFAULT_OWNED_READING_USER_CONTROL = {
  syncEnabled: true,
  excludedFromDigest: false,
  privacyModeAtCapture: false,
} as const

export const OwnedReadingUserControlSchema = z.object({
  syncEnabled: z.boolean().default(DEFAULT_OWNED_READING_USER_CONTROL.syncEnabled),
  excludedFromDigest: z.boolean().default(DEFAULT_OWNED_READING_USER_CONTROL.excludedFromDigest),
  privacyModeAtCapture: z.boolean().default(DEFAULT_OWNED_READING_USER_CONTROL.privacyModeAtCapture),
}).default(DEFAULT_OWNED_READING_USER_CONTROL)
export type OwnedReadingUserControl = z.infer<typeof OwnedReadingUserControlSchema>

export const OwnedReadingItemSchema = z.object({
  id: z.string().trim().min(1),
  sourceType: OwnedReadingSourceTypeSchema,
  title: z.string().trim().min(1),
  sourceUrl: z.string().trim().min(1).nullable().optional(),
  localUri: z.string().trim().min(1).nullable().optional(),
  /** User-facing hint when `sourceUrl` is null (local file readers). */
  reopenHint: z.string().trim().min(1).max(400).optional(),
  openedAt: z.number(),
  updatedAt: z.number().optional(),
  progress: OwnedReadingProgressSchema,
  status: OwnedReadingStatusSchema,
  readingHistoryRecordId: z.string().trim().min(1).nullable().optional(),
  studyProgressRecordId: z.string().trim().min(1).nullable().optional(),
  userControl: OwnedReadingUserControlSchema.optional(),
})

export type OwnedReadingItem = z.infer<typeof OwnedReadingItemSchema>
type NormalizedOwnedReadingItem = OwnedReadingItem & { userControl: OwnedReadingUserControl }

export const SyncedOwnedReadingItemSchema = OwnedReadingItemSchema.extend({
  updatedAt: z.number(),
})

export type SyncedOwnedReadingItem = z.infer<typeof SyncedOwnedReadingItemSchema>

export interface OwnedReadingSyncMutationLike {
  recordId: string
  operation: "upsert" | "delete"
  payload?: unknown | null
}

export const OwnedReadingStoreSchema = z.object({
  version: z.literal(1),
  items: z.array(OwnedReadingItemSchema),
})

type OwnedReadingStore = z.infer<typeof OwnedReadingStoreSchema>

export const OWNED_READING_STORAGE_KEY = "astra.owned_reading.v1"
const MAX_ITEMS = 200

export interface OwnedReadingIdentity {
  sourceType: OwnedReadingSourceType
  dedupeKey: string
  id: string
  sourceUrl: string | null
  localUri: string | null
  readingHistoryRecordId: string | null
  studyProgressRecordId: string | null
}

export interface OwnedReadingResumeTarget {
  url: string
  sourceType: OwnedReadingSourceType
  mode: "direct" | "reader_handoff"
  requiresFileSelection: boolean
}

export interface OwnedReadingThemePackAsset {
  id: string
  sourceType: OwnedReadingSourceType
  sourceTypeLabel: string
  title: string
  status: OwnedReadingStatus
  openedAt: number
  updatedAt: number
  sourceUrl: string | null
  localUri: string | null
  reopenHint?: string
  progress?: OwnedReadingItem["progress"]
  readingHistoryRecordId: string | null
  studyProgressRecordId: string | null
}

export interface OwnedReadingThemePack {
  id: string
  themeKey: string
  title: string
  assetCount: number
  assets: OwnedReadingThemePackAsset[]
}

export interface OwnedReadingThemePackExport {
  schema: "astra-owned-reading-theme-packs.v1"
  generatedAt: string
  assetCount: number
  themePackCount: number
  themePacks: OwnedReadingThemePack[]
}

export interface OwnedReadingThemePackExportOptions {
  generatedAt?: Date | string | number
}

export interface OwnedReadingThemePackPackagePayload {
  schema: "astra-owned-reading-theme-pack-payload.v3"
  generatedAt: string
  ownedReading: OwnedReadingThemePackExport
  vocabularyEntries: VocabularyEntry[]
}

export interface OwnedReadingThemePackPackageSignature {
  algorithm: "SHA-256"
  value: string
}

export interface SignedOwnedReadingThemePackPackage {
  schema: "astra-owned-reading-theme-pack-package.v3"
  generatedAt: string
  payload: OwnedReadingThemePackPackagePayload
  signature: OwnedReadingThemePackPackageSignature
}

export interface OwnedReadingThemePackPackageImportResult {
  importedCount: number
  skippedCount: number
  verified: true
}

export type OwnedReadingThemePackPackageImportPreviewAction = "update" | "skip"

export interface OwnedReadingThemePackPackageImportPreviewConflict {
  id: string
  title: string
  sourceType: OwnedReadingSourceType
  action: OwnedReadingThemePackPackageImportPreviewAction
  existingUpdatedAt: number
  incomingUpdatedAt: number
}

export interface OwnedReadingThemePackPackageRollbackPreview {
  restoreCount: number
  removeCount: number
}

export interface OwnedReadingThemePackPackageImportPreview {
  totalCount: number
  importedCount: number
  skippedCount: number
  newCount: number
  updatedCount: number
  conflicts: OwnedReadingThemePackPackageImportPreviewConflict[]
  rollback: OwnedReadingThemePackPackageRollbackPreview
  verified: true
}

export interface OwnedReadingVocabularySourceLink {
  ownedReadingItemId: string
  ownedReadingSourceType: OwnedReadingSourceType
  ownedReadingTitle: string
  studyProgressRecordId?: string
}

function buildOwnedReadingStableId(sourceType: OwnedReadingSourceType, dedupeKey: string): string {
  return `or_${sourceType}_${encodeURIComponent(dedupeKey)}`
}

function emptyStore(): OwnedReadingStore {
  return { version: 1, items: [] }
}

function normalizeOwnedReadingItem(item: OwnedReadingItem): NormalizedOwnedReadingItem {
  const parsed = OwnedReadingItemSchema.parse(item)
  return {
    ...parsed,
    updatedAt: parsed.updatedAt ?? parsed.openedAt,
    userControl: OwnedReadingUserControlSchema.parse(parsed.userControl),
  }
}

function normalizeOwnedReadingItems(items: readonly OwnedReadingItem[]): OwnedReadingItem[] {
  const byId = new Map<string, OwnedReadingItem>()
  for (const item of items) {
    const normalized = normalizeOwnedReadingItem(item)
    const existing = byId.get(normalized.id)
    if (!existing || (normalized.updatedAt ?? normalized.openedAt) > (existing.updatedAt ?? existing.openedAt)) {
      byId.set(normalized.id, normalized)
    }
  }
  return [...byId.values()]
    .sort((a, b) => b.openedAt - a.openedAt)
    .slice(0, MAX_ITEMS)
}

function parseStore(raw: unknown): OwnedReadingStore {
  const parsed = OwnedReadingStoreSchema.safeParse(raw)
  return parsed.success
    ? { ...parsed.data, items: normalizeOwnedReadingItems(parsed.data.items) }
    : emptyStore()
}

async function readStore(): Promise<OwnedReadingStore> {
  const raw = await browser.storage.local.get(OWNED_READING_STORAGE_KEY)
  return parseStore(raw[OWNED_READING_STORAGE_KEY])
}

async function writeStore(store: OwnedReadingStore): Promise<void> {
  const normalized = OwnedReadingStoreSchema.parse({
    ...store,
    items: normalizeOwnedReadingItems(store.items),
  })
  await browser.storage.local.set({ [OWNED_READING_STORAGE_KEY]: normalized })
}

export function buildSyncSafeOwnedReadingItem(
  item: OwnedReadingItem | SyncedOwnedReadingItem,
): SyncedOwnedReadingItem {
  const normalized = normalizeOwnedReadingItem(item)
  return SyncedOwnedReadingItemSchema.parse({
    id: normalized.id,
    sourceType: normalized.sourceType,
    title: normalized.title,
    sourceUrl: normalized.sourceUrl ?? null,
    localUri: normalized.localUri ?? null,
    reopenHint: normalized.reopenHint,
    openedAt: normalized.openedAt,
    updatedAt: normalized.updatedAt ?? normalized.openedAt,
    progress: normalized.progress,
    status: normalized.status,
    readingHistoryRecordId: normalized.readingHistoryRecordId ?? null,
    studyProgressRecordId: normalized.studyProgressRecordId ?? null,
    userControl: normalized.userControl,
  })
}

export async function readSyncSafeOwnedReadingItems(): Promise<SyncedOwnedReadingItem[]> {
  const store = await readStore()
  return store.items
    .filter((item) => normalizeOwnedReadingItem(item).userControl.syncEnabled)
    .map((item) => buildSyncSafeOwnedReadingItem(item))
}

export function buildOwnedReadingSyncRecordMap(
  items: Array<OwnedReadingItem | SyncedOwnedReadingItem>,
): Record<string, SyncedOwnedReadingItem> {
  return Object.fromEntries(
    normalizeOwnedReadingItems(items).map((item) => {
      const synced = buildSyncSafeOwnedReadingItem(item)
      return [synced.id, synced]
    }),
  )
}

function shouldUseIncomingOwnedReading(
  existing: OwnedReadingItem | null,
  incoming: SyncedOwnedReadingItem,
): boolean {
  if (!existing) return true
  const existingUpdatedAt = existing.updatedAt ?? existing.openedAt
  if (incoming.updatedAt === existingUpdatedAt) return false
  return incoming.updatedAt > existingUpdatedAt
}

export function applyOwnedReadingSyncMutation(
  items: OwnedReadingItem[],
  mutation: OwnedReadingSyncMutationLike,
): OwnedReadingItem[] {
  const currentItems = normalizeOwnedReadingItems(items)

  if (mutation.operation === "delete") {
    // Sync delete records do not carry the removed row's updatedAt in the current
    // transport, so deletes are intentionally authoritative once pulled.
    return currentItems.filter((item) => item.id !== mutation.recordId)
  }

  const incoming = buildSyncSafeOwnedReadingItem(
    SyncedOwnedReadingItemSchema.parse(mutation.payload),
  )
  if (incoming.id !== mutation.recordId) {
    throw new Error("Owned reading sync recordId must match the item id.")
  }

  const existing = currentItems.find((item) => item.id === mutation.recordId) ?? null
  const nextItem = shouldUseIncomingOwnedReading(existing, incoming)
    ? incoming
    : existing!

  return normalizeOwnedReadingItems([
    nextItem,
    ...currentItems.filter((item) => item.id !== mutation.recordId),
  ])
}

export function applyOwnedReadingSyncMutations(
  items: OwnedReadingItem[],
  mutations: OwnedReadingSyncMutationLike[],
): OwnedReadingItem[] {
  return mutations.reduce(
    (currentItems, mutation) => applyOwnedReadingSyncMutation(currentItems, mutation),
    normalizeOwnedReadingItems(items),
  )
}

export async function replaceOwnedReadingItems(items: OwnedReadingItem[]): Promise<void> {
  await writeStore({ version: 1, items })
}

function normalizeOwnedReadingFileName(fileName: string | null | undefined, fallback: string): string {
  const trimmed = fileName?.trim()
  return trimmed || fallback
}

export function buildOwnedReadingLocalUri(
  sourceType: Extract<OwnedReadingSourceType, "pdf" | "epub" | "subtitle-file">,
  fileName: string,
): string {
  const safeFile = normalizeOwnedReadingFileName(fileName, sourceType === "pdf"
    ? "document.pdf"
    : sourceType === "epub"
      ? "book.epub"
      : "subtitles.srt")
  const prefix = sourceType === "pdf"
    ? "pdf"
    : sourceType === "epub"
      ? "epub"
      : "subtitle"
  return `astra-local://${prefix}/${encodeURIComponent(safeFile)}`
}

export function buildOwnedReadingArticleIdentity(url: string): OwnedReadingIdentity {
  const historyId = buildReadingHistoryRecordId(url)
  let studyId: string | null = null
  try {
    studyId = buildStudyProgressRecordId(url)
  } catch {
    studyId = null
  }
  return {
    sourceType: "article",
    dedupeKey: historyId,
    id: buildOwnedReadingStableId("article", historyId),
    sourceUrl: historyId,
    localUri: null,
    readingHistoryRecordId: historyId,
    studyProgressRecordId: studyId,
  }
}

export function buildOwnedReadingRemotePdfIdentity(url: string): OwnedReadingIdentity {
  const sourceUrl = buildStudyProgressRecordId(url)
  return {
    sourceType: "pdf",
    dedupeKey: sourceUrl,
    id: buildOwnedReadingStableId("pdf", sourceUrl),
    sourceUrl,
    localUri: null,
    readingHistoryRecordId: null,
    studyProgressRecordId: sourceUrl,
  }
}

export function buildOwnedReadingLocalFileIdentity(
  sourceType: Extract<OwnedReadingSourceType, "pdf" | "epub" | "subtitle-file">,
  fileName: string,
): OwnedReadingIdentity {
  const localUri = buildOwnedReadingLocalUri(sourceType, fileName)
  return {
    sourceType,
    dedupeKey: localUri,
    id: buildOwnedReadingStableId(sourceType, localUri),
    sourceUrl: null,
    localUri,
    readingHistoryRecordId: null,
    studyProgressRecordId: null,
  }
}

export function deriveOwnedReadingIdentityFromItem(
  item: Pick<OwnedReadingItem, "sourceType" | "sourceUrl" | "localUri" | "readingHistoryRecordId" | "studyProgressRecordId">,
): OwnedReadingIdentity | null {
  if (item.sourceType === "article") {
    const key = item.readingHistoryRecordId?.trim() || item.sourceUrl?.trim() || item.studyProgressRecordId?.trim()
    return key ? buildOwnedReadingArticleIdentity(key) : null
  }
  if (item.sourceType === "pdf" && item.sourceUrl?.trim()) {
    return buildOwnedReadingRemotePdfIdentity(item.sourceUrl)
  }
  if ((item.sourceType === "pdf" || item.sourceType === "epub" || item.sourceType === "subtitle-file") && item.localUri?.trim()) {
    return {
      sourceType: item.sourceType,
      dedupeKey: item.localUri.trim(),
      id: buildOwnedReadingStableId(item.sourceType, item.localUri.trim()),
      sourceUrl: null,
      localUri: item.localUri.trim(),
      readingHistoryRecordId: null,
      studyProgressRecordId: null,
    }
  }
  return null
}

export function buildOwnedReadingVocabularySourceLink(
  item: Pick<OwnedReadingItem, "id" | "sourceType" | "title" | "studyProgressRecordId">,
): OwnedReadingVocabularySourceLink {
  return {
    ownedReadingItemId: item.id,
    ownedReadingSourceType: item.sourceType,
    ownedReadingTitle: item.title,
    ...(item.studyProgressRecordId?.trim() ? { studyProgressRecordId: item.studyProgressRecordId.trim() } : {}),
  }
}

export function getOwnedReadingSourceTypeLabel(sourceType: OwnedReadingSourceType): string {
  switch (sourceType) {
    case "article":
      return "Article"
    case "pdf":
      return "PDF"
    case "epub":
      return "EPUB"
    case "subtitle-file":
      return "Subtitle file"
  }
}

export function matchesOwnedReadingQueueView(item: OwnedReadingItem, view: OwnedReadingQueueView): boolean {
  if (view === "recent") {
    return item.status !== "archived"
  }
  return item.status === view
}

export function filterOwnedReadingItemsByView(
  items: readonly OwnedReadingItem[],
  view: OwnedReadingQueueView,
): OwnedReadingItem[] {
  return items.filter((item) => matchesOwnedReadingQueueView(item, view))
}

export function countOwnedReadingItemsByView(
  items: readonly OwnedReadingItem[],
  view: OwnedReadingQueueView,
): number {
  return items.reduce((count, item) => count + (matchesOwnedReadingQueueView(item, view) ? 1 : 0), 0)
}

function compareStableText(a: string, b: string): number {
  const left = a.trim().toLowerCase()
  const right = b.trim().toLowerCase()
  if (left < right) return -1
  if (left > right) return 1
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function normalizeThemeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled"
}

function tryGetOwnedReadingHostname(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  try {
    return new URL(trimmed).hostname.toLowerCase() || null
  } catch {
    return null
  }
}

function buildReducedOwnedArticleUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.hostname}/`
  } catch {
    return "astra-private://source/"
  }
}

function buildReducedOwnedArticleTitle(): string {
  return "Private page"
}

async function resolveOwnedArticleWritePolicy(url: string) {
  const { resolveLearningMemoryWritePolicy } = await import("./learning-memory")
  return resolveLearningMemoryWritePolicy({
    surface: "source_history",
    hostname: tryGetOwnedReadingHostname(url),
    url,
  })
}

function buildOwnedReadingThemePackDescriptor(item: OwnedReadingItem): { id: string; themeKey: string; title: string } {
  if (item.sourceType === "article") {
    const hostname = tryGetOwnedReadingHostname(deriveOwnedReadingArticleUrl(item))
    const themeKey = hostname ? `article:${hostname}` : "article:unknown"
    return {
      id: `theme_${normalizeThemeToken(themeKey)}`,
      themeKey,
      title: hostname ? `Articles from ${hostname}` : "Saved articles",
    }
  }

  if (item.sourceType === "pdf") {
    const hostname = tryGetOwnedReadingHostname(item.sourceUrl ?? item.studyProgressRecordId)
    const themeKey = hostname ? `pdf:${hostname}` : "pdf:local"
    return {
      id: `theme_${normalizeThemeToken(themeKey)}`,
      themeKey,
      title: hostname ? `PDFs from ${hostname}` : "Local PDFs",
    }
  }

  const themeKey = item.sourceType === "epub" ? "epub:local" : "subtitle-file:local"
  return {
    id: `theme_${normalizeThemeToken(themeKey)}`,
    themeKey,
    title: item.sourceType === "epub" ? "EPUB books" : "Subtitle files",
  }
}

function buildOwnedReadingThemePackAsset(item: OwnedReadingItem): OwnedReadingThemePackAsset {
  return {
    id: item.id,
    sourceType: item.sourceType,
    sourceTypeLabel: getOwnedReadingSourceTypeLabel(item.sourceType),
    title: item.title,
    status: item.status,
    openedAt: item.openedAt,
    updatedAt: item.updatedAt ?? item.openedAt,
    sourceUrl: item.sourceUrl ?? null,
    localUri: item.localUri ?? null,
    reopenHint: item.reopenHint,
    progress: item.progress,
    readingHistoryRecordId: item.readingHistoryRecordId ?? null,
    studyProgressRecordId: item.studyProgressRecordId ?? null,
  }
}

function compareOwnedReadingThemePackAssets(a: OwnedReadingThemePackAsset, b: OwnedReadingThemePackAsset): number {
  const titleOrder = compareStableText(a.title, b.title)
  if (titleOrder !== 0) return titleOrder
  if (a.openedAt !== b.openedAt) return b.openedAt - a.openedAt
  return compareStableText(a.id, b.id)
}

export function buildOwnedReadingThemePacks(items: readonly OwnedReadingItem[]): OwnedReadingThemePack[] {
  const packs = new Map<string, Omit<OwnedReadingThemePack, "assetCount">>()
  const eligibleItems = normalizeOwnedReadingItems(items.filter((item) => item.status !== "archived"))

  for (const item of eligibleItems) {
    const descriptor = buildOwnedReadingThemePackDescriptor(item)
    const existing = packs.get(descriptor.id)
    const nextPack = existing ?? {
      id: descriptor.id,
      themeKey: descriptor.themeKey,
      title: descriptor.title,
      assets: [],
    }
    nextPack.assets.push(buildOwnedReadingThemePackAsset(item))
    packs.set(descriptor.id, nextPack)
  }

  return [...packs.values()]
    .map((pack) => {
      const assets = [...pack.assets].sort(compareOwnedReadingThemePackAssets)
      return {
        id: pack.id,
        themeKey: pack.themeKey,
        title: pack.title,
        assetCount: assets.length,
        assets,
      }
    })
    .sort((a, b) => compareStableText(a.title, b.title) || compareStableText(a.id, b.id))
}

function normalizeThemePackGeneratedAt(value: Date | string | number | undefined): string {
  if (value === undefined) return new Date().toISOString()
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString()
}

export function buildOwnedReadingThemePackExport(
  items: readonly OwnedReadingItem[],
  options: OwnedReadingThemePackExportOptions = {},
): OwnedReadingThemePackExport {
  const themePacks = buildOwnedReadingThemePacks(items)
  const assetCount = themePacks.reduce((count, pack) => count + pack.assetCount, 0)
  return {
    schema: "astra-owned-reading-theme-packs.v1",
    generatedAt: normalizeThemePackGeneratedAt(options.generatedAt),
    assetCount,
    themePackCount: themePacks.length,
    themePacks,
  }
}

const OwnedReadingThemePackAssetSchema = z.object({
  id: z.string().trim().min(1),
  sourceType: OwnedReadingSourceTypeSchema,
  sourceTypeLabel: z.string().trim().min(1),
  title: z.string().trim().min(1),
  status: OwnedReadingStatusSchema,
  openedAt: z.number(),
  updatedAt: z.number(),
  sourceUrl: z.string().trim().min(1).nullable(),
  localUri: z.string().trim().min(1).nullable(),
  reopenHint: z.string().trim().min(1).max(400).optional(),
  progress: OwnedReadingProgressSchema,
  readingHistoryRecordId: z.string().trim().min(1).nullable(),
  studyProgressRecordId: z.string().trim().min(1).nullable(),
})

const OwnedReadingThemePackSchema = z.object({
  id: z.string().trim().min(1),
  themeKey: z.string().trim().min(1),
  title: z.string().trim().min(1),
  assetCount: z.number().int().nonnegative(),
  assets: z.array(OwnedReadingThemePackAssetSchema),
})

const OwnedReadingThemePackExportSchema = z.object({
  schema: z.literal("astra-owned-reading-theme-packs.v1"),
  generatedAt: z.string().trim().min(1),
  assetCount: z.number().int().nonnegative(),
  themePackCount: z.number().int().nonnegative(),
  themePacks: z.array(OwnedReadingThemePackSchema),
})

const OwnedReadingThemePackPackagePayloadSchema = z.object({
  schema: z.literal("astra-owned-reading-theme-pack-payload.v3"),
  generatedAt: z.string().trim().min(1),
  ownedReading: OwnedReadingThemePackExportSchema,
  vocabularyEntries: z.array(VocabularyEntrySchema),
})

const SignedOwnedReadingThemePackPackageSchema = z.object({
  schema: z.literal("astra-owned-reading-theme-pack-package.v3"),
  generatedAt: z.string().trim().min(1),
  payload: OwnedReadingThemePackPackagePayloadSchema,
  signature: z.object({
    algorithm: z.literal("SHA-256"),
    value: z.string().regex(/^[a-f0-9]{64}$/),
  }),
})

function canonicalizeForSignature(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeForSignature(item)).join(",")}]`
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => compareStableText(left, right))

  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalizeForSignature(entryValue)}`).join(",")}}`
}

async function sha256Hex(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw new Error("Theme-pack package signing requires Web Crypto SHA-256 support.")
  }

  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(value))
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

async function signOwnedReadingThemePackPayload(
  payload: OwnedReadingThemePackPackagePayload,
): Promise<OwnedReadingThemePackPackageSignature> {
  return {
    algorithm: "SHA-256",
    value: await sha256Hex(canonicalizeForSignature(payload)),
  }
}

function vocabularyEntryBelongsToOwnedReadingAssets(
  entry: VocabularyEntry,
  eligibleAssetIds: ReadonlySet<string>,
): boolean {
  const linkedId = entry.sourceContext?.ownedReadingItemId?.trim()
  return Boolean(linkedId && eligibleAssetIds.has(linkedId))
}

function compareVocabularyThemePackEntries(a: VocabularyEntry, b: VocabularyEntry): number {
  return compareStableText(a.text, b.text)
    || compareStableText(a.url ?? "", b.url ?? "")
    || compareStableText(a.id, b.id)
}

export async function buildSignedOwnedReadingThemePackPackage(
  items: readonly OwnedReadingItem[],
  vocabularyEntries: readonly VocabularyEntry[] = [],
  options: OwnedReadingThemePackExportOptions = {},
): Promise<SignedOwnedReadingThemePackPackage> {
  const generatedAt = normalizeThemePackGeneratedAt(options.generatedAt)
  const ownedReading = buildOwnedReadingThemePackExport(items, { generatedAt })
  const eligibleAssetIds = new Set(
    ownedReading.themePacks.flatMap((pack) => pack.assets.map((asset) => asset.id)),
  )
  const packagedVocabularyEntries = vocabularyEntries
    .filter((entry) => vocabularyEntryBelongsToOwnedReadingAssets(entry, eligibleAssetIds))
    .map((entry) => VocabularyEntrySchema.parse(entry))
    .sort(compareVocabularyThemePackEntries)
  const payload: OwnedReadingThemePackPackagePayload = {
    schema: "astra-owned-reading-theme-pack-payload.v3",
    generatedAt,
    ownedReading,
    vocabularyEntries: packagedVocabularyEntries,
  }

  return {
    schema: "astra-owned-reading-theme-pack-package.v3",
    generatedAt,
    payload,
    signature: await signOwnedReadingThemePackPayload(payload),
  }
}

export function parseSignedOwnedReadingThemePackPackage(raw: string | unknown): SignedOwnedReadingThemePackPackage {
  const value = typeof raw === "string" ? JSON.parse(raw) : raw
  return SignedOwnedReadingThemePackPackageSchema.parse(value)
}

export async function verifyOwnedReadingThemePackPackage(
  signedPackage: string | unknown,
): Promise<OwnedReadingThemePackPackagePayload> {
  const parsed = parseSignedOwnedReadingThemePackPackage(signedPackage)
  const expected = await signOwnedReadingThemePackPayload(parsed.payload)
  if (parsed.signature.algorithm !== expected.algorithm || parsed.signature.value !== expected.value) {
    throw new Error("Theme-pack package signature verification failed.")
  }
  return parsed.payload
}

function ownedReadingItemFromThemePackAsset(asset: OwnedReadingThemePackAsset): OwnedReadingItem {
  return OwnedReadingItemSchema.parse({
    id: asset.id,
    sourceType: asset.sourceType,
    title: asset.title,
    sourceUrl: asset.sourceUrl ?? null,
    localUri: asset.localUri ?? null,
    reopenHint: asset.reopenHint,
    openedAt: asset.openedAt,
    updatedAt: asset.updatedAt,
    progress: asset.progress,
    status: asset.status,
    readingHistoryRecordId: asset.readingHistoryRecordId ?? null,
    studyProgressRecordId: asset.studyProgressRecordId ?? null,
  })
}

export function extractOwnedReadingItemsFromThemePackPayload(
  payload: OwnedReadingThemePackPackagePayload,
): OwnedReadingItem[] {
  const parsed = OwnedReadingThemePackPackagePayloadSchema.parse(payload)
  return normalizeOwnedReadingItems(parsed.ownedReading.themePacks.flatMap((pack) => (
    pack.assets.map((asset) => ownedReadingItemFromThemePackAsset(asset))
  )))
}

function shouldImportOwnedReadingItem(existing: OwnedReadingItem | null, incoming: OwnedReadingItem): boolean {
  if (!existing) return true
  return (incoming.updatedAt ?? incoming.openedAt) > (existing.updatedAt ?? existing.openedAt)
}

function buildOwnedReadingThemePackPackageImportPreview(
  existingItems: readonly OwnedReadingItem[],
  incomingItems: readonly OwnedReadingItem[],
): OwnedReadingThemePackPackageImportPreview {
  const byId = new Map(existingItems.map((item) => [item.id, item]))
  const conflicts: OwnedReadingThemePackPackageImportPreviewConflict[] = []
  let importedCount = 0
  let skippedCount = 0
  let newCount = 0
  let updatedCount = 0

  for (const incoming of incomingItems) {
    const existing = byId.get(incoming.id) ?? null
    if (!existing) {
      importedCount += 1
      newCount += 1
      continue
    }

    const existingUpdatedAt = existing.updatedAt ?? existing.openedAt
    const incomingUpdatedAt = incoming.updatedAt ?? incoming.openedAt
    if (shouldImportOwnedReadingItem(existing, incoming)) {
      importedCount += 1
      updatedCount += 1
      conflicts.push({
        id: incoming.id,
        title: incoming.title,
        sourceType: incoming.sourceType,
        action: "update",
        existingUpdatedAt,
        incomingUpdatedAt,
      })
    } else {
      skippedCount += 1
      conflicts.push({
        id: incoming.id,
        title: incoming.title,
        sourceType: incoming.sourceType,
        action: "skip",
        existingUpdatedAt,
        incomingUpdatedAt,
      })
    }
  }

  return {
    totalCount: incomingItems.length,
    importedCount,
    skippedCount,
    newCount,
    updatedCount,
    conflicts,
    rollback: {
      restoreCount: updatedCount,
      removeCount: newCount,
    },
    verified: true,
  }
}

export async function previewOwnedReadingThemePackPackagePayload(
  payload: OwnedReadingThemePackPackagePayload,
): Promise<OwnedReadingThemePackPackageImportPreview> {
  const incomingItems = extractOwnedReadingItemsFromThemePackPayload(payload)
  const store = await readStore()
  return buildOwnedReadingThemePackPackageImportPreview(store.items, incomingItems)
}

export async function previewOwnedReadingThemePackPackage(
  signedPackage: string | unknown,
): Promise<OwnedReadingThemePackPackageImportPreview> {
  const payload = await verifyOwnedReadingThemePackPackage(signedPackage)
  return previewOwnedReadingThemePackPackagePayload(payload)
}

export async function importOwnedReadingThemePackPackagePayload(
  payload: OwnedReadingThemePackPackagePayload,
): Promise<OwnedReadingThemePackPackageImportResult> {
  const incomingItems = extractOwnedReadingItemsFromThemePackPayload(payload)
  const store = await readStore()
  const byId = new Map(store.items.map((item) => [item.id, item]))
  let importedCount = 0
  let skippedCount = 0

  for (const incoming of incomingItems) {
    const existing = byId.get(incoming.id) ?? null
    if (shouldImportOwnedReadingItem(existing, incoming)) {
      byId.set(incoming.id, incoming)
      importedCount += 1
    } else {
      skippedCount += 1
    }
  }

  await writeStore({ ...store, items: [...byId.values()] })
  return { importedCount, skippedCount, verified: true }
}

export async function importOwnedReadingThemePackPackage(
  signedPackage: string | unknown,
): Promise<OwnedReadingThemePackPackageImportResult> {
  const payload = await verifyOwnedReadingThemePackPackage(signedPackage)
  return importOwnedReadingThemePackPackagePayload(payload)
}

function readerHtmlPath(item: OwnedReadingItem): "/pdf-reader.html" | "/epub-reader.html" | "/subtitle-reader.html" | null {
  if (item.sourceType === "pdf") return "/pdf-reader.html"
  if (item.sourceType === "epub") return "/epub-reader.html"
  if (item.sourceType === "subtitle-file") return "/subtitle-reader.html"
  return null
}

export function buildOwnedReadingResumeTarget(item: OwnedReadingItem): OwnedReadingResumeTarget | null {
  if (item.sourceType === "article") {
    const url = deriveOwnedReadingArticleUrl(item)
    if (!url) return null
    return {
      url,
      sourceType: item.sourceType,
      mode: "direct",
      requiresFileSelection: false,
    }
  }

  const readerPath = readerHtmlPath(item)
  if (!readerPath) return null

  const base = browser.runtime.getURL(readerPath)
  const params = new URLSearchParams()
  if (item.sourceType === "pdf" && item.sourceUrl?.startsWith("http")) {
    params.set("url", item.sourceUrl)
    return {
      url: `${base}?${params.toString()}`,
      sourceType: item.sourceType,
      mode: "direct",
      requiresFileSelection: false,
    }
  }

  const hasLocalReopenContext = Boolean(item.localUri?.trim() || item.reopenHint?.trim())
  if (!hasLocalReopenContext) return null

  if (item.reopenHint) {
    params.set("reopenHint", item.reopenHint)
  }

  const qs = params.toString()
  return {
    url: qs ? `${base}?${qs}` : base,
    sourceType: item.sourceType,
    mode: "reader_handoff",
    requiresFileSelection: true,
  }
}

export function describeOwnedReadingResumeBehavior(item: OwnedReadingItem): string {
  const target = buildOwnedReadingResumeTarget(item)
  if (!target) {
    return "Resume unavailable for this item."
  }
  if (target.mode === "direct" && item.sourceType === "article") {
    return "Resumes the source article directly."
  }
  if (target.mode === "direct" && item.sourceType === "pdf") {
    return "Opens the saved remote PDF in the PDF reader."
  }
  switch (item.sourceType) {
    case "pdf":
      return "Opens the PDF reader and prompts for the same local file."
    case "epub":
      return "Opens the EPUB reader and prompts for the same file again."
    case "subtitle-file":
      return "Opens the subtitle reader and prompts for the same file again."
    default:
      return "Resume unavailable for this item."
  }
}

export function describeOwnedReadingProgress(item: OwnedReadingItem): string | null {
  if (typeof item.progress?.chapterId === "string" && item.progress.chapterId.trim()) {
    return `Last chapter: ${item.progress.chapterId.trim()}`
  }
  if (typeof item.progress?.fraction === "number") {
    return `Progress: ${Math.round(item.progress.fraction * 100)}%`
  }
  if (typeof item.progress?.sentenceIndex === "number") {
    return `Last row: ${item.progress.sentenceIndex + 1}`
  }
  return null
}

export async function getOwnedReadingItem(id: string): Promise<OwnedReadingItem | null> {
  const store = await readStore()
  return store.items.find((item) => item.id === id) ?? null
}

export function matchOwnedReadingItemForVocabularyEntry(
  items: readonly OwnedReadingItem[],
  entry: Pick<VocabularyEntry, "url" | "sourceContext">,
): OwnedReadingItem | null {
  const sourceContext = entry.sourceContext
  const linkedId = sourceContext?.ownedReadingItemId?.trim()
  if (linkedId) {
    const direct = items.find((item) => item.id === linkedId)
    if (direct) return direct
  }

  const sourceType = sourceContext?.ownedReadingSourceType
  const candidates = [
    sourceContext?.studyProgressRecordId,
    sourceContext?.pageUrl,
    entry.url,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))

  const localFileCandidate = candidates.find((value) => value.startsWith("astra-local://"))
  if (localFileCandidate && (sourceType === "pdf" || sourceType === "epub" || sourceType === "subtitle-file")) {
    const localMatch = items.find((item) => item.sourceType === sourceType && item.localUri === localFileCandidate)
    if (localMatch) return localMatch
  }

  const articleCandidate = candidates.find((value) => {
    if (sourceType && sourceType !== "article") return false
    return !value.startsWith("chrome-extension://") && !value.startsWith("astra-local://")
  })
  if (articleCandidate) {
    const articleIdentity = buildOwnedReadingArticleIdentity(articleCandidate)
    const articleMatch = items.find((item) => item.sourceType === "article"
      && deriveOwnedReadingIdentityFromItem(item)?.dedupeKey === articleIdentity.dedupeKey)
    if (articleMatch) return articleMatch
  }

  if (sourceType === "pdf") {
    const remotePdfCandidate = candidates.find((value) => /^https?:\/\//i.test(value))
    if (remotePdfCandidate) {
      const pdfIdentity = buildOwnedReadingRemotePdfIdentity(remotePdfCandidate)
      const pdfMatch = items.find((item) => item.sourceType === "pdf"
        && deriveOwnedReadingIdentityFromItem(item)?.dedupeKey === pdfIdentity.dedupeKey)
      if (pdfMatch) return pdfMatch
    }
  }

  return null
}

export async function listOwnedReadingItems(): Promise<OwnedReadingItem[]> {
  const store = await readStore()
  return [...store.items].sort((a, b) => b.openedAt - a.openedAt)
}

export async function removeOwnedReadingItem(id: string): Promise<void> {
  const store = await readStore()
  await writeStore({
    ...store,
    items: store.items.filter((item) => item.id !== id),
  })
}

export async function upsertOwnedReadingItem(item: OwnedReadingItem): Promise<void> {
  const parsed = OwnedReadingItemSchema.parse(item)
  const store = await readStore()
  const next = store.items.filter((row) => row.id !== parsed.id)
  next.push(parsed)
  await writeStore({ ...store, items: next })
}

export function deriveOwnedReadingArticleUrl(
  item: Pick<OwnedReadingItem, "sourceType" | "readingHistoryRecordId" | "sourceUrl" | "studyProgressRecordId">,
): string | null {
  if (item.sourceType !== "article") return null

  for (const candidate of [item.readingHistoryRecordId, item.sourceUrl, item.studyProgressRecordId]) {
    const trimmed = candidate?.trim()
    if (!trimmed) continue
    try {
      return buildReadingHistoryRecordId(trimmed)
    } catch {
      return trimmed
    }
  }

  return null
}

export async function upsertOwnedArticleFromUrl(params: {
  url: string
  title: string
  status: OwnedReadingStatus
}): Promise<OwnedReadingItem> {
  const policy = await resolveOwnedArticleWritePolicy(params.url)
  const writableUrl = policy.decision === "reduce" ? buildReducedOwnedArticleUrl(params.url) : params.url
  const writableTitle = policy.decision === "reduce" ? buildReducedOwnedArticleTitle() : params.title.trim()
  const identity = buildOwnedReadingArticleIdentity(writableUrl)
  const store = await readStore()
  const existing = store.items.find(
    (row) => row.sourceType === "article"
      && deriveOwnedReadingIdentityFromItem(row)?.dedupeKey === identity.dedupeKey,
  )
  const now = Date.now()
  const item: OwnedReadingItem = OwnedReadingItemSchema.parse({
    id: existing?.id ?? identity.id,
    sourceType: "article",
    title: writableTitle,
    sourceUrl: identity.sourceUrl,
    openedAt: now,
    updatedAt: now,
    status: existing?.status === "in_progress" ? "in_progress" : params.status,
    readingHistoryRecordId: identity.readingHistoryRecordId,
    studyProgressRecordId: identity.studyProgressRecordId,
    ...(policy.decision === "reduce"
      ? { userControl: { syncEnabled: false, excludedFromDigest: true, privacyModeAtCapture: true } }
      : {}),
  })

  if (policy.decision !== "suppress") {
    await upsertOwnedReadingItem(item)
  }
  return item
}

export async function upsertArticleFromReadingHistory(entry: ReadingHistoryEntry): Promise<OwnedReadingItem> {
  return upsertOwnedArticleFromUrl({
    url: entry.url,
    title: entry.title,
    status: "saved",
  })
}

function findExistingByStudyOrSource(
  store: OwnedReadingStore,
  match: { studyProgressRecordId?: string | null; sourceUrl?: string | null; localUri?: string | null },
): OwnedReadingItem | undefined {
  return store.items.find((row) => {
    if (match.studyProgressRecordId && row.studyProgressRecordId === match.studyProgressRecordId) return true
    if (match.sourceUrl && row.sourceUrl === match.sourceUrl) return true
    if (match.localUri && row.localUri === match.localUri) return true
    return false
  })
}

/** Remote PDF opened via `?url=` — same canonical URL key as study progress when applicable. */
export async function upsertOwnedPdfFromRemoteUrl(params: {
  url: string
  title: string
  pageCount?: number
  status?: OwnedReadingStatus
}): Promise<OwnedReadingItem> {
  const identity = buildOwnedReadingRemotePdfIdentity(params.url)
  const store = await readStore()
  const existing = findExistingByStudyOrSource(store, {
    studyProgressRecordId: identity.studyProgressRecordId,
    sourceUrl: identity.sourceUrl,
  })
  const now = Date.now()
  const fraction = params.pageCount && params.pageCount > 0 ? 1 : undefined
  const item: OwnedReadingItem = OwnedReadingItemSchema.parse({
    id: existing?.id ?? identity.id,
    sourceType: "pdf",
    title: params.title.trim(),
    sourceUrl: identity.sourceUrl,
    openedAt: now,
    updatedAt: now,
    status: existing?.status === "in_progress" ? "in_progress" : (params.status ?? "saved"),
    studyProgressRecordId: identity.studyProgressRecordId,
    progress: fraction !== undefined ? { fraction } : undefined,
  })
  await upsertOwnedReadingItem(item)
  return item
}

/** Local PDF from file picker / drop — keyed by display file name (Month 3 v1 local-file identity). */
export async function upsertOwnedPdfFromFileName(params: {
  fileName: string
  pageCount?: number
  status?: OwnedReadingStatus
}): Promise<OwnedReadingItem> {
  const safeName = normalizeOwnedReadingFileName(params.fileName, "document.pdf")
  const identity = buildOwnedReadingLocalFileIdentity("pdf", safeName)
  const store = await readStore()
  const existing = findExistingByStudyOrSource(store, { localUri: identity.localUri })
  const now = Date.now()
  const fraction = params.pageCount && params.pageCount > 0 ? 1 : undefined
  const item: OwnedReadingItem = OwnedReadingItemSchema.parse({
    id: existing?.id ?? identity.id,
    sourceType: "pdf",
    title: safeName,
    sourceUrl: null,
    localUri: identity.localUri,
    reopenHint: `Choose the same file in the PDF reader: ${safeName}`,
    openedAt: now,
    updatedAt: now,
    status: existing?.status === "in_progress" ? "in_progress" : (params.status ?? "saved"),
    studyProgressRecordId: null,
    progress: fraction !== undefined ? { fraction } : undefined,
  })
  await upsertOwnedReadingItem(item)
  return item
}

/** Local EPUB after load — identity is file name; chapter progress is tracked separately. */
export async function upsertOwnedEpubFromImport(params: {
  fileName: string
  bookTitle: string
  chapterHref?: string | null
  status?: OwnedReadingStatus
}): Promise<OwnedReadingItem> {
  const safeFile = normalizeOwnedReadingFileName(params.fileName, "book.epub")
  const identity = buildOwnedReadingLocalFileIdentity("epub", safeFile)
  const store = await readStore()
  const existing = findExistingByStudyOrSource(store, { localUri: identity.localUri })
  const now = Date.now()
  const title = `${params.bookTitle.trim() || "Untitled"} (${safeFile})`
  const item: OwnedReadingItem = OwnedReadingItemSchema.parse({
    id: existing?.id ?? identity.id,
    sourceType: "epub",
    title,
    sourceUrl: null,
    localUri: identity.localUri,
    reopenHint: `Choose the same file in the ePub reader: ${safeFile}`,
    openedAt: now,
    updatedAt: now,
    status: existing?.status === "in_progress" ? "in_progress" : (params.status ?? "saved"),
    studyProgressRecordId: null,
    progress: params.chapterHref ? { chapterId: params.chapterHref } : undefined,
  })
  await upsertOwnedReadingItem(item)
  return item
}

/** Local subtitle / document file after successful parse in extension subtitle reader. */
export async function upsertOwnedSubtitleFileFromImport(params: {
  fileName: string
  formatLabel: string
  cueOrEntryCount: number
  status?: OwnedReadingStatus
  sentenceIndex?: number
}): Promise<OwnedReadingItem> {
  const safeFile = normalizeOwnedReadingFileName(params.fileName, "subtitles.srt")
  const identity = buildOwnedReadingLocalFileIdentity("subtitle-file", safeFile)
  const store = await readStore()
  const existing = findExistingByStudyOrSource(store, { localUri: identity.localUri })
  const now = Date.now()
  const title = `${safeFile} · ${params.formatLabel} · ${params.cueOrEntryCount} items`
  const nextStatus: OwnedReadingStatus = params.status === "saved"
    ? "saved"
    : existing?.status === "saved"
      ? "saved"
      : existing?.status === "archived"
        ? "archived"
        : (params.status ?? existing?.status ?? "saved")
  const reopenHintBase = `Open the subtitle reader and choose the same file: ${safeFile}`
  const item: OwnedReadingItem = OwnedReadingItemSchema.parse({
    id: existing?.id ?? identity.id,
    sourceType: "subtitle-file",
    title,
    sourceUrl: null,
    localUri: identity.localUri,
    reopenHint: typeof params.sentenceIndex === "number"
      ? `${reopenHintBase} · continue from row ${params.sentenceIndex + 1}`
      : (existing?.reopenHint ?? reopenHintBase),
    openedAt: now,
    updatedAt: now,
    status: nextStatus,
    studyProgressRecordId: null,
    progress: typeof params.sentenceIndex === "number"
      ? { sentenceIndex: params.sentenceIndex }
      : existing?.progress,
  })
  await upsertOwnedReadingItem(item)
  return item
}

/** Merge recent reading history into saved queue entries (dedup by URL). Preserves non-article rows. */
export async function syncRecentReadingHistoryToOwnedQueue(maxEntries = 40): Promise<void> {
  const { getReadingHistory } = await import("./reading-history")
  const history = await getReadingHistory()
  const slice = history.slice(0, maxEntries)
  const store = await readStore()
  const byUrl = new Map<string, OwnedReadingItem>()
  const other: OwnedReadingItem[] = []
  for (const row of store.items) {
    if (row.sourceType !== "article" || !row.sourceUrl) {
      other.push(row)
      continue
    }
    byUrl.set(buildReadingHistoryRecordId(row.sourceUrl), row)
  }

  for (const entry of slice) {
    const policy = await resolveOwnedArticleWritePolicy(entry.url)
    if (policy.decision === "suppress") continue
    const writableUrl = policy.decision === "reduce" ? buildReducedOwnedArticleUrl(entry.url) : entry.url
    const writableTitle = policy.decision === "reduce" ? buildReducedOwnedArticleTitle() : entry.title.trim()
    const identity = buildOwnedReadingArticleIdentity(writableUrl)
    const existing = byUrl.get(identity.dedupeKey)
    const item: OwnedReadingItem = OwnedReadingItemSchema.parse({
      id: existing?.id ?? identity.id,
      sourceType: "article",
      title: writableTitle,
      sourceUrl: identity.sourceUrl,
      openedAt: Math.max(entry.visitedAt, existing?.openedAt ?? 0),
      updatedAt: Math.max(entry.visitedAt, existing?.updatedAt ?? existing?.openedAt ?? 0),
      status: existing?.status === "in_progress" ? "in_progress" : (existing?.status ?? "saved"),
      readingHistoryRecordId: identity.readingHistoryRecordId,
      studyProgressRecordId: identity.studyProgressRecordId,
      ...(policy.decision === "reduce"
        ? { userControl: { syncEnabled: false, excludedFromDigest: true, privacyModeAtCapture: true } }
        : {}),
    })
    byUrl.set(identity.dedupeKey, item)
  }

  await writeStore({
    version: 1,
    items: [...other, ...byUrl.values()].sort((a, b) => b.openedAt - a.openedAt).slice(0, MAX_ITEMS),
  })
}

export async function markOwnedReadingOpened(id: string): Promise<void> {
  const store = await readStore()
  const item = store.items.find((row) => row.id === id)
  if (!item) return
  await upsertOwnedReadingItem({
    ...item,
    openedAt: Date.now(),
    updatedAt: Date.now(),
  })
}

export async function setOwnedReadingStatus(id: string, status: OwnedReadingStatus): Promise<void> {
  const store = await readStore()
  const item = store.items.find((row) => row.id === id)
  if (!item) return
  await upsertOwnedReadingItem({
    ...item,
    status,
    openedAt: Date.now(),
    updatedAt: Date.now(),
  })
}

export async function setOwnedReadingUserControl(id: string, patch: Partial<OwnedReadingUserControl>): Promise<void> {
  const store = await readStore()
  const item = store.items.find((row) => row.id === id)
  if (!item) return
  const normalized = normalizeOwnedReadingItem(item)
  await upsertOwnedReadingItem({
    ...normalized,
    userControl: OwnedReadingUserControlSchema.parse({
      ...normalized.userControl,
      ...patch,
    }),
    updatedAt: Date.now(),
  })
}
