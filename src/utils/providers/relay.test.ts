import { afterEach, describe, expect, it, vi } from "vitest"

import { AstraError } from "@/types/translation"

import { translateWithRelay } from "./relay"

describe("Astra relay provider", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("posts translation requests to the configured relay endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      translations: ["你好"],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))

    vi.stubGlobal("fetch", fetchMock)

    const translations = await translateWithRelay({
      providerId: "openai",
      accessToken: "astra-token",
      relayBaseURL: "https://astra.example/v1/",
      model: "gpt-5.4-nano",
      texts: ["hello"],
      targetLang: "zh-CN",
      task: "translate",
    })

    expect(translations).toEqual(["你好"])
    expect(fetchMock).toHaveBeenCalledWith("https://astra.example/v1/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer astra-token",
      },
      body: JSON.stringify({
        provider: "openai",
        model: "gpt-5.4-nano",
        texts: ["hello"],
        targetLang: "zh-CN",
        task: "translate",
      }),
    })
  })

  it("fails fast when the relay base URL is missing", async () => {
    await expect(() => translateWithRelay({
      providerId: "gemini",
      accessToken: "astra-token",
      model: "gemini-3.1-flash-lite-preview",
      texts: ["hello"],
      targetLang: "zh-CN",
    })).rejects.toMatchObject({
      code: "CONFIG_MISSING",
      message: "No Astra relay URL configured. Open Astra popup to set your Astra API base URL.",
    })
  })

  it("rejects invalid relay response shapes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      output: ["你好"],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })))

    await expect(() => translateWithRelay({
      providerId: "gemini",
      accessToken: "astra-token",
      relayBaseURL: "https://astra.example/v1",
      model: "gemini-3.1-flash-lite-preview",
      texts: ["hello"],
      targetLang: "zh-CN",
    })).rejects.toBeInstanceOf(AstraError)
  })

  it("surfaces HTTP 429 rate-limit errors with the relay message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { message: "Rate limit exceeded. Retry after 30s." } }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    )))

    await expect(() => translateWithRelay({
      providerId: "openai",
      accessToken: "astra-token",
      relayBaseURL: "https://astra.example/v1",
      model: "gpt-4o-mini",
      texts: ["hello"],
      targetLang: "zh-CN",
    })).rejects.toMatchObject({
      code: "PROVIDER_REQUEST_FAILED",
      message: "Rate limit exceeded. Retry after 30s.",
    })
  })

  it("surfaces HTTP 500 server errors with JSON body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ message: "Internal Server Error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )))

    await expect(() => translateWithRelay({
      providerId: "openai",
      accessToken: "astra-token",
      relayBaseURL: "https://astra.example/v1",
      model: "gpt-4o-mini",
      texts: ["hello"],
      targetLang: "zh-CN",
    })).rejects.toMatchObject({
      code: "PROVIDER_REQUEST_FAILED",
      message: "Internal Server Error",
    })
  })

  it("wraps network failures as PROVIDER_REQUEST_FAILED", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")))

    await expect(() => translateWithRelay({
      providerId: "openai",
      accessToken: "astra-token",
      relayBaseURL: "https://astra.example/v1",
      model: "gpt-4o-mini",
      texts: ["hello"],
      targetLang: "zh-CN",
    })).rejects.toMatchObject({
      code: "PROVIDER_REQUEST_FAILED",
      message: "Failed to fetch",
    })
  })

  it("rejects when relay returns wrong number of translations", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ translations: ["你好", "世界"] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )))

    await expect(() => translateWithRelay({
      providerId: "openai",
      accessToken: "astra-token",
      relayBaseURL: "https://astra.example/v1",
      model: "gpt-4o-mini",
      texts: ["hello"],
      targetLang: "zh-CN",
    })).rejects.toMatchObject({
      code: "PROVIDER_PARSE_FAILED",
    })
  })

  it("handles empty response body on error status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      "",
      { status: 502 },
    )))

    await expect(() => translateWithRelay({
      providerId: "openai",
      accessToken: "astra-token",
      relayBaseURL: "https://astra.example/v1",
      model: "gpt-4o-mini",
      texts: ["hello"],
      targetLang: "zh-CN",
    })).rejects.toMatchObject({
      code: "PROVIDER_REQUEST_FAILED",
      message: "Astra relay request failed with status 502.",
    })
  })
})
