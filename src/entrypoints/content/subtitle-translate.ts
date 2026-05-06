/**
 * Subtitle translation — detects platform subtitle sources and creates
 * translated HTML5 subtitle tracks alongside the originals.
 */

import { translateTexts } from "@/utils/translate/translate"
import { readConfig } from "@/utils/storage/config"
import { hasResolvedProviderAccess, resolveSiteTranslationSettings } from "@/types/config"
import { readAstraSession } from "@/utils/storage/auth"
import { sanitizeTranslationContext } from "@/utils/privacy"
import { getDocumentTranslationContext } from "./translation-context"
import { bilibiliApiSubtitleSource } from "./video-platforms/bilibili-subtitles"
import { genericTextTrackSubtitleSource } from "./video-platforms/generic-text-track-subtitles"
import type { PlatformSubtitleSource, PlatformSubtitleTrack } from "./video-platforms/subtitle-source"

const ASTRA_TRACK_LABEL_PREFIX = "Astra: "
const BATCH_SIZE = 20
const SOURCE_LOAD_TIMEOUT_MS = 2500

const SUBTITLE_SOURCES: PlatformSubtitleSource[] = [
  bilibiliApiSubtitleSource,
  genericTextTrackSubtitleSource,
]

const translatedTrackKeys = new WeakMap<HTMLVideoElement, Set<string>>()

function getTranslatedKeys(video: HTMLVideoElement): Set<string> {
  let keys = translatedTrackKeys.get(video)
  if (!keys) {
    keys = new Set<string>()
    translatedTrackKeys.set(video, keys)
  }
  return keys
}

function hasAstraTrackForTarget(video: HTMLVideoElement, targetLang: string): boolean {
  const expectedLabel = `${ASTRA_TRACK_LABEL_PREFIX}${targetLang}`
  return Array.from(video.textTracks).some((track) => track.label === expectedLabel)
    || Array.from(video.querySelectorAll("track"))
      .some((trackEl) => trackEl.label === expectedLabel)
}

function buildTrackKey(track: PlatformSubtitleTrack, targetLang: string): string {
  return `${track.platform}:${track.source}:${track.id}:${targetLang}`
}

function getSubtitleContext(privacyMode: boolean) {
  const documentContext = getDocumentTranslationContext()
  return privacyMode ? sanitizeTranslationContext(documentContext) : documentContext
}

function isYouTubeUrl(url: URL): boolean {
  return url.hostname === "youtu.be"
    || url.hostname === "youtube.com"
    || url.hostname.endsWith(".youtube.com")
    || url.hostname === "youtube-nocookie.com"
    || url.hostname.endsWith(".youtube-nocookie.com")
}

async function translateSubtitleCueTrack(
  video: HTMLVideoElement,
  sourceTrack: PlatformSubtitleTrack,
  targetLang: string,
  privacyMode: boolean,
): Promise<boolean> {
  const cues = sourceTrack.cues.filter((cue) => cue.text.trim().length > 0)
  if (cues.length === 0) return false

  const translations: string[] = []
  const context = getSubtitleContext(privacyMode)

  for (let index = 0; index < cues.length; index += BATCH_SIZE) {
    const batch = cues.slice(index, index + BATCH_SIZE).map((cue) => cue.text)
    const result = await translateTexts({
      texts: batch,
      targetLang,
      context,
    })

    if (!result.ok) {
      console.warn("[Astra] Subtitle translation batch failed:", result.error.message)
      return false
    }
    translations.push(...result.translations)
  }

  if (translations.length !== cues.length) {
    console.warn("[Astra] Subtitle translation count mismatch")
    return false
  }

  const trackElement = document.createElement("track")
  trackElement.kind = sourceTrack.kind
  trackElement.label = `${ASTRA_TRACK_LABEL_PREFIX}${targetLang}`
  trackElement.srclang = targetLang
  trackElement.dataset.astraSubtitlePlatform = sourceTrack.platform
  trackElement.dataset.astraSubtitleSource = sourceTrack.source
  trackElement.dataset.astraSubtitleTrackId = sourceTrack.id
  video.appendChild(trackElement)

  try {
    const newTrack = video.textTracks[video.textTracks.length - 1]
    if (!newTrack) {
      trackElement.remove()
      return false
    }

    for (let index = 0; index < cues.length; index += 1) {
      const cue = new VTTCue(cues[index].startTime, cues[index].endTime, translations[index])
      newTrack.addCue(cue)
    }

    newTrack.mode = "showing"
    return true
  } catch (error) {
    trackElement.remove()
    console.warn("[Astra] Failed to create translated subtitle track", error)
    return false
  }
}

async function withSourceTimeout<T>(
  source: PlatformSubtitleSource,
  promise: Promise<T>,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`[Astra] ${source.platform} subtitle source timed out`))
    }, SOURCE_LOAD_TIMEOUT_MS)
  })

  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

async function loadBestSubtitleTrack(
  video: HTMLVideoElement,
  targetLang: string,
): Promise<PlatformSubtitleTrack | null> {
  const url = new URL(window.location.href)

  for (const source of SUBTITLE_SOURCES) {
    if (!source.canLoad(url, document)) continue

    try {
      const tracks = await withSourceTimeout(source, source.loadTracks(video, {
        targetLang,
        astraTrackLabelPrefix: ASTRA_TRACK_LABEL_PREFIX,
      }))
      const track = tracks.find((candidate) => candidate.cues.length > 0)
      if (track) return track
    } catch (error) {
      console.warn(`[Astra] ${source.platform} subtitle source failed; trying fallback`, error)
    }
  }

  return null
}

/**
 * Find all videos on the page and translate their subtitle tracks.
 */
export async function translatePageSubtitles(): Promise<void> {
  const [config, session] = await Promise.all([
    readConfig(),
    readAstraSession(),
  ])
  const resolved = resolveSiteTranslationSettings(config, window.location.hostname)

  if (!resolved.enabled || !hasResolvedProviderAccess(config.provider, session)) return

  // YouTube has a dedicated hybrid video subtitle pipeline started alongside
  // page translation. Skip the native <track> subtitle translator there so the
  // two pipelines do not render duplicate translated captions.
  if (isYouTubeUrl(new URL(window.location.href))) return

  const videos = document.querySelectorAll("video")
  if (videos.length === 0) return

  for (const video of videos) {
    if (hasAstraTrackForTarget(video, resolved.targetLang)) continue

    const sourceTrack = await loadBestSubtitleTrack(video, resolved.targetLang)
    if (!sourceTrack) continue

    const trackKey = buildTrackKey(sourceTrack, resolved.targetLang)
    const translatedKeys = getTranslatedKeys(video)
    if (translatedKeys.has(trackKey)) continue

    const translated = await translateSubtitleCueTrack(video, sourceTrack, resolved.targetLang, config.privacyMode)
    if (translated) {
      translatedKeys.add(trackKey)
    }
  }
}

/**
 * Remove all Astra-injected subtitle tracks from the page.
 */
export function removeTranslatedSubtitles(): void {
  const videos = document.querySelectorAll("video")
  for (const video of videos) {
    translatedTrackKeys.delete(video)
    const trackElements = video.querySelectorAll("track")
    for (const trackEl of trackElements) {
      if (trackEl.label.startsWith(ASTRA_TRACK_LABEL_PREFIX)) {
        trackEl.remove()
      }
    }
  }
}
