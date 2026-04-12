import { describe, expect, it } from "vitest"

import {
  DEFAULT_ASTRA_CONFIG,
  applyConfigSyncMutations,
  buildConfigSyncRecordMap,
  hasResolvedProviderAccess,
  resolveManagedProviderConfig,
  resolveSiteTranslationSettings,
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

  it("injects the Astra session token into the resolved provider config", () => {
    const provider = resolveManagedProviderConfig(DEFAULT_ASTRA_CONFIG.provider, session)

    expect(provider.accessToken).toBe("astra-session")
    expect(provider.relayBaseURL).toBe("https://astra.example/v1")
    expect(hasResolvedProviderAccess(DEFAULT_ASTRA_CONFIG.provider, session)).toBe(true)
  })
})
