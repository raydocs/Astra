/**
 * Astra ePub Reader — bilingual ePub translation.
 *
 * Opens ePub files via drag-and-drop, renders chapters using epub.js,
 * and injects bilingual translations into each paragraph.
 */

import { useState, useCallback, useRef, useEffect } from "react"
import ePub from "epubjs"
import type Book from "epubjs/types/book"
import type { NavItem } from "epubjs/types/navigation"
import { browser } from "#imports"
import type { RuntimeResponse } from "@/types/messages"
import { upsertOwnedEpubFromImport } from "@/utils/storage/owned-reading"
import {
  consumeDocumentFileHandoff,
  describeDocumentFileHandoffFailure,
  DOCUMENT_FILE_HANDOFF_FAILURE_QUERY_PARAM,
  DOCUMENT_FILE_HANDOFF_QUERY_PARAM,
  readDocumentFileBytes,
  type DocumentFileHandoffFailureReason,
} from "@/utils/reading/document-file-handoff"

type Phase = "idle" | "loading" | "reading" | "error"

interface ChapterContent {
  title: string
  href: string
  paragraphs: string[]
  translations: Map<number, string>
  translating: boolean
}

const BATCH_SIZE = 8

function coerceHandoffFailureReason(value: string | null): DocumentFileHandoffFailureReason | null {
  if (value === "invalid" || value === "missing" || value === "expired" || value === "oversize" || value === "corrupt" || value === "storage_error") {
    return value
  }
  return null
}

async function getTargetLang(): Promise<string> {
  try {
    const result = await browser.storage.local.get("astra.config.v1")
    const config = result["astra.config.v1"] as { targetLang?: string } | undefined
    return config?.targetLang ?? "zh-CN"
  } catch {
    return "zh-CN"
  }
}

