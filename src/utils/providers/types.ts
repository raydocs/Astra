import type { AstraConfig, ServiceMode } from "@/types/config"
import type {
  TranslationPlaceholderFormat,
  TranslationRequestContext,
  TranslationTask,
} from "@/types/messages"

export interface ProviderTranslationRequest {
  texts: string[]
  targetLang: string
  sourceLang?: string
  context?: TranslationRequestContext
  task?: TranslationTask
  customSystemPrompt?: string
  placeholderFormat?: TranslationPlaceholderFormat
  languageLevel?: "beginner" | "intermediate" | "advanced"
  explainMode?: "beginner" | "exam" | "deep"
  serviceMode?: ServiceMode
  explanationRepairInstruction?: string
}

export type ConfiguredProvider = AstraConfig["provider"]
