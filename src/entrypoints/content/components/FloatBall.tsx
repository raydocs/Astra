import React, { useState, useRef, useCallback, useEffect } from "react"
import ReactDOM from "react-dom/client"
import { browser } from "#imports"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { t } from "@/utils/i18n"
import { retryFailedBlocks, subscribePageTranslationState } from "../page-translate"
import { toggleCurrentTabTranslation } from "@/utils/extension/messages"
import { IDLE_TRANSLATION_SNAPSHOT } from "@/types/translation"
import { getLearningState, subscribeLearningState, type LearningStateSnapshot } from "../learning-state"
import { readConfig } from "@/utils/storage/config"
import { resolveSiteTranslationSettings } from "@/types/config"
import { OVERLAY_FONT_FAMILY, OVERLAY_STYLE_TOKENS, createOverlayStyle1TokenStyleElement, overlayPx } from "./overlayScale"

const STORAGE_KEY = "astra_float_ball_y"
const DEFAULT_Y = 300
const BALL_SIZE = 44
const EDGE_TAB_IDLE_WIDTH = 3
const EDGE_TAB_EXPANDED_WIDTH = 34

const COLOR_IDLE = OVERLAY_STYLE_TOKENS.brand
const COLOR_ACTIVE = OVERLAY_STYLE_TOKENS.success
const COLOR_BUSY = OVERLAY_STYLE_TOKENS.brandActive
const COLOR_ERROR = OVERLAY_STYLE_TOKENS.warning
const COLOR_LEARNING = OVERLAY_STYLE_TOKENS.success
const SAVE_PULSE_MS = 1200

function getFloatBallVisualState(
  snapshot: typeof IDLE_TRANSLATION_SNAPSHOT,
  learningState: LearningStateSnapshot,
) {
  if (snapshot.phase === "starting" || snapshot.phase === "stopping") {
    return {
      color: COLOR_BUSY,
      tooltip: snapshot.phase === "starting" ? t("floatball_preparingTranslation") : t("floatball_removingTranslation"),
      disabled: true,
      progressText: null,
      failedBlocks: 0,
      reviewReady: false,
    }
  }

  if (snapshot.phase === "running") {
    return {
      color: snapshot.progress.failedBlocks > 0 ? COLOR_ERROR : COLOR_ACTIVE,
      tooltip: `Translated: ${snapshot.progress.translatedBlocks}/${snapshot.progress.totalBlocks} | Failed: ${snapshot.progress.failedBlocks}`,
      disabled: false,
      progressText: `${snapshot.progress.translatedBlocks}/${snapshot.progress.totalBlocks}`,
      failedBlocks: snapshot.progress.failedBlocks,
      reviewReady: false,
    }
  }

  if (snapshot.lastError) {
    return {
      color: COLOR_ERROR,
      tooltip: t("floatball_translationFailed", snapshot.lastError.message),
      disabled: false,
      progressText: null,
      failedBlocks: 0,
      reviewReady: false,
    }
  }

  if (learningState.hasSavedThisSession && learningState.savesThisSession > 0) {
    const reviewCount = typeof learningState.lastDueCount === "number"
      ? learningState.lastDueCount
      : learningState.savesThisSession

    return {
      color: COLOR_LEARNING,
      tooltip: `${t("popup_review")}: ${reviewCount}`,
      disabled: false,
      progressText: reviewCount > 99 ? "99+" : `${reviewCount}`,
      failedBlocks: 0,
      reviewReady: true,
    }
  }

  return {
    color: COLOR_IDLE,
    tooltip: t("floatball_translatePage"),
    disabled: false,
    progressText: null,
    failedBlocks: 0,
    reviewReady: false,
  }
}

function clampY(y: number): number {
  const maxY = window.innerHeight - BALL_SIZE - 10
  return Math.max(10, Math.min(y, maxY))
}

