import { beforeEach, describe, expect, it, vi } from "vitest"

import { AstraError } from "@/types/translation"
import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"

const readConfigMock = vi.fn()
const readAstraSessionMock = vi.fn()
const translateWithProviderMock = vi.fn()
const executeTabCommandMock = vi.fn()

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
}))

vi.mock("@/utils/storage/auth", () => ({
  readAstraSession: readAstraSessionMock,
}))

vi.mock("@/utils/providers/router", () => ({
  translateWithProvider: translateWithProviderMock,
}))

vi.mock("./frame-coordinator", () => ({
  executeTabCommand: executeTabCommandMock,
}))

function getMockBrowser(): ReturnType<typeof createMockBrowser> {
  return (globalThis as unknown as { __ASTRA_TEST_BROWSER__: ReturnType<typeof createMockBrowser> })
    .__ASTRA_TEST_BROWSER__
}

describe("background runtime translation routing", () => {
  beforeEach(() => {
    setMockBrowser(createMockBrowser())
    vi.resetModules()
    readConfigMock.mockReset()
    readAstraSessionMock.mockReset()
    translateWithProviderMock.mockReset()
    executeTabCommandMock.mockReset()
    readAstraSessionMock.mockResolvedValue(null)
  })

  it("returns a success response for translate batch requests", async () => {
    const browser = getMockBrowser()
    const sendResponse = vi.fn()

    readConfigMock.mockResolvedValue({
      provider: {
        id: "openai",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
    })
    readAstraSessionMock.mockResolvedValue({
      version: 1,
      sessionToken: "astra-session",
      relayBaseURL: "https://astra.example/v1",
      email: "user@example.com",
      plan: "pro",
      providerEntitlements: ["openai", "gemini"],
      expiresAt: null,
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
        accessToken: "astra-session",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
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
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
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
    await Promise.resolve()

    expect(sendResponse).toHaveBeenCalledWith({
      type: "runtime/translate-batch:error",
      error: {
        code: "UNKNOWN",
        message: "No API key configured.",
      },
    })
  })

  it("routes current-tab commands through the sender tab id", async () => {
    const browser = getMockBrowser()
    const sendResponse = vi.fn()
    executeTabCommandMock.mockResolvedValue({
      ok: true,
      state: {
        phase: "idle",
        sessionId: 1,
        targetLang: "zh-CN",
        lastError: null,
        progress: {
          totalBlocks: 0,
          queuedBlocks: 0,
          inFlightBlocks: 0,
          translatedBlocks: 0,
          failedBlocks: 0,
        },
        presentation: { mode: "bilingual", theme: "default" },
        site: { hostname: "example.com", enabled: true, alwaysTranslate: false },
      },
    })

    const background = (await import("./index")).default
    background.main()

    await browser.__emitRuntimeMessage(
      {
        type: "runtime/current-tab-command",
        command: { type: "content/toggle-translation" },
      },
      { tab: { id: 42 } },
      sendResponse,
    )

    await Promise.resolve()
    await Promise.resolve()

    expect(executeTabCommandMock).toHaveBeenCalledWith(42, { type: "content/toggle-translation" })
    expect(sendResponse).toHaveBeenCalled()
  })
})
