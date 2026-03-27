import { fixturePlaywrightSmokeScenario } from "./fixture-playwright-smoke"
import { frameCoordinationBasicScenario } from "./frame-coordination-basic"
import { inputTranslationBasicScenario } from "./input-translation-basic"
import { interactionPriorityBasicScenario } from "./interaction-priority-basic"
import { pageTranslationArticleBasicScenario } from "./page-translation-article-basic"
import { pageTranslationArticleBasicSourceScenario } from "./page-translation-article-basic-source"
import { pageTranslationArticleBasicSourceTranslationOnlyScenario } from "./page-translation-article-basic-source-translation-only"
import { placeholderScenario } from "./placeholder"
import { subtitleBasicScenario } from "./subtitle-basic"
import { holdoutScenarios } from "./holdout/index"

export { fixturePlaywrightSmokeScenario } from "./fixture-playwright-smoke"
export { frameCoordinationBasicScenario } from "./frame-coordination-basic"
export { inputTranslationBasicScenario } from "./input-translation-basic"
export { interactionPriorityBasicScenario } from "./interaction-priority-basic"
export { pageTranslationArticleBasicScenario } from "./page-translation-article-basic"
export { pageTranslationArticleBasicSourceScenario } from "./page-translation-article-basic-source"
export { pageTranslationArticleBasicSourceTranslationOnlyScenario } from "./page-translation-article-basic-source-translation-only"
export { placeholderScenario } from "./placeholder"
export { subtitleBasicScenario } from "./subtitle-basic"

export const liveScenarios = [
  pageTranslationArticleBasicSourceScenario,
  pageTranslationArticleBasicSourceTranslationOnlyScenario,
  pageTranslationArticleBasicScenario,
  interactionPriorityBasicScenario,
  frameCoordinationBasicScenario,
  inputTranslationBasicScenario,
  subtitleBasicScenario,
  fixturePlaywrightSmokeScenario,
  placeholderScenario,
  ...holdoutScenarios,
]
