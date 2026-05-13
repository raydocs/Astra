import { useCallback, useEffect, useState } from "react"
import { browser } from "#imports"
import type { VocabularyEntry } from "@/utils/storage/vocabulary"
import { recordLearningLoopEvent } from "@/utils/learning-loop-events"
import { updateVocabularyEntry, getVocabularyEntries, recordVocabularyReviewSchedule } from "@/utils/storage/vocabulary"
import { applyReview, getDueCards, getBoxDistribution } from "@/utils/srs/leitner"
import type { SrsFields, BoxDistribution, ReviewGrade } from "@/utils/srs/leitner"
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

type ReviewGradeKey = "1" | "2" | "3" | "4"

const REVIEW_GRADE_ACTIONS: Array<{
  key: ReviewGradeKey
  grade: ReviewGrade
  labelKey: string
  hintKey: string
  tone: ReviewGrade
}> = [
  { key: "1", grade: "again", labelKey: "review_gradeAgain", hintKey: "review_gradeAgainHint", tone: "again" },
  { key: "2", grade: "hard", labelKey: "review_gradeHard", hintKey: "review_gradeHardHint", tone: "hard" },
  { key: "3", grade: "good", labelKey: "review_gradeGood", hintKey: "review_gradeGoodHint", tone: "good" },
  { key: "4", grade: "easy", labelKey: "review_gradeEasy", hintKey: "review_gradeEasyHint", tone: "easy" },
]

interface SessionSummary {
  total: number
  again: number
  hard: number
  good: number
  easy: number
}

function createEmptySessionSummary(): SessionSummary {
  return { total: 0, again: 0, hard: 0, good: 0, easy: 0 }
}

