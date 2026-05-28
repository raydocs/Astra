import { beforeEach, describe, expect, it, vi } from "vitest"

const translateTextsMock = vi.hoisted(() => vi.fn())

vi.mock("@/utils/translate/translate", () => ({
  translateTexts: translateTextsMock,
}))

import { extractTextFromImage } from "./image-text"

describe("image text extraction helper", () => {
  beforeEach(() => {
    translateTextsMock.mockReset()
  })

  it("passes service mode through the AI-assisted image text request", async () => {
    translateTextsMock.mockResolvedValue({ ok: true, translations: ["图中文字"] })

    const result = await extractTextFromImage("https://example.com/image.png", "zh-CN", "balanced")

    expect(result).toEqual({ ok: true, text: "图中文字" })
    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      targetLang: "zh-CN",
      serviceMode: "balanced",
      task: "custom",
    }))
  })
})
