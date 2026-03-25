import { beforeEach, describe, expect, it, vi } from "vitest"

import { AstraError } from "@/types/translation"
import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"

const readConfigMock = vi.fn()
const translateWithProviderMock = vi.fn()

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
}))

vi.mock("@/utils/providers/router", () => ({
  translateWithProvider: translateWithProviderMock,
}))

function getMockBrowser(): ReturnType<typeof createMockBrowser> {
  return (globalThis as unknown as { __ASTRA_TEST_BROWSER__: ReturnType<typeof createMockBrowser> })
    .__ASTRA_TEST_BROWSER__
}

describe("background runtime translation routing", () => {
  beforeEach(() => {
    setMockBrowser(createMockBrowser())
    readConfigMock.mockReset()
    translateWithProviderMock.mockReset()
  })

  it("returns a success response for translate batch requests", async () => {
    const browser = getMockBrowser()
    const sendResponse = vi.fn()

    readConfigMock.mockResolvedValue({
      provider: {
        id: "openai",
        apiKey: "sk-test",
        model: "gpt-4o-mini",
      },
    })
    translateWithProviderMock.mockResolvedValue(["你好"])

    const background = (await import("./index")).default
    background.main()

    await browser.__emitRuntimeMessage(
      {
        type: "runtime/translate-batch",
        payload: {
          texts: ["hello"],
          targetLang: "zh-CN",
          context: { pageTitle: "Fixture" },
          task: "translate",
        },
      },
      { id: "sender" },
      sendResponse,
    )

    await Promise.resolve()
    await Promise.resolve()

    expect(translateWithProviderMock).toHaveBeenCalledWith(
      {
        id: "openai",
        apiKey: "sk-test",
        model: "gpt-4o-mini",
      },
      {
        texts: ["hello"],
        targetLang: "zh-CN",
        context: { pageTitle: "Fixture" },
        task: "translate",
      },
    )
    expect(sendResponse).toHaveBeenCalledWith({
      type: "runtime/translate-batch:success",
      payload: { translations: ["你好"] },
    })
  })

  it("maps provider errors to runtime error responses", async () => {
    const browser = getMockBrowser()
    const sendResponse = vi.fn()

    readConfigMock.mockResolvedValue({
      provider: {
        id: "openai",
        apiKey: "",
        model: "gpt-4o-mini",
      },
    })
    translateWithProviderMock.mockRejectedValue(
      new AstraError("CONFIG_MISSING", "No API key configured."),
    )

    const background = (await import("./index")).default
    background.main()

    await browser.__emitRuntimeMessage(
      {
        type: "runtime/translate-batch",
        payload: {
          texts: ["hello"],
          targetLang: "zh-CN",
        },
      },
      { id: "sender" },
      sendResponse,
    )

    await Promise.resolve()
    await Promise.resolve()

    expect(sendResponse).toHaveBeenCalledWith({
      type: "runtime/translate-batch:error",
      error: {
        code: "CONFIG_MISSING",
        message: "No API key configured.",
      },
    })
  })
})
