import { interactionStressHoldoutScenario } from "./interaction-stress"
import { translationRaceHoldoutScenario } from "./translation-race"

export { interactionStressHoldoutScenario } from "./interaction-stress"
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
  translationRaceHoldoutScenario,
]
