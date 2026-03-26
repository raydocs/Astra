import { describe, expect, it, vi } from "vitest"

import { AstraError } from "@/types/translation"

const { translateWithRelayMock } = vi.hoisted(() => ({
  translateWithRelayMock: vi.fn(),
}))

vi.mock("./relay", () => ({
  translateWithRelay: translateWithRelayMock,
}))

import { translateWithProvider } from "./router"

describe("provider router", () => {
  it("routes openai providers through the Astra relay adapter", async () => {
    translateWithRelayMock.mockResolvedValue(["你好"])

    const translations = await translateWithProvider(
      {
        id: "openai",
        accessToken: "astra-token",
        apiKey: "",
        model: "gpt-5.4-nano",
        relayBaseURL: "https://astra.example/v1",
      },
      {
        texts: ["hello"],
        targetLang: "zh-CN",
        task: "translate",
      },
    )

    expect(translations).toEqual(["你好"])
    expect(translateWithRelayMock).toHaveBeenCalledWith({
      providerId: "openai",
      accessToken: "astra-token",
      relayBaseURL: "https://astra.example/v1",
      model: "gpt-5.4-nano",
      texts: ["hello"],
      targetLang: "zh-CN",
      task: "translate",
    })
  })

  it("routes gemini providers through the Astra relay adapter", async () => {
    translateWithRelayMock.mockResolvedValue(["你好"])

    await translateWithProvider(
      {
        id: "gemini",
        accessToken: "astra-token",
        apiKey: "",
        relayBaseURL: "https://astra.example/v1",
        model: "gemini-3.1-flash-lite-preview",
      },
      {
        texts: ["hello"],
        targetLang: "zh-CN",
      },
    )

    expect(translateWithRelayMock).toHaveBeenCalledWith({
      providerId: "gemini",
      accessToken: "astra-token",
      relayBaseURL: "https://astra.example/v1",
      model: "gemini-3.1-flash-lite-preview",
      texts: ["hello"],
      targetLang: "zh-CN",
    })
  })

  it("rejects providers without an Astra access token before dispatch", async () => {
    await expect(() =>
      translateWithProvider(
        {
          id: "openai",
          accessToken: "   ",
          apiKey: "",
          model: "gpt-5.4-nano",
        },
        {
          texts: ["hello"],
          targetLang: "zh-CN",
        },
      )
    ).rejects.toMatchObject({
      code: "CONFIG_MISSING",
      message: "No API key or Astra access token configured. Open Astra popup to configure your provider.",
    })

    expect(translateWithRelayMock).not.toHaveBeenCalled()
  })
})
