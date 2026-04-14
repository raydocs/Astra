import { useEffect, useState } from "react"
import { browser } from "#imports"
import type { VocabularyEntry } from "@/utils/storage/vocabulary"
import {
  getVocabularyEntries,
  removeVocabularyEntry,
  getDueVocabularyCount,
  updateVocabularyEntry,
} from "@/utils/storage/vocabulary"
import { getPageStudyProgress } from "@/utils/storage/study-progress"
import type { OwnedReadingItem, OwnedReadingStatus } from "@/utils/storage/owned-reading"
import {
  listOwnedReadingItems,
  markOwnedReadingOpened,
  removeOwnedReadingItem,
  setOwnedReadingStatus,
  syncRecentReadingHistoryToOwnedQueue,
} from "@/utils/storage/owned-reading"
import ReviewMode from "./ReviewMode"

type ActiveTab = "list" | "review" | "reading"
type ReadingSubTab = "recent" | "saved" | "in_progress"
type SortMode = "time" | "alpha"

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

function getEntrySourceSurfaceLabel(entry: VocabularyEntry): string | null {
  switch (entry.sourceContext?.surface) {
    case "popup_deep_read":
      return "Popup deep-read"
    case "selection_toolbar":
      return "Selection toolbar"
    case "hover_translate":
      return "Hover translate"
    default:
      return null
  }
}

function getEntrySourceLabel(entry: VocabularyEntry): string {
  return entry.sourceContext?.pageTitle
    ?? entry.hostname
    ?? entry.url
    ?? ""
}

function getEntrySourceSnippet(entry: VocabularyEntry): string {
  return entry.sourceContext?.sentenceText
    ?? entry.context
    ?? entry.sourceContext?.articleExcerpt
    ?? entry.sourceContext?.contentSummary
    ?? ""
}

function readerHtmlPath(item: OwnedReadingItem): "/pdf-reader.html" | "/epub-reader.html" | "/subtitle-reader.html" | null {
  if (item.sourceType === "pdf") return "/pdf-reader.html"
  if (item.sourceType === "epub") return "/epub-reader.html"
  if (item.sourceType === "subtitle-file") return "/subtitle-reader.html"
  return null
}

