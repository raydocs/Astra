import type { AstraConfig } from "@/types/config"
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
}

export type ConfiguredProvider = AstraConfig["provider"]
