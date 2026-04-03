import { t } from "@/utils/i18n"
import type { PageStudyContext } from "@/types/messages"
import type { ReadingHistoryEntry } from "@/utils/storage/reading-history"

interface StudySectionProps {
  currentPageActivity: ReadingHistoryEntry | null
  dueCount: number
  recentHistory: ReadingHistoryEntry[]
  studyContext: PageStudyContext | null
  onOpenHistoryEntry: (url: string) => void
  onOpenReview: () => void
  onOpenVocabulary: () => void
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

export default function StudySection({
  currentPageActivity,
  dueCount,
  recentHistory,
  studyContext,
  onOpenHistoryEntry,
  onOpenReview,
  onOpenVocabulary,
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

      {currentPageActivity && (
        <div style={{ marginTop: 10, fontSize: 11, color: "#64748b" }}>
          {currentPageActivity.hostname} · {currentPageActivity.wordsTranslated} {t("popup_words")}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
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
