import { browser } from "#imports"
import { copyTextToClipboard } from "@/utils/dom/clipboard"
import { getDueVocabularyCount, saveVocabularyEntry } from "@/utils/storage/vocabulary"
import { buildVideoTimestampUrl } from "@/utils/video-timestamp-url"
import { runInlineAction } from "../inline-actions"
import { saveDeepReadSession } from "@/utils/storage/deep-read-session"
import {
  subscribeYouTubeTranscriptSnapshot,
  type YouTubeTranscriptCueSnapshot,
  type YouTubeTranscriptSnapshot,
} from "./youtube"
import type { ServiceMode } from "@/types/config"
import type { PageStudyContext } from "@/types/messages"
import type { VideoNoteLearningContext, VideoNoteLearningItem } from "@/types/video-notes"

const PANEL_ID = "astra-video-transcript-panel"
const STYLE_ID = "astra-video-transcript-panel-styles"

interface TranscriptPanelOptions {
  targetLang: string
  serviceMode: ServiceMode
}

type TranscriptPanelTab = "summary" | "transcript" | "words" | "notes"
type TranscriptPanelStatusTone = "info" | "loading" | "success" | "warning" | "error"

interface VideoLearningChapter {
  startMs: number
  endMs: number
  title: string
  summary: string
}

interface VideoLearningQuizItem {
  question: string
  answer: string
}

interface VideoLearningSummary {
  generatedAt: number
  aiSummary: string
  chapters: VideoLearningChapter[]
  keywords: string[]
  expressions: string[]
  quiz: VideoLearningQuizItem[]
}

const VIDEO_SUMMARY_PROMPT = "Create a concise learner-facing video summary in the target language. Include the main idea, why it matters, and what a language learner should pay attention to. Do not invent facts beyond the transcript."
const KEYWORD_STOPWORDS = new Set([
  "about", "after", "again", "also", "and", "are", "because", "but", "can", "for", "from", "have", "into", "just", "like", "more", "not", "now", "our", "that", "the", "their", "this", "through", "what", "when", "where", "with", "you", "your",
])

let panelRoot: HTMLElement | null = null
let unsubscribeTranscript: (() => void) | null = null
let latestSnapshot: YouTubeTranscriptSnapshot | null = null
let activeOptions: TranscriptPanelOptions | null = null
let searchQuery = ""
let activeTab: TranscriptPanelTab = "summary"
let explanationByCueId = new Map<string, string>()
let miniDictionary: { word: string; cueId: string; definition: string; languageHint: string; loading: boolean } | null = null
let videoLearningSummary: VideoLearningSummary | null = null
let savedVideoSentences: VideoNoteLearningItem[] = []
let savedVideoWords: VideoNoteLearningItem[] = []
let latestSavedReviewEntryId: string | null = null
let savedReviewNudge: { dueCount: number } | null = null
let summaryGenerationInFlight: Promise<void> | null = null
let attemptedSummaryCueCount = 0
let statusMessage = ""
let statusTone: TranscriptPanelStatusTone = "info"
// No-captions fallback: the subtitle text the user pasted + its explanation, so a
// captionless video isn't a dead end (explain copied subtitle text instead).
let pastedSubtitleText = ""
let pastedSubtitleExplanation = ""
const handleFullscreenChange = () => renderTranscriptPanel()

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

function formatCueForClipboard(cue: YouTubeTranscriptCueSnapshot): string {
  return [
    `[${formatTimestamp(cue.startMs)}] ${cue.text}`,
    cue.translation ? cue.translation : null,
  ].filter(Boolean).join("\n")
}

// Transcript export (bilingual / SRT / learning-notes download) is intentionally
// NOT shipped in the paid beta: redistributing full bilingual transcripts raises
// YouTube ToS + source-copyright concerns (master execution plan §4.3, §13). The
// per-cue copy path (formatCueForClipboard) is retained for single-line copy.

function injectTranscriptPanelStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = `
    #${PANEL_ID} {
      position: fixed;
      top: 72px;
      right: 16px;
      z-index: 2147483646;
      width: min(380px, calc(100vw - 32px));
      max-height: min(72vh, 680px);
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px;
      border: 1px solid rgba(226, 232, 240, 0.94);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.96);
      color: #0f172a;
      box-shadow: 0 18px 45px rgba(15, 23, 42, 0.16);
      font: 13px/1.4 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      backdrop-filter: blur(14px);
    }

    #${PANEL_ID} [data-astra-transcript-header] {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    #${PANEL_ID} [data-astra-transcript-title] {
      font-weight: 700;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    #${PANEL_ID} input {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid rgba(203, 213, 225, 0.9);
      border-radius: 12px;
      padding: 7px 9px;
      color: #0f172a;
      background: rgba(248, 250, 252, 0.96);
      outline: none;
    }

    #${PANEL_ID} [data-astra-transcript-actions],
    #${PANEL_ID} [data-astra-transcript-tabs] {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    #${PANEL_ID} [data-astra-transcript-tabs] button[data-active="true"] {
      background: rgba(79, 70, 229, 0.92);
      border-color: rgba(165, 180, 252, 0.95);
    }

    #${PANEL_ID} [data-astra-video-learning-section] {
      display: grid;
      gap: 8px;
      overflow: auto;
      padding-right: 2px;
    }

    #${PANEL_ID} [data-astra-video-learning-card] {
      border: 1px solid rgba(226, 232, 240, 0.96);
      border-radius: 14px;
      padding: 9px;
      background: rgba(248, 250, 252, 0.86);
    }

    #${PANEL_ID} [data-astra-video-learning-card] h4 {
      margin: 0 0 5px;
      font-size: 13px;
    }

    #${PANEL_ID} [data-astra-video-learning-card] p,
    #${PANEL_ID} [data-astra-video-learning-card] ul {
      margin: 4px 0;
    }

    #${PANEL_ID} button {
      border: 1px solid rgba(203, 213, 225, 0.9);
      border-radius: 999px;
      padding: 5px 8px;
      color: #0f172a;
      background: rgba(255, 255, 255, 0.92);
      cursor: pointer;
      font: inherit;
    }

    #${PANEL_ID} button:hover {
      background: rgba(79, 70, 229, 0.92);
    }

    #${PANEL_ID} [data-astra-transcript-list] {
      display: flex;
      flex-direction: column;
      gap: 6px;
      overflow: auto;
      padding-right: 2px;
    }

    #${PANEL_ID} [data-astra-transcript-row] {
      text-align: left;
      border-radius: 12px;
      padding: 8px;
      background: rgba(248, 250, 252, 0.88);
      white-space: normal;
    }

    #${PANEL_ID} [data-astra-transcript-row][data-active="true"] {
      border-color: rgba(129, 140, 248, 0.78);
      background: rgba(238, 242, 255, 0.95);
    }

    #${PANEL_ID} [data-astra-transcript-time] {
      display: inline-block;
      min-width: 42px;
      margin-right: 6px;
      color: #4f46e5;
      font-weight: 700;
    }

    #${PANEL_ID} [data-astra-transcript-translation] {
      display: block;
      margin-top: 3px;
      color: #5b21b6;
    }

    #${PANEL_ID} [data-astra-transcript-row-actions] {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: 7px;
    }

    #${PANEL_ID} [data-astra-transcript-word] {
      border: 0;
      border-radius: 5px;
      padding: 1px 2px;
      background: transparent;
      color: inherit;
      text-decoration: underline dotted rgba(196, 181, 253, 0.72);
    }

    #${PANEL_ID} [data-astra-transcript-word]:hover {
      background: rgba(129, 140, 248, 0.22);
    }

    #${PANEL_ID} [data-astra-mini-dictionary] {
      border: 1px solid rgba(199, 210, 254, 0.8);
      border-radius: 12px;
      padding: 8px;
      background: rgba(238, 242, 255, 0.96);
      color: #312e81;
    }

    #${PANEL_ID} [data-astra-transcript-status],
    #${PANEL_ID} [data-astra-transcript-explanation] {
      color: #64748b;
      font-size: 12px;
    }

    #${PANEL_ID} [data-astra-transcript-no-captions] {
      display: grid;
      gap: 8px;
      border: 1px solid rgba(226, 232, 240, 0.96);
      border-radius: 14px;
      padding: 10px;
      background: rgba(248, 250, 252, 0.86);
    }

    #${PANEL_ID} [data-astra-transcript-no-captions] p {
      margin: 0;
    }

    #${PANEL_ID} [data-astra-transcript-no-captions] textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid rgba(203, 213, 225, 0.9);
      border-radius: 12px;
      padding: 7px 9px;
      color: #0f172a;
      background: rgba(255, 255, 255, 0.96);
      outline: none;
      font: inherit;
      resize: vertical;
    }

    #${PANEL_ID} [data-astra-transcript-no-captions-explanation] {
      color: #334155;
      font-size: 12px;
    }

    @media (max-width: 720px) {
      #${PANEL_ID} {
        left: 10px;
        right: 10px;
        top: auto;
        bottom: 12px;
        width: auto;
        max-height: 46vh;
      }
    }
  `
  document.head.appendChild(style)
}

function getYouTubeVideoElement(): HTMLVideoElement | null {
  const scoped = document.querySelector(".html5-video-player video")
  if (scoped instanceof HTMLVideoElement) return scoped
  const main = document.querySelector("video.html5-main-video")
  if (main instanceof HTMLVideoElement) return main
  const first = document.querySelector("video")
  return first instanceof HTMLVideoElement ? first : null
}

// Localize via the extension i18n table when available; fall back to English
// (also what unit tests see, since they don't load a locale). Self-contained so
// the panel doesn't depend on a concurrently-edited shared module.
function localizedLabel(key: string, fallback: string): string {
  try {
    const i18n =
      (globalThis as { chrome?: { i18n?: { getMessage?: (name: string) => string } } }).chrome?.i18n
      ?? (globalThis as { browser?: { i18n?: { getMessage?: (name: string) => string } } }).browser?.i18n
    const localized = i18n?.getMessage?.(key) ?? ""
    return localized && localized !== key ? localized : fallback
  } catch {
    return fallback
  }
}

function setPanelStatus(message: string, tone: TranscriptPanelStatusTone = "info"): void {
  statusMessage = message
  statusTone = tone
  // Any status change other than a fresh save clears the post-save nudge.
  savedReviewNudge = null
  renderTranscriptPanel()
}

function setPanelSuccess(message: string): void {
  setPanelStatus(message.startsWith("Saved") || message.startsWith("Done") ? message : `Done — ${message}`, "success")
}

// Post-save nudge: rather than a flat "saved" toast, confirm in human language
// and point to the next step (review now / find later), mirroring the rich nudge
// the web React surfaces already show. Reuses the existing review deep-link.
async function announceSaved(): Promise<void> {
  const dueCount = await getDueVocabularyCount().catch(() => 0)
  statusMessage = localizedLabel("learningSavedTitle", "Saved for review tonight")
  statusTone = "success"
  savedReviewNudge = { dueCount }
  renderTranscriptPanel()
}

function setPanelWarning(message: string): void {
  setPanelStatus(message, "warning")
}

function setPanelError(message: string, nextStep = "try again from the transcript panel"): void {
  const trimmed = message.trim().replace(/[.。]\s*$/, "")
  setPanelStatus(`${trimmed}. Next step: ${nextStep}.`, "error")
}

export function getVideoTranscriptPanelLearningContext(): VideoNoteLearningContext | undefined {
  const snapshot = latestSnapshot
  if (!snapshot) return undefined
  const durationSec = snapshot.cues.length > 0 ? Math.max(...snapshot.cues.map((cue) => cue.endMs)) / 1000 : null
  const currentTimeSec = Math.max(0, snapshot.currentTime)
  return {
    videoMetadata: {
      title: snapshot.title,
      sourceUrl: snapshot.pageUrl,
      platform: "youtube",
      durationSec,
    },
    bilingualTranscriptSegments: snapshot.cues.map((cue) => ({
      startMs: cue.startMs,
      endMs: cue.endMs,
      text: cue.text,
      translation: cue.translation ?? null,
    })),
    summary: videoLearningSummary?.aiSummary ?? null,
    savedSentences: savedVideoSentences,
    savedWords: savedVideoWords,
    watchProgress: {
      currentTimeSec,
      durationSec,
      percent: durationSec && durationSec > 0 ? Math.min(100, Math.round((currentTimeSec / durationSec) * 100)) : null,
    },
    reviewStatus: {
      savedSentenceCount: savedVideoSentences.length,
      savedWordCount: savedVideoWords.length,
      reviewReady: savedVideoSentences.length + savedVideoWords.length > 0,
    },
  }
}

