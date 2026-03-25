import { useState, useEffect, useCallback, useRef } from "react"
import { createRoot } from "react-dom/client"
import { readConfig } from "@/utils/storage/config"
import { translateTexts } from "@/utils/translate/translate"

// ── Types ──────────────────────────────────────────────────────────────
interface ToolbarPosition {
  top: number
  left: number
}

// ── Styles ─────────────────────────────────────────────────────────────
const BRAND_COLOR = "#6366f1"

const styles = {
  toolbar: (pos: ToolbarPosition): React.CSSProperties => ({
    position: "fixed",
    top: pos.top,
    left: pos.left,
    zIndex: 2147483646,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontSize: "14px",
    lineHeight: "1.5",
  }),
  buttonBar: {
    display: "flex",
    gap: "2px",
    background: "#fff",
    borderRadius: "8px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
    padding: "4px",
  } as React.CSSProperties,
  button: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: "4px 10px",
    borderRadius: "6px",
    fontSize: "13px",
    color: "#374151",
    whiteSpace: "nowrap",
    transition: "background 0.15s, color 0.15s",
  } as React.CSSProperties,
  buttonHover: {
    background: `${BRAND_COLOR}14`,
    color: BRAND_COLOR,
  } as React.CSSProperties,
  resultPanel: {
    marginTop: "6px",
    background: "#fff",
    borderRadius: "8px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
    padding: "10px 14px",
    maxWidth: "400px",
    fontSize: "14px",
    color: "#1f2937",
    lineHeight: "1.6",
    borderLeft: `3px solid ${BRAND_COLOR}`,
    wordBreak: "break-word",
  } as React.CSSProperties,
  dots: {
    color: "#94a3b8",
    animation: "astra-sel-pulse 1.5s ease-in-out infinite",
  } as React.CSSProperties,
}

const KEYFRAMES_CSS = `
@keyframes astra-sel-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
`

// ── Component ──────────────────────────────────────────────────────────
function SelectionToolbarApp() {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<ToolbarPosition>({ top: 0, left: 0 })
  const [selectedText, setSelectedText] = useState("")
  const [translating, setTranslating] = useState(false)
  const [translation, setTranslation] = useState<string | null>(null)
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null)

  const toolbarRef = useRef<HTMLDivElement>(null)
  const skipNextMouseUp = useRef(false)

  const dismiss = useCallback(() => {
    setVisible(false)
    setTranslation(null)
    setTranslating(false)
    setSelectedText("")
  }, [])

  // mouseup → show toolbar near selection end
  useEffect(() => {
    const onMouseUp = (e: MouseEvent) => {
      if (skipNextMouseUp.current) {
        skipNextMouseUp.current = false
        return
      }

      // Ignore clicks inside the toolbar shadow host
      const host = document.getElementById("astra-selection-toolbar-host")
      if (host && (host === e.target || host.contains(e.target as Node))) return

      setTimeout(() => {
        const sel = window.getSelection()
        const text = sel?.toString().trim() ?? ""
        if (!text || !sel || sel.rangeCount === 0) {
          dismiss()
          return
        }

        setSelectedText(text)
        setTranslation(null)
        setTranslating(false)

        // Position near the end of the selection
        const range = sel.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        const top = rect.bottom + 6
        let left = rect.right - 60
        if (left < 4) left = 4
        if (left + 160 > window.innerWidth) left = window.innerWidth - 170

        setPosition({ top, left })
        setVisible(true)
      }, 10)
    }

    document.addEventListener("mouseup", onMouseUp, true)
    return () => document.removeEventListener("mouseup", onMouseUp, true)
  }, [dismiss])

  // click outside → dismiss
  useEffect(() => {
    if (!visible) return

    const onMouseDown = (e: MouseEvent) => {
      const host = document.getElementById("astra-selection-toolbar-host")
      if (host && (host === e.target || host.contains(e.target as Node))) return

      // Check if click is inside shadow DOM
      if (toolbarRef.current?.contains(e.target as Node)) return

      dismiss()
    }

    document.addEventListener("mousedown", onMouseDown, true)
    return () => document.removeEventListener("mousedown", onMouseDown, true)
  }, [visible, dismiss])

  // scroll / resize → dismiss
  useEffect(() => {
    if (!visible) return
    const onScroll = () => dismiss()
    window.addEventListener("scroll", onScroll, true)
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("resize", onScroll)
    }
  }, [visible, dismiss])

  const handleTranslate = async () => {
    if (!selectedText || translating) return
    setTranslating(true)
    setTranslation(null)

    try {
      const config = await readConfig()
      const result = await translateTexts({
        texts: [selectedText],
        targetLang: config.targetLang,
      })

      if (!result.ok) {
        setTranslation(`⚠ ${result.error.message}`)
      } else if (result.translations[0]) {
        setTranslation(result.translations[0])
      } else {
        setTranslation("⚠ 未获取到翻译结果")
      }
    } catch (error: unknown) {
      setTranslation(`⚠ ${error instanceof Error ? error.message : "翻译失败"}`)
    } finally {
      setTranslating(false)
    }
  }

  const handleCopy = async () => {
    const textToCopy = translation ?? selectedText
    try {
      await navigator.clipboard.writeText(textToCopy)
    } catch {
      // fallback
      const ta = document.createElement("textarea")
      ta.value = textToCopy
      ta.style.position = "fixed"
      ta.style.opacity = "0"
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
    }
  }

  if (!visible) return null

  return (
    <div
      ref={toolbarRef}
      style={styles.toolbar(position)}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div style={styles.buttonBar}>
        <button
          style={{
            ...styles.button,
            ...(hoveredBtn === "translate" ? styles.buttonHover : {}),
          }}
          onMouseEnter={() => setHoveredBtn("translate")}
          onMouseLeave={() => setHoveredBtn(null)}
          onClick={(e) => {
            e.stopPropagation()
            skipNextMouseUp.current = true
            void handleTranslate()
          }}
        >
          翻译
        </button>
        <button
          style={{
            ...styles.button,
            ...(hoveredBtn === "copy" ? styles.buttonHover : {}),
          }}
          onMouseEnter={() => setHoveredBtn("copy")}
          onMouseLeave={() => setHoveredBtn(null)}
          onClick={(e) => {
            e.stopPropagation()
            skipNextMouseUp.current = true
            void handleCopy()
          }}
        >
          复制
        </button>
      </div>

      {(translating || translation !== null) && (
        <div style={styles.resultPanel}>
          {translating ? (
            <span style={styles.dots}>⋯</span>
          ) : (
            translation
          )}
        </div>
      )}
    </div>
  )
}

// ── Mount helper ───────────────────────────────────────────────────────
export function mountSelectionToolbar() {
  const HOST_ID = "astra-selection-toolbar-host"
  if (document.getElementById(HOST_ID)) return

  const host = document.createElement("div")
  host.id = HOST_ID
  host.style.position = "fixed"
  host.style.top = "0"
  host.style.left = "0"
  host.style.width = "0"
  host.style.height = "0"
  host.style.overflow = "visible"
  host.style.zIndex = "2147483646"
  document.body.appendChild(host)

  const shadow = host.attachShadow({ mode: "open" })

  // Inject keyframes into shadow DOM
  const styleEl = document.createElement("style")
  styleEl.textContent = KEYFRAMES_CSS
  shadow.appendChild(styleEl)

  const container = document.createElement("div")
  shadow.appendChild(container)

  createRoot(container).render(<SelectionToolbarApp />)
}
