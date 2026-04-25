import { useEffect, useState } from "react"
import { browser } from "#imports"
import type { VocabularyEntry } from "@/utils/storage/vocabulary"
import { recordLearningLoopEvent } from "@/utils/learning-loop-events"
import {
  getVocabularyEntries,
  removeVocabularyEntry,
  getDueVocabularyCount,
  updateVocabularyEntry,
} from "@/utils/storage/vocabulary"
import { deriveVocabularySourceDisplay } from "@/utils/storage/vocabulary-core"
import { getReadingHistoryEntry } from "@/utils/storage/reading-history"
import {
  deriveStudyLoopPageSummary,
  getPageStudyProgress,
  getStudyProgress,
  type StudyLoopPageCounts,
  type StudyLoopPageSummary,
  type StudyStep,
} from "@/utils/storage/study-progress"
import type { OwnedReadingItem, OwnedReadingQueueView, OwnedReadingStatus } from "@/utils/storage/owned-reading"
import {
  buildOwnedReadingResumeTarget,
  countOwnedReadingItemsByView,
  deriveOwnedReadingArticleUrl,
  describeOwnedReadingProgress,
  describeOwnedReadingResumeBehavior,
  filterOwnedReadingItemsByView,
  getOwnedReadingSourceTypeLabel,
  listOwnedReadingItems,
  markOwnedReadingOpened,
  matchOwnedReadingItemForVocabularyEntry,
  removeOwnedReadingItem,
  setOwnedReadingStatus,
  syncRecentReadingHistoryToOwnedQueue,
} from "@/utils/storage/owned-reading"
import { isTtsSupported, speak, stopSpeaking } from "@/utils/tts"
import { readConfig } from "@/utils/storage/config"
import { translateTexts } from "@/utils/translate/translate"
import type { ExplainMode } from "@/types/config"
import { openVocabularyEntryInDeepRead } from "@/utils/deep-read-link"
import ReviewMode from "./ReviewMode"
import { t } from "@/utils/i18n"

type ActiveTab = "list" | "review" | "reading"
type ReadingSubTab = "recent" | "saved" | "in_progress"
type SortMode = "time" | "alpha"
type ReadingSortMode = "opened" | "title"

function buildExplainModeSystemPrompt(explainMode: ExplainMode): string | undefined {
  switch (explainMode) {
    case "beginner":
      return "Explain the sentence like a patient beginner tutor. Prefer plain words, shorter sentences, and concrete meaning over abstract analysis."
    case "exam":
      return "Explain the sentence like an exam-prep coach. Focus on grammar structure, collocations, likely learner mistakes, and why the phrasing matters."
    case "deep":
      return "Explain the sentence like a deep reading coach. Focus on nuance, tone, intention, and how the wording works in context."
  }
}

function formatMessage(template: string, ...values: Array<string | number>): string {
  return values.reduce<string>(
    (message, value, index) => message.replace(`$${index + 1}`, String(value)),
    template,
  )
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatDateISO(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10)
}

