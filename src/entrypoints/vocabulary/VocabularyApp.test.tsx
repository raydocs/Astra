import { act } from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  getVocabularyEntriesMock,
  removeVocabularyEntryMock,
  getDueVocabularyCountMock,
  updateVocabularyEntryMock,
} = vi.hoisted(() => ({
  getVocabularyEntriesMock: vi.fn(),
  removeVocabularyEntryMock: vi.fn(),
  getDueVocabularyCountMock: vi.fn(),
  updateVocabularyEntryMock: vi.fn(),
}))

vi.mock("@/utils/storage/vocabulary", () => ({
  getVocabularyEntries: getVocabularyEntriesMock,
  removeVocabularyEntry: removeVocabularyEntryMock,
  getDueVocabularyCount: getDueVocabularyCountMock,
  updateVocabularyEntry: updateVocabularyEntryMock,
}))

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
        articleExcerpt: "The ephemeral phase passes quickly. Another sentence follows.",
        sentenceText: "The ephemeral phase passes quickly.",
        sentenceIndex: 0,
      },
    }])
    getDueVocabularyCountMock.mockResolvedValue(1)
    removeVocabularyEntryMock.mockResolvedValue(undefined)
    updateVocabularyEntryMock.mockResolvedValue(null)

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

  it("renders popup deep-read source context in the vocabulary list", () => {
    expect(container.textContent).toContain("Popup deep-read")
    expect(container.textContent).toContain("Example article")
    expect(container.textContent).toContain("The ephemeral phase passes quickly.")
  })
})
