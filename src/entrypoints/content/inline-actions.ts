import { translateTexts } from "@/utils/translate/translate"
import type { TranslationTask } from "@/types/messages"
import { getActionById } from "@/types/actions"
import { buildInlineTranslationContext } from "./translation-context"

export interface InlineActionRequest {
  text: string
  targetLang: string
  task: TranslationTask
  customSystemPrompt?: string
  selectionContext?: string
  contextElement?: HTMLElement | null
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

export interface RunActionByIdRequest {
  actionId: string
  text: string
  targetLang: string
  selectionContext?: string
  contextElement?: HTMLElement | null
}

function renderCustomSystemPrompt(
  template: string,
  request: RunActionByIdRequest,
): string {
  return template
    .replaceAll("{{text}}", request.text)
    .replaceAll("{{targetLang}}", request.targetLang)
    .replaceAll("{{selectionContext}}", request.selectionContext ?? "")
}

export async function runActionById(request: RunActionByIdRequest): Promise<InlineActionResult> {
  const action = getActionById(request.actionId)
  if (!action) {
    return { ok: false, message: `Unknown action: ${request.actionId}` }
  }

  if (action.task === "custom") {
    const template = action.systemPrompt?.trim()
    if (!template) {
      return { ok: false, message: `Action ${request.actionId} is missing a prompt.` }
    }

    return runInlineAction({
      text: request.text,
      targetLang: request.targetLang,
      task: "custom",
      customSystemPrompt: renderCustomSystemPrompt(template, request),
      selectionContext: request.selectionContext,
      contextElement: request.contextElement,
    })
  }

  return runInlineAction({
    text: request.text,
    targetLang: request.targetLang,
    task: action.task,
    selectionContext: request.selectionContext,
    contextElement: request.contextElement,
  })
}

export async function runInlineAction(request: InlineActionRequest): Promise<InlineActionResult> {
  const context = await buildInlineTranslationContext({
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
