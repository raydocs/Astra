import { act, type ComponentProps } from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import StudySection from "./StudySection"

type StudySectionProps = ComponentProps<typeof StudySection>

function createWeeklyRoi(overrides: Partial<StudySectionProps["weeklyRoi"]> = {}): NonNullable<StudySectionProps["weeklyRoi"]> {
  const window = { startAt: 0, endAt: 1000, days: 7 }
  return {
    study: {
      window,
      activePageCount: 2,
      completedLoopCount: 1,
      inputMinutes: 90,
      sentencesExplained: 5,
      vocabSaved: 3,
      vocabReviewed: 2,
    },
    vocabulary: {
      window,
      savedCount: 3,
      reviewedCount: 2,
      masteredCount: 2,
      reviewHitCount: 2,
      reviewAttemptCount: 2,
      reviewHitRate: 100,
    },
    generatedAt: 1000,
    ...overrides,
  }
}

function createProps(patch: Partial<StudySectionProps> = {}): StudySectionProps {
  const noop = vi.fn()
  return {
    currentPageActivity: null,
    dueCount: 0,
    recentHistory: [],
    studyContext: null,
    canReadArticle: false,
    showAccountContinuityNudge: false,
    onOpenAccountContinuitySignIn: noop,
    studyLoop: null,
    weeklyRoi: createWeeklyRoi(),
    pageSavedReviewSummary: null,
    pageAssetSaveStatus: "idle",
    pageAssetSaveMessage: null,
    pageDigest: null,
    digestStale: false,
    digestLoading: false,
    canSpeakStudy: false,
    speakingStudy: false,
    studyQuickActions: [],
    studyActionRunningId: null,
    studyActionResult: null,
    sentenceCards: [],
    sentenceActionLocked: false,
    sentenceDeckFallbackMessage: null,
    selectedSentenceIndex: 0,
    onGenerateDigest: noop,
    onRegenerateDigest: noop,
    onToggleStudySpeech: noop,
    onToggleSentenceSpeech: noop,
    onSelectSentence: noop,
    onRunStudyAction: noop,
    onSaveSentence: noop,
    onReviewSavedSentence: noop,
    onReviewPageSavedSentences: noop,
    onSavePageAsset: noop,
    onOpenHistoryEntry: noop,
    onOpenReview: noop,
    onOpenVocabulary: noop,
    onOpenReadingQueue: noop,
    onReadArticle: noop,
    onExplainSentence: noop,
    ...patch,
  }
}

