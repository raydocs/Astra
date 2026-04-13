import { beforeEach, describe, expect, it, vi } from "vitest"

const { requestTranslationBatchMock } = vi.hoisted(() => ({
  requestTranslationBatchMock: vi.fn(),
}))

vi.mock("@/utils/extension/messages", () => ({
  requestTranslationBatch: requestTranslationBatchMock,
}))

import { translateTexts } from "./translate"

describe("translateTexts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    expect(requestTranslationBatchMock).toHaveBeenCalledTimes(2)
  })

  it("passes translation context through each batch request", async () => {
    requestTranslationBatchMock.mockResolvedValue({
      ok: true,
      translations: ["你好", "世界"],
    })

    await translateTexts({
      texts: ["Hello", "World"],
      targetLang: "zh-CN",
      sourceLang: "en",
      context: {
        pageTitle: "Astra",
        contentSummary: "Browser translation",
        terminologyGlossary: "Astra=阿斯特拉",
      },
    })

    expect(requestTranslationBatchMock).toHaveBeenCalledWith({
      texts: ["Hello", "World"],
      targetLang: "zh-CN",
      sourceLang: "en",
      context: {
        pageTitle: "Astra",
        contentSummary: "Browser translation",
        terminologyGlossary: "Astra=阿斯特拉",
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

  it("routes repeated requests through the background each time", async () => {
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
})
