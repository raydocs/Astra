import { act } from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  readConfigMock,
  getActiveTabStudyContextMock,
  getDeepReadSessionMock,
  getLatestDeepReadSessionMock,
  saveDeepReadSessionMock,
  getPageDigestMock,
  isDigestStaleMock,
  savePageDigestMock,
  generatePageDigestMock,
  getReadingHistoryMock,
  getDueVocabularyCountMock,
  saveVocabularyEntryMock,
  upsertOwnedArticleFromUrlMock,
  getStudyProgressMock,
  deriveStudyLoopViewModelMock,
  recordStudyEventMock,
  speakMock,
  speakWithHighlightMock,
  stopSpeakingMock,
  isTtsSupportedMock,
  translateTextsMock,
  recordLearningLoopEventMock,
} = vi.hoisted(() => ({
  readConfigMock: vi.fn(),
  getActiveTabStudyContextMock: vi.fn(),
  getDeepReadSessionMock: vi.fn(),
  getLatestDeepReadSessionMock: vi.fn(),
  saveDeepReadSessionMock: vi.fn(),
  getPageDigestMock: vi.fn(),
  isDigestStaleMock: vi.fn(),
  savePageDigestMock: vi.fn(),
  generatePageDigestMock: vi.fn(),
  getReadingHistoryMock: vi.fn(),
  getDueVocabularyCountMock: vi.fn(),
  saveVocabularyEntryMock: vi.fn(),
  upsertOwnedArticleFromUrlMock: vi.fn(),
  getStudyProgressMock: vi.fn(),
  deriveStudyLoopViewModelMock: vi.fn(),
  recordStudyEventMock: vi.fn(),
  speakMock: vi.fn(),
  speakWithHighlightMock: vi.fn(),
  stopSpeakingMock: vi.fn(),
  isTtsSupportedMock: vi.fn(),
  translateTextsMock: vi.fn(),
  recordLearningLoopEventMock: vi.fn(),
}))

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
}))

vi.mock("@/utils/extension/messages", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/extension/messages")>()
  return {
    ...actual,
    getActiveTabStudyContext: getActiveTabStudyContextMock,
    resolveActiveHttpTab: vi.fn().mockResolvedValue({ url: "https://example.com/article" }),
  }
})

vi.mock("@/utils/storage/deep-read-session", () => ({
  getDeepReadSession: getDeepReadSessionMock,
  getLatestDeepReadSession: getLatestDeepReadSessionMock,
  saveDeepReadSession: saveDeepReadSessionMock,
}))

vi.mock("@/utils/storage/page-digests", () => ({
  computeFingerprint: vi.fn(() => "fp"),
  getPageDigest: getPageDigestMock,
  isDigestStale: isDigestStaleMock,
  savePageDigest: savePageDigestMock,
}))

vi.mock("@/utils/reading/assist", () => ({
  generatePageDigest: generatePageDigestMock,
}))

vi.mock("@/utils/storage/reading-history", () => ({
  getReadingHistory: getReadingHistoryMock,
}))

vi.mock("@/utils/storage/vocabulary", () => ({
  getDueVocabularyCount: getDueVocabularyCountMock,
  saveVocabularyEntry: saveVocabularyEntryMock,
}))

vi.mock("@/utils/storage/owned-reading", () => ({
  buildOwnedReadingVocabularySourceLink: vi.fn(() => ({
    ownedReadingItemId: "or_article_example",
    ownedReadingSourceType: "article",
    ownedReadingTitle: "Example article",
    studyProgressRecordId: "https://example.com/article",
  })),
  upsertOwnedArticleFromUrl: upsertOwnedArticleFromUrlMock,
}))

vi.mock("@/utils/storage/study-progress", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/storage/study-progress")>()
  return {
    ...actual,
    getStudyProgress: getStudyProgressMock,
    deriveStudyLoopViewModel: deriveStudyLoopViewModelMock,
    recordStudyEvent: recordStudyEventMock,
  }
})

vi.mock("@/utils/tts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/tts")>()
  return {
    ...actual,
    speak: speakMock,
    speakWithHighlight: speakWithHighlightMock,
    stopSpeaking: stopSpeakingMock,
    isTtsSupported: isTtsSupportedMock,
  }
})

vi.mock("@/utils/translate/translate", () => ({
  translateTexts: translateTextsMock,
}))

