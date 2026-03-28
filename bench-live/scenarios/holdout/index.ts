import { interactionStressHoldoutScenario } from "./interaction-stress"
import { pageTranslationFeedCardChurnHoldoutScenario } from "./page-translation-feed-card-churn"
import { youtubeSubtitleRaceHoldoutScenario } from "./youtube-subtitle-race"
import { translationRaceHoldoutScenario } from "./translation-race"

export { interactionStressHoldoutScenario } from "./interaction-stress"
export { pageTranslationFeedCardChurnHoldoutScenario } from "./page-translation-feed-card-churn"
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
  interactionStressHoldoutScenario,
  pageTranslationFeedCardChurnHoldoutScenario,
  youtubeSubtitleRaceHoldoutScenario,
  translationRaceHoldoutScenario,
]
