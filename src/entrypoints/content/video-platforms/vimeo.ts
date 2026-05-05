import { createTextTrackDomPlatform } from "./onboarding-template"
import { playerCaptionWindowRenderingRule } from "./rendering-rules"

function hasVimeoVideoIdSegment(pathname: string): boolean {
  return pathname
    .split("/")
    .some((segment) => /^\d{5,}$/.test(segment))
}

function isPlayerVideoPath(pathname: string): boolean {
  return /^\/video\/\d{5,}\/?$/.test(pathname)
}

export const vimeoPlatform = createTextTrackDomPlatform({
  id: "vimeo",
  hostnames: ["vimeo.com", "www.vimeo.com", "player.vimeo.com"],
  subtitleRendering: playerCaptionWindowRenderingRule("vimeo"),
  captionContainerSelector: [
    ".vp-captions",
    ".vp-captions-container",
    "[data-testid='captions']",
    "[class*='captions']",
  ],
  captionSegmentSelector: [
    ".vp-captions span",
    ".vp-captions-container span",
    "[data-testid='captions'] span",
    "[class*='captions'] span",
    "span",
  ],
  isVideoPage: () => {
    if (window.location.hostname === "player.vimeo.com") {
      return isPlayerVideoPath(window.location.pathname)
    }

    return hasVimeoVideoIdSegment(window.location.pathname)
  },
})