export function EpubReaderApp() {
  const [phase, setPhase] = useState<Phase>("idle")
  const [error, setError] = useState<string | null>(null)
  const [reopenBanner, setReopenBanner] = useState<string | null>(null)
  const [bookTitle, setBookTitle] = useState("")
  const [toc, setToc] = useState<NavItem[]>([])
  const [chapter, setChapter] = useState<ChapterContent | null>(null)
  const bookRef = useRef<Book | null>(null)
  const chapterGenRef = useRef(0)
  const epubImportFileNameRef = useRef<string>("book.epub")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const hint = params.get("reopenHint")
    const handoffToken = params.get(DOCUMENT_FILE_HANDOFF_QUERY_PARAM)
    const handoffFailure = coerceHandoffFailureReason(params.get(DOCUMENT_FILE_HANDOFF_FAILURE_QUERY_PARAM))

    if (handoffToken) {
      void consumeDocumentFileHandoff(handoffToken, "epub").then(async (result) => {
        if (result.ok) {
          setReopenBanner(`Opened ${result.file.name} from Document Intake local handoff. File bytes stayed on this device and were not synced.`)
          const bytes = await readDocumentFileBytes(result.file)
          const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
          await loadBook(arrayBuffer, result.file.name)
          return
        }
        setReopenBanner(describeDocumentFileHandoffFailure(result.reason, hint))
      })
      return
    }

    if (handoffFailure) {
      setReopenBanner(describeDocumentFileHandoffFailure(handoffFailure, hint))
    } else if (hint) {
      setReopenBanner(decodeURIComponent(hint))
    }
  }, [])

  const loadBook = async (data: ArrayBuffer, fileName?: string) => {
    try {
      setPhase("loading")
      bookRef.current?.destroy()
      const book = ePub(data)
      bookRef.current = book

      await book.ready
      const resolvedTitle = book.packaging?.metadata?.title ?? "Untitled"
      setBookTitle(resolvedTitle)

      const nav = await book.loaded.navigation
      setToc(nav.toc)
      setPhase("reading")

      const safeFile = fileName?.trim() || "book.epub"
      epubImportFileNameRef.current = safeFile
      void upsertOwnedEpubFromImport({
        fileName: safeFile,
        bookTitle: resolvedTitle,
        chapterHref: nav.toc[0]?.href ?? null,
        status: "in_progress",
      })

      // Auto-open first chapter
      if (nav.toc.length > 0) {
        void openChapter(book, nav.toc[0])
      }
    } catch (err) {
      setPhase("error")
      setError(err instanceof Error ? err.message : "Failed to load ePub")
    }
  }

  const openChapter = async (book: Book, item: NavItem) => {
    try {
      chapterGenRef.current += 1
      const gen = chapterGenRef.current

      const section = book.spine.get(item.href)
      if (!section) return

      await section.load(book.load.bind(book))
      const doc = section.document
      if (!doc) return

      const paragraphs: string[] = []
      const textEls = doc.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, blockquote, td")
      textEls.forEach((el) => {
        const text = el.textContent?.trim()
        if (text && text.length >= 3) {
          paragraphs.push(text)
        }
      })

      const chapterContent: ChapterContent = {
        title: item.label?.trim() ?? "Chapter",
        href: item.href,
        paragraphs,
        translations: new Map(),
        translating: true,
      }
      setChapter(chapterContent)

      const metaTitle = bookRef.current?.packaging?.metadata?.title ?? (bookTitle || "Untitled")
      void upsertOwnedEpubFromImport({
        fileName: epubImportFileNameRef.current,
        bookTitle: metaTitle,
        chapterHref: item.href,
        status: "in_progress",
      })

      // Translate in batches (abort if chapter changed)
      for (let i = 0; i < paragraphs.length; i += BATCH_SIZE) {
        if (chapterGenRef.current !== gen) return
        const batch = paragraphs.slice(i, i + BATCH_SIZE)
        try {
          const response: RuntimeResponse = await browser.runtime.sendMessage({
            type: "runtime/translate-batch",
            payload: { texts: batch, targetLang: await getTargetLang(), task: "translate" },
          })

          if (response.type === "runtime/translate-batch:success" && chapterGenRef.current === gen) {
            setChapter((prev) => {
              if (!prev || prev.href !== item.href) return prev
              const next = new Map(prev.translations)
              batch.forEach((_, j) => {
                next.set(i + j, response.payload.translations[j])
              })
              return { ...prev, translations: next }
            })
          }
        } catch {
          // Skip failed batch
        }
      }

      setChapter((prev) => prev ? { ...prev, translating: false } : prev)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open chapter")
    }
  }

  const handleFileDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file?.name.endsWith(".epub")) {
      void readDocumentFileBytes(file).then((bytes) => {
        const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
        return loadBook(arrayBuffer, file.name)
      })
    }
  }, [])

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      void readDocumentFileBytes(file).then((bytes) => {
        const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
        return loadBook(arrayBuffer, file.name)
      })
    }
  }, [])

  // Cleanup
  useEffect(() => {
    return () => { bookRef.current?.destroy() }
  }, [])

  return (
    <div className="astra-container astra-container--wide" style={containerStyle}>
      <header style={headerStyle}>
        <h1 style={{ margin: 0, fontSize: 18, color: "var(--astra-brand)" }}>Astra ePub Reader</h1>
        {bookTitle && <span style={{ fontSize: 13, color: "#64748b" }}>{bookTitle}</span>}
      </header>

      {reopenBanner && (
        <div
          role="status"
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            fontSize: 13,
            color: "#1e40af",
            background: "rgba(99, 102, 241, 0.12)",
            borderRadius: 8,
            border: "1px solid rgba(99, 102, 241, 0.35)",
          }}
        >
          {reopenBanner}
        </div>
      )}

      {phase === "idle" && (
        <label
          htmlFor="astra-epub-reader-file-input"
          className="astra-drop-zone-cursor astra-reader-drop-zone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
        >
          <input
            id="astra-epub-reader-file-input"
            type="file"
            accept=".epub"
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />
          <div className="astra-reader-drop-zone__content">
            <div className="astra-reader-drop-zone__icon" aria-hidden="true">EPUB</div>
            <div className="astra-reader-drop-zone__eyebrow">Chapter-by-chapter translation</div>
            <div className="astra-reader-drop-zone__title">Drop an ePub file here</div>
            <div className="astra-reader-drop-zone__description">
              or click to select. Astra will open the table of contents, translate readable passages, and keep your place by chapter.
            </div>
            <div className="astra-reader-drop-zone__chips" aria-label="Supported file type">
              <span className="astra-reader-drop-zone__chip">EPUB</span>
              <span className="astra-reader-drop-zone__chip">Chapters</span>
            </div>
          </div>
        </label>
      )}

      {phase === "error" && (
        <div style={{ padding: 24, color: "#b45309", textAlign: "center" }}>{error}</div>
      )}

      {phase === "loading" && (
      <div style={{ padding: 24, textAlign: "center", color: "var(--astra-brand)" }}>Loading ePub...</div>
      )}

      {phase === "reading" && (
        <div style={{ display: "flex", gap: 16 }}>
          {/* Table of Contents sidebar */}
          <nav style={tocStyle}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: "var(--astra-brand)" }}>Contents</div>
            {toc.map((item) => (
              <button
                key={item.href}
                type="button"
                className="astra-cursor-pointer"
                onClick={() => bookRef.current && void openChapter(bookRef.current, item)}
                style={{
                  ...tocItemStyle,
                  fontWeight: chapter?.href === item.href ? 600 : 400,
                  color: chapter?.href === item.href ? "var(--astra-brand)" : "#334155",
                }}
              >
                {item.label?.trim()}
              </button>
            ))}
          </nav>

          {/* Chapter content */}
          <main style={contentStyle}>
            {chapter && (
              <>
                <h2 style={{ fontSize: 20, color: "#1e293b", marginBottom: 16 }}>{chapter.title}</h2>
                {chapter.translating && (
                  <div style={{ fontSize: 12, color: "var(--astra-brand)", marginBottom: 12 }}>Translating...</div>
                )}
                {chapter.paragraphs.map((para, i) => (
                  <div key={i} style={blockStyle}>
                    <div style={sourceStyle}>{para}</div>
                    {chapter.translations.has(i) ? (
                      <div style={translationStyle}>{chapter.translations.get(i)}</div>
                    ) : chapter.translating ? (
                      <div style={{ fontSize: 13, color: "var(--astra-text-hint)" }}>...</div>
                    ) : null}
                  </div>
                ))}
              </>
            )}
          </main>
        </div>
      )}
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  margin: "0 auto",
  padding: 16,
}

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 0",
  borderBottom: "1px solid var(--astra-border)",
  marginBottom: 16,
}

const tocStyle: React.CSSProperties = {
  width: 220,
  flexShrink: 0,
  borderRight: "1px solid var(--astra-border)",
  paddingRight: 12,
  maxHeight: "80vh",
  overflowY: "auto",
}

const tocItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  border: "none",
  background: "transparent",
  padding: "6px 4px",
  fontSize: 13,
  borderRadius: 4,
}

const contentStyle: React.CSSProperties = {
  flex: 1,
  maxWidth: 700,
  maxHeight: "80vh",
  overflowY: "auto",
  paddingRight: 16,
}

const blockStyle: React.CSSProperties = {
  marginBottom: 16,
}

const sourceStyle: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.8,
  color: "#1e293b",
}

const translationStyle: React.CSSProperties = {
  fontSize: "var(--astra-text-base)",
  lineHeight: 1.6,
  color: "var(--astra-brand)",
  marginTop: 4,
  paddingLeft: 8,
  borderLeft: "2px solid var(--astra-brand)",
}
