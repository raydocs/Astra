import type { VideoPlatformConfig } from "./types"

export const courseraPlatform: VideoPlatformConfig = {
  id: "coursera",
  hostnames: ["www.coursera.org"],
  preferTextTracks: true,
  // Coursera uses a transcript component or subtitle overlay for course videos
  captionContainerSelector: [
    ".rc-VideoTranscript",
    "[class*=\"subtitle\"]",
    "[class*=\"transcript\"]",
  ].join(", "),
  captionSegmentSelector: ".rc-VideoTranscript span, [class*=\"subtitle\"] span",
  isVideoPage: () =>
    window.location.pathname.includes("/lecture/")
    || window.location.pathname.includes("/learn/"),
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