function escapeCSV(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function exportCSV(entries: VocabularyEntry[]): void {
  const header = "text,translation,context,url,savedAt"
  const rows = entries.map((e) =>
    [
      escapeCSV(e.text),
      escapeCSV(e.translation ?? ""),
      escapeCSV(e.context ?? ""),
      escapeCSV(e.url ?? ""),
      escapeCSV(formatDateISO(e.savedAt)),
    ].join(","),
  )
  const csv = [header, ...rows].join("\n")
  downloadFile(csv, "astra-vocabulary.csv", "text/csv;charset=utf-8")
}

function exportAnkiTSV(entries: VocabularyEntry[]): void {
  const rows = entries.map((e) => {
    const front = e.text
    const backParts = [e.translation ?? ""]
    if (e.context) {
      backParts.push(e.context)
    }
    const back = backParts.join("\\n")
    return `${front}\t${back}`
  })
  const tsv = rows.join("\n")
  downloadFile(tsv, "astra-vocabulary-anki.tsv", "text/tab-separated-values;charset=utf-8")
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function getInitialTab(): ActiveTab {
  const params = new URLSearchParams(window.location.search)
  const tab = params.get("tab")
  if (tab === "review") return "review"
  if (tab === "reading") return "reading"
  return "list"
}

interface ReadingArticleSummary {
  pageUrl: string
  hostname: string
  wordsTranslated: number | null
  progress: StudyLoopPageSummary
}

function getReadingStepLabel(step: StudyStep): string {
  const labels: Record<StudyStep, string> = {
    read: "Read",
    guided_read: "Guided read",
    explain: "Explain",
    vocab_save: "Save words",
    vocab_review: "Review",
  }
  return labels[step]
}

function formatReadingStepTrail(steps: StudyStep[]): string {
  return steps.length > 0
    ? steps.map((step) => getReadingStepLabel(step)).join(" → ")
    : "No recorded steps yet"
}

function formatReadingCounts(counts: StudyLoopPageCounts): string {
  return `${counts.sentencesExplained} explained · ${counts.vocabSaved} saved · ${counts.vocabReviewed} reviewed`
}

function getReadingNextStepHint(step: StudyStep | null): string {
  switch (step) {
    case "read":
      return "Open the page and start reading or translating it again."
    case "guided_read":
      return "Run guided read once to rebuild sentence-level study context."
    case "explain":
      return "Explain a sentence from this page before saving more words."
    case "vocab_save":
      return "Save at least one useful word from this page."
    case "vocab_review":
      return "Review the saved card from this page to close the loop."
    default:
      return "Loop complete — reopen the page when you want more context."
  }
}

function formatWordsTranslated(wordsTranslated: number | null): string | null {
  if (wordsTranslated === null || wordsTranslated < 0) return null
  return `${wordsTranslated} ${wordsTranslated === 1 ? "word" : "words"} translated`
}

function getReadingViewLabel(view: OwnedReadingQueueView): string {
  switch (view) {
    case "recent":
      return "Recent"
    case "saved":
      return "Saved"
    case "in_progress":
      return "In progress"
  }
}

function getReadingViewHint(view: OwnedReadingQueueView): string {
  switch (view) {
    case "recent":
      return "Recent shows active queue items ordered by last opened. Archived rows stay hidden here."
    case "saved":
      return "Saved keeps items you want easy access to later."
    case "in_progress":
      return "In progress highlights items you are still actively working through."
  }
}

function getLearningDeskHeadline(params: {
  dueCount: number
  inProgressCount: number
  savedCount: number
}): string {
  if (params.dueCount > 0) {
    return `You have ${params.dueCount} card${params.dueCount === 1 ? "" : "s"} ready to review.`
  }
  if (params.inProgressCount > 0) {
    return `You have ${params.inProgressCount} reading item${params.inProgressCount === 1 ? "" : "s"} in progress.`
  }
  if (params.savedCount > 0) {
    return `Your study queue is clear. Keep reading and save your next useful phrase.`
  }
  return "Start by saving vocabulary from any page, article, or reader surface."
}

function getLearningDeskHint(params: {
  dueCount: number
  inProgressCount: number
}): string {
  if (params.dueCount > 0) {
    return "Review first to keep the loop moving, then come back to your reading queue."
  }
  if (params.inProgressCount > 0) {
    return "Resume an active reading item and explain or save one more sentence."
  }
  return "Use Astra while reading and this space will turn into your daily study desk."
}

function formatLocalDayLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export default function VocabularyApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(getInitialTab)
  const [readingSubTab, setReadingSubTab] = useState<ReadingSubTab>("recent")
  const [readingSortMode, setReadingSortMode] = useState<ReadingSortMode>("opened")
  const [readingItems, setReadingItems] = useState<OwnedReadingItem[]>([])
  const [linkedOwnedReadingItems, setLinkedOwnedReadingItems] = useState<OwnedReadingItem[]>([])
  const [readingLoading, setReadingLoading] = useState(() => getInitialTab() === "reading")
  const [entries, setEntries] = useState<VocabularyEntry[]>([])
  const [search, setSearch] = useState("")
  const [sortMode, setSortMode] = useState<SortMode>("time")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [dueCount, setDueCount] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null)
  const [readingArticleSummaries, setReadingArticleSummaries] = useState<Record<string, ReadingArticleSummary>>({})
  const [dailyPagesStudied, setDailyPagesStudied] = useState(0)
  const [dailySentencesExplained, setDailySentencesExplained] = useState(0)
  const [dailyVocabSaved, setDailyVocabSaved] = useState(0)
  const [dailyVocabReviewed, setDailyVocabReviewed] = useState(0)
  const [dailyStatsDate, setDailyStatsDate] = useState("")
  const [dailyStatsInfoOpen, setDailyStatsInfoOpen] = useState(false)
  const [speakingEntryId, setSpeakingEntryId] = useState<string | null>(null)
  const [explainingEntryId, setExplainingEntryId] = useState<string | null>(null)
  const [expandedContextEntryIds, setExpandedContextEntryIds] = useState<Set<string>>(() => new Set())

  const loadEntries = async () => {
    const [data, due, progress, ownedItems] = await Promise.all([
      getVocabularyEntries(),
      getDueVocabularyCount(),
      getStudyProgress(),
      listOwnedReadingItems(),
    ])
    setEntries(data)
    setLinkedOwnedReadingItems(ownedItems)
    setDueCount(due)
    setDailyPagesStudied(progress.dailyStats.pagesStudied)
    setDailySentencesExplained(progress.dailyStats.sentencesExplained)
    setDailyVocabSaved(progress.dailyStats.vocabSaved)
    setDailyVocabReviewed(progress.dailyStats.vocabReviewed)
    setDailyStatsDate(progress.dailyStats.date)
    setLoading(false)
  }

  const loadReadingQueue = async () => {
    setReadingLoading(true)
    await syncRecentReadingHistoryToOwnedQueue()
    const items = await listOwnedReadingItems()
    setReadingItems(items)
    setLinkedOwnedReadingItems(items)

    const articleSummaryEntries = await Promise.all(items.map(async (row) => {
      if (row.sourceType !== "article") return null
      const pageUrl = deriveOwnedReadingArticleUrl(row)
      const progressKey = row.studyProgressRecordId?.trim() || pageUrl
      const [historyEntry, page] = await Promise.all([
        pageUrl ? getReadingHistoryEntry(pageUrl) : Promise.resolve(null),
        progressKey ? getPageStudyProgress(progressKey) : Promise.resolve(null),
      ])

      return [row.id, {
        pageUrl: pageUrl ?? progressKey ?? "",
        hostname: historyEntry?.hostname ?? page?.hostname ?? "",
        wordsTranslated: historyEntry?.wordsTranslated ?? null,
        progress: deriveStudyLoopPageSummary(page),
      }] as [string, ReadingArticleSummary]
    }))

    setReadingArticleSummaries(Object.fromEntries(
      articleSummaryEntries.filter((entry): entry is [string, ReadingArticleSummary] => entry !== null),
    ))
    setReadingLoading(false)
    setLoading(false)
  }

  useEffect(() => {
    if (activeTab === "reading") {
      void loadReadingQueue()
      return
    }
    void loadEntries()
  }, [activeTab])

  useEffect(() => {
    return () => {
      stopSpeaking()
    }
  }, [])

  const handleDelete = async (id: string) => {
    await removeVocabularyEntry(id)
    setConfirmDeleteId(null)
    await loadEntries()
  }

  const handleNoteChange = async (id: string, note: string) => {
    await updateVocabularyEntry(id, { note: note || undefined })
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, note: note || undefined } : e))
  }

  const handleTagsChange = async (id: string, tagsStr: string) => {
    const tags = tagsStr
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
    await updateVocabularyEntry(id, { tags: tags.length > 0 ? tags : undefined })
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, tags: tags.length > 0 ? tags : undefined } : e))
  }

  // Collect all unique tags across entries for the filter chips
  const allTags = Array.from(
    new Set(entries.flatMap((e) => e.tags ?? [])),
  ).sort()

  const filtered = entries.filter((e) => {
    // Tag filter
    if (activeTagFilter && !(e.tags ?? []).includes(activeTagFilter)) return false
    // Text search
    if (!search) return true
    const q = search.toLowerCase()
    const sc = e.sourceContext
    const sourceBlob = [
      sc?.pageTitle,
      sc?.sentenceText,
      sc?.articleExcerpt,
      sc?.contentSummary,
      e.url,
      e.hostname,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
    return (
      e.text.toLowerCase().includes(q)
      || (e.translation?.toLowerCase().includes(q) ?? false)
      || (e.context?.toLowerCase().includes(q) ?? false)
      || (e.explanation?.toLowerCase().includes(q) ?? false)
      || (e.note?.toLowerCase().includes(q) ?? false)
      || (e.tags ?? []).some((tag) => tag.toLowerCase().includes(q))
      || sourceBlob.includes(q)
    )
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === "alpha") {
      return a.text.localeCompare(b.text)
    }
    return b.savedAt - a.savedAt
  })

  const readingCounts: Record<ReadingSubTab, number> = {
    recent: countOwnedReadingItemsByView(readingItems, "recent"),
    saved: countOwnedReadingItemsByView(readingItems, "saved"),
    in_progress: countOwnedReadingItemsByView(readingItems, "in_progress"),
  }

  const featuredReadingItem = [...filterOwnedReadingItemsByView(readingItems, "in_progress")]
    .sort((a, b) => b.openedAt - a.openedAt)[0] ?? [...filterOwnedReadingItemsByView(readingItems, "recent")]
      .sort((a, b) => b.openedAt - a.openedAt)[0] ?? null

  const readingFiltered = [...filterOwnedReadingItemsByView(readingItems, readingSubTab)]
    .sort((a, b) => {
      if (readingSortMode === "title") {
        return a.title.localeCompare(b.title)
      }
      return b.openedAt - a.openedAt
    })

  const hasDailyProgress =
    dailyPagesStudied > 0
    || dailySentencesExplained > 0
    || dailyVocabSaved > 0
    || dailyVocabReviewed > 0
  const dailyStatsLabel = dailyStatsDate ? formatLocalDayLabel(dailyStatsDate) : ""

  const learningDeskHeadline = getLearningDeskHeadline({
    dueCount,
    inProgressCount: readingCounts.in_progress,
    savedCount: entries.length,
  })
  const learningDeskHint = getLearningDeskHint({
    dueCount,
    inProgressCount: readingCounts.in_progress,
  })

  const openReadingItem = async (item: OwnedReadingItem) => {
    const target = buildOwnedReadingResumeTarget(item)
    if (!target) return

    await markOwnedReadingOpened(item.id)
    recordLearningLoopEvent("resumed_reading", {
      ownedReadingItemId: item.id,
      pageUrl: target.url,
      sourceType: item.sourceType,
      source: "vocabulary",
    })
    void browser.tabs.create({ url: target.url })
    void loadReadingQueue()
  }

  const handleReadingStatus = async (id: string, status: OwnedReadingStatus) => {
    await setOwnedReadingStatus(id, status)
    void loadReadingQueue()
  }

  const handleRemoveReading = async (id: string) => {
    await removeOwnedReadingItem(id)
    void loadReadingQueue()
  }

  const handleSpeakEntry = async (entry: VocabularyEntry) => {
    if (speakingEntryId === entry.id) {
      stopSpeaking()
      setSpeakingEntryId(null)
      return
    }

    const config = await readConfig()
    const enabled = config.tts.enabled && isTtsSupported(config.tts.engine)
    if (!enabled) return

    const sourceSentence = entry.sourceContext?.sentenceText?.trim()
    const text = sourceSentence || entry.text.trim()
    if (!text) return

    stopSpeaking()
    const started = speak(text, {
      engine: config.tts.engine,
      voiceName: config.tts.voiceName,
      rate: config.tts.rate,
      pitch: config.tts.pitch,
      lang: config.targetLang,
      onEnd: () => setSpeakingEntryId(null),
      onError: () => setSpeakingEntryId(null),
    })

    setSpeakingEntryId(started ? entry.id : null)
  }

  const handleExplainEntry = async (entry: VocabularyEntry) => {
    const text = entry.sourceContext?.sentenceText?.trim() || entry.context?.trim() || entry.text.trim()
    if (!text || explainingEntryId) return

    const config = await readConfig()
    setExplainingEntryId(entry.id)
    try {
      const result = await translateTexts({
        texts: [text],
        targetLang: config.targetLang,
        context: {
          pageTitle: entry.sourceContext?.pageTitle,
          pageUrl: entry.sourceContext?.pageUrl ?? entry.url,
          hostname: entry.sourceContext?.hostname ?? entry.hostname,
          contentSummary: entry.sourceContext?.contentSummary,
          selectionContext: text,
        },
        task: "explain",
        customSystemPrompt: buildExplainModeSystemPrompt(config.explainMode),
      })

      if (!result.ok) return

      const explanation = result.translations[0]?.trim()
      if (!explanation) return

      await updateVocabularyEntry(entry.id, { explanation })
      setEntries((current) => current.map((item) => item.id === entry.id ? { ...item, explanation } : item))
    } finally {
      setExplainingEntryId(null)
    }
  }

  const toggleExpandedContext = (entryId: string) => {
    setExpandedContextEntryIds((current) => {
      const next = new Set(current)
      if (next.has(entryId)) {
        next.delete(entryId)
      } else {
        next.add(entryId)
      }
      return next
    })
  }

  const containerStyle: React.CSSProperties = {
    maxWidth: 720,
    margin: "0 auto",
    padding: "24px 20px",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: "#0f172a",
    lineHeight: 1.5,
  }

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 12,
  }

  const titleStyle: React.CSSProperties = {
    fontSize: 22,
    fontWeight: 700,
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: 8,
  }

  const countBadgeStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 500,
    color: "#6366f1",
    background: "rgba(99, 102, 241, 0.1)",
    borderRadius: 999,
    padding: "2px 10px",
  }

  const searchInputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    fontSize: 14,
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    outline: "none",
    boxSizing: "border-box",
  }

  const toolbarStyle: React.CSSProperties = {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 16,
  }

  const sortButtonStyle = (active: boolean): React.CSSProperties => ({
    border: "1px solid",
    borderColor: active ? "#6366f1" : "#e2e8f0",
    background: active ? "rgba(99, 102, 241, 0.08)" : "#fff",
    color: active ? "#6366f1" : "#64748b",
    borderRadius: 6,
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  })

  const exportButtonStyle: React.CSSProperties = {
    border: "1px solid #e2e8f0",
    background: "#fff",
    color: "#334155",
    borderRadius: 6,
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  }

  const learningActionButtonStyle: React.CSSProperties = {
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  }

  const cardStyle: React.CSSProperties = {
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: "12px 16px",
    marginBottom: 10,
    background: "#fff",
  }

  const wordStyle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 600,
    color: "#0f172a",
    marginBottom: 4,
  }

  const translationStyle: React.CSSProperties = {
    fontSize: 14,
    color: "#6366f1",
    marginBottom: 6,
  }

  const contextStyle: React.CSSProperties = {
    fontSize: 12,
    color: "#64748b",
    fontStyle: "italic",
    marginBottom: 6,
    lineHeight: 1.4,
  }

  const metaRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  }

  const metaStyle: React.CSSProperties = {
    fontSize: 11,
    color: "#94a3b8",
  }

  const deleteBtnStyle: React.CSSProperties = {
    border: "none",
    background: "rgba(239, 68, 68, 0.08)",
    color: "#ef4444",
    borderRadius: 6,
    padding: "3px 10px",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
  }

  const confirmBtnStyle: React.CSSProperties = {
    border: "none",
    background: "#ef4444",
    color: "#fff",
    borderRadius: 6,
    padding: "3px 10px",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
  }

  const emptyStyle: React.CSSProperties = {
    textAlign: "center",
    padding: "48px 20px",
    color: "#94a3b8",
    fontSize: 15,
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 20px",
    fontSize: 14,
    fontWeight: 600,
    border: "none",
    borderBottom: active ? "2px solid #6366f1" : "2px solid transparent",
    background: "transparent",
    color: active ? "#6366f1" : "#64748b",
    cursor: "pointer",
  })

  const tabBarStyle: React.CSSProperties = {
    display: "flex",
    gap: 4,
    borderBottom: "1px solid #e2e8f0",
    marginBottom: 20,
  }

  const learningDeskCardStyle: React.CSSProperties = {
    marginBottom: 18,
    padding: "16px 18px",
    background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 55%, #ecfeff 100%)",
    border: "1px solid #bfdbfe",
    borderRadius: 14,
  }

  const learningDeskActionStyle: React.CSSProperties = {
    border: "1px solid #bfdbfe",
    background: "#ffffffcc",
    color: "#1d4ed8",
    borderRadius: 8,
    padding: "7px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  }

  const showListLoading = activeTab !== "reading" && loading
  const showReadingLoading = activeTab === "reading" && readingLoading
  if (showListLoading || showReadingLoading) {
    return (
      <div style={containerStyle}>
        <p style={{ color: "#94a3b8", textAlign: "center" }}>Loading...</p>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>
          {t("vocabulary_title")}
        </h1>
        <span style={countBadgeStyle}>{formatMessage(t("vocabulary_countBadge"), entries.length, entries.length === 1 ? t("vocabulary_countWordSingular") : t("vocabulary_countWordPlural"))}</span>
      </div>

      <div style={tabBarStyle}>
        <button type="button" style={tabStyle(activeTab === "list")} onClick={() => setActiveTab("list")}>
          {t("vocabulary_tabList")}
        </button>
        <button type="button" style={tabStyle(activeTab === "review")} onClick={() => setActiveTab("review")}>
          {dueCount > 0 ? formatMessage(t("vocabulary_tabReviewWithCount"), dueCount) : t("vocabulary_tabReview")}
        </button>
        <button type="button" style={tabStyle(activeTab === "reading")} onClick={() => setActiveTab("reading")}>
          {t("vocabulary_tabReading")}
        </button>
      </div>

      {activeTab === "review" && <ReviewMode />}

      {activeTab === "list" && (
        <>
          <div style={learningDeskCardStyle}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", color: "#1d4ed8", marginBottom: 6 }}>
              {t("vocabulary_learningDeskTitle")}
            </div>
            <div style={{ fontSize: 18, lineHeight: 1.35, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>
              {learningDeskHeadline}
            </div>
            <div style={{ fontSize: 13, color: "#475569", marginBottom: 12 }}>
              {learningDeskHint}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: 10, padding: "10px 12px", minWidth: 120 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>Due review</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>{t("vocabulary_statDueReview")}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: dueCount > 0 ? "#b45309" : "#0f172a" }}>{dueCount}</div>
              </div>
              <div style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: 10, padding: "10px 12px", minWidth: 120 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>{t("vocabulary_statInProgress")}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{readingCounts.in_progress}</div>
              </div>
              <div style={{ background: "#fff", border: "1px solid #dbeafe", borderRadius: 10, padding: "10px 12px", minWidth: 120 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>{t("vocabulary_statSavedWords")}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{entries.length}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" style={learningDeskActionStyle} onClick={() => setActiveTab("review")}>
                {dueCount > 0 ? formatMessage(t("vocabulary_actionStartReviewWithCount"), dueCount) : t("vocabulary_actionOpenReview")}
              </button>
              <button type="button" style={learningDeskActionStyle} onClick={() => setActiveTab("reading")}>
                {t("vocabulary_actionOpenReadingQueue")}
              </button>
              <button type="button" style={learningDeskActionStyle} onClick={() => setActiveTab("list")}>
                {t("vocabulary_actionBrowseSaved")}
              </button>
            </div>
            {featuredReadingItem && (
              <div style={{ marginTop: 12, padding: "10px 12px", background: "#ffffffcc", border: "1px solid #dbeafe", borderRadius: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>{t("vocabulary_continueReadingTitle")}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
                  {featuredReadingItem.title}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                  {describeOwnedReadingResumeBehavior(featuredReadingItem)}
                </div>
                <button
                  type="button"
                  style={learningDeskActionStyle}
                  onClick={() => void openReadingItem(featuredReadingItem)}
                >
                  {t("vocabulary_actionResumeReading")}
                </button>
              </div>
            )}
          </div>

          {hasDailyProgress && (
            <div
              style={{
                marginBottom: 16,
                padding: "12px 14px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
              }}
              aria-label={t("review_todayProgressAria")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>
                  {t("popup_studyTodayStatsTitle")}
                </div>
                <button
                  type="button"
                  onClick={() => setDailyStatsInfoOpen((current) => !current)}
                  aria-expanded={dailyStatsInfoOpen}
                  style={{
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#475569",
                    borderRadius: 999,
                    padding: "2px 8px",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {t("popup_studyTodayStatsInfoAction")}
                </button>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>
                {t("popup_studyTodayStatsHint", dailyStatsLabel || dailyStatsDate)}
              </div>
              {dailyStatsInfoOpen && (
                <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6, marginBottom: 8 }}>
                  {t("popup_studyTodayStatsResetBoundary")}
                </div>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 14px", fontSize: 12, color: "#64748b" }}>
                <span>{t("popup_studyStatPages", dailyPagesStudied.toString())}</span>
                <span>{t("popup_studyStatExplained", dailySentencesExplained.toString())}</span>
                <span>{t("popup_studyStatSaved", dailyVocabSaved.toString())}</span>
                <span>{t("popup_studyStatReviewed", dailyVocabReviewed.toString())}</span>
              </div>
            </div>
          )}
          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              placeholder={t("vocabulary_searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={searchInputStyle}
            />
          </div>

          <div style={toolbarStyle}>
            <span style={{ fontSize: 12, color: "#64748b", marginRight: 4 }}>{t("vocabulary_sortLabel")}</span>
            <button
              type="button"
              style={sortButtonStyle(sortMode === "time")}
              onClick={() => setSortMode("time")}
            >
              {t("vocabulary_sortNewest")}
            </button>
            <button
              type="button"
              style={sortButtonStyle(sortMode === "alpha")}
              onClick={() => setSortMode("alpha")}
            >
              {t("vocabulary_sortAlpha")}
            </button>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              style={exportButtonStyle}
              onClick={() => exportCSV(sorted)}
              disabled={sorted.length === 0}
            >
              {t("vocabulary_exportCsv")}
            </button>
            <button
              type="button"
              style={exportButtonStyle}
              onClick={() => exportAnkiTSV(sorted)}
              disabled={sorted.length === 0}
            >
              {t("vocabulary_exportAnkiTsv")}
            </button>
          </div>

          {allTags.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {allTags.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  style={{
                    border: "1px solid",
                    borderColor: activeTagFilter === tag ? "#6366f1" : "#e2e8f0",
                    background: activeTagFilter === tag ? "rgba(99, 102, 241, 0.08)" : "#fff",
                    color: activeTagFilter === tag ? "#6366f1" : "#64748b",
                    borderRadius: 999,
                    padding: "3px 10px",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                  onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {sorted.length === 0 && (
            <div style={emptyStyle}>
              {search
                ? t("vocabulary_emptySearch")
                : t("vocabulary_emptyDefault")}
            </div>
          )}

          {sorted.map((entry) => (
            <div key={entry.id} style={cardStyle}>
              {(() => {
                const sourceDisplay = deriveVocabularySourceDisplay(entry)
                const linkedReadingItem = matchOwnedReadingItemForVocabularyEntry(linkedOwnedReadingItems, entry)
                const linkedReadingResumeTarget = linkedReadingItem ? buildOwnedReadingResumeTarget(linkedReadingItem) : null
                const linkedReadingProgress = linkedReadingItem ? describeOwnedReadingProgress(linkedReadingItem) : null
                const isContextExpanded = expandedContextEntryIds.has(entry.id)
                const snippet = sourceDisplay.snippet
                const snippetLong = snippet.length > 200
                const visibleSnippet = snippetLong && !isContextExpanded
                  ? `${snippet.slice(0, 200)}...`
                  : snippet

                return (
                  <>
              <div
                data-role="vocabulary-entry-card"
                data-entry-id={entry.id}
                style={{ cursor: "pointer" }}
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              >
                <div style={wordStyle}>{entry.text}</div>
                {entry.translation && (
                  <div style={translationStyle}>{entry.translation}</div>
                )}
                {sourceDisplay.surfaceLabel && (
                  <div style={{ fontSize: 11, color: "#6366f1", fontWeight: 700, marginBottom: 4 }}>
                    {sourceDisplay.surfaceLabel}
                  </div>
                )}
                {sourceDisplay.sourceLabel && (
                  <div style={{ fontSize: 12, color: "#334155", fontWeight: 600, marginBottom: 4 }}>
                    {sourceDisplay.sourceLabel}
                  </div>
                )}
                {sourceDisplay.snippet && (
                  <div style={contextStyle}>
                    {visibleSnippet}
                  </div>
                )}
                {snippetLong && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      toggleExpandedContext(entry.id)
                    }}
                    style={{
                      border: "none",
                      background: "none",
                      color: "#2563eb",
                      borderRadius: 0,
                      padding: 0,
                      marginBottom: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {isContextExpanded ? t("vocabulary_contextShowLess") : t("vocabulary_contextShowMore")}
                  </button>
                )}
                {entry.note && expandedId !== entry.id && (
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                    Note: {entry.note.length > 80 ? `${entry.note.slice(0, 80)}...` : entry.note}
                  </div>
                )}
                {(entry.tags ?? []).length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                    {entry.tags!.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: 11,
                          background: "rgba(99, 102, 241, 0.08)",
                          color: "#6366f1",
                          borderRadius: 999,
                          padding: "1px 8px",
                          fontWeight: 500,
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {expandedId === entry.id && (
                <div style={{ marginTop: 8, borderTop: "1px solid #f1f5f9", paddingTop: 8 }}>
                  {(sourceDisplay.sourceContext?.pageTitle || sourceDisplay.sourceContext?.sentenceText || sourceDisplay.articleExcerpt || sourceDisplay.contentSummary || sourceDisplay.pageUrl || sourceDisplay.hostname) && (
                    <div
                      style={{
                        marginBottom: 10,
                        padding: "8px 10px",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                        {t("vocabulary_sourceContextTitle")}
                      </div>
                      {sourceDisplay.sourceContext?.pageTitle && (
                        <div style={{ fontSize: 12, color: "#334155", fontWeight: 600, marginBottom: 4 }}>
                          {sourceDisplay.sourceContext.pageTitle}
                        </div>
                      )}
                      {sourceDisplay.hostname && (
                        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                          {t("vocabulary_sourceHostLabel")} {sourceDisplay.hostname}
                        </div>
                      )}
                      {sourceDisplay.pageUrl && (
                        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, wordBreak: "break-all" }}>
                          {/^https?:\/\//i.test(sourceDisplay.pageUrl) ? t("vocabulary_sourceUrlLabel") : t("vocabulary_sourceFileLabel")} {sourceDisplay.pageUrl}
                        </div>
                      )}
                      {sourceDisplay.sourceContext?.sentenceText && (
                        <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5, marginBottom: 4 }}>
                          {t("vocabulary_sourceSentenceLabel")} {sourceDisplay.sourceContext.sentenceText}
                        </div>
                      )}
                      {sourceDisplay.articleExcerpt && (
                        <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, whiteSpace: "pre-wrap", marginBottom: 4 }}>
                          {t("vocabulary_sourceExcerptLabel")} {sourceDisplay.articleExcerpt}
                        </div>
                      )}
                      {sourceDisplay.contentSummary && (
                        <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                          {t("vocabulary_sourceSummaryLabel")} {sourceDisplay.contentSummary}
                        </div>
                      )}
                    </div>
                  )}
                  {linkedReadingItem && (
                    <div
                      style={{
                        marginBottom: 10,
                        padding: "8px 10px",
                        background: "rgba(99, 102, 241, 0.05)",
                        border: "1px solid rgba(99, 102, 241, 0.15)",
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                        {t("vocabulary_readingAssetTitle")}
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
                          style={sortButtonStyle(false)}
                          onClick={(e) => {
                            e.stopPropagation()
                            void openReadingItem(linkedReadingItem)
                          }}
                        >
                          {t("vocabulary_actionResumeReadingAsset")}
                        </button>
                      )}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                    {entry.sourceContext?.surface === "popup_deep_read" && (
                      <button
                        type="button"
                        data-testid={`vocab-open-deep-read-${entry.id}`}
                        style={learningActionButtonStyle}
                        onClick={(e) => {
                          e.stopPropagation()
                          void openVocabularyEntryInDeepRead(entry)
                        }}
                      >
                        {t("vocabulary_actionOpenDeepRead")}
                      </button>
                    )}
                    <button
                      type="button"
                      data-testid={`vocab-explain-entry-${entry.id}`}
                      style={learningActionButtonStyle}
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleExplainEntry(entry)
                      }}
                    >
                      {explainingEntryId === entry.id ? t("actionExplaining") : t("actionExplain")}
                    </button>
                    <button
                      type="button"
                      data-testid={`vocab-speak-entry-${entry.id}`}
                      style={learningActionButtonStyle}
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleSpeakEntry(entry)
                      }}
                    >
                      {speakingEntryId === entry.id
                        ? t("vocabulary_actionStopListening")
                        : (entry.sourceContext?.sentenceText ? t("vocabulary_actionListenSentence") : t("vocabulary_actionListenWord"))}
                    </button>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>
                      {t("vocabulary_noteLabel")}
                    </label>
                    <textarea
                      style={{
                        width: "100%",
                        minHeight: 60,
                        padding: "6px 10px",
                        fontSize: 13,
                        border: "1px solid #e2e8f0",
                        borderRadius: 6,
                        resize: "vertical",
                        fontFamily: "inherit",
                        boxSizing: "border-box",
                        outline: "none",
                      }}
                      placeholder={t("vocabulary_notePlaceholder")}
                      defaultValue={entry.note ?? ""}
                      maxLength={1000}
                      onBlur={(e) => void handleNoteChange(entry.id, e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>
                      {t("vocabulary_tagsLabel")}
                    </label>
                    <input
                      type="text"
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        fontSize: 13,
                        border: "1px solid #e2e8f0",
                        borderRadius: 6,
                        fontFamily: "inherit",
                        boxSizing: "border-box",
                        outline: "none",
                      }}
                      placeholder={t("vocabulary_tagsPlaceholder")}
                      defaultValue={(entry.tags ?? []).join(", ")}
                      onBlur={(e) => void handleTagsChange(entry.id, e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div style={metaRowStyle}>
                <div style={metaStyle}>
                  {(() => {
                    const sourcePageUrl = /^https?:\/\//i.test(sourceDisplay.pageUrl) ? sourceDisplay.pageUrl.trim() : ""
                    return (
                      <>
                        {entry.hostname && (
                          <span>{entry.hostname} &middot; </span>
                        )}
                        {sourcePageUrl && (
                          <a
                            href={sourcePageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "#94a3b8", textDecoration: "underline" }}
                          >
                            source
                          </a>
                        )}
                        {sourcePageUrl && (
                          <>
                            {" · "}
                            <button
                              type="button"
                              data-testid={`vocab-open-source-${entry.id}`}
                              style={{
                                border: "none",
                                background: "none",
                                padding: 0,
                                color: "#6366f1",
                                textDecoration: "underline",
                                cursor: "pointer",
                                fontSize: "inherit",
                                fontFamily: "inherit",
                              }}
                              onClick={(e) => {
                                e.stopPropagation()
                                recordLearningLoopEvent("returned_to_source", {
                                  pageUrl: sourcePageUrl,
                                  source: "vocabulary",
                                })
                                void browser.tabs.create({ url: sourcePageUrl })
                              }}
                            >
                              {t("review_openSourcePage")}
                            </button>
                          </>
                        )}
                        {(entry.hostname || sourcePageUrl) && <span> &middot; </span>}
                        <span>{formatDate(entry.savedAt)}</span>
                      </>
                    )
                  })()}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {confirmDeleteId === entry.id ? (
                    <>
                      <button
                        type="button"
                        style={confirmBtnStyle}
                        onClick={() => void handleDelete(entry.id)}
                      >
                        {t("vocabulary_deleteConfirm")}
                      </button>
                      <button
                        type="button"
                        style={{ ...deleteBtnStyle, color: "#64748b", background: "rgba(100,116,139,0.08)" }}
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        {t("vocabulary_deleteCancel")}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      style={deleteBtnStyle}
                      onClick={() => setConfirmDeleteId(entry.id)}
                    >
                      {t("vocabulary_deleteAction")}
                    </button>
                  )}
                </div>
              </div>
                  </>
                )
              })()}
            </div>
          ))}
        </>
      )}

      {activeTab === "reading" && (
        <>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 0, marginBottom: 8 }}>
            {t("vocabulary_readingIntro")}
          </p>
          <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 0, marginBottom: 16 }}>
            {getReadingViewHint(readingSubTab)}
          </p>
          <div style={{ ...toolbarStyle, marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: "#64748b", marginRight: 4 }}>{t("vocabulary_viewLabel")}</span>
            <button
              type="button"
              data-testid="reading-view-recent"
              style={sortButtonStyle(readingSubTab === "recent")}
              onClick={() => setReadingSubTab("recent")}
            >
              {getReadingViewLabel("recent")} ({readingCounts.recent})
            </button>
            <button
              type="button"
              data-testid="reading-view-saved"
              style={sortButtonStyle(readingSubTab === "saved")}
              onClick={() => setReadingSubTab("saved")}
            >
              {getReadingViewLabel("saved")} ({readingCounts.saved})
            </button>
            <button
              type="button"
              data-testid="reading-view-in-progress"
              style={sortButtonStyle(readingSubTab === "in_progress")}
              onClick={() => setReadingSubTab("in_progress")}
            >
              {getReadingViewLabel("in_progress")} ({readingCounts.in_progress})
            </button>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: "#64748b", marginRight: 4 }}>{t("vocabulary_sortLabel")}</span>
            <button
              type="button"
              data-testid="reading-sort-opened"
              style={sortButtonStyle(readingSortMode === "opened")}
              onClick={() => setReadingSortMode("opened")}
            >
              {t("vocabulary_readingSortOpened")}
            </button>
            <button
              type="button"
              data-testid="reading-sort-title"
              style={sortButtonStyle(readingSortMode === "title")}
              onClick={() => setReadingSortMode("title")}
            >
              {t("vocabulary_readingSortTitle")}
            </button>
          </div>

          {readingFiltered.length === 0 ? (
            <div style={emptyStyle}>
              {readingSubTab === "recent"
                ? t("vocabulary_readingEmptyRecent")
                : readingSubTab === "saved"
                  ? t("vocabulary_readingEmptySaved")
                  : t("vocabulary_readingEmptyInProgress")}
            </div>
          ) : (
            readingFiltered.map((item) => {
              const articleSummary = readingArticleSummaries[item.id]
              const translatedLabel = formatWordsTranslated(articleSummary?.wordsTranslated ?? null)
              const resumeTarget = buildOwnedReadingResumeTarget(item)
              const sourceTypeLabel = getOwnedReadingSourceTypeLabel(item.sourceType)
              const progressLabel = describeOwnedReadingProgress(item)

              return (
            <div key={item.id} style={cardStyle}>
                <div style={wordStyle}>{item.title}</div>
                <div style={{ ...metaStyle, marginBottom: 8 }}>
                  <span style={{ textTransform: "capitalize" }}>{item.status.replace("_", " ")}</span>
                  {" · "}
                  <span>{formatDate(item.openedAt)}</span>
                  {" · "}
                  <span>{sourceTypeLabel}</span>
                </div>
                <div style={{ fontSize: 11, color: resumeTarget?.requiresFileSelection ? "#92400e" : "#2563eb", marginBottom: progressLabel ? 4 : 8, fontWeight: 600 }}>
                  Resume: {describeOwnedReadingResumeBehavior(item)}
                </div>
                {progressLabel && (
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
                    {progressLabel}
                  </div>
                )}
                {articleSummary && (
                  <div
                    style={{
                      marginBottom: 8,
                      padding: "8px 10px",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                    }}
                  >
                    {articleSummary.hostname && (
                      <div style={{ fontSize: 11, color: "#334155", fontWeight: 600, marginBottom: 4 }}>
                        Host: {articleSummary.hostname}
                      </div>
                    )}
                    {articleSummary.pageUrl && (
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, wordBreak: "break-all" }}>
                        Page: {articleSummary.pageUrl}
                      </div>
                    )}
                    {translatedLabel && (
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                        Translated: {translatedLabel}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "#334155", marginBottom: 4 }}>
                      Study loop: {formatReadingStepTrail(articleSummary.progress.completedSteps)}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                      Counts: {formatReadingCounts(articleSummary.progress.currentCounts)}
                    </div>
                    <div style={{ fontSize: 11, color: "#2563eb", fontWeight: 600 }}>
                      Next: {getReadingNextStepHint(articleSummary.progress.nextStep)}
                    </div>
                  </div>
                )}
                <div style={{ ...metaRowStyle, marginTop: 8 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <button
                      type="button"
                      style={sortButtonStyle(false)}
                      onClick={() => void openReadingItem(item)}
                      disabled={!resumeTarget}
                    >
                      Resume
                    </button>
                    <button
                      type="button"
                      style={sortButtonStyle(false)}
                      onClick={() => void handleReadingStatus(item.id, "in_progress")}
                    >
                      In progress
                    </button>
                    <button
                      type="button"
                      style={sortButtonStyle(false)}
                      onClick={() => void handleReadingStatus(item.id, "saved")}
                    >
                      Saved
                    </button>
                    <button
                      type="button"
                      style={sortButtonStyle(false)}
                      onClick={() => void handleReadingStatus(item.id, "archived")}
                    >
                      Archive
                    </button>
                  </div>
                  <button type="button" style={deleteBtnStyle} onClick={() => void handleRemoveReading(item.id)}>
                    Remove
                  </button>
                </div>
              </div>
            )})
          )}
        </>
      )}
    </div>
  )
}
