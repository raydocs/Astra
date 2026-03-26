import type { VideoPlatformConfig } from "./types"

export const netflixPlatform: VideoPlatformConfig = {
  id: "netflix",
  hostnames: ["www.netflix.com"],
  // Netflix renders subtitles in a player-timedtext container
  captionContainerSelector: ".player-timedtext-text-container",
  captionSegmentSelector: ".player-timedtext-text-container span",
  isVideoPage: () =>
    window.location.pathname.startsWith("/watch/"),
  extractCaptionText: (container: HTMLElement) => {
    // Netflix wraps each subtitle line in nested spans
    const spans = container.querySelectorAll("span")
    if (spans.length === 0) return container.textContent?.trim() ?? ""
    return Array.from(spans)
      .map((s) => s.textContent?.trim() ?? "")
      .filter(Boolean)
      .join(" ")
  },
}
