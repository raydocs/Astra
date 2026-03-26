import { describe, expect, it, vi } from "vitest"

const {
  translateTextsMock,
  buildInlineTranslationContextMock,
} = vi.hoisted(() => ({
  translateTextsMock: vi.fn(),
  buildInlineTranslationContextMock: vi.fn(),
}))

vi.mock("@/utils/translate/translate", () => ({
  translateTexts: translateTextsMock,
}))

vi.mock("./translation-context", () => ({
  buildInlineTranslationContext: buildInlineTranslationContextMock,
}))

import { runActionById, runInlineAction } from "./inline-actions"

describe("runInlineAction", () => {
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
