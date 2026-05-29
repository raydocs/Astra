import { translateTexts } from "@/utils/translate/translate"
import { runInlineAction } from "../inline-actions"
import type { VideoNoteTranscriptCapture, VideoTranscriptSegment } from "@/types/video-notes"
import type { ServiceMode } from "@/types/config"
import { nativeCaptionLineRenderingRule } from "./rendering-rules"
import type { VideoPlatformConfig } from "./types"

const YOUTUBE_RENDER_TARGET_SELECTOR = ".ytp-caption-window-bottom, .ytp-caption-window-top"
const DEFAULT_CUE_BATCH_SIZE = 20
const FAST_CUE_BATCH_SIZE = 40
const BEST_QUALITY_CUE_BATCH_SIZE = 12
const DUPLICATE_CUE_WINDOW_MS = 1_500
const DELAYED_TRACK_TIMEOUT_MS = 1_500
const ACTIVE_CUE_TOLERANCE_SECONDS = 0.35
const MIN_LOOKAHEAD_SECONDS = 15
const MAX_LOOKAHEAD_SECONDS = 120
const DEFAULT_LOOKAHEAD_SECONDS = 45
const FAST_LOOKAHEAD_SECONDS = 90
const BEST_QUALITY_LOOKAHEAD_SECONDS = 30
const DEFAULT_WINDOW_SECONDS = 300
const BEST_QUALITY_WINDOW_SECONDS = 180

export type YouTubeCaptionAnomaly =
  | "missing-track"
  | "delayed-track"
  | "duplicated-cue"
  | "stale-cue-race"
  | "translation-downgraded"
  | "translation-failed"

interface YouTubeCaptionTrack {
  baseUrl?: string
  vssId?: string
  languageCode?: string
  kind?: string
  isTranslatable?: boolean
  name?: {
    simpleText?: string
    runs?: Array<{ text?: string }>
  }
}

interface TimedTextEvent {
  tStartMs?: number
  dDurationMs?: number
  segs?: Array<{ utf8?: string }>
}

interface TimedTextResponse {
  events?: TimedTextEvent[]
}

interface YouTubeTimedCue {
  startTime: number
  endTime: number
  text: string
  translation?: string
}

interface YouTubeHybridSessionDeps {
  targetLang: string
  serviceMode: ServiceMode
  rootContainer: HTMLElement
  cacheGet: (key: string) => string | undefined
  cachePut: (key: string, value: string) => void
  getDomCaptionText: (container: HTMLElement) => string
  injectTranslation: (container: HTMLElement, text: string, sourceText: string) => void
  onStatusChange?: () => void
}

interface YouTubeSubtitleStrategy {
  batchSize: number
  baseLookaheadSeconds: number
  windowSeconds: number
  segmentation: "cue" | "sentence-window"
}

interface YouTubeSubtitleTranslationUnit {
  text: string
  cues: YouTubeTimedCue[]
}

interface YouTubeCueCacheContext {
  videoId: string
  trackHash: string
}

interface YouTubeSubtitleTranslationContext {
  pageTitle: string
  pageUrl: string
  contentSummary: string
}

export interface YouTubeHybridSession {
  stop: () => void
}

export interface YouTubeTranscriptCueSnapshot {
  id: string
  startMs: number
  endMs: number
  text: string
  translation?: string
}

export interface YouTubeTranscriptSnapshot {
  available: boolean
  /** Settled "this video has no captions" signal (track missing, not just still loading). */
  noCaptions: boolean
  title: string | null
  pageUrl: string
  language: string | null
  currentTime: number
  activeIndex: number
  cues: YouTubeTranscriptCueSnapshot[]
}

const transcriptListeners = new Set<(snapshot: YouTubeTranscriptSnapshot | null) => void>()
let activeTranscriptSnapshotReader: (() => YouTubeTranscriptSnapshot | null) | null = null

export function getYouTubeTranscriptSnapshot(): YouTubeTranscriptSnapshot | null {
  return activeTranscriptSnapshotReader?.() ?? null
}

export function subscribeYouTubeTranscriptSnapshot(
  listener: (snapshot: YouTubeTranscriptSnapshot | null) => void,
): () => void {
  transcriptListeners.add(listener)
  listener(getYouTubeTranscriptSnapshot())
  return () => {
    transcriptListeners.delete(listener)
  }
}

function notifyTranscriptListeners(): void {
  const snapshot = getYouTubeTranscriptSnapshot()
  transcriptListeners.forEach((listener) => listener(snapshot))
}

