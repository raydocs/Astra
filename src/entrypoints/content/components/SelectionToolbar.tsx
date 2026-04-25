import { useState, useEffect, useCallback, useRef } from "react"
import { createRoot } from "react-dom/client"
import { browser } from "#imports"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { t } from "@/utils/i18n"
import { readConfig } from "@/utils/storage/config"
import { saveVocabularyEntry } from "@/utils/storage/vocabulary"
import { copyTextToClipboard } from "@/utils/dom/clipboard"
import { copyBilingualCard } from "@/utils/dom/share-card"
import { DEFAULT_ASTRA_CONFIG, resolveSiteTranslationSettings, type AstraConfig } from "@/types/config"
import { getEnabledActions, type BuiltinAction } from "@/types/actions"
import {
  clearInteractionSuppression,
  setInteractionSuppressionReason,
} from "../interaction-coordination"
import { runActionById } from "../inline-actions"
import { markSessionSave } from "../learning-state"
import { isTtsSupported, speak, speakWithHighlight, stopSpeaking } from "@/utils/tts"
import { AstraIdentityStrip } from "./AstraIdentityStrip"
import {
  generateGrammarGuide,
  generateWordAnnotation,
  isLexicalCandidate,
  type GrammarGuide,
  type WordAnnotation,
} from "@/utils/reading/assist"

interface ToolbarPosition {
  top: number
  left: number
}

const BRAND_COLOR = "#6366f1"
const PRIMARY_BUTTON_HOVER_COLOR = "#4f46e5"
const PRIMARY_BUTTON_ACTIVE_COLOR = "#4338ca"
const HOST_ID = "astra-selection-toolbar-host"
const PRIMARY_ACTION_IDS = new Set(["translate", "explain"])

function isPrimaryLearningAction(actionId: string): boolean {
  return PRIMARY_ACTION_IDS.has(actionId)
}

