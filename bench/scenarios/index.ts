import { articleExtractionScenarios } from "./article-extraction"
import { dynamicContentScenarios } from "./dynamic-content"
import { frameCoordinationScenarios } from "./frame-coordination"
import { hoverScenarios } from "./hover"
import { inputTranslationScenarios } from "./input-translation"
import { interactionPriorityScenarios } from "./interaction-priority"
import { pageTranslationScenarios } from "./page-translation"
import { selectionExplainScenarios } from "./selection-explain"
import { siteAutomationScenarios } from "./site-automation"
import { subtitleScenarios } from "./subtitle"

export const benchmarkScenarios = [
  ...pageTranslationScenarios,
  ...siteAutomationScenarios,
  ...interactionPriorityScenarios,
  ...frameCoordinationScenarios,
  ...dynamicContentScenarios,
  ...articleExtractionScenarios,
  ...hoverScenarios,
  ...selectionExplainScenarios,
  ...inputTranslationScenarios,
  ...subtitleScenarios,
]
