/**
 * Owned reading queue — Month 3 minimal persistence (extension vocabulary surface).
 */
import { browser } from "#imports"
import { z } from "zod"

import { buildReadingHistoryRecordId } from "./reading-history"
import type { ReadingHistoryEntry } from "./reading-history"
import { buildStudyProgressRecordId } from "./study-progress"

export const OwnedReadingSourceTypeSchema = z.enum(["article", "pdf", "epub", "subtitle-file"])
export type OwnedReadingSourceType = z.infer<typeof OwnedReadingSourceTypeSchema>

export const OwnedReadingStatusSchema = z.enum(["in_progress", "saved", "archived"])
export type OwnedReadingStatus = z.infer<typeof OwnedReadingStatusSchema>

const OwnedReadingProgressSchema = z.object({
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

const OwnedReadingStoreSchema = z.object({
  version: z.literal(1),
  items: z.array(OwnedReadingItemSchema),
})

type OwnedReadingStore = z.infer<typeof OwnedReadingStoreSchema>

const STORAGE_KEY = "astra.owned_reading.v1"
const MAX_ITEMS = 200

function newOwnedReadingId(): string {
  try {
    return `or_${globalThis.crypto.randomUUID().replace(/-/g, "")}`
  } catch {
    return `or_${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
  }
}

function emptyStore(): OwnedReadingStore {
  return { version: 1, items: [] }
}

function parseStore(raw: unknown): OwnedReadingStore {
  const parsed = OwnedReadingStoreSchema.safeParse(raw)
  return parsed.success ? parsed.data : emptyStore()
}

async function readStore(): Promise<OwnedReadingStore> {
  const raw = await browser.storage.local.get(STORAGE_KEY)
  return parseStore(raw[STORAGE_KEY])
}

async function writeStore(store: OwnedReadingStore): Promise<void> {
  const normalized = OwnedReadingStoreSchema.parse({
    ...store,
    items: store.items
      .slice()
      .sort((a, b) => b.openedAt - a.openedAt)
      .slice(0, MAX_ITEMS),
  })
  await browser.storage.local.set({ [STORAGE_KEY]: normalized })
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

export async function upsertOwnedArticleFromUrl(params: {
  url: string
  title: string
  status: OwnedReadingStatus
}): Promise<OwnedReadingItem> {
  const historyId = buildReadingHistoryRecordId(params.url)
  let studyId: string | null = null
  try {
    studyId = buildStudyProgressRecordId(params.url)
  } catch {
    studyId = null
  }

  const store = await readStore()
  const existing = store.items.find(
    (row) => (row.sourceUrl && buildReadingHistoryRecordId(row.sourceUrl) === historyId),
  )
  const now = Date.now()
  const item: OwnedReadingItem = OwnedReadingItemSchema.parse({
    id: existing?.id ?? newOwnedReadingId(),
    sourceType: "article",
    title: params.title.trim(),
    sourceUrl: historyId,
    openedAt: now,
    status: existing?.status === "in_progress" ? "in_progress" : params.status,
    readingHistoryRecordId: historyId,
    studyProgressRecordId: studyId,
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
  const sourceUrl = buildStudyProgressRecordId(params.url)
  let studyId: string | null = sourceUrl
  const store = await readStore()
  const existing = findExistingByStudyOrSource(store, { studyProgressRecordId: studyId, sourceUrl })
  const now = Date.now()
  const fraction = params.pageCount && params.pageCount > 0 ? 1 : undefined
  const item: OwnedReadingItem = OwnedReadingItemSchema.parse({
    id: existing?.id ?? newOwnedReadingId(),
    sourceType: "pdf",
    title: params.title.trim(),
    sourceUrl,
    openedAt: now,
    status: existing?.status === "in_progress" ? "in_progress" : (params.status ?? "saved"),
    studyProgressRecordId: studyId,
    progress: fraction !== undefined ? { fraction } : undefined,
  })
  await upsertOwnedReadingItem(item)
  return item
}

/** Local PDF from file picker / drop — keyed by display file name (Month 3 v0; sync-safe hash deferred). */
export async function upsertOwnedPdfFromFileName(params: {
  fileName: string
  pageCount?: number
  status?: OwnedReadingStatus
}): Promise<OwnedReadingItem> {
  const safeName = params.fileName.trim() || "document.pdf"
  const localUri = `astra-local://pdf/${encodeURIComponent(safeName)}`
  const store = await readStore()
  const existing = findExistingByStudyOrSource(store, { localUri })
  const now = Date.now()
  const fraction = params.pageCount && params.pageCount > 0 ? 1 : undefined
  const item: OwnedReadingItem = OwnedReadingItemSchema.parse({
    id: existing?.id ?? newOwnedReadingId(),
    sourceType: "pdf",
    title: safeName,
    sourceUrl: null,
    localUri,
    reopenHint: `Choose the same file in the PDF reader: ${safeName}`,
    openedAt: now,
    status: existing?.status === "in_progress" ? "in_progress" : (params.status ?? "saved"),
    studyProgressRecordId: null,
    progress: fraction !== undefined ? { fraction } : undefined,
  })
  await upsertOwnedReadingItem(item)
  return item
}

/** Local EPUB after load — keyed by file name + book title for reopen hint. */
export async function upsertOwnedEpubFromImport(params: {
  fileName: string
  bookTitle: string
  chapterHref?: string | null
  status?: OwnedReadingStatus
}): Promise<OwnedReadingItem> {
  const safeFile = params.fileName.trim() || "book.epub"
  const localUri = `astra-local://epub/${encodeURIComponent(safeFile)}`
  const store = await readStore()
  const existing = findExistingByStudyOrSource(store, { localUri })
  const now = Date.now()
  const title = `${params.bookTitle.trim() || "Untitled"} (${safeFile})`
  const item: OwnedReadingItem = OwnedReadingItemSchema.parse({
    id: existing?.id ?? newOwnedReadingId(),
    sourceType: "epub",
    title,
    sourceUrl: null,
    localUri,
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
}): Promise<OwnedReadingItem> {
  const safeFile = params.fileName.trim() || "subtitles.srt"
  const localUri = `astra-local://subtitle/${encodeURIComponent(safeFile)}`
  const store = await readStore()
  const existing = findExistingByStudyOrSource(store, { localUri })
  const now = Date.now()
  const title = `${safeFile} · ${params.formatLabel} · ${params.cueOrEntryCount} items`
  const item: OwnedReadingItem = OwnedReadingItemSchema.parse({
    id: existing?.id ?? newOwnedReadingId(),
    sourceType: "subtitle-file",
    title,
    sourceUrl: null,
    localUri,
    reopenHint: `Open the subtitle reader and choose the same file: ${safeFile}`,
    openedAt: now,
    status: existing?.status === "in_progress" ? "in_progress" : (params.status ?? "saved"),
    studyProgressRecordId: null,
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
    const historyId = buildReadingHistoryRecordId(entry.url)
    let studyId: string | null = null
    try {
      studyId = buildStudyProgressRecordId(entry.url)
    } catch {
      studyId = null
    }
    const existing = byUrl.get(historyId)
    const item: OwnedReadingItem = OwnedReadingItemSchema.parse({
      id: existing?.id ?? newOwnedReadingId(),
      sourceType: "article",
      title: entry.title.trim(),
      sourceUrl: historyId,
      openedAt: Math.max(entry.visitedAt, existing?.openedAt ?? 0),
      status: existing?.status === "in_progress" ? "in_progress" : (existing?.status ?? "saved"),
      readingHistoryRecordId: historyId,
      studyProgressRecordId: studyId,
    })
    byUrl.set(historyId, item)
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
