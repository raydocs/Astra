import { act } from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  getVocabularyEntriesMock,
  updateVocabularyEntryMock,
  recordStudyEventMock,
  buildVocabularyReviewStudyEventMock,
} = vi.hoisted(() => ({
  getVocabularyEntriesMock: vi.fn(),
  updateVocabularyEntryMock: vi.fn(),
  recordStudyEventMock: vi.fn(),
  buildVocabularyReviewStudyEventMock: vi.fn(),
}))

vi.mock("@/utils/storage/vocabulary", () => ({
  getVocabularyEntries: getVocabularyEntriesMock,
  updateVocabularyEntry: updateVocabularyEntryMock,
}))

vi.mock("@/utils/storage/study-progress", () => ({
  buildVocabularyReviewStudyEvent: buildVocabularyReviewStudyEventMock,
  recordStudyEvent: recordStudyEventMock,
}))

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
      context: "The ephemeral phase passes quickly.",
      url: "https://example.com/article",
      hostname: "example.com",
      savedAt: 1000,
      srsBox: 1,
      nextReviewAt: 0,
      reviewCount: 0,
      lastReviewedAt: null,
      sourceContext: {
        surface: "popup_deep_read",
        pageTitle: "Example article",
        articleExcerpt: "The ephemeral phase passes quickly. Another sentence follows.",
        sentenceText: "The ephemeral phase passes quickly.",
        sentenceIndex: 0,
      },
    }

    getVocabularyEntriesMock.mockResolvedValue([entry])
    updateVocabularyEntryMock.mockResolvedValue(entry)
    buildVocabularyReviewStudyEventMock.mockReturnValue({
      url: "https://example.com/article",
      hostname: "example.com",
      title: "Example article",
      step: "vocab_review",
    })
    recordStudyEventMock.mockResolvedValue(undefined)

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

    expect(container.textContent).toContain("Popup deep-read")
    expect(container.textContent).toContain("Example article")
    expect(container.textContent).toContain("The ephemeral phase passes quickly.")

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
})