function normalizeYouTubeCaptionText(text: string): string {
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function collapseAdjacentDuplicates(parts: string[]): string[] {
  const normalized: string[] = []

  for (const part of parts) {
    const text = normalizeYouTubeCaptionText(part)
    if (!text) continue
    if (normalized.at(-1) === text) continue
    normalized.push(text)
  }

  return normalized
}

function extractYouTubeCaptionText(container: HTMLElement): string {
  const clone = container.cloneNode(true) as HTMLElement
  clone.querySelectorAll(".astra-video-subtitle").forEach((el) => el.remove())

  const segments = Array.from(clone.querySelectorAll(".ytp-caption-segment"))
    .map((segment) => normalizeYouTubeCaptionText(segment.textContent ?? ""))
    .filter((segment) => segment.length > 0)

  if (segments.length > 0) {
    return collapseAdjacentDuplicates(segments).join(" ")
  }

  return normalizeYouTubeCaptionText(clone.textContent ?? "")
}

function getPlayerResponse(): unknown {
  const win = window as Window & {
    ytInitialPlayerResponse?: unknown
    ytplayer?: { config?: { args?: { player_response?: string } } }
  }

  if (win.ytInitialPlayerResponse) {
    return win.ytInitialPlayerResponse
  }

  const rawResponse = win.ytplayer?.config?.args?.player_response
  if (!rawResponse) return null

  try {
    return JSON.parse(rawResponse)
  } catch {
    return null
  }
}

function getCaptionTracksFromPlayerResponse(): YouTubeCaptionTrack[] {
  const playerResponse = getPlayerResponse() as {
    captions?: {
      playerCaptionsTracklistRenderer?: {
        captionTracks?: YouTubeCaptionTrack[]
      }
    }
  } | null

  const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks
  return Array.isArray(tracks) ? tracks : []
}

function normalizeLanguageCode(languageCode?: string): string {
  return (languageCode ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
}

function resolveSubtitleStrategy(serviceMode: ServiceMode): YouTubeSubtitleStrategy {
  switch (serviceMode) {
    case "fast":
      return {
        batchSize: FAST_CUE_BATCH_SIZE,
        baseLookaheadSeconds: FAST_LOOKAHEAD_SECONDS,
        windowSeconds: DEFAULT_WINDOW_SECONDS,
        segmentation: "cue",
      }
    case "best_quality":
      return {
        batchSize: BEST_QUALITY_CUE_BATCH_SIZE,
        baseLookaheadSeconds: BEST_QUALITY_LOOKAHEAD_SECONDS,
        windowSeconds: BEST_QUALITY_WINDOW_SECONDS,
        segmentation: "sentence-window",
      }
    case "automatic":
    case "balanced":
      return {
        batchSize: DEFAULT_CUE_BATCH_SIZE,
        baseLookaheadSeconds: DEFAULT_LOOKAHEAD_SECONDS,
        windowSeconds: DEFAULT_WINDOW_SECONDS,
        segmentation: "cue",
      }
  }
}

function getCurrentYouTubeVideoId(): string {
  try {
    const url = new URL(window.location.href)
    const watchId = url.searchParams.get("v")?.trim()
    if (watchId) return watchId

    const [kind, id] = url.pathname.split("/").filter(Boolean)
    if ((kind === "shorts" || kind === "embed") && id) return id
  } catch {
    // Fall through to unknown video namespace.
  }

  return "unknown-video"
}

function stableHash(value: string): string {
  let hash = 5381
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index)
  }
  return (hash >>> 0).toString(36)
}

function buildTrackCacheContext(track: YouTubeCaptionTrack): YouTubeCueCacheContext {
  const parts = [
    getCurrentYouTubeVideoId(),
    track.vssId ?? "",
    track.languageCode ?? "",
    track.kind ?? "",
    String(track.isTranslatable ?? false),
  ]

  if (track.baseUrl) {
    try {
      const url = new URL(track.baseUrl, window.location.origin)
      parts.push(
        url.searchParams.get("v") ?? "",
        url.searchParams.get("lang") ?? "",
        url.searchParams.get("name") ?? "",
        url.searchParams.get("kind") ?? "",
        url.pathname,
      )
    } catch {
      parts.push(track.baseUrl)
    }
  }

  return {
    videoId: getCurrentYouTubeVideoId(),
    trackHash: stableHash(parts.join("|")),
  }
}

function makeYouTubeCueCacheKey(
  text: string,
  targetLang: string,
  serviceMode: ServiceMode,
  context: YouTubeCueCacheContext | null,
): string {
  const videoId = context?.videoId ?? getCurrentYouTubeVideoId()
  const trackHash = context?.trackHash ?? "dom"
  return ["youtube", videoId, trackHash, targetLang, serviceMode, text].join("|")
}

function buildSubtitleTranslationContext(
  cues: YouTubeTimedCue[],
  track: YouTubeCaptionTrack | null,
): YouTubeSubtitleTranslationContext {
  const transcriptSample = cues
    .slice(0, 12)
    .map((cue) => cue.text)
    .join(" / ")
    .slice(0, 900)
  const language = normalizeLanguageCode(track?.languageCode) || "unknown"
  const title = normalizeYouTubeVideoTitle(document.title) ?? "YouTube video"

  return {
    pageTitle: title,
    pageUrl: window.location.href,
    contentSummary: `YouTube subtitle translation. Source caption language: ${language}. Preserve timing-friendly line breaks while restructuring subtitle fragments into natural ${track?.kind === "asr" ? "ASR-aware" : "human-caption"} sentences. Transcript sample: ${transcriptSample}`,
  }
}

function normalizeCaptionTrackHint(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
}

function getCaptionTrackDisplayName(track: YouTubeCaptionTrack): string {
  return track.name?.simpleText
    ?? track.name?.runs?.map((run) => run.text ?? "").join("")
    ?? ""
}

function getSelectedCaptionTrackHint(): string | null {
  const selectedMenuItem = document.querySelector<HTMLElement>([
    ".ytp-caption-menuitem[aria-checked='true'] .ytp-menuitem-label",
    ".ytp-caption-menuitem[aria-selected='true'] .ytp-menuitem-label",
    ".ytp-menuitem[aria-checked='true'][role='menuitemradio'] .ytp-menuitem-label",
  ].join(", "))
  const hint = normalizeCaptionTrackHint(selectedMenuItem?.textContent ?? "")
  return hint || null
}

function scoreSelectedCaptionTrack(track: YouTubeCaptionTrack, selectedHint: string | null): number {
  if (!selectedHint) return 0
  const candidates = [
    normalizeLanguageCode(track.languageCode),
    normalizeCaptionTrackHint(track.vssId ?? ""),
    normalizeCaptionTrackHint(getCaptionTrackDisplayName(track)),
  ].filter(Boolean)

  return candidates.some((candidate) => candidate === selectedHint || candidate.includes(selectedHint))
    ? 100
    : 0
}

