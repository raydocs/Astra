import { useCallback, useEffect, useState } from "react"
import { browser } from "#imports"
import type { VocabularyEntry } from "@/utils/storage/vocabulary"
import { recordLearningLoopEvent } from "@/utils/learning-loop-events"
import { updateVocabularyEntry, getVocabularyEntries } from "@/utils/storage/vocabulary"
import { applyReview, getDueCards, getBoxDistribution } from "@/utils/srs/leitner"
import type { SrsFields, BoxDistribution } from "@/utils/srs/leitner"
import { buildVocabularyReviewStudyEvent, deriveStudyLoopViewModel, getStudyProgress, recordStudyEvent, type PersonalizedTeachingStrategy, type StudyLoopViewModel, type StudyStep } from "@/utils/storage/study-progress"
import { deriveVocabularySourceDisplay, getPageReviewVocabularyEntries } from "@/utils/storage/vocabulary-core"
import type { OwnedReadingItem } from "@/utils/storage/owned-reading"
import {
  buildOwnedReadingResumeTarget,
  describeOwnedReadingProgress,
  describeOwnedReadingResumeBehavior,
  getOwnedReadingSourceTypeLabel,
  listOwnedReadingItems,
  markOwnedReadingOpened,
  matchOwnedReadingItemForVocabularyEntry,
} from "@/utils/storage/owned-reading"
import { openVocabularyEntryInDeepRead } from "@/utils/deep-read-link"
import { t } from "@/utils/i18n"
import { commitLearningContinuitySync } from "@/utils/extension/messages"
import ReviewStats from "./ReviewStats"

type ReviewPhase = "showing-front" | "showing-back" | "session-complete"

interface SessionSummary {
  total: number
  correct: number
  incorrect: number
}

function toSrsFields(entry: VocabularyEntry): SrsFields {
  return {
    srsBox: entry.srsBox ?? 1,
    nextReviewAt: entry.nextReviewAt ?? 0,
    reviewCount: entry.reviewCount ?? 0,
    lastReviewedAt: entry.lastReviewedAt ?? null,
  }
}

function getStepLabel(step: StudyStep): string {
  const labels: Record<StudyStep, string> = {
    read: t("popup_studyStepRead"),
    guided_read: t("popup_studyStepGuidedRead"),
    explain: t("popup_studyStepExplain"),
    vocab_save: t("popup_studyStepSaveWords"),
    vocab_review: t("popup_studyStepReview"),
  }
  return labels[step]
}

function buildPersonalizedStrategyTelemetry(strategy: PersonalizedTeachingStrategy | null | undefined) {
  const eligible = !!strategy
  return {
    psarEligible: eligible,
    personalizedStrategyApplied: eligible,
    personalizedStrategyId: strategy?.id ?? null,
    personalizedStrategyLabel: strategy?.label ?? null,
    personalizedStrategyTrigger: strategy?.trigger ?? null,
    personalizedStrategyFocusStep: strategy?.focusStep ?? null,
    personalizedStrategyProgressSignature: strategy?.progressSignature ?? null,
  }
}

