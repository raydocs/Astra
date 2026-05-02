import { browser } from "#imports"

import { normalizeSentenceAnchor, writeSentenceAnchorToSearchParams } from "@/utils/sentence-anchor"
import type { VocabularyEntry } from "@/utils/storage/vocabulary-core"

function buildDeepReadUrl(entry: Pick<VocabularyEntry, "sourceContext" | "url">): string {
  return buildDeepReadPageUrl({
    pageUrl: entry.sourceContext?.pageUrl ?? entry.url,
    sentenceText: entry.sourceContext?.sentenceText,
    sentenceHash: entry.sourceContext?.sentenceHash,
    sentenceIndex: entry.sourceContext?.sentenceIndex,
  })
}

export function buildDeepReadPageUrl(params: {
  pageUrl?: string | null
  sentenceText?: string | null
  sentenceHash?: string | null
  sentenceIndex?: number
}): string {
  const searchParams = new URLSearchParams()
  const sentenceAnchor = normalizeSentenceAnchor({
    sentenceText: params.sentenceText ?? undefined,
    sentenceHash: params.sentenceHash ?? undefined,
    sentenceIndex: params.sentenceIndex,
  })

  if (params.pageUrl?.trim()) {
    searchParams.set("pageUrl", params.pageUrl.trim())
  }
  writeSentenceAnchorToSearchParams(searchParams, sentenceAnchor)

  const query = searchParams.toString()
  const baseUrl = browser.runtime.getURL("/deep-read.html" as "/popup.html")
  return query ? `${baseUrl}?${query}` : baseUrl
}

export async function openPageInDeepRead(pageUrl: string): Promise<void> {
  const isWebPage = /^https?:\/\//i.test(pageUrl)

  if (isWebPage) {
    await browser.tabs.create({ url: pageUrl })
  }

  await browser.tabs.create({ url: buildDeepReadPageUrl({ pageUrl }) })
}

export async function openVocabularyEntryInDeepRead(
  entry: Pick<VocabularyEntry, "sourceContext" | "url">,
): Promise<void> {
  const pageUrl = entry.sourceContext?.pageUrl ?? entry.url
  const isWebPage = !!pageUrl && /^https?:\/\//i.test(pageUrl)

  if (isWebPage) {
    await browser.tabs.create({ url: pageUrl })
  }

  await browser.tabs.create({ url: buildDeepReadUrl(entry) })
}