function selectPreferredTrack(
  tracks: YouTubeCaptionTrack[],
  targetLang: string,
): YouTubeCaptionTrack | null {
  const normalizedTarget = normalizeLanguageCode(targetLang)
  const selectedHint = getSelectedCaptionTrackHint()

  return [...tracks]
    .filter((track) => typeof track.baseUrl === "string")
    .sort((left, right) => {
      const leftScore
        = scoreSelectedCaptionTrack(left, selectedHint)
          + (left.kind !== "asr" ? 40 : 5)
          + (normalizeLanguageCode(left.languageCode) !== normalizedTarget ? 20 : -15)
          + (left.isTranslatable ? 10 : 0)
      const rightScore
        = scoreSelectedCaptionTrack(right, selectedHint)
          + (right.kind !== "asr" ? 40 : 5)
          + (normalizeLanguageCode(right.languageCode) !== normalizedTarget ? 20 : -15)
          + (right.isTranslatable ? 10 : 0)
      return rightScore - leftScore
    })[0] ?? null
}

function selectPreferredTrackForVideoNoteCapture(
  tracks: YouTubeCaptionTrack[],
): YouTubeCaptionTrack | null {
  return [...tracks]
    .filter((track) => typeof track.baseUrl === "string")
    .sort((left, right) => {
      const leftScore
        = (left.kind !== "asr" ? 60 : 10)
          + (left.isTranslatable ? 8 : 0)
          + ((left.languageCode ?? "").trim() ? 4 : 0)
      const rightScore
        = (right.kind !== "asr" ? 60 : 10)
          + (right.isTranslatable ? 8 : 0)
          + ((right.languageCode ?? "").trim() ? 4 : 0)
      return rightScore - leftScore
    })[0] ?? null
}

function buildTimedTextUrls(baseUrl: string): string[] {
  const urls = new Set<string>()

  try {
    const json3Url = new URL(baseUrl, window.location.origin)
    json3Url.searchParams.set("fmt", "json3")
    urls.add(json3Url.toString())
  } catch {
    // Ignore malformed URLs and fall back to the raw URL.
  }

  urls.add(baseUrl)
  return Array.from(urls)
}

function parseJson3TimedText(payload: string): YouTubeTimedCue[] {
  const parsed = JSON.parse(payload) as TimedTextResponse
  if (!Array.isArray(parsed.events)) return []

  return parsed.events
    .map((event) => {
      const text = collapseAdjacentDuplicates(
        (event.segs ?? []).map((segment) => normalizeYouTubeCaptionText(segment.utf8 ?? "")),
      ).join(" ")
      const startMs = typeof event.tStartMs === "number" ? event.tStartMs : Number.NaN
      const durationMs = typeof event.dDurationMs === "number" ? event.dDurationMs : Number.NaN

      return {
        startTime: startMs / 1000,
        endTime: (startMs + durationMs) / 1000,
        text,
      } satisfies YouTubeTimedCue
    })
    .filter((cue) => Number.isFinite(cue.startTime) && Number.isFinite(cue.endTime) && cue.endTime > cue.startTime && cue.text.length > 0)
}

function parseXmlTimedText(payload: string): YouTubeTimedCue[] {
  const xml = new DOMParser().parseFromString(payload, "text/xml")

  return Array.from(xml.querySelectorAll("text"))
    .map((node) => {
      const start = Number.parseFloat(node.getAttribute("start") ?? "")
      const duration = Number.parseFloat(node.getAttribute("dur") ?? "")
      return {
        startTime: start,
        endTime: start + duration,
        text: normalizeYouTubeCaptionText(node.textContent ?? ""),
      } satisfies YouTubeTimedCue
    })
    .filter((cue) => Number.isFinite(cue.startTime) && Number.isFinite(cue.endTime) && cue.endTime > cue.startTime && cue.text.length > 0)
}

function dedupeTimedCues(cues: YouTubeTimedCue[], onDuplicate: () => void): YouTubeTimedCue[] {
  const deduped: YouTubeTimedCue[] = []

  for (const cue of cues.sort((left, right) => left.startTime - right.startTime)) {
    const previous = deduped.at(-1)
    if (
      previous
      && previous.text === cue.text
      && Math.abs(previous.startTime - cue.startTime) < 0.05
      && Math.abs(previous.endTime - cue.endTime) < 0.05
    ) {
      onDuplicate()
      continue
    }
    deduped.push(cue)
  }

  return deduped
}

async function fetchTimedTextCues(
  track: YouTubeCaptionTrack,
  signal: AbortSignal,
  onDuplicate: () => void,
): Promise<YouTubeTimedCue[]> {
  if (!track.baseUrl) return []

  for (const url of buildTimedTextUrls(track.baseUrl)) {
    const response = await fetch(url, {
      credentials: "include",
      signal,
    })

    if (!response.ok) continue

    const payload = await response.text()
    if (!payload.trim()) continue

    try {
      const cues = payload.trim().startsWith("{")
        ? parseJson3TimedText(payload)
        : parseXmlTimedText(payload)

      if (cues.length > 0) {
        return dedupeTimedCues(cues, onDuplicate)
      }
    } catch {
      // Try the next payload format / URL.
    }
  }

  return []
}

function findYouTubeVideo(rootContainer: HTMLElement): HTMLVideoElement | null {
  const scopedVideo = rootContainer.closest(".html5-video-player")?.querySelector("video")
  if (scopedVideo instanceof HTMLVideoElement) {
    return scopedVideo
  }

  const mainVideo = document.querySelector("video.html5-main-video")
  if (mainVideo instanceof HTMLVideoElement) {
    return mainVideo
  }

  const firstVideo = document.querySelector("video")
  return firstVideo instanceof HTMLVideoElement ? firstVideo : null
}