export default function VocabularyApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(getInitialTab)
  const [readingSubTab, setReadingSubTab] = useState<ReadingSubTab>("recent")
  const [readingItems, setReadingItems] = useState<OwnedReadingItem[]>([])
  const [readingLoading, setReadingLoading] = useState(() => getInitialTab() === "reading")
  const [entries, setEntries] = useState<VocabularyEntry[]>([])
  const [search, setSearch] = useState("")
  const [sortMode, setSortMode] = useState<SortMode>("time")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [dueCount, setDueCount] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null)
  const [readingStudyHints, setReadingStudyHints] = useState<Record<string, string>>({})

  const loadEntries = async () => {
    const [data, due] = await Promise.all([
      getVocabularyEntries(),
      getDueVocabularyCount(),
    ])
    setEntries(data)
    setDueCount(due)
    setLoading(false)
  }

  const loadReadingQueue = async () => {
    setReadingLoading(true)
    await syncRecentReadingHistoryToOwnedQueue()
    const items = await listOwnedReadingItems()
    setReadingItems(items)
    const hints: Record<string, string> = {}
    for (const row of items) {
      const key = row.studyProgressRecordId ?? row.sourceUrl ?? null
      if (!key || row.sourceType !== "article") continue
      const page = await getPageStudyProgress(key)
      if (!page?.completedSteps?.length) continue
      hints[row.id] = page.completedSteps.join(" → ")
    }
    setReadingStudyHints(hints)
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

  const readingFiltered = [...readingItems]
    .filter((row) => {
      if (readingSubTab === "recent") return true
      if (readingSubTab === "saved") return row.status === "saved"
      return row.status === "in_progress"
    })
    .sort((a, b) => b.openedAt - a.openedAt)

  const openReadingItem = async (item: OwnedReadingItem) => {
    await markOwnedReadingOpened(item.id)

    if (item.sourceType === "article") {
      const raw = item.sourceUrl?.trim()
      if (!raw) return
      void browser.tabs.create({ url: raw })
      void loadReadingQueue()
      return
    }

    const readerPath = readerHtmlPath(item)
    if (!readerPath) return

    const base = browser.runtime.getURL(readerPath)
    const params = new URLSearchParams()
    if (item.sourceType === "pdf" && item.sourceUrl?.startsWith("http")) {
      params.set("url", item.sourceUrl)
    }
    if (item.reopenHint) {
      params.set("reopenHint", item.reopenHint)
    }
    const qs = params.toString()
    void browser.tabs.create({ url: qs ? `${base}?${qs}` : base })
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
          Astra Vocabulary
        </h1>
        <span style={countBadgeStyle}>{entries.length} {entries.length === 1 ? "word" : "words"}</span>
      </div>

      <div style={tabBarStyle}>
        <button type="button" style={tabStyle(activeTab === "list")} onClick={() => setActiveTab("list")}>
          Word List
        </button>
        <button type="button" style={tabStyle(activeTab === "review")} onClick={() => setActiveTab("review")}>
          Review {dueCount > 0 ? `(${dueCount})` : ""}
        </button>
        <button type="button" style={tabStyle(activeTab === "reading")} onClick={() => setActiveTab("reading")}>
          Reading
        </button>
      </div>

      {activeTab === "review" && <ReviewMode />}

      {activeTab === "list" && (
        <>
          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Search words, translations, notes, tags, or source (title, URL, excerpt)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={searchInputStyle}
            />
          </div>

          <div style={toolbarStyle}>
            <span style={{ fontSize: 12, color: "#64748b", marginRight: 4 }}>Sort:</span>
            <button
              type="button"
              style={sortButtonStyle(sortMode === "time")}
              onClick={() => setSortMode("time")}
            >
              Newest first
            </button>
            <button
              type="button"
              style={sortButtonStyle(sortMode === "alpha")}
              onClick={() => setSortMode("alpha")}
            >
              A-Z
            </button>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              style={exportButtonStyle}
              onClick={() => exportCSV(sorted)}
              disabled={sorted.length === 0}
            >
              Export CSV
            </button>
            <button
              type="button"
              style={exportButtonStyle}
              onClick={() => exportAnkiTSV(sorted)}
              disabled={sorted.length === 0}
            >
              Export Anki TSV
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
                ? "No words match your search."
                : "No vocabulary saved yet. Use the Save button when translating to add words here."}
            </div>
          )}

          {sorted.map((entry) => (
            <div key={entry.id} style={cardStyle}>
              {(() => {
                const sourceSurfaceLabel = getEntrySourceSurfaceLabel(entry)
                const sourceLabel = getEntrySourceLabel(entry)
                const sourceSnippet = getEntrySourceSnippet(entry)

                return (
                  <>
              <div
                style={{ cursor: "pointer" }}
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              >
                <div style={wordStyle}>{entry.text}</div>
                {entry.translation && (
                  <div style={translationStyle}>{entry.translation}</div>
                )}
                {sourceSurfaceLabel && (
                  <div style={{ fontSize: 11, color: "#6366f1", fontWeight: 700, marginBottom: 4 }}>
                    {sourceSurfaceLabel}
                  </div>
                )}
                {sourceLabel && (
                  <div style={{ fontSize: 12, color: "#334155", fontWeight: 600, marginBottom: 4 }}>
                    {sourceLabel}
                  </div>
                )}
                {sourceSnippet && (
                  <div style={contextStyle}>
                    {sourceSnippet.length > 200
                      ? `${sourceSnippet.slice(0, 200)}...`
                      : sourceSnippet}
                  </div>
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
                  {(entry.sourceContext?.pageTitle || entry.sourceContext?.sentenceText || entry.sourceContext?.articleExcerpt || entry.sourceContext?.contentSummary) && (
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
                        Source context
                      </div>
                      {entry.sourceContext?.pageTitle && (
                        <div style={{ fontSize: 12, color: "#334155", fontWeight: 600, marginBottom: 4 }}>
                          {entry.sourceContext.pageTitle}
                        </div>
                      )}
                      {entry.sourceContext?.sentenceText && (
                        <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5, marginBottom: 4 }}>
                          Sentence: {entry.sourceContext.sentenceText}
                        </div>
                      )}
                      {entry.sourceContext?.articleExcerpt && entry.sourceContext.articleExcerpt !== entry.sourceContext.sentenceText && (
                        <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                          Excerpt: {entry.sourceContext.articleExcerpt}
                        </div>
                      )}
                      {!entry.sourceContext?.articleExcerpt && entry.sourceContext?.contentSummary && (
                        <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                          Summary: {entry.sourceContext.contentSummary}
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>
                      Note
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
                      placeholder="Add note..."
                      defaultValue={entry.note ?? ""}
                      maxLength={1000}
                      onBlur={(e) => void handleNoteChange(entry.id, e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>
                      Tags
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
                      placeholder="Add tags (comma-separated)..."
                      defaultValue={(entry.tags ?? []).join(", ")}
                      onBlur={(e) => void handleTagsChange(entry.id, e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div style={metaRowStyle}>
                <div style={metaStyle}>
                  {entry.hostname && (
                    <span>{entry.hostname} &middot; </span>
                  )}
                  {entry.url && (
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#94a3b8", textDecoration: "underline" }}
                    >
                      source
                    </a>
                  )}
                  {(entry.hostname || entry.url) && <span> &middot; </span>}
                  <span>{formatDate(entry.savedAt)}</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {confirmDeleteId === entry.id ? (
                    <>
                      <button
                        type="button"
                        style={confirmBtnStyle}
                        onClick={() => void handleDelete(entry.id)}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        style={{ ...deleteBtnStyle, color: "#64748b", background: "rgba(100,116,139,0.08)" }}
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      style={deleteBtnStyle}
                      onClick={() => setConfirmDeleteId(entry.id)}
                    >
                      Delete
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
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 0, marginBottom: 16 }}>
            Revisit pages you translated. Recent merges from reading history; use Saved / In progress to organize.
          </p>
          <div style={{ ...toolbarStyle, marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: "#64748b", marginRight: 4 }}>View:</span>
            <button
              type="button"
              style={sortButtonStyle(readingSubTab === "recent")}
              onClick={() => setReadingSubTab("recent")}
            >
              Recent
            </button>
            <button
              type="button"
              style={sortButtonStyle(readingSubTab === "saved")}
              onClick={() => setReadingSubTab("saved")}
            >
              Saved
            </button>
            <button
              type="button"
              style={sortButtonStyle(readingSubTab === "in_progress")}
              onClick={() => setReadingSubTab("in_progress")}
            >
              In progress
            </button>
          </div>

          {readingFiltered.length === 0 ? (
            <div style={emptyStyle}>
              {readingSubTab === "recent"
                ? "No reading items yet. Translate a page in the browser to populate history."
                : readingSubTab === "saved"
                  ? "Nothing marked as saved. Open Recent and mark an item as saved."
                  : "Nothing in progress. Mark a page as in progress from Recent or Saved."}
            </div>
          ) : (
            readingFiltered.map((item) => (
              <div key={item.id} style={cardStyle}>
                <div style={wordStyle}>{item.title}</div>
                <div style={{ ...metaStyle, marginBottom: 8 }}>
                  <span style={{ textTransform: "capitalize" }}>{item.status.replace("_", " ")}</span>
                  {" · "}
                  <span>{formatDate(item.openedAt)}</span>
                  {item.sourceType !== "article" && (
                    <>
                      {" · "}
                      <span>{item.sourceType}</span>
                    </>
                  )}
                </div>
                {readingStudyHints[item.id] && (
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>
                    Study: {readingStudyHints[item.id]}
                  </div>
                )}
                <div style={{ ...metaRowStyle, marginTop: 8 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <button
                      type="button"
                      style={sortButtonStyle(false)}
                      onClick={() => void openReadingItem(item)}
                      disabled={item.sourceType === "article" && !item.sourceUrl?.trim()}
                    >
                      Open
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
            ))
          )}
        </>
      )}
    </div>
  )
}
