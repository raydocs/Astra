import type {
  VideoSubtitleInsertionPoint,
  VideoSubtitleRenderingRule,
  VideoSubtitleRenderingSurface,
} from "./types"

const DEFAULT_PLAYER_MAX_WIDTH = "min(92vw, 72ch)"
const DEFAULT_COURSE_MAX_WIDTH = "min(88vw, 68ch)"

function renderRuleClassName(platformId: string): string {
  return `astra-video-subtitle--${platformId}`
}

export function createSubtitleRenderingRule(
  platformId: string,
  options: {
    surface?: VideoSubtitleRenderingSurface
    insertionPoint?: VideoSubtitleInsertionPoint
    textAlign?: VideoSubtitleRenderingRule["textAlign"]
    maxWidth?: string
  } = {},
): VideoSubtitleRenderingRule {
  const surface = options.surface ?? "player-overlay"
  const insertionPoint = options.insertionPoint ?? "native-caption-window"

  return {
    ruleId: `${platformId}-${surface === "course-overlay" ? "course-overlay" : insertionPoint}`,
    surface,
    insertionPoint,
    nativeCuePolicy: "preserve-native",
    textAlign: options.textAlign ?? "center",
    maxWidth: options.maxWidth ?? (surface === "course-overlay" ? DEFAULT_COURSE_MAX_WIDTH : DEFAULT_PLAYER_MAX_WIDTH),
    className: renderRuleClassName(platformId),
  }
}

export function playerCaptionWindowRenderingRule(platformId: string): VideoSubtitleRenderingRule {
  return createSubtitleRenderingRule(platformId, {
    surface: "player-overlay",
    insertionPoint: "native-caption-window",
  })
}

export function nativeCaptionLineRenderingRule(platformId: string): VideoSubtitleRenderingRule {
  return createSubtitleRenderingRule(platformId, {
    surface: "player-overlay",
    insertionPoint: "native-caption-line",
  })
}

export function courseOverlayRenderingRule(platformId: string): VideoSubtitleRenderingRule {
  return createSubtitleRenderingRule(platformId, {
    surface: "course-overlay",
    insertionPoint: "native-caption-window",
  })
}
