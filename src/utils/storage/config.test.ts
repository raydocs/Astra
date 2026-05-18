import { beforeEach, describe, expect, it } from "vitest"

import { DEFAULT_ASTRA_CONFIG, DEFAULT_SUBTITLE_QUALITY_CONTROLS } from "@/types/config"
import {
  ASTRA_CONFIG_STORAGE_KEY,
  applySyncSafeConfig,
  readConfig,
  readConfigContinuitySummary,
  readSyncSafeConfig,
  saveConfig,
} from "./config"
import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"

describe("config storage", () => {
  beforeEach(() => {
    setMockBrowser(createMockBrowser())
  })

  it("migrates legacy flat keys into astra.config.v1 with new defaults and clears legacy keys", async () => {
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
      connectionMode: "astra",
      hoverTrigger: "alt",
      contentScope: "page",
      inputTranslation: "enabled",
      inputTranslationMode: "replace",
      languageLevel: "intermediate",
      explainMode: "deep",
      explanationGlossary: [],
      privacyMode: false,
      provider: {
        id: "openai",
        accessToken: "sk-legacy",
        apiKey: "",
        relayBaseURL: "https://example.com/v1",
        model: "gpt-4.1-mini",
      },
      tts: {
        enabled: true,
        engine: "browser",
        rate: 0.9,
        pitch: 1.0,
        highlightSentences: true,
      },
      presentation: {
        mode: "bilingual",
        theme: "default",
        fontSize: 0.92,
        translationColor: "#64748b",
      },
      subtitleQualityControls: {
        ...DEFAULT_SUBTITLE_QUALITY_CONTROLS,
        popupPollIntervalMs: 1500,
        freshnessThresholdMs: 5000,
      },
      sites: {},
      customActions: [],
    })
    expect(browser.__storage[ASTRA_CONFIG_STORAGE_KEY]).toEqual(config)
    expect(browser.__storage.apiKey).toBeUndefined()
    expect(browser.__storage.baseURL).toBeUndefined()
    expect(browser.__storage.model).toBeUndefined()
    expect(browser.__storage.targetLang).toBeUndefined()
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

  it("stores only v1 config and removes legacy keys on save", async () => {
    const browser = setMockBrowser(createMockBrowser()) as ReturnType<typeof createMockBrowser>

    const config = await saveConfig({
      targetLang: "fr",
      hoverTrigger: "disabled",
      provider: {
        accessToken: "astra-live-token",
        relayBaseURL: "https://proxy.example/v1",
        model: "gpt-5.4-nano",
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
      fontSize: 0.92,
      translationColor: "#64748b",
    })
    expect(config.sites).toEqual({
      "example.com": {
        enabled: false,
        alwaysTranslate: true,
      },
    })
    expect(browser.__storage[ASTRA_CONFIG_STORAGE_KEY]).toEqual(config)
    expect(browser.__storage.apiKey).toBeUndefined()
    expect(browser.__storage.baseURL).toBeUndefined()
    expect(browser.__storage.model).toBeUndefined()
    expect(browser.__storage.targetLang).toBeUndefined()
  })

  it("switches provider defaults when saving a new provider id", async () => {
    const config = await saveConfig({
      provider: {
        id: "gemini",
      },
    })

    expect(config.provider).toEqual({
      id: "gemini",
      accessToken: "",
      apiKey: "",
      model: "gemini-3.1-flash-lite-preview",
    })
  })

  it("persists inputTranslation and privacyMode settings", async () => {
    const browser = setMockBrowser(createMockBrowser()) as ReturnType<typeof createMockBrowser>

    const config = await saveConfig({
      inputTranslation: "disabled",
      privacyMode: true,
    })

    expect(config.inputTranslation).toBe("disabled")
    expect(config.privacyMode).toBe(true)
    expect(browser.__storage[ASTRA_CONFIG_STORAGE_KEY]).toEqual(config)
  })

  it("persists local subtitle QC popup controls without adding them to sync-safe snapshots", async () => {
    const config = await saveConfig({
      subtitleQualityControls: {
        popupPollIntervalMs: 2500,
        freshnessThresholdMs: 9000,
        adaptivePresetAutoSwitchEnabled: true,
        adaptivePresetCooldownMs: 45_000,
        adaptivePresetManualOverrideLocked: true,
        adaptivePresetLastAppliedAt: 123_000,
        adaptivePresetName: "live",
      },
    })
    const syncSafeConfig = await readSyncSafeConfig()

    expect(config.subtitleQualityControls).toEqual({
      ...DEFAULT_SUBTITLE_QUALITY_CONTROLS,
      popupPollIntervalMs: 2500,
      freshnessThresholdMs: 9000,
      adaptivePresetAutoSwitchEnabled: true,
      adaptivePresetCooldownMs: 45_000,
      adaptivePresetManualOverrideLocked: true,
      adaptivePresetLastAppliedAt: 123_000,
      adaptivePresetName: "live",
    })
    expect(syncSafeConfig).not.toHaveProperty("subtitleQualityControls")
  })

  it("persists TTS settings and normalizes blank voice names", async () => {
    const config = await saveConfig({
      tts: {
        enabled: false,
        engine: "browser",
        voiceName: "  ",
        rate: 1.2,
      },
    })

    expect(config.tts).toEqual({
      enabled: false,
      engine: "browser",
      rate: 1.2,
      pitch: 1.0,
      highlightSentences: true,
    })
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

  it("persists site-level advanced rules", async () => {
    const config = await saveConfig({
      sites: {
        "example.com": {
          selectors: ["article", ".content"],
          excludeSelectors: [".comments", "aside"],
          paragraphMinLength: 42,
          includePathPatterns: ["/docs/*", "/blog/*"],
          excludePathPatterns: ["/docs/private/*"],
        },
      },
    })

    expect(config.sites).toEqual({
      "example.com": {
        enabled: true,
        alwaysTranslate: false,
        selectors: ["article", ".content"],
        excludeSelectors: [".comments", "aside"],
        paragraphMinLength: 42,
        includePathPatterns: ["/docs/*", "/blog/*"],
        excludePathPatterns: ["/docs/private/*"],
      },
    })
  })

  it("persists contentScope in config", async () => {
    const config = await saveConfig({
      contentScope: "article",
    })
    expect(config.contentScope).toBe("article")
  })

  it("persists site-level contentScope overrides", async () => {
    const config = await saveConfig({
      sites: {
        "example.com": {
          contentScope: "article",
        },
      },
    })
    expect(config.sites["example.com"]?.contentScope).toBe("article")
  })

  it("persists site-level provider and model overrides without secrets", async () => {
    const config = await saveConfig({
      sites: {
        "example.com": {
          provider: {
            id: "gemini",
            model: "gemini-3.1-pro",
          },
        },
      },
    })

    expect(config.sites["example.com"]?.provider).toEqual({
      id: "gemini",
      model: "gemini-3.1-pro",
    })
  })

  it("prunes site contentScope when it matches default", async () => {
    const config = await saveConfig({
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
        },
      },
    })
    expect(config.sites).toEqual({})
  })

  it("returns a sync-safe config snapshot without secrets or device voice metadata", async () => {
    await saveConfig({
      provider: {
        apiKey: "sk-live",
        accessToken: "astra-session",
        relayBaseURL: "https://relay.example/v1",
      },
      tts: {
        voiceName: "Samantha",
      },
    })

    const syncSafeConfig = await readSyncSafeConfig()

    expect(syncSafeConfig.provider).toEqual({
      id: "google_translate",
      model: "nmt",
    })
    expect(syncSafeConfig.tts).not.toHaveProperty("voiceName")
  })

  it("applies sync-safe config updates without overwriting local secrets", async () => {
    await saveConfig({
      provider: {
        apiKey: "sk-live",
        accessToken: "astra-session",
        relayBaseURL: "https://relay.example/v1",
      },
      tts: {
        voiceName: "Samantha",
      },
    })

    const config = await applySyncSafeConfig({
      version: 1,
      targetLang: "ja",
      connectionMode: "astra",
      hoverTrigger: "always",
      contentScope: "article",
      inputTranslation: "enabled",
      inputTranslationMode: "replace",
      languageLevel: "advanced",
      explainMode: "deep",
      explanationGlossary: [],
      privacyMode: true,
      provider: {
        id: "gemini",
        model: "gemini-3.1-flash-lite-preview",
      },
      tts: {
        enabled: true,
        engine: "browser",
        rate: 1.1,
        pitch: 1,
        highlightSentences: true,
      },
      presentation: DEFAULT_ASTRA_CONFIG.presentation,
      sites: {},
      customActions: [],
    })

    expect(config.targetLang).toBe("ja")
    expect(config.provider.apiKey).toBe("sk-live")
    expect(config.provider.accessToken).toBe("astra-session")
    expect(config.provider.relayBaseURL).toBe("https://relay.example/v1")
    expect(config.tts.voiceName).toBe("Samantha")
  })

  it("summarizes config continuity-local fields", async () => {
    await saveConfig({
      provider: {
        apiKey: "sk-live",
        relayBaseURL: "https://relay.example/v1",
      },
      tts: {
        voiceName: "Samantha",
      },
    })

    const summary = await readConfigContinuitySummary()

    expect(summary.localOnlyFields).toEqual([
      "provider.apiKey",
      "provider.relayBaseURL",
      "tts.voiceName",
    ])
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
