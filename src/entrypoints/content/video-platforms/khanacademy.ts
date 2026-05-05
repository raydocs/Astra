import { createTextTrackDomPlatform } from "./onboarding-template"
import { courseOverlayRenderingRule } from "./rendering-rules"

function isKhanAcademyVideoPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean)
  return segments.includes("v") || segments.includes("video") || segments.includes("videos")
}

export const khanAcademyPlatform = createTextTrackDomPlatform({
  id: "khanacademy",
  hostnames: ["www.khanacademy.org", "khanacademy.org"],
  subtitleRendering: courseOverlayRenderingRule("khanacademy"),
  captionContainerSelector: [
    "[data-testid='video-captions']",
    "[data-testid='captions']",
    ".khanacademy-video-captions",
    "[class*='Caption']",
    "[class*='caption']",
    "[class*='Subtitle']",
    "[class*='subtitle']",
  ],
  captionSegmentSelector: [
    "[data-testid='video-captions'] span",
    "[data-testid='captions'] span",
    ".khanacademy-video-captions span",
    "[class*='Caption'] span",
    "[class*='caption'] span",
    "[class*='Subtitle'] span",
    "[class*='subtitle'] span",
  ],
  isVideoPage: () => isKhanAcademyVideoPath(window.location.pathname),
})
