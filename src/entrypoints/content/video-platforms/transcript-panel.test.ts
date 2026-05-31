import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const browserMock = vi.hoisted(() => ({
  runtime: {
    getURL: vi.fn((path: string) => path),
  },
  tabs: {
    create: vi.fn(async () => undefined),
  },
}))
const subscribeYouTubeTranscriptSnapshotMock = vi.hoisted(() => vi.fn())
const saveDeepReadSessionMock = vi.hoisted(() => vi.fn())
const saveVocabularyEntryMock = vi.hoisted(() => vi.fn())
const getDueVocabularyCountMock = vi.hoisted(() => vi.fn())
const runInlineActionMock = vi.hoisted(() => vi.fn())
const copyTextToClipboardMock = vi.hoisted(() => vi.fn())
const recordLearningLoopEventMock = vi.hoisted(() => vi.fn())

vi.mock("#imports", () => ({
  browser: browserMock,
}))

vi.mock("./youtube", () => ({
  subscribeYouTubeTranscriptSnapshot: subscribeYouTubeTranscriptSnapshotMock,
}))

vi.mock("@/utils/storage/deep-read-session", () => ({
  saveDeepReadSession: saveDeepReadSessionMock,
}))

vi.mock("@/utils/storage/vocabulary", () => ({
  getDueVocabularyCount: getDueVocabularyCountMock,
  saveVocabularyEntry: saveVocabularyEntryMock,
}))

vi.mock("../inline-actions", () => ({
  runInlineAction: runInlineActionMock,
}))

vi.mock("@/utils/dom/clipboard", () => ({
  copyTextToClipboard: copyTextToClipboardMock,
}))

vi.mock("@/utils/learning-loop-events", () => ({
  recordLearningLoopEvent: recordLearningLoopEventMock,
}))

import { mountVideoTranscriptPanel, unmountVideoTranscriptPanel } from "./transcript-panel"
import type { YouTubeTranscriptSnapshot } from "./youtube"

function createSnapshot(): YouTubeTranscriptSnapshot {
  return {
    available: true,
    noCaptions: false,
    title: "Astra video lesson",
    pageUrl: "https://www.youtube.com/watch?v=astra123",
    language: "en",
    currentTime: 1.4,
    activeIndex: 1,
    cues: [
      { id: "cue-1", startMs: 0, endMs: 1200, text: "Welcome to Astra." },
      { id: "cue-2", startMs: 1200, endMs: 2400, text: "This transcript should open in Deep Read.", translation: "这份字幕应在深度阅读中打开。" },
    ],
  }
}

