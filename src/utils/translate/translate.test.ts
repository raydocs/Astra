import { describe, expect, it, vi } from "vitest"

const { requestTranslationBatchMock } = vi.hoisted(() => ({
  requestTranslationBatchMock: vi.fn(),
}))

vi.mock("@/utils/extension/messages", () => ({
  requestTranslationBatch: requestTranslationBatchMock,
}))

import { translateTexts } from "./translate"

describe("translateTexts", () => {
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
})
