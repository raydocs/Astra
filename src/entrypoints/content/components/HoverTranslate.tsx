import { useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"

import { resolveSiteTranslationSettings } from "@/types/config"
import { copyTextToClipboard } from "@/utils/dom/clipboard"
import { hasInjectedTranslation } from "@/utils/dom/inject"
import { findClosestTextBlock, findContentRoot } from "@/utils/dom/traversal"
import { readConfig } from "@/utils/storage/config"

import {
  getInteractionSuppressionState,
  hasActiveTextSelection,
  subscribeToInteractionSuppression,
} from "../interaction-coordination"
import { runInlineAction } from "../inline-actions"

type OverlayStatus = "hidden" | "pending" | "success" | "error"
type ExplanationStatus = "idle" | "pending" | "success" | "error"

interface HoverOverlayState {
  visible: boolean
  top: number
  left: number
  targetLang: string
  status: OverlayStatus
  translation: string | null
  error: string | null
  theme: "default" | "underline" | "highlight"
  mode: "bilingual" | "translation-only"
  triggerMode: "alt" | "always"
  explanationStatus: ExplanationStatus
  explanation: string | null
  explanationError: string | null
  showExplanation: boolean
}

interface HoverCacheEntry {
  sourceText: string
  targetLang: string
  translation: string
  explanation?: string
}

const HOVER_DELAY_MS = 280
const MAX_CONTEXT_CHARS = 400
const HOST_ID = "astra-hover-translate-host"

function getOverlayPosition(rect: DOMRect) {
  return {
    top: Math.max(8, rect.top - 8),
    left: Math.min(window.innerWidth - 320, Math.max(8, rect.left)),
  }
}

function getSelectionContext(text: string): string {
  return text.length > MAX_CONTEXT_CHARS
    ? `${text.slice(0, MAX_CONTEXT_CHARS).trim()}…`
    : text
}

function isEventInsideHoverOverlay(event: Event): boolean {
  const host = document.getElementById(HOST_ID)
  if (!host) return false

  const path = typeof event.composedPath === "function" ? event.composedPath() : []
  if (path.includes(host)) return true

  const target = event.target as Node | null
  return !!target && (host === target || host.contains(target))
}

function HoverTranslateApp() {
  const [overlay, setOverlay] = useState<HoverOverlayState>({
    visible: false,
    top: 0,
    left: 0,
    targetLang: "zh-CN",
    status: "hidden",
    translation: null,
    error: null,
    theme: "default",
    mode: "bilingual",
    triggerMode: "alt",
    explanationStatus: "idle",
    explanation: null,
    explanationError: null,
    showExplanation: false,
  })

  const hoverTimer = useRef<number | null>(null)
  const currentTarget = useRef<HTMLElement | null>(null)
  const currentSourceText = useRef("")
  const requestSeq = useRef(0)
  const explainRequestSeq = useRef(0)
  const cacheRef = useRef(new WeakMap<HTMLElement, HoverCacheEntry>())
  const pendingRef = useRef(new Map<HTMLElement, string>())
  const cooldownRef = useRef(new Map<HTMLElement, number>())
  const COOLDOWN_MS = 3000

  useEffect(() => {
    const clearHoverTimer = () => {
      if (hoverTimer.current !== null) {
        window.clearTimeout(hoverTimer.current)
        hoverTimer.current = null
      }
    }

    const hideOverlay = () => {
      clearHoverTimer()
      currentTarget.current = null
      currentSourceText.current = ""
      requestSeq.current += 1
      explainRequestSeq.current += 1
      setOverlay((current) => ({
        ...current,
        visible: false,
        status: "hidden",
        translation: null,
        error: null,
        explanationStatus: "idle",
        explanation: null,
        explanationError: null,
        showExplanation: false,
      }))
    }

    const showCachedOverlay = (
      rect: DOMRect,
      targetLang: string,
      cached: HoverCacheEntry,
      theme: HoverOverlayState["theme"],
      mode: HoverOverlayState["mode"],
      triggerMode: HoverOverlayState["triggerMode"] = "alt",
    ) => {
      setOverlay({
        visible: true,
        ...getOverlayPosition(rect),
        targetLang,
        status: "success",
        translation: cached.translation,
        error: null,
        theme,
        mode,
        triggerMode,
        explanationStatus: cached.explanation ? "success" : "idle",
        explanation: cached.explanation ?? null,
        explanationError: null,
        showExplanation: false,
      })
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        hideOverlay()
      }
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (isEventInsideHoverOverlay(event)) {
        return
      }

      if (getInteractionSuppressionState().hoverSuppressed || hasActiveTextSelection(document)) {
        hideOverlay()
        return
      }

      const root = findContentRoot(document)
      const block = findClosestTextBlock(event.target as Node | null, root)
      if (!block || hasInjectedTranslation(block.element)) {
        hideOverlay()
        return
      }

      if (currentTarget.current === block.element && overlay.visible) {
        const rect = block.element.getBoundingClientRect()
        setOverlay((current) => ({
          ...current,
          ...getOverlayPosition(rect),
        }))
        return
      }

      clearHoverTimer()
      currentTarget.current = block.element
      currentSourceText.current = block.text
      const rect = block.element.getBoundingClientRect()
      const altKeyWasPressed = event.altKey

      hoverTimer.current = window.setTimeout(() => {
        void (async () => {
          const config = await readConfig()
          const resolved = resolveSiteTranslationSettings(config, window.location.hostname)

          if (getInteractionSuppressionState().hoverSuppressed || hasActiveTextSelection(document)) {
            hideOverlay()
            return
          }

          if (resolved.hoverTrigger === "disabled") {
            hideOverlay()
            return
          }

          if (resolved.hoverTrigger === "alt" && !altKeyWasPressed) {
            hideOverlay()
            return
          }

          const triggerMode = resolved.hoverTrigger === "always" ? "always" as const : "alt" as const

          if (!resolved.enabled) {
            setOverlay({
              visible: true,
              ...getOverlayPosition(rect),
              targetLang: resolved.targetLang,
              status: "error",
              translation: null,
              error: "Astra is disabled on this site.",
              theme: resolved.presentation.theme,
              mode: resolved.presentation.mode,
              triggerMode,
              explanationStatus: "idle",
              explanation: null,
              explanationError: null,
              showExplanation: false,
            })
            return
          }

          const cached = cacheRef.current.get(block.element)
          if (cached && cached.sourceText === block.text && cached.targetLang === resolved.targetLang) {
            showCachedOverlay(
              rect,
              resolved.targetLang,
              cached,
              resolved.presentation.theme,
              resolved.presentation.mode,
              triggerMode,
            )
            return
          }

          if (pendingRef.current.get(block.element) === block.text) return

          const lastFail = cooldownRef.current.get(block.element)
          if (lastFail && Date.now() - lastFail < COOLDOWN_MS) return

          pendingRef.current.set(block.element, block.text)

          const nextRequest = requestSeq.current + 1
          requestSeq.current = nextRequest
          setOverlay({
            visible: true,
            ...getOverlayPosition(rect),
            targetLang: resolved.targetLang,
            status: "pending",
            translation: null,
            error: null,
            theme: resolved.presentation.theme,
            mode: resolved.presentation.mode,
            triggerMode,
            explanationStatus: "idle",
            explanation: null,
            explanationError: null,
            showExplanation: false,
          })

          const result = await runInlineAction({
            text: block.text,
            targetLang: resolved.targetLang,
            task: "translate",
            selectionContext: getSelectionContext(block.text),
          })

          pendingRef.current.delete(block.element)

          if (requestSeq.current !== nextRequest || currentTarget.current !== block.element) {
            return
          }

          if (!result.ok) {
            cooldownRef.current.set(block.element, Date.now())
            setOverlay({
              visible: true,
              ...getOverlayPosition(rect),
              targetLang: resolved.targetLang,
              status: "error",
              translation: null,
              error: result.message,
              theme: resolved.presentation.theme,
              mode: resolved.presentation.mode,
              triggerMode,
              explanationStatus: "idle",
              explanation: null,
              explanationError: null,
              showExplanation: false,
            })
            return
          }

          cacheRef.current.set(block.element, {
            sourceText: block.text,
            targetLang: resolved.targetLang,
            translation: result.text,
          })

          setOverlay({
            visible: true,
            ...getOverlayPosition(rect),
            targetLang: resolved.targetLang,
            status: "success",
            translation: result.text,
            error: null,
            theme: resolved.presentation.theme,
            mode: resolved.presentation.mode,
            triggerMode,
            explanationStatus: "idle",
            explanation: null,
            explanationError: null,
            showExplanation: false,
          })
        })()
      }, HOVER_DELAY_MS)
    }

    const unsubscribeSuppression = subscribeToInteractionSuppression((state) => {
      if (state.hoverSuppressed) {
        hideOverlay()
      }
    })

    const handleSelectionChange = () => {
      if (hasActiveTextSelection(document)) {
        hideOverlay()
      }
    }

    window.addEventListener("mousemove", handleMouseMove, true)
    window.addEventListener("scroll", hideOverlay, true)
    window.addEventListener("resize", hideOverlay)
    window.addEventListener("blur", hideOverlay)
    window.addEventListener("keydown", handleKeyDown, true)
    document.addEventListener("selectionchange", handleSelectionChange, true)

    return () => {
      unsubscribeSuppression()
      clearHoverTimer()
      window.removeEventListener("mousemove", handleMouseMove, true)
      window.removeEventListener("scroll", hideOverlay, true)
      window.removeEventListener("resize", hideOverlay)
      window.removeEventListener("blur", hideOverlay)
      window.removeEventListener("keydown", handleKeyDown, true)
      document.removeEventListener("selectionchange", handleSelectionChange, true)
    }
  }, [overlay.visible])

  const handleCopy = async () => {
    if (!overlay.translation) return
    await copyTextToClipboard(overlay.translation)
  }

  const handleExplain = async () => {
    if (overlay.status !== "success" || !currentTarget.current || !currentSourceText.current) return
    if (overlay.explanationStatus === "pending") return

    if (overlay.showExplanation) {
      setOverlay((current) => ({
        ...current,
        showExplanation: false,
      }))
      return
    }

    if (overlay.explanationStatus === "success" && overlay.explanation) {
      setOverlay((current) => ({
        ...current,
        showExplanation: true,
      }))
      return
    }

    const targetElement = currentTarget.current
    const requestId = requestSeq.current
    const explainRequestId = explainRequestSeq.current + 1
    explainRequestSeq.current = explainRequestId
    const sourceText = currentSourceText.current
    const selectionContext = getSelectionContext(sourceText)
    const targetLang = overlay.targetLang

    setOverlay((current) => ({
      ...current,
      explanationStatus: "pending",
      explanation: null,
      explanationError: null,
      showExplanation: true,
    }))

    const result = await runInlineAction({
      text: sourceText,
      targetLang,
      task: "explain",
      selectionContext,
    })

    if (
      requestSeq.current !== requestId
      || explainRequestSeq.current !== explainRequestId
      || currentTarget.current !== targetElement
    ) {
      return
    }

    if (!result.ok) {
      setOverlay((current) => ({
        ...current,
        explanationStatus: "error",
        explanation: null,
        explanationError: result.message,
        showExplanation: true,
      }))
      return
    }

    const cached = cacheRef.current.get(targetElement)
    if (cached && cached.sourceText === sourceText && cached.targetLang === targetLang) {
      cacheRef.current.set(targetElement, {
        ...cached,
        explanation: result.text,
      })
    }

    setOverlay((current) => ({
      ...current,
      explanationStatus: "success",
      explanation: result.text,
      explanationError: null,
      showExplanation: true,
    }))
  }

  if (!overlay.visible) return null

  const panelStyle: React.CSSProperties = {
    position: "fixed",
    top: overlay.top,
    left: overlay.left,
    maxWidth: 320,
    zIndex: 2147483645,
    background: "#fff",
    color: overlay.mode === "translation-only" ? "#0f172a" : "#334155",
    borderRadius: 10,
    boxShadow: "0 10px 25px rgba(15, 23, 42, 0.18)",
    padding: "10px 12px",
    lineHeight: 1.55,
    fontSize: 13,
    borderLeft: overlay.theme === "default" && overlay.mode === "bilingual"
      ? "3px solid #6366f1"
      : undefined,
    textDecoration: overlay.theme === "underline" ? "underline" : undefined,
    textDecorationColor: overlay.theme === "underline" ? "#6366f1" : undefined,
    backgroundColor: overlay.theme === "highlight" ? "rgba(99, 102, 241, 0.08)" : "#fff",
  }

  const actionButtonStyle: React.CSSProperties = {
    border: "none",
    background: "rgba(99, 102, 241, 0.08)",
    color: "#4f46e5",
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
  }

  return (
    <div style={panelStyle}>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>
        {overlay.triggerMode === "always" ? "Hover" : "Alt + Hover"}
      </div>
      {overlay.status === "pending" && <span style={{ color: "#94a3b8" }}>⋯</span>}
      {overlay.status === "error" && <span style={{ color: "#b45309" }}>⚠ {overlay.error}</span>}
      {overlay.status === "success" && (
        <>
          <div>{overlay.translation}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button type="button" style={actionButtonStyle} onClick={() => void handleCopy()}>
              Copy
            </button>
            <button type="button" style={actionButtonStyle} onClick={() => void handleExplain()}>
              {overlay.explanationStatus === "pending"
                ? "Explaining…"
                : overlay.showExplanation
                  ? "Hide explanation"
                  : "Explain"}
            </button>
          </div>
          {overlay.showExplanation && (
            <div
              style={{
                marginTop: 8,
                paddingTop: 8,
                borderTop: "1px solid rgba(148, 163, 184, 0.25)",
                color: "#0f172a",
              }}
            >
              {overlay.explanationStatus === "pending" && (
                <span style={{ color: "#94a3b8" }}>⋯</span>
              )}
              {overlay.explanationStatus === "error" && (
                <span style={{ color: "#b45309" }}>⚠ {overlay.explanationError}</span>
              )}
              {overlay.explanationStatus === "success" && overlay.explanation}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function mountHoverTranslate() {
  if (document.getElementById(HOST_ID)) return

  const host = document.createElement("div")
  host.id = HOST_ID
  host.style.position = "fixed"
  host.style.top = "0"
  host.style.left = "0"
  host.style.width = "0"
  host.style.height = "0"
  host.style.overflow = "visible"
  host.style.zIndex = "2147483645"
  document.documentElement.appendChild(host)

  const shadow = host.attachShadow({ mode: "open" })
  const container = document.createElement("div")
  shadow.appendChild(container)
  createRoot(container).render(<HoverTranslateApp />)
}
