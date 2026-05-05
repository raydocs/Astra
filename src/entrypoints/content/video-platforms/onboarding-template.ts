import { playerCaptionWindowRenderingRule } from "./rendering-rules"
import type { VideoPlatformConfig, VideoSubtitleRenderingRule } from "./types"

type SelectorList = string | string[]

interface TextTrackDomPlatformOptions {
  id: string
  hostnames: string[]
  captionContainerSelector: SelectorList
  captionSegmentSelector?: SelectorList
  navigationEvent?: string
  isVideoPage: () => boolean
  textSelectors?: SelectorList
  normalizeText?: (text: string) => string
  subtitleRendering?: VideoSubtitleRenderingRule
}

const ASTRA_SUBTITLE_CLASS = "astra-video-subtitle"

function joinSelectors(selectors: SelectorList): string {
  return Array.isArray(selectors) ? selectors.join(", ") : selectors
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

function collapseAdjacentDuplicates(lines: string[]): string[] {
  const collapsed: string[] = []
  for (const line of lines) {
    if (collapsed[collapsed.length - 1] !== line) {
      collapsed.push(line)
    }
  }
  return collapsed
}

function assertRenderingRuleIdCoupledToPlatformId(
  platformId: string,
  rule: VideoSubtitleRenderingRule,
): void {
  const expectedPrefix = `${platformId}-`
  if (!rule.ruleId.startsWith(expectedPrefix)) {
    throw new Error(
      `Video platform "${platformId}" subtitleRendering.ruleId must start with "${expectedPrefix}"; received "${rule.ruleId}"`,
    )
  }
}

export function createTextTrackDomPlatform(options: TextTrackDomPlatformOptions): VideoPlatformConfig {
  const captionContainerSelector = joinSelectors(options.captionContainerSelector)
  const captionSegmentSelector = options.captionSegmentSelector
    ? joinSelectors(options.captionSegmentSelector)
    : undefined
  const textSelector = options.textSelectors
    ? joinSelectors(options.textSelectors)
    : captionSegmentSelector

  const normalize = options.normalizeText ?? normalizeWhitespace
  const subtitleRendering = options.subtitleRendering ?? playerCaptionWindowRenderingRule(options.id)
  assertRenderingRuleIdCoupledToPlatformId(options.id, subtitleRendering)

  const platform: VideoPlatformConfig = {
    id: options.id,
    hostnames: options.hostnames,
    preferTextTracks: true,
    subtitleRendering,
    captionContainerSelector,
    isVideoPage: options.isVideoPage,
    extractCaptionText: (container: HTMLElement) => {
      const clone = container.cloneNode(true) as HTMLElement
      clone.querySelectorAll(`.${ASTRA_SUBTITLE_CLASS}`).forEach((el) => el.remove())

      if (textSelector) {
        const lines = collapseAdjacentDuplicates(
          Array.from(clone.querySelectorAll(textSelector))
            .map((el) => normalize(el.textContent ?? ""))
            .filter(Boolean),
        )

        if (lines.length > 0) {
          return normalize(lines.join(" "))
        }
      }

      return normalize(clone.textContent ?? "")
    },
  }

  if (captionSegmentSelector) {
    platform.captionSegmentSelector = captionSegmentSelector
  }

  if (options.navigationEvent) {
    platform.navigationEvent = options.navigationEvent
  }

  return platform
}