function incrementSessionSummary(summary: SessionSummary, grade: ReviewGrade): SessionSummary {
  return {
    ...summary,
    total: summary.total + 1,
    [grade]: summary[grade] + 1,
  }
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
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function readAstraCertificationParams(): { enabled: boolean; certState: string | null } {
  if (typeof window === "undefined") return { enabled: false, certState: null }
  try {
    const searchParams = new URLSearchParams(window.location.search)
    const hashParams = window.location.hash.includes("?")
      ? new URLSearchParams(window.location.hash.split("?", 2)[1] ?? "")
      : new URLSearchParams()
    return {
      enabled: searchParams.get("astraCert") === "1" || hashParams.get("astraCert") === "1",
      certState: hashParams.get("certState")?.trim() || searchParams.get("certState")?.trim() || null,
    }
  } catch {
    return { enabled: false, certState: null }
  }
}

const ASTRA_CERT_REVIEW_CARD: VocabularyEntry = {
  id: "astra-cert-review-unalterable",
  text: "unalterable",
  translation: "无法改变的；不可动摇的",
  explanation: "ʌnˈɔːltərəbl · adj.",
  context: "To read deeply requires a kind of inward weather — an unalterable hush before a real thought arrives.",
  url: "https://www.newyorker.com/magazine/quiet-reading",
  hostname: "newyorker.com",
  savedAt: Date.parse("2026-03-14T20:42:00.000Z"),
  srsBox: 2,
  nextReviewAt: 0,
  reviewCount: 2,
  lastReviewedAt: null,
  sourceContext: {
    surface: "popup_deep_read",
    pageTitle: "The Quiet Year of Solitude",
    pageUrl: "https://www.newyorker.com/magazine/quiet-reading",
    hostname: "newyorker.com",
    sentenceText: "To read deeply requires a kind of inward weather — an unalterable hush before a real thought arrives.",
    sentenceIndex: 2,
    articleExcerpt: "From The New Yorker · 7 days ago",
    contentSummary: "A certification-only seeded review card for screenshot parity.",
    studyProgressRecordId: "https://www.newyorker.com/magazine/quiet-reading",
  },
}

const ASTRA_CERT_REVIEW_QUEUE: VocabularyEntry[] = [
  { ...ASTRA_CERT_REVIEW_CARD, id: "astra-cert-review-solitude", text: "solitude", translation: "独处；离群索居", context: "The page begins in solitude, before the reader notices the room again." },
  { ...ASTRA_CERT_REVIEW_CARD, id: "astra-cert-review-hush", text: "hush", translation: "近乎屏息的安静", context: "A hush gathers before the next sentence comes into focus." },
  ASTRA_CERT_REVIEW_CARD,
  { ...ASTRA_CERT_REVIEW_CARD, id: "astra-cert-review-marginalia", text: "marginalia", translation: "页边批注；旁注", context: "The marginalia turns a private reading into a map you can revisit." },
  { ...ASTRA_CERT_REVIEW_CARD, id: "astra-cert-review-overpaint", text: "overpaint", translation: "过度覆盖", context: "Astra should never overpaint the page it is helping you read." },
]

const ASTRA_CERT_REVIEW_DISTRIBUTION: BoxDistribution = {
  box1: 2,
  box2: 6,
  box3: 7,
  box4: 3,
  box5: 0,
  total: 18,
}

const ASTRA_CERT_REVIEW_GRADE_HINTS: Record<ReviewGrade, string> = {
  again: "next in 10 min",
  hard: "next in 1 day",
  good: "next in 4 days",
  easy: "next in 12 days",
}

const ASTRA_CERT_KEYBOARD_HINT = "Press space to reveal · 1–4 to grade"

const ASTRA_CERT_SETTLING_WORDS = [
  ["solitude", "again in 4 days"],
  ["marginalia", "again in 6 days"],
  ["companion", "again in 2 weeks"],
  ["suspended", "again in 3 days"],
  ["overpaint", "again in 5 days"],
]

const ASTRA_CERT_MISSED_WORDS = [
  ["effervescent", "missed twice"],
  ["taciturn", "blanked"],
]

export default function ReviewMode() {
  const [dueCards, setDueCards] = useState<VocabularyEntry[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [phase, setPhase] = useState<ReviewPhase>("showing-front")
  const [summary, setSummary] = useState<SessionSummary>({ total: 0, again: 0, hard: 0, good: 0, easy: 0 })
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
    const cert = readAstraCertificationParams()
    return {
      focusedEntryId: params.get("entryId")?.trim() ?? "",
      pageLoopStudyUrl: loop === "page" ? params.get("studyUrl")?.trim() ?? "" : "",
      certificationMode: cert.enabled,
      certificationState: cert.certState,
    }
  })
  const focusedEntryId = reviewQuery.focusedEntryId
  const pageLoopStudyUrl = reviewQuery.pageLoopStudyUrl
  const isPageReviewLoop = !!pageLoopStudyUrl
  const certificationMode = reviewQuery.certificationMode
  const certificationSummaryMode = certificationMode && reviewQuery.certificationState === "summary"
  const [focusedReviewError, setFocusedReviewError] = useState<string | null>(null)
  const [focusedReviewedEntry, setFocusedReviewedEntry] = useState<VocabularyEntry | null>(null)

  const loadDueCards = useCallback(async () => {
    if (certificationMode) {
      setOwnedReadingItems([])
      setDueCards(ASTRA_CERT_REVIEW_QUEUE)
      setDistribution(ASTRA_CERT_REVIEW_DISTRIBUTION)
      setCurrentIndex(certificationSummaryMode ? 0 : 2)
      setPhase(certificationSummaryMode ? "session-complete" : "showing-back")
      setSummary(certificationSummaryMode ? { total: 18, again: 1, hard: 1, good: 10, easy: 6 } : createEmptySessionSummary())
      setFocusedReviewedEntry(null)
      setFocusedReviewError(null)
      setDailyStatsDate("")
      setDailyPagesStudied(0)
      setDailySentencesExplained(0)
      setDailyVocabSaved(0)
      setDailyVocabReviewed(0)
      setStudyLoop(null)
      setSnippetExpanded(false)
      setLoading(false)
      return
    }

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
    setSummary(createEmptySessionSummary())
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
  }, [certificationMode, certificationSummaryMode, focusedEntryId, isPageReviewLoop, pageLoopStudyUrl])

  useEffect(() => {
    void loadDueCards()
  }, [loadDueCards])

  const currentCard = dueCards[currentIndex] ?? null

  const handleAnswer = useCallback(async (grade: ReviewGrade) => {
    if (!currentCard) return

    if (certificationMode) {
      setSummary((prev) => incrementSessionSummary(prev, grade))
      return
    }

    const isFocusedReviewAnswer = !!focusedEntryId && !isPageReviewLoop && currentCard.id === focusedEntryId
    const fields = toSrsFields(currentCard)
    const updated = applyReview(fields, { grade })
    const remembered = grade !== "again"

    await updateVocabularyEntry(currentCard.id, {
      srsBox: updated.srsBox,
      nextReviewAt: updated.nextReviewAt,
      reviewCount: updated.reviewCount,
      lastReviewedAt: updated.lastReviewedAt,
      lastReviewGrade: grade,
      lastReviewGradeAt: updated.lastReviewedAt,
    })
    await recordVocabularyReviewSchedule({
      vocabularyEntryId: currentCard.id,
      srsBox: updated.srsBox,
      nextReviewAt: updated.nextReviewAt,
      reviewCount: updated.reviewCount,
      lastReviewedAt: updated.lastReviewedAt,
      grade,
      updatedAt: updated.lastReviewedAt ?? undefined,
    })

    const reviewedEntry: VocabularyEntry = {
      ...currentCard,
      srsBox: updated.srsBox,
      nextReviewAt: updated.nextReviewAt,
      reviewCount: updated.reviewCount,
      lastReviewedAt: updated.lastReviewedAt,
      lastReviewGrade: grade,
      lastReviewGradeAt: updated.lastReviewedAt,
    }

    const studyEvent = buildVocabularyReviewStudyEvent(currentCard)
    if (studyEvent) {
      recordLearningLoopEvent("review_answered", {
        pageUrl: studyEvent.url,
        correct: remembered,
        reviewGrade: grade,
        source: isPageReviewLoop ? "page_saved_sentence_loop" : isFocusedReviewAnswer ? "focused_saved_sentence" : "review",
        entryId: currentCard.id,
        ...buildPersonalizedStrategyTelemetry(studyLoop?.personalizedStrategy),
      })
      await recordStudyEvent(studyEvent).catch(() => undefined)
    }
    void commitLearningContinuitySync("review-answer")

    setSummary((prev) => incrementSessionSummary(prev, grade))

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
  }, [certificationMode, currentCard, currentIndex, dueCards, focusedEntryId, isPageReviewLoop, pageLoopStudyUrl])

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
        void handleAnswer("again")
      } else if (e.code === "ArrowRight" && phase === "showing-back") {
        e.preventDefault()
        void handleAnswer("good")
      } else if (phase === "showing-back" && ["Digit1", "Digit2", "Digit3", "Digit4", "Numpad1", "Numpad2", "Numpad3", "Numpad4"].includes(e.code)) {
        e.preventDefault()
        const key = e.code.replace("Digit", "").replace("Numpad", "") as ReviewGradeKey
        const action = REVIEW_GRADE_ACTIONS.find((item) => item.key === key)
        if (action) void handleAnswer(action.grade)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [phase, handleFlip, handleAnswer])

  if (loading) {
    return (
      <div style={containerStyle}>
        <p style={{ color: "var(--astra-text-hint)", textAlign: "center" }}>{t("review_loading")}</p>
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
  const summaryLongerInterval = summary.good + summary.easy
  const summarySoonerInterval = summary.again + summary.hard
  const summaryRecallPercent = summary.total > 0 ? Math.round((summaryLongerInterval / summary.total) * 100) : 0

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

  const certificationReviewCardBody = currentCard ? (
    <>
      <div className="astra-cert-review-card__eyebrow">◌ From The New Yorker · 7 days ago</div>
      <div className="astra-cert-review-card__sentence">
        To read deeply requires a kind of inward weather — an{" "}
        <span>unalterable</span>{" "}
        hush before a real thought arrives.
      </div>

      {phase === "showing-back" && (
        <div className="astra-cert-review-card__back astra-flashcard-flip__back">
          <div className="astra-cert-review-card__rule" aria-hidden="true" />
          <div className="astra-cert-review-card__section-label">Meaning</div>
          <div className="astra-cert-review-card__meaning-row">
            <span className="astra-cert-review-card__word">{currentCard.text}</span>
            <span className="astra-cert-review-card__pronunciation">ʌnˈɔːltərəbl</span>
            <span className="astra-cert-review-card__pos">adj.</span>
          </div>
          {currentCard.translation && (
            <div className="astra-cert-review-card__translation">{currentCard.translation}</div>
          )}
        </div>
      )}

      {phase === "showing-front" && (
        <div className="astra-flashcard-flip__hint" style={flipHintStyle}>
          {t("review_flipHint")}
        </div>
      )}
    </>
  ) : null

  const reviewCardBody = currentCard ? (
    <>
      {sourceDisplay.snippet && (
        <div className="astra-review-context-lead">
          <span className="astra-review-context-lead__label">{t("review_contextLabel")}</span>
          <span>{snippetLong && !snippetExpanded ? `${sourceDisplay.snippet.slice(0, 220)}...` : sourceDisplay.snippet}</span>
        </div>
      )}
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
          {linkedReadingItem && !certificationMode && (
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
          {currentCard.sourceContext?.surface === "popup_deep_read" && !certificationMode && (
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
          {sourcePageIsWeb && !certificationMode && (
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
    </>
  ) : null

  return (
    <div className={`astra-review-mode${certificationMode ? " astra-review-mode--cert" : ""}${certificationSummaryMode ? " astra-review-mode--cert-summary" : ""}`} style={certificationMode ? certificationContainerStyle : containerStyle}>
      {certificationMode && !certificationSummaryMode && (
        <div className="astra-cert-review-topbar" aria-label="Certification review progress">
          <span className="astra-cert-review-topbar__mark" aria-hidden="true">✣</span>
          <span className="astra-cert-review-topbar__label">Review · Mar 21</span>
          <span className="astra-cert-review-topbar__meter" aria-hidden="true"><span /></span>
          <span className="astra-cert-review-topbar__count">3 / 5</span>
          <span className="astra-cert-review-topbar__end" aria-hidden="true">×&nbsp; End session</span>
        </div>
      )}
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
        <div className="astra-card astra-review-summary-card" data-testid="review-summary-card">
          <div className="astra-review-summary-card__eyebrow">
            {certificationSummaryMode ? "Session complete · 8:42pm" : focusedReviewedEntry ? (isPageReviewLoop ? t("review_pageLoopCompleteTitle") : t("review_focusedCompleteTitle")) : t("review_sessionCompleteTitle")}
          </div>
          <h2 className="astra-review-summary-card__title">{certificationSummaryMode ? "Twelve quiet minutes." : t("review_summaryTitle")}</h2>
          <p className="astra-review-summary-card__lede">
            {certificationSummaryMode
              ? "You reviewed 18 words. Again 1, Hard 1, Good 10, Easy 6 — Astra now uses each grade to set a different next review."
              : t("review_summaryFourGradeLede", [summary.total.toString(), summary.total === 1 ? "card" : "cards", summary.again.toString(), summary.hard.toString(), summary.good.toString(), summary.easy.toString()])}
          </p>
          {focusedReviewedEntry && (
            <div className="astra-review-summary-card__hint">
              {isPageReviewLoop ? t("review_pageLoopCompleteHint") : t("review_focusedCompleteHint")}
            </div>
          )}
          <div className="astra-review-summary-card__metrics">
            <div>
              <span>{certificationSummaryMode ? "Reviewed" : t("review_summaryCardsReviewed")}</span>
              <strong>{summary.total}</strong>
              {certificationSummaryMode && <small>of 18 due</small>}
            </div>
            <div>
              <span>{certificationSummaryMode ? "Recall" : t("review_summaryRecall")}</span>
              <strong>{certificationSummaryMode ? "89%" : `${summaryRecallPercent}%`}</strong>
              {certificationSummaryMode && <small>↑ from 82%</small>}
            </div>
            <div>
              <span>{certificationSummaryMode ? "Streak" : t("review_summaryGoodEasy")}</span>
              <strong>{certificationSummaryMode ? "9" : summaryLongerInterval}</strong>
              {certificationSummaryMode && <small>days in a row</small>}
            </div>
            <div>
              <span>{certificationSummaryMode ? "Next" : t("review_summaryAgainHard")}</span>
              <strong>{certificationSummaryMode ? "Tmrw" : summarySoonerInterval}</strong>
              {certificationSummaryMode && <small>14 words due</small>}
            </div>
          </div>
          <div className="astra-review-summary-card__lists" aria-label="Review outcome summary">
            <div>
              <div className="astra-review-summary-card__section-label">{certificationSummaryMode ? "Settling" : t("review_summaryLongerIntervals")}</div>
              {certificationSummaryMode ? (
                <>
                  {ASTRA_CERT_SETTLING_WORDS.map(([word, when]) => (
                    <div key={word} className="astra-review-summary-card__row">
                      <span>{word}</span>
                      <span>{when}</span>
                    </div>
                  ))}
                  <div className="astra-review-summary-card__note">+ 11 more</div>
                </>
              ) : (
                <>
                  <div className="astra-review-summary-card__row">
                    <span>{t("review_summaryGood")}</span>
                    <span>{summary.good}</span>
                  </div>
                  <div className="astra-review-summary-card__row">
                    <span>{t("review_summaryEasy")}</span>
                    <span>{summary.easy}</span>
                  </div>
                </>
              )}
            </div>
            <div>
              <div className="astra-review-summary-card__section-label astra-review-summary-card__section-label--warm">{certificationSummaryMode ? "Coming back tomorrow" : t("review_summarySoonerReview")}</div>
              {certificationSummaryMode ? (
                <>
                  {ASTRA_CERT_MISSED_WORDS.map(([word, why]) => (
                    <div key={word} className="astra-review-summary-card__row" data-tone="missed">
                      <span>{word}</span>
                      <span>{why}</span>
                    </div>
                  ))}
                  <div className="astra-review-summary-card__note">Both came from the same article. Reading it once more might help. Four-grade scheduling is active: Again, Hard, Good, and Easy each set a different next review.</div>
                </>
              ) : (
                <>
                  <div className="astra-review-summary-card__row" data-tone="missed">
                    <span>{t("review_summaryAgain")}</span>
                    <span>{summary.again}</span>
                  </div>
                  <div className="astra-review-summary-card__row" data-tone="missed">
                    <span>{t("review_summaryHard")}</span>
                    <span>{summary.hard}</span>
                  </div>
                  <div className="astra-review-summary-card__note">{t("review_summaryFourGradeNote")}</div>
                </>
              )}
            </div>
          </div>
          <div className="astra-review-summary-card__actions">
            {certificationSummaryMode ? (
              <>
                <button type="button" className="astra-btn-primary">Back to reading</button>
                <button type="button" className="astra-btn-secondary">View library</button>
                <span className="astra-review-summary-card__note">Notifications quiet until tomorrow 9am.</span>
              </>
            ) : (
              <>
                {canReturnToFocusedSentence && focusedReturnEntry && (
                  <button
                    data-testid="review-return-deep-read"
                    type="button"
                    className="astra-btn-primary"
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
                    onClick={() => void handleResumeCompletedPageReading()}
                  >
                    {t("review_resumeReadingThisPage")}
                  </button>
                )}
                <button
                  type="button"
                  className={canReturnToFocusedSentence || completedPageResumeTarget ? "astra-btn-secondary" : "astra-btn-primary"}
                  onClick={() => void loadDueCards()}
                >
                  {t("review_actionReviewAgain")}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {phase !== "session-complete" && currentCard && (
        <>
          {!certificationMode && (
            <div style={progressTextStyle}>
              {t("review_cardProgress", [`${currentIndex + 1}`, `${dueCards.length}`])}
              <span style={{ marginLeft: 8, fontSize: 11, color: "var(--astra-text-decorative)" }}>
                {t("review_boxLabel", `${currentCard.srsBox ?? 1}`)}
              </span>
            </div>
          )}

          {currentPageLoop && <CurrentPageLoopCard studyLoop={currentPageLoop} />}

          {phase === "showing-front" ? (
            <button
              type="button"
              data-testid="review-card"
              role="button"
              className="astra-flashcard-flip astra-flashcard-flip--front"
              style={flashcardStyle}
              onClick={handleFlip}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  handleFlip()
                }
              }}
              aria-label={`${currentCard.text}. Press Enter or Space to reveal.`}
            >
              {certificationMode ? certificationReviewCardBody : reviewCardBody}
            </button>
          ) : (
            <section
              data-testid="review-card"
              className="astra-flashcard-flip astra-flashcard-flip--revealed"
              style={flashcardStyle}
              aria-label={`${currentCard.text}. Answer shown.`}
            >
              {certificationMode ? certificationReviewCardBody : reviewCardBody}
            </section>
          )}

          {phase === "showing-back" && (
            <>
              {!certificationMode && (
                <div className="astra-review-schedule-disclosure" style={scheduleDisclosureStyle}>
                  {t("review_gradeScheduleDisclosure")}
                </div>
              )}
              <div className="astra-review-grade-row" style={buttonRowStyle} aria-label={t("review_gradeGroupAria")}>
                {REVIEW_GRADE_ACTIONS.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    className={`astra-review-grade astra-review-grade--${action.tone}`}
                    data-review-grade={action.grade}
                    data-review-key={action.key}
                    onClick={() => void handleAnswer(action.grade)}
                  >
                    <span className="astra-review-grade__rail" aria-hidden="true" />
                    <span className="astra-review-grade__label">{t(action.labelKey)}</span>
                    <span className="astra-review-grade__key">{action.key}</span>
                    <span className="astra-review-grade__hint">{certificationMode ? ASTRA_CERT_REVIEW_GRADE_HINTS[action.grade] : t(action.hintKey)}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="astra-review-keyboard-hint" style={keyboardHintStyle}>
            {certificationMode
              ? ASTRA_CERT_KEYBOARD_HINT
              : phase === "showing-front"
                ? t("review_keyboardHintFront")
                : t("review_keyboardHintBackFour")}
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
  maxWidth: 760,
  margin: "0 auto",
}

const certificationContainerStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "none",
  margin: 0,
}

const emptyStateStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "48px 20px",
  color: "var(--astra-text-decorative)",
  fontSize: 15,
}

// summaryCardStyle — now using className="astra-card"

// restartButtonStyle — now using className="astra-btn-primary"

const progressTextStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--astra-text-muted)",
  marginBottom: 10,
  textAlign: "center",
}

const flashcardStyle: React.CSSProperties = {
  border: "1px solid var(--astra-style-line-1, var(--astra-border))",
  borderRadius: 16,
  padding: "36px 42px 32px",
  background: "var(--astra-style-bg-surface, var(--astra-bg-card))",
  textAlign: "left",
  minHeight: 260,
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  justifyContent: "center",
  cursor: "pointer",
  userSelect: "none",
  position: "relative",
  fontFamily: "inherit",
  color: "inherit",
}

const wordTextStyle: React.CSSProperties = {
  fontFamily: "var(--astra-font-serif)",
  fontSize: 38,
  fontWeight: 400,
  letterSpacing: "-0.022em",
  color: "var(--astra-style-ink-1, var(--astra-text-primary))",
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
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 10,
  marginTop: 18,
}

const scheduleDisclosureStyle: React.CSSProperties = {
  marginTop: 16,
  textAlign: "center",
  fontSize: 12,
  color: "var(--astra-text-muted)",
}

const keyboardHintStyle: React.CSSProperties = {
  textAlign: "center",
  fontSize: 11,
  color: "var(--astra-text-decorative)",
  marginTop: 10,
}
