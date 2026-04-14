import { useCallback, useEffect, useState } from "react"
import { browser } from "#imports"
import type { VocabularyEntry } from "@/utils/storage/vocabulary"
import { updateVocabularyEntry, getVocabularyEntries } from "@/utils/storage/vocabulary"
import { applyReview, getDueCards, getBoxDistribution } from "@/utils/srs/leitner"
import type { SrsFields, BoxDistribution } from "@/utils/srs/leitner"
import { buildVocabularyReviewStudyEvent, deriveStudyLoopViewModel, getStudyProgress, recordStudyEvent, type StudyLoopViewModel, type StudyStep } from "@/utils/storage/study-progress"
import { deriveVocabularySourceDisplay } from "@/utils/storage/vocabulary-core"
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
import { t } from "@/utils/i18n"
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

function CurrentPageLoopCard({ studyLoop }: { studyLoop: StudyLoopViewModel }) {
  if (!studyLoop.currentPage) return null

  return (
    <div style={currentPageLoopStyle} aria-label={t("review_currentPageProgressTitle")}>
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
    </div>
  )
}

function getReviewStudyLoopUrl(entry?: VocabularyEntry | null): string | undefined {
  return entry?.sourceContext?.studyProgressRecordId ?? entry?.url
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
  const [snippetExpanded, setSnippetExpanded] = useState(false)
  const [studyLoop, setStudyLoop] = useState<StudyLoopViewModel | null>(null)
  const [ownedReadingItems, setOwnedReadingItems] = useState<OwnedReadingItem[]>([])

  const loadDueCards = useCallback(async () => {
    const [entries, linkedItems] = await Promise.all([
      getVocabularyEntries(),
      listOwnedReadingItems(),
    ])
    const due = getDueCards(entries)
    setOwnedReadingItems(linkedItems)
    setDueCards(due)
    setDistribution(getBoxDistribution(entries))
    setCurrentIndex(0)
    setPhase(due.length > 0 ? "showing-front" : "session-complete")
    setSummary({ total: 0, correct: 0, incorrect: 0 })
    const progress = await getStudyProgress()
    setDailyPagesStudied(progress.dailyStats.pagesStudied)
    setDailySentencesExplained(progress.dailyStats.sentencesExplained)
    setDailyVocabSaved(progress.dailyStats.vocabSaved)
    setDailyVocabReviewed(progress.dailyStats.vocabReviewed)
    setStudyLoop(deriveStudyLoopViewModel(progress, getReviewStudyLoopUrl(due[0])))
    setSnippetExpanded(false)
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadDueCards()
  }, [loadDueCards])

  const currentCard = dueCards[currentIndex] ?? null

  const handleAnswer = useCallback(async (correct: boolean) => {
    if (!currentCard) return

    const fields = toSrsFields(currentCard)
    const updated = applyReview(fields, { correct })

    await updateVocabularyEntry(currentCard.id, {
      srsBox: updated.srsBox,
      nextReviewAt: updated.nextReviewAt,
      reviewCount: updated.reviewCount,
      lastReviewedAt: updated.lastReviewedAt,
    })

    const studyEvent = buildVocabularyReviewStudyEvent(currentCard)
    if (studyEvent) {
      await recordStudyEvent(studyEvent).catch(() => undefined)
    }

    setSummary((prev) => ({
      total: prev.total + 1,
      correct: prev.correct + (correct ? 1 : 0),
      incorrect: prev.incorrect + (correct ? 0 : 1),
    }))

    const nextIndex = currentIndex + 1
    if (nextIndex >= dueCards.length) {
      // Refresh distribution after session ends
      const entries = await getVocabularyEntries()
      setDistribution(getBoxDistribution(entries))
      const progress = await getStudyProgress()
      setDailyPagesStudied(progress.dailyStats.pagesStudied)
      setDailySentencesExplained(progress.dailyStats.sentencesExplained)
      setDailyVocabSaved(progress.dailyStats.vocabSaved)
      setDailyVocabReviewed(progress.dailyStats.vocabReviewed)
      setStudyLoop(deriveStudyLoopViewModel(progress, undefined))
      setPhase("session-complete")
    } else {
      const progress = await getStudyProgress()
      setDailyPagesStudied(progress.dailyStats.pagesStudied)
      setDailySentencesExplained(progress.dailyStats.sentencesExplained)
      setDailyVocabSaved(progress.dailyStats.vocabSaved)
      setDailyVocabReviewed(progress.dailyStats.vocabReviewed)
      setStudyLoop(deriveStudyLoopViewModel(progress, getReviewStudyLoopUrl(dueCards[nextIndex])))
      setCurrentIndex(nextIndex)
      setPhase("showing-front")
      setSnippetExpanded(false)
    }
  }, [currentCard, currentIndex, dueCards])

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
        <p style={{ color: "#94a3b8", textAlign: "center" }}>Loading...</p>
      </div>
    )
  }

  const dueCount = dueCards.length - currentIndex
  const totalDue = phase === "session-complete" ? 0 : dueCount
  const sourceDisplay = currentCard
    ? deriveVocabularySourceDisplay(currentCard)
    : { surfaceLabel: null, sourceLabel: "", snippet: "", articleExcerpt: "", contentSummary: "", pageUrl: "", hostname: "", sourceContext: undefined, ownedReadingItemId: "", ownedReadingSourceType: undefined, ownedReadingTitle: "", studyProgressRecordId: "" }
  const linkedReadingItem = currentCard ? matchOwnedReadingItemForVocabularyEntry(ownedReadingItems, currentCard) : null
  const linkedReadingResumeTarget = linkedReadingItem ? buildOwnedReadingResumeTarget(linkedReadingItem) : null
  const linkedReadingProgress = linkedReadingItem ? describeOwnedReadingProgress(linkedReadingItem) : null
  const currentPageLoop = studyLoop
  const snippetLong = sourceDisplay.snippet.length > 300
  const sourcePageIsWeb = /^https?:\/\//i.test(sourceDisplay.pageUrl)

  const hasDailyProgress =
    dailyPagesStudied > 0
    || dailySentencesExplained > 0
    || dailyVocabSaved > 0
    || dailyVocabReviewed > 0

  const handleResumeLinkedReading = async () => {
    if (!linkedReadingItem || !linkedReadingResumeTarget) return
    await markOwnedReadingOpened(linkedReadingItem.id)
    void browser.tabs.create({ url: linkedReadingResumeTarget.url })
  }

  return (
    <div style={containerStyle}>
      <ReviewStats distribution={distribution} dueCount={totalDue} />

      {hasDailyProgress && (
        <div style={dailyProgressStyle} aria-label={t("review_todayProgressAria")}>
          <div style={dailyProgressTitleStyle}>{t("review_todayProgressTitle")}</div>
          <div style={dailyProgressRowStyle}>
            <span>{t("popup_studyStatPages", dailyPagesStudied.toString())}</span>
            <span>{t("popup_studyStatExplained", dailySentencesExplained.toString())}</span>
            <span>{t("popup_studyStatSaved", dailyVocabSaved.toString())}</span>
            <span>{t("popup_studyStatReviewed", dailyVocabReviewed.toString())}</span>
          </div>
        </div>
      )}

      {phase === "session-complete" && summary.total === 0 && (
        <div style={emptyStateStyle}>
          <div style={{ fontSize: 18, marginBottom: 8 }}>All caught up!</div>
          <div>No cards due for review. Check back later.</div>
        </div>
      )}

      {phase === "session-complete" && summary.total > 0 && (
        <div style={summaryCardStyle}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#0f172a" }}>
            Session Complete
          </div>
          <div style={summaryRowStyle}>
            <span>Cards reviewed</span>
            <strong>{summary.total}</strong>
          </div>
          <div style={summaryRowStyle}>
            <span style={{ color: "#22c55e" }}>Correct (promoted)</span>
            <strong style={{ color: "#22c55e" }}>{summary.correct}</strong>
          </div>
          <div style={summaryRowStyle}>
            <span style={{ color: "#ef4444" }}>Incorrect (demoted)</span>
            <strong style={{ color: "#ef4444" }}>{summary.incorrect}</strong>
          </div>
          <button
            type="button"
            style={restartButtonStyle}
            onClick={() => void loadDueCards()}
          >
            Review again
          </button>
        </div>
      )}

      {phase !== "session-complete" && currentCard && (
        <>
          <div style={progressTextStyle}>
            Card {currentIndex + 1} of {dueCards.length}
            <span style={{ marginLeft: 8, fontSize: 11, color: "#94a3b8" }}>
              Box {currentCard.srsBox ?? 1}
            </span>
          </div>

          {currentPageLoop && <CurrentPageLoopCard studyLoop={currentPageLoop} />}

          <div
            style={flashcardStyle}
            onClick={phase === "showing-front" ? handleFlip : undefined}
            role="button"
            tabIndex={0}
          >
            <div style={wordTextStyle}>{currentCard.text}</div>

            {currentCard.hostname && (
              <span style={hostnameTagStyle}>{currentCard.hostname}</span>
            )}

            {phase === "showing-back" && (
              <div style={backContentStyle}>
                {currentCard.translation && (
                  <div style={translationTextStyle}>{currentCard.translation}</div>
                )}
                {currentCard.explanation && (
                  <div style={explanationTextStyle}>{currentCard.explanation}</div>
                )}
                {sourceDisplay.surfaceLabel && (
                  <div style={{ fontSize: 11, color: "#6366f1", fontWeight: 700, marginBottom: 6 }}>
                    {sourceDisplay.surfaceLabel}
                  </div>
                )}
                {sourceDisplay.sourceLabel && (
                  <div style={{ fontSize: 12, color: "#334155", fontWeight: 600, marginBottom: 6 }}>
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
                    style={{
                      marginTop: 6,
                      border: "none",
                      background: "none",
                      color: "#2563eb",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    {snippetExpanded ? t("review_hideFullContext") : t("review_showFullContext")}
                  </button>
                )}
                {linkedReadingItem && (
                  <div style={{ ...contextTextStyle, marginTop: 8, background: "rgba(99, 102, 241, 0.05)", border: "1px solid rgba(99, 102, 241, 0.15)", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: 12, color: "#334155", fontWeight: 700, marginBottom: 4 }}>
                      Reading asset
                    </div>
                    <div style={{ fontSize: 12, color: "#334155", fontWeight: 600, marginBottom: 4 }}>
                      {linkedReadingItem.title} · {getOwnedReadingSourceTypeLabel(linkedReadingItem.sourceType)}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: linkedReadingProgress ? 4 : 8 }}>
                      {describeOwnedReadingResumeBehavior(linkedReadingItem)}
                    </div>
                    {linkedReadingProgress && (
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
                        {linkedReadingProgress}
                      </div>
                    )}
                    {linkedReadingResumeTarget && (
                      <button
                        type="button"
                        onClick={() => void handleResumeLinkedReading()}
                        style={{
                          marginTop: 2,
                          border: "1px solid #c7d2fe",
                          background: "rgba(99, 102, 241, 0.08)",
                          color: "#4338ca",
                          borderRadius: 8,
                          padding: "6px 12px",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Resume reading asset
                      </button>
                    )}
                  </div>
                )}
                {(sourceDisplay.articleExcerpt || sourceDisplay.contentSummary || sourceDisplay.hostname || sourceDisplay.pageUrl) && (
                  <div style={{ ...contextTextStyle, marginTop: 8 }}>
                    {sourceDisplay.hostname && (
                      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>
                        Host: {sourceDisplay.hostname}
                      </div>
                    )}
                    {sourceDisplay.pageUrl && (
                      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4, wordBreak: "break-all" }}>
                        {sourcePageIsWeb ? "URL" : "File"}: {sourceDisplay.pageUrl}
                      </div>
                    )}
                    {sourceDisplay.articleExcerpt && (
                      <div style={{ marginBottom: sourceDisplay.contentSummary ? 6 : 0 }}>
                        Excerpt: {sourceDisplay.articleExcerpt}
                      </div>
                    )}
                    {sourceDisplay.contentSummary && (
                      <div>Summary: {sourceDisplay.contentSummary}</div>
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
              <div style={flipHintStyle}>
                Click or press Space to reveal
              </div>
            )}
          </div>

          {phase === "showing-back" && (
            <div style={buttonRowStyle}>
              <button
                type="button"
                style={dontKnowButtonStyle}
                onClick={() => void handleAnswer(false)}
              >
                Don't know
              </button>
              <button
                type="button"
                style={knowItButtonStyle}
                onClick={() => void handleAnswer(true)}
              >
                Know it
              </button>
            </div>
          )}

          <div style={keyboardHintStyle}>
            {phase === "showing-front"
              ? "Space = flip"
              : "\u2190 = don't know \u00B7 \u2192 = know it"}
          </div>
        </>
      )}
    </div>
  )
}

// --- Styles ---

const dailyProgressStyle: React.CSSProperties = {
  marginBottom: 16,
  padding: "12px 14px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
}

const dailyProgressTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#475569",
  marginBottom: 8,
}

const dailyProgressRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px 14px",
  fontSize: 12,
  color: "#64748b",
}

const currentPageLoopStyle: React.CSSProperties = {
  marginBottom: 16,
  padding: "12px 14px",
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  borderRadius: 10,
}

const currentPageLoopTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#1e3a8a",
  marginBottom: 4,
}

