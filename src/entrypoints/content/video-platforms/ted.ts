import { createTextTrackDomPlatform } from "./onboarding-template"
import { playerCaptionWindowRenderingRule } from "./rendering-rules"

function isTedTalkPath(pathname: string): boolean {
  return /^\/talks\/[^/]+\/?$/.test(pathname)
}

function isTedWatchPath(pathname: string): boolean {
  return pathname.startsWith("/watch/") || pathname.startsWith("/series/")
}

export const tedPlatform = createTextTrackDomPlatform({
  id: "ted",
  hostnames: ["www.ted.com", "ted.com", "embed.ted.com", "embed-ssl.ted.com"],
  subtitleRendering: playerCaptionWindowRenderingRule("ted"),
  captionContainerSelector: [
    ".ted-player__captions",
    "[data-testid='captions']",
    "[data-testid='video-captions']",
    "[class*='CaptionContainer']",
    "[class*='caption-container']",
  ],
  captionSegmentSelector: [
    ".ted-player__captions span",
    "[data-testid='captions'] span",
    "[data-testid='video-captions'] span",
    "[class*='CaptionContainer'] span",
    "[class*='caption-container'] span",
  ],
  isVideoPage: () => isTedTalkPath(window.location.pathname) || isTedWatchPath(window.location.pathname),
})
