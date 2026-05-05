import { t } from "@/utils/i18n"
import type { PageStudyContext } from "@/types/messages"
import type { ReadingHistoryEntry } from "@/utils/storage/reading-history"
import type { PageDigestRecord } from "@/utils/storage/page-digests"
import { buildLearningLoopAccountContinuityProofMoment, LEARNING_LOOP_COMMERCIAL_SURFACE_COPY, type LearningLoopAccountContinuityAuthState } from "@/utils/learning-loop-events"
import { STUDY_STEPS_ORDER, type StudyLoopViewModel, type StudyStep, type WeeklyStudyProgressRoiSummary } from "@/utils/storage/study-progress"
import type { WeeklyVocabularyRoiSummary } from "@/utils/storage/vocabulary"

export type PopupSentenceExplainStatus = "idle" | "explaining" | "explained"
export type PopupSentenceSaveStatus = "idle" | "saving" | "saved"
export type PopupPageAssetSaveStatus = "idle" | "saving" | "saved" | "error"

export interface PopupSentenceCardViewModel {
  id: string
  text: string
  index: number
  selected: boolean
  explainStatus: PopupSentenceExplainStatus
  explanationText: string | null
  explanationLanguageLevel?: import("@/types/config").LanguageLevel
  explanationExplainMode?: import("@/types/config").ExplainMode
  explanationGlossaryTerms?: Array<{ sourceTerm: string; preferredTerm: string }>
  explainProfileLabel?: string
  glossaryEvidenceLabel?: string
  saveStatus: PopupSentenceSaveStatus
  savedEntryId?: string
  speaking: boolean
}

export interface WeeklyLearningRoiViewModel {
  study: WeeklyStudyProgressRoiSummary
  vocabulary: WeeklyVocabularyRoiSummary
  generatedAt: number
}

interface StudySectionProps {
  currentPageActivity: ReadingHistoryEntry | null
  dueCount: number
  recentHistory: ReadingHistoryEntry[]
  studyContext: PageStudyContext | null
  canReadArticle: boolean
  showAccountContinuityNudge: boolean
  accountContinuityAuthState?: LearningLoopAccountContinuityAuthState
  onOpenAccountContinuitySignIn: () => void
  studyLoop: StudyLoopViewModel | null
  weeklyRoi: WeeklyLearningRoiViewModel | null
  pageSavedReviewSummary: { count: number } | null
  pageAssetSaveStatus: PopupPageAssetSaveStatus
  pageAssetSaveMessage: string | null
  pageDigest: PageDigestRecord | null
  digestStale: boolean
  digestLoading: boolean
  canSpeakStudy: boolean
  speakingStudy: boolean
  studyQuickActions: Array<{ id: string; labelZh: string }>
  studyActionRunningId: string | null
  studyActionResult: { actionId: string; text: string } | null
  sentenceCards: PopupSentenceCardViewModel[]
  sentenceActionLocked: boolean
  sentenceDeckFallbackMessage: string | null
  selectedSentenceIndex: number
  onGenerateDigest: () => void
  onRegenerateDigest: () => void
  onToggleStudySpeech: () => void
  onToggleSentenceSpeech: (sentenceIndex?: number) => void
  onSelectSentence: (index: number) => void
  onRunStudyAction: (actionId: string) => void
  onSaveSentence: (sentenceIndex: number) => void
  onReviewSavedSentence: (sentenceIndex: number) => void
  onReviewPageSavedSentences: () => void
  onSavePageAsset: () => void
  onOpenHistoryEntry: (url: string) => void
  onOpenReview: () => void
  onOpenVocabulary: () => void
  onOpenReadingQueue: () => void
  onReadArticle: () => void
  onExplainSentence: (sentenceIndex?: number) => void
}

const cardStyle: React.CSSProperties = {
  marginTop: 12,
  background: "var(--astra-bg-primary)",
  border: "1px solid var(--astra-border)",
  borderRadius: "var(--astra-radius-md)",
  padding: 12,
}

const actionButtonStyle: React.CSSProperties = {
  border: "1px solid var(--astra-popup-border-warm-strong)",
  background: "var(--astra-popup-bg-soft)",
  color: "var(--astra-accent-warm-hover)",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
}

const secondaryActionButtonStyle: React.CSSProperties = {
  border: "1px solid var(--astra-border-strong)",
  background: "var(--astra-bg-primary)",
  color: "var(--astra-text-secondary)",
  borderRadius: "var(--astra-radius-md)",
  padding: "6px 10px",
  fontSize: "var(--astra-text-xs)",
  fontWeight: 600,
  cursor: "pointer",
}

function formatVisitAgeLabel(visitedAt: number): string {
  const diff = Math.max(0, Date.now() - visitedAt)
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return t("popup_revisitJustNow")
  if (mins < 60) return t("popup_revisitMinutesAgo", String(mins))
  const hours = Math.floor(mins / 60)
  if (hours < 48) return t("popup_revisitHoursAgo", String(hours))
  const days = Math.floor(hours / 24)
  return t("popup_revisitDaysAgo", String(days))
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

function StudyProgressBar({ completionPercent, completedSteps }: {
  completionPercent: number
  completedSteps: StudyStep[]
}) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", gap: 3, marginBottom: 4 }}>
        {STUDY_STEPS_ORDER.map((step) => {
          const done = completedSteps.includes(step)
          return (
            <div
              key={step}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: done ? "var(--astra-accent-warm)" : "var(--astra-border)",
                transition: "background 0.2s",
              }}
              title={`${getStepLabel(step)}${done ? t("popup_studyStepDone") : ""}`}
            />
          )
        })}
      </div>
      <div style={{ fontSize: 10, color: "var(--astra-text-hint)" }}>
        {completionPercent}% — {completedSteps.length > 0
          ? completedSteps.map((s) => getStepLabel(s)).join(" → ")
          : t("popup_studyNoStepsYet")}
      </div>
    </div>
  )
}

