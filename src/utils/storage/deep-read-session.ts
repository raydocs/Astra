import { browser } from "#imports"
import { z } from "zod"

import type { PageStudyContext } from "@/types/messages"
import { buildSentenceAnchor } from "@/utils/sentence-anchor"
import { splitSentences } from "@/utils/tts"
import { sanitizeVocabularyUrl } from "@/utils/storage/vocabulary-core"

export const DeepReadSessionRecordSchema = z.object({
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

export type DeepReadSessionRecord = z.infer<typeof DeepReadSessionRecordSchema>
export type SyncedDeepReadSessionRecord = DeepReadSessionRecord

const DeepReadSessionStoreSchema = z.object({
  sessions: z.array(DeepReadSessionRecordSchema),
})

export const DEEP_READ_SESSION_STORAGE_KEY = "astra.deep_read_sessions.v1"
const MAX_DEEP_READ_SESSIONS = 30

type DeepReadSessionSyncMutation = {
  recordId: string
  operation: "upsert" | "delete"
  payload: unknown
}

function deriveSentences(context: PageStudyContext): string[] {
  const source = context.articleExcerpt?.trim()
    || context.contentSummary?.trim()
    || context.metaDescription?.trim()
    || ""

  return splitSentences(source)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 10)
}

function normalizePageUrl(url?: string | null): string | undefined {
  return sanitizeVocabularyUrl(url)
}

function shouldUseIncomingDeepReadSession(params: {
  current?: SyncedDeepReadSessionRecord
  incoming: SyncedDeepReadSessionRecord
}): boolean {
  if (!params.current) return true
  if (params.incoming.updatedAt > params.current.updatedAt) return true
  if (params.incoming.updatedAt < params.current.updatedAt) return false
  return !params.current.selectedSentenceAnchor && !!params.incoming.selectedSentenceAnchor
}

function normalizeDeepReadSessionRecords(records: DeepReadSessionRecord[]): SyncedDeepReadSessionRecord[] {
  const byPageUrl: Record<string, SyncedDeepReadSessionRecord> = {}

  for (const rawRecord of records) {
    const parsed = DeepReadSessionRecordSchema.safeParse(rawRecord)
    if (!parsed.success) continue

    const pageUrl = normalizePageUrl(parsed.data.pageUrl)
    if (!pageUrl) continue

    const record = DeepReadSessionRecordSchema.parse({
      ...parsed.data,
      pageUrl,
    })
    const current = byPageUrl[pageUrl]
    if (shouldUseIncomingDeepReadSession({ current, incoming: record })) {
      byPageUrl[pageUrl] = record
    }
  }

  return Object.values(byPageUrl)
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_DEEP_READ_SESSIONS)
}

async function readStore(): Promise<z.infer<typeof DeepReadSessionStoreSchema>> {
  const raw = await browser.storage.local.get(DEEP_READ_SESSION_STORAGE_KEY)
  const parsed = DeepReadSessionStoreSchema.safeParse(raw[DEEP_READ_SESSION_STORAGE_KEY])
  return parsed.success ? parsed.data : { sessions: [] }
}

async function writeStore(store: z.infer<typeof DeepReadSessionStoreSchema>): Promise<void> {
  await browser.storage.local.set({
    [DEEP_READ_SESSION_STORAGE_KEY]: {
      sessions: normalizeDeepReadSessionRecords(store.sessions),
    },
  })
}

export function buildDeepReadSessionRecord(params: {
  context: PageStudyContext
  selectedSentenceIndex?: number
}): DeepReadSessionRecord | null {
  const pageUrl = normalizePageUrl(params.context.pageUrl)
  if (!pageUrl) return null

  const sentences = deriveSentences(params.context)
  const maxIndex = Math.max(0, sentences.length - 1)
  const selectedSentenceIndex = Math.min(params.selectedSentenceIndex ?? 0, maxIndex)
  const selectedSentenceAnchor = buildSentenceAnchor(
    sentences[selectedSentenceIndex] ?? "",
    selectedSentenceIndex,
  )

  return DeepReadSessionRecordSchema.parse({
    pageUrl,
    pageTitle: params.context.pageTitle?.trim() || undefined,
    hostname: params.context.hostname?.trim() || undefined,
    metaDescription: params.context.metaDescription?.trim() || undefined,
    contentSummary: params.context.contentSummary?.trim() || undefined,
    articleExcerpt: params.context.articleExcerpt?.trim() || undefined,
    sentences,
    selectedSentenceAnchor,
    selectedSentenceIndex,
    updatedAt: Date.now(),
  })
}

