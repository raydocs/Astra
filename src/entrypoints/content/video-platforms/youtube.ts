import type { VideoPlatformConfig } from "./types"

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

export const youtubePlatform: VideoPlatformConfig = {
  id: "youtube",
  hostnames: ["www.youtube.com", "m.youtube.com"],
  captionContainerSelector: ".ytp-caption-window-container",
  captionSegmentSelector: ".ytp-caption-segment",
  navigationEvent: "yt-navigate-finish",
  isVideoPage: () =>
    window.location.pathname === "/watch"
    || window.location.pathname.startsWith("/shorts/"),
  extractCaptionText: extractYouTubeCaptionText,
}
