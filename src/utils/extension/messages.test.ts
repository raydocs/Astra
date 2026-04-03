import { beforeEach, describe, expect, it, vi } from "vitest"

import type { AstraConfig } from "@/types/config"
import { DEFAULT_ASTRA_CONFIG } from "@/types/config"
import { getActiveTabStudyContext, saveConfigInBackground } from "./messages"

function getMockBrowser() {
  return (globalThis as { __ASTRA_TEST_BROWSER__?: any }).__ASTRA_TEST_BROWSER__
}

function createConfig(patch: Partial<AstraConfig> = {}): AstraConfig {
  return {
    ...DEFAULT_ASTRA_CONFIG,
    ...patch,
    provider: {
      ...DEFAULT_ASTRA_CONFIG.provider,
      ...patch.provider,
    },
    presentation: {
      ...DEFAULT_ASTRA_CONFIG.presentation,
      ...patch.presentation,
    },
    sites: {
      ...DEFAULT_ASTRA_CONFIG.sites,
      ...patch.sites,
    },
  }
}

describe("extension message helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns the background config on success", async () => {
    const browser = getMockBrowser()
    const config = createConfig({ targetLang: "ja" })
    browser.runtime.sendMessage.mockResolvedValue({
      type: "runtime/save-config:success",
      payload: { config },
    })

    const result = await saveConfigInBackground({ targetLang: "ja" })

    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      type: "runtime/save-config",
      payload: { targetLang: "ja" },
    })
    expect(result).toEqual({ ok: true, config })
  })

  it("maps transport failures to UNKNOWN instead of provider errors", async () => {
    const browser = getMockBrowser()
    browser.runtime.sendMessage.mockRejectedValue(new Error("popup channel closed"))

    const result = await saveConfigInBackground({ targetLang: "ja" })

    expect(result).toEqual({
      ok: false,
      error: {
        code: "UNKNOWN",
        message: "popup channel closed",
      },
    })
  })

  it("returns INVALID_RESPONSE when the background payload shape is wrong", async () => {
    const browser = getMockBrowser()
    browser.runtime.sendMessage.mockResolvedValue({ type: "runtime/save-config:success", payload: {} })

    const result = await saveConfigInBackground({ targetLang: "ja" })

    expect(result).toEqual({
      ok: false,
      error: {
        code: "INVALID_RESPONSE",
        message: "Received an invalid config save response.",
      },
    })
  })

  it("requests study context from the top frame of the active tab", async () => {
    const browser = getMockBrowser()
    browser.tabs.query.mockResolvedValue([{ id: 7, url: "https://example.com/article" }])
    browser.tabs.sendMessage.mockResolvedValue({
      ok: true,
      context: {
        pageTitle: "Example article",
        pageUrl: "https://example.com/article",
        hostname: "example.com",
        contentSummary: "Summary",
      },
    })

    const result = await getActiveTabStudyContext()

    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(
      7,
      { type: "content/get-study-context" },
      { frameId: 0 },
    )
    expect(result).toEqual({
      ok: true,
      context: {
        pageTitle: "Example article",
        pageUrl: "https://example.com/article",
        hostname: "example.com",
        contentSummary: "Summary",
      },
    })
  })

  it("maps invalid study context payloads to UNKNOWN", async () => {
    const browser = getMockBrowser()
    browser.tabs.query.mockResolvedValue([{ id: 7, url: "https://example.com/article" }])
    browser.tabs.sendMessage.mockResolvedValue({ ok: true, foo: "bar" })

    const result = await getActiveTabStudyContext()

    expect(result).toEqual({
      ok: false,
      error: {
        code: "UNKNOWN",
        message: "Received an unexpected study context response.",
      },
    })
  })
})