function normalizeYouTubeVideoTitle(rawTitle: string): string | null {
  const trimmed = rawTitle.trim()
  if (!trimmed) return null
  return trimmed.replace(/\s*-\s*YouTube$/i, "").trim() || null
}

function buildYouTubeDeepLinkTemplate(): string | null {
  try {
    const currentUrl = new URL(window.location.href)
    currentUrl.hash = ""
    if (currentUrl.pathname.startsWith("/shorts/")) {
      const shortsId = currentUrl.pathname.split("/").filter(Boolean)[1]
      if (shortsId) {
        return `https://www.youtube.com/watch?v=${encodeURIComponent(shortsId)}&t={seconds}s`
      }
    }
    currentUrl.searchParams.set("t", "{seconds}s")
    return currentUrl.toString()
  } catch {
    return null
  }
}

function toVideoTranscriptSegments(cues: YouTubeTimedCue[]): VideoTranscriptSegment[] {
  return cues
    .map((cue) => ({
      startMs: Math.max(0, Math.floor(cue.startTime * 1000)),
      endMs: Math.max(0, Math.floor(cue.endTime * 1000)),
      text: cue.text.trim(),
    }))
    .filter((segment) => segment.text.length > 0 && segment.endMs > segment.startMs)
}

export async function captureYouTubeVideoNoteTranscript(
  rootContainer: HTMLElement,
): Promise<VideoNoteTranscriptCapture | null> {
  const video = findYouTubeVideo(rootContainer)
  const tracks = getCaptionTracksFromPlayerResponse()
  const track = selectPreferredTrackForVideoNoteCapture(tracks)
  if (!track) {
    return null
  }

  const abortController = new AbortController()
  const cues = await fetchTimedTextCues(track, abortController.signal, () => {})
  const transcriptSegments = toVideoTranscriptSegments(cues)
  if (transcriptSegments.length === 0) {
    return null
  }

  return {
    transcriptSegments,
    language: normalizeLanguageCode(track.languageCode) || null,
    deepLinkTemplate: buildYouTubeDeepLinkTemplate(),
    durationSec: Number.isFinite(video?.duration) ? Number(video!.duration) : null,
  }
}

export function getYouTubeVideoNoteTitle(): string | null {
  return normalizeYouTubeVideoTitle(document.title)
}

function getRenderTarget(rootContainer: HTMLElement): HTMLElement {
  return rootContainer.querySelector<HTMLElement>(YOUTUBE_RENDER_TARGET_SELECTOR) ?? rootContainer
}

function clearRenderedTranslation(rootContainer: HTMLElement): void {
  getRenderTarget(rootContainer).querySelectorAll(".astra-video-subtitle").forEach((node) => node.remove())
}

function hasMatchingTranslation(
  container: HTMLElement,
  sourceText: string,
  translationText?: string,
): boolean {
  const existing = container.querySelector<HTMLElement>(".astra-video-subtitle")
  if (!existing || existing.getAttribute("data-source") !== sourceText) {
    return false
  }

  return translationText === undefined || existing.textContent === translationText
}

function getActiveTimedCues(cues: YouTubeTimedCue[], currentTime: number): YouTubeTimedCue[] {
  const active = cues.filter((cue) =>
    cue.startTime - ACTIVE_CUE_TOLERANCE_SECONDS <= currentTime
    && currentTime <= cue.endTime + ACTIVE_CUE_TOLERANCE_SECONDS,
  )

  if (active.length > 0) {
    return active
  }

  const nearest = cues.find((cue) =>
    Math.abs(cue.startTime - currentTime) <= ACTIVE_CUE_TOLERANCE_SECONDS,
  )

  return nearest ? [nearest] : []
}

function clampLookaheadSeconds(value: number): number {
  return Math.max(MIN_LOOKAHEAD_SECONDS, Math.min(MAX_LOOKAHEAD_SECONDS, Math.round(value)))
}

function getCueDensityPerSecond(cues: YouTubeTimedCue[], currentTime: number): number {
  const sampleStart = Math.max(0, currentTime - 5)
  const sampleEnd = currentTime + 60
  const cueCount = cues.filter((cue) => cue.endTime >= sampleStart && cue.startTime <= sampleEnd).length
  return cueCount / Math.max(1, sampleEnd - sampleStart)
}

function getNetworkLookaheadMultiplier(): number {
  const connection = (navigator as Navigator & {
    connection?: { effectiveType?: string; downlink?: number }
  }).connection
  const effectiveType = connection?.effectiveType ?? ""
  const downlink = typeof connection?.downlink === "number" ? connection.downlink : null

  if (/slow-2g|2g/.test(effectiveType) || downlink !== null && downlink < 1.2) {
    return 0.65
  }
  if (/4g/.test(effectiveType) || downlink !== null && downlink >= 8) {
    return 1.2
  }
  return 1
}

function resolveAdaptiveLookaheadSeconds(
  video: HTMLVideoElement,
  cues: YouTubeTimedCue[],
  strategy: YouTubeSubtitleStrategy,
): number {
  const playbackRate = Number.isFinite(video.playbackRate) && video.playbackRate > 0
    ? video.playbackRate
    : 1
  const density = getCueDensityPerSecond(cues, video.currentTime)
  const playbackMultiplier = playbackRate >= 1.25 ? 1.4 : playbackRate <= 0.75 ? 0.8 : 1
  const densityMultiplier = density >= 0.8 ? 0.7 : density <= 0.18 ? 1.25 : 1

  return clampLookaheadSeconds(
    strategy.baseLookaheadSeconds
    * playbackMultiplier
    * densityMultiplier
    * getNetworkLookaheadMultiplier(),
  )
}

