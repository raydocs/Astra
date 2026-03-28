import { hoverTranslationMovingTargetsHoldoutScenario } from "./hover-translation-moving-targets"
import { interactionStressHoldoutScenario } from "./interaction-stress"
import { pageTranslationFeedCardChurnHoldoutScenario } from "./page-translation-feed-card-churn"
import { pageTranslationLayoutNoiseSourceHoldoutScenario } from "./page-translation-layout-noise-source"
import { pdfReaderLayoutNoiseHoldoutScenario } from "./pdf-reader-layout-noise"
import { subtitleFileMalformedHoldoutScenario } from "./subtitle-file-malformed"
import { youtubeSubtitleRaceHoldoutScenario } from "./youtube-subtitle-race"
import { translationRaceHoldoutScenario } from "./translation-race"

export { hoverTranslationMovingTargetsHoldoutScenario } from "./hover-translation-moving-targets"
export { interactionStressHoldoutScenario } from "./interaction-stress"
export { pageTranslationFeedCardChurnHoldoutScenario } from "./page-translation-feed-card-churn"
export { pageTranslationLayoutNoiseSourceHoldoutScenario } from "./page-translation-layout-noise-source"
export { pdfReaderLayoutNoiseHoldoutScenario } from "./pdf-reader-layout-noise"
export { subtitleFileMalformedHoldoutScenario } from "./subtitle-file-malformed"
export { youtubeSubtitleRaceHoldoutScenario } from "./youtube-subtitle-race"
export { translationRaceHoldoutScenario } from "./translation-race"

/**
 * Holdout scenarios that are intentionally NOT registered in the main
 * `bench-live/scenarios/index.ts`. They are only accessible via explicit
 * import from this module.
 *
 * These test harder conditions and are meant to be run explicitly by ID
 * to detect regressions or validate robustness beyond the basic suite.
 */
export const holdoutScenarios = [
  hoverTranslationMovingTargetsHoldoutScenario,
  interactionStressHoldoutScenario,
  pageTranslationFeedCardChurnHoldoutScenario,
  pageTranslationLayoutNoiseSourceHoldoutScenario,
  pdfReaderLayoutNoiseHoldoutScenario,
  subtitleFileMalformedHoldoutScenario,
  youtubeSubtitleRaceHoldoutScenario,
  translationRaceHoldoutScenario,
]
