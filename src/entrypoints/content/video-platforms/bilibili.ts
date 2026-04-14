import type { VideoPlatformConfig } from "./types"
import type { VideoNoteTranscriptCapture, VideoTranscriptSegment } from "@/types/video-notes"

const BILIBILI_CAPTION_CONTAINER_SELECTOR = [
  ".bpx-player-subtitle-panel",
  ".bpx-player-subtitle-wrap",
  "[class*='bpx-player-subtitle']",
  "[class*='subtitle-panel']",
  "[class*='subtitle-wrap']",
].join(", ")

const BILIBILI_CAPTION_TEXT_SELECTOR = [
  ".bpx-player-subtitle-panel-text",
  "[class*='subtitle-panel-text']",
  "[class*='subtitle-text']",
].join(", ")

function normalizeBilibiliCaptionText(text: string): string {
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function collapseAdjacentDuplicates(parts: string[]): string[] {
  const normalized: string[] = []

  for (const part of parts) {
    const text = normalizeBilibiliCaptionText(part)
    if (!text) continue
    if (normalized.at(-1) === text) continue
    normalized.push(text)
  }

  return normalized
}

function extractBilibiliCaptionText(container: HTMLElement): string {
  const textNodes = Array.from(container.querySelectorAll(BILIBILI_CAPTION_TEXT_SELECTOR))
    .map((node) => normalizeBilibiliCaptionText(node.textContent ?? ""))
    .filter(Boolean)

  if (textNodes.length > 0) {
    return collapseAdjacentDuplicates(textNodes).join(" ")
  }

  return normalizeBilibiliCaptionText(container.textContent ?? "")
}

function findBilibiliVideoElement(): HTMLVideoElement | null {
  const scopedVideo = document.querySelector(".bpx-player-container video")
  if (scopedVideo instanceof HTMLVideoElement) {
    return scopedVideo
  }
  const video = document.querySelector("video")
  return video instanceof HTMLVideoElement ? video : null
}

function collectBilibiliTrackSegments(video: HTMLVideoElement): VideoTranscriptSegment[] {
  const trackEntries = Array.from(video.textTracks)
    .filter((track) => track.kind === "subtitles" || track.kind === "captions")
    .sort((left, right) => {
      const leftScore = (left.mode === "showing" ? 20 : 0) + ((left.label ?? "").trim() ? 5 : 0)
      const rightScore = (right.mode === "showing" ? 20 : 0) + ((right.label ?? "").trim() ? 5 : 0)
      return rightScore - leftScore
    })

  for (const track of trackEntries) {
    const segments: VideoTranscriptSegment[] = []
    if (!track.cues) continue
    for (let index = 0; index < track.cues.length; index += 1) {
      const cue = track.cues[index]
      if (!cue || !("text" in cue) || typeof cue.text !== "string") continue
      const text = normalizeBilibiliCaptionText(cue.text.replace(/<\/?[^>]+>/g, " "))
      const startMs = Math.max(0, Math.floor(cue.startTime * 1000))
      const endMs = Math.max(0, Math.floor(cue.endTime * 1000))
      if (!text || endMs <= startMs) continue
      segments.push({ startMs, endMs, text })
    }
    if (segments.length > 0) {
      return segments
    }
  }

  return []
}

function buildBilibiliDeepLinkTemplate(): string | null {
  try {
    const url = new URL(window.location.href)
    url.hash = ""
    url.searchParams.set("t", "{seconds}")
    return url.toString()
  } catch {
    return null
  }
}

export function getBilibiliVideoNoteTitle(): string | null {
  const title = document.title.trim()
  if (!title) return null
  return title
    .replace(/\s*[-_]\s*哔哩哔哩.*$/i, "")
    .replace(/\s*[-_]\s*bilibili.*$/i, "")
    .trim() || null
}

export function captureBilibiliVideoNoteTranscript(): VideoNoteTranscriptCapture | null {
  const video = findBilibiliVideoElement()
  if (!(video instanceof HTMLVideoElement)) {
    return null
  }

  const transcriptSegments = collectBilibiliTrackSegments(video)
  if (transcriptSegments.length === 0) {
    return null
  }

  return {
    transcriptSegments,
    language: null,
    deepLinkTemplate: buildBilibiliDeepLinkTemplate(),
    durationSec: Number.isFinite(video.duration) ? Number(video.duration) : null,
  }
}

export const bilibiliPlatform: VideoPlatformConfig = {
  id: "bilibili",
  hostnames: ["www.bilibili.com"],
  preferTextTracks: true,
  captionContainerSelector: BILIBILI_CAPTION_CONTAINER_SELECTOR,
  captionSegmentSelector: BILIBILI_CAPTION_TEXT_SELECTOR,
  isVideoPage: () =>
    window.location.pathname.startsWith("/video/")
    || window.location.pathname.startsWith("/bangumi/play/"),
  extractCaptionText: extractBilibiliCaptionText,
}
