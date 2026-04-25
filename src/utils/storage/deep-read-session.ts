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

const DeepReadSessionStoreSchema = z.object({
  sessions: z.array(DeepReadSessionRecordSchema),
})

export const DEEP_READ_SESSION_STORAGE_KEY = "astra.deep_read_sessions.v1"
const MAX_DEEP_READ_SESSIONS = 30

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

async function readStore(): Promise<z.infer<typeof DeepReadSessionStoreSchema>> {
  const raw = await browser.storage.local.get(DEEP_READ_SESSION_STORAGE_KEY)
  const parsed = DeepReadSessionStoreSchema.safeParse(raw[DEEP_READ_SESSION_STORAGE_KEY])
  return parsed.success ? parsed.data : { sessions: [] }
}

async function writeStore(store: z.infer<typeof DeepReadSessionStoreSchema>): Promise<void> {
  await browser.storage.local.set({
    [DEEP_READ_SESSION_STORAGE_KEY]: {
      sessions: store.sessions
        .slice()
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, MAX_DEEP_READ_SESSIONS),
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
  return store.sessions.find((session) => session.pageUrl === normalized) ?? null
}

export async function getLatestDeepReadSession(): Promise<DeepReadSessionRecord | null> {
  const store = await readStore()
  return store.sessions[0] ?? null
}

export async function clearDeepReadSessions(): Promise<void> {
  await writeStore({ sessions: [] })
}
