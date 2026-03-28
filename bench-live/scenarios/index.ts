import { fixturePlaywrightSmokeScenario } from "./fixture-playwright-smoke"
import { frameCoordinationBasicScenario } from "./frame-coordination-basic"
import { hoverTranslationBasicScenario } from "./hover-translation-basic"
import { inputTranslationBasicScenario } from "./input-translation-basic"
import { inputTranslationFieldMatrixScenario } from "./input-translation-field-matrix"
import { interactionPriorityBasicScenario } from "./interaction-priority-basic"
import { pageTranslationArticleBasicScenario } from "./page-translation-article-basic"
import { pageTranslationArticleBasicSourceScenario } from "./page-translation-article-basic-source"
import { pageTranslationArticleBasicSourceTranslationOnlyScenario } from "./page-translation-article-basic-source-translation-only"
import { pageTranslationFeedCardListSourceScenario } from "./page-translation-feed-card-list-source"
import { pageTranslationFormsAndNavSourceScenario } from "./page-translation-forms-and-nav-source"
import { pageTranslationNestedBlocksSourceScenario } from "./page-translation-nested-blocks-source"
import { pdfReaderBasicScenario } from "./pdf-reader-basic"
import { placeholderScenario } from "./placeholder"
import { youtubeSubtitleBasicScenario } from "./youtube-subtitle-basic"
import { subtitleBasicScenario } from "./subtitle-basic"
import { holdoutScenarios } from "./holdout/index"

export { fixturePlaywrightSmokeScenario } from "./fixture-playwright-smoke"
export { frameCoordinationBasicScenario } from "./frame-coordination-basic"
export { hoverTranslationBasicScenario } from "./hover-translation-basic"
export { inputTranslationBasicScenario } from "./input-translation-basic"
export { inputTranslationFieldMatrixScenario } from "./input-translation-field-matrix"
export { interactionPriorityBasicScenario } from "./interaction-priority-basic"
export { pageTranslationArticleBasicScenario } from "./page-translation-article-basic"
export { pageTranslationArticleBasicSourceScenario } from "./page-translation-article-basic-source"
export { pageTranslationArticleBasicSourceTranslationOnlyScenario } from "./page-translation-article-basic-source-translation-only"
export { pageTranslationFeedCardListSourceScenario } from "./page-translation-feed-card-list-source"
export { pageTranslationFormsAndNavSourceScenario } from "./page-translation-forms-and-nav-source"
export { pageTranslationNestedBlocksSourceScenario } from "./page-translation-nested-blocks-source"
export { pdfReaderBasicScenario } from "./pdf-reader-basic"
export { placeholderScenario } from "./placeholder"
export { youtubeSubtitleBasicScenario } from "./youtube-subtitle-basic"
export { subtitleBasicScenario } from "./subtitle-basic"

export const liveScenarios = [
  pageTranslationArticleBasicSourceScenario,
  pageTranslationArticleBasicSourceTranslationOnlyScenario,
  pageTranslationArticleBasicScenario,
  pageTranslationFeedCardListSourceScenario,
  pageTranslationFormsAndNavSourceScenario,
  pageTranslationNestedBlocksSourceScenario,
  pdfReaderBasicScenario,
  interactionPriorityBasicScenario,
  frameCoordinationBasicScenario,
  hoverTranslationBasicScenario,
  inputTranslationBasicScenario,
  inputTranslationFieldMatrixScenario,
  youtubeSubtitleBasicScenario,
  subtitleBasicScenario,
  fixturePlaywrightSmokeScenario,
  placeholderScenario,
  ...holdoutScenarios,
]
