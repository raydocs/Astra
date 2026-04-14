import { act } from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  getVocabularyEntriesMock,
  updateVocabularyEntryMock,
  recordStudyEventMock,
  buildVocabularyReviewStudyEventMock,
  getStudyProgressMock,
  deriveStudyLoopViewModelMock,
  listOwnedReadingItemsMock,
  markOwnedReadingOpenedMock,
} = vi.hoisted(() => ({
  getVocabularyEntriesMock: vi.fn(),
  updateVocabularyEntryMock: vi.fn(),
  recordStudyEventMock: vi.fn(),
  buildVocabularyReviewStudyEventMock: vi.fn(),
  getStudyProgressMock: vi.fn(),
  deriveStudyLoopViewModelMock: vi.fn(),
  listOwnedReadingItemsMock: vi.fn(),
  markOwnedReadingOpenedMock: vi.fn(),
}))

vi.mock("@/utils/storage/vocabulary", () => ({
  getVocabularyEntries: getVocabularyEntriesMock,
  updateVocabularyEntry: updateVocabularyEntryMock,
}))

vi.mock("@/utils/storage/study-progress", () => ({
  buildVocabularyReviewStudyEvent: buildVocabularyReviewStudyEventMock,
  deriveStudyLoopViewModel: deriveStudyLoopViewModelMock,
  recordStudyEvent: recordStudyEventMock,
  getStudyProgress: getStudyProgressMock,
}))