vi.mock("@/utils/learning-loop-events", () => ({
  recordLearningLoopEvent: recordLearningLoopEventMock,
}))

vi.mock("@/utils/i18n", () => ({
  t: (key: string, substitutions?: string | string[]) => {
    const subs = Array.isArray(substitutions) ? substitutions : substitutions ? [substitutions] : []
    const messages: Record<string, string> = {
      popup_deepReadTitle: "Deep read this page",
      popup_deepReadPageFallbackTitle: "Astra Deep Read",
      popup_deepReadHint: "Deep read hint",
      popup_studySentenceDeck: "Sentence drills",
      popup_review: "Review",
      label_explainMode: "Explain mode",
      label_explainModeDeep: "Deep",
      popup_deepReadSentenceProgress: `Sentence ${subs[0] ?? "$1"} / ${subs[1] ?? "$2"}`,
      actionPrevious: "Previous",
      actionNext: "Next",
      actionStop: "Stop",
      actionSpeak: "Speak",
      popup_deepReadAutoplay: "Autoplay next",
      popup_deepReadStopAutoplay: "Stop autoplay",
      actionExplain: "Explain",
      actionSave: "Save",
      actionSaving: "Saving...",
      actionSaved: "Saved",
      popup_deepReadSavedCount: `${subs[0] ?? "$1"} saved`,
      popup_studyTitle: "Study Hub",
      popup_studySummaryEmpty: "No study summary",
      popup_studyArticleExcerpt: "Article excerpt",
      popup_studySentenceDeckFallback: "Fallback sentence deck",
      popup_deepReadSentenceNumber: `Sentence ${subs[0] ?? "$1"}`,
      popup_deepReadQueueTitle: "Study queue",
      popup_generateDigest: "Generate digest",
      popup_regenerateDigest: "Regenerate digest",
      popup_digestStaleHint: "Digest stale",
      popup_deepReadNextStepTitle: "Next step",
      popup_deepReadNextStepHeadline: "Keep this page in your learning loop.",
      popup_deepReadNextStepHint: "Continue the loop.",
      popup_studyNext: "Next:",
      popup_studyNoStepsYet: "No steps yet",
      popup_studyStepRead: "Read",
      popup_studyStepGuidedRead: "Guided read",
      popup_studyStepExplain: "Explain",
      popup_studyStepSaveWords: "Save words",
      popup_studyStepReview: "Review",
      popup_studyNextHintRead: "Read hint",
      popup_studyNextHintGuidedRead: "Guided read hint",
      popup_studyNextHintExplain: "Explain hint",
      popup_studyNextHintSaveWords: "Save hint",
      popup_studyNextHintReview: "Review hint",
      vocabulary_tabReading: "Reading",
      review_openSourcePage: "Open source page",
      learningSavedTitle: "Saved",
      learningSavedHint: "Saved hint",
      popup_deepReadEmptyHistoryTitle: "No active study page right now",
      popup_deepReadEmptyHistoryHint: "Open last page",
      popup_deepReadOpenLastPage: "Open last reading page",
    }
    return messages[key] ?? key
  },
}))

import type { AstraConfig } from "@/types/config"
import { DEFAULT_ASTRA_CONFIG } from "@/types/config"
import DeepReadApp from "./DeepReadApp"

function createConfig(patch: Partial<AstraConfig> = {}): AstraConfig {
  return {
    ...DEFAULT_ASTRA_CONFIG,
    ...patch,
    provider: {
      ...DEFAULT_ASTRA_CONFIG.provider,
      ...patch.provider,
    },
    presentation: {
      ...DEFAULT_ASTRA_CONFIG.presentation,
      ...patch.presentation,
    },
  }
}

