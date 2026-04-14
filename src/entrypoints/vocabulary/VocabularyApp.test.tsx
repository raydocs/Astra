import { act } from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  getVocabularyEntriesMock,
  removeVocabularyEntryMock,
  getDueVocabularyCountMock,
  updateVocabularyEntryMock,
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

vi.mock("@/utils/storage/owned-reading", () => ({
  syncRecentReadingHistoryToOwnedQueue: syncRecentReadingHistoryToOwnedQueueMock,
  listOwnedReadingItems: listOwnedReadingItemsMock,
  markOwnedReadingOpened: markOwnedReadingOpenedMock,
  setOwnedReadingStatus: setOwnedReadingStatusMock,
  removeOwnedReadingItem: removeOwnedReadingItemMock,
}))

vi.mock("#imports", () => ({
  browser: {
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
        articleExcerpt: "The ephemeral phase passes quickly. Another sentence follows.",
        sentenceText: "The ephemeral phase passes quickly.",
        sentenceIndex: 0,
      },
    }])
    getDueVocabularyCountMock.mockResolvedValue(1)
    removeVocabularyEntryMock.mockResolvedValue(undefined)
    updateVocabularyEntryMock.mockResolvedValue(null)
    syncRecentReadingHistoryToOwnedQueueMock.mockResolvedValue(undefined)
    listOwnedReadingItemsMock.mockResolvedValue([])
    markOwnedReadingOpenedMock.mockResolvedValue(undefined)
    setOwnedReadingStatusMock.mockResolvedValue(undefined)
    removeOwnedReadingItemMock.mockResolvedValue(undefined)

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

  it("opens tab when Open is clicked on a reading row", async () => {
    listOwnedReadingItemsMock.mockResolvedValueOnce([
      {
        id: "or_test1",
        sourceType: "article",
        title: "Hello page",
        sourceUrl: "https://example.com/hello",
        openedAt: 10_000,
        status: "saved",
        readingHistoryRecordId: "https://example.com/hello",
        studyProgressRecordId: "https://example.com/hello",
      },
    ])

    const readingBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Reading")
    await act(async () => {
      readingBtn!.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    const openBtn = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Open")
    expect(openBtn).toBeTruthy()

    await act(async () => {
      openBtn!.click()
      await Promise.resolve()
    })

    expect(markOwnedReadingOpenedMock).toHaveBeenCalledWith("or_test1")
    expect(browser.tabs.create).toHaveBeenCalledWith({ url: "https://example.com/hello" })
  })
})
