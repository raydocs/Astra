import { useEffect, useState } from "react"
import { browser } from "#imports"
import { commitLearningContinuitySync } from "@/utils/extension/messages"
import { recordLearningLoopEvent } from "@/utils/learning-loop-events"
import { buildFocusedReviewUrl } from "@/utils/review-link"
import { buildReferralInvite, buildSentenceShareCard, type AstraGrowthSharePayload } from "@/utils/share/sentence-card"
import { upsertOwnedArticleFromUrl } from "@/utils/storage/owned-reading"
import { saveVocabularyEntry } from "@/utils/storage/vocabulary"
import type { VocabularyEntry } from "@/utils/storage/vocabulary-core"

type LessonStage = "understand" | "saved" | "review" | "complete"

const SAMPLE_SOURCE_URL = "astra-sample://first-lesson/quiet-reading"
const SAMPLE_SOURCE_TITLE = "Astra Sample Lesson: The Quiet Architecture of Reading"
const SAMPLE_SENTENCE = "To inhabit a difficult sentence, you have to be willing to sit with it."
const SAMPLE_ATTENTION_SENTENCE = "Reading well requires a kind of attention that the modern web has quietly eroded."
const SAMPLE_TRANSLATION = "要真正进入一句难懂的话，你必须愿意在它面前停留。"
const SAMPLE_EXPLANATION = "“Inhabit” means more than understand quickly: it suggests staying inside the sentence long enough to notice meaning, tone, and structure."

// The sample saves three real, source-backed expressions so the first-success
// moment matches the promise ("保存 3 个表达"). All three come from the sample
// article above, so review later feels like returning to a real page.
const STARTER_CARDS: Array<{
  text: string
  translation: string
  explanation: string
  sentence: string
  sentenceIndex: number
}> = [
  {
    text: "inhabit a difficult sentence",
    translation: "真正进入一句难懂的话",
    explanation: SAMPLE_EXPLANATION,
    sentence: SAMPLE_SENTENCE,
    sentenceIndex: 1,
  },
  {
    text: "be willing to sit with it",
    translation: "愿意静下心来慢慢琢磨它",
    explanation: "“Sit with it” means staying with something patiently instead of rushing past — here, dwelling on a hard sentence until it opens up.",
    sentence: SAMPLE_SENTENCE,
    sentenceIndex: 1,
  },
  {
    text: "quietly eroded",
    translation: "悄然侵蚀、不知不觉地削弱",
    explanation: "“Erode” is to wear away gradually; “quietly eroded” describes attention being worn down slowly and almost unnoticeably.",
    sentence: SAMPLE_ATTENTION_SENTENCE,
    sentenceIndex: 0,
  },
]

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

