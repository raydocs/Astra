import { act } from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const createObjectURLMock = vi.fn()
const revokeObjectURLMock = vi.fn()
const anchorClickMock = vi.fn()
const NativeBlob = globalThis.Blob
let clickedDownloadAnchor: HTMLAnchorElement | null = null
let lastDownloadBlobParts: BlobPart[] = []

const {
  getVocabularyEntriesMock,
  importVocabularyEntriesFromThemePackPayloadMock,
  previewVocabularyEntriesFromThemePackPayloadMock,
  removeVocabularyEntryMock,
  getDueVocabularyCountMock,
  updateVocabularyEntryMock,
  readConfigMock,
  readAstraSessionMock,
  speakMock,
  stopSpeakingMock,
  isTtsSupportedMock,
  getReadingHistoryEntryMock,
  getPageStudyProgressMock,
  getStudyProgressMock,
  syncRecentReadingHistoryToOwnedQueueMock,
  listOwnedReadingItemsMock,
  markOwnedReadingOpenedMock,
  setOwnedReadingStatusMock,
  removeOwnedReadingItemMock,
  buildOwnedReadingThemePacksMock,
  buildSignedOwnedReadingThemePackPackageMock,
  importOwnedReadingThemePackPackagePayloadMock,
  previewOwnedReadingThemePackPackagePayloadMock,
  parseSignedOwnedReadingThemePackPackageMock,
  verifyOwnedReadingThemePackPackageMock,
  openVocabularyEntryInDeepReadMock,
  openPageInDeepReadMock,
  openFocusedReviewMock,
  openPageReviewLoopMock,
} = vi.hoisted(() => ({
  getVocabularyEntriesMock: vi.fn(),
  importVocabularyEntriesFromThemePackPayloadMock: vi.fn(),
  previewVocabularyEntriesFromThemePackPayloadMock: vi.fn(),
  removeVocabularyEntryMock: vi.fn(),
  getDueVocabularyCountMock: vi.fn(),
  updateVocabularyEntryMock: vi.fn(),
  readConfigMock: vi.fn(),
  readAstraSessionMock: vi.fn(),
  speakMock: vi.fn(),
  stopSpeakingMock: vi.fn(),
  isTtsSupportedMock: vi.fn(),
  getReadingHistoryEntryMock: vi.fn(),
  getPageStudyProgressMock: vi.fn(),
  getStudyProgressMock: vi.fn(),
  syncRecentReadingHistoryToOwnedQueueMock: vi.fn(),
  listOwnedReadingItemsMock: vi.fn(),
  markOwnedReadingOpenedMock: vi.fn(),
  setOwnedReadingStatusMock: vi.fn(),
  removeOwnedReadingItemMock: vi.fn(),
  buildOwnedReadingThemePacksMock: vi.fn(),
  buildSignedOwnedReadingThemePackPackageMock: vi.fn(),
  importOwnedReadingThemePackPackagePayloadMock: vi.fn(),
  previewOwnedReadingThemePackPackagePayloadMock: vi.fn(),
  parseSignedOwnedReadingThemePackPackageMock: vi.fn(),
  verifyOwnedReadingThemePackPackageMock: vi.fn(),
  openVocabularyEntryInDeepReadMock: vi.fn(),
  openPageInDeepReadMock: vi.fn(),
  openFocusedReviewMock: vi.fn(),
  openPageReviewLoopMock: vi.fn(),
}))

vi.mock("@/utils/storage/vocabulary", () => ({
  getVocabularyEntries: getVocabularyEntriesMock,
  importVocabularyEntriesFromThemePackPayload: importVocabularyEntriesFromThemePackPayloadMock,
  previewVocabularyEntriesFromThemePackPayload: previewVocabularyEntriesFromThemePackPayloadMock,
  removeVocabularyEntry: removeVocabularyEntryMock,
  getDueVocabularyCount: getDueVocabularyCountMock,
  updateVocabularyEntry: updateVocabularyEntryMock,
}))

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
}))

vi.mock("@/utils/storage/auth", () => ({
  readAstraSession: readAstraSessionMock,
}))

vi.mock("@/utils/tts", () => ({
  speak: speakMock,
  stopSpeaking: stopSpeakingMock,
  isTtsSupported: isTtsSupportedMock,
}))

vi.mock("@/utils/i18n", () => ({
  t: (key: string, substitutions?: string | string[]) => {
    const subs = Array.isArray(substitutions) ? substitutions : substitutions ? [substitutions] : []
    const messages: Record<string, string> = {
      vocabulary_title: "Astra Vocabulary",
      vocabulary_countBadge: `${subs[0] ?? "$1"} ${subs[1] ?? "$2"}`,
      vocabulary_countWordSingular: "word",
      vocabulary_countWordPlural: "words",
      vocabulary_tabList: "Word List",
      vocabulary_tabReview: "Review",
      vocabulary_tabReviewWithCount: `Review (${subs[0] ?? "$1"})`,
      vocabulary_tabReading: "Reading",
      vocabulary_learningDeskTitle: "Today learning desk",
      vocabulary_statDueReview: "Due review",
      vocabulary_statInProgress: "In progress",
      vocabulary_statSavedWords: "Saved words",
      vocabulary_actionStartReviewWithCount: `Start review (${subs[0] ?? "$1"})`,
      vocabulary_actionOpenReview: "Open review",
      vocabulary_actionOpenReadingQueue: "Open reading queue",
      vocabulary_actionBrowseSaved: "Browse saved vocabulary",
      vocabulary_continueReadingTitle: "Continue where you left off",
      vocabulary_actionResumeReading: "Resume reading",
      popup_studyPageSavedReviewTitle: "Saved sentences on this page",
      popup_studyPageSavedReviewHint: `${subs[0] ?? "$1"} saved sentence(s) from this page can be reviewed anytime.`,
      popup_studyPageSavedReviewAction: "Review saved sentences from this page",
      vocabulary_searchPlaceholder: "Search words, translations, notes, tags, or source (title, URL, excerpt)...",
      vocabulary_sortLabel: "Sort:",
      vocabulary_sortNewest: "Newest first",
      vocabulary_sortAlpha: "A-Z",
      vocabulary_exportCsv: "Export CSV",
      vocabulary_exportAnkiTsv: "Export Anki TSV",
      vocabulary_emptySearch: "No words match your search.",
      vocabulary_emptyDefault: "No vocabulary saved yet. Use the Save button when translating to add words here.",
      vocabulary_sourceContextTitle: "Source context",
      vocabulary_sourceHostLabel: "Host:",
      vocabulary_sourceUrlLabel: "URL:",
      vocabulary_sourceFileLabel: "File:",
      vocabulary_sourceSentenceLabel: "Sentence:",
      vocabulary_sourceExcerptLabel: "Excerpt:",
      vocabulary_sourceSummaryLabel: "Summary:",
      vocabulary_readingAssetTitle: "Reading asset",
      vocabulary_actionResumeReadingAsset: "Resume reading asset",
      vocabulary_actionOpenDeepRead: "Open in deep read",
      vocabulary_actionStopListening: "Stop listening",
      vocabulary_actionListenSentence: "Listen to sentence",
      vocabulary_actionListenWord: "Listen to word",
      vocabulary_noteLabel: "Note",
      vocabulary_notePlaceholder: "Add note...",
      vocabulary_tagsLabel: "Tags",
      vocabulary_tagsPlaceholder: "Add tags (comma-separated)...",
      vocabulary_deleteConfirm: "Confirm",
      vocabulary_deleteCancel: "Cancel",
      vocabulary_deleteAction: "Delete",
      vocabulary_readingIntro: "Revisit reading items from one queue. Articles and remote PDFs resume directly; local PDF / EPUB / subtitle files reopen the right reader and ask for the same file again.",
      vocabulary_viewLabel: "View:",
      vocabulary_readingSortOpened: "Opened",
      vocabulary_readingSortTitle: "Title A-Z",
      vocabulary_readingEmptyRecent: "No reading items yet. Translate a page in the browser to populate history.",
      vocabulary_readingEmptySaved: "Nothing marked as saved. Open Recent and mark an item as saved.",
      vocabulary_readingEmptyInProgress: "Nothing in progress. Mark a page as in progress from Recent or Saved.",
      review_todayProgressAria: "Today's study progress summary",
      popup_studyTodayStatsTitle: "Today's learning counts",
      popup_studyTodayStatsHint: `Local calendar day: ${subs[0] ?? "$1"}. Counters reset when the date changes.`,
      popup_studyTodayStatsInfoAction: "How it resets",
      popup_studyTodayStatsResetBoundary: "These counts follow your local calendar day and reset at local midnight on this device, not at UTC midnight.",
      popup_studyStatPages: `${subs[0] ?? "$1"} pages`,
      popup_studyStatExplained: `${subs[0] ?? "$1"} explained`,
      popup_studyStatSaved: `${subs[0] ?? "$1"} saved`,
      popup_studyStatReviewed: `${subs[0] ?? "$1"} reviewed`,
      vocabulary_contextShowMore: "Show full context",
      vocabulary_contextShowLess: "Show less",
      actionExplain: "Explain",
      actionExplaining: "Explaining…",
      review_openSourcePage: "Open source page",
    }
    return messages[key] ?? key
  },
}))

