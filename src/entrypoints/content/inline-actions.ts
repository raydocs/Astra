import { translateExplanationWithQualityRetry, translateTexts } from "@/utils/translate/translate"
import { getMatchedExplanationGlossaryTerms, type MatchedExplanationGlossaryTerm } from "@/utils/translate/explanation-quality"
import type { TranslationTask } from "@/types/messages"
import { serializeExplanationGlossary, type CustomAction, type ExplainMode, type ExplanationGlossaryTerm, type LanguageLevel, type ServiceMode } from "@/types/config"
import { getActionById } from "@/types/actions"
import { buildInlineTranslationContext } from "./translation-context"
import { getSafeAiUnavailableCopy } from "@/utils/copy-dictionary"

export interface InlineActionRequest {
  text: string
  targetLang: string
  task: TranslationTask
  customSystemPrompt?: string
  languageLevel?: LanguageLevel
  explainMode?: ExplainMode
  serviceMode?: ServiceMode
  explanationGlossary?: ExplanationGlossaryTerm[]
  selectionContext?: string
  contextElement?: HTMLElement | null
}

export interface InlineActionSuccess {
  ok: true
  text: string
  matchedGlossaryTerms?: MatchedExplanationGlossaryTerm[]
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
  languageLevel?: LanguageLevel
  explainMode?: ExplainMode
  serviceMode?: ServiceMode
  explanationGlossary?: ExplanationGlossaryTerm[]
  selectionContext?: string
  contextElement?: HTMLElement | null
  customActions?: CustomAction[]
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
  const action = getActionById(request.actionId, { customActions: request.customActions })
  if (!action) {
    return { ok: false, message: getSafeAiUnavailableCopy({ code: "UNKNOWN", message: `Unknown action: ${request.actionId}` }) }
  }

  if (action.task === "custom") {
    const template = action.systemPrompt?.trim()
    if (!template) {
      return { ok: false, message: getSafeAiUnavailableCopy({ code: "UNKNOWN", message: `Action ${request.actionId} is missing a prompt.` }) }
    }

    return runInlineAction({
      text: request.text,
      targetLang: request.targetLang,
      task: "custom",
      customSystemPrompt: renderCustomSystemPrompt(template, request),
      serviceMode: request.serviceMode,
      explanationGlossary: request.explanationGlossary,
      selectionContext: request.selectionContext,
      contextElement: request.contextElement,
    })
  }

  return runInlineAction({
    text: request.text,
    targetLang: request.targetLang,
    task: action.task,
    languageLevel: request.languageLevel,
    explainMode: request.explainMode,
    serviceMode: request.serviceMode,
    explanationGlossary: request.explanationGlossary,
    selectionContext: request.selectionContext,
    contextElement: request.contextElement,
  })
}

export async function runInlineAction(request: InlineActionRequest): Promise<InlineActionResult> {
  const context = await buildInlineTranslationContext({
    selectionContext: request.selectionContext,
    contextElement: request.contextElement,
  })
  const explanationGlossary = request.task === "explain"
    ? serializeExplanationGlossary(request.explanationGlossary)
    : ""
  const requestContext = explanationGlossary
    ? { ...context, explanationGlossary }
    : context

  try {
    if (request.task === "explain") {
      const matchedGlossaryTerms = getMatchedExplanationGlossaryTerms({
        source: request.text,
        glossaryTerms: request.explanationGlossary,
      })
      const result = await translateExplanationWithQualityRetry({
        source: request.text,
        targetLang: request.targetLang,
        context: requestContext,
        ...(request.serviceMode ? { serviceMode: request.serviceMode } : {}),
        ...(request.languageLevel ? { languageLevel: request.languageLevel } : {}),
        ...(request.explainMode ? { explainMode: request.explainMode } : {}),
        requiredGlossaryTerms: matchedGlossaryTerms,
      })

      if (!result.ok) {
        return { ok: false, message: getSafeAiUnavailableCopy(
          { code: "UNKNOWN", message: result.message },
          { fallbackCopy: result.message },
        ) }
      }

      return {
        ok: true,
        text: result.text,
        ...(matchedGlossaryTerms.length > 0 ? { matchedGlossaryTerms } : {}),
      }
    }

    const result = await translateTexts({
      texts: [request.text],
      targetLang: request.targetLang,
      ...(request.serviceMode ? { serviceMode: request.serviceMode } : {}),
      context: requestContext,
      ...(request.task !== "translate" ? { task: request.task } : {}),
      ...(request.customSystemPrompt ? { customSystemPrompt: request.customSystemPrompt } : {}),
    })

    if (!result.ok) {
      return { ok: false, message: getSafeAiUnavailableCopy(result.error) }
    }

    const text = result.translations[0] ?? ""
    if (!text) {
      return { ok: false, message: getSafeAiUnavailableCopy({ code: "INVALID_RESPONSE", message: "Astra returned an empty response." }) }
    }

    return { ok: true, text }
  } catch (error) {
    return {
      ok: false,
      message: getSafeAiUnavailableCopy({
        code: "UNKNOWN",
        message: error instanceof Error ? error.message : "Request failed.",
      }),
    }
  }
}
