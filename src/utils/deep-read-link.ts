import { browser } from "#imports"

import { normalizeSentenceAnchor, writeSentenceAnchorToSearchParams } from "@/utils/sentence-anchor"
import type { VocabularyEntry } from "@/utils/storage/vocabulary-core"

function buildDeepReadUrl(entry: Pick<VocabularyEntry, "sourceContext" | "url">): string {
  const params = new URLSearchParams()
  const pageUrl = entry.sourceContext?.pageUrl ?? entry.url
  const sentenceAnchor = normalizeSentenceAnchor({
    sentenceText: entry.sourceContext?.sentenceText,
    sentenceHash: entry.sourceContext?.sentenceHash,
    sentenceIndex: entry.sourceContext?.sentenceIndex,
  })

  if (pageUrl?.trim()) {
    params.set("pageUrl", pageUrl.trim())
  }
  writeSentenceAnchorToSearchParams(params, sentenceAnchor)

  const query = params.toString()
  const baseUrl = browser.runtime.getURL("/deep-read.html" as "/popup.html")
  return query ? `${baseUrl}?${query}` : baseUrl
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