const currentPageLoopHintStyle: React.CSSProperties = {
  fontSize: 10,
  color: "#64748b",
  marginBottom: 8,
}

const currentPageLoopMetaStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#1e293b",
  marginBottom: 8,
}

const currentPageLoopCountersStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "6px 10px",
  fontSize: 11,
  color: "#334155",
  fontWeight: 600,
}

const currentPageLoopNextStyle: React.CSSProperties = {
  marginTop: 8,
  fontSize: 11,
  color: "#1d4ed8",
  fontWeight: 600,
}

const containerStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
}

const emptyStateStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "48px 20px",
  color: "#94a3b8",
  fontSize: 15,
}

const summaryCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: "24px 20px",
  background: "#fff",
  textAlign: "center",
}

const summaryRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "6px 0",
  fontSize: 14,
  color: "#334155",
  borderBottom: "1px solid #f1f5f9",
}

const restartButtonStyle: React.CSSProperties = {
  marginTop: 16,
  padding: "8px 24px",
  border: "none",
  borderRadius: 8,
  background: "#6366f1",
  color: "#fff",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
}

const progressTextStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#64748b",
  marginBottom: 10,
  textAlign: "center",
}

const flashcardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: "32px 24px",
  background: "#fff",
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
  color: "#0f172a",
  marginBottom: 8,
}

const hostnameTagStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#94a3b8",
  background: "#f1f5f9",
  borderRadius: 4,
  padding: "2px 8px",
  marginBottom: 12,
}

const backContentStyle: React.CSSProperties = {
  marginTop: 16,
  width: "100%",
}

const translationTextStyle: React.CSSProperties = {
  fontSize: 18,
  color: "#6366f1",
  fontWeight: 600,
  marginBottom: 8,
}

const explanationTextStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#334155",
  marginBottom: 8,
  lineHeight: 1.5,
}

const contextTextStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#64748b",
  fontStyle: "italic",
  lineHeight: 1.4,
  marginBottom: 8,
}

const sourceLinkStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#94a3b8",
  textDecoration: "underline",
}

const flipHintStyle: React.CSSProperties = {
  marginTop: 24,
  fontSize: 13,
  color: "#cbd5e1",
}

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  justifyContent: "center",
  marginTop: 16,
}

const dontKnowButtonStyle: React.CSSProperties = {
  flex: 1,
  maxWidth: 200,
  padding: "10px 0",
  border: "none",
  borderRadius: 8,
  background: "rgba(239, 68, 68, 0.1)",
  color: "#ef4444",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
}

const knowItButtonStyle: React.CSSProperties = {
  flex: 1,
  maxWidth: 200,
  padding: "10px 0",
  border: "none",
  borderRadius: 8,
  background: "rgba(34, 197, 94, 0.1)",
  color: "#22c55e",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
}

const keyboardHintStyle: React.CSSProperties = {
  textAlign: "center",
  fontSize: 11,
  color: "#cbd5e1",
  marginTop: 10,
}
