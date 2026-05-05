import type React from "react"
import { DEFAULT_LEARNING_LOOP_COPY_VARIANT, LEARNING_LOOP_COMMERCIAL_SURFACE_COPY, LEARNING_LOOP_COPY, type LearningLoopCopyVariant } from "@/utils/learning-loop-events"
import type { StudyLoopPrimerAction } from "@/utils/storage/study-progress"

export interface LearningClosurePrimerCardProps {
  canTranslatePage: boolean
  canReadArticle: boolean
  canExplainSentence: boolean
  dueCount: number
  sentenceCount: number
  copyVariant?: LearningLoopCopyVariant
  recommendedAction?: StudyLoopPrimerAction | null
  onTranslatePage: () => void
  onReadArticle: () => void
  onExplainSentence: () => void
  onOpenReview: () => void
}

const stepStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "flex-start",
  fontSize: 12,
  color: "var(--astra-text-secondary)",
  lineHeight: 1.45,
}

const stepNumberStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 18,
  height: 18,
  borderRadius: "50%",
  background: "var(--astra-popup-bg-start)",
  color: "var(--astra-popup-text-warm-strong)",
  fontSize: 11,
  fontWeight: 800,
  flex: "0 0 auto",
  marginTop: 1,
}

function Step({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <li style={stepStyle}>
      <span style={stepNumberStyle}>{index}</span>
      <span>{children}</span>
    </li>
  )
}

function recommendedButtonStyle(isRecommended: boolean): React.CSSProperties {
  return {
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 700,
    border: isRecommended ? "2px solid var(--astra-accent-warm)" : undefined,
    boxShadow: isRecommended ? "var(--astra-popup-ring-warm)" : undefined,
  }
}

function RecommendedMarker({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <span
      data-testid="learning-closure-primer-recommended-marker"
      style={{
        display: "block",
        marginTop: 4,
        fontSize: 10,
        fontWeight: 800,
        color: "var(--astra-popup-text-warm-strong)",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      Recommended next
    </span>
  )
}

export default function LearningClosurePrimerCard({
  canTranslatePage,
  canReadArticle,
  canExplainSentence,
  dueCount,
  sentenceCount,
  copyVariant = DEFAULT_LEARNING_LOOP_COPY_VARIANT,
  recommendedAction = null,
  onTranslatePage,
  onReadArticle,
  onExplainSentence,
  onOpenReview,
}: LearningClosurePrimerCardProps) {
  const hasDueReviews = dueCount > 0
  const copy = LEARNING_LOOP_COPY[copyVariant].popup
  const packageSummary = LEARNING_LOOP_COMMERCIAL_SURFACE_COPY.popupPrimer
  const firstWinCopy = LEARNING_LOOP_COMMERCIAL_SURFACE_COPY.firstWinActivation

  return (
    <section
      data-testid="learning-closure-primer-card"
      data-copy-variant={copyVariant}
      data-recommended-action={recommendedAction ?? "none"}
      aria-label="Learning closure primer"
      style={{
        marginTop: 12,
        background: "var(--astra-popup-bg-soft)",
        border: "1px solid var(--astra-popup-border-warm)",
        borderRadius: 12,
        padding: 12,
        boxShadow: "var(--astra-popup-shadow-warm-sm)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--astra-popup-text-warm)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {copy.eyebrow}
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--astra-text-primary)", marginTop: 2 }}>
            {copy.title}
          </div>
        </div>
        <span style={{
          flex: "0 0 auto",
          padding: "3px 8px",
          borderRadius: 999,
          background: hasDueReviews ? "var(--astra-success-bg)" : "var(--astra-bg-subtle)",
          color: hasDueReviews ? "var(--astra-success)" : "var(--astra-text-secondary)",
          border: hasDueReviews ? "1px solid var(--astra-success-border)" : "1px solid var(--astra-border)",
          fontSize: 11,
          fontWeight: 800,
        }}>
          {hasDueReviews ? `${dueCount} due` : "no due cards"}
        </span>
      </div>

      <p style={{ fontSize: 12, color: "var(--astra-text-muted)", margin: "8px 0 0", lineHeight: 1.5 }}>
        {copy.description}
      </p>

      <div
        data-testid="learning-closure-commercial-package-copy"
        style={{
          marginTop: 10,
          padding: "8px 10px",
          background: "var(--astra-bg-card)",
          border: "1px solid var(--astra-popup-border-warm)",
          borderRadius: 10,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 800, color: "var(--astra-popup-text-warm-strong)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {packageSummary.eyebrow}
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--astra-text-primary)", marginTop: 4, lineHeight: 1.35 }}>
          {packageSummary.title}
        </div>
        <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginTop: 4, lineHeight: 1.45 }}>
          {packageSummary.summary}
        </div>
        <div
          data-testid="learning-closure-first-win-activation-copy"
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: "1px solid var(--astra-popup-border-warm)",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 800, color: "var(--astra-popup-text-warm-strong)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {firstWinCopy.eyebrow}
          </div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--astra-text-primary)", marginTop: 3, lineHeight: 1.35 }}>
            {firstWinCopy.title}
          </div>
          <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginTop: 3, lineHeight: 1.45 }}>
            {firstWinCopy.summary}
          </div>
        </div>
      </div>

      <ol style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "grid", gap: 7 }}>
        <Step index={1}>{copy.translateStep}</Step>
        <Step index={2}>{copy.readStepPrefix}{sentenceCount > 0 ? ` from ${sentenceCount} detected sentence${sentenceCount === 1 ? "" : "s"}` : copy.readStepFallback}.</Step>
        <Step index={3}>{copy.explainStep}</Step>
        <Step index={4}>{copy.reviewStep}</Step>
      </ol>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
        <button
          type="button"
          data-testid="learning-closure-primer-translate"
          data-recommended={recommendedAction === "translate_page" ? "true" : undefined}
          className="astra-btn-primary"
          onClick={onTranslatePage}
          disabled={!canTranslatePage}
          style={recommendedButtonStyle(recommendedAction === "translate_page")}
        >
          Translate page
          <RecommendedMarker visible={recommendedAction === "translate_page"} />
        </button>
        <button
          type="button"
          data-testid="learning-closure-primer-deep-read"
          data-recommended={recommendedAction === "open_deep_read" ? "true" : undefined}
          className="astra-btn-secondary"
          onClick={onReadArticle}
          disabled={!canReadArticle}
          style={recommendedButtonStyle(recommendedAction === "open_deep_read")}
        >
          Open Deep Read
          <RecommendedMarker visible={recommendedAction === "open_deep_read"} />
        </button>
        <button
          type="button"
          data-testid="learning-closure-primer-explain"
          data-recommended={recommendedAction === "explain_sentence" ? "true" : undefined}
          className="astra-btn-secondary"
          onClick={onExplainSentence}
          disabled={!canExplainSentence}
          style={recommendedButtonStyle(recommendedAction === "explain_sentence")}
        >
          Explain sentence
          <RecommendedMarker visible={recommendedAction === "explain_sentence"} />
        </button>
        <button
          type="button"
          data-testid="learning-closure-primer-review"
          data-recommended={recommendedAction === "open_review" ? "true" : undefined}
          className="astra-btn-secondary"
          onClick={onOpenReview}
          style={recommendedButtonStyle(recommendedAction === "open_review")}
        >
          Review{hasDueReviews ? ` (${dueCount})` : ""}
          <RecommendedMarker visible={recommendedAction === "open_review"} />
        </button>
      </div>
    </section>
  )
}