function CurrentPageLoopCard({ studyLoop }: { studyLoop: StudyLoopViewModel }) {
  if (!studyLoop.currentPage) return null

  return (
    <div
      className="astra-progress-panel"
      style={{ background: "var(--astra-brand-muted)", border: "1px solid var(--astra-brand-border)" }}
      aria-label={t("review_currentPageProgressTitle")}
    >
      <div style={currentPageLoopTitleStyle}>{t("review_currentPageProgressTitle")}</div>
      <div style={currentPageLoopHintStyle}>{t("review_currentPageProgressHint")}</div>
      <div style={currentPageLoopMetaStyle}>
        {studyLoop.completionPercent}% — {studyLoop.completedSteps.length > 0
          ? studyLoop.completedSteps.map((step) => getStepLabel(step)).join(" → ")
          : t("popup_studyNoStepsYet")}
      </div>
      <div style={currentPageLoopCountersStyle}>
        <span>{t("popup_studyStatExplained", studyLoop.currentCounts.sentencesExplained.toString())}</span>
        <span>{t("popup_studyStatSaved", studyLoop.currentCounts.vocabSaved.toString())}</span>
        <span>{t("popup_studyStatReviewed", studyLoop.currentCounts.vocabReviewed.toString())}</span>
      </div>
      {studyLoop.nextStep && (
        <div style={currentPageLoopNextStyle}>
          {t("popup_studyNext")} {getStepLabel(studyLoop.nextStep)}
        </div>
      )}
      {studyLoop.personalizedStrategy && (
        <div data-testid="review-personalized-strategy-card" style={reviewPersonalizedStrategyStyle}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "var(--astra-brand-hover)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
            Personalized strategy
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--astra-brand-active)", marginBottom: 4 }}>
            {studyLoop.personalizedStrategy.label}
          </div>
          <div style={{ fontSize: 11, color: "var(--astra-brand-active)", lineHeight: 1.45 }}>
            {studyLoop.personalizedStrategy.hint}
          </div>
          <div style={{ fontSize: 10, color: "var(--astra-text-muted)", marginTop: 6 }}>
            {studyLoop.personalizedStrategy.evidence}
          </div>
        </div>
      )}
    </div>
  )
}

function getReviewStudyLoopUrl(entry?: VocabularyEntry | null): string | undefined {
  return entry?.sourceContext?.studyProgressRecordId ?? entry?.url
}

function formatLocalDayLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export default function ReviewMode() {
  const [dueCards, setDueCards] = useState<VocabularyEntry[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [phase, setPhase] = useState<ReviewPhase>("showing-front")
  const [summary, setSummary] = useState<SessionSummary>({ total: 0, correct: 0, incorrect: 0 })
  const [distribution, setDistribution] = useState<BoxDistribution>({ box1: 0, box2: 0, box3: 0, box4: 0, box5: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [dailyPagesStudied, setDailyPagesStudied] = useState(0)
  const [dailySentencesExplained, setDailySentencesExplained] = useState(0)
  const [dailyVocabSaved, setDailyVocabSaved] = useState(0)
  const [dailyVocabReviewed, setDailyVocabReviewed] = useState(0)
  const [dailyStatsDate, setDailyStatsDate] = useState("")
  const [dailyStatsInfoOpen, setDailyStatsInfoOpen] = useState(false)
  const [snippetExpanded, setSnippetExpanded] = useState(false)
  const [studyLoop, setStudyLoop] = useState<StudyLoopViewModel | null>(null)
  const [ownedReadingItems, setOwnedReadingItems] = useState<OwnedReadingItem[]>([])
  const [reviewQuery] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const loop = params.get("loop")?.trim() ?? ""
    return {
      focusedEntryId: params.get("entryId")?.trim() ?? "",
      pageLoopStudyUrl: loop === "page" ? params.get("studyUrl")?.trim() ?? "" : "",
    }
  })
  const focusedEntryId = reviewQuery.focusedEntryId
  const pageLoopStudyUrl = reviewQuery.pageLoopStudyUrl
  const isPageReviewLoop = !!pageLoopStudyUrl
  const [focusedReviewError, setFocusedReviewError] = useState<string | null>(null)
  const [focusedReviewedEntry, setFocusedReviewedEntry] = useState<VocabularyEntry | null>(null)

  const loadDueCards = useCallback(async () => {
    const [entries, linkedItems] = await Promise.all([
      getVocabularyEntries(),
      listOwnedReadingItems(),
    ])
    const focusedEntry = focusedEntryId
      ? entries.find((entry) => entry.id === focusedEntryId) ?? null
      : null
    const pageLoopCards = isPageReviewLoop
      ? getPageReviewVocabularyEntries(entries, pageLoopStudyUrl, focusedEntryId)
      : []
    const due = isPageReviewLoop ? pageLoopCards : focusedEntry ? [focusedEntry] : getDueCards(entries)
    setOwnedReadingItems(linkedItems)
    setDueCards(due)
    setDistribution(getBoxDistribution(entries))
    setCurrentIndex(0)
    setPhase(due.length > 0 ? "showing-front" : "session-complete")
    setSummary({ total: 0, correct: 0, incorrect: 0 })
    setFocusedReviewedEntry(null)
    setFocusedReviewError(
      focusedEntryId && !focusedEntry
        ? t("review_focusedFallbackMissingCard")
        : isPageReviewLoop && pageLoopCards.length === 0
          ? t("review_pageLoopNoCards")
          : null,
    )
    const progress = await getStudyProgress()
    setDailyStatsDate(progress.dailyStats.date)
    setDailyPagesStudied(progress.dailyStats.pagesStudied)
    setDailySentencesExplained(progress.dailyStats.sentencesExplained)
    setDailyVocabSaved(progress.dailyStats.vocabSaved)
    setDailyVocabReviewed(progress.dailyStats.vocabReviewed)
    setStudyLoop(deriveStudyLoopViewModel(progress, isPageReviewLoop ? pageLoopStudyUrl : getReviewStudyLoopUrl(due[0])))
    setSnippetExpanded(false)
    setLoading(false)
  }, [focusedEntryId, isPageReviewLoop, pageLoopStudyUrl])

  useEffect(() => {
    void loadDueCards()
  }, [loadDueCards])

  const currentCard = dueCards[currentIndex] ?? null

  const handleAnswer = useCallback(async (correct: boolean) => {
    if (!currentCard) return

    const isFocusedReviewAnswer = !!focusedEntryId && !isPageReviewLoop && currentCard.id === focusedEntryId
    const fields = toSrsFields(currentCard)
    const updated = applyReview(fields, { correct })

    await updateVocabularyEntry(currentCard.id, {
      srsBox: updated.srsBox,
      nextReviewAt: updated.nextReviewAt,
      reviewCount: updated.reviewCount,
      lastReviewedAt: updated.lastReviewedAt,
    })

    const reviewedEntry: VocabularyEntry = {
      ...currentCard,
      srsBox: updated.srsBox,
      nextReviewAt: updated.nextReviewAt,
      reviewCount: updated.reviewCount,
      lastReviewedAt: updated.lastReviewedAt,
    }

    const studyEvent = buildVocabularyReviewStudyEvent(currentCard)
    if (studyEvent) {
      recordLearningLoopEvent("review_answered", {
        pageUrl: studyEvent.url,
        correct,
        source: isPageReviewLoop ? "page_saved_sentence_loop" : isFocusedReviewAnswer ? "focused_saved_sentence" : "review",
        entryId: currentCard.id,
        ...buildPersonalizedStrategyTelemetry(studyLoop?.personalizedStrategy),
      })
      await recordStudyEvent(studyEvent).catch(() => undefined)
    }
    void commitLearningContinuitySync("review-answer")

    setSummary((prev) => ({
      total: prev.total + 1,
      correct: prev.correct + (correct ? 1 : 0),
      incorrect: prev.incorrect + (correct ? 0 : 1),
    }))

    if (isFocusedReviewAnswer) {
      const entries = await getVocabularyEntries()
      setDistribution(getBoxDistribution(entries))
      const progress = await getStudyProgress()
      setDailyStatsDate(progress.dailyStats.date)
      setDailyPagesStudied(progress.dailyStats.pagesStudied)
      setDailySentencesExplained(progress.dailyStats.sentencesExplained)
      setDailyVocabSaved(progress.dailyStats.vocabSaved)
      setDailyVocabReviewed(progress.dailyStats.vocabReviewed)
      setStudyLoop(deriveStudyLoopViewModel(progress, getReviewStudyLoopUrl(currentCard)))
      setFocusedReviewedEntry(reviewedEntry)
      setPhase("session-complete")
      return
    }

    const nextIndex = currentIndex + 1
    if (nextIndex >= dueCards.length) {
      // Refresh distribution after session ends
      const entries = await getVocabularyEntries()
      setDistribution(getBoxDistribution(entries))
      const progress = await getStudyProgress()
      setDailyStatsDate(progress.dailyStats.date)
      setDailyPagesStudied(progress.dailyStats.pagesStudied)
      setDailySentencesExplained(progress.dailyStats.sentencesExplained)
      setDailyVocabSaved(progress.dailyStats.vocabSaved)
      setDailyVocabReviewed(progress.dailyStats.vocabReviewed)
      setStudyLoop(deriveStudyLoopViewModel(progress, isPageReviewLoop ? pageLoopStudyUrl : undefined))
      setFocusedReviewedEntry(isPageReviewLoop ? (dueCards.find((entry) => entry.id === focusedEntryId) ?? dueCards[0] ?? reviewedEntry) : null)
      setPhase("session-complete")
    } else {
      const progress = await getStudyProgress()
      setDailyStatsDate(progress.dailyStats.date)
      setDailyPagesStudied(progress.dailyStats.pagesStudied)
      setDailySentencesExplained(progress.dailyStats.sentencesExplained)
      setDailyVocabSaved(progress.dailyStats.vocabSaved)
      setDailyVocabReviewed(progress.dailyStats.vocabReviewed)
      setStudyLoop(deriveStudyLoopViewModel(progress, isPageReviewLoop ? pageLoopStudyUrl : getReviewStudyLoopUrl(dueCards[nextIndex])))
      setCurrentIndex(nextIndex)
      setPhase("showing-front")
      setSnippetExpanded(false)
    }
  }, [currentCard, currentIndex, dueCards, focusedEntryId, isPageReviewLoop, pageLoopStudyUrl])

  const handleFlip = useCallback(() => {
    if (phase === "showing-front") {
      setPhase("showing-back")
    }
  }, [phase])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase === "session-complete") return

      if (e.code === "Space") {
        e.preventDefault()
        if (phase === "showing-front") {
          handleFlip()
        }
      } else if (e.code === "ArrowLeft" && phase === "showing-back") {
        e.preventDefault()
        void handleAnswer(false)
      } else if (e.code === "ArrowRight" && phase === "showing-back") {
        e.preventDefault()
        void handleAnswer(true)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [phase, handleFlip, handleAnswer])

  if (loading) {
    return (
      <div style={containerStyle}>
        <p style={{ color: "var(--astra-text-hint)", textAlign: "center" }}>Loading...</p>
      </div>
    )
  }

  const dueCount = dueCards.length - currentIndex
  const totalDue = phase === "session-complete" ? 0 : dueCount
  const focusedReturnEntry = phase === "session-complete" ? focusedReviewedEntry : null
  const canReturnToFocusedSentence = !!focusedReturnEntry
    && !!focusedReturnEntry.sourceContext?.sentenceText
    && !!(focusedReturnEntry.sourceContext?.pageUrl ?? focusedReturnEntry.url)?.trim()
  const sourceDisplay = currentCard
    ? deriveVocabularySourceDisplay(currentCard)
    : { surfaceLabel: null, sourceLabel: "", snippet: "", articleExcerpt: "", contentSummary: "", explainProfileLabel: "", glossaryEvidenceLabel: "", pageUrl: "", hostname: "", sourceContext: undefined, ownedReadingItemId: "", ownedReadingSourceType: undefined, ownedReadingTitle: "", studyProgressRecordId: "" }
  const linkedReadingItem = currentCard ? matchOwnedReadingItemForVocabularyEntry(ownedReadingItems, currentCard) : null
  const linkedReadingResumeTarget = linkedReadingItem ? buildOwnedReadingResumeTarget(linkedReadingItem) : null
  const completedPageReadingItem = isPageReviewLoop && focusedReturnEntry
    ? matchOwnedReadingItemForVocabularyEntry(ownedReadingItems, focusedReturnEntry)
    : null
  const completedPageResumeTarget = completedPageReadingItem ? buildOwnedReadingResumeTarget(completedPageReadingItem) : null
  const linkedReadingProgress = linkedReadingItem ? describeOwnedReadingProgress(linkedReadingItem) : null
  const currentPageLoop = studyLoop
  const snippetLong = sourceDisplay.snippet.length > 300
  const sourcePageIsWeb = /^https?:\/\//i.test(sourceDisplay.pageUrl)

  const hasDailyProgress =
    dailyPagesStudied > 0
    || dailySentencesExplained > 0
    || dailyVocabSaved > 0
    || dailyVocabReviewed > 0
  const dailyStatsLabel = dailyStatsDate ? formatLocalDayLabel(dailyStatsDate) : ""

  const handleResumeLinkedReading = async () => {
    if (!linkedReadingItem || !linkedReadingResumeTarget) return
    await handleResumeReadingItem(linkedReadingItem, linkedReadingResumeTarget)
  }

  const handleResumeCompletedPageReading = async () => {
    if (!completedPageReadingItem || !completedPageResumeTarget) return
    await handleResumeReadingItem(completedPageReadingItem, completedPageResumeTarget)
  }

  const handleResumeReadingItem = async (item: OwnedReadingItem, target: NonNullable<ReturnType<typeof buildOwnedReadingResumeTarget>>) => {
    await markOwnedReadingOpened(item.id)
    recordLearningLoopEvent("resumed_reading", {
      ownedReadingItemId: item.id,
      pageUrl: target.url,
      sourceType: item.sourceType,
      source: "review",
      ...buildPersonalizedStrategyTelemetry(studyLoop?.personalizedStrategy),
    })
    void browser.tabs.create({ url: target.url })
  }

  return (
    <div style={containerStyle}>
      <ReviewStats distribution={distribution} dueCount={totalDue} />

      {hasDailyProgress && (
        <div className="astra-progress-panel" aria-label={t("review_todayProgressAria")}>
          <div className="astra-progress-header">
            <div style={dailyProgressTitleStyle}>{t("review_todayProgressTitle")}</div>
            <button
              type="button"
              onClick={() => setDailyStatsInfoOpen((current) => !current)}
              aria-expanded={dailyStatsInfoOpen}
              className="astra-btn-info"
            >
              {t("popup_studyTodayStatsInfoAction")}
            </button>
          </div>
          <div style={{ fontSize: 11, color: "var(--astra-text-decorative)", marginBottom: 8 }}>
            {t("popup_studyTodayStatsHint", dailyStatsLabel || dailyStatsDate)}
          </div>
          {dailyStatsInfoOpen && (
            <div style={{ fontSize: 11, color: "var(--astra-text-muted)", lineHeight: 1.6, marginBottom: 8 }}>
              {t("popup_studyTodayStatsResetBoundary")}
            </div>
          )}
          <div className="astra-progress-row">
            <span>{t("popup_studyStatPages", dailyPagesStudied.toString())}</span>
            <span>{t("popup_studyStatExplained", dailySentencesExplained.toString())}</span>
            <span>{t("popup_studyStatSaved", dailyVocabSaved.toString())}</span>
            <span>{t("popup_studyStatReviewed", dailyVocabReviewed.toString())}</span>
          </div>
        </div>
      )}

      {focusedReviewError && (
        <div style={{ ...emptyStateStyle, padding: "14px 16px", marginBottom: 12 }}>
          {focusedReviewError}
        </div>
      )}

      {phase === "session-complete" && summary.total === 0 && (
        <div style={emptyStateStyle}>
          <div style={{ fontSize: 18, marginBottom: 8 }}>{t("review_emptyCaughtUpTitle")}</div>
          <div>{t("review_emptyCaughtUpHint")}</div>
        </div>
      )}

      {phase === "session-complete" && summary.total > 0 && (
        <div className="astra-card" style={{ textAlign: "center", padding: "24px 20px" }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "var(--astra-text-primary)" }}>
            {focusedReviewedEntry ? (isPageReviewLoop ? t("review_pageLoopCompleteTitle") : t("review_focusedCompleteTitle")) : t("review_sessionCompleteTitle")}
          </div>
          {focusedReviewedEntry && (
            <div style={{ fontSize: 13, color: "var(--astra-text-secondary)", lineHeight: 1.5, marginBottom: 12 }}>
              {isPageReviewLoop ? t("review_pageLoopCompleteHint") : t("review_focusedCompleteHint")}
            </div>
          )}
          <div style={summaryRowStyle}>
            <span>{t("review_summaryCardsReviewed")}</span>
            <strong>{summary.total}</strong>
          </div>
          <div style={summaryRowStyle}>
            <span style={{ color: "var(--astra-success)" }}>{t("review_summaryCorrect")}</span>
            <strong style={{ color: "var(--astra-success)" }}>{summary.correct}</strong>
          </div>
          <div style={summaryRowStyle}>
            <span style={{ color: "var(--astra-danger)" }}>{t("review_summaryIncorrect")}</span>
            <strong style={{ color: "var(--astra-danger)" }}>{summary.incorrect}</strong>
          </div>
          {canReturnToFocusedSentence && focusedReturnEntry && (
            <button
              data-testid="review-return-deep-read"
              type="button"
              className="astra-btn-primary"
              style={{ marginTop: 16, padding: "8px 24px" }}
              onClick={() => void openVocabularyEntryInDeepRead(focusedReturnEntry)}
            >
              {t("review_returnToDeepReadSentence")}
            </button>
          )}
          {completedPageResumeTarget && (
            <button
              data-testid="review-resume-page-reading"
              type="button"
              className={canReturnToFocusedSentence ? "astra-btn-secondary" : "astra-btn-primary"}
              style={{ marginTop: 16, marginLeft: canReturnToFocusedSentence ? 8 : 0, padding: "8px 24px" }}
              onClick={() => void handleResumeCompletedPageReading()}
            >
              {t("review_resumeReadingThisPage")}
            </button>
          )}
          <button
            type="button"
            className={canReturnToFocusedSentence || completedPageResumeTarget ? "astra-btn-secondary" : "astra-btn-primary"}
            style={{ marginTop: 16, marginLeft: canReturnToFocusedSentence || completedPageResumeTarget ? 8 : 0, padding: "8px 24px" }}
            onClick={() => void loadDueCards()}
          >
            {t("review_actionReviewAgain")}
          </button>
        </div>
      )}

      {phase !== "session-complete" && currentCard && (
        <>
          <div style={progressTextStyle}>
            {t("review_cardProgress", [`${currentIndex + 1}`, `${dueCards.length}`])}
            <span style={{ marginLeft: 8, fontSize: 11, color: "var(--astra-text-decorative)" }}>
              {t("review_boxLabel", `${currentCard.srsBox ?? 1}`)}
            </span>
          </div>

          {currentPageLoop && <CurrentPageLoopCard studyLoop={currentPageLoop} />}

          <div
            data-testid="review-card"
            className={`astra-flashcard-flip ${phase === "showing-back" ? "astra-flashcard-flip--revealed" : "astra-flashcard-flip--front"}`}
            style={flashcardStyle}
            onClick={phase === "showing-front" ? handleFlip : undefined}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && phase === "showing-front") {
                e.preventDefault()
                handleFlip()
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={phase === "showing-front"
              ? `${currentCard.text}. Press Enter or Space to flip.`
              : `${currentCard.text}. Answer shown.`}
          >
            <div style={wordTextStyle}>{currentCard.text}</div>

            {currentCard.hostname && (
              <span style={hostnameTagStyle}>{currentCard.hostname}</span>
            )}

            {phase === "showing-back" && (
              <div className="astra-flashcard-flip__back" style={backContentStyle}>
                {currentCard.translation && (
                  <div style={translationTextStyle}>{currentCard.translation}</div>
                )}
                {currentCard.explanation && (
                  <div style={explanationTextStyle}>{currentCard.explanation}</div>
                )}
                {sourceDisplay.surfaceLabel && (
                  <div style={{ fontSize: 11, color: "var(--astra-brand)", fontWeight: 700, marginBottom: 6 }}>
                    {sourceDisplay.surfaceLabel}
                  </div>
                )}
                {sourceDisplay.explainProfileLabel && (
                  <div data-testid="review-explain-profile" style={{ fontSize: 11, color: "var(--astra-brand-active)", fontWeight: 700, marginBottom: 6 }}>
                    {sourceDisplay.explainProfileLabel}
                  </div>
                )}
                {sourceDisplay.glossaryEvidenceLabel && (
                  <div data-testid="review-glossary-evidence" style={{ fontSize: 11, color: "var(--astra-success)", fontWeight: 700, marginBottom: 6 }}>
                    {sourceDisplay.glossaryEvidenceLabel}
                  </div>
                )}
                {sourceDisplay.sourceLabel && (
                  <div style={{ fontSize: 12, color: "var(--astra-text-secondary)", fontWeight: 600, marginBottom: 6 }}>
                    {sourceDisplay.sourceLabel}
                  </div>
                )}
                {sourceDisplay.snippet && (
                  <div style={contextTextStyle}>
                    {snippetLong && !snippetExpanded
                      ? `${sourceDisplay.snippet.slice(0, 300)}...`
                      : sourceDisplay.snippet}
                  </div>
                )}
                {snippetLong && (
                  <button
                    type="button"
                    onClick={() => setSnippetExpanded((v) => !v)}
                    className="astra-btn-link"
                    style={{ marginTop: 6 }}
                  >
                    {snippetExpanded ? t("review_hideFullContext") : t("review_showFullContext")}
                  </button>
                )}
                {linkedReadingItem && (
                  <div style={{ ...contextTextStyle, marginTop: 8, background: "var(--astra-brand-muted)", border: "1px solid var(--astra-brand-border)", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: 12, color: "var(--astra-text-secondary)", fontWeight: 700, marginBottom: 4 }}>
                      {t("vocabulary_readingAssetTitle")}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--astra-text-secondary)", fontWeight: 600, marginBottom: 4 }}>
                      {linkedReadingItem.title} · {getOwnedReadingSourceTypeLabel(linkedReadingItem.sourceType)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginBottom: linkedReadingProgress ? 4 : 8 }}>
                      {describeOwnedReadingResumeBehavior(linkedReadingItem)}
                    </div>
                    {linkedReadingProgress && (
                      <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginBottom: 8 }}>
                        {linkedReadingProgress}
                      </div>
                    )}
                    {linkedReadingResumeTarget && (
                      <button
                        type="button"
                        onClick={() => void handleResumeLinkedReading()}
                        className="astra-btn-secondary"
                        style={{ marginTop: 2, padding: "6px 12px", fontSize: 12 }}
                      >
                        {t("vocabulary_actionResumeReadingAsset")}
                      </button>
                    )}
                  </div>
                )}
                {currentCard.sourceContext?.surface === "popup_deep_read" && (
                  <button
                    type="button"
                    onClick={() => void openVocabularyEntryInDeepRead(currentCard)}
                    className="astra-btn-secondary"
                    style={{ marginTop: 8, padding: "6px 12px", fontSize: 12 }}
                  >
                    {t("vocabulary_actionOpenDeepRead")}
                  </button>
                )}
                {(sourceDisplay.articleExcerpt || sourceDisplay.contentSummary || sourceDisplay.hostname || sourceDisplay.pageUrl) && (
                  <div style={{ ...contextTextStyle, marginTop: 8 }}>
                    {sourceDisplay.hostname && (
                      <div style={{ fontSize: 11, color: "var(--astra-text-hint)", marginBottom: 4 }}>
                        {t("vocabulary_sourceHostLabel")} {sourceDisplay.hostname}
                      </div>
                    )}
                    {sourceDisplay.pageUrl && (
                      <div style={{ fontSize: 11, color: "var(--astra-text-hint)", marginBottom: 4, wordBreak: "break-all" }}>
                        {sourcePageIsWeb ? t("vocabulary_sourceUrlLabel") : t("vocabulary_sourceFileLabel")} {sourceDisplay.pageUrl}
                      </div>
                    )}
                    {sourceDisplay.articleExcerpt && (
                      <div style={{ marginBottom: sourceDisplay.contentSummary ? 6 : 0 }}>
                        {t("vocabulary_sourceExcerptLabel")} {sourceDisplay.articleExcerpt}
                      </div>
                    )}
                    {sourceDisplay.contentSummary && (
                      <div>{t("vocabulary_sourceSummaryLabel")} {sourceDisplay.contentSummary}</div>
                    )}
                  </div>
                )}
                {sourcePageIsWeb && (
                  <a
                    href={sourceDisplay.pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={sourceLinkStyle}
                  >
                    {t("review_openSourcePage")}
                  </a>
                )}
              </div>
            )}

            {phase === "showing-front" && (
              <div className="astra-flashcard-flip__hint" style={flipHintStyle}>
                {t("review_flipHint")}
              </div>
            )}
          </div>

          {phase === "showing-back" && (
            <div style={buttonRowStyle}>
              <button
                type="button"
                className="astra-review-answer-wrong"
                onClick={() => void handleAnswer(false)}
              >
                {t("review_answerDontKnow")}
              </button>
              <button
                type="button"
                className="astra-review-answer-right"
                onClick={() => void handleAnswer(true)}
              >
                {t("review_answerKnowIt")}
              </button>
            </div>
          )}

          <div style={keyboardHintStyle}>
            {phase === "showing-front"
              ? t("review_keyboardHintFront")
              : t("review_keyboardHintBack")}
          </div>
        </>
      )}
    </div>
  )
}

