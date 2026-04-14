import { t } from "@/utils/i18n"
import type { PageStudyContext } from "@/types/messages"
import type { ReadingHistoryEntry } from "@/utils/storage/reading-history"
import type { PageDigestRecord } from "@/utils/storage/page-digests"
import { STUDY_STEPS_ORDER, type StudyLoopViewModel, type StudyStep } from "@/utils/storage/study-progress"

export type PopupSentenceExplainStatus = "idle" | "explaining" | "explained"
export type PopupSentenceSaveStatus = "idle" | "saving" | "saved"

export interface PopupSentenceCardViewModel {
  id: string
  text: string
  index: number
  selected: boolean
  explainStatus: PopupSentenceExplainStatus
  explanationText: string | null
  saveStatus: PopupSentenceSaveStatus
  speaking: boolean
}

interface StudySectionProps {
  currentPageActivity: ReadingHistoryEntry | null
  dueCount: number
  recentHistory: ReadingHistoryEntry[]
  studyContext: PageStudyContext | null
  canReadArticle: boolean
  studyLoop: StudyLoopViewModel | null
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
  onOpenHistoryEntry: (url: string) => void
  onOpenReview: () => void
  onOpenVocabulary: () => void
  onReadArticle: () => void
  onExplainSentence: (sentenceIndex?: number) => void
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
                background: done ? "#6366f1" : "#e2e8f0",
                transition: "background 0.2s",
              }}
              title={`${getStepLabel(step)}${done ? t("popup_studyStepDone") : ""}`}
            />
          )
        })}
      </div>
      <div style={{ fontSize: 10, color: "#94a3b8" }}>
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
        background: "#f8fafc",
        border: "1px solid #dbeafe",
        borderRadius: 10,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "#1e3a8a", marginBottom: 4 }}>
        {t("popup_studyCurrentPageProgressTitle")}
      </div>
      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8 }}>
        {t("popup_studyCurrentPageProgressHint")}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "#1e293b", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 999, padding: "3px 8px", fontWeight: 600 }}>
          {t("popup_studyStatExplained", String(studyLoop.currentCounts.sentencesExplained))}
        </span>
        <span style={{ fontSize: 11, color: "#1e293b", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 999, padding: "3px 8px", fontWeight: 600 }}>
          {t("popup_studyStatSaved", String(studyLoop.currentCounts.vocabSaved))}
        </span>
        <span style={{ fontSize: 11, color: "#1e293b", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 999, padding: "3px 8px", fontWeight: 600 }}>
          {t("popup_studyStatReviewed", String(studyLoop.currentCounts.vocabReviewed))}
        </span>
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
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: "#1e40af", fontWeight: 600 }}>
          {t("popup_studyNext")} {getStepLabel(nextStep)}
        </div>
        <div style={{ fontSize: 11, color: "#1d4ed8", marginTop: 2, lineHeight: 1.4 }}>
          {getNextStepHint(nextStep)}
        </div>
      </div>
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
  onOpenHistoryEntry,
  onOpenReview,
  onOpenVocabulary,
  onReadArticle,
  onExplainSentence,
}: StudySectionProps) {
  const summary = studyContext?.contentSummary?.trim() || studyContext?.metaDescription?.trim() || ""
  const selectedSentence = sentenceCards[selectedSentenceIndex] ?? null

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

      {!!studyContext?.articleExcerpt?.trim() && (
        <div style={{
          marginTop: 8,
          padding: "8px 10px",
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
            {t("popup_studyArticleExcerpt")}
          </div>
          <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.55 }}>
            {studyContext.articleExcerpt?.trim()}
          </div>
        </div>
      )}

      {sentenceCards.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#475569" }}>
              {t("popup_studySentenceDeck")}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#64748b" }}>
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
                background: "#fff7ed",
                border: "1px solid #fdba74",
                borderRadius: 8,
                fontSize: 11,
                color: "#9a3412",
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
                    background: card.selected ? "#eff6ff" : "#fff",
                    border: card.selected ? "1px solid #60a5fa" : "1px solid #dbeafe",
                    borderRadius: 8,
                    cursor: sentenceActionLocked ? "default" : "pointer",
                  }}
                  onClick={() => {
                    if (!sentenceActionLocked) {
                      onSelectSentence(card.index)
                    }
                  }}
                >
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                    {card.index + 1}
                  </div>
                  <div style={{ fontSize: 12, color: "#1e293b", lineHeight: 1.55 }}>
                    {card.text}
                  </div>
                  {statusChips.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      {statusChips.map((label) => (
                        <span
                          key={label}
                          style={{
                            fontSize: 10,
                            color: "#475569",
                            background: "#f8fafc",
                            border: "1px solid #cbd5e1",
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
                      background: "#eff6ff",
                      border: "1px solid #bfdbfe",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "#1e3a8a",
                      lineHeight: 1.55,
                      whiteSpace: "pre-wrap",
                    }}>
                      {card.explanationText}
                    </div>
                  )}
                  {card.selected && card.saveStatus === "saved" && (
                    <div
                      data-testid={`study-sentence-saved-cta-${card.index}`}
                      style={{
                        marginTop: 8,
                        padding: "8px 10px",
                        background: "#ecfdf5",
                        border: "1px solid #a7f3d0",
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#065f46" }}>
                        {t("popup_studySavedToVocabulary")}
                      </div>
                      <div style={{ fontSize: 11, color: "#047857", marginTop: 2 }}>
                        {t("popup_studySavedContinue")}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                        <button
                          data-testid={`study-sentence-open-vocabulary-${card.index}`}
                          type="button"
                          style={actionButtonStyle}
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
                          style={actionButtonStyle}
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>
              {pageDigest.headline}
            </div>
            {digestStale && (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#9a3412",
                background: "#ffedd5",
                border: "1px solid #fdba74",
                borderRadius: 999,
                padding: "2px 8px",
                whiteSpace: "nowrap",
              }}>
                {t("popup_digestStale")}
              </span>
            )}
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
          {pageDigest.vocabularyFocus.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>
                {t("popup_digestVocabularyFocus")}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {pageDigest.vocabularyFocus.map((item, i) => (
                  <div
                    key={`${item.term}-${i}`}
                    style={{
                      background: "#fff7ed",
                      border: "1px solid #fdba74",
                      borderRadius: 8,
                      padding: "6px 8px",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#9a3412" }}>{item.term}</div>
                    <div style={{ fontSize: 11, color: "#7c2d12", lineHeight: 1.45 }}>{item.note}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {pageDigest.grammarFocus.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>
                {t("popup_digestGrammarFocus")}
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#78350f", lineHeight: 1.55 }}>
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
              background: "#fff",
              border: "1px dashed #f59e0b",
              borderRadius: 8,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", marginBottom: 2 }}>
                {t("popup_digestNextStep")}
              </div>
              <div style={{ fontSize: 12, color: "#78350f", lineHeight: 1.55 }}>
                {pageDigest.suggestedAction}
              </div>
            </div>
          )}
          {digestStale && (
            <div style={{
              marginTop: 8,
              padding: "8px 10px",
              background: "#fff7ed",
              border: "1px solid #fdba74",
              borderRadius: 8,
            }}>
              <div style={{ fontSize: 11, color: "#9a3412", lineHeight: 1.45 }}>
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

      {studyLoop && (
        <>
          {studyLoop.currentPage && studyLoop.nextStep && studyLoop.completedSteps.length > 0 && (
            <div
              style={{
                marginTop: 10,
                padding: "8px 10px",
                background: "#f0fdf4",
                border: "1px solid #86efac",
                borderRadius: 8,
                fontSize: 12,
                color: "#166534",
                lineHeight: 1.45,
              }}
            >
              {t("popup_studyResumeFromLast")}
            </div>
          )}
          <CurrentPageProgressCard studyLoop={studyLoop} />
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
            canReadArticle={canReadArticle}
            dueCount={dueCount}
          />
        </>
      )}

      {studyLoop?.dailyStats && (
        <div
          style={{
            marginTop: 10,
            padding: "10px 12px",
            background: "#fafafa",
            border: "1px solid #e5e5e5",
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: "#525252", marginBottom: 8 }}>
            {t("popup_studyTodayStatsTitle")}
          </div>
          <div style={{ fontSize: 10, color: "#a3a3a3", marginBottom: 8 }}>
            {t("popup_studyTodayStatsHint", studyLoop.dailyStats.date)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            <div style={{ padding: "8px 10px", background: "#fff", borderRadius: 8, border: "1px solid #e5e5e5" }}>
              <div style={{ fontSize: 10, color: "#737373", marginBottom: 2 }}>{t("popup_studyStatPagesLabel")}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#171717" }}>{studyLoop.dailyStats.pagesStudied}</div>
            </div>
            <div style={{ padding: "8px 10px", background: "#fff", borderRadius: 8, border: "1px solid #e5e5e5" }}>
              <div style={{ fontSize: 10, color: "#737373", marginBottom: 2 }}>{t("popup_studyStatExplainedLabel")}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#171717" }}>{studyLoop.dailyStats.sentencesExplained}</div>
            </div>
            <div style={{ padding: "8px 10px", background: "#fff", borderRadius: 8, border: "1px solid #e5e5e5" }}>
              <div style={{ fontSize: 10, color: "#737373", marginBottom: 2 }}>{t("popup_studyStatSavedLabel")}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#171717" }}>{studyLoop.dailyStats.vocabSaved}</div>
            </div>
            <div style={{ padding: "8px 10px", background: "#fff", borderRadius: 8, border: "1px solid #e5e5e5" }}>
              <div style={{ fontSize: 10, color: "#737373", marginBottom: 2 }}>{t("popup_studyStatReviewedLabel")}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#171717" }}>{studyLoop.dailyStats.vocabReviewed}</div>
            </div>
          </div>
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
              background: "#fff",
              border: "1px solid #dbeafe",
              borderRadius: 8,
              fontSize: 12,
              color: "#1e3a8a",
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
