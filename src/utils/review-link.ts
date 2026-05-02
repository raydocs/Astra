import { browser } from "#imports"

function getVocabularyUrl(): string {
  return browser.runtime.getURL("/vocabulary.html" as "/popup.html")
}

export function buildFocusedReviewUrl(entryId: string): string {
  const trimmed = entryId.trim()
  const baseUrl = getVocabularyUrl()
  if (!trimmed) {
    return `${baseUrl}?tab=review`
  }

  const params = new URLSearchParams({
    tab: "review",
    entryId: trimmed,
  })
  return `${baseUrl}?${params.toString()}`
}

export function buildPageReviewLoopUrl(studyUrl: string, entryId?: string): string {
  const trimmedStudyUrl = studyUrl.trim()
  if (!trimmedStudyUrl) {
    return buildFocusedReviewUrl(entryId ?? "")
  }

  const params = new URLSearchParams({
    tab: "review",
    loop: "page",
    studyUrl: trimmedStudyUrl,
  })
  const trimmedEntryId = entryId?.trim()
  if (trimmedEntryId) {
    params.set("entryId", trimmedEntryId)
  }

  return `${getVocabularyUrl()}?${params.toString()}`
}

export async function openFocusedReview(entryId: string): Promise<void> {
  await browser.tabs.create({ url: buildFocusedReviewUrl(entryId) })
}

export async function openPageReviewLoop(studyUrl: string, entryId?: string): Promise<void> {
  await browser.tabs.create({ url: buildPageReviewLoopUrl(studyUrl, entryId) })
}