// --- Styles ---

const dailyProgressTitleStyle: React.CSSProperties = {
  fontSize: "var(--astra-text-xs)",
  fontWeight: 700,
  color: "var(--astra-text-secondary)",
}

const currentPageLoopTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--astra-brand-active)",
  marginBottom: 4,
}

const currentPageLoopHintStyle: React.CSSProperties = {
  fontSize: 10,
  color: "var(--astra-text-muted)",
  marginBottom: 8,
}

const currentPageLoopMetaStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--astra-text-primary)",
  marginBottom: 8,
}

const currentPageLoopCountersStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "6px 10px",
  fontSize: 11,
  color: "var(--astra-text-secondary)",
  fontWeight: 600,
}

const currentPageLoopNextStyle: React.CSSProperties = {
  marginTop: 8,
  fontSize: 11,
  color: "var(--astra-brand)",
  fontWeight: 600,
}

const reviewPersonalizedStrategyStyle: React.CSSProperties = {
  marginTop: 10,
  padding: "10px 12px",
  background: "var(--astra-brand-muted)",
  border: "1px solid var(--astra-brand-border)",
  borderRadius: 10,
}

const containerStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
}

const emptyStateStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "48px 20px",
  color: "var(--astra-text-decorative)",
  fontSize: 15,
}

