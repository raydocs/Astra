import { act } from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  getVocabularyEntriesMock,
  removeVocabularyEntryMock,
  getDueVocabularyCountMock,
  updateVocabularyEntryMock,
  getReadingHistoryEntryMock,
  getPageStudyProgressMock,
  getStudyProgressMock,
  syncRecentReadingHistoryToOwnedQueueMock,
  listOwnedReadingItemsMock,
  markOwnedReadingOpenedMock,
  setOwnedReadingStatusMock,
  removeOwnedReadingItemMock,
} = vi.hoisted(() => ({
  getVocabularyEntriesMock: vi.fn(),
  removeVocabularyEntryMock: vi.fn(),
  getDueVocabularyCountMock: vi.fn(),
  updateVocabularyEntryMock: vi.fn(),
  getReadingHistoryEntryMock: vi.fn(),
  getPageStudyProgressMock: vi.fn(),
  getStudyProgressMock: vi.fn(),
  syncRecentReadingHistoryToOwnedQueueMock: vi.fn(),
  listOwnedReadingItemsMock: vi.fn(),
  markOwnedReadingOpenedMock: vi.fn(),
  setOwnedReadingStatusMock: vi.fn(),
  removeOwnedReadingItemMock: vi.fn(),
}))

vi.mock("@/utils/storage/vocabulary", () => ({
  getVocabularyEntries: getVocabularyEntriesMock,
  removeVocabularyEntry: removeVocabularyEntryMock,
  getDueVocabularyCount: getDueVocabularyCountMock,
  updateVocabularyEntry: updateVocabularyEntryMock,
}))

vi.mock("@/utils/storage/owned-reading", () => {
  const deriveOwnedReadingArticleUrl = (item: { sourceType: string; readingHistoryRecordId?: string | null; sourceUrl?: string | null; studyProgressRecordId?: string | null }) => {
    if (item.sourceType !== "article") return null
    return item.readingHistoryRecordId ?? item.sourceUrl ?? item.studyProgressRecordId ?? null
  }

  return {
    deriveOwnedReadingArticleUrl,
    buildOwnedReadingResumeTarget: (item: { sourceType: string; sourceUrl?: string | null; reopenHint?: string | null; readingHistoryRecordId?: string | null; studyProgressRecordId?: string | null }) => {
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
    describeOwnedReadingResumeBehavior: (item: { sourceType: string; sourceUrl?: string | null }) => {
      if (item.sourceType === "article") return "Resumes the source article directly."
      if (item.sourceType === "pdf" && item.sourceUrl?.startsWith("http")) return "Opens the saved remote PDF in the PDF reader."
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
      if (entry.sourceContext?.ownedReadingSourceType === "subtitle-file" && pageUrl) {
        return items.find((item) => item.sourceType === "subtitle-file" && item.localUri === pageUrl) ?? null
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

vi.mock("@/utils/storage/study-progress", () => ({
  deriveStudyLoopPageSummary: (page: { completedSteps?: string[]; sentencesExplained?: number; vocabSaved?: number; vocabReviewed?: number } | null) => {
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
  },
  getPageStudyProgress: getPageStudyProgressMock,
  getStudyProgress: getStudyProgressMock,
}))

vi.mock("#imports", () => ({
  browser: {
    runtime: {
      getURL: vi.fn((path: string) => `chrome-extension://test-id${path}`),
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
    window.history.replaceState({}, "", "/vocabulary.html")

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

  it("renders popup deep-read source context in the vocabulary list", async () => {
    expect(container.textContent).toContain("Popup deep-read")
    expect(container.textContent).toContain("Example article")
    expect(container.textContent).toContain("The ephemeral phase passes quickly.")

    const sourceBadge = Array.from(container.querySelectorAll("div")).find((node) => node.textContent?.trim() === "Popup deep-read") as HTMLDivElement
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
