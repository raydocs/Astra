import { beforeEach, describe, expect, it } from "vitest"

import { DEFAULT_ASTRA_CONFIG } from "@/types/config"
import { ASTRA_CONFIG_STORAGE_KEY, readConfig, saveConfig } from "./config"
import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"

describe("config storage", () => {
  beforeEach(() => {
    setMockBrowser(createMockBrowser())
  })

  it("migrates legacy flat keys into astra.config.v1", async () => {
    const browser = setMockBrowser(createMockBrowser({
      apiKey: "sk-legacy",
      baseURL: "https://example.com/v1",
      model: "gpt-4.1-mini",
      targetLang: "ja",
    })) as ReturnType<typeof createMockBrowser>

    const config = await readConfig()

    expect(config).toEqual({
      version: 1,
      targetLang: "ja",
      provider: {
        id: "openai",
        apiKey: "sk-legacy",
        baseURL: "https://example.com/v1",
        model: "gpt-4.1-mini",
      },
    })
    expect(browser.__storage[ASTRA_CONFIG_STORAGE_KEY]).toEqual(config)
  })

  it("falls back to defaults when stored config is invalid", async () => {
    const browser = setMockBrowser(createMockBrowser({
      [ASTRA_CONFIG_STORAGE_KEY]: {
        version: 99,
        targetLang: "",
      },
    })) as ReturnType<typeof createMockBrowser>

    const config = await readConfig()

    expect(config).toEqual(DEFAULT_ASTRA_CONFIG)
    expect(browser.__storage[ASTRA_CONFIG_STORAGE_KEY]).toEqual(DEFAULT_ASTRA_CONFIG)
  })

  it("dual-writes v1 config and legacy keys on save", async () => {
    const browser = setMockBrowser(createMockBrowser()) as ReturnType<typeof createMockBrowser>

    const config = await saveConfig({
      targetLang: "fr",
      provider: {
        apiKey: "sk-new",
        baseURL: "https://proxy.example/v1",
        model: "gpt-4o-mini",
      },
    })

    expect(config.targetLang).toBe("fr")
    expect(browser.__storage[ASTRA_CONFIG_STORAGE_KEY]).toEqual(config)
    expect(browser.__storage.apiKey).toBe("sk-new")
    expect(browser.__storage.baseURL).toBe("https://proxy.example/v1")
    expect(browser.__storage.model).toBe("gpt-4o-mini")
    expect(browser.__storage.targetLang).toBe("fr")
  })
})