function openReviewQueue() {
  // Land directly on the Review queue (the 3 sample cards are due now), so the
  // understand → save → review loop visibly closes instead of dropping the user
  // on the default list tab.
  void browser.tabs.create({ url: buildFocusedReviewUrl("") })
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
  const [savedEntries, setSavedEntries] = useState<VocabularyEntry[]>([])
  const [reviewIndex, setReviewIndex] = useState(0)
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

  const saveStarterCards = async () => {
    setSaving(true)
    try {
      const sourceItem = await upsertOwnedArticleFromUrl({
        url: SAMPLE_SOURCE_URL,
        title: SAMPLE_SOURCE_TITLE,
        status: "saved",
      })
      const savedAt = Date.now()
      const entries: VocabularyEntry[] = []
      for (const card of STARTER_CARDS) {
        const entry = await saveVocabularyEntry({
          text: card.text,
          translation: card.translation,
          explanation: card.explanation,
          context: card.sentence,
          url: SAMPLE_SOURCE_URL,
          hostname: "astra-sample",
          srsBox: 1,
          nextReviewAt: savedAt,
          reviewCount: 0,
          lastReviewedAt: null,
          sourceContext: {
            surface: "sample_lesson",
            pageTitle: SAMPLE_SOURCE_TITLE,
            pageUrl: SAMPLE_SOURCE_URL,
            hostname: "astra-sample",
            sentenceText: card.sentence,
            sentenceIndex: card.sentenceIndex,
            articleExcerpt: "Reading well requires a kind of attention that the modern web has quietly eroded. To inhabit a difficult sentence, you have to be willing to sit with it.",
            contentSummary: "A short guided sample article for Astra's first learning loop.",
            ownedReadingItemId: sourceItem.id,
            ownedReadingSourceType: sourceItem.sourceType,
            ownedReadingTitle: sourceItem.title,
            studyProgressRecordId: sourceItem.studyProgressRecordId ?? undefined,
          },
        })
        entries.push(entry)
      }
      setSavedEntries(entries)
      setReviewIndex(0)
      setStage("saved")
      recordLearningLoopEvent("saved_snippet_created", {
        source: "sample_lesson",
        sourceType: "sample_article",
        hasReviewCard: true,
      })
      void commitLearningContinuitySync("sample-lesson-first-cards-saved")
    } finally {
      setSaving(false)
    }
  }

  const reviewNextCard = () => {
    if (reviewIndex < savedEntries.length - 1) {
      setReviewIndex((index) => index + 1)
      return
    }
    setStage("complete")
    recordLearningLoopEvent("review_session_completed", {
      source: "sample_lesson",
      cardCount: savedEntries.length || STARTER_CARDS.length,
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
              <button type="button" style={primaryButtonStyle} onClick={() => void saveStarterCards()} disabled={saving}>
                {saving ? "Saving…" : "Save 3 expressions for review"}
              </button>
            </div>
          )}

          {stage === "saved" && (
            <div data-testid="sample-lesson-saved-step">
              <h2 style={{ fontSize: 22, margin: "10px 0 8px" }} lang="zh">你刚刚创建了 {savedEntries.length || STARTER_CARDS.length} 个学习卡片</h2>
              <p style={{ color: "var(--astra-text-secondary)", fontSize: 13, lineHeight: 1.6 }}>
                You just created {savedEntries.length || STARTER_CARDS.length} review cards, saved to your Library with their source context. Now run the quick review so the loop is complete.
              </p>
              <div data-testid="sample-lesson-source-handoff" style={{ padding: "10px 12px", borderRadius: 12, background: "var(--astra-info-bg)", border: "1px solid var(--astra-info-border)", color: "var(--astra-text-secondary)", fontSize: 12, lineHeight: 1.5, margin: "12px 0" }}>
                Source added to Library: this sample article now has {savedEntries.length || STARTER_CARDS.length} saved cards attached, just like a real page.
              </div>
              <button type="button" style={primaryButtonStyle} onClick={() => { setReviewIndex(0); setStage("review") }}>
                Start review
              </button>
            </div>
          )}

          {stage === "review" && (
            <div data-testid="sample-lesson-review-step">
              <h2 style={{ fontSize: 22, margin: "10px 0 8px" }}>Review card {reviewIndex + 1} of {savedEntries.length || STARTER_CARDS.length}</h2>
              <div style={{ padding: "12px 14px", borderRadius: 12, background: "var(--astra-bg-elevated)", border: "1px solid var(--astra-border)", margin: "14px 0", lineHeight: 1.55 }}>
                <div style={{ fontWeight: 800 }}>{savedEntries[reviewIndex]?.text ?? STARTER_CARDS[reviewIndex]?.text}</div>
                <div style={{ color: "var(--astra-text-secondary)", fontSize: 13, marginTop: 8 }}>{savedEntries[reviewIndex]?.translation ?? STARTER_CARDS[reviewIndex]?.translation}</div>
                <div style={{ color: "var(--astra-text-muted)", fontSize: 12, marginTop: 8 }}>Source: {SAMPLE_SOURCE_TITLE}</div>
              </div>
              <button type="button" style={primaryButtonStyle} onClick={reviewNextCard}>
                {reviewIndex < (savedEntries.length || STARTER_CARDS.length) - 1 ? "I reviewed this — next card" : "I reviewed this card"}
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
                Open Review to find your 3 saved cards waiting, linked back to the sample source.
              </div>
              <div data-testid="sample-lesson-real-page-hint" style={{ padding: "10px 12px", borderRadius: 12, background: "var(--astra-bg-sunken)", border: "1px solid var(--astra-border)", color: "var(--astra-text-secondary)", fontSize: 12, lineHeight: 1.5, margin: "12px 0" }}>
                <strong style={{ color: "var(--astra-text-primary)" }}>Next, try it on a real page.</strong>
                <div style={{ marginTop: 4 }}>
                  Open an English article or a supported video, then use the Astra toolbar to translate, explain, and save — it builds the same Library and Review queue.
                </div>
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
                <button type="button" style={primaryButtonStyle} onClick={openReviewQueue}>
                  Open Review
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