// summaryCardStyle — now using className="astra-card"

const summaryRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "6px 0",
  fontSize: 14,
  color: "var(--astra-text-secondary)",
  borderBottom: "1px solid var(--astra-border)",
}

// restartButtonStyle — now using className="astra-btn-primary"

const progressTextStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--astra-text-muted)",
  marginBottom: 10,
  textAlign: "center",
}

const flashcardStyle: React.CSSProperties = {
  border: "1px solid var(--astra-border)",
  borderRadius: "var(--astra-radius-lg)",
  padding: "32px 24px",
  background: "var(--astra-bg-card)",
  textAlign: "center",
  minHeight: 160,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  userSelect: "none",
  position: "relative",
}

const wordTextStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  color: "var(--astra-text-primary)",
  marginBottom: 8,
}

const hostnameTagStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--astra-text-hint)",
  background: "var(--astra-bg-hover)",
  borderRadius: 4,
  padding: "2px 8px",
  marginBottom: 12,
}

const backContentStyle: React.CSSProperties = {
  marginTop: 16,
  width: "100%",
}

const translationTextStyle: React.CSSProperties = {
  fontSize: "var(--astra-text-lg)",
  color: "var(--astra-brand)",
  fontWeight: 600,
  marginBottom: 8,
}

const explanationTextStyle: React.CSSProperties = {
  fontSize: 14,
  color: "var(--astra-text-secondary)",
  marginBottom: 8,
  lineHeight: 1.5,
}

const contextTextStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--astra-text-muted)",
  fontStyle: "italic",
  lineHeight: 1.4,
  marginBottom: 8,
}

const sourceLinkStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--astra-text-hint)",
  textDecoration: "underline",
}

const flipHintStyle: React.CSSProperties = {
  marginTop: 24,
  fontSize: 13,
  color: "var(--astra-text-decorative)",
}

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  justifyContent: "center",
  marginTop: 16,
}

const keyboardHintStyle: React.CSSProperties = {
  textAlign: "center",
  fontSize: 11,
  color: "var(--astra-text-decorative)",
  marginTop: 10,
}
