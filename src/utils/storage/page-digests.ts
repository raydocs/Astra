/**
 * Page digest store — persists AI-generated article digests per page URL.
 * Digests are fingerprinted for staleness detection and regeneration.
 */

import { browser } from "#imports"
import { z } from "zod"
import type { LanguageLevel } from "@/types/config"
import type { PageDigest } from "@/utils/reading/assist"

const DigestVocabularyFocusSchema = z.object({
  term: z.string(),
  note: z.string(),
})

const PageDigestRecordSchema = z.object({
  url: z.string(),
  hostname: z.string(),
  title: z.string(),
  targetLang: z.string(),
  languageLevel: z.enum(["beginner", "intermediate", "advanced"]),
  generatedAt: z.number(),
  sourceFingerprint: z.string(),
  headline: z.string(),
  summary: z.string(),
  keyPoints: z.array(z.string()).default([]),
  vocabularyFocus: z.array(DigestVocabularyFocusSchema).default([]),
  grammarFocus: z.array(z.string()).default([]),
  suggestedAction: z.string().default(""),
})

export type PageDigestRecord = z.infer<typeof PageDigestRecordSchema>

const PageDigestStoreSchema = z.object({
  digests: z.array(PageDigestRecordSchema),
})

export const PAGE_DIGESTS_STORAGE_KEY = "astra.page_digests.v1"
const MAX_DIGESTS = 50

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.search = ""
    parsed.hash = ""
    return parsed.toString()
  } catch {
    return url
  }
}

export function computeFingerprint(params: {
  url: string
  title: string
  contentSummary?: string
  targetLang: string
  languageLevel: LanguageLevel
}): string {
  const parts = [
    normalizeUrl(params.url),
    params.title,
    params.contentSummary ?? "",
    params.targetLang,
    params.languageLevel,
  ]
  return parts.join("|")
}

async function readStore(): Promise<z.infer<typeof PageDigestStoreSchema>> {
  const stored = await browser.storage.local.get(PAGE_DIGESTS_STORAGE_KEY)
  const parsed = PageDigestStoreSchema.safeParse(stored[PAGE_DIGESTS_STORAGE_KEY])
  return parsed.success ? parsed.data : { digests: [] }
}

async function writeStore(store: z.infer<typeof PageDigestStoreSchema>): Promise<void> {
  await browser.storage.local.set({
    [PAGE_DIGESTS_STORAGE_KEY]: store,
  })
}

export async function getPageDigest(url: string): Promise<PageDigestRecord | null> {
  const store = await readStore()
  const clean = normalizeUrl(url)
  return store.digests.find((d) => d.url === clean) ?? null
}

export async function savePageDigest(
  params: {
    url: string
    hostname: string
    title: string
    targetLang: string
    languageLevel: LanguageLevel
    contentSummary?: string
  },
  digest: PageDigest,
): Promise<PageDigestRecord> {
  const store = await readStore()
  const cleanUrl = normalizeUrl(params.url)
  const fingerprint = computeFingerprint({
    url: params.url,
    title: params.title,
    contentSummary: params.contentSummary,
    targetLang: params.targetLang,
    languageLevel: params.languageLevel,
  })

  const record: PageDigestRecord = {
    url: cleanUrl,
    hostname: params.hostname,
    title: params.title,
    targetLang: params.targetLang,
    languageLevel: params.languageLevel,
    generatedAt: Date.now(),
    sourceFingerprint: fingerprint,
    headline: digest.headline,
    summary: digest.summary,
    keyPoints: digest.keyPoints,
    vocabularyFocus: digest.vocabularyFocus,
    grammarFocus: digest.grammarFocus,
    suggestedAction: digest.suggestedAction,
  }

  const otherDigests = store.digests.filter((d) => d.url !== cleanUrl)
  await writeStore({
    digests: [record, ...otherDigests].slice(0, MAX_DIGESTS),
  })

  return record
}

export function isDigestStale(record: PageDigestRecord, currentFingerprint: string): boolean {
  return record.sourceFingerprint !== currentFingerprint
}

export async function clearPageDigests(): Promise<void> {
  await writeStore({ digests: [] })
}
