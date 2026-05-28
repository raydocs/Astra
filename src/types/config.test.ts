import { describe, expect, it } from "vitest"

import {
  DEFAULT_ASTRA_CONFIG,
  DEFAULT_SUBTITLE_QUALITY_CONTROLS,
  applyConfigSyncMutations,
  buildConfigSyncRecordMap,
  hasResolvedProviderAccess,
  hasResolvedSiteProviderAccess,
  normalizeConfig,
  parseExplanationGlossaryText,
  resolveManagedProviderConfig,
  resolveSiteProviderConfig,
  resolveSiteTranslationSettings,
  resolveTranslationSurfaceMode,
  serializeExplanationGlossary,
  summarizeConfigContinuity,
  type AstraConfig,
} from "./config"
import type { AstraSession } from "./auth"

describe("config sync records", () => {
  it("builds phase-1 config records for global settings, site rules, and custom actions", () => {
    const records = buildConfigSyncRecordMap({
      ...DEFAULT_ASTRA_CONFIG,
      targetLang: "ja",
      sites: {
        "Example.com": {
          enabled: true,
          alwaysTranslate: false,
          selectors: ["article"],
        },
      },
      customActions: [{
        id: "glossary",
        label: "Glossary",
        labelZh: "术语",
        systemPrompt: "Use glossary terms.",
        enabled: true,
      }],
    }, { includeManagedRelayBaseURL: true })

    expect(records.global).toMatchObject({
      kind: "global",
      config: expect.objectContaining({ targetLang: "ja" }),
    })
    expect(records["site:example.com"]).toMatchObject({
      kind: "site",
      hostname: "example.com",
      site: expect.objectContaining({ selectors: ["article"] }),
    })
    expect(records["custom_action:glossary"]).toMatchObject({
      kind: "custom_action",
      action: expect.objectContaining({ id: "glossary" }),
    })
  })

  it("does not mark managed Astra relay URLs as local-only continuity fields", () => {
    const summary = summarizeConfigContinuity({
      ...DEFAULT_ASTRA_CONFIG,
      connectionMode: "astra",
      provider: {
        ...DEFAULT_ASTRA_CONFIG.provider,
        relayBaseURL: "https://astra.example/v1",
      },
    })

    expect(summary.localOnlyFields).not.toContain("provider.relayBaseURL")
    expect(summary.hasCustomRelayBaseURL).toBe(false)
  })

  it("keeps custom relay URLs local-only outside managed Astra mode", () => {
    const summary = summarizeConfigContinuity({
      ...DEFAULT_ASTRA_CONFIG,
      connectionMode: "custom",
      provider: {
        ...DEFAULT_ASTRA_CONFIG.provider,
        relayBaseURL: "https://self-hosted.example/v1",
      },
    })

    expect(summary.localOnlyFields).toContain("provider.relayBaseURL")
    expect(summary.hasCustomRelayBaseURL).toBe(true)
  })

  it("keeps subtitle QC popup controls local-only during config sync", () => {
    const localConfig: AstraConfig = {
      ...DEFAULT_ASTRA_CONFIG,
      subtitleQualityControls: {
        ...DEFAULT_SUBTITLE_QUALITY_CONTROLS,
        popupPollIntervalMs: 2500,
        freshnessThresholdMs: 8000,
        adaptivePresetAutoSwitchEnabled: true,
        adaptivePresetCooldownMs: 45_000,
        adaptivePresetManualOverrideLocked: true,
        adaptivePresetLastAppliedAt: 123_000,
        adaptivePresetName: "live",
      },
    }
    const records = buildConfigSyncRecordMap(localConfig)
    const localGlobal = records.global
    expect(localGlobal).toMatchObject({ kind: "global" })
    if (localGlobal.kind !== "global") throw new Error("Expected global sync record")
    expect(localGlobal.config).not.toHaveProperty("subtitleQualityControls")

    const remoteGlobal = buildConfigSyncRecordMap({
      ...DEFAULT_ASTRA_CONFIG,
      targetLang: "ja",
    }).global
    if (remoteGlobal.kind !== "global") throw new Error("Expected global sync record")
    const nextConfig = applyConfigSyncMutations(localConfig, [{
      recordId: "global",
      operation: "upsert",
      payload: remoteGlobal,
    }])

    expect(nextConfig.targetLang).toBe("ja")
    expect(nextConfig.subtitleQualityControls).toEqual({
      ...DEFAULT_SUBTITLE_QUALITY_CONTROLS,
      popupPollIntervalMs: 2500,
      freshnessThresholdMs: 8000,
      adaptivePresetAutoSwitchEnabled: true,
      adaptivePresetCooldownMs: 45_000,
      adaptivePresetManualOverrideLocked: true,
      adaptivePresetLastAppliedAt: 123_000,
      adaptivePresetName: "live",
    })
  })

  it("applies config sync mutations without overwriting local secrets", () => {
    const nextConfig = applyConfigSyncMutations({
      ...DEFAULT_ASTRA_CONFIG,
      provider: {
        ...DEFAULT_ASTRA_CONFIG.provider,
        apiKey: "sk-local",
      },
      tts: {
        ...DEFAULT_ASTRA_CONFIG.tts,
        voiceName: "Samantha",
      },
      customActions: [{
        id: "old",
        label: "Old",
        labelZh: "旧",
        systemPrompt: "Old prompt",
        enabled: true,
      }],
    }, [
      {
        recordId: "global",
        operation: "upsert",
        payload: {
          kind: "global",
          config: {
            version: 1,
            targetLang: "fr",
            connectionMode: "astra",
            hoverTrigger: "always",
            contentScope: "article",
            inputTranslation: "enabled",
            inputTranslationMode: "replace",
            languageLevel: "advanced",
            privacyMode: true,
            provider: {
              id: "gemini",
              model: "gemini-3.1-flash-lite-preview",
            },
            tts: {
              enabled: true,
              engine: "browser",
              rate: 1,
              pitch: 1,
              highlightSentences: true,
            },
            presentation: {
              mode: "translation-only",
              theme: "highlight",
              fontSize: 1,
              translationColor: "#111827",
            },
          },
        },
      },
      {
        recordId: "site:example.com",
        operation: "upsert",
        payload: {
          kind: "site",
          hostname: "example.com",
          site: {
            enabled: true,
            alwaysTranslate: false,
            selectors: ["article"],
          },
        },
      },
      {
        recordId: "custom_action:old",
        operation: "delete",
        payload: null,
      },
    ])

    expect(nextConfig.targetLang).toBe("fr")
    expect(nextConfig.provider.apiKey).toBe("sk-local")
    expect(nextConfig.tts.voiceName).toBe("Samantha")
    expect(nextConfig.sites["example.com"]?.selectors).toEqual(["article"])
    expect(nextConfig.customActions).toEqual([])
  })
})

