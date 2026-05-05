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
  openVocabularyEntryInDeepReadMock,
  commitLearningContinuitySyncMock,
  recordLearningLoopEventMock,
} = vi.hoisted(() => ({
  getVocabularyEntriesMock: vi.fn(),
  updateVocabularyEntryMock: vi.fn(),
  recordStudyEventMock: vi.fn(),
  buildVocabularyReviewStudyEventMock: vi.fn(),
  getStudyProgressMock: vi.fn(),
  deriveStudyLoopViewModelMock: vi.fn(),
  listOwnedReadingItemsMock: vi.fn(),
  markOwnedReadingOpenedMock: vi.fn(),
  openVocabularyEntryInDeepReadMock: vi.fn(),
  commitLearningContinuitySyncMock: vi.fn(),
  recordLearningLoopEventMock: vi.fn(),
}))

vi.mock("@/utils/storage/vocabulary", () => ({
  getVocabularyEntries: getVocabularyEntriesMock,
  updateVocabularyEntry: updateVocabularyEntryMock,
  sanitizeVocabularyUrl: (url?: string | null) => {
    const trimmed = url?.trim()
    if (!trimmed) return undefined
    try {
      const parsed = new URL(trimmed)
      parsed.search = ""
      parsed.hash = ""
      return parsed.toString()
    } catch {
      return trimmed
    }
  },
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

vi.mock("@/utils/deep-read-link", () => ({
  openVocabularyEntryInDeepRead: openVocabularyEntryInDeepReadMock,
}))

vi.mock("@/utils/extension/messages", () => ({
  commitLearningContinuitySync: commitLearningContinuitySyncMock,
}))

vi.mock("@/utils/learning-loop-events", () => ({
  recordLearningLoopEvent: recordLearningLoopEventMock,
}))

vi.mock("@/utils/i18n", () => ({
  t: (key: string, sub?: string | string[]) => {
    const values = Array.isArray(sub) ? sub : sub ? [sub] : []
    const s = typeof sub === "string" ? sub : values[0] ?? ""
    if (key === "review_todayProgressTitle") return "Today's study loop"
    if (key === "review_todayProgressAria") return "Today's study progress summary"
    if (key === "popup_studyTodayStatsInfoAction") return "How it resets"
    if (key === "popup_studyTodayStatsHint") return `Local calendar day: ${s}`
    if (key === "popup_studyTodayStatsResetBoundary") return "These counts follow your local calendar day and reset at local midnight on this device, not at UTC midnight."
    if (key === "review_currentPageProgressTitle") return "Current page loop"
    if (key === "review_currentPageProgressHint") return "These counts use the same page-level study rules as the popup."
    if (key === "popup_studyStatPages") return `${s} pages`
    if (key === "popup_studyStatExplained") return `${s} explained`
    if (key === "popup_studyStatSaved") return `${s} saved`
    if (key === "popup_studyStatReviewed") return `${s} reviewed`
    if (key === "review_openSourcePage") return "Open source page"
    if (key === "review_showFullContext") return "Show full context"
    if (key === "review_hideFullContext") return "Show less"
    if (key === "vocabulary_readingAssetTitle") return "Reading asset"
    if (key === "vocabulary_actionResumeReadingAsset") return "Resume reading asset"
    if (key === "vocabulary_actionOpenDeepRead") return "Open in deep read"
    if (key === "vocabulary_sourceHostLabel") return "Host:"
    if (key === "vocabulary_sourceUrlLabel") return "URL:"
    if (key === "vocabulary_sourceFileLabel") return "File:"
    if (key === "vocabulary_sourceExcerptLabel") return "Excerpt:"
    if (key === "vocabulary_sourceSummaryLabel") return "Summary:"
    if (key === "review_emptyCaughtUpTitle") return "All caught up!"
    if (key === "review_emptyCaughtUpHint") return "No cards due for review. Check back later."
    if (key === "review_focusedFallbackMissingCard") return "Saved card was not found; showing due review instead."
    if (key === "review_pageLoopNoCards") return "No saved cards were found for this page."
    if (key === "review_returnToDeepReadSentence") return "Return to this sentence in Deep Read"
    if (key === "review_resumeReadingThisPage") return "Resume reading this page"
    if (key === "review_focusedCompleteTitle") return "Sentence review complete"
    if (key === "review_focusedCompleteHint") return "Close the loop by reopening the original sentence context."
    if (key === "review_pageLoopCompleteTitle") return "Page review complete"
    if (key === "review_pageLoopCompleteHint") return "You reviewed the saved cards from this page. Return to Deep Read to keep going."
    if (key === "review_sessionCompleteTitle") return "Session Complete"
    if (key === "review_summaryCardsReviewed") return "Cards reviewed"
    if (key === "review_summaryCorrect") return "Correct (promoted)"
    if (key === "review_summaryIncorrect") return "Incorrect (demoted)"
    if (key === "review_actionReviewAgain") return "Review again"
    if (key === "review_cardProgress") return `Card ${values[0] ?? "$1"} of ${values[1] ?? "$2"}`
    if (key === "review_boxLabel") return `Box ${values[0] ?? "$1"}`
    if (key === "review_flipHint") return "Click or press Space to reveal"
    if (key === "review_answerDontKnow") return "Don't know"
    if (key === "review_answerKnowIt") return "Know it"
    if (key === "review_keyboardHintFront") return "Space = flip"
    if (key === "review_keyboardHintBack") return "← = don't know · → = know it"
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
    window.history.pushState({}, "", "/vocabulary.html?tab=review")

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
        languageLevel: "beginner",
        explainMode: "exam",
        matchedGlossaryTerms: [{ sourceTerm: "ephemeral", preferredTerm: "短暂" }],
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
      personalizedStrategy: {
        id: "review_saved_context",
        label: "Review this page’s saved context",
        hint: "Finish the loop by reviewing at least one saved card from this page while the source context is still fresh.",
        focusStep: "vocab_review",
        trigger: "saved_more_than_reviewed",
        progressSignature: "read>guided_read>explain>vocab_save|next:vocab_review|e:3|s:1|r:1|pct:80",
        evidence: "1 saved · 1 reviewed",
      },
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
    expect(container.querySelector('[data-testid="review-personalized-strategy-card"]')?.textContent).toContain("Review this page’s saved context")
    expect(container.textContent).toContain("Finish the loop by reviewing at least one saved card from this page while the source context is still fresh.")
    expect(container.textContent).toContain("Popup deep-read")
    expect(container.querySelector('[data-testid="review-explain-profile"]')?.textContent).toBe("Explain profile: Exam · Beginner")
    expect(container.querySelector('[data-testid="review-glossary-evidence"]')?.textContent).toBe("Glossary applied: ephemeral → 短暂")
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

    const deepReadButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Open in deep read") as HTMLButtonElement
    expect(deepReadButton).toBeTruthy()

    await act(async () => {
      deepReadButton.click()
      await Promise.resolve()
    })

    expect(openVocabularyEntryInDeepReadMock).toHaveBeenCalledWith(expect.objectContaining({
      id: "entry-1",
    }))

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
    expect(recordLearningLoopEventMock).toHaveBeenCalledWith("review_answered", expect.objectContaining({
      pageUrl: "https://example.com/article",
      psarEligible: true,
      personalizedStrategyApplied: true,
      personalizedStrategyId: "review_saved_context",
      personalizedStrategyTrigger: "saved_more_than_reviewed",
      personalizedStrategyFocusStep: "vocab_review",
    }))
    expect(commitLearningContinuitySyncMock).toHaveBeenCalledWith("review-answer")
  })

  it("loads page-loop cards from the same page, includes not-due saves, and places the clicked entry first", async () => {
    await act(async () => {
      root.unmount()
      await Promise.resolve()
    })
    root = ReactDOM.createRoot(container)
    vi.clearAllMocks()
    window.history.pushState(
      {},
      "",
      "/vocabulary.html?tab=review&loop=page&studyUrl=https%3A%2F%2Fexample.com%2Farticle%3Ffrom%3Dpopup%23section&entryId=entry-new",
    )

    const oldDueEntry = {
      id: "entry-old",
      text: "older same-page card",
      explanation: "Due card from this article.",
      context: "Earlier context",
      url: "https://example.com/article?from=old",
      hostname: "example.com",
      savedAt: 1000,
      srsBox: 1,
      nextReviewAt: 0,
      reviewCount: 0,
      lastReviewedAt: null,
      sourceContext: {
        surface: "popup_deep_read" as const,
        pageTitle: "Example article",
        pageUrl: "https://example.com/article?from=old",
        hostname: "example.com",
        sentenceText: "older same-page card",
        sentenceIndex: 0,
        studyProgressRecordId: "https://example.com/article",
      },
    }
    const newNotDueEntry = {
      id: "entry-new",
      text: "newly saved not due card",
      explanation: "Fresh save should still appear in page loop.",
      context: "Fresh context",
      url: "https://example.com/article?from=fresh",
      hostname: "example.com",
      savedAt: 2000,
      srsBox: 2,
      nextReviewAt: Date.now() + 86_400_000,
      reviewCount: 1,
      lastReviewedAt: Date.now(),
      sourceContext: {
        surface: "popup_deep_read" as const,
        pageTitle: "Example article",
        pageUrl: "https://example.com/article?from=fresh",
        hostname: "example.com",
        sentenceText: "newly saved not due card",
        sentenceIndex: 2,
        ownedReadingItemId: "or_article_example",
        ownedReadingSourceType: "article" as const,
        ownedReadingTitle: "Example article",
        studyProgressRecordId: "https://example.com/article",
      },
    }
    const otherPageEntry = {
      ...oldDueEntry,
      id: "entry-other-page",
      text: "other page card",
      url: "https://other.example/article",
      sourceContext: {
        ...oldDueEntry.sourceContext,
        pageUrl: "https://other.example/article",
        studyProgressRecordId: "https://other.example/article",
      },
    }

    getVocabularyEntriesMock.mockResolvedValue([oldDueEntry, newNotDueEntry, otherPageEntry])
    updateVocabularyEntryMock.mockResolvedValue(newNotDueEntry)
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
    ])
    buildVocabularyReviewStudyEventMock.mockImplementation((entry: { id: string }) => ({
      url: "https://example.com/article",
      hostname: "example.com",
      title: "Example article",
      step: "vocab_review",
      entryId: entry.id,
    }))
    recordStudyEventMock.mockResolvedValue(undefined)
    getStudyProgressMock.mockResolvedValue({
      pages: [],
      dailyStats: {
        date: "2026-04-13",
        pagesStudied: 1,
        sentencesExplained: 1,
        vocabSaved: 2,
        vocabReviewed: 0,
      },
    })
    deriveStudyLoopViewModelMock.mockReturnValue({
      currentPage: null,
      completedSteps: [],
      currentCounts: { sentencesExplained: 0, vocabSaved: 0, vocabReviewed: 0 },
      nextStep: null,
      completionPercent: 0,
      dailyStats: null,
      recentPages: [],
    })

    await act(async () => {
      root.render(<ReviewMode />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain("newly saved not due card")
    expect(container.textContent).not.toContain("other page card")
    expect(deriveStudyLoopViewModelMock).toHaveBeenCalledWith(expect.anything(), "https://example.com/article?from=popup#section")

    const firstFlashcard = container.querySelector('[role="button"]') as HTMLDivElement
    await act(async () => {
      firstFlashcard.click()
      await Promise.resolve()
    })

    const knowItButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Know it") as HTMLButtonElement
    await act(async () => {
      knowItButton.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(updateVocabularyEntryMock).toHaveBeenCalledWith("entry-new", expect.any(Object))
    expect(container.textContent).toContain("older same-page card")

    const secondFlashcard = container.querySelector('[role="button"]') as HTMLDivElement
    await act(async () => {
      secondFlashcard.click()
      await Promise.resolve()
    })

    const secondKnowItButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Know it") as HTMLButtonElement
    await act(async () => {
      secondKnowItButton.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain("Page review complete")

    const returnToDeepReadButton = container.querySelector('[data-testid="review-return-deep-read"]') as HTMLButtonElement
    expect(returnToDeepReadButton).toBeTruthy()

    const resumePageButton = container.querySelector('[data-testid="review-resume-page-reading"]') as HTMLButtonElement
    expect(resumePageButton).toBeTruthy()
    expect(resumePageButton.textContent).toBe("Resume reading this page")

    await act(async () => {
      returnToDeepReadButton.click()
      await Promise.resolve()
    })
    expect(openVocabularyEntryInDeepReadMock).toHaveBeenCalledWith(expect.objectContaining({
      id: "entry-new",
    }))

    await act(async () => {
      resumePageButton.click()
      await Promise.resolve()
    })

    expect(markOwnedReadingOpenedMock).toHaveBeenCalledWith("or_article_example")
    expect(browser.tabs.create).toHaveBeenCalledWith({ url: "https://example.com/article" })
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

  it("explains the daily stats reset boundary on the review surface", async () => {
    const infoButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "How it resets") as HTMLButtonElement
    expect(infoButton).toBeTruthy()

    await act(async () => {
      infoButton.click()
      await Promise.resolve()
    })

    expect(container.textContent).toContain("Local calendar day: Apr 13, 2026")
    expect(container.textContent).toContain("local midnight on this device")
  })
})
