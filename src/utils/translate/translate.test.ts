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
