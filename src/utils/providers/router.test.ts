import { beforeEach, describe, expect, it, vi } from "vitest"

import { AstraError } from "@/types/translation"

const {
  translateWithRelayMock,
  translateWithOpenAIMock,
  translateWithGeminiMock,
} = vi.hoisted(() => ({
  translateWithRelayMock: vi.fn(),
  translateWithOpenAIMock: vi.fn(),
  translateWithGeminiMock: vi.fn(),
}))

vi.mock("./relay", () => ({
  translateWithRelay: translateWithRelayMock,
}))

vi.mock("./openai", () => ({
  translateWithOpenAI: translateWithOpenAIMock,
}))

vi.mock("./gemini", () => ({
  translateWithGemini: translateWithGeminiMock,
}))

import {
  classifyProviderFailure,
  PROVIDER_FAILURE_POLICY,
  resetProviderRouterDependenciesForTests,
  setProviderRouterDependenciesForTests,
  translateWithProvider,
  translateWithProviderDetailed,
} from "./router"

describe("provider router", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetProviderRouterDependenciesForTests()
  })

  it("routes openai providers through the Astra relay adapter when only relay access is available", async () => {
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
    expect(translateWithOpenAIMock).not.toHaveBeenCalled()
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

  it("routes gemini providers through direct transport when an API key is configured", async () => {
    translateWithGeminiMock.mockResolvedValue(["你好"])

    const translations = await translateWithProvider(
      {
        id: "gemini",
        accessToken: "astra-token",
        apiKey: "gemini-key",
        relayBaseURL: "https://astra.example/v1",
        model: "gemini-3.1-flash-lite-preview",
      },
      {
        texts: ["hello"],
        targetLang: "zh-CN",
      },
    )

    expect(translations).toEqual(["你好"])
    expect(translateWithGeminiMock).toHaveBeenCalledWith({
      apiKey: "gemini-key",
      model: "gemini-3.1-flash-lite-preview",
      texts: ["hello"],
      targetLang: "zh-CN",
    })
    expect(translateWithRelayMock).not.toHaveBeenCalled()
  })

  it("falls back to relay when the direct provider request fails and relay access is available", async () => {
    translateWithOpenAIMock.mockRejectedValueOnce(new AstraError("PROVIDER_REQUEST_FAILED", "direct request failed"))
    translateWithRelayMock.mockResolvedValueOnce(["你好"])

    const translations = await translateWithProvider(
      {
        id: "openai",
        accessToken: "astra-token",
        apiKey: "openai-key",
        model: "gpt-5.4-nano",
        relayBaseURL: "https://astra.example/v1",
      },
      {
        texts: ["hello"],
        targetLang: "zh-CN",
        task: "translate",
        context: { pageTitle: "Fallback test" },
        placeholderFormat: "astra-rich-text-v1",
        languageLevel: "advanced",
      },
    )

    expect(translations).toEqual(["你好"])
    expect(translateWithOpenAIMock).toHaveBeenCalledWith({
      apiKey: "openai-key",
      model: "gpt-5.4-nano",
      texts: ["hello"],
      targetLang: "zh-CN",
      task: "translate",
      context: { pageTitle: "Fallback test" },
      placeholderFormat: "astra-rich-text-v1",
      languageLevel: "advanced",
    })
    expect(translateWithRelayMock).toHaveBeenCalledWith({
      providerId: "openai",
      accessToken: "astra-token",
      relayBaseURL: "https://astra.example/v1",
      model: "gpt-5.4-nano",
      texts: ["hello"],
      targetLang: "zh-CN",
      task: "translate",
      context: { pageTitle: "Fallback test" },
      placeholderFormat: "astra-rich-text-v1",
      languageLevel: "advanced",
    })
  })

  it("returns routing metadata describing the relay fallback chain", async () => {
    translateWithOpenAIMock.mockRejectedValueOnce(new AstraError("PROVIDER_REQUEST_FAILED", "direct request failed"))
    translateWithRelayMock.mockResolvedValueOnce(["你好"])

    const result = await translateWithProviderDetailed(
      {
        id: "openai",
        accessToken: "astra-token",
        apiKey: "openai-key",
        model: "gpt-5.4-nano",
        relayBaseURL: "https://astra.example/v1",
      },
      {
        texts: ["hello"],
        targetLang: "zh-CN",
      },
    )

    expect(result).toEqual({
      translations: ["你好"],
      metadata: {
        attemptedTransports: ["direct", "relay"],
        finalTransport: "relay",
        fallbackUsed: true,
      },
    })
  })

  it("normalizes whitespace-padded relay credentials before fallback dispatch", async () => {
    translateWithOpenAIMock.mockRejectedValueOnce(new AstraError("PROVIDER_REQUEST_FAILED", "direct request failed"))
    translateWithRelayMock.mockResolvedValueOnce(["你好"])

    await translateWithProvider(
      {
        id: "openai",
        accessToken: "  astra-token  ",
        apiKey: "  openai-key  ",
        model: "gpt-5.4-nano",
        relayBaseURL: " https://astra.example/v1/ ",
      },
      {
        texts: ["hello"],
        targetLang: "zh-CN",
      },
    )

    expect(translateWithRelayMock).toHaveBeenCalledWith(expect.objectContaining({
      accessToken: "astra-token",
      relayBaseURL: "https://astra.example/v1/",
    }))
  })

  it("does not fall back when the direct provider fails without relay access", async () => {
    translateWithOpenAIMock.mockRejectedValueOnce(new AstraError("PROVIDER_REQUEST_FAILED", "direct request failed"))

    await expect(() =>
      translateWithProvider(
        {
          id: "openai",
          accessToken: "   ",
          apiKey: "openai-key",
          model: "gpt-5.4-nano",
        },
        {
          texts: ["hello"],
          targetLang: "zh-CN",
        },
      )
    ).rejects.toMatchObject({
      code: "PROVIDER_REQUEST_FAILED",
      message: "direct request failed",
    })

    expect(translateWithRelayMock).not.toHaveBeenCalled()
  })

  it("fails fast for parse failures without touching relay", async () => {
    translateWithOpenAIMock.mockRejectedValueOnce(new AstraError("PROVIDER_PARSE_FAILED", "malformed provider payload"))

    await expect(() =>
      translateWithProviderDetailed(
        {
          id: "openai",
          accessToken: "astra-token",
          apiKey: "openai-key",
          model: "gpt-5.4-nano",
          relayBaseURL: "https://astra.example/v1",
        },
        {
          texts: ["hello"],
          targetLang: "zh-CN",
        },
      )
    ).rejects.toMatchObject({
      code: "PROVIDER_PARSE_FAILED",
      metadata: {
        attemptedTransports: ["direct"],
        finalTransport: null,
        fallbackUsed: false,
      },
    })
    expect(translateWithRelayMock).not.toHaveBeenCalled()
  })

  it("surfaces relay terminal metadata when fallback is attempted but relay also fails", async () => {
    translateWithOpenAIMock.mockRejectedValueOnce(new AstraError("PROVIDER_REQUEST_FAILED", "direct request failed"))
    translateWithRelayMock.mockRejectedValueOnce(new AstraError("PROVIDER_REQUEST_FAILED", "relay request failed"))

    await expect(() =>
      translateWithProviderDetailed(
        {
          id: "openai",
          accessToken: "astra-token",
          apiKey: "openai-key",
          model: "gpt-5.4-nano",
          relayBaseURL: "https://astra.example/v1",
        },
        {
          texts: ["hello"],
          targetLang: "zh-CN",
        },
      )
    ).rejects.toMatchObject({
      code: "PROVIDER_REQUEST_FAILED",
      metadata: {
        attemptedTransports: ["direct", "relay"],
        finalTransport: "relay",
        fallbackUsed: true,
      },
    })
  })

  it.each([
    "CONFIG_MISSING",
    "CONTENT_UNAVAILABLE",
    "PROVIDER_PARSE_FAILED",
    "INVALID_RESPONSE",
    "SITE_DISABLED",
    "QUOTA_EXCEEDED",
    "UNKNOWN",
  ] as const)("fails fast with routing metadata for non-fallback-eligible direct errors: %s", async (errorCode) => {
    translateWithOpenAIMock.mockRejectedValueOnce(new AstraError(errorCode, `${errorCode.toLowerCase()} error`))

    await expect(() =>
      translateWithProviderDetailed(
        {
          id: "openai",
          accessToken: "astra-token",
          apiKey: "openai-key",
          model: "gpt-5.4-nano",
          relayBaseURL: "https://astra.example/v1",
        },
        {
          texts: ["hello"],
          targetLang: "zh-CN",
        },
      )
    ).rejects.toMatchObject({
      code: errorCode,
      metadata: {
        attemptedTransports: ["direct"],
        finalTransport: null,
        fallbackUsed: false,
      },
    })

    expect(translateWithRelayMock).not.toHaveBeenCalled()
  })

  it("wraps non-AstraError direct failures as fail-fast provider request errors", async () => {
    translateWithOpenAIMock.mockRejectedValueOnce(new Error("socket hung up"))

    await expect(() =>
      translateWithProviderDetailed(
        {
          id: "openai",
          accessToken: "astra-token",
          apiKey: "openai-key",
          model: "gpt-5.4-nano",
          relayBaseURL: "https://astra.example/v1",
        },
        {
          texts: ["hello"],
          targetLang: "zh-CN",
        },
      )
    ).rejects.toMatchObject({
      code: "PROVIDER_REQUEST_FAILED",
      message: "socket hung up",
      metadata: {
        attemptedTransports: ["direct"],
        finalTransport: null,
        fallbackUsed: false,
      },
    })
    expect(translateWithRelayMock).not.toHaveBeenCalled()
  })

  it("classifies provider failures with an explicit fallback policy", () => {
    expect(PROVIDER_FAILURE_POLICY).toEqual({
      CONFIG_MISSING: "fail-fast",
      CONTENT_UNAVAILABLE: "fail-fast",
      PROVIDER_REQUEST_FAILED: "fallback-to-relay",
      PROVIDER_PARSE_FAILED: "fail-fast",
      INVALID_RESPONSE: "fail-fast",
      SITE_DISABLED: "fail-fast",
      QUOTA_EXCEEDED: "fail-fast",
      UNKNOWN: "fail-fast",
    })

    for (const [errorCode, expectedPolicy] of Object.entries(PROVIDER_FAILURE_POLICY)) {
      expect(classifyProviderFailure(new AstraError(errorCode as keyof typeof PROVIDER_FAILURE_POLICY, errorCode))).toBe(expectedPolicy)
    }

    expect(classifyProviderFailure(new Error("network blew up"))).toBe("fail-fast")
  })

  it("allows overriding router dependencies for background-routed test seams", async () => {
    const directStub = vi.fn().mockRejectedValue(new AstraError("PROVIDER_REQUEST_FAILED", "stubbed direct failure"))
    const relayStub = vi.fn().mockResolvedValue(["你好"])

    setProviderRouterDependenciesForTests({
      translateWithOpenAI: directStub,
      translateWithRelay: relayStub,
    })

    const result = await translateWithProviderDetailed(
      {
        id: "openai",
        accessToken: "astra-token",
        apiKey: "openai-key",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
      {
        texts: ["hello"],
        targetLang: "zh-CN",
      },
    )

    expect(directStub).toHaveBeenCalledTimes(1)
    expect(relayStub).toHaveBeenCalledTimes(1)
    expect(result.metadata).toEqual({
      attemptedTransports: ["direct", "relay"],
      finalTransport: "relay",
      fallbackUsed: true,
    })
  })

  it("rejects providers without direct or relay access before dispatch", async () => {
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

    expect(translateWithOpenAIMock).not.toHaveBeenCalled()
    expect(translateWithRelayMock).not.toHaveBeenCalled()
  })
})
