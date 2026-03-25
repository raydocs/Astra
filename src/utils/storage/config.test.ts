import { beforeEach, describe, expect, it } from "vitest"

import { DEFAULT_ASTRA_CONFIG } from "@/types/config"
import { ASTRA_CONFIG_STORAGE_KEY, readConfig, saveConfig } from "./config"
import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"

describe("config storage", () => {
  beforeEach(() => {
    setMockBrowser(createMockBrowser())
  })

  it("migrates legacy flat keys into astra.config.v1 with new defaults", async () => {
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
      hoverTrigger: "alt",
      provider: {
        id: "openai",
        apiKey: "sk-legacy",
        baseURL: "https://example.com/v1",
        model: "gpt-4.1-mini",
      },
      presentation: {
        mode: "bilingual",
        theme: "default",
      },
      sites: {},
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
      hoverTrigger: "disabled",
      provider: {
        apiKey: "sk-new",
        baseURL: "https://proxy.example/v1",
        model: "gpt-4o-mini",
      },
      presentation: {
        mode: "translation-only",
        theme: "highlight",
      },
      sites: {
        "Example.COM": {
          enabled: false,
          alwaysTranslate: true,
        },
      },
    })

    expect(config.targetLang).toBe("fr")
    expect(config.hoverTrigger).toBe("disabled")
    expect(config.presentation).toEqual({
      mode: "translation-only",
      theme: "highlight",
    })
    expect(config.sites).toEqual({
      "example.com": {
        enabled: false,
        alwaysTranslate: true,
      },
    })
    expect(browser.__storage[ASTRA_CONFIG_STORAGE_KEY]).toEqual(config)
    expect(browser.__storage.apiKey).toBe("sk-new")
    expect(browser.__storage.baseURL).toBe("https://proxy.example/v1")
    expect(browser.__storage.model).toBe("gpt-4o-mini")
    expect(browser.__storage.targetLang).toBe("fr")
  })

  it("prunes default site rules when saving", async () => {
    const config = await saveConfig({
      sites: {
        "docs.example.com": {
          enabled: true,
          alwaysTranslate: false,
        },
      },
    })

    expect(config.sites).toEqual({})
  })

  it("replaces one site snapshot without mutating other sites", async () => {
    await saveConfig({
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
          targetLang: "ja",
          hoverTrigger: "disabled",
          presentation: {
            mode: "translation-only",
            theme: "highlight",
          },
        },
        "docs.example.com": {
          enabled: false,
          alwaysTranslate: true,
        },
      },
    })

    const config = await saveConfig({
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
          presentation: {
            mode: "bilingual",
          },
        },
      },
    })

    expect(config.sites).toEqual({
      "example.com": {
        enabled: true,
        alwaysTranslate: false,
        presentation: {
          mode: "bilingual",
        },
      },
      "docs.example.com": {
        enabled: false,
        alwaysTranslate: true,
      },
    })
  })

  it("persists site-level hoverTrigger overrides", async () => {
    const config = await saveConfig({
      sites: {
        "example.com": {
          hoverTrigger: "disabled",
        },
      },
    })

    expect(config.sites).toEqual({
      "example.com": {
        enabled: true,
        alwaysTranslate: false,
        hoverTrigger: "disabled",
      },
    })
  })

  it("clears site overrides back to inheritance when saving an empty site snapshot", async () => {
    await saveConfig({
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
          targetLang: "ja",
          hoverTrigger: "disabled",
          presentation: {
            mode: "translation-only",
            theme: "highlight",
          },
        },
      },
    })

    const config = await saveConfig({
      sites: {
        "example.com": {},
      },
    })

    expect(config.sites).toEqual({})
  })
})