describe("video transcript panel Deep Read handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ""
    subscribeYouTubeTranscriptSnapshotMock.mockImplementation((listener: (snapshot: YouTubeTranscriptSnapshot | null) => void) => {
      listener(createSnapshot())
      return vi.fn()
    })
    saveDeepReadSessionMock.mockResolvedValue(null)
    saveVocabularyEntryMock.mockResolvedValue({ id: "entry-video-1" })
    getDueVocabularyCountMock.mockResolvedValue(1)
    runInlineActionMock.mockResolvedValue({ ok: true, text: "Video summary" })
  })

  afterEach(() => {
    unmountVideoTranscriptPanel()
    document.body.innerHTML = ""
  })

  it("opens Review focused on the latest saved transcript card", async () => {
    mountVideoTranscriptPanel({ targetLang: "zh-CN", serviceMode: "balanced" })

    const transcriptTab = Array.from(document.querySelectorAll("button"))
      .find((button) => button.textContent === "Transcript") as HTMLButtonElement | undefined
    expect(transcriptTab).toBeTruthy()
    transcriptTab?.click()

    expect(document.querySelector("[data-astra-transcript-save-hint]")?.textContent)
      .toContain("Save useful lines as Review cards")

    const saveSentence = Array.from(document.querySelectorAll("button"))
      .find((button) => button.textContent === "Save sentence") as HTMLButtonElement | undefined
    expect(saveSentence).toBeTruthy()
    saveSentence?.click()
    await Promise.resolve()
    await Promise.resolve()

    const notesTab = Array.from(document.querySelectorAll("button"))
      .find((button) => button.textContent === "Notes") as HTMLButtonElement | undefined
    expect(notesTab).toBeTruthy()
    notesTab?.click()

    const review = Array.from(document.querySelectorAll("button"))
      .find((button) => button.textContent === "Review") as HTMLButtonElement | undefined
    expect(review).toBeTruthy()
    review?.click()

    expect(saveVocabularyEntryMock).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining("Welcome to Astra"),
      url: "https://www.youtube.com/watch?v=astra123&t=0s",
      tags: ["video", "transcript"],
    }))
    expect(browserMock.tabs.create).toHaveBeenCalledWith({
      url: "/vocabulary.html?tab=review&entryId=entry-video-1",
    })
  })

  it("saves a transcript-backed Deep Read session before opening Deep Read", async () => {
    mountVideoTranscriptPanel({ targetLang: "zh-CN", serviceMode: "balanced" })

    const openDeepRead = Array.from(document.querySelectorAll("button"))
      .find((button) => button.textContent === "Open in Deep Read") as HTMLButtonElement | undefined
    expect(openDeepRead).toBeTruthy()

    openDeepRead?.click()
    await Promise.resolve()
    await Promise.resolve()

    expect(saveDeepReadSessionMock).toHaveBeenCalledWith({
      selectedSentenceIndex: 1,
      context: expect.objectContaining({
        pageTitle: "Astra video lesson",
        pageUrl: "https://www.youtube.com/watch?v=astra123",
        hostname: window.location.hostname,
        metaDescription: "Video transcript opened from Astra Transcript Panel.",
        contentSummary: expect.stringContaining("YouTube video transcript · 2 cues"),
        articleExcerpt: expect.stringContaining("This transcript should open in Deep Read."),
      }),
    })
    expect(saveDeepReadSessionMock.mock.calls[0]?.[0].context.articleExcerpt).toContain("Translation: 这份字幕应在深度阅读中打开。")
    expect(browserMock.tabs.create).toHaveBeenCalledWith({
      url: "/deep-read.html?pageUrl=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dastra123",
    })
  })

  it("offers a paste-to-explain fallback instead of dead-ending when the video has no captions", async () => {
    subscribeYouTubeTranscriptSnapshotMock.mockImplementation((listener: (snapshot: YouTubeTranscriptSnapshot | null) => void) => {
      listener({
        available: false,
        noCaptions: true,
        title: "Astra video lesson",
        pageUrl: "https://www.youtube.com/watch?v=nocaps",
        language: null,
        currentTime: 0,
        activeIndex: -1,
        cues: [],
      })
      return vi.fn()
    })
    runInlineActionMock.mockResolvedValue({ ok: true, text: "This subtitle means hello." })

    mountVideoTranscriptPanel({ targetLang: "zh-CN", serviceMode: "balanced" })

    const panel = document.getElementById("astra-video-transcript-panel")!
    expect(panel.querySelector("[data-astra-transcript-no-captions]")).toBeTruthy()

    const textarea = panel.querySelector("[data-astra-transcript-no-captions-input]") as HTMLTextAreaElement | null
    expect(textarea).toBeTruthy()
    textarea!.value = "Hola, ¿cómo estás?"
    textarea!.dispatchEvent(new Event("input"))

    const explainBtn = panel.querySelector("[data-astra-transcript-no-captions-explain]") as HTMLButtonElement | null
    expect(explainBtn).toBeTruthy()
    explainBtn!.click()
    await Promise.resolve()
    await Promise.resolve()

    expect(runInlineActionMock).toHaveBeenCalledWith(expect.objectContaining({
      text: "Hola, ¿cómo estás?",
      task: "explain",
      targetLang: "zh-CN",
      serviceMode: "balanced",
    }))

    expect(panel.querySelector("[data-astra-transcript-no-captions-explanation]")?.textContent)
      .toContain("This subtitle means hello.")

    const feedback = panel.querySelector('[data-astra-transcript-feedback="no-captions-paste"]') as HTMLElement | null
    expect(feedback?.textContent).toContain("Was this useful?")

    const notAccurate = panel.querySelector('[data-astra-transcript-feedback-rating="not_accurate"]') as HTMLButtonElement | null
    expect(notAccurate).toBeTruthy()
    notAccurate!.click()

    expect(recordLearningLoopEventMock).toHaveBeenCalledWith("learning_feedback_submitted", {
      surface: "no_captions_paste",
      rating: "not_accurate",
      cueStartBucket: null,
    })
  })
})
