import React, { useCallback, useEffect, useState } from "react"
import ReactDOM from "react-dom/client"
import { browser } from "#imports"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { t } from "@/utils/i18n"
import { retryFailedBlocks, stopPageTranslation, subscribePageTranslationState } from "../page-translate"
import { toggleCurrentTabTranslation } from "@/utils/extension/messages"
import { IDLE_TRANSLATION_SNAPSHOT, type TranslationSnapshot } from "@/types/translation"
import { getLearningState, subscribeLearningState, type LearningStateSnapshot } from "../learning-state"
import { readConfig } from "@/utils/storage/config"
import { resolveSiteTranslationSettings } from "@/types/config"
import { OVERLAY_FONT_FAMILY, OVERLAY_FONT_FAMILY_SERIF, OVERLAY_STYLE_TOKENS, createOverlayStyle1TokenStyleElement, overlayPx } from "./overlayScale"

const COLOR_IDLE = OVERLAY_STYLE_TOKENS.textSecondary
const COLOR_ACTIVE = OVERLAY_STYLE_TOKENS.success
const COLOR_BUSY = OVERLAY_STYLE_TOKENS.brandActive
const COLOR_ERROR = OVERLAY_STYLE_TOKENS.warning
const COLOR_LEARNING = OVERLAY_STYLE_TOKENS.success
const SAVE_PULSE_MS = 1200

type AstraContentCertificationParams = {
  enabled: boolean
  progressDone: number | null
  progressTotal: number | null
  hideProgress: boolean
  hideStatus: boolean
}

function readAstraContentCertificationParams(): AstraContentCertificationParams {
  if (typeof window === "undefined") {
    return {
      enabled: false,
      progressDone: null,
      progressTotal: null,
      hideProgress: false,
      hideStatus: false,
    }
  }

  try {
    const searchParams = new URLSearchParams(window.location.search)
    const hashParams = window.location.hash.includes("?")
      ? new URLSearchParams(window.location.hash.split("?", 2)[1] ?? "")
      : new URLSearchParams()
    const enabled = searchParams.get("astraCert") === "1" || hashParams.get("astraCert") === "1"
    const param = (key: string) => searchParams.get(key) ?? hashParams.get(key)
    const toPositiveInt = (value: string | null): number | null => {
      if (!enabled || value === null) return null
      const parsed = Number.parseInt(value, 10)
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
    }

    return {
      enabled,
      progressDone: toPositiveInt(param("astraCertProgressDone")),
      progressTotal: toPositiveInt(param("astraCertProgressTotal")),
      hideProgress: enabled && param("astraCertHideProgress") === "1",
      hideStatus: enabled && param("astraCertHideStatus") === "1",
    }
  } catch {
    return {
      enabled: false,
      progressDone: null,
      progressTotal: null,
      hideProgress: false,
      hideStatus: false,
    }
  }
}

function getQuietStatusVisualState(
  snapshot: TranslationSnapshot,
  learningState: LearningStateSnapshot,
) {
  if (snapshot.phase === "starting" || snapshot.phase === "stopping") {
    return {
      color: COLOR_BUSY,
      label: snapshot.phase === "starting" ? "Preparing" : "Removing",
      tooltip: snapshot.phase === "starting" ? t("floatball_preparingTranslation") : t("floatball_removingTranslation"),
      disabled: true,
      progressText: null as string | null,
      failedBlocks: 0,
      reviewReady: false,
    }
  }

  if (snapshot.phase === "running") {
    return {
      color: snapshot.progress.failedBlocks > 0 ? COLOR_ERROR : COLOR_ACTIVE,
      label: snapshot.progress.failedBlocks > 0 ? "Needs retry" : "Translating",
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
      label: "Translation paused",
      tooltip: t("floatball_translationFailed", snapshot.lastError.message),
      disabled: false,
      progressText: null,
      failedBlocks: snapshot.progress.failedBlocks,
      reviewReady: false,
    }
  }

  if (learningState.hasSavedThisSession && learningState.savesThisSession > 0) {
    const reviewCount = typeof learningState.lastDueCount === "number"
      ? learningState.lastDueCount
      : learningState.savesThisSession

    return {
      color: COLOR_LEARNING,
      label: "Review ready",
      tooltip: `${t("popup_review")}: ${reviewCount}`,
      disabled: false,
      progressText: reviewCount > 99 ? "99+" : `${reviewCount}`,
      failedBlocks: 0,
      reviewReady: true,
    }
  }

  return {
    color: COLOR_IDLE,
    label: "Astra",
    tooltip: t("floatball_translatePage"),
    disabled: false,
    progressText: null,
    failedBlocks: 0,
    reviewReady: false,
  }
}

