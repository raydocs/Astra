/**
 * Platform-agnostic video subtitle translation interface.
 */

export type VideoSubtitleRenderingSurface = "player-overlay" | "course-overlay" | "transcript-overlay"

export type VideoSubtitleInsertionPoint = "native-caption-window" | "native-caption-line"

export type VideoSubtitleNativeCuePolicy = "preserve-native"

export interface VideoSubtitleRenderingRule {
  /** Stable identifier for the platform rendering strategy. */
  ruleId: string
  /** Logical surface where translated subtitles are rendered. */
  surface: VideoSubtitleRenderingSurface
  /** Native caption node level used as the insertion anchor. */
  insertionPoint: VideoSubtitleInsertionPoint
  /** Whether Astra keeps native cues visible while adding translations. */
  nativeCuePolicy: VideoSubtitleNativeCuePolicy
  /** Platform-level alignment for injected translations. */
  textAlign: "center" | "left"
  /** Platform-level width cap for injected translations. */
  maxWidth: string
  /** CSS class added to injected translation spans for platform-specific styling hooks. */
  className: string
}

export interface VideoPlatformConfig {
  /** Platform identifier */
  id: string
  /** Hostnames this platform matches */
  hostnames: string[]
  /** Prefer HTML5 text tracks as the primary structured subtitle source when available. */
  preferTextTracks?: boolean
  /** Explicit platform-level subtitle rendering rule applied to injected translations. */
  subtitleRendering: VideoSubtitleRenderingRule
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
