/**
 * Subtitle translation — detects HTML5 video text tracks and creates
 * translated subtitle tracks alongside the originals.
 */

import { translateTexts } from "@/utils/translate/translate"
import { readConfig } from "@/utils/storage/config"
import { hasResolvedProviderAccess, resolveSiteTranslationSettings } from "@/types/config"
import { readAstraSession } from "@/utils/storage/auth"
import { sanitizeTranslationContext } from "@/utils/privacy"
import { getDocumentTranslationContext } from "./translation-context"

const ASTRA_TRACK_LABEL_PREFIX = "Astra: "
const BATCH_SIZE = 20

interface ParsedCue {
  startTime: number
  endTime: number
  text: string
}

/**
 * Parse VTT cue text, stripping simple VTT formatting tags.
 */
function stripVTTTags(text: string): string {
  return text
    .replace(/<\/?[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim()
}

/**
 * Collect all text cues from a TextTrack.
 */
function collectCues(track: TextTrack): ParsedCue[] {
  if (!track.cues) return []

  const cues: ParsedCue[] = []
  for (let i = 0; i < track.cues.length; i++) {
    const cue = track.cues[i]
    if (cue instanceof VTTCue) {
      const text = stripVTTTags(cue.text)
      if (text) {
        cues.push({ startTime: cue.startTime, endTime: cue.endTime, text })
      }
    }
  }
  return cues
}

/**
 * Check whether a track was injected by Astra.
 */
function isAstraTrack(track: TextTrack): boolean {
  return track.label.startsWith(ASTRA_TRACK_LABEL_PREFIX)
}

/**
 * Create a translated subtitle track for a video element.
 */
async function translateTrack(
  video: HTMLVideoElement,
  sourceTrack: TextTrack,
  targetLang: string,
  privacyMode: boolean,
): Promise<void> {
  const cues = collectCues(sourceTrack)
  if (cues.length === 0) return

  // Translate cue texts in batches
  const allTexts = cues.map((c) => c.text)
  const translations: string[] = []
  const documentContext = getDocumentTranslationContext()
  const context = privacyMode ? sanitizeTranslationContext(documentContext) : documentContext

  for (let i = 0; i < allTexts.length; i += BATCH_SIZE) {
    const batch = allTexts.slice(i, i + BATCH_SIZE)
    const result = await translateTexts({
      texts: batch,
      targetLang,
      context,
    })

    if (!result.ok) {
      console.warn("[Astra] Subtitle translation batch failed:", result.error.message)
      return
    }
    translations.push(...result.translations)
  }

  if (translations.length !== cues.length) {
    console.warn("[Astra] Subtitle translation count mismatch")
    return
  }

  // Create a new track element with translated cues
  const trackElement = document.createElement("track")
  trackElement.kind = sourceTrack.kind === "captions" ? "captions" : "subtitles"
  trackElement.label = `${ASTRA_TRACK_LABEL_PREFIX}${targetLang}`
  trackElement.srclang = targetLang
  video.appendChild(trackElement)

  // Wait for the track to be added to the video's text tracks
  const newTrack = video.textTracks[video.textTracks.length - 1]
  if (!newTrack) return

  // Add translated cues
  for (let i = 0; i < cues.length; i++) {
    const vttCue = new VTTCue(cues[i].startTime, cues[i].endTime, translations[i])
    newTrack.addCue(vttCue)
  }

  // Enable the translated track
  newTrack.mode = "showing"
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

  const videos = document.querySelectorAll("video")
  if (videos.length === 0) return

  for (const video of videos) {
    const tracks = Array.from(video.textTracks)
    const sourceTrack = tracks.find(
      (t) =>
        !isAstraTrack(t)
        && (t.kind === "subtitles" || t.kind === "captions")
        && t.cues
        && t.cues.length > 0,
    )

    if (!sourceTrack) continue

    // Skip if we already have a translated track for this video
    const hasAstraTrack = tracks.some(isAstraTrack)
    if (hasAstraTrack) continue

    // Need cues loaded — set mode to hidden if disabled
    const prevMode = sourceTrack.mode
    if (sourceTrack.mode === "disabled") {
      sourceTrack.mode = "hidden"
    }

    // Wait a tick for cues to populate if track was just enabled
    await new Promise((resolve) => setTimeout(resolve, 100))

    await translateTrack(video, sourceTrack, resolved.targetLang, config.privacyMode)

    // Restore original mode
    if (prevMode === "disabled") {
      sourceTrack.mode = prevMode
    }
  }
}

/**
 * Remove all Astra-injected subtitle tracks from the page.
 */
export function removeTranslatedSubtitles(): void {
  const videos = document.querySelectorAll("video")
  for (const video of videos) {
    const trackElements = video.querySelectorAll("track")
    for (const trackEl of trackElements) {
      if (trackEl.label.startsWith(ASTRA_TRACK_LABEL_PREFIX)) {
        trackEl.remove()
      }
    }
  }
}