function getTimedCueWindowIndex(cue: YouTubeTimedCue, strategy: YouTubeSubtitleStrategy): number {
  return Math.max(0, Math.floor(cue.startTime / strategy.windowSeconds))
}

function makeTimedCueWindowKey(
  cue: YouTubeTimedCue,
  targetLang: string,
  serviceMode: ServiceMode,
  context: YouTubeCueCacheContext | null,
  strategy: YouTubeSubtitleStrategy,
): string {
  const videoId = context?.videoId ?? getCurrentYouTubeVideoId()
  const trackHash = context?.trackHash ?? "dom"
  return ["youtube-window", videoId, trackHash, targetLang, serviceMode, getTimedCueWindowIndex(cue, strategy)].join("|")
}

function getLookaheadWindowCues(
  cues: YouTubeTimedCue[],
  currentTime: number,
  lookaheadSeconds: number,
): YouTubeTimedCue[] {
  const start = Math.max(0, currentTime - ACTIVE_CUE_TOLERANCE_SECONDS)
  const end = currentTime + lookaheadSeconds
  return cues.filter((cue) => cue.endTime >= start && cue.startTime <= end)
}

function updateRootDataset(
  rootContainer: HTMLElement,
  options: {
    anomalies: Set<YouTubeCaptionAnomaly>
    status: string
    source?: "timedtext" | "dom"
  },
): void {
  rootContainer.dataset.astraCaptionPipeline = "youtube-hybrid"
  rootContainer.dataset.astraCaptionStatus = options.status
  rootContainer.dataset.astraCaptionAnomalies = Array.from(options.anomalies).join(" ")

  if (options.source) {
    rootContainer.dataset.astraCaptionSource = options.source
  } else {
    delete rootContainer.dataset.astraCaptionSource
  }
}

function hasSentenceBoundary(text: string): boolean {
  return /[.!?。！？…][\]})'"”’»）】》]*$/.test(text.trim())
}

function buildCueTranslationUnits(cues: YouTubeTimedCue[]): YouTubeSubtitleTranslationUnit[] {
  const units = new Map<string, YouTubeTimedCue[]>()
  cues.forEach((cue) => {
    const existing = units.get(cue.text)
    if (existing) {
      existing.push(cue)
    } else {
      units.set(cue.text, [cue])
    }
  })
  return Array.from(units.entries()).map(([text, unitCues]) => ({ text, cues: unitCues }))
}

function buildSentenceWindowTranslationUnits(cues: YouTubeTimedCue[]): YouTubeSubtitleTranslationUnit[] {
  const sortedCues = [...cues].sort((left, right) => left.startTime - right.startTime)
  const units: YouTubeSubtitleTranslationUnit[] = []
  let currentCues: YouTubeTimedCue[] = []
  let currentText = ""

  const flush = () => {
    const text = normalizeYouTubeCaptionText(currentText)
    if (text && currentCues.length > 0) {
      units.push({ text, cues: currentCues })
    }
    currentCues = []
    currentText = ""
  }

  for (const cue of sortedCues) {
    const normalized = normalizeYouTubeCaptionText(cue.text)
    if (!normalized) continue

    const previousCue = currentCues.at(-1)
    const gapSeconds = previousCue ? cue.startTime - previousCue.endTime : 0
    const nextText = currentText ? `${currentText} ${normalized}` : normalized
    const shouldStartNewUnit = currentCues.length > 0 && (
      gapSeconds > 1.2
      || currentCues.length >= 4
      || nextText.length > 180
      || hasSentenceBoundary(currentText)
    )

    if (shouldStartNewUnit) {
      flush()
    }

    currentCues.push(cue)
    currentText = currentText ? `${currentText} ${normalized}` : normalized

    if (hasSentenceBoundary(currentText)) {
      flush()
    }
  }

  flush()
  return units
}

function buildSubtitleTranslationUnits(
  cues: YouTubeTimedCue[],
  strategy: YouTubeSubtitleStrategy,
): YouTubeSubtitleTranslationUnit[] {
  return strategy.segmentation === "sentence-window"
    ? buildSentenceWindowTranslationUnits(cues)
    : buildCueTranslationUnits(cues)
}

async function translateCueBatch(
  texts: string[],
  targetLang: string,
  serviceMode: ServiceMode,
  context?: YouTubeSubtitleTranslationContext,
): Promise<string[] | null> {
  try {
    const result = await translateTexts({
      texts,
      targetLang,
      serviceMode,
      task: "translate",
      ...(serviceMode === "best_quality" && context ? { context } : {}),
      ...(serviceMode === "best_quality"
        ? { customSystemPrompt: "Translate YouTube subtitles naturally for learners. Reconstruct fragmented captions into fluent target-language subtitle lines while preserving timing alignment and avoiding extra commentary." }
        : {}),
    })

    return result.ok ? result.translations : null
  } catch {
    return null
  }
}

