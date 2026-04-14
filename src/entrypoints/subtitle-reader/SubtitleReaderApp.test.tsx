import { act } from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockBrowser = vi.hoisted(() => ({
  storage: {
    local: {
      get: vi.fn(async () => ({ "astra.config.v1": { targetLang: "zh-CN" } })),
      clear: vi.fn(async () => undefined),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    getURL: vi.fn((path: string) => path),
  },
  tabs: {
    create: vi.fn(async () => undefined),
  },
}))
const {
  saveVocabularyEntryMock,
  upsertOwnedSubtitleFileFromImportMock,
  translateTextsMock,
} = vi.hoisted(() => ({
  saveVocabularyEntryMock: vi.fn(),
  upsertOwnedSubtitleFileFromImportMock: vi.fn(),
  translateTextsMock: vi.fn(),
}))

vi.mock("#imports", () => ({
  browser: mockBrowser,
}))

vi.mock("@/utils/storage/vocabulary", () => ({
  saveVocabularyEntry: saveVocabularyEntryMock,
}))

vi.mock("@/utils/storage/owned-reading", () => ({
  upsertOwnedSubtitleFileFromImport: upsertOwnedSubtitleFileFromImportMock,
  buildOwnedReadingVocabularySourceLink: (item: { id: string; sourceType: string; title: string; studyProgressRecordId?: string | null }) => ({
    ownedReadingItemId: item.id,
    ownedReadingSourceType: item.sourceType,
    ownedReadingTitle: item.title,
    ...(item.studyProgressRecordId ? { studyProgressRecordId: item.studyProgressRecordId } : {}),
  }),
}))

vi.mock("@/utils/translate/translate", () => ({
  translateTexts: translateTextsMock,
}))

import { SubtitleReaderApp } from "./SubtitleReaderApp"

describe("SubtitleReaderApp", () => {
  let container: HTMLDivElement
  let root: ReactDOM.Root

  beforeEach(async () => {
    vi.clearAllMocks()
    await mockBrowser.storage.local.clear()
    mockBrowser.tabs.create.mockResolvedValue(undefined)
    mockBrowser.runtime.getURL.mockImplementation((path: string) => path)
    mockBrowser.runtime.sendMessage.mockResolvedValue({
      type: "runtime/translate-batch:success",
      payload: {
        translations: ["你好 Astra", "字幕现在进入学习链路。"],
      },
    })
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["Explains the subtitle row in context."],
    })
    upsertOwnedSubtitleFileFromImportMock.mockResolvedValue({
      id: "or_subtitle_sample",
      sourceType: "subtitle-file",
      title: "sample.srt · SRT · 2 items",
      localUri: "astra-local://subtitle/sample.srt",
      studyProgressRecordId: null,
    })
    saveVocabularyEntryMock.mockResolvedValue({
      id: "vocab-1",
    })

    container = document.createElement("div")
    document.body.appendChild(container)
    root = ReactDOM.createRoot(container)

    await act(async () => {
      root.render(<SubtitleReaderApp />)
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

  it("saves subtitle rows with stable owned-reading identity and exposes learning-loop handoff actions", async () => {
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(input).toBeTruthy()

    const subtitleText = `1\n00:00:01,000 --> 00:00:04,000\nHello Astra\n\n2\n00:00:05,000 --> 00:00:08,000\nSubtitle files enter the learning loop.`
    const file = new File([
      subtitleText,
    ], "sample.srt", { type: "application/x-subrip" })
    Object.defineProperty(file, "text", {
      configurable: true,
      value: vi.fn(async () => subtitleText),
    })

    Object.defineProperty(input, "files", {
      configurable: true,
      value: [file],
    })

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain("Parsed 2 cues from SRT file")
    expect(upsertOwnedSubtitleFileFromImportMock).toHaveBeenCalledWith(expect.objectContaining({
      fileName: "sample.srt",
      formatLabel: "SRT",
      cueOrEntryCount: 2,
      status: "in_progress",
    }))

    const translateButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Translate All") as HTMLButtonElement
    expect(translateButton).toBeTruthy()

    await act(async () => {
      translateButton.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockBrowser.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: "runtime/translate-batch",
    }))
    expect(container.textContent).toContain("你好 Astra")

    const explainButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Explain") as HTMLButtonElement
    expect(explainButton).toBeTruthy()

    await act(async () => {
      explainButton.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      texts: ["Hello Astra"],
      task: "explain",
    }))
    expect(upsertOwnedSubtitleFileFromImportMock).toHaveBeenCalledWith(expect.objectContaining({
      status: "in_progress",
      sentenceIndex: 0,
    }))
    expect(container.textContent).toContain("Explains the subtitle row in context.")

    const saveButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Save") as HTMLButtonElement
    expect(saveButton).toBeTruthy()

    await act(async () => {
      saveButton.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(upsertOwnedSubtitleFileFromImportMock).toHaveBeenCalledWith(expect.objectContaining({
      status: "saved",
      sentenceIndex: 0,
    }))
    expect(saveVocabularyEntryMock).toHaveBeenCalledWith(expect.objectContaining({
      text: "Hello Astra",
      translation: "你好 Astra",
      explanation: "Explains the subtitle row in context.",
      url: "astra-local://subtitle/sample.srt",
      hostname: "subtitle-reader",
      sourceContext: expect.objectContaining({
        surface: "subtitle_reader",
        pageTitle: "sample.srt",
        pageUrl: "astra-local://subtitle/sample.srt",
        hostname: "subtitle-reader",
        contentSummary: "SRT · 2 items",
        sentenceText: "Hello Astra",
        sentenceIndex: 0,
        ownedReadingItemId: "or_subtitle_sample",
        ownedReadingSourceType: "subtitle-file",
        ownedReadingTitle: "sample.srt · SRT · 2 items",
      }),
    }))

    expect(container.textContent).toContain("Learning chain ready")
    expect(container.textContent).toContain("1 saved row is now available in Vocabulary, Review, and Reading queue revisit.")

    const startReviewButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Start Review") as HTMLButtonElement
    expect(startReviewButton).toBeTruthy()

    await act(async () => {
      startReviewButton.click()
      await Promise.resolve()
    })

    expect(mockBrowser.tabs.create).toHaveBeenCalledWith({ url: "/vocabulary.html?tab=review" })
  })
})