vi.mock("@/utils/deep-read-link", () => ({
  openVocabularyEntryInDeepRead: openVocabularyEntryInDeepReadMock,
  openPageInDeepRead: openPageInDeepReadMock,
}))

vi.mock("@/utils/review-link", () => ({
  openFocusedReview: openFocusedReviewMock,
  openPageReviewLoop: openPageReviewLoopMock,
}))

vi.mock("@/utils/storage/owned-reading", () => {
  const deriveOwnedReadingArticleUrl = (item: { sourceType: string; readingHistoryRecordId?: string | null; sourceUrl?: string | null; studyProgressRecordId?: string | null }) => {
    if (item.sourceType !== "article") return null
    return item.readingHistoryRecordId ?? item.sourceUrl ?? item.studyProgressRecordId ?? null
  }

  return {
    deriveOwnedReadingArticleUrl,
    buildOwnedReadingResumeTarget: (item: { sourceType: string; sourceUrl?: string | null; localUri?: string | null; reopenHint?: string | null; readingHistoryRecordId?: string | null; studyProgressRecordId?: string | null }) => {
      if (item.sourceType === "article") {
        const url = deriveOwnedReadingArticleUrl(item)
        return url ? { url, sourceType: "article", mode: "direct", requiresFileSelection: false } : null
      }
      if (item.sourceType === "pdf" && item.sourceUrl?.startsWith("http")) {
        return {
          url: `chrome-extension://test-id/pdf-reader.html?url=${encodeURIComponent(item.sourceUrl)}`,
          sourceType: "pdf",
          mode: "direct",
          requiresFileSelection: false,
        }
      }
      if ((item.sourceType === "pdf" || item.sourceType === "epub" || item.sourceType === "subtitle-file") && !item.localUri && !item.reopenHint) return null
      if (item.sourceType === "pdf") {
        return {
          url: `chrome-extension://test-id/pdf-reader.html?reopenHint=${encodeURIComponent(item.reopenHint ?? "")}`,
          sourceType: "pdf",
          mode: "reader_handoff",
          requiresFileSelection: true,
        }
      }
      if (item.sourceType === "epub") {
        return {
          url: `chrome-extension://test-id/epub-reader.html?reopenHint=${encodeURIComponent(item.reopenHint ?? "")}`,
          sourceType: "epub",
          mode: "reader_handoff",
          requiresFileSelection: true,
        }
      }
      if (item.sourceType === "subtitle-file") {
        return {
          url: `chrome-extension://test-id/subtitle-reader.html?reopenHint=${encodeURIComponent(item.reopenHint ?? "")}`,
          sourceType: "subtitle-file",
          mode: "reader_handoff",
          requiresFileSelection: true,
        }
      }
      return null
    },
    countOwnedReadingItemsByView: (items: Array<{ status: string }>, view: string) => items.filter((item) => {
      if (view === "recent") return item.status !== "archived"
      return item.status === view
    }).length,
    filterOwnedReadingItemsByView: (items: Array<{ status: string }>, view: string) => items.filter((item) => {
      if (view === "recent") return item.status !== "archived"
      return item.status === view
    }),
    describeOwnedReadingResumeBehavior: (item: { sourceType: string; sourceUrl?: string | null; localUri?: string | null; reopenHint?: string | null }) => {
      if (item.sourceType === "article") return "Resumes the source article directly."
      if (item.sourceType === "pdf" && item.sourceUrl?.startsWith("http")) return "Opens the saved remote PDF in the PDF reader."
      if ((item.sourceType === "pdf" || item.sourceType === "epub" || item.sourceType === "subtitle-file") && !item.localUri && !item.reopenHint) return "Resume unavailable for this item."
      if (item.sourceType === "pdf") return "Opens the PDF reader and prompts for the same local file."
      if (item.sourceType === "epub") return "Opens the EPUB reader and prompts for the same file again."
      if (item.sourceType === "subtitle-file") return "Opens the subtitle reader and prompts for the same file again."
      return "Resume unavailable for this item."
    },
    describeOwnedReadingProgress: (item: { progress?: { fraction?: number; chapterId?: string; sentenceIndex?: number } }) => {
      if (typeof item.progress?.chapterId === "string") return `Last chapter: ${item.progress.chapterId}`
      if (typeof item.progress?.fraction === "number") return `Progress: ${Math.round(item.progress.fraction * 100)}%`
      if (typeof item.progress?.sentenceIndex === "number") return `Last row: ${item.progress.sentenceIndex + 1}`
      return null
    },
    matchOwnedReadingItemForVocabularyEntry: (items: Array<{ id: string; sourceType: string; sourceUrl?: string | null; localUri?: string | null; readingHistoryRecordId?: string | null; studyProgressRecordId?: string | null }>, entry: { url?: string; sourceContext?: { ownedReadingItemId?: string; pageUrl?: string; ownedReadingSourceType?: string } }) => {
      if (entry.sourceContext?.ownedReadingItemId) {
        return items.find((item) => item.id === entry.sourceContext?.ownedReadingItemId) ?? null
      }
      const pageUrl = entry.sourceContext?.pageUrl ?? entry.url
      if ((entry.sourceContext?.ownedReadingSourceType === "pdf" || entry.sourceContext?.ownedReadingSourceType === "epub" || entry.sourceContext?.ownedReadingSourceType === "subtitle-file") && pageUrl) {
        return items.find((item) => item.sourceType === entry.sourceContext?.ownedReadingSourceType && (item.localUri === pageUrl || item.sourceUrl === pageUrl || item.studyProgressRecordId === pageUrl)) ?? null
      }
      if ((entry.sourceContext?.ownedReadingSourceType === "article" || !entry.sourceContext?.ownedReadingSourceType) && pageUrl) {
        const sanitized = pageUrl.split("?")[0]?.split("#")[0]
        return items.find((item) => item.sourceType === "article" && (item.readingHistoryRecordId === sanitized || item.sourceUrl === sanitized || item.studyProgressRecordId === sanitized)) ?? null
      }
      return null
    },
    getOwnedReadingSourceTypeLabel: (sourceType: string) => {
      if (sourceType === "article") return "Article"
      if (sourceType === "pdf") return "PDF"
      if (sourceType === "epub") return "EPUB"
      if (sourceType === "subtitle-file") return "Subtitle file"
      return sourceType
    },
    buildOwnedReadingThemePacks: buildOwnedReadingThemePacksMock,
    buildSignedOwnedReadingThemePackPackage: buildSignedOwnedReadingThemePackPackageMock,
    importOwnedReadingThemePackPackagePayload: importOwnedReadingThemePackPackagePayloadMock,
    previewOwnedReadingThemePackPackagePayload: previewOwnedReadingThemePackPackagePayloadMock,
    parseSignedOwnedReadingThemePackPackage: parseSignedOwnedReadingThemePackPackageMock,
    verifyOwnedReadingThemePackPackage: verifyOwnedReadingThemePackPackageMock,
    syncRecentReadingHistoryToOwnedQueue: syncRecentReadingHistoryToOwnedQueueMock,
    listOwnedReadingItems: listOwnedReadingItemsMock,
    markOwnedReadingOpened: markOwnedReadingOpenedMock,
    setOwnedReadingStatus: setOwnedReadingStatusMock,
    removeOwnedReadingItem: removeOwnedReadingItemMock,
  }
})

vi.mock("@/utils/storage/reading-history", () => ({
  getReadingHistoryEntry: getReadingHistoryEntryMock,
}))

vi.mock("@/utils/storage/study-progress", () => {
  type MockStudyPage = { url?: string; completedSteps?: string[]; sentencesExplained?: number; vocabSaved?: number; vocabReviewed?: number }

  const deriveStudyLoopPageSummary = (page: MockStudyPage | null) => {
    const completedSteps = page?.completedSteps ?? []
    const order = ["read", "guided_read", "explain", "vocab_save", "vocab_review"]
    const ordered = order.filter((step) => completedSteps.includes(step))
    const highestCompletedIndex = ordered.reduce((maxIndex, step) => Math.max(maxIndex, order.indexOf(step)), -1)
    return {
      completedSteps: ordered,
      currentCounts: {
        sentencesExplained: page?.sentencesExplained ?? 0,
        vocabSaved: page?.vocabSaved ?? 0,
        vocabReviewed: page?.vocabReviewed ?? 0,
      },
      nextStep: highestCompletedIndex < 0 ? order[0] : (order[highestCompletedIndex + 1] ?? null),
      completionPercent: Math.round((ordered.length / order.length) * 100),
    }
  }

  return {
    deriveStudyLoopPageSummary,
    deriveStudyLoopViewModel: (store: { pages?: MockStudyPage[]; dailyStats: { date: string; pagesStudied: number; sentencesExplained: number; vocabSaved: number; vocabReviewed: number } }, currentUrl?: string) => {
      const currentPage = store.pages?.find((page) => page.url === currentUrl) ?? null
      return {
        currentPage,
        ...deriveStudyLoopPageSummary(currentPage),
        dailyStats: store.dailyStats,
        recentPages: store.pages ?? [],
        personalizedStrategy: null,
      }
    },
    getPageStudyProgress: getPageStudyProgressMock,
    getStudyProgress: getStudyProgressMock,
  }
})

