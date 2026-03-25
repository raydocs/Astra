import { translateTexts } from "@/utils/translate/translate"
import type { TranslationTask } from "@/types/messages"
import { getActionById, type BuiltinAction } from "@/types/actions"
import { buildInlineTranslationContext } from "./translation-context"

export interface InlineActionRequest {
  text: string
  targetLang: string
  task: TranslationTask
  selectionContext?: string
  contextElement?: HTMLElement | null
  customSystemPrompt?: string
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

export interface InlineActionByIdRequest {
  actionId: string
  text: string
  targetLang: string
  selectionContext?: string
}

export async function runActionById(request: InlineActionByIdRequest): Promise<InlineActionResult> {
  const action = getActionById(request.actionId)
  if (!action) {
    return { ok: false, message: `Unknown action: ${request.actionId}` }
  }

  if (action.task === "custom" && action.systemPrompt) {
    const prompt = action.systemPrompt
      .replace(/\{\{text\}\}/g, request.text)
      .replace(/\{\{targetLang\}\}/g, request.targetLang)

    return runInlineAction({
      text: request.text,
      targetLang: request.targetLang,
      task: "custom",
      selectionContext: request.selectionContext,
      customSystemPrompt: prompt,
    })
  }

  return runInlineAction({
    text: request.text,
    targetLang: request.targetLang,
    task: action.task as "translate" | "explain",
    selectionContext: request.selectionContext,
  })
}

export async function runInlineAction(request: InlineActionRequest): Promise<InlineActionResult> {
  const context = buildInlineTranslationContext({
    selectionContext: request.selectionContext,
    contextElement: request.contextElement,
  })

  try {
    const result = await translateTexts({
      texts: [request.text],
      targetLang: request.targetLang,
      context,
      ...(request.task !== "translate" ? { task: request.task } : {}),
      ...(request.customSystemPrompt ? { customSystemPrompt: request.customSystemPrompt } : {}),
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
