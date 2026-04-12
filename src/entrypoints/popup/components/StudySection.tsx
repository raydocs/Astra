import { t } from "@/utils/i18n"
import type { PageStudyContext } from "@/types/messages"
import type { ReadingHistoryEntry } from "@/utils/storage/reading-history"
import type { PageDigestRecord } from "@/utils/storage/page-digests"
import { STUDY_STEPS_ORDER, type StudyLoopViewModel, type StudyStep } from "@/utils/storage/study-progress"

interface StudySectionProps {
  currentPageActivity: ReadingHistoryEntry | null
  dueCount: number
  recentHistory: ReadingHistoryEntry[]
  studyContext: PageStudyContext | null
  canReadArticle: boolean
  studyLoop: StudyLoopViewModel | null
  pageDigest: PageDigestRecord | null
  digestLoading: boolean
  onGenerateDigest: () => void
  onOpenHistoryEntry: (url: string) => void
  onOpenReview: () => void
  onOpenVocabulary: () => void
  onReadArticle: () => void
  onExplainSentence: () => void
}

const cardStyle: React.CSSProperties = {
  marginTop: 12,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: 12,
}

const actionButtonStyle: React.CSSProperties = {
  border: "1px solid #dbeafe",
  background: "#eff6ff",
  color: "#2563eb",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
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
                background: done ? "#6366f1" : "#e2e8f0",
                transition: "background 0.2s",
              }}
              title={`${getStepLabel(step)}${done ? t("popup_studyStepDone") : ""}`}
            />
          )
        })}
      </div>
      <div style={{ fontSize: 10, color: "#94a3b8" }}>
        {completionPercent}% — {completedSteps.map((s) => getStepLabel(s)).join(" → ")}
      </div>
    </div>
  )
}

