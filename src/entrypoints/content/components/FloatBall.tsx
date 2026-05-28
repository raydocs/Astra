import React, { useCallback, useEffect, useRef, useState } from "react"
import ReactDOM from "react-dom/client"
import { browser } from "#imports"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { t } from "@/utils/i18n"
import { getSafeAiUnavailableCopy, getServiceModeLabel } from "@/utils/copy-dictionary"
import { retryFailedBlocks, stopPageTranslation, subscribePageTranslationState, translatePageElements } from "../page-translate"
import { toggleCurrentTabTranslation } from "@/utils/extension/messages"
import { IDLE_TRANSLATION_SNAPSHOT, type TranslationSnapshot } from "@/types/translation"
import { getLearningState, subscribeLearningState, type LearningStateSnapshot } from "../learning-state"
import { readConfig, saveConfig } from "@/utils/storage/config"
import { ensureAstraDeviceIdentity, readAstraSession } from "@/utils/storage/auth"
import { submitAstraSupportReport } from "@/utils/astra/support"
import { buildSupportBundle } from "@/utils/support-bundle"
import { recordLearningLoopEvent } from "@/utils/learning-loop-events"
import {
  normalizeSiteKey,
  resolveSiteTranslationSettings,
  type ContentScope,
  type ServiceMode,
  type SiteConfigInput,
  type TranslationMode,
} from "@/types/config"
import { OVERLAY_FONT_FAMILY, OVERLAY_FONT_FAMILY_SERIF, OVERLAY_STYLE_TOKENS, createOverlayStyle1TokenStyleElement, overlayPx } from "./overlayScale"
import { collectTextBlocks, findClosestTextBlock, findContentRoot } from "@/utils/dom/traversal"

const COLOR_IDLE = OVERLAY_STYLE_TOKENS.textSecondary
const COLOR_ACTIVE = OVERLAY_STYLE_TOKENS.success
const COLOR_BUSY = OVERLAY_STYLE_TOKENS.brandActive
const COLOR_ERROR = OVERLAY_STYLE_TOKENS.warning
const COLOR_LEARNING = OVERLAY_STYLE_TOKENS.success
const SAVE_PULSE_MS = 1200
const FLOATBALL_Y_STORAGE_KEY = "astra_float_ball_y"
const FLOATBALL_SIDE_STORAGE_KEY = "astra_float_ball_side"
const FLOATBALL_LOCKED_STORAGE_KEY = "astra_float_ball_locked"
const FLOATBALL_DRAG_THRESHOLD_PX = 4
// Zero-config beta: the FloatBall expands to only 3 core actions
// (Translate/Toggle/Retry · Stop · Review/bilingual). The advanced/secondary
// actions (per-block translate, Deep Read, video note, page-surface, quality
// cycle, position lock, auto-on-site, hide-here, error recovery shortcuts)
// remain in the code but are hidden by default so the quiet pill stays calm.
// Deep Read is reachable from the popup; Report from options "Help & privacy".
// Advanced users can restore the full surface by setting this storage key true.
const FLOATBALL_ADVANCED_STORAGE_KEY = "astra_float_ball_advanced"

type AstraContentCertificationParams = {
  enabled: boolean
  progressDone: number | null
  progressTotal: number | null
  hideProgress: boolean
  hideStatus: boolean
}

