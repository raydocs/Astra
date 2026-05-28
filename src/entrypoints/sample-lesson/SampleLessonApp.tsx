import { useEffect, useState } from "react"
import { browser } from "#imports"
import { commitLearningContinuitySync } from "@/utils/extension/messages"
import { recordLearningLoopEvent } from "@/utils/learning-loop-events"
import { buildReferralInvite, buildSentenceShareCard, type AstraGrowthSharePayload } from "@/utils/share/sentence-card"
import { upsertOwnedArticleFromUrl } from "@/utils/storage/owned-reading"
import { saveVocabularyEntry } from "@/utils/storage/vocabulary"
import type { VocabularyEntry } from "@/utils/storage/vocabulary-core"

type LessonStage = "understand" | "saved" | "review" | "complete"

const SAMPLE_SOURCE_URL = "astra-sample://first-lesson/quiet-reading"
const SAMPLE_SOURCE_TITLE = "Astra Sample Lesson: The Quiet Architecture of Reading"
const SAMPLE_SENTENCE = "To inhabit a difficult sentence, you have to be willing to sit with it."
const SAMPLE_TRANSLATION = "要真正进入一句难懂的话，你必须愿意在它面前停留。"
const SAMPLE_EXPLANATION = "“Inhabit” means more than understand quickly: it suggests staying inside the sentence long enough to notice meaning, tone, and structure."

const shellStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(135deg, var(--astra-style-bg-base), var(--astra-bg-elevated))",
  color: "var(--astra-text-primary)",
  padding: "40px 20px",
}

const frameStyle: React.CSSProperties = {
  maxWidth: 980,
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.4fr) minmax(280px, 0.8fr)",
  gap: 20,
  alignItems: "start",
}

const cardStyle: React.CSSProperties = {
  background: "var(--astra-style-bg-surface)",
  border: "1px solid var(--astra-style-line-1)",
  borderRadius: 18,
  boxShadow: "var(--astra-style-shadow-sm)",
  padding: "24px 28px",
}

const quietEyebrowStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--astra-info)",
}

const primaryButtonStyle: React.CSSProperties = {
  border: "1px solid var(--astra-info-border)",
  background: "var(--astra-info)",
  color: "white",
  borderRadius: 10,
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
}

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid var(--astra-info-border)",
  background: "var(--astra-bg-card)",
  color: "var(--astra-info)",
  borderRadius: 10,
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
}

function openVocabularyLibrary() {
  void browser.tabs.create({ url: browser.runtime.getURL("/vocabulary.html" as "/popup.html") })
}

async function shareGrowthPayload(payload: AstraGrowthSharePayload): Promise<"shared" | "copied" | "unavailable"> {
  const shareApi = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>
    clipboard?: { writeText?: (value: string) => Promise<void> }
  }
  if (typeof shareApi.share === "function") {
    await shareApi.share(payload)
    return "shared"
  }
  if (typeof shareApi.clipboard?.writeText === "function") {
    await shareApi.clipboard.writeText(`${payload.text}\n${payload.url}`)
    return "copied"
  }
  return "unavailable"
}

function formatShareStatus(result: "shared" | "copied" | "unavailable", fallbackLabel: string): string {
  switch (result) {
    case "shared":
      return `${fallbackLabel} opened in your share sheet.`
    case "copied":
      return `${fallbackLabel} copied to clipboard.`
    case "unavailable":
      return `${fallbackLabel} ready: ${fallbackLabel === "Sentence card" ? buildSentenceShareCard({ sentence: SAMPLE_SENTENCE, translation: SAMPLE_TRANSLATION, sourceTitle: SAMPLE_SOURCE_TITLE }).payload.url : buildReferralInvite().payload.url}`
  }
}

