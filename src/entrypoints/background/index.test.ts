import { beforeEach, describe, expect, it, vi } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"

const readConfigMock = vi.fn()
const saveConfigMock = vi.fn()
const readAstraSessionMock = vi.fn()
const translateWithProviderDetailedMock = vi.fn()
const executeTabCommandMock = vi.fn()
const getProviderRoutingMetadataFromErrorMock = vi.fn()

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
  saveConfig: saveConfigMock,
}))

vi.mock("@/utils/storage/auth", () => ({
  readAstraSession: readAstraSessionMock,
}))

vi.mock("@/utils/providers/router", () => ({
  translateWithProviderDetailed: translateWithProviderDetailedMock,
  getProviderRoutingMetadataFromError: getProviderRoutingMetadataFromErrorMock,
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
    saveConfigMock.mockReset()
    readAstraSessionMock.mockReset()
    translateWithProviderDetailedMock.mockReset()
    executeTabCommandMock.mockReset()
    getProviderRoutingMetadataFromErrorMock.mockReset()
    readAstraSessionMock.mockResolvedValue(null)
    getProviderRoutingMetadataFromErrorMock.mockReturnValue(null)
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
    translateWithProviderDetailedMock.mockResolvedValue({
      translations: ["你好"],
      metadata: {
        attemptedTransports: ["direct"],
        finalTransport: "direct",
        fallbackUsed: false,
      },
    })

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

    expect(translateWithProviderDetailedMock).toHaveBeenCalledWith(
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
      payload: {
        translations: ["你好"],
        metadata: {
          attemptedTransports: ["direct"],
          finalTransport: "direct",
          fallbackUsed: false,
        },
      },
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
    const background = (await import("./index")).default
    const { AstraError } = await import("@/types/translation")
    translateWithProviderDetailedMock.mockRejectedValue(
      new AstraError("CONFIG_MISSING", "No API key configured."),
    )
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
        code: "CONFIG_MISSING",
        message: "No API key configured.",
      },
    })
  })

  it("maps non-Astra provider failures to UNKNOWN runtime error responses", async () => {
    const browser = getMockBrowser()
    const sendResponse = vi.fn()

    readConfigMock.mockResolvedValue({
      provider: {
        id: "openai",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
    })
    translateWithProviderDetailedMock.mockRejectedValue(new Error("socket hung up"))

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
        message: "socket hung up",
      },
    })
  })

  it("includes provider routing metadata on runtime error responses when available", async () => {
    const browser = getMockBrowser()
    const sendResponse = vi.fn()

    readConfigMock.mockResolvedValue({
      provider: {
        id: "openai",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
    })
    getProviderRoutingMetadataFromErrorMock.mockReturnValue({
      attemptedTransports: ["direct"],
      finalTransport: null,
      fallbackUsed: false,
    })

    const background = (await import("./index")).default
    const { AstraError } = await import("@/types/translation")
    translateWithProviderDetailedMock.mockRejectedValue(
      new AstraError("CONFIG_MISSING", "No API key configured."),
    )
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
        code: "CONFIG_MISSING",
        message: "No API key configured.",
      },
      metadata: {
        attemptedTransports: ["direct"],
        finalTransport: null,
        fallbackUsed: false,
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

  it("persists config updates through runtime save-config requests", async () => {
    const browser = getMockBrowser()
    const sendResponse = vi.fn()

    saveConfigMock.mockResolvedValue({
      version: 1,
      targetLang: "ja",
      connectionMode: "astra",
      hoverTrigger: "alt",
      contentScope: "page",
      inputTranslation: "enabled",
      languageLevel: "intermediate",
      privacyMode: false,
      provider: {
        id: "openai",
        accessToken: "",
        apiKey: "",
        model: "gpt-5.4-nano",
      },
      presentation: {
        mode: "bilingual",
        theme: "default",
        fontSize: 0.92,
        translationColor: "#64748b",
      },
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
          selectors: ["article"],
        },
      },
      customActions: [],
    })

    const background = (await import("./index")).default
    background.main()

    await browser.__emitRuntimeMessage(
      {
        type: "runtime/save-config",
        payload: {
          targetLang: "ja",
          sites: {
            "example.com": {
              selectors: ["article"],
            },
          },
        },
      },
      { id: "sender" },
      sendResponse,
    )

    await Promise.resolve()
    await Promise.resolve()

    expect(saveConfigMock).toHaveBeenCalledWith({
      targetLang: "ja",
      sites: {
        "example.com": {
          selectors: ["article"],
        },
      },
    })
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
      type: "runtime/save-config:success",
      payload: expect.objectContaining({
        config: expect.objectContaining({
          targetLang: "ja",
          sites: expect.objectContaining({
            "example.com": expect.objectContaining({
              selectors: ["article"],
            }),
          }),
        }),
      }),
    }))
  })
})