function getNextStepHint(step: StudyStep): string {
  const hintKeys: Record<StudyStep, string> = {
    read: "popup_studyNextHintRead",
    guided_read: "popup_studyNextHintGuidedRead",
    explain: "popup_studyNextHintExplain",
    vocab_save: "popup_studyNextHintSaveWords",
    vocab_review: "popup_studyNextHintReview",
  }
  return t(hintKeys[step])
}

function CurrentPageProgressCard({ studyLoop }: { studyLoop: StudyLoopViewModel }) {
  if (!studyLoop.currentPage) return null

  return (
    <div
      style={{
        marginTop: 10,
        padding: "10px 12px",
        background: "var(--astra-popup-bg-soft)",
        border: "1px solid var(--astra-popup-border-warm)",
        borderRadius: 10,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--astra-popup-text-warm-strong)", marginBottom: 4 }}>
        {t("popup_studyCurrentPageProgressTitle")}
      </div>
      <div style={{ fontSize: 10, color: "var(--astra-popup-text-warm)", marginBottom: 8 }}>
        {t("popup_studyCurrentPageProgressHint")}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--astra-text-primary)", background: "var(--astra-bg-card)", border: "1px solid var(--astra-border-strong)", borderRadius: 999, padding: "3px 8px", fontWeight: 600 }}>
          {t("popup_studyStatExplained", String(studyLoop.currentCounts.sentencesExplained))}
        </span>
        <span style={{ fontSize: 11, color: "var(--astra-text-primary)", background: "var(--astra-bg-card)", border: "1px solid var(--astra-border-strong)", borderRadius: 999, padding: "3px 8px", fontWeight: 600 }}>
          {t("popup_studyStatSaved", String(studyLoop.currentCounts.vocabSaved))}
        </span>
        <span style={{ fontSize: 11, color: "var(--astra-text-primary)", background: "var(--astra-bg-card)", border: "1px solid var(--astra-border-strong)", borderRadius: 999, padding: "3px 8px", fontWeight: 600 }}>
          {t("popup_studyStatReviewed", String(studyLoop.currentCounts.vocabReviewed))}
        </span>
      </div>
    </div>
  )
}

function PersonalizedStrategyCard({ studyLoop }: { studyLoop: StudyLoopViewModel }) {
  const strategy = studyLoop.personalizedStrategy
  if (!strategy) return null

  return (
    <div
      data-testid="study-personalized-strategy-card"
      style={{
        marginTop: 10,
        padding: "10px 12px",
        background: "var(--astra-info-bg)",
        border: "1px solid var(--astra-info-border)",
        borderRadius: 10,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, color: "var(--astra-info)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
        Personalized strategy
      </div>
      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--astra-info)", marginBottom: 4 }}>
        {strategy.label}
      </div>
      <div style={{ fontSize: 11, color: "var(--astra-info)", lineHeight: 1.45 }}>
        {strategy.hint}
      </div>
      <div style={{ fontSize: 10, color: "var(--astra-text-muted)", marginTop: 6 }}>
        {strategy.evidence}
      </div>
    </div>
  )
}

function formatInputMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = minutes / 60
  return `${hours.toFixed(Number.isInteger(hours) ? 0 : 1)}h`
}

function formatReviewHitRate(rate: number | null): string {
  return rate === null ? "No reviews yet" : `${rate}%`
}

function WeeklyRoiSummaryCard({ weeklyRoi }: { weeklyRoi: WeeklyLearningRoiViewModel }) {
  const hasActivity = weeklyRoi.study.activePageCount > 0
    || weeklyRoi.vocabulary.savedCount > 0
    || weeklyRoi.vocabulary.reviewedCount > 0
  if (!hasActivity) return null

  const masteredPerHour = weeklyRoi.study.inputMinutes > 0
    ? weeklyRoi.vocabulary.masteredCount / (weeklyRoi.study.inputMinutes / 60)
    : null

  return (
    <div
      data-testid="weekly-roi-summary-card"
      style={{
        marginTop: 10,
        padding: "10px 12px",
        background: "var(--astra-info-bg)",
        border: "1px solid var(--astra-info-border)",
        borderRadius: 10,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, color: "var(--astra-info)", textTransform: "uppercase", letterSpacing: 0.4 }}>
        Weekly ROI
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--astra-info)", marginTop: 4 }}>
        {weeklyRoi.study.window.days}-day learning return
      </div>
      <div style={{ fontSize: 11, color: "var(--astra-info)", lineHeight: 1.45, marginTop: 4 }}>
        Input time → mastered vocabulary → review hit rate, derived from local study and SRS activity only.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 8 }}>
        <div style={{ padding: "8px", background: "var(--astra-bg-card)", border: "1px solid var(--astra-info-border)", borderRadius: 8 }}>
          <div style={{ fontSize: 10, color: "var(--astra-text-muted)" }}>Input</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--astra-text-primary)" }}>{formatInputMinutes(weeklyRoi.study.inputMinutes)}</div>
        </div>
        <div style={{ padding: "8px", background: "var(--astra-bg-card)", border: "1px solid var(--astra-info-border)", borderRadius: 8 }}>
          <div style={{ fontSize: 10, color: "var(--astra-text-muted)" }}>Mastered</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--astra-text-primary)" }}>{weeklyRoi.vocabulary.masteredCount}</div>
        </div>
        <div style={{ padding: "8px", background: "var(--astra-bg-card)", border: "1px solid var(--astra-info-border)", borderRadius: 8 }}>
          <div style={{ fontSize: 10, color: "var(--astra-text-muted)" }}>Hit rate</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--astra-text-primary)" }}>{formatReviewHitRate(weeklyRoi.vocabulary.reviewHitRate)}</div>
        </div>
      </div>
      <div style={{ fontSize: 10, color: "var(--astra-text-muted)", lineHeight: 1.45, marginTop: 8 }}>
        {weeklyRoi.study.activePageCount} active page{weeklyRoi.study.activePageCount === 1 ? "" : "s"} · {weeklyRoi.study.completedLoopCount} loop{weeklyRoi.study.completedLoopCount === 1 ? "" : "s"} closed · {weeklyRoi.vocabulary.savedCount} saved · {weeklyRoi.vocabulary.reviewedCount} reviewed
        {masteredPerHour !== null ? ` · ${masteredPerHour.toFixed(1)} mastered/hour` : ""}
      </div>
    </div>
  )
}

