import { beforeEach, describe, expect, it, vi } from "vitest"

import type { AstraConfig } from "@/types/config"
import { DEFAULT_ASTRA_CONFIG } from "@/types/config"
import { saveConfigInBackground } from "./messages"

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

describe("saveConfigInBackground", () => {
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
})