export default function SampleLessonApp() {
  const [stage, setStage] = useState<LessonStage>("understand")
  const [savedEntry, setSavedEntry] = useState<VocabularyEntry | null>(null)
  const [saving, setSaving] = useState(false)
  const [shareStatus, setShareStatus] = useState("")
  const [referralStatus, setReferralStatus] = useState("")

  useEffect(() => {
    recordLearningLoopEvent("sample_started", {
      source: "sample_lesson",
      contentType: "sample_article",
      sourceId: "quiet-reading",
    })
    recordLearningLoopEvent("first_content_understood", {
      source: "sample_lesson",
      contentType: "sample_article",
      sourceId: "quiet-reading",
    })
  }, [])

  const saveFirstCard = async () => {
    setSaving(true)
    try {
      const sourceItem = await upsertOwnedArticleFromUrl({
        url: SAMPLE_SOURCE_URL,
        title: SAMPLE_SOURCE_TITLE,
        status: "saved",
      })
      const entry = await saveVocabularyEntry({
        text: "inhabit a difficult sentence",
        translation: SAMPLE_TRANSLATION,
        explanation: SAMPLE_EXPLANATION,
        context: SAMPLE_SENTENCE,
        url: SAMPLE_SOURCE_URL,
        hostname: "astra-sample",
        srsBox: 1,
        nextReviewAt: Date.now(),
        reviewCount: 0,
        lastReviewedAt: null,
        sourceContext: {
          surface: "sample_lesson",
          pageTitle: SAMPLE_SOURCE_TITLE,
          pageUrl: SAMPLE_SOURCE_URL,
          hostname: "astra-sample",
          sentenceText: SAMPLE_SENTENCE,
          sentenceIndex: 0,
          articleExcerpt: "Reading well requires a kind of attention that the modern web has quietly eroded. To inhabit a difficult sentence, you have to be willing to sit with it.",
          contentSummary: "A short guided sample article for Astra's first learning loop.",
          ownedReadingItemId: sourceItem.id,
          ownedReadingSourceType: sourceItem.sourceType,
          ownedReadingTitle: sourceItem.title,
          studyProgressRecordId: sourceItem.studyProgressRecordId ?? undefined,
        },
      })
      setSavedEntry(entry)
      setStage("saved")
      recordLearningLoopEvent("saved_snippet_created", {
        source: "sample_lesson",
        sourceType: "sample_article",
        hasReviewCard: true,
      })
      void commitLearningContinuitySync("sample-lesson-first-card-saved")
    } finally {
      setSaving(false)
    }
  }

  const completeReview = () => {
    setStage("complete")
    recordLearningLoopEvent("review_session_completed", {
      source: "sample_lesson",
      cardCount: 1,
      firstReview: true,
    })
  }

  const shareSentenceCard = async () => {
    const card = buildSentenceShareCard({
      sentence: SAMPLE_SENTENCE,
      translation: SAMPLE_TRANSLATION,
      sourceTitle: SAMPLE_SOURCE_TITLE,
      contentOrigin: "sample_lesson",
    })
    recordLearningLoopEvent("share_card_created", card.telemetry)
    const result = await shareGrowthPayload(card.payload)
    setShareStatus(formatShareStatus(result, "Sentence card"))
  }

  const inviteFriend = async () => {
    const invite = buildReferralInvite({ trigger: "sample_review_complete" })
    recordLearningLoopEvent("referral_sent", invite.telemetry)
    const result = await shareGrowthPayload(invite.payload)
    setReferralStatus(formatShareStatus(result, "Invite link"))
  }

  return (
    <div style={shellStyle} data-astra-theme="light" data-astra="quiet">
      <main style={frameStyle}>
        <article style={cardStyle} aria-label="Astra sample lesson article">
          <div style={quietEyebrowStyle}>Try Astra on a sample page</div>
          <h1 style={{ fontFamily: "Source Serif 4, Georgia, serif", fontSize: 38, lineHeight: 1.05, margin: "10px 0 12px", color: "var(--astra-style-ink-1)" }}>
            The Quiet Architecture of Reading
          </h1>
          <p style={{ color: "var(--astra-text-secondary)", fontSize: 15, lineHeight: 1.7 }}>
            This short lesson proves the full path before you hunt for a real article: understand one sentence, save it, and review your first card.
          </p>
          <div style={{ display: "grid", gap: 18, marginTop: 24, fontSize: 18, lineHeight: 1.85, color: "var(--astra-style-ink-2)" }}>
            <p>
              Reading well requires a kind of <strong>attention</strong> that the modern web has quietly eroded.
            </p>
            <p>
              <mark data-testid="sample-lesson-recommended-sentence" style={{ background: "var(--astra-info-bg)", border: "1px solid var(--astra-info-border)", borderRadius: 8, padding: "2px 5px", color: "var(--astra-style-ink-1)" }}>
                {SAMPLE_SENTENCE}
              </mark>
            </p>
            <p>
              Astra keeps this moment attached to the source, so review later feels like returning to a real page instead of memorizing an isolated word.
            </p>
          </div>
        </article>

        <aside style={{ ...cardStyle, position: "sticky", top: 20 }} aria-label="Astra first success guide">
          <div style={quietEyebrowStyle}>First success path</div>
          {stage === "understand" && (
            <div data-testid="sample-lesson-understand-step">
              <h2 style={{ fontSize: 22, margin: "10px 0 8px" }}>1. You understood your first content.</h2>
              <p style={{ color: "var(--astra-text-secondary)", fontSize: 13, lineHeight: 1.6 }}>
                Astra shows a guided sentence and a learner-friendly explanation without setup or technical configuration.
              </p>
              <div style={{ padding: "12px 14px", borderRadius: 12, background: "var(--astra-bg-elevated)", border: "1px solid var(--astra-border)", margin: "14px 0", fontSize: 13, lineHeight: 1.55 }}>
                <strong>Explanation:</strong> {SAMPLE_EXPLANATION}
              </div>
              <button type="button" style={primaryButtonStyle} onClick={() => void saveFirstCard()} disabled={saving}>
                {saving ? "Saving…" : "Save this sentence for review"}
              </button>
            </div>
          )}

          {stage === "saved" && (
            <div data-testid="sample-lesson-saved-step">
              <h2 style={{ fontSize: 22, margin: "10px 0 8px" }}>You just created your first review card.</h2>
              <p style={{ color: "var(--astra-text-secondary)", fontSize: 13, lineHeight: 1.6 }}>
                Saved to your Library with source context. Now try the 1-card review so the loop is complete.
              </p>
              <div data-testid="sample-lesson-source-handoff" style={{ padding: "10px 12px", borderRadius: 12, background: "var(--astra-info-bg)", border: "1px solid var(--astra-info-border)", color: "var(--astra-text-secondary)", fontSize: 12, lineHeight: 1.5, margin: "12px 0" }}>
                Source added to Library: this sample article now has a saved card attached, just like a real page.
              </div>
              <button type="button" style={primaryButtonStyle} onClick={() => setStage("review")}>
                Start 1-card review
              </button>
            </div>
          )}

          {stage === "review" && (
            <div data-testid="sample-lesson-review-step">
              <h2 style={{ fontSize: 22, margin: "10px 0 8px" }}>Review card 1 of 1</h2>
              <div style={{ padding: "12px 14px", borderRadius: 12, background: "var(--astra-bg-elevated)", border: "1px solid var(--astra-border)", margin: "14px 0", lineHeight: 1.55 }}>
                <div style={{ fontWeight: 800 }}>{savedEntry?.text ?? "inhabit a difficult sentence"}</div>
                <div style={{ color: "var(--astra-text-secondary)", fontSize: 13, marginTop: 8 }}>{SAMPLE_TRANSLATION}</div>
                <div style={{ color: "var(--astra-text-muted)", fontSize: 12, marginTop: 8 }}>Source: {SAMPLE_SOURCE_TITLE}</div>
              </div>
              <button type="button" style={primaryButtonStyle} onClick={completeReview}>
                I reviewed this card
              </button>
            </div>
          )}

          {stage === "complete" && (
            <div data-testid="sample-lesson-complete-step">
              <h2 style={{ fontSize: 22, margin: "10px 0 8px" }}>First review complete.</h2>
              <p style={{ color: "var(--astra-text-secondary)", fontSize: 13, lineHeight: 1.6 }}>
                You have finished the sample loop: understand → save → review. Your next real page can build on the same Library and Review queue.
              </p>
              <div data-testid="sample-lesson-complete-source-handoff" style={{ padding: "10px 12px", borderRadius: 12, background: "var(--astra-info-bg)", border: "1px solid var(--astra-info-border)", color: "var(--astra-text-secondary)", fontSize: 12, lineHeight: 1.5, margin: "12px 0" }}>
                Open Library to see the sample source and its linked review card.
              </div>
              <div data-testid="sample-lesson-growth-card" style={{ padding: "10px 12px", borderRadius: 12, background: "var(--astra-bg-elevated)", border: "1px solid var(--astra-border)", color: "var(--astra-text-secondary)", fontSize: 12, lineHeight: 1.5, margin: "12px 0" }}>
                <strong style={{ color: "var(--astra-text-primary)" }}>Share the result, not your history.</strong>
                <div style={{ marginTop: 4 }}>
                  Create a local sentence card from this authored sample, or invite a friend to try the same zero-config lesson. No reward is granted in this MVP.
                </div>
                {(shareStatus || referralStatus) && (
                  <div role="status" style={{ marginTop: 8 }}>
                    {[shareStatus, referralStatus].filter(Boolean).join(" ")}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" style={primaryButtonStyle} onClick={openVocabularyLibrary}>
                  Open Library
                </button>
                <button type="button" style={secondaryButtonStyle} onClick={() => void shareSentenceCard()}>
                  Share sentence card
                </button>
                <button type="button" style={secondaryButtonStyle} onClick={() => void inviteFriend()}>
                  Invite a friend
                </button>
                <button type="button" style={secondaryButtonStyle} onClick={() => setStage("understand")}>
                  Replay sample
                </button>
              </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  )
}
