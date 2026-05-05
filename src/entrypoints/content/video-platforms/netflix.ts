import { playerCaptionWindowRenderingRule } from "./rendering-rules"
import type { VideoPlatformConfig } from "./types"

export const netflixPlatform: VideoPlatformConfig = {
  id: "netflix",
  hostnames: ["www.netflix.com"],
  preferTextTracks: true,
  subtitleRendering: playerCaptionWindowRenderingRule("netflix"),
  // Netflix uses multiple possible subtitle container selectors across versions.
  // Try the most common ones — the platform adapter falls back gracefully if not found.
  captionContainerSelector: [
    ".player-timedtext",
    ".player-timedtext-text-container",
    "[data-uia='player-timedtext']",
  ].join(", "),
  captionSegmentSelector: ".player-timedtext span, [data-uia='player-timedtext'] span",
  isVideoPage: () =>
    window.location.pathname.startsWith("/watch/"),
  extractCaptionText: (container: HTMLElement) => {
    // Netflix wraps each subtitle line in nested spans or divs
    const spans = container.querySelectorAll("span")
    if (spans.length > 0) {
      return Array.from(spans)
        .map((s) => s.textContent?.trim() ?? "")
        .filter(Boolean)
        .join(" ")
    }
    // Fallback: direct text content
    return container.textContent?.trim() ?? ""
  },
}
