import { useState, useEffect, useCallback, useRef } from "react"
import { createRoot } from "react-dom/client"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { readConfig } from "@/utils/storage/config"
import { saveVocabularyEntry } from "@/utils/storage/vocabulary"
import { copyTextToClipboard } from "@/utils/dom/clipboard"
import { resolveSiteTranslationSettings } from "@/types/config"
import { getEnabledActions, type BuiltinAction } from "@/types/actions"
import {
  clearInteractionSuppression,
  setInteractionSuppressionReason,
} from "../interaction-coordination"
import { runActionById } from "../inline-actions"
import { speak, stopSpeaking, isSpeaking } from "@/utils/tts"

interface ToolbarPosition {
  top: number
  left: number
}

const BRAND_COLOR = "#6366f1"
const HOST_ID = "astra-selection-toolbar-host"

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

function getSelectionContext(range: Range): string | undefined {
  const baseNode = range.commonAncestorContainer instanceof HTMLElement
    ? range.commonAncestorContainer
    : range.commonAncestorContainer.parentElement

  const contextElement = baseNode?.closest("p, li, blockquote, td, th, article, section, div")
  const text = contextElement?.textContent?.replace(/\s+/g, " ").trim()
  if (!text) return undefined
  return text.length > 400 ? `${text.slice(0, 400).trim()}…` : text
}

function isEventInsideToolbar(event: Event): boolean {
  const host = document.getElementById(HOST_ID)
  if (!host) return false

  const path = typeof event.composedPath === "function" ? event.composedPath() : []
  if (path.includes(host)) return true

  const target = event.target as Node | null
  return !!target && (host === target || host.contains(target))
}

