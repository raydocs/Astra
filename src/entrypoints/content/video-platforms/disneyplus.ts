import type { VideoPlatformConfig } from "./types"

export const disneyplusPlatform: VideoPlatformConfig = {
  id: "disneyplus",
  hostnames: ["www.disneyplus.com"],
  preferTextTracks: true,
  // Disney+ uses timedtext containers similar to Netflix
  captionContainerSelector: [
    ".player-timedtext-text-container",
    "[class*=\"subtitle\"]",
    "[class*=\"timedtext\"]",
  ].join(", "),
  captionSegmentSelector: ".player-timedtext-text-container span, [class*=\"subtitle\"] span",
  isVideoPage: () =>
    window.location.pathname.startsWith("/video/"),
  extractCaptionText: (container: HTMLElement) => {
    const spans = container.querySelectorAll("span")
    if (spans.length > 0) {
      return Array.from(spans)
        .map((s) => s.textContent?.trim() ?? "")
        .filter(Boolean)
        .join(" ")
    }
    return container.textContent?.trim() ?? ""
  },
}
