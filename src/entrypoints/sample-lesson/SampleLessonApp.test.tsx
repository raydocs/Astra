import { act } from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  commitLearningContinuitySyncMock,
  saveVocabularyEntryMock,
  recordLearningLoopEventMock,
  shareMock,
  upsertOwnedArticleFromUrlMock,
} = vi.hoisted(() => ({
  commitLearningContinuitySyncMock: vi.fn(),
  saveVocabularyEntryMock: vi.fn(),
  recordLearningLoopEventMock: vi.fn(),
  shareMock: vi.fn(),
  upsertOwnedArticleFromUrlMock: vi.fn(),
}))

vi.mock("@/utils/extension/messages", () => ({
  commitLearningContinuitySync: commitLearningContinuitySyncMock,
}))

vi.mock("@/utils/storage/owned-reading", () => ({
  upsertOwnedArticleFromUrl: upsertOwnedArticleFromUrlMock,
}))

vi.mock("@/utils/storage/vocabulary", () => ({
  saveVocabularyEntry: saveVocabularyEntryMock,
}))

vi.mock("@/utils/learning-loop-events", () => ({
  recordLearningLoopEvent: recordLearningLoopEventMock,
}))

import SampleLessonApp from "./SampleLessonApp"

describe("SampleLessonApp", () => {
  let container: HTMLDivElement
  let root: ReactDOM.Root

  beforeEach(async () => {
    vi.clearAllMocks()
    shareMock.mockResolvedValue(undefined)
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: shareMock,
    })
    commitLearningContinuitySyncMock.mockResolvedValue({ ok: true })
    upsertOwnedArticleFromUrlMock.mockResolvedValue({
      id: "sample-source-1",
      sourceType: "article",
      title: "Astra Sample Lesson: The Quiet Architecture of Reading",
      sourceUrl: "astra-sample://first-lesson/quiet-reading",
      localUri: null,
      openedAt: 1_000,
      updatedAt: 1_000,
      status: "saved",
      readingHistoryRecordId: "astra-sample://first-lesson/quiet-reading",
      studyProgressRecordId: null,
    })
    saveVocabularyEntryMock.mockImplementation(async (entry) => ({
      ...entry,
      id: "sample-entry-1",
      savedAt: 1_000,
    }))
    const browser = (globalThis as unknown as { __ASTRA_TEST_BROWSER__: any }).__ASTRA_TEST_BROWSER__
    browser.runtime.getURL.mockImplementation((path: string) => path)

    container = document.createElement("div")
    document.body.appendChild(container)
    root = ReactDOM.createRoot(container)

    await act(async () => {
      root.render(<SampleLessonApp />)
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

  function buttonByText(text: string) {
    return Array.from(container.querySelectorAll("button")).find((button) => button.textContent === text) as HTMLButtonElement | undefined
  }

  it("guides the sample lesson from understood content to saved card and one-card review", async () => {
    expect(container.textContent).toContain("Try Astra on a sample page")
    expect(container.textContent).toContain("The Quiet Architecture of Reading")
    expect(container.textContent?.toLowerCase()).not.toContain("api key")
    expect(container.textContent?.toLowerCase()).not.toContain("model")
    expect(container.textContent?.toLowerCase()).not.toContain("provider")
    expect(container.querySelector('[data-testid="sample-lesson-recommended-sentence"]')?.textContent)
      .toContain("To inhabit a difficult sentence")
    expect(recordLearningLoopEventMock).toHaveBeenCalledWith("sample_started", expect.objectContaining({
      source: "sample_lesson",
      contentType: "sample_article",
    }))
    expect(recordLearningLoopEventMock).toHaveBeenCalledWith("first_content_understood", expect.objectContaining({
      source: "sample_lesson",
      contentType: "sample_article",
    }))

    await act(async () => {
      buttonByText("Save 3 expressions for review")?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(upsertOwnedArticleFromUrlMock).toHaveBeenCalledWith({
      url: "astra-sample://first-lesson/quiet-reading",
      title: "Astra Sample Lesson: The Quiet Architecture of Reading",
      status: "saved",
    })
    expect(saveVocabularyEntryMock).toHaveBeenCalledWith(expect.objectContaining({
      text: "inhabit a difficult sentence",
      url: "astra-sample://first-lesson/quiet-reading",
      sourceContext: expect.objectContaining({
        surface: "sample_lesson",
        pageTitle: "Astra Sample Lesson: The Quiet Architecture of Reading",
        sentenceText: expect.stringContaining("difficult sentence"),
        ownedReadingItemId: "sample-source-1",
        ownedReadingSourceType: "article",
        ownedReadingTitle: "Astra Sample Lesson: The Quiet Architecture of Reading",
      }),
    }))
    expect(recordLearningLoopEventMock).toHaveBeenCalledWith("saved_snippet_created", expect.objectContaining({
      source: "sample_lesson",
      hasReviewCard: true,
    }))
    expect(container.querySelector('[data-testid="sample-lesson-saved-step"]')?.textContent)
      .toContain("你刚刚创建了 3 个学习卡片")
    expect(container.querySelector('[data-testid="sample-lesson-source-handoff"]')?.textContent)
      .toContain("Source added to Library")
    expect(commitLearningContinuitySyncMock).toHaveBeenCalledWith("sample-lesson-first-cards-saved")

    await act(async () => {
      buttonByText("Start review")?.click()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="sample-lesson-review-step"]')?.textContent)
      .toContain("Review card 1 of 3")

    await act(async () => {
      buttonByText("I reviewed this — next card")?.click()
      await Promise.resolve()
    })
    await act(async () => {
      buttonByText("I reviewed this — next card")?.click()
      await Promise.resolve()
    })
    await act(async () => {
      buttonByText("I reviewed this card")?.click()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="sample-lesson-complete-step"]')?.textContent)
      .toContain("First review complete")
    expect(container.querySelector('[data-testid="sample-lesson-complete-source-handoff"]')?.textContent)
      .toContain("sample source")
    expect(container.querySelector('[data-testid="sample-lesson-real-page-hint"]')?.textContent)
      .toContain("supported video")
    expect(recordLearningLoopEventMock).toHaveBeenCalledWith("review_session_completed", expect.objectContaining({
      source: "sample_lesson",
      cardCount: 3,
      firstReview: true,
    }))
    expect(saveVocabularyEntryMock).toHaveBeenCalledTimes(3)
    expect(container.querySelector('[data-testid="sample-lesson-growth-card"]')?.textContent)
      .toContain("Share the result, not your history")

    await act(async () => {
      buttonByText("Share sentence card")?.click()
      await Promise.resolve()
      await Promise.resolve()
    })
    await act(async () => {
      buttonByText("Invite a friend")?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(shareMock).toHaveBeenCalledWith(expect.objectContaining({
      title: "Astra sentence card",
      url: expect.stringContaining("utm_source=sentence_card"),
    }))
    expect(shareMock).toHaveBeenCalledWith(expect.objectContaining({
      title: "Try Astra",
      url: expect.stringContaining("utm_source=referral"),
    }))
    expect(recordLearningLoopEventMock).toHaveBeenCalledWith("share_card_created", expect.objectContaining({
      source: "sample_lesson",
      surface: "sample_lesson",
      shareType: "sentence_card",
      landingSource: "sentence_card",
      contentOrigin: "sample_lesson",
      hasSourceTitle: true,
    }))
    expect(recordLearningLoopEventMock).toHaveBeenCalledWith("referral_sent", expect.objectContaining({
      schema: "astra-referral-readiness.v1",
      source: "sample_lesson",
      surface: "sample_lesson",
      referralType: "non_rewarding",
      landingSource: "referral",
      rewardAvailable: false,
      sampleContentOnly: true,
    }))
    const growthTelemetryCalls = recordLearningLoopEventMock.mock.calls.filter(([event]) => event === "share_card_created" || event === "referral_sent")
    const serializedGrowthTelemetry = JSON.stringify(growthTelemetryCalls.map(([, data]) => data))
    expect(serializedGrowthTelemetry).not.toContain("pageUrl")
    expect(serializedGrowthTelemetry).not.toContain("articleExcerpt")
    expect(serializedGrowthTelemetry).not.toContain("contentSummary")
    expect(serializedGrowthTelemetry).not.toContain("To inhabit a difficult sentence")
    expect(serializedGrowthTelemetry).not.toContain("要真正进入")
  })

  it("opens the Library after the sample review is complete", async () => {
    const browser = (globalThis as unknown as { __ASTRA_TEST_BROWSER__: any }).__ASTRA_TEST_BROWSER__

    await act(async () => {
      buttonByText("Save 3 expressions for review")?.click()
      await Promise.resolve()
      await Promise.resolve()
    })
    await act(async () => {
      buttonByText("Start review")?.click()
      await Promise.resolve()
    })
    await act(async () => {
      buttonByText("I reviewed this — next card")?.click()
      await Promise.resolve()
    })
    await act(async () => {
      buttonByText("I reviewed this — next card")?.click()
      await Promise.resolve()
    })
    await act(async () => {
      buttonByText("I reviewed this card")?.click()
      await Promise.resolve()
    })
    await act(async () => {
      buttonByText("Open Review")?.click()
      await Promise.resolve()
    })

    expect(browser.tabs.create).toHaveBeenCalledWith({ url: "/vocabulary.html?tab=review" })
  })
})
