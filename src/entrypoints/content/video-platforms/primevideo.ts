import { playerCaptionWindowRenderingRule } from "./rendering-rules"
import type { VideoPlatformConfig } from "./types"

export const primevideoPlatform: VideoPlatformConfig = {
  id: "primevideo",
  hostnames: ["www.primevideo.com", "www.amazon.com"],
  preferTextTracks: true,
  subtitleRendering: playerCaptionWindowRenderingRule("primevideo"),
  // Amazon Prime Video uses SDK caption overlays or generic caption containers
  captionContainerSelector: [
    ".atvwebplayersdk-captions-text",
    "[class*=\"captions-display\"]",
    "[class*=\"caption\"]",
  ].join(", "),
  captionSegmentSelector: ".atvwebplayersdk-captions-text span, [class*=\"caption\"] span",
  isVideoPage: () =>
    window.location.hostname === "www.primevideo.com"
    || window.location.pathname.startsWith("/gp/video/"),
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
