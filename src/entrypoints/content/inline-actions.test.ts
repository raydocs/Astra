import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  translateTextsMock,
  buildInlineTranslationContextMock,
} = vi.hoisted(() => ({
  translateTextsMock: vi.fn(),
  buildInlineTranslationContextMock: vi.fn(),
}))

vi.mock("@/utils/translate/translate", () => ({
  translateTexts: translateTextsMock,
  translateExplanationWithQualityRetry: async (request: {
    source: string
    requiredGlossaryTerms?: Array<{ sourceTerm: string; preferredTerm: string; enabled?: boolean }>
    [key: string]: unknown
  }) => {
    const {
      buildExplanationRepairInstruction,
      validateExplanationQuality,
    } = await import("@/utils/translate/explanation-quality")
    const { source, requiredGlossaryTerms = [], ...translateRequest } = request
    const baseRequest = { ...translateRequest, texts: [source], task: "explain" }
    const firstResult = await translateTextsMock(baseRequest)
    if (!firstResult.ok) return { ok: false, message: firstResult.error.message, retried: false }
    const firstText = firstResult.translations[0] ?? ""
    const firstQuality = validateExplanationQuality({ source, explanation: firstText, requiredGlossaryTerms })
    if (firstQuality.ok) return { ok: true, text: firstText, retried: false }
    const retryResult = await translateTextsMock({
      ...baseRequest,
      explanationRepairInstruction: buildExplanationRepairInstruction(firstQuality),
    })
    if (!retryResult.ok) return { ok: false, message: retryResult.error.message, retried: true, quality: firstQuality }
    const retryText = retryResult.translations[0] ?? ""
    const retryQuality = validateExplanationQuality({ source, explanation: retryText, requiredGlossaryTerms })
    if (!retryQuality.ok) return { ok: false, message: retryQuality.message, retried: true, quality: retryQuality }
    return { ok: true, text: retryText, retried: true }
  },
}))

vi.mock("./translation-context", () => ({
  buildInlineTranslationContext: buildInlineTranslationContextMock,
}))

import { runActionById, runInlineAction } from "./inline-actions"