function NextStepBanner({
  nextStep,
  onReadArticle,
  onExplainSentence,
  onOpenVocabulary,
  onOpenReview,
  onReviewPageSavedSentences,
  hasPageSavedReview,
  canReadArticle,
  dueCount,
}: {
  nextStep: StudyStep | null
  onReadArticle: () => void
  onExplainSentence: () => void
  onOpenVocabulary: () => void
  onOpenReview: () => void
  onReviewPageSavedSentences: () => void
  hasPageSavedReview: boolean
  canReadArticle: boolean
  dueCount: number
}) {
  if (!nextStep) {
    return (
      <div style={{
        marginTop: 8,
        padding: "6px 10px",
        background: "var(--astra-success-bg)",
        border: "1px solid var(--astra-success-border)",
        borderRadius: 8,
        fontSize: 12,
        color: "var(--astra-success)",
        fontWeight: 600,
      }}
      >
        {t("popup_studyAllComplete")}
      </div>
    )
  }

  const genericReviewLabel = dueCount > 0 ? `${t("popup_review")} (${dueCount})` : t("popup_review")
  const actions: Record<StudyStep, { label: string; handler: () => void; disabled?: boolean }> = {
    read: { label: t("popup_readArticle"), handler: onReadArticle, disabled: !canReadArticle },
    guided_read: { label: t("popup_studyStartGuidedRead"), handler: onReadArticle, disabled: !canReadArticle },
    explain: { label: t("popup_studyExplainSentence"), handler: onExplainSentence },
    vocab_save: { label: t("popup_studySaveWords"), handler: onOpenVocabulary },
    vocab_review: hasPageSavedReview
      ? { label: t("popup_studyPageSavedReviewAction"), handler: onReviewPageSavedSentences }
      : { label: genericReviewLabel, handler: onOpenReview },
  }

  const action = actions[nextStep]

  return (
    <div style={{
      marginTop: 8,
      padding: "8px 10px",
      background: "var(--astra-popup-bg-soft)",
      border: "1px solid var(--astra-popup-border-warm-strong)",
      borderRadius: 8,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: "var(--astra-popup-text-warm-strong)", fontWeight: 600 }}>
          {t("popup_studyNext")} {getStepLabel(nextStep)}
        </div>
        <div style={{ fontSize: 11, color: "var(--astra-accent-warm-hover)", marginTop: 2, lineHeight: 1.4 }}>
          {getNextStepHint(nextStep)}
        </div>
      </div>
      <button
        data-testid="study-next-step-action"
        type="button"
        style={{
          ...actionButtonStyle,
          padding: "4px 10px",
          fontSize: 11,
          ...(action.disabled ? { opacity: 0.55, cursor: "not-allowed" } : {}),
        }}
        onClick={action.handler}
        disabled={action.disabled}
      >
        {action.label}
      </button>
    </div>
  )
}

function StudyProgressCardGroup({
  studyLoop,
  pageSavedReviewSummary,
  canReadArticle,
  dueCount,
  onReadArticle,
  onExplainSentence,
  onOpenVocabulary,
  onOpenReview,
  onReviewPageSavedSentences,
}: {
  studyLoop: StudyLoopViewModel
  pageSavedReviewSummary: { count: number } | null
  canReadArticle: boolean
  dueCount: number
  onReadArticle: () => void
  onExplainSentence: () => void
  onOpenVocabulary: () => void
  onOpenReview: () => void
  onReviewPageSavedSentences: () => void
}) {
  return (
    <div
      data-testid="study-progress-card-group"
      style={{
        marginTop: 10,
        padding: "10px 12px",
        background: "var(--astra-bg-card)",
        border: "1px solid var(--astra-popup-border-warm)",
        borderRadius: 10,
      }}
    >
      {studyLoop.currentPage && studyLoop.nextStep && studyLoop.completedSteps.length > 0 && (
        <div
          style={{
            marginBottom: 8,
            padding: "8px 10px",
            background: "var(--astra-success-bg)",
            border: "1px solid var(--astra-success-border)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--astra-success)",
            lineHeight: 1.45,
          }}
        >
          {t("popup_studyResumeFromLast")}
        </div>
      )}
      <CurrentPageProgressCard studyLoop={studyLoop} />
      <PersonalizedStrategyCard studyLoop={studyLoop} />
      <StudyProgressBar
        completionPercent={studyLoop.completionPercent}
        completedSteps={studyLoop.completedSteps}
      />
      <NextStepBanner
        nextStep={studyLoop.nextStep}
        onReadArticle={onReadArticle}
        onExplainSentence={onExplainSentence}
        onOpenVocabulary={onOpenVocabulary}
        onOpenReview={onOpenReview}
        onReviewPageSavedSentences={onReviewPageSavedSentences}
        hasPageSavedReview={!!pageSavedReviewSummary}
        canReadArticle={canReadArticle}
        dueCount={dueCount}
      />
    </div>
  )
}

