import type { VideoPlatformConfig } from "./types"

export const bilibiliPlatform: VideoPlatformConfig = {
  id: "bilibili",
  hostnames: ["www.bilibili.com"],
  preferTextTracks: true,
  captionContainerSelector: [
    ".bpx-player-subtitle-panel",
    "[class*='subtitle-panel']",
  ].join(", "),
  captionSegmentSelector: ".bpx-player-subtitle-panel-text, [class*='subtitle-panel-text']",
  isVideoPage: () =>
    window.location.pathname.startsWith("/video/")
    || window.location.pathname.startsWith("/bangumi/play/"),
  extractCaptionText: (container: HTMLElement) => {
    const textEl = container.querySelector(".bpx-player-subtitle-panel-text, [class*='subtitle-panel-text']")
    return textEl?.textContent?.trim() ?? ""
  },
}
