import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  requestTranslationBatchMock,
  readConfigMock,
} = vi.hoisted(() => ({
  requestTranslationBatchMock: vi.fn(),
  readConfigMock: vi.fn(),
}))

vi.mock("@/utils/extension/messages", () => ({
  requestTranslationBatch: requestTranslationBatchMock,
}))

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
}))

import { translateTexts } from "./translate"

describe("translateTexts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readConfigMock.mockResolvedValue({
      connectionMode: "astra",
      languageLevel: "intermediate",
      provider: {
        id: "openai",
        model: "gpt-5.4-nano",
      },
    })
  })

  it("splits oversized inputs and recombines the result in order", async () => {
    const longText = "a".repeat(9000)

    requestTranslationBatchMock.mockImplementation(({
      texts,
    }: {
      texts: string[]
    }) => Promise.resolve({
      ok: true,
      translations: texts,
    }))

    const result = await translateTexts({
      texts: [longText],
      targetLang: "zh-CN",
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.translations).toEqual([longText])
    }
    expect(requestTranslationBatchMock).toHaveBeenCalledTimes(3)
  })

  it("passes translation context through each batch request", async () => {
    requestTranslationBatchMock.mockResolvedValue({
      ok: true,
      translations: ["你好", "世界"],
    })

    await translateTexts({
      texts: ["Hello", "World"],
      targetLang: "zh-CN",
      context: {
        pageTitle: "Astra",
        contentSummary: "Browser translation",
      },
    })

    expect(requestTranslationBatchMock).toHaveBeenCalledWith({
      texts: ["Hello", "World"],
      targetLang: "zh-CN",
      context: {
        pageTitle: "Astra",
        contentSummary: "Browser translation",
      },
    })
  })

  it("passes placeholder format through each batch request", async () => {
    requestTranslationBatchMock.mockResolvedValue({
      ok: true,
      translations: ["你好"],
    })

    await translateTexts({
      texts: ["__ASTRA_RT_0_OPEN_STRONG__Hello__ASTRA_RT_0_CLOSE__"],
      targetLang: "zh-CN",
      placeholderFormat: "astra-rich-text-v1",
    })

    expect(requestTranslationBatchMock).toHaveBeenCalledWith({
      texts: ["__ASTRA_RT_0_OPEN_STRONG__Hello__ASTRA_RT_0_CLOSE__"],
      targetLang: "zh-CN",
      placeholderFormat: "astra-rich-text-v1",
    })
  })

  it("passes explain tasks through each batch request", async () => {
    requestTranslationBatchMock.mockResolvedValue({
      ok: true,
      translations: ["Greeting explanation"],
    })

    await translateTexts({
      texts: ["Hello"],
      targetLang: "zh-CN",
      task: "explain",
      context: {
        pageTitle: "Astra",
      },
    })

    expect(requestTranslationBatchMock).toHaveBeenCalledWith({
      texts: ["Hello"],
      targetLang: "zh-CN",
      task: "explain",
      context: {
        pageTitle: "Astra",
      },
    })
  })

  it("does not split placeholder-rich requests across multiple transport batches", async () => {
    const longText = `__ASTRA_RT_0_OPEN_STRONG__${"a".repeat(9000)}__ASTRA_RT_0_CLOSE__`
    requestTranslationBatchMock.mockResolvedValue({
      ok: true,
      translations: [longText],
    })

    const result = await translateTexts({
      texts: [longText],
      targetLang: "zh-CN",
      placeholderFormat: "astra-rich-text-v1",
    })

    expect(result.ok).toBe(true)
    expect(requestTranslationBatchMock).toHaveBeenCalledTimes(1)
  })

  it("returns a typed error when batch transport fails", async () => {
    requestTranslationBatchMock.mockRejectedValueOnce(new Error("network down"))

    const result = await translateTexts({
      texts: ["Hello"],
      targetLang: "zh-CN",
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: "PROVIDER_REQUEST_FAILED",
        message: "network down",
      },
    })
  })

  it("isolates cache hits by provider/model context", async () => {
    readConfigMock
      .mockResolvedValueOnce({
        connectionMode: "astra",
        languageLevel: "intermediate",
        provider: {
          id: "openai",
          model: "gpt-5.4-nano",
        },
      })
      .mockResolvedValueOnce({
        connectionMode: "custom",
        languageLevel: "advanced",
        provider: {
          id: "gemini",
          model: "gemini-3.1-flash-lite-preview",
          relayBaseURL: "https://gemini.example/v1",
        },
      })

    requestTranslationBatchMock
      .mockResolvedValueOnce({ ok: true, translations: ["你好-openai"] })
      .mockResolvedValueOnce({ ok: true, translations: ["你好-gemini"] })

    const first = await translateTexts({
      texts: ["Hello"],
      targetLang: "zh-CN",
    })
    const second = await translateTexts({
      texts: ["Hello"],
      targetLang: "zh-CN",
    })

    expect(first).toEqual({ ok: true, translations: ["你好-openai"] })
    expect(second).toEqual({ ok: true, translations: ["你好-gemini"] })
    expect(requestTranslationBatchMock).toHaveBeenCalledTimes(2)
  })

  it("isolates cache hits by source language and request context", async () => {
    requestTranslationBatchMock
      .mockResolvedValueOnce({ ok: true, translations: ["苹果（品牌）"] })
      .mockResolvedValueOnce({ ok: true, translations: ["苹果（水果）"] })
      .mockResolvedValueOnce({ ok: true, translations: ["poison"] })
      .mockResolvedValueOnce({ ok: true, translations: ["married"] })

    const brand = await translateTexts({
      texts: ["Apple"],
      targetLang: "zh-CN",
      sourceLang: "en",
      context: {
        terminologyGlossary: "Apple=苹果（品牌）",
      },
    })
    const fruit = await translateTexts({
      texts: ["Apple"],
      targetLang: "zh-CN",
      sourceLang: "en",
      context: {
        terminologyGlossary: "Apple=苹果（水果）",
      },
    })
    const germanGift = await translateTexts({
      texts: ["gift"],
      targetLang: "en",
      sourceLang: "de",
    })
    const swedishGift = await translateTexts({
      texts: ["gift"],
      targetLang: "en",
      sourceLang: "sv",
    })

    expect(brand).toEqual({ ok: true, translations: ["苹果（品牌）"] })
    expect(fruit).toEqual({ ok: true, translations: ["苹果（水果）"] })
    expect(germanGift).toEqual({ ok: true, translations: ["poison"] })
    expect(swedishGift).toEqual({ ok: true, translations: ["married"] })
    expect(requestTranslationBatchMock).toHaveBeenCalledTimes(4)
  })
})