describe("StudySection weekly ROI", () => {
  let container: HTMLDivElement
  let root: ReactDOM.Root

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = ReactDOM.createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it("renders the page content assetization card with a save CTA", () => {
    const onSavePageAsset = vi.fn()

    act(() => {
      root.render(<StudySection {...createProps({
        studyContext: {
          pageTitle: "Asset article",
          pageUrl: "https://example.com/asset",
          hostname: "example.com",
          contentSummary: "A studyable page summary.",
        },
        onSavePageAsset,
      })} />)
    })

    const card = container.querySelector('[data-testid="study-content-assetization-card"]') as HTMLElement
    const saveButton = container.querySelector('[data-testid="study-save-page-asset"]') as HTMLButtonElement
    expect(card).toBeTruthy()
    expect(card.textContent).toContain("把当前页面保存到阅读队列")
    expect(card.textContent).toContain("Asset article")
    expect(card.textContent).toContain("example.com")
    expect(saveButton.disabled).toBe(false)

    act(() => {
      saveButton.click()
    })

    expect(onSavePageAsset).toHaveBeenCalledTimes(1)
  })

  it("shows saved page asset state without exposing another save action", () => {
    act(() => {
      root.render(<StudySection {...createProps({
        currentPageActivity: {
          id: "history-asset",
          url: "https://example.com/saved",
          hostname: "example.com",
          title: "Saved asset article",
          wordsTranslated: 240,
          visitedAt: Date.now(),
        },
        pageAssetSaveStatus: "saved",
        pageAssetSaveMessage: "已在阅读队列中。",
      })} />)
    })

    const card = container.querySelector('[data-testid="study-content-assetization-card"]') as HTMLElement
    const saveButton = container.querySelector('[data-testid="study-save-page-asset"]') as HTMLButtonElement
    expect(card).toBeTruthy()
    expect(card.textContent).toContain("已在阅读队列中。")
    expect(saveButton.textContent).toBe("页面已保存")
    expect(saveButton.disabled).toBe(true)
  })

  it("promotes the next study step above page assetization diagnostics", () => {
    act(() => {
      root.render(<StudySection {...createProps({
        studyContext: {
          pageTitle: "Hierarchy article",
          pageUrl: "https://example.com/hierarchy",
          hostname: "example.com",
          contentSummary: "A studyable page summary.",
        },
        studyLoop: {
          currentPage: {
            url: "https://example.com/hierarchy",
            hostname: "example.com",
            title: "Hierarchy article",
            completedSteps: ["read"],
            sentencesExplained: 0,
            vocabSaved: 0,
            vocabReviewed: 0,
            startedAt: Date.now(),
            lastActivityAt: Date.now(),
          },
          completedSteps: ["read"],
          currentCounts: { sentencesExplained: 0, vocabSaved: 0, vocabReviewed: 0 },
          nextStep: "explain",
          completionPercent: 20,
          dailyStats: { date: "2026-04-14", pagesStudied: 1, sentencesExplained: 0, vocabSaved: 0, vocabReviewed: 0 },
          recentPages: [],
          personalizedStrategy: null,
        },
      })} />)
    })

    const progress = container.querySelector('[data-testid="study-progress-card-group"]') as HTMLElement
    const assetization = container.querySelector('[data-testid="study-content-assetization-card"]') as HTMLElement
    const nextStep = container.querySelector('[data-testid="study-next-step-action"]') as HTMLButtonElement
    expect(progress).toBeTruthy()
    expect(assetization).toBeTruthy()
    expect(nextStep).toBeTruthy()
    expect(progress.compareDocumentPosition(assetization) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("renders proof-aware account continuity copy without changing the sign-in CTA", () => {
    const onOpenAccountContinuitySignIn = vi.fn()

    act(() => {
      root.render(<StudySection {...createProps({
        dueCount: 2,
        showAccountContinuityNudge: true,
        onOpenAccountContinuitySignIn,
        pageSavedReviewSummary: { count: 1 },
        studyLoop: {
          currentPage: null,
          completedSteps: ["read", "guided_read", "explain", "vocab_save"],
          currentCounts: { sentencesExplained: 3, vocabSaved: 1, vocabReviewed: 0 },
          nextStep: "vocab_review",
          completionPercent: 80,
          dailyStats: { date: "2026-04-14", pagesStudied: 1, sentencesExplained: 3, vocabSaved: 1, vocabReviewed: 0 },
          recentPages: [],
          personalizedStrategy: null,
        },
      })} />)
    })

    const nudge = container.querySelector('[data-testid="study-account-continuity-nudge"]') as HTMLElement
    const proofMoment = container.querySelector('[data-testid="study-account-continuity-proof-moment"]') as HTMLElement
    const cta = container.querySelector('[data-testid="study-account-continuity-sign-in-cta"]') as HTMLButtonElement
    expect(nudge.textContent).toContain("Keep your learning trail when you switch devices")
    expect(proofMoment.textContent).toContain("Proof on this page is already forming")
    expect(proofMoment.textContent).toContain("Proof now: 2 due review cards · 1 saved learning card · 1 page studied today")
    expect(proofMoment.textContent).toContain("existing popup sign-in panel")
    expect(cta.textContent).toContain("Sign in to keep continuity")

    act(() => {
      cta.click()
    })

    expect(onOpenAccountContinuitySignIn).toHaveBeenCalledTimes(1)
  })

  it("renders connected account continuity proof without a sign-in CTA when signed in", () => {
    act(() => {
      root.render(<StudySection {...createProps({
        dueCount: 1,
        showAccountContinuityNudge: true,
        accountContinuityAuthState: "signed_in",
        pageSavedReviewSummary: { count: 2 },
      })} />)
    })

    const nudge = container.querySelector('[data-testid="study-account-continuity-nudge"]') as HTMLElement
    expect(nudge.textContent).toContain("Continuity is connected for this account")
    expect(nudge.textContent).toContain("saved learning cards")
    expect(nudge.textContent).toContain("attached to this Astra account")
    expect(nudge.textContent).toContain("Connected proof")
    expect(nudge.textContent).toContain("no sign-in action is needed")
    expect(nudge.textContent).toContain("SRS schedule timing stays local-only")
    expect(container.querySelector('[data-testid="study-account-continuity-sign-in-cta"]')).toBeNull()
  })

  it("renders a read-only weekly ROI summary card", () => {
    act(() => {
      root.render(<StudySection {...createProps()} />)
    })

    const card = container.querySelector('[data-testid="weekly-roi-summary-card"]') as HTMLElement
    expect(card).toBeTruthy()
    expect(card.textContent).toContain("Weekly ROI")
    expect(card.textContent).toContain("7-day learning return")
    expect(card.textContent).toContain("Input time → mastered vocabulary → review hit rate")
    expect(card.textContent).toContain("1.5h")
    expect(card.textContent).toContain("100%")
    expect(card.textContent).toContain("2 active pages")
    expect(card.textContent).toContain("1 loop closed")
    expect(card.textContent).toContain("3 saved")
    expect(card.textContent).toContain("2 reviewed")
    expect(card.textContent).toContain("1.3 mastered/hour")
    expect(card.querySelector("button")).toBeNull()
  })

  it("does not render the weekly ROI card before the weekly activity precondition is met", () => {
    act(() => {
      root.render(<StudySection {...createProps({
        weeklyRoi: createWeeklyRoi({
          study: {
            window: { startAt: 0, endAt: 1000, days: 7 },
            activePageCount: 0,
            completedLoopCount: 0,
            inputMinutes: 0,
            sentencesExplained: 0,
            vocabSaved: 0,
            vocabReviewed: 0,
          },
          vocabulary: {
            window: { startAt: 0, endAt: 1000, days: 7 },
            savedCount: 0,
            reviewedCount: 0,
            masteredCount: 0,
            reviewHitCount: 0,
            reviewAttemptCount: 0,
            reviewHitRate: null,
          },
        }),
      })} />)
    })

    expect(container.querySelector('[data-testid="weekly-roi-summary-card"]')).toBeNull()
  })
})