export function buildSyncSafeDeepReadSessionRecord(
  record: DeepReadSessionRecord,
): SyncedDeepReadSessionRecord | null {
  const parsed = DeepReadSessionRecordSchema.safeParse(record)
  if (!parsed.success) return null

  const pageUrl = normalizePageUrl(parsed.data.pageUrl)
  if (!pageUrl) return null

  return DeepReadSessionRecordSchema.parse({
    ...parsed.data,
    pageUrl,
  })
}

export function buildDeepReadSessionSyncRecordMap(
  records: DeepReadSessionRecord[],
): Record<string, SyncedDeepReadSessionRecord> {
  return Object.fromEntries(
    normalizeDeepReadSessionRecords(records).map((record) => [record.pageUrl, record]),
  )
}

export function applyDeepReadSessionSyncMutation(
  records: DeepReadSessionRecord[],
  mutation: DeepReadSessionSyncMutation,
): SyncedDeepReadSessionRecord[] {
  const recordId = normalizePageUrl(mutation.recordId)
  if (!recordId) return normalizeDeepReadSessionRecords(records)

  if (mutation.operation === "delete") {
    return normalizeDeepReadSessionRecords(records)
      .filter((record) => record.pageUrl !== recordId)
  }

  const parsed = DeepReadSessionRecordSchema.safeParse(mutation.payload)
  if (!parsed.success) return normalizeDeepReadSessionRecords(records)

  const incoming = buildSyncSafeDeepReadSessionRecord({
    ...parsed.data,
    pageUrl: recordId,
  })
  if (!incoming) return normalizeDeepReadSessionRecords(records)

  const nextRecords = normalizeDeepReadSessionRecords(records)
  const existingIndex = nextRecords.findIndex((record) => record.pageUrl === recordId)
  if (existingIndex === -1) {
    return normalizeDeepReadSessionRecords([incoming, ...nextRecords])
  }

  if (shouldUseIncomingDeepReadSession({
    current: nextRecords[existingIndex],
    incoming,
  })) {
    nextRecords[existingIndex] = incoming
  }

  return normalizeDeepReadSessionRecords(nextRecords)
}

export function applyDeepReadSessionSyncMutations(
  records: DeepReadSessionRecord[],
  mutations: DeepReadSessionSyncMutation[],
): SyncedDeepReadSessionRecord[] {
  return mutations.reduce<SyncedDeepReadSessionRecord[]>(
    (nextRecords, mutation) => applyDeepReadSessionSyncMutation(nextRecords, mutation),
    normalizeDeepReadSessionRecords(records),
  )
}

export async function readSyncSafeDeepReadSessions(): Promise<SyncedDeepReadSessionRecord[]> {
  const store = await readStore()
  return normalizeDeepReadSessionRecords(store.sessions)
}

export async function replaceDeepReadSessions(records: DeepReadSessionRecord[]): Promise<void> {
  await writeStore({ sessions: records })
}

export async function saveDeepReadSession(params: {
  context: PageStudyContext
  selectedSentenceIndex?: number
}): Promise<DeepReadSessionRecord | null> {
  const record = buildDeepReadSessionRecord(params)
  if (!record) return null

  const store = await readStore()
  const sessions = [
    record,
    ...store.sessions.filter((session) => session.pageUrl !== record.pageUrl),
  ]

  await writeStore({ sessions })
  return record
}

export async function getDeepReadSession(pageUrl: string): Promise<DeepReadSessionRecord | null> {
  const normalized = normalizePageUrl(pageUrl)
  if (!normalized) return null

  const store = await readStore()
  return normalizeDeepReadSessionRecords(store.sessions).find((session) => session.pageUrl === normalized) ?? null
}

export async function getLatestDeepReadSession(): Promise<DeepReadSessionRecord | null> {
  const store = await readStore()
  return normalizeDeepReadSessionRecords(store.sessions)[0] ?? null
}

export async function clearDeepReadSessions(): Promise<void> {
  await writeStore({ sessions: [] })
}