function NextStepBanner({ nextStep, onReadArticle, onExplainSentence, onOpenVocabulary, onOpenReview, canReadArticle, dueCount }: {
  nextStep: StudyStep | null
  onReadArticle: () => void
  onExplainSentence: () => void
  onOpenVocabulary: () => void
  onOpenReview: () => void
  canReadArticle: boolean
  dueCount: number
}) {
  if (!nextStep) {
    return (
      <div style={{
        marginTop: 8,
        padding: "6px 10px",
        background: "#ecfdf5",
        border: "1px solid #a7f3d0",
        borderRadius: 8,
        fontSize: 12,
        color: "#065f46",
        fontWeight: 600,
      }}
      >
        {t("popup_studyAllComplete")}
      </div>
    )
  }

  const actions: Record<StudyStep, { label: string; handler: () => void; disabled?: boolean }> = {
    read: { label: t("popup_readArticle"), handler: onReadArticle, disabled: !canReadArticle },
    guided_read: { label: t("popup_studyStartGuidedRead"), handler: onReadArticle, disabled: !canReadArticle },
    explain: { label: t("popup_studyExplainSentence"), handler: onExplainSentence },
    vocab_save: { label: t("popup_studySaveWords"), handler: onOpenVocabulary },
    vocab_review: { label: dueCount > 0 ? `${t("popup_review")} (${dueCount})` : t("popup_review"), handler: onOpenReview },
  }

  const action = actions[nextStep]

  return (
    <div style={{
      marginTop: 8,
      padding: "8px 10px",
      background: "#eff6ff",
      border: "1px solid #bfdbfe",
      borderRadius: 8,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    }}
    >
      <span style={{ fontSize: 12, color: "#1e40af", fontWeight: 500 }}>
        {t("popup_studyNext")} {getStepLabel(nextStep)}
      </span>
      <button
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

export default function StudySection({
  currentPageActivity,
  dueCount,
  recentHistory,
  studyContext,
  canReadArticle,
  studyLoop,
  pageDigest,
  digestLoading,
  onGenerateDigest,
  onOpenHistoryEntry,
  onOpenReview,
  onOpenVocabulary,
  onReadArticle,
  onExplainSentence,
}: StudySectionProps) {
  const summary = studyContext?.contentSummary ?? studyContext?.metaDescription

  return (
    <section style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
            {t("popup_studyTitle")}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
            {studyContext?.pageTitle || t("popup_studyEmptyTitle")}
          </div>
        </div>
        <div style={{
          fontSize: 11,
          color: dueCount > 0 ? "#b45309" : "#64748b",
          background: dueCount > 0 ? "#fef3c7" : "#e2e8f0",
          borderRadius: 999,
          padding: "4px 8px",
          whiteSpace: "nowrap",
        }}
        >
          {t("popup_studyDueCount", String(dueCount))}
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: "#334155", lineHeight: 1.55 }}>
        {summary || t("popup_studySummaryEmpty")}
      </div>

      {studyLoop && (
        <>
          <StudyProgressBar
            completionPercent={studyLoop.completionPercent}
            completedSteps={studyLoop.currentPage?.completedSteps ?? []}
          />
          <NextStepBanner
            nextStep={studyLoop.nextStep}
            onReadArticle={onReadArticle}
            onExplainSentence={onExplainSentence}
            onOpenVocabulary={onOpenVocabulary}
            onOpenReview={onOpenReview}
            canReadArticle={canReadArticle}
            dueCount={dueCount}
          />
        </>
      )}

      {/* Page Digest Card */}
      {digestLoading && (
        <div style={{
          marginTop: 10,
          padding: "8px 10px",
          background: "#f0f9ff",
          border: "1px solid #bae6fd",
          borderRadius: 8,
          fontSize: 12,
          color: "#0369a1",
        }}>
          {t("popup_digestGenerating")}
        </div>
      )}
      {!digestLoading && pageDigest && (
        <div style={{
          marginTop: 10,
          padding: "10px 12px",
          background: "#fefce8",
          border: "1px solid #fde68a",
          borderRadius: 8,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>
            {pageDigest.headline}
          </div>
          <div style={{ fontSize: 12, color: "#451a03", lineHeight: 1.55 }}>
            {pageDigest.summary}
          </div>
          {pageDigest.keyPoints.length > 0 && (
            <ul style={{ margin: "6px 0 0 0", paddingLeft: 18, fontSize: 12, color: "#78350f", lineHeight: 1.55 }}>
              {pageDigest.keyPoints.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
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

      {studyLoop?.dailyStats && (
        <div style={{ marginTop: 10, display: "flex", gap: 12, fontSize: 11, color: "#64748b" }}>
          <span>{t("popup_studyStatPages", String(studyLoop.dailyStats.pagesStudied))}</span>
          <span>{t("popup_studyStatExplained", String(studyLoop.dailyStats.sentencesExplained))}</span>
          <span>{t("popup_studyStatSaved", String(studyLoop.dailyStats.vocabSaved))}</span>
          <span>{t("popup_studyStatReviewed", String(studyLoop.dailyStats.vocabReviewed))}</span>
        </div>
      )}

      {currentPageActivity && (
        <div style={{ marginTop: 10, fontSize: 11, color: "#64748b" }}>
          {currentPageActivity.hostname} · {currentPageActivity.wordsTranslated} {t("popup_words")}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          style={{
            ...actionButtonStyle,
            ...(canReadArticle ? {} : { opacity: 0.55, cursor: "not-allowed" }),
          }}
          onClick={onReadArticle}
          disabled={!canReadArticle}
        >
          {t("popup_readArticle")}
        </button>
        <button type="button" style={actionButtonStyle} onClick={onOpenReview}>
          {dueCount > 0 ? `${t("popup_review")} (${dueCount})` : t("popup_review")}
        </button>
        <button type="button" style={actionButtonStyle} onClick={onOpenVocabulary}>
          {t("popup_vocabulary")}
        </button>
      </div>

      {recentHistory.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
            {t("popup_recentTranslations")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recentHistory.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => onOpenHistoryEntry(entry.url)}
                style={{
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  borderRadius: 8,
                  padding: "8px 10px",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>
                  {entry.title}
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                  {entry.hostname} · {entry.wordsTranslated} {t("popup_words")}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
