/**
 * Platform-agnostic video subtitle translation interface.
 */

export interface VideoPlatformConfig {
  /** Platform identifier */
  id: string
  /** Hostnames this platform matches */
  hostnames: string[]
  /** CSS selector for the subtitle/caption container to observe */
  captionContainerSelector: string
  /** CSS selector for individual caption text segments within the container */
  captionSegmentSelector?: string
  /** SPA navigation event name (e.g. "yt-navigate-finish" for YouTube) */
  navigationEvent?: string
  /** Function to check if current URL is a video page */
  isVideoPage: () => boolean
  /** Optional: extract text from caption container, overriding default logic */
  extractCaptionText?: (container: HTMLElement) => string
}
