import { describe, expect, it, vi } from "vitest"

import { AstraError } from "@/types/translation"

const { translateWithOpenAIMock } = vi.hoisted(() => ({
  translateWithOpenAIMock: vi.fn(),
}))

vi.mock("./openai", () => ({
  translateWithOpenAI: translateWithOpenAIMock,
}))

import { translateWithProvider } from "./router"

describe("provider router", () => {
  it("routes openai providers through the openai adapter", async () => {
    translateWithOpenAIMock.mockResolvedValue(["你好"])

    const translations = await translateWithProvider(
      {
        id: "openai",
        apiKey: "sk-test",
        model: "gpt-4o-mini",
        baseURL: "https://api.openai.com/v1",
      },
      {
        texts: ["hello"],
        targetLang: "zh-CN",
        task: "translate",
      },
    )

    expect(translations).toEqual(["你好"])
    expect(translateWithOpenAIMock).toHaveBeenCalledWith({
      apiKey: "sk-test",
      baseURL: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      texts: ["hello"],
      targetLang: "zh-CN",
      task: "translate",
    })
  })

  it("rejects providers without an API key before dispatch", async () => {
    await expect(() =>
      translateWithProvider(
        {
          id: "openai",
          apiKey: "   ",
          model: "gpt-4o-mini",
        },
        {
          texts: ["hello"],
          targetLang: "zh-CN",
        },
      )
    ).rejects.toMatchObject({
      code: "CONFIG_MISSING",
      message: "No API key configured. Open Astra popup to set your OpenAI API key.",
    })

    expect(translateWithOpenAIMock).not.toHaveBeenCalled()
  })

  it("fails fast for unsupported providers", async () => {
    await expect(() =>
      translateWithProvider(
        {
          id: "anthropic",
          apiKey: "sk-test",
          model: "claude",
        } as never,
        {
          texts: ["hello"],
          targetLang: "zh-CN",
        },
      )
    ).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      message: "Unsupported provider: anthropic",
    })
  })
})