describe("runInlineAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("runs translate requests without adding an explicit task", async () => {
    const contextElement = document.createElement("p")

    buildInlineTranslationContextMock.mockReturnValue({
      pageTitle: "Fixture Page",
      selectionContext: "Neighboring sentence",
    })
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["你好，世界"],
    })

    const result = await runInlineAction({
      text: "Hello world",
      targetLang: "zh-CN",
      task: "translate",
      selectionContext: "Neighboring sentence",
      contextElement,
    })

    expect(buildInlineTranslationContextMock).toHaveBeenCalledWith({
      selectionContext: "Neighboring sentence",
      contextElement,
    })
    expect(translateTextsMock).toHaveBeenCalledWith({
      texts: ["Hello world"],
      targetLang: "zh-CN",
      context: {
        pageTitle: "Fixture Page",
        selectionContext: "Neighboring sentence",
      },
    })
    expect(result).toEqual({ ok: true, text: "你好，世界" })
  })

  it("runs explain requests with the explain task and full context passthrough", async () => {
    const contextElement = document.createElement("article")

    buildInlineTranslationContextMock.mockReturnValue({
      pageTitle: "Astra Docs",
      pageUrl: "https://example.com/docs",
      contentSummary: "A long article about contextual translation.",
      selectionContext: "The selected sentence appears in the API overview section.",
    })
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["这句话介绍了上下文翻译 API 的作用。"],
    })

    const result = await runInlineAction({
      text: "This sentence introduces the contextual translation API.",
      targetLang: "zh-CN",
      task: "explain",
      languageLevel: "beginner",
      explainMode: "exam",
      selectionContext: "The selected sentence appears in the API overview section.",
      contextElement,
    })

    expect(buildInlineTranslationContextMock).toHaveBeenCalledWith({
      selectionContext: "The selected sentence appears in the API overview section.",
      contextElement,
    })
    expect(translateTextsMock).toHaveBeenCalledWith({
      texts: ["This sentence introduces the contextual translation API."],
      targetLang: "zh-CN",
      task: "explain",
      languageLevel: "beginner",
      explainMode: "exam",
      context: {
        pageTitle: "Astra Docs",
        pageUrl: "https://example.com/docs",
        contentSummary: "A long article about contextual translation.",
        selectionContext: "The selected sentence appears in the API overview section.",
      },
    })
    expect(result).toEqual({
      ok: true,
      text: "这句话介绍了上下文翻译 API 的作用。",
    })
  })

  it("passes explanation glossary terms through inline explain requests", async () => {
    buildInlineTranslationContextMock.mockReturnValue({
      pageTitle: "Astra Docs",
      selectionContext: "Astra improves reading.",
    })
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["阿斯特拉 is the product name; the sentence says it improves reading."],
    })

    const result = await runInlineAction({
      text: "Astra improves reading.",
      targetLang: "zh-CN",
      task: "explain",
      explanationGlossary: [{ sourceTerm: "Astra", preferredTerm: "阿斯特拉", enabled: true }],
    })

    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      context: expect.objectContaining({
        explanationGlossary: "Astra => 阿斯特拉",
      }),
    }))
    expect(result).toEqual({
      ok: true,
      text: "阿斯特拉 is the product name; the sentence says it improves reading.",
      matchedGlossaryTerms: [{ sourceTerm: "Astra", preferredTerm: "阿斯特拉" }],
    })
  })

  it("retries inline explanations that omit required glossary terms with preserved constraints", async () => {
    buildInlineTranslationContextMock.mockReturnValue({
      pageTitle: "Astra Docs",
    })
    translateTextsMock
      .mockResolvedValueOnce({
        ok: true,
        translations: ["This explains that the product improves reading."],
      })
      .mockResolvedValueOnce({
        ok: true,
        translations: ["阿斯特拉 is the product name; this explains that the product improves reading."],
      })

    const result = await runInlineAction({
      text: "Astra improves reading.",
      targetLang: "zh-CN",
      task: "explain",
      languageLevel: "beginner",
      explainMode: "exam",
      explanationGlossary: [{ sourceTerm: "Astra", preferredTerm: "阿斯特拉", enabled: true }],
    })

    expect(result).toEqual({
      ok: true,
      text: "阿斯特拉 is the product name; this explains that the product improves reading.",
      matchedGlossaryTerms: [{ sourceTerm: "Astra", preferredTerm: "阿斯特拉" }],
    })
    expect(translateTextsMock).toHaveBeenCalledTimes(2)
    expect(translateTextsMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      texts: ["Astra improves reading."],
      targetLang: "zh-CN",
      task: "explain",
      languageLevel: "beginner",
      explainMode: "exam",
      context: expect.objectContaining({
        pageTitle: "Astra Docs",
        explanationGlossary: "Astra => 阿斯特拉",
      }),
      explanationRepairInstruction: expect.stringContaining("include every matched preferred term exactly"),
    }))
  })

  it("blocks inline explanations when the retry still fails quality", async () => {
    buildInlineTranslationContextMock.mockReturnValue({
      pageTitle: "Astra Docs",
    })
    translateTextsMock
      .mockResolvedValueOnce({ ok: true, translations: ["This explains that the product improves reading."] })
      .mockResolvedValueOnce({ ok: true, translations: ["Still missing the required term."] })

    const result = await runInlineAction({
      text: "Astra improves reading.",
      targetLang: "zh-CN",
      task: "explain",
      explanationGlossary: [{ sourceTerm: "Astra", preferredTerm: "阿斯特拉", enabled: true }],
    })

    expect(result).toEqual({
      ok: false,
      message: "Explanation output omitted required glossary term \"阿斯特拉\" for source term \"Astra\". Please retry.",
    })
    expect(translateTextsMock).toHaveBeenCalledTimes(2)
  })

  it("returns an inline error when the provider reports a typed failure", async () => {
    buildInlineTranslationContextMock.mockReturnValue({
      pageTitle: "Astra Docs",
    })
    translateTextsMock.mockResolvedValue({
      ok: false,
      error: {
        code: "PROVIDER_REQUEST_FAILED",
        message: "rate limit",
      },
    })

    const result = await runInlineAction({
      text: "Hello",
      targetLang: "zh-CN",
      task: "translate",
    })

    expect(result).toEqual({
      ok: false,
      message: "rate limit",
    })
  })

  it("returns an inline error when the provider returns an empty translations array", async () => {
    buildInlineTranslationContextMock.mockReturnValue({
      pageTitle: "Astra Docs",
    })
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: [],
    })

    const result = await runInlineAction({
      text: "Hello",
      targetLang: "zh-CN",
      task: "translate",
    })

    expect(result).toEqual({
      ok: false,
      message: "Empty response from provider.",
    })
  })

  it("surfaces thrown provider errors as inline action failures", async () => {
    buildInlineTranslationContextMock.mockReturnValue({
      pageTitle: "Astra Docs",
    })
    translateTextsMock.mockRejectedValue(new Error("network down"))

    const result = await runInlineAction({
      text: "Hello",
      targetLang: "zh-CN",
      task: "translate",
    })

    expect(result).toEqual({
      ok: false,
      message: "network down",
    })
  })

  it("renders built-in custom actions into a custom system prompt", async () => {
    const contextElement = document.createElement("section")

    buildInlineTranslationContextMock.mockReturnValue({
      pageTitle: "Astra Docs",
      selectionContext: "A sentence near the selected text.",
    })
    translateTextsMock.mockResolvedValue({
      ok: true,
      translations: ["精简总结"],
    })

    const result = await runActionById({
      actionId: "summarize",
      text: "Hello world",
      targetLang: "zh-CN",
      selectionContext: "A sentence near the selected text.",
      contextElement,
    })

    expect(translateTextsMock).toHaveBeenCalledWith({
      texts: ["Hello world"],
      targetLang: "zh-CN",
      task: "custom",
      customSystemPrompt: "Summarize the following text concisely in zh-CN. Output only the summary, no extra explanation.\n\nText: Hello world",
      context: {
        pageTitle: "Astra Docs",
        selectionContext: "A sentence near the selected text.",
      },
    })
    expect(result).toEqual({
      ok: true,
      text: "精简总结",
    })
  })
})