describe("explanation glossary config", () => {
  it("normalizes explanation glossary entries, drops incomplete rows, and dedupes source terms", () => {
    const normalized = normalizeConfig({
      ...DEFAULT_ASTRA_CONFIG,
      explanationGlossary: [
        { sourceTerm: " Astra ", preferredTerm: " 阿斯特拉 ", enabled: true },
        { sourceTerm: "astra", preferredTerm: "重复", enabled: true },
        { sourceTerm: "router", preferredTerm: "路由器", enabled: false },
        { sourceTerm: "empty", preferredTerm: "  ", enabled: true },
      ],
    })

    expect(normalized.explanationGlossary).toEqual([
      { sourceTerm: "Astra", preferredTerm: "阿斯特拉", enabled: true },
      { sourceTerm: "router", preferredTerm: "路由器", enabled: false },
    ])
  })

  it("parses and serializes the popup explanation glossary text format", () => {
    const parsed = parseExplanationGlossaryText("Astra => 阿斯特拉\nrouter = 路由器\ninvalid")

    expect(parsed).toEqual([
      { sourceTerm: "Astra", preferredTerm: "阿斯特拉", enabled: true },
      { sourceTerm: "router", preferredTerm: "路由器", enabled: true },
    ])
    expect(serializeExplanationGlossary(parsed)).toBe("Astra => 阿斯特拉\nrouter => 路由器")
  })
})

