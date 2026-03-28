import { filterScenariosBySplit } from "../splits"
import type { BenchmarkScenario, BenchmarkSplit, BenchmarkSurface } from "../types"
import { articleExtractionScenarios } from "./article-extraction"
import { dynamicContentScenarios } from "./dynamic-content"
import { frameCoordinationScenarios } from "./frame-coordination"
import { hoverScenarios } from "./hover"
import { inputTranslationScenarios } from "./input-translation"
import { interactionPriorityScenarios } from "./interaction-priority"
import { pageTranslationScenarios } from "./page-translation"
import { pdfTranslationScenarios } from "./pdf"
import { selectionExplainScenarios } from "./selection-explain"
import { siteAutomationScenarios } from "./site-automation"
import { subtitleScenarios } from "./subtitle"
import { subtitleFileScenarios } from "./subtitle-file"
import { youtubeSubtitleScenarios } from "./youtube-subtitle"

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
  ...subtitleFileScenarios,
  ...pdfTranslationScenarios,
  ...youtubeSubtitleScenarios,
]

export function selectBenchmarkScenarios(options: {
  surface?: BenchmarkSurface | null
  split?: BenchmarkSplit | null
} = {}): Array<(typeof benchmarkScenarios)[number]> {
  const filteredBySurface = benchmarkScenarios.filter((scenario) => !options.surface || scenario.surface === options.surface)
  return filterScenariosBySplit(filteredBySurface, options.split ?? null)
}