export default function StudySection({
  currentPageActivity,
  dueCount,
  recentHistory,
  studyContext,
  canReadArticle,
  showAccountContinuityNudge,
  accountContinuityAuthState = "signed_out",
  onOpenAccountContinuitySignIn,
  studyLoop,
  weeklyRoi,
  pageSavedReviewSummary,
  pageAssetSaveStatus,
  pageAssetSaveMessage,
  pageDigest,
  digestStale,
  digestLoading,
  canSpeakStudy,
  speakingStudy,
  studyQuickActions,
  studyActionRunningId,
  studyActionResult,
  sentenceCards,
  sentenceActionLocked,
  sentenceDeckFallbackMessage,
  selectedSentenceIndex,
  onGenerateDigest,
  onRegenerateDigest,
  onToggleStudySpeech,
  onToggleSentenceSpeech,
  onSelectSentence,
  onRunStudyAction,
  onSaveSentence,
  onReviewSavedSentence,
  onReviewPageSavedSentences,
  onSavePageAsset,
  onOpenHistoryEntry,
  onOpenReview,
  onOpenVocabulary,
  onOpenReadingQueue,
  onReadArticle,
  onExplainSentence,
}: StudySectionProps) {
  const summary = studyContext?.contentSummary?.trim() || studyContext?.metaDescription?.trim() || ""
  const selectedSentence = sentenceCards[selectedSentenceIndex] ?? null
  const hasStudyOutcomeContext = Boolean(summary || studyContext?.articleExcerpt?.trim() || sentenceCards.length > 0)
  const canSavePageAsset = Boolean(studyContext?.pageUrl?.trim() || currentPageActivity?.url?.trim())
  const pageAssetTitle = studyContext?.pageTitle?.trim() || currentPageActivity?.title?.trim() || t("popup_studyEmptyTitle")
  const pageAssetHost = studyContext?.hostname?.trim() || currentPageActivity?.hostname?.trim() || ""
  const accountContinuityCopy = LEARNING_LOOP_COMMERCIAL_SURFACE_COPY.accountContinuity
  const accountContinuityProofMoment = buildLearningLoopAccountContinuityProofMoment("study", {
    dueReviewCount: dueCount,
    savedSentenceCount: pageSavedReviewSummary?.count ?? studyLoop?.currentCounts.vocabSaved,
    pagesStudiedToday: studyLoop?.dailyStats.pagesStudied,
    sentencesExplainedToday: studyLoop?.dailyStats.sentencesExplained,
    vocabSavedToday: studyLoop?.dailyStats.vocabSaved,
    vocabReviewedToday: studyLoop?.dailyStats.vocabReviewed,
  }, { authState: accountContinuityAuthState })
  const isAccountContinuitySignedIn = accountContinuityAuthState === "signed_in"

  return (
    <section style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--astra-text-primary)" }}>
            {t("popup_studyTitle")}
          </div>
          <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginTop: 2 }}>
            {studyContext?.pageTitle || t("popup_studyEmptyTitle")}
          </div>
        </div>
        <div style={{
          fontSize: 11,
          color: dueCount > 0 ? "var(--astra-popup-text-warm-strong)" : "var(--astra-text-muted)",
          background: dueCount > 0 ? "var(--astra-popup-bg-start)" : "var(--astra-border)",
          borderRadius: 999,
          padding: "4px 8px",
          whiteSpace: "nowrap",
        }}
        >
          {t("popup_studyDueCount", String(dueCount))}
        </div>
      </div>

      {hasStudyOutcomeContext && (
        <div
          data-testid="study-outcome-copy"
          style={{
            marginTop: 10,
            padding: "8px 10px",
            background: "var(--astra-info-bg)",
            border: "1px solid var(--astra-info-border)",
            borderRadius: 8,
            fontSize: 11,
            color: "var(--astra-info)",
            lineHeight: 1.45,
            fontWeight: 600,
          }}
        >
          {LEARNING_LOOP_COMMERCIAL_SURFACE_COPY.studyOutcome}
          {" "}
          {LEARNING_LOOP_COMMERCIAL_SURFACE_COPY.firstWinActivation.summary}
        </div>
      )}

      {showAccountContinuityNudge && (
        <div
          data-testid="study-account-continuity-nudge"
          style={{
            marginTop: 10,
            padding: "8px 10px",
            background: "var(--astra-bg-primary)",
            border: "1px solid var(--astra-border-strong)",
            borderRadius: 8,
            fontSize: 11,
            color: "var(--astra-text-secondary)",
            lineHeight: 1.45,
          }}
        >
          <strong style={{ color: "var(--astra-text-primary)" }}>{isAccountContinuitySignedIn ? accountContinuityCopy.connectedTitle : accountContinuityCopy.title}</strong>
          {" "}
          {isAccountContinuitySignedIn ? accountContinuityCopy.connectedSummary : accountContinuityCopy.summary}
          <div data-testid="study-account-continuity-proof-moment" style={{ color: "var(--astra-text-secondary)", marginTop: 6, fontWeight: 700 }}>
            {accountContinuityProofMoment}
          </div>
          <div style={{ marginTop: 6 }}>
            {accountContinuityCopy.boundary}
          </div>
          {!isAccountContinuitySignedIn && (
            <>
              <button
                type="button"
                data-testid="study-account-continuity-sign-in-cta"
                style={{ ...actionButtonStyle, display: "block", width: "100%", marginTop: 8 }}
                onClick={onOpenAccountContinuitySignIn}
              >
                {accountContinuityCopy.cta}
              </button>
              <div style={{ fontSize: 10, color: "var(--astra-text-muted)", marginTop: 5 }}>
                {accountContinuityCopy.ctaHelper}
              </div>
            </>
          )}
        </div>
      )}

      {canReadArticle && (
        <div
          style={{
            marginTop: 10,
            padding: "12px",
            background: "linear-gradient(145deg, var(--astra-popup-bg-soft) 0%, var(--astra-popup-bg-start) 100%)",
            border: "1px solid var(--astra-popup-border-warm-strong)",
            borderRadius: 12,
            boxShadow: "var(--astra-popup-shadow-warm-md)",
          }}
        >
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            fontSize: 10,
            fontWeight: 700,
            color: "var(--astra-popup-text-warm-strong)",
            background: "var(--astra-bg-card)",
            border: "1px solid var(--astra-popup-border-warm-strong)",
            borderRadius: 999,
            padding: "2px 8px",
            marginBottom: 8,
          }}
          >
            {t("popup_studyNext")}
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--astra-popup-text-warm)", marginBottom: 4 }}>
            {t("popup_deepReadTitle")}
          </div>
          <div style={{ fontSize: 11, color: "var(--astra-popup-text-warm-strong)", lineHeight: 1.45, marginBottom: 10 }}>
            {t("popup_deepReadHint")}
          </div>
          <button
            type="button"
            className="astra-cursor-pointer"
            style={{
              border: "1px solid var(--astra-accent-warm-hover)",
              background: "var(--astra-accent-warm)",
              color: "var(--astra-text-on-brand)",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 700,
              width: "100%",
            }}
            onClick={onReadArticle}
          >
            {t("popup_deepReadAction")}
          </button>
        </div>
      )}

      {studyLoop && (
        <StudyProgressCardGroup
          studyLoop={studyLoop}
          pageSavedReviewSummary={pageSavedReviewSummary}
          canReadArticle={canReadArticle}
          dueCount={dueCount}
          onReadArticle={onReadArticle}
          onExplainSentence={onExplainSentence}
          onOpenVocabulary={onOpenVocabulary}
          onOpenReview={onOpenReview}
          onReviewPageSavedSentences={onReviewPageSavedSentences}
        />
      )}

      {canSavePageAsset && (
        <div
          data-testid="study-content-assetization-card"
          style={{
            marginTop: 10,
            padding: "10px 12px",
            background: "var(--astra-success-bg)",
            border: "1px solid var(--astra-success-border)",
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 800, color: "var(--astra-success)", textTransform: "uppercase", letterSpacing: 0.4 }}>
            {t("popup_contentAssetizationEyebrow")}
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--astra-success)", marginTop: 4 }}>
            {t("popup_contentAssetizationTitle")}
          </div>
          <div style={{ fontSize: 11, color: "var(--astra-success)", lineHeight: 1.45, marginTop: 4 }}>
            {t("popup_contentAssetizationHint")}
          </div>
          <div style={{ fontSize: 11, color: "var(--astra-success)", lineHeight: 1.45, marginTop: 6 }}>
            <strong>{pageAssetTitle}</strong>{pageAssetHost ? ` · ${pageAssetHost}` : ""}
          </div>
          {pageAssetSaveMessage && (
            <div
              data-testid="study-content-assetization-message"
              style={{
                marginTop: 6,
                fontSize: 11,
                color: pageAssetSaveStatus === "error" ? "var(--astra-danger)" : "var(--astra-success)",
                lineHeight: 1.45,
              }}
            >
              {pageAssetSaveMessage}
            </div>
          )}
          <button
            data-testid="study-save-page-asset"
            type="button"
            style={{
              ...actionButtonStyle,
              marginTop: 8,
              ...(pageAssetSaveStatus === "saved" || pageAssetSaveStatus === "saving" ? { opacity: 0.72 } : {}),
            }}
            onClick={onSavePageAsset}
            disabled={pageAssetSaveStatus === "saved" || pageAssetSaveStatus === "saving"}
          >
            {pageAssetSaveStatus === "saved"
              ? t("popup_contentAssetizationSavedAction")
              : pageAssetSaveStatus === "saving"
                ? t("popup_contentAssetizationSavingAction")
                : t("popup_contentAssetizationSaveAction")}
          </button>
        </div>
      )}

      {pageSavedReviewSummary && (
        <div
          data-testid="study-page-saved-review-cta"
          style={{
            marginTop: 10,
            padding: "10px 12px",
            background: "var(--astra-success-bg)",
            border: "1px solid var(--astra-success-border)",
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--astra-success)", marginBottom: 4 }}>
            {t("popup_studyPageSavedReviewTitle")}
          </div>
          <div style={{ fontSize: 11, color: "var(--astra-success)", lineHeight: 1.45, marginBottom: 8 }}>
            {t("popup_studyPageSavedReviewHint", String(pageSavedReviewSummary.count))}
          </div>
          <button
            data-testid="study-page-saved-review-button"
            type="button"
            style={actionButtonStyle}
            onClick={onReviewPageSavedSentences}
          >
            {t("popup_studyPageSavedReviewAction")}
          </button>
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 12, color: "var(--astra-text-secondary)", lineHeight: 1.55 }}>
        {summary || t("popup_studySummaryEmpty")}
      </div>

      {!!studyContext?.articleExcerpt?.trim() && (
        <div style={{
          marginTop: 8,
          padding: "8px 10px",
          background: "var(--astra-bg-card)",
          border: "1px solid var(--astra-border)",
          borderRadius: 8,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--astra-text-secondary)", marginBottom: 4 }}>
            {t("popup_studyArticleExcerpt")}
          </div>
          <div style={{ fontSize: 12, color: "var(--astra-text-secondary)", lineHeight: 1.55 }}>
            {studyContext.articleExcerpt?.trim()}
          </div>
        </div>
      )}

      {sentenceCards.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--astra-text-secondary)" }}>
              {t("popup_studySentenceDeck")}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--astra-text-muted)" }}>
                {selectedSentenceIndex + 1} / {sentenceCards.length}
              </span>
              <button
                data-testid="study-sentence-prev"
                type="button"
                style={actionButtonStyle}
                onClick={() => onSelectSentence(selectedSentenceIndex - 1)}
                disabled={sentenceActionLocked || selectedSentenceIndex <= 0}
              >
                {t("actionPrevious")}
              </button>
              <button
                data-testid="study-sentence-speak"
                type="button"
                style={actionButtonStyle}
                onClick={() => onToggleSentenceSpeech(selectedSentence?.index)}
                disabled={sentenceActionLocked || !selectedSentence}
              >
                {selectedSentence?.speaking ? t("actionStop") : t("actionSpeak")}
              </button>
              <button
                data-testid="study-sentence-next"
                type="button"
                style={actionButtonStyle}
                onClick={() => onSelectSentence(selectedSentenceIndex + 1)}
                disabled={sentenceActionLocked || selectedSentenceIndex >= sentenceCards.length - 1}
              >
                {t("actionNext")}
              </button>
            </div>
          </div>
          {sentenceDeckFallbackMessage && (
            <div
              data-testid="study-sentence-deck-fallback"
              style={{
                marginBottom: 8,
                padding: "6px 8px",
                background: "var(--astra-popup-bg-soft)",
                border: "1px solid var(--astra-popup-border-warm-strong)",
                borderRadius: 8,
                fontSize: 11,
                color: "var(--astra-popup-text-warm-strong)",
                lineHeight: 1.45,
              }}
            >
              {sentenceDeckFallbackMessage}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sentenceCards.map((card) => {
              const statusChips = [
                card.selected ? t("popup_studySentenceSelected") : null,
                card.explainStatus === "explaining" ? t("popup_studySentenceExplaining") : null,
                card.explainStatus === "explained" ? t("popup_studySentenceExplained") : null,
                card.saveStatus === "saving" ? t("actionSaving") : null,
                card.saveStatus === "saved" ? t("actionSaved") : null,
                card.speaking ? t("popup_studySentenceSpeaking") : null,
              ].filter((value): value is string => Boolean(value))

              return (
                <div
                  data-testid={`study-sentence-card-${card.index}`}
                  key={card.id}
                  style={{
                    padding: "8px 10px",
                    background: card.selected ? "var(--astra-popup-bg-soft)" : "var(--astra-bg-card)",
                    border: card.selected ? "1px solid var(--astra-popup-border-warm-strong)" : "1px solid var(--astra-popup-border-warm)",
                    borderRadius: 8,
                    cursor: sentenceActionLocked ? "default" : "pointer",
                  }}
                  onClick={() => {
                    if (!sentenceActionLocked) {
                      onSelectSentence(card.index)
                    }
                  }}
                >
                  <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginBottom: 4 }}>
                    {card.index + 1}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--astra-text-primary)", lineHeight: 1.55 }}>
                    {card.text}
                  </div>
                  {statusChips.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      {statusChips.map((label) => (
                        <span
                          key={label}
                          style={{
                            fontSize: 10,
                            color: "var(--astra-text-secondary)",
                            background: "var(--astra-bg-primary)",
                            border: "1px solid var(--astra-border-strong)",
                            borderRadius: 999,
                            padding: "2px 7px",
                            fontWeight: 600,
                          }}
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    <button
                      type="button"
                      style={actionButtonStyle}
                      onClick={(event) => {
                        event.stopPropagation()
                        onExplainSentence(card.index)
                      }}
                      disabled={sentenceActionLocked || studyActionRunningId !== null}
                    >
                      {card.explainStatus === "explaining" ? `${t("popup_studyExplainSentence")}...` : t("popup_studyExplainSentence")}
                    </button>
                    <button
                      type="button"
                      style={actionButtonStyle}
                      onClick={(event) => {
                        event.stopPropagation()
                        onSaveSentence(card.index)
                      }}
                      disabled={sentenceActionLocked || card.saveStatus === "saved"}
                    >
                      {card.saveStatus === "saved" ? t("actionSaved") : card.saveStatus === "saving" ? t("actionSaving") : t("actionSave")}
                    </button>
                  </div>
                  {card.selected && card.explanationText && (
                    <div style={{
                      marginTop: 8,
                      padding: "8px 10px",
                      background: "var(--astra-popup-bg-soft)",
                      border: "1px solid var(--astra-popup-border-warm-strong)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "var(--astra-popup-text-warm)",
                      lineHeight: 1.55,
                      whiteSpace: "pre-wrap",
                    }}>
                      {card.explainProfileLabel && (
                        <div
                          data-testid={`study-sentence-explain-profile-${card.index}`}
                          style={{ fontSize: 10, fontWeight: 700, color: "var(--astra-popup-text-warm-strong)", marginBottom: 6 }}
                        >
                          {card.explainProfileLabel}
                        </div>
                      )}
                      {card.glossaryEvidenceLabel && (
                        <div
                          data-testid={`study-sentence-glossary-evidence-${card.index}`}
                          style={{ fontSize: 10, fontWeight: 700, color: "var(--astra-success)", marginBottom: 6 }}
                        >
                          {card.glossaryEvidenceLabel}
                        </div>
                      )}
                      {card.explanationText}
                    </div>
                  )}
                  {card.selected && card.saveStatus === "saved" && (
                    <div
                      data-testid={`study-sentence-saved-cta-${card.index}`}
                      style={{
                        marginTop: 8,
                        padding: "8px 10px",
                        background: "var(--astra-success-bg)",
                        border: "1px solid var(--astra-success-border)",
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--astra-success)" }}>
                        {t("popup_studySavedToVocabulary")}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--astra-success)", marginTop: 2 }}>
                        {t("popup_studySavedContinue")}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                        <button
                          data-testid={`study-sentence-review-now-${card.index}`}
                          type="button"
                          style={actionButtonStyle}
                          onClick={(event) => {
                            event.stopPropagation()
                            onReviewSavedSentence(card.index)
                          }}
                        >
                          {card.savedEntryId ? t("review_actionReviewThisSentenceNow") : (dueCount > 0 ? `${t("popup_review")} (${dueCount})` : t("popup_review"))}
                        </button>
                        <button
                          data-testid={`study-sentence-open-vocabulary-${card.index}`}
                          type="button"
                          style={secondaryActionButtonStyle}
                          onClick={(event) => {
                            event.stopPropagation()
                            onOpenVocabulary()
                          }}
                        >
                          {t("popup_vocabulary")}
                        </button>
                        <button
                          data-testid={`study-sentence-open-review-${card.index}`}
                          type="button"
                          style={{ ...secondaryActionButtonStyle, display: card.savedEntryId ? "none" : undefined }}
                          onClick={(event) => {
                            event.stopPropagation()
                            onOpenReview()
                          }}
                        >
                          {dueCount > 0 ? `${t("popup_review")} (${dueCount})` : t("popup_review")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Page Digest Card */}
      {digestLoading && (
        <div style={{
          marginTop: 10,
          padding: "8px 10px",
          background: "var(--astra-popup-bg-soft)",
          border: "1px solid var(--astra-popup-border-warm-strong)",
          borderRadius: 8,
          fontSize: 12,
          color: "var(--astra-popup-text-warm-strong)",
        }}>
          {t("popup_digestGenerating")}
        </div>
      )}
      {!digestLoading && pageDigest && (
        <div style={{
          marginTop: 10,
          padding: "10px 12px",
          background: "var(--astra-popup-bg-soft)",
          border: "1px solid var(--astra-popup-border-warm)",
          borderRadius: 8,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--astra-popup-text-warm-strong)", marginBottom: 4 }}>
              {pageDigest.headline}
            </div>
            {digestStale && (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: "var(--astra-popup-text-warm-strong)",
                background: "var(--astra-popup-bg-start)",
                border: "1px solid var(--astra-popup-border-warm-strong)",
                borderRadius: 999,
                padding: "2px 8px",
                whiteSpace: "nowrap",
              }}>
                {t("popup_digestStale")}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "var(--astra-text-secondary)", lineHeight: 1.55 }}>
            {pageDigest.summary}
          </div>
          {pageDigest.keyPoints.length > 0 && (
            <ul style={{ margin: "6px 0 0 0", paddingLeft: 18, fontSize: 12, color: "var(--astra-popup-text-warm)", lineHeight: 1.55 }}>
              {pageDigest.keyPoints.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          )}
          {pageDigest.vocabularyFocus.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--astra-popup-text-warm-strong)", marginBottom: 4 }}>
                {t("popup_digestVocabularyFocus")}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {pageDigest.vocabularyFocus.map((item, i) => (
                  <div
                    key={`${item.term}-${i}`}
                    style={{
                      background: "var(--astra-popup-bg-soft)",
                      border: "1px solid var(--astra-popup-border-warm-strong)",
                      borderRadius: 8,
                      padding: "6px 8px",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--astra-popup-text-warm-strong)" }}>{item.term}</div>
                    <div style={{ fontSize: 11, color: "var(--astra-popup-text-warm)", lineHeight: 1.45 }}>{item.note}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {pageDigest.grammarFocus.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--astra-popup-text-warm-strong)", marginBottom: 4 }}>
                {t("popup_digestGrammarFocus")}
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--astra-popup-text-warm)", lineHeight: 1.55 }}>
                {pageDigest.grammarFocus.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </div>
          )}
          {pageDigest.suggestedAction && (
            <div style={{
              marginTop: 8,
              padding: "8px 10px",
              background: "var(--astra-bg-card)",
              border: "1px dashed var(--astra-popup-border-warm-strong)",
              borderRadius: 8,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--astra-popup-text-warm-strong)", marginBottom: 2 }}>
                {t("popup_digestNextStep")}
              </div>
              <div style={{ fontSize: 12, color: "var(--astra-popup-text-warm)", lineHeight: 1.55 }}>
                {pageDigest.suggestedAction}
              </div>
            </div>
          )}
          {digestStale && (
            <div style={{
              marginTop: 8,
              padding: "8px 10px",
              background: "var(--astra-popup-bg-soft)",
              border: "1px solid var(--astra-popup-border-warm-strong)",
              borderRadius: 8,
            }}>
              <div style={{ fontSize: 11, color: "var(--astra-popup-text-warm-strong)", lineHeight: 1.45 }}>
                {t("popup_digestStaleHint")}
              </div>
              <button
                type="button"
                style={{ ...actionButtonStyle, marginTop: 8 }}
                onClick={onRegenerateDigest}
              >
                {t("popup_regenerateDigest")}
              </button>
            </div>
          )}
        </div>
      )}
      {!digestLoading && !pageDigest && studyContext && (
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            style={actionButtonStyle}
            onClick={onGenerateDigest}
          >
            {t("popup_generateDigest")}
          </button>
        </div>
      )}

      {weeklyRoi && <WeeklyRoiSummaryCard weeklyRoi={weeklyRoi} />}

      {studyLoop?.dailyStats && (
        <div
          style={{
            marginTop: 10,
            padding: "10px 12px",
            background: "var(--astra-bg-subtle)",
            border: "1px solid var(--astra-border)",
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--astra-text-secondary)", marginBottom: 8 }}>
            {t("popup_studyTodayStatsTitle")}
          </div>
          <div style={{ fontSize: 10, color: "var(--astra-text-hint)", marginBottom: 8 }}>
            {t("popup_studyTodayStatsHint", studyLoop.dailyStats.date)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            <div style={{ padding: "8px 10px", background: "var(--astra-bg-card)", borderRadius: 8, border: "1px solid var(--astra-border)" }}>
              <div style={{ fontSize: 10, color: "var(--astra-text-muted)", marginBottom: 2 }}>{t("popup_studyStatPagesLabel")}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--astra-text-primary)" }}>{studyLoop.dailyStats.pagesStudied}</div>
            </div>
            <div style={{ padding: "8px 10px", background: "var(--astra-bg-card)", borderRadius: 8, border: "1px solid var(--astra-border)" }}>
              <div style={{ fontSize: 10, color: "var(--astra-text-muted)", marginBottom: 2 }}>{t("popup_studyStatExplainedLabel")}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--astra-text-primary)" }}>{studyLoop.dailyStats.sentencesExplained}</div>
            </div>
            <div style={{ padding: "8px 10px", background: "var(--astra-bg-card)", borderRadius: 8, border: "1px solid var(--astra-border)" }}>
              <div style={{ fontSize: 10, color: "var(--astra-text-muted)", marginBottom: 2 }}>{t("popup_studyStatSavedLabel")}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--astra-text-primary)" }}>{studyLoop.dailyStats.vocabSaved}</div>
            </div>
            <div style={{ padding: "8px 10px", background: "var(--astra-bg-card)", borderRadius: 8, border: "1px solid var(--astra-border)" }}>
              <div style={{ fontSize: 10, color: "var(--astra-text-muted)", marginBottom: 2 }}>{t("popup_studyStatReviewedLabel")}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--astra-text-primary)" }}>{studyLoop.dailyStats.vocabReviewed}</div>
            </div>
          </div>
        </div>
      )}

      {currentPageActivity && (
        <div style={{ marginTop: 10, fontSize: 11, color: "var(--astra-text-muted)" }}>
          {currentPageActivity.hostname} · {currentPageActivity.wordsTranslated} {t("popup_words")}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button type="button" style={secondaryActionButtonStyle} onClick={onOpenReview}>
          {dueCount > 0 ? `${t("popup_review")} (${dueCount})` : t("popup_review")}
        </button>
        <button type="button" style={secondaryActionButtonStyle} onClick={onOpenVocabulary}>
          {t("popup_vocabulary")}
        </button>
        <button
          data-testid="study-open-reading-queue"
          type="button"
          style={secondaryActionButtonStyle}
          onClick={onOpenReadingQueue}
        >
          {t("vocabulary_actionOpenReadingQueue")}
        </button>
      </div>

      {(canSpeakStudy || studyQuickActions.length > 0) && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              style={{
                ...actionButtonStyle,
                ...(canSpeakStudy ? {} : { opacity: 0.55, cursor: "not-allowed" }),
              }}
              onClick={onToggleStudySpeech}
              disabled={!canSpeakStudy}
            >
              {speakingStudy ? t("actionStop") : t("actionSpeak")}
            </button>
            {studyQuickActions.map((action) => (
              <button
                key={action.id}
                type="button"
                style={{
                  ...actionButtonStyle,
                  ...(studyActionRunningId === action.id ? { opacity: 0.7 } : {}),
                }}
                onClick={() => onRunStudyAction(action.id)}
                disabled={studyActionRunningId !== null || sentenceActionLocked}
              >
                {studyActionRunningId === action.id ? `${action.labelZh}…` : action.labelZh}
              </button>
            ))}
          </div>
          {studyActionResult && (
            <div style={{
              marginTop: 8,
              padding: "8px 10px",
              background: "var(--astra-bg-card)",
              border: "1px solid var(--astra-popup-border-warm)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--astra-popup-text-warm)",
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
            }}>
              {studyActionResult.text}
            </div>
          )}
        </div>
      )}

      {recentHistory.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--astra-text-secondary)", marginBottom: 6 }}>
            {t("popup_recentTranslations")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recentHistory.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => onOpenHistoryEntry(entry.url)}
                className="astra-cursor-pointer"
                style={{
                  border: "1px solid var(--astra-border)",
                  background: "var(--astra-bg-card)",
                  borderRadius: 8,
                  padding: "8px 10px",
                  textAlign: "left",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--astra-text-primary)" }}>
                  {entry.title}
                </div>
                <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginTop: 2 }}>
                  {entry.hostname} · {entry.wordsTranslated} {t("popup_words")} · {formatVisitAgeLabel(entry.visitedAt)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}