vi.mock("@/utils/storage/owned-reading", () => ({
  listOwnedReadingItems: listOwnedReadingItemsMock,
  markOwnedReadingOpened: markOwnedReadingOpenedMock,
  matchOwnedReadingItemForVocabularyEntry: (items: Array<{ id: string }>, entry: { sourceContext?: { ownedReadingItemId?: string } }) => items.find((item) => item.id === entry.sourceContext?.ownedReadingItemId) ?? null,
  buildOwnedReadingResumeTarget: (item: { id: string; sourceType: string; sourceUrl?: string | null; reopenHint?: string | null; readingHistoryRecordId?: string | null; studyProgressRecordId?: string | null }) => {
    if (item.sourceType === "article") {
      const url = item.readingHistoryRecordId ?? item.sourceUrl ?? item.studyProgressRecordId
      return url ? { url, sourceType: "article", mode: "direct", requiresFileSelection: false } : null
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
  describeOwnedReadingResumeBehavior: (item: { sourceType: string }) => item.sourceType === "article"
    ? "Resumes the source article directly."
    : "Opens the subtitle reader and prompts for the same file again.",
  describeOwnedReadingProgress: (item: { sourceType: string; progress?: { sentenceIndex?: number } }) => item.sourceType === "subtitle-file" && typeof item.progress?.sentenceIndex === "number"
    ? `Last row: ${item.progress.sentenceIndex + 1}`
    : null,
  getOwnedReadingSourceTypeLabel: (sourceType: string) => sourceType === "subtitle-file" ? "Subtitle file" : "Article",
}))

vi.mock("#imports", () => ({
  browser: {
    tabs: {
      create: vi.fn(),
    },
  },
}))

vi.mock("@/utils/i18n", () => ({
  t: (key: string, sub?: string | string[]) => {
    const s = typeof sub === "string" ? sub : ""
    if (key === "review_todayProgressTitle") return "Today's study loop"
    if (key === "review_todayProgressAria") return "Today's study progress summary"
    if (key === "review_currentPageProgressTitle") return "Current page loop"
    if (key === "review_currentPageProgressHint") return "These counts use the same page-level study rules as the popup."
    if (key === "popup_studyStatPages") return `${s} pages`
    if (key === "popup_studyStatExplained") return `${s} explained`
    if (key === "popup_studyStatSaved") return `${s} saved`
    if (key === "popup_studyStatReviewed") return `${s} reviewed`
    if (key === "review_openSourcePage") return "Open source page"
    if (key === "review_showFullContext") return "Show full context"
    if (key === "review_hideFullContext") return "Show less"
    return key
  },
}))

import { browser } from "#imports"
import ReviewMode from "./ReviewMode"

describe("ReviewMode", () => {
  let container: HTMLDivElement
  let root: ReactDOM.Root

  beforeEach(async () => {
    vi.clearAllMocks()

    const entry = {
      id: "entry-1",
      text: "ephemeral",
      explanation: "Short-lived in the article context.",
      context: `${"A long saved context line. ".repeat(25)}end`,
      url: "https://example.com/article?from=review",
      hostname: "example.com",
      savedAt: 1000,
      srsBox: 1,
      nextReviewAt: 0,
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
    }
    const subtitleEntry = {
      id: "entry-2",
      text: "subtitle-word",
      translation: "字幕词",
      explanation: "Points back to the subtitle-reader row.",
      context: "sample.srt · row 2",
      url: "astra-local://subtitle/sample.srt",
      hostname: "subtitle-reader",
      savedAt: 900,
      srsBox: 1,
      nextReviewAt: 0,
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
    }

    getVocabularyEntriesMock.mockResolvedValue([entry, subtitleEntry])
    updateVocabularyEntryMock.mockResolvedValue(entry)
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
        studyProgressRecordId: null,
      },
    ])
    markOwnedReadingOpenedMock.mockResolvedValue(undefined)
    buildVocabularyReviewStudyEventMock.mockReturnValue({
      url: "https://example.com/article",
      hostname: "example.com",
      title: "Example article",
      step: "vocab_review",
    })
    recordStudyEventMock.mockResolvedValue(undefined)
    getStudyProgressMock.mockResolvedValue({
      pages: [],
      dailyStats: {
        date: "2026-04-13",
        pagesStudied: 2,
        sentencesExplained: 3,
        vocabSaved: 1,
        vocabReviewed: 4,
      },
    })
    deriveStudyLoopViewModelMock.mockReturnValue({
      currentPage: {
        url: "https://example.com/article",
        hostname: "example.com",
        title: "Example article",
        completedSteps: ["read", "guided_read", "explain", "vocab_save"],
        sentencesExplained: 3,
        vocabSaved: 1,
        vocabReviewed: 1,
        startedAt: 1000,
        lastActivityAt: 2000,
      },
      completedSteps: ["read", "guided_read", "explain", "vocab_save"],
      currentCounts: { sentencesExplained: 3, vocabSaved: 1, vocabReviewed: 1 },
      nextStep: "vocab_review",
      completionPercent: 80,
      dailyStats: {
        date: "2026-04-13",
        pagesStudied: 2,
        sentencesExplained: 3,
        vocabSaved: 1,
        vocabReviewed: 4,
      },
      recentPages: [],
    })

    container = document.createElement("div")
    document.body.appendChild(container)
    root = ReactDOM.createRoot(container)

    await act(async () => {
      root.render(<ReviewMode />)
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

  it("shows popup deep-read source context on the back of the card and records vocab review progress", async () => {
    const flashcard = container.querySelector('[role="button"]') as HTMLDivElement
    expect(flashcard).toBeTruthy()

    await act(async () => {
      flashcard.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain("Today's study loop")
    expect(container.textContent).toContain("Current page loop")
    expect(container.textContent).toContain("These counts use the same page-level study rules as the popup.")
    expect(container.textContent).toContain("80% — popup_studyStepRead → popup_studyStepGuidedRead → popup_studyStepExplain → popup_studyStepSaveWords")
    expect(container.textContent).toContain("3 explained")
    expect(container.textContent).toContain("1 saved")
    expect(container.textContent).toContain("1 reviewed")
    expect(container.textContent).toContain("Popup deep-read")
    expect(container.textContent).toContain("Example article")
    expect(container.textContent).toContain("The ephemeral phase passes quickly.")
    expect(container.textContent).toContain("Excerpt: The ephemeral phase passes quickly. Another sentence follows.")
    expect(container.textContent).toContain("Host: example.com")
    expect(container.textContent).toContain("Reading asset")
    expect(container.textContent).toContain("Example article · Article")
    expect(container.textContent).toContain("Resumes the source article directly.")

    const sourceLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open source page") as HTMLAnchorElement
    expect(sourceLink).toBeTruthy()
    expect(sourceLink.href).toBe("https://example.com/article")

    const resumeButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Resume reading asset") as HTMLButtonElement
    expect(resumeButton).toBeTruthy()

    await act(async () => {
      resumeButton.click()
      await Promise.resolve()
    })

    expect(markOwnedReadingOpenedMock).toHaveBeenCalledWith("or_article_example")
    expect(browser.tabs.create).toHaveBeenCalledWith({ url: "https://example.com/article" })

    const knowItButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Know it") as HTMLButtonElement
    expect(knowItButton).toBeTruthy()

    await act(async () => {
      knowItButton.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(updateVocabularyEntryMock).toHaveBeenCalled()
    expect(buildVocabularyReviewStudyEventMock).toHaveBeenCalled()
    expect(recordStudyEventMock).toHaveBeenCalledWith(expect.objectContaining({
      url: "https://example.com/article",
      step: "vocab_review",
    }))
  })

  it("shows subtitle-reader continuity on the second review card and reopens the linked subtitle-file asset", async () => {
    const flashcard = container.querySelector('[role="button"]') as HTMLDivElement
    expect(flashcard).toBeTruthy()

    await act(async () => {
      flashcard.click()
      await Promise.resolve()
    })

    const knowItButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Know it") as HTMLButtonElement
    expect(knowItButton).toBeTruthy()

    await act(async () => {
      knowItButton.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    const nextFlashcard = container.querySelector('[role="button"]') as HTMLDivElement
    await act(async () => {
      nextFlashcard.click()
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
    expect(container.textContent).toContain("Opens the subtitle reader and prompts for the same file again.")

    const resumeButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Resume reading asset") as HTMLButtonElement
    expect(resumeButton).toBeTruthy()

    await act(async () => {
      resumeButton.click()
      await Promise.resolve()
    })

    expect(markOwnedReadingOpenedMock).toHaveBeenCalledWith("or_subtitle_sample")
    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: "chrome-extension://test-id/subtitle-reader.html?reopenHint=Open%20the%20subtitle%20reader%20and%20choose%20the%20same%20file%3A%20sample.srt%20%C2%B7%20continue%20from%20row%202",
    })
  })
})