vi.mock("#imports", () => ({
  browser: {
    runtime: {
      getURL: vi.fn((path: string) => `chrome-extension://test-id${path}`),
      sendMessage: vi.fn(),
    },
    tabs: {
      create: vi.fn(),
    },
  },
}))

import { browser } from "#imports"
import VocabularyApp from "./VocabularyApp"

describe("VocabularyApp", () => {
  let container: HTMLDivElement
  let root: ReactDOM.Root

  beforeEach(async () => {
    vi.clearAllMocks()
    clickedDownloadAnchor = null
    lastDownloadBlobParts = []
    createObjectURLMock.mockReturnValue("blob:astra-reading-theme-packs")
    anchorClickMock.mockImplementation(function (this: HTMLAnchorElement) {
      clickedDownloadAnchor = this
    })
    Object.defineProperty(globalThis, "Blob", {
      configurable: true,
      value: class TestDownloadBlob extends NativeBlob {
        constructor(blobParts?: BlobPart[], options?: BlobPropertyBag) {
          lastDownloadBlobParts = [...(blobParts ?? [])]
          super(blobParts, options)
        }
      },
    })
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURLMock,
    })
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURLMock,
    })
    Object.defineProperty(HTMLAnchorElement.prototype, "click", {
      configurable: true,
      value: anchorClickMock,
    })
    window.history.replaceState({}, "", "/vocabulary.html")
    readConfigMock.mockResolvedValue({
      targetLang: "zh-CN",
      tts: {
        enabled: true,
        engine: "browser",
        voiceName: "Test Voice",
        rate: 1,
        pitch: 1,
      },
    })
    readAstraSessionMock.mockResolvedValue(null)
    isTtsSupportedMock.mockReturnValue(true)
    speakMock.mockReturnValue(true)

    getVocabularyEntriesMock.mockResolvedValue([{
      id: "entry-1",
      text: "ephemeral",
      explanation: "Short-lived in the article context.",
      context: "The ephemeral phase passes quickly.",
      url: "https://example.com/article",
      hostname: "example.com",
      savedAt: 1000,
      srsBox: 1,
      nextReviewAt: 1000,
      reviewCount: 0,
      lastReviewedAt: null,
      sourceContext: {
        surface: "popup_deep_read",
        pageTitle: "Example article",
        pageUrl: "https://example.com/article?from=popup",
        hostname: "example.com",
        articleExcerpt: "The ephemeral phase passes quickly. Another sentence follows.",
        sentenceText: "The ephemeral phase passes quickly.",
        sentenceIndex: 0,
        ownedReadingItemId: "or_article_example",
        ownedReadingSourceType: "article",
        ownedReadingTitle: "Example article",
        studyProgressRecordId: "https://example.com/article",
      },
    }, {
      id: "entry-2",
      text: "subtitle-word",
      translation: "字幕词",
      context: "sample.srt · row 2",
      url: "astra-local://subtitle/sample.srt",
      hostname: "subtitle-reader",
      savedAt: 900,
      srsBox: 1,
      nextReviewAt: 900,
      reviewCount: 0,
      lastReviewedAt: null,
      sourceContext: {
        surface: "subtitle_reader",
        pageTitle: "sample.srt",
        pageUrl: "astra-local://subtitle/sample.srt",
        hostname: "subtitle-reader",
        contentSummary: "SRT · 12 items",
        sentenceText: "subtitle-word",
        sentenceIndex: 1,
        ownedReadingItemId: "or_subtitle_sample",
        ownedReadingSourceType: "subtitle-file",
        ownedReadingTitle: "sample.srt · SRT · 12 items",
      },
    }])
    getDueVocabularyCountMock.mockResolvedValue(1)
    removeVocabularyEntryMock.mockResolvedValue(undefined)
    updateVocabularyEntryMock.mockResolvedValue(null)
    getReadingHistoryEntryMock.mockResolvedValue(null)
    syncRecentReadingHistoryToOwnedQueueMock.mockResolvedValue(undefined)
    listOwnedReadingItemsMock.mockResolvedValue([
      {
        id: "or_article_example",
        sourceType: "article",
        title: "Example article",
        sourceUrl: "https://example.com/article",
        openedAt: 1000,
        status: "saved",
        readingHistoryRecordId: "https://example.com/article",
        studyProgressRecordId: "https://example.com/article",
      },
      {
        id: "or_subtitle_sample",
        sourceType: "subtitle-file",
        title: "sample.srt · SRT · 12 items",
        sourceUrl: null,
        localUri: "astra-local://subtitle/sample.srt",
        reopenHint: "Open the subtitle reader and choose the same file: sample.srt · continue from row 2",
        openedAt: 900,
        status: "saved",
        progress: { sentenceIndex: 1 },
        readingHistoryRecordId: null,
        studyProgressRecordId: null,
      },
    ])
    buildOwnedReadingThemePacksMock.mockImplementation((items: Array<{ id: string; sourceType: string; title: string; status: string }>) => {
      const grouped = new Map<string, { id: string; themeKey: string; title: string; assets: Array<{ id: string; title: string; sourceType: string }> }>()
      for (const item of items.filter((row) => row.status !== "archived")) {
        const themeKey = item.sourceType === "article" ? "article:example.com" : `${item.sourceType}:local`
        const title = item.sourceType === "article"
          ? "Articles from example.com"
          : item.sourceType === "subtitle-file"
            ? "Subtitle files"
            : item.sourceType === "epub"
              ? "EPUB books"
              : "Local PDFs"
        const id = `theme_${themeKey.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`
        const pack = grouped.get(id) ?? { id, themeKey, title, assets: [] }
        pack.assets.push({ id: item.id, title: item.title, sourceType: item.sourceType })
        grouped.set(id, pack)
      }
      return [...grouped.values()]
        .map((pack) => ({ ...pack, assetCount: pack.assets.length }))
        .sort((a, b) => a.title.localeCompare(b.title))
    })
    buildSignedOwnedReadingThemePackPackageMock.mockImplementation(async (items: Array<{ id: string; sourceType: string; title: string; status: string }>, vocabularyEntries: Array<{ id: string }>) => {
      const themePacks = buildOwnedReadingThemePacksMock(items)
      return {
        schema: "astra-owned-reading-theme-pack-package.v3",
        generatedAt: "2026-04-29T00:00:00.000Z",
        payload: {
          schema: "astra-owned-reading-theme-pack-payload.v3",
          generatedAt: "2026-04-29T00:00:00.000Z",
          ownedReading: {
            schema: "astra-owned-reading-theme-packs.v1",
            generatedAt: "2026-04-29T00:00:00.000Z",
            assetCount: themePacks.reduce((count: number, pack: { assetCount: number }) => count + pack.assetCount, 0),
            themePackCount: themePacks.length,
            themePacks,
          },
          vocabularyEntries,
        },
        signature: {
          algorithm: "SHA-256",
          value: "0".repeat(64),
        },
      }
    })
    parseSignedOwnedReadingThemePackPackageMock.mockImplementation((raw: string) => JSON.parse(raw))
    verifyOwnedReadingThemePackPackageMock.mockImplementation(async (signedPackage: { payload: unknown }) => signedPackage.payload)
    importOwnedReadingThemePackPackagePayloadMock.mockResolvedValue({ importedCount: 2, skippedCount: 0, verified: true })
    previewOwnedReadingThemePackPackagePayloadMock.mockResolvedValue({
      totalCount: 2,
      importedCount: 2,
      skippedCount: 0,
      newCount: 2,
      updatedCount: 0,
      conflicts: [],
      rollback: { restoreCount: 0, removeCount: 2 },
      verified: true,
    })
    importVocabularyEntriesFromThemePackPayloadMock.mockResolvedValue({ importedCount: 2, skippedCount: 0 })
    previewVocabularyEntriesFromThemePackPayloadMock.mockResolvedValue({
      totalCount: 2,
      importedCount: 2,
      skippedCount: 0,
      conflicts: [],
      rollback: { removeCount: 2 },
    })
    markOwnedReadingOpenedMock.mockResolvedValue(undefined)
    setOwnedReadingStatusMock.mockResolvedValue(undefined)
    removeOwnedReadingItemMock.mockResolvedValue(undefined)
    getPageStudyProgressMock.mockResolvedValue(null)
    getStudyProgressMock.mockResolvedValue({
      pages: [],
      dailyStats: {
        date: "2026-04-14",
        pagesStudied: 0,
        sentencesExplained: 0,
        vocabSaved: 0,
        vocabReviewed: 0,
      },
    })

    container = document.createElement("div")
    document.body.appendChild(container)
    root = ReactDOM.createRoot(container)

    await act(async () => {
      root.render(<VocabularyApp />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
      await Promise.resolve()
    })
    container.remove()
  })

  async function rerenderApp() {
    await act(async () => {
      root.unmount()
      await Promise.resolve()
    })
    container.remove()

    container = document.createElement("div")
    document.body.appendChild(container)
    root = ReactDOM.createRoot(container)

    await act(async () => {
      root.render(<VocabularyApp />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
  }

  it("renders popup deep-read source context in the vocabulary list", async () => {
    expect(container.textContent).toContain("Popup deep-read")
    expect(container.textContent).toContain("Example article")
    expect(container.textContent).toContain("The ephemeral phase passes quickly.")

    const sourceBadge = container.querySelector('[data-role="vocabulary-entry-card"][data-entry-id="entry-1"]') as HTMLButtonElement
    expect(sourceBadge).toBeTruthy()

    await act(async () => {
      sourceBadge.click()
      await Promise.resolve()
    })

    expect(container.textContent).toContain("Host: example.com")
    expect(container.textContent).toContain("URL: https://example.com/article")
    expect(container.textContent).toContain("Excerpt: The ephemeral phase passes quickly. Another sentence follows.")
    expect(container.textContent).toContain("Reading asset")
    expect(container.textContent).toContain("Example article · Article")

    const resumeAssetButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Resume reading asset") as HTMLButtonElement
    expect(resumeAssetButton).toBeTruthy()

    await act(async () => {
      resumeAssetButton.click()
      await Promise.resolve()
    })

    expect(markOwnedReadingOpenedMock).toHaveBeenCalledWith("or_article_example")
    expect(browser.tabs.create).toHaveBeenCalledWith({ url: "https://example.com/article" })
  })

  it("renders subtitle-reader source context and reopens the linked subtitle-file asset", async () => {
    const subtitleCard = container.querySelector('[data-role="vocabulary-entry-card"][data-entry-id="entry-2"]') as HTMLDivElement
    expect(subtitleCard).toBeTruthy()

    await act(async () => {
      subtitleCard.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain("Subtitle reader")
    expect(container.textContent).toContain("sample.srt")
    expect(container.textContent).toContain("File: astra-local://subtitle/sample.srt")
    expect(container.textContent).toContain("Summary: SRT · 12 items")
    expect(container.textContent).toContain("Reading asset")
    expect(container.textContent).toContain("sample.srt · SRT · 12 items · Subtitle file")
    expect(container.textContent).toContain("Last row: 2")

    const resumeAssetButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Resume reading asset") as HTMLButtonElement
    expect(resumeAssetButton).toBeTruthy()

    await act(async () => {
      resumeAssetButton.click()
      await Promise.resolve()
    })

    expect(markOwnedReadingOpenedMock).toHaveBeenCalledWith("or_subtitle_sample")
    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: "chrome-extension://test-id/subtitle-reader.html?reopenHint=Open%20the%20subtitle%20reader%20and%20choose%20the%20same%20file%3A%20sample.srt%20%C2%B7%20continue%20from%20row%202",
    })
  })

  it("speaks the saved study sentence directly from the vocabulary card", async () => {
    const sourceBadge = container.querySelector('[data-role="vocabulary-entry-card"][data-entry-id="entry-1"]') as HTMLButtonElement

    await act(async () => {
      sourceBadge.click()
      await Promise.resolve()
    })

    const speakButton = container.querySelector('[data-testid="vocab-speak-entry-entry-1"]') as HTMLButtonElement
    expect(speakButton).toBeTruthy()
    expect(speakButton.textContent).toContain("Listen to sentence")

    await act(async () => {
      speakButton.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(speakMock).toHaveBeenCalledWith("The ephemeral phase passes quickly.", expect.objectContaining({
      lang: "zh-CN",
    }))
  })

  it("opens the saved popup deep-read sentence back into deep read", async () => {
    const sourceBadge = container.querySelector('[data-role="vocabulary-entry-card"][data-entry-id="entry-1"]') as HTMLButtonElement

    await act(async () => {
      sourceBadge.click()
      await Promise.resolve()
    })

    const deepReadButton = container.querySelector('[data-testid="vocab-open-deep-read-entry-1"]') as HTMLButtonElement
    expect(deepReadButton).toBeTruthy()
    expect(deepReadButton.textContent).toContain("Open in deep read")

    await act(async () => {
      deepReadButton.click()
      await Promise.resolve()
    })

    expect(openVocabularyEntryInDeepReadMock).toHaveBeenCalledWith(expect.objectContaining({
      id: "entry-1",
      sourceContext: expect.objectContaining({
        surface: "popup_deep_read",
        sentenceIndex: 0,
      }),
    }))
  })

  it("filters list by source page title", async () => {
    const input = container.querySelector("input[type=\"text\"]") as HTMLInputElement
    expect(input).toBeTruthy()

    await act(async () => {
      const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")
      desc?.set?.call(input, "Example article")
      input.dispatchEvent(new Event("input", { bubbles: true }))
      input.dispatchEvent(new Event("change", { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain("ephemeral")
    expect(container.textContent).toContain("Search results")
    expect(container.textContent).toContain("In saved words")
    expect(container.textContent).not.toContain("In saved sentences")
    expect(container.textContent).toContain("In article titles")
  })

  it("can expand long saved context instead of forcing the 200 character preview", async () => {
    getVocabularyEntriesMock.mockResolvedValueOnce([{
      id: "entry-long",
      text: "contextual",
      explanation: "Long context entry",
      context: "Short context",
      url: "https://example.com/long",
      hostname: "example.com",
      savedAt: 1100,
      srsBox: 1,
      nextReviewAt: 1000,
      reviewCount: 0,
      lastReviewedAt: null,
      sourceContext: {
        surface: "popup_deep_read",
        pageTitle: "Long article",
        pageUrl: "https://example.com/long",
        hostname: "example.com",
        articleExcerpt: `${"A very long context sentence that keeps going to test the preview limit. ".repeat(12)}tail`,
        sentenceText: `${"A very long sentence preview that keeps going to test the preview limit. ".repeat(6)}tail`,
        sentenceIndex: 0,
      },
    }])

    await rerenderApp()

    expect(container.textContent).toContain("Show full context")
    expect(container.textContent).toContain("...")

    const expandButton = container.querySelector('[data-role="vocabulary-entry-card"][data-entry-id="entry-long"]') as HTMLButtonElement
    expect(expandButton).toBeTruthy()

    await act(async () => {
      expandButton.click()
      await Promise.resolve()
    })

    expect(container.textContent).toContain("Show less")
    expect(container.textContent).toContain("tail")
  })

  it("explains the daily stats reset boundary from the learning desk", async () => {
    getStudyProgressMock.mockResolvedValueOnce({
      pages: [],
      dailyStats: {
        date: "2026-04-14",
        pagesStudied: 1,
        sentencesExplained: 2,
        vocabSaved: 3,
        vocabReviewed: 4,
      },
    })

    await rerenderApp()

    const continuityNudge = container.querySelector('[data-testid="vocabulary-continuity-nudge"]') as HTMLElement
    expect(continuityNudge).toBeTruthy()
    expect(continuityNudge.textContent).toContain("Account continuity")
    expect(continuityNudge.textContent).toContain("Keep your learning trail when you switch devices")
    expect(continuityNudge.textContent).toContain("same source pages and saved card context")
    expect(continuityNudge.textContent).toContain("saved cards")
    expect(continuityNudge.textContent).toContain("Proof in your learning desk is worth carrying forward")
    expect(continuityNudge.textContent).toContain("Proof now: 1 due review card · 2 saved learning cards · 1 page studied today")
    expect(continuityNudge.textContent).toContain("existing Astra sign-in panel")
    const continuityCta = container.querySelector('[data-testid="vocabulary-account-continuity-sign-in-cta"]') as HTMLButtonElement
    expect(continuityCta).toBeTruthy()
    expect(continuityCta.textContent).toContain("Sign in to keep continuity")

    await act(async () => {
      continuityCta.click()
      await Promise.resolve()
    })

    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: "chrome-extension://test-id/popup.html?focus=sign-in",
    })

    const infoButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "How it resets") as HTMLButtonElement
    expect(infoButton).toBeTruthy()

    await act(async () => {
      infoButton.click()
      await Promise.resolve()
    })

    expect(container.textContent).toContain("Local calendar day")
    expect(container.textContent).toContain("local midnight on this device")
  })

  it("renders proof-aware account continuity moments on review and reading surfaces", async () => {
    const reviewBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Review (1)")
    expect(reviewBtn).toBeTruthy()

    await act(async () => {
      reviewBtn!.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    const reviewProof = container.querySelector('[data-testid="vocabulary-review-continuity-proof"]') as HTMLElement
    expect(reviewProof).toBeTruthy()
    expect(reviewProof.textContent).toContain("Proof in Review shows the loop is working")
    expect(reviewProof.textContent).toContain("Proof now: 1 due review card · 2 saved learning cards")
    expect(reviewProof.textContent).toContain("existing Astra sign-in panel")

    const readingBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Reading")
    expect(readingBtn).toBeTruthy()

    await act(async () => {
      readingBtn!.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const readingProof = container.querySelector('[data-testid="vocabulary-reading-continuity-proof"]') as HTMLElement
    expect(readingProof).toBeTruthy()
    expect(readingProof.textContent).toContain("Proof in Reading shows what you can resume later")
    expect(readingProof.textContent).toContain("saved learning cards")
    const readingContinuityCta = container.querySelector('[data-testid="vocabulary-reading-continuity-proof-sign-in-cta"]') as HTMLButtonElement
    expect(readingContinuityCta.textContent).toContain("Sign in to keep continuity")

    await act(async () => {
      readingContinuityCta.click()
      await Promise.resolve()
    })

    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: "chrome-extension://test-id/popup.html?focus=sign-in",
    })
  })

  it("renders connected vocabulary continuity proof without sign-in CTAs when signed in", async () => {
    readAstraSessionMock.mockResolvedValue({
      version: 1,
      sessionToken: "astra-session",
      sessionId: "sess-123",
      deviceId: "device-123",
      identityMode: "authenticated",
      relayBaseURL: "https://astra.example/v1",
      email: "user@example.com",
      plan: "free",
      subscriptionStatus: "active",
      providerEntitlements: ["openai", "gemini"],
      quota: {
        dailyRequestsLimit: 0,
        dailyCharactersLimit: 0,
        requestsPerMinuteLimit: 0,
        remainingDailyRequests: 0,
        remainingDailyCharacters: 0,
      },
      usage: {
        totalRequests: 0,
        totalCharacters: 0,
        dailyRequestsUsed: 0,
        dailyCharactersUsed: 0,
        lastRequestAt: null,
        recentEvents: [],
      },
      issuedAt: null,
      expiresAt: null,
    })
    await rerenderApp()

    const listProof = container.querySelector('[data-testid="vocabulary-continuity-nudge"]') as HTMLElement
    expect(listProof.textContent).toContain("Continuity is connected for this account")
    expect(listProof.textContent).toContain("saved learning cards")
    expect(listProof.textContent).toContain("Connected proof")
    expect(listProof.textContent).toContain("no sign-in action is needed")
    expect(listProof.textContent).toContain("SRS schedule timing stays local-only")
    expect(container.querySelector('[data-testid="vocabulary-account-continuity-sign-in-cta"]')).toBeNull()

    const reviewBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Review (1)")
    await act(async () => {
      reviewBtn!.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    const reviewProof = container.querySelector('[data-testid="vocabulary-review-continuity-proof"]') as HTMLElement
    expect(reviewProof.textContent).toContain("Continuity is connected for this account")
    expect(reviewProof.textContent).toContain("no sign-in action is needed")
    expect(reviewProof.textContent).toContain("SRS schedule timing stays local-only")
    expect(container.querySelector('[data-testid="vocabulary-review-continuity-proof-sign-in-cta"]')).toBeNull()

    const readingBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Reading")
    await act(async () => {
      readingBtn!.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const readingProof = container.querySelector('[data-testid="vocabulary-reading-continuity-proof"]') as HTMLElement
    expect(readingProof.textContent).toContain("Continuity is connected for this account")
    expect(readingProof.textContent).toContain("no sign-in action is needed")
    expect(readingProof.textContent).toContain("SRS schedule timing stays local-only")
    expect(container.querySelector('[data-testid="vocabulary-reading-continuity-proof-sign-in-cta"]')).toBeNull()
  })

  it("loads reading queue when Reading tab is selected", async () => {
    const readingBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Reading")
    expect(readingBtn).toBeTruthy()

    await act(async () => {
      readingBtn!.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(syncRecentReadingHistoryToOwnedQueueMock).toHaveBeenCalled()
    expect(listOwnedReadingItemsMock).toHaveBeenCalled()
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      type: "runtime/learning-continuity-sync",
      reason: "vocabulary-owned-reading-merge",
    })
  })

  it("triggers continuity sync after Reading queue status mutations", async () => {
    const readingBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Reading")
    await act(async () => {
      readingBtn!.click()
      await Promise.resolve()
      await Promise.resolve()
    })
    vi.mocked(browser.runtime.sendMessage).mockClear()

    const archiveButton = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Archive") as HTMLButtonElement
    expect(archiveButton).toBeTruthy()

    await act(async () => {
      archiveButton.click()
      await Promise.resolve()
    })

    expect(setOwnedReadingStatusMock).toHaveBeenCalledWith("or_article_example", "archived")
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      type: "runtime/learning-continuity-sync",
      reason: "vocabulary-owned-reading-status",
    })
  })

  it("shows page-aware review handoffs from the learning desk and reading queue", async () => {
    const helloEntry = {
      id: "hello-entry-new",
      text: "hello-word",
      explanation: "A saved word from Hello page.",
      context: "Hello page context.",
      url: "https://example.com/hello?utm=1",
      hostname: "example.com",
      savedAt: 2000,
      srsBox: 1,
      nextReviewAt: Date.now() + 86_400_000,
      reviewCount: 0,
      lastReviewedAt: null,
      sourceContext: {
        surface: "popup_deep_read" as const,
        pageTitle: "Hello page",
        pageUrl: "https://example.com/hello?utm=1#sentence",
        hostname: "example.com",
        sentenceText: "Hello page context.",
        sentenceIndex: 2,
        ownedReadingItemId: "or_test1",
        ownedReadingSourceType: "article" as const,
        ownedReadingTitle: "Hello page",
        studyProgressRecordId: "https://example.com/hello",
      },
    }
    const helloReadingItem = {
      id: "or_test1",
      sourceType: "article" as const,
      title: "Hello page",
      sourceUrl: null,
      openedAt: 10_000,
      status: "saved" as const,
      readingHistoryRecordId: "https://example.com/hello",
      studyProgressRecordId: "https://example.com/hello",
    }
    const helloProgress = {
      url: "https://example.com/hello",
      hostname: "example.com",
      title: "Hello page",
      completedSteps: ["read", "explain", "vocab_save"],
      sentencesExplained: 1,
      vocabSaved: 1,
      vocabReviewed: 0,
      startedAt: 9_000,
      lastActivityAt: 10_000,
    }

    getVocabularyEntriesMock.mockResolvedValueOnce([helloEntry])
    listOwnedReadingItemsMock.mockResolvedValueOnce([helloReadingItem])
    getStudyProgressMock.mockResolvedValueOnce({
      pages: [helloProgress],
      dailyStats: {
        date: "2026-04-14",
        pagesStudied: 1,
        sentencesExplained: 1,
        vocabSaved: 1,
        vocabReviewed: 0,
      },
    })

    await rerenderApp()

    const learningDeskCta = container.querySelector('[data-testid="learning-desk-page-review-cta"] button') as HTMLButtonElement
    expect(learningDeskCta).toBeTruthy()
    expect(container.textContent).toContain("Saved sentences on this page")
    expect(container.textContent).toContain("1 saved sentence(s) from this page can be reviewed anytime.")

    await act(async () => {
      learningDeskCta.click()
      await Promise.resolve()
    })

    expect(openPageReviewLoopMock).toHaveBeenCalledWith("https://example.com/hello", "hello-entry-new")
    openPageReviewLoopMock.mockClear()

    getVocabularyEntriesMock.mockResolvedValueOnce([helloEntry])
    listOwnedReadingItemsMock.mockResolvedValueOnce([helloReadingItem])
    getReadingHistoryEntryMock.mockResolvedValueOnce({
      id: "https://example.com/hello",
      url: "https://example.com/hello",
      hostname: "example.com",
      title: "Hello page",
      wordsTranslated: 12,
      visitedAt: 10_000,
    })
    getPageStudyProgressMock.mockResolvedValueOnce(helloProgress)

    const readingBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Reading")
    await act(async () => {
      readingBtn!.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const rowReviewCta = container.querySelector('[data-testid="reading-page-review-or_test1"]') as HTMLButtonElement
    expect(rowReviewCta).toBeTruthy()
    expect(rowReviewCta.textContent).toBe("Review saved sentences from this page")

    await act(async () => {
      rowReviewCta.click()
      await Promise.resolve()
    })

    expect(openPageReviewLoopMock).toHaveBeenCalledWith("https://example.com/hello", "hello-entry-new")
  })

  it("shows non-review article next steps as Deep Read handoffs from the learning desk and reading queue", async () => {
    const nextStepReadingItem = {
      id: "or_next_step",
      sourceType: "article" as const,
      title: "Next step page",
      sourceUrl: "https://example.com/next-step?utm=1",
      openedAt: 12_000,
      status: "in_progress" as const,
      readingHistoryRecordId: "https://example.com/next-step",
      studyProgressRecordId: "https://example.com/next-step",
    }
    const nextStepProgress = {
      url: "https://example.com/next-step",
      hostname: "example.com",
      title: "Next step page",
      completedSteps: ["read", "guided_read"],
      sentencesExplained: 0,
      vocabSaved: 0,
      vocabReviewed: 0,
      startedAt: 11_000,
      lastActivityAt: 12_000,
    }

    getVocabularyEntriesMock.mockResolvedValueOnce([])
    listOwnedReadingItemsMock.mockResolvedValueOnce([nextStepReadingItem])
    getStudyProgressMock.mockResolvedValueOnce({
      pages: [nextStepProgress],
      dailyStats: {
        date: "2026-04-14",
        pagesStudied: 1,
        sentencesExplained: 0,
        vocabSaved: 0,
        vocabReviewed: 0,
      },
    })

    await rerenderApp()

    expect(container.querySelector('[data-testid="learning-desk-page-review-cta"]')).toBeNull()
    const learningDeskDeepReadCta = container.querySelector('[data-testid="learning-desk-deep-read-next-step-cta"] button') as HTMLButtonElement
    expect(learningDeskDeepReadCta).toBeTruthy()
    expect(container.textContent).toContain("Next: Explain")

    await act(async () => {
      learningDeskDeepReadCta.click()
      await Promise.resolve()
    })

    expect(markOwnedReadingOpenedMock).toHaveBeenCalledWith("or_next_step")
    expect(openPageInDeepReadMock).toHaveBeenCalledWith("https://example.com/next-step")
    openPageInDeepReadMock.mockClear()
    markOwnedReadingOpenedMock.mockClear()

    getVocabularyEntriesMock.mockResolvedValueOnce([])
    listOwnedReadingItemsMock.mockResolvedValueOnce([nextStepReadingItem])
    getReadingHistoryEntryMock.mockResolvedValueOnce({
      id: "https://example.com/next-step",
      url: "https://example.com/next-step",
      hostname: "example.com",
      title: "Next step page",
      wordsTranslated: 4,
      visitedAt: 12_000,
    })
    getPageStudyProgressMock.mockResolvedValueOnce(nextStepProgress)

    const readingBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Reading")
    await act(async () => {
      readingBtn!.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="reading-page-review-or_next_step"]')).toBeNull()
    const rowDeepReadCta = container.querySelector('[data-testid="reading-deep-read-next-step-or_next_step"]') as HTMLButtonElement
    expect(rowDeepReadCta).toBeTruthy()
    expect(rowDeepReadCta.textContent).toBe("Continue next step in Deep Read")

    await act(async () => {
      rowDeepReadCta.click()
      await Promise.resolve()
    })

    expect(markOwnedReadingOpenedMock).toHaveBeenCalledWith("or_next_step")
    expect(openPageInDeepReadMock).toHaveBeenCalledWith("https://example.com/next-step")
  })

  it("derives reading page-review handoff when the Reading tab is opened directly", async () => {
    const helloEntry = {
      id: "direct-entry",
      text: "direct-word",
      url: "https://example.com/direct",
      hostname: "example.com",
      savedAt: 3000,
      srsBox: 1,
      nextReviewAt: 3000,
      reviewCount: 0,
      lastReviewedAt: null,
      sourceContext: {
        surface: "popup_deep_read" as const,
        pageTitle: "Direct page",
        pageUrl: "https://example.com/direct",
        hostname: "example.com",
        sentenceText: "direct-word",
        sentenceIndex: 0,
        ownedReadingSourceType: "article" as const,
        studyProgressRecordId: "https://example.com/direct",
      },
    }
    const directReadingItem = {
      id: "or_direct",
      sourceType: "article" as const,
      title: "Direct page",
      sourceUrl: "https://example.com/direct",
      openedAt: 11_000,
      status: "saved" as const,
      readingHistoryRecordId: "https://example.com/direct",
      studyProgressRecordId: "https://example.com/direct",
    }
    const directProgress = {
      url: "https://example.com/direct",
      hostname: "example.com",
      title: "Direct page",
      completedSteps: ["read", "explain", "vocab_save"],
      sentencesExplained: 1,
      vocabSaved: 1,
      vocabReviewed: 0,
      startedAt: 10_000,
      lastActivityAt: 11_000,
    }

    window.history.replaceState({}, "", "/vocabulary.html?tab=reading")
    getVocabularyEntriesMock.mockResolvedValueOnce([helloEntry])
    listOwnedReadingItemsMock.mockResolvedValueOnce([directReadingItem])
    getReadingHistoryEntryMock.mockResolvedValueOnce({
      id: "https://example.com/direct",
      url: "https://example.com/direct",
      hostname: "example.com",
      title: "Direct page",
      wordsTranslated: 3,
      visitedAt: 11_000,
    })
    getPageStudyProgressMock.mockResolvedValueOnce(directProgress)

    await rerenderApp()

    const rowReviewCta = container.querySelector('[data-testid="reading-page-review-or_direct"]') as HTMLButtonElement
    expect(rowReviewCta).toBeTruthy()

    await act(async () => {
      rowReviewCta.click()
      await Promise.resolve()
    })

    expect(openPageReviewLoopMock).toHaveBeenCalledWith("https://example.com/direct", "direct-entry")
  })

  it("shows revisit context and resumes article rows from the stable reading-history url", async () => {
    listOwnedReadingItemsMock.mockResolvedValueOnce([
      {
        id: "or_test1",
        sourceType: "article",
        title: "Hello page",
        sourceUrl: null,
        openedAt: 10_000,
        status: "saved",
        readingHistoryRecordId: "https://example.com/hello",
        studyProgressRecordId: "https://example.com/hello",
      },
    ])
    getReadingHistoryEntryMock.mockResolvedValueOnce({
      id: "https://example.com/hello",
      url: "https://example.com/hello",
      hostname: "example.com",
      title: "Hello page",
      wordsTranslated: 12,
      visitedAt: 10_000,
    })
    getPageStudyProgressMock.mockResolvedValueOnce({
      url: "https://example.com/hello",
      hostname: "example.com",
      title: "Hello page",
      completedSteps: ["read", "explain", "vocab_save"],
      sentencesExplained: 1,
      vocabSaved: 1,
      vocabReviewed: 0,
      startedAt: 9_000,
      lastActivityAt: 10_000,
    })

    const readingBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Reading")
    await act(async () => {
      readingBtn!.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain("Host: example.com")
    expect(container.textContent).toContain("Page: https://example.com/hello")
    expect(container.textContent).toContain("Translated: 12 words translated")
    expect(container.textContent).toContain("Study loop: Read → Explain → Save words")
    expect(container.textContent).toContain("Counts: 1 explained · 1 saved · 0 reviewed")
    expect(container.textContent).toContain("Next: Review the saved card from this page to close the loop.")
    expect(container.querySelector('[data-testid="reading-page-review-or_test1"]')).toBeNull()

    expect(container.textContent).toContain("Resume: Resumes the source article directly.")

    const resumeBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Resume")
    expect(resumeBtn).toBeTruthy()
    expect((resumeBtn as HTMLButtonElement).disabled).toBe(false)

    await act(async () => {
      resumeBtn!.click()
      await Promise.resolve()
    })

    expect(markOwnedReadingOpenedMock).toHaveBeenCalledWith("or_test1")
    expect(browser.tabs.create).toHaveBeenCalledWith({ url: "https://example.com/hello" })
  })

  it("resumes remote PDF queue rows directly into the PDF reader", async () => {
    listOwnedReadingItemsMock.mockResolvedValueOnce([
      {
        id: "or_pdf1",
        sourceType: "pdf",
        title: "Paper.pdf",
        sourceUrl: "https://cdn.example/paper.pdf",
        openedAt: 10_000,
        status: "saved",
        progress: { fraction: 1 },
        readingHistoryRecordId: null,
        studyProgressRecordId: "https://cdn.example/paper.pdf",
      },
    ])

    const readingBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Reading")
    await act(async () => {
      readingBtn!.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain("Resume: Opens the saved remote PDF in the PDF reader.")
    expect(container.textContent).toContain("Progress: 100%")

    const resumeBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Resume")
    await act(async () => {
      resumeBtn!.click()
      await Promise.resolve()
    })

    expect(markOwnedReadingOpenedMock).toHaveBeenCalledWith("or_pdf1")
    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: "chrome-extension://test-id/pdf-reader.html?url=https%3A%2F%2Fcdn.example%2Fpaper.pdf",
    })
  })

  it("shows queue counts, hides archived rows from Recent, and filters Saved/In progress explicitly", async () => {
    listOwnedReadingItemsMock.mockResolvedValueOnce([
      {
        id: "or_recent",
        sourceType: "article",
        title: "Recent article",
        sourceUrl: "https://example.com/recent",
        openedAt: 12_000,
        status: "saved",
        readingHistoryRecordId: "https://example.com/recent",
        studyProgressRecordId: "https://example.com/recent",
      },
      {
        id: "or_progress",
        sourceType: "pdf",
        title: "Working paper.pdf",
        sourceUrl: "https://cdn.example/working.pdf",
        openedAt: 11_000,
        status: "in_progress",
        readingHistoryRecordId: null,
        studyProgressRecordId: "https://cdn.example/working.pdf",
      },
      {
        id: "or_archived",
        sourceType: "epub",
        title: "Archived book",
        sourceUrl: null,
        localUri: "astra-local://epub/book.epub",
        reopenHint: "Choose the same file in the ePub reader: book.epub",
        openedAt: 10_000,
        status: "archived",
        readingHistoryRecordId: null,
        studyProgressRecordId: null,
      },
    ])

    const readingBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Reading")
    await act(async () => {
      readingBtn!.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain("Recent (2)")
    expect(container.textContent).toContain("Saved (1)")
    expect(container.textContent).toContain("In progress (1)")
    expect(container.textContent).toContain("Recent shows active queue items ordered by last opened. Archived rows stay hidden here.")
    expect(container.textContent).toContain("Recent article")
    expect(container.textContent).toContain("Working paper.pdf")
    expect(container.textContent).not.toContain("Archived book")

    const savedView = container.querySelector("[data-testid=\"reading-view-saved\"]") as HTMLButtonElement
    await act(async () => {
      savedView.click()
      await Promise.resolve()
    })
    expect(container.textContent).toContain("Saved keeps items you want easy access to later.")
    expect(container.textContent).toContain("Recent article")
    expect(container.textContent).not.toContain("Working paper.pdf")

    const inProgressView = container.querySelector("[data-testid=\"reading-view-in-progress\"]") as HTMLButtonElement
    await act(async () => {
      inProgressView.click()
      await Promise.resolve()
    })
    expect(container.textContent).toContain("In progress highlights items you are still actively working through.")
    expect(container.textContent).toContain("Working paper.pdf")
    expect(container.textContent).not.toContain("Recent article")
  })

  it("opens the correct reader surface for local EPUB handoff rows", async () => {
    listOwnedReadingItemsMock.mockResolvedValueOnce([
      {
        id: "or_epub1",
        sourceType: "epub",
        title: "Book (book.epub)",
        sourceUrl: null,
        localUri: "astra-local://epub/book.epub",
        reopenHint: "Choose the same file in the ePub reader: book.epub",
        openedAt: 10_000,
        status: "saved",
        progress: { chapterId: "chapter-2" },
        readingHistoryRecordId: null,
        studyProgressRecordId: null,
      },
    ])

    const readingBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Reading")
    await act(async () => {
      readingBtn!.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain("Resume: Opens the EPUB reader and prompts for the same file again.")
    expect(container.textContent).toContain("EPUB")
    expect(container.textContent).toContain("Last chapter: chapter-2")

    const resumeBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Resume")
    await act(async () => {
      resumeBtn!.click()
      await Promise.resolve()
    })

    expect(markOwnedReadingOpenedMock).toHaveBeenCalledWith("or_epub1")
    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: "chrome-extension://test-id/epub-reader.html?reopenHint=Choose%20the%20same%20file%20in%20the%20ePub%20reader%3A%20book.epub",
    })
  })

  it("renders unified document queue rows with format badges, saved-card counts, review handoff, and unavailable resume state", async () => {
    getVocabularyEntriesMock.mockResolvedValueOnce([
      {
        id: "pdf-entry",
        text: "manual-word",
        url: "https://cdn.example/manual.pdf",
        hostname: "pdf-reader",
        savedAt: 4000,
        srsBox: 1,
        nextReviewAt: 4000,
        reviewCount: 0,
        lastReviewedAt: null,
        sourceContext: {
          surface: "popup_deep_read" as const,
          pageTitle: "Manual PDF",
          pageUrl: "https://cdn.example/manual.pdf",
          hostname: "pdf-reader",
          sentenceText: "manual-word",
          sentenceIndex: 1,
          ownedReadingItemId: "or_pdf_doc",
          ownedReadingSourceType: "pdf" as const,
          ownedReadingTitle: "Manual PDF",
          studyProgressRecordId: "https://cdn.example/manual.pdf",
        },
      },
      {
        id: "epub-entry",
        text: "chapter-word",
        url: "astra-local://epub/book.epub",
        hostname: "epub-reader",
        savedAt: 3900,
        srsBox: 1,
        nextReviewAt: 3900,
        reviewCount: 0,
        lastReviewedAt: null,
        sourceContext: {
          surface: "popup_deep_read" as const,
          pageTitle: "Book",
          pageUrl: "astra-local://epub/book.epub",
          hostname: "epub-reader",
          sentenceText: "chapter-word",
          sentenceIndex: 0,
          ownedReadingItemId: "or_epub_doc",
          ownedReadingSourceType: "epub" as const,
          ownedReadingTitle: "Book (book.epub)",
        },
      },
      {
        id: "subtitle-entry",
        text: "subtitle-word",
        url: "astra-local://subtitle/clip.srt",
        hostname: "subtitle-reader",
        savedAt: 3800,
        srsBox: 1,
        nextReviewAt: 3800,
        reviewCount: 0,
        lastReviewedAt: null,
        sourceContext: {
          surface: "subtitle_reader" as const,
          pageTitle: "clip.srt",
          pageUrl: "astra-local://subtitle/clip.srt",
          hostname: "subtitle-reader",
          sentenceText: "subtitle-word",
          sentenceIndex: 4,
          ownedReadingItemId: "or_subtitle_doc",
          ownedReadingSourceType: "subtitle-file" as const,
          ownedReadingTitle: "clip.srt · SRT · 8 items",
        },
      },
    ])
    listOwnedReadingItemsMock.mockResolvedValueOnce([
      {
        id: "or_pdf_doc",
        sourceType: "pdf" as const,
        title: "Manual PDF",
        sourceUrl: "https://cdn.example/manual.pdf",
        openedAt: 13_000,
        status: "saved" as const,
        progress: { fraction: 1 },
        readingHistoryRecordId: null,
        studyProgressRecordId: "https://cdn.example/manual.pdf",
      },
      {
        id: "or_epub_doc",
        sourceType: "epub" as const,
        title: "Book (book.epub)",
        sourceUrl: null,
        localUri: "astra-local://epub/book.epub",
        reopenHint: "Choose the same file in the ePub reader: book.epub",
        openedAt: 12_000,
        status: "saved" as const,
        progress: { chapterId: "chapter-1" },
        readingHistoryRecordId: null,
        studyProgressRecordId: null,
      },
      {
        id: "or_subtitle_doc",
        sourceType: "subtitle-file" as const,
        title: "clip.srt · SRT · 8 items",
        sourceUrl: null,
        localUri: "astra-local://subtitle/clip.srt",
        reopenHint: "Open the subtitle reader and choose the same file: clip.srt · continue from row 5",
        openedAt: 11_500,
        status: "saved" as const,
        progress: { sentenceIndex: 4 },
        readingHistoryRecordId: null,
        studyProgressRecordId: null,
      },
      {
        id: "or_broken_pdf",
        sourceType: "pdf" as const,
        title: "Missing PDF context",
        sourceUrl: null,
        openedAt: 11_000,
        status: "saved" as const,
        readingHistoryRecordId: null,
        studyProgressRecordId: null,
      },
    ])

    const readingBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Reading")
    await act(async () => {
      readingBtn!.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="reading-format-badge-or_pdf_doc"]')?.textContent).toBe("PDF")
    expect(container.querySelector('[data-testid="reading-format-badge-or_epub_doc"]')?.textContent).toBe("EPUB")
    expect(container.querySelector('[data-testid="reading-format-badge-or_subtitle_doc"]')?.textContent).toBe("Subtitle")
    expect(container.querySelector('[data-testid="reading-saved-count-or_pdf_doc"]')?.textContent).toBe("Saved vocabulary: 1 card")
    expect(container.querySelector('[data-testid="reading-saved-count-or_epub_doc"]')?.textContent).toBe("Saved vocabulary: 1 card")
    expect(container.querySelector('[data-testid="reading-saved-count-or_subtitle_doc"]')?.textContent).toBe("Saved vocabulary: 1 card")
    expect(container.querySelector('[data-testid="reading-saved-count-or_broken_pdf"]')?.textContent).toBe("Saved vocabulary: 0 cards")
    expect(container.textContent).toContain("Resume unavailable for this item.")
    expect((container.querySelector('[data-testid="reading-resume-or_broken_pdf"]') as HTMLButtonElement).disabled).toBe(true)

    const epubReviewButton = container.querySelector('[data-testid="reading-page-review-or_epub_doc"]') as HTMLButtonElement
    expect(epubReviewButton).toBeTruthy()

    await act(async () => {
      epubReviewButton.click()
      await Promise.resolve()
    })

    expect(openPageReviewLoopMock).toHaveBeenCalledWith("astra-local://epub/book.epub", "epub-entry")
  })

  it("exports Reading queue theme packs as a signed local JSON package", async () => {
    const readingBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Reading")
    await act(async () => {
      readingBtn!.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const exportButton = container.querySelector('[data-testid="reading-theme-pack-export"]') as HTMLButtonElement
    expect(exportButton).toBeTruthy()
    expect(exportButton.disabled).toBe(false)
    expect(exportButton.textContent).toBe("Export signed theme pack (2)")

    await act(async () => {
      exportButton.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(buildSignedOwnedReadingThemePackPackageMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "or_article_example" }),
        expect.objectContaining({ id: "or_subtitle_sample" }),
      ]),
      expect.arrayContaining([
        expect.objectContaining({ id: "entry-1" }),
        expect.objectContaining({ id: "entry-2" }),
      ]),
    )
    expect(createObjectURLMock).toHaveBeenCalledTimes(1)
    const blob = createObjectURLMock.mock.calls[0]?.[0] as Blob
    expect(blob.type).toBe("application/json;charset=utf-8")
    const payload = JSON.parse(String(lastDownloadBlobParts[0] ?? ""))
    expect(payload).toEqual(expect.objectContaining({
      schema: "astra-owned-reading-theme-pack-package.v3",
      signature: {
        algorithm: "SHA-256",
        value: "0".repeat(64),
      },
    }))
    expect(payload.payload.ownedReading.themePacks.map((pack: { id: string }) => pack.id)).toEqual([
      "theme_article-example-com",
      "theme_subtitle-file-local",
    ])
    expect(clickedDownloadAnchor?.download).toMatch(/^astra-reading-theme-pack-package-\d{4}-\d{2}-\d{2}\.json$/)
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:astra-reading-theme-packs")
  })

  it("opens the one-click local import picker for signed Reading theme-pack packages", async () => {
    const readingBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Reading")
    await act(async () => {
      readingBtn!.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const input = container.querySelector('[data-testid="reading-theme-pack-import-input"]') as HTMLInputElement
    const importButton = container.querySelector('[data-testid="reading-theme-pack-import"]') as HTMLButtonElement
    expect(input).toBeTruthy()
    expect(importButton).toBeTruthy()
    const clickSpy = vi.spyOn(input, "click").mockImplementation(() => {})

    await act(async () => {
      importButton.click()
      await Promise.resolve()
    })

    expect(clickSpy).toHaveBeenCalledTimes(1)
    clickSpy.mockRestore()
  })

  it("previews signed package conflicts and gates local import behind Apply or Cancel", async () => {
    previewOwnedReadingThemePackPackagePayloadMock.mockResolvedValueOnce({
      totalCount: 2,
      importedCount: 1,
      skippedCount: 1,
      newCount: 0,
      updatedCount: 1,
      conflicts: [{
        id: "or_article_example",
        title: "Example article",
        sourceType: "article",
        action: "update",
        existingUpdatedAt: 1000,
        incomingUpdatedAt: 2000,
      }],
      rollback: { restoreCount: 1, removeCount: 0 },
      verified: true,
    })
    previewVocabularyEntriesFromThemePackPayloadMock.mockResolvedValueOnce({
      totalCount: 2,
      importedCount: 1,
      skippedCount: 1,
      conflicts: [{ id: "entry-1", text: "ephemeral", reason: "id" }],
      rollback: { removeCount: 1 },
    })

    const readingBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Reading")
    await act(async () => {
      readingBtn!.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const input = container.querySelector('[data-testid="reading-theme-pack-import-input"]') as HTMLInputElement
    const signedPackage = {
      schema: "astra-owned-reading-theme-pack-package.v3",
      generatedAt: "2026-04-29T00:00:00.000Z",
      payload: { schema: "astra-owned-reading-theme-pack-payload.v3" },
      signature: { algorithm: "SHA-256", value: "0".repeat(64) },
    }
    const file = { text: vi.fn().mockResolvedValue(JSON.stringify(signedPackage)) } as unknown as File

    await act(async () => {
      Object.defineProperty(input, "files", { configurable: true, value: [file] })
      input.dispatchEvent(new Event("change", { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(parseSignedOwnedReadingThemePackPackageMock).toHaveBeenCalled()
    expect(verifyOwnedReadingThemePackPackageMock).toHaveBeenCalled()
    expect(previewOwnedReadingThemePackPackagePayloadMock).toHaveBeenCalledWith(signedPackage.payload)
    expect(previewVocabularyEntriesFromThemePackPayloadMock).toHaveBeenCalledWith(signedPackage.payload)
    expect(importOwnedReadingThemePackPackagePayloadMock).not.toHaveBeenCalled()
    expect(importVocabularyEntriesFromThemePackPayloadMock).not.toHaveBeenCalled()
    expect(container.querySelector('[data-testid="reading-theme-pack-import-preview"]')?.textContent).toContain("Reading preview: add 0, update 1, skip 1.")
    expect(container.querySelector('[data-testid="reading-theme-pack-import-conflicts"]')?.textContent).toContain("update Example article")
    expect(container.querySelector('[data-testid="reading-theme-pack-import-rollback-preview"]')?.textContent).toContain("restore 1 updated reading item")

    const cancelButton = container.querySelector('[data-testid="reading-theme-pack-import-cancel"]') as HTMLButtonElement
    await act(async () => {
      cancelButton.click()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="reading-theme-pack-import-preview"]')).toBeNull()
    expect(container.querySelector('[data-testid="reading-theme-pack-import-status"]')?.textContent).toContain("canceled")
    expect(importOwnedReadingThemePackPackagePayloadMock).not.toHaveBeenCalled()
    expect(importVocabularyEntriesFromThemePackPayloadMock).not.toHaveBeenCalled()

    await act(async () => {
      Object.defineProperty(input, "files", { configurable: true, value: [file] })
      input.dispatchEvent(new Event("change", { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const applyButton = container.querySelector('[data-testid="reading-theme-pack-import-apply"]') as HTMLButtonElement
    await act(async () => {
      applyButton.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(importOwnedReadingThemePackPackagePayloadMock).toHaveBeenCalledWith(signedPackage.payload)
    expect(importVocabularyEntriesFromThemePackPayloadMock).toHaveBeenCalledWith(signedPackage.payload)
    expect(container.querySelector('[data-testid="reading-theme-pack-import-preview"]')).toBeNull()
    expect(container.querySelector('[data-testid="reading-theme-pack-import-status"]')?.textContent).toContain("Imported 2 reading item(s)")
  })

  it("sorts reading list by title when Title A–Z is selected", async () => {
    listOwnedReadingItemsMock.mockResolvedValueOnce([
      {
        id: "or_z",
        sourceType: "article",
        title: "Zebra notes",
        sourceUrl: "https://example.com/z",
        openedAt: 99_000,
        status: "saved",
        readingHistoryRecordId: "https://example.com/z",
        studyProgressRecordId: null,
      },
      {
        id: "or_a",
        sourceType: "article",
        title: "Alpha notes",
        sourceUrl: "https://example.com/a",
        openedAt: 1_000,
        status: "saved",
        readingHistoryRecordId: "https://example.com/a",
        studyProgressRecordId: null,
      },
    ])

    const readingBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Reading")
    await act(async () => {
      readingBtn!.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    const titleSort = container.querySelector("[data-testid=\"reading-sort-title\"]") as HTMLButtonElement
    expect(titleSort).toBeTruthy()

    await act(async () => {
      titleSort.click()
      await Promise.resolve()
    })

    const idxAlpha = container.textContent!.indexOf("Alpha notes")
    const idxZebra = container.textContent!.indexOf("Zebra notes")
    expect(idxAlpha).toBeGreaterThan(-1)
    expect(idxZebra).toBeGreaterThan(-1)
    expect(idxAlpha).toBeLessThan(idxZebra)
  })
})
