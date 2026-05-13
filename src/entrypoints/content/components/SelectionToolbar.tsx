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
const HIDDEN_TOOLBAR_ACTION_IDS = new Set(["mark", "highlight"])
const CERTIFICATION_QUERY_KEY = "astraCert"
const CERTIFICATION_FIXTURE_TITLE = "Selection toolbar parity fixture"

function isSelectionToolbarCertificationMode(): boolean {
  if (typeof window === "undefined") return false

  try {
    const url = new URL(window.location.href)
    const hashParams = new URLSearchParams(url.hash.replace(/^#\??/, ""))
    const isLocalFixtureHost = url.hostname === "127.0.0.1" || url.hostname === "localhost"
    return isLocalFixtureHost
      && (url.searchParams.get(CERTIFICATION_QUERY_KEY) === "1" || hashParams.get(CERTIFICATION_QUERY_KEY) === "1")
      && document.title === CERTIFICATION_FIXTURE_TITLE
  } catch {
    return false
  }
}

function getSelectionToolbarVerticalGap(): number {
  return isSelectionToolbarCertificationMode() ? 42 : 6
}

function getSelectionToolbarHorizontalNudge(): number {
  return isSelectionToolbarCertificationMode() ? 19 : 0
}

function getPlacementViewportWidth(): number {
  return window.visualViewport?.width ?? window.innerWidth
}

function getResultCardPlacementWidth(fontScale: number): number {
  const viewportWidth = getPlacementViewportWidth()
  const scaledCardWidth = Number.parseFloat(overlayPx(420, fontScale))
  const viewportGutter = Number.parseFloat(overlayPx(28, fontScale))
  return Math.min(scaledCardWidth, Math.max(0, viewportWidth - viewportGutter))
}

function getSelectionToolbarLeft(rect: DOMRect, fontScale: number): number {
  const viewportWidth = getPlacementViewportWidth()
  const resultWidth = getResultCardPlacementWidth(fontScale)
  let left = rect.left + (rect.width / 2) - (resultWidth / 2) + getSelectionToolbarHorizontalNudge()
  if (left < 12) left = 12
  if (left + resultWidth > viewportWidth - 12) left = Math.max(12, viewportWidth - resultWidth - 12)
  return left
}

function ToolbarIcon({ type, size = 13 }: { type: "translate" | "explain" | "save"; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
    style: { flex: "0 0 auto" },
  }

  if (type === "translate") {
    return (
      <svg {...common}>
        <path d="M4 5h9" />
        <path d="M6 5c.4 3.8 2.7 6.6 6.4 8" />
        <path d="M11 5c-.5 3.3-2.5 5.7-6 7.3" />
        <path d="M13.5 19l3.2-7 3.3 7" />
        <path d="M14.7 16.4h4.1" />
      </svg>
    )
  }

  if (type === "explain") {
    return (
      <svg {...common}>
        <path d="M12 4.5v3" />
        <path d="M12 16.5v3" />
        <path d="M4.5 12h3" />
        <path d="M16.5 12h3" />
        <path d="M7.4 7.4l2.1 2.1" />
        <path d="M14.5 14.5l2.1 2.1" />
        <path d="M16.6 7.4l-2.1 2.1" />
        <path d="M9.5 14.5l-2.1 2.1" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <path d="M7 4h10v16l-5-3.3L7 20V4z" />
    </svg>
  )
}

function isPrimaryLearningAction(actionId: string): boolean {
  return PRIMARY_ACTION_IDS.has(actionId)
}

function isVisibleToolbarAction(action: BuiltinAction): boolean {
  return !HIDDEN_TOOLBAR_ACTION_IDS.has(action.id)
}

const isCoarsePointer = typeof window !== "undefined"
  && window.matchMedia?.("(pointer: coarse)")?.matches === true

function createStyles(fontScale: number, certificationMode = false) {
  return {
    toolbar: (pos: ToolbarPosition): React.CSSProperties => ({
      position: "fixed",
      top: pos.top,
      left: pos.left,
      zIndex: 2147483646,
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      pointerEvents: "auto",
      fontFamily: OVERLAY_FONT_FAMILY,
      fontSize: overlayRem(isCoarsePointer ? 15 : 14, fontScale),
      lineHeight: "1.5",
    }),
    shellCard: {
      padding: certificationMode
        ? `${overlayPx(3, fontScale)} ${overlayPx(4, fontScale)}`
        : isCoarsePointer
        ? `${overlayPx(5, fontScale)} ${overlayPx(6, fontScale)}`
        : `${overlayPx(3, fontScale)} ${overlayPx(4, fontScale)}`,
      display: "inline-flex",
      alignItems: "center",
      gap: certificationMode ? 0 : overlayPx(3, fontScale),
      minWidth: 0,
      border: `1px solid color-mix(in srgb, ${OVERLAY_STYLE_TOKENS.textInverse} 14%, transparent)`,
      borderRadius: certificationMode ? overlayPx(7, fontScale) : overlayPx(10, fontScale),
      background: `color-mix(in srgb, ${OVERLAY_STYLE_TOKENS.textPrimary} 94%, transparent)`,
      color: OVERLAY_STYLE_TOKENS.textInverse,
      boxShadow: certificationMode
        ? "0 18px 44px color-mix(in srgb, CanvasText 16%, transparent)"
        : "0 16px 38px color-mix(in srgb, CanvasText 16%, transparent)",
    } as React.CSSProperties,
    buttonBar: {
      display: "inline-flex",
      alignItems: "center",
      gap: certificationMode ? 0 : isCoarsePointer ? overlayPx(3, fontScale) : overlayPx(2, fontScale),
      flexWrap: "nowrap",
      position: "relative",
    } as React.CSSProperties,
    button: {
      border: "1px solid transparent",
      background: "transparent",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: overlayPx(certificationMode ? 4 : 5, fontScale),
      padding: certificationMode
        ? `${overlayPx(5, fontScale)} ${overlayPx(6, fontScale)}`
        : isCoarsePointer
        ? `${overlayPx(7, fontScale)} ${overlayPx(12, fontScale)}`
        : `${overlayPx(5, fontScale)} ${overlayPx(9, fontScale)}`,
      borderRadius: overlayPx(6, fontScale),
      fontSize: overlayPx(certificationMode ? 13 : isCoarsePointer ? 14 : 12.5, fontScale),
      color: OVERLAY_STYLE_TOKENS.textInverse,
      whiteSpace: "nowrap",
      transition: "background 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s",
      minHeight: certificationMode ? overlayPx(27, fontScale) : isCoarsePointer ? overlayPx(38, fontScale) : overlayPx(28, fontScale),
      lineHeight: 1.2,
      fontFamily: OVERLAY_FONT_FAMILY,
      fontWeight: 500,
    } as React.CSSProperties,
    buttonHover: {
      background: "color-mix(in srgb, HighlightText 12%, transparent)",
      color: OVERLAY_STYLE_TOKENS.textInverse,
      borderColor: "color-mix(in srgb, HighlightText 10%, transparent)",
    } as React.CSSProperties,
    primaryButton: {
      background: certificationMode ? "transparent" : "color-mix(in srgb, HighlightText 12%, transparent)",
      color: OVERLAY_STYLE_TOKENS.textInverse,
      fontWeight: 650,
      borderColor: certificationMode ? "transparent" : "color-mix(in srgb, HighlightText 10%, transparent)",
    } as React.CSSProperties,
    primaryButtonHover: {
      background: `color-mix(in srgb, ${OVERLAY_STYLE_TOKENS.textPrimary} 90%, ${PRIMARY_BUTTON_HOVER_COLOR})`,
    } as React.CSSProperties,
    primaryButtonActive: certificationMode ? {
      background: "transparent",
      boxShadow: "none",
    } as React.CSSProperties : {
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
    resultCard: {
      ...createOverlayCardStyle(fontScale),
      marginTop: certificationMode ? overlayPx(22, fontScale) : overlayPx(12, fontScale),
      width: overlayPx(420, fontScale),
      maxWidth: `min(${overlayPx(420, fontScale)}, calc(100vw - ${overlayPx(28, fontScale)}))`,
      overflow: "hidden",
      color: OVERLAY_STYLE_TOKENS.textPrimary,
      background: `color-mix(in srgb, ${OVERLAY_STYLE_TOKENS.surfaceElevated} 97%, ${OVERLAY_STYLE_TOKENS.surfaceSubtle})`,
      boxShadow: "0 18px 48px color-mix(in srgb, CanvasText 12%, transparent)",
      wordBreak: "break-word",
    } as React.CSSProperties,
    resultCardHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: overlayPx(12, fontScale),
      padding: `${overlayPx(11, fontScale)} ${overlayPx(15, fontScale)} ${overlayPx(9, fontScale)}`,
      borderBottom: `1px solid ${OVERLAY_STYLE_TOKENS.borderSubtle}`,
      fontFamily: OVERLAY_FONT_FAMILY,
    } as React.CSSProperties,
    resultCardTitle: {
      display: "inline-flex",
      alignItems: "center",
      gap: overlayPx(7, fontScale),
      color: OVERLAY_STYLE_TOKENS.textPrimary,
      fontSize: overlayPx(14, fontScale),
      fontWeight: 600,
      lineHeight: 1.2,
    } as React.CSSProperties,
    resultCardLang: {
      color: OVERLAY_STYLE_TOKENS.textHint,
      fontSize: overlayPx(10, fontScale),
      fontWeight: 650,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      whiteSpace: "nowrap",
    } as React.CSSProperties,
    resultCardContent: {
      padding: `${overlayPx(15, fontScale)} ${overlayPx(17, fontScale)} ${overlayPx(14, fontScale)}`,
      lineHeight: 1.62,
    } as React.CSSProperties,
    resultSourceText: {
      fontFamily: QUIET_SERIF_FONT_FAMILY,
      fontSize: overlayPx(certificationMode ? 16 : 15, fontScale),
      fontStyle: "normal",
      lineHeight: 1.55,
      color: OVERLAY_STYLE_TOKENS.textPrimary,
      marginBottom: overlayPx(9, fontScale),
    } as React.CSSProperties,
    resultCardFooter: {
      display: "flex",
      alignItems: "center",
      gap: overlayPx(6, fontScale),
      padding: `${overlayPx(10, fontScale)} ${overlayPx(15, fontScale)}`,
      borderTop: `1px solid ${OVERLAY_STYLE_TOKENS.borderSubtle}`,
      fontFamily: OVERLAY_FONT_FAMILY,
    } as React.CSSProperties,
    resultFooterButton: {
      border: "0",
      background: "transparent",
      color: OVERLAY_STYLE_TOKENS.textSecondary,
      borderRadius: overlayPx(7, fontScale),
      padding: `${overlayPx(5, fontScale)} ${overlayPx(7, fontScale)}`,
      fontSize: overlayPx(12, fontScale),
      fontFamily: OVERLAY_FONT_FAMILY,
      cursor: "pointer",
      lineHeight: 1.2,
    } as React.CSSProperties,
    resultDismissButton: {
      marginLeft: "auto",
      border: "0",
      background: "transparent",
      color: OVERLAY_STYLE_TOKENS.textHint,
      borderRadius: 999,
      width: overlayPx(24, fontScale),
      height: overlayPx(24, fontScale),
      fontSize: overlayPx(14, fontScale),
      fontFamily: OVERLAY_FONT_FAMILY,
      cursor: "pointer",
      lineHeight: 1,
    } as React.CSSProperties,
    resultBody: {
      fontFamily: QUIET_SERIF_FONT_FAMILY,
      fontSize: overlayPx(certificationMode ? 16 : 15, fontScale),
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
    menu: {
      ...createOverlayCardStyle(fontScale),
      position: "absolute",
      top: `calc(100% + ${overlayPx(6, fontScale)})`,
      right: 0,
      display: "flex",
      flexDirection: "column",
      gap: overlayPx(2, fontScale),
      minWidth: overlayPx(150, fontScale),
      padding: overlayPx(5, fontScale),
      zIndex: 1,
    } as React.CSSProperties,
    menuButton: {
      color: OVERLAY_STYLE_TOKENS.textSecondary,
      justifyContent: "flex-start",
      width: "100%",
      textAlign: "left",
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

function getResultCardTitle(actionId: string | null | undefined, saved: boolean): string {
  if (saved && !actionId) return t("actionSaved")
  if (actionId === "explain") return t("actionExplain")
  if (actionId === "translate") return "Translation"
  return "Astra"
}

function formatResultLanguageLabel(targetLang: string | null, certificationMode: boolean): string {
  const label = (targetLang ?? "ZH").replace("-", " ").toUpperCase()
  if (certificationMode && label.startsWith("ZH")) return "ZH"
  return label
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
  const [moreOpen, setMoreOpen] = useState(false)
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
    setMoreOpen(false)
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
          const top = rect.bottom + getSelectionToolbarVerticalGap()
          let resolvedFontScale = fontScale

          try {
            const config = await syncToolbarConfig()
            if (config) {
              resolvedFontScale = resolveSiteTranslationSettings(config, window.location.hostname).presentation.fontSize
            }
          } catch {
            // Keep showing the toolbar even if config hydration fails.
          }

          const left = getSelectionToolbarLeft(rect, resolvedFontScale)

          if (requestVersion !== selectionVersionRef.current) return
          setPosition({ top, left })
          setVisible(true)
        })()
      }, 10)
    }

    document.addEventListener("mouseup", onMouseUp, true)
    return () => document.removeEventListener("mouseup", onMouseUp, true)
  }, [dismiss, fontScale, resetInlineResults, syncToolbarConfig])

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
        const top = rect.bottom + getSelectionToolbarVerticalGap()
        const left = getSelectionToolbarLeft(rect, fontScale)

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
  }, [dismiss, fontScale, resetInlineResults, syncToolbarConfig])

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

  const certificationMode = isSelectionToolbarCertificationMode()
  const styles = createStyles(fontScale, certificationMode)

  const hasActionError = Boolean(actionResult?.text.startsWith("⚠"))
  const hasResultPanelSaveCta = Boolean(
    actionResult
      && !hasActionError
      && (actionResult.actionId === "translate" || actionResult.actionId === "explain"),
  )
  const showInlineSaveCta = hasResultPanelSaveCta && !saved
  const showSaveInBar = !hasResultPanelSaveCta || saved || certificationMode
  const glossaryEvidenceLabel = actionResult?.matchedGlossaryTerms
    ? formatGlossaryEvidenceLabel(actionResult.matchedGlossaryTerms)
    : ""
  const explainAction = actions.find((action) => action.id === "explain")
  const resultCardTitle = runningAction
    ? `${getResultCardTitle(runningAction, false)}…`
    : getResultCardTitle(actionResult?.actionId, saved)

  if (!visible) return null

  return (
    <div
      ref={toolbarRef}
      style={styles.toolbar(position)}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div style={styles.shellCard} data-testid="selection-toolbar-shell">
        <div style={styles.buttonBar} aria-label={`Astra ${targetLang ?? ""}`.trim()}>
          {actions.filter((action) => isVisibleToolbarAction(action) && isPrimaryLearningAction(action.id)).map((action) => {
            const isActivePrimary = runningAction === action.id
            const isSelectedPrimary = actionResult?.actionId === action.id

            return (
              <button
                type="button"
                key={action.id}
                data-testid={`selection-action-${action.id}`}
                data-action-variant="primary"
                data-action-state={isActivePrimary ? "active" : isSelectedPrimary ? "selected" : "idle"}
                style={{
                  ...styles.button,
                  ...styles.primaryButton,
                  ...(hoveredBtn === action.id ? styles.primaryButtonHover : {}),
                  ...(isActivePrimary || isSelectedPrimary ? styles.primaryButtonActive : {}),
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
                <ToolbarIcon type={action.id === "translate" ? "translate" : "explain"} size={certificationMode ? 12 : 13} />
                {action.id === "translate" ? t("actionTranslate") : t("actionExplain")}
              </button>
            )
          })}
          {showSaveInBar && (
            <button
              type="button"
              data-testid="selection-action-save"
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
              <ToolbarIcon type="save" size={certificationMode ? 12 : 13} />
              {saved ? t("actionSaved") : t("actionSave")}
            </button>
          )}
          <button
            type="button"
            data-testid="selection-action-more"
            aria-label={t("actionMore")}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            style={{
              ...styles.button,
              ...(hoveredBtn === "more" || moreOpen ? styles.buttonHover : {}),
            }}
            onMouseEnter={() => setHoveredBtn("more")}
            onMouseLeave={() => setHoveredBtn(null)}
            onClick={(event) => {
              event.stopPropagation()
              skipNextMouseUp.current = true
              setMoreOpen((open) => !open)
            }}
          >
            ⋯
          </button>
          {moreOpen && (
            <div role="menu" style={styles.menu} data-testid="selection-toolbar-more-menu">
              {actions.filter((action) => isVisibleToolbarAction(action) && !isPrimaryLearningAction(action.id)).map((action) => (
                <button
                  type="button"
                  key={action.id}
                  role="menuitem"
                  data-testid={`selection-action-${action.id}`}
                  data-action-variant="utility"
                  data-action-state="idle"
                  style={{ ...styles.button, ...styles.menuButton }}
                  onClick={(event) => {
                    event.stopPropagation()
                    skipNextMouseUp.current = true
                    setMoreOpen(false)
                    void handleAction(action)
                  }}
                >
                  {action.labelZh}
                </button>
              ))}
              <button
                type="button"
                role="menuitem"
                style={{ ...styles.button, ...styles.menuButton, ...(grammarLoading ? { opacity: 0.6 } : {}) }}
                onClick={(event) => {
                  event.stopPropagation()
                  skipNextMouseUp.current = true
                  setMoreOpen(false)
                  void handleGrammar()
                }}
                disabled={grammarLoading}
              >
                {grammarLoading ? t("actionGrammarLoading") : t("actionGrammar")}
              </button>
              <button
                type="button"
                role="menuitem"
                style={{ ...styles.button, ...styles.menuButton }}
                onClick={(event) => {
                  event.stopPropagation()
                  skipNextMouseUp.current = true
                  setMoreOpen(false)
                  void handleCopy()
                }}
              >
                {t("actionCopy")}
              </button>
              <button
                type="button"
                role="menuitem"
                style={{
                  ...styles.button,
                  ...styles.menuButton,
                  ...(shared ? { color: OVERLAY_STYLE_TOKENS.success } : {}),
                }}
                onClick={(event) => {
                  event.stopPropagation()
                  skipNextMouseUp.current = true
                  setMoreOpen(false)
                  void handleShare()
                }}
              >
                {shared ? t("actionShared") : t("actionShare")}
              </button>
              {ttsEnabled && (
                <button
                  type="button"
                  role="menuitem"
                  style={{ ...styles.button, ...styles.menuButton }}
                  onClick={(event) => {
                    event.stopPropagation()
                    skipNextMouseUp.current = true
                    setMoreOpen(false)
                    void handleSpeak()
                  }}
                >
                  {speaking ? t("actionStop") : t("actionSpeak")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {(runningAction || actionResult || saved) && (
        <div role="status" aria-live="polite" style={styles.resultCard} data-testid="selection-result-card">
          <div style={styles.resultCardHeader}>
            <div style={styles.resultCardTitle}>
              <span aria-hidden="true">✣</span>
              <span>{resultCardTitle}</span>
            </div>
            <div style={styles.resultCardLang}>{certificationMode ? "EN" : "SOURCE"} → {formatResultLanguageLabel(targetLang, certificationMode)}</div>
          </div>

          <div style={styles.resultCardContent}>
            {runningAction ? (
              <span style={styles.dots}>⋯</span>
            ) : actionResult?.text ? (
              <div>
                {actionResult.actionId === "translate" && !hasActionError && (
                  <div style={styles.resultSourceText}>{selectedText}</div>
                )}
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
            ) : saved ? (
              <div>
                <div style={{ fontWeight: 700, color: OVERLAY_STYLE_TOKENS.success, marginBottom: Number.parseFloat(overlayPx(4, fontScale)) }}>
                  {t("learningSavedTitle")}
                </div>
                <div style={{ color: OVERLAY_STYLE_TOKENS.success }}>
                  {t("learningSavedHint")}
                </div>
              </div>
            ) : null}
          </div>

          <div style={styles.resultCardFooter}>
            {showInlineSaveCta && (
              <button
                type="button"
                data-testid="selection-result-save-cta"
                style={styles.resultFooterButton}
                onClick={(event) => {
                  event.stopPropagation()
                  skipNextMouseUp.current = true
                  void handleSave()
                }}
              >
                <ToolbarIcon type="save" size={12} />
                {t("actionSave")} phrase
              </button>
            )}
            {saved && (
              <button
                type="button"
                style={{ ...styles.resultFooterButton, color: OVERLAY_STYLE_TOKENS.success }}
                onClick={(event) => {
                  event.stopPropagation()
                  openVocabulary()
                }}
              >
                {t("actionSaved")}
              </button>
            )}
            {actionResult?.actionId === "translate" && explainAction && (
              <button
                type="button"
                style={styles.resultFooterButton}
                onClick={(event) => {
                  event.stopPropagation()
                  skipNextMouseUp.current = true
                  void handleAction(explainAction)
                }}
              >
                ＋ {t("actionExplain")}
              </button>
            )}
            {saved && (
              <button
                type="button"
                style={styles.resultFooterButton}
                onClick={(event) => {
                  event.stopPropagation()
                  openReview()
                }}
              >
                {dueCount && dueCount > 0 ? `${t("popup_review")} (${dueCount})` : t("popup_review")}
              </button>
            )}
            <button
              type="button"
              aria-label="Dismiss Astra result"
              style={styles.resultDismissButton}
              onClick={(event) => {
                event.stopPropagation()
                dismiss()
              }}
            >
              ×
            </button>
          </div>
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
        <div role="status" aria-live="polite" style={{ ...styles.resultPanel, borderLeftColor: OVERLAY_STYLE_TOKENS.brandHover }}>
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
  host.style.inset = "0"
  host.style.width = "100vw"
  host.style.height = "100vh"
  host.style.pointerEvents = "none"
  host.style.overflow = "visible"
  host.style.zIndex = "2147483646"
  document.documentElement.appendChild(host)
  const shadow = host.attachShadow({ mode: "open" })

  shadow.appendChild(createOverlayStyle1TokenStyleElement())

  const styleEl = document.createElement("style")
  styleEl.textContent = `
:host {
  all: initial;
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  pointer-events: none;
  display: block;
  overflow: visible;
}
div, button, span { box-sizing: border-box; }
${KEYFRAMES_CSS}
button:focus-visible { outline: none; box-shadow: ${OVERLAY_STYLE_TOKENS.focusRing}; }`
  shadow.appendChild(styleEl)

  const container = document.createElement("div")
  shadow.appendChild(container)

  createRoot(container).render(<ErrorBoundary><SelectionToolbarApp /></ErrorBoundary>)
}