type SiteActionStatus = "idle" | "saving" | "saved" | "hidden" | "error"
type FloatBallSide = "left" | "right"
type FloatBallPosition = { side: FloatBallSide; y: number }
type DragState = {
  pointerId: number | null
  startX: number
  startY: number
  currentX: number
  currentY: number
  offsetY: number
  moved: boolean
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
      label: snapshot.phase === "starting" ? "Astra · Preparing" : "Astra · Removing",
      tooltip: snapshot.phase === "starting" ? t("floatball_preparingTranslation") : t("floatball_removingTranslation"),
      disabled: true,
      progressText: null as string | null,
      failedBlocks: 0,
      reviewReady: false,
    }
  }

  if (snapshot.phase === "running") {
    const isComplete = snapshot.progress.totalBlocks > 0
      && snapshot.progress.translatedBlocks >= snapshot.progress.totalBlocks
      && snapshot.progress.queuedBlocks === 0
      && snapshot.progress.inFlightBlocks === 0
      && snapshot.progress.failedBlocks === 0

    return {
      color: snapshot.progress.failedBlocks > 0 ? COLOR_ERROR : COLOR_ACTIVE,
      label: snapshot.progress.failedBlocks > 0 ? "Astra · Retry" : isComplete ? "Astra · Done" : "Astra · Translating",
      tooltip: `Translated: ${snapshot.progress.translatedBlocks}/${snapshot.progress.totalBlocks} | Failed: ${snapshot.progress.failedBlocks}`,
      disabled: false,
      progressText: isComplete ? null : `${snapshot.progress.translatedBlocks}/${snapshot.progress.totalBlocks}`,
      failedBlocks: snapshot.progress.failedBlocks,
      reviewReady: false,
    }
  }

  if (snapshot.lastError?.code === "SITE_DISABLED" || !snapshot.site.enabled) {
    return {
      color: COLOR_IDLE,
      label: "Astra · Hidden here",
      tooltip: snapshot.lastError?.message ?? "Astra is hidden on this site.",
      disabled: false,
      progressText: null,
      failedBlocks: 0,
      reviewReady: false,
    }
  }

  if (snapshot.lastError) {
    return {
      color: COLOR_ERROR,
      label: "Astra · Retry",
      tooltip: t("floatball_translationFailed", getSafeAiUnavailableCopy(snapshot.lastError, { siteEnabled: snapshot.site.enabled })),
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
      label: "Astra · Review",
      tooltip: `${t("popup_review")}: ${reviewCount}`,
      disabled: false,
      progressText: reviewCount > 99 ? "99+" : `${reviewCount}`,
      failedBlocks: 0,
      reviewReady: true,
    }
  }

  return {
    color: COLOR_IDLE,
    label: "Astra · Ready",
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
  if (snapshot.lastError) return getSafeAiUnavailableCopy(snapshot.lastError, { siteEnabled: snapshot.site.enabled })
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

function clampFloatBallY(y: number): number {
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 768
  return Math.max(12, Math.min(Math.max(12, viewportHeight - 54), y))
}

function readPointerCoordinate(value: number | undefined): number {
  return Number.isFinite(value) ? value ?? 0 : 0
}

function elementFromSelection(selection: Selection | null): HTMLElement | null {
  const node = selection?.anchorNode ?? selection?.focusNode ?? null
  if (!node) return null
  if (node instanceof HTMLElement) return node
  return node.parentElement
}

function resolveTargetedTranslationBlock(
  pointerTarget: HTMLElement | null,
  root: HTMLElement,
): ReturnType<typeof findClosestTextBlock> {
  const candidates = [
    pointerTarget,
    elementFromSelection(window.getSelection()),
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  ].filter((candidate): candidate is HTMLElement => Boolean(candidate))

  for (const candidate of candidates) {
    const block = findClosestTextBlock(candidate, root)
    if (block) return block
  }

  return collectTextBlocks(root)[0] ?? null
}

function isHttpEmbeddedFrame(frame: HTMLIFrameElement): boolean {
  const rawSrc = frame.getAttribute("src")
  if (!rawSrc || frame.hasAttribute("srcdoc")) return false
  try {
    const url = new URL(rawSrc, window.location.href)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function isLikelyHiddenEmbeddedFrame(frame: HTMLIFrameElement): boolean {
  if (frame.hidden || frame.getAttribute("aria-hidden") === "true") return true
  const style = window.getComputedStyle(frame)
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return true
  const widthAttr = Number.parseInt(frame.getAttribute("width") ?? "", 10)
  const heightAttr = Number.parseInt(frame.getAttribute("height") ?? "", 10)
  if (widthAttr === 0 || heightAttr === 0) return true
  const inlineStyle = frame.getAttribute("style") ?? ""
  return /(?:^|;)\s*width\s*:\s*0(?:px)?\s*(?:;|$)/i.test(inlineStyle)
    || /(?:^|;)\s*height\s*:\s*0(?:px)?\s*(?:;|$)/i.test(inlineStyle)
}

function countProtectedEmbeddedFrames(): number {
  if (typeof document === "undefined") return 0

  let count = 0
  for (const frame of Array.from(document.querySelectorAll("iframe"))) {
    if (!isHttpEmbeddedFrame(frame) || isLikelyHiddenEmbeddedFrame(frame)) continue
    try {
      if (!frame.contentDocument?.documentElement) {
        count += 1
      }
    } catch {
      count += 1
    }
  }
  return count
}

function buildFloatBallReportFileName(generatedAt: string): string {
  const stamp = generatedAt
    .replace(/[:.]/g, "-")
    .replace(/Z$/, "z")
  return `astra-page-report-${stamp}.json`
}

function downloadLocalJsonFile(fileName: string, payload: unknown): void {
  if (typeof URL.createObjectURL !== "function") {
    throw new Error("Local JSON export is unavailable in this browser.")
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" })
  const url = URL.createObjectURL(blob)

  try {
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = fileName
    anchor.click()
  } finally {
    URL.revokeObjectURL?.(url)
  }
}

function QuietStatusPill() {
  const [translationState, setTranslationState] = useState<TranslationSnapshot>(IDLE_TRANSLATION_SNAPSHOT)
  const [learningState, setLearningState] = useState(() => getLearningState())
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [learningPulseActive, setLearningPulseActive] = useState(false)
  const [showAdvancedActions, setShowAdvancedActions] = useState(false)
  const [siteActionStatus, setSiteActionStatus] = useState<SiteActionStatus>("idle")
  const [supportReportStatus, setSupportReportStatus] = useState<string | null>(null)
  const [protectedFrameCount, setProtectedFrameCount] = useState(0)
  const [fontScale, setFontScale] = useState(0.92)
  const [translationMode, setTranslationMode] = useState<TranslationMode>("bilingual")
  const [contentScope, setContentScope] = useState<ContentScope>("page")
  const [serviceMode, setServiceMode] = useState<ServiceMode>("automatic")
  const [locked, setLocked] = useState(false)
  const [position, setPosition] = useState<FloatBallPosition>(() => ({
    side: "right",
    y: clampFloatBallY((typeof window !== "undefined" ? window.innerHeight : 768) - 48),
  }))
  const dragStateRef = useRef<DragState | null>(null)
  const buttonRef = useRef<HTMLDivElement | null>(null)
  const lastPagePointerTargetRef = useRef<HTMLElement | null>(null)

  useEffect(() => subscribePageTranslationState(setTranslationState), [])
  useEffect(() => subscribeLearningState(setLearningState), [])

  useEffect(() => {
    let frameLoadCleanups: Array<() => void> = []
    const detachFrameLoadListeners = () => {
      for (const cleanup of frameLoadCleanups) cleanup()
      frameLoadCleanups = []
    }
    const refreshProtectedFrameCount = () => setProtectedFrameCount(countProtectedEmbeddedFrames())
    const attachFrameLoadListeners = () => {
      detachFrameLoadListeners()
      for (const frame of Array.from(document.querySelectorAll("iframe"))) {
        frame.addEventListener("load", refreshProtectedFrameCount)
        frameLoadCleanups.push(() => frame.removeEventListener("load", refreshProtectedFrameCount))
      }
    }
    const refreshAfterDomChange = () => {
      attachFrameLoadListeners()
      refreshProtectedFrameCount()
    }

    attachFrameLoadListeners()
    refreshProtectedFrameCount()

    const observer = new MutationObserver(refreshAfterDomChange)
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "srcdoc", "style", "hidden", "aria-hidden", "width", "height"],
    })
    window.addEventListener("load", refreshProtectedFrameCount, true)
    return () => {
      observer.disconnect()
      detachFrameLoadListeners()
      window.removeEventListener("load", refreshProtectedFrameCount, true)
    }
  }, [])

  useEffect(() => {
    setProtectedFrameCount(countProtectedEmbeddedFrames())
  }, [translationState.phase, translationState.progress.totalBlocks])

  useEffect(() => {
    const rememberPagePointerTarget = (event: PointerEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      if (!target || target.closest("#astra-float-ball-host")) return
      lastPagePointerTargetRef.current = target
    }

    document.addEventListener("pointermove", rememberPagePointerTarget, true)
    return () => document.removeEventListener("pointermove", rememberPagePointerTarget, true)
  }, [])

  useEffect(() => {
    let cancelled = false
    void browser.storage.local.get([FLOATBALL_Y_STORAGE_KEY, FLOATBALL_SIDE_STORAGE_KEY, FLOATBALL_LOCKED_STORAGE_KEY, FLOATBALL_ADVANCED_STORAGE_KEY])
      .then((stored) => {
        if (cancelled) return
        const storedY = typeof stored[FLOATBALL_Y_STORAGE_KEY] === "number"
          ? stored[FLOATBALL_Y_STORAGE_KEY] as number
          : position.y
        const storedSide = stored[FLOATBALL_SIDE_STORAGE_KEY] === "left" ? "left" : "right"
        setPosition({ side: storedSide, y: clampFloatBallY(storedY) })
        setLocked(stored[FLOATBALL_LOCKED_STORAGE_KEY] === true)
        setShowAdvancedActions(stored[FLOATBALL_ADVANCED_STORAGE_KEY] === true)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  // Restore once at mount; do not resync after local dragging.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const syncFontScale = async () => {
      try {
        const config = await readConfig()
        const resolved = resolveSiteTranslationSettings(config, window.location.hostname)
        setFontScale(resolved.presentation.fontSize)
        setTranslationMode(resolved.presentation.mode)
        setContentScope(resolved.contentScope)
        setServiceMode(config.serviceMode)
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

  const openDeepRead = useCallback(() => {
    void browser.tabs.create({ url: browser.runtime.getURL("/deep-read.html" as "/popup.html") })
  }, [])

  const isSupportedVideoNotePage = useCallback(() => {
    const host = window.location.hostname
    const path = window.location.pathname
    return ((host === "www.youtube.com" || host === "m.youtube.com" || host.includes("youtube-nocookie.com"))
      && (path === "/watch" || path.startsWith("/shorts/") || path.startsWith("/embed/")))
      || (host === "www.bilibili.com" && (path.startsWith("/video/") || path.startsWith("/bangumi/play/")))
  }, [])

  const createVideoNote = useCallback(() => {
    void browser.runtime.sendMessage({ type: "runtime/video-note:create-from-current-tab" })
  }, [])

  const openSettings = useCallback(() => {
    void browser.tabs.create({ url: browser.runtime.getURL("/options.html" as "/popup.html") })
  }, [])

  const toggleTranslation = useCallback(() => {
    void toggleCurrentTabTranslation().catch((error) => {
      console.error("[Astra] Quiet status toggle failed:", error)
    })
  }, [])

  const stopTranslation = useCallback(() => {
    if (translationState.phase === "running" || translationState.phase === "starting" || translationState.phase === "stopping") {
      void toggleCurrentTabTranslation().catch((error) => {
        console.error("[Astra] Quiet status stop failed:", error)
      })
      return
    }
    stopPageTranslation()
  }, [translationState.phase])

  const saveCurrentSiteRule = useCallback((overrides: SiteConfigInput, successStatus: SiteActionStatus = "saved") => {
    const siteKey = normalizeSiteKey(window.location.hostname)
    if (!siteKey) return

    setSiteActionStatus("saving")
    void readConfig()
      .then((config) => saveConfig({
        sites: {
          [siteKey]: {
            ...(config.sites[siteKey] ?? {}),
            ...overrides,
          },
        },
      }))
      .then(() => {
        setSiteActionStatus(successStatus)
        window.setTimeout(() => setSiteActionStatus("idle"), SAVE_PULSE_MS)
      })
      .catch((error) => {
        console.error("[Astra] Quiet status site preference failed:", error)
        setSiteActionStatus("error")
        window.setTimeout(() => setSiteActionStatus("idle"), SAVE_PULSE_MS)
      })
  }, [])

  const autoTranslateThisSite = useCallback(() => {
    saveCurrentSiteRule({ enabled: true, alwaysTranslate: true })
  }, [saveCurrentSiteRule])

  const hideOnThisSite = useCallback(() => {
    saveCurrentSiteRule({ enabled: false, alwaysTranslate: false }, "hidden")
  }, [saveCurrentSiteRule])

  const saveGlobalConfig = useCallback((updates: Parameters<typeof saveConfig>[0]) => {
    setSiteActionStatus("saving")
    void saveConfig(updates)
      .then(() => {
        setSiteActionStatus("saved")
        window.setTimeout(() => setSiteActionStatus("idle"), SAVE_PULSE_MS)
      })
      .catch((error) => {
        console.error("[Astra] Quiet status preference failed:", error)
        setSiteActionStatus("error")
        window.setTimeout(() => setSiteActionStatus("idle"), SAVE_PULSE_MS)
      })
  }, [])

  const toggleReadingMode = useCallback(() => {
    const nextMode: TranslationMode = translationMode === "bilingual" ? "translation-only" : "bilingual"
    setTranslationMode(nextMode)
    saveGlobalConfig({ presentation: { mode: nextMode } })
  }, [saveGlobalConfig, translationMode])

  const togglePageSurfaceMode = useCallback(() => {
    const nextScope: ContentScope = contentScope === "full_page" ? "immersive" : "full_page"
    setContentScope(nextScope)
    saveGlobalConfig({ contentScope: nextScope })
  }, [contentScope, saveGlobalConfig])

  const cycleServiceMode = useCallback(() => {
    const nextMode: ServiceMode = serviceMode === "automatic"
      ? "fast"
      : serviceMode === "fast"
        ? "balanced"
        : serviceMode === "balanced"
          ? "best_quality"
          : "automatic"
    setServiceMode(nextMode)
    saveGlobalConfig({ serviceMode: nextMode })
  }, [saveGlobalConfig, serviceMode])

  const useSimplerMode = useCallback(() => {
    setServiceMode("fast")
    saveGlobalConfig({ serviceMode: "fast" })
    if (translationState.progress.failedBlocks > 0 || translationState.lastError) {
      retryFailedBlocks({ serviceMode: "fast" })
    }
  }, [saveGlobalConfig, translationState.lastError, translationState.progress.failedBlocks])

  const handleReportThisPage = useCallback(() => {
    setSupportReportStatus("Preparing metadata-only report…")

    void (async () => {
      const generatedAt = new Date().toISOString()
      const [session, device, config] = await Promise.all([
        readAstraSession(),
        ensureAstraDeviceIdentity(),
        readConfig(),
      ])
      const featureSurface = isSupportedVideoNotePage() ? "video" : "page"
      const issueCategory = featureSurface === "video" ? "video_subtitles" : "page_not_working"
      const bundle = buildSupportBundle({
        extensionVersion: browser.runtime.getManifest?.()?.version ?? "0.1.0",
        browser: device.browserFamily,
        os: device.platform,
        locale: typeof navigator === "undefined" ? "unknown" : navigator.language,
        featureSurface,
        action: "report_this_page",
        issueCategory,
        errorCategory: translationState.lastError?.code ?? undefined,
        lastErrorCategory: translationState.lastError?.code ?? undefined,
        runtimeSurface: "content_floatball",
        timestamp: generatedAt,
        hostname: window.location.hostname,
        privacyMode: config.privacyMode,
        membershipState: session?.plan ?? "unknown",
        userConsent: true,
        userMessageIncluded: false,
        contactIncluded: false,
      })
      const deviceId = session?.deviceId ?? device.deviceId
      const remoteSession = session?.identityMode === "authenticated"
        && session.sessionToken
        && session.relayBaseURL
        && deviceId
        ? session
        : null

      if (remoteSession) {
        try {
          const result = await submitAstraSupportReport({
            baseURL: remoteSession.relayBaseURL,
            sessionToken: remoteSession.sessionToken,
            deviceId,
            bundle,
          })
          recordLearningLoopEvent("support_report_submitted", {
            source: "content_floatball",
            reportId: result.report.reportId,
            issueCategory,
            featureSurface,
            knownIssueMatched: Boolean(result.report.knownIssue),
          })
          if (result.report.knownIssue) {
            recordLearningLoopEvent("known_issue_viewed", {
              source: "content_floatball",
              issueId: result.report.knownIssue.issueId,
              status: result.report.knownIssue.status,
              surface: result.report.knownIssue.featureSurface,
            })
          }
          setSupportReportStatus("Metadata report submitted. No page text or URL path was included.")
          return
        } catch {
          try {
            downloadLocalJsonFile(buildFloatBallReportFileName(generatedAt), bundle)
            setSupportReportStatus("Support report submission failed; downloaded metadata-only JSON instead. No page text or URL path was included.")
            return
          } catch (error) {
            setSupportReportStatus(error instanceof Error ? error.message : "Report export failed.")
            return
          }
        }
      }

      try {
        downloadLocalJsonFile(buildFloatBallReportFileName(generatedAt), bundle)
        setSupportReportStatus("Downloaded metadata-only report JSON. No page text or URL path was included.")
      } catch (error) {
        setSupportReportStatus(error instanceof Error ? error.message : "Report export failed.")
      }
    })().catch((error) => {
      setSupportReportStatus(error instanceof Error ? error.message : "Report export failed.")
    })
  }, [isSupportedVideoNotePage, translationState.lastError?.code])

  const translateNearbyContent = useCallback((scope: "paragraph" | "section") => {
    const root = findContentRoot(document)
    const block = resolveTargetedTranslationBlock(lastPagePointerTargetRef.current, root)
    if (!block) {
      setSiteActionStatus("error")
      window.setTimeout(() => setSiteActionStatus("idle"), SAVE_PULSE_MS)
      return
    }

    const elements = scope === "paragraph"
      ? [block.element]
      : collectTextBlocks(
        (block.element.closest("section, article, [role='main']") as HTMLElement | null) ?? block.element,
      ).map((candidate) => candidate.element)

    setSiteActionStatus("saving")
    void translatePageElements(elements)
      .then((result) => {
        setSiteActionStatus(result.ok ? "saved" : "error")
        window.setTimeout(() => setSiteActionStatus("idle"), SAVE_PULSE_MS)
      })
      .catch((error) => {
        console.error("[Astra] Quiet status targeted translation failed:", error)
        setSiteActionStatus("error")
        window.setTimeout(() => setSiteActionStatus("idle"), SAVE_PULSE_MS)
      })
  }, [])

  const activate = useCallback(() => {
    if (visual.disabled) return

    if (visual.failedBlocks > 0) {
      retryFailedBlocks()
    } else if (visual.reviewReady) {
      openReview()
    } else {
      toggleTranslation()
    }
  }, [openReview, toggleTranslation, visual.disabled, visual.failedBlocks, visual.reviewReady])

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault()
    event.stopPropagation()
    activate()
  }, [activate])

  const persistPosition = useCallback((nextPosition: FloatBallPosition) => {
    void browser.storage.local.set({
      [FLOATBALL_Y_STORAGE_KEY]: nextPosition.y,
      [FLOATBALL_SIDE_STORAGE_KEY]: nextPosition.side,
    }).catch(() => {})
  }, [])

  const togglePositionLock = useCallback(() => {
    setLocked((current) => {
      const nextLocked = !current
      void browser.storage.local.set({
        [FLOATBALL_LOCKED_STORAGE_KEY]: nextLocked,
      }).catch(() => {})
      return nextLocked
    })
  }, [])

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (visual.disabled) return
    if (locked) return
    const target = event.target as HTMLElement | null
    if (target?.closest("button,[aria-label='Astra quick actions']")) return
    const clientX = readPointerCoordinate(event.clientX)
    const clientY = readPointerCoordinate(event.clientY)
    const rect = buttonRef.current?.getBoundingClientRect()
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: clientX,
      startY: clientY,
      currentX: clientX,
      currentY: clientY,
      offsetY: rect ? clientY - rect.top : 15,
      moved: false,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }, [locked, visual.disabled])

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return
    const clientX = readPointerCoordinate(event.clientX)
    const clientY = readPointerCoordinate(event.clientY)
    const dx = Math.abs(clientX - dragState.startX)
    const dy = Math.abs(clientY - dragState.startY)
    const moved = dragState.moved || dx > FLOATBALL_DRAG_THRESHOLD_PX || dy > FLOATBALL_DRAG_THRESHOLD_PX
    dragStateRef.current = {
      ...dragState,
      currentX: clientX,
      currentY: clientY,
      moved,
    }
    if (moved) {
      event.preventDefault()
      event.stopPropagation()
      setPosition((current) => ({
        side: current.side,
        y: clampFloatBallY(clientY - dragState.offsetY),
      }))
    }
  }, [])

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current
    dragStateRef.current = null
    event.preventDefault()
    event.stopPropagation()

    if (dragState?.moved) {
      const clientX = readPointerCoordinate(event.clientX)
      const nextPosition = {
        side: clientX > 0 && clientX < window.innerWidth / 2 ? "left" as const : "right" as const,
        y: clampFloatBallY(readPointerCoordinate(event.clientY) - dragState.offsetY),
      }
      setPosition(nextPosition)
      persistPosition(nextPosition)
      return
    }

    activate()
  }, [activate, persistPosition])

  const handleQuickActionsKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].includes(event.key)) return

    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)'))
    if (items.length === 0) return

    const currentIndex = Math.max(0, items.indexOf(document.activeElement as HTMLButtonElement))
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowDown" || event.key === "ArrowRight"
          ? (currentIndex + 1) % items.length
          : (currentIndex - 1 + items.length) % items.length

    event.preventDefault()
    event.stopPropagation()
    items[nextIndex]?.focus()
  }, [])

  const showLearningPulse = learningPulseActive && visual.reviewReady
  const showProtectedFrameBoundary = protectedFrameCount > 0 && translationState.phase !== "idle"

  if (certParams.hideStatus) {
    return <QuietProgressPill snapshot={translationState} fontScale={fontScale} />
  }

  const expanded = hovered || focused || Boolean(visual.progressText) || visual.failedBlocks > 0 || Boolean(translationState.lastError) || visual.reviewReady || learningPulseActive || showProtectedFrameBoundary || siteActionStatus !== "idle" || Boolean(supportReportStatus)
  const siteActionMessage = siteActionStatus === "saving"
    ? "Saving…"
    : siteActionStatus === "saved"
      ? "Done"
      : siteActionStatus === "hidden"
        ? "Hidden here"
        : siteActionStatus === "error"
        ? "Try again"
        : null

  return (
    <>
      <QuietProgressPill snapshot={translationState} fontScale={fontScale} />
      <div
        ref={buttonRef}
        role="button"
        tabIndex={visual.disabled ? -1 : 0}
        aria-label={visual.tooltip}
        aria-disabled={visual.disabled || undefined}
        aria-haspopup="menu"
        aria-expanded={expanded || undefined}
        title={locked ? `${visual.tooltip} · Position locked` : visual.tooltip}
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
          top: `${position.y}px`,
          [position.side]: overlayPx(14, fontScale),
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
          cursor: visual.disabled ? "progress" : locked ? "default" : "pointer",
          userSelect: "none",
          fontFamily: OVERLAY_FONT_FAMILY,
          fontSize: overlayPx(12, fontScale),
          transition: "opacity 0.18s ease, max-width 0.18s ease, background 0.18s ease, box-shadow 0.18s ease",
          animation: showLearningPulse ? "astra-floatball-learning-pulse 0.8s ease-out" : undefined,
          outline: "none",
          pointerEvents: "auto",
        }}
      >
        {hovered && visual.disabled && (
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
          {siteActionStatus === "hidden" ? "Astra · Hidden here" : expanded ? visual.label : "Astra"}
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
        {showProtectedFrameBoundary ? (
          <span
            role="status"
            aria-live="polite"
            data-testid="astra-floatball-frame-boundary"
            title={`${protectedFrameCount} protected embedded frame${protectedFrameCount === 1 ? "" : "s"} skipped`}
            style={{
              color: OVERLAY_STYLE_TOKENS.warning,
              fontSize: overlayPx(10, fontScale),
              fontWeight: 800,
              lineHeight: 1,
              fontFamily: OVERLAY_FONT_FAMILY,
              whiteSpace: "nowrap",
            }}
          >
            Protected frame skipped
          </span>
        ) : null}
        {expanded && !visual.disabled && (
          <div
            role="menu"
            aria-label="Astra quick actions"
            style={{
              position: "absolute",
              ...(position.side === "left" ? { left: 0 } : { right: 0 }),
              bottom: `calc(100% + ${overlayPx(8, fontScale)})`,
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: overlayPx(5, fontScale),
              minWidth: overlayPx(210, fontScale),
              padding: overlayPx(8, fontScale),
              borderRadius: overlayPx(14, fontScale),
              border: `1px solid ${OVERLAY_STYLE_TOKENS.borderSubtle}`,
              background: `color-mix(in srgb, ${OVERLAY_STYLE_TOKENS.surfaceElevated} 98%, transparent)`,
              boxShadow: "0 16px 38px color-mix(in srgb, CanvasText 14%, transparent)",
              pointerEvents: "auto",
            }}
            onPointerUp={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onPointerDown={(event) => {
              event.stopPropagation()
            }}
            onPointerMove={(event) => {
              event.stopPropagation()
            }}
            onKeyDown={handleQuickActionsKeyDown}
          >
            <button type="button" role="menuitem" style={quickActionStyle(fontScale, true)} onClick={(event) => { event.stopPropagation(); visual.failedBlocks > 0 ? retryFailedBlocks() : toggleTranslation() }} onPointerUp={(event) => { event.stopPropagation() }}>
              {visual.failedBlocks > 0 ? "Retry" : translationState.phase === "idle" ? "Translate" : "Toggle"}
            </button>
            <button type="button" role="menuitem" style={quickActionStyle(fontScale)} onClick={(event) => { event.stopPropagation(); stopTranslation() }} onPointerUp={(event) => { event.stopPropagation() }}>
              Stop
            </button>
            {showAdvancedActions && (
            <>
            <button type="button" role="menuitem" style={quickActionStyle(fontScale)} onClick={(event) => { event.stopPropagation(); translateNearbyContent("paragraph") }} onPointerUp={(event) => { event.stopPropagation() }}>
              This paragraph
            </button>
            <button type="button" role="menuitem" style={quickActionStyle(fontScale)} onClick={(event) => { event.stopPropagation(); translateNearbyContent("section") }} onPointerUp={(event) => { event.stopPropagation() }}>
              This section
            </button>
            <button type="button" role="menuitem" style={quickActionStyle(fontScale)} onClick={(event) => { event.stopPropagation(); openDeepRead() }} onPointerUp={(event) => { event.stopPropagation() }}>
              Deep Read
            </button>
            {isSupportedVideoNotePage() ? (
              <button type="button" role="menuitem" style={quickActionStyle(fontScale)} onClick={(event) => { event.stopPropagation(); createVideoNote() }} onPointerUp={(event) => { event.stopPropagation() }}>
                Create video note
              </button>
            ) : null}
            {(visual.failedBlocks > 0 || translationState.lastError) ? (
              <button type="button" role="menuitem" style={quickActionStyle(fontScale)} onClick={(event) => { event.stopPropagation(); useSimplerMode() }} onPointerUp={(event) => { event.stopPropagation() }}>
                Use simpler mode
              </button>
            ) : null}
            {(visual.failedBlocks > 0 || translationState.lastError) ? (
              <button type="button" role="menuitem" style={quickActionStyle(fontScale)} onClick={(event) => { event.stopPropagation(); handleReportThisPage() }} onPointerUp={(event) => { event.stopPropagation() }}>
                Report this page
              </button>
            ) : null}
            </>
            )}
            <button type="button" role="menuitem" style={quickActionStyle(fontScale)} onClick={(event) => { event.stopPropagation(); visual.reviewReady ? openReview() : openSettings() }} onPointerUp={(event) => { event.stopPropagation() }}>
              {visual.reviewReady ? "Review" : "Settings"}
            </button>
            <button type="button" role="menuitem" style={quickActionStyle(fontScale)} onClick={(event) => { event.stopPropagation(); toggleReadingMode() }} onPointerUp={(event) => { event.stopPropagation() }}>
              {translationMode === "bilingual" ? "Bilingual" : "Translation only"}
            </button>
            {showAdvancedActions && (
            <>
            <button type="button" role="menuitem" style={quickActionStyle(fontScale)} onClick={(event) => { event.stopPropagation(); togglePageSurfaceMode() }} onPointerUp={(event) => { event.stopPropagation() }}>
              {contentScope === "full_page" ? "Full page" : "Immersive"}
            </button>
            <button type="button" role="menuitem" style={quickActionStyle(fontScale)} onClick={(event) => { event.stopPropagation(); cycleServiceMode() }} onPointerUp={(event) => { event.stopPropagation() }}>
              {getServiceModeLabel(serviceMode)}
            </button>
            <button type="button" role="menuitem" style={quickActionStyle(fontScale)} onClick={(event) => { event.stopPropagation(); togglePositionLock() }} onPointerUp={(event) => { event.stopPropagation() }}>
              {locked ? "Unlock position" : "Lock position"}
            </button>
            <button type="button" role="menuitem" style={quickActionStyle(fontScale)} onClick={(event) => { event.stopPropagation(); autoTranslateThisSite() }} onPointerUp={(event) => { event.stopPropagation() }}>
              Auto on site
            </button>
            <button type="button" role="menuitem" style={quickActionStyle(fontScale)} onClick={(event) => { event.stopPropagation(); hideOnThisSite() }} onPointerUp={(event) => { event.stopPropagation() }}>
              Hide here
            </button>
            </>
            )}
            {showProtectedFrameBoundary ? (
              <span
                role="status"
                aria-live="polite"
                data-testid="astra-floatball-frame-boundary-detail"
                style={{
                  gridColumn: "1 / -1",
                  color: OVERLAY_STYLE_TOKENS.warning,
                  fontSize: overlayPx(11, fontScale),
                  fontFamily: OVERLAY_FONT_FAMILY,
                  textAlign: "left",
                  whiteSpace: "pre-wrap",
                }}
              >
                Astra translated the accessible page content and skipped {protectedFrameCount} protected embedded frame{protectedFrameCount === 1 ? "" : "s"}.
              </span>
            ) : null}
            {supportReportStatus ? (
              <span
                role="status"
                aria-live="polite"
                data-testid="astra-floatball-report-status"
                style={{
                  gridColumn: "1 / -1",
                  color: OVERLAY_STYLE_TOKENS.textMuted,
                  fontSize: overlayPx(11, fontScale),
                  fontFamily: OVERLAY_FONT_FAMILY,
                  textAlign: "left",
                  whiteSpace: "pre-wrap",
                }}
              >
                {supportReportStatus}
              </span>
            ) : null}
            {siteActionMessage ? (
              <span
                role="status"
                aria-live="polite"
                style={{
                  gridColumn: "1 / -1",
                  color: siteActionStatus === "error" ? OVERLAY_STYLE_TOKENS.warning : OVERLAY_STYLE_TOKENS.textMuted,
                  fontSize: overlayPx(11, fontScale),
                  fontFamily: OVERLAY_FONT_FAMILY,
                  textAlign: "center",
                }}
              >
                {siteActionMessage}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </>
  )
}

function quickActionStyle(fontScale: number, primary = false): React.CSSProperties {
  return {
    border: `1px solid ${primary ? OVERLAY_STYLE_TOKENS.brand : OVERLAY_STYLE_TOKENS.borderSubtle}`,
    background: primary ? OVERLAY_STYLE_TOKENS.brand : "transparent",
    color: primary ? OVERLAY_STYLE_TOKENS.textInverse : OVERLAY_STYLE_TOKENS.textSecondary,
    borderRadius: overlayPx(10, fontScale),
    padding: `${overlayPx(6, fontScale)} ${overlayPx(8, fontScale)}`,
    fontSize: overlayPx(11, fontScale),
    fontFamily: OVERLAY_FONT_FAMILY,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  }
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