function getProgressLabel(snapshot: TranslationSnapshot): string {
  if (snapshot.phase === "starting") return "Preparing translation…"
  if (snapshot.phase === "stopping") return "Removing translation…"
  if (snapshot.lastError) return snapshot.lastError.message
  if (snapshot.progress.failedBlocks > 0) return `${snapshot.progress.failedBlocks} paragraph${snapshot.progress.failedBlocks === 1 ? "" : "s"} need retry.`
  return "Translating…"
}

function QuietProgressPill({ snapshot, fontScale }: { snapshot: TranslationSnapshot; fontScale: number }) {
  const certParams = readAstraContentCertificationParams()
  const shouldShow = !certParams.hideProgress && (
    snapshot.phase === "starting"
    || snapshot.phase === "running"
    || snapshot.phase === "stopping"
    || Boolean(snapshot.lastError)
  )

  if (!shouldShow) return null

  const displayTotal = certParams.progressTotal ?? snapshot.progress.totalBlocks
  const displayDone = certParams.progressDone ?? snapshot.progress.translatedBlocks
  const total = Math.max(1, displayTotal)
  const done = Math.min(total, Math.max(0, displayDone))
  const pct = Math.round((done / total) * 100)
  const hasFailures = snapshot.progress.failedBlocks > 0 || Boolean(snapshot.lastError)
  const stopOrCancel = () => {
    if (snapshot.phase === "running" || snapshot.phase === "starting" || snapshot.phase === "stopping") {
      void toggleCurrentTabTranslation().catch((error) => {
        console.error("[Astra] Quiet progress stop failed:", error)
      })
      return
    }

    stopPageTranslation()
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="astra-translation-progress-pill"
      style={{
        position: "fixed",
        top: overlayPx(14, fontScale),
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 2147483647,
        display: "inline-flex",
        alignItems: "center",
        gap: overlayPx(9, fontScale),
        minWidth: overlayPx(455, fontScale),
        padding: `${overlayPx(8, fontScale)} ${overlayPx(10, fontScale)} ${overlayPx(8, fontScale)} ${overlayPx(15, fontScale)}`,
        borderRadius: 999,
        border: `1px solid ${hasFailures ? OVERLAY_STYLE_TOKENS.warningBorder : OVERLAY_STYLE_TOKENS.borderSubtle}`,
        background: `color-mix(in srgb, ${OVERLAY_STYLE_TOKENS.surfaceElevated} 96%, transparent)`,
        color: OVERLAY_STYLE_TOKENS.textPrimary,
        boxShadow: "0 14px 34px color-mix(in srgb, CanvasText 12%, transparent)",
        fontFamily: OVERLAY_FONT_FAMILY,
        fontSize: overlayPx(13, fontScale),
        pointerEvents: "auto",
      }}
    >
      <span style={{
        width: overlayPx(14, fontScale),
        height: overlayPx(14, fontScale),
        color: hasFailures ? OVERLAY_STYLE_TOKENS.warning : OVERLAY_STYLE_TOKENS.brand,
        display: "inline-grid",
        placeItems: "center",
        fontSize: overlayPx(12, fontScale),
        lineHeight: 1,
      }}>
        ✣
      </span>
      <span style={{ fontFamily: OVERLAY_FONT_FAMILY_SERIF, fontStyle: "italic", color: OVERLAY_STYLE_TOKENS.textSecondary, flex: "0 0 auto" }}>
        {getProgressLabel(snapshot)}
      </span>
      <span
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label="Astra translation progress"
        style={{
          width: overlayPx(118, fontScale),
          height: overlayPx(3, fontScale),
          background: OVERLAY_STYLE_TOKENS.bgSunken,
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <span style={{
          display: "block",
          width: `${pct}%`,
          height: "100%",
          background: hasFailures ? OVERLAY_STYLE_TOKENS.warning : OVERLAY_STYLE_TOKENS.brand,
        }} />
      </span>
      <span style={{ fontSize: overlayPx(11, fontScale), color: OVERLAY_STYLE_TOKENS.textMuted, fontVariantNumeric: "tabular-nums" }}>
        {done}/{displayTotal || 0}
      </span>
      {hasFailures ? (
        <button type="button" onClick={() => retryFailedBlocks()} style={progressButtonStyle(fontScale)}>
          Retry
        </button>
      ) : (
        <button type="button" onClick={stopOrCancel} style={progressButtonStyle(fontScale)}>
          Stop
        </button>
      )}
      <button type="button" aria-label="Cancel translation" onClick={stopOrCancel} style={{ ...progressButtonStyle(fontScale), paddingInline: overlayPx(7, fontScale) }}>
        ×
      </button>
    </div>
  )
}

function progressButtonStyle(fontScale: number): React.CSSProperties {
  return {
    border: `1px solid ${OVERLAY_STYLE_TOKENS.borderSubtle}`,
    background: "transparent",
    color: OVERLAY_STYLE_TOKENS.textSecondary,
    borderRadius: 999,
    padding: `${overlayPx(3, fontScale)} ${overlayPx(8, fontScale)}`,
    fontSize: overlayPx(12, fontScale),
    fontFamily: OVERLAY_FONT_FAMILY,
    cursor: "pointer",
  }
}

function QuietStatusPill() {
  const [translationState, setTranslationState] = useState<TranslationSnapshot>(IDLE_TRANSLATION_SNAPSHOT)
  const [learningState, setLearningState] = useState(() => getLearningState())
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [learningPulseActive, setLearningPulseActive] = useState(false)
  const [fontScale, setFontScale] = useState(0.92)

  useEffect(() => subscribePageTranslationState(setTranslationState), [])
  useEffect(() => subscribeLearningState(setLearningState), [])

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

    const onStorageChange = (_changes: Record<string, unknown>, areaName: string) => {
      if (areaName !== "local") return
      void syncFontScale()
    }

    browser.storage.onChanged.addListener(onStorageChange)
    return () => browser.storage.onChanged.removeListener(onStorageChange)
  }, [])

  useEffect(() => {
    if (!learningState.lastSavedAt) return

    setLearningPulseActive(true)
    const timer = window.setTimeout(() => setLearningPulseActive(false), SAVE_PULSE_MS)
    return () => window.clearTimeout(timer)
  }, [learningState.lastSavedAt])

  const visual = getQuietStatusVisualState(translationState, learningState)
  const certParams = readAstraContentCertificationParams()

  const openReview = useCallback(() => {
    void browser.tabs.create({ url: browser.runtime.getURL("/vocabulary.html?tab=review") })
  }, [])

  const activate = useCallback(() => {
    if (visual.disabled) return

    if (visual.failedBlocks > 0) {
      retryFailedBlocks()
    } else if (visual.reviewReady) {
      openReview()
    } else {
      void toggleCurrentTabTranslation().catch((error) => {
        console.error("[Astra] Quiet status toggle failed:", error)
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

  if (certParams.hideStatus) {
    return <QuietProgressPill snapshot={translationState} fontScale={fontScale} />
  }

  const expanded = hovered || focused || Boolean(visual.progressText) || visual.failedBlocks > 0 || visual.reviewReady || learningPulseActive

  return (
    <>
      <QuietProgressPill snapshot={translationState} fontScale={fontScale} />
      <div
        role="button"
        tabIndex={visual.disabled ? -1 : 0}
        aria-label={visual.tooltip}
        aria-disabled={visual.disabled || undefined}
        title={visual.tooltip}
        onKeyDown={handleKeyDown}
        onPointerUp={(event) => {
          event.preventDefault()
          event.stopPropagation()
          activate()
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          position: "fixed",
          right: overlayPx(14, fontScale),
          bottom: overlayPx(14, fontScale),
          zIndex: 2147483646,
          display: "inline-flex",
          alignItems: "center",
          gap: overlayPx(7, fontScale),
          maxWidth: expanded ? overlayPx(220, fontScale) : overlayPx(92, fontScale),
          minHeight: overlayPx(30, fontScale),
          padding: `${overlayPx(5, fontScale)} ${overlayPx(expanded ? 11 : 8, fontScale)}`,
          borderRadius: 999,
          border: `1px solid ${expanded ? OVERLAY_STYLE_TOKENS.borderSubtle : "transparent"}`,
          background: expanded ? OVERLAY_STYLE_TOKENS.surfaceElevated : "color-mix(in srgb, Canvas 82%, transparent)",
          color: visual.color,
          boxShadow: focused
            ? OVERLAY_STYLE_TOKENS.focusRing
            : expanded
              ? "0 8px 24px color-mix(in srgb, CanvasText 8%, transparent)"
              : "none",
          opacity: expanded ? 0.92 : 0.42,
          cursor: visual.disabled ? "progress" : "pointer",
          userSelect: "none",
          fontFamily: OVERLAY_FONT_FAMILY,
          fontSize: overlayPx(12, fontScale),
          transition: "opacity 0.18s ease, max-width 0.18s ease, background 0.18s ease, box-shadow 0.18s ease",
          animation: showLearningPulse ? "astra-floatball-learning-pulse 0.8s ease-out" : undefined,
          outline: "none",
          pointerEvents: "auto",
        }}
      >
        {hovered && (
          <div
            style={{
              position: "absolute",
              right: 0,
              bottom: `calc(100% + ${overlayPx(8, fontScale)})`,
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
        <span aria-hidden="true" style={{
          width: overlayPx(8, fontScale),
          height: overlayPx(8, fontScale),
          fontSize: overlayPx(11, fontScale),
          borderRadius: 999,
          background: visual.color,
          flex: "0 0 auto",
        }} />
        <span style={{
          color: OVERLAY_STYLE_TOKENS.textSecondary,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {expanded ? visual.label : "Astra"}
        </span>
        {visual.progressText ? (
          <span style={{
            color: visual.color,
            fontSize: overlayPx(11, fontScale),
            fontWeight: 700,
            lineHeight: 1,
            fontFamily: OVERLAY_FONT_FAMILY,
            fontVariantNumeric: "tabular-nums",
          }}>
            {visual.progressText}
          </span>
        ) : null}
      </div>
    </>
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
      inset: 0;
      z-index: 2147483647;
      pointer-events: none;
    }
    div, button, span { box-sizing: border-box; }
    button { pointer-events: auto; }
    button:focus-visible { outline: none; box-shadow: ${OVERLAY_STYLE_TOKENS.focusRing}; }

    @keyframes astra-floatball-learning-pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.06); }
      100% { transform: scale(1); }
    }
  `
  shadow.appendChild(resetStyle)

  const mountPoint = document.createElement("div")
  shadow.appendChild(mountPoint)
  document.documentElement.appendChild(host)

  const root = ReactDOM.createRoot(mountPoint)
  root.render(<ErrorBoundary><QuietStatusPill /></ErrorBoundary>)
}