describe("resolveSiteTranslationSettings", () => {
  const session: AstraSession = {
    version: 1 as const,
    sessionToken: "astra-session",
    sessionId: null,
    deviceId: "device-123",
    identityMode: "authenticated",
    relayBaseURL: "https://astra.example/v1",
    email: "user@example.com",
    plan: "pro" as const,
    subscriptionStatus: "active" as const,
    providerEntitlements: ["openai", "gemini"],
    quota: {
      dailyRequestsLimit: 2000,
      dailyCharactersLimit: 500000,
      requestsPerMinuteLimit: 120,
      remainingDailyRequests: 1999,
      remainingDailyCharacters: 499995,
    },
    usage: {
      totalRequests: 1,
      totalCharacters: 5,
      dailyRequestsUsed: 1,
      dailyCharactersUsed: 5,
      lastRequestAt: "2026-03-26T00:00:00.000Z",
      recentEvents: [],
    },
    issuedAt: null,
    expiresAt: null,
  }

  it("defaults hover trigger to alt", () => {
    const resolved = resolveSiteTranslationSettings(DEFAULT_ASTRA_CONFIG, "example.com")

    expect(resolved.hoverTrigger).toBe("alt")
  })

  it("inherits global hover trigger when site override is missing", () => {
    const config: AstraConfig = {
      ...DEFAULT_ASTRA_CONFIG,
      hoverTrigger: "disabled",
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
        },
      },
    }

    const resolved = resolveSiteTranslationSettings(config, "example.com")

    expect(resolved.hoverTrigger).toBe("disabled")
  })

  it("prefers site hover trigger over global default", () => {
    const config: AstraConfig = {
      ...DEFAULT_ASTRA_CONFIG,
      hoverTrigger: "disabled",
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
          hoverTrigger: "alt",
        },
      },
    }

    const resolved = resolveSiteTranslationSettings(config, "example.com")

    expect(resolved.hoverTrigger).toBe("alt")
  })

  it("resolves 'always' hover trigger from global config", () => {
    const config: AstraConfig = {
      ...DEFAULT_ASTRA_CONFIG,
      hoverTrigger: "always",
    }

    const resolved = resolveSiteTranslationSettings(config, "example.com")

    expect(resolved.hoverTrigger).toBe("always")
  })

  it("resolves 'always' hover trigger from site-level override", () => {
    const config: AstraConfig = {
      ...DEFAULT_ASTRA_CONFIG,
      hoverTrigger: "alt",
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
          hoverTrigger: "always",
        },
      },
    }

    const resolved = resolveSiteTranslationSettings(config, "example.com")

    expect(resolved.hoverTrigger).toBe("always")
  })

  it("defaults contentScope to page", () => {
    const resolved = resolveSiteTranslationSettings(DEFAULT_ASTRA_CONFIG, "example.com")
    expect(resolved.contentScope).toBe("page")
    expect(resolveTranslationSurfaceMode(resolved.contentScope)).toBe("immersive")
  })

  it("accepts explicit immersive and full_page content scopes", () => {
    expect(resolveTranslationSurfaceMode("page")).toBe("immersive")
    expect(resolveTranslationSurfaceMode("immersive")).toBe("immersive")
    expect(resolveTranslationSurfaceMode("full_page")).toBe("full_page")
    expect(resolveTranslationSurfaceMode("article")).toBe("article")

    expect(resolveSiteTranslationSettings({
      ...DEFAULT_ASTRA_CONFIG,
      contentScope: "full_page",
    }, "example.com").contentScope).toBe("full_page")
  })

  it("inherits global contentScope when site override is missing", () => {
    const config: AstraConfig = {
      ...DEFAULT_ASTRA_CONFIG,
      contentScope: "article",
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
        },
      },
    }
    const resolved = resolveSiteTranslationSettings(config, "example.com")
    expect(resolved.contentScope).toBe("article")
  })

  it("prefers site contentScope over global default", () => {
    const config: AstraConfig = {
      ...DEFAULT_ASTRA_CONFIG,
      contentScope: "page",
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
          contentScope: "article",
        },
      },
    }
    const resolved = resolveSiteTranslationSettings(config, "example.com")
    expect(resolved.contentScope).toBe("article")
  })

  it("prefers override contentScope over site and global", () => {
    const config: AstraConfig = {
      ...DEFAULT_ASTRA_CONFIG,
      contentScope: "page",
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
          contentScope: "page",
        },
      },
    }
    const resolved = resolveSiteTranslationSettings(config, "example.com", { contentScope: "article" })
    expect(resolved.contentScope).toBe("article")
  })

  it("accepts and resolves mask as a translation theme", () => {
    const normalized = normalizeConfig({
      ...DEFAULT_ASTRA_CONFIG,
      presentation: {
        ...DEFAULT_ASTRA_CONFIG.presentation,
        theme: "mask",
      },
    })

    expect(normalized.presentation.theme).toBe("mask")
    expect(resolveSiteTranslationSettings(normalized, "example.com").presentation.theme).toBe("mask")

    const siteConfig: AstraConfig = {
      ...DEFAULT_ASTRA_CONFIG,
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
          presentation: {
            theme: "mask",
          },
        },
      },
    }

    expect(resolveSiteTranslationSettings(siteConfig, "example.com").presentation.theme).toBe("mask")

    const overrideConfig: AstraConfig = {
      ...DEFAULT_ASTRA_CONFIG,
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
          presentation: {
            theme: "highlight",
          },
        },
      },
    }

    expect(resolveSiteTranslationSettings(overrideConfig, "example.com", { translationTheme: "mask" }).presentation.theme).toBe("mask")
  })

  it("falls back from www hostnames to apex site rules for site translation settings", () => {
    const config: AstraConfig = {
      ...DEFAULT_ASTRA_CONFIG,
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
          selectors: ["article"],
          excludeSelectors: [".ad", "nav"],
          paragraphMinLength: 80,
          presentation: {
            mode: "translation-only",
            theme: "highlight",
            fontSize: 1.1,
            translationColor: "#111827",
          },
        },
      },
    }

    const resolved = resolveSiteTranslationSettings(config, "https://www.example.com/read")

    expect(resolved.hostname).toBe("www.example.com")
    expect(resolved.selectors).toEqual(["article"])
    expect(resolved.excludeSelectors).toEqual([".ad", "nav"])
    expect(resolved.paragraphMinLength).toBe(80)
    expect(resolved.presentation).toMatchObject({
      mode: "translation-only",
      theme: "highlight",
      fontSize: 1.1,
      translationColor: "#111827",
    })
  })

  it("prefers exact www hostname site rules over apex fallback rules", () => {
    const config: AstraConfig = {
      ...DEFAULT_ASTRA_CONFIG,
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
          selectors: ["article"],
          excludeSelectors: [".ad"],
          paragraphMinLength: 80,
          presentation: {
            mode: "translation-only",
            theme: "highlight",
            fontSize: 1.1,
            translationColor: "#111827",
          },
        },
        "www.example.com": {
          enabled: true,
          alwaysTranslate: false,
          selectors: ["main"],
          excludeSelectors: [".sponsored"],
          paragraphMinLength: 120,
          presentation: {
            mode: "bilingual",
            theme: "underline",
            fontSize: 1.2,
            translationColor: "#2563eb",
          },
        },
      },
    }

    const resolved = resolveSiteTranslationSettings(config, "www.example.com")

    expect(resolved.selectors).toEqual(["main"])
    expect(resolved.excludeSelectors).toEqual([".sponsored"])
    expect(resolved.paragraphMinLength).toBe(120)
    expect(resolved.presentation).toMatchObject({
      mode: "bilingual",
      theme: "underline",
      fontSize: 1.2,
      translationColor: "#2563eb",
    })
  })

  it("keeps hostname-only site rules enabled without path patterns", () => {
    const config: AstraConfig = {
      ...DEFAULT_ASTRA_CONFIG,
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
          targetLang: "ja",
        },
      },
    }

    const resolved = resolveSiteTranslationSettings(config, "https://example.com/blog/intro?utm=1#top")

    expect(resolved.enabled).toBe(true)
    expect(resolved.targetLang).toBe("ja")
  })

  it("uses include path patterns to allow only matching paths", () => {
    const config: AstraConfig = {
      ...DEFAULT_ASTRA_CONFIG,
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
          includePathPatterns: ["/docs/*"],
        },
      },
    }

    expect(resolveSiteTranslationSettings(config, "https://example.com/docs/intro").enabled).toBe(true)
    expect(resolveSiteTranslationSettings(config, "https://example.com/blog/intro").enabled).toBe(false)
  })

  it("uses exclude path patterns to block matching paths", () => {
    const config: AstraConfig = {
      ...DEFAULT_ASTRA_CONFIG,
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
          excludePathPatterns: ["/admin/*"],
        },
      },
    }

    expect(resolveSiteTranslationSettings(config, "https://example.com/home").enabled).toBe(true)
    expect(resolveSiteTranslationSettings(config, "https://example.com/admin/users").enabled).toBe(false)
  })

  it("lets exclude path patterns win over include path patterns", () => {
    const config: AstraConfig = {
      ...DEFAULT_ASTRA_CONFIG,
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
          includePathPatterns: ["/docs/*"],
          excludePathPatterns: ["/docs/private/*"],
        },
      },
    }

    expect(resolveSiteTranslationSettings(config, "https://example.com/docs/intro").enabled).toBe(true)
    expect(resolveSiteTranslationSettings(config, "https://example.com/docs/private/a").enabled).toBe(false)
  })

  it("preserves www fallback determinism with path gating", () => {
    const config: AstraConfig = {
      ...DEFAULT_ASTRA_CONFIG,
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
          includePathPatterns: ["/docs/*"],
        },
      },
    }

    const included = resolveSiteTranslationSettings(config, "https://www.example.com/docs/intro")
    const excluded = resolveSiteTranslationSettings(config, "https://www.example.com/blog/intro")

    expect(included.hostname).toBe("www.example.com")
    expect(included.enabled).toBe(true)
    expect(excluded.hostname).toBe("www.example.com")
    expect(excluded.enabled).toBe(false)
  })

  it("injects the Astra session token into the resolved provider config", () => {
    const provider = resolveManagedProviderConfig(DEFAULT_ASTRA_CONFIG.provider, session)

    expect(provider.accessToken).toBe("astra-session")
    expect(provider.relayBaseURL).toBe("https://astra.example/v1")
    expect(hasResolvedProviderAccess(DEFAULT_ASTRA_CONFIG.provider, session)).toBe(true)
  })

  it("keeps provider routing unchanged when a site has no provider override", () => {
    const config: AstraConfig = {
      ...DEFAULT_ASTRA_CONFIG,
      provider: {
        ...DEFAULT_ASTRA_CONFIG.provider,
        apiKey: "sk-openai",
        model: "gpt-5.4-mini",
      },
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
          targetLang: "ja",
        },
      },
    }

    expect(resolveSiteProviderConfig(config, "https://example.com/article", null)).toEqual(config.provider)
  })

  it("applies site provider/model overrides while inheriting managed relay credentials", () => {
    const config: AstraConfig = {
      ...DEFAULT_ASTRA_CONFIG,
      provider: {
        ...DEFAULT_ASTRA_CONFIG.provider,
        apiKey: "sk-openai",
        model: "gpt-5.4-mini",
      },
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
          provider: {
            id: "gemini",
            model: "gemini-3.1-pro",
          },
        },
      },
    }

    const provider = resolveSiteProviderConfig(config, "example.com", session)

    expect(provider).toEqual({
      id: "gemini",
      apiKey: "",
      accessToken: "astra-session",
      relayBaseURL: "https://astra.example/v1",
      model: "gemini-3.1-pro",
    })
    expect(hasResolvedSiteProviderAccess(config, "example.com", session)).toBe(true)
  })

  it("falls back from www hostnames to apex provider overrides", () => {
    const config: AstraConfig = {
      ...DEFAULT_ASTRA_CONFIG,
      provider: {
        ...DEFAULT_ASTRA_CONFIG.provider,
        apiKey: "sk-openai",
        model: "gpt-5.4-mini",
      },
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
          provider: {
            id: "gemini",
            model: "gemini-3.1-pro",
          },
        },
      },
    }

    const provider = resolveSiteProviderConfig(config, "https://www.example.com/read", session)

    expect(provider).toEqual({
      id: "gemini",
      apiKey: "",
      accessToken: "astra-session",
      relayBaseURL: "https://astra.example/v1",
      model: "gemini-3.1-pro",
    })
  })

  it("prefers exact www provider overrides over apex provider overrides", () => {
    const config: AstraConfig = {
      ...DEFAULT_ASTRA_CONFIG,
      provider: {
        ...DEFAULT_ASTRA_CONFIG.provider,
        id: "openai",
        apiKey: "sk-openai",
        model: "gpt-5.4-mini",
      },
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
          provider: {
            id: "gemini",
            model: "gemini-3.1-pro",
          },
        },
        "www.example.com": {
          enabled: true,
          alwaysTranslate: false,
          provider: {
            id: "openai",
            model: "gpt-5.4-www",
          },
        },
      },
    }

    const provider = resolveSiteProviderConfig(config, "www.example.com", null)

    expect(provider).toEqual({
      id: "openai",
      apiKey: "sk-openai",
      accessToken: "",
      model: "gpt-5.4-www",
    })
  })

  it("does not send a global direct key to a different site provider without relay access", () => {
    const config: AstraConfig = {
      ...DEFAULT_ASTRA_CONFIG,
      provider: {
        ...DEFAULT_ASTRA_CONFIG.provider,
        apiKey: "sk-openai",
      },
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
          provider: { id: "gemini" },
        },
      },
    }

    const provider = resolveSiteProviderConfig(config, "example.com", null)

    expect(provider.id).toBe("gemini")
    expect(provider.apiKey).toBe("")
    expect(provider.model).toBe("gemini-3.1-flash-lite-preview")
    expect(hasResolvedSiteProviderAccess(config, "example.com", null)).toBe(false)
  })
})