function FloatBallButton() {
  const [translationState, setTranslationState] = useState(IDLE_TRANSLATION_SNAPSHOT)
  const [learningState, setLearningState] = useState(() => getLearningState())
  const [posY, setPosY] = useState(DEFAULT_Y)
  const [dragging, setDragging] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [learningPulseActive, setLearningPulseActive] = useState(false)
  const [fontScale, setFontScale] = useState(0.92)
  const dragRef = useRef<{ startY: number; startPosY: number } | null>(null)
  const movedRef = useRef(false)
  const posYRef = useRef(posY)
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pulsedAtRef = useRef<number | null>(null)

  useEffect(() => {
    void browser.storage.local.get(STORAGE_KEY).then((result) => {
      const saved = result[STORAGE_KEY]
      if (typeof saved === "number") {
        setPosY(clampY(saved))
      }
    })
  }, [])

  useEffect(() => {
    posYRef.current = posY
  }, [posY])

  useEffect(() => {
    return subscribePageTranslationState(setTranslationState)
  }, [])

  useEffect(() => {
    return subscribeLearningState(setLearningState)
  }, [])

  useEffect(() => {
    const syncFontScale = async () => {
      try {
        const config = await readConfig()
        const resolved = resolveSiteTranslationSettings(config, window.location.hostname)
        setFontScale(resolved.presentation.fontSize)
      } catch {
        setFontScale(0.92)
      }
    }

    void syncFontScale()

    const onStorageChange = (
      _changes: Record<string, unknown>,
      areaName: string,
    ) => {
      if (areaName !== "local") return
      void syncFontScale()
    }

    browser.storage.onChanged.addListener(onStorageChange)
    return () => browser.storage.onChanged.removeListener(onStorageChange)
  }, [])

  useEffect(() => {
    if (!learningState.lastSavedAt) return
    if (pulsedAtRef.current === learningState.lastSavedAt) return

    pulsedAtRef.current = learningState.lastSavedAt
    setLearningPulseActive(true)

    if (pulseTimeoutRef.current) {
      clearTimeout(pulseTimeoutRef.current)
    }

    pulseTimeoutRef.current = setTimeout(() => {
      setLearningPulseActive(false)
      pulseTimeoutRef.current = null
    }, SAVE_PULSE_MS)
  }, [learningState.lastSavedAt])

  useEffect(() => () => {
    if (pulseTimeoutRef.current) {
      clearTimeout(pulseTimeoutRef.current)
      pulseTimeoutRef.current = null
    }
  }, [])

  const persistY = useCallback((y: number) => {
    void browser.storage.local.set({ [STORAGE_KEY]: y })
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragging(true)
      movedRef.current = false
      dragRef.current = { startY: e.clientY, startPosY: posYRef.current }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !dragRef.current) return
      e.preventDefault()
      e.stopPropagation()
      const delta = e.clientY - dragRef.current.startY
      if (Math.abs(delta) > 3) movedRef.current = true
      const newY = clampY(dragRef.current.startPosY + delta)
      posYRef.current = newY
      setPosY(newY)
    },
    [dragging],
  )

  const openReview = useCallback(() => {
    void browser.tabs.create({ url: browser.runtime.getURL("/vocabulary.html?tab=review") })
  }, [])

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return
      e.preventDefault()
      e.stopPropagation()
      setDragging(false)
      persistY(posYRef.current)

      const visual = getFloatBallVisualState(translationState, learningState)
      if (!movedRef.current && !visual.disabled) {
        if (visual.failedBlocks > 0) {
          retryFailedBlocks()
        } else if (visual.reviewReady) {
          openReview()
        } else {
          void toggleCurrentTabTranslation().catch((error) => {
            console.error("[Astra] Float ball toggle failed:", error)
          })
        }
      }
      dragRef.current = null
    },
    [dragging, learningState, openReview, persistY, translationState],
  )

  const visual = getFloatBallVisualState(translationState, learningState)

  const activate = useCallback(() => {
    if (visual.disabled) return

    if (visual.failedBlocks > 0) {
      retryFailedBlocks()
    } else if (visual.reviewReady) {
      openReview()
    } else {
      void toggleCurrentTabTranslation().catch((error) => {
        console.error("[Astra] Float ball toggle failed:", error)
      })
    }
  }, [openReview, visual.disabled, visual.failedBlocks, visual.reviewReady])

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault()
    event.stopPropagation()
    activate()
  }, [activate])
  const showLearningPulse = learningPulseActive && visual.reviewReady
  const expanded = hovered || focused || dragging || Boolean(visual.progressText) || visual.failedBlocks > 0 || visual.reviewReady || showLearningPulse
  const tabWidth = expanded ? EDGE_TAB_EXPANDED_WIDTH : EDGE_TAB_IDLE_WIDTH

  return (
    <div
      role="button"
      tabIndex={visual.disabled ? -1 : 0}
      aria-label={visual.tooltip}
      aria-disabled={visual.disabled || undefined}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        position: "fixed",
        right: 0,
        top: posY,
        width: tabWidth,
        height: BALL_SIZE,
        zIndex: 2147483647,
        cursor: dragging ? "grabbing" : visual.disabled ? "progress" : "pointer",
        userSelect: "none",
        touchAction: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: expanded
          ? `color-mix(in srgb, ${visual.color} 82%, ${OVERLAY_STYLE_TOKENS.surfaceElevated})`
          : `color-mix(in srgb, ${OVERLAY_STYLE_TOKENS.textPrimary} 22%, transparent)`,
        color: OVERLAY_STYLE_TOKENS.textInverse,
        borderTop: expanded
          ? `1px solid ${focused ? `color-mix(in srgb, ${visual.color} 34%, transparent)` : `color-mix(in srgb, ${visual.color} 18%, transparent)`}`
          : "1px solid transparent",
        borderBottom: expanded
          ? `1px solid ${focused ? `color-mix(in srgb, ${visual.color} 34%, transparent)` : `color-mix(in srgb, ${visual.color} 18%, transparent)`}`
          : "1px solid transparent",
        borderLeft: expanded
          ? `1px solid ${focused ? `color-mix(in srgb, ${visual.color} 34%, transparent)` : `color-mix(in srgb, ${visual.color} 18%, transparent)`}`
          : "1px solid transparent",
        borderRight: "none",
        borderRadius: `${overlayPx(12, fontScale)} 0 0 ${overlayPx(12, fontScale)}`,
        boxShadow: focused
          ? `0 0 0 3px color-mix(in srgb, ${visual.color} 18%, transparent), -1px 4px 12px color-mix(in srgb, ${visual.color} 14%, transparent)`
          : showLearningPulse
            ? `0 0 0 4px color-mix(in srgb, ${COLOR_LEARNING} 10%, transparent), -1px 4px 12px color-mix(in srgb, ${visual.color} 14%, transparent)`
            : expanded
              ? `-1px 4px 12px color-mix(in srgb, ${visual.color} 14%, transparent)`
              : "none",
        transition: dragging ? "none" : "width 0.18s ease, background 0.25s, box-shadow 0.25s, opacity 0.2s, top 0.15s",
        animation: showLearningPulse ? "astra-floatball-learning-pulse 0.8s ease-out" : undefined,
        opacity: visual.disabled ? 0.72 : expanded ? 0.9 : 0.32,
        outline: "none",
      }}
      title={visual.tooltip}
    >
      {hovered && !dragging && (
        <div
          style={{
            position: "absolute",
            right: tabWidth + 8,
            top: "50%",
            transform: "translateY(-50%)",
            background: OVERLAY_STYLE_TOKENS.tooltipBg,
            color: OVERLAY_STYLE_TOKENS.textInverse,
            fontSize: overlayPx(12, fontScale),
            padding: `${overlayPx(4, fontScale)} ${overlayPx(10, fontScale)}`,
            borderRadius: overlayPx(8, fontScale),
            whiteSpace: "nowrap",
            pointerEvents: "none",
            lineHeight: "1.4",
            fontFamily: OVERLAY_FONT_FAMILY,
            maxWidth: 260,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {visual.failedBlocks > 0 ? `Retry ${visual.failedBlocks} failed` : visual.tooltip}
        </div>
      )}
      {visual.progressText ? (
        <span
          style={{
            color: OVERLAY_STYLE_TOKENS.textInverse,
            fontSize: overlayPx(11, fontScale),
            fontWeight: "bold",
            lineHeight: 1,
            pointerEvents: "none",
            fontFamily: OVERLAY_FONT_FAMILY,
            opacity: expanded ? 1 : 0,
            transition: "opacity 0.12s ease",
          }}
        >
          {visual.progressText}
        </span>
      ) : (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          style={{
            pointerEvents: "none",
            opacity: expanded ? 1 : 0,
            transition: "opacity 0.12s ease",
          }}
        >
          <path
            d="M12 2 L14.5 9 L22 9.5 L16 14.5 L18 22 L12 17.5 L6 22 L8 14.5 L2 9.5 L9.5 9 Z"
            fill={OVERLAY_STYLE_TOKENS.textInverse}
          />
        </svg>
      )}
    </div>
  )
}

export function mountFloatBall() {
  const existing = document.getElementById("astra-float-ball-host")
  if (existing) return

  const host = document.createElement("div")
  host.id = "astra-float-ball-host"
  const shadow = host.attachShadow({ mode: "open" })

  shadow.appendChild(createOverlayStyle1TokenStyleElement())

  const resetStyle = document.createElement("style")
  resetStyle.textContent = `
    :host {
      all: initial;
      position: fixed;
      top: 0;
      right: 0;
      z-index: 2147483647;
      pointer-events: none;
    }
    div { pointer-events: auto; }

    @keyframes astra-floatball-learning-pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.12); }
      100% { transform: scale(1); }
    }
  `
  shadow.appendChild(resetStyle)

  const mountPoint = document.createElement("div")
  shadow.appendChild(mountPoint)
  document.documentElement.appendChild(host)

  const root = ReactDOM.createRoot(mountPoint)
  root.render(<ErrorBoundary><FloatBallButton /></ErrorBoundary>)
}
