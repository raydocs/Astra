import { useState, useEffect, useCallback, useRef } from "react"
import { createRoot } from "react-dom/client"
import { browser } from "#imports"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { t } from "@/utils/i18n"
import { readConfig } from "@/utils/storage/config"
import { saveVocabularyEntry } from "@/utils/storage/vocabulary"
import { formatGlossaryEvidenceLabel } from "@/utils/storage/vocabulary-core"
import { copyTextToClipboard } from "@/utils/dom/clipboard"
import { copyBilingualCard } from "@/utils/dom/share-card"
import { DEFAULT_ASTRA_CONFIG, resolveSiteTranslationSettings, type AstraConfig, type ExplainMode, type LanguageLevel } from "@/types/config"
import { getEnabledActions, type BuiltinAction } from "@/types/actions"
import {
  clearInteractionSuppression,
  setInteractionSuppressionReason,
} from "../interaction-coordination"
import { runActionById } from "../inline-actions"
import type { MatchedExplanationGlossaryTerm } from "@/utils/translate/explanation-quality"
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
import { OVERLAY_FONT_FAMILY, OVERLAY_STYLE_TOKENS, createOverlayCardStyle, createOverlayStyle1TokenStyleElement, overlayPx, overlayRem } from "./overlayScale"
import { formatExplainProfileLabel } from "@/utils/storage/vocabulary-core"
import { commitLearningContinuitySync } from "@/utils/extension/messages"

interface ToolbarPosition {
  top: number
  left: number
}

const BRAND_COLOR = OVERLAY_STYLE_TOKENS.brand
const PRIMARY_BUTTON_HOVER_COLOR = OVERLAY_STYLE_TOKENS.brandHover
const PRIMARY_BUTTON_ACTIVE_COLOR = OVERLAY_STYLE_TOKENS.brandActive
const QUIET_SERIF_FONT_FAMILY = '"Source Serif 4", "Source Serif Pro", "Tiempos Text", "Songti SC", "Noto Serif SC", Georgia, serif'
const HOST_ID = "astra-selection-toolbar-host"
const PRIMARY_ACTION_IDS = new Set(["translate", "explain"])

function isPrimaryLearningAction(actionId: string): boolean {
  return PRIMARY_ACTION_IDS.has(actionId)
}

const isCoarsePointer = typeof window !== "undefined"
  && window.matchMedia?.("(pointer: coarse)")?.matches === true

