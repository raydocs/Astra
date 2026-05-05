import { beforeEach, describe, expect, it, vi } from "vitest"

const { requestTranslationBatchMock } = vi.hoisted(() => ({
  requestTranslationBatchMock: vi.fn(),
}))

vi.mock("@/utils/extension/messages", () => ({
  requestTranslationBatch: requestTranslationBatchMock,
}))

import { translateExplanationWithQualityRetry, translateTexts } from "./translate"

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
        terminologyGlossary: "Astra => 阿斯特拉",
      },
    })

    expect(requestTranslationBatchMock).toHaveBeenCalledWith({
      texts: ["Hello", "World"],
      targetLang: "zh-CN",
      sourceLang: "en",
      context: {
        pageTitle: "Astra",
        contentSummary: "Browser translation",
        terminologyGlossary: "Astra => 阿斯特拉",
      },
    })
  })

  it("preserves runtime route metadata as a Dual Path Marker summary", async () => {
    requestTranslationBatchMock.mockResolvedValueOnce({
      ok: true,
      translations: ["你好"],
      metadata: {
        route: "fallback",
        attemptedTransports: ["direct", "relay"],
        finalTransport: "relay",
        fallbackUsed: true,
      },
    })

    const result = await translateTexts({
      texts: ["Hello"],
      targetLang: "zh-CN",
    })

    expect(result).toMatchObject({
      ok: true,
      translations: ["你好"],
      pathSummary: {
        version: 1,
        totalBatches: 1,
        hasFallback: true,
        kinds: ["fallback"],
      },
    })
    expect(result.ok && result.pathSummary?.details).toContain("Direct failed; Astra relay completed the batch.")
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
      languageLevel: "beginner",
      explainMode: "exam",
      context: {
        pageTitle: "Astra",
      },
    })

    expect(requestTranslationBatchMock).toHaveBeenCalledWith({
      texts: ["Hello"],
      targetLang: "zh-CN",
      task: "explain",
      languageLevel: "beginner",
      explainMode: "exam",
      context: {
        pageTitle: "Astra",
      },
    })
  })

  it("retries explanation quality failures once with a repair instruction while preserving constraints", async () => {
    requestTranslationBatchMock
      .mockResolvedValueOnce({
        ok: true,
        translations: ["This explains that the product improves reading in context."],
      })
      .mockResolvedValueOnce({
        ok: true,
        translations: ["阿斯特拉 is the product name; this explains that the tool helps readers understand text while they read."],
      })

    const result = await translateExplanationWithQualityRetry({
      source: "Astra improves reading.",
      targetLang: "zh-CN",
      languageLevel: "beginner",
      explainMode: "exam",
      context: {
        pageTitle: "Astra Docs",
        explanationGlossary: "Astra => 阿斯特拉",
      },
      requiredGlossaryTerms: [{ sourceTerm: "Astra", preferredTerm: "阿斯特拉" }],
    })

    expect(result).toEqual({
      ok: true,
      text: "阿斯特拉 is the product name; this explains that the tool helps readers understand text while they read.",
      retried: true,
    })
    expect(requestTranslationBatchMock).toHaveBeenCalledTimes(2)
    expect(requestTranslationBatchMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      texts: ["Astra improves reading."],
      targetLang: "zh-CN",
      task: "explain",
      languageLevel: "beginner",
      explainMode: "exam",
      context: {
        pageTitle: "Astra Docs",
        explanationGlossary: "Astra => 阿斯特拉",
      },
      explanationRepairInstruction: expect.stringContaining("include every matched preferred term exactly"),
    }))
  })

  it("blocks explanation retry output when the repaired output still fails quality", async () => {
    requestTranslationBatchMock
      .mockResolvedValueOnce({ ok: true, translations: ["Hello world"] })
      .mockResolvedValueOnce({ ok: true, translations: ["Hello world"] })

    const result = await translateExplanationWithQualityRetry({
      source: "Hello world",
      targetLang: "zh-CN",
      languageLevel: "intermediate",
      explainMode: "deep",
    })

    expect(result).toMatchObject({
      ok: false,
      message: "Explanation output echoed the source text. Please retry.",
      retried: true,
    })
    expect(requestTranslationBatchMock).toHaveBeenCalledTimes(2)
  })

  it("surfaces retry transport failure after an initial explanation quality failure without a success payload", async () => {
    requestTranslationBatchMock
      .mockResolvedValueOnce({ ok: true, translations: ["Hello world"] })
      .mockRejectedValueOnce(new Error("retry network down"))

    const result = await translateExplanationWithQualityRetry({
      source: "Hello world",
      targetLang: "zh-CN",
      languageLevel: "intermediate",
      explainMode: "deep",
    })

    expect(result).toEqual({
      ok: false,
      message: "retry network down",
      retried: true,
      quality: {
        ok: false,
        issue: "source_echo",
        message: "Explanation output echoed the source text. Please retry.",
      },
    })
    expect(result).not.toHaveProperty("text")
    expect(requestTranslationBatchMock).toHaveBeenCalledTimes(2)
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

  it("returns INVALID_RESPONSE when provider returns mismatched translation count", async () => {
    requestTranslationBatchMock.mockResolvedValueOnce({
      ok: true,
      translations: ["only-one"],
    })

    const result = await translateTexts({
      texts: ["Hello", "World"],
      targetLang: "zh-CN",
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: "INVALID_RESPONSE",
        message: "Translation batch response length did not match the request.",
      },
    })
    expect(requestTranslationBatchMock).toHaveBeenCalledTimes(1)
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
