import { translateTexts } from "@/utils/translate/translate"
import type { TranslationTask } from "@/types/messages"
import { buildInlineTranslationContext } from "./translation-context"

export interface InlineActionRequest {
  text: string
  targetLang: string
  task: TranslationTask
  selectionContext?: string
}

export interface InlineActionSuccess {
  ok: true
  text: string
}

export interface InlineActionError {
  ok: false
  message: string
}

export type InlineActionResult = InlineActionSuccess | InlineActionError

export async function runInlineAction(request: InlineActionRequest): Promise<InlineActionResult> {
  const context = buildInlineTranslationContext({
    selectionContext: request.selectionContext,
  })

  try {
    const result = await translateTexts({
      texts: [request.text],
      targetLang: request.targetLang,
      context,
      ...(request.task !== "translate" ? { task: request.task } : {}),
    })

    if (!result.ok) {
      return { ok: false, message: result.error.message }
    }

    const text = result.translations[0]
    if (!text) {
      return { ok: false, message: "Empty response from provider." }
    }

    return { ok: true, text }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Request failed.",
    }
  }
}
