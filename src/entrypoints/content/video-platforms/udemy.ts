import { courseOverlayRenderingRule } from "./rendering-rules"
import type { VideoPlatformConfig } from "./types"

export const udemyPlatform: VideoPlatformConfig = {
  id: "udemy",
  hostnames: ["www.udemy.com"],
  preferTextTracks: true,
  subtitleRendering: courseOverlayRenderingRule("udemy"),
  // Udemy uses a dedicated captions display container for course videos
  captionContainerSelector: [
    ".captions-display--captions-container",
    "[class*=\"captions-display\"]",
    "[class*=\"captions\"]",
  ].join(", "),
  captionSegmentSelector: ".captions-display--captions-container span, [class*=\"captions\"] span",
  isVideoPage: () =>
    window.location.pathname.includes("/learn/")
    || window.location.pathname.includes("/lecture/"),
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