async function translateCueBatches(
  cues: YouTubeTimedCue[],
  targetLang: string,
  serviceMode: ServiceMode,
  cacheContext: YouTubeCueCacheContext | null,
  translationContext: YouTubeSubtitleTranslationContext,
  cacheGet: YouTubeHybridSessionDeps["cacheGet"],
  cachePut: YouTubeHybridSessionDeps["cachePut"],
): Promise<"ready" | "downgraded" | "failed"> {
  const strategy = resolveSubtitleStrategy(serviceMode)
  const translationUnits = buildSubtitleTranslationUnits(cues, strategy)
  let downgraded = false

  for (let index = 0; index < translationUnits.length; index += strategy.batchSize) {
    const batch = translationUnits.slice(index, index + strategy.batchSize)
    const uncachedUnits = batch.filter((unit) => unit.cues.some((cue) => !cacheGet(makeYouTubeCueCacheKey(
      cue.text,
      targetLang,
      serviceMode,
      cacheContext,
    ))))
    if (uncachedUnits.length === 0) continue

    const uncachedTexts = uncachedUnits.map((unit) => unit.text)
    let translations = await translateCueBatch(uncachedTexts, targetLang, serviceMode, translationContext)
    if (!translations && serviceMode !== "fast") {
      translations = await translateCueBatch(uncachedTexts, targetLang, "fast")
      downgraded = translations !== null
    }

    if (!translations || translations.length < uncachedUnits.length) {
      const recoveredTranslations: string[] = []
      let recoveredWithDowngrade = false
      for (const unit of uncachedUnits) {
        let singleCueTranslation = await translateCueBatch([unit.text], targetLang, serviceMode, translationContext)
        if (!singleCueTranslation && serviceMode !== "fast") {
          singleCueTranslation = await translateCueBatch([unit.text], targetLang, "fast")
          recoveredWithDowngrade = recoveredWithDowngrade || singleCueTranslation !== null
        }
        const translatedText = singleCueTranslation?.[0]
        if (!translatedText) {
          return "failed"
        }
        recoveredTranslations.push(translatedText)
      }
      translations = recoveredTranslations
      downgraded = downgraded || recoveredWithDowngrade
    }

    uncachedUnits.forEach((unit, translationIndex) => {
      const translation = translations[translationIndex]
      if (translation) {
        unit.cues.forEach((cue) => {
          cachePut(makeYouTubeCueCacheKey(cue.text, targetLang, serviceMode, cacheContext), translation)
        })
      }
    })
  }

  cues.forEach((cue) => {
    const translation = cacheGet(makeYouTubeCueCacheKey(cue.text, targetLang, serviceMode, cacheContext))
    if (translation) {
      cue.translation = translation
    }
  })

  return downgraded ? "downgraded" : "ready"
}