const isCoarsePointer = typeof window !== "undefined"
  && window.matchMedia?.("(pointer: coarse)")?.matches === true

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
    fontSize: isCoarsePointer ? "15px" : "14px",
    lineHeight: "1.5",
  }),
  shellCard: {
    background: "#fff",
    borderRadius: isCoarsePointer ? "10px" : "8px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
    padding: isCoarsePointer ? "8px" : "6px",
    display: "flex",
    flexDirection: "column",
    gap: isCoarsePointer ? "6px" : "4px",
    minWidth: 180,
  } as React.CSSProperties,
  buttonBar: {
    display: "flex",
    gap: isCoarsePointer ? "4px" : "2px",
    flexWrap: "wrap",
  } as React.CSSProperties,
  button: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: isCoarsePointer ? "8px 14px" : "4px 10px",
    borderRadius: "6px",
    fontSize: isCoarsePointer ? "14px" : "13px",
    color: "#374151",
    whiteSpace: "nowrap",
    transition: "background 0.15s, color 0.15s",
    minHeight: isCoarsePointer ? "40px" : undefined,
  } as React.CSSProperties,
  buttonHover: {
    background: `${BRAND_COLOR}14`,
    color: BRAND_COLOR,
  } as React.CSSProperties,
  primaryButton: {
    background: BRAND_COLOR,
    color: "#fff",
    fontWeight: 600,
  } as React.CSSProperties,
  primaryButtonHover: {
    background: PRIMARY_BUTTON_HOVER_COLOR,
  } as React.CSSProperties,
  primaryButtonActive: {
    background: PRIMARY_BUTTON_ACTIVE_COLOR,
    boxShadow: "0 0 0 1px rgba(255,255,255,0.18) inset",
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
  saveCtaButton: {
    border: "none",
    background: "#dcfce7",
    color: "#166534",
    borderRadius: "6px",
    padding: "8px 12px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
    textAlign: "center",
    marginTop: "10px",
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
  const [shared, setShared] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(DEFAULT_ASTRA_CONFIG.tts.enabled && isTtsSupported(DEFAULT_ASTRA_CONFIG.tts.engine))
  const [actions, setActions] = useState<BuiltinAction[]>(() => getEnabledActions())
  const [grammarResult, setGrammarResult] = useState<GrammarGuide | null>(null)
  const [wordAnnotation, setWordAnnotation] = useState<WordAnnotation | null>(null)
  const [grammarLoading, setGrammarLoading] = useState(false)
  const [dueCount, setDueCount] = useState<number | null>(null)
  const [targetLang, setTargetLang] = useState<string | null>(null)

  const toolbarRef = useRef<HTMLDivElement>(null)
  const skipNextMouseUp = useRef(false)
  const mouseUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const visibleRef = useRef(false)
  const selectionVersionRef = useRef(0)
  const selectionContextElementRef = useRef<HTMLElement | null>(null)
  const configSyncVersionRef = useRef(0)
  const stopHighlightRef = useRef<(() => void) | null>(null)

  visibleRef.current = visible

  const syncToolbarConfig = useCallback(async () => {
    const requestVersion = configSyncVersionRef.current + 1
    configSyncVersionRef.current = requestVersion
    const config = await readConfig()
    if (requestVersion !== configSyncVersionRef.current) return null
    const resolved = resolveSiteTranslationSettings(config, window.location.hostname)
    setActions(getEnabledActions({ customActions: config.customActions }))
    setTtsEnabled(config.tts.enabled && isTtsSupported(config.tts.engine))
    setTargetLang(resolved.targetLang)
    return config
  }, [])

  const resetInlineResults = useCallback(() => {
    setRunningAction(null)
    setActionResult(null)
    setGrammarResult(null)
    setWordAnnotation(null)
    setGrammarLoading(false)
    setDueCount(null)
  }, [])

  const dismiss = useCallback(() => {
    selectionVersionRef.current += 1
    clearInteractionSuppression(["selection-pointer", "selection-toolbar"])
    setVisible(false)
    resetInlineResults()
    setSaved(false)
    setShared(false)
    setSpeaking(false)
    setGrammarResult(null)
    setWordAnnotation(null)
    setGrammarLoading(false)
    stopHighlightRef.current?.()
    stopHighlightRef.current = null
    stopSpeaking()
    setSelectedText("")
    setSelectionContext(undefined)
    selectionContextElementRef.current = null
    setTargetLang(null)
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

      if (mouseUpTimerRef.current) clearTimeout(mouseUpTimerRef.current)
      mouseUpTimerRef.current = setTimeout(() => {
        void (async () => {
          const selection = window.getSelection()
          const text = selection?.toString().trim() ?? ""
          if (!text || !selection || selection.rangeCount === 0) {
            dismiss()
            return
          }

          const range = selection.getRangeAt(0)
          const requestVersion = selectionVersionRef.current + 1
          selectionVersionRef.current = requestVersion
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

          try {
            await syncToolbarConfig()
          } catch {
            // Keep showing the toolbar even if config hydration fails.
          }

          if (requestVersion !== selectionVersionRef.current) return
          setPosition({ top, left })
          setVisible(true)
        })()
      }, 10)
    }

    document.addEventListener("mouseup", onMouseUp, true)
    return () => document.removeEventListener("mouseup", onMouseUp, true)
  }, [dismiss, resetInlineResults, syncToolbarConfig])

  // Touch/mobile support: listen to selectionchange for coarse-pointer environments
  useEffect(() => {
    const isTouchDevice = window.matchMedia?.("(pointer: coarse)")?.matches

    if (!isTouchDevice) return

    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    const onSelectionChange = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        const selection = window.getSelection()
        const text = selection?.toString().trim() ?? ""

        if (!text || !selection || selection.rangeCount === 0) {
          if (visibleRef.current) dismiss()
          return
        }

        const range = selection.getRangeAt(0)
        const requestVersion = selectionVersionRef.current + 1
        selectionVersionRef.current = requestVersion
        setInteractionSuppressionReason("selection-toolbar", true)
        setSelectedText(text)
        setSelectionContext(getSelectionContext(range))
        selectionContextElementRef.current = range.commonAncestorContainer instanceof HTMLElement
          ? range.commonAncestorContainer
          : range.commonAncestorContainer.parentElement
        resetInlineResults()

        const rect = range.getBoundingClientRect()
        // Prefer placing above selection on mobile for visibility
        const spaceAbove = rect.top
        const top = spaceAbove > 60 ? rect.top - 50 : rect.bottom + 6
        let left = rect.left + rect.width / 2 - 80
        const vw = window.visualViewport?.width ?? window.innerWidth
        if (left < 8) left = 8
        if (left + 160 > vw) left = vw - 168

        void syncToolbarConfig().catch(() => {})

        if (requestVersion !== selectionVersionRef.current) return
        setPosition({ top, left })
        setVisible(true)
      }, 150)
    }

    document.addEventListener("selectionchange", onSelectionChange)
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange)
      if (debounceTimer) clearTimeout(debounceTimer)
    }
  }, [dismiss, resetInlineResults, syncToolbarConfig])

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
    if (mouseUpTimerRef.current) clearTimeout(mouseUpTimerRef.current)
  }, [])

  useEffect(() => {
    void syncToolbarConfig()
  }, [syncToolbarConfig])

  // Auto-detect word selection: trigger lexical lookup when toolbar appears for a single word/short phrase
  useEffect(() => {
    if (visible && selectedText && isLexicalCandidate(selectedText)) {
      void handleWordLookup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, selectedText])

  const resolveConfig = async (): Promise<{ config: AstraConfig; targetLang: string; enabled: boolean }> => {
    const config = await readConfig()
    const resolved = resolveSiteTranslationSettings(config, window.location.hostname)
    return { config, targetLang: resolved.targetLang, enabled: resolved.enabled }
  }

  const handleAction = async (action: BuiltinAction) => {
    if (!selectedText || runningAction) return
    const requestVersion = selectionVersionRef.current
    const requestText = selectedText
    const requestContext = selectionContext
    setRunningAction(action.id)
    setActionResult(null)

    try {
      const { config, targetLang, enabled } = await resolveConfig()
      if (requestVersion !== selectionVersionRef.current) return
      setTargetLang(targetLang)
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
        customActions: config.customActions,
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
        text: `⚠ ${error instanceof Error ? error.message : t("actionOperationFailed")}`,
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

  const handleShare = async () => {
    if (!selectedText) return
    const translation = actionResult?.text ?? ""
    await copyBilingualCard(selectedText, translation, window.location.href)
    setShared(true)
  }

  const handleSpeak = async () => {
    if (speaking) {
      stopHighlightRef.current?.()
      stopHighlightRef.current = null
      stopSpeaking()
      setSpeaking(false)
    } else if (selectedText) {
      const config = await readConfig()
      const enabled = config.tts.enabled && isTtsSupported(config.tts.engine)
      setTtsEnabled(enabled)
      if (!enabled) return

      const speakOpts = {
        engine: config.tts.engine,
        voiceName: config.tts.voiceName,
        rate: config.tts.rate,
        pitch: config.tts.pitch,
        onEnd: () => { stopHighlightRef.current = null; setSpeaking(false) },
        onError: () => { stopHighlightRef.current = null; setSpeaking(false) },
      }

      if (config.tts.highlightSentences) {
        const stop = speakWithHighlight(selectedText, speakOpts)
        stopHighlightRef.current = stop
        setSpeaking(true)
      } else {
        const started = speak(selectedText, speakOpts)
        setSpeaking(started)
      }
    }
  }

  const handleSave = async () => {
    if (!selectedText || saved) return
    await saveVocabularyEntry({
      text: selectedText,
      translation: actionResult?.actionId === "translate" ? actionResult.text : undefined,
      explanation: actionResult?.actionId === "explain" ? actionResult.text : undefined,
      context: selectionContext,
      sourceContext: {
        surface: "selection_toolbar",
        pageTitle: document.title?.trim() || undefined,
        contentSummary: selectionContext,
        sentenceText: selectedText,
      },
      url: window.location.href,
      hostname: window.location.hostname,
      note: actionResult?.actionId === "explain" ? actionResult.text : undefined,
    })
    setSaved(true)

    let nextDueCount: number | null = null
    try {
      const [{ getDueVocabularyCount }] = await Promise.all([
        import("@/utils/storage/vocabulary"),
      ])
      nextDueCount = await getDueVocabularyCount()
    } catch {
      nextDueCount = null
    }

    setDueCount(nextDueCount)
    markSessionSave("selection_toolbar", nextDueCount)
  }

  const openVocabulary = () => {
    void browser.tabs.create({ url: browser.runtime.getURL("/vocabulary.html") })
  }

  const openReview = () => {
    void browser.tabs.create({ url: browser.runtime.getURL("/vocabulary.html?tab=review") })
  }

  const handleGrammar = async () => {
    if (!selectedText || grammarLoading) return
    const requestVersion = selectionVersionRef.current
    setGrammarLoading(true)
    setGrammarResult(null)

    try {
      const config = await readConfig()
      if (requestVersion !== selectionVersionRef.current) return
      const result = await generateGrammarGuide({
        text: selectedText,
        targetLang: config.targetLang,
        languageLevel: config.languageLevel,
        sentenceContext: selectionContext,
      })
      if (requestVersion !== selectionVersionRef.current) return
      setGrammarResult(result)
    } catch {
      // Grammar analysis failed silently — user can retry
    } finally {
      if (requestVersion === selectionVersionRef.current) {
        setGrammarLoading(false)
      }
    }
  }

  const handleWordLookup = async () => {
    if (!selectedText || !isLexicalCandidate(selectedText)) return
    const requestVersion = selectionVersionRef.current
    setWordAnnotation(null)

    try {
      const config = await readConfig()
      if (requestVersion !== selectionVersionRef.current) return
      const result = await generateWordAnnotation({
        word: selectedText,
        sentenceContext: selectionContext,
        targetLang: config.targetLang,
        languageLevel: config.languageLevel,
      })
      if (requestVersion !== selectionVersionRef.current) return
      setWordAnnotation(result)
    } catch {
      // Word lookup failed silently — not critical
    }
  }

  const hasActionError = Boolean(actionResult?.text.startsWith("⚠"))
  const hasResultPanelSaveCta = Boolean(
    actionResult
      && !hasActionError
      && (actionResult.actionId === "translate" || actionResult.actionId === "explain"),
  )
  const showInlineSaveCta = hasResultPanelSaveCta && !saved
  const showSaveInBar = !hasResultPanelSaveCta || saved

  if (!visible) return null

  return (
    <div
      ref={toolbarRef}
      style={styles.toolbar(position)}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div style={styles.shellCard} data-testid="selection-toolbar-shell">
        <AstraIdentityStrip targetLang={targetLang} />
        <div style={styles.buttonBar}>
          {actions.map((action) => {
            const isPrimary = isPrimaryLearningAction(action.id)
            const isActivePrimary = isPrimary && runningAction === action.id
            const isSelectedPrimary = isPrimary && actionResult?.actionId === action.id

            return (
              <button
                type="button"
                key={action.id}
                data-testid={`selection-action-${action.id}`}
                data-action-variant={isPrimary ? "primary" : "utility"}
                data-action-state={isPrimary
                  ? (isActivePrimary ? "active" : isSelectedPrimary ? "selected" : "idle")
                  : "idle"}
                style={{
                  ...styles.button,
                  ...(isPrimary ? styles.primaryButton : {}),
                  ...(!isPrimary && hoveredBtn === action.id ? styles.buttonHover : {}),
                  ...(isPrimary && hoveredBtn === action.id ? styles.primaryButtonHover : {}),
                  ...(isPrimary && (isActivePrimary || isSelectedPrimary) ? styles.primaryButtonActive : {}),
                  ...(isActivePrimary ? { cursor: "progress" } : {}),
                }}
                onMouseEnter={() => setHoveredBtn(action.id)}
                onMouseLeave={() => setHoveredBtn(null)}
                onClick={(event) => {
                  event.stopPropagation()
                  skipNextMouseUp.current = true
                  void handleAction(action)
                }}
              >
                {action.id === "translate" ? t("actionTranslate")
                  : action.id === "explain" ? t("actionExplain")
                  : action.labelZh}
              </button>
            )
          })}
        <button
          type="button"
          style={{
            ...styles.button,
            ...(hoveredBtn === "grammar" ? styles.buttonHover : {}),
            ...(grammarLoading ? { opacity: 0.6 } : {}),
          }}
          onMouseEnter={() => setHoveredBtn("grammar")}
          onMouseLeave={() => setHoveredBtn(null)}
          onClick={(event) => {
            event.stopPropagation()
            skipNextMouseUp.current = true
            void handleGrammar()
          }}
          disabled={grammarLoading}
        >
          {grammarLoading ? t("actionGrammarLoading") : t("actionGrammar")}
        </button>
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
          {t("actionCopy")}
        </button>
        <button
          type="button"
          style={{
            ...styles.button,
            ...(hoveredBtn === "share" ? styles.buttonHover : {}),
            ...(shared ? { color: "#10b981" } : {}),
          }}
          onMouseEnter={() => setHoveredBtn("share")}
          onMouseLeave={() => setHoveredBtn(null)}
          onClick={(event) => {
            event.stopPropagation()
            skipNextMouseUp.current = true
            void handleShare()
          }}
        >
          {shared ? t("actionShared") : t("actionShare")}
        </button>
        {showSaveInBar && (
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
            {saved ? t("actionSaved") : t("actionSave")}
          </button>
        )}
          {ttsEnabled && (
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
                void handleSpeak()
              }}
            >
              {speaking ? t("actionStop") : t("actionSpeak")}
            </button>
          )}
        </div>
      </div>

      {(runningAction || actionResult || saved) && (
        <div style={{
          ...styles.resultPanel,
          borderLeftColor: saved ? "#10b981" : actionResult?.actionId === "explain" ? "#8b5cf6" : BRAND_COLOR,
          background: saved ? "#f0fdf4" : "#fff",
        }}>
          {runningAction ? (
            <span style={styles.dots}>⋯</span>
          ) : actionResult?.text ? (
            <div>{actionResult.text}</div>
          ) : null}

          {showInlineSaveCta && (
            <button
              type="button"
              data-testid="selection-result-save-cta"
              style={styles.saveCtaButton}
              onClick={(event) => {
                event.stopPropagation()
                skipNextMouseUp.current = true
                void handleSave()
              }}
            >
              📚 {t("actionSave")}
            </button>
          )}

          {saved && (
            <div style={{
              marginTop: actionResult?.text ? 10 : 0,
              paddingTop: actionResult?.text ? 8 : 0,
              borderTop: actionResult?.text ? "1px solid rgba(167, 243, 208, 0.65)" : undefined,
            }}>
              <div style={{ fontWeight: 700, color: "#065f46", marginBottom: 4 }}>
                {t("learningSavedTitle")}
              </div>
              <div style={{ color: "#047857", marginBottom: 8 }}>
                {t("learningSavedHint")}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  style={{ ...styles.button, background: "#dcfce7", color: "#166534", padding: "6px 10px" }}
                  onClick={(event) => {
                    event.stopPropagation()
                    openVocabulary()
                  }}
                >
                  {t("popup_vocabulary")}
                </button>
                <button
                  type="button"
                  style={{ ...styles.button, background: "#dcfce7", color: "#166534", padding: "6px 10px" }}
                  onClick={(event) => {
                    event.stopPropagation()
                    openReview()
                  }}
                >
                  {dueCount && dueCount > 0 ? `${t("popup_review")} (${dueCount})` : t("popup_review")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {wordAnnotation && (
        <div style={{ ...styles.resultPanel, borderLeftColor: "#0ea5e9" }} data-testid="word-annotation-card">
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "4px" }}>
            <strong style={{ fontSize: "16px" }}>{wordAnnotation.word}</strong>
            {wordAnnotation.pronunciation && (
              <span style={{ color: "#64748b", fontSize: "13px" }}>{wordAnnotation.pronunciation}</span>
            )}
            <span style={{
              display: "inline-block",
              padding: "1px 6px",
              borderRadius: "4px",
              background: "#e0f2fe",
              color: "#0369a1",
              fontSize: "12px",
              fontWeight: 500,
            }}>
              {wordAnnotation.partOfSpeech}
            </span>
          </div>
          <div style={{ marginBottom: "4px" }}>{wordAnnotation.meaning}</div>
          <div style={{ color: "#475569", fontSize: "13px", marginBottom: "4px" }}>{wordAnnotation.shortExplanation}</div>
          {wordAnnotation.exampleSentence && (
            <div style={{ color: "#64748b", fontSize: "13px", fontStyle: "italic" }}>{wordAnnotation.exampleSentence}</div>
          )}
        </div>
      )}

      {grammarResult && (
        <div style={{ ...styles.resultPanel, borderLeftColor: "#a855f7" }} data-testid="grammar-card">
          <div style={{ fontWeight: 600, marginBottom: "6px" }}>{grammarResult.overview}</div>
          {grammarResult.structure.length > 0 && (
            <ul style={{ margin: "0 0 6px 0", paddingLeft: "18px", fontSize: "13px", color: "#334155" }}>
              {grammarResult.structure.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
          {grammarResult.keyPatterns.length > 0 && (
            <div style={{ marginBottom: "6px" }}>
              {grammarResult.keyPatterns.map((pattern, i) => (
                <div key={i} style={{ fontSize: "13px", color: "#475569", marginBottom: "2px" }}>
                  {pattern}
                </div>
              ))}
            </div>
          )}
          {grammarResult.vocabularyNotes.length > 0 && (
            <div>
              {grammarResult.vocabularyNotes.map((note, i) => (
                <div key={i} style={{ fontSize: "13px", color: "#64748b" }}>
                  {note}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {grammarLoading && !grammarResult && (
        <div style={{ ...styles.resultPanel, borderLeftColor: "#a855f7" }}>
          <span style={styles.dots}>⋯</span>
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