function createStyles(fontScale: number) {
  return {
    toolbar: (pos: ToolbarPosition): React.CSSProperties => ({
      position: "fixed",
      top: pos.top,
      left: pos.left,
      zIndex: 2147483646,
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      fontFamily: OVERLAY_FONT_FAMILY,
      fontSize: overlayRem(isCoarsePointer ? 15 : 14, fontScale),
      lineHeight: "1.5",
    }),
    shellCard: {
      ...createOverlayCardStyle(fontScale),
      padding: isCoarsePointer
        ? `${overlayPx(7, fontScale)} ${overlayPx(8, fontScale)}`
        : `${overlayPx(4, fontScale)} ${overlayPx(5, fontScale)}`,
      display: "flex",
      flexDirection: "column",
      gap: isCoarsePointer ? overlayPx(5, fontScale) : overlayPx(3, fontScale),
      minWidth: Number.parseFloat(overlayPx(168, fontScale)),
      borderColor: OVERLAY_STYLE_TOKENS.borderSubtle,
      background: `color-mix(in srgb, ${OVERLAY_STYLE_TOKENS.surfaceElevated} 94%, ${OVERLAY_STYLE_TOKENS.surfaceSubtle})`,
      boxShadow: "0 14px 36px color-mix(in srgb, CanvasText 10%, transparent)",
    } as React.CSSProperties,
    buttonBar: {
      display: "flex",
      gap: isCoarsePointer ? overlayPx(3, fontScale) : overlayPx(2, fontScale),
      flexWrap: "wrap",
    } as React.CSSProperties,
    button: {
      border: "1px solid transparent",
      background: "transparent",
      cursor: "pointer",
      padding: isCoarsePointer
        ? `${overlayPx(7, fontScale)} ${overlayPx(12, fontScale)}`
        : `${overlayPx(4, fontScale)} ${overlayPx(8, fontScale)}`,
      borderRadius: overlayPx(7, fontScale),
      fontSize: overlayPx(isCoarsePointer ? 14 : 12.5, fontScale),
      color: OVERLAY_STYLE_TOKENS.textSecondary,
      whiteSpace: "nowrap",
      transition: "background 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s",
      minHeight: isCoarsePointer ? overlayPx(38, fontScale) : overlayPx(28, fontScale),
      lineHeight: 1.2,
      fontFamily: OVERLAY_FONT_FAMILY,
      fontWeight: 500,
    } as React.CSSProperties,
    buttonHover: {
      background: OVERLAY_STYLE_TOKENS.surfaceSubtle,
      color: OVERLAY_STYLE_TOKENS.textPrimary,
      borderColor: OVERLAY_STYLE_TOKENS.borderSubtle,
    } as React.CSSProperties,
    primaryButton: {
      background: OVERLAY_STYLE_TOKENS.textPrimary,
      color: OVERLAY_STYLE_TOKENS.surfaceElevated,
      fontWeight: 650,
      borderColor: OVERLAY_STYLE_TOKENS.textPrimary,
      boxShadow: "0 1px 2px color-mix(in srgb, CanvasText 12%, transparent)",
    } as React.CSSProperties,
    primaryButtonHover: {
      background: `color-mix(in srgb, ${OVERLAY_STYLE_TOKENS.textPrimary} 90%, ${PRIMARY_BUTTON_HOVER_COLOR})`,
    } as React.CSSProperties,
    primaryButtonActive: {
      background: PRIMARY_BUTTON_ACTIVE_COLOR,
      boxShadow: `0 0 0 1px color-mix(in srgb, ${OVERLAY_STYLE_TOKENS.textInverse} 18%, transparent) inset`,
    } as React.CSSProperties,
    resultPanel: {
      ...createOverlayCardStyle(fontScale),
      marginTop: overlayPx(7, fontScale),
      padding: `${overlayPx(11, fontScale)} ${overlayPx(15, fontScale)}`,
      maxWidth: Number.parseFloat(overlayPx(430, fontScale)),
      fontSize: overlayPx(14, fontScale),
      color: OVERLAY_STYLE_TOKENS.textPrimary,
      lineHeight: "1.65",
      borderLeft: `${overlayPx(3, fontScale)} solid ${BRAND_COLOR}`,
      borderTopColor: OVERLAY_STYLE_TOKENS.borderSubtle,
      borderRightColor: OVERLAY_STYLE_TOKENS.borderSubtle,
      borderBottomColor: OVERLAY_STYLE_TOKENS.borderSubtle,
      background: `color-mix(in srgb, ${OVERLAY_STYLE_TOKENS.surfaceElevated} 96%, ${OVERLAY_STYLE_TOKENS.surfaceSubtle})`,
      boxShadow: "0 12px 32px color-mix(in srgb, CanvasText 9%, transparent)",
      wordBreak: "break-word",
    } as React.CSSProperties,
    resultBody: {
      fontFamily: QUIET_SERIF_FONT_FAMILY,
      fontSize: overlayPx(15, fontScale),
      fontStyle: "italic",
      lineHeight: 1.6,
      color: OVERLAY_STYLE_TOKENS.textPrimary,
      letterSpacing: "-0.01em",
    } as React.CSSProperties,
    resultMeta: {
      fontSize: overlayPx(10.5, fontScale),
      fontWeight: 650,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      marginBottom: overlayPx(6, fontScale),
    } as React.CSSProperties,
    saveCtaButton: {
      border: `1px solid ${OVERLAY_STYLE_TOKENS.successBorder}`,
      background: `color-mix(in srgb, ${OVERLAY_STYLE_TOKENS.successBg} 86%, transparent)`,
      color: OVERLAY_STYLE_TOKENS.success,
      borderRadius: overlayPx(8, fontScale),
      padding: `${overlayPx(8, fontScale)} ${overlayPx(12, fontScale)}`,
      fontSize: overlayPx(13, fontScale),
      fontWeight: 700,
      cursor: "pointer",
      width: "100%",
      textAlign: "center",
      marginTop: overlayPx(10, fontScale),
      fontFamily: OVERLAY_FONT_FAMILY,
    } as React.CSSProperties,
    dots: {
      color: OVERLAY_STYLE_TOKENS.textHint,
      animation: "astra-sel-pulse 1.5s ease-in-out infinite",
    } as React.CSSProperties,
  }
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
  const [actionResult, setActionResult] = useState<{
    actionId: string
    text: string
    languageLevel?: LanguageLevel
    explainMode?: ExplainMode
    matchedGlossaryTerms?: MatchedExplanationGlossaryTerm[]
  } | null>(null)
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
  const [fontScale, setFontScale] = useState(DEFAULT_ASTRA_CONFIG.presentation.fontSize)

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
    setFontScale(resolved.presentation.fontSize)
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

  const resolveConfig = async (): Promise<{
    config: AstraConfig
    targetLang: string
    enabled: boolean
    fontScale: number
  }> => {
    const config = await readConfig()
    const resolved = resolveSiteTranslationSettings(config, window.location.hostname)
    return {
      config,
      targetLang: resolved.targetLang,
      enabled: resolved.enabled,
      fontScale: resolved.presentation.fontSize,
    }
  }

  const handleAction = async (action: BuiltinAction) => {
    if (!selectedText || runningAction) return
    const requestVersion = selectionVersionRef.current
    const requestText = selectedText
    const requestContext = selectionContext
    setRunningAction(action.id)
    setActionResult(null)

    try {
      const { config, targetLang, enabled, fontScale: resolvedFontScale } = await resolveConfig()
      if (requestVersion !== selectionVersionRef.current) return
      setTargetLang(targetLang)
      setFontScale(resolvedFontScale)
      if (!enabled) {
        setActionResult({ actionId: action.id, text: "⚠ Astra is disabled on this site." })
        return
      }

      const result = await runActionById({
        actionId: action.id,
        text: requestText,
        targetLang,
        languageLevel: config.languageLevel,
        explainMode: config.explainMode,
        explanationGlossary: config.explanationGlossary,
        selectionContext: requestContext,
        contextElement: selectionContextElementRef.current,
        customActions: config.customActions,
      })

      if (requestVersion !== selectionVersionRef.current) return
      setActionResult({
        actionId: action.id,
        text: result.ok ? result.text : `⚠ ${result.message}`,
        ...(action.id === "explain" && result.ok
          ? {
              languageLevel: config.languageLevel,
              explainMode: config.explainMode,
              ...(result.matchedGlossaryTerms ? { matchedGlossaryTerms: result.matchedGlossaryTerms } : {}),
            }
          : {}),
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
    const successfulActionResult = actionResult && !actionResult.text.startsWith("⚠")
      ? actionResult
      : null
    const translation = successfulActionResult?.actionId === "translate"
      ? successfulActionResult.text
      : undefined
    const explanation = successfulActionResult?.actionId === "explain"
      ? successfulActionResult.text
      : undefined

    await saveVocabularyEntry({
      text: selectedText,
      translation,
      explanation,
      context: selectionContext,
      sourceContext: {
        surface: "selection_toolbar",
        pageTitle: document.title?.trim() || undefined,
        pageUrl: window.location.href,
        hostname: window.location.hostname,
        contentSummary: selectionContext,
        sentenceText: selectedText,
        ...(explanation
          ? {
              languageLevel: successfulActionResult?.languageLevel,
              explainMode: successfulActionResult?.explainMode,
              ...(successfulActionResult?.matchedGlossaryTerms
                ? { matchedGlossaryTerms: successfulActionResult.matchedGlossaryTerms }
                : {}),
            }
          : {}),
      },
      url: window.location.href,
      hostname: window.location.hostname,
      note: explanation,
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
    void commitLearningContinuitySync("selection-save")
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

  const styles = createStyles(fontScale)

  const hasActionError = Boolean(actionResult?.text.startsWith("⚠"))
  const hasResultPanelSaveCta = Boolean(
    actionResult
      && !hasActionError
      && (actionResult.actionId === "translate" || actionResult.actionId === "explain"),
  )
  const showInlineSaveCta = hasResultPanelSaveCta && !saved
  const showSaveInBar = !hasResultPanelSaveCta || saved
  const glossaryEvidenceLabel = actionResult?.matchedGlossaryTerms
    ? formatGlossaryEvidenceLabel(actionResult.matchedGlossaryTerms)
    : ""

  if (!visible) return null

  return (
    <div
      ref={toolbarRef}
      style={styles.toolbar(position)}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div style={styles.shellCard} data-testid="selection-toolbar-shell">
        <AstraIdentityStrip targetLang={targetLang} fontScale={fontScale} />
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
            ...(shared ? { color: OVERLAY_STYLE_TOKENS.success } : {}),
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
              ...(saved ? { color: OVERLAY_STYLE_TOKENS.success } : {}),
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
          borderLeftColor: saved ? OVERLAY_STYLE_TOKENS.success : actionResult?.actionId === "explain" ? OVERLAY_STYLE_TOKENS.brandActive : BRAND_COLOR,
          background: saved ? OVERLAY_STYLE_TOKENS.successBg : OVERLAY_STYLE_TOKENS.surface,
        }}>
          {runningAction ? (
            <span style={styles.dots}>⋯</span>
          ) : actionResult?.text ? (
            <div>
              {actionResult.actionId === "explain" && formatExplainProfileLabel(actionResult) && (
                <div
                  data-testid="selection-explain-profile"
                  style={{ ...styles.resultMeta, color: OVERLAY_STYLE_TOKENS.brandActive }}
                >
                  {formatExplainProfileLabel(actionResult)}
                </div>
              )}
              {glossaryEvidenceLabel && (
                <div
                  data-testid="selection-glossary-evidence"
                  style={{ ...styles.resultMeta, color: OVERLAY_STYLE_TOKENS.success }}
                >
                  {glossaryEvidenceLabel}
                </div>
              )}
              <div style={{
                ...styles.resultBody,
                ...(hasActionError ? { fontFamily: OVERLAY_FONT_FAMILY, fontStyle: "normal", fontSize: overlayPx(13, fontScale), color: OVERLAY_STYLE_TOKENS.warning } : {}),
              }}>
                {actionResult.text}
              </div>
            </div>
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
              {t("actionSave")}
            </button>
          )}

          {saved && (
            <div style={{
              marginTop: actionResult?.text ? Number.parseFloat(overlayPx(10, fontScale)) : 0,
              paddingTop: actionResult?.text ? Number.parseFloat(overlayPx(8, fontScale)) : 0,
              borderTop: actionResult?.text ? `1px solid ${OVERLAY_STYLE_TOKENS.successBorder}` : undefined,
            }}>
              <div style={{ fontWeight: 700, color: OVERLAY_STYLE_TOKENS.success, marginBottom: Number.parseFloat(overlayPx(4, fontScale)) }}>
                {t("learningSavedTitle")}
              </div>
              <div style={{ color: OVERLAY_STYLE_TOKENS.success, marginBottom: Number.parseFloat(overlayPx(8, fontScale)) }}>
                {t("learningSavedHint")}
              </div>
              <div style={{ display: "flex", gap: Number.parseFloat(overlayPx(8, fontScale)), flexWrap: "wrap" }}>
                <button
                  type="button"
                  style={{
                    ...styles.button,
                    background: OVERLAY_STYLE_TOKENS.successBg,
                    color: OVERLAY_STYLE_TOKENS.success,
                    borderColor: OVERLAY_STYLE_TOKENS.successBorder,
                    padding: `${overlayPx(6, fontScale)} ${overlayPx(10, fontScale)}`,
                  }}
                  onClick={(event) => {
                    event.stopPropagation()
                    openVocabulary()
                  }}
                >
                  {t("popup_vocabulary")}
                </button>
                <button
                  type="button"
                  style={{
                    ...styles.button,
                    background: OVERLAY_STYLE_TOKENS.successBg,
                    color: OVERLAY_STYLE_TOKENS.success,
                    borderColor: OVERLAY_STYLE_TOKENS.successBorder,
                    padding: `${overlayPx(6, fontScale)} ${overlayPx(10, fontScale)}`,
                  }}
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
        <div style={{ ...styles.resultPanel, borderLeftColor: OVERLAY_STYLE_TOKENS.info }} data-testid="word-annotation-card">
          <div style={{ display: "flex", alignItems: "baseline", gap: overlayPx(8, fontScale), marginBottom: overlayPx(4, fontScale), flexWrap: "wrap" }}>
            <strong style={{ fontFamily: QUIET_SERIF_FONT_FAMILY, fontSize: overlayPx(17, fontScale), fontWeight: 500 }}>{wordAnnotation.word}</strong>
            {wordAnnotation.pronunciation && (
              <span style={{ color: OVERLAY_STYLE_TOKENS.textMuted, fontSize: overlayPx(13, fontScale) }}>{wordAnnotation.pronunciation}</span>
            )}
            <span style={{
              display: "inline-block",
              padding: `${overlayPx(1, fontScale)} ${overlayPx(6, fontScale)}`,
              borderRadius: overlayPx(4, fontScale),
              background: OVERLAY_STYLE_TOKENS.infoBg,
              color: OVERLAY_STYLE_TOKENS.info,
              fontSize: overlayPx(12, fontScale),
              fontWeight: 500,
            }}>
              {wordAnnotation.partOfSpeech}
            </span>
          </div>
          <div style={{ marginBottom: overlayPx(4, fontScale), fontFamily: QUIET_SERIF_FONT_FAMILY, fontStyle: "italic", fontSize: overlayPx(15, fontScale) }}>{wordAnnotation.meaning}</div>
          <div style={{ color: OVERLAY_STYLE_TOKENS.textSecondary, fontSize: overlayPx(13, fontScale), marginBottom: overlayPx(4, fontScale) }}>{wordAnnotation.shortExplanation}</div>
          {wordAnnotation.exampleSentence && (
            <div style={{ color: OVERLAY_STYLE_TOKENS.textMuted, fontSize: overlayPx(13, fontScale), fontStyle: "italic" }}>{wordAnnotation.exampleSentence}</div>
          )}
        </div>
      )}

      {grammarResult && (
        <div style={{ ...styles.resultPanel, borderLeftColor: OVERLAY_STYLE_TOKENS.brandHover }} data-testid="grammar-card">
          <div style={{ fontFamily: QUIET_SERIF_FONT_FAMILY, fontStyle: "italic", fontWeight: 500, fontSize: overlayPx(15, fontScale), marginBottom: overlayPx(6, fontScale) }}>{grammarResult.overview}</div>
          {grammarResult.structure.length > 0 && (
            <ul style={{ margin: `0 0 ${overlayPx(6, fontScale)} 0`, paddingLeft: overlayPx(18, fontScale), fontSize: overlayPx(13, fontScale), color: OVERLAY_STYLE_TOKENS.textSecondary }}>
              {grammarResult.structure.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
          {grammarResult.keyPatterns.length > 0 && (
            <div style={{ marginBottom: overlayPx(6, fontScale) }}>
              {grammarResult.keyPatterns.map((pattern, i) => (
                <div key={i} style={{ fontSize: overlayPx(13, fontScale), color: OVERLAY_STYLE_TOKENS.textSecondary, marginBottom: overlayPx(2, fontScale) }}>
                  {pattern}
                </div>
              ))}
            </div>
          )}
          {grammarResult.vocabularyNotes.length > 0 && (
            <div>
              {grammarResult.vocabularyNotes.map((note, i) => (
                <div key={i} style={{ fontSize: overlayPx(13, fontScale), color: OVERLAY_STYLE_TOKENS.textMuted }}>
                  {note}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {grammarLoading && !grammarResult && (
        <div style={{ ...styles.resultPanel, borderLeftColor: OVERLAY_STYLE_TOKENS.brandHover }}>
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

  shadow.appendChild(createOverlayStyle1TokenStyleElement())

  const styleEl = document.createElement("style")
  styleEl.textContent = KEYFRAMES_CSS
  shadow.appendChild(styleEl)

  const container = document.createElement("div")
  shadow.appendChild(container)

  createRoot(container).render(<ErrorBoundary><SelectionToolbarApp /></ErrorBoundary>)
}