export function startYouTubeHybridSubtitleSession(
  deps: YouTubeHybridSessionDeps,
): YouTubeHybridSession | null {
  const video = findYouTubeVideo(deps.rootContainer)
  if (!(video instanceof HTMLVideoElement)) {
    return null
  }

  const anomalies = new Set<YouTubeCaptionAnomaly>()
  const subtitleStrategy = resolveSubtitleStrategy(deps.serviceMode)
  const abortController = new AbortController()
  const pendingFallbackTranslations = new Set<string>()
  let cues: YouTubeTimedCue[] = []
  let stopped = false
  let delayedTrackTimer: ReturnType<typeof setTimeout> | null = null
  let mutationObserver: MutationObserver | null = null
  let lastDomText = ""
  let lastDomTextTimestamp = -Infinity
  let lastFallbackToken = 0
  let activeTrackCacheContext: YouTubeCueCacheContext | null = null

  const recordAnomaly = (anomaly: YouTubeCaptionAnomaly) => {
    anomalies.add(anomaly)
  }

  const refreshRootDataset = (status: string, source?: "timedtext" | "dom") => {
    updateRootDataset(deps.rootContainer, { anomalies, status, source })
    deps.onStatusChange?.()
    notifyTranscriptListeners()
  }

  const renderTimedTextCue = (): boolean => {
    if (cues.length === 0) return false

    const activeCues = getActiveTimedCues(cues, video.currentTime)
    if (activeCues.length === 0) {
      return false
    }

    const translations = activeCues
      .map((cue) => cue.translation ?? deps.cacheGet(makeYouTubeCueCacheKey(
        cue.text,
        deps.targetLang,
        deps.serviceMode,
        activeTrackCacheContext,
      )))
      .filter((translation): translation is string => typeof translation === "string" && translation.trim().length > 0)

    if (translations.length !== activeCues.length) {
      return false
    }

    const renderTarget = getRenderTarget(deps.rootContainer)
    const sourceText = collapseAdjacentDuplicates(activeCues.map((cue) => cue.text)).join(" ")
    const translationText = collapseAdjacentDuplicates(translations).join("\n")

    if (!hasMatchingTranslation(renderTarget, sourceText, translationText)) {
      deps.injectTranslation(renderTarget, translationText, sourceText)
    }
    refreshRootDataset("ready", "timedtext")
    return true
  }

  const renderDomFallback = async (): Promise<void> => {
    const renderTarget = getRenderTarget(deps.rootContainer)
    const sourceText = deps.getDomCaptionText(renderTarget).trim()
    if (!sourceText || sourceText.length < 2) {
      return
    }

    const now = Date.now()
    if (sourceText === lastDomText && now - lastDomTextTimestamp <= DUPLICATE_CUE_WINDOW_MS) {
      recordAnomaly("duplicated-cue")
    }
    lastDomText = sourceText
    lastDomTextTimestamp = now

    const cacheKey = makeYouTubeCueCacheKey(sourceText, deps.targetLang, deps.serviceMode, null)
    const cached = deps.cacheGet(cacheKey)
    if (cached) {
      if (!hasMatchingTranslation(renderTarget, sourceText, cached)) {
        deps.injectTranslation(renderTarget, cached, sourceText)
      }
      refreshRootDataset("fallback-ready", "dom")
      return
    }

    if (pendingFallbackTranslations.has(cacheKey)) {
      refreshRootDataset("fallback-pending", "dom")
      return
    }

    pendingFallbackTranslations.add(cacheKey)
    refreshRootDataset("fallback-pending", "dom")
    const fallbackToken = ++lastFallbackToken

    try {
      const result = await runInlineAction({
        text: sourceText,
        targetLang: deps.targetLang,
        serviceMode: deps.serviceMode,
        task: "translate",
      })

      if (!result.ok || stopped) {
        return
      }

      const currentText = deps.getDomCaptionText(getRenderTarget(deps.rootContainer)).trim()
      const activeTimedCues = getActiveTimedCues(cues, video.currentTime)
      if (fallbackToken !== lastFallbackToken || currentText !== sourceText || activeTimedCues.length > 0) {
        recordAnomaly("stale-cue-race")
        refreshRootDataset(activeTimedCues.length > 0 ? "ready" : "fallback-stale", activeTimedCues.length > 0 ? "timedtext" : "dom")
        return
      }

      deps.cachePut(cacheKey, result.text)
      const currentRenderTarget = getRenderTarget(deps.rootContainer)
      if (!hasMatchingTranslation(currentRenderTarget, sourceText, result.text)) {
        deps.injectTranslation(currentRenderTarget, result.text, sourceText)
      }
      refreshRootDataset("fallback-ready", "dom")
    } finally {
      pendingFallbackTranslations.delete(cacheKey)
    }
  }

  const renderCurrentCue = () => {
    maybeRefreshTrack()

    if (renderTimedTextCue()) {
      return
    }

    const activeTimedCues = getActiveTimedCues(cues, video.currentTime)
    if (activeTimedCues.length > 0) {
      void ensureLookaheadTranslation(activeTrack).then((status) => {
        if (!stopped && status === "ready") {
          renderCurrentCue()
        }
      })
      refreshRootDataset("prefetching", "timedtext")
      return
    }

    if (cues.length > 0) {
      void ensureLookaheadTranslation(activeTrack)
    }

    const fallbackSourceText = deps.getDomCaptionText(getRenderTarget(deps.rootContainer)).trim()
    if (!fallbackSourceText || fallbackSourceText.length < 2) {
      clearRenderedTranslation(deps.rootContainer)
      refreshRootDataset(cues.length > 0 ? "ready" : anomalies.has("missing-track") ? "no-captions" : "dom-fallback")
      return
    }

    void renderDomFallback()
  }

  let activeTrackBaseUrl: string | null = null
  let activeTrack: YouTubeCaptionTrack | null = null
  let trackRefreshInFlight: Promise<void> | null = null
  const translatedWindowKeys = new Set<string>()
  const pendingWindowKeys = new Set<string>()

  const readTranscriptSnapshot = (): YouTubeTranscriptSnapshot => {
    const activeIndex = cues.findIndex((cue) =>
      cue.startTime - ACTIVE_CUE_TOLERANCE_SECONDS <= video.currentTime
      && video.currentTime <= cue.endTime + ACTIVE_CUE_TOLERANCE_SECONDS,
    )

    return {
      available: cues.length > 0,
      // Settled no-captions only when the track is confirmed missing — not during load.
      noCaptions: cues.length === 0 && anomalies.has("missing-track"),
      title: getYouTubeVideoNoteTitle(),
      pageUrl: window.location.href,
      language: normalizeLanguageCode(activeTrack?.languageCode) || null,
      currentTime: video.currentTime,
      activeIndex,
      cues: cues.map((cue, index) => ({
        id: `${Math.round(cue.startTime * 1000)}-${index}`,
        startMs: Math.max(0, Math.round(cue.startTime * 1000)),
        endMs: Math.max(0, Math.round(cue.endTime * 1000)),
        text: cue.text,
        ...(cue.translation ?? deps.cacheGet(makeYouTubeCueCacheKey(
          cue.text,
          deps.targetLang,
          deps.serviceMode,
          activeTrackCacheContext,
        )) ? {
            translation: cue.translation ?? deps.cacheGet(makeYouTubeCueCacheKey(
              cue.text,
              deps.targetLang,
              deps.serviceMode,
              activeTrackCacheContext,
            )),
          } : {}),
      })),
    }
  }

  activeTranscriptSnapshotReader = readTranscriptSnapshot
  refreshRootDataset("starting")

  const ensureLookaheadTranslation = async (track: YouTubeCaptionTrack | null): Promise<"ready" | "pending" | "failed"> => {
    if (stopped || cues.length === 0 || !activeTrackCacheContext) return "ready"

    const lookaheadSeconds = resolveAdaptiveLookaheadSeconds(video, cues, subtitleStrategy)
    deps.rootContainer.dataset.astraCaptionLookaheadSeconds = String(lookaheadSeconds)
    deps.rootContainer.dataset.astraCaptionWindowSeconds = String(subtitleStrategy.windowSeconds)

    const windowCues = getLookaheadWindowCues(cues, video.currentTime, lookaheadSeconds)
    if (windowCues.length === 0) return "ready"

    const windowKeys = Array.from(new Set(windowCues.map((cue) => makeTimedCueWindowKey(
      cue,
      deps.targetLang,
      deps.serviceMode,
      activeTrackCacheContext,
      subtitleStrategy,
    ))))

    const translationCues = cues.filter((cue) => windowKeys.includes(makeTimedCueWindowKey(
      cue,
      deps.targetLang,
      deps.serviceMode,
      activeTrackCacheContext,
      subtitleStrategy,
    )))
    const uncachedCues = translationCues.filter((cue) => !deps.cacheGet(makeYouTubeCueCacheKey(
      cue.text,
      deps.targetLang,
      deps.serviceMode,
      activeTrackCacheContext,
    )))

    if (uncachedCues.length === 0) {
      windowKeys.forEach((key) => translatedWindowKeys.add(key))
      deps.rootContainer.dataset.astraCaptionCachedWindows = String(translatedWindowKeys.size)
      return "ready"
    }

    const pendingKey = windowKeys.join("::")
    if (pendingWindowKeys.has(pendingKey)) {
      return "pending"
    }

    const expectedTrackBaseUrl = activeTrackBaseUrl
    pendingWindowKeys.add(pendingKey)
    refreshRootDataset("prefetching", "timedtext")

    try {
      const translationStatus = await translateCueBatches(
        uncachedCues,
        deps.targetLang,
        deps.serviceMode,
        activeTrackCacheContext,
        buildSubtitleTranslationContext(translationCues, track),
        deps.cacheGet,
        deps.cachePut,
      )

      if (stopped || expectedTrackBaseUrl !== activeTrackBaseUrl) return "pending"
      if (translationStatus === "failed") {
        recordAnomaly("translation-failed")
        refreshRootDataset("translation-failed", "timedtext")
        return "failed"
      }
      if (translationStatus === "downgraded") {
        recordAnomaly("translation-downgraded")
      }

      windowKeys.forEach((key) => translatedWindowKeys.add(key))
      deps.rootContainer.dataset.astraCaptionCachedWindows = String(translatedWindowKeys.size)
      return "ready"
    } finally {
      pendingWindowKeys.delete(pendingKey)
    }
  }

  const loadTimedTextTrack = async (track: YouTubeCaptionTrack): Promise<void> => {
    activeTrackBaseUrl = track.baseUrl ?? null
    activeTrack = track
    activeTrackCacheContext = buildTrackCacheContext(track)

    if (delayedTrackTimer) {
      clearTimeout(delayedTrackTimer)
    }
    delayedTrackTimer = setTimeout(() => {
      if (!stopped && cues.length === 0 && activeTrackBaseUrl === track.baseUrl) {
        recordAnomaly("delayed-track")
        refreshRootDataset("waiting-track")
      }
    }, DELAYED_TRACK_TIMEOUT_MS)

    try {
      const nextCues = await fetchTimedTextCues(track, abortController.signal, () => {
        recordAnomaly("duplicated-cue")
        refreshRootDataset("prefetching")
      })

      if (stopped || activeTrackBaseUrl !== track.baseUrl) return

      if (delayedTrackTimer) {
        clearTimeout(delayedTrackTimer)
        delayedTrackTimer = null
      }

      if (nextCues.length === 0) {
        recordAnomaly("delayed-track")
        refreshRootDataset("dom-fallback")
        return
      }

      cues = nextCues
      lastFallbackToken += 1
      refreshRootDataset("prefetching")
      const translationStatus = await ensureLookaheadTranslation(track)

      if (stopped || activeTrackBaseUrl !== track.baseUrl) return
      if (translationStatus === "failed") return
      renderCurrentCue()
    } catch (error) {
      if (stopped || abortController.signal.aborted || error instanceof DOMException && error.name === "AbortError") {
        return
      }
      recordAnomaly("delayed-track")
      refreshRootDataset("dom-fallback")
    }
  }

  const maybeRefreshTrack = () => {
    const nextTrack = selectPreferredTrack(getCaptionTracksFromPlayerResponse(), deps.targetLang)
    if (!nextTrack?.baseUrl) {
      if (activeTrackBaseUrl !== null || cues.length > 0) {
        activeTrackBaseUrl = null
        activeTrack = null
        activeTrackCacheContext = null
        cues = []
        lastFallbackToken += 1
        clearRenderedTranslation(deps.rootContainer)
      }
      recordAnomaly("missing-track")
      refreshRootDataset("dom-fallback")
      return
    }

    if (trackRefreshInFlight) return
    if (activeTrackBaseUrl === nextTrack.baseUrl && cues.length > 0) return

    trackRefreshInFlight = loadTimedTextTrack(nextTrack)
      .finally(() => {
        trackRefreshInFlight = null
      })
  }

  maybeRefreshTrack()

  mutationObserver = new MutationObserver(() => {
    renderCurrentCue()
  })
  mutationObserver.observe(deps.rootContainer, {
    childList: true,
    subtree: true,
    characterData: true,
  })

  const playbackListener = () => {
    renderCurrentCue()
  }

  video.addEventListener("timeupdate", playbackListener)
  video.addEventListener("seeking", playbackListener)
  video.addEventListener("seeked", playbackListener)

  renderCurrentCue()

  return {
    stop() {
      stopped = true
      abortController.abort()
      if (delayedTrackTimer) {
        clearTimeout(delayedTrackTimer)
        delayedTrackTimer = null
      }
      mutationObserver?.disconnect()
      mutationObserver = null
      if (activeTranscriptSnapshotReader === readTranscriptSnapshot) {
        activeTranscriptSnapshotReader = null
        notifyTranscriptListeners()
      }
      video.removeEventListener("timeupdate", playbackListener)
      video.removeEventListener("seeking", playbackListener)
      video.removeEventListener("seeked", playbackListener)
    },
  }
}

export const youtubePlatform: VideoPlatformConfig = {
  id: "youtube",
  hostnames: ["www.youtube.com", "m.youtube.com", "www.youtube-nocookie.com", "youtube-nocookie.com"],
  subtitleRendering: nativeCaptionLineRenderingRule("youtube"),
  captionContainerSelector: [
    ".ytp-caption-window-container",
    ".ytp-caption-window-bottom",
    ".ytp-caption-window-top",
    "[class*='caption-window']",
  ].join(", "),
  captionSegmentSelector: ".ytp-caption-segment, [class*='caption-segment']",
  navigationEvent: "yt-navigate-finish",
  isVideoPage: () =>
    window.location.pathname === "/watch"
    || window.location.pathname.startsWith("/shorts/")
    || window.location.pathname.startsWith("/embed/"),
  extractCaptionText: extractYouTubeCaptionText,
}
