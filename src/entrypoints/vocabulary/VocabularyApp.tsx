import { useEffect, useState } from "react"
import type { VocabularyEntry } from "@/utils/storage/vocabulary"
import {
  getVocabularyEntries,
  removeVocabularyEntry,
  getDueVocabularyCount,
} from "@/utils/storage/vocabulary"
import ReviewMode from "./ReviewMode"

type ActiveTab = "list" | "review"
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
  return params.get("tab") === "review" ? "review" : "list"
}

export default function VocabularyApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(getInitialTab)
  const [entries, setEntries] = useState<VocabularyEntry[]>([])
  const [search, setSearch] = useState("")
  const [sortMode, setSortMode] = useState<SortMode>("time")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [dueCount, setDueCount] = useState(0)

  const loadEntries = async () => {
    const [data, due] = await Promise.all([
      getVocabularyEntries(),
      getDueVocabularyCount(),
    ])
    setEntries(data)
    setDueCount(due)
    setLoading(false)
  }

  useEffect(() => {
    void loadEntries()
  }, [activeTab])

  const handleDelete = async (id: string) => {
    await removeVocabularyEntry(id)
    setConfirmDeleteId(null)
    await loadEntries()
  }

  const filtered = entries.filter((e) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      e.text.toLowerCase().includes(q)
      || (e.translation?.toLowerCase().includes(q) ?? false)
      || (e.context?.toLowerCase().includes(q) ?? false)
    )
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === "alpha") {
      return a.text.localeCompare(b.text)
    }
    return b.savedAt - a.savedAt
  })

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

  if (loading) {
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
      </div>

      {activeTab === "review" && <ReviewMode />}

      {activeTab === "list" && (
        <>
          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Search words, translations, or context..."
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

          {sorted.length === 0 && (
            <div style={emptyStyle}>
              {search
                ? "No words match your search."
                : "No vocabulary saved yet. Use the Save button when translating to add words here."}
            </div>
          )}

          {sorted.map((entry) => (
            <div key={entry.id} style={cardStyle}>
              <div style={wordStyle}>{entry.text}</div>
              {entry.translation && (
                <div style={translationStyle}>{entry.translation}</div>
              )}
              {entry.context && (
                <div style={contextStyle}>
                  {entry.context.length > 200
                    ? `${entry.context.slice(0, 200)}...`
                    : entry.context}
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
            </div>
          ))}
        </>
      )}
    </div>
  )
}
