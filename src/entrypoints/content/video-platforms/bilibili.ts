import type { VideoPlatformConfig } from "./types"

export const bilibiliPlatform: VideoPlatformConfig = {
  id: "bilibili",
  hostnames: ["www.bilibili.com"],
  preferTextTracks: true,
  // Bilibili uses bpx-player subtitle panel for subtitle text
  captionContainerSelector: ".bpx-player-subtitle-panel",
  captionSegmentSelector: ".bpx-player-subtitle-panel-text",
  isVideoPage: () =>
    window.location.pathname.startsWith("/video/")
    || window.location.pathname.startsWith("/bangumi/play/"),
  extractCaptionText: (container: HTMLElement) => {
    // Bilibili renders subtitle text in span elements inside the panel
    const textEl = container.querySelector(".bpx-player-subtitle-panel-text")
    return textEl?.textContent?.trim() ?? ""
  },
}