function transcriptText(snapshot: YouTubeTranscriptSnapshot): string {
  return snapshot.cues
    .map((cue) => `[${formatTimestamp(cue.startMs)}] ${cue.text}`)
    .join("\n")
    .slice(0, 12000)
}

function tokenizeTranscript(snapshot: YouTubeTranscriptSnapshot): string[] {
  return snapshot.cues
    .flatMap((cue) => cue.text.toLowerCase().match(/[\p{L}\p{N}'’-]{4,}/gu) ?? [])
    .map((token) => token.replace(/^['’]+|['’]+$/g, ""))
    .filter((token) => token.length >= 4 && !KEYWORD_STOPWORDS.has(token))
}

function deriveKeywords(snapshot: YouTubeTranscriptSnapshot, limit = 10): string[] {
  const counts = new Map<string, number>()
  for (const token of tokenizeTranscript(snapshot)) {
    counts.set(token, (counts.get(token) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([token]) => token)
}

function deriveExpressions(snapshot: YouTubeTranscriptSnapshot, limit = 10): string[] {
  const seen = new Set<string>()
  const expressions: string[] = []
  for (const cue of snapshot.cues) {
    const words = cue.text.split(/\s+/).map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")).filter(Boolean)
    const phrase = words.slice(0, Math.min(6, Math.max(3, words.length))).join(" ").trim()
    const key = phrase.toLowerCase()
    if (phrase.length >= 8 && !seen.has(key)) {
      seen.add(key)
      expressions.push(phrase)
    }
    if (expressions.length >= limit) break
  }
  return expressions
}

function deriveChapters(snapshot: YouTubeTranscriptSnapshot): VideoLearningChapter[] {
  if (snapshot.cues.length === 0) return []
  const chapterCount = Math.max(1, Math.min(4, Math.ceil(snapshot.cues.length / 4)))
  const chunkSize = Math.max(1, Math.ceil(snapshot.cues.length / chapterCount))
  const chapters: VideoLearningChapter[] = []
  for (let index = 0; index < snapshot.cues.length; index += chunkSize) {
    const chunk = snapshot.cues.slice(index, index + chunkSize)
    const keywords = deriveKeywords({ ...snapshot, cues: chunk }, 2)
    chapters.push({
      startMs: chunk[0]?.startMs ?? 0,
      endMs: chunk.at(-1)?.endMs ?? chunk[0]?.endMs ?? 0,
      title: keywords.length > 0 ? keywords.map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" & ") : `Segment ${chapters.length + 1}`,
      summary: chunk.slice(0, 2).map((cue) => cue.text).join(" ").slice(0, 240),
    })
  }
  return chapters
}

function deriveQuiz(summary: VideoLearningSummary): VideoLearningQuizItem[] {
  return summary.chapters.slice(0, 3).map((chapter) => ({
    question: `What is the main idea around ${formatTimestamp(chapter.startMs)}?`,
    answer: chapter.summary || chapter.title,
  }))
}

function buildDeterministicVideoLearningSummary(snapshot: YouTubeTranscriptSnapshot, aiSummary = ""): VideoLearningSummary {
  const chapters = deriveChapters(snapshot)
  const keywords = deriveKeywords(snapshot, 10)
  const expressions = deriveExpressions(snapshot, 10)
  const fallbackSummary = chapters.length > 0
    ? `This video covers ${chapters.map((chapter) => chapter.title.toLowerCase()).join(", ")}.`
    : "This video summary will appear after transcript cues are available."
  const partial: VideoLearningSummary = {
    generatedAt: Date.now(),
    aiSummary: aiSummary.trim() || fallbackSummary,
    chapters,
    keywords,
    expressions,
    quiz: [],
  }
  return { ...partial, quiz: deriveQuiz(partial) }
}

async function handleGenerateVideoSummary(force = false): Promise<void> {
  const snapshot = latestSnapshot
  const options = activeOptions
  if (!snapshot?.cues.length || !options || summaryGenerationInFlight) return
  if (!force && videoLearningSummary && attemptedSummaryCueCount === snapshot.cues.length) return

  attemptedSummaryCueCount = snapshot.cues.length
  setPanelStatus("Loading video summary…", "loading")
  summaryGenerationInFlight = (async () => {
    const deterministic = buildDeterministicVideoLearningSummary(snapshot)
    const result = await runInlineAction({
      text: transcriptText(snapshot),
      targetLang: options.targetLang,
      serviceMode: options.serviceMode,
      task: "custom",
      customSystemPrompt: VIDEO_SUMMARY_PROMPT,
      selectionContext: `YouTube video transcript: ${snapshot.title ?? document.title}`,
    })
    videoLearningSummary = result.ok
      ? { ...deterministic, aiSummary: result.text }
      : deterministic
    setPanelStatus(result.ok ? "Done — video summary ready" : "Done — generated local summary fallback", "success")
  })().finally(() => {
    summaryGenerationInFlight = null
    renderTranscriptPanel()
  })

  await summaryGenerationInFlight
}

async function handleSaveSummaryToReview(): Promise<void> {
  const snapshot = latestSnapshot
  const summary = videoLearningSummary
  if (!snapshot || !summary) return
  const savedItem: VideoNoteLearningItem = {
    text: snapshot.title ?? "Video summary",
    translation: null,
    explanation: summary.aiSummary,
    timestampMs: null,
    sourceSentence: summary.aiSummary,
  }
  const savedEntry = await saveVocabularyEntry({
    text: snapshot.title ?? "Video summary",
    explanation: summary.aiSummary,
    url: snapshot.pageUrl,
    hostname: window.location.hostname,
    context: "YouTube video summary",
    sourceContext: {
      surface: "video_transcript",
      pageTitle: snapshot.title ?? document.title,
      pageUrl: snapshot.pageUrl,
      hostname: window.location.hostname,
      contentSummary: summary.aiSummary.slice(0, 500),
    },
    note: summary.chapters.map((chapter) => `${formatTimestamp(chapter.startMs)} ${chapter.title}`).join("\n"),
    tags: ["video", "summary"],
  })
  latestSavedReviewEntryId = savedEntry?.id ?? latestSavedReviewEntryId
  savedVideoSentences = [...savedVideoSentences, savedItem]
  await announceSaved()
}

async function handleSaveExpressionsToReview(count = 3): Promise<void> {
  const snapshot = latestSnapshot
  const summary = videoLearningSummary
  if (!snapshot || !summary) return
  const expressions = summary.expressions.slice(0, count)
  const savedEntries = await Promise.all(expressions.map((expression, index) => saveVocabularyEntry({
    text: expression,
    url: snapshot.pageUrl,
    hostname: window.location.hostname,
    context: `Key video expression ${index + 1}`,
    sourceContext: {
      surface: "video_transcript",
      pageTitle: snapshot.title ?? document.title,
      pageUrl: snapshot.pageUrl,
      hostname: window.location.hostname,
      sentenceText: expression,
      sentenceIndex: index,
      contentSummary: summary.aiSummary.slice(0, 500),
    },
    tags: ["video", "expression"],
  })))
  latestSavedReviewEntryId = savedEntries[0]?.id ?? latestSavedReviewEntryId
  savedVideoWords = [
    ...savedVideoWords,
    ...expressions.map((expression): VideoNoteLearningItem => ({
      text: expression,
      translation: null,
      explanation: null,
      timestampMs: null,
      sourceSentence: expression,
    })),
  ]
  await announceSaved()
}

async function handleCreateVideoNoteFromPanel(): Promise<void> {
  setPanelStatus("Loading video note save…", "loading")
  const response = await browser.runtime.sendMessage({
    type: "runtime/video-note:create-from-current-tab",
    payload: { forceRegenerate: false },
  }) as { type?: string; error?: { message?: string } }
  if (response?.type === "runtime/video-note:create-from-current-tab:success") {
    setPanelSuccess("video note creation started")
  } else {
    setPanelError(response?.error?.message ?? "Unable to create video note", "try saving the video note again")
  }
}

async function handleExplainCurrentSegment(): Promise<void> {
  const snapshot = latestSnapshot
  const cue = snapshot?.cues[snapshot.activeIndex]
  if (cue) await handleExplainCue(cue)
}

function buildReviewUrl(entryId: string | null = latestSavedReviewEntryId): string {
  const params = new URLSearchParams({ tab: "review" })
  if (entryId) params.set("entryId", entryId)
  return browser.runtime.getURL(`/vocabulary.html?${params.toString()}` as "/popup.html")
}

function openReview(): void {
  void browser.tabs.create({ url: buildReviewUrl() })
}

function getWordLanguageHint(word: string): string {
  if (/[\u3040-\u30ff\u3400-\u9fff]/u.test(word) && /[\u3040-\u30ff]/u.test(word)) {
    return "Japanese · kana and word-form hint"
  }
  if (/[\u4e00-\u9fff]/u.test(word)) {
    return "Chinese · pinyin hint"
  }
  if (/[\uac00-\ud7af]/u.test(word)) {
    return "Korean · romanization hint"
  }
  return "English · pronunciation, part of speech, and example hint"
}

async function handleExplainWord(cue: YouTubeTranscriptCueSnapshot, word: string): Promise<void> {
  const options = activeOptions
  if (!options) return
  miniDictionary = {
    word,
    cueId: cue.id,
    definition: "Loading mini dictionary…",
    languageHint: getWordLanguageHint(word),
    loading: true,
  }
  renderTranscriptPanel()
  const result = await runInlineAction({
    text: word,
    targetLang: options.targetLang,
    serviceMode: options.serviceMode,
    task: "explain",
    selectionContext: `YouTube subtitle word in sentence: ${cue.text}`,
  })
  miniDictionary = {
    word,
    cueId: cue.id,
    definition: result.ok ? result.text : result.message,
    languageHint: getWordLanguageHint(word),
    loading: false,
  }
  renderTranscriptPanel()
}

async function handleSaveMiniDictionaryWord(): Promise<void> {
  const snapshot = latestSnapshot
  const dictionary = miniDictionary
  if (!snapshot || !dictionary) return
  const cue = snapshot.cues.find((item) => item.id === dictionary.cueId)
  const sourceUrl = cue ? buildVideoTimestampUrl(snapshot.pageUrl, cue.startMs) : snapshot.pageUrl
  const savedItem: VideoNoteLearningItem = {
    text: dictionary.word,
    translation: null,
    explanation: dictionary.definition,
    timestampMs: cue?.startMs ?? null,
    sourceSentence: cue?.text ?? null,
  }
  const savedEntry = await saveVocabularyEntry({
    text: dictionary.word,
    explanation: dictionary.definition,
    url: sourceUrl,
    hostname: window.location.hostname,
    context: cue?.text,
    sourceContext: {
      surface: "video_transcript",
      pageTitle: snapshot.title ?? document.title,
      pageUrl: sourceUrl,
      hostname: window.location.hostname,
      sentenceText: cue?.text ?? dictionary.word,
      sentenceIndex: cue ? snapshot.cues.findIndex((item) => item.id === cue.id) : undefined,
      videoTimestampMs: cue?.startMs,
      contentSummary: `${dictionary.languageHint} · ${cue ? formatTimestamp(cue.startMs) : "video transcript"}`,
    },
    tags: ["video", "word"],
  })
  latestSavedReviewEntryId = savedEntry?.id ?? latestSavedReviewEntryId
  savedVideoWords = [...savedVideoWords, savedItem]
  await announceSaved()
}

function speakCue(cue: YouTubeTranscriptCueSnapshot): void {
  const synth = window.speechSynthesis
  if (!synth) return
  synth.cancel()
  synth.speak(new SpeechSynthesisUtterance(cue.text))
}

function appendClickableWords(parent: HTMLElement, cue: YouTubeTranscriptCueSnapshot): void {
  const parts = cue.text.split(/(\s+)/)
  for (const part of parts) {
    if (/^\s+$/.test(part)) {
      parent.appendChild(document.createTextNode(part))
      continue
    }
    const normalized = part.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    if (!normalized) {
      parent.appendChild(document.createTextNode(part))
      continue
    }
    const button = document.createElement("button")
    button.type = "button"
    button.dataset.astraTranscriptWord = normalized
    button.title = getWordLanguageHint(normalized)
    button.textContent = part
    button.addEventListener("click", (event) => {
      event.stopPropagation()
      void handleExplainWord(cue, normalized)
    })
    parent.appendChild(button)
  }
}

async function handleCopyCue(cue: YouTubeTranscriptCueSnapshot): Promise<void> {
  await copyTextToClipboard(formatCueForClipboard(cue))
  setPanelSuccess("copied sentence")
}

async function handleExplainCue(cue: YouTubeTranscriptCueSnapshot): Promise<void> {
  const options = activeOptions
  if (!options) return
  setPanelStatus("Loading sentence explanation…", "loading")
  const result = await runInlineAction({
    text: cue.text,
    targetLang: options.targetLang,
    serviceMode: options.serviceMode,
    task: "explain",
    selectionContext: `YouTube transcript at ${formatTimestamp(cue.startMs)}`,
  })
  if (result.ok) {
    explanationByCueId.set(cue.id, result.text)
    setPanelSuccess("explanation ready")
  } else {
    setPanelError(result.message, "try explaining the sentence again")
  }
}

// No-captions fallback path: explain a line of subtitle text the user pasted in,
// reusing the same inline-action explain pipeline as per-cue explanations.
async function handleExplainPastedText(text: string): Promise<void> {
  const options = activeOptions
  const trimmed = text.trim()
  if (!options || !trimmed) return
  pastedSubtitleText = trimmed
  setPanelStatus("Loading subtitle explanation…", "loading")
  const result = await runInlineAction({
    text: trimmed,
    targetLang: options.targetLang,
    serviceMode: options.serviceMode,
    task: "explain",
    selectionContext: "Pasted YouTube subtitle (captions unavailable)",
  })
  if (result.ok) {
    pastedSubtitleExplanation = result.text
    setPanelSuccess("explanation ready")
  } else {
    setPanelError(result.message, "try explaining the subtitle again")
  }
}

async function handleSaveCue(cue: YouTubeTranscriptCueSnapshot): Promise<void> {
  const sourceUrl = buildVideoTimestampUrl(latestSnapshot?.pageUrl ?? window.location.href, cue.startMs)
  const savedItem: VideoNoteLearningItem = {
    text: cue.text,
    translation: cue.translation ?? null,
    explanation: explanationByCueId.get(cue.id) ?? null,
    timestampMs: cue.startMs,
    sourceSentence: cue.text,
  }
  const savedEntry = await saveVocabularyEntry({
    text: cue.text,
    translation: cue.translation,
    url: sourceUrl,
    hostname: window.location.hostname,
    context: `YouTube transcript · ${formatTimestamp(cue.startMs)}`,
    sourceContext: {
      surface: "video_transcript",
      pageTitle: latestSnapshot?.title ?? document.title,
      pageUrl: sourceUrl,
      hostname: window.location.hostname,
      sentenceText: cue.text,
      sentenceIndex: latestSnapshot?.cues.findIndex((item) => item.id === cue.id),
      videoTimestampMs: cue.startMs,
      contentSummary: `Video transcript timestamp ${formatTimestamp(cue.startMs)}`,
    },
    note: cue.translation ? `Translation: ${cue.translation}` : undefined,
    tags: ["video", "transcript"],
  })
  latestSavedReviewEntryId = savedEntry?.id ?? latestSavedReviewEntryId
  savedVideoSentences = [...savedVideoSentences, savedItem]
  await announceSaved()
}

async function handleAddWordCue(cue: YouTubeTranscriptCueSnapshot): Promise<void> {
  const word = cue.text.match(/[\p{L}\p{N}'’-]+/u)?.[0]
  if (!word) {
    setPanelWarning("No word found in this sentence. Action: choose a different sentence or click a specific word.")
    return
  }
  const savedItem: VideoNoteLearningItem = {
    text: word,
    translation: null,
    explanation: null,
    timestampMs: cue.startMs,
    sourceSentence: cue.text,
  }
  const sourceUrl = buildVideoTimestampUrl(latestSnapshot?.pageUrl ?? window.location.href, cue.startMs)
  const savedEntry = await saveVocabularyEntry({
    text: word,
    url: sourceUrl,
    hostname: window.location.hostname,
    context: cue.text,
    sourceContext: {
      surface: "video_transcript",
      pageTitle: latestSnapshot?.title ?? document.title,
      pageUrl: sourceUrl,
      hostname: window.location.hostname,
      sentenceText: cue.text,
      sentenceIndex: latestSnapshot?.cues.findIndex((item) => item.id === cue.id),
      videoTimestampMs: cue.startMs,
      contentSummary: `Video transcript word at ${formatTimestamp(cue.startMs)}`,
    },
    tags: ["video", "word"],
  })
  latestSavedReviewEntryId = savedEntry?.id ?? latestSavedReviewEntryId
  savedVideoWords = [...savedVideoWords, savedItem]
  await announceSaved()
}

function formatTranscriptForDeepRead(snapshot: YouTubeTranscriptSnapshot): string {
  return snapshot.cues
    .map((cue) => [
      `[${formatTimestamp(cue.startMs)}] ${cue.text.trim()}`,
      cue.translation?.trim() ? `Translation: ${cue.translation.trim()}` : null,
    ].filter(Boolean).join("\n"))
    .join("\n\n")
    .slice(0, 12_000)
}

function buildVideoDeepReadContext(snapshot: YouTubeTranscriptSnapshot): PageStudyContext | null {
  const articleExcerpt = formatTranscriptForDeepRead(snapshot).trim()
  const pageUrl = snapshot.pageUrl || window.location.href
  if (!articleExcerpt || !pageUrl) return null

  const summary = videoLearningSummary?.aiSummary.trim()
  const contentSummary = [
    `YouTube video transcript · ${snapshot.cues.length} cue${snapshot.cues.length === 1 ? "" : "s"}`,
    snapshot.language ? `Language: ${snapshot.language}` : null,
    summary ? `Video summary: ${summary}` : null,
  ].filter(Boolean).join("\n")

  return {
    pageTitle: snapshot.title?.trim() || document.title || "YouTube video",
    pageUrl,
    hostname: window.location.hostname,
    metaDescription: "Video transcript opened from Astra Transcript Panel.",
    contentSummary,
    articleExcerpt,
  }
}

function buildDeepReadUrl(pageUrl: string): string {
  const baseUrl = browser.runtime.getURL("/deep-read.html" as "/popup.html")
  const separator = baseUrl.includes("?") ? "&" : "?"
  return `${baseUrl}${separator}pageUrl=${encodeURIComponent(pageUrl)}`
}

async function handleOpenDeepRead(): Promise<void> {
  const snapshot = latestSnapshot
  if (!snapshot?.cues.length) {
    setPanelWarning("Transcript is not ready yet. Action: wait for captions, then open Deep Read again.")
    return
  }

  const context = buildVideoDeepReadContext(snapshot)
  if (!context) {
    setPanelWarning("Transcript is empty. Action: wait for captions, then open Deep Read again.")
    return
  }

  await saveDeepReadSession({
    context,
    selectedSentenceIndex: Math.max(0, snapshot.activeIndex),
  })

  void browser.tabs.create({ url: buildDeepReadUrl(context.pageUrl ?? snapshot.pageUrl) })
  setPanelSuccess("Opened transcript in Deep Read")
}

function appendLearningCard(parent: HTMLElement, title: string, body: string | HTMLElement): HTMLElement {
  const card = document.createElement("section")
  card.dataset.astraVideoLearningCard = "true"
  const heading = document.createElement("h4")
  heading.textContent = title
  card.appendChild(heading)
  if (typeof body === "string") {
    const paragraph = document.createElement("p")
    paragraph.textContent = body
    card.appendChild(paragraph)
  } else {
    card.appendChild(body)
  }
  parent.appendChild(card)
  return card
}

function appendList(items: string[]): HTMLUListElement {
  const list = document.createElement("ul")
  items.forEach((item) => {
    const li = document.createElement("li")
    li.textContent = item
    list.appendChild(li)
  })
  return list
}

function renderLearningSummarySection(snapshot: YouTubeTranscriptSnapshot | null): HTMLElement {
  const section = document.createElement("div")
  section.dataset.astraVideoLearningSection = "summary"

  const summary = videoLearningSummary
  if (!summary) {
    appendLearningCard(section, "Summary", snapshot?.cues.length ? "Generating an initial transcript-backed summary…" : "Waiting for transcript cues…")
    return section
  }

  appendLearningCard(section, "Summary", summary.aiSummary)
  const chapters = document.createElement("div")
  summary.chapters.forEach((chapter) => {
    const p = document.createElement("p")
    p.textContent = `${formatTimestamp(chapter.startMs)}–${formatTimestamp(chapter.endMs)} · ${chapter.title}: ${chapter.summary}`
    chapters.appendChild(p)
  })
  appendLearningCard(section, "Chapters", chapters)
  appendLearningCard(section, "Quiz", appendList(summary.quiz.map((item) => `${item.question} — ${item.answer}`)))
  return section
}

function renderWordsSection(): HTMLElement {
  const section = document.createElement("div")
  section.dataset.astraVideoLearningSection = "words"
  const summary = videoLearningSummary
  appendLearningCard(section, "Keywords", appendList(summary?.keywords ?? []))
  appendLearningCard(section, "10 expressions worth mastering", appendList(summary?.expressions ?? []))
  const saveThree = document.createElement("button")
  saveThree.type = "button"
  saveThree.textContent = localizedLabel("transcriptSaveExpressions", "Save 3 expressions to Review")
  saveThree.disabled = !summary?.expressions.length
  saveThree.addEventListener("click", () => { void handleSaveExpressionsToReview(3) })
  section.appendChild(saveThree)
  return section
}

function renderNotesSection(): HTMLElement {
  const section = document.createElement("div")
  section.dataset.astraVideoLearningSection = "notes"
  const summary = videoLearningSummary
  appendLearningCard(section, "Learning note", summary?.aiSummary ?? "Generate a summary first, then save it as a video note or Review card.")
  const actions = document.createElement("div")
  actions.dataset.astraTranscriptActions = "true"
  const saveSummary = document.createElement("button")
  saveSummary.type = "button"
  saveSummary.textContent = localizedLabel("transcriptSaveSummary", "Save summary to Review")
  saveSummary.disabled = !summary
  saveSummary.addEventListener("click", () => { void handleSaveSummaryToReview() })
  const saveVideoNote = document.createElement("button")
  saveVideoNote.type = "button"
  saveVideoNote.textContent = "Create video note"
  saveVideoNote.disabled = !latestSnapshot?.cues.length
  saveVideoNote.addEventListener("click", () => { void handleCreateVideoNoteFromPanel() })
  const explainCurrent = document.createElement("button")
  explainCurrent.type = "button"
  explainCurrent.textContent = "Explain current segment"
  explainCurrent.disabled = !latestSnapshot || latestSnapshot.activeIndex < 0
  explainCurrent.addEventListener("click", () => { void handleExplainCurrentSegment() })
  const review = document.createElement("button")
  review.type = "button"
  review.textContent = "Review"
  review.addEventListener("click", openReview)
  actions.append(saveSummary, saveVideoNote, explainCurrent, review)
  section.appendChild(actions)
  return section
}

function renderTranscriptPanel(): void {
  if (!panelRoot) return
  const snapshot = latestSnapshot
  const filteredCues = snapshot?.cues.filter((cue) => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return true
    return cue.text.toLowerCase().includes(query) || (cue.translation ?? "").toLowerCase().includes(query)
  }) ?? []
  const activeIndex = snapshot?.activeIndex ?? -1
  const displayedCues = document.fullscreenElement && !searchQuery.trim() && activeIndex >= 0
    ? filteredCues.filter((cue) => Math.abs((snapshot?.cues.findIndex((item) => item.id === cue.id) ?? -1) - activeIndex) <= 1)
    : filteredCues

  panelRoot.replaceChildren()

  const header = document.createElement("div")
  header.dataset.astraTranscriptHeader = "true"
  const title = document.createElement("div")
  title.dataset.astraTranscriptTitle = "true"
  title.textContent = snapshot?.title ?? "Astra Transcript"
  const close = document.createElement("button")
  close.type = "button"
  close.textContent = "Close"
  close.addEventListener("click", unmountVideoTranscriptPanel)
  header.append(title, close)
  panelRoot.appendChild(header)

  const search = document.createElement("input")
  search.type = "search"
  search.placeholder = "Search transcript"
  search.setAttribute("aria-label", "Search transcript cues")
  search.value = searchQuery
  search.addEventListener("input", () => {
    searchQuery = search.value
    renderTranscriptPanel()
  })
  panelRoot.appendChild(search)

  const actions = document.createElement("div")
  actions.dataset.astraTranscriptActions = "true"
  const openDeepRead = document.createElement("button")
  openDeepRead.type = "button"
  openDeepRead.textContent = "Open in Deep Read"
  openDeepRead.addEventListener("click", handleOpenDeepRead)
  // Transcript export buttons (bilingual / SRT / learning-notes) intentionally
  // removed for the paid beta — see the export-helper note above (ToS/copyright).
  const generateSummary = document.createElement("button")
  generateSummary.type = "button"
  generateSummary.textContent = videoLearningSummary ? "Regenerate summary" : "Generate summary"
  generateSummary.disabled = !snapshot?.cues.length || summaryGenerationInFlight !== null
  generateSummary.addEventListener("click", () => { void handleGenerateVideoSummary(true) })
  actions.append(openDeepRead, generateSummary)
  panelRoot.appendChild(actions)

  const tabs = document.createElement("div")
  tabs.dataset.astraTranscriptTabs = "true"
  tabs.setAttribute("role", "group")
  tabs.setAttribute("aria-label", "Transcript panel sections")
  ;([
    ["summary", "Summary"],
    ["transcript", "Transcript"],
    ["words", "Words"],
    ["notes", "Notes"],
  ] as Array<[TranscriptPanelTab, string]>).forEach(([tab, label]) => {
    const button = document.createElement("button")
    button.type = "button"
    button.textContent = label
    button.dataset.active = String(activeTab === tab)
    button.setAttribute("aria-pressed", String(activeTab === tab))
    button.setAttribute("aria-label", `${label} section`)
    button.addEventListener("click", () => {
      activeTab = tab
      renderTranscriptPanel()
    })
    tabs.appendChild(button)
  })
  panelRoot.appendChild(tabs)

  const trimmedSearchQuery = searchQuery.trim()
  const resolvedStatusText = trimmedSearchQuery
    ? `Search active for “${trimmedSearchQuery}”: ${displayedCues.length} transcript row${displayedCues.length === 1 ? "" : "s"}.`
    : statusMessage || (snapshot?.available
      ? `${displayedCues.length} transcript rows`
      : snapshot?.noCaptions
        ? localizedLabel("transcriptNoCaptionsTitle", "Captions aren't available for this video")
        : "Loading transcript rows from YouTube…")
  const resolvedStatusTone: TranscriptPanelStatusTone = trimmedSearchQuery
    ? "info"
    : statusMessage
      ? statusTone
      : snapshot?.available
        ? "info"
        : snapshot?.noCaptions
          ? "warning"
          : "loading"
  const status = document.createElement("div")
  status.dataset.astraTranscriptStatus = "true"
  status.dataset.state = resolvedStatusTone
  status.setAttribute("role", resolvedStatusTone === "error" ? "alert" : "status")
  status.setAttribute("aria-live", resolvedStatusTone === "error" ? "assertive" : "polite")
  status.setAttribute("aria-atomic", "true")
  status.textContent = resolvedStatusText
  panelRoot.appendChild(status)

  // No captions on this video → don't dead-end on a perpetual "loading" list.
  // Offer a human explanation + a paste box to explain copied subtitle text,
  // reusing the inline-action explain pipeline.
  if (snapshot?.noCaptions && !trimmedSearchQuery) {
    const fallback = document.createElement("div")
    fallback.dataset.astraTranscriptNoCaptions = "true"

    const body = document.createElement("p")
    body.textContent = localizedLabel(
      "transcriptNoCaptionsBody",
      "YouTube captions aren't available for this video. Paste a line you copied from the subtitles and Astra will explain it.",
    )
    fallback.appendChild(body)

    const label = document.createElement("label")
    label.textContent = localizedLabel("transcriptNoCaptionsPasteLabel", "Paste subtitle text")
    const textarea = document.createElement("textarea")
    textarea.dataset.astraTranscriptNoCaptionsInput = "true"
    textarea.rows = 3
    textarea.value = pastedSubtitleText
    textarea.addEventListener("input", () => { pastedSubtitleText = textarea.value })
    label.appendChild(textarea)
    fallback.appendChild(label)

    const explain = document.createElement("button")
    explain.type = "button"
    explain.dataset.astraTranscriptNoCaptionsExplain = "true"
    explain.textContent = localizedLabel("transcriptNoCaptionsExplain", "Explain pasted text")
    explain.addEventListener("click", () => { void handleExplainPastedText(textarea.value) })
    fallback.appendChild(explain)

    if (pastedSubtitleExplanation) {
      const explanation = document.createElement("p")
      explanation.dataset.astraTranscriptNoCaptionsExplanation = "true"
      explanation.textContent = pastedSubtitleExplanation
      fallback.appendChild(explanation)
    }

    panelRoot.appendChild(fallback)
    return
  }

  // Post-save nudge: a real next step, not a flat toast — "review N now" (reusing
  // the review deep-link) + "find it later in Vocabulary". Cleared on any other status.
  if (savedReviewNudge && resolvedStatusTone === "success") {
    const nudge = document.createElement("div")
    nudge.dataset.astraTranscriptSavedNudge = "true"
    const reviewBtn = document.createElement("button")
    reviewBtn.type = "button"
    reviewBtn.dataset.astraTranscriptReviewNow = "true"
    const reviewLabel = localizedLabel("transcriptReviewNow", "Review now")
    reviewBtn.textContent = savedReviewNudge.dueCount > 0 ? `${reviewLabel} (${savedReviewNudge.dueCount})` : reviewLabel
    reviewBtn.addEventListener("click", () => { openReview() })
    const hint = document.createElement("span")
    hint.dataset.astraTranscriptSavedHint = "true"
    hint.textContent = localizedLabel("transcriptFindInVocabulary", "Find it later in your Vocabulary")
    nudge.append(reviewBtn, hint)
    panelRoot.appendChild(nudge)
  }

  if (activeTab === "summary") {
    panelRoot.appendChild(renderLearningSummarySection(snapshot))
    return
  }
  if (activeTab === "words") {
    panelRoot.appendChild(renderWordsSection())
    return
  }
  if (activeTab === "notes") {
    panelRoot.appendChild(renderNotesSection())
    return
  }

  if (miniDictionary) {
    const dictionary = document.createElement("div")
    dictionary.dataset.astraMiniDictionary = miniDictionary.word
    const title = document.createElement("strong")
    title.textContent = miniDictionary.word
    const hint = document.createElement("div")
    hint.textContent = miniDictionary.languageHint
    const definition = document.createElement("div")
    definition.textContent = miniDictionary.definition
    const saveWord = document.createElement("button")
    saveWord.type = "button"
    saveWord.textContent = localizedLabel("transcriptSaveWord", "Save word to Review")
    saveWord.disabled = miniDictionary.loading
    saveWord.addEventListener("click", () => { void handleSaveMiniDictionaryWord() })
    dictionary.append(title, hint, definition, saveWord)
    panelRoot.appendChild(dictionary)
  }

  const list = document.createElement("div")
  list.dataset.astraTranscriptList = "true"

  displayedCues.forEach((cue) => {
    const originalIndex = snapshot?.cues.findIndex((item) => item.id === cue.id) ?? -1
    const row = document.createElement("button")
    row.type = "button"
    row.dataset.astraTranscriptRow = cue.id
    row.dataset.active = String(originalIndex === snapshot?.activeIndex)
    row.addEventListener("click", () => {
      const video = getYouTubeVideoElement()
      if (video) {
        video.currentTime = cue.startMs / 1000
        video.dispatchEvent(new Event("seeked"))
      }
    })

    const time = document.createElement("span")
    time.dataset.astraTranscriptTime = "true"
    time.textContent = formatTimestamp(cue.startMs)
    const source = document.createElement("span")
    appendClickableWords(source, cue)
    row.append(time, source)

    if (cue.translation) {
      const translation = document.createElement("span")
      translation.dataset.astraTranscriptTranslation = "true"
      translation.textContent = cue.translation
      row.appendChild(translation)
    }

    const rowActions = document.createElement("span")
    rowActions.dataset.astraTranscriptRowActions = "true"
    const copy = document.createElement("button")
    copy.type = "button"
    copy.textContent = "Copy"
    copy.addEventListener("click", (event) => {
      event.stopPropagation()
      void handleCopyCue(cue)
    })
    const explain = document.createElement("button")
    explain.type = "button"
    explain.textContent = "Explain"
    explain.addEventListener("click", (event) => {
      event.stopPropagation()
      void handleExplainCue(cue)
    })
    const save = document.createElement("button")
    save.type = "button"
    save.textContent = "Save sentence"
    save.addEventListener("click", (event) => {
      event.stopPropagation()
      void handleSaveCue(cue)
    })
    const addWord = document.createElement("button")
    addWord.type = "button"
    addWord.textContent = "Add word"
    addWord.addEventListener("click", (event) => {
      event.stopPropagation()
      void handleAddWordCue(cue)
    })
    const speak = document.createElement("button")
    speak.type = "button"
    speak.textContent = "Speak"
    speak.addEventListener("click", (event) => {
      event.stopPropagation()
      speakCue(cue)
    })
    rowActions.append(copy, explain, save, addWord, speak)
    row.appendChild(rowActions)

    const explanation = explanationByCueId.get(cue.id)
    if (explanation) {
      const explanationEl = document.createElement("span")
      explanationEl.dataset.astraTranscriptExplanation = "true"
      explanationEl.textContent = explanation
      row.appendChild(explanationEl)
    }

    list.appendChild(row)
  })

  panelRoot.appendChild(list)
}

export function mountVideoTranscriptPanel(options: TranscriptPanelOptions): void {
  activeOptions = options
  injectTranscriptPanelStyles()

  if (!panelRoot?.isConnected) {
    panelRoot = document.createElement("aside")
    panelRoot.id = PANEL_ID
    panelRoot.setAttribute("role", "complementary")
    panelRoot.setAttribute("aria-label", "Astra Transcript Panel")
    document.body.appendChild(panelRoot)
  }

  unsubscribeTranscript?.()
  document.addEventListener("fullscreenchange", handleFullscreenChange)
  unsubscribeTranscript = subscribeYouTubeTranscriptSnapshot((snapshot) => {
    latestSnapshot = snapshot
    if (snapshot?.cues.length && !videoLearningSummary && attemptedSummaryCueCount !== snapshot.cues.length) {
      void handleGenerateVideoSummary(false)
    }
    renderTranscriptPanel()
  })
  renderTranscriptPanel()
}

export function unmountVideoTranscriptPanel(): void {
  unsubscribeTranscript?.()
  unsubscribeTranscript = null
  document.removeEventListener("fullscreenchange", handleFullscreenChange)
  latestSnapshot = null
  activeOptions = null
  searchQuery = ""
  activeTab = "summary"
  explanationByCueId = new Map()
  miniDictionary = null
  videoLearningSummary = null
  savedVideoSentences = []
  savedVideoWords = []
  latestSavedReviewEntryId = null
  summaryGenerationInFlight = null
  attemptedSummaryCueCount = 0
  statusMessage = ""
  statusTone = "info"
  pastedSubtitleText = ""
  pastedSubtitleExplanation = ""
  panelRoot?.remove()
  panelRoot = null
}