function SelectionToolbarApp() {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<ToolbarPosition>({ top: 0, left: 0 })
  const [selectedText, setSelectedText] = useState("")
  const [selectionContext, setSelectionContext] = useState<string | undefined>(undefined)
  const [runningAction, setRunningAction] = useState<string | null>(null)
  const [actionResult, setActionResult] = useState<{ actionId: string; text: string } | null>(null)
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [speaking, setSpeaking] = useState(false)

  const toolbarRef = useRef<HTMLDivElement>(null)
  const skipNextMouseUp = useRef(false)
  const speakPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const visibleRef = useRef(false)
  const selectionVersionRef = useRef(0)
  const selectionContextElementRef = useRef<HTMLElement | null>(null)

  visibleRef.current = visible

  const resetInlineResults = useCallback(() => {
    setRunningAction(null)
    setActionResult(null)
  }, [])

  const dismiss = useCallback(() => {
    selectionVersionRef.current += 1
    clearInteractionSuppression(["selection-pointer", "selection-toolbar"])
    setVisible(false)
    resetInlineResults()
    setSaved(false)
    setSpeaking(false)
    stopSpeaking()
    if (speakPollRef.current) {
      clearInterval(speakPollRef.current)
      speakPollRef.current = null
    }
    setSelectedText("")
    setSelectionContext(undefined)
    selectionContextElementRef.current = null
  }, [resetInlineResults])

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (isEventInsideToolbar(event) || toolbarRef.current?.contains(event.target as Node)) {
        return
      }

      if (visibleRef.current) {
        dismiss()
      }

      if (event.button === 0) {
        setInteractionSuppressionReason("selection-pointer", true)
      }
    }

    document.addEventListener("mousedown", onMouseDown, true)
    return () => document.removeEventListener("mousedown", onMouseDown, true)
  }, [dismiss])

  useEffect(() => {
    const onMouseUp = (event: MouseEvent) => {
      if (skipNextMouseUp.current) {
        skipNextMouseUp.current = false
        return
      }

      if (isEventInsideToolbar(event)) return

      setTimeout(() => {
        const selection = window.getSelection()
        const text = selection?.toString().trim() ?? ""
        if (!text || !selection || selection.rangeCount === 0) {
          dismiss()
          return
        }

        const range = selection.getRangeAt(0)
        selectionVersionRef.current += 1
        setInteractionSuppressionReason("selection-toolbar", true)
        setInteractionSuppressionReason("selection-pointer", false)
        setSelectedText(text)
        setSelectionContext(getSelectionContext(range))
        selectionContextElementRef.current = range.commonAncestorContainer instanceof HTMLElement
          ? range.commonAncestorContainer
          : range.commonAncestorContainer.parentElement
        resetInlineResults()

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

  useEffect(() => {
    const clearPointerSuppression = () => {
      clearInteractionSuppression(["selection-pointer"])
    }

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        clearPointerSuppression()
      }
    }

    window.addEventListener("blur", clearPointerSuppression)
    document.addEventListener("visibilitychange", onVisibilityChange, true)
    return () => {
      window.removeEventListener("blur", clearPointerSuppression)
      document.removeEventListener("visibilitychange", onVisibilityChange, true)
    }
  }, [])

  useEffect(() => () => {
    clearInteractionSuppression(["selection-pointer", "selection-toolbar"])
  }, [])

  const resolveTargetLang = async (): Promise<{ targetLang: string; enabled: boolean }> => {
    const config = await readConfig()
    const resolved = resolveSiteTranslationSettings(config, window.location.hostname)
    return { targetLang: resolved.targetLang, enabled: resolved.enabled }
  }

  const handleAction = async (action: BuiltinAction) => {
    if (!selectedText || runningAction) return
    const requestVersion = selectionVersionRef.current
    const requestText = selectedText
    const requestContext = selectionContext
    setRunningAction(action.id)
    setActionResult(null)

    try {
      const { targetLang, enabled } = await resolveTargetLang()
      if (requestVersion !== selectionVersionRef.current) return
      if (!enabled) {
        setActionResult({ actionId: action.id, text: "⚠ Astra is disabled on this site." })
        return
      }

      const result = await runActionById({
        actionId: action.id,
        text: requestText,
        targetLang,
        selectionContext: requestContext,
        contextElement: selectionContextElementRef.current,
      })

      if (requestVersion !== selectionVersionRef.current) return
      setActionResult({
        actionId: action.id,
        text: result.ok ? result.text : `⚠ ${result.message}`,
      })
    } catch (error: unknown) {
      if (requestVersion !== selectionVersionRef.current) return
      setActionResult({
        actionId: action.id,
        text: `⚠ ${error instanceof Error ? error.message : "操作失败"}`,
      })
    } finally {
      if (requestVersion === selectionVersionRef.current) {
        setRunningAction(null)
      }
    }
  }

  const handleCopy = async () => {
    await copyTextToClipboard(actionResult?.text ?? selectedText)
  }

  const handleSpeak = () => {
    if (speakPollRef.current) {
      clearInterval(speakPollRef.current)
      speakPollRef.current = null
    }
    if (isSpeaking()) {
      stopSpeaking()
      setSpeaking(false)
    } else if (selectedText) {
      speak(selectedText)
      setSpeaking(true)
      speakPollRef.current = setInterval(() => {
        if (!isSpeaking()) {
          setSpeaking(false)
          if (speakPollRef.current) {
            clearInterval(speakPollRef.current)
            speakPollRef.current = null
          }
        }
      }, 200)
    }
  }

  const handleSave = async () => {
    if (!selectedText || saved) return
    await saveVocabularyEntry({
      text: selectedText,
      translation: actionResult?.actionId === "translate" ? actionResult.text : undefined,
      explanation: actionResult?.actionId === "explain" ? actionResult.text : undefined,
      context: selectionContext,
      url: window.location.href,
      hostname: window.location.hostname,
    })
    setSaved(true)
  }

  const actions = getEnabledActions()

  if (!visible) return null

  return (
    <div
      ref={toolbarRef}
      style={styles.toolbar(position)}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div style={styles.buttonBar}>
        {actions.map((action) => (
          <button
            type="button"
            key={action.id}
            style={{
              ...styles.button,
              ...(hoveredBtn === action.id ? styles.buttonHover : {}),
            }}
            onMouseEnter={() => setHoveredBtn(action.id)}
            onMouseLeave={() => setHoveredBtn(null)}
            onClick={(event) => {
              event.stopPropagation()
              skipNextMouseUp.current = true
              void handleAction(action)
            }}
          >
            {action.labelZh}
          </button>
        ))}
        <button
          type="button"
          style={{
            ...styles.button,
            ...(hoveredBtn === "copy" ? styles.buttonHover : {}),
          }}
          onMouseEnter={() => setHoveredBtn("copy")}
          onMouseLeave={() => setHoveredBtn(null)}
          onClick={(event) => {
            event.stopPropagation()
            skipNextMouseUp.current = true
            void handleCopy()
          }}
        >
          复制
        </button>
        <button
          type="button"
          style={{
            ...styles.button,
            ...(hoveredBtn === "save" ? styles.buttonHover : {}),
            ...(saved ? { color: "#10b981" } : {}),
          }}
          onMouseEnter={() => setHoveredBtn("save")}
          onMouseLeave={() => setHoveredBtn(null)}
          onClick={(event) => {
            event.stopPropagation()
            skipNextMouseUp.current = true
            void handleSave()
          }}
        >
          {saved ? "✓ 已收藏" : "收藏"}
        </button>
        <button
          type="button"
          style={{
            ...styles.button,
            ...(hoveredBtn === "speak" ? styles.buttonHover : {}),
          }}
          onMouseEnter={() => setHoveredBtn("speak")}
          onMouseLeave={() => setHoveredBtn(null)}
          onClick={(event) => {
            event.stopPropagation()
            skipNextMouseUp.current = true
            handleSpeak()
          }}
        >
          {speaking ? "停止" : "朗读"}
        </button>
      </div>

      {(runningAction || actionResult) && (
        <div style={{
          ...styles.resultPanel,
          borderLeftColor: actionResult?.actionId === "explain" ? "#8b5cf6" : BRAND_COLOR,
        }}>
          {runningAction ? (
            <span style={styles.dots}>⋯</span>
          ) : (
            actionResult?.text
          )}
        </div>
      )}
    </div>
  )
}

export function mountSelectionToolbar() {
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

  const styleEl = document.createElement("style")
  styleEl.textContent = KEYFRAMES_CSS
  shadow.appendChild(styleEl)

  const container = document.createElement("div")
  shadow.appendChild(container)

  createRoot(container).render(<ErrorBoundary><SelectionToolbarApp /></ErrorBoundary>)
}
