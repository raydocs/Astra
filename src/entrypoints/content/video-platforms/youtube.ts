import type { VideoPlatformConfig } from "./types"

export const youtubePlatform: VideoPlatformConfig = {
  id: "youtube",
  hostnames: ["www.youtube.com", "m.youtube.com"],
  captionContainerSelector: ".ytp-caption-window-container",
  captionSegmentSelector: ".ytp-caption-segment",
  navigationEvent: "yt-navigate-finish",
  isVideoPage: () =>
    window.location.pathname === "/watch"
    || window.location.pathname.startsWith("/shorts/"),
}
