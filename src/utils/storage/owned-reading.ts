/**
 * Owned reading queue — Month 3 minimal persistence (extension vocabulary surface).
 */
import { browser } from "#imports"
import { z } from "zod"

import { buildReadingHistoryRecordId } from "./reading-history"
import type { ReadingHistoryEntry } from "./reading-history"
import { buildStudyProgressRecordId } from "./study-progress"
import type { VocabularyEntry } from "./vocabulary-core"

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

export const OwnedReadingItemSchema = z.object({
  id: z.string().trim().min(1),
  sourceType: OwnedReadingSourceTypeSchema,
  title: z.string().trim().min(1),
  sourceUrl: z.string().trim().min(1).nullable().optional(),
  localUri: z.string().trim().min(1).nullable().optional(),
  /** User-facing hint when `sourceUrl` is null (local file readers). */
  reopenHint: z.string().trim().min(1).max(400).optional(),
  openedAt: z.number(),
  progress: OwnedReadingProgressSchema,
  status: OwnedReadingStatusSchema,
  readingHistoryRecordId: z.string().trim().min(1).nullable().optional(),
  studyProgressRecordId: z.string().trim().min(1).nullable().optional(),
})

export type OwnedReadingItem = z.infer<typeof OwnedReadingItemSchema>

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

function parseStore(raw: unknown): OwnedReadingStore {
  const parsed = OwnedReadingStoreSchema.safeParse(raw)
  return parsed.success ? parsed.data : emptyStore()
}

async function readStore(): Promise<OwnedReadingStore> {
  const raw = await browser.storage.local.get(OWNED_READING_STORAGE_KEY)
  return parseStore(raw[OWNED_READING_STORAGE_KEY])
}

async function writeStore(store: OwnedReadingStore): Promise<void> {
  const normalized = OwnedReadingStoreSchema.parse({
    ...store,
    items: store.items
      .slice()
      .sort((a, b) => b.openedAt - a.openedAt)
      .slice(0, MAX_ITEMS),
  })
  await browser.storage.local.set({ [OWNED_READING_STORAGE_KEY]: normalized })
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
  const identity = buildOwnedReadingArticleIdentity(params.url)
  const store = await readStore()
  const existing = store.items.find(
    (row) => row.sourceType === "article"
      && deriveOwnedReadingIdentityFromItem(row)?.dedupeKey === identity.dedupeKey,
  )
  const now = Date.now()
  const item: OwnedReadingItem = OwnedReadingItemSchema.parse({
    id: existing?.id ?? identity.id,
    sourceType: "article",
    title: params.title.trim(),
    sourceUrl: identity.sourceUrl,
    openedAt: now,
    status: existing?.status === "in_progress" ? "in_progress" : params.status,
    readingHistoryRecordId: identity.readingHistoryRecordId,
    studyProgressRecordId: identity.studyProgressRecordId,
  })

  await upsertOwnedReadingItem(item)
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
    const identity = buildOwnedReadingArticleIdentity(entry.url)
    const existing = byUrl.get(identity.dedupeKey)
    const item: OwnedReadingItem = OwnedReadingItemSchema.parse({
      id: existing?.id ?? identity.id,
      sourceType: "article",
      title: entry.title.trim(),
      sourceUrl: identity.sourceUrl,
      openedAt: Math.max(entry.visitedAt, existing?.openedAt ?? 0),
      status: existing?.status === "in_progress" ? "in_progress" : (existing?.status ?? "saved"),
      readingHistoryRecordId: identity.readingHistoryRecordId,
      studyProgressRecordId: identity.studyProgressRecordId,
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
  })
}