describe("DeepReadApp", () => {
  let container: HTMLDivElement
  let root: ReactDOM.Root
  const originalLocation = window.location

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    Object.defineProperty(window, "location", {
      configurable: true,
      value: new URL("https://astra.local/deep-read.html?pageUrl=https%3A%2F%2Fexample.com%2Farticle&sentenceText=Selected%20sentence%20survives.&sentenceHash=fnv1a:1df005ba&sentenceIndex=0"),
    })

    readConfigMock.mockResolvedValue(createConfig({
      explainMode: "deep",
      targetLang: "zh-CN",
      tts: {
        ...DEFAULT_ASTRA_CONFIG.tts,
        enabled: true,
      },
    }))
    getReadingHistoryMock.mockResolvedValue([])
    getDueVocabularyCountMock.mockResolvedValue(3)
    getPageDigestMock.mockResolvedValue(null)
    isDigestStaleMock.mockReturnValue(false)
    generatePageDigestMock.mockResolvedValue({
      headline: "Digest headline",
      summary: "Digest summary",
      keyPoints: [],
      suggestedAction: "Digest action",
    })
    savePageDigestMock.mockResolvedValue({
      headline: "Digest headline",
      summary: "Digest summary",
      keyPoints: [],
      suggestedAction: "Digest action",
    })
    getStudyProgressMock.mockResolvedValue({
      pages: [],
      dailyStats: {
        date: "2026-04-15",
        pagesStudied: 1,
        sentencesExplained: 1,
        vocabSaved: 1,
        vocabReviewed: 0,
      },
    })
    deriveStudyLoopViewModelMock.mockReturnValue({
      currentPage: {
        url: "https://example.com/article",
        hostname: "example.com",
        title: "Example article",
        completedSteps: ["read", "guided_read", "explain"],
        sentencesExplained: 1,
        vocabSaved: 0,
        vocabReviewed: 0,
        startedAt: 1000,
        lastActivityAt: 2000,
      },
      completedSteps: ["read", "guided_read", "explain"],
      currentCounts: { sentencesExplained: 1, vocabSaved: 0, vocabReviewed: 0 },
      nextStep: "vocab_save",
      completionPercent: 60,
      dailyStats: {
        date: "2026-04-15",
        pagesStudied: 1,
        sentencesExplained: 1,
        vocabSaved: 1,
        vocabReviewed: 0,
      },
      recentPages: [],
    })
    getDeepReadSessionMock.mockResolvedValue({
      pageUrl: "https://example.com/article",
      pageTitle: "Example article",
      hostname: "example.com",
      metaDescription: undefined,
      contentSummary: "Intro sentence. Selected sentence survives. Closing sentence.",
      articleExcerpt: "Intro sentence. Selected sentence survives. Closing sentence.",
      sentences: [
        "Intro sentence.",
        "Selected sentence survives.",
        "Closing sentence.",
      ],
      selectedSentenceAnchor: {
        sentenceText: "Selected sentence survives.",
        sentenceHash: "fnv1a:1df005ba",
        sentenceIndex: 1,
      },
      selectedSentenceIndex: 1,
      updatedAt: Date.now(),
    })
    getLatestDeepReadSessionMock.mockResolvedValue(null)
    getActiveTabStudyContextMock.mockResolvedValue({
      ok: false,
      error: {
        code: "CONTENT_UNAVAILABLE",
        message: "No active page context",
      },
    })
    saveDeepReadSessionMock.mockResolvedValue(null)
    recordStudyEventMock.mockResolvedValue(undefined)
    upsertOwnedArticleFromUrlMock.mockResolvedValue({ id: "or_article_example" })
    saveVocabularyEntryMock.mockResolvedValue({ id: "entry-1" })
    speakMock.mockReturnValue(true)
    speakWithHighlightMock.mockReturnValue(() => undefined)
    isTtsSupportedMock.mockReturnValue(true)
    translateTextsMock.mockResolvedValue({ ok: true, translations: ["Explanation output"] })

    container = document.createElement("div")
    document.body.appendChild(container)
    root = ReactDOM.createRoot(container)

    await act(async () => {
      root.render(<DeepReadApp />)
      await vi.advanceTimersByTimeAsync(400)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    vi.useRealTimers()
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    })
  })

  it("restores the selected sentence from the sentence anchor when live context is unavailable", () => {
    expect(container.textContent).toContain("Sentence 2 / 3")
    expect(container.textContent).toContain("Selected sentence survives.")
    expect(container.textContent).toContain("Next: Save words")
  })

  it("lets reading view selections sync the focus sentence", async () => {
    const readingViewButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Reading view") as HTMLButtonElement
    expect(readingViewButton).toBeTruthy()

    await act(async () => {
      readingViewButton.click()
      await Promise.resolve()
    })

    const readingSentenceButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Closing sentence.")) as HTMLButtonElement
    expect(readingSentenceButton).toBeTruthy()

    await act(async () => {
      readingSentenceButton.click()
      await Promise.resolve()
    })

    expect(container.textContent).toContain("Sentence 3 / 3")
    expect(container.textContent).toContain("Closing sentence.")
  })
})